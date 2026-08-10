/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  ADAPTER_VERSIONS,
  AGENT_CONTRACT_ROLE,
  ANALYTICAL_AGENT_IDS,
  AUTHORITY_CLASS,
  CANONICAL_AGENT_IDS,
  CONTRACT_VERSION,
  MAX_ENVELOPE_UTF8_BYTES,
  OPPORTUNITY_AGENT_IDS,
  SCHEMA_VERSION,
  canonicalIdentifier,
  isCanonicalUuid,
  validateEvidenceEnvelope,
} from '../../contracts/artemisEvidenceContract.js';
import { mapTrendPersistedRun } from '../../services/artemisEvidenceAdapters/trendAdapter.js';
import { mapArbitragePersistedRun } from '../../services/artemisEvidenceAdapters/arbitrageAdapter.js';
import { mapVolumePersistedRun } from '../../services/artemisEvidenceAdapters/volumeAdapter.js';

const NOW = Date.parse('2026-08-10T12:10:00.000Z');
const TREND_RUN_ID = '11111111-1111-4111-8111-111111111111';
const TREND_AGENT_RECORD_ID = '22222222-2222-4222-8222-222222222222';
const ARB_RUN_ID = '33333333-3333-4333-8333-333333333333';
const VOL_RUN_ID = '44444444-4444-4444-8444-444444444444';
const CORRELATION_ID = '55555555-5555-4555-8555-555555555555';
const DECISION_CONTEXT_ID = '66666666-6666-4666-8666-666666666666';

const EXPECTED_AUTHORITY = Object.freeze({
  technical: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
  trend: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
  pattern: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
  volume: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
  sentiment: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
  fundamental: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
  market_intelligence: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
  price_prediction: AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
  timing: AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
  arbitrage: AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
  risk: AUTHORITY_CLASS.CONTROL_VETO,
  portfolio: AUTHORITY_CLASS.CONTROL_SIZING,
  optimization: AUTHORITY_CLASS.NOT_APPLICABLE,
  liquidity: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
  order: AUTHORITY_CLASS.EXECUTION,
});

function analyticalEnvelope(overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    contractVersion: CONTRACT_VERSION,
    adapterVersion: ADAPTER_VERSIONS.trend,
    agentId: 'trend',
    agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
    authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
    runId: TREND_RUN_ID,
    analysisTimestamp: '2026-08-10T12:00:00.000Z',
    availability: 'available',
    unavailableReason: null,
    lifecycleStatus: 'completed',
    limitations: ['advisory_only'],
    executionClass: 'advisory_only',
    freshness: { status: 'unknown', reasonKey: 'missing_proven_source_timestamp' },
    dataQuality: {
      status: 'degraded',
      sourceAvailability: 'available',
      coverage: 'unavailable',
      completeness: 'unavailable',
      staleness: 'unknown',
      providerDegradation: 'unavailable',
      sampleAdequacy: 'unavailable',
    },
    provenance: { writer: 'test' },
    confidence: {
      availability: 'unavailable',
      kind: 'UNAVAILABLE',
      scale: 'unknown',
      calibrationState: 'unavailable',
      sampleWindow: { availability: 'unavailable' },
    },
    conclusion: {
      direction: 'bullish',
      strength: { value: 72, scale: 'percent_100', provenance: 'trend.raw.trend.confidence' },
    },
    evidence: {
      items: [
        {
          evidenceId: 'trend-adx',
          evidenceType: 'indicator',
          canonicalSource: 'trend.adx.value',
          value: 31.2,
          directionalContribution: 'neutral',
        },
      ],
    },
    ...overrides,
  };
}

