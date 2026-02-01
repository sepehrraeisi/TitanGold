/**
 * Cycle Detector Module
 * Analyzes market cycles, seasonality patterns, and time-based effects
 * 
 * Purpose: Provides statistical analysis for market timing decisions
 * Date: 2026-01-06
 */

/**
 * Detects current market cycle phase
 * Uses moving averages, momentum indicators, volume analysis, and price patterns
 * 
 * @param {Array} priceData - Historical price data [{time, open, high, low, close, volume}]
 * @param {Object} options - Configuration {maShort: 50, maLong: 200, rsiPeriod: 14}
 * @returns {Object} - {phase, confidence, indicators, trend}
 */
export function detectCycle(priceData, options = {}) {
  const {
    maShort = 50,
    maLong = 200,
    rsiPeriod = 14,
    volumePeriod = 20
  } = options;
  
  if (!priceData || priceData.length < maLong) {
    return {
      phase: 'insufficient_data',
      confidence: 0,
      indicators: {},
      trend: 'unknown',
      error: `Need at least ${maLong} data points`
    };
  }
  
  try {
    // Calculate moving averages
    const prices = priceData.map(d => d.close);
    const volumes = priceData.map(d => d.volume || 0);
    
    const sma50 = calculateSMA(prices, maShort);
    const sma200 = calculateSMA(prices, maLong);
    const currentPrice = prices[prices.length - 1];
    
    // Calculate RSI for momentum
    const rsi = calculateRSI(prices, rsiPeriod);
    
    // Calculate MACD
    const macd = calculateMACD(prices);
    
    // Volume analysis
    const avgVolume = calculateSMA(volumes, volumePeriod);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    
    // Pattern recognition (higher highs/lower lows)
    const pattern = detectPricePattern(priceData.slice(-30)); // Last 30 periods
    
    // Determine cycle phase
    const indicators = {
      sma50,
      sma200,
      currentPrice,
      rsi,
      macd,
      avgVolume,
      currentVolume,
      volumeRatio,
      pattern
    };
    
    const phase = determineCyclePhase(indicators);
    const confidence = calculateCycleConfidence(indicators, phase);
    const trend = determineTrend(indicators);
    
    return {
      phase,
      confidence,
      indicators,
      trend,
      analysis: {
        goldenCross: currentPrice > sma50 && sma50 > sma200,
        deathCross: currentPrice < sma50 && sma50 < sma200,
        momentum: rsi > 60 ? 'bullish' : rsi < 40 ? 'bearish' : 'neutral',
        volumeConfirmation: volumeRatio > 1.2,
        patternStrength: pattern.strength
      }
    };
  } catch (error) {
    return {
      phase: 'error',
      confidence: 0,
      indicators: {},
      trend: 'unknown',
      error: error.message
    };
  }
}

/**
 * Analyzes seasonality patterns in historical data
 * Identifies monthly, quarterly, and yearly trends
 * 
 * @param {Array} historicalData - Historical price data with timestamps
 * @param {Object} options - Configuration {depth: 'monthly', minYears: 2}
 * @returns {Object} - Seasonality insights
 */
export function analyzeSeasonality(historicalData, options = {}) {
  const { depth = 'monthly', minYears = 2 } = options;
  
  if (!historicalData || historicalData.length === 0) {
    return {
      patterns: {},
      strongMonths: [],
      weakMonths: [],
      confidence: 0,
      error: 'Insufficient data'
    };
  }
  
  try {
    // Group data by time period
    const monthlyData = groupByMonth(historicalData);
    const quarterlyData = groupByQuarter(historicalData);
    
    // Calculate average returns per period
    const monthlyReturns = calculatePeriodReturns(monthlyData);
    const quarterlyReturns = calculatePeriodReturns(quarterlyData);
    
    // Identify strong and weak periods
    const strongMonths = identifyStrongPeriods(monthlyReturns, 0.6); // Top 60th percentile
    const weakMonths = identifyWeakPeriods(monthlyReturns, 0.4); // Bottom 40th percentile
    
    // Crypto-specific patterns
    const cryptoPatterns = detectCryptoSeasonality(historicalData);
    
    // Calculate confidence based on data consistency
    const confidence = calculateSeasonalityConfidence(monthlyReturns, historicalData.length, minYears);
    
    return {
      patterns: {
        monthly: monthlyReturns,
        quarterly: quarterlyReturns,
        cryptoSpecific: cryptoPatterns
      },
      strongMonths,
      weakMonths,
      confidence,
      recommendations: {
        favorablePeriods: strongMonths.map(m => monthName(m)),
        unfavorablePeriods: weakMonths.map(m => monthName(m)),
        currentMonth: new Date().getMonth() + 1,
        isCurrentMonthFavorable: strongMonths.includes(new Date().getMonth() + 1)
      }
    };
  } catch (error) {
    return {
      patterns: {},
      strongMonths: [],
      weakMonths: [],
      confidence: 0,
      error: error.message
    };
  }
}

