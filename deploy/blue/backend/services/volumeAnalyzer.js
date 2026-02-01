/**
 * Volume Analyzer Service
 * BACKEND-013: Implement Volume Analysis Agent
 * 
 * Provides comprehensive volume analysis:
 * - On-Balance Volume (OBV)
 * - Volume Weighted Average Price (VWAP)
 * - Volume Profile
 * - Volume Spike Detection
 * - Volume-based Trading Signals
 * 
 * Reference: Technical Analysis of Financial Markets by John Murphy
 */

import { logger } from './logger.js';

/**
 * Calculate On-Balance Volume (OBV)
 * OBV tracks cumulative volume flow based on price direction
 * 
 * @param {Array} ohlcv - OHLCV data [timestamp, open, high, low, close, volume]
 * @returns {Object} OBV analysis
 */
export function calculateOBV(ohlcv) {
  if (!ohlcv || ohlcv.length < 2) {
    throw new Error('Insufficient data for OBV calculation (minimum 2 candles required)');
  }

  const obv = [];
  let cumulative = 0;

  // First candle - initialize OBV at 0
  obv.push({
    timestamp: ohlcv[0][0],
    value: 0,
    volume: ohlcv[0][5]
  });

  // Calculate OBV for subsequent candles
  for (let i = 1; i < ohlcv.length; i++) {
    const currentClose = ohlcv[i][4];
    const previousClose = ohlcv[i - 1][4];
    const currentVolume = ohlcv[i][5];

    if (currentClose > previousClose) {
      // Price up - add volume
      cumulative += currentVolume;
    } else if (currentClose < previousClose) {
      // Price down - subtract volume
      cumulative -= currentVolume;
    }
    // If price unchanged, OBV stays the same

    obv.push({
      timestamp: ohlcv[i][0],
      value: cumulative,
      volume: currentVolume,
      change: currentClose - previousClose
    });
  }

  // Calculate OBV trend
  const recent = obv.slice(-20); // Last 20 periods
  const obvTrend = calculateTrend(recent.map(o => o.value));
  
  // Calculate divergence (price vs OBV)
  const priceData = ohlcv.slice(-20).map(candle => candle[4]);
  const priceTrend = calculateTrend(priceData);
  
  const divergence = detectDivergence(priceTrend, obvTrend);

  return {
    values: obv,
    current: obv[obv.length - 1].value,
    trend: obvTrend,
    divergence,
    signal: generateOBVSignal(obvTrend, divergence)
  };
}

/**
 * Calculate Volume Weighted Average Price (VWAP)
 * VWAP = Cumulative(Typical Price * Volume) / Cumulative(Volume)
 * 
 * @param {Array} ohlcv - OHLCV data
 * @returns {Object} VWAP analysis
 */
export function calculateVWAP(ohlcv) {
  if (!ohlcv || ohlcv.length === 0) {
    throw new Error('Insufficient data for VWAP calculation');
  }

  const vwap = [];
  let cumulativeTPV = 0; // Cumulative (Typical Price * Volume)
  let cumulativeVolume = 0;

  for (let i = 0; i < ohlcv.length; i++) {
    const high = ohlcv[i][2];
    const low = ohlcv[i][3];
    const close = ohlcv[i][4];
    const volume = ohlcv[i][5];

    // Typical Price = (High + Low + Close) / 3
    const typicalPrice = (high + low + close) / 3;
    
    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;

    const vwapValue = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;

    vwap.push({
      timestamp: ohlcv[i][0],
      value: vwapValue,
      price: close,
      volume: volume,
      deviation: ((close - vwapValue) / vwapValue) * 100
    });
  }

  const current = vwap[vwap.length - 1];
  const position = current.price > current.value ? 'above' : current.price < current.value ? 'below' : 'at';

  return {
    values: vwap,
    current: current.value,
    currentPrice: current.price,
    position,
    deviation: current.deviation,
    signal: generateVWAPSignal(position, current.deviation)
  };
}

