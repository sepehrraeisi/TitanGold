/**
 * Normalize Fundamental Agent Configuration
 * Ensures all fields exist to prevent UI crashes
 */

export function getDefaultConfig() {
  return {
    enabled: true,
    symbols: ['BTCUSDT', 'ETHUSDT'],
    dataSources: {
      macro: true,
      funding: true,
      onchain: true,
      news: true
    },
    thresholds: {
      buyScore: 70,
      sellScore: 30,
      minConfidence: 0.6
    },
    weights: {
      macro: 0.3,
      funding: 0.2,
      onchain: 0.3,
      news: 0.2
    },
    alerts: {
      enabled: true,
      onScoreChange: true,
      onFairValueDeviation: true
    },
    outputType: 'rating', // 'rating' | 'buy_sell' | 'score'
    autoRefresh: false,
    refreshIntervalMinutes: 60,
    
    // Integration settings
    integrations: {
      artemisCore: true,
      syncWithPricePrediction: true,
      syncWithPortfolio: true,
      syncWithRisk: true,
      forwardToDashboard: true
    },
    
    // Alert channels
    alertChannels: {
      dashboard: true,
      email: false,
      telegram: false,
      discord: false
    }
  };
}

/**
 * Normalize fundamental config to ensure all fields exist
 */
export function normalizeFundamentalConfig(rawConfig) {
  const defaultConfig = getDefaultConfig();
  
  if (!rawConfig || typeof rawConfig !== 'object') {
    return defaultConfig;
  }
  
  return {
    enabled: typeof rawConfig.enabled === 'boolean' ? rawConfig.enabled : defaultConfig.enabled,
    symbols: Array.isArray(rawConfig.symbols) && rawConfig.symbols.length > 0 
      ? rawConfig.symbols 
      : defaultConfig.symbols,
    
    dataSources: {
      macro: typeof rawConfig.dataSources?.macro === 'boolean' 
        ? rawConfig.dataSources.macro 
        : defaultConfig.dataSources.macro,
      funding: typeof rawConfig.dataSources?.funding === 'boolean' 
        ? rawConfig.dataSources.funding 
        : defaultConfig.dataSources.funding,
      onchain: typeof rawConfig.dataSources?.onchain === 'boolean' 
        ? rawConfig.dataSources.onchain 
        : defaultConfig.dataSources.onchain,
      news: typeof rawConfig.dataSources?.news === 'boolean' 
        ? rawConfig.dataSources.news 
        : defaultConfig.dataSources.news
    },
    
    thresholds: {
      buyScore: typeof rawConfig.thresholds?.buyScore === 'number' 
        ? rawConfig.thresholds.buyScore 
        : defaultConfig.thresholds.buyScore,
      sellScore: typeof rawConfig.thresholds?.sellScore === 'number' 
        ? rawConfig.thresholds.sellScore 
        : defaultConfig.thresholds.sellScore,
      minConfidence: typeof rawConfig.thresholds?.minConfidence === 'number' 
        ? rawConfig.thresholds.minConfidence 
        : defaultConfig.thresholds.minConfidence
    },
    
    weights: {
      macro: typeof rawConfig.weights?.macro === 'number' 
        ? rawConfig.weights.macro 
        : defaultConfig.weights.macro,
      funding: typeof rawConfig.weights?.funding === 'number' 
        ? rawConfig.weights.funding 
        : defaultConfig.weights.funding,
      onchain: typeof rawConfig.weights?.onchain === 'number' 
        ? rawConfig.weights.onchain 
        : defaultConfig.weights.onchain,
      news: typeof rawConfig.weights?.news === 'number' 
        ? rawConfig.weights.news 
        : defaultConfig.weights.news
    },
    
    alerts: {
      enabled: typeof rawConfig.alerts?.enabled === 'boolean' 
        ? rawConfig.alerts.enabled 
        : defaultConfig.alerts.enabled,
      onScoreChange: typeof rawConfig.alerts?.onScoreChange === 'boolean' 
        ? rawConfig.alerts.onScoreChange 
        : defaultConfig.alerts.onScoreChange,
      onFairValueDeviation: typeof rawConfig.alerts?.onFairValueDeviation === 'boolean' 
        ? rawConfig.alerts.onFairValueDeviation 
        : defaultConfig.alerts.onFairValueDeviation
    },
    
    outputType: ['rating', 'buy_sell', 'score'].includes(rawConfig.outputType) 
      ? rawConfig.outputType 
      : defaultConfig.outputType,
      
    autoRefresh: typeof rawConfig.autoRefresh === 'boolean' 
      ? rawConfig.autoRefresh 
      : defaultConfig.autoRefresh,
      
    refreshIntervalMinutes: typeof rawConfig.refreshIntervalMinutes === 'number' 
      ? rawConfig.refreshIntervalMinutes 
      : defaultConfig.refreshIntervalMinutes,
    
    // Integration settings
    integrations: {
      artemisCore: typeof rawConfig.integrations?.artemisCore === 'boolean'
        ? rawConfig.integrations.artemisCore
        : defaultConfig.integrations.artemisCore,
      syncWithPricePrediction: typeof rawConfig.integrations?.syncWithPricePrediction === 'boolean'
        ? rawConfig.integrations.syncWithPricePrediction
        : defaultConfig.integrations.syncWithPricePrediction,
      syncWithPortfolio: typeof rawConfig.integrations?.syncWithPortfolio === 'boolean'
        ? rawConfig.integrations.syncWithPortfolio
        : defaultConfig.integrations.syncWithPortfolio,
      syncWithRisk: typeof rawConfig.integrations?.syncWithRisk === 'boolean'
        ? rawConfig.integrations.syncWithRisk
        : defaultConfig.integrations.syncWithRisk,
      forwardToDashboard: typeof rawConfig.integrations?.forwardToDashboard === 'boolean'
        ? rawConfig.integrations.forwardToDashboard
        : defaultConfig.integrations.forwardToDashboard
    },
    
    // Alert channels
    alertChannels: {
      dashboard: typeof rawConfig.alertChannels?.dashboard === 'boolean'
        ? rawConfig.alertChannels.dashboard
        : defaultConfig.alertChannels.dashboard,
      email: typeof rawConfig.alertChannels?.email === 'boolean'
        ? rawConfig.alertChannels.email
        : defaultConfig.alertChannels.email,
      telegram: typeof rawConfig.alertChannels?.telegram === 'boolean'
        ? rawConfig.alertChannels.telegram
        : defaultConfig.alertChannels.telegram,
      discord: typeof rawConfig.alertChannels?.discord === 'boolean'
        ? rawConfig.alertChannels.discord
        : defaultConfig.alertChannels.discord
    }
  };
}

export default { normalizeFundamentalConfig, getDefaultConfig };
