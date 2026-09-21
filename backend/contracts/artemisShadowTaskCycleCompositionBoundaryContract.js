/**
 * Artemis Core Stage 8 — Shadow Task Cycle Composition Boundary
 * (S8-SHADOW-TASK-CYCLE-BINDING).
 *
 * Deterministic, non-executing, in-memory lineage binder.
 * COMPOSITION + LINEAGE only — not a SoT, worker, scheduler, queue,
 * lease/lock manager, persistence owner, or runtime activator.
 *
 * Flow:
 *   READY SHADOW_TASK_STATE_ARTIFACT
 *     → already-valid SHADOW_CYCLE_COMPOSITION_ENVELOPE (ref)
 *     → existing C8.1 recording reference
 *     → SHADOW_TASK_CYCLE_BINDING
 *
 * Does NOT:
 *   - execute, persist, schedule, queue, lease, lock, fetch
 *   - call providers / LLMs / place orders / mutate runtime
 *   - mutate Task State / C8.1 / RT / MC-SOT / C1–C6 / Control Chain
 *   - invent a second task identity or parallel SoT
 */

import { createHash } from 'node:crypto';
import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  FORBIDDEN_CONTROL_CHAIN_KEYS,
  CONTROL_CHAIN_CONTRACT_VERSION,
} from './artemisControlChainContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_MATURITY_MODE,
} from './artemisDecisionContextContract.js';
import { DECISION_CONTRACT_VERSION } from './artemisDecisionContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from './artemisEvidenceOrchestrationContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from './artemisMarketContextContract.js';
import {
  SHADOW_RECORDING_CONTRACT_VERSION,
  ZERO_SHADOW_RECORDING_SIDE_EFFECTS,
} from './artemisShadowDecisionRecordingBoundaryContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from './artemisShadowRuntimeLibraryBoundaryContract.js';
import {
  SHADOW_TASK_STATE_ARTIFACT_TYPE,
  SHADOW_TASK_STATE_CONTRACT_VERSION,
  SHADOW_TASK_STATUS,
  SHADOW_TASK_TYPE,
  REQUIRED_HARD_FLAGS as TASK_STATE_HARD_FLAGS,
} from './artemisShadowTaskStateBoundaryContract.js';

export const SHADOW_TASK_CYCLE_BINDING_STAGE =
  'ARTEMIS_CORE_STAGE_8_SHADOW_TASK_CYCLE_COMPOSITION_BOUNDARY';
export const SHADOW_TASK_CYCLE_BINDING_SCHEMA_VERSION = '1.0.0';
export const SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION =
  'artemis-shadow-task-cycle-composition-boundary-1.0.0';
export const SHADOW_TASK_CYCLE_BINDING_POLICY_VERSION =
  'stage8-shadow-task-cycle-composition-boundary-1.0.0';
export const SHADOW_TASK_CYCLE_BINDING_WRITER =
  'artemisShadowTaskCycleCompositionBoundaryContract';
export const SHADOW_TASK_CYCLE_BINDING_METHOD_KEY =
  'build_shadow_task_cycle_binding_fail_closed';
export const SHADOW_TASK_CYCLE_BINDING_ARTIFACT_TYPE = 'SHADOW_TASK_CYCLE_BINDING';

export const MAX_SHADOW_TASK_CYCLE_BINDING_UTF8_BYTES = 32 * 1024;

export const ZERO_SHADOW_TASK_CYCLE_BINDING_SIDE_EFFECTS = Object.freeze({
  ...ZERO_SHADOW_RECORDING_SIDE_EFFECTS,
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
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  ...TASK_STATE_HARD_FLAGS,
});

export const SHADOW_TASK_CYCLE_BINDING_LIMITATIONS = Object.freeze([
  'stage8_shadow_task_cycle_composition_boundary_only',
  'library_only',
  'composition_and_lineage_only',
  'in_memory_only',
  'deterministic_non_executing',
  'ready_task_state_only',
  'references_only_no_embedded_payloads',
  'does_not_mutate_task_state',
  'does_not_auto_transition_task_state',
  'no_worker_scheduler_queue_lease_lock',
  'does_not_create_parallel_sot',
  'persistence_not_enabled',
  'b10_not_activated',
  'observed_outcome_deferred',
  'does_not_authorize_execution',
  'does_not_call_llm_or_provider',
  'does_not_write_db_or_redis',
  'c8_1_read_reference_only',
  's8_mc_sot_read_reference_only',
  's8_shadow_rt_read_reference_only',
  's8_shadow_task_state_read_reference_only',
]);

