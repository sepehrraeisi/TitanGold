# Liquidity Agent - Implementation Guide for Genspark

## 🎯 Purpose

This document provides **exact, unambiguous instructions** for implementing the Liquidity Agent. 

**CRITICAL**: This is a **read-only specification**. Do NOT modify formulas, weights, or architecture decisions.

---

## 🔒 Immutable Rules

### What Genspark CANNOT Do:
- ❌ Change formula weights or thresholds
- ❌ Add new metrics
- ❌ Show accuracy or ML-specific metrics
- ❌ Modify database schema
- ❌ Overwrite JSONB fields (always merge)
- ❌ Make architecture decisions

### What Genspark MUST Do:
- ✅ Fill TODOs exactly as specified
- ✅ Follow Phase 2A formulas exactly
- ✅ Write comprehensive tests
- ✅ Ensure all endpoints work
- ✅ Keep liquidity agent as rule-based (no ML)

---

## 🧠 Agent Type Classification

```
Agent Type: RULE-BASED (Market Microstructure Analyzer)
Learning: ❌ NO
ML Accuracy: ❌ NO
Training Progress: ❌ NO
Prediction: ❌ NO
```

**Liquidity Agent analyzes market structure, NOT price prediction.**

---

## 📐 Architecture Overview

```
┌─────────────────┐
│   MEXC API      │
│  ├─ Order Book  │
│  ├─ Trades      │
│  └─ 24h Volume  │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│ LiquidityAnalyzerService     │
│ (Fill TODOs in Phase 2B)     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ agent_runs_liquidity         │
│ (Store each analysis)        │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ agent_metrics_liquidity      │
│ (Aggregated stats)           │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ AI Center / Frontend         │
│ (Display liquidity metrics)  │
└──────────────────────────────┘
```

---

## 🗄️ Database Contract (LOCKED)

### Tables (Already Created)

#### 1. `agent_settings_liquidity`
**Purpose:** User configuration per symbol

| Column | Type | Description | Update Rule |
|--------|------|-------------|-------------|
| `user_id` | UUID | Primary key | - |
| `enabled` | BOOLEAN | Agent on/off | Direct |
| `mode` | TEXT | demo or live | Direct |
| `symbols` | TEXT[] | Trading pairs | Direct |
| `depth_levels` | DECIMAL[] | [0.1, 0.5, 1, 2] | Direct |
| `slippage_thresholds` | JSONB | Thresholds | **MERGE** |
| `alert_rules` | JSONB | Alert config | **MERGE** |
| `integrations` | JSONB | Dashboard, Telegram | **MERGE** |

**⚠️ CRITICAL: JSONB Update Rule**
```sql
-- ❌ WRONG
UPDATE agent_settings_liquidity SET alert_rules = $1 WHERE user_id = $2

-- ✅ RIGHT
UPDATE agent_settings_liquidity 
SET alert_rules = COALESCE(alert_rules, '{}'::jsonb) || $1::jsonb 
WHERE user_id = $2
```

#### 2. `agent_runs_liquidity`
**Purpose:** Store each analysis result

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key |
| `symbol` | TEXT | e.g., BTCUSDT |
| `liquidity_score` | DECIMAL | 0-100 |
| `risk_level` | TEXT | low/medium/high |
| `orderbook_snapshot` | JSONB | Full order book |
| `liquidity_metrics` | JSONB | Depth, spread, etc. |
| `slippage_metrics` | JSONB | Slippage tests |
| `capital_flow` | JSONB | Flow analysis |
| `alerts_triggered` | JSONB | Array of alerts |
| `started_at` | TIMESTAMP | Run start |
| `finished_at` | TIMESTAMP | Run end |
| `status` | TEXT | success/error |

#### 3. `agent_metrics_liquidity`
**Purpose:** Aggregated metrics per user

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | Primary key |
| `total_scans` | INTEGER | Total analyses |
| `avg_liquidity_score` | DECIMAL | Average score |
| `avg_spread` | DECIMAL | Average spread |
| `avg_depth_100k` | DECIMAL | Avg depth at 100k |
| `avg_slippage_50k` | DECIMAL | Avg slippage 50k |
| `total_alerts` | INTEGER | Alert count |
| `last_scan_at` | TIMESTAMP | Last run time |

