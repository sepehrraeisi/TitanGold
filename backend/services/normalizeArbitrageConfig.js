// Normalize arbitrage config for UI compatibility
// Converts simple config to full UI-expected format

/**
 * Normalize exchanges array
 * Converts: ["mexc"] → [{id: "mexc", name: "MEXC", markets: ["spot"], ...}]
 */
function normalizeExchanges(exchanges) {
  if (!exchanges || !Array.isArray(exchanges)) {
    return [];
  }
  
  return exchanges.map(ex => {
    // If already an object, return as-is
    if (typeof ex === 'object' && ex !== null) {
      return {
        id: ex.id || 'unknown',
        name: ex.name || ex.id?.toUpperCase() || 'Unknown',
        markets: Array.isArray(ex.markets) ? ex.markets : ['spot'],
        enabled: ex.enabled !== undefined ? ex.enabled : true,
        tradingFeeBps: ex.tradingFeeBps || 10,
        latencyMs: ex.latencyMs || 50
      };
    }
    
    // If string, convert to object
    if (typeof ex === 'string') {
      const exchangeDefaults = {
        'mexc': { name: 'MEXC', markets: ['spot', 'futures'], latencyMs: 50 },
        'binance': { name: 'Binance', markets: ['spot', 'futures'], latencyMs: 30 },
        'okx': { name: 'OKX', markets: ['spot', 'futures'], latencyMs: 40 },
      };
      
      const defaults = exchangeDefaults[ex.toLowerCase()] || {
        name: ex.toUpperCase(),
        markets: ['spot'],
        latencyMs: 100
      };
      
      return {
        id: ex.toLowerCase(),
        name: defaults.name,
        markets: defaults.markets,
        enabled: true,
        tradingFeeBps: 10,
        latencyMs: defaults.latencyMs
      };
    }
    
    return null;
  }).filter(Boolean);
}

/**
 * Normalize strategies array
 */
function normalizeStrategies(strategies) {
  if (!strategies || !Array.isArray(strategies)) {
    return [
      {
        type: 'spot',
        enabled: true,
        minProfitBps: 20,
        maxSlippageBps: 10,
        maxExposureUSDT: 10000
      },
      {
        type: 'triangle',
        enabled: false,
        minProfitBps: 30,
        maxSlippageBps: 15,
        maxExposureUSDT: 5000
      },
      {
        type: 'cross_exchange',
        enabled: false,
        minProfitBps: 50,
        maxSlippageBps: 20,
        maxExposureUSDT: 8000
      }
    ];
  }
  
  // Ensure each strategy has all required fields
  return strategies.map(s => ({
    type: s.type || 'spot',
    enabled: s.enabled !== undefined ? s.enabled : true,
    minProfitBps: s.minProfitBps || 20,
    maxSlippageBps: s.maxSlippageBps || 10,
    maxExposureUSDT: s.maxExposureUSDT || 10000
  }));
}

/**
 * Main normalization function
 */
