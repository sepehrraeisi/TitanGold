/**
 * Pattern Detector Service
 * 
 * Detects common chart patterns in price data:
 * 1. Head and Shoulders (bearish reversal)
 * 2. Inverse Head and Shoulders (bullish reversal)
 * 3. Double Top (bearish reversal)
 * 4. Double Bottom (bullish reversal)
 * 5. Triple Top (bearish reversal)
 * 6. Triple Bottom (bullish reversal)
 * 7. Ascending Triangle (bullish continuation)
 * 8. Descending Triangle (bearish continuation)
 * 9. Symmetrical Triangle (continuation)
 * 10. Bull Flag (bullish continuation)
 * 11. Bear Flag (bearish continuation)
 * 12. Rising Wedge (bearish reversal)
 * 13. Falling Wedge (bullish reversal)
 * 
 * Features:
 * - Pattern confidence scoring (0-1)
 * - Support/resistance level identification
 * - Breakout direction prediction
 * - Pattern completion validation
 * 
 * @module patternDetector
 */

import { logger } from './logger.js';

/**
 * Main pattern detection function
 * @param {Array} ohlcv - OHLCV data [[timestamp, open, high, low, close, volume], ...]
 * @param {object} options - Detection options
 * @returns {Array} - Detected patterns with confidence scores
 */
export function detectPatterns(ohlcv, options = {}) {
  if (!ohlcv || ohlcv.length < 20) {
    logger.warn('Insufficient data for pattern detection', { dataPoints: ohlcv?.length });
    return [];
  }

  const patterns = [];
  
  // Extract price data
  const highs = ohlcv.map(candle => candle[2]);
  const lows = ohlcv.map(candle => candle[3]);
  const closes = ohlcv.map(candle => candle[4]);
  const volumes = ohlcv.map(candle => candle[5]);

  // Detect all pattern types
  patterns.push(...detectHeadAndShoulders(ohlcv, highs, lows, closes));
  patterns.push(...detectInverseHeadAndShoulders(ohlcv, highs, lows, closes));
  patterns.push(...detectDoubleTops(ohlcv, highs, lows, closes));
  patterns.push(...detectDoubleBottoms(ohlcv, highs, lows, closes));
  patterns.push(...detectTripleTops(ohlcv, highs, lows, closes));
  patterns.push(...detectTripleBottoms(ohlcv, highs, lows, closes));
  patterns.push(...detectTriangles(ohlcv, highs, lows, closes));
  patterns.push(...detectFlags(ohlcv, highs, lows, closes, volumes));
  patterns.push(...detectWedges(ohlcv, highs, lows, closes));

  // Sort by confidence (highest first)
  patterns.sort((a, b) => b.confidence - a.confidence);

  // Filter by minimum confidence threshold
  const minConfidence = options.minConfidence || 0.5;
  return patterns.filter(p => p.confidence >= minConfidence);
}

/**
 * Detect Head and Shoulders pattern (bearish reversal)
 */
