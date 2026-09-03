/**
 * Artemis Core Stage 7.2.b.3.c.1 — Model Invocation Contract foundation.
 *
 * Contract-only: validates ModelInvocationRequest / ModelInvocationResponse
 * envelopes for a future provider-independent invocation layer.
 *
 * Does NOT:
 *   - call LLMs or provider SDKs
 *   - open network sockets or create HTTP clients
 *   - transport API keys / credentials
 *   - execute prompts against a live model
 *   - persist model responses
 *   - authorize execution or start the Cognitive Engine product
 *
 * Placement:
 *   Prompt/Data Boundary (7.2.b.3.b)
 *     → Model Invocation Contract (this stage)
 *       → future provider wiring / transport (NOT here)
 */

import {
  MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
  MODEL_ASSISTED_ADAPTER_VERSION,
} from './artemisModelAssistedAdapterContract.js';
import {
  PROMPT_DATA_BOUNDARY_CONTRACT_VERSION,
  PROMPT_DATA_BOUNDARY_VERSION,
  validateBoundedModelInputArtifact,
} from './artemisModelAssistedPromptDataBoundaryContract.js';
import {
  ENGINE_INTERFACE_CONTRACT_VERSION,
} from './artemisCognitiveEngineInterfaceContract.js';
import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';

export const MODEL_INVOCATION_STAGE = '7.2.b.3.c.1';
export const MODEL_INVOCATION_SCHEMA_VERSION = '1.0.0';
export const MODEL_INVOCATION_CONTRACT_VERSION = 'artemis-model-invocation-1.0.0';
export const MODEL_INVOCATION_POLICY_VERSION = 'stage7-2b3c1-model-invocation-contract-1.0.0';
export const MODEL_INVOCATION_WRITER = 'artemisModelInvocationContract';

export const REQUIRED_ADAPTER_CONTRACT_VERSION = MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION;
export const REQUIRED_ADAPTER_VERSION = MODEL_ASSISTED_ADAPTER_VERSION;
export const REQUIRED_BOUNDARY_CONTRACT_VERSION = PROMPT_DATA_BOUNDARY_CONTRACT_VERSION;
export const REQUIRED_BOUNDARY_VERSION = PROMPT_DATA_BOUNDARY_VERSION;
export const REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION = ENGINE_INTERFACE_CONTRACT_VERSION;

export const MAX_INVOCATION_UTF8_BYTES = 24 * 1024;
export const MAX_STRING_CHARS = 512;
export const MAX_LIMITATIONS = 64;
export const MAX_ADVISORY_SUMMARY_CHARS = 2048;

/**
 * Contract-level response statuses. Transport/provider outcomes map here later;
 * this stage never produces a live provider result.
 */
export const MODEL_INVOCATION_STATUS = Object.freeze({
  SUCCESS: 'success',
  REFUSAL: 'refusal',
  TIMEOUT: 'timeout',
  UNAVAILABLE: 'unavailable',
  INVALID_SCHEMA: 'invalid_schema',
});

export const MODEL_INVOCATION_LIMITATIONS = Object.freeze([
  'stage7_2b3c1_model_invocation_contract_only',
  'no_llm_provider_calls',
  'no_provider_sdk',
  'no_network_transport',
  'no_api_key_transport',
  'no_credential_access',
  'no_live_prompt_execution',
  'no_model_response_persistence',
  'provider_independent_interface_only',
  'model_output_untrusted_advisory_non_authoritative',
  'cannot_override_deterministic_analysis',
  'cannot_approve_execution',
  'cannot_change_controls',
  'no_execution_authorization',
  'no_order_intent',
  'cognitive_engine_product_not_started',
  'live_trading_not_authorized',
]);

export const ZERO_MODEL_INVOCATION_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  agentExecutionCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  llmCallCount: 0,
  networkRequestCount: 0,
});

