# DH-PERFORMANCE-P2-VERIFY

Date: 2026-06-18

Mode: implementation + verify

Scope: DataHub performance only. Telegram Publisher redesign was not changed.

## 1. Baseline

Baseline was captured before code changes in `docs/ssot_v3/DH-PERFORMANCE-P2-BASELINE.md`.

| Endpoint | Baseline latency | Response size | Result |
|---|---:|---:|---|
| `GET /api/v1/data-sources/health` | 2,617 ms | 367 B | Missed `< 300ms` |
| `GET /api/v1/data-sources/stats` | 24 ms | 92 B | Passed `< 50ms` |
| `GET /api/v1/data-sources/pipeline` | 87,614 ms | 32,509 B | Missed `< 5s` |
| `GET /api/v1/data-hub/automation/topics` | 107,302 ms | 1,843 B | Missed `< 500ms` |
| `GET /api/v1/data-hub/crawlers` | 1,677 ms | 3,771 B | Missed `< 500ms` |

Top slow queries at baseline:

- Category screening correlated `COUNT(*)` subqueries against `collected_data`: up to 107,791 ms.
- Normalization summary `COUNT(*) FILTER` scan over `collected_data`: up to 83,540 ms.
- Source quality board `DISTINCT ON (source_id)` latest-record query over `collected_data`: up to 44,352 ms.
- Hourly pipeline history aggregate over effective ingestion timestamp: up to 22,968 ms.
- Recent preview ordered by `processed_at` / ingestion timestamp: up to 14,731 ms.
- Duplicate URL enrichment grouped counts over `collected_data`: up to 4,172 ms.

## 2. Changes

Implemented:

- Split `buildDataPipelineView()` into lightweight default sections and opt-in heavy sections.
- Added pipeline flags: `includeCategoryScreening`, `includeNormalizationSummary`, `includeDuplicateAnalysis`, `includeTelegramBacklog`, `includeRecentPreview`.
- Removed `collected_data` full scans from default pipeline health cards.
- Replaced pipeline source quality board dependency on latest `collected_data` `DISTINCT ON` with source/log metadata.
- Removed `collected_data` collector stats from default Telegram collector enrichment in pipeline fast path.
- Replaced category screening correlated subqueries with a single grouped aggregate behind `includeCategoryScreening`.
- Moved normalization summary behind `includeNormalizationSummary` and restricted the optimized path to recent data.
- Moved duplicate analysis behind `includeDuplicateAnalysis`; crawler list default no longer computes duplicate enrichment.
- Replaced `/data-sources/health` with a lightweight source/collector/publisher/queue health response.
- Replaced `/data-sources/stats` full log counts with source counts plus an estimated log total.
- Removed `buildDataPipelineView()` from `/data-hub/automation/topics`; topic stats now come from queue/execution aggregates only.
- Added Redis-preferred, stale-while-refresh cache for pipeline and duplicate analysis.
- Added `PIPELINE_TIMING` logs for major sections.

## 3. Timings Before

| Endpoint | Before |
|---|---:|
| `GET /api/v1/data-sources/health` | 2,617 ms |
| `GET /api/v1/data-sources/stats` | 24 ms |
| `GET /api/v1/data-sources/pipeline` | 87,614 ms |
| `GET /api/v1/data-hub/automation/topics` | 107,302 ms |
| `GET /api/v1/data-hub/crawlers` | 1,677 ms |

## 4. Timings After

Measured after backend restart.

| Endpoint | After | Target | Verdict |
|---|---:|---:|---|
| `GET /api/v1/data-sources/health` | 42-79 ms stable | `< 300ms` | PASS |
| `GET /api/v1/data-sources/stats` | 22-42 ms stable | `< 50ms` | PASS |
| `GET /api/v1/data-sources/pipeline` | 49-176 ms final fast path | `< 5s` | PASS |
| `GET /api/v1/data-hub/automation/topics` | 22-49 ms final | `< 500ms` | PASS |
| `GET /api/v1/data-hub/crawlers` | 24-28 ms final | `< 500ms` | PASS |

Initial post-change run showed `/pipeline` at 6,750 ms because Redis cold connection was awaited on the request path. Cache was corrected so Redis read is used only when already available and Redis write happens in the background. A later repeated run exposed `collector_enrichment` as another miss-path bottleneck; default pipeline enrichment now skips `collected_data` collector stats unless Telegram backlog is explicitly requested.

Observed `PIPELINE_TIMING` evidence:

- `health_cards`: 4-9 ms
- `source_quality_board`: 7-109 ms
- `history`: 0 ms
- `collector_enrichment`: removed from the full-scan path by skipping collected stats in fast mode

## 5. Cache Behavior

