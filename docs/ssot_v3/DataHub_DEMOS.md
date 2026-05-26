## DataHub Runtime Demos

### Demo index (v3.0 release checkpoint)

| Area | Section in this file | GAP / status |
|------|----------------------|--------------|
| **Sources** | `dataHub.sources` | GAP-008 · Design Done |
| **Categories** | `dataHub.categories` | GAP-010 · Design Done |
| **Pipeline** | `dataHub.pipeline` | GAP-012 · Design Done |
| **Logs** | `dataHub.logs` | GAP-013 · Design Done |
| **Telegram** | `dataHub.telegram` | GAP-006 security · Implemented |
| **Access Control** | `dataHub.advanced.access` | GAP-022 · Design Done |
| **Telegram Publisher** | `dataHub.advanced.telegramPublisher` | GAP-016 · Design Done |
| **Automation** | `dataHub.advanced.automation` | GAP-018/019 · Design Done |
| **Blacklist/Whitelist** | `dataHub.advanced.blacklist` | GAP-024 · Design Done |
| **Crawlers** | `dataHub.advanced.crawlers` | GAP-026 · Design Done |
| **Discovery** | `dataHub.advanced.discovery` | GAP-028 · Design Done |
| **Prioritization** | `dataHub.advanced.prioritization` | GAP-030 · Design Done |
| **Archiving** | `dataHub.advanced.archiving` | GAP-032 · Design Done |
| **Pipeline Health Overview** | `dataHub.advanced.pipelineHealth` | GAP-034 (latency API) · v3.0 safe metrics |
| **Health Monitoring** | `dataHub.health` | GAP-035 (avg response/cache API) · Design Done |
| **Header summary KPIs** | `dataHub.summary` | GAP-035 (cache) · backend `/stats` + `/health` |

---

### dataHub.telegram – Telegram Panel / Agents / Breaking News

- **Success Scenario (healthy pipeline)**  
  1. Backend و سرویس `telegram-collector` را طبق ENVIRONMENT بالا بیاورید (Postgres متصل، migrations اعمال شده).  
  2. با کاربر دارای توکن معتبر وارد UI شوید و به تب `AI Center → DataHub → Telegram` بروید.  
  3. در پنل Telegram، health و System Overview را بررسی کنید؛ مقادیر `total_messages`, `processed`, `actionable`, `active_channels` باید از `/api/v1/telegram/health` و `/agents/summary` پر شوند.  
  4. روی تب `AI Inbox` کلیک کنید؛ لیست ایجنت‌ها از `/api/v1/telegram/agents/summary` لود می‌شود، روی یک Agent کلیک کنید تا `AgentDetailPanel` باز شود و پیام‌ها از `/api/v1/telegram/agents/:agentKey/feed` لود شوند؛ دکمه `✓ Mark Processed` یک پیام را حذف کرده و روی `/agents/:agentKey/mark-processed` اثر می‌گذارد.  
  5. به تب `Breaking News` بروید؛ اسلایدر Min Impact را روی ۰.۷ بگذارید و چند بار Refresh بزنید؛ کارت‌های خبر از `/api/v1/telegram/breaking-news` می‌آیند و دسته‌بندی/regions در Geographic Map از `/api/v1/telegram/events/recent` پر می‌شود.

- **Failure Scenario (backend / DB issue)**  
  1. با همان کاربر وارد UI شوید اما عمداً backend Telegram یا DB مربوط به جداول تلگرام را متوقف کنید (یا migrations را اعمال نکنید).  
  2. صفحه `AI Center → DataHub → Telegram` را رفرش کنید.  
  3. درخواست‌های `/api/v1/telegram/health` یا `/agents/summary` باید با خطای ۵xx برگردند و در UI بنر خطا/پیام مناسب نمایش داده شود (بدون crash کامپوننت).  
  4. تلاش برای باز کردن `AgentDetailPanel` یا تب `Breaking News` باید پیام خطای متنی (متن i18n شده یا fallback خوانا) را نشان دهد و state UI در وضعیت امن باقی بماند.  
  5. لاگ‌های backend باید پیام‌های خطای `Telegram health check failed` یا `Error fetching agents summary / breaking news` را ثبت کرده باشند تا برای دیباگ قابل ردیابی باشد.

