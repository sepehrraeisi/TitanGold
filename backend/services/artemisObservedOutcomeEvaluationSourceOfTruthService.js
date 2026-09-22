/**
 * Artemis Core Stage 8 — Observed Outcome Evaluation Source of Truth service
 * (S8-OBSERVED-OUTCOME-EVALUATION-SOT).
 *
 * Append-only owner for validated Observed Outcome Evaluation artifacts.
 * Validates via S8-OBSERVED-OUTCOME-EVALUATION-CONTRACT; persists via injectable
 * store (in-memory for V1 library path). Does NOT perform evaluation logic.
 *
 * Live PostgreSQL migration is authored separately and must NOT be executed
 * until separately authorized. This service performs zero network/provider/LLM
 * /order/wallet/runtime mutation.
 */

import { buildObservedOutcomeEvaluation } from '../contracts/artemisObservedOutcomeEvaluationContract.js';
import {
  ACCEPT_STATUS,
  OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
  OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
  OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID,
  composeEvaluationRecord,
  createZeroSideEffects,
} from '../contracts/artemisObservedOutcomeEvaluationSourceOfTruthContract.js';

const FORBIDDEN_IMPORT_MARKERS = Object.freeze([
  'tradingEngine',
  'artemisExecutionGate',
  'artemisOrchestrator',
  'market-proxy',
  'mexcService',
  'ccxt',
  'axios',
  'node-fetch',
  'persistArtemisDecision',
  'startArtemisScheduler',
  'engineWorkerLeader',
  'messageQueue',
  'pg',
  'ioredis',
  'redis',
]);

/**
 * Deep-freeze helper for returned clones (immutability against caller mutation).
 * @param {*} value
 * @returns {*}
 */
function freezeDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = freezeDeep(value[i]);
    }
  } else {
    for (const key of Object.keys(value)) {
      value[key] = freezeDeep(value[key]);
    }
  }
  return Object.freeze(value);
}

/**
 * Return a frozen deep clone so callers cannot mutate the stored record.
 * @param {object} record
 * @returns {object}
 */
function cloneFrozenRecord(record) {
  return freezeDeep(structuredClone(record));
}

/**
 * In-memory append-only Observed Outcome Evaluation store
 * (canonical V1 SoT for unit/library).
 * Uniqueness key = evaluationId (from Evaluation Contract identity).
 * @returns {object}
 */
export function createInMemoryObservedOutcomeEvaluationStore() {
  /** @type {Map<string, object>} */
  const byEvaluationId = new Map();
  /** @type {string[]} insertion order for deterministic list */
  const insertionOrder = [];
  let appendCount = 0;
  let updateCount = 0;
  let deleteCount = 0;

  return Object.freeze({
    kind: 'in_memory',
    getByEvaluationId(evaluationId) {
      return byEvaluationId.get(evaluationId) ?? null;
    },
    has(evaluationId) {
      return byEvaluationId.has(evaluationId);
    },
    /**
     * @param {object} record
     * @returns {{ status: 'inserted' | 'already_present' | 'conflict', record: object }}
     */
    append(record) {
      const existing = byEvaluationId.get(record.evaluationId);
      if (existing) {
        if (existing.payloadSha256 === record.payloadSha256) {
          return { status: 'already_present', record: existing };
        }
        return { status: 'conflict', record: existing };
      }
      const frozen = freezeDeep(structuredClone(record));
      byEvaluationId.set(record.evaluationId, frozen);
      insertionOrder.push(record.evaluationId);
      appendCount += 1;
      return { status: 'inserted', record: frozen };
    },
    update() {
      updateCount += 1;
      throw Object.assign(new Error('append_only_no_update'), {
        code: 'APPEND_ONLY_NO_UPDATE',
      });
    },
    delete() {
      deleteCount += 1;
      throw Object.assign(new Error('append_only_no_delete'), {
        code: 'APPEND_ONLY_NO_DELETE',
      });
    },
    getStats() {
      return {
        rowCount: byEvaluationId.size,
        appendCount,
        updateCount,
        deleteCount,
      };
    },
    listEvaluationIds() {
      return [...insertionOrder];
    },
    listRecords() {
      return insertionOrder.map((id) => byEvaluationId.get(id));
    },
  });
}

/** Alias matching Owner-requested naming. */
export function createInMemoryObservedOutcomeEvaluationSourceOfTruth() {
  return createInMemoryObservedOutcomeEvaluationStore();
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    sideEffects: createZeroSideEffects(),
    ...extra,
  };
}

/**
 * Accept a validated Observed Outcome Evaluation into the SoT.
 * Performs validation through the Evaluation Contract only — does not evaluate.
 *
 * @param {object} input — same shape as buildObservedOutcomeEvaluation input
 * @param {{ store?: object }} [options]
 * @returns {object}
 */
