/**
 * Backtester Service Unit Tests
 * BACKEND-010: Implement Optimization Agent
 */

import { 
  backtest, 
  walkForwardBacktest, 
  compareBacktests
} from '../../services/backtester.js';

// Helper: Generate mock OHLCV data
function generateOHLCV(numCandles, startPrice = 100, trend = 0.001) {
  const ohlcv = [];
  let price = startPrice;
  
  for (let i = 0; i < numCandles; i++) {
    const open = price;
    const trendChange = price * trend;
    const volatility = price * 0.02 * (Math.random() - 0.5);
    const close = price + trendChange + volatility;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    ohlcv.push({
      timestamp: Date.now() + i * 3600000,
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500
    });
    
    price = close;
  }
  
  return ohlcv;
}

// Simple test strategy
function simpleStrategy(ohlcv, params) {
  const { buyThreshold = 0.02, sellThreshold = 0.02 } = params;
  const signals = [];
  
  for (let i = 1; i < ohlcv.length; i++) {
    const priceChange = (ohlcv[i].close - ohlcv[i - 1].close) / ohlcv[i - 1].close;
    
    if (priceChange > buyThreshold) {
      signals.push({ index: i, action: 'BUY', price: ohlcv[i].close });
    } else if (priceChange < -sellThreshold) {
      signals.push({ index: i, action: 'SELL', price: ohlcv[i].close });
    }
  }
  
  return signals;
}

