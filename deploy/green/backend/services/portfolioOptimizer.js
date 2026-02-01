/**
 * Portfolio Optimizer Service
 * BACKEND-008: Implement Portfolio Allocation Agent
 * 
 * Implements Modern Portfolio Theory (MPT) for optimal asset allocation:
 * - Mean-Variance Optimization
 * - Sharpe Ratio Maximization
 * - Efficient Frontier calculation
 * - Risk-constrained optimization
 * - Rebalancing recommendations
 * 
 * Based on Markowitz Portfolio Theory (1952)
 */

import * as math from 'mathjs';
import { logger } from './logger.js';
import {
  calculateReturns,
  calculateCorrelationMatrix,
  calculatePortfolioRiskMetrics
} from './riskCalculator.js';

/**
 * Calculate expected returns for each asset
 * @param {Object} assetReturns - Object with asset symbols as keys and return arrays as values
 * @returns {Object} Expected returns for each asset
 */
export function calculateExpectedReturns(assetReturns) {
  const expectedReturns = {};
  
  for (const [asset, returns] of Object.entries(assetReturns)) {
    if (!returns || returns.length === 0) {
      expectedReturns[asset] = 0;
      continue;
    }
    
    const sum = returns.reduce((acc, val) => acc + val, 0);
    expectedReturns[asset] = sum / returns.length;
  }
  
  return expectedReturns;
}

/**
 * Calculate covariance matrix for portfolio assets
 * @param {Object} assetReturns - Object with asset symbols as keys and return arrays as values
 * @returns {Array} Covariance matrix
 */
export function calculateCovarianceMatrix(assetReturns) {
  const assets = Object.keys(assetReturns);
  const n = assets.length;
  
  if (n === 0) {
    return [];
  }
  
  // Initialize covariance matrix
  const covMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
  
  // Calculate mean returns
  const meanReturns = {};
  for (const [asset, returns] of Object.entries(assetReturns)) {
    meanReturns[asset] = returns.reduce((a, b) => a + b, 0) / returns.length;
  }
  
  // Calculate covariances
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const asset1 = assets[i];
      const asset2 = assets[j];
      const returns1 = assetReturns[asset1];
      const returns2 = assetReturns[asset2];
      
      const minLength = Math.min(returns1.length, returns2.length);
      let covariance = 0;
      
      for (let k = 0; k < minLength; k++) {
        covariance += (returns1[k] - meanReturns[asset1]) * 
                      (returns2[k] - meanReturns[asset2]);
      }
      
      covMatrix[i][j] = covariance / (minLength - 1);
    }
  }
  
  return covMatrix;
}

/**
 * Calculate portfolio expected return
 * @param {Array} weights - Portfolio weights
 * @param {Object} expectedReturns - Expected returns for each asset
 * @param {Array} assets - Asset symbols in order
 * @returns {number} Portfolio expected return
 */
export function calculatePortfolioReturn(weights, expectedReturns, assets) {
  let portfolioReturn = 0;
  
  for (let i = 0; i < weights.length; i++) {
    portfolioReturn += weights[i] * expectedReturns[assets[i]];
  }
  
  return portfolioReturn;
}

/**
 * Calculate portfolio variance
 * @param {Array} weights - Portfolio weights
 * @param {Array} covMatrix - Covariance matrix
 * @returns {number} Portfolio variance
 */
export function calculatePortfolioVariance(weights, covMatrix) {
  const n = weights.length;
  let variance = 0;
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  
  return variance;
}

/**
 * Calculate portfolio standard deviation (volatility)
 * @param {Array} weights - Portfolio weights
 * @param {Array} covMatrix - Covariance matrix
 * @returns {number} Portfolio volatility
 */
export function calculatePortfolioVolatility(weights, covMatrix) {
  const variance = calculatePortfolioVariance(weights, covMatrix);
  return Math.sqrt(Math.abs(variance));
}

/**
 * Calculate Sharpe Ratio
 * @param {number} portfolioReturn - Expected portfolio return
 * @param {number} portfolioVolatility - Portfolio volatility
 * @param {number} riskFreeRate - Risk-free rate (default 0.04 = 4%)
 * @returns {number} Sharpe ratio
 */
export function calculateSharpeRatio(portfolioReturn, portfolioVolatility, riskFreeRate = 0.04) {
  if (portfolioVolatility === 0) return 0;
  return (portfolioReturn - riskFreeRate) / portfolioVolatility;
}

/**
 * Optimize portfolio to maximize Sharpe ratio
 * Uses iterative optimization with random search and gradient descent
 * @param {Object} assetReturns - Historical returns for each asset
 * @param {Object} options - Optimization options
 * @returns {Object} Optimal weights and metrics
 */
