/**
 * Risk Calculator Service
 * BACKEND-004: Implement Risk Management Agent
 * 
 * Provides comprehensive risk calculation functions:
 * - Value at Risk (VaR) using Historical Simulation and Variance-Covariance methods
 * - Position sizing based on Kelly Criterion and Fixed Fractional
 * - Correlation matrix calculation
 * - Stop-loss recommendations
 * - Portfolio risk metrics (Sharpe ratio, volatility, max drawdown)
 */

import { logger } from './logger.js';

/**
 * Calculate historical returns from price data
 * @param {Array} prices - Array of price objects [{timestamp, close}]
 * @returns {Array} Array of returns
 */
export function calculateReturns(prices) {
  if (!prices || prices.length < 2) {
    return [];
  }

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const return_value = (prices[i].close - prices[i - 1].close) / prices[i - 1].close;
    returns.push(return_value);
  }
  
  return returns;
}

/**
 * Calculate mean of an array
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(arr) {
  if (!arr || arr.length < 2) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate percentile
 */
function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;
  
  if (lower === upper) {
    return sorted[lower];
  }
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate Value at Risk (VaR) using Historical Simulation
 * 
 * @param {Array} returns - Historical returns
 * @param {number} confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @param {number} portfolioValue - Current portfolio value
 * @returns {Object} VaR metrics
 */
export function calculateHistoricalVaR(returns, confidenceLevel = 0.95, portfolioValue = 100000) {
  if (!returns || returns.length < 30) {
    logger.warn('Insufficient data for VaR calculation', { dataPoints: returns?.length });
    return {
      method: 'historical_simulation',
      var_1day: 0,
      var_1day_percent: 0,
      confidence_level: confidenceLevel,
      data_points: returns?.length || 0,
      warning: 'Insufficient data (minimum 30 days required)'
    };
  }

  // Calculate VaR at the specified confidence level
  const percentileLevel = (1 - confidenceLevel) * 100;
  const varReturn = percentile(returns, percentileLevel);
  const var1Day = Math.abs(varReturn * portfolioValue);
  
  return {
    method: 'historical_simulation',
    var_1day: var1Day,
    var_1day_percent: Math.abs(varReturn) * 100,
    confidence_level: confidenceLevel,
    data_points: returns.length,
    interpretation: `There is a ${(1 - confidenceLevel) * 100}% chance of losing more than $${var1Day.toFixed(2)} in one day`
  };
}

/**
 * Calculate Value at Risk (VaR) using Variance-Covariance method
 * 
 * @param {Array} returns - Historical returns
 * @param {number} confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @param {number} portfolioValue - Current portfolio value
 * @returns {Object} VaR metrics
 */
export function calculateParametricVaR(returns, confidenceLevel = 0.95, portfolioValue = 100000) {
  if (!returns || returns.length < 30) {
    return {
      method: 'parametric',
      var_1day: 0,
      var_1day_percent: 0,
      confidence_level: confidenceLevel,
      data_points: returns?.length || 0,
      warning: 'Insufficient data'
    };
  }

  const avgReturn = mean(returns);
  const stdDev = standardDeviation(returns);
  
  // Z-score for confidence levels (normal distribution)
  const zScores = {
    0.90: 1.282,
    0.95: 1.645,
    0.99: 2.326
  };
  
  const zScore = zScores[confidenceLevel] || 1.645;
  const varReturn = avgReturn - (zScore * stdDev);
  const var1Day = Math.abs(varReturn * portfolioValue);
  
  return {
    method: 'parametric',
    var_1day: var1Day,
    var_1day_percent: Math.abs(varReturn) * 100,
    mean_return: avgReturn,
    volatility: stdDev,
    confidence_level: confidenceLevel,
    data_points: returns.length
  };
}

/**
 * Calculate position size using Kelly Criterion
 * 
 * @param {number} winRate - Historical win rate (0-1)
 * @param {number} avgWin - Average win amount
 * @param {number} avgLoss - Average loss amount
 * @param {number} portfolioValue - Current portfolio value
 * @param {number} maxRisk - Maximum risk per trade (0-1)
 * @returns {Object} Position sizing recommendation
 */
