## AI Menu Audit Report – Step 1: Inventory & Map

تاریخ: 2025-12-24  
دامنه بررسی: فقط منوی هوش مصنوعی (AI Menu) در TitanGold

---

### 1. ساختار کلی AI Menu (AICenter)

- **ورودی اصلی UI**
  - **کامپوننت**: `components/AICenter.tsx`
  - **تب‌ها (AI Center)**
    - `manager` → **AI Manager (Artemis)**  
      - کامپوننت: `components/ai/AIManager/index.tsx`
    - `agents` → **AI Agents Control Panel**  
      - کامپوننت: `components/ai/AIAgents.tsx`
    - `training` → **Training Center**  
      - کامپوننت: `components/ai/TrainingCenter.tsx`
    - `analytics` → **Analytics Dashboard**  
      - کامپوننت: `components/ai/AnalyticsDashboard.tsx`
    - `config` → **API / Model Configuration**  
      - کامپوننت: `components/ai/APIConfig.tsx`
  - **API پیش‌بارگذاری**:
    - `api.fetchAIManagerData()` برای prefetch اولیه (هر تب داخل خودش داده اصلی را می‌گیرد).

---

### 2. AI Manager – تب‌ها و کامپوننت‌ها

- **کامپوننت ریشه**
  - فایل: `components/ai/AIManager/index.tsx`
  - **تب‌ها (ArtemisTab)**
    - `overview` → کامپوننت: `components/ai/AIManager/tabs/OverviewTab.tsx`
    - `decision_engine` → `DecisionEngineTab.tsx`
    - `orchestration` → `OrchestrationTab.tsx`
    - `learning` → `LearningTab.tsx`
    - `monitoring` → `MonitoringTab.tsx`
    - `scenarios` → `ScenariosTab.tsx`
    - `data_hub` → `DataHubTab.tsx`
    - `backtesting` → `BacktestingTab.tsx`
    - `logs` → `SystemLogsTab.tsx`
    - `settings` → `SettingsTab.tsx`
  - **State مرکزی**
    - `useArtemisState()` از `components/ai/hooks/useArtemisState.ts` → مدیریت `ArtemisState` (با `DEFAULT_ARTEMIS_STATE` و merge امن).
    - `api.fetchAIManagerData()` → ساختار مرور کلی (`AIManagerOverview`) شامل summary و بخشی از `artemis` (در صورت وجود).

#### 2.1. Overview Tab

- **کامپوننت**: `components/ai/AIManager/tabs/OverviewTab.tsx`
- **APIها**
  - `api.fetchArtemisLogs({ limit: 5 })`
    - متد: `GET` (در `services/api.ts`)
    - ورودی: فیلتر شامل `limit`
    - خروجی: `ArtemisLog[]`
    - ذخیره در state: `recentLogs`
  - `api.fetchTradingScenarios()`
    - متد: `GET`
    - ورودی: بدون پارامتر
    - خروجی: `TradingScenario[]`
    - ذخیره در state: `scenarios`
- **State / نمایش**
  - ورودی از والد: `data: AIManagerOverview`, `artemis: ArtemisState`
  - مشتقات:
    - `dataHub: DataHubState | undefined = artemis.dataHub`
    - `learningSystem: LearningSystemState | undefined = artemis.learningSystem`
    - `orchestration: OrchestrationState | undefined = artemis.orchestration`
    - `decisionEngine: DecisionEngineState | undefined = artemis.decisionEngine`
  - نمایش به کاربر:
    - کارت **Core Metrics**: مجموع تصمیم‌ها، درصد موفقیت، تعداد ایجنت فعال، وضعیت سلامت سیستم.
    - **System Summary**: تعداد کل ایجنت‌ها، ایجنت‌های فعال، در حال آموزش، دقت میانگین.
    - خلاصه **Decision Engine**, **Data Hub**, **Learning System**, **Orchestration** با لینک «View Details» که تب مربوطه را در `AIManager` فعال می‌کند.
    - **Recent Logs** و **Trading Scenarios** آخرین لاگ‌ها و سناریوها را لیست می‌کنند.

#### 2.2. Decision Engine Tab

- **کامپوننت**: `components/ai/AIManager/tabs/DecisionEngineTab.tsx`
- **APIها**
  - `api.makeArtemisDecision([])`
    - متد: `POST` (در `services/api.ts`)
    - ورودی: آرایه سیگنال‌ها (اینجا عمداً `[]` تا backend از state واقعی استفاده کند).
    - خروجی: آبجکت تصمیم (شامل `output.action`, `output.confidence`, `execution`, `learning`).
    - استفاده: بعد از موفقیت alert و سپس `onRefresh()` برای ری‌لود Artemis.
  - `api.updateArtemisConfig({ decisionEngine: { ... } })`
    - متد: `PUT`/`POST` طبق پیاده‌سازی backend در `services/api.ts`.
    - ورودی: شیء partial از `ArtemisState` شامل زیرشاخه `decisionEngine` با مقادیر جدید:
      - `strategy`, `activeModel`, `confidenceThreshold`
    - خروجی: معمولاً `ArtemisState` به‌روز شده (مطابق `api.updateArtemisConfig`).
- **State / نمایش**
  - ورودی: `artemis: ArtemisState`
  - State داخلی: فیلتر نوع تصمیم، فیلتر وضعیت (`pending`, `executed`, …)، جستجو، modals.
  - خروجی روی UI:
    - کارت **Decision Engine Configuration** + دکمه‌های `Configure` و `Make Decision`.
    - فرم تنظیم استراتژی، مدل فعال، confidence threshold.
    - آمار عملکرد (جمع تصمیم‌ها، اجرا شده، موفق، نرخ موفقیت، میانگین confidence، زمان اجرا).
    - جدول **Recent Decisions** با فیلتر نوع/وضعیت و جستجو.

#### 2.3. Orchestration Tab

- **کامپوننت**: `components/ai/AIManager/tabs/OrchestrationTab.tsx`
- **APIها**
  - این تب در نسخه فعلی فقط از `artemis.orchestration` که از `ArtemisState` لود شده استفاده می‌کند و مستقیم API جدید صدا نمی‌زند (کنترل‌ها/اکشن‌ها روی orchestration از طریق backend هنوز در این فایل صدا زده نمی‌شود).
- **State / نمایش**
  - ورودی: `artemis: ArtemisState`
  - نمایش: خلاصه وضعیت orchestration (تعداد ایجنت فعال، تعداد تسک‌ها، resource allocation, failover status) و لیست تسک‌ها با فیلتر و جستجو.

#### 2.4. Learning Tab

- **کامپوننت**: `components/ai/AIManager/tabs/LearningTab.tsx`
- **APIها**
  - تکیه روی `artemis.learningSystem` از `ArtemisState`؛ این تب در نسخه فعلی API جدید جداگانه‌ای را فراخوانی نمی‌کند.
- **State / نمایش**
  - ورودی: `artemis: ArtemisState`
  - نمایش:
    - آمار کلی: `totalDecisions`, `totalTrades`, accuracy history، نسخه‌های مدل.
    - **Recent Improvements** و **Recent Mistakes** از `learningSystem.improvements` و `learningSystem.mistakes` با فیلتر و جستجو.

#### 2.5. Monitoring Tab

- **کامپوننت**: `components/ai/AIManager/tabs/MonitoringTab.tsx`
- **APIها**
  - `api.checkSystemHealth()`
    - متد: `GET`
    - خروجی: `SystemHealth`
    - استفاده: دکمه `Check Health` → بروزرسانی health history و فراخوانی `onRefresh()`.
  - `api.fetchArtemisState()`
    - متد: `GET`
    - استفاده: هنگام resolve/dismiss کردن alertها:
      - خواندن Artemis فعلی، اصلاح `systemHealth.alerts`، سپس ارسال مجدد با `updateArtemisConfig`.
  - `api.updateArtemisConfig(updated)`
    - متد: مطابق تعریف backend.
    - ورودی: کل `ArtemisState` با `systemHealth` به‌روز شده.
- **State / نمایش**
  - ورودی: `artemis.systemHealth`
  - State داخلی: فیلتر ایجنت‌ها، فیلتر integrations، جستجو، auto-refresh interval، healthHistory، `selectedAgent` برای modal.
  - نمایش:
    - **Overall Status**, لیست **Agent Health** با CPU/Mem/API، لیست **Integrations** با latency/error rate/last check.
    - بخش **Resources** با درصدهای CPU/Memory/Network/Storage و API quota (used/limit/resetAt).
    - لیست **Alerts** با اکشن‌های `Resolve` و `Dismiss`.

#### 2.6. Scenarios Tab (Trading Scenarios)

- **کامپوننت**: `components/ai/AIManager/tabs/ScenariosTab.tsx`
- **APIها**
  - `api.fetchTradingScenarios()`
    - متد: `GET`
    - خروجی: `TradingScenario[]`
    - ذخیره در state: `scenarios`
  - `api.generateAITradingScenario()`
    - متد: `POST`
    - ورودی: (در لایه سرویس از ArtemisState استفاده می‌کند؛ اینجا بدون پارامتر).
    - خروجی: `TradingScenario` جدید با `target` غنی‌شده (profit/maxTrades/riskRewardRatio/description).
    - افزودن به state: prepend در `scenarios`.
  - `api.createTradingScenario(scenario)`
    - متد: `POST`
    - ورودی: `Omit<TradingScenario,'id'|'createdAt'|'updatedAt'|'trades'|'progress'>`
    - خروجی: سناریوی ساخته‌شده (`TradingScenario` کامل).
    - افزودن به لیست scenarios.
  - `api.runScenarioBacktest?.(scenarioId)`
    - متد: `POST` (در صورت پیاده‌سازی در `services/api.ts`).
    - ورودی: `scenarioId`
    - نقش: شروع backtest برای سناریو.
- **State / نمایش**
  - State: فیلتر وضعیت (`active/paused/...`)، فیلتر نوع (`target_profit/max_trades/...`)، جستجو، modal ساخت سناریو، modal نمایش تریدها.
  - نمایش:
    - آمار کلی: تعداد سناریو، active، مجموع تریدها، مجموع سود.
    - لیست کارت سناریوها با status, type, KPIها (profit, win rate, progress, ...)، دکمه‌های `View Trades`, `Backtest`, `Edit`, `Delete`.

#### 2.7. Data Hub Tab