function roleEnvelope(agentId, extra = {}) {
  const role = AGENT_CONTRACT_ROLE[agentId];
  return {
    schemaVersion: SCHEMA_VERSION,
    contractVersion: CONTRACT_VERSION,
    adapterVersion: '1.0.0',
    agentId,
    agentRole: role.agentRole,
    authorityClass: role.authorityClass,
    analysisTimestamp: '2026-08-10T12:00:00.000Z',
    availability: extra.availability || 'unavailable',
    unavailableReason: extra.unavailableReason || 'role_extension_not_implemented',
    lifecycleStatus: extra.lifecycleStatus || 'skipped',
    limitations: extra.limitations || ['advisory_only', 'wp_b1_no_adapter'],
    executionClass: extra.executionClass || 'advisory_only',
    freshness: { status: 'unavailable', reasonKey: 'role_extension_not_implemented' },
    dataQuality: {
      status: 'unavailable',
      sourceAvailability: 'unavailable',
      coverage: 'unavailable',
      completeness: 'unavailable',
      staleness: 'unavailable',
      providerDegradation: 'unavailable',
      sampleAdequacy: 'unavailable',
    },
    provenance: { writer: 'contract-fixture' },
    confidence: {
      availability: 'unavailable',
      kind: 'UNAVAILABLE',
      scale: 'unknown',
      calibrationState: 'unavailable',
      sampleWindow: { availability: 'unavailable' },
    },
    ...extra,
  };
}

function hasError(result, code, field) {
  return (result.errors || []).some((error) => error.code === code && (!field || error.field === field || String(error.field).startsWith(field)));
}

