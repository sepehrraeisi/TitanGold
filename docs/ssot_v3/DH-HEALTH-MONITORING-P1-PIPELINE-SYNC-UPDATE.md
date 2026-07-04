# DH-HEALTH-MONITORING-P1-PIPELINE-SYNC-UPDATE

> **Task:** DH-DATAHUB-HEALTH-MONITORING-P1-PIPELINE-SYNC-UPDATE  
> **Date:** 2026-07-04

---

## Phase 1 — RCA

### Frontend trace

| Component | Path |
|-----------|------|
| Tab shell | `DataHubTab.tsx` → tab `health` |
| Panel | `HealthPanel.tsx` |
| Hooks (before) | `useDataHubSourcesHealthQuery`, `useDataHubSourcesStatsQuery`, `useDataHubSourcesStateQuery`, `useDataHubHealthLogCountsQuery` |
| Hooks (after) | `useDataHubHealthMonitoringQuery`, `useCollectorHealthQuery`, `useCollectorChannelsQuery` |

**Root causes:**

1. **`GET /health` hardcoded zeros** for all pipeline activity metrics (`pipelineIngested1h`, `pipelineNormalized1h`, `telegramCreated1h`, `accessLogEvents1h`).
2. **Avg Response / Cache Hit** hardcoded to `N/A` in `HealthPanel.tsx` (GAP-035 placeholder never replaced).
3. **Telegram Collector section** used stale IndexedDB `telegramCollector` prop — not live `/api/telegram-collector/health`.
4. **`formatCountDisplay(null)` → `'0'`** — unavailable metrics rendered as fake zeros.
5. **Duplicate URL groups** skipped (`dataQuality.skipped: true`) despite `getDuplicateUrlSummaryForHealth()` existing.

### Backend trace

| Endpoint | Issue |
|----------|-------|
| `GET /api/v1/data-sources/health` | Activity metrics = 0 hardcoded; duplicate summary skipped |
| `GET /api/v1/data-sources/stats` | `logs_24h` / `logs_7d` hardcoded 0 (unchanged — out of P1 scope) |
| Pipeline lazy endpoints | Real metrics exist but Health tab did not consume them |

### Truth table (production DB + API, 2026-07-04)

| UI metric | Before (UI) | Correct source | After (API) | Fix |
|-----------|-------------|----------------|-------------|-----|
| Pipeline ingested (1h) | 0 | `collected_data.collected_at` 1h | **1900** | `queryPipelineActivity1h()` |
| Pipeline normalized (1h) | 0 | `collected_data.processed_at` 1h processed/error | **1800** | same |
| Telegram intake (1h) | 0 | `telegram_messages.created_at` 1h | **2259** | same |
| Access log events (1h) | 0 | `data_hub_logs.created_at` 1h | **179** | same |
| Avg Response Time | N/A | `AVG(data_hub_logs.execution_time_ms)` 1h | **324 ms** | `queryPerformanceMetrics()` |
| Cache Hit Rate | N/A | cached ÷ outcomes (24h logs) | **0%** (tracked) | honest 0% when no cached rows |
| Duplicate URL groups | 0 (skipped) | `getDuplicateUrlSummaryForHealth()` | real count | wired |
| Collector avg latency | N/A | live collector health API | live via `useCollectorHealthQuery` | frontend |

---

## Phase 2 — Metric mapping

See `backend/services/healthMonitoring.js` and updated `HealthPanel.tsx`.

- Unavailable → `null` in API + **Unavailable** in UI (not 0, not N/A).
- Cache not tracked → **Not tracked** (when no log outcomes in 24h).
- Partial pipeline activity → `DataHubAlert` warning.

---

## Phase 3 — Backend

### New endpoint

`GET /api/v1/data-sources/health/monitoring`

Schema: `healthMonitoringResponseSchema` in `dataHubSchemas.js`

Service: `backend/services/healthMonitoring.js`

- Parallel lightweight SQL for 1h activity + performance
- Redis/in-memory cache 45s (`datahub:health:monitoring:v1`)
- Optional collector health snapshot (internal fetch, 2.5s timeout)
- Duplicate URL summary via existing cached service

### Legacy `/health` updated

Now calls `queryHealthActivityMetrics()` + `getDuplicateUrlSummaryForHealth()` — no more hardcoded zeros.

### Performance

| Request | Latency |
|---------|---------|
| First (cold duplicate cache) | ~2–126s (duplicate analysis dominates cold path) |
| Cached | **73ms** ✓ (<500ms target) |

---

## Phase 4 — Frontend

- `HealthPanel.tsx` — monitoring query + live collector hooks
- `pipelineHealthFormat.ts` — `formatHealthMetricValue`, `formatCacheHitRateDisplay`
- `dataSourcesApi.ts` — `fetchHealthMonitoring`
- `useDataHubState.ts` — `useDataHubHealthMonitoringQuery`
- i18n keys added (en/fa × blue/green)

---

## Phase 5 — Consistency

| Check | Alignment |
|-------|-----------|
| Telegram intake 1h | Same `telegram_messages.created_at` window as pipeline transfer incoming |
| Pipeline normalized 1h | Subset of normalization 24h summary (`processed_at` window differs — labeled 1h vs 24h) |
| Collector latency | Same `useCollectorHealthQuery` as Telegram tab |
| Source counts | From same `data_sources` aggregate as `/state` |

---

## Phase 6 — Tests

```bash
cd backend && npm test -- __tests__/unit/healthMonitoring.test.js
npm test -- --run src/__tests__/healthMonitoring.test.ts
npm run build
node backend/scripts/health-monitoring-p1-browser-verify.mjs
```

All passed 2026-07-04.

---

## Phase 7 — Browser evidence

| Artifact | Path |
|----------|------|
| Evidence JSON | [`health-monitoring-p1-evidence.json`](./screenshots/health-monitoring-p1-evidence.json) |
| Full screenshot | [`health-monitoring-p1-full.png`](./screenshots/health-monitoring-p1-full.png) |
| Pipeline activity | [`health-monitoring-p1-pipeline-activity.png`](./screenshots/health-monitoring-p1-pipeline-activity.png) |
| Repro script | `backend/scripts/health-monitoring-p1-browser-verify.mjs` |

### Browser QA checklist

| Check | Result |
|-------|--------|
| Pipeline activity not all fake 0 | ✅ |
| Telegram intake real | ✅ 2259 |
| Avg response real | ✅ 324 ms |
| Cache hit not fake N/A | ✅ 0% tracked |
| Collector section live | ✅ |
| No raw i18n keys | ✅ |
| No raw N/A | ✅ |

---

## Final verdict

**Health Monitoring — REAL WORKING**

- ✅ No stale fake zeros for pipeline activity
- ✅ Honest unavailable / not tracked states
- ✅ Live Telegram Collector metrics in UI
- ✅ Browser QA pass
- ✅ Tests + build pass
- ⚠️ P2: cold first load latency (duplicate URL analysis); wire `/stats` logs_24h; backend collector proxy enrichment

**Suggested commit:** `fix(datahub): sync health monitoring with pipeline and collector metrics`
