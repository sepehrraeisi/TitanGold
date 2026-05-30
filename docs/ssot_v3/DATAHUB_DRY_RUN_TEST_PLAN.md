# DataHub Dry-Run Test Plan (DH-FINAL-5)

> **Status:** D-01 executed (Pass); D-02/D-03 **NO-GO** on production runtime (DH-FINAL-5G)  
> **Date:** 2026-05-30  
> **Prerequisite:** [`DATAHUB_LOW_RISK_RUNTIME_RESULTS.md`](./DATAHUB_LOW_RISK_RUNTIME_RESULTS.md) (DH-FINAL-4 — 37/37 pass)  
> **Next phase:** DH-FINAL-5R executes this plan after explicit go/no-go sign-off per test.

---

## Goal

Before executing D-01, D-02, or D-03, prove each action is **actually dry-run** (no live ingest, no live Telegram send, no live dispatch). This document defines safety gates, proof methods, acceptable side effects, and go/no-go criteria.

---

## Test account & environment

| Requirement | Detail |
|-------------|--------|
| **Role** | `admin` or `trader` (all three endpoints require `authorize('admin','trader')`) |
| **Session** | Valid `titan_token`; UI or curl-auth |
| **Backend gate** | `GET /health` → 200 (same as DH-FINAL-4) |
| **Known test entities (DH-FINAL-4)** | Crawler `b1f6ab9b-…` (RSS); Publisher `5ab9a6bc-…` (`has_bot_token: true`) |

---

## Safety matrix (global)

| Check | D-01 | D-02 | D-03 |
|-------|------|------|------|
| Payload must include dry-run flag | `{ dry_run: true }` **required** (schema default is `false`) | N/A — server decides via env/token | `{ dry_run: true }` **required** (schema default is `true`, still verify) |
| Env gate before run | Optional | **Mandatory** — see D-02 section | **Mandatory** — publisher chain uses same env |
| Network tab / curl body inspection | Mandatory before UI click | Mandatory | Mandatory |
| Before/after DB count | `collected_data` for crawler `source_id` | `publisher_delivery_history` count | `datahub_automation_queue` + `datahub_automation_executions` |
| Live action forbidden | Run (live) button | Publish button | Dispatch / Refresh queue / Retry execution |
| Global stop | `dry_run: false` in request; `collected_data` count increases; live Run clicked | Response `dry_run: false` **and** `telegram_message_id` non-null | Response execution `dry_run: false` **and** `telegram_message_id` non-null in nested publish |

---

## Allowed endpoints (this phase only)

| Test ID | Method | Path | Body |
|---------|--------|------|------|
| D-01 | POST | `/api/v1/data-hub/crawlers/:id/run` | `{ "dry_run": true }` |
| D-02 | POST | `/api/v1/data-hub/telegram-publishers/:id/test` | `{ "message": "DH-FINAL-5 dry-run probe" }` (optional) |
| D-03 | POST | `/api/v1/data-hub/automation/test-run` | `{ "dry_run": true, "topic_id": "<uuid>" }` (topic_id optional) |

**Supporting reads only (no writes):**

| Purpose | Method | Path |
|---------|--------|------|
| Pre/post crawler run history | GET | `/api/v1/data-hub/crawlers/:id/runs?limit=5` |
| Pre/post publisher history | GET | `/api/v1/data-hub/telegram-publishers/:id/history?limit=5` |
| Pre/post automation overview | GET | `/api/v1/data-hub/automation/overview` |
| Pre/post collected_data count | SQL read | `SELECT COUNT(*) FROM collected_data WHERE source_id = $1` |

---

## Forbidden buttons / actions (absolute)

| UI location | Forbidden |
|-------------|-----------|
| Crawlers | **Run** (live), Create, Edit Save, Delete |
| Telegram Publisher | **Publish**, Create, Disable |
| Automation | **Dispatch**, **Refresh queue**, Create/Edit/Delete topic, Retry execution, Schedule toggle |
| All Advanced | Discovery Scan/Approve, Prioritization Preview/Apply, Archiving execute/restore |
| Telegram Collector | All POST/PATCH (login, sync, force sync, etc.) |

---

## Test matrix