- **کامپوننت**: `components/ai/AIManager/tabs/DataHubTab.tsx` + زیرکامپوننت‌ها:
  - `DataHub/AdvancedFeatures.tsx`
  - Modals: `CreateSourceModal`, `CreateCategoryModal`, `ViewSourceDataModal`, `WebCrawlerModal`, `TelegramPublisherModal`, `AccessControlModal`, `AutomationTopicModal`, `QueuePreviewModal`.
- **APIهای اصلی**
  - وضعیت کلی و ساختار:
    - `api.fetchDataHubState()` → `DataHubState`
    - `api.fetchAIAgents()` → `AIAgent[]` (برای routing automation).
  - سلامت Data Hub:
    - `api.checkDataHubHealth()` → health summary برای `dataHub.health`.
  - Telegram Collector:
    - `api.getTelegramCollectorBaseUrl()` (اختیاری، اگر تعریف شده باشد).
    - `api.getTelegramCollectorHealth()` → خلاصه سلامت collector.
    - `api.startTelegramCollectorLogin(payload)` / `api.confirmTelegramCollectorLogin(...)` / `api.cancelTelegramCollectorLogin(...)`
    - `api.refreshTelegramCollectorChannels()` → `TelegramCollectorState`
    - `api.linkTelegramChannelToSource(channelId, sourceId)`
    - `api.testTelegramCollectorChannel(channelId)`
  - Data Sources / Categories:
    - `api.requestData({ sourceId, ... })` → دادهٔ نرمال شده/خام برای نمایش در modal.
    - `api.deleteDataSource(sourceId)`
    - `api.updateDataHubSource(id, data)` / `api.createDataSource(data)`
    - `api.createDataCategory(categoryData)` / `api.updateDataCategory` / `api.deleteDataCategory`
    - `api.updateSourceAccessControl(...)`
  - Pipeline & Snapshot:
    - `api.refreshDataPipelineSnapshot()` → `DataPipelineSnapshot`
    - `api.getArchivedData(...)`
  - Advanced Features (در `AdvancedFeatures.tsx`):
    - Web Crawlers: `api.createWebCrawler`, `api.updateWebCrawler`, `api.deleteWebCrawler`, `api.detectSourceType`
    - Auto Discovery: `api.setAutoDiscoveryEnabled`, `api.runAutoDiscovery`
    - Smart Prioritization: `api.setSmartPrioritizationEnabled`, `api.calculateSourcePriorities`
    - Blacklist/Whitelist: `api.addToBlacklist`, `api.removeFromBlacklist`, `api.addToWhitelist`, `api.removeFromWhitelist`
    - Automation Routing: `api.fetchAIAgents`, `api.createAgentTopicRoute`, `api.updateAgentTopicRoute`, `api.deleteAgentTopicRoute`, `api.refreshAutomationQueue`, `api.dispatchAutomationQueue`, `api.simulatePublisherDispatch`
    - Telegram Publishers: `api.createTelegramPublisher`, `api.updateTelegramPublisher`, `api.deleteTelegramPublisher`, `api.testTelegramCollectorChannel`
- **State / نمایش**
  - `dataHub: DataHubState | null` در حالت محلی این تب.
  - Viewهای مختلف: `sources`, `categories`, `health`, `logs`, `advanced`, `telegram`, `pipeline`.
  - هر view subset مناسب از `dataHub`، `pipelineSnapshot/history`, `accessLogs`, `telegramCollector` را نمایش می‌دهد (لیست منابع، دسته‌بندی‌ها، health KPIs، لاگ‌های دسترسی، pipeline charts، advanced tools و …).

#### 2.8. Backtesting Tab

- **کامپوننت**: `components/ai/AIManager/tabs/BacktestingTab.tsx`
- **APIها**
  - `api.fetchBacktestResults()`
    - متد: `GET`
    - خروجی: لیست نتایج backtest (type در `types.ts`).
  - `api.fetchTradingScenarios()`
    - استفاده برای لیست سناریوهای قابل backtest.
  - `api.runBacktest({ scenarioId, from, to, initialCapital, ... })`
    - متد: `POST`
    - ورودی: پارامترهای backtest.
    - خروجی: نتیجه جدید backtest.
  - `api.deleteBacktestResult(resultId)`
    - متد: `DELETE`
    - ورودی: شناسه نتیجه backtest.
- **State / نمایش**
  - State: انتخاب سناریو و بازه زمانی، loading، لیست نتایج، فیلتر و sort.
  - نمایش:
    - فرم اجرای backtest.
    - کارت/جدول نتایج با: total profit, تعداد ترید، win rate، accuracy، Sharpe، max drawdown، total return، profit factor، سرمایه اولیه/نهایی.

#### 2.9. System Logs Tab

- **کامپوننت**: `components/ai/AIManager/tabs/SystemLogsTab.tsx`
- **APIها**
  - `api.fetchArtemisLogs(filter)`
    - متد: `GET`
    - ورودی: فیلترها (نوع، سطح، limit، از تاریخ و … بسته به پیاده‌سازی).
    - خروجی: `ArtemisLog[]` + متریک‌های همراه (در صورت تعریف در `services/api.ts`).
  - `api.clearArtemisLogs()`
    - متد: `DELETE`/`POST` طبق backend.
- **State / نمایش**
  - State: فیلتر نوع/level, search, auto-refresh interval, modal جزییات لاگ.
  - نمایش: آمار logها (total/errors/warnings/info)، لیست لاگ‌ها با رنگ‌بندی بر اساس level، دکمه export JSON.

#### 2.10. Settings Tab (Artemis Settings)

- **کامپوننت**: `components/ai/AIManager/tabs/SettingsTab.tsx`
- **APIها**
  - `api.updateArtemisConfig({ config })`
    - متد: `PUT`/`POST`
    - ورودی: شیء `config` (تنظیمات موتور تصمیم، learning, security, monitoring, integrations، UI، scheduler).
    - خروجی: معمولاً `ArtemisState` یا تأیید به‌روزرسانی.
- **State / نمایش**
  - ورودی: `artemis: ArtemisState` (برای مقداردهی اولیه تنظیمات).
  - State داخلی: مدل local از `config`، تب‌های داخلی (Decision Engine, Learning, Security, Monitoring, Integration, UI, Scheduler).
  - نمایش: فرم‌های تنظیم برای هر بخش، دکمه‌های Save, Reset to default, Export, Import.

---

### 3. تب AIAgents (خارج از AIManager ولی داخل AI Menu)

- **کامپوننت**: `components/ai/AIAgents.tsx`
- **APIها**
  - `api.fetchAIAgents()`
    - متد: `GET`
    - خروجی: `AIAgent[]`
    - ذخیره در state محلی `agents`.
- **کامپوننت‌های کنترل ایجنت**
  - برای هر `agent.id` یک کنترل اختصاصی:
    - `TechnicalAnalysisAgentControl.tsx` (id = '1')
    - `RiskManagementAgentControl.tsx` (id = '2')
    - `SentimentAgentControl.tsx` (id = '3')
    - `PatternAgentControl.tsx` (id = '4')
    - `PricePredictionAgentControl.tsx` (id = '5')
    - `ArbitrageAgentControl.tsx` (id = '6')
    - `PortfolioAllocationAgentControl.tsx` (id = '7')
    - `LiquidityAgentControl.tsx` (id = '8')
    - `TrendAgentControl.tsx` (id = '9')
    - `OptimizationAgentControl.tsx` (id = '10')
    - `OrderManagementAgentControl.tsx` (id = '11')
    - `FundamentalAgentControl.tsx` (id = '12')
    - `MarketIntelligenceAgentControl.tsx` (id = '13')
    - `VolumeAgentControl.tsx` (id = '14')
    - `TimingAgentControl.tsx` (id = '15')
- **State / نمایش**
  - لیست کارت‌ برای هر AIAgent با دقت، training progress، تعداد تصمیم‌ها، زمان یادگیری، حجم دانش، capabilities.
  - با کلیک روی `Control Panel`، modal کنترل مخصوص آن agent باز می‌شود (و معمولاً از APIهای مربوط به update config آن agent در `services/api.ts` استفاده می‌کند – بررسی دقیق قرارداد هر AgentControl در مرحله Contract Check انجام می‌شود).

---

### 4. Training Center (Training Tab در AI Menu)

- **کامپوننت**: `components/ai/TrainingCenter.tsx`
- **APIها**
  - `api.fetchTrainingData()`
    - متد: `GET`
    - خروجی: `AITrainingStats` شامل:
      - `sessions`, `avgAccuracy`, `activeTrainingAgents`, `runningSessions`, `queue`, `recentHistory`, `config`, ...
  - `api.fetchArtemisState()`
    - متد: `GET`
    - خروجی: `ArtemisState`
  - `api.fetchAIAgents()`
    - متد: `GET`
    - خروجی: `AIAgent[]`
  - `api.artemisAutoConfigureTraining()`
    - متد: `POST`
    - ورودی: (از شرایط فعلی Artemis/agents در backend استفاده می‌کند).
    - خروجی: `AITrainingConfig` جدید.
  - `api.scheduleAITrainingSession(payload)`
    - متد: `POST`
    - ورودی: داده‌های سشن (title, mode, agentIds, expectedCompletionMinutes, startInMinutes, ...).
    - خروجی: `AITrainingStats` به‌روز شده.
  - `api.completeAITrainingSession(sessionId, multiplier)`
    - متد: `POST`
    - ورودی: `sessionId` و factor برای آپدیت نتایج.
    - خروجی: `AITrainingStats` به‌روز شده.
  - `api.updateTrainingConfig(updatedConfig)`
    - متد: `PUT`/`POST`
    - ورودی: `AITrainingConfig`
    - خروجی: `AITrainingConfig` نهایی/ذخیره‌شده.
- **State / نمایش**
  - State اصلی: `data: AITrainingStats | null`, `artemis: ArtemisState | null`, `agents: AIAgent[]`، `trainingConfig`, فیلترها و تب‌های داخلی.
  - تب‌ها:
    - `overview` → کارت‌های نوع training, آمار کلی عملکرد agents، Artemis insights، پیشنهادات training.
    - `agents` → لیست agents با جزئیات training و اکشن `Train Now` برای agentهای انتخابی.
    - `sessions` → running sessions + queue با امکان complete.
    - `recommendations` → لیست پیشنهاد training بر اساس میانگین دقت و فاصله هر agent از میانگین.
    - `history` → تاریخچه سشن‌ها با فیلتر mode/status و جستجو.
    - `settings` → پنل `TrainingSettingsPanel` که از `api.updateTrainingConfig` استفاده می‌کند.