export function acceptObservedOutcomeEvaluation(input, options = {}) {
  const store = options.store ?? createInMemoryObservedOutcomeEvaluationStore();

  const validated = buildObservedOutcomeEvaluation(input);
  if (!validated.ok) {
    return {
      ok: false,
      code: ACCEPT_STATUS.VALIDATION_FAILED,
      message: validated.message || 'Observed Outcome Evaluation validation failed',
      validationCode: validated.code,
      errors: validated.errors,
      sideEffects: createZeroSideEffects(),
      sotWriter: OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
      sotMethodKey: OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
      sliceId: OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID,
    };
  }

  const extras = {
    outcomeObservedAt: input?.outcomeArtifact?.outcomeObservedAt ?? null,
    shadowCycleEnvelopeId:
      input?.outcomeArtifact?.shadowCycleEnvelopeRef?.shadowCycleEnvelopeId
      ?? null,
    decisionTimestamp:
      input?.outcomeArtifact?.decisionRef?.analysisAt
      ?? input?.outcomeArtifact?.decisionRef?.createdAt
      ?? null,
  };

  const record = composeEvaluationRecord(validated.artifact, extras);
  const appendResult = store.append(record);

  if (appendResult.status === 'conflict') {
    return {
      ok: false,
      code: ACCEPT_STATUS.CONFLICT,
      message:
        'Evaluation identity already exists with a different payload; overwrite forbidden',
      evaluationId: appendResult.record.evaluationId,
      existingPayloadSha256: appendResult.record.payloadSha256,
      attemptedPayloadSha256: record.payloadSha256,
      record: cloneFrozenRecord(appendResult.record),
      sideEffects: createZeroSideEffects({
        sotAppendCount: 0,
        sotUpdateCount: 0,
        sotDeleteCount: 0,
      }),
      sotWriter: OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
      sotMethodKey: OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
      sliceId: OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID,
      hardFlags: { ...appendResult.record.hardFlags },
    };
  }

  if (appendResult.status === 'already_present') {
    return {
      ok: true,
      code: ACCEPT_STATUS.ALREADY_PRESENT,
      message: 'Identical evaluation already present; idempotent no-op',
      record: cloneFrozenRecord(appendResult.record),
      evaluationId: appendResult.record.evaluationId,
      payloadSha256: appendResult.record.payloadSha256,
      sideEffects: createZeroSideEffects({
        sotAppendCount: 0,
      }),
      sotWriter: OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
      sotMethodKey: OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
      sliceId: OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID,
      hardFlags: { ...appendResult.record.hardFlags },
      limitations: [...appendResult.record.limitations],
    };
  }

  return {
    ok: true,
    code: ACCEPT_STATUS.ACCEPTED,
    message: 'Observed Outcome Evaluation accepted into Evaluation SoT',
    record: cloneFrozenRecord(appendResult.record),
    evaluationId: appendResult.record.evaluationId,
    payloadSha256: appendResult.record.payloadSha256,
    sideEffects: createZeroSideEffects({
      sotAppendCount: 1,
      dbWriteCount: 0,
    }),
    sotWriter: OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
    sotMethodKey: OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
    sliceId: OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID,
    hardFlags: { ...appendResult.record.hardFlags },
    limitations: [...appendResult.record.limitations],
  };
}

/**
 * Deterministic lookup by evaluationId.
 * @param {string} evaluationId
 * @param {{ store: object }} options
 */
export function getObservedOutcomeEvaluationById(evaluationId, options) {
  if (!options?.store) {
    return fail('store_required', 'Evaluation SoT store required for lookup');
  }
  const record = options.store.getByEvaluationId(evaluationId);
  if (!record) {
    return fail('not_found', 'Observed Outcome Evaluation not found', {
      evaluationId,
    });
  }
  return {
    ok: true,
    code: 'FOUND',
    record: cloneFrozenRecord(record),
    evaluationId: record.evaluationId,
    sideEffects: createZeroSideEffects(),
  };
}

/**
 * Deterministic list in insertion order.
 * @param {{ store: object }} options
 */
export function listObservedOutcomeEvaluations(options) {
  if (!options?.store) {
    return fail('store_required', 'Evaluation SoT store required for list');
  }
  const records = options.store.listRecords().map((r) => cloneFrozenRecord(r));
  return {
    ok: true,
    code: 'LISTED',
    records,
    evaluationIds: options.store.listEvaluationIds(),
    count: records.length,
    sideEffects: createZeroSideEffects(),
  };
}

/**
 * Explicit reject helpers for append-only API surface probes.
 * @param {object} store
 */
export function rejectUpdate(store) {
  try {
    store.update();
    return fail('unexpected_update_success', 'update must not succeed');
  } catch (err) {
    return {
      ok: false,
      code: err.code || 'APPEND_ONLY_NO_UPDATE',
      message: err.message,
      sideEffects: createZeroSideEffects({ sotUpdateCount: 1 }),
    };
  }
}

/**
 * @param {object} store
 */
export function rejectDelete(store) {
  try {
    store.delete();
    return fail('unexpected_delete_success', 'delete must not succeed');
  } catch (err) {
    return {
      ok: false,
      code: err.code || 'APPEND_ONLY_NO_DELETE',
      message: err.message,
      sideEffects: createZeroSideEffects({ sotDeleteCount: 1 }),
    };
  }
}

export function getForbiddenImportMarkers() {
  return [...FORBIDDEN_IMPORT_MARKERS];
}

export default {
  acceptObservedOutcomeEvaluation,
  createInMemoryObservedOutcomeEvaluationStore,
  createInMemoryObservedOutcomeEvaluationSourceOfTruth,
  getObservedOutcomeEvaluationById,
  listObservedOutcomeEvaluations,
  rejectUpdate,
  rejectDelete,
  getForbiddenImportMarkers,
};
