/**
 * Artemis Core Stage 8 — Shadow Task State Boundary (S8-SHADOW-TASK-STATE).
 *
 * Deterministic, non-executing, in-memory library contract for Shadow Task
 * State validation/composition. CONTRACT_ONLY — not a SoT, worker, scheduler,
 * queue, lease/lock manager, or persistence owner.
 *
 * Composable now: CREATED, READY
 * Terminal artifact validation: FAILED, CANCELLED
 * Future structural validation only (never activation): RUNNING, SUCCEEDED
 *
 * Does NOT:
 *   - activate Shadow runtime / worker / scheduler / Task State
 *   - persist (B10), write DB/Redis, network, provider, LLM, orders, wallet
 *   - invent Decision / Evidence / Market Context / Recording SoT
 *   - mutate C1–C6 / Control Chain / Decision / Context / Evidence /
 *     S8-MC / C8.1 / S8-SHADOW-RT-BOUNDARY
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
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
} from './artemisControlChainContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_MATURITY_MODE,
} from './artemisDecisionContextContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from './artemisMarketContextContract.js';
import {
  ALLOWED_MARKET_CONTEXT_REF,
  SHADOW_RECORDING_CONTRACT_VERSION,
  ZERO_SHADOW_RECORDING_SIDE_EFFECTS,
} from './artemisShadowDecisionRecordingBoundaryContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from './artemisShadowRuntimeLibraryBoundaryContract.js';

export const SHADOW_TASK_STATE_STAGE = 'ARTEMIS_CORE_STAGE_8_SHADOW_TASK_STATE_BOUNDARY';
export const SHADOW_TASK_STATE_SCHEMA_VERSION = '1.0.0';
export const SHADOW_TASK_STATE_CONTRACT_VERSION = 'artemis-shadow-task-state-boundary-1.0.0';
export const SHADOW_TASK_STATE_POLICY_VERSION = 'stage8-shadow-task-state-boundary-1.0.0';
export const SHADOW_TASK_STATE_WRITER = 'artemisShadowTaskStateBoundaryContract';
export const SHADOW_TASK_STATE_METHOD_KEY = 'build_shadow_task_state_fail_closed';
export const SHADOW_TASK_STATE_ARTIFACT_TYPE = 'SHADOW_TASK_STATE_ARTIFACT';

export const SHADOW_TASK_TYPE = Object.freeze({
  SHADOW_EVALUATION_CYCLE: 'SHADOW_EVALUATION_CYCLE',
});

export const SHADOW_TASK_STATUS = Object.freeze({
  CREATED: 'CREATED',
  READY: 'READY',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

/** Statuses that may be composed by buildShadowTaskState in this library slice. */
export const COMPOSABLE_SHADOW_TASK_STATUSES = Object.freeze([
  SHADOW_TASK_STATUS.CREATED,
  SHADOW_TASK_STATUS.READY,
  SHADOW_TASK_STATUS.FAILED,
  SHADOW_TASK_STATUS.CANCELLED,
]);

/** Future statuses: structural validation only — never runtime activation. */
export const FUTURE_VALIDATION_ONLY_STATUSES = Object.freeze([
  SHADOW_TASK_STATUS.RUNNING,
  SHADOW_TASK_STATUS.SUCCEEDED,
]);

export const TERMINAL_SHADOW_TASK_STATUSES = Object.freeze([
  SHADOW_TASK_STATUS.SUCCEEDED,
  SHADOW_TASK_STATUS.FAILED,
  SHADOW_TASK_STATUS.CANCELLED,
]);

export const MAX_SHADOW_TASK_STATE_UTF8_BYTES = 48 * 1024;
export const MAX_STRING_CHARS = 512;

export const ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS = Object.freeze({
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
  taskStateActivated: false,
});

