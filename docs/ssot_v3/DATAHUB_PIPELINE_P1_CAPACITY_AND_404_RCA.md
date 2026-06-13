# DataHub Pipeline P1 — 404 RCA & 200k/day Capacity Plan

> **Task:** DH-PIPELINE-P1-CAPACITY-AND-404-RCA-1  
> **Date:** 2026-06-07  
> **Prerequisites:** P0 gates green (`f06b700` backend + collector recovery)

---

## Part A — Data Pipeline “Resource not found” RCA

### Symptom

DataHub → **Data Pipeline** tab loads for a long time (~30s), then shows:

> **Resource not found on the server.**

(Frontend key: `datahub_error_not_found` — maps HTTP 404 / “not found” text.)

### Reproduction

| Layer | Request | Result |
|-------|---------|--------|
| Browser (prod) | `GET https://titan.zala.ir/api/v1/data-sources/pipeline` | Hung ~30s → 404 HTML (170 bytes) |
| curl direct (backend) | `GET http://127.0.0.1:5002/api/v1/data-sources/pipeline` + JWT | **200** after **~39–158s** |
| curl via nginx (before fix) | same URL | **404** after **exactly ~30s** |
| curl via nginx (after fix) | same URL + JWT | **200** after **~44s** |

### Exact failing request

| Field | Value |
|-------|-------|
| **URL** | `GET /api/v1/data-sources/pipeline` |
| **Method** | GET |
| **Status (user-visible)** | **404** (nginx-generated, not Express) |
| **Response body** | nginx HTML `404 Not Found` (170 bytes) — **not** JSON `{ error: ... }` |

**Not failing:** `/health`, `/stats`, `/state` (summary cards load). Frontend path in `services/dataPipelineApi.ts` is correct.

### Root cause

**Composite — not a missing backend route:**

1. **Primary (user-visible 404):** Nginx `proxy_read_timeout 30s` on `location /api/` in `/etc/nginx/sites-available/titan-zala`. Backend snapshot exceeds 30s → nginx closes upstream and returns its own **404** page. Frontend interprets as “Resource not found.”
2. **Secondary (latency):** `batchCollectorBacklogIntelligence()` in `telegramBacklogIntelligence.js` — per-channel correlated `messages_ahead` subquery scanned ~3.8M unprocessed rows (~154s alone). Full `dataPipelineSnapshot` adds enrichment joins and LATERAL source queries.

**Ruled out:** missing route (`backend/routes/data-sources.js` line 542), wrong frontend path, stale route chunk, auth redirect, validation middleware returning 404.

### Evidence

- Nginx access: `"GET /api/v1/data-sources/pipeline HTTP/2.0" 404 170` (pre-fix); `200` post-fix (`12:50:35 UTC`).
- Backend slow-query logs: backlog intelligence query ~154s (pre-optimization).
- PM2 backend: pipeline requests logged with status `-` when client/nginx timed out.

### Fixes applied

| Fix | Scope | Detail |
|-----|-------|--------|
| **Nginx pipeline timeout** | Server `/etc/nginx/sites-available/titan-zala` | Added `location = /api/v1/data-sources/pipeline` with `proxy_read_timeout 180s` **before** general `/api/` block. Reloaded nginx. |
| **Backlog query optimization** | `backend/services/telegramBacklogIntelligence.js` | Replaced per-channel correlated subquery with single-pass `ROW_NUMBER()` window. Benchmark: ~27–39s for backlog portion (combined snapshot ~44s). |

### Verification (Part A)

- `curl` direct + nginx: **200**, JSON ~38 KB, ~44s.
- Nginx access log: **200** for pipeline.
- No backend 404 for this path in application logs.

---

## Part B — Capacity readiness (pre-tuning)

**Audit time:** 2026-06-07 ~12:45 UTC (post-collector restart `f06b700`)

### Live rates

| Metric | 1h | 6h | 24h |
|--------|-----|-----|------|
| `telegram_messages` transfer processed | 6,000 | 32,000 | 116,500 |
| Normalization processed | 5,991 | 31,868 | 88,223 |
| Collector intake (new unprocessed) | 2,906 | 2,906 | 2,906 |
| `collected_data` pending | — | — | **204** |
| Telegram backlog (`is_processed=false`) | — | — | **3,791,999** |

**Interpretation:** Transfer/normalization healthy at ~4.8–6k/hr. Collector intake resumed. Pending `collected_data` low (~204); not growing unbounded. Telegram FIFO backlog still ~3.79M.

### Scheduler health

- No `skip_reason: in_memory_lock` or missed-tick errors in engine logs post-recovery.
- Engine worker online; schedulers restarted cleanly on reload (`12:45:55 UTC`).

### DB load / worker duration

| Worker | Avg duration (prod) | Max seen | Bottleneck? |
|--------|---------------------|----------|-------------|
| Transfer (500 rows) | ~1.5s | ~17.7s (500-row run under load) | No |
| Normalization (100 rows) | ~0.2–2.1s | ~2.1s | No |

