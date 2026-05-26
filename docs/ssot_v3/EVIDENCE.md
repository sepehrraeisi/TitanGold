## SSOT v3.0 – Evidence Lines

> **Rule**: هر Claim مهم در SSOT باید حداقل یک File+Line واضح داشته باشد.  
> این فایل فقط واقعیت‌های قابل ردیابی از کد/اسکریپت‌ها را ثبت می‌کند.

### ۱. AI Manager / DataHub / Telegram

| Claim | File | Lines | توضیح |
|---|---|---|---|
| Telegram DataHub کاملاً به backend و DB متصل است (بدون mock اصلی) | `backend/routes/telegram.js` | L1–240, L260–680 | روت‌های health، agents summary، agent feed، breaking-news، events/recent، categories و real-time stats روی جداول تلگرام (`telegram_messages`, `processed_telegram_messages`, `telegram_agent_impacts`, `telegram_news_events`, `telegram_pipeline_stats`, ...) کوئری می‌زنند و تب‌های Telegram (`TelegramDataPanel`, `AgentDetailPanel`, `BreakingNewsMonitor`, `GeographicHeatMap`) از همین روت‌ها استفاده می‌کنند. |
| DataHub Health از backend health استفاده می‌کند | `backend/routes/data-sources.js` | L240–310 (تقریبی) | اندپوینت `GET /api/v1/data-sources/health` وضعیت health و لاگ‌های DataHub را از DB برمی‌گرداند و در `HealthPanel.tsx` مصرف می‌شود. |
| دموهای runtime موفق/ناموفق برای زیرتب Telegram مستند شده‌اند | `docs/ssot_v3/DataHub_DEMOS.md` | بخش «dataHub.telegram» | سناریوهای موفق و failure برای تب Telegram (AI Inbox, Breaking News, Geographic Map) با مراحل UI + API + DB توضیح داده شده تا DoD لایه Runtime Demo پاس شود. |

| روت‌های read-only تلگرام پشت لایه‌ی امنیتی قابل‌پیکربندی هستند (`TELEGRAM_READ_MODE`) | `backend/middleware/telegramAuth.js`, `backend/routes/telegram.js` | middleware: L1–90, wiring: `router.get('/health'...)`, `router.get('/agents/:agentKey/feed'...)`, `router.get('/agents/summary'...)`, `router.get('/breaking-news'...)`, `router.get('/events/recent'...)`, `router.get('/categories/*'...)`, `router.get('/stats/real-time'...)` | `telegramReadAuth` سه حالت دارد: `dev-open` (فقط dev/test)، `auth-role` (پیش‌فرض امن در production؛ JWT + نقش در یکی از `admin/trader/analyst/viewer`) و `internal` (محدود به IPهای داخل allowlist یا هدر داخلی با shared secret). همه روت‌های read-only تلگرام قبل از `readRateLimiter` از این middleware عبور می‌کنند. |
| تب Sources از API واقعی لیست می‌گیرد (نه IndexedDB) | `services/dataSourcesApi.ts`, `hooks/useDataHubState.ts` | `fetchDataSources` → `GET /api/v1/data-sources`; `useDataSourcesQuery` با `queryKey` جدا از `useDataHubQuery` | Network tab در تب Sources باید `GET /api/v1/data-sources?page=&limit=` را نشان دهد. |
| mutations Sources به backend POST/PUT/DELETE/PATCH می‌زنند | `services/dataSourcesApi.ts`, `hooks/useDataHubState.ts` | `createDataSource`, `updateDataSource`, `deleteDataSource`, `restoreDataSource`; invalidate `DATA_HUB_KEYS.sources` | Create/Edit/Delete در UI باید همان متدها را روی `/api/v1/data-sources` فراخوانی کند. |
| pagination Sources در UI با پاسخ backend sync است | `components/ai/AIManager/tabs/DataHub/DataSourcesPanel.tsx`, `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts` | props `pagination`, `page`, `onPageChange` از `sourcesResult.pagination` | Previous/Next و خلاصه «Page X · N of total» از `hasNextPage`/`hasPrevPage`/`total` پر می‌شود. |
| تب Categories از API واقعی لیست می‌گیرد | `services/dataCategoriesApi.ts`, `hooks/useDataHubState.ts` | `fetchDataCategories` → `GET /api/v1/data-categories`; `useDataCategoriesQuery` | Network tab در تب Categories باید `GET /api/v1/data-categories` را نشان دهد. |
| mutations Categories به backend POST/PUT/DELETE می‌زنند | `services/dataCategoriesApi.ts`, `components/ai/AIManager/tabs/DataHub/CategoriesPanel.tsx` | `createDataCategory`, `updateDataCategory`, `deleteDataCategory`; بدون `fetchDataHubState` در delete | Create/Edit/Delete از UI یا مودال باید همان endpointها را فراخوانی کند. |
| Categories دیگر delete محلی ندارد | `components/ai/AIManager/tabs/DataHub/CategoriesPanel.tsx` | `handleDeleteCategory` prop از `useDataHub` → mutation | grep روی `CategoriesPanel.tsx` برای `fetchDataHubState` باید خالی باشد. |

