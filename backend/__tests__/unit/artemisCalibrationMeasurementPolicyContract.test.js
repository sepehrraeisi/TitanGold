/**
 * Artemis Calibration Measurement Policy Contract — dedicated unit tests
 * Stage 10 S10-CALIBRATION-MEASUREMENT-POLICY-CONTRACT (fail-closed hardening)
 *
 * Covers governed v1 semantics + adversarial registry/descriptor/source/API tests A–Z.
 */

import { describe, expect, test } from '@jest/globals';

import {
  AVAILABILITY,
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
  AUTHORIZED_MEASUREMENT_METHODS,
  ALLOWED_PREDICTIVE_KIND_VALUES,
  USABLE_BINARY_EVALUATION_STATUSES,
  CONFIDENCE_SCALE_VALUES,
  CALIBRATION_TARGET_EVENT_V1,
  TARGET_SEMANTICS_INFERRED_FROM_KIND,
  EXPLICIT_PROVENANCE_REQUIRED,
  CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS,
  ALLOWED_PREDICTIVE_KINDS,
  MEASURED_KIND_IS_CALIBRATION_RESULT,
  CALIBRATED_KIND_TITANGOLD_VERIFIED,
  MEASUREMENT_DOMAIN,
  UNIT_INTERVAL_NORMALIZATION,
  PERCENT_100_NORMALIZATION,
  MATCH_NUMERIC,
  MISMATCH_NUMERIC,
  FIRST_ALLOWED_PROPER_SCORE,
  BINARY_BRIER_SCORE,
  BINARY_BRIER_FORMULA_SEMANTICS,
  BINARY_BRIER_EXECUTION,
  BINARY_BRIER_STANDALONE_CALIBRATION_VERDICT,
  ECE,
  RELIABILITY_CURVE,
  MULTICLASS_CALIBRATION,
  CALLER_SELF_REGISTRATION,
  METHOD_REGISTRATION_OWNER,
  CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR,
  REQUIRED_HARD_FLAGS,
  ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS,
  CalibrationMeasurementPolicyContractError,
  getCalibrationMeasurementPolicyDescriptor,
  validateCalibrationMeasurementPolicyDescriptor,
  normalizeConfidenceToUnitInterval,
  mapBinaryCorrectnessTarget,
  assessCalibrationMeasurementEligibility,
  isMeasurementEligiblePredictiveClaim,
  default as policyDefault,
} from '../../contracts/artemisCalibrationMeasurementPolicyContract.js';

const OBS_ID = '11111111-1111-4111-8111-111111111111';

function thinObsRef(overrides = {}) {
  return {
    calibrationObservationId: OBS_ID,
    artifactType: CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
    contractVersion: CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
    schemaVersion: CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
    ...overrides,
  };
}

function predictiveBase(overrides = {}) {
  return {
    kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
    value: 0.75,
    scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
    provenance: { writer: 'test-writer', methodKey: 'evil.method' },
    ...overrides,
  };
}

function cloneDescriptor() {
  return structuredClone(getCalibrationMeasurementPolicyDescriptor());
}

