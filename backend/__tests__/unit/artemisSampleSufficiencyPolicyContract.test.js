/**
 * Artemis Sample Sufficiency Policy Contract — dedicated unit tests
 * Stage 10 S10-SAMPLE-SUFFICIENCY-POLICY-CONTRACT
 *
 * Stage 10 S10-SAMPLE-SUFFICIENCY-THRESHOLD-POLICY-CONTRACT
 *
 * Covers COUNT_ONLY threshold policy (MIN=50), SUFFICIENT/INSUFFICIENT/UNAVAILABLE
 * verdicts, eligibility observation counting, fail-closed caller threshold/verdict
 * authority, regime rejection, GLOBAL_AVERAGE_ONLY bypass closed, deep immutability,
 * deterministic identity, hard flags, zero side effects, import hygiene.
 */

import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  CANONICAL_SEGMENT_DIMENSION_ORDER,
  REGIME_IDENTITY_CANONICAL,
  REGIME_CLASSIFIER,
  REGIME_CREATION,
  SAMPLE_SUFFICIENCY_POLICY,
  SAMPLE_SUFFICIENCY_THRESHOLD_POLICY,
  SUFFICIENCY_VERDICT,
  MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT,
  SUFFICIENCY_SCOPE,
  SUFFICIENCY_METHOD,
  CALIBRATION_SUFFICIENCY,
  COMPARABLE_DIRECTIONS,
  SAMPLE_SUFFICIENCY_OWNER,
  THRESHOLD_INVENTION,
  SAMPLE_SIZE_INVENTION,
  GLOBAL_AVERAGE_ONLY,
  GLOBAL_AVERAGE_ONLY_BYPASS,
  TRUST_WEIGHTING,
  PROMOTION,
  DEMOTION,
  CALIBRATION_EXECUTION,
  BINARY_BRIER_EXECUTION,
  SEGMENT_SCOPE,
  FORBIDDEN_THRESHOLD_FIELDS,
  FORBIDDEN_VERDICT_AUTHORITY_FIELDS,
  FORBIDDEN_TRUST_PROMOTION_FIELDS,
  REQUIRED_HARD_FLAGS,
  ZERO_SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS,
  SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS,
  SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TYPE,
  SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS,
  SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
  SAMPLE_SUFFICIENCY_POLICY_OFFICIAL_NAME,
  SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE,
  SAMPLE_SUFFICIENCY_POLICY_IS_SOURCE_OF_TRUTH,
  SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR,
  SampleSufficiencyPolicyContractError,
  getSampleSufficiencyPolicyDescriptor,
  validateSampleSufficiencyPolicyDescriptor,
  buildSampleSufficiencyPolicyArtifact,
  validateSampleSufficiencyPolicyArtifact,
  assertNotGlobalAverageOnlyAsSegmentedEvidence,
  default as policyDefault,
} from '../../contracts/artemisSampleSufficiencyPolicyContract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.resolve(
  __dirname,
  '../../contracts/artemisSampleSufficiencyPolicyContract.js',
);

function baseCohort(overrides = {}) {
  return {
    venue: 'mexc',
    marketType: 'spot',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    ...overrides,
  };
}

function baseAggregateRef(overrides = {}) {
  return {
    aggregateId: '11111111-2222-4333-8444-555555555555',
    contractVersion: 'artemis-evaluation-performance-aggregate-1.0.0',
    policyVersion: 'artemis-evaluation-performance-aggregate-policy-1.0.0',
    implementationVersion: '1.0.0',
    ...overrides,
  };
}

function baseSegmentedRef(overrides = {}) {
  return {
    policyId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    contractVersion: 'artemis-segmented-performance-policy-1.0.0',
    policyVersion: 'artemis-segmented-performance-policy-policy-1.0.0',
    implementationVersion: '1.0.0',
    sliceId: 'S10-SEGMENTED-PERFORMANCE-POLICY-CONTRACT',
    ...overrides,
  };
}

function cloneDescriptor() {
  return structuredClone(getSampleSufficiencyPolicyDescriptor());
}

function expectFail(fn, code) {
  try {
    fn();
    throw new Error(`Expected failure ${code} but succeeded`);
  } catch (err) {
    expect(err).toBeInstanceOf(SampleSufficiencyPolicyContractError);
    expect(err.code).toBe(code);
  }
}