- Cache keys include section flags so lightweight and heavy snapshots do not collide.
- TTL is 45 seconds for pipeline snapshots and 60 seconds for duplicate analysis.
- Expired memory entries are served stale while a refresh runs in the background.
- Redis is preferred when the client is already open; cold Redis connection no longer blocks UI responses.
- `Map` values used by duplicate enrichment are kept in memory cache only, avoiding unsafe JSON round-trips.
- Duplicate dashboard/enrichment cache is bypassed under `NODE_ENV=test` to keep unit tests isolated.

## 6. Regression Results

Runtime API regression checks:

| Area | Endpoint | Status | Latency |
|---|---|---:|---:|
| Data Sources | `GET /api/v1/data-sources?page=1&limit=5` | 200 | 1,692 ms |
| Pipeline | `GET /api/v1/data-sources/pipeline` | 200 | 49-176 ms final fast path |
| Automation | `GET /api/v1/data-hub/automation/topics` | 200 | 28 ms |
| Automation | `GET /api/v1/data-hub/automation/queue` | 200 | 26 ms |
| Access Control | `GET /api/v1/data-hub/access-control` | 200 | 29 ms |
| Access Control | `GET /api/v1/data-hub/access-control/agents/registry` | 200 | 30 ms |
| Blacklist/Whitelist | `GET /api/v1/data-hub/filter-rules` | 200 | 27 ms |
| Telegram Collector | `GET /api/v1/data-sources/telegram-account-metrics` | 200 | 500 ms |
| Smart Prioritization | `GET /api/v1/data-hub/prioritization/settings` | 200 | 25 ms |
| Smart Prioritization | `GET /api/v1/data-hub/prioritization/sources` | 200 | 38 ms |

Focused unit test status: **PASS** (`6/6` suites, `26/26` tests)

- `pipelineSnapshotCache.test.js`
- `dataPipeline.test.js`
- `datahubAutomationFilterRules.test.js`
- `datahubAutomationAccessGateway.test.js`
- `datahubCrawlersSync.test.js`
- `dataSourceUrlDuplicate.test.js`

## 7. Remaining Bottlenecks

- `GET /api/v1/data-sources?page=1&limit=5` remains slower than ideal because the Data Sources list still performs duplicate enrichment by default. It is outside the P2 target list, but should be considered for a follow-up list-page optimization.
- `Telegram Collector` metrics can still reach ~500 ms. It remained 200 and was not part of the required P2 latency targets.
- Heavy opt-in pipeline sections can still be expensive on first rebuild, but they are now behind explicit flags and stale/cache behavior.

## Final Verdict

**PASS**

All required P2 latency targets were met after the cache correction and runtime regression APIs returned 200.

# DH-PERFORMANCE-P2-VERIFY

Date: 2026-06-18

Mode: implementation + verify

Scope: DataHub performance only. Telegram Publisher redesign was not changed.

## 1. Baseline

Baseline was captured before code changes in `docs/ssot_v3/DH-PERFORMANCE-P2-BASELINE.md`.

| Endpoint | Baseline latency | Response size | Result |
|---|---:|---:|---|
| `GET /api/v1/data-sources/health` | 2,617 ms | 367 B | Missed `< 300ms` |
| `GET /api/v1/data-sources/stats` | 24 ms | 92 B | Passed `< 50ms` |
| `GET /api/v1/data-sources/pipeline` | 87,614 ms | 32,509 B | Missed `< 5s` |
| `GET /api/v1/data-hub/automation/topics` | 107,302 ms | 1,843 B | Missed `< 500ms` |
| `GET /api/v1/data-hub/crawlers` | 1,677 ms | 3,771 B | Missed `< 500ms` |

Top slow queries at baseline:

- Category screening correlated `COUNT(*)` subqueries against `collected_data`: up to 107,791 ms.
- Normalization summary `COUNT(*) FILTER` scan over `collected_data`: up to 83,540 ms.
- Source quality board `DISTINCT ON (source_id)` latest-record query over `collected_data`: up to 44,352 ms.
- Hourly pipeline history aggregate over effective ingestion timestamp: up to 22,968 ms.
- Recent preview ordered by `processed_at` / ingestion timestamp: up to 14,731 ms.
- Duplicate URL enrichment grouped counts over `collected_data`: up to 4,172 ms.

## 2. Changes

Implemented:

- Split `buildDataPipelineView()` into lightweight default sections and opt-in heavy sections.
- Added pipeline flags: `includeCategoryScreening`, `includeNormalizationSummary`, `includeDuplicateAnalysis`, `includeTelegramBacklog`, `includeRecentPreview`.
- Removed `collected_data` full scans from default pipeline health cards.
- Replaced pipeline source quality board dependency on latest `collected_data` `DISTINCT ON` with source/log metadata.
- Removed `collected_data` collector stats from default Telegram collector enrichment in pipeline fast path.
- Replaced category screening correlated subqueries with a single grouped aggregate behind `includeCategoryScreening`.
- Moved normalization summary behind `includeNormalizationSummary` and restricted the optimized path to recent data.
- Moved duplicate analysis behind `includeDuplicateAnalysis`; crawler list default no longer computes duplicate enrichment.
- Replaced `/data-sources/health` with a lightweight source/collector/publisher/queue health response.
- Replaced `/data-sources/stats` full log counts with source counts plus an estimated log total.
- Removed `buildDataPipelineView()` from `/data-hub/automation/topics`; topic stats now come from queue/execution aggregates only.
- Added Redis-preferred, stale-while-refresh cache for pipeline and duplicate analysis.
- Added `PIPELINE_TIMING` logs for major sections.

