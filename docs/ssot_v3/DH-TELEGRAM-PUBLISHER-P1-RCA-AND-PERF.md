# DH-TELEGRAM-PUBLISHER-P1-RCA-AND-DATAHUB-PERF-AUDIT

Date: 2026-06-18

Mode: READ-ONLY RCA

Scope:

- Part A: DataHub performance regression after Access Control P3 and Blacklist/Whitelist P2
- Part B: Telegram Publisher functionality and UX correctness

No code or database changes were made for this audit.

## Final Verdicts

DataHub Performance: **DEGRADED**

Telegram Publisher: **PARTIAL**

## Executive Summary

The DataHub slowness is real, but the primary bottleneck is not gateway overhead. `accessControlGateway` is mounted globally, but it returns immediately when no `source_id` is present. `filterRulesGateway` is not mounted globally. The slow paths are existing DataHub aggregate queries over `collected_data`, duplicate URL enrichment, Telegram backlog stats, and `buildDataPipelineView()` reuse in automation.

The summary banner `"Could not load DataHub summary metrics. Check your connection and try again."` is triggered by `useDataHubSummaryMetrics()`, which combines `/api/v1/data-sources/health` and `/api/v1/data-sources/stats`. Runtime evidence shows `/stats` is fast and `/health` is the likely culprit because it performs duplicate URL summary work and can be delayed by DB saturation.

Telegram Publisher is partially real: channels, create/disable, test dry-run/history, live send path, and delivery history exist. But the UI is incomplete/confusing. The Publish button is broken after ACL/P2 enforcement because the backend now requires `source_id` and the UI does not send it. The mapping panel is visual only. Templates are display-only, not CRUD-backed. Multiple i18n keys used by the UI are missing.

## Part A: DataHub Performance RCA

### API Latency Evidence

Authentication used an existing active session token. No sessions were created.

Direct backend: `http://localhost:5002`

| Endpoint | Status | Duration | Size | Result |
|---|---:|---:|---:|---|
| `GET /api/v1/data-sources/health` | 200 | 2,965 ms | 367 B | Slow for summary card |
| `GET /api/v1/data-sources/stats` | 200 | 7 ms | 93 B | Fast |
| `GET /api/v1/data-sources/pipeline` | 200 | 84,982 ms | 32,902 B | Very slow |
| `GET /api/v1/data-hub/access-control` | 200 | 21 ms | 19,932 B | Fast |
| `GET /api/v1/data-hub/filter-rules` | 200 | 212 ms | 12 B | OK |
| `GET /api/v1/data-hub/telegram-publishers` | 200 | 19 ms | 889 B | Fast |
| `GET /api/v1/data-hub/automation/topics` | 200 | 95,807 ms | 1,843 B | Very slow |
| `GET /api/v1/data-hub/crawlers` | 200 | 2,799 ms | 3,771 B | Slow but under 3s |

Frontend/nginx-visible path:

`http://localhost` returned `301` for all API paths. `https://localhost` was measured with redirect disabled because it is the real TLS path.

| Endpoint | Status | Duration | Size | Result |
|---|---:|---:|---:|---|
| `GET /api/v1/data-sources/health` | 200 | 2,984 ms | 367 B | Slow |
| `GET /api/v1/data-sources/stats` | 200 | 15 ms | 93 B | Fast |
| `GET /api/v1/data-sources/pipeline` | 200 | 81,331 ms | 32,744 B | Very slow |
| `GET /api/v1/data-hub/access-control` | 200 | 22 ms | 19,932 B | Fast |
| `GET /api/v1/data-hub/filter-rules` | 200 | 27 ms | 12 B | Fast |
| `GET /api/v1/data-hub/telegram-publishers` | 200 | 23 ms | 889 B | Fast |
| `GET /api/v1/data-hub/automation/topics` | 404 | 30,011 ms | 146 B | nginx/frontend-visible timeout-like behavior |
| `GET /api/v1/data-hub/crawlers` | 404 | 30,012 ms | 146 B | nginx/frontend-visible timeout-like behavior |

Follow-up curl with longer timeout and clean auth token later confirmed:

- `GET /api/v1/data-hub/automation/topics`: 200
- `GET /api/v1/data-hub/crawlers`: 200
- `GET /api/v1/data-sources/pipeline`: 200

This indicates backend can respond, but some endpoints exceed the frontend/nginx practical threshold under load.

### Summary Banner Root Cause

UI source:

- `components/ai/AIManager/tabs/DataHub/DataHubSummaryCards.tsx`
- `hooks/useDataHubSummary.ts`
- `hooks/useDataHubState.ts`
- `services/dataSourcesApi.ts`

The banner appears when either query errors:

- `fetchDataHubSourcesHealth()` -> `GET /api/v1/data-sources/health`
- `fetchDataHubSourcesStats()` -> `GET /api/v1/data-sources/stats`

Runtime evidence:

- `/stats` is consistently fast.
- `/health` is slower and includes duplicate URL summary work via `getDuplicateUrlSummaryForHealth()`.
- When DB is saturated by long pipeline/automation queries, health can fail or time out from the UI perspective.

Likely exact endpoint causing the banner: **`GET /api/v1/data-sources/health`**, with `/stats` only a secondary risk.

### Gateway Overhead Audit

`accessControlGateway`:

- Mounted globally at `app.use('/api/v1', accessControlGateway)`.
- Extracts `source_id`/`sourceId` from body/query/params.
- If no source id is present, returns `next()` without DB query.
- Read-only admin endpoints measured here do not include `source_id`.

Impact per endpoint:

| Endpoint | Access Gateway Runs? | DB Query From Gateway? | Filter Gateway Runs? | Verdict |
|---|---:|---:|---:|---|
| `/data-sources/health` | Yes | No | No | Near-zero gateway overhead |
| `/data-sources/stats` | Yes | No | No | Near-zero gateway overhead |
| `/data-sources/pipeline` | Yes | No | No | Not gateway-caused |
| `/data-hub/access-control` | Yes | No | No | Route query is the work |
| `/data-hub/filter-rules` | Yes | No | No | Route query is the work |
| `/data-hub/telegram-publishers` | Yes | No | No | Route query is the work |
| `/data-hub/automation/topics` | Yes | No | No | Service work is the issue |
| `/data-hub/crawlers` | Yes | No | No | Service duplicate enrichment is the issue |

`filterRulesGateway`:

- Not registered as global middleware.
- Only runs when called by ingestion/publishing/evaluate paths.
- It is not called by `/health`, `/stats`, `/pipeline`, `/access-control`, `/filter-rules` list, `/telegram-publishers` list, `/automation/topics`, or `/crawlers` list.

