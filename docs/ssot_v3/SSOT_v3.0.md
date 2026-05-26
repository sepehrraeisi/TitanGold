## TITAN AI – SSOT v3.0 Coverage Matrix (AI Center)

این فایل، **جدول پوشش نهایی** برای همه تب‌ها و زیرتب‌های AI Center است و باید با:

- `docs/ssot_v3/generated/UI_TABS.json` (Registry UI)
- `docs/ssot_v3/generated/ROUTES.json` (Inventory API)

کاملاً هم‌راستا باشد. در پایان، هیچ سطر نباید در وضعیت `UNKNOWN` باقی بماند.

### Status Legend

- **Implemented**: UI + API + DB (+ Worker در صورت وجود) وصل و عملیاتی.
- **Partial**: بخشی از لایه‌ها یا سناریوها ناقص / stub / در حال توسعه.
- **UI-Only**: UI وجود دارد ولی backend/DB واقعی ندارد (آگاهانه و مستند).
- **Missing**: در Registry هست اما عملاً پیاده‌سازی نشده.
- **UNKNOWN**: فقط در مراحل اولیه مجاز؛ در پایان باید صفر شود.

---

### ۱. ریشه AI Center

| Module ID | Module | UI | API | DB | Worker | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `dashboard.ai` | AI Center (Dashboard → view=ai) | `components/AICenter.tsx` | `/api/v1/ai-agents`, `/api/v1/artemis/state` (indirect via hooks) | `ai_agents`, `artemis_state` | Autopilot Worker, Engine Worker | Partial | UI: `components/Dashboard.tsx`, `components/AICenter.tsx` – API/DB: `backend/routes/ai-agents.js`, `backend/routes/artemis.js` |

---

### ۲. AI Center – Top-Level Tabs

| Module ID | Module | UI | API | DB | Worker | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `aiCenter.manager` | AI Manager (Artemis + orchestration) | `components/ai/AIManager/index.tsx` | `/api/v1/artemis/state`, `/api/v1/artemis/health`, `/api/v1/artemis/decision`, `/api/v1/artemis/logs`, `/api/v1/artemis/learning`, `/api/v1/artemis/orchestration` | `artemis_state`, `ai_decisions`, `ai_learning_events`, `system_logs` | `titan-engine-worker`, Autopilot Worker | Partial | UI: `AIManager/index.tsx` – API: `backend/routes/artemis.js` – DB: `backend/database/migrations/*ai_decisions*` |
| `aiCenter.agents` | Agents Registry & Detail | `components/ai/AIAgents.tsx` | `/api/v1/ai-agents`, `/api/v1/ai-agents/:id`, `/api/v1/ai-agents/:id/details`, `/api/v1/ai-agents/:id/run(-v2)` | `ai_agents`, `ai_decisions`, `artemis_state` | Engine/Autopilot (decisions consumption) | Implemented | UI: `components/ai/AIAgents.tsx` – API: `backend/routes/ai-agents.js` |
| `aiCenter.training` | Training Center | `components/ai/TrainingCenter.tsx` | `/api/v1/training/sessions` (لیست و ایجاد sessionها)، `/api/v1/training/overview` (نمای کلی) | `ai_training_sessions` (و وابسته‌ها، اگر وجود دارد) | ممکن است jobs/cron برای training | Implemented | UI: `TrainingCenter.tsx` – API: `backend/routes/training.js` – Mapping: `docs/ssot_v3/TRAINING_API_MAP.md` |
| `aiCenter.analytics` | Analytics Dashboard | `components/ai/AnalyticsDashboard.tsx` | `/api/v1/analytics/overview` (summary metrics) + fallback IndexedDB | `ai_decisions`, `ai_learning_events`, `ai_agents` | -- | Partial | UI: `AnalyticsDashboard.tsx` – API: `backend/routes/analytics.js` + `services/api.ts::fetchAnalyticsData` – Mapping: `docs/ssot_v3/ANALYTICS_API_MAP.md` |
| `aiCenter.config` | API Config / Integrations | `components/ai/APIConfig.tsx` | Redirect / link به Settings → Integrations | Config tables مربوط به integrations | -- | UI-Only | UI: `APIConfig.tsx` – مسیر تنظیمات: Settings/Configuration/Integrations (بدون روت اختصاصی جدید در این ماژول) |
| `aiCenter.topicRouting` | Topic Routing Config | `components/ai/TopicRouting.tsx` | `/api/v1/topic-routing` (CRUD + logs) | `topic_routing_rules`, `topic_routing_logs`, `collected_data` | Topic router در backend (service) | Partial | UI: `TopicRouting.tsx` – API: `backend/routes/topic-routing.js` |

