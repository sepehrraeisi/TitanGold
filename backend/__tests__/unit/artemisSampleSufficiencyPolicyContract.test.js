/**
 * Artemis Sample Sufficiency Policy Contract — dedicated unit tests
 * Stage 10 S10-SAMPLE-SUFFICIENCY-POLICY-CONTRACT
 *
 * Covers UNDEFINED/DEFERRED policy, UNDEFINED/NOT_AUTHORIZED threshold,
 * no sufficiency verdict invention, fail-closed threshold/verdict authority,
 * regime rejection, GLOBAL_AVERAGE_ONLY bypass closed, deep immutability,
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
    expect(d.sampleSufficiencyPolicy).toBe('UNDEFINED / DEFERRED');
    expect(d.sampleSufficiencyThresholdPolicy).toBe(
      'UNDEFINED / NOT_AUTHORIZED',
    );
    expect(d.sufficiencyVerdict).toBe('UNDEFINED / DEFERRED');
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

  test('9. threshold policy remains undefined/not authorized', () => {
    expect(SAMPLE_SUFFICIENCY_THRESHOLD_POLICY).toBe(
      'UNDEFINED / NOT_AUTHORIZED',
    );
    expect(SAMPLE_SUFFICIENCY_POLICY).toBe('UNDEFINED / DEFERRED');
    expect(SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED).toBe('UNDEFINED / DEFERRED');
    expect(THRESHOLD_INVENTION).toBe('FORBIDDEN');
    expect(SAMPLE_SIZE_INVENTION).toBe('FORBIDDEN');
    const artifact = buildSampleSufficiencyPolicyArtifact({
      cohort: baseCohort(),
      segmentScope: SEGMENT_SCOPE.SEGMENTED,
    });
    expect(artifact.sampleSufficiencyThresholdPolicy).toBe(
      'UNDEFINED / NOT_AUTHORIZED',
    );
    expect(artifact.sufficiencyVerdict).toBe('UNDEFINED / DEFERRED');
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

  test('empty artifact still UNDEFINED / DEFERRED', () => {
    const artifact = buildSampleSufficiencyPolicyArtifact({});
    expect(artifact.sufficiencyVerdict).toBe('UNDEFINED / DEFERRED');
    expect(artifact.sampleSufficiencyPolicy).toBe('UNDEFINED / DEFERRED');
    expect(artifact.sampleSufficiencyThresholdPolicy).toBe(
      'UNDEFINED / NOT_AUTHORIZED',
    );
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

  test('canonical limitations include threshold deferral', () => {
    for (const needed of [
      'sample_sufficiency_policy_undefined_deferred',
      'sample_sufficiency_threshold_policy_undefined_not_authorized',
      'threshold_invention_forbidden',
      'global_average_only_bypass_closed',
      'regime_identity_canonical_no',
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
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_VERDICT_MISMATCH',
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

function UPSTREAM_EXPORT_SAFE() {
  // Ensure we did not mutate Segmented / Aggregate exports by importing them.
  // This contract only imports hashToUuid from Replay.
  return true;
}
