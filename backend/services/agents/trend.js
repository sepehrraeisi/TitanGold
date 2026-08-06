/**
 * Trend Detection Agent
 * BACKEND-009: Implement Trend Detection Agent
 * 
 * Provides comprehensive trend analysis using technical indicators:
 * - ADX (Average Directional Index) for trend strength
 * - Moving Averages (SMA, EMA) for trend confirmation
 * - Trend Lines (Support/Resistance) identification
 * - Reversal signals detection
 * - Trend direction and strength classification
 */

import { logger } from '../logger.js';
import { analyzeTrend, calculateSMA, calculateEMA, calculateADX } from '../trendAnalyzer.js';
import { mexcService } from '../mexc.js';
import { classifyAdxStrength } from '../trendDomain.js';

const CHART_SERIES_POINTS = 60;

function buildChartSeries(ohlcv, { smaPeriod, emaPeriod, adxPeriod, maxPoints = CHART_SERIES_POINTS }) {
  const closes = ohlcv.map((c) => c[4]);
  const smaAll = calculateSMA(closes, smaPeriod);
  const emaAll = calculateEMA(closes, emaPeriod);
  const adxData = calculateADX(ohlcv, adxPeriod);
  const adxValues = adxData.values || [];
  const n = Math.min(maxPoints, ohlcv.length);
  const startIdx = ohlcv.length - n;
  const points = [];

  for (let i = startIdx; i < ohlcv.length; i++) {
    const smaVal = i >= smaPeriod - 1 ? smaAll[i - smaPeriod + 1] : null;
    const emaVal = i >= emaPeriod ? emaAll[i - emaPeriod] : null;
    const adxOffset = ohlcv.length - adxValues.length;
    const adxVal = i >= adxOffset ? adxValues[i - adxOffset] : null;
    points.push({
      t: ohlcv[i][0],
      close: Math.round(closes[i] * 100) / 100,
      sma: smaVal != null ? Math.round(smaVal * 100) / 100 : null,
      ema: emaVal != null ? Math.round(emaVal * 100) / 100 : null,
      adx: adxVal != null ? Math.round(adxVal * 100) / 100 : null,
    });
  }

  return { points, smaPeriod, emaPeriod, adxPeriod };
}

function buildSummaryKey(direction, strength) {
  const dir = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'sideways';
  const str = ['weak', 'moderate', 'strong', 'developing'].includes(strength) ? strength : 'weak';
  return `trend_summary_${dir}_${str}`;
}

// Cache for storing trend analysis results
const analysisCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Run trend detection analysis
 * @param {Object} params - Agent parameters
 * @returns {Object} Trend analysis results
 */
