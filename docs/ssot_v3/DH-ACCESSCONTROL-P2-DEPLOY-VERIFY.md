# DH-ACCESSCONTROL-P2-DEPLOY-VERIFY

**Date:** 2026-06-17  
**Runtime:** local production-like runtime (`pm2`, backend port `5002`)  
**Task:** Verify Access Control P2 enforcement after implementation  
**Final verdict:** **PARTIAL**

Access Control P2 is enforced for direct policy evaluation, collected-data reads with agent context, automation enqueue, the internal Telegram Publisher service, and AI agent run with `config.source_id`. One runtime/API gap remains: the public Telegram Publisher publish endpoint does not pass `source_id` through validation, so ACL is bypassed at that endpoint.

---

## 1. Commit / Status

### Git status

P2 implementation is present in the working tree but not committed. Recent HEAD:

```text
9a21f87 Document Smart Prioritization P2 post-verify tuning audit.
```

Changed files observed:

```text
backend/routes/access-control.js
backend/routes/ai-agents.js
backend/routes/collected-data.js
backend/routes/data-sources.js
backend/schemas/dataHubSchemas.js
backend/services/dataPipeline.js
backend/services/datahubAutomationService.js
backend/services/telegramPublisherService.js
components/ai/AIManager/tabs/DataHub/advanced/AccessControlPanel.tsx
components/ai/AIManager/tabs/DataHub/modals/AccessControlModal.tsx
deploy/blue/locales/en.json
deploy/green/locales/en.json
hooks/useAccessControl.ts
services/accessControlApi.ts
backend/services/sourceAccessControlService.js
backend/utils/sourceAccessRequest.js
backend/__tests__/unit/sourceAccessControl.test.js
backend/__tests__/integration/sourceAccessControlEnforcement.test.js
docs/ssot_v3/DH-ACCESSCONTROL-P2-ENFORCEMENT.md
```

Existing unrelated dirty files also remain in the tree:

```text
components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx
components/ai/AIManager/tabs/DataHub/advanced/Archiving.tsx
types.ts
scripts/backup-db.sh.final
scripts/backup-db.sh.fixed
tmp-dh-quality-audit-output.txt
```

### Backend restart

`pm2 list` confirmed two `titan-backend` cluster processes online:

```text
titan-backend id 4 online uptime ~90m restart count 46
titan-backend id 5 online uptime ~90m restart count 46
```

Health check returned `200`.

### Frontend build

Command:

```bash
npm run build
```

Result:

```text
✓ built in 1m 59s
```

Build emitted pre-existing export/chunk warnings, but completed successfully.

### Tests

Command:

```bash
cd backend && npm test -- --testPathPattern="sourceAccessControl" --no-coverage
```

Result:

```text
PASS __tests__/unit/sourceAccessControl.test.js
PASS __tests__/integration/sourceAccessControlEnforcement.test.js
Tests: 16 passed, 16 total
```

### `source_access_controls` schema

Schema is unchanged; P2 only uses existing fields:

```text
id uuid primary key default uuid_generate_v4()
source_id uuid unique references data_sources(id) on delete cascade
allowed_agents text[] default '{}'
blocked_agents text[] default '{}'
allowed_data_types text[] default '{}'
blocked_data_types text[] default '{}'
require_auth boolean default false
max_requests_per_minute integer default 0
max_requests_per_day integer default 0
created_at timestamptz default now()
updated_at timestamptz default now()
updated_by uuid references users(id) on delete set null
```

Initial ACL count before deploy verification: `0`.

---

## 2. Registry Verification

API:

```http
GET /api/v1/data-hub/access-control/agents/registry
```

Result:

```text
status: 200
count: 16
has technical: true
has publisher: true
```

Sample registry values:

```text
Arbitrage Agent (arbitrage)
Fundamental Agent (fundamental)
Liquidity Agent (liquidity)
Market Intelligence Agent (market_intelligence)
Optimization Agent (optimization)
Order Management Agent (order)
Pattern Recognition Agent (pattern)
Portfolio Allocation Agent (portfolio)
...
Technical Analysis Agent (technical)
Telegram Publisher (runtime) (publisher)
```

The registry keys match enforcement identities:

```text
technical -> ai_agents.agent_key
sentiment -> ai_agents.agent_key
publisher -> runtime publisher key used by Telegram Publisher enforcement
```

---

## 3. Temporary ACL

Safe source used:

```text
source: alphavantage DEMO TEST
source_id: ed0fb136-d20f-46f6-97aa-e70d2605cfef
```

Temporary ACL created through API:

```http
POST /api/v1/data-hub/access-control/ed0fb136-d20f-46f6-97aa-e70d2605cfef
```

Payload:

```json
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

Result:

```text
status: 200
allowed_agents: ["technical"]
blocked_agents: ["publisher"]
```

---

## 4. Runtime Enforcement Evidence

### A. Direct `evaluateSourceAccess`

```text
technical -> allowed=true, reason=allowed
publisher -> allowed=false, reason=agent_blocked
sentiment -> allowed=false, reason=agent_not_in_allow_list
```

Pass.

### B. Collected Data API

Temporary collected_data row:

```text
id: 20e0d7bf-c6cb-467d-b61f-8ebd558b3c18
source_id: ed0fb136-d20f-46f6-97aa-e70d2605cfef
metadata.data_type: verify_acl
```

API evidence:

```text
GET /api/v1/data-sources/collected/{id}
  -> 200

GET /api/v1/data-sources/collected/{id}?agentKey=technical
  -> 200

GET /api/v1/data-sources/collected/{id}?agentKey=publisher
  -> 403 SOURCE_ACCESS_DENIED

GET /api/v1/data-sources/collected/{id}?agentKey=sentiment
  -> 403 SOURCE_ACCESS_DENIED
```

Pass.

### C. Automation Enqueue

Temporary automation topic:

```text
agentId: technical
publisherTargets: [temporary publisher]
dataTypes: ["verify_acl"]
includeStatuses: ["ready"]
```

Evidence:

```text
technical policy: allowed=true
publisher policy: allowed=false, reason=agent_blocked
queueBefore: 0
refreshAdded: 0
queueAfter: 0
deniedRowsInserted: false
```

Pass. Denied publisher path prevented queue insertion.

### D. Telegram Publisher

Internal service call:

```js
runPublisherPublish(publisherId, {
  message: "DH ACL P2 verify service publish",
  content_type: "deploy_verify",
  confirm_publish: true,
  source_id: sourceId,
  data_type: "verify_acl"
})
```

Result:

```text
status: 403
code: SOURCE_ACCESS_DENIED
message: Publisher access denied by source ACL
```

Internal service enforcement passes.

Public API endpoint:

```http
POST /api/v1/data-hub/telegram-publishers/{publisherId}/publish
```

Payload included:

```json
{
  "message": "DH ACL P2 verify API publish",
  "content_type": "deploy_verify",
  "confirm_publish": true,
  "source_id": "ed0fb136-d20f-46f6-97aa-e70d2605cfef",
  "data_type": "verify_acl"
}
```

Result:

```text
status: 200
success: true
dry_run: true
error: null
```

Fail for this API path. The blocked `publisher` runtime identity was not enforced here. Root cause: `publishPublisherSchema` currently accepts only:

```text
message
content_type
confirm_publish
title
content
```

So `source_id` / `data_type` are stripped before `runPublisherPublish`, causing a silent ACL bypass for the public publish endpoint.

### E. AI Agent Run

Agent rows:

```text
technical: f527c6f6-55ca-4193-a286-ccfed51261ee
sentiment: 21c3a3d4-75db-44a1-9249-fbf1c763759d
```

Allowed agent:

```http
POST /api/v1/ai-agents/f527c6f6-55ca-4193-a286-ccfed51261ee/run
```

Payload:

```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "config": {
    "source_id": "ed0fb136-d20f-46f6-97aa-e70d2605cfef"
  }
}
```

Result:

```text
status: 200
agent_key: technical
ok: true
```

Denied agent:

```http
POST /api/v1/ai-agents/21c3a3d4-75db-44a1-9249-fbf1c763759d/run
```

Result:

```text
status: 403
code: SOURCE_ACCESS_DENIED
reason: agent_not_in_allow_list
```

Pass.

---

## 5. Audit Logs

`data_hub_logs` contained required audit events for the temporary source.

Observed:

```text
source_access_config_updated
  status: success
  allowed_agents: ["technical"]
  blocked_agents: ["publisher"]

source_access_denied
  agent_key: publisher
  reason: agent_blocked
  access_action: deploy_verify_direct

source_access_denied
  agent_key: sentiment
  reason: agent_not_in_allow_list
  access_action: deploy_verify_direct

source_access_denied
  agent_key: publisher
  reason: agent_blocked
  access_action: collected_data_read

