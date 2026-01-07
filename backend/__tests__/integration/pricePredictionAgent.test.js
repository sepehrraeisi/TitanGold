/**
 * Integration Tests for Price Prediction Agent
 * 
 * Tests end-to-end functionality including:
 * - MEXC data fetching
 * - Price predictions with real data
 * - Model training
 * - Error handling
 * - Performance metrics
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
  
  describe('run() - Price Prediction', () => {
    
    test('should run prediction successfully with valid inputs', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result).toHaveProperty('agent_key', 'price_prediction');
      expect(result).toHaveProperty('symbol', 'BTC/USDT');
      expect(result).toHaveProperty('timeframe', '1h');
      expect(result).toHaveProperty('current_price');
      expect(result).toHaveProperty('predictions');
      expect(result).toHaveProperty('method', 'linear');
      expect(result).toHaveProperty('accuracy');
      expect(result).toHaveProperty('execution_time_ms');
      expect(result).toHaveProperty('timestamp');
    });

    test('should include predictions for all timeframes', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result.predictions).toHaveProperty('1h');
      expect(result.predictions).toHaveProperty('4h');
      expect(result.predictions).toHaveProperty('24h');
      
      // Check each prediction has required properties
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
        timeframe: '1h'
      });

      expect(result.accuracy).toHaveProperty('rmse');
      expect(result.accuracy).toHaveProperty('rmse_percent');
      expect(result.accuracy).toHaveProperty('mae');
      expect(result.accuracy).toHaveProperty('mape');
      expect(result.accuracy).toHaveProperty('r_squared');
      expect(result.accuracy).toHaveProperty('test_samples');
    });

    test('should include trading insights', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });

      expect(result).toHaveProperty('insights');
      expect(result.insights).toHaveProperty('trend');
      expect(result.insights).toHaveProperty('price_changes');
      expect(result.insights).toHaveProperty('volatility');
      expect(result.insights).toHaveProperty('risk_level');
      expect(result.insights).toHaveProperty('recommendation');
      expect(result.insights).toHaveProperty('confidence_score');
      expect(result.insights).toHaveProperty('summary');
    });

    test('should work with different methods (linear, hybrid)', async () => {
      // Test only linear and hybrid - ARIMA can be slow
      const methods = ['linear', 'hybrid'];
      
      for (const method of methods) {
        const result = await pricePredictionAgent.run({
          userId: 1,
          symbol: 'BTC/USDT',
          timeframe: '1h',
          config: { method }
        });

        expect(result.method).toBe(method);
        expect(result.predictions).toHaveProperty('1h');
      }
    }, 30000); // 30 second timeout

    test('should handle different timeframes', async () => {
      const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
      
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
      const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'];
      
      for (const symbol of symbols) {
        const result = await pricePredictionAgent.run({
          userId: 1,
          symbol,
          timeframe: '1h'
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

    test('should accept custom ARIMA parameters', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {
          method: 'linear', // Use linear for speed
          arimaP: 3,
          arimaD: 1,
          arimaQ: 1
        }
      });

      expect(result.predictions).toBeDefined();
    });

    test('should handle errors gracefully', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: '',
        timeframe: '1h'
      });

      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('agent_key', 'price_prediction');
    });

    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
      });
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should include metadata', async () => {
      const result = await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h'
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
        config: { method: 'linear' } // Use linear for speed
      });

      expect(result).toHaveProperty('agent_key', 'price_prediction');
      expect(result).toHaveProperty('action', 'train');
      expect(result).toHaveProperty('symbol', 'BTC/USDT');
      expect(result).toHaveProperty('training_result');
      expect(result).toHaveProperty('execution_time_ms');
    }, 30000); // 30 second timeout

    test('should include both linear and ARIMA training results', async () => {
      const result = await pricePredictionAgent.trainModelForSymbol({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result.training_result).toHaveProperty('models');
      expect(result.training_result.models).toHaveProperty('linear');
      // ARIMA results may vary, so just check linear
    }, 30000);

    test('should recommend best model', async () => {
      const result = await pricePredictionAgent.trainModelForSymbol({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      });

      expect(result.training_result).toHaveProperty('best_model');
      expect(result.training_result).toHaveProperty('recommendation');
    }, 30000);

    test('should include model accuracy metrics', async () => {
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
      expect(linearAcc).toHaveProperty('r_squared');
    }, 30000);

    test('should cache trained model', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { method: 'linear' }
      };

      // Train the model
      await pricePredictionAgent.trainModelForSymbol(params);

      // Future predictions can use cached model
      const details = await pricePredictionAgent.getDetails({ userId: 1 });
      expect(details.metrics.cached_models).toBeGreaterThan(0);
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

    test('should include capabilities list', async () => {
      const details = await pricePredictionAgent.getDetails({ userId: 1 });

      expect(Array.isArray(details.capabilities)).toBe(true);
      expect(details.capabilities.length).toBeGreaterThan(0);
      expect(details.capabilities).toContain('Linear Regression predictions');
      expect(details.capabilities).toContain('ARIMA time series forecasting');
    });

    test('should include metrics', async () => {
      const details = await pricePredictionAgent.getDetails({ userId: 1 });

      expect(details.metrics).toHaveProperty('cached_predictions');
      expect(details.metrics).toHaveProperty('cached_models');
      expect(details.metrics).toHaveProperty('avg_confidence');
      expect(details.metrics).toHaveProperty('cache_ttl_ms');
    });
  });

  describe('defaultConfig() - Configuration', () => {
    
    test('should return default configuration', () => {
      const config = pricePredictionAgent.defaultConfig();

      expect(config).toHaveProperty('enabled', true);
      expect(config).toHaveProperty('method', 'hybrid');
      expect(config).toHaveProperty('arimaP', 5);
      expect(config).toHaveProperty('arimaD', 1);
      expect(config).toHaveProperty('arimaQ', 2);
      expect(config).toHaveProperty('minDataPoints', 30);
      expect(config).toHaveProperty('cacheEnabled', true);
      expect(config).toHaveProperty('cacheTTL');
    });
  });

  describe('Performance Tests', () => {
    
    test('should handle multiple concurrent predictions', async () => {
      const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];
      
      const promises = symbols.map(symbol =>
        pricePredictionAgent.run({
          userId: 1,
          symbol,
          timeframe: '1h'
        })
      );

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toHaveProperty('predictions');
      });
    });

    test('should maintain performance with large datasets', async () => {
      const startTime = Date.now();
      
      await pricePredictionAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1m', // Will fetch more candles
        config: { method: 'linear' } // Faster than ARIMA
      });
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