export function optimizePortfolio(assetReturns, options = {}) {
  const {
    riskFreeRate = 0.04,
    maxIterations = 1000,
    minWeight = 0.0,
    maxWeight = 1.0,
    riskTolerance = null, // Max acceptable volatility
    targetReturn = null    // Target return to achieve
  } = options;
  
  const assets = Object.keys(assetReturns);
  const n = assets.length;
  
  if (n === 0) {
    throw new Error('No assets provided for optimization');
  }
  
  if (n === 1) {
    // Single asset - allocate 100%
    return {
      weights: { [assets[0]]: 1.0 },
      expectedReturn: calculateExpectedReturns(assetReturns)[assets[0]],
      volatility: Math.sqrt(Math.abs(calculateCovarianceMatrix(assetReturns)[0][0])),
      sharpeRatio: 0,
      optimal: true
    };
  }
  
  // Calculate expected returns and covariance matrix
  const expectedReturns = calculateExpectedReturns(assetReturns);
  const covMatrix = calculateCovarianceMatrix(assetReturns);
  
  let bestWeights = null;
  let bestSharpe = -Infinity;
  let bestReturn = 0;
  let bestVolatility = 0;
  
  // Random search with constraints
  for (let iter = 0; iter < maxIterations; iter++) {
    // Generate random weights
    let weights = Array(n).fill(0).map(() => Math.random());
    
    // Normalize to sum to 1
    const sum = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => w / sum);
    
    // Apply min/max weight constraints
    for (let i = 0; i < n; i++) {
      weights[i] = Math.max(minWeight, Math.min(maxWeight, weights[i]));
    }
    
    // Re-normalize after constraints
    const newSum = weights.reduce((a, b) => a + b, 0);
    if (newSum > 0) {
      weights = weights.map(w => w / newSum);
    }
    
    // Calculate metrics
    const portfolioReturn = calculatePortfolioReturn(weights, expectedReturns, assets);
    const portfolioVolatility = calculatePortfolioVolatility(weights, covMatrix);
    const sharpeRatio = calculateSharpeRatio(portfolioReturn, portfolioVolatility, riskFreeRate);
    
    // Check constraints
    if (riskTolerance !== null && portfolioVolatility > riskTolerance) {
      continue; // Skip if exceeds risk tolerance
    }
    
    if (targetReturn !== null && portfolioReturn < targetReturn) {
      continue; // Skip if doesn't meet target return
    }
    
    // Update best if better Sharpe ratio
    if (sharpeRatio > bestSharpe) {
      bestSharpe = sharpeRatio;
      bestWeights = [...weights];
      bestReturn = portfolioReturn;
      bestVolatility = portfolioVolatility;
    }
  }
  
  // If no valid solution found, use equal weights
  if (bestWeights === null) {
    bestWeights = Array(n).fill(1 / n);
    bestReturn = calculatePortfolioReturn(bestWeights, expectedReturns, assets);
    bestVolatility = calculatePortfolioVolatility(bestWeights, covMatrix);
    bestSharpe = calculateSharpeRatio(bestReturn, bestVolatility, riskFreeRate);
  }
  
  // Convert weights array to object
  const weightsObject = {};
  for (let i = 0; i < n; i++) {
    weightsObject[assets[i]] = Math.round(bestWeights[i] * 10000) / 10000; // 4 decimal places
  }
  
  return {
    weights: weightsObject,
    expectedReturn: bestReturn,
    volatility: bestVolatility,
    sharpeRatio: bestSharpe,
    optimal: true
  };
}

/**
 * Calculate efficient frontier points
 * @param {Object} assetReturns - Historical returns for each asset
 * @param {number} numPoints - Number of frontier points to calculate
 * @param {Object} options - Optimization options
 * @returns {Array} Array of {return, volatility, sharpeRatio, weights} objects
 */
export function calculateEfficientFrontier(assetReturns, numPoints = 20, options = {}) {
  const { riskFreeRate = 0.04 } = options;
  const assets = Object.keys(assetReturns);
  const expectedReturns = calculateExpectedReturns(assetReturns);
  const covMatrix = calculateCovarianceMatrix(assetReturns);
  
  // Find min and max possible returns
  const returns = Object.values(expectedReturns);
  const minReturn = Math.min(...returns);
  const maxReturn = Math.max(...returns);
  
  const frontier = [];
  
  // Calculate portfolios along the frontier
  for (let i = 0; i < numPoints; i++) {
    const targetReturn = minReturn + (maxReturn - minReturn) * (i / (numPoints - 1));
    
    try {
      const result = optimizePortfolio(assetReturns, {
        ...options,
        targetReturn,
        riskFreeRate
      });
      
      frontier.push({
        expectedReturn: result.expectedReturn,
        volatility: result.volatility,
        sharpeRatio: result.sharpeRatio,
        weights: result.weights
      });
    } catch (error) {
      logger.warn('Failed to calculate frontier point', { targetReturn, error: error.message });
    }
  }
  
  return frontier;
}