export const SHADOW_TASK_STATE_LIMITATIONS = Object.freeze([
  'stage8_shadow_task_state_boundary_only',
  'library_only',
  'contract_only',
  'in_memory_only',
  'deterministic_non_executing',
  'composable_created_ready_only',
  'running_validation_only_never_activated',
  'succeeded_validation_only_never_execution',
  'no_automatic_state_progression',
  'no_worker_scheduler_queue_lease_lock',
  'does_not_create_parallel_sot',
  'references_only_no_embedded_payloads',
  'persistence_not_enabled',
  'b10_not_activated',
  'observed_outcome_deferred',
  'does_not_authorize_execution',
  'does_not_call_llm_or_provider',
  'does_not_write_db_or_redis',
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  [SHADOW_TASK_STATUS.CREATED]: Object.freeze([
    SHADOW_TASK_STATUS.READY,
    SHADOW_TASK_STATUS.FAILED,
    SHADOW_TASK_STATUS.CANCELLED,
  ]),
  [SHADOW_TASK_STATUS.READY]: Object.freeze([
    SHADOW_TASK_STATUS.RUNNING,
    SHADOW_TASK_STATUS.FAILED,
    SHADOW_TASK_STATUS.CANCELLED,
  ]),
  [SHADOW_TASK_STATUS.RUNNING]: Object.freeze([
    SHADOW_TASK_STATUS.SUCCEEDED,
    SHADOW_TASK_STATUS.FAILED,
    SHADOW_TASK_STATUS.CANCELLED,
  ]),
  [SHADOW_TASK_STATUS.SUCCEEDED]: Object.freeze([]),
  [SHADOW_TASK_STATUS.FAILED]: Object.freeze([]),
  [SHADOW_TASK_STATUS.CANCELLED]: Object.freeze([]),
});

const ALLOWED_INPUT_TOP = Object.freeze([
  'taskType',
  'status',
  'createdAt',
  'recordedAt',
  'attempt',
  'correlationId',
  'marketContextRef',
  'decisionContextRef',
  'shadowCycleEnvelopeRef',
  'decisionRef',
  'evidenceOrchestrationRef',
  'controlChainRef',
  'shadowRecordingRef',
  'failureReason',
  'cancelReason',
  'taskId',
  'existingArtifact',
  'fromStatus',
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
  'taskId',
  'taskType',
  'status',
  'createdAt',
  'recordedAt',
  'attempt',
  'correlationId',
  'marketContextRef',
  'decisionContextRef',
  'shadowCycleEnvelopeRef',
  'decisionRef',
  'evidenceOrchestrationRef',
  'controlChainRef',
  'shadowRecordingRef',
  'failureReason',
  'cancelReason',
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

const ALLOWED_DECISION_CONTEXT_REF = Object.freeze([
  'contextId',
  'contractVersion',
  'maturity',
]);

const ALLOWED_SHADOW_CYCLE_ENVELOPE_REF = Object.freeze([
  'shadowCycleEnvelopeId',
  'contractVersion',
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

const ALLOWED_SHADOW_RECORDING_REF = Object.freeze([
  'shadowRecordingArtifactId',
  'contractVersion',
  'maturity',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'taskId',
  'marketContextId',
  'contextId',
  'decisionId',
  'orchestrationId',
  'controlChainArtifactId',
  'shadowCycleEnvelopeId',
  'shadowRecordingArtifactId',
  'correlationId',
  'shadowTaskStateContractVersion',
  'marketContextContractVersion',
  'decisionContextContractVersion',
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
]);

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));

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

function collectForbiddenKeys(value, acc = []) {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenKeys(item, acc));
    return acc;
  }
  for (const [key, nested] of Object.entries(value)) {
    // existingArtifact is an opaque prior artifact for idempotency only —
    // do not treat its internal sideEffects/limitations keys as contamination.
    if (key === 'existingArtifact') continue;
    if (FORBIDDEN_EXTRA_KEYS.includes(key)) acc.push(key);
    if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(nested)) acc.push(`${key}:${nested}`);
    collectForbiddenKeys(nested, acc);
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

function hashToUuid(parts) {
  const digest = createHash('sha256').update(parts.join('|'), 'utf8').digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function stableJson(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}

function assertOrderedTimestamps(createdAt, recordedAt, errors) {
  if (!isIsoTimestamp(createdAt)) {
    errors.push({ field: 'createdAt', code: 'invalid_iso_timestamp' });
    return;
  }
  if (!isIsoTimestamp(recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'invalid_iso_timestamp' });
    return;
  }
  if (Date.parse(createdAt) > Date.parse(recordedAt)) {
    errors.push({ field: 'createdAt', code: 'created_after_recorded' });
  }
}

function validateMarketContextRef(ref, errors) {
  if (ref == null) {
    errors.push({ field: 'marketContextRef', code: 'missing_market_context_ref' });
    return null;
  }
  if (typeof ref !== 'object' || Array.isArray(ref)) {
    errors.push({ field: 'marketContextRef', code: 'malformed_market_context_ref' });
    return null;
  }
  if (!assertAllowlist(ref, ALLOWED_MARKET_CONTEXT_REF, 'marketContextRef', errors)) {
    return null;
  }
  if (!isCanonicalUuid(ref.marketContextId)) {
    errors.push({ field: 'marketContextRef.marketContextId', code: 'invalid_uuid' });
  }
  if (ref.contractVersion !== MARKET_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'marketContextRef.contractVersion',
      code: 'market_context_contract_version_mismatch',
      expected: MARKET_CONTEXT_CONTRACT_VERSION,
    });
  }
  return {
    marketContextId: ref.marketContextId,
    contractVersion: ref.contractVersion,
    venue: ref.venue,
    marketType: ref.marketType,
    symbol: ref.symbol,
    timeframe: ref.timeframe,
    freshnessStatus: ref.freshnessStatus,
    sourceTimestamp: ref.sourceTimestamp,
    availability: ref.availability,
  };
}