function detectHeadAndShoulders(ohlcv, highs, lows, closes) {
  const patterns = [];
  const minPeriod = 20;
  const maxPeriod = 100;

  for (let start = 0; start < highs.length - minPeriod; start++) {
    const end = Math.min(start + maxPeriod, highs.length);
    const window = highs.slice(start, end);
    
    if (window.length < minPeriod) continue;

    // Find three peaks (left shoulder, head, right shoulder)
    const peaks = findPeaks(window, 3);
    if (peaks.length < 3) continue;

    const [leftShoulder, head, rightShoulder] = peaks;

    // Validate head is higher than shoulders
    if (window[head] <= window[leftShoulder] || window[head] <= window[rightShoulder]) continue;

    // Shoulders should be roughly equal height (within 5%)
    const shoulderDiff = Math.abs(window[leftShoulder] - window[rightShoulder]) / window[leftShoulder];
    if (shoulderDiff > 0.05) continue;

    // Calculate neckline (support level)
    const necklineStart = Math.min(lows[start + leftShoulder], lows[start + head]);
    const necklineEnd = Math.min(lows[start + head], lows[start + rightShoulder]);
    const neckline = (necklineStart + necklineEnd) / 2;

    // Calculate confidence
    const heightDiff = window[head] - Math.max(window[leftShoulder], window[rightShoulder]);
    const patternHeight = window[head] - neckline;
    const symmetry = 1 - shoulderDiff;
    const volumeConfirmation = confirmVolumePattern(ohlcv.slice(start, end).map(c => c[5]), [leftShoulder, head, rightShoulder]);
    
    const confidence = (symmetry * 0.4 + (heightDiff / patternHeight) * 0.3 + volumeConfirmation * 0.3);

    if (confidence >= 0.5) {
      patterns.push({
        type: 'head_and_shoulders',
        direction: 'bearish',
        confidence: Math.min(confidence, 1.0),
        startIndex: start,
        endIndex: start + rightShoulder,
        support: neckline,
        resistance: window[head],
        targetPrice: neckline - (window[head] - neckline), // Price target below neckline
        breakoutDirection: 'down',
        keyLevels: {
          leftShoulder: window[leftShoulder],
          head: window[head],
          rightShoulder: window[rightShoulder],
          neckline
        }
      });
    }
  }

  return patterns;
}

/**
 * Detect Inverse Head and Shoulders pattern (bullish reversal)
 */
function detectInverseHeadAndShoulders(ohlcv, highs, lows, closes) {
  const patterns = [];
  const minPeriod = 20;
  const maxPeriod = 100;

  for (let start = 0; start < lows.length - minPeriod; start++) {
    const end = Math.min(start + maxPeriod, lows.length);
    const window = lows.slice(start, end);
    
    if (window.length < minPeriod) continue;

    // Find three troughs (left shoulder, head, right shoulder)
    const troughs = findTroughs(window, 3);
    if (troughs.length < 3) continue;

    const [leftShoulder, head, rightShoulder] = troughs;

    // Validate head is lower than shoulders
    if (window[head] >= window[leftShoulder] || window[head] >= window[rightShoulder]) continue;

    // Shoulders should be roughly equal depth (within 5%)
    const shoulderDiff = Math.abs(window[leftShoulder] - window[rightShoulder]) / window[leftShoulder];
    if (shoulderDiff > 0.05) continue;

    // Calculate neckline (resistance level)
    const necklineStart = Math.max(highs[start + leftShoulder], highs[start + head]);
    const necklineEnd = Math.max(highs[start + head], highs[start + rightShoulder]);
    const neckline = (necklineStart + necklineEnd) / 2;

    // Calculate confidence
    const depthDiff = Math.min(window[leftShoulder], window[rightShoulder]) - window[head];
    const patternDepth = neckline - window[head];
    const symmetry = 1 - shoulderDiff;
    const volumeConfirmation = confirmVolumePattern(ohlcv.slice(start, end).map(c => c[5]), [leftShoulder, head, rightShoulder]);
    
    const confidence = (symmetry * 0.4 + (depthDiff / patternDepth) * 0.3 + volumeConfirmation * 0.3);

    if (confidence >= 0.5) {
      patterns.push({
        type: 'inverse_head_and_shoulders',
        direction: 'bullish',
        confidence: Math.min(confidence, 1.0),
        startIndex: start,
        endIndex: start + rightShoulder,
        support: window[head],
        resistance: neckline,
        targetPrice: neckline + (neckline - window[head]), // Price target above neckline
        breakoutDirection: 'up',
        keyLevels: {
          leftShoulder: window[leftShoulder],
          head: window[head],
          rightShoulder: window[rightShoulder],
          neckline
        }
      });
    }
  }

  return patterns;
}

/**
 * Detect Double Top pattern (bearish reversal)
 */
