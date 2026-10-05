/**
 * Artemis Core Stage 10 — Promotion Policy Contract
 * Focused unit tests (library-only / fail-closed / zero side effects / memoryless).
 *
 * Slice: S10-PROMOTION-POLICY-CONTRACT
 * Official: ARTEMIS_PROMOTION_POLICY_CONTRACT
 * V1 states: PROMOTION_ELIGIBLE · NOT_PROMOTION_ELIGIBLE · PROMOTION_UNAVAILABLE
 */

import {
  AGGREGATE_REF_ALLOWLIST,
  ARTIFACT_ALLOWLIST,
  AUTHORIZED_AVAILABILITY_VALUES,
  AUTHORIZED_DEGRADATION_POLICY_STATES,
  AUTHORIZED_FRESHNESS_VALUES,
  AUTHORIZED_SAMPLE_SUFFICIENCY_VERDICTS,
  AUTHORIZED_TRUST_ELIGIBILITY_STATUSES,
  BINARY_BRIER_EXECUTION,
  CALIBRATION_EXECUTION,
  DATA_QUALITY_ALLOWLIST,
  DEMOTION,
  DEMOTION_EXECUTION,
  DETERMINISTIC,
  DQ_USABLE_AVAILABILITY,
  DQ_USABLE_FRESHNESS,
  FORBIDDEN_LIFECYCLE_FIELDS,
  FORBIDDEN_PROMOTION_AUTHORITY_FIELDS,
  FORBIDDEN_SCORE_FIELDS,
  FORBIDDEN_THRESHOLD_FIELDS,
  GLOBAL_AVERAGE_ONLY_BYPASS,
  INPUT_ALLOWLIST,
  LIBRARY_ONLY,
  MEMORYLESS,
  NUMERIC_PROMOTION_MODEL,
  PROMOTION_EXECUTION,
  PROMOTION_NUMERIC_THRESHOLD_V1,
  PROMOTION_POLICY_ARTIFACT_TYPE,
  PROMOTION_POLICY_AUTHORITY_CLASS,
  PROMOTION_POLICY_CONTRACT_VERSION,
  PROMOTION_POLICY_IMPLEMENTATION_VERSION,
  PROMOTION_POLICY_IS_SOURCE_OF_TRUTH,
  PROMOTION_POLICY_OFFICIAL_NAME,
  PROMOTION_POLICY_POLICY_VERSION,
  PROMOTION_POLICY_SLICE_ID,
  PROMOTION_STATUS,
  PromotionPolicyContractError,
  RECOMMENDATION_ONLY,
  REGIME_IDENTITY_CANONICAL,
  REQUIRED_HARD_FLAGS,
  SEGMENTED_POLICY_REF_ALLOWLIST,
  TRUST_MUTATION,
  ZERO_PROMOTION_POLICY_SIDE_EFFECTS,
  buildPromotionPolicyArtifact,
  getPromotionPolicyDescriptor,
  validatePromotionPolicyArtifact,
  validatePromotionPolicyDescriptor,
} from '../../contracts/artemisPromotionPolicyContract.js';
import {
  EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
} from '../../contracts/artemisEvaluationPerformanceAggregateContract.js';
import {
  SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
} from '../../contracts/artemisSegmentedPerformancePolicyContract.js';
import { TRUST_ELIGIBILITY_STATUS } from '../../contracts/artemisTrustWeightingPolicyContract.js';
import { SUFFICIENCY_VERDICT } from '../../contracts/artemisSampleSufficiencyPolicyContract.js';
import { POLICY_STATE } from '../../contracts/artemisDataQualityRegressionDegradationPolicyContract.js';
import {
  AVAILABILITY,
  FRESHNESS_STATUS,
} from '../../contracts/artemisEvidenceContract.js';

function baseCohort(overrides = {}) {
  return Object.freeze({
    venue: 'mexc',
    marketType: 'spot',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    contractVersion: PROMOTION_POLICY_CONTRACT_VERSION,
    policyVersion: PROMOTION_POLICY_POLICY_VERSION,
    implementationVersion: PROMOTION_POLICY_IMPLEMENTATION_VERSION,
    ...overrides,
  });
}