export function calculateKellyPositionSize(winRate, avgWin, avgLoss, portfolioValue, maxRisk = 0.02) {
  if (winRate <= 0 || winRate >= 1 || avgWin <= 0 || avgLoss <= 0) {
    return {
      method: 'kelly_criterion',
      position_size: 0,
      position_percent: 0,
      warning: 'Invalid parameters for Kelly Criterion'
    };
  }

  const lossRate = 1 - winRate;
  const winLossRatio = avgWin / avgLoss;
  
  // Kelly percentage: f* = (p*w - q) / w
  // where p = win rate, q = loss rate, w = win/loss ratio
  let kellyPercent = (winRate * winLossRatio - lossRate) / winLossRatio;
  
  // Kelly can be negative (don't trade) or > 1 (leverage), so we clamp it
  kellyPercent = Math.max(0, Math.min(kellyPercent, maxRisk * 2));
  
  // Use fractional Kelly (typically 0.25 to 0.5 of full Kelly) for safety
  const fractionalKelly = kellyPercent * 0.5;
  const positionSize = portfolioValue * fractionalKelly;
  
  return {
    method: 'kelly_criterion',
    full_kelly_percent: kellyPercent * 100,
    fractional_kelly_percent: fractionalKelly * 100,
    position_size: positionSize,
    position_percent: fractionalKelly * 100,
    win_rate: winRate,
    win_loss_ratio: winLossRatio,
    recommendation: fractionalKelly > 0 ? 'Trade recommended' : 'No trade recommended'
  };
}

/**
 * Calculate position size using Fixed Fractional method
 * 
 * @param {number} portfolioValue - Current portfolio value
 * @param {number} riskPercent - Risk per trade (0-1)
 * @param {number} entryPrice - Entry price
 * @param {number} stopLossPrice - Stop loss price
 * @returns {Object} Position sizing recommendation
 */
export function calculateFixedFractionalSize(portfolioValue, riskPercent, entryPrice, stopLossPrice) {
  if (portfolioValue <= 0 || riskPercent <= 0 || entryPrice <= 0 || stopLossPrice <= 0) {
    return {
      method: 'fixed_fractional',
      position_size: 0,
      shares: 0,
      warning: 'Invalid parameters'
    };
  }

  const riskAmount = portfolioValue * riskPercent;
  const priceRisk = Math.abs(entryPrice - stopLossPrice);
  const shares = Math.floor(riskAmount / priceRisk);
  const positionValue = shares * entryPrice;
  
  return {
    method: 'fixed_fractional',
    position_size: positionValue,
    shares: shares,
    risk_amount: riskAmount,
    risk_per_share: priceRisk,
    position_percent: (positionValue / portfolioValue) * 100
  };
}

/**
 * Calculate correlation between two return series
 * 
 * @param {Array} returns1 - First return series
 * @param {Array} returns2 - Second return series
 * @returns {number} Correlation coefficient (-1 to 1)
 */
export function calculateCorrelation(returns1, returns2) {
  if (!returns1 || !returns2 || returns1.length !== returns2.length || returns1.length < 2) {
    return 0;
  }

  const n = returns1.length;
  const mean1 = mean(returns1);
  const mean2 = mean(returns2);
  
  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = returns1[i] - mean1;
    const diff2 = returns2[i] - mean2;
    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }
  
  const denominator = Math.sqrt(sum1Sq * sum2Sq);
  if (denominator === 0) return 0;
  
  return numerator / denominator;
}

/**
 * Calculate correlation matrix for multiple assets
 * 
 * @param {Object} assetReturns - Object with asset symbols as keys and return arrays as values
 * @returns {Object} Correlation matrix and analysis
 */
