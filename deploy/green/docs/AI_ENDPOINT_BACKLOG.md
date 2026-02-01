# AI Endpoint Backlog - Remaining Work

**Status**: 23/55 Complete (32 Remaining)  
**Date**: 2025-12-27

---

## Completed (23) ✅

### Health (3/3)
- ✅ GET /api/health → routes/health.js → - → Working
- ✅ GET /api/ready → routes/health.js → - → Working
- ✅ GET /api/health/status → routes/health.js → users, exchange_connections → Working

### Artemis (6/6)
- ✅ GET /api/artemis/state → routes/artemis.js → artemis_state, ai_agents, ai_decisions → Working
- ✅ GET /api/artemis/logs → routes/artemis.js → system_logs → Working
- ✅ DELETE /api/artemis/logs → routes/artemis.js → system_logs → Working
- ✅ GET /api/artemis/scenarios → routes/artemis.js → trading_scenarios → Working
- ✅ POST /api/artemis/decision → routes/artemis.js → artemis_state, ai_decisions → Working
- ✅ PUT /api/artemis/config → routes/artemis.js → artemis_state → Working

### Data Sources (5/5)
- ✅ GET /api/data-sources → routes/data-sources.js → data_sources → Working
- ✅ POST /api/data-sources → routes/data-sources.js → data_sources → Working
- ✅ GET /api/data-sources/health → routes/data-sources.js → data_hub_logs → Working
- ✅ GET /api/data-sources/state → routes/data-sources.js → data_sources → Working
- ✅ GET /api/data-sources/stats → routes/data-sources.js → data_hub_logs → Working

### Scenarios (7/7)
- ✅ POST /api/scenarios/generate → routes/scenarios.js → trading_scenarios, ai_jobs → Working
- ✅ POST /api/scenarios → routes/scenarios.js → trading_scenarios → Working
- ✅ GET /api/scenarios → routes/scenarios.js → trading_scenarios → Working
- ✅ GET /api/scenarios/:id → routes/scenarios.js → trading_scenarios → Working
- ✅ PATCH /api/scenarios/:id → routes/scenarios.js → trading_scenarios → Working
- ✅ DELETE /api/scenarios/:id → routes/scenarios.js → trading_scenarios → Working
- ✅ POST /api/scenarios/:id/backtest → routes/scenarios.js → scenario_runs, backtest_results → Working

### Backtest (5/5)
- ✅ GET /api/backtest/results → routes/backtest.js → backtest_results → Working
- ✅ GET /api/backtest/results/:id → routes/backtest.js → backtest_results → Working
- ✅ POST /api/backtest/run → routes/backtest.js → backtest_results, scenario_runs → Working
- ✅ DELETE /api/backtest/results/:id → routes/backtest.js → backtest_results → Working
- ✅ GET /api/backtest/stats → routes/backtest.js → backtest_results → Working

---

## Remaining (32) ⏳

### AI Agents (4/6)
- ✅ GET /api/ai-agents → routes/ai-agents.js → ai_agents → Working
- ✅ GET /api/ai-agents/:id → routes/ai-agents.js → ai_agents → Working
- ✅ PATCH /api/ai-agents/:id → routes/ai-agents.js → ai_agents → Working
- ⏳ POST /api/ai-agents/chat → routes/ai-agents.js → ai_jobs, ai_providers → Add AI provider integration
- ⏳ POST /api/ai-agents/:id/run → routes/ai-agents.js → ai_jobs → Add execution logic
- ⏳ GET /api/ai-agents/manager-overview → routes/ai-agents.js → ai_agents, ai_jobs → Add aggregation query

### Training (0/2)
- ⏳ GET /api/training/sessions → routes/training.js → ai_training_sessions → Add pagination & filters
- ⏳ POST /api/training/sessions → routes/training.js → ai_training_sessions, ai_jobs → Add training logic

