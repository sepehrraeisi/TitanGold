# DH-PERFORMANCE-P3-FINAL-VERIFY

Date: 2026-06-20

Scope: close remaining DataHub performance bottlenecks found by `DH-PERFORMANCE-P2-DEPLOY-VERIFY`.

Verdict: **PASS**

## Summary

P3 addressed the remaining production bottlenecks without redesigning the UI and without changing Telegram Publisher behavior.

Fixed areas:

- Data Sources list no longer runs heavy duplicate URL analysis or collected-data/message aggregates on the default list path.
- Pipeline backlog uses a cached lightweight path and avoids full-table backlog summary scans.
- Redis cache connection now handles the current deployed Redis mode and persists `pipeline:*` keys.
- Browser DataHub summary rendered without the `Could not load DataHub summary metrics` banner.

## Changes Applied

### Data Sources List

Route:

```text
GET /api/v1/data-sources?page=1&limit=20
GET /api/v1/data-sources?page=1&limit=100
```

Optimizations:

- Replaced default duplicate enrichment with `buildDuplicateEnrichmentBySourceIdLightweight()`.
- Avoided `collected_data` scan from duplicate enrichment on the default list.
- Called `batchTelegramCollectorEnrichment()` with:
  - `includeMessageStats: false`
  - `includeCollectedStats: false`
- Ran count, page query, category lookup, and lightweight duplicate lookup in parallel.

Result: default list path no longer performs per-list heavy collected-data/message aggregation.

### Pipeline Backlog

Route:

```text
GET /api/v1/data-sources/pipeline/backlog
```

Optimizations:

- Added `pipeline:backlog` cache via `getOrLoadCached()`.
- Replaced global unprocessed Telegram backlog `COUNT/MIN/MAX` full scan with:
  - estimated unprocessed count from the partial index reltuples
  - oldest queued lookup via indexed `ORDER BY ... ASC LIMIT 1`
  - newest queued lookup via indexed `ORDER BY ... DESC LIMIT 1`

Result: backlog response is now consistently below 1s.

### Redis

Problem:

```text
PIPELINE_CACHE_REDIS_WRITE_SKIPPED
Max reconnection attempts reached
```

Root cause:

- Backend env had Redis credentials configured.
- The running local Redis accepted unauthenticated connections.
- Node Redis repeatedly sent `AUTH`, causing reconnect exhaustion.

Fix:

- Redis client now probes unauthenticated Redis when env credentials are present.
- If the server accepts unauthenticated local connections, backend connects without password.
- Secured Redis deployments still use the configured password path.

## Nginx Endpoint Measurements

All measurements were through `https://titan.zala.ir/api/...` with a live deployed session token. Each endpoint was run 5 times.

| Endpoint | Statuses | Min | Max | Average | Target |
|---|---|---:|---:|---:|---:|
| `/api/v1/data-sources/health` | 200 x5 | 52.42 ms | 92.23 ms | 68.83 ms | pass |
| `/api/v1/data-sources/stats` | 200 x5 | 52.41 ms | 79.78 ms | 63.86 ms | pass |
| `/api/v1/data-sources/pipeline` | 200 x5 | 50.59 ms | 68.98 ms | 58.35 ms | pass |
| `/api/v1/data-hub/automation/topics` | 200 x5 | 53.98 ms | 76.23 ms | 63.06 ms | pass |
| `/api/v1/data-hub/crawlers` | 200 x5 | 56.63 ms | 70.11 ms | 62.95 ms | pass |
| `/api/v1/data-sources?page=1&limit=20` | 200 x5 | 69.51 ms | 113.84 ms | 87.11 ms | `< 500ms` |
| `/api/v1/data-sources?page=1&limit=100` | 200 x5 | 77.24 ms | 126.37 ms | 92.30 ms | `< 500ms` |
| `/api/v1/data-sources/pipeline/backlog` | 200 x5 | 50.53 ms | 63.57 ms | 58.02 ms | `< 1s` |

## Redis Verification

Redis startup after fix:

```text
Redis: Connected
Redis: Ready
Redis client connected and ready
```

