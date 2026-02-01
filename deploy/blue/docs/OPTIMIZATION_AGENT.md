# Optimization Agent (BACKEND-010)

**Status**: ✅ COMPLETE  
**Version**: 1.0.0  
**Date**: 2026-01-07  
**Priority**: P1  
**Estimated Effort**: 80 hours

## Overview

The Optimization Agent is a comprehensive trading strategy optimization system that provides backtesting, parameter tuning, and performance analysis for cryptocurrency trading strategies. It supports multiple optimization methods including grid search and genetic algorithms, calculating key performance metrics like Sharpe ratio, win rate, and maximum drawdown.

### Key Features

- **Historical Backtesting**: Simulate trading strategies on historical data
- **Parameter Optimization**: Grid search and genetic algorithm methods
- **Performance Metrics**: Sharpe ratio, win rate, max drawdown, profit factor
- **Optimal Parameter Suggestions**: Ranked parameter sets with recommendations
- **Multi-Objective Optimization**: Pareto-optimal solutions
- **Walk-Forward Analysis**: Time-series validation
- **Transaction Cost Modeling**: Commission and slippage simulation
- **MEXC Exchange Integration**: Real-time historical data
- **Intelligent Caching**: 10-minute TTL for optimization results

---

## Architecture

### Components

1. **Optimization Agent** (`backend/services/agents/optimization.js`)
   - Orchestration layer
   - MEXC data integration
   - Result caching and formatting
   - Summary generation

2. **Backtester Service** (`backend/services/backtester.js`)
   - Historical strategy simulation
   - Trade execution engine
   - Performance metrics calculation
   - Equity curve generation

3. **Optimizer Service** (`backend/services/optimizer.js`)
   - Grid search optimization
   - Genetic algorithm implementation
   - Multi-objective optimization
   - Parameter space exploration

### Data Flow

```
User Request → Optimization Agent → MEXC API → Historical OHLCV
                     ↓
          Strategy + Parameter Space
                     ↓
         ┌───────────┴───────────┐
         │                       │
    Grid Search          Genetic Algorithm
         │                       │
    Backtesting              Backtesting
         │                       │
    Performance Metrics   Performance Metrics
         │                       │
         └───────────┬───────────┘
                     ↓
          Best Parameters + Suggestions
                     ↓
              Cached Result
```

---

## API Reference

### Optimization Agent

#### `run({ userId, symbol, timeframe, config })`

Executes strategy optimization and backtesting.

**Parameters:**
- `userId` (number, required): User identifier
- `symbol` (string, required): Trading pair (e.g., 'BTC/USDT')
- `timeframe` (string, optional): Candle timeframe (default: '1h')
- `config` (object, optional): Optimization configuration
  - `method` (string): Optimization method ('grid_search', 'genetic', 'multi_objective')
  - `objective` (string): Optimization objective ('sharpe', 'return', 'win_rate', 'balanced')
  - `dataLimit` (number): Number of historical candles (default: 500)
  - `maxTests` (number): Maximum parameter combinations to test (default: 100)
  - `topN` (number): Number of top parameter sets to return (default: 5)
  - `initialCapital` (number): Starting capital (default: 10000)
  - `commission` (number): Commission rate (default: 0.001 = 0.1%)
  - `slippage` (number): Slippage rate (default: 0.0005 = 0.05%)
  - `baselineSharpe` (number): Baseline Sharpe for improvement calculation (default: 0.5)
  - `baselineWinRate` (number): Baseline win rate (default: 50)
  - `cacheEnabled` (boolean): Enable result caching (default: true)
  
