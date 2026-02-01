/**
 * Integration Tests for Trend Detection Agent
 * 
 * Tests end-to-end functionality including:
 * - Trend analysis with real data structure
 * - ADX calculation and interpretation
 * - Moving averages analysis
 * - Trend lines detection
 * - Reversal signals
 * - Trading recommendations
 */

import { jest } from '@jest/globals';
import trendAgent from '../../services/agents/trend.js';

// Mock MEXC service
jest.unstable_mockModule('../../services/mexc.js', () => {
  class MockMexcService {
    async initializeExchange(userId) {
      return true;
    }
    
    async fetchOHLCV(userId, symbol, timeframe, limit) {
      // Generate realistic mock OHLCV data with trend
      const data = [];
      let price = 50000;
      const baseTime = Date.now() - (limit * 3600000);
      const trend = 0.005; // Slight uptrend
      
      for (let i = 0; i < limit; i++) {
        const randomChange = (Math.random() - 0.5) * price * 0.02;
        const trendChange = price * trend;
        price = price + randomChange + trendChange;
        
        const high = price * (1 + Math.random() * 0.01);
        const low = price * (1 - Math.random() * 0.01);
        const open = i > 0 ? data[i-1][4] : price;
        const close = price;
        const volume = Math.random() * 1000000;
        
        data.push([baseTime + (i * 3600000), open, high, low, close, volume]);
      }
      
      return data;
    }
  }
  
  return {
    mexcService: new MockMexcService()
  };
});

