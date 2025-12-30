# AI Menu Structure Audit

**Date**: 2025-12-30  
**Source-of-Truth**: Dashboard.tsx, AICenter.tsx, AIManager/index.tsx  
**Navigation Type**: Tab-based (no routes, state-based switching)

---

## Navigation Hierarchy

```
Dashboard (main)
├── Dashboard (home)
├── Portfolio
├── Trades
├── Watchlist (Favorites)
├── Wallet
├── Analysis
├── **AI Center** ← Main AI Hub
├── News
├── Gold Market
└── Settings

AI Center (submenu)
├── Manager (AIManager)
├── Agents (14 agent controls)
├── Training
├── Analytics
└── Config

AIManager (nested submenu)
├── Overview
├── Decision Engine ⚠️ DUPLICATE
├── Orchestration
├── Learning
├── Monitoring ⚠️ DUPLICATE
├── Scenarios
├── Data Hub
├── Backtesting
├── System Logs
├── Settings ⚠️ DUPLICATE
└── Autopilot
```

---

## Main Menu (Dashboard.tsx)

**Source**: `components/Dashboard.tsx` (lines 40-54)  
**Type**: State-based navigation (`activeView` state)

| Key | Icon | Label (EN) | Component | Status | APIs Used | Notes |
|-----|------|-----------|-----------|--------|-----------|-------|
| dashboard | 📊 | Dashboard | TradingDashboardHome | ✅ Complete | Various trading APIs | Main home view |
| portfolio | 💼 | Portfolio | Portfolio | ✅ Complete | /api/portfolios | Portfolio management |
| trades | ⚡️ | Trades | Trades | ✅ Complete | /api/trades | Trade execution |
| favorites | ⭐️ | Watchlist | Favorites | ✅ Complete | /api/favorites | Watchlist management |
| wallet | 💼 | Wallet | WalletManagement | ✅ Complete | /api/wallet | Wallet operations |
| analysis | 🧠 | Analysis | Analysis | ✅ Complete | Analysis APIs | Market analysis |
| **ai** | 🤖 | **AI Center** | **AICenter** | ✅ Complete | Multiple AI APIs | **AI hub - see below** |
| news | 📰 | News | News | ✅ Complete | News APIs | News & updates |
| gold | 🥇 | Gold Market | GoldPage | ✅ Complete | Gold market APIs | Gold trading |
| settings | ⚙️ | Settings | Settings | ✅ Complete | Config APIs | System settings |

---

## AI Center Submenu (AICenter.tsx)

**Source**: `components/AICenter.tsx` (lines 52-58)  
**Type**: Tab-based navigation (`activeTab` state)  
**Parent**: Dashboard → AI Center

| Tab Key | Label | Component | Component Path | Status | APIs Used | Settings Overlap | Notes |
|---------|-------|-----------|----------------|--------|-----------|------------------|-------|
| manager | AI Manager | AIManager | `components/ai/AIManager/index.tsx` | ✅ Complete | /api/ai-agents, /api/artemis | YES - see below | Central AI controller with 11 sub-tabs |
| agents | AI Agents | AIAgents | `components/ai/AIAgents.tsx` | ✅ Complete | /api/ai-agents | NO | 14 agent control panels |
| training | AI Training | TrainingCenter | `components/ai/TrainingCenter.tsx` | ⚠️ Partial | /api/training | NO | Training sessions UI |
| analytics | AI Analytics | AnalyticsDashboard | `components/ai/AnalyticsDashboard.tsx` | ⚠️ Partial | Analytics APIs | NO | AI performance analytics |
| config | AI Config | APIConfig | `components/ai/APIConfig.tsx` | ⚠️ Partial | /api/config | **YES** | API provider config ← **DUPLICATE** with Settings/Configuration/Integrations |

**⚠️ DUPLICATE ALERT**: `config` tab overlaps with Settings → Configuration → Integrations

---

## AIManager Submenu (AIManager/index.tsx)

**Source**: `components/ai/AIManager/index.tsx` (lines 91-103)  
**Type**: Tab-based navigation (`activeTab` state)  
**Parent**: Dashboard → AI Center → Manager  
**Lazy-loaded tabs**: All tabs use React.lazy()

