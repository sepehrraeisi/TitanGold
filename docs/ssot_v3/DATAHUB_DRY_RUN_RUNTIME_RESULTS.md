# DataHub Dry-Run Runtime Results

> **Status:** D-01 **Pass**; D-02 **Pass** (DH-P0-SECURITY-10); D-03 **Fail** (DH-P0-SECURITY-11)  
> **Date:** 2026-05-31 (D-02, D-03); 2026-05-30 (D-01)  
> **Plan:** [`DATAHUB_DRY_RUN_TEST_PLAN.md`](./DATAHUB_DRY_RUN_TEST_PLAN.md) (DH-FINAL-5)  
> **Branch:** `feat/gap-008-sources-backend-wiring`  
> **Account:** `admin@titangold.com` (admin) — curl-auth JWT

---

## Executive summary

| Test ID | Result | Notes |
|---------|--------|-------|
| **D-01** Crawler dry-run | **Pass** | `dry_run: true`; `collected_data` count unchanged |
| **D-02** Publisher test | **Pass** | DH-P0-SECURITY-10; forced dry-run under `TELEGRAM_PUBLISHER_DRY_RUN=true` |
| **D-03** Automation test-run | **Fail** | HTTP 500 — stale queue `record_id`s missing from `collected_data`; publisher path not reached |

**No live Telegram send** from D-02 probe or D-03 attempt (`telegram_message_id: null` where applicable; no Bot API send in logs).

---

## Pre-run gate

| Check | Result |
|-------|--------|
| `GET /health` | **200** — healthy, DB connected |
| Payload `{ "dry_run": true }` | Verified in request |
| Live Run clicked | No — curl-auth only |

---

## D-01 — Crawler dry-run

| Field | Value |
|-------|-------|
| **Timestamp (UTC)** | `2026-05-30T19:49:57.416Z` |
| **Method** | curl-auth |
| **Crawler ID** | `b1f6ab9b-e5bf-442e-9b72-3a006c075162` |
| **Source ID** | `b1ec7306-fc00-4d3c-8857-0a3000aa422a` |
| **Crawler name** | eghtesaad24 دلار و ارز |
| **Target type** | `rss` |
| **Start URL** | `https://eghtesaad24.ir/fa/rss/12` |
| **Endpoint** | `POST /api/v1/data-hub/crawlers/b1f6ab9b-e5bf-442e-9b72-3a006c075162/run` |
| **Request body** | `{ "dry_run": true }` |
| **HTTP status** | **200** |
| **Pass/Fail** | **Pass** |

### Response dry-run proof

| Field | Value |
|-------|-------|
| `run.dry_run` | `true` |
| `run.metadata.dry_run` | `true` |
| `run.status` | `success` |
| `run.id` | `9de96fb8-24c2-4dce-81d0-aa98472a3ac9` |
| `stats.pages_fetched` | 23 |
| `stats.items_ingested` | 23 (simulated passes — no DB rows) |
| `stats.items_blocked` | 0 |

### `collected_data` count gate

| Metric | Value |
|--------|-------|
| **Before** | `178` |
| **After** | `178` |
| **Delta** | `0` ✅ |

```sql
-- Query used (before and after)
SELECT COUNT(*) FROM collected_data WHERE source_id = 'b1ec7306-fc00-4d3c-8857-0a3000aa422a';
```

### Side effects (accepted)

| Side effect | Occurred? | Acceptable? |
|-------------|-----------|---------------|
| `datahub_crawler_runs` row (`dry_run=true`) | Yes — run `9de96fb8-…` | Yes |
| `datahub_crawlers` / `data_sources` timestamp update | Yes | Yes |
| External RSS HTTP fetch | Yes (23 pages) | Yes |
| `collected_data` INSERT | **No** | Required — verified |

### Stop conditions

| Condition | Triggered? |
|-----------|------------|
| Payload `dry_run` not true | No |
| Response `dry_run` false | No |
| `collected_data` count increased | No |
| Live Run clicked | No |
| Backend 500 | No |

---

## DH-FINAL-5G — Publisher dry-run gate audit (read-only)

Audit date: **2026-05-30**. No env changes, no restart, **no D-02/D-03 execution**, **no Telegram send**.

