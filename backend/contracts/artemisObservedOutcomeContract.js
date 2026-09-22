/**
 * Artemis Core Stage 8 — Observed Outcome Contract Boundary
 * (S8-OBSERVED-OUTCOME-CONTRACT).
 *
 * Deterministic, non-executing, library-only validation/composition of an
 * Observed Outcome artifact: what was observed after the Shadow decision
 * horizon.
 *
 * Ownership (explicit):
 *   - This module is a VALIDATION BOUNDARY / schema owner for Observed Outcome.
 *   - It is NOT an Outcome Source of Truth.
 *   - It is NOT a persistence owner.
 *   - Outcome Evaluation remains DEFERRED.
 *   - realizedPnl is UNSUPPORTED / FORBIDDEN for non-executing Shadow.
 *
 * Separates:
 *   Decision  ≠  Observed Outcome  ≠  Outcome Evaluation  ≠  Realized Financial Result
 *
 * Does NOT:
 *   - fetch market data / call exchanges / market proxy / MEXC / CCXT / providers
 *   - write DB / Redis / network / LLM
 *   - activate Shadow Worker / Scheduler / global Shadow Runtime
 *   - activate B10 / Outcome persistence
 *   - calculate PnL / ROI / fills / wallet results
 *   - evaluate / calibrate / score strategies
 *   - modify C8.1 / C.1–C.6 / Decision / Context / Evidence / Control Chain /
 *     S8-MC / Task State / Binding / Activation
 */

import {
  AVAILABILITY,
  CORRELATION_FAMILY,
  FRESHNESS_STATUS,
  MARKET_TYPE,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import { DECISION_CONTRACT_VERSION } from './artemisDecisionContract.js';
import { DECISION_CONTEXT_CONTRACT_VERSION } from './artemisDecisionContextContract.js';
import {
  MARKET_CONTEXT_CONTRACT_VERSION,
  MARKET_SOURCE_CLASS,
  USABLE_FRESHNESS,
} from './artemisMarketContextContract.js';
import { SHADOW_RECORDING_CONTRACT_VERSION } from './artemisShadowDecisionRecordingBoundaryContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from './artemisShadowRuntimeLibraryBoundaryContract.js';
import { SHADOW_TASK_STATE_CONTRACT_VERSION } from './artemisShadowTaskStateBoundaryContract.js';
import { SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION } from './artemisShadowTaskCycleCompositionBoundaryContract.js';

/** Thin marketContextRef allowlist — matches S8-MC / C8.1 (not exported by MC). */
const ALLOWED_MARKET_CONTEXT_REF = Object.freeze([
  'marketContextId',
  'contractVersion',
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'freshnessStatus',
  'sourceTimestamp',
  'availability',
]);

export const OBSERVED_OUTCOME_STAGE =
  'ARTEMIS_CORE_STAGE_8_OBSERVED_OUTCOME_CONTRACT_BOUNDARY';
export const OBSERVED_OUTCOME_SLICE_ID = 'S8-OBSERVED-OUTCOME-CONTRACT';
export const OBSERVED_OUTCOME_SCHEMA_VERSION = '1.0.0';
export const OBSERVED_OUTCOME_CONTRACT_VERSION =
  'artemis-observed-outcome-1.0.0';
export const OBSERVED_OUTCOME_POLICY_VERSION =
  'stage8-observed-outcome-contract-1.0.0';
export const OBSERVED_OUTCOME_WRITER = 'artemisObservedOutcomeContract';
export const OBSERVED_OUTCOME_METHOD_KEY =
  'build_observed_outcome_fail_closed';
export const OBSERVED_OUTCOME_ARTIFACT_TYPE = 'OBSERVED_OUTCOME';
export const OBSERVED_OUTCOME_AUTHORITY_CLASS = 'OBSERVED_OUTCOME';

/** Explicit SoT ownership — contract is validation boundary only. */
export const OBSERVED_OUTCOME_SOT_STATUS = 'MISSING';
export const NEW_SOT_OWNER_REQUIRED = false;
export const OBSERVED_OUTCOME_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const OUTCOME_EVALUATION_STATUS = 'DEFERRED';
export const REALIZED_PNL_STATUS = 'UNSUPPORTED_FOR_SHADOW';

export const MAX_OBSERVED_OUTCOME_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 256;

export const ZERO_OBSERVED_OUTCOME_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  networkRequestCount: 0,
  providerRequestCount: 0,
  llmCallCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  runtimeMutationCount: 0,
  emergencyStopClearCount: 0,
  agentExecutionCount: 0,
  dbWrites: 0,
  redisWrites: 0,
  network: 0,
  provider: 0,
  llm: 0,
  orders: 0,
  wallet: 0,
  financialExecution: 0,
  runtimeMutation: 0,
  worker: 0,
  scheduler: 0,
  queue: 0,
  lease: 0,
  lock: 0,
  b10: 0,
  feeder: 0,
  persistence: 0,
  outcomeEvaluation: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  liveTradingEnabled: false,
  paperTradingEnabled: false,
  providerConnected: false,
  shadowRuntimeActivated: false,
  persistenceEnabled: false,
  b10WriteAttempted: false,
});

