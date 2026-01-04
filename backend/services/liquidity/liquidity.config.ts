/**
 * Liquidity Agent - Configuration
 * Phase 2B: Sacred numbers from Phase 2A spec
 */

import { SymbolConfig, AlertRule } from './liquidity.types'

/**
 * Price levels for depth analysis (as % from mid-price)
 */
export const DEPTH_LEVELS = [0.1, 0.5, 1, 2] // %

/**
 * Liquidity Score Component Weights
 * Total must equal 1.0
 */
export const LIQUIDITY_WEIGHTS = {
  spread: 0.30,      // 30%
  depth: 0.40,       // 40%
  imbalance: 0.20,   // 20%
  volume: 0.10       // 10%
}

/**
 * Default Thresholds
 */
export const DEFAULT_THRESHOLDS = {
  maxSpreadPct: 0.5,        // 0.5% spread threshold
  imbalance: 0.4,           // 40% imbalance threshold
  liquidityDrop: 40,        // liquidity score < 40
  slippageHigh: 0.5,        // 0.5% slippage threshold
  spreadWiden: 0.3          // 0.3% spread alert
}

/**
 * Test Order Sizes (in USDT)
 * Used for slippage calculation
 */
export const TEST_ORDER_SIZES = [10_000, 50_000, 100_000, 500_000]

/**
 * Symbol-Specific Configuration
 * From Phase 2A Section 8
 */
export const SYMBOL_CONFIGS: Record<string, SymbolConfig> = {
  'BTCUSDT': {
    minExpectedDepth: 100_000,      // 100k USDT
    minVolumeThreshold: 10_000_000,  // 10M USDT
    maxSpreadThreshold: 0.5,         // 0.5%
    testOrderSizes: [10_000, 50_000, 100_000, 500_000]
  },
  'ETHUSDT': {
    minExpectedDepth: 50_000,       // 50k USDT
    minVolumeThreshold: 5_000_000,   // 5M USDT
    maxSpreadThreshold: 0.5,         // 0.5%
    testOrderSizes: [5_000, 25_000, 50_000, 250_000]
  },
  'default': {
    minExpectedDepth: 10_000,       // 10k USDT
    minVolumeThreshold: 500_000,     // 500k USDT
    maxSpreadThreshold: 1.0,         // 1.0%
    testOrderSizes: [1_000, 5_000, 10_000, 50_000]
  }
}

/**
 * Default Alert Rules
 * From Phase 2A Section 4.3
 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { type: 'liquidity_drop', threshold: 40, enabled: true },
  { type: 'spread_widen', threshold: 0.3, enabled: true },
  { type: 'imbalance', threshold: 0.4, enabled: true },
  { type: 'slippage_high', threshold: 0.5, enabled: true }
]

/**
 * Risk Level Scoring Thresholds
 * From Phase 2A Section 5
 */
export const RISK_THRESHOLDS = {
  liquidityScore: {
    low: 70,    // >= 70 → +0 points
    medium: 50, // 50-70 → +1 point
    high: 30    // < 30 → +3 points
  },
  spread: {
    low: 0.1,   // <= 0.1% → +0 points
    medium: 0.3, // 0.1-0.3% → +1 point
    high: 0.5   // > 0.5% → +3 points
  },
  slippage: {
    low: 0.2,   // <= 0.2% → +0 points
    medium: 0.5, // 0.2-0.5% → +1 point
    high: 1.0   // > 1.0% → +3 points
  }
}

/**
 * Capital Flow Sentiment Thresholds
 */
export const FLOW_RATIO_THRESHOLDS = {
  bullish: 1.2,   // flowRatio > 1.2
  bearish: 0.8    // flowRatio < 0.8
}

/**
 * Get symbol-specific config
 */
export function getSymbolConfig(symbol: string): SymbolConfig {
  return SYMBOL_CONFIGS[symbol] || SYMBOL_CONFIGS['default']
}