| Test ID | Action | Endpoint | Payload must include | Precondition | How to prove dry-run | Possible side effects | Stop condition |
|---------|--------|----------|----------------------|--------------|----------------------|----------------------|----------------|
| **D-01** | Crawler dry-run | `POST /api/v1/data-hub/crawlers/:id/run` | `{ "dry_run": true }` — **never omit** (Zod default is `false`) | DH-FINAL-4 green; pick **one** enabled crawler (prefer RSS `b1f6ab9b-…`); admin/trader JWT; no concurrent `running` crawl | **(1)** Network/curl body shows `"dry_run": true`. **(2)** Response `run.dry_run === true` and `run.metadata.dry_run === true`. **(3)** `SELECT COUNT(*) FROM collected_data WHERE source_id = :source_id` **unchanged** before vs after (±0). **(4)** New row in `datahub_crawler_runs` with `dry_run=true` | **Acceptable:** HTTP fetch to RSS/website (read-only external); `datahub_crawler_runs` insert; `datahub_crawlers`/`data_sources` timestamp updates (`last_run_at`, `last_fetch_at`). **Not acceptable:** any `collected_data` INSERT | Payload missing `dry_run: true`; response `run.dry_run === false`; `collected_data` count increased; **Run (live)** clicked; 403 `FILTER_BLOCKED_PRE_CRAWL` → record and stop D-01 (do not retry live) |
| **D-02** | Publisher test | `POST /api/v1/data-hub/telegram-publishers/:id/test` | `{ "message": "..." }` only — dry-run is **server-side** | Verify env gate **before** test (see below); publisher active; prefer channel used in DH-FINAL-4 (`5ab9a6bc-…`). **Current production runtime: NO-GO unless `TELEGRAM_PUBLISHER_DRY_RUN=true` or publisher has no bot token.** | **(1)** Response `dry_run: true` AND `status: "dry_run"` AND `telegram_message_id: null`. **(2)** History row `status = 'dry_run'` (not `test` or `sent`). **(3)** If `TELEGRAM_PUBLISHER_DRY_RUN=true` or `NODE_ENV !== 'production'` → proceed; else **NO-GO** | **Acceptable:** `publisher_delivery_history` row with `status=dry_run`, `telegram_message_id=null`. **Not acceptable:** live Telegram API call → `status=test/sent`, non-null `telegram_message_id`, channel message visible | Response `dry_run: false` with non-null `telegram_message_id`; env is production + `has_bot_token=true` + `TELEGRAM_PUBLISHER_DRY_RUN` not `true`; **Publish** clicked |
| **D-03** | Automation test-run | `POST /api/v1/data-hub/automation/test-run` | `{ "dry_run": true }` — verify in Network even though schema default is `true` | **Hard dependency on D-02 gate:** D-03 must not run until D-02 env proves forced dry-run on the **same publisher target chain**. ≥1 enabled automation topic with publisher target; admin/trader JWT. **Current production runtime: NO-GO unless `TELEGRAM_PUBLISHER_DRY_RUN=true` or publisher has no bot token.** | **(1)** Request body `dry_run: true`. **(2)** Response `publishResult.dry_run === true` OR top-level execution `dry_run === true` with `status: dry_run`. **(3)** `telegram_message_id` null in publish result. **(4)** No `sent_count` increment on publisher | **Acceptable:** `refreshAutomationQueue()` inside service may **add** queue rows; one queue item status update; `datahub_automation_executions` insert with `dry_run=true`; optional `publisher_delivery_history` dry_run row. **Not acceptable:** live Telegram send; queue dispatch without dry_run; execution with `dry_run=false` and `status=sent` | `dry_run: false` in request; nested `publishResult.dry_run === false` **and** `telegram_message_id` set; **Dispatch** or **Refresh queue** clicked manually; production env without publisher dry-run gate; **D-02 gate not passed** |

---

## Per-test safety detail

### D-01 — Crawler dry-run

**Implementation reference:** `runCrawler()` in `datahubCrawlersService.js` — when `dryRun=true`, `ingestItem()` skips `INSERT INTO collected_data` but still runs filter checks and external fetch.