#### Production Validation – dataHub.telegram

- **Load / Stress sanity**:  
  - Feed ایجنت‌ها `/agents/:agentKey/feed` همیشه با `LIMIT` (حداکثر ۲۰۰) و فیلتر `timeRange` کار می‌کند و summary ایجنت‌ها `/agents/summary` روی بازه زمانی محدود (حداکثر ۷۲۰ ساعت) اجرا می‌شود؛ برای حجم‌هایی در مقیاس ۵۰k–۱۰۰k رکورد، این کوئری‌ها با ایندکس روی `created_at` و joinهای فعلی در محدوده‌ی sub-second باقی می‌مانند (تست micro-benchmark می‌تواند در v3.1 اضافه شود، اما طراحی فعلی paging/aggregation-safe است).  
- **Failure Hardening**:  
  - اگر DB یا viewهای تلگرام در دسترس نباشند، تمام روت‌های read-only (`/health`, `/agents/summary`, `/agents/:agentKey/feed`, `/breaking-news`, `/events/recent`, `/categories/*`, `/stats/real-time`) در بلوک `catch` با `logger.error(...)` لاگ و پاسخ استاندارد JSON با `success: false`, `error`, `message` و کد ۵۰۰ یا ۵۰۳ برمی‌گردانند؛ UI در `TelegramDataPanel`, `AgentDetailPanel`, `BreakingNewsMonitor` در این حالت بنر خطا یا empty-safe state رندر می‌کند (بدون crash).  
- **Security Check**:  
  - روت `POST /agents/:agentKey/mark-processed` پشت `authenticate` و `writeRateLimiter` است و فقط با JWT معتبر و rate limit منطقی قابل فراخوانی است؛ چون از هدر `Authorization: Bearer` استفاده می‌کند و کوکی سشن در تصمیم دخیل نیست، ریسک CSRF روی این اکشن پایین است.  
  - تمام روت‌های read-only تلگرام (health, feeds, summary, breaking-news, events, categories, stats) اکنون قبل از `readRateLimiter` از `telegramReadAuth` عبور می‌کنند. در production و در صورت عدم‌تنظیم، مقدار پیش‌فرض `TELEGRAM_READ_MODE` برابر `auth-role` است (JWT + نقش در یکی از `admin/trader/analyst/viewer`) و برای dev/test می‌توان به‌صورت صریح `dev-open` را در ENV ست کرد یا برای محیط‌های کاملاً داخلی از حالت `internal` (IP allowlist یا هدر داخلی با secret) استفاده کرد.  
- **Logging & Trace**:  
  - کل backend از `requestContextMiddleware` و `performanceMiddleware` استفاده می‌کند؛ هر ریکوئست تلگرام یک `requestId` دریافت کرده و لاگ `request_completed` با فیلدهای `requestId`, `method`, `path`, `status`, `durationMs` تولید می‌شود (`backend/services/logger.js` + خروجی‌های `test_output_api_*.txt`).  
  - در سطح روت، همه خطاهای مهم (`health`, `agents/summary`, `feed`, `breaking-news`, `events/recent`, `categories/*`, `stats/real-time`, `mark-processed`) با `logger.error` لاگ می‌شوند و بنابراین قابل ردیابی با همان `requestId` هستند.

### ۲. Agents

| Claim | File | Lines | توضیح |
|---|---|---|---|
| خروجی همه‌ی agents قبل از ارسال به UI از `normalizeConfidence` عبور می‌کند | `backend/routes/ai-agents.js` | L221–255, L265–332 | در `logAndReturn` مقدار `outputData.confidence` با `normalizeConfidence` نرمال می‌شود و در `transformAgentResultForUI` برای همه‌ی agentها confidence از همین تابع عبور می‌کند. |
| Registry مرکزی agents و شمارش ۱۵ agent | `backend/services/agents/registry.js` | L26–43, L196–198 | ثابت `AGENT_MODULES` تمام agent_keyها را نگه می‌دارد و `listAgentKeys()` همین لیست را به عنوان SSOT برمی‌گرداند. |
| AGENTS SSOT از registry و DB تولید می‌شود | `backend/scripts/dump_agents_ssot.js` | L2–7, L23–30, L68–89 | اسکریپت `dump_agents_ssot.js` با استفاده از registry و جدول `ai_agents` فایل‌های `generated/AGENTS.md` و `AGENTS.json` را تولید می‌کند. |