function baseAggregateRef(overrides = {}) {
  return Object.freeze({
    aggregateId: '11111111-1111-4111-8111-111111111111',
    contractVersion: EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
    policyVersion: EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
    implementationVersion: EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
    ...overrides,
  });
}

function baseSegmentedRef(overrides = {}) {
  return Object.freeze({
    policyId: '22222222-2222-4222-8222-222222222222',
    sliceId: SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
    contractVersion: SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
    policyVersion: SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
    implementationVersion: SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    ...overrides,
  });
}

function baseDataQuality(overrides = {}) {
  return Object.freeze({
    availability: AVAILABILITY.AVAILABLE,
    freshnessStatus: FRESHNESS_STATUS.FRESH,
    ...overrides,
  });
}

function baseInput(overrides = {}) {
  const {
    dataQuality: dataQualityOverride,
    cohort: cohortOverride,
    aggregateRef: aggregateRefOverride,
    segmentedPerformancePolicyRef: segmentedOverride,
    ...rest
  } = overrides;

  const input = {
    trustEligibilityStatus: TRUST_ELIGIBILITY_STATUS.TRUST_ELIGIBLE,
    sampleSufficiencyVerdict: SUFFICIENCY_VERDICT.SUFFICIENT,
    dataQuality: dataQualityOverride === undefined
      ? baseDataQuality()
      : dataQualityOverride,
    degradationPolicyState: POLICY_STATE.STABLE,
    aggregateRef: aggregateRefOverride === undefined
      ? baseAggregateRef()
      : aggregateRefOverride,
    segmentedPerformancePolicyRef: segmentedOverride === undefined
      ? baseSegmentedRef()
      : segmentedOverride,
    cohort: cohortOverride === undefined
      ? baseCohort()
      : cohortOverride,
    recordedAt: '2026-10-05T12:00:00.000Z',
    ...rest,
  };

  return input;
}

function expectFail(fn, code) {
  try {
    fn();
    throw new Error(`Expected PromotionPolicyContractError ${code}`);
  } catch (err) {
    if (!(err instanceof PromotionPolicyContractError)) {
      throw err;
    }
    expect(err.code).toBe(code);
  }
}

