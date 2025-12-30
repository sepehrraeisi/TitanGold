# Agents Reality Check

**Date**: 2025-12-30  
**Source**: components/ai/ directory scan  
**Total Agents**: 15 control components found

---

## Agent Control Components Inventory

All agent control components are located in `components/ai/` and rendered via `AIAgents.tsx`.

| # | Agent Name | File Path | Rendered In | APIs Used | Status | Notes |
|---|------------|-----------|-------------|-----------|--------|-------|
| 1 | Arbitrage Agent | `components/ai/ArbitrageAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 2 | Fundamental Agent | `components/ai/FundamentalAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 3 | Liquidity Agent | `components/ai/LiquidityAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 4 | Market Intelligence Agent | `components/ai/MarketIntelligenceAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 5 | Optimization Agent | `components/ai/OptimizationAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 6 | Order Management Agent | `components/ai/OrderManagementAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 7 | Pattern Agent | `components/ai/PatternAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 8 | Portfolio Allocation Agent | `components/ai/PortfolioAllocationAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 9 | Price Prediction Agent | `components/ai/PricePredictionAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 10 | Risk Management Agent | `components/ai/RiskManagementAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 11 | Sentiment Agent | `components/ai/SentimentAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 12 | Technical Analysis Agent | `components/ai/TechnicalAnalysisAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 13 | Timing Agent | `components/ai/TimingAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 14 | Trend Agent | `components/ai/TrendAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |
| 15 | Volume Agent | `components/ai/VolumeAgentControl.tsx` | AIAgents | /api/ai-agents/:id/* | ⚠️ Partial | Control panel exists, backend status unknown |

**Note**: Original spec mentioned 14 agents, but 15 control components were found.

---

## AIAgents Component (Parent)

**File**: `components/ai/AIAgents.tsx`  
**Purpose**: Container that renders all 15 agent control panels  
**Navigation**: Dashboard → AI Center → Agents tab

**Key Features**:
- Grid layout for agent cards
- Individual enable/disable toggles
- Status indicators per agent
- Run/command buttons
- Real-time updates (via state)

**Backend Integration**:
- GET `/api/ai-agents/` - List all agents
- GET `/api/ai-agents/:id` - Get agent details
- PATCH `/api/ai-agents/:id` - Update agent config
- POST `/api/ai-agents/:id/run` - Execute agent
- POST `/api/ai-agents/:id/command` - Send command
- PATCH `/api/ai-agents/:id/config` - Update config
- GET `/api/ai-agents/:id/details` - Get detailed state

---

## Backend API (ai-agents.js)

**File**: `backend/routes/ai-agents.js`  
**Endpoints**: 9 total

| Method | Path | Purpose | Auth | Status |
|--------|------|---------|------|--------|
| POST | /chat | AI chat interface | Required | ✅ Exists |
| POST | /:id/run | Run specific agent | Required | ✅ Exists |
| POST | /:id/command | Send command to agent | Required | ✅ Exists |
| PATCH | /:id/config | Update agent config | Required | ✅ Exists |
| GET | /:id/details | Get agent details | Required | ✅ Exists |
| GET | /manager-overview | AIManager overview data | Required | ✅ Exists |
| GET | / | List all agents | Required | ✅ Exists |
| GET | /:id | Get single agent | Required | ✅ Exists |
| PATCH | /:id | Update agent | Required | ✅ Exists |

**Backend Status**: ✅ Routes exist (implementation details unknown without DB schema inspection)

---

## Database Schema (Expected)

**Note**: Actual schema not audited; inferring from API patterns.

### Expected Tables

#### agents (or ai_agents)
```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL, -- arbitrage, fundamental, etc
  enabled BOOLEAN DEFAULT false,
  config JSONB,
  status VARCHAR(50), -- idle, running, error
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### agent_runs (execution history)
```sql
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(50),
  result JSONB,
  error TEXT
);
```

**Verification Required**: Run DB schema query to confirm

---

## Agent Configuration Dependencies

### system_config (if used)
- Key: `agents.registry` (seeded in setup script)
- Contains: enabled status, default weight, timeout, orchestration mode

### Per-Agent Config (expected)
Each agent likely has:
- **Weight**: Priority in decision-making
- **Enabled**: Active/inactive status
- **Timeout**: Max execution time
- **Model/Provider**: LLM config (if agent uses AI)
- **Parameters**: Agent-specific settings

**Example** (Risk Management Agent):
```json
{
  "maxDrawdown": 0.15,
  "stopLossPercent": 0.05,
  "positionSizeLimit": 0.1,
  "enabled": true,
  "weight": 1.5
}
```

---

## Reality Check Results

### ✅ What Exists (Confirmed)
1. **15 Agent Control Components** - All UI files exist
2. **AIAgents Container** - Parent component renders all agents
3. **Backend Routes** - 9 endpoints in ai-agents.js
4. **Navigation Path** - Dashboard → AI Center → Agents tab works

### ⚠️ What's Uncertain (Needs Verification)
1. **Backend Implementation** - Routes exist, but do they work?
2. **Database Schema** - No agents table confirmed in DB audit
3. **Agent Logic** - Do agents have real trading/analysis logic?
4. **Integration with Artemis** - How do agents connect to decision engine?
5. **Provider Usage** - Do agents use API integrations from Settings?

### 🔴 What's Missing (Gaps Identified)
1. **DB Schema Documentation** - No schema for agents table
2. **Agent Registry** - No clear registry of agent IDs/types
3. **Execution Logs** - No agent_runs table confirmed
4. **Performance Metrics** - No metrics storage for agent performance
5. **Inter-Agent Communication** - No orchestration implementation visible

---

## Recommended Actions

### 1. Verify Backend Implementation (Priority: HIGH)
```bash
# Check if agents table exists
psql $DATABASE_URL -c "\d agents"

# Check agent routes work
curl -H "Authorization: Bearer $TOKEN" https://titan.zala.ir/api/ai-agents/
```

### 2. Document Agent Registry (Priority: HIGH)
- Create seed script to populate 15 agents
- Define agent IDs (UUIDs) and types
- Map control components to agent IDs

### 3. Connect Agents to Artemis (Priority: MEDIUM)
- Ensure agents use `/api/config/artemis` settings
- Integrate with provider pool (from Integrations)
- Add agent orchestration logic

### 4. Add Agent Metrics (Priority: MEDIUM)
- Create agent_metrics table
- Track: runs, success rate, execution time, profit/loss
- Display in AIManager → Monitoring (or link to Settings/Monitoring)

### 5. Create Agent Documentation (Priority: LOW)
- Per-agent README explaining:
  - Purpose & strategy
  - Configuration options
  - Expected inputs/outputs
  - Performance benchmarks

---

## Settings Integration

### Current Integration Points
- **Providers**: Agents should use API integrations from Settings/Integrations
- **Decision Engine**: Agents orchestrated via Settings/Decision Engine config
- **Monitoring**: Agent logs should appear in Settings/Monitoring

### Gaps
- No explicit linkage between agent config and Settings
- Agent enable/disable not synchronized with Artemis state
- No unified config storage (agents vs system_config)

### Recommendation
- Store agent config in `system_config.agents.{agent_type}`
- Link agent execution to Artemis orchestration
- Surface agent metrics in Settings/Monitoring

---

## File Paths Reference

### Agent Control Components
```
components/ai/ArbitrageAgentControl.tsx
components/ai/FundamentalAgentControl.tsx
components/ai/LiquidityAgentControl.tsx
components/ai/MarketIntelligenceAgentControl.tsx
components/ai/OptimizationAgentControl.tsx
components/ai/OrderManagementAgentControl.tsx
components/ai/PatternAgentControl.tsx
components/ai/PortfolioAllocationAgentControl.tsx
components/ai/PricePredictionAgentControl.tsx
components/ai/RiskManagementAgentControl.tsx
components/ai/SentimentAgentControl.tsx
components/ai/TechnicalAnalysisAgentControl.tsx
components/ai/TimingAgentControl.tsx
components/ai/TrendAgentControl.tsx
components/ai/VolumeAgentControl.tsx
```

### Parent Container
```
components/ai/AIAgents.tsx
```

### Backend Routes
```
backend/routes/ai-agents.js
```

---

## Summary

**Agents UI**: ✅ 15 control components exist  
**Backend API**: ✅ 9 endpoints exist  
**DB Schema**: ⚠️ Not confirmed  
**Business Logic**: ⚠️ Unknown (needs code review)  
**Integration**: 🔴 Gaps with Settings & Artemis

**Next Step**: Database schema verification + backend implementation audit

**Conclusion**: Agent UI infrastructure exists, but backend reality and Settings integration need verification.
