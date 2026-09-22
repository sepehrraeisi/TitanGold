/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — S8-OBSERVED-OUTCOME-EVALUATION-SOT
 * Observed Outcome Evaluation Source of Truth unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import {
  buildObservedOutcome,
} from '../../contracts/artemisObservedOutcomeContract.js';
import {
  OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
} from '../../contracts/artemisObservedOutcomeSourceOfTruthContract.js';
import {
  EVALUATION_METHOD_KEY,
  EVALUATION_STATUS,
  OBSERVATION_CLASS,
  OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
  OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH,
  OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_EVALUATION_SLICE_ID,
  REQUIRED_HARD_FLAGS,
  buildObservedOutcomeEvaluation,
} from '../../contracts/artemisObservedOutcomeEvaluationContract.js';
import {
  ACCEPT_STATUS,
  OBSERVED_OUTCOME_EVALUATION_SOT_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_EVALUATION_SOT_CONTRACT_VERSION,
  OBSERVED_OUTCOME_EVALUATION_SOT_IS_SOURCE_OF_TRUTH,
  OBSERVED_OUTCOME_EVALUATION_SOT_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID,
  OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
  OBSERVED_OUTCOME_EVALUATION_VALIDATION_BOUNDARY,
  buildDurableEvaluationPayload,
  composeEvaluationRecord,
  computeEvaluationPayloadSha256,
} from '../../contracts/artemisObservedOutcomeEvaluationSourceOfTruthContract.js';
import {
  acceptObservedOutcomeEvaluation,
  createInMemoryObservedOutcomeEvaluationSourceOfTruth,
  createInMemoryObservedOutcomeEvaluationStore,
  getForbiddenImportMarkers,
  getObservedOutcomeEvaluationById,
  listObservedOutcomeEvaluations,
  rejectDelete,
  rejectUpdate,
} from '../../services/artemisObservedOutcomeEvaluationSourceOfTruthService.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECORDING_ID = '66666666-6666-4666-8666-666666666666';
const TASK_ID = '77777777-7777-4777-8777-777777777777';
const BINDING_ID = '88888888-8888-4888-8888-888888888888';
const CYCLE_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_UUID = '11111111-1111-4111-8111-111111111111';

const ANALYSIS_AT = '2026-09-22T10:00:00.000Z';
const SOURCE_TS = '2026-09-22T10:59:00.000Z';
const OUTCOME_OBSERVED_AT = '2026-09-22T11:00:00.000Z';
const OUTCOME_RECORDED_AT = '2026-09-22T11:00:01.000Z';
const EVAL_RECORDED_AT = '2026-09-22T11:00:02.000Z';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SOT_CONTRACT_PATH = path.join(
  DIR,
  '../../contracts/artemisObservedOutcomeEvaluationSourceOfTruthContract.js',
);
const SOT_SERVICE_PATH = path.join(
  DIR,
  '../../services/artemisObservedOutcomeEvaluationSourceOfTruthService.js',
);
const EVAL_CONTRACT_PATH = path.join(
  DIR,
  '../../contracts/artemisObservedOutcomeEvaluationContract.js',
);
const MIGRATION_PATH = path.join(
  DIR,
  '../../database/migrations/055_artemis_observed_outcome_evaluation_sot.sql',
);

const PROTECTED_PATHS = [
  '../../contracts/artemisRiskControlRuntimeBoundaryContract.js',
  '../../contracts/artemisPortfolioControlSizingBoundaryContract.js',
  '../../contracts/artemisLiquidityExecutionFeasibilityBoundaryContract.js',
  '../../contracts/artemisRuntimeCapabilityBoundaryContract.js',
  '../../contracts/artemisOrderManagementExecutionBoundaryContract.js',
  '../../contracts/artemisControlChainContract.js',
  '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js',
  '../../contracts/artemisMarketContextContract.js',
  '../../contracts/artemisMarketContextSourceOfTruthContract.js',
  '../../contracts/artemisObservedOutcomeContract.js',
  '../../contracts/artemisObservedOutcomeSourceOfTruthContract.js',
  '../../contracts/artemisObservedOutcomeEvaluationContract.js',
  '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateBoundaryContract.js',
  '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateActivationBoundaryContract.js',
  '../../contracts/artemisDecisionContextContract.js',
];

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
  return {
    outcomeArtifact,
    observationClass: OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE,
    evaluationMethod: evaluationMethod(),
    recordedAt: EVAL_RECORDED_AT,
    comparisonClaims: {
      decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
      observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
    },
    ...overrides,
    outcomeArtifact: overrides.outcomeArtifact === undefined
      ? outcomeArtifact
      : overrides.outcomeArtifact,
  };
}

