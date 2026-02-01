# Liquidity Agent – Analyzer Design Specification

## 🎯 Purpose
Complete mathematical and logical specification for the Liquidity Agent analyzer service. This document defines all formulas, calculations, and decision logic for analyzing market liquidity on MEXC.

---

## 1. Liquidity Score Formula

### 1.1 Overview
A composite score (0-100) measuring market liquidity quality:
- **100**: Excellent liquidity (tight spread, deep order book, balanced)
- **0**: Very poor liquidity (wide spread, shallow book, imbalanced)

### 1.2 Formula

```typescript
LiquidityScore = (
  spreadScore * 0.30 +        // 30% weight
  depthScore * 0.40 +          // 40% weight
  imbalanceScore * 0.20 +      // 20% weight
  volumeScore * 0.10           // 10% weight
) * 100
```

### 1.3 Component Calculations

#### A) Spread Score

```typescript
spread = (bestAsk - bestBid) / bestBid * 100  // spread as percentage
spreadScore = 1 - Math.min(spread / maxSpreadThreshold, 1)

// Threshold configuration:
maxSpreadThreshold = 0.5%  // if spread > 0.5%, score drops rapidly
```

**Example:**
- Spread = 0.1% → `1 - (0.1/0.5) = 0.8` → Score = 80%
- Spread = 0.5% → `1 - (0.5/0.5) = 0.0` → Score = 0%

#### B) Depth Score

```typescript
// Calculate liquidity at different price levels
depths = [0.1%, 0.5%, 1%, 2%]  // distance from mid-price

depthScore = depths.map(level => {
  bidDepth = sumBidsWithin(level)
  askDepth = sumAsksWithin(level)
  totalDepth = bidDepth + askDepth
  
  // Normalize by expected minimum liquidity
  return Math.min(totalDepth / minExpectedDepth, 1)
}).reduce((sum, score) => sum + score, 0) / depths.length

// minExpectedDepth varies by symbol:
// BTC: 100,000 USDT
// ETH: 50,000 USDT
// Altcoins: 10,000 USDT
```

**Logic:**
- Measures liquidity at multiple depth levels
- Higher depth → better score
- Normalized by symbol-specific expectations

#### C) Imbalance Score

```typescript
totalBidVolume = sum(bids.map(b => b.quantity))
totalAskVolume = sum(asks.map(a => a.quantity))

imbalance = Math.abs(totalBidVolume - totalAskVolume) / (totalBidVolume + totalAskVolume)
imbalanceScore = 1 - imbalance

// Example:
// Bid = 1000, Ask = 1000 → imbalance = 0 → score = 1.0 (perfect balance)
// Bid = 800, Ask = 1200 → imbalance = 0.2 → score = 0.8
```

**Logic:**
- Balanced buy/sell pressure → high score
- Heavy imbalance → low score (dump/pump risk)

#### D) Volume Score

```typescript
volume24h = getVolume24h(symbol)  // from MEXC API
volumeScore = Math.min(volume24h / minVolumeThreshold, 1)

// minVolumeThreshold varies by symbol:
// BTC: 10,000,000 USDT
// ETH: 5,000,000 USDT
// Altcoins: 500,000 USDT
```

**Logic:**
- High trading volume → more liquidity
- Low volume → illiquidity risk

---

## 2. Slippage Risk Model

### 2.1 Concept
Slippage is the difference between expected price and actual execution price when placing a market order.

### 2.2 Slippage Calculation

```typescript
function calculateSlippage(
  side: 'buy' | 'sell',
  orderSize: number,  // in USDT
  orderBook: OrderBook
): SlippageResult {
  let remainingSize = orderSize
  let totalCost = 0
  let totalQuantity = 0
  
  const orders = side === 'buy' ? orderBook.asks : orderBook.bids
  
  for (const [price, quantity] of orders) {
    const fillAmount = Math.min(remainingSize / price, quantity)
    totalCost += fillAmount * price
    totalQuantity += fillAmount
    remainingSize -= fillAmount * price
    
    if (remainingSize <= 0) break
  }
  
  const avgPrice = totalCost / totalQuantity
  const bestPrice = orders[0][0]
  const slippage = Math.abs((avgPrice - bestPrice) / bestPrice) * 100
  
  return {
    slippage,  // percentage
    avgPrice,
    bestPrice,
    filled: orderSize - remainingSize,
    unfilled: remainingSize
  }
}
```

### 2.3 Test Order Sizes

Test slippage for multiple order sizes:
```typescript
const testSizes = [10000, 50000, 100000, 500000]  // USDT
```

### 2.4 Risk Level Mapping

```typescript
function getSlippageRisk(slippage: number): 'low' | 'medium' | 'high' {
  if (slippage < 0.1) return 'low'
  if (slippage < 0.5) return 'medium'
  return 'high'
}
```

**Interpretation:**
- **< 0.1%**: Low risk (safe for large orders)
- **0.1-0.5%**: Medium risk (use limit orders)
- **> 0.5%**: High risk (avoid large market orders)

---

## 3. Capital Flow Detection

### 3.1 Concept
Detect buying/selling pressure from recent trades and order book structure.

