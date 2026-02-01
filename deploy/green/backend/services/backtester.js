/**
 * Backtesting Service
 * BACKEND-010: Implement Optimization Agent
 * 
 * Provides backtesting capabilities for trading strategies:
 * - Historical strategy simulation
 * - Performance metrics calculation (Sharpe, max drawdown, win rate)
 * - Trade execution simulation
 * - Portfolio value tracking
 * - Transaction cost modeling
 * 
 * Supports various trading strategies and parameter configurations
 */

import { logger } from './logger.js';

/**
 * Execute backtest for a trading strategy
 * @param {Array} ohlcv - Historical OHLCV data [{timestamp, open, high, low, close, volume}]
 * @param {Function} strategy - Trading strategy function (ohlcv, params) => signals
 * @param {Object} params - Strategy parameters
 * @param {Object} options - Backtest configuration
 * @returns {Object} Backtest results with trades and metrics
 */
export async function backtest(ohlcv, strategy, params = {}, options = {}) {
  try {
    // Validate inputs
    if (!ohlcv || ohlcv.length < 10) {
      throw new Error('Insufficient historical data for backtesting (minimum 10 candles)');
    }
    
    if (typeof strategy !== 'function') {
      throw new Error('Strategy must be a function');
    }
    
    // Default options
    const config = {
      initialCapital: options.initialCapital || 10000,
      commission: options.commission || 0.001, // 0.1%
      slippage: options.slippage || 0.0005, // 0.05%
      positionSize: options.positionSize || 1.0, // 100% of capital per trade
      ...options
    };
    
    // Generate trading signals
    const signals = await strategy(ohlcv, params);
    
    if (!signals || !Array.isArray(signals)) {
      throw new Error('Strategy must return an array of signals');
    }
    
    // Execute trades based on signals
    const trades = executeTrades(ohlcv, signals, config);
    
    // Calculate performance metrics
    const metrics = calculateMetrics(trades, ohlcv, config);
    
    logger.info('✅ Backtest completed', {
      trades: trades.length,
      winRate: metrics.winRate,
      sharpeRatio: metrics.sharpeRatio
    });
    
    return {
      trades,
      metrics,
      equity_curve: calculateEquityCurve(trades, config.initialCapital),
      signals: signals.length,
      period: {
        start: ohlcv[0].timestamp,
        end: ohlcv[ohlcv.length - 1].timestamp
      }
    };
    
  } catch (error) {
    logger.error('❌ Backtest error:', error);
    throw error;
  }
}

/**
 * Execute trades based on signals
 * @param {Array} ohlcv - OHLCV data
 * @param {Array} signals - Trading signals [{index, action, price, confidence}]
 * @param {Object} config - Configuration
 * @returns {Array} Executed trades
 */
function executeTrades(ohlcv, signals, config) {
  const trades = [];
  let position = null;
  let capital = config.initialCapital;
  
  for (const signal of signals) {
    const candle = ohlcv[signal.index];
    if (!candle) continue;
    
    const price = signal.price || candle.close;
    const timestamp = candle.timestamp;
    
    if (signal.action === 'BUY' && !position) {
      // Open long position
      const adjustedPrice = price * (1 + config.slippage);
      const commission = capital * config.commission;
      const positionValue = capital * config.positionSize - commission;
      const quantity = positionValue / adjustedPrice;
      
      position = {
        entry_price: adjustedPrice,
        entry_time: timestamp,
        entry_index: signal.index,
        quantity,
        type: 'long',
        commission_paid: commission
      };
      
      logger.debug('📈 BUY', { price: adjustedPrice, quantity });
      
    } else if (signal.action === 'SELL' && position) {
      // Close long position
      const adjustedPrice = price * (1 - config.slippage);
      const exitValue = position.quantity * adjustedPrice;
      const commission = exitValue * config.commission;
      const netProfit = exitValue - commission - (position.quantity * position.entry_price);
      const returnPct = (netProfit / (position.quantity * position.entry_price)) * 100;
      
      capital += netProfit;
      
      trades.push({
        entry_time: position.entry_time,
        entry_price: position.entry_price,
        entry_index: position.entry_index,
        exit_time: timestamp,
        exit_price: adjustedPrice,
        exit_index: signal.index,
        quantity: position.quantity,
        profit: netProfit,
        return_pct: returnPct,
        commission: position.commission_paid + commission,
        duration: timestamp - position.entry_time,
        type: 'long'
      });
      
      position = null;
      
      logger.debug('📉 SELL', { price: adjustedPrice, profit: netProfit });
    }
  }
  
  // Close any open position at the end
  if (position) {
    const lastCandle = ohlcv[ohlcv.length - 1];
    const adjustedPrice = lastCandle.close * (1 - config.slippage);
    const exitValue = position.quantity * adjustedPrice;
    const commission = exitValue * config.commission;
    const netProfit = exitValue - commission - (position.quantity * position.entry_price);
    const returnPct = (netProfit / (position.quantity * position.entry_price)) * 100;
    
    trades.push({
      entry_time: position.entry_time,
      entry_price: position.entry_price,
      entry_index: position.entry_index,
      exit_time: lastCandle.timestamp,
      exit_price: adjustedPrice,
      exit_index: ohlcv.length - 1,
      quantity: position.quantity,
      profit: netProfit,
      return_pct: returnPct,
      commission: position.commission_paid + commission,
      duration: lastCandle.timestamp - position.entry_time,
      type: 'long',
      forced_exit: true
    });
  }
  
  return trades;
}

