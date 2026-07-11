

# DH-ACCESSCONTROL-P2-ENFORCEMENT

**Date:** 2026-06-17  
**Branch:** `feat/gap-008-sources-backend-wiring`  
**Verdict:** **REAL ENFORCED**

---

## Summary

Access Control is no longer UI-only. A central `evaluateSourceAccess` service enforces ACL on agent/runtime paths while admin DataHub configuration and source listing remain visible.

---

## Central service

**File:** `backend/services/sourceAccessControlService.js`

```js
evaluateSourceAccess({ sourceId, agentKey, userId, action, dataType }, { failOpen?, audit? })
```


| Policy                                      | Behavior                                                         |
| ------------------------------------------- | ---------------------------------------------------------------- |
| No ACL row                                  | Allow                                                            |
| `blocked_agents` includes `agentKey`        | Deny (overrides allow-list)                                      |
| `allowed_agents` non-empty and key missing  | Deny                                                             |
| `allowed_agents` includes key (not blocked) | Allow                                                            |
| DB error                                    | Fail **closed** (runtime); `failOpen: true` for admin-only paths |
| Denied                                      | `source_access_denied` audit log                                 |
| Allowed                                     | `source_access_allowed` sampled (~2%)                            |


Runtime identity: `publisher` (Telegram Publisher) — not in `ai_agents`, exposed via registry API.

---

## Enforcement map (after P2)


| Path                                              | Enforced       | Mechanism                                                            |
| ------------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| `datahubAutomationService.refreshAutomationQueue` | Yes            | `evaluateSourceAccess` before queue insert (topic agent + publisher) |
| `datahubAutomationService.dispatchQueueItem`      | Yes            | ACL before `runPublisherPublish`                                     |
| `telegramPublisherService.runPublisherPublish`    | Yes            | ACL when `source_id` provided                                        |
| `dataPipeline.processItem`                        | Yes            | `filterAllowedAgents` (legacy queue path)                            |
| `GET /api/v1/data-sources/collected`              | Yes            | SQL filter when `agentKey` / `x-agent-key` present                   |
| `GET /api/v1/data-sources/collected/:id`          | Yes            | 403 when agent denied                                                |
| `GET /api/v1/collected-data`                      | Yes            | SQL filter when agent context present                                |
| `GET /api/v1/collected-data/:id`                  | Yes            | 403 when agent denied                                                |
| `POST /api/v1/ai-agents/:id/run`                  | Yes            | When `input.source_id` / config source present                       |
| `GET /api/v1/data-hub/access-control`             | No (by design) | Admin listing — all active sources                                   |
| `GET /api/v1/data-sources` (admin)                | No (by design) | Admin source management                                              |
| `normalizationWorker`                             | No             | Normalize-only; no agent consumption                                 |
| `require_auth` / rate limits                      | Stored only    | P3 backlog                                                           |


---

## Files changed

### Backend

- `backend/services/sourceAccessControlService.js` (new)
- `backend/utils/sourceAccessRequest.js` (new)
- `backend/services/dataPipeline.js`
- `backend/services/datahubAutomationService.js`
- `backend/services/telegramPublisherService.js`
- `backend/routes/access-control.js`
- `backend/routes/data-sources.js`
- `backend/routes/collected-data.js`
- `backend/routes/ai-agents.js`
- `backend/schemas/dataHubSchemas.js`
- `backend/__tests__/unit/sourceAccessControl.test.js` (new)
- `backend/__tests__/integration/sourceAccessControlEnforcement.test.js` (new)

### Frontend

- `components/.../modals/AccessControlModal.tsx` — registry multi-select
- `components/.../advanced/AccessControlPanel.tsx` — enforcement banner
- `services/accessControlApi.ts`
- `hooks/useAccessControl.ts`
- `deploy/blue/locales/en.json`, `deploy/green/locales/en.json`

---

## Tests / build

```
npm test -- --testPathPattern="sourceAccessControl"
```


| Suite                                                  | Result         |
| ------------------------------------------------------ | -------------- |
| `sourceAccessControl.test.js` (unit)                   | 8/8 PASS       |
| `sourceAccessControlEnforcement.test.js` (integration) | 8/8 PASS       |
| **Total**                                              | **16/16 PASS** |


---

## API examples

### Registry agents (for Configure modal)

```http
GET /api/v1/data-hub/access-control/agents/registry
Authorization: Bearer <token>
```

```json
{
  "agents": [
    { "agent_key": "technical", "name": "Technical Analysis Agent", "runtime": false },
    { "agent_key": "publisher", "name": "Telegram Publisher (runtime)", "runtime": true }
  ]
}
```

### Set ACL

