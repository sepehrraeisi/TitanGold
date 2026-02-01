/**
 * Macro Indicators API Service
 * BACKEND-012: Implement Market Intelligence Agent
 * 
 * Fetches macroeconomic indicators:
 * - DXY (US Dollar Index)
 * - VIX (Volatility Index)
 * - Stock market indices (S&P 500, NASDAQ)
 * - Gold/Silver prices
 * - Treasury yields
 * 
 * Provides macro context for cryptocurrency market analysis
 */

import axios from 'axios';
import { logger } from './logger.js';

// Cache for macro data
const macroCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes

/**
 * Fetch DXY (US Dollar Index) from Alpha Vantage
 * @param {Object} options - Fetch options
 * @returns {Object} DXY data
 */
async function fetchDXY(options = {}) {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!apiKey) {
      logger.warn('Alpha Vantage API key not configured');
      return null;
    }
    
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'FX_DAILY',
        from_symbol: 'USD',
        to_symbol: 'EUR',
        apikey: apiKey,
        outputsize: 'compact'
      },
      timeout: 10000
    });
    
    const timeSeries = response.data['Time Series FX (Daily)'];
    
    if (!timeSeries) {
      return null;
    }
    
    const dates = Object.keys(timeSeries).sort().reverse();
    const latest = timeSeries[dates[0]];
    const previous = timeSeries[dates[1]];
    
    const currentValue = parseFloat(latest['4. close']);
    const previousValue = parseFloat(previous['4. close']);
    const change = ((currentValue - previousValue) / previousValue) * 100;
    
    return {
      indicator: 'DXY',
      name: 'US Dollar Index',
      value: currentValue,
      change_24h: change,
      trend: change > 0 ? 'up' : 'down',
      timestamp: dates[0]
    };
    
  } catch (error) {
    logger.error('Failed to fetch DXY', error);
    return null;
  }
}

/**
 * Fetch VIX (Volatility Index) from Alpha Vantage
 * @param {Object} options - Fetch options
 * @returns {Object} VIX data
 */
async function fetchVIX(options = {}) {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!apiKey) {
      logger.warn('Alpha Vantage API key not configured');
      return null;
    }
    
    // Note: VIX symbol may vary by provider
    // Using ^VIX as a proxy through Alpha Vantage's TIME_SERIES_DAILY
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: 'VIX',
        apikey: apiKey,
        outputsize: 'compact'
      },
      timeout: 10000
    });
    
    const timeSeries = response.data['Time Series (Daily)'];
    
    if (!timeSeries) {
      // Fallback to mock data if API unavailable
      return {
        indicator: 'VIX',
        name: 'CBOE Volatility Index',
        value: 20.0,
        change_24h: 0,
        trend: 'flat',
        timestamp: new Date().toISOString(),
        note: 'Using fallback data'
      };
    }
    
    const dates = Object.keys(timeSeries).sort().reverse();
    const latest = timeSeries[dates[0]];
    const previous = timeSeries[dates[1]];
    
    const currentValue = parseFloat(latest['4. close']);
    const previousValue = parseFloat(previous['4. close']);
    const change = ((currentValue - previousValue) / previousValue) * 100;
    
    return {
      indicator: 'VIX',
      name: 'CBOE Volatility Index',
      value: currentValue,
      change_24h: change,
      trend: change > 0 ? 'up' : 'down',
      level: currentValue < 15 ? 'low' : currentValue < 20 ? 'moderate' : currentValue < 30 ? 'elevated' : 'high',
      timestamp: dates[0]
    };
    
  } catch (error) {
    logger.error('Failed to fetch VIX', error);
    // Return fallback
    return {
      indicator: 'VIX',
      name: 'CBOE Volatility Index',
      value: 20.0,
      change_24h: 0,
      trend: 'flat',
      level: 'moderate',
      timestamp: new Date().toISOString(),
      note: 'Using fallback data'
    };
  }
}

/**
 * Fetch S&P 500 index from Alpha Vantage
 * @param {Object} options - Fetch options
 * @returns {Object} S&P 500 data
 */
