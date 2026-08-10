/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { validateEvidenceEnvelope } from '../../contracts/artemisEvidenceContract.js';
import { mapTrendPersistedRun } from '../../services/artemisEvidenceAdapters/trendAdapter.js';
import { mapArbitragePersistedRun } from '../../services/artemisEvidenceAdapters/arbitrageAdapter.js';
import { mapVolumePersistedRun } from '../../services/artemisEvidenceAdapters/volumeAdapter.js';

const NOW = Date.parse('2026-08-10T12:10:00.000Z');
const TREND_RUN_ID = '11111111-1111-4111-8111-111111111111';
const TREND_AGENT_RECORD_ID = '22222222-2222-4222-8222-222222222222';
const ARB_RUN_ID = '33333333-3333-4333-8333-333333333333';
const VOL_RUN_ID = '44444444-4444-4444-8444-444444444444';

describe('Trend read-only adapter', () => {
  it('maps truthful strength and keeps confidence unavailable', () => {
    const mapped = mapTrendPersistedRun({
      nowMs: NOW,
      row: {
        id: TREND_RUN_ID,
        agent_id: TREND_AGENT_RECORD_ID,
        created_at: '2026-08-10T12:00:00.000Z',
        confidence: 0.72,
      },
      output: {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        timestamp: '2026-08-10T12:00:00.000Z',
        last_candle_timestamp: '2026-08-10T11:00:00.000Z',
        trend: { direction: 'bullish', confidence: 72 },
        adx: { value: 31.4, di_plus: 28, di_minus: 12 },
        _meta: { confidence: 0.72, source: 'mexc', dataProvider: 'mexc' },
      },
      input: { symbol: 'BTC/USDT', timeframe: '1h' },
    });

    expect(mapped.ok).toBe(true);
    const envelope = mapped.envelope;
    const validation = validateEvidenceEnvelope(envelope);
    expect(validation.ok).toBe(true);
    expect(envelope.agentId).toBe('trend');
    expect(envelope.executionClass).toBe('advisory_only');
    expect(envelope.conclusion.strength).toMatchObject({ value: 72, scale: 'percent_100' });
    expect(envelope.confidence.availability).toBe('unavailable');
    expect(envelope.confidence.kind).toBe('UNAVAILABLE');
    expect(envelope.freshness.status).toBe('fresh');
    expect(envelope).not.toHaveProperty('executionEligible');
    expect(envelope).not.toHaveProperty('approvedForExecution');
  });

  it('does not treat last_candle === analysis timestamp as fresh and never assumes 1h', () => {
    const ambiguous = mapTrendPersistedRun({
      nowMs: NOW,
      row: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', created_at: '2026-08-10T12:00:00.000Z' },
      output: {
        symbol: 'ETH/USDT',
        timeframe: '1h',
        timestamp: '2026-08-10T12:00:00.000Z',
        last_candle_timestamp: '2026-08-10T12:00:00.000Z',
        trend: { direction: 'bearish', confidence: 40 },
      },
    });
    expect(ambiguous.envelope.freshness.status).toBe('unknown');
    expect(ambiguous.envelope.freshness.reasonKey).toBe('ambiguous_product_fallback_timestamp');

    const unknownTf = mapTrendPersistedRun({
      nowMs: NOW,
      row: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', created_at: '2026-08-10T12:00:00.000Z' },
      output: {
        timestamp: '2026-08-10T12:00:00.000Z',
        last_candle_timestamp: '2026-08-10T11:00:00.000Z',
        trend: { direction: 'bullish', confidence: 55 },
      },
    });
    expect(unknownTf.envelope.freshness.status).toBe('unknown');
    expect(unknownTf.envelope.freshness.reasonKey).toBe('unknown_timeframe_no_default');
    expect(unknownTf.envelope.timeframe).toBeNull();
  });
});