- **Auth Scenario (prod – `TELEGRAM_READ_MODE=auth-role`)**  
  1. در محیطی که `NODE_ENV=production` و `TELEGRAM_READ_MODE=auth-role` تنظیم شده، یک درخواست به `/api/v1/telegram/agents/summary` بدون هدر `Authorization` بفرستید → باید `401 Unauthorized` برگردد (و در UI خطای مناسب health/summary نمایش داده شود).  
  2. با توکن کاربری که نقش او در بین `['admin','trader','analyst','viewer']` نیست، همان درخواست را ارسال کنید → باید `403 Insufficient permissions` برگردد و UI بنر خطا را بدون crash نشان دهد.  
  3. با کاربر لاگین‌شده دارای نقش مجاز (مثلاً `admin` یا `trader`) وارد UI شوید و به `AI Center → DataHub → Telegram` بروید؛ تمام روت‌های read-only تلگرام (health, summary, feed, breaking-news, events, categories, stats) باید `200` بدهند و تب تلگرام طبق سناریوی موفق بالا کار کند.
  
### dataHub.sources – Data Sources (GAP-008 · Design-1 Done)

- **Visual / design check (Design-1)**  
  1. `AI Center → DataHub → Sources`: outer section = slate gradient shell (`border-white/5`), four metric mini-cards (Total / Active / Errors / Telegram).  
  2. Source rows: `bg-slate-900/60` cards, status + priority pills (emerald/red/amber), action buttons `rounded-full` outline (purple/emerald/sky).  
  3. **Add Source** / **Edit**: modal overlay `bg-black/60 backdrop-blur-sm`, panel gradient §10; inputs `bg-slate-950/80 border-slate-700`; type `web` shows crawler block + **Render JavaScript** toggle (not raw checkbox).  
  4. Empty: centered muted message in inner list; loading: `sources_loading` text; 409/500: amber/red `text-[11px]` alert + Retry on 500.  
  5. Switch locale en/fa: titles, metrics, buttons without English fallback strings in panel chrome.

- **Success Scenario (UI: create → update → soft delete → restore → hard delete)**  
  1. با کاربر دارای `titan_token` وارد شوید → `AI Center → DataHub → Sources`. در DevTools → Network باید `GET /api/v1/data-sources?page=1&limit=20` با پاسخ `{ data, pagination }` دیده شود (نه `fetchDataHubState`/IndexedDB).  
  2. **Create**: «Add Source» → فرم را پر کنید → Save. Network: `POST /api/v1/data-sources` → `201`؛ لیست با invalidate/refetch به‌روز می‌شود.  
  3. **Update**: Edit همان منبع → تغییر `category` یا interval → Save. Network: `PUT /api/v1/data-sources/:id` → `200`؛ `data_hub_logs` رکورد «Source updated».  
  4. **Soft delete**: از mutation/API `DELETE /api/v1/data-sources/:id` (بدون `hard=true`) → `204`؛ `is_active=false` در DB.  
  5. **Restore**: `PATCH /api/v1/data-sources/:id/restore` → `200`؛ منبع دوباره active در لیست UI.  
  6. **Hard delete** (فقط روی منبع بدون FK وابسته): `DELETE /api/v1/data-sources/:id?hard=true` → `204`؛ ردیف از DB حذف می‌شود.

- **Failure Scenario (UI: duplicate 409 + hard delete with FK 409)**  
  1. **Duplicate (409)**: منبعی با همان `name`+`type` بسازید → `POST` برمی‌گردد `409` با پیام duplicate؛ در UI بنر زرد/کهربایی conflict (یا هشدار duplicate در مودال) نمایش داده می‌شود.  
  2. **Validation (400)**: URL نامعتبر یا فیلد خالی ارسال کنید → `400` از zod؛ خطا inline در فرم Create/Edit (`errors.form` / فیلدها).  
  3. **FK conflict (409)**: `DELETE ...?hard=true` روی منبعی با `collected_data`/`data_queue` → `409` «Cannot delete data source: related data exists»؛ بنر conflict در تب Sources.  
  4. **Server (500)**: Postgres/backend down → `GET/POST` با `500`؛ UI بنر خطای سرور + دکمه **Retry** (refetch `useDataSourcesQuery`).

### dataHub.categories – Data Categories (GAP-010 · Design-1 Done)

- **Visual / design check (Design-1)**  
  1. `AI Center → DataHub → Categories`: same slate shell + four metric cards (Total / Filtered / Telegram-linked / Tracked).  
  2. Filters: slate inputs + purple Refresh / Add Category; category cards `border-white/5`, inflow/pass-rate sub-blocks, tag pills.  
  3. **Add Category** / **Edit**: `DataHubModal` with color swatches, icon select, tags/data-types placeholders i18n.  
  4. Empty filters vs empty API: `no_categories_match` vs `no_categories_yet`; 409/400/500 alerts match Sources pattern.  
  5. en/fa: `data_categories_desc`, filter placeholders, metric labels.