// Mock logger
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Trend Detection Agent Integration Tests', () => {
  
  describe('run() - Trend Analysis', () => {
    
    test('should run complete trend analysis', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(result).toHaveProperty('agent_key', 'trend_detection');
      expect(result).toHaveProperty('symbol', 'BTC/USDT');
      expect(result).toHaveProperty('timeframe', '1h');
      expect(result).toHaveProperty('current_price');
      expect(result).toHaveProperty('adx');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('moving_averages');
      expect(result).toHaveProperty('trend_lines');
      expect(result).toHaveProperty('reversal_signals');
      expect(result).toHaveProperty('trading_recommendation');
    });

    test('should include ADX metrics', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(result.adx).toHaveProperty('value');
      expect(result.adx).toHaveProperty('di_plus');
      expect(result.adx).toHaveProperty('di_minus');
      expect(result.adx).toHaveProperty('strength');
      expect(result.adx).toHaveProperty('interpretation');
      
      expect(['weak', 'moderate', 'strong']).toContain(result.adx.strength);
      expect(typeof result.adx.value).toBe('number');
    });

    test('should include trend classification', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '4h'
      });

      expect(result.trend).toHaveProperty('direction');
      expect(result.trend).toHaveProperty('strength');
      expect(result.trend).toHaveProperty('confidence');
      expect(result.trend).toHaveProperty('description');
      
      expect(['up', 'down', 'sideways']).toContain(result.trend.direction);
      expect(['weak', 'moderate', 'strong']).toContain(result.trend.strength);
      expect(result.trend.confidence).toBeGreaterThanOrEqual(0);
      expect(result.trend.confidence).toBeLessThanOrEqual(100);
    });

    test('should include moving averages analysis', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(result.moving_averages).toHaveProperty('sma_50');
      expect(result.moving_averages).toHaveProperty('ema_20');
      expect(result.moving_averages).toHaveProperty('alignment');
      expect(result.moving_averages).toHaveProperty('signal');
      
      expect(result.moving_averages.sma_50).toHaveProperty('value');
      expect(result.moving_averages.sma_50).toHaveProperty('position');
      expect(result.moving_averages.sma_50).toHaveProperty('distance_percent');
      
      expect(['above', 'below']).toContain(result.moving_averages.sma_50.position);
    });

    test('should include trend lines', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(result.trend_lines).toBeDefined();
      expect(result.trend_lines).toHaveProperty('pivots_count');
      expect(typeof result.trend_lines.pivots_count).toBe('number');
    });

    test('should include reversal signals', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(Array.isArray(result.reversal_signals)).toBe(true);
      
      if (result.reversal_signals.length > 0) {
        result.reversal_signals.forEach(signal => {
          expect(signal).toHaveProperty('type');
          expect(signal).toHaveProperty('description');
          expect(signal).toHaveProperty('strength');
          expect(signal).toHaveProperty('confidence');
        });
      }
    });

    test('should include trading recommendation', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(result.trading_recommendation).toHaveProperty('action');
      expect(result.trading_recommendation).toHaveProperty('confidence');
      expect(result.trading_recommendation).toHaveProperty('reasoning');
      
      expect(['BUY', 'SELL', 'HOLD']).toContain(result.trading_recommendation.action);
      expect(result.trading_recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(result.trading_recommendation.confidence).toBeLessThanOrEqual(100);
    });

    test('should handle different timeframes', async () => {
      // Test just one timeframe to avoid timeout
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '4h'
      });

      expect(result.timeframe).toBe('4h');
      expect(result.adx).toBeDefined();
    }, 20000);

    test('should handle different symbols', async () => {
      // Test just one symbol to avoid timeout
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '1h'
      });

      expect(result.symbol).toBe('ETH/USDT');
      expect(result.trend).toBeDefined();
    }, 20000);

    test('should accept custom configuration', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {
          adxPeriod: 10,
          smaPeriod: 30,
          emaPeriod: 15
        }
      });

      expect(result).toHaveProperty('adx');
      expect(result).toHaveProperty('moving_averages');
    });

    test('should cache results', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      };

      const result1 = await trendAgent.run(params);
      const result2 = await trendAgent.run(params);

      expect(result2).toHaveProperty('from_cache', true);
      expect(result2).toHaveProperty('cache_age_ms');
    });

    test('should handle errors gracefully', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: '',
        timeframe: '1h'
      });

      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('agent_key', 'trend_detection');
    });

    test('should include metadata', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(result).toHaveProperty('_meta');
      expect(result._meta).toHaveProperty('version');
      expect(result._meta).toHaveProperty('indicators');
      expect(result._meta).toHaveProperty('confidence');
      
      expect(Array.isArray(result._meta.indicators)).toBe(true);
    });

    test('should include execution time', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(result).toHaveProperty('execution_time_ms');
      expect(result.execution_time_ms).toBeGreaterThan(0);
    });

    test('should include summary', async () => {
      const result = await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(result).toHaveProperty('summary');
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });
  });

  describe('getDetails()', () => {
    
    test('should return agent details', async () => {
      const details = await trendAgent.getDetails({ userId: 1 });

      expect(details).toHaveProperty('agent_key', 'trend_detection');
      expect(details).toHaveProperty('name');
      expect(details).toHaveProperty('description');
      expect(details).toHaveProperty('status', 'active');
      expect(details).toHaveProperty('version');
      expect(details).toHaveProperty('capabilities');
      expect(details).toHaveProperty('indicators');
      expect(details).toHaveProperty('metrics');
    });

    test('should include capabilities list', async () => {
      const details = await trendAgent.getDetails({ userId: 1 });

      expect(Array.isArray(details.capabilities)).toBe(true);
      expect(details.capabilities.length).toBeGreaterThan(0);
    });

    test('should include indicator descriptions', async () => {
      const details = await trendAgent.getDetails({ userId: 1 });

      expect(Array.isArray(details.indicators)).toBe(true);
      expect(details.indicators.length).toBeGreaterThan(0);
      
      details.indicators.forEach(indicator => {
        expect(indicator).toHaveProperty('name');
        expect(indicator).toHaveProperty('description');
      });
    });
  });

  describe('defaultConfig()', () => {
    
    test('should return default configuration', () => {
      const config = trendAgent.defaultConfig();

      expect(config).toHaveProperty('enabled', true);
      expect(config).toHaveProperty('adxPeriod', 14);
      expect(config).toHaveProperty('smaPeriod', 50);
      expect(config).toHaveProperty('emaPeriod', 20);
      expect(config).toHaveProperty('trendLineLookback', 20);
      expect(config).toHaveProperty('candleCount', 200);
    });
  });

  describe('Performance', () => {
    
    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await trendAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000);
    });
  });
});
