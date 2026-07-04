# DH-DATA-PIPELINE-NORMALIZATION-SUMMARY-AND-CAPACITY-RCA

> **Task:** DH-DATA-PIPELINE-PX-NORMALIZATION-SUMMARY-AND-CAPACITY-CONTROLS  
> **Date:** 2026-07-01  
> **Phase:** RCA + product/design only (no implementation in this commit)  
> **Human QA trigger:** Normalization Summary always shows `0`; operators need safe capacity visibility when backlog grows.

---

## Executive summary

| Issue | Root cause | Verdict |
|-------|------------|---------|
| Normalization Summary all zeros | Fast pipeline view **intentionally skips** the SQL section and returns `emptyNormalizationSummary()` (hardcoded zeros). UI renders it as real data. | **Fake zeros — not a DB problem** |
| Real normalization traffic exists | DB shows **~152k processed / 24h** in `collected_data`; pipeline health cards show **4.2k requests / 3.7k passed** from `data_hub_logs`. | Data is real; wiring is wrong |
| Enabling summary inline is unsafe | `loadNormalizationSummary()` 7-day OR-scan takes **108–134s** on production volume. | Cannot enable on fast `/pipeline` path |
| Capacity controls | Partial runtime knobs exist in `scheduler.updateConfig()` but **API blocks** pipeline sections; transfer batch is **hardcoded**; no `/pipeline/capacity` endpoint. | **Read-only panel now; runtime modes = P2** |

**Product decision:** **Keep Normalization Summary (Option A)** — lazy-loaded, 24h-scoped, cached, unavailable until loaded. **Add read-only Pipeline Capacity panel (Option A read-only)** — honest about config-only limits; no fake mode buttons.

---

## Phase 1 — Normalization Summary RCA

### Frontend trace

| Layer | Finding |
|-------|---------|
| **Render** | `PipelinePanel.tsx` lines ~486–513 — `{normalizationSummary && (...)}` renders four `MetricCard`s |
| **Props** | `useDataHub.ts` → `pipelineView?.normalizationSummary` from React Query `usePipelineQuery` |
| **API client** | `fetchDataPipelineView()` in `services/dataPipelineApi.ts` — only passes `includeBacklog=true/false`; **never** `includeNormalizationSummary=true` |
| **Hardcoded zeros?** | No frontend literals — values come from API object `{ totalProcessed: 0, passed: 0, warnings: 0, rejected: 0 }` |
| **Fallback** | Legacy `services/api.ts` / `defaults.ts` also default to zeros for offline/demo state — not used by current Pipeline tab path |

**UI bug:** Condition `normalizationSummary &&` is always truthy because backend always returns an object (even when not loaded).

### Backend trace

| Layer | Finding |
|-------|---------|
| **Route** | `GET /api/v1/data-sources/pipeline` — `data-sources.js` ~830 |
| **Flag** | `includeNormalizationSummary: flags.includeNormalizationSummary === true` — **opt-in, default false** |
| **When false** | `emptyNormalizationSummary()` → `{ totalProcessed: 0, passed: 0, warnings: 0, rejected: 0 }` — **intentional placeholder, not “no data”** |
| **When true** | `loadNormalizationSummary()` — SQL on `collected_data` |
| **Schema** | `pipelineQuerySchema` supports `includeNormalizationSummary=true`; `dataPipelineViewResponseSchema` requires numeric fields (no `null`/unavailable) |

### SQL (current)

```sql
-- backend/services/dataPipelineSnapshot.js :: loadNormalizationSummary()
SELECT
  COUNT(*) FILTER (WHERE status IN ('processed', 'error'))::int AS total_processed,
  COUNT(*) FILTER (WHERE status = 'processed' AND normalized_data IS NOT NULL)::int AS passed,
  COUNT(*) FILTER (WHERE status = 'processed' AND normalized_data IS NOT NULL
    AND (normalized_data->'metadata'->>'quality_warning' = 'true'
      OR normalized_data->'metadata'->>'quality_band' IN ('weak', 'poor')))::int AS warnings,
  COUNT(*) FILTER (WHERE status = 'error')::int AS rejected,
  MAX(processed_at) FILTER (WHERE status = 'processed') AS last_processed_at
FROM collected_data
WHERE processed_at > NOW() - INTERVAL '7 days'
   OR collected_at > NOW() - INTERVAL '7 days';
```

**Problems with this query:**
1. **7-day window** but UI labels say “Processed / Passed / …” with no time scope — misleading vs 24h health cards.
2. **`OR collected_at`** prevents efficient index use → full/partition scan.
3. **No index** on `processed_at` for general status counts (partial index `idx_collected_data_automation_candidates` only covers `status='processed' AND normalized_data IS NOT NULL`).

