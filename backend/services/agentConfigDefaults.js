/**
 * Centralized Agent Configuration Defaults (ESM)
 * Ensures UI never receives undefined fields by normalizing DB config + defaults.
 */

export const AGENT_DEFAULTS = {
  technical: {
    indicators: ['RSI', 'MACD', 'EMA', 'SMA', 'BB'],
    timeframes: ['1h', '4h', '1d'],
    confidence_threshold: 70,
    riskLevel: 'medium',
    minConfidence: 70,
    maxPositions: 5,
    autoTrading: false,
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: {
      useMachineLearning: true,
      useDeepLearning: false,
      ensembleMode: true,
      realTimeAnalysis: true,
    },
  },

  risk: {
    riskLevel: 'medium',
    maxDrawdown: 10,
    maxPositionSize: 5,
    stopLossPercent: 2,
    takeProfitPercent: 5,
    autoRebalance: true,
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: {
      dynamicPositionSizing: true,
      correlationAnalysis: true,
      portfolioHedging: false,
    },
  },

  sentiment: {
    sources: ['twitter', 'news', 'reddit'],
    sentimentThreshold: 60,
    timeWindow: '24h',
    languages: ['en'],
    autoTrading: false,
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { useNLP: true, emotionDetection: true, influencerWeight: 1.5 },
  },

  pattern: {
    patterns: ['head_shoulders', 'double_top', 'triangle', 'flag'],
    timeframes: ['4h', '1d'],
    minConfidence: 75,
    autoTrading: false,
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { useHistoricalData: true, patternVariations: true },
  },

  price_prediction: {
    models: ['LSTM', 'ARIMA', 'Prophet'],
    predictionHorizon: '24h',
    confidence_threshold: 70,
    autoTrading: false,
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { ensembleModels: true, retrainFrequency: 'daily' },
  },

  arbitrage: {
    exchanges: ['binance', 'coinbase'],
    minProfitPercent: 0.5,
    maxSlippage: 0.3,
    autoTrading: false,
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { triangularArbitrage: false, flashLoans: false },
  },

  portfolio: {
    rebalanceFrequency: 'weekly',
    targetAllocation: { BTC: 40, ETH: 30, stables: 30 },
    autoRebalance: false,
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { dynamicAllocation: true, taxOptimization: false },
  },

  liquidity: {
    minLiquidity: 100000,
    liquidityThreshold: 50,
    timeframes: ['1h', '4h'],
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { depthAnalysis: true, orderBookMonitoring: true },
  },

  trend: {
    indicators: ['SMA', 'EMA', 'ADX'],
    timeframes: ['4h', '1d', '1w'],
    trendStrength: 'medium',
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { multiTimeframe: true, divergenceDetection: true },
  },

  optimization: {
    optimizationTarget: 'sharpe_ratio',
    constraints: { maxDrawdown: 15, minReturn: 10 },
    reoptimizeFrequency: 'monthly',
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { geneticAlgorithm: false, monteCarlo: true },
  },

  order: {
    orderTypes: ['market', 'limit', 'stop_loss'],
    executionStrategy: 'TWAP',
    slippageTolerance: 0.5,
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { smartRouting: true, darkPools: false },
  },

  fundamental: {
    metrics: ['market_cap', 'volume', 'tokenomics'],
    analysisDepth: 'deep',
    updateFrequency: 'daily',
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { onChainData: true, competitorAnalysis: true },
  },

  market_intelligence: {
    sources: ['news', 'events', 'regulations'],
    regions: ['global'],
    alertThreshold: 'medium',
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { realTimeAlerts: true, historicalCorrelation: true },
  },

  volume: {
    indicators: ['OBV', 'VWAP', 'Volume_Profile'],
    timeframes: ['1h', '4h', '1d'],
    volumeThreshold: 'high',
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { volumeSpread: true, accumulationDistribution: true },
  },

  timing: {
    entrySignals: ['momentum', 'breakout'],
    exitSignals: ['trailing_stop', 'time_based'],
    timeframes: ['15m', '1h', '4h'],
    notificationSettings: { onSignal: true, onAlert: true, onError: true },
    advancedSettings: { adaptiveTiming: true, marketRegimeDetection: true },
  },
};

/** Small, safe deep-merge (objects + arrays) */
function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(defaults, overrides) {
  if (Array.isArray(defaults)) {
    // If DB has an array, use it; else fallback to defaults
    return Array.isArray(overrides) ? overrides : defaults;
  }
  if (isPlainObject(defaults)) {
    const out = { ...defaults };
    if (isPlainObject(overrides)) {
      for (const [k, v] of Object.entries(overrides)) {
        if (k in defaults) {
          out[k] = deepMerge(defaults[k], v);
        } else {
          out[k] = v; // allow extra fields from DB
        }
      }
    }
    return out;
  }
  // primitives
  return overrides !== undefined ? overrides : defaults;
}

export function normalizeAgentConfig(agent_key, rawConfig = {}) {
  const defaults = AGENT_DEFAULTS[agent_key];
  if (!defaults) {
    console.warn(`⚠️ No defaults found for agent_key: ${agent_key}`);
    // still guarantee these two exist for UI safety
    return {
      ...(rawConfig || {}),
      notificationSettings: rawConfig?.notificationSettings ?? { onSignal: true, onAlert: true, onError: true },
      advancedSettings: rawConfig?.advancedSettings ?? {},
    };
  }

  const normalized = deepMerge(defaults, rawConfig || {});

  // Hard guarantee: UI core blocks never undefined
  normalized.notificationSettings ??= { onSignal: true, onAlert: true, onError: true };
  normalized.advancedSettings ??= {};

  return normalized;
}

export function getAgentDefaults(agent_key) {
  return AGENT_DEFAULTS[agent_key] || {};
}

export function getSupportedAgents() {
  return Object.keys(AGENT_DEFAULTS);
}
