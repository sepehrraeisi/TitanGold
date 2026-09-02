/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  AGENT_CONTRACT_ROLE,
  CANONICAL_AGENT_IDS,
  validateEvidenceEnvelope,
} from '../../contracts/artemisEvidenceContract.js';
import { listKnownAliases, resolveArtemisAgentIdentity } from '../../services/artemisAgentIdentity.js';
import {
  mapArbitragePersistedRun,
  mapFundamentalPersistedRun,
  mapLiquidityPersistedRun,
  mapMarketIntelligencePersistedRun,
  mapOptimizationPersistedRun,
  mapOrderPersistedRun,
  mapPatternPersistedRun,
  mapPortfolioPersistedRun,
  mapPricePredictionPersistedRun,
  mapRiskPersistedRun,
  mapSentimentPersistedRun,
  mapTechnicalPersistedRun,
  mapTimingPersistedRun,
  mapTrendPersistedRun,
  mapVolumePersistedRun,
} from '../../services/artemisEvidenceAdapters/index.js';

const NOW = Date.parse('2026-08-10T12:10:00.000Z');
const TS = '2026-08-10T12:00:00.000Z';
const CANDLE = '2026-08-10T11:00:00.000Z';

const MAPPERS = Object.freeze({
  technical: mapTechnicalPersistedRun,
  trend: mapTrendPersistedRun,
  pattern: mapPatternPersistedRun,
  volume: mapVolumePersistedRun,
  sentiment: mapSentimentPersistedRun,
  fundamental: mapFundamentalPersistedRun,
  market_intelligence: mapMarketIntelligencePersistedRun,
  price_prediction: mapPricePredictionPersistedRun,
  timing: mapTimingPersistedRun,
  arbitrage: mapArbitragePersistedRun,
  risk: mapRiskPersistedRun,
  portfolio: mapPortfolioPersistedRun,
  optimization: mapOptimizationPersistedRun,
  liquidity: mapLiquidityPersistedRun,
  order: mapOrderPersistedRun,
});