---

## 🔧 Service Layer Implementation

### Location
```
backend/services/liquidity/
├── LiquidityAnalyzerService.ts  ← FILL TODOs HERE
├── liquidity.types.ts           ← COMPLETE (no changes)
├── liquidity.config.ts          ← COMPLETE (no changes)
└── IMPLEMENTATION_GUIDE.md      ← REFERENCE
```

### TODOs to Implement

| # | Method | Phase 2A Reference | Status |
|---|--------|-------------------|--------|
| 1 | `calculateSpread` | Section 1.3.A | ⏳ TODO |
| 2 | `calculateDepth` | Section 1.3.B | ⏳ TODO |
| 3 | `calculateImbalance` | Section 1.3.C | ⏳ TODO |
| 4 | `calculateVolumeScore` | Section 1.3.D | ⏳ TODO |
| 5 | `runSlippageTests` | Section 2 | ⏳ TODO |
| 6 | `analyzeCapitalFlow` | Section 3 | ⏳ TODO |
| 7 | `calculateRiskLevel` | Section 5 | ⏳ TODO |
| 8 | `checkAlerts` | Section 4 | ⏳ TODO |

**Implementation Guide:** See `backend/services/liquidity/IMPLEMENTATION_GUIDE.md` for exact code examples.

### MEXC API Client

**Required Methods:**
```typescript
class MEXCClient {
  async getOrderBook(symbol: string, limit: number = 100): Promise<OrderBook>
  async getRecentTrades(symbol: string, limit: number = 100): Promise<Trade[]>
  async get24hVolume(symbol: string): Promise<number>
}
```

**API Endpoints:**
```
GET https://api.mexc.com/api/v3/depth?symbol={symbol}&limit=100
GET https://api.mexc.com/api/v3/trades?symbol={symbol}&limit=100
GET https://api.mexc.com/api/v3/ticker/24hr?symbol={symbol}
```

**Documentation:** https://mexcdevelop.github.io/apidocs/spot_v3_en/

---

## 🌐 API Contract (Already Implemented)

### Endpoints

#### 1. GET `/api/agents/liquidity/status`
**Response:**
```json
{
  "status": "active",
  "mode": "demo",
  "symbols": ["BTCUSDT"],
  "enabled": true,
  "lastRunAt": "2026-01-04T12:00:00Z",
  "isRunning": false
}
```

#### 2. POST `/api/agents/liquidity/run`
**Request:**
```json
{
  "symbol": "BTCUSDT"
}
```

**Response:** Full `LiquidityAnalysisResult` (see Phase 2A Section 6)

**Flow:**
1. Load user settings
2. Fetch MEXC data (order book, trades, volume)
3. Call `LiquidityAnalyzerService.analyze()`
4. Save result to `agent_runs_liquidity`
5. Update `agent_metrics_liquidity`
6. Return result

#### 3. GET `/api/agents/liquidity/runs/latest`
**Response:**
```json
{
  "result": {
    "id": "uuid",
    "symbol": "BTCUSDT",
    "timestamp": "2026-01-04T12:00:00Z",
    "liquidityScore": 75.5,
    "riskLevel": "low",
    "orderBook": {...},
    "liquidityMetrics": {...},
    "slippageMetrics": {...},
    "capitalFlow": {...},
    "alerts": [...]
  }
}
```

#### 4. GET `/api/agents/liquidity/runs?limit=50`
**Response:**
```json
{
  "runs": [
    {
      "id": "uuid",
      "symbol": "BTCUSDT",
      "timestamp": "2026-01-04T12:00:00Z",
      "liquidityScore": 75.5,
      "riskLevel": "low",
      "alertsCount": 2
    }
  ]
}
```