---

### ۳. AI Manager – Artemis Tabs

این تب‌ها زیرمجموعه `aiCenter.manager` هستند و به Artemis Orchestrator مربوط‌اند.

| Module ID | Module | UI | API | DB | Worker | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `aiManager.overview` | Artemis Overview | `AIManager/tabs/OverviewTab.tsx` | `/api/v1/artemis/state`, `/api/v1/ai-agents` | `artemis_state`, `ai_agents`, `ai_decisions` (aggregate) | Autopilot/Engine metrics | Partial | UI: `OverviewTab.tsx` – API: `backend/routes/artemis.js` |
| `aiManager.decisionEngine` | Decision Engine Config | `DecisionEngineTab.tsx` | Redirect به Settings → Configuration → Decision Engine | `artemis_state` (تنظیم از تب Settings) | Trading Engine worker مصرف‌کننده تصمیم‌ها | UI-Only | UI: `DecisionEngineTab.tsx` – تنظیمات واقعی در سکشن Settings/Configuration انجام می‌شود |
| `aiManager.orchestration` | Agent Orchestration View | `OrchestrationTab.tsx` | `/api/v1/artemis/orchestration` | `ai_agents`, `ai_decisions` | -- | Partial | UI: `OrchestrationTab.tsx` – API: `backend/routes/artemis.js` |
| `aiManager.learning` | Learning System | `LearningTab.tsx` | `/api/v1/artemis/learning`, `/api/v1/artemis/learning/mistake/:id/mark-learned`, `/api/v1/artemis/learning/event` | `ai_learning_events`, `ai_decisions` | -- | Partial | UI: `LearningTab.tsx` – API: `backend/routes/artemis.js` |
| `aiManager.monitoring` | System Monitoring (AI) | `MonitoringTab.tsx` | `/api/v1/monitoring/*`, `/metrics` | infra metrics + `request_logs`, `error_logs`, DB pool metrics | workers مختلف | Implemented | UI: `MonitoringTab.tsx` – API: `backend/routes/monitoring.js` + Prometheus `/metrics` |
| `aiManager.scenarios` | Trading Scenarios | `ScenariosTab.tsx` | `/api/v1/scenarios/*`, `/api/v1/backtest/*` | `trading_scenarios`, `backtest_runs` | Trading Engine worker / Backtest jobs | Partial | UI: `ScenariosTab.tsx` – API: `backend/routes/scenarios.js`, `backend/routes/backtest.js` |
| `aiManager.dataHub` | Data Hub (Artemis-side view) | `DataHubTab.tsx` | مجموعه‌ای از endpointهای Telegram/DataHub (جداول زیر) | `telegram_*`, `processed_telegram_messages`, `collected_data`, `data_sources`, `data_categories` | Telegram collectors, pipeline workers | Implemented | UI: `AIManager/tabs/DataHubTab.tsx` و تب‌های زیرمجموعه – API: `backend/routes/telegram.js`, `backend/routes/collected-data.js`, `backend/routes/data-sources.js`, `backend/routes/data-categories.js` |
| `aiManager.backtesting` | Backtesting | `BacktestingTab.tsx` | `/api/v1/backtest/*` | `backtest_runs`, `trading_scenarios` | Offline workers / engine worker | Partial | UI: `BacktestingTab.tsx` – API: `backend/routes/backtest.js` |
| `aiManager.logs` | Artemis & AI Logs | `SystemLogsTab.tsx` | `/api/v1/artemis/logs`, `/api/v1/artemis/logs/clear` | `system_logs`, `ai_decisions` | -- | Implemented | UI: `SystemLogsTab.tsx` – API: `backend/routes/artemis.js` (log endpoints) |
| `aiManager.settings` | Artemis Settings | `SettingsTab.tsx` | `/api/v1/artemis/config`, `/api/v1/artemis/state` (PATCH) | `artemis_state` | -- | Partial | UI: `SettingsTab.tsx` – API: `backend/routes/artemis.js` |
| `aiManager.autopilot` | Autopilot Integration | `AutopilotTab.tsx` | `/api/v1/autopilot/status`, `/api/v1/autopilot/enable`, `/api/v1/autopilot/disable`, `/api/v1/autopilot/suggestions*`, `/api/v1/autopilot/run-once` | `artemis_state` (ستون‌های autopilot_*), `autopilot_actions` | Autopilot Worker | Partial | UI: `AutopilotTab.tsx` – API: `backend/routes/autopilot.js` – DB: ستون‌های autopilot در `artemis_state` و جدول `autopilot_actions` |