```http
POST /api/v1/data-hub/access-control/{sourceId}
Content-Type: application/json

{
  "allowed_agents": ["technical"],
  "blocked_agents": ["publisher"],
  "allowed_data_types": [],
  "blocked_data_types": [],
  "require_auth": false,
  "max_requests_per_minute": 0,
  "max_requests_per_day": 0
}
```

Audit: `source_access_config_updated` in `data_hub_logs`.

### Agent collected-data read (enforced)

```http
GET /api/v1/data-sources/collected/{id}?agentKey=technical
X-Agent-Key: technical
```

- `technical` on allow-list → **200**
- `sentiment` not on allow-list → **403** `SOURCE_ACCESS_DENIED`
- No `agentKey` (admin UI) → **200** (unchanged)

### Publisher publish (enforced)

```http
POST /api/v1/telegram/publishers/{id}/publish
{
  "message": "...",
  "confirm_publish": true,
  "source_id": "<uuid>"
}
```

Blocked when `publisher` ∈ `blocked_agents`.

---

## DB evidence (verification run)

**Source:** `alphavantage DEMO TEST` (`ed0fb136-d20f-46f6-97aa-e70d2605cfef`)

Temp ACL (cleaned up after verify):

```sql
allowed_agents = '{technical}'
blocked_agents = '{publisher}'
```


| Agent       | `evaluateSourceAccess`             |
| ----------- | ---------------------------------- |
| `technical` | allowed                            |
| `publisher` | denied (`agent_blocked`)           |
| `sentiment` | denied (`agent_not_in_allow_list`) |


Admin JOIN still returned source row with ACL attached.

Audit logs written:

- `source_access_denied` × 2 (publisher, sentiment)
- `source_access_allowed` × 1 (technical, sampled)

Post-cleanup: `SELECT COUNT(*) FROM source_access_controls` → **0 rows** for test source.

---

## UI

- Configure modal: checkbox multi-select from `ai_agents` + runtime `publisher` (name + `agent_key`).
- Banner: *"Access policies are enforced for agent/runtime paths. Admin source management remains visible."*

---

## Verdict

**REAL ENFORCED** — server-side ACL on automation enqueue/dispatch, publisher, agent run (with source), collected-data APIs (with agent context), and pipeline routing. Admin ACL/source panels unchanged.

**P3 backlog:** `require_auth`, rate limits, normalization scheduler hook (if agents added later).

# DH-ACCESSCONTROL-P2-ENFORCEMENT

**Date:** 2026-06-17  
**Branch:** `feat/gap-008-sources-backend-wiring`  
**Verdict:** **REAL ENFORCED**

---

## Summary

Access Control is no longer UI-only. A central `evaluateSourceAccess` service enforces ACL on agent/runtime paths while admin DataHub configuration and source listing remain visible.

---

## Central service

**File:** `backend/services/sourceAccessControlService.js`

```js
evaluateSourceAccess({ sourceId, agentKey, userId, action, dataType }, { failOpen?, audit? })
```


| Policy                                      | Behavior                                                         |
| ------------------------------------------- | ---------------------------------------------------------------- |
| No ACL row                                  | Allow                                                            |
| `blocked_agents` includes `agentKey`        | Deny (overrides allow-list)                                      |
| `allowed_agents` non-empty and key missing  | Deny                                                             |
| `allowed_agents` includes key (not blocked) | Allow                                                            |
| DB error                                    | Fail **closed** (runtime); `failOpen: true` for admin-only paths |
| Denied                                      | `source_access_denied` audit log                                 |
| Allowed                                     | `source_access_allowed` sampled (~2%)                            |


Runtime identity: `publisher` (Telegram Publisher) — not in `ai_agents`, exposed via registry API.

---

## Enforcement map (after P2)


| Path                                              | Enforced       | Mechanism                                                            |
| ------------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| `datahubAutomationService.refreshAutomationQueue` | Yes            | `evaluateSourceAccess` before queue insert (topic agent + publisher) |
| `datahubAutomationService.dispatchQueueItem`      | Yes            | ACL before `runPublisherPublish`                                     |
| `telegramPublisherService.runPublisherPublish`    | Yes            | ACL when `source_id` provided                                        |
| `dataPipeline.processItem`                        | Yes            | `filterAllowedAgents` (legacy queue path)                            |
| `GET /api/v1/data-sources/collected`              | Yes            | SQL filter when `agentKey` / `x-agent-key` present                   |
| `GET /api/v1/data-sources/collected/:id`          | Yes            | 403 when agent denied                                                |
| `GET /api/v1/collected-data`                      | Yes            | SQL filter when agent context present                                |
| `GET /api/v1/collected-data/:id`                  | Yes            | 403 when agent denied                                                |
| `POST /api/v1/ai-agents/:id/run`                  | Yes            | When `input.source_id` / config source present                       |
| `GET /api/v1/data-hub/access-control`             | No (by design) | Admin listing — all active sources                                   |
| `GET /api/v1/data-sources` (admin)                | No (by design) | Admin source management                                              |
| `normalizationWorker`                             | No             | Normalize-only; no agent consumption                                 |
| `require_auth` / rate limits                      | Stored only    | P3 backlog                                                           |