- **Success Scenario (create → update → delete)**  
  1. `AI Center → DataHub → Categories` → Network: `GET /api/v1/data-categories` (آرایه JSON؛ **نه** `fetchDataHubState`/IndexedDB).  
  2. **Create**: Add Category → نام یکتا → Save → `POST /api/v1/data-categories` → `201` + شیء category در پاسخ.  
  3. **Update**: Edit همان دسته → تغییر `description` یا `color` → Save → `PUT /api/v1/data-categories/:id` → `200`.  
  4. **Delete**: Delete روی دسته‌ای که هیچ `data_sources.category` به نام آن اشاره نمی‌کند → `DELETE /api/v1/data-categories/:id` → `200` + `{ message: 'Category deleted successfully' }`؛ لیست با refetch به‌روز می‌شود.

- **Failure Scenario (validation / conflict / dependency / server)**  

  | سناریو | Endpoint | Status | UI |
  |--------|----------|--------|-----|
  | Invalid payload (نام خالی، `color` غیر hex) | `POST` یا `PUT` | **400** | خطا inline در `CreateCategoryModal` (`formError`) |
  | Duplicate name | `POST` / `PUT` | **409** | `Category with this name already exists` — بنر conflict در تب Categories |
  | Delete while sources still reference category name | `DELETE` | **400** | پیام «Cannot delete category … N data source(s)» — بنر/ApiWrapper |
  | DB / backend down | `GET` / `POST` / `PUT` / `DELETE` | **500** | بنر خطای سرور + **Retry** (`useDataCategoriesQuery` refetch) |

  **توجه:** برای categories، حذف در صورت وابستگی source با **400** برمی‌گردد (نه 409). duplicate فقط روی unique `name` است (**409**).

### dataHub.pipeline – Data Pipeline (GAP-012 · Design-2 Done)

- **Visual / design check (Design-2)**  
  1. `AI Center → DataHub → Pipeline`: slate gradient shell + six metric mini-cards (records, normalized %, requests/passed/failed/pending 24h).  
  2. Snapshot History select + purple **Refresh Pipeline**; last refreshed line under title.  
  3. Category Screening + Source Quality Board tables: `border-slate-800` thead, row hover; status pills on sources.  
  4. Normalization Summary (four metrics) + Normalized data preview table when API returns rows.  
  5. Empty: `pipeline_empty_state`; loading: `pipeline_loading`; error: red alert + Retry.  
  6. en/fa: `data_preparation`, `refresh_pipeline`, filter placeholders.

| سناریو | Endpoint | Status / شرط | UI |
|--------|----------|----------------|-----|
| **Success** — snapshot + history + normalization | `GET /api/v1/data-sources/pipeline` | **200** + `{ snapshot, history, normalizationSummary, normalizedData }` | DevTools: فقط این URL برای دادهٔ Pipeline (نه IndexedDB). کارت‌های **Total Records** / **Normalized %** از `snapshot.*`. اگر `history.length > 0`، **Snapshot History** پر می‌شود. **Refresh Pipeline** = refetch همان GET. |
| **Empty state** — بدون `collected_data` | `GET /api/v1/data-sources/pipeline` | **200** + `snapshot.totalRecords === 0` | پیام «No snapshot available yet…»؛ بدون crash. |
| **Failure** — backend / DB down | `GET /api/v1/data-sources/pipeline` | **500** یا network error | `ApiWrapper` بنر خطا + **Retry** (`usePipelineQuery` refetch). Sources/Categories همچنان از API خودشان کار می‌کنند. |

**پیش‌نیاز success:** Postgres + migrations؛ چند رکورد `collected_data` (با/بدون `normalized_data`) seed شده باشد.

### dataHub.logs – Access Logs (GAP-013 · Design-2 Done)

- **Visual / design check (Design-2)**  
  1. `AI Center → DataHub → Logs`: slate shell; four status metric cards (success/cached/failed/timeout).  
  2. Filters: slate inputs, status select, **Telegram Only** pill toggle, Reset + Export CSV.  
  3. Table: sticky slate thead; status pills; telegram rows with sky tint + badge; error row expands below with translated telegram errors.  
  4. Empty: `no_logs`; loading: `logs_loading`; 500: alert + Retry (refetch via parent refresh).  
  5. Load more uses `load_more` when filtered list exceeds visible window.