| Check | Result |
|-------|--------|
| PM2 `titan-backend` (`:5002`) | `NODE_ENV=production`, `TELEGRAM_PUBLISHER_DRY_RUN=null` (unset) |
| `isPublisherDryRunForced()` | **false** — unset env + production → not forced |
| Active publisher `5ab9a6bc-…` | `is_active=true`, `has_bot_token=true`, `has_chat_id=true` |
| `/test` code path | `dryRun = forced \|\| !token` → **false** → may call `sendTelegramBotMessage()` |
| D-03 code path | `runAutomationTest` → `runPublisherPublish(confirm_publish:true)` — same gate |

### D-02 / D-03 decision

| Test ID | Decision | Reason |
|---------|----------|--------|
| **D-02** | **NO-GO** | Production runtime without `TELEGRAM_PUBLISHER_DRY_RUN=true`; active publisher has bot token + chat_id → `POST /telegram-publishers/:id/test` can send a **live** Telegram message |
| **D-03** | **NO-GO** | Automation test-run invokes publisher publish chain; automation `{ dry_run: true }` does **not** bypass publisher env gate — live send equally possible |

**Execution status:** D-02 and D-03 were **not run**. No `publisher_delivery_history` test rows, no `telegram_message_id`, no channel traffic from this verification batch.

### Unblock criteria (future — requires separate approval + likely restart)

- Set `TELEGRAM_PUBLISHER_DRY_RUN=true` on PM2 env and restart, **or**
- Use publisher without bot token for probe, **or**
- Run on non-production runtime (`NODE_ENV !== 'production'`)

**Update:** Env gate applied DH-P0-SECURITY-9 (`e4f2b79`); D-02 executed DH-P0-SECURITY-10 — see below.

---

## D-02 — Publisher test dry-run (DH-P0-SECURITY-10)

**Prerequisites:** `TELEGRAM_PUBLISHER_DRY_RUN=true` on both `titan-backend` workers (SECURITY-9). **D-03 not executed.**

### Pre-run gate

| Check | Result |
|-------|--------|
| `GET /health` (`:5002`) | **200** |
| PM2 `TELEGRAM_PUBLISHER_DRY_RUN` | **`true`** (both instances) |
| PM2 `NODE_ENV` | `production` |

### Publisher selected (read-only)

| Field | Value |
|-------|-------|
| **Publisher ID** | `5ab9a6bc-5f17-4aae-bb06-4a34e827af24` |
| **Name** | تایتان تست |
| **is_active** | true |
| **has_bot_token** | true |
| **channel_id** | set (not null) |

### History count

| Metric | Value |
|--------|-------|
| **Before** | `5` |
| **After** | `6` |
| **Delta** | `+1` (dry-run history row — acceptable) |

### Request

| Field | Value |
|-------|-------|
| **Timestamp (UTC)** | `2026-05-31T13:51:47.981Z` |
| **Method** | curl-auth (JWT, `admin@titangold.com` user id) |
| **Endpoint** | `POST /api/v1/data-hub/telegram-publishers/5ab9a6bc-5f17-4aae-bb06-4a34e827af24/test` |
| **Body** | `{ "message": "DH-P0-SECURITY-10 D-02 dry-run probe" }` |

### Response

| Field | Value | Pass? |
|-------|-------|-------|
| **HTTP status** | **200** | ✅ |
| **success** | `true` | ✅ |
| **dry_run** | `true` | ✅ |
| **status** | `dry_run` | ✅ |
| **telegram_message_id** | `null` | ✅ |
| **error** | `null` | ✅ |
| **history_id** | `e3844022-dcef-433b-ac8c-2505edc07674` | ✅ |

### Latest `publisher_delivery_history` (probe row)

| Field | Value |
|-------|-------|
| **id** | `e3844022-dcef-433b-ac8c-2505edc07674` |
| **status** | `dry_run` |
| **telegram_message_id** | `null` |
| **metadata.mode** | `test` |

Note: Table has no `dry_run` column; dry-run is indicated by `status = 'dry_run'`. Older rows on same publisher show prior `test`/`sent` with message ids (pre–env-gate runs).

### Log safety

| Check | Result |
|-------|--------|
| `POST …/test` completed 200 | Yes |
| `sendTelegramBotMessage` / Bot API send in logs | **Not observed** |
| Automation/dispatch endpoints | **Not called** |

### D-02 verdict

| Result | **Pass** |
|--------|----------|

---

## D-03 — Automation test-run dry-run (DH-P0-SECURITY-11)

**Prerequisites:** `TELEGRAM_PUBLISHER_DRY_RUN=true` (SECURITY-9); D-02 **Pass** (SECURITY-10).

### Pre-run gate