describe('artemisCalibrationMeasurementPolicyContract — governed semantics', () => {
  test('canonical target / provenance / empty registry / Brier semantics metadata', () => {
    expect(CALIBRATION_TARGET_EVENT_V1).toBe('TOP_LABEL_DIRECTIONAL_CORRECTNESS');
    expect(TARGET_SEMANTICS_INFERRED_FROM_KIND).toBe(false);
    expect(EXPLICIT_PROVENANCE_REQUIRED).toBe(true);
    expect(AUTHORIZED_MEASUREMENT_METHODS).toEqual([]);
    expect(Object.isFrozen(AUTHORIZED_MEASUREMENT_METHODS)).toBe(true);
    expect(CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS).toBe('NONE / NOT PROVEN');
    expect(ALLOWED_PREDICTIVE_KINDS.MODEL_PROBABILITY).toBe(CONFIDENCE_KIND.MODEL_PROBABILITY);
    expect(ALLOWED_PREDICTIVE_KINDS.CALIBRATED).toBe(CONFIDENCE_KIND.CALIBRATED);
    expect(MEASURED_KIND_IS_CALIBRATION_RESULT).toBe(false);
    expect(CALIBRATED_KIND_TITANGOLD_VERIFIED).toBe(false);
    expect(MEASUREMENT_DOMAIN).toBe('UNIT_INTERVAL');
    expect(UNIT_INTERVAL_NORMALIZATION).toBe('IDENTITY');
    expect(PERCENT_100_NORMALIZATION).toBe('DIVIDE_BY_100');
    expect(MATCH_NUMERIC).toBe(1);
    expect(MISMATCH_NUMERIC).toBe(0);
    expect(FIRST_ALLOWED_PROPER_SCORE).toBe('BINARY_BRIER_SCORE');
    expect(BINARY_BRIER_SCORE).toBe('BINARY_BRIER_SCORE');
    expect(BINARY_BRIER_FORMULA_SEMANTICS).toBe('(p-y)^2');
    expect(BINARY_BRIER_EXECUTION).toBe(false);
    expect(BINARY_BRIER_STANDALONE_CALIBRATION_VERDICT).toBe(false);
    expect(ECE).toMatch(/DEFERRED/);
    expect(RELIABILITY_CURVE).toMatch(/DEFERRED/);
    expect(MULTICLASS_CALIBRATION).toBe('DEFERRED');
    expect(CALLER_SELF_REGISTRATION).toBe('FORBIDDEN');
    expect(METHOD_REGISTRATION_OWNER).toBe('artemisCalibrationMeasurementPolicyContract');
    expect(CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION).toBe('1.0.0');
  });

  test('normalizeConfidenceToUnitInterval identity / percent_100 / unknown reject', () => {
    expect(normalizeConfidenceToUnitInterval(0.42, CONFIDENCE_SCALE.UNIT_INTERVAL)).toBe(0.42);
    expect(normalizeConfidenceToUnitInterval(80, CONFIDENCE_SCALE.PERCENT_100)).toBe(0.8);
    expect(() => normalizeConfidenceToUnitInterval(0.5, CONFIDENCE_SCALE.UNKNOWN)).toThrow(
      CalibrationMeasurementPolicyContractError,
    );
  });

  test('mapBinaryCorrectnessTarget MATCH=1 MISMATCH=0; unavailable-class rejected', () => {
    expect(mapBinaryCorrectnessTarget(EVALUATION_STATUS.MATCH)).toBe(1);
    expect(mapBinaryCorrectnessTarget(EVALUATION_STATUS.MISMATCH)).toBe(0);
    expect(() => mapBinaryCorrectnessTarget('UNKNOWN')).toThrow(CalibrationMeasurementPolicyContractError);
    expect(() => mapBinaryCorrectnessTarget(null)).toThrow(CalibrationMeasurementPolicyContractError);
  });

  test('v1 empty registry ⇒ measurementEligible always false for MODEL_PROBABILITY', () => {
    const result = assessCalibrationMeasurementEligibility(predictiveBase());
    expect(result.structurallyPredictive).toBe(true);
    expect(result.measurementEligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      'METHOD_NOT_AUTHORIZED',
      'KIND_NECESSARY_NOT_SUFFICIENT',
    ]));
    expect(isMeasurementEligiblePredictiveClaim(predictiveBase())).toBe(false);
  });

  test('HEURISTIC is not structurally predictive', () => {
    const result = assessCalibrationMeasurementEligibility(predictiveBase({
      kind: CONFIDENCE_KIND.HEURISTIC,
    }));
    expect(result.structurallyPredictive).toBe(false);
    expect(result.measurementEligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(['NON_MEASUREMENT_PROBABILITY_KIND']));
  });

  test('CALIBRATED remains non-eligible and notes not TitanGold-verified', () => {
    const result = assessCalibrationMeasurementEligibility(predictiveBase({
      kind: CONFIDENCE_KIND.CALIBRATED,
    }));
    expect(result.structurallyPredictive).toBe(true);
    expect(result.measurementEligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      'CALIBRATED_KIND_NOT_TITANGOLD_VERIFIED',
      'METHOD_NOT_AUTHORIZED',
    ]));
  });

  test('canonical descriptor validates and getDescriptor is frozen', () => {
    const d = getCalibrationMeasurementPolicyDescriptor();
    expect(Object.isFrozen(d)).toBe(true);
    expect(Object.isFrozen(d.hardFlags)).toBe(true);
    expect(Object.isFrozen(d.sideEffects)).toBe(true);
    expect(validateCalibrationMeasurementPolicyDescriptor(cloneDescriptor())).toBe(d);
    expect(d.authorizedMeasurementMethods).toEqual([]);
    expect(d.schemaVersion).toBe(CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION);
    expect(d.contractVersion).toBe(CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION);
  });
});

