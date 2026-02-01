# TitanGold AI Module - Complete API Calls Inventory

**Generated**: 2025-12-27  
**Source**: All 10 AI Manager Tabs

---

## 📋 API Calls by Tab

### 1. OverviewTab
```typescript
✅ api.fetchArtemisLogs({ limit: 5 })          // GET /api/artemis/logs (MISSING!)
✅ api.fetchTradingScenarios()                 // GET /api/artemis/scenarios
```

### 2. DataHubTab
```typescript
⚠️ api.getTelegramCollectorBaseUrl()           // Utility function
✅ api.fetchDataHubState()                     // GET /api/data-hub/state (CHECK!)
✅ api.fetchAIAgents()                         // GET /api/ai-agents
✅ api.checkDataHubHealth()                    // GET /api/data-hub/health (CHECK!)
```

### 3. DecisionEngineTab
```typescript
✅ api.makeArtemisDecision([])                 // POST /api/artemis/decision
✅ api.updateArtemisConfig({ ... })            // PUT /api/artemis/config (CHECK!)
```

### 4. MonitoringTab
```typescript
✅ api.checkSystemHealth()                     // GET /api/health or /api/system/health (CHECK!)
✅ api.fetchArtemisState()                     // GET /api/artemis/state
✅ api.updateArtemisConfig(updated)            // PUT /api/artemis/config (CHECK!)
```

### 5. ScenariosTab
```typescript
✅ api.fetchTradingScenarios()                 // GET /api/artemis/scenarios
⚠️ api.generateAITradingScenario()             // POST /api/scenarios/generate (CHECK!)
⚠️ api.createTradingScenario(scenario)         // POST /api/scenarios (CHECK!)
⚠️ api.runScenarioBacktest?.(scenarioId)       // POST /api/scenarios/:id/backtest (CHECK!)
```

### 6. LearningTab
```typescript
// No API calls found - UI only with filters
```

### 7. SettingsTab
```typescript
✅ api.updateArtemisConfig({ config })         // PUT /api/artemis/config (CHECK!)
```

### 8. BacktestingTab
```typescript
⚠️ api.fetchBacktestResults()                  // GET /api/backtest/results (CHECK!)
✅ api.fetchTradingScenarios()                 // GET /api/artemis/scenarios
⚠️ api.runBacktest({ ... })                    // POST /api/backtest/run (CHECK!)
```

### 9. OrchestrationTab
```typescript
// No API calls found - UI only with filters
```

### 10. SystemLogsTab
```typescript
✅ api.fetchArtemisLogs(filter)                // GET /api/artemis/logs (MISSING!)
⚠️ api.clearArtemisLogs()                      // DELETE /api/artemis/logs (CHECK!)
```

---

## 📊 Summary by Status

### ✅ Confirmed Working (existing routes)
1. `GET  /api/ai-agents` (ai-agents.js)
2. `GET  /api/artemis/state` (artemis.js)
3. `GET  /api/artemis/scenarios` (artemis.js)
4. `POST /api/artemis/decision` (artemis.js)

### ⚠️ Need Verification (may exist in other files)
1. `GET  /api/data-hub/state`
2. `GET  /api/data-hub/health`
3. `PUT  /api/artemis/config`
4. `GET  /api/health` or `/api/system/health`
5. `POST /api/scenarios/generate`
6. `POST /api/scenarios`
7. `POST /api/scenarios/:id/backtest`
8. `GET  /api/backtest/results`
9. `POST /api/backtest/run`

### ❌ Confirmed Missing
1. `GET    /api/artemis/logs`
2. `DELETE /api/artemis/logs`

---

## 🔍 Endpoint Verification Needed

### High Priority
- [ ] `/api/artemis/logs` - Critical (used by 2 tabs)
- [ ] `/api/artemis/config` - PUT method
- [ ] `/api/data-hub/*` - All endpoints

### Medium Priority
- [ ] `/api/scenarios/*` - Generate, create, run
- [ ] `/api/backtest/*` - Results, run

### Low Priority
- [ ] `/api/system/health` - May use existing `/api/health`

---

## 📝 Action Items

1. **Verify existing endpoints** in backend routes
2. **Create missing endpoints** with proper validation
3. **Test all API calls** from UI
4. **Add error handling** for failed requests
5. **Document all endpoints** in OpenAPI/Swagger

---

**Next Step**: Check backend routes to verify ⚠️ endpoints