---

### ۴. DataHub – Tabs (درون AI Manager)

| Module ID | Module | UI | API | DB | Worker | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `dataHub.sources` | Data Sources | `DataSourcesPanel.tsx` | `/api/v1/data-sources` (+ `test-connection`) | `data_sources`, `collected_data` | ingestion workers, crawlers | **Implemented · Design: Done** | GAP-008 · Design-1 + modal i18n cleanup. |
| `dataHub.categories` | Data Categories | `CategoriesPanel.tsx` | `/api/v1/data-categories` | `data_categories` | -- | **Implemented · Design: Done** | GAP-010 · Design-1. |
| `dataHub.pipeline` | Data Pipeline | `PipelinePanel.tsx` | `GET /api/v1/data-sources/pipeline` | `collected_data`, `data_sources`, `data_categories` | ETL/pipeline workers | **Implemented · Design: Done** | GAP-012 · Design-2. Snapshot DB → GAP-003. |
| `dataHub.health` | Health Monitoring | `HealthPanel.tsx` | `GET /api/v1/data-sources/health`, `GET /stats`, `GET /state`, `GET /access-logs` (`statusCounts.error`) | `data_sources`, `data_hub_logs` | -- | **Implemented · Design: Done** | `HealthPanel.tsx` — React Query (`useDataHubSourcesHealthQuery`, `useDataHubSourcesStatsQuery`, `useDataHubSourcesStateQuery`, `useDataHubHealthLogCountsQuery`); safe formatters; avg response + cache **N/A** (GAP-035). Demos: `DataHub_DEMOS.md` § `dataHub.health`. |
| `dataHub.logs` | Access Logs | `LogsPanel.tsx` | `GET /api/v1/data-sources/access-logs` (`limit`/`offset`, max 500) | `data_hub_logs` | -- | **Implemented · Design: Done** | GAP-013 · Design-2. RBAC read → GAP-014. |
| `dataHub.advanced` | Advanced Features | تب Advanced + ۸ زیرتب (Publisher, Automation, Access, Blacklist, Crawlers, Discovery, Prioritization, Archiving) | `/api/v1/data-hub/*` (publishers, automation, access-control, filter-rules, crawlers, discovery, prioritization, archiving) | جداول `datahub_*` per subtab (025–033) | manual / in-process only در v3.0 | **Implemented · Design: Done** | همه زیرتب‌های advanced v3.0 بسته؛ schedulers → GAP-020/027/029/031/033 (v3.1) |
| `dataHub.telegram` | Telegram Collector & Data | `TelegramPanel.tsx`, `TelegramDataPanel.tsx`, `BreakingNewsMonitor.tsx`, `CategoryBreakdown.tsx`, `GeographicHeatMap.tsx`, `AgentDetailPanel.tsx` | `/api/v1/telegram/health`, `/api/v1/telegram/agents/:agentKey/feed`, `/api/v1/telegram/agents/summary`, `/api/v1/telegram/breaking-news`, `/api/v1/telegram/events/recent`, `/api/v1/telegram/categories/*`, `/api/v1/telegram/stats/real-time`, `/api/v1/telegram/agents/:agentKey/mark-processed` | `telegram_messages`, `processed_telegram_messages`, `telegram_agent_impacts`, `telegram_news_events`, `telegram_channels`, `topic_routing_logs`, `collected_data` | Telegram collectors, pipeline/agent workers | Implemented | UI: `TelegramDataPanel.tsx`, `BreakingNewsMonitor.tsx`, `CategoryBreakdown.tsx`, `GeographicHeatMap.tsx`, `AgentDetailPanel.tsx` – API: `backend/routes/telegram.js` (به‌همراه `telegramReadAuth`) – DB: کوئری‌ها و joinهای روی جداول تلگرام در همین فایل؛ Security: مستند در `EVIDENCE.md` و بسته‌شدن GAP-006 در `GAPS_AND_PLAN.md` |

