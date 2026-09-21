/**
 * Artemis Core Stage 8 — Shadow Task State Activation Boundary
 * (S8-SHADOW-TASK-STATE-ACTIVATION).
 *
 * Deterministic, non-executing, in-memory activation of ONE Shadow evaluation
 * cycle Task State lifecycle:
 *
 *   READY → RUNNING → SUCCEEDED
 *
 * Consumes closed:
 *   S8-SHADOW-TASK-STATE
 *   S8-SHADOW-RT-BOUNDARY (cycle envelope refs)
 *   S8-SHADOW-TASK-CYCLE-BINDING
 *   C8.1 recording ref
 *
 * Does NOT:
 *   - create Worker / Scheduler / queue / lease / lock / PM2
 *   - activate global Shadow Runtime
 *   - write DB / Redis / network / provider / LLM / orders / wallet
 *   - activate B10 / Outcome / Live / Paper
 *   - invent a second taskId identity family or Task State SoT
 */

import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  FORBIDDEN_CONTROL_CHAIN_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
} from './artemisControlChainContract.js';
import { DECISION_MATURITY_MODE } from './artemisDecisionContextContract.js';
import {
  SHADOW_CYCLE_ARTIFACT_TYPE,
  SHADOW_RUNTIME_CONTRACT_VERSION,
} from './artemisShadowRuntimeLibraryBoundaryContract.js';
import {
  SHADOW_RECORDING_CONTRACT_VERSION,
  ZERO_SHADOW_RECORDING_SIDE_EFFECTS,
} from './artemisShadowDecisionRecordingBoundaryContract.js';
import {
  SHADOW_TASK_CYCLE_BINDING_ARTIFACT_TYPE,
  SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
} from './artemisShadowTaskCycleCompositionBoundaryContract.js';
import {
  SHADOW_TASK_STATE_ARTIFACT_TYPE,
  SHADOW_TASK_STATE_CONTRACT_VERSION,
  SHADOW_TASK_STATUS,
  SHADOW_TASK_TYPE,
  ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS,
  buildShadowTaskState,
  composeActivatedShadowTaskState,
  isAllowedShadowTaskTransition,
  isTerminalShadowTaskStatus,
} from './artemisShadowTaskStateBoundaryContract.js';

export const SHADOW_TASK_STATE_ACTIVATION_STAGE =
  'ARTEMIS_CORE_STAGE_8_SHADOW_TASK_STATE_ACTIVATION_BOUNDARY';
export const SHADOW_TASK_STATE_ACTIVATION_SCHEMA_VERSION = '1.0.0';
export const SHADOW_TASK_STATE_ACTIVATION_CONTRACT_VERSION =
  'artemis-shadow-task-state-activation-boundary-1.0.0';
export const SHADOW_TASK_STATE_ACTIVATION_POLICY_VERSION =
  'stage8-shadow-task-state-activation-boundary-1.0.0';
export const SHADOW_TASK_STATE_ACTIVATION_WRITER =
  'artemisShadowTaskStateActivationBoundaryContract';
export const SHADOW_TASK_STATE_ACTIVATION_METHOD_KEY =
  'activate_shadow_task_state_cycle_fail_closed';
export const SHADOW_TASK_STATE_ACTIVATION_ARTIFACT_TYPE =
  'SHADOW_TASK_STATE_ACTIVATION_RESULT';

export const MAX_SHADOW_TASK_STATE_ACTIVATION_UTF8_BYTES = 48 * 1024;

