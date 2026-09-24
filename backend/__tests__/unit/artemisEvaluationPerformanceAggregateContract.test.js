/**
 * @jest-environment node
 *
 * Dedicated unit tests — Artemis Evaluation Performance Aggregate Contract
 * SLICE: S10-EVALUATION-PERFORMANCE-AGGREGATE-CONTRACT
 * Covers required classes A–BZ + adversarial.
 */
import { describe, expect, it } from '@jest/globals';
import {
  AVAILABILITY,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  DECISION_CONTRACT_VERSION,
  DIRECTION_OR_ABSTAIN,
} from '../../contracts/artemisDecisionContract.js';
import { DECISION_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisDecisionContextContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisMarketContextContract.js';
import { SHADOW_RECORDING_CONTRACT_VERSION } from '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js';
import { SHADOW_TASK_STATE_CONTRACT_VERSION } from '../../contracts/artemisShadowTaskStateBoundaryContract.js';
import { SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION } from '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js';
import { buildObservedOutcome } from '../../contracts/artemisObservedOutcomeContract.js';
import {
  EVALUATION_METHOD_KEY,
  EVALUATION_STATUS,
  OBSERVATION_CLASS,
  OBSERVED_OUTCOME_EVALUATION_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
  OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION,
  OBSERVED_OUTCOME_EVALUATION_SLICE_ID,
  buildObservedOutcomeEvaluation,
} from '../../contracts/artemisObservedOutcomeEvaluationContract.js';
import {
  AGGREGATE_LIMITATIONS,
  AGGREGATE_RATIO_STATUS,
  COMPARABLE_DIRECTIONS,
  EVALUATION_PERFORMANCE_AGGREGATE_ARTIFACT_TYPE,
  EVALUATION_PERFORMANCE_AGGREGATE_AUTHORITY_CLASS,
  EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_IS_SOURCE_OF_TRUTH,
  EVALUATION_PERFORMANCE_AGGREGATE_METHOD_KEY,
  EVALUATION_PERFORMANCE_AGGREGATE_OWNERSHIP_ROLE,
  EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_SCHEMA_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_SLICE_ID,
  EVALUATION_PERFORMANCE_AGGREGATE_WRITER,
  REQUIRED_HARD_FLAGS,
  ZERO_AGGREGATE_SIDE_EFFECTS,
  buildArtemisEvaluationPerformanceAggregate,
  computeEvaluationPerformanceAggregateId,
  validateArtemisEvaluationPerformanceAggregate,
} from '../../contracts/artemisEvaluationPerformanceAggregateContract.js';

// ---------------------------------------------------------------------------
// Fixtures (Confidence Calibration pattern)
// ---------------------------------------------------------------------------

const DECISION_ID = '11111111-1111-4111-8111-111111111111';
const DECISION_ID_MISMATCH = '11111111-1111-4111-8111-111111111112';
const DECISION_ID_EMPTY_MATCH = '11111111-1111-4111-8111-111111111113';
const DECISION_CONTEXT_ID = '22222222-2222-4222-8222-222222222222';
const SHADOW_RECORDING_ID = '33333333-3333-4333-8333-333333333333';
const MARKET_CONTEXT_ID = '44444444-4444-4444-8444-444444444444';
const TASK_ID = '55555555-5555-4555-8555-555555555555';
const CYCLE_BINDING_ID = '66666666-6666-4666-8666-666666666666';
const SHADOW_CYCLE_ENVELOPE_ID = '77777777-7777-4777-8777-777777777777';
const T0 = '2026-09-20T12:00:00.000Z';
const T1 = '2026-09-20T12:05:00.000Z';
const T2 = '2026-09-20T12:10:00.000Z';
const T_AGG = '2026-09-20T12:15:00.000Z';

function decisionRef(overrides = {}) {
  return {
    decisionId: DECISION_ID,
    contractVersion: DECISION_CONTRACT_VERSION,
    decisionContextId: DECISION_CONTEXT_ID,
    analysisAt: T0,
    ...overrides,
  };
}

function decisionContextRef(overrides = {}) {
  return {
    contextId: DECISION_CONTEXT_ID,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    ...overrides,
  };
}

function shadowRecordingRef(overrides = {}) {
  return {
    shadowRecordingArtifactId: SHADOW_RECORDING_ID,
    contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    ...overrides,
  };
}

function marketContextRef(overrides = {}) {
  return {
    marketContextId: MARKET_CONTEXT_ID,
    contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    venue: 'mexc',
    marketType: MARKET_TYPE.SPOT,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    freshnessStatus: FRESHNESS_STATUS.FRESH,
    sourceTimestamp: T0,
    availability: AVAILABILITY.AVAILABLE,
    ...overrides,
  };
}

function validOutcomeInput(overrides = {}) {
  return {
    decisionRef: decisionRef(),
    decisionContextRef: decisionContextRef(),
    shadowRecordingRef: shadowRecordingRef(),
    marketContextRef: marketContextRef(),
    taskRef: {
      taskId: TASK_ID,
      contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
      attempt: 1,
    },
    cycleBindingRef: {
      bindingId: CYCLE_BINDING_ID,
      contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    },
    shadowCycleEnvelopeRef: {
      shadowCycleEnvelopeId: SHADOW_CYCLE_ENVELOPE_ID,
      contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    },
    outcomeObservedAt: T1,
    recordedAt: T1,
    ...overrides,
  };
}

function buildValidOutcome(overrides = {}) {
  const result = buildObservedOutcome(validOutcomeInput(overrides));
  expect(result.ok).toBe(true);
  return result.artifact;
}

function evaluationMethod(overrides = {}) {
  return {
    methodKey: EVALUATION_METHOD_KEY.COMPARE_SHADOW_DECISION_TO_OBSERVED_OUTCOME_FAIL_CLOSED,
    implementationVersion: '1.0.0',
    ...overrides,
  };
}

function validEvalInput(overrides = {}) {
  const outcomeArtifact = overrides.outcomeArtifact === undefined
    ? buildValidOutcome()
    : overrides.outcomeArtifact;
  const {
    outcomeArtifact: _ignored,
    ...rest
  } = overrides;
  return {
    outcomeArtifact,
    observationClass: OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE,
    evaluationMethod: evaluationMethod(),
    recordedAt: T2,
    comparisonClaims: {
      decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
      observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
    },
    ...rest,
    outcomeArtifact,
  };
}

function buildValidEvaluation(overrides = {}) {
  const result = buildObservedOutcomeEvaluation(validEvalInput(overrides));
  expect(result.ok).toBe(true);
  return result.artifact;
}

function cloneEval(ev) {
  return JSON.parse(JSON.stringify(ev));
}

function mutateEval(ev, mutator) {
  const c = cloneEval(ev);
  mutator(c);
  return c;
}

function expectFail(fn, codeSubstring) {
  try {
    fn();
    throw new Error(`expected fail-closed throw containing ${codeSubstring}`);
  } catch (err) {
    if (String(err.message || '').startsWith('expected fail-closed')) throw err;
    expect(err).toBeInstanceOf(Error);
    const hay = `${err.code || ''} ${err.message || ''}`;
    expect(hay).toContain(codeSubstring);
  }
}

function buildMismatchEvaluation() {
  return buildValidEvaluation({
    outcomeArtifact: buildValidOutcome({
      decisionRef: decisionRef({ decisionId: DECISION_ID_MISMATCH }),
    }),
    comparisonClaims: {
      decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
      observedDirection: DIRECTION_OR_ABSTAIN.BEARISH,
    },
  });
}

function buildEmptyMatchEvaluation() {
  return buildValidEvaluation({
    outcomeArtifact: buildValidOutcome({
      decisionRef: decisionRef({ decisionId: DECISION_ID_EMPTY_MATCH }),
    }),
    comparisonClaims: null,
  });
}

function buildBlockedEvaluation() {
  return buildValidEvaluation({
    blockedReason: 'evaluation_gate_blocked',
    comparisonClaims: null,
  });
}

function buildUnavailableEval(obsClass) {
  return buildValidEvaluation({
    observationClass: obsClass,
    comparisonClaims: null,
  });
}

function buildInsufficientDataEvaluation() {
  return buildValidEvaluation({
    comparisonClaims: {
      decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
    },
  });
}

function buildEvalForCohort({
  symbol = 'BTC/USDT',
  timeframe = '1h',
  venue = 'mexc',
  marketType = MARKET_TYPE.SPOT,
  decisionId = DECISION_ID,
} = {}) {
  return buildValidEvaluation({
    outcomeArtifact: buildValidOutcome({
      decisionRef: decisionRef({ decisionId }),
      marketContextRef: marketContextRef({
        venue,
        marketType,
        symbol,
        timeframe,
      }),
    }),
  });
}

// ---------------------------------------------------------------------------
// A–C constants / authority
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — constants & authority', () => {
  it('A. exact canonical constants/version identity', () => {
    expect(EVALUATION_PERFORMANCE_AGGREGATE_SCHEMA_VERSION).toBe('1.0.0');
    expect(EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION).toBe(
      'artemis-evaluation-performance-aggregate-1.0.0',
    );
    expect(EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION).toBe(
      'artemis-evaluation-performance-aggregate-policy-1.0.0',
    );
    expect(EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION).toBe('1.0.0');
    expect(EVALUATION_PERFORMANCE_AGGREGATE_ARTIFACT_TYPE).toBe(
      'ARTEMIS_EVALUATION_PERFORMANCE_AGGREGATE',
    );
    expect(EVALUATION_PERFORMANCE_AGGREGATE_WRITER).toBe(
      'artemisEvaluationPerformanceAggregateContract',
    );
    expect(EVALUATION_PERFORMANCE_AGGREGATE_METHOD_KEY).toBe(
      'artemis.evaluation.performance.aggregate.v1',
    );
    expect(EVALUATION_PERFORMANCE_AGGREGATE_OWNERSHIP_ROLE).toBe(
      'VALIDATION_BOUNDARY',
    );
  });

  it('B. authorityClass OUTCOME_EVALUATION', () => {
    expect(EVALUATION_PERFORMANCE_AGGREGATE_AUTHORITY_CLASS).toBe(
      'OUTCOME_EVALUATION',
    );
    expect(EVALUATION_PERFORMANCE_AGGREGATE_SLICE_ID).toBe(
      'S10-EVALUATION-PERFORMANCE-AGGREGATE-CONTRACT',
    );
  });

  it('C. isSourceOfTruth false', () => {
    expect(EVALUATION_PERFORMANCE_AGGREGATE_IS_SOURCE_OF_TRUTH).toBe(false);
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.isSourceOfTruth).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D–G build happy paths
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — build happy paths', () => {
  it('D. non-empty Evaluation input required', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [],
          recordedAt: T_AGG,
        }),
      'AGGREGATE_EVALUATIONS_REQUIRED',
    );
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          recordedAt: T_AGG,
        }),
      'AGGREGATE_EVALUATIONS_REQUIRED',
    );
  });

  it('E. valid single canonical Evaluation aggregate', () => {
    const ev = buildValidEvaluation();
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [ev],
      recordedAt: T_AGG,
    });
    expect(agg.artifactType).toBe(EVALUATION_PERFORMANCE_AGGREGATE_ARTIFACT_TYPE);
    expect(agg.authorityClass).toBe('OUTCOME_EVALUATION');
    expect(agg.counts.sourceEvaluationCount).toBe(1);
    expect(agg.counts.matchCount).toBe(1);
    expect(agg.counts.directionalComparableCount).toBe(1);
    expect(agg.performanceRatios.matchRatio.status).toBe(
      AGGREGATE_RATIO_STATUS.AVAILABLE,
    );
    expect(agg.performanceRatios.matchRatio.numerator).toBe(1);
    expect(agg.performanceRatios.matchRatio.denominator).toBe(1);
  });

  it('F. valid multiple Evaluation aggregate', () => {
    const match = buildValidEvaluation();
    const mismatch = buildMismatchEvaluation();
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [match, mismatch],
      recordedAt: T_AGG,
    });
    expect(agg.counts.sourceEvaluationCount).toBe(2);
    expect(agg.counts.matchCount).toBe(1);
    expect(agg.counts.mismatchCount).toBe(1);
    expect(agg.counts.directionalComparableCount).toBe(2);
  });

  it('G. counts derived internally', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.counts.matchCount).toBe(1);
    expect(agg.counts.evaluationStatusCounts[EVALUATION_STATUS.MATCH]).toBe(1);
    expect(Object.isFrozen(agg.counts)).toBe(true);
    expect(Object.isFrozen(agg)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// H–M caller aggregate authority forbidden
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — caller authority forbidden', () => {
  it('H. caller matchCount rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          matchCount: 1,
        }),
      'AGGREGATE',
    );
  });

  it('I. caller matchCount=0 rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          matchCount: 0,
        }),
      'AGGREGATE',
    );
  });

  it('J. caller accuracy rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          accuracy: 0.5,
        }),
      'AGGREGATE',
    );
  });

  it('K. caller sampleCount rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          sampleCount: 10,
        }),
      'AGGREGATE',
    );
  });

  it('L. caller trustScore rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          trustScore: 0.9,
        }),
      'AGGREGATE',
    );
  });

  it('M. caller promotionStatus rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          promotionStatus: 'ELIGIBLE',
        }),
      'AGGREGATE',
    );
  });
});

