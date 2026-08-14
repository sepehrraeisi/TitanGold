/**
 * @jest-environment node
 */
/**
 * Artemis WP-C.2 — deterministic qualitative synthesis tests.
 */
import { describe, expect, it } from '@jest/globals';
import {
  ADAPTER_VERSIONS,
  AUTHORITY_CLASS,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  CORRELATION_FAMILY,
  SCHEMA_VERSION as EVIDENCE_SCHEMA_VERSION,
} from '../../contracts/artemisEvidenceContract.js';
import {
  CLASSIFICATION,
  CONFLICT_STATE,
  DIRECTION_OR_ABSTAIN,
  MATURITY_STAGE,
  SYNTHESIS_OUTCOME,
  validateArtemisDecision,
} from '../../contracts/artemisDecisionContract.js';
import {
  FAMILY_QUALITATIVE_STATE,
  MIN_INDEPENDENT_DIRECTIONAL_FAMILIES,
  SYNTHESIS_POLICY_VERSION,
  validateArtemisSynthesisAssessment,
} from '../../contracts/artemisSynthesisContract.js';
import {
  assessDirectionalFamily,
  projectSynthesisToArtemisDecision,
  synthesizeDeterministicAssessment,
  synthesizeFromFamilyAssessments,
} from '../../services/artemisDeterministicSynthesisService.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TREND_RUN = '11111111-1111-4111-8111-111111111111';
const VOLUME_RUN = '22222222-2222-4222-8222-222222222222';
const ARB_RUN = '33333333-3333-4333-8333-333333333333';

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

function familyFixture(correlationFamily, qualitativeState, familyDirection, extras = {}) {
  return {
    correlationFamily,
    memberAgentIds: extras.memberAgentIds || ['fixture_a'],
    admittedDirectionalMemberCount: extras.admittedDirectionalMemberCount ?? 1,
    degradedMemberCount: 0,
    nonConfirmingMemberCount: 0,
    qualitativeState,
    familyDirection,
    conflictState: extras.conflictState || CONFLICT_STATE.NONE,
    limitations: extras.limitations || [],
  };
}