const ALLOWED_INPUT_TOP = Object.freeze([
  'taskState',
  'taskId',
  'attempt',
  'recordedAt',
  'correlationId',
  'marketContextRef',
  'decisionContextRef',
  'decisionRef',
  'evidenceOrchestrationRef',
  'controlChainRef',
  'shadowCycleEnvelopeRef',
  'shadowRecordingRef',
  'shadowCycleEnvelope',
  'existingArtifact',
  'lineage',
  'provenance',
  'implementationVersion',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'liveTradingEnabled',
  'paperTradingEnabled',
  'providerConnected',
  'shadowRuntimeActivated',
  'persistenceEnabled',
  'b10WriteAttempted',
  'taskStateActivated',
]);

const ALLOWED_ARTIFACT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'bindingId',
  'taskId',
  'taskType',
  'attempt',
  'recordedAt',
  'correlationId',
  'taskStateRef',
  'shadowCycleEnvelopeRef',
  'shadowRecordingRef',
  'marketContextRef',
  'decisionContextRef',
  'decisionRef',
  'evidenceOrchestrationRef',
  'controlChainRef',
  'lineage',
  'provenance',
  'limitations',
  'sideEffects',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'liveTradingEnabled',
  'paperTradingEnabled',
  'providerConnected',
  'shadowRuntimeActivated',
  'persistenceEnabled',
  'b10WriteAttempted',
  'taskStateActivated',
  'implementationVersion',
]);

const ALLOWED_TASK_STATE_REF = Object.freeze([
  'taskId',
  'contractVersion',
  'status',
  'taskType',
  'attempt',
]);

const ALLOWED_MARKET_CONTEXT_REF = Object.freeze([
  'marketContextId',
  'contractVersion',
]);

const ALLOWED_DECISION_CONTEXT_REF = Object.freeze([
  'contextId',
  'contractVersion',
  'maturity',
]);

const ALLOWED_DECISION_REF = Object.freeze([
  'decisionId',
  'contractVersion',
]);

const ALLOWED_EVIDENCE_ORCHESTRATION_REF = Object.freeze([
  'orchestrationId',
  'contractVersion',
]);

const ALLOWED_CONTROL_CHAIN_REF = Object.freeze([
  'controlChainArtifactId',
  'contractVersion',
]);

const ALLOWED_SHADOW_CYCLE_ENVELOPE_REF = Object.freeze([
  'shadowCycleEnvelopeId',
  'contractVersion',
]);

const ALLOWED_SHADOW_RECORDING_REF = Object.freeze([
  'shadowRecordingArtifactId',
  'contractVersion',
  'maturity',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'bindingId',
  'taskId',
  'marketContextId',
  'contextId',
  'decisionId',
  'orchestrationId',
  'controlChainArtifactId',
  'shadowCycleEnvelopeId',
  'shadowRecordingArtifactId',
  'correlationId',
  'shadowTaskCycleBindingContractVersion',
  'shadowTaskStateContractVersion',
  'marketContextContractVersion',
  'decisionContextContractVersion',
  'decisionContractVersion',
  'orchestrationContractVersion',
  'controlChainContractVersion',
  'shadowRuntimeContractVersion',
  'shadowRecordingContractVersion',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'note',
  'policyVersion',
  'implementationVersion',
]);

const FORBIDDEN_EXTRA_KEYS = Object.freeze([
  ...FORBIDDEN_CONTROL_CHAIN_KEYS,
  'approved',
  'action',
  'order',
  'orderId',
  'executionIntent',
  'executionCommand',
  'walletAction',
  'tradeInstruction',
  'transfer',
  'withdrawal',
  'financialExecution',
  'place_order',
  'cancel_order',
  'modify_order',
  'providerPayload',
  'signedQuery',
  'apiKey',
  'apiSecret',
  'credentials',
  'prompt',
  'modelResponse',
  'raw',
  'payload',
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
  'observedOutcome',
  'realizedPnl',
  'realizedDirection',
  'calibrationScore',
  'evaluationResult',
  'lookahead',
  'lookAhead',
  'runId',
  'workerId',
  'lease',
  'lock',
  'schedulerState',
  'queueState',
  'scheduleAt',
  'cron',
  'pm_id',
  'pm2',
  'PM2',
  ['persist', 'Artemis', 'Decision'].join(''),
  'b10',
  'shadowWorker',
  'shadowScheduler',
  'scheduler',
  'EmergencyStop',
  'emergencyStopClear',
  'requestedRuntimeMode',
  'effectiveRuntimeMode',
  'shadowRecordingArtifact',
  'decision',
  'evidence',
  'evidenceOrchestrationSet',
  'controlChain',
  'marketContext',
  'decisionContext',
]);

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));