/**
 * Analyzes time-of-day and day-of-week effects
 * Identifies optimal trading hours and days
 * 
 * @param {Array} intradayData - Recent intraday price data with timestamps
 * @param {Object} options - Configuration {considerWeekend: true, timezone: 'UTC'}
 * @returns {Object} - Time-based patterns
 */
export function analyzeTimeEffects(intradayData, options = {}) {
  const { considerWeekend = true, timezone = 'UTC' } = options;
  
  if (!intradayData || intradayData.length < 24) { // Need at least 24 hours
    return {
      hourlyPatterns: {},
      dailyPatterns: {},
      optimalTimes: [],
      confidence: 0,
      error: 'Insufficient intraday data'
    };
  }
  
  try {
    // Group by hour of day (UTC)
    const hourlyData = groupByHour(intradayData, timezone);
    const hourlyVolatility = calculateHourlyVolatility(hourlyData);
    const hourlyVolume = calculateHourlyVolume(hourlyData);
    
    // Group by day of week
    const dailyData = groupByDayOfWeek(intradayData);
    const dailyReturns = calculateDailyReturns(dailyData);
    const dailyVolatility = calculateDailyVolatility(dailyData);
    
    // Weekend effect (crypto markets trade 24/7)
    const weekendEffect = considerWeekend ? analyzeWeekendEffect(dailyData) : null;
    
    // Identify optimal trading times
    const optimalHours = identifyOptimalHours(hourlyVolatility, hourlyVolume);
    const optimalDays = identifyOptimalDays(dailyReturns, dailyVolatility);
    
    // Trading session analysis (Asian, European, American hours)
    const sessions = analyzeTradingSessions(hourlyData);
    
    const confidence = calculateTimeEffectsConfidence(intradayData.length, hourlyData, dailyData);
    
    return {
      hourlyPatterns: {
        volatility: hourlyVolatility,
        volume: hourlyVolume,
        optimalHours
      },
      dailyPatterns: {
        returns: dailyReturns,
        volatility: dailyVolatility,
        optimalDays
      },
      weekendEffect,
      tradingSessions: sessions,
      optimalTimes: {
        hours: optimalHours,
        days: optimalDays
      },
      confidence,
      recommendations: {
        bestHoursUTC: optimalHours.slice(0, 3).map(h => `${h}:00 UTC`),
        bestDays: optimalDays.slice(0, 2).map(d => dayName(d)),
        avoidWeekend: weekendEffect?.shouldAvoid || false
      }
    };
  } catch (error) {
    return {
      hourlyPatterns: {},
      dailyPatterns: {},
      optimalTimes: [],
      confidence: 0,
      error: error.message
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(data, period) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50; // Neutral
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
function calculateMACD(prices) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12 - ema26;
  // Simplified: signal line would be EMA of MACD line
  const signal = macdLine * 0.9; // Approximation
  const histogram = macdLine - signal;
  
  return { value: macdLine, signal, histogram };
}

/**
 * Calculate Exponential Moving Average
 */
function calculateEMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1];
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * Detect price pattern (higher highs/lower lows)
 */
function detectPricePattern(recentData) {
  if (recentData.length < 10) {
    return { type: 'unknown', strength: 0 };
  }
  
  const highs = recentData.map(d => d.high);
  const lows = recentData.map(d => d.low);
  
  // Check for higher highs and higher lows (bullish)
  const higherHighs = highs.slice(-5).every((h, i, arr) => i === 0 || h >= arr[i - 1]);
  const higherLows = lows.slice(-5).every((l, i, arr) => i === 0 || l >= arr[i - 1]);
  
  // Check for lower highs and lower lows (bearish)
  const lowerHighs = highs.slice(-5).every((h, i, arr) => i === 0 || h <= arr[i - 1]);
  const lowerLows = lows.slice(-5).every((l, i, arr) => i === 0 || l <= arr[i - 1]);
  
  if (higherHighs && higherLows) {
    return { type: 'bullish', strength: 0.8 };
  } else if (lowerHighs && lowerLows) {
    return { type: 'bearish', strength: 0.8 };
  } else {
    return { type: 'consolidation', strength: 0.5 };
  }
}

/**
 * Determine cycle phase from indicators
 */
function determineCyclePhase(indicators) {
  const { currentPrice, sma50, sma200, rsi, macd, volumeRatio, pattern } = indicators;
  
  // Golden Cross: Price > SMA50 > SMA200
  const goldenCross = currentPrice > sma50 && sma50 > sma200;
  
  // Death Cross: Price < SMA50 < SMA200
  const deathCross = currentPrice < sma50 && sma50 < sma200;
  
  // Bull market conditions
  if (goldenCross && rsi > 50 && macd.histogram > 0 && pattern.type === 'bullish') {
    return 'bull';
  }
  
  // Bear market conditions
  if (deathCross && rsi < 50 && macd.histogram < 0 && pattern.type === 'bearish') {
    return 'bear';
  }
  
  // Strong bull if RSI and volume confirm
  if (goldenCross && rsi > 60 && volumeRatio > 1.2) {
    return 'bull';
  }
  
  // Strong bear if RSI and volume confirm
  if (deathCross && rsi < 40 && volumeRatio > 1.2) {
    return 'bear';
  }
  
  // Default to consolidation
  return 'consolidation';
}

/**
 * Calculate cycle confidence
 */
function calculateCycleConfidence(indicators, phase) {
  let confidence = 0.5; // Base confidence
  
  const { currentPrice, sma50, sma200, rsi, macd, volumeRatio, pattern } = indicators;
  
  // Add confidence for each confirming indicator
  if (phase === 'bull') {
    if (currentPrice > sma50) confidence += 0.1;
    if (sma50 > sma200) confidence += 0.1;
    if (rsi > 60) confidence += 0.1;
    if (macd.histogram > 0) confidence += 0.1;
    if (volumeRatio > 1.2) confidence += 0.1;
    if (pattern.type === 'bullish') confidence += pattern.strength * 0.1;
  } else if (phase === 'bear') {
    if (currentPrice < sma50) confidence += 0.1;
    if (sma50 < sma200) confidence += 0.1;
    if (rsi < 40) confidence += 0.1;
    if (macd.histogram < 0) confidence += 0.1;
    if (volumeRatio > 1.2) confidence += 0.1;
    if (pattern.type === 'bearish') confidence += pattern.strength * 0.1;
  }
  
  return Math.min(confidence, 0.95); // Cap at 95%
}

/**
 * Determine trend direction
 */
function determineTrend(indicators) {
  const { currentPrice, sma50, sma200 } = indicators;
  
  if (currentPrice > sma50 && sma50 > sma200) return 'uptrend';
  if (currentPrice < sma50 && sma50 < sma200) return 'downtrend';
  return 'sideways';
}

/**
 * Group data by month
 */
function groupByMonth(data) {
  const grouped = {};
  data.forEach(d => {
    const date = new Date(d.time);
    const month = date.getMonth() + 1; // 1-12
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(d);
  });
  return grouped;
}

/**
 * Group data by quarter
 */
function groupByQuarter(data) {
  const grouped = {};
  data.forEach(d => {
    const date = new Date(d.time);
    const quarter = Math.floor(date.getMonth() / 3) + 1; // 1-4
    if (!grouped[quarter]) grouped[quarter] = [];
    grouped[quarter].push(d);
  });
  return grouped;
}

/**
 * Calculate returns for grouped periods
 */
function calculatePeriodReturns(groupedData) {
  const returns = {};
  for (const [period, data] of Object.entries(groupedData)) {
    if (data.length < 2) {
      returns[period] = 0;
      continue;
    }
    const firstPrice = data[0].close;
    const lastPrice = data[data.length - 1].close;
    returns[period] = ((lastPrice - firstPrice) / firstPrice) * 100;
  }
  return returns;
}

/**
 * Identify strong periods (top performers)
 */
function identifyStrongPeriods(returns, threshold = 0.6) {
  const values = Object.values(returns);
  const sortedValues = [...values].sort((a, b) => b - a);
  const cutoff = sortedValues[Math.floor(values.length * threshold)];
  
  return Object.keys(returns)
    .filter(key => returns[key] >= cutoff)
    .map(Number);
}

/**
 * Identify weak periods (bottom performers)
 */
function identifyWeakPeriods(returns, threshold = 0.4) {
  const values = Object.values(returns);
  const sortedValues = [...values].sort((a, b) => a - b);
  const cutoff = sortedValues[Math.floor(values.length * threshold)];
  
  return Object.keys(returns)
    .filter(key => returns[key] <= cutoff)
    .map(Number);
}

/**
 * Detect crypto-specific seasonality (altseason, tax effects, etc.)
 */
function detectCryptoSeasonality(data) {
  // Simplified: Check December sell-off and Q1 strength
  const monthlyReturns = calculatePeriodReturns(groupByMonth(data));
  
  return {
    decemberEffect: monthlyReturns[12] || 0, // Year-end tax selling
    q1Strength: (monthlyReturns[1] + monthlyReturns[2] + monthlyReturns[3]) / 3 || 0,
    altseasonIndicator: monthlyReturns[1] > 5 ? 'likely' : 'unlikely' // Jan performance
  };
}

/**
 * Calculate seasonality confidence
 */
function calculateSeasonalityConfidence(returns, dataLength, minYears) {
  const yearsOfData = dataLength / 365;
  if (yearsOfData < minYears) {
    return 0.3; // Low confidence with insufficient data
  }
  
  // Higher confidence with more data and consistent patterns
  const consistency = calculateConsistency(Object.values(returns));
  return Math.min(0.5 + (yearsOfData / 10) * 0.3 + consistency * 0.2, 0.9);
}

/**
 * Calculate pattern consistency
 */
function calculateConsistency(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  // Lower std dev = higher consistency
  return Math.max(0, 1 - (stdDev / (Math.abs(mean) + 1)));
}

/**
 * Group data by hour of day
 */
function groupByHour(data, timezone = 'UTC') {
  const grouped = {};
  data.forEach(d => {
    const date = new Date(d.time);
    const hour = date.getUTCHours(); // 0-23
    if (!grouped[hour]) grouped[hour] = [];
    grouped[hour].push(d);
  });
  return grouped;
}

/**
 * Group data by day of week
 */
function groupByDayOfWeek(data) {
  const grouped = {};
  data.forEach(d => {
    const date = new Date(d.time);
    const day = date.getUTCDay(); // 0=Sunday, 6=Saturday
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(d);
  });
  return grouped;
}

/**
 * Calculate hourly volatility
 */
function calculateHourlyVolatility(hourlyData) {
  const volatility = {};
  for (const [hour, data] of Object.entries(hourlyData)) {
    if (data.length < 2) {
      volatility[hour] = 0;
      continue;
    }
    const prices = data.map(d => d.close);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    volatility[hour] = Math.sqrt(variance) / mean * 100; // % volatility
  }
  return volatility;
}

/**
 * Calculate hourly volume
 */
function calculateHourlyVolume(hourlyData) {
  const volume = {};
  for (const [hour, data] of Object.entries(hourlyData)) {
    volume[hour] = data.reduce((sum, d) => sum + (d.volume || 0), 0) / data.length;
  }
  return volume;
}

/**
 * Calculate daily returns
 */
function calculateDailyReturns(dailyData) {
  const returns = {};
  for (const [day, data] of Object.entries(dailyData)) {
    if (data.length < 2) {
      returns[day] = 0;
      continue;
    }
    const avgReturn = data.reduce((sum, d, i, arr) => {
      if (i === 0) return sum;
      return sum + ((d.close - arr[i-1].close) / arr[i-1].close);
    }, 0) / (data.length - 1) * 100;
    returns[day] = avgReturn;
  }
  return returns;
}

/**
 * Calculate daily volatility
 */
function calculateDailyVolatility(dailyData) {
  const volatility = {};
  for (const [day, data] of Object.entries(dailyData)) {
    if (data.length < 2) {
      volatility[day] = 0;
      continue;
    }
    const prices = data.map(d => d.close);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    volatility[day] = Math.sqrt(variance) / mean * 100;
  }
  return volatility;
}

/**
 * Analyze weekend effect
 */
function analyzeWeekendEffect(dailyData) {
  const weekdayVolatility = [];
  const weekendVolatility = [];
  
  [1, 2, 3, 4, 5].forEach(day => { // Mon-Fri
    if (dailyData[day]) {
      const vol = calculateDailyVolatility({ [day]: dailyData[day] })[day];
      weekdayVolatility.push(vol);
    }
  });
  
  [0, 6].forEach(day => { // Sun, Sat
    if (dailyData[day]) {
      const vol = calculateDailyVolatility({ [day]: dailyData[day] })[day];
      weekendVolatility.push(vol);
    }
  });
  
  const avgWeekday = weekdayVolatility.reduce((s, v) => s + v, 0) / weekdayVolatility.length || 0;
  const avgWeekend = weekendVolatility.reduce((s, v) => s + v, 0) / weekendVolatility.length || 0;
  
  return {
    weekdayVolatility: avgWeekday,
    weekendVolatility: avgWeekend,
    difference: avgWeekend - avgWeekday,
    shouldAvoid: avgWeekend > avgWeekday * 1.3 // 30% higher volatility
  };
}

/**
 * Identify optimal hours (low volatility, high volume)
 */
function identifyOptimalHours(volatility, volume) {
  const scores = {};
  for (const hour of Object.keys(volatility)) {
    // Lower volatility and higher volume = better
    const volScore = 1 / (volatility[hour] + 1);
    const volumeScore = volume[hour] || 0;
    scores[hour] = volScore + volumeScore;
  }
  
  return Object.keys(scores)
    .sort((a, b) => scores[b] - scores[a])
    .map(Number)
    .slice(0, 5); // Top 5 hours
}

/**
 * Identify optimal days
 */
function identifyOptimalDays(returns, volatility) {
  const scores = {};
  for (const day of Object.keys(returns)) {
    // Higher returns, lower volatility = better
    scores[day] = returns[day] / (volatility[day] + 1);
  }
  
  return Object.keys(scores)
    .sort((a, b) => scores[b] - scores[a])
    .map(Number)
    .slice(0, 3); // Top 3 days
}

/**
 * Analyze trading sessions (Asian, European, American)
 */
function analyzeTradingSessions(hourlyData) {
  const asian = [0, 1, 2, 3, 4, 5, 6, 7].filter(h => hourlyData[h]);
  const european = [8, 9, 10, 11, 12, 13, 14, 15].filter(h => hourlyData[h]);
  const american = [13, 14, 15, 16, 17, 18, 19, 20].filter(h => hourlyData[h]);
  
  return {
    asian: { active: asian.length > 0, hours: asian },
    european: { active: european.length > 0, hours: european },
    american: { active: american.length > 0, hours: american },
    overlap: { european_american: [13, 14, 15] } // High volume overlap
  };
}

/**
 * Calculate time effects confidence
 */
function calculateTimeEffectsConfidence(dataLength, hourlyData, dailyData) {
  const hoursCovered = Object.keys(hourlyData).length;
  const daysCovered = Object.keys(dailyData).length;
  
  // Need good coverage and sufficient data
  const hourCoverage = hoursCovered / 24;
  const dayCoverage = daysCovered / 7;
  const dataAdequacy = Math.min(dataLength / 100, 1); // 100+ data points ideal
  
  return (hourCoverage + dayCoverage + dataAdequacy) / 3;
}

/**
 * Helper: Month name
 */
function monthName(month) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[month - 1] || 'Unknown';
}

/**
 * Helper: Day name
 */
function dayName(day) {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[day] || 'Unknown';
}

export default {
  detectCycle,
  analyzeSeasonality,
  analyzeTimeEffects
};
