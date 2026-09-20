/**
 * Artemis Core Stage 8 — Market Context Source of Truth service (S8-MC-SOT).
 *
 * Append-only owner for attested observation envelopes.
 * Validates via S8-MC-CONTRACT; persists via injectable store (in-memory for V1 tests).
 *
 * Live PostgreSQL migration is authored separately and must NOT be executed
 * until separately authorized. This service performs zero network/provider/LLM
 * /order/wallet/runtime mutation.
 */

import { buildMarketContext } from '../contracts/artemisMarketContextContract.js';
import {
  ACCEPT_STATUS,
  MARKET_CONTEXT_SOT_WRITER,
  MARKET_CONTEXT_SOT_METHOD_KEY,
  MARKET_CONTEXT_SOT_SLICE_ID,
  buildObservationUniquenessKey,
  composeObservationRecord,
  createZeroSideEffects,
} from '../contracts/artemisMarketContextSourceOfTruthContract.js';

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
]);

/**
 * In-memory append-only observation store (canonical V1 SoT for unit/library path).
 * @returns {object}
 */
export function createInMemoryMarketContextObservationStore() {
  /** @type {Map<string, object>} */
  const byUniqueness = new Map();
  /** @type {Map<string, object>} */
  const byRowId = new Map();
  let appendCount = 0;
  let updateCount = 0;
  let deleteCount = 0;

  return Object.freeze({
    kind: 'in_memory',
    getByUniquenessKey(key) {
      return byUniqueness.get(key) ?? null;
    },
    getByObservationRowId(rowId) {
      return byRowId.get(rowId) ?? null;
    },
    /**
     * @param {object} record
     * @returns {{ status: 'inserted' | 'already_present' | 'conflict', record: object }}
     */
    append(record) {
      const existing = byUniqueness.get(record.uniquenessKey);
      if (existing) {
        if (existing.envelopeSha256 === record.envelopeSha256) {
          return { status: 'already_present', record: existing };
        }
        return { status: 'conflict', record: existing };
      }
      const frozen = Object.freeze({ ...record });
      byUniqueness.set(record.uniquenessKey, frozen);
      byRowId.set(record.observationRowId, frozen);
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
        rowCount: byUniqueness.size,
        appendCount,
        updateCount,
        deleteCount,
      };
    },
    /** Test helper — read-only snapshot of uniqueness keys. */
    listUniquenessKeys() {
      return [...byUniqueness.keys()];
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
 * Accept an attested Market Context observation envelope into the SoT.
 *
 * @param {object} input — same shape as S8-MC buildMarketContext input
 * @param {{ store?: object }} [options]
 * @returns {object}
 */
export function acceptAttestedObservation(input, options = {}) {
  const store = options.store ?? createInMemoryMarketContextObservationStore();

  const validated = buildMarketContext(input);
  if (!validated.ok) {
    return {
      ok: false,
      code: ACCEPT_STATUS.VALIDATION_FAILED,
      message: validated.message || 'Market Context validation failed',
      validationCode: validated.code,
      errors: validated.errors,
      sideEffects: createZeroSideEffects(),
      sotWriter: MARKET_CONTEXT_SOT_WRITER,
      sotMethodKey: MARKET_CONTEXT_SOT_METHOD_KEY,
      sliceId: MARKET_CONTEXT_SOT_SLICE_ID,
    };
  }

  const record = composeObservationRecord(validated.artifact);
  const appendResult = store.append(record);

  if (appendResult.status === 'conflict') {
    return {
      ok: false,
      code: ACCEPT_STATUS.CONFLICT,
      message:
        'Observation identity already exists with a different envelope payload; overwrite forbidden',
      observationRowId: appendResult.record.observationRowId,
      existingEnvelopeSha256: appendResult.record.envelopeSha256,
      attemptedEnvelopeSha256: record.envelopeSha256,
      uniquenessKey: record.uniquenessKey,
      sideEffects: createZeroSideEffects({
        sotAppendCount: 0,
        sotUpdateCount: 0,
        sotDeleteCount: 0,
      }),
      sotWriter: MARKET_CONTEXT_SOT_WRITER,
      sotMethodKey: MARKET_CONTEXT_SOT_METHOD_KEY,
      sliceId: MARKET_CONTEXT_SOT_SLICE_ID,
      hardFlags: record.hardFlags,
    };
  }

  if (appendResult.status === 'already_present') {
    return {
      ok: true,
      code: ACCEPT_STATUS.ALREADY_PRESENT,
      message: 'Identical observation already present; idempotent no-op',
      record: appendResult.record,
      marketContextRef: appendResult.record.marketContextRef,
      observationRowId: appendResult.record.observationRowId,
      marketContextId: appendResult.record.marketContextId,
      uniquenessKey: appendResult.record.uniquenessKey,
      envelopeSha256: appendResult.record.envelopeSha256,
      sideEffects: createZeroSideEffects({
        sotAppendCount: 0,
        dbWriteCount: store.kind === 'postgres' ? 0 : 0,
      }),
      sotWriter: MARKET_CONTEXT_SOT_WRITER,
      sotMethodKey: MARKET_CONTEXT_SOT_METHOD_KEY,
      sliceId: MARKET_CONTEXT_SOT_SLICE_ID,
      hardFlags: appendResult.record.hardFlags,
      limitations: appendResult.record.limitations,
    };
  }

  const isMemory = store.kind === 'in_memory';
  return {
    ok: true,
    code: ACCEPT_STATUS.ACCEPTED,
    message: 'Attested observation accepted into Market Context SoT',
    record: appendResult.record,
    marketContextRef: appendResult.record.marketContextRef,
    observationRowId: appendResult.record.observationRowId,
    marketContextId: appendResult.record.marketContextId,
    uniquenessKey: appendResult.record.uniquenessKey,
    envelopeSha256: appendResult.record.envelopeSha256,
    sideEffects: createZeroSideEffects({
      sotAppendCount: 1,
      // In-memory SoT counts as dedicated store write (not external DB/Redis/network).
      dbWriteCount: isMemory ? 0 : 1,
    }),
    sotWriter: MARKET_CONTEXT_SOT_WRITER,
    sotMethodKey: MARKET_CONTEXT_SOT_METHOD_KEY,
    sliceId: MARKET_CONTEXT_SOT_SLICE_ID,
    hardFlags: appendResult.record.hardFlags,
    limitations: appendResult.record.limitations,
  };
}

/**
 * Deterministic lookup by durable observation row id.
 * @param {string} observationRowId
 * @param {{ store: object }} options
 */
export function getObservationByRowId(observationRowId, options) {
  if (!options?.store) {
    return fail('store_required', 'Market Context SoT store required for lookup');
  }
  const record = options.store.getByObservationRowId(observationRowId);
  if (!record) {
    return fail('not_found', 'Observation row not found', { observationRowId });
  }
  return {
    ok: true,
    code: 'FOUND',
    record,
    marketContextRef: record.marketContextRef,
    sideEffects: createZeroSideEffects(),
  };
}

/**
 * Deterministic lookup by Owner-locked uniqueness tuple.
 * @param {object} uniquenessParts
 * @param {{ store: object }} options
 */
export function getObservationByUniqueness(uniquenessParts, options) {
  if (!options?.store) {
    return fail('store_required', 'Market Context SoT store required for lookup');
  }
  const key = buildObservationUniquenessKey(uniquenessParts);
  const record = options.store.getByUniquenessKey(key);
  if (!record) {
    return fail('not_found', 'Observation uniqueness not found', { uniquenessKey: key });
  }
  return {
    ok: true,
    code: 'FOUND',
    record,
    marketContextRef: record.marketContextRef,
    uniquenessKey: key,
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
  acceptAttestedObservation,
  createInMemoryMarketContextObservationStore,
  getObservationByRowId,
  getObservationByUniqueness,
  rejectUpdate,
  rejectDelete,
};