### Database evidence (production, 2026-07-01 ~14:37 UTC)

| Query | Duration | Result |
|-------|----------|--------|
| 24h status breakdown (`processed_at OR collected_at`) | **4.5s** | processed 151,831 · error 278 · pending 100 |
| 24h normalization counts (same filters as backend) | **4.5s** | total_processed **152,184** · passed **151,906** · rejected **278** |
| 7d backend SQL (exact) | **108s** | total_processed **1,179,111** · passed **1,177,207** · warnings **419** · rejected **1,904** |
| 24h `processed_at` only | **42s** | total_processed **152,659** |
| `data_hub_logs` 24h | **230ms** | requests **4,226** · passed **3,694** |
| `telegram_messages` processed 24h | **1.5s** | **152,700** |

**Conclusion:** Zeros in UI are **not** DB zeros. Real normalization throughput ≈ **152k/day** aligns with Telegram Transfer Health processed metrics.

### API evidence (backend build, same day)

| Call | Wall time | `normalizationSummary` |
|------|-----------|------------------------|
| `buildDataPipelineView({ includeNormalizationSummary: false })` | **2.3s** | `{ totalProcessed: 0, passed: 0, warnings: 0, rejected: 0 }` ← **what UI gets today** |
| `buildDataPipelineView({ includeNormalizationSummary: true, useCache: false })` | **134.6s** | Real 7d totals (1.17M processed) |

### Truth table

| Metric | Current UI | Backend field | DB source (24h) | Correct value 24h | Notes |
|--------|------------|---------------|-----------------|-------------------|-------|
| Processed | **0** | `normalizationSummary.totalProcessed` | `collected_data` status IN (`processed`,`error`) | **~152,184** | Fake zero: fast view uses `emptyNormalizationSummary()` |
| Passed | **0** | `normalizationSummary.passed` | `status='processed' AND normalized_data IS NOT NULL` | **~151,906** | Same |
| Warnings | **0** | `normalizationSummary.warnings` | quality_warning / weak/poor band in `normalized_data` | **TBD** (needs 24h-scoped query; 7d=419) | Not loaded |
| Rejected | **0** | `normalizationSummary.rejected` | `status='error'` | **~278** | Same |
| Pass rate | — | not shown | derived | **~99.8%** | Add when wired |
| Last event | hidden | `lastProcessedAt` | `MAX(processed_at)` | **2026-07-01T14:35:18Z** | Available when query runs |

### Related but different metrics (do not conflate)

| UI section | Source table | Meaning |
|------------|--------------|---------|
| Pipeline health cards “Requests 24h / Passed 24h” | `data_hub_logs` | Source **fetch/audit** events, not normalization |
| Telegram Transfer Health “Processed 24h” | `telegram_messages` / throughput helper | **Transfer** to pipeline, not `collected_data` normalization |
| Normalization Summary | `collected_data` | **Normalize-only worker** output |

---

## Phase 2 — Product decision: Normalization Summary

### Options considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **A) Keep + wire real data** | Operators expect normalization QA; data exists | Needs lazy load + index + cache | **✅ Selected** |
| B) Replace with ops panel | Could merge with capacity | Loses explicit pass/warn/reject breakdown | Defer merge to P2 |
| C) Remove | Simplest | Hides useful QA signal; duplicates Advanced tab preview partially | ❌ Rejected |

**Honest assessment:** Section is **not obsolete** — it answers “did normalization succeed?” distinct from fetch logs and Telegram transfer. It was **disabled for performance** but UI still shows **fake zeros**, which is worse than hidden/unavailable.

**Immediate rule:** Never render numeric zeros when `loaded !== true`.

---

## Phase 3 — Design: Normalization Summary (if kept)

### Architecture (mirror Telegram Transfer Health / backlog pattern)

```
Pipeline tab load:
  1. GET /pipeline?includeBacklog=false          (~2–3s, fast)
  2. GET /pipeline/backlog                       (lazy, cached)
  3. GET /pipeline/normalization-summary  (NEW)  (lazy, cached)  ← proposed
```

### Proposed endpoint

`GET /api/v1/data-sources/pipeline/normalization-summary`

Response:

```json
{
  "windowHours": 24,
  "totalProcessed": 152184,
  "passed": 151906,
  "warnings": 12,
  "rejected": 278,
  "passRate": 0.998,
  "lastProcessedAt": "2026-07-01T14:35:18.832Z",
  "meta": {
    "loaded": true,
    "cachedAt": "2026-07-01T14:40:00.000Z",
    "queryMs": 120,
    "partial": false
  }
}
```

On failure/timeout:

```json
{
  "totalProcessed": null,
  "passed": null,
  "warnings": null,
  "rejected": null,
  "meta": { "loaded": false, "unavailableReason": "query_timeout" }
}
```

