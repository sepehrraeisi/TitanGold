# DH-ACCESSCONTROL-P2-PUBLISHER-API-FIX

**Date:** 2026-06-17  
**Goal:** Close public Telegram Publisher ACL bypass found in `DH-ACCESSCONTROL-P2-DEPLOY-VERIFY`  
**Final verdict:** **REAL ENFORCED**

---

## Problem

`POST /api/v1/data-hub/telegram-publishers/:id/publish` returned `200 dry_run` even when:

```json
{
  "allowed_agents": ["technical"],
  "blocked_agents": ["publisher"]
}
```

Root cause: `publishPublisherSchema` stripped `source_id` and `data_type`, so `runPublisherPublish` received no source context and skipped ACL evaluation.

---

## Code Changes

### Schema

`backend/schemas/telegramPublisherSchemas.js`

```js
export const publishPublisherSchema = z.object({
  message: z.string().min(1).max(4096),
  content_type: z.string().max(100).optional().default('manual'),
  confirm_publish: z.boolean(),
  source_id: z.string().uuid(),
  data_type: z.string().max(100).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
});
```

`source_id` is now required for public publisher API requests.

### Public Telegram Publisher Route

`backend/routes/telegram-publishers.js`

The route now forwards source context explicitly into `runPublisherPublish`:

```js
{
  source_id,
  data_type,
  message,
  content_type,
  confirm_publish,
  title,
  content,
}
```

Denied requests return:

```json
{
  "error": "Publisher access denied by source ACL",
  "code": "SOURCE_ACCESS_DENIED"
}
```

### Legacy Data Sources Publish Route

`backend/routes/data-sources.js`

During publish endpoint inventory, another publish-capable endpoint was found:

```http
POST /api/v1/data-sources/publish-telegram
```

It now requires `source_id` and evaluates:

```js
evaluateSourceAccess({
  sourceId,
  agentKey: "publisher",
  userId,
  action: "publisher_publish",
  dataType
})
```

This prevents a second publish bypass outside the newer Telegram Publisher route.

---

## Enforcement Points After Fix

| Publish path | ACL source context | Result |
| --- | --- | --- |
| `POST /api/v1/data-hub/telegram-publishers/:id/publish` | Required by schema | Enforced before dry-run/live publish |
| `POST /api/v1/data-sources/publish-telegram` | Required by route | Enforced before `telegramService.sendMessage/sendPhoto` |
| `datahubAutomationService.dispatchQueueItem` | Passes collected-data `source_id` | Enforced before publisher service |
| `runPublisherPublish` internal service | Enforces when `source_id` present | Unchanged behavior, still blocks before dry-run |

No DataHub source-derived publish endpoint found that can publish without source ACL evaluation.

---

## Tests

Command:

```bash
cd backend
npm test -- __tests__/integration/sourceAccessControlEnforcement.test.js --runInBand --no-coverage --silent --forceExit
```

Result:

```text
PASS __tests__/integration/sourceAccessControlEnforcement.test.js
Tests: 13 passed, 13 total
```

Covered cases:

```text
publisher API blocked publisher -> 403 SOURCE_ACCESS_DENIED
publisher API allowed publisher -> 200 dry_run
publisher API missing source_id -> 400 VALIDATION_ERROR
legacy publish-telegram blocked publisher -> 403 SOURCE_ACCESS_DENIED
legacy publish-telegram missing source_id -> 400 BAD_REQUEST
internal runPublisherPublish blocked publisher -> 403 SOURCE_ACCESS_DENIED
collected-data APIs unchanged
admin source/access-control listing unchanged
registry endpoint unchanged
```

Note: `--forceExit` was used because this test suite leaves an existing Redis/Jest open handle after assertions complete. The assertions completed and Jest reported `13/13` passed.

Build:

```bash
npm run build
```

Result:

```text
✓ built in 18.57s
```

Build warnings were pre-existing Vite/export/chunk warnings.

Lint:

```text
No linter errors found
```

---

## Runtime Evidence

