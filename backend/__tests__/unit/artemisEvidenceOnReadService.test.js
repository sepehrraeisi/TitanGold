/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

const { CANONICAL_AGENT_IDS } = await import('../../contracts/artemisEvidenceContract.js');
const {
  AI_DECISIONS_EVIDENCE_READ_SQL,
  COMPATIBLE_ADAPTER_IDS,
  projectDecisionRow,
  projectRecentEvidence,
} = await import('../../services/artemisEvidenceOnReadService.js');
const { projectEvidenceForProduct, productEvidenceContainsForbiddenField } = await import(
  '../../services/artemisEvidenceProductProjection.js'
);

describe('Artemis WP-B.1 on-read projection', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('uses canonical SQL aliases and a single bounded query', async () => {
    expect(AI_DECISIONS_EVIDENCE_READ_SQL).toMatch(/d\.input_data AS input/);
    expect(AI_DECISIONS_EVIDENCE_READ_SQL).toMatch(/d\.output_data AS output/);
    expect(AI_DECISIONS_EVIDENCE_READ_SQL).not.toMatch(/SELECT[^\n]*\bd\.input\b/);
    expect(AI_DECISIONS_EVIDENCE_READ_SQL).not.toMatch(/SELECT[^\n]*\bd\.output\b/);
    expect(COMPATIBLE_ADAPTER_IDS).toEqual(CANONICAL_AGENT_IDS);
    expect(COMPATIBLE_ADAPTER_IDS).toHaveLength(15);

    mockQuery.mockResolvedValue({ rows: [] });
    const result = await projectRecentEvidence({ limit: 200 });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toEqual([50]);
    expect(result.metrics.queryCount).toBe(1);
    expect(result.metrics.rowsLoaded).toBe(0);
  });

  it('projects a Trend row into a product-safe envelope without raw blobs', () => {
    const projected = projectDecisionRow({
      id: 'd-trend',
      agent_id: 'uuid-trend',
      agent_key: 'trend_detection',
      confidence: 0.72,
      created_at: '2026-08-10T12:00:00.000Z',
      input: { symbol: 'BTC/USDT', timeframe: '1h', api_key: 'should-not-leak' },
      output: {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        timestamp: '2026-08-10T12:00:00.000Z',
        last_candle_timestamp: '2026-08-10T11:00:00.000Z',
        trend: { direction: 'bullish', confidence: 72 },
        adx: { value: 30, di_plus: 22, di_minus: 11 },
      },
    }, { nowMs: Date.parse('2026-08-10T12:10:00.000Z') });

    expect(projected.ok).toBe(true);
    expect(projected.agentId).toBe('trend');
    expect(projected.evidenceCompatible).toBe(true);
    expect(projected.evidenceAvailable).toBe(true);
    expect(projected.envelope).toBeUndefined();
    expect(projected.product.executionEligible).toBe(false);
    expect(projected.product.advisoryOnly).toBe(true);
    expect(projected.product.confidence.availability).toBe('unavailable');
    expect(projected.product.conclusion.strength).toMatchObject({ value: 72, scale: 'percent_100' });
    expect(productEvidenceContainsForbiddenField(projected.product)).toBe(false);
    expect(JSON.stringify(projected.product)).not.toMatch(/api_key/);
    expect(JSON.stringify(projected.product)).not.toMatch(/input_data/);
    expect(JSON.stringify(projected.product)).not.toMatch(/output_data/);
  });

  it('maps Pattern fail-closed and Optimization not_applicable without dropping compatibility', () => {
    const pattern = projectDecisionRow({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-0000000000p1',
      agent_key: 'pattern',
      created_at: '2026-08-10T12:00:00.000Z',
      output: { symbol: 'ETH/USDT' },
    }, { includeInternalEnvelope: true, nowMs: Date.parse('2026-08-10T12:10:00.000Z') });
    expect(pattern.ok).toBe(true);
    expect(pattern.evidenceCompatible).toBe(true);
    expect(pattern.evidenceAvailable).toBe(false);
    expect(pattern.envelope.availability).toBe('unavailable');
    expect(pattern.envelope.unavailableReason).toBe('mock_or_placeholder_source');

    const optimization = projectDecisionRow({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-0000000000o1',
      agent_key: 'optimization',
      created_at: '2026-08-10T12:00:00.000Z',
      output: { score: 1, recommendation: 'BUY' },
    }, { includeInternalEnvelope: true, nowMs: Date.parse('2026-08-10T12:10:00.000Z') });
    expect(optimization.ok).toBe(true);
    expect(optimization.evidenceCompatible).toBe(true);
    expect(optimization.evidenceAvailable).toBe(false);
    expect(optimization.envelope.availability).toBe('not_applicable');
    expect(optimization.envelope.conclusion.direction).toBe('not_applicable');
    expect(JSON.stringify(optimization.envelope.conclusion)).not.toMatch(/BUY|SELL|EXECUTE/);
  });

  it('product projection never copies confidence value or raw evidence items', () => {
    const product = projectEvidenceForProduct({
      schemaVersion: '1.0.0',
      contractVersion: 'artemis-evidence-1.0.0',
      adapterVersion: '1.0.0',
      agentId: 'volume',
      agentRole: 'analytical_evidence',
      authorityClass: 'analytical_evidence',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      availability: 'available',
      lifecycleStatus: 'completed',
      executionClass: 'advisory_only',
      limitations: ['advisory_only'],
      freshness: { status: 'fresh', reasonKey: 'source_fresh', ageMs: 12 },
      dataQuality: { status: 'ok' },
      confidence: { availability: 'available', value: 68, kind: 'HEURISTIC', scale: 'percent_100' },
      conclusion: { direction: 'bullish', signal: 'BUY', strength: { value: 68, scale: 'percent_100' } },
      evidence: { items: [{ evidenceId: 'volume-obv', value: 12 }] },
      input: { secret: 'nope' },
    });
    expect(product.confidence).toEqual({
      availability: 'available',
      kind: 'HEURISTIC',
      scale: 'percent_100',
    });
    expect(product.evidenceItemCount).toBe(1);
    expect(product).not.toHaveProperty('input');
    expect(product.executionEligible).toBe(false);
    expect(productEvidenceContainsForbiddenField(product)).toBe(false);
  });
});
