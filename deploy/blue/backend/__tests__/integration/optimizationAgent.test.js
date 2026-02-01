/**
 * Optimization Agent Integration Tests
 * BACKEND-010: Implement Optimization Agent
 */

import { jest } from '@jest/globals';

// Mock MEXC service
jest.unstable_mockModule('../../services/mexc.js', () => {
  return {
    mexcService: {
      fetchOHLCV: jest.fn()
    }
  };
});

const optimizationAgent = await import('../../services/agents/optimization.js');
const { mexcService } = await import('../../services/mexc.js');

// Helper: Generate mock OHLCV data
function generateMockOHLCV(count = 100, startPrice = 65000, trend = 0.001) {
  const data = [];
  let price = startPrice;
  
  for (let i = 0; i < count; i++) {
    const open = price;
    const change = price * trend + (Math.random() - 0.5) * price * 0.02;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    data.push({
      timestamp: Date.now() + i * 3600000,
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500
    });
    
    price = close;
  }
  
  return data;
}

describe('Optimization Agent Integration Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('run() - Strategy Optimization', () => {
    
    test('should run complete optimization', async () => {
      const mockData = generateMockOHLCV(100, 65000, 0.002);
      mexcService.fetchOHLCV.mockResolvedValue(mockData);
      
      const result = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {
          method: 'grid_search',
          maxTests: 10
        }
      });
      
      expect(result.agent).toBe('optimization');
      expect(result.symbol).toBe('BTC/USDT');
      expect(result.optimization).toBeDefined();
      expect(result.best_strategy).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.metadata).toBeDefined();
    }, 30000);
    
    test('should calculate performance metrics', async () => {
      const mockData = generateMockOHLCV(100, 65000, 0.002);
      mexcService.fetchOHLCV.mockResolvedValue(mockData);
      
      const result = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { maxTests: 10 }
      });
      
      expect(result.best_strategy.sharpe_ratio).toBeDefined();
      expect(result.best_strategy.win_rate).toBeGreaterThanOrEqual(0);
      expect(result.best_strategy.win_rate).toBeLessThanOrEqual(100);
      expect(result.best_strategy.max_drawdown_pct).toBeGreaterThanOrEqual(0);
      expect(result.best_strategy.total_trades).toBeGreaterThanOrEqual(0);
    }, 30000);
    
    test('should use grid search method', async () => {
      const mockData = generateMockOHLCV(100, 65000, 0.002);
      mexcService.fetchOHLCV.mockResolvedValue(mockData);
      
      const result = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {
          method: 'grid_search',
          maxTests: 8
        }
      });
      
      expect(result.optimization.method).toBe('grid_search');
      expect(result.optimization.tested_combinations).toBeGreaterThan(0);
    }, 30000);
    
    test('should suggest optimal parameters', async () => {
      const mockData = generateMockOHLCV(100, 65000, 0.002);
      mexcService.fetchOHLCV.mockResolvedValue(mockData);
      
      const result = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {
          maxTests: 10,
          topN: 5
        }
      });
      
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeLessThanOrEqual(5);
      
      if (result.suggestions.length > 0) {
        expect(result.suggestions[0]).toHaveProperty('rank');
        expect(result.suggestions[0]).toHaveProperty('params');
        expect(result.suggestions[0]).toHaveProperty('recommendation');
        expect(result.suggestions[0].rank).toBe(1);
      }
    }, 30000);
    
    test('should calculate improvement metrics', async () => {
      const mockData = generateMockOHLCV(100, 65000, 0.002);
      mexcService.fetchOHLCV.mockResolvedValue(mockData);
      
      const result = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {
          maxTests: 10,
          baselineSharpe: 0.5,
          baselineWinRate: 50
        }
      });
      
      expect(result.optimization.improvement).toBeDefined();
      expect(result.optimization.improvement.sharpe_improvement_pct).toBeDefined();
      expect(result.optimization.improvement.final_sharpe).toBeDefined();
    }, 30000);
    
    test('should include backtest results', async () => {
      const mockData = generateMockOHLCV(100, 65000, 0.002);
      mexcService.fetchOHLCV.mockResolvedValue(mockData);
      
      const result = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { maxTests: 8 }
      });
      
      expect(result.backtest_results).toBeDefined();
      expect(result.backtest_results.trades).toBeGreaterThanOrEqual(0);
      expect(result.backtest_results.equity_curve).toBeInstanceOf(Array);
      expect(result.backtest_results.period).toBeDefined();
    }, 30000);
    
    test('should generate summary', async () => {
      const mockData = generateMockOHLCV(100, 65000, 0.002);
      mexcService.fetchOHLCV.mockResolvedValue(mockData);
      
      const result = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { maxTests: 8 }
      });
      
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    }, 30000);
    
    test('should handle errors gracefully', async () => {
      mexcService.fetchOHLCV.mockRejectedValue(new Error('API error'));
      
      const result = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });
      
      expect(result.error).toBeDefined();
      expect(result.metadata.success).toBe(false);
    }, 30000);
    
    test('should handle insufficient data', async () => {
      const mockData = generateMockOHLCV(30); // Too few candles
      mexcService.fetchOHLCV.mockResolvedValue(mockData);
      
      const result = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Insufficient');
    }, 30000);
    
    test('should cache results', async () => {
      const mockData = generateMockOHLCV(100, 65000, 0.002);
      mexcService.fetchOHLCV.mockResolvedValue(mockData);
      
      // First call
      const result1 = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'ETH/USDT', // Different symbol to avoid cache collision
        timeframe: '1h',
        config: { maxTests: 5, cacheEnabled: true }
      });
      
      expect(result1.metadata.cache_hit).toBe(false);
      
      // Second call (should be cached)
      const result2 = await optimizationAgent.default.run({
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '1h',
        config: { maxTests: 5, cacheEnabled: true }
      });
      
      expect(result2.metadata.cache_hit).toBe(true);
    }, 30000);
    
  });
  
  describe('getDetails()', () => {
    
    test('should return agent details', async () => {
      const details = await optimizationAgent.default.getDetails({ userId: 1 });
      
      expect(details.agent).toBe('optimization');
      expect(details.name).toBe('Optimization Agent');
      expect(details.status).toBe('active');
      expect(details.version).toBe('1.0.0');
    });
    
    test('should include capabilities', async () => {
      const details = await optimizationAgent.default.getDetails({ userId: 1 });
      
      expect(details.capabilities).toBeInstanceOf(Array);
      expect(details.capabilities.length).toBeGreaterThan(0);
      expect(details.capabilities).toContain('Historical backtesting');
      expect(details.capabilities).toContain('Grid search optimization');
    });
    
  });
  
  describe('defaultConfig()', () => {
    
    test('should return default configuration', () => {
      const config = optimizationAgent.default.defaultConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.method).toBe('grid_search');
      expect(config.objective).toBe('sharpe');
      expect(config.dataLimit).toBe(500);
    });
    
  });
  
});