export const FORBIDDEN_INVOCATION_KEYS = Object.freeze([
  'orderId',
  'order_id',
  'executionCommand',
  'execution_command',
  'executionIntent',
  'execution_intent',
  'walletAction',
  'wallet_action',
  'walletData',
  'wallet_data',
  'tradeInstruction',
  'trade_instruction',
  'approved',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'credentials',
  'jwt',
  'JWT',
  'signedQuery',
  'signed_query',
  'providerPayload',
  'provider_payload',
  'raw',
  'payload',
  'rawAgentOutput',
  'raw_agent_output',
  'rawAgentObject',
  'raw_agent_object',
  'prompt',
  'promptText',
  'prompt_text',
  'systemPrompt',
  'system_prompt',
  'authorizationHeader',
  'authorization_header',
]);

export const FORBIDDEN_EXECUTION_AUTHORITY_VALUES = Object.freeze([
  'BUY',
  'SELL',
  'EXECUTE',
  'LONG',
  'SHORT',
]);

const ALLOWED_REQUEST_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'invocationId',
  'adapterVersion',
  'adapterContractVersion',
  'boundaryVersion',
  'boundaryContractVersion',
  'inputReference',
  'cognitiveAnalysisReference',
  'policyVersion',
  'budget',
  'timeout',
  'provenance',
  'limitations',
  'sideEffects',
  'boundedModelInputArtifact',
  'generatedAt',
]);

const ALLOWED_RESPONSE_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'invocationId',
  'status',
  'adapterVersion',
  'boundaryVersion',
  'policyVersion',
  'advisoryOnly',
  'authoritative',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'cognitiveEngineStarted',
  'advisorySummary',
  'refusalReason',
  'unavailableReason',
  'limitations',
  'provenance',
  'sideEffects',
  'generatedAt',
]);

const ALLOWED_INPUT_REFERENCE = Object.freeze([
  'decisionContextId',
  'boundaryContractVersion',
  'boundaryVersion',
  'boundaryGeneratedAt',
  'contentHash',
]);

const ALLOWED_ANALYSIS_REFERENCE = Object.freeze([
  'decisionContextId',
  'engineInterfaceContractVersion',
  'uncertaintyState',
  'abstentionState',
  'analysisGeneratedAt',
]);

const ALLOWED_BUDGET = Object.freeze([
  'maxUtf8Bytes',
  'maxTokens',
  'maxCostUnits',
  'note',
]);