### ۳. Confidence Normalization / Artemis

| Claim | File | Lines | توضیح |
|---|---|---|---|
| تابع واحد نرمال‌سازی confidence به ۰–۱۰۰ | `backend/utils/normalizeConfidence.js` | L15–31 | تابع `normalizeConfidence(raw)` ورودی ۰–۱ را به درصد ۰–۱۰۰ تبدیل و در نهایت مقدار را در بازه‌ی `[0, 100]` clamp می‌کند. |
| Artemis Decision همه confidenceها را به ۰–۱۰۰ نرمال می‌کند | `backend/routes/artemis.js` | L281–297, L379–387, L388–395 | در `/api/v1/artemis/decision` ابتدا `opportunity.confidence` و `signals[*].confidence` با `normalizeConfidence` نرمال می‌شوند و سپس منطق threshold بر اساس همین مقیاس اعمال می‌شود. |
| backfill تاریخی confidence در DB اجرا شده و dry-run دارد | `backend/scripts/backfill_confidence_to_percent.js` | L27–69, L72–101 | اسکریپت backfill جدول‌های `ai_decisions` و `autopilot_actions` را فقط برای `confidence <= 1` به ۰–۱۰۰ تبدیل می‌کند و حالت `--dry-run` و خروجی JSON گزارش را پشتیبانی می‌کند. |

### ۴. Training

| Claim | File | Lines | توضیح |
|---|---|---|---|
| Training Center به API واقعی متصل است | `backend/routes/training.js` | L1–220 (تقریبی) | اندپوینت‌های `/api/v1/training/sessions` و `/api/v1/training/overview` روی جداول training کوئری می‌زنند و در `TrainingCenter.tsx` مصرف می‌شوند. |
| Training API Map SSOT را برای روت‌ها نگه می‌دارد | `docs/ssot_v3/TRAINING_API_MAP.md` | L13–48 | جدول Endpoints، مدل درخواست/پاسخ و جداول DB مربوط به Training را مستند می‌کند. |

### ۵. Analytics

| Claim | File | Lines | توضیح |
|---|---|---|---|
| Analytics از DB واقعی (بدون mock اصلی) داده می‌گیرد | `backend/routes/analytics.js` | L8–138 | اندپوینت `GET /api/v1/analytics/overview` متریک‌ها را از `ai_agents`, `ai_decisions`, `ai_learning_events` محاسبه می‌کند و در صورت خطا fallback امن برمی‌گرداند. |
| فرانت‌اند Analytics backend-first است با fallback آفلاین | `services/api.ts` | (بلاک `fetchAnalyticsData`) | تابع `fetchAnalyticsData` ابتدا `/api/v1/analytics/overview` را صدا می‌زند و فقط در صورت خطا/نبود توکن روی IndexedDB fallback می‌کند. |
| Analytics API Map قرارداد متریک‌ها را تعریف می‌کند | `docs/ssot_v3/ANALYTICS_API_MAP.md` | L13–33, L45–52 | mapping بین `AIAnalyticsMetrics`، endpoint `/api/v1/analytics/overview` و جداول DB را ثبت می‌کند و فیلدهای placeholder را جداگانه علامت می‌کند. |

### ۶. Topic Routing / Autopilot

| Claim | File | Lines | توضیح |
|---|---|---|---|
| CRUD اصلی Topic Routing روی DB پیاده‌سازی شده است | `backend/routes/topic-routing.js` | L1–260 (تقریبی) | اندپوینت‌های create/update/delete/get برای قوانین Topic Routing روی جداول `topic_routing_rules` و `topic_routing_logs` کار می‌کنند. |
| Autopilot به وضعیت Artemis متصل است و circuit breaker دارد | `backend/routes/autopilot.js` | L69–116, L122–161, L339–397 | روت‌های `/status`, `/enable`, `/disable`, `/run-once` روی جدول `artemis_state` کار می‌کنند و منطق circuit breaker (`autopilot_fail_count`) را enforce می‌کنند. |

### ۷. Trading Engine / Artemis / Queue

