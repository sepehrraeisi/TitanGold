/**
 * Artemis Core Stage 7.2.b.3.c.2 — Model Invocation Gateway foundation.
 *
 * Provider-independent gateway interface: lifecycle, timeout/budget/retry
 * policy contracts, failure normalization, and provenance placeholders.
 *
 * Does NOT:
 *   - call LLMs or provider SDKs
 *   - open network sockets or create HTTP clients
 *   - select a real model
 *   - transport API keys / credentials
 *   - execute prompts
 *   - persist model outputs
 *   - modify legacy MoE / artemis decision routes
 *   - authorize execution
 *
 * Placement:
 *   Model Invocation Contract (7.2.b.3.c.1)
 *     → Invocation Gateway foundation (this stage)
 *       → future provider transport (NOT here)
 */

import {
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  FORBIDDEN_INVOCATION_KEYS,
  MAX_INVOCATION_UTF8_BYTES,
  MODEL_INVOCATION_CONTRACT_VERSION,
  MODEL_INVOCATION_POLICY_VERSION,
  MODEL_INVOCATION_SCHEMA_VERSION,
  MODEL_INVOCATION_STATUS,
  ZERO_MODEL_INVOCATION_SIDE_EFFECTS,
  buildContractOnlyModelInvocationResponse,
  validateModelInvocationRequest,
  validateModelInvocationResponse,
} from './artemisModelInvocationContract.js';
import {
  PROMPT_DATA_BOUNDARY_CONTRACT_VERSION,
  validateBoundedModelInputArtifact,
} from './artemisModelAssistedPromptDataBoundaryContract.js';
import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';

export const INVOCATION_GATEWAY_STAGE = '7.2.b.3.c.2';
export const INVOCATION_GATEWAY_SCHEMA_VERSION = '1.0.0';
export const INVOCATION_GATEWAY_CONTRACT_VERSION = 'artemis-model-invocation-gateway-1.0.0';
export const INVOCATION_GATEWAY_POLICY_VERSION = 'stage7-2b3c2-invocation-gateway-1.0.0';
export const INVOCATION_GATEWAY_WRITER = 'artemisModelInvocationGatewayContract';

export const REQUIRED_INVOCATION_CONTRACT_VERSION = MODEL_INVOCATION_CONTRACT_VERSION;
export const REQUIRED_INVOCATION_POLICY_VERSION = MODEL_INVOCATION_POLICY_VERSION;
export const REQUIRED_INVOCATION_SCHEMA_VERSION = MODEL_INVOCATION_SCHEMA_VERSION;
export const REQUIRED_BOUNDARY_CONTRACT_VERSION = PROMPT_DATA_BOUNDARY_CONTRACT_VERSION;

export const MAX_GATEWAY_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 512;
export const MAX_LIMITATIONS = 64;
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Gateway lifecycle states. Transport is intentionally absent at this stage;
 * accepted requests resolve to deferred_no_transport rather than live dispatch.
 */
export const INVOCATION_GATEWAY_LIFECYCLE = Object.freeze({
  ACCEPTED: 'accepted',
  VALIDATING: 'validating',
  READY: 'ready',
  DEFERRED_NO_TRANSPORT: 'deferred_no_transport',
  FAILED_INVALID: 'failed_invalid',
  TIMED_OUT_POLICY: 'timed_out_policy',
  BUDGET_EXHAUSTED_POLICY: 'budget_exhausted_policy',
  REFUSED_POLICY: 'refused_policy',
  UNAVAILABLE: 'unavailable',
});

export const INVOCATION_GATEWAY_LIMITATIONS = Object.freeze([
  'stage7_2b3c2_invocation_gateway_foundation_only',
  'no_llm_provider_calls',
  'no_provider_sdk',
  'no_network_transport',
  'no_api_key_transport',
  'no_credential_access',
  'no_live_prompt_execution',
  'no_model_selection',
  'no_model_response_persistence',
  'provider_independent_gateway_only',
  'transport_deferred',
  'model_output_untrusted_advisory_non_authoritative',
  'cannot_override_deterministic_analysis',
  'cannot_approve_execution',
  'cannot_change_controls',
  'no_execution_authorization',
  'no_order_intent',
  'cognitive_engine_product_not_started',
  'live_trading_not_authorized',
]);

export const ZERO_GATEWAY_SIDE_EFFECTS = Object.freeze({
  ...ZERO_MODEL_INVOCATION_SIDE_EFFECTS,
});

const ALLOWED_TIMEOUT_POLICY = Object.freeze([
  'timeoutMs',
  'softTimeoutMs',
  'hardFailOnTimeout',
  'note',
]);