source_access_denied
  agent_key: sentiment
  reason: agent_not_in_allow_list
  access_action: collected_data_read

source_access_denied
  agent_key: publisher
  reason: agent_blocked
  access_action: publisher_publish

source_access_denied
  agent_key: sentiment
  reason: agent_not_in_allow_list
  access_action: agent_run
```

`source_access_allowed` is sampled and was not observed in this deploy-verify run.

---

## 6. Cleanup Evidence

Temporary objects removed:

```text
datahub_automation_queue rows for temp topic
datahub_automation_topics temp topic
publisher_delivery_history for temp publisher
telegram_publishers temp publisher
collected_data temp row
source_access_controls temp row
temporary users/session
```

Cleanup result:

```text
cleanupErrors: []
previousAclCount: 0
finalAclCount: 0
SELECT COUNT(*) FROM source_access_controls -> 0
```

Pass.

---

## 7. Regression Checks

Runtime API checks:

```text
GET /api/v1/data-sources?limit=5
  -> 200

GET /api/v1/data-sources/pipeline
  -> 200

GET /api/v1/data-hub/access-control
  -> 200

GET /api/v1/data-hub/automation/topics
  -> 200

GET /api/v1/data-hub/telegram-publishers
  -> 200
```

Admin source and ACL listing remain visible. Access policies restrict runtime/agent consumption only when an agent/runtime context is present.

---

## Final Verdict

**PARTIAL**

Passing paths:

```text
direct evaluateSourceAccess
collected data API with agentKey/header context
automation enqueue
internal Telegram Publisher service
AI agent run with config.source_id
admin/source/ACL listing
registry modal source data
audit deny/config logs
cleanup
```

Blocking issue:

```text
POST /api/v1/data-hub/telegram-publishers/:id/publish
```

The public Publisher endpoint returned `200 dry_run` even when `publisher` was blocked for the source. This is an ACL bypass because `source_id` and `data_type` are not part of `publishPublisherSchema`, so the service receives no source context and cannot enforce the ACL.

Per verification criteria: **PARTIAL** because a runtime publishing path bypasses ACL. It is not **REAL ENFORCED** until the Publisher API schema/route passes `source_id` into `runPublisherPublish` and returns `403 SOURCE_ACCESS_DENIED` for blocked publisher access.
# DH-ACCESSCONTROL-P2-DEPLOY-VERIFY

**Date:** 2026-06-17  
**Runtime:** local production-like runtime (`pm2`, backend port `5002`)  
**Task:** Verify Access Control P2 enforcement after implementation  
**Final verdict:** **PARTIAL**

Access Control P2 is enforced for direct policy evaluation, collected-data reads with agent context, automation enqueue, the internal Telegram Publisher service, and AI agent run with `config.source_id`. One runtime/API gap remains: the public Telegram Publisher publish endpoint does not pass `source_id` through validation, so ACL is bypassed at that endpoint.

---

## 1. Commit / Status

### Git status

P2 implementation is present in the working tree but not committed. Recent HEAD:

```text
9a21f87 Document Smart Prioritization P2 post-verify tuning audit.
```

Changed files observed:

```text
backend/routes/access-control.js
backend/routes/ai-agents.js
backend/routes/collected-data.js
backend/routes/data-sources.js
backend/schemas/dataHubSchemas.js
backend/services/dataPipeline.js
backend/services/datahubAutomationService.js
backend/services/telegramPublisherService.js
components/ai/AIManager/tabs/DataHub/advanced/AccessControlPanel.tsx
components/ai/AIManager/tabs/DataHub/modals/AccessControlModal.tsx
deploy/blue/locales/en.json
deploy/green/locales/en.json
hooks/useAccessControl.ts
services/accessControlApi.ts
backend/services/sourceAccessControlService.js
backend/utils/sourceAccessRequest.js
backend/__tests__/unit/sourceAccessControl.test.js
backend/__tests__/integration/sourceAccessControlEnforcement.test.js
docs/ssot_v3/DH-ACCESSCONTROL-P2-ENFORCEMENT.md
```

Existing unrelated dirty files also remain in the tree:

```text
components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx
components/ai/AIManager/tabs/DataHub/advanced/Archiving.tsx
types.ts
scripts/backup-db.sh.final
scripts/backup-db.sh.fixed
tmp-dh-quality-audit-output.txt
```

### Backend restart

`pm2 list` confirmed two `titan-backend` cluster processes online:

```text
titan-backend id 4 online uptime ~90m restart count 46
titan-backend id 5 online uptime ~90m restart count 46
```

Health check returned `200`.

### Frontend build

Command:

```bash
npm run build
```

Result:

```text
✓ built in 1m 59s
```

Build emitted pre-existing export/chunk warnings, but completed successfully.

### Tests

Command:

```bash
cd backend && npm test -- --testPathPattern="sourceAccessControl" --no-coverage
```

Result:

```text
PASS __tests__/unit/sourceAccessControl.test.js
PASS __tests__/integration/sourceAccessControlEnforcement.test.js
Tests: 16 passed, 16 total
```

### `source_access_controls` schema

Schema is unchanged; P2 only uses existing fields:

```text
id uuid primary key default uuid_generate_v4()
source_id uuid unique references data_sources(id) on delete cascade
allowed_agents text[] default '{}'
blocked_agents text[] default '{}'
allowed_data_types text[] default '{}'
blocked_data_types text[] default '{}'
require_auth boolean default false
max_requests_per_minute integer default 0
max_requests_per_day integer default 0
created_at timestamptz default now()
updated_at timestamptz default now()
updated_by uuid references users(id) on delete set null
```

Initial ACL count before deploy verification: `0`.

---

## 2. Registry Verification

API:

```http
GET /api/v1/data-hub/access-control/agents/registry
```

Result:

```text
status: 200
count: 16
has technical: true
has publisher: true
```

Sample registry values:

```text
Arbitrage Agent (arbitrage)
Fundamental Agent (fundamental)
Liquidity Agent (liquidity)
Market Intelligence Agent (market_intelligence)
Optimization Agent (optimization)
Order Management Agent (order)
Pattern Recognition Agent (pattern)
Portfolio Allocation Agent (portfolio)
...
Technical Analysis Agent (technical)
Telegram Publisher (runtime) (publisher)
```

The registry keys match enforcement identities:

```text
technical -> ai_agents.agent_key
sentiment -> ai_agents.agent_key
publisher -> runtime publisher key used by Telegram Publisher enforcement
```

---

## 3. Temporary ACL

Safe source used:

```text
source: alphavantage DEMO TEST
source_id: ed0fb136-d20f-46f6-97aa-e70d2605cfef
```

Temporary ACL created through API:

```http
POST /api/v1/data-hub/access-control/ed0fb136-d20f-46f6-97aa-e70d2605cfef
```

Payload:

```json
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

