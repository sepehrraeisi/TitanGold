# DataHub Dry-Run Runtime Results

> **Status:** D-01 **Pass**; D-02/D-03 **NO-GO** (env gate audit DH-FINAL-5G)  
> **Date:** 2026-05-30  
> **Plan:** [`DATAHUB_DRY_RUN_TEST_PLAN.md`](./DATAHUB_DRY_RUN_TEST_PLAN.md) (DH-FINAL-5)  
> **Branch:** `feat/gap-008-sources-backend-wiring`  
> **Account:** `admin@titangold.com` (admin) — curl-auth JWT

---

## Executive summary

| Test ID | Result | Notes |
|---------|--------|-------|
| **D-01** Crawler dry-run | **Pass** | `dry_run: true`; `collected_data` count unchanged |
| **D-02** Publisher test | **NO-GO** | DH-FINAL-5G: production env + bot token — live Telegram send possible; **not executed** |
| **D-03** Automation test-run | **NO-GO** | Same publisher chain as D-02; **not executed** |

**No Telegram message was sent** during any dry-run phase (D-02/D-03 were never invoked).

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

---

## Next recommended phase

1. **High-risk writes planning** (DH-FINAL-6+) — planning only, no execution.
2. **D-02/D-03:** Remain blocked until env gate fixed and explicit user approval for probe.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | D-01 executed — Pass; D-02/D-03 skipped |
| 2026-05-30 | DH-FINAL-5G gate audit — D-02/D-03 **NO-GO**; no Telegram send |