Conclusion: **gateway overhead is not the primary DataHub performance regression.**

### Slow Query Evidence

Recent backend logs contain very slow queries. Top observed examples:

| Duration | Query Summary |
|---:|---|
| 852,196 ms | `SELECT COUNT(*) FILTER ... FROM collected_data` normalization summary |
| 818,227 ms | `SELECT COUNT(*) FILTER ... FROM collected_data` normalization summary |
| 787,911 ms | `SELECT COUNT(*) FILTER ... FROM collected_data` normalization summary |
| 538,136 ms | category screening counts joining `data_categories`, `collected_data`, `data_sources` |
| 524,893 ms | category screening counts joining `data_categories`, `collected_data`, `data_sources` |
| 487,182 ms | normalization summary over `collected_data` |
| 484,596 ms | normalization summary over `collected_data` |
| 416,120 ms | category screening counts |
| 388,704 ms | category screening counts |
| 343,978 ms | category screening counts |
| 245,826 ms | latest collected row per source query |
| 221,203 ms | category screening counts |

Common pattern:

- Heavy scans over `collected_data`
- Expressions using `COALESCE((metadata->>'transferred_at')::timestamptz, collected_at)`
- `DISTINCT ON (source_id) ... ORDER BY source_id, collected_at DESC`
- Category subqueries repeated per category
- Ordering recent normalized preview by `processed_at DESC NULLS LAST`

### Data Pipeline Breakdown

Endpoint:

- `GET /api/v1/data-sources/pipeline`
- Route: `backend/routes/data-sources.js`
- Service: `backend/services/dataPipelineSnapshot.js`
- Function: `buildDataPipelineView({ includeBacklog })`

Observed runtime:

- Backend direct: ~85s
- HTTPS path: ~81s

Code path components:

- Base pipeline snapshot: `buildDataPipelineView()`
- Stats 24h: full scan/count on `collected_data` with timestamp expression
- Totals: full count on `collected_data`
- Sources: `data_sources` with `DISTINCT ON (source_id)` latest collected row and latest log row
- Category screening: correlated subqueries against `collected_data` for each category
- History cards: hourly aggregate over 24h
- Normalization summary: full `COUNT(*) FILTER` aggregate over all `collected_data`
- Normalized preview: latest 8 rows ordered by `processed_at` and ingestion timestamp
- Telegram collector enrichment: `batchTelegramCollectorEnrichment()`
- Optional backlog: disabled for default pipeline query, but automation and other calls still use the same snapshot base

Likely bottleneck:

1. Normalization summary full-table aggregate over `collected_data`
2. Category screening correlated counts
3. Latest per-source `DISTINCT ON` query
4. Recent preview ordering

### Automation Topics Slowness

Endpoint:

- `GET /api/v1/data-hub/automation/topics`
- Route: `backend/routes/data-hub-automation.js`
- Service: `datahubAutomationService.listAutomationTopics()`

Runtime:

- Backend direct: ~96s
- HTTPS path timed out/returned 404-like response at ~30s

Code evidence:

- `datahubAutomationService` calls `buildDataPipelineView()` in automation-related paths.
- `refreshAutomationQueue()` then loops topics -> publishers -> records.
- For each candidate it calls:
  - `enforceSourceAccess()` for topic agent
  - `enforceSourceAccess()` for publisher
  - `enforcePublishingPolicy()`

Gateway P3/P2 introduced policy checks inside automation candidate loops. That is correct for security, but it compounds an already expensive `buildDataPipelineView()` base load.

Verdict for automation: **N+1 risk introduced/expanded by enforcement, but the dominant cost is still the pipeline snapshot load.**

### Crawlers Slowness

Endpoint:

- `GET /api/v1/data-hub/crawlers`
- Service: `datahubCrawlersService.listCrawlers()`

Runtime:

- Backend direct: ~2.8s
- HTTPS path timed out/returned 404-like response at ~30s in one run, later 200 with longer timeout

Code evidence:

- `listCrawlers()` calls `syncCrawlersFromDataSources()` before returning the list, so a GET can perform implicit sync/write behavior if crawler rows are missing.
- `listCrawlers()` calls `buildDuplicateEnrichmentBySourceId()`.
- Duplicate enrichment loads URL-bearing sources and joins `collected_data` to count per source.

Verdict: **duplicate URL enrichment is likely responsible for crawler list latency.**
The implicit sync on a read endpoint should also be treated as design debt because it makes latency and side effects harder to reason about.

### N+1 Findings

Confirmed or likely N+1 / repeated expensive patterns:

- `datahubAutomationService.refreshAutomationQueue()`:
  - loops topics -> publishers -> normalized records
  - per candidate calls ACL and filter enforcement
  - reads a full pipeline snapshot before the loop
  - reloads publishing filter rules through per-candidate `enforcePublishingPolicy()` instead of a cached publishing evaluator

- `dataPipeline.js`:
  - `filterAllowedAgentsThroughGateway()` loops agent keys and calls `enforceSourceAccess()` per agent
  - relevant to routing, not primary pipeline GET endpoint

- `telegramPipeline.js`:
  - now calls `enforceIngestionPolicy()` per resolved message
  - correct for security, but rule evaluation currently reloads active rules per message unless optimized later

- `dataFetcher.js`:
  - now calls `enforceIngestionPolicy()` per fetched item
  - correct for security, but can be optimized using gateway batch helpers

- `datahubCrawlersService.listCrawlers()`:
  - read path performs sync, metrics, and duplicate enrichment work
  - not an ACL/filter N+1, but a repeated full-enrichment cost on every list load

No evidence:

- No N+1 from `accessControlGateway` on read-only endpoints without `source_id`.
- No filter rule evaluation on DataHub summary/pipeline list endpoints.

### Performance Classification

| Category | Classification | Evidence |
|---|---|---|
| A) Gateway overhead | Low | Gateway no-ops without `source_id`; filter gateway not global |
| B) Existing slow pipeline query | High | `/pipeline` ~81-85s; slow logs show huge `collected_data` aggregates |
| C) N+1 introduced by P2/P3 | Medium | Automation and ingestion loops now enforce policies per item/candidate |
| D) Backend instability/restart issue | Medium | Slow DB queries can saturate workers; backend direct eventually returns |
| E) Frontend timeout/query staleTime issue | Medium | React Query staleTime is 30s; no explicit fetch timeout, but UI sees failures under saturation |
| F) Nginx timeout issue | Medium/High | HTTPS path showed ~30s failure-like results for slow endpoints |

## Part B: Telegram Publisher RCA

### UI Wiring Map

Main UI:

- `components/ai/AIManager/tabs/DataHub/advanced/TelegramPublisher.tsx`
- Hooks: `hooks/useTelegramPublishers.ts`
- API client: `services/telegramPublishersApi.ts`

