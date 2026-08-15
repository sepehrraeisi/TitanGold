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
  AVAILABILITY,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  CORRELATION_FAMILY,
  SCHEMA_VERSION as EVIDENCE_SCHEMA_VERSION,
} from '../../contracts/artemisEvidenceContract.js';
import {
  CLASSIFICATION,
  CONFLICT_STATE,
  DIRECTION_OR_ABSTAIN,
  EVIDENCE_ADMISSION_STATE,
  MATURITY_STAGE,
  SYNTHESIS_OUTCOME,
  validateArtemisDecision,
} from '../../contracts/artemisDecisionContract.js';
import {
  FAMILY_QUALITATIVE_STATE,
  MIN_INDEPENDENT_DIRECTIONAL_FAMILIES,
  SYNTHESIS_CONTRACT_VERSION,
  SYNTHESIS_POLICY_VERSION,
  SYNTHESIS_SCHEMA_VERSION,
  buildUnavailableSynthesisConfidence,
  validateArtemisSynthesisAssessment,
} from '../../contracts/artemisSynthesisContract.js';
import {
  assessDirectionalFamily,
  projectSynthesisToArtemisDecision,
  resolveCrossFamilySynthesis,
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
    memberAgentIds: extras.memberAgentIds || ['trend'],
    admittedDirectionalMemberCount: extras.admittedDirectionalMemberCount ?? 1,
    degradedMemberCount: 0,
    nonConfirmingMemberCount: 0,
    qualitativeState,
    familyDirection,
    conflictState: extras.conflictState || CONFLICT_STATE.NONE,
    limitations: extras.limitations || [],
  };
}

function validAssessment(overrides = {}) {
  return {
    schemaVersion: SYNTHESIS_SCHEMA_VERSION,
    contractVersion: SYNTHESIS_CONTRACT_VERSION,
    policyVersion: SYNTHESIS_POLICY_VERSION,
    implementationVersion: SYNTHESIS_POLICY_VERSION,
    decisionContext: {
      symbol: 'BTC/USDT',
      venue: 'mexc',
      marketType: 'spot',
      timeframe: '1h',
      analysisHorizon: null,
    },
    synthesisOutcome: SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE,
    observedDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
    conflictState: CONFLICT_STATE.NONE,
    independentDirectionalFamilyCount: 1,
    multiFamilyConfirmation: false,
    familyAssessments: [
      familyFixture(
        CORRELATION_FAMILY.OHLCV_CANDLE,
        FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH,
        DIRECTION_OR_ABSTAIN.BULLISH,
        { memberAgentIds: ['trend', 'volume'], admittedDirectionalMemberCount: 2 },
      ),
    ],
    opportunityContext: [],
    excludedNonConfirmingSummary: {
      excludedCount: 0,
      rejectedCount: 0,
      nonConfirmingCount: 0,
      degradedCount: 0,
      reasons: [],
    },
    limitations: ['wp_c2_qualitative_only', 'decision_eligible_false'],
    confidence: buildUnavailableSynthesisConfidence(),
    decisionEligible: false,
    executionEligible: false,
    artemisConsumable: false,
    ...overrides,
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

  it('duplicate identical Trend identity is fail-closed in all permutations', () => {
    const a = synthesizeDeterministicAssessment(CTX, [trendEnvelope(), trendEnvelope()]).assessment;
    const b = synthesizeDeterministicAssessment(CTX, [trendEnvelope(), trendEnvelope()]).assessment;
    expect(a.independentDirectionalFamilyCount).toBe(0);
    expect(b.independentDirectionalFamilyCount).toBe(0);
    expect(a.limitations).toContain('duplicate_identity_ambiguous');
    expect(a.excludedNonConfirmingSummary.reasons).toContain('DUPLICATE_IDENTITY_AMBIGUOUS');
    expect(a.synthesisOutcome).toBe(b.synthesisOutcome);
  });
});

