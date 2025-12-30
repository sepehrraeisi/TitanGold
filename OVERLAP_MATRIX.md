# Configuration Overlap Matrix

**Date**: 2025-12-30  
**Purpose**: Identify duplicates between Settings, AI Menu, and Agents  
**Scope**: Configuration & system management features

---

## Matrix Overview

| Feature | Settings Location | AI Menu Location | Agents Panel | Backend Source | Truth Owner | Action | Priority | Notes |
|---------|-------------------|------------------|--------------|----------------|-------------|--------|----------|-------|
| **Decision Engine Config** | Settings → Configuration → Decision Engine | AI Center → Manager → Decision Engine | N/A | `system_config.artemis.decision_engine` + `/api/config/artemis` | **SETTINGS** | **LINK_TO_SETTINGS** | 🔴 HIGH | AI Manager tab should redirect to Settings |
| **System Monitoring** | Settings → Configuration → Monitoring | AI Center → Manager → Monitoring | N/A | `request_logs`, `error_logs` + `/api/monitoring/*` | **SETTINGS** | **LINK_TO_SETTINGS** | 🔴 HIGH | AI Manager tab should redirect to Settings |
| **API Integrations** | Settings → Configuration → Integrations | AI Center → Config | N/A | `api_integrations` + `/api/config/integrations` | **SETTINGS** | **LINK_TO_SETTINGS** | 🔴 HIGH | AI Center Config tab should redirect to Settings |
| **Security Settings** | Settings → Configuration → Security | N/A | N/A | `system_config.security.settings` + `/api/config/security` | **SETTINGS** | **KEEP** | ✅ DONE | No duplication found |
| **AI Manager Settings** | Settings → (various?) | AI Center → Manager → Settings | N/A | Unknown (investigate) | **TBD** | **INVESTIGATE** | 🟡 MEDIUM | Check SettingsTab.tsx content |
| **Agent Orchestration** | Settings → Configuration → Decision Engine (quorum, strategy) | AI Center → Manager → Orchestration | AIAgents (individual controls) | `system_config.artemis.decision_engine` | **SETTINGS** | **MERGE** | 🟡 MEDIUM | Link Orchestration tab to Settings config |
| **Learning System** | N/A | AI Center → Manager → Learning | N/A | `/api/artemis/learning` | **AI MENU** | **KEEP** | ✅ UNIQUE | AI-specific feature |
| **Trading Scenarios** | N/A | AI Center → Manager → Scenarios | N/A | `/api/artemis/scenarios` | **AI MENU** | **KEEP** | ✅ UNIQUE | AI-specific feature |
| **Data Hub** | N/A | AI Center → Manager → Data Hub | N/A | `/api/data-sources` | **AI MENU** | **KEEP** | ✅ UNIQUE | AI-specific feature |
| **Backtesting** | N/A | AI Center → Manager → Backtesting | N/A | `/api/backtest` | **AI MENU** | **KEEP** | ✅ UNIQUE | AI-specific feature |
| **System Logs** | Settings → Configuration → Monitoring (errors) | AI Center → Manager → Logs | N/A | `/api/artemis/logs` vs `/api/monitoring/errors` | **BOTH** | **CLARIFY** | 🟡 MEDIUM | Different log types? Or duplicate? |
| **Autopilot** | N/A | AI Center → Manager → Autopilot | N/A | `/api/autopilot` | **AI MENU** | **KEEP** | ✅ UNIQUE | AI-specific feature |
| **AI Training** | N/A | AI Center → Training | N/A | `/api/training` | **AI MENU** | **KEEP** | ✅ UNIQUE | AI-specific feature |
| **AI Analytics** | N/A | AI Center → Analytics | N/A | Analytics APIs | **AI MENU** | **KEEP** | ✅ UNIQUE | AI-specific feature |
| **Agent Registry** | N/A | AI Center → Agents | AIAgents (15 controls) | `/api/ai-agents` | **AI MENU** | **KEEP** | ✅ UNIQUE | AI-specific feature |

---

## Duplicate Details & Actions

### 🔴 HIGH PRIORITY: Eliminate Duplicates

#### 1. Decision Engine Configuration

**Duplicate Detected**: YES  
**Locations**:
- ✅ Settings → Configuration → Decision Engine (REAL, system_config)
- ⚠️ AI Center → Manager → Decision Engine (PARTIAL, unknown implementation)