---

## Files changed

### Backend

- `backend/services/sourceAccessControlService.js` (new)
- `backend/utils/sourceAccessRequest.js` (new)
- `backend/services/dataPipeline.js`
- `backend/services/datahubAutomationService.js`
- `backend/services/telegramPublisherService.js`
- `backend/routes/access-control.js`
- `backend/routes/data-sources.js`
- `backend/routes/collected-data.js`
- `backend/routes/ai-agents.js`
- `backend/schemas/dataHubSchemas.js`
- `backend/__tests__/unit/sourceAccessControl.test.js` (new)
- `backend/__tests__/integration/sourceAccessControlEnforcement.test.js` (new)

### Frontend

- `components/.../modals/AccessControlModal.tsx` — registry multi-select
- `components/.../advanced/AccessControlPanel.tsx` — enforcement banner
- `services/accessControlApi.ts`
- `hooks/useAccessControl.ts`
- `deploy/blue/locales/en.json`, `deploy/green/locales/en.json`

---

## Tests / build

```
npm test -- --testPathPattern="sourceAccessControl"
```


| Suite                                                  | Result         |
| ------------------------------------------------------ | -------------- |
| `sourceAccessControl.test.js` (unit)                   | 8/8 PASS       |
| `sourceAccessControlEnforcement.test.js` (integration) | 8/8 PASS       |
| **Total**                                              | **16/16 PASS** |


---

## API examples

### Registry agents (for Configure modal)

```http
GET /api/v1/data-hub/access-control/agents/registry
Authorization: Bearer <token>
```

```json
{
  "agents": [
    { "agent_key": "technical", "name": "Technical Analysis Agent", "runtime": false },
    { "agent_key": "publisher", "name": "Telegram Publisher (runtime)", "runtime": true }
  ]
}
```

### Set ACL

```http
POST /api/v1/data-hub/access-control/{sourceId}
Content-Type: application/json

{
  "allowed_agents": ["technical"],
  "blocked_agents": ["publisher"],
  "allowed_data_types": [],
  "blocked_data_types": [],
  "require_auth": false,
  "max_requests_per_minute": 0,
  "max_requests_per_day": 0
}
```

Audit: `source_access_config_updated` in `data_hub_logs`.

### Agent collected-data read (enforced)

```http
GET /api/v1/data-sources/collected/{id}?agentKey=technical
X-Agent-Key: technical
```

- `technical` on allow-list → **200**
- `sentiment` not on allow-list → **403** `SOURCE_ACCESS_DENIED`
- No `agentKey` (admin UI) → **200** (unchanged)

### Publisher publish (enforced)

```http
POST /api/v1/telegram/publishers/{id}/publish
{
  "message": "...",
  "confirm_publish": true,
  "source_id": "<uuid>"
}
```

Blocked when `publisher` ∈ `blocked_agents`.

---

## DB evidence (verification run)

**Source:** `alphavantage DEMO TEST` (`ed0fb136-d20f-46f6-97aa-e70d2605cfef`)

Temp ACL (cleaned up after verify):

```sql
allowed_agents = '{technical}'
blocked_agents = '{publisher}'
```


| Agent       | `evaluateSourceAccess`             |
| ----------- | ---------------------------------- |
| `technical` | allowed                            |
| `publisher` | denied (`agent_blocked`)           |
| `sentiment` | denied (`agent_not_in_allow_list`) |


Admin JOIN still returned source row with ACL attached.

Audit logs written:

- `source_access_denied` × 2 (publisher, sentiment)
- `source_access_allowed` × 1 (technical, sampled)

Post-cleanup: `SELECT COUNT(*) FROM source_access_controls` → **0 rows** for test source.

---

## UI

- Configure modal: checkbox multi-select from `ai_agents` + runtime `publisher` (name + `agent_key`).
- Banner: *"Access policies are enforced for agent/runtime paths. Admin source management remains visible."*

---

## Verdict

**REAL ENFORCED** — server-side ACL on automation enqueue/dispatch, publisher, agent run (with source), collected-data APIs (with agent context), and pipeline routing. Admin ACL/source panels unchanged.

**P3 backlog:** `require_auth`, rate limits, normalization scheduler hook (if agents added later).