describe('artemisPromotionPolicyContract', () => {
  describe('descriptor', () => {
    test('returns frozen canonical descriptor', () => {
      const d = getPromotionPolicyDescriptor();
      expect(d.sliceId).toBe(PROMOTION_POLICY_SLICE_ID);
      expect(d.officialName).toBe(PROMOTION_POLICY_OFFICIAL_NAME);
      expect(d.authorityClass).toBe(PROMOTION_POLICY_AUTHORITY_CLASS);
      expect(d.contractVersion).toBe(PROMOTION_POLICY_CONTRACT_VERSION);
      expect(d.policyVersion).toBe(PROMOTION_POLICY_POLICY_VERSION);
      expect(d.implementationVersion).toBe(PROMOTION_POLICY_IMPLEMENTATION_VERSION);
      expect(d.isSourceOfTruth).toBe(false);
      expect(d.libraryOnly).toBe(true);
      expect(d.recommendationOnly).toBe(true);
      expect(d.memoryless).toBe(true);
      expect(d.deterministic).toBe(true);
      expect(d.numericPromotionModel).toBe('NONE');
      expect(Object.isFrozen(d)).toBe(true);
    });

    test('validatePromotionPolicyDescriptor accepts canonical', () => {
      const validated = validatePromotionPolicyDescriptor(
        getPromotionPolicyDescriptor(),
      );
      expect(validated.contractVersion).toBe(PROMOTION_POLICY_CONTRACT_VERSION);
    });

    test('validatePromotionPolicyDescriptor rejects tamper', () => {
      expectFail(
        () => validatePromotionPolicyDescriptor({
          ...getPromotionPolicyDescriptor(),
          sliceId: 'TAMPERED',
        }),
        'PROMOTION_POLICY_DESCRIPTOR_SLICE_ID_MISMATCH',
      );
    });
  });

  describe('PROMOTION_ELIGIBLE', () => {
    test('1. TRUST_ELIGIBLE + SUFFICIENT + AVAILABLE + FRESH + STABLE + valid Aggregate + valid Segmented + compatible identity/version', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput());
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_ELIGIBLE);
      expect(artifact.trustEligibilityStatus).toBe(TRUST_ELIGIBILITY_STATUS.TRUST_ELIGIBLE);
      expect(artifact.sampleSufficiencyVerdict).toBe(SUFFICIENCY_VERDICT.SUFFICIENT);
      expect(artifact.dataQuality.availability).toBe(AVAILABILITY.AVAILABLE);
      expect(artifact.dataQuality.freshnessStatus).toBe(FRESHNESS_STATUS.FRESH);
      expect(artifact.degradationPolicyState).toBe(POLICY_STATE.STABLE);
      expect(artifact.aggregateRef.aggregateId).toBe('11111111-1111-4111-8111-111111111111');
      expect(artifact.segmentedPerformancePolicyRef.sliceId).toBe(
        SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
      );
      expect(artifact.unavailableReason).toBeNull();
      expect(artifact.negativeGates).toEqual([]);
    });

    test('2. PROMOTION_ELIGIBLE with AGED freshness', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        dataQuality: baseDataQuality({ freshnessStatus: FRESHNESS_STATUS.AGED }),
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_ELIGIBLE);
      expect(artifact.dataQuality.freshnessStatus).toBe(FRESHNESS_STATUS.AGED);
    });
  });

  describe('NOT_PROMOTION_ELIGIBLE — valid negative gates', () => {
    test('3. NOT_TRUST_ELIGIBLE → NOT_PROMOTION_ELIGIBLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        trustEligibilityStatus: TRUST_ELIGIBILITY_STATUS.NOT_TRUST_ELIGIBLE,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.NOT_PROMOTION_ELIGIBLE);
      expect(artifact.negativeGates).toContain('NOT_TRUST_ELIGIBLE');
      expect(artifact.unavailableReason).toBeNull();
    });

    test('5. INSUFFICIENT → NOT_PROMOTION_ELIGIBLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        sampleSufficiencyVerdict: SUFFICIENCY_VERDICT.INSUFFICIENT,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.NOT_PROMOTION_ELIGIBLE);
      expect(artifact.negativeGates).toContain('INSUFFICIENT');
    });

    test('7. valid DQ outside eligible state → NOT_PROMOTION_ELIGIBLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        dataQuality: baseDataQuality({ freshnessStatus: FRESHNESS_STATUS.STALE }),
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.NOT_PROMOTION_ELIGIBLE);
      expect(artifact.negativeGates).toContain('DQ_OUTSIDE_ELIGIBLE_STATE');
    });

    test('7b. availability UNAVAILABLE (authorized) → NOT_PROMOTION_ELIGIBLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        dataQuality: baseDataQuality({ availability: AVAILABILITY.UNAVAILABLE }),
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.NOT_PROMOTION_ELIGIBLE);
      expect(artifact.negativeGates).toContain('DQ_OUTSIDE_ELIGIBLE_STATE');
    });

    test('8. DEGRADED → NOT_PROMOTION_ELIGIBLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        degradationPolicyState: POLICY_STATE.DEGRADED,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.NOT_PROMOTION_ELIGIBLE);
      expect(artifact.negativeGates).toContain('DEGRADED');
    });
  });

  describe('PROMOTION_UNAVAILABLE — unavailable / missing / incompatible', () => {
    test('4. TRUST_UNAVAILABLE → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        trustEligibilityStatus: TRUST_ELIGIBILITY_STATUS.TRUST_UNAVAILABLE,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('TRUST_UNAVAILABLE');
    });

    test('6. Sample Sufficiency UNAVAILABLE → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        sampleSufficiencyVerdict: SUFFICIENCY_VERDICT.UNAVAILABLE,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('SAMPLE_SUFFICIENCY_UNAVAILABLE');
    });

    test('9. REGRESSION_UNAVAILABLE → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        degradationPolicyState: POLICY_STATE.REGRESSION_UNAVAILABLE,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('REGRESSION_UNAVAILABLE');
    });

    test('10. missing Trust → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        trustEligibilityStatus: undefined,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('TRUST_MISSING');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.trustEligibilityStatus).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('11. malformed Trust → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        trustEligibilityStatus: 42,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('TRUST_MALFORMED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.trustEligibilityStatus).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('12. unsupported Trust status → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        trustEligibilityStatus: 'TRUST_MAYBE',
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('TRUST_UNSUPPORTED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.trustEligibilityStatus).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('13. missing Sample Sufficiency → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        sampleSufficiencyVerdict: undefined,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('SAMPLE_SUFFICIENCY_MISSING');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.sampleSufficiencyVerdict).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('14. unsupported Sample Sufficiency status → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        sampleSufficiencyVerdict: 'ALMOST_ENOUGH',
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('SAMPLE_SUFFICIENCY_UNSUPPORTED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.sampleSufficiencyVerdict).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('14b. UNDEFINED_DEFERRED Sample Sufficiency → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        sampleSufficiencyVerdict: SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('SAMPLE_SUFFICIENCY_UNSUPPORTED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.sampleSufficiencyVerdict).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('15. missing DQ → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        dataQuality: null,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('DQ_MISSING');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.dataQuality).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('16. malformed DQ → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        dataQuality: 'fresh',
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('DQ_MALFORMED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.dataQuality).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('17. unsupported freshnessStatus → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        dataQuality: baseDataQuality({ freshnessStatus: 'VERY_FRESH' }),
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('DQ_FRESHNESS_UNSUPPORTED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.dataQuality).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('18. missing degradation evidence → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        degradationPolicyState: undefined,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('DEGRADATION_MISSING');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.degradationPolicyState).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('19. unsupported degradation state → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        degradationPolicyState: 'IMPROVING',
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('DEGRADATION_UNSUPPORTED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.degradationPolicyState).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('20. missing Aggregate → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        aggregateRef: null,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('PROMOTION_POLICY_AGGREGATE_REF_MISSING');
    });

    test('21. malformed Aggregate → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        aggregateRef: { aggregateId: 'not-a-uuid' },
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(String(artifact.unavailableReason)).toMatch(/AGGREGATE|INVALID|MISSING/);
    });

    test('21b. Aggregate version mismatch → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        aggregateRef: baseAggregateRef({
          contractVersion: 'artemis-evaluation-performance-aggregate-0.0.0',
        }),
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe(
        'PROMOTION_POLICY_AGGREGATE_CONTRACT_VERSION_MISMATCH',
      );
    });

    test('22. missing Segmented → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        segmentedPerformancePolicyRef: null,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe(
        'PROMOTION_POLICY_SEGMENTED_REF_MISSING',
      );
    });

    test('23. malformed/unavailable Segmented → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        segmentedPerformancePolicyRef: {
          policyId: '22222222-2222-4222-8222-222222222222',
          sliceId: 'WRONG_SLICE',
          contractVersion: SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
          policyVersion: SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
          implementationVersion: SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
        },
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe(
        'PROMOTION_POLICY_SEGMENTED_SLICE_ID_MISMATCH',
      );
    });

    test('24. missing cohort identity → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        cohort: null,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('COHORT_MISSING');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.cohort).toBeNull();
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });

    test('25. cohort mismatch → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        cohort: baseCohort({ venue: 'MIXED_VENUE' }),
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('COHORT_MISMATCH');
    });

    test('25b. GLOBAL_AVERAGE_ONLY cohort → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        cohort: baseCohort({ symbol: 'GLOBAL_AVERAGE_ONLY' }),
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('COHORT_MISMATCH');
    });

    test('26. missing contractVersion → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        cohort: {
          venue: 'mexc',
          marketType: 'spot',
          symbol: 'BTC/USDT',
          timeframe: '1h',
          policyVersion: PROMOTION_POLICY_POLICY_VERSION,
          implementationVersion: PROMOTION_POLICY_IMPLEMENTATION_VERSION,
        },
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('VERSION_BINDING_MISSING');
    });

    test('27. missing policyVersion → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        cohort: {
          venue: 'mexc',
          marketType: 'spot',
          symbol: 'BTC/USDT',
          timeframe: '1h',
          contractVersion: PROMOTION_POLICY_CONTRACT_VERSION,
          implementationVersion: PROMOTION_POLICY_IMPLEMENTATION_VERSION,
        },
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('VERSION_BINDING_MISSING');
    });

    test('28. missing implementationVersion → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        cohort: {
          venue: 'mexc',
          marketType: 'spot',
          symbol: 'BTC/USDT',
          timeframe: '1h',
          contractVersion: PROMOTION_POLICY_CONTRACT_VERSION,
          policyVersion: PROMOTION_POLICY_POLICY_VERSION,
        },
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('VERSION_BINDING_MISSING');
    });

    test('29. version mismatch → PROMOTION_UNAVAILABLE', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        cohort: baseCohort({
          contractVersion: 'artemis-promotion-policy-0.0.1',
        }),
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('VERSION_BINDING_MISMATCH');
      expect(artifact.negativeGates).toEqual([]);
      expect(() => validatePromotionPolicyArtifact(artifact)).not.toThrow();
    });
  });

  describe('Human QA regression — PROMOTION_UNAVAILABLE soft-map + validator round-trip', () => {
    test('HQ1. missing Trust → PROMOTION_UNAVAILABLE → validator PASS', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        trustEligibilityStatus: undefined,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('TRUST_MISSING');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.trustEligibilityStatus).toBeNull();
      const validated = validatePromotionPolicyArtifact(artifact);
      expect(validated.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(validated.unavailableReason).toBe('TRUST_MISSING');
      expect(validated.policyId).toBe(artifact.policyId);
    });

    test('HQ2. malformed Trust → PROMOTION_UNAVAILABLE → validator PASS', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        trustEligibilityStatus: 42,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('TRUST_MALFORMED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.trustEligibilityStatus).toBeNull();
      const validated = validatePromotionPolicyArtifact(artifact);
      expect(validated.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(validated.unavailableReason).toBe('TRUST_MALFORMED');
      expect(validated.policyId).toBe(artifact.policyId);
    });

    test('HQ3. unsupported Trust → PROMOTION_UNAVAILABLE → validator PASS', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        trustEligibilityStatus: 'TRUST_PROMOTED',
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('TRUST_UNSUPPORTED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.trustEligibilityStatus).toBeNull();
      const validated = validatePromotionPolicyArtifact(artifact);
      expect(validated.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(validated.unavailableReason).toBe('TRUST_UNSUPPORTED');
      expect(validated.policyId).toBe(artifact.policyId);
    });

    test('HQ4. missing DQ → PROMOTION_UNAVAILABLE → validator PASS', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        dataQuality: null,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('DQ_MISSING');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.dataQuality).toBeNull();
      const validated = validatePromotionPolicyArtifact(artifact);
      expect(validated.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(validated.unavailableReason).toBe('DQ_MISSING');
      expect(validated.policyId).toBe(artifact.policyId);
    });

    test('HQ5. unsupported DQ freshness → PROMOTION_UNAVAILABLE → validator PASS', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        dataQuality: {
          availability: AVAILABILITY.AVAILABLE,
          freshnessStatus: 'VERY_FRESH',
        },
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('DQ_FRESHNESS_UNSUPPORTED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.dataQuality).toBeNull();
      const validated = validatePromotionPolicyArtifact(artifact);
      expect(validated.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(validated.unavailableReason).toBe('DQ_FRESHNESS_UNSUPPORTED');
      expect(validated.policyId).toBe(artifact.policyId);
    });

    test('HQ6. missing Degradation → PROMOTION_UNAVAILABLE → validator PASS', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        degradationPolicyState: undefined,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('DEGRADATION_MISSING');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.degradationPolicyState).toBeNull();
      const validated = validatePromotionPolicyArtifact(artifact);
      expect(validated.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(validated.unavailableReason).toBe('DEGRADATION_MISSING');
      expect(validated.policyId).toBe(artifact.policyId);
    });

    test('HQ7. malformed cohort → PROMOTION_UNAVAILABLE → validator PASS', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        cohort: 42,
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('COHORT_MALFORMED');
      expect(artifact.negativeGates).toEqual([]);
      expect(artifact.cohort).toBeNull();
      const validated = validatePromotionPolicyArtifact(artifact);
      expect(validated.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(validated.unavailableReason).toBe('COHORT_MALFORMED');
      expect(validated.policyId).toBe(artifact.policyId);
    });

    test('HQ8. version mismatch → PROMOTION_UNAVAILABLE → validator PASS', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput({
        cohort: baseCohort({
          contractVersion: 'artemis-promotion-policy-0.0.1',
        }),
      }));
      expect(artifact.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(artifact.unavailableReason).toBe('VERSION_BINDING_MISMATCH');
      expect(artifact.negativeGates).toEqual([]);
      const validated = validatePromotionPolicyArtifact(artifact);
      expect(validated.promotionStatus).toBe(PROMOTION_STATUS.PROMOTION_UNAVAILABLE);
      expect(validated.unavailableReason).toBe('VERSION_BINDING_MISMATCH');
      expect(validated.policyId).toBe(artifact.policyId);
    });

    test('HQ9. forbidden promotionStatus still THROWS', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          promotionStatus: PROMOTION_STATUS.PROMOTION_ELIGIBLE,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('HQ10. forbidden promotionScore still THROWS', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          promotionScore: 0.95,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });
  });

  describe('forbidden authority / score / threshold / lifecycle fields', () => {
    test('30. forbidden promotionStatus rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          promotionStatus: PROMOTION_STATUS.PROMOTION_ELIGIBLE,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('31. forbidden promotionScore rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          promotionScore: 0.95,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('32. forbidden promotionThreshold rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          promotionThreshold: 50,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('33. forbidden activation rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          activation: true,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('34. forbidden tier rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          tier: 'A',
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('35. forbidden lifecycleMutation rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          lifecycleMutation: true,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('36. forbidden runtimeActivation rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          runtimeActivation: true,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('37. forbidden cooldown/hysteresis rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          cooldown: 7,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          hysteresis: true,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          consecutiveSuccessCount: 3,
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          recoveryWindow: '7d',
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('nested forbidden promotionEligible rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          dataQuality: {
            ...baseDataQuality(),
            promotionEligible: true,
          },
        })),
        'PROMOTION_POLICY_CALLER_AUTHORITY_OVERRIDE',
      );
    });

    test('promoted / paperActivation / liveActivation rejected', () => {
      for (const field of ['promoted', 'paperActivation', 'liveActivation', 'agentActivation', 'modelActivation']) {
        expectFail(
          () => buildPromotionPolicyArtifact(baseInput({ [field]: true })),
          'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
        );
      }
    });
  });

  describe('no numeric Promotion threshold / zero side effects / memoryless', () => {
    test('38. no numeric Promotion threshold encoded', () => {
      expect(NUMERIC_PROMOTION_MODEL).toBe('NONE');
      expect(PROMOTION_NUMERIC_THRESHOLD_V1).toBe('NONE');
      const artifact = buildPromotionPolicyArtifact(baseInput());
      expect(Object.prototype.hasOwnProperty.call(artifact, 'promotionScore')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(artifact, 'promotionThreshold')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(artifact, 'matchRatioThreshold')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(artifact, 'trustScore')).toBe(false);
      expect(FORBIDDEN_SCORE_FIELDS).toEqual(expect.arrayContaining([
        'trustScore',
        'matchRatioThreshold',
      ]));
      expect(FORBIDDEN_PROMOTION_AUTHORITY_FIELDS).toEqual(expect.arrayContaining([
        'promotionScore',
        'promotionThreshold',
      ]));
      expect(FORBIDDEN_THRESHOLD_FIELDS).toEqual(expect.arrayContaining([
        'promotionThreshold',
        'minimumN',
      ]));
    });

    test('39. no persistence/runtime/network side effects', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput());
      expect(artifact.sideEffects).toEqual(ZERO_PROMOTION_POLICY_SIDE_EFFECTS);
      expect(artifact.sideEffects.networkCallCount).toBe(0);
      expect(artifact.sideEffects.providerCallCount).toBe(0);
      expect(artifact.sideEffects.dbWriteCount).toBe(0);
      expect(artifact.sideEffects.redisWriteCount).toBe(0);
      expect(artifact.sideEffects.runtimeMutationCount).toBe(0);
      expect(artifact.sideEffects.promotionExecutionCount).toBe(0);
      expect(artifact.sideEffects.demotionExecutionCount).toBe(0);
      expect(artifact.sideEffects.trustWeightMutationCount).toBe(0);
      expect(artifact.sideEffects.calibrationExecutionCount).toBe(0);
      expect(artifact.sideEffects.orderCount).toBe(0);
      expect(artifact.sideEffects.walletMutationCount).toBe(0);
      expect(artifact.hardFlags.persistenceActivation).toBe(false);
      expect(artifact.hardFlags.runtimeActivation).toBe(false);
      expect(artifact.hardFlags.promotionExecution).toBe(false);
      expect(artifact.hardFlags.demotionExecution).toBe(false);
      expect(artifact.hardFlags.trustMutation).toBe(false);
      expect(artifact.hardFlags.calibrationExecution).toBe(false);
      expect(artifact.hardFlags.isSourceOfTruth).toBe(false);
      expect(PROMOTION_EXECUTION).toBe(false);
      expect(DEMOTION_EXECUTION).toBe(false);
      expect(TRUST_MUTATION).toBe(false);
      expect(CALIBRATION_EXECUTION).toBe(false);
      expect(BINARY_BRIER_EXECUTION).toBe(false);
      expect(LIBRARY_ONLY).toBe(true);
      expect(RECOMMENDATION_ONLY).toBe(true);
      expect(MEMORYLESS).toBe(true);
      expect(DETERMINISTIC).toBe(true);
      expect(DEMOTION).toBe('DEFERRED');
      expect(GLOBAL_AVERAGE_ONLY_BYPASS).toBe('CLOSED');
      expect(REGIME_IDENTITY_CANONICAL).toBe(false);
      expect(PROMOTION_POLICY_IS_SOURCE_OF_TRUTH).toBe(false);
    });

    test('40. deterministic same-input same-output / stable policyId', () => {
      const a = buildPromotionPolicyArtifact(baseInput());
      const b = buildPromotionPolicyArtifact(baseInput());
      expect(a.policyId).toBe(b.policyId);
      expect(a.promotionStatus).toBe(b.promotionStatus);
      expect(a.contractVersion).toBe(PROMOTION_POLICY_CONTRACT_VERSION);
      expect(a.policyVersion).toBe(PROMOTION_POLICY_POLICY_VERSION);
      expect(a.implementationVersion).toBe(PROMOTION_POLICY_IMPLEMENTATION_VERSION);
      expect(a.artifactType).toBe(PROMOTION_POLICY_ARTIFACT_TYPE);
      expect(a.sliceId).toBe(PROMOTION_POLICY_SLICE_ID);
    });

    test('validate rebuild equality + deep freeze', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput());
      const validated = validatePromotionPolicyArtifact(artifact);
      expect(validated.policyId).toBe(artifact.policyId);
      expect(Object.isFrozen(validated)).toBe(true);
      expect(Object.isFrozen(validated.cohort)).toBe(true);
      expect(Object.isFrozen(validated.sideEffects)).toBe(true);
      expect(Object.isFrozen(validated.hardFlags)).toBe(true);
    });

    test('validate rejects tampered promotionStatus', () => {
      const artifact = buildPromotionPolicyArtifact(baseInput());
      expectFail(
        () => validatePromotionPolicyArtifact({
          ...artifact,
          promotionStatus: PROMOTION_STATUS.NOT_PROMOTION_ELIGIBLE,
        }),
        'PROMOTION_POLICY_ARTIFACT_STATUS_REBUILD_MISMATCH',
      );
    });

    test('hard-flag escalation rejected', () => {
      expectFail(
        () => buildPromotionPolicyArtifact(baseInput({
          hardFlags: { ...REQUIRED_HARD_FLAGS, promotionExecution: true },
        })),
        'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('V1 state model is exactly three statuses', () => {
      expect(Object.keys(PROMOTION_STATUS).sort()).toEqual([
        'NOT_PROMOTION_ELIGIBLE',
        'PROMOTION_ELIGIBLE',
        'PROMOTION_UNAVAILABLE',
      ].sort());
      expect(PROMOTION_STATUS).not.toHaveProperty('PROMOTED');
      expect(PROMOTION_STATUS).not.toHaveProperty('PROMOTION_BLOCKED');
      expect(PROMOTION_STATUS).not.toHaveProperty('READY');
      expect(PROMOTION_STATUS).not.toHaveProperty('CANDIDATE');
      expect(PROMOTION_STATUS).not.toHaveProperty('APPROVED');
      expect(PROMOTION_STATUS).not.toHaveProperty('ACTIVE');
    });

    test('authorized vocabulary bindings are frozen', () => {
      expect(Object.isFrozen(AUTHORIZED_TRUST_ELIGIBILITY_STATUSES)).toBe(true);
      expect(Object.isFrozen(AUTHORIZED_SAMPLE_SUFFICIENCY_VERDICTS)).toBe(true);
      expect(Object.isFrozen(AUTHORIZED_DEGRADATION_POLICY_STATES)).toBe(true);
      expect(Object.isFrozen(AUTHORIZED_AVAILABILITY_VALUES)).toBe(true);
      expect(Object.isFrozen(AUTHORIZED_FRESHNESS_VALUES)).toBe(true);
      expect(Object.isFrozen(DQ_USABLE_AVAILABILITY)).toBe(true);
      expect(Object.isFrozen(DQ_USABLE_FRESHNESS)).toBe(true);
      expect(Object.isFrozen(INPUT_ALLOWLIST)).toBe(true);
      expect(Object.isFrozen(ARTIFACT_ALLOWLIST)).toBe(true);
      expect(Object.isFrozen(AGGREGATE_REF_ALLOWLIST)).toBe(true);
      expect(Object.isFrozen(SEGMENTED_POLICY_REF_ALLOWLIST)).toBe(true);
      expect(Object.isFrozen(DATA_QUALITY_ALLOWLIST)).toBe(true);
      expect(Object.isFrozen(FORBIDDEN_PROMOTION_AUTHORITY_FIELDS)).toBe(true);
      expect(Object.isFrozen(FORBIDDEN_LIFECYCLE_FIELDS)).toBe(true);
      expect(Object.isFrozen(FORBIDDEN_THRESHOLD_FIELDS)).toBe(true);
    });

    test('recordedAt bookkeeping does not change policyId', () => {
      const a = buildPromotionPolicyArtifact(baseInput({
        recordedAt: '2026-10-05T12:00:00.000Z',
      }));
      const b = buildPromotionPolicyArtifact(baseInput({
        recordedAt: '2026-10-06T12:00:00.000Z',
      }));
      expect(a.policyId).toBe(b.policyId);
      expect(a.recordedAt).not.toBe(b.recordedAt);
    });
  });
});
