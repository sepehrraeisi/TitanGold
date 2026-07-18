/**
 * ARB-WP1A contract tests — analytical spread monitor semantics
 * @jest-environment node
 */
import { jest } from '@jest/globals';

const mockFetch = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch,
}));

const { run, detectOpportunities, getInternalApiBase } = await import(
  '../../../services/agents/arbitrage.js'
);
const {
  normalizeScanResult,
  buildArbitrageMetricsFromNormalized,
  REJECTION_REASONS,
} = await import('../../../services/arbitrageScanContract.js');

function ticker(symbol, quoteVolume = 5_000_000) {
  return {
    ok: true,
    data: { symbol, lastPrice: '100', quoteVolume: String(quoteVolume), volume: String(quoteVolume) },
  };
}

function depth(bid, ask, levels = 25) {
  const bids = Array.from({ length: levels }, (_, i) => [String(bid - i * 0.01), '10']);
  const asks = Array.from({ length: levels }, (_, i) => [String(ask + i * 0.01), '10']);
  return { ok: true, data: { bids, asks } };
}

describe('ARB-WP1A Arbitrage analytical contracts', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.PORT = '5002';
    delete process.env.INTERNAL_API_BASE;
  });

  test('getInternalApiBase uses PORT not hardcoded 5002 alone', () => {
    process.env.PORT = '5123';
    expect(getInternalApiBase()).toBe('http://127.0.0.1:5123');
    process.env.INTERNAL_API_BASE = 'http://127.0.0.1:9999/';
    expect(getInternalApiBase()).toBe('http://127.0.0.1:9999');
  });

  test('rejects non-positive net as NON_POSITIVE_NET and never qualifies', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ticker('BTCUSDT') })
      .mockResolvedValueOnce({ ok: true, json: async () => depth(100, 100.05) });

    const { candidates, rejectedCandidates, qualifiedOpportunities } = await detectOpportunities({
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.01,
        maxSpreadPct: 5,
        minVolumeUSDT: 1000,
        feeBps: 10,
        slippageBps: 10,
      },
    });

    expect(qualifiedOpportunities).toEqual([]);
    expect(candidates.length).toBe(0);
    expect(rejectedCandidates.length).toBeGreaterThan(0);
    expect(rejectedCandidates[0].rejectionReason).toBe(REJECTION_REASONS.NON_POSITIVE_NET);
  });

  test('positive net same-market spread remains Spread Candidate not Qualified', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ticker('ETHUSDT') })
      .mockResolvedValueOnce({ ok: true, json: async () => depth(100, 102) });

    const { candidates, qualifiedOpportunities } = await detectOpportunities({
      config: {
        symbols: ['ETHUSDT'],
        minSpreadPct: 0.5,
        maxSpreadPct: 5,
        minVolumeUSDT: 1000,
        feeBps: 10,
        slippageBps: 10,
        opportunityThresholdBps: 1,
        strategies: [{ type: 'spot', enabled: true, minProfitBps: 1 }],
      },
    });

    expect(qualifiedOpportunities).toEqual([]);
    expect(candidates.length).toBe(1);
    expect(candidates[0].classification).toBe('spread_candidate');
    expect(candidates[0].executableArbitrage).toBe(false);
    expect(candidates[0].netProfitUSDT).toBeGreaterThan(0);
  });

  test('below min profit rejects with BELOW_MIN_PROFIT', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ticker('SOLUSDT') })
      .mockResolvedValueOnce({ ok: true, json: async () => depth(100, 100.5) });

    const { candidates, rejectedCandidates, qualifiedOpportunities } = await detectOpportunities({
      config: {
        symbols: ['SOLUSDT'],
        minSpreadPct: 0.1,
        maxSpreadPct: 5,
        minVolumeUSDT: 1000,
        feeBps: 10,
        slippageBps: 10,
        strategies: [{ type: 'spot', enabled: true, minProfitBps: 5000 }],
      },
    });

    expect(qualifiedOpportunities).toEqual([]);
    expect(candidates.length).toBe(0);
    expect(rejectedCandidates[0].rejectionReason).toBe(REJECTION_REASONS.BELOW_MIN_PROFIT);
  });

  test('run() summary never fabricates captured profit or qualified opportunities', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ticker('BTCUSDT') })
      .mockResolvedValueOnce({ ok: true, json: async () => depth(100, 100.05) });

    const result = await run({
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.01,
        maxSpreadPct: 5,
        minVolumeUSDT: 1000,
        feeBps: 10,
        slippageBps: 10,
        strategies: [
          { type: 'triangle', enabled: true, minProfitBps: 30 },
          { type: 'spot', enabled: true, minProfitBps: 20 },
        ],
      },
    });

    expect(result.analyticalMode).toBe('analytical_spread_monitor');
    expect(result.legacy).toBe(false);
    expect(result.contractVersion).toBe('2.0.0-wp1a');
    expect(result._meta.version).toBe('2.0.0-wp1a');
    expect(result.qualifiedOpportunities).toEqual([]);
    expect(result.qualifiedStats.bestProfitBps).toBeNull();
    expect(result.summary.totalProfitUSDT).toBeNull();
    expect(result.execution.supported).toBe(false);
    expect(result.opportunities).toEqual([]);
    expect(result.unsupportedStrategies.some((s) => s.type === 'triangle')).toBe(true);
  });

  test('normalizeScanResult classifies modern persisted marker without forced legacy option', () => {
    const normalized = normalizeScanResult(
      {
        legacy: false,
        contractVersion: '2.0.0-wp1a',
        analyticalMode: 'analytical_spread_monitor',
        candidates: [],
        rejectedCandidates: [],
        qualifiedOpportunities: [],
        timestamp: '2026-07-17T09:12:40.830Z',
      },
      { legacy: true },
    );
    expect(normalized.classification).toBe('modern');
    expect(normalized.legacy).toBe(false);
    expect(normalized.status).toBe('completed');
  });

  test('normalizeScanResult classifies legacy negative opportunities as rejected', () => {
    const normalized = normalizeScanResult({
      timestamp: '2026-07-16T10:00:00.000Z',
      summary: { totalProfitUSDT: -51.16, avgRiskScore: 0, totalOpportunities: 1 },
      opportunities: [
        {
          id: 'x',
          symbol: 'ADAUSDT',
          strategy: 'spot',
          netProfitUSDT: -13.8,
          profitBps: -13.8,
          riskScore: 0,
          path: ['Buy', 'Sell'],
        },
      ],
    });

    expect(normalized.legacy).toBe(true);
    expect(normalized.qualifiedOpportunities).toEqual([]);
    expect(normalized.rejectedCandidates[0].rejectionReason).toBe(
      REJECTION_REASONS.LEGACY_NEGATIVE_ESTIMATE,
    );

    const metrics = buildArbitrageMetricsFromNormalized(normalized, 12, '2026-07-16T10:00:00.000Z');
    expect(metrics.totalScans).toBe(12);
    expect(metrics.netProfitCapturedUSDT).toBeNull();
    expect(metrics.bestProfitBps).toBeNull();
  });

  test('provider failure yields rejected INCOMPLETE_LEGS without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));
    const { rejectedCandidates, qualifiedOpportunities } = await detectOpportunities({
      config: { symbols: ['BTCUSDT'], minVolumeUSDT: 1, minSpreadPct: 0.01, maxSpreadPct: 5 },
    });
    expect(qualifiedOpportunities).toEqual([]);
    expect(rejectedCandidates[0].rejectionReason).toBe(REJECTION_REASONS.INCOMPLETE_LEGS);
  });
});