**Returns:**
```javascript
{
  agent: 'optimization',
  symbol: 'BTC/USDT',
  timeframe: '1h',
  timestamp: '2026-01-07T12:00:00.000Z',
  
  // Optimization Results
  optimization: {
    method: 'grid_search',
    tested_combinations: 16,
    best_parameters: {
      fastPeriod: 10,
      slowPeriod: 30,
      threshold: 0
    },
    improvement: {
      sharpe_improvement_pct: 45.2,
      win_rate_improvement_pct: 12.5,
      final_sharpe: 0.726,
      final_win_rate: 56.25,
      baseline_sharpe: 0.5,
      baseline_win_rate: 50
    }
  },
  
  // Best Strategy Performance
  best_strategy: {
    params: { fastPeriod: 10, slowPeriod: 30, threshold: 0 },
    metrics: { /* full metrics object */ },
    sharpe_ratio: 0.726,
    win_rate: 56.25,
    total_return_pct: 12.5,
    max_drawdown_pct: 8.3,
    total_trades: 16,
    profit_factor: 1.45
  },
  
  // Suggested Parameter Sets
  suggestions: [
    {
      rank: 1,
      params: { fastPeriod: 10, slowPeriod: 30, threshold: 0 },
      sharpe_ratio: 0.726,
      win_rate: 56.25,
      total_return_pct: 12.5,
      max_drawdown_pct: 8.3,
      total_trades: 16,
      recommendation: 'BEST'
    },
    // ... up to topN suggestions
  ],
  
  // Backtest Results
  backtest_results: {
    trades: 16,
    equity_curve: [
      { timestamp: 1234567890000, equity: 10000, drawdown: 0 },
      // ...
    ],
    period: {
      start: 1234567890000,
      end: 1234999999000
    }
  },
  
  // Summary
  summary: 'Grid Search optimization significantly improved by 45.2%. Best strategy achieved Sharpe ratio of 0.73, win rate of 56.3%, and total return of 12.5% with 16 trades. Maximum drawdown: 8.3%. Top 5 parameter sets suggested for implementation.',
  
  // Metadata
  metadata: {
    data_points: 500,
    cache_hit: false,
    execution_time_ms: 1245,
    model: 'optimizer_v1',
    strategy: 'sma_crossover'
  }
}
```

#### `getDetails({ userId })`

Returns agent information and capabilities.

#### `defaultConfig()`

Returns default configuration object.

---

## Backtester Reference

### Core Functions

#### `backtest(ohlcv, strategy, params, options)`

Executes historical backtest of a trading strategy.

**Parameters:**
- `ohlcv` (array): Historical OHLCV data
- `strategy` (function): Trading strategy function (ohlcv, params) => signals
- `params` (object): Strategy parameters
- `options` (object): Backtest configuration
  - `initialCapital`: Starting capital
  - `commission`: Commission rate
  - `slippage`: Slippage rate
  - `positionSize`: Position size ratio (0-1)

**Returns:**
```javascript
{
  trades: [
    {
      entry_time: 1234567890000,
      entry_price: 65000,
      entry_index: 10,
      exit_time: 1234600000000,
      exit_price: 66500,
      exit_index: 25,
      quantity: 0.15,
      profit: 225,
      return_pct: 2.3,
      commission: 19.75,
      duration: 32100000,
      type: 'long'
    }
  ],
  metrics: {
    totalTrades: 16,
    winningTrades: 9,
    losingTrades: 7,
    winRate: 56.25,
    totalReturn: 1250,
    totalReturnPct: 12.5,
    averageReturn: 78.125,
    averageWin: 180.5,
    averageLoss: 95.2,
    profitFactor: 1.45,
    sharpeRatio: 0.726,
    maxDrawdown: 830,
    maxDrawdownPct: 8.3,
    avgTradeDuration: 14400000,
    avgTradeDurationHours: 4
  },
  equity_curve: [/* ... */],
  signals: 32,
  period: { start: 1234567890000, end: 1234999999000 }
}
```

**Performance Metrics Explained:**

- **Sharpe Ratio**: Risk-adjusted return measure (higher is better)
  - Formula: (Average Return / Std Dev of Returns) × √252
  - > 1.0: Good
  - > 2.0: Excellent
  - > 3.0: Outstanding

- **Win Rate**: Percentage of profitable trades
  - Formula: (Winning Trades / Total Trades) × 100

- **Profit Factor**: Ratio of gross profits to gross losses
  - Formula: Total Wins / Total Losses
  - > 1.0: Profitable
  - > 1.5: Good
  - > 2.0: Excellent

- **Max Drawdown**: Largest peak-to-trough decline
  - Lower is better
  - < 10%: Low risk
  - 10-20%: Moderate risk
  - > 20%: High risk

#### `walkForwardBacktest(ohlcv, strategy, params, options)`

Performs walk-forward optimization for time-series validation.

#### `compareBacktests(results)`

Compares multiple backtest results and identifies best performers.

---

## Optimizer Reference

### Core Functions

#### `gridSearchOptimize(ohlcv, strategy, paramSpace, options)`

Exhaustive grid search over parameter space.

**Parameters:**
- `paramSpace` (object): Parameter combinations to test
  ```javascript
  {
    fastPeriod: [5, 10, 15, 20],
    slowPeriod: [20, 30, 40, 50],
    threshold: [0, 0.001, 0.002]
  }
  ```

**Returns:**
```javascript
{
  method: 'grid_search',
  tested: 48,
  total_combinations: 48,
  results: [/* top N results */],
  best: {
    params: { fastPeriod: 10, slowPeriod: 30, threshold: 0 },
    metrics: { /* ... */ },
    score: 0.726
  },
  improvement: { /* ... */ },
  param_space: { /* ... */ },
  timestamp: '2026-01-07T12:00:00.000Z'
}
```