Backend:

- Routes: `backend/routes/telegram-publishers.js`
- Service: `backend/services/telegramPublisherService.js`
- Schemas: `backend/schemas/telegramPublisherSchemas.js`
- Migration: `backend/database/migrations/025_create_telegram_publishers.sql`

Routes:

- `GET /api/v1/data-hub/telegram-publishers`
- `POST /api/v1/data-hub/telegram-publishers`
- `PUT /api/v1/data-hub/telegram-publishers/:id`
- `DELETE /api/v1/data-hub/telegram-publishers/:id`
- `POST /api/v1/data-hub/telegram-publishers/:id/test`
- `POST /api/v1/data-hub/telegram-publishers/:id/publish`
- `GET /api/v1/data-hub/telegram-publishers/:id/history`

### Feature Wiring Status

| UI Area | Component/Handler | API | Backend | Status |
|---|---|---|---|---|
| Channels list | `useTelegramPublishersQuery` | `GET /` | real DB list | Real |
| New Channel | `handleCreate` | `POST /` | inserts `telegram_publishers` | Real |
| Select | `setSelectedPublisherId` | none | UI state only | Real but local only |
| Test | `handleTest` | `POST /:id/test` | `runPublisherTest` | Real, mostly dry-run |
| Publish | `handlePublish` | `POST /:id/publish` | `runPublisherPublish` | Broken from UI after source_id requirement |
| Disable | `handleDisable` | `DELETE /:id` | soft disables publisher | Real |
| History | `usePublisherHistoryQuery` | `GET /:id/history` | `publisher_delivery_history` | Real, paginated backend; UI slices to 20 |
| Templates | `selectedPublisher.template` display | none | no template table | Display-only |
| Input/Output Channel Mapping | renders first 5 telegram sources | none | no mapping table | UI-only |

### Database Evidence

Tables:

| Table | Exists | Notes |
|---|---:|---|
| `telegram_publishers` | Yes | Output channel configs |
| `publisher_delivery_history` | Yes | test/publish/dry-run history |
| `publisher_templates` | No | Templates tab is not table-backed |
| `data_sources` | Yes | Input Telegram sources live here |
| `telegram_channels` | Yes | Telegram collector input channels |
| `notification_settings` | Yes | Separate notification system |
| `notification_history` | Yes | Separate notification history |
| `datahub_automation_topics` | Yes | Automation links to publishers |
| `datahub_automation_queue` | Yes | Automation queue |

Counts:

- `telegram_publishers`: 2 total, 1 active, 1 with bot token.
- `publisher_delivery_history`: 24 total, 1 failed, 18 dry_run, 2 sent, 3 test.
- Telegram `data_sources`: 45 total, 45 active.
- `telegram_channels`: 45 total, 43 active.
- `notification_settings`: 0.
- `notification_history`: 0.
- `datahub_automation_topics`: 3 total, 3 active.
- `datahub_automation_queue`: 35 total, 8 pending, 15 failed.

Latest history rows:

- Mostly `dry_run` with `content_type = test`.
- Latest entries belong to publisher `5ab9a6bc-5f17-4aae-bb06-4a34e827af24`.
- Existing history does include old `sent` rows, but current recent activity is dry-run/test.

API list evidence:

- `GET /api/v1/data-hub/telegram-publishers`: 200
- Returned 2 publishers.
- Metrics: `totalChannels=1`, `delivered24h=0`, `failed24h=0`, `successRate=100`.
- First active publisher has `has_bot_token=true`, `sent_count=2`, `last_sent_at=2026-05-30T21:03:59.824Z`.

### Bot Token RCA

Backend:

- `telegram_publishers.bot_token_encrypted` stores encrypted/masked bot token.
- `mapPublisherRow()` exposes only `has_bot_token`, not the token.
- `runPublisherTest()` uses dry-run when `TELEGRAM_PUBLISHER_DRY_RUN=true` or no bot token exists.
- `runPublisherPublish()` uses dry-run when forced or when `confirm_publish && !hasToken`.

UI:

- Displays `pub.has_bot_token ? t('bot_token_configured') : t('bot_token_missing_dry_run')`.
- Both keys are missing in active English/Farsi locale files.

Missing translations that must be fixed in P2:

- `bot_token_configured`
- `bot_token_missing_dry_run`
- `publisher_publish_prompt`
- `publisher_publish_confirm`
- `publisher_publish_dry_run`
- `publisher_publish_ok`
- `publisher_publish_failed`
- `publisher_test_dry_run`
- `publisher_test_ok`
- `publisher_test_failed`
- `publisher_status_dry_run`
- `publisher_status_test`
- `template_for`
- `select_publisher_for_template`

### Test Button RCA

UI:

- `handleTest(pub)` sends:
  - `id`
  - `message`
- API client sends body `{ message }` to `POST /:id/test`.

Backend:

- `testPublisherSchema` only requires optional message.
- `runPublisherTest()` does not require `source_id`.
- It does not use ACL or filter gateway.
- It writes `publisher_delivery_history`.
- It can dry-run without bot token.
- It can live-send if bot token exists and dry-run is not forced.

Read-only conclusion:

- Test is wired to a real backend route.
- If it appears broken in UI, the most likely causes are missing translation/user feedback confusion, dry-run behavior being mistaken for failure, bot token/channel Telegram API error, or write permission gating.
- It is not broken by missing `source_id`, because `/test` does not enforce ACL/filter.

### Publish Button RCA

UI:

- `handlePublish(pub)` sends:
  - `id`
  - `message`
  - `confirm_publish: true`
  - `content_type: manual`
- It does **not** send:
  - `source_id`
  - `data_type`

Backend after ACL/P2:

- `publishPublisherSchema` requires `source_id`.
- `accessControlGateway` derives runtime agent `publisher` for `/data-hub/telegram-publishers/:id/publish`.
- Without `source_id`, middleware no-ops but schema validation fails before service.
- Expected backend error: HTTP 400 `VALIDATION_ERROR`, field `source_id`, required/invalid type.
- If `source_id` is supplied but ACL denies, expected error: `403 SOURCE_ACCESS_DENIED`.
- If publishing filter blocks, expected error: `403 FILTER_RULE_BLOCKED`.

Verdict:

- Publish button is currently broken from UI because the UI does not send required DataHub source context.

### Input/Output Channel Mapping RCA

UI:

- Renders `telegramSources.slice(0, 5)`.
- Rows are plain `<div>` elements.
- No `onClick`.
- No selected input source state.
- No mapping modal.
- No API call.

Backend:

- No source-to-publisher mapping table was found.
- Automation topics store publisher targets, but that is topic routing, not input/output channel row mapping.