### 3.2 Calculation

```typescript
function analyzeCapitalFlow(
  trades: Trade[],  // recent trades (e.g., last 100)
  orderBook: OrderBook
): CapitalFlow {
  // 1) Analyze recent trades
  const buyVolume = trades
    .filter(t => t.side === 'buy')
    .reduce((sum, t) => sum + t.quantity * t.price, 0)
  
  const sellVolume = trades
    .filter(t => t.side === 'sell')
    .reduce((sum, t) => sum + t.quantity * t.price, 0)
  
  const netFlow = buyVolume - sellVolume
  const flowRatio = buyVolume / sellVolume
  
  // 2) Order Book Pressure
  const bidPressure = sumBidsWithin(0.5%)  // liquidity within 0.5%
  const askPressure = sumAsksWithin(0.5%)
  const bookImbalance = (bidPressure - askPressure) / (bidPressure + askPressure)
  
  // 3) Sentiment
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  if (flowRatio > 1.2) sentiment = 'bullish'
  else if (flowRatio < 0.8) sentiment = 'bearish'
  
  return {
    netFlow,  // positive = buying, negative = selling
    flowRatio,  // > 1 = more buying
    sentiment,
    strength: Math.abs(bookImbalance),  // 0-1 scale
    bidPressure,
    askPressure
  }
}
```

**Interpretation:**
- `flowRatio > 1.2` → **Strong Buying Pressure**
- `flowRatio < 0.8` → **Strong Selling Pressure**
- `0.8 ≤ flowRatio ≤ 1.2` → **Neutral**

---

## 4. Alert Logic

### 4.1 Alert Types

```typescript
type AlertType = 
  | 'liquidity_drop'    // Score falls below threshold
  | 'spread_widen'      // Spread exceeds threshold
  | 'imbalance'         // Order book imbalance
  | 'slippage_high'     // High slippage detected

interface AlertRule {
  type: AlertType
  threshold: number
  enabled: boolean
}
```

### 4.2 Alert Detection

```typescript
function checkAlerts(
  currentMetrics: LiquidityMetrics,
  rules: AlertRule[]
): Alert[] {
  const alerts: Alert[] = []
  
  for (const rule of rules.filter(r => r.enabled)) {
    switch (rule.type) {
      case 'liquidity_drop':
        if (currentMetrics.liquidityScore < rule.threshold) {
          alerts.push({
            type: 'liquidity_drop',
            severity: 'high',
            message: `Liquidity score dropped to ${currentMetrics.liquidityScore}`,
            value: currentMetrics.liquidityScore,
            timestamp: new Date().toISOString()
          })
        }
        break
      
      case 'spread_widen':
        if (currentMetrics.spread > rule.threshold) {
          alerts.push({
            type: 'spread_widen',
            severity: 'medium',
            message: `Spread widened to ${currentMetrics.spread}%`,
            value: currentMetrics.spread,
            timestamp: new Date().toISOString()
          })
        }
        break
      
      case 'imbalance':
        if (currentMetrics.imbalance > rule.threshold) {
          alerts.push({
            type: 'imbalance',
            severity: 'medium',
            message: `Order book imbalance: ${(currentMetrics.imbalance * 100).toFixed(1)}%`,
            value: currentMetrics.imbalance,
            timestamp: new Date().toISOString()
          })
        }
        break
      
      case 'slippage_high':
        const testSlippage = calculateSlippage('buy', 50000, currentMetrics.orderBook)
        if (testSlippage.slippage > rule.threshold) {
          alerts.push({
            type: 'slippage_high',
            severity: 'high',
            message: `High slippage detected: ${testSlippage.slippage.toFixed(2)}%`,
            value: testSlippage.slippage,
            timestamp: new Date().toISOString()
          })
        }
        break
    }
  }
  
  return alerts
}
```

### 4.3 Default Alert Thresholds

```typescript
const defaultAlertRules: AlertRule[] = [
  { type: 'liquidity_drop', threshold: 40, enabled: true },
  { type: 'spread_widen', threshold: 0.3, enabled: true },
  { type: 'imbalance', threshold: 0.4, enabled: true },
  { type: 'slippage_high', threshold: 0.5, enabled: true }
]
```

---

## 5. Risk Level Calculation

### 5.1 Multi-Factor Risk Assessment

```typescript
function calculateRiskLevel(metrics: LiquidityMetrics): 'low' | 'medium' | 'high' {
  const { liquidityScore, spread, slippage } = metrics
  
  let riskScore = 0
  
  // Factor 1: Liquidity Score
  if (liquidityScore < 30) riskScore += 3
  else if (liquidityScore < 50) riskScore += 2
  else if (liquidityScore < 70) riskScore += 1
  
  // Factor 2: Spread
  if (spread > 0.5) riskScore += 3
  else if (spread > 0.3) riskScore += 2
  else if (spread > 0.1) riskScore += 1
  
  // Factor 3: Slippage (for 50k USDT order)
  if (slippage > 1.0) riskScore += 3
  else if (slippage > 0.5) riskScore += 2
  else if (slippage > 0.2) riskScore += 1
  
  // Map to risk level
  if (riskScore >= 7) return 'high'
  if (riskScore >= 4) return 'medium'
  return 'low'
}
```