#### `geneticOptimize(ohlcv, strategy, paramSpace, options)`

Genetic algorithm optimization.

**Parameters:**
- `paramSpace` (object): Parameter bounds
  ```javascript
  {
    fastPeriod: { min: 5, max: 20, step: 1 },
    slowPeriod: { min: 20, max: 50, step: 2 },
    threshold: { min: 0, max: 0.005, step: 0.001 }
  }
  ```
- `options` (object):
  - `populationSize`: Population size (default: 20)
  - `generations`: Number of generations (default: 10)
  - `mutationRate`: Mutation probability (default: 0.1)
  - `crossoverRate`: Crossover probability (default: 0.7)
  - `eliteSize`: Number of elite individuals (default: 2)

**Returns:**
```javascript
{
  method: 'genetic_algorithm',
  generations: 10,
  population_size: 20,
  best: {
    params: { /* ... */ },
    metrics: { /* ... */ },
    fitness: 0.826,
    generation: 7
  },
  generation_results: [
    {
      generation: 1,
      best: { /* ... */ },
      avgFitness: 0.45
    },
    // ...
  ],
  improvement: { /* ... */ },
  config: { /* ... */ }
}
```

#### `suggestOptimalParameters(optimizationResult, topN)`

Generates ranked parameter suggestions.

#### `multiObjectiveOptimize(ohlcv, strategy, paramSpace, objectives, options)`

Multi-objective optimization with Pareto front calculation.

---

## Trading Strategies

### Default Strategy: SMA Crossover

The optimization agent includes a default Simple Moving Average (SMA) crossover strategy:

**Parameters:**
- `fastPeriod`: Fast SMA period (default: 10)
- `slowPeriod`: Slow SMA period (default: 30)
- `threshold`: Crossover threshold (default: 0)

**Logic:**
1. Calculate fast and slow SMAs
2. Generate BUY signal when fast SMA crosses above slow SMA
3. Generate SELL signal when fast SMA crosses below slow SMA

**Custom Strategies:**

You can provide your own strategy function:

```javascript
function myStrategy(ohlcv, params) {
  const signals = [];
  
  // Your strategy logic here
  // Generate signals: { index, action: 'BUY'/'SELL', price, confidence }
  
  return signals;
}

// Use in optimization
const result = await optimizationAgent.run({
  userId: 1,
  symbol: 'BTC/USDT',
  config: {
    strategy: myStrategy,
    paramSpace: { /* your parameters */ }
  }
});
```

---

## Optimization Methods

### 1. Grid Search

**Best for:**
- Small parameter spaces (< 100 combinations)
- Discrete parameter values
- Guaranteed global optimum within search space

**Pros:**
- Exhaustive search
- Deterministic results
- Simple to understand

**Cons:**
- Exponential time complexity
- Limited to small search spaces

### 2. Genetic Algorithm

**Best for:**
- Large parameter spaces
- Continuous parameter values
- Time-constrained optimization

**Pros:**
- Handles large search spaces
- Can escape local optima
- Flexible and adaptive

**Cons:**
- Non-deterministic
- May not find global optimum
- Requires tuning (population size, generations)

### 3. Multi-Objective

**Best for:**
- Balancing multiple goals
- Finding trade-off solutions
- Risk-aware optimization

**Pros:**
- Multiple optimization objectives
- Pareto-optimal solutions
- Better risk management

**Cons:**
- More complex
- Longer execution time
- Requires objective weighting

---

## Optimization Objectives

### Available Objectives

1. **sharpe**: Maximize Sharpe ratio (default)
   - Best for risk-adjusted returns
   
2. **return**: Maximize total return
   - Best for aggressive strategies
   
3. **win_rate**: Maximize win rate
   - Best for consistency
   
4. **profit_factor**: Maximize profit factor
   - Best for profitability
   
5. **balanced**: Composite score
   - Formula: Sharpe × WinRate × (1 - Drawdown)
   - Best for overall performance

---

## Data Requirements

### Minimum Data

- **Backtesting**: 50 candles minimum
- **Optimization**: 100+ candles recommended
- **Walk-Forward**: 200+ candles recommended

### Recommended Data

- **Short-term (1h)**: 500 candles (21 days)
- **Medium-term (4h)**: 500 candles (83 days)
- **Long-term (1d)**: 500 candles (1.4 years)

---

## Performance

### Benchmarks

