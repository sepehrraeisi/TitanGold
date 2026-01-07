/**
 * Optimization Agent
 * BACKEND-010: Implement Optimization Agent
 * 
 * Provides trading strategy optimization and backtesting:
 * - Historical strategy backtesting
 * - Parameter optimization (grid search, genetic algorithm)
 * - Performance metrics calculation
 * - Optimal parameter suggestions
 * - Multi-objective optimization
 * 
 * Integrates with MEXC for historical data and supports various trading strategies
 */

import { logger } from '../logger.js';
import { mexcService } from '../mexc.js';
import { backtest, walkForwardBacktest, compareBacktests } from '../backtester.js';
import { 
  gridSearchOptimize, 
  geneticOptimize,
  suggestOptimalParameters,
  multiObjectiveOptimize
} from '../optimizer.js';

// Cache for optimization results
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Default simple moving average crossover strategy
 * @param {Array} ohlcv - OHLCV data
 * @param {Object} params - Strategy parameters
 * @returns {Array} Trading signals
 */
function smaStrategy(ohlcv, params) {
  const { fastPeriod = 10, slowPeriod = 30, threshold = 0 } = params;
  
  const signals = [];
  
  // Calculate SMAs
  const fastSMA = [];
  const slowSMA = [];
  
  for (let i = 0; i < ohlcv.length; i++) {
    if (i >= fastPeriod - 1) {
      const sum = ohlcv.slice(i - fastPeriod + 1, i + 1)
        .reduce((acc, candle) => acc + candle.close, 0);
      fastSMA.push(sum / fastPeriod);
    } else {
      fastSMA.push(null);
    }
    
    if (i >= slowPeriod - 1) {
      const sum = ohlcv.slice(i - slowPeriod + 1, i + 1)
        .reduce((acc, candle) => acc + candle.close, 0);
      slowSMA.push(sum / slowPeriod);
    } else {
      slowSMA.push(null);
    }
  }
  
  // Generate signals
  for (let i = 1; i < ohlcv.length; i++) {
    if (fastSMA[i] === null || slowSMA[i] === null) continue;
    if (fastSMA[i - 1] === null || slowSMA[i - 1] === null) continue;
    
    const prevDiff = fastSMA[i - 1] - slowSMA[i - 1];
    const currDiff = fastSMA[i] - slowSMA[i];
    
    // Bullish crossover
    if (prevDiff <= threshold && currDiff > threshold) {
      signals.push({
        index: i,
        action: 'BUY',
        price: ohlcv[i].close,
        confidence: Math.abs(currDiff) / ohlcv[i].close
      });
    }
    // Bearish crossover
    else if (prevDiff >= -threshold && currDiff < -threshold) {
      signals.push({
        index: i,
        action: 'SELL',
        price: ohlcv[i].close,
        confidence: Math.abs(currDiff) / ohlcv[i].close
      });
    }
  }
  
  return signals;
}

/**
 * Run optimization agent
 * @param {Object} params - Request parameters
 * @returns {Object} Optimization results
 */