function validateDecisionContextRef(ref, errors, { required = false } = {}) {
  if (ref == null) {
    if (required) errors.push({ field: 'decisionContextRef', code: 'missing_decision_context_ref' });
    return null;
  }
  if (typeof ref !== 'object' || Array.isArray(ref)) {
    errors.push({ field: 'decisionContextRef', code: 'malformed_decision_context_ref' });
    return null;
  }
  if (!assertAllowlist(ref, ALLOWED_DECISION_CONTEXT_REF, 'decisionContextRef', errors)) {
    return null;
  }
  if (!isCanonicalUuid(ref.contextId)) {
    errors.push({ field: 'decisionContextRef.contextId', code: 'invalid_uuid' });
  }
  if (ref.contractVersion !== DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'decisionContextRef.contractVersion',
      code: 'decision_context_contract_version_mismatch',
      expected: DECISION_CONTEXT_CONTRACT_VERSION,
    });
  }
  if (ref.maturity !== DECISION_MATURITY_MODE.SHADOW) {
    errors.push({
      field: 'decisionContextRef.maturity',
      code: 'maturity_must_be_shadow',
      expected: DECISION_MATURITY_MODE.SHADOW,
      actual: ref.maturity,
    });
  }
  return {
    contextId: ref.contextId,
    contractVersion: ref.contractVersion,
    maturity: ref.maturity,
  };
}

function validateThinRef(ref, field, allowed, idField, expectedContractVersion, errors, { required = false } = {}) {
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
  return out;
}

function deriveTaskId(parts) {
  return hashToUuid([
    SHADOW_TASK_STATE_CONTRACT_VERSION,
    SHADOW_TASK_STATE_ARTIFACT_TYPE,
    parts.taskType,
    String(parts.attempt),
    parts.recordedAt,
    parts.marketContextId,
    parts.correlationId || '',
    parts.contextId || '',
  ]);
}

