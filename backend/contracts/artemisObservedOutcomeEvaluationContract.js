/**
 * Artemis Core Stage 8 — Observed Outcome Evaluation Contract Boundary
 * (S8-OBSERVED-OUTCOME-EVALUATION-CONTRACT).
 *
 * Deterministic, non-executing, library-only comparison of an already-valid
 * Shadow Decision / recording lineage against an already-attested Observed
 * Outcome artifact. Produces a thin ARTEMIS_OBSERVED_OUTCOME_EVALUATION
 * artifact. This module is NOT a Source of Truth.
 *
 * Ownership (explicit):
 *   - VALIDATION / COMPOSITION BOUNDARY for Outcome Evaluation only.
 *   - isSourceOfTruth = false.
 *   - Does NOT own Decision, Decision Context, C8.1, Task State, Binding,
 *     Observed Outcome Contract, or Observed Outcome SoT.
 *   - Does NOT persist, calibrate, replay, score, or authorize trading.
 *
 * Does NOT:
 *   - fetch market data / network / provider / LLM
 *   - write DB / Redis
 *   - activate Worker / Scheduler / Feeder / B10 / Shadow Runtime
 *   - calculate realizedPnl / ROI / financial scores
 *   - invent Replay / Lineage ledger / Evaluation SoT
 *   - modify C8.1 / C.1–C.6 / Control Chain / Decision / Context /
 *     Observed Outcome Contract / Observed Outcome SoT / Task State
 */

import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  DECISION_CONTRACT_VERSION,
  DIRECTION_OR_ABSTAIN,
} from './artemisDecisionContract.js';
import { DECISION_CONTEXT_CONTRACT_VERSION } from './artemisDecisionContextContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from './artemisMarketContextContract.js';
import { SHADOW_RECORDING_CONTRACT_VERSION } from './artemisShadowDecisionRecordingBoundaryContract.js';
import { SHADOW_TASK_STATE_CONTRACT_VERSION } from './artemisShadowTaskStateBoundaryContract.js';
import { SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION } from './artemisShadowTaskCycleCompositionBoundaryContract.js';
import {
  OBSERVED_OUTCOME_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_CONTRACT_VERSION,
  OBSERVED_OUTCOME_POLICY_VERSION,
  REALIZED_PNL_STATUS,
  REQUIRED_HARD_FLAGS as OUTCOME_HARD_FLAGS,
  validateObservedOutcome,
} from './artemisObservedOutcomeContract.js';
import {
  OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
} from './artemisObservedOutcomeSourceOfTruthContract.js';

export const OBSERVED_OUTCOME_EVALUATION_STAGE =
  'ARTEMIS_CORE_STAGE_8_OBSERVED_OUTCOME_EVALUATION_CONTRACT_BOUNDARY';
export const OBSERVED_OUTCOME_EVALUATION_SLICE_ID =
  'S8-OBSERVED-OUTCOME-EVALUATION-CONTRACT';
export const OBSERVED_OUTCOME_EVALUATION_SCHEMA_VERSION = '1.0.0';
export const OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION =
  'artemis-observed-outcome-evaluation-1.0.0';
export const OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION =
  'stage8-observed-outcome-evaluation-contract-1.0.0';
export const OBSERVED_OUTCOME_EVALUATION_WRITER =
  'artemisObservedOutcomeEvaluationContract';
export const OBSERVED_OUTCOME_EVALUATION_METHOD_KEY =
  'compare_shadow_decision_to_observed_outcome_fail_closed';
export const OBSERVED_OUTCOME_EVALUATION_ARTIFACT_TYPE =
  'ARTEMIS_OBSERVED_OUTCOME_EVALUATION';
export const OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS = 'OUTCOME_EVALUATION';
export const OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE =
  'VALIDATION_BOUNDARY';
export const OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH = false;
export const OBSERVED_OUTCOME_EVALUATION_IMPLEMENTATION_VERSION = '1.0.0';

export const EVALUATION_STATUS = Object.freeze({
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  BLOCKED: 'BLOCKED',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const OBSERVATION_CLASS = Object.freeze({
  NOT_OBSERVED: 'NOT_OBSERVED',
  OBSERVED_BUT_UNAVAILABLE: 'OBSERVED_BUT_UNAVAILABLE',
  OBSERVED_AND_EVALUABLE: 'OBSERVED_AND_EVALUABLE',
});

export const EVALUATION_METHOD_KEY = Object.freeze({
  COMPARE_SHADOW_DECISION_TO_OBSERVED_OUTCOME_FAIL_CLOSED:
    OBSERVED_OUTCOME_EVALUATION_METHOD_KEY,
  LINEAGE_COMPATIBILITY_FAIL_CLOSED: 'lineage_compatibility_fail_closed',
  DIRECTIONAL_CLAIM_COMPARE_FAIL_CLOSED: 'directional_claim_compare_fail_closed',
});

export const MAX_EVALUATION_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 256;

export const ZERO_EVALUATION_SIDE_EFFECTS = Object.freeze({
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
  evaluationPersisted: 0,
  replay: 0,
  calibration: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  ...OUTCOME_HARD_FLAGS,
  evaluationPersisted: false,
  evaluationRuntimeActivated: false,
  workerActivated: false,
  schedulerActivated: false,
});

export const OBSERVED_OUTCOME_EVALUATION_LIMITATIONS = Object.freeze([
  'stage8_observed_outcome_evaluation_contract_boundary_only',
  'library_only',
  'in_memory_only',
  'deterministic_non_executing',
  'validation_boundary_not_sot',
  'is_source_of_truth_false',
  'persistence_not_enabled',
  'no_evaluation_sot',
  'no_replay',
  'no_calibration',
  'no_numeric_score',
  'no_realized_pnl_calculation',
  'realized_pnl_unsupported_for_shadow',
  'references_only_no_embedded_payloads',
  'lookahead_protection',
  'leakage_protection',
  'does_not_fetch_market_data',
  'does_not_activate_worker_or_scheduler',
  'does_not_activate_global_shadow_runtime',
  'does_not_activate_b10',
  'does_not_authorize_execution',
  'does_not_call_llm_or_provider',
  'does_not_write_db_or_redis',
  'missing_outcome_is_not_match',
  'unavailable_is_not_neutral_success',
]);

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));
const EVALUATION_STATUS_SET = new Set(Object.values(EVALUATION_STATUS));
const OBSERVATION_CLASS_SET = new Set(Object.values(OBSERVATION_CLASS));
const METHOD_KEY_SET = new Set(Object.values(EVALUATION_METHOD_KEY));
const DIRECTION_SET = new Set(Object.values(DIRECTION_OR_ABSTAIN));