export const ZERO_SHADOW_TASK_STATE_ACTIVATION_SIDE_EFFECTS = Object.freeze({
  ...ZERO_SHADOW_RECORDING_SIDE_EFFECTS,
  ...ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS,
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

/** Authority flags that must remain false on all activation surfaces.
 *  taskStateActivated is intentionally omitted: true only on the activation
 *  result envelope (local marker), never on Task State artifacts. */
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

export const SHADOW_TASK_STATE_ACTIVATION_LIMITATIONS = Object.freeze([
  'stage8_shadow_task_state_activation_boundary_only',
  'library_only',
  'in_memory_only',
  'deterministic_non_executing',
  'ready_to_running_to_succeeded_only',
  'one_shadow_evaluation_cycle',
  'task_state_activated_result_marker_only',
  'does_not_activate_worker_or_scheduler',
  'does_not_activate_global_shadow_runtime',
  'does_not_create_parallel_sot',
  'references_only_no_embedded_payloads',
  'persistence_not_enabled',
  'b10_not_activated',
  'observed_outcome_deferred',
  'does_not_authorize_execution',
  'does_not_call_llm_or_provider',
  'does_not_write_db_or_redis',
  'no_queue_lease_lock',
]);

const ALLOWED_INPUT_TOP = Object.freeze([
  'taskState',
  'cycleEnvelope',
  'binding',
  'shadowRecordingRef',
  'recordedAt',
  'correlationId',
  'existingRunningArtifact',
  'existingSucceededArtifact',
  'existingActivationResult',
  'implementationVersion',
  'lineage',
  'provenance',
  // Hard flags may appear only as explicit false (fail-closed if true).
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

const ALLOWED_RESULT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'taskId',
  'attempt',
  'recordedAt',
  'correlationId',
  'fromStatus',
  'toStatus',
  'runningTaskStateRef',
  'succeededTaskStateRef',
  'bindingRef',
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

const ALLOWED_BINDING_REF = Object.freeze([
  'bindingId',
  'contractVersion',
]);

const ALLOWED_CYCLE_REF = Object.freeze([
  'shadowCycleEnvelopeId',
  'contractVersion',
]);

const ALLOWED_RECORDING_REF = Object.freeze([
  'shadowRecordingArtifactId',
  'contractVersion',
  'maturity',
]);

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

const ALLOWED_DECISION_CONTEXT_REF = Object.freeze([
  'contextId',
  'contractVersion',
  'maturity',
]);

const ALLOWED_DECISION_REF = Object.freeze(['decisionId', 'contractVersion']);
const ALLOWED_ORCH_REF = Object.freeze(['orchestrationId', 'contractVersion']);
const ALLOWED_CONTROL_REF = Object.freeze(['controlChainArtifactId', 'contractVersion']);

const ALLOWED_LINEAGE = Object.freeze([
  'taskId',
  'attempt',
  'bindingId',
  'marketContextId',
  'contextId',
  'decisionId',
  'orchestrationId',
  'controlChainArtifactId',
  'shadowCycleEnvelopeId',
  'shadowRecordingArtifactId',
  'correlationId',
  'shadowTaskStateActivationContractVersion',
  'shadowTaskStateContractVersion',
  'shadowTaskCycleBindingContractVersion',
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
  'b10',
  'shadowWorker',
  'shadowScheduler',
  'scheduler',
  'queue',
  'EmergencyStop',
  'emergencyStopClear',
  'requestedRuntimeMode',
  'effectiveRuntimeMode',
  'shadowRecordingArtifact',
  'decision',
  'decisionContext',
  'evidenceOrchestrationSet',
  'controlChainArtifact',
]);

const HARD_FLAG_KEYS = Object.freeze([
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'liveTradingEnabled',
  'paperTradingEnabled',
  'providerConnected',
  'shadowRuntimeActivated',
  'persistenceEnabled',
  'b10WriteAttempted',
]);

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    artifact: null,
    runningArtifact: null,
    succeededArtifact: null,
    ...extra,
  };
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
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
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

function collectForbiddenKeys(value, acc = [], path = '') {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectForbiddenKeys(item, acc, `${path}[${i}]`));
    return acc;
  }
  for (const [key, nested] of Object.entries(value)) {
    // Opaque prior artifacts for idempotency — skip deep contamination scan.
    if (
      key === 'existingRunningArtifact'
      || key === 'existingSucceededArtifact'
      || key === 'existingActivationResult'
      || key === 'runningArtifact'
      || key === 'shadowRecordingArtifact'
      || key === 'taskState'
      || key === 'binding'
      || key === 'cycleEnvelope'
    ) {
      continue;
    }
    if (FORBIDDEN_EXTRA_KEYS.includes(key)) acc.push(key);
    if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(nested)) acc.push(`${key}:${nested}`);
    collectForbiddenKeys(nested, acc, path ? `${path}.${key}` : key);
  }
  return acc;
}

function validateHardFlagsFalse(obj, fieldPrefix, errors) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of HARD_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== false) {
      errors.push({ field: fieldPrefix ? `${fieldPrefix}.${key}` : key, code: 'hard_flag_must_be_false' });
    }
  }
  if (Object.prototype.hasOwnProperty.call(obj, 'taskStateActivated') && obj.taskStateActivated === true) {
    // Untrusted input must not inject the result-level marker.
    errors.push({
      field: fieldPrefix ? `${fieldPrefix}.taskStateActivated` : 'taskStateActivated',
      code: 'task_state_activated_from_input_forbidden',
    });
  }
}

function thinRef(obj, allowed, idField) {
  if (!obj || typeof obj !== 'object') return null;
  const out = { [idField]: obj[idField], contractVersion: obj.contractVersion };
  for (const key of allowed) {
    if (key !== idField && key !== 'contractVersion' && Object.prototype.hasOwnProperty.call(obj, key)) {
      out[key] = obj[key];
    }
  }
  return out;
}

function artifactsStructurallyEqual(a, b) {
  return stableJson(a) === stableJson(b);
}

