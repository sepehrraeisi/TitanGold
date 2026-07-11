# DH-ACCESSCONTROL-P1 — RCA & Enforcement Audit

**Date:** 2026-06-17  
**Mode:** Read-only (no code changes, no data mutations)  
**Verdict:** **C) UI ONLY** (config CRUD real; **no production enforcement**)

---

## Executive summary

Access Control provides a **real backend API** and **persistent DB table** (`source_access_controls`), but **no active runtime path enforces ACL rules** in production. The only enforcement implementation lives in **legacy `dataPipeline.js`**, which is **not called by the scheduler** (replaced by `normalizationWorker.js`, normalize-only). All read APIs, automation routing, Telegram Publisher, and AI agent consumption **bypass** per-source ACL.

Configuring "blocked agents" today has **no effect** on data access. UI correctly shows all sources as **Default access** because `source_access_controls` has **0 rows**.

---

## PHASE A — Product purpose & expected behavior

### Intended object (from code/docs)

| Scope | Evidence |
|-------|----------|
| **Per-source ACL** | `source_access_controls` keyed by `source_id` (migration `021`, contract `ACCESS_CONTROL_API_CONTRACT.md`) |
| **Agent keys** | `allowed_agents[]`, `blocked_agents[]` — string agent identifiers |
| **Data types** | `allowed_data_types[]`, `blocked_data_types[]` |
| **Rate limits** | `max_requests_per_minute`, `max_requests_per_day` |
| **Auth flag** | `require_auth` boolean |

**Out of scope (v3.0):** user-role matrix, API keys, IP allowlist (removed from UI per contract).

### Semantics (from migration + `dataPipeline.checkAccess`)

| Concept | Meaning |
|---------|---------|
| **Allowed Agents** | If list **non-empty**, only listed `agent_key` values may receive routed data. Empty = no allow-list restriction. |
| **Blocked Agents** | Agents in list are **denied** (filtered out). |
| **Default access** | No row in `source_access_controls` → all agents allowed (pass-through). |
| **Default access (UI)** | `has_custom_rule = false` OR custom rule without allow-list/rate limit → green "Default access" badge. |
| **Restricted (UI)** | Custom rule with `allowedAgents.length > 0` OR `maxRequestsPerMinute > 0` → amber badge. |

### Control model

