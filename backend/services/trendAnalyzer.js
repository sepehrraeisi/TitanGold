/**
 * Trend Analyzer Service
 * BACKEND-009: Implement Trend Detection Agent
 * 
 * Implements technical indicators for trend detection:
 * - ADX (Average Directional Index) for trend strength
 * - Moving Averages (SMA, EMA) for trend direction
 * - Trend Lines (Support/Resistance) calculation
 * - Trend reversal signals detection
 * - Trend strength classification (weak/moderate/strong)
 */

import { logger } from './logger.js';

/**
 * Calculate Simple Moving Average (SMA)
 * @param {Array} prices - Array of price values
 * @param {number} period - Period for moving average
 * @returns {Array} SMA values
 */
export function calculateSMA(prices, period) {
  if (!prices || prices.length < period) {
    return [];
  }
  
  const sma = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  
  return sma;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * @param {Array} prices - Array of price values
 * @param {number} period - Period for moving average
 * @returns {Array} EMA values
 */
export function calculateEMA(prices, period) {
  if (!prices || prices.length < period) {
    return [];
  }
  
  const multiplier = 2 / (period + 1);
  const ema = [];
  
  // Start with SMA for first value
  const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(firstSMA);
  
  // Calculate EMA for remaining values
  for (let i = period; i < prices.length; i++) {
    const emaValue = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(emaValue);
  }
  
  return ema;
}

/**
 * Calculate True Range (TR) for ADX calculation
 * @param {Array} ohlcv - OHLCV data [[timestamp, open, high, low, close, volume], ...]
 * @returns {Array} True Range values
 */
export function calculateTrueRange(ohlcv) {
  const tr = [];
  
  for (let i = 1; i < ohlcv.length; i++) {
    const high = ohlcv[i][2];
    const low = ohlcv[i][3];
    const prevClose = ohlcv[i - 1][4];
    
    const hl = high - low;
    const hc = Math.abs(high - prevClose);
    const lc = Math.abs(low - prevClose);
    
    tr.push(Math.max(hl, hc, lc));
  }
  
  return tr;
}

/**
 * Calculate Directional Movement (DM+ and DM-)
 * @param {Array} ohlcv - OHLCV data
 * @returns {Object} { dmPlus, dmMinus }
 */
export function calculateDirectionalMovement(ohlcv) {
  const dmPlus = [];
  const dmMinus = [];
  
  for (let i = 1; i < ohlcv.length; i++) {
    const high = ohlcv[i][2];
    const low = ohlcv[i][3];
    const prevHigh = ohlcv[i - 1][2];
    const prevLow = ohlcv[i - 1][3];
    
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    if (upMove > downMove && upMove > 0) {
      dmPlus.push(upMove);
      dmMinus.push(0);
    } else if (downMove > upMove && downMove > 0) {
      dmPlus.push(0);
      dmMinus.push(downMove);
    } else {
      dmPlus.push(0);
      dmMinus.push(0);
    }
  }
  
  return { dmPlus, dmMinus };
}

/**
 * Calculate ADX (Average Directional Index)
 * @param {Array} ohlcv - OHLCV data [[timestamp, open, high, low, close, volume], ...]
 * @param {number} period - ADX period (default 14)
 * @returns {Object} { adx, diPlus, diMinus, values }
 */
export function calculateADX(ohlcv, period = 14) {
  if (!ohlcv || ohlcv.length < period + 1) {
    return { adx: null, diPlus: null, diMinus: null, values: [] };
  }
  
  // Calculate True Range
  const tr = calculateTrueRange(ohlcv);
  
  // Calculate Directional Movement
  const { dmPlus, dmMinus } = calculateDirectionalMovement(ohlcv);
  
  // Smooth TR, DM+ and DM- using Wilder's smoothing
  const smoothedTR = [];
  const smoothedDMPlus = [];
  const smoothedDMMinus = [];
  
  // First smoothed value is sum of first period
  let trSum = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let dmPlusSum = dmPlus.slice(0, period).reduce((a, b) => a + b, 0);
  let dmMinusSum = dmMinus.slice(0, period).reduce((a, b) => a + b, 0);
  
  smoothedTR.push(trSum);
  smoothedDMPlus.push(dmPlusSum);
  smoothedDMMinus.push(dmMinusSum);
  
  // Subsequent values use Wilder's smoothing
  for (let i = period; i < tr.length; i++) {
    trSum = smoothedTR[smoothedTR.length - 1] - (smoothedTR[smoothedTR.length - 1] / period) + tr[i];
    dmPlusSum = smoothedDMPlus[smoothedDMPlus.length - 1] - (smoothedDMPlus[smoothedDMPlus.length - 1] / period) + dmPlus[i];
    dmMinusSum = smoothedDMMinus[smoothedDMMinus.length - 1] - (smoothedDMMinus[smoothedDMMinus.length - 1] / period) + dmMinus[i];
    
    smoothedTR.push(trSum);
    smoothedDMPlus.push(dmPlusSum);
    smoothedDMMinus.push(dmMinusSum);
  }
  
  // Calculate DI+ and DI-
  const diPlus = [];
  const diMinus = [];
  
  for (let i = 0; i < smoothedTR.length; i++) {
    diPlus.push(smoothedTR[i] !== 0 ? (smoothedDMPlus[i] / smoothedTR[i]) * 100 : 0);
    diMinus.push(smoothedTR[i] !== 0 ? (smoothedDMMinus[i] / smoothedTR[i]) * 100 : 0);
  }
  
  // Calculate DX (Directional Index)
  const dx = [];
  for (let i = 0; i < diPlus.length; i++) {
    const diSum = diPlus[i] + diMinus[i];
    const diDiff = Math.abs(diPlus[i] - diMinus[i]);
    dx.push(diSum !== 0 ? (diDiff / diSum) * 100 : 0);
  }
  
  // Calculate ADX (average of DX)
  const adxValues = [];
  
  // First ADX is average of first period DX values
  if (dx.length >= period) {
    let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
    adxValues.push(adx);
    
    // Subsequent ADX values use Wilder's smoothing
    for (let i = period; i < dx.length; i++) {
      adx = ((adx * (period - 1)) + dx[i]) / period;
      adxValues.push(adx);
    }
  }
  
  // Return latest values and full arrays
  const latestADX = adxValues.length > 0 ? adxValues[adxValues.length - 1] : null;
  const latestDIPlus = diPlus.length > 0 ? diPlus[diPlus.length - 1] : null;
  const latestDIMinus = diMinus.length > 0 ? diMinus[diMinus.length - 1] : null;
  
  return {
    adx: latestADX,
    diPlus: latestDIPlus,
    diMinus: latestDIMinus,
    values: adxValues,
    diPlusValues: diPlus,
    diMinusValues: diMinus
  };
}

/**
 * Classify trend strength based on ADX value
 * @param {number} adx - ADX value
 * @returns {string} Trend strength: 'weak', 'moderate', 'strong'
 */
export function classifyTrendStrength(adx) {
  if (adx === null || adx === undefined) {
    return 'unknown';
  }
  
  if (adx < 25) {
    return 'weak';
  } else if (adx < 50) {
    return 'moderate';
  } else {
    return 'strong';
  }
}

/**
 * Identify trend direction using DI+ and DI-
 * @param {number} diPlus - DI+ value
 * @param {number} diMinus - DI- value
 * @param {Array} prices - Recent price data for confirmation
 * @returns {string} Trend direction: 'up', 'down', 'sideways'
 */
export function identifyTrendDirection(diPlus, diMinus, prices = []) {
  if (diPlus === null || diMinus === null) {
    return 'unknown';
  }
  
  // Primary direction based on DI
  const diDiff = Math.abs(diPlus - diMinus);
  
  // If DI values are too close, market is sideways
  if (diDiff < 5) {
    return 'sideways';
  }
  
  // Confirm with price action if available
  if (prices && prices.length >= 2) {
    const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
    
    if (diPlus > diMinus) {
      // Uptrend confirmed by price
      return priceChange >= 0 ? 'up' : 'sideways';
    } else {
      // Downtrend confirmed by price
      return priceChange <= 0 ? 'down' : 'sideways';
    }
  }
  
  return diPlus > diMinus ? 'up' : 'down';
}

/**
 * Calculate trend lines (support and resistance)
 * @param {Array} ohlcv - OHLCV data
 * @param {number} lookback - Lookback period for pivot points
 * @returns {Object} { support, resistance, pivots }
 */
export function calculateTrendLines(ohlcv, lookback = 20) {
  if (!ohlcv || ohlcv.length < lookback) {
    return { support: null, resistance: null, pivots: [] };
  }
  
  const pivots = [];
  
  // Find pivot highs and lows
  for (let i = lookback; i < ohlcv.length - lookback; i++) {
    const high = ohlcv[i][2];
    const low = ohlcv[i][3];
    
    // Check if it's a pivot high
    let isPivotHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && ohlcv[j][2] >= high) {
        isPivotHigh = false;
        break;
      }
    }
    
    // Check if it's a pivot low
    let isPivotLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && ohlcv[j][3] <= low) {
        isPivotLow = false;
        break;
      }
    }
    
    if (isPivotHigh) {
      pivots.push({ type: 'high', index: i, price: high, timestamp: ohlcv[i][0] });
    }
    if (isPivotLow) {
      pivots.push({ type: 'low', index: i, price: low, timestamp: ohlcv[i][0] });
    }
  }
  
  // Calculate resistance line from pivot highs
  const pivotHighs = pivots.filter(p => p.type === 'high');
  let resistance = null;
  
  if (pivotHighs.length >= 2) {
    // Use linear regression on pivot highs
    const recentHighs = pivotHighs.slice(-5); // Last 5 pivot highs
    resistance = calculateLinearRegression(recentHighs.map(p => ({ x: p.index, y: p.price })));
  }
  
  // Calculate support line from pivot lows
  const pivotLows = pivots.filter(p => p.type === 'low');
  let support = null;
  
  if (pivotLows.length >= 2) {
    // Use linear regression on pivot lows
    const recentLows = pivotLows.slice(-5); // Last 5 pivot lows
    support = calculateLinearRegression(recentLows.map(p => ({ x: p.index, y: p.price })));
  }
  
  return {
    support,
    resistance,
    pivots: pivots.slice(-10) // Return last 10 pivots
  };
}