// ---------------------------------------------------------------------------
// N–S directional / empty MATCH / contradictions
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — directional classification', () => {
  it('N. raw MATCH + explicit matching directions increments directional match', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.counts.evaluationStatusCounts.MATCH).toBe(1);
    expect(agg.counts.matchCount).toBe(1);
    expect(agg.counts.directionalComparableCount).toBe(1);
  });

  it('O. raw MISMATCH + explicit differing directions increments directional mismatch', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildMismatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.counts.evaluationStatusCounts.MISMATCH).toBe(1);
    expect(agg.counts.mismatchCount).toBe(1);
    expect(agg.counts.matchCount).toBe(0);
    expect(agg.counts.directionalComparableCount).toBe(1);
  });

  it('P. MATCH without comparisonClaims does NOT increment matchCount', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildEmptyMatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.counts.matchCount).toBe(0);
    expect(agg.counts.directionalComparableCount).toBe(0);
    expect(agg.counts.directionalNonComparableCount).toBe(1);
  });

  it('Q. MATCH without comparisonClaims increments raw MATCH status count only', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildEmptyMatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.counts.evaluationStatusCounts.MATCH).toBe(1);
    expect(agg.counts.matchCount).toBe(0);
    expect(agg.performanceRatios.matchRatio.status).toBe(
      AGGREGATE_RATIO_STATUS.UNAVAILABLE,
    );
    expect(agg.performanceRatios.matchRatio.reason).toBe(
      AGGREGATE_RATIO_STATUS.NO_COMPARABLE_EVIDENCE,
    );
  });

  it('R. contradictory MATCH/directions fail closed', () => {
    const base = buildValidEvaluation();
    const corrupted = mutateEval(base, (e) => {
      e.comparisonClaims = {
        decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BEARISH,
      };
      // status stays MATCH while directions imply MISMATCH
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [corrupted],
          recordedAt: T_AGG,
        }),
      'EVALUATION_DIRECTION_STATUS_CONFLICT',
    );
  });

  it('S. contradictory MISMATCH/directions fail closed', () => {
    const base = buildMismatchEvaluation();
    const corrupted = mutateEval(base, (e) => {
      e.comparisonClaims = {
        decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
      };
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [corrupted],
          recordedAt: T_AGG,
        }),
      'EVALUATION_DIRECTION_STATUS_CONFLICT',
    );
  });
});