export const OBSERVED_OUTCOME_LIMITATIONS = Object.freeze([
  'stage8_observed_outcome_contract_boundary_only',
  'library_only',
  'in_memory_only',
  'deterministic_non_executing',
  'validation_boundary_not_sot',
  'persistence_not_enabled',
  'outcome_evaluation_deferred',
  'realized_pnl_unsupported_for_shadow',
  'references_only_no_embedded_payloads',
  'post_horizon_market_context_ref_only',
  'does_not_fetch_market_data',
  'does_not_activate_worker_or_scheduler',
  'does_not_activate_global_shadow_runtime',
  'does_not_activate_b10',
  'does_not_authorize_execution',
  'does_not_call_llm_or_provider',
  'does_not_write_db_or_redis',
  'append_only_post_decision_semantics',
  'lookahead_protection',
  'outcome_recorded_means_in_memory_composition_only',
]);

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));

const ALLOWED_INPUT_TOP = Object.freeze([
  'decisionRef',
  'decisionContextRef',
  'shadowRecordingRef',
  'marketContextRef',
  'taskRef',
  'cycleBindingRef',
  'shadowCycleEnvelopeRef',
  'outcomeObservedAt',
  'recordedAt',
  'correlationId',
  'lineage',
  'provenance',
  'outcomeId',
  'implementationVersion',
  'outcomeRecorded',
  ...HARD_FLAG_KEYS,
]);

const ALLOWED_ARTIFACT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'authorityClass',
  'sliceId',
  'outcomeId',
  'outcomeObservedAt',
  'recordedAt',
  'correlationId',
  'decisionRef',
  'decisionContextRef',
  'shadowRecordingRef',
  'marketContextRef',
  'taskRef',
  'cycleBindingRef',
  'shadowCycleEnvelopeRef',
  'lineage',
  'provenance',
  'limitations',
  'sideEffects',
  'outcomeRecorded',
  'outcomeEvaluationStatus',
  'realizedPnlStatus',
  'sotStatus',
  'ownershipRole',
  'implementationVersion',
  ...HARD_FLAG_KEYS,
]);

const ALLOWED_DECISION_REF = Object.freeze([
  'decisionId',
  'contractVersion',
  'decisionContextId',
  'analysisAt',
  'createdAt',
]);

const ALLOWED_CONTEXT_REF = Object.freeze([
  'contextId',
  'contractVersion',
  'lifecycleState',
  'mode',
]);

const ALLOWED_SHADOW_RECORDING_REF = Object.freeze([
  'shadowRecordingArtifactId',
  'contractVersion',
]);

const ALLOWED_TASK_REF = Object.freeze([
  'taskId',
  'contractVersion',
  'attempt',
  'status',
]);

const ALLOWED_CYCLE_BINDING_REF = Object.freeze([
  'bindingId',
  'contractVersion',
]);

const ALLOWED_CYCLE_ENVELOPE_REF = Object.freeze([
  'shadowCycleEnvelopeId',
  'contractVersion',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'decisionId',
  'decisionContextId',
  'shadowRecordingArtifactId',
  'marketContextId',
  'taskId',
  'bindingId',
  'shadowCycleEnvelopeId',
  'outcomeId',
  'decisionContractVersion',
  'decisionContextContractVersion',
  'shadowRecordingContractVersion',
  'marketContextContractVersion',
  'shadowTaskStateContractVersion',
  'shadowTaskCycleBindingContractVersion',
  'shadowRuntimeContractVersion',
  'observedOutcomeContractVersion',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'sourceClass',
  'correlationFamily',
  'sourceTimestamp',
  'ingestionTimestamp',
  'policyVersion',
  'implementationVersion',
  'note',
]);

const FORBIDDEN_KEYS = Object.freeze([
  'order',
  'orderId',
  'executionIntent',
  'executionCommand',
  'wallet',
  'walletAction',
  'transfer',
  'withdrawal',
  'financialExecution',
  'realizedPnl',
  'realizedDirection',
  'fill',
  'fillPrice',
  'providerPayload',
  'signedQuery',
  'credentials',
  'apiKey',
  'apiSecret',
  'ohlcv',
  'OHLCV',
  'ticker',
  'orderBook',
  'candles',
  'depth',
  'rawSeries',
  'marketSnapshot',
  'bid',
  'ask',
  'spread',
  'observedOutcome',
  'evaluationResult',
  'calibrationScore',
  'performanceScore',
  'strategyScore',
  'qualityScore',
  'ranking',
  'winner',
  'loser',
  'recommendation',
  'promotion',
  'probabilityAdjustment',
  'lookahead',
  'lookAhead',
  'runId',
  'workerId',
  'lease',
  'lock',
  'queueState',
  'schedulerState',
  'scheduleAt',
  'cron',
  'PM2',
  'b10',
  'shadowWorker',
  'shadowScheduler',
  'requestedRuntimeMode',
  'effectiveRuntimeMode',
  'emergencyStopClear',
  'profit',
  'loss',
  'roi',
  'ROI',
  'return',
  'PnL',
  'pnl',
  'place_order',
  'cancel_order',
  'modify_order',
  'prompt',
  'modelResponse',
  'raw',
  'payload',
  'freshnessClaim',
  'simulatedAsRealized',
  'decision',
  'decisionContext',
  'evidenceOrchestrationSet',
  'controlChainArtifact',
  'marketContext',
]);