Result:

```text
status: 200
allowed_agents: ["technical"]
blocked_agents: ["publisher"]
```

---

## 4. Runtime Enforcement Evidence

### A. Direct `evaluateSourceAccess`

```text
technical -> allowed=true, reason=allowed
publisher -> allowed=false, reason=agent_blocked
sentiment -> allowed=false, reason=agent_not_in_allow_list
```

Pass.

### B. Collected Data API

Temporary collected_data row:

```text
id: 20e0d7bf-c6cb-467d-b61f-8ebd558b3c18
source_id: ed0fb136-d20f-46f6-97aa-e70d2605cfef
metadata.data_type: verify_acl
```

API evidence:

```text
GET /api/v1/data-sources/collected/{id}
  -> 200

GET /api/v1/data-sources/collected/{id}?agentKey=technical
  -> 200

GET /api/v1/data-sources/collected/{id}?agentKey=publisher
  -> 403 SOURCE_ACCESS_DENIED

GET /api/v1/data-sources/collected/{id}?agentKey=sentiment
  -> 403 SOURCE_ACCESS_DENIED
```

Pass.

### C. Automation Enqueue

Temporary automation topic:

```text
agentId: technical
publisherTargets: [temporary publisher]
dataTypes: ["verify_acl"]
includeStatuses: ["ready"]
```

Evidence:

```text
technical policy: allowed=true
publisher policy: allowed=false, reason=agent_blocked
queueBefore: 0
refreshAdded: 0
queueAfter: 0
deniedRowsInserted: false
```

Pass. Denied publisher path prevented queue insertion.

### D. Telegram Publisher

Internal service call:

```js
runPublisherPublish(publisherId, {
  message: "DH ACL P2 verify service publish",
  content_type: "deploy_verify",
  confirm_publish: true,
  source_id: sourceId,
  data_type: "verify_acl"
})
```

Result:

```text
status: 403
code: SOURCE_ACCESS_DENIED
message: Publisher access denied by source ACL
```

Internal service enforcement passes.

