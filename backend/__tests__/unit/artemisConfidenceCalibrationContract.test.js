/**
 * @jest-environment node
 *
 * Artemis Core Stage 10 — S10-CONFIDENCE-CALIBRATION-CONTRACT
 * Confidence Calibration Contract Boundary unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVAILABILITY,
  CALIBRATION_STATE,
  CONFIDENCE_KIND,
  CONFIDENCE_SCALE,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  DECISION_CONTRACT_VERSION,
  DIRECTION_OR_ABSTAIN,
  buildContractOnlyArtemisDecision,
  validateArtemisDecision,
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
  OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
  buildObservedOutcomeEvaluation,
} from '../../contracts/artemisObservedOutcomeEvaluationContract.js';
import {
  CALIBRATION_METRIC_CANONICAL_STATUS,
  CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
  CONFIDENCE_CALIBRATION_AUTHORITY_CLASS,
  CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
  CONFIDENCE_CALIBRATION_IMPLEMENTATION_VERSION,
  CONFIDENCE_CALIBRATION_IS_SOURCE_OF_TRUTH,
  CONFIDENCE_CALIBRATION_METHOD_KEY,
  CONFIDENCE_CALIBRATION_OWNERSHIP_ROLE,
  CONFIDENCE_CALIBRATION_SLICE_ID,
  DECISION_LEVEL_CALIBRATION,
  EVIDENCE_LEVEL_CALIBRATION,
  METRIC_INVENTION,
  PREDICTIVE_CLAIM_SOURCE_POLICY,
  PREDICTIVE_CONFIDENCE_KINDS,
  REQUIRED_HARD_FLAGS,
  ZERO_CONFIDENCE_CALIBRATION_SIDE_EFFECTS,
  buildArtemisConfidenceCalibrationObservation,
  computeCalibrationObservationId,
  validateArtemisConfidenceCalibrationObservation,
} from '../../contracts/artemisConfidenceCalibrationContract.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECORDING_ID = '66666666-6666-4666-8666-666666666666';
const TASK_ID = '77777777-7777-4777-8777-777777777777';
const BINDING_ID = '88888888-8888-4888-8888-888888888888';
const CYCLE_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_DECISION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_UUID = '22222222-2222-4222-8222-222222222222';

const ANALYSIS_AT = '2026-09-22T10:00:00.000Z';
const CREATED_AT = '2026-09-22T10:00:01.000Z';
const SOURCE_TS = '2026-09-22T10:59:00.000Z';
const OUTCOME_OBSERVED_AT = '2026-09-22T11:00:00.000Z';
const OUTCOME_RECORDED_AT = '2026-09-22T11:00:01.000Z';
const EVAL_RECORDED_AT = '2026-09-22T11:00:02.000Z';
const CAL_RECORDED_AT = '2026-09-22T11:00:03.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisConfidenceCalibrationContract.js',
);

const PROTECTED_CONTRACT_PATHS = [
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
];

function expectFail(fn, code) {
  try {
    fn();
    expect(true).toBe(false);
  } catch (err) {
    expect(err.code).toBe(code);
  }
}

function confidenceProvenance(overrides = {}) {
  return {
    writer: 'test-decision-writer',
    methodKey: 'test.decision.confidence.v1',
    ...overrides,
  };
}

function predictiveConfidence(overrides = {}) {
  return {
    availability: 'available',
    kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
    value: 0.72,
    scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
    calibrationState: CALIBRATION_STATE.UNCALIBRATED,
    provenance: confidenceProvenance(),
    ...overrides,
  };
}

function validDecision(overrides = {}) {
  const {
    confidence: confidenceOverride,
    ...rest
  } = overrides;
  return buildContractOnlyArtemisDecision({
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    createdAt: CREATED_AT,
    analysisAt: ANALYSIS_AT,
    direction: DIRECTION_OR_ABSTAIN.BULLISH,
    symbol: 'BTC/USDT',
    venue: 'mexc',
    marketType: MARKET_TYPE.SPOT,
    timeframe: '1h',
    analysisHorizon: 'intraday',
    ...rest,
    confidence: confidenceOverride === undefined
      ? predictiveConfidence()
      : confidenceOverride,
  });
}

function decisionRef(overrides = {}) {
  return {
    decisionId: DECISION_ID,
    contractVersion: DECISION_CONTRACT_VERSION,
    decisionContextId: CONTEXT_ID,
    analysisAt: ANALYSIS_AT,
    ...overrides,
  };
}

function decisionContextRef(overrides = {}) {
  return {
    contextId: CONTEXT_ID,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    ...overrides,
  };
}

function shadowRecordingRef(overrides = {}) {
  return {
    shadowRecordingArtifactId: RECORDING_ID,
    contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    ...overrides,
  };
}

function marketContextRef(overrides = {}) {
  return {
    marketContextId: MC_ID,
    contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    venue: 'mexc',
    marketType: MARKET_TYPE.SPOT,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    freshnessStatus: FRESHNESS_STATUS.FRESH,
    sourceTimestamp: SOURCE_TS,
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
      bindingId: BINDING_ID,
      contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    },
    shadowCycleEnvelopeRef: {
      shadowCycleEnvelopeId: CYCLE_ID,
      contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    },
    outcomeObservedAt: OUTCOME_OBSERVED_AT,
    recordedAt: OUTCOME_RECORDED_AT,
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
    recordedAt: EVAL_RECORDED_AT,
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

function cloneArtifact(artifact) {
  return JSON.parse(JSON.stringify(artifact));
}

function validCalibrationInput(overrides = {}) {
  const decision = overrides.decision === undefined
    ? validDecision()
    : overrides.decision;
  const evaluationArtifact = overrides.evaluationArtifact === undefined
    ? buildValidEvaluation()
    : overrides.evaluationArtifact;
  const {
    decision: _d,
    evaluationArtifact: _e,
    ...rest
  } = overrides;
  return {
    decision,
    evaluationArtifact,
    recordedAt: CAL_RECORDED_AT,
    ...rest,
    decision,
    evaluationArtifact,
  };
}

function buildValidObservation(overrides = {}) {
  return buildArtemisConfidenceCalibrationObservation(validCalibrationInput(overrides));
}

describe('S10-CONFIDENCE-CALIBRATION-CONTRACT — Confidence Calibration Boundary', () => {
  describe('valid Decision-level observations', () => {
    it('1. valid Decision-level MODEL_PROBABILITY observation', () => {
      const artifact = buildValidObservation();
      expect(artifact.artifactType).toBe(CONFIDENCE_CALIBRATION_ARTIFACT_TYPE);
      expect(artifact.authorityClass).toBe(CONFIDENCE_CALIBRATION_AUTHORITY_CLASS);
      expect(artifact.predictiveClaimRef.confidence.kind).toBe(
        CONFIDENCE_KIND.MODEL_PROBABILITY,
      );
      expect(artifact.observedTruthRef.evaluationStatus).toBe(EVALUATION_STATUS.MATCH);
    });

    it('2. valid Decision-level CALIBRATED confidence observation', () => {
      const decision = validDecision({
        confidence: predictiveConfidence({
          kind: CONFIDENCE_KIND.CALIBRATED,
          calibrationState: CALIBRATION_STATE.CALIBRATED,
          value: 0.81,
        }),
      });
      const artifact = buildValidObservation({ decision });
      expect(artifact.predictiveClaimRef.confidence.kind).toBe(CONFIDENCE_KIND.CALIBRATED);
      expect(artifact.predictiveClaimRef.confidence.calibrationState).toBe(
        CALIBRATION_STATE.CALIBRATED,
      );
    });

    it('3. authorityClass = CALIBRATION', () => {
      expect(buildValidObservation().authorityClass).toBe('CALIBRATION');
      expect(CONFIDENCE_CALIBRATION_AUTHORITY_CLASS).toBe('CALIBRATION');
    });

    it('4. isSourceOfTruth = false', () => {
      expect(buildValidObservation().isSourceOfTruth).toBe(false);
      expect(CONFIDENCE_CALIBRATION_IS_SOURCE_OF_TRUTH).toBe(false);
    });

    it('5. ownershipRole = VALIDATION_BOUNDARY', () => {
      expect(buildValidObservation().ownershipRole).toBe(
        CONFIDENCE_CALIBRATION_OWNERSHIP_ROLE,
      );
      expect(CONFIDENCE_CALIBRATION_OWNERSHIP_ROLE).toBe('VALIDATION_BOUNDARY');
    });

    it('6. sliceId and contractVersion set', () => {
      const a = buildValidObservation();
      expect(a.sliceId).toBe(CONFIDENCE_CALIBRATION_SLICE_ID);
      expect(a.contractVersion).toBe(CONFIDENCE_CALIBRATION_CONTRACT_VERSION);
    });

    it('7. sourceDecision alias accepted', () => {
      const decision = validDecision();
      const evaluationArtifact = buildValidEvaluation();
      const artifact = buildArtemisConfidenceCalibrationObservation({
        sourceDecision: decision,
        evaluationArtifact,
        recordedAt: CAL_RECORDED_AT,
      });
      expect(artifact.predictiveClaimRef.decisionId).toBe(DECISION_ID);
    });

    it('8. validate === build', () => {
      const input = validCalibrationInput();
      const a = buildArtemisConfidenceCalibrationObservation(input);
      const b = validateArtemisConfidenceCalibrationObservation(input);
      expect(a).toEqual(b);
    });
  });

  describe('deterministic observation identity', () => {
    it('9. deterministic observation identity', () => {
      const a = buildValidObservation();
      const b = buildValidObservation();
      expect(a.calibrationObservationId).toBe(b.calibrationObservationId);
      expect(a.calibrationObservationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('10. identical semantic input => identical ID', () => {
      const id1 = computeCalibrationObservationId({
        decisionId: DECISION_ID,
        evaluationId: buildValidEvaluation().evaluationId,
        direction: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        confidenceValue: 0.72,
        confidenceScale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      });
      const id2 = computeCalibrationObservationId({
        decisionId: DECISION_ID,
        evaluationId: buildValidEvaluation().evaluationId,
        direction: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        confidenceValue: 0.72,
        confidenceScale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      });
      expect(id1).toBe(id2);
    });

    it('11. decisionId change => ID changes', () => {
      const evalA = buildValidEvaluation();
      const base = {
        evaluationId: evalA.evaluationId,
        direction: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        confidenceValue: 0.72,
        confidenceScale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      };
      const id1 = computeCalibrationObservationId({ ...base, decisionId: DECISION_ID });
      const id2 = computeCalibrationObservationId({
        ...base,
        decisionId: OTHER_DECISION_ID,
      });
      expect(id1).not.toBe(id2);
    });

    it('12. evaluationId change => ID changes', () => {
      const base = {
        decisionId: DECISION_ID,
        direction: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        confidenceValue: 0.72,
        confidenceScale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      };
      const id1 = computeCalibrationObservationId({
        ...base,
        evaluationId: buildValidEvaluation().evaluationId,
      });
      const id2 = computeCalibrationObservationId({
        ...base,
        evaluationId: OTHER_UUID,
      });
      expect(id1).not.toBe(id2);
    });

    it('13. confidence semantic change => ID changes', () => {
      const evalId = buildValidEvaluation().evaluationId;
      const base = {
        decisionId: DECISION_ID,
        evaluationId: evalId,
        direction: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        confidenceScale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      };
      const id1 = computeCalibrationObservationId({ ...base, confidenceValue: 0.72 });
      const id2 = computeCalibrationObservationId({ ...base, confidenceValue: 0.91 });
      expect(id1).not.toBe(id2);
    });

    it('14. matching supplied ID accepted', () => {
      const input = validCalibrationInput();
      const preview = buildArtemisConfidenceCalibrationObservation(input);
      const artifact = buildArtemisConfidenceCalibrationObservation({
        ...input,
        calibrationObservationId: preview.calibrationObservationId,
      });
      expect(artifact.calibrationObservationId).toBe(preview.calibrationObservationId);
    });

    it('15. conflicting supplied ID rejected', () => {
      expectFail(
        () => buildValidObservation({ calibrationObservationId: OTHER_UUID }),
        'CALIBRATION_OBSERVATION_ID_CONFLICT',
      );
    });

    it('16. recordedAt does not participate in identity', () => {
      const a = buildValidObservation({ recordedAt: CAL_RECORDED_AT });
      const b = buildValidObservation({ recordedAt: '2026-09-22T12:00:00.000Z' });
      expect(a.calibrationObservationId).toBe(b.calibrationObservationId);
      expect(a.recordedAt).not.toBe(b.recordedAt);
    });

    it('17. wall-clock independence — repeated calls identical', () => {
      const input = validCalibrationInput();
      const a = buildArtemisConfidenceCalibrationObservation(input);
      const start = Date.now();
      while (Date.now() === start) {
        /* spin one ms tick */
      }
      const b = buildArtemisConfidenceCalibrationObservation(input);
      expect(a).toEqual(b);
    });
  });

  describe('predictive kind honesty', () => {
    it('18. MODEL_PROBABILITY accepted as predictive', () => {
      expect(PREDICTIVE_CONFIDENCE_KINDS.MODEL_PROBABILITY).toBe(
        CONFIDENCE_KIND.MODEL_PROBABILITY,
      );
      expect(
        buildValidObservation().predictiveClaimRef.confidence.kind,
      ).toBe(CONFIDENCE_KIND.MODEL_PROBABILITY);
    });

    it('19. CALIBRATED accepted as predictive', () => {
      const decision = validDecision({
        confidence: predictiveConfidence({ kind: CONFIDENCE_KIND.CALIBRATED }),
      });
      expect(
        buildValidObservation({ decision }).predictiveClaimRef.confidence.kind,
      ).toBe(CONFIDENCE_KIND.CALIBRATED);
    });

    it.each([
      ['MEASURED', CONFIDENCE_KIND.MEASURED],
      ['HEURISTIC', CONFIDENCE_KIND.HEURISTIC],
      ['RULE_SCORE', CONFIDENCE_KIND.RULE_SCORE],
      ['DERIVED', CONFIDENCE_KIND.DERIVED],
      ['LEGACY', CONFIDENCE_KIND.LEGACY],
    ])('20-%s. %s not treated as predictive', (_label, kind) => {
      const decision = validDecision({
        confidence: predictiveConfidence({ kind }),
      });
      expect(validateArtemisDecision(decision).ok).toBe(true);
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_CONFIDENCE_KIND_NOT_PREDICTIVE',
      );
    });

    it('21. UNAVAILABLE confidence not predictive', () => {
      const decision = validDecision({
        confidence: {
          availability: 'unavailable',
          kind: CONFIDENCE_KIND.UNAVAILABLE,
          scale: CONFIDENCE_SCALE.UNKNOWN,
        },
      });
      expect(validateArtemisDecision(decision).ok).toBe(true);
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_CONFIDENCE_UNAVAILABLE',
      );
    });

    it('22. unknown confidence kind rejected at Decision validation', () => {
      const decision = validDecision({
        confidence: predictiveConfidence({ kind: 'made_up_kind' }),
      });
      expect(validateArtemisDecision(decision).ok).toBe(false);
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_DECISION_VALIDATION_FAILED',
      );
    });
  });

  describe('confidence scale honesty', () => {
    it('23. unit_interval accepted and preserved', () => {
      const a = buildValidObservation({
        decision: validDecision({
          confidence: predictiveConfidence({
            value: 0.55,
            scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          }),
        }),
      });
      expect(a.predictiveClaimRef.confidence.scale).toBe(CONFIDENCE_SCALE.UNIT_INTERVAL);
      expect(a.predictiveClaimRef.confidence.value).toBe(0.55);
    });

    it('24. percent_100 accepted and preserved (no conversion)', () => {
      const a = buildValidObservation({
        decision: validDecision({
          confidence: predictiveConfidence({
            value: 72,
            scale: CONFIDENCE_SCALE.PERCENT_100,
          }),
        }),
      });
      expect(a.predictiveClaimRef.confidence.scale).toBe(CONFIDENCE_SCALE.PERCENT_100);
      expect(a.predictiveClaimRef.confidence.value).toBe(72);
    });

    it('25. unknown scale not calibratable (Decision rejects available+UNKNOWN)', () => {
      const decision = validDecision({
        confidence: predictiveConfidence({ scale: CONFIDENCE_SCALE.UNKNOWN }),
      });
      expect(validateArtemisDecision(decision).ok).toBe(false);
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_DECISION_VALIDATION_FAILED',
      );
    });

    it('26. invalid unit_interval range rejected via canonical Decision semantics', () => {
      const decision = validDecision({
        confidence: predictiveConfidence({ value: 1.5 }),
      });
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_DECISION_VALIDATION_FAILED',
      );
    });

    it('27. invalid percent_100 range rejected via canonical Decision semantics', () => {
      const decision = validDecision({
        confidence: predictiveConfidence({
          value: 150,
          scale: CONFIDENCE_SCALE.PERCENT_100,
        }),
      });
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_DECISION_VALIDATION_FAILED',
      );
    });

    it('28. no percent→unit conversion — 72 percent stays 72', () => {
      const a = buildValidObservation({
        decision: validDecision({
          confidence: predictiveConfidence({
            value: 72,
            scale: CONFIDENCE_SCALE.PERCENT_100,
          }),
        }),
      });
      expect(a.predictiveClaimRef.confidence.value).not.toBe(0.72);
      expect(a.predictiveClaimRef.confidence.value).toBe(72);
    });

    it('29. no unit→percent conversion — 0.72 stays 0.72', () => {
      const a = buildValidObservation({
        decision: validDecision({
          confidence: predictiveConfidence({ value: 0.72 }),
        }),
      });
      expect(a.predictiveClaimRef.confidence.value).toBe(0.72);
      expect(a.predictiveClaimRef.confidence.scale).toBe(CONFIDENCE_SCALE.UNIT_INTERVAL);
    });

    it('30. confidence provenance preserved thinly', () => {
      const a = buildValidObservation({
        decision: validDecision({
          confidence: predictiveConfidence({
            provenance: confidenceProvenance({
              writer: 'agent-x',
              methodKey: 'agent.x.confidence',
              path: 'confidence',
            }),
          }),
        }),
      });
      expect(a.predictiveClaimRef.confidence.provenance).toEqual({
        writer: 'agent-x',
        methodKey: 'agent.x.confidence',
        path: 'confidence',
      });
    });
  });

  describe('calibrable directions', () => {
    it.each([
      ['bullish', DIRECTION_OR_ABSTAIN.BULLISH],
      ['bearish', DIRECTION_OR_ABSTAIN.BEARISH],
      ['sideways', DIRECTION_OR_ABSTAIN.SIDEWAYS],
      ['neutral', DIRECTION_OR_ABSTAIN.NEUTRAL],
    ])('31-%s. %s predictive direction accepted', (_label, direction) => {
      const decision = validDecision({ direction });
      const evaluationArtifact = buildValidEvaluation({
        comparisonClaims: {
          decisionDirection: direction,
          observedDirection: direction,
        },
      });
      const a = buildValidObservation({ decision, evaluationArtifact });
      expect(a.predictiveClaimRef.direction).toBe(direction);
      expect(a.observedTruthRef.decisionDirection).toBe(direction);
    });

    it('32. abstain not calibratable', () => {
      const decision = validDecision({ direction: DIRECTION_OR_ABSTAIN.ABSTAIN });
      expect(validateArtemisDecision(decision).ok).toBe(true);
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_DIRECTION_NOT_CALIBRABLE',
      );
    });

    it('33. unavailable direction not calibratable', () => {
      const decision = validDecision({
        direction: DIRECTION_OR_ABSTAIN.UNAVAILABLE,
      });
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_DIRECTION_NOT_CALIBRABLE',
      );
    });

    it('34. not_applicable direction not calibratable', () => {
      const decision = validDecision({
        direction: DIRECTION_OR_ABSTAIN.NOT_APPLICABLE,
      });
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_DIRECTION_NOT_CALIBRABLE',
      );
    });
  });

  describe('evaluation / observed truth binding', () => {
    it('35. evaluationId required (missing evaluationArtifact rejected)', () => {
      expectFail(
        () => buildArtemisConfidenceCalibrationObservation({
          decision: validDecision(),
          recordedAt: CAL_RECORDED_AT,
        }),
        'CALIBRATION_EVALUATION_REQUIRED',
      );
    });

    it('36. malformed evaluationId rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.evaluationId = 'not-a-uuid';
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_ID_INVALID',
      );
    });

    it('37. evaluation contractVersion enforced', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.contractVersion = 'wrong-version';
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_CONTRACT_VERSION_MISMATCH',
      );
    });

    it('38. evaluation authorityClass enforced', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.authorityClass = 'CALIBRATION';
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_AUTHORITY_CLASS_MISMATCH',
      );
    });

    it('39. evaluation artifactType enforced', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.artifactType = 'WRONG';
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_ARTIFACT_TYPE_MISMATCH',
      );
    });

    it('40. evaluation decisionId must match source Decision', () => {
      const outcome = buildValidOutcome({
        decisionRef: decisionRef({ decisionId: OTHER_DECISION_ID }),
      });
      const evaluationArtifact = buildValidEvaluation({ outcomeArtifact: outcome });
      expectFail(
        () => buildValidObservation({ evaluationArtifact }),
        'CALIBRATION_DECISION_ID_MISMATCH',
      );
    });

    it('41. OBSERVED_AND_EVALUABLE accepted', () => {
      expect(buildValidObservation().observedTruthRef.observationClass).toBe(
        OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE,
      );
    });

    it('42. NOT_OBSERVED not usable', () => {
      const evaluationArtifact = buildValidEvaluation({
        observationClass: OBSERVATION_CLASS.NOT_OBSERVED,
        comparisonClaims: undefined,
      });
      expectFail(
        () => buildValidObservation({ evaluationArtifact }),
        'CALIBRATION_OBSERVATION_CLASS_NOT_EVALUABLE',
      );
    });

    it('43. OBSERVED_BUT_UNAVAILABLE not usable', () => {
      const evaluationArtifact = buildValidEvaluation({
        observationClass: OBSERVATION_CLASS.OBSERVED_BUT_UNAVAILABLE,
        comparisonClaims: undefined,
      });
      expectFail(
        () => buildValidObservation({ evaluationArtifact }),
        'CALIBRATION_OBSERVATION_CLASS_NOT_EVALUABLE',
      );
    });

    it('44. BLOCKED not usable', () => {
      const evaluationArtifact = buildValidEvaluation({
        blockedReason: 'test_blocked',
        comparisonClaims: undefined,
      });
      expect(evaluationArtifact.evaluationStatus).toBe(EVALUATION_STATUS.BLOCKED);
      expectFail(
        () => buildValidObservation({ evaluationArtifact }),
        'CALIBRATION_EVALUATION_STATUS_NOT_USABLE',
      );
    });

    it('45. INSUFFICIENT_DATA not usable', () => {
      const evaluationArtifact = buildValidEvaluation({
        comparisonClaims: {
          decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        },
      });
      expect(evaluationArtifact.evaluationStatus).toBe(
        EVALUATION_STATUS.INSUFFICIENT_DATA,
      );
      expectFail(
        () => buildValidObservation({ evaluationArtifact }),
        'CALIBRATION_EVALUATION_STATUS_NOT_USABLE',
      );
    });

    it('46. UNAVAILABLE evaluation status not usable', () => {
      const evaluationArtifact = buildValidEvaluation({
        observationClass: OBSERVATION_CLASS.OBSERVED_BUT_UNAVAILABLE,
      });
      expect(evaluationArtifact.evaluationStatus).toBe(EVALUATION_STATUS.UNAVAILABLE);
      expectFail(
        () => buildValidObservation({ evaluationArtifact }),
        'CALIBRATION_OBSERVATION_CLASS_NOT_EVALUABLE',
      );
    });
  });

  describe('empty MATCH protection and status consistency', () => {
    it('47. explicit comparisonClaims.decisionDirection required', () => {
      const evaluationArtifact = buildValidEvaluation({
        comparisonClaims: {
          observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        },
      });
      // Single-direction claims → Evaluation INSUFFICIENT_DATA; either
      // STATUS_NOT_USABLE or COMPARISON_DECISION_DIRECTION_REQUIRED is fail-closed.
      try {
        buildValidObservation({ evaluationArtifact });
        expect(true).toBe(false);
      } catch (err) {
        expect([
          'CALIBRATION_COMPARISON_DECISION_DIRECTION_REQUIRED',
          'CALIBRATION_EVALUATION_STATUS_NOT_USABLE',
        ]).toContain(err.code);
      }
    });

    it('48. explicit comparisonClaims.observedDirection required', () => {
      const evaluationArtifact = buildValidEvaluation({
        comparisonClaims: {
          decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        },
      });
      // Evaluation may classify as INSUFFICIENT_DATA; either path fail-closed
      try {
        buildValidObservation({ evaluationArtifact });
        expect(true).toBe(false);
      } catch (err) {
        expect([
          'CALIBRATION_COMPARISON_OBSERVED_DIRECTION_REQUIRED',
          'CALIBRATION_EVALUATION_STATUS_NOT_USABLE',
        ]).toContain(err.code);
      }
    });

    it('49. empty comparisonClaims MATCH must NOT become calibratable', () => {
      const evaluationArtifact = buildValidEvaluation({
        comparisonClaims: {},
      });
      expect(evaluationArtifact.evaluationStatus).toBe(EVALUATION_STATUS.MATCH);
      expectFail(
        () => buildValidObservation({ evaluationArtifact }),
        'CALIBRATION_COMPARISON_DECISION_DIRECTION_REQUIRED',
      );
    });

    it('50. missing comparisonClaims MATCH must NOT become calibratable', () => {
      const evaluationArtifact = buildValidEvaluation({
        comparisonClaims: undefined,
      });
      // Builder may omit claims; Evaluation empty → MATCH hazard
      if (evaluationArtifact.evaluationStatus === EVALUATION_STATUS.MATCH) {
        expectFail(
          () => buildValidObservation({ evaluationArtifact }),
          evaluationArtifact.comparisonClaims == null
            ? 'CALIBRATION_COMPARISON_CLAIMS_REQUIRED'
            : 'CALIBRATION_COMPARISON_DECISION_DIRECTION_REQUIRED',
        );
      } else {
        expectFail(
          () => buildValidObservation({ evaluationArtifact }),
          'CALIBRATION_EVALUATION_STATUS_NOT_USABLE',
        );
      }
    });

    it('51. MATCH with consistent equal directions accepted', () => {
      const a = buildValidObservation();
      expect(a.observedTruthRef.evaluationStatus).toBe(EVALUATION_STATUS.MATCH);
      expect(a.observedTruthRef.decisionDirection).toBe(
        a.observedTruthRef.observedDirection,
      );
    });

    it('52. MISMATCH with consistent differing directions accepted', () => {
      const evaluationArtifact = buildValidEvaluation({
        comparisonClaims: {
          decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
          observedDirection: DIRECTION_OR_ABSTAIN.BEARISH,
        },
      });
      expect(evaluationArtifact.evaluationStatus).toBe(EVALUATION_STATUS.MISMATCH);
      const a = buildValidObservation({ evaluationArtifact });
      expect(a.observedTruthRef.evaluationStatus).toBe(EVALUATION_STATUS.MISMATCH);
      expect(a.observedTruthRef.observedDirection).toBe(DIRECTION_OR_ABSTAIN.BEARISH);
    });

    it('53. MATCH with differing directions rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation({
        comparisonClaims: {
          decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
          observedDirection: DIRECTION_OR_ABSTAIN.BEARISH,
        },
      }));
      evalArt.evaluationStatus = EVALUATION_STATUS.MATCH;
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_STATUS_INCONSISTENT',
      );
    });

    it('54. MISMATCH with equal directions rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.evaluationStatus = EVALUATION_STATUS.MISMATCH;
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_STATUS_INCONSISTENT',
      );
    });

    it('55. source Decision direction mismatch vs comparison decisionDirection rejected', () => {
      const decision = validDecision({ direction: DIRECTION_OR_ABSTAIN.BEARISH });
      const evaluationArtifact = buildValidEvaluation({
        comparisonClaims: {
          decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
          observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        },
      });
      expectFail(
        () => buildValidObservation({ decision, evaluationArtifact }),
        'CALIBRATION_SOURCE_DIRECTION_MISMATCH',
      );
    });
  });

  describe('temporal integrity and anti-lookahead', () => {
    it('56. prediction timestamp precedes evaluation', () => {
      const a = buildValidObservation();
      expect(Date.parse(a.predictiveClaimRef.analysisAt)).toBeLessThan(
        Date.parse(a.observedTruthRef.recordedAt),
      );
    });

    it('57. evaluation before Decision analysisAt rejected', () => {
      const decision = validDecision({
        analysisAt: '2026-09-22T12:00:00.000Z',
        createdAt: '2026-09-22T12:00:01.000Z',
      });
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_TEMPORAL_VIOLATION',
      );
    });

    it('58. malformed recordedAt rejected', () => {
      expectFail(
        () => buildValidObservation({ recordedAt: 'not-iso' }),
        'CALIBRATION_RECORDED_AT_INVALID',
      );
    });

    it('59. sourceTimestamp before analysisAt rejected', () => {
      // Evaluation builder rejects sourceTimestamp < decisionMs
      // (post_horizon_violation). Clone a valid built artifact and mutate the
      // thin marketContextRef to prove Calibration temporal fail-closed.
      const evaluationArtifact = cloneArtifact(buildValidEvaluation());
      evaluationArtifact.marketContextRef = {
        ...evaluationArtifact.marketContextRef,
        sourceTimestamp: '2026-09-22T09:00:00.000Z',
      };
      expectFail(
        () => buildValidObservation({ evaluationArtifact }),
        'CALIBRATION_TEMPORAL_SOURCE_TIMESTAMP_VIOLATION',
      );
    });

    it.each([
      ['lookahead'],
      ['futureData'],
      ['futureEvidence'],
      ['outcomeAsDecisionInput'],
      ['evaluationAsDecisionInput'],
      ['postDecisionEvidenceAsInput'],
    ])('60-%s. %s contamination rejected', (field) => {
      expectFail(
        () => buildValidObservation({ [field]: true }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
    });
  });

  describe('thin refs and segment metadata', () => {
    it('61. full Decision not embedded in result', () => {
      const a = buildValidObservation();
      expect(a.decision).toBeUndefined();
      expect(a.sourceDecision).toBeUndefined();
      expect(a.predictiveClaimRef.confidence).toBeDefined();
      expect(Object.keys(a.predictiveClaimRef).sort()).toEqual(
        expect.arrayContaining([
          'decisionId',
          'contractVersion',
          'direction',
          'analysisAt',
          'confidence',
        ]),
      );
    });

    it('62. full Evaluation artifact not embedded', () => {
      const a = buildValidObservation();
      expect(a.evaluationArtifact).toBeUndefined();
      expect(a.outcomeArtifact).toBeUndefined();
      expect(a.observedTruthRef.evaluationId).toBeDefined();
    });

    it('63. thin Decision ref preserves segment fields', () => {
      const a = buildValidObservation();
      expect(a.predictiveClaimRef.symbol).toBe('BTC/USDT');
      expect(a.predictiveClaimRef.venue).toBe('mexc');
      expect(a.predictiveClaimRef.marketType).toBe(MARKET_TYPE.SPOT);
      expect(a.predictiveClaimRef.timeframe).toBe('1h');
      expect(a.predictiveClaimRef.analysisHorizon).toBe('intraday');
    });

    it('64. thin truth ref preserves MC segment fields', () => {
      const a = buildValidObservation();
      expect(a.observedTruthRef.symbol).toBe('BTC/USDT');
      expect(a.observedTruthRef.venue).toBe('mexc');
      expect(a.observedTruthRef.marketType).toBe(MARKET_TYPE.SPOT);
      expect(a.observedTruthRef.timeframe).toBe('1h');
      expect(a.observedTruthRef.sourceTimestamp).toBe(SOURCE_TS);
    });

    it('65. outcomeId preserved thinly where canonical', () => {
      const a = buildValidObservation();
      expect(a.observedTruthRef.outcomeId).toBeDefined();
      expect(typeof a.observedTruthRef.outcomeId).toBe('string');
    });

    it('66. observedDirection preserved', () => {
      expect(buildValidObservation().observedTruthRef.observedDirection).toBe(
        DIRECTION_OR_ABSTAIN.BULLISH,
      );
    });

    it('67. no invented regime field on artifact', () => {
      const a = buildValidObservation();
      expect(a.marketRegime).toBeUndefined();
      expect(a.bullRegime).toBeUndefined();
      expect(a.predictiveClaimRef.marketRegime).toBeUndefined();
    });
  });

  describe('metric-agnostic / no transform / no trust / no promotion', () => {
    it.each([
      ['calibrationScore'],
      ['brierScore'],
      ['ece'],
      ['expectedCalibrationError'],
      ['logLoss'],
      ['reliabilityScore'],
      ['reliabilityCurve'],
      ['probabilityAdjustment'],
      ['correctedConfidence'],
      ['adjustedConfidence'],
      ['calibratedConfidence'],
      ['trustScore'],
      ['agentWeight'],
      ['weight'],
      ['weightDelta'],
      ['reputation'],
      ['promotionScore'],
      ['promotionGate'],
      ['promotionThreshold'],
      ['demotionThreshold'],
      ['threshold'],
      ['promote'],
      ['demote'],
    ])('68-%s. %s field rejected', (field) => {
      expectFail(
        () => buildValidObservation({ [field]: 0.1 }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
    });

    it('69. metricInvention and calibrationMetricCanonicalStatus constants', () => {
      const a = buildValidObservation();
      expect(a.calibrationMetricCanonicalStatus).toBe('UNDEFINED');
      expect(a.metricInvention).toBe('FORBIDDEN');
      expect(CALIBRATION_METRIC_CANONICAL_STATUS).toBe('UNDEFINED');
      expect(METRIC_INVENTION).toBe('FORBIDDEN');
    });

    it('70. no confidence transform fields on artifact', () => {
      const a = buildValidObservation();
      expect(a.adjustedConfidence).toBeUndefined();
      expect(a.correctedConfidence).toBeUndefined();
      expect(a.calibratedConfidence).toBeUndefined();
      expect(a.confidenceDelta).toBeUndefined();
    });

    it('71. hard flags all false — no calibration/trust/promotion auth', () => {
      const a = buildValidObservation();
      for (const [k, v] of Object.entries(REQUIRED_HARD_FLAGS)) {
        expect(a[k]).toBe(false);
        expect(v).toBe(false);
      }
    });

    it('72. persistenceEnabled=true rejected', () => {
      expectFail(
        () => buildValidObservation({ persistenceEnabled: true }),
        'CALIBRATION_AUTHORITY_FLAG_INVALID',
      );
    });

    it('73. calibrationExecutionAuthorized=true rejected', () => {
      expectFail(
        () => buildValidObservation({ calibrationExecutionAuthorized: true }),
        'CALIBRATION_AUTHORITY_FLAG_INVALID',
      );
    });
  });

  describe('raw market / financial / execution forbidden', () => {
    it.each([
      ['ohlcv'],
      ['candles'],
      ['ticker'],
      ['orderBook'],
      ['depth'],
      ['providerPayload'],
      ['exchangeResponse'],
      ['rawSeries'],
      ['rawMarketData'],
      ['marketSnapshot'],
      ['pnl'],
      ['realizedPnl'],
      ['simulatedPnl'],
      ['ROI'],
      ['roi'],
      ['profit'],
      ['return'],
      ['financialResult'],
      ['orders'],
      ['orderId'],
      ['wallet'],
      ['balance'],
      ['transfer'],
      ['withdrawal'],
      ['tradeExecution'],
      ['fill'],
      ['fillPrice'],
      ['executionIntent'],
    ])('74-%s. %s rejected', (field) => {
      expectFail(
        () => buildValidObservation({ [field]: {} }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
    });
  });

  describe('strict validation / fail-closed', () => {
    it('75. unknown top-level input field rejected', () => {
      expectFail(
        () => buildValidObservation({ unexpectedTop: 1 }),
        'CALIBRATION_INPUT_UNKNOWN_FIELD',
      );
    });

    it('76. secret field rejected', () => {
      expectFail(
        () => buildValidObservation({ apiKey: 'secret' }),
        'CALIBRATION_SECRET_FIELD',
      );
    });

    it('77. decision required', () => {
      expectFail(
        () => buildArtemisConfidenceCalibrationObservation({
          evaluationArtifact: buildValidEvaluation(),
          recordedAt: CAL_RECORDED_AT,
        }),
        'CALIBRATION_DECISION_REQUIRED',
      );
    });

    it('78. immutable artifact', () => {
      const a = buildValidObservation();
      expect(Object.isFrozen(a)).toBe(true);
      expect(Object.isFrozen(a.predictiveClaimRef)).toBe(true);
      expect(Object.isFrozen(a.observedTruthRef)).toBe(true);
      expect(() => {
        a.authorityClass = 'EXECUTION';
      }).toThrow();
    });

    it('79. caller input mutation cannot alter artifact', () => {
      const decision = validDecision();
      const evaluationArtifact = buildValidEvaluation();
      const input = {
        decision,
        evaluationArtifact,
        recordedAt: CAL_RECORDED_AT,
        limitations: ['a'],
      };
      const a = buildArtemisConfidenceCalibrationObservation(input);
      input.limitations.push('mutated');
      decision.direction = DIRECTION_OR_ABSTAIN.BEARISH;
      expect(a.limitations).toEqual(
        expect.arrayContaining(['a']),
      );
      expect(a.limitations).not.toContain('mutated');
      expect(a.predictiveClaimRef.direction).toBe(DIRECTION_OR_ABSTAIN.BULLISH);
    });

    it('80. bounded artifact size', () => {
      const a = buildValidObservation();
      const bytes = Buffer.byteLength(JSON.stringify(a), 'utf8');
      expect(bytes).toBeLessThanOrEqual(16 * 1024);
    });

    it('81. zero side effects', () => {
      const a = buildValidObservation();
      expect(a.sideEffects).toEqual(ZERO_CONFIDENCE_CALIBRATION_SIDE_EFFECTS);
      expect(a.sideEffects.calibrationExecutionCount).toBe(0);
      expect(a.sideEffects.trustWeightMutationCount).toBe(0);
      expect(a.sideEffects.promotionExecutionCount).toBe(0);
      expect(a.sideEffects.demotionExecutionCount).toBe(0);
      expect(a.sideEffects.dbWriteCount).toBe(0);
      expect(a.sideEffects.networkRequestCount).toBe(0);
    });

    it('82. provenance deterministic defaults', () => {
      const a = buildValidObservation();
      expect(a.provenance.writer).toBe('artemisConfidenceCalibrationContract');
      expect(a.provenance.methodKey).toBe(CONFIDENCE_CALIBRATION_METHOD_KEY);
      expect(a.provenance.recordedAt).toBe(CAL_RECORDED_AT);
      expect(a.provenance.implementationVersion).toBe(
        CONFIDENCE_CALIBRATION_IMPLEMENTATION_VERSION,
      );
    });

    it('83. decision contractVersion mismatch rejected', () => {
      const decision = validDecision();
      const mutated = { ...decision, contractVersion: 'wrong' };
      expectFail(
        () => buildValidObservation({ decision: mutated }),
        'CALIBRATION_DECISION_VALIDATION_FAILED',
      );
    });
  });

  describe('Evidence-level deferred + source policy', () => {
    it('84. DECISION_LEVEL_CALIBRATION = SUPPORTED', () => {
      expect(DECISION_LEVEL_CALIBRATION).toBe('SUPPORTED');
      expect(buildValidObservation().predictiveClaimSourcePolicy.decisionLevel).toBe(
        'SUPPORTED',
      );
    });

    it('85. EVIDENCE_LEVEL_CALIBRATION deferred by missing canonical binding', () => {
      expect(EVIDENCE_LEVEL_CALIBRATION).toBe(
        'DEFERRED_BY_MISSING_CANONICAL_BINDING',
      );
      expect(PREDICTIVE_CLAIM_SOURCE_POLICY.evidenceLevel).toBe(
        'DEFERRED_BY_MISSING_CANONICAL_BINDING',
      );
      expect(buildValidObservation().predictiveClaimSourcePolicy.evidenceLevel).toBe(
        'DEFERRED_BY_MISSING_CANONICAL_BINDING',
      );
    });
  });

  describe('import hygiene and protected surfaces', () => {
    it('86. no DB/Redis/network/LLM/worker/scheduler/B10/runtime imports', () => {
      const src = readFileSync(CONTRACT_PATH, 'utf8');
      expect(src).not.toMatch(/from ['"].*services\//);
      expect(src).not.toMatch(/from ['"].*repositories\//);
      expect(src).not.toMatch(/from ['"].*database/);
      expect(src).not.toMatch(/ioredis|node-redis|pg['"]|postgres/);
      expect(src).not.toMatch(/mexc|ccxt|openai|anthropic/i);
      expect(src).not.toMatch(/tradingEngine|artemisExecutionGate|artemisOrchestrator/);
      expect(src).not.toMatch(/engineWorkerLeader|messageQueue|startArtemisScheduler/);
      expect(src).not.toMatch(/runtimeExecutionStateService/);
      expect(src).not.toMatch(/from ['"]node:net['"]|from ['"]http['"]|from ['"]https['"]/);
    });

    it('87. allowed imports present', () => {
      const src = readFileSync(CONTRACT_PATH, 'utf8');
      expect(src).toMatch(/artemisEvidenceContract/);
      expect(src).toMatch(/artemisDecisionContract/);
      expect(src).toMatch(/artemisObservedOutcomeEvaluationContract/);
      expect(src).toMatch(/artemisReplayContract/);
      expect(src).toMatch(/hashToUuid/);
    });

    it('88. protected Stage 8/9/Evidence/Decision owners unchanged by this suite', () => {
      for (const rel of PROTECTED_CONTRACT_PATHS) {
        const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
        const src = readFileSync(abs, 'utf8');
        expect(src).not.toMatch(/ARTEMIS_CONFIDENCE_CALIBRATION_OBSERVATION/);
        expect(src).not.toMatch(/S10-CONFIDENCE-CALIBRATION-CONTRACT/);
        expect(src).not.toMatch(/calibrationObservationId/);
      }
    });

    it('89. Evaluation contract version constant used', () => {
      expect(buildValidObservation().versions.evaluationContractVersion).toBe(
        OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
      );
    });

    it('90. Decision contract version used in thin ref', () => {
      expect(buildValidObservation().predictiveClaimRef.contractVersion).toBe(
        DECISION_CONTRACT_VERSION,
      );
    });
  });

  describe('adversarial extras', () => {
    it('91. nested forbidden field on decision rejected', () => {
      const decision = validDecision();
      const poisoned = { ...decision, brierScore: 0.2 };
      expectFail(
        () => buildValidObservation({ decision: poisoned }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
    });

    it('92. nested secret on evaluation rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.apiSecret = 'x';
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_SECRET_FIELD',
      );
    });

    it('93. promotionExecutionAuthorized=true rejected', () => {
      expectFail(
        () => buildValidObservation({ promotionExecutionAuthorized: true }),
        'CALIBRATION_AUTHORITY_FLAG_INVALID',
      );
    });

    it('94. demotionExecutionAuthorized=true rejected', () => {
      expectFail(
        () => buildValidObservation({ demotionExecutionAuthorized: true }),
        'CALIBRATION_AUTHORITY_FLAG_INVALID',
      );
    });

    it('95. trustWeightMutationAuthorized=true rejected', () => {
      expectFail(
        () => buildValidObservation({ trustWeightMutationAuthorized: true }),
        'CALIBRATION_AUTHORITY_FLAG_INVALID',
      );
    });

    it('96. decisionEligible=true rejected', () => {
      expectFail(
        () => buildValidObservation({ decisionEligible: true }),
        'CALIBRATION_AUTHORITY_FLAG_INVALID',
      );
    });

    it('97. liveTradingEnabled=true rejected', () => {
      expectFail(
        () => buildValidObservation({ liveTradingEnabled: true }),
        'CALIBRATION_AUTHORITY_FLAG_INVALID',
      );
    });

    it('98. platt / isotonic / temperatureScaling rejected', () => {
      expectFail(
        () => buildValidObservation({ platt: true }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
      expectFail(
        () => buildValidObservation({ isotonic: true }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
      expectFail(
        () => buildValidObservation({ temperatureScaling: 1.2 }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
    });

    it('99. bucketCounts / reliabilityError rejected', () => {
      expectFail(
        () => buildValidObservation({ bucketCounts: [] }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
      expectFail(
        () => buildValidObservation({ reliabilityError: 0.1 }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
    });

    it('100. currentDataAsHistorical / futureMarketData / lookAhead rejected', () => {
      expectFail(
        () => buildValidObservation({ currentDataAsHistorical: true }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
      expectFail(
        () => buildValidObservation({ futureMarketData: {} }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
      expectFail(
        () => buildValidObservation({ lookAhead: true }),
        'CALIBRATION_FORBIDDEN_FIELD',
      );
    });

    it('101. unknown evaluation nested claim field rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.comparisonClaims = {
        ...evalArt.comparisonClaims,
        extraClaim: 'x',
      };
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_COMPARISON_CLAIMS_UNKNOWN_FIELD',
      );
    });

    it('102. unknown provenance field on input rejected', () => {
      expectFail(
        () => buildValidObservation({
          provenance: {
            writer: 'artemisConfidenceCalibrationContract',
            methodKey: CONFIDENCE_CALIBRATION_METHOD_KEY,
            stage: 'ARTEMIS_CORE_STAGE_10_CONFIDENCE_CALIBRATION_CONTRACT_BOUNDARY',
            recordedAt: CAL_RECORDED_AT,
            policyVersion: 'stage10-confidence-calibration-contract-1.0.0',
            implementationVersion: '1.0.0',
            hacked: true,
          },
        }),
        'CALIBRATION_PROVENANCE_UNKNOWN_FIELD',
      );
    });

    it('103. MISMATCH bearish≠bullish with matching Decision direction', () => {
      const decision = validDecision({ direction: DIRECTION_OR_ABSTAIN.BEARISH });
      const evaluationArtifact = buildValidEvaluation({
        comparisonClaims: {
          decisionDirection: DIRECTION_OR_ABSTAIN.BEARISH,
          observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        },
      });
      const a = buildValidObservation({ decision, evaluationArtifact });
      expect(a.observedTruthRef.evaluationStatus).toBe(EVALUATION_STATUS.MISMATCH);
    });

    it('104. identity includes confidence kind change', () => {
      const evalId = buildValidEvaluation().evaluationId;
      const base = {
        decisionId: DECISION_ID,
        evaluationId: evalId,
        direction: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        confidenceValue: 0.72,
        confidenceScale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      };
      const id1 = computeCalibrationObservationId({
        ...base,
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
      });
      const id2 = computeCalibrationObservationId({
        ...base,
        confidenceKind: CONFIDENCE_KIND.CALIBRATED,
      });
      expect(id1).not.toBe(id2);
    });

    it('105. identity includes scale change', () => {
      const evalId = buildValidEvaluation().evaluationId;
      const base = {
        decisionId: DECISION_ID,
        evaluationId: evalId,
        direction: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        confidenceKind: CONFIDENCE_KIND.MODEL_PROBABILITY,
        confidenceValue: 72,
      };
      const id1 = computeCalibrationObservationId({
        ...base,
        confidenceScale: CONFIDENCE_SCALE.PERCENT_100,
      });
      const id2 = computeCalibrationObservationId({
        ...base,
        confidenceScale: CONFIDENCE_SCALE.UNIT_INTERVAL,
      });
      expect(id1).not.toBe(id2);
    });

    it('106. invalid calibrationObservationId UUID rejected', () => {
      expectFail(
        () => buildValidObservation({ calibrationObservationId: 'bad-id' }),
        'CALIBRATION_OBSERVATION_ID_INVALID',
      );
    });

    it('107. evaluation hard flag escalation rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.persistenceEnabled = true;
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_HARD_FLAG_INVALID',
      );
    });

    it('108. Decision with available confidence but missing provenance fails Decision validation', () => {
      const decision = validDecision({
        confidence: {
          availability: 'available',
          kind: CONFIDENCE_KIND.MODEL_PROBABILITY,
          value: 0.5,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
        },
      });
      expect(validateArtemisDecision(decision).ok).toBe(false);
      expectFail(
        () => buildValidObservation({ decision }),
        'CALIBRATION_DECISION_VALIDATION_FAILED',
      );
    });

    it('109. versions object present and honest', () => {
      const a = buildValidObservation();
      expect(a.versions.schemaVersion).toBe('1.0.0');
      expect(a.versions.contractVersion).toBe(CONFIDENCE_CALIBRATION_CONTRACT_VERSION);
      expect(a.versions.decisionContractVersion).toBe(DECISION_CONTRACT_VERSION);
      expect(a.versions.evaluationContractVersion).toBe(
        OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
      );
    });

    it('110. limitations include metric_agnostic', () => {
      const a = buildValidObservation();
      expect(a.limitations).toEqual(
        expect.arrayContaining([
          'metric_agnostic',
          'calibration_metric_canonical_status_undefined',
          'metric_invention_forbidden',
          'decision_level_only',
          'evidence_level_deferred_by_missing_canonical_binding',
        ]),
      );
    });
  });

  describe('evaluation attestation hardening', () => {
    it('111. evaluation decisionRef contract version mismatch rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.decisionRef.contractVersion = 'artemis-decision-spoofed';
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_DECISION_CONTRACT_VERSION_MISMATCH',
      );
    });

    it('112. evaluation outcomeRef contract version mismatch rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.outcomeRef.contractVersion = 'artemis-observed-outcome-spoofed';
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_OUTCOME_CONTRACT_VERSION_MISMATCH',
      );
    });

    it('113. missing evaluation hard flag rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      delete evalArt.persistenceEnabled;
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_HARD_FLAG_MISSING',
      );
    });

    it('114. nonzero evaluation side effect rejected', () => {
      const evalArt = cloneArtifact(buildValidEvaluation());
      evalArt.sideEffects.dbWriteCount = 1;
      expectFail(
        () => buildValidObservation({ evaluationArtifact: evalArt }),
        'CALIBRATION_EVALUATION_SIDE_EFFECT_NONZERO',
      );
    });

    it('115. calibration recordedAt before evaluation recordedAt rejected', () => {
      expectFail(
        () => buildValidObservation({ recordedAt: '2026-09-22T11:00:01.500Z' }),
        'CALIBRATION_TEMPORAL_RECORDED_AT_VIOLATION',
      );
    });
  });
});