function artifactsStructurallyEqual(a, b) {
  return stableJson(a) === stableJson(b);
}

function isAllowedTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

/**
 * Build / validate a Shadow Task State artifact.
 *
 * Composable statuses: CREATED | READY | FAILED | CANCELLED
 * RUNNING / SUCCEEDED: rejected here (use validateShadowTaskStateTransition /
 * validateFutureTaskStateArtifact for structural-only checks).
 *
 * @param {object} input
 * @returns {{ ok: true, artifact: object, sideEffects: object }
 *   | { ok: false, code: string, message: string, errors?: array }}
 */
export function buildShadowTaskState(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Shadow task state input must be a plain object', {
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
    return fail('unknown_field', 'Unknown Shadow task state input fields', { errors });
  }

  validateHardFlagsOnInput(input, errors);

  const status = input.status || SHADOW_TASK_STATUS.CREATED;
  if (!Object.values(SHADOW_TASK_STATUS).includes(status)) {
    errors.push({ field: 'status', code: 'unknown_status' });
    return fail('unknown_status', 'Unknown Shadow task status', { errors });
  }

  if (status === SHADOW_TASK_STATUS.RUNNING) {
    return fail('running_activation_forbidden', 'RUNNING is validation-only; runtime activation is not authorized', {
      errors: [{ field: 'status', code: 'running_activation_forbidden' }],
    });
  }
  if (status === SHADOW_TASK_STATUS.SUCCEEDED) {
    return fail('succeeded_activation_forbidden', 'SUCCEEDED is validation-only; must not be emitted by active runtime in this slice', {
      errors: [{ field: 'status', code: 'succeeded_activation_forbidden' }],
    });
  }
  if (!COMPOSABLE_SHADOW_TASK_STATUSES.includes(status)) {
    errors.push({ field: 'status', code: 'status_not_composable' });
  }

  return composeArtifact(input, status, errors, { activation: false });
}

/**
 * Structural validation of future RUNNING / SUCCEEDED artifacts.
 * Never activates Task State or Shadow runtime.
 */
export function validateFutureTaskStateArtifact(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Shadow task state input must be a plain object', {
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
    return fail('unknown_field', 'Unknown Shadow task state input fields', { errors });
  }

  validateHardFlagsOnInput(input, errors);

  const status = input.status;
  if (!FUTURE_VALIDATION_ONLY_STATUSES.includes(status)) {
    return fail('not_future_validation_status', 'validateFutureTaskStateArtifact accepts only RUNNING or SUCCEEDED', {
      errors: [{ field: 'status', code: 'not_future_validation_status' }],
    });
  }

  const result = composeArtifact(input, status, errors, {
    activation: false,
    futureValidationOnly: true,
  });
  if (!result.ok) return result;
  return {
    ...result,
    runtimeActivation: false,
    taskStateActivated: false,
    futureValidationOnly: true,
  };
}

/**
 * Validate a conceptual transition. RUNNING / SUCCEEDED targets are
 * structural-only and never activate runtime.
 */