/**
 * Generate Volume Profile
 * Shows volume distribution across price levels
 * 
 * @param {Array} ohlcv - OHLCV data
 * @param {number} bins - Number of price bins (default: 20)
 * @returns {Object} Volume profile
 */
export function generateVolumeProfile(ohlcv, bins = 20) {
  if (!ohlcv || ohlcv.length === 0) {
    throw new Error('Insufficient data for volume profile');
  }

  // Find price range
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  
  for (const candle of ohlcv) {
    const low = candle[3];
    const high = candle[2];
    minPrice = Math.min(minPrice, low);
    maxPrice = Math.max(maxPrice, high);
  }

  const priceRange = maxPrice - minPrice;
  const binSize = priceRange / bins;

  // Initialize bins
  const profile = Array.from({ length: bins }, (_, i) => ({
    priceLevel: minPrice + (i + 0.5) * binSize,
    priceMin: minPrice + i * binSize,
    priceMax: minPrice + (i + 1) * binSize,
    volume: 0,
    trades: 0
  }));

  // Distribute volume across bins
  for (const candle of ohlcv) {
    const high = candle[2];
    const low = candle[3];
    const close = candle[4];
    const volume = candle[5];

    // Simple approach: assign volume to bin containing close price
    const binIndex = Math.min(
      Math.floor((close - minPrice) / binSize),
      bins - 1
    );

    if (binIndex >= 0 && binIndex < bins) {
      profile[binIndex].volume += volume;
      profile[binIndex].trades += 1;
    }
  }

  // Find Point of Control (POC) - price level with highest volume
  const poc = profile.reduce((max, current) => 
    current.volume > max.volume ? current : max
  );

  // Find Value Area (70% of volume)
  const totalVolume = profile.reduce((sum, bin) => sum + bin.volume, 0);
  const targetVolume = totalVolume * 0.7;
  
  const sortedByVolume = [...profile].sort((a, b) => b.volume - a.volume);
  let valueAreaVolume = 0;
  const valueArea = [];
  
  for (const bin of sortedByVolume) {
    valueArea.push(bin);
    valueAreaVolume += bin.volume;
    if (valueAreaVolume >= targetVolume) break;
  }

  // Calculate Value Area High and Low
  const valueAreaPrices = valueArea.map(bin => bin.priceLevel).sort((a, b) => a - b);
  const valueAreaHigh = valueAreaPrices[valueAreaPrices.length - 1];
  const valueAreaLow = valueAreaPrices[0];

  const currentPrice = ohlcv[ohlcv.length - 1][4];

  return {
    profile: profile.sort((a, b) => b.volume - a.volume), // Sort by volume descending
    pointOfControl: poc,
    valueAreaHigh,
    valueAreaLow,
    totalVolume,
    currentPrice,
    analysis: {
      position: currentPrice > valueAreaHigh ? 'above_value' :
                currentPrice < valueAreaLow ? 'below_value' : 'in_value',
      nearPOC: Math.abs(currentPrice - poc.priceLevel) / currentPrice < 0.01
    }
  };
}

/**
 * Detect volume spikes and anomalies
 * 
 * @param {Array} ohlcv - OHLCV data
 * @param {number} threshold - Spike threshold multiplier (default: 2.0)
 * @returns {Object} Volume anomalies
 */
