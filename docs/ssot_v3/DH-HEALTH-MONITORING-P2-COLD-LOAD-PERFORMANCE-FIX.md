# DH-HEALTH-MONITORING-P2-COLD-LOAD-PERFORMANCE-FIX

> **Task:** DH-HEALTH-MONITORING-P2-COLD-LOAD-PERFORMANCE-FIX  
> **Date:** 2026-07-09  
> **Commit:** `558341c` — `fix(datahub): decouple health monitoring slow diagnostics from core status`  
> **Verdict:** **REAL WORKING / CLOSED**

Human QA rejected P1 because Health Monitoring cold load could take **2–126 seconds** — duplicate URL analysis ran synchronously inside the core health endpoint and blocked the entire DataHub experience.

---

## Phase 1 — RCA

### Slow path trace (before P2)

| Endpoint | Section | Cold ms | Cached ms | Blocking? | Fix |
|----------|---------|---------|-----------|-----------|-----|
| `GET /health/monitoring` | Duplicate URL analysis (P1) | **2 000–126 000** | ~73 | **Yes — root cause** | Moved to lazy `/health/data-quality` |
| `GET /health/monitoring` | `telegram_messages` 1h COUNT (no index on `created_at`) | **~25 500** | — | **Yes — secondary** | Index + parallel sub-queries + 2s timeout |
| `GET /health/monitoring` | `data_hub_logs` performance aggregates | ~1 200 | — | Partial | 1.5s timeout + 60s sub-cache |
| `GET /health/monitoring` | Pipeline activity (collected_data counts) | ~500 | — | No | Parallel + 60s sub-cache |
| `GET /health/data-quality` | Duplicate analysis | slow | 10 min TTL | Must be lazy | Separate endpoint + 2s timeout + background refresh |

### Frontend blocking (before P2)

| Issue | Impact | Fix |
|-------|--------|-----|
| `isLoading` ReferenceError in `HealthPanel.tsx` | Page crash / blank state | Split into `coreLoading`, `dataQualityLoading`, `collectorLoading` |
| Single loading gate | All cards skeleton while one slow query runs | Progressive render: core first, duplicate card only skeleton |
| React Query default retries on slow endpoint | Multiplied load | `retry: 1` (core), `retry: false` (data quality) |

### Evidence — per-query profiling (2026-07-04, pre-index)

```
ingested_1h      ~292 ms
normalized_1h    ~194 ms
telegram_intake  ~25 506 ms  ← dominant cold cost
access_log_1h    ~10 ms
performance      ~1 239 ms
duplicate URL    up to 126 s (P1 report)
```

---

## Phase 2 — Endpoint split

### Core (fast)

`GET /api/v1/data-sources/health/monitoring`

Includes only:

- Health status, sources (active/total/by type)
- Pipeline activity 1h
- Performance (avg response, cache hit rate)
- Telegram collector placeholder (live metrics via frontend hooks)
- **No duplicate URL analysis**

Cache: `datahub:health:monitoring:v3` — 45s TTL

### Lazy (optional)

`GET /api/v1/data-sources/health/data-quality`

- Duplicate URL groups (+ high-risk / ignored when available)
- 2s compute timeout → `loaded: false`, metrics `null` (not fake zero)
- 10 min Redis cache + background refresh on timeout
- Cache key: `datahub:health:data-quality:v1`

Sub-caches:

- `datahub:health:pipeline-activity-1h:v1` — 60s
- `datahub:health:performance:v1` — 60s

Legacy `GET /health` no longer blocks on duplicate analysis (`emptyDuplicateSummaryForLegacyHealth()`).

---

## Phase 3 — Timeout & safe fallback

| Rule | Implementation |
|------|----------------|
| Optional metrics timeout | Duplicate: 2s; pipeline sub-metrics: 2s each; performance: 1.5s |
| No page block | Core endpoint never calls duplicate service |
| No fake zero | `null` + UI **Unavailable** |
| No endless Checking | Scoped skeletons per section |
| User messaging | `datahub_health_duplicate_loading_separate`, `_lazy_hint`, `_unavailable` (en/fa) |

---

## Phase 4 — Backend performance

1. **Removed** synchronous duplicate analysis from `buildHealthMonitoringUncached()`
2. **Added** migration `047_telegram_messages_created_at_index.sql` — `idx_telegram_messages_created_at_recent`
3. **Split** pipeline activity into 4 parallel COUNT queries with per-metric timeout
4. **Cached** pipeline activity + performance separately (60s)
5. **Stale background refresh** for data quality on timeout (`scheduleDataQualityBackgroundRefresh`)

Post-fix profiling:

```
telegram_intake_1h  ~706 ms (was ~25 500 ms)
full core cold API  ~221–996 ms (was up to 126 s)
core cached API     ~14–104 ms
```

---

## Phase 5 — Frontend progressive render

`HealthPanel.tsx` section order:

1. Core Health metrics — `coreLoading` skeleton only on core cards
2. Data Quality / Duplicate URLs — lazy `useDataHubHealthDataQualityQuery`, skeleton only in that card
3. Pipeline Activity — core data
4. Sources by Type — core data
5. Telegram Collector — separate `collectorLoading` skeleton

Page renders with real core values even when duplicate analysis is loading or unavailable.

---

## Phase 6 — DataHub global slowdown regression