Slow queries on pipeline **read path** (snapshot API), not transfer/normalization writes.

### Idle gate

`engineWorkerLeader.checkForWork()` considers exchange connections, recent users, AI jobs — **not** pipeline backlog. Known risk from throughput RCA; workers currently active because `hasActiveUsers=true`.

### Config before / after tuning

| Setting | Before | After (Option A) |
|---------|--------|------------------|
| Transfer interval | 5 min | 5 min (unchanged) |
| Transfer batch | 500 | **700** |
| Normalization interval | 1 min | 1 min (unchanged) |
| Normalization batch | 100 | **150** |

### Theoretical throughput

| Stage | Before | After (Option A) |
|-------|--------|------------------|
| Transfer | 500 × 288 = **144k/day** | 700 × 288 = **201.6k/day** |
| Normalization | 100 × 1,440 = **144k/day** | 150 × 1,440 = **216k/day** |
| Observed (24h pre-tune) | **~113k/day** | monitor post-tune |

### Option selection — **Option A**

**Transfer 700 / 5 min + Normalization 150 / 1 min**

**Why not B (500/3min)?** Changes interval (higher scheduler churn, more advisory-lock contention) for smaller gain. DB headroom supports larger batch without interval change.

**Why A over status quo?** Smallest change set (constants only); both stages exceed 200k/day theoretical; worker durations remain low at current scale.

**Constraints honored:** No PM2 topology change, no parallel workers, no interval change, no data semantics change, `TELEGRAM_PUBLISHER_DRY_RUN` untouched, no agent/data_queue activation.

---

## Part C — Implementation & verification

### Files changed

| File | Change |
|------|--------|
| `backend/services/telegramBacklogIntelligence.js` | `ROW_NUMBER()` backlog query (404 latency fix) |
| `backend/services/telegramPipeline.js` | `TELEGRAM_TRANSFER_DEFAULT_BATCH` 500 → 700 |
| `backend/services/normalizationWorker.js` | `NORMALIZATION_DEFAULT_BATCH` 100 → 150 |
| `/etc/nginx/sites-available/titan-zala` | Pipeline-specific 180s proxy timeout (server config, not in git) |

### Deploy steps executed

1. `npm run build` — **pass** (~79s)
2. `npm test -- --testPathPattern=telegramBacklogIntelligence` — **3/3 pass**
3. `pm2 reload titan-backend` — pick up snapshot query fix
4. `pm2 reload titan-engine-worker` — pick up batch constants (not topology change)
5. `sudo nginx -t && sudo systemctl reload nginx` — pipeline timeout block

### Runtime verification (immediate)

| Check | Result |
|-------|--------|
| Pipeline API direct | 200, ~39s |
| Pipeline API via nginx | 200, ~44s |
| Transfer batch live | `batchSize: 700` (`12:51:10 UTC`) |
| Normalization batch live | `batchSize: 150` (`12:54:57 UTC`) |
| Pending backlog after tune | 100 (draining) |

### Post-tune monitoring (30–60 min — ongoing)

Watch:

- Transfer rows/hour (target ~8.4k/hr = 201.6k/24)
- Normalization rows/hour (target ~9k/hr)
- `collected_data` pending (should stay low, not climb)
- Engine error rate
- DB slow queries on snapshot path

### Before / after throughput estimate

| | Before | After (theoretical) | After (expected observed @24h) |
|--|--------|---------------------|--------------------------------|
| Transfer | 144k/day cap, ~113k observed | 201.6k/day | ~170–200k/day once steady |
| Normalization | 144k/day cap | 216k/day | matches transfer |

### Rollback plan

1. **Batch sizes:** revert `TELEGRAM_TRANSFER_DEFAULT_BATCH` to 500, `NORMALIZATION_DEFAULT_BATCH` to 100 → `pm2 reload titan-engine-worker`
2. **Backlog query:** revert `telegramBacklogIntelligence.js` → `pm2 reload titan-backend`
3. **Nginx:** remove `location = /api/v1/data-sources/pipeline` block from `titan-zala` → `sudo nginx -t && sudo systemctl reload nginx` (UI will 404 again if snapshot >30s)

---

## Summary

| Item | Finding |
|------|---------|
| **Failing endpoint** | `GET /api/v1/data-sources/pipeline` |
| **Root cause** | Nginx 30s `proxy_read_timeout` + slow snapshot SQL (~40–158s) |
| **404 type** | Proxy timeout masquerading as 404 — not missing Express route |
| **Capacity gate** | DB/workers have headroom; scheduler rate cap was bottleneck |
| **Tuning** | Option A: 700/5min transfer, 150/1min normalization |
| **Commit** | See git log after `DH-PIPELINE-P1-CAPACITY-AND-404-RCA-1` commit |