Backend restarted after code change:

```text
titan-backend id 4 online restart count 48
titan-backend id 5 online restart count 48
```

Temporary source:

```text
alphavantage DEMO TEST
ed0fb136-d20f-46f6-97aa-e70d2605cfef
```

Temporary ACL:

```json
{
  "allowed_agents": ["technical"],
  "blocked_agents": ["publisher"]
}
```

### Public Publisher API

Blocked:

```http
POST /api/v1/data-hub/telegram-publishers/:id/publish
```

```text
status: 403
code: SOURCE_ACCESS_DENIED
```

Allowed after ACL changed to `allowed_agents=["publisher"]`:

```text
status: 200
dry_run: true
```

Missing `source_id`:

```text
status: 400
code: VALIDATION_ERROR
field: source_id
message: Required
```

### Internal Service

Blocked:

```text
runPublisherPublish(...) -> 403 SOURCE_ACCESS_DENIED
```

### Legacy Data Sources Publish Endpoint

Blocked:

```http
POST /api/v1/data-sources/publish-telegram
```

```text
status: 403
code: SOURCE_ACCESS_DENIED
```

Missing `source_id`:

```text
status: 400
code: BAD_REQUEST
```

### Audit Log

Observed:

```text
action: source_access_denied
status: failure
metadata.agent_key: publisher
metadata.reason: agent_blocked
metadata.access_action: publisher_publish
metadata.data_type: verify_acl
```

### Cleanup

Temporary ACL/user/session/publisher/history rows were removed.

```sql
SELECT COUNT(*) AS acl_count_after_publisher_api_fix
FROM source_access_controls;
```

Result:

```text
0
```

---

## Final Verdict

**REAL ENFORCED**

The public Telegram Publisher endpoint no longer bypasses ACL in dry-run mode. The legacy Data Sources publish endpoint is also now protected. Publisher runtime identity is consistently enforced as:

```text
agentKey = "publisher"
action = "publisher_publish"
```

If `publisher` is blocked for a source, publish is denied before dry-run or live execution.
# DH-ACCESSCONTROL-P2-PUBLISHER-API-FIX

**Date:** 2026-06-17  
**Goal:** Close public Telegram Publisher ACL bypass found in `DH-ACCESSCONTROL-P2-DEPLOY-VERIFY`  
**Final verdict:** **REAL ENFORCED**

---

## Problem

`POST /api/v1/data-hub/telegram-publishers/:id/publish` returned `200 dry_run` even when:

```json
{
  "allowed_agents": ["technical"],
  "blocked_agents": ["publisher"]
}
```

Root cause: `publishPublisherSchema` stripped `source_id` and `data_type`, so `runPublisherPublish` received no source context and skipped ACL evaluation.

---

## Code Changes

### Schema

`backend/schemas/telegramPublisherSchemas.js`

```js
export const publishPublisherSchema = z.object({
  message: z.string().min(1).max(4096),
  content_type: z.string().max(100).optional().default('manual'),
  confirm_publish: z.boolean(),
  source_id: z.string().uuid(),
  data_type: z.string().max(100).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
});
```

`source_id` is now required for public publisher API requests.

### Public Telegram Publisher Route

`backend/routes/telegram-publishers.js`

The route now forwards source context explicitly into `runPublisherPublish`:

```js
{
  source_id,
  data_type,
  message,
  content_type,
  confirm_publish,
  title,
  content,
}
```

Denied requests return:

```json
{
  "error": "Publisher access denied by source ACL",
  "code": "SOURCE_ACCESS_DENIED"
}
```

### Legacy Data Sources Publish Route

`backend/routes/data-sources.js`

During publish endpoint inventory, another publish-capable endpoint was found:

```http
POST /api/v1/data-sources/publish-telegram
```

It now requires `source_id` and evaluates:

```js
evaluateSourceAccess({
  sourceId,
  agentKey: "publisher",
  userId,
  action: "publisher_publish",
  dataType
})
```

This prevents a second publish bypass outside the newer Telegram Publisher route.