const MARKET_CONTAMINATION_KEYS = Object.freeze([
  'marketSnapshot',
  'ohlcv',
  'OHLCV',
  'ticker',
  'orderBook',
  'candles',
  'depth',
  'bid',
  'ask',
  'spread',
  'rawSeries',
  'freshnessClaim',
]);

const EVALUATION_CONTAMINATION_KEYS = Object.freeze([
  'evaluationResult',
  'calibrationScore',
  'performanceScore',
  'strategyScore',
  'qualityScore',
  'ranking',
  'winner',
  'loser',
  'recommendation',
  'promotion',
  'probabilityAdjustment',
  'lookahead',
  'lookAhead',
]);

const USABLE_FRESHNESS_SET = new Set(USABLE_FRESHNESS);
const MARKET_TYPE_SET = new Set(Object.values(MARKET_TYPE));
const AVAILABILITY_SET = new Set(Object.values(AVAILABILITY));
const FRESHNESS_SET = new Set(Object.values(FRESHNESS_STATUS));
const SOURCE_CLASS_SET = new Set(Object.values(MARKET_SOURCE_CLASS));
const CORRELATION_SET = new Set(Object.values(CORRELATION_FAMILY));

function fail(code, message, extra = {}) {
  return { ok: false, code, message, artifact: null, ...extra };
}

function freezeDeep(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
}

function assertAllowlist(obj, allowed, field, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push({ field, code: 'required_object' });
    return false;
  }
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
  const unknownKeys = Object.keys(obj).filter((key) => !allowedSet.has(key));
  if (unknownKeys.length) {
    unknownKeys.forEach((key) => errors.push({ field: `${field}.${key}`, code: 'unknown_field' }));
    return false;
  }
  return true;
}

function assertString(field, value, errors, { required = false, max = MAX_STRING_CHARS } = {}) {
  if (value == null || value === '') {
    if (required) errors.push({ field, code: 'required_string' });
    return;
  }
  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid_string' });
    return;
  }
  if (value.length > max) errors.push({ field, code: 'string_too_long', max });
}

function hashToUuid(parts) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i += 1) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= text.charCodeAt(text.length - 1 - i);
    h2 = Math.imul(h2, 0x01000193);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex = `${a}${b}${a}${b}`.slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function parseIsoMs(value) {
  return Date.parse(value);
}

function collectForbiddenKeysDeep(value, acc = [], prefix = '') {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectForbiddenKeysDeep(value[i], acc, prefix ? `${prefix}[${i}]` : `[${i}]`);
    }
    return acc;
  }
  for (const key of Object.keys(value)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    if (FORBIDDEN_KEYS.includes(key)
      || MARKET_CONTAMINATION_KEYS.includes(key)
      || EVALUATION_CONTAMINATION_KEYS.includes(key)) {
      acc.push(fieldPath);
    }
    collectForbiddenKeysDeep(value[key], acc, fieldPath);
  }
  return acc;
}

function validateHardFlagsOnInput(input, errors) {
  for (const key of HARD_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== false) {
      errors.push({ field: key, code: 'hard_flag_must_be_false' });
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'outcomeRecorded')
    && input.outcomeRecorded !== true
    && input.outcomeRecorded !== false) {
    errors.push({ field: 'outcomeRecorded', code: 'invalid_boolean' });
  }
}

function decisionTimeMs(decisionRef) {
  if (isIsoTimestamp(decisionRef.analysisAt)) return parseIsoMs(decisionRef.analysisAt);
  if (isIsoTimestamp(decisionRef.createdAt)) return parseIsoMs(decisionRef.createdAt);
  return null;
}

function validateDecisionRef(ref, errors) {
  if (!assertAllowlist(ref, ALLOWED_DECISION_REF, 'decisionRef', errors)) return null;
  if (!isCanonicalUuid(ref.decisionId)) {
    errors.push({ field: 'decisionRef.decisionId', code: 'invalid_decision_id' });
  }
  if (ref.contractVersion !== DECISION_CONTRACT_VERSION) {
    errors.push({
      field: 'decisionRef.contractVersion',
      code: 'incompatible_decision_contract',
      expected: DECISION_CONTRACT_VERSION,
    });
  }
  if (!isCanonicalUuid(ref.decisionContextId)) {
    errors.push({ field: 'decisionRef.decisionContextId', code: 'invalid_decision_context_id' });
  }
  if (ref.analysisAt != null && !isIsoTimestamp(ref.analysisAt)) {
    errors.push({ field: 'decisionRef.analysisAt', code: 'invalid_iso_timestamp' });
  }
  if (ref.createdAt != null && !isIsoTimestamp(ref.createdAt)) {
    errors.push({ field: 'decisionRef.createdAt', code: 'invalid_iso_timestamp' });
  }
  if (ref.analysisAt == null && ref.createdAt == null) {
    errors.push({ field: 'decisionRef', code: 'required_decision_timestamp' });
  }
  return ref;
}