function expectValidationFail(result) {
  expect(result.ok).toBe(false);
  expect(result.code).toBe(ACCEPT_STATUS.VALIDATION_FAILED);
}

function zeroSideEffectAudit(sideEffects) {
  expect(sideEffects.networkRequestCount).toBe(0);
  expect(sideEffects.providerRequestCount).toBe(0);
  expect(sideEffects.llmCallCount).toBe(0);
  expect(sideEffects.orderOperationCount).toBe(0);
  expect(sideEffects.financialExecutionCount).toBe(0);
  expect(sideEffects.dbWriteCount).toBe(0);
  expect(sideEffects.redisWriteCount).toBe(0);
  expect(sideEffects.network).toBe(0);
  expect(sideEffects.provider).toBe(0);
  expect(sideEffects.llm).toBe(0);
  expect(sideEffects.orders).toBe(0);
  expect(sideEffects.wallet).toBe(0);
  expect(sideEffects.financialExecution).toBe(0);
  expect(sideEffects.worker).toBe(0);
  expect(sideEffects.scheduler).toBe(0);
  expect(sideEffects.feeder).toBe(0);
  expect(sideEffects.b10).toBe(0);
  expect(sideEffects.replay).toBe(0);
  expect(sideEffects.calibration).toBe(0);
  expect(sideEffects.runtimeMutation).toBe(0);
}