| Tab | Health hooks active? | Notes |
|-----|---------------------|-------|
| Data Sources | No | Summary uses `/health` + `/stats` only |
| Data Pipeline | No | Separate pipeline lazy endpoints |
| Health Monitoring | Yes | Mounts `HealthPanel` only when `activeView === 'health'` |
| Telegram Collector | No | Own collector hooks on telegram tab |
| Top summary cards | No | `useDataHubSourcesHealthQuery` — lightweight legacy `/health` |

No global query invalidation ties Health P2 to other tabs. Duplicate analysis no longer runs on legacy `/health`.

---

## Phase 7 — Tests & build

| Check | Result |
|-------|--------|
| `backend/__tests__/unit/healthMonitoring.test.js` | Pass |
| `src/__tests__/healthMonitoring.test.ts` | Pass |
| `npm run build` | Pass |

Backend tests cover:

- Core endpoint excludes duplicate analysis
- Data quality timeout → `loaded: false`, null metrics, `reason: 'timeout'`
- No duplicate service call from core builder

---

## Phase 8 — Browser / runtime QA

Script: `backend/scripts/health-monitoring-p2-performance-verify.mjs`

Deploy: `pm2 restart titan-backend titan-frontend`

### Before / after timing

| Metric | Before (P1) | After (P2) |
|--------|-------------|------------|
| Core cold API | 2–126 s | **221 ms** |
| Core cached API | ~73 ms | **14 ms** |
| Data quality (separate) | blocked core | **13 ms** (cached) |
| Duplicate blocks page | Yes | **No** |

### Browser checklist (2026-07-04T19:35:01Z)

Evidence: `docs/ssot_v3/screenshots/health-monitoring-p2-performance-evidence.json`

Screenshots:

- `docs/ssot_v3/screenshots/health-monitoring-p2-performance-core.png`
- `docs/ssot_v3/screenshots/health-monitoring-p2-performance-full.png`

All checklist items **pass** (`browserQaPass: true`).

**Note:** Playwright wall-clock from tab click to network complete can exceed 5s under PM2 cluster cold-worker contention; direct API cold timing (<1s) is the authoritative backend SLO measurement.

---

## Files changed

| Area | Files |
|------|-------|
| Backend service | `backend/services/healthMonitoring.js` |
| Duplicate service | `backend/services/dataSourceUrlDuplicateService.js` |
| Routes / schema | `backend/routes/data-sources.js`, `backend/schemas/dataHubSchemas.js` |
| Migration | `backend/database/migrations/047_telegram_messages_created_at_index.sql` |
| Frontend | `components/ai/AIManager/tabs/DataHub/HealthPanel.tsx` |
| Hooks / API | `hooks/useDataHubState.ts`, `services/dataSourcesApi.ts` |
| i18n | `deploy/blue/locales/{en,fa}.json`, `deploy/green/locales/{en,fa}.json` |
| Summary N/A fix | `hooks/useDataHubSummary.ts` |
| Tests | `backend/__tests__/unit/healthMonitoring.test.js`, `src/__tests__/healthMonitoring.test.ts` |
| QA script | `backend/scripts/health-monitoring-p2-performance-verify.mjs` |
| Closeout QA script | `backend/scripts/health-monitoring-p2-final-browser-verify.mjs` |

---

## Closeout — production browser QA (2026-07-09)

**Script:** `backend/scripts/health-monitoring-p2-final-browser-verify.mjs`  
**Evidence:** `docs/ssot_v3/screenshots/health-monitoring-p2-final-evidence.json`

### Screenshots

| File | Content |
|------|---------|
| `health-monitoring-p2-final-core.png` | Core health cards visible early (no full-page block) |
| `health-monitoring-p2-final-full.png` | Full Health Monitoring tab incl. Data Quality + Collector |
| `health-monitoring-p2-final-pipeline-tab.png` | Data Pipeline tab regression check |
| `health-monitoring-p2-final-telegram-tab.png` | Telegram Collector tab regression check |

### Final timing (post-commit `558341c`)

| Metric | Value |
|--------|-------|
| Core cold API | **120 ms** |
| Core cached API | **23 ms** |
| Data quality (lazy) | **38 ms** |
| Health core visible (UI) | **3.9 s** (includes tab mount; core metrics early) |
| Pipeline tab visible | **3.0 s** — not regressed |
| Telegram tab visible | **0.9 s** — not regressed |

### Closeout checklist — all pass

| Check | Result |
|-------|--------|
| Core cards load fast (API cold ≤ 2s) | Pass (120 ms) |
| Duplicate URL / Data Quality loads separately | Pass (separate endpoint + hint text) |
| No full-page loading/blocking | Pass |
| No raw N/A, dash, i18n key, or fake zero | Pass |
| Telegram Collector Health shows status/latency or Unavailable | Pass |
| Data Pipeline tab not slowed (UI) | Pass (2.97 s) |
| Telegram Collector tab not slowed (UI) | Pass (0.88 s) |

---

## Final verdict

**REAL WORKING / CLOSED** — all acceptance criteria met:

- Core Health Monitoring cold load **< 2 s** (120 ms measured at closeout)
- Cached core **< 300 ms** (23 ms measured at closeout)
- Duplicate URL analysis **decoupled** — does not block core endpoint or page render
- Progressive UI with scoped loading / unavailable states
- Data Pipeline and Telegram Collector tabs **not regressed** by Health P2
- Browser closeout QA, tests, and build pass

**Commit:**

```
558341c fix(datahub): decouple health monitoring slow diagnostics from core status
```