| سناریو | Endpoint | Status / شرط | UI |
|--------|----------|----------------|-----|
| **Success** — list + status counts | `GET /api/v1/data-sources/access-logs?limit=100&offset=0` | **200** + `{ data[], pagination: { total, limit, offset, hasMore }, statusCounts: { success, error, warning } }` | Network: **فقط** این URL (نه `fetchDataHubState`). جدول لاگ از `data[]`؛ badgeها از `statusCounts`. صفحه بعد: `offset=100` (max `limit=500`). |
| **Empty state** — بدون log | `GET .../access-logs` | **200** + `data: []`, `pagination.total: 0`, counts صفر | «No access logs yet»؛ `ApiWrapper` بدون crash. |
| **Failure** — backend / DB error | `GET .../access-logs` | **500** `{ error: "Failed to fetch access logs" }` یا قطع شبکه | بنر خطا در `LogsPanel` + **Retry** → `refetch` در `useAccessLogsQuery`؛ تب‌های Sources/Categories/Pipeline unaffected. |

**پیش‌نیاز success:** حداقل یک رکورد در `data_hub_logs` (مثلاً بعد از `PUT /api/v1/data-sources/:id` که audit insert می‌زند).

**Auth:** بدون `Authorization` → **401** (authenticate). RBAC نقش → GAP-014 (فعلاً هر authenticated user).

### dataHub.advanced.telegramPublisher – Telegram Publisher (GAP-016 · Design-3 Done)

- **Visual / design check (Design-3)**  
  1. `DataHub → Advanced → Telegram Publisher`: `DATAHUB_SHELL` + four metric cards (channels, delivered, failed, success rate).  
  2. Tabs Channels / History / Templates with purple underline; channel cards `border-white/5` + outline actions (Test/Publish/Disable).  
  3. **New Channel** opens `DataHubModal` §10 (slate inputs).  
  4. History tab: slate list rows + status pills (`publisher_status_sent` / `failed`).  
  5. en/fa: no `t() ||` fallbacks in panel chrome.

| سناریو | Endpoint | Status / شرط | UI |
|--------|----------|----------------|-----|
| **Success — create** | `POST /api/v1/data-hub/telegram-publishers` | **201** | فرم New Channel → لیست با `GET` refetch |
| **Success — test** | `POST .../telegram-publishers/:id/test` | **200** + `dry_run` یا `test` | دکمه Test؛ رکورد در history |
| **Success — publish (dry-run)** | `POST .../:id/publish` + `confirm_publish: true` در dev/test یا بدون bot token | **200** + `status: dry_run` | history ثبت می‌شود؛ پیام dry-run در UI |
| **Success — publish (live)** | `POST .../:id/publish` + `confirm_publish: true` + token + prod | **200** + `status: sent` | فقط بعد از `window.confirm` |
| **Success — history** | `GET .../:id/history` | **200** + `data[]` | تب History + انتخاب channel |
| **Empty** | `GET .../telegram-publishers` | **200** + `publishers: []` | Empty state «No channels configured» |
| **Failure — invalid Telegram channel/token** | `POST .../test` یا `.../publish` | **200** body `status: failed` | خطا در UI + ردیف failed در history |
| **Failure — backend down** | هر endpoint | **500** / network | `ApiWrapper` + refetch |

#### Publish — Security sanity (GAP-016)

| سناریو | Request | Expected | UI / history |
|--------|---------|----------|----------------|
| **No JWT** | `POST .../publish` بدون `Authorization` | **401** | بنر authenticate |
| **Wrong role** | JWT با نقش `viewer` (نه admin/trader) | **403** | Insufficient permissions |
| **Live blocked — no confirm** | admin/trader + `confirm_publish: false` | **400** `confirm_publish must be true` | هیچ ارسال live |
| **Live blocked — no bot token (prod)** | `confirm_publish: true`، بدون `bot_token`، `NODE_ENV=production`، `TELEGRAM_PUBLISHER_DRY_RUN` unset/false | **401** `Bot token required for live publish` | failed در history |
| **Dry-run (dev/test)** | همان publish با token خالی در dev | **200** + `dry_run: true` | history با `status: dry_run` |

**پیش‌نیاز:** migration `025_create_telegram_publishers.sql`؛ `MASTER_KEY` برای encrypt bot token (live در prod).

### dataHub.advanced.automation – Automation (GAP-018/019 · Design-3 Done)

- **Visual / design check (Design-3)**  
  1. `DataHub → Advanced → Automation`: slate shell + summary metrics + **Dry-run** `DataHubToggle`.  
  2. Schedule panel: purple border + toggle §12; queue table slate thead + pills.  
  3. Topic cards slate; **Add Topic** / queue **View** use `DataHubModal`.  
  4. Execution history: inline slate blocks + status pills (sent/failed/dry-run).  
  5. en/fa keys for loading, dispatching, queue empty.

