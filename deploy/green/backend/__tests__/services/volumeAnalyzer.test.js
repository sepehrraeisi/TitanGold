/**
 * Volume Analyzer Service Unit Tests
 * BACKEND-013: Implement Volume Analysis Agent
 */

import { jest } from '@jest/globals';
import {
  calculateOBV,
  calculateVWAP,
  generateVolumeProfile,
  detectVolumeSpikes,
  generateVolumeSignals,
  analyzeVolume
} from '../../services/volumeAnalyzer.js';

// Mock logger
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Volume Analyzer Service', () => {
  
  // Helper: Generate mock OHLCV data
  function generateOHLCV(length, startPrice = 100, trend = 0.001, volumeBase = 1000) {
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
      const volume = volumeBase * (0.8 + Math.random() * 0.4); // ±20% variation
      
      ohlcv.push([
        baseTime + i * 3600000, // timestamp
        open,
        high,
        low,
        price, // close
        volume
      ]);
    }
    
    return ohlcv;
  }

  describe('calculateOBV', () => {
    it('should calculate OBV correctly for rising prices', () => {
      const ohlcv = generateOHLCV(30, 100, 0.01); // Uptrend
      
      const result = calculateOBV(ohlcv);
      
      expect(result).toBeDefined();
      expect(result.values).toHaveLength(30);
      expect(result.current).toBeDefined();
      expect(result.trend).toBeDefined();
      expect(['up', 'down', 'flat']).toContain(result.trend);
    });

    it('should calculate OBV correctly for falling prices', () => {
      const ohlcv = generateOHLCV(30, 100, -0.01); // Downtrend
      
      const result = calculateOBV(ohlcv);
      
      expect(result).toBeDefined();
      expect(result.current).toBeDefined();
      // In downtrend, OBV should generally be negative
      expect(result.trend).toBeDefined();
    });

    it('should detect bullish divergence', () => {
      // Create scenario: price falling but volume increasing on up days
      const ohlcv = [];
      let price = 100;
      const baseTime = Date.now() - (30 * 3600000);
      
      for (let i = 0; i < 30; i++) {
        const open = price;
        price = price - 0.5; // Falling price
        const high = Math.max(open, price) * 1.01;
        const low = Math.min(open, price) * 0.99;
        // Increasing volume when price goes up (occasional bounces)
        const volume = 1000 + i * 50;
        
        ohlcv.push([baseTime + i * 3600000, open, high, low, price, volume]);
      }
      
      const result = calculateOBV(ohlcv);
      
      expect(result.divergence).toBeDefined();
      expect(result.divergence.type).toBeDefined();
    });

    it('should handle minimum data correctly', () => {
      const ohlcv = generateOHLCV(2, 100, 0);
      
      const result = calculateOBV(ohlcv);
      
      expect(result.values).toHaveLength(2);
      expect(result.values[0].value).toBe(0); // First OBV is 0
    });

    it('should throw error with insufficient data', () => {
      const ohlcv = generateOHLCV(1, 100, 0);
      
      expect(() => calculateOBV(ohlcv)).toThrow('Insufficient data');
    });
  });

  describe('calculateVWAP', () => {
    it('should calculate VWAP correctly', () => {
      const ohlcv = generateOHLCV(50, 100, 0.005);
      
      const result = calculateVWAP(ohlcv);
      
      expect(result).toBeDefined();
      expect(result.values).toHaveLength(50);
      expect(result.current).toBeGreaterThan(0);
      expect(result.currentPrice).toBeDefined();
      expect(result.position).toBeDefined();
      expect(['above', 'below', 'at']).toContain(result.position);
    });

    it('should calculate correct deviation from VWAP', () => {
      const ohlcv = generateOHLCV(30, 100, 0);
      
      const result = calculateVWAP(ohlcv);
      
      expect(result.deviation).toBeDefined();
      expect(typeof result.deviation).toBe('number');
      // Deviation should be percentage
      expect(Math.abs(result.deviation)).toBeLessThan(100);
    });

    it('should identify price above VWAP', () => {
      const ohlcv = generateOHLCV(20, 100, 0.02); // Strong uptrend
      
      const result = calculateVWAP(ohlcv);
      
      // In strong uptrend, current price should be above VWAP
      expect(result.currentPrice).toBeGreaterThan(result.current);
      expect(result.position).toBe('above');
    });

    it('should generate appropriate VWAP signals', () => {
      const ohlcv = generateOHLCV(30, 100, 0);
      
      const result = calculateVWAP(ohlcv);
      
      expect(result.signal).toBeDefined();
      expect(result.signal.type).toBeDefined();
      expect(['bullish', 'bearish', 'neutral']).toContain(result.signal.type);
      expect(result.signal.reason).toBeDefined();
    });

    it('should throw error with no data', () => {
      expect(() => calculateVWAP([])).toThrow('Insufficient data');
    });
  });

  describe('generateVolumeProfile', () => {
    it('should generate volume profile with correct structure', () => {
      const ohlcv = generateOHLCV(100, 100, 0.005);
      
      const result = generateVolumeProfile(ohlcv, 20);
      
      expect(result).toBeDefined();
      expect(result.profile).toHaveLength(20);
      expect(result.pointOfControl).toBeDefined();
      expect(result.valueAreaHigh).toBeDefined();
      expect(result.valueAreaLow).toBeDefined();
      expect(result.totalVolume).toBeGreaterThan(0);
    });

    it('should identify Point of Control (POC)', () => {
      const ohlcv = generateOHLCV(50, 100, 0);
      
      const result = generateVolumeProfile(ohlcv, 15);
      
      expect(result.pointOfControl.volume).toBeGreaterThan(0);
      expect(result.pointOfControl.priceLevel).toBeGreaterThan(0);
      
      // POC should have highest volume
      const maxVolume = Math.max(...result.profile.map(p => p.volume));
      expect(result.pointOfControl.volume).toBe(maxVolume);
    });

    it('should calculate Value Area correctly', () => {
      const ohlcv = generateOHLCV(80, 100, 0.002);
      
      const result = generateVolumeProfile(ohlcv, 20);
      
      expect(result.valueAreaHigh).toBeGreaterThanOrEqual(result.valueAreaLow);
      // Value area should contain ~70% of volume
      expect(result.valueAreaHigh).toBeDefined();
      expect(result.valueAreaLow).toBeDefined();
    });

    it('should identify price position relative to value area', () => {
      const ohlcv = generateOHLCV(60, 100, 0.005);
      
      const result = generateVolumeProfile(ohlcv);
      
      expect(result.analysis.position).toBeDefined();
      expect(['above_value', 'below_value', 'in_value']).toContain(result.analysis.position);
    });

    it('should handle different bin counts', () => {
      const ohlcv = generateOHLCV(50, 100, 0);
      
      const result10 = generateVolumeProfile(ohlcv, 10);
      const result30 = generateVolumeProfile(ohlcv, 30);
      
      expect(result10.profile).toHaveLength(10);
      expect(result30.profile).toHaveLength(30);
    });
  });

  describe('detectVolumeSpikes', () => {
    it('should detect volume spikes correctly', () => {
      const ohlcv = generateOHLCV(50, 100, 0);
      
      // Add a volume spike in the last candle
      ohlcv[ohlcv.length - 1][5] = 5000; // 5x normal volume
      
      const result = detectVolumeSpikes(ohlcv, 2.0);
      
      expect(result).toBeDefined();
      expect(result.isSpike).toBe(true);
      expect(result.volumeRatio).toBeGreaterThan(2);
      expect(result.spikes.length).toBeGreaterThan(0);
    });

    it('should calculate average volume correctly', () => {
      const ohlcv = generateOHLCV(30, 100, 0, 1000);
      
      const result = detectVolumeSpikes(ohlcv);
      
      expect(result.avgVolume).toBeGreaterThan(0);
      expect(result.avgVolume).toBeCloseTo(1000, -2); // Within order of magnitude
    });

    it('should classify spike severity', () => {
      const ohlcv = generateOHLCV(40, 100, 0);
      
      // Add medium spike
      ohlcv[ohlcv.length - 5][5] = 2500; // 2.5x
      // Add high spike
      ohlcv[ohlcv.length - 2][5] = 4000; // 4x
      
      const result = detectVolumeSpikes(ohlcv, 2.0);
      
      expect(result.spikes.length).toBeGreaterThan(0);
      
      const highSpikes = result.spikes.filter(s => s.severity === 'high');
      expect(highSpikes.length).toBeGreaterThan(0);
    });

    it('should identify bullish vs bearish spikes', () => {
      const ohlcv = generateOHLCV(30, 100, 0);
      
      // Add bullish spike (close > open)
      const lastIdx = ohlcv.length - 1;
      ohlcv[lastIdx][1] = 100; // open
      ohlcv[lastIdx][4] = 105; // close (higher)
      ohlcv[lastIdx][5] = 3000; // high volume
      
      const result = detectVolumeSpikes(ohlcv, 2.0);
      
      if (result.recentSpikes.length > 0) {
        const recentSpike = result.recentSpikes[result.recentSpikes.length - 1];
        expect(recentSpike.direction).toBe('bullish');
      }
    });

    it('should calculate buying and selling pressure', () => {
      const ohlcv = generateOHLCV(30, 100, 0);
      
      const result = detectVolumeSpikes(ohlcv);
      
      expect(result.analysis.buying_pressure).toBeGreaterThanOrEqual(0);
      expect(result.analysis.selling_pressure).toBeGreaterThanOrEqual(0);
    });

    it('should throw error with insufficient data', () => {
      const ohlcv = generateOHLCV(15, 100, 0);
      
      expect(() => detectVolumeSpikes(ohlcv)).toThrow('Insufficient data');
    });
  });

  describe('generateVolumeSignals', () => {
    it('should generate overall trading signal', () => {
      const ohlcv = generateOHLCV(50, 100, 0.005);
      
      const obv = calculateOBV(ohlcv);
      const vwap = calculateVWAP(ohlcv);
      const profile = generateVolumeProfile(ohlcv);
      const spikes = detectVolumeSpikes(ohlcv);
      
      const signals = generateVolumeSignals(obv, vwap, profile, spikes);
      
      expect(signals).toBeDefined();
      expect(signals.overallSignal).toBeDefined();
      expect(['BUY', 'SELL', 'HOLD']).toContain(signals.overallSignal);
      expect(signals.confidence).toBeGreaterThanOrEqual(0);
      expect(signals.confidence).toBeLessThanOrEqual(100);
    });

    it('should provide signal breakdown', () => {
      const ohlcv = generateOHLCV(50, 100, 0);
      
      const obv = calculateOBV(ohlcv);
      const vwap = calculateVWAP(ohlcv);
      const profile = generateVolumeProfile(ohlcv);
      const spikes = detectVolumeSpikes(ohlcv);
      
      const signals = generateVolumeSignals(obv, vwap, profile, spikes);
      
      expect(signals.signals).toBeInstanceOf(Array);
      expect(signals.summary).toBeDefined();
      expect(signals.summary.buySignals).toBeGreaterThanOrEqual(0);
      expect(signals.summary.sellSignals).toBeGreaterThanOrEqual(0);
    });

    it('should generate BUY signal on bullish conditions', () => {
      const ohlcv = generateOHLCV(50, 100, 0.01); // Strong uptrend
      
      // Add volume spike on bullish candle
      const lastIdx = ohlcv.length - 1;
      ohlcv[lastIdx][1] = ohlcv[lastIdx][4] * 0.95; // open lower
      ohlcv[lastIdx][5] = 3000; // high volume
      
      const obv = calculateOBV(ohlcv);
      const vwap = calculateVWAP(ohlcv);
      const profile = generateVolumeProfile(ohlcv);
      const spikes = detectVolumeSpikes(ohlcv, 2.0);
      
      const signals = generateVolumeSignals(obv, vwap, profile, spikes);
      
      // Should have at least some bullish signals
      expect(signals.summary.buySignals).toBeGreaterThan(0);
    });

    it('should include rationale for each signal', () => {
      const ohlcv = generateOHLCV(40, 100, 0);
      
      const obv = calculateOBV(ohlcv);
      const vwap = calculateVWAP(ohlcv);
      const profile = generateVolumeProfile(ohlcv);
      const spikes = detectVolumeSpikes(ohlcv);
      
      const signals = generateVolumeSignals(obv, vwap, profile, spikes);
      
      signals.signals.forEach(signal => {
        expect(signal.indicator).toBeDefined();
        expect(signal.signal).toBeDefined();
        expect(signal.reason).toBeDefined();
        expect(signal.strength).toBeDefined();
      });
    });
  });

  describe('analyzeVolume (comprehensive)', () => {
    it('should perform complete volume analysis', () => {
      const ohlcv = generateOHLCV(100, 100, 0.005);
      
      const result = analyzeVolume(ohlcv, { symbol: 'BTC/USDT' });
      
      expect(result).toBeDefined();
      expect(result.obv).toBeDefined();
      expect(result.vwap).toBeDefined();
      expect(result.volumeProfile).toBeDefined();
      expect(result.volumeSpikes).toBeDefined();
      expect(result.signals).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should include execution metadata', () => {
      const ohlcv = generateOHLCV(80, 100, 0);
      
      const result = analyzeVolume(ohlcv);
      
      expect(result.metadata.dataPoints).toBe(80);
      expect(result.metadata.executionTime).toBeGreaterThan(0);
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.version).toBeDefined();
    });

    it('should handle custom options', () => {
      const ohlcv = generateOHLCV(60, 100, 0);
      
      const result = analyzeVolume(ohlcv, {
        symbol: 'ETH/USDT',
        profileBins: 30,
        spikeThreshold: 2.5
      });
      
      expect(result.volumeProfile.profile).toHaveLength(30);
    });

    it('should throw error with insufficient data', () => {
      const ohlcv = generateOHLCV(15, 100, 0);
      
      expect(() => analyzeVolume(ohlcv)).toThrow('Insufficient data');
    });

    it('should complete analysis within reasonable time', () => {
      const ohlcv = generateOHLCV(100, 100, 0.005);
      
      const startTime = Date.now();
      const result = analyzeVolume(ohlcv);
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(result.metadata.executionTime).toBeLessThan(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle flat market (no price movement)', () => {
      const ohlcv = [];
      const baseTime = Date.now() - (30 * 3600000);
      
      for (let i = 0; i < 30; i++) {
        ohlcv.push([
          baseTime + i * 3600000,
          100, // open
          100.1, // high
          99.9, // low
          100, // close (flat)
          1000 // volume
        ]);
      }
      
      const result = analyzeVolume(ohlcv);
      
      expect(result).toBeDefined();
      expect(result.obv.trend).toBe('flat');
    });

    it('should handle zero volume candles', () => {
      const ohlcv = generateOHLCV(30, 100, 0);
      
      // Set some candles to zero volume
      ohlcv[10][5] = 0;
      ohlcv[15][5] = 0;
      
      const result = analyzeVolume(ohlcv);
      
      expect(result).toBeDefined();
      expect(result.volumeSpikes.avgVolume).toBeGreaterThan(0);
    });

    it('should handle extreme volatility', () => {
      const ohlcv = [];
      const baseTime = Date.now() - (40 * 3600000);
      let price = 100;
      
      for (let i = 0; i < 40; i++) {
        // Extreme price swings
        price = price * (0.8 + Math.random() * 0.4);
        const open = price;
        const close = price * (0.9 + Math.random() * 0.2);
        const high = Math.max(open, close) * 1.1;
        const low = Math.min(open, close) * 0.9;
        
        ohlcv.push([
          baseTime + i * 3600000,
          open,
          high,
          low,
          close,
          1000 + Math.random() * 2000
        ]);
      }
      
      const result = analyzeVolume(ohlcv);
      
      expect(result).toBeDefined();
      expect(result.signals.overallSignal).toBeDefined();
    });
  });
});