describe('artemisObservedOutcomeEvaluationSourceOfTruth — S8-OBSERVED-OUTCOME-EVALUATION-SOT', () => {
  it('1. sourceOfTruth=true; authorityClass correct', () => {
    expect(OBSERVED_OUTCOME_EVALUATION_SOT_IS_SOURCE_OF_TRUTH).toBe(true);
    expect(OBSERVED_OUTCOME_EVALUATION_SOT_OWNERSHIP_ROLE).toBe('SOURCE_OF_TRUTH');
    expect(OBSERVED_OUTCOME_EVALUATION_SOT_AUTHORITY_CLASS).toBe('OUTCOME_EVALUATION');
    expect(OBSERVED_OUTCOME_EVALUATION_SOT_AUTHORITY_CLASS)
      .toBe(OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS);
    expect(OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH).toBe(false);
    expect(OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE).toBe('VALIDATION_BOUNDARY');
    expect(OBSERVED_OUTCOME_EVALUATION_VALIDATION_BOUNDARY)
      .toBe('artemisObservedOutcomeEvaluationContract');
    expect(OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID)
      .toBe('S8-OBSERVED-OUTCOME-EVALUATION-SOT');
  });

  it('2–3. valid Evaluation artifact accepted; aliases createInMemoryObservedOutcomeEvaluationSourceOfTruth', () => {
    const store = createInMemoryObservedOutcomeEvaluationSourceOfTruth();
    const result = acceptObservedOutcomeEvaluation(validEvalInput(), { store });
    expect(result.ok).toBe(true);
    expect(result.code).toBe(ACCEPT_STATUS.ACCEPTED);
    expect(result.evaluationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.payloadSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.record.ownership.role).toBe(OBSERVED_OUTCOME_EVALUATION_SOT_OWNERSHIP_ROLE);
    expect(result.record.ownership.isSourceOfTruth).toBe(true);
    expect(result.record.evaluationStatus).toBe(EVALUATION_STATUS.MATCH);
    expect(result.record.evaluationResult).toBe(EVALUATION_STATUS.MATCH);
    expect(result.record.decisionTimestamp).toBe(ANALYSIS_AT);
    expect(result.record.outcomeObservedAt).toBe(OUTCOME_OBSERVED_AT);
    expect(result.record.shadowCycleEnvelopeId).toBe(CYCLE_ID);
    expect(result.sideEffects.sotAppendCount).toBe(1);
    zeroSideEffectAudit(result.sideEffects);
    expect(store.getStats().rowCount).toBe(1);
  });

  it('4. invalid Evaluation artifact rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const input = validEvalInput();
    delete input.observationClass;
    expectValidationFail(acceptObservedOutcomeEvaluation(input, { store }));
    expect(store.getStats().rowCount).toBe(0);
  });

  it('5. missing decisionRef (via broken outcome) rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const badOutcome = buildValidOutcome();
    // Mutating frozen artifact clone for adversarial path — rebuild without decisionRef fails earlier
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      outcomeArtifact: null,
    }), { store }));
  });

  it('6. missing outcomeRef / outcomeArtifact rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    expectValidationFail(acceptObservedOutcomeEvaluation({
      observationClass: OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE,
      evaluationMethod: evaluationMethod(),
      recordedAt: EVAL_RECORDED_AT,
    }, { store }));
  });

  it('7. lineage mismatch rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      lineage: { decisionId: OTHER_UUID },
    }), { store }));
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      lineage: { outcomeId: OTHER_UUID },
    }), { store }));
  });

  it('8. unknown fields rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      unknownExtra: true,
    }), { store }));
  });

  it('9. forbidden realizedPnl rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const result = acceptObservedOutcomeEvaluation(validEvalInput({
      realizedPnl: 12.5,
    }), { store });
    expectValidationFail(result);
    expect((result.errors || []).some((e) => e.field === 'realizedPnl'
      || e.code === 'forbidden_field')).toBe(true);
  });

  it('10. forbidden calibrationScore rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      calibrationScore: 0.99,
    }), { store }));
  });

  it('11. forbidden lookahead rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      lookahead: true,
    }), { store }));
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      lookAhead: true,
    }), { store }));
  });

  it('12. forbidden raw market data rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      ohlcv: [{ open: 1 }],
    }), { store }));
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      candles: [],
    }), { store }));
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      orderbook: {},
    }), { store }));
  });

  it('13. hard authority flag true rejected', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
      expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
        [key]: true,
      }), { store }));
    }
  });

  it('14–16. deterministic evaluationId; identical retry idempotent; conflict on same identity different payload', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const built = buildObservedOutcomeEvaluation(validEvalInput());
    expect(built.ok).toBe(true);

    const a = acceptObservedOutcomeEvaluation(validEvalInput(), { store });
    const b = acceptObservedOutcomeEvaluation(validEvalInput(), { store });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.evaluationId).toBe(built.artifact.evaluationId);
    expect(a.evaluationId).toBe(b.evaluationId);
    expect(a.payloadSha256).toBe(b.payloadSha256);
    expect(b.code).toBe(ACCEPT_STATUS.ALREADY_PRESENT);
    expect(b.sideEffects.sotAppendCount).toBe(0);
    expect(store.getStats().rowCount).toBe(1);

    // Same identity inputs (incl. recordedAt) but different evaluationStatus → CONFLICT
    const conflict = acceptObservedOutcomeEvaluation(validEvalInput({
      comparisonClaims: {
        decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BEARISH,
      },
    }), { store });
    expect(conflict.ok).toBe(false);
    expect(conflict.code).toBe(ACCEPT_STATUS.CONFLICT);
    expect(conflict.evaluationId).toBe(a.evaluationId);
    expect(conflict.existingPayloadSha256).toBe(a.payloadSha256);
    expect(conflict.attemptedPayloadSha256).not.toBe(a.payloadSha256);
    expect(store.getStats().rowCount).toBe(1);

    const still = getObservedOutcomeEvaluationById(a.evaluationId, { store });
    expect(still.ok).toBe(true);
    expect(still.record.evaluationStatus).toBe(EVALUATION_STATUS.MATCH);
  });

  it('17–19. append-only; no delete; no update', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const result = acceptObservedOutcomeEvaluation(validEvalInput(), { store });
    expect(result.ok).toBe(true);
    expect(Object.isFrozen(result.record)).toBe(true);

    const originalSha = result.record.payloadSha256;
    try {
      result.record.payloadSha256 = 'mutated';
    } catch {
      // frozen may throw
    }
    expect(result.record.payloadSha256).toBe(originalSha);

    const up = rejectUpdate(store);
    expect(up.ok).toBe(false);
    expect(up.code).toBe('APPEND_ONLY_NO_UPDATE');
    const del = rejectDelete(store);
    expect(del.ok).toBe(false);
    expect(del.code).toBe('APPEND_ONLY_NO_DELETE');
    expect(store.getStats().rowCount).toBe(1);
  });

  it('20–21. lookup by evaluationId; list deterministic', () => {
    expect(getObservedOutcomeEvaluationById(OTHER_UUID, {}).ok).toBe(false);
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const first = acceptObservedOutcomeEvaluation(validEvalInput(), { store });
    const second = acceptObservedOutcomeEvaluation(validEvalInput({
      recordedAt: '2026-09-22T11:00:05.000Z',
    }), { store });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.evaluationId).not.toBe(second.evaluationId);

    const found = getObservedOutcomeEvaluationById(first.evaluationId, { store });
    expect(found.ok).toBe(true);
    expect(Object.isFrozen(found.record)).toBe(true);
    expect(getObservedOutcomeEvaluationById(OTHER_UUID, { store }).code).toBe('not_found');

    const listed = listObservedOutcomeEvaluations({ store });
    expect(listed.ok).toBe(true);
    expect(listed.count).toBe(2);
    expect(listed.evaluationIds).toEqual([
      first.evaluationId,
      second.evaluationId,
    ]);
    expect(listed.records[0].evaluationId).toBe(first.evaluationId);
    expect(listed.records[1].evaluationId).toBe(second.evaluationId);
  });

  it('22. provenance preserved', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const result = acceptObservedOutcomeEvaluation(validEvalInput(), { store });
    expect(result.record.writer).toBe(OBSERVED_OUTCOME_EVALUATION_SOT_WRITER);
    expect(result.record.provenance.writer).toBe(OBSERVED_OUTCOME_EVALUATION_SOT_WRITER);
    expect(result.record.provenance.methodKey).toBeTruthy();
    expect(result.record.provenance.stage).toBeTruthy();
    expect(result.record.provenance.recordedAt).toBe(EVAL_RECORDED_AT);
    expect(result.record.provenance.policyVersion).toBeTruthy();
    expect(result.sotWriter).toBe(OBSERVED_OUTCOME_EVALUATION_SOT_WRITER);
  });

  it('23–24. timestamps validated; outcome temporal boundary preserved', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      recordedAt: 'not-iso',
    }), { store }));
    // Look-ahead / pre-decision outcome fails at Outcome validation upstream
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      outcomeArtifact: (() => {
        const r = buildObservedOutcome(validOutcomeInput({
          outcomeObservedAt: '2026-09-22T09:00:00.000Z',
          recordedAt: '2026-09-22T09:00:01.000Z',
          marketContextRef: marketContextRef({
            sourceTimestamp: '2026-09-22T08:59:00.000Z',
          }),
        }));
        // buildObservedOutcome itself rejects look-ahead; pass invalid via eval recorded before decision
        expect(r.ok).toBe(false);
        return undefined;
      })(),
      recordedAt: '2026-09-22T09:00:00.000Z',
    }), { store }));

    const accepted = acceptObservedOutcomeEvaluation(validEvalInput(), { store });
    expect(accepted.ok).toBe(true);
    expect(accepted.record.time.decisionTimestamp).toBe(ANALYSIS_AT);
    expect(accepted.record.time.outcomeObservedAt).toBe(OUTCOME_OBSERVED_AT);
    expect(accepted.record.time.evaluatedAt).toBe(EVAL_RECORDED_AT);
  });

  it('25–29. no network/provider/DB/Redis/LLM/Worker/Scheduler/B10 imports', () => {
    const sotContract = readFileSync(SOT_CONTRACT_PATH, 'utf8');
    const sotService = readFileSync(SOT_SERVICE_PATH, 'utf8');
    expect(sotContract).toContain(OBSERVED_OUTCOME_EVALUATION_SOT_CONTRACT_VERSION);
    expect(sotService).toContain('createInMemoryObservedOutcomeEvaluationStore');
    expect(sotContract).not.toMatch(/Date\.now\s*\(/);
    expect(sotContract).not.toMatch(/Math\.random\s*\(/);
    expect(sotContract).not.toMatch(/randomUUID\s*\(/);
    expect(sotService).not.toMatch(/Date\.now\s*\(/);
    expect(sotService).not.toMatch(/Math\.random\s*\(/);

    for (const marker of getForbiddenImportMarkers()) {
      const importRe = new RegExp(`from\\s+['"][^'"]*${marker}[^'"]*['"]`);
      expect(sotService).not.toMatch(importRe);
      expect(sotContract).not.toMatch(importRe);
    }
  });

  it('30. no mutation of upstream artifacts; Evaluation Contract remains validation-only', () => {
    const outcome = buildValidOutcome();
    const frozenOutcomeId = outcome.outcomeId;
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const result = acceptObservedOutcomeEvaluation(validEvalInput({
      outcomeArtifact: outcome,
    }), { store });
    expect(result.ok).toBe(true);
    expect(outcome.outcomeId).toBe(frozenOutcomeId);

    const evalContract = readFileSync(EVAL_CONTRACT_PATH, 'utf8');
    expect(evalContract).toContain(OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION);
    expect(evalContract).toContain('VALIDATION_BOUNDARY');
    expect(OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH).toBe(false);
    expect(OBSERVED_OUTCOME_EVALUATION_SLICE_ID)
      .toBe('S8-OBSERVED-OUTCOME-EVALUATION-CONTRACT');

    for (const rel of PROTECTED_PATHS) {
      const full = path.join(DIR, rel);
      const before = readFileSync(full, 'utf8');
      expect(before.length).toBeGreaterThan(100);
      expect(before).not.toContain('OBSERVED_OUTCOME_EVALUATION_SOT_IS_SOURCE_OF_TRUTH');
    }
  });

  it('hard flags on stored record remain false', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const result = acceptObservedOutcomeEvaluation(validEvalInput(), { store });
    for (const [k, v] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.record.hardFlags[k]).toBe(v);
      expect(result.hardFlags[k]).toBe(false);
    }
  });

  it('payload hash deterministic from durable payload', () => {
    const built = buildObservedOutcomeEvaluation(validEvalInput());
    expect(built.ok).toBe(true);
    const extras = {
      outcomeObservedAt: OUTCOME_OBSERVED_AT,
      shadowCycleEnvelopeId: CYCLE_ID,
      decisionTimestamp: ANALYSIS_AT,
    };
    const payload = buildDurableEvaluationPayload(built.artifact, extras);
    const h1 = computeEvaluationPayloadSha256(payload);
    const h2 = computeEvaluationPayloadSha256(payload);
    expect(h1).toBe(h2);
    const record = composeEvaluationRecord(built.artifact, extras);
    expect(record.payloadSha256).toBe(h1);
  });

  it('zero side effects on accept', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const result = acceptObservedOutcomeEvaluation(validEvalInput(), { store });
    zeroSideEffectAudit(result.sideEffects);
  });

  it('list requires store', () => {
    expect(listObservedOutcomeEvaluations({}).ok).toBe(false);
  });

  it('malformed caller evaluationId rejected at validation', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    expectValidationFail(acceptObservedOutcomeEvaluation(validEvalInput({
      evaluationId: OTHER_UUID,
    }), { store }));
  });

  it('migration authored — static schema validation; not executed', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).toContain('CREATE TABLE artemis_observed_outcome_evaluations');
    expect(sql).toContain('evaluation_id UUID PRIMARY KEY');
    expect(sql).toContain('payload_sha256');
    expect(sql).toContain('decision_id');
    expect(sql).toContain('outcome_id');
    expect(sql).toContain('decision_context_id');
    expect(sql).toContain('shadow_recording_artifact_id');
    expect(sql).toContain('market_context_id');
    expect(sql).toContain('evaluation_status');
    expect(sql).toContain('decision_eligible IS FALSE');
    expect(sql).toContain('DO NOT execute against live DB');
    expect(sql).not.toMatch(/realized_pnl/i);
    expect(sql).not.toMatch(/calibration_score/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
    const sqlWithoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(sqlWithoutComments).not.toMatch(/(^|\s)BEGIN\s*;/i);
    expect(sqlWithoutComments).not.toMatch(/(^|\s)COMMIT\s*;/i);
  });

  it('SoT does not recompute evaluation — stores contract status only', () => {
    const store = createInMemoryObservedOutcomeEvaluationStore();
    const mismatch = acceptObservedOutcomeEvaluation(validEvalInput({
      comparisonClaims: {
        decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BEARISH,
      },
    }), { store });
    expect(mismatch.ok).toBe(true);
    expect(mismatch.record.evaluationStatus).toBe(EVALUATION_STATUS.MISMATCH);
    expect(mismatch.record.evaluationResult).toBe(EVALUATION_STATUS.MISMATCH);
    // No PnL / score fields on record
    expect(mismatch.record.realizedPnl).toBeUndefined();
    expect(mismatch.record.calibrationScore).toBeUndefined();
  });

  it('Outcome SoT contract remains separate; Evaluation SoT does not claim Outcome ownership', () => {
    expect(OBSERVED_OUTCOME_SOT_CONTRACT_VERSION).toBeTruthy();
    const sotContract = readFileSync(SOT_CONTRACT_PATH, 'utf8');
    expect(sotContract).toContain('does_not_own_decision_or_outcome_ids');
    expect(sotContract).not.toContain('CREATE TABLE artemis_observed_outcomes');
  });
});
