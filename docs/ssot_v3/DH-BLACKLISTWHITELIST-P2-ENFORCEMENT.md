# DH-BLACKLISTWHITELIST-P2-ENFORCEMENT

Date: 2026-06-18

## Verdict

Before: PARTIAL

After: REAL ENFORCED

Commit hash: recorded in the final task response after commit creation.

## Enforcement Map

Central gateway: `backend/services/filterRulesGateway.js`

Exports:

- `enforceIngestionPolicy({ sourceId, url, text, dataType, rawData, metadata, userId })`
- `enforcePublishingPolicy({ sourceId, url, text, dataType, message, metadata, userId })`
- `filterAllowedForIngestionBatch(items)`
- `filterAllowedForPublishingBatch(items)`

Production runtime paths now use the gateway instead of directly calling lower-level rule helpers:

- DataFetcher ingestion: `data_fetcher`
- Collected data API single insert: `collected_data_api`
- Collected data API batch insert: `collected_data_batch_api`
- Crawler ingestion and dry-run checks: `crawler_ingest`, `crawler_dry_run`
- Telegram transfer pipeline: `telegram_transfer_pipeline`
- Discovery simulation/approval checks: gateway evaluator path
- Telegram Publisher API dry-run/live publish: `telegram_publisher`
- Legacy publish route: `legacy_publish_telegram`
- Automation queue candidate check: `automation_enqueue`
- Evaluate API: gateway simulation helper

Rule target semantics are preserved:

- Ingestion considers `apply_target = ingestion` and `both`.
- Publishing considers `apply_target = publishing` and `both`.
- Current whitelist behavior is unchanged: whitelist only overrides a matching top-priority blacklist; no matching rule means allow.

## Bypasses Closed

- `DataFetcherService.saveFetchedData` no longer inserts directly into `collected_data`; each new item must pass `enforceIngestionPolicy`.
- Public Telegram publisher dry-runs are blocked by publishing rules before publisher lookup/history/send execution.
- Legacy `/api/v1/data-sources/publish-telegram` blocks publishing rules before `sendMessage`/`sendPhoto`.
- Automation queue insertion checks publishing policy before queue insert.
- Existing ingestion paths were routed through the central gateway.

## Audit

Blocked events write `data_hub_logs` with:

- `action = filter_blocked`
- `status = failure`
- metadata including `source_id`, `rule_id`, `rule_type`, `scope`, `pattern`, `apply_target`, `enforcement_path`, `data_type`, `url`, and `reason`.

Runtime audit evidence included blocked records for:

- `data_fetcher`
- `collected_data_api`
- `telegram_publisher`
- `legacy_publish_telegram`

Automation blocking is covered by unit test evidence because the production pipeline snapshot path is slow and may not select the synthetic record deterministically during runtime verification.

## Tests

Command:

```bash
npm test -- __tests__/unit/filterRulesGateway.test.js __tests__/unit/dataFetcherFilterRules.test.js __tests__/unit/telegramPublisherFilterRules.test.js __tests__/unit/datahubAutomationFilterRules.test.js __tests__/unit/telegramPipelineFilterRules.test.js __tests__/unit/datahubCrawlersFilterRules.test.js --runInBand --no-coverage --silent --forceExit
```

Result:

- Test Suites: 6 passed, 6 total
- Tests: 10 passed, 10 total

Covered files:

- `backend/__tests__/unit/filterRulesGateway.test.js`
- `backend/__tests__/unit/dataFetcherFilterRules.test.js`
- `backend/__tests__/unit/telegramPublisherFilterRules.test.js`
- `backend/__tests__/unit/datahubAutomationFilterRules.test.js`
- `backend/__tests__/unit/telegramPipelineFilterRules.test.js`
- `backend/__tests__/unit/datahubCrawlersFilterRules.test.js`

## Build

Command:

```bash
npm run build
```

Result:

- Success: `✓ built in 25.26s`
- Existing Vite warnings remain for stale browser data, large chunks, and unrelated missing named exports in legacy frontend modules.

## Runtime Verification

Backend restart:

- `pm2 restart titan-backend --update-env`
- `titan-backend` cluster workers returned online.

Temporary rules:

- Ingestion keyword blacklist: `DH_FILTER_BLOCK_TEST`
- Publishing keyword blacklist: `DH_PUBLISH_BLOCK_TEST`

Runtime evidence:

- DataFetcher: `beforeFetcher=0`, `afterFetcher=0`, result `newItems=0`, `skippedFiltered=1`.
- Collected data API: `403`, `code=FILTER_RULE_BLOCKED`, reason `blacklist_match`.
- Publisher API dry-run/live path: `403`, `code=FILTER_RULE_BLOCKED`, reason `blacklist_match`.
- Legacy publish route: `403`, `code=FILTER_RULE_BLOCKED`, reason `blacklist_match`.
- Evaluate ingestion: `200`, `allowed=false`, `blocked=true`, reason `blacklist_match`.
- Evaluate publishing: `200`, `allowed=false`, `blocked=true`, reason `blacklist_match`.
- Automation simulation: queue stayed `0 -> 0`, `added=0`.

Cleanup evidence:

- Temporary rules removed.
- Temporary source, publisher, topic, queue data, sessions, and users removed.
- `datahub_filter_rules` count returned to previous count: `0`.
- Leftover temporary rules: `0`.
- Leftover temporary publishers: `0`.

## Regression Checks

Status checks:

- `GET /api/v1/data-hub/filter-rules`: 200
- `GET /api/v1/data-sources?limit=5`: 200
- `GET /api/v1/data-hub/telegram-publishers`: 200
- `GET /api/v1/data-hub/automation/topics`: 200
- `GET /api/v1/data-hub/crawlers`: 200
- `GET /api/v1/data-sources/pipeline`: 200

The pipeline/automation endpoints are slow in this environment; final status checks used `curl --max-time 600`.

## Remaining Limitations

- Whitelist semantics are not strict allow-list semantics in P2. A future P3 strict allow-list mode should be considered if product requirements change.
- Automation runtime verification depends on the production pipeline snapshot selection. The deterministic enforcement guarantee is covered by unit tests and the production enqueue code path.
- Some regression endpoints are slow due existing DataHub aggregate queries; this is performance debt, not a filter enforcement bypass.
