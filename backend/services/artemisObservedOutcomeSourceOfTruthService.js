/**
 * Artemis Core Stage 8 — Observed Outcome Source of Truth service
 * (S8-OBSERVED-OUTCOME-SOT).
 *
 * Append-only owner for validated Observed Outcome artifacts.
 * Validates via S8-OBSERVED-OUTCOME-CONTRACT; persists via injectable store
 * (in-memory for V1 library path).
 *
 * Live PostgreSQL migration is authored separately and must NOT be executed
 * until separately authorized. This service performs zero network/provider/LLM
 * /order/wallet/runtime mutation.
 */

import { buildObservedOutcome } from '../contracts/artemisObservedOutcomeContract.js';
import {
  ACCEPT_STATUS,
  OBSERVED_OUTCOME_SOT_WRITER,
  OBSERVED_OUTCOME_SOT_METHOD_KEY,
  OBSERVED_OUTCOME_SOT_SLICE_ID,
  composeOutcomeRecord,
  createZeroSideEffects,
} from '../contracts/artemisObservedOutcomeSourceOfTruthContract.js';

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
]);

/**
 * Deep-freeze helper for returned clones (immutability against caller mutation).
 * @param {*} value
 * @returns {*}
 */
function freezeDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  // Already-frozen nodes (including shared refs inside one structuredClone graph)
  // must not be reassigned — return as-is.
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
 * In-memory append-only Observed Outcome store (canonical V1 SoT for unit/library).
 * Uniqueness key = outcomeId (from Outcome Contract identity).
 * @returns {object}
 */
export function createInMemoryObservedOutcomeStore() {
  /** @type {Map<string, object>} */
  const byOutcomeId = new Map();
  let appendCount = 0;
  let updateCount = 0;
  let deleteCount = 0;

  return Object.freeze({
    kind: 'in_memory',
    getByOutcomeId(outcomeId) {
      return byOutcomeId.get(outcomeId) ?? null;
    },
    has(outcomeId) {
      return byOutcomeId.has(outcomeId);
    },
    /**
     * @param {object} record
     * @returns {{ status: 'inserted' | 'already_present' | 'conflict', record: object }}
     */
    append(record) {
      const existing = byOutcomeId.get(record.outcomeId);
      if (existing) {
        if (existing.payloadSha256 === record.payloadSha256) {
          return { status: 'already_present', record: existing };
        }
        return { status: 'conflict', record: existing };
      }
      // Freeze a structural clone so the caller's record object cannot mutate storage.
      const frozen = freezeDeep(structuredClone(record));
      byOutcomeId.set(record.outcomeId, frozen);
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
        rowCount: byOutcomeId.size,
        appendCount,
        updateCount,
        deleteCount,
      };
    },
    listOutcomeIds() {
      return [...byOutcomeId.keys()];
    },
  });
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
 * Accept a validated Observed Outcome into the SoT.
 *
 * @param {object} input — same shape as buildObservedOutcome input
 * @param {{ store?: object }} [options]
 * @returns {object}
 */
export function acceptObservedOutcome(input, options = {}) {
  const store = options.store ?? createInMemoryObservedOutcomeStore();

  const validated = buildObservedOutcome(input);
  if (!validated.ok) {
    return {
      ok: false,
      code: ACCEPT_STATUS.VALIDATION_FAILED,
      message: validated.message || 'Observed Outcome validation failed',
      validationCode: validated.code,
      errors: validated.errors,
      sideEffects: createZeroSideEffects(),
      sotWriter: OBSERVED_OUTCOME_SOT_WRITER,
      sotMethodKey: OBSERVED_OUTCOME_SOT_METHOD_KEY,
      sliceId: OBSERVED_OUTCOME_SOT_SLICE_ID,
    };
  }

  const record = composeOutcomeRecord(validated.artifact);
  const appendResult = store.append(record);

  if (appendResult.status === 'conflict') {
    return {
      ok: false,
      code: ACCEPT_STATUS.CONFLICT,
      message:
        'Outcome identity already exists with a different payload; overwrite forbidden',
      outcomeId: appendResult.record.outcomeId,
      existingPayloadSha256: appendResult.record.payloadSha256,
      attemptedPayloadSha256: record.payloadSha256,
      record: cloneFrozenRecord(appendResult.record),
      sideEffects: createZeroSideEffects({
        sotAppendCount: 0,
        sotUpdateCount: 0,
        sotDeleteCount: 0,
      }),
      sotWriter: OBSERVED_OUTCOME_SOT_WRITER,
      sotMethodKey: OBSERVED_OUTCOME_SOT_METHOD_KEY,
      sliceId: OBSERVED_OUTCOME_SOT_SLICE_ID,
      hardFlags: { ...appendResult.record.hardFlags },
    };
  }

  if (appendResult.status === 'already_present') {
    return {
      ok: true,
      code: ACCEPT_STATUS.ALREADY_PRESENT,
      message: 'Identical outcome already present; idempotent no-op',
      record: cloneFrozenRecord(appendResult.record),
      outcomeId: appendResult.record.outcomeId,
      payloadSha256: appendResult.record.payloadSha256,
      sideEffects: createZeroSideEffects({
        sotAppendCount: 0,
      }),
      sotWriter: OBSERVED_OUTCOME_SOT_WRITER,
      sotMethodKey: OBSERVED_OUTCOME_SOT_METHOD_KEY,
      sliceId: OBSERVED_OUTCOME_SOT_SLICE_ID,
      hardFlags: { ...appendResult.record.hardFlags },
      limitations: [...appendResult.record.limitations],
    };
  }

  return {
    ok: true,
    code: ACCEPT_STATUS.ACCEPTED,
    message: 'Observed Outcome accepted into Observed Outcome SoT',
    record: cloneFrozenRecord(appendResult.record),
    outcomeId: appendResult.record.outcomeId,
    payloadSha256: appendResult.record.payloadSha256,
    sideEffects: createZeroSideEffects({
      sotAppendCount: 1,
      dbWriteCount: 0,
    }),
    sotWriter: OBSERVED_OUTCOME_SOT_WRITER,
    sotMethodKey: OBSERVED_OUTCOME_SOT_METHOD_KEY,
    sliceId: OBSERVED_OUTCOME_SOT_SLICE_ID,
    hardFlags: { ...appendResult.record.hardFlags },
    limitations: [...appendResult.record.limitations],
  };
}

/**
 * Deterministic lookup by outcomeId.
 * @param {string} outcomeId
 * @param {{ store: object }} options
 */
export function getOutcomeById(outcomeId, options) {
  if (!options?.store) {
    return fail('store_required', 'Observed Outcome SoT store required for lookup');
  }
  const record = options.store.getByOutcomeId(outcomeId);
  if (!record) {
    return fail('not_found', 'Observed Outcome not found', { outcomeId });
  }
  return {
    ok: true,
    code: 'FOUND',
    record: cloneFrozenRecord(record),
    outcomeId: record.outcomeId,
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
  acceptObservedOutcome,
  createInMemoryObservedOutcomeStore,
  getOutcomeById,
  rejectUpdate,
  rejectDelete,
  getForbiddenImportMarkers,
};