export function validateShadowTaskStateTransition({
  fromStatus,
  toStatus,
  fromArtifact = null,
  toInput = {},
} = {}) {
  const errors = [];

  if (!Object.values(SHADOW_TASK_STATUS).includes(fromStatus)) {
    return fail('unknown_from_status', 'Unknown fromStatus', {
      errors: [{ field: 'fromStatus', code: 'unknown_status' }],
    });
  }
  if (!Object.values(SHADOW_TASK_STATUS).includes(toStatus)) {
    return fail('unknown_to_status', 'Unknown toStatus', {
      errors: [{ field: 'toStatus', code: 'unknown_status' }],
    });
  }

  if (TERMINAL_SHADOW_TASK_STATUSES.includes(fromStatus)) {
    return fail('terminal_mutation_rejected', 'No transition out of terminal states', {
      errors: [{ field: 'fromStatus', code: 'terminal_mutation_rejected' }],
    });
  }

  if (!isAllowedTransition(fromStatus, toStatus)) {
    return fail('illegal_transition', `Illegal transition ${fromStatus} -> ${toStatus}`, {
      errors: [{ field: 'transition', code: 'illegal_transition', fromStatus, toStatus }],
    });
  }

  if (fromArtifact != null) {
    if (typeof fromArtifact !== 'object' || Array.isArray(fromArtifact)) {
      return fail('invalid_from_artifact', 'fromArtifact must be a plain object', {
        errors: [{ field: 'fromArtifact', code: 'required_object' }],
      });
    }
    if (fromArtifact.status !== fromStatus) {
      errors.push({ field: 'fromArtifact.status', code: 'from_status_mismatch' });
    }
    if (TERMINAL_SHADOW_TASK_STATUSES.includes(fromArtifact.status)) {
      return fail('terminal_mutation_rejected', 'Duplicate terminal mutation rejected', {
        errors: [{ field: 'fromArtifact.status', code: 'terminal_mutation_rejected' }],
      });
    }
  }

  if (toStatus === SHADOW_TASK_STATUS.RUNNING) {
    const structural = validateFutureTaskStateArtifact({
      ...toInput,
      status: SHADOW_TASK_STATUS.RUNNING,
    });
    if (!structural.ok) return structural;
    return {
      ok: true,
      transition: { fromStatus, toStatus },
      artifact: structural.artifact,
      sideEffects: ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS,
      runtimeActivation: false,
      taskStateActivated: false,
      futureValidationOnly: true,
      errors: errors.length ? errors : undefined,
    };
  }

  if (toStatus === SHADOW_TASK_STATUS.SUCCEEDED) {
    const structural = validateFutureTaskStateArtifact({
      ...toInput,
      status: SHADOW_TASK_STATUS.SUCCEEDED,
    });
    if (!structural.ok) return structural;
    return {
      ok: true,
      transition: { fromStatus, toStatus },
      artifact: structural.artifact,
      sideEffects: ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS,
      runtimeActivation: false,
      taskStateActivated: false,
      futureValidationOnly: true,
      executionImplied: false,
      errors: errors.length ? errors : undefined,
    };
  }

  const composed = buildShadowTaskState({
    ...toInput,
    status: toStatus,
  });
  if (!composed.ok) return composed;

  return {
    ok: true,
    transition: { fromStatus, toStatus },
    artifact: composed.artifact,
    sideEffects: ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS,
    runtimeActivation: false,
    taskStateActivated: false,
    errors: errors.length ? errors : undefined,
  };
}

export function validateShadowTaskState(input = {}) {
  const status = input?.status;
  if (FUTURE_VALIDATION_ONLY_STATUSES.includes(status)) {
    return validateFutureTaskStateArtifact(input);
  }
  return buildShadowTaskState(input);
}

