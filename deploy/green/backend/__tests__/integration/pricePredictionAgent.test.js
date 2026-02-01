/**
 * Integration Tests for Price Prediction Agent (Fast Version)
 * 
 * Tests end-to-end functionality with linear regression only for speed
 */

import { jest } from '@jest/globals';
import pricePredictionAgent from '../../services/agents/price_prediction.js';

// Mock MEXC service
jest.unstable_mockModule('../../services/mexc.js', () => {
  class MockMexcService {
    async initializeExchange(userId) {
      return true;
    }
    
    async fetchOHLCV(userId, symbol, timeframe, limit) {
      // Generate realistic mock OHLCV data
      const data = [];
      let price = 50000;
      const baseTime = Date.now() - (limit * 3600000);
      
      for (let i = 0; i < limit; i++) {
        const randomChange = (Math.random() - 0.5) * price * 0.02;
        const trendChange = price * 0.0005;
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

describe('Price Prediction Agent Integration Tests', () => {
  
  describe('run() - Basic Functionality', () => {
    
    test('should run prediction successfully', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result).toHaveProperty('agent_key', 'price_prediction');
      expect(result).toHaveProperty('symbol', 'BTC/USDT');
      expect(result).toHaveProperty('current_price');
      expect(result).toHaveProperty('predictions');
      expect(result).toHaveProperty('method', 'linear');
    });

    test('should include all timeframe predictions', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result.predictions).toHaveProperty('1h');
      expect(result.predictions).toHaveProperty('4h');
      expect(result.predictions).toHaveProperty('24h');
      
      // Check structure
      ['1h', '4h', '24h'].forEach(tf => {
        expect(result.predictions[tf]).toHaveProperty('price');
        expect(result.predictions[tf]).toHaveProperty('lower');
        expect(result.predictions[tf]).toHaveProperty('upper');
        expect(result.predictions[tf]).toHaveProperty('confidence');
      });
    });

    test('should include accuracy metrics', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result.accuracy).toHaveProperty('rmse');
      expect(result.accuracy).toHaveProperty('rmse_percent');
      expect(result.accuracy).toHaveProperty('mae');
      expect(result.accuracy).toHaveProperty('mape');
      expect(result.accuracy).toHaveProperty('r_squared');
    });

    test('should include trading insights', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result).toHaveProperty('insights');
      expect(result.insights).toHaveProperty('trend');
      expect(result.insights).toHaveProperty('price_changes');
      expect(result.insights).toHaveProperty('volatility');
      expect(result.insights).toHaveProperty('risk_level');
      expect(result.insights).toHaveProperty('recommendation');
      expect(result.insights).toHaveProperty('summary');
    });

    test('should handle different timeframes', async () => {
      const timeframes = ['1h', '4h', '1d'];
      
      for (const timeframe of timeframes) {
        const result = await pricePredictionAgent.run({
          userId: 1,
          symbol: 'BTC/USDT',
          timeframe,
          config: { method: 'linear' }
        });

        expect(result.timeframe).toBe(timeframe);
        expect(result.predictions).toBeDefined();
      }
    });

    test('should handle different symbols', async () => {
      const symbols = ['BTC/USDT', 'ETH/USDT'];
      
      for (const symbol of symbols) {
        const result = await pricePredictionAgent.run({
          userId: 1,
          symbol,
          timeframe: '1h',
          config: { method: 'linear' }
        });

        expect(result.symbol).toBe(symbol);
        expect(result.predictions).toBeDefined();
      }
    });

    test('should cache predictions', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      };

      const result1 = await pricePredictionAgent.run(params);
      const result2 = await pricePredictionAgent.run(params);

      // Second call should be from cache
      expect(result2).toHaveProperty('from_cache', true);
      expect(result2).toHaveProperty('cache_age_ms');
    });

    test('should handle errors gracefully', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: '',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('agent_key', 'price_prediction');
    });

    test('should include metadata', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result).toHaveProperty('_meta');
      expect(result._meta).toHaveProperty('version');
      expect(result._meta).toHaveProperty('model');
      expect(result._meta).toHaveProperty('confidence');
    });
  });

  describe('trainModelForSymbol() - Model Training', () => {
    
    test('should train model successfully', async () => {
      const result = await pricePredictionAgent.trainModelForSymbol({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result).toHaveProperty('agent_key', 'price_prediction');
      expect(result).toHaveProperty('action', 'train');
      expect(result).toHaveProperty('symbol', 'BTC/USDT');
      expect(result).toHaveProperty('training_result');
    });

    test('should include training results', async () => {
      const result = await pricePredictionAgent.trainModelForSymbol({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result.training_result).toHaveProperty('models');
      expect(result.training_result.models).toHaveProperty('linear');
    });

    test('should include model accuracy', async () => {
      const result = await pricePredictionAgent.trainModelForSymbol({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      const linearAcc = result.training_result.models.linear.accuracy;
      expect(linearAcc).toHaveProperty('rmse');
      expect(linearAcc).toHaveProperty('rmse_percent');
      expect(linearAcc).toHaveProperty('mae');
      expect(linearAcc).toHaveProperty('mape');
    });
  });

  describe('getDetails() - Agent Information', () => {
    
    test('should return agent details', async () => {
      const details = await pricePredictionAgent.getDetails({ userId: 1 });

      expect(details).toHaveProperty('agent_key', 'price_prediction');
      expect(details).toHaveProperty('name', 'Price Prediction Agent');
      expect(details).toHaveProperty('description');
      expect(details).toHaveProperty('status', 'active');
      expect(details).toHaveProperty('version');
      expect(details).toHaveProperty('capabilities');
      expect(details).toHaveProperty('metrics');
    });

    test('should include capabilities', async () => {
      const details = await pricePredictionAgent.getDetails({ userId: 1 });

      expect(Array.isArray(details.capabilities)).toBe(true);
      expect(details.capabilities.length).toBeGreaterThan(0);
    });

    test('should include metrics', async () => {
      const details = await pricePredictionAgent.getDetails({ userId: 1 });

      expect(details.metrics).toHaveProperty('cached_predictions');
      expect(details.metrics).toHaveProperty('cached_models');
      expect(details.metrics).toHaveProperty('avg_confidence');
    });
  });

  describe('defaultConfig()', () => {
    
    test('should return default configuration', () => {
      const config = pricePredictionAgent.defaultConfig();

      expect(config).toHaveProperty('enabled', true);
      expect(config).toHaveProperty('method', 'hybrid');
      expect(config).toHaveProperty('minDataPoints', 30);
      expect(config).toHaveProperty('cacheEnabled', true);
    });
  });

  describe('Performance', () => {
    
    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000);
    });

    test('should handle multiple predictions', async () => {
      const symbols = ['BTC/USDT', 'ETH/USDT'];
      
      const promises = symbols.map(symbol =>
        pricePredictionAgent.run({
          userId: 1,
          symbol,
          timeframe: '1h',
          config: { method: 'linear' }
        })
      );

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(2);
      results.forEach(result => {
        expect(result).toHaveProperty('predictions');
      });
    });
  });
});
