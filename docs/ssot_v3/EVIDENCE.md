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

### ۱۰. Migrations / Greenfield Bootstrap

| Claim | File | Lines | توضیح |
|---|---|---|---|
| منبع واحد migrationها دایرکتوری `backend/database/migrations` است | `backend/database/migrate.js` | (بلاک اصلی run migrations) | اسکریپت migrate فقط از مسیر `backend/database/migrations` با `node-pg-migrate` استفاده می‌کند و دایرکتوری `backend/migrations` را در chain رسمی در نظر نمی‌گیرد. |
| Bootstrap AI schema روی DB خالی با `000_init_ai_schema.sql` انجام می‌شود | `backend/database/migrations/000_init_ai_schema.sql` | L1–72 | این migration جداول پایه‌ی `ai_agents`, `artemis_state`, `autopilot_actions`, `ai_decisions` و ایندکس‌های اصلی را روی DB خالی ایجاد می‌کند. |
| نحوه تست chain کامل migrations روی DB خالی در ENVIRONMENT مستند شده است | `docs/ssot_v3/audit/ENVIRONMENT.md` | L85–96 | سکشن «Bootstrap from Empty Database» مراحل ساخت DB خالی، تنظیم `DATABASE_URL` و اجرای `npm run migrate` را برای تست greenfield توضیح می‌دهد. |

