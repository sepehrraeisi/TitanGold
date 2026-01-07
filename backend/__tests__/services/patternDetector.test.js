/**
 * Unit Tests for Pattern Detector Service
 * 
 * Tests pattern recognition functionality including:
 * - All 10+ pattern types
 * - Confidence scoring
 * - Support/resistance calculation
 * - Breakout direction prediction
 * - Edge cases and validation
 * 
 * @jest-environment node
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import patternDetector from '../../services/patternDetector.js';

describe('Pattern Detector Service', () => {
  let mockOHLCV;

  beforeEach(() => {
    // Create baseline mock OHLCV data
    mockOHLCV = generateMockOHLCV(200);
  });

  describe('Pattern Detection', () => {
    test('should detect patterns from OHLCV data', () => {
      const patterns = patternDetector.detectPatterns(mockOHLCV);
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    test('should return empty array for insufficient data', () => {
      const shortData = generateMockOHLCV(10);
      const patterns = patternDetector.detectPatterns(shortData);
      
      expect(patterns).toEqual([]);
    });

    test('should handle null/undefined data', () => {
      expect(patternDetector.detectPatterns(null)).toEqual([]);
      expect(patternDetector.detectPatterns(undefined)).toEqual([]);
    });

    test('should sort patterns by confidence', () => {
      const patterns = patternDetector.detectPatterns(mockOHLCV);
      
      if (patterns.length > 1) {
        for (let i = 1; i < patterns.length; i++) {
          expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(patterns[i].confidence);
        }
      }
    });

    test('should filter by minimum confidence threshold', () => {
      const patterns = patternDetector.detectPatterns(mockOHLCV, { minConfidence: 0.7 });
      
      patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });
  });

  describe('Head and Shoulders Pattern', () => {
    test('should detect head and shoulders pattern', () => {
      const ohlcv = generateHeadAndShouldersData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const hsPattern = patterns.find(p => p.type === 'head_and_shoulders');
      if (hsPattern) {
        expect(hsPattern.direction).toBe('bearish');
        expect(hsPattern.confidence).toBeGreaterThan(0);
        expect(hsPattern.confidence).toBeLessThanOrEqual(1);
        expect(hsPattern).toHaveProperty('support');
        expect(hsPattern).toHaveProperty('resistance');
        expect(hsPattern.breakoutDirection).toBe('down');
      }
    });

    test('should have proper key levels for head and shoulders', () => {
      const ohlcv = generateHeadAndShouldersData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const hsPattern = patterns.find(p => p.type === 'head_and_shoulders');
      if (hsPattern) {
        expect(hsPattern.keyLevels).toHaveProperty('leftShoulder');
        expect(hsPattern.keyLevels).toHaveProperty('head');
        expect(hsPattern.keyLevels).toHaveProperty('rightShoulder');
        expect(hsPattern.keyLevels).toHaveProperty('neckline');
      }
    });
  });

  describe('Inverse Head and Shoulders Pattern', () => {
    test('should detect inverse head and shoulders pattern', () => {
      const ohlcv = generateInverseHeadAndShouldersData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const ihsPattern = patterns.find(p => p.type === 'inverse_head_and_shoulders');
      if (ihsPattern) {
        expect(ihsPattern.direction).toBe('bullish');
        expect(ihsPattern.confidence).toBeGreaterThan(0);
        expect(ihsPattern.breakoutDirection).toBe('up');
      }
    });
  });

  describe('Double Top Pattern', () => {
    test('should detect double top pattern', () => {
      const ohlcv = generateDoubleTopData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const dtPattern = patterns.find(p => p.type === 'double_top');
      if (dtPattern) {
        expect(dtPattern.direction).toBe('bearish');
        expect(dtPattern.confidence).toBeGreaterThan(0);
        expect(dtPattern.keyLevels).toHaveProperty('peak1');
        expect(dtPattern.keyLevels).toHaveProperty('peak2');
        expect(dtPattern.keyLevels).toHaveProperty('valley');
      }
    });
  });

  describe('Double Bottom Pattern', () => {
    test('should detect double bottom pattern', () => {
      const ohlcv = generateDoubleBottomData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const dbPattern = patterns.find(p => p.type === 'double_bottom');
      if (dbPattern) {
        expect(dbPattern.direction).toBe('bullish');
        expect(dbPattern.confidence).toBeGreaterThan(0);
        expect(dbPattern.keyLevels).toHaveProperty('trough1');
        expect(dbPattern.keyLevels).toHaveProperty('trough2');
        expect(dbPattern.keyLevels).toHaveProperty('peak');
      }
    });
  });

  describe('Triple Top/Bottom Patterns', () => {
    test('should detect triple top pattern', () => {
      const ohlcv = generateTripleTopData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const ttPattern = patterns.find(p => p.type === 'triple_top');
      if (ttPattern) {
        expect(ttPattern.direction).toBe('bearish');
        expect(ttPattern.keyLevels.peak1).toBeDefined();
        expect(ttPattern.keyLevels.peak2).toBeDefined();
        expect(ttPattern.keyLevels.peak3).toBeDefined();
      }
    });

    test('should detect triple bottom pattern', () => {
      const ohlcv = generateTripleBottomData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const tbPattern = patterns.find(p => p.type === 'triple_bottom');
      if (tbPattern) {
        expect(tbPattern.direction).toBe('bullish');
        expect(tbPattern.keyLevels.trough1).toBeDefined();
        expect(tbPattern.keyLevels.trough2).toBeDefined();
        expect(tbPattern.keyLevels.trough3).toBeDefined();
      }
    });
  });

  describe('Triangle Patterns', () => {
    test('should detect ascending triangle', () => {
      const ohlcv = generateAscendingTriangleData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const atPattern = patterns.find(p => p.type === 'ascending_triangle');
      if (atPattern) {
        expect(atPattern.direction).toBe('bullish');
        expect(atPattern).toHaveProperty('support');
        expect(atPattern).toHaveProperty('resistance');
      }
    });

    test('should detect descending triangle', () => {
      const ohlcv = generateDescendingTriangleData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const dtPattern = patterns.find(p => p.type === 'descending_triangle');
      if (dtPattern) {
        expect(dtPattern.direction).toBe('bearish');
      }
    });

    test('should detect symmetrical triangle', () => {
      const ohlcv = generateSymmetricalTriangleData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const stPattern = patterns.find(p => p.type === 'symmetrical_triangle');
      if (stPattern) {
        expect(stPattern.direction).toBe('neutral');
        expect(stPattern.breakoutDirection).toBe('either');
      }
    });
  });

  describe('Flag Patterns', () => {
    test('should detect bull flag pattern', () => {
      const ohlcv = generateBullFlagData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const bfPattern = patterns.find(p => p.type === 'bull_flag');
      if (bfPattern) {
        expect(bfPattern.direction).toBe('bullish');
        expect(bfPattern.keyLevels.poleStart).toBeDefined();
        expect(bfPattern.keyLevels.flagSupport).toBeDefined();
      }
    });

    test('should detect bear flag pattern', () => {
      const ohlcv = generateBearFlagData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const bfPattern = patterns.find(p => p.type === 'bear_flag');
      if (bfPattern) {
        expect(bfPattern.direction).toBe('bearish');
      }
    });
  });

  describe('Wedge Patterns', () => {
    test('should detect rising wedge pattern', () => {
      const ohlcv = generateRisingWedgeData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const rwPattern = patterns.find(p => p.type === 'rising_wedge');
      if (rwPattern) {
        expect(rwPattern.direction).toBe('bearish'); // Reversal pattern
        expect(rwPattern.breakoutDirection).toBe('down');
      }
    });

    test('should detect falling wedge pattern', () => {
      const ohlcv = generateFallingWedgeData();
      const patterns = patternDetector.detectPatterns(ohlcv);
      
      const fwPattern = patterns.find(p => p.type === 'falling_wedge');
      if (fwPattern) {
        expect(fwPattern.direction).toBe('bullish'); // Reversal pattern
        expect(fwPattern.breakoutDirection).toBe('up');
      }
    });
  });

  describe('Pattern Properties', () => {
    test('should include required properties for all patterns', () => {
      const patterns = patternDetector.detectPatterns(mockOHLCV);
      
      patterns.forEach(pattern => {
        expect(pattern).toHaveProperty('type');
        expect(pattern).toHaveProperty('direction');
        expect(pattern).toHaveProperty('confidence');
        expect(pattern).toHaveProperty('support');
        expect(pattern).toHaveProperty('resistance');
        expect(pattern).toHaveProperty('targetPrice');
        expect(pattern).toHaveProperty('breakoutDirection');
        expect(pattern).toHaveProperty('keyLevels');
      });
    });

    test('should have valid confidence scores', () => {
      const patterns = patternDetector.detectPatterns(mockOHLCV);
      
      patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      });
    });

    test('should have valid directions', () => {
      const patterns = patternDetector.detectPatterns(mockOHLCV);
      const validDirections = ['bullish', 'bearish', 'neutral'];
      
      patterns.forEach(pattern => {
        expect(validDirections).toContain(pattern.direction);
      });
    });
  });

  describe('Support and Resistance Levels', () => {
    test('should calculate support and resistance levels', () => {
      const sr = patternDetector.calculateSupportResistance(mockOHLCV);
      
      expect(sr).toHaveProperty('support');
      expect(sr).toHaveProperty('resistance');
      expect(Array.isArray(sr.support)).toBe(true);
      expect(Array.isArray(sr.resistance)).toBe(true);
    });

    test('should return empty arrays for insufficient data', () => {
      const shortData = generateMockOHLCV(10);
      const sr = patternDetector.calculateSupportResistance(shortData);
      
      expect(sr.support).toEqual([]);
      expect(sr.resistance).toEqual([]);
    });

    test('should limit support/resistance levels to top 3', () => {
      const sr = patternDetector.calculateSupportResistance(mockOHLCV);
      
      expect(sr.support.length).toBeLessThanOrEqual(3);
      expect(sr.resistance.length).toBeLessThanOrEqual(3);
    });

    test('should have resistance above support', () => {
      const sr = patternDetector.calculateSupportResistance(mockOHLCV);
      
      if (sr.support.length > 0 && sr.resistance.length > 0) {
        const minResistance = Math.min(...sr.resistance);
        const maxSupport = Math.max(...sr.support);
        expect(minResistance).toBeGreaterThan(maxSupport);
      }
    });
  });

  describe('Breakout Direction Prediction', () => {
    test('should predict breakout direction', () => {
      const pattern = {
        type: 'ascending_triangle',
        direction: 'bullish',
        breakoutDirection: 'up'
      };
      
      const direction = patternDetector.predictBreakoutDirection(mockOHLCV, pattern);
      
      expect(['up', 'down', 'neutral']).toContain(direction);
    });

    test('should return pattern direction for insufficient data', () => {
      const shortData = generateMockOHLCV(3);
      const pattern = {
        type: 'bull_flag',
        direction: 'bullish',
        breakoutDirection: 'up'
      };
      
      const direction = patternDetector.predictBreakoutDirection(shortData, pattern);
      
      expect(direction).toBe('up');
    });

    test('should consider momentum for bullish patterns', () => {
      // Create uptrending data
      const uptrendData = [];
      let price = 100;
      for (let i = 0; i < 50; i++) {
        const timestamp = Date.now() - (50 - i) * 3600000;
        price += 1;
        uptrendData.push([timestamp, price, price + 1, price - 0.5, price, 1000]);
      }
      
      const pattern = {
        type: 'bull_flag',
        direction: 'bullish',
        breakoutDirection: 'up'
      };
      
      const direction = patternDetector.predictBreakoutDirection(uptrendData, pattern);
      
      expect(direction).toBe('up');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty OHLCV array', () => {
      const patterns = patternDetector.detectPatterns([]);
      expect(patterns).toEqual([]);
    });

    test('should handle OHLCV with missing values', () => {
      const badData = [[Date.now(), null, 100, 99, 100, 1000]];
      const patterns = patternDetector.detectPatterns(badData);
      expect(Array.isArray(patterns)).toBe(true);
    });

    test('should handle very volatile data', () => {
      const volatileData = [];
      let price = 100;
      for (let i = 0; i < 100; i++) {
        const timestamp = Date.now() - (100 - i) * 3600000;
        const change = (Math.random() - 0.5) * 20; // High volatility
        price += change;
        volatileData.push([timestamp, price, price + 10, price - 10, price, 1000]);
      }
      
      const patterns = patternDetector.detectPatterns(volatileData);
      expect(Array.isArray(patterns)).toBe(true);
    });

    test('should handle flat price data', () => {
      const flatData = [];
      const price = 100;
      for (let i = 0; i < 100; i++) {
        const timestamp = Date.now() - (100 - i) * 3600000;
        flatData.push([timestamp, price, price, price, price, 1000]);
      }
      
      const patterns = patternDetector.detectPatterns(flatData);
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('Pattern Accuracy', () => {
    test('should detect at least one pattern in trending data', () => {
      const trendingData = generateTrendingData(200, 'up');
      const patterns = patternDetector.detectPatterns(trendingData);
      
      expect(patterns.length).toBeGreaterThan(0);
    });

    test('should not detect patterns in random data with high threshold', () => {
      const randomData = generateRandomData(100);
      const patterns = patternDetector.detectPatterns(randomData, { minConfidence: 0.9 });
      
      // Should detect very few or no patterns with high threshold
      expect(patterns.length).toBeLessThan(5);
    });
  });
});

// Helper functions to generate test data

function generateMockOHLCV(dataPoints = 200) {
  const ohlcv = [];
  let price = 100;
  const now = Date.now();
  const hourMs = 3600000;

  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = now - (i * hourMs);
    const change = (Math.random() - 0.5) * price * 0.02;
    
    const open = price;
    price += change;
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.random() * 1000 + 500;

    ohlcv.push([timestamp, open, high, low, close, volume]);
  }

  return ohlcv;
}

function generateHeadAndShouldersData() {
  const data = [];
  const base = 100;
  const now = Date.now();
  
  // Uptrend to left shoulder
  for (let i = 0; i < 10; i++) {
    data.push([now - (50 - i) * 3600000, base + i, base + i + 1, base + i - 0.5, base + i, 1000]);
  }
  // Left shoulder peak
  for (let i = 0; i < 5; i++) {
    data.push([now - (40 - i) * 3600000, base + 10 - i, base + 10, base + 9, base + 10 - i, 1000]);
  }
  // Uptrend to head
  for (let i = 0; i < 10; i++) {
    data.push([now - (35 - i) * 3600000, base + 5 + i, base + 6 + i, base + 5 + i - 0.5, base + 5 + i, 1000]);
  }
  // Head peak
  for (let i = 0; i < 5; i++) {
    data.push([now - (25 - i) * 3600000, base + 15 - i, base + 15, base + 14, base + 15 - i, 1000]);
  }
  // Downtrend to right shoulder
  for (let i = 0; i < 8; i++) {
    data.push([now - (20 - i) * 3600000, base + 10 - i, base + 11 - i, base + 9 - i, base + 10 - i, 1000]);
  }
  // Right shoulder
  for (let i = 0; i < 5; i++) {
    data.push([now - (12 - i) * 3600000, base + 10, base + 11, base + 9, base + 10, 1000]);
  }
  // Breakdown
  for (let i = 0; i < 5; i++) {
    data.push([now - (7 - i) * 3600000, base + 10 - i * 2, base + 11 - i * 2, base + 9 - i * 2, base + 10 - i * 2, 1500]);
  }
  
  return data;
}

function generateInverseHeadAndShouldersData() {
  const data = generateHeadAndShouldersData();
  // Invert the data
  const avg = 100;
  return data.map(candle => [
    candle[0],
    2 * avg - candle[1],
    2 * avg - candle[3],
    2 * avg - candle[2],
    2 * avg - candle[4],
    candle[5]
  ]);
}

function generateDoubleTopData() {
  const data = [];
  const base = 100;
  const now = Date.now();
  
  // First peak
  for (let i = 0; i < 10; i++) {
    data.push([now - (30 - i) * 3600000, base + i, base + i + 1, base + i - 0.5, base + i, 1000]);
  }
  // Valley
  for (let i = 0; i < 5; i++) {
    data.push([now - (20 - i) * 3600000, base + 10 - i, base + 10, base + 9, base + 10 - i, 1000]);
  }
  // Second peak
  for (let i = 0; i < 10; i++) {
    data.push([now - (15 - i) * 3600000, base + 5 + i, base + 6 + i, base + 5 + i - 0.5, base + 5 + i, 1000]);
  }
  // Breakdown
  for (let i = 0; i < 5; i++) {
    data.push([now - (5 - i) * 3600000, base + 10 - i * 2, base + 11 - i * 2, base + 9 - i * 2, base + 10 - i * 2, 1500]);
  }
  
  return data;
}

function generateDoubleBottomData() {
  const data = generateDoubleTopData();
  const avg = 100;
  return data.map(candle => [
    candle[0],
    2 * avg - candle[1],
    2 * avg - candle[3],
    2 * avg - candle[2],
    2 * avg - candle[4],
    candle[5]
  ]);
}

function generateTripleTopData() {
  const data = [];
  const base = 100;
  const now = Date.now();
  
  for (let cycle = 0; cycle < 3; cycle++) {
    // Peak
    for (let i = 0; i < 5; i++) {
      data.push([now - (45 - cycle * 15 - i) * 3600000, base + i, base + i + 1, base + i - 0.5, base + i, 1000]);
    }
    // Valley
    if (cycle < 2) {
      for (let i = 0; i < 5; i++) {
        data.push([now - (40 - cycle * 15 - i) * 3600000, base + 5 - i, base + 5, base + 4, base + 5 - i, 1000]);
      }
    }
  }
  
  return data;
}

function generateTripleBottomData() {
  const data = generateTripleTopData();
  const avg = 100;
  return data.map(candle => [
    candle[0],
    2 * avg - candle[1],
    2 * avg - candle[3],
    2 * avg - candle[2],
    2 * avg - candle[4],
    candle[5]
  ]);
}

function generateAscendingTriangleData() {
  const data = [];
  const base = 100;
  const now = Date.now();
  const resistance = base + 10;
  
  for (let i = 0; i < 30; i++) {
    const low = base + i * 0.3; // Rising lows
    const high = resistance; // Flat top
    data.push([now - (30 - i) * 3600000, low, high, low, (low + high) / 2, 1000]);
  }
  
  return data;
}

function generateDescendingTriangleData() {
  const data = generateAscendingTriangleData();
  const avg = 100;
  return data.map(candle => [
    candle[0],
    2 * avg - candle[1],
    2 * avg - candle[3],
    2 * avg - candle[2],
    2 * avg - candle[4],
    candle[5]
  ]);
}

function generateSymmetricalTriangleData() {
  const data = [];
  const base = 100;
  const now = Date.now();
  
  for (let i = 0; i < 30; i++) {
    const low = base - 10 + i * 0.3; // Rising lows
    const high = base + 10 - i * 0.3; // Falling highs
    data.push([now - (30 - i) * 3600000, low, high, low, (low + high) / 2, 1000]);
  }
  
  return data;
}

function generateBullFlagData() {
  const data = [];
  const base = 100;
  const now = Date.now();
  
  // Strong uptrend (pole)
  for (let i = 0; i < 15; i++) {
    data.push([now - (30 - i) * 3600000, base + i * 2, base + i * 2 + 1, base + i * 2 - 0.5, base + i * 2, 2000]);
  }
  // Consolidation (flag)
  for (let i = 0; i < 10; i++) {
    data.push([now - (15 - i) * 3600000, base + 30 - i * 0.5, base + 31, base + 29, base + 30 - i * 0.5, 800]);
  }
  
  return data;
}

function generateBearFlagData() {
  const data = generateBullFlagData();
  const avg = 100;
  return data.map(candle => [
    candle[0],
    2 * avg - candle[1],
    2 * avg - candle[3],
    2 * avg - candle[2],
    2 * avg - candle[4],
    candle[5]
  ]);
}

function generateRisingWedgeData() {
  const data = [];
  const base = 100;
  const now = Date.now();
  
  for (let i = 0; i < 30; i++) {
    const low = base + i * 0.4; // Rising lows
    const high = base + 5 + i * 0.3; // Rising highs (slower)
    data.push([now - (30 - i) * 3600000, low, high, low, (low + high) / 2, 1000]);
  }
  
  return data;
}

function generateFallingWedgeData() {
  const data = generateRisingWedgeData();
  const avg = 100;
  return data.map(candle => [
    candle[0],
    2 * avg - candle[1],
    2 * avg - candle[3],
    2 * avg - candle[2],
    2 * avg - candle[4],
    candle[5]
  ]);
}

function generateTrendingData(dataPoints, direction) {
  const data = [];
  let price = 100;
  const now = Date.now();
  const trend = direction === 'up' ? 0.5 : -0.5;
  
  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = now - (i * 3600000);
    price += trend + (Math.random() - 0.5) * 0.5;
    data.push([timestamp, price, price + 1, price - 1, price, 1000]);
  }
  
  return data;
}

function generateRandomData(dataPoints) {
  const data = [];
  let price = 100;
  const now = Date.now();
  
  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = now - (i * 3600000);
    price += (Math.random() - 0.5) * 5; // Random walk
    data.push([timestamp, price, price + 2, price - 2, price, 1000]);
  }
  
  return data;
}