- **Primary:** per-source, **agent-key-based** (intended for AI agent routing to `data_queue`)
- **Secondary:** data-type filtering on normalized payload
- **Not:** user RBAC for source listing (that's JWT `authenticate` + DataHub write role `admin|trader`)
- **Not:** category-level ACL (no per-category table)

### Intended access types (design intent from TASK-DF-009)

- **Read/routing access** for AI agents consuming normalized data
- **Not documented** for: user UI read blocking, publish blocking, training isolation

### Default when no custom rule

**Allow all agents** — `checkAccess` returns unfiltered `agentKeys` when no ACL row exists.

---

## PHASE B — Backend route audit

**Mount:** `/api/v1/data-hub/access-control` (`backend/routes/v1/index.js`)

| Method | Path | Handler | Auth | Writes DB | Enforces access |
|--------|------|---------|------|-----------|-----------------|
| `GET` | `/` | `access-control.js` L42 | JWT `authenticate` | No (read) | **No** — config list only |
| `GET` | `/:sourceId` | L96 | JWT | No | **No** |
| `POST` | `/:sourceId` | L133 | JWT + `authorize('admin','trader')` | Yes — upsert `source_access_controls` | **No** — config only |
| `DELETE` | `/:sourceId` | L184 | JWT + admin/trader | Yes — delete row | **No** |

**Schema:** `backend/schemas/accessControlSchemas.js` (Zod validation on POST body).

**Frontend wiring:**

| UI action | API |
|-----------|-----|
| Tab load / Refresh | `GET /api/v1/data-hub/access-control/` via `useAccessControlListQuery` |
| Configure → Save | `POST /:sourceId` via `upsertAccessControl` |
| Reset | `DELETE /:sourceId` |

**Summary cards:** Computed **client-side** in `AccessControlPanel.tsx` from API `rules[]` — not a separate summary endpoint.

---

## PHASE C — Database model

### Table: `source_access_controls`

```sql
source_id UUID UNIQUE FK → data_sources(id) ON DELETE CASCADE
allowed_agents TEXT[] DEFAULT '{}'
blocked_agents TEXT[] DEFAULT '{}'
allowed_data_types TEXT[] DEFAULT '{}'
blocked_data_types TEXT[] DEFAULT '{}'
require_auth BOOLEAN DEFAULT FALSE
max_requests_per_minute INTEGER DEFAULT 0  -- 0 = unlimited
max_requests_per_day INTEGER DEFAULT 0
updated_by UUID FK → users(id)
```

**Migration:** `021_create_source_access_control.sql`  
**Comment:** `empty allowed_agents = all allowed`

### Production counts (2026-06-17)

| Metric | Value |
|--------|------:|
| Total `source_access_controls` rows | **0** |
| Custom rules | **0** |
| Allowed-only rules | **0** |
| Blocked-agent rules | **0** |
| Active sources (in ACL list API) | **49** |
| Total sources | **55** |

**Why UI shows Custom rules = 0:** Table is empty; `has_custom_rule = Boolean(sac.id)` is false for all sources.

**Historical non-default access:** None in DB.

### Related tables (not ACL)

| Table | Relation |
|-------|----------|
| `ai_agents` | 15 registered agents (`agent_key` column) — **not FK-linked** to ACL |
| `data_queue` | Legacy agent queue — **0 rows**, no `agent_key` column |
| `datahub_automation_queue` | 34 rows — separate automation path, no ACL |

No `data_sources.allowed_agents` columns — ACL is only in `source_access_controls`.

---

## PHASE D — Frontend UI audit

**Component:** `components/.../advanced/AccessControlPanel.tsx`  
**Modal:** `modals/AccessControlModal.tsx`

### Summary cards (actual labels vs human QA)

| Card (i18n key) | Label | Computation |
|-----------------|-------|-------------|
| `access_metric_sources` | **Active sources** | `rules.length` (49) |
| `access_metric_rules` | **Custom rules** | `rules.filter(hasCustomRule).length` (0) |
| `access_metric_restricted` | **Restricted** | custom rules with allow-list or rate limit (0) |

Human QA reported "Total 55 / Active 49 / Blocked 0" — likely **parent Data Hub stats** (`PipelineHealthOverview` / `GET /data-sources/stats`) visible above Advanced Features, not Access Control cards. ACL panel does **not** show "Blocked" — it shows **Restricted**.

### Per-source display

- **Default access** (`access_status_default`): no custom rule OR custom without allow-list/rate limit
- **Configure** opens modal with free-text comma-separated fields (not agent dropdown)

### Configure modal fields

- Allowed Agents (empty = all)
- Blocked Agents
- Allowed Data Types
- Max requests/minute
- Require auth toggle

**Agent list:** **Free-text** (`placeholder: agent_key_1, agent_key_2`) — **not** loaded from `ai_agents` table.

### Supported operations

| Feature | Supported |
|---------|-----------|
| Per-source configure | ✓ |
| Reset to default (DELETE) | ✓ |
| Allow-all (empty allowed list) | ✓ |
| Deny via blocked list | ✓ (stored only) |
| Allow-list only | ✓ (stored only) |
| Per-category | ✗ |
| Agent picker from registry | ✗ |

---

## PHASE E — Enforcement: source read APIs

| Endpoint / service | Reads sources? | Reads collected_data? | ACL check? | Result |
|--------------------|----------------|----------------------|------------|--------|
| `GET /api/v1/data-sources` | ✓ | No | **No** | All active sources for any authenticated user |
| `GET /api/v1/data-sources/:id` | ✓ | No | **No** | Full source metadata |
| `GET /api/v1/data-sources/collected` | via join | ✓ | **No** | Filter by query params only |
| `GET /api/v1/data-sources/collected/:id` | join | ✓ | **No** | Single row |
| `GET /api/v1/collected-data` | join | ✓ | **No** | Paginated, no agent filter |
| `GET /api/v1/data-sources/pipeline` | ✓ | metrics | **No** | Snapshot for UI |
| `GET /api/v1/data-hub/access-control/` | ✓ | No | **No** | Returns ACL config only |

**Blocked source in UI/API:** If a rule existed, source would **still appear** in data-sources and collected-data APIs — ACL is not consulted.

---

## PHASE F — Enforcement: AI agents & internal services

| Service | Uses source/collected data? | Agent identity? | ACL enforced? | Risk |
|---------|----------------------------|-----------------|-----------------|------|
| **`normalizationWorker`** (production scheduler) | ✓ collected_data | No | **No** | High — active path |
| **`dataPipeline`** (legacy) | ✓ | agentKeys in memory | **Yes** in `checkAccess` | **Dead code** — not scheduled |
| **`dataRouter`** | normalized | N/A | No | Routes by keywords only |
| **`topicRouter`** | normalized | topic agents | No | |
| **`datahubAutomationService`** | ✓ collected_data | topic.agentId | **No** | High — 34 queue rows |
| **`telegramPublisherService`** | publish config | No | **No** | |
| **Artemis / manual trading** | indirect | N/A | No | |
| **Training endpoints** | not audited in depth | — | **No** evidence | Medium |

### Production scheduler evidence

```javascript
// backend/engine/scheduler.js
const summary = await processNormalizationBatch(batchSize);
// NOT dataPipeline.processPendingData()
```

Unit test explicitly asserts scheduler does **not** call `dataPipeline.processPendingData`.

### Legacy enforcement logic (not production)

`dataPipeline.checkAccess(sourceId, agentKeys, normalizedData)`:

1. No ACL row → return all agentKeys
2. `allowed_agents` non-empty → filter to list
3. `blocked_agents` → remove matches
4. Data type allow/block on `normalizedData.data_type`
5. On DB error → **fail-open** (return all agentKeys)

**Note:** `data_queue` INSERT does not store `agent_key`; table has no `agent_key` column. Legacy queue cannot attribute rows to agents.

---

## PHASE G — Telegram Publisher

| Question | Answer |
|----------|--------|
| Publish from any source? | Publisher uses its own config + automation queue; **no source ACL check** |
| Blocked agent check? | **No** |
| Source access before publish? | **No** |
| Outbound channel policy? | Publisher-level only (`telegram_publishers` table) |

**Status:** Future dependency for P2 enforcement.

---

## PHASE H — Automation Routing

| Question | Answer |
|----------|--------|
| Route blocked sources? | **Yes** — no ACL evaluation in `enqueueAutomationFromPipeline` |
| Evaluate allowed/blocked agents? | **No** |
| Agent identity? | `topic.agentId` from automation topics config |
| Bypass Access Control? | **Yes** — entirely separate queue |

---

## PHASE I — Access decision logic

### Centralized engine

**No shared `evaluateSourceAccess()` service** exported for runtime use.

Only implementation: `dataPipeline.checkAccess()` — **legacy, unwired**.

### Policy truth table (legacy `checkAccess` behavior)

| # | Condition | Result |
|---|-----------|--------|
| 1 | No ACL row | **Allow** all routed agents |
| 2 | `allowed_agents` empty, `blocked_agents` empty | **Allow** (subject to data-type filters) |
| 3 | Agent in `blocked_agents` | **Deny** |
| 4 | Agent in `allowed_agents` (when list non-empty) | **Allow** |
| 5 | `allowed_agents` non-empty, agent not in list | **Deny** |
| 6 | Both blocked and allowed | **Deny** if blocked (blocked checked after allow filter) |
| 7 | Admin user bypass | **No** — not in checkAccess |
| 8 | `require_auth` | **Not evaluated** anywhere |
| 9 | `max_requests_per_minute` | **Not evaluated** anywhere |
| 10 | DB error during check | **Fail-open** (allow all) |

### Recommended target behavior (P2 — document only)

- Default allow when no rule
- Blocked overrides allowed
- Allow-list restricts when non-empty
- Server-side enforcement at collected_data read + automation enqueue + agent consume
- Fail-closed option for high-security sources
- Audit log on deny

---

## PHASE J — Agent identity audit

### `ai_agents` table (production)

**15 rows**, examples:

| name | agent_key |
|------|-----------|
| Technical Analysis Agent | `technical` |
| Sentiment Analysis Agent | `sentiment` |
| Market Intelligence Agent | `market_intelligence` |
| Risk Management Agent | `risk` |
| … | … |

### UI vs registry mismatch

- **UI:** free-text comma-separated agent strings
- **Integration tests** use `technical_analysis`, `sentiment_analysis` — **do not match** `ai_agents.agent_key` values (`technical`, `sentiment`)
- **dataRouter** emits keys like `market_intelligence`, `sentiment` — closer to registry

**Conclusion:** Even if legacy pipeline ran, operator-entered agent keys may not match router/registry keys without documentation.

---

## PHASE K — Security risk register

| # | Risk | Severity |
|---|------|----------|
| 1 | Blocked agents in UI do not block API or automation | **Critical** |
| 2 | All internal services bypass ACL | **Critical** |
| 3 | Enforcement only in dead `dataPipeline` path | **High** |
| 4 | `require_auth` / rate limits stored but never enforced | **High** |
| 5 | Fail-open on ACL DB error (legacy code) | **Medium** |
| 6 | No audit log on ACL config change | **Medium** |
| 7 | No audit log on access deny (no denies occur) | **Low** |
| 8 | Configure API protected (admin/trader) | **Low** — OK |
| 9 | List/read APIs require JWT | **Low** — OK |
| 10 | Agent key spoofing — no runtime agent auth | **High** (future) |
| 11 | UI implies agent whitelisting without "not enforced" warning | **Medium** |

**Server-side enforcement:** Config writes yes; data access **no**.

---

## PHASE L — Summary card audit

| Human QA label | Actual ACL panel | Source | Accurate? |
|----------------|------------------|--------|-----------|
| Total sources 55 | Not on ACL panel | `GET /data-sources/stats` (parent UI) | N/A for ACL |
| Active sources 49 | **Active sources** card | `rules.length` from ACL list (= active sources) | ✓ |
| Custom rules 0 | **Custom rules** card | `hasCustomRule` count | ✓ |
| Blocked 0 | **Restricted** card (not "Blocked") | allow-list + rate limit count | Label mismatch in QA |

**Recommendation:** Rename or add tooltip — "Restricted" ≠ "blocked agents count".

---

## PHASE M — Verdict

### **C) UI ONLY**

| Criterion | Assessment |
|-----------|------------|
| Server-side decision engine in production | **No** |
| Source/collected_data APIs use ACL | **No** |
| AI/services use ACL | **No** |
| Blocked sources/agents actually denied | **No** |
| Config CRUD + DB persistence | **Yes** |

**Not D (Broken/Unsafe)** — no rules configured, so no active false sense of blocking in production data paths. **However**, if an operator configures blocked agents believing enforcement exists, that would be **misleading** → P2 should add UI warning.

**Not B (Partial)** — no production enforcement path qualifies; legacy code is unwired.

---

## PHASE N — Recommended P2 plan

1. **`evaluateSourceAccess({ sourceId, agentId, userId, action, dataType })`** — central service
2. **Wire enforcement** at:
   - `GET` collected-data (agent-context requests)
   - `datahubAutomationService` enqueue
   - Agent consume workers (when built)
   - Telegram Publisher (optional source binding)
3. **Agent registry integration** — UI multi-select from `ai_agents.agent_key`
4. **Implement `require_auth` + rate limits** or remove from UI until ready
5. **Audit logs:** `source_access_config_updated`, `source_access_denied`
6. **UI:** banner "Policies are stored but not yet enforced on all paths" until complete
7. **Tests:** blocked agent, allow-list, default allow, automation respect, API filter
8. **Fail-closed** option per source (config flag)

---

## PHASE O — Deliverables checklist

| Item | Location |
|------|----------|
| RCA document | `docs/ssot_v3/DH-ACCESSCONTROL-P1-RCA.md` |
| Route audit | Phase B table |
| DB evidence | Phase C (`0` ACL rows) |
| Enforcement map | Phases E–H tables |
| Risk register | Phase K |
| Verdict | **C) UI ONLY** |
| Next task | **DH-ACCESSCONTROL-P2-ENFORCEMENT** |

**Code changes:** None  
**Migrations run:** None  
**Production data modified:** None