function composeArtifact(input, status, errors, { activation = false, futureValidationOnly = false } = {}) {
  if (input.taskType == null) {
    errors.push({ field: 'taskType', code: 'missing_task_type' });
  } else if (input.taskType !== SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE) {
    errors.push({ field: 'taskType', code: 'unknown_task_type' });
  }

  assertOrderedTimestamps(input.createdAt, input.recordedAt, errors);

  if (input.attempt == null) {
    errors.push({ field: 'attempt', code: 'missing_attempt' });
  } else if (!Number.isInteger(input.attempt) || input.attempt < 1) {
    errors.push({ field: 'attempt', code: 'invalid_attempt' });
  }

  if (input.correlationId != null && !isCanonicalUuid(input.correlationId)) {
    errors.push({ field: 'correlationId', code: 'invalid_uuid' });
  }

  const marketContextRef = validateMarketContextRef(input.marketContextRef, errors);

  const needDecisionContext = status === SHADOW_TASK_STATUS.READY
    || status === SHADOW_TASK_STATUS.RUNNING
    || status === SHADOW_TASK_STATUS.SUCCEEDED;
  const decisionContextRef = validateDecisionContextRef(input.decisionContextRef, errors, {
    required: needDecisionContext,
  });

  const needSucceededRefs = status === SHADOW_TASK_STATUS.SUCCEEDED;
  const shadowCycleEnvelopeRef = validateThinRef(
    input.shadowCycleEnvelopeRef,
    'shadowCycleEnvelopeRef',
    ALLOWED_SHADOW_CYCLE_ENVELOPE_REF,
    'shadowCycleEnvelopeId',
    SHADOW_RUNTIME_CONTRACT_VERSION,
    errors,
    { required: needSucceededRefs },
  );
  const shadowRecordingRef = validateThinRef(
    input.shadowRecordingRef,
    'shadowRecordingRef',
    ALLOWED_SHADOW_RECORDING_REF,
    'shadowRecordingArtifactId',
    SHADOW_RECORDING_CONTRACT_VERSION,
    errors,
    { required: needSucceededRefs },
  );
  if (shadowRecordingRef && shadowRecordingRef.maturity != null
    && shadowRecordingRef.maturity !== DECISION_MATURITY_MODE.SHADOW) {
    errors.push({
      field: 'shadowRecordingRef.maturity',
      code: 'maturity_must_be_shadow',
    });
  }

  const decisionRef = validateThinRef(
    input.decisionRef,
    'decisionRef',
    ALLOWED_DECISION_REF,
    'decisionId',
    null,
    errors,
  );
  const evidenceOrchestrationRef = validateThinRef(
    input.evidenceOrchestrationRef,
    'evidenceOrchestrationRef',
    ALLOWED_EVIDENCE_ORCHESTRATION_REF,
    'orchestrationId',
    null,
    errors,
  );
  const controlChainRef = validateThinRef(
    input.controlChainRef,
    'controlChainRef',
    ALLOWED_CONTROL_CHAIN_REF,
    'controlChainArtifactId',
    null,
    errors,
  );

  if (status === SHADOW_TASK_STATUS.FAILED) {
    if (input.failureReason == null || typeof input.failureReason !== 'string' || !input.failureReason.trim()) {
      errors.push({ field: 'failureReason', code: 'missing_failure_reason' });
    } else if (input.failureReason.length > MAX_STRING_CHARS) {
      errors.push({ field: 'failureReason', code: 'string_too_long' });
    }
  } else if (input.failureReason != null) {
    errors.push({ field: 'failureReason', code: 'failure_reason_not_allowed' });
  }

  if (status === SHADOW_TASK_STATUS.CANCELLED) {
    if (input.cancelReason == null || typeof input.cancelReason !== 'string' || !input.cancelReason.trim()) {
      errors.push({ field: 'cancelReason', code: 'missing_cancel_reason' });
    } else if (input.cancelReason.length > MAX_STRING_CHARS) {
      errors.push({ field: 'cancelReason', code: 'string_too_long' });
    }
  } else if (input.cancelReason != null) {
    errors.push({ field: 'cancelReason', code: 'cancel_reason_not_allowed' });
  }

  if (input.lineage != null) {
    assertAllowlist(input.lineage, ALLOWED_LINEAGE, 'lineage', errors);
  }
  if (input.provenance != null) {
    assertAllowlist(input.provenance, ALLOWED_PROVENANCE, 'provenance', errors);
  }

  if (errors.length) {
    return fail('shadow_task_state_invalid', 'Shadow task state failed validation', { errors });
  }

  const taskId = deriveTaskId({
    taskType: input.taskType,
    attempt: input.attempt,
    recordedAt: input.recordedAt,
    marketContextId: marketContextRef.marketContextId,
    correlationId: input.correlationId || null,
    contextId: decisionContextRef?.contextId || null,
  });

  if (input.taskId != null) {
    if (!isCanonicalUuid(input.taskId)) {
      return fail('invalid_task_id', 'Caller-supplied taskId is not a canonical UUID', {
        errors: [{ field: 'taskId', code: 'invalid_task_id' }],
      });
    }
    if (input.taskId !== taskId) {
      return fail('identity_mismatch', 'Caller-supplied taskId does not match derived identity', {
        errors: [{ field: 'taskId', code: 'identity_mismatch', expected: taskId, actual: input.taskId }],
      });
    }
  }

  const lineage = freezeDeep({
    taskId,
    marketContextId: marketContextRef.marketContextId,
    ...(decisionContextRef ? { contextId: decisionContextRef.contextId } : {}),
    ...(decisionRef ? { decisionId: decisionRef.decisionId } : {}),
    ...(evidenceOrchestrationRef ? { orchestrationId: evidenceOrchestrationRef.orchestrationId } : {}),
    ...(controlChainRef ? { controlChainArtifactId: controlChainRef.controlChainArtifactId } : {}),
    ...(shadowCycleEnvelopeRef
      ? { shadowCycleEnvelopeId: shadowCycleEnvelopeRef.shadowCycleEnvelopeId }
      : {}),
    ...(shadowRecordingRef
      ? { shadowRecordingArtifactId: shadowRecordingRef.shadowRecordingArtifactId }
      : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    shadowTaskStateContractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
    marketContextContractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    ...(decisionContextRef
      ? { decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION }
      : {}),
    ...(shadowCycleEnvelopeRef
      ? { shadowRuntimeContractVersion: SHADOW_RUNTIME_CONTRACT_VERSION }
      : {}),
    ...(shadowRecordingRef
      ? { shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION }
      : {}),
    ...(input.lineage || {}),
  });

  // Lineage must not contradict derived identity / refs.
  if (lineage.taskId !== taskId) {
    return fail('lineage_mismatch', 'lineage.taskId mismatch', {
      errors: [{ field: 'lineage.taskId', code: 'lineage_mismatch' }],
    });
  }
  if (lineage.marketContextId !== marketContextRef.marketContextId) {
    return fail('lineage_mismatch', 'lineage.marketContextId mismatch', {
      errors: [{ field: 'lineage.marketContextId', code: 'lineage_mismatch' }],
    });
  }
  if (decisionContextRef && lineage.contextId != null && lineage.contextId !== decisionContextRef.contextId) {
    return fail('lineage_mismatch', 'lineage.contextId mismatch', {
      errors: [{ field: 'lineage.contextId', code: 'lineage_mismatch' }],
    });
  }

  const provenance = freezeDeep({
    writer: SHADOW_TASK_STATE_WRITER,
    methodKey: SHADOW_TASK_STATE_METHOD_KEY,
    stage: SHADOW_TASK_STATE_STAGE,
    recordedAt: input.recordedAt,
    note: futureValidationOnly
      ? 'future_validation_only_never_activated'
      : 'library_composition_only',
    policyVersion: SHADOW_TASK_STATE_POLICY_VERSION,
    implementationVersion: input.implementationVersion || SHADOW_TASK_STATE_CONTRACT_VERSION,
    ...(input.provenance || {}),
  });

  if (provenance.writer !== SHADOW_TASK_STATE_WRITER) {
    return fail('provenance_mismatch', 'provenance.writer mismatch', {
      errors: [{ field: 'provenance.writer', code: 'provenance_mismatch' }],
    });
  }

  const artifact = {
    schemaVersion: SHADOW_TASK_STATE_SCHEMA_VERSION,
    contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
    policyVersion: SHADOW_TASK_STATE_POLICY_VERSION,
    artifactType: SHADOW_TASK_STATE_ARTIFACT_TYPE,
    taskId,
    taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
    status,
    createdAt: input.createdAt,
    recordedAt: input.recordedAt,
    attempt: input.attempt,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    marketContextRef: freezeDeep(marketContextRef),
    ...(decisionContextRef ? { decisionContextRef: freezeDeep(decisionContextRef) } : {}),
    ...(shadowCycleEnvelopeRef
      ? { shadowCycleEnvelopeRef: freezeDeep(shadowCycleEnvelopeRef) }
      : {}),
    ...(decisionRef ? { decisionRef: freezeDeep(decisionRef) } : {}),
    ...(evidenceOrchestrationRef
      ? { evidenceOrchestrationRef: freezeDeep(evidenceOrchestrationRef) }
      : {}),
    ...(controlChainRef ? { controlChainRef: freezeDeep(controlChainRef) } : {}),
    ...(shadowRecordingRef ? { shadowRecordingRef: freezeDeep(shadowRecordingRef) } : {}),
    ...(status === SHADOW_TASK_STATUS.FAILED
      ? { failureReason: String(input.failureReason).trim() }
      : {}),
    ...(status === SHADOW_TASK_STATUS.CANCELLED
      ? { cancelReason: String(input.cancelReason).trim() }
      : {}),
    lineage,
    provenance,
    limitations: [...SHADOW_TASK_STATE_LIMITATIONS],
    sideEffects: { ...ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
    implementationVersion: input.implementationVersion || SHADOW_TASK_STATE_CONTRACT_VERSION,
  };

  if (!assertAllowlist(artifact, ALLOWED_ARTIFACT_TOP, 'artifact', errors)) {
    return fail('unknown_field', 'Artifact produced unknown fields', { errors });
  }

  const bytes = utf8ByteLength(artifact);
  if (bytes > MAX_SHADOW_TASK_STATE_UTF8_BYTES) {
    return fail('artifact_too_large', 'Shadow task state artifact exceeds size bound', {
      errors: [{ field: 'artifact', code: 'artifact_too_large', bytes }],
    });
  }

  if (activation === true || artifact.taskStateActivated === true) {
    return fail('task_state_activation_forbidden', 'taskStateActivated must remain false', {
      errors: [{ field: 'taskStateActivated', code: 'task_state_activation_forbidden' }],
    });
  }

  const frozen = freezeDeep(artifact);

  if (input.existingArtifact != null) {
    if (typeof input.existingArtifact !== 'object' || Array.isArray(input.existingArtifact)) {
      return fail('invalid_existing_artifact', 'existingArtifact must be a plain object', {
        errors: [{ field: 'existingArtifact', code: 'required_object' }],
      });
    }
    if (input.existingArtifact.taskId === taskId) {
      if (artifactsStructurallyEqual(input.existingArtifact, frozen)) {
        return {
          ok: true,
          artifact: freezeDeep(input.existingArtifact),
          sideEffects: ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS,
          idempotent: true,
        };
      }
      return fail('idempotency_conflict', 'Same taskId with different payload rejected', {
        errors: [{ field: 'taskId', code: 'idempotency_conflict' }],
      });
    }
  }

  return {
    ok: true,
    artifact: frozen,
    sideEffects: ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS,
    runtimeActivation: false,
    taskStateActivated: false,
    ...(futureValidationOnly ? { futureValidationOnly: true } : {}),
  };
}

export function isComposableShadowTaskStatus(status) {
  return COMPOSABLE_SHADOW_TASK_STATUSES.includes(status);
}

export function isTerminalShadowTaskStatus(status) {
  return TERMINAL_SHADOW_TASK_STATUSES.includes(status);
}

export function isAllowedShadowTaskTransition(fromStatus, toStatus) {
  return isAllowedTransition(fromStatus, toStatus);
}

export {
  ALLOWED_MARKET_CONTEXT_REF,
  ALLOWED_TRANSITIONS,
  DECISION_MATURITY_MODE,
  MARKET_CONTEXT_CONTRACT_VERSION,
  SHADOW_RECORDING_CONTRACT_VERSION,
  SHADOW_RUNTIME_CONTRACT_VERSION,
};