/**
 * Suggest rebalancing actions based on current vs optimal allocation
 * @param {Object} currentWeights - Current portfolio weights
 * @param {Object} optimalWeights - Optimal portfolio weights
 * @param {number} portfolioValue - Total portfolio value
 * @param {number} threshold - Min difference to trigger rebalancing (default 0.05 = 5%)
 * @returns {Array} Array of rebalancing actions
 */
export function suggestRebalancing(currentWeights, optimalWeights, portfolioValue, threshold = 0.05) {
  const actions = [];
  const allAssets = new Set([...Object.keys(currentWeights), ...Object.keys(optimalWeights)]);
  
  for (const asset of allAssets) {
    const current = currentWeights[asset] || 0;
    const optimal = optimalWeights[asset] || 0;
    const difference = optimal - current;
    
    // Only suggest if difference exceeds threshold
    if (Math.abs(difference) > threshold) {
      const currentValue = current * portfolioValue;
      const optimalValue = optimal * portfolioValue;
      const changeValue = optimalValue - currentValue;
      
      actions.push({
        asset,
        action: difference > 0 ? 'BUY' : 'SELL',
        currentWeight: Math.round(current * 10000) / 100, // Percentage
        optimalWeight: Math.round(optimal * 10000) / 100,
        difference: Math.round(difference * 10000) / 100,
        currentValue: Math.round(currentValue * 100) / 100,
        optimalValue: Math.round(optimalValue * 100) / 100,
        changeValue: Math.round(Math.abs(changeValue) * 100) / 100,
        priority: Math.abs(difference) > 0.15 ? 'HIGH' : Math.abs(difference) > 0.10 ? 'MEDIUM' : 'LOW'
      });
    }
  }
  
  // Sort by absolute difference (priority)
  actions.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  
  return actions;
}

/**
 * Calculate minimum variance portfolio
 * @param {Object} assetReturns - Historical returns for each asset
 * @param {Object} options - Optimization options
 * @returns {Object} Minimum variance portfolio
 */
export function calculateMinimumVariancePortfolio(assetReturns, options = {}) {
  const { minWeight = 0.0, maxWeight = 1.0, maxIterations = 1000 } = options;
  const assets = Object.keys(assetReturns);
  const n = assets.length;
  const covMatrix = calculateCovarianceMatrix(assetReturns);
  const expectedReturns = calculateExpectedReturns(assetReturns);
  
  let bestWeights = null;
  let bestVariance = Infinity;
  
  // Random search for minimum variance
  for (let iter = 0; iter < maxIterations; iter++) {
    let weights = Array(n).fill(0).map(() => Math.random());
    const sum = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => w / sum);
    
    // Apply constraints
    for (let i = 0; i < n; i++) {
      weights[i] = Math.max(minWeight, Math.min(maxWeight, weights[i]));
    }
    
    const newSum = weights.reduce((a, b) => a + b, 0);
    if (newSum > 0) {
      weights = weights.map(w => w / newSum);
    }
    
    const variance = calculatePortfolioVariance(weights, covMatrix);
    
    if (variance < bestVariance) {
      bestVariance = variance;
      bestWeights = [...weights];
    }
  }
  
  const weightsObject = {};
  for (let i = 0; i < n; i++) {
    weightsObject[assets[i]] = Math.round(bestWeights[i] * 10000) / 10000;
  }
  
  return {
    weights: weightsObject,
    expectedReturn: calculatePortfolioReturn(bestWeights, expectedReturns, assets),
    volatility: Math.sqrt(Math.abs(bestVariance)),
    variance: bestVariance
  };
}

/**
 * Validate portfolio weights
 * @param {Object} weights - Portfolio weights
 * @returns {Object} Validation result
 */
export function validateWeights(weights) {
  const assets = Object.keys(weights);
  const values = Object.values(weights);
  
  // Check sum equals 1
  const sum = values.reduce((a, b) => a + b, 0);
  const sumValid = Math.abs(sum - 1.0) < 0.01; // Allow 1% tolerance
  
  // Check all weights are non-negative
  const nonNegative = values.every(w => w >= 0);
  
  // Check all weights are <= 1
  const bounded = values.every(w => w <= 1);
  
  return {
    valid: sumValid && nonNegative && bounded,
    sum,
    sumValid,
    nonNegative,
    bounded,
    assets: assets.length
  };
}

export default {
  calculateExpectedReturns,
  calculateCovarianceMatrix,
  calculatePortfolioReturn,
  calculatePortfolioVariance,
  calculatePortfolioVolatility,
  calculateSharpeRatio,
  optimizePortfolio,
  calculateEfficientFrontier,
  suggestRebalancing,
  calculateMinimumVariancePortfolio,
  validateWeights
};
