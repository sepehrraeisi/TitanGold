# DH-AUTOMATION-ROUTING-P2-SAFETY-FIX

Date: 2026-06-20

Mode: IMPLEMENTATION + VERIFY

RCA: `docs/ssot_v3/DH-AUTOMATION-ROUTING-P1-FULL-RCA.md`

## Verdict

Before: **BROKEN / UNSAFE**

After: **REAL WORKING**

Automation Routing now has enforced dry-run semantics, active publisher validation, source-to-publisher mapping enforcement before queue insert, blocked/skipped audit history, atomic queue claiming, retry safety, UI/i18n clarity, and runtime dry-run verification.

## Changes

Backend:

- Added `backend/database/migrations/042_datahub_automation_safety.sql`.
- Added queue retry metadata: `retry_count`, `max_retry_count`, `last_error_code`.
- Expanded automation execution statuses to include `blocked` and `skipped`.
- Made Automation `dry_run` default to true for queue dispatch, single dispatch, test-run, and retry.
- Added `confirm_live`; live Automation publish now requires `dry_run:false` plus `confirm_live:true`.
- Passed Automation `dryRun` into `runPublisherPublish`.
- Added publisher target validation on topic create/update.
- Queue refresh now skips missing/disabled publishers before enqueue.
- Queue refresh now enforces enabled `source_id -> publisher_id` mapping before enqueue.
- Queue refresh records audit executions for `SOURCE_ACCESS_DENIED`, `FILTER_RULE_BLOCKED`, `PUBLISHER_MAPPING_REQUIRED`, and `PUBLISHER_DISABLED`.
- Queue dispatch now claims rows atomically with `FOR UPDATE SKIP LOCKED`.
- Single-item dispatch now atomically moves `pending -> processing`.
- Retry defaults to dry-run and enforces max retry policy.

Frontend/UI:

- Dry-run toggle now defaults on.
- Live dispatch requires browser confirmation.
- Retry action is labeled `Retry dry-run` and calls retry with dry-run.
- Queue rows show publisher state, mode, retry/error code, and clearer publish action labels.
- Topic publisher selector shows disabled publishers as disabled.
- Schedule panel now states it is manual/config-only because no automation worker is wired.
- Added missing EN/FA i18n keys to both green and blue deploy locales.

## Dry-Run Contract

Automation dry-run is now authoritative:

```text
Automation route dry_run:true
  -> datahubAutomationService effectiveDryRun=true
  -> runPublisherPublish payload includes dry_run:true
  -> Telegram Publisher records dry_run and does not call Telegram send
```

Live publish is blocked unless explicitly confirmed:

```text
dry_run:false + confirm_live:false
  -> 400 LIVE_CONFIRMATION_REQUIRED

dry_run:false + confirm_live:true
  -> live path allowed, still gated by publisher active + mapping + ACL + filters
```

Runtime guard result:

```text
POST /api/v1/data-hub/automation/queue/dispatch
body: {"limit":1,"dry_run":false}

HTTP 400
{"error":"Live automation publish requires confirm_live=true","code":"LIVE_CONFIRMATION_REQUIRED"}
```

## Mapping Enforcement

Before enqueue, Automation now requires:

```text
datahub_publisher_source_mappings.source_id = candidate source
datahub_publisher_source_mappings.publisher_id = topic publisher
is_enabled = true
```

If no enabled mapping exists:

- The candidate is not enqueued.
- An Automation execution audit row is written.
- Status is `skipped`.
- Metadata includes `error_code: PUBLISHER_MAPPING_REQUIRED`.

Mapping does not replace ACL/filter checks. The required publish chain is:

```text
publisher active + mapping allowed + ACL allowed + filter allowed + dry-run/live confirmation
```

## Queue Locking Design

Batch dispatch now claims rows with one atomic statement:

```sql
WITH picked AS (
  SELECT id
  FROM datahub_automation_queue
  WHERE status = 'pending'
    AND retry_count < max_retry_count
  ORDER BY priority DESC, created_at ASC
  LIMIT $1
  FOR UPDATE SKIP LOCKED
)
UPDATE datahub_automation_queue q
SET status = 'processing',
    retry_count = retry_count + 1,
    updated_at = NOW()
FROM picked
WHERE q.id = picked.id
RETURNING q.*;
```

Single-item dispatch uses an atomic `UPDATE ... WHERE id=$1 AND status='pending' ... RETURNING *`.

Concurrent dispatch verification passed: two simultaneous dispatch requests for the same queue item produced one execution row.

## Tests

Command:

```bash
cd backend
npm test -- --runInBand __tests__/unit/datahubAutomationAccessGateway.test.js __tests__/unit/datahubAutomationFilterRules.test.js __tests__/unit/datahubAutomationSafety.test.js
```

Result:

```text
PASS __tests__/unit/datahubAutomationSafety.test.js
PASS __tests__/unit/datahubAutomationFilterRules.test.js
PASS __tests__/unit/datahubAutomationAccessGateway.test.js

Test Suites: 3 passed, 3 total
Tests: 7 passed, 7 total
```

Covered:

- Disabled publisher cannot enqueue.
- Missing mapping cannot enqueue.
- Dry-run dispatch passes `dry_run:true` to publisher service.
- Dispatch claims rows with `FOR UPDATE SKIP LOCKED`.
- Retry defaults to dry-run.
- ACL blocked cannot enqueue.
- Filter blocked cannot enqueue.

Additional verification:

- Backend syntax checks passed.
- Locale JSON parse passed.
- Automation locale coverage passed for green/blue EN/FA.
- Frontend build passed.

## Runtime Verification

Temporary data used:

- Temporary `data_sources` row.
- Temporary `telegram_publishers` row with no bot token.
- Temporary `datahub_publisher_source_mappings` row.
- Temporary Automation topic through API.
- Temporary processed `collected_data` records.
- Temporary ACL deny row.
- Temporary publishing blacklist rule.

No real Telegram message was sent. All dispatch verification used dry-run.

Results:

```text
PASS A enqueue allowed mapped candidate - added=1
PASS A dry-run dispatch success - status=dry_run
PASS B ACL blocked no enqueue - SOURCE_ACCESS_DENIED
PASS C filter blocked no enqueue - FILTER_RULE_BLOCKED
PASS D mapping disabled no enqueue - PUBLISHER_MAPPING_REQUIRED
PASS E disabled publisher no enqueue - PUBLISHER_DISABLED
PASS F refresh twice no duplicate - count=1
PASS G concurrent dispatch processed once - executions=1
PASS H history shows dry_run and blocked/skipped reasons - statuses=dry_run,skipped,blocked codes=PUBLISHER_DISABLED,PUBLISHER_MAPPING_REQUIRED,FILTER_RULE_BLOCKED,SOURCE_ACCESS_DENIED
```

Cleanup evidence:

```text
CLEANUP {"sources":0,"publishers":0,"records":0,"rules":0}
```

## Performance Regression

Measured after backend restart:

| Endpoint | Status | Latency | Size |
|---|---:|---:|---:|
| `/api/v1/data-hub/automation/overview` | 200 | 0.034356s | 32869B |
| `/api/v1/data-hub/automation/topics` | 200 | 0.012939s | 1919B |
| `/api/v1/data-hub/automation/queue` | 200 | 0.008983s | 3992B |
| `/api/v1/data-hub/automation/executions?limit=20` | 200 | 0.009869s | 10012B |

All required GET endpoints are below 500ms.

## Remaining P3 Backlog

- Wire a real Automation scheduler worker with advisory lock, or keep schedule permanently labeled manual/config-only.
- Add a dedicated blocked/skipped UI filter and pagination for Automation history.
- Add source mapping status directly to topic cards after the UI has source-specific topic filters.
- Add retention policy for old sent/failed/skipped execution rows.
- Add broader integration tests around actual route HTTP handlers.

## Commit

Commit hash: `978ac1f feat(datahub): harden automation routing safety and dispatch flow`

Final verdict: **REAL WORKING**.