| سناریو | Endpoint | Status / شرط | UI |
|--------|----------|----------------|-----|
| **Success — create topic** | `POST /api/v1/data-hub/automation/topics` | **201** | Add Topic → لیست refetch |
| **Success — refresh queue** | `POST .../automation/queue/refresh` | **200** + `added` | Refresh queue |
| **Success — manual dispatch** | `POST .../automation/queue/dispatch` | **200** + `processed` | Dispatch (dry-run toggle) |
| **Success — test run** | `POST .../automation/test-run` | **200** dry-run default | Test run |
| **Success — execution history** | `GET .../automation/overview` یا `/executions` | **200** | Execution History panel |
| **Success — retry failed** | `POST .../executions/:id/retry` | **200** | Retry on failed row |
| **Failure — dispatch no token (prod)** | dispatch → publisher publish | **401** در execution | failed + retry |
| **Schedule persist** | `PUT .../automation/schedule` | **200** | Schedule panel (no auto-cron v3.0) |

**پیش‌نیاز:** migrations `026`, `027`؛ telegram publishers (GAP-016) برای publish targets.

#### Migration + DB demo verified (2026-05-24)

```bash
cd backend && npm run migrate   # titangold_db — PASS (025, 026, 027 applied)
node scripts/verify_automation_demo.js
```

| Step | Result |
|------|--------|
| Tables `datahub_automation_*` | 4 tables present |
| Create topic | OK |
| Queue refresh | `added: 3`, `pending: 5` |
| Fail queue item + execution row | OK |
| Retry failed execution | OK |
| Manual dispatch dry-run | `processed: 1`, history `dry_run` |

Root-cause fix: `012_add_ab_testing` FK removed (partitioned `ai_decisions`). Details: `docs/ssot_v3/audit/ENVIRONMENT.md` § Migration verification.

### dataHub.advanced.access – Access Control (GAP-022 closed)

| سناریو | Endpoint | Expected | UI |
|--------|----------|----------|-----|
| **List rules** | `GET /api/v1/data-hub/access-control` | **200** + `rules[]` per active source | Permissions list (slate cards) |
| **Upsert** | `POST /api/v1/data-hub/access-control/:sourceId` | **200** | Configure modal → Save |
| **Reset** | `DELETE .../:sourceId` | **200** | Reset → default access |
| **Auth write** | POST/DELETE without admin/trader | **403** | — |

Design: full pass per `DESIGN_SYSTEM_DATAHUB.md` (modal §10, metrics §2.4, badges §7).

### dataHub.advanced.blacklist – Filter rules (GAP-024 closed)

| سناریو | Endpoint | Expected | UI |
|--------|----------|----------|-----|
| **List rules** | `GET /api/v1/data-hub/filter-rules` | **200** + `rules[]` | Blacklist / Whitelist / All Rules tabs |
| **Create blacklist domain** | `POST` `{ rule_type: blacklist, scope: domain, pattern: evil.com, match_type: contains, apply_target: ingestion }` | **201** | Add rule → Save |
| **Create whitelist source** | `POST` `{ rule_type: whitelist, scope: source, pattern: <uuid>, match_type: exact }` | **201** | Whitelist tab |
| **Create keyword regex** | `POST` `{ scope: keyword, match_type: regex, pattern: spam\|scam }` | **201** | All Rules tab |
| **Evaluate blocked** | `POST /evaluate` `{ url, text, apply_target: ingestion }` with matching blacklist | **200** `allowed: false` | Evaluate tab → Blocked |
| **Evaluate allowed** | `POST /evaluate` with whitelist match or no rules | **200** `allowed: true` | Evaluate tab → Allowed |
| **Soft delete** | `DELETE /:id` | **200** `deleted_at` set | Delete → confirm |
| **Invalid regex** | `POST` with `match_type: regex`, `pattern: [` | **400** | Modal / API error message |
| **Duplicate rule** | Same `rule_type+scope+pattern+match_type` active row | **409** | Conflict message |
| **Ingestion enforce (single)** | `POST /api/v1/collected-data` with active blacklist rule | **403** `{ code: "FILTER_BLOCKED", details }` | — |
| **Ingestion enforce (batch)** | `POST /api/v1/collected-data/batch` with same payload | **200** body includes `blocked` incremented (row skipped, not inserted) | — |
| **Telegram pipeline** | `transferTelegramMessagesToPipeline()` before INSERT | blocked messages → `summary.skipped++`, `action: filter_blocked` | — |
| **Publishing path** | automation dispatch / publisher worker | **No silent drop in v3.0** — use `POST /filter-rules/evaluate` only | GAP-025 v3.1 |
| **Auth write** | POST/PUT/DELETE without admin/trader | **403** | — |