/**
 * Calculate performance metrics from trades
 * @param {Array} trades - Executed trades
 * @param {Array} ohlcv - OHLCV data
 * @param {Object} config - Configuration
 * @returns {Object} Performance metrics
 */
function calculateMetrics(trades, ohlcv, config) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalReturn: 0,
      totalReturnPct: 0,
      averageReturn: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      avgTradeDuration: 0
    };
  }
  
  const wins = trades.filter(t => t.profit > 0);
  const losses = trades.filter(t => t.profit <= 0);
  
  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
  const totalWins = wins.reduce((sum, t) => sum + t.profit, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));
  
  const avgReturn = totalProfit / trades.length;
  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  
  // Calculate Sharpe Ratio
  const returns = trades.map(t => t.return_pct / 100);
  const avgReturnRatio = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturnRatio, 2), 0) / returns.length
  );
  const sharpeRatio = stdDev > 0 ? (avgReturnRatio / stdDev) * Math.sqrt(252) : 0; // Annualized
  
  // Calculate Max Drawdown
  const equityCurve = calculateEquityCurve(trades, config.initialCapital);
  const { maxDrawdown, maxDrawdownPct } = calculateMaxDrawdown(equityCurve);
  
  // Average trade duration
  const avgDuration = trades.reduce((sum, t) => sum + t.duration, 0) / trades.length;
  
  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: (wins.length / trades.length) * 100,
    totalReturn: totalProfit,
    totalReturnPct: (totalProfit / config.initialCapital) * 100,
    averageReturn: avgReturn,
    averageWin: avgWin,
    averageLoss: avgLoss,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    sharpeRatio: sharpeRatio,
    maxDrawdown: maxDrawdown,
    maxDrawdownPct: maxDrawdownPct,
    avgTradeDuration: avgDuration,
    avgTradeDurationHours: avgDuration / (1000 * 60 * 60)
  };
}

/**
 * Calculate equity curve from trades
 * @param {Array} trades - Executed trades
 * @param {number} initialCapital - Starting capital
 * @returns {Array} Equity curve [{timestamp, equity, drawdown}]
 */
function calculateEquityCurve(trades, initialCapital) {
  const curve = [{ timestamp: 0, equity: initialCapital, drawdown: 0 }];
  let equity = initialCapital;
  
  for (const trade of trades) {
    equity += trade.profit;
    curve.push({
      timestamp: trade.exit_time,
      equity: equity,
      drawdown: 0 // Will be calculated in calculateMaxDrawdown
    });
  }
  
  return curve;
}

/**
 * Calculate maximum drawdown from equity curve
 * @param {Array} equityCurve - Equity curve data
 * @returns {Object} Max drawdown metrics
 */
function calculateMaxDrawdown(equityCurve) {
  let maxEquity = equityCurve[0].equity;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  
  for (const point of equityCurve) {
    if (point.equity > maxEquity) {
      maxEquity = point.equity;
    }
    
    const drawdown = maxEquity - point.equity;
    const drawdownPct = (drawdown / maxEquity) * 100;
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = drawdownPct;
    }
  }
  
  return { maxDrawdown, maxDrawdownPct };
}

/**
 * Run walk-forward optimization
 * @param {Array} ohlcv - OHLCV data
 * @param {Function} strategy - Trading strategy
 * @param {Object} params - Strategy parameters
 * @param {Object} options - Configuration
 * @returns {Object} Walk-forward results
 */
export async function walkForwardBacktest(ohlcv, strategy, params, options = {}) {
  const windowSize = options.windowSize || Math.floor(ohlcv.length * 0.7);
  const stepSize = options.stepSize || Math.floor(ohlcv.length * 0.1);
  
  const windows = [];
  for (let i = 0; i + windowSize <= ohlcv.length; i += stepSize) {
    const window = ohlcv.slice(i, i + windowSize);
    const result = await backtest(window, strategy, params, options);
    windows.push({
      start: window[0].timestamp,
      end: window[window.length - 1].timestamp,
      metrics: result.metrics
    });
  }
  
  return {
    windows,
    avgSharpeRatio: windows.reduce((sum, w) => sum + w.metrics.sharpeRatio, 0) / windows.length,
    avgWinRate: windows.reduce((sum, w) => sum + w.metrics.winRate, 0) / windows.length
  };
}

/**
 * Compare multiple backtests
 * @param {Array} results - Array of backtest results
 * @returns {Object} Comparison metrics
 */
export function compareBacktests(results) {
  if (!results || results.length === 0) {
    return null;
  }
  
  const comparison = results.map((result, index) => ({
    index,
    sharpeRatio: result.metrics.sharpeRatio,
    winRate: result.metrics.winRate,
    totalReturnPct: result.metrics.totalReturnPct,
    maxDrawdownPct: result.metrics.maxDrawdownPct,
    totalTrades: result.metrics.totalTrades
  }));
  
  // Find best by Sharpe ratio
  const bestBySharpe = comparison.reduce((best, curr) => 
    curr.sharpeRatio > best.sharpeRatio ? curr : best
  );
  
  return {
    comparison,
    bestBySharpe: bestBySharpe.index,
    bestByWinRate: comparison.reduce((best, curr) => 
      curr.winRate > best.winRate ? curr : best
    ).index,
    bestByReturn: comparison.reduce((best, curr) => 
      curr.totalReturnPct > best.totalReturnPct ? curr : best
    ).index
  };
}

export default {
  backtest,
  walkForwardBacktest,
  compareBacktests,
  calculateMetrics
};