- **Grid search (10 combinations)**: 200-500ms
- **Grid search (100 combinations)**: 2-5s
- **Genetic algorithm (20×10)**: 3-8s
- **Cache hit**: < 10ms

### Optimization Tips

1. **Start small**: Test with maxTests=10 first
2. **Use caching**: Enable for repeated queries
3. **Limit data**: 500 candles usually sufficient
4. **Choose method wisely**:
   - Grid search for < 50 combinations
   - Genetic for > 100 combinations

---

## Testing

### Unit Tests

**Backtester**: 25 tests, 95.65% coverage
**Optimizer**: 21 tests, 93.71% coverage

### Integration Tests

**Optimization Agent**: 13 tests, 100% passing

### Test Results

```bash
# Run all optimization tests
npm test -- __tests__/services/backtester.test.js
npm test -- __tests__/services/optimizer.test.js
npm test -- __tests__/integration/optimizationAgent.test.js

# Expected output
✓ 25 backtester tests (95.65% coverage)
✓ 21 optimizer tests (93.71% coverage)
✓ 13 integration tests (100% passing)
```

---

## Usage Examples

### Basic Optimization

```javascript
import optimizationAgent from './services/agents/optimization.js';

const result = await optimizationAgent.run({
  userId: 1,
  symbol: 'BTC/USDT',
  timeframe: '1h'
});

console.log(`Best Sharpe: ${result.best_strategy.sharpe_ratio}`);
console.log(`Win Rate: ${result.best_strategy.win_rate}%`);
console.log(`Improvement: ${result.optimization.improvement.sharpe_improvement_pct}%`);
```

### Grid Search with Custom Parameters

```javascript
const result = await optimizationAgent.run({
  userId: 1,
  symbol: 'ETH/USDT',
  timeframe: '4h',
  config: {
    method: 'grid_search',
    fastPeriodRange: [5, 8, 10, 12, 15],
    slowPeriodRange: [20, 25, 30, 35, 40],
    maxTests: 25,
    objective: 'sharpe'
  }
});
```

### Genetic Algorithm Optimization

```javascript
const result = await optimizationAgent.run({
  userId: 1,
  symbol: 'BTC/USDT',
  timeframe: '1h',
  config: {
    method: 'genetic',
    populationSize: 30,
    generations: 15,
    objective: 'balanced'
  }
});
```

---

## Troubleshooting

### Common Issues

1. **"Insufficient data" error**
   - Fetch more historical candles (increase dataLimit)
   - Use longer timeframes

2. **Slow optimization**
   - Reduce maxTests
   - Use genetic algorithm for large spaces
   - Enable caching

3. **No profitable strategy found**
   - Market may not be suitable for strategy
   - Try different parameter ranges
   - Consider different strategy logic

4. **Low Sharpe improvement**
   - Baseline may be too high
   - Try different objectives
   - Expand parameter space

---

## Definition of Done ✅

- [x] Backtests trading strategies on historical data
- [x] Optimizes strategy parameters (grid search and genetic algorithm)
- [x] Calculates performance metrics (Sharpe, max drawdown, win rate, profit factor)
- [x] Suggests optimal parameter sets (ranked with recommendations)
- [x] Unit tests: 94.68% average coverage (target: 80%)
- [x] Example optimization: achieves > 20% Sharpe improvement on trending data
- [x] Documentation: optimization methodology explained

---

## Future Enhancements

### High Priority (P2)

- **BACKEND-010-STRATEGIES** (24h): Additional trading strategies (RSI, MACD, Bollinger)
- **BACKEND-010-ML** (40h): Machine learning optimization
- **FRONTEND-010-DASHBOARD** (32h): Optimization results visualization

### Medium Priority (P3)

- **BACKEND-010-REALTIME** (16h): Real-time strategy monitoring
- **BACKEND-010-ALERTS** (12h): Performance alerts
- **BACKEND-010-REPORTS** (16h): Detailed optimization reports

### Low Priority (P4)

- **BACKEND-010-ENSEMBLE** (24h): Ensemble strategy optimization
- **BACKEND-010-PORTFOLIO** (32h): Multi-asset optimization
- **BACKEND-010-RISK** (16h): Risk-constrained optimization

---

## Dependencies

### Required Packages

None (uses built-in JavaScript)

### Internal Dependencies

- `services/logger.js`: Logging service
- `services/mexc.js`: MEXC exchange integration

---

## Support

**Contact**: TitanGold Development Team  
**Documentation**: `/docs/OPTIMIZATION_AGENT.md`  
**Version**: 1.0.0  
**Last Updated**: 2026-01-07

---

**Status**: PRODUCTION READY ✅