function validateDecisionContextRef(ref, decisionRef, errors) {
  if (!assertAllowlist(ref, ALLOWED_CONTEXT_REF, 'decisionContextRef', errors)) return null;
  if (!isCanonicalUuid(ref.contextId)) {
    errors.push({ field: 'decisionContextRef.contextId', code: 'invalid_context_id' });
  }
  if (ref.contractVersion !== DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'decisionContextRef.contractVersion',
      code: 'incompatible_decision_context_contract',
      expected: DECISION_CONTEXT_CONTRACT_VERSION,
    });
  }
  if (decisionRef && isCanonicalUuid(decisionRef.decisionContextId)
    && isCanonicalUuid(ref.contextId)
    && decisionRef.decisionContextId !== ref.contextId) {
    errors.push({ field: 'decisionContextRef.contextId', code: 'context_id_mismatch' });
  }
  if (ref.lifecycleState != null) {
    assertString('decisionContextRef.lifecycleState', ref.lifecycleState, errors);
  }
  if (ref.mode != null && typeof ref.mode === 'object' && !Array.isArray(ref.mode)) {
    // thin opaque mode object — reject contamination only
    for (const key of FORBIDDEN_KEYS) {
      if (Object.prototype.hasOwnProperty.call(ref.mode, key)) {
        errors.push({ field: `decisionContextRef.mode.${key}`, code: 'forbidden_field' });
      }
    }
  } else if (ref.mode != null && typeof ref.mode !== 'object') {
    errors.push({ field: 'decisionContextRef.mode', code: 'invalid_mode' });
  }
  return ref;
}

function validateShadowRecordingRef(ref, errors) {
  if (!assertAllowlist(ref, ALLOWED_SHADOW_RECORDING_REF, 'shadowRecordingRef', errors)) {
    return null;
  }
  if (!isCanonicalUuid(ref.shadowRecordingArtifactId)) {
    errors.push({
      field: 'shadowRecordingRef.shadowRecordingArtifactId',
      code: 'invalid_shadow_recording_id',
    });
  }
  if (ref.contractVersion !== SHADOW_RECORDING_CONTRACT_VERSION) {
    errors.push({
      field: 'shadowRecordingRef.contractVersion',
      code: 'incompatible_shadow_recording_contract',
      expected: SHADOW_RECORDING_CONTRACT_VERSION,
    });
  }
  return ref;
}

function validateOptionalTaskRef(ref, errors) {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_TASK_REF, 'taskRef', errors)) return null;
  if (!isCanonicalUuid(ref.taskId)) {
    errors.push({ field: 'taskRef.taskId', code: 'invalid_task_id' });
  }
  if (ref.contractVersion !== SHADOW_TASK_STATE_CONTRACT_VERSION) {
    errors.push({
      field: 'taskRef.contractVersion',
      code: 'incompatible_shadow_task_state_contract',
      expected: SHADOW_TASK_STATE_CONTRACT_VERSION,
    });
  }
  if (ref.attempt != null) {
    if (typeof ref.attempt !== 'number' || !Number.isInteger(ref.attempt) || ref.attempt < 1) {
      errors.push({ field: 'taskRef.attempt', code: 'invalid_attempt' });
    }
  }
  if (ref.status != null) assertString('taskRef.status', ref.status, errors);
  return ref;
}

function validateOptionalCycleBindingRef(ref, errors) {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_CYCLE_BINDING_REF, 'cycleBindingRef', errors)) return null;
  if (!isCanonicalUuid(ref.bindingId)) {
    errors.push({ field: 'cycleBindingRef.bindingId', code: 'invalid_binding_id' });
  }
  if (ref.contractVersion !== SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION) {
    errors.push({
      field: 'cycleBindingRef.contractVersion',
      code: 'incompatible_shadow_task_cycle_binding_contract',
      expected: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    });
  }
  return ref;
}

function validateOptionalCycleEnvelopeRef(ref, errors) {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_CYCLE_ENVELOPE_REF, 'shadowCycleEnvelopeRef', errors)) {
    return null;
  }
  if (!isCanonicalUuid(ref.shadowCycleEnvelopeId)) {
    errors.push({
      field: 'shadowCycleEnvelopeRef.shadowCycleEnvelopeId',
      code: 'invalid_shadow_cycle_envelope_id',
    });
  }
  if (ref.contractVersion !== SHADOW_RUNTIME_CONTRACT_VERSION) {
    errors.push({
      field: 'shadowCycleEnvelopeRef.contractVersion',
      code: 'incompatible_shadow_runtime_contract',
      expected: SHADOW_RUNTIME_CONTRACT_VERSION,
    });
  }
  return ref;
}