---

### ۵. DataHub – Advanced Feature Subtabs

| Module ID | Module | UI | API | DB | Worker | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `dataHub.advanced.crawlers` | Web Crawlers | `WebCrawlerConfig.tsx` | CRUD + run `/api/v1/data-hub/crawlers`; website/RSS → `collected_data` | `datahub_crawlers`, `datahub_crawler_runs` (029) | GAP-026 | **Implemented · Design: Done** | Pre-crawl + ingestion filter; render_js gated by env (GAP-027 scheduler) |
| `dataHub.advanced.discovery` | Auto Discovery | `AutoDiscoveryConfig.tsx` | `/api/v1/data-hub/discovery` scan/suggestions/approve | `datahub_discovery_*` (030) | GAP-028 | **Implemented · Design: Done** | Suggestion-only; 3-layer dedupe; SSRF explicit; GAP-029 scheduler v3.1 |
| `dataHub.advanced.prioritization` | Smart Prioritization | `SmartPrioritization.tsx` | `/api/v1/data-hub/prioritization` preview/apply/override/settings/runs | `datahub_prioritization_settings`, `datahub_source_priorities`, `datahub_prioritization_runs`, `data_sources.priority_score/tier` (031) | manual apply only | **Implemented · Design: Done** | Backend-first; scope فقط `data_sources`; no cron/auto-apply (v3.0) |
| `dataHub.advanced.access` | Access Control | `AccessControlPanel.tsx` | `GET/POST/DELETE /api/v1/data-hub/access-control` | `source_access_controls` | -- | **Implemented · Design: Done** | GAP-022. |
| `dataHub.advanced.blacklist` | Blacklist / Whitelist | `BlacklistWhitelist.tsx` | CRUD + evaluate `/api/v1/data-hub/filter-rules`; ingestion enforce on collected-data | `datahub_filter_rules` (migration 028) | GAP-024 | **Implemented · Design: Done** | Backend-first; publishing evaluate only until GAP-025 |
| `dataHub.advanced.telegramPublisher` | Telegram Publisher | `TelegramPublisher.tsx` | `/api/v1/data-hub/telegram-publishers` | `telegram_publishers`, `publisher_delivery_history` | publisher worker | **Implemented · Design: Done** | GAP-016 · Design-3. GAP-017 RBAC v3.1. |
| `dataHub.advanced.automation` | Automation / Routing | `AutomationTopics.tsx` | `/api/v1/data-hub/automation` | `datahub_automation_topics`, `datahub_automation_queue`, `datahub_automation_schedule`, `datahub_automation_executions` | manual dispatch + publisher API | **Implemented · Design: Done** | GAP-018/019 · Design-3. GAP-020 cron v3.1. |
| `dataHub.advanced.archiving` | Archiving & Cold Storage | `Archiving.tsx` | `/api/v1/data-hub/archiving` health/stats/records + manual archive/restore/purge-preview | `ai_decisions_archive`, `ai_decisions_archive_stats`, `datahub_archiving_operations` (033), view `ai_decisions_all` | manual only (no cron v3.0) | **Implemented · Design: Done** | SQL functions from `008` + API GAP-032; no auto-delete |

---

### Next Steps (Phase 2 Execution)

- برای هر سطر جدول بالا، در فاز ۲ و ۳ باید ستون‌های UI / API / DB / Worker از حالت `UNKNOWN` خارج شوند (Implemented / Partial / UI-Only / Missing) و هر claim با **Evidence (File+Line)** در همین فایل یا در `EVIDENCE.md` پشتیبانی شود.
- Registry UI (`UI_TABS.json`) و Inventory API (`ROUTES.json`) به‌عنوان مرجع ساختار استفاده می‌شوند تا **هیچ تب یا زیرتب جا نماند**.

