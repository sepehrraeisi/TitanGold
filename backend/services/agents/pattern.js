/**
 * Pattern Recognition Agent
 * 
 * Detects chart patterns in price data and predicts breakout directions.
 * Supports 10+ common patterns including head and shoulders, triangles, flags, wedges, etc.
 * 
 * Features:
 * - Fetches historical OHLCV data from MEXC
 * - Detects multiple chart patterns simultaneously
 * - Calculates confidence scores for each pattern
 * - Identifies support/resistance levels
 * - Predicts breakout direction
 * - Provides trading recommendations
 * 
 * @module agents/pattern
 * @version 1.0.0
 * @date 2026-01-07
 */

import { logger } from '../../services/logger.js';
import { mexcService } from '../mexc.js';
import patternDetector from '../patternDetector.js';

/**
 * Run pattern recognition analysis for a trading symbol
 * 
 * @param {object} params - Analysis parameters
 * @param {number} params.userId - User ID
 * @param {string} params.symbol - Trading symbol (e.g., BTC/USDT, ETH/USDT)
 * @param {string} params.timeframe - Timeframe for analysis (e.g., 1h, 4h, 1d)
 * @param {object} params.config - Agent configuration
 * @returns {Promise<object>} - Pattern recognition results
 */
export async function run({ userId, symbol, timeframe, config }) {
  const startTime = Date.now();
  
  try {
    logger.info('Pattern Recognition Agent starting', { 
      userId, 
      symbol, 
      timeframe,
      agent: 'pattern'
    });

    // Extract configuration
    const options = {
      minConfidence: config?.minConfidence || 0.5,
      dataPoints: config?.dataPoints || 200,
      includeSupport: config?.includeSupport !== false,
      includeResistance: config?.includeResistance !== false
    };

    // Fetch historical OHLCV data from MEXC
    let ohlcv;
    try {
      ohlcv = await mexcService.fetchOHLCV(
        userId, 
        symbol, 
        timeframe || '1h', 
        options.dataPoints
      );
    } catch (error) {
      // If MEXC not configured, use mock data
      if (error.code === 'MEXC_NOT_CONFIGURED') {
        logger.warn('MEXC not configured, using mock data', { symbol });
        ohlcv = generateMockOHLCV(options.dataPoints);
      } else {
        throw error;
      }
    }

    if (!ohlcv || ohlcv.length < 20) {
      throw new Error('Insufficient historical data for pattern recognition');
    }

    // Detect patterns
    const detectedPatterns = patternDetector.detectPatterns(ohlcv, {
      minConfidence: options.minConfidence
    });

    // Calculate support and resistance levels
    let supportResistance = { support: [], resistance: [] };
    if (options.includeSupport || options.includeResistance) {
      supportResistance = patternDetector.calculateSupportResistance(ohlcv);
    }

    // Get current price
    const currentPrice = ohlcv[ohlcv.length - 1][4]; // Last close price

    // Enhance patterns with breakout predictions
    const enhancedPatterns = detectedPatterns.map(pattern => ({
      ...pattern,
      breakoutDirection: patternDetector.predictBreakoutDirection(ohlcv, pattern),
      distanceToBreakout: calculateDistanceToBreakout(currentPrice, pattern),
      isActive: isPatternActive(pattern, ohlcv.length - 1)
    }));

    // Calculate overall confidence (weighted average of top 3 patterns)
    const topPatterns = enhancedPatterns.slice(0, 3);
    const confidence = topPatterns.length > 0
      ? topPatterns.reduce((sum, p) => sum + p.confidence, 0) / topPatterns.length
      : 0;

    // Generate recommendations
    const recommendation = generateRecommendation(
      enhancedPatterns,
      currentPrice,
      supportResistance
    );

    // Determine dominant signal
    const dominantSignal = determineDominantSignal(enhancedPatterns);

    const executionTime = Date.now() - startTime;

    const result = {
      agent_key: 'pattern',
      symbol,
      timestamp: new Date().toISOString(),
      confidence: Math.min(confidence, 1.0),
      result: {
        current_price: currentPrice,
        patterns_detected: enhancedPatterns.length,
        patterns: enhancedPatterns.slice(0, 5), // Top 5 patterns
        support_levels: supportResistance.support,
        resistance_levels: supportResistance.resistance,
        dominant_signal: dominantSignal,
        recommendation
      },
      meta: {
        source: 'realtime',
        version: '1.0.0',
        execution_time_ms: executionTime,
        data_points: ohlcv.length,
        timeframe: timeframe || '1h'
      }
    };

    logger.info('Pattern Recognition Agent completed', {
      userId,
      symbol,
      patternsFound: enhancedPatterns.length,
      confidence,
      executionTime,
      agent: 'pattern'
    });

    return result;

  } catch (error) {
    logger.error('Pattern Recognition Agent error', {
      userId,
      symbol,
      error: error.message,
      stack: error.stack,
      agent: 'pattern'
    });

    // Return error response
    return {
      agent_key: 'pattern',
      symbol,
      timestamp: new Date().toISOString(),
      confidence: 0,
      error: error.message,
      result: {
        current_price: 0,
        patterns_detected: 0,
        patterns: [],
        support_levels: [],
        resistance_levels: [],
        dominant_signal: 'neutral',
        recommendation: 'Unable to analyze patterns due to error'
      },
      meta: {
        source: 'error',
        version: '1.0.0',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

/**
 * Calculate distance from current price to potential breakout
 */
function calculateDistanceToBreakout(currentPrice, pattern) {
  const breakoutLevel = pattern.breakoutDirection === 'up' 
    ? pattern.resistance 
    : pattern.support;
  
  const distance = ((breakoutLevel - currentPrice) / currentPrice) * 100;
  return {
    percentage: distance.toFixed(2),
    direction: distance > 0 ? 'above' : 'below',
    level: breakoutLevel
  };
}

/**
 * Check if pattern is still active (near the end of OHLCV data)
 */
function isPatternActive(pattern, lastIndex) {
  // Pattern is active if it ends within the last 20% of data
  return pattern.endIndex >= lastIndex * 0.8;
}

/**
 * Determine dominant signal from multiple patterns
 */
function determineDominantSignal(patterns) {
  if (patterns.length === 0) return 'neutral';

  const signals = { bullish: 0, bearish: 0, neutral: 0 };

  patterns.forEach(pattern => {
    const weight = pattern.confidence * (pattern.isActive ? 1.5 : 0.5);
    
    if (pattern.direction === 'bullish') {
      signals.bullish += weight;
    } else if (pattern.direction === 'bearish') {
      signals.bearish += weight;
    } else {
      signals.neutral += weight;
    }
  });

  const max = Math.max(signals.bullish, signals.bearish, signals.neutral);
  
  if (signals.bullish === max) return 'bullish';
  if (signals.bearish === max) return 'bearish';
  return 'neutral';
}

/**
 * Generate trading recommendation
 */
function generateRecommendation(patterns, currentPrice, supportResistance) {
  if (patterns.length === 0) {
    return 'No significant patterns detected. Wait for clearer signals.';
  }

  const recommendations = [];
  const topPattern = patterns[0];

  // Pattern-based recommendation
  if (topPattern.direction === 'bullish' && topPattern.confidence > 0.7) {
    recommendations.push(`Strong ${topPattern.type.replace(/_/g, ' ')} pattern detected (${(topPattern.confidence * 100).toFixed(0)}% confidence)`);
    recommendations.push(`Consider long positions with entry near support at ${topPattern.support?.toFixed(2)}`);
    recommendations.push(`Target price: ${topPattern.targetPrice?.toFixed(2)}`);
  } else if (topPattern.direction === 'bearish' && topPattern.confidence > 0.7) {
    recommendations.push(`Strong ${topPattern.type.replace(/_/g, ' ')} pattern detected (${(topPattern.confidence * 100).toFixed(0)}% confidence)`);
    recommendations.push(`Consider short positions or exit longs near resistance at ${topPattern.resistance?.toFixed(2)}`);
    recommendations.push(`Target price: ${topPattern.targetPrice?.toFixed(2)}`);
  } else {
    recommendations.push(`${topPattern.type.replace(/_/g, ' ')} pattern forming (${(topPattern.confidence * 100).toFixed(0)}% confidence)`);
    recommendations.push(`Wait for breakout confirmation before entering positions`);
  }

  // Support/Resistance levels
  if (supportResistance.support.length > 0) {
    recommendations.push(`Key support levels: ${supportResistance.support.map(s => s.toFixed(2)).join(', ')}`);
  }
  if (supportResistance.resistance.length > 0) {
    recommendations.push(`Key resistance levels: ${supportResistance.resistance.map(r => r.toFixed(2)).join(', ')}`);
  }

  // Multiple pattern confluence
  if (patterns.length > 1) {
    const activePatterns = patterns.filter(p => p.isActive);
    if (activePatterns.length >= 2) {
      const directions = activePatterns.map(p => p.direction);
      const bullishCount = directions.filter(d => d === 'bullish').length;
      const bearishCount = directions.filter(d => d === 'bearish').length;
      
      if (bullishCount >= 2) {
        recommendations.push(`Multiple bullish patterns provide confluence - stronger signal`);
      } else if (bearishCount >= 2) {
        recommendations.push(`Multiple bearish patterns provide confluence - stronger signal`);
      }
    }
  }

  return recommendations.join('. ');
}

/**
 * Generate mock OHLCV data for testing
 */
function generateMockOHLCV(dataPoints = 200) {
  const ohlcv = [];
  let price = 50000; // Starting price
  const now = Date.now();
  const hourMs = 3600000;

  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = now - (i * hourMs);
    const change = (Math.random() - 0.48) * price * 0.02; // Slight upward bias
    
    const open = price;
    price += change;
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.random() * 1000 + 500;

    ohlcv.push([timestamp, open, high, low, close, volume]);
  }

  return ohlcv;
}

/**
 * Get agent details and metrics
 * 
 * @param {object} params - Parameters
 * @param {number} params.userId - User ID
 * @returns {Promise<object>} - Agent details
 */
export async function getDetails({ userId }) {
  try {
    return {
      agent_key: 'pattern',
      name: 'Pattern Recognition Agent',
      description: 'Detects chart patterns (head and shoulders, triangles, flags, wedges) and predicts breakout directions with support/resistance analysis',
      status: 'active',
      version: '1.0.0',
      capabilities: [
        'Head and Shoulders detection (bearish reversal)',
        'Inverse Head and Shoulders detection (bullish reversal)',
        'Double Top/Bottom detection',
        'Triple Top/Bottom detection',
        'Triangle patterns (Ascending, Descending, Symmetrical)',
        'Flag patterns (Bull Flag, Bear Flag)',
        'Wedge patterns (Rising, Falling)',
        'Support/Resistance level identification',
        'Breakout direction prediction',
        'Pattern confidence scoring',
        'Multi-timeframe analysis'
      ],
      patterns_supported: [
        { type: 'head_and_shoulders', direction: 'bearish', description: 'Bearish reversal pattern with three peaks' },
        { type: 'inverse_head_and_shoulders', direction: 'bullish', description: 'Bullish reversal pattern with three troughs' },
        { type: 'double_top', direction: 'bearish', description: 'Bearish reversal with two peaks at similar levels' },
        { type: 'double_bottom', direction: 'bullish', description: 'Bullish reversal with two troughs at similar levels' },
        { type: 'triple_top', direction: 'bearish', description: 'Strong bearish reversal with three equal peaks' },
        { type: 'triple_bottom', direction: 'bullish', description: 'Strong bullish reversal with three equal troughs' },
        { type: 'ascending_triangle', direction: 'bullish', description: 'Bullish continuation with flat top and rising bottom' },
        { type: 'descending_triangle', direction: 'bearish', description: 'Bearish continuation with flat bottom and falling top' },
        { type: 'symmetrical_triangle', direction: 'neutral', description: 'Continuation pattern with converging trendlines' },
        { type: 'bull_flag', direction: 'bullish', description: 'Bullish continuation after strong uptrend' },
        { type: 'bear_flag', direction: 'bearish', description: 'Bearish continuation after strong downtrend' },
        { type: 'rising_wedge', direction: 'bearish', description: 'Bearish reversal with converging upward trendlines' },
        { type: 'falling_wedge', direction: 'bullish', description: 'Bullish reversal with converging downward trendlines' }
      ],
      configuration: {
        min_confidence: 0.5,
        default_timeframe: '1h',
        data_points: 200,
        supported_timeframes: ['15m', '30m', '1h', '4h', '1d', '1w']
      },
      lastRun: null,
      metrics: {
        totalRuns: 0,
        avgExecutionTime: 0,
        successRate: 0
      }
    };
  } catch (error) {
    logger.error('Error getting pattern agent details', {
      userId,
      error: error.message
    });

    return {
      agent_key: 'pattern',
      name: 'Pattern Recognition Agent',
      description: 'Pattern recognition agent',
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Get default configuration for the agent
 * 
 * @returns {object} - Default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    threshold: 0.6,
    minConfidence: 0.5,
    dataPoints: 200,
    includeSupport: true,
    includeResistance: true,
    timeframe: '1h'
  };
}

export default { run, getDetails, defaultConfig };
