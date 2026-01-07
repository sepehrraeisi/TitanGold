/**
 * Strategy Optimizer Service
 * BACKEND-010: Implement Optimization Agent
 * 
 * Implements strategy parameter optimization:
 * - Grid Search optimization
 * - Genetic Algorithm optimization
 * - Parameter space exploration
 * - Multi-objective optimization
 * - Performance-based ranking
 * 
 * Optimizes for Sharpe ratio, win rate, or custom objectives
 */

import { logger } from './logger.js';
import { backtest, compareBacktests } from './backtester.js';

/**
 * Optimize strategy parameters using grid search
 * @param {Array} ohlcv - Historical OHLCV data
 * @param {Function} strategy - Trading strategy function
 * @param {Object} paramSpace - Parameter space to search
 * @param {Object} options - Optimization configuration
 * @returns {Object} Optimization results
 */
export async function gridSearchOptimize(ohlcv, strategy, paramSpace, options = {}) {
  try {
    logger.info('🔍 Starting grid search optimization', { 
      params: Object.keys(paramSpace).length 
    });
    
    // Validate inputs
    if (!ohlcv || ohlcv.length < 50) {
      throw new Error('Insufficient data for optimization (minimum 50 candles)');
    }
    
    if (!paramSpace || Object.keys(paramSpace).length === 0) {
      throw new Error('Parameter space must not be empty');
    }
    
    // Generate parameter combinations
    const combinations = generateParameterCombinations(paramSpace);
    
    logger.info(`Testing ${combinations.length} parameter combinations`);
    
    // Test each combination
    const results = [];
    const maxTests = options.maxTests || 100;
    const testCombinations = combinations.slice(0, maxTests);
    
    for (let i = 0; i < testCombinations.length; i++) {
      const params = testCombinations[i];
      
      try {
        const result = await backtest(ohlcv, strategy, params, options);
        
        results.push({
          params,
          metrics: result.metrics,
          trades: result.trades.length,
          score: calculateScore(result.metrics, options.objective)
        });
        
        if ((i + 1) % 10 === 0) {
          logger.debug(`Progress: ${i + 1}/${testCombinations.length} combinations tested`);
        }
        
      } catch (error) {
        logger.warn(`Failed to backtest params:`, params, error.message);
      }
    }
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    // Calculate improvement
    const improvement = calculateImprovement(results, options);
    
    logger.info('✅ Grid search completed', {
      tested: results.length,
      bestScore: results[0]?.score
    });
    
    return {
      method: 'grid_search',
      tested: results.length,
      total_combinations: combinations.length,
      results: results.slice(0, options.topN || 10),
      best: results[0],
      improvement,
      param_space: paramSpace,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('❌ Grid search optimization error:', error);
    throw error;
  }
}

/**
 * Optimize strategy parameters using genetic algorithm
 * @param {Array} ohlcv - Historical OHLCV data
 * @param {Function} strategy - Trading strategy function
 * @param {Object} paramSpace - Parameter bounds
 * @param {Object} options - Optimization configuration
 * @returns {Object} Optimization results
 */
export async function geneticOptimize(ohlcv, strategy, paramSpace, options = {}) {
  try {
    logger.info('🧬 Starting genetic algorithm optimization');
    
    const config = {
      populationSize: options.populationSize || 20,
      generations: options.generations || 10,
      mutationRate: options.mutationRate || 0.1,
      crossoverRate: options.crossoverRate || 0.7,
      eliteSize: options.eliteSize || 2,
      ...options
    };
    
    // Initialize population
    let population = initializePopulation(paramSpace, config.populationSize);
    
    const generationResults = [];
    let bestEver = null;
    
    for (let gen = 0; gen < config.generations; gen++) {
      logger.info(`Generation ${gen + 1}/${config.generations}`);
      
      // Evaluate fitness for each individual
      const evaluated = [];
      for (const individual of population) {
        try {
          const result = await backtest(ohlcv, strategy, individual, options);
          const fitness = calculateScore(result.metrics, options.objective);
          
          evaluated.push({
            params: individual,
            metrics: result.metrics,
            fitness,
            trades: result.trades.length
          });
        } catch (error) {
          evaluated.push({
            params: individual,
            fitness: -Infinity
          });
        }
      }
      
      // Sort by fitness
      evaluated.sort((a, b) => b.fitness - a.fitness);
      
      // Track best ever
      if (!bestEver || evaluated[0].fitness > bestEver.fitness) {
        bestEver = { ...evaluated[0], generation: gen + 1 };
      }
      
      generationResults.push({
        generation: gen + 1,
        best: evaluated[0],
        avgFitness: evaluated.reduce((sum, ind) => sum + ind.fitness, 0) / evaluated.length
      });
      
      // Selection and reproduction
      const elite = evaluated.slice(0, config.eliteSize);
      const offspring = [];
      
      while (offspring.length < config.populationSize - config.eliteSize) {
        const parent1 = tournamentSelection(evaluated, 3);
        const parent2 = tournamentSelection(evaluated, 3);
        
        let child;
        if (Math.random() < config.crossoverRate) {
          child = crossover(parent1.params, parent2.params, paramSpace);
        } else {
          child = { ...parent1.params };
        }
        
        if (Math.random() < config.mutationRate) {
          child = mutate(child, paramSpace);
        }
        
        offspring.push(child);
      }
      
      population = [...elite.map(e => e.params), ...offspring];
    }
    
    const improvement = calculateImprovement([bestEver], options);
    
    logger.info('✅ Genetic algorithm completed', {
      generations: config.generations,
      bestFitness: bestEver.fitness
    });
    
    return {
      method: 'genetic_algorithm',
      generations: config.generations,
      population_size: config.populationSize,
      best: bestEver,
      generation_results: generationResults,
      improvement,
      config,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('❌ Genetic optimization error:', error);
    throw error;
  }
}

/**
 * Generate all combinations of parameters
 * @param {Object} paramSpace - Parameter space
 * @returns {Array} All parameter combinations
 */
function generateParameterCombinations(paramSpace) {
  const keys = Object.keys(paramSpace);
  const values = keys.map(key => paramSpace[key]);
  
  function* cartesian(arrays, index = 0, current = {}) {
    if (index === arrays.length) {
      yield { ...current };
      return;
    }
    
    const key = keys[index];
    const array = arrays[index];
    
    for (const value of array) {
      current[key] = value;
      yield* cartesian(arrays, index + 1, current);
    }
  }
  
  return Array.from(cartesian(values));
}

/**
 * Initialize random population for genetic algorithm
 * @param {Object} paramSpace - Parameter bounds {param: {min, max, step}}
 * @param {number} size - Population size
 * @returns {Array} Initial population
 */
function initializePopulation(paramSpace, size) {
  const population = [];
  
  for (let i = 0; i < size; i++) {
    const individual = {};
    
    for (const [param, bounds] of Object.entries(paramSpace)) {
      if (Array.isArray(bounds)) {
        // Discrete values
        individual[param] = bounds[Math.floor(Math.random() * bounds.length)];
      } else if (bounds.min !== undefined && bounds.max !== undefined) {
        // Continuous range
        const step = bounds.step || 1;
        const steps = Math.floor((bounds.max - bounds.min) / step);
        const randomStep = Math.floor(Math.random() * (steps + 1));
        individual[param] = bounds.min + randomStep * step;
      } else {
        individual[param] = bounds;
      }
    }
    
    population.push(individual);
  }
  
  return population;
}

/**
 * Tournament selection
 * @param {Array} population - Evaluated population
 * @param {number} tournamentSize - Number of individuals in tournament
 * @returns {Object} Selected individual
 */
function tournamentSelection(population, tournamentSize) {
  const tournament = [];
  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    tournament.push(population[idx]);
  }
  
  return tournament.reduce((best, curr) => 
    curr.fitness > best.fitness ? curr : best
  );
}

/**
 * Crossover two parents
 * @param {Object} parent1 - First parent
 * @param {Object} parent2 - Second parent
 * @param {Object} paramSpace - Parameter space
 * @returns {Object} Child
 */
function crossover(parent1, parent2, paramSpace) {
  const child = {};
  
  for (const param of Object.keys(paramSpace)) {
    child[param] = Math.random() < 0.5 ? parent1[param] : parent2[param];
  }
  
  return child;
}

/**
 * Mutate an individual
 * @param {Object} individual - Individual to mutate
 * @param {Object} paramSpace - Parameter space
 * @returns {Object} Mutated individual
 */
function mutate(individual, paramSpace) {
  const mutated = { ...individual };
  const params = Object.keys(paramSpace);
  const paramToMutate = params[Math.floor(Math.random() * params.length)];
  
  const bounds = paramSpace[paramToMutate];
  
  if (Array.isArray(bounds)) {
    mutated[paramToMutate] = bounds[Math.floor(Math.random() * bounds.length)];
  } else if (bounds.min !== undefined && bounds.max !== undefined) {
    const step = bounds.step || 1;
    const steps = Math.floor((bounds.max - bounds.min) / step);
    const randomStep = Math.floor(Math.random() * (steps + 1));
    mutated[paramToMutate] = bounds.min + randomStep * step;
  }
  
  return mutated;
}

/**
 * Calculate optimization score based on objective
 * @param {Object} metrics - Backtest metrics
 * @param {string} objective - Optimization objective
 * @returns {number} Score
 */
function calculateScore(metrics, objective = 'sharpe') {
  switch (objective) {
    case 'sharpe':
      return metrics.sharpeRatio;
    
    case 'return':
      return metrics.totalReturnPct;
    
    case 'win_rate':
      return metrics.winRate;
    
    case 'profit_factor':
      return metrics.profitFactor;
    
    case 'balanced':
      // Balanced score: Sharpe * WinRate * (1 - DrawdownPct/100)
      return metrics.sharpeRatio * 
             (metrics.winRate / 100) * 
             (1 - Math.min(metrics.maxDrawdownPct, 50) / 100);
    
    default:
      return metrics.sharpeRatio;
  }
}

/**
 * Calculate improvement metrics
 * @param {Array} results - Optimization results
 * @param {Object} options - Configuration
 * @returns {Object} Improvement metrics
 */
function calculateImprovement(results, options) {
  if (!results || results.length === 0) {
    return null;
  }
  
  const best = results[0];
  
  // Compare with baseline (default parameters or no optimization)
  const baselineSharpe = options.baselineSharpe || 0.5;
  const baselineWinRate = options.baselineWinRate || 50;
  
  const sharpeImprovement = best.metrics ? 
    ((best.metrics.sharpeRatio - baselineSharpe) / Math.abs(baselineSharpe)) * 100 : 0;
  
  const winRateImprovement = best.metrics ?
    ((best.metrics.winRate - baselineWinRate) / baselineWinRate) * 100 : 0;
  
  return {
    sharpe_improvement_pct: sharpeImprovement,
    win_rate_improvement_pct: winRateImprovement,
    final_sharpe: best.metrics?.sharpeRatio || 0,
    final_win_rate: best.metrics?.winRate || 0,
    baseline_sharpe: baselineSharpe,
    baseline_win_rate: baselineWinRate
  };
}

/**
 * Suggest optimal parameter sets based on results
 * @param {Object} optimizationResult - Optimization result
 * @param {number} topN - Number of parameter sets to suggest
 * @returns {Array} Suggested parameter sets
 */
export function suggestOptimalParameters(optimizationResult, topN = 5) {
  if (!optimizationResult.results && !optimizationResult.best) {
    return [];
  }
  
  const results = optimizationResult.results || [optimizationResult.best];
  
  return results.slice(0, topN).map((result, index) => ({
    rank: index + 1,
    params: result.params,
    sharpe_ratio: result.metrics?.sharpeRatio || 0,
    win_rate: result.metrics?.winRate || 0,
    total_return_pct: result.metrics?.totalReturnPct || 0,
    max_drawdown_pct: result.metrics?.maxDrawdownPct || 0,
    total_trades: result.metrics?.totalTrades || 0,
    recommendation: index === 0 ? 'BEST' : index < 3 ? 'GOOD' : 'ACCEPTABLE'
  }));
}

/**
 * Run multi-objective optimization
 * @param {Array} ohlcv - OHLCV data
 * @param {Function} strategy - Trading strategy
 * @param {Object} paramSpace - Parameter space
 * @param {Array} objectives - Objectives to optimize ['sharpe', 'win_rate', etc.]
 * @param {Object} options - Configuration
 * @returns {Object} Multi-objective results
 */
export async function multiObjectiveOptimize(ohlcv, strategy, paramSpace, objectives, options = {}) {
  logger.info('🎯 Starting multi-objective optimization', { objectives });
  
  const results = {};
  
  for (const objective of objectives) {
    logger.info(`Optimizing for ${objective}`);
    
    const result = await gridSearchOptimize(ohlcv, strategy, paramSpace, {
      ...options,
      objective,
      maxTests: Math.floor((options.maxTests || 100) / objectives.length)
    });
    
    results[objective] = result.best;
  }
  
  return {
    method: 'multi_objective',
    objectives,
    results,
    pareto_front: calculateParetoFront(Object.values(results)),
    timestamp: new Date().toISOString()
  };
}

/**
 * Calculate Pareto front (non-dominated solutions)
 * @param {Array} results - Results to analyze
 * @returns {Array} Pareto-optimal solutions
 */
function calculateParetoFront(results) {
  const paretoFront = [];
  
  for (const result of results) {
    let dominated = false;
    
    for (const other of results) {
      if (result === other) continue;
      
      // Check if 'other' dominates 'result'
      const sharpeCheck = other.metrics.sharpeRatio >= result.metrics.sharpeRatio;
      const winRateCheck = other.metrics.winRate >= result.metrics.winRate;
      const drawdownCheck = other.metrics.maxDrawdownPct <= result.metrics.maxDrawdownPct;
      
      if (sharpeCheck && winRateCheck && drawdownCheck &&
          (other.metrics.sharpeRatio > result.metrics.sharpeRatio ||
           other.metrics.winRate > result.metrics.winRate ||
           other.metrics.maxDrawdownPct < result.metrics.maxDrawdownPct)) {
        dominated = true;
        break;
      }
    }
    
    if (!dominated) {
      paretoFront.push(result);
    }
  }
  
  return paretoFront;
}

export default {
  gridSearchOptimize,
  geneticOptimize,
  suggestOptimalParameters,
  multiObjectiveOptimize
};
