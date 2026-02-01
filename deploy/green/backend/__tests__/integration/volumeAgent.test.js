/**
 * Volume Analysis Agent Integration Tests
 * BACKEND-013: Implement Volume Analysis Agent
 */

import { jest } from '@jest/globals';

// Mock MEXC service
const mockFetchOHLCV = jest.fn();
const mockInitializeExchange = jest.fn();

jest.unstable_mockModule('../../services/mexc.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    initializeExchange: mockInitializeExchange,
    fetchOHLCV: mockFetchOHLCV
  }))
}));

// Mock logger
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const { run, getDetails, defaultConfig, clearCache } = await import('../../services/agents/volume.js');

describe('TITANGOLD Volume Analysis Agent - Integration Tests', () => {
  const userId = 'test-user-123';
  const symbol = 'BTC/USDT';
  const timeframe = '1h';

  // Helper: Generate mock OHLCV data
  function generateMockOHLCV(length, startPrice = 50000, trend = 0.001) {
    const ohlcv = [];
    let price = startPrice;
    const baseTime = Date.now() - (length * 3600000);
    
    for (let i = 0; i < length; i++) {
      const randomChange = (Math.random() - 0.5) * price * 0.02;
      const trendChange = price * trend;
      price = Math.max(price + randomChange + trendChange, startPrice * 0.5);
      
      const high = price * (1 + Math.random() * 0.01);
      const low = price * (1 - Math.random() * 0.01);
      const open = i > 0 ? ohlcv[i - 1][4] : price;
      const volume = 1000 * (0.8 + Math.random() * 0.4);
      
      ohlcv.push([
        baseTime + i * 3600000,
        open,
        high,
        low,
        price,
        volume
      ]);
    }
    
    return ohlcv;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
    
    mockInitializeExchange.mockResolvedValue(true);
    mockFetchOHLCV.mockResolvedValue(generateMockOHLCV(100, 50000, 0.001));
  });

  describe('End-to-End Workflow', () => {
    it('should complete full volume analysis workflow', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result).toBeDefined();
      expect(result.agent_key).toBe('volume');
      expect(result.symbol).toBe(symbol);
      expect(result.timeframe).toBe(timeframe);
      expect(result.obv).toBeDefined();
      expect(result.vwap).toBeDefined();
      expect(result.volume_profile).toBeDefined();
      expect(result.volume_spikes).toBeDefined();
      expect(result.trading_recommendation).toBeDefined();
    });

    it('should fetch OHLCV data from MEXC', async () => {
      await run({ userId, symbol, timeframe });

      expect(mockInitializeExchange).toHaveBeenCalledWith(userId);
      expect(mockFetchOHLCV).toHaveBeenCalledWith(
        userId,
        symbol,
        timeframe,
        expect.any(Number)
      );
    });

    it('should return trading recommendation', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.trading_recommendation).toBeDefined();
      expect(result.trading_recommendation.action).toBeDefined();
      expect(['BUY', 'SELL', 'HOLD']).toContain(result.trading_recommendation.action);
      expect(result.trading_recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(result.trading_recommendation.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('OBV Analysis', () => {
    it('should calculate OBV correctly', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.obv).toBeDefined();
      expect(result.obv.current).toBeDefined();
      expect(typeof result.obv.current).toBe('number');
      expect(result.obv.trend).toBeDefined();
      expect(['up', 'down', 'flat']).toContain(result.obv.trend);
    });

    it('should detect OBV divergence', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.obv.divergence).toBeDefined();
      expect(result.obv.divergence.type).toBeDefined();
      expect(['bullish', 'bearish', 'none']).toContain(result.obv.divergence.type);
    });

    it('should provide OBV signal', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.obv.signal).toBeDefined();
      expect(result.obv.signal.type).toBeDefined();
      expect(result.obv.signal.reason).toBeDefined();
      expect(result.obv.signal.strength).toBeDefined();
    });
  });

  describe('VWAP Analysis', () => {
    it('should calculate VWAP correctly', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.vwap).toBeDefined();
      expect(result.vwap.current).toBeGreaterThan(0);
      expect(result.vwap.currentPrice).toBeGreaterThan(0);
      expect(result.vwap.position).toBeDefined();
      expect(['above', 'below', 'at']).toContain(result.vwap.position);
    });

    it('should calculate VWAP deviation', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.vwap.deviation).toBeDefined();
      expect(typeof result.vwap.deviation).toBe('number');
    });

    it('should provide VWAP signal', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.vwap.signal).toBeDefined();
      expect(result.vwap.signal.type).toBeDefined();
      expect(result.vwap.signal.reason).toBeDefined();
    });
  });

  describe('Volume Profile', () => {
    it('should generate volume profile', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.volume_profile).toBeDefined();
      expect(result.volume_profile.pointOfControl).toBeDefined();
      expect(result.volume_profile.pointOfControl.price).toBeGreaterThan(0);
      expect(result.volume_profile.pointOfControl.volume).toBeGreaterThan(0);
    });

    it('should identify Value Area', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.volume_profile.valueAreaHigh).toBeDefined();
      expect(result.volume_profile.valueAreaLow).toBeDefined();
      expect(result.volume_profile.valueAreaHigh).toBeGreaterThanOrEqual(
        result.volume_profile.valueAreaLow
      );
    });

    it('should determine price position relative to value area', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.volume_profile.position).toBeDefined();
      expect(['above_value', 'below_value', 'in_value']).toContain(
        result.volume_profile.position
      );
    });

    it('should provide top volume levels', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.volume_profile.topLevels).toBeDefined();
      expect(result.volume_profile.topLevels).toBeInstanceOf(Array);
      expect(result.volume_profile.topLevels.length).toBeGreaterThan(0);
      
      result.volume_profile.topLevels.forEach(level => {
        expect(level.price).toBeDefined();
        expect(level.volume).toBeDefined();
        expect(level.trades).toBeDefined();
      });
    });
  });

  describe('Volume Spike Detection', () => {
    it('should detect volume spikes', async () => {
      // Add a volume spike
      const ohlcv = generateMockOHLCV(100, 50000);
      ohlcv[ohlcv.length - 1][5] = 5000; // 5x normal volume
      mockFetchOHLCV.mockResolvedValue(ohlcv);

      const result = await run({ userId, symbol, timeframe });

      expect(result.volume_spikes).toBeDefined();
      expect(result.volume_spikes.isSpike).toBe(true);
      expect(result.volume_spikes.volumeRatio).toBeGreaterThan(2);
    });

    it('should calculate volume metrics', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.volume_spikes.avgVolume).toBeGreaterThan(0);
      expect(result.volume_spikes.currentVolume).toBeGreaterThan(0);
      expect(result.volume_spikes.volumeRatio).toBeGreaterThan(0);
    });

    it('should track buying and selling pressure', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.volume_spikes.buyingPressure).toBeGreaterThanOrEqual(0);
      expect(result.volume_spikes.sellingPressure).toBeGreaterThanOrEqual(0);
    });

    it('should identify volume trend', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.volume_spikes.volumeTrend).toBeDefined();
      expect(['increasing', 'decreasing', 'stable']).toContain(
        result.volume_spikes.volumeTrend
      );
    });
  });

  describe('Trading Signals', () => {
    it('should generate comprehensive trading signals', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.trading_recommendation.signals).toBeInstanceOf(Array);
      expect(result.trading_recommendation.signals.length).toBeGreaterThan(0);
      
      result.trading_recommendation.signals.forEach(signal => {
        expect(signal.indicator).toBeDefined();
        expect(signal.signal).toBeDefined();
        expect(['BUY', 'SELL']).toContain(signal.signal);
        expect(signal.reason).toBeDefined();
        expect(signal.strength).toBeDefined();
      });
    });

    it('should provide signal summary', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.trading_recommendation.summary).toBeDefined();
      expect(result.trading_recommendation.summary.buySignals).toBeGreaterThanOrEqual(0);
      expect(result.trading_recommendation.summary.sellSignals).toBeGreaterThanOrEqual(0);
      expect(result.trading_recommendation.summary.totalSignals).toBeGreaterThan(0);
    });

    it('should generate BUY signal on strong bullish indicators', async () => {
      // Create strong uptrend with volume
      const ohlcv = generateMockOHLCV(100, 50000, 0.015);
      ohlcv[ohlcv.length - 1][5] = 3000; // High volume on up move
      mockFetchOHLCV.mockResolvedValue(ohlcv);

      const result = await run({ userId, symbol, timeframe });

      // Should have bullish bias
      expect(result.trading_recommendation.summary.buySignals).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', async () => {
      const config = defaultConfig();

      expect(config.enabled).toBe(true);
      expect(config.dataLimit).toBe(100);
      expect(config.profileBins).toBe(20);
      expect(config.spikeThreshold).toBe(2.0);
    });

    it('should accept custom configuration', async () => {
      const customConfig = {
        dataLimit: 200,
        profileBins: 30,
        spikeThreshold: 2.5,
        useCache: false
      };

      const result = await run({ userId, symbol, timeframe, config: customConfig });

      expect(mockFetchOHLCV).toHaveBeenCalledWith(
        userId,
        symbol,
        timeframe,
        200
      );
    });

    it('should support different timeframes', async () => {
      await run({ userId, symbol, timeframe: '4h' });
      expect(mockFetchOHLCV).toHaveBeenCalledWith(
        userId,
        symbol,
        '4h',
        expect.any(Number)
      );

      await run({ userId, symbol, timeframe: '1d' });
      expect(mockFetchOHLCV).toHaveBeenCalledWith(
        userId,
        symbol,
        '1d',
        expect.any(Number)
      );
    });
  });

  describe('Caching', () => {
    it('should cache analysis results', async () => {
      const result1 = await run({ userId, symbol, timeframe });
      const result2 = await run({ userId, symbol, timeframe });

      // Should only fetch once (second call uses cache)
      expect(mockFetchOHLCV).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should respect cache disable flag', async () => {
      await run({ userId, symbol, timeframe, config: { useCache: false } });
      await run({ userId, symbol, timeframe, config: { useCache: false } });

      // Should fetch twice when cache disabled
      expect(mockFetchOHLCV).toHaveBeenCalledTimes(2);
    });

    it('should clear cache correctly', async () => {
      await run({ userId, symbol, timeframe });
      
      clearCache();
      
      await run({ userId, symbol, timeframe });

      // Should fetch twice (once before clear, once after)
      expect(mockFetchOHLCV).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle MEXC initialization errors', async () => {
      mockInitializeExchange.mockRejectedValue(new Error('MEXC connection failed'));

      await expect(run({ userId, symbol, timeframe })).rejects.toThrow();
    });

    it('should handle insufficient data error', async () => {
      mockFetchOHLCV.mockResolvedValue(generateMockOHLCV(10, 50000)); // Too few candles

      await expect(run({ userId, symbol, timeframe })).rejects.toThrow('Insufficient');
    });

    it('should handle empty OHLCV data', async () => {
      mockFetchOHLCV.mockResolvedValue([]);

      await expect(run({ userId, symbol, timeframe })).rejects.toThrow();
    });

    it('should provide detailed error information', async () => {
      mockFetchOHLCV.mockRejectedValue(new Error('API rate limit'));

      try {
        await run({ userId, symbol, timeframe });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.code).toBe('VOLUME_ANALYSIS_ERROR');
        expect(error.message).toBeDefined();
        expect(error.symbol).toBe(symbol);
        expect(error.timeframe).toBe(timeframe);
      }
    });
  });

  describe('Summary Generation', () => {
    it('should generate human-readable summary', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(100);
      expect(result.summary).toContain(symbol);
    });

    it('should include all key metrics in summary', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.summary).toContain('OBV');
      expect(result.summary).toContain('VWAP');
      expect(result.summary).toContain('Volume Profile');
      expect(result.summary).toContain('POC');
      expect(result.summary).toContain('Value Area');
    });
  });

  describe('Performance', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();
      
      await run({ userId, symbol, timeframe });
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should track execution time', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.metadata.executionTime).toBeDefined();
      expect(result.metadata.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Agent Status', () => {
    it('should provide agent details', async () => {
      const details = await getDetails({ userId });

      expect(details.agent_key).toBe('volume');
      expect(details.name).toBeDefined();
      expect(details.description).toBeDefined();
      expect(details.status).toBe('active');
      expect(details.version).toBeDefined();
      expect(details.capabilities).toBeInstanceOf(Array);
      expect(details.capabilities.length).toBeGreaterThan(0);
    });

    it('should track agent metrics', async () => {
      await run({ userId, symbol, timeframe });
      await run({ userId, symbol: 'ETH/USDT', timeframe });

      const details = await getDetails({ userId });

      expect(details.metrics.totalRuns).toBe(2);
      expect(details.metrics.successfulRuns).toBe(2);
      expect(details.metrics.failedRuns).toBe(0);
      expect(details.metrics.avgExecutionTime).toBeGreaterThan(0);
      expect(details.metrics.successRate).toBe(100);
    });

    it('should describe all indicators', async () => {
      const details = await getDetails({ userId });

      expect(details.indicators).toBeDefined();
      expect(details.indicators.obv).toBeDefined();
      expect(details.indicators.vwap).toBeDefined();
      expect(details.indicators.volumeProfile).toBeDefined();
      expect(details.indicators.volumeSpikes).toBeDefined();
    });
  });

  describe('Metadata', () => {
    it('should include comprehensive metadata', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.dataPoints).toBeGreaterThan(0);
      expect(result.metadata.executionTime).toBeGreaterThan(0);
      expect(result.metadata.cacheKey).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.agent_version).toBe('1.0.0');
    });

    it('should include timestamp', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.timestamp).toBeDefined();
      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 10000); // Within last 10 seconds
    });
  });
});