describe('Arbitrage read-only adapter', () => {
  it('is opportunity evidence, not a directional vote', () => {
    const mapped = mapArbitragePersistedRun({
      nowMs: NOW,
      row: { id: ARB_RUN_ID, agent_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', created_at: '2026-08-10T12:00:00.000Z', confidence: 0.5 },
      output: {
        timestamp: '2026-08-10T12:00:00.000Z',
        confidence: 0.5,
        candidates: [{ symbol: 'BTC/USDT', spreadPct: 0.8, netSpreadPct: 0.6 }],
        summary: { spreadCandidates: 1 },
        _meta: { dataProvider: 'mexc' },
      },
    });
    expect(validateEvidenceEnvelope(mapped.envelope).ok).toBe(true);
    expect(mapped.envelope.agentId).toBe('arbitrage');
    expect(mapped.envelope.authorityClass).toBe('opportunity_forecast');
    expect(mapped.envelope.conclusion.direction).toBe('not_applicable');
    expect(mapped.envelope.confidence).toMatchObject({
      availability: 'available',
      value: 0.5,
      scale: 'unit_interval',
      kind: 'HEURISTIC',
    });
    expect(mapped.envelope.freshness.status).toBe('unknown');
    expect(mapped.envelope.executionClass).toBe('advisory_only');
  });

  it('marks generic writer 0.5 without explicit Agent confidence unavailable', () => {
    const mapped = mapArbitragePersistedRun({
      nowMs: NOW,
      row: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', created_at: '2026-08-10T12:00:00.000Z', confidence: 0.5 },
      output: {
        timestamp: '2026-08-10T12:00:00.000Z',
        candidates: [],
      },
    });
    expect(mapped.envelope.confidence.availability).toBe('unavailable');
    expect(mapped.envelope.confidence.reasonKey).toBe('generic_writer_missing_confidence_fallback');
  });
});

describe('Volume read-only adapter', () => {
  it('uses explicit trading_recommendation.confidence on percent_100 scale', () => {
    const mapped = mapVolumePersistedRun({
      nowMs: NOW,
      row: { id: VOL_RUN_ID, created_at: '2026-08-10T12:00:00.000Z', confidence: 0.5 },
      output: {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        timestamp: '2026-08-10T12:00:00.000Z',
        last_candle_timestamp: '2026-08-10T11:00:00.000Z',
        obv: { current: 12, trend: 'rising' },
        vwap: { current: 101 },
        volume_spikes: { volumeRatio: 2.1, isSpike: true },
        trading_recommendation: { action: 'BUY', confidence: 68 },
        metadata: { dataPoints: 48 },
      },
    });
    expect(validateEvidenceEnvelope(mapped.envelope).ok).toBe(true);
    expect(mapped.envelope.confidence).toMatchObject({
      availability: 'available',
      value: 68,
      scale: 'percent_100',
      kind: 'HEURISTIC',
    });
    expect(mapped.envelope.conclusion.direction).toBe('bullish');
    expect(mapped.envelope.freshness.status).toBe('fresh');
  });

  it('fails closed on mock/placeholder or missing core indicators', () => {
    const mock = mapVolumePersistedRun({
      nowMs: NOW,
      row: { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', created_at: '2026-08-10T12:00:00.000Z' },
      output: {
        timestamp: '2026-08-10T12:00:00.000Z',
        obv: { current: 1 },
        _meta: { source: 'mock' },
      },
    });
    expect(mock.envelope.availability).toBe('unavailable');
    expect(mock.envelope.unavailableReason).toBe('mock_or_placeholder_source');

    const missing = mapVolumePersistedRun({
      nowMs: NOW,
      row: { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', created_at: '2026-08-10T12:00:00.000Z', confidence: 0.5 },
      output: { timestamp: '2026-08-10T12:00:00.000Z', trading_recommendation: { action: 'HOLD' } },
    });
    expect(missing.envelope.availability).toBe('unavailable');
    expect(missing.envelope.unavailableReason).toBe('volume_core_indicators_missing');
    expect(missing.envelope.confidence.availability).toBe('unavailable');
  });
});