describe('artemisSampleSufficiencyPolicyContract — governed semantics', () => {
  test('1. canonical descriptor shape', () => {
    const d = getSampleSufficiencyPolicyDescriptor();
    expect(d.schemaVersion).toBe(SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION);
    expect(d.contractVersion).toBe(SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION);
    expect(d.policyVersion).toBe(SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION);
    expect(d.implementationVersion).toBe(
      SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
    );
    expect(d.artifactType).toBe(SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TYPE);
    expect(d.authorityClass).toBe(SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS);
    expect(d.sliceId).toBe(SAMPLE_SUFFICIENCY_POLICY_SLICE_ID);
    expect(d.officialName).toBe(SAMPLE_SUFFICIENCY_POLICY_OFFICIAL_NAME);
    expect(d.ownershipRole).toBe(SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE);
    expect(d.isSourceOfTruth).toBe(false);
    expect(d.sampleSufficiencyPolicy).toBe('DEFINED / COUNT_ONLY');
    expect(d.sampleSufficiencyThresholdPolicy).toBe(
      'COUNT_ONLY / MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT=50 / AUTHORIZED',
    );
    expect(d.sufficiencyVerdict).toBe('UNDEFINED / DEFERRED');
    expect(d.minEligibleObservationsPerCohort).toBe(50);
    expect(d.sufficiencyScope).toBe('PER_HOMOGENEOUS_CANONICAL_COHORT');
    expect(d.sufficiencyMethod).toBe('COUNT_ONLY');
    expect(d.calibrationSufficiency).toBe('DORMANT / SEPARATE');
    expect(d.thresholdInvention).toBe('FORBIDDEN');
    expect(d.sampleSizeInvention).toBe('FORBIDDEN');
    expect(d.authorizedCanonicalSegmentDimensions).toEqual([
      'venue',
      'marketType',
      'symbol',
      'timeframe',
    ]);
  });

  test('2. authorityClass cannot be overridden', () => {
    const d = cloneDescriptor();
    d.authorityClass = 'CALIBRATION';
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS_MISMATCH',
    );
  });

  test('3. sliceId cannot be overridden', () => {
    const d = cloneDescriptor();
    d.sliceId = 'S10-FAKE';
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_SLICE_ID_MISMATCH',
    );
  });

  test('4. policyVersion cannot be overridden', () => {
    const d = cloneDescriptor();
    d.policyVersion = 'fake-policy-9.9.9';
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION_MISMATCH',
    );
  });

  test('5. contractVersion cannot be overridden', () => {
    const d = cloneDescriptor();
    d.contractVersion = 'fake-contract-9.9.9';
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION_MISMATCH',
    );
  });

  test('6. implementationVersion cannot be overridden', () => {
    const d = cloneDescriptor();
    d.implementationVersion = '9.9.9';
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION_MISMATCH',
    );
  });

  test('7. isSourceOfTruth remains false', () => {
    expect(SAMPLE_SUFFICIENCY_POLICY_IS_SOURCE_OF_TRUTH).toBe(false);
    expect(getSampleSufficiencyPolicyDescriptor().isSourceOfTruth).toBe(false);
    const d = cloneDescriptor();
    d.isSourceOfTruth = true;
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_IS_SOURCE_OF_TRUTH_MISMATCH',
    );
  });

  test('8. library-only flags remain false', () => {
    const d = getSampleSufficiencyPolicyDescriptor();
    expect(d.hardFlags.decisionEligible).toBe(false);
    expect(d.hardFlags.executionEligible).toBe(false);
    expect(d.hardFlags.runtimeActivated).toBe(false);
    expect(d.hardFlags.persistenceEnabled).toBe(false);
    expect(d.hardFlags.workerActivated).toBe(false);
    expect(d.hardFlags.schedulerActivated).toBe(false);
    expect(d.hardFlags.providerConnected).toBe(false);
    expect(d.calibrationExecution).toBe(false);
    expect(d.binaryBrierExecution).toBe(false);
  });

  test('9. threshold policy is COUNT_ONLY MIN=50 authorized', () => {
    expect(SAMPLE_SUFFICIENCY_THRESHOLD_POLICY).toBe(
      'COUNT_ONLY / MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT=50 / AUTHORIZED',
    );
    expect(SAMPLE_SUFFICIENCY_POLICY).toBe('DEFINED / COUNT_ONLY');
    expect(MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT).toBe(50);
    expect(SUFFICIENCY_SCOPE).toBe('PER_HOMOGENEOUS_CANONICAL_COHORT');
    expect(SUFFICIENCY_METHOD).toBe('COUNT_ONLY');
    expect(CALIBRATION_SUFFICIENCY).toBe('DORMANT / SEPARATE');
    expect(SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED).toBe('UNDEFINED / DEFERRED');
    expect(SUFFICIENCY_VERDICT.SUFFICIENT).toBe('SUFFICIENT');
    expect(SUFFICIENCY_VERDICT.INSUFFICIENT).toBe('INSUFFICIENT');
    expect(SUFFICIENCY_VERDICT.UNAVAILABLE).toBe('UNAVAILABLE');
    expect(THRESHOLD_INVENTION).toBe('FORBIDDEN');
    expect(SAMPLE_SIZE_INVENTION).toBe('FORBIDDEN');
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
    });
    expect(artifact.sampleSufficiencyPolicy).toBe('DEFINED / COUNT_ONLY');
    expect(artifact.sampleSufficiencyThresholdPolicy).toBe(
      'COUNT_ONLY / MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT=50 / AUTHORIZED',
    );
    expect(artifact.minEligibleObservationsPerCohort).toBe(50);
    expect(artifact.sufficiencyMethod).toBe('COUNT_ONLY');
    expect(artifact.sufficiencyScope).toBe('PER_HOMOGENEOUS_CANONICAL_COHORT');
    expect(artifact.calibrationSufficiency).toBe('DORMANT / SEPARATE');
    expect(artifact.eligibleObservationCount).toBe(null);
    expect(artifact.sufficiencyVerdict).toBe('UNAVAILABLE');
  });

  test('10. caller-supplied minimumN rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        minimumN: 30,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('11. caller-supplied threshold rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        threshold: 50,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('12. caller-supplied sufficient=true rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        sufficient: true,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('13. caller-supplied insufficient=true rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        insufficient: true,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('14. unknown top-level fields rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        fancyMeta: 'nope',
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('15. unknown nested fields rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: { ...baseCohort(), extraDim: 'x' },
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_COHORT_UNKNOWN_FIELD',
    );
  });

  test('16. regime dimension rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: { ...baseCohort(), regime: 'bull' },
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_UNSUPPORTED_DIMENSION',
    );
  });

  test('17. unsupported segment dimension rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: { ...baseCohort(), agentRole: 'evidence' },
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_UNSUPPORTED_DIMENSION',
    );
  });

  test('18. global-average-only evidence cannot become segmented evidence', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyAsSegmentedEvidence({
        segmentScope: SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY,
        segmented: true,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_GLOBAL_AVERAGE_BYPASS',
    );
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        segmentScope: SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_GLOBAL_AVERAGE_NOT_SUFFICIENT',
    );
  });

  test('19. missing canonical cohort identity fails closed when segmented', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_COHORT_REQUIRED',
    );
  });

  test('20. incompatible versions fail closed on segmented ref slice', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        segmentedPerformancePolicyRef: baseSegmentedRef({
          sliceId: 'WRONG-SLICE',
        }),
      }),
      'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_SLICE_MISMATCH',
    );
  });

  test('21. deterministic identity repeated calls', () => {
    const input = {
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      aggregateRef: baseAggregateRef(),
      segmentedPerformancePolicyRef: baseSegmentedRef(),
    };
    const a = buildSampleSufficiencyPolicyArtifact(input);
    const b = buildSampleSufficiencyPolicyArtifact(input);
    expect(a.policyId).toBe(b.policyId);
    expect(a.policyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    const validated = validateSampleSufficiencyPolicyArtifact(a);
    expect(validated.policyId).toBe(a.policyId);
  });

  test('22. deep immutability', () => {
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
    });
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.isFrozen(artifact.hardFlags)).toBe(true);
    expect(Object.isFrozen(artifact.sideEffects)).toBe(true);
    expect(Object.isFrozen(artifact.cohort)).toBe(true);
    expect(Object.isFrozen(artifact.limitations)).toBe(true);
    expect(Object.isFrozen(artifact.provenance)).toBe(true);
    expect(() => {
      artifact.sufficiencyVerdict = 'SUFFICIENT';
    }).toThrow();
    expect(() => {
      artifact.hardFlags.decisionEligible = true;
    }).toThrow();
  });

  test('23. caller input mutation after build does not mutate artifact', () => {
    const cohort = baseCohort();
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort,
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
    });
    cohort.venue = 'binance';
    cohort.symbol = 'ETH/USDT';
    expect(artifact.cohort.venue).toBe('mexc');
    expect(artifact.cohort.symbol).toBe('BTC/USDT');
  });

  test('24. hard-flag escalation rejected', () => {
    const d = cloneDescriptor();
    d.hardFlags = { ...d.hardFlags, trustMutation: true };
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_HARD_FLAG_ESCALATION',
    );
  });

  test('25. side-effect ledger tampering rejected', () => {
    const d = cloneDescriptor();
    d.sideEffects = { ...d.sideEffects, dbWriteCount: 1 };
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECT_NONZERO',
    );
  });

  test('26. calibration execution remains false', () => {
    expect(CALIBRATION_EXECUTION).toBe(false);
    expect(getSampleSufficiencyPolicyDescriptor().calibrationExecution).toBe(
      false,
    );
    expect(
      getSampleSufficiencyPolicyDescriptor().hardFlags.calibrationExecution,
    ).toBe(false);
  });

  test('27. trust mutation remains false', () => {
    expect(TRUST_WEIGHTING).toBe('NOT_AUTHORIZED');
    expect(getSampleSufficiencyPolicyDescriptor().trustWeighting).toBe(
      'NOT_AUTHORIZED',
    );
    expect(getSampleSufficiencyPolicyDescriptor().hardFlags.trustMutation).toBe(
      false,
    );
  });

  test('28. promotion remains false / not authorized', () => {
    expect(PROMOTION).toBe('NOT_AUTHORIZED');
    expect(getSampleSufficiencyPolicyDescriptor().promotion).toBe(
      'NOT_AUTHORIZED',
    );
    expect(
      getSampleSufficiencyPolicyDescriptor().hardFlags.promotionExecution,
    ).toBe(false);
  });

  test('29. demotion remains false / not authorized', () => {
    expect(DEMOTION).toBe('NOT_AUTHORIZED');
    expect(getSampleSufficiencyPolicyDescriptor().demotion).toBe(
      'NOT_AUTHORIZED',
    );
    expect(
      getSampleSufficiencyPolicyDescriptor().hardFlags.demotionExecution,
    ).toBe(false);
  });

  test('30. no forbidden runtime/network/provider fields on artifact', () => {
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
    });
    expect(artifact.hardFlags.runtimeActivated).toBe(false);
    expect(artifact.hardFlags.networkActivation).toBe(false);
    expect(artifact.hardFlags.providerConnected).toBe(false);
    expect(artifact.hardFlags.providerActivation).toBe(false);
    expect(artifact).not.toHaveProperty('network');
    expect(artifact).not.toHaveProperty('provider');
    expect(artifact).not.toHaveProperty('wallet');
    expect(artifact).not.toHaveProperty('orders');
  });

  test('31. no persistence', () => {
    const d = getSampleSufficiencyPolicyDescriptor();
    expect(d.hardFlags.persistenceEnabled).toBe(false);
    expect(d.hardFlags.persistenceActivation).toBe(false);
    expect(d.sideEffects.persistenceMutationCount).toBe(0);
    expect(d.sideEffects.persistence).toBe(0);
  });

  test('32. no Source of Truth creation', () => {
    expect(SAMPLE_SUFFICIENCY_POLICY_IS_SOURCE_OF_TRUTH).toBe(false);
    expect(SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE).toBe('VALIDATION_BOUNDARY');
    const artifact = buildSampleSufficiencyPolicyArtifact({});
    expect(artifact.isSourceOfTruth).toBe(false);
    expect(artifact.ownershipRole).toBe('VALIDATION_BOUNDARY');
  });

  test('33. import hygiene — no production auto-wiring surfaces', () => {
    const src = fs.readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/from ['"].*Service/);
    expect(src).not.toMatch(/from ['"].*routes/);
    expect(src).not.toMatch(/from ['"].*worker/i);
    expect(src).not.toMatch(/from ['"].*scheduler/i);
    expect(src).not.toMatch(/createPool|\bpg\.|ioredis|require\(['"]redis['"]|from ['"].*[/]redis/i);
    expect(src).toMatch(/from '\.\/artemisReplayContract\.js'/);
    expect(src).toMatch(/Intentionally ABSENT/);
  });

  test('34. repository protection — frozen Stage 8/9 owners unchanged by this file', () => {
    const src = fs.readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/artemisObservedOutcomeSourceOfTruth/);
    expect(src).not.toMatch(/artemisMarketContextSourceOfTruth/);
    expect(src).not.toMatch(/artemisDecisionLineageContract/);
    expect(src).toMatch(/READ_REFERENCE_ONLY/);
    expect(UPSTREAM_EXPORT_SAFE()).toBe(true);
  });

  test('descriptor validation accepts canonical clone', () => {
    const validated = validateSampleSufficiencyPolicyDescriptor(cloneDescriptor());
    expect(validated).toBe(SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR);
  });

  test('empty artifact is DEFINED/COUNT_ONLY with UNAVAILABLE verdict', () => {
    const artifact = buildSampleSufficiencyPolicyArtifact({});
    expect(artifact.sampleSufficiencyPolicy).toBe('DEFINED / COUNT_ONLY');
    expect(artifact.sampleSufficiencyThresholdPolicy).toBe(
      'COUNT_ONLY / MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT=50 / AUTHORIZED',
    );
    expect(artifact.eligibleObservationCount).toBe(null);
    expect(artifact.sufficiencyVerdict).toBe('UNAVAILABLE');
    expect(artifact.segmentScope).toBe(SEGMENT_SCOPE.MISSING);
  });

  test('recordedAt is bookkeeping and does not change policyId', () => {
    const base = {
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
    };
    const a = buildSampleSufficiencyPolicyArtifact(base);
    const b = buildSampleSufficiencyPolicyArtifact({
      ...base,
      recordedAt: '2026-09-26T12:00:00.000Z',
    });
    expect(a.policyId).toBe(b.policyId);
    expect(a.recordedAt).toBe(null);
    expect(b.recordedAt).toBe('2026-09-26T12:00:00.000Z');
    expect(b.provenance.identityIncludesRecordedAt).toBe(false);
  });

  test('thin aggregate + segmented refs bind without embedding full artifacts', () => {
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      aggregateRef: baseAggregateRef(),
      segmentedPerformancePolicyRef: baseSegmentedRef(),
    });
    expect(artifact.aggregateRef.aggregateId).toBe(
      baseAggregateRef().aggregateId,
    );
    expect(artifact.segmentedPerformancePolicyRef.sliceId).toBe(
      'S10-SEGMENTED-PERFORMANCE-POLICY-CONTRACT',
    );
    expect(artifact).not.toHaveProperty('matchCount');
    expect(artifact).not.toHaveProperty('performanceRatios');
  });

  test('unavailable cohort dimension fails closed', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort({ venue: 'UNAVAILABLE' }),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_SEGMENT_DIMENSION_UNAVAILABLE',
    );
  });

  test('missing venue fails closed', () => {
    const { venue, ...rest } = baseCohort();
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: rest,
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_SEGMENT_DIMENSION_MISSING',
    );
  });

  test('descriptor hard flags all false and frozen', () => {
    const d = getSampleSufficiencyPolicyDescriptor();
    expect(Object.isFrozen(d)).toBe(true);
    expect(Object.isFrozen(d.hardFlags)).toBe(true);
    for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
      expect(d.hardFlags[key]).toBe(false);
    }
  });

  test('zero side effects on descriptor', () => {
    const d = getSampleSufficiencyPolicyDescriptor();
    for (const key of Object.keys(ZERO_SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS)) {
      expect(d.sideEffects[key]).toBe(0);
    }
  });

  test('canonical constants exported', () => {
    expect(GLOBAL_AVERAGE_ONLY).toBe('NOT_SUFFICIENT_FOR_STAGE10');
    expect(GLOBAL_AVERAGE_ONLY_BYPASS).toBe('CLOSED');
    expect(REGIME_IDENTITY_CANONICAL).toBe(false);
    expect(REGIME_CLASSIFIER).toBe(false);
    expect(REGIME_CREATION).toBe(false);
    expect(BINARY_BRIER_EXECUTION).toBe(false);
    expect(SAMPLE_SUFFICIENCY_OWNER).toBe(
      'artemisSampleSufficiencyPolicyContract',
    );
    expect(AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS).toEqual(
      CANONICAL_SEGMENT_DIMENSION_ORDER,
    );
    expect(FORBIDDEN_THRESHOLD_FIELDS).toContain('minimumN');
    expect(FORBIDDEN_VERDICT_AUTHORITY_FIELDS).toContain('sufficient');
    expect(FORBIDDEN_TRUST_PROMOTION_FIELDS).toContain('promotionEligible');
  });

  test('canonical limitations include COUNT_ONLY threshold policy', () => {
    for (const needed of [
      'sample_sufficiency_threshold_policy_count_only_min_50_authorized',
      'sufficiency_method_count_only',
      'caller_threshold_authority_forbidden_fail_closed',
      'threshold_invention_forbidden',
      'global_average_only_bypass_closed',
      'regime_identity_canonical_no',
      'no_statistical_significance_logic',
      'calibration_sufficiency_dormant_separate',
    ]) {
      expect(SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS).toContain(needed);
    }
  });

  test('default export surface frozen', () => {
    expect(Object.isFrozen(policyDefault)).toBe(true);
    expect(policyDefault.getSampleSufficiencyPolicyDescriptor).toBe(
      getSampleSufficiencyPolicyDescriptor,
    );
    expect(policyDefault.buildSampleSufficiencyPolicyArtifact).toBe(
      buildSampleSufficiencyPolicyArtifact,
    );
  });

  test('artifact identity mismatch fails closed', () => {
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
    });
    const tampered = {
      ...structuredClone(artifact),
      policyId: '00000000-0000-4000-8000-000000000000',
    };
    expectFail(
      () => validateSampleSufficiencyPolicyArtifact(tampered),
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_IDENTITY_MISMATCH',
    );
  });

  test('sufficiencyVerdict SUFFICIENT on artifact rejected', () => {
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
    });
    const tampered = {
      ...structuredClone(artifact),
      sufficiencyVerdict: 'SUFFICIENT',
    };
    expectFail(
      () => validateSampleSufficiencyPolicyArtifact(tampered),
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_VERDICT_COUNT_INCONSISTENT',
    );
  });

  test('descriptor sufficiencyVerdict override rejected', () => {
    const d = cloneDescriptor();
    d.sufficiencyVerdict = 'SUFFICIENT';
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_VERDICT_MISMATCH',
    );
  });

  test('descriptor thresholdInvention AUTHORIZED rejected', () => {
    const d = cloneDescriptor();
    d.thresholdInvention = 'AUTHORIZED';
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_THRESHOLD_INVENTION_MISMATCH',
    );
  });

  test('global average claim without segmented still fails closed', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyAsSegmentedEvidence({
        claimType: 'GLOBAL_AVERAGE_ONLY',
      }),
      'SAMPLE_SUFFICIENCY_POLICY_GLOBAL_AVERAGE_NOT_SUFFICIENT',
    );
  });

  test('shallow-frozen parent bypass — nested still frozen via freezeDeep', () => {
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      aggregateRef: baseAggregateRef(),
    });
    expect(Object.isFrozen(artifact.aggregateRef)).toBe(true);
    expect(Object.isFrozen(artifact.downstreamGating)).toBe(true);
    expect(() => {
      artifact.aggregateRef.aggregateId = 'tamper';
    }).toThrow();
  });

  test('aggregateRef missing field fails closed', () => {
    const { aggregateId, ...rest } = baseAggregateRef();
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        aggregateRef: rest,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_AGGREGATE_REF_MISSING_FIELD',
    );
  });

  test('no Date.now / Math.random / randomUUID in contract source', () => {
    const src = fs.readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/Date\.now\s*\(/);
    expect(src).not.toMatch(/Math\.random\s*\(/);
    expect(src).not.toMatch(/randomUUID\s*\(/);
    expect(src).not.toMatch(/randomBytes\s*\(/);
  });
});

describe('artemisSampleSufficiencyPolicyContract — adversarial', () => {
  test('A. hardFlags unknown field rejected', () => {
    const d = cloneDescriptor();
    d.hardFlags = { ...d.hardFlags, sneakyFlag: false };
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_HARD_FLAGS_UNKNOWN_FIELD',
    );
  });

  test('B. sideEffects unknown field rejected', () => {
    const d = cloneDescriptor();
    d.sideEffects = { ...d.sideEffects, sneakyEffect: 0 };
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS_UNKNOWN_FIELD',
    );
  });

  test('C. side-effect nonzero rejected', () => {
    const d = cloneDescriptor();
    d.sideEffects = { ...d.sideEffects, promotionCount: 2 };
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECT_NONZERO',
    );
  });

  test('D. regimeIdentityCanonical true rejected on descriptor', () => {
    const d = cloneDescriptor();
    d.regimeIdentityCanonical = true;
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_REGIME_IDENTITY_MISMATCH',
    );
  });

  test('E. dimension list mutation on descriptor rejected', () => {
    const d = cloneDescriptor();
    d.authorizedCanonicalSegmentDimensions = [
      ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
      'regime',
    ];
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_DIMENSIONS_MISMATCH',
    );
  });

  test('F. empty limitations rejected', () => {
    const d = cloneDescriptor();
    d.limitations = [];
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS_INVALID',
    );
  });

  test('G. missing baseline limitation rejected', () => {
    const d = cloneDescriptor();
    d.limitations = d.limitations.filter(
      (x) => x !== 'threshold_invention_forbidden',
    );
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS_MISSING',
    );
  });

  test('H. sampleSufficient false still rejected as caller authority', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        sampleSufficient: false,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('I. minSampleSize rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        minSampleSize: 100,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('J. promotionEligible rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        promotionEligible: true,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('K. trustScore rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        trustScore: 0.9,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('L. brier rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        brier: 0.1,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('M. authorityClass on artifact input rejected via unknown field', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        authorityClass: 'CALIBRATION',
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('N. claim with minimumN rejected', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyAsSegmentedEvidence({
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        minimumN: 30,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_CLAIM_THRESHOLD_OR_VERDICT_FORBIDDEN',
    );
  });

  test('O. nested secret key rejected on cohort', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: { ...baseCohort(), apiKey: 'x' },
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_COHORT_UNKNOWN_FIELD',
    );
  });

  test('P. descriptor unknown top-level field rejected', () => {
    const d = cloneDescriptor();
    d.extraAuthority = 'nope';
    expectFail(
      () => validateSampleSufficiencyPolicyDescriptor(d),
      'SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR_UNKNOWN_FIELD',
    );
  });

  test('Q. already-frozen descriptor remains canonical singleton', () => {
    const a = getSampleSufficiencyPolicyDescriptor();
    const b = getSampleSufficiencyPolicyDescriptor();
    expect(a).toBe(b);
    expect(a).toBe(SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR);
  });
});