function detectDoubleTops(ohlcv, highs, lows, closes) {
  const patterns = [];
  const minPeriod = 15;

  for (let start = 0; start < highs.length - minPeriod; start++) {
    const window = highs.slice(start, start + minPeriod);
    const peaks = findPeaks(window, 2);
    
    if (peaks.length < 2) continue;

    const [peak1, peak2] = peaks;
    
    // Peaks should be roughly equal (within 2%)
    const peakDiff = Math.abs(window[peak1] - window[peak2]) / window[peak1];
    if (peakDiff > 0.02) continue;

    // Find valley between peaks
    const valley = findLowestBetween(lows, start + peak1, start + peak2);
    const support = lows[valley];

    const confidence = 0.7 - peakDiff * 10; // High confidence for similar peaks

    patterns.push({
      type: 'double_top',
      direction: 'bearish',
      confidence: Math.min(confidence, 1.0),
      startIndex: start,
      endIndex: start + peak2,
      support,
      resistance: (window[peak1] + window[peak2]) / 2,
      targetPrice: support - (window[peak1] - support),
      breakoutDirection: 'down',
      keyLevels: {
        peak1: window[peak1],
        peak2: window[peak2],
        valley: support
      }
    });
  }

  return patterns;
}

/**
 * Detect Double Bottom pattern (bullish reversal)
 */
function detectDoubleBottoms(ohlcv, highs, lows, closes) {
  const patterns = [];
  const minPeriod = 15;

  for (let start = 0; start < lows.length - minPeriod; start++) {
    const window = lows.slice(start, start + minPeriod);
    const troughs = findTroughs(window, 2);
    
    if (troughs.length < 2) continue;

    const [trough1, trough2] = troughs;
    
    // Troughs should be roughly equal (within 2%)
    const troughDiff = Math.abs(window[trough1] - window[trough2]) / window[trough1];
    if (troughDiff > 0.02) continue;

    // Find peak between troughs
    const peak = findHighestBetween(highs, start + trough1, start + trough2);
    const resistance = highs[peak];

    const confidence = 0.7 - troughDiff * 10;

    patterns.push({
      type: 'double_bottom',
      direction: 'bullish',
      confidence: Math.min(confidence, 1.0),
      startIndex: start,
      endIndex: start + trough2,
      support: (window[trough1] + window[trough2]) / 2,
      resistance,
      targetPrice: resistance + (resistance - window[trough1]),
      breakoutDirection: 'up',
      keyLevels: {
        trough1: window[trough1],
        trough2: window[trough2],
        peak: resistance
      }
    });
  }

  return patterns;
}

/**
 * Detect Triple Top pattern (bearish reversal)
 */
function detectTripleTops(ohlcv, highs, lows, closes) {
  const patterns = [];
  const minPeriod = 20;

  for (let start = 0; start < highs.length - minPeriod; start++) {
    const window = highs.slice(start, start + minPeriod);
    const peaks = findPeaks(window, 3);
    
    if (peaks.length < 3) continue;

    const [peak1, peak2, peak3] = peaks;
    
    // All peaks should be roughly equal (within 2%)
    const avgPeak = (window[peak1] + window[peak2] + window[peak3]) / 3;
    const maxDiff = Math.max(
      Math.abs(window[peak1] - avgPeak) / avgPeak,
      Math.abs(window[peak2] - avgPeak) / avgPeak,
      Math.abs(window[peak3] - avgPeak) / avgPeak
    );
    
    if (maxDiff > 0.02) continue;

    // Find lowest support level
    const support = Math.min(
      lows[start + peak1],
      lows[start + peak2],
      lows[start + peak3]
    );

    const confidence = 0.75 - maxDiff * 10;

    patterns.push({
      type: 'triple_top',
      direction: 'bearish',
      confidence: Math.min(confidence, 1.0),
      startIndex: start,
      endIndex: start + peak3,
      support,
      resistance: avgPeak,
      targetPrice: support - (avgPeak - support),
      breakoutDirection: 'down',
      keyLevels: {
        peak1: window[peak1],
        peak2: window[peak2],
        peak3: window[peak3],
        support
      }
    });
  }

  return patterns;
}

/**
 * Detect Triple Bottom pattern (bullish reversal)
 */