const EMBEDDED_PAYLOAD_KEYS = Object.freeze([
  'shadowRecordingArtifact',
  'decision',
  'evidence',
  'evidenceOrchestrationSet',
  'controlChain',
  'marketContext',
  'decisionContext',
  'taskStateArtifact',
  'fullDecision',
  'fullEvidence',
  'fullControlChain',
  'fullMarketContext',
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

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}

function hashToUuid(parts) {
  const digest = createHash('sha256').update(parts.join('|'), 'utf8').digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
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

function collectForbiddenKeys(value, path = '', acc = []) {
  if (value == null || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((item, idx) => collectForbiddenKeys(item, `${path}[${idx}]`, acc));
    return acc;
  }
  for (const key of Object.keys(value)) {
    // Opaque prior artifact for idempotency — do not treat its internals as
    // caller contamination (same pattern as Task State boundary).
    if (key === 'existingArtifact') continue;
    // Zero-counter sideEffects objects reuse vocabulary that overlaps the
    // forbidden key list (e.g. financialExecution, scheduler). Counters are
    // validated separately to remain hard-zero; do not treat key names as
    // contamination.
    if (key === 'sideEffects') continue;
    const next = path ? `${path}.${key}` : key;
    if (FORBIDDEN_EXTRA_KEYS.includes(key)) acc.push(next);
    collectForbiddenKeys(value[key], next, acc);
  }
  return acc;
}

function validateHardFlagsOnInput(input, errors) {
  for (const key of HARD_FLAG_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    if (input[key] !== false) {
      errors.push({ field: key, code: 'authority_flag_must_be_false' });
    }
  }
}

function validateThinRef(ref, field, allowed, idField, expectedContractVersion, errors, { required = true } = {}) {
  if (ref == null) {
    if (required) errors.push({ field, code: `missing_${field}` });
    return null;
  }
  if (typeof ref !== 'object' || Array.isArray(ref)) {
    errors.push({ field, code: `malformed_${field}` });
    return null;
  }
  if (!assertAllowlist(ref, allowed, field, errors)) return null;
  if (!isCanonicalUuid(ref[idField])) {
    errors.push({ field: `${field}.${idField}`, code: 'invalid_uuid' });
  }
  if (expectedContractVersion != null && ref.contractVersion !== expectedContractVersion) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: expectedContractVersion,
    });
  }
  const out = { [idField]: ref[idField], contractVersion: ref.contractVersion };
  if (Object.prototype.hasOwnProperty.call(ref, 'maturity')) {
    out.maturity = ref.maturity;
  }
  if (Object.prototype.hasOwnProperty.call(ref, 'status')) {
    out.status = ref.status;
  }
  if (Object.prototype.hasOwnProperty.call(ref, 'taskType')) {
    out.taskType = ref.taskType;
  }
  if (Object.prototype.hasOwnProperty.call(ref, 'attempt')) {
    out.attempt = ref.attempt;
  }
  return out;
}

function projectMarketContextRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  return {
    marketContextId: ref.marketContextId,
    contractVersion: ref.contractVersion,
  };
}

function projectDecisionContextRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  return {
    contextId: ref.contextId,
    contractVersion: ref.contractVersion,
    maturity: ref.maturity,
  };
}

function resolveRef(inputRef, taskStateRef, projector, field, errors) {
  const fromInput = inputRef != null ? projector(inputRef) : null;
  const fromTask = taskStateRef != null ? projector(taskStateRef) : null;
  if (fromInput == null && fromTask == null) {
    errors.push({ field, code: `missing_${field}` });
    return null;
  }
  if (fromInput != null && fromTask != null) {
    const idKey = Object.keys(fromInput).find((k) => k.endsWith('Id') || k === 'contextId'
      || k === 'orchestrationId' || k === 'controlChainArtifactId'
      || k === 'shadowCycleEnvelopeId' || k === 'shadowRecordingArtifactId'
      || k === 'marketContextId' || k === 'decisionId') || Object.keys(fromInput)[0];
    if (fromInput[idKey] !== fromTask[idKey]) {
      errors.push({ field, code: `${field}_mismatch` });
      return null;
    }
    if (fromInput.contractVersion !== fromTask.contractVersion) {
      errors.push({ field: `${field}.contractVersion`, code: 'contract_version_mismatch' });
      return null;
    }
    if (fromInput.maturity != null && fromTask.maturity != null
      && fromInput.maturity !== fromTask.maturity) {
      errors.push({ field: `${field}.maturity`, code: 'maturity_mismatch' });
      return null;
    }
  }
  return fromInput || fromTask;
}