**Priority / conflict:** higher `priority` wins; tie at same priority → **whitelist** beats **blacklist**.

#### Ingestion enforcement proof (code + runtime)

| Path | File | Behavior |
|------|------|----------|
| Single insert | `backend/routes/collected-data.js` | `enforceIngestionFilter()` before duplicate check / INSERT → **403** on block |
| Batch insert | `backend/routes/collected-data.js` | per-message `enforceIngestionFilter()` → catch `FILTER_BLOCKED` → `results.blocked++`, `continue` |
| Telegram → collected_data | `backend/services/telegramPipeline.js` | `enforceIngestionFilter()` before INSERT; skip row on block |
| Publishing workers | — | **Not hooked in v3.0**; evaluate API only until **GAP-025** |

**Manual proof (dev DB `titangold_db`):**

1. Create blacklist domain rule (`apply_target: ingestion`).
2. `POST /api/v1/collected-data` with `metadata.url` or text matching pattern → expect **403**.
3. `POST /api/v1/collected-data/batch` with N messages, one blocked → response `blocked >= 1`, `inserted` excludes blocked rows.
4. `POST /api/v1/data-hub/filter-rules/evaluate` with `apply_target: publishing` → **200** (policy check only; no worker side-effect).

Migration: see `docs/ssot_v3/audit/ENVIRONMENT.md` § Migration 028 · Evidence lines: `docs/ssot_v3/EVIDENCE.md` § Filter rules.

Design: slate shell, metric cards, `FilterRuleModal`, no IndexedDB / `services/api.ts` blacklist helpers in panel.

### dataHub.advanced.crawlers – Web/RSS crawlers (GAP-026 closed)

| سناریو | Endpoint | Expected | UI |
|--------|----------|----------|-----|
| **List** | `GET /api/v1/data-hub/crawlers` | **200** `{ crawlers, summary }` | Crawlers panel |
| **Create website** | `POST` `target_type: website`, `source_id` or `source{}`, selectors | **201** | Add crawler → website |
| **Create RSS** | `POST` `target_type: rss`, `max_depth: 0` | **201** | Add crawler → RSS |
| **Manual dry-run** | `POST /:id/run` `{ dry_run: true }` | **200** run `success`, no new `collected_data` rows | Dry run button |
| **Manual real run** | `POST /:id/run` `{ dry_run: false }` | **200** `items_ingested` ≥ 0 | Run now |
| **Pre-crawl blacklist** | Active domain blacklist on `start_url` | **403** `FILTER_BLOCKED_PRE_CRAWL` | Run fails before crawl |
| **Ingestion block** | Item URL matches blacklist mid-run | `items_blocked` incremented | Run history row |
| **Run history** | `GET /:id/runs` | **200** `runs[]` | History expand |
| **Timeout** | `timeout_ms` very low + slow URL | run `failed`, `error_message` timeout | — |
| **Invalid URL** | bad `start_url` on create | **400** | Modal validation |
| **render_js blocked** | `render_js: true`, env without `CRAWLER_RENDER_JS_ENABLED=true` | **400** `RENDER_JS_DISABLED` | Warning in UI |

**Double safety:** `preCrawlFilterCheck` before run + `enforceIngestionFilter` per item before insert.

```bash
cd backend && npm run migrate   # 029_create_datahub_crawlers.sql
```

Design: slate shell, `WebCrawlerModal` §10, no IndexedDB crawler CRUD.

### dataHub.advanced.discovery – Auto Discovery (GAP-028 Closed)

**Success path (UI + API):**

| سناریو | Steps | Endpoint | Expected |
|--------|-------|----------|----------|
| Scan → pending suggestions | Run scan, open suggestions tab | `POST /scan` → `GET /suggestions?status=pending` | New rows `status=pending`, `priority_score` **0–100**; **no** new `data_sources` |
| Approve → create source | Approve one pending row | `POST /suggestions/:id/approve` | `data_sources` row; `created_source_id`; `approved_by`; suggestion `approved` |
| Reject with note | Reject + review note | `POST /suggestions/:id/reject` | `status=rejected`, `rejected_by`, `review_note`, `reviewed_at` |
| Duplicate | Re-scan known URL | `POST /scan` | `status=duplicate`, `duplicate_of_source_id` or `duplicate_of_suggestion_id`; not pending |
| Stats / history | Dashboard cards | `GET /stats`, `GET /history` | aggregates + scan audit rows |