describe('WP-C.2 adversarial duplicate identity fail-closed', () => {
  function expectDupFailClosed(left, right) {
    const a = synthesizeDeterministicAssessment(CTX, [left, right]).assessment;
    const b = synthesizeDeterministicAssessment(CTX, [right, left]).assessment;
    expect(a.independentDirectionalFamilyCount).toBe(0);
    expect(b.independentDirectionalFamilyCount).toBe(0);
    expect(a.limitations).toContain('duplicate_identity_ambiguous');
    expect(b.limitations).toContain('duplicate_identity_ambiguous');
    expect(a.synthesisOutcome).toBe(b.synthesisOutcome);
    expect(a.observedDirection).toBe(b.observedDirection);
  }

  it('same runId + same direction + different correlationFamily', () => {
    expectDupFailClosed(
      trendEnvelope({ correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE }),
      trendEnvelope({ correlationFamily: CORRELATION_FAMILY.MICROSTRUCTURE }),
    );
  });

  it('same runId + same direction + fresh vs stale', () => {
    expectDupFailClosed(
      trendEnvelope({ freshness: { status: 'fresh', reasonKey: 'fresh' } }),
      trendEnvelope({
        freshness: { status: 'stale', reasonKey: 'stale' },
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
    );
  });

  it('same runId + same direction + ok vs degraded', () => {
    expectDupFailClosed(
      trendEnvelope(),
      trendEnvelope({
        dataQuality: {
          status: 'degraded',
          sourceAvailability: 'available',
          coverage: 'unavailable',
          completeness: 'ok',
          staleness: 'fresh',
          providerDegradation: true,
          sampleAdequacy: 'ok',
          knownLimitationKeys: ['degraded'],
        },
      }),
    );
  });

  it('bullish vs bearish duplicate', () => {
    expectDupFailClosed(
      trendEnvelope({ conclusion: { direction: 'bullish', strength: { value: 70, scale: 'percent_100', provenance: 'a' } } }),
      trendEnvelope({ conclusion: { direction: 'bearish', strength: { value: 70, scale: 'percent_100', provenance: 'b' } } }),
    );
  });
});

describe('WP-C.2 distinct correlation-family integrity', () => {
  it('two coherent bullish summaries with same OHLCV family MUST NOT propose', () => {
    const resolved = resolveCrossFamilySynthesis([
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
        memberAgentIds: ['volume'],
      }),
    ]);
    expect(resolved.ok).toBe(false);
    expect(resolved.code).toBe('invalid_family_assessment_set');
    expect(resolved.errors.some((e) => e.code === 'duplicate_correlation_family')).toBe(true);

    const { assessment, validation } = synthesizeFromFamilyAssessments(CTX, [
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
        memberAgentIds: ['volume'],
      }),
    ]);
    expect(assessment).toBeNull();
    expect(validation.ok).toBe(false);
  });

  it('two coherent bearish summaries same family MUST NOT propose', () => {
    const resolved = resolveCrossFamilySynthesis([
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH, DIRECTION_OR_ABSTAIN.BEARISH),
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH, DIRECTION_OR_ABSTAIN.BEARISH, {
        memberAgentIds: ['volume'],
      }),
    ]);
    expect(resolved.ok).toBe(false);
    expect(resolved.code).toBe('invalid_family_assessment_set');
  });

  it('family assessment with missing/null correlationFamily => contract REJECT', () => {
    const assessment = validAssessment({
      familyAssessments: [
        {
          ...familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
          correlationFamily: null,
        },
      ],
      independentDirectionalFamilyCount: 0,
    });
    expect(validateArtemisSynthesisAssessment(assessment).ok).toBe(false);
  });

  it('duplicate correlationFamily in one synthesis assessment => contract REJECT', () => {
    const assessment = validAssessment({
      independentDirectionalFamilyCount: 2,
      familyAssessments: [
        familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
        familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
          memberAgentIds: ['volume'],
        }),
      ],
    });
    expect(validateArtemisSynthesisAssessment(assessment).ok).toBe(false);
  });
});

describe('WP-C.2 conflict precedence', () => {
  it('blocking cross-family outranks material same-family mixed', () => {
    const { assessment, validation } = synthesizeFromFamilyAssessments(CTX, [
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.MIXED, DIRECTION_OR_ABSTAIN.ABSTAIN, {
        conflictState: CONFLICT_STATE.MATERIAL,
        memberAgentIds: ['trend', 'volume'],
        admittedDirectionalMemberCount: 2,
      }),
      familyFixture(
        CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
        FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH,
        DIRECTION_OR_ABSTAIN.BULLISH,
        { memberAgentIds: ['sentiment'] },
      ),
      familyFixture(
        CORRELATION_FAMILY.MICROSTRUCTURE,
        FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH,
        DIRECTION_OR_ABSTAIN.BEARISH,
        { memberAgentIds: ['pattern'] },
      ),
    ]);
    expect(validation.ok).toBe(true);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.ABSTAIN);
    expect(assessment.conflictState).toBe(CONFLICT_STATE.BLOCKING);
  });
});