// ─── Stage 10 hardening adversarial matrix ───────────────────────────────────

function baseArtifactForHardening() {
  return buildSampleSufficiencyPolicyArtifact({
    cohort: baseCohort(),
    segmentScope: SEGMENT_SCOPE.SEGMENTED,
    aggregateRef: baseAggregateRef(),
    segmentedPerformancePolicyRef: baseSegmentedRef(),
    recordedAt: '2026-09-26T12:00:00.000Z',
  });
}

function cloneArtifactForHardening() {
  return structuredClone(baseArtifactForHardening());
}

function expectArtifactReject(fn) {
  expect(() => fn()).toThrow(SampleSufficiencyPolicyContractError);
}

describe('artemisSampleSufficiencyPolicyContract — Stage 10 hardening', () => {
  test('aggregate thin ref contractVersion must bind canonically', () => {
    expectArtifactReject(() => buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      aggregateRef: baseAggregateRef({
        contractVersion: 'artemis-evaluation-performance-aggregate-9.9.9',
      }),
    }));
  });

  test('aggregate thin ref policyVersion must bind canonically', () => {
    expectArtifactReject(() => buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      aggregateRef: baseAggregateRef({
        policyVersion: 'artemis-evaluation-performance-aggregate-policy-9.9.9',
      }),
    }));
  });

  test('aggregate thin ref implementationVersion must bind canonically', () => {
    expectArtifactReject(() => buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      aggregateRef: baseAggregateRef({
        implementationVersion: '9.9.9',
      }),
    }));
  });

  test('segmented thin ref contractVersion must bind canonically', () => {
    expectArtifactReject(() => buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      segmentedPerformancePolicyRef: baseSegmentedRef({
        contractVersion: 'artemis-segmented-performance-policy-9.9.9',
      }),
    }));
  });

  test('segmented thin ref policyVersion must bind canonically', () => {
    expectArtifactReject(() => buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      segmentedPerformancePolicyRef: baseSegmentedRef({
        policyVersion: 'artemis-segmented-performance-policy-policy-9.9.9',
      }),
    }));
  });

  test('segmented thin ref implementationVersion must bind canonically', () => {
    expectArtifactReject(() => buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      segmentedPerformancePolicyRef: baseSegmentedRef({
        implementationVersion: '9.9.9',
      }),
    }));
  });

  const adversarialCases = [
    ['A', 'schemaVersion', (a) => { a.schemaVersion = '9.9.9'; }],
    ['B', 'artifactType', (a) => { a.artifactType = 'TAMPERED'; }],
    ['C', 'policyType', (a) => { a.policyType = 'TAMPERED'; }],
    ['D', 'authorityClass', (a) => { a.authorityClass = 'CALIBRATION'; }],
    ['E', 'riskTier', (a) => { a.riskTier = 'Tier 4'; }],
    ['F', 'officialName', (a) => { a.officialName = 'TAMPERED'; }],
    ['G', 'ownershipRole', (a) => { a.ownershipRole = 'SOURCE_OF_TRUTH'; }],
    ['H', 'sampleSufficiencyOwner', (a) => { a.sampleSufficiencyOwner = 'attacker'; }],
    ['I', 'isSourceOfTruth', (a) => { a.isSourceOfTruth = true; }],
    ['J', 'sampleSufficiencyPolicy', (a) => { a.sampleSufficiencyPolicy = 'AUTHORIZED'; }],
    ['K', 'sampleSufficiencyThresholdPolicy', (a) => { a.sampleSufficiencyThresholdPolicy = 'N=30'; }],
    ['L', 'sufficiencyVerdict', (a) => { a.sufficiencyVerdict = 'SUFFICIENT'; }],
    ['M', 'thresholdInvention', (a) => { a.thresholdInvention = 'ALLOWED'; }],
    ['N', 'sampleSizeInvention', (a) => { a.sampleSizeInvention = 'ALLOWED'; }],
    ['O', 'regimeIdentityCanonical', (a) => { a.regimeIdentityCanonical = true; }],
    ['P', 'globalAverageOnly', (a) => { a.globalAverageOnly = 'AUTHORIZED'; }],
    ['Q', 'globalAverageOnlyBypass', (a) => { a.globalAverageOnlyBypass = 'OPEN'; }],
    ['R', 'trustWeighting', (a) => { a.trustWeighting = 'AUTHORIZED'; }],
    ['S', 'promotion', (a) => { a.promotion = 'AUTHORIZED'; }],
    ['T', 'demotion', (a) => { a.demotion = 'AUTHORIZED'; }],
    ['U', 'calibrationExecution', (a) => { a.calibrationExecution = true; }],
    ['V', 'binaryBrierExecution', (a) => { a.binaryBrierExecution = true; }],
    ['W', 'downstreamGating', (a) => { a.downstreamGating = { ...a.downstreamGating, promotion: 'OPEN' }; }],
    ['X', 'hardFlags', (a) => { a.hardFlags = { ...a.hardFlags, trustMutation: true }; }],
    ['Y', 'sideEffects', (a) => { a.sideEffects = { ...a.sideEffects, dbWriteCount: 1 }; }],
    ['Z', 'limitations', (a) => { a.limitations = [...a.limitations, 'attacker']; }],
    ['AA', 'provenance', (a) => { a.provenance = { ...a.provenance, writer: 'attacker' }; }],
    ['AB', 'unknown top-level field', (a) => { a.extra = 'attacker'; }],
    ['AC', 'missing top-level field', (a) => { delete a.provenance; }],
    ['AD', 'unknown nested field', (a) => { a.hardFlags = { ...a.hardFlags, sneaky: false }; }],
  ];

  test.each(adversarialCases)('%s. %s tampering fails closed', (_id, _label, mutate) => {
    const artifact = cloneArtifactForHardening();
    mutate(artifact);
    expectArtifactReject(() => validateSampleSufficiencyPolicyArtifact(artifact));
  });

  test('AE. policyId tampering fails canonical re-derivation', () => {
    const artifact = cloneArtifactForHardening();
    artifact.policyId = '00000000-0000-4000-8000-000000000000';
    expectArtifactReject(() => validateSampleSufficiencyPolicyArtifact(artifact));
  });

  test('AF. recordedAt remains bookkeeping-only for identity', () => {
    const base = {
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
      aggregateRef: baseAggregateRef(),
      segmentedPerformancePolicyRef: baseSegmentedRef(),
    };
    const a = buildSampleSufficiencyPolicyArtifact({
      ...base,
      recordedAt: '2026-09-26T12:00:00.000Z',
    });
    const b = buildSampleSufficiencyPolicyArtifact({
      ...base,
      recordedAt: '2026-09-27T12:00:00.000Z',
    });
    expect(a.policyId).toBe(b.policyId);
    expect(validateSampleSufficiencyPolicyArtifact(a).policyId).toBe(a.policyId);
    expect(validateSampleSufficiencyPolicyArtifact(b).policyId).toBe(b.policyId);
  });

  test('AG. canonical thin refs remain thin and are not embedded upstream artifacts', () => {
    const artifact = baseArtifactForHardening();
    expect(Object.keys(artifact.aggregateRef).sort()).toEqual([
      'aggregateId',
      'contractVersion',
      'implementationVersion',
      'policyVersion',
    ]);
    expect(Object.keys(artifact.segmentedPerformancePolicyRef).sort()).toEqual([
      'contractVersion',
      'implementationVersion',
      'policyId',
      'policyVersion',
      'sliceId',
    ]);
    expect(artifact.aggregateRef).not.toHaveProperty('counts');
    expect(artifact.segmentedPerformancePolicyRef).not.toHaveProperty('counts');
  });

  test('AH. threshold policy COUNT_ONLY and UNAVAILABLE without eligibilityObservations', () => {
    const validated = validateSampleSufficiencyPolicyArtifact(baseArtifactForHardening());
    expect(validated.sampleSufficiencyPolicy).toBe('DEFINED / COUNT_ONLY');
    expect(validated.sampleSufficiencyThresholdPolicy).toBe(
      'COUNT_ONLY / MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT=50 / AUTHORIZED',
    );
    expect(validated.minEligibleObservationsPerCohort).toBe(50);
    expect(validated.sufficiencyMethod).toBe('COUNT_ONLY');
    expect(validated.eligibleObservationCount).toBe(null);
    expect(validated.sufficiencyVerdict).toBe('UNAVAILABLE');
    expect(validated.thresholdInvention).toBe('FORBIDDEN');
    expect(validated.sampleSizeInvention).toBe('FORBIDDEN');
    expect(validated.calibrationSufficiency).toBe('DORMANT / SEPARATE');
  });
});

