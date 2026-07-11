# DH-PERFORMANCE-P2-BASELINE

Date: 2026-06-18

Mode: pre-change baseline for `DH-PERFORMANCE-P2-HOTFIX`

No code or database changes were made before this baseline.

## Endpoint Baseline

Measured directly against backend `http://localhost:5002` using an existing active session token.

| Endpoint | Status | Latency | Response size | Estimated DB query count | Notes |
|---|---:|---:|---:|---:|---|
| `GET /api/v1/data-sources/health` | 200 | 2,617 ms | 367 B | ~5 | Includes duplicate URL summary path. |
| `GET /api/v1/data-sources/stats` | 200 | 24 ms | 92 B | 1 | Fast. |
| `GET /api/v1/data-sources/pipeline` | 200 | 87,614 ms | 32,509 B | 10+ | Full `buildDataPipelineView()` aggregate path. |
| `GET /api/v1/data-hub/automation/topics` | 200 | 107,302 ms | 1,843 B | 11+ | Calls `buildDataPipelineView()` just to compute topic stats. |
| `GET /api/v1/data-hub/crawlers` | 200 | 1,677 ms | 3,771 B | 6+ | Calls crawler sync + duplicate URL enrichment. |

## Slow Query Evidence

Recent slow log excerpts around the baseline run:

| Duration | Query summary |
|---:|---|
| 107,791 ms | Category screening with correlated `COUNT(*)` subqueries against `collected_data` and `data_sources`. |
| 83,540 ms | Normalization summary `COUNT(*) FILTER` scan over `collected_data`. |
| 44,352 ms | Source quality board latest-record query using `DISTINCT ON (source_id)` over `collected_data`. |
| 22,968 ms | Pipeline history hourly aggregate over effective ingestion timestamp. |
| 14,731 ms | Recent preview ordered by `processed_at` and ingestion timestamp. |
| 8,399 ms | 24h stats aggregate over `collected_data`. |
| 5,835 ms | Total records/normalized count scan over `collected_data`. |
| 4,172 ms | Duplicate URL/source stats count grouped by source. |
| 2,903 ms | Health metrics query including `collected_data` counts. |
| 2,016 ms | Duplicate URL dashboard source stats query. |

## Baseline Section Mapping

`GET /api/v1/data-sources/pipeline` currently loads:

- health cards / 24h stats
- source quality board
- category screening
- normalization summary
- recent preview
- hourly pipeline history
- Telegram collector enrichment
- optional Telegram backlog only when `includeBacklog=true`

`GET /api/v1/data-sources/health` currently loads:

- database ping
- active source count
- 1h log/ingestion/normalization/Telegram counts
- duplicate URL dashboard summary

`GET /api/v1/data-hub/automation/topics` currently loads:

- topic rows
- full pipeline snapshot to compute category stats

`GET /api/v1/data-hub/crawlers` currently loads:

- sync from data sources
- crawler rows
- crawler run metrics
- duplicate URL enrichment

## Baseline Verdict

Baseline status: **DEGRADED**

Targets missed:

- `health < 300ms` missed by ~8.7x.
- `pipeline < 5s` missed by ~17.5x.
- `automation/topics < 500ms` missed by ~214x.
- `crawlers < 500ms` missed by ~3.4x.

# DH-PERFORMANCE-P2-BASELINE

Date: 2026-06-18

Mode: pre-change baseline for `DH-PERFORMANCE-P2-HOTFIX`

No code or database changes were made before this baseline.

## Endpoint Baseline

Measured directly against backend `http://localhost:5002` using an existing active session token.

| Endpoint | Status | Latency | Response size | Estimated DB query count | Notes |
|---|---:|---:|---:|---:|---|
| `GET /api/v1/data-sources/health` | 200 | 2,617 ms | 367 B | ~5 | Includes duplicate URL summary path. |
| `GET /api/v1/data-sources/stats` | 200 | 24 ms | 92 B | 1 | Fast. |
| `GET /api/v1/data-sources/pipeline` | 200 | 87,614 ms | 32,509 B | 10+ | Full `buildDataPipelineView()` aggregate path. |
| `GET /api/v1/data-hub/automation/topics` | 200 | 107,302 ms | 1,843 B | 11+ | Calls `buildDataPipelineView()` just to compute topic stats. |
| `GET /api/v1/data-hub/crawlers` | 200 | 1,677 ms | 3,771 B | 6+ | Calls crawler sync + duplicate URL enrichment. |

## Slow Query Evidence

Recent slow log excerpts around the baseline run:

| Duration | Query summary |
|---:|---|
| 107,791 ms | Category screening with correlated `COUNT(*)` subqueries against `collected_data` and `data_sources`. |
| 83,540 ms | Normalization summary `COUNT(*) FILTER` scan over `collected_data`. |
| 44,352 ms | Source quality board latest-record query using `DISTINCT ON (source_id)` over `collected_data`. |
| 22,968 ms | Pipeline history hourly aggregate over effective ingestion timestamp. |
| 14,731 ms | Recent preview ordered by `processed_at` and ingestion timestamp. |
| 8,399 ms | 24h stats aggregate over `collected_data`. |
| 5,835 ms | Total records/normalized count scan over `collected_data`. |
| 4,172 ms | Duplicate URL/source stats count grouped by source. |
| 2,903 ms | Health metrics query including `collected_data` counts. |
| 2,016 ms | Duplicate URL dashboard source stats query. |

## Baseline Section Mapping

`GET /api/v1/data-sources/pipeline` currently loads:

- health cards / 24h stats
- source quality board
- category screening
- normalization summary
- recent preview
- hourly pipeline history
- Telegram collector enrichment
- optional Telegram backlog only when `includeBacklog=true`

`GET /api/v1/data-sources/health` currently loads:

- database ping
- active source count
- 1h log/ingestion/normalization/Telegram counts
- duplicate URL dashboard summary

`GET /api/v1/data-hub/automation/topics` currently loads:

- topic rows
- full pipeline snapshot to compute category stats

`GET /api/v1/data-hub/crawlers` currently loads:

- sync from data sources
- crawler rows
- crawler run metrics
- duplicate URL enrichment

## Baseline Verdict

Baseline status: **DEGRADED**

Targets missed:

- `health < 300ms` missed by ~8.7x.
- `pipeline < 5s` missed by ~17.5x.
- `automation/topics < 500ms` missed by ~214x.
- `crawlers < 500ms` missed by ~3.4x.