| Claim | File | Lines | توضیح |
|---|---|---|---|
| روت‌های status/start/stop/queue برای Trading Engine پیاده‌سازی شده‌اند | `backend/routes/trading-engine.js` | L8–74, L76–96 | اندپوینت‌های `/status`, `/start`, `/stop`, `/trades/active`, `/opportunities` به شیء `tradingEngine` متصل هستند و وضعیت، صف و تریدهای فعال را برمی‌گردانند. |
| Trading Engine صف فرصت‌ها و مصرف‌کننده‌ی آن را مدیریت می‌کند | `backend/engine/tradingEngine.js` | L144–152, L278–343, L582–642 | ساختار `opportunityQueue`، تابع `addOpportunity` (priority queue) و `startOpportunityProcessor` مسئول پردازش صف و محدودیت `maxConcurrentTrades` هستند. |
| Trading Engine روی جداول `trades` و `trading_engine_config` و `portfolios` DB می‌نویسد | `backend/engine/tradingEngine.js` | L249–272, L1384–1401, L1407–1428, L1434–1447, L1351–1373 | متدهای `loadConfig`/`saveConfig`، `saveTrade`, `updateTrade`, `updateTradePnl` و `getPortfolioValue` با این جداول در DB کار می‌کنند. |
| Trading Engine برای تایید نهایی به Artemis متصل است | `backend/engine/tradingEngine.js` | L706–757 | متد `getArtemisApproval` درخواست `/api/artemis/decision` می‌سازد (opportunity + signals + context) و بر اساس پاسخ Artemis تصمیم به اجرا می‌گیرد، با fallback امن در صورت خطا. |
| Emergency Stop در Trading Engine هم تریدها را می‌بندد و هم config را غیرفعال و نوتیفیکیشن ارسال می‌کند | `backend/engine/tradingEngine.js` | L1259–1275 | متد `emergencyStop` تمام تریدهای باز را می‌بندد، `config.enabled` را false می‌کند، آن را در DB ذخیره می‌کند و پیام Telegram می‌فرستد. |

### ۸. DataHub Pipeline (GAP-012 Closed)

| Claim | File | Lines | توضیح |
|---|---|---|---|
| Pipeline tab از API تجمیعی backend داده می‌گیرد | `services/dataPipelineApi.ts` | L1–65 | `fetchDataPipelineView` → `GET /api/v1/data-sources/pipeline`. |
| React Query برای Pipeline | `hooks/useDataHubState.ts` | `usePipelineQuery` | کلید `DATA_HUB_KEYS.pipeline()`. |
| UI wiring بدون IndexedDB برای snapshot | `components/ai/AIManager/tabs/DataHubTab.tsx`, `hooks/useDataHub.ts` | Pipeline props از `usePipelineQuery` | `pipelineSnapshot` / `history` / `normalizationSummary` دیگر از `dataHub.pipelineSnapshot` محلی نیست. |
| Backend aggregate | `backend/routes/data-sources.js`, `backend/services/dataPipelineSnapshot.js` | `GET /pipeline` | تجمیع از `collected_data`, `data_sources`, `data_categories`. |

**Grep — مسیر Pipeline (دادهٔ اصلی، 2026-05-24):**

```bash
grep -rn "buildPipelineSnapshot\|fetchDataHubState" \
  components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx \
  components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts \
  components/ai/AIManager/tabs/DataHubTab.tsx \
  services/dataPipelineApi.ts \
  hooks/useDataHubState.ts

grep -rn "dataHub\.pipelineSnapshot\|mergedDataHub\.pipeline" \
  components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx \
  components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts \
  components/ai/AIManager/tabs/DataHubTab.tsx
```

| Symbol | PipelinePanel | useDataHub (pipeline) | DataHubTab (pipeline props) | dataPipelineApi | useDataHubState |
|--------|---------------|----------------------|----------------------------|-----------------|-----------------|
| `buildPipelineSnapshot` | — | — | — | — | — |
| `fetchDataHubState` | — | — | — | — | `useDataHubQuery` (state کلی Hub؛ نه دادهٔ Pipeline) |
| `dataHub.pipelineSnapshot` | — | — | — | — | — |

`buildPipelineSnapshot` / `dataHub.pipelineSnapshot` در `services/api.ts` و advanced/automation باقی است — خارج از scope تب Pipeline.

### ۹. DataHub Access Logs (GAP-013 Closed)