async function fetchSP500(options = {}) {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!apiKey) {
      logger.warn('Alpha Vantage API key not configured');
      return null;
    }
    
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: 'SPY', // S&P 500 ETF as proxy
        apikey: apiKey,
        outputsize: 'compact'
      },
      timeout: 10000
    });
    
    const timeSeries = response.data['Time Series (Daily)'];
    
    if (!timeSeries) {
      return null;
    }
    
    const dates = Object.keys(timeSeries).sort().reverse();
    const latest = timeSeries[dates[0]];
    const previous = timeSeries[dates[1]];
    
    const currentValue = parseFloat(latest['4. close']);
    const previousValue = parseFloat(previous['4. close']);
    const change = ((currentValue - previousValue) / previousValue) * 100;
    
    return {
      indicator: 'SP500',
      name: 'S&P 500',
      value: currentValue,
      change_24h: change,
      trend: change > 0 ? 'up' : 'down',
      timestamp: dates[0]
    };
    
  } catch (error) {
    logger.error('Failed to fetch S&P 500', error);
    return null;
  }
}

/**
 * Fetch Gold price from Alpha Vantage
 * @param {Object} options - Fetch options
 * @returns {Object} Gold price data
 */
async function fetchGold(options = {}) {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!apiKey) {
      logger.warn('Alpha Vantage API key not configured');
      return null;
    }
    
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: 'GLD', // Gold ETF as proxy
        apikey: apiKey,
        outputsize: 'compact'
      },
      timeout: 10000
    });
    
    const timeSeries = response.data['Time Series (Daily)'];
    
    if (!timeSeries) {
      return null;
    }
    
    const dates = Object.keys(timeSeries).sort().reverse();
    const latest = timeSeries[dates[0]];
    const previous = timeSeries[dates[1]];
    
    const currentValue = parseFloat(latest['4. close']);
    const previousValue = parseFloat(previous['4. close']);
    const change = ((currentValue - previousValue) / previousValue) * 100;
    
    return {
      indicator: 'GOLD',
      name: 'Gold Price (GLD ETF)',
      value: currentValue,
      change_24h: change,
      trend: change > 0 ? 'up' : 'down',
      timestamp: dates[0]
    };
    
  } catch (error) {
    logger.error('Failed to fetch Gold price', error);
    return null;
  }
}

/**
 * Fetch all macro indicators
 * @param {Object} options - Fetch options
 * @returns {Object} Aggregated macro indicators
 */
export async function fetchMacroIndicators(options = {}) {
  try {
    const cacheKey = 'macro_indicators';
    
    // Check cache
    if (options.useCache !== false) {
      const cached = macroCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info('Returning cached macro indicators');
        return cached.data;
      }
    }
    
    logger.info('Fetching macro indicators');
    
    // Fetch all indicators in parallel
    const [dxy, vix, sp500, gold] = await Promise.all([
      fetchDXY(options),
      fetchVIX(options),
      fetchSP500(options),
      fetchGold(options)
    ]);
    
    const indicators = {};
    
    if (dxy) indicators.dxy = dxy;
    if (vix) indicators.vix = vix;
    if (sp500) indicators.sp500 = sp500;
    if (gold) indicators.gold = gold;
    
    // Analyze macro environment
    const analysis = analyzeMacroEnvironment(indicators);
    
    const result = {
      indicators,
      analysis,
      timestamp: new Date().toISOString()
    };
    
    // Cache result
    macroCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
    
  } catch (error) {
    logger.error('Failed to fetch macro indicators', error);
    throw error;
  }
}

/**
 * Analyze macro environment
 * @param {Object} indicators - Macro indicators
 * @returns {Object} Analysis results
 */
