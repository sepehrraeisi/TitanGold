# Liquidity Agent - Phase 2B Implementation Guide

## 🎯 Overview

This document provides **exact implementation instructions** for filling the TODO sections in `LiquidityAnalyzerService.ts`.

**CRITICAL RULES:**
- ✅ Follow Phase 2A formulas exactly
- ❌ Do NOT change weights or thresholds
- ❌ Do NOT add custom logic
- ✅ Use provided TypeScript types
- ✅ Write unit tests for each method

---

## 📁 File Structure

```
backend/services/liquidity/
├── liquidity.types.ts           ✅ COMPLETE
├── liquidity.config.ts          ✅ COMPLETE
├── LiquidityAnalyzerService.ts  🔨 TODO MARKERS
├── __tests__/
│   └── liquidity.mock.test.ts   🧪 TEST SKELETON
└── IMPLEMENTATION_GUIDE.md      📖 THIS FILE
```

---

## 🔧 TODO 1: calculateSpread

**Location:** Line ~110

**Formula (Phase 2A Section 1.3.A):**
```typescript
spread = (bestAsk - bestBid) / bestBid * 100  // percentage
spreadScore = 1 - Math.min(spread / maxSpreadThreshold, 1)
```

**Implementation:**
```typescript
private calculateSpread(orderBook: OrderBook): SpreadResult {
  if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
    throw new Error('Order book is empty')
  }

  const bestBid = orderBook.bids[0].price
  const bestAsk = orderBook.asks[0].price
  const mid = (bestBid + bestAsk) / 2
  
  const spread = ((bestAsk - bestBid) / bestBid) * 100
  const score = 1 - Math.min(spread / this.symbolConfig.maxSpreadThreshold, 1)

  return {
    value: spread,
    score: Math.max(0, score),  // Ensure non-negative
    mid,
    bestBid,
    bestAsk
  }
}
```

**Test:**
```typescript
// Best bid: 50000, Best ask: 50010
// spread = (50010 - 50000) / 50000 * 100 = 0.02%
// score = 1 - min(0.02 / 0.5, 1) = 1 - 0.04 = 0.96
```

---

## 🔧 TODO 2: calculateDepth

**Location:** Line ~130

**Formula (Phase 2A Section 1.3.B):**
```typescript
For each depth level (0.1%, 0.5%, 1%, 2%):
  bidDepth = sum(bids within level)
  askDepth = sum(asks within level)
  totalDepth = bidDepth + askDepth
  levelScore = min(totalDepth / minExpectedDepth, 1)

depthScore = average(all levelScores)
```

**Implementation:**
```typescript
private calculateDepth(orderBook: OrderBook): DepthResult {
  const bestBid = orderBook.bids[0].price
  const bestAsk = orderBook.asks[0].price
  const midPrice = (bestBid + bestAsk) / 2

  const levels = DEPTH_LEVELS.map(distance => {
    const priceRange = midPrice * (distance / 100)
    const minBidPrice = midPrice - priceRange
    const maxAskPrice = midPrice + priceRange

    // Sum bid liquidity within range
    const bidDepth = orderBook.bids
      .filter(b => b.price >= minBidPrice)
      .reduce((sum, b) => sum + b.price * b.quantity, 0)

    // Sum ask liquidity within range
    const askDepth = orderBook.asks
      .filter(a => a.price <= maxAskPrice)
      .reduce((sum, a) => sum + a.price * a.quantity, 0)

    const totalDepth = bidDepth + askDepth

    return {
      distance,
      bidDepth,
      askDepth,
      totalDepth
    }
  })

  // Calculate score for each level
  const levelScores = levels.map(l => 
    Math.min(l.totalDepth / this.symbolConfig.minExpectedDepth, 1)
  )

  const depthScore = levelScores.reduce((sum, s) => sum + s, 0) / levelScores.length

  const totalDepth = levels.reduce((sum, l) => sum + l.totalDepth, 0)

  return {
    score: depthScore,
    totalDepth,
    map: {
      levels,
      depthScore
    }
  }
}
```

---

## 🔧 TODO 3: calculateImbalance

**Location:** Line ~155

**Formula (Phase 2A Section 1.3.C):**
```typescript
totalBidVolume = sum(bids.quantity * bids.price)
totalAskVolume = sum(asks.quantity * asks.price)
imbalance = |totalBid - totalAsk| / (totalBid + totalAsk)
imbalanceScore = 1 - imbalance
```

**Implementation:**
```typescript
private calculateImbalance(orderBook: OrderBook): ImbalanceResult {
  const totalBidVolume = orderBook.bids
    .reduce((sum, b) => sum + b.quantity * b.price, 0)

  const totalAskVolume = orderBook.asks
    .reduce((sum, a) => sum + a.quantity * a.price, 0)

  const total = totalBidVolume + totalAskVolume
  const imbalance = total > 0 
    ? Math.abs(totalBidVolume - totalAskVolume) / total
    : 0

  const score = 1 - imbalance

  return {
    value: imbalance,
    score,
    totalBidVolume,
    totalAskVolume
  }
}
```