function validateMarketContextRef(ref, decisionMs, outcomeObservedAt, errors) {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    errors.push({ field: 'marketContextRef', code: 'required_object' });
    return null;
  }
  for (const key of MARKET_CONTAMINATION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(ref, key)) {
      errors.push({ field: `marketContextRef.${key}`, code: 'market_contamination' });
    }
  }
  for (const key of EVALUATION_CONTAMINATION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(ref, key)) {
      errors.push({ field: `marketContextRef.${key}`, code: 'evaluation_contamination' });
    }
  }
  for (const key of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(ref, key)) {
      errors.push({ field: `marketContextRef.${key}`, code: 'forbidden_field' });
    }
  }
  if (!assertAllowlist(ref, ALLOWED_MARKET_CONTEXT_REF, 'marketContextRef', errors)) {
    return null;
  }
  if (!isCanonicalUuid(ref.marketContextId)) {
    errors.push({ field: 'marketContextRef.marketContextId', code: 'invalid_market_context_id' });
  }
  if (ref.contractVersion !== MARKET_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'marketContextRef.contractVersion',
      code: 'incompatible_market_context_contract',
      expected: MARKET_CONTEXT_CONTRACT_VERSION,
    });
  }
  assertString('marketContextRef.venue', ref.venue, errors, { required: true });
  assertString('marketContextRef.symbol', ref.symbol, errors, { required: true });
  assertString('marketContextRef.timeframe', ref.timeframe, errors, { required: true });
  if (ref.marketType == null || ref.marketType === '') {
    errors.push({ field: 'marketContextRef.marketType', code: 'required_market_type' });
  } else if (!MARKET_TYPE_SET.has(ref.marketType)) {
    errors.push({ field: 'marketContextRef.marketType', code: 'invalid_market_type' });
  }
  if (ref.freshnessStatus == null || ref.freshnessStatus === '') {
    errors.push({ field: 'marketContextRef.freshnessStatus', code: 'required_freshness' });
  } else if (!FRESHNESS_SET.has(ref.freshnessStatus)) {
    errors.push({ field: 'marketContextRef.freshnessStatus', code: 'invalid_freshness' });
  } else if (!USABLE_FRESHNESS_SET.has(ref.freshnessStatus)) {
    errors.push({ field: 'marketContextRef.freshnessStatus', code: 'unusable_freshness' });
  }
  if (ref.availability == null || ref.availability === '') {
    errors.push({ field: 'marketContextRef.availability', code: 'required_availability' });
  } else if (!AVAILABILITY_SET.has(ref.availability)) {
    errors.push({ field: 'marketContextRef.availability', code: 'invalid_availability' });
  } else if (ref.availability !== AVAILABILITY.AVAILABLE) {
    errors.push({ field: 'marketContextRef.availability', code: 'unavailable_market_context' });
  }
  if (!isIsoTimestamp(ref.sourceTimestamp)) {
    errors.push({
      field: 'marketContextRef.sourceTimestamp',
      code: ref.sourceTimestamp == null ? 'required_source_timestamp' : 'invalid_iso_timestamp',
    });
  } else {
    const sourceMs = parseIsoMs(ref.sourceTimestamp);
    if (decisionMs != null && sourceMs < decisionMs) {
      errors.push({
        field: 'marketContextRef.sourceTimestamp',
        code: 'pre_decision_source_timestamp',
      });
    }
    if (isIsoTimestamp(outcomeObservedAt)) {
      const observedMs = parseIsoMs(outcomeObservedAt);
      if (sourceMs > observedMs) {
        errors.push({
          field: 'marketContextRef.sourceTimestamp',
          code: 'source_timestamp_after_outcome_observed_at',
        });
      }
    }
  }
  return ref;
}

function validateLineage(lineage, refs, computedOutcomeId, errors) {
  if (lineage == null) return null;
  if (!assertAllowlist(lineage, ALLOWED_LINEAGE, 'lineage', errors)) return null;

  const checks = [
    ['decisionId', refs.decisionRef?.decisionId, 'decision_id_mismatch'],
    ['decisionContextId', refs.decisionContextRef?.contextId, 'context_id_mismatch'],
    ['shadowRecordingArtifactId', refs.shadowRecordingRef?.shadowRecordingArtifactId, 'shadow_recording_id_mismatch'],
    ['marketContextId', refs.marketContextRef?.marketContextId, 'market_context_id_mismatch'],
    ['taskId', refs.taskRef?.taskId, 'task_id_mismatch'],
    ['bindingId', refs.cycleBindingRef?.bindingId, 'binding_id_mismatch'],
    ['shadowCycleEnvelopeId', refs.shadowCycleEnvelopeRef?.shadowCycleEnvelopeId, 'shadow_cycle_envelope_id_mismatch'],
  ];
  for (const [field, expected, code] of checks) {
    if (lineage[field] != null) {
      if (!isCanonicalUuid(lineage[field])) {
        errors.push({ field: `lineage.${field}`, code: 'invalid_uuid' });
      } else if (expected != null && lineage[field] !== expected) {
        errors.push({ field: `lineage.${field}`, code });
      }
    }
  }
  if (lineage.outcomeId != null) {
    if (!isCanonicalUuid(lineage.outcomeId)) {
      errors.push({ field: 'lineage.outcomeId', code: 'invalid_uuid' });
    } else if (lineage.outcomeId !== computedOutcomeId) {
      errors.push({ field: 'lineage.outcomeId', code: 'outcome_id_conflict' });
    }
  }
  return lineage;
}