### SQL changes (implementation P1)

1. **Scope:** 24 hours only — `WHERE processed_at > NOW() - INTERVAL '24 hours'`
2. **Remove** `OR collected_at` from count query (ingested-but-not-processed belongs in pending/backlog, not “processed”)
3. **Index (new migration):**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collected_data_norm_summary_24h
  ON collected_data (processed_at DESC)
  WHERE status IN ('processed', 'error');
```

4. **Cache:** Redis `pipeline:normalization-summary:v1` TTL **60s** (same pattern as backlog enrichment)
5. **Target:** p95 **< 500ms** after index (validate before shipping)

### Frontend changes (implementation P1)

| State | Display |
|-------|---------|
| Loading | Skeleton + `pipeline_normalization_loading` |
| Not fetched / fast view | **“Normalization details load separately.”** — no numbers |
| Loaded | Real counts + pass rate + last event |
| Unavailable | **“Temporarily unavailable”** muted `MetricCard` — **never 0** |
| Error | `DataHubAlert` + retry |

Labels must include **(24h)** to match health cards.

---

## Phase 4 — Pipeline capacity / throughput RCA

### Processing architecture (as deployed)

```
Telegram Collector (PM2: telegram-collector)
  └─ messageProcessor → telegram_messages (intake)

Engine worker (PM2: titan-engine-worker → scheduler.js)
  ├─ Telegram transfer (every 5 min)
  │    transferTelegramMessagesToPipeline(TELEGRAM_TRANSFER_DEFAULT_BATCH=700)
  │    telegram_messages → collected_data (pending)
  ├─ Normalization worker (every 1 min)
  │    processNormalizationBatch(batchSize from config or 150)
  │    collected_data pending → processed/error
  └─ DataHub fetch (every 2 min) — unrelated to backlog drain

Separate PM2: telegram-processor (env: TELEGRAM_PROCESSOR_BATCH_SIZE, INTERVAL)
  └─ AI/NLP on collector side — not the same as engine transfer/normalization