const ALLOWED_BUDGET_POLICY = Object.freeze([
  'maxUtf8Bytes',
  'maxTokens',
  'maxCostUnits',
  'hardFailOnExhaustion',
  'note',
]);

const ALLOWED_RETRY_POLICY = Object.freeze([
  'maxAttempts',
  'backoffMs',
  'retryOnTimeout',
  'retryOnUnavailable',
  'retryOnInvalidSchema',
  'note',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'note',
  'recordedAt',
  'providerFamily',
  'transportMode',
]);

const ALLOWED_GATEWAY_PLAN_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'gatewayId',
  'invocationId',
  'decisionContextId',
  'lifecycleState',
  'invocationContractVersion',
  'invocationPolicyVersion',
  'policyVersion',
  'timeoutPolicy',
  'budgetPolicy',
  'retryPolicy',
  'inputAccepted',
  'transportArmed',
  'providerSelected',
  'advisoryOnly',
  'authoritative',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'cognitiveEngineStarted',
  'limitations',
  'provenance',
  'sideEffects',
  'generatedAt',
]);

const ALLOWED_GATEWAY_RESULT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'gatewayId',
  'invocationId',
  'decisionContextId',
  'lifecycleState',
  'normalizedStatus',
  'failureCode',
  'failureMessage',
  'invocationResponse',
  'timeoutPolicy',
  'budgetPolicy',
  'retryPolicy',
  'policyVersion',
  'advisoryOnly',
  'authoritative',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'cognitiveEngineStarted',
  'transportArmed',
  'providerSelected',
  'limitations',
  'provenance',
  'sideEffects',
  'generatedAt',
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function assertAllowlist(obj, allowed, field, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push({ field, code: 'required_object' });
    return false;
  }
  const unknown = Object.keys(obj).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    errors.push({ field, code: 'unknown_field', fields: unknown });
    return false;
  }
  return true;
}

function assertForbiddenKeys(obj, forbidden, errors, fieldPrefix = 'root') {
  if (!obj || typeof obj !== 'object') return;
  const stack = [{ value: obj, path: fieldPrefix }];
  while (stack.length) {
    const { value, path } = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      value.forEach((item, idx) => stack.push({ value: item, path: `${path}[${idx}]` }));
      continue;
    }
    for (const [key, nested] of Object.entries(value)) {
      if (forbidden.includes(key)) {
        errors.push({ field: `${path}.${key}`, code: 'forbidden_key', key });
      }
      stack.push({ value: nested, path: `${path}.${key}` });
    }
  }
}

