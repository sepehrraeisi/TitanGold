/**
 * @jest-environment node
 */
/**
 * Artemis WP-C.1 — ArtemisDecision contract + deterministic admission tests.
 */
import { describe, expect, it } from '@jest/globals';
import {
  ADAPTER_VERSIONS,
  AUTHORITY_CLASS,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  CORRELATION_FAMILY,
  SCHEMA_VERSION as EVIDENCE_SCHEMA_VERSION,
  validateEvidenceEnvelope,
} from '../../contracts/artemisEvidenceContract.js';
import {
  ALLOCATION_AVAILABILITY,
  CLASSIFICATION,
  CONFLICT_STATE,
  CONFIRMATION_SEMANTICS,
  DECISION_CONTRACT_VERSION,
  DECISION_SCHEMA_VERSION,
  DIRECTION_OR_ABSTAIN,
  EVIDENCE_ADMISSION_STATE,
  LIQUIDITY_STATUS,
  MATURITY_STAGE,
  RISK_STATUS,
  SYNTHESIS_OUTCOME,
  buildContractOnlyArtemisDecision,
  validateArtemisDecision,
} from '../../contracts/artemisDecisionContract.js';
import {
  ADMISSION_REASON,
  admitEvidenceEnvelope,
  admitEvidenceSet,
} from '../../services/artemisEvidenceAdmissionService.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TREND_RUN = '11111111-1111-4111-8111-111111111111';
const VOLUME_RUN = '22222222-2222-4222-8222-222222222222';
const ARB_RUN = '33333333-3333-4333-8333-333333333333';
const RISK_RUN = '44444444-4444-4444-8444-444444444444';

const CTX = Object.freeze({
  symbol: 'BTC/USDT',
  venue: 'mexc',
  marketType: 'spot',
  timeframe: '1h',
});

function unavailableConfidence(reasonKey = 'test_unavailable') {
  return {
    availability: 'unavailable',
    kind: 'UNAVAILABLE',
    scale: 'unknown',
    calibrationState: 'unavailable',
    reasonKey,
    provenance: { writer: 'test', methodKey: 'unit' },
  };
}

function baseEnvelope(agentId, role, overrides = {}) {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    adapterVersion: ADAPTER_VERSIONS[agentId] || '1.0.0',
    agentId,
    agentRole: role,
    authorityClass: role,
    runId: overrides.runId || TREND_RUN,
    analysisTimestamp: '2026-08-10T12:00:00.000Z',
    availability: 'available',
    unavailableReason: null,
    lifecycleStatus: 'completed',
    limitations: ['advisory_only'],
    executionClass: 'advisory_only',
    freshness: { status: 'fresh', reasonKey: 'test_fresh' },
    dataQuality: {
      status: 'ok',
      sourceAvailability: 'available',
      coverage: 'unavailable',
      completeness: 'ok',
      staleness: 'fresh',
      providerDegradation: false,
      sampleAdequacy: 'ok',
      knownLimitationKeys: ['advisory_only'],
    },
    provenance: { writer: 'test', source: 'unit' },
    confidence: unavailableConfidence(),
    symbol: 'BTC/USDT',
    timeframe: '1h',
    venue: 'mexc',
    marketType: 'spot',
    correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
    conclusion: {
      direction: 'bullish',
      strength: { value: 70, scale: 'percent_100', provenance: 'test.strength' },
    },
    evidence: {
      items: [
        {
          evidenceId: `${agentId}-item`,
          evidenceType: 'indicator',
          canonicalSource: `${agentId}.test`,
          value: 1,
          directionalContribution: 'supports',
        },
      ],
    },
    ...overrides,
  };
}

function trendEnvelope(overrides = {}) {
  return baseEnvelope('trend', AUTHORITY_CLASS.ANALYTICAL_EVIDENCE, {
    runId: TREND_RUN,
    adapterVersion: ADAPTER_VERSIONS.trend,
    ...overrides,
  });
}

function volumeEnvelope(overrides = {}) {
  return baseEnvelope('volume', AUTHORITY_CLASS.ANALYTICAL_EVIDENCE, {
    runId: VOLUME_RUN,
    adapterVersion: ADAPTER_VERSIONS.volume,
    correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
    ...overrides,
  });
}