describe('WP-C.2 no synthetic correlation family', () => {
  it('stale analytical envelope without correlationFamily does not fabricate a family', () => {
    const staleNoFamily = volumeEnvelope({
      correlationFamily: undefined,
      freshness: { status: 'stale', reasonKey: 'stale_no_family' },
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
    });
    delete staleNoFamily.correlationFamily;

    const { assessment, validation } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      staleNoFamily,
    ]);
    expect(validation.ok).toBe(true);
    expect(assessment.familyAssessments.every((f) => f.correlationFamily !== undefined)).toBe(true);
    expect(assessment.familyAssessments).toHaveLength(1);
    expect(assessment.familyAssessments[0].memberAgentIds).toEqual(['trend']);
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
    expect(assessment.limitations).toContain('non_confirming_correlation_family_unavailable');
    expect(assessment.excludedNonConfirmingSummary.nonConfirmingCount).toBeGreaterThanOrEqual(1);
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

  it('conflicting duplicate runId is order-independent and fail-closed', () => {
    const bullish = trendEnvelope({
      conclusion: { direction: 'bullish', strength: { value: 70, scale: 'percent_100', provenance: 'a' } },
    });
    const bearish = trendEnvelope({
      conclusion: { direction: 'bearish', strength: { value: 70, scale: 'percent_100', provenance: 'b' } },
    });
    const a = synthesizeDeterministicAssessment(CTX, [bullish, bearish]).assessment;
    const b = synthesizeDeterministicAssessment(CTX, [bearish, bullish]).assessment;
    expect(a.synthesisOutcome).toBe(b.synthesisOutcome);
    expect(a.observedDirection).toBe(b.observedDirection);
    expect(a.independentDirectionalFamilyCount).toBe(b.independentDirectionalFamilyCount);
    expect(a.independentDirectionalFamilyCount).toBe(0);
    expect(a.limitations).toContain('duplicate_identity_ambiguous');
    expect(a.excludedNonConfirmingSummary.reasons).toContain('DUPLICATE_IDENTITY_AMBIGUOUS');
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
        { memberAgentIds: ['sentiment'] },
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
        { memberAgentIds: ['pattern'] },
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
        { memberAgentIds: ['sentiment'] },
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
        { memberAgentIds: ['sentiment'] },
      ),
    ]);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.ABSTAIN);
    expect(assessment.conflictState).toBe(CONFLICT_STATE.MATERIAL);
  });
});

describe('WP-C.2 opportunity truthfulness', () => {
  it('opportunity without proven availability stays unavailable and non-directional', () => {
    const { assessment, validation } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope(),
      arbitrageEnvelope({
        opportunity: {
          kind: 'spread',
          horizon: 'intraday',
        },
      }),
    ]);
    expect(validation.ok).toBe(true);
    expect(assessment.opportunityContext).toHaveLength(1);
    expect(assessment.opportunityContext[0].availability).toBe(AVAILABILITY.UNAVAILABLE);
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE);
  });
});