**Failures (required):**

| Case | API | UI (`AutoDiscoveryConfig` + `ApiWrapper`) |
|------|-----|------------------------------------------|
| Blacklist / unsafe URL | scan `blocked++` or skip; filter on approve → `403 FILTER_BLOCKED` | Toast / blocked count; no pending for blocked URL |
| SSRF (`localhost`, private IP, `file://`, `ftp://`, `metadata.*`) | `SSRF_BLOCKED` **400** or skipped in scan counts | Error message; URL not queued |
| Invalid URL | `400` `INVALID_URL` | Inline / toast validation |
| Unauthorized approve/reject | `403` | Permission denied message |
| Rejected row | `rejected_by`, `reviewed_at` | Badge + note in history |
| DB down / API error | `500` | **Error banner** + **Retry** (refetch suggestions/stats) |

**v3.0 locked:** scan does **not** auto-create sources — only **approve** mutates `data_sources`.

```bash
cd backend && npm run migrate   # 030_create_datahub_discovery.sql
```

Design: `AutoDiscoveryConfig.tsx` slate shell · strict i18n · no IndexedDB discovery state.

#### Crawler runtime safety (enforced in code)

| Control | Default / rule | Failure |
|---------|----------------|---------|
| `render_js` | **false** | — |
| `render_js=true` without `CRAWLER_RENDER_JS_ENABLED=true` | server env | **400** `RENDER_JS_DISABLED` |
| `max_depth` | capped at **5** (schema + service) | **400** if RSS with depth > 0 |
| `max_pages_per_run` | default 50, max **500** | loop stops at cap |
| `respect_robots` | default **true** | `skipRobots` only when `respect_robots=false` (explicit override) |
| `timeout_ms` | wall-clock per run | run **failed** with timeout message |

Evidence: `docs/ssot_v3/EVIDENCE.md` § Crawler runtime safety.

### dataHub.advanced.prioritization – Smart Prioritization (GAP-030 Closed)

**Success path (v3.0):**

| سناریو | Endpoint | Expected |
|--------|----------|----------|
| Preview | `POST /api/v1/data-hub/prioritization/preview` | محاسبه/ذخیره `datahub_source_priorities` + `datahub_prioritization_runs`; **بدون** تغییر `data_sources.priority_score/tier` |
| Apply with confirm | `POST /api/v1/data-hub/prioritization/apply` (`confirm_apply=true`) | فقط این مسیر روی `data_sources.priority_score`, `priority`, `priority_updated_at` می‌نویسد |
| Manual override | `PUT /api/v1/data-hub/prioritization/sources/:sourceId/override` | ذخیره `override_score`, `override_note`, `overridden_by`, `overridden_at` (audit) |
| Sources view | `GET /api/v1/data-hub/prioritization/sources` | score نهایی 0–100 + `score_breakdown` JSONB |

**Failures (required):**

| Case | Expected |
|------|----------|
| Apply بدون confirm | `400` `CONFIRM_APPLY_REQUIRED` |
| Unauthorized apply/preview/override/settings | `403` |
| Invalid weights (sum != 100) | `400` `INVALID_WEIGHTS` |
| Disabled prioritization + preview/apply | `400` `PRIORITIZATION_DISABLED` |
| DB/API error | `500` + error banner + retry در UI |

### dataHub.advanced.archiving – Cold storage (GAP-032 Closed)

**Success path (v3.0):**

| سناریو | Endpoint | Expected |
|--------|----------|----------|
| Health | `GET /api/v1/data-hub/archiving/health` | `check_archive_health()` JSON |
| Archive dry-run | `POST /api/v1/data-hub/archiving/archive/preview` | `pending_count`; **no** row move |
| Archive apply | `POST /api/v1/data-hub/archiving/archive` (`confirm_archive=true`) | `archive_old_decisions`; stats in `ai_decisions_archive_stats` |
| Restore dry-run / apply | `POST .../restore/preview` / `POST .../restore` (`confirm_restore=true`) | preview count / `records_restored` |
| Purge preview | `POST /api/v1/data-hub/archiving/purge/preview` | `would_purge_count` only — **no delete** |
| Read archive | `GET /api/v1/data-hub/archiving/records` | paginated `ai_decisions_archive` rows |

**Failures (required):**