describe('WP-C.2 realistic current evidence set', () => {
  it('no evidence => insufficient / abstain', () => {
    const { assessment, validation } = synthesizeDeterministicAssessment(CTX, []);
    expect(validation.ok).toBe(true);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE);
    expect(assessment.observedDirection).toBe(DIRECTION_OR_ABSTAIN.ABSTAIN);
    expect(assessment.independentDirectionalFamilyCount).toBe(0);
    expect(assessment.multiFamilyConfirmation).toBe(false);
  });

  it('Trend bullish only => one family / insufficient / abstain', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [trendEnvelope()]);
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
    expect(assessment.familyAssessments[0].qualitativeState).toBe(FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE);
    expect(assessment.observedDirection).toBe(DIRECTION_OR_ABSTAIN.ABSTAIN);
    expect(assessment.multiFamilyConfirmation).toBe(false);
  });

  it('Volume bullish only => one family / insufficient / abstain', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [volumeEnvelope()]);
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE);
  });

  it('Trend + Volume bullish => same OHLCV family, count 1, insufficient', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope(),
    ]);
    expect(assessment.familyAssessments).toHaveLength(1);
    expect(assessment.familyAssessments[0].correlationFamily).toBe(CORRELATION_FAMILY.OHLCV_CANDLE);
    expect(assessment.familyAssessments[0].qualitativeState).toBe(FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH);
    expect(assessment.familyAssessments[0].memberAgentIds).toEqual(['trend', 'volume']);
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
    expect(assessment.multiFamilyConfirmation).toBe(false);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE);
    expect(assessment.observedDirection).toBe(DIRECTION_OR_ABSTAIN.ABSTAIN);
  });

  it('Trend + Volume bearish => same structural insufficient outcome', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope({ conclusion: { direction: 'bearish', strength: { value: 60, scale: 'percent_100', provenance: 't' } } }),
      volumeEnvelope({ conclusion: { direction: 'bearish', strength: { value: 55, scale: 'percent_100', provenance: 'v' } } }),
    ]);
    expect(assessment.familyAssessments[0].qualitativeState).toBe(FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH);
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE);
  });

  it('Trend bullish + Volume bearish => same-family material conflict / abstain', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope({ conclusion: { direction: 'bearish', strength: { value: 55, scale: 'percent_100', provenance: 'v' } } }),
    ]);
    expect(assessment.familyAssessments[0].qualitativeState).toBe(FAMILY_QUALITATIVE_STATE.MIXED);
    expect(assessment.familyAssessments[0].conflictState).toBe(CONFLICT_STATE.MATERIAL);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.ABSTAIN);
    expect(assessment.conflictState).toBe(CONFLICT_STATE.MATERIAL);
    expect(assessment.multiFamilyConfirmation).toBe(false);
  });

  it('Trend + Volume + Arbitrage => opportunity context only; family count unchanged', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope(),
      arbitrageEnvelope(),
    ]);
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
    expect(assessment.opportunityContext).toHaveLength(1);
    expect(assessment.opportunityContext[0].agentId).toBe('arbitrage');
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE);
    expect(assessment.limitations).toContain('opportunity_context_non_directional');
  });

  it('Trend fresh + Volume stale => stale non-confirming; one usable family', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope({
        freshness: { status: 'stale', reasonKey: 'stale_test' },
        dataQuality: {
          status: 'degraded',
          sourceAvailability: 'available',
          coverage: 'unavailable',
          completeness: 'ok',
          staleness: 'stale',
          providerDegradation: false,
          sampleAdequacy: 'ok',
          knownLimitationKeys: ['stale'],
        },
      }),
    ]);
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
    expect(assessment.excludedNonConfirmingSummary.nonConfirmingCount).toBeGreaterThanOrEqual(1);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE);
  });

  it('unavailable / failed / mock / context mismatch => no confirming vote', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope({ availability: 'unavailable', unavailableReason: 'missing', lifecycleStatus: 'failed' }),
      volumeEnvelope({
        dataQuality: {
          status: 'blocked',
          sourceAvailability: 'unavailable',
          coverage: 'unavailable',
          completeness: 'unavailable',
          staleness: 'unknown',
          providerDegradation: true,
          sampleAdequacy: 'insufficient',
          knownLimitationKeys: ['mock_or_placeholder'],
        },
        provenance: { writer: 'test', source: 'mock' },
      }),
      trendEnvelope({
        runId: '55555555-5555-4555-8555-555555555555',
        symbol: 'ETH/USDT',
      }),
    ]);
    expect(assessment.independentDirectionalFamilyCount).toBe(0);
    expect(assessment.multiFamilyConfirmation).toBe(false);
    expect([
      SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE,
      SYNTHESIS_OUTCOME.INCOMPATIBLE_EVIDENCE,
    ]).toContain(assessment.synthesisOutcome);
  });

  it('duplicate => no duplicate directional influence', () => {
    const { assessment, admissionSet } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      trendEnvelope(),
    ]);
    expect(admissionSet.results.some((r) => r.admissionReason === 'DUPLICATE_REFERENCE')).toBe(true);
    expect(assessment.familyAssessments[0].admittedDirectionalMemberCount).toBe(1);
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
  });
});

describe('WP-C.2 confidence integrity', () => {
  it('does not average numeric Agent confidences and keeps synthesis confidence unavailable', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope({
        confidence: {
          availability: 'available',
          kind: 'model_score',
          scale: 'unit_interval',
          value: 0.9,
          calibrationState: 'uncalibrated',
          provenance: { writer: 'test', methodKey: 'unit' },
        },
      }),
      volumeEnvelope({
        confidence: {
          availability: 'available',
          kind: 'model_score',
          scale: 'unit_interval',
          value: 0.1,
          calibrationState: 'uncalibrated',
          provenance: { writer: 'test', methodKey: 'unit' },
        },
      }),
    ]);
    expect(assessment.confidence.availability).toBe('unavailable');
    expect(assessment.confidence.value).toBeUndefined();
    expect(assessment.confidence.reasonKey).toBe('qualitative_synthesis_not_calibrated');
    expect(JSON.stringify(assessment)).not.toMatch(/"value":0\.5/);
  });

  it('never treats strength as confidence', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope({
        conclusion: {
          direction: 'bullish',
          strength: { value: 99, scale: 'percent_100', provenance: 'x' },
        },
      }),
    ]);
    expect(assessment.confidence.availability).toBe('unavailable');
    expect(assessment.confidence).not.toHaveProperty('value');
  });
});