const ALLOWED_INPUT_TOP = Object.freeze([
  'outcomeArtifact',
  'outcomeRef',
  'decisionRef',
  'decisionContextRef',
  'shadowRecordingRef',
  'taskRef',
  'bindingRef',
  'marketContextRef',
  'observationClass',
  'comparisonClaims',
  'evaluationMethod',
  'recordedAt',
  'evaluationId',
  'blockedReason',
  'limitations',
  'provenance',
  'lineage',
  'outcomeSotRef',
  'implementationVersion',
  'expectedEvaluationStatus',
  ...HARD_FLAG_KEYS,
]);

const ALLOWED_ARTIFACT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'authorityClass',
  'sliceId',
  'evaluationId',
  'evaluationStatus',
  'observationClass',
  'recordedAt',
  'decisionRef',
  'decisionContextRef',
  'shadowRecordingRef',
  'taskRef',
  'bindingRef',
  'outcomeRef',
  'marketContextRef',
  'outcomeSotRef',
  'evaluationMethod',
  'comparisonClaims',
  'lineage',
  'provenance',
  'limitations',
  'sideEffects',
  'ownershipRole',
  'isSourceOfTruth',
  'implementationVersion',
  'realizedPnlStatus',
  'blockedReason',
  ...HARD_FLAG_KEYS,
]);

const ALLOWED_DECISION_REF = Object.freeze([
  'decisionId',
  'contractVersion',
]);

const ALLOWED_CONTEXT_REF = Object.freeze([
  'contextId',
  'contractVersion',
]);

const ALLOWED_SHADOW_RECORDING_REF = Object.freeze([
  'shadowRecordingArtifactId',
  'contractVersion',
]);

const ALLOWED_TASK_REF = Object.freeze([
  'taskId',
  'contractVersion',
  'attempt',
]);

const ALLOWED_BINDING_REF = Object.freeze([
  'bindingId',
  'contractVersion',
]);

const ALLOWED_OUTCOME_REF = Object.freeze([
  'outcomeId',
  'contractVersion',
]);

const ALLOWED_MARKET_CONTEXT_REF = Object.freeze([
  'marketContextId',
  'contractVersion',
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'sourceTimestamp',
]);

const ALLOWED_OUTCOME_SOT_REF = Object.freeze([
  'outcomeId',
  'contractVersion',
]);

const ALLOWED_EVALUATION_METHOD = Object.freeze([
  'methodKey',
  'implementationVersion',
]);

const ALLOWED_COMPARISON_CLAIMS = Object.freeze([
  'decisionDirection',
  'observedDirection',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'decisionId',
  'outcomeId',
  'contextId',
  'shadowRecordingArtifactId',
  'taskId',
  'bindingId',
  'marketContextId',
  'decisionContractVersion',
  'decisionContextContractVersion',
  'shadowRecordingContractVersion',
  'observedOutcomeContractVersion',
  'observedOutcomeSotContractVersion',
  'shadowTaskStateContractVersion',
  'shadowTaskCycleBindingContractVersion',
  'marketContextContractVersion',
  'evaluationContractVersion',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'policyVersion',
  'implementationVersion',
  'decisionProvenance',
  'outcomeProvenance',
  'note',
]);