---

## 🔧 TODO 4: calculateVolumeScore

**Location:** Line ~175

**Formula (Phase 2A Section 1.3.D):**
```typescript
volumeScore = min(volume24h / minVolumeThreshold, 1)
```

**Implementation:**
```typescript
private calculateVolumeScore(volume24h: number): number {
  return Math.min(volume24h / this.symbolConfig.minVolumeThreshold, 1)
}
```

---

## 🔧 TODO 5: runSlippageTests

**Location:** Line ~210

**Formula (Phase 2A Section 2.2):**
```typescript
For each test order size:
  Walk through asks (for buy) or bids (for sell)
  Fill order by consuming liquidity
  Calculate average execution price
  slippage = |(avgPrice - bestPrice) / bestPrice| * 100
```

**Implementation:**
```typescript
private runSlippageTests(orderBook: OrderBook): {
  buy: SlippageTestResult[]
  sell: SlippageTestResult[]
  maxSlippage: number
  riskLevel: RiskLevel
} {
  const testSizes = this.symbolConfig.testOrderSizes

  const buy = testSizes.map(size => 
    this.calculateSlippage('buy', size, orderBook)
  )

  const sell = testSizes.map(size => 
    this.calculateSlippage('sell', size, orderBook)
  )

  const maxSlippage = Math.max(
    ...buy.map(t => t.slippage),
    ...sell.map(t => t.slippage)
  )

  const riskLevel = this.getSlippageRisk(maxSlippage)

  return { buy, sell, maxSlippage, riskLevel }
}

private calculateSlippage(
  side: 'buy' | 'sell',
  orderSize: number,
  orderBook: OrderBook
): SlippageTestResult {
  let remainingSize = orderSize
  let totalCost = 0
  let totalQuantity = 0

  const orders = side === 'buy' ? orderBook.asks : orderBook.bids

  for (const [price, quantity] of orders.map(o => [o.price, o.quantity])) {
    const fillAmount = Math.min(remainingSize / price, quantity)
    totalCost += fillAmount * price
    totalQuantity += fillAmount
    remainingSize -= fillAmount * price

    if (remainingSize <= 0) break
  }

  const avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0
  const bestPrice = orders[0]?.price || 0
  const slippage = bestPrice > 0 
    ? Math.abs((avgPrice - bestPrice) / bestPrice) * 100
    : 0

  return {
    size: orderSize,
    slippage,
    avgPrice,
    filled: orderSize - remainingSize,
    unfilled: remainingSize
  }
}

private getSlippageRisk(slippage: number): RiskLevel {
  if (slippage < 0.1) return 'low'
  if (slippage < 0.5) return 'medium'
  return 'high'
}
```

---

## 🔧 TODO 6: analyzeCapitalFlow

**Location:** Line ~245

**Formula (Phase 2A Section 3.2):**
```typescript
buyVolume = sum(buy trades)
sellVolume = sum(sell trades)
netFlow = buyVolume - sellVolume
flowRatio = buyVolume / sellVolume
sentiment = 'bullish' if ratio > 1.2, 'bearish' if < 0.8, else 'neutral'
```

**Implementation:**
```typescript
private analyzeCapitalFlow(
  trades: Trade[],
  orderBook: OrderBook
): CapitalFlowResult {
  // 1) Analyze recent trades
  const buyVolume = trades
    .filter(t => t.side === 'buy')
    .reduce((sum, t) => sum + t.quantity * t.price, 0)

  const sellVolume = trades
    .filter(t => t.side === 'sell')
    .reduce((sum, t) => sum + t.quantity * t.price, 0)

  const netFlow = buyVolume - sellVolume
  const flowRatio = sellVolume > 0 ? buyVolume / sellVolume : 1

  // 2) Order book pressure (within 0.5% of mid-price)
  const bestBid = orderBook.bids[0].price
  const bestAsk = orderBook.asks[0].price
  const midPrice = (bestBid + bestAsk) / 2
  const priceRange = midPrice * 0.005  // 0.5%

  const bidPressure = orderBook.bids
    .filter(b => b.price >= midPrice - priceRange)
    .reduce((sum, b) => sum + b.quantity * b.price, 0)

  const askPressure = orderBook.asks
    .filter(a => a.price <= midPrice + priceRange)
    .reduce((sum, a) => sum + a.quantity * a.price, 0)

  const total = bidPressure + askPressure
  const bookImbalance = total > 0 
    ? (bidPressure - askPressure) / total
    : 0

  // 3) Determine sentiment
  let sentiment: Sentiment = 'neutral'
  if (flowRatio > FLOW_RATIO_THRESHOLDS.bullish) sentiment = 'bullish'
  else if (flowRatio < FLOW_RATIO_THRESHOLDS.bearish) sentiment = 'bearish'

  return {
    netFlow,
    flowRatio,
    sentiment,
    strength: Math.abs(bookImbalance),
    bidPressure,
    askPressure
  }
}
```