Public API endpoint:

```http
POST /api/v1/data-hub/telegram-publishers/{publisherId}/publish
```

Payload included:

```json
{
  "message": "DH ACL P2 verify API publish",
  "content_type": "deploy_verify",
  "confirm_publish": true,
  "source_id": "ed0fb136-d20f-46f6-97aa-e70d2605cfef",
  "data_type": "verify_acl"
}
```

Result:

```text
status: 200
success: true
dry_run: true
error: null
```

Fail for this API path. The blocked `publisher` runtime identity was not enforced here. Root cause: `publishPublisherSchema` currently accepts only:

```text
message
content_type
confirm_publish
title
content
```

So `source_id` / `data_type` are stripped before `runPublisherPublish`, causing a silent ACL bypass for the public publish endpoint.

### E. AI Agent Run

Agent rows:

```text
technical: f527c6f6-55ca-4193-a286-ccfed51261ee
sentiment: 21c3a3d4-75db-44a1-9249-fbf1c763759d
```

Allowed agent:

```http
POST /api/v1/ai-agents/f527c6f6-55ca-4193-a286-ccfed51261ee/run
```

Payload:

```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "config": {
    "source_id": "ed0fb136-d20f-46f6-97aa-e70d2605cfef"
  }
}
```

Result:

```text
status: 200
agent_key: technical
ok: true
```

Denied agent:

```http
POST /api/v1/ai-agents/21c3a3d4-75db-44a1-9249-fbf1c763759d/run
```

Result:

```text
status: 403
code: SOURCE_ACCESS_DENIED
reason: agent_not_in_allow_list
```

Pass.

---

## 5. Audit Logs

`data_hub_logs` contained required audit events for the temporary source.

Observed:

```text
source_access_config_updated
  status: success
  allowed_agents: ["technical"]
  blocked_agents: ["publisher"]

source_access_denied
  agent_key: publisher
  reason: agent_blocked
  access_action: deploy_verify_direct

source_access_denied
  agent_key: sentiment
  reason: agent_not_in_allow_list
  access_action: deploy_verify_direct

source_access_denied
  agent_key: publisher
  reason: agent_blocked
  access_action: collected_data_read

source_access_denied
  agent_key: sentiment
  reason: agent_not_in_allow_list
  access_action: collected_data_read

source_access_denied
  agent_key: publisher
  reason: agent_blocked
  access_action: publisher_publish

source_access_denied
  agent_key: sentiment
  reason: agent_not_in_allow_list
  access_action: agent_run
```

`source_access_allowed` is sampled and was not observed in this deploy-verify run.

---

## 6. Cleanup Evidence

Temporary objects removed:

```text
datahub_automation_queue rows for temp topic
datahub_automation_topics temp topic
publisher_delivery_history for temp publisher
telegram_publishers temp publisher
collected_data temp row
source_access_controls temp row
temporary users/session
```

Cleanup result:

```text
cleanupErrors: []
previousAclCount: 0
finalAclCount: 0
SELECT COUNT(*) FROM source_access_controls -> 0
```

Pass.

---

## 7. Regression Checks

Runtime API checks:

```text
GET /api/v1/data-sources?limit=5
  -> 200

GET /api/v1/data-sources/pipeline
  -> 200

GET /api/v1/data-hub/access-control
  -> 200

GET /api/v1/data-hub/automation/topics
  -> 200

GET /api/v1/data-hub/telegram-publishers
  -> 200
```

Admin source and ACL listing remain visible. Access policies restrict runtime/agent consumption only when an agent/runtime context is present.

---

## Final Verdict

**PARTIAL**

Passing paths:

```text
direct evaluateSourceAccess
collected data API with agentKey/header context
automation enqueue
internal Telegram Publisher service
AI agent run with config.source_id
admin/source/ACL listing
registry modal source data
audit deny/config logs
cleanup
```

Blocking issue:

```text
POST /api/v1/data-hub/telegram-publishers/:id/publish
```

The public Publisher endpoint returned `200 dry_run` even when `publisher` was blocked for the source. This is an ACL bypass because `source_id` and `data_type` are not part of `publishPublisherSchema`, so the service receives no source context and cannot enforce the ACL.

Per verification criteria: **PARTIAL** because a runtime publishing path bypasses ACL. It is not **REAL ENFORCED** until the Publisher API schema/route passes `source_id` into `runPublisherPublish` and returns `403 SOURCE_ACCESS_DENIED` for blocked publisher access.