const FORBIDDEN_KEYS = Object.freeze([
  'order',
  'orderId',
  'executionIntent',
  'executionCommand',
  'wallet',
  'transfer',
  'withdrawal',
  'financialExecution',
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
  'runId',
  'workerId',
  'lease',
  'lock',
  'queueState',
  'schedulerState',
  'scheduleAt',
  'cron',
  'pm_id',
  'PM2',
  'prompt',
  'modelResponse',
  'raw',
  'payload',
  'lookahead',
  'lookAhead',
  'futureData',
  'realizedPnl',
  'evaluationResult',
  'calibrationScore',
  'promotion',
  'approved',
  'action',
  'place_order',
  'cancel_order',
  'modify_order',
  'profit',
  'loss',
  'roi',
  'ROI',
  'return',
  'PnL',
  'pnl',
  'replayId',
  'replay',
  'score',
  'numericScore',
  'performanceScore',
  'strategyScore',
  'qualityScore',
  'ranking',
  'winner',
  'loser',
  'recommendation',
  'probabilityAdjustment',
  'b10',
  'shadowWorker',
  'shadowScheduler',
  'fill',
  'fillPrice',
]);

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
    // Zero-count side-effect ledgers legitimately use names like wallet/b10/lock
    // as numeric counter keys. Allow those counters; still reject nested payloads.
    if (key === 'sideEffects' && value[key] && typeof value[key] === 'object' && !Array.isArray(value[key])) {
      for (const seKey of Object.keys(value[key])) {
        const seVal = value[key][seKey];
        const sePath = `${fieldPath}.${seKey}`;
        if (typeof seVal === 'number') {
          continue;
        }
        if (FORBIDDEN_KEYS.includes(seKey)) {
          acc.push(sePath);
          continue;
        }
        if (seVal && typeof seVal === 'object') {
          collectForbiddenKeysDeep(seVal, acc, sePath);
        }
      }
      continue;
    }
    if (FORBIDDEN_KEYS.includes(key)) {
      acc.push(fieldPath);
      continue;
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
}

function decisionTimeMs(outcomeArtifact) {
  const ref = outcomeArtifact?.decisionRef;
  if (!ref) return null;
  if (isIsoTimestamp(ref.analysisAt)) return parseIsoMs(ref.analysisAt);
  if (isIsoTimestamp(ref.createdAt)) return parseIsoMs(ref.createdAt);
  return null;
}

function thinDecisionRef(outcomeDecisionRef, errors) {
  if (!outcomeDecisionRef || typeof outcomeDecisionRef !== 'object') {
    errors.push({ field: 'outcomeArtifact.decisionRef', code: 'required_object' });
    return null;
  }
  if (!isCanonicalUuid(outcomeDecisionRef.decisionId)) {
    errors.push({ field: 'decisionRef.decisionId', code: 'invalid_decision_id' });
  }
  return {
    decisionId: outcomeDecisionRef.decisionId,
    contractVersion: outcomeDecisionRef.contractVersion || DECISION_CONTRACT_VERSION,
  };
}

function thinContextRef(outcomeContextRef, errors) {
  if (!outcomeContextRef || typeof outcomeContextRef !== 'object') {
    errors.push({ field: 'outcomeArtifact.decisionContextRef', code: 'required_object' });
    return null;
  }
  if (!isCanonicalUuid(outcomeContextRef.contextId)) {
    errors.push({ field: 'decisionContextRef.contextId', code: 'invalid_context_id' });
  }
  return {
    contextId: outcomeContextRef.contextId,
    contractVersion: outcomeContextRef.contractVersion || DECISION_CONTEXT_CONTRACT_VERSION,
  };
}

function thinShadowRecordingRef(outcomeShadowRef, errors) {
  if (!outcomeShadowRef || typeof outcomeShadowRef !== 'object') {
    errors.push({ field: 'outcomeArtifact.shadowRecordingRef', code: 'required_object' });
    return null;
  }
  if (!isCanonicalUuid(outcomeShadowRef.shadowRecordingArtifactId)) {
    errors.push({
      field: 'shadowRecordingRef.shadowRecordingArtifactId',
      code: 'invalid_shadow_recording_id',
    });
  }
  return {
    shadowRecordingArtifactId: outcomeShadowRef.shadowRecordingArtifactId,
    contractVersion: outcomeShadowRef.contractVersion || SHADOW_RECORDING_CONTRACT_VERSION,
  };
}

function thinMarketContextRef(outcomeMcRef, errors) {
  if (!outcomeMcRef || typeof outcomeMcRef !== 'object') {
    errors.push({ field: 'outcomeArtifact.marketContextRef', code: 'required_object' });
    return null;
  }
  if (!isCanonicalUuid(outcomeMcRef.marketContextId)) {
    errors.push({ field: 'marketContextRef.marketContextId', code: 'invalid_market_context_id' });
  }
  return {
    marketContextId: outcomeMcRef.marketContextId,
    contractVersion: outcomeMcRef.contractVersion || MARKET_CONTEXT_CONTRACT_VERSION,
    venue: outcomeMcRef.venue,
    marketType: outcomeMcRef.marketType,
    symbol: outcomeMcRef.symbol,
    timeframe: outcomeMcRef.timeframe,
    sourceTimestamp: outcomeMcRef.sourceTimestamp,
  };
}

function thinOptionalTaskRef(outcomeTaskRef) {
  if (outcomeTaskRef == null) return null;
  return {
    taskId: outcomeTaskRef.taskId,
    contractVersion: outcomeTaskRef.contractVersion || SHADOW_TASK_STATE_CONTRACT_VERSION,
    attempt: outcomeTaskRef.attempt,
  };
}

function thinOptionalBindingRef(outcomeBindingRef) {
  if (outcomeBindingRef == null) return null;
  return {
    bindingId: outcomeBindingRef.bindingId,
    contractVersion:
      outcomeBindingRef.contractVersion || SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
  };
}