function extractEnvelopeRefs(envelope, errors) {
  if (envelope == null) return null;
  if (typeof envelope !== 'object' || Array.isArray(envelope)) {
    errors.push({ field: 'shadowCycleEnvelope', code: 'malformed_shadow_cycle_envelope' });
    return null;
  }
  for (const key of EMBEDDED_PAYLOAD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(envelope, key) && key !== 'shadowRecordingArtifact') {
      // shadowRecordingArtifact is present on RT envelopes — reject embedding into binder output
      // by never copying it; still allow reading thin refs from the envelope.
    }
  }
  const forbidden = collectForbiddenKeys(envelope);
  // Envelope may legitimately contain shadowRecordingArtifact from RT — strip for binder use.
  const filteredForbidden = forbidden.filter(
    (k) => !k.includes('shadowRecordingArtifact') && !k.startsWith('shadowRecordingArtifact.'),
  );
  if (filteredForbidden.length) {
    filteredForbidden.forEach((key) => errors.push({ field: `shadowCycleEnvelope.${key}`, code: 'forbidden_key' }));
  }
  return {
    shadowCycleEnvelopeRef: envelope.shadowCycleEnvelopeId
      ? {
        shadowCycleEnvelopeId: envelope.shadowCycleEnvelopeId,
        contractVersion: envelope.contractVersion || SHADOW_RUNTIME_CONTRACT_VERSION,
      }
      : envelope.shadowCycleEnvelopeRef || null,
    shadowRecordingRef: envelope.shadowRecordingRef || (
      envelope.shadowRecordingArtifact
        ? {
          shadowRecordingArtifactId: envelope.shadowRecordingArtifact.shadowRecordingArtifactId,
          contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
          maturity: envelope.shadowRecordingArtifact.maturity,
        }
        : null
    ),
    marketContextRef: envelope.marketContextRef || null,
    decisionContextRef: envelope.decisionContextRef || null,
    decisionRef: envelope.decisionRef || null,
    evidenceOrchestrationRef: envelope.evidenceOrchestrationRef || null,
    controlChainRef: envelope.controlChainRef || null,
  };
}

function refsFingerprint(refs) {
  return stableJson({
    marketContextId: refs.marketContextRef.marketContextId,
    contextId: refs.decisionContextRef.contextId,
    decisionId: refs.decisionRef.decisionId,
    orchestrationId: refs.evidenceOrchestrationRef.orchestrationId,
    controlChainArtifactId: refs.controlChainRef.controlChainArtifactId,
    shadowCycleEnvelopeId: refs.shadowCycleEnvelopeRef.shadowCycleEnvelopeId,
    shadowRecordingArtifactId: refs.shadowRecordingRef.shadowRecordingArtifactId,
  });
}

function artifactsStructurallyEqual(a, b) {
  return stableJson(a) === stableJson(b);
}

/**
 * Build a SHADOW_TASK_CYCLE_BINDING from a READY Task State + canonical refs.
 *
 * @param {object} input
 * @returns {{ ok: true, artifact: object, sideEffects: object }
 *   | { ok: false, code: string, message: string, errors?: array }}
 */