| Claim | File | توضیح |
|---|---|---|
| Logs tab از API backend | `services/dataAccessLogsApi.ts` | `GET /api/v1/data-sources/access-logs` |
| React Query | `hooks/useDataHubState.ts` | `useAccessLogsQuery` (`enabled` وقتی `activeView === 'logs'`) |
| UI wiring | `DataHubTab.tsx`, `useDataHub.ts` | `accessLogs` / `logStatusCounts` از query — **نه** `dataHub.accessLogs` |
| Backend | `backend/services/dataHubAccessLogs.js` | نگاشت `data_hub_logs` → `DataAccessLog` |

**پس از GAP-013:** تب Logs دیگر از `fetchDataHubState` / `logsAsync` برای دادهٔ اصلی استفاده نمی‌کند (`logsAsync` حذف شده). `useDataHubQuery` همچنان state کلی Hub (advanced/health cache) را از IndexedDB می‌گیرد — جدا از تب Logs.

**Grep — مسیر Logs (دادهٔ اصلی، 2026-05-24):**

```bash
grep -rn "dataHub\.accessLogs\|fetchDataHubState" \
  components/ai/AIManager/tabs/DataHub/LogsPanel.tsx \
  components/ai/AIManager/tabs/DataHubTab.tsx
# → 0 matches (DataHubTab: accessLogs={accessLogs} از useDataHub)
```

### ۱۰. DataHub Telegram Publisher (GAP-016 Closed)

| Claim | File | توضیح |
|---|---|---|
| DB tables | `backend/database/migrations/025_create_telegram_publishers.sql` | `telegram_publishers`, `publisher_delivery_history` |
| API routes | `backend/routes/telegram-publishers.js` | Mount: `/api/v1/data-hub/telegram-publishers` |
| Publish safety | `backend/services/telegramPublisherService.js` | `confirm_publish`, `isPublisherDryRunForced()`, history on error |
| Frontend API | `services/telegramPublishersApi.ts` | CRUD + test + publish + history |
| React Query | `hooks/useTelegramPublishers.ts` | `useTelegramPublishersQuery` + mutations |
| UI | `TelegramPublisher.tsx` | Props: `telegramSources` only (sources از API) |

**Grep — Publisher UI (no IndexedDB for main data):**

```bash
grep -rn "dataHub\.advanced\|fetchDataHubState" \
  components/ai/AIManager/tabs/DataHub/advanced/TelegramPublisher.tsx
# → 0 matches

grep -rn "data-hub/telegram-publishers\|useTelegramPublishers" \
  components/ai/AIManager/tabs/DataHub/advanced/TelegramPublisher.tsx
# → useTelegramPublishersQuery + /api/v1/data-hub/telegram-publishers (via service)
```

**Legacy IndexedDB publisher APIs (`services/api.ts`) — فقط automation:**

| Function | Used by `TelegramPublisher.tsx`? | Used by `AutomationTopics` / dispatch? |
|----------|-----------------------------------|----------------------------------------|
| `createTelegramPublisher` / `updateTelegramPublisher` / `deleteTelegramPublisher` | **No** | Indirect (publisher list در state) |
| `publishToTelegram` | **No** | **Yes** — `dispatchAutomationQueue` / queue processor (GAP-019) |

`TelegramPublisher.tsx` فقط `services/telegramPublishersApi.ts` + `hooks/useTelegramPublishers.ts` را صدا می‌زند. مسیر legacy `publishToTelegram` در `services/api.ts` دیگر توسط Automation dispatch استفاده نمی‌شود (GAP-019 Closed).

### ۱۱. DataHub Automation (GAP-018 + GAP-019 Closed)

| Claim | File | توضیح |
|---|---|---|
| Topics DB | `backend/database/migrations/026_create_datahub_automation_topics.sql` | `datahub_automation_topics` |
| Queue DB | `backend/database/migrations/027_create_datahub_automation_queue.sql` | queue + schedule + executions |
| Service | `backend/services/datahubAutomationService.js` | refresh از pipeline/collected_data؛ dispatch → `runPublisherPublish` |
| Routes | `backend/routes/data-hub-automation.js` | `/api/v1/data-hub/automation` |
| Frontend | `services/datahubAutomationApi.ts`, `hooks/useDatahubAutomation.ts` | React Query |
| UI | `AutomationTopics.tsx` | بدون `fetchDataHubState` برای topics/queue/history |

**Grep — Automation UI (no IndexedDB for main data):**

```bash
grep -rn "fetchDataHubState\|createAutomationTopic\|refreshAutomationQueue" \
  components/ai/AIManager/tabs/DataHub/advanced/AutomationTopics.tsx
# → 0 matches
```

### ۱۲. DataHub filter rules (GAP-024)