Pipeline keys persisted:

```text
pipeline:backlog
pipeline:view:includeTelegramBacklog:0|includeCategoryScreening:0|includeNormalizationSummary:0|includeDuplicateAnalysis:0|includeRecentPreview:0
```

Redis hit proof after memory reset:

```text
before: keyspace_hits=6, keyspace_misses=14
after:  keyspace_hits=8, keyspace_misses=14
delta:  keyspace_hits +2, keyspace_misses +0
```

The proof was taken after restarting backend to clear in-process memory cache while preserving Redis keys, then calling:

```text
/api/v1/data-sources/pipeline
/api/v1/data-sources/pipeline/backlog
```

Result: Redis cache is operational and serving persisted `pipeline:*` keys.

## Browser Summary Verification

Browser path:

```text
https://titan.zala.ir/?view=ai
AI -> Manager -> Data Hub
```

Observed:

- DataHub became visible in ~597 ms.
- `Could not load DataHub summary metrics`: not present.
- DataHub summary banner failure: false.
- DataHub API 5xx/failures: none observed.

Browser resource timings:

| Resource | Duration |
|---|---:|
| `/api/v1/data-sources?page=1&limit=20` | 441 ms |
| `/api/v1/data-sources/health` | 395 ms |
| `/api/v1/data-sources/stats` | 394 ms |

## N+1 And Slow Query Check

Requested target endpoints did not show new N+1 patterns after the optimization:

- `health`
- `stats`
- default `pipeline`
- `automation/topics`
- `crawlers`
- Data Sources list
- Pipeline backlog

The previous slow list-path collected-data duplicate enrichment and collector count path were removed from default Data Sources list rendering.

## Final Verdict

**PASS**

PASS criteria:

- Data Sources list `< 500ms`: **PASS**
- Pipeline backlog `< 1s`: **PASS**
- Redis cache operational: **PASS**
- `keyspace_hits` increasing: **PASS**
- `pipeline:*` keys exist: **PASS**
- No summary metric failure banner: **PASS**

# DH-PERFORMANCE-P3-FINAL-VERIFY

Date: 2026-06-20

Scope: close remaining DataHub performance bottlenecks found by `DH-PERFORMANCE-P2-DEPLOY-VERIFY`.

Verdict: **PASS**

## Summary

P3 addressed the remaining production bottlenecks without redesigning the UI and without changing Telegram Publisher behavior.

Fixed areas:

- Data Sources list no longer runs heavy duplicate URL analysis or collected-data/message aggregates on the default list path.
- Pipeline backlog uses a cached lightweight path and avoids full-table backlog summary scans.
- Redis cache connection now handles the current deployed Redis mode and persists `pipeline:*` keys.
- Browser DataHub summary rendered without the `Could not load DataHub summary metrics` banner.

## Changes Applied

### Data Sources List

Route:

```text
GET /api/v1/data-sources?page=1&limit=20
GET /api/v1/data-sources?page=1&limit=100
```

Optimizations:

- Replaced default duplicate enrichment with `buildDuplicateEnrichmentBySourceIdLightweight()`.
- Avoided `collected_data` scan from duplicate enrichment on the default list.
- Called `batchTelegramCollectorEnrichment()` with:
  - `includeMessageStats: false`
  - `includeCollectedStats: false`
- Ran count, page query, category lookup, and lightweight duplicate lookup in parallel.

Result: default list path no longer performs per-list heavy collected-data/message aggregation.

### Pipeline Backlog

Route:

```text
GET /api/v1/data-sources/pipeline/backlog
```

Optimizations:

- Added `pipeline:backlog` cache via `getOrLoadCached()`.
- Replaced global unprocessed Telegram backlog `COUNT/MIN/MAX` full scan with:
  - estimated unprocessed count from the partial index reltuples
  - oldest queued lookup via indexed `ORDER BY ... ASC LIMIT 1`
  - newest queued lookup via indexed `ORDER BY ... DESC LIMIT 1`

Result: backlog response is now consistently below 1s.

### Redis

