/**
 * Artemis Trust / Weighting Policy Contract — dedicated unit tests
 *
 * Stage 10 — S10-TRUST-WEIGHTING-POLICY-CONTRACT
 * V1 MODEL = BINARY_EVIDENCE_ELIGIBILITY
 */

import {
  TrustWeightingPolicyContractError,
  TRUST_WEIGHTING_POLICY_SCHEMA_VERSION,
  TRUST_WEIGHTING_POLICY_CONTRACT_VERSION,
  TRUST_WEIGHTING_POLICY_POLICY_VERSION,
  TRUST_WEIGHTING_POLICY_IMPLEMENTATION_VERSION,
  TRUST_WEIGHTING_POLICY_ARTIFACT_TYPE,
  TRUST_WEIGHTING_POLICY_SLICE_ID,
  TRUST_WEIGHTING_POLICY_OFFICIAL_NAME,
  TRUST_WEIGHTING_POLICY_AUTHORITY_CLASS,
  TRUST_ELIGIBILITY_STATUS,
  V1_MODEL,
  NUMERIC_WEIGHT,
  TRUST_SCOPE,
  AGENT_LEVEL_TRUST,
  PERSISTENT_WEIGHT_STATE,
  SEGMENT_SCOPE,
  GLOBAL_AVERAGE_ONLY_BYPASS,
  REGIME_IDENTITY_CANONICAL,
  REQUIRED_HARD_FLAGS,
  ZERO_TRUST_WEIGHTING_POLICY_SIDE_EFFECTS,
  FORBIDDEN_NUMERIC_WEIGHT_FIELDS,
  getTrustWeightingPolicyDescriptor,
  validateTrustWeightingPolicyDescriptor,
  buildTrustWeightingPolicyArtifact,
  validateTrustWeightingPolicyArtifact,
  assertNotGlobalAverageOnlyAsSegmentedTrustEvidence,
} from '../../contracts/artemisTrustWeightingPolicyContract.js';
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
import {
  SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
  SUFFICIENCY_VERDICT,
} from '../../contracts/artemisSampleSufficiencyPolicyContract.js';
import {
  AVAILABILITY,
  FRESHNESS_STATUS,
} from '../../contracts/artemisEvidenceContract.js';

function baseCohort(overrides = {}) {
  return {
    venue: 'MEXC',
    marketType: 'spot',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    methodKey: 'artemis.observed_outcome_evaluation.v1',
    methodImplementationVersion: '1.0.0',
    evaluationImplementationVersion: '1.0.0',
    policyVersion: 'artemis-observed-outcome-evaluation-policy-1.0.0',
    contractVersion: 'artemis-observed-outcome-evaluation-1.0.0',
    ...overrides,
  };
}

function baseAggregateRef(overrides = {}) {
  return {
    aggregateId: '11111111-1111-4111-8111-111111111111',
    contractVersion: EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
    policyVersion: EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
    implementationVersion: EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
    ...overrides,
  };
}

function baseSegmentedRef(overrides = {}) {
  return {
    policyId: '22222222-2222-4222-8222-222222222222',
    contractVersion: SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
    policyVersion: SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
    implementationVersion: SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    sliceId: SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
    ...overrides,
  };
}

function baseSampleSufficiencyRef(overrides = {}) {
  return {
    policyId: '33333333-3333-4333-8333-333333333333',
    contractVersion: SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
    policyVersion: SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
    implementationVersion: SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
    sliceId: SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
    sufficiencyVerdict: SUFFICIENCY_VERDICT.SUFFICIENT,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    aggregateRef: baseAggregateRef(),
    segmentedPerformancePolicyRef: baseSegmentedRef(),
    sampleSufficiencyPolicyRef: baseSampleSufficiencyRef(),
    cohort: baseCohort(),
    segmentScope: SEGMENT_SCOPE.SEGMENTED,
    recordedAt: '2026-09-28T12:00:00.000Z',
    ...overrides,
  };
}