#### 5. GET `/api/agents/liquidity/metrics`
**Response:**
```json
{
  "metrics": {
    "totalScans": 150,
    "activeHours": 24.5,
    "avgLiquidityScore": 72.3,
    "avgSpread": 0.15,
    "avgDepth": 125000,
    "lastScanAt": "2026-01-04T12:00:00Z"
  }
}
```

#### 6. GET `/api/agents/liquidity/settings`
**Response:**
```json
{
  "settings": {
    "enabled": true,
    "mode": "demo",
    "symbols": ["BTCUSDT"],
    "depthLevels": [0.1, 0.5, 1, 2],
    "slippageThresholds": {...},
    "alertRules": {...},
    "integrations": {...}
  }
}
```

#### 7. POST `/api/agents/liquidity/settings`
**Request:**
```json
{
  "enabled": true,
  "symbols": ["BTCUSDT", "ETHUSDT"],
  "alertRules": {
    "liquidityDrop": {
      "enabled": true,
      "threshold": 40
    }
  }
}
```

**Response:**
```json
{
  "success": true
}
```

---

## 📊 Metrics Mapping (AI Center)

### Location
```
backend/routes/ai-agents.js
Line ~1494
```

### Rule-Based Agent Pattern (LOCKED)

```typescript
if (agent.agent_key === 'liquidity') {
  return {
    ...baseMetrics,
    
    // ❌ Hide ML metrics
    accuracy: null,
    trainingProgress: null,
    learningTime: null,
    knowledgeSize: null,
    
    // ✅ Show liquidity-specific metrics
    totalScans: parseInt(decisionStats.total, 10),
    activeHours: parseFloat(learningHours.toFixed(1)),
    avgLiquidityScore: metadata?.avg_liquidity_score || 0,
    avgSpread: metadata?.avg_spread || 0,
    avgSlippage50k: metadata?.avg_slippage_50k || 0,
    riskLevel: metadata?.current_risk_level || 'low',
    alertsTriggered: metadata?.alerts_count || 0
  }
}
```

**⚠️ CRITICAL: ML Metrics Must Be NULL**

- `accuracy` → `null` (not 0, not undefined)
- `trainingProgress` → `null`
- `learningTime` → `null`
- `knowledgeSize` → `null`

**Why?** Frontend will hide these fields when `null`. If `0`, they will show "0.0%" which is misleading.

---

## 🎨 Frontend Expectations

### What UI MUST Show

| Metric | Source | Display |
|--------|--------|---------|
| Liquidity Score | `avgLiquidityScore` | 0-100 gauge |
| Risk Level | `riskLevel` | Badge (low/medium/high) |
| Avg Spread | `avgSpread` | 0.15% |
| Slippage Risk | `avgSlippage50k` | 0.25% |
| Total Scans | `totalScans` | 150 |
| Active Hours | `activeHours` | 24.5h |
| Alerts Triggered | `alertsTriggered` | 3 |

### What UI MUST NOT Show

| Metric | Reason |
|--------|--------|
| Accuracy % | Rule-based agent, no predictions |
| Training Progress | No training/learning |
| Learning Time | Not applicable |
| Knowledge Size | Not a learning model |

### UI Components (Recommended)

```
┌─────────────────────────────────────┐
│  Liquidity Agent                    │
│  ┌─────────┐  ┌─────────┐          │
│  │ Score   │  │  Risk   │          │
│  │  75.5   │  │  LOW    │          │
│  └─────────┘  └─────────┘          │
│                                      │
│  Avg Spread: 0.15%                  │
│  Slippage (50k): 0.25%              │
│  Total Scans: 150                   │
│  Active Hours: 24.5h                │
│  Alerts: 3                          │
│                                      │
│  [Recent Runs Table]                │
└─────────────────────────────────────┘
```

---

## ✅ Testing Checklist

### 1. Service Tests

```bash
cd backend/services/liquidity/__tests__
npm test liquidity.mock.test.ts
```