Problem:

```text
PIPELINE_CACHE_REDIS_WRITE_SKIPPED
Max reconnection attempts reached
```

Root cause:

- Backend env had Redis credentials configured.
- The running local Redis accepted unauthenticated connections.
- Node Redis repeatedly sent `AUTH`, causing reconnect exhaustion.

Fix:

- Redis client now probes unauthenticated Redis when env credentials are present.
- If the server accepts unauthenticated local connections, backend connects without password.
- Secured Redis deployments still use the configured password path.

## Nginx Endpoint Measurements

All measurements were through `https://titan.zala.ir/api/...` with a live deployed session token. Each endpoint was run 5 times.

| Endpoint | Statuses | Min | Max | Average | Target |
|---|---|---:|---:|---:|---:|
| `/api/v1/data-sources/health` | 200 x5 | 52.42 ms | 92.23 ms | 68.83 ms | pass |
| `/api/v1/data-sources/stats` | 200 x5 | 52.41 ms | 79.78 ms | 63.86 ms | pass |
| `/api/v1/data-sources/pipeline` | 200 x5 | 50.59 ms | 68.98 ms | 58.35 ms | pass |
| `/api/v1/data-hub/automation/topics` | 200 x5 | 53.98 ms | 76.23 ms | 63.06 ms | pass |
| `/api/v1/data-hub/crawlers` | 200 x5 | 56.63 ms | 70.11 ms | 62.95 ms | pass |
| `/api/v1/data-sources?page=1&limit=20` | 200 x5 | 69.51 ms | 113.84 ms | 87.11 ms | `< 500ms` |
| `/api/v1/data-sources?page=1&limit=100` | 200 x5 | 77.24 ms | 126.37 ms | 92.30 ms | `< 500ms` |
| `/api/v1/data-sources/pipeline/backlog` | 200 x5 | 50.53 ms | 63.57 ms | 58.02 ms | `< 1s` |

## Redis Verification

Redis startup after fix:

```text
Redis: Connected
Redis: Ready
Redis client connected and ready
```

Pipeline keys persisted:

```text
pipeline:backlog
pipeline:view:includeTelegramBacklog:0|includeCategoryScreening:0|includeNormalizationSummary:0|includeDuplicateAnalysis:0|includeRecentPreview:0
```

Redis hit proof after memory reset:

```text
before: keyspace_hits=6, keyspace_misses=14
after:  keyspace_hits=8, keyspace_misses=14
delta:  keyspace_hits +2, keyspace_misses +0
```

The proof was taken after restarting backend to clear in-process memory cache while preserving Redis keys, then calling:

```text
/api/v1/data-sources/pipeline
/api/v1/data-sources/pipeline/backlog
```

Result: Redis cache is operational and serving persisted `pipeline:*` keys.

## Browser Summary Verification

Browser path:

```text
https://titan.zala.ir/?view=ai
AI -> Manager -> Data Hub
```

Observed:

- DataHub became visible in ~597 ms.
- `Could not load DataHub summary metrics`: not present.
- DataHub summary banner failure: false.
- DataHub API 5xx/failures: none observed.

Browser resource timings:

| Resource | Duration |
|---|---:|
| `/api/v1/data-sources?page=1&limit=20` | 441 ms |
| `/api/v1/data-sources/health` | 395 ms |
| `/api/v1/data-sources/stats` | 394 ms |

## N+1 And Slow Query Check

Requested target endpoints did not show new N+1 patterns after the optimization:

- `health`
- `stats`
- default `pipeline`
- `automation/topics`
- `crawlers`
- Data Sources list
- Pipeline backlog

The previous slow list-path collected-data duplicate enrichment and collector count path were removed from default Data Sources list rendering.

## Final Verdict

**PASS**

PASS criteria:

- Data Sources list `< 500ms`: **PASS**
- Pipeline backlog `< 1s`: **PASS**
- Redis cache operational: **PASS**
- `keyspace_hits` increasing: **PASS**
- `pipeline:*` keys exist: **PASS**
- No summary metric failure banner: **PASS**

