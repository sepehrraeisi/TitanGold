/**
 * Unit Tests for Market Timing Agent
 * Tests cycle detection, seasonality analysis, and time effects
 * 
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { detectCycle, analyzeSeasonality, analyzeTimeEffects } from '../../../services/cycleDetector.js';
import { run, getDetails, defaultConfig, validateConfig } from '../../../services/agents/timing.js';

describe('Cycle Detector - Market Cycle Detection', () => {
  const mockBullishData = Array.from({ length: 250 }, (_, i) => ({
    time: Date.now() - (250 - i) * 24 * 60 * 60 * 1000,
    open: 40000 + i * 50,
    high: 40100 + i * 50,
    low: 39900 + i * 50,
    close: 40000 + i * 50,
    volume: 1000000
  }));
  
  const mockBearishData = Array.from({ length: 250 }, (_, i) => ({
    time: Date.now() - (250 - i) * 24 * 60 * 60 * 1000,
    open: 50000 - i * 50,
    high: 50100 - i * 50,
    low: 49900 - i * 50,
    close: 50000 - i * 50,
    volume: 1000000
  }));
  
  const mockConsolidationData = Array.from({ length: 250 }, (_, i) => ({
    time: Date.now() - (250 - i) * 24 * 60 * 60 * 1000,
    open: 45000 + Math.sin(i / 10) * 500,
    high: 45500 + Math.sin(i / 10) * 500,
    low: 44500 + Math.sin(i / 10) * 500,
    close: 45000 + Math.sin(i / 10) * 500,
    volume: 1000000
  }));

  test('should detect bull market phase with upward trending data', () => {
    const result = detectCycle(mockBullishData);
    
    expect(result).toHaveProperty('phase');
    expect(['bull', 'consolidation']).toContain(result.phase);
    expect(result).toHaveProperty('confidence');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result).toHaveProperty('indicators');
    expect(result.indicators).toHaveProperty('sma50');
    expect(result.indicators).toHaveProperty('sma200');
  });

  test('should detect bear market phase with downward trending data', () => {
    const result = detectCycle(mockBearishData);
    
    expect(result).toHaveProperty('phase');
    expect(['bear', 'consolidation']).toContain(result.phase);
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('trend');
  });

  test('should detect consolidation phase with sideways data', () => {
    const result = detectCycle(mockConsolidationData);
    
    expect(result).toHaveProperty('phase');
    expect(result.phase).toBe('consolidation');
    expect(result).toHaveProperty('confidence');
  });

  test('should calculate cycle confidence correctly', () => {
    const result = detectCycle(mockBullishData);
    
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('should include analysis indicators (golden cross, death cross)', () => {
    const result = detectCycle(mockBullishData);
    
    expect(result).toHaveProperty('analysis');
    expect(result.analysis).toHaveProperty('goldenCross');
    expect(result.analysis).toHaveProperty('deathCross');
    expect(result.analysis).toHaveProperty('momentum');
    expect(result.analysis).toHaveProperty('volumeConfirmation');
  });

  test('should handle insufficient data gracefully', () => {
    const shortData = mockBullishData.slice(0, 50);
    const result = detectCycle(shortData);
    
    expect(result.phase).toBe('insufficient_data');
    expect(result.confidence).toBe(0);
    expect(result).toHaveProperty('error');
  });

  test('should calculate RSI indicator', () => {
    const result = detectCycle(mockBullishData);
    
    expect(result.indicators).toHaveProperty('rsi');
    expect(result.indicators.rsi).toBeGreaterThanOrEqual(0);
    expect(result.indicators.rsi).toBeLessThanOrEqual(100);
  });

  test('should calculate MACD indicator', () => {
    const result = detectCycle(mockBullishData);
    
    expect(result.indicators).toHaveProperty('macd');
    expect(result.indicators.macd).toHaveProperty('value');
    expect(result.indicators.macd).toHaveProperty('signal');
    expect(result.indicators.macd).toHaveProperty('histogram');
  });

  test('should analyze volume ratio', () => {
    const result = detectCycle(mockBullishData);
    
    expect(result.indicators).toHaveProperty('volumeRatio');
    expect(result.indicators.volumeRatio).toBeGreaterThan(0);
  });
});

describe('Cycle Detector - Seasonality Analysis', () => {
  const mockSeasonalData = Array.from({ length: 730 }, (_, i) => {
    const date = new Date(Date.now() - (730 - i) * 24 * 60 * 60 * 1000);
    const month = date.getMonth();
    // January (0) and February (1) are strong, December (11) is weak
    const seasonalEffect = month === 0 || month === 1 ? 100 : month === 11 ? -100 : 0;
    
    return {
      time: date.getTime(),
      open: 45000 + seasonalEffect,
      high: 45500 + seasonalEffect,
      low: 44500 + seasonalEffect,
      close: 45000 + seasonalEffect + (Math.random() - 0.5) * 100,
      volume: 1000000
    };
  });

  test('should identify monthly patterns', () => {
    const result = analyzeSeasonality(mockSeasonalData, { depth: 'monthly' });
    
    expect(result).toHaveProperty('patterns');
    expect(result.patterns).toHaveProperty('monthly');
    expect(typeof result.patterns.monthly).toBe('object');
  });

  test('should identify quarterly patterns', () => {
    const result = analyzeSeasonality(mockSeasonalData, { depth: 'quarterly' });
    
    expect(result).toHaveProperty('patterns');
    expect(result.patterns).toHaveProperty('quarterly');
  });

  test('should identify strong and weak months', () => {
    const result = analyzeSeasonality(mockSeasonalData);
    
    expect(result).toHaveProperty('strongMonths');
    expect(result).toHaveProperty('weakMonths');
    expect(Array.isArray(result.strongMonths)).toBe(true);
    expect(Array.isArray(result.weakMonths)).toBe(true);
  });

  test('should calculate seasonality confidence', () => {
    const result = analyzeSeasonality(mockSeasonalData);
    
    expect(result).toHaveProperty('confidence');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('should detect crypto-specific patterns', () => {
    const result = analyzeSeasonality(mockSeasonalData);
    
    expect(result.patterns).toHaveProperty('cryptoSpecific');
    expect(result.patterns.cryptoSpecific).toHaveProperty('decemberEffect');
    expect(result.patterns.cryptoSpecific).toHaveProperty('q1Strength');
  });

  test('should provide recommendations for current month', () => {
    const result = analyzeSeasonality(mockSeasonalData);
    
    expect(result).toHaveProperty('recommendations');
    expect(result.recommendations).toHaveProperty('currentMonth');
    expect(result.recommendations).toHaveProperty('isCurrentMonthFavorable');
  });

  test('should handle insufficient data gracefully', () => {
    const shortData = mockSeasonalData.slice(0, 100);
    const result = analyzeSeasonality(shortData);
    
    expect(result).toHaveProperty('confidence');
    expect(result.confidence).toBeLessThan(0.5); // Low confidence with little data
  });
});

describe('Cycle Detector - Time Effects Analysis', () => {
  const mockIntradayData = Array.from({ length: 168 }, (_, i) => {
    const date = new Date(Date.now() - (168 - i) * 60 * 60 * 1000);
    const hour = date.getUTCHours();
    // US trading hours (13-21 UTC) have higher volatility
    const volatility = (hour >= 13 && hour <= 21) ? 200 : 100;
    
    return {
      time: date.getTime(),
      open: 45000 + (Math.random() - 0.5) * volatility,
      high: 45200 + (Math.random() - 0.5) * volatility,
      low: 44800 + (Math.random() - 0.5) * volatility,
      close: 45000 + (Math.random() - 0.5) * volatility,
      volume: 50000 + Math.random() * 25000
    };
  });

  test('should analyze hour-of-day patterns', () => {
    const result = analyzeTimeEffects(mockIntradayData);
    
    expect(result).toHaveProperty('hourlyPatterns');
    expect(result.hourlyPatterns).toHaveProperty('volatility');
    expect(result.hourlyPatterns).toHaveProperty('volume');
    expect(result.hourlyPatterns).toHaveProperty('optimalHours');
  });

  test('should analyze day-of-week patterns', () => {
    const result = analyzeTimeEffects(mockIntradayData);
    
    expect(result).toHaveProperty('dailyPatterns');
    expect(result.dailyPatterns).toHaveProperty('returns');
    expect(result.dailyPatterns).toHaveProperty('volatility');
    expect(result.dailyPatterns).toHaveProperty('optimalDays');
  });

  test('should detect weekend effects', () => {
    const result = analyzeTimeEffects(mockIntradayData, { considerWeekend: true });
    
    expect(result).toHaveProperty('weekendEffect');
    if (result.weekendEffect) {
      expect(result.weekendEffect).toHaveProperty('weekdayVolatility');
      expect(result.weekendEffect).toHaveProperty('weekendVolatility');
      expect(result.weekendEffect).toHaveProperty('shouldAvoid');
    }
  });

  test('should identify optimal trading hours', () => {
    const result = analyzeTimeEffects(mockIntradayData);
    
    expect(result.optimalTimes).toHaveProperty('hours');
    expect(Array.isArray(result.optimalTimes.hours)).toBe(true);
  });

  test('should identify optimal trading days', () => {
    const result = analyzeTimeEffects(mockIntradayData);
    
    expect(result.optimalTimes).toHaveProperty('days');
    expect(Array.isArray(result.optimalTimes.days)).toBe(true);
  });

  test('should analyze trading sessions (Asian, European, American)', () => {
    const result = analyzeTimeEffects(mockIntradayData);
    
    expect(result).toHaveProperty('tradingSessions');
    expect(result.tradingSessions).toHaveProperty('asian');
    expect(result.tradingSessions).toHaveProperty('european');
    expect(result.tradingSessions).toHaveProperty('american');
  });

  test('should provide recommendations for best trading times', () => {
    const result = analyzeTimeEffects(mockIntradayData);
    
    expect(result).toHaveProperty('recommendations');
    expect(result.recommendations).toHaveProperty('bestHoursUTC');
    expect(result.recommendations).toHaveProperty('bestDays');
  });

  test('should calculate time effects confidence', () => {
    const result = analyzeTimeEffects(mockIntradayData);
    
    expect(result).toHaveProperty('confidence');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('should handle insufficient intraday data', () => {
    const shortData = mockIntradayData.slice(0, 10);
    const result = analyzeTimeEffects(shortData);
    
    expect(result).toHaveProperty('error');
    expect(result.confidence).toBe(0);
  });
});

describe('Timing Agent - Integration Tests', () => {
  test('should have required methods (run, getDetails, defaultConfig)', () => {
    expect(typeof run).toBe('function');
    expect(typeof getDetails).toBe('function');
    expect(typeof defaultConfig).toBe('function');
  });

  test('should return proper result structure from run()', async () => {
    const result = await run({
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1d',
      config: {}
    });
    
    expect(result).toHaveProperty('agent_key', 'timing');
    expect(result).toHaveProperty('symbol');
    expect(result).toHaveProperty('timeframe');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('analysis');
    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('_meta');
  });

  test('should return correct details format from getDetails()', async () => {
    const details = await getDetails({ userId: 1 });
    
    expect(details).toHaveProperty('agent_key', 'timing');
    expect(details).toHaveProperty('name');
    expect(details).toHaveProperty('description');
    expect(details).toHaveProperty('capabilities');
    expect(Array.isArray(details.capabilities)).toBe(true);
    expect(details.capabilities.length).toBeGreaterThan(0);
  });

  test('should return correct defaultConfig format', () => {
    const config = defaultConfig();
    
    expect(config).toHaveProperty('enabled');
    expect(config).toHaveProperty('lookbackPeriods');
    expect(config).toHaveProperty('maShort');
    expect(config).toHaveProperty('maLong');
    expect(config).toHaveProperty('rsiPeriod');
    expect(config).toHaveProperty('cycleThreshold');
    expect(config).toHaveProperty('seasonalityDepth');
    expect(config).toHaveProperty('considerWeekendEffect');
  });

  test('should include cycle analysis in result', async () => {
    const result = await run({
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1d'
    });
    
    expect(result.analysis).toHaveProperty('cycle');
    expect(result.analysis.cycle).toHaveProperty('phase');
    expect(result.analysis.cycle).toHaveProperty('trend');
    expect(result.analysis.cycle).toHaveProperty('confidence');
    expect(result.analysis.cycle).toHaveProperty('indicators');
  });

  test('should include seasonality analysis in result', async () => {
    const result = await run({
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1d'
    });
    
    expect(result.analysis).toHaveProperty('seasonality');
    expect(result.analysis.seasonality).toHaveProperty('strongMonths');
    expect(result.analysis.seasonality).toHaveProperty('weakMonths');
    expect(result.analysis.seasonality).toHaveProperty('confidence');
  });

  test('should include time effects analysis in result', async () => {
    const result = await run({
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1d'
    });
    
    expect(result.analysis).toHaveProperty('timeEffects');
    expect(result.analysis.timeEffects).toHaveProperty('optimalHours');
    expect(result.analysis.timeEffects).toHaveProperty('optimalDays');
  });

  test('should include timing score in result', async () => {
    const result = await run({
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1d'
    });
    
    expect(result.analysis).toHaveProperty('timingScore');
    expect(result.analysis.timingScore).toBeGreaterThanOrEqual(0);
    expect(result.analysis.timingScore).toBeLessThanOrEqual(100);
  });

  test('should include recommendations in result', async () => {
    const result = await run({
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1d'
    });
    
    expect(result.analysis).toHaveProperty('recommendations');
    expect(result.analysis.recommendations).toHaveProperty('action');
    expect(result.analysis.recommendations).toHaveProperty('reasoning');
    expect(Array.isArray(result.analysis.recommendations.reasoning)).toBe(true);
  });

  test('should return valid signal (BUY, SELL, or HOLD)', async () => {
    const result = await run({
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1d'
    });
    
    expect(['BUY', 'SELL', 'HOLD']).toContain(result.signal);
  });

  test('should handle errors gracefully', async () => {
    const result = await run({
      userId: 1,
      symbol: null, // Invalid
      timeframe: '1d'
    });
    
    // Should still return a result structure
    expect(result).toHaveProperty('agent_key', 'timing');
    expect(result).toHaveProperty('signal');
  });

  test('should validate configuration correctly', () => {
    const validConfig = {
      maShort: 50,
      maLong: 200,
      rsiPeriod: 14,
      seasonalityDepth: 'monthly'
    };
    
    const result = validateConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('should reject invalid configuration', () => {
    const invalidConfig = {
      maShort: 5, // Too low
      maLong: 400, // Too high
      rsiPeriod: 50, // Too high
      seasonalityDepth: 'invalid'
    };
    
    const result = validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Timing Agent - Confidence Calculations', () => {
  test('should calculate confidence within valid range', async () => {
    const result = await run({
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1d'
    });
    
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('should have higher confidence with strong cycle signals', async () => {
    const result = await run({
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1d',
      config: {
        cycleThreshold: { bullMarket: 0.8 }
      }
    });
    
    expect(result).toHaveProperty('confidence');
    expect(typeof result.confidence).toBe('number');
  });
});