// ---------------------------------------------------------------------------
// T–Y observation / status handling
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — status & observation classes', () => {
  it('T. blocked remains blocked / not failure', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildBlockedEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.counts.evaluationStatusCounts.BLOCKED).toBe(1);
    expect(agg.counts.matchCount).toBe(0);
    expect(agg.counts.mismatchCount).toBe(0);
    expect(agg.counts.directionalComparableCount).toBe(0);
  });

  it('U. unavailable remains unavailable / not failure', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [
        buildUnavailableEval(OBSERVATION_CLASS.OBSERVED_BUT_UNAVAILABLE),
      ],
      recordedAt: T_AGG,
    });
    expect(agg.counts.evaluationStatusCounts.UNAVAILABLE).toBe(1);
    expect(agg.counts.matchCount).toBe(0);
    expect(agg.counts.directionalComparableCount).toBe(0);
  });

  it('V. insufficient data remains distinct', () => {
    const insuff = buildInsufficientDataEvaluation();
    expect(insuff.evaluationStatus).toBe(EVALUATION_STATUS.INSUFFICIENT_DATA);
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [insuff],
      recordedAt: T_AGG,
    });
    expect(agg.counts.evaluationStatusCounts.INSUFFICIENT_DATA).toBe(1);
    expect(agg.counts.matchCount).toBe(0);
    expect(agg.counts.mismatchCount).toBe(0);
  });

  it('W. OBSERVED_AND_EVALUABLE handling correct', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(
      agg.counts.observationClassCounts[OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE],
    ).toBe(1);
  });

  it('X. NOT_OBSERVED handling correct', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildUnavailableEval(OBSERVATION_CLASS.NOT_OBSERVED)],
      recordedAt: T_AGG,
    });
    expect(
      agg.counts.observationClassCounts[OBSERVATION_CLASS.NOT_OBSERVED],
    ).toBe(1);
    expect(agg.counts.directionalComparableCount).toBe(0);
  });

  it('Y. OBSERVED_BUT_UNAVAILABLE handling correct', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [
        buildUnavailableEval(OBSERVATION_CLASS.OBSERVED_BUT_UNAVAILABLE),
      ],
      recordedAt: T_AGG,
    });
    expect(
      agg.counts.observationClassCounts[
        OBSERVATION_CLASS.OBSERVED_BUT_UNAVAILABLE
      ],
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Z–AE ratios / invariants
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — ratios & invariants', () => {
  it('Z. directional comparable invariant', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation(), buildMismatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.counts.matchCount + agg.counts.mismatchCount).toBe(
      agg.counts.directionalComparableCount,
    );
    expect(
      agg.counts.directionalComparableCount
        + agg.counts.directionalNonComparableCount,
    ).toBe(agg.counts.sourceEvaluationCount);
  });

  it('AA. ratio numerator/denominator exact', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation(), buildMismatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.performanceRatios.matchRatio).toEqual({
      numerator: 1,
      denominator: 2,
      status: AGGREGATE_RATIO_STATUS.AVAILABLE,
    });
    expect(agg.performanceRatios.mismatchRatio).toEqual({
      numerator: 1,
      denominator: 2,
      status: AGGREGATE_RATIO_STATUS.AVAILABLE,
    });
  });

  it('AB. denominator zero returns unavailable ratio state', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildEmptyMatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.performanceRatios.matchRatio.status).toBe(
      AGGREGATE_RATIO_STATUS.UNAVAILABLE,
    );
    expect(agg.performanceRatios.matchRatio.reason).toBe(
      AGGREGATE_RATIO_STATUS.NO_COMPARABLE_EVIDENCE,
    );
    expect(agg.performanceRatios.matchRatio.numerator).toBe(0);
    expect(agg.performanceRatios.matchRatio.denominator).toBe(0);
  });

  it('AC. no NaN', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildEmptyMatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(Number.isNaN(agg.performanceRatios.matchRatio.numerator)).toBe(false);
    expect(Number.isNaN(agg.performanceRatios.matchRatio.denominator)).toBe(
      false,
    );
  });

  it('AD. no Infinity', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildEmptyMatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(Number.isFinite(agg.performanceRatios.matchRatio.numerator)).toBe(
      true,
    );
    expect(Number.isFinite(agg.performanceRatios.matchRatio.denominator)).toBe(
      true,
    );
  });

  it('AE. no invented floating rounding', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation(), buildMismatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.performanceRatios.matchRatio.value).toBeUndefined();
    expect(agg.performanceRatios.matchRatio.decimal).toBeUndefined();
    expect(agg.performanceRatios.matchRatio.percent).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AF–AL identity / ordering / recordedAt
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — identity & ordering', () => {
  it('AF. duplicate evaluationId fails closed', () => {
    const ev = buildValidEvaluation();
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [ev, cloneEval(ev)],
          recordedAt: T_AGG,
        }),
      'AGGREGATE_DUPLICATE_EVALUATION_ID',
    );
  });

  it('AG. input order does not alter aggregateId', () => {
    const a = buildValidEvaluation();
    const b = buildMismatchEvaluation();
    const agg1 = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [a, b],
      recordedAt: T_AGG,
    });
    const agg2 = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [b, a],
      recordedAt: T_AGG,
    });
    expect(agg1.aggregateId).toBe(agg2.aggregateId);
  });

  it('AH. input order does not alter counts/output source ref ordering', () => {
    const a = buildValidEvaluation();
    const b = buildMismatchEvaluation();
    const agg1 = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [a, b],
      recordedAt: T_AGG,
    });
    const agg2 = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [b, a],
      recordedAt: T_AGG,
    });
    expect(agg1.counts).toEqual(agg2.counts);
    expect(agg1.sourceEvaluationRefs.map((r) => r.evaluationId)).toEqual(
      agg2.sourceEvaluationRefs.map((r) => r.evaluationId),
    );
    const ids = agg1.sourceEvaluationRefs.map((r) => r.evaluationId);
    expect(ids).toEqual([...ids].sort());
  });

  it('AI. deterministic aggregateId', () => {
    const ev = buildValidEvaluation();
    const agg1 = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [ev],
      recordedAt: T_AGG,
    });
    const agg2 = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [ev],
      recordedAt: '2026-09-20T18:00:00.000Z',
    });
    expect(agg1.aggregateId).toBe(agg2.aggregateId);
    expect(agg1.aggregateId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('AJ. caller aggregateId mismatch rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          aggregateId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        }),
      'AGGREGATE_ID_MISMATCH',
    );
  });

  it('AK. recordedAt excluded from aggregate identity', () => {
    const ev = buildValidEvaluation();
    const id1 = computeEvaluationPerformanceAggregateId({
      cohort: {
        venue: 'mexc',
        marketType: MARKET_TYPE.SPOT,
        symbol: 'BTC/USDT',
        timeframe: '1h',
        methodKey:
          EVALUATION_METHOD_KEY.COMPARE_SHADOW_DECISION_TO_OBSERVED_OUTCOME_FAIL_CLOSED,
        implementationVersion: '1.0.0',
        policyVersion: OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION,
        contractVersion: OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
      },
      evaluationIds: [ev.evaluationId],
    });
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [ev],
      recordedAt: T_AGG,
    });
    expect(agg.aggregateId).toBe(id1);
  });

  it('AL. recordedAt before source evaluation rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: '2026-09-20T11:00:00.000Z',
        }),
      'AGGREGATE_RECORDED_AT_BEFORE_SOURCE',
    );
  });
});

