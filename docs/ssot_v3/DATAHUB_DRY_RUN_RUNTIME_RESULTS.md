# DataHub Dry-Run Runtime Results

> **Status:** Partial execution (D-01 only)  
> **Date:** 2026-05-30 (UTC)  
> **Plan:** [`DATAHUB_DRY_RUN_TEST_PLAN.md`](./DATAHUB_DRY_RUN_TEST_PLAN.md)  
> **Branch:** `feat/gap-008-sources-backend-wiring`  
> **Account:** `admin@titangold.com` (admin) — JWT via curl-auth

---

## Executive summary

| Test ID | Result | Notes |
|---------|--------|-------|
| **D-01** Crawler dry-run | **Pass** | `collected_data` count unchanged (178 → 178) |
| D-02 Publisher test | **Skipped** | Awaiting Telegram Publisher dry-run env gate confirmation |
| D-03 Automation test-run | **Skipped** | Blocked until D-02 gate cleared |

---

## Gate

| Check | Result |
|-------|--------|
| `GET /health` | **200** — healthy, DB connected |
| Timestamp (UTC) | `2026-05-30T19:47:33Z` (gate) / `2026-05-30T19:47:42Z` (run) |

---

## D-01 — Crawler dry-run

### Target

| Field | Value |
|-------|-------|
| **Crawler ID** | `b1f6ab9b-e5bf-442e-9b72-3a006c075162` |
| **Crawler name** | eghtesaad24 دلار و ارز |
| **Source ID** | `b1ec7306-fc00-4d3c-8857-0a3000aa422a` |
| **Target type** | `rss` |
| **Method** | curl-auth (no UI click) |

### Request

```
POST /api/v1/data-hub/crawlers/b1f6ab9b-e5bf-442e-9b72-3a006c075162/run
Authorization: Bearer <admin JWT>
Content-Type: application/json

{ "dry_run": true }
```

### `collected_data` count gate

| Phase | Query | Count |
|-------|-------|-------|
| **Before** | `SELECT COUNT(*) FROM collected_data WHERE source_id = 'b1ec7306-fc00-4d3c-8857-0a3000aa422a'` | **178** |
| **After** | same | **178** |
| **Delta** | — | **0** ✅ |

### Response

| Field | Value |
|-------|-------|
| **HTTP status** | **200** |
| `run.dry_run` | **true** ✅ |
| `run.metadata.dry_run` | **true** ✅ |
| `run.status` | `success` |
| `run.id` | *(new run row — audit only)* |
| `stats.pages_fetched` | 23 |
| `stats.items_ingested` | 23 *(simulated dry-run passes — not DB rows)* |
| `stats.items_blocked` | 0 |

### Pass/Fail

| Criterion | Result |
|-----------|--------|
| Payload `dry_run: true` | Pass |
| Response `run.dry_run === true` | Pass |
| Response `metadata.dry_run === true` | Pass |
| `collected_data` count unchanged | Pass |
| No live Run executed | Pass (curl only) |
| No backend 500 | Pass |

**Overall D-01: Pass**

### Accepted side effects

| Side effect | Accepted? |
|-------------|-----------|
| New row in `datahub_crawler_runs` with `dry_run=true` | **Yes** — audit trail |
| `datahub_crawlers` / `data_sources` timestamp updates (`last_run_at`, `last_fetch_at`) | **Yes** — per plan |
| External RSS HTTP fetch (read-only) | **Yes** — per plan |
| `collected_data` INSERT | **No** — did not occur ✅ |

### Stop conditions triggered

None.

---

## Skipped intentionally

| Test ID | Reason |
|---------|--------|
| **D-02** | User directive — Telegram Publisher dry-run env gate not yet confirmed with certainty |
| **D-03** | User directive — blocked until D-02 gate cleared |

---

## Next recommended step

1. **Env pre-flight for D-02:** Record `NODE_ENV` and `TELEGRAM_PUBLISHER_DRY_RUN` on target backend; confirm response `dry_run: true` on probe before any publisher/automation dry-run.
2. **D-02** (when approved): Single publisher test on `5ab9a6bc-…`; verify `telegram_message_id: null`.
3. **D-03** (when approved): Only after D-02 gate passes.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | D-01 executed and passed; D-02/D-03 skipped |