export function detectVolumeSpikes(ohlcv, threshold = 2.0) {
  if (!ohlcv || ohlcv.length < 20) {
    throw new Error('Insufficient data for volume spike detection (minimum 20 candles)');
  }

  // Calculate average volume (excluding last candle)
  const volumes = ohlcv.slice(0, -1).map(candle => candle[5]);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  
  // Calculate standard deviation
  const variance = volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length;
  const stdDev = Math.sqrt(variance);

  const spikes = [];
  const recentSpikes = [];

  // Detect spikes
  for (let i = 0; i < ohlcv.length; i++) {
    const volume = ohlcv[i][5];
    const close = ohlcv[i][4];
    const open = ohlcv[i][1];
    const priceChange = ((close - open) / open) * 100;

    if (volume > avgVolume * threshold) {
      const spike = {
        timestamp: ohlcv[i][0],
        volume: volume,
        avgVolume: avgVolume,
        multiplier: volume / avgVolume,
        priceChange: priceChange,
        direction: priceChange > 0 ? 'bullish' : priceChange < 0 ? 'bearish' : 'neutral',
        severity: volume > avgVolume * threshold * 1.5 ? 'high' : 'medium'
      };

      spikes.push(spike);

      // Track recent spikes (last 10 candles)
      if (i >= ohlcv.length - 10) {
        recentSpikes.push(spike);
      }
    }
  }

  const currentVolume = ohlcv[ohlcv.length - 1][5];
  const volumeRatio = currentVolume / avgVolume;

  return {
    avgVolume,
    stdDev,
    threshold,
    currentVolume,
    volumeRatio,
    isSpike: volumeRatio > threshold,
    spikes,
    recentSpikes,
    totalSpikes: spikes.length,
    analysis: {
      volumeTrend: calculateVolumeTrend(ohlcv.slice(-20)),
      buying_pressure: calculateBuyingPressure(ohlcv.slice(-10)),
      selling_pressure: calculateSellingPressure(ohlcv.slice(-10))
    }
  };
}

/**
 * Generate volume-based trading signals
 * 
 * @param {Object} obvAnalysis - OBV analysis
 * @param {Object} vwapAnalysis - VWAP analysis
 * @param {Object} volumeProfile - Volume profile
 * @param {Object} volumeSpikes - Volume spikes analysis
 * @returns {Object} Trading signals
 */
