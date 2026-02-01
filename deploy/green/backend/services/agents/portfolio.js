/**
 * Portfolio Allocation Agent
 * BACKEND-008: Implement Portfolio Allocation Agent
 * 
 * Provides optimal portfolio allocation using Modern Portfolio Theory (MPT):
 * - Optimal asset allocation to maximize Sharpe ratio
 * - Risk-constrained optimization based on user tolerance
 * - Rebalancing recommendations
 * - Integration with Risk Management Agent
 * - Efficient frontier calculation
 * 
 * Based on Markowitz Portfolio Theory (1952)
 */

import { logger } from '../logger.js';
import {
  optimizePortfolio,
  calculateEfficientFrontier,
  suggestRebalancing,
  calculateMinimumVariancePortfolio,
  calculateExpectedReturns,
  calculateCovarianceMatrix,
  calculatePortfolioReturn,
  calculatePortfolioVolatility,
  calculateSharpeRatio,
  validateWeights
} from '../portfolioOptimizer.js';
import { calculateReturns, calculatePortfolioRiskMetrics } from '../riskCalculator.js';

// Cache for storing optimization results
const optimizationCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Run portfolio allocation optimization
 * @param {Object} params - Agent parameters
 * @returns {Object} Optimization results with recommended allocation
 */
export async function run({ userId, portfolio, config = {} }) {
  const startTime = Date.now();
  logger.info('🤖 Portfolio Allocation Agent started', { userId, assets: portfolio?.assets?.length });

  try {
    // Validate inputs
    if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) {
      throw new Error('Portfolio with assets is required');
    }

    // Extract configuration
    const {
      riskTolerance = 'moderate',      // 'conservative', 'moderate', 'aggressive'
      riskFreeRate = 0.04,              // 4% annual risk-free rate
      rebalanceThreshold = 0.05,        // 5% difference triggers rebalancing
      minWeight = 0.0,                  // Minimum asset weight
      maxWeight = 1.0,                  // Maximum asset weight
      optimizationGoal = 'sharpe',      // 'sharpe', 'min_variance', 'target_return'
      targetReturn = null,              // Target return (if optimizationGoal = 'target_return')
      includeEfficientFrontier = false  // Calculate efficient frontier
    } = config;

    // Map risk tolerance to max volatility
    const maxVolatility = getRiskToleranceVolatility(riskTolerance);

    // Check cache
    const cacheKey = generateCacheKey(portfolio, config);
    const cached = optimizationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.info('📊 Returning cached optimization', { age: Date.now() - cached.timestamp });
      return {
        ...cached.data,
        from_cache: true,
        cache_age_ms: Date.now() - cached.timestamp
      };
    }

    // Prepare asset returns data
    const assetReturns = {};
    const currentWeights = {};
    const assetPrices = {};
    let totalValue = 0;

    for (const asset of portfolio.assets) {
      if (!asset.symbol || !asset.priceHistory || asset.priceHistory.length < 2) {
        logger.warn('Insufficient data for asset', { symbol: asset.symbol });
        continue;
      }

      // Calculate returns
      const returns = calculateReturns(asset.priceHistory);
      assetReturns[asset.symbol] = returns;

      // Calculate current weight
      const currentPrice = asset.priceHistory[asset.priceHistory.length - 1].close;
      const assetValue = (asset.quantity || 0) * currentPrice;
      totalValue += assetValue;
      assetPrices[asset.symbol] = currentPrice;
    }

    // Calculate current weights
    for (const asset of portfolio.assets) {
      if (assetPrices[asset.symbol]) {
        const currentPrice = assetPrices[asset.symbol];
        const assetValue = (asset.quantity || 0) * currentPrice;
        currentWeights[asset.symbol] = totalValue > 0 ? assetValue / totalValue : 0;
      }
    }

    // Validate we have enough data
    if (Object.keys(assetReturns).length < 2) {
      throw new Error('At least 2 assets with sufficient price history are required');
    }

    logger.info('🔄 Running portfolio optimization', {
      assets: Object.keys(assetReturns).length,
      goal: optimizationGoal,
      riskTolerance
    });

    // Run optimization based on goal
    let optimizationResult;
    
    if (optimizationGoal === 'min_variance') {
      optimizationResult = calculateMinimumVariancePortfolio(assetReturns, {
        minWeight,
        maxWeight
      });
    } else if (optimizationGoal === 'target_return') {
      optimizationResult = optimizePortfolio(assetReturns, {
        riskFreeRate,
        minWeight,
        maxWeight,
        targetReturn,
        riskTolerance: maxVolatility
      });
    } else {
      // Default: maximize Sharpe ratio
      optimizationResult = optimizePortfolio(assetReturns, {
        riskFreeRate,
        minWeight,
        maxWeight,
        riskTolerance: maxVolatility
      });
    }

    // Calculate rebalancing actions
    const rebalancingActions = suggestRebalancing(
      currentWeights,
      optimizationResult.weights,
      totalValue,
      rebalanceThreshold
    );

    // Calculate additional risk metrics
    const expectedReturns = calculateExpectedReturns(assetReturns);
    const covMatrix = calculateCovarianceMatrix(assetReturns);

    // Current portfolio metrics
    const currentPortfolioMetrics = calculateCurrentPortfolioMetrics(
      currentWeights,
      expectedReturns,
      covMatrix,
      Object.keys(assetReturns),
      riskFreeRate
    );

    // Optimal portfolio metrics
    const optimalPortfolioMetrics = {
      expectedReturn: optimizationResult.expectedReturn,
      volatility: optimizationResult.volatility,
      sharpeRatio: optimizationResult.sharpeRatio
    };

    // Calculate improvement
    const improvement = {
      returnImprovement: ((optimizationResult.expectedReturn - currentPortfolioMetrics.expectedReturn) / 
                         Math.abs(currentPortfolioMetrics.expectedReturn || 1)) * 100,
      volatilityReduction: ((currentPortfolioMetrics.volatility - optimizationResult.volatility) / 
                           (currentPortfolioMetrics.volatility || 1)) * 100,
      sharpeImprovement: optimizationResult.sharpeRatio - currentPortfolioMetrics.sharpeRatio
    };

    // Calculate efficient frontier if requested
    let efficientFrontier = null;
    if (includeEfficientFrontier) {
      efficientFrontier = calculateEfficientFrontier(assetReturns, 20, {
        riskFreeRate,
        minWeight,
        maxWeight
      });
    }

    // Prepare result
    const result = {
      agent_key: 'portfolio_allocation',
      user_id: userId,
      optimization_goal: optimizationGoal,
      risk_tolerance: riskTolerance,
      current_allocation: {
        weights: currentWeights,
        metrics: currentPortfolioMetrics,
        total_value: Math.round(totalValue * 100) / 100
      },
      optimal_allocation: {
        weights: optimizationResult.weights,
        metrics: optimalPortfolioMetrics,
        validation: validateWeights(optimizationResult.weights)
      },
      improvement,
      rebalancing: {
        required: rebalancingActions.length > 0,
        actions: rebalancingActions,
        estimated_trades: rebalancingActions.length
      },
      efficient_frontier: efficientFrontier,
      risk_metrics: {
        max_allowed_volatility: maxVolatility,
        current_volatility: currentPortfolioMetrics.volatility,
        optimal_volatility: optimizationResult.volatility,
        risk_free_rate: riskFreeRate
      },
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      _meta: {
        version: '1.0.0',
        method: 'modern_portfolio_theory',
        optimizer: 'random_search',
        confidence: calculateOptimizationConfidence(optimizationResult, improvement)
      }
    };

    // Cache the result
    optimizationCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    // Clean old cache entries
    cleanCache();

    logger.info('✅ Portfolio optimization completed', {
      sharpeRatio: optimizationResult.sharpeRatio,
      rebalancingRequired: rebalancingActions.length > 0,
      executionTime: result.execution_time_ms
    });

    return result;

  } catch (error) {
    logger.error('❌ Portfolio Allocation Agent error', {
      error: error.message,
      stack: error.stack,
      userId
    });

    return {
      agent_key: 'portfolio_allocation',
      user_id: userId,
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
  const cacheSize = optimizationCache.size;

  // Calculate average metrics from recent optimizations
  const recentOpts = Array.from(optimizationCache.values())
    .filter(cache => Date.now() - cache.timestamp < CACHE_TTL);

  const avgSharpe = recentOpts.length > 0
    ? recentOpts.reduce((sum, cache) => {
        return sum + (cache.data.optimal_allocation?.metrics?.sharpeRatio || 0);
      }, 0) / recentOpts.length
    : 0;

  return {
    agent_key: 'portfolio_allocation',
    name: 'Portfolio Allocation Agent',
    description: 'Optimizes portfolio allocation using Modern Portfolio Theory (MPT) to maximize Sharpe ratio while respecting risk constraints',
    status: 'active',
    version: '1.0.0',
    capabilities: [
      'Optimal asset allocation (Markowitz MPT)',
      'Sharpe ratio maximization',
      'Risk-constrained optimization',
      'Efficient frontier calculation',
      'Rebalancing recommendations',
      'Integration with Risk Management Agent',
      'Multiple optimization goals (Sharpe, min variance, target return)',
      'Support for conservative/moderate/aggressive risk profiles'
    ],
    metrics: {
      cached_optimizations: cacheSize,
      avg_sharpe_ratio: Math.round(avgSharpe * 100) / 100,
      cache_ttl_ms: CACHE_TTL
    },
    lastRun: recentOpts.length > 0
      ? new Date(recentOpts[0].timestamp).toISOString()
      : null
  };
}

/**
 * Get default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    riskTolerance: 'moderate',
    riskFreeRate: 0.04,
    rebalanceThreshold: 0.05,
    minWeight: 0.0,
    maxWeight: 1.0,
    optimizationGoal: 'sharpe',
    includeEfficientFrontier: false,
    cacheEnabled: true,
    cacheTTL: CACHE_TTL
  };
}

// Helper functions

/**
 * Map risk tolerance to maximum volatility
 */
function getRiskToleranceVolatility(riskTolerance) {
  const toleranceMap = {
    'conservative': 0.10,  // 10% max volatility
    'moderate': 0.20,      // 20% max volatility
    'aggressive': 0.35,    // 35% max volatility
    'very_aggressive': 0.50 // 50% max volatility
  };
  
  return toleranceMap[riskTolerance] || 0.20;
}

/**
 * Generate cache key from portfolio and config
 */
function generateCacheKey(portfolio, config) {
  const assets = portfolio.assets
    .map(a => a.symbol)
    .sort()
    .join(',');
  
  const configStr = JSON.stringify({
    rt: config.riskTolerance,
    goal: config.optimizationGoal,
    target: config.targetReturn
  });
  
  return `${assets}_${configStr}`;
}

/**
 * Calculate current portfolio metrics
 */
function calculateCurrentPortfolioMetrics(weights, expectedReturns, covMatrix, assets, riskFreeRate) {
  const weightsArray = assets.map(asset => weights[asset] || 0);
  
  const expectedReturn = calculatePortfolioReturn(weightsArray, expectedReturns, assets);
  const volatility = calculatePortfolioVolatility(weightsArray, covMatrix);
  const sharpeRatio = calculateSharpeRatio(expectedReturn, volatility, riskFreeRate);
  
  return {
    expectedReturn,
    volatility,
    sharpeRatio
  };
}

/**
 * Calculate optimization confidence score
 */
function calculateOptimizationConfidence(result, improvement) {
  let confidence = 0.7; // Base confidence
  
  // Higher Sharpe ratio increases confidence
  if (result.sharpeRatio > 1.5) confidence += 0.15;
  else if (result.sharpeRatio > 1.0) confidence += 0.10;
  else if (result.sharpeRatio > 0.5) confidence += 0.05;
  
  // Positive improvements increase confidence
  if (improvement.sharpeImprovement > 0.3) confidence += 0.10;
  else if (improvement.sharpeImprovement > 0.1) confidence += 0.05;
  
  return Math.min(0.95, Math.max(0.50, confidence));
}

/**
 * Clean old cache entries
 */
function cleanCache() {
  const now = Date.now();
  
  for (const [key, value] of optimizationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      optimizationCache.delete(key);
    }
  }
}

export default {
  run,
  getDetails,
  defaultConfig
};