export async function run({ userId, symbol, timeframe = '1h', config = {} }) {
  const startTime = Date.now();
  
  try {
    logger.info('🔧 Optimization Agent started', { symbol, timeframe });
    
    // Check cache
    const cacheKey = `${symbol}_${timeframe}_${JSON.stringify(config)}`;
    if (config.cacheEnabled !== false) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info('📦 Returning cached optimization result');
        return {
          ...cached.result,
          metadata: {
            ...cached.result.metadata,
            cache_hit: true,
            cache_age: Date.now() - cached.timestamp
          }
        };
      }
    }
    
    // Fetch historical data
    const limit = config.dataLimit || 500;
    const ohlcv = await mexcService.fetchOHLCV(userId, symbol, timeframe, limit);
    
    if (!ohlcv || ohlcv.length < 50) {
      throw new Error(`Insufficient historical data: ${ohlcv?.length || 0} candles`);
    }
    
    logger.info(`Fetched ${ohlcv.length} candles for optimization`);
    
    // Determine optimization method
    const method = config.method || 'grid_search';
    const strategy = config.strategy || smaStrategy;
    
    // Default parameter space for SMA strategy
    const defaultParamSpace = {
      fastPeriod: config.fastPeriodRange || [5, 10, 15, 20],
      slowPeriod: config.slowPeriodRange || [20, 30, 40, 50],
      threshold: config.thresholdRange || [0]
    };
    
    const paramSpace = config.paramSpace || defaultParamSpace;
    
    let optimizationResult;
    
    if (method === 'genetic') {
      // Genetic algorithm optimization
      optimizationResult = await geneticOptimize(ohlcv, strategy, {
        fastPeriod: { min: 5, max: 20, step: 1 },
        slowPeriod: { min: 20, max: 50, step: 2 },
        threshold: { min: 0, max: 0, step: 1 }
      }, {
        populationSize: config.populationSize || 20,
        generations: config.generations || 10,
        objective: config.objective || 'sharpe',
        initialCapital: config.initialCapital || 10000,
        commission: config.commission || 0.001
      });
    } else if (method === 'multi_objective') {
      // Multi-objective optimization
      optimizationResult = await multiObjectiveOptimize(
        ohlcv,
        strategy,
        paramSpace,
        config.objectives || ['sharpe', 'win_rate', 'return'],
        {
          maxTests: config.maxTests || 50,
          initialCapital: config.initialCapital || 10000,
          commission: config.commission || 0.001
        }
      );
    } else {
      // Grid search optimization
      optimizationResult = await gridSearchOptimize(ohlcv, strategy, paramSpace, {
        maxTests: config.maxTests || 100,
        objective: config.objective || 'sharpe',
        topN: config.topN || 10,
        initialCapital: config.initialCapital || 10000,
        commission: config.commission || 0.001,
        baselineSharpe: config.baselineSharpe || 0.5,
        baselineWinRate: config.baselineWinRate || 50
      });
    }
    
    // Generate optimal parameter suggestions
    const suggestions = suggestOptimalParameters(optimizationResult, config.topN || 5);
    
    // Run backtest with best parameters
    const bestBacktest = await backtest(
      ohlcv,
      strategy,
      optimizationResult.best.params,
      {
        initialCapital: config.initialCapital || 10000,
        commission: config.commission || 0.001
      }
    );
    
    // Build result
    const result = {
      agent: 'optimization',
      symbol,
      timeframe,
      timestamp: new Date().toISOString(),
      
      optimization: {
        method: optimizationResult.method,
        tested_combinations: optimizationResult.tested || optimizationResult.generations,
        best_parameters: optimizationResult.best.params,
        improvement: optimizationResult.improvement
      },
      
      best_strategy: {
        params: optimizationResult.best.params,
        metrics: optimizationResult.best.metrics,
        sharpe_ratio: optimizationResult.best.metrics?.sharpeRatio || 0,
        win_rate: optimizationResult.best.metrics?.winRate || 0,
        total_return_pct: optimizationResult.best.metrics?.totalReturnPct || 0,
        max_drawdown_pct: optimizationResult.best.metrics?.maxDrawdownPct || 0,
        total_trades: optimizationResult.best.metrics?.totalTrades || 0,
        profit_factor: optimizationResult.best.metrics?.profitFactor || 0
      },
      
      suggestions: suggestions,
      
      backtest_results: {
        trades: bestBacktest.trades.length,
        equity_curve: bestBacktest.equity_curve,
        period: bestBacktest.period
      },
      
      summary: generateSummary(optimizationResult, suggestions),
      
      metadata: {
        data_points: ohlcv.length,
        cache_hit: false,
        execution_time_ms: Date.now() - startTime,
        model: 'optimizer_v1',
        strategy: 'sma_crossover'
      }
    };
    
    // Cache result
    if (config.cacheEnabled !== false) {
      cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
    }
    
    logger.info('✅ Optimization Agent completed', {
      method: optimizationResult.method,
      bestSharpe: result.best_strategy.sharpe_ratio,
      improvement: optimizationResult.improvement?.sharpe_improvement_pct
    });
    
    return result;
    
  } catch (error) {
    logger.error('❌ Optimization Agent error:', error);
    
    return {
      agent: 'optimization',
      symbol,
      timeframe,
      timestamp: new Date().toISOString(),
      error: error.message,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        success: false
      }
    };
  }
}

