/**
 * Centralized Agent Configuration Defaults
 * 
 * Each agent has a default config structure to prevent undefined errors in UI.
 * Use normalizeAgentConfig(agent_key, rawConfig) to merge DB config with defaults.
 */

const AGENT_DEFAULTS = {
  // 1. Technical Analysis Agent
  technical: {
    indicators: ['RSI', 'MACD', 'EMA', 'SMA', 'BB'],
    timeframes: ['1h', '4h', '1d'],
    confidence_threshold: 70,
    riskLevel: 'medium',
    minConfidence: 70,
    maxPositions: 5,
    autoTrading: false,
    notificationSettings: {
      onSignal: true,
      onAlert: true,
      onError: true,
    },
    advancedSettings: {
      useMachineLearning: true,
      useDeepLearning: false,
      ensembleMode: true,
      realTimeAnalysis: true,
    },
  },

  // 2. Risk Management Agent
  risk: {
    riskLevel: 'medium',
    maxDrawdown: 10,
    maxPositionSize: 5,
    stopLossPercent: 2,
    takeProfitPercent: 5,
    autoRebalance: true,
    notificationSettings: {
      onSignal: true,
      onAlert: true,
      onError: true,
    },
    advancedSettings: {
      dynamicPositionSizing: true,
      correlationAnalysis: true,
      portfolioHedging: false,
    },
  },

  // 3. Sentiment Analysis Agent
  sentiment: {
    sources: ['twitter', 'news', 'reddit'],
    sentimentThreshold: 60,
    timeWindow: '24h',
    languages: ['en'],
    autoTrading: false,
    notificationSettings: {
      onSignal: true,
      onAlert: true,
      onError: true,
    },
    advancedSettings: {
      useNLP: true,
      emotionDetection: true,
      influencerWeight: 1.5,
    },
  },

  // 4. Pattern Recognition Agent
  pattern: {
    patterns: ['head_shoulders', 'double_top', 'triangle', 'flag'],
    timeframes: ['4h', '1d'],
    minConfidence: 75,
    autoTrading: false,
    notificationSettings: {
      onSignal: true,
      onAlert: true,
      onError: true,
    },
    advancedSettings: {
      useHistoricalData: true,
      patternVariations: true,
    },
  },

  // 5. Price Prediction Agent
  price_prediction: {
    models: ['LSTM', 'ARIMA', 'Prophet'],
    predictionHorizon: '24h',
    confidence_threshold: 70,
    autoTrading: false,
    notificationSettings: {
      onSignal: true,
      onAlert: true,
      onError: true,
    },
    advancedSettings: {
      ensembleModels: true,
      retrainFrequency: 'daily',
    },
  },

  // 6-15: Add other agents with similar structure
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

/**
 * Normalize agent configuration by merging DB config with defaults
 * @param {string} agent_key - Agent identifier (e.g., 'technical', 'risk')
 * @param {object} rawConfig - Config from database (may be incomplete)
 * @returns {object} Complete config with all required fields
 */
function normalizeAgentConfig(agent_key, rawConfig = {}) {
  const defaults = AGENT_DEFAULTS[agent_key];
  
  if (!defaults) {
    console.warn(`⚠️  No defaults found for agent_key: ${agent_key}`);
    return rawConfig || {};
  }

  // Deep merge: defaults + rawConfig (rawConfig takes precedence)
  const normalized = {
    ...defaults,
    ...rawConfig,
    notificationSettings: {
      ...defaults.notificationSettings,
      ...(rawConfig.notificationSettings || {}),
    },
    advancedSettings: {
      ...defaults.advancedSettings,
      ...(rawConfig.advancedSettings || {}),
    },
  };

  return normalized;
}

/**
 * Get default config for an agent
 * @param {string} agent_key - Agent identifier
 * @returns {object} Default config
 */
function getAgentDefaults(agent_key) {
  return AGENT_DEFAULTS[agent_key] || {};
}

/**
 * Get list of all supported agent keys
 * @returns {string[]} Array of agent keys
 */
function getSupportedAgents() {
  return Object.keys(AGENT_DEFAULTS);
}

export {
  normalizeAgentConfig,
  getAgentDefaults,
  getSupportedAgents,
  AGENT_DEFAULTS,
};