| Case | Expected |
|------|----------|
| Archive without confirm | `400` `CONFIRM_ARCHIVE_REQUIRED` |
| Restore without confirm | `400` `CONFIRM_RESTORE_REQUIRED` |
| Unauthorized mutate | `403` |
| DB/API error | `500` + UI retry |

### dataHub.advanced.pipelineHealth – Pipeline Health Overview (v3.0 safe metrics · GAP-034 latency API)

**UI:** `AI Center → DataHub → Advanced` — بخش پایین صفحه **Pipeline Health Overview** (`PipelineHealthOverview.tsx`).

| سناریو | Network | Expected UI |
|--------|---------|-------------|
| **Normal** | `GET /api/v1/data-sources/health` → `200` `{ status: healthy\|degraded, activeSources }`; `GET /api/v1/data-sources/stats` → `200` `{ active_sources, total_sources }` | System Status = ترجمه‌شده (Healthy/Degraded/…); Active Sources = `N / M` با اعداد معتبر؛ Avg Latency = **N/A** + tooltip «Latency metric not available yet» |
| **Empty stats** | `stats` → `{ active_sources: 0, total_sources: 0 }` | `0 / 0` — نه `/` یا `undefined` |
| **Missing latency metric** | (بدون endpoint latency در v3.0) | همیشه **N/A** + tooltip؛ هرگز `NaN ms` |
| **API failure** | health یا stats → `500` / network error | بنر خطا + Retry؛ skeleton در حین load؛ System Status fallback **Unknown** اگر health ناموفق و stats هم ناموفق |

**grep proof (no stale snapshot fields):**

```bash
rg "overallStatus|avgLatency|activeSources.*totalSources" components/ai/AIManager/tabs/DataHub/AdvancedFeatures.tsx
# → no matches
rg "PipelineHealthOverview|fetchDataHubSourcesHealth" components/ai/AIManager/tabs/DataHub/
```

### dataHub.summary – Header KPI cards (v3.0 backend-first)

**UI:** `AI Center → DataHub` — ردیف بالای تب‌ها (`DataHubSummaryCards.tsx`).

| سناریو | Network | Expected UI |
|--------|---------|-------------|
| **Success** | `GET /stats` + `GET /health` | Total/Active از `stats`؛ Health status از `health.status` (ترجمه‌شده)؛ Cache hit = **N/A** + tooltip |
| **Empty DB** | stats zeros | `0` / `0` / N/A / Degraded یا Healthy — بدون `45`/`75%` ساختگی |
| **API failure** | 500/404 | بنر `datahub_summary_load_error` + Retry؛ skeleton در load |

**Forbidden:** `dataHub.totalSources`, `dataHub.cache.hitRate`, `hitRate: 75` mock در `services/api.ts` برای این کارت‌ها.

```bash
rg "dataHub\\.cache\\.hitRate|dataHub\\.totalSources|dataHub\\.health\\.overall" components/ai/AIManager/tabs/DataHubTab.tsx
# → no matches (summary uses DataHubSummaryCards only)
rg "75\\.0%|hitRate\\.toFixed" components/ai/AIManager/tabs/DataHub/
# → no matches in summary path
```

### dataHub.health – Health Monitoring (v3.0 backend-first · GAP-035 avg response/cache API)

**UI:** `AI Center → DataHub → Health` (`HealthPanel.tsx`).

| سناریو | Network | Expected UI |
|--------|---------|-------------|
| **Success** | `GET /health`, `GET /stats`, `GET /state`, `GET /access-logs?limit=1` (برای `statusCounts`) | Overall status ترجمه‌شده؛ Active/Total sources اعداد معتبر؛ Logged errors = `statusCounts.error`؛ Last check = `formatTimeAgo(timestamp)`؛ Sources by type (telegram/rss/api)؛ Avg response + Cache = **N/A** + tooltip |
| **Empty** | `stats` → zeros؛ `access-logs` → `error: 0` | همه شمارنده‌ها `0` — نه `undefined`/`NaN`/`/` |
| **API failure** | هر یک از health/stats/state/access-logs → خطا | بنر `datahub_health_load_error` + Retry؛ skeleton در load |

**Forbidden in UI:** `Undefined`, `NaN ms`, `health.averageResponseTime.toFixed`, `cacheHitRate.toFixed` روی دادهٔ IndexedDB.

```bash
rg "checkDataHubHealth|health\\.averageResponseTime|health\\.cacheHitRate" components/ai/AIManager/tabs/DataHub/HealthPanel.tsx
# → no matches (HealthPanel uses React Query + formatters)
```