describe('WP-C.2 strict contract + projection gates', () => {
  it('valid assessment passes and projects', () => {
    const { assessment, admissionSet, validation } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope(),
    ]);
    expect(validation.ok).toBe(true);
    const projected = projectSynthesisToArtemisDecision(assessment, {
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
    expect(projected.validation.ok).toBe(true);
    expect(validateArtemisDecision(projected.decision).ok).toBe(true);
    expect(projected.decision.decisionEligible).toBe(false);
    expect(projected.decision.executionEligible).toBe(false);
    expect(projected.decision.classification).toBe(CLASSIFICATION.ADVISORY_ONLY);
    expect(projected.decision.maturityStage).toBe(MATURITY_STAGE.ADVISORY_ONLY);
  });

  it('PROPOSED without multiFamilyConfirmation is refused by projection', () => {
    const bad = validAssessment({
      synthesisOutcome: SYNTHESIS_OUTCOME.PROPOSED,
      observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
      multiFamilyConfirmation: false,
      independentDirectionalFamilyCount: 2,
      familyAssessments: [
        familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
        familyFixture(
          CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
          FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH,
          DIRECTION_OR_ABSTAIN.BULLISH,
          { memberAgentIds: ['sentiment'] },
        ),
      ],
    });
    expect(validateArtemisSynthesisAssessment(bad).ok).toBe(false);
    const projected = projectSynthesisToArtemisDecision(bad, {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: [],
    });
    expect(projected.decision).toBeNull();
    expect(projected.validation.ok).toBe(false);
  });

  it('decisionEligible=true is refused by projection', () => {
    const bad = validAssessment({ decisionEligible: true });
    const projected = projectSynthesisToArtemisDecision(bad, {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: [],
    });
    expect(projected.decision).toBeNull();
    expect(projected.validation.ok).toBe(false);
  });

  it('duplicate family identity assessment is refused by projection', () => {
    const bad = validAssessment({
      independentDirectionalFamilyCount: 2,
      familyAssessments: [
        familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
        familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
          memberAgentIds: ['volume'],
        }),
      ],
    });
    const projected = projectSynthesisToArtemisDecision(bad, {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: [],
    });
    expect(projected.decision).toBeNull();
    expect(projected.validation.ok).toBe(false);
  });
});

describe('WP-C.2 analytical family membership + coherent structure', () => {
  it.each([
    ['risk'],
    ['order'],
    ['arbitrage'],
  ])('%s in directional family is rejected', (agentId) => {
    const assessment = validAssessment({
      familyAssessments: [
        familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
          memberAgentIds: [agentId],
        }),
      ],
    });
    expect(validateArtemisSynthesisAssessment(assessment).ok).toBe(false);
  });

  it.each([
    ['trend'],
    ['volume'],
    ['sentiment'],
    ['pattern'],
  ])('%s analytical member is accepted by taxonomy', (agentId) => {
    const assessment = validAssessment({
      familyAssessments: [
        familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
          memberAgentIds: [agentId],
        }),
      ],
    });
    expect(validateArtemisSynthesisAssessment(assessment).ok).toBe(true);
  });

  it('coherent bullish with zero members / zero directional count rejects', () => {
    expect(validateArtemisSynthesisAssessment(validAssessment({
      independentDirectionalFamilyCount: 0,
      familyAssessments: [
        {
          ...familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH),
          memberAgentIds: [],
          admittedDirectionalMemberCount: 0,
        },
      ],
    })).ok).toBe(false);

    expect(validateArtemisSynthesisAssessment(validAssessment({
      independentDirectionalFamilyCount: 0,
      familyAssessments: [
        familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
          admittedDirectionalMemberCount: 0,
        }),
      ],
    })).ok).toBe(false);
  });

  it('non_confirming/unavailable cannot claim directional members; mixed needs >=2', () => {
    expect(validateArtemisSynthesisAssessment(validAssessment({
      independentDirectionalFamilyCount: 0,
      familyAssessments: [
        {
          ...familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.NON_CONFIRMING, DIRECTION_OR_ABSTAIN.UNAVAILABLE),
          admittedDirectionalMemberCount: 1,
        },
      ],
    })).ok).toBe(false);

    expect(validateArtemisSynthesisAssessment(validAssessment({
      independentDirectionalFamilyCount: 0,
      familyAssessments: [
        {
          ...familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.UNAVAILABLE, DIRECTION_OR_ABSTAIN.UNAVAILABLE),
          admittedDirectionalMemberCount: 1,
        },
      ],
    })).ok).toBe(false);

    expect(validateArtemisSynthesisAssessment(validAssessment({
      independentDirectionalFamilyCount: 0,
      familyAssessments: [
        {
          ...familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.MIXED, DIRECTION_OR_ABSTAIN.ABSTAIN, {
            conflictState: CONFLICT_STATE.MATERIAL,
            memberAgentIds: ['trend', 'volume'],
          }),
          admittedDirectionalMemberCount: 1,
        },
      ],
    })).ok).toBe(false);
  });
});

describe('WP-C.2 supported outcome allowlist', () => {
  it.each([
    ['blocked_by_risk'],
    ['blocked_by_runtime'],
    ['unspecified'],
    ['unavailable'],
  ])('%s outcome is rejected', (outcome) => {
    expect(validateArtemisSynthesisAssessment(validAssessment({
      synthesisOutcome: outcome,
      observedDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
      multiFamilyConfirmation: false,
    })).ok).toBe(false);
  });
});