---

### 5. Analytics Dashboard (Analytics Tab در AI Menu)

- **کامپوننت**: `components/ai/AnalyticsDashboard.tsx`
- **APIها**
  - `api.fetchAnalyticsData()`
    - متد: `GET`
    - خروجی: `AIAnalyticsMetrics` شامل:
      - `performance` (avgAccuracy و غیره)
      - `agentMatrix` (لیست agent metrics)
      - `resourceUsage` (cpu, gpu, memory, precision[], recall[], ...)
      - `realtime` (systemUptime, successRate, ...)
  - `api.fetchAIAgents()`
    - متد: `GET`
  - `api.fetchArtemisState()`
    - متد: `GET`
- **State / نمایش**
  - State: `data: AIAnalyticsMetrics | null`, `agents`, `artemis`, `timeRange`, `selectedAgent`, `viewMode`, `refreshInterval`, sort/filter/join برای agentMatrix.
  - نمایش:
    - تب‌های محلی: `overview`, `agents`, `trends`, `comparison`, `insights` (فقط state داخلی، route جداگانه ندارد).
    - نمودار trend بر اساس precision/recall/accuracy (بدون random jitter).
    - لیست agent metrics و insights متنی (هشدار دقت پایین، هشدار resource usage بالا، uptime پایین، success rate بالا، ...).

---

### 6. API Config (Config Tab در AI Menu)

- **کامپوننت**: `components/ai/APIConfig.tsx`
- **APIها**
  - `api.fetchAPIConfigData()`
    - متد: `GET`
    - خروجی: `AIAPIConfigData` شامل:
      - `aiServices`, `communicationServices`, `marketDataServices` و کلیدهای API آن‌ها.
  - `api.fetchArtemisState()`
    - متد: `GET`
    - برای هم‌نمایی وضعیت Artemis با تنظیمات API.
  - `api.testAIIntegration(serviceId, config?)`
    - متد: `POST`
    - ورودی: شناسه سرویس + تنظیمات اختیاری.
    - خروجی: `{ success: boolean; latency?: number; error?: string }`.
  - ذخیره تنظیمات:
    - `api.saveAPIConfig(updatedConfig)` (نام دقیق تابع در `services/api.ts`؛ در این فایل از `saveAPIConfig` داخلی که روی سرویس تکیه می‌کند استفاده می‌شود).
  - سرویس‌های تست مستقیم مدل‌ها (سمت frontend):
    - `testGeminiConnection()`, `testClaudeConnection()`, `testOpenAIConnection()`, `testDeepSeekConnection()` که از `localStorage` موقت برای key استفاده می‌کنند.
- **State / نمایش**
- State: `apiConfig: AIAPIConfigData | null`, `artemis: ArtemisState | null`, `activeTab: 'apis' | 'mixture' | 'artemis_control'`, وضعیت تست و ذخیره.
  - نمایش: لیست سرویس‌ها، وضعیت اتصال، کلیدهای API، تست اتصال با latency، تنظیمات Mixture-of-Experts و کنترل سطح بالای Artemis نسبت به این سرویس‌ها.

---

این مرحله فقط **Inventory + Map** است؛ در مراحل بعد (Runtime Verification, Contract Check, Bug Report, …) رفتار واقعی، لاگ شبکه، قراردادها و باگ‌ها را به‌صورت شواهدی بررسی و مستند می‌کنیم.


## Step 2 – Runtime Verification

### 1. محدودیت‌های محیط اجرا

- این گزارش در محیطی تهیه شده که در آن:
  - سرور Frontend/Backend از داخل این Agent مستقیماً استارت نشده است (طبق محدودیت‌ها)، بنابراین:
    - دسترسی مستقیم به **Network Tab**، **Console** و **DOM واقعی مرورگر** وجود ندارد.
    - رفتار runtime بر اساس:
      - کد فعلی (React/TS + services/api.ts)
      - الگوهای state/خطایابی (loading/error handling)
      - گزارش‌های قبلی شما (مثل خطاهای esbuild، خطاهای Data Hub، Logs، …)
    تفسیر می‌شود.
- در هر بخش، صریحاً مشخص شده است:
  - چه چیزی **از روی کد و ساختار state قابل استنتاج است**.
  - چه چیزی **به‌طور مستقیم قابل مشاهده نبوده** (مثلاً status واقعی پاسخ API یا لاگ‌های کنسول مرورگر).

> این مرحله هیچ تغییری در کد ایجاد نمی‌کند و فقط مستندسازی رفتار فعلی و ریسک‌ها است.

---

### 2. AICenter (AI Menu Container)

- **جریان کلی**
  - UI: کاربر روی منوی AI وارد `AICenter` می‌شود.
  - تابع: `AICenter` در `useEffect` تابع `prefetchData` را اجرا می‌کند:
    - `api.fetchAIManagerData()` بدون `try/catch`؛ در صورت reject شدن Promise، خطای Unhandled Promise Rejection در کنسول محتمل است.
  - State:
    - `isLoading` ابتدا `true`، بعد از `await api.fetchAIManagerData()` روی `false` ست می‌شود (در صورت موفقیت).
  - UI:
    - تا زمانی که `isLoading === true` → متن ساده `{t('loading')}` نمایش داده می‌شود (بدون spinner خاص).
    - پس از آن، محتوای تب فعال (`manager | agents | training | analytics | config`) رندر می‌شود.

- **مشاهدات/ریسک‌ها**
  - اگر `fetchAIManagerData()` خطا بدهد:
    - `setIsLoading(false)` در `finally` وجود ندارد، پس **loading ممکن است هرگز false نشود** و UI در حالت «Loading» گیر کند.
    - این یک **Silent Failure نسبی** است: کاربر فقط یک متن Loading دائمی می‌بیند، بدون پیام خطا.
  - هیچ هندلینگ خطایی در سطح AICenter برای نمایش پیام صریح (مثلاً "AI Center failed to load") وجود ندارد؛ تکیه بر تب‌های داخلی برای مدیریت خطاهاست.
  - به‌دلیل محدودیت محیط، موفقیت/شکست واقعی `fetchAIManagerData` در زمان اجرا قابل مشاهده مستقیم نبود؛ این تحلیل بر اساس ساختار کد است.

---

### 3. AIManager و تب‌های Artemis

#### 3.1. AIManager Container (`components/ai/AIManager/index.tsx`)

- **جریان کلی**
  - UI: با ورود به تب `manager` در AICenter، AIManager رندر می‌شود.
  - توابع اصلی:
    - `useArtemisState()` → بارگذاری `ArtemisState` با safe defaults و retry.
    - `api.fetchAIManagerData()` در `useEffect` با `try/catch/finally`:
      - روی موفقیت: `setData(managerData)` و در صورت وجود `managerData.artemis` → `setArtemis(managerData.artemis)`؛ در غیر این صورت `reloadArtemis()`.
      - روی خطا: `setError(...)` و `console.error('Failed to load AIManager data:', e)`.
  - UI states:
    - اگر `isLoading || artemisLoading` → پیام `{t('loading')}`.
    - اگر `error || artemisError` → صفحه خطا با متن و دکمه `Reload` (که `window.location.reload()` را صدا می‌زند).
    - اگر `!data || !artemis` → پیام `{t('no_data') || 'No data available'}`.
    - در غیر این صورت، تب‌های داخلی Artemis رندر می‌شوند.

- **مشاهدات/ریسک‌ها**
  - **Loading و Error State** برای سطح AIManager به‌خوبی پیاده‌سازی شده و **silent failure در این لایه وجود ندارد**: خطا پیام واضح دارد.
  - Reload در error state به‌جای فراخوانی دوباره هوشمند، `window.location.reload()` است (رفتار درست ولی خشن؛ فقط برای ثبت، نه پیشنهاد تغییر).
  - به‌دلیل عدم دسترسی به کنسول واقعی، نمی‌توان وجود/عدم وجود هشدارهای React (مانند dependency array یا key تکراری) را تأیید کرد؛ کد فعلی نشانه واضحی از هشدار جدی ندارد.

#### 3.2. Overview Tab

- **Flow (از روی کد)**
  - Mount → `useEffect` → `loadAdditionalData()`:
    - Function:
      - `setIsLoadingLogs(true)`
      - `const logs = await api.fetchArtemisLogs({ limit: 5 })`
      - `const scenariosData = await api.fetchTradingScenarios()`
      - روی موفقیت: `setRecentLogs(logs || [])`, `setScenarios(scenariosData || [])`
      - روی خطا: `console.error('Failed to load additional data:', e)` و reset به آرایه خالی.
      - در `finally`: `setIsLoadingLogs(false)`
  - Auto-refresh (اگر کاربر checkbox Auto Refresh را فعال کند):
    - `useEffect` دوم interval تنظیم می‌کند که `onRefresh()` (ری‌لود Artemis) و `loadAdditionalData()` را صدا می‌زند.
  - UI:
    - در هنگام `isLoadingLogs === true` → متن Loading کوچک برای بخش Recent Logs.
    - در صورت آرایه خالی logs یا scenarios → متن `{t('no_data')}`.

- **مشاهدات/ریسک‌ها**
  - خطای شبکه در لاگ‌ها/سناریوها باعث **بازگرداندن دیتای خالی** و پیام "No data" می‌شود؛ این **رفتاری امن ولی تا حدی silent** است (کاربر نمی‌فهمد که backend خطا داده).
  - هیچ وضعیت خطای جداگانه (مثلاً "Failed to load logs") برای این تب وجود ندارد؛ فقط console.error.
  - Auto-refresh مثالی از ترکیب backend state (`onRefresh`) + لاگ‌ها و سناریوهاست؛ در صورت شکست یکی از APIها، UI همچنان partial data نشان می‌دهد (یا خالی) بدون پیام خطای واضح.

#### 3.3. Decision Engine Tab

- **Flow: Make Decision**
  - UI: کلیک روی دکمه `Make Decision` → `handleMakeDecision`:
    - `setIsMakingDecision(true)`
    - `const decision = await api.makeArtemisDecision([]);`
    - روی موفقیت: `alert(t('decision_made') || \`Decision made: ...\`)` و سپس `onRefresh()`.
    - روی خطا: `console.error(...)` + `alert(t('decision_failed') || 'Failed to make decision')`.
    - در `finally`: `setIsMakingDecision(false)`.
  - UI state:
    - دکمه در حین درخواست disable می‌شود و label به "Processing..." تغییر می‌کند.

