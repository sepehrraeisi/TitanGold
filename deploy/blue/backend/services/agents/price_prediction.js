/**
 * Price Prediction Agent
 * 
 * Predicts future cryptocurrency prices using statistical and ML models:
 * - Linear Regression: Simple trend-based predictions
 * - ARIMA: Autoregressive Integrated Moving Average for time series
 * - Hybrid: Ensemble of both methods for improved accuracy
 * 
 * Features:
 * - Multi-timeframe predictions (1h, 4h, 24h)
 * - Confidence intervals (95%)
 * - Model accuracy metrics (RMSE, MAE, MAPE, R²)
 * - Historical data training
 * - Real-time price predictions
 * 
 * @module agents/price_prediction
 */

import { logger } from '../logger.js';
import { predictPrices, trainModel, generateMockPredictions } from '../predictor.js';
import { mexcService } from '../mexc.js';

// Cache for storing trained models and predictions
const modelCache = new Map();
const predictionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Run price prediction analysis for a given symbol
 * @param {object} params - Agent parameters
 * @param {number} params.userId - User ID
 * @param {string} params.symbol - Trading symbol (e.g., 'BTC/USDT')
 * @param {string} params.timeframe - Timeframe for analysis (e.g., '1h', '4h', '1d')
 * @param {object} params.config - Configuration options
 * @returns {object} - Prediction results
 */