**Required Tests:**
- [ ] Spread calculation returns correct values
- [ ] Depth normalized by symbol config
- [ ] Imbalance score between 0-1
- [ ] Volume score capped at 1.0
- [ ] Slippage increases with order size
- [ ] Risk level maps correctly (7+ → high, 4-6 → medium, <4 → low)
- [ ] Alerts fire when thresholds exceeded
- [ ] Capital flow sentiment correct

### 2. API Integration Tests

```bash
cd backend
node test_liquidity_routes.js
```

**Expected Results:**
- [ ] All endpoints return 200
- [ ] Settings persist after save
- [ ] Runs saved to database
- [ ] Metrics updated after run
- [ ] Refresh preserves data (no overwrite)

### 3. Metrics Mapping Tests

```bash
curl http://localhost:5002/api/ai-agents -H "Authorization: Bearer $TOKEN"
```

**Verify Liquidity Agent:**
```json
{
  "agent_key": "liquidity",
  "accuracy": null,          // ✅ Must be null
  "trainingProgress": null,  // ✅ Must be null
  "totalScans": 0,
  "avgLiquidityScore": 0,
  "avgSpread": 0
}
```

### 4. Regression Tests

**Check for common bugs:**
- [ ] No JSONB overwrite (settings persist)
- [ ] No `NaN` or `undefined` in metrics
- [ ] No ML metrics in UI
- [ ] `avg_depth_100k` used (not `avg_depth`)
- [ ] Alerts array not empty when disabled

---

## ⚠️ Common Pitfalls

### 1. JSONB Overwrite Bug

**❌ WRONG:**
```typescript
await pool.query(
  'UPDATE agent_settings_liquidity SET alert_rules = $1 WHERE user_id = $2',
  [JSON.stringify(newRules), userId]
)
```

**✅ RIGHT:**
```typescript
await pool.query(
  `UPDATE agent_settings_liquidity 
   SET alert_rules = COALESCE(alert_rules, '{}'::jsonb) || $1::jsonb 
   WHERE user_id = $2`,
  [JSON.stringify(newRules), userId]
)
```

### 2. Field Name Mismatches

**⚠️ Common Mistakes:**
- Using `avg_depth` instead of `avg_depth_100k`
- Using `last_run_at` instead of `last_scan_at`
- Using `midPrice` when `bestBid`/`bestAsk` needed

**Solution:** Always reference the schema in `migrations/liquidity_agent_schema.sql`

### 3. Empty Alerts Array

**❌ WRONG:**
```typescript
// Returning [] when user disables alerts
return { alerts: [] }
```

**✅ RIGHT:**
```typescript
// Only return alerts if they actually fired
const alerts = checkAlerts(metrics, enabledRules)
return { alerts } // Could be empty, but based on actual checks
```

### 4. Using Mid-Price Incorrectly

**❌ WRONG:**
```typescript
const midPrice = (bestBid + bestAsk) / 2
const spread = (midPrice - bestBid) / bestBid * 100
```

**✅ RIGHT:**
```typescript
const midPrice = (bestBid + bestAsk) / 2
const spread = (bestAsk - bestBid) / bestBid * 100
```

### 5. Adding ML Metrics

**❌ WRONG:**
```typescript
if (agent.agent_key === 'liquidity') {
  return {
    ...baseMetrics,
    accuracy: realAccuracy,  // ❌ NO!
    trainingProgress: 100    // ❌ NO!
  }
}
```

**✅ RIGHT:**
```typescript
if (agent.agent_key === 'liquidity') {
  return {
    ...baseMetrics,
    accuracy: null,
    trainingProgress: null
  }
}
```

---

## 🏁 Definition of DONE

### Liquidity Agent is COMPLETE when:

#### Backend
- [ ] All TODOs in `LiquidityAnalyzerService.ts` implemented
- [ ] MEXC API client working
- [ ] POST `/run` returns full analysis
- [ ] Metrics aggregate correctly
- [ ] Settings persist (JSONB merge)
- [ ] All integration tests pass