- **Flow: Update Config**
  - UI: کلیک روی `Configure` → بخش تنظیمات باز می‌شود.
  - تغییر استراتژی/مدل/threshold:
    - `handleUpdateConfig` با partial `DecisionEngineState` جدید صدا می‌شود.
    - `await api.updateArtemisConfig({ decisionEngine: { ...artemis.decisionEngine, ...updates } })`
    - روی موفقیت: `onRefresh()` + بسته شدن modal + alert موفقیت.
    - روی خطا: alert و console.error.

- **مشاهدات/ریسک‌ها**
  - **Loading/Error state شفاف** برای عملیات دکمه‌ها وجود دارد (disable + alert).
  - لیست `recentDecisions` و performance stats اگر خالی باشند، UI "No data" یا مقادیر ۰ نشان می‌دهد؛ خطای backend در fetch اولیه تصمیم‌ها از طریق لایه `useArtemisState` مدیریت می‌شود، نه این تب.
  - بدون اجرای واقعی، نمی‌توان تأیید کرد که ورودی `[]` به `makeArtemisDecision` با قرارداد backend هم‌خوان است؛ این در Step 3 بررسی contract می‌شود.

#### 3.4. Orchestration Tab

- **Flow**
  - تکیه روی `artemis.orchestration` از state لودشده توسط `useArtemisState`.
  - UI: خلاصه آمار، لیست تسک‌ها با فیلتر و جستجو.

- **مشاهدات/ریسک‌ها**
  - تب Orchestration **هیچ API مستقیم جدیدی** را فراخوانی نمی‌کند؛ تمام داده‌ها از `ArtemisState` می‌آیند.
  - اگر `orchestration` خالی یا ناقص باشد، UI مقادیر ۰ / خالی نمایش می‌دهد؛ خطای صریحی دیده نمی‌شود (رفتار silent اما امن).

#### 3.5. Learning Tab

- **Flow**
  - فقط از `artemis.learningSystem` استفاده می‌شود.
  - UI: آمار کلی + لیست `improvements` و `mistakes` با فیلتر/جستجو.

- **مشاهدات/ریسک‌ها**
  - در صورت نبود داده، لیست‌ها خالی خواهند بود؛ تب Loading مجزا ندارد زیرا بارگذاری داده در سطح AIManager انجام شده است.
  - خطای شبکه در گرفتن `learningSystem` در لایه API (fetchArtemisState) توسط `useArtemisState` مدیریت می‌شود؛ در این تب پیام خطای جداگانه نمایش داده نمی‌شود.

#### 3.6. Monitoring Tab

- **Flow: Check Health**
  - کلیک روی `Check Health` → `handleHealthCheck(false)`:
    - `setIsCheckingHealth(true)`
    - `const newHealth = await api.checkSystemHealth();`
    - به‌روزرسانی `healthHistory` محلی.
    - در صورت عدم silent mode: `alert('Health check complete ...')`
    - سپس `onRefresh()` برای رفرش کل Artemis.
    - در خطا: `console.error` + `alert(t('health_check_failed'))`.

- **Flow: Resolve/Dismiss Alert**
  - `handleResolveAlert` → `api.fetchArtemisState()` → اصلاح لیست alerts → `api.updateArtemisConfig(updated)` → `onRefresh()`.
  - `handleDismissAlert` نیز مشابه است با فیلتر کردن alert از آرایه.

- **UI**
  - Loading state برای health check (دکمه disable + متن Checking...).
  - Auto-refresh (اگر فعال شود) هر `autoRefreshInterval` ثانیه `handleHealthCheck(true)` را صدا می‌زند.
  - اگر `health` undefined باشد، کارت ساده حاوی "No data" نمایش داده می‌شود.

- **مشاهدات/ریسک‌ها**
  - عملیات health check و alert actions همه **دارای Feedback (alert)** هستند، بنابراین silent failure حداقلی است.
  - اگر `checkSystemHealth` یا `updateArtemisConfig` قرارداد متفاوتی از انتظار frontend داشته باشند، ممکن است خطای runtime (مثلاً undefined field) رخ دهد؛ این در Step 3 بررسی می‌شود.
  - بدون اجرای واقعی، نمی‌توان latency واقعی auto-refresh یا تعداد واقعی درخواست‌ها را اندازه گرفت؛ فقط ساختار آن مشخص است.

#### 3.7. Scenarios Tab

- **Flow: Initial Load**
  - Mount → `useEffect` → `loadScenarios()`:
    - `setLoading(true)` → `const data = await api.fetchTradingScenarios();`
    - روی موفقیت: `setScenarios(data || [])`
    - روی خطا: `console.error` و `setScenarios([])`
    - `finally`: `setLoading(false)`

- **Flow: Generate AI Strategy**
  - کلیک روی دکمه 🤖 → `handleGenerateAIStrategy`:
    - `setIsGeneratingAI(true)`
    - `const newScenario = await api.generateAITradingScenario();`
    - `setScenarios(prev => [newScenario, ...prev]);`
    - alert موفقیت؛ روی خطا alert شکست.

- **Flow: Create Scenario / Run Backtest**
  - `handleCreateScenario` → `api.createTradingScenario(...)` → اضافه به state.
  - `handleRunBacktest` → `api.runScenarioBacktest?.(scenarioId)` با alert موفق/ناموفق.

- **مشاهدات/ریسک‌ها**
  - اگر `fetchTradingScenarios` شکست بخورد، UI در نهایت `loading=false` و لیست خالی نمایش می‌دهد؛ پیام خطای صریح ندارد (فقط console.error) → **Silent-ish failure**.
  - Generate AI Strategy و Create Scenario هر دو alert موفق/خطا دارند؛ از این نظر UX بهتر است.
  - بدون مشاهده شبکه، نمی‌توان تضمین کرد که `generateAITradingScenario` همیشه سناریوی معتبر برمی‌گرداند؛ بررسی عمیق در Step 3.

#### 3.8. Data Hub Tab

- **Flow: Initial State**
  - اگر `artemis.dataHub` موجود باشد → مستقیماً در state محلی `dataHub` قرار می‌گیرد، بدون API اضافی.
  - اگر موجود نباشد:
    - `useEffect` → `loadDataHub()`:
      - `setIsLoading(true)`
      - `const hub = await api.fetchDataHubState();`
      - روی موفقیت: `setDataHub(hub)`
      - روی خطا: `console.error('Failed to load Data Hub:', e)`
      - `finally`: `setIsLoading(false)`

- **Flowهای مهم دیگر**
  - Health:
    - `handleCheckHealth` → `api.checkDataHubHealth()` → بروزرسانی `dataHub.health` یا alert خطا.
  - Agents for automation:
    - `useEffect` دوم → `api.fetchAIAgents()` با `try/catch` و console.error در خطا.
  - Telegram Collector (login/confirm/cancel/refresh/link/test) → مجموعه‌ای از توابع API با state محلی (`collectorHealth`, `collectorMessage`, `collectorError`, ...).
  - Source/Category CRUD:
    - Modals با توابعی مانند `api.createDataSource`, `api.updateDataHubSource`, `api.deleteDataSource`, `api.createDataCategory`, ... و پس از موفقیت معمولاً `fetchDataHubState` مجدد.
  - Pipeline Snapshot:
    - `api.refreshDataPipelineSnapshot()` برای بروزرسانی snapshot.

- **UI**
  - `isLoading` کلی برای تب (نمایش loading ساده؛ جزئیات در کد UI این فایل).
  - بخش‌های مختلف: جدول منابع، دسته‌بندی‌ها، health summary، access logs، pipeline view، advanced features.

- **مشاهدات/ریسک‌ها**
  - بیشتر عملیات حیاتی (Health check، CRUD، Telegram login، pipeline refresh) در صورت خطا حداقل یک **alert** نشان می‌دهند؛ بنابراین کاربر می‌فهمد که action شکست خورده است.
  - برخی loadهای اولیه (مثلاً fetchAIAgents برای automation) در صورت خطا فقط console.error می‌دهند و UI را در حالت "بدون agent" رها می‌کنند بدون پیام کاربری → **Silent failure محتمل** برای آن زیر‌بخش.
  - با توجه به گستردگی Data Hub، Contract mismatchهای کوچک (مثلاً تغییر نام فیلد در backend) می‌توانند در یکی از viewها باعث شکستن runtime شوند؛ این در Step 3 به‌صورت قرارداد بررسی می‌شود.

#### 3.9. Backtesting Tab

- **Flow: Initial Load**
  - `useEffect` → `Promise.all([api.fetchBacktestResults(), api.fetchTradingScenarios()])`
  - روی موفقیت: تنظیم state نتایج backtest و سناریوها.
  - روی خطا: لاگ خطا و احتمالاً state خالی؛ UI پیام خطا/خالی نشان می‌دهد (بسته به پیاده‌سازی دقیق فایل).

- **Flow: Run Backtest**
  - فرم → `api.runBacktest({ ... })` → اضافه شدن نتیجه جدید به لیست.
  - خطا: console.error + alert.

- **Flow: Delete Result**
  - `api.deleteBacktestResult(resultId)` → حذف از state + alert.

- **مشاهدات/ریسک‌ها**
  - Loading و خطا برای عملیات اکشن (run/delete) از طریق alert‌ها مشخص است.
  - خطای اولیه در `fetchBacktestResults` می‌تواند باعث نمایان‌شدن فقط پیام "no data" شود بدون تفکیک بین «داده نیست» و «لود نشد»؛ رفتار فعلی محافظه‌کارانه است ولی از دید UX می‌تواند مبهم باشد.

#### 3.10. System Logs Tab

- **Flow**
  - Initial load: `api.fetchArtemisLogs(filter)` در `useEffect` → پر کردن state لاگ‌ها.
  - فیلتر/جستجو باعث آپدیت state فقط در frontend می‌شود.
  - Auto-refresh: interval برای فراخوانی مجدد `fetchArtemisLogs`.
  - Clear Logs: `api.clearArtemisLogs()` → در صورت موفقیت، خالی کردن state و نمایش پیام/به‌روزرسانی.

- **مشاهدات/ریسک‌ها**
  - خطا در fetch اولیه در کد فعلی منجر به console.error و معمولاً پیام "Failed to load" یا لیست خالی می‌شود (بسته به پیاده‌سازی دقیق این تب).
  - وجود auto-refresh به‌معنای درخواست‌های مکرر به `/logs` است؛ در صورت خطاهای مکرر، خطر پر شدن کنسول با errorها وجود دارد، اما UI فرو نمی‌ریزد.