/**
 * Generate human-readable summary
 * @param {Object} optimizationResult - Optimization result
 * @param {Array} suggestions - Parameter suggestions
 * @returns {string} Summary text
 */
function generateSummary(optimizationResult, suggestions) {
  const best = optimizationResult.best;
  const improvement = optimizationResult.improvement;
  
  if (!best.metrics) {
    return 'Optimization completed with limited results.';
  }
  
  const method = optimizationResult.method === 'grid_search' ? 'Grid Search' : 
                 optimizationResult.method === 'genetic_algorithm' ? 'Genetic Algorithm' : 
                 'Multi-Objective';
  
  const sharpeImprovement = improvement?.sharpe_improvement_pct || 0;
  const improvementText = sharpeImprovement > 20 ? 
    `significantly improved by ${sharpeImprovement.toFixed(1)}%` :
    sharpeImprovement > 0 ?
    `improved by ${sharpeImprovement.toFixed(1)}%` :
    'showed no significant improvement';
  
  return `${method} optimization ${improvementText}. ` +
         `Best strategy achieved Sharpe ratio of ${best.metrics.sharpeRatio.toFixed(2)}, ` +
         `win rate of ${best.metrics.winRate.toFixed(1)}%, ` +
         `and total return of ${best.metrics.totalReturnPct.toFixed(1)}% ` +
         `with ${best.metrics.totalTrades} trades. ` +
         `Maximum drawdown: ${best.metrics.maxDrawdownPct.toFixed(1)}%. ` +
         `Top ${suggestions.length} parameter sets suggested for implementation.`;
}

/**
 * Get agent details
 * @param {Object} params - Request parameters
 * @returns {Object} Agent information
 */
export async function getDetails({ userId }) {
  return {
    agent: 'optimization',
    name: 'Optimization Agent',
    description: 'Trading strategy optimization and backtesting with parameter tuning',
    status: 'active',
    version: '1.0.0',
    capabilities: [
      'Historical backtesting',
      'Grid search optimization',
      'Genetic algorithm optimization',
      'Multi-objective optimization',
      'Performance metrics (Sharpe, drawdown, win rate)',
      'Optimal parameter suggestions',
      'Walk-forward analysis'
    ],
    supported_methods: {
      grid_search: 'Exhaustive parameter space search',
      genetic: 'Evolutionary algorithm optimization',
      multi_objective: 'Pareto-optimal solutions for multiple objectives'
    },
    metrics: [
      'Sharpe Ratio',
      'Win Rate',
      'Total Return',
      'Maximum Drawdown',
      'Profit Factor',
      'Average Trade Duration'
    ],
    lastRun: cache.size > 0 ? new Date().toISOString() : null,
    stats: {
      totalOptimizations: cache.size,
      cacheSize: cache.size
    }
  };
}

/**
 * Get default configuration
 * @returns {Object} Default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    method: 'grid_search',
    objective: 'sharpe',
    dataLimit: 500,
    maxTests: 100,
    topN: 5,
    initialCapital: 10000,
    commission: 0.001,
    slippage: 0.0005,
    cacheEnabled: true,
    baselineSharpe: 0.5,
    baselineWinRate: 50
  };
}

export default { run, getDetails, defaultConfig };