function detectTripleBottoms(ohlcv, highs, lows, closes) {
  const patterns = [];
  const minPeriod = 20;

  for (let start = 0; start < lows.length - minPeriod; start++) {
    const window = lows.slice(start, start + minPeriod);
    const troughs = findTroughs(window, 3);
    
    if (troughs.length < 3) continue;

    const [trough1, trough2, trough3] = troughs;
    
    // All troughs should be roughly equal (within 2%)
    const avgTrough = (window[trough1] + window[trough2] + window[trough3]) / 3;
    const maxDiff = Math.max(
      Math.abs(window[trough1] - avgTrough) / avgTrough,
      Math.abs(window[trough2] - avgTrough) / avgTrough,
      Math.abs(window[trough3] - avgTrough) / avgTrough
    );
    
    if (maxDiff > 0.02) continue;

    // Find highest resistance level
    const resistance = Math.max(
      highs[start + trough1],
      highs[start + trough2],
      highs[start + trough3]
    );

    const confidence = 0.75 - maxDiff * 10;

    patterns.push({
      type: 'triple_bottom',
      direction: 'bullish',
      confidence: Math.min(confidence, 1.0),
      startIndex: start,
      endIndex: start + trough3,
      support: avgTrough,
      resistance,
      targetPrice: resistance + (resistance - avgTrough),
      breakoutDirection: 'up',
      keyLevels: {
        trough1: window[trough1],
        trough2: window[trough2],
        trough3: window[trough3],
        resistance
      }
    });
  }

  return patterns;
}

/**
 * Detect Triangle patterns (Ascending, Descending, Symmetrical)
 */
function detectTriangles(ohlcv, highs, lows, closes) {
  const patterns = [];
  const minPeriod = 15;
  const maxPeriod = 50;

  for (let start = 0; start < highs.length - minPeriod; start++) {
    const end = Math.min(start + maxPeriod, highs.length);
    const windowHighs = highs.slice(start, end);
    const windowLows = lows.slice(start, end);

    if (windowHighs.length < minPeriod) continue;

    // Calculate trendlines
    const highTrend = calculateTrendline(windowHighs);
    const lowTrend = calculateTrendline(windowLows);

    // Check for convergence (triangle formation)
    const convergence = Math.abs(highTrend.slope + lowTrend.slope) < 0.01;
    if (!convergence) continue;

    // Determine triangle type
    let type, direction;
    if (Math.abs(highTrend.slope) < 0.001) {
      // Ascending triangle (flat top, rising bottom)
      type = 'ascending_triangle';
      direction = 'bullish';
    } else if (Math.abs(lowTrend.slope) < 0.001) {
      // Descending triangle (falling top, flat bottom)
      type = 'descending_triangle';
      direction = 'bearish';
    } else {
      // Symmetrical triangle
      type = 'symmetrical_triangle';
      direction = 'neutral';
    }

    const resistance = Math.max(...windowHighs);
    const support = Math.min(...windowLows);
    const confidence = 0.6 + (convergence ? 0.2 : 0);

    patterns.push({
      type,
      direction,
      confidence: Math.min(confidence, 1.0),
      startIndex: start,
      endIndex: end - 1,
      support,
      resistance,
      targetPrice: direction === 'bullish' ? resistance + (resistance - support) : support - (resistance - support),
      breakoutDirection: direction === 'bullish' ? 'up' : direction === 'bearish' ? 'down' : 'either',
      keyLevels: {
        apex: { high: resistance, low: support },
        trendlines: { high: highTrend, low: lowTrend }
      }
    });
  }

  return patterns;
}

/**
 * Detect Flag patterns (Bull Flag, Bear Flag)
 */