export function generateVolumeSignals(obvAnalysis, vwapAnalysis, volumeProfile, volumeSpikes) {
  const signals = [];
  let overallSignal = 'NEUTRAL';
  let confidence = 50;

  // OBV Signals
  if (obvAnalysis.signal.type === 'bullish') {
    signals.push({
      indicator: 'OBV',
      signal: 'BUY',
      reason: obvAnalysis.signal.reason,
      strength: obvAnalysis.signal.strength
    });
    confidence += 10;
  } else if (obvAnalysis.signal.type === 'bearish') {
    signals.push({
      indicator: 'OBV',
      signal: 'SELL',
      reason: obvAnalysis.signal.reason,
      strength: obvAnalysis.signal.strength
    });
    confidence -= 10;
  }

  // VWAP Signals
  if (vwapAnalysis.signal.type === 'bullish') {
    signals.push({
      indicator: 'VWAP',
      signal: 'BUY',
      reason: vwapAnalysis.signal.reason,
      strength: vwapAnalysis.signal.strength
    });
    confidence += 10;
  } else if (vwapAnalysis.signal.type === 'bearish') {
    signals.push({
      indicator: 'VWAP',
      signal: 'SELL',
      reason: vwapAnalysis.signal.reason,
      strength: vwapAnalysis.signal.strength
    });
    confidence -= 10;
  }

  // Volume Profile Signals
  if (volumeProfile.analysis.position === 'below_value') {
    signals.push({
      indicator: 'Volume Profile',
      signal: 'BUY',
      reason: 'Price below value area - potential bounce opportunity',
      strength: 'medium'
    });
    confidence += 5;
  } else if (volumeProfile.analysis.position === 'above_value') {
    signals.push({
      indicator: 'Volume Profile',
      signal: 'SELL',
      reason: 'Price above value area - potential pullback',
      strength: 'medium'
    });
    confidence -= 5;
  }

  // Volume Spike Signals
  if (volumeSpikes.isSpike) {
    const recentSpike = volumeSpikes.recentSpikes[volumeSpikes.recentSpikes.length - 1];
    if (recentSpike) {
      if (recentSpike.direction === 'bullish') {
        signals.push({
          indicator: 'Volume Spike',
          signal: 'BUY',
          reason: `High volume bullish spike (${recentSpike.multiplier.toFixed(1)}x average)`,
          strength: recentSpike.severity === 'high' ? 'strong' : 'medium'
        });
        confidence += 15;
      } else if (recentSpike.direction === 'bearish') {
        signals.push({
          indicator: 'Volume Spike',
          signal: 'SELL',
          reason: `High volume bearish spike (${recentSpike.multiplier.toFixed(1)}x average)`,
          strength: recentSpike.severity === 'high' ? 'strong' : 'medium'
        });
        confidence -= 15;
      }
    }
  }

  // Buying/Selling Pressure
  const buyPressure = volumeSpikes.analysis.buying_pressure;
  const sellPressure = volumeSpikes.analysis.selling_pressure;

  if (buyPressure > sellPressure * 1.5) {
    signals.push({
      indicator: 'Volume Pressure',
      signal: 'BUY',
      reason: `Strong buying pressure (${(buyPressure / (buyPressure + sellPressure) * 100).toFixed(1)}%)`,
      strength: 'medium'
    });
    confidence += 10;
  } else if (sellPressure > buyPressure * 1.5) {
    signals.push({
      indicator: 'Volume Pressure',
      signal: 'SELL',
      reason: `Strong selling pressure (${(sellPressure / (buyPressure + sellPressure) * 100).toFixed(1)}%)`,
      strength: 'medium'
    });
    confidence -= 10;
  }

  // Determine overall signal
  const buySignals = signals.filter(s => s.signal === 'BUY').length;
  const sellSignals = signals.filter(s => s.signal === 'SELL').length;

  if (buySignals > sellSignals && confidence > 60) {
    overallSignal = 'BUY';
  } else if (sellSignals > buySignals && confidence < 40) {
    overallSignal = 'SELL';
  } else {
    overallSignal = 'HOLD';
  }

  // Normalize confidence to 0-100
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    overallSignal,
    confidence,
    signals,
    summary: {
      buySignals,
      sellSignals,
      neutralSignals: signals.length - buySignals - sellSignals,
      totalSignals: signals.length
    }
  };
}

/**
 * Perform comprehensive volume analysis
 * 
 * @param {Array} ohlcv - OHLCV data
 * @param {Object} options - Analysis options
 * @returns {Object} Complete volume analysis
 */