// ---------------------------------------------------------------------------
// AM–AV evaluation validation / hard flags / side effects
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — evaluation validation', () => {
  it('AM. malformed evaluationId rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.evaluationId = 'not-a-uuid';
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AN. wrong Evaluation artifactType rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.artifactType = 'WRONG_TYPE';
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AO. wrong Evaluation contractVersion rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.contractVersion = 'wrong-version';
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AP. wrong Evaluation policyVersion rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.policyVersion = 'wrong-policy';
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AQ. wrong authorityClass rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.authorityClass = 'CALIBRATION';
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AR. wrong sliceId rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.sliceId = 'WRONG-SLICE';
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AS. hard flag missing rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      delete e.decisionEligible;
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AT. hard flag true rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.decisionEligible = true;
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AU. side-effect field missing rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      delete e.sideEffects.orders;
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AV. side-effect nonzero rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.sideEffects.orders = 1;
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AW. unknown Evaluation field rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.extraUnknownField = 'nope';
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
    );
  });
});

// ---------------------------------------------------------------------------
// AX–BD mixed cohort / version
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — cohort homogeneity', () => {
  it('AX. mixed evaluationMethod.methodKey cohort fails', () => {
    const a = buildValidEvaluation();
    const b = mutateEval(buildMismatchEvaluation(), (e) => {
      e.evaluationMethod = {
        ...e.evaluationMethod,
        methodKey: 'fabricated.method.key',
      };
    });
    // Will fail earlier at methodKey allowlist OR mixed version
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [a, b],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('AY. mixed evaluationMethod.implementationVersion fails', () => {
    const a = buildValidEvaluation();
    const b = mutateEval(buildMismatchEvaluation(), (e) => {
      e.evaluationMethod = {
        ...e.evaluationMethod,
        implementationVersion: '9.9.9',
      };
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [a, b],
          recordedAt: T_AGG,
        }),
      'MIXED_EVALUATION_VERSION_COHORT',
    );
  });

  it('AZ. mixed policyVersion fails', () => {
    const a = buildValidEvaluation();
    const b = mutateEval(buildMismatchEvaluation(), (e) => {
      e.policyVersion = 'other-policy';
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [a, b],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('BA. mixed symbol fails', () => {
    const a = buildEvalForCohort({
      symbol: 'BTC/USDT',
      decisionId: '11111111-1111-4111-8111-111111111111',
    });
    const b = buildEvalForCohort({
      symbol: 'ETH/USDT',
      decisionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [a, b],
          recordedAt: T_AGG,
        }),
      'MIXED_COHORT',
    );
  });

  it('BB. mixed timeframe fails', () => {
    const a = buildEvalForCohort({
      timeframe: '1h',
      decisionId: '11111111-1111-4111-8111-111111111111',
    });
    const b = buildEvalForCohort({
      timeframe: '4h',
      decisionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [a, b],
          recordedAt: T_AGG,
        }),
      'MIXED_COHORT',
    );
  });

  it('BC. mixed venue fails', () => {
    const a = buildEvalForCohort({
      venue: 'mexc',
      decisionId: '11111111-1111-4111-8111-111111111111',
    });
    const b = buildEvalForCohort({
      venue: 'binance',
      decisionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [a, b],
          recordedAt: T_AGG,
        }),
      'MIXED_COHORT',
    );
  });

  it('BD. mixed marketType fails', () => {
    const a = buildEvalForCohort({
      marketType: MARKET_TYPE.SPOT,
      decisionId: '11111111-1111-4111-8111-111111111111',
    });
    const b = buildEvalForCohort({
      marketType: MARKET_TYPE.FUTURES,
      decisionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [a, b],
          recordedAt: T_AGG,
        }),
      'MIXED_COHORT',
    );
  });

  it('BE. missing optional cohort dimension preserved deterministically', () => {
    // When marketContextRef absent on Evaluation — Evaluation builder always
    // includes it. Simulate by mutating away marketContextRef entirely.
    // Option-B allows null marketContextRef.
    const a = mutateEval(buildValidEvaluation(), (e) => {
      e.marketContextRef = null;
    });
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [a],
      recordedAt: T_AGG,
    });
    expect(agg.cohort.venue).toBeNull();
    expect(agg.cohort.symbol).toBeNull();
    expect(agg.cohort.timeframe).toBeNull();
    expect(agg.cohort.marketType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// BF–BL no invented policy / trust / calibration
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — no invented policy', () => {
  it('BF. no regime invented', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.cohort.regime).toBeUndefined();
    expect(agg.regime).toBeUndefined();
    expect(agg.regimeIdentityCanonical).toBe(false);
    expect(agg.regimeSegmentation).toBe('DEFERRED');
  });

  it('BG. no agentRole invented', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.cohort.agentRole).toBeUndefined();
    expect(agg.agentRole).toBeUndefined();
  });

  it('BH. no analysisHorizon invented', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.cohort.analysisHorizon).toBeUndefined();
    expect(agg.analysisHorizon).toBeUndefined();
  });

  it('BI. no sample-sufficiency verdict', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.sampleSufficiencyPolicy).toBe('DEFERRED');
    expect(agg.sampleSufficient).toBeUndefined();
    expect(agg.sufficient).toBeUndefined();
    expect(agg.mature).toBeUndefined();
  });

  it('BJ. no trust/weight semantics', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.trustScore).toBeUndefined();
    expect(agg.weight).toBeUndefined();
    expect(agg.agentWeight).toBeUndefined();
    expect(agg.trustMutation).toBe(false);
    expect(agg.weightMutation).toBe(false);
  });

  it('BK. no promotion/demotion semantics', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.promotionStatus).toBeUndefined();
    expect(agg.demotionStatus).toBeUndefined();
    expect(agg.promotionEligible).toBeUndefined();
    expect(agg.promotionExecution).toBe(false);
    expect(agg.demotionExecution).toBe(false);
  });

  it('BL. no Brier/calibration semantics', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.brier).toBeUndefined();
    expect(agg.brierScore).toBeUndefined();
    expect(agg.ece).toBeUndefined();
    expect(agg.calibrationError).toBeUndefined();
    expect(agg.calibrationExecution).toBe(false);
    expect(agg.sideEffects.brier).toBe(0);
    expect(agg.sideEffects.calibration).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// BM–BQ source refs / immutability
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — refs & immutability', () => {
  it('BM. source refs are thin', () => {
    const ev = buildValidEvaluation();
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [ev],
      recordedAt: T_AGG,
    });
    const ref = agg.sourceEvaluationRefs[0];
    expect(ref.evaluationId).toBe(ev.evaluationId);
    expect(ref.contractVersion).toBe(ev.contractVersion);
    expect(ref.decisionRef).toBeUndefined();
    expect(ref.outcomeRef).toBeUndefined();
    expect(ref.comparisonClaims).toBeUndefined();
    expect(ref.provenance).toBeUndefined();
  });

  it('BN. source refs sorted by evaluationId', () => {
    const a = buildValidEvaluation();
    const b = buildMismatchEvaluation();
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [a, b],
      recordedAt: T_AGG,
    });
    const ids = agg.sourceEvaluationRefs.map((r) => r.evaluationId);
    expect(ids).toEqual([...ids].sort());
  });

  it('BO. full source artifacts not embedded in output', () => {
    const ev = buildValidEvaluation();
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [ev],
      recordedAt: T_AGG,
    });
    expect(agg.evaluations).toBeUndefined();
    expect(JSON.stringify(agg)).not.toContain('"outcomeRef"');
    expect(agg.sourceEvaluationRefs[0].lineage).toBeUndefined();
  });

  it('BP. deep immutability', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(Object.isFrozen(agg)).toBe(true);
    expect(Object.isFrozen(agg.counts)).toBe(true);
    expect(Object.isFrozen(agg.counts.evaluationStatusCounts)).toBe(true);
    expect(Object.isFrozen(agg.performanceRatios)).toBe(true);
    expect(Object.isFrozen(agg.performanceRatios.matchRatio)).toBe(true);
    expect(Object.isFrozen(agg.cohort)).toBe(true);
    expect(Object.isFrozen(agg.sourceEvaluationRefs)).toBe(true);
    expect(Object.isFrozen(agg.sourceEvaluationRefs[0])).toBe(true);
    expect(Object.isFrozen(agg.sideEffects)).toBe(true);
    expect(() => {
      agg.counts.matchCount = 99;
    }).toThrow();
  });

  it('BQ. shallow-freeze cannot bypass nested freeze', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(() => {
      agg.counts.evaluationStatusCounts.MATCH = 999;
    }).toThrow();
    expect(() => {
      agg.sideEffects.orders = 1;
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// BR–BX safety / ledger / flags
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — safety & ledger', () => {
  it('BR. no Date.now', () => {
    // Contract source verified at suite level via source scan in adversarial
    expect(true).toBe(true);
  });

  it('BS. no randomness', () => {
    const ev = buildValidEvaluation();
    const ids = new Set();
    for (let i = 0; i < 5; i += 1) {
      ids.add(
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [ev],
          recordedAt: T_AGG,
        }).aggregateId,
      );
    }
    expect(ids.size).toBe(1);
  });

  it('BT. secrets rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          apiKey: 'secret',
        }),
      'AGGREGATE',
    );
  });

  it('BU. raw provider payload rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          providerPayload: { raw: true },
        }),
      'AGGREGATE',
    );
  });

  it('BV. artifact size bound exists (smoke does not exceed)', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(JSON.stringify(agg).length).toBeGreaterThan(100);
    expect(JSON.stringify(agg).length).toBeLessThan(500_000);
  });

  it('BW. complete zero side-effect ledger', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    for (const [k, v] of Object.entries(ZERO_AGGREGATE_SIDE_EFFECTS)) {
      expect(agg.sideEffects[k]).toBe(0);
      expect(v).toBe(0);
    }
  });

  it('BX. explicit hard-authority false flags', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
      expect(agg[key]).toBe(false);
    }
  });

  it('BY. source Evaluation SoT remains read/reference only', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.sourceEvaluationSot).toBe('READ_REFERENCE_ONLY');
    expect(agg.evaluationSotQueryAuthority).toBe(false);
  });

  it('BZ. current Path D state untouched (limitations include no calibration)', () => {
    expect(AGGREGATE_LIMITATIONS).toContain('no_calibration_execution');
    expect(AGGREGATE_LIMITATIONS).toContain('no_binary_brier_execution');
    expect(AGGREGATE_LIMITATIONS).toContain(
      'caller_supplied_evaluation_set',
    );
    expect(AGGREGATE_LIMITATIONS).toContain(
      'not_dataset_completeness_authority',
    );
  });
});