#### Frontend
- [ ] Liquidity Agent card shows correct metrics
- [ ] ML metrics hidden (accuracy, training, etc.)
- [ ] Liquidity metrics displayed (score, spread, slippage)
- [ ] Recent runs table working
- [ ] No console errors

#### Database
- [ ] Runs saved to `agent_runs_liquidity`
- [ ] Metrics updated in `agent_metrics_liquidity`
- [ ] No JSONB overwrite bugs
- [ ] Data persists after refresh

#### Tests
- [ ] Unit tests pass (service layer)
- [ ] Integration tests pass (API endpoints)
- [ ] Metrics mapping verified
- [ ] No regression bugs

---

## 📚 Reference Documents

| Document | Purpose |
|----------|---------|
| `LIQUIDITY_ANALYZER_DESIGN_SPEC.md` | Phase 2A: All formulas and logic |
| `IMPLEMENTATION_GUIDE.md` | Phase 2B: Code examples for TODOs |
| `liquidity_agent_schema.sql` | Database schema reference |
| `test_liquidity_routes.js` | API integration test |

---

## 🚀 Implementation Order

### Step 1: MEXC API Client (Priority: HIGH)
1. Create `backend/services/mexc/MEXCClient.ts`
2. Implement order book fetching
3. Implement trades fetching
4. Implement 24h volume fetching
5. Add error handling and rate limiting
6. Test with real MEXC data

### Step 2: Fill Service TODOs (Priority: HIGH)
1. Implement `calculateSpread`
2. Implement `calculateDepth`
3. Implement `calculateImbalance`
4. Implement `calculateVolumeScore`
5. Implement `runSlippageTests`
6. Implement `analyzeCapitalFlow`
7. Implement `calculateRiskLevel`
8. Implement `checkAlerts`
9. Write unit tests for each method

### Step 3: Enable `/run` Endpoint (Priority: HIGH)
1. Uncomment MEXC integration in `liquidity-agent.js`
2. Test with real symbols (BTCUSDT, ETHUSDT)
3. Verify database saves
4. Verify metrics update

### Step 4: Frontend Integration (Priority: MEDIUM)
1. Create Liquidity Agent UI components
2. Connect to backend APIs
3. Display metrics correctly
4. Hide ML metrics
5. Add charts and visualizations

### Step 5: Testing & QA (Priority: HIGH)
1. Run all unit tests
2. Run integration tests
3. Test with multiple symbols
4. Test error cases
5. Verify no regressions

---

## 📞 Support & Questions

**If stuck on any step:**
1. Check Phase 2A spec for formulas
2. Check IMPLEMENTATION_GUIDE.md for code examples
3. Verify database schema in `liquidity_agent_schema.sql`
4. Run `test_liquidity_routes.js` to verify endpoints

**Common Questions:**

**Q: Can I change the formula weights?**  
A: ❌ NO. Weights are locked in `liquidity.config.ts`

**Q: Should I add accuracy metrics?**  
A: ❌ NO. This is a rule-based agent, not ML.

**Q: Can I skip unit tests?**  
A: ❌ NO. All methods must have tests.

**Q: What if MEXC API fails?**  
A: Implement retry logic and fallback to cached data.

**Q: How do I test without MEXC API keys?**  
A: Use mock data from `liquidity.mock.test.ts`

---

## ✅ Final Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: DB Schema | ✅ COMPLETE | Tables created, triggers working |
| Phase 2A: Design Spec | ✅ COMPLETE | All formulas defined |
| Phase 2B: Service Skeleton | ✅ COMPLETE | TODOs marked, types complete |
| Phase 3A: Backend Routes | ✅ COMPLETE | All endpoints working |
| Phase 4: Implementation Guide | ✅ COMPLETE | **THIS DOCUMENT** |

---

**Next Steps:**
1. Implement MEXC API client
2. Fill service layer TODOs
3. Enable `/run` endpoint
4. Build frontend UI
5. Test end-to-end
6. Deploy to production

---

**Last Updated:** 2026-01-04  
**Author:** Lead Architect  
**Status:** LOCKED & READY FOR GENSPARK  
**Version:** 1.0.0