function detectFlags(ohlcv, highs, lows, closes, volumes) {
  const patterns = [];
  const minPeriod = 10;
  const flagLength = 8;

  for (let start = minPeriod; start < highs.length - flagLength; start++) {
    // Check for strong prior trend (pole)
    const poleHighs = highs.slice(start - minPeriod, start);
    const poleLows = lows.slice(start - minPeriod, start);
    const poleTrend = calculateTrendline(closes.slice(start - minPeriod, start));

    // Pole should be strong (steep slope)
    if (Math.abs(poleTrend.slope) < 0.01) continue;

    // Flag consolidation
    const flagHighs = highs.slice(start, start + flagLength);
    const flagLows = lows.slice(start, start + flagLength);
    const flagTrend = calculateTrendline(closes.slice(start, start + flagLength));

    // Flag should move against the pole (retracement)
    const isRetracement = (poleTrend.slope > 0 && flagTrend.slope < 0) ||
                          (poleTrend.slope < 0 && flagTrend.slope > 0);
    
    if (!isRetracement) continue;

    // Flag should be smaller than pole
    const poleSize = Math.max(...poleHighs) - Math.min(...poleLows);
    const flagSize = Math.max(...flagHighs) - Math.min(...flagLows);
    
    if (flagSize > poleSize * 0.5) continue;

    const isBullish = poleTrend.slope > 0;
    const resistance = Math.max(...flagHighs);
    const support = Math.min(...flagLows);
    const confidence = 0.65;

    patterns.push({
      type: isBullish ? 'bull_flag' : 'bear_flag',
      direction: isBullish ? 'bullish' : 'bearish',
      confidence,
      startIndex: start - minPeriod,
      endIndex: start + flagLength,
      support,
      resistance,
      targetPrice: isBullish ? 
        resistance + poleSize : 
        support - poleSize,
      breakoutDirection: isBullish ? 'up' : 'down',
      keyLevels: {
        poleStart: poleLows[0],
        poleEnd: poleHighs[poleHighs.length - 1],
        flagSupport: support,
        flagResistance: resistance
      }
    });
  }

  return patterns;
}

/**
 * Detect Wedge patterns (Rising Wedge, Falling Wedge)
 */
function detectWedges(ohlcv, highs, lows, closes) {
  const patterns = [];
  const minPeriod = 15;
  const maxPeriod = 50;

  for (let start = 0; start < highs.length - minPeriod; start++) {
    const end = Math.min(start + maxPeriod, highs.length);
    const windowHighs = highs.slice(start, end);
    const windowLows = lows.slice(start, end);

    if (windowHighs.length < minPeriod) continue;

    // Calculate trendlines
    const highTrend = calculateTrendline(windowHighs);
    const lowTrend = calculateTrendline(windowLows);

    // Both trendlines should slope in same direction
    const sameDirection = (highTrend.slope > 0 && lowTrend.slope > 0) ||
                          (highTrend.slope < 0 && lowTrend.slope < 0);
    
    if (!sameDirection) continue;

    // Check for convergence (wedge narrows)
    const convergence = Math.abs(highTrend.slope - lowTrend.slope) > 0.005;
    if (!convergence) continue;

    const isRising = highTrend.slope > 0 && lowTrend.slope > 0;
    const resistance = Math.max(...windowHighs);
    const support = Math.min(...windowLows);
    const confidence = 0.6;

    patterns.push({
      type: isRising ? 'rising_wedge' : 'falling_wedge',
      direction: isRising ? 'bearish' : 'bullish', // Wedges are reversal patterns
      confidence,
      startIndex: start,
      endIndex: end - 1,
      support,
      resistance,
      targetPrice: isRising ? 
        support - (resistance - support) : 
        resistance + (resistance - support),
      breakoutDirection: isRising ? 'down' : 'up',
      keyLevels: {
        upperTrendline: highTrend,
        lowerTrendline: lowTrend
      }
    });
  }

  return patterns;
}

/**
 * Find peaks in a price array
 */
function findPeaks(data, count = 3) {
  const peaks = [];
  
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
      peaks.push(i);
    }
  }

  // Return the highest peaks
  return peaks
    .sort((a, b) => data[b] - data[a])
    .slice(0, count)
    .sort((a, b) => a - b);
}

/**
 * Find troughs in a price array
 */
function findTroughs(data, count = 3) {
  const troughs = [];
  
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] < data[i - 1] && data[i] < data[i + 1]) {
      troughs.push(i);
    }
  }

  // Return the lowest troughs
  return troughs
    .sort((a, b) => data[a] - data[b])
    .slice(0, count)
    .sort((a, b) => a - b);
}