describe('WP-C.2 projection evidence lineage', () => {
  it('empty evidenceRefs refused when assessment claims contributors', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, [trendEnvelope(), volumeEnvelope()]);
    const projected = projectSynthesisToArtemisDecision(assessment, {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: [],
    });
    expect(projected.decision).toBeNull();
    expect(projected.validation.code).toBe('evidence_refs_required_for_contributors');
  });

  it('partial Trend-only refs refused for Trend+Volume assessment', () => {
    const { assessment, admissionSet } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope(),
    ]);
    const onlyTrend = admissionSet.evidenceRefs.filter((r) => r.agentId === 'trend');
    const projected = projectSynthesisToArtemisDecision(assessment, {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: onlyTrend,
    });
    expect(projected.decision).toBeNull();
    expect(projected.validation.code).toBe('missing_contributor_evidence_ref');
  });

  it('Arbitrage opportunity without Arbitrage ref is refused', () => {
    const { assessment, admissionSet } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope(),
      arbitrageEnvelope(),
    ]);
    const withoutArb = admissionSet.evidenceRefs.filter((r) => r.agentId !== 'arbitrage');
    const projected = projectSynthesisToArtemisDecision(assessment, {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: withoutArb,
    });
    expect(projected.decision).toBeNull();
    expect(projected.validation.code).toBe('missing_contributor_evidence_ref');
  });

  it('true no-evidence insufficient assessment may project with empty refs', () => {
    const { assessment } = synthesizeDeterministicAssessment(CTX, []);
    const projected = projectSynthesisToArtemisDecision(assessment, {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      createdAt: '2026-08-10T12:10:00.000Z',
      analysisAt: '2026-08-10T12:00:00.000Z',
      evidenceRefs: [],
    });
    expect(projected.validation.ok).toBe(true);
    expect(projected.decision.decisionEligible).toBe(false);
  });
});

describe('WP-C.2 input envelope bound', () => {
  it('accepts 32 envelopes and refuses 33 without truncation', () => {
    const mk = (i) => trendEnvelope({
      runId: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
    });
    const ok32 = synthesizeDeterministicAssessment(CTX, Array.from({ length: 32 }, (_, i) => mk(i)));
    expect(ok32.validation.ok).toBe(true);
    expect(ok32.assessment).not.toBeNull();

    const bad33 = synthesizeDeterministicAssessment(CTX, Array.from({ length: 33 }, (_, i) => mk(i)));
    expect(bad33.assessment).toBeNull();
    expect(bad33.validation.ok).toBe(false);
    expect(bad33.validation.code).toBe('input_envelope_limit_exceeded');
    expect(bad33.validation.limit).toBe(32);
  });
});

function nonConfirmingArbitrage(freshnessStatus) {
  return arbitrageEnvelope({
    freshness: { status: freshnessStatus, reasonKey: `arb_${freshnessStatus}` },
    dataQuality: {
      status: 'degraded',
      sourceAvailability: 'available',
      coverage: 'unavailable',
      completeness: 'ok',
      staleness: freshnessStatus,
      providerDegradation: false,
      sampleAdequacy: 'ok',
      knownLimitationKeys: [freshnessStatus],
    },
  });
}