**Backend Source**: 
- `system_config.artemis.decision_engine`
- `/api/config/artemis` (GET/PUT)

**Truth Owner**: **SETTINGS**

**Action**: **LINK_TO_SETTINGS**

**Implementation**:
```tsx
// In components/ai/AIManager/tabs/DecisionEngineTab.tsx
// Replace entire tab content with:
<div className="text-center p-12">
  <h3 className="text-xl font-bold mb-4">Decision Engine Configuration</h3>
  <p className="text-gray-400 mb-6">
    Configure Artemis decision engine in Settings
  </p>
  <button
    onClick={() => {
      // Navigate to Settings → Configuration → Decision Engine
      setActiveView('settings'); // Dashboard level
      // Then programmatically open Configuration tab + Decision Engine sub-tab
    }}
    className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg"
  >
    Open in Settings →
  </button>
</div>
```

---

#### 2. System Monitoring

**Duplicate Detected**: YES  
**Locations**:
- ✅ Settings → Configuration → Monitoring (REAL, DB logs + middleware)
- ⚠️ AI Center → Manager → Monitoring (PARTIAL, unknown implementation)

**Backend Source**:
- `request_logs` + `error_logs` tables
- `/api/monitoring/*` (health, summary, errors, requests)

**Truth Owner**: **SETTINGS**

**Action**: **LINK_TO_SETTINGS**

**Implementation**: Same pattern as Decision Engine

---

#### 3. API Integrations

**Duplicate Detected**: YES  
**Locations**:
- ✅ Settings → Configuration → Integrations (REAL, full CRUD)
- ⚠️ AI Center → Config (PARTIAL, unknown implementation)

**Backend Source**:
- `api_integrations` + `provider_runtime_state` tables
- `/api/config/integrations` (GET/POST/PATCH/DELETE/test/disable/reset)

**Truth Owner**: **SETTINGS**

**Action**: **LINK_TO_SETTINGS**

**Implementation**: Same pattern as Decision Engine

---

### 🟡 MEDIUM PRIORITY: Investigate & Clarify

#### 4. AI Manager Settings Tab

**Duplicate Detected**: MAYBE  
**Locations**:
- ✅ Settings → Configuration → (various)
- ⚠️ AI Center → Manager → Settings (UNKNOWN content)

**Action**: **INVESTIGATE**

**Steps**:
1. Read `components/ai/AIManager/tabs/SettingsTab.tsx`
2. Check what config it manages
3. Compare with Settings → Configuration
4. If duplicate → LINK_TO_SETTINGS
5. If unique → KEEP + document

---

#### 5. System Logs

**Duplicate Detected**: PARTIAL  
**Locations**:
- ✅ Settings → Configuration → Monitoring → Recent Errors
- ⚠️ AI Center → Manager → System Logs

**Backend Source**:
- Settings uses `/api/monitoring/errors` (from error_logs table)
- AI Manager uses `/api/artemis/logs` (unknown source)

**Action**: **CLARIFY**

**Questions**:
1. Are these different log types?
   - Artemis logs = AI decision logs
   - Monitoring logs = system errors
2. Or is it duplication?

**Recommendation**:
- If different types → KEEP both + clarify labels
- If same → LINK_TO_SETTINGS

---

#### 6. Agent Orchestration vs Decision Engine

**Overlap Detected**: YES (configuration overlap)  
**Locations**:
- Settings → Configuration → Decision Engine (strategy, quorum, providers)
- AI Center → Manager → Orchestration (agent coordination)
- AI Center → Agents (15 individual agent controls)

**Backend Source**:
- Decision Engine: `system_config.artemis.decision_engine`
- Orchestration: `/api/artemis/orchestration`
- Agents: `/api/ai-agents`

**Action**: **MERGE** (link orchestration config to Settings)

**Implementation**:
- Orchestration tab should READ config from Settings/Decision Engine
- Display agent coordination status (which agents active, quorum status)
- Link to Settings for config changes
- Keep orchestration UI for monitoring/status only

---

### ✅ NO DUPLICATION: Keep As-Is

The following features are unique to AI Menu and have no overlap with Settings:

| Feature | Location | Status | Notes |
|---------|----------|--------|-------|
| **Learning System** | AI Center → Manager → Learning | ✅ KEEP | AI-specific learning events & mistakes |
| **Trading Scenarios** | AI Center → Manager → Scenarios | ✅ KEEP | AI-specific scenario management |
| **Data Hub** | AI Center → Manager → Data Hub | ✅ KEEP | Data source management for AI |
| **Backtesting** | AI Center → Manager → Backtesting | ✅ KEEP | Strategy backtesting |
| **Autopilot** | AI Center → Manager → Autopilot | ✅ KEEP | Autonomous trading control |
| **AI Training** | AI Center → Training | ✅ KEEP | Model training sessions |
| **AI Analytics** | AI Center → Analytics | ✅ KEEP | AI performance analytics |
| **Agent Registry** | AI Center → Agents | ✅ KEEP | 15 agent control panels |

---

## Anti-Duplication Rule

Add to project documentation (`docs/ARCHITECTURE.md` or `README.md`):

```markdown
## Configuration Management Policy

### Rule: Single Source of Truth for System Config

All system-wide configuration MUST be managed in:
**Settings → Configuration**

This includes:
- API Integrations (providers, keys, health)
- Decision Engine (strategy, quorum, orchestration)
- Security (auth, sessions, access control)
- Monitoring (health, logs, metrics)

### AI Menu Scope

AI Menu should contain ONLY AI-specific features:
- Agent management & control
- AI training & learning
- Trading scenarios & backtesting
- Data hub & analytics
- Autopilot control

### Handling Duplicates

If a feature exists in both Settings and AI Menu:
1. **Settings is the source of truth** for configuration
2. AI Menu tab should redirect to Settings with a "Configure in Settings" button
3. Never create parallel configuration UIs

### Example: Decision Engine

- ✅ Configure in: Settings → Configuration → Decision Engine
- ❌ Do NOT create: AI Center → Manager → Decision Engine config UI
- ✅ AI Center CAN: Display decision engine status (read-only) + link to Settings
```

---

## Implementation Roadmap

### Phase 1: Quick Fixes (1-2 days)
1. Replace AI Manager → Decision Engine with redirect
2. Replace AI Manager → Monitoring with redirect
3. Replace AI Center → Config with redirect
4. Add "Configure in Settings" buttons

### Phase 2: Investigation (2-3 days)
1. Audit SettingsTab.tsx content
2. Clarify System Logs vs Artemis Logs
3. Document agent orchestration architecture
4. Test all redirects

### Phase 3: Documentation (1 day)
1. Add anti-duplication rule to docs
2. Update architecture diagrams
3. Create developer guide for adding new features
4. Document Settings as config source of truth

### Phase 4: Cleanup (optional)
1. Remove dead code from duplicate tabs
2. Consolidate navigation depth (reduce 3-level nesting)
3. Add breadcrumbs for better UX
4. Implement deep linking for Settings tabs

---

## Testing Checklist

After implementing redirects, verify:

- [ ] Decision Engine redirect works from AI Manager
- [ ] Monitoring redirect works from AI Manager
- [ ] Integrations redirect works from AI Center
- [ ] Settings tabs open correctly after redirect
- [ ] Navigation state is preserved
- [ ] Back button works as expected
- [ ] Deep links work (e.g., direct URL to Settings/Configuration/Decision Engine)
- [ ] Mobile navigation handles redirects gracefully

---

## Summary Statistics

**Total Features Audited**: 15  
**Confirmed Duplicates**: 3 (Decision Engine, Monitoring, Integrations)  
**Potential Duplicates**: 2 (AI Manager Settings, System Logs)  
**Unique Features**: 10 (no overlap with Settings)  

**Actions Required**:
- 🔴 HIGH (3): LINK_TO_SETTINGS for confirmed duplicates
- 🟡 MEDIUM (2): INVESTIGATE potential duplicates
- 🟢 LOW (1): CLARIFY log types
- ✅ DONE (10): KEEP unique AI features

**Estimated Effort**:
- Quick fixes: 4-6 hours
- Investigation: 8-12 hours
- Documentation: 4 hours
- Testing: 4 hours
**Total**: 2-3 days

---

## References

- `AUDIT_SETTINGS.md` - Settings Configuration audit
- `AUDIT_AI_MENU.md` - AI Menu structure audit
- `AGENTS_REALITY_CHECK.md` - Agent components inventory
- `components/Settings.tsx` - Settings main component
- `components/AICenter.tsx` - AI Center main component
- `components/ai/AIManager/index.tsx` - AI Manager tabs