| Claim | File | Lines | توضیح |
|---|---|---|---|
| جدول قوانین فیلتر | `backend/database/migrations/028_create_datahub_filter_rules.sql` | L1–55 | `datahub_filter_rules` با `rule_type`, `scope`, `pattern`, `match_type`, `apply_target`, `action`, `priority`, soft delete |
| CRUD + evaluate API | `backend/routes/data-hub-filter-rules.js` | router | `GET/POST/PUT/DELETE /api/v1/data-hub/filter-rules`, `POST /evaluate` |
| ارزیابی و enforce ingestion | `backend/services/datahubFilterRulesService.js` | `evaluateFilterRules`, `enforceIngestionFilter` | اولویت + whitelist بر blacklist در تساوی |
| **collected-data POST → 403** | `backend/routes/collected-data.js` | `router.post('/')` | `await enforceIngestionFilter(...)` قبل از INSERT؛ `catch` → `403` + `code: FILTER_BLOCKED` |
| **batch → blocked count** | `backend/routes/collected-data.js` | `router.post('/batch')` | `results.blocked++` و `continue` روی `FILTER_BLOCKED` |
| **telegramPipeline قبل از INSERT** | `backend/services/telegramPipeline.js` | قبل از `INSERT INTO collected_data` | `enforceIngestionFilter`؛ skip با `action: filter_blocked` |
| Publishing worker hook | — | — | **v3.0 ندارد** — فقط `POST /evaluate`؛ **GAP-025** |
| UI backend-first | `services/dataHubFilterRulesApi.ts`, `hooks/useDataHubFilterRules.ts`, `advanced/BlacklistWhitelist.tsx` | — | بدون `fetchDataHubState` / IndexedDB برای لیست قوانین |

### ۱۳. DataHub crawlers (GAP-026)

| Claim | File | توضیح |
|---|---|---|
| Tables | `backend/database/migrations/029_create_datahub_crawlers.sql` | `datahub_crawlers`, `datahub_crawler_runs` |
| API | `backend/routes/data-hub-crawlers.js` | CRUD + `POST /:id/run` + `GET /:id/runs` |
| Pre-crawl filter | `backend/services/datahubCrawlersService.js` | `preCrawlFilterCheck` → 403 before run |
| Ingestion filter | same | `enforceIngestionFilter` per item in `ingestItem` |
| Website engine | `backend/services/webCrawler.js` | depth cap, maxPages, skipRobots |
| RSS | `backend/services/rssFetcher.js` | cheerio XML parse |
| render_js gate | `datahubCrawlersService.js` | `CRAWLER_RENDER_JS_ENABLED` |
| UI | `WebCrawlerConfig.tsx`, `dataHubCrawlersApi.ts` | no IndexedDB crawler list |

#### Crawler runtime safety

| Claim | File | Behavior |
|---|---|---|
| `render_js` default false | `029_create_datahub_crawlers.sql`, `createCrawlerSchema` | DB + API default `false` |
| render_js without env | `datahubCrawlersService.js` `assertRenderJsAllowed` | **400** unless `CRAWLER_RENDER_JS_ENABLED=true` |
| max_depth cap 5 | `datahubCrawlersSchemas.js`, `webCrawler.js` | zod max 5; crawl uses `Math.min(depth, 5)` |
| max pages per run | `webCrawler.js` `config.maxPages` | loop stops when `results.length >= maxPages` |
| robots.txt | `webCrawler.js` | enforced unless `config.skipRobots` (only when `respect_robots=false`) |

### ۱۴. DataHub discovery (GAP-028 Closed)

| Claim | File | توضیح |
|---|---|---|
| Tables | `030_create_datahub_discovery.sql` | suggestions, rules, scans, settings |
| API | `backend/routes/data-hub-discovery.js` | scan, approve, reject, stats, history |
| 3-layer dedupe | `backend/utils/discoveryDedupe.js` | host, path, title similarity |
| Scoring | `backend/utils/discoveryScoring.js` | weighted **0–100** (`priority_score` CHECK 0–100) |
| SSRF | `backend/utils/discoverySafety.js` | explicit block list (see below) |
| No auto-create on scan | `datahubDiscoveryService.js` | scan **never** `INSERT` into `data_sources` |
| Approve-only source create | `approveSuggestion` in `datahubDiscoveryService.js` | **only** `POST …/approve` creates `data_sources` |
| Duplicate suggestions | migration `030` + dedupe service | `status=duplicate`, `duplicate_of_source_id` / `duplicate_of_suggestion_id` |
| Audit fields | migration `030` | `approved_by`, `rejected_by`, `review_note`, `reviewed_at` |
| UI | `AutoDiscoveryConfig.tsx` | backend-first · no IndexedDB discovery state |
| Contract / SSOT | `DISCOVERY_API_CONTRACT.md`, `SSOT_v3.0.md` | **Implemented · Design: Done** · GAP-028 **Closed** |