Verdict: **UI-only / missing feature.**

Likely intended behavior should be defined in P2:

- Click input source row to select source.
- Link selected input source to output publisher.
- Store mapping in a real table or reuse automation topics explicitly.
- Use mapping to supply `source_id` and `data_type` for Test/Publish/Automation.

### Settings -> Notifications Dependency

Text:

- `telegram_publisher_hint`: "Personal trade and alert notifications are separate; use Settings → Notifications."
- `telegram_automation_hint`: similar separation note.

Settings system:

- UI: `components/settings/NotificationsSettings.tsx`
- Backend: `backend/routes/notifications.js`, `backend/routes/userPreferences.js`
- DB: `notification_settings`, `notification_history`, `user_preferences`

Finding:

- Publisher and Notifications are separate systems.
- Publisher uses `telegram_publishers.bot_token_encrypted` per outbound channel.
- Settings Notifications uses `telegram.botToken` and `telegram.chatId` in user settings/preferences and is personal alert focused.
- `notification_settings` and `notification_history` are empty in current DB evidence.

Verdict:

- The note is conceptually true, but UX is confusing because both areas talk about Telegram bot tokens and channels.
- Redesign should introduce clearer copy or a shared Telegram credential/channel manager with separate usage modes:
  - personal alert bot
  - outbound DataHub publisher bot
  - collector/input channel identity

### ACL and Filter Compatibility

Public publisher API:

- Backend now respects ACL and publishing filters when `source_id` is supplied.
- UI publish path does not supply `source_id`, so it fails before useful policy behavior.

Legacy publish route:

- `POST /api/v1/data-sources/publish-telegram` enforces ACL and publishing filters when `source_id` is supplied.

Automation dispatch:

- `datahubAutomationService` supplies `source_id` and `data_type` when calling `runPublisherPublish`.
- It also checks publishing filters before queue insert and before publish dispatch path through publisher service.

Telegram Publisher tab:

- Test does not supply source context and does not enforce ACL/filter.
- Publish does not supply required source context and therefore fails.

### History Tab RCA

Backend:

- `publisher_delivery_history` is real.
- `GET /:id/history` returns paginated rows with `limit` and `offset`.

Frontend:

- Fetches 50 rows for selected publisher.
- Displays `historyItems.slice(0, 20)`.
- Maps `dry_run` and `test` to UI status `sent`, which hides the distinction from the user.
- Refreshes after test/publish via query invalidation.

Evidence:

- 24 history rows.
- 18 dry-run rows.
- 3 test rows.
- 2 sent rows.
- 1 failed row.

Verdict:

- Real history exists, but UI labeling is misleading because dry-runs/tests look like successful sends.

### Templates Tab RCA

Backend:

- No `publisher_templates` table.
- No template CRUD routes.
- Publisher has a single `template` column.
- `runPublisherPublish()` uses publisher template for message formatting.

Frontend:

- Templates tab displays selected publisher template in a `<pre>`.
- No edit/save/delete/select template behavior.

Verdict:

- Templates are **display-only**, not a real templates subsystem.

### Telegram Publisher UX Verdict

Overall: **PARTIAL**

Real:

- Publisher list/create/disable.
- Bot token storage as encrypted field.
- Test route and history writes.
- Live publish service path.
- Delivery history.
- ACL/filter enforcement on backend publish path when source context exists.

Broken or incomplete:

- Publish button omits `source_id` and `data_type`.
- Mapping rows are not clickable and do not map anything.
- Templates tab is display-only.
- Test button behavior is confusing because dry-run/test history can look like successful sends.
- Missing i18n keys show raw keys or confusing labels.
- History maps `dry_run`/`test` to sent-like UI status.
- Settings -> Notifications relationship is under-explained and duplicates Telegram credential concepts.

## Recommended P2 Implementation Plan

### DataHub Performance P2

1. Split `/data-sources/health` into a truly light health endpoint and a separate duplicate-quality endpoint.
2. Add timing instrumentation around `buildDataPipelineView()` sections.
3. Add/verify indexes for:
   - `collected_data(source_id, collected_at DESC)`
   - `collected_data(processed_at DESC)`
   - expression or generated column for effective ingestion timestamp instead of repeated JSON timestamp cast
   - `collected_data(status, processed_at)`
   - `telegram_messages(is_processed, processed_at)`
4. Replace correlated category counts with grouped aggregate by category.
5. Cache pipeline snapshot aggressively and serve stale cache while refresh is in progress.
6. Move automation topic list away from full pipeline snapshot; only refresh queue should load candidate records.
7. Batch ACL/filter checks in automation and ingestion paths using gateway batch helpers.
8. Add cached publishing rule evaluator support so automation enqueue does not reload active publishing rules per candidate.
9. Remove implicit `syncCrawlersFromDataSources()` side effects from `GET /data-hub/crawlers`; move sync to explicit POST or background job.
10. Review nginx/proxy timeouts and make slow DataHub endpoints return 202/cache status rather than blocking UI.

### Telegram Publisher P2

1. Add real source/channel mapping model or explicitly remove the mapping UI until implemented.
2. Update Publish UI to require/select `source_id` and send `data_type`.
3. Decide whether Test should be source-aware and policy-aware; if yes, add `source_id` to test schema and UI.
4. Add all missing i18n keys in English and Farsi locales.
5. Redesign History UI to distinguish `sent`, `dry_run`, `test`, and `failed`.
6. Convert Templates tab into real edit/save flow or label it "Current Template Preview".
7. Clarify bot token state:
   - configured
   - missing: dry-run only
   - invalid/decrypt failed
   - live send disabled by environment dry-run
8. Clarify Settings -> Notifications vs DataHub Publisher:
   - separate personal notifications
   - separate outbound channel publishing
   - optional shared credential manager later
9. Add integration tests for UI payload contract:
   - publish without source_id fails with clear UI error
   - publish with mapped source_id passes validation and reaches ACL/filter checks
   - dry-run/test status is rendered accurately

## Final Classification

DataHub Performance: **DEGRADED**

Primary cause:

- Heavy DataHub aggregate queries and pipeline snapshot work.

Secondary causes:

- Automation reusing `buildDataPipelineView()`.
- Enforcement checks inside loops.
- nginx/frontend timeout behavior for slow endpoints.

Not primary cause:

- Global Access Control Gateway overhead.
- Filter Rules Gateway overhead on read-only list/summary endpoints.

Telegram Publisher: **PARTIAL**

Primary issue:

- Backend publish path is now correctly stricter, but frontend does not provide required source context.

Secondary issues:

- Missing translations.
- Mapping is UI-only.
- Templates are display-only.
- History status is misleading.
- Settings Notifications relationship needs product/UX redesign.
# DH-TELEGRAM-PUBLISHER-P1-RCA-AND-DATAHUB-PERF-AUDIT

Date: 2026-06-18

Mode: READ-ONLY RCA

Scope:

- Part A: DataHub performance regression after Access Control P3 and Blacklist/Whitelist P2
- Part B: Telegram Publisher functionality and UX correctness

No code or database changes were made for this audit.

## Final Verdicts

DataHub Performance: **DEGRADED**

Telegram Publisher: **PARTIAL**

## Executive Summary

The DataHub slowness is real, but the primary bottleneck is not gateway overhead. `accessControlGateway` is mounted globally, but it returns immediately when no `source_id` is present. `filterRulesGateway` is not mounted globally. The slow paths are existing DataHub aggregate queries over `collected_data`, duplicate URL enrichment, Telegram backlog stats, and `buildDataPipelineView()` reuse in automation.

The summary banner `"Could not load DataHub summary metrics. Check your connection and try again."` is triggered by `useDataHubSummaryMetrics()`, which combines `/api/v1/data-sources/health` and `/api/v1/data-sources/stats`. Runtime evidence shows `/stats` is fast and `/health` is the likely culprit because it performs duplicate URL summary work and can be delayed by DB saturation.

Telegram Publisher is partially real: channels, create/disable, test dry-run/history, live send path, and delivery history exist. But the UI is incomplete/confusing. The Publish button is broken after ACL/P2 enforcement because the backend now requires `source_id` and the UI does not send it. The mapping panel is visual only. Templates are display-only, not CRUD-backed. Multiple i18n keys used by the UI are missing.

## Part A: DataHub Performance RCA

### API Latency Evidence

Authentication used an existing active session token. No sessions were created.

Direct backend: `http://localhost:5002`

| Endpoint | Status | Duration | Size | Result |
|---|---:|---:|---:|---|
| `GET /api/v1/data-sources/health` | 200 | 2,965 ms | 367 B | Slow for summary card |
| `GET /api/v1/data-sources/stats` | 200 | 7 ms | 93 B | Fast |
| `GET /api/v1/data-sources/pipeline` | 200 | 84,982 ms | 32,902 B | Very slow |
| `GET /api/v1/data-hub/access-control` | 200 | 21 ms | 19,932 B | Fast |
| `GET /api/v1/data-hub/filter-rules` | 200 | 212 ms | 12 B | OK |
| `GET /api/v1/data-hub/telegram-publishers` | 200 | 19 ms | 889 B | Fast |
| `GET /api/v1/data-hub/automation/topics` | 200 | 95,807 ms | 1,843 B | Very slow |
| `GET /api/v1/data-hub/crawlers` | 200 | 2,799 ms | 3,771 B | Slow but under 3s |

Frontend/nginx-visible path:

`http://localhost` returned `301` for all API paths. `https://localhost` was measured with redirect disabled because it is the real TLS path.

| Endpoint | Status | Duration | Size | Result |
|---|---:|---:|---:|---|
| `GET /api/v1/data-sources/health` | 200 | 2,984 ms | 367 B | Slow |
| `GET /api/v1/data-sources/stats` | 200 | 15 ms | 93 B | Fast |
| `GET /api/v1/data-sources/pipeline` | 200 | 81,331 ms | 32,744 B | Very slow |
| `GET /api/v1/data-hub/access-control` | 200 | 22 ms | 19,932 B | Fast |
| `GET /api/v1/data-hub/filter-rules` | 200 | 27 ms | 12 B | Fast |
| `GET /api/v1/data-hub/telegram-publishers` | 200 | 23 ms | 889 B | Fast |
| `GET /api/v1/data-hub/automation/topics` | 404 | 30,011 ms | 146 B | nginx/frontend-visible timeout-like behavior |
| `GET /api/v1/data-hub/crawlers` | 404 | 30,012 ms | 146 B | nginx/frontend-visible timeout-like behavior |

Follow-up curl with longer timeout and clean auth token later confirmed:

- `GET /api/v1/data-hub/automation/topics`: 200
- `GET /api/v1/data-hub/crawlers`: 200
- `GET /api/v1/data-sources/pipeline`: 200

This indicates backend can respond, but some endpoints exceed the frontend/nginx practical threshold under load.

### Summary Banner Root Cause

UI source:

- `components/ai/AIManager/tabs/DataHub/DataHubSummaryCards.tsx`
- `hooks/useDataHubSummary.ts`
- `hooks/useDataHubState.ts`
- `services/dataSourcesApi.ts`

The banner appears when either query errors:

- `fetchDataHubSourcesHealth()` -> `GET /api/v1/data-sources/health`
- `fetchDataHubSourcesStats()` -> `GET /api/v1/data-sources/stats`

Runtime evidence:

- `/stats` is consistently fast.
- `/health` is slower and includes duplicate URL summary work via `getDuplicateUrlSummaryForHealth()`.
- When DB is saturated by long pipeline/automation queries, health can fail or time out from the UI perspective.

Likely exact endpoint causing the banner: **`GET /api/v1/data-sources/health`**, with `/stats` only a secondary risk.

### Gateway Overhead Audit

`accessControlGateway`:

- Mounted globally at `app.use('/api/v1', accessControlGateway)`.
- Extracts `source_id`/`sourceId` from body/query/params.
- If no source id is present, returns `next()` without DB query.
- Read-only admin endpoints measured here do not include `source_id`.

Impact per endpoint:

| Endpoint | Access Gateway Runs? | DB Query From Gateway? | Filter Gateway Runs? | Verdict |
|---|---:|---:|---:|---|
| `/data-sources/health` | Yes | No | No | Near-zero gateway overhead |
| `/data-sources/stats` | Yes | No | No | Near-zero gateway overhead |
| `/data-sources/pipeline` | Yes | No | No | Not gateway-caused |
| `/data-hub/access-control` | Yes | No | No | Route query is the work |
| `/data-hub/filter-rules` | Yes | No | No | Route query is the work |
| `/data-hub/telegram-publishers` | Yes | No | No | Route query is the work |
| `/data-hub/automation/topics` | Yes | No | No | Service work is the issue |
| `/data-hub/crawlers` | Yes | No | No | Service duplicate enrichment is the issue |

`filterRulesGateway`:

- Not registered as global middleware.
- Only runs when called by ingestion/publishing/evaluate paths.
- It is not called by `/health`, `/stats`, `/pipeline`, `/access-control`, `/filter-rules` list, `/telegram-publishers` list, `/automation/topics`, or `/crawlers` list.

Conclusion: **gateway overhead is not the primary DataHub performance regression.**

### Slow Query Evidence

