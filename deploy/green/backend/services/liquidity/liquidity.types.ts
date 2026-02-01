/**
 * Liquidity Agent - Type Definitions
 * Phase 2B: Complete type-safe contracts
 */

export type RiskLevel = 'low' | 'medium' | 'high'
export type Sentiment = 'bullish' | 'bearish' | 'neutral'
export type AlertType = 'liquidity_drop' | 'spread_widen' | 'imbalance' | 'slippage_high'

export interface OrderBookLevel {
  price: number
  quantity: number
}

export interface OrderBook {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
}

export interface Trade {
  price: number
  quantity: number
  side: 'buy' | 'sell'
  timestamp: string
}

export interface LiquidityMetrics {
  liquidityScore: number
  spread: number
  imbalance: number
  volume24h: number
}

export interface SlippageTestResult {
  size: number
  slippage: number
  avgPrice: number
  filled: number
  unfilled: number
}

export interface SpreadResult {
  value: number  // spread as percentage
  score: number  // 0-1
  mid: number
  bestBid: number
  bestAsk: number
}

export interface DepthResult {
  score: number  // 0-1
  totalDepth: number  // USDT
  map: {
    levels: Array<{
      distance: number  // % from mid-price
      bidDepth: number  // USDT
      askDepth: number  // USDT
      totalDepth: number  // USDT
    }>
    depthScore: number
  }
}

export interface ImbalanceResult {
  value: number  // 0-1 (0 = perfect balance)
  score: number  // 0-1 (1 = perfect balance)
  totalBidVolume: number
  totalAskVolume: number
}

export interface CapitalFlowResult {
  netFlow: number  // USDT (positive = buying)
  flowRatio: number  // buy/sell ratio
  sentiment: Sentiment
  strength: number  // 0-1
  bidPressure: number  // USDT
  askPressure: number  // USDT
}

export interface Alert {
  type: AlertType
  severity: RiskLevel
  message: string
  value: number
  timestamp: string
}

export interface AlertRule {
  type: AlertType
  threshold: number
  enabled: boolean
}

export interface LiquidityAnalysisResult {
  symbol: string
  timestamp: string
  liquidityScore: number
  riskLevel: RiskLevel

  overview: {
    score: number
    spread: number
    depth24h: number
    volume24h: number
    trades24h: number
  }

  liquidityMap: {
    levels: Array<{
      distance: number
      bidDepth: number
      askDepth: number
      totalDepth: number
    }>
    depthScore: number
  }

  orderBook: {
    bids: OrderBookLevel[]
    asks: OrderBookLevel[]
    midPrice: number
    bestBid: number
    bestAsk: number
    spread: number
    imbalance: number
  }

  slippageRisk: {
    orderSizes: number[]
    buy: SlippageTestResult[]
    sell: SlippageTestResult[]
    riskLevel: RiskLevel
  }

  capitalFlow: {
    netFlow: number
    flowRatio: number
    sentiment: Sentiment
    strength: number
    bidPressure: number
    askPressure: number
  }

  alerts: Alert[]

  raw: {
    executionTime: number
    dataSource: 'mexc'
    orderbookDepth: number
    tradesCount: number
  }
}

export interface SymbolConfig {
  minExpectedDepth: number  // USDT
  minVolumeThreshold: number  // USDT
  maxSpreadThreshold: number  // %
  testOrderSizes: number[]  // USDT
}