### 5.2 Risk Level Interpretation

| Risk Level | Points | Interpretation |
|------------|--------|----------------|
| **Low** | 0-3 | Safe to trade large orders |
| **Medium** | 4-6 | Use limit orders, monitor closely |
| **High** | 7+ | Avoid large orders, high slippage expected |

---

## 6. Complete Output Schema

```typescript
interface LiquidityAnalysisResult {
  symbol: string
  timestamp: string  // ISO 8601
  liquidityScore: number  // 0-100
  riskLevel: 'low' | 'medium' | 'high'
  
  overview: {
    score: number
    spread: number  // percentage
    depth24h: number  // USDT
    volume24h: number  // USDT
    trades24h: number
  }
  
  liquidityMap: {
    levels: Array<{
      distance: number  // percentage from mid-price
      bidDepth: number  // USDT
      askDepth: number  // USDT
      totalDepth: number
    }>
    depthScore: number
  }
  
  orderBook: {
    bids: Array<[price: number, quantity: number]>  // top 20
    asks: Array<[price: number, quantity: number]>  // top 20
    midPrice: number
    bestBid: number
    bestAsk: number
    spread: number
    imbalance: number
  }
  
  slippageRisk: {
    orderSizes: number[]  // test sizes: [10k, 50k, 100k, 500k]
    buy: Array<{
      size: number
      slippage: number
      avgPrice: number
      filled: number
      unfilled: number
    }>
    sell: Array<{
      size: number
      slippage: number
      avgPrice: number
      filled: number
      unfilled: number
    }>
    riskLevel: 'low' | 'medium' | 'high'
  }
  
  capitalFlow: {
    netFlow: number  // USDT (positive = buying)
    flowRatio: number  // buy/sell ratio
    sentiment: 'bullish' | 'bearish' | 'neutral'
    strength: number  // 0-1
    bidPressure: number  // USDT
    askPressure: number  // USDT
    recentTrades: Trade[]  // last 100
  }
  
  alerts: Array<{
    type: string
    severity: 'low' | 'medium' | 'high'
    message: string
    value: number
    timestamp: string
  }>
  
  raw: {
    executionTime: number  // ms
    dataSource: 'mexc'
    orderbookDepth: number  // how many levels fetched
    tradesCount: number
  }
}
```

---

## 7. Data Sources

### 7.1 Required MEXC API Endpoints

```typescript
// 1. Order Book Depth
GET https://api.mexc.com/api/v3/depth
params: {
  symbol: 'BTCUSDT',
  limit: 100  // get top 100 levels
}

// 2. Recent Trades
GET https://api.mexc.com/api/v3/trades
params: {
  symbol: 'BTCUSDT',
  limit: 100
}

// 3. 24h Ticker
GET https://api.mexc.com/api/v3/ticker/24hr
params: {
  symbol: 'BTCUSDT'
}
```

### 7.2 Data Refresh Rate

- **Order Book**: Fetch on every analysis run
- **Trades**: Last 100 trades
- **24h Stats**: From ticker endpoint

---

## 8. Symbol-Specific Configuration

```typescript
const symbolConfig = {
  'BTCUSDT': {
    minExpectedDepth: 100000,  // USDT
    minVolumeThreshold: 10000000,  // USDT
    maxSpreadThreshold: 0.5,  // %
    testOrderSizes: [10000, 50000, 100000, 500000]
  },
  'ETHUSDT': {
    minExpectedDepth: 50000,
    minVolumeThreshold: 5000000,
    maxSpreadThreshold: 0.5,
    testOrderSizes: [5000, 25000, 50000, 250000]
  },
  'default': {
    minExpectedDepth: 10000,
    minVolumeThreshold: 500000,
    maxSpreadThreshold: 1.0,
    testOrderSizes: [1000, 5000, 10000, 50000]
  }
}
```

---

## 9. Implementation Notes

### 9.1 Performance Considerations
- Cache order book data for 1 second (avoid redundant API calls)
- Parallel calculation of all metrics
- Pre-calculate spread levels for depth analysis

### 9.2 Error Handling
- API timeout → return cached data with warning
- Invalid order book → skip slippage calculation
- Missing trades → use order book pressure only

### 9.3 Testing Strategy
- Unit tests for each formula component
- Integration tests with mock order book data
- Live API tests with known symbols

---

## 10. Next Steps (Phase 2B)

Create `LiquidityAnalyzerService.ts` skeleton:
- Implement all formulas from this spec
- Add MEXC API client
- Add symbol-specific configuration
- Add comprehensive logging

---

## Status

- ✅ **Phase 2A Complete**: All formulas, logic, and schemas defined
- ⏳ **Phase 2B**: Service implementation (next)
- ⏳ **Phase 3**: Backend routes + metrics mapping
- ⏳ **Phase 4**: Implementation Guide for Genspark

---

**Last Updated**: 2026-01-04
**Author**: Lead Architect
**Status**: Complete & Ready for Implementation