// ---------------------------------------------------------------------------
// validate API + adversarial
// ---------------------------------------------------------------------------

describe('S10 Evaluation Performance Aggregate — validate API', () => {
  it('validate rebuilds from evaluations', () => {
    const rebuilt = validateArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(rebuilt.counts.matchCount).toBe(1);
  });

  it('validate {artifact, evaluations} compares identity', () => {
    const evaluations = [buildValidEvaluation()];
    const artifact = buildArtemisEvaluationPerformanceAggregate({
      evaluations,
      recordedAt: T_AGG,
    });
    const out = validateArtemisEvaluationPerformanceAggregate({
      artifact,
      evaluations,
      recordedAt: T_AGG,
    });
    expect(out.aggregateId).toBe(artifact.aggregateId);
  });

  it('validate without source evaluations fails closed', () => {
    const artifact = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expectFail(
      () =>
        validateArtemisEvaluationPerformanceAggregate({
          artifact,
        }),
      'AGGREGATE_SOURCE_EVALUATIONS_REQUIRED',
    );
  });

  it('validate rejects tampered counts', () => {
    const evaluations = [buildValidEvaluation()];
    const artifact = buildArtemisEvaluationPerformanceAggregate({
      evaluations,
      recordedAt: T_AGG,
    });
    // Cannot mutate frozen artifact; build a structural clone with wrong counts
    const tampered = JSON.parse(JSON.stringify(artifact));
    tampered.counts.matchCount = 99;
    expectFail(
      () =>
        validateArtemisEvaluationPerformanceAggregate({
          artifact: tampered,
          evaluations,
          recordedAt: T_AGG,
        }),
      'AGGREGATE_COUNT_MISMATCH',
    );
  });
});