function assertOptionalRefMatch(provided, expected, fieldPrefix, idField, mismatchCode, errors) {
  if (provided == null) return;
  if (!assertAllowlist(
    provided,
    fieldPrefix === 'decisionRef' ? ALLOWED_DECISION_REF
      : fieldPrefix === 'decisionContextRef' ? ALLOWED_CONTEXT_REF
        : fieldPrefix === 'shadowRecordingRef' ? ALLOWED_SHADOW_RECORDING_REF
          : fieldPrefix === 'taskRef' ? ALLOWED_TASK_REF
            : fieldPrefix === 'bindingRef' ? ALLOWED_BINDING_REF
              : fieldPrefix === 'outcomeRef' ? ALLOWED_OUTCOME_REF
                : fieldPrefix === 'marketContextRef' ? ALLOWED_MARKET_CONTEXT_REF
                  : fieldPrefix === 'outcomeSotRef' ? ALLOWED_OUTCOME_SOT_REF
                    : [],
    fieldPrefix,
    errors,
  )) {
    return;
  }
  if (!expected) {
    errors.push({ field: fieldPrefix, code: 'unexpected_ref_without_outcome_value' });
    return;
  }
  if (provided[idField] != null && provided[idField] !== expected[idField]) {
    errors.push({ field: `${fieldPrefix}.${idField}`, code: mismatchCode });
  }
  if (provided.contractVersion != null
    && expected.contractVersion != null
    && provided.contractVersion !== expected.contractVersion) {
    errors.push({ field: `${fieldPrefix}.contractVersion`, code: 'contract_version_mismatch' });
  }
  if (fieldPrefix === 'taskRef' && provided.attempt != null && expected.attempt != null
    && provided.attempt !== expected.attempt) {
    errors.push({ field: 'taskRef.attempt', code: 'task_attempt_mismatch' });
  }
  if (fieldPrefix === 'marketContextRef') {
    for (const key of ['venue', 'marketType', 'symbol', 'timeframe', 'sourceTimestamp']) {
      if (provided[key] != null && expected[key] != null && provided[key] !== expected[key]) {
        errors.push({ field: `marketContextRef.${key}`, code: 'market_context_mismatch' });
      }
    }
  }
}

function validateEvaluationMethod(method, errors) {
  if (method == null) {
    errors.push({ field: 'evaluationMethod', code: 'required_object' });
    return null;
  }
  if (!assertAllowlist(method, ALLOWED_EVALUATION_METHOD, 'evaluationMethod', errors)) {
    return null;
  }
  if (!METHOD_KEY_SET.has(method.methodKey)) {
    errors.push({
      field: 'evaluationMethod.methodKey',
      code: method.methodKey == null ? 'required_method_key' : 'invalid_method_key',
    });
  }
  assertString(
    'evaluationMethod.implementationVersion',
    method.implementationVersion,
    errors,
    { required: true },
  );
  return method;
}

function validateComparisonClaims(claims, errors) {
  if (claims == null) return null;
  if (!assertAllowlist(claims, ALLOWED_COMPARISON_CLAIMS, 'comparisonClaims', errors)) {
    return null;
  }
  if (claims.decisionDirection != null) {
    if (!DIRECTION_SET.has(claims.decisionDirection)) {
      errors.push({ field: 'comparisonClaims.decisionDirection', code: 'invalid_direction' });
    }
  }
  if (claims.observedDirection != null) {
    if (!DIRECTION_SET.has(claims.observedDirection)) {
      errors.push({ field: 'comparisonClaims.observedDirection', code: 'invalid_direction' });
    }
  }
  return claims;
}