#### 3.11. Settings Tab

- **Flow**
  - تنظیمات در state محلی `config` نگهداری می‌شود (مقداردهی اولیه از `artemis.config`/defaults).
  - ذخیره: کلیک روی Save → `api.updateArtemisConfig({ config })` → در موفقیت alert "saved" و احتمالاً به‌روزرسانی نمایش.
  - Reset/Import/Export نیز در همین لایه کار می‌کنند (با تعامل با فایل/clipboard در frontend).

- **مشاهدات/ریسک‌ها**
  - در صورت خطا در `updateArtemisConfig`، alert "failed" نمایش داده می‌شود؛ silent failure کامل وجود ندارد.
  - Contract mismatch بین ساختار `config` در frontend و backend می‌تواند خطای runtime ایجاد کند (مثلاً فیلد جدیدی در backend اضافه شده باشد)؛ بررسی در Step 3.

---

### 4. AIAgents Tab

- **Flow**
  - Mount → `useEffect` → `fetchData`:
    - `setIsLoading(true)`
    - `const agentData = await api.fetchAIAgents();`
    - `setAgents(agentData);`
    - `setIsLoading(false);`
    - **بدون `try/catch`**.
  - UI:
    - اگر `isLoading` → پیام `{t('loading')}`.
    - پس از بارگذاری: grid کارت‌های Agents + محتوای modal مناسب با `selectedAgent`.

- **مشاهدات/ریسک‌ها**
  - چون هیچ `try/catch` وجود ندارد، اگر `fetchAIAgents` reject شود:
    - Unhandled Promise Rejection در کنسول.
    - `setIsLoading(false)` هرگز اجرا نمی‌شود → تب در حالت Loading دائمی می‌ماند → **Runtime bug سطح بالا / Silent failure برای کاربر**.
  - این رفتار با سایر تب‌ها که حتی در صورت خطا `isLoading` را false می‌کنند، ناسازگار است.

---

### 5. Training Center Tab

- **Flow: Initial Load & Auto-Refresh**
  - Mount → `useEffect` → `fetchData`:
    - `setIsLoading(true)`
    - `Promise.all([api.fetchTrainingData(), api.fetchArtemisState(), api.fetchAIAgents()])`
    - روی موفقیت: پرکردن `data`, `artemis`, `agents`, `trainingConfig`.
    - روی خطا: `console.error('Failed to load training data:', e)` بدون پیام کاربری.
    - `finally`: `setIsLoading(false)`
  - Interval: هر ۳۰ ثانیه `fetchData` دوباره صدا زده می‌شود.
  - UI:
    - اگر `isLoading` → `{t('loading')}`.
    - اگر `!data` پس از لود → پیام واضح `{t('failed_to_load_data') || 'Failed to load training data'}`.

- **Flow: Actions**
  - `handleArtemisAutoConfig` → `api.artemisAutoConfigureTraining()` با alert موفق/خطا.
  - `handleTrainAll`, `handleTrainNow`, `handleScheduleSession`, `handleCompleteSession` → همگی API calls با alert و disable state هنگام در حال اجرا بودن.

- **مشاهدات/ریسک‌ها**
  - خطای اولیه لود داده‌ها silent برای کاربر نیست؛ پیام "Failed to load training data" نمایش داده می‌شود.
  - خطای عملیات اکشن‌ها نیز alert دارد؛ بنابراین رفتار UX از نظر feedback مناسب است.
  - با توجه به auto-refresh، در صورت شکست مکرر backend، کاربر پیام خطای مکرر روی صفحه اصلی نمی‌بیند (فقط در کنسول) اما تب به حالت `Failed to load` در اولین بار خواهد رفت.

---

### 6. Analytics Dashboard Tab

- **Flow: Initial Load & Auto-Refresh**
  - Mount → `useEffect` → `fetchData`:
    - `setIsLoading(true)`
    - `Promise.all([api.fetchAnalyticsData(), api.fetchAIAgents(), api.fetchArtemisState()])`
    - روی موفقیت: `setData`, `setAgents`, `setArtemis`.
    - روی خطا: `console.error('Failed to load analytics:', e)`.
    - `finally`: `setIsLoading(false)`.
  - Auto-refresh: اگر `refreshInterval` تعریف شده باشد، interval برای فراخوانی دوباره `fetchData` ساخته می‌شود.
  - UI:
    - اگر `isLoading` → spinner و متن `{t('loading')}`.
    - اگر `!data` بعد از لود → پیام `{t('failed_to_load_data') || 'Failed to load analytics data'}`.

- **مشاهدات/ریسک‌ها**
  - مشابه Training Center، خطای اولیه `fetchAnalyticsData` به‌صورت پیام واضح نشان داده می‌شود، نه silent.
  - Auto-refresh در صورت خطای مکرر فقط کنسول را پر می‌کند؛ UI بعد از اولین خطا در حالت "Failed to load analytics data" می‌ماند تا رفرش بعدی موفق شود.

---

### 7. API Config Tab

- **Flow: Initial Load**
  - Mount → `useEffect` → `fetchData`:
    - `setIsLoading(true)`
    - `Promise.all([api.fetchAPIConfigData(), api.fetchArtemisState()])`
    - روی موفقیت: `setApiConfig`, `setArtemis`.
    - روی خطا: `console.error('Failed to load configuration:', e)`.
    - `finally`: `setIsLoading(false)`.
  - UI:
    - کد، مسیر نمایش صریح برای حالت `apiConfig === null` را دارد (فرم‌ها معمولاً تنها در صورت داشتن config کامل رندر می‌شوند)؛ در صورت نبود config، بخشی از UI ممکن است خالی/محدود باشد ولی crash نمی‌کند.

- **Flow: Test Key**
  - `handleTestKey(serviceId, keyId?)`:
    - بر اساس `serviceId` و `apiConfig`، سرویس و key را پیدا می‌کند.
    - برای سرویس‌های مدل (Gemini/Claude/OpenAI/DeepSeek):
      - key را موقتاً در `localStorage` با prefix `temp_*_key` ذخیره، تابع تست (`testGeminiConnection` و غیره) را صدا می‌زند، سپس key را حذف می‌کند.
    - برای سایر سرویس‌ها:
      - `api.testAIIntegration(serviceId, config)` را صدا می‌زند.
    - روی موفقیت: alert موفقیت و به‌روزرسانی status key در config (status/lastTested) + ذخیره با `saveAPIConfig`.
    - روی خطا: پیام کاربرپسند (CORS/quota/401/...) و alert «Connection test failed».

- **Flow: Add/Remove API Key**
  - `handleAddAPIKey`:
    - بدون تماس مستقیم به backend برای ذخیره کلید؛ از `saveAPIConfig(updatedConfig)` داخلی برای نوشتن config استفاده می‌شود (لایه persist در `services/api.ts` قرار دارد).
    - روی موفقیت: alert "API Key added", روی خطا: alert "Failed to add API key".
  - `handleRemoveAPIKey`:
    - حذف key از ساختار `apiConfig` و ذخیره آن.

- **مشاهدات/ریسک‌ها**
  - اگر `fetchAPIConfigData` شکست بخورد، تب بعد از `isLoading=false` می‌ماند ولی `apiConfig` null است؛ بر اساس کد، این باعث عدم رندر بخش‌هایی از فرم می‌شود، ولی پیام خطای کاربرپسند مستقل ندارد (فقط console.error).
  - تست کلیدها UX خوبی دارد (alertهای واضح)، اما اگر `testAIIntegration` به دلیل CORS شکست بخورد، پیام بسیار مفصل برای Gemini نشان داده می‌شود؛ این به‌معنای عدم silent failure است.

---

### 8. جمع‌بندی Step 2 (فقط مشاهده، بدون پیشنهاد راه‌حل)

- **نقاط با Loading/Error شفاف (نسبتاً سالم):**
  - AIManager ریشه (state Artemis + AIManagerData)
  - Decision Engine actions
  - Monitoring health check & alert actions
  - Scenarios actions (Generate, Create, Backtest)
  - Backtesting actions
  - System Logs (fetch/clear)
  - Settings save
  - Training Center (initial load + actions)
  - Analytics Dashboard (initial load)
  - APIConfig test/save actions

- **نقاط با رفتار مبهم یا Silent Failure محتمل (بدون ورود به Step 3):**
  - `AICenter`:
    - نبود `try/catch` در `prefetchData` → احتمال گیرکردن در "loading" در صورت شکست `fetchAIManagerData`.
  - `AIAgents`:
    - نبود `try/catch` در `fetchAIAgents` → Unhandled Promise Rejection + loading بی‌پایان.
  - Sub-loadهای خاص در Data Hub (مثلاً fetchAIAgents برای automation) و Overview/Scenarios:
    - خطاهای شبکه فقط در کنسول ثبت می‌شوند و کاربر فقط لیست خالی/No data می‌بیند (تفاوت بین «واقعاً خالی» و «لود نشد» مشخص نیست).
  - APIConfig/Overview/DataHub در لود اولیه:
    - در صورت شکست اولین لود، پیام خطای کاربری مجزا (مثل "Failed to load configuration/data") معمولاً وجود ندارد، و تب فقط خالی/ناقص خواهد بود.

در این مرحله هیچ تغییری در کد انجام نشده و فقط رفتار فعلی (بر اساس کد + الگوی state) مستند شده است. برای Step 3 (Contract & Integration Check) می‌توانیم روی همین نقاط پرریسک تمرکز کنیم.*** End Patch


## Step 3 – Contract & Integration Check

در این بخش، تمرکز روی **قرارداد Frontend ↔ Backend/Service** و یکپارچگی داده بین تب‌های مختلف AI Menu است. به‌خاطر نبود کد backend در این ریپو، قراردادها بر اساس:

- تایپ‌های TypeScript در `types.ts`
- توابع API در `services/api.ts`
- الگوی استفاده از این داده‌ها در کامپوننت‌های AI Menu  

تحلیل شده‌اند. برای هر مشکل، دسته‌ی آن (Bug / Contract Ambiguity / UX Ambiguity) و تأثیرش روی Runtime مشخص شده است.

---

### 1. AICenter – بدون هندلینگ خطا برای `fetchAIManagerData`