export function buildShadowTaskCycleBinding(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Shadow task cycle binding input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }

  const errors = [];

  if (Object.prototype.hasOwnProperty.call(input, 'runId')) {
    errors.push({ field: 'runId', code: 'forbidden_run_id' });
  }

  const forbidden = collectForbiddenKeys(input);
  // Allow shadowCycleEnvelope.shadowRecordingArtifact path for ref extraction only.
  const filteredForbidden = forbidden.filter(
    (k) => !(k.startsWith('shadowCycleEnvelope.shadowRecordingArtifact')),
  );
  filteredForbidden.forEach((key) => errors.push({ field: key, code: 'forbidden_key' }));
  const secretKeys = collectForbiddenSecretKeys(input);
  secretKeys.forEach((key) => errors.push({ field: key, code: 'forbidden_secret_key' }));

  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Unknown Shadow task cycle binding input fields', { errors });
  }

  validateHardFlagsOnInput(input, errors);

  for (const key of EMBEDDED_PAYLOAD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      errors.push({ field: key, code: 'embedded_payload_forbidden' });
    }
  }

  const taskState = input.taskState;
  if (taskState == null) {
    return fail('missing_task_state', 'READY Shadow Task State artifact is required', {
      errors: [{ field: 'taskState', code: 'missing_task_state' }],
    });
  }
  if (typeof taskState !== 'object' || Array.isArray(taskState)) {
    return fail('malformed_task_state', 'taskState must be a plain object', {
      errors: [{ field: 'taskState', code: 'malformed_task_state' }],
    });
  }

  validateHardFlagsOnInput(taskState, errors);
  if (taskState.sideEffects != null && typeof taskState.sideEffects === 'object') {
    for (const [k, v] of Object.entries(taskState.sideEffects)) {
      if (v !== 0) {
        errors.push({ field: `taskState.sideEffects.${k}`, code: 'side_effect_must_be_zero' });
      }
    }
  }

  if (taskState.artifactType !== SHADOW_TASK_STATE_ARTIFACT_TYPE) {
    errors.push({ field: 'taskState.artifactType', code: 'invalid_artifact_type' });
  }
  if (taskState.contractVersion !== SHADOW_TASK_STATE_CONTRACT_VERSION) {
    errors.push({
      field: 'taskState.contractVersion',
      code: 'contract_version_mismatch',
      expected: SHADOW_TASK_STATE_CONTRACT_VERSION,
    });
  }
  if (taskState.status !== SHADOW_TASK_STATUS.READY) {
    return fail('task_state_not_ready', 'Only READY Task State may be bound', {
      errors: [{
        field: 'taskState.status',
        code: 'task_state_not_ready',
        actual: taskState.status,
      }],
    });
  }
  if (taskState.taskType !== SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE) {
    return fail('invalid_task_type', 'taskType must be SHADOW_EVALUATION_CYCLE', {
      errors: [{ field: 'taskState.taskType', code: 'invalid_task_type' }],
    });
  }
  if (!isCanonicalUuid(taskState.taskId)) {
    return fail('missing_task_id', 'taskState.taskId must be a canonical UUID', {
      errors: [{ field: 'taskState.taskId', code: 'invalid_uuid' }],
    });
  }
  if (!Number.isInteger(taskState.attempt) || taskState.attempt < 1) {
    errors.push({ field: 'taskState.attempt', code: 'invalid_attempt' });
  }

  if (input.taskId != null) {
    if (!isCanonicalUuid(input.taskId)) {
      return fail('invalid_task_id', 'Caller-supplied taskId is not a canonical UUID', {
        errors: [{ field: 'taskId', code: 'invalid_task_id' }],
      });
    }
    if (input.taskId !== taskState.taskId) {
      return fail('task_id_mismatch', 'Caller taskId does not match Task State taskId', {
        errors: [{
          field: 'taskId',
          code: 'task_id_mismatch',
          expected: taskState.taskId,
          actual: input.taskId,
        }],
      });
    }
  }

  if (input.attempt != null) {
    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      errors.push({ field: 'attempt', code: 'invalid_attempt' });
    } else if (input.attempt !== taskState.attempt) {
      return fail('attempt_mismatch', 'Caller attempt does not match Task State attempt', {
        errors: [{
          field: 'attempt',
          code: 'attempt_mismatch',
          expected: taskState.attempt,
          actual: input.attempt,
        }],
      });
    }
  }

  if (input.recordedAt == null || typeof input.recordedAt !== 'string' || !isIsoTimestamp(input.recordedAt)) {
    return fail('invalid_recorded_at', 'recordedAt must be a valid ISO timestamp', {
      errors: [{ field: 'recordedAt', code: 'invalid_recorded_at' }],
    });
  }
  if (taskState.recordedAt && input.recordedAt < taskState.recordedAt) {
    errors.push({ field: 'recordedAt', code: 'recorded_at_before_task_state' });
  }
  if (taskState.createdAt && input.recordedAt < taskState.createdAt) {
    errors.push({ field: 'recordedAt', code: 'recorded_at_before_created_at' });
  }

  const correlationId = input.correlationId != null
    ? input.correlationId
    : taskState.correlationId;
  if (correlationId != null && !isCanonicalUuid(correlationId)) {
    errors.push({ field: 'correlationId', code: 'invalid_uuid' });
  }
  if (input.correlationId != null && taskState.correlationId != null
    && input.correlationId !== taskState.correlationId) {
    errors.push({ field: 'correlationId', code: 'correlation_id_mismatch' });
  }

  const envelopeExtract = extractEnvelopeRefs(input.shadowCycleEnvelope, errors);

  const marketContextRefRaw = resolveRef(
    input.marketContextRef,
    taskState.marketContextRef || envelopeExtract?.marketContextRef,
    projectMarketContextRef,
    'marketContextRef',
    errors,
  );
  const decisionContextRefRaw = resolveRef(
    input.decisionContextRef,
    taskState.decisionContextRef || envelopeExtract?.decisionContextRef,
    projectDecisionContextRef,
    'decisionContextRef',
    errors,
  );

  let marketContextRef = null;
  if (marketContextRefRaw) {
    marketContextRef = validateThinRef(
      marketContextRefRaw,
      'marketContextRef',
      ALLOWED_MARKET_CONTEXT_REF,
      'marketContextId',
      MARKET_CONTEXT_CONTRACT_VERSION,
      errors,
    );
  }

  let decisionContextRef = null;
  if (decisionContextRefRaw) {
    decisionContextRef = validateThinRef(
      decisionContextRefRaw,
      'decisionContextRef',
      ALLOWED_DECISION_CONTEXT_REF,
      'contextId',
      DECISION_CONTEXT_CONTRACT_VERSION,
      errors,
    );
    if (decisionContextRef && decisionContextRef.maturity !== DECISION_MATURITY_MODE.SHADOW) {
      errors.push({ field: 'decisionContextRef.maturity', code: 'maturity_must_be_shadow' });
    }
  }

  const decisionRefSource = input.decisionRef
    || taskState.decisionRef
    || envelopeExtract?.decisionRef;
  const evidenceSource = input.evidenceOrchestrationRef
    || taskState.evidenceOrchestrationRef
    || envelopeExtract?.evidenceOrchestrationRef;
  const controlSource = input.controlChainRef
    || taskState.controlChainRef
    || envelopeExtract?.controlChainRef;
  const cycleSource = input.shadowCycleEnvelopeRef
    || taskState.shadowCycleEnvelopeRef
    || envelopeExtract?.shadowCycleEnvelopeRef;
  const recordingSource = input.shadowRecordingRef
    || taskState.shadowRecordingRef
    || envelopeExtract?.shadowRecordingRef;

  // Match explicit input vs taskState when both present.
  const matchPairs = [
    ['decisionRef', 'decisionId', input.decisionRef, taskState.decisionRef],
    ['evidenceOrchestrationRef', 'orchestrationId', input.evidenceOrchestrationRef, taskState.evidenceOrchestrationRef],
    ['controlChainRef', 'controlChainArtifactId', input.controlChainRef, taskState.controlChainRef],
    ['shadowCycleEnvelopeRef', 'shadowCycleEnvelopeId', input.shadowCycleEnvelopeRef, taskState.shadowCycleEnvelopeRef],
    ['shadowRecordingRef', 'shadowRecordingArtifactId', input.shadowRecordingRef, taskState.shadowRecordingRef],
  ];
  for (const [field, idField, a, b] of matchPairs) {
    if (a != null && b != null && a[idField] !== b[idField]) {
      errors.push({ field, code: `${field}_mismatch` });
    }
  }

  const decisionRef = validateThinRef(
    decisionRefSource,
    'decisionRef',
    ALLOWED_DECISION_REF,
    'decisionId',
    DECISION_CONTRACT_VERSION,
    errors,
  );
  const evidenceOrchestrationRef = validateThinRef(
    evidenceSource,
    'evidenceOrchestrationRef',
    ALLOWED_EVIDENCE_ORCHESTRATION_REF,
    'orchestrationId',
    ORCHESTRATION_CONTRACT_VERSION,
    errors,
  );
  const controlChainRef = validateThinRef(
    controlSource,
    'controlChainRef',
    ALLOWED_CONTROL_CHAIN_REF,
    'controlChainArtifactId',
    CONTROL_CHAIN_CONTRACT_VERSION,
    errors,
  );
  const shadowCycleEnvelopeRef = validateThinRef(
    cycleSource,
    'shadowCycleEnvelopeRef',
    ALLOWED_SHADOW_CYCLE_ENVELOPE_REF,
    'shadowCycleEnvelopeId',
    SHADOW_RUNTIME_CONTRACT_VERSION,
    errors,
  );
  const shadowRecordingRef = validateThinRef(
    recordingSource,
    'shadowRecordingRef',
    ALLOWED_SHADOW_RECORDING_REF,
    'shadowRecordingArtifactId',
    SHADOW_RECORDING_CONTRACT_VERSION,
    errors,
  );
  if (shadowRecordingRef && shadowRecordingRef.maturity !== DECISION_MATURITY_MODE.SHADOW) {
    errors.push({ field: 'shadowRecordingRef.maturity', code: 'maturity_must_be_shadow' });
  }

  if (input.lineage != null) {
    assertAllowlist(input.lineage, ALLOWED_LINEAGE, 'lineage', errors);
  }
  if (input.provenance != null) {
    assertAllowlist(input.provenance, ALLOWED_PROVENANCE, 'provenance', errors);
  }

  if (errors.length) {
    return fail('shadow_task_cycle_binding_invalid', 'Shadow task cycle binding failed validation', {
      errors,
    });
  }

  const taskId = taskState.taskId;
  const attempt = taskState.attempt;

  const bindingId = hashToUuid([
    SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    SHADOW_TASK_CYCLE_BINDING_ARTIFACT_TYPE,
    taskId,
    String(attempt),
    shadowCycleEnvelopeRef.shadowCycleEnvelopeId,
    shadowRecordingRef.shadowRecordingArtifactId,
    input.recordedAt,
  ]);

  if (!isCanonicalUuid(bindingId)) {
    return fail('binding_identity_failed', 'Failed to derive deterministic bindingId');
  }

  const taskStateRef = freezeDeep({
    taskId,
    contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
    status: SHADOW_TASK_STATUS.READY,
    taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
    attempt,
  });

  const lineage = freezeDeep({
    bindingId,
    taskId,
    marketContextId: marketContextRef.marketContextId,
    contextId: decisionContextRef.contextId,
    decisionId: decisionRef.decisionId,
    orchestrationId: evidenceOrchestrationRef.orchestrationId,
    controlChainArtifactId: controlChainRef.controlChainArtifactId,
    shadowCycleEnvelopeId: shadowCycleEnvelopeRef.shadowCycleEnvelopeId,
    shadowRecordingArtifactId: shadowRecordingRef.shadowRecordingArtifactId,
    ...(correlationId ? { correlationId } : {}),
    shadowTaskCycleBindingContractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    shadowTaskStateContractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
    marketContextContractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    decisionContractVersion: DECISION_CONTRACT_VERSION,
    orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
    controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    shadowRuntimeContractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    ...(input.lineage || {}),
  });

  if (lineage.taskId !== taskId
    || lineage.bindingId !== bindingId
    || lineage.marketContextId !== marketContextRef.marketContextId
    || lineage.contextId !== decisionContextRef.contextId
    || lineage.decisionId !== decisionRef.decisionId
    || lineage.orchestrationId !== evidenceOrchestrationRef.orchestrationId
    || lineage.controlChainArtifactId !== controlChainRef.controlChainArtifactId
    || lineage.shadowCycleEnvelopeId !== shadowCycleEnvelopeRef.shadowCycleEnvelopeId
    || lineage.shadowRecordingArtifactId !== shadowRecordingRef.shadowRecordingArtifactId) {
    return fail('lineage_mismatch', 'lineage identity mismatch', {
      errors: [{ field: 'lineage', code: 'lineage_mismatch' }],
    });
  }

  const provenance = freezeDeep({
    writer: SHADOW_TASK_CYCLE_BINDING_WRITER,
    methodKey: SHADOW_TASK_CYCLE_BINDING_METHOD_KEY,
    stage: SHADOW_TASK_CYCLE_BINDING_STAGE,
    recordedAt: input.recordedAt,
    note: 'library_composition_lineage_only',
    policyVersion: SHADOW_TASK_CYCLE_BINDING_POLICY_VERSION,
    implementationVersion:
      input.implementationVersion || SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    ...(input.provenance || {}),
  });

  if (provenance.writer !== SHADOW_TASK_CYCLE_BINDING_WRITER) {
    return fail('provenance_mismatch', 'provenance.writer mismatch', {
      errors: [{ field: 'provenance.writer', code: 'provenance_mismatch' }],
    });
  }

  const artifact = {
    schemaVersion: SHADOW_TASK_CYCLE_BINDING_SCHEMA_VERSION,
    contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    policyVersion: SHADOW_TASK_CYCLE_BINDING_POLICY_VERSION,
    artifactType: SHADOW_TASK_CYCLE_BINDING_ARTIFACT_TYPE,
    bindingId,
    taskId,
    taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
    attempt,
    recordedAt: input.recordedAt,
    ...(correlationId ? { correlationId } : {}),
    taskStateRef,
    shadowCycleEnvelopeRef: freezeDeep(shadowCycleEnvelopeRef),
    shadowRecordingRef: freezeDeep(shadowRecordingRef),
    marketContextRef: freezeDeep(marketContextRef),
    decisionContextRef: freezeDeep(decisionContextRef),
    decisionRef: freezeDeep(decisionRef),
    evidenceOrchestrationRef: freezeDeep(evidenceOrchestrationRef),
    controlChainRef: freezeDeep(controlChainRef),
    lineage,
    provenance,
    limitations: [...SHADOW_TASK_CYCLE_BINDING_LIMITATIONS],
    sideEffects: { ...ZERO_SHADOW_TASK_CYCLE_BINDING_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
    implementationVersion:
      input.implementationVersion || SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
  };

  if (!assertAllowlist(artifact, ALLOWED_ARTIFACT_TOP, 'artifact', errors)) {
    return fail('artifact_unknown_field', 'Binding artifact contains unknown fields', { errors });
  }

  const bytes = utf8ByteLength(JSON.stringify(artifact));
  if (bytes > MAX_SHADOW_TASK_CYCLE_BINDING_UTF8_BYTES) {
    return fail('artifact_too_large', 'Shadow task cycle binding exceeds size bound', {
      errors: [{ field: 'artifact', code: 'artifact_too_large', bytes }],
    });
  }

  // Idempotency / lineage conflict against existingArtifact.
  if (input.existingArtifact != null) {
    const existing = input.existingArtifact;
    if (typeof existing !== 'object' || Array.isArray(existing)) {
      return fail('malformed_existing_artifact', 'existingArtifact must be a plain object', {
        errors: [{ field: 'existingArtifact', code: 'malformed_existing_artifact' }],
      });
    }
    if (existing.artifactType !== SHADOW_TASK_CYCLE_BINDING_ARTIFACT_TYPE) {
      return fail('existing_artifact_type_mismatch', 'existingArtifact is not a SHADOW_TASK_CYCLE_BINDING', {
        errors: [{ field: 'existingArtifact.artifactType', code: 'existing_artifact_type_mismatch' }],
      });
    }

    const sameTask = existing.taskId === taskId;
    const sameEnvelope = existing.shadowCycleEnvelopeRef?.shadowCycleEnvelopeId
      === shadowCycleEnvelopeRef.shadowCycleEnvelopeId;

    if (sameEnvelope && existing.taskId !== taskId) {
      return fail(
        'envelope_task_lineage_conflict',
        'Same shadowCycleEnvelopeId cannot bind to a different taskId',
        {
          errors: [{ field: 'shadowCycleEnvelopeRef', code: 'envelope_task_lineage_conflict' }],
        },
      );
    }

    if (sameTask) {
      const existingFp = refsFingerprint({
        marketContextRef: existing.marketContextRef,
        decisionContextRef: existing.decisionContextRef,
        decisionRef: existing.decisionRef,
        evidenceOrchestrationRef: existing.evidenceOrchestrationRef,
        controlChainRef: existing.controlChainRef,
        shadowCycleEnvelopeRef: existing.shadowCycleEnvelopeRef,
        shadowRecordingRef: existing.shadowRecordingRef,
      });
      const nextFp = refsFingerprint({
        marketContextRef,
        decisionContextRef,
        decisionRef,
        evidenceOrchestrationRef,
        controlChainRef,
        shadowCycleEnvelopeRef,
        shadowRecordingRef,
      });
      if (existingFp !== nextFp) {
        return fail(
          'task_ref_lineage_conflict',
          'Same taskId cannot bind different upstream refs',
          {
            errors: [{ field: 'taskId', code: 'task_ref_lineage_conflict' }],
          },
        );
      }
      if (existing.attempt === attempt && existing.recordedAt === input.recordedAt) {
        if (!artifactsStructurallyEqual(existing, artifact)) {
          return fail(
            'idempotency_conflict',
            'Same READY Task State + refs + recordedAt must yield identical binding',
            {
              errors: [{ field: 'existingArtifact', code: 'idempotency_conflict' }],
            },
          );
        }
        return {
          ok: true,
          code: 'SHADOW_TASK_CYCLE_BINDING_IDEMPOTENT',
          artifact: freezeDeep(existing),
          sideEffects: ZERO_SHADOW_TASK_CYCLE_BINDING_SIDE_EFFECTS,
          taskStateMutation: 0,
          idempotent: true,
        };
      }
    }
  }

  const frozen = freezeDeep(artifact);

  return {
    ok: true,
    code: 'SHADOW_TASK_CYCLE_BINDING_BUILT',
    artifact: frozen,
    sideEffects: ZERO_SHADOW_TASK_CYCLE_BINDING_SIDE_EFFECTS,
    taskStateMutation: 0,
    bindingId,
  };
}

export function validateShadowTaskCycleBinding(input = {}) {
  return buildShadowTaskCycleBinding(input);
}

export default {
  SHADOW_TASK_CYCLE_BINDING_STAGE,
  SHADOW_TASK_CYCLE_BINDING_SCHEMA_VERSION,
  SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
  SHADOW_TASK_CYCLE_BINDING_POLICY_VERSION,
  SHADOW_TASK_CYCLE_BINDING_WRITER,
  SHADOW_TASK_CYCLE_BINDING_METHOD_KEY,
  SHADOW_TASK_CYCLE_BINDING_ARTIFACT_TYPE,
  MAX_SHADOW_TASK_CYCLE_BINDING_UTF8_BYTES,
  ZERO_SHADOW_TASK_CYCLE_BINDING_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS,
  SHADOW_TASK_CYCLE_BINDING_LIMITATIONS,
  buildShadowTaskCycleBinding,
  validateShadowTaskCycleBinding,
};