export function calculateCorrelationMatrix(assetReturns) {
  const symbols = Object.keys(assetReturns);
  const matrix = {};
  const highCorrelations = [];
  
  for (let i = 0; i < symbols.length; i++) {
    const symbol1 = symbols[i];
    matrix[symbol1] = {};
    
    for (let j = 0; j < symbols.length; j++) {
      const symbol2 = symbols[j];
      const correlation = calculateCorrelation(assetReturns[symbol1], assetReturns[symbol2]);
      matrix[symbol1][symbol2] = correlation;
      
      // Flag high correlations (excluding self-correlation)
      if (i < j && Math.abs(correlation) > 0.7) {
        highCorrelations.push({
          pair: [symbol1, symbol2],
          correlation: correlation,
          type: correlation > 0 ? 'positive' : 'negative'
        });
      }
    }
  }
  
  return {
    matrix,
    high_correlations: highCorrelations,
    diversification_score: calculateDiversificationScore(matrix),
    recommendation: highCorrelations.length > 0 
      ? 'Consider reducing exposure to highly correlated assets'
      : 'Portfolio shows good diversification'
  };
}

/**
 * Calculate diversification score (0-100)
 */
function calculateDiversificationScore(correlationMatrix) {
  const symbols = Object.keys(correlationMatrix);
  if (symbols.length < 2) return 100;
  
  let totalCorrelation = 0;
  let count = 0;
  
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      totalCorrelation += Math.abs(correlationMatrix[symbols[i]][symbols[j]]);
      count++;
    }
  }
  
  const avgCorrelation = count > 0 ? totalCorrelation / count : 0;
  const score = Math.max(0, Math.min(100, (1 - avgCorrelation) * 100));
  
  return Math.round(score);
}

/**
 * Calculate stop-loss recommendation using ATR (Average True Range)
 * 
 * @param {Array} priceData - Array of OHLC data [{high, low, close}]
 * @param {number} atrMultiplier - Multiplier for ATR (typically 2-3)
 * @param {number} currentPrice - Current price
 * @param {string} side - Trade side ('buy' or 'sell')
 * @returns {Object} Stop-loss recommendation
 */