/**
 * Calculate linear regression for trend line
 * @param {Array} points - Array of {x, y} points
 * @returns {Object} { slope, intercept, predict }
 */
function calculateLinearRegression(points) {
  if (points.length < 2) {
    return null;
  }
  
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return {
    slope,
    intercept,
    predict: (x) => slope * x + intercept
  };
}

/**
 * Detect trend reversal signals
 * @param {Object} adxData - ADX calculation results
 * @param {Array} ohlcv - OHLCV data
 * @param {Object} trendLines - Trend lines data
 * @returns {Array} Array of reversal signals
 */
export function detectReversalSignals(adxData, ohlcv, trendLines) {
  const signals = [];
  
  if (!adxData || !ohlcv || ohlcv.length < 10) {
    return signals;
  }
  
  const { diPlusValues, diMinusValues, values: adxValues } = adxData;
  const currentPrice = ohlcv[ohlcv.length - 1][4];
  
  // Signal 1: DI+ and DI- crossover
  if (diPlusValues && diMinusValues && diPlusValues.length >= 2 && diMinusValues.length >= 2) {
    const prevDIPlus = diPlusValues[diPlusValues.length - 2];
    const currDIPlus = diPlusValues[diPlusValues.length - 1];
    const prevDIMinus = diMinusValues[diMinusValues.length - 2];
    const currDIMinus = diMinusValues[diMinusValues.length - 1];
    
    // Bullish crossover: DI+ crosses above DI-
    if (prevDIPlus <= prevDIMinus && currDIPlus > currDIMinus) {
      signals.push({
        type: 'bullish_crossover',
        description: 'DI+ crossed above DI-, indicating potential uptrend',
        strength: adxData.adx > 25 ? 'strong' : 'weak',
        confidence: 0.75
      });
    }
    
    // Bearish crossover: DI- crosses above DI+
    if (prevDIMinus <= prevDIPlus && currDIMinus > currDIPlus) {
      signals.push({
        type: 'bearish_crossover',
        description: 'DI- crossed above DI+, indicating potential downtrend',
        strength: adxData.adx > 25 ? 'strong' : 'weak',
        confidence: 0.75
      });
    }
  }
  
  // Signal 2: ADX trend weakening (potential reversal)
  if (adxValues && adxValues.length >= 5) {
    const recentADX = adxValues.slice(-5);
    const adxDecreasing = recentADX.every((val, i) => i === 0 || val < recentADX[i - 1]);
    
    if (adxDecreasing && adxData.adx < 30) {
      signals.push({
        type: 'trend_weakening',
        description: 'ADX declining, trend losing strength',
        strength: 'weak',
        confidence: 0.60
      });
    }
  }
  
  // Signal 3: Price touching trend line
  if (trendLines && ohlcv.length >= 2) {
    const prevPrice = ohlcv[ohlcv.length - 2][4];
    const currIndex = ohlcv.length - 1;
    
    if (trendLines.support) {
      const supportPrice = trendLines.support.predict(currIndex);
      const supportTolerance = supportPrice * 0.02; // 2% tolerance
      
      if (Math.abs(currentPrice - supportPrice) < supportTolerance && currentPrice >= prevPrice) {
        signals.push({
          type: 'support_bounce',
          description: 'Price bounced off support line',
          strength: 'moderate',
          confidence: 0.70,
          level: Math.round(supportPrice * 100) / 100
        });
      }
    }
    
    if (trendLines.resistance) {
      const resistancePrice = trendLines.resistance.predict(currIndex);
      const resistanceTolerance = resistancePrice * 0.02; // 2% tolerance
      
      if (Math.abs(currentPrice - resistancePrice) < resistanceTolerance && currentPrice <= prevPrice) {
        signals.push({
          type: 'resistance_rejection',
          description: 'Price rejected at resistance line',
          strength: 'moderate',
          confidence: 0.70,
          level: Math.round(resistancePrice * 100) / 100
        });
      }
    }
  }
  
  // Signal 4: Extreme ADX values
  if (adxData.adx !== null) {
    if (adxData.adx > 60) {
      signals.push({
        type: 'overbought_trend',
        description: 'Extremely strong trend, potential exhaustion',
        strength: 'strong',
        confidence: 0.65
      });
    }
  }
  
  return signals;
}

