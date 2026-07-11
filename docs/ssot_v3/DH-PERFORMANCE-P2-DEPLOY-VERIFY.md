# DH-PERFORMANCE-P2-DEPLOY-VERIFY

Date: 2026-06-20

Mode: read-only deploy/runtime verification

Scope: deployed browser-visible runtime through nginx/TLS at `https://titan.zala.ir`.

No code changes or optimizations were performed.

## 1. Nginx Endpoint Measurements

Each endpoint was called 5 times through `https://titan.zala.ir/api/...` with a live browser-equivalent session token.

| Endpoint | Statuses | Min | Max | Average | Response size |
|---|---|---:|---:|---:|---:|
| `/api/v1/data-sources/health` | 200 x5 | 66.50 ms | 101.96 ms | 80.69 ms | 571 B |
| `/api/v1/data-sources/pipeline` | 200 x5 | 51.67 ms | 83.63 ms | 68.08 ms | 14,837 B |
| `/api/v1/data-hub/automation/topics` | 200 x5 | 51.24 ms | 101.09 ms | 64.83 ms | 1,919 B |
| `/api/v1/data-hub/crawlers` | 200 x5 | 60.26 ms | 83.90 ms | 69.82 ms | 3,095 B |

Control rerun after browser checks:

- `/api/v1/data-sources/health`: 200, 99.73 ms
- `/api/v1/data-sources/pipeline`: 200, 106.40 ms
- `/api/v1/data-hub/automation/topics`: 200, 52.99 ms
- `/api/v1/data-hub/crawlers`: 200, 72.70 ms

Endpoint verdict: **PASS** for the P2 target endpoints through nginx.

## 2. Browser Console And Network

Browser path verified:

1. `https://titan.zala.ir`
2. `AI`
3. `Manager`
4. `Data Hub`

Authentication was established with the existing deployed session in browser storage.

DataHub-specific console/network findings:

- `Could not load DataHub summary metrics`: **0 occurrences**
- DataHub fetch failures: **0**
- DataHub 5xx responses: **0**
- DataHub unhandled errors/rejections: **0**
- DataHub timeout/failed-fetch messages: **0**

Observed non-DataHub console noise:

- Repeated `Failed to fetch MEXC 24hr ticker` messages for market ticker calls. These were unrelated to DataHub endpoints and did not block DataHub rendering.

Observed DataHub browser fetches:

| Request | Status | Duration |
|---|---:|---:|
| `/api/v1/data-sources/stats` | 200 | 351-496 ms |
| `/api/v1/data-sources/health` | 200 | 502-567 ms |
| `/api/v1/data-sources/pipeline?includeBacklog=false` | 200 | 607 ms |
| `/api/v1/data-hub/crawlers` | 200 | 568 ms |
| `/api/v1/data-hub/telegram-publishers/` | 200 | 419 ms |
| `/api/v1/data-hub/automation/overview` | 200 | 422 ms |
| `/api/v1/data-hub/access-control/` | 200 | 519 ms |
| `/api/v1/data-hub/filter-rules?active_only=true` | 200 | 309 ms |

Important browser-only slow calls still observed:

| Request | Status | Duration | Note |
|---|---:|---:|---|
| `/api/v1/data-sources?page=1&limit=20` | 200 | 8,120 ms | Data Sources list still slow in UI runtime. |
| `/api/v1/data-sources?page=1&limit=100` | 200 | 4,627 ms | Advanced/crawler source lookup path. |
| `/api/v1/data-sources/pipeline/backlog` | 200 | 14,435 ms | Lazy backlog endpoint remains heavy. |

Browser console verdict: **PASS for DataHub failures**, but **PARTIAL for UI performance** because non-target DataHub-adjacent calls remain slow.

## 3. DataHub Rendering And Tab Switches

Initial app navigation:

- Root page `loadEventEnd`: ~356 ms
- AI page reached successfully.
- AI Center -> Manager -> Data Hub reached successfully.
- DataHub initial visual readiness was dominated by `/api/v1/data-sources?page=1&limit=20` at 8,120 ms.

Measured tab switch/render times in the running browser:

| Area | Measured time |
|---|---:|
| Data Sources | 192 ms |
| Pipeline | 68 ms |
| Advanced Features shell | 766 ms |
| Automation Routing | 220 ms |
| Access Control | 215 ms |
| Blacklist/Whitelist | 102 ms |
| Telegram Publisher | 224 ms |

Rendering verdict: **PARTIAL**. Tabs render quickly once DataHub is mounted, but initial DataHub readiness is still affected by the slow Data Sources list call.

## 4. Redis Cache Verification

Redis runtime checks:

```text
keyspace_hits:0
keyspace_misses:1
pipeline:* keys: none
```

Application cache log counts from runtime logs:

| Signal | Count |
|---|---:|
| `PIPELINE_CACHE_HIT` | 2 |
| `PIPELINE_CACHE_MISS` | 2 |
| `PIPELINE_CACHE_STALE_HIT_REFRESH_TRIGGER` | 1 |
| `PIPELINE_CACHE_REFRESH_FAILED` | 0 |
| `PIPELINE_TIMING` | 4 |

Redis write failures were present:

```text
PIPELINE_CACHE_REDIS_WRITE_SKIPPED
key="pipeline:view:includeTelegramBacklog:0|includeCategoryScreening:0|includeNormalizationSummary:0|includeDuplicateAnalysis:0|includeRecentPreview:0"
error="Max reconnection attempts reached"
```

Cache verdict: **PARTIAL/FAILED for Redis**.

The in-process pipeline cache is being used and logs hits/misses, but Redis is not actually retaining `pipeline:*` keys in the deployed runtime.

## 5. Pipeline Snapshot Cache Keys

Production runtime logs confirmed use of the pipeline snapshot key:

```text
pipeline:view:includeTelegramBacklog:0|includeCategoryScreening:0|includeNormalizationSummary:0|includeDuplicateAnalysis:0|includeRecentPreview:0
```

Related key observed:

```text
pipeline:duplicate-analysis:enrichment
```

Key usage verdict: **PASS for application runtime key usage**, **FAILED for Redis persistence**.

## 6. N+1 / Slow Query Check

Target endpoint rerun through nginx:

```text
/api/v1/data-sources/health              200 0.099732s
/api/v1/data-sources/pipeline            200 0.106403s
/api/v1/data-hub/automation/topics       200 0.052994s
/api/v1/data-hub/crawlers                200 0.072698s
```

Recent target request logs:

- `/api/v1/data-sources/pipeline?includeBacklog=false`: 27.181 ms
- `/api/v1/data-hub/crawlers`: 28.936 ms and 65.257 ms
- `/api/v1/data-sources/health`: 61.922 ms, 204.904 ms, 235.268 ms

Pipeline section timings:

```text
PIPELINE_TIMING history duration_ms=0
PIPELINE_TIMING health_cards duration_ms=3
PIPELINE_TIMING source_quality_board duration_ms=7
PIPELINE_TIMING collector_enrichment duration_ms=4
```

No new N+1 pattern was observed for the four target endpoints (`health`, default `pipeline`, `automation/topics`, `crawlers`).

Remaining slow-query evidence is outside those target default endpoints:

- Data Sources list duplicate/source enrichment still performs slow collected-data grouped counts.
- Pipeline backlog endpoint remains slow.
- Telegram Collector / Telegram pipeline views still contain heavy `telegram_messages` aggregates.

N+1 verdict for requested endpoints: **PASS**.

## 7. Final Verdict

**PARTIAL**

Why not PASS:

- Redis cache is not actually hitting/persisting keys in production runtime (`keyspace_hits=0`, no `pipeline:*` keys, Redis write skipped with max reconnect attempts).
- Browser-visible DataHub still has slow non-target UI calls:
  - `/api/v1/data-sources?page=1&limit=20`: 8.120s
  - `/api/v1/data-sources?page=1&limit=100`: 4.627s
  - `/api/v1/data-sources/pipeline/backlog`: 14.435s

What passed:

- The four required endpoint targets are fast through nginx.
- DataHub page renders and tabs switch successfully.
- No DataHub-specific console error, failed fetch, timeout, or 5xx was observed.
- No new N+1 pattern was observed for the requested target endpoints.