/**
 * Find lowest point between two indices
 */
function findLowestBetween(data, start, end) {
  let minIdx = start;
  let minVal = data[start];
  
  for (let i = start + 1; i <= end && i < data.length; i++) {
    if (data[i] < minVal) {
      minVal = data[i];
      minIdx = i;
    }
  }
  
  return minIdx;
}

/**
 * Find highest point between two indices
 */
function findHighestBetween(data, start, end) {
  let maxIdx = start;
  let maxVal = data[start];
  
  for (let i = start + 1; i <= end && i < data.length; i++) {
    if (data[i] > maxVal) {
      maxVal = data[i];
      maxIdx = i;
    }
  }
  
  return maxIdx;
}

/**
 * Calculate simple linear trendline for data
 */
function calculateTrendline(data) {
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Confirm pattern with volume analysis
 */
function confirmVolumePattern(volumes, keyIndices) {
  if (!volumes || volumes.length === 0) return 0.5;

  // Volume should decrease towards later stages of the pattern
  const avgVolumeStart = average(volumes.slice(0, Math.floor(volumes.length / 3)));
  const avgVolumeEnd = average(volumes.slice(Math.floor(2 * volumes.length / 3)));

  const volumeDecrease = avgVolumeStart > avgVolumeEnd ? 0.8 : 0.5;
  return volumeDecrease;
}

/**
 * Calculate average of an array
 */
function average(arr) {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Calculate support and resistance levels
 */
export function calculateSupportResistance(ohlcv, lookback = 50) {
  if (!ohlcv || ohlcv.length < lookback) {
    return { support: [], resistance: [] };
  }

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);

  // Find significant levels using pivot points
  const resistanceLevels = [];
  const supportLevels = [];

  for (let i = 2; i < Math.min(highs.length - 2, lookback); i++) {
    // Resistance: local high
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] &&
        highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      resistanceLevels.push(highs[i]);
    }

    // Support: local low
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] &&
        lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      supportLevels.push(lows[i]);
    }
  }

  // Cluster nearby levels (within 1%)
  const clusterLevels = (levels) => {
    if (levels.length === 0) return [];
    
    levels.sort((a, b) => a - b);
    const clusters = [];
    let currentCluster = [levels[0]];

    for (let i = 1; i < levels.length; i++) {
      if (Math.abs(levels[i] - levels[i - 1]) / levels[i - 1] < 0.01) {
        currentCluster.push(levels[i]);
      } else {
        clusters.push(average(currentCluster));
        currentCluster = [levels[i]];
      }
    }
    clusters.push(average(currentCluster));

    return clusters;
  };

  return {
    support: clusterLevels(supportLevels).slice(-3), // Top 3 support levels
    resistance: clusterLevels(resistanceLevels).slice(-3) // Top 3 resistance levels
  };
}

/**
 * Predict breakout direction based on recent price action
 */
export function predictBreakoutDirection(ohlcv, pattern) {
  if (!ohlcv || ohlcv.length < 5) {
    return pattern.breakoutDirection || 'neutral';
  }

  const recentCloses = ohlcv.slice(-5).map(c => c[4]);
  const recentVolumes = ohlcv.slice(-5).map(c => c[5]);
  const avgVolume = average(ohlcv.slice(-20).map(c => c[5]));

  // Check momentum
  const momentum = recentCloses[recentCloses.length - 1] - recentCloses[0];
  const volumeIncrease = recentVolumes[recentVolumes.length - 1] > avgVolume * 1.5;

  // Pattern-specific adjustments
  if (pattern.direction === 'bullish' && momentum > 0 && volumeIncrease) {
    return 'up';
  } else if (pattern.direction === 'bearish' && momentum < 0 && volumeIncrease) {
    return 'down';
  }

  return pattern.breakoutDirection || 'neutral';
}

export default {
  detectPatterns,
  calculateSupportResistance,
  predictBreakoutDirection
};