| Tab Key | Label | Component | Component Path | Status | APIs Used | Settings Overlap | Action Required |
|---------|-------|-----------|----------------|--------|-----------|------------------|-----------------|
| overview | Overview | OverviewTab | `components/ai/AIManager/tabs/OverviewTab.tsx` | ✅ Complete | /api/ai-agents/manager-overview | NO | Dashboard summary |
| **decision_engine** | **Decision Engine** | DecisionEngineTab | `components/ai/AIManager/tabs/DecisionEngineTab.tsx` | ⚠️ Partial | /api/artemis/config | **YES** | **🔴 DUPLICATE** → Settings/Configuration/Decision Engine |
| orchestration | Agent Orchestration | OrchestrationTab | `components/ai/AIManager/tabs/OrchestrationTab.tsx` | ⚠️ Partial | /api/artemis/orchestration | NO | Agent coordination |
| learning | Learning System | LearningTab | `components/ai/AIManager/tabs/LearningTab.tsx` | ⚠️ Partial | /api/artemis/learning | NO | Learning events & mistakes |
| **monitoring** | **System Monitoring** | MonitoringTab | `components/ai/AIManager/tabs/MonitoringTab.tsx` | ⚠️ Partial | Various monitoring APIs | **YES** | **🔴 DUPLICATE** → Settings/Configuration/Monitoring |
| scenarios | Trading Scenarios | ScenariosTab | `components/ai/AIManager/tabs/ScenariosTab.tsx` | ⚠️ Partial | /api/artemis/scenarios | NO | Scenario management |
| data_hub | Data Hub | DataHubTab | `components/ai/AIManager/tabs/DataHubTab.tsx` | ✅ Complete | /api/data-sources | NO | Data source management |
| backtesting | Backtesting | BacktestingTab | `components/ai/AIManager/tabs/BacktestingTab.tsx` | ⚠️ Partial | /api/backtest | NO | Backtest execution |
| logs | System Logs | SystemLogsTab | `components/ai/AIManager/tabs/SystemLogsTab.tsx` | ⚠️ Partial | /api/artemis/logs | NO | System logs viewer |
| **settings** | **Settings** | SettingsTab | `components/ai/AIManager/tabs/SettingsTab.tsx` | ⚠️ Unknown | /api/artemis/config? | **MAYBE** | **🟡 INVESTIGATE** → Check if duplicates Settings |
| autopilot | Autopilot | AutopilotTab | `components/ai/AIManager/tabs/AutopilotTab.tsx` | ⚠️ Partial | /api/autopilot | NO | Autopilot control |

---

## Detailed Status Breakdown

### ✅ Complete (Real Backend, Full UI)
- AIManager Overview
- Data Hub
- Agents tab (14 agent controls)

### ⚠️ Partial (UI exists, backend may be incomplete/mock)
- Decision Engine (duplicate with Settings)
- Orchestration
- Learning
- Monitoring (duplicate with Settings)
- Scenarios
- Backtesting
- System Logs
- Settings (investigate)
- Autopilot
- Training
- Analytics
- Config (duplicate with Settings)

### 🔴 Placeholders (UI stub, no real backend)
- None identified (all have at least partial implementation)

---

## Duplicate Detection Summary

### 🔴 Confirmed Duplicates (Settings vs AI Menu)

| Feature | Settings Path | AI Menu Path | Backend Source | Recommendation |
|---------|---------------|--------------|----------------|----------------|
| **Decision Engine** | Settings → Configuration → Decision Engine | AI Center → Manager → Decision Engine | `system_config.artemis.decision_engine` + `/api/config/artemis` | **LINK_TO_SETTINGS** (Settings is source of truth) |
| **Monitoring** | Settings → Configuration → Monitoring | AI Center → Manager → Monitoring | `request_logs`, `error_logs` + `/api/monitoring/*` | **LINK_TO_SETTINGS** (Settings is source of truth) |
| **Integrations** | Settings → Configuration → Integrations | AI Center → Config | `api_integrations` + `/api/config/integrations` | **LINK_TO_SETTINGS** (Settings is source of truth) |

### 🟡 Potential Duplicates (Investigate)

| Feature | Settings Path | AI Menu Path | Action |
|---------|---------------|--------------|--------|
| **AI Manager Settings** | Settings → (various) | AI Center → Manager → Settings | **INVESTIGATE** - Read SettingsTab.tsx to confirm overlap |