---

## 🔧 TODO 7: calculateRiskLevel

**Location:** Line ~280

**Formula (Phase 2A Section 5.1):**
```typescript
riskScore = 0
if liquidityScore < 30: riskScore += 3
elif liquidityScore < 50: riskScore += 2
elif liquidityScore < 70: riskScore += 1

if spread > 0.5: riskScore += 3
elif spread > 0.3: riskScore += 2
elif spread > 0.1: riskScore += 1

if slippage > 1.0: riskScore += 3
elif slippage > 0.5: riskScore += 2
elif slippage > 0.2: riskScore += 1

if riskScore >= 7: return 'high'
if riskScore >= 4: return 'medium'
return 'low'
```

**Implementation:**
```typescript
private calculateRiskLevel(
  liquidityScore: number,
  spread: number,
  slippage: number
): RiskLevel {
  let riskScore = 0

  // Factor 1: Liquidity Score
  if (liquidityScore < RISK_THRESHOLDS.liquidityScore.high) riskScore += 3
  else if (liquidityScore < RISK_THRESHOLDS.liquidityScore.medium) riskScore += 2
  else if (liquidityScore < RISK_THRESHOLDS.liquidityScore.low) riskScore += 1

  // Factor 2: Spread
  if (spread > RISK_THRESHOLDS.spread.high) riskScore += 3
  else if (spread > RISK_THRESHOLDS.spread.medium) riskScore += 2
  else if (spread > RISK_THRESHOLDS.spread.low) riskScore += 1

  // Factor 3: Slippage
  if (slippage > RISK_THRESHOLDS.slippage.high) riskScore += 3
  else if (slippage > RISK_THRESHOLDS.slippage.medium) riskScore += 2
  else if (slippage > RISK_THRESHOLDS.slippage.low) riskScore += 1

  // Map to risk level
  if (riskScore >= 7) return 'high'
  if (riskScore >= 4) return 'medium'
  return 'low'
}
```

---

## 🔧 TODO 8: checkAlerts

**Location:** Line ~310

**Formula (Phase 2A Section 4.2):**
```typescript
For each enabled alert rule:
  Check condition
  If triggered, create alert object
```

**Implementation:**
```typescript
private checkAlerts(metrics: {
  liquidityScore: number
  spread: number
  imbalance: number
  slippage: number
  orderBook: OrderBook
}): Alert[] {
  const alerts: Alert[] = []
  const timestamp = new Date().toISOString()

  for (const rule of DEFAULT_ALERT_RULES.filter(r => r.enabled)) {
    switch (rule.type) {
      case 'liquidity_drop':
        if (metrics.liquidityScore < rule.threshold) {
          alerts.push({
            type: 'liquidity_drop',
            severity: 'high',
            message: `Liquidity score dropped to ${metrics.liquidityScore.toFixed(1)}`,
            value: metrics.liquidityScore,
            timestamp
          })
        }
        break

      case 'spread_widen':
        if (metrics.spread > rule.threshold) {
          alerts.push({
            type: 'spread_widen',
            severity: 'medium',
            message: `Spread widened to ${metrics.spread.toFixed(3)}%`,
            value: metrics.spread,
            timestamp
          })
        }
        break

      case 'imbalance':
        if (metrics.imbalance > rule.threshold) {
          alerts.push({
            type: 'imbalance',
            severity: 'medium',
            message: `Order book imbalance: ${(metrics.imbalance * 100).toFixed(1)}%`,
            value: metrics.imbalance,
            timestamp
          })
        }
        break

      case 'slippage_high':
        if (metrics.slippage > rule.threshold) {
          alerts.push({
            type: 'slippage_high',
            severity: 'high',
            message: `High slippage detected: ${metrics.slippage.toFixed(2)}%`,
            value: metrics.slippage,
            timestamp
          })
        }
        break
    }
  }

  return alerts
}
```

---

## ✅ Verification Checklist

After implementing all TODOs:

- [ ] All methods return correct types
- [ ] No hardcoded values (use config)
- [ ] Edge cases handled (empty order book, zero volume)
- [ ] Unit tests pass
- [ ] Integration test with mock MEXC data passes
- [ ] Code follows TypeScript best practices
- [ ] No eslint warnings

---

## 🧪 Testing Strategy

1. **Unit Tests**: Each private method
2. **Integration Tests**: Full analysis with mock data
3. **Edge Cases**: Empty books, extreme spreads, zero volume
4. **Performance**: Analysis should complete in < 100ms

---

## 📚 References

- **Phase 2A Spec**: `LIQUIDITY_ANALYZER_DESIGN_SPEC.md`
- **Config**: `liquidity.config.ts`
- **Types**: `liquidity.types.ts`

---

**Status:** Ready for implementation
**Estimated Time:** 4-6 hours
**Complexity:** Medium