function validateReadyTaskState(taskState, errors) {
  if (taskState == null) {
    errors.push({ field: 'taskState', code: 'missing_task_state' });
    return null;
  }
  if (typeof taskState !== 'object' || Array.isArray(taskState)) {
    errors.push({ field: 'taskState', code: 'malformed_task_state' });
    return null;
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
  if (taskState.taskType !== SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE) {
    errors.push({ field: 'taskState.taskType', code: 'invalid_task_type' });
  }
  if (taskState.status !== SHADOW_TASK_STATUS.READY) {
    errors.push({
      field: 'taskState.status',
      code: 'task_state_not_ready',
      actual: taskState.status,
    });
  }
  if (!isCanonicalUuid(taskState.taskId)) {
    errors.push({ field: 'taskState.taskId', code: 'invalid_task_id' });
  }
  if (!Number.isInteger(taskState.attempt) || taskState.attempt < 1) {
    errors.push({ field: 'taskState.attempt', code: 'invalid_attempt' });
  }
  if (!taskState.marketContextRef || !isCanonicalUuid(taskState.marketContextRef.marketContextId)) {
    errors.push({ field: 'taskState.marketContextRef', code: 'missing_market_context_ref' });
  }
  if (!taskState.decisionContextRef || !isCanonicalUuid(taskState.decisionContextRef.contextId)) {
    errors.push({ field: 'taskState.decisionContextRef', code: 'missing_decision_context_ref' });
  }
  if (taskState.decisionContextRef?.maturity != null
    && taskState.decisionContextRef.maturity !== DECISION_MATURITY_MODE.SHADOW) {
    errors.push({ field: 'taskState.decisionContextRef.maturity', code: 'maturity_must_be_shadow' });
  }
  validateHardFlagsFalse(taskState, 'taskState', errors);

  // Re-validate READY composition deterministically (identity / hard flags).
  const rebuilt = buildShadowTaskState({
    taskType: taskState.taskType,
    status: SHADOW_TASK_STATUS.READY,
    createdAt: taskState.createdAt,
    recordedAt: taskState.recordedAt,
    attempt: taskState.attempt,
    ...(taskState.correlationId ? { correlationId: taskState.correlationId } : {}),
    marketContextRef: taskState.marketContextRef,
    decisionContextRef: taskState.decisionContextRef,
    ...(taskState.decisionRef ? { decisionRef: taskState.decisionRef } : {}),
    ...(taskState.evidenceOrchestrationRef
      ? { evidenceOrchestrationRef: taskState.evidenceOrchestrationRef }
      : {}),
    ...(taskState.controlChainRef ? { controlChainRef: taskState.controlChainRef } : {}),
    ...(taskState.shadowCycleEnvelopeRef
      ? { shadowCycleEnvelopeRef: taskState.shadowCycleEnvelopeRef }
      : {}),
    ...(taskState.shadowRecordingRef ? { shadowRecordingRef: taskState.shadowRecordingRef } : {}),
    taskId: taskState.taskId,
  });
  if (!rebuilt.ok) {
    errors.push({
      field: 'taskState',
      code: 'task_state_revalidation_failed',
      detail: rebuilt.code,
    });
    return null;
  }
  if (rebuilt.artifact.taskId !== taskState.taskId) {
    errors.push({ field: 'taskState.taskId', code: 'identity_mismatch' });
  }
  return taskState;
}

function validateCycleEnvelope(envelope, errors) {
  if (envelope == null) {
    errors.push({ field: 'cycleEnvelope', code: 'missing_cycle_envelope' });
    return null;
  }
  if (typeof envelope !== 'object' || Array.isArray(envelope)) {
    errors.push({ field: 'cycleEnvelope', code: 'malformed_cycle_envelope' });
    return null;
  }
  if (envelope.artifactType !== SHADOW_CYCLE_ARTIFACT_TYPE) {
    errors.push({ field: 'cycleEnvelope.artifactType', code: 'invalid_artifact_type' });
  }
  if (envelope.contractVersion !== SHADOW_RUNTIME_CONTRACT_VERSION) {
    errors.push({
      field: 'cycleEnvelope.contractVersion',
      code: 'contract_version_mismatch',
      expected: SHADOW_RUNTIME_CONTRACT_VERSION,
    });
  }
  if (!isCanonicalUuid(envelope.shadowCycleEnvelopeId)) {
    errors.push({ field: 'cycleEnvelope.shadowCycleEnvelopeId', code: 'invalid_uuid' });
  }
  const requiredRefs = [
    ['marketContextRef', 'marketContextId'],
    ['decisionContextRef', 'contextId'],
    ['decisionRef', 'decisionId'],
    ['evidenceOrchestrationRef', 'orchestrationId'],
    ['controlChainRef', 'controlChainArtifactId'],
    ['shadowRecordingRef', 'shadowRecordingArtifactId'],
  ];
  for (const [field, idField] of requiredRefs) {
    const ref = envelope[field];
    if (!ref || typeof ref !== 'object' || !isCanonicalUuid(ref[idField])) {
      errors.push({ field: `cycleEnvelope.${field}`, code: `missing_${field}` });
    }
  }
  if (envelope.shadowRecordingRef?.contractVersion != null
    && envelope.shadowRecordingRef.contractVersion !== SHADOW_RECORDING_CONTRACT_VERSION) {
    errors.push({
      field: 'cycleEnvelope.shadowRecordingRef.contractVersion',
      code: 'contract_version_mismatch',
      expected: SHADOW_RECORDING_CONTRACT_VERSION,
    });
  }
  if (envelope.shadowRecordingRef?.maturity != null
    && envelope.shadowRecordingRef.maturity !== DECISION_MATURITY_MODE.SHADOW) {
    errors.push({
      field: 'cycleEnvelope.shadowRecordingRef.maturity',
      code: 'maturity_must_be_shadow',
    });
  }
  if (envelope.decisionContextRef?.maturity != null
    && envelope.decisionContextRef.maturity !== DECISION_MATURITY_MODE.SHADOW) {
    errors.push({
      field: 'cycleEnvelope.decisionContextRef.maturity',
      code: 'maturity_must_be_shadow',
    });
  }
  validateHardFlagsFalse(envelope, 'cycleEnvelope', errors);

  // Contaminating full payloads must not drive activation identity.
  for (const key of [
    'ohlcv', 'ticker', 'orderBook', 'candles', 'rawSeries', 'marketSnapshot',
    'order', 'executionIntent', 'walletAction', 'observedOutcome', 'lookahead',
    'workerId', 'lease', 'lock', 'scheduler', 'queue', 'b10',
  ]) {
    if (Object.prototype.hasOwnProperty.call(envelope, key)) {
      errors.push({ field: `cycleEnvelope.${key}`, code: 'forbidden_key' });
    }
  }
  return envelope;
}

function validateBinding(binding, errors) {
  if (binding == null) {
    errors.push({ field: 'binding', code: 'missing_binding' });
    return null;
  }
  if (typeof binding !== 'object' || Array.isArray(binding)) {
    errors.push({ field: 'binding', code: 'malformed_binding' });
    return null;
  }
  if (binding.artifactType !== SHADOW_TASK_CYCLE_BINDING_ARTIFACT_TYPE) {
    errors.push({ field: 'binding.artifactType', code: 'invalid_artifact_type' });
  }
  if (binding.contractVersion !== SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION) {
    errors.push({
      field: 'binding.contractVersion',
      code: 'contract_version_mismatch',
      expected: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    });
  }
  if (!isCanonicalUuid(binding.bindingId)) {
    errors.push({ field: 'binding.bindingId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(binding.taskId)) {
    errors.push({ field: 'binding.taskId', code: 'invalid_task_id' });
  }
  if (binding.taskStateRef?.status !== SHADOW_TASK_STATUS.READY) {
    errors.push({ field: 'binding.taskStateRef.status', code: 'task_state_not_ready' });
  }
  validateHardFlagsFalse(binding, 'binding', errors);
  return binding;
}

function assertLineageMatch(taskState, envelope, binding, recordingRef, errors) {
  if (binding.taskId !== taskState.taskId) {
    errors.push({ field: 'binding.taskId', code: 'task_id_mismatch' });
  }
  if (binding.taskStateRef?.taskId != null && binding.taskStateRef.taskId !== taskState.taskId) {
    errors.push({ field: 'binding.taskStateRef.taskId', code: 'task_id_mismatch' });
  }
  if (binding.attempt != null && binding.attempt !== taskState.attempt) {
    errors.push({ field: 'binding.attempt', code: 'attempt_mismatch' });
  }
  if (binding.taskStateRef?.attempt != null && binding.taskStateRef.attempt !== taskState.attempt) {
    errors.push({ field: 'binding.taskStateRef.attempt', code: 'attempt_mismatch' });
  }

  const envCycleId = envelope.shadowCycleEnvelopeId;
  const bindCycleId = binding.shadowCycleEnvelopeRef?.shadowCycleEnvelopeId;
  if (bindCycleId !== envCycleId) {
    errors.push({ field: 'binding.shadowCycleEnvelopeRef', code: 'cycle_envelope_mismatch' });
  }

  const envRecId = envelope.shadowRecordingRef?.shadowRecordingArtifactId;
  const bindRecId = binding.shadowRecordingRef?.shadowRecordingArtifactId;
  const inputRecId = recordingRef?.shadowRecordingArtifactId;
  if (bindRecId !== envRecId) {
    errors.push({ field: 'binding.shadowRecordingRef', code: 'c8_1_recording_ref_mismatch' });
  }
  if (inputRecId != null && inputRecId !== envRecId) {
    errors.push({ field: 'shadowRecordingRef', code: 'c8_1_recording_ref_mismatch' });
  }

  const mcTask = taskState.marketContextRef?.marketContextId;
  const mcEnv = envelope.marketContextRef?.marketContextId;
  const mcBind = binding.marketContextRef?.marketContextId;
  if (mcTask !== mcEnv || mcTask !== mcBind) {
    errors.push({ field: 'marketContextRef', code: 'market_context_ref_lineage_mismatch' });
  }

  const ctxTask = taskState.decisionContextRef?.contextId;
  const ctxEnv = envelope.decisionContextRef?.contextId;
  const ctxBind = binding.decisionContextRef?.contextId;
  if (ctxTask !== ctxEnv || ctxTask !== ctxBind) {
    errors.push({ field: 'decisionContextRef', code: 'decision_context_ref_mismatch' });
  }

  if (taskState.decisionRef?.decisionId != null
    && envelope.decisionRef?.decisionId != null
    && taskState.decisionRef.decisionId !== envelope.decisionRef.decisionId) {
    errors.push({ field: 'decisionRef', code: 'decision_ref_mismatch' });
  }
  if (binding.decisionRef?.decisionId != null
    && envelope.decisionRef?.decisionId != null
    && binding.decisionRef.decisionId !== envelope.decisionRef.decisionId) {
    errors.push({ field: 'binding.decisionRef', code: 'decision_ref_mismatch' });
  }

  if (taskState.evidenceOrchestrationRef?.orchestrationId != null
    && envelope.evidenceOrchestrationRef?.orchestrationId != null
    && taskState.evidenceOrchestrationRef.orchestrationId
      !== envelope.evidenceOrchestrationRef.orchestrationId) {
    errors.push({ field: 'evidenceOrchestrationRef', code: 'evidence_orchestration_ref_mismatch' });
  }
  if (binding.evidenceOrchestrationRef?.orchestrationId != null
    && envelope.evidenceOrchestrationRef?.orchestrationId != null
    && binding.evidenceOrchestrationRef.orchestrationId
      !== envelope.evidenceOrchestrationRef.orchestrationId) {
    errors.push({
      field: 'binding.evidenceOrchestrationRef',
      code: 'evidence_orchestration_ref_mismatch',
    });
  }

  if (taskState.controlChainRef?.controlChainArtifactId != null
    && envelope.controlChainRef?.controlChainArtifactId != null
    && taskState.controlChainRef.controlChainArtifactId
      !== envelope.controlChainRef.controlChainArtifactId) {
    errors.push({ field: 'controlChainRef', code: 'control_chain_ref_mismatch' });
  }
  if (binding.controlChainRef?.controlChainArtifactId != null
    && envelope.controlChainRef?.controlChainArtifactId != null
    && binding.controlChainRef.controlChainArtifactId
      !== envelope.controlChainRef.controlChainArtifactId) {
    errors.push({ field: 'binding.controlChainRef', code: 'control_chain_ref_mismatch' });
  }

  if (taskState.shadowCycleEnvelopeRef?.shadowCycleEnvelopeId != null
    && taskState.shadowCycleEnvelopeRef.shadowCycleEnvelopeId !== envCycleId) {
    errors.push({ field: 'taskState.shadowCycleEnvelopeRef', code: 'cycle_envelope_mismatch' });
  }
  if (taskState.shadowRecordingRef?.shadowRecordingArtifactId != null
    && taskState.shadowRecordingRef.shadowRecordingArtifactId !== envRecId) {
    errors.push({ field: 'taskState.shadowRecordingRef', code: 'c8_1_recording_ref_mismatch' });
  }

  if (taskState.contractVersion != null
    && taskState.contractVersion !== SHADOW_TASK_STATE_CONTRACT_VERSION) {
    errors.push({ field: 'taskState.contractVersion', code: 'contract_version_mismatch' });
  }
  if (envelope.contractVersion != null
    && envelope.contractVersion !== SHADOW_RUNTIME_CONTRACT_VERSION) {
    errors.push({ field: 'cycleEnvelope.contractVersion', code: 'contract_version_mismatch' });
  }
  if (binding.contractVersion != null
    && binding.contractVersion !== SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION) {
    errors.push({ field: 'binding.contractVersion', code: 'contract_version_mismatch' });
  }
}

function buildActivatedInputFromReady(taskState, status, envelope) {
  const base = {
    taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
    status,
    createdAt: taskState.createdAt,
    // Identity-stable: same recordedAt as READY so deriveTaskId preserves taskId.
    recordedAt: taskState.recordedAt,
    attempt: taskState.attempt,
    taskId: taskState.taskId,
    ...(taskState.correlationId ? { correlationId: taskState.correlationId } : {}),
    marketContextRef: taskState.marketContextRef,
    decisionContextRef: taskState.decisionContextRef,
    decisionRef: envelope.decisionRef || taskState.decisionRef,
    evidenceOrchestrationRef:
      envelope.evidenceOrchestrationRef || taskState.evidenceOrchestrationRef,
    controlChainRef: envelope.controlChainRef || taskState.controlChainRef,
  };

  if (status === SHADOW_TASK_STATUS.SUCCEEDED) {
    base.shadowCycleEnvelopeRef = {
      shadowCycleEnvelopeId: envelope.shadowCycleEnvelopeId,
      contractVersion: envelope.contractVersion || SHADOW_RUNTIME_CONTRACT_VERSION,
    };
    base.shadowRecordingRef = {
      shadowRecordingArtifactId: envelope.shadowRecordingRef.shadowRecordingArtifactId,
      contractVersion:
        envelope.shadowRecordingRef.contractVersion || SHADOW_RECORDING_CONTRACT_VERSION,
      ...(envelope.shadowRecordingRef.maturity != null
        ? { maturity: envelope.shadowRecordingRef.maturity }
        : { maturity: DECISION_MATURITY_MODE.SHADOW }),
    };
  } else if (taskState.shadowCycleEnvelopeRef) {
    base.shadowCycleEnvelopeRef = taskState.shadowCycleEnvelopeRef;
  }

  return base;
}

function toTaskStateRef(artifact) {
  return freezeDeep({
    taskId: artifact.taskId,
    contractVersion: artifact.contractVersion,
    status: artifact.status,
    taskType: artifact.taskType,
    attempt: artifact.attempt,
  });
}

/**
 * Activate one Shadow evaluation cycle:
 * READY → RUNNING → SUCCEEDED (library-only, non-executing).
 *
 * @param {object} input
 * @returns {object}
 */
export function activateShadowTaskStateCycle(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Activation input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }

  const errors = [];

  if (Object.prototype.hasOwnProperty.call(input, 'runId')) {
    errors.push({ field: 'runId', code: 'forbidden_run_id' });
  }

  const forbidden = collectForbiddenKeys(input);
  forbidden.forEach((key) => errors.push({ field: key, code: 'forbidden_key' }));
  const secretKeys = collectForbiddenSecretKeys(input);
  secretKeys.forEach((key) => errors.push({ field: key, code: 'forbidden_secret_key' }));

  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Unknown activation input fields', { errors });
  }

  validateHardFlagsFalse(input, '', errors);

  if (!isIsoTimestamp(input.recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'invalid_iso_timestamp' });
  }

  const taskState = validateReadyTaskState(input.taskState, errors);
  const envelope = validateCycleEnvelope(input.cycleEnvelope, errors);
  const binding = validateBinding(input.binding, errors);

  let recordingRef = input.shadowRecordingRef || null;
  if (recordingRef != null) {
    if (typeof recordingRef !== 'object' || Array.isArray(recordingRef)) {
      errors.push({ field: 'shadowRecordingRef', code: 'malformed_shadow_recording_ref' });
      recordingRef = null;
    } else if (!assertAllowlist(recordingRef, ALLOWED_RECORDING_REF, 'shadowRecordingRef', errors)) {
      recordingRef = null;
    } else if (!isCanonicalUuid(recordingRef.shadowRecordingArtifactId)) {
      errors.push({ field: 'shadowRecordingRef.shadowRecordingArtifactId', code: 'invalid_uuid' });
    }
  }

  if (taskState && envelope && binding) {
    assertLineageMatch(taskState, envelope, binding, recordingRef, errors);
  }

  if (errors.length) {
    return fail('activation_input_invalid', 'Shadow task state activation failed validation', {
      errors,
    });
  }

  if (isTerminalShadowTaskStatus(taskState.status)
    && taskState.status !== SHADOW_TASK_STATUS.READY) {
    return fail('terminal_mutation_rejected', 'Terminal task state cannot be activated', {
      errors: [{ field: 'taskState.status', code: 'terminal_mutation_rejected' }],
    });
  }

  if (!isAllowedShadowTaskTransition(SHADOW_TASK_STATUS.READY, SHADOW_TASK_STATUS.RUNNING)) {
    return fail('illegal_transition', 'READY → RUNNING is not allowed', {
      errors: [{ field: 'transition', code: 'illegal_transition' }],
    });
  }
  if (!isAllowedShadowTaskTransition(SHADOW_TASK_STATUS.RUNNING, SHADOW_TASK_STATUS.SUCCEEDED)) {
    return fail('illegal_transition', 'RUNNING → SUCCEEDED is not allowed', {
      errors: [{ field: 'transition', code: 'illegal_transition' }],
    });
  }

  // --- RUNNING ---
  const runningInput = buildActivatedInputFromReady(
    taskState,
    SHADOW_TASK_STATUS.RUNNING,
    envelope,
  );
  if (input.existingRunningArtifact != null) {
    runningInput.existingArtifact = input.existingRunningArtifact;
  }

  const running = composeActivatedShadowTaskState(runningInput);
  if (!running.ok) {
    return fail(
      running.code || 'running_composition_failed',
      running.message || 'READY → RUNNING composition failed',
      { errors: running.errors || [] },
    );
  }

  // --- SUCCEEDED ---
  const succeededInput = buildActivatedInputFromReady(
    taskState,
    SHADOW_TASK_STATUS.SUCCEEDED,
    envelope,
  );
  if (input.existingSucceededArtifact != null) {
    succeededInput.existingArtifact = input.existingSucceededArtifact;
  }

  const succeeded = composeActivatedShadowTaskState(succeededInput);
  if (!succeeded.ok) {
    return fail(
      succeeded.code || 'succeeded_composition_failed',
      succeeded.message || 'RUNNING → SUCCEEDED composition failed',
      {
        errors: succeeded.errors || [],
        runningArtifact: running.artifact,
      },
    );
  }

  const correlationId = taskState.correlationId || input.correlationId || null;

  const lineage = freezeDeep({
    taskId: taskState.taskId,
    attempt: taskState.attempt,
    bindingId: binding.bindingId,
    marketContextId: envelope.marketContextRef.marketContextId,
    contextId: envelope.decisionContextRef.contextId,
    decisionId: envelope.decisionRef.decisionId,
    orchestrationId: envelope.evidenceOrchestrationRef.orchestrationId,
    controlChainArtifactId: envelope.controlChainRef.controlChainArtifactId,
    shadowCycleEnvelopeId: envelope.shadowCycleEnvelopeId,
    shadowRecordingArtifactId: envelope.shadowRecordingRef.shadowRecordingArtifactId,
    ...(correlationId ? { correlationId } : {}),
    shadowTaskStateActivationContractVersion: SHADOW_TASK_STATE_ACTIVATION_CONTRACT_VERSION,
    shadowTaskStateContractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
    shadowTaskCycleBindingContractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    shadowRuntimeContractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    ...(input.lineage || {}),
  });

  if (!assertAllowlist(lineage, ALLOWED_LINEAGE, 'lineage', errors)) {
    return fail('lineage_invalid', 'Activation lineage failed allowlist', { errors });
  }

  const provenance = freezeDeep({
    writer: SHADOW_TASK_STATE_ACTIVATION_WRITER,
    methodKey: SHADOW_TASK_STATE_ACTIVATION_METHOD_KEY,
    stage: SHADOW_TASK_STATE_ACTIVATION_STAGE,
    recordedAt: input.recordedAt,
    note: 'library_activation_ready_running_succeeded',
    policyVersion: SHADOW_TASK_STATE_ACTIVATION_POLICY_VERSION,
    implementationVersion:
      input.implementationVersion || SHADOW_TASK_STATE_ACTIVATION_CONTRACT_VERSION,
    ...(input.provenance || {}),
  });

  if (!assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors)) {
    return fail('provenance_invalid', 'Activation provenance failed allowlist', { errors });
  }
  if (provenance.writer !== SHADOW_TASK_STATE_ACTIVATION_WRITER) {
    return fail('provenance_mismatch', 'provenance.writer mismatch', {
      errors: [{ field: 'provenance.writer', code: 'provenance_mismatch' }],
    });
  }

  const result = {
    schemaVersion: SHADOW_TASK_STATE_ACTIVATION_SCHEMA_VERSION,
    contractVersion: SHADOW_TASK_STATE_ACTIVATION_CONTRACT_VERSION,
    policyVersion: SHADOW_TASK_STATE_ACTIVATION_POLICY_VERSION,
    artifactType: SHADOW_TASK_STATE_ACTIVATION_ARTIFACT_TYPE,
    taskId: taskState.taskId,
    attempt: taskState.attempt,
    recordedAt: input.recordedAt,
    ...(correlationId ? { correlationId } : {}),
    fromStatus: SHADOW_TASK_STATUS.READY,
    toStatus: SHADOW_TASK_STATUS.SUCCEEDED,
    runningTaskStateRef: toTaskStateRef(running.artifact),
    succeededTaskStateRef: toTaskStateRef(succeeded.artifact),
    bindingRef: freezeDeep({
      bindingId: binding.bindingId,
      contractVersion: binding.contractVersion,
    }),
    shadowCycleEnvelopeRef: freezeDeep({
      shadowCycleEnvelopeId: envelope.shadowCycleEnvelopeId,
      contractVersion: envelope.contractVersion,
    }),
    shadowRecordingRef: freezeDeep({
      shadowRecordingArtifactId: envelope.shadowRecordingRef.shadowRecordingArtifactId,
      contractVersion:
        envelope.shadowRecordingRef.contractVersion || SHADOW_RECORDING_CONTRACT_VERSION,
      maturity: envelope.shadowRecordingRef.maturity || DECISION_MATURITY_MODE.SHADOW,
    }),
    marketContextRef: freezeDeep(
      thinRef(envelope.marketContextRef, ALLOWED_MARKET_CONTEXT_REF, 'marketContextId'),
    ),
    decisionContextRef: freezeDeep(
      thinRef(envelope.decisionContextRef, ALLOWED_DECISION_CONTEXT_REF, 'contextId'),
    ),
    decisionRef: freezeDeep(thinRef(envelope.decisionRef, ALLOWED_DECISION_REF, 'decisionId')),
    evidenceOrchestrationRef: freezeDeep(
      thinRef(envelope.evidenceOrchestrationRef, ALLOWED_ORCH_REF, 'orchestrationId'),
    ),
    controlChainRef: freezeDeep(
      thinRef(envelope.controlChainRef, ALLOWED_CONTROL_REF, 'controlChainArtifactId'),
    ),
    lineage,
    provenance,
    limitations: [...SHADOW_TASK_STATE_ACTIVATION_LIMITATIONS],
    sideEffects: { ...ZERO_SHADOW_TASK_STATE_ACTIVATION_SIDE_EFFECTS },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    liveTradingEnabled: false,
    paperTradingEnabled: false,
    providerConnected: false,
    shadowRuntimeActivated: false,
    persistenceEnabled: false,
    b10WriteAttempted: false,
    // Local activation-result marker only (not worker/scheduler/global runtime).
    taskStateActivated: true,
    implementationVersion:
      input.implementationVersion || SHADOW_TASK_STATE_ACTIVATION_CONTRACT_VERSION,
  };

  const resultErrors = [];
  if (!assertAllowlist(result, ALLOWED_RESULT_TOP, 'result', resultErrors)) {
    return fail('result_unknown_field', 'Activation result produced unknown fields', {
      errors: resultErrors,
    });
  }
  assertAllowlist(result.runningTaskStateRef, ALLOWED_TASK_STATE_REF, 'runningTaskStateRef', resultErrors);
  assertAllowlist(result.succeededTaskStateRef, ALLOWED_TASK_STATE_REF, 'succeededTaskStateRef', resultErrors);
  assertAllowlist(result.bindingRef, ALLOWED_BINDING_REF, 'bindingRef', resultErrors);
  assertAllowlist(result.shadowCycleEnvelopeRef, ALLOWED_CYCLE_REF, 'shadowCycleEnvelopeRef', resultErrors);
  assertAllowlist(result.shadowRecordingRef, ALLOWED_RECORDING_REF, 'shadowRecordingRef', resultErrors);
  if (resultErrors.length) {
    return fail('result_ref_invalid', 'Activation result refs failed allowlist', {
      errors: resultErrors,
    });
  }

  const bytes = utf8ByteLength(JSON.stringify(result));
  if (bytes > MAX_SHADOW_TASK_STATE_ACTIVATION_UTF8_BYTES) {
    return fail('artifact_too_large', 'Activation result exceeds size bound', {
      errors: [{ field: 'result', code: 'artifact_too_large', bytes }],
    });
  }

  const frozenResult = freezeDeep(result);

  // Full-cycle idempotency against existingActivationResult.
  if (input.existingActivationResult != null) {
    const existing = input.existingActivationResult;
    if (typeof existing !== 'object' || Array.isArray(existing)) {
      return fail('malformed_existing_activation_result', 'existingActivationResult must be an object', {
        errors: [{ field: 'existingActivationResult', code: 'malformed_existing_activation_result' }],
      });
    }
    if (existing.taskId === frozenResult.taskId && existing.attempt === frozenResult.attempt) {
      if (artifactsStructurallyEqual(existing, frozenResult)) {
        return {
          ok: true,
          code: 'SHADOW_TASK_STATE_ACTIVATION_IDEMPOTENT',
          message: 'Activation result identical — idempotent no-op',
          artifact: freezeDeep(existing),
          runningArtifact: running.artifact,
          succeededArtifact: succeeded.artifact,
          sideEffects: ZERO_SHADOW_TASK_STATE_ACTIVATION_SIDE_EFFECTS,
          idempotent: true,
          taskStateActivated: true,
          shadowRuntimeActivated: false,
        };
      }
      return fail('idempotency_conflict', 'Same taskId/attempt with conflicting activation result', {
        errors: [{ field: 'taskId', code: 'idempotency_conflict' }],
      });
    }
  }

  return {
    ok: true,
    code: 'SHADOW_TASK_STATE_ACTIVATION_COMPLETE',
    message: 'READY → RUNNING → SUCCEEDED activation complete (library-only)',
    artifact: frozenResult,
    runningArtifact: running.artifact,
    succeededArtifact: succeeded.artifact,
    sideEffects: ZERO_SHADOW_TASK_STATE_ACTIVATION_SIDE_EFFECTS,
    idempotent: Boolean(running.idempotent || succeeded.idempotent),
    taskStateActivated: true,
    shadowRuntimeActivated: false,
    runtimeActivation: false,
    worker: false,
    scheduler: false,
  };
}