- **مسیر**: `components/AICenter.tsx` – `prefetchData` در `useEffect` (حدود خطوط 17–25)
- **قرارداد مورد انتظار**:
  - `api.fetchAIManagerData(): Promise<AIManagerOverview>` ممکن است:
    - موفق شود و داده‌ی معتبر برگرداند؛ یا
    - reject شود (مشکل شبکه، IndexedDB، خطای داخلی).
- **رفتار فعلی**:
  - `await api.fetchAIManagerData()` **بدون `try/catch/finally`** صدا زده می‌شود.
  - اگر Promise reject شود:
    - `setIsLoading(false)` هرگز صدا زده نمی‌شود.
    - `AICenter` در حالت `{t('loading')}` دائمی می‌ماند.
    - Unhandled Promise Rejection در کنسول مرورگر ایجاد می‌شود.
- **نوع مشکل**: **True Bug – Runtime / Integration**
- **شدت (Severity)**: **High**
- **اثر در Runtime**:
  - برای کاربر، AI Menu (همه تب‌ها شامل Manager/Agents/Training/Analytics/Config) ممکن است اصلاً رندر نشود و فقط متن "loading" دیده شود.
  - هیچ پیام خطای کاربرپسند وجود ندارد و مشکل به‌راحتی تشخیص داده نمی‌شود (تقریباً silent).

---

### 2. AIAgents – بدون `try/catch` در `fetchAIAgents`

- **مسیر**: `components/ai/AIAgents.tsx` – `useEffect` اولیه (`fetchData`) (حدود خطوط 27–35)
- **قرارداد مورد انتظار**:
  - `api.fetchAIAgents(): Promise<AIAgent[]>` ممکن است:
    - به‌درستی لیست ایجنت‌ها را از backend یا IndexedDB برگرداند؛ یا
    - در صورت خطا reject شود.
- **رفتار فعلی**:
  - `const agentData = await api.fetchAIAgents();` بدون `try/catch`.
  - اگر Promise reject شود:
    - `setIsLoading(false)` هرگز صدا زده نمی‌شود.
    - تب Agents همیشه `{t('loading')}` نشان می‌دهد.
    - Unhandled Promise Rejection در کنسول.
- **نوع مشکل**: **True Bug – Runtime**
- **شدت**: **High**
- **اثر در Runtime**:
  - کل تب Agents غیرقابل استفاده می‌شود (loading دائمی).
  - کاربر هیچ پیام خطا یا راهنمایی نمی‌بیند؛ فقط spinner/text loading.

---

### 3. DataHubState – فرض وجود `cache` در داده ذخیره‌شده

- **مسیر**: `services/api.ts` – تابع `fetchDataHubState` (حدود خطوط 22013–22041)
- **تایپ قرارداد**:
  - `DataHubState.cache: DataCacheStats` در `types.ts` **الزامی** است (غیر اختیاری).
  - اما ورژن‌های قدیمی‌تر ممکن است `cache` را در رکورد ذخیره‌شده نداشته باشند (schema drift).
- **رفتار فعلی**:
  - در بلوک `if (saved && saved.value) { ... }`:
    - مستقیماً به `saved.value.cache.data` دسترسی دارد:
      - `if (!saved.value.cache.data) { saved.value.cache.data = {}; }`
    - اگر `saved.value.cache` خود `undefined` باشد (داده‌ی قدیمی)، این خط **Runtime error** (Cannot read properties of undefined) ایجاد می‌کند.
- **نوع مشکل**: **True Bug – Schema Backward-Compatibility**
- **شدت**: **High** (به‌ویژه در نصب‌هایی که Data Hub قبلاً ذخیره شده است)
- **اثر در Runtime**:
  - هرجایی که `fetchDataHubState` صدا زده شود (DataHubTab و توابع کمکی متعدد در `services/api.ts`)، اپ می‌تواند:
    - در حین لود Data Hub crash کند.
    - باعث شکست زنجیره‌ای در AIManager (اگر تب Data Hub یا بخشی از state به آن متکی باشد).

---

### 4. AIAgent Contract – نبود ولیدیشن در مرز API

- **مسیرها**:
  - `types.ts` – `interface AIAgent` (حدود خطوط 855–927)
  - `services/api.ts` – `fetchAIAgents` (خطوط 4018+)
  - `components/ai/AIAgents.tsx` و پنل‌های *AgentControl
- **قرارداد TypeScript**:
  - `AIAgent` فیلدهای **الزامی عددی** دارد:
    - `accuracy: number`, `trainingProgress: number`, `decisions: number`, `learningTime: number`, `knowledgeSize: number`, `status`, `level`, `capabilities`, `lastUpdate`.
- **رفتار فعلی در API client**:
  - `fetchAIAgents`:
    - اگر `/api/ai-agents` پاسخ `200` بدهد و `Array.isArray(data) === true`:
      - `return data as AIAgent[]` بدون چک runtime (بدون zod/guard).
  - اگر backend داده ناقص/با تایپ اشتباه بفرستد (مثلاً `accuracy: "90.5"` یا `trainingProgress` حذف شده باشد):
    - TypeScript این را در runtime نمی‌بیند و UI فرض می‌کند همه چیز `number` است.
- **رفتار در UI**:
  - `AIAgents`:
    - `agent.accuracy.toFixed(1)`، `agent.trainingProgress` برای progress bar، `agent.decisions.toLocaleString()` و ...
  - اگر یکی از این فیلدها `undefined` یا `string` باشد → احتمال **Runtime error** (مثلاً `toFixed` روی undefined/string).
- **نوع مشکل**: **Contract Ambiguity / Potential Runtime Bug**
- **شدت**: **Medium** (وابسته به کیفیت داده backend)
- **اثر در Runtime**:
  - در صورت بد بودن داده backend:
    - تب Agents می‌تواند crash کند.
    - مشکل فقط در محیط‌هایی دیده می‌شود که backend داده ناسازگار برمی‌گرداند.
  - چون fallback IndexedDB و defaults مقادیر صحیح (number) می‌دهند، مشکل بیشتر در حالت‌هایی است که API واقعی pathهای جدید یا فیلدهای ناقص تولید کند.

---

### 5. ArtemisState در AIManager vs سایر بخش‌ها

- **مسیرها**:
  - `types.ts` – `ArtemisState` (خطوط 3764–3779)
  - `components/ai/defaults.ts` – `DEFAULT_ARTEMIS_STATE` و `mergeWithArtemisDefaults`
  - `components/ai/hooks/useArtemisState.ts`
  - مصرف در:
    - `components/ai/AIManager/index.tsx` و تب‌های داخلی
    - `components/ai/TrainingCenter.tsx`, `components/ai/AnalyticsDashboard.tsx`, `components/ai/APIConfig.tsx`
- **قرارداد TypeScript**:
  - `dataHub?: DataHubState; config?: ArtemisConfig; logs?: ArtemisLog[]` به‌صورت **اختیاری** تعریف شده‌اند.
- **الگوی استفاده**:
  - در AIManager:
    - همیشه از `useArtemisState` استفاده می‌شود که `mergeWithArtemisDefaults` را اعمال می‌کند → در عمل `decisionEngine`, `learningSystem`, `orchestration`, `systemHealth` و `dataHub` همیشه مقداردهی امن دارند.
  - در TrainingCenter / AnalyticsDashboard / APIConfig:
    - مستقیماً `api.fetchArtemisState()` صدا زده می‌شود، بدون merge.
    - دسترسی به `artemis` در این فایل‌ها معمولاً با `artemis?` و optional chaining انجام می‌شود (از قطعات کد بررسی‌شده مشخص است).
- **مشاهده**:
  - بین **تعریف تایپ** و **واقعیت استفاده** در AIManager، یک **شبه‌تضاد** وجود دارد:
    - Types می‌گویند `dataHub` اختیاری است، اما در عمل، بعد از `mergeWithArtemisDefaults`، در AIManager همیشه وجود دارد (در default state).
  - در سایر بخش‌ها که merge اعمال نشده، رفتار احتیاطی (optional chaining) رعایت شده است.
- **نوع مشکل**: **Contract Ambiguity (نه bug مستقیم)**
- **شدت**: **Low**
- **اثر در Runtime**:
  - در AIManager به‌دلیل استفاده از defaults و merge، crash ناشی از `undefined` محتمل نیست.
  - در Training/Analytics/APIConfig نیز به‌دلیل optional chaining احتمال crash پایین است؛ این بیشتر یک **عدم‌سازگاری ذهنی بین type و واقعیت** است و می‌تواند در توسعه آتی منبع سوءتفاهم شود.

---

### 6. رفتار “No data” vs “Load failed” در چند تب

این بخش‌ها از نظر قرارداد **bug قطعی** ندارند، اما از منظر contract/UX ممکن است باعث تفسیر اشتباه وضعیت سیستم شوند:

- **مسیرها و مثال‌ها**:
  - OverviewTab: خطا در `fetchArtemisLogs` یا `fetchTradingScenarios` → فقط `console.error` و `recentLogs = []`, `scenarios = []` → UI پیام "No data available".
  - ScenariosTab: خطا در `fetchTradingScenarios` → لیست خالی + "No data" (بدون تمایز بین «سناریو نیست» و «لود نشد»).
  - DataHubTab: برخی زیر‌بخش‌ها (مثلاً لیست agents برای automation) در خطا فقط console.error و state خالی؛ UI "بدون داده" نشان می‌دهد.
  - APIConfig: خطا در `fetchAPIConfigData` → فقط console.error؛ UI ممکن است بخش‌هایی را اصلاً رندر نکند (به‌جای پیام "Failed to load configuration").
- **نوع مشکل**: **UX Ambiguity / Contract Ambiguity (بین «داده خالی» و «لود نشد»)**  
- **شدت**: **Low–Medium** (بسته به critical بودن تب برای کاربر)
- **اثر در Runtime**:
  - سیستم crash نمی‌کند.
  - اما کاربر نمی‌تواند بفهمد:
    - آیا **Backend واقعاً داده‌ای ندارد** (مثلاً هیچ سناریو یا لاگی ثبت نشده)
    - یا **Backend/شبکه مشکل دارد** و request fail شده است.

---

### 7. Backward Compatibility در DataHub Advanced Features

- **مسیر**:
  - `components/ai/AIManager/tabs/DataHubTab.tsx` – بخش‌های مرتبط با `combinedCollectorHealth` و نام‌های جایگزین فیلدها (مثلاً `channelsTracked` vs `trackedChannels`, `channelsWithErrors` vs `channelsInError`, `uptime` vs `uptimeMs`، …).
  - `services/api.ts` – `fetchDataHubState`, `getTelegramCollectorHealth`, سایر توابع DataHub.
