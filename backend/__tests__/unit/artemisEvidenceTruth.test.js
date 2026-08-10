/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  resolveConfidenceFromProvenance,
  resolveDataQuality,
  resolveFreshness,
} from '../../services/artemisEvidenceTruth.js';

describe('Artemis WP-B.1 truth helpers', () => {
  it('keeps an explicit Agent 0.5 confidence', () => {
    const result = resolveConfidenceFromProvenance({
      agentOutput: { confidence: 0.5 },
      persistedConfidence: 0.5,
      explicitPaths: ['confidence'],
    });
    expect(result.availability).toBe('available');
    expect(result.value).toBe(0.5);
    expect(result.kind).toBe('HEURISTIC');
    expect(result.provenance.path).toBe('confidence');
  });

  it('marks missing explicit confidence + generic writer 0.5 as unavailable', () => {
    const result = resolveConfidenceFromProvenance({
      agentOutput: { summary: { ok: true } },
      persistedConfidence: 0.5,
      explicitPaths: ['confidence'],
    });
    expect(result.availability).toBe('unavailable');
    expect(result.value).toBeNull();
    expect(result.kind).toBe('UNAVAILABLE');
    expect(result.reasonKey).toBe('generic_writer_missing_confidence_fallback');
  });

  it('does not invent freshness from analysis time, unknown TF, or missing source candle', () => {
    const missing = resolveFreshness({
      analysisTimestamp: '2026-08-10T12:00:00.000Z',
      timeframe: '1h',
    });
    expect(missing.status).toBe('unknown');
    expect(missing.reasonKey).toBe('missing_proven_source_timestamp');

    const ambiguous = resolveFreshness({
      analysisTimestamp: '2026-08-10T12:00:00.000Z',
      sourceCandleTimestamp: '2026-08-10T12:00:00.000Z',
      timeframe: '1h',
    });
    expect(ambiguous.status).toBe('unknown');
    expect(ambiguous.reasonKey).toBe('ambiguous_product_fallback_timestamp');

    const unknownTf = resolveFreshness({
      analysisTimestamp: '2026-08-10T12:00:00.000Z',
      sourceCandleTimestamp: '2026-08-10T11:00:00.000Z',
      timeframe: 'weird',
    });
    expect(unknownTf.status).toBe('unknown');
    expect(unknownTf.reasonKey).toBe('unknown_timeframe_no_default');
    expect(unknownTf.maxAgeMs).toBeNull();
  });

  it('classifies fresh closed-candle data only with proven source + known TF', () => {
    const nowMs = Date.parse('2026-08-10T12:05:00.000Z');
    const fresh = resolveFreshness({
      analysisTimestamp: '2026-08-10T12:00:00.000Z',
      sourceCandleTimestamp: '2026-08-10T11:00:00.000Z',
      timeframe: '1h',
      nowMs,
    });
    expect(fresh.status).toBe('fresh');
    expect(fresh.timeframe).toBe('1h');
  });

  it('marks mock/placeholder sources unavailable for data quality', () => {
    const dq = resolveDataQuality({ mockOrPlaceholder: true });
    expect(dq.status).toBe('unavailable');
    expect(dq.knownLimitationKeys).toContain('mock_or_placeholder_source');
  });
});