/**
 * READY → RUNNING only (does not compose SUCCEEDED).
 */
export function transitionReadyToRunning(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Activation input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }

  const errors = [];
  if (Object.prototype.hasOwnProperty.call(input, 'runId')) {
    errors.push({ field: 'runId', code: 'forbidden_run_id' });
  }
  const forbidden = collectForbiddenKeys(input);
  forbidden.forEach((key) => errors.push({ field: key, code: 'forbidden_key' }));
  const secretKeys = collectForbiddenSecretKeys(input);
  secretKeys.forEach((key) => errors.push({ field: key, code: 'forbidden_secret_key' }));

  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Unknown activation input fields', { errors });
  }
  validateHardFlagsFalse(input, '', errors);

  if (!isIsoTimestamp(input.recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'invalid_iso_timestamp' });
  }

  const taskState = validateReadyTaskState(input.taskState, errors);
  const envelope = validateCycleEnvelope(input.cycleEnvelope, errors);
  const binding = validateBinding(input.binding, errors);

  let recordingRef = input.shadowRecordingRef || null;
  if (recordingRef != null) {
    if (typeof recordingRef !== 'object' || Array.isArray(recordingRef)) {
      errors.push({ field: 'shadowRecordingRef', code: 'malformed_shadow_recording_ref' });
      recordingRef = null;
    } else if (!assertAllowlist(recordingRef, ALLOWED_RECORDING_REF, 'shadowRecordingRef', errors)) {
      recordingRef = null;
    } else if (!isCanonicalUuid(recordingRef.shadowRecordingArtifactId)) {
      errors.push({ field: 'shadowRecordingRef.shadowRecordingArtifactId', code: 'invalid_uuid' });
    }
  }

  if (taskState && envelope && binding) {
    assertLineageMatch(taskState, envelope, binding, recordingRef, errors);
  }

  if (errors.length) {
    return fail('activation_input_invalid', 'READY → RUNNING validation failed', { errors });
  }

  if (!isAllowedShadowTaskTransition(SHADOW_TASK_STATUS.READY, SHADOW_TASK_STATUS.RUNNING)) {
    return fail('illegal_transition', 'READY → RUNNING is not allowed', {
      errors: [{ field: 'transition', code: 'illegal_transition' }],
    });
  }

  const runningInput = buildActivatedInputFromReady(
    taskState,
    SHADOW_TASK_STATUS.RUNNING,
    envelope,
  );
  if (input.existingRunningArtifact != null) {
    runningInput.existingArtifact = input.existingRunningArtifact;
  }

  const running = composeActivatedShadowTaskState(runningInput);
  if (!running.ok) {
    return fail(
      running.code || 'running_composition_failed',
      running.message || 'READY → RUNNING composition failed',
      { errors: running.errors || [] },
    );
  }

  return {
    ok: true,
    code: 'SHADOW_TASK_STATE_RUNNING',
    message: 'READY → RUNNING complete',
    artifact: running.artifact,
    runningArtifact: running.artifact,
    sideEffects: ZERO_SHADOW_TASK_STATE_ACTIVATION_SIDE_EFFECTS,
    idempotent: Boolean(running.idempotent),
    taskStateActivated: true,
    shadowRuntimeActivated: false,
    transition: {
      fromStatus: SHADOW_TASK_STATUS.READY,
      toStatus: SHADOW_TASK_STATUS.RUNNING,
    },
  };
}