function validateProvenance(provenance, recordedAt, marketContextRef, errors) {
  if (provenance == null) {
    return {
      writer: OBSERVED_OUTCOME_WRITER,
      methodKey: OBSERVED_OUTCOME_METHOD_KEY,
      stage: OBSERVED_OUTCOME_STAGE,
      recordedAt,
      policyVersion: OBSERVED_OUTCOME_POLICY_VERSION,
      sourceTimestamp: marketContextRef?.sourceTimestamp,
    };
  }
  if (!assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors)) return null;
  assertString('provenance.writer', provenance.writer, errors, { required: true });
  assertString('provenance.methodKey', provenance.methodKey, errors, { required: true });
  assertString('provenance.stage', provenance.stage, errors, { required: true });
  if (provenance.recordedAt != null && !isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_iso_timestamp' });
  }
  if (provenance.sourceTimestamp != null) {
    if (!isIsoTimestamp(provenance.sourceTimestamp)) {
      errors.push({ field: 'provenance.sourceTimestamp', code: 'invalid_iso_timestamp' });
    } else if (marketContextRef?.sourceTimestamp
      && provenance.sourceTimestamp !== marketContextRef.sourceTimestamp) {
      errors.push({
        field: 'provenance.sourceTimestamp',
        code: 'source_timestamp_inconsistency',
      });
    }
  }
  if (provenance.ingestionTimestamp != null && !isIsoTimestamp(provenance.ingestionTimestamp)) {
    errors.push({ field: 'provenance.ingestionTimestamp', code: 'invalid_iso_timestamp' });
  }
  if (provenance.sourceClass != null && !SOURCE_CLASS_SET.has(provenance.sourceClass)) {
    errors.push({ field: 'provenance.sourceClass', code: 'invalid_source_class' });
  }
  if (provenance.correlationFamily != null && !CORRELATION_SET.has(provenance.correlationFamily)) {
    errors.push({ field: 'provenance.correlationFamily', code: 'invalid_correlation_family' });
  }
  return provenance;
}

/**
 * Compose/validate one Observed Outcome artifact (library-only).
 *
 * @param {object} input
 * @returns {{ ok: true, code: string, message: string, artifact: object, sideEffects: object, bytes: number }
 *   | { ok: false, code: string, message: string, artifact: null, errors?: object[] }}
 */