- **قرارداد مورد انتظار**:
  - نسخه‌های مختلف backend ممکن است از نام‌های متفاوت برای فیلدهای health استفاده کنند.
- **رفتار فعلی**:
  - در `DataHubTab`, health collector به‌شکل زیر خوانده می‌شود:
    - `channelsTracked ?? trackedChannels ?? '-'`
    - `channelsWithErrors ?? channelsInError ?? 0`
    - `uptimeMs ?? uptime`
  - این یعنی UI عمداً برای چند قرارداد backend مختلف طراحی شده است.
- **نوع مشکل**: **Contract Ambiguity آگاهانه (نه bug)**  
- **شدت**: **Low**
- **اثر در Runtime**:
  - امکان نمایش درست health summary در چند نسخه backend مختلف را زیاد می‌کند.
  - اگر backend فیلدهای دیگری کاملاً متفاوت بفرستد، این قسمت به‌سادگی `'-'` یا `0` نمایش می‌دهد؛ crash نمی‌کند، اما ممکن است داده ناقص باشد (UX-level issue، نه runtime bug).

---

### 8. خلاصه Step 3

- **Bugهای واقعی (قابل اقدام)**:
  1. نبود هندلینگ خطا در `AICenter` برای `fetchAIManagerData` → ممکن است کل AI Menu در حالت loading گیر کند. (High)
  2. نبود `try/catch` در `AIAgents` برای `fetchAIAgents` → تب Agents می‌تواند همواره در loading بماند + Unhandled Rejection. (High)
  3. فرض وجود `cache` در `fetchDataHubState` هنگام لود state ذخیره‌شده → خطر crash در Data Hub برای داده‌های قدیمی. (High)

- **Contract Ambiguity / Riskها (احتمال باگ در مواجهه با داده ناسازگار)**:
  4. عدم ولیدیشن runtime برای `AIAgent` در `fetchAIAgents` درحالی‌که UI فرض `number` بودن همه فیلدها را دارد. (Medium)
  5. تفاوت بین تعریف `ArtemisState` (فیلدهای اختیاری) و استفاده در AIManager (پس از merge، در عمل همه فیلدها وجود دارند). (Low)
  6. رفتار «No data» در تب‌هایی مثل Overview/Scenarios/DataHub/APIConfig که خطا را از خالی بودن واقعی داده قابل تشخیص نمی‌کند. (Low–Medium)

این موارد در فایل جداگانه `AI_MENU_BUG_REPORT.md` به‌صورت لیست اقدام‌پذیر و رسمی جمع‌بندی شده‌اند. در این مرحله هنوز هیچ فیكس یا refactor انجام نشده است.***

---

## Step 6 – Tests & Final Validation

تاریخ: 2025-12-24  
وضعیت: **تمام فیكس‌های Milestone 1, 2, 3 پیاده‌سازی شده‌اند**

این بخش شامل:
- تأیید کد (Code Verification) برای اطمینان از وجود تمام فیكس‌ها
- مراحل اعتبارسنجی دستی (Manual Validation Steps) برای هر تست
- نتایج مورد انتظار (Expected Outcomes)
- محدودیت‌ها (Limitations) – مواردی که بدون اجرای واقعی برنامه قابل تأیید نیستند

---

### 1. تأیید کد (Code Verification)

#### ✅ A1 – AICenter Error Handling
- **فایل**: `components/AICenter.tsx`
- **تأیید شده**:
  - خط 16: `const [loadError, setLoadError] = useState<string | null>(null);` ✅
  - خط 18-33: `prefetchData` با `try/catch/finally` و `setLoadError` ✅
  - خط 89-100: رندر شرطی برای `loadError` با دکمه "Retry" ✅
  - خط 97: `onClick={prefetchData}` برای retry ✅

#### ✅ A2 – AIAgents Error Handling
- **فایل**: `components/ai/AIAgents.tsx`
- **تأیید شده**:
  - خط 26: `const [error, setError] = useState<string | null>(null);` ✅
  - خط 28-41: `fetchData` با `try/catch/finally` و `setError` ✅
  - خط 57-70: رندر شرطی برای `error` با دکمه "Retry" ✅
  - خط 64: `onClick={fetchData}` برای retry ✅

#### ✅ A3 – DataHub Backward Compatibility
- **فایل**: `services/api.ts` – `fetchDataHubState`
- **تأیید شده**:
  - خط 22085-22095: چک `if (!saved.value.cache)` و مقداردهی پیش‌فرض ✅
  - خط 22096-22097: چک `if (!saved.value.cache.data)` و مقداردهی `{}` ✅
  - هر دو حالت missing `cache` و missing `cache.data` پوشش داده شده‌اند ✅

#### ✅ M2.1 – OverviewTab Load Failure Messaging
- **فایل**: `components/ai/AIManager/tabs/OverviewTab.tsx`
- **تأیید شده**: `loadError` state و پیام‌های inline برای Recent Logs و Trading Scenarios ✅

#### ✅ M2.2 – ScenariosTab Load Failure Messaging
- **فایل**: `components/ai/AIManager/tabs/ScenariosTab.tsx`
- **تأیید شده**: `loadError` state و پیام inline "Failed to load scenarios." ✅

#### ✅ M2.3 – DataHubTab Load Failure Messaging
- **فایل**: `components/ai/AIManager/tabs/DataHubTab.tsx`
- **تأیید شده**: `dataHubError` و `agentsError` states و پیام‌های inline ✅

#### ✅ M2.4 – APIConfig Load Failure Messaging
- **فایل**: `components/ai/APIConfig.tsx`
- **تأیید شده**: `loadError` state و باکس خطای inline در بالای تب ✅

#### ✅ M3.1 – sanitizeAIAgents Guard
- **فایل**: `services/api.ts`
- **تأیید شده**:
  - خط 4018-4081: تابع `sanitizeAIAgents(raw: unknown): AIAgent[]` ✅
  - خط 4101: استفاده در backend path: `const agents = sanitizeAIAgents(data);` ✅
  - خط 4122: استفاده در IndexedDB fallback: `const sanitized = sanitizeAIAgents(agents);` ✅
  - خط 4058: `level` default به `'Expert'` (مقدار مجاز طبق `types.ts:865`) ✅
  - خط 4036-4039: فقط در صورت نبودن `id` یا `name` agent حذف می‌شود ✅
  - خط 4042-4046: تابع `toNumber` برای تبدیل امن فیلدهای عددی ✅
  - خط 4076-4078: `console.warn` ساختاریافته برای اصلاح/حذف ✅

---

### 2. مراحل اعتبارسنجی دستی (Manual Validation Steps)

#### T1 – E2E Smoke Test: باز کردن AI Menu و بازدید از تمام تب‌ها

**مراحل**:
1. برنامه را اجرا کن و وارد بخش AI Menu شو (`AICenter`).
2. تب‌های زیر را به ترتیب باز کن:
   - **Manager** → تمام زیر‌تب‌های Artemis (Overview, Decision Engine, Orchestration, Learning, Monitoring, Scenarios, Data Hub, Backtesting, Logs, Settings)
   - **Agents** → لیست 15 agent و باز کردن کنترل پنل هر کدام
   - **Training** → Training Center
   - **Analytics** → Analytics Dashboard
   - **Config** → API Configuration
3. در تمام مراحل، **Console (F12 → Console)** را باز نگه دار و بررسی کن:
   - هیچ `Uncaught Error` یا `Unhandled Promise Rejection` وجود نداشته باشد.
   - هیچ `TypeError` یا `ReferenceError` وجود نداشته باشد.
   - هشدارهای `console.warn` فقط برای موارد مورد انتظار (مثلاً fallback به IndexedDB) باشند.

**نتایج مورد انتظار**:
- ✅ تمام تب‌ها بدون crash رندر می‌شوند.
- ✅ هیچ خطای console در مسیر موفق (successful API calls) وجود ندارد.
- ✅ UI به‌درستی نمایش داده می‌شود (loading → content).

**محدودیت**: بدون اجرای واقعی برنامه، نمی‌توانیم تأیید کنیم که هیچ خطای runtime وجود ندارد. این تست نیاز به اجرای دستی دارد.

---

#### T2 – A1 Failure Simulation: شبیه‌سازی خطا در `fetchAIManagerData`

**مراحل**:
1. در `components/AICenter.tsx`، خط 24 را موقتاً تغییر بده:
   ```typescript
   // قبل:
   await api.fetchAIManagerData();
   
   // بعد (برای تست):
   throw new Error('Simulated API failure');
   ```
2. برنامه را اجرا کن و AI Menu را باز کن.
3. مشاهده کن:
   - آیا UI در حالت "Loading..." گیر می‌کند؟ (نباید گیر کند)
   - آیا پیام خطا نمایش داده می‌شود؟ (باید نمایش داده شود)
   - آیا دکمه "Retry" وجود دارد؟ (باید وجود داشته باشد)
4. روی دکمه "Retry" کلیک کن و بررسی کن که `prefetchData` دوباره اجرا می‌شود.
5. کد را به حالت قبل برگردان و دوباره تست کن (مسیر موفق).

**نتایج مورد انتظار**:
- ✅ UI در حالت loading گیر نمی‌کند.
- ✅ پیام خطا (مثلاً "Failed to load AI center data.") نمایش داده می‌شود.
- ✅ دکمه "Retry" وجود دارد و با کلیک، `prefetchData` دوباره اجرا می‌شود.
- ✅ در Console، `console.error('Failed to prefetch AI manager data:', e)` ثبت می‌شود.
- ✅ هیچ `Unhandled Promise Rejection` وجود ندارد.

**محدودیت**: این تست نیاز به تغییر موقت کد دارد. در محیط production، باید از ابزارهای DevTools (Network throttling / Block request) استفاده کرد.

---

#### T3 – A2 Failure Simulation: شبیه‌سازی خطا در `fetchAIAgents`

**مراحل**:
1. در `components/ai/AIAgents.tsx`، خط 32 را موقتاً تغییر بده:
   ```typescript
   // قبل:
   const agentData = await api.fetchAIAgents();
   
   // بعد (برای تست):
   throw new Error('Simulated fetchAIAgents failure');
   ```
2. برنامه را اجرا کن و به تب **Agents** برو.
3. مشاهده کن:
   - آیا UI در حالت "Loading..." گیر می‌کند؟ (نباید گیر کند)
   - آیا پیام خطا نمایش داده می‌شود؟ (باید نمایش داده شود)
   - آیا دکمه "Retry" وجود دارد؟ (باید وجود داشته باشد)