---

## Backend API Mapping

### AI-Related Endpoints

| Route File | Endpoints | Used In AI Menu |
|------------|-----------|-----------------|
| **ai-agents.js** | 9 endpoints | AIAgents, AIManager Overview |
| **artemis.js** | 13 endpoints | AIManager (Decision Engine, Orchestration, Learning, Scenarios, Logs) |
| **autopilot.js** | 8 endpoints | AIManager Autopilot tab |
| **backtest.js** | 5 endpoints | AIManager Backtesting tab |
| **training.js** | 2 endpoints | Training Center |
| **data-sources.js** | 6 endpoints | AIManager Data Hub |

**Total AI Endpoints**: 43 (some may overlap with Settings)

---

## Recommendations

### 1. Eliminate Duplicates (Priority: HIGH)

**Decision Engine Tab** (AI Manager):
- **Current**: Separate tab in AIManager
- **Action**: Replace with "Open in Settings" button
- **Code**: Add redirect to Settings → Configuration → Decision Engine
- **Reason**: Settings is the single source of truth (system_config)

**Monitoring Tab** (AI Manager):
- **Current**: Separate tab in AIManager
- **Action**: Replace with "Open in Settings" button
- **Code**: Add redirect to Settings → Configuration → Monitoring
- **Reason**: Settings has real logging middleware & DB tables

**Config Tab** (AI Center):
- **Current**: Separate tab in AI Center
- **Action**: Replace with "Open in Settings" button
- **Code**: Add redirect to Settings → Configuration → Integrations
- **Reason**: Settings has full CRUD for API integrations

### 2. Consolidate AI Menu (Priority: MEDIUM)

**Option A**: Keep AI Center as AI-specific features only
- Remove Decision Engine, Monitoring, Config tabs
- Keep: Agents, Training, Analytics, Data Hub, Scenarios, Backtesting, Logs
- Add "Configure AI" button → Settings/Configuration

**Option B**: Merge AI Manager into Settings
- Move AIManager tabs to Settings → Configuration → AI Management
- Keep AI Center for: Agents, Training, Analytics only
- Reduces navigation depth

**Recommended**: Option A (cleaner separation)

### 3. Document Anti-Duplication Rule

Add to project documentation:

```
RULE: No new configuration screens in AI Menu if already in Settings
- All system config → Settings → Configuration
- AI Menu → AI-specific features (agents, training, analytics)
- Duplicates → Link to Settings with "Configure in Settings" button
```

---

## File References

### Main Navigation
- `components/Dashboard.tsx` (lines 40-82)
- `components/AICenter.tsx` (lines 10-58)
- `components/ai/AIManager/index.tsx` (lines 19-103)

### AI Manager Tabs
- `components/ai/AIManager/tabs/OverviewTab.tsx`
- `components/ai/AIManager/tabs/DecisionEngineTab.tsx` ← **DUPLICATE**
- `components/ai/AIManager/tabs/MonitoringTab.tsx` ← **DUPLICATE**
- `components/ai/AIManager/tabs/SettingsTab.tsx` ← **INVESTIGATE**
- `components/ai/AIManager/tabs/OrchestrationTab.tsx`
- `components/ai/AIManager/tabs/LearningTab.tsx`
- `components/ai/AIManager/tabs/ScenariosTab.tsx`
- `components/ai/AIManager/tabs/DataHubTab.tsx`
- `components/ai/AIManager/tabs/BacktestingTab.tsx`
- `components/ai/AIManager/tabs/SystemLogsTab.tsx`
- `components/ai/AIManager/tabs/AutopilotTab.tsx`

### AI Center Tabs
- `components/ai/AIAgents.tsx` (14 agent controls)
- `components/ai/TrainingCenter.tsx`
- `components/ai/AnalyticsDashboard.tsx`
- `components/ai/APIConfig.tsx` ← **DUPLICATE**

---

## Summary

**Total AI Menu Items**: 17 (5 in AI Center + 11 in AIManager + 1 parent)  
**Confirmed Duplicates**: 3 (Decision Engine, Monitoring, Integrations)  
**Potential Duplicates**: 1 (AI Manager Settings - needs investigation)  
**Action Required**: Link duplicates to Settings, add anti-duplication rule

**Next**: Create AGENTS_REALITY_CHECK.md for 14 agent components