describe('Artemis WP-B.1 evidence contract', () => {
  it('accepts a strict 1.0.0 Trend analytical envelope', () => {
    const result = validateEvidenceEnvelope(analyticalEnvelope());
    expect(result.ok).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.bytes).toBeLessThanOrEqual(MAX_ENVELOPE_UTF8_BYTES);
  });

  it('maps all 15 canonical agentIds to role-correct authority without a shared analytical envelope', () => {
    expect(CANONICAL_AGENT_IDS).toHaveLength(15);
    expect(ANALYTICAL_AGENT_IDS).toHaveLength(7);
    expect(OPPORTUNITY_AGENT_IDS).toHaveLength(3);
    for (const agentId of CANONICAL_AGENT_IDS) {
      expect(AGENT_CONTRACT_ROLE[agentId].authorityClass).toBe(EXPECTED_AUTHORITY[agentId]);
      expect(AGENT_CONTRACT_ROLE[agentId].agentRole).toBe(EXPECTED_AUTHORITY[agentId]);
    }
  });

  it('accepts canonical Trend agentId=trend', () => {
    expect(validateEvidenceEnvelope(analyticalEnvelope({ agentId: 'trend' })).ok).toBe(true);
  });

  it('accepts UUID identifiers and explicit unavailable identifier representations', () => {
    expect(isCanonicalUuid(TREND_RUN_ID)).toBe(true);
    expect(validateEvidenceEnvelope(analyticalEnvelope({
      runId: TREND_RUN_ID,
      agentRecordId: TREND_AGENT_RECORD_ID,
      correlationId: CORRELATION_ID,
      decisionContextId: DECISION_CONTEXT_ID,
    })).ok).toBe(true);

    expect(validateEvidenceEnvelope(analyticalEnvelope({
      runId: null,
      agentRecordId: null,
      correlationId: { availability: 'unavailable', reasonKey: 'not_in_source' },
      decisionContextId: 'unavailable',
    })).ok).toBe(true);
  });

  it('rejects non-UUID identifier strings', () => {
    for (const value of ['foo', 'run-1', 'agent123']) {
      const result = validateEvidenceEnvelope(analyticalEnvelope({ runId: value }));
      expect(result.ok).toBe(false);
      expect(hasError(result, 'invalid_uuid_identifier', 'runId')).toBe(true);
    }
    expect(canonicalIdentifier('run-1')).toEqual({ availability: 'unavailable', reasonKey: 'non_canonical_identifier' });
    expect(canonicalIdentifier(TREND_RUN_ID)).toBe(TREND_RUN_ID);
  });

  it('validates dataQuality domains, boolean providerDegradation, and structured coverage', () => {
    const measured = validateEvidenceEnvelope(analyticalEnvelope({
      dataQuality: {
        status: 'ok',
        sourceAvailability: 'available',
        completeness: 'ok',
        staleness: 'fresh',
        providerDegradation: false,
        sampleAdequacy: 'ok',
        coverage: { expected: 48, observed: 48, unit: 'candles' },
      },
    }));
    expect(measured.ok).toBe(true);

    const unavailableCoverage = validateEvidenceEnvelope(analyticalEnvelope({
      dataQuality: {
        status: 'degraded',
        sourceAvailability: 'degraded',
        completeness: 'unavailable',
        staleness: { availability: 'unavailable' },
        providerDegradation: { availability: 'unavailable' },
        sampleAdequacy: 'insufficient',
        coverage: { availability: 'unavailable' },
      },
    }));
    expect(unavailableCoverage.ok).toBe(true);

    const fakePercent = validateEvidenceEnvelope(analyticalEnvelope({
      dataQuality: { status: 'ok', coverage: '80%' },
    }));
    expect(fakePercent.ok).toBe(false);
    expect(hasError(fakePercent, 'invalid_coverage')).toBe(true);

    const badDegradation = validateEvidenceEnvelope(analyticalEnvelope({
      dataQuality: { status: 'ok', providerDegradation: 'timeout-ish' },
    }));
    expect(badDegradation.ok).toBe(false);
    expect(hasError(badDegradation, 'invalid_provider_degradation')).toBe(true);

    const badSample = validateEvidenceEnvelope(analyticalEnvelope({
      dataQuality: { status: 'ok', sampleAdequacy: 'degraded' },
    }));
    expect(badSample.ok).toBe(false);
    expect(hasError(badSample, 'invalid_sample_adequacy')).toBe(true);
  });

  it('validates confidence calibrationState and sampleWindow', () => {
    const validWindow = validateEvidenceEnvelope(analyticalEnvelope({
      confidence: {
        availability: 'available',
        value: 0.5,
        scale: 'unit_interval',
        kind: 'HEURISTIC',
        calibrationState: 'uncalibrated',
        sampleWindow: {
          availability: 'available',
          start: '2026-08-10T10:00:00.000Z',
          end: '2026-08-10T11:00:00.000Z',
          size: 12,
          unit: 'candles',
        },
        provenance: { writer: 'test', path: 'confidence', methodKey: 'explicit_agent_confidence' },
      },
    }));
    expect(validWindow.ok).toBe(true);

    const badCalibration = validateEvidenceEnvelope(analyticalEnvelope({
      confidence: {
        availability: 'unavailable',
        kind: 'UNAVAILABLE',
        calibrationState: 'pretty-sure',
        sampleWindow: { availability: 'unavailable' },
      },
    }));
    expect(badCalibration.ok).toBe(false);
    expect(hasError(badCalibration, 'invalid_calibration_state')).toBe(true);

    const fakeWindow = validateEvidenceEnvelope(analyticalEnvelope({
      confidence: {
        availability: 'unavailable',
        kind: 'UNAVAILABLE',
        calibrationState: 'unavailable',
        sampleWindow: { availability: 'unavailable', size: 99, unit: 'candles' },
      },
    }));
    expect(fakeWindow.ok).toBe(false);
    expect(hasError(fakeWindow, 'sample_window_unavailable_must_not_include_measured_fields')).toBe(true);
  });

  it('validates nested EvidenceItem freshness and provenance with the same sub-schemas', () => {
    const valid = validateEvidenceEnvelope(analyticalEnvelope({
      evidence: {
        items: [{
          evidenceId: 'trend-adx',
          evidenceType: 'indicator',
          canonicalSource: 'trend.adx.value',
          value: 31.2,
          directionalContribution: 'neutral',
          freshness: {
            status: 'fresh',
            reasonKey: 'source_fresh',
            sourceCandleTimestamp: '2026-08-10T11:00:00.000Z',
            timeframe: '1h',
          },
          provenance: { writer: 'trendEvidenceAdapter', source: 'ai_decisions.output_data' },
        }],
      },
    }));
    expect(valid.ok).toBe(true);

    const badFreshness = validateEvidenceEnvelope(analyticalEnvelope({
      evidence: {
        items: [{
          evidenceId: 'trend-adx',
          evidenceType: 'indicator',
          canonicalSource: 'trend.adx.value',
          value: 31.2,
          directionalContribution: 'neutral',
          freshness: { status: 'almost-fresh' },
        }],
      },
    }));
    expect(badFreshness.ok).toBe(false);
    expect(hasError(badFreshness, 'invalid_freshness_status')).toBe(true);

    const badProvenance = validateEvidenceEnvelope(analyticalEnvelope({
      evidence: {
        items: [{
          evidenceId: 'trend-adx',
          evidenceType: 'indicator',
          canonicalSource: 'trend.adx.value',
          value: 31.2,
          directionalContribution: 'neutral',
          provenance: { writer: 'test', leakedBlob: { candles: [] } },
        }],
      },
    }));
    expect(badProvenance.ok).toBe(false);
    expect(hasError(badProvenance, 'unknown_field', 'evidence.items[0].provenance')).toBe(true);
  });

  it('accepts explicit valid confidence exactly 0.5 on an Arbitrage opportunity envelope', () => {
    const result = validateEvidenceEnvelope(analyticalEnvelope({
      agentId: 'arbitrage',
      agentRole: AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
      authorityClass: AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
      adapterVersion: ADAPTER_VERSIONS.arbitrage,
      runId: ARB_RUN_ID,
      confidence: {
        availability: 'available',
        value: 0.5,
        scale: 'unit_interval',
        kind: 'HEURISTIC',
        calibrationState: 'uncalibrated',
        sampleWindow: { availability: 'unavailable' },
        provenance: { writer: 'agent_output', path: 'confidence', methodKey: 'explicit_agent_confidence' },
      },
      conclusion: { direction: 'not_applicable', signal: 'observe' },
      opportunity: { kind: 'spread', availability: 'available' },
    }));
    expect(result.ok).toBe(true);
  });

  it('accepts role-correct unavailable envelopes for Risk, Optimization, Liquidity and Order', () => {
    const risk = validateEvidenceEnvelope(roleEnvelope('risk', {
      control: { kind: 'veto', availability: 'unavailable', outcome: 'unavailable', reasonKey: 'wp_b1_no_risk_adapter' },
      conclusion: { direction: 'not_applicable' },
    }));
    expect(risk.ok).toBe(true);

    const optimization = validateEvidenceEnvelope(roleEnvelope('optimization', {
      availability: 'not_applicable',
      unavailableReason: 'optimization_not_sizing_authority',
      executionClass: 'not_applicable',
      limitations: ['optimization_not_applicable'],
      conclusion: { direction: 'not_applicable' },
    }));
    expect(optimization.ok).toBe(true);

    const liquidity = validateEvidenceEnvelope(roleEnvelope('liquidity', {
      availability: 'blocked',
      unavailableReason: 'liquidity_feasibility_not_implemented',
      feasibility: { availability: 'unavailable', reasonKey: 'wp_b1_no_liquidity_adapter' },
    }));
    expect(liquidity.ok).toBe(true);

    const order = validateEvidenceEnvelope(roleEnvelope('order', {
      availability: 'unavailable',
      unavailableReason: 'order_not_execution_eligible',
      executionClass: 'not_applicable',
      limitations: ['order_execution_only', 'not_execution_eligible'],
    }));
    expect(order.ok).toBe(true);
  });

  it('rejects role-invalid analytical votes on control, feasibility, optimization and order', () => {
    const risk = validateEvidenceEnvelope(roleEnvelope('risk', {
      conclusion: { direction: 'bullish', signal: 'BUY' },
    }));
    expect(risk.ok).toBe(false);
    expect(hasError(risk, 'role_analytical_vote_forbidden')).toBe(true);

    const portfolio = validateEvidenceEnvelope(roleEnvelope('portfolio', {
      conclusion: { direction: 'bullish', signal: 'BUY' },
      allocation: { availability: 'unavailable', reasonKey: 'wp_b1_no_portfolio_adapter' },
    }));
    expect(portfolio.ok).toBe(false);
    expect(hasError(portfolio, 'role_analytical_vote_forbidden')).toBe(true);

    const optimization = validateEvidenceEnvelope(roleEnvelope('optimization', {
      availability: 'not_applicable',
      unavailableReason: 'optimization_not_sizing_authority',
      executionClass: 'not_applicable',
      conclusion: { direction: 'bearish' },
    }));
    expect(optimization.ok).toBe(false);
    expect(hasError(optimization, 'role_analytical_vote_forbidden')).toBe(true);

    const liquidity = validateEvidenceEnvelope(roleEnvelope('liquidity', {
      availability: 'blocked',
      unavailableReason: 'liquidity_feasibility_not_implemented',
      conclusion: { direction: 'bullish' },
    }));
    expect(liquidity.ok).toBe(false);
    expect(hasError(liquidity, 'role_analytical_vote_forbidden')).toBe(true);

    const order = validateEvidenceEnvelope(roleEnvelope('order', {
      unavailableReason: 'order_not_execution_eligible',
      executionClass: 'not_applicable',
      conclusion: { signal: 'SELL' },
    }));
    expect(order.ok).toBe(false);
    expect(hasError(order, 'role_analytical_vote_forbidden')).toBe(true);

    const arbVote = validateEvidenceEnvelope(analyticalEnvelope({
      agentId: 'arbitrage',
      agentRole: AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
      authorityClass: AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
      adapterVersion: ADAPTER_VERSIONS.arbitrage,
      runId: ARB_RUN_ID,
      conclusion: { direction: 'bullish' },
    }));
    expect(arbVote.ok).toBe(false);
    expect(hasError(arbVote, 'arbitrage_not_directional_vote')).toBe(true);
  });

  it('rejects fake measured feasibility while liquidity remains unavailable', () => {
    const result = validateEvidenceEnvelope(roleEnvelope('liquidity', {
      availability: 'blocked',
      unavailableReason: 'liquidity_feasibility_not_implemented',
      feasibility: { availability: 'unavailable', spread: 0.1, depth: 1000 },
    }));
    expect(result.ok).toBe(false);
    expect(hasError(result, 'feasibility_unavailable_must_not_include_measured_fields')).toBe(true);
  });

  it('accepts canonical Trend/Arbitrage/Volume adapter envelopes', () => {
    const trend = mapTrendPersistedRun({
      nowMs: NOW,
      row: { id: TREND_RUN_ID, agent_id: TREND_AGENT_RECORD_ID, created_at: '2026-08-10T12:00:00.000Z' },
      output: {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        timestamp: '2026-08-10T12:00:00.000Z',
        last_candle_timestamp: '2026-08-10T11:00:00.000Z',
        trend: { direction: 'bullish', confidence: 72 },
        adx: { value: 31.4, di_plus: 28, di_minus: 12 },
      },
    });
    expect(validateEvidenceEnvelope(trend.envelope).ok).toBe(true);
    expect(trend.envelope.runId).toBe(TREND_RUN_ID);

    const arb = mapArbitragePersistedRun({
      nowMs: NOW,
      row: { id: ARB_RUN_ID, created_at: '2026-08-10T12:00:00.000Z', confidence: 0.5 },
      output: {
        timestamp: '2026-08-10T12:00:00.000Z',
        confidence: 0.5,
        candidates: [{ symbol: 'BTC/USDT', spreadPct: 0.8 }],
        summary: { spreadCandidates: 1 },
      },
    });
    expect(validateEvidenceEnvelope(arb.envelope).ok).toBe(true);
    expect(arb.envelope.conclusion.direction).toBe('not_applicable');

    const volume = mapVolumePersistedRun({
      nowMs: NOW,
      row: { id: VOL_RUN_ID, created_at: '2026-08-10T12:00:00.000Z', confidence: 0.5 },
      output: {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        timestamp: '2026-08-10T12:00:00.000Z',
        last_candle_timestamp: '2026-08-10T11:00:00.000Z',
        obv: { current: 12 },
        vwap: { current: 101 },
        trading_recommendation: { action: 'BUY', confidence: 68 },
        metadata: { dataPoints: 48 },
      },
    });
    expect(validateEvidenceEnvelope(volume.envelope).ok).toBe(true);
  });

  it('rejects unknown agentId even with plausible authority', () => {
    const result = validateEvidenceEnvelope(analyticalEnvelope({
      agentId: 'some_fake_agent',
      agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
      authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
    }));
    expect(result.ok).toBe(false);
    expect(hasError(result, 'unknown_agent_id', 'agentId')).toBe(true);
  });

  it('rejects legacy agent-N and raw alias agentId', () => {
    const legacy = validateEvidenceEnvelope(analyticalEnvelope({ agentId: 'agent-1' }));
    expect(legacy.ok).toBe(false);
    expect(hasError(legacy, 'unknown_agent_id', 'agentId')).toBe(true);

    const alias = validateEvidenceEnvelope(analyticalEnvelope({ agentId: 'trend_detection' }));
    expect(alias.ok).toBe(false);
    expect(hasError(alias, 'unknown_agent_id', 'agentId')).toBe(true);
  });

  it('rejects unknown top-level fields', () => {
    const result = validateEvidenceEnvelope(analyticalEnvelope({ fakeField: true }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_field');
    expect(result.fields).toContain('fakeField');
  });

  it('rejects unknown nested conclusion, confidence, freshness, dataQuality, provenance and EvidenceItem fields', () => {
    const conclusion = validateEvidenceEnvelope(analyticalEnvelope({
      conclusion: { direction: 'bullish', unexpectedConclusionFlag: true },
    }));
    expect(conclusion.ok).toBe(false);
    expect(hasError(conclusion, 'unknown_field', 'conclusion')).toBe(true);

    const confidence = validateEvidenceEnvelope(analyticalEnvelope({
      confidence: { availability: 'unavailable', kind: 'UNAVAILABLE', unexpectedInternalState: { x: 1 } },
    }));
    expect(confidence.ok).toBe(false);
    expect(hasError(confidence, 'unknown_field', 'confidence')).toBe(true);

    const freshness = validateEvidenceEnvelope(analyticalEnvelope({
      freshness: { status: 'unknown', unexpectedInternalState: { leaked: true } },
    }));
    expect(freshness.ok).toBe(false);
    expect(hasError(freshness, 'unknown_field', 'freshness')).toBe(true);

    const dq = validateEvidenceEnvelope(analyticalEnvelope({
      dataQuality: { status: 'ok', randomPayload: 'nope' },
    }));
    expect(dq.ok).toBe(false);
    expect(hasError(dq, 'unknown_field', 'dataQuality')).toBe(true);

    const provenance = validateEvidenceEnvelope(analyticalEnvelope({
      provenance: { writer: 'trend-adapter', arbitraryRawProviderPayload: { candles: [] } },
    }));
    expect(provenance.ok).toBe(false);
    expect(hasError(provenance, 'unknown_field', 'provenance')).toBe(true);

    const item = validateEvidenceEnvelope(analyticalEnvelope({
      evidence: {
        items: [{
          evidenceId: 'trend-adx',
          evidenceType: 'indicator',
          canonicalSource: 'trend.adx.value',
          value: 31.2,
          directionalContribution: 'neutral',
          internalBlob: { raw: true },
        }],
      },
    }));
    expect(item.ok).toBe(false);
    expect(hasError(item, 'unknown_field', 'evidence.items[0]')).toBe(true);
  });

  it('rejects nested evidence value objects and >32 evidence items', () => {
    const nested = validateEvidenceEnvelope(analyticalEnvelope({
      evidence: {
        items: [{
          evidenceId: 'bad',
          evidenceType: 'metric',
          canonicalSource: 'x',
          value: { nested: true },
          directionalContribution: 'neutral',
        }],
      },
    }));
    expect(nested.ok).toBe(false);
    expect(hasError(nested, 'nested_evidence_value_forbidden')).toBe(true);

    const many = validateEvidenceEnvelope(analyticalEnvelope({
      evidence: {
        items: Array.from({ length: 33 }, (_, i) => ({
          evidenceId: `e-${i}`,
          evidenceType: 'metric',
          canonicalSource: 'x',
          value: i,
          directionalContribution: 'neutral',
        })),
      },
    }));
    expect(many.ok).toBe(false);
    expect(hasError(many, 'evidence_item_limit')).toBe(true);
  });

  it('rejects schema/contract version mismatch', () => {
    const schema = validateEvidenceEnvelope(analyticalEnvelope({ schemaVersion: '2.0.0' }));
    expect(schema.ok).toBe(false);
    expect(hasError(schema, 'bad_schema_version')).toBe(true);

    const contract = validateEvidenceEnvelope(analyticalEnvelope({ contractVersion: 'artemis-evidence-9.9.9' }));
    expect(contract.ok).toBe(false);
    expect(hasError(contract, 'bad_contract_version')).toBe(true);
  });

  it('rejects authority mismatch and forbidden execution semantics', () => {
    const mismatch = validateEvidenceEnvelope(analyticalEnvelope({
      agentId: 'trend',
      agentRole: AUTHORITY_CLASS.EXECUTION,
      authorityClass: AUTHORITY_CLASS.EXECUTION,
    }));
    expect(mismatch.ok).toBe(false);
    expect(hasError(mismatch, 'authority_mismatch')).toBe(true);

    const executable = validateEvidenceEnvelope(analyticalEnvelope({ executionClass: 'executable' }));
    expect(executable.ok).toBe(false);
    expect(hasError(executable, 'forbidden_execution_semantics') || hasError(executable, 'invalid_execution_class')).toBe(true);
  });

  it('rejects secret keys, raw payload keys and oversized envelopes', () => {
    const secret = validateEvidenceEnvelope(analyticalEnvelope({
      provenance: { writer: 'test', api_key: 'should-not-exist' },
    }));
    expect(secret.ok).toBe(false);
    expect(hasError(secret, 'forbidden_secret_keys') || hasError(secret, 'unknown_field', 'provenance')).toBe(true);

    const raw = validateEvidenceEnvelope(analyticalEnvelope({
      evidence: {
        items: [{
          evidenceId: 'x',
          evidenceType: 'metric',
          canonicalSource: 'x',
          value: 1,
          directionalContribution: 'neutral',
          output_data: { leaked: true },
        }],
      },
    }));
    expect(raw.ok).toBe(false);

    const huge = validateEvidenceEnvelope(analyticalEnvelope({
      limitations: ['advisory_only', 'x'.repeat(9000)],
    }));
    expect(huge.ok).toBe(false);
    expect(hasError(huge, 'envelope_too_large')).toBe(true);
  });

  it('keeps Optimization not_applicable, Pattern excluded from emitters, and versions unbumped', () => {
    expect(AGENT_CONTRACT_ROLE.optimization.authorityClass).toBe(AUTHORITY_CLASS.NOT_APPLICABLE);
    expect(AGENT_CONTRACT_ROLE.pattern.authorityClass).toBe(AUTHORITY_CLASS.ANALYTICAL_EVIDENCE);
    expect(ADAPTER_VERSIONS.trend).toBe('1.0.0');
    expect(CONTRACT_VERSION).toBe('artemis-evidence-1.0.0');
    expect(SCHEMA_VERSION).toBe('1.0.0');
  });
});