4. روی دکمه "Retry" کلیک کن و بررسی کن که `fetchData` دوباره اجرا می‌شود.
5. کد را به حالت قبل برگردان و دوباره تست کن (مسیر موفق).

**نتایج مورد انتظار**:
- ✅ UI در حالت loading گیر نمی‌کند.
- ✅ پیام خطا (مثلاً "Failed to load AI agents.") نمایش داده می‌شود.
- ✅ دکمه "Retry" وجود دارد و با کلیک، `fetchData` دوباره اجرا می‌شود.
- ✅ در Console، `console.error('Failed to load AI agents:', e)` ثبت می‌شود.
- ✅ هیچ `Unhandled Promise Rejection` وجود ندارد.

**محدودیت**: مشابه T2، نیاز به تغییر موقت کد یا استفاده از DevTools دارد.

---

#### T4 – A3 Failure Simulation: شبیه‌سازی missing `cache` و `cache.data`

**مراحل**:
1. در DevTools → Application → IndexedDB → `titan_db` → `settings`، رکورد `data_hub_state` را پیدا کن.
2. مقدار `value.cache` را حذف کن (یا `value.cache.data` را حذف کن).
3. برنامه را refresh کن و به تب **Manager → Data Hub** برو.
4. مشاهده کن:
   - آیا Data Hub crash می‌کند؟ (نباید crash کند)
   - آیا UI به‌درستی رندر می‌شود؟ (باید رندر شود)
   - آیا `cache` و `cache.data` با مقادیر پیش‌فرض مقداردهی شده‌اند؟ (باید مقداردهی شده باشند)
5. در Console، بررسی کن که هیچ `TypeError: Cannot read property 'data' of undefined` وجود ندارد.

**نتایج مورد انتظار**:
- ✅ Data Hub بدون crash رندر می‌شود.
- ✅ `fetchDataHubState` در خط 22085-22097، `cache` و `cache.data` را با مقادیر پیش‌فرض مقداردهی می‌کند.
- ✅ UI به‌درستی نمایش داده می‌شود (مثلاً `cache.data` به صورت `{}` نمایش داده می‌شود).
- ✅ هیچ خطای runtime وجود ندارد.

**محدودیت**: این تست نیاز به دسترسی به IndexedDB در DevTools دارد. در محیط production، باید از ابزارهای mock استفاده کرد.

---

#### T5 – No-Regression Check: تأیید عدم تغییر رفتار در مسیر موفق

**مراحل**:
1. مطمئن شو که تمام APIها موفق هستند (backend در دسترس است، IndexedDB داده دارد).
2. برنامه را اجرا کن و تمام تب‌های AI Menu را باز کن:
   - Manager (تمام زیر‌تب‌ها)
   - Agents
   - Training
   - Analytics
   - Config
3. برای هر تب، بررسی کن:
   - آیا UI دقیقاً مانند قبل از فیكس‌ها نمایش داده می‌شود؟ (باید یکسان باشد)
   - آیا loading states به‌درستی کار می‌کنند؟ (باید کار کنند)
   - آیا محتوا (texts, layout, metrics) همانند قبل است؟ (باید همانند باشد)
   - آیا هیچ پیام خطای اضافی نمایش داده نمی‌شود؟ (نباید نمایش داده شود)
4. در Console، بررسی کن که:
   - هیچ خطای جدیدی وجود ندارد.
   - هشدارهای `console.warn` فقط برای موارد مورد انتظار (مثلاً fallback) هستند.

**نتایج مورد انتظار**:
- ✅ رفتار UI در مسیر موفق (successful API calls) دقیقاً مانند قبل از فیكس‌ها است.
- ✅ هیچ تغییر در layout، متن‌ها، یا flow وجود ندارد.
- ✅ loading states به‌درستی کار می‌کنند (loading → content).
- ✅ هیچ پیام خطای اضافی نمایش داده نمی‌شود.

**محدودیت**: این تست نیاز به مقایسه با نسخه قبل از فیكس‌ها دارد. اگر نسخه قبل در دسترس نیست، باید از memory یا screenshots استفاده کرد.

---

### 3. خلاصه نتایج (Summary)

#### ✅ فیكس‌های پیاده‌سازی شده
- **A1, A2, A3**: تمام باگ‌های High priority برطرف شده‌اند.
- **M2.1, M2.2, M2.3, M2.4**: تمام پیام‌های خطای inline اضافه شده‌اند.
- **M3.1**: `sanitizeAIAgents` guard در مرز API پیاده‌سازی شده است.

#### ⚠️ محدودیت‌های تست
- **T1, T2, T3, T4, T5**: تمام تست‌ها نیاز به اجرای واقعی برنامه دارند.
- بدون اجرای برنامه، نمی‌توانیم تأیید کنیم که:
  - هیچ خطای runtime وجود ندارد.
  - UI به‌درستی رندر می‌شود.
  - Retry buttons کار می‌کنند.
  - Backward compatibility در عمل کار می‌کند.

#### 📋 مراحل بعدی (Next Steps)
1. **اجرای دستی تست‌ها**: تمام تست‌های T1-T5 را در محیط dev اجرا کن.
2. **تأیید نتایج**: نتایج واقعی را با "نتایج مورد انتظار" مقایسه کن.
3. **به‌روزرسانی چک‌لیست**: در `docs/reports/AI_MENU_FIX_CHECKLIST.md`، T1-T5 را تیک بزن.
4. **گزارش نهایی**: اگر همه تست‌ها موفق بودند، یک گزارش نهایی (Final Report) ایجاد کن که قبل/بعد را مقایسه می‌کند.

---

### 4. فایل‌های مرتبط

- `docs/reports/AI_MENU_FIX_CHECKLIST.md` – چک‌لیست پیشرفت
- `docs/reports/AI_MENU_BUG_REPORT.md` – گزارش باگ‌های شناسایی شده
- `components/AICenter.tsx` – فیكس A1
- `components/ai/AIAgents.tsx` – فیكس A2
- `services/api.ts` – فیكس A3 و M3.1
- `components/ai/AIManager/tabs/OverviewTab.tsx` – فیكس M2.1
- `components/ai/AIManager/tabs/ScenariosTab.tsx` – فیكس M2.2
- `components/ai/AIManager/tabs/DataHubTab.tsx` – فیكس M2.3
- `components/ai/APIConfig.tsx` – فیكس M2.4

---

**پایان Step 6 – Tests & Final Validation**

---

## Step 6 – Runtime Validation Results (Actual Execution)

تاریخ اجرا: [تاریخ را اینجا وارد کنید]  
تست‌کننده: [نام تست‌کننده]  
محیط: [Development / Staging / Production]

---

### T1 – E2E Smoke Test

**مراحل انجام شده**:
1. [مراحل را اینجا ثبت کنید]

**نتایج مشاهده شده**:
- Console Errors: [هیچ / لیست خطاها]
- Unhandled Promise Rejections: [هیچ / لیست]
- Stuck Loading: [خیر / بله - کجا؟]
- UI Rendering: [✅ موفق / ❌ مشکل]

**Screenshots/Logs**:
- [لینک یا متن لاگ‌های مهم]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### T2 – A1 Failure Simulation

**مراحل انجام شده**:
1. [تغییرات کد موقت اعمال شد]
2. [مراحل تست]

**نتایج مشاهده شده**:
- UI در loading گیر کرد؟ [خیر / بله]
- پیام خطا نمایش داده شد؟ [بله / خیر]
- دکمه Retry وجود داشت؟ [بله / خیر]
- Retry کار کرد؟ [بله / خیر]
- Unhandled Promise Rejection: [هیچ / بله]

**بعد از Revert**:
- رفتار عادی بازگشت؟ [بله / خیر]

**Screenshots/Logs**:
- [لینک یا متن لاگ‌های مهم]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### T3 – A2 Failure Simulation

**مراحل انجام شده**:
1. [تغییرات کد موقت اعمال شد]
2. [مراحل تست]

**نتایج مشاهده شده**:
- UI در loading گیر کرد؟ [خیر / بله]
- پیام خطا نمایش داده شد؟ [بله / خیر]
- دکمه Retry وجود داشت؟ [بله / خیر]
- Retry کار کرد؟ [بله / خیر]
- Unhandled Promise Rejection: [هیچ / بله]

**بعد از Revert**:
- رفتار عادی بازگشت؟ [بله / خیر]

**Screenshots/Logs**:
- [لینک یا متن لاگ‌های مهم]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### T4 – A3 DataHub Backward Compatibility

**مراحل انجام شده**:
1. [IndexedDB state تغییر یافت - کدام حالت؟ cache missing / cache.data missing]
2. [مراحل تست]

**نتایج مشاهده شده**:
- DataHub crash کرد؟ [خیر / بله - جزئیات]
- UI رندر شد؟ [بله / خیر]
- cache با defaults مقداردهی شد؟ [بله / خیر]
- Console Errors: [هیچ / لیست خطاها]

**Screenshots/Logs**:
- [لینک یا متن لاگ‌های مهم]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### T5 – No-Regression Check

**مراحل انجام شده**:
1. [تمام APIها موفق بودند]
2. [تمام تب‌ها باز شدند]

**نتایج مشاهده شده**:
- UI مانند قبل بود؟ [بله / خیر - تفاوت‌ها]
- Loading states کار کردند؟ [بله / خیر]
- محتوا یکسان بود؟ [بله / خیر]
- پیام خطای اضافی؟ [خیر / بله - کجا؟]
- Console Errors: [هیچ / لیست]

**Screenshots/Logs**:
- [لینک یا متن لاگ‌های مهم]

**نتیجه**: ⏳ PENDING / ✅ PASS / ❌ FAIL

---

### خلاصه نتایج Runtime Validation

| Test | Status | Notes |
|------|--------|-------|
| T1 - E2E Smoke | ⏳ PENDING | - |
| T2 - A1 Failure | ⏳ PENDING | - |
| T3 - A2 Failure | ⏳ PENDING | - |
| T4 - A3 Backward Compat | ⏳ PENDING | - |
| T5 - No Regression | ⏳ PENDING | - |

**Overall Status**: ⏳ PENDING - در انتظار اجرای تست‌ها

---

**نکته**: این بخش باید با نتایج واقعی runtime validation پر شود. برای راهنمایی، به `docs/reports/RUNTIME_TEST_HELPERS.md` مراجعه کنید.