function rejectExecutionAuthorityStrings(value, errors, path = 'root') {
  if (typeof value === 'string') {
    if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
      errors.push({ field: path, code: 'forbidden_execution_authority_value', value });
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, idx) => rejectExecutionAuthorityStrings(item, errors, `${path}[${idx}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    rejectExecutionAuthorityStrings(nested, errors, `${path}.${key}`);
  }
}

function assertStringMax(field, value, errors, { required = false, max = MAX_STRING_CHARS } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (typeof value !== 'string' || !value.trim()) {
    errors.push({ field, code: 'invalid_string' });
    return;
  }
  if (value.length > max) {
    errors.push({ field, code: 'too_long', max });
  }
}

function validateLimitations(limitations, errors) {
  if (!Array.isArray(limitations) || !limitations.length) {
    errors.push({ field: 'limitations', code: 'required_non_empty_array' });
    return;
  }
  if (limitations.length > MAX_LIMITATIONS) {
    errors.push({ field: 'limitations', code: 'too_many' });
  }
  for (let i = 0; i < limitations.length; i += 1) {
    assertStringMax(`limitations[${i}]`, limitations[i], errors, { required: true, max: 256 });
  }
}

function validateSideEffects(sideEffects, errors) {
  if (!sideEffects || typeof sideEffects !== 'object' || Array.isArray(sideEffects)) {
    errors.push({ field: 'sideEffects', code: 'required_object' });
    return;
  }
  for (const [key, expected] of Object.entries(ZERO_GATEWAY_SIDE_EFFECTS)) {
    if (sideEffects[key] !== expected) {
      errors.push({ field: `sideEffects.${key}`, code: 'must_be_zero', expected });
    }
  }
}

function validateHardFalseFlags(obj, errors, prefix = '') {
  const checks = [
    ['advisoryOnly', true],
    ['authoritative', false],
    ['decisionEligible', false],
    ['executionEligible', false],
    ['approvedForExecution', false],
    ['cognitiveEngineStarted', false],
  ];
  for (const [field, expected] of checks) {
    if (obj[field] !== expected) {
      errors.push({
        field: prefix ? `${prefix}.${field}` : field,
        code: expected === true ? 'must_be_true' : 'must_be_false',
      });
    }
  }
}

/**
 * Validate timeout policy contract (no clocks started).
 */
export function validateTimeoutPolicy(policy) {
  const errors = [];
  if (!assertAllowlist(policy, ALLOWED_TIMEOUT_POLICY, 'timeoutPolicy', errors)) {
    return fail('invalid_timeout_policy', 'Timeout policy invalid', { errors });
  }
  if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs <= 0 || policy.timeoutMs > 120000) {
    errors.push({ field: 'timeoutPolicy.timeoutMs', code: 'invalid_timeout' });
  }
  if (policy.softTimeoutMs != null) {
    if (!Number.isInteger(policy.softTimeoutMs) || policy.softTimeoutMs <= 0
      || (Number.isInteger(policy.timeoutMs) && policy.softTimeoutMs > policy.timeoutMs)) {
      errors.push({ field: 'timeoutPolicy.softTimeoutMs', code: 'invalid_soft_timeout' });
    }
  }
  if (policy.hardFailOnTimeout !== true && policy.hardFailOnTimeout !== false) {
    errors.push({ field: 'timeoutPolicy.hardFailOnTimeout', code: 'required_boolean' });
  }
  assertStringMax('timeoutPolicy.note', policy.note, errors, { required: false });
  if (errors.length) {
    return fail('invalid_timeout_policy', 'Timeout policy invalid', { errors });
  }
  return { ok: true, code: 'TIMEOUT_POLICY_VALID', message: 'Timeout policy accepted', errors: [] };
}

/**
 * Validate budget policy contract (no spend performed).
 */
export function validateBudgetPolicy(policy) {
  const errors = [];
  if (!assertAllowlist(policy, ALLOWED_BUDGET_POLICY, 'budgetPolicy', errors)) {
    return fail('invalid_budget_policy', 'Budget policy invalid', { errors });
  }
  if (!Number.isInteger(policy.maxUtf8Bytes) || policy.maxUtf8Bytes <= 0
    || policy.maxUtf8Bytes > MAX_INVOCATION_UTF8_BYTES) {
    errors.push({ field: 'budgetPolicy.maxUtf8Bytes', code: 'invalid_budget' });
  }
  if (policy.maxTokens != null) {
    if (!Number.isInteger(policy.maxTokens) || policy.maxTokens <= 0 || policy.maxTokens > 128000) {
      errors.push({ field: 'budgetPolicy.maxTokens', code: 'invalid_budget' });
    }
  }
  if (policy.maxCostUnits != null) {
    if (typeof policy.maxCostUnits !== 'number' || !(policy.maxCostUnits >= 0)
      || policy.maxCostUnits > 1e6) {
      errors.push({ field: 'budgetPolicy.maxCostUnits', code: 'invalid_budget' });
    }
  }
  if (policy.hardFailOnExhaustion !== true && policy.hardFailOnExhaustion !== false) {
    errors.push({ field: 'budgetPolicy.hardFailOnExhaustion', code: 'required_boolean' });
  }
  assertStringMax('budgetPolicy.note', policy.note, errors, { required: false });
  if (errors.length) {
    return fail('invalid_budget_policy', 'Budget policy invalid', { errors });
  }
  return { ok: true, code: 'BUDGET_POLICY_VALID', message: 'Budget policy accepted', errors: [] };
}

/**
 * Validate retry policy contract (no retries executed).
 */
export function validateRetryPolicy(policy) {
  const errors = [];
  if (!assertAllowlist(policy, ALLOWED_RETRY_POLICY, 'retryPolicy', errors)) {
    return fail('invalid_retry_policy', 'Retry policy invalid', { errors });
  }
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 0
    || policy.maxAttempts > MAX_RETRY_ATTEMPTS) {
    errors.push({ field: 'retryPolicy.maxAttempts', code: 'invalid_retry_attempts' });
  }
  if (policy.backoffMs != null) {
    if (!Number.isInteger(policy.backoffMs) || policy.backoffMs < 0 || policy.backoffMs > 60000) {
      errors.push({ field: 'retryPolicy.backoffMs', code: 'invalid_backoff' });
    }
  }
  for (const flag of ['retryOnTimeout', 'retryOnUnavailable', 'retryOnInvalidSchema']) {
    if (policy[flag] !== true && policy[flag] !== false) {
      errors.push({ field: `retryPolicy.${flag}`, code: 'required_boolean' });
    }
  }
  // Foundation stage: retries that would imply transport are forbidden to be true
  // while still allowing the schema to exist for future wiring.
  if (policy.retryOnTimeout === true || policy.retryOnUnavailable === true) {
    errors.push({
      field: 'retryPolicy',
      code: 'transport_retry_forbidden_in_foundation',
    });
  }
  assertStringMax('retryPolicy.note', policy.note, errors, { required: false });
  if (errors.length) {
    return fail('invalid_retry_policy', 'Retry policy invalid', { errors });
  }
  return { ok: true, code: 'RETRY_POLICY_VALID', message: 'Retry policy accepted', errors: [] };
}

function validateGatewayProvenance(provenance, errors) {
  if (!assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors)) return;
  assertStringMax('provenance.writer', provenance.writer, errors, { required: true });
  assertStringMax('provenance.methodKey', provenance.methodKey, errors, { required: true });
  if (provenance.stage !== INVOCATION_GATEWAY_STAGE) {
    errors.push({
      field: 'provenance.stage',
      code: 'bad_stage',
      expected: INVOCATION_GATEWAY_STAGE,
    });
  }
  assertStringMax('provenance.note', provenance.note, errors, { required: true, max: 1024 });
  if (!isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_iso_timestamp' });
  }
  if (provenance.providerFamily != null && provenance.providerFamily !== 'none') {
    errors.push({ field: 'provenance.providerFamily', code: 'must_be_none_in_foundation' });
  }
  if (provenance.transportMode != null && provenance.transportMode !== 'none') {
    errors.push({ field: 'provenance.transportMode', code: 'must_be_none_in_foundation' });
  }
}

/**
 * Normalize gateway/policy failures into ModelInvocationResponse statuses.
 * Pure mapping — no transport.
 */
export function normalizeGatewayFailure(failure = {}) {
  const code = failure.code || failure.failureCode || 'unavailable';
  const map = {
    invalid_timeout_policy: MODEL_INVOCATION_STATUS.INVALID_SCHEMA,
    invalid_budget_policy: MODEL_INVOCATION_STATUS.INVALID_SCHEMA,
    invalid_retry_policy: MODEL_INVOCATION_STATUS.INVALID_SCHEMA,
    validation_failed: MODEL_INVOCATION_STATUS.INVALID_SCHEMA,
    invalid_gateway_input: MODEL_INVOCATION_STATUS.INVALID_SCHEMA,
    timed_out_policy: MODEL_INVOCATION_STATUS.TIMEOUT,
    budget_exhausted_policy: MODEL_INVOCATION_STATUS.UNAVAILABLE,
    refused_policy: MODEL_INVOCATION_STATUS.REFUSAL,
    deferred_no_transport: MODEL_INVOCATION_STATUS.UNAVAILABLE,
    unavailable: MODEL_INVOCATION_STATUS.UNAVAILABLE,
  };
  const normalizedStatus = map[code] || MODEL_INVOCATION_STATUS.UNAVAILABLE;
  return {
    ok: true,
    code: 'GATEWAY_FAILURE_NORMALIZED',
    normalizedStatus,
    failureCode: code,
    failureMessage: failure.message || failure.failureMessage || code,
    advisoryOnly: true,
    authoritative: false,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
  };
}

/**
 * Validate gateway input envelope. Accepts only validated invocation request
 * (+ optional bounded artifact). Rejects secrets/wallet/execution/raw payloads.
 */
export function validateGatewayInvocationInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_gateway_input', 'Gateway input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }

  const allowedTop = [
    'invocationRequest',
    'boundedModelInputArtifact',
    'timeoutPolicy',
    'budgetPolicy',
    'retryPolicy',
    'gatewayId',
    'generatedAt',
  ];
  assertAllowlist(input, allowedTop, 'input', errors);

  const { boundedModelInputArtifact, ...withoutArtifact } = input;
  assertForbiddenKeys(withoutArtifact, FORBIDDEN_INVOCATION_KEYS, errors, 'input');
  rejectExecutionAuthorityStrings(withoutArtifact, errors, 'input');

  const secretKeys = collectForbiddenSecretKeys(withoutArtifact);
  if (secretKeys.length) {
    errors.push({ field: 'input', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  if (input.gatewayId != null && !isCanonicalUuid(input.gatewayId)) {
    errors.push({ field: 'gatewayId', code: 'invalid_uuid' });
  }
  if (input.generatedAt != null && !isIsoTimestamp(input.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  const requestCheck = validateModelInvocationRequest(input.invocationRequest);
  if (!requestCheck.ok) {
    errors.push({
      field: 'invocationRequest',
      code: requestCheck.code || 'invalid_invocation_request',
      errors: requestCheck.errors || [],
    });
  }

  if (boundedModelInputArtifact != null) {
    const artifactCheck = validateBoundedModelInputArtifact(boundedModelInputArtifact);
    if (!artifactCheck.ok) {
      errors.push({
        field: 'boundedModelInputArtifact',
        code: artifactCheck.code || 'invalid_bounded_input',
        errors: artifactCheck.errors || [],
      });
    } else {
      const reqCtx = input.invocationRequest?.inputReference?.decisionContextId;
      if (
        reqCtx
        && String(boundedModelInputArtifact.decisionContextId).trim().toLowerCase()
          !== String(reqCtx).trim().toLowerCase()
      ) {
        errors.push({
          field: 'boundedModelInputArtifact.decisionContextId',
          code: 'must_match_invocation_request',
        });
      }
    }
  }

  if (input.timeoutPolicy != null) {
    const timeoutCheck = validateTimeoutPolicy(input.timeoutPolicy);
    if (!timeoutCheck.ok) errors.push(...(timeoutCheck.errors || []));
  }
  if (input.budgetPolicy != null) {
    const budgetCheck = validateBudgetPolicy(input.budgetPolicy);
    if (!budgetCheck.ok) errors.push(...(budgetCheck.errors || []));
  }
  if (input.retryPolicy != null) {
    const retryCheck = validateRetryPolicy(input.retryPolicy);
    if (!retryCheck.ok) errors.push(...(retryCheck.errors || []));
  }

  if (errors.length) {
    return fail('invalid_gateway_input', 'Gateway invocation input rejected', { errors });
  }
  return {
    ok: true,
    code: 'GATEWAY_INPUT_VALID',
    message: 'Gateway input accepted (foundation; no transport)',
    errors: [],
  };
}

function defaultTimeoutPolicy(fromRequest) {
  return {
    timeoutMs: fromRequest?.timeout?.timeoutMs ?? 15000,
    softTimeoutMs: fromRequest?.timeout?.softTimeoutMs ?? 10000,
    hardFailOnTimeout: true,
    note: 'contract_only_timeout_policy',
  };
}

function defaultBudgetPolicy(fromRequest) {
  return {
    maxUtf8Bytes: fromRequest?.budget?.maxUtf8Bytes ?? MAX_INVOCATION_UTF8_BYTES,
    maxTokens: fromRequest?.budget?.maxTokens ?? 4096,
    maxCostUnits: fromRequest?.budget?.maxCostUnits ?? 0,
    hardFailOnExhaustion: true,
    note: 'contract_only_budget_policy',
  };
}

function defaultRetryPolicy() {
  return {
    maxAttempts: 0,
    backoffMs: 0,
    retryOnTimeout: false,
    retryOnUnavailable: false,
    retryOnInvalidSchema: false,
    note: 'foundation_retries_disabled',
  };
}

/**
 * Build a contract-only gateway plan. Never arms transport or selects a provider.
 */
export function planContractOnlyGatewayInvocation(input = {}) {
  const validation = validateGatewayInvocationInput(input);
  const recordedAt = input.generatedAt
    || input.invocationRequest?.generatedAt
    || new Date().toISOString();
  const gatewayId = input.gatewayId;
  const invocationRequest = input.invocationRequest;

  if (!validation.ok) {
    const normalized = normalizeGatewayFailure({
      code: 'invalid_gateway_input',
      message: validation.message,
    });
    return {
      ok: false,
      code: 'GATEWAY_PLAN_REJECTED',
      message: validation.message,
      errors: validation.errors,
      plan: null,
      result: buildContractOnlyGatewayResult({
        gatewayId,
        invocationId: invocationRequest?.invocationId,
        decisionContextId: invocationRequest?.inputReference?.decisionContextId,
        lifecycleState: INVOCATION_GATEWAY_LIFECYCLE.FAILED_INVALID,
        normalizedStatus: normalized.normalizedStatus,
        failureCode: 'invalid_gateway_input',
        failureMessage: validation.message,
        generatedAt: recordedAt,
      }),
    };
  }

  const timeoutPolicy = input.timeoutPolicy || defaultTimeoutPolicy(invocationRequest);
  const budgetPolicy = input.budgetPolicy || defaultBudgetPolicy(invocationRequest);
  const retryPolicy = input.retryPolicy || defaultRetryPolicy();

  // Policy-level exhaustion / timeout checks against the request envelope size.
  const requestBytes = utf8ByteLength(invocationRequest);
  if (requestBytes > budgetPolicy.maxUtf8Bytes) {
    const normalized = normalizeGatewayFailure({
      code: 'budget_exhausted_policy',
      message: 'Request exceeds budget maxUtf8Bytes',
    });
    return {
      ok: false,
      code: 'GATEWAY_BUDGET_EXHAUSTED',
      message: normalized.failureMessage,
      errors: [{ field: 'budgetPolicy.maxUtf8Bytes', code: 'budget_exhausted_policy' }],
      plan: null,
      result: buildContractOnlyGatewayResult({
        gatewayId,
        invocationId: invocationRequest.invocationId,
        decisionContextId: invocationRequest.inputReference.decisionContextId,
        lifecycleState: INVOCATION_GATEWAY_LIFECYCLE.BUDGET_EXHAUSTED_POLICY,
        normalizedStatus: normalized.normalizedStatus,
        failureCode: 'budget_exhausted_policy',
        failureMessage: normalized.failureMessage,
        timeoutPolicy,
        budgetPolicy,
        retryPolicy,
        generatedAt: recordedAt,
      }),
    };
  }

  const plan = {
    schemaVersion: INVOCATION_GATEWAY_SCHEMA_VERSION,
    contractVersion: INVOCATION_GATEWAY_CONTRACT_VERSION,
    gatewayId,
    invocationId: invocationRequest.invocationId,
    decisionContextId: invocationRequest.inputReference.decisionContextId,
    lifecycleState: INVOCATION_GATEWAY_LIFECYCLE.DEFERRED_NO_TRANSPORT,
    invocationContractVersion: REQUIRED_INVOCATION_CONTRACT_VERSION,
    invocationPolicyVersion: REQUIRED_INVOCATION_POLICY_VERSION,
    policyVersion: INVOCATION_GATEWAY_POLICY_VERSION,
    timeoutPolicy,
    budgetPolicy,
    retryPolicy,
    inputAccepted: true,
    transportArmed: false,
    providerSelected: false,
    advisoryOnly: true,
    authoritative: false,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveEngineStarted: false,
    limitations: [...INVOCATION_GATEWAY_LIMITATIONS],
    provenance: {
      writer: INVOCATION_GATEWAY_WRITER,
      methodKey: 'contract_only_gateway_plan',
      stage: INVOCATION_GATEWAY_STAGE,
      note: 'stage_7_2b3c2_gateway_foundation_transport_deferred',
      recordedAt,
      providerFamily: 'none',
      transportMode: 'none',
    },
    sideEffects: { ...ZERO_GATEWAY_SIDE_EFFECTS },
    generatedAt: recordedAt,
  };

  const planCheck = validateGatewayPlan(plan);
  if (!planCheck.ok) {
    return {
      ok: false,
      code: 'GATEWAY_PLAN_INVALID',
      message: planCheck.message,
      errors: planCheck.errors,
      plan: null,
      result: null,
    };
  }

  const deferred = normalizeGatewayFailure({
    code: 'deferred_no_transport',
    message: 'Gateway foundation has no provider transport',
  });

  return {
    ok: true,
    code: 'GATEWAY_PLAN_DEFERRED_NO_TRANSPORT',
    message: 'Gateway plan accepted; transport deferred (foundation only)',
    errors: [],
    plan,
    result: buildContractOnlyGatewayResult({
      gatewayId,
      invocationId: invocationRequest.invocationId,
      decisionContextId: invocationRequest.inputReference.decisionContextId,
      lifecycleState: INVOCATION_GATEWAY_LIFECYCLE.DEFERRED_NO_TRANSPORT,
      normalizedStatus: deferred.normalizedStatus,
      failureCode: 'deferred_no_transport',
      failureMessage: deferred.failureMessage,
      timeoutPolicy,
      budgetPolicy,
      retryPolicy,
      generatedAt: recordedAt,
    }),
  };
}

/**
 * Validate a gateway plan artifact.
 */
export function validateGatewayPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return fail('invalid_plan', 'Gateway plan must be a plain object', {
      errors: [{ field: 'plan', code: 'required_object' }],
    });
  }

  assertAllowlist(plan, ALLOWED_GATEWAY_PLAN_TOP, 'plan', errors);
  assertForbiddenKeys(plan, FORBIDDEN_INVOCATION_KEYS, errors, 'plan');
  rejectExecutionAuthorityStrings(plan, errors, 'plan');

  const secretKeys = collectForbiddenSecretKeys(plan);
  if (secretKeys.length) {
    errors.push({ field: 'plan', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  if (plan.schemaVersion !== INVOCATION_GATEWAY_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'unsupported_schema_version' });
  }
  if (plan.contractVersion !== INVOCATION_GATEWAY_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'unsupported_contract_version' });
  }
  if (!isCanonicalUuid(plan.gatewayId)) {
    errors.push({ field: 'gatewayId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(plan.invocationId)) {
    errors.push({ field: 'invocationId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(plan.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (!Object.values(INVOCATION_GATEWAY_LIFECYCLE).includes(plan.lifecycleState)) {
    errors.push({ field: 'lifecycleState', code: 'invalid_lifecycle' });
  }
  if (plan.invocationContractVersion !== REQUIRED_INVOCATION_CONTRACT_VERSION) {
    errors.push({ field: 'invocationContractVersion', code: 'bad_invocation_contract_version' });
  }
  if (plan.invocationPolicyVersion !== REQUIRED_INVOCATION_POLICY_VERSION) {
    errors.push({ field: 'invocationPolicyVersion', code: 'bad_invocation_policy_version' });
  }
  if (plan.policyVersion !== INVOCATION_GATEWAY_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', code: 'bad_policy_version' });
  }

  const timeoutCheck = validateTimeoutPolicy(plan.timeoutPolicy);
  if (!timeoutCheck.ok) errors.push(...(timeoutCheck.errors || []));
  const budgetCheck = validateBudgetPolicy(plan.budgetPolicy);
  if (!budgetCheck.ok) errors.push(...(budgetCheck.errors || []));
  const retryCheck = validateRetryPolicy(plan.retryPolicy);
  if (!retryCheck.ok) errors.push(...(retryCheck.errors || []));

  if (plan.inputAccepted !== true) {
    errors.push({ field: 'inputAccepted', code: 'must_be_true' });
  }
  if (plan.transportArmed !== false) {
    errors.push({ field: 'transportArmed', code: 'must_be_false' });
  }
  if (plan.providerSelected !== false) {
    errors.push({ field: 'providerSelected', code: 'must_be_false' });
  }

  validateHardFalseFlags(plan, errors);
  validateGatewayProvenance(plan.provenance, errors);
  validateLimitations(plan.limitations, errors);
  validateSideEffects(plan.sideEffects, errors);

  if (!isIsoTimestamp(plan.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  const bytes = utf8ByteLength(plan);
  if (bytes > MAX_GATEWAY_UTF8_BYTES) {
    errors.push({ field: 'plan', code: 'too_large', bytes, limit: MAX_GATEWAY_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Gateway plan failed validation', { errors, bytes });
  }
  return {
    ok: true,
    code: 'GATEWAY_PLAN_VALID',
    message: 'Gateway plan accepted',
    errors: [],
    bytes,
  };
}

/**
 * Build a contract-only gateway result envelope.
 */
export function buildContractOnlyGatewayResult(partial = {}) {
  const recordedAt = partial.generatedAt
    || partial.provenance?.recordedAt
    || new Date().toISOString();
  const lifecycleState = partial.lifecycleState
    ?? INVOCATION_GATEWAY_LIFECYCLE.DEFERRED_NO_TRANSPORT;
  const normalizedStatus = partial.normalizedStatus
    ?? MODEL_INVOCATION_STATUS.UNAVAILABLE;

  const invocationResponse = buildContractOnlyModelInvocationResponse({
    invocationId: partial.invocationId,
    status: normalizedStatus,
    generatedAt: recordedAt,
    unavailableReason: partial.failureMessage
      || 'gateway_foundation_no_provider_transport',
    refusalReason: normalizedStatus === MODEL_INVOCATION_STATUS.REFUSAL
      ? (partial.failureMessage || 'gateway_policy_refusal')
      : undefined,
  });

  return {
    schemaVersion: INVOCATION_GATEWAY_SCHEMA_VERSION,
    contractVersion: INVOCATION_GATEWAY_CONTRACT_VERSION,
    gatewayId: partial.gatewayId,
    invocationId: partial.invocationId,
    decisionContextId: partial.decisionContextId,
    lifecycleState,
    normalizedStatus,
    failureCode: partial.failureCode ?? null,
    failureMessage: partial.failureMessage ?? null,
    invocationResponse,
    timeoutPolicy: partial.timeoutPolicy || defaultTimeoutPolicy(),
    budgetPolicy: partial.budgetPolicy || defaultBudgetPolicy(),
    retryPolicy: partial.retryPolicy || defaultRetryPolicy(),
    policyVersion: INVOCATION_GATEWAY_POLICY_VERSION,
    advisoryOnly: true,
    authoritative: false,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveEngineStarted: false,
    transportArmed: false,
    providerSelected: false,
    limitations: Array.isArray(partial.limitations) && partial.limitations.length
      ? [...partial.limitations]
      : [...INVOCATION_GATEWAY_LIMITATIONS],
    provenance: {
      writer: INVOCATION_GATEWAY_WRITER,
      methodKey: partial.provenance?.methodKey ?? 'contract_only_gateway_result',
      stage: INVOCATION_GATEWAY_STAGE,
      note: partial.provenance?.note ?? 'stage_7_2b3c2_gateway_foundation_no_model_call',
      recordedAt,
      providerFamily: 'none',
      transportMode: 'none',
    },
    sideEffects: { ...ZERO_GATEWAY_SIDE_EFFECTS },
    generatedAt: recordedAt,
  };
}

/**
 * Validate a gateway result artifact.
 */
export function validateGatewayResult(result) {
  const errors = [];
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return fail('invalid_result', 'Gateway result must be a plain object', {
      errors: [{ field: 'result', code: 'required_object' }],
    });
  }

  assertAllowlist(result, ALLOWED_GATEWAY_RESULT_TOP, 'result', errors);
  assertForbiddenKeys(result, FORBIDDEN_INVOCATION_KEYS, errors, 'result');
  rejectExecutionAuthorityStrings(result, errors, 'result');

  const secretKeys = collectForbiddenSecretKeys(result);
  if (secretKeys.length) {
    errors.push({ field: 'result', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  if (result.schemaVersion !== INVOCATION_GATEWAY_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'unsupported_schema_version' });
  }
  if (result.contractVersion !== INVOCATION_GATEWAY_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'unsupported_contract_version' });
  }
  if (result.gatewayId != null && !isCanonicalUuid(result.gatewayId)) {
    errors.push({ field: 'gatewayId', code: 'invalid_uuid' });
  }
  if (result.invocationId != null && !isCanonicalUuid(result.invocationId)) {
    errors.push({ field: 'invocationId', code: 'invalid_uuid' });
  }
  if (result.decisionContextId != null && !isCanonicalUuid(result.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (!Object.values(INVOCATION_GATEWAY_LIFECYCLE).includes(result.lifecycleState)) {
    errors.push({ field: 'lifecycleState', code: 'invalid_lifecycle' });
  }
  if (!Object.values(MODEL_INVOCATION_STATUS).includes(result.normalizedStatus)) {
    errors.push({ field: 'normalizedStatus', code: 'invalid_status' });
  }
  if (result.policyVersion !== INVOCATION_GATEWAY_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', code: 'bad_policy_version' });
  }

  validateHardFalseFlags(result, errors);
  if (result.transportArmed !== false) {
    errors.push({ field: 'transportArmed', code: 'must_be_false' });
  }
  if (result.providerSelected !== false) {
    errors.push({ field: 'providerSelected', code: 'must_be_false' });
  }

  const timeoutCheck = validateTimeoutPolicy(result.timeoutPolicy);
  if (!timeoutCheck.ok) errors.push(...(timeoutCheck.errors || []));
  const budgetCheck = validateBudgetPolicy(result.budgetPolicy);
  if (!budgetCheck.ok) errors.push(...(budgetCheck.errors || []));
  const retryCheck = validateRetryPolicy(result.retryPolicy);
  if (!retryCheck.ok) errors.push(...(retryCheck.errors || []));

  if (result.invocationResponse != null) {
    const responseCheck = validateModelInvocationResponse(result.invocationResponse);
    if (!responseCheck.ok) {
      errors.push({
        field: 'invocationResponse',
        code: responseCheck.code || 'invalid_invocation_response',
        errors: responseCheck.errors || [],
      });
    }
  }

  validateGatewayProvenance(result.provenance, errors);
  validateLimitations(result.limitations, errors);
  validateSideEffects(result.sideEffects, errors);

  if (!isIsoTimestamp(result.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  const bytes = utf8ByteLength(result);
  if (bytes > MAX_GATEWAY_UTF8_BYTES) {
    errors.push({ field: 'result', code: 'too_large', bytes, limit: MAX_GATEWAY_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Gateway result failed validation', { errors, bytes });
  }
  return {
    ok: true,
    code: 'GATEWAY_RESULT_VALID',
    message: 'Gateway result accepted (advisory / non-executing)',
    errors: [],
    bytes,
  };
}

export default {
  INVOCATION_GATEWAY_STAGE,
  INVOCATION_GATEWAY_SCHEMA_VERSION,
  INVOCATION_GATEWAY_CONTRACT_VERSION,
  INVOCATION_GATEWAY_POLICY_VERSION,
  INVOCATION_GATEWAY_WRITER,
  INVOCATION_GATEWAY_LIFECYCLE,
  INVOCATION_GATEWAY_LIMITATIONS,
  ZERO_GATEWAY_SIDE_EFFECTS,
  validateTimeoutPolicy,
  validateBudgetPolicy,
  validateRetryPolicy,
  normalizeGatewayFailure,
  validateGatewayInvocationInput,
  planContractOnlyGatewayInvocation,
  validateGatewayPlan,
  buildContractOnlyGatewayResult,
  validateGatewayResult,
};