## 3. Timings Before

| Endpoint | Before |
|---|---:|
| `GET /api/v1/data-sources/health` | 2,617 ms |
| `GET /api/v1/data-sources/stats` | 24 ms |
| `GET /api/v1/data-sources/pipeline` | 87,614 ms |
| `GET /api/v1/data-hub/automation/topics` | 107,302 ms |
| `GET /api/v1/data-hub/crawlers` | 1,677 ms |

## 4. Timings After

Measured after backend restart.

| Endpoint | After | Target | Verdict |
|---|---:|---:|---|
| `GET /api/v1/data-sources/health` | 42-79 ms stable | `< 300ms` | PASS |
| `GET /api/v1/data-sources/stats` | 22-42 ms stable | `< 50ms` | PASS |
| `GET /api/v1/data-sources/pipeline` | 49-176 ms final fast path | `< 5s` | PASS |
| `GET /api/v1/data-hub/automation/topics` | 22-49 ms final | `< 500ms` | PASS |
| `GET /api/v1/data-hub/crawlers` | 24-28 ms final | `< 500ms` | PASS |

Initial post-change run showed `/pipeline` at 6,750 ms because Redis cold connection was awaited on the request path. Cache was corrected so Redis read is used only when already available and Redis write happens in the background. A later repeated run exposed `collector_enrichment` as another miss-path bottleneck; default pipeline enrichment now skips `collected_data` collector stats unless Telegram backlog is explicitly requested.

Observed `PIPELINE_TIMING` evidence:

- `health_cards`: 4-9 ms
- `source_quality_board`: 7-109 ms
- `history`: 0 ms
- `collector_enrichment`: removed from the full-scan path by skipping collected stats in fast mode

## 5. Cache Behavior

- Cache keys include section flags so lightweight and heavy snapshots do not collide.
- TTL is 45 seconds for pipeline snapshots and 60 seconds for duplicate analysis.
- Expired memory entries are served stale while a refresh runs in the background.
- Redis is preferred when the client is already open; cold Redis connection no longer blocks UI responses.
- `Map` values used by duplicate enrichment are kept in memory cache only, avoiding unsafe JSON round-trips.
- Duplicate dashboard/enrichment cache is bypassed under `NODE_ENV=test` to keep unit tests isolated.

## 6. Regression Results

Runtime API regression checks:

| Area | Endpoint | Status | Latency |
|---|---|---:|---:|
| Data Sources | `GET /api/v1/data-sources?page=1&limit=5` | 200 | 1,692 ms |
| Pipeline | `GET /api/v1/data-sources/pipeline` | 200 | 49-176 ms final fast path |
| Automation | `GET /api/v1/data-hub/automation/topics` | 200 | 28 ms |
| Automation | `GET /api/v1/data-hub/automation/queue` | 200 | 26 ms |
| Access Control | `GET /api/v1/data-hub/access-control` | 200 | 29 ms |
| Access Control | `GET /api/v1/data-hub/access-control/agents/registry` | 200 | 30 ms |
| Blacklist/Whitelist | `GET /api/v1/data-hub/filter-rules` | 200 | 27 ms |
| Telegram Collector | `GET /api/v1/data-sources/telegram-account-metrics` | 200 | 500 ms |
| Smart Prioritization | `GET /api/v1/data-hub/prioritization/settings` | 200 | 25 ms |
| Smart Prioritization | `GET /api/v1/data-hub/prioritization/sources` | 200 | 38 ms |

Focused unit test status: **PASS** (`6/6` suites, `26/26` tests)

- `pipelineSnapshotCache.test.js`
- `dataPipeline.test.js`
- `datahubAutomationFilterRules.test.js`
- `datahubAutomationAccessGateway.test.js`
- `datahubCrawlersSync.test.js`
- `dataSourceUrlDuplicate.test.js`

## 7. Remaining Bottlenecks

- `GET /api/v1/data-sources?page=1&limit=5` remains slower than ideal because the Data Sources list still performs duplicate enrichment by default. It is outside the P2 target list, but should be considered for a follow-up list-page optimization.
- `Telegram Collector` metrics can still reach ~500 ms. It remained 200 and was not part of the required P2 latency targets.
- Heavy opt-in pipeline sections can still be expensive on first rebuild, but they are now behind explicit flags and stale/cache behavior.

## Final Verdict

**PASS**

All required P2 latency targets were met after the cache correction and runtime regression APIs returned 200.