**UI path:** `Advanced → Crawlers → Dry run` (`WebCrawlerConfig.tsx` → `handleRun(id, true)` → `{ dry_run: true }`).

**Pre-run counts (record in evidence):**

```sql
-- Before and after D-01
SELECT COUNT(*) AS collected_count FROM collected_data WHERE source_id = '<crawler.source_id>';
SELECT COUNT(*) AS runs_count FROM datahub_crawler_runs WHERE crawler_id = '<crawler.id>' AND dry_run = true;
```

**Expected response shape:**

```json
{
  "run": { "dry_run": true, "status": "success", "metadata": { "dry_run": true }, ... },
  "stats": { "pages_fetched": N, "items_ingested": M, "items_blocked": B }
}
```

Note: `items_ingested` in dry-run counts **simulated** passes (filter OK), not DB rows — do not confuse with `collected_data`.

**Go/no-go:** **GO** on local dev after DH-FINAL-4 pass, using single RSS crawler, explicit `{ dry_run: true }`, count gate. **NO-GO** if operator cannot verify payload or if only website crawler with `render_js` blocked.

---

### D-02 — Publisher test/dry-run

**Dry-run decision logic** (`telegramPublisherService.js` → `isPublisherDryRunForced()`):

| Condition | Result |
|-----------|--------|
| `TELEGRAM_PUBLISHER_DRY_RUN=true` | Always dry-run |
| `TELEGRAM_PUBLISHER_DRY_RUN=false` | Never forced dry-run (live possible if token present) |
| Unset + `NODE_ENV !== 'production'` | **Forced dry-run** (typical local dev) |
| Unset + `NODE_ENV=production` + `has_bot_token=true` | **Live send possible** on `/test` |

**Pre-flight env check (mandatory — run before D-02 or D-03):**

```bash
# Read-only — do not print secrets
node -e "console.log(JSON.stringify({
  NODE_ENV: process.env.NODE_ENV,
  TELEGRAM_PUBLISHER_DRY_RUN: process.env.TELEGRAM_PUBLISHER_DRY_RUN ?? '(unset)'
}))"
```

Or infer from D-02 probe on a publisher with known token: if first response has `dry_run: true`, gate passed.

**UI path:** `Advanced → Telegram Publisher → Test` on **one** channel only.

**Expected safe response:**

```json
{
  "success": true,
  "dry_run": true,
  "status": "dry_run",
  "telegram_message_id": null,
  "history_id": "<uuid>"
}
```

**Go/no-go:**

| Environment | Recommendation |
|-------------|----------------|
| Local dev (`NODE_ENV` ≠ `production`) | **GO** — forced dry-run |
| Any env with `TELEGRAM_PUBLISHER_DRY_RUN=true` | **GO** |
| Production + bot token + dry-run env unset/false | **NO-GO** — skip D-02 and D-03 |
| Publisher without bot token | **GO** — service dry-runs when no token |

**DH-FINAL-5G audit (2026-05-30):** PM2 `titan-backend` on `:5002` runs with `NODE_ENV=production`, `TELEGRAM_PUBLISHER_DRY_RUN` unset. Active publisher `5ab9a6bc-…` has `has_bot_token=true`. **Current production runtime: NO-GO** unless `TELEGRAM_PUBLISHER_DRY_RUN=true` or publisher has no bot token.

---

### D-03 — Automation test-run dry-run

> **D-03 depends on D-02:** Do not execute D-03 until D-02 env gate is **GO** and a probe confirms `dry_run: true` + `telegram_message_id: null`. Automation `{ dry_run: true }` alone does **not** prevent live Telegram send — `dispatchQueueItem` still calls `runPublisherPublish(confirm_publish: true)` and only the **publisher env gate** blocks outbound messages.

**Implementation reference:** `runAutomationTest()` calls `refreshAutomationQueue()` then `dispatchQueueItem(..., { dryRun })`. The automation `dryRun` flag marks execution as dry-run but **`runPublisherPublish()` is still invoked** with `confirm_publish: true` — live send prevention depends on **publisher env gate** (same as D-02).

**UI path:** `Advanced → Automation → Test run` (`AutomationTopics.tsx` hardcodes `{ dry_run: true }`).