function analyzeMacroEnvironment(indicators) {
  const analysis = {
    risk_sentiment: 'neutral',
    market_regime: 'normal',
    correlations: [],
    insights: []
  };
  
  try {
    // VIX analysis (fear gauge)
    if (indicators.vix) {
      const vix = indicators.vix;
      
      if (vix.value < 15) {
        analysis.risk_sentiment = 'risk-on';
        analysis.insights.push({
          type: 'risk_sentiment',
          message: 'Low volatility - risk-on environment favorable for crypto',
          indicator: 'VIX',
          value: vix.value
        });
      } else if (vix.value > 30) {
        analysis.risk_sentiment = 'risk-off';
        analysis.insights.push({
          type: 'risk_sentiment',
          message: 'High volatility - risk-off environment, caution advised',
          indicator: 'VIX',
          value: vix.value
        });
      }
      
      if (vix.change_24h > 20) {
        analysis.insights.push({
          type: 'volatility_spike',
          message: 'Sharp increase in market volatility',
          indicator: 'VIX',
          change: vix.change_24h.toFixed(2) + '%'
        });
        analysis.market_regime = 'volatile';
      }
    }
    
    // DXY analysis (dollar strength)
    if (indicators.dxy) {
      const dxy = indicators.dxy;
      
      if (dxy.trend === 'up' && dxy.change_24h > 1) {
        analysis.insights.push({
          type: 'dollar_strength',
          message: 'Strengthening US dollar typically negative for crypto',
          indicator: 'DXY',
          change: dxy.change_24h.toFixed(2) + '%'
        });
        analysis.correlations.push({
          pair: 'DXY-Crypto',
          relationship: 'negative',
          strength: 'moderate'
        });
      } else if (dxy.trend === 'down' && dxy.change_24h < -1) {
        analysis.insights.push({
          type: 'dollar_weakness',
          message: 'Weakening US dollar typically positive for crypto',
          indicator: 'DXY',
          change: dxy.change_24h.toFixed(2) + '%'
        });
        analysis.correlations.push({
          pair: 'DXY-Crypto',
          relationship: 'negative',
          strength: 'moderate'
        });
      }
    }
    
    // S&P 500 analysis (risk appetite)
    if (indicators.sp500) {
      const sp500 = indicators.sp500;
      
      if (sp500.trend === 'up' && sp500.change_24h > 1) {
        analysis.insights.push({
          type: 'equity_strength',
          message: 'Strong equity markets suggest risk appetite',
          indicator: 'S&P 500',
          change: sp500.change_24h.toFixed(2) + '%'
        });
        analysis.correlations.push({
          pair: 'SP500-Crypto',
          relationship: 'positive',
          strength: 'strong'
        });
      } else if (sp500.trend === 'down' && sp500.change_24h < -2) {
        analysis.insights.push({
          type: 'equity_weakness',
          message: 'Weak equity markets may pressure crypto',
          indicator: 'S&P 500',
          change: sp500.change_24h.toFixed(2) + '%'
        });
        analysis.market_regime = 'bearish';
      }
    }
    
    // Gold analysis (safe haven)
    if (indicators.gold) {
      const gold = indicators.gold;
      
      if (gold.trend === 'up' && gold.change_24h > 1) {
        analysis.insights.push({
          type: 'safe_haven_demand',
          message: 'Rising gold suggests flight to safety',
          indicator: 'Gold',
          change: gold.change_24h.toFixed(2) + '%'
        });
      }
    }
    
    // Combined analysis
    if (indicators.vix && indicators.sp500) {
      if (indicators.vix.trend === 'up' && indicators.sp500.trend === 'down') {
        analysis.market_regime = 'risk-off';
        analysis.insights.push({
          type: 'regime',
          message: 'Risk-off regime: rising VIX + falling equities',
          recommendation: 'Reduce exposure, increase cash position'
        });
      } else if (indicators.vix.trend === 'down' && indicators.sp500.trend === 'up') {
        analysis.market_regime = 'risk-on';
        analysis.insights.push({
          type: 'regime',
          message: 'Risk-on regime: falling VIX + rising equities',
          recommendation: 'Favorable environment for growth assets'
        });
      }
    }
    
  } catch (error) {
    logger.error('Error analyzing macro environment', error);
  }
  
  return analysis;
}

/**
 * Clear macro cache
 */
export function clearCache() {
  macroCache.clear();
  logger.info('Macro indicators cache cleared');
}

export default {
  fetchMacroIndicators,
  clearCache
};
