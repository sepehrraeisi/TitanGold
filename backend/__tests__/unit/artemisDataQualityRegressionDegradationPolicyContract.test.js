/**
 * Artemis Core Stage 10 — Data Quality / Regression / Degradation Policy Contract
 * Focused unit tests (library-only / fail-closed / zero side effects).
 */

import {
  ARTIFACT_ALLOWLIST,
  AUTHORIZED_AVAILABILITY_VALUES,
  AUTHORIZED_FRESHNESS_VALUES,
  AUTHORIZED_SAMPLE_SUFFICIENCY_VERDICTS,
  AUTHORIZED_TRUST_ELIGIBILITY_STATUSES,
  BASELINE_MODEL,
  CALIBRATION_SUFFICIENCY,
  DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_TYPE,
  DQ_REGRESSION_DEGRADATION_POLICY_AUTHORITY_CLASS,
  DQ_REGRESSION_DEGRADATION_POLICY_CONTRACT_VERSION,
  DQ_REGRESSION_DEGRADATION_POLICY_IMPLEMENTATION_VERSION,
  DQ_REGRESSION_DEGRADATION_POLICY_OFFICIAL_NAME,
  DQ_REGRESSION_DEGRADATION_POLICY_POLICY_VERSION,
  DQ_REGRESSION_DEGRADATION_POLICY_SLICE_ID,
  DQ_USABLE_AVAILABILITY,
  DQ_USABLE_FRESHNESS,
  DataQualityRegressionDegradationPolicyContractError,
  NEW_THRESHOLDS,
  NUMERIC_REGRESSION_MODEL,
  POLICY_STATE,
  RECOVERY_MODEL,
  ZERO_DQ_REGRESSION_DEGRADATION_POLICY_SIDE_EFFECTS,
  buildDataQualityRegressionDegradationPolicyArtifact,
  getDataQualityRegressionDegradationPolicyDescriptor,
  validateDataQualityRegressionDegradationPolicyArtifact,
  validateDataQualityRegressionDegradationPolicyDescriptor,
} from '../../contracts/artemisDataQualityRegressionDegradationPolicyContract.js';
import {
  AVAILABILITY,
  FRESHNESS_STATUS,
} from '../../contracts/artemisEvidenceContract.js';
import { TRUST_ELIGIBILITY_STATUS } from '../../contracts/artemisTrustWeightingPolicyContract.js';
import { SUFFICIENCY_VERDICT } from '../../contracts/artemisSampleSufficiencyPolicyContract.js';

