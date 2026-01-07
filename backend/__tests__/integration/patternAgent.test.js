/**
 * Integration Tests for Pattern Recognition Agent
 * 
 * Tests the complete pattern agent workflow including:
 * - Agent run with MEXC data fetching
 * - Configuration handling
 * - Pattern detection and analysis
 * - Error scenarios
 * 
 * @jest-environment node
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import patternAgent from '../../services/agents/pattern.js';

describe('Pattern Recognition Agent Integration', () => {
  beforeEach(() => {
    // Clean state before each test
  });

  describe('Agent Run', () => {
    test('should run pattern analysis successfully', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {}
      };

      const result = await patternAgent.run(params);

      expect(result).toBeDefined();
      expect(result.agent_key).toBe('pattern');
      expect(result.symbol).toBe('BTC/USDT');
      expect(result.timestamp).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }, 30000);

    test('should return pattern analysis results', async () => {
      const params = {
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '1h',
        config: {}
      };

      const result = await patternAgent.run(params);

      expect(result.result).toBeDefined();
      expect(result.result.current_price).toBeGreaterThan(0);
      expect(result.result.patterns_detected).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.result.patterns)).toBe(true);
      expect(Array.isArray(result.result.support_levels)).toBe(true);
      expect(Array.isArray(result.result.resistance_levels)).toBe(true);
      expect(result.result.dominant_signal).toBeDefined();
      expect(result.result.recommendation).toBeDefined();
    }, 30000);

    test('should include pattern details when detected', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {}
      };

      const result = await patternAgent.run(params);

      if (result.result.patterns.length > 0) {
        const pattern = result.result.patterns[0];
        expect(pattern).toHaveProperty('type');
        expect(pattern).toHaveProperty('direction');
        expect(pattern).toHaveProperty('confidence');
        expect(pattern).toHaveProperty('support');
        expect(pattern).toHaveProperty('resistance');
        expect(pattern).toHaveProperty('targetPrice');
        expect(pattern).toHaveProperty('breakoutDirection');
        expect(pattern).toHaveProperty('distanceToBreakout');
        expect(pattern).toHaveProperty('isActive');
      }
    }, 30000);

    test('should include metadata', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '4h',
        config: {}
      };

      const result = await patternAgent.run(params);

      expect(result.meta).toBeDefined();
      expect(result.meta.source).toBe('realtime');
      expect(result.meta.version).toBe('1.0.0');
      expect(result.meta.execution_time_ms).toBeDefined();
      expect(result.meta.data_points).toBeGreaterThan(0);
      expect(result.meta.timeframe).toBe('4h');
    }, 30000);
  });

  describe('Configuration Options', () => {
    test('should use custom minimum confidence', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {
          minConfidence: 0.7
        }
      };

      const result = await patternAgent.run(params);

      result.result.patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.7);
      });
    }, 30000);

    test('should use custom data points', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {
          dataPoints: 100
        }
      };

      const result = await patternAgent.run(params);

      expect(result.meta.data_points).toBeLessThanOrEqual(100);
    }, 30000);

    test('should include/exclude support levels based on config', async () => {
      const withSupport = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { includeSupport: true }
      });

      expect(withSupport.result.support_levels).toBeDefined();

      const withoutSupport = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { includeSupport: false }
      });

      // Should still have the property, might be empty
      expect(withoutSupport.result.support_levels).toBeDefined();
    }, 30000);
  });

  describe('Multiple Timeframes', () => {
    test('should analyze 15-minute timeframe', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '15m',
        config: {}
      });

      expect(result).toBeDefined();
      expect(result.meta.timeframe).toBe('15m');
    }, 30000);

    test('should analyze 4-hour timeframe', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '4h',
        config: {}
      });

      expect(result).toBeDefined();
      expect(result.meta.timeframe).toBe('4h');
    }, 30000);

    test('should analyze daily timeframe', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      });

      expect(result).toBeDefined();
      expect(result.meta.timeframe).toBe('1d');
    }, 30000);
  });

  describe('Multiple Symbols', () => {
    test('should analyze BTC/USDT', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {}
      });

      expect(result.symbol).toBe('BTC/USDT');
      expect(result.result.current_price).toBeGreaterThan(0);
    }, 30000);

    test('should analyze ETH/USDT', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '1h',
        config: {}
      });

      expect(result.symbol).toBe('ETH/USDT');
      expect(result.result.current_price).toBeGreaterThan(0);
    }, 30000);

    test('should analyze different symbols independently', async () => {
      const btcResult = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {}
      });

      const ethResult = await patternAgent.run({
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '1h',
        config: {}
      });

      expect(btcResult.symbol).toBe('BTC/USDT');
      expect(ethResult.symbol).toBe('ETH/USDT');
      // Prices should be different
      expect(btcResult.result.current_price).not.toBe(ethResult.result.current_price);
    }, 30000);
  });

  describe('Pattern Detection Quality', () => {
    test('should detect patterns with valid confidence scores', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {}
      });

      result.result.patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      });
    }, 30000);

    test('should order patterns by confidence', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {}
      });

      const patterns = result.result.patterns;
      if (patterns.length > 1) {
        for (let i = 1; i < patterns.length; i++) {
          expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(patterns[i].confidence);
        }
      }
    }, 30000);

    test('should have valid breakout directions', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {}
      });

      const validDirections = ['up', 'down', 'either', 'neutral'];
      result.result.patterns.forEach(pattern => {
        expect(validDirections).toContain(pattern.breakoutDirection);
      });
    }, 30000);
  });

  describe('Support and Resistance', () => {
    test('should calculate support levels', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { includeSupport: true }
      });

      expect(Array.isArray(result.result.support_levels)).toBe(true);
      result.result.support_levels.forEach(level => {
        expect(typeof level).toBe('number');
        expect(level).toBeGreaterThan(0);
      });
    }, 30000);

    test('should calculate resistance levels', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: { includeResistance: true }
      });

      expect(Array.isArray(result.result.resistance_levels)).toBe(true);
      result.result.resistance_levels.forEach(level => {
        expect(typeof level).toBe('number');
        expect(level).toBeGreaterThan(0);
      });
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', async () => {
      const result = await patternAgent.run({
        userId: null,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {}
      });

      expect(result).toBeDefined();
      expect(result.agent_key).toBe('pattern');
    }, 30000);

    test('should provide error details when analysis fails', async () => {
      const result = await patternAgent.run({
        userId: 1,
        symbol: 'INVALID_SYMBOL_12345',
        timeframe: '1h',
        config: {}
      });

      // Should still return a result structure
      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
    }, 30000);
  });

  describe('Agent Details', () => {
    test('should return agent details', async () => {
      const details = await patternAgent.getDetails({ userId: 1 });

      expect(details).toBeDefined();
      expect(details.agent_key).toBe('pattern');
      expect(details.name).toBe('Pattern Recognition Agent');
      expect(details.description).toBeDefined();
      expect(details.status).toBe('active');
      expect(details.version).toBe('1.0.0');
    });

    test('should include capabilities', async () => {
      const details = await patternAgent.getDetails({ userId: 1 });

      expect(details.capabilities).toBeDefined();
      expect(Array.isArray(details.capabilities)).toBe(true);
      expect(details.capabilities.length).toBeGreaterThan(0);
    });

    test('should list supported patterns', async () => {
      const details = await patternAgent.getDetails({ userId: 1 });

      expect(details.patterns_supported).toBeDefined();
      expect(Array.isArray(details.patterns_supported)).toBe(true);
      expect(details.patterns_supported.length).toBeGreaterThanOrEqual(10);
    });

    test('should include configuration info', async () => {
      const details = await patternAgent.getDetails({ userId: 1 });

      expect(details.configuration).toBeDefined();
      expect(details.configuration.min_confidence).toBeDefined();
      expect(details.configuration.supported_timeframes).toBeDefined();
    });
  });

  describe('Default Configuration', () => {
    test('should return default config', () => {
      const config = patternAgent.defaultConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.threshold).toBe(0.6);
      expect(config.minConfidence).toBe(0.5);
      expect(config.dataPoints).toBe(200);
    });
  });

  describe('Performance', () => {
    test('should complete within reasonable time', async () => {
      const startTime = Date.now();

      await patternAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        config: {}
      });

      const duration = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    }, 30000);

    test('should handle concurrent requests', async () => {
      const requests = [
        patternAgent.run({ userId: 1, symbol: 'BTC/USDT', timeframe: '1h', config: {} }),
        patternAgent.run({ userId: 1, symbol: 'ETH/USDT', timeframe: '1h', config: {} }),
        patternAgent.run({ userId: 1, symbol: 'BTC/USDT', timeframe: '4h', config: {} })
      ];

      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.agent_key).toBe('pattern');
      });
    }, 30000);
  });
});
