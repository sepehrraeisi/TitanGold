/**
 * @jest-environment node
 *
 * Artemis Core Stage 10 — S10-CALIBRATION-MEASUREMENT-POLICY-CONTRACT
 * Calibration Measurement Policy Contract Boundary unit tests.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import {
  CONFIDENCE_KIND,
  CONFIDENCE_SCALE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
  CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
  CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
} from '../../contracts/artemisConfidenceCalibrationContract.js';
import { EVALUATION_STATUS } from '../../contracts/artemisObservedOutcomeEvaluationContract.js';
import {
  ALLOWED_PREDICTIVE_KINDS,
  AUTHORIZED_MEASUREMENT_METHODS,
  BINARY_BRIER_EXECUTION,
  BINARY_BRIER_FORMULA_SEMANTICS,
  BINARY_BRIER_SCORE,
  BINARY_BRIER_STANDALONE_CALIBRATION_VERDICT,
  BINARY_CORRECTNESS_MAPPING,
  BINNING_POLICY,
  CALIBRATED_KIND_TITANGOLD_VERIFIED,
  CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE,
  CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS,
  CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR,
  CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_IS_SOURCE_OF_TRUTH,
  CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_SLICE_ID,
  CALIBRATION_TARGET_EVENT,
  CALIBRATION_TARGET_EVENT_V1,
  CALIBRATION_TARGET_EVENT_V1_SEMANTICS,
  CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS,
  DEFERRED_METRIC_STATUS,
  ECE,
  FIRST_ALLOWED_PROPER_SCORE,
  FULL_CLASS_PROBABILITY_VECTOR,
  GLOBAL_AVERAGE_ONLY,
  MEASURED_KIND_IS_CALIBRATION_RESULT,
  MEASUREMENT_DOMAIN,
  MULTICLASS_CALIBRATION,
  NON_MEASUREMENT_PROBABILITY_KINDS,
  PERCENT_100_NORMALIZATION,
  RELIABILITY_CURVE,
  REQUIRED_HARD_FLAGS,
  SAMPLE_SUFFICIENCY_POLICY,
  SCALE_NORMALIZATION_POLICY,
  SEGMENTED_PERFORMANCE_POLICY,
  UNIT_INTERVAL_NORMALIZATION,
  UNKNOWN_SCALE,
  V1_CALIBRATION_SCOPE,
  ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS,
  aggregateBrier,
  assessCalibrationMeasurementEligibility,
  calculateBrier,
  computeBrierScore,
  getCalibrationMeasurementPolicyDescriptor,
  isCalibrationMeasurementEligible,
  isStructurallyPredictiveConfidence,
  mapBinaryCorrectnessTarget,
  meanBrier,
  normalizeCalibrationProbability,
  scoreObservation,
  validateCalibrationMeasurementPolicyDescriptor,
} from '../../contracts/artemisCalibrationMeasurementPolicyContract.js';
import { heuristicConfidence, unavailableConfidence } from '../../services/artemisEvidenceTruth.js';
import { mapPricePredictionPersistedRun } from '../../services/artemisEvidenceAdapters/pricePredictionAdapter.js';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisCalibrationMeasurementPolicyContract.js',
);

const PROTECTED_CONTRACT_PATHS = [
  '../../contracts/artemisConfidenceCalibrationContract.js',
  '../../contracts/artemisEvidenceContract.js',
  '../../contracts/artemisDecisionContract.js',
  '../../contracts/artemisObservedOutcomeContract.js',
  '../../contracts/artemisObservedOutcomeEvaluationContract.js',
  '../../contracts/artemisDecisionLineageContract.js',
  '../../contracts/artemisReplayContract.js',
  '../../contracts/artemisReplayResultContract.js',
  '../../contracts/artemisObservedOutcomeSourceOfTruthContract.js',
  '../../contracts/artemisObservedOutcomeEvaluationSourceOfTruthContract.js',
  '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js',
  '../../contracts/artemisMarketContextContract.js',
  '../../contracts/artemisMarketContextSourceOfTruthContract.js',
  '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateBoundaryContract.js',
  '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateActivationBoundaryContract.js',
  '../../contracts/artemisSynthesisContract.js',
];

const PROTECTED_SHA_BASELINE = Object.fromEntries(
  PROTECTED_CONTRACT_PATHS.map((rel) => {
    const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
    const sha = createHash('sha256').update(readFileSync(abs)).digest('hex');
    return [rel, sha];
  }),
);

function expectFail(fn, code) {
  try {
    fn();
    expect(true).toBe(false);
  } catch (err) {
    expect(err.code).toBe(code);
  }
}

function predictiveInput(overrides = {}) {
  return {
    confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
    value: 0.75,
    scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
    provenance: {
      writer: 'test-writer',
      methodKey: 'test.unregistered.method.v1',
    },
    ...overrides,
  };
}

describe('S10-CALIBRATION-MEASUREMENT-POLICY-CONTRACT — Measurement Policy Boundary', () => {
  // A — exact canonical constants
  describe('A. exact canonical constants', () => {
    it('exports version / identity constants', () => {
      expect(CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION).toBe('1.0.0');
      expect(CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION).toBe(
        'artemis-calibration-measurement-policy-1.0.0',
      );
      expect(CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION).toBe(
        'stage10-calibration-measurement-policy-1.0.0',
      );
      expect(CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION).toBe('1.0.0');
      expect(CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE).toBe(
        'ARTEMIS_CALIBRATION_MEASUREMENT_POLICY',
      );
      expect(CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS).toBe('CALIBRATION');
      expect(CALIBRATION_MEASUREMENT_POLICY_SLICE_ID).toBe(
        'S10-CALIBRATION-MEASUREMENT-POLICY-CONTRACT',
      );
      expect(CALIBRATION_MEASUREMENT_POLICY_IS_SOURCE_OF_TRUTH).toBe(false);
    });
  });

  // B — target event
  describe('B. target event TOP_LABEL_DIRECTIONAL_CORRECTNESS', () => {
    it('exports governed v1 target', () => {
      expect(CALIBRATION_TARGET_EVENT_V1).toBe('TOP_LABEL_DIRECTIONAL_CORRECTNESS');
      expect(CALIBRATION_TARGET_EVENT.TOP_LABEL_DIRECTIONAL_CORRECTNESS).toBe(
        CALIBRATION_TARGET_EVENT_V1,
      );
      expect(V1_CALIBRATION_SCOPE).toBe('TOP_LABEL_DIRECTIONAL_CORRECTNESS');
      expect(CALIBRATION_TARGET_EVENT_V1_SEMANTICS.targetEvent).toBe(
        CALIBRATION_TARGET_EVENT_V1,
      );
      expect(CALIBRATION_TARGET_EVENT_V1_SEMANTICS.inferredFromConfidenceKind).toBe(false);
      expect(CALIBRATION_TARGET_EVENT_V1_SEMANTICS.explicitProvenanceRequired).toBe(true);
    });
  });

  // C — target semantics NOT inferred from kind
  describe('C. target semantics NOT inferred from kind', () => {
    it('MODEL_PROBABILITY alone is not measurement eligible', () => {
      const a = assessCalibrationMeasurementEligibility({
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        value: 0.8,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      });
      expect(a.structurallyPredictive).toBe(true);
      expect(a.measurementEligible).toBe(false);
      expect(a.reasonCodes).toContain('KIND_NECESSARY_NOT_SUFFICIENT');
      expect(a.reasonCodes).toContain('METHOD_KEY_MISSING');
    });
  });

  // D — empty authorized-method registry
  describe('D. empty authorized-method registry', () => {
    it('AUTHORIZED_MEASUREMENT_METHODS is empty and immutable', () => {
      expect(AUTHORIZED_MEASUREMENT_METHODS).toEqual([]);
      expect(Object.isFrozen(AUTHORIZED_MEASUREMENT_METHODS)).toBe(true);
      expect(() => AUTHORIZED_MEASUREMENT_METHODS.push('x')).toThrow();
    });
  });

  // E / F — kind alone insufficient
  describe('E/F. MODEL_PROBABILITY and CALIBRATED alone are insufficient', () => {
    it('MODEL_PROBABILITY with value+scale is structurally predictive only', () => {
      const a = assessCalibrationMeasurementEligibility(predictiveInput({
        methodKey: undefined,
        provenance: undefined,
      }));
      expect(a.structurallyPredictive).toBe(true);
      expect(a.measurementEligible).toBe(false);
      expect(isCalibrationMeasurementEligible(predictiveInput({
        methodKey: undefined,
        provenance: undefined,
      }))).toBe(false);
      expect(isStructurallyPredictiveConfidence(predictiveInput({
        methodKey: undefined,
        provenance: undefined,
      }))).toBe(true);
    });

    it('CALIBRATED with value+scale is structurally predictive only', () => {
      const a = assessCalibrationMeasurementEligibility({
        confidenceKind: CONFIDENCE_KIND.CALIBRATED,
        value: 0.9,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      });
      expect(a.structurallyPredictive).toBe(true);
      expect(a.measurementEligible).toBe(false);
      expect(a.reasonCodes).toContain('CALIBRATED_KIND_NOT_TITANGOLD_VERIFIED');
    });
  });

  // G — CALIBRATED has no TitanGold verification bypass
  describe('G. CALIBRATED has no TitanGold verification bypass', () => {
    it('CALIBRATED_KIND_TITANGOLD_VERIFIED is false and no eligibility bypass', () => {
      expect(CALIBRATED_KIND_TITANGOLD_VERIFIED).toBe(false);
      const a = assessCalibrationMeasurementEligibility({
        confidenceKind: CONFIDENCE_KIND.CALIBRATED,
        value: 0.95,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
        methodKey: 'anything.caller.claims.calibrated',
        targetEvent: CALIBRATION_TARGET_EVENT_V1,
        provenance: {
          writer: 'caller',
          methodKey: 'anything.caller.claims.calibrated',
          targetEvent: CALIBRATION_TARGET_EVENT_V1,
        },
      });
      expect(a.measurementEligible).toBe(false);
      expect(a.calibratedKindTitangoldVerified).toBe(false);
      expect(a.reasonCodes).toContain('METHOD_KEY_NOT_AUTHORIZED');
    });
  });

  // H–M — rejected kinds
  describe('H–M. non-measurement probability kinds rejected', () => {
    const cases = [
      ['HEURISTIC', CONFIDENCE_KIND.HEURISTIC, 'HEURISTIC_NOT_PROBABILITY'],
      ['MEASURED', CONFIDENCE_KIND.MEASURED, 'MEASURED_KIND_IS_NOT_CALIBRATION_RESULT'],
      ['RULE_SCORE', CONFIDENCE_KIND.RULE_SCORE, null],
      ['DERIVED', CONFIDENCE_KIND.DERIVED, null],
      ['LEGACY', CONFIDENCE_KIND.LEGACY, null],
      ['UNAVAILABLE', CONFIDENCE_KIND.UNAVAILABLE, null],
    ];

    it.each(cases)('%s rejected as measurement probability', (label, kind, extraCode) => {
      expect(NON_MEASUREMENT_PROBABILITY_KINDS[label]).toBe(kind);
      const a = assessCalibrationMeasurementEligibility({
        confidenceKind: kind,
        value: 0.8,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      });
      expect(a.structurallyPredictive).toBe(false);
      expect(a.measurementEligible).toBe(false);
      expect(a.reasonCodes).toContain('CONFIDENCE_KIND_NOT_MEASUREMENT_PROBABILITY');
      if (extraCode) expect(a.reasonCodes).toContain(extraCode);
    });

    it('MEASURED_KIND_IS_CALIBRATION_RESULT is false', () => {
      expect(MEASURED_KIND_IS_CALIBRATION_RESULT).toBe(false);
    });

    it('0.8 HEURISTIC does not become 80% probability eligibility', () => {
      const a = assessCalibrationMeasurementEligibility({
        confidenceKind: CONFIDENCE_KIND.HEURISTIC,
        value: 0.8,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      });
      expect(a.measurementEligible).toBe(false);
      expect(a.structurallyPredictive).toBe(false);
    });
  });

  // N — missing provenance
  describe('N. missing provenance rejected/ineligible', () => {
    it('fails measurement eligibility when provenance missing', () => {
      const a = assessCalibrationMeasurementEligibility({
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        value: 0.7,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      });
      expect(a.reasonCodes).toContain('PROVENANCE_MISSING');
      expect(a.measurementEligible).toBe(false);
    });
  });

  // O — unregistered methodKey
  describe('O. unregistered methodKey rejected/ineligible', () => {
    it('rejects unregistered methodKey', () => {
      const a = assessCalibrationMeasurementEligibility(predictiveInput());
      expect(a.reasonCodes).toContain('METHOD_KEY_NOT_AUTHORIZED');
      expect(a.measurementEligible).toBe(false);
    });
  });

  // P — arbitrary caller semantic self-registration rejected
  describe('P. arbitrary caller semantic self-registration rejected', () => {
    it('caller-supplied methodKey+targetEvent does not authorize eligibility', () => {
      const a = assessCalibrationMeasurementEligibility({
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        value: 0.8,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
        methodKey: 'anything',
        targetEvent: CALIBRATION_TARGET_EVENT_V1,
        targetSemantics: {
          targetEvent: CALIBRATION_TARGET_EVENT_V1,
          description: 'caller claims compatibility',
        },
        provenance: {
          writer: 'caller',
          methodKey: 'anything',
          targetEvent: CALIBRATION_TARGET_EVENT_V1,
        },
      });
      expect(a.measurementEligible).toBe(false);
      expect(a.reasonCodes).toContain('METHOD_KEY_NOT_AUTHORIZED');
      expect(a.reasonCodes).toContain('CALLER_SELF_REGISTRATION_REJECTED');
    });
  });

  // Q–W — scale normalization
  describe('Q–W. measurement domain normalization', () => {
    it('Q. unit_interval identity', () => {
      const r = normalizeCalibrationProbability(0.8, CONFIDENCE_SCALE.UNIT_INTERVAL);
      expect(r.normalized).toBe(0.8);
      expect(r.sourceRawValue).toBe(0.8);
      expect(r.normalization).toBe(UNIT_INTERVAL_NORMALIZATION);
      expect(r.measurementDomain).toBe(MEASUREMENT_DOMAIN);
    });

    it('R. percent_100 DIVIDE_BY_100', () => {
      const r = normalizeCalibrationProbability(80, CONFIDENCE_SCALE.PERCENT_100);
      expect(r.normalized).toBe(0.8);
      expect(r.sourceRawValue).toBe(80);
      expect(r.normalization).toBe(PERCENT_100_NORMALIZATION);
      expect(PERCENT_100_NORMALIZATION).toBe('DIVIDE_BY_100');
    });

    it('S. boundary values 0 and 1 unit_interval', () => {
      expect(normalizeCalibrationProbability(0, CONFIDENCE_SCALE.UNIT_INTERVAL).normalized).toBe(0);
      expect(normalizeCalibrationProbability(1, CONFIDENCE_SCALE.UNIT_INTERVAL).normalized).toBe(1);
    });

    it('T. percent boundary 0 and 100', () => {
      expect(normalizeCalibrationProbability(0, CONFIDENCE_SCALE.PERCENT_100).normalized).toBe(0);
      expect(normalizeCalibrationProbability(100, CONFIDENCE_SCALE.PERCENT_100).normalized).toBe(1);
    });

    it('U. invalid/out-of-range values rejected', () => {
      expectFail(
        () => normalizeCalibrationProbability(1.01, CONFIDENCE_SCALE.UNIT_INTERVAL),
        'CALIBRATION_MEASUREMENT_POLICY_UNIT_INTERVAL_OUT_OF_RANGE',
      );
      expectFail(
        () => normalizeCalibrationProbability(-0.01, CONFIDENCE_SCALE.UNIT_INTERVAL),
        'CALIBRATION_MEASUREMENT_POLICY_UNIT_INTERVAL_OUT_OF_RANGE',
      );
      expectFail(
        () => normalizeCalibrationProbability(101, CONFIDENCE_SCALE.PERCENT_100),
        'CALIBRATION_MEASUREMENT_POLICY_PERCENT_100_OUT_OF_RANGE',
      );
      expectFail(
        () => normalizeCalibrationProbability(-1, CONFIDENCE_SCALE.PERCENT_100),
        'CALIBRATION_MEASUREMENT_POLICY_PERCENT_100_OUT_OF_RANGE',
      );
    });

    it('V. NaN/Infinity rejected', () => {
      expectFail(
        () => normalizeCalibrationProbability(Number.NaN, CONFIDENCE_SCALE.UNIT_INTERVAL),
        'CALIBRATION_MEASUREMENT_POLICY_VALUE_NOT_FINITE',
      );
      expectFail(
        () => normalizeCalibrationProbability(Number.POSITIVE_INFINITY, CONFIDENCE_SCALE.UNIT_INTERVAL),
        'CALIBRATION_MEASUREMENT_POLICY_VALUE_NOT_FINITE',
      );
    });

    it('W. unknown scale rejected', () => {
      expect(UNKNOWN_SCALE).toBe('REJECT');
      expect(SCALE_NORMALIZATION_POLICY.unknown).toBe('REJECT');
      expectFail(
        () => normalizeCalibrationProbability(0.5, CONFIDENCE_SCALE.UNKNOWN),
        'CALIBRATION_MEASUREMENT_POLICY_UNKNOWN_SCALE',
      );
      expectFail(
        () => normalizeCalibrationProbability(0.5, null),
        'CALIBRATION_MEASUREMENT_POLICY_UNKNOWN_SCALE',
      );
      expectFail(
        () => normalizeCalibrationProbability(0.5, 'guessed'),
        'CALIBRATION_MEASUREMENT_POLICY_UNKNOWN_SCALE',
      );
    });

    it('does not mutate source and does not clamp', () => {
      expect(SCALE_NORMALIZATION_POLICY.clamp).toBe(false);
      expect(SCALE_NORMALIZATION_POLICY.sourceRawValueUnmodified).toBe(true);
      const raw = 80;
      const r = normalizeCalibrationProbability(raw, CONFIDENCE_SCALE.PERCENT_100);
      expect(raw).toBe(80);
      expect(r.sourceRawValue).toBe(80);
    });
  });

  // X–Z — binary correctness mapping
  describe('X–Z. binary correctness mapping', () => {
    it('X. MATCH -> 1', () => {
      expect(BINARY_CORRECTNESS_MAPPING.MATCH).toBe(1);
      expect(mapBinaryCorrectnessTarget(EVALUATION_STATUS.MATCH).y).toBe(1);
    });

    it('Y. MISMATCH -> 0', () => {
      expect(BINARY_CORRECTNESS_MAPPING.MISMATCH).toBe(0);
      expect(mapBinaryCorrectnessTarget(EVALUATION_STATUS.MISMATCH).y).toBe(0);
    });

    it('Z. other evaluation statuses rejected', () => {
      expectFail(
        () => mapBinaryCorrectnessTarget(EVALUATION_STATUS.INSUFFICIENT_DATA),
        'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_REJECTED',
      );
      expectFail(
        () => mapBinaryCorrectnessTarget(EVALUATION_STATUS.BLOCKED),
        'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_REJECTED',
      );
      expectFail(
        () => mapBinaryCorrectnessTarget(EVALUATION_STATUS.UNAVAILABLE),
        'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_REJECTED',
      );
      expectFail(
        () => mapBinaryCorrectnessTarget('UNKNOWN'),
        'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_REJECTED',
      );
      expectFail(
        () => mapBinaryCorrectnessTarget('UNEVALUABLE'),
        'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_REJECTED',
      );
      expectFail(
        () => mapBinaryCorrectnessTarget(null),
        'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_MISSING',
      );
    });
  });

  // AA–AD — BINARY_BRIER semantics / no execution
  describe('AA–AD. BINARY_BRIER_SCORE semantics without execution', () => {
    it('AA. BINARY_BRIER_SCORE identity present', () => {
      expect(FIRST_ALLOWED_PROPER_SCORE).toBe('BINARY_BRIER_SCORE');
      expect(BINARY_BRIER_SCORE).toBe('BINARY_BRIER_SCORE');
      const d = getCalibrationMeasurementPolicyDescriptor();
      expect(d.firstAllowedProperScore).toBe(BINARY_BRIER_SCORE);
      expect(d.metricSemantics.BINARY_BRIER_SCORE.metricIdentity).toBe(BINARY_BRIER_SCORE);
    });

    it('AB. formula semantics exactly governed', () => {
      expect(BINARY_BRIER_FORMULA_SEMANTICS).toBe('(p-y)^2');
      expect(
        getCalibrationMeasurementPolicyDescriptor().metricSemantics.BINARY_BRIER_SCORE
          .formulaIdentity,
      ).toBe('(p-y)^2');
    });

    it('AC. no numeric Brier computation/output', () => {
      expect(BINARY_BRIER_EXECUTION).toBe(false);
      expectFail(() => computeBrierScore(), 'CALIBRATION_MEASUREMENT_POLICY_BRIER_EXECUTION_FORBIDDEN');
      expectFail(() => calculateBrier(), 'CALIBRATION_MEASUREMENT_POLICY_BRIER_EXECUTION_FORBIDDEN');
      expectFail(() => scoreObservation(), 'CALIBRATION_MEASUREMENT_POLICY_SCORE_EXECUTION_FORBIDDEN');
      expectFail(() => aggregateBrier(), 'CALIBRATION_MEASUREMENT_POLICY_AGGREGATE_FORBIDDEN');
      expectFail(() => meanBrier(), 'CALIBRATION_MEASUREMENT_POLICY_AGGREGATE_FORBIDDEN');

      const d = getCalibrationMeasurementPolicyDescriptor();
      expect(d).not.toHaveProperty('brierScore');
      expect(d).not.toHaveProperty('score');
      expect(d).not.toHaveProperty('ece');
      expect(d).not.toHaveProperty('reliabilityCurve');
      expect(d.eceStatus).toBe(ECE);
      expect(d.reliabilityCurveStatus).toBe(RELIABILITY_CURVE);
      expect(d.binaryBrierExecution).toBe(false);
    });

    it('AD. Brier not standalone calibration verdict', () => {
      expect(BINARY_BRIER_STANDALONE_CALIBRATION_VERDICT).toBe(false);
      expect(
        getCalibrationMeasurementPolicyDescriptor().binaryBrierStandaloneCalibrationVerdict,
      ).toBe(false);
    });
  });

  // AE–AJ — deferred metrics / no thresholds
  describe('AE–AJ. deferred metrics and no invented thresholds', () => {
    it('AE. ECE deferred', () => {
      expect(ECE).toBe('DEFERRED_PENDING_AGGREGATION_AND_BINNING_POLICY');
      expect(DEFERRED_METRIC_STATUS.TOP_LABEL_ECE).toBe(ECE);
    });

    it('AF. reliability deferred', () => {
      expect(RELIABILITY_CURVE).toBe('DEFERRED_PENDING_AGGREGATION_AND_BINNING_POLICY');
    });

    it('AG. multiclass deferred', () => {
      expect(MULTICLASS_CALIBRATION).toBe('DEFERRED');
      expect(FULL_CLASS_PROBABILITY_VECTOR).toBe(false);
    });

    it('AH. no 1-confidence synthesized class distribution', () => {
      expect(CALIBRATION_TARGET_EVENT_V1_SEMANTICS.synthesizesUnselectedClassDistribution).toBe(
        false,
      );
      expect(CALIBRATION_TARGET_EVENT_V1_SEMANTICS.fullClassProbabilityVectorRequired).toBe(false);
      const src = readFileSync(CONTRACT_PATH, 'utf8');
      expect(src).not.toMatch(/1\s*-\s*confidence/);
      expect(src).not.toMatch(/1\s*-\s*p\b/);
    });

    it('AI. no binning thresholds', () => {
      expect(BINNING_POLICY).toBe('UNDEFINED / DEFERRED');
      const d = getCalibrationMeasurementPolicyDescriptor();
      expect(d).not.toHaveProperty('binCount');
      expect(d).not.toHaveProperty('bucketCounts');
    });

    it('AJ. no sample thresholds', () => {
      expect(SAMPLE_SUFFICIENCY_POLICY).toBe('UNDEFINED / DEFERRED');
      expect(SEGMENTED_PERFORMANCE_POLICY).toMatch(/DEFERRED/);
      expect(GLOBAL_AVERAGE_ONLY).toMatch(/NOT SUFFICIENT/);
      const d = getCalibrationMeasurementPolicyDescriptor();
      expect(d).not.toHaveProperty('sampleCount');
      expect(d).not.toHaveProperty('minimumSampleCount');
    });
  });

  // AK–AL — no trust/weight/promotion
  describe('AK–AL. no trust/weight/promotion/demotion output', () => {
    it('descriptor and assessment omit trust/weight/promotion fields', () => {
      const d = getCalibrationMeasurementPolicyDescriptor();
      expect(d).not.toHaveProperty('trustScore');
      expect(d).not.toHaveProperty('weight');
      expect(d).not.toHaveProperty('promotionStatus');
      expect(d).not.toHaveProperty('demotionStatus');
      expect(d.hardFlags.trustMutation).toBe(false);
      expect(d.hardFlags.weightMutation).toBe(false);
      expect(d.hardFlags.promotionExecution).toBe(false);
      expect(d.hardFlags.demotionExecution).toBe(false);

      const a = assessCalibrationMeasurementEligibility(predictiveInput());
      expect(a).not.toHaveProperty('trustScore');
      expect(a).not.toHaveProperty('weight');
      expect(a).not.toHaveProperty('promotionStatus');
      expect(a).not.toHaveProperty('brierScore');
    });
  });

  // AM — zero complete side-effect ledger
  describe('AM. zero complete side-effect ledger', () => {
    it('all required side-effect counters are zero', () => {
      const s = ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS;
      expect(s.dbWriteCount).toBe(0);
      expect(s.redisWriteCount).toBe(0);
      expect(s.networkCallCount).toBe(0);
      expect(s.providerCallCount).toBe(0);
      expect(s.llmCallCount).toBe(0);
      expect(s.workerMutationCount).toBe(0);
      expect(s.schedulerMutationCount).toBe(0);
      expect(s.runtimeMutationCount).toBe(0);
      expect(s.calibrationExecutionCount).toBe(0);
      expect(s.aggregateMeasurementCount).toBe(0);
      expect(s.trustMutationCount).toBe(0);
      expect(s.weightMutationCount).toBe(0);
      expect(s.promotionCount).toBe(0);
      expect(s.demotionCount).toBe(0);
      expect(s.orderCount).toBe(0);
      expect(s.walletMutationCount).toBe(0);
      expect(s.financialExecutionCount).toBe(0);
      expect(Object.isFrozen(s)).toBe(true);
    });
  });

  // AN — hard flags explicitly false
  describe('AN. required hard flags explicitly false', () => {
    it('REQUIRED_HARD_FLAGS all false', () => {
      for (const [k, v] of Object.entries(REQUIRED_HARD_FLAGS)) {
        expect(v).toBe(false);
      }
      expect(REQUIRED_HARD_FLAGS.isSourceOfTruth).toBe(false);
      expect(REQUIRED_HARD_FLAGS.calibrationExecution).toBe(false);
      expect(REQUIRED_HARD_FLAGS.aggregateMeasurement).toBe(false);
      expect(REQUIRED_HARD_FLAGS.financialExecution).toBe(false);
    });
  });

  // AO–AQ — deterministic immutable descriptor
  describe('AO–AQ. deterministic immutable descriptor', () => {
    it('AO. deterministic descriptor', () => {
      const a = getCalibrationMeasurementPolicyDescriptor();
      const b = getCalibrationMeasurementPolicyDescriptor();
      expect(a).toBe(CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR);
      expect(b).toBe(CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.targetEvent).toBe(CALIBRATION_TARGET_EVENT_V1);
      expect(a.allowedPredictiveKinds).toEqual([
        ALLOWED_PREDICTIVE_KINDS.MODEL_PROBABILITY,
        ALLOWED_PREDICTIVE_KINDS.CALIBRATED,
      ]);
      expect(a.authorizedMeasurementMethods).toEqual([]);
      expect(a.currentProductionCalibrationEligibleProducers).toBe(
        CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS,
      );
      expect(CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS).toBe('NONE / NOT PROVEN');
    });

    it('AP. deep immutability', () => {
      const d = getCalibrationMeasurementPolicyDescriptor();
      expect(Object.isFrozen(d)).toBe(true);
      expect(Object.isFrozen(d.hardFlags)).toBe(true);
      expect(Object.isFrozen(d.sideEffects)).toBe(true);
      expect(Object.isFrozen(d.metricSemantics.BINARY_BRIER_SCORE)).toBe(true);
      expect(() => {
        d.targetEvent = 'HACK';
      }).toThrow();
      expect(() => {
        d.hardFlags.calibrationExecution = true;
      }).toThrow();
    });

    it('AQ. no Date.now/random identity', () => {
      const src = readFileSync(CONTRACT_PATH, 'utf8');
      expect(src).not.toMatch(/Date\.now\s*\(/);
      expect(src).not.toMatch(/Math\.random\s*\(/);
      expect(src).not.toMatch(/randomUUID\s*\(/);
      expect(src).not.toMatch(/randomBytes\s*\(/);
      const d = getCalibrationMeasurementPolicyDescriptor();
      expect(d).not.toHaveProperty('recordedAt');
      expect(d).not.toHaveProperty('createdAt');
      expect(JSON.stringify(d)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('validateCalibrationMeasurementPolicyDescriptor accepts canonical', () => {
      const v = validateCalibrationMeasurementPolicyDescriptor(
        getCalibrationMeasurementPolicyDescriptor(),
      );
      expect(v.contractVersion).toBe(CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION);
    });
  });

  // AR–AT — fail closed unknown/secret/protected
  describe('AR–AT. unknown-field / secret / protected-field fail closed', () => {
    it('AR. unknown-field fail closed', () => {
      expectFail(
        () => assessCalibrationMeasurementEligibility({
          confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
          value: 0.5,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          unexpectedField: true,
        }),
        'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_UNKNOWN_FIELD',
      );
    });

    it('AS. secret contamination fail closed', () => {
      // Top-level secret-like key is not on the eligibility allowlist.
      expectFail(
        () => assessCalibrationMeasurementEligibility({
          confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
          value: 0.5,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          apiKey: 'sk-secret',
        }),
        'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_UNKNOWN_FIELD',
      );
      // Nested forbidden payload key is caught by deep forbidden-key scan
      // before provenance allowlist (fail-closed secret/payload safety).
      expectFail(
        () => assessCalibrationMeasurementEligibility({
          confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
          value: 0.5,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          provenance: { writer: 'x', methodKey: 'y', password: 'p' },
        }),
        'CALIBRATION_MEASUREMENT_POLICY_FORBIDDEN_FIELD',
      );
    });

    it('AT. protected-field contamination fail closed', () => {
      expectFail(
        () => assessCalibrationMeasurementEligibility({
          confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
          value: 0.5,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          brierScore: 0.1,
        }),
        'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_UNKNOWN_FIELD',
      );
      expectFail(
        () => assessCalibrationMeasurementEligibility({
          confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
          value: 0.5,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          trustScore: 0.9,
        }),
        'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_UNKNOWN_FIELD',
      );
      expectFail(
        () => assessCalibrationMeasurementEligibility({
          confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
          value: 0.5,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          orders: [{ id: 1 }],
        }),
        'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_UNKNOWN_FIELD',
      );
    });
  });

  // AU — artifact size bound
  describe('AU. artifact size bound', () => {
    it('rejects oversized note in eligibility input', () => {
      expectFail(
        () => assessCalibrationMeasurementEligibility({
          confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
          value: 0.5,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          note: 'x'.repeat(3000),
        }),
        'CALIBRATION_MEASUREMENT_POLICY_NOTE_INVALID',
      );
    });
  });

  // AV — upstream frozen owners unchanged
  describe('AV. upstream frozen owners unchanged', () => {
    it('protected contract file SHA256 unchanged by this suite', () => {
      for (const [rel, sha] of Object.entries(PROTECTED_SHA_BASELINE)) {
        const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
        const now = createHash('sha256').update(readFileSync(abs)).digest('hex');
        expect(now).toBe(sha);
      }
    });
  });

  // AW — current producers not silently reclassified
  describe('AW. current producers are not silently reclassified', () => {
    it('Price Prediction heuristic confidence != MODEL_PROBABILITY', () => {
      const mapped = mapPricePredictionPersistedRun({
        nowMs: Date.parse('2026-08-10T12:10:00.000Z'),
        row: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-0000000000pp',
          agent_id: 'aaaaaaaa-aaaa-4aaa-8aaa-0000000000a1',
          created_at: '2026-08-10T12:00:00.000Z',
        },
        output: {
          timestamp: '2026-08-10T12:00:00.000Z',
          timeframe: '1h',
          method: 'arima',
          current_price: 100,
          predictions: { '24h': { price: 110 } },
          last_candle_timestamp: '2026-08-10T11:00:00.000Z',
          _meta: { confidence: 0.72, dataProvider: 'mexc' },
        },
        input: { timeframe: '1h', symbol: 'BTC/USDT' },
      });
      expect(mapped.ok).toBe(true);
      const envelope = mapped.envelope;
      expect(envelope.confidence.kind).toBe(CONFIDENCE_KIND.HEURISTIC);
      expect(envelope.confidence.kind).not.toBe(CONFIDENCE_KIND.MODEL_PROBABILITY);
      const a = assessCalibrationMeasurementEligibility({
        confidenceKind: envelope.confidence.kind,
        value: envelope.confidence.value,
        scale: envelope.confidence.scale,
      });
      expect(a.measurementEligible).toBe(false);
      expect(a.structurallyPredictive).toBe(false);
    });

    it('heuristicConfidence helper remains HEURISTIC', () => {
      const c = heuristicConfidence({
        value: 0.8,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
        path: 'test',
      });
      expect(c.kind).toBe(CONFIDENCE_KIND.HEURISTIC);
    });

    it('unavailableConfidence remains UNAVAILABLE (synthesis-style)', () => {
      const c = unavailableConfidence('deterministic_synthesis_unavailable', {
        methodKey: 'synthesis',
      });
      expect(c.kind).toBe(CONFIDENCE_KIND.UNAVAILABLE);
      const a = assessCalibrationMeasurementEligibility({
        confidenceKind: c.kind,
        value: c.value,
        scale: c.scale,
      });
      expect(a.measurementEligible).toBe(false);
    });

    it('CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS remains NONE / NOT PROVEN', () => {
      expect(CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS).toBe('NONE / NOT PROVEN');
    });
  });

  // AX — Confidence Calibration Contract regression remains valid (import + versions)
  describe('AX. Confidence Calibration Contract regression remains valid', () => {
    it('thin observation binding requires canonical version identity', () => {
      expectFail(
        () => assessCalibrationMeasurementEligibility({
          confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
          value: 0.5,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          calibrationObservation: {
            calibrationObservationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            artifactType: 'WRONG',
            contractVersion: CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
            schemaVersion: CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
          },
        }),
        'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_ARTIFACT_TYPE_MISMATCH',
      );

      const ok = assessCalibrationMeasurementEligibility({
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        value: 0.5,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
        calibrationObservation: {
          calibrationObservationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          artifactType: CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
          contractVersion: CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
          schemaVersion: CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
        },
      });
      expect(ok.measurementEligible).toBe(false);
      expect(ok.structurallyPredictive).toBe(true);
    });
  });

  // Adversarial extras
  describe('adversarial extras', () => {
    it('ineligibility is not a zero score', () => {
      const a = assessCalibrationMeasurementEligibility(predictiveInput());
      expect(a.ineligibilityIsNotZeroScore).toBe(true);
      expect(a).not.toHaveProperty('y');
      expect(a).not.toHaveProperty('brierScore');
      expect(a).not.toHaveProperty('score');
    });

    it('rejects nested forbidden result keys in confidence', () => {
      // Deep forbidden-key scan runs before nested confidence allowlist.
      expectFail(
        () => assessCalibrationMeasurementEligibility({
          confidence: {
            kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
            value: 0.5,
            scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
            ece: 0.1,
          },
        }),
        'CALIBRATION_MEASUREMENT_POLICY_FORBIDDEN_FIELD',
      );
    });

    it('ALLOWED_PREDICTIVE_KINDS exactly MODEL_PROBABILITY | CALIBRATED', () => {
      expect(Object.keys(ALLOWED_PREDICTIVE_KINDS).sort()).toEqual([
        'CALIBRATED',
        'MODEL_PROBABILITY',
      ]);
    });

    it('descriptor hardFlags.calibrationExecution is explicitly false (not omitted)', () => {
      const d = getCalibrationMeasurementPolicyDescriptor();
      expect(Object.prototype.hasOwnProperty.call(d.hardFlags, 'calibrationExecution')).toBe(true);
      expect(d.hardFlags.calibrationExecution).toBe(false);
    });
  });
});