function baseCohort(overrides = {}) {
  return Object.freeze({
    venue: 'mexc',
    marketType: 'spot',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    contractVersion: 'artemis-dq-regression-degradation-policy-1.0.0',
    policyVersion: 'artemis-dq-regression-degradation-policy-1.0.0',
    implementationVersion: '1.0.0',
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
    reference: referenceOverride,
    ...rest
  } = overrides;

  const input = {
    trustEligibilityStatus: TRUST_ELIGIBILITY_STATUS.TRUST_ELIGIBLE,
    sampleSufficiencyVerdict: SUFFICIENCY_VERDICT.SUFFICIENT,
    dataQuality: dataQualityOverride === undefined
      ? baseDataQuality()
      : dataQualityOverride,
    ...rest,
  };

  if (cohortOverride !== undefined) {
    input.cohort = cohortOverride;
  }

  if (referenceOverride !== undefined) {
    input.reference = referenceOverride;
  }

  return input;
}

function expectFail(fn, code) {
  try {
    fn();
    throw new Error(`Expected failure with code ${code}, but call succeeded`);
  } catch (err) {
    expect(err).toBeInstanceOf(DataQualityRegressionDegradationPolicyContractError);
    expect(err.code).toBe(code);
  }
}

function stableReference(cohort = baseCohort()) {
  return Object.freeze({
    policyState: POLICY_STATE.STABLE,
    cohort: { ...cohort },
  });
}

function degradedReference(cohort = baseCohort()) {
  return Object.freeze({
    policyState: POLICY_STATE.DEGRADED,
    cohort: { ...cohort },
  });
}

describe('artemisDataQualityRegressionDegradationPolicyContract', () => {
  describe('descriptor', () => {
    test('descriptor shape and frozen authority metadata', () => {
      const descriptor = getDataQualityRegressionDegradationPolicyDescriptor();
      expect(descriptor.sliceId).toBe(DQ_REGRESSION_DEGRADATION_POLICY_SLICE_ID);
      expect(descriptor.officialName).toBe(DQ_REGRESSION_DEGRADATION_POLICY_OFFICIAL_NAME);
      expect(descriptor.authorityClass).toBe(DQ_REGRESSION_DEGRADATION_POLICY_AUTHORITY_CLASS);
      expect(descriptor.contractVersion).toBe(DQ_REGRESSION_DEGRADATION_POLICY_CONTRACT_VERSION);
      expect(descriptor.policyVersion).toBe(DQ_REGRESSION_DEGRADATION_POLICY_POLICY_VERSION);
      expect(descriptor.implementationVersion).toBe(
        DQ_REGRESSION_DEGRADATION_POLICY_IMPLEMENTATION_VERSION,
      );
      expect(descriptor.numericRegressionModel).toBe(NUMERIC_REGRESSION_MODEL);
      expect(descriptor.newThresholds).toBe(NEW_THRESHOLDS);
      expect(descriptor.baselineModel).toBe(BASELINE_MODEL);
      expect(descriptor.recoveryModel).toBe(RECOVERY_MODEL);
      expect(descriptor.calibrationSufficiency).toBe(CALIBRATION_SUFFICIENCY);
      expect(descriptor.isSourceOfTruth).toBe(false);
      const validatedDescriptor = validateDataQualityRegressionDegradationPolicyDescriptor(descriptor);
      expect(validatedDescriptor.contractVersion).toBe(descriptor.contractVersion);
      expect(validatedDescriptor.authorityClass).toBe(descriptor.authorityClass);
      expect(Object.isFrozen(descriptor)).toBe(true);
    });
  });

  describe('STABLE current-state evaluation', () => {
    test('1. STABLE when TRUST_ELIGIBLE + SUFFICIENT + AVAILABLE + FRESH', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput());
      expect(artifact.policyState).toBe(POLICY_STATE.STABLE);
      expect(artifact.currentState).toBe(POLICY_STATE.STABLE);
      expect(artifact.dqUsable).toBe(true);
      expect(artifact.degradationReasons).toEqual([]);
      expect(artifact.comparisonPerformed).toBe(false);
      expect(artifact.referenceState).toBeNull();
      expect(artifact.comparisonUnavailableReason).toBeNull();
      expect(artifact.numericRegressionModel).toBe('NONE');
      expect(artifact.newThresholds).toBe('NONE');
      expect(artifact.baselineModel).toBe(BASELINE_MODEL);
      expect(artifact.recoveryModel).toBe(RECOVERY_MODEL);
      expect(artifact.calibrationSufficiency).toBe(CALIBRATION_SUFFICIENCY);
      expect(artifact.artifactType).toBe(DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_TYPE);
      const validated = validateDataQualityRegressionDegradationPolicyArtifact(artifact);
      expect(validated.policyId).toBe(artifact.policyId);
      expect(validated.policyState).toBe(POLICY_STATE.STABLE);
    });

    test('2. STABLE when TRUST_ELIGIBLE + SUFFICIENT + AVAILABLE + AGED', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        dataQuality: baseDataQuality({ freshnessStatus: FRESHNESS_STATUS.AGED }),
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.STABLE);
      expect(artifact.currentState).toBe(POLICY_STATE.STABLE);
      expect(artifact.dqUsable).toBe(true);
      expect(artifact.degradationReasons).toEqual([]);
      expect(artifact.dataQuality.freshnessStatus).toBe(FRESHNESS_STATUS.AGED);
    });
  });

  describe('DEGRADED current-state evaluation', () => {
    test('3. DEGRADED when NOT_TRUST_ELIGIBLE', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        trustEligibilityStatus: TRUST_ELIGIBILITY_STATUS.NOT_TRUST_ELIGIBLE,
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.currentState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.degradationReasons).toEqual(['TRUST:NOT_TRUST_ELIGIBLE']);
      expect(artifact.dqUsable).toBe(true);
    });

    test('4. DEGRADED when TRUST_UNAVAILABLE', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        trustEligibilityStatus: TRUST_ELIGIBILITY_STATUS.TRUST_UNAVAILABLE,
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.degradationReasons).toEqual(['TRUST:TRUST_UNAVAILABLE']);
      expect(artifact.dqUsable).toBe(true);
    });

    test('5. DEGRADED when Sample Sufficiency INSUFFICIENT', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        sampleSufficiencyVerdict: SUFFICIENCY_VERDICT.INSUFFICIENT,
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.degradationReasons).toEqual(['SAMPLE_SUFFICIENCY:INSUFFICIENT']);
      expect(artifact.dqUsable).toBe(true);
    });

    test('6. DEGRADED when Sample Sufficiency UNAVAILABLE', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        sampleSufficiencyVerdict: SUFFICIENCY_VERDICT.UNAVAILABLE,
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.degradationReasons).toEqual(['SAMPLE_SUFFICIENCY:UNAVAILABLE']);
      expect(artifact.dqUsable).toBe(true);
    });

    test('7. DEGRADED when DQ availability is not AVAILABLE', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        dataQuality: baseDataQuality({ availability: AVAILABILITY.UNAVAILABLE }),
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.degradationReasons).toEqual(['DQ_AVAILABILITY:unavailable']);
      expect(artifact.dqUsable).toBe(false);
    });

    test('8. DEGRADED when freshnessStatus is STALE', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        dataQuality: baseDataQuality({ freshnessStatus: FRESHNESS_STATUS.STALE }),
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.degradationReasons).toEqual(['DQ_FRESHNESS:stale']);
      expect(artifact.dqUsable).toBe(false);
    });

    test('9. DEGRADED when freshnessStatus is EXPIRED', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        dataQuality: baseDataQuality({ freshnessStatus: FRESHNESS_STATUS.EXPIRED }),
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.degradationReasons).toEqual(['DQ_FRESHNESS:expired']);
      expect(artifact.dqUsable).toBe(false);
    });
  });

  describe('fail-closed validation', () => {
    test('10. fail-closed when DQ is missing', () => {
      expectFail(
        () => {
          const input = baseInput();
          delete input.dataQuality;
          buildDataQualityRegressionDegradationPolicyArtifact(input);
        },
        'DQ_REGRESSION_DEGRADATION_POLICY_DQ_MISSING',
      );
    });

    test('11. fail-closed when DQ is malformed', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          dataQuality: 'not-an-object',
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_DQ_MALFORMED',
      );
    });

    test('12. fail-closed when freshnessStatus is unsupported', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          dataQuality: baseDataQuality({ freshnessStatus: 'bogus_freshness' }),
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_DQ_FRESHNESS_UNSUPPORTED',
      );
    });

    test('13. fail-closed when Trust status is missing', () => {
      expectFail(
        () => {
          const input = baseInput();
          delete input.trustEligibilityStatus;
          buildDataQualityRegressionDegradationPolicyArtifact(input);
        },
        'DQ_REGRESSION_DEGRADATION_POLICY_TRUST_STATUS_MISSING',
      );
    });

    test('14. fail-closed when Trust status is unsupported', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          trustEligibilityStatus: 'TRUST_MAYBE',
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_TRUST_STATUS_UNSUPPORTED',
      );
    });

    test('15. fail-closed when Sample Sufficiency status is missing', () => {
      expectFail(
        () => {
          const input = baseInput();
          delete input.sampleSufficiencyVerdict;
          buildDataQualityRegressionDegradationPolicyArtifact(input);
        },
        'DQ_REGRESSION_DEGRADATION_POLICY_SAMPLE_SUFFICIENCY_MISSING',
      );
    });

    test('16. fail-closed when Sample Sufficiency status is unsupported', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          sampleSufficiencyVerdict: SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED,
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_SAMPLE_SUFFICIENCY_UNSUPPORTED',
      );
    });
  });

  describe('explicit compatible regression comparison', () => {
    test('17. STABLE -> STABLE when compatible reference/current are STABLE', () => {
      const cohort = baseCohort();
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        comparisonRequested: true,
        cohort,
        reference: stableReference(cohort),
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.STABLE);
      expect(artifact.currentState).toBe(POLICY_STATE.STABLE);
      expect(artifact.referenceState).toBe(POLICY_STATE.STABLE);
      expect(artifact.comparisonPerformed).toBe(true);
      expect(artifact.comparisonUnavailableReason).toBeNull();
    });

    test('18. STABLE -> DEGRADED when current is DEGRADED against STABLE reference', () => {
      const cohort = baseCohort();
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        trustEligibilityStatus: TRUST_ELIGIBILITY_STATUS.NOT_TRUST_ELIGIBLE,
        comparisonRequested: true,
        cohort,
        reference: stableReference(cohort),
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.currentState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.referenceState).toBe(POLICY_STATE.STABLE);
      expect(artifact.comparisonPerformed).toBe(true);
      expect(artifact.degradationReasons).toEqual(['TRUST:NOT_TRUST_ELIGIBLE']);
    });

    test('19. DEGRADED -> STABLE recovers memorylessly when current returns to eligible', () => {
      const cohort = baseCohort();
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        comparisonRequested: true,
        cohort,
        reference: degradedReference(cohort),
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.STABLE);
      expect(artifact.currentState).toBe(POLICY_STATE.STABLE);
      expect(artifact.referenceState).toBe(POLICY_STATE.DEGRADED);
      expect(artifact.comparisonPerformed).toBe(true);
      expect(artifact.degradationReasons).toEqual([]);
      expect(artifact.recoveryModel).toBe(RECOVERY_MODEL);
    });
  });

  describe('REGRESSION_UNAVAILABLE comparison gate', () => {
    test('20. REGRESSION_UNAVAILABLE when comparison requested with missing reference', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        comparisonRequested: true,
        cohort: baseCohort(),
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.REGRESSION_UNAVAILABLE);
      expect(artifact.currentState).toBe(POLICY_STATE.STABLE);
      expect(artifact.comparisonPerformed).toBe(false);
      expect(artifact.comparisonUnavailableReason).toBe('REFERENCE_MISSING');
      expect(artifact.referenceState).toBeNull();
    });

    test('21. REGRESSION_UNAVAILABLE when reference/current cohort identity mismatches', () => {
      const cohort = baseCohort();
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        comparisonRequested: true,
        cohort,
        reference: {
          policyState: POLICY_STATE.STABLE,
          cohort: { ...cohort, symbol: 'ETH/USDT' },
        },
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.REGRESSION_UNAVAILABLE);
      expect(artifact.comparisonPerformed).toBe(false);
      expect(artifact.comparisonUnavailableReason).toBe('COHORT_IDENTITY_MISMATCH');
    });

    test('22. REGRESSION_UNAVAILABLE when reference/current versions are incompatible', () => {
      const cohort = baseCohort({
        contractVersion: 'c1',
        policyVersion: 'p1',
        implementationVersion: 'i1',
      });
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        comparisonRequested: true,
        cohort,
        reference: {
          policyState: POLICY_STATE.STABLE,
          cohort: { ...cohort },
          contractVersion: 'c2',
          policyVersion: 'p1',
          implementationVersion: 'i1',
        },
      }));
      expect(artifact.policyState).toBe(POLICY_STATE.REGRESSION_UNAVAILABLE);
      expect(artifact.comparisonPerformed).toBe(false);
      expect(artifact.comparisonUnavailableReason).toBe('VERSION_INCOMPATIBLE');
    });
  });

  describe('forbidden authority / score / threshold / lifecycle fields', () => {
    test('23. forbidden numeric regressionThreshold is rejected', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          regressionThreshold: 0.05,
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('24. forbidden degradationScore is rejected', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          degradationScore: 0.42,
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('25. forbidden healthScore is rejected', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          healthScore: 99,
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('26. forbidden promotionStatus is rejected', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          promotionStatus: 'PROMOTED',
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('27. forbidden demotionStatus is rejected', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          demotionStatus: 'DEMOTED',
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('28. forbidden lifecycleMutation is rejected', () => {
      expectFail(
        () => buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
          lifecycleMutation: true,
        })),
        'DQ_REGRESSION_DEGRADATION_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });
  });

  describe('no numeric thresholds and zero side effects', () => {
    test('29. no numeric thresholds are encoded in contract constants or artifacts', () => {
      expect(NUMERIC_REGRESSION_MODEL).toBe('NONE');
      expect(NEW_THRESHOLDS).toBe('NONE');
      expect(BASELINE_MODEL).toBe('EXPLICIT_CANONICAL_COMPATIBLE_REFERENCE_ONLY');
      expect(RECOVERY_MODEL).toBe('MEMORYLESS_DETERMINISTIC');
      expect(CALIBRATION_SUFFICIENCY).toBe('DORMANT / SEPARATE');

      const source = buildDataQualityRegressionDegradationPolicyArtifact.toString();
      expect(source).not.toMatch(/\bminimumN\b/);
      expect(source).not.toMatch(/\bminEligibleObservations\b/);
      expect(source).not.toMatch(/\bregressionThreshold\b/);
      expect(source).not.toMatch(/\bdegradationThreshold\b/);
      expect(source).not.toMatch(/\bmatchRatio\b/);
      expect(source).not.toMatch(/\bmismatchRatio\b/);
      expect(source).not.toMatch(/\bBrier\b/i);
      expect(source).not.toMatch(/\bECE\b/);

      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput());
      expect(artifact.numericRegressionModel).toBe('NONE');
      expect(artifact.newThresholds).toBe('NONE');
      expect(artifact).not.toHaveProperty('regressionThreshold');
      expect(artifact).not.toHaveProperty('degradationThreshold');
      expect(artifact).not.toHaveProperty('minimumN');
      expect(artifact).not.toHaveProperty('qualityScore');
      expect(artifact).not.toHaveProperty('healthScore');
      expect(artifact).not.toHaveProperty('stabilityScore');
      expect(artifact).not.toHaveProperty('regressionScore');
      expect(artifact).not.toHaveProperty('degradationScore');
      expect(DQ_USABLE_AVAILABILITY).toBe(AVAILABILITY.AVAILABLE);
      expect([...DQ_USABLE_FRESHNESS].sort()).toEqual(
        [FRESHNESS_STATUS.AGED, FRESHNESS_STATUS.FRESH].sort(),
      );
      expect(AUTHORIZED_TRUST_ELIGIBILITY_STATUSES.includes(
        TRUST_ELIGIBILITY_STATUS.TRUST_ELIGIBLE,
      )).toBe(true);
      expect(AUTHORIZED_SAMPLE_SUFFICIENCY_VERDICTS.includes(
        SUFFICIENCY_VERDICT.SUFFICIENT,
      )).toBe(true);
      expect(AUTHORIZED_AVAILABILITY_VALUES.includes(AVAILABILITY.AVAILABLE)).toBe(true);
      expect(AUTHORIZED_FRESHNESS_VALUES.includes(FRESHNESS_STATUS.FRESH)).toBe(true);
      expect(AUTHORIZED_FRESHNESS_VALUES.includes(FRESHNESS_STATUS.AGED)).toBe(true);
    });

    test('30. no persistence / runtime / network / trust / promotion / demotion / calibration side effects', () => {
      const artifact = buildDataQualityRegressionDegradationPolicyArtifact(baseInput({
        comparisonRequested: true,
        cohort: baseCohort(),
        reference: stableReference(),
      }));

      expect(artifact.isSourceOfTruth).toBe(false);
      expect(artifact.hardFlags).toEqual({
        isSourceOfTruth: false,
        persistenceActivation: false,
        runtimeActivation: false,
        networkActivation: false,
        providerActivation: false,
        llmActivation: false,
        workerActivation: false,
        schedulerActivation: false,
        trustMutation: false,
        weightMutation: false,
        promotionExecution: false,
        demotionExecution: false,
        calibrationExecution: false,
        binaryBrierExecution: false,
        financialExecution: false,
        executionEligible: false,
        decisionEligible: false,
      });

      expect(artifact.sideEffects).toEqual(ZERO_DQ_REGRESSION_DEGRADATION_POLICY_SIDE_EFFECTS);
      for (const [key, value] of Object.entries(artifact.sideEffects)) {
        expect(value).toBe(0);
        expect(key).toMatch(/Count$/);
      }

      expect(Object.isFrozen(artifact)).toBe(true);
      expect(Object.isFrozen(artifact.hardFlags)).toBe(true);
      expect(Object.isFrozen(artifact.sideEffects)).toBe(true);
      expect(Object.isFrozen(artifact.dataQuality)).toBe(true);
      expect(Object.isFrozen(artifact.degradationReasons)).toBe(true);
      expect(ARTIFACT_ALLOWLIST.includes('policyState')).toBe(true);
      const validated = validateDataQualityRegressionDegradationPolicyArtifact(artifact);
      expect(validated.policyId).toBe(artifact.policyId);
      expect(validated.policyState).toBe(artifact.policyState);
    });
  });
});