describe('Backtester Service', () => {
  
  describe('backtest()', () => {
    
    test('should run basic backtest successfully', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.001);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.015,
        sellThreshold: 0.015
      });
      
      expect(result).toBeDefined();
      expect(result.trades).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.equity_curve).toBeDefined();
      expect(result.period).toBeDefined();
    });
    
    test('should calculate performance metrics', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.001);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.015,
        sellThreshold: 0.015
      });
      
      expect(result.metrics.totalTrades).toBeGreaterThanOrEqual(0);
      expect(result.metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.winRate).toBeLessThanOrEqual(100);
      expect(result.metrics.sharpeRatio).toBeDefined();
      expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(result.metrics.profitFactor).toBeGreaterThanOrEqual(0);
    });
    
    test('should handle custom initial capital', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.001);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.015,
        sellThreshold: 0.015
      }, {
        initialCapital: 50000
      });
      
      expect(result.equity_curve[0].equity).toBe(50000);
    });
    
    test('should apply commission and slippage', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.001);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.01,
        sellThreshold: 0.01
      }, {
        commission: 0.002, // 0.2%
        slippage: 0.001    // 0.1%
      });
      
      if (result.trades.length > 0) {
        expect(result.trades[0].commission).toBeGreaterThan(0);
      }
    });
    
    test('should throw error for insufficient data', async () => {
      const ohlcv = generateOHLCV(5);
      
      await expect(
        backtest(ohlcv, simpleStrategy, {})
      ).rejects.toThrow('Insufficient historical data');
    });
    
    test('should throw error for invalid strategy', async () => {
      const ohlcv = generateOHLCV(100);
      
      await expect(
        backtest(ohlcv, 'not a function', {})
      ).rejects.toThrow('Strategy must be a function');
    });
    
    test('should generate equity curve', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.001);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.015,
        sellThreshold: 0.015
      });
      
      expect(result.equity_curve).toBeInstanceOf(Array);
      expect(result.equity_curve.length).toBeGreaterThan(0);
      expect(result.equity_curve[0]).toHaveProperty('timestamp');
      expect(result.equity_curve[0]).toHaveProperty('equity');
    });
    
    test('should close open positions at end', async () => {
      const ohlcv = generateOHLCV(50, 100, 0.002);
      
      // Strategy that buys but might not sell
      const buyOnlyStrategy = (ohlcv) => {
        return [
          { index: 10, action: 'BUY', price: ohlcv[10].close }
        ];
      };
      
      const result = await backtest(ohlcv, buyOnlyStrategy, {});
      
      expect(result.trades.length).toBe(1);
      expect(result.trades[0]).toHaveProperty('forced_exit');
    });
    
  });
  
  describe('Performance Metrics', () => {
    
    test('should calculate Sharpe ratio correctly', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.002);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.01,
        sellThreshold: 0.01
      });
      
      if (result.trades.length > 0) {
        expect(typeof result.metrics.sharpeRatio).toBe('number');
        expect(isFinite(result.metrics.sharpeRatio)).toBe(true);
      }
    });
    
    test('should calculate win rate correctly', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.001);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.015,
        sellThreshold: 0.015
      });
      
      if (result.trades.length > 0) {
        const wins = result.trades.filter(t => t.profit > 0).length;
        const expectedWinRate = (wins / result.trades.length) * 100;
        expect(result.metrics.winRate).toBeCloseTo(expectedWinRate, 1);
      }
    });
    
    test('should calculate max drawdown', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.001);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.015,
        sellThreshold: 0.015
      });
      
      expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(result.metrics.maxDrawdownPct).toBeGreaterThanOrEqual(0);
      expect(result.metrics.maxDrawdownPct).toBeLessThanOrEqual(100);
    });
    
    test('should calculate profit factor', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.002);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.01,
        sellThreshold: 0.01
      });
      
      if (result.trades.length > 0) {
        expect(result.metrics.profitFactor).toBeGreaterThanOrEqual(0);
      }
    });
    
    test('should handle zero trades gracefully', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.0001);
      
      const noSignalsStrategy = () => [];
      
      const result = await backtest(ohlcv, noSignalsStrategy, {});
      
      expect(result.trades.length).toBe(0);
      expect(result.metrics.totalTrades).toBe(0);
      expect(result.metrics.winRate).toBe(0);
      expect(result.metrics.sharpeRatio).toBe(0);
    });
    
    test('should calculate average trade metrics', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.002);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.015,
        sellThreshold: 0.015
      });
      
      if (result.trades.length > 0) {
        expect(result.metrics.averageReturn).toBeDefined();
        expect(result.metrics.averageWin).toBeGreaterThanOrEqual(0);
        expect(result.metrics.averageLoss).toBeGreaterThanOrEqual(0);
        expect(result.metrics.avgTradeDuration).toBeGreaterThan(0);
      }
    });
    
  });
  
  describe('Trade Execution', () => {
    
    test('should execute buy and sell signals', async () => {
      const ohlcv = generateOHLCV(50, 100, 0.002);
      
      const signalStrategy = (ohlcv) => [
        { index: 10, action: 'BUY', price: ohlcv[10].close },
        { index: 20, action: 'SELL', price: ohlcv[20].close }
      ];
      
      const result = await backtest(ohlcv, signalStrategy, {});
      
      expect(result.trades.length).toBe(1);
      expect(result.trades[0].entry_index).toBe(10);
      expect(result.trades[0].exit_index).toBe(20);
    });
    
    test('should not open position when already in position', async () => {
      const ohlcv = generateOHLCV(50, 100, 0.002);
      
      const doubleBuyStrategy = (ohlcv) => [
        { index: 10, action: 'BUY', price: ohlcv[10].close },
        { index: 15, action: 'BUY', price: ohlcv[15].close }, // Should be ignored
        { index: 20, action: 'SELL', price: ohlcv[20].close }
      ];
      
      const result = await backtest(ohlcv, doubleBuyStrategy, {});
      
      expect(result.trades.length).toBe(1);
    });
    
    test('should not sell when no position', async () => {
      const ohlcv = generateOHLCV(50, 100, 0.002);
      
      const sellOnlyStrategy = (ohlcv) => [
        { index: 10, action: 'SELL', price: ohlcv[10].close }
      ];
      
      const result = await backtest(ohlcv, sellOnlyStrategy, {});
      
      expect(result.trades.length).toBe(0);
    });
    
    test('should track trade duration', async () => {
      const ohlcv = generateOHLCV(50, 100, 0.002);
      
      const signalStrategy = (ohlcv) => [
        { index: 10, action: 'BUY', price: ohlcv[10].close },
        { index: 30, action: 'SELL', price: ohlcv[30].close }
      ];
      
      const result = await backtest(ohlcv, signalStrategy, {});
      
      expect(result.trades[0].duration).toBe(
        ohlcv[30].timestamp - ohlcv[10].timestamp
      );
    });
    
  });
  
  describe('walkForwardBacktest()', () => {
    
    test('should run walk-forward analysis', async () => {
      const ohlcv = generateOHLCV(200, 100, 0.001);
      
      const result = await walkForwardBacktest(ohlcv, simpleStrategy, {
        buyThreshold: 0.015,
        sellThreshold: 0.015
      }, {
        windowSize: 100,
        stepSize: 50
      });
      
      expect(result.windows).toBeDefined();
      expect(result.windows.length).toBeGreaterThan(0);
      expect(result.avgSharpeRatio).toBeDefined();
      expect(result.avgWinRate).toBeDefined();
    });
    
    test('should have overlapping windows', async () => {
      const ohlcv = generateOHLCV(200, 100, 0.001);
      
      const result = await walkForwardBacktest(ohlcv, simpleStrategy, {}, {
        windowSize: 100,
        stepSize: 30
      });
      
      expect(result.windows.length).toBeGreaterThan(2);
    });
    
  });
  
  describe('compareBacktests()', () => {
    
    test('should compare multiple backtest results', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.002);
      
      const result1 = await backtest(ohlcv, simpleStrategy, { buyThreshold: 0.01, sellThreshold: 0.01 });
      const result2 = await backtest(ohlcv, simpleStrategy, { buyThreshold: 0.02, sellThreshold: 0.02 });
      const result3 = await backtest(ohlcv, simpleStrategy, { buyThreshold: 0.03, sellThreshold: 0.03 });
      
      const comparison = compareBacktests([result1, result2, result3]);
      
      expect(comparison).toBeDefined();
      expect(comparison.comparison).toHaveLength(3);
      expect(comparison.bestBySharpe).toBeDefined();
      expect(comparison.bestByWinRate).toBeDefined();
      expect(comparison.bestByReturn).toBeDefined();
    });
    
    test('should handle empty results', () => {
      const comparison = compareBacktests([]);
      expect(comparison).toBeNull();
    });
    
  });
  
  describe('Edge Cases', () => {
    
    test('should handle very volatile market', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.05); // High volatility
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.01,
        sellThreshold: 0.01
      });
      
      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
    });
    
    test('should handle flat market', async () => {
      const ohlcv = generateOHLCV(100, 100, 0); // No trend
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.01,
        sellThreshold: 0.01
      });
      
      expect(result).toBeDefined();
    });
    
    test('should handle high commission rates', async () => {
      const ohlcv = generateOHLCV(100, 100, 0.002);
      
      const result = await backtest(ohlcv, simpleStrategy, {
        buyThreshold: 0.01,
        sellThreshold: 0.01
      }, {
        commission: 0.05 // 5% commission
      });
      
      expect(result).toBeDefined();
      // High commission should impact profits
      if (result.trades.length > 0) {
        const totalCommission = result.trades.reduce((sum, t) => sum + t.commission, 0);
        expect(totalCommission).toBeGreaterThan(0);
      }
    });
    
  });
  
});