function expectFail(fn, code) {
  try {
    fn();
    throw new Error(`Expected TrustWeightingPolicyContractError ${code}`);
  } catch (err) {
    if (!(err instanceof TrustWeightingPolicyContractError)) {
      throw err;
    }
    expect(err.code).toBe(code);
  }
}

describe('artemisTrustWeightingPolicyContract', () => {
  describe('descriptor', () => {
    test('returns frozen canonical descriptor', () => {
      const d = getTrustWeightingPolicyDescriptor();
      expect(d.v1Model).toBe(V1_MODEL);
      expect(d.numericWeight).toBe(NUMERIC_WEIGHT);
      expect(d.trustScope).toBe(TRUST_SCOPE);
      expect(d.sliceId).toBe(TRUST_WEIGHTING_POLICY_SLICE_ID);
      expect(d.isSourceOfTruth).toBe(false);
      expect(Object.isFrozen(d)).toBe(true);
    });

    test('validateTrustWeightingPolicyDescriptor accepts canonical', () => {
      const validated = validateTrustWeightingPolicyDescriptor(
        getTrustWeightingPolicyDescriptor(),
      );
      expect(validated.contractVersion).toBe(TRUST_WEIGHTING_POLICY_CONTRACT_VERSION);
    });

    test('validateTrustWeightingPolicyDescriptor rejects tamper', () => {
      expectFail(
        () => validateTrustWeightingPolicyDescriptor({
          ...getTrustWeightingPolicyDescriptor(),
          sliceId: 'TAMPERED',
        }),
        'TRUST_WEIGHTING_POLICY_DESCRIPTOR_MISMATCH',
      );
    });
  });

  describe('Sample Sufficiency → Trust mapping', () => {
    test('1. SUFFICIENT → TRUST_ELIGIBLE', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput({
        sampleSufficiencyPolicyRef: baseSampleSufficiencyRef({
          sufficiencyVerdict: SUFFICIENCY_VERDICT.SUFFICIENT,
        }),
      }));
      expect(artifact.trustEligibilityStatus).toBe(
        TRUST_ELIGIBILITY_STATUS.TRUST_ELIGIBLE,
      );
      expect(artifact.sampleSufficiencyVerdict).toBe(SUFFICIENCY_VERDICT.SUFFICIENT);
    });

    test('2. INSUFFICIENT → NOT_TRUST_ELIGIBLE', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput({
        sampleSufficiencyPolicyRef: baseSampleSufficiencyRef({
          sufficiencyVerdict: SUFFICIENCY_VERDICT.INSUFFICIENT,
        }),
      }));
      expect(artifact.trustEligibilityStatus).toBe(
        TRUST_ELIGIBILITY_STATUS.NOT_TRUST_ELIGIBLE,
      );
    });

    test('3. UNAVAILABLE → TRUST_UNAVAILABLE', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput({
        sampleSufficiencyPolicyRef: baseSampleSufficiencyRef({
          sufficiencyVerdict: SUFFICIENCY_VERDICT.UNAVAILABLE,
        }),
      }));
      expect(artifact.trustEligibilityStatus).toBe(
        TRUST_ELIGIBILITY_STATUS.TRUST_UNAVAILABLE,
      );
    });

    test('4. missing Sample Sufficiency evidence → fail closed', () => {
      const input = baseInput();
      delete input.sampleSufficiencyPolicyRef;
      expectFail(
        () => buildTrustWeightingPolicyArtifact(input),
        'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_REF_MISSING',
      );
    });

    test('UNDEFINED_DEFERRED sufficiencyVerdict → fail closed', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          sampleSufficiencyPolicyRef: baseSampleSufficiencyRef({
            sufficiencyVerdict: SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED,
          }),
        })),
        'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_VERDICT_UNDEFINED',
      );
    });
  });

  describe('cohort / version identity', () => {
    test('5. missing cohort identity → fail closed', () => {
      const input = baseInput();
      delete input.cohort;
      expectFail(
        () => buildTrustWeightingPolicyArtifact(input),
        'TRUST_WEIGHTING_POLICY_COHORT_MISSING',
      );
    });

    test('5b. missing cohort dimension → fail closed', () => {
      const cohort = baseCohort();
      delete cohort.symbol;
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({ cohort })),
        'TRUST_WEIGHTING_POLICY_COHORT_DIMENSION_MISSING',
      );
    });

    test('6. missing version identity (aggregate contractVersion) → fail closed', () => {
      const ref = baseAggregateRef();
      delete ref.contractVersion;
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({ aggregateRef: ref })),
        'TRUST_WEIGHTING_POLICY_AGGREGATE_REF_MISSING_FIELD',
      );
    });

    test('6b. aggregate version mismatch → fail closed', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          aggregateRef: baseAggregateRef({
            contractVersion: 'wrong-version',
          }),
        })),
        'TRUST_WEIGHTING_POLICY_AGGREGATE_CONTRACT_VERSION_MISMATCH',
      );
    });
  });

  describe('GLOBAL_AVERAGE_ONLY / segmented', () => {
    test('7. GLOBAL_AVERAGE_ONLY evidence → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          segmentScope: SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY,
        })),
        'TRUST_WEIGHTING_POLICY_GLOBAL_AVERAGE_ONLY_REJECTED',
      );
    });

    test('7b. assertNotGlobalAverageOnlyAsSegmentedTrustEvidence rejects', () => {
      expectFail(
        () => assertNotGlobalAverageOnlyAsSegmentedTrustEvidence(
          SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY,
        ),
        'TRUST_WEIGHTING_POLICY_GLOBAL_AVERAGE_ONLY_REJECTED',
      );
    });

    test('8. canonical segmented cohort → accepted', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput());
      expect(artifact.segmentScope).toBe(SEGMENT_SCOPE.SEGMENTED);
      expect(artifact.cohort.venue).toBe('MEXC');
      expect(artifact.cohort.marketType).toBe('spot');
      expect(artifact.cohort.symbol).toBe('BTC/USDT');
      expect(artifact.cohort.timeframe).toBe('1h');
      expect(artifact.globalAverageOnlyBypass).toBe(GLOBAL_AVERAGE_ONLY_BYPASS);
    });
  });

  describe('unsupported dimensions', () => {
    test('9. unsupported regime → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          cohort: { ...baseCohort(), regime: 'bull' },
        })),
        'TRUST_WEIGHTING_POLICY_UNSUPPORTED_SEGMENT_DIMENSION',
      );
    });

    test('10. agentId → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          cohort: { ...baseCohort(), agentId: 'technical' },
        })),
        'TRUST_WEIGHTING_POLICY_UNSUPPORTED_SEGMENT_DIMENSION',
      );
    });

    test('11. agentRole → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          cohort: { ...baseCohort(), agentRole: 'evidence' },
        })),
        'TRUST_WEIGHTING_POLICY_UNSUPPORTED_SEGMENT_DIMENSION',
      );
    });

    test('12. analysisHorizon → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          cohort: { ...baseCohort(), analysisHorizon: '1d' },
        })),
        'TRUST_WEIGHTING_POLICY_UNSUPPORTED_SEGMENT_DIMENSION',
      );
    });
  });

  describe('caller authority FAIL_CLOSED', () => {
    test('13. caller trustScore → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({ trustScore: 0.9 })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('14. caller weight → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({ weight: 1 })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('15. caller agentWeight → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({ agentWeight: 0.5 })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('16. caller trustEligible override → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({ trustEligible: true })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('17. caller promotionEligible → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          promotionEligible: true,
        })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('18. caller demotionEligible → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          demotionEligible: false,
        })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('19. caller policyVersion override → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          policyVersion: 'attacker-policy',
        })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('20. caller authorityClass override → rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          authorityClass: 'EXECUTION',
        })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });
  });

  describe('no numeric weight / no promotion / no calibration', () => {
    test('21. no numeric weight field exists in canonical artifact', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput());
      // Policy constant remains NONE / NOT_AUTHORIZED; artifact must not emit a weight field.
      expect(NUMERIC_WEIGHT).toBe('NONE / NOT_AUTHORIZED');
      expect(Object.prototype.hasOwnProperty.call(artifact, 'numericWeight')).toBe(
        false,
      );
      for (const field of FORBIDDEN_NUMERIC_WEIGHT_FIELDS) {
        expect(Object.prototype.hasOwnProperty.call(artifact, field)).toBe(false);
      }
      expect(artifact).not.toHaveProperty('trustScore');
      expect(artifact).not.toHaveProperty('weight');
      expect(artifact).not.toHaveProperty('agentWeight');
    });

    test('22–24. no Promotion / Demotion / Trust mutation API on module', async () => {
      const mod = await import(
        '../../contracts/artemisTrustWeightingPolicyContract.js'
      );
      expect(mod.promote).toBeUndefined();
      expect(mod.demote).toBeUndefined();
      expect(mod.mutateTrust).toBeUndefined();
      expect(mod.setWeight).toBeUndefined();
      expect(mod.setTrustScore).toBeUndefined();
      expect(mod.default.promote).toBeUndefined();
      expect(mod.default.demote).toBeUndefined();
      expect(mod.default.mutateTrust).toBeUndefined();
      expect(artifactPromotionFieldsAbsent(buildTrustWeightingPolicyArtifact(baseInput())))
        .toBe(true);
    });

    test('25. no Calibration execution', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput());
      expect(artifact.calibrationExecution).toBe(false);
      expect(artifact.binaryBrierExecution).toBe(false);
      expect(artifact.hardFlags.calibrationExecution).toBe(false);
      expect(artifact.hardFlags.binaryBrierExecution).toBe(false);
      expect(artifact).not.toHaveProperty('brier');
      expect(artifact).not.toHaveProperty('ece');
    });
  });

  describe('side effects / immutability / rebuild', () => {
    test('26. zero side-effect ledger', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput());
      expect(artifact.sideEffects).toEqual(ZERO_TRUST_WEIGHTING_POLICY_SIDE_EFFECTS);
      for (const [k, v] of Object.entries(artifact.sideEffects)) {
        expect(v).toBe(0);
      }
    });

    test('27. deep immutability', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput());
      expect(Object.isFrozen(artifact)).toBe(true);
      expect(Object.isFrozen(artifact.cohort)).toBe(true);
      expect(Object.isFrozen(artifact.hardFlags)).toBe(true);
      expect(Object.isFrozen(artifact.sideEffects)).toBe(true);
      expect(Object.isFrozen(artifact.aggregateRef)).toBe(true);
      expect(() => {
        artifact.trustEligibilityStatus = 'TAMPER';
      }).toThrow();
    });

    test('28. canonical rebuild validation', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput());
      const validated = validateTrustWeightingPolicyArtifact(artifact);
      expect(validated.policyId).toBe(artifact.policyId);
      expect(validated.trustEligibilityStatus).toBe(artifact.trustEligibilityStatus);
    });

    test('29. stable identity derivation', () => {
      const a = buildTrustWeightingPolicyArtifact(baseInput());
      const b = buildTrustWeightingPolicyArtifact(baseInput());
      expect(a.policyId).toBe(b.policyId);
      const c = buildTrustWeightingPolicyArtifact(baseInput({
        sampleSufficiencyPolicyRef: baseSampleSufficiencyRef({
          sufficiencyVerdict: SUFFICIENCY_VERDICT.INSUFFICIENT,
        }),
      }));
      expect(c.policyId).not.toBe(a.policyId);
    });

    test('30. artifact tampering rejected', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput());
      const tampered = {
        ...structuredClone(artifact),
        trustEligibilityStatus: TRUST_ELIGIBILITY_STATUS.NOT_TRUST_ELIGIBLE,
      };
      // unfreeze clone for tamper
      expectFail(
        () => validateTrustWeightingPolicyArtifact(tampered),
        'TRUST_WEIGHTING_POLICY_ARTIFACT_TRUST_STATUS_MAPPING_MISMATCH',
      );
    });

    test('30b. policyId tamper rejected', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput());
      const tampered = {
        ...structuredClone(artifact),
        policyId: '00000000-0000-4000-8000-000000000000',
      };
      expectFail(
        () => validateTrustWeightingPolicyArtifact(tampered),
        'TRUST_WEIGHTING_POLICY_ARTIFACT_IDENTITY_MISMATCH',
      );
    });

    test('31. unknown fields rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          extraField: 'nope',
        })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('32. secret-bearing fields rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          apiKey: 'secret',
        })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });

    test('33. runtime/persistence activation fields rejected', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          runtimeActivation: true,
        })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          persistenceActivation: true,
        })),
        'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
      );
    });
  });

  describe('DQ optional binding', () => {
    test('optional dataQualityEligibilityState AVAILABLE+FRESH accepted', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput({
        dataQualityEligibilityState: {
          availability: AVAILABILITY.AVAILABLE,
          freshnessStatus: FRESHNESS_STATUS.FRESH,
        },
      }));
      expect(artifact.dataQualityEligibilityState.availability).toBe(
        AVAILABILITY.AVAILABLE,
      );
    });

    test('DQ not AVAILABLE → fail closed', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          dataQualityEligibilityState: {
            availability: AVAILABILITY.UNAVAILABLE,
            freshnessStatus: FRESHNESS_STATUS.FRESH,
          },
        })),
        'TRUST_WEIGHTING_POLICY_DQ_NOT_AVAILABLE',
      );
    });

    test('DQ STALE freshness → fail closed', () => {
      expectFail(
        () => buildTrustWeightingPolicyArtifact(baseInput({
          dataQualityEligibilityState: {
            availability: AVAILABILITY.AVAILABLE,
            freshnessStatus: FRESHNESS_STATUS.STALE,
          },
        })),
        'TRUST_WEIGHTING_POLICY_DQ_FRESHNESS_NOT_ELIGIBLE',
      );
    });
  });

  describe('hard flags / governance constants', () => {
    test('hard flags all false as required', () => {
      const artifact = buildTrustWeightingPolicyArtifact(baseInput());
      expect(artifact.hardFlags).toEqual(REQUIRED_HARD_FLAGS);
      expect(artifact.isSourceOfTruth).toBe(false);
      expect(artifact.regimeIdentityCanonical).toBe(REGIME_IDENTITY_CANONICAL);
      expect(artifact.agentLevelTrust).toBe(AGENT_LEVEL_TRUST);
      expect(artifact.persistentWeightState).toBe(PERSISTENT_WEIGHT_STATE);
      expect(artifact.schemaVersion).toBe(TRUST_WEIGHTING_POLICY_SCHEMA_VERSION);
      expect(artifact.contractVersion).toBe(TRUST_WEIGHTING_POLICY_CONTRACT_VERSION);
      expect(artifact.policyVersion).toBe(TRUST_WEIGHTING_POLICY_POLICY_VERSION);
      expect(artifact.implementationVersion).toBe(
        TRUST_WEIGHTING_POLICY_IMPLEMENTATION_VERSION,
      );
      expect(artifact.artifactType).toBe(TRUST_WEIGHTING_POLICY_ARTIFACT_TYPE);
      expect(artifact.officialName).toBe(TRUST_WEIGHTING_POLICY_OFFICIAL_NAME);
      expect(artifact.authorityClass).toBe(TRUST_WEIGHTING_POLICY_AUTHORITY_CLASS);
    });
  });
});

function artifactPromotionFieldsAbsent(artifact) {
  return !Object.prototype.hasOwnProperty.call(artifact, 'promotionEligible')
    && !Object.prototype.hasOwnProperty.call(artifact, 'demotionEligible')
    && !Object.prototype.hasOwnProperty.call(artifact, 'promotionStatus')
    && !Object.prototype.hasOwnProperty.call(artifact, 'demotionStatus')
    && artifact.promotion === 'NOT_AUTHORIZED'
    && artifact.demotion === 'NOT_AUTHORIZED'
    && artifact.trustMutation === false;
}