export function normalizeArbitrageConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return getDefaultConfig();
  }
  
  return {
    // Basic settings
    enabled: rawConfig.enabled !== undefined ? rawConfig.enabled : true,
    mode: rawConfig.mode || 'spot',
    autoTrade: rawConfig.autoTrade || false,
    
    // Exchanges (normalize from simple array to full objects)
    exchanges: normalizeExchanges(rawConfig.exchanges),
    
    // Symbols
    symbols: Array.isArray(rawConfig.symbols) ? rawConfig.symbols : ['BTCUSDT', 'ETHUSDT'],
    
    // Spread thresholds
    minSpreadPct: rawConfig.minSpreadPct !== undefined ? rawConfig.minSpreadPct : 0.20,
    maxSpreadPct: rawConfig.maxSpreadPct !== undefined ? rawConfig.maxSpreadPct : 5.00,
    
    // Volume
    minVolumeUSDT: rawConfig.minVolumeUSDT || 100000,
    
    // Fees and slippage
    feeBps: rawConfig.feeBps || 10,
    slippageBps: rawConfig.slippageBps || 10,
    
    // Orderbook
    orderbookDepth: rawConfig.orderbookDepth || 20,
    
    // Scanning
    scanIntervalSec: rawConfig.scanIntervalSec || 10,
    
    // Risk management
    maxRiskPerTrade: rawConfig.maxRiskPerTrade || 0.02,
    stopLossDefault: rawConfig.stopLossDefault || 0.015,
    
    // Execution
    maxSimultaneousTrades: rawConfig.maxSimultaneousTrades || 3,
    executionTimeoutSec: rawConfig.executionTimeoutSec || 30,
    
    // Strategies (with defaults if missing)
    strategies: normalizeStrategies(rawConfig.strategies),
    
    // Integration settings
    integrationSettings: rawConfig.integrationSettings || {
      shareWithRisk: true,
      shareWithPortfolio: false,
      forwardToArtemis: true,
      triggerMode: 'auto'
    },
    
    // Notifications
    notifications: rawConfig.notifications || {
      immediate: true,
      dashboardOnly: false,
      channels: {
        email: true,
        telegram: false,
        discord: false
      }
    },
    
    // Thresholds
    opportunityThresholdBps: rawConfig.opportunityThresholdBps || 20,
    detectionSensitivity: rawConfig.detectionSensitivity || 'balanced',
    
    // Execution settings
    execution: rawConfig.execution || {
      autoExecute: false,
      preferSpeed: true,
      capitalPerTradeUSDT: 1000,
      maxConcurrent: 3,
      maxDailyExecutions: 10
    },
    
    // Risk controls
    riskControls: rawConfig.riskControls || {
      maxLatencyMs: 500,
      maxTransferMinutes: 30,
      minDepthUSD: 10000,
      riskLimitUSDT: 5000
    },
    
    // Settlement
    settlement: rawConfig.settlement || {
      maxTransfersPerDay: 5
    },
    
    // Auto actions
    autoActions: rawConfig.autoActions || {
      notifyOnOpportunity: true,
      simulateRoutes: false,
      pauseOnHighLatency: true
    }
  };
}

/**
 * Get default config
 */
export function getDefaultConfig() {
  return {
    enabled: true,
    mode: 'spot',
    autoTrade: false,
    exchanges: [
      {
        id: 'mexc',
        name: 'MEXC',
        markets: ['spot', 'futures'],
        enabled: true,
        tradingFeeBps: 10,
        latencyMs: 50
      }
    ],
    symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'],
    minSpreadPct: 0.20,
    maxSpreadPct: 5.00,
    minVolumeUSDT: 100000,
    feeBps: 10,
    slippageBps: 10,
    orderbookDepth: 20,
    scanIntervalSec: 10,
    maxRiskPerTrade: 0.02,
    stopLossDefault: 0.015,
    maxSimultaneousTrades: 3,
    executionTimeoutSec: 30,
    strategies: [
      { type: 'spot', enabled: true, minProfitBps: 20, maxSlippageBps: 10, maxExposureUSDT: 10000 },
      { type: 'triangle', enabled: false, minProfitBps: 30, maxSlippageBps: 15, maxExposureUSDT: 5000 },
      { type: 'cross_exchange', enabled: false, minProfitBps: 50, maxSlippageBps: 20, maxExposureUSDT: 8000 }
    ],
    integrationSettings: {
      shareWithRisk: true,
      shareWithPortfolio: false,
      forwardToArtemis: true,
      triggerMode: 'auto'
    },
    notifications: {
      immediate: true,
      dashboardOnly: false,
      channels: {
        email: true,
        telegram: false,
        discord: false
      }
    },
    opportunityThresholdBps: 20,
    detectionSensitivity: 'balanced',
    execution: {
      autoExecute: false,
      preferSpeed: true,
      capitalPerTradeUSDT: 1000,
      maxConcurrent: 3,
      maxDailyExecutions: 10
    },
    riskControls: {
      maxLatencyMs: 500,
      maxTransferMinutes: 30,
      minDepthUSD: 10000,
      riskLimitUSDT: 5000
    },
    settlement: {
      maxTransfersPerDay: 5
    },
    autoActions: {
      notifyOnOpportunity: true,
      simulateRoutes: false,
      pauseOnHighLatency: true
    }
  };
}

export default { normalizeArbitrageConfig, getDefaultConfig };