function arbitrageEnvelope(overrides = {}) {
  return baseEnvelope('arbitrage', AUTHORITY_CLASS.OPPORTUNITY_FORECAST, {
    runId: ARB_RUN,
    adapterVersion: ADAPTER_VERSIONS.arbitrage,
    correlationFamily: CORRELATION_FAMILY.SPREAD_MONITOR,
    conclusion: undefined,
    opportunity: {
      kind: 'spread',
      availability: 'available',
      horizon: 'intraday',
    },
    evidence: {
      items: [
        {
          evidenceId: 'arb-spread',
          evidenceType: 'spread',
          canonicalSource: 'arbitrage.spread',
          value: 0.42,
          directionalContribution: 'not_applicable',
        },
      ],
    },
    ...overrides,
  });
}

describe('WP-C.1 ArtemisDecision contract', () => {
  it('accepts a valid minimal contract-only decision', () => {
    const decision = buildContractOnlyArtemisDecision({
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      symbol: 'BTC/USDT',
      timeframe: '1h',
    });
    const result = validateArtemisDecision(decision);
    expect(result.ok).toBe(true);
    expect(decision.decisionEligible).toBe(false);
    expect(decision.executionEligible).toBe(false);
    expect(decision.schemaVersion).toBe(DECISION_SCHEMA_VERSION);
    expect(decision.contractVersion).toBe(DECISION_CONTRACT_VERSION);
  });

  it('accepts a valid full decision with evidence refs', () => {
    const decision = buildContractOnlyArtemisDecision({
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      expiresAt: '2026-08-10T13:00:00.000Z',
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venue: 'mexc',
      marketType: 'spot',
      timeframe: '1h',
      analysisHorizon: 'intraday',
      sourceWindow: { start: '2026-08-10T11:00:00.000Z', end: '2026-08-10T12:00:00.000Z' },
      evidenceRefs: [
        {
          agentId: 'trend',
          runId: TREND_RUN,
          evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
          role: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
          correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
          freshness: 'fresh',
          availability: 'available',
          admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED,
          admissionReason: ADMISSION_REASON.VALID_ANALYTICAL_EVIDENCE,
          confirmationSemantics: CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE,
        },
      ],
      synthesisOutcome: SYNTHESIS_OUTCOME.UNSPECIFIED,
      direction: DIRECTION_OR_ABSTAIN.UNAVAILABLE,
      conflictState: CONFLICT_STATE.NONE,
      riskStatus: RISK_STATUS.UNAVAILABLE,
      liquidityStatus: LIQUIDITY_STATUS.UNAVAILABLE,
      confidence: {
        availability: 'available',
        value: 0.61,
        scale: 'unit_interval',
        kind: 'HEURISTIC',
        calibrationState: 'uncalibrated',
        provenance: { writer: 'test', methodKey: 'unit' },
      },
    });
    expect(validateArtemisDecision(decision).ok).toBe(true);
  });

  it.each([
    ['missing decisionId', { decisionId: undefined }],
    ['unknown top-level', { unexpectedField: true }],
    ['invalid timestamp', { createdAt: 'not-iso' }],
    ['invalid time ordering', { analysisAt: '2026-08-10T12:00:00.000Z', expiresAt: '2026-08-10T11:00:00.000Z' }],
    ['invalid uuid', { decisionId: 'not-a-uuid' }],
  ])('rejects %s', (_label, patch) => {
    const decision = buildContractOnlyArtemisDecision({
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      ...patch,
    });
    if (Object.prototype.hasOwnProperty.call(patch, 'decisionId') && patch.decisionId === undefined) {
      delete decision.decisionId;
    }
    if (patch.unexpectedField) decision.unexpectedField = true;
    const result = validateArtemisDecision(decision);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown nested evidenceRef fields', () => {
    const decision = buildContractOnlyArtemisDecision({
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: [{ agentId: 'trend', rawPayload: { secret: 1 } }],
    });
    const result = validateArtemisDecision(decision);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.errors)).toContain('unknown_field');
  });

  it('rejects oversized evidenceRefs array', () => {
    const decision = buildContractOnlyArtemisDecision({
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: Array.from({ length: 33 }, (_, i) => ({
        agentId: 'trend',
        runId: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
        admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED,
      })),
    });
    expect(validateArtemisDecision(decision).ok).toBe(false);
  });

  it.each([
    ['decisionEligible true', { decisionEligible: true }],
    ['executionEligible true', { executionEligible: true }],
    ['legacy approved', { approved: true }],
    ['approvedForExecution true', { approvedForExecution: true }],
    ['legacy action BUY', { action: 'BUY' }],
  ])('rejects forbidden eligibility/legacy field: %s', (_label, patch) => {
    const decision = buildContractOnlyArtemisDecision({
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
    });
    Object.assign(decision, patch);
    const result = validateArtemisDecision(decision);
    expect(result.ok).toBe(false);
  });

  it('preserves unavailable confidence and does not invent 0.5', () => {
    const decision = buildContractOnlyArtemisDecision({
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
    });
    expect(decision.confidence.availability).toBe('unavailable');
    expect(decision.confidence.value).toBeUndefined();
    expect(validateArtemisDecision(decision).ok).toBe(true);
  });

  it('rejects available confidence without provenance', () => {
    const decision = buildContractOnlyArtemisDecision({
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      confidence: {
        availability: 'available',
        value: 0.5,
        scale: 'unit_interval',
        kind: 'HEURISTIC',
      },
    });
    expect(validateArtemisDecision(decision).ok).toBe(false);
  });
});