Recent backend logs contain very slow queries. Top observed examples:

| Duration | Query Summary |
|---:|---|
| 852,196 ms | `SELECT COUNT(*) FILTER ... FROM collected_data` normalization summary |
| 818,227 ms | `SELECT COUNT(*) FILTER ... FROM collected_data` normalization summary |
| 787,911 ms | `SELECT COUNT(*) FILTER ... FROM collected_data` normalization summary |
| 538,136 ms | category screening counts joining `data_categories`, `collected_data`, `data_sources` |
| 524,893 ms | category screening counts joining `data_categories`, `collected_data`, `data_sources` |
| 487,182 ms | normalization summary over `collected_data` |
| 484,596 ms | normalization summary over `collected_data` |
| 416,120 ms | category screening counts |
| 388,704 ms | category screening counts |
| 343,978 ms | category screening counts |
| 245,826 ms | latest collected row per source query |
| 221,203 ms | category screening counts |

Common pattern:

- Heavy scans over `collected_data`
- Expressions using `COALESCE((metadata->>'transferred_at')::timestamptz, collected_at)`
- `DISTINCT ON (source_id) ... ORDER BY source_id, collected_at DESC`
- Category subqueries repeated per category
- Ordering recent normalized preview by `processed_at DESC NULLS LAST`

### Data Pipeline Breakdown

Endpoint:

- `GET /api/v1/data-sources/pipeline`
- Route: `backend/routes/data-sources.js`
- Service: `backend/services/dataPipelineSnapshot.js`
- Function: `buildDataPipelineView({ includeBacklog })`

Observed runtime:

- Backend direct: ~85s
- HTTPS path: ~81s

Code path components:

- Base pipeline snapshot: `buildDataPipelineView()`
- Stats 24h: full scan/count on `collected_data` with timestamp expression
- Totals: full count on `collected_data`
- Sources: `data_sources` with `DISTINCT ON (source_id)` latest collected row and latest log row
- Category screening: correlated subqueries against `collected_data` for each category
- History cards: hourly aggregate over 24h
- Normalization summary: full `COUNT(*) FILTER` aggregate over all `collected_data`
- Normalized preview: latest 8 rows ordered by `processed_at` and ingestion timestamp
- Telegram collector enrichment: `batchTelegramCollectorEnrichment()`
- Optional backlog: disabled for default pipeline query, but automation and other calls still use the same snapshot base

Likely bottleneck:

1. Normalization summary full-table aggregate over `collected_data`
2. Category screening correlated counts
3. Latest per-source `DISTINCT ON` query
4. Recent preview ordering

### Automation Topics Slowness

Endpoint:

- `GET /api/v1/data-hub/automation/topics`
- Route: `backend/routes/data-hub-automation.js`
- Service: `datahubAutomationService.listAutomationTopics()`

Runtime:

- Backend direct: ~96s
- HTTPS path timed out/returned 404-like response at ~30s

Code evidence:

- `datahubAutomationService` calls `buildDataPipelineView()` in automation-related paths.
- `refreshAutomationQueue()` then loops topics -> publishers -> records.
- For each candidate it calls:
  - `enforceSourceAccess()` for topic agent
  - `enforceSourceAccess()` for publisher
  - `enforcePublishingPolicy()`

Gateway P3/P2 introduced policy checks inside automation candidate loops. That is correct for security, but it compounds an already expensive `buildDataPipelineView()` base load.

Verdict for automation: **N+1 risk introduced/expanded by enforcement, but the dominant cost is still the pipeline snapshot load.**

### Crawlers Slowness

Endpoint:

- `GET /api/v1/data-hub/crawlers`
- Service: `datahubCrawlersService.listCrawlers()`

Runtime:

- Backend direct: ~2.8s
- HTTPS path timed out/returned 404-like response at ~30s in one run, later 200 with longer timeout

Code evidence:

- `listCrawlers()` calls `syncCrawlersFromDataSources()` before returning the list, so a GET can perform implicit sync/write behavior if crawler rows are missing.
- `listCrawlers()` calls `buildDuplicateEnrichmentBySourceId()`.
- Duplicate enrichment loads URL-bearing sources and joins `collected_data` to count per source.

Verdict: **duplicate URL enrichment is likely responsible for crawler list latency.**
The implicit sync on a read endpoint should also be treated as design debt because it makes latency and side effects harder to reason about.

### N+1 Findings

Confirmed or likely N+1 / repeated expensive patterns:

- `datahubAutomationService.refreshAutomationQueue()`:
  - loops topics -> publishers -> normalized records
  - per candidate calls ACL and filter enforcement
  - reads a full pipeline snapshot before the loop
  - reloads publishing filter rules through per-candidate `enforcePublishingPolicy()` instead of a cached publishing evaluator

- `dataPipeline.js`:
  - `filterAllowedAgentsThroughGateway()` loops agent keys and calls `enforceSourceAccess()` per agent
  - relevant to routing, not primary pipeline GET endpoint

- `telegramPipeline.js`:
  - now calls `enforceIngestionPolicy()` per resolved message
  - correct for security, but rule evaluation currently reloads active rules per message unless optimized later

- `dataFetcher.js`:
  - now calls `enforceIngestionPolicy()` per fetched item
  - correct for security, but can be optimized using gateway batch helpers

- `datahubCrawlersService.listCrawlers()`:
  - read path performs sync, metrics, and duplicate enrichment work
  - not an ACL/filter N+1, but a repeated full-enrichment cost on every list load

No evidence:

- No N+1 from `accessControlGateway` on read-only endpoints without `source_id`.
- No filter rule evaluation on DataHub summary/pipeline list endpoints.

### Performance Classification

| Category | Classification | Evidence |
|---|---|---|
| A) Gateway overhead | Low | Gateway no-ops without `source_id`; filter gateway not global |
| B) Existing slow pipeline query | High | `/pipeline` ~81-85s; slow logs show huge `collected_data` aggregates |
| C) N+1 introduced by P2/P3 | Medium | Automation and ingestion loops now enforce policies per item/candidate |
| D) Backend instability/restart issue | Medium | Slow DB queries can saturate workers; backend direct eventually returns |
| E) Frontend timeout/query staleTime issue | Medium | React Query staleTime is 30s; no explicit fetch timeout, but UI sees failures under saturation |
| F) Nginx timeout issue | Medium/High | HTTPS path showed ~30s failure-like results for slow endpoints |

## Part B: Telegram Publisher RCA

### UI Wiring Map

Main UI:

- `components/ai/AIManager/tabs/DataHub/advanced/TelegramPublisher.tsx`
- Hooks: `hooks/useTelegramPublishers.ts`
- API client: `services/telegramPublishersApi.ts`