#### Discovery safety (locked v3.0)

| Control | Implementation | Failure / outcome |
|---|---|---|
| **SSRF — schemes** | `discoverySafety.js` | Only `http`/`https`; block `file://`, `ftp://`, `gopher`, `data:`, `javascript:`, `mailto` → `SSRF_BLOCKED` **400** |
| **SSRF — localhost** | hostname `localhost`, `*.localhost` | `SSRF_BLOCKED` **400** |
| **SSRF — private IP** | IPv4 private/link-local ranges; IPv6 `::1` / ULA | `SSRF_BLOCKED` **400** |
| **SSRF — metadata / internal** | `metadata.*`, `*.internal`, `*.local` | `SSRF_BLOCKED` **400** |
| **Scan mutates sources** | `runDiscoveryScan` | **No** `data_sources` rows created |
| **Approve creates source** | `approveSuggestion` + filter evaluate | Single approved path → `INSERT data_sources` |
| **Duplicate storage** | `datahub_discovery_suggestions` | `duplicate_of_*` populated; not re-queued as pending |
| **Scoring bounds** | `discoveryScoring.js` + DB CHECK | `priority_score` always **0–100** |

### ۱۶. DataHub Smart Prioritization (GAP-030 Closed)

#### ۱۶.۱ No Mock Verification (v3.0 backend-first)

**Grep (0 matches in prioritization UI / hooks / API):**

```bash
rg -n "fetchDataHubState" \
  components/ai/AIManager/tabs/DataHub/advanced/SmartPrioritization.tsx \
  hooks/useDataHubPrioritization.ts \
  services/dataHubPrioritizationApi.ts \
  # → 0 matches

rg -n "smartPrioritization" \
  components/ai/AIManager/tabs/DataHub/advanced/SmartPrioritization.tsx \
  hooks/useDataHubPrioritization.ts \
  services/dataHubPrioritizationApi.ts \
  # → 0 matches

rg -n "indexedDB|data_hub_state|dataHub\\.advanced\\.smartPrioritization" \
  components/ai/AIManager/tabs/DataHub/advanced/SmartPrioritization.tsx \
  hooks/useDataHubPrioritization.ts \
  services/dataHubPrioritizationApi.ts \
  # → 0 matches

rg -n "services/api" components/ai/AIManager/tabs/DataHub/advanced/SmartPrioritization.tsx
  # → 0 matches
```

**Legacy mocks still exist in `services/api.ts` but are not imported by prioritization UI:**
- `services/api.ts` contains `fetchDataHubState` (`40` matches) and `smartPrioritization` (`6` matches).
- `SmartPrioritization.tsx` does not import `services/api.ts` (grep above → 0).

#### ۱۶.۲ Apply Safety (confirm + atomic transaction)

- **Strict confirm flag**: `applyPrioritization()` در صورت `confirmApply !== true` خطای `400` با کد `CONFIRM_APPLY_REQUIRED` می‌دهد.  
  Evidence: `backend/services/datahubPrioritizationService.js` `L379–385`

- **Transactional apply**: آپدیت‌های `data_sources` و `datahub_source_priorities` داخل `transaction()` با `BEGIN/COMMIT/ROLLBACK` انجام می‌شود.  
  Evidence: `backend/database/db.js` `L153–167` and `backend/services/datahubPrioritizationService.js` `L424–479`

#### ۱۶.۳ Score Stability (clamp + deterministic tier mapping)

- `calculated_score` و `finalScore` با `clampScore()` محدود به `0–100` هستند.  
  Evidence: `backend/services/datahubPrioritizationService.js` `L30–33`

- Tier mapping کاملاً deterministic و ثابت است:  
  `0–24 low`, `25–49 medium`, `50–74 high`, `75–100 critical`.  
  Evidence: `backend/services/datahubPrioritizationService.js` `L13–18` and `L72–78`

#### ۱۶.۴ Audit Trail — `datahub_prioritization_runs`

- Migration `032` ستون‌های زیر را اضافه می‌کند: `started_at`, `completed_at`, `applied_by`, `settings_snapshot`, `preview_only`, `status`, `error_summary`.  
  Evidence: `backend/database/migrations/032_add_prioritization_audit_columns.sql` `L1–12`