function validateOutcomeArtifact(outcomeArtifact, errors) {
  if (outcomeArtifact == null) {
    errors.push({ field: 'outcomeArtifact', code: 'required_object' });
    return null;
  }
  if (!outcomeArtifact || typeof outcomeArtifact !== 'object' || Array.isArray(outcomeArtifact)) {
    errors.push({ field: 'outcomeArtifact', code: 'required_object' });
    return null;
  }
  if (outcomeArtifact.artifactType !== OBSERVED_OUTCOME_ARTIFACT_TYPE) {
    errors.push({ field: 'outcomeArtifact.artifactType', code: 'invalid_outcome_artifact_type' });
  }
  if (outcomeArtifact.contractVersion !== OBSERVED_OUTCOME_CONTRACT_VERSION) {
    errors.push({
      field: 'outcomeArtifact.contractVersion',
      code: 'incompatible_observed_outcome_contract',
      expected: OBSERVED_OUTCOME_CONTRACT_VERSION,
    });
  }
  if (!isCanonicalUuid(outcomeArtifact.outcomeId)) {
    errors.push({ field: 'outcomeArtifact.outcomeId', code: 'invalid_outcome_id' });
  }

  // Re-validate through Outcome Contract by reconstructing canonical input.
  const reconstructed = {
    decisionRef: outcomeArtifact.decisionRef,
    decisionContextRef: outcomeArtifact.decisionContextRef,
    shadowRecordingRef: outcomeArtifact.shadowRecordingRef,
    marketContextRef: outcomeArtifact.marketContextRef,
    taskRef: outcomeArtifact.taskRef,
    cycleBindingRef: outcomeArtifact.cycleBindingRef,
    shadowCycleEnvelopeRef: outcomeArtifact.shadowCycleEnvelopeRef,
    outcomeObservedAt: outcomeArtifact.outcomeObservedAt,
    recordedAt: outcomeArtifact.recordedAt,
    correlationId: outcomeArtifact.correlationId,
    outcomeId: outcomeArtifact.outcomeId,
    implementationVersion: outcomeArtifact.implementationVersion,
    outcomeRecorded: outcomeArtifact.outcomeRecorded,
    lineage: outcomeArtifact.lineage
      ? {
        decisionId: outcomeArtifact.lineage.decisionId,
        decisionContextId: outcomeArtifact.lineage.decisionContextId,
        shadowRecordingArtifactId: outcomeArtifact.lineage.shadowRecordingArtifactId,
        marketContextId: outcomeArtifact.lineage.marketContextId,
        taskId: outcomeArtifact.lineage.taskId,
        bindingId: outcomeArtifact.lineage.bindingId,
        shadowCycleEnvelopeId: outcomeArtifact.lineage.shadowCycleEnvelopeId,
        outcomeId: outcomeArtifact.lineage.outcomeId,
      }
      : undefined,
    provenance: outcomeArtifact.provenance
      ? {
        writer: outcomeArtifact.provenance.writer,
        methodKey: outcomeArtifact.provenance.methodKey,
        stage: outcomeArtifact.provenance.stage,
        recordedAt: outcomeArtifact.provenance.recordedAt,
        sourceClass: outcomeArtifact.provenance.sourceClass,
        correlationFamily: outcomeArtifact.provenance.correlationFamily,
        sourceTimestamp: outcomeArtifact.provenance.sourceTimestamp,
        ingestionTimestamp: outcomeArtifact.provenance.ingestionTimestamp,
        policyVersion: outcomeArtifact.provenance.policyVersion,
        implementationVersion: outcomeArtifact.provenance.implementationVersion,
        note: outcomeArtifact.provenance.note,
      }
      : undefined,
  };
  const revalidated = validateObservedOutcome(reconstructed);
  if (!revalidated.ok) {
    errors.push({
      field: 'outcomeArtifact',
      code: 'outcome_artifact_invalid',
      details: revalidated.errors || [{ code: revalidated.code }],
    });
    return null;
  }
  if (revalidated.artifact.outcomeId !== outcomeArtifact.outcomeId) {
    errors.push({ field: 'outcomeArtifact.outcomeId', code: 'outcome_id_conflict' });
  }
  return outcomeArtifact;
}

function computeEvaluationStatus({
  observationClass,
  comparisonClaims,
  blockedReason,
}) {
  if (blockedReason != null && blockedReason !== '') {
    return EVALUATION_STATUS.BLOCKED;
  }
  if (observationClass === OBSERVATION_CLASS.NOT_OBSERVED
    || observationClass === OBSERVATION_CLASS.OBSERVED_BUT_UNAVAILABLE) {
    return EVALUATION_STATUS.UNAVAILABLE;
  }
  if (observationClass === OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE) {
    const hasDecision = comparisonClaims?.decisionDirection != null;
    const hasObserved = comparisonClaims?.observedDirection != null;
    if (hasDecision && hasObserved) {
      if (comparisonClaims.decisionDirection === DIRECTION_OR_ABSTAIN.UNAVAILABLE
        || comparisonClaims.decisionDirection === DIRECTION_OR_ABSTAIN.ABSTAIN
        || comparisonClaims.decisionDirection === DIRECTION_OR_ABSTAIN.NOT_APPLICABLE
        || comparisonClaims.observedDirection === DIRECTION_OR_ABSTAIN.UNAVAILABLE
        || comparisonClaims.observedDirection === DIRECTION_OR_ABSTAIN.ABSTAIN
        || comparisonClaims.observedDirection === DIRECTION_OR_ABSTAIN.NOT_APPLICABLE) {
        return EVALUATION_STATUS.INSUFFICIENT_DATA;
      }
      return comparisonClaims.decisionDirection === comparisonClaims.observedDirection
        ? EVALUATION_STATUS.MATCH
        : EVALUATION_STATUS.MISMATCH;
    }
    if (hasDecision || hasObserved) {
      return EVALUATION_STATUS.INSUFFICIENT_DATA;
    }
    return EVALUATION_STATUS.MATCH;
  }
  return EVALUATION_STATUS.UNAVAILABLE;
}

/**
 * Compose/validate one Observed Outcome Evaluation artifact (library-only).
 *
 * @param {object} input
 * @returns {{ ok: true, code: string, message: string, artifact: object, sideEffects: object, bytes: number }
 *   | { ok: false, code: string, message: string, artifact: null, errors?: object[] }}
 */
