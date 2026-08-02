/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  TREND_DIRECTION,
  TREND_REGIME,
  buildTrendSnapshot,
  classifyRegime,
  compareSnapshots,
  normalizeDirection,
  validateAnalyzeRequest,
  validateSettingsInput,
} from '../../services/trendDomain.js';

describe('trendDomain contracts', () => {
  it('normalizeDirection maps analyzer outputs to canonical values', () => {
    expect(normalizeDirection('up')).toBe(TREND_DIRECTION.BULLISH);
    expect(normalizeDirection('down')).toBe(TREND_DIRECTION.BEARISH);
    expect(normalizeDirection('sideways')).toBe(TREND_DIRECTION.SIDEWAYS);
    expect(normalizeDirection(null)).toBe(TREND_DIRECTION.UNAVAILABLE);
  });

  it('classifyRegime distinguishes trending vs ranging', () => {
    expect(classifyRegime(TREND_DIRECTION.BULLISH, 'strong', 28)).toBe(TREND_REGIME.TRENDING);
    expect(classifyRegime(TREND_DIRECTION.SIDEWAYS, 'weak', 12)).toBe(TREND_REGIME.RANGING);
    expect(classifyRegime(TREND_DIRECTION.UNAVAILABLE, 'weak', 12)).toBe(TREND_REGIME.UNAVAILABLE);
  });

  it('buildTrendSnapshot returns unavailable on error without fake direction', () => {
    const snap = buildTrendSnapshot({ error: 'insufficient_candles', symbol: 'BTC/USDT', timeframe: '1h' });
    expect(snap.direction).toBe(TREND_DIRECTION.UNAVAILABLE);
    expect(snap.regime).toBe(TREND_REGIME.UNAVAILABLE);
    expect(snap.unavailableReasons).toContain('analysis_failed');
  });

  it('buildTrendSnapshot maps measured evidence from analyzer output', () => {
    const snap = buildTrendSnapshot({
      symbol: 'BTC/USDT',
      timeframe: '1h',
      timestamp: new Date().toISOString(),
      trend: { direction: 'up', strength: 'strong', confidence: 72 },
      adx: { value: 28, di_plus: 30, di_minus: 12, strength: 'strong', interpretation: 'Strong trend' },
      moving_averages: { signal: { signal: 'bullish_cross', description: 'Price above SMA' } },
      summary: 'Uptrend intact',
    });
    expect(snap.direction).toBe(TREND_DIRECTION.BULLISH);
    expect(snap.regime).toBe(TREND_REGIME.TRENDING);
    expect(snap.adx?.value).toBe(28);
    expect(snap.supportingEvidence.length).toBeGreaterThan(0);
  });

  it('validateAnalyzeRequest rejects invalid timeframe', () => {
    expect(validateAnalyzeRequest({ symbol: 'BTC/USDT', timeframe: '2h' }).ok).toBe(false);
    expect(validateAnalyzeRequest({ symbol: 'BTC/USDT', timeframe: '1h' }).ok).toBe(true);
  });

  it('validateSettingsInput rejects unknown fields', () => {
    expect(validateSettingsInput({ symbol: 'ETH/USDT', rogue: true }).ok).toBe(false);
    expect(validateSettingsInput({ symbol: 'ETH/USDT' }).ok).toBe(true);
  });

  it('compareSnapshots is unavailable without prior run', () => {
    const current = buildTrendSnapshot({
      symbol: 'BTC/USDT',
      timeframe: '1h',
      timestamp: new Date().toISOString(),
      trend: { direction: 'up', strength: 'strong' },
      adx: { value: 25, di_plus: 20, di_minus: 10, strength: 'strong' },
    });
    expect(compareSnapshots(current, null).available).toBe(false);
  });
});