### Scheduler (0/5)
- ⏳ GET /api/scheduler/status → routes/scheduler.js → scheduler_config → Add real status check
- ⏳ POST /api/scheduler/start → routes/scheduler.js → scheduler_config → Add start logic
- ⏳ POST /api/scheduler/stop → routes/scheduler.js → scheduler_config → Add stop logic
- ⏳ GET /api/scheduler/config → routes/scheduler.js → scheduler_config → Add config reader
- ⏳ PUT /api/scheduler/config/:section → routes/scheduler.js → scheduler_config → Add config updater

### Trading Engine (0/8)
- ⏳ GET /api/trading-engine/status → routes/trading-engine.js → trading_engine_config, engine_runs → Add status endpoint
- ⏳ POST /api/trading-engine/start → routes/trading-engine.js → engine_runs → Add start logic
- ⏳ POST /api/trading-engine/stop → routes/trading-engine.js → engine_runs → Add stop logic
- ⏳ GET /api/trading-engine/config → routes/trading-engine.js → trading_engine_config → Add config reader
- ⏳ PUT /api/trading-engine/config → routes/trading-engine.js → trading_engine_config → Add config updater
- ⏳ GET /api/trading-engine/runs → routes/trading-engine.js → engine_runs → Add pagination
- ⏳ GET /api/trading-engine/runs/:id → routes/trading-engine.js → engine_runs → Add detail view
- ⏳ GET /api/trading-engine/stats → routes/trading-engine.js → engine_runs, trades → Add aggregation

### Signals (0/6)
- ⏳ GET /api/signals → NEW FILE → signals → Create routes/signals.js
- ⏳ POST /api/signals → NEW FILE → signals → Create signal ingestion
- ⏳ GET /api/signals/:id → NEW FILE → signals → Create detail view
- ⏳ PATCH /api/signals/:id → NEW FILE → signals → Create update endpoint
- ⏳ POST /api/signals/:id/process → NEW FILE → signals, ai_jobs → Create processing logic
- ⏳ GET /api/signals/stats → NEW FILE → signals → Create aggregation

### Telegram (0/7)
- ⏳ GET /api/telegram/channels → NEW FILE → telegram_channels → Create routes/telegram.js
- ⏳ POST /api/telegram/channels → NEW FILE → telegram_channels → Create channel add
- ⏳ GET /api/telegram/channels/:id → NEW FILE → telegram_channels → Create detail view
- ⏳ PATCH /api/telegram/channels/:id → NEW FILE → telegram_channels → Create update
- ⏳ GET /api/telegram/messages → NEW FILE → telegram_messages → Create list endpoint
- ⏳ GET /api/telegram/messages/:id → NEW FILE → telegram_messages → Create detail view
- ⏳ POST /api/telegram/messages/analyze → NEW FILE → telegram_messages, signals → Create analysis

---

## Priority Ranking

### P0 - Critical (Next Sprint)
1. POST /api/ai-agents/chat - UI needs this
2. GET /api/trading-engine/status - Dashboard displays this
3. GET /api/signals - SignalsTab empty without this
4. GET /api/telegram/channels - TelegramTab needs this
5. POST /api/training/sessions - LearningTab needs this

### P1 - High (Week 2)
6. POST /api/trading-engine/start
7. GET /api/scheduler/status
8. GET /api/signals/stats
9. GET /api/telegram/messages
10. GET /api/ai-agents/manager-overview

### P2 - Medium (Week 3+)
- All remaining CRUD operations
- Stats/aggregation endpoints
- Advanced filtering

---

## Implementation Notes

### New Files Needed
- `backend/routes/signals.js` (6 endpoints)
- `backend/routes/telegram.js` (7 endpoints)

### Files to Enhance
- `backend/routes/ai-agents.js` (3 endpoints)
- `backend/routes/training.js` (2 endpoints)
- `backend/routes/scheduler.js` (5 endpoints)
- `backend/routes/trading-engine.js` (8 endpoints)

### DB Tables Confirmed Ready
- ✅ signals (created)
- ✅ telegram_channels (created)
- ✅ telegram_messages (created)
- ✅ ai_jobs (created)
- ✅ ai_providers (created)
- ✅ engine_runs (created)
- ⏳ backtest_results (needs creation)

---

**Next Action**: Create routes/signals.js and routes/telegram.js (13 endpoints total)
