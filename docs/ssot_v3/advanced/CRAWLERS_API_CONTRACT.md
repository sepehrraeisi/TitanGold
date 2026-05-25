# DataHub Advanced — Web Crawlers API Contract (v3.0 draft)

> Subtab: `dataHub.advanced.crawlers` · UI: `WebCrawlerConfig.tsx`  
> Replaces: IndexedDB `data_hub_state.advanced.webCrawlers` + `services/api.ts` `createWebCrawler` / `updateWebCrawler` / `deleteWebCrawler`  
> Existing engine: `backend/services/webCrawler.js` (`WebCrawlerService`), `backend/services/fetchers/webCrawlerFetcher.js`

**Status:** Draft — **awaiting product approval before implementation (proposed GAP-026).**

---

## 1) Target types (crawler kinds)

| Kind | v3.0 | Notes |
|------|------|--------|
| **`website`** | **Yes** | HTML crawl via `WebCrawlerService` (axios/cheerio, optional Playwright `renderJS`). Same-domain link follow. |
| **`rss`** | **Optional v3.0** | If approved: dedicated fetcher (`rss-parser` or HTTP + XML parse), no depth crawl — poll feed URL on schedule. |
| **`api`** | **Deferred v3.1** | JSON REST poll (headers/auth from `metadata`); align with `data_sources.type=api` separately. |

**Default for new crawlers:** `website`. UI shows kind badge; backend validates `target_type` enum.

**Link to Data Sources:** every crawler row **must** reference `data_sources.id` where `type IN ('web','rss')` (create source if missing, or pick existing). Crawler does not replace `data_sources` — it **schedules and runs** collection for that source.

---

## 2) Crawl depth, schedule, robots.txt

| Setting | v3.0 behavior | Storage field |
|---------|---------------|---------------|
| **Max depth** | `0` = single page only; `1..N` = same-host BFS (existing `config.depth` in `WebCrawlerService.crawl`) | `max_depth` INT default `0`, hard cap **5** |
| **Max pages** | Stop after N pages per run (safety) | `max_pages_per_run` INT default **50**, cap **500** |
| **Schedule** | Cron-like interval from UI today: `realtime` \| `1min` \| `5min` \| `15min` \| `30min` \| `1hour` \| `daily` | `schedule_interval` + `next_run_at` (computed server-side) |
| **Manual run** | **Required** — `POST /api/v1/data-hub/crawlers/:id/run` (async job, returns `run_id`) | — |
| **robots.txt** | **Respect by default** (`WebCrawlerService.fetchRobotsTxt` + `isAllowed`) | `respect_robots` BOOLEAN default **true** |
| **Render JS** | Per-crawler toggle (Playwright) | `render_js` BOOLEAN default **false** |
| **CSS selectors** | title/content/price/volume/date (existing UI shape) | `selectors` JSONB |
| **User-Agent** | Default `TitanGold-Bot/1.0`; optional override in `metadata` | `metadata.user_agent` |

**Scheduler v3.0:** DB-backed `next_run_at` + admin endpoint `POST /crawlers/refresh-queue` (no separate cron daemon required for MVP — can be called from existing worker tick or manual). Full daemon → v3.1 (GAP-020 pattern).

---

## 3) Storage model

**Recommendation (v3.0):** dedicated tables — **not** only IndexedDB / embedded `data_sources.config`.

### Migration `029_create_datahub_crawlers.sql` (proposed)

**`datahub_crawlers`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `source_id` | UUID FK → `data_sources(id)` ON DELETE CASCADE | required |
| `name` | VARCHAR | display label |
| `target_type` | `website` \| `rss` | |
| `start_url` | TEXT | seed URL / feed URL |
| `max_depth` | INT | |
| `max_pages_per_run` | INT | |
| `schedule_interval` | VARCHAR | enum above |
| `respect_robots` | BOOLEAN | |
| `render_js` | BOOLEAN | |
| `selectors` | JSONB | |
| `is_enabled` | BOOLEAN | |
| `last_run_at` | TIMESTAMPTZ | |
| `last_success_at` | TIMESTAMPTZ | |
| `last_error` | TEXT | |
| `error_count` | INT | |
| `next_run_at` | TIMESTAMPTZ | |
| `metadata` | JSONB | UA, headers, notes |
| `created_by` | UUID → users | |
| `deleted_at` | TIMESTAMPTZ | soft delete |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`datahub_crawler_runs`** (queue + history)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `crawler_id` | UUID FK | |
| `status` | `pending` \| `running` \| `success` \| `failed` \| `cancelled` | |
| `trigger` | `manual` \| `schedule` | |
| `pages_fetched` | INT | |
| `items_ingested` | INT | |
| `started_at` / `finished_at` | TIMESTAMPTZ | |
| `error_message` | TEXT | |
| `metadata` | JSONB | per-page errors, duration |