function runId(suffix) {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(suffix).padStart(12, '0')}`;
}

function row(agentId, suffix) {
  return {
    id: runId(suffix),
    agent_id: runId(`a${suffix}`),
    created_at: TS,
  };
}

function map(agentId, output, extra = {}) {
  return MAPPERS[agentId]({
    nowMs: NOW,
    row: extra.row || row(agentId, extra.suffix || agentId.slice(0, 8).padEnd(8, '0')),
    output,
    input: extra.input || { symbol: 'BTC/USDT', timeframe: '1h' },
    persistedConfidence: extra.persistedConfidence,
  });
}

function expectValid(mapped) {
  expect(mapped.ok).toBe(true);
  const validation = validateEvidenceEnvelope(mapped.envelope, { nowMs: NOW });
  if (!validation.ok) {
    throw new Error(`envelope invalid: ${JSON.stringify(validation.errors || validation)}`);
  }
  return mapped.envelope;
}

function expectNoFakeZero(envelope) {
  expect(envelope.confidence?.value === 0).toBe(false);
}

function expectNoExecutionAuth(envelope) {
  const blob = JSON.stringify(envelope);
  expect(envelope.executionClass).not.toBe('executable');
  expect(envelope.executionClass).not.toBe('live');
  expect(envelope.executionClass).not.toBe('approved_for_execution');
  expect(envelope).not.toHaveProperty('approvedForExecution');
  expect(envelope).not.toHaveProperty('executionEligible');
  expect(blob).not.toMatch(/approved_for_execution|"LIVE"|EXECUTE/);
}

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

const EXPECTED_AUTHORITY = Object.fromEntries(
  Object.entries(AGENT_CONTRACT_ROLE).map(([key, value]) => [key, value.authorityClass]),
);

const DIRECTIONAL_FORBIDDEN = new Set(['risk', 'portfolio', 'optimization', 'liquidity', 'order', 'arbitrage']);
const PREDICTIVE_CONFIDENCE_FORBIDDEN = new Set(['risk', 'portfolio', 'optimization', 'liquidity', 'order']);

describe('Artemis Stage 3 agent contract compatibility', () => {
  it('covers exactly the canonical 15 Agent keys', () => {
    expect(CANONICAL_AGENT_IDS).toHaveLength(15);
    expect(Object.keys(MAPPERS).sort()).toEqual([...CANONICAL_AGENT_IDS].sort());
  });

  it.each(CANONICAL_AGENT_IDS)('%s emits canonical identity, authority, provenance and a valid envelope', (agentId) => {
    const mapped = map(agentId, AVAILABLE[agentId], { suffix: `${agentId}1`.slice(0, 12) });
    const envelope = expectValid(mapped);
    expect(envelope.agentId).toBe(agentId);
    expect(envelope.authorityClass).toBe(EXPECTED_AUTHORITY[agentId]);
    expect(envelope.agentRole).toBe(EXPECTED_AUTHORITY[agentId]);
    expect(envelope.provenance.writer).toMatch(new RegExp(`${agentId}|adapter|agent_output`, 'i'));
    expect(envelope.provenance.adapterVersion).toBe('1.0.0');
    expect(envelope.analysisTimestamp).toBe(TS);
    expect(envelope.analysisTimestamp).not.toBe(new Date(NOW).toISOString());
    expect(envelope.freshness).toBeTruthy();
    expect(envelope.dataQuality).toBeTruthy();
    expect(envelope.confidence).toBeTruthy();
    expectNoFakeZero(envelope);
    expectNoExecutionAuth(envelope);
    if (DIRECTIONAL_FORBIDDEN.has(agentId)) {
      expect(['not_applicable', 'unavailable', undefined]).toContain(envelope.conclusion?.direction);
      expect(String(envelope.conclusion?.signal || '')).not.toMatch(/^(BUY|SELL|EXECUTE|LONG|SHORT)$/i);
    }
    if (PREDICTIVE_CONFIDENCE_FORBIDDEN.has(agentId)) {
      expect(envelope.confidence.availability).toBe('unavailable');
      expect(['UNAVAILABLE', undefined]).toContain(envelope.confidence.kind);
    }
  });

  it.each(CANONICAL_AGENT_IDS)('%s maps missing/failure without fake success', (agentId) => {
    const mapped = map(agentId, FAILURE[agentId], { suffix: `${agentId}2`.slice(0, 12) });
    const envelope = expectValid(mapped);
    expect(envelope.availability).not.toBe('available');
    expect(envelope.unavailableReason).toBeTruthy();
    expect(envelope.confidence.availability).toBe('unavailable');
    expect(typeof envelope.confidence.value).not.toBe('number');
    if (envelope.conclusion) {
      expect(['bullish', 'bearish', 'sideways', 'neutral']).not.toContain(envelope.conclusion.direction);
    }
    expectNoExecutionAuth(envelope);
  });

  it('rejects unknown top-level fields on a compatible envelope', () => {
    const mapped = map('trend', AVAILABLE.trend, { suffix: 'unknownfield' });
    const invalid = validateEvidenceEnvelope({ ...mapped.envelope, extraField: true }, { nowMs: NOW });
    expect(invalid.ok).toBe(false);
  });

  it('does not invent aliases and resolves only repository aliases', () => {
    const aliases = listKnownAliases();
    expect(aliases.map((row) => row.alias).sort()).toEqual([
      'arbitrage',
      'fundamental',
      'fundamental_analysis',
      'liquidity',
      'liquidity_analysis',
      'market_intelligence',
      'market_timing',
      'optimization',
      'order',
      'order_management',
      'pattern',
      'pattern_recognition',
      'portfolio',
      'portfolio_allocation',
      'portfolio_management',
      'price_prediction',
      'risk',
      'risk_management',
      'sentiment',
      'sentiment_analysis',
      'technical',
      'technical_analysis',
      'timing',
      'trend',
      'trend_detection',
      'volume',
      'volume_analysis',
    ]);
    expect(resolveArtemisAgentIdentity('agent-1').status).toBe('legacy_unavailable');
    expect(resolveArtemisAgentIdentity('made_up_agent').status).toBe('unknown');
  });

  it('keeps Technical/Pattern/Timing fail-closed without proven source+candle', () => {
    const technical = expectValid(map('technical', {
      ...AVAILABLE.technical,
      last_candle_timestamp: undefined,
      _meta: { source: 'mock' },
    }, { suffix: 'techfail0001' }));
    expect(technical.unavailableReason).toBe('mock_or_placeholder_source');

    const pattern = expectValid(map('pattern', {
      result: { dominant_signal: 'bullish' },
      meta: { source: 'realtime' },
    }, { suffix: 'patfail00001' }));
    expect(pattern.unavailableReason).toBe('mock_or_placeholder_source');

    const timing = expectValid(map('timing', {
      signal: 'buy',
      _meta: { source: 'timing_agent' },
    }, { suffix: 'timefail0001' }));
    expect(timing.unavailableReason).toBe('mock_or_placeholder_source');
  });

  it('maps Market Intelligence BUY to direction only', () => {
    const envelope = expectValid(map('market_intelligence', AVAILABLE.market_intelligence, { suffix: 'mibuy0000001' }));
    expect(envelope.availability).toBe('available');
    expect(envelope.conclusion.direction).toBe('bullish');
    expect(envelope.conclusion.signal).toBeFalsy();
    expect(envelope.allocation).toBeUndefined();
  });

  it('maps Risk as veto/limit without a directional vote', () => {
    const high = expectValid(map('risk', AVAILABLE.risk, { suffix: 'riskhigh0001' }));
    expect(high.control.kind).toBe('veto');
    expect(high.control.outcome).toBe('reject');
    expect(high.conclusion.direction).toBe('not_applicable');
    expect(high.confidence.availability).toBe('unavailable');
    expect(high.correlationFamily).toBe('account_state_family');

    const low = expectValid(map('risk', {
      analysis: { overall_risk_level: 'LOW', overall_risk_score: 12 },
    }, { suffix: 'risklow00001' }));
    expect(low.control.outcome).toBe('pass');
    expect(low.conclusion.direction).toBe('not_applicable');
  });

  it('maps Portfolio weights without buy/sell or a fabricated recommended size', () => {
    const envelope = expectValid(map('portfolio', AVAILABLE.portfolio, { suffix: 'portavail001' }));
    expect(envelope.allocation.availability).toBe('available');
    expect(envelope.allocation.recommended).toBeUndefined();
    expect(envelope.conclusion.direction).toBe('not_applicable');
    expect(envelope.evidence.items.length).toBeGreaterThan(0);
    expect(envelope.evidence.items.every((item) => item.directionalContribution === 'not_applicable')).toBe(true);
  });

  it('keeps Optimization not_applicable even when native output says BUY', () => {
    const envelope = expectValid(map('optimization', AVAILABLE.optimization, { suffix: 'optbuy000001' }));
    expect(envelope.availability).toBe('not_applicable');
    expect(envelope.executionClass).toBe('not_applicable');
    expect(envelope.conclusion.direction).toBe('not_applicable');
    expect(JSON.stringify(envelope)).not.toMatch(/"BUY"|"SELL"/);
  });

  it('keeps Liquidity blocked without fabricated spread/depth', () => {
    const envelope = expectValid(map('liquidity', AVAILABLE.liquidity, { suffix: 'liqblock0001' }));
    expect(envelope.availability).toBe('blocked');
    expect(envelope.feasibility.availability).toBe('unavailable');
    expect(envelope.feasibility.spread).toBeUndefined();
    expect(envelope.feasibility.depth).toBeUndefined();
    expect(envelope.conclusion.direction).toBe('not_applicable');
    expect(envelope.confidence.availability).toBe('unavailable');
  });

  it('maps Order as execution metadata only', () => {
    const envelope = expectValid(map('order', AVAILABLE.order, { suffix: 'ordermeta001' }));
    expect(envelope.availability).toBe('available');
    expect(envelope.executionClass).toBe('none');
    expect(envelope.conclusion.direction).toBe('not_applicable');
    expect(envelope.recommendedNextActionClass).toBe('not_applicable');
    expect(JSON.stringify(envelope.conclusion || {})).not.toMatch(/BUY|SELL|EXECUTE|LIVE/);
  });

  it('does not fabricate observation time when no defensible timestamp exists', () => {
    const observationIso = new Date(NOW).toISOString();
    for (const agentId of CANONICAL_AGENT_IDS) {
      const mapped = MAPPERS[agentId]({
        nowMs: NOW,
        row: { id: runId(`${agentId}nts`.slice(0, 12)) },
        output: { signal: 'bullish', confidence: 0.99, recommendation: 'BUY' },
        input: { symbol: 'BTC/USDT', timeframe: '1h' },
      });
      expect(mapped.ok).toBe(false);
      expect(mapped.envelope).toBeUndefined();
      const blob = JSON.stringify(mapped);
      expect(blob).not.toContain(observationIso);
      expect(blob).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    }
  });

  it('does not fabricate observation time from a malformed timestamp', () => {
    const observationIso = new Date(NOW).toISOString();
    const mapped = map('technical', {
      timestamp: 'not-a-timestamp',
      last_candle_timestamp: 'also-bad',
      signal: 'bullish',
      confidence: 0.8,
      _meta: { timestamp: 'garbage', dataProvider: 'mexc' },
    }, {
      row: {
        id: runId('badts0000001'),
        agent_id: runId('badagent0001'),
        created_at: 'not-iso',
      },
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.reason).toBe('analysis_timestamp_unavailable');
    expect(mapped.envelope).toBeUndefined();
    expect(JSON.stringify(mapped)).not.toContain(observationIso);
    expect(JSON.stringify(mapped)).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  it('preserves a genuine persisted created_at as analysisTimestamp', () => {
    const envelope = expectValid(map('risk', {
      analysis: { overall_risk_level: 'MODERATE', overall_risk_score: 41 },
    }, { suffix: 'createdonly01' }));
    expect(envelope.analysisTimestamp).toBe(TS);
    expect(envelope.freshness.status).toBe('unknown');
    expect(envelope.freshness.reasonKey).toBe('missing_proven_source_timestamp');
  });

  it('preserves an explicit Agent output timestamp over observation time', () => {
    const envelope = expectValid(map('trend', AVAILABLE.trend, { suffix: 'keepagentts1' }));
    expect(envelope.analysisTimestamp).toBe(TS);
    expect(envelope.freshness.analysisTimestamp).toBe(TS);
    expect(envelope.freshness.sourceCandleTimestamp).toBe(CANDLE);
  });

  it('keeps Liquidity non-directional, non-executable and free of fabricated book fields', () => {
    const envelope = expectValid(map('liquidity', AVAILABLE.liquidity, { suffix: 'liqclassd001' }));
    expect(envelope.authorityClass).toBe('execution_feasibility');
    expect(envelope.availability).toBe('blocked');
    expect(envelope.executionClass).toBe('none');
    expect(envelope.conclusion.direction).toBe('not_applicable');
    expect(envelope.feasibility.spread).toBeUndefined();
    expect(envelope.feasibility.depth).toBeUndefined();
    expect(envelope.feasibility.maxFeasibleSize).toBeUndefined();
    expect(envelope.feasibility.bookTimestamp).toBeUndefined();
    expect(envelope.confidence.value).toBeFalsy();
  });

  it('keeps Optimization not_applicable without promoting backtest BUY/SELL to sizing authority', () => {
    const envelope = expectValid(map('optimization', {
      timestamp: TS,
      recommendation: 'SELL',
      score: 88,
      best_parameters: { fastPeriod: 8 },
    }, { suffix: 'optclassc001' }));
    expect(envelope.authorityClass).toBe('not_applicable');
    expect(envelope.availability).toBe('not_applicable');
    expect(envelope.executionClass).toBe('not_applicable');
    expect(envelope.allocation).toBeUndefined();
    expect(envelope.control).toBeUndefined();
    expect(envelope.conclusion.direction).toBe('not_applicable');
    expect(JSON.stringify(envelope)).not.toMatch(/"BUY"|"SELL"/);
  });

  it('does not treat trend strength, risk score or liquidity stub confidence as predictive confidence', () => {
    const trend = expectValid(map('trend', AVAILABLE.trend, { suffix: 'trendconf001' }));
    expect(trend.confidence.availability).toBe('unavailable');
    expect(trend.conclusion.strength.value).toBe(72);

    const risk = expectValid(map('risk', AVAILABLE.risk, { suffix: 'riskconf0001' }));
    expect(risk.confidence.availability).toBe('unavailable');

    const liquidity = expectValid(map('liquidity', AVAILABLE.liquidity, { suffix: 'liqconf00001' }));
    expect(liquidity.confidence.availability).toBe('unavailable');
    expect(liquidity.confidence.value).toBeFalsy();
  });
});