export function calculateATRStopLoss(priceData, atrMultiplier = 2, currentPrice, side = 'buy') {
  if (!priceData || priceData.length < 14) {
    return {
      method: 'atr',
      stop_loss_price: 0,
      warning: 'Insufficient data for ATR calculation (minimum 14 periods)'
    };
  }

  // Calculate True Range for each period
  const trueRanges = [];
  for (let i = 1; i < priceData.length; i++) {
    const high = priceData[i].high;
    const low = priceData[i].low;
    const prevClose = priceData[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  // Calculate ATR (Average True Range) - use last 14 periods
  const atr = mean(trueRanges.slice(-14));
  const stopDistance = atr * atrMultiplier;
  
  let stopLossPrice;
  if (side.toLowerCase() === 'buy') {
    stopLossPrice = currentPrice - stopDistance;
  } else {
    stopLossPrice = currentPrice + stopDistance;
  }
  
  const stopLossPercent = (stopDistance / currentPrice) * 100;
  
  return {
    method: 'atr',
    atr: atr,
    atr_multiplier: atrMultiplier,
    stop_loss_price: stopLossPrice,
    stop_distance: stopDistance,
    stop_loss_percent: stopLossPercent,
    current_price: currentPrice,
    side: side,
    recommendation: `Place stop-loss at ${stopLossPrice.toFixed(2)} (${stopLossPercent.toFixed(2)}% from entry)`
  };
}

/**
 * Calculate stop-loss using percentage method
 * 
 * @param {number} entryPrice - Entry price
 * @param {number} stopPercent - Stop loss percentage (e.g., 0.02 for 2%)
 * @param {string} side - Trade side ('buy' or 'sell')
 * @returns {Object} Stop-loss recommendation
 */
export function calculatePercentageStopLoss(entryPrice, stopPercent, side = 'buy') {
  if (entryPrice <= 0 || stopPercent <= 0) {
    return {
      method: 'percentage',
      stop_loss_price: 0,
      warning: 'Invalid parameters'
    };
  }

  let stopLossPrice;
  if (side.toLowerCase() === 'buy') {
    stopLossPrice = entryPrice * (1 - stopPercent);
  } else {
    stopLossPrice = entryPrice * (1 + stopPercent);
  }
  
  return {
    method: 'percentage',
    stop_loss_price: stopLossPrice,
    stop_percent: stopPercent * 100,
    entry_price: entryPrice,
    side: side,
    potential_loss: Math.abs(entryPrice - stopLossPrice)
  };
}

/**
 * Calculate portfolio risk metrics
 * 
 * @param {Array} returns - Portfolio returns
 * @param {number} riskFreeRate - Risk-free rate (annual, e.g., 0.04 for 4%)
 * @returns {Object} Risk metrics
 */
export function calculatePortfolioRiskMetrics(returns, riskFreeRate = 0.04) {
  if (!returns || returns.length < 30) {
    return {
      volatility: 0,
      sharpe_ratio: 0,
      max_drawdown: 0,
      warning: 'Insufficient data'
    };
  }

  const avgReturn = mean(returns);
  const stdDev = standardDeviation(returns);
  
  // Annualize metrics (assuming daily returns)
  const annualizedReturn = avgReturn * 252;
  const annualizedVolatility = stdDev * Math.sqrt(252);
  
  // Sharpe Ratio
  const sharpeRatio = annualizedVolatility !== 0 
    ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
    : 0;
  
  // Maximum Drawdown
  const cumReturns = [1]; // Start with 1 (100%)
  for (let i = 0; i < returns.length; i++) {
    cumReturns.push(cumReturns[cumReturns.length - 1] * (1 + returns[i]));
  }
  
  let maxDrawdown = 0;
  let peak = cumReturns[0];
  
  for (let i = 1; i < cumReturns.length; i++) {
    if (cumReturns[i] > peak) {
      peak = cumReturns[i];
    }
    const drawdown = (peak - cumReturns[i]) / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  
  return {
    mean_return_daily: avgReturn,
    mean_return_annual: annualizedReturn,
    volatility_daily: stdDev,
    volatility_annual: annualizedVolatility,
    sharpe_ratio: sharpeRatio,
    max_drawdown: maxDrawdown,
    max_drawdown_percent: maxDrawdown * 100,
    data_points: returns.length,
    risk_assessment: getRiskAssessment(sharpeRatio, annualizedVolatility, maxDrawdown)
  };
}

/**
 * Get risk assessment based on metrics
 */
function getRiskAssessment(sharpeRatio, volatility, maxDrawdown) {
  const assessments = [];
  
  // Sharpe Ratio assessment
  if (sharpeRatio > 2) {
    assessments.push('Excellent risk-adjusted returns');
  } else if (sharpeRatio > 1) {
    assessments.push('Good risk-adjusted returns');
  } else if (sharpeRatio > 0) {
    assessments.push('Positive risk-adjusted returns');
  } else {
    assessments.push('Poor risk-adjusted returns');
  }
  
  // Volatility assessment
  if (volatility > 0.5) {
    assessments.push('Very high volatility');
  } else if (volatility > 0.3) {
    assessments.push('High volatility');
  } else if (volatility > 0.15) {
    assessments.push('Moderate volatility');
  } else {
    assessments.push('Low volatility');
  }
  
  // Max Drawdown assessment
  if (maxDrawdown > 0.5) {
    assessments.push('Severe drawdown risk');
  } else if (maxDrawdown > 0.3) {
    assessments.push('High drawdown risk');
  } else if (maxDrawdown > 0.15) {
    assessments.push('Moderate drawdown risk');
  } else {
    assessments.push('Low drawdown risk');
  }
  
  return assessments.join('; ');
}

export default {
  calculateReturns,
  calculateHistoricalVaR,
  calculateParametricVaR,
  calculateKellyPositionSize,
  calculateFixedFractionalSize,
  calculateCorrelation,
  calculateCorrelationMatrix,
  calculateATRStopLoss,
  calculatePercentageStopLoss,
  calculatePortfolioRiskMetrics
};