describe('WP-C.2 determinism', () => {
  it('permuting same evidence set yields equivalent synthesis', () => {
    const a = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope(),
      arbitrageEnvelope(),
    ]).assessment;
    const b = synthesizeDeterministicAssessment(CTX, [
      arbitrageEnvelope(),
      volumeEnvelope(),
      trendEnvelope(),
    ]).assessment;
    expect(b.synthesisOutcome).toBe(a.synthesisOutcome);
    expect(b.observedDirection).toBe(a.observedDirection);
    expect(b.conflictState).toBe(a.conflictState);
    expect(b.independentDirectionalFamilyCount).toBe(a.independentDirectionalFamilyCount);
    expect(b.multiFamilyConfirmation).toBe(a.multiFamilyConfirmation);
    expect(b.familyAssessments).toEqual(a.familyAssessments);
    expect(b.opportunityContext.map((x) => x.agentId)).toEqual(a.opportunityContext.map((x) => x.agentId));
  });

  it('family ordering is deterministic', () => {
    const fam = assessDirectionalFamily({
      correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
      members: [
        { agentId: 'volume', direction: 'bullish', degraded: false, nonConfirming: false },
        { agentId: 'trend', direction: 'bullish', degraded: false, nonConfirming: false },
      ],
    });
    expect(fam.memberAgentIds).toEqual(['trend', 'volume']);
  });
});

describe('WP-C.2 algorithm-only cross-family policy (not currently consumable Agents)', () => {
  it('two independent coherent bullish families => proposed bullish', () => {
    const { assessment, validation } = synthesizeFromFamilyAssessments(CTX, [
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
      familyFixture(
        CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
        FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH,
        DIRECTION_OR_ABSTAIN.BULLISH,
        { memberAgentIds: ['fixture_b'] },
      ),
    ]);
    expect(validation.ok).toBe(true);
    expect(MIN_INDEPENDENT_DIRECTIONAL_FAMILIES).toBe(2);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.PROPOSED);
    expect(assessment.observedDirection).toBe(DIRECTION_OR_ABSTAIN.BULLISH);
    expect(assessment.multiFamilyConfirmation).toBe(true);
  });

  it('two independent coherent bearish families => proposed bearish', () => {
    const { assessment } = synthesizeFromFamilyAssessments(CTX, [
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH, DIRECTION_OR_ABSTAIN.BEARISH),
      familyFixture(
        CORRELATION_FAMILY.MICROSTRUCTURE,
        FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH,
        DIRECTION_OR_ABSTAIN.BEARISH,
        { memberAgentIds: ['fixture_b'] },
      ),
    ]);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.PROPOSED);
    expect(assessment.observedDirection).toBe(DIRECTION_OR_ABSTAIN.BEARISH);
  });

  it('bullish vs bearish independent families => blocking conflict / abstain', () => {
    const { assessment } = synthesizeFromFamilyAssessments(CTX, [
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
      familyFixture(
        CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
        FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH,
        DIRECTION_OR_ABSTAIN.BEARISH,
        { memberAgentIds: ['fixture_b'] },
      ),
    ]);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.ABSTAIN);
    expect(assessment.conflictState).toBe(CONFLICT_STATE.BLOCKING);
  });

  it('actionable vs neutral independent families => material conflict / abstain', () => {
    const { assessment } = synthesizeFromFamilyAssessments(CTX, [
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
      familyFixture(
        CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
        FAMILY_QUALITATIVE_STATE.COHERENT_NEUTRAL,
        DIRECTION_OR_ABSTAIN.NEUTRAL,
        { memberAgentIds: ['fixture_b'] },
      ),
    ]);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.ABSTAIN);
    expect(assessment.conflictState).toBe(CONFLICT_STATE.MATERIAL);
  });
});

describe('WP-C.2 ArtemisDecision projection', () => {
  it('projects a validating non-executable Decision', () => {
    const { assessment, admissionSet } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope(),
      arbitrageEnvelope(),
    ]);
    const { decision, validation } = projectSynthesisToArtemisDecision(assessment, {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: admissionSet.evidenceRefs,
      symbol: CTX.symbol,
      venue: CTX.venue,
      marketType: CTX.marketType,
      timeframe: CTX.timeframe,
    });
    expect(validation.ok).toBe(true);
    expect(validateArtemisDecision(decision).ok).toBe(true);
    expect(decision.decisionEligible).toBe(false);
    expect(decision.executionEligible).toBe(false);
    expect(decision).not.toHaveProperty('approved');
    expect(decision).not.toHaveProperty('approvedForExecution');
    expect(decision).not.toHaveProperty('action');
    expect(decision.riskStatus).toBe('unavailable');
    expect(decision.allocationProposal.availability).toBe('unavailable');
    expect(decision.liquidityStatus).toBe('unavailable');
    expect(decision.runtimeStatus.availability).toBe('unavailable');
    expect(decision.classification).toBe(CLASSIFICATION.ADVISORY_ONLY);
    expect(decision.maturityStage).toBe(MATURITY_STAGE.ADVISORY_ONLY);
    expect(decision.confidence.availability).toBe('unavailable');
    expect(decision.policyVersion).toBe(SYNTHESIS_POLICY_VERSION);
  });
});