```

### Knob inventory

| Knob | Current value | Runtime adjustable? | Where | Risk |
|------|---------------|---------------------|-------|------|
| Transfer batch size | **700** | **No** — hardcoded in `scheduler.js:255` | `TELEGRAM_TRANSFER_DEFAULT_BATCH` constant | ↑ DB write load, duplicate risk low (advisory lock) |
| Transfer interval | **5 min** | **Partial** — `scheduler.config.telegramPipeline.interval` + `updateConfig` restarts interval | env `TELEGRAM_PIPELINE_INTERVAL_MS` | ↑ Telegram/API pressure if intake also high |
| Normalization batch | **150** | **Partial** — `config.normalization.batchSize` if scheduler restarted | `NORMALIZATION_DEFAULT_BATCH` | ↑ CPU; errors if validation spikes |
| Normalization interval | **1 min** | **Partial** — same as above | `scheduler.config.normalization.interval` | Low alone |
| Normalization sub-batch TX | 25 | Code constant | `NORMALIZATION_SUB_BATCH` | Requires deploy |
| Transfer sub-batch TX | 100 | Code constant | `TELEGRAM_TRANSFER_SUB_BATCH` | Requires deploy |
| Collector processor batch | 150 / 15s | **No** — env at PM2 start | `TELEGRAM_PROCESSOR_*` | Rate limits, flood waits |
| Pipeline backlog metric timeout | 12s | env | `PIPELINE_BACKLOG_METRIC_TIMEOUT_MS` | UI partial metrics only |
| DataHub fetch interval | 2 min | Partial via scheduler API (`dataHub` section allowed) | `DATAHUB_FETCH_INTERVAL_MS` | Not backlog drain |
| Engine worker leader idle gate | active users | No runtime API | `engineWorkerLeader.js` | Workers may idle despite backlog |
| PM2 process count | 2× backend cluster | PM2 reload | ops | Memory/CPU |

### Existing scheduler API (`/api/v1/scheduler`)

| Endpoint | RBAC | Pipeline sections? |
|----------|------|-------------------|
| `GET /status`, `GET /config` | authenticated | Returns full config including `telegramPipeline`, `normalization` |
| `PUT /config/:section` | admin, trader | **Blocked:** only `agents|dataHub|training|analytics|artemis` — **NOT** `telegramPipeline` or `normalization` |

**Gap:** `scheduler.updateConfig()` internally supports restarting `telegramPipeline` and `normalization` schedulers, but HTTP API explicitly rejects those sections.

### In-memory observability (not exposed)

| Worker | Stats | API |
|--------|-------|-----|
| Normalization | `getNormalizationWorkerStats()` — last run only | **None** |
| Transfer | in-run summary logged | **None** |

### Answers to operator questions

| Question | Answer |
|----------|--------|
| Can capacity increase at runtime? | **Partially** — normalization interval/batch via scheduler object if API extended; transfer batch **requires code/env + PM2 reload** today |
| Safe without restart? | **Only normalization interval/batch** (if API fixed) — transfer batch is compile-time constant in scheduler call |
| Rate-limit / DB overload risk | ↑ transfer batch/interval → DB inserts + pending queue; ↑ normalization → CPU + validation errors; collector processor separate |
| Duplicate processing risk | Mitigated by pg advisory locks (transfer 8392741, normalization 8392742) |

---

## Phase 5 — Product design: Pipeline Capacity panel

### P1 (this task): Read-only, honest

**Name:** Pipeline Capacity  
**Placement:** Data Pipeline tab — right column below Source Quality Board or new row under Transfer Health

**Read-only fields (all from existing or new read APIs):**

| Field | Source |
|-------|--------|
| Transfer batch / interval | Constants + `GET /scheduler/config` |
| Normalization batch / interval | `GET /scheduler/config` |
| Processing rate | Already in Telegram Transfer Health / backlog |
| Backlog | Already in Transfer Health |
| Estimated catch-up | Already derived |
| Last transfer run | **P2** — needs worker stats endpoint |
| Last normalization run | **P2** — `getNormalizationWorkerStats()` |
| Safety status | Derived: backlog high + rate low → Warning |

**Banner (required):**

> Throughput tuning is **config-only** today. Changing transfer batch requires deploy/PM2 reload. Mode presets are planned for P2.

**No buttons** in P1 unless wired to real backend.

### P2 (backlog): Runtime mode presets

`POST /api/v1/data-sources/pipeline/capacity/mode`

| Mode | Maps to |
|------|---------|
| `balanced` | transfer 700 / 5min · norm 150 / 1min |
| `high_throughput` | transfer 900 / 3min · norm 200 / 45s |
| `recovery` | transfer 500 / 5min · norm 100 / 2min (protect DB) |

Requirements:
- `confirm_capacity_change: true`
- admin RBAC only
- audit log row (new table or `data_hub_logs` event)
- Extend `PUT /scheduler/config/:section` to allow `telegramPipeline`, `normalization`
- Fix transfer scheduler to read `config.telegramPipeline.batchSize`
- Presets stored in `scheduler_config` or new `pipeline_capacity_modes` table

---

## Phase 6 — Implementation rules (for follow-up task)

**Do not implement in RCA phase.** When implementing:

1. Normalization: lazy endpoint + unavailable states + tests for no fake zero
2. Capacity: read-only panel first; POST only after preset mapping exists
3. Never show `0` when `meta.loaded !== true`
4. Follow `DESIGN_SYSTEM_DATAHUB.md` — `MetricCard`, `StatusPill`, `DataHubAlert`, `safeT`

---

## Phase 8 — Verification checklist (for implementation task)

### Backend
- [ ] `GET /pipeline/normalization-summary` p95 < 500ms (cached)
- [ ] No fake zeros in response when skipped
- [ ] `GET /pipeline/capacity` read-only (or reuse scheduler config)
- [ ] RBAC tests if POST added (P2)

### Frontend
- [ ] Normalization section: loading / unavailable / loaded states
- [ ] Capacity panel: config-only banner, no dead buttons
- [ ] Transfer Health + Source Quality Board regression

### Runtime
- [ ] PM2 reload after backend deploy
- [ ] Browser: Data Pipeline tab — no raw keys, no fake zeros

---

## Final verdict (this RCA task)

| Criterion | Status |
|-----------|--------|
| RCA documented | ✅ |
| DB evidence | ✅ |
| API evidence | ✅ |
| Product decision | ✅ Option A (keep + lazy load) + read-only capacity |
| Implementation | ❌ Not started — **do not claim REAL WORKING** |
| Browser QA | N/A for RCA-only |
| npm run build | N/A for RCA-only |

**Suggested follow-up task ID:** `DH-DATA-PIPELINE-PX-NORMALIZATION-SUMMARY-AND-CAPACITY-IMPLEMENT`  
**Suggested commit (implementation):** `fix(datahub): repair pipeline normalization summary and add capacity visibility`

---

## Appendix — Key file references

| Area | Path |
|------|------|
| UI render | `components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx` |
| API client | `services/dataPipelineApi.ts` |
| React Query | `hooks/useDataHubState.ts` |
| Backend view | `backend/services/dataPipelineSnapshot.js` |
| Route | `backend/routes/data-sources.js` |
| Scheduler | `backend/engine/scheduler.js`, `backend/routes/scheduler.js` |
| Workers | `backend/services/telegramPipeline.js`, `backend/services/normalizationWorker.js` |