export function buildObservedOutcome(input = {}) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Observed Outcome input object required');
  }

  // Forbidden / contamination keys fail closed before generic unknown-field handling
  // so Owner-required forbidden_field codes are preserved for explicit denylist keys.
  const forbiddenHits = collectForbiddenKeysDeep(input);
  for (const key of forbiddenHits) {
    errors.push({ field: key, code: 'forbidden_field' });
  }
  const secretHits = collectForbiddenSecretKeys(input);
  for (const key of secretHits) {
    errors.push({ field: key, code: 'secret_field_forbidden' });
  }
  if (errors.length) {
    return fail('forbidden_field', 'Observed Outcome input contains forbidden fields', { errors });
  }

  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Observed Outcome input contains unknown fields', { errors });
  }

  validateHardFlagsOnInput(input, errors);

  if (input.decisionRef == null) {
    errors.push({ field: 'decisionRef', code: 'required_object' });
  }
  if (input.decisionContextRef == null) {
    errors.push({ field: 'decisionContextRef', code: 'required_object' });
  }
  if (input.shadowRecordingRef == null) {
    errors.push({ field: 'shadowRecordingRef', code: 'required_object' });
  }
  if (input.marketContextRef == null) {
    errors.push({ field: 'marketContextRef', code: 'required_object' });
  }
  if (!isIsoTimestamp(input.outcomeObservedAt)) {
    errors.push({
      field: 'outcomeObservedAt',
      code: input.outcomeObservedAt == null
        ? 'required_outcome_observed_at'
        : 'invalid_iso_timestamp',
    });
  }
  if (!isIsoTimestamp(input.recordedAt)) {
    errors.push({
      field: 'recordedAt',
      code: input.recordedAt == null ? 'required_recorded_at' : 'invalid_iso_timestamp',
    });
  }
  if (input.correlationId != null && !isCanonicalUuid(input.correlationId)) {
    errors.push({ field: 'correlationId', code: 'invalid_uuid' });
  }
  if (input.implementationVersion != null) {
    assertString('implementationVersion', input.implementationVersion, errors);
  }

  const decisionRef = input.decisionRef != null
    ? validateDecisionRef(input.decisionRef, errors)
    : null;
  const decisionContextRef = input.decisionContextRef != null
    ? validateDecisionContextRef(input.decisionContextRef, decisionRef, errors)
    : null;
  const shadowRecordingRef = input.shadowRecordingRef != null
    ? validateShadowRecordingRef(input.shadowRecordingRef, errors)
    : null;
  const taskRef = validateOptionalTaskRef(input.taskRef, errors);
  const cycleBindingRef = validateOptionalCycleBindingRef(input.cycleBindingRef, errors);
  const shadowCycleEnvelopeRef = validateOptionalCycleEnvelopeRef(
    input.shadowCycleEnvelopeRef,
    errors,
  );

  const decisionMs = decisionRef ? decisionTimeMs(decisionRef) : null;
  if (isIsoTimestamp(input.outcomeObservedAt) && decisionMs != null) {
    const observedMs = parseIsoMs(input.outcomeObservedAt);
    if (observedMs < decisionMs) {
      errors.push({ field: 'outcomeObservedAt', code: 'pre_decision_outcome_observed_at' });
    }
  }
  if (isIsoTimestamp(input.outcomeObservedAt) && isIsoTimestamp(input.recordedAt)) {
    const observedMs = parseIsoMs(input.outcomeObservedAt);
    const recordedMs = parseIsoMs(input.recordedAt);
    if (observedMs > recordedMs) {
      errors.push({
        field: 'outcomeObservedAt',
        code: 'outcome_observed_at_after_recorded_at',
      });
    }
  }

  const marketContextRef = input.marketContextRef != null
    ? validateMarketContextRef(
      input.marketContextRef,
      decisionMs,
      input.outcomeObservedAt,
      errors,
    )
    : null;

  // Identity inputs must be present and valid before hashing.
  const identityReady = decisionRef
    && isCanonicalUuid(decisionRef.decisionId)
    && isCanonicalUuid(decisionRef.decisionContextId)
    && shadowRecordingRef
    && isCanonicalUuid(shadowRecordingRef.shadowRecordingArtifactId)
    && marketContextRef
    && isCanonicalUuid(marketContextRef.marketContextId)
    && isIsoTimestamp(input.outcomeObservedAt)
    && isIsoTimestamp(marketContextRef.sourceTimestamp);

  if (!identityReady && !errors.some((e) => e.code === 'missing_outcome_identity_inputs')) {
    if (!(decisionRef && shadowRecordingRef && marketContextRef
      && isIsoTimestamp(input.outcomeObservedAt))) {
      errors.push({ field: 'outcomeId', code: 'missing_outcome_identity_inputs' });
    }
  }

  let computedOutcomeId = null;
  if (identityReady) {
    computedOutcomeId = hashToUuid([
      OBSERVED_OUTCOME_CONTRACT_VERSION,
      decisionRef.decisionId,
      decisionRef.decisionContextId,
      shadowRecordingRef.shadowRecordingArtifactId,
      marketContextRef.marketContextId,
      input.outcomeObservedAt,
      marketContextRef.sourceTimestamp,
      taskRef?.taskId || '',
      cycleBindingRef?.bindingId || '',
      shadowCycleEnvelopeRef?.shadowCycleEnvelopeId || '',
    ]);
    if (input.outcomeId != null) {
      if (!isCanonicalUuid(input.outcomeId)) {
        errors.push({ field: 'outcomeId', code: 'invalid_outcome_id' });
      } else if (input.outcomeId !== computedOutcomeId) {
        errors.push({ field: 'outcomeId', code: 'outcome_id_conflict' });
      }
    }
  } else if (input.outcomeId != null) {
    if (!isCanonicalUuid(input.outcomeId)) {
      errors.push({ field: 'outcomeId', code: 'invalid_outcome_id' });
    } else {
      errors.push({ field: 'outcomeId', code: 'outcome_id_without_identity_inputs' });
    }
  }

  const refs = {
    decisionRef,
    decisionContextRef,
    shadowRecordingRef,
    marketContextRef,
    taskRef,
    cycleBindingRef,
    shadowCycleEnvelopeRef,
  };
  const lineage = validateLineage(
    input.lineage,
    refs,
    computedOutcomeId,
    errors,
  );
  const provenance = validateProvenance(
    input.provenance,
    input.recordedAt,
    marketContextRef,
    errors,
  );

  if (errors.length) {
    return fail('OBSERVED_OUTCOME_REJECTED', 'Observed Outcome validation failed', { errors });
  }

  const artifact = {
    schemaVersion: OBSERVED_OUTCOME_SCHEMA_VERSION,
    contractVersion: OBSERVED_OUTCOME_CONTRACT_VERSION,
    policyVersion: OBSERVED_OUTCOME_POLICY_VERSION,
    artifactType: OBSERVED_OUTCOME_ARTIFACT_TYPE,
    authorityClass: OBSERVED_OUTCOME_AUTHORITY_CLASS,
    sliceId: OBSERVED_OUTCOME_SLICE_ID,
    outcomeId: computedOutcomeId,
    outcomeObservedAt: input.outcomeObservedAt,
    recordedAt: input.recordedAt,
    decisionRef: { ...decisionRef },
    decisionContextRef: { ...decisionContextRef },
    shadowRecordingRef: { ...shadowRecordingRef },
    marketContextRef: { ...marketContextRef },
    lineage: {
      decisionId: decisionRef.decisionId,
      decisionContextId: decisionContextRef.contextId,
      shadowRecordingArtifactId: shadowRecordingRef.shadowRecordingArtifactId,
      marketContextId: marketContextRef.marketContextId,
      outcomeId: computedOutcomeId,
      decisionContractVersion: DECISION_CONTRACT_VERSION,
      decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
      marketContextContractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
      observedOutcomeContractVersion: OBSERVED_OUTCOME_CONTRACT_VERSION,
      ...(taskRef ? {
        taskId: taskRef.taskId,
        shadowTaskStateContractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
      } : {}),
      ...(cycleBindingRef ? {
        bindingId: cycleBindingRef.bindingId,
        shadowTaskCycleBindingContractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
      } : {}),
      ...(shadowCycleEnvelopeRef ? {
        shadowCycleEnvelopeId: shadowCycleEnvelopeRef.shadowCycleEnvelopeId,
        shadowRuntimeContractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
      } : {}),
      ...(lineage || {}),
    },
    provenance: {
      writer: provenance.writer || OBSERVED_OUTCOME_WRITER,
      methodKey: provenance.methodKey || OBSERVED_OUTCOME_METHOD_KEY,
      stage: provenance.stage || OBSERVED_OUTCOME_STAGE,
      recordedAt: provenance.recordedAt || input.recordedAt,
      policyVersion: provenance.policyVersion || OBSERVED_OUTCOME_POLICY_VERSION,
      sourceTimestamp: provenance.sourceTimestamp || marketContextRef.sourceTimestamp,
      ...(provenance.sourceClass != null ? { sourceClass: provenance.sourceClass } : {}),
      ...(provenance.correlationFamily != null
        ? { correlationFamily: provenance.correlationFamily }
        : {}),
      ...(provenance.ingestionTimestamp != null
        ? { ingestionTimestamp: provenance.ingestionTimestamp }
        : {}),
      ...(provenance.implementationVersion != null
        ? { implementationVersion: provenance.implementationVersion }
        : {}),
      ...(provenance.note != null ? { note: provenance.note } : {}),
      ...(input.implementationVersion != null && provenance.implementationVersion == null
        ? { implementationVersion: input.implementationVersion }
        : {}),
    },
    limitations: [...OBSERVED_OUTCOME_LIMITATIONS],
    sideEffects: { ...ZERO_OBSERVED_OUTCOME_SIDE_EFFECTS },
    outcomeRecorded: true,
    outcomeEvaluationStatus: OUTCOME_EVALUATION_STATUS,
    realizedPnlStatus: REALIZED_PNL_STATUS,
    sotStatus: OBSERVED_OUTCOME_SOT_STATUS,
    ownershipRole: OBSERVED_OUTCOME_OWNERSHIP_ROLE,
    ...REQUIRED_HARD_FLAGS,
  };

  if (input.correlationId != null) artifact.correlationId = input.correlationId;
  if (taskRef) artifact.taskRef = { ...taskRef };
  if (cycleBindingRef) artifact.cycleBindingRef = { ...cycleBindingRef };
  if (shadowCycleEnvelopeRef) artifact.shadowCycleEnvelopeRef = { ...shadowCycleEnvelopeRef };
  if (input.implementationVersion != null) {
    artifact.implementationVersion = input.implementationVersion;
  }

  if (!assertAllowlist(artifact, ALLOWED_ARTIFACT_TOP, 'artifact', errors)) {
    return fail('artifact_shape_invalid', 'Observed Outcome artifact shape invalid', { errors });
  }

  const bytes = utf8ByteLength(JSON.stringify(artifact));
  if (bytes > MAX_OBSERVED_OUTCOME_UTF8_BYTES) {
    return fail('artifact_too_large', 'Observed Outcome artifact exceeds size bound', {
      errors: [{ field: 'artifact', code: 'artifact_too_large', bytes, max: MAX_OBSERVED_OUTCOME_UTF8_BYTES }],
    });
  }

  return {
    ok: true,
    code: 'OBSERVED_OUTCOME_BUILT',
    message: 'Observed Outcome artifact validated',
    artifact: freezeDeep(artifact),
    sideEffects: { ...ZERO_OBSERVED_OUTCOME_SIDE_EFFECTS },
    bytes,
  };
}

/** Compatible alias — single canonical builder surface. */
export function validateObservedOutcome(input = {}) {
  return buildObservedOutcome(input);
}

export default {
  OBSERVED_OUTCOME_STAGE,
  OBSERVED_OUTCOME_SLICE_ID,
  OBSERVED_OUTCOME_SCHEMA_VERSION,
  OBSERVED_OUTCOME_CONTRACT_VERSION,
  OBSERVED_OUTCOME_POLICY_VERSION,
  OBSERVED_OUTCOME_WRITER,
  OBSERVED_OUTCOME_METHOD_KEY,
  OBSERVED_OUTCOME_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_SOT_STATUS,
  NEW_SOT_OWNER_REQUIRED,
  OBSERVED_OUTCOME_OWNERSHIP_ROLE,
  OUTCOME_EVALUATION_STATUS,
  REALIZED_PNL_STATUS,
  ZERO_OBSERVED_OUTCOME_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS,
  OBSERVED_OUTCOME_LIMITATIONS,
  buildObservedOutcome,
  validateObservedOutcome,
};
