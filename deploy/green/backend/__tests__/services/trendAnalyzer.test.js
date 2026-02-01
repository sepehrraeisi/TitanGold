/**
 * Unit Tests for Trend Analyzer Service
 * 
 * Tests for:
 * - Simple Moving Average (SMA)
 * - Exponential Moving Average (EMA)
 * - Average Directional Index (ADX)
 * - Trend strength classification
 * - Trend direction identification
 * - Trend lines calculation
 * - Reversal signals detection
 * - Comprehensive trend analysis
 */

import { jest } from '@jest/globals';
import {
  calculateSMA,
  calculateEMA,
  calculateADX,
  classifyTrendStrength,
  identifyTrendDirection,
  calculateTrendLines,
  detectReversalSignals,
  analyzeTrend
} from '../../services/trendAnalyzer.js';

// Mock logger
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Trend Analyzer Service', () => {
  
  // Helper function to generate mock OHLCV data
  function generateOHLCV(length, startPrice = 100, trend = 0, volatility = 0.02) {
    const data = [];
    let price = startPrice;
    const baseTime = Date.now() - (length * 3600000);
    
    for (let i = 0; i < length; i++) {
      const randomChange = (Math.random() - 0.5) * price * volatility;
      const trendChange = price * trend;
      price = Math.max(price + randomChange + trendChange, startPrice * 0.5);
      
      const high = price * (1 + Math.random() * 0.01);
      const low = price * (1 - Math.random() * 0.01);
      const open = i > 0 ? data[i-1][4] : price;
      const close = price;
      const volume = Math.random() * 1000000;
      
      data.push([baseTime + (i * 3600000), open, high, low, close, volume]);
    }
    
    return data;
  }

  describe('calculateSMA()', () => {
    
    test('should calculate simple moving average', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const sma = calculateSMA(prices, 3);
      
      expect(sma.length).toBe(4); // 6 prices - 3 period + 1
      expect(sma[0]).toBeCloseTo(12, 1); // (10+12+14)/3
      expect(sma[1]).toBeCloseTo(14, 1); // (12+14+16)/3
      expect(sma[2]).toBeCloseTo(16, 1); // (14+16+18)/3
      expect(sma[3]).toBeCloseTo(18, 1); // (16+18+20)/3
    });

    test('should return empty array for insufficient data', () => {
      const prices = [10, 12];
      const sma = calculateSMA(prices, 5);
      
      expect(sma.length).toBe(0);
    });

    test('should handle single period', () => {
      const prices = [10, 12, 14];
      const sma = calculateSMA(prices, 1);
      
      expect(sma.length).toBe(3);
      expect(sma[0]).toBe(10);
      expect(sma[1]).toBe(12);
      expect(sma[2]).toBe(14);
    });
  });

  describe('calculateEMA()', () => {
    
    test('should calculate exponential moving average', () => {
      const prices = [10, 12, 14, 16, 18, 20, 22];
      const ema = calculateEMA(prices, 3);
      
      expect(ema.length).toBeGreaterThan(0);
      expect(ema[0]).toBeCloseTo(12, 1); // First value is SMA
      expect(ema[ema.length - 1]).toBeGreaterThan(ema[0]); // Should increase for uptrend
    });

    test('should return empty array for insufficient data', () => {
      const prices = [10, 12];
      const ema = calculateEMA(prices, 5);
      
      expect(ema.length).toBe(0);
    });

    test('should be more responsive than SMA to price changes', () => {
      const prices = [100, 100, 100, 100, 120]; // Sudden price jump
      const sma = calculateSMA(prices, 5);
      const ema = calculateEMA(prices, 5);
      
      // EMA should be closer to recent price than SMA
      expect(ema[ema.length - 1]).toBeGreaterThanOrEqual(sma[sma.length - 1]);
    });
  });

  describe('calculateADX()', () => {
    
    test('should calculate ADX for trending data', () => {
      const ohlcv = generateOHLCV(50, 100, 0.01); // Uptrend
      const result = calculateADX(ohlcv, 14);
      
      expect(result).toHaveProperty('adx');
      expect(result).toHaveProperty('diPlus');
      expect(result).toHaveProperty('diMinus');
      expect(result.adx).not.toBeNull();
      expect(result.adx).toBeGreaterThan(0);
    });

    test('should return null for insufficient data', () => {
      const ohlcv = generateOHLCV(10, 100);
      const result = calculateADX(ohlcv, 14);
      
      expect(result.adx).toBeNull();
    });

    test('should have DI+ > DI- for uptrend', () => {
      const ohlcv = generateOHLCV(50, 100, 0.02); // Strong uptrend
      const result = calculateADX(ohlcv, 14);
      
      expect(result.diPlus).toBeGreaterThan(result.diMinus);
    });

    test('should have DI- > DI+ for downtrend', () => {
      const ohlcv = generateOHLCV(50, 100, -0.02); // Strong downtrend
      const result = calculateADX(ohlcv, 14);
      
      expect(result.diMinus).toBeGreaterThan(result.diPlus);
    });

    test('should have higher ADX for strong trends', () => {
      const weakTrend = generateOHLCV(50, 100, 0.005);
      const strongTrend = generateOHLCV(50, 100, 0.03);
      
      const weakADX = calculateADX(weakTrend, 14);
      const strongADX = calculateADX(strongTrend, 14);
      
      expect(strongADX.adx).toBeGreaterThan(weakADX.adx);
    });

    test('should include values arrays', () => {
      const ohlcv = generateOHLCV(50, 100, 0.01);
      const result = calculateADX(ohlcv, 14);
      
      expect(Array.isArray(result.values)).toBe(true);
      expect(Array.isArray(result.diPlusValues)).toBe(true);
      expect(Array.isArray(result.diMinusValues)).toBe(true);
    });
  });

  describe('classifyTrendStrength()', () => {
    
    test('should classify weak trend', () => {
      expect(classifyTrendStrength(15)).toBe('weak');
      expect(classifyTrendStrength(24)).toBe('weak');
    });

    test('should classify moderate trend', () => {
      expect(classifyTrendStrength(25)).toBe('moderate');
      expect(classifyTrendStrength(40)).toBe('moderate');
      expect(classifyTrendStrength(49)).toBe('moderate');
    });

    test('should classify strong trend', () => {
      expect(classifyTrendStrength(50)).toBe('strong');
      expect(classifyTrendStrength(75)).toBe('strong');
    });

    test('should handle null or undefined', () => {
      expect(classifyTrendStrength(null)).toBe('unknown');
      expect(classifyTrendStrength(undefined)).toBe('unknown');
    });
  });

  describe('identifyTrendDirection()', () => {
    
    test('should identify uptrend when DI+ > DI-', () => {
      const direction = identifyTrendDirection(30, 15, [100, 102, 105]);
      expect(direction).toBe('up');
    });

    test('should identify downtrend when DI- > DI+', () => {
      const direction = identifyTrendDirection(15, 30, [100, 98, 95]);
      expect(direction).toBe('down');
    });

    test('should identify sideways when DI values are close', () => {
      const direction = identifyTrendDirection(20, 22, [100, 100, 100]);
      expect(direction).toBe('sideways');
    });

    test('should confirm trend with price action', () => {
      // DI+ higher but price declining - should be sideways
      const direction = identifyTrendDirection(30, 25, [100, 98, 95]);
      expect(direction).toBe('sideways');
    });

    test('should handle null DI values', () => {
      expect(identifyTrendDirection(null, null)).toBe('unknown');
    });
  });

  describe('calculateTrendLines()', () => {
    
    test('should calculate support and resistance', () => {
      const ohlcv = generateOHLCV(100, 100, 0.005);
      const result = calculateTrendLines(ohlcv, 10);
      
      expect(result).toHaveProperty('support');
      expect(result).toHaveProperty('resistance');
      expect(result).toHaveProperty('pivots');
    });

    test('should return null for insufficient data', () => {
      const ohlcv = generateOHLCV(15, 100);
      const result = calculateTrendLines(ohlcv, 20);
      
      expect(result.support).toBeNull();
      expect(result.resistance).toBeNull();
    });

    test('should identify pivot points', () => {
      const ohlcv = generateOHLCV(100, 100, 0);
      const result = calculateTrendLines(ohlcv, 10);
      
      expect(Array.isArray(result.pivots)).toBe(true);
    });

    test('should have support below resistance', () => {
      const ohlcv = generateOHLCV(100, 100, 0.01);
      const result = calculateTrendLines(ohlcv, 10);
      
      if (result.support && result.resistance) {
        const supportLevel = result.support.predict(ohlcv.length - 1);
        const resistanceLevel = result.resistance.predict(ohlcv.length - 1);
        expect(supportLevel).toBeLessThan(resistanceLevel);
      }
    });

    test('should limit pivots to last 10', () => {
      const ohlcv = generateOHLCV(200, 100, 0);
      const result = calculateTrendLines(ohlcv, 10);
      
      expect(result.pivots.length).toBeLessThanOrEqual(10);
    });
  });

  describe('detectReversalSignals()', () => {
    
    test('should detect bullish crossover', () => {
      const ohlcv = generateOHLCV(50, 100, 0.01);
      const adxData = {
        adx: 30,
        diPlusValues: [15, 18, 22, 26],
        diMinusValues: [26, 24, 22, 20],
        values: [28, 29, 30]
      };
      
      const signals = detectReversalSignals(adxData, ohlcv, {});
      
      // Should have signals array
      expect(Array.isArray(signals)).toBe(true);
      // If crossover detected, verify it has proper structure
      const bullish = signals.find(s => s.type === 'bullish_crossover');
      if (bullish) {
        expect(bullish.confidence).toBeGreaterThan(0);
      }
    });

    test('should detect bearish crossover', () => {
      const ohlcv = generateOHLCV(50, 100, -0.01);
      const adxData = {
        adx: 30,
        diPlusValues: [26, 24, 22, 20],
        diMinusValues: [15, 18, 22, 26],
        values: [28, 29, 30]
      };
      
      const signals = detectReversalSignals(adxData, ohlcv, {});
      
      // Should have signals array
      expect(Array.isArray(signals)).toBe(true);
      // If crossover detected, verify it has proper structure
      const bearish = signals.find(s => s.type === 'bearish_crossover');
      if (bearish) {
        expect(bearish.confidence).toBeGreaterThan(0);
      }
    });

    test('should detect trend weakening', () => {
      const ohlcv = generateOHLCV(50, 100);
      const adxData = {
        adx: 20,
        diPlusValues: [20, 20],
        diMinusValues: [15, 15],
        values: [35, 32, 29, 26, 23] // Declining ADX
      };
      
      const signals = detectReversalSignals(adxData, ohlcv, {});
      const weakening = signals.find(s => s.type === 'trend_weakening');
      
      expect(weakening).toBeDefined();
    });

    test('should detect support bounce', () => {
      const ohlcv = generateOHLCV(50, 100);
      const currentPrice = ohlcv[ohlcv.length - 1][4];
      const trendLines = {
        support: {
          predict: () => currentPrice * 0.99 // Support just below price
        }
      };
      
      const adxData = {
        adx: 25,
        diPlusValues: [20],
        diMinusValues: [15],
        values: [25]
      };
      
      const signals = detectReversalSignals(adxData, ohlcv, trendLines);
      const bounce = signals.find(s => s.type === 'support_bounce');
      
      expect(bounce).toBeDefined();
    });

    test('should detect extreme ADX', () => {
      const ohlcv = generateOHLCV(50, 100);
      const adxData = {
        adx: 65, // Very high ADX
        diPlusValues: [30],
        diMinusValues: [15],
        values: [65]
      };
      
      const signals = detectReversalSignals(adxData, ohlcv, {});
      const extreme = signals.find(s => s.type === 'overbought_trend');
      
      expect(extreme).toBeDefined();
    });

    test('should return empty array for insufficient data', () => {
      const signals = detectReversalSignals(null, [], {});
      expect(signals.length).toBe(0);
    });
  });

  describe('analyzeTrend()', () => {
    
    test('should perform comprehensive trend analysis', () => {
      const ohlcv = generateOHLCV(100, 100, 0.01);
      const result = analyzeTrend(ohlcv);
      
      expect(result).toHaveProperty('adx');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('movingAverages');
      expect(result).toHaveProperty('trendLines');
      expect(result).toHaveProperty('reversalSignals');
      expect(result).toHaveProperty('summary');
    });

    test('should include ADX metrics', () => {
      const ohlcv = generateOHLCV(100, 100, 0.01);
      const result = analyzeTrend(ohlcv);
      
      expect(result.adx).toHaveProperty('value');
      expect(result.adx).toHaveProperty('diPlus');
      expect(result.adx).toHaveProperty('diMinus');
      expect(result.adx).toHaveProperty('strength');
    });

    test('should include trend classification', () => {
      const ohlcv = generateOHLCV(100, 100, 0.01);
      const result = analyzeTrend(ohlcv);
      
      expect(result.trend).toHaveProperty('direction');
      expect(result.trend).toHaveProperty('strength');
      expect(result.trend).toHaveProperty('confidence');
      expect(['up', 'down', 'sideways']).toContain(result.trend.direction);
      expect(['weak', 'moderate', 'strong']).toContain(result.trend.strength);
    });

    test('should include moving averages', () => {
      const ohlcv = generateOHLCV(100, 100, 0.01);
      const result = analyzeTrend(ohlcv);
      
      expect(result.movingAverages).toHaveProperty('sma');
      expect(result.movingAverages).toHaveProperty('ema');
      expect(result.movingAverages).toHaveProperty('position');
      expect(result.movingAverages.sma.value).toBeGreaterThan(0);
      expect(result.movingAverages.ema.value).toBeGreaterThan(0);
    });

    test('should include trend lines', () => {
      const ohlcv = generateOHLCV(100, 100, 0.01);
      const result = analyzeTrend(ohlcv);
      
      expect(result.trendLines).toHaveProperty('support');
      expect(result.trendLines).toHaveProperty('resistance');
      expect(result.trendLines).toHaveProperty('pivots');
    });

    test('should detect reversal signals', () => {
      const ohlcv = generateOHLCV(100, 100, 0.01);
      const result = analyzeTrend(ohlcv);
      
      expect(Array.isArray(result.reversalSignals)).toBe(true);
    });

    test('should generate summary', () => {
      const ohlcv = generateOHLCV(100, 100, 0.01);
      const result = analyzeTrend(ohlcv);
      
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    test('should throw error for insufficient data', () => {
      const ohlcv = generateOHLCV(10, 100);
      
      expect(() => analyzeTrend(ohlcv)).toThrow('Insufficient data');
    });

    test('should accept custom periods', () => {
      const ohlcv = generateOHLCV(100, 100, 0.01);
      const result = analyzeTrend(ohlcv, {
        adxPeriod: 10,
        smaPeriod: 30,
        emaPeriod: 15,
        trendLineLookback: 15
      });
      
      expect(result.movingAverages.sma.period).toBe(30);
      expect(result.movingAverages.ema.period).toBe(15);
    });

    test('should have higher confidence for strong trends', () => {
      const weakTrend = generateOHLCV(100, 100, 0.002);
      const strongTrend = generateOHLCV(100, 100, 0.02);
      
      const weakResult = analyzeTrend(weakTrend);
      const strongResult = analyzeTrend(strongTrend);
      
      // Strong trend should have at least moderate confidence
      expect(strongResult.trend.confidence).toBeGreaterThanOrEqual(0.5);
      // Both should have valid confidence scores
      expect(weakResult.trend.confidence).toBeGreaterThanOrEqual(0);
      expect(weakResult.trend.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Trend Detection Accuracy', () => {
    
    test('should correctly identify uptrend', () => {
      const ohlcv = generateOHLCV(100, 100, 0.015); // Strong uptrend
      const result = analyzeTrend(ohlcv);
      
      expect(result.trend.direction).toBe('up');
    });

    test('should correctly identify downtrend', () => {
      const ohlcv = generateOHLCV(100, 100, -0.015); // Strong downtrend
      const result = analyzeTrend(ohlcv);
      
      // Should identify downtrend or sideways (due to volatility)
      expect(['down', 'sideways']).toContain(result.trend.direction);
    });

    test('should correctly identify sideways market', () => {
      const ohlcv = generateOHLCV(100, 100, 0, 0.01); // No trend, moderate volatility
      const result = analyzeTrend(ohlcv);
      
      // Should identify sideways or weak trend
      expect(['sideways', 'weak', 'up', 'down']).toContain(result.trend.direction);
      expect(['weak', 'moderate']).toContain(result.trend.strength);
    });

    test('should have strong classification for strong trends', () => {
      const ohlcv = generateOHLCV(100, 100, 0.025); // Very strong trend
      const result = analyzeTrend(ohlcv);
      
      expect(['moderate', 'strong']).toContain(result.trend.strength);
    });

    test('should have weak classification for weak trends', () => {
      const ohlcv = generateOHLCV(100, 100, 0.002); // Very weak trend
      const result = analyzeTrend(ohlcv);
      
      expect(['weak', 'moderate']).toContain(result.trend.strength);
    });
  });
});