describe('adversarial hardening A–Z', () => {
  // A — exported method registry cannot be mutated to authorize a method
  test('A: AUTHORIZED_MEASUREMENT_METHODS mutation cannot authorize evil.method', () => {
    expect(() => {
      AUTHORIZED_MEASUREMENT_METHODS.push('evil.method');
    }).toThrow();
    // Even if a consumer somehow obtained a Set-like surface, none is exported.
    expect(policyDefault.AUTHORIZED_MEASUREMENT_METHOD_SET).toBeUndefined();
    expect(AUTHORIZED_MEASUREMENT_METHODS.includes('evil.method')).toBe(false);

    const result = assessCalibrationMeasurementEligibility(predictiveBase({
      provenance: { writer: 'attacker', methodKey: 'evil.method' },
    }));
    expect(result.measurementEligible).toBe(false);
    expect(result.methodAuthorized).toBe(false);
  });

  // B — allowed-kind collection cannot be mutated
  test('B: ALLOWED_PREDICTIVE_KIND_VALUES mutation cannot alter policy authority', () => {
    expect(Object.isFrozen(ALLOWED_PREDICTIVE_KIND_VALUES)).toBe(true);
    expect(() => {
      ALLOWED_PREDICTIVE_KIND_VALUES.push(CONFIDENCE_KIND.HEURISTIC);
    }).toThrow();
    expect(ALLOWED_PREDICTIVE_KIND_VALUES.includes(CONFIDENCE_KIND.HEURISTIC)).toBe(false);
    const result = assessCalibrationMeasurementEligibility(predictiveBase({
      kind: CONFIDENCE_KIND.HEURISTIC,
    }));
    expect(result.structurallyPredictive).toBe(false);
  });

  // C — usable evaluation status collection cannot be mutated so UNKNOWN becomes accepted
  test('C: USABLE_BINARY_EVALUATION_STATUSES mutation cannot accept UNKNOWN', () => {
    expect(Object.isFrozen(USABLE_BINARY_EVALUATION_STATUSES)).toBe(true);
    expect(() => {
      USABLE_BINARY_EVALUATION_STATUSES.push('UNKNOWN');
    }).toThrow();
    expect(() => mapBinaryCorrectnessTarget('UNKNOWN')).toThrow(
      CalibrationMeasurementPolicyContractError,
    );
    expect(Object.isFrozen(CONFIDENCE_SCALE_VALUES)).toBe(true);
    expect(() => {
      CONFIDENCE_SCALE_VALUES.push('attacker_scale');
    }).toThrow();
  });

  // D — descriptor unknown benign field rejected
  test('D: descriptor unknown benign field rejected', () => {
    const d = cloneDescriptor();
    d.benignExtra = 'ok';
    expect(() => validateCalibrationMeasurementPolicyDescriptor(d)).toThrow(
      expect.objectContaining({ code: 'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_UNKNOWN_FIELD' }),
    );
  });

  // E — descriptor hard flag false → true rejected
  test('E: descriptor hard flag flipped true rejected', () => {
    const d = cloneDescriptor();
    d.hardFlags.calibrationExecution = true;
    expect(() => validateCalibrationMeasurementPolicyDescriptor(d)).toThrow(
      CalibrationMeasurementPolicyContractError,
    );
  });

  // F — descriptor missing hard flag rejected
  test('F: descriptor missing hard flag rejected', () => {
    const d = cloneDescriptor();
    delete d.hardFlags.isSourceOfTruth;
    expect(() => validateCalibrationMeasurementPolicyDescriptor(d)).toThrow(
      CalibrationMeasurementPolicyContractError,
    );
  });

  // G — descriptor side-effect counter nonzero rejected
  test('G: descriptor side-effect counter nonzero rejected', () => {
    const d = cloneDescriptor();
    d.sideEffects.networkCallCount = 1;
    expect(() => validateCalibrationMeasurementPolicyDescriptor(d)).toThrow(
      CalibrationMeasurementPolicyContractError,
    );
  });

  // H — descriptor missing side-effect counter rejected
  test('H: descriptor missing side-effect counter rejected', () => {
    const d = cloneDescriptor();
    delete d.sideEffects.orderCount;
    expect(() => validateCalibrationMeasurementPolicyDescriptor(d)).toThrow(
      CalibrationMeasurementPolicyContractError,
    );
  });

  // I — descriptor unknown side-effect counter rejected
  test('I: descriptor unknown side-effect counter rejected', () => {
    const d = cloneDescriptor();
    d.sideEffects.extraCounter = 0;
    expect(() => validateCalibrationMeasurementPolicyDescriptor(d)).toThrow(
      CalibrationMeasurementPolicyContractError,
    );
  });

  // J — descriptor nested metric semantics mutation rejected
  test('J: descriptor nested metric semantics mutation rejected', () => {
    const d = cloneDescriptor();
    d.metricSemantics = {
      BINARY_BRIER_SCORE: {
        ...d.metricSemantics.BINARY_BRIER_SCORE,
        formulaIdentity: '(p-y)^3',
      },
    };
    expect(() => validateCalibrationMeasurementPolicyDescriptor(d)).toThrow(
      CalibrationMeasurementPolicyContractError,
    );
  });

  // K — score:0 forbidden
  test('K: score:0 forbidden', () => {
    expect(() => validateCalibrationMeasurementPolicyDescriptor({
      ...cloneDescriptor(),
      score: 0,
    })).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_FORBIDDEN_FIELD',
    }));
    expect(() => assessCalibrationMeasurementEligibility({
      ...predictiveBase(),
      score: 0,
    })).toThrow(CalibrationMeasurementPolicyContractError);
  });

  // L — weight:0 forbidden
  test('L: weight:0 forbidden', () => {
    expect(() => validateCalibrationMeasurementPolicyDescriptor({
      ...cloneDescriptor(),
      weight: 0,
    })).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_FORBIDDEN_FIELD',
    }));
    expect(() => assessCalibrationMeasurementEligibility({
      ...predictiveBase(),
      weight: 0,
    })).toThrow(CalibrationMeasurementPolicyContractError);
  });

  // M — sampleCount:0 forbidden
  test('M: sampleCount:0 forbidden', () => {
    expect(() => validateCalibrationMeasurementPolicyDescriptor({
      ...cloneDescriptor(),
      sampleCount: 0,
    })).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_FORBIDDEN_FIELD',
    }));
    expect(() => assessCalibrationMeasurementEligibility({
      ...predictiveBase(),
      sampleCount: 0,
    })).toThrow(CalibrationMeasurementPolicyContractError);
  });

  // N — shallow-frozen parent with mutable nested cannot bypass deep immutability
  test('N: shallow-frozen descriptor with mutable nested hardFlags/sideEffects is deeply frozen on return', () => {
    const nestedFlags = { ...REQUIRED_HARD_FLAGS };
    const nestedEffects = { ...ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS };
    const shallow = Object.freeze({
      ...cloneDescriptor(),
      hardFlags: nestedFlags,
      sideEffects: nestedEffects,
    });
    expect(Object.isFrozen(shallow)).toBe(true);
    expect(Object.isFrozen(shallow.hardFlags)).toBe(false);

    const validated = validateCalibrationMeasurementPolicyDescriptor(shallow);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.hardFlags)).toBe(true);
    expect(Object.isFrozen(validated.sideEffects)).toBe(true);
    expect(() => {
      validated.hardFlags.calibrationExecution = true;
    }).toThrow();
    // Caller-held nested object must also have been deep-frozen by freezeDeep recursion
    // on the canonical returned descriptor; shallow input nested remains caller-owned,
    // but validated output is the frozen canonical descriptor (not caller data).
    expect(validated).toBe(CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR);
  });

  // O — calibration observation/ref missing artifactType rejected
  test('O: calibrationObservationRef missing artifactType rejected', () => {
    expect(() => assessCalibrationMeasurementEligibility(predictiveBase({
      calibrationObservationRef: {
        calibrationObservationId: OBS_ID,
        contractVersion: CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
        schemaVersion: CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
      },
    }))).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_ARTIFACT_TYPE_MISSING',
    }));
  });

  // P — missing contractVersion rejected
  test('P: calibrationObservationRef missing contractVersion rejected', () => {
    expect(() => assessCalibrationMeasurementEligibility(predictiveBase({
      calibrationObservationRef: {
        calibrationObservationId: OBS_ID,
        artifactType: CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
        schemaVersion: CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
      },
    }))).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_CONTRACT_VERSION_MISSING',
    }));
  });

  // Q — missing schemaVersion rejected
  test('Q: calibrationObservationRef missing schemaVersion rejected', () => {
    expect(() => assessCalibrationMeasurementEligibility(predictiveBase({
      calibrationObservationRef: {
        calibrationObservationId: OBS_ID,
        artifactType: CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
        contractVersion: CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
      },
    }))).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_SCHEMA_VERSION_MISSING',
    }));
  });

  // R — wrong identity rejected
  test('R: wrong observation identity rejected', () => {
    expect(() => assessCalibrationMeasurementEligibility(predictiveBase({
      calibrationObservationRef: thinObsRef({
        artifactType: 'WRONG_ARTIFACT',
      }),
    }))).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_ARTIFACT_TYPE_MISMATCH',
    }));
    expect(() => assessCalibrationMeasurementEligibility(predictiveBase({
      calibrationObservationRef: thinObsRef({
        contractVersion: 'wrong-version',
      }),
    }))).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_CONTRACT_VERSION_MISMATCH',
    }));
  });

  // S — nested confidence availability=unavailable cannot become structurally predictive
  test('S: nested confidence availability=unavailable ⇒ structurallyPredictive=false', () => {
    const result = assessCalibrationMeasurementEligibility({
      confidence: {
        availability: AVAILABILITY.UNAVAILABLE,
        kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        value: 0.8,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
        provenance: { writer: 'x', methodKey: 'evil.method' },
      },
    });
    expect(result.structurallyPredictive).toBe(false);
    expect(result.measurementEligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(['NESTED_CONFIDENCE_UNAVAILABLE']));
  });

  // T — top-level MODEL_PROBABILITY conflicting with nested HEURISTIC rejected
  test('T: top-level MODEL_PROBABILITY vs nested HEURISTIC ⇒ SOURCE_CONFLICT', () => {
    expect(() => assessCalibrationMeasurementEligibility({
      kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
      value: 0.7,
      scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      confidence: {
        kind: CONFIDENCE_KIND.HEURISTIC,
        value: 0.7,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
        availability: AVAILABILITY.AVAILABLE,
      },
      provenance: { writer: 'x', methodKey: 'm' },
    })).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_SOURCE_CONFLICT',
    }));
  });

  // U — top-level scale conflicting with nested scale rejected
  test('U: top-level scale vs nested scale ⇒ SOURCE_CONFLICT', () => {
    expect(() => assessCalibrationMeasurementEligibility({
      kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
      value: 0.5,
      scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      confidence: {
        kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        value: 0.5,
        scale: CONFIDENCE_SCALE.PERCENT_100,
        availability: AVAILABILITY.AVAILABLE,
      },
      provenance: { writer: 'x', methodKey: 'm' },
    })).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_SOURCE_CONFLICT',
    }));
  });

  // V — top-level value conflicting with nested value rejected
  test('V: top-level value vs nested value ⇒ SOURCE_CONFLICT', () => {
    expect(() => assessCalibrationMeasurementEligibility({
      kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
      value: 0.5,
      scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      confidence: {
        kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        value: 0.9,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
        availability: AVAILABILITY.AVAILABLE,
      },
      provenance: { writer: 'x', methodKey: 'm' },
    })).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_SOURCE_CONFLICT',
    }));
  });

  // W — top-level methodKey conflicting with provenance.methodKey rejected
  test('W: top-level methodKey vs provenance.methodKey ⇒ SOURCE_CONFLICT', () => {
    expect(() => assessCalibrationMeasurementEligibility({
      kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
      value: 0.5,
      scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      methodKey: 'caller.method',
      provenance: { writer: 'x', methodKey: 'provenance.method' },
    })).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_SOURCE_CONFLICT',
    }));
  });

  // X — top-level methodKey cannot replace missing provenance.methodKey
  test('X: top-level methodKey cannot replace missing provenance.methodKey', () => {
    const result = assessCalibrationMeasurementEligibility({
      kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
      value: 0.5,
      scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      methodKey: 'registered.method',
      provenance: { writer: 'x' },
    });
    expect(result.measurementEligible).toBe(false);
    expect(result.methodKey).toBeNull();
    expect(result.callerMethodKey).toBe('registered.method');
    expect(result.reasons).toEqual(expect.arrayContaining([
      'PROVENANCE_METHOD_KEY_MISSING',
      'METHOD_NOT_AUTHORIZED',
    ]));
  });

  // Y — caller target semantics cannot self-register
  test('Y: caller targetEvent/targetSemantics cannot self-register a method', () => {
    const result = assessCalibrationMeasurementEligibility({
      kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
      value: 0.5,
      scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      provenance: { writer: 'x', methodKey: 'evil.method' },
      targetEvent: CALIBRATION_TARGET_EVENT_V1,
    });
    expect(result.measurementEligible).toBe(false);
    expect(result.methodAuthorized).toBe(false);
    expect(CALLER_SELF_REGISTRATION).toBe('FORBIDDEN');

    expect(() => assessCalibrationMeasurementEligibility({
      kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
      value: 0.5,
      scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      provenance: { writer: 'x', methodKey: 'evil.method' },
      targetEvent: 'ATTACKER_INVENTED_TARGET',
    })).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_TARGET_EVENT_REJECTED',
    }));
  });

  // Z — no execution-shaped Brier/score/aggregate exports exist
  test('Z: execution-shaped Brier/score/aggregate exports are ABSENT', () => {
    const forbidden = [
      'computeBrierScore',
      'calculateBrier',
      'scoreObservation',
      'aggregateBrier',
      'meanBrier',
    ];
    for (const name of forbidden) {
      expect(policyDefault[name]).toBeUndefined();
    }
    expect(BINARY_BRIER_EXECUTION).toBe(false);
    // No function must return numeric (p-y)^2
    expect(typeof policyDefault.computeBrierScore).toBe('undefined');
    expect(typeof policyDefault.calculateBrier).toBe('undefined');
  });
});