/**
 * Comprehensive trend analysis
 * @param {Array} ohlcv - OHLCV data
 * @param {Object} options - Analysis options
 * @returns {Object} Complete trend analysis
 */
export function analyzeTrend(ohlcv, options = {}) {
  const {
    adxPeriod = 14,
    smaPeriod = 50,
    emaPeriod = 20,
    trendLineLookback = 20
  } = options;
  
  if (!ohlcv || ohlcv.length < Math.max(adxPeriod, smaPeriod, emaPeriod)) {
    throw new Error('Insufficient data for trend analysis');
  }
  
  // Calculate ADX
  const adxData = calculateADX(ohlcv, adxPeriod);
  
  // Classify trend
  const trendStrength = classifyTrendStrength(adxData.adx);
  const closes = ohlcv.map(candle => candle[4]);
  const trendDirection = identifyTrendDirection(adxData.diPlus, adxData.diMinus, closes.slice(-20));
  
  // Calculate moving averages
  const sma = calculateSMA(closes, smaPeriod);
  const ema = calculateEMA(closes, emaPeriod);
  
  // Calculate trend lines
  const trendLines = calculateTrendLines(ohlcv, trendLineLookback);
  
  // Detect reversal signals
  const reversalSignals = detectReversalSignals(adxData, ohlcv, trendLines);
  
  // Current price and moving average positions
  const currentPrice = closes[closes.length - 1];
  const currentSMA = sma.length > 0 ? sma[sma.length - 1] : null;
  const currentEMA = ema.length > 0 ? ema[ema.length - 1] : null;
  
  return {
    adx: {
      value: adxData.adx,
      diPlus: adxData.diPlus,
      diMinus: adxData.diMinus,
      strength: trendStrength
    },
    trend: {
      direction: trendDirection,
      strength: trendStrength,
      confidence: calculateTrendConfidence(adxData, trendDirection)
    },
    movingAverages: {
      sma: { value: currentSMA, period: smaPeriod },
      ema: { value: currentEMA, period: emaPeriod },
      position: determinePricePosition(currentPrice, currentSMA, currentEMA)
    },
    trendLines: {
      support: trendLines.support ? {
        slope: trendLines.support.slope,
        current: trendLines.support.predict(ohlcv.length - 1)
      } : null,
      resistance: trendLines.resistance ? {
        slope: trendLines.resistance.slope,
        current: trendLines.resistance.predict(ohlcv.length - 1)
      } : null,
      pivots: trendLines.pivots
    },
    reversalSignals,
    summary: generateTrendSummary(trendDirection, trendStrength, adxData.adx, reversalSignals)
  };
}