Backend:

- Routes: `backend/routes/telegram-publishers.js`
- Service: `backend/services/telegramPublisherService.js`
- Schemas: `backend/schemas/telegramPublisherSchemas.js`
- Migration: `backend/database/migrations/025_create_telegram_publishers.sql`

Routes:

- `GET /api/v1/data-hub/telegram-publishers`
- `POST /api/v1/data-hub/telegram-publishers`
- `PUT /api/v1/data-hub/telegram-publishers/:id`
- `DELETE /api/v1/data-hub/telegram-publishers/:id`
- `POST /api/v1/data-hub/telegram-publishers/:id/test`
- `POST /api/v1/data-hub/telegram-publishers/:id/publish`
- `GET /api/v1/data-hub/telegram-publishers/:id/history`

### Feature Wiring Status

| UI Area | Component/Handler | API | Backend | Status |
|---|---|---|---|---|
| Channels list | `useTelegramPublishersQuery` | `GET /` | real DB list | Real |
| New Channel | `handleCreate` | `POST /` | inserts `telegram_publishers` | Real |
| Select | `setSelectedPublisherId` | none | UI state only | Real but local only |
| Test | `handleTest` | `POST /:id/test` | `runPublisherTest` | Real, mostly dry-run |
| Publish | `handlePublish` | `POST /:id/publish` | `runPublisherPublish` | Broken from UI after source_id requirement |
| Disable | `handleDisable` | `DELETE /:id` | soft disables publisher | Real |
| History | `usePublisherHistoryQuery` | `GET /:id/history` | `publisher_delivery_history` | Real, paginated backend; UI slices to 20 |
| Templates | `selectedPublisher.template` display | none | no template table | Display-only |
| Input/Output Channel Mapping | renders first 5 telegram sources | none | no mapping table | UI-only |

### Database Evidence

Tables:

| Table | Exists | Notes |
|---|---:|---|
| `telegram_publishers` | Yes | Output channel configs |
| `publisher_delivery_history` | Yes | test/publish/dry-run history |
| `publisher_templates` | No | Templates tab is not table-backed |
| `data_sources` | Yes | Input Telegram sources live here |
| `telegram_channels` | Yes | Telegram collector input channels |
| `notification_settings` | Yes | Separate notification system |
| `notification_history` | Yes | Separate notification history |
| `datahub_automation_topics` | Yes | Automation links to publishers |
| `datahub_automation_queue` | Yes | Automation queue |

Counts:

- `telegram_publishers`: 2 total, 1 active, 1 with bot token.
- `publisher_delivery_history`: 24 total, 1 failed, 18 dry_run, 2 sent, 3 test.
- Telegram `data_sources`: 45 total, 45 active.
- `telegram_channels`: 45 total, 43 active.
- `notification_settings`: 0.
- `notification_history`: 0.
- `datahub_automation_topics`: 3 total, 3 active.
- `datahub_automation_queue`: 35 total, 8 pending, 15 failed.

Latest history rows:

- Mostly `dry_run` with `content_type = test`.
- Latest entries belong to publisher `5ab9a6bc-5f17-4aae-bb06-4a34e827af24`.
- Existing history does include old `sent` rows, but current recent activity is dry-run/test.

API list evidence:

- `GET /api/v1/data-hub/telegram-publishers`: 200
- Returned 2 publishers.
- Metrics: `totalChannels=1`, `delivered24h=0`, `failed24h=0`, `successRate=100`.
- First active publisher has `has_bot_token=true`, `sent_count=2`, `last_sent_at=2026-05-30T21:03:59.824Z`.

### Bot Token RCA

Backend:

- `telegram_publishers.bot_token_encrypted` stores encrypted/masked bot token.
- `mapPublisherRow()` exposes only `has_bot_token`, not the token.
- `runPublisherTest()` uses dry-run when `TELEGRAM_PUBLISHER_DRY_RUN=true` or no bot token exists.
- `runPublisherPublish()` uses dry-run when forced or when `confirm_publish && !hasToken`.

UI:

- Displays `pub.has_bot_token ? t('bot_token_configured') : t('bot_token_missing_dry_run')`.
- Both keys are missing in active English/Farsi locale files.

Missing translations that must be fixed in P2:

- `bot_token_configured`
- `bot_token_missing_dry_run`
- `publisher_publish_prompt`
- `publisher_publish_confirm`
- `publisher_publish_dry_run`
- `publisher_publish_ok`
- `publisher_publish_failed`
- `publisher_test_dry_run`
- `publisher_test_ok`
- `publisher_test_failed`
- `publisher_status_dry_run`
- `publisher_status_test`
- `template_for`
- `select_publisher_for_template`

### Test Button RCA

UI:

- `handleTest(pub)` sends:
  - `id`
  - `message`
- API client sends body `{ message }` to `POST /:id/test`.

Backend:

- `testPublisherSchema` only requires optional message.
- `runPublisherTest()` does not require `source_id`.
- It does not use ACL or filter gateway.
- It writes `publisher_delivery_history`.
- It can dry-run without bot token.
- It can live-send if bot token exists and dry-run is not forced.

Read-only conclusion:

- Test is wired to a real backend route.
- If it appears broken in UI, the most likely causes are missing translation/user feedback confusion, dry-run behavior being mistaken for failure, bot token/channel Telegram API error, or write permission gating.
- It is not broken by missing `source_id`, because `/test` does not enforce ACL/filter.

### Publish Button RCA

UI:

- `handlePublish(pub)` sends:
  - `id`
  - `message`
  - `confirm_publish: true`
  - `content_type: manual`
- It does **not** send:
  - `source_id`
  - `data_type`

Backend after ACL/P2:

- `publishPublisherSchema` requires `source_id`.
- `accessControlGateway` derives runtime agent `publisher` for `/data-hub/telegram-publishers/:id/publish`.
- Without `source_id`, middleware no-ops but schema validation fails before service.
- Expected backend error: HTTP 400 `VALIDATION_ERROR`, field `source_id`, required/invalid type.
- If `source_id` is supplied but ACL denies, expected error: `403 SOURCE_ACCESS_DENIED`.
- If publishing filter blocks, expected error: `403 FILTER_RULE_BLOCKED`.

Verdict:

- Publish button is currently broken from UI because the UI does not send required DataHub source context.

### Input/Output Channel Mapping RCA

UI:

- Renders `telegramSources.slice(0, 5)`.
- Rows are plain `<div>` elements.
- No `onClick`.
- No selected input source state.
- No mapping modal.
- No API call.

Backend:

- No source-to-publisher mapping table was found.
- Automation topics store publisher targets, but that is topic routing, not input/output channel row mapping.