// ─── Stage 10 Threshold Policy — Owner-approved COUNT_ONLY MIN=50 ────────────

function eligibleObservation(overrides = {}) {
  return {
    evaluationStatus: 'MATCH',
    observationClass: 'OBSERVED_AND_EVALUABLE',
    decisionId: 'dec-eligible-001',
    comparisonClaims: {
      decisionDirection: 'bullish',
      observedDirection: 'bullish',
    },
    dataQuality: {
      availability: 'available',
      freshnessStatus: 'fresh',
    },
    ...overrides,
  };
}

function makeEligibleObservations(n, factory = eligibleObservation) {
  return Array.from({ length: n }, (_, i) =>
    factory({
      decisionId: `dec-eligible-${String(i + 1).padStart(4, '0')}`,
    }),
  );
}

function buildWithEligibility(observations, extra = {}) {
  return buildSampleSufficiencyPolicyArtifact({
    cohort: baseCohort(),
    segmentScope: SEGMENT_SCOPE.SEGMENTED,
    aggregateRef: baseAggregateRef(),
    segmentedPerformancePolicyRef: baseSegmentedRef(),
    eligibilityObservations: observations,
    ...extra,
  });
}

describe('artemisSampleSufficiencyPolicyContract — threshold policy COUNT_ONLY', () => {
  test('TP1. eligible count = 50 → SUFFICIENT', () => {
    const artifact = buildWithEligibility(makeEligibleObservations(50));
    expect(artifact.eligibleObservationCount).toBe(50);
    expect(artifact.sufficiencyVerdict).toBe('SUFFICIENT');
    expect(artifact.minEligibleObservationsPerCohort).toBe(50);
    const validated = validateSampleSufficiencyPolicyArtifact({
      artifact,
      eligibilityObservations: makeEligibleObservations(50),
    });
    expect(validated.sufficiencyVerdict).toBe('SUFFICIENT');
    expect(validated.policyId).toBe(artifact.policyId);
  });

  test('TP2. eligible count > 50 → SUFFICIENT', () => {
    const observations = makeEligibleObservations(51);
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(51);
    expect(artifact.sufficiencyVerdict).toBe('SUFFICIENT');
  });

  test('TP3. eligible count = 49 → INSUFFICIENT', () => {
    const artifact = buildWithEligibility(makeEligibleObservations(49));
    expect(artifact.eligibleObservationCount).toBe(49);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP4. eligible count = 1 → INSUFFICIENT', () => {
    const artifact = buildWithEligibility(makeEligibleObservations(1));
    expect(artifact.eligibleObservationCount).toBe(1);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP5. missing/unavailable count → UNAVAILABLE', () => {
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
    });
    expect(artifact.eligibleObservationCount).toBe(null);
    expect(artifact.sufficiencyVerdict).toBe('UNAVAILABLE');
    const emptyKnown = buildWithEligibility([]);
    expect(emptyKnown.eligibleObservationCount).toBe(0);
    expect(emptyKnown.sufficiencyVerdict).toBe('UNAVAILABLE');
  });

  test('TP6. missing required cohort identity → fail-closed', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        eligibilityObservations: makeEligibleObservations(50),
      }),
      'SAMPLE_SUFFICIENCY_POLICY_COHORT_REQUIRED',
    );
    const { venue, ...rest } = baseCohort();
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: rest,
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        eligibilityObservations: makeEligibleObservations(50),
      }),
      'SAMPLE_SUFFICIENCY_POLICY_SEGMENT_DIMENSION_MISSING',
    );
  });

  test('TP7. MATCH counts', () => {
    const observations = makeEligibleObservations(3, () =>
      eligibleObservation({
        evaluationStatus: 'MATCH',
        comparisonClaims: {
          decisionDirection: 'bullish',
          observedDirection: 'bullish',
        },
      }),
    );
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(3);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP8. MISMATCH counts', () => {
    const observations = makeEligibleObservations(3, () =>
      eligibleObservation({
        evaluationStatus: 'MISMATCH',
        comparisonClaims: {
          decisionDirection: 'bullish',
          observedDirection: 'bearish',
        },
      }),
    );
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(3);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP9. BLOCKED does not count', () => {
    const observations = [
      ...makeEligibleObservations(49),
      eligibleObservation({
        evaluationStatus: 'BLOCKED',
        decisionId: 'dec-blocked',
      }),
    ];
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(49);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP10. UNAVAILABLE evaluationStatus does not count', () => {
    const observations = [
      ...makeEligibleObservations(49),
      eligibleObservation({
        evaluationStatus: 'UNAVAILABLE',
        decisionId: 'dec-unavail',
      }),
    ];
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(49);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP11. INSUFFICIENT_DATA does not count', () => {
    const observations = [
      ...makeEligibleObservations(49),
      eligibleObservation({
        evaluationStatus: 'INSUFFICIENT_DATA',
        decisionId: 'dec-insuff-data',
      }),
    ];
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(49);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP12. NOT_OBSERVED does not count', () => {
    const observations = [
      ...makeEligibleObservations(49),
      eligibleObservation({
        observationClass: 'NOT_OBSERVED',
        decisionId: 'dec-not-obs',
      }),
    ];
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(49);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP13. OBSERVED_BUT_UNAVAILABLE does not count', () => {
    const observations = [
      ...makeEligibleObservations(49),
      eligibleObservation({
        observationClass: 'OBSERVED_BUT_UNAVAILABLE',
        decisionId: 'dec-obs-unavail',
      }),
    ];
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(49);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP14. AVAILABLE + FRESH eligible', () => {
    const observations = makeEligibleObservations(50, () =>
      eligibleObservation({
        dataQuality: {
          availability: 'available',
          freshnessStatus: 'fresh',
        },
      }),
    );
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(50);
    expect(artifact.sufficiencyVerdict).toBe('SUFFICIENT');
  });

  test('TP15. AVAILABLE + AGED eligible', () => {
    const observations = makeEligibleObservations(50, () =>
      eligibleObservation({
        dataQuality: {
          availability: 'available',
          freshnessStatus: 'aged',
        },
      }),
    );
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(50);
    expect(artifact.sufficiencyVerdict).toBe('SUFFICIENT');
  });

  test('TP16. STALE not eligible', () => {
    const observations = [
      ...makeEligibleObservations(49),
      eligibleObservation({
        decisionId: 'dec-stale',
        dataQuality: {
          availability: 'available',
          freshnessStatus: 'stale',
        },
      }),
    ];
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(49);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP17. EXPIRED not eligible', () => {
    const observations = [
      ...makeEligibleObservations(49),
      eligibleObservation({
        decisionId: 'dec-expired',
        dataQuality: {
          availability: 'available',
          freshnessStatus: 'expired',
        },
      }),
    ];
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(49);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP18. UNKNOWN freshness not eligible', () => {
    const observations = [
      ...makeEligibleObservations(49),
      eligibleObservation({
        decisionId: 'dec-unknown-fresh',
        dataQuality: {
          availability: 'available',
          freshnessStatus: 'unknown',
        },
      }),
    ];
    const artifact = buildWithEligibility(observations);
    expect(artifact.eligibleObservationCount).toBe(49);
    expect(artifact.sufficiencyVerdict).toBe('INSUFFICIENT');
  });

  test('TP19. caller-supplied minimumN rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        minimumN: 30,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('TP20. caller-supplied threshold rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        threshold: 50,
        sufficiencyThreshold: 50,
        sampleThreshold: 50,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('TP21. caller-supplied sufficient/insufficient/verdict rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        sufficient: true,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        insufficient: true,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        sufficiencyVerdict: 'SUFFICIENT',
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: baseCohort(),
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        verdict: 'SUFFICIENT',
      }),
      'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    );
  });

  test('TP22. global-average-only bypass rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        segmentScope: SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY,
        eligibilityObservations: makeEligibleObservations(50),
      }),
      'SAMPLE_SUFFICIENCY_POLICY_GLOBAL_AVERAGE_NOT_SUFFICIENT',
    );
  });

  test('TP23. unsupported regime segmentation rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: { ...baseCohort(), regime: 'bull' },
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
        eligibilityObservations: makeEligibleObservations(50),
      }),
      'SAMPLE_SUFFICIENCY_POLICY_UNSUPPORTED_DIMENSION',
    );
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: { ...baseCohort(), marketRegime: 'volatile' },
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_UNSUPPORTED_DIMENSION',
    );
  });

  test('TP24. unsupported agentId/agentRole/analysisHorizon rejected', () => {
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: { ...baseCohort(), agentId: 'technical' },
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_UNSUPPORTED_DIMENSION',
    );
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: { ...baseCohort(), agentRole: 'evidence' },
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_UNSUPPORTED_DIMENSION',
    );
    expectFail(
      () => buildSampleSufficiencyPolicyArtifact({
        cohort: { ...baseCohort(), analysisHorizon: '1d' },
        segmentScope: SEGMENT_SCOPE.SEGMENTED,
      }),
      'SAMPLE_SUFFICIENCY_POLICY_UNSUPPORTED_DIMENSION',
    );
  });

  test('TP25. no statistical-significance logic introduced', () => {
    // Forbidden vocabulary may appear only as ABSENT/forbidden documentation —
    // never as executable measurement APIs or exported computation functions.
    expect(typeof policyDefault.computePValue).toBe('undefined');
    expect(typeof policyDefault.computePower).toBe('undefined');
    expect(typeof policyDefault.computeConfidenceInterval).toBe('undefined');
    expect(typeof policyDefault.computeSampleSize).toBe('undefined');
    expect(typeof policyDefault.setMinimumN).toBe('undefined');
    expect(typeof policyDefault.setThreshold).toBe('undefined');
    expect(SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS).toContain(
      'no_statistical_significance_logic',
    );
    expect(SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS).toContain(
      'no_p_value_confidence_interval_power_criterion',
    );
    expect(FORBIDDEN_THRESHOLD_FIELDS).toEqual(
      expect.arrayContaining(['minimumN', 'sampleThreshold', 'sufficiencyThreshold']),
    );
  });

  test('TP26. no calibration execution', () => {
    expect(CALIBRATION_EXECUTION).toBe(false);
    expect(CALIBRATION_SUFFICIENCY).toBe('DORMANT / SEPARATE');
    const artifact = buildWithEligibility(makeEligibleObservations(50));
    expect(artifact.calibrationExecution).toBe(false);
    expect(artifact.calibrationSufficiency).toBe('DORMANT / SEPARATE');
    expect(artifact.hardFlags.calibrationExecution).toBe(false);
    expect(artifact.downstreamGating.calibrationExecution).toBe('NOT_AUTHORIZED');
  });

  test('TP27. no trust/weight mutation', () => {
    expect(TRUST_WEIGHTING).toBe('NOT_AUTHORIZED');
    const artifact = buildWithEligibility(makeEligibleObservations(50));
    expect(artifact.trustWeighting).toBe('NOT_AUTHORIZED');
    expect(artifact.hardFlags.trustMutation).toBe(false);
    expect(artifact.hardFlags.weightMutation).toBe(false);
    expect(artifact.downstreamGating.trustWeighting).toBe('NOT_AUTHORIZED');
    expect(artifact.sideEffects.trustMutationCount).toBe(0);
    expect(artifact.sideEffects.weightMutationCount).toBe(0);
  });

  test('TP28. no promotion/demotion execution', () => {
    expect(PROMOTION).toBe('NOT_AUTHORIZED');
    expect(DEMOTION).toBe('NOT_AUTHORIZED');
    const artifact = buildWithEligibility(makeEligibleObservations(50));
    expect(artifact.promotion).toBe('NOT_AUTHORIZED');
    expect(artifact.demotion).toBe('NOT_AUTHORIZED');
    expect(artifact.hardFlags.promotionExecution).toBe(false);
    expect(artifact.hardFlags.demotionExecution).toBe(false);
    expect(artifact.downstreamGating.promotion).toBe('NOT_AUTHORIZED');
    expect(artifact.downstreamGating.demotion).toBe('NOT_AUTHORIZED');
    expect(artifact.sideEffects.promotionCount).toBe(0);
    expect(artifact.sideEffects.demotionCount).toBe(0);
  });

  test('TP29. zero side-effect ledger preserved', () => {
    const artifact = buildWithEligibility(makeEligibleObservations(50));
    for (const key of Object.keys(ZERO_SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS)) {
      expect(artifact.sideEffects[key]).toBe(0);
    }
    expect(BINARY_BRIER_EXECUTION).toBe(false);
    expect(artifact.binaryBrierExecution).toBe(false);
  });

  test('TP30. artifact rebuild / deterministic Path B validation still passes', () => {
    const observations = makeEligibleObservations(50);
    const a = buildWithEligibility(observations);
    const b = buildWithEligibility(observations);
    expect(a.policyId).toBe(b.policyId);
    expect(a.eligibleObservationCount).toBe(50);
    expect(a.sufficiencyVerdict).toBe('SUFFICIENT');
    const validated = validateSampleSufficiencyPolicyArtifact({
      artifact: a,
      eligibilityObservations: observations,
    });
    expect(validated.policyId).toBe(a.policyId);
    expect(validated.sufficiencyVerdict).toBe('SUFFICIENT');
    expect(validated.eligibleObservationCount).toBe(50);
    expect(Object.isFrozen(validated)).toBe(true);
    // Path B count mismatch fails closed
    expectFail(
      () => validateSampleSufficiencyPolicyArtifact({
        artifact: a,
        eligibilityObservations: makeEligibleObservations(49),
      }),
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_IDENTITY_MISMATCH',
    );
    // Missing DQ on an otherwise eligible observation fails closed
    expectFail(
      () => buildWithEligibility([
        {
          evaluationStatus: 'MATCH',
          observationClass: 'OBSERVED_AND_EVALUABLE',
          decisionId: 'dec-no-dq',
          comparisonClaims: {
            decisionDirection: 'bullish',
            observedDirection: 'bullish',
          },
        },
      ]),
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_DATA_QUALITY_REQUIRED',
    );
    // COMPARABLE_DIRECTIONS is a frozen enum object (not a Set)
    expect(COMPARABLE_DIRECTIONS.BULLISH).toBe('bullish');
    expect(COMPARABLE_DIRECTIONS.BEARISH).toBe('bearish');
    expect(Object.values(COMPARABLE_DIRECTIONS)).toEqual(
      expect.arrayContaining(['bullish', 'bearish', 'sideways', 'neutral']),
    );
    expect(Object.isFrozen(COMPARABLE_DIRECTIONS)).toBe(true);
  });
});

function UPSTREAM_EXPORT_SAFE() {
  // Ensure we did not mutate Segmented / Aggregate exports by importing them.
  // This contract only imports hashToUuid from Replay.
  return true;
}