| Check | Result |
|-------|--------|
| `GET /health` (`:5002`) | **200** |
| PM2 `TELEGRAM_PUBLISHER_DRY_RUN` | **`true`** (both instances) |
| PM2 `NODE_ENV` | `production` |

### Contract (read-only)

| Check | Result |
|-------|--------|
| Route | `POST /api/v1/data-hub/automation/test-run` (`backend/routes/data-hub-automation.js`) |
| Payload | `{ "dry_run": true }` optional default true; `topic_id` optional UUID |
| Flow | `runAutomationTest()` → `refreshAutomationQueue()` → `queue[0]` → `dispatchQueueItem(..., { dryRun })` → `runPublisherPublish(confirm_publish: true)` |
| `topic_id` scope | Validates topic exists; **does not** filter which queue item is dispatched — always **`queue[0]`** globally |
| Execution/history | On success: queue status update + `datahub_automation_executions` + optional `publisher_delivery_history` |

### Topic selected (read-only)

| Field | Value |
|-------|-------|
| **Topic ID** | `bc6c5f1b-4df1-4e11-a324-3f94efc55e0e` |
| **Name** | سیگنال |
| **is_active** | true |
| **publisherIds** | `["5ab9a6bc-5f17-4aae-bb06-4a34e827af24"]` (same D-02 publisher) |

**Note:** Three pending queue items existed for **Demo Topic** (`7ffb5473-…`) targeting publisher `bc5ce007-…`; all three `record_id`s absent from `collected_data`. No pending items for سیگنال topic.

### Counts before / after

| Table | Before | After | Delta |
|-------|--------|-------|-------|
| `datahub_automation_executions` | **10** | **10** | **0** |
| `publisher_delivery_history` | **14** | **14** | **0** |

### Request

| Field | Value |
|-------|-------|
| **Timestamp (UTC)** | `2026-05-31T14:25:26.168Z` |
| **Method** | curl-auth (JWT, `admin@titangold.com`) |
| **Endpoint** | `POST /api/v1/data-hub/automation/test-run` |
| **Body** | `{ "dry_run": true, "topic_id": "bc6c5f1b-4df1-4e11-a324-3f94efc55e0e" }` |

### Response

| Field | Value | Pass? |
|-------|-------|-------|
| **HTTP status** | **500** | ❌ |
| **error** | `Source record not found` | ❌ |
| **dry_run** | *(not returned)* | ❌ |
| **telegram_message_id** | *(not returned)* | N/A — publisher not invoked |
| **execution id** | *(none)* | ❌ |

**Root cause:** `runAutomationTest` dispatches global `queue[0]` (`0db4cf7c-…`, Demo Topic) after refresh. `loadRecordPayload()` could not resolve `record_id` `a75e9591-…` in `collected_data` → thrown before publisher/dispatch dry-run path.

### Log safety

| Check | Result |
|-------|--------|
| `POST …/automation/test-run` | **500** at 14:25:26 UTC |
| `sendTelegramBotMessage` / Bot API send | **Not observed** |
| Live dispatch endpoint | **Not called** |
| Automation test-run route only | Yes — refresh + queue lookup + record load failed |

### D-03 verdict

| Result | **Fail** |
|--------|----------|
| **Telegram safety** | **No live send** (publisher path never reached) |
| **Dry-run proof** | **Not demonstrated** — HTTP 500 before `dispatchQueueItem` completes |
| **GAP-036** | **Not closed** — D-03 pass criterion unmet |

**Unblock (separate approval):** Clear or fail stale pending queue rows with orphaned `record_id`s, **or** code fix to scope test-run to selected topic / skip invalid queue heads, **or** ensure refresh enqueues a valid item for D-02 publisher ahead of stale rows — then re-run D-03 once.

---

## Next recommended phase

1. Remediate stale automation queue / test-run topic scoping (ops or code — **not** in SECURITY-11 scope).
2. Re-run **D-03** once after valid queue head exists for D-02 publisher chain.
3. Close **GAP-036** only after D-03 **Pass**.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | D-01 executed — Pass; D-02/D-03 skipped |
| 2026-05-30 | DH-FINAL-5G gate audit — D-02/D-03 **NO-GO**; no Telegram send |
| 2026-05-31 | DH-P0-SECURITY-10 — D-02 **Pass** under `TELEGRAM_PUBLISHER_DRY_RUN=true`; D-03 pending |
| 2026-05-31 | DH-P0-SECURITY-11 — D-03 **Fail** (HTTP 500, stale queue); no Telegram send; GAP-036 remains Open |