describe('WP-C.2 non-confirming opportunity role routing', () => {
  function expectNonConfirmingArbRouted(envelope) {
    const { assessment, validation } = synthesizeDeterministicAssessment(CTX, [envelope]);
    expect(validation.ok).toBe(true);
    expect(assessment).not.toBeNull();
    expect(assessment.opportunityContext).toHaveLength(1);
    expect(assessment.opportunityContext[0].agentId).toBe('arbitrage');
    expect(assessment.opportunityContext[0].admissionState).toBe(EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING);
    expect(assessment.opportunityContext[0].availability).toBe(AVAILABILITY.UNAVAILABLE);
    expect(assessment.independentDirectionalFamilyCount).toBe(0);
    expect(assessment.familyAssessments.every((f) => !f.memberAgentIds.includes('arbitrage'))).toBe(true);
    expect(assessment.limitations).toContain('opportunity_context_non_confirming');
  }

  it('stale Arbitrage stays in opportunityContext unavailable', () => {
    expectNonConfirmingArbRouted(nonConfirmingArbitrage('stale'));
  });

  it('expired Arbitrage stays in opportunityContext unavailable', () => {
    expectNonConfirmingArbRouted(nonConfirmingArbitrage('expired'));
  });

  it('freshness-unknown Arbitrage stays in opportunityContext unavailable', () => {
    expectNonConfirmingArbRouted(nonConfirmingArbitrage('unknown'));
  });

  it('Trend + Volume + stale Arbitrage => family count 1 / insufficient / no contract failure', () => {
    const { assessment, validation } = synthesizeDeterministicAssessment(CTX, [
      trendEnvelope(),
      volumeEnvelope(),
      nonConfirmingArbitrage('stale'),
    ]);
    expect(validation.ok).toBe(true);
    expect(assessment).not.toBeNull();
    expect(assessment.independentDirectionalFamilyCount).toBe(1);
    expect(assessment.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE);
    expect(assessment.observedDirection).toBe(DIRECTION_OR_ABSTAIN.ABSTAIN);
    expect(assessment.opportunityContext).toHaveLength(1);
    expect(assessment.opportunityContext[0].agentId).toBe('arbitrage');
    expect(assessment.opportunityContext[0].admissionState).toBe(EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING);
    expect(assessment.opportunityContext[0].availability).toBe(AVAILABILITY.UNAVAILABLE);
    expect(assessment.familyAssessments.every((f) => !f.memberAgentIds.includes('arbitrage'))).toBe(true);
  });
});

describe('WP-C.2 cross-family kernel fail-closed on invalid family summaries', () => {
  it('risk + order coherent bullish families => ok=false / no PROPOSED', () => {
    const resolved = resolveCrossFamilySynthesis([
      familyFixture(CORRELATION_FAMILY.ACCOUNT_STATE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
        memberAgentIds: ['risk'],
      }),
      familyFixture(CORRELATION_FAMILY.EXECUTION_PATH, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
        memberAgentIds: ['order'],
      }),
    ]);
    expect(resolved.ok).toBe(false);
    expect(resolved.code).toBe('invalid_family_assessment_set');
    expect(resolved.synthesisOutcome).toBeUndefined();

    const { assessment, validation } = synthesizeFromFamilyAssessments(CTX, [
      familyFixture(CORRELATION_FAMILY.ACCOUNT_STATE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
        memberAgentIds: ['risk'],
      }),
      familyFixture(CORRELATION_FAMILY.EXECUTION_PATH, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
        memberAgentIds: ['order'],
      }),
    ]);
    expect(assessment).toBeNull();
    expect(validation.ok).toBe(false);
  });

  it('arbitrage coherent bullish family => ok=false', () => {
    const resolved = resolveCrossFamilySynthesis([
      familyFixture(CORRELATION_FAMILY.SPREAD_MONITOR, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
        memberAgentIds: ['arbitrage'],
      }),
    ]);
    expect(resolved.ok).toBe(false);
    expect(resolved.code).toBe('invalid_family_assessment_set');
  });

  it('coherent family with directional count 0 => ok=false', () => {
    const resolved = resolveCrossFamilySynthesis([
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
        admittedDirectionalMemberCount: 0,
      }),
    ]);
    expect(resolved.ok).toBe(false);
    expect(resolved.code).toBe('invalid_family_assessment_set');
  });

  it('malformed familyDirection/state combination => ok=false', () => {
    const resolved = resolveCrossFamilySynthesis([
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BEARISH),
    ]);
    expect(resolved.ok).toBe(false);
    expect(resolved.code).toBe('invalid_family_assessment_set');
  });

  it('valid Trend-family + valid analytical external family remains PASS', () => {
    const resolved = resolveCrossFamilySynthesis([
      familyFixture(CORRELATION_FAMILY.OHLCV_CANDLE, FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH, DIRECTION_OR_ABSTAIN.BULLISH, {
        memberAgentIds: ['trend', 'volume'],
        admittedDirectionalMemberCount: 2,
      }),
      familyFixture(
        CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
        FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH,
        DIRECTION_OR_ABSTAIN.BULLISH,
        { memberAgentIds: ['sentiment'] },
      ),
    ]);
    expect(resolved.ok).toBe(true);
    expect(resolved.synthesisOutcome).toBe(SYNTHESIS_OUTCOME.PROPOSED);
    expect(resolved.multiFamilyConfirmation).toBe(true);
  });
});