describe('WP-C.1 deterministic evidence admission', () => {
  it('validates fixture envelopes against frozen WP-B.1 contract', () => {
    expect(validateEvidenceEnvelope(trendEnvelope()).ok).toBe(true);
    expect(validateEvidenceEnvelope(volumeEnvelope()).ok).toBe(true);
    expect(validateEvidenceEnvelope(arbitrageEnvelope()).ok).toBe(true);
  });

  it('admits valid Trend as directional candidate', () => {
    const result = admitEvidenceEnvelope(CTX, trendEnvelope());
    expect(result.admissionState).toBe(EVIDENCE_ADMISSION_STATE.ADMITTED);
    expect(result.confirmationSemantics).toBe(CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE);
    expect(result.evidenceRef.correlationFamily).toBe(CORRELATION_FAMILY.OHLCV_CANDLE);
  });

  it('admits valid Volume as directional candidate and preserves OHLCV family', () => {
    const result = admitEvidenceEnvelope(CTX, volumeEnvelope());
    expect(result.admissionState).toBe(EVIDENCE_ADMISSION_STATE.ADMITTED);
    expect(result.confirmationSemantics).toBe(CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE);
    expect(result.evidenceRef.correlationFamily).toBe(CORRELATION_FAMILY.OHLCV_CANDLE);
  });

  it('admits Arbitrage as opportunity context, not directional confirmation', () => {
    const result = admitEvidenceEnvelope(CTX, arbitrageEnvelope());
    expect(result.admissionState).toBe(EVIDENCE_ADMISSION_STATE.ADMITTED);
    expect(result.confirmationSemantics).toBe(CONFIRMATION_SEMANTICS.OPPORTUNITY_CONTEXT);
    expect(result.admissionReason).toBe(ADMISSION_REASON.VALID_OPPORTUNITY_CONTEXT);
  });

  it('keeps unavailable distinct from neutral', () => {
    const result = admitEvidenceEnvelope(CTX, trendEnvelope({
      availability: 'unavailable',
      unavailableReason: 'no_run',
      lifecycleStatus: 'skipped',
      conclusion: { direction: 'unavailable' },
    }));
    expect(result.admissionState).toBe(EVIDENCE_ADMISSION_STATE.EXCLUDED);
    expect(result.admissionReason).toBe(ADMISSION_REASON.UNAVAILABLE);
    expect(result.confirmationSemantics).toBe(CONFIRMATION_SEMANTICS.NONE);
  });

  it('excludes failed evidence as not neutral', () => {
    const result = admitEvidenceEnvelope(CTX, trendEnvelope({
      lifecycleStatus: 'failed',
      availability: 'available',
    }));
    // failed + available is unusual; still excluded by FAILED lifecycle
    expect(result.admissionReason).toBe(ADMISSION_REASON.FAILED);
    expect(result.confirmationSemantics).toBe(CONFIRMATION_SEMANTICS.NONE);
  });

  it('marks stale evidence non-confirming, not fresh', () => {
    const result = admitEvidenceEnvelope(CTX, trendEnvelope({
      freshness: { status: 'stale', reasonKey: 'too_old' },
      dataQuality: {
        status: 'degraded',
        sourceAvailability: 'available',
        coverage: 'unavailable',
        completeness: 'ok',
        staleness: 'stale',
        providerDegradation: false,
        sampleAdequacy: 'ok',
      },
    }));
    expect(result.admissionState).toBe(EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING);
    expect(result.admissionReason).toBe(ADMISSION_REASON.STALE);
    expect(result.evidenceRef.freshness).toBe('stale');
  });

  it('keeps unknown freshness unknown/non-confirming', () => {
    const result = admitEvidenceEnvelope(CTX, trendEnvelope({
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
    }));
    expect(result.admissionState).toBe(EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING);
    expect(result.admissionReason).toBe(ADMISSION_REASON.FRESHNESS_UNKNOWN);
    expect(result.evidenceRef.freshness).toBe('unknown');
  });

  it('excludes mock/placeholder from confirming evidence', () => {
    const result = admitEvidenceEnvelope(CTX, trendEnvelope({
      limitations: ['advisory_only', 'mock_or_placeholder_source'],
      dataQuality: {
        status: 'insufficient',
        sourceAvailability: 'unavailable',
        coverage: 'unavailable',
        completeness: 'unavailable',
        staleness: 'unknown',
        providerDegradation: true,
        sampleAdequacy: 'insufficient',
        knownLimitationKeys: ['mock_or_placeholder_source'],
      },
    }));
    expect([ADMISSION_REASON.MOCK_OR_PLACEHOLDER, ADMISSION_REASON.DATA_QUALITY_BLOCKED]).toContain(result.admissionReason);
    expect(result.confirmationSemantics).toBe(CONFIRMATION_SEMANTICS.NONE);
  });

  it('rejects unknown Agent and legacy agent-N', () => {
    const unknown = admitEvidenceEnvelope(CTX, trendEnvelope({ agentId: 'not_an_agent' }));
    expect(unknown.admissionReason).toBe(ADMISSION_REASON.UNKNOWN_AGENT);
    const legacy = admitEvidenceEnvelope(CTX, trendEnvelope({ agentId: 'agent-1' }));
    expect(legacy.admissionReason).toBe(ADMISSION_REASON.LEGACY_AGENT_N);
  });

  it('excludes control roles from analytical admission', () => {
    const risk = admitEvidenceEnvelope(CTX, baseEnvelope('risk', AUTHORITY_CLASS.CONTROL_VETO, {
      runId: RISK_RUN,
      correlationFamily: CORRELATION_FAMILY.ACCOUNT_STATE,
      conclusion: undefined,
      control: { kind: 'veto', availability: 'unavailable', outcome: 'unavailable', reasonKey: 'not_wired' },
      availability: 'unavailable',
      unavailableReason: 'control_not_in_c1',
      lifecycleStatus: 'skipped',
      limitations: ['advisory_only', 'wp_c1_control_excluded'],
      freshness: { status: 'unavailable', reasonKey: 'control_not_in_c1' },
      dataQuality: {
        status: 'unavailable',
        sourceAvailability: 'unavailable',
        coverage: 'unavailable',
        completeness: 'unavailable',
        staleness: 'unavailable',
        providerDegradation: 'unavailable',
        sampleAdequacy: 'unavailable',
      },
    }));
    // unavailable control may fail schema or be excluded; must not be directional
    expect(risk.confirmationSemantics).toBe(CONFIRMATION_SEMANTICS.NONE);
    expect([
      ADMISSION_REASON.ROLE_NOT_ADMISSIBLE,
      ADMISSION_REASON.UNAVAILABLE,
      ADMISSION_REASON.INVALID_SCHEMA,
    ]).toContain(risk.admissionReason);
  });

  it('excludes symbol/context mismatch without coercion', () => {
    const result = admitEvidenceEnvelope(CTX, trendEnvelope({ symbol: 'ETH/USDT' }));
    expect(result.admissionState).toBe(EVIDENCE_ADMISSION_STATE.EXCLUDED);
    expect(result.admissionReason).toBe(ADMISSION_REASON.CONTEXT_INCOMPATIBLE);
    expect(result.contextCompatibility.compatible).toBe(false);
  });

  it('handles duplicate references deterministically', () => {
    const set = admitEvidenceSet(CTX, [trendEnvelope(), trendEnvelope()]);
    expect(set.results).toHaveLength(2);
    expect(set.results[0].admissionState).toBe(EVIDENCE_ADMISSION_STATE.ADMITTED);
    expect(set.results[1].admissionReason).toBe(ADMISSION_REASON.DUPLICATE_REFERENCE);
  });

  it('preserves correlation families for trend+volume without scoring', () => {
    const set = admitEvidenceSet(CTX, [trendEnvelope(), volumeEnvelope(), arbitrageEnvelope()]);
    expect(set.correlationFamilies).toEqual(expect.arrayContaining([
      CORRELATION_FAMILY.OHLCV_CANDLE,
      CORRELATION_FAMILY.SPREAD_MONITOR,
    ]));
    expect(set.counts.directionalCandidates).toBe(2);
    expect(set.counts.opportunityContext).toBe(1);
    expect(set.decisionEligible).toBe(false);
    expect(set.executionEligible).toBe(false);
    expect(set.approvedForExecution).toBe(false);
  });

  it('never emits execution authorization from admission', () => {
    const set = admitEvidenceSet(CTX, [
      trendEnvelope(),
      volumeEnvelope({ freshness: { status: 'unknown', reasonKey: 'x' }, dataQuality: {
        status: 'degraded',
        sourceAvailability: 'available',
        coverage: 'unavailable',
        completeness: 'unavailable',
        staleness: 'unknown',
        providerDegradation: 'unavailable',
        sampleAdequacy: 'unavailable',
      } }),
      arbitrageEnvelope(),
      trendEnvelope({ agentId: 'agent-3' }),
    ]);
    expect(set.decisionEligible).toBe(false);
    expect(set.executionEligible).toBe(false);
    for (const row of set.results) {
      expect(row.evidenceRef?.approvedForExecution).toBeUndefined();
      expect(row.confirmationSemantics === CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE
        || row.confirmationSemantics === CONFIRMATION_SEMANTICS.OPPORTUNITY_CONTEXT
        || row.confirmationSemantics === CONFIRMATION_SEMANTICS.NON_CONFIRMING
        || row.confirmationSemantics === CONFIRMATION_SEMANTICS.NONE).toBe(true);
    }
  });

  it('builds a non-executable ArtemisDecision from admitted refs', () => {
    const set = admitEvidenceSet(CTX, [trendEnvelope(), volumeEnvelope(), arbitrageEnvelope()]);
    const decision = buildContractOnlyArtemisDecision({
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      symbol: CTX.symbol,
      venue: CTX.venue,
      marketType: CTX.marketType,
      timeframe: CTX.timeframe,
      evidenceRefs: set.evidenceRefs,
      limitations: [
        'wp_c1_contract_only',
        'no_synthesis',
        'single_ohlcv_family_insufficient_for_multi_family_claim',
        'decision_eligible_false',
        'execution_eligible_false',
      ],
      classification: CLASSIFICATION.CONTRACT_ONLY,
      maturityStage: MATURITY_STAGE.CONTRACT_ONLY,
      allocationProposal: {
        availability: ALLOCATION_AVAILABILITY.UNAVAILABLE,
        reasonKey: 'wp_c1_portfolio_not_integrated',
      },
    });
    const validated = validateArtemisDecision(decision);
    expect(validated.ok).toBe(true);
    expect(decision.decisionEligible).toBe(false);
    expect(decision.executionEligible).toBe(false);
  });
});