---

## Enforcement Points After Fix

| Publish path | ACL source context | Result |
| --- | --- | --- |
| `POST /api/v1/data-hub/telegram-publishers/:id/publish` | Required by schema | Enforced before dry-run/live publish |
| `POST /api/v1/data-sources/publish-telegram` | Required by route | Enforced before `telegramService.sendMessage/sendPhoto` |
| `datahubAutomationService.dispatchQueueItem` | Passes collected-data `source_id` | Enforced before publisher service |
| `runPublisherPublish` internal service | Enforces when `source_id` present | Unchanged behavior, still blocks before dry-run |

No DataHub source-derived publish endpoint found that can publish without source ACL evaluation.

---

## Tests

Command:

```bash
cd backend
npm test -- __tests__/integration/sourceAccessControlEnforcement.test.js --runInBand --no-coverage --silent --forceExit
```

Result:

```text
PASS __tests__/integration/sourceAccessControlEnforcement.test.js
Tests: 13 passed, 13 total
```

Covered cases:

```text
publisher API blocked publisher -> 403 SOURCE_ACCESS_DENIED
publisher API allowed publisher -> 200 dry_run
publisher API missing source_id -> 400 VALIDATION_ERROR
legacy publish-telegram blocked publisher -> 403 SOURCE_ACCESS_DENIED
legacy publish-telegram missing source_id -> 400 BAD_REQUEST
internal runPublisherPublish blocked publisher -> 403 SOURCE_ACCESS_DENIED
collected-data APIs unchanged
admin source/access-control listing unchanged
registry endpoint unchanged
```

Note: `--forceExit` was used because this test suite leaves an existing Redis/Jest open handle after assertions complete. The assertions completed and Jest reported `13/13` passed.

Build:

```bash
npm run build
```

Result:

```text
✓ built in 18.57s
```

Build warnings were pre-existing Vite/export/chunk warnings.

Lint:

```text
No linter errors found
```

---

## Runtime Evidence

Backend restarted after code change:

```text
titan-backend id 4 online restart count 48
titan-backend id 5 online restart count 48
```

Temporary source:

```text
alphavantage DEMO TEST
ed0fb136-d20f-46f6-97aa-e70d2605cfef
```

Temporary ACL:

```json
{
  "allowed_agents": ["technical"],
  "blocked_agents": ["publisher"]
}
```

### Public Publisher API

Blocked:

```http
POST /api/v1/data-hub/telegram-publishers/:id/publish
```

```text
status: 403
code: SOURCE_ACCESS_DENIED
```

Allowed after ACL changed to `allowed_agents=["publisher"]`:

```text
status: 200
dry_run: true
```

Missing `source_id`:

```text
status: 400
code: VALIDATION_ERROR
field: source_id
message: Required
```

### Internal Service

Blocked:

```text
runPublisherPublish(...) -> 403 SOURCE_ACCESS_DENIED
```

### Legacy Data Sources Publish Endpoint

Blocked:

```http
POST /api/v1/data-sources/publish-telegram
```

```text
status: 403
code: SOURCE_ACCESS_DENIED
```

Missing `source_id`:

```text
status: 400
code: BAD_REQUEST
```

### Audit Log

Observed:

```text
action: source_access_denied
status: failure
metadata.agent_key: publisher
metadata.reason: agent_blocked
metadata.access_action: publisher_publish
metadata.data_type: verify_acl
```

### Cleanup

Temporary ACL/user/session/publisher/history rows were removed.

```sql
SELECT COUNT(*) AS acl_count_after_publisher_api_fix
FROM source_access_controls;
```

Result:

```text
0
```

---

## Final Verdict

**REAL ENFORCED**

The public Telegram Publisher endpoint no longer bypasses ACL in dry-run mode. The legacy Data Sources publish endpoint is also now protected. Publisher runtime identity is consistently enforced as:

```text
agentKey = "publisher"
action = "publisher_publish"
```

If `publisher` is blocked for a source, publish is denied before dry-run or live execution.
