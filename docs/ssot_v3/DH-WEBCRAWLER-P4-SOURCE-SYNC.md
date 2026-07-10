# DH-WEBCRAWLER-P4 — Source Sync & Website Hardening

## Part A — Design decision

**Chosen: Option 2 — Idempotent sync**

Data Sources remain authoritative. On every `GET /api/v1/data-hub/crawlers` (and explicit `POST /sync`), the backend ensures one `datahub_crawlers` row exists per active `data_sources` row where `type IN ('rss','web')`, linked by `source_id`.

- Does **not** update or delete existing crawler rows (preserves manual configs and run history).
- Does **not** create duplicates when a crawler already exists for a source.
- Soft-disabled sources: crawler stays visible; `source_is_active=false` blocks non-dry-run (P2 guard).
- Hard-deleted sources: FK `ON DELETE CASCADE` unchanged.

Rejected Option 1 (virtual crawlers) because edit/run/history would need special-case handling across API and UI.

## Part B — Sync behavior

`syncCrawlersFromDataSources()` in `backend/services/datahubCrawlersService.js`:

| Source type | `target_type` | `start_url` | Ingestion owner | Run Now |
|-------------|---------------|-------------|-----------------|---------|
| `rss` | `rss` | source URL | `data_fetcher` (unless `config.crawler_mode=crawler`) | Blocked (P2) |
| `web` | `website` | source URL | `crawler` | Allowed when source active |

Auto-created rows include `metadata.synced_from_source: true`.

## Part C — UI

`WebCrawlerConfig.tsx`:

- Info banner explaining linked execution profiles.
- Per crawler: linked source name, source type, ingestion owner, run mode, duplicate-risk warning (RSS), recent outputs, run history.
- Auto-synced badge when `synced_from_source=true`.

## Part D — Website config hardening

`backend/services/webCrawlerSourceConfig.js` maps Data Sources web config → `webCrawlerService.crawl()`:

| Source config | Crawler config |
|---------------|----------------|
| `maxDepth` / `depth` | `config.depth` |
| `selector` (string) | `config.selectors.content` |
| `selectors` (object) | `config.selectors` |
| `respect_robots` / `respectRobots` | `skipRobots` (inverted) |
| `render_js` / `renderJS` | `config.renderJS` (env-gated in fetcher) |

`fetchFromWeb()` in `webCrawlerFetcher.js` uses this mapper.

## Part E — Production verification

### Before sync

| Metric | Count |
|--------|------:|
| RSS `data_sources` | 3 |
| Web `data_sources` | 0 |
| `datahub_crawlers` (non-deleted) | 1 |

Existing crawler preserved: `b1f6ab9b-e5bf-442e-9b72-3a006c075162` → `اقتصاد 24 دلار و ارز`.

### Sync run

```
{ rss_web_sources: 3, created: 2, skipped: 1, total_crawlers: 3 }
```

### After sync

| Metric | Count |
|--------|------:|
| RSS `data_sources` | 3 |
| `datahub_crawlers` | 3 |
| Duplicate `source_id` rows | 0 |

Idempotent re-run: `{ created: 0, skipped: 3 }`.

### Tests

- `webCrawlerSourceConfig.test.js` — config mapping (depth, selectors, robots, renderJS)
- `datahubCrawlersSync.test.js` — idempotent insert / skip
- `webCrawler.test.js` — updated to `crawl({ url, config })` API
- `datahubCrawlersArchitecture.test.js` — P2 guards unchanged

## Files changed

| File | Change |
|------|--------|
| `backend/services/datahubCrawlersService.js` | `syncCrawlersFromDataSources`, enrich `run_mode` / `synced_from_source` |
| `backend/services/webCrawlerSourceConfig.js` | New config mapper |
| `backend/services/fetchers/webCrawlerFetcher.js` | Use mapper |
| `backend/routes/data-hub-crawlers.js` | `POST /sync` |
| `components/.../WebCrawlerConfig.tsx` | Banner, source type, run mode |
| `services/dataHubCrawlersApi.ts` | Types for sync stats |
| `deploy/blue|green/locales/en.json`, `fa.json` | i18n |
| `backend/__tests__/unit/webCrawlerSourceConfig.test.js` | New |
| `backend/__tests__/unit/datahubCrawlersSync.test.js` | New |
| `backend/__tests__/integration/webCrawler.test.js` | API repair |

## Out of scope (unchanged)

- Telegram / Data Pipeline / Normalization
- Scheduler batch sizes / throughput
- No destructive migration or `collected_data` deletion