export function analyzeVolume(ohlcv, options = {}) {
  const startTime = Date.now();

  try {
    if (!ohlcv || ohlcv.length < 20) {
      throw new Error('Insufficient data for volume analysis (minimum 20 candles required)');
    }

    logger.info('🔊 Starting volume analysis', {
      dataPoints: ohlcv.length,
      symbol: options.symbol || 'unknown'
    });

    // Calculate all indicators
    const obv = calculateOBV(ohlcv);
    const vwap = calculateVWAP(ohlcv);
    const volumeProfile = generateVolumeProfile(ohlcv, options.profileBins || 20);
    const volumeSpikes = detectVolumeSpikes(ohlcv, options.spikeThreshold || 2.0);

    // Generate trading signals
    const signals = generateVolumeSignals(obv, vwap, volumeProfile, volumeSpikes);

    const executionTime = Date.now() - startTime;

    const result = {
      obv,
      vwap,
      volumeProfile,
      volumeSpikes,
      signals,
      metadata: {
        dataPoints: ohlcv.length,
        executionTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    logger.info('✅ Volume analysis completed', {
      executionTime,
      overallSignal: signals.overallSignal,
      confidence: signals.confidence
    });

    return result;

  } catch (error) {
    logger.error('❌ Volume analysis failed', error);
    throw error;
  }
}

// ==================== Helper Functions ====================

/**
 * Calculate trend from series of values
 */
function calculateTrend(values) {
  if (values.length < 2) return 'flat';

  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  if (slope > 0.01) return 'up';
  if (slope < -0.01) return 'down';
  return 'flat';
}

/**
 * Detect divergence between price and indicator
 */
function detectDivergence(priceTrend, indicatorTrend) {
  if (priceTrend === 'up' && indicatorTrend === 'down') {
    return { type: 'bearish', strength: 'strong' };
  } else if (priceTrend === 'down' && indicatorTrend === 'up') {
    return { type: 'bullish', strength: 'strong' };
  }
  return { type: 'none', strength: null };
}

/**
 * Generate OBV signal
 */
function generateOBVSignal(trend, divergence) {
  if (divergence.type === 'bullish') {
    return {
      type: 'bullish',
      reason: 'Bullish divergence: Price falling but OBV rising',
      strength: 'strong'
    };
  } else if (divergence.type === 'bearish') {
    return {
      type: 'bearish',
      reason: 'Bearish divergence: Price rising but OBV falling',
      strength: 'strong'
    };
  } else if (trend === 'up') {
    return {
      type: 'bullish',
      reason: 'OBV trending up - accumulation',
      strength: 'medium'
    };
  } else if (trend === 'down') {
    return {
      type: 'bearish',
      reason: 'OBV trending down - distribution',
      strength: 'medium'
    };
  }
  return {
    type: 'neutral',
    reason: 'OBV flat - no clear volume trend',
    strength: 'weak'
  };
}

/**
 * Generate VWAP signal
 */
function generateVWAPSignal(position, deviation) {
  if (position === 'above' && Math.abs(deviation) > 2) {
    return {
      type: 'bearish',
      reason: `Price ${deviation.toFixed(2)}% above VWAP - potential pullback`,
      strength: Math.abs(deviation) > 5 ? 'strong' : 'medium'
    };
  } else if (position === 'below' && Math.abs(deviation) > 2) {
    return {
      type: 'bullish',
      reason: `Price ${Math.abs(deviation).toFixed(2)}% below VWAP - potential bounce`,
      strength: Math.abs(deviation) > 5 ? 'strong' : 'medium'
    };
  } else if (position === 'above') {
    return {
      type: 'bullish',
      reason: 'Price above VWAP - bullish momentum',
      strength: 'weak'
    };
  } else if (position === 'below') {
    return {
      type: 'bearish',
      reason: 'Price below VWAP - bearish momentum',
      strength: 'weak'
    };
  }
  return {
    type: 'neutral',
    reason: 'Price at VWAP - equilibrium',
    strength: 'weak'
  };
}

/**
 * Calculate volume trend
 */
function calculateVolumeTrend(ohlcv) {
  const volumes = ohlcv.map(candle => candle[5]);
  const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
  const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  if (secondAvg > firstAvg * 1.2) return 'increasing';
  if (secondAvg < firstAvg * 0.8) return 'decreasing';
  return 'stable';
}

/**
 * Calculate buying pressure
 */
function calculateBuyingPressure(ohlcv) {
  let buyVolume = 0;
  
  for (const candle of ohlcv) {
    const close = candle[4];
    const open = candle[1];
    const volume = candle[5];
    
    if (close > open) {
      buyVolume += volume;
    }
  }
  
  return buyVolume;
}

/**
 * Calculate selling pressure
 */
function calculateSellingPressure(ohlcv) {
  let sellVolume = 0;
  
  for (const candle of ohlcv) {
    const close = candle[4];
    const open = candle[1];
    const volume = candle[5];
    
    if (close < open) {
      sellVolume += volume;
    }
  }
  
  return sellVolume;
}

export default {
  calculateOBV,
  calculateVWAP,
  generateVolumeProfile,
  detectVolumeSpikes,
  generateVolumeSignals,
  analyzeVolume
};