/**
 * Calculate trend confidence score
 */
function calculateTrendConfidence(adxData, direction) {
  let confidence = 0.5; // Base confidence
  
  // ADX strength increases confidence
  if (adxData.adx > 40) confidence += 0.25;
  else if (adxData.adx > 25) confidence += 0.15;
  else if (adxData.adx > 15) confidence += 0.05;
  
  // DI spread increases confidence
  const diSpread = Math.abs(adxData.diPlus - adxData.diMinus);
  if (diSpread > 20) confidence += 0.15;
  else if (diSpread > 10) confidence += 0.10;
  
  // Direction consistency
  if (direction === 'up' && adxData.diPlus > adxData.diMinus + 5) confidence += 0.10;
  if (direction === 'down' && adxData.diMinus > adxData.diPlus + 5) confidence += 0.10;
  
  return Math.min(0.95, confidence);
}

/**
 * Determine price position relative to moving averages
 */
function determinePricePosition(price, sma, ema) {
  if (!sma || !ema) return 'unknown';
  
  if (price > sma && price > ema) return 'above_both';
  if (price < sma && price < ema) return 'below_both';
  if (price > sma && price < ema) return 'between';
  if (price < sma && price > ema) return 'between';
  
  return 'unknown';
}

/**
 * Generate human-readable trend summary
 */
function generateTrendSummary(direction, strength, adx, signals) {
  const directionText = {
    'up': 'upward',
    'down': 'downward',
    'sideways': 'sideways'
  }[direction] || 'unclear';
  
  const strengthText = strength;
  const adxText = adx !== null ? `ADX ${Math.round(adx)}` : 'ADX unavailable';
  
  let summary = `Market shows ${strengthText} ${directionText} trend (${adxText}).`;
  
  if (signals && signals.length > 0) {
    summary += ` ${signals.length} reversal signal(s) detected.`;
  }
  
  return summary;
}

export default {
  calculateSMA,
  calculateEMA,
  calculateADX,
  classifyTrendStrength,
  identifyTrendDirection,
  calculateTrendLines,
  detectReversalSignals,
  analyzeTrend
};