const ALLOWED_TIMEOUT = Object.freeze([
  'timeoutMs',
  'softTimeoutMs',
  'note',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'note',
  'recordedAt',
  'providerId',
  'modelId',
  'modelVersion',
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

function validateProvenance(provenance, errors, { allowLiveProvider = false } = {}) {
  if (!assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors)) return;
  assertStringMax('provenance.writer', provenance.writer, errors, { required: true });
  assertStringMax('provenance.methodKey', provenance.methodKey, errors, { required: true });
  if (provenance.stage !== MODEL_INVOCATION_STAGE) {
    errors.push({
      field: 'provenance.stage',
      code: 'bad_stage',
      expected: MODEL_INVOCATION_STAGE,
    });
  }
  assertStringMax('provenance.note', provenance.note, errors, { required: true, max: 1024 });
  if (!isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_iso_timestamp' });
  }
  // Contract-only stage: live provider/model identity must not be claimed yet.
  if (!allowLiveProvider) {
    for (const field of ['providerId', 'modelId', 'modelVersion']) {
      if (provenance[field] != null) {
        errors.push({ field: `provenance.${field}`, code: 'forbidden_in_contract_only_stage' });
      }
    }
  }
}

function validateBudget(budget, errors) {
  if (!assertAllowlist(budget, ALLOWED_BUDGET, 'budget', errors)) return;
  if (budget.maxUtf8Bytes != null) {
    if (!Number.isInteger(budget.maxUtf8Bytes) || budget.maxUtf8Bytes <= 0
      || budget.maxUtf8Bytes > MAX_INVOCATION_UTF8_BYTES) {
      errors.push({ field: 'budget.maxUtf8Bytes', code: 'invalid_budget' });
    }
  }
  if (budget.maxTokens != null) {
    if (!Number.isInteger(budget.maxTokens) || budget.maxTokens <= 0 || budget.maxTokens > 128000) {
      errors.push({ field: 'budget.maxTokens', code: 'invalid_budget' });
    }
  }
  if (budget.maxCostUnits != null) {
    if (typeof budget.maxCostUnits !== 'number' || !(budget.maxCostUnits >= 0)
      || budget.maxCostUnits > 1e6) {
      errors.push({ field: 'budget.maxCostUnits', code: 'invalid_budget' });
    }
  }
  assertStringMax('budget.note', budget.note, errors, { required: false });
}

function validateTimeout(timeout, errors) {
  if (!assertAllowlist(timeout, ALLOWED_TIMEOUT, 'timeout', errors)) return;
  if (!Number.isInteger(timeout.timeoutMs) || timeout.timeoutMs <= 0 || timeout.timeoutMs > 120000) {
    errors.push({ field: 'timeout.timeoutMs', code: 'invalid_timeout' });
  }
  if (timeout.softTimeoutMs != null) {
    if (!Number.isInteger(timeout.softTimeoutMs) || timeout.softTimeoutMs <= 0
      || timeout.softTimeoutMs > timeout.timeoutMs) {
      errors.push({ field: 'timeout.softTimeoutMs', code: 'invalid_soft_timeout' });
    }
  }
  assertStringMax('timeout.note', timeout.note, errors, { required: false });
}

function validateInputReference(ref, errors) {
  if (!assertAllowlist(ref, ALLOWED_INPUT_REFERENCE, 'inputReference', errors)) return;
  if (!isCanonicalUuid(ref.decisionContextId)) {
    errors.push({ field: 'inputReference.decisionContextId', code: 'invalid_uuid' });
  }
  if (ref.boundaryContractVersion !== REQUIRED_BOUNDARY_CONTRACT_VERSION) {
    errors.push({
      field: 'inputReference.boundaryContractVersion',
      code: 'bad_boundary_contract_version',
      expected: REQUIRED_BOUNDARY_CONTRACT_VERSION,
    });
  }
  if (ref.boundaryVersion !== REQUIRED_BOUNDARY_VERSION) {
    errors.push({
      field: 'inputReference.boundaryVersion',
      code: 'bad_boundary_version',
      expected: REQUIRED_BOUNDARY_VERSION,
    });
  }
  if (ref.boundaryGeneratedAt != null && !isIsoTimestamp(ref.boundaryGeneratedAt)) {
    errors.push({ field: 'inputReference.boundaryGeneratedAt', code: 'invalid_iso_timestamp' });
  }
  assertStringMax('inputReference.contentHash', ref.contentHash, errors, {
    required: false,
    max: 128,
  });
}

function validateAnalysisReference(ref, errors) {
  if (ref == null) return;
  if (!assertAllowlist(ref, ALLOWED_ANALYSIS_REFERENCE, 'cognitiveAnalysisReference', errors)) {
    return;
  }
  if (!isCanonicalUuid(ref.decisionContextId)) {
    errors.push({ field: 'cognitiveAnalysisReference.decisionContextId', code: 'invalid_uuid' });
  }
  if (ref.engineInterfaceContractVersion !== REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION) {
    errors.push({
      field: 'cognitiveAnalysisReference.engineInterfaceContractVersion',
      code: 'bad_engine_interface_contract_version',
      expected: REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION,
    });
  }
  assertStringMax(
    'cognitiveAnalysisReference.uncertaintyState',
    ref.uncertaintyState,
    errors,
    { required: false },
  );
  assertStringMax(
    'cognitiveAnalysisReference.abstentionState',
    ref.abstentionState,
    errors,
    { required: false },
  );
  if (ref.analysisGeneratedAt != null && !isIsoTimestamp(ref.analysisGeneratedAt)) {
    errors.push({
      field: 'cognitiveAnalysisReference.analysisGeneratedAt',
      code: 'invalid_iso_timestamp',
    });
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
  for (const [key, expected] of Object.entries(ZERO_MODEL_INVOCATION_SIDE_EFFECTS)) {
    if (sideEffects[key] !== expected) {
      errors.push({
        field: `sideEffects.${key}`,
        code: 'must_be_zero',
        expected,
      });
    }
  }
}

/**
 * Validate a ModelInvocationRequest (contract-only; no transport).
 */
export function validateModelInvocationRequest(request) {
  const errors = [];
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return fail('invalid_request', 'ModelInvocationRequest must be a plain object', {
      errors: [{ field: 'request', code: 'required_object' }],
    });
  }

  assertAllowlist(request, ALLOWED_REQUEST_TOP, 'request', errors);

  // Nested BoundedModelInputArtifact is validated by its own contract; skip its
  // interior when applying invocation-level forbidden-key / authority walks.
  const { boundedModelInputArtifact, ...requestWithoutArtifact } = request;
  assertForbiddenKeys(requestWithoutArtifact, FORBIDDEN_INVOCATION_KEYS, errors, 'request');
  rejectExecutionAuthorityStrings(requestWithoutArtifact, errors, 'request');

  const secretKeys = collectForbiddenSecretKeys(requestWithoutArtifact);
  if (secretKeys.length) {
    errors.push({ field: 'request', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  if (request.schemaVersion !== MODEL_INVOCATION_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'unsupported_schema_version' });
  }
  if (request.contractVersion !== MODEL_INVOCATION_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'unsupported_contract_version' });
  }
  if (!isCanonicalUuid(request.invocationId)) {
    errors.push({ field: 'invocationId', code: 'invalid_uuid' });
  }
  if (request.adapterVersion !== REQUIRED_ADAPTER_VERSION) {
    errors.push({
      field: 'adapterVersion',
      code: 'bad_adapter_version',
      expected: REQUIRED_ADAPTER_VERSION,
    });
  }
  if (request.adapterContractVersion !== REQUIRED_ADAPTER_CONTRACT_VERSION) {
    errors.push({
      field: 'adapterContractVersion',
      code: 'bad_adapter_contract_version',
      expected: REQUIRED_ADAPTER_CONTRACT_VERSION,
    });
  }
  if (request.boundaryVersion !== REQUIRED_BOUNDARY_VERSION) {
    errors.push({
      field: 'boundaryVersion',
      code: 'bad_boundary_version',
      expected: REQUIRED_BOUNDARY_VERSION,
    });
  }
  if (request.boundaryContractVersion !== REQUIRED_BOUNDARY_CONTRACT_VERSION) {
    errors.push({
      field: 'boundaryContractVersion',
      code: 'bad_boundary_contract_version',
      expected: REQUIRED_BOUNDARY_CONTRACT_VERSION,
    });
  }
  if (request.policyVersion !== MODEL_INVOCATION_POLICY_VERSION) {
    errors.push({
      field: 'policyVersion',
      code: 'bad_policy_version',
      expected: MODEL_INVOCATION_POLICY_VERSION,
    });
  }

  validateInputReference(request.inputReference, errors);
  validateAnalysisReference(request.cognitiveAnalysisReference, errors);
  validateBudget(request.budget, errors);
  validateTimeout(request.timeout, errors);
  validateProvenance(request.provenance, errors, { allowLiveProvider: false });
  validateLimitations(request.limitations, errors);
  validateSideEffects(request.sideEffects, errors);

  if (request.generatedAt != null && !isIsoTimestamp(request.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  if (request.boundedModelInputArtifact != null) {
    const boundaryCheck = validateBoundedModelInputArtifact(request.boundedModelInputArtifact);
    if (!boundaryCheck.ok) {
      errors.push({
        field: 'boundedModelInputArtifact',
        code: boundaryCheck.code || 'invalid_bounded_input',
        errors: boundaryCheck.errors || [],
      });
    } else if (
      request.inputReference?.decisionContextId
      && String(request.boundedModelInputArtifact.decisionContextId).trim().toLowerCase()
        !== String(request.inputReference.decisionContextId).trim().toLowerCase()
    ) {
      errors.push({
        field: 'boundedModelInputArtifact.decisionContextId',
        code: 'must_match_input_reference',
      });
    }
  }

  if (
    request.inputReference?.decisionContextId
    && request.cognitiveAnalysisReference?.decisionContextId
    && String(request.inputReference.decisionContextId).trim().toLowerCase()
      !== String(request.cognitiveAnalysisReference.decisionContextId).trim().toLowerCase()
  ) {
    errors.push({
      field: 'cognitiveAnalysisReference.decisionContextId',
      code: 'must_match_input_reference',
    });
  }

  const bytes = utf8ByteLength(request);
  if (bytes > MAX_INVOCATION_UTF8_BYTES) {
    errors.push({
      field: 'request',
      code: 'too_large',
      bytes,
      limit: MAX_INVOCATION_UTF8_BYTES,
    });
  }

  if (errors.length) {
    return fail('validation_failed', 'ModelInvocationRequest failed validation', { errors, bytes });
  }
  return {
    ok: true,
    code: 'MODEL_INVOCATION_REQUEST_VALID',
    message: 'ModelInvocationRequest accepted (contract-only; no transport)',
    errors: [],
    bytes,
  };
}

/**
 * Validate a ModelInvocationResponse. Hard-enforces advisory / non-executing flags.
 */
export function validateModelInvocationResponse(response) {
  const errors = [];
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return fail('invalid_response', 'ModelInvocationResponse must be a plain object', {
      errors: [{ field: 'response', code: 'required_object' }],
    });
  }

  assertAllowlist(response, ALLOWED_RESPONSE_TOP, 'response', errors);
  assertForbiddenKeys(response, FORBIDDEN_INVOCATION_KEYS, errors, 'response');
  rejectExecutionAuthorityStrings(response, errors, 'response');

  const secretKeys = collectForbiddenSecretKeys(response);
  if (secretKeys.length) {
    errors.push({
      field: 'response',
      code: 'forbidden_secret_keys',
      keys: [...new Set(secretKeys)],
    });
  }

  if (response.schemaVersion !== MODEL_INVOCATION_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'unsupported_schema_version' });
  }
  if (response.contractVersion !== MODEL_INVOCATION_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'unsupported_contract_version' });
  }
  if (!isCanonicalUuid(response.invocationId)) {
    errors.push({ field: 'invocationId', code: 'invalid_uuid' });
  }
  if (!Object.values(MODEL_INVOCATION_STATUS).includes(response.status)) {
    errors.push({ field: 'status', code: 'invalid_status' });
  }
  if (response.adapterVersion !== REQUIRED_ADAPTER_VERSION) {
    errors.push({ field: 'adapterVersion', code: 'bad_adapter_version' });
  }
  if (response.boundaryVersion !== REQUIRED_BOUNDARY_VERSION) {
    errors.push({ field: 'boundaryVersion', code: 'bad_boundary_version' });
  }
  if (response.policyVersion !== MODEL_INVOCATION_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', code: 'bad_policy_version' });
  }

  if (response.advisoryOnly !== true) {
    errors.push({ field: 'advisoryOnly', code: 'must_be_true' });
  }
  if (response.authoritative !== false) {
    errors.push({ field: 'authoritative', code: 'must_be_false' });
  }
  if (response.decisionEligible !== false) {
    errors.push({ field: 'decisionEligible', code: 'must_be_false' });
  }
  if (response.executionEligible !== false) {
    errors.push({ field: 'executionEligible', code: 'must_be_false' });
  }
  if (response.approvedForExecution !== false) {
    errors.push({ field: 'approvedForExecution', code: 'must_be_false' });
  }
  if (response.cognitiveEngineStarted !== false) {
    errors.push({ field: 'cognitiveEngineStarted', code: 'must_be_false' });
  }

  if (response.status === MODEL_INVOCATION_STATUS.SUCCESS) {
    assertStringMax('advisorySummary', response.advisorySummary, errors, {
      required: false,
      max: MAX_ADVISORY_SUMMARY_CHARS,
    });
  }
  if (response.status === MODEL_INVOCATION_STATUS.REFUSAL) {
    assertStringMax('refusalReason', response.refusalReason, errors, { required: true, max: 1024 });
  }
  if (
    response.status === MODEL_INVOCATION_STATUS.UNAVAILABLE
    || response.status === MODEL_INVOCATION_STATUS.TIMEOUT
  ) {
    assertStringMax('unavailableReason', response.unavailableReason, errors, {
      required: true,
      max: 1024,
    });
  }
  if (response.status === MODEL_INVOCATION_STATUS.INVALID_SCHEMA) {
    assertStringMax('unavailableReason', response.unavailableReason, errors, {
      required: true,
      max: 1024,
    });
  }

  validateProvenance(response.provenance, errors, { allowLiveProvider: false });
  validateLimitations(response.limitations, errors);
  validateSideEffects(response.sideEffects, errors);

  if (!isIsoTimestamp(response.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  const bytes = utf8ByteLength(response);
  if (bytes > MAX_INVOCATION_UTF8_BYTES) {
    errors.push({
      field: 'response',
      code: 'too_large',
      bytes,
      limit: MAX_INVOCATION_UTF8_BYTES,
    });
  }

  if (errors.length) {
    return fail('validation_failed', 'ModelInvocationResponse failed validation', {
      errors,
      bytes,
    });
  }
  return {
    ok: true,
    code: 'MODEL_INVOCATION_RESPONSE_VALID',
    message: 'ModelInvocationResponse accepted (advisory / non-executing)',
    errors: [],
    bytes,
  };
}

/**
 * Build a contract-only ModelInvocationRequest skeleton. No model call.
 */
export function buildContractOnlyModelInvocationRequest(partial = {}) {
  const invocationId = partial.invocationId;
  const decisionContextId = partial.decisionContextId
    || partial.inputReference?.decisionContextId;
  const recordedAt = partial.generatedAt
    || partial.provenance?.recordedAt
    || new Date().toISOString();

  const request = {
    schemaVersion: MODEL_INVOCATION_SCHEMA_VERSION,
    contractVersion: MODEL_INVOCATION_CONTRACT_VERSION,
    invocationId,
    adapterVersion: REQUIRED_ADAPTER_VERSION,
    adapterContractVersion: REQUIRED_ADAPTER_CONTRACT_VERSION,
    boundaryVersion: REQUIRED_BOUNDARY_VERSION,
    boundaryContractVersion: REQUIRED_BOUNDARY_CONTRACT_VERSION,
    inputReference: {
      decisionContextId,
      boundaryContractVersion: REQUIRED_BOUNDARY_CONTRACT_VERSION,
      boundaryVersion: REQUIRED_BOUNDARY_VERSION,
      boundaryGeneratedAt: partial.inputReference?.boundaryGeneratedAt ?? null,
      contentHash: partial.inputReference?.contentHash,
    },
    cognitiveAnalysisReference: partial.cognitiveAnalysisReference
      ? {
        decisionContextId:
            partial.cognitiveAnalysisReference.decisionContextId || decisionContextId,
        engineInterfaceContractVersion: REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION,
        uncertaintyState: partial.cognitiveAnalysisReference.uncertaintyState,
        abstentionState: partial.cognitiveAnalysisReference.abstentionState,
        analysisGeneratedAt: partial.cognitiveAnalysisReference.analysisGeneratedAt ?? null,
      }
      : undefined,
    policyVersion: MODEL_INVOCATION_POLICY_VERSION,
    budget: {
      maxUtf8Bytes: partial.budget?.maxUtf8Bytes ?? MAX_INVOCATION_UTF8_BYTES,
      maxTokens: partial.budget?.maxTokens ?? 4096,
      maxCostUnits: partial.budget?.maxCostUnits ?? 0,
      note: partial.budget?.note ?? 'contract_only_budget_placeholder',
    },
    timeout: {
      timeoutMs: partial.timeout?.timeoutMs ?? 15000,
      softTimeoutMs: partial.timeout?.softTimeoutMs ?? 10000,
      note: partial.timeout?.note ?? 'contract_only_timeout_placeholder',
    },
    provenance: {
      writer: MODEL_INVOCATION_WRITER,
      methodKey: partial.provenance?.methodKey ?? 'contract_only_request_skeleton',
      stage: MODEL_INVOCATION_STAGE,
      note: partial.provenance?.note ?? 'stage_7_2b3c1_model_invocation_contract_no_transport',
      recordedAt,
    },
    limitations: Array.isArray(partial.limitations) && partial.limitations.length
      ? [...partial.limitations]
      : [...MODEL_INVOCATION_LIMITATIONS],
    sideEffects: { ...ZERO_MODEL_INVOCATION_SIDE_EFFECTS },
    generatedAt: recordedAt,
  };

  if (partial.boundedModelInputArtifact != null) {
    request.boundedModelInputArtifact = partial.boundedModelInputArtifact;
  }

  return request;
}

/**
 * Build a contract-only ModelInvocationResponse for a declared status.
 * Never claims live provider success beyond the advisory envelope.
 */
export function buildContractOnlyModelInvocationResponse(partial = {}) {
  const status = partial.status ?? MODEL_INVOCATION_STATUS.UNAVAILABLE;
  const recordedAt = partial.generatedAt
    || partial.provenance?.recordedAt
    || new Date().toISOString();

  const response = {
    schemaVersion: MODEL_INVOCATION_SCHEMA_VERSION,
    contractVersion: MODEL_INVOCATION_CONTRACT_VERSION,
    invocationId: partial.invocationId,
    status,
    adapterVersion: REQUIRED_ADAPTER_VERSION,
    boundaryVersion: REQUIRED_BOUNDARY_VERSION,
    policyVersion: MODEL_INVOCATION_POLICY_VERSION,
    advisoryOnly: true,
    authoritative: false,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveEngineStarted: false,
    advisorySummary: partial.advisorySummary ?? null,
    refusalReason: partial.refusalReason,
    unavailableReason: partial.unavailableReason
      ?? (status === MODEL_INVOCATION_STATUS.UNAVAILABLE
        ? 'contract_only_no_provider_transport'
        : undefined),
    limitations: Array.isArray(partial.limitations) && partial.limitations.length
      ? [...partial.limitations]
      : [...MODEL_INVOCATION_LIMITATIONS],
    provenance: {
      writer: MODEL_INVOCATION_WRITER,
      methodKey: partial.provenance?.methodKey ?? 'contract_only_response_skeleton',
      stage: MODEL_INVOCATION_STAGE,
      note: partial.provenance?.note ?? 'stage_7_2b3c1_model_invocation_contract_no_model_call',
      recordedAt,
    },
    sideEffects: { ...ZERO_MODEL_INVOCATION_SIDE_EFFECTS },
    generatedAt: recordedAt,
  };

  if (status === MODEL_INVOCATION_STATUS.REFUSAL && response.refusalReason == null) {
    response.refusalReason = 'contract_only_refusal_placeholder';
  }
  if (
    (status === MODEL_INVOCATION_STATUS.TIMEOUT
      || status === MODEL_INVOCATION_STATUS.INVALID_SCHEMA)
    && response.unavailableReason == null
  ) {
    response.unavailableReason = `contract_only_${status}`;
  }

  return response;
}

export default {
  MODEL_INVOCATION_STAGE,
  MODEL_INVOCATION_SCHEMA_VERSION,
  MODEL_INVOCATION_CONTRACT_VERSION,
  MODEL_INVOCATION_POLICY_VERSION,
  MODEL_INVOCATION_WRITER,
  MODEL_INVOCATION_STATUS,
  MODEL_INVOCATION_LIMITATIONS,
  ZERO_MODEL_INVOCATION_SIDE_EFFECTS,
  FORBIDDEN_INVOCATION_KEYS,
  validateModelInvocationRequest,
  validateModelInvocationResponse,
  buildContractOnlyModelInvocationRequest,
  buildContractOnlyModelInvocationResponse,
};