describe('S10 Evaluation Performance Aggregate — adversarial', () => {
  it('nested caller matchCount=0 rejected', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          provenance: { note: 'x', matchCount: 0 },
        }),
      'AGGREGATE',
    );
  });

  it('comparable directions vocabulary frozen', () => {
    expect(COMPARABLE_DIRECTIONS.BULLISH).toBe(DIRECTION_OR_ABSTAIN.BULLISH);
    expect(Object.isFrozen(COMPARABLE_DIRECTIONS)).toBe(true);
  });

  it('abstain directions are non-comparable', () => {
    const withAbstain = buildValidEvaluation({
      comparisonClaims: {
        decisionDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
        observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
      },
    });
    expect(withAbstain.evaluationStatus).toBe(EVALUATION_STATUS.INSUFFICIENT_DATA);
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [withAbstain],
      recordedAt: T_AGG,
    });
    expect(agg.counts.directionalComparableCount).toBe(0);
    expect(agg.counts.directionalNonComparableCount).toBe(1);
    expect(agg.counts.matchCount).toBe(0);
    expect(agg.counts.mismatchCount).toBe(0);
    expect(agg.counts.evaluationStatusCounts.INSUFFICIENT_DATA).toBe(1);
  });

  it('timeCoverage derived from source set only', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.timeCoverage.earliestEvaluationRecordedAt).toBe(T2);
    expect(agg.timeCoverage.latestEvaluationRecordedAt).toBe(T2);
    expect(agg.timeCoverage.rollingWindow).toBeUndefined();
    expect(agg.timeCoverage.canonicalWindow).toBeUndefined();
  });

  it('caller limitations may extend but not remove canonical', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation()],
      recordedAt: T_AGG,
      limitations: ['extra_caller_note'],
    });
    expect(agg.limitations).toContain(
      'caller_supplied_evaluation_set',
    );
    expect(agg.limitations).toContain('extra_caller_note');
  });

  it('provenance writer/methodKey locked', () => {
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [buildValidEvaluation()],
          recordedAt: T_AGG,
          provenance: { writer: 'attacker' },
        }),
      'AGGREGATE_PROVENANCE_OVERRIDE_FORBIDDEN',
    );
  });

  it('accepts matching caller aggregateId', () => {
    const ev = buildValidEvaluation();
    const preview = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [ev],
      recordedAt: T_AGG,
    });
    const again = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [ev],
      recordedAt: T_AGG,
      aggregateId: preview.aggregateId,
    });
    expect(again.aggregateId).toBe(preview.aggregateId);
  });

  it('wrong Evaluation isSourceOfTruth rejected', () => {
    const bad = mutateEval(buildValidEvaluation(), (e) => {
      e.isSourceOfTruth = true;
    });
    expectFail(
      () =>
        buildArtemisEvaluationPerformanceAggregate({
          evaluations: [bad],
          recordedAt: T_AGG,
        }),
      'AGGREGATE',
    );
  });

  it('contract source has no Date.now / Math.random / randomUUID', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL(
        '../../contracts/artemisEvaluationPerformanceAggregateContract.js',
        import.meta.url,
      ),
      'utf8',
    );
    expect(src.includes('Date.now')).toBe(false);
    expect(src.includes('Math.random')).toBe(false);
    expect(src.includes('randomUUID')).toBe(false);
  });

  it('emptyMatchPerformanceBypass CLOSED on artifact', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildEmptyMatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.emptyMatchPerformanceBypass).toBe('CLOSED');
    expect(agg.callerSuppliedAggregateAuthority).toBe(false);
  });

  it('mixed EMPTY_MATCH + comparable MATCH partition correct', () => {
    const agg = buildArtemisEvaluationPerformanceAggregate({
      evaluations: [buildValidEvaluation(), buildEmptyMatchEvaluation()],
      recordedAt: T_AGG,
    });
    expect(agg.counts.sourceEvaluationCount).toBe(2);
    expect(agg.counts.evaluationStatusCounts.MATCH).toBe(2);
    expect(agg.counts.matchCount).toBe(1);
    expect(agg.counts.directionalComparableCount).toBe(1);
    expect(agg.counts.directionalNonComparableCount).toBe(1);
  });
});