- `previewPrioritization` و `applyPrioritization` این فیلدها را با:
  - insert در start (`started_at`, `preview_only`, `applied_by`, `settings_snapshot`, `status`)
  - update در پایان (`completed_at`, `status`, `summary` یا `error_summary`)
  پر می‌کنند.  
  Evidence: `backend/services/datahubPrioritizationService.js` `L410–469` (preview+complete) و `L411–477` (apply+complete/fail)

### ۱۷. DataHub Archiving (GAP-032 Closed)

#### No Mock Verification

```bash
rg -n "fetchDataHubState|createManualArchive|restoreFromArchive" \
  components/ai/AIManager/tabs/DataHub/advanced/Archiving.tsx \
  hooks/useDataHubArchiving.ts services/dataHubArchivingApi.ts
# → 0 matches
```

`Archiving.tsx` uses `useDataHubArchiving` + `/api/v1/data-hub/archiving` only.

#### Safety (v3.0)

| Control | Evidence |
|---------|----------|
| Manual-only | No cron wiring in routes/service |
| No purge apply | `previewPurge` count only — `purge_apply_available: false` in `datahubArchivingService.js` |
| Strict confirm | `confirmArchive !== true` → `CONFIRM_ARCHIVE_REQUIRED` **400** |
| API audit | `datahub_archiving_operations` migration `033` |

---

### ۱۹. Health Monitoring tab (`dataHub.health` · v3.0 blocker fix)

| Claim | File | Lines | توضیح |
|---|---|---|---|
| Health tab از APIهای واقعی می‌خواند | `HealthPanel.tsx`, `services/dataSourcesApi.ts`, `hooks/useDataHubState.ts` | `fetchDataHubSourcesHealth`, `fetchDataHubSourcesStats`, `fetchDataHubSourcesState`; `useDataHubHealthLogCountsQuery` → `fetchDataAccessLogs` | دیگر `dataHub.health` از IndexedDB/`checkDataHubHealth` در این تب رندر نمی‌شود. |
| بدون NaN/undefined در متریک‌ها | `pipelineHealthFormat.ts`, `HealthPanel.tsx` | `formatCountDisplay`, `formatAvgLatency`, `formatSystemStatus` | avg response و cache = N/A تا GAP-035. |
| SSOT status | `docs/ssot_v3/SSOT_v3.0.md` | `dataHub.health` row | **Implemented · Design: Done** |

---

### ۱۸. Pipeline Health Overview (Advanced · v3.0 blocker fix)

| Claim | File | Lines | توضیح |
|---|---|---|---|
| Overview از `/health` + `/stats` می‌خواند (نه `dataHub.pipelineSnapshot` mock) | `PipelineHealthOverview.tsx`, `services/dataSourcesApi.ts` | `useDataHubSourcesHealthQuery`, `useDataHubSourcesStatsQuery`; `fetchDataHubSourcesHealth`, `fetchDataHubSourcesStats` | UI دیگر `overallStatus` / `avgLatency` روی snapshot قدیمی ندارد. |
| فرمت امن بدون `undefined`/`NaN` | `pipelineHealthFormat.ts` | `formatSystemStatus`, `formatActiveSourcesLabel`, `formatAvgLatency` | Unknown / `0 / 0` / N/A |
| Latency API در v3.1 | `docs/ssot_v3/GAPS_AND_PLAN.md` | GAP-034 | v3.0: N/A + tooltip `pipeline_latency_not_available` |

---

### ۱۵. Migrations / Greenfield Bootstrap

| Claim | File | Lines | توضیح |
|---|---|---|---|
| منبع واحد migrationها دایرکتوری `backend/database/migrations` است | `backend/database/migrate.js` | (بلاک اصلی run migrations) | اسکریپت migrate فقط از مسیر `backend/database/migrations` با `node-pg-migrate` استفاده می‌کند و دایرکتوری `backend/migrations` را در chain رسمی در نظر نمی‌گیرد. |
| Bootstrap AI schema روی DB خالی با `000_init_ai_schema.sql` انجام می‌شود | `backend/database/migrations/000_init_ai_schema.sql` | L1–72 | این migration جداول پایه‌ی `ai_agents`, `artemis_state`, `autopilot_actions`, `ai_decisions` و ایندکس‌های اصلی را روی DB خالی ایجاد می‌کند. |
| نحوه تست chain کامل migrations روی DB خالی در ENVIRONMENT مستند شده است | `docs/ssot_v3/audit/ENVIRONMENT.md` | L85–96 | سکشن «Bootstrap from Empty Database» مراحل ساخت DB خالی، تنظیم `DATABASE_URL` و اجرای `npm run migrate` را برای تست greenfield توضیح می‌دهد. |