export function buildObservedOutcomeEvaluation(input = {}) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Observed Outcome Evaluation input object required');
  }

  const forbiddenHits = collectForbiddenKeysDeep(input);
  for (const key of forbiddenHits) {
    errors.push({ field: key, code: 'forbidden_field' });
  }
  const secretHits = collectForbiddenSecretKeys(input);
  for (const key of secretHits) {
    errors.push({ field: key, code: 'secret_field_forbidden' });
  }
  if (errors.length) {
    return fail('forbidden_field', 'Evaluation input contains forbidden fields', { errors });
  }

  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Evaluation input contains unknown fields', { errors });
  }

  validateHardFlagsOnInput(input, errors);

  if (!isIsoTimestamp(input.recordedAt)) {
    errors.push({
      field: 'recordedAt',
      code: input.recordedAt == null ? 'required_recorded_at' : 'invalid_iso_timestamp',
    });
  }

  if (input.observationClass == null || input.observationClass === '') {
    errors.push({ field: 'observationClass', code: 'required_observation_class' });
  } else if (!OBSERVATION_CLASS_SET.has(input.observationClass)) {
    errors.push({ field: 'observationClass', code: 'invalid_observation_class' });
  }

  if (input.blockedReason != null) {
    assertString('blockedReason', input.blockedReason, errors);
  }

  if (input.implementationVersion != null) {
    assertString('implementationVersion', input.implementationVersion, errors);
  }

  if (input.expectedEvaluationStatus != null
    && !EVALUATION_STATUS_SET.has(input.expectedEvaluationStatus)) {
    errors.push({ field: 'expectedEvaluationStatus', code: 'invalid_evaluation_status' });
  }

  const evaluationMethod = validateEvaluationMethod(input.evaluationMethod, errors);
  const comparisonClaims = validateComparisonClaims(input.comparisonClaims, errors);
  const outcomeArtifact = validateOutcomeArtifact(input.outcomeArtifact, errors);

  if (errors.length) {
    return fail('validation_failed', 'Observed Outcome Evaluation validation failed', { errors });
  }

  const decisionRef = thinDecisionRef(outcomeArtifact.decisionRef, errors);
  const decisionContextRef = thinContextRef(outcomeArtifact.decisionContextRef, errors);
  const shadowRecordingRef = thinShadowRecordingRef(outcomeArtifact.shadowRecordingRef, errors);
  const marketContextRef = thinMarketContextRef(outcomeArtifact.marketContextRef, errors);
  const taskRef = thinOptionalTaskRef(outcomeArtifact.taskRef);
  const bindingRef = thinOptionalBindingRef(outcomeArtifact.cycleBindingRef);
  const outcomeRef = {
    outcomeId: outcomeArtifact.outcomeId,
    contractVersion: OBSERVED_OUTCOME_CONTRACT_VERSION,
  };

  assertOptionalRefMatch(
    input.decisionRef,
    decisionRef,
    'decisionRef',
    'decisionId',
    'decision_id_mismatch',
    errors,
  );
  assertOptionalRefMatch(
    input.decisionContextRef,
    decisionContextRef,
    'decisionContextRef',
    'contextId',
    'context_id_mismatch',
    errors,
  );
  assertOptionalRefMatch(
    input.shadowRecordingRef,
    shadowRecordingRef,
    'shadowRecordingRef',
    'shadowRecordingArtifactId',
    'shadow_recording_id_mismatch',
    errors,
  );
  assertOptionalRefMatch(
    input.taskRef,
    taskRef,
    'taskRef',
    'taskId',
    'task_id_mismatch',
    errors,
  );
  assertOptionalRefMatch(
    input.bindingRef,
    bindingRef,
    'bindingRef',
    'bindingId',
    'binding_id_mismatch',
    errors,
  );
  assertOptionalRefMatch(
    input.outcomeRef,
    outcomeRef,
    'outcomeRef',
    'outcomeId',
    'outcome_id_mismatch',
    errors,
  );
  assertOptionalRefMatch(
    input.marketContextRef,
    marketContextRef,
    'marketContextRef',
    'marketContextId',
    'market_context_id_mismatch',
    errors,
  );

  let outcomeSotRef = null;
  if (input.outcomeSotRef != null) {
    if (!assertAllowlist(input.outcomeSotRef, ALLOWED_OUTCOME_SOT_REF, 'outcomeSotRef', errors)) {
      // allowlist errors already recorded
    } else {
      if (!isCanonicalUuid(input.outcomeSotRef.outcomeId)) {
        errors.push({ field: 'outcomeSotRef.outcomeId', code: 'invalid_outcome_id' });
      } else if (input.outcomeSotRef.outcomeId !== outcomeRef.outcomeId) {
        errors.push({ field: 'outcomeSotRef.outcomeId', code: 'outcome_id_mismatch' });
      }
      if (input.outcomeSotRef.contractVersion !== OBSERVED_OUTCOME_SOT_CONTRACT_VERSION) {
        errors.push({
          field: 'outcomeSotRef.contractVersion',
          code: 'incompatible_observed_outcome_sot_contract',
          expected: OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
        });
      }
      outcomeSotRef = {
        outcomeId: input.outcomeSotRef.outcomeId,
        contractVersion: input.outcomeSotRef.contractVersion,
      };
    }
  }

  // Look-ahead / leakage / post-horizon protection
  const decisionMs = decisionTimeMs(outcomeArtifact);
  const outcomeObservedAt = outcomeArtifact.outcomeObservedAt;
  const sourceTimestamp = outcomeArtifact.marketContextRef?.sourceTimestamp;

  if (decisionMs == null) {
    errors.push({ field: 'outcomeArtifact.decisionRef', code: 'required_decision_timestamp' });
  }
  if (isIsoTimestamp(outcomeObservedAt) && decisionMs != null) {
    if (parseIsoMs(outcomeObservedAt) < decisionMs) {
      errors.push({
        field: 'outcomeArtifact.outcomeObservedAt',
        code: 'timestamp_ordering_violation',
      });
    }
  }
  if (isIsoTimestamp(sourceTimestamp) && decisionMs != null) {
    if (parseIsoMs(sourceTimestamp) < decisionMs) {
      errors.push({
        field: 'outcomeArtifact.marketContextRef.sourceTimestamp',
        code: 'post_horizon_violation',
      });
    }
  }
  if (isIsoTimestamp(input.recordedAt) && decisionMs != null) {
    if (parseIsoMs(input.recordedAt) < decisionMs) {
      errors.push({ field: 'recordedAt', code: 'timestamp_ordering_violation' });
    }
  }

  // Lineage optional consistency
  if (input.lineage != null) {
    if (!assertAllowlist(input.lineage, ALLOWED_LINEAGE, 'lineage', errors)) {
      // recorded
    } else {
      const checks = [
        ['decisionId', decisionRef?.decisionId, 'decision_id_mismatch'],
        ['outcomeId', outcomeRef.outcomeId, 'outcome_id_mismatch'],
        ['contextId', decisionContextRef?.contextId, 'context_id_mismatch'],
        ['shadowRecordingArtifactId', shadowRecordingRef?.shadowRecordingArtifactId,
          'shadow_recording_id_mismatch'],
        ['taskId', taskRef?.taskId, 'task_id_mismatch'],
        ['bindingId', bindingRef?.bindingId, 'binding_id_mismatch'],
        ['marketContextId', marketContextRef?.marketContextId, 'market_context_id_mismatch'],
      ];
      for (const [field, expected, code] of checks) {
        if (input.lineage[field] != null) {
          if (!isCanonicalUuid(input.lineage[field])) {
            errors.push({ field: `lineage.${field}`, code: 'invalid_uuid' });
          } else if (expected != null && input.lineage[field] !== expected) {
            errors.push({ field: `lineage.${field}`, code });
          }
        }
      }
    }
  }

  if (input.provenance != null) {
    assertAllowlist(input.provenance, ALLOWED_PROVENANCE, 'provenance', errors);
  }

  if (input.limitations != null) {
    if (!Array.isArray(input.limitations)) {
      errors.push({ field: 'limitations', code: 'invalid_limitations' });
    } else {
      for (let i = 0; i < input.limitations.length; i += 1) {
        assertString(`limitations[${i}]`, input.limitations[i], errors, { required: true });
      }
    }
  }

  if (errors.length) {
    return fail('validation_failed', 'Observed Outcome Evaluation validation failed', { errors });
  }

  const evaluationStatus = computeEvaluationStatus({
    observationClass: input.observationClass,
    comparisonClaims,
    blockedReason: input.blockedReason,
  });

  if (input.expectedEvaluationStatus != null
    && input.expectedEvaluationStatus !== evaluationStatus) {
    return fail(
      'evaluation_status_conflict',
      'Expected evaluation status conflicts with computed status',
      {
        errors: [{
          field: 'expectedEvaluationStatus',
          code: 'evaluation_status_conflict',
          expected: evaluationStatus,
          provided: input.expectedEvaluationStatus,
        }],
      },
    );
  }

  const methodKey = evaluationMethod.methodKey;
  const implementationVersion = input.implementationVersion
    || evaluationMethod.implementationVersion
    || OBSERVED_OUTCOME_EVALUATION_IMPLEMENTATION_VERSION;

  const evaluationId = hashToUuid([
    OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
    decisionRef.decisionId,
    outcomeRef.outcomeId,
    decisionContextRef.contextId,
    shadowRecordingRef.shadowRecordingArtifactId,
    taskRef?.taskId || '',
    bindingRef?.bindingId || '',
    marketContextRef.marketContextId,
    methodKey,
    input.recordedAt,
  ]);

  if (input.evaluationId != null) {
    if (!isCanonicalUuid(input.evaluationId)) {
      return fail('invalid_evaluation_id', 'evaluationId must be a canonical UUID', {
        errors: [{ field: 'evaluationId', code: 'invalid_uuid' }],
      });
    }
    if (input.evaluationId !== evaluationId) {
      return fail('evaluation_id_conflict', 'Provided evaluationId conflicts with deterministic identity', {
        errors: [{
          field: 'evaluationId',
          code: 'evaluation_id_conflict',
          expected: evaluationId,
        }],
      });
    }
  }

  const lineage = freezeDeep({
    decisionId: decisionRef.decisionId,
    outcomeId: outcomeRef.outcomeId,
    contextId: decisionContextRef.contextId,
    shadowRecordingArtifactId: shadowRecordingRef.shadowRecordingArtifactId,
    taskId: taskRef?.taskId,
    bindingId: bindingRef?.bindingId,
    marketContextId: marketContextRef.marketContextId,
    decisionContractVersion: DECISION_CONTRACT_VERSION,
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    observedOutcomeContractVersion: OBSERVED_OUTCOME_CONTRACT_VERSION,
    observedOutcomeSotContractVersion: outcomeSotRef
      ? OBSERVED_OUTCOME_SOT_CONTRACT_VERSION
      : undefined,
    shadowTaskStateContractVersion: taskRef
      ? SHADOW_TASK_STATE_CONTRACT_VERSION
      : undefined,
    shadowTaskCycleBindingContractVersion: bindingRef
      ? SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION
      : undefined,
    marketContextContractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    evaluationContractVersion: OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
  });

  const provenance = freezeDeep({
    writer: OBSERVED_OUTCOME_EVALUATION_WRITER,
    methodKey,
    stage: OBSERVED_OUTCOME_EVALUATION_STAGE,
    recordedAt: input.recordedAt,
    policyVersion: OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION,
    implementationVersion,
    decisionProvenance: outcomeArtifact.provenance
      ? {
        writer: outcomeArtifact.provenance.writer,
        methodKey: outcomeArtifact.provenance.methodKey,
        recordedAt: outcomeArtifact.provenance.recordedAt,
        policyVersion: outcomeArtifact.provenance.policyVersion
          || OBSERVED_OUTCOME_POLICY_VERSION,
      }
      : { availability: 'unavailable' },
    outcomeProvenance: outcomeArtifact.provenance
      ? {
        writer: outcomeArtifact.provenance.writer,
        methodKey: outcomeArtifact.provenance.methodKey,
        sourceTimestamp: outcomeArtifact.provenance.sourceTimestamp
          || marketContextRef.sourceTimestamp,
        recordedAt: outcomeArtifact.provenance.recordedAt
          || outcomeArtifact.recordedAt,
        policyVersion: outcomeArtifact.provenance.policyVersion
          || OBSERVED_OUTCOME_POLICY_VERSION,
      }
      : { availability: 'unavailable' },
    ...(input.provenance?.note != null ? { note: input.provenance.note } : {}),
  });

  const limitations = freezeDeep([
    ...OBSERVED_OUTCOME_EVALUATION_LIMITATIONS,
    ...(Array.isArray(input.limitations) ? input.limitations : []),
  ]);

  const artifact = {
    schemaVersion: OBSERVED_OUTCOME_EVALUATION_SCHEMA_VERSION,
    contractVersion: OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
    policyVersion: OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION,
    artifactType: OBSERVED_OUTCOME_EVALUATION_ARTIFACT_TYPE,
    authorityClass: OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS,
    sliceId: OBSERVED_OUTCOME_EVALUATION_SLICE_ID,
    evaluationId,
    evaluationStatus,
    observationClass: input.observationClass,
    recordedAt: input.recordedAt,
    decisionRef: freezeDeep({ ...decisionRef }),
    decisionContextRef: freezeDeep({ ...decisionContextRef }),
    shadowRecordingRef: freezeDeep({ ...shadowRecordingRef }),
    taskRef: taskRef ? freezeDeep({ ...taskRef }) : undefined,
    bindingRef: bindingRef ? freezeDeep({ ...bindingRef }) : undefined,
    outcomeRef: freezeDeep({ ...outcomeRef }),
    marketContextRef: freezeDeep({ ...marketContextRef }),
    outcomeSotRef: outcomeSotRef ? freezeDeep({ ...outcomeSotRef }) : undefined,
    evaluationMethod: freezeDeep({
      methodKey,
      implementationVersion: evaluationMethod.implementationVersion,
    }),
    comparisonClaims: comparisonClaims
      ? freezeDeep({ ...comparisonClaims })
      : undefined,
    lineage,
    provenance,
    limitations,
    sideEffects: { ...ZERO_EVALUATION_SIDE_EFFECTS },
    ownershipRole: OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE,
    isSourceOfTruth: OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH,
    implementationVersion,
    realizedPnlStatus: REALIZED_PNL_STATUS,
    blockedReason: input.blockedReason || undefined,
    ...REQUIRED_HARD_FLAGS,
  };

  // Strip undefined keys for stable allowlist / freeze
  for (const key of Object.keys(artifact)) {
    if (artifact[key] === undefined) delete artifact[key];
  }

  if (!assertAllowlist(artifact, ALLOWED_ARTIFACT_TOP, 'artifact', errors)) {
    return fail('artifact_shape_invalid', 'Evaluation artifact contains unknown fields', { errors });
  }

  const frozen = freezeDeep(artifact);
  const bytes = utf8ByteLength(JSON.stringify(frozen));
  if (bytes > MAX_EVALUATION_UTF8_BYTES) {
    return fail('artifact_too_large', 'Evaluation artifact exceeds size bound', {
      errors: [{ field: 'artifact', code: 'artifact_too_large', bytes, max: MAX_EVALUATION_UTF8_BYTES }],
    });
  }

  return {
    ok: true,
    code: 'OBSERVED_OUTCOME_EVALUATION_BUILT',
    message: 'Observed Outcome Evaluation composed',
    artifact: frozen,
    sideEffects: { ...ZERO_EVALUATION_SIDE_EFFECTS },
    bytes,
  };
}

export function validateObservedOutcomeEvaluation(input = {}) {
  return buildObservedOutcomeEvaluation(input);
}

export default {
  OBSERVED_OUTCOME_EVALUATION_STAGE,
  OBSERVED_OUTCOME_EVALUATION_SLICE_ID,
  OBSERVED_OUTCOME_EVALUATION_SCHEMA_VERSION,
  OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
  OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION,
  OBSERVED_OUTCOME_EVALUATION_WRITER,
  OBSERVED_OUTCOME_EVALUATION_METHOD_KEY,
  OBSERVED_OUTCOME_EVALUATION_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH,
  OBSERVED_OUTCOME_EVALUATION_IMPLEMENTATION_VERSION,
  EVALUATION_STATUS,
  OBSERVATION_CLASS,
  EVALUATION_METHOD_KEY,
  REQUIRED_HARD_FLAGS,
  ZERO_EVALUATION_SIDE_EFFECTS,
  OBSERVED_OUTCOME_EVALUATION_LIMITATIONS,
  buildObservedOutcomeEvaluation,
  validateObservedOutcomeEvaluation,
};
