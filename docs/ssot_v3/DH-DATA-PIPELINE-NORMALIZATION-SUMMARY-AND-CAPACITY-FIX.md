# DH-DATA-PIPELINE-NORMALIZATION-SUMMARY-AND-CAPACITY-FIX

> **Task:** DH-DATA-PIPELINE-PX-NORMALIZATION-SUMMARY-AND-CAPACITY-IMPLEMENT  
> **Date:** 2026-07-01  
> **RCA reference:** [DH-DATA-PIPELINE-NORMALIZATION-SUMMARY-AND-CAPACITY-RCA.md](./DH-DATA-PIPELINE-NORMALIZATION-SUMMARY-AND-CAPACITY-RCA.md)

---

## Summary

| Deliverable | Status |
|-------------|--------|
| Lazy `GET /pipeline/normalization-summary` (24h, no fake zeros) | ✅ |
| Read-only `GET /pipeline/capacity` | ✅ |
| Frontend Normalization Summary (loading/unavailable/loaded) | ✅ |
| Frontend Pipeline Capacity (config-only banner, no fake buttons) | ✅ |
| Fast `/pipeline` unchanged (~3.5s) | ✅ |
| Index migration `046_collected_data_norm_summary_24h_index.sql` | ✅ |

---

## Root cause (recap)

Fast pipeline view returned `emptyNormalizationSummary()` → `{0,0,0,0}` while real DB had **~150k processed / 24h**. UI rendered placeholder zeros as real metrics.

---

## Implementation

### Backend

| File | Change |
|------|--------|
| `backend/services/pipelineNormalizationSummary.js` | Parallel 24h counts; optional warnings sub-query; cache success-only; 90s core / 20s warnings timeout |
| `backend/services/pipelineCapacity.js` | Read-only config from scheduler + constants |
| `backend/routes/data-sources.js` | New routes `/pipeline/normalization-summary`, `/pipeline/capacity` |
| `backend/schemas/dataHubSchemas.js` | Response schemas with nullable fields + `meta.loaded` |
| `backend/database/migrations/046_*.sql` | Index on `processed_at` for processed/error rows |

### Frontend

| File | Change |
|------|--------|
| `PipelineNormalizationSummary.tsx` | Lazy widget with loading/unavailable/loaded states |
| `PipelineCapacityPanel.tsx` | Read-only capacity + config-only banner |
| `PipelinePanel.tsx` | Transfer Health + Capacity row; Normalization full-width; removed fake-zero cards |
| `useDataHub.ts` / `useDataHubState.ts` | Lazy React Query hooks |
| `services/dataPipelineApi.ts` | New fetchers |

### i18n

Keys `pipeline_normalization_*` and `pipeline_capacity_*` in en/fa × blue/green.

---

## Performance evidence (production DB, 2026-07-01 18:26 UTC)

| Endpoint | First request | Cached |
|----------|---------------|--------|
| `GET /pipeline` (fast) | **~1.7s** | cached via existing pipeline cache |
| `GET /pipeline/normalization-summary` | **~20s** (parallel 24h counts) | **~26ms** |
| `GET /pipeline/capacity` | **~11ms** | n/a (in-memory) |
| `GET /pipeline/backlog` | **~24s** | existing lazy path |

**Note:** First normalization load is slow due to ~145k row count on `collected_data`. Cached responses meet **<500ms** target. Warnings may be `null` with `meta.partial: true` when warnings sub-query exceeds 20s.

### DB index

```sql
idx_collected_data_norm_summary_24h ON collected_data (processed_at DESC)
  WHERE status IN ('processed', 'error')
```

Migration: `backend/database/migrations/046_collected_data_norm_summary_24h_index.sql` — applied.

---

## Tests

```bash
npm run test -- src/__tests__/pipelineNormalizationCapacity.test.ts src/__tests__/telegramTransferHealth.test.ts
cd backend && npm test -- __tests__/unit/pipelineNormalizationCapacity.test.js
npm run build
```

All passed on 2026-07-01.

