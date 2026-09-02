/**
 * @jest-environment node
 *
 * Artemis Core Stage 4 — read-only evidence ingestion.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

const { CANONICAL_AGENT_IDS, AGENT_CONTRACT_ROLE } = await import('../../contracts/artemisEvidenceContract.js');
const {
  INGESTION_DISPOSITION,
  INGESTION_REASON,
  MAX_INGEST_BATCH,
  ZERO_SIDE_EFFECTS,
} = await import('../../contracts/artemisEvidenceIngestionContract.js');
const {
  ingestEvidence,
  ingestEvidenceBatch,
  getValidatedEvidence,
  applyIngestionDisposition,
  assertReadOnlySql,
  AI_DECISIONS_INGEST_READ_SQL,
} = await import('../../services/artemisEvidenceIngestionService.js');
const { projectDecisionRow } = await import('../../services/artemisEvidenceOnReadService.js');

const NOW = Date.parse('2026-08-10T12:10:00.000Z');
const TS = '2026-08-10T12:00:00.000Z';
const CANDLE = '2026-08-10T11:00:00.000Z';
const OWNER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-0000000000a1';
const OWNER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-0000000000b1';

const AVAILABLE = {
  technical: {
    symbol: 'BTC/USDT',
    timeframe: '1h',
    timestamp: TS,
    last_candle_timestamp: CANDLE,
    signal: 'bullish',
    confidence: 0.61,
    indicators: { rsi: 55, macd: { histogram: 0.2 }, trend: 'bullish' },
    _meta: { source: 'mexc', dataProvider: 'mexc' },
  },
  trend: {
    symbol: 'BTC/USDT',
    timeframe: '1h',
    timestamp: TS,
    last_candle_timestamp: CANDLE,
    trend: { direction: 'bullish', confidence: 72 },
    adx: { value: 31.4, di_plus: 28, di_minus: 12 },
    _meta: { source: 'mexc', dataProvider: 'mexc' },
  },
  pattern: {
    symbol: 'ETH/USDT',
    timeframe: '1h',
    timestamp: TS,
    last_candle_timestamp: CANDLE,
    confidence: 0.44,
    result: { patterns_detected: 2, dominant_signal: 'bullish' },
    _meta: { source: 'mexc', dataProvider: 'mexc' },
  },
  volume: {
    symbol: 'BTC/USDT',
    timeframe: '1h',
    timestamp: TS,
    last_candle_timestamp: CANDLE,
    obv: { current: 12, trend: 'rising' },
    vwap: { current: 101 },
    volume_spikes: { volumeRatio: 2.1, isSpike: true },
    trading_recommendation: { action: 'BUY', confidence: 68 },
    metadata: { dataPoints: 48 },
  },
  sentiment: {
    timestamp: TS,
    confidence: 0.4,
    result: {
      sentiment_label: 'bullish',
      aggregate_sentiment: 0.4,
      sources: { news: { count: 12, mock: false } },
    },
  },
  fundamental: {
    timestamp: TS,
    decision: 'buy',
    confidence: 0.7,
    score: { total: 62 },
    marketSummary: { fearGreed: 48 },
    overview: { lastPrice: 65000 },
  },
  market_intelligence: {
    timestamp: TS,
    confidence: 70,
    recommendation: { action: 'BUY' },
    metadata: {
      anomalies_detected: 2,
      data_freshness: { news: '2026-08-10T11:50:00.000Z' },
    },
  },
  price_prediction: {
    timestamp: TS,
    timeframe: '1h',
    method: 'arima',
    current_price: 100,
    predictions: { '24h': { price: 110 } },
    last_candle_timestamp: CANDLE,
    _meta: { confidence: 0.66, dataProvider: 'mexc' },
  },
  timing: {
    timestamp: TS,
    timeframe: '1h',
    signal: 'buy',
    confidence: 0.52,
    last_candle_timestamp: CANDLE,
    _meta: { source: 'mexc', dataProvider: 'mexc' },
  },
  arbitrage: {
    timestamp: TS,
    confidence: 0.5,
    candidates: [{ symbol: 'BTC/USDT', spreadPct: 0.8, netSpreadPct: 0.6 }],
    summary: { spreadCandidates: 1 },
    _meta: { dataProvider: 'mexc' },
  },
  risk: {
    timestamp: TS,
    analysis: { overall_risk_level: 'HIGH', overall_risk_score: 78 },
  },
  portfolio: {
    timestamp: TS,
    optimal_allocation: { weights: { BTC: 0.4, ETH: 0.3, USDT: 0.3 } },
  },
  optimization: { timestamp: TS, recommendation: 'BUY', score: 99 },
  liquidity: {
    timestamp: TS,
    result: 'MVP analysis complete',
    confidence: 0.55,
    _meta: { source: 'mock' },
  },
  order: {
    timestamp: TS,
    action: 'place',
    result: { dry_run: true, simulated: true },
  },
};

const FAILURE = {
  technical: { _meta: { source: 'mock' }, confidence: 0 },
  trend: { error: true, errorMessage: 'trend_failed' },
  pattern: { meta: { source: 'realtime' }, result: { dominant_signal: 'bullish' } },
  volume: { _meta: { source: 'mock' }, obv: { current: 1 } },
  sentiment: { result: { sources: { news: { mock: true, count: 0 } } } },
  fundamental: { _meta: { source: 'mock' }, overview: { lastPrice: 0, marketCap: 0 } },
  market_intelligence: { _meta: { source: 'mock' }, recommendation: { action: 'BUY' } },
  price_prediction: { method: 'mock', current_price: 0, _meta: { confidence: 0 } },
  timing: { _meta: { source: 'timing_agent' }, confidence: 0.9 },
  arbitrage: { error: true, errorMessage: 'scan_failed' },
  risk: { error: 'risk_failed' },
  portfolio: { error: 'portfolio_failed' },
  optimization: { recommendation: 'SELL', score: 0 },
  liquidity: { result: 'MVP analysis complete', confidence: 0.55, _meta: { source: 'mock' } },
  order: { error: 'order_failed', side: 'BUY' },
};

const EXPECTED_AVAILABLE_DISPOSITION = Object.freeze({
  technical: INGESTION_DISPOSITION.ACCEPTED,
  trend: INGESTION_DISPOSITION.ACCEPTED,
  pattern: INGESTION_DISPOSITION.ACCEPTED,
  volume: INGESTION_DISPOSITION.ACCEPTED,
  sentiment: INGESTION_DISPOSITION.REJECTED_INVALID,
  fundamental: INGESTION_DISPOSITION.REJECTED_INVALID,
  market_intelligence: INGESTION_DISPOSITION.ACCEPTED,
  price_prediction: INGESTION_DISPOSITION.ACCEPTED,
  timing: INGESTION_DISPOSITION.ACCEPTED,
  arbitrage: INGESTION_DISPOSITION.REJECTED_INVALID,
  risk: INGESTION_DISPOSITION.REJECTED_INVALID,
  portfolio: INGESTION_DISPOSITION.REJECTED_INVALID,
  optimization: INGESTION_DISPOSITION.NOT_APPLICABLE,
  liquidity: INGESTION_DISPOSITION.BLOCKED,
  order: INGESTION_DISPOSITION.REJECTED_INVALID,
});

const EXPECTED_FAILURE_DISPOSITION = Object.freeze({
  technical: INGESTION_DISPOSITION.UNAVAILABLE,
  trend: INGESTION_DISPOSITION.UNAVAILABLE,
  pattern: INGESTION_DISPOSITION.UNAVAILABLE,
  volume: INGESTION_DISPOSITION.UNAVAILABLE,
  sentiment: INGESTION_DISPOSITION.UNAVAILABLE,
  fundamental: INGESTION_DISPOSITION.UNAVAILABLE,
  market_intelligence: INGESTION_DISPOSITION.UNAVAILABLE,
  price_prediction: INGESTION_DISPOSITION.UNAVAILABLE,
  timing: INGESTION_DISPOSITION.UNAVAILABLE,
  arbitrage: INGESTION_DISPOSITION.UNAVAILABLE,
  risk: INGESTION_DISPOSITION.UNAVAILABLE,
  portfolio: INGESTION_DISPOSITION.UNAVAILABLE,
  optimization: INGESTION_DISPOSITION.NOT_APPLICABLE,
  liquidity: INGESTION_DISPOSITION.BLOCKED,
  order: INGESTION_DISPOSITION.UNAVAILABLE,
});

const EXPECTED_READINESS = Object.freeze({
  technical: 'ARTEMIS_CONSUMABLE',
  trend: 'ARTEMIS_CONSUMABLE',
  pattern: 'ARTEMIS_CONSUMABLE',
  volume: 'ARTEMIS_CONSUMABLE',
  sentiment: 'ARTEMIS_CONSUMABLE',
  fundamental: 'ARTEMIS_CONSUMABLE',
  market_intelligence: 'ARTEMIS_CONSUMABLE',
  price_prediction: 'ARTEMIS_CONSUMABLE',
  timing: 'ARTEMIS_CONSUMABLE',
  arbitrage: 'ARTEMIS_CONSUMABLE',
  risk: 'ARTEMIS_CONSUMABLE',
  portfolio: 'ARTEMIS_CONSUMABLE',
  optimization: 'NOT_APPLICABLE',
  liquidity: 'BLOCKED',
  order: 'ARTEMIS_CONSUMABLE',
});

function runId(suffix) {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(suffix).replace(/[^a-z0-9]/gi, '').padEnd(12, '0').slice(0, 12)}`;
}

function decisionRow(agentKey, output, extra = {}) {
  return {
    id: extra.id || runId(agentKey),
    agent_id: extra.agent_id || runId(`ag${agentKey}`),
    user_id: extra.user_id ?? null,
    agent_key: agentKey,
    created_at: extra.created_at || TS,
    confidence: extra.confidence,
    input: extra.input || { symbol: 'BTC/USDT', timeframe: '1h' },
    output,
  };
}

function ingestRow(agentKey, output, extra = {}) {
  return ingestEvidence(
    { row: decisionRow(agentKey, output, extra) },
    { nowMs: extra.nowMs ?? NOW, ownerUserId: extra.ownerUserId, decisionContext: extra.decisionContext },
  );
}

function expectZeroSideEffects(result) {
  expect(result.sideEffects).toEqual(ZERO_SIDE_EFFECTS);
  expect(result.executionEligible).toBe(false);
  expect(result.decisionEligible).toBe(false);
}

describe('Artemis Stage 4 read-only evidence ingestion', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('A ACCEPT valid reconstructed Stage 3 evidence', () => {
    const result = ingestRow('trend', AVAILABLE.trend);
    expect(result.disposition).toBe(INGESTION_DISPOSITION.ACCEPTED);
    expect(result.reasonKey).toBe(INGESTION_REASON.VALID_CURRENT_EVIDENCE);
    expect(result.agentId).toBe('trend');
    expect(result.persistenceModel).toBe('legacy_reconstructed');
    expect(result.envelope.availability).toBe('available');
    expect(result.envelope.conclusion.direction).toBe('bullish');
    expectZeroSideEffects(result);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('A ACCEPT valid canonical persisted envelope', () => {
    const reconstructed = ingestRow('technical', AVAILABLE.technical);
    const result = ingestEvidence(
      { envelope: reconstructed.envelope },
      { nowMs: NOW },
    );
    expect(result.disposition).toBe(INGESTION_DISPOSITION.ACCEPTED);
    expect(result.persistenceModel).toBe('canonical_persisted');
    expect(getValidatedEvidence({ envelope: reconstructed.envelope }, { nowMs: NOW }).disposition)
      .toBe(INGESTION_DISPOSITION.ACCEPTED);
  });

  it('A ACCEPT truthful native neutral conclusion, not unavailable', () => {
    const result = ingestRow('trend', {
      ...AVAILABLE.trend,
      trend: { direction: 'sideways', confidence: 40 },
    });
    expect(result.disposition).toBe(INGESTION_DISPOSITION.ACCEPTED);
    expect(result.envelope.conclusion.direction).toBe('sideways');
    expect(result.disposition).not.toBe(INGESTION_DISPOSITION.UNAVAILABLE);
  });

  it('B IDENTITY canonical Agent ID and approved alias', () => {
    const canonical = ingestRow('trend', AVAILABLE.trend);
    const alias = ingestRow('trend_detection', AVAILABLE.trend);
    expect(canonical.agentId).toBe('trend');
    expect(alias.agentId).toBe('trend');
    expect(alias.disposition).toBe(INGESTION_DISPOSITION.ACCEPTED);
  });

  it('B IDENTITY unknown Agent rejection', () => {
    const result = ingestRow('not_a_real_agent', AVAILABLE.trend);
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_IDENTITY);
    expect(result.reasonKey).toBe(INGESTION_REASON.UNKNOWN_AGENT);
    expect(result.envelope).toBeUndefined();
  });

  it('B IDENTITY legacy agent-N rejection', () => {
    const result = ingestRow('agent-3', AVAILABLE.trend);
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_IDENTITY);
    expect(result.reasonKey).toBe(INGESTION_REASON.LEGACY_AGENT_N);
  });

  it('C CONTRACT malformed envelope rejected', () => {
    const result = ingestEvidence({ envelope: { agentId: 'trend' } }, { nowMs: NOW });
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_INVALID);
  });

  it('C CONTRACT forbidden unknown fields rejected', () => {
    const valid = ingestRow('trend', AVAILABLE.trend);
    const result = ingestEvidence(
      { envelope: { ...valid.envelope, extraField: true } },
      { nowMs: NOW },
    );
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_INVALID);
    expect(result.reasonKey).toBe(INGESTION_REASON.FORBIDDEN_FIELD);
  });

  it('C CONTRACT authority mismatch rejected', () => {
    const valid = ingestRow('trend', AVAILABLE.trend);
    const result = ingestEvidence(
      {
        envelope: {
          ...valid.envelope,
          agentRole: AGENT_CONTRACT_ROLE.risk.agentRole,
          authorityClass: AGENT_CONTRACT_ROLE.risk.authorityClass,
        },
      },
      { nowMs: NOW },
    );
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_INVALID);
    expect(result.reasonKey).toBe(INGESTION_REASON.AUTHORITY_MISMATCH);
  });

  it('D FRESHNESS fresh accepted and aged accepted', () => {
    const fresh = ingestRow('trend', AVAILABLE.trend);
    expect(fresh.envelope.freshness.status).toBe('fresh');
    expect(fresh.disposition).toBe(INGESTION_DISPOSITION.ACCEPTED);

    const aged = ingestRow('trend', {
      ...AVAILABLE.trend,
      last_candle_timestamp: '2026-08-10T10:00:00.000Z',
    });
    expect(aged.envelope.freshness.status).toBe('aged');
    expect(aged.disposition).toBe(INGESTION_DISPOSITION.ACCEPTED);
  });

  it('D FRESHNESS stale is REJECTED_STALE, not a confirming vote', () => {
    const result = ingestRow('trend', {
      ...AVAILABLE.trend,
      last_candle_timestamp: '2026-08-10T06:00:00.000Z',
    });
    expect(result.envelope.freshness.status).toBe('stale');
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_STALE);
    expect(result.reasonKey).toBe(INGESTION_REASON.STALE);
    expect(result.envelope).toBeTruthy();
  });

  it('D FRESHNESS expired rejected', () => {
    const valid = ingestRow('trend', AVAILABLE.trend);
    const expired = {
      ...valid.envelope,
      freshness: { ...valid.envelope.freshness, status: 'expired' },
      expiryTimestamp: '2026-08-10T12:00:00.000Z',
    };
    const result = ingestEvidence({ envelope: expired }, { nowMs: NOW });
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_EXPIRED);
    expect(result.reasonKey).toBe(INGESTION_REASON.EXPIRED);
  });

  it('D FRESHNESS missing timestamp fail closed', () => {
    const result = ingestEvidence(
      {
        row: {
          id: runId('nodate'),
          agent_key: 'trend',
          output: { symbol: 'BTC/USDT', timeframe: '1h', trend: { direction: 'bullish' } },
        },
      },
      { nowMs: NOW },
    );
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_INVALID);
    expect(result.reasonKey).toBe(INGESTION_REASON.MISSING_TIMESTAMP);
  });

  it('D FRESHNESS malformed timestamp fail closed', () => {
    const result = ingestEvidence(
      {
        row: {
          id: runId('baddate'),
          agent_key: 'trend',
          output: {
            timestamp: 'not-a-date',
            last_candle_timestamp: 'also-bad',
            timeframe: '1h',
            trend: { direction: 'bullish' },
          },
        },
      },
      { nowMs: NOW },
    );
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_INVALID);
    expect(result.reasonKey).toBe(INGESTION_REASON.MISSING_TIMESTAMP);
  });

  it('E AVAILABILITY unavailable is not neutral', () => {
    const result = ingestRow('trend', FAILURE.trend);
    expect(result.disposition).toBe(INGESTION_DISPOSITION.UNAVAILABLE);
    expect(result.envelope.availability).not.toBe('available');
    expect(['bullish', 'bearish', 'sideways', 'neutral']).not.toContain(result.envelope.conclusion?.direction);
    expect(result.envelope.confidence?.value).not.toBe(0);
  });

  it('E AVAILABILITY blocked / not_applicable / provider families', () => {
    expect(ingestRow('liquidity', AVAILABLE.liquidity).disposition).toBe(INGESTION_DISPOSITION.BLOCKED);
    expect(ingestRow('optimization', AVAILABLE.optimization).disposition).toBe(INGESTION_DISPOSITION.NOT_APPLICABLE);
    expect(ingestRow('technical', FAILURE.technical).reasonKey).toBe(INGESTION_REASON.MOCK_OR_PLACEHOLDER);
    const policy = applyIngestionDisposition({
      envelope: {
        availability: 'provider_unavailable',
        unavailableReason: 'provider_unavailable',
        executionClass: 'advisory_only',
        freshness: { status: 'fresh' },
      },
      validation: { ok: true },
      nowMs: NOW,
    });
    expect(policy.disposition).toBe(INGESTION_DISPOSITION.UNAVAILABLE);
    expect(policy.reasonKey).toBe(INGESTION_REASON.PROVIDER_UNAVAILABLE);
  });

  it('F ROLES preserve authority without elevation', () => {
    const risk = ingestRow('risk', AVAILABLE.risk);
    expect(risk.authorityClass).toBe('control_veto');
    expect(risk.envelope.authorityClass).toBe('control_veto');
    expect(risk.disposition).not.toBe(INGESTION_DISPOSITION.ACCEPTED);
    expect(['bullish', 'bearish']).not.toContain(risk.envelope.conclusion?.direction);

    const portfolio = ingestRow('portfolio', AVAILABLE.portfolio);
    expect(portfolio.authorityClass).toBe('control_sizing');

    const optimization = ingestRow('optimization', AVAILABLE.optimization);
    expect(optimization.disposition).toBe(INGESTION_DISPOSITION.NOT_APPLICABLE);
    expect(optimization.authorityClass).toBe('not_applicable');

    const liquidity = ingestRow('liquidity', AVAILABLE.liquidity);
    expect(liquidity.disposition).toBe(INGESTION_DISPOSITION.BLOCKED);
    expect(liquidity.authorityClass).toBe('execution_feasibility');
    expect(liquidity.envelope.feasibility?.availability).not.toBe('available');

    const order = ingestRow('order', AVAILABLE.order);
    expect(order.authorityClass).toBe('execution');
    expect(order.envelope.executionClass).toBe('none');
    expect(order.envelope).not.toHaveProperty('executionEligible');
    expect(order.envelope).not.toHaveProperty('approvedForExecution');
  });

  it('G PROVENANCE adapter version, correlation family, limitations, confidence method', () => {
    const result = ingestRow('trend', AVAILABLE.trend);
    expect(result.envelope.provenance.writer).toBe('trendEvidenceAdapter');
    expect(result.envelope.provenance.writer).not.toBe('artemis');
    expect(result.envelope.provenance.adapterVersion).toBe('1.0.0');
    expect(result.envelope.correlationFamily).toBeTruthy();
    expect(result.envelope.limitations.length).toBeGreaterThan(0);
    expect(result.lineage.confidenceKind || result.envelope.confidence.kind).toBeTruthy();
    expect(result.provenancePreserved).toBe(true);
    expect(result.ingestion.writer).toBe('artemisEvidenceIngestionService');
  });

  it('H READ-ONLY ingestEvidence performs zero writes and zero executions', () => {
    const result = ingestRow('technical', AVAILABLE.technical);
    expectZeroSideEffects(result);
    expect(mockQuery).toHaveBeenCalledTimes(0);
    expect(() => assertReadOnlySql('INSERT INTO ai_decisions VALUES (1)')).toThrow(/STAGE4_READ_ONLY_VIOLATION/);
    expect(() => assertReadOnlySql('UPDATE ai_decisions SET confidence = 1')).toThrow(/STAGE4_READ_ONLY_VIOLATION/);
    expect(() => assertReadOnlySql('DELETE FROM ai_decisions')).toThrow(/STAGE4_READ_ONLY_VIOLATION/);
    expect(() => assertReadOnlySql(AI_DECISIONS_INGEST_READ_SQL)).not.toThrow();
  });

  it('I BATCH mixed valid/invalid records with deterministic counts', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        decisionRow('trend', AVAILABLE.trend, { id: runId('batch1') }),
        decisionRow('not_a_real_agent', AVAILABLE.trend, { id: runId('batch2') }),
        decisionRow('liquidity', AVAILABLE.liquidity, { id: runId('batch3') }),
        decisionRow('optimization', AVAILABLE.optimization, { id: runId('batch4') }),
        decisionRow('technical', FAILURE.technical, { id: runId('batch5') }),
      ],
    });
    const batch = await ingestEvidenceBatch({ nowMs: NOW, limit: 20 });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1][0]).toBe(20);
    expect(batch.query.bounded).toBe(true);
    expect(batch.query.nPlusOne).toBe(false);
    expect(batch.counts.total).toBe(5);
    expect(batch.counts.accepted).toBe(1);
    expect(batch.counts.rejected).toBe(1);
    expect(batch.counts.blocked).toBe(1);
    expect(batch.counts.notApplicable).toBe(1);
    expect(batch.counts.unavailable).toBe(1);
    expect(batch.items).toHaveLength(5);
    expectZeroSideEffects(batch);
  });

  it('I BATCH bounds LIMIT to 50 and uses ownership SQL', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const batch = await ingestEvidenceBatch({ nowMs: NOW, limit: 500, ownerUserId: OWNER_A });
    expect(batch.query.limit).toBe(MAX_INGEST_BATCH);
    expect(mockQuery.mock.calls[0][1][0]).toBe(50);
    expect(mockQuery.mock.calls[0][1][1]).toBe(OWNER_A);
    expect(AI_DECISIONS_INGEST_READ_SQL).toMatch(/d\.user_id IS NULL OR d\.user_id = \$2::uuid/);
    expect(AI_DECISIONS_INGEST_READ_SQL).toMatch(/ORDER BY d\.created_at DESC/);
    expect(AI_DECISIONS_INGEST_READ_SQL).toMatch(/LIMIT \$1/);
  });

  it('I BATCH does not fail entirely because one Agent record is invalid', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        decisionRow('trend', AVAILABLE.trend),
        decisionRow('unknown_xxx', AVAILABLE.trend),
      ],
    });
    const batch = await ingestEvidenceBatch({ nowMs: NOW });
    expect(batch.items[0].disposition).toBe(INGESTION_DISPOSITION.ACCEPTED);
    expect(batch.items[1].disposition).toBe(INGESTION_DISPOSITION.REJECTED_IDENTITY);
  });

  it('J 15 AGENTS table-driven available coverage', () => {
    expect(CANONICAL_AGENT_IDS).toHaveLength(15);
    for (const agentId of CANONICAL_AGENT_IDS) {
      const result = ingestRow(agentId, AVAILABLE[agentId]);
      expect(result.agentId || result.identity?.agentId || agentId).toBe(agentId);
      expect(result.disposition).toBe(EXPECTED_AVAILABLE_DISPOSITION[agentId]);
      expect(result.authorityClass).toBe(AGENT_CONTRACT_ROLE[agentId].authorityClass);
      expectZeroSideEffects(result);
      expect(EXPECTED_READINESS[agentId]).toBeTruthy();
    }
  });

  it('J 15 AGENTS table-driven failure/unavailable coverage', () => {
    for (const agentId of CANONICAL_AGENT_IDS) {
      const result = ingestRow(agentId, FAILURE[agentId]);
      expect(result.disposition).toBe(EXPECTED_FAILURE_DISPOSITION[agentId]);
      expect(result.disposition).not.toBe(INGESTION_DISPOSITION.ACCEPTED);
      if (result.envelope) {
        expect(['bullish', 'bearish', 'sideways', 'neutral']).not.toContain(result.envelope.conclusion?.direction);
      }
      expectZeroSideEffects(result);
    }
  });

  it('ownership mismatch rejects without leaking the foreign envelope', () => {
    const result = ingestRow('trend', AVAILABLE.trend, { user_id: OWNER_B, ownerUserId: OWNER_A });
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_CONTEXT);
    expect(result.reasonKey).toBe(INGESTION_REASON.OWNERSHIP_SCOPE_MISMATCH);
    expect(result.envelope).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/bullish/);
  });

  it('context mismatch is REJECTED_CONTEXT', () => {
    const result = ingestRow('trend', AVAILABLE.trend, {
      decisionContext: { symbol: 'ETH/USDT', timeframe: '1h' },
    });
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_CONTEXT);
    expect(result.reasonKey).toBe(INGESTION_REASON.CONTEXT_INCOMPATIBLE);
  });

  it('forbidden execution claims never become ACCEPTED', () => {
    const valid = ingestRow('trend', AVAILABLE.trend);
    const result = ingestEvidence(
      { envelope: { ...valid.envelope, executionEligible: true, approvedForExecution: true } },
      { nowMs: NOW },
    );
    expect(result.disposition).toBe(INGESTION_DISPOSITION.REJECTED_INVALID);
    expect(result.decisionEligible).toBe(false);
    expect(result.executionEligible).toBe(false);
  });

  it('does not start Stage 5+ orchestration or execution owners', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      path.join(here, '../../services/artemisEvidenceIngestionService.js'),
      'utf8',
    );
    expect(src).not.toMatch(/\badmitEvidenceSet\s*\(/);
    expect(src).not.toMatch(/\badmitEvidenceEnvelope\s*\(/);
    expect(src).not.toMatch(/from '\.\/artemisOrchestrator\.js'/);
    expect(src).not.toMatch(/from '\.\/artemisDeterministicSynthesisService\.js'/);
    expect(src).not.toMatch(/placeOrder|createOrder|tradingEngine/);
    expect(src).not.toMatch(/Cognitive Kernel/);
    expect(projectDecisionRow).toEqual(expect.any(Function));
  });
});