**Why not only `data_sources`?** Sources hold connection config; crawlers hold **schedule, run history, depth limits, and run lifecycle** — same split as automation topics vs sources.

---

## 4) Output path

| Step | v3.0 |
|------|------|
| Crawl result | Array of extracted objects from `WebCrawlerService` / RSS fetcher |
| Normalize | Map to `raw_data` + `normalized_data` (title, content, url, fetched_at) |
| Persist | **`POST` internal path → `collected_data`** (reuse ingestion service), **one row per page/item** |
| Filter rules | Call `enforceIngestionFilter()` before each insert (GAP-024) — blocked items counted in run metadata, not inserted |
| Source status | Update `data_sources.last_fetched_at` / health on run complete |

**No separate “crawler_items” table in v3.0** unless batch size forces staging — prefer direct `collected_data` + run stats.

---

## 5) API — `/api/v1/data-hub/crawlers`

Auth: `authenticate` read; write + run: `authorize('admin','trader')` + rate limit (same as filter-rules / automation).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List crawlers + summary counts (enabled, failed 24h, pending runs) |
| `GET` | `/:id` | Single crawler + last run |
| `POST` | `/` | Create crawler (validates `source_id`, URL, caps) |
| `PUT` | `/:id` | Update |
| `DELETE` | `/:id` | Soft delete |
| `POST` | `/:id/run` | **Manual run** — enqueue `datahub_crawler_runs` row, invoke worker |
| `GET` | `/:id/runs` | Paginated history |
| `POST` | `/refresh-queue` | Promote due crawlers (`next_run_at <= now`) to pending runs |
| `GET` | `/runs/:runId` | Run detail |

Evaluate safety preflight (optional v3.0): `POST /:id/preflight` → robots allowed?, domain in filter whitelist?, URL reachable (HEAD).

---

## 6) Safety & limits

| Control | v3.0 |
|---------|------|
| **Request timeout** | 10s HTTP (existing axios); 30s Playwright navigation |
| **Rate limit** | 1 req/s per domain (existing `enforceRateLimit`) |
| **Max pages / run** | `max_pages_per_run` enforced in service |
| **Max depth** | server cap 5 |
| **Domain allowlist** | **Not a new table** — reuse `datahub_filter_rules` (`scope=domain`, whitelist) optional strict mode: if any active domain whitelist exists, crawl host must match |
| **Domain blocklist** | `enforceIngestionFilter` on each output URL/text before `collected_data` insert |
| **Concurrent runs** | Max **3** global running crawlers (configurable) |
| **Run timeout** | 10 min wall-clock → mark run `failed` |

---

## 7) Frontend (after approval)

| Piece | Action |
|-------|--------|
| `services/dataHubCrawlersApi.ts` | CRUD + run + runs list |
| `hooks/useDataHubCrawlers.ts` | React Query |
| `WebCrawlerConfig.tsx` | Backend-first, slate shell (Design pass — GAP-023 pending crawlers) |
| `WebCrawlerModal.tsx` | Design §10 modal; depth, max pages, robots, render JS |
| Remove | `fetchDataHubState` / IndexedDB crawler CRUD from panel |

i18n: `web_crawlers_*`, `crawler_*` keys in 4 locale files (strict, no `\|\|` fallbacks in chrome).

---

## 8) GAP / SSOT targets (after implementation)

| GAP | Title | Status |
|-----|-------|--------|
| **GAP-026** (proposed) | Crawlers backend-first + run history | Open until approved |
| GAP-023 | Design pass | Move `crawlers` from Pending → Done |
| SSOT | `dataHub.advanced.crawlers` | **Implemented · Design: Done** |

---

## 9) Out of scope (v3.0)

- Distributed crawl cluster / multiple workers
- Sitemap-only mode, PDF/media binary extraction
- Per-crawler proxy pools
- Full `api` target type
- CSV export of crawl dumps

---

## 10) Open questions for approval

1. **`rss` in v3.0** — include in first ship or website-only?
2. **Strict domain whitelist** for crawls — enforce at run start vs only at ingestion?
3. **Auto-create `data_sources` row** from crawler modal vs require pre-existing source only?
4. **Playwright in production** — allowed on dev server (memory/CPU)? default `render_js=false`?

---

*Contract version: v3.0-draft · 2026-05-25 · **Awaiting approval** — do not implement until confirmed.*