---

## Browser QA (2026-07-01)

Path: **AI → Manager → Data Hub → Data Pipeline** (admin JWT session)

| Check | Result |
|-------|--------|
| Telegram Transfer Health | ✅ 76k incoming, 744k backlog, Warning badge |
| Source Quality Board | ✅ visible |
| Normalization Summary — no fake 0/0/0/0 | ✅ Processed **145,009**, Passed **144,739**, Rejected **270**, Pass rate **99.8%** |
| Warnings partial/unavailable | ✅ shows **"Temporarily unavailable"** (not fake zero) |
| Pipeline Capacity panel | ✅ Config-only / Balanced, batch 700/150, intervals 5m/1m |
| Config-only banner | ✅ visible |
| Fake throughput buttons | ✅ none |
| Refresh normalization | ✅ dedicated lazy retry only |
| Raw i18n keys / raw dash | ✅ none observed |

Evidence: [`data-pipeline-normalization-capacity-evidence.json`](./screenshots/data-pipeline-normalization-capacity-evidence.json)

---

## Final verdict

**REAL WORKING** for P1 scope:

- ✅ No fake zeros in Normalization Summary UI
- ✅ Lazy endpoint with safe unavailable/null failure mode
- ✅ Honest read-only Pipeline Capacity panel (no fake mode buttons)
- ✅ Fast pipeline path unchanged (~1.7s)
- ✅ Tests + build pass
- ✅ Browser QA pass (admin session)
- ⚠️ First normalization load ~20s on current volume (cached <500ms); warnings may be partial

**Suggested commit:** `fix(datahub): repair pipeline normalization summary and add capacity visibility`

**P2 backlog:** Runtime capacity presets (`POST /pipeline/capacity/mode`), warnings rollup optimization, materialized 24h stats table, remove legacy `emptyNormalizationSummary()` from fast `/pipeline` response.

---

## Pre-close Product Polish (2026-07-04)

> **Task:** DH-DATA-PIPELINE-PX-POLISH-PRE-CLOSE

### Changes

| Item | Implementation |
|------|----------------|
| P1 — No fake "Balanced" mode | UI shows **Configuration only**; backend `modeLabel: configuration_only` |
| P2 — Refresh normalization isolation | `queryClient.fetchQuery` targets **only** `pipelineNormalizationSummary` key |
| P3 — Scheduler status | Read-only field from `scheduler.getStatus().isRunning` → Running/Stopped/Unknown |
| P4 — Backlog severity badge | Normal / Warning / Critical pills on backlog metrics (<100k / 100k–500k / >500k) |
| P5 — Catch-up live derivation | Verified via `computeCatchUpHoursLive` + unit tests (never cached independently) |
| P6 — Pass rate emphasis | `MetricCard emphasis="primary"` (larger typography) |
| P7 — Partial warnings tooltip | `title` on warnings value when `meta.partial && warnings == null` |
| P8 — Response time severity | Source Quality Board: Healthy / Warning / Critical color + label |
| P9 — Backlog trend (24h) | `meta.backlogTrend` on `/pipeline/backlog`; Redis hourly snapshots + flow-balance fallback |

### New / updated files

- `backend/services/pipelineBacklogTrend.js`
- `components/ai/AIManager/tabs/DataHub/pipelineOperationalMetrics.ts`
- Updated: `PipelineCapacityPanel`, `TelegramTransferHealth`, `PipelineNormalizationSummary`, `PipelinePanel`, `useDataHub.ts`

### QA checklist

| Check | Status |
|-------|--------|
| No "Balanced" mode in UI | ✅ |
| Scheduler status visible | ✅ |
| Backlog severity badge | ✅ |
| Refresh normalization isolated | ✅ (code + test) |
| Pass rate visually emphasized | ✅ |
| Partial warnings tooltip | ✅ |
| Response severity colors | ✅ |
| Backlog trend or honest unavailable | ✅ |
| No fake throughput buttons | ✅ |
| No raw i18n / dash | ✅ |

