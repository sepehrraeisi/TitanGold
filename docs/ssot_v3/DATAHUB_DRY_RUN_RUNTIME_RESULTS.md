# DataHub Dry-Run Runtime Results

> **Status:** Partial execution — **D-01 only**  
> **Date:** 2026-05-30  
> **Plan:** [`DATAHUB_DRY_RUN_TEST_PLAN.md`](./DATAHUB_DRY_RUN_TEST_PLAN.md) (DH-FINAL-5)  
> **Branch:** `feat/gap-008-sources-backend-wiring`  
> **Account:** `admin@titangold.com` (admin) — curl-auth JWT

---

## Executive summary

| Test ID | Result | Notes |
|---------|--------|-------|
| **D-01** Crawler dry-run | **Pass** | `dry_run: true`; `collected_data` count unchanged |
| D-02 Publisher test | **Skipped** | Awaiting Telegram Publisher env dry-run gate confirmation |
| D-03 Automation test-run | **Skipped** | Blocked until D-02 gate cleared |

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

## Skipped intentionally

| Test ID | Reason |
|---------|--------|
| **D-02** | User approval: defer until `TELEGRAM_PUBLISHER_DRY_RUN` / `NODE_ENV` gate confirmed with certainty |
| **D-03** | Blocked — depends on D-02 publisher dry-run gate |

---

## Next recommended phase

1. **Env audit:** Record `NODE_ENV` and `TELEGRAM_PUBLISHER_DRY_RUN` on target runtime (read-only, no restart).
2. **D-02 probe:** Single publisher test only if gate proves forced dry-run (`dry_run: true` + `telegram_message_id: null`).
3. **D-03:** Only after D-02 pass on same publisher chain.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | D-01 executed — Pass; D-02/D-03 skipped |