export async function run({ userId, symbol, timeframe = '1h', config = {} }) {
  const startTime = Date.now();
  logger.info('🤖 Trend Detection Agent started', { userId, symbol, timeframe });

  try {
    // Validate inputs
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    // Extract configuration
    const {
      adxPeriod = 14,
      smaPeriod = 50,
      emaPeriod = 20,
      trendLineLookback = 20,
      candleCount = 200
    } = config;

    // Check cache first
    const cacheKey = `${symbol}_${timeframe}_${adxPeriod}_${smaPeriod}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.info('📊 Returning cached trend analysis', { symbol, age: Date.now() - cached.timestamp });
      return {
        ...cached.data,
        from_cache: true,
        cache_age_ms: Date.now() - cached.timestamp
      };
    }

    // Public OHLCV only — credential-free ccxt path (no legacy initializeExchange)
    logger.info('📈 Fetching historical data', { symbol, timeframe, candleCount });
    const ohlcv = await mexcService.fetchOHLCV(null, symbol, timeframe, candleCount);

    if (!ohlcv || ohlcv.length < Math.max(adxPeriod, smaPeriod, emaPeriod, trendLineLookback) + 10) {
      throw new Error(`Insufficient historical data (got ${ohlcv ? ohlcv.length : 0}, need at least ${Math.max(adxPeriod, smaPeriod, emaPeriod, trendLineLookback) + 10})`);
    }

    // Run trend analysis
    logger.info('🔍 Running trend analysis', { adxPeriod, smaPeriod, emaPeriod });
    const analysis = analyzeTrend(ohlcv, {
      adxPeriod,
      smaPeriod,
      emaPeriod,
      trendLineLookback
    });

    // Prepare result
    const currentPrice = ohlcv[ohlcv.length - 1][4];
    const lastCandleMs = ohlcv[ohlcv.length - 1][0];
    const canonicalAdxStrength = classifyAdxStrength(analysis.adx.value) || analysis.adx.strength;
    const result = {
      agent_key: 'trend_detection',
      symbol,
      timeframe,
      current_price: currentPrice,
      last_candle_timestamp: new Date(lastCandleMs).toISOString(),
      
      adx: {
        value: Math.round(analysis.adx.value * 100) / 100,
        di_plus: Math.round(analysis.adx.diPlus * 100) / 100,
        di_minus: Math.round(analysis.adx.diMinus * 100) / 100,
        strength: canonicalAdxStrength,
        interpretation: null,
      },
      
      trend: {
        direction: analysis.trend.direction,
        strength: analysis.trend.strength,
        confidence: Math.round(analysis.trend.confidence * 100),
        description: describeTrend(analysis.trend.direction, analysis.trend.strength),
        descriptionKey: buildSummaryKey(analysis.trend.direction, analysis.trend.strength),
      },
      
      moving_averages: {
        sma_50: {
          value: Math.round(analysis.movingAverages.sma.value * 100) / 100,
          position: currentPrice > analysis.movingAverages.sma.value ? 'above' : 'below',
          distance_percent: calculateDistancePercent(currentPrice, analysis.movingAverages.sma.value)
        },
        ema_20: {
          value: Math.round(analysis.movingAverages.ema.value * 100) / 100,
          position: currentPrice > analysis.movingAverages.ema.value ? 'above' : 'below',
          distance_percent: calculateDistancePercent(currentPrice, analysis.movingAverages.ema.value)
        },
        alignment: analysis.movingAverages.position,
        signal: generateMASignal(currentPrice, analysis.movingAverages)
      },
      
      trend_lines: {
        support: analysis.trendLines.support ? {
          current_level: Math.round(analysis.trendLines.support.current * 100) / 100,
          slope: analysis.trendLines.support.slope > 0 ? 'rising' : 'falling',
          distance_percent: calculateDistancePercent(currentPrice, analysis.trendLines.support.current)
        } : null,
        resistance: analysis.trendLines.resistance ? {
          current_level: Math.round(analysis.trendLines.resistance.current * 100) / 100,
          slope: analysis.trendLines.resistance.slope > 0 ? 'rising' : 'falling',
          distance_percent: calculateDistancePercent(currentPrice, analysis.trendLines.resistance.current)
        } : null,
        pivots_count: analysis.trendLines.pivots.length
      },
      
      reversal_signals: analysis.reversalSignals.map(signal => ({
        type: signal.type,
        description: signal.description,
        strength: signal.strength,
        confidence: Math.round(signal.confidence * 100),
        level: signal.level || null
      })),
      
      trading_recommendation: generateTradingRecommendation(analysis),
      
      summary: analysis.summary,
      summary_key: buildSummaryKey(analysis.trend.direction, analysis.trend.strength),
      chart_series: buildChartSeries(ohlcv, { smaPeriod, emaPeriod, adxPeriod }),
      
      data_points: ohlcv.length,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      
      _meta: {
        version: '1.0.0',
        indicators: ['ADX', 'SMA', 'EMA', 'TrendLines'],
        confidence: analysis.trend.confidence
      }
    };

    // Cache the result
    analysisCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    // Clean old cache entries
    cleanCache();

    logger.info('✅ Trend detection completed', {
      symbol,
      direction: analysis.trend.direction,
      strength: analysis.trend.strength,
      adx: analysis.adx.value,
      executionTime: result.execution_time_ms
    });

    return result;

  } catch (error) {
    logger.error('❌ Trend Detection Agent error', {
      error: error.message,
      stack: error.stack,
      symbol,
      userId
    });

    return {
      agent_key: 'trend_detection',
      symbol,
      timeframe,
      error: error.message,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      _meta: {
        version: '1.0.0',
        status: 'error'
      }
    };
  }
}

/**
 * Get agent details and metrics
 */
export async function getDetails({ userId }) {
  const cacheSize = analysisCache.size;

  // Calculate average metrics from recent analyses
  const recentAnalyses = Array.from(analysisCache.values())
    .filter(cache => Date.now() - cache.timestamp < CACHE_TTL);

  const avgADX = recentAnalyses.length > 0
    ? recentAnalyses.reduce((sum, cache) => sum + (cache.data.adx?.value || 0), 0) / recentAnalyses.length
    : 0;

  return {
    agent_key: 'trend_detection',
    name: 'Trend Detection Agent',
    description: 'Detects market trends using ADX, moving averages, and trend lines to identify direction, strength, and potential reversals',
    status: 'active',
    version: '1.0.0',
    capabilities: [
      'ADX (Average Directional Index) calculation',
      'Trend strength classification (weak/moderate/strong)',
      'Trend direction identification (up/down/sideways)',
      'Moving averages (SMA 50, EMA 20)',
      'Support and resistance trend lines',
      'Reversal signal detection',
      'Trading recommendations'
    ],
    indicators: [
      { name: 'ADX', period: 14, description: 'Measures trend strength' },
      { name: 'DI+/DI-', description: 'Directional indicators for trend direction' },
      { name: 'SMA', period: 50, description: 'Simple moving average for trend confirmation' },
      { name: 'EMA', period: 20, description: 'Exponential moving average for dynamic support/resistance' },
      { name: 'Trend Lines', description: 'Support and resistance levels from pivot points' }
    ],
    metrics: {
      cached_analyses: cacheSize,
      avg_adx: Math.round(avgADX * 100) / 100,
      cache_ttl_ms: CACHE_TTL
    },
    lastRun: recentAnalyses.length > 0
      ? new Date(recentAnalyses[0].timestamp).toISOString()
      : null
  };
}

/**
 * Get default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    adxPeriod: 14,        // Standard ADX period
    smaPeriod: 50,        // 50-period SMA for medium-term trend
    emaPeriod: 20,        // 20-period EMA for short-term trend
    trendLineLookback: 20, // Lookback period for pivot points
    candleCount: 200,      // Number of candles to fetch
    cacheEnabled: true,
    cacheTTL: CACHE_TTL
  };
}

// Helper functions

/**
 * Interpret ADX value
 */
function interpretADX(adx, strength) {
  if (adx === null) return 'ADX unavailable';
  
  const interpretations = {
    'weak': `Weak trend (ADX ${Math.round(adx)}). Market is likely ranging or consolidating.`,
    'moderate': `Moderate trend (ADX ${Math.round(adx)}). Trend is developing with reasonable strength.`,
    'strong': `Strong trend (ADX ${Math.round(adx)}). Well-established trend with high momentum.`
  };
  
  return interpretations[strength] || 'Unknown trend strength';
}

/**
 * Describe trend
 */
function describeTrend(direction, strength) {
  const descriptions = {
    'up_weak': 'Weak uptrend - price moving higher but with limited conviction',
    'up_moderate': 'Moderate uptrend - clear bullish momentum',
    'up_strong': 'Strong uptrend - powerful bullish movement',
    'down_weak': 'Weak downtrend - price declining but with low conviction',
    'down_moderate': 'Moderate downtrend - clear bearish momentum',
    'down_strong': 'Strong downtrend - powerful bearish movement',
    'sideways_weak': 'Range-bound market - no clear directional bias',
    'sideways_moderate': 'Consolidation phase - market building energy',
    'sideways_strong': 'Strong consolidation - tight range with high activity'
  };
  
  const key = `${direction}_${strength}`;
  return descriptions[key] || `${direction} trend with ${strength} strength`;
}

/**
 * Calculate distance percentage
 */
function calculateDistancePercent(price, level) {
  if (!level) return null;
  return Math.round(((price - level) / level) * 10000) / 100;
}

/**
 * Generate moving average signal
 */
function generateMASignal(price, ma) {
  const { sma, ema, position } = ma;

  if (position === 'above_both') {
    return {
      signal: 'bullish',
      description: 'Price above both MAs - bullish alignment',
      interpretationKey: 'trend_ma_bullish_alignment',
    };
  }
  if (position === 'below_both') {
    return {
      signal: 'bearish',
      description: 'Price below both MAs - bearish alignment',
      interpretationKey: 'trend_ma_bearish_alignment',
    };
  }
  if (position === 'between') {
    if (ema.value > sma.value) {
      return {
        signal: 'neutral_bullish',
        description: 'Mixed signals, slight bullish bias',
        interpretationKey: 'trend_ma_neutral_bullish',
      };
    }
    return {
      signal: 'neutral_bearish',
      description: 'Mixed signals, slight bearish bias',
      interpretationKey: 'trend_ma_neutral_bearish',
    };
  }

  return { signal: 'neutral', description: 'No clear MA signal', interpretationKey: 'trend_ma_neutral' };
}

/**
 * Generate trading recommendation
 */
function generateTradingRecommendation(analysis) {
  const { trend, adx, reversalSignals, movingAverages } = analysis;
  
  let recommendation = 'HOLD';
  let confidence = 50;
  let reasoning = [];
  
  // Strong uptrend with good ADX
  if (trend.direction === 'up' && trend.strength === 'strong' && adx.value > 25) {
    recommendation = 'BUY';
    confidence = 75;
    reasoning.push('Strong uptrend confirmed by ADX');
  } else if (trend.direction === 'up' && trend.strength === 'moderate') {
    recommendation = 'BUY';
    confidence = 65;
    reasoning.push('Moderate uptrend developing');
  }
  
  // Strong downtrend with good ADX
  if (trend.direction === 'down' && trend.strength === 'strong' && adx.value > 25) {
    recommendation = 'SELL';
    confidence = 75;
    reasoning.push('Strong downtrend confirmed by ADX');
  } else if (trend.direction === 'down' && trend.strength === 'moderate') {
    recommendation = 'SELL';
    confidence = 65;
    reasoning.push('Moderate downtrend developing');
  }
  
  // Sideways market
  if (trend.direction === 'sideways') {
    recommendation = 'HOLD';
    confidence = 60;
    reasoning.push('Sideways market - wait for breakout');
  }
  
  // Check reversal signals
  const bullishReversals = reversalSignals.filter(s => 
    s.type === 'bullish_crossover' || s.type === 'support_bounce'
  );
  const bearishReversals = reversalSignals.filter(s => 
    s.type === 'bearish_crossover' || s.type === 'resistance_rejection'
  );
  
  if (bullishReversals.length > 0 && recommendation !== 'BUY') {
    recommendation = 'BUY';
    confidence = Math.min(confidence + 10, 80);
    reasoning.push('Bullish reversal signals detected');
  }
  
  if (bearishReversals.length > 0 && recommendation !== 'SELL') {
    recommendation = 'SELL';
    confidence = Math.min(confidence + 10, 80);
    reasoning.push('Bearish reversal signals detected');
  }
  
  // Moving average confirmation
  if (movingAverages.position === 'above_both' && recommendation === 'BUY') {
    confidence = Math.min(confidence + 5, 85);
    reasoning.push('Price above key moving averages');
  } else if (movingAverages.position === 'below_both' && recommendation === 'SELL') {
    confidence = Math.min(confidence + 5, 85);
    reasoning.push('Price below key moving averages');
  }
  
  return {
    action: recommendation,
    confidence,
    reasoning: reasoning.join('. ')
  };
}

/**
 * Clean old cache entries
 */
function cleanCache() {
  const now = Date.now();
  
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      analysisCache.delete(key);
    }
  }
}

export default {
  run,
  getDetails,
  defaultConfig
};