### Tests (2026-07-04)

```bash
npm test -- --run src/__tests__/pipelineOperationalMetrics.test.ts src/__tests__/pipelineNormalizationCapacity.test.ts
cd backend && npm test -- __tests__/unit/pipelineBacklogTrend.test.js __tests__/unit/pipelineNormalizationCapacity.test.js
npm run build
```

All passed.

### Performance

No new heavy queries on fast `/pipeline`. Backlog trend computed during existing lazy `/pipeline/backlog` enrichment; Redis snapshot append is throttled (≥50 min interval).

### Suggested commit

`feat(datahub): final product polish for pipeline operations dashboard`

---

## Final Closeout (2026-07-04)

> **Task:** DH-DATA-PIPELINE-FINAL-CLOSEOUT  
> **Polish commit:** `6fa9158` — `feat(datahub): final product polish for pipeline operations dashboard`  
> **Closeout QA commit:** `8a2597a` — refresh refetch + Source Quality dash fix + browser evidence

### Production browser QA (post build/deploy)

Path: **AI → Manager → Data Hub → Data Pipeline** (admin JWT, Playwright headless against `localhost:3000`)

| Check | Result |
|-------|--------|
| Data Pipeline loads | ✅ |
| No raw i18n keys | ✅ |
| No raw dash (pipeline panels) | ✅ |
| No fake zeros (Normalization Summary) | ✅ |
| No fake "Balanced" mode | ✅ — **Configuration only** |
| Scheduler status visible | ✅ — **Stopped** (honest PM2 cluster read) |
| Backlog severity visible | ✅ — **Critical** badge |
| Backlog trend honest | ✅ — **Unavailable** (no fabricated trend) |
| Refresh normalization isolated | ✅ — only `GET /pipeline/normalization-summary` |
| Source Quality Board | ✅ |
| Telegram Transfer Health | ✅ — Warning + partial unavailable metrics |

### Closeout fixes (post-polish)

| Fix | Why |
|-----|-----|
| `handleRetryPipelineNormalization` uses `fetchQuery` with `staleTime: 0` | Explicit refresh must refetch; prior 60s stale window skipped network |
| Source Quality score null → `pipeline_response_unavailable` | Removed last raw em-dash in pipeline tab |

### Evidence

| Artifact | Path |
|----------|------|
| Checklist + network isolation JSON | [`data-pipeline-closeout-evidence.json`](./screenshots/data-pipeline-closeout-evidence.json) |
| Full page screenshot | [`data-pipeline-closeout-full.png`](./screenshots/data-pipeline-closeout-full.png) |
| Panels screenshot | [`data-pipeline-closeout-panels.png`](./screenshots/data-pipeline-closeout-panels.png) |
| Source Quality screenshot | [`data-pipeline-closeout-source-quality.png`](./screenshots/data-pipeline-closeout-source-quality.png) |
| Repro script | `backend/scripts/data-pipeline-closeout-browser-verify.mjs` |

### Tests (unchanged, all pass)

```bash
npm test -- --run src/__tests__/pipelineOperationalMetrics.test.ts src/__tests__/pipelineNormalizationCapacity.test.ts
cd backend && npm test -- __tests__/unit/pipelineBacklogTrend.test.js __tests__/unit/pipelineNormalizationCapacity.test.js
npm run build
node backend/scripts/data-pipeline-closeout-browser-verify.mjs
```

### Final verdict

**Data Pipeline — REAL WORKING / CLOSED**

- ✅ Lazy normalization summary (no fake zeros)
- ✅ Read-only pipeline capacity (config-only, scheduler status)
- ✅ Backlog severity + honest trend unavailable
- ✅ Refresh normalization network-isolated
- ✅ Telegram Transfer Health + Source Quality Board operational
- ✅ Browser QA pass (2026-07-04, production stack via PM2)
- ⚠️ P2: remove legacy `emptyNormalizationSummary()` from fast `/pipeline` response; runtime capacity presets; warnings rollup optimization