Verdict: **UI-only / missing feature.**

Likely intended behavior should be defined in P2:

- Click input source row to select source.
- Link selected input source to output publisher.
- Store mapping in a real table or reuse automation topics explicitly.
- Use mapping to supply `source_id` and `data_type` for Test/Publish/Automation.

### Settings -> Notifications Dependency

Text:

- `telegram_publisher_hint`: "Personal trade and alert notifications are separate; use Settings → Notifications."
- `telegram_automation_hint`: similar separation note.

Settings system:

- UI: `components/settings/NotificationsSettings.tsx`
- Backend: `backend/routes/notifications.js`, `backend/routes/userPreferences.js`
- DB: `notification_settings`, `notification_history`, `user_preferences`

Finding:

- Publisher and Notifications are separate systems.
- Publisher uses `telegram_publishers.bot_token_encrypted` per outbound channel.
- Settings Notifications uses `telegram.botToken` and `telegram.chatId` in user settings/preferences and is personal alert focused.
- `notification_settings` and `notification_history` are empty in current DB evidence.

Verdict:

- The note is conceptually true, but UX is confusing because both areas talk about Telegram bot tokens and channels.
- Redesign should introduce clearer copy or a shared Telegram credential/channel manager with separate usage modes:
  - personal alert bot
  - outbound DataHub publisher bot
  - collector/input channel identity

### ACL and Filter Compatibility

Public publisher API:

- Backend now respects ACL and publishing filters when `source_id` is supplied.
- UI publish path does not supply `source_id`, so it fails before useful policy behavior.

Legacy publish route:

- `POST /api/v1/data-sources/publish-telegram` enforces ACL and publishing filters when `source_id` is supplied.

Automation dispatch:

- `datahubAutomationService` supplies `source_id` and `data_type` when calling `runPublisherPublish`.
- It also checks publishing filters before queue insert and before publish dispatch path through publisher service.

Telegram Publisher tab:

- Test does not supply source context and does not enforce ACL/filter.
- Publish does not supply required source context and therefore fails.

### History Tab RCA

Backend:

- `publisher_delivery_history` is real.
- `GET /:id/history` returns paginated rows with `limit` and `offset`.

Frontend:

- Fetches 50 rows for selected publisher.
- Displays `historyItems.slice(0, 20)`.
- Maps `dry_run` and `test` to UI status `sent`, which hides the distinction from the user.
- Refreshes after test/publish via query invalidation.

Evidence:

- 24 history rows.
- 18 dry-run rows.
- 3 test rows.
- 2 sent rows.
- 1 failed row.

Verdict:

- Real history exists, but UI labeling is misleading because dry-runs/tests look like successful sends.

### Templates Tab RCA

Backend:

- No `publisher_templates` table.
- No template CRUD routes.
- Publisher has a single `template` column.
- `runPublisherPublish()` uses publisher template for message formatting.

Frontend:

- Templates tab displays selected publisher template in a `<pre>`.
- No edit/save/delete/select template behavior.

Verdict:

- Templates are **display-only**, not a real templates subsystem.

### Telegram Publisher UX Verdict

Overall: **PARTIAL**

Real:

- Publisher list/create/disable.
- Bot token storage as encrypted field.
- Test route and history writes.
- Live publish service path.
- Delivery history.
- ACL/filter enforcement on backend publish path when source context exists.

Broken or incomplete:

- Publish button omits `source_id` and `data_type`.
- Mapping rows are not clickable and do not map anything.
- Templates tab is display-only.
- Test button behavior is confusing because dry-run/test history can look like successful sends.
- Missing i18n keys show raw keys or confusing labels.
- History maps `dry_run`/`test` to sent-like UI status.
- Settings -> Notifications relationship is under-explained and duplicates Telegram credential concepts.

## Recommended P2 Implementation Plan

### DataHub Performance P2

1. Split `/data-sources/health` into a truly light health endpoint and a separate duplicate-quality endpoint.
2. Add timing instrumentation around `buildDataPipelineView()` sections.
3. Add/verify indexes for:
   - `collected_data(source_id, collected_at DESC)`
   - `collected_data(processed_at DESC)`
   - expression or generated column for effective ingestion timestamp instead of repeated JSON timestamp cast
   - `collected_data(status, processed_at)`
   - `telegram_messages(is_processed, processed_at)`
4. Replace correlated category counts with grouped aggregate by category.
5. Cache pipeline snapshot aggressively and serve stale cache while refresh is in progress.
6. Move automation topic list away from full pipeline snapshot; only refresh queue should load candidate records.
7. Batch ACL/filter checks in automation and ingestion paths using gateway batch helpers.
8. Add cached publishing rule evaluator support so automation enqueue does not reload active publishing rules per candidate.
9. Remove implicit `syncCrawlersFromDataSources()` side effects from `GET /data-hub/crawlers`; move sync to explicit POST or background job.
10. Review nginx/proxy timeouts and make slow DataHub endpoints return 202/cache status rather than blocking UI.

### Telegram Publisher P2

1. Add real source/channel mapping model or explicitly remove the mapping UI until implemented.
2. Update Publish UI to require/select `source_id` and send `data_type`.
3. Decide whether Test should be source-aware and policy-aware; if yes, add `source_id` to test schema and UI.
4. Add all missing i18n keys in English and Farsi locales.
5. Redesign History UI to distinguish `sent`, `dry_run`, `test`, and `failed`.
6. Convert Templates tab into real edit/save flow or label it "Current Template Preview".
7. Clarify bot token state:
   - configured
   - missing: dry-run only
   - invalid/decrypt failed
   - live send disabled by environment dry-run
8. Clarify Settings -> Notifications vs DataHub Publisher:
   - separate personal notifications
   - separate outbound channel publishing
   - optional shared credential manager later
9. Add integration tests for UI payload contract:
   - publish without source_id fails with clear UI error
   - publish with mapped source_id passes validation and reaches ACL/filter checks
   - dry-run/test status is rendered accurately

## Final Classification

DataHub Performance: **DEGRADED**

Primary cause:

- Heavy DataHub aggregate queries and pipeline snapshot work.

Secondary causes:

- Automation reusing `buildDataPipelineView()`.
- Enforcement checks inside loops.
- nginx/frontend timeout behavior for slow endpoints.

Not primary cause:

- Global Access Control Gateway overhead.
- Filter Rules Gateway overhead on read-only list/summary endpoints.

Telegram Publisher: **PARTIAL**

Primary issue:

- Backend publish path is now correctly stricter, but frontend does not provide required source context.

Secondary issues:

- Missing translations.
- Mapping is UI-only.
- Templates are display-only.
- History status is misleading.
- Settings Notifications relationship needs product/UX redesign.
