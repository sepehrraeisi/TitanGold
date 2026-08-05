/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  TREND_DIRECTION,
  TREND_REGIME,
  buildTrendIntegrationsDto,
  buildTrendSnapshot,
  classifyRegime,
  compareSnapshots,
  computeMtfAgreement,
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

  it('classifyRegime distinguishes trending vs ranging vs transition', () => {
    expect(classifyRegime(TREND_DIRECTION.BULLISH, 'strong', 28)).toBe(TREND_REGIME.TRENDING);
    expect(classifyRegime(TREND_DIRECTION.BULLISH, 'developing', 23)).toBe(TREND_REGIME.TRANSITION);
    expect(classifyRegime(TREND_DIRECTION.SIDEWAYS, 'weak', 12)).toBe(TREND_REGIME.RANGING);
    expect(classifyRegime(TREND_DIRECTION.UNAVAILABLE, 'weak', 12)).toBe(TREND_REGIME.UNAVAILABLE);
  });

  it('buildTrendSnapshot aligns regime and ADX at threshold 23', () => {
    const snap = buildTrendSnapshot({
      symbol: 'BTC/USDT',
      timeframe: '1h',
      timestamp: new Date().toISOString(),
      last_candle_timestamp: new Date().toISOString(),
      trend: { direction: 'up', strength: 'weak', confidence: 72 },
      adx: { value: 23, di_plus: 24, di_minus: 13, strength: 'developing', interpretation: null },
      moving_averages: { signal: { signal: 'bullish', description: 'Price above both MAs - bullish alignment' } },
      summary: 'Developing uptrend',
    });
    expect(snap.regime).toBe(TREND_REGIME.TRANSITION);
    expect(snap.strengthClassification).toBe('developing');
    expect(snap.adx?.interpretationKey).toBe('trend_adx_transition');
    expect(snap.weakeningEvidence[0]?.interpretationKey).toBe('trend_weakening_adx');
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

  it('buildTrendIntegrationsDto maps scheduler object status to string label', () => {
    const dto = buildTrendIntegrationsDto({
      redisOk: true,
      mexcPublicOk: true,
      runtime: { globalMode: 'demo', killSwitchActive: true },
      scheduler: {
        status: { status: 'online', allowlist: ['arbitrage'] },
        stale: false,
        source: 'worker-redis',
      },
    });
    expect(typeof dto.scheduler.status).toBe('string');
    expect(dto.scheduler.trendAllowlisted).toBe(false);
    expect(dto.scheduler.reasonKey).toBe('trend_int_scheduler_not_allowlisted');
  });

  it('compareSnapshots rejects different symbols and enriches comparable diffs', () => {
    const base = {
      symbol: 'BTC/USDT',
      timeframe: '1h',
      direction: TREND_DIRECTION.BULLISH,
      regime: TREND_REGIME.TRENDING,
      strengthClassification: 'moderate',
      adx: { value: 28 },
      freshness: 'fresh',
      supportingEvidence: [{ id: 1 }],
      conflictingEvidence: [],
      analysisTimestamp: '2026-08-01T10:00:00.000Z',
    };
    const prior = { ...base, direction: TREND_DIRECTION.SIDEWAYS, adx: { value: 22 }, analysisTimestamp: '2026-08-01T09:00:00.000Z' };
    const mismatch = compareSnapshots(base, { ...prior, symbol: 'ETH/USDT' });
    expect(mismatch.available).toBe(false);
    expect(mismatch.reason).toBe('symbol_mismatch');

    const cmp = compareSnapshots(base, prior, { priorRunId: 'prior-1' });
    expect(cmp.available).toBe(true);
    expect(cmp.priorRunId).toBe('prior-1');
    expect(cmp.direction.changed).toBe(true);
    expect(cmp.adx.delta).toBe(6);
  });

  it('computeMtfAgreement distinguishes full, partial, conflict and unavailable', () => {
    const primary = {
      direction: TREND_DIRECTION.BULLISH,
      regime: TREND_REGIME.TRENDING,
      strengthClassification: 'moderate',
      freshness: 'fresh',
    };
    const full = { ...primary };
    expect(computeMtfAgreement(primary, full).agreement).toBe('full');

    const partial = { ...primary, regime: TREND_REGIME.TRANSITION };
    expect(computeMtfAgreement(primary, partial).agreement).toBe('partial');

    const conflict = { ...primary, direction: TREND_DIRECTION.BEARISH };
    expect(computeMtfAgreement(primary, conflict).agreement).toBe('conflict');
  });

  it('buildTrendSnapshot maps reversal signals to specific interpretation keys', () => {
    const snap = buildTrendSnapshot({
      symbol: 'BTC/USDT',
      timeframe: '1h',
      timestamp: new Date().toISOString(),
      trend: { direction: 'up', strength: 'moderate', confidence: 70 },
      adx: { value: 26, di_plus: 20, di_minus: 12, strength: 'moderate' },
      reversal_signals: [{ type: 'bullish_crossover', strength: 'strong', description: 'ignored prose' }],
    });
    expect(snap.reversalEvidence[0]?.interpretationKey).toBe('trend_reversal_bullish_crossover');
    expect(snap.reversalEvidence[0]?.evidenceState).toBe('detected');
    expect(snap.reversalEvidence[0]?.signalType).toBe('bullish_crossover');
  });
});