/**
 * Complete RUNNING → SUCCEEDED given a prior RUNNING artifact + cycle inputs.
 */
export function completeRunningToSucceeded(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Completion input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }

  const errors = [];
  const allowedCompletion = new Set([...ALLOWED_INPUT_TOP, 'runningArtifact']);
  if (!assertAllowlist(input, allowedCompletion, 'input', errors)) {
    return fail('unknown_field', 'Unknown completion input fields', { errors });
  }
  validateHardFlagsFalse(input, '', errors);

  const runningArtifact = input.runningArtifact;
  if (!runningArtifact || typeof runningArtifact !== 'object' || Array.isArray(runningArtifact)) {
    return fail('running_required', 'completeRunningToSucceeded requires a RUNNING artifact', {
      errors: [{ field: 'runningArtifact', code: 'running_required' }],
    });
  }
  if (runningArtifact.status !== SHADOW_TASK_STATUS.RUNNING) {
    return fail('running_required', 'runningArtifact.status must be RUNNING', {
      errors: [{ field: 'runningArtifact.status', code: 'running_required' }],
    });
  }
  if (runningArtifact.contractVersion !== SHADOW_TASK_STATE_CONTRACT_VERSION) {
    errors.push({
      field: 'runningArtifact.contractVersion',
      code: 'contract_version_mismatch',
      expected: SHADOW_TASK_STATE_CONTRACT_VERSION,
    });
  }
  validateHardFlagsFalse(runningArtifact, 'runningArtifact', errors);

  if (!isIsoTimestamp(input.recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'invalid_iso_timestamp' });
  }

  const envelope = validateCycleEnvelope(input.cycleEnvelope, errors);
  const binding = validateBinding(input.binding, errors);

  if (binding && runningArtifact.taskId !== binding.taskId) {
    errors.push({ field: 'binding.taskId', code: 'task_id_mismatch' });
  }
  if (binding && binding.attempt != null && binding.attempt !== runningArtifact.attempt) {
    errors.push({ field: 'binding.attempt', code: 'attempt_mismatch' });
  }
  if (envelope && binding) {
    assertLineageMatch(
      {
        ...runningArtifact,
        status: SHADOW_TASK_STATUS.READY,
        marketContextRef: runningArtifact.marketContextRef,
        decisionContextRef: runningArtifact.decisionContextRef,
        decisionRef: runningArtifact.decisionRef,
        evidenceOrchestrationRef: runningArtifact.evidenceOrchestrationRef,
        controlChainRef: runningArtifact.controlChainRef,
      },
      envelope,
      binding,
      input.shadowRecordingRef || null,
      errors,
    );
  }

  if (errors.length) {
    return fail('completion_input_invalid', 'RUNNING → SUCCEEDED validation failed', { errors });
  }

  if (!isAllowedShadowTaskTransition(SHADOW_TASK_STATUS.RUNNING, SHADOW_TASK_STATUS.SUCCEEDED)) {
    return fail('illegal_transition', 'RUNNING → SUCCEEDED is not allowed', {
      errors: [{ field: 'transition', code: 'illegal_transition' }],
    });
  }

  const succeededInput = buildActivatedInputFromReady(
    runningArtifact,
    SHADOW_TASK_STATUS.SUCCEEDED,
    envelope,
  );
  if (input.existingSucceededArtifact != null) {
    succeededInput.existingArtifact = input.existingSucceededArtifact;
  }

  const succeeded = composeActivatedShadowTaskState(succeededInput);
  if (!succeeded.ok) {
    return fail(
      succeeded.code || 'succeeded_composition_failed',
      succeeded.message || 'RUNNING → SUCCEEDED composition failed',
      { errors: succeeded.errors || [], runningArtifact },
    );
  }

  return {
    ok: true,
    code: 'SHADOW_TASK_STATE_SUCCEEDED',
    message: 'RUNNING → SUCCEEDED complete',
    artifact: succeeded.artifact,
    runningArtifact,
    succeededArtifact: succeeded.artifact,
    sideEffects: ZERO_SHADOW_TASK_STATE_ACTIVATION_SIDE_EFFECTS,
    taskStateActivated: true,
    shadowRuntimeActivated: false,
    transition: {
      fromStatus: SHADOW_TASK_STATUS.RUNNING,
      toStatus: SHADOW_TASK_STATUS.SUCCEEDED,
    },
  };
}

export function validateShadowTaskStateActivation(input = {}) {
  return activateShadowTaskStateCycle(input);
}

export {
  ALLOWED_MARKET_CONTEXT_REF,
  ALLOWED_DECISION_CONTEXT_REF,
  DECISION_MATURITY_MODE,
  SHADOW_RUNTIME_CONTRACT_VERSION,
  SHADOW_RECORDING_CONTRACT_VERSION,
  SHADOW_TASK_STATUS,
  SHADOW_TASK_TYPE,
};