export async function run({ userId, symbol, timeframe = '1h', config = {} }) {
  const startTime = Date.now();
  logger.info('🤖 Price Prediction Agent started', { userId, symbol, timeframe });

  try {
    // Validate inputs
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    // Check cache first
    const cacheKey = `${symbol}_${timeframe}_${config.method || 'hybrid'}`;
    const cached = predictionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.info('📊 Returning cached prediction', { symbol, age: Date.now() - cached.timestamp });
      return {
        ...cached.data,
        from_cache: true,
        cache_age_ms: Date.now() - cached.timestamp
      };
    }

    // Fetch historical data from MEXC
    await mexcService.initializeExchange(userId);

    // Determine number of candles based on timeframe
    const candleCount = determineCandleCount(timeframe);
    
    logger.info('📈 Fetching historical data', { symbol, timeframe, candleCount });
    const ohlcv = await mexcService.fetchOHLCV(userId, symbol, timeframe, candleCount);

    if (!ohlcv || ohlcv.length < 30) {
      logger.warn('⚠️ Insufficient historical data, using mock predictions', {
        symbol,
        dataPoints: ohlcv ? ohlcv.length : 0
      });
      
      // Fallback to mock predictions
      const currentPrice = ohlcv && ohlcv.length > 0 ? ohlcv[ohlcv.length - 1][4] : 50000;
      return generateMockPredictions(currentPrice);
    }

    // Run predictions
    const method = config.method || 'hybrid';
    const predictionOptions = {
      method,
      arimaP: config.arimaP || 5,
      arimaD: config.arimaD || 1,
      arimaQ: config.arimaQ || 2
    };

    logger.info('🔮 Running price predictions', { method, options: predictionOptions });
    const predictions = predictPrices(ohlcv, predictionOptions);

    // Calculate additional insights
    const insights = generateInsights(predictions, ohlcv);
    
    // Prepare result
    const result = {
      agent_key: 'price_prediction',
      symbol,
      timeframe,
      current_price: predictions.current_price,
      predictions: predictions.predictions,
      method: predictions.method,
      accuracy: predictions.accuracy,
      insights,
      data_points: ohlcv.length,
      execution_time_ms: Date.now() - startTime,
      timestamp: predictions.timestamp,
      _meta: {
        version: '1.0.0',
        model: predictions.method,
        confidence: calculateOverallConfidence(predictions.predictions)
      }
    };

    // Cache the result
    predictionCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    // Clean old cache entries
    cleanCache();

    logger.info('✅ Price prediction completed', {
      symbol,
      method: predictions.method,
      executionTime: result.execution_time_ms,
      rmsePercent: predictions.accuracy.rmse_percent
    });

    return result;

  } catch (error) {
    logger.error('❌ Price Prediction Agent error', {
      error: error.message,
      stack: error.stack,
      symbol,
      userId
    });

    // Return error response with fallback mock data
    return {
      agent_key: 'price_prediction',
      symbol,
      timeframe,
      error: error.message,
      predictions: null,
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
 * Train model on historical data for a given symbol
 * @param {object} params - Training parameters
 * @returns {object} - Training results
 */
export async function trainModelForSymbol({ userId, symbol, timeframe = '1h', config = {} }) {
  const startTime = Date.now();
  logger.info('🎓 Training price prediction model', { userId, symbol, timeframe });

  try {
    // Fetch historical data
    await mexcService.initializeExchange(userId);

    // Fetch more data for training (500+ candles)
    const candleCount = 500;
    logger.info('📈 Fetching training data', { symbol, timeframe, candleCount });
    const ohlcv = await mexcService.fetchOHLCV(userId, symbol, timeframe, candleCount);

    if (!ohlcv || ohlcv.length < 50) {
      throw new Error(`Insufficient data for training (got ${ohlcv ? ohlcv.length : 0}, need at least 50)`);
    }

    // Train model
    const method = config.method || 'hybrid';
    const trainingOptions = {
      method,
      arimaP: config.arimaP || 5,
      arimaD: config.arimaD || 1,
      arimaQ: config.arimaQ || 2
    };

    logger.info('🏋️ Training models', { method, options: trainingOptions });
    const trainingResult = trainModel(ohlcv, trainingOptions);

    // Cache the trained model
    const cacheKey = `model_${symbol}_${timeframe}_${method}`;
    modelCache.set(cacheKey, {
      result: trainingResult,
      timestamp: Date.now(),
      config: trainingOptions
    });

    const result = {
      agent_key: 'price_prediction',
      action: 'train',
      symbol,
      timeframe,
      training_result: trainingResult,
      data_points: ohlcv.length,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    logger.info('✅ Model training completed', {
      symbol,
      method,
      bestModel: trainingResult.best_model,
      linearRMSE: trainingResult.models.linear.accuracy.rmse_percent,
      arimaRMSE: trainingResult.models.arima.accuracy.rmse_percent,
      executionTime: result.execution_time_ms
    });

    return result;

  } catch (error) {
    logger.error('❌ Model training error', {
      error: error.message,
      stack: error.stack,
      symbol,
      userId
    });

    return {
      agent_key: 'price_prediction',
      action: 'train',
      symbol,
      timeframe,
      error: error.message,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get agent details and metrics
 */
export async function getDetails({ userId }) {
  const cacheSize = predictionCache.size;
  const modelCacheSize = modelCache.size;

  // Calculate average confidence from recent predictions
  const recentPredictions = Array.from(predictionCache.values())
    .filter(cache => Date.now() - cache.timestamp < CACHE_TTL);
  
  const avgConfidence = recentPredictions.length > 0
    ? recentPredictions.reduce((sum, cache) => {
        const conf = cache.data._meta?.confidence || 0;
        return sum + conf;
      }, 0) / recentPredictions.length
    : 0;

  return {
    agent_key: 'price_prediction',
    name: 'Price Prediction Agent',
    description: 'Predicts future cryptocurrency prices using Linear Regression and ARIMA models',
    status: 'active',
    version: '1.0.0',
    capabilities: [
      'Linear Regression predictions',
      'ARIMA time series forecasting',
      'Hybrid ensemble predictions',
      'Multi-timeframe analysis (1h, 4h, 24h)',
      '95% confidence intervals',
      'Model accuracy metrics (RMSE, MAE, MAPE, R²)'
    ],
    metrics: {
      cached_predictions: cacheSize,
      cached_models: modelCacheSize,
      avg_confidence: Math.round(avgConfidence * 100) / 100,
      cache_ttl_ms: CACHE_TTL
    },
    lastRun: recentPredictions.length > 0 
      ? new Date(recentPredictions[0].timestamp).toISOString()
      : null
  };
}

/**
 * Get default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    method: 'hybrid', // 'linear', 'arima', or 'hybrid'
    arimaP: 5, // Autoregressive order
    arimaD: 1, // Differencing order
    arimaQ: 2, // Moving average order
    minDataPoints: 30,
    cacheEnabled: true,
    cacheTTL: CACHE_TTL
  };
}

// Helper functions

/**
 * Determine number of candles to fetch based on timeframe
 */
function determineCandleCount(timeframe) {
  const counts = {
    '1m': 500,
    '5m': 400,
    '15m': 300,
    '30m': 250,
    '1h': 200,
    '4h': 150,
    '1d': 100
  };
  return counts[timeframe] || 200;
}

/**
 * Generate trading insights from predictions
 */
function generateInsights(predictions, ohlcv) {
  const { current_price, predictions: preds } = predictions;
  const pred1h = preds['1h'];
  const pred4h = preds['4h'];
  const pred24h = preds['24h'];

  // Calculate price changes
  const change1h = ((pred1h.price - current_price) / current_price) * 100;
  const change4h = ((pred4h.price - current_price) / current_price) * 100;
  const change24h = ((pred24h.price - current_price) / current_price) * 100;

  // Determine trend
  let trend = 'neutral';
  if (change1h > 0.5 && change4h > 0.5 && change24h > 0.5) {
    trend = 'strong_bullish';
  } else if (change1h > 0 && change4h > 0) {
    trend = 'bullish';
  } else if (change1h < -0.5 && change4h < -0.5 && change24h < -0.5) {
    trend = 'strong_bearish';
  } else if (change1h < 0 && change4h < 0) {
    trend = 'bearish';
  }

  // Calculate volatility (standard deviation of recent prices)
  const closes = ohlcv.slice(-20).map(c => c[4]);
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / closes.length;
  const volatility = Math.sqrt(variance);
  const volatilityPercent = (volatility / current_price) * 100;

  // Risk assessment
  let riskLevel = 'low';
  if (volatilityPercent > 5) {
    riskLevel = 'high';
  } else if (volatilityPercent > 2) {
    riskLevel = 'medium';
  }

  // Trading recommendation
  let recommendation = 'hold';
  if (trend === 'strong_bullish' && pred1h.confidence > 0.7) {
    recommendation = 'strong_buy';
  } else if (trend === 'bullish' && pred1h.confidence > 0.6) {
    recommendation = 'buy';
  } else if (trend === 'strong_bearish' && pred1h.confidence > 0.7) {
    recommendation = 'strong_sell';
  } else if (trend === 'bearish' && pred1h.confidence > 0.6) {
    recommendation = 'sell';
  }

  return {
    trend,
    price_changes: {
      '1h': Math.round(change1h * 100) / 100,
      '4h': Math.round(change4h * 100) / 100,
      '24h': Math.round(change24h * 100) / 100
    },
    volatility: {
      value: Math.round(volatility * 100) / 100,
      percent: Math.round(volatilityPercent * 100) / 100
    },
    risk_level: riskLevel,
    recommendation,
    confidence_score: Math.round(pred1h.confidence * 100),
    summary: generateSummary(trend, recommendation, change1h, change24h)
  };
}

/**
 * Generate human-readable summary
 */
function generateSummary(trend, recommendation, change1h, change24h) {
  const trendDesc = {
    'strong_bullish': 'strongly bullish',
    'bullish': 'bullish',
    'neutral': 'neutral',
    'bearish': 'bearish',
    'strong_bearish': 'strongly bearish'
  }[trend];

  const change1hAbs = Math.abs(change1h).toFixed(2);
  const change24hAbs = Math.abs(change24h).toFixed(2);
  const direction1h = change1h > 0 ? 'up' : 'down';
  const direction24h = change24h > 0 ? 'up' : 'down';

  return `Market shows ${trendDesc} trend. Predicted ${direction1h} ${change1hAbs}% in 1h, ` +
         `${direction24h} ${change24hAbs}% in 24h. Recommendation: ${recommendation.toUpperCase()}.`;
}

/**
 * Calculate overall confidence from predictions
 */
function calculateOverallConfidence(predictions) {
  const confidences = Object.values(predictions).map(p => p.confidence);
  return confidences.reduce((a, b) => a + b, 0) / confidences.length;
}

/**
 * Clean old cache entries
 */
function cleanCache() {
  const now = Date.now();
  
  // Clean prediction cache
  for (const [key, value] of predictionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      predictionCache.delete(key);
    }
  }
  
  // Clean model cache
  for (const [key, value] of modelCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 10) { // Keep models longer
      modelCache.delete(key);
    }
  }
}

export default {
  run,
  trainModelForSymbol,
  getDetails,
  defaultConfig
};