**Side effects — acceptable vs not:**

| Effect | Acceptable? | Notes |
|--------|-------------|-------|
| `refreshAutomationQueue()` adds queue rows | **Yes** | Document count before/after; do not run Refresh queue button separately |
| One queue item → `sent`/`failed` status update | **Yes** | Item consumed from pending pool |
| `datahub_automation_executions` row | **Yes** | Must have `dry_run=true` |
| `publisher_delivery_history` with `status=dry_run` | **Yes** | |
| Live Telegram message | **No** | Stop immediately |
| `telegram_publishers.sent_count` increment | **No** | Indicates live publish |

**Go/no-go:** **GO** only if D-02 env gate passes **first**. **NO-GO** on production without `TELEGRAM_PUBLISHER_DRY_RUN=true`. Consider running D-03 **after** D-02 confirms `dry_run: true` on same publisher target chain.

---

## Evidence to record

For each D-01 / D-02 / D-03 (pass or fail):

| Field | Example |
|-------|---------|
| Test ID | `D-01` |
| Timestamp (UTC) | `2026-05-30T18:00:00Z` |
| Method | `UI` or `curl` |
| Request URL + body | `POST .../run` `{ "dry_run": true }` |
| HTTP status | `200` |
| Response key fields | `run.dry_run`, `dry_run`, `telegram_message_id` |
| Before/after counts | `collected_data`: 320 → 320 |
| Env snapshot | `NODE_ENV=development`, `TELEGRAM_PUBLISHER_DRY_RUN=(unset)` |
| Screenshot / HAR | On fail or first run of each test |
| Notes | e.g. `403 FILTER_BLOCKED_PRE_CRAWL` |

Store results in follow-up doc `DATAHUB_DRY_RUN_RUNTIME_RESULTS.md` when execution phase runs.

---

## Rollback / cleanup (dry-run history rows)

Dry-run tests **may leave audit rows** — cleanup is optional, not required for pass:

| Artifact | Table | Cleanup (optional) |
|----------|-------|-------------------|
| Crawler dry-run history | `datahub_crawler_runs` | Leave for audit; or `DELETE` rows where `dry_run=true AND metadata->>'probe'='dh-final-5'` if probe tagged |
| Publisher test dry-run | `publisher_delivery_history` | Leave; filter `status='dry_run'` in UI history tab |
| Automation execution | `datahub_automation_executions` | Leave; verify `dry_run=true` |
| Queue items consumed | `datahub_automation_queue` | Do **not** bulk-delete; note status change only |
| **Never delete** | `collected_data` | Should be unchanged by D-01; if changed, incident not cleanup |

**Rollback for mistaken live run (D-02/D-03 only):** Document channel + `telegram_message_id`; manual delete in Telegram if message sent; do not automate in this phase.

---

## Recommended execution order (when approved)

| Step | Action |
|------|--------|
| 0 | `GET /health` gate |
| 1 | Env pre-flight for publisher dry-run |
| 2 | **D-01** — crawler dry-run + count gate |
| 3 | **D-02** — publisher test; abort batch if not `dry_run: true` |
| 4 | **D-03** — automation test-run only if D-02 gate passed |

Run **one test at a time**; confirm evidence before proceeding.

---

## Go / no-go summary

| Test ID | Recommendation (current PM2 production `:5002`) | Blocker |
|---------|-----------------------------------------------|---------|
| **D-01** | **GO** (executed — Pass) | Must send `{ dry_run: true }`; verify `collected_data` count |
| **D-02** | **NO-GO** | `NODE_ENV=production` + `TELEGRAM_PUBLISHER_DRY_RUN` unset + `has_bot_token=true` |
| **D-03** | **NO-GO** | Hard dependency on D-02 gate; same production publisher chain |

---

## Out of scope

- Live crawler run, publisher publish, automation dispatch
- Discovery scan, prioritization apply, archiving execute
- Code changes, migrations, restarts, deploys
- Execution of this plan (DH-FINAL-5R — separate approval)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | DH-FINAL-5 initial dry-run plan — docs only |
| 2026-05-30 | DH-FINAL-5G — production runtime NO-GO for D-02/D-03 documented |