describe('thin calibrationObservationRef only (no full-artifact fake)', () => {
  test('valid thin ref accepted; id-only rejected; full-artifact key rejected', () => {
    const ok = assessCalibrationMeasurementEligibility(predictiveBase({
      calibrationObservationRef: thinObsRef(),
    }));
    expect(ok.calibrationObservationRef.calibrationObservationId).toBe(OBS_ID);
    expect(ok.measurementEligible).toBe(false);

    expect(() => assessCalibrationMeasurementEligibility(predictiveBase({
      calibrationObservationRef: { calibrationObservationId: OBS_ID },
    }))).toThrow(CalibrationMeasurementPolicyContractError);

    expect(() => assessCalibrationMeasurementEligibility(predictiveBase({
      calibrationObservation: thinObsRef(),
    }))).toThrow(expect.objectContaining({
      code: 'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_UNKNOWN_FIELD',
    }));
  });
});

describe('descriptor completeness — hardFlags / sideEffects', () => {
  test('every required hard flag present and false on canonical descriptor', () => {
    const d = getCalibrationMeasurementPolicyDescriptor();
    for (const [k, v] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(d.hardFlags[k]).toBe(false);
      expect(v).toBe(false);
    }
  });

  test('every side-effect counter present and numeric zero; no ambiguous orders alias', () => {
    const d = getCalibrationMeasurementPolicyDescriptor();
    for (const [k, v] of Object.entries(ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS)) {
      expect(d.sideEffects[k]).toBe(0);
      expect(v).toBe(0);
    }
    expect(Object.prototype.hasOwnProperty.call(d.sideEffects, 'orderCount')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(d.sideEffects, 'orders')).toBe(false);
  });

  test('unknown hard flag rejected', () => {
    const d = cloneDescriptor();
    d.hardFlags.attackerFlag = false;
    expect(() => validateCalibrationMeasurementPolicyDescriptor(d)).toThrow(
      CalibrationMeasurementPolicyContractError,
    );
  });
});
