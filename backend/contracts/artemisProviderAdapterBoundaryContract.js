/**
 * Artemis Core Stage 7.2.b.3.c.3 — Provider Adapter Boundary contract.
 *
 * Provider-independent adapter interface, capability declaration, request
 * mapping, response/failure normalization, and provenance schema.
 *
 * The adapter is an UNTRUSTED EXTERNAL CAPABILITY boundary.
 * It cannot become authority, approve execution, override deterministic
 * reasoning, alter lineage, Decision Context, or EvidenceOrchestrationSet.
 *
 * Does NOT:
 *   - connect any live LLM provider
 *   - import provider SDKs
 *   - create HTTP clients
 *   - read API keys / credentials
 *   - perform network calls
 *   - send prompts or execute model requests
 *   - store model outputs
 *   - modify legacy MoE / artemis decision routes
 *
 * Placement:
 *   Invocation Gateway (7.2.b.3.c.2)
 *     → Provider Adapter Boundary (this stage)
 *       → future live provider wiring (NOT here)
 */

import {
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  FORBIDDEN_INVOCATION_KEYS,
  MODEL_INVOCATION_CONTRACT_VERSION,
  MODEL_INVOCATION_STATUS,
  ZERO_MODEL_INVOCATION_SIDE_EFFECTS,
  buildContractOnlyModelInvocationResponse,
  validateModelInvocationResponse,
} from './artemisModelInvocationContract.js';
import {
  INVOCATION_GATEWAY_CONTRACT_VERSION,
  INVOCATION_GATEWAY_LIFECYCLE,
  validateGatewayPlan,
} from './artemisModelInvocationGatewayContract.js';
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

export const PROVIDER_ADAPTER_BOUNDARY_STAGE = '7.2.b.3.c.3';
export const PROVIDER_ADAPTER_BOUNDARY_SCHEMA_VERSION = '1.0.0';
export const PROVIDER_ADAPTER_BOUNDARY_CONTRACT_VERSION = 'artemis-provider-adapter-boundary-1.0.0';
export const PROVIDER_ADAPTER_BOUNDARY_POLICY_VERSION = 'stage7-2b3c3-provider-adapter-boundary-1.0.0';
export const PROVIDER_ADAPTER_BOUNDARY_WRITER = 'artemisProviderAdapterBoundaryContract';
export const PROVIDER_ADAPTER_VERSION = 'stage7-2b3c3-adapter-boundary-1.0.0';

export const REQUIRED_GATEWAY_CONTRACT_VERSION = INVOCATION_GATEWAY_CONTRACT_VERSION;
export const REQUIRED_INVOCATION_CONTRACT_VERSION = MODEL_INVOCATION_CONTRACT_VERSION;
export const REQUIRED_PROMPT_BOUNDARY_CONTRACT_VERSION = PROMPT_DATA_BOUNDARY_CONTRACT_VERSION;

export const MAX_ADAPTER_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 512;
export const MAX_LIMITATIONS = 64;

/**
 * Contract-only capability flags. Live providers are not connected.
 */
export const PROVIDER_CAPABILITY = Object.freeze({
  chatCompletion: false,
  structuredOutput: false,
  streaming: false,
  toolCalling: false,
  embeddings: false,
  connected: false,
  credentialed: false,
  networkEnabled: false,
});

export const PROVIDER_FALLBACK_STATUS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  NOT_ATTEMPTED: 'not_attempted',
  DEFERRED: 'deferred',
});

export const PROVIDER_ADAPTER_LIMITATIONS = Object.freeze([
  'stage7_2b3c3_provider_adapter_boundary_only',
  'untrusted_external_capability',
  'no_llm_provider_calls',
  'no_provider_sdk',
  'no_network_transport',
  'no_api_key_transport',
  'no_credential_access',
  'no_live_prompt_execution',
  'no_real_provider_values',
  'no_model_response_persistence',
  'cannot_become_authority',
  'cannot_override_deterministic_reasoning',
  'cannot_alter_lineage',
  'cannot_modify_decision_context',
  'cannot_modify_evidence_orchestration_set',
  'cannot_approve_execution',
  'no_execution_authorization',
  'no_order_intent',
  'cognitive_engine_product_not_started',
  'live_trading_not_authorized',
]);

export const ZERO_PROVIDER_ADAPTER_SIDE_EFFECTS = Object.freeze({
  ...ZERO_MODEL_INVOCATION_SIDE_EFFECTS,
});

const ALLOWED_CAPABILITY = Object.freeze([
  'chatCompletion',
  'structuredOutput',
  'streaming',
  'toolCalling',
  'embeddings',
  'connected',
  'credentialed',
  'networkEnabled',
  'note',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'note',
  'recordedAt',
  'providerFamily',
  'providerVersion',
  'adapterVersion',
  'requestId',
  'latencyMs',
  'fallbackStatus',
]);

const ALLOWED_ADAPTER_REQUEST_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'adapterRequestId',
  'gatewayId',
  'invocationId',
  'decisionContextId',
  'gatewayContractVersion',
  'invocationContractVersion',
  'policyVersion',
  'capability',
  'mappedInputSummary',
  'transportArmed',
  'providerConnected',
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

const ALLOWED_MAPPED_INPUT = Object.freeze([
  'decisionContextId',
  'gatewayLifecycleState',
  'contentHash',
  'boundaryContractVersion',
  'note',
]);

const ALLOWED_ADAPTER_RESPONSE_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'adapterRequestId',
  'gatewayId',
  'invocationId',
  'decisionContextId',
  'normalizedStatus',
  'failureCode',
  'failureMessage',
  'invocationResponse',
  'capability',
  'policyVersion',
  'advisoryOnly',
  'authoritative',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'cognitiveEngineStarted',
  'transportArmed',
  'providerConnected',
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
  for (const [key, expected] of Object.entries(ZERO_PROVIDER_ADAPTER_SIDE_EFFECTS)) {
    if (sideEffects[key] !== expected) {
      errors.push({ field: `sideEffects.${key}`, code: 'must_be_zero', expected });
    }
  }
}

function validateHardFalseFlags(obj, errors) {
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
        field,
        code: expected === true ? 'must_be_true' : 'must_be_false',
      });
    }
  }
}

/**
 * Validate provider capability contract. All live capabilities must be false.
 */
export function validateProviderCapability(capability) {
  const errors = [];
  if (!assertAllowlist(capability, ALLOWED_CAPABILITY, 'capability', errors)) {
    return fail('invalid_capability', 'Provider capability invalid', { errors });
  }
  for (const key of Object.keys(PROVIDER_CAPABILITY)) {
    if (capability[key] !== false) {
      errors.push({ field: `capability.${key}`, code: 'must_be_false_in_boundary' });
    }
  }
  assertStringMax('capability.note', capability.note, errors, { required: false });
  if (errors.length) {
    return fail('invalid_capability', 'Provider capability invalid', { errors });
  }
  return { ok: true, code: 'PROVIDER_CAPABILITY_VALID', message: 'Capability accepted', errors: [] };
}

function validateAdapterProvenance(provenance, errors) {
  if (!assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors)) return;
  assertStringMax('provenance.writer', provenance.writer, errors, { required: true });
  assertStringMax('provenance.methodKey', provenance.methodKey, errors, { required: true });
  if (provenance.stage !== PROVIDER_ADAPTER_BOUNDARY_STAGE) {
    errors.push({
      field: 'provenance.stage',
      code: 'bad_stage',
      expected: PROVIDER_ADAPTER_BOUNDARY_STAGE,
    });
  }
  assertStringMax('provenance.note', provenance.note, errors, { required: true, max: 1024 });
  if (!isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_iso_timestamp' });
  }
  // Future fields exist, but real provider values are forbidden now.
  if (provenance.providerFamily != null && provenance.providerFamily !== 'none') {
    errors.push({ field: 'provenance.providerFamily', code: 'must_be_none' });
  }
  if (provenance.providerVersion != null) {
    errors.push({ field: 'provenance.providerVersion', code: 'forbidden_real_provider_value' });
  }
  if (provenance.adapterVersion !== PROVIDER_ADAPTER_VERSION) {
    errors.push({
      field: 'provenance.adapterVersion',
      code: 'bad_adapter_version',
      expected: PROVIDER_ADAPTER_VERSION,
    });
  }
  if (provenance.requestId != null && !isCanonicalUuid(provenance.requestId)) {
    errors.push({ field: 'provenance.requestId', code: 'invalid_uuid' });
  }
  if (provenance.latencyMs != null) {
    if (!Number.isInteger(provenance.latencyMs) || provenance.latencyMs !== 0) {
      errors.push({ field: 'provenance.latencyMs', code: 'must_be_zero_without_transport' });
    }
  }
  if (
    provenance.fallbackStatus != null
    && !Object.values(PROVIDER_FALLBACK_STATUS).includes(provenance.fallbackStatus)
  ) {
    errors.push({ field: 'provenance.fallbackStatus', code: 'invalid_fallback_status' });
  }
}

/**
 * Map provider/adapter failure codes to ModelInvocationResponse statuses.
 */
export function normalizeProviderAdapterFailure(failure = {}) {
  const code = failure.code || failure.failureCode || 'provider_unavailable';
  const map = {
    invalid_adapter_request: MODEL_INVOCATION_STATUS.INVALID_SCHEMA,
    validation_failed: MODEL_INVOCATION_STATUS.INVALID_SCHEMA,
    authority_escalation: MODEL_INVOCATION_STATUS.REFUSAL,
    provider_unavailable: MODEL_INVOCATION_STATUS.UNAVAILABLE,
    provider_not_connected: MODEL_INVOCATION_STATUS.UNAVAILABLE,
    transport_deferred: MODEL_INVOCATION_STATUS.UNAVAILABLE,
    timeout: MODEL_INVOCATION_STATUS.TIMEOUT,
    refused: MODEL_INVOCATION_STATUS.REFUSAL,
  };
  return {
    ok: true,
    code: 'PROVIDER_ADAPTER_FAILURE_NORMALIZED',
    normalizedStatus: map[code] || MODEL_INVOCATION_STATUS.UNAVAILABLE,
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
 * Validate boundary input: gateway plan (+ optional bounded artifact).
 */
export function validateProviderAdapterBoundaryInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_adapter_input', 'Adapter input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }

  const allowedTop = [
    'gatewayPlan',
    'boundedModelInputArtifact',
    'adapterRequestId',
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

  if (!isCanonicalUuid(input.adapterRequestId)) {
    errors.push({ field: 'adapterRequestId', code: 'invalid_uuid' });
  }
  if (input.generatedAt != null && !isIsoTimestamp(input.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  const planCheck = validateGatewayPlan(input.gatewayPlan);
  if (!planCheck.ok) {
    errors.push({
      field: 'gatewayPlan',
      code: planCheck.code || 'invalid_gateway_plan',
      errors: planCheck.errors || [],
    });
  } else if (input.gatewayPlan.transportArmed === true) {
    errors.push({ field: 'gatewayPlan.transportArmed', code: 'must_be_false' });
  } else if (input.gatewayPlan.providerSelected === true) {
    errors.push({ field: 'gatewayPlan.providerSelected', code: 'must_be_false' });
  }

  if (boundedModelInputArtifact != null) {
    const artifactCheck = validateBoundedModelInputArtifact(boundedModelInputArtifact);
    if (!artifactCheck.ok) {
      errors.push({
        field: 'boundedModelInputArtifact',
        code: artifactCheck.code || 'invalid_bounded_input',
        errors: artifactCheck.errors || [],
      });
    } else if (
      input.gatewayPlan?.decisionContextId
      && String(boundedModelInputArtifact.decisionContextId).trim().toLowerCase()
        !== String(input.gatewayPlan.decisionContextId).trim().toLowerCase()
    ) {
      errors.push({
        field: 'boundedModelInputArtifact.decisionContextId',
        code: 'must_match_gateway_plan',
      });
    }
  }

  if (errors.length) {
    return fail('invalid_adapter_input', 'Provider adapter boundary input rejected', { errors });
  }
  return {
    ok: true,
    code: 'PROVIDER_ADAPTER_INPUT_VALID',
    message: 'Adapter boundary input accepted (no transport)',
    errors: [],
  };
}

function defaultCapability() {
  return {
    ...PROVIDER_CAPABILITY,
    note: 'boundary_capabilities_disabled',
  };
}

/**
 * Map a validated gateway plan into a provider-independent adapter request.
 * Never connects a provider.
 */
export function mapContractOnlyProviderAdapterRequest(input = {}) {
  const validation = validateProviderAdapterBoundaryInput(input);
  const recordedAt = input.generatedAt
    || input.gatewayPlan?.generatedAt
    || new Date().toISOString();
  const adapterRequestId = input.adapterRequestId;

  if (!validation.ok) {
    return {
      ok: false,
      code: 'PROVIDER_ADAPTER_REQUEST_REJECTED',
      message: validation.message,
      errors: validation.errors,
      request: null,
      response: buildContractOnlyProviderAdapterResponse({
        adapterRequestId,
        gatewayId: input.gatewayPlan?.gatewayId,
        invocationId: input.gatewayPlan?.invocationId,
        decisionContextId: input.gatewayPlan?.decisionContextId,
        normalizedStatus: MODEL_INVOCATION_STATUS.INVALID_SCHEMA,
        failureCode: 'invalid_adapter_request',
        failureMessage: validation.message,
        generatedAt: recordedAt,
      }),
    };
  }

  const plan = input.gatewayPlan;
  const artifact = input.boundedModelInputArtifact;

  const request = {
    schemaVersion: PROVIDER_ADAPTER_BOUNDARY_SCHEMA_VERSION,
    contractVersion: PROVIDER_ADAPTER_BOUNDARY_CONTRACT_VERSION,
    adapterRequestId,
    gatewayId: plan.gatewayId,
    invocationId: plan.invocationId,
    decisionContextId: plan.decisionContextId,
    gatewayContractVersion: REQUIRED_GATEWAY_CONTRACT_VERSION,
    invocationContractVersion: REQUIRED_INVOCATION_CONTRACT_VERSION,
    policyVersion: PROVIDER_ADAPTER_BOUNDARY_POLICY_VERSION,
    capability: defaultCapability(),
    mappedInputSummary: {
      decisionContextId: plan.decisionContextId,
      gatewayLifecycleState: plan.lifecycleState,
      contentHash: artifact?.sourceReferences?.contentHash ?? null,
      boundaryContractVersion: artifact
        ? REQUIRED_PROMPT_BOUNDARY_CONTRACT_VERSION
        : null,
      note: 'provider_independent_mapping_only',
    },
    transportArmed: false,
    providerConnected: false,
    advisoryOnly: true,
    authoritative: false,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveEngineStarted: false,
    limitations: [...PROVIDER_ADAPTER_LIMITATIONS],
    provenance: {
      writer: PROVIDER_ADAPTER_BOUNDARY_WRITER,
      methodKey: 'contract_only_provider_adapter_map',
      stage: PROVIDER_ADAPTER_BOUNDARY_STAGE,
      note: 'stage_7_2b3c3_provider_adapter_boundary_no_live_provider',
      recordedAt,
      providerFamily: 'none',
      providerVersion: null,
      adapterVersion: PROVIDER_ADAPTER_VERSION,
      requestId: adapterRequestId,
      latencyMs: 0,
      fallbackStatus: PROVIDER_FALLBACK_STATUS.NOT_APPLICABLE,
    },
    sideEffects: { ...ZERO_PROVIDER_ADAPTER_SIDE_EFFECTS },
    generatedAt: recordedAt,
  };

  // contentHash may be null — strip null optional? allowlist allows contentHash with null.
  // assertStringMax with required false allows null. Good.
  // But mappedInputSummary contentHash:null - validate later.

  const requestCheck = validateProviderAdapterRequest(request);
  if (!requestCheck.ok) {
    return {
      ok: false,
      code: 'PROVIDER_ADAPTER_REQUEST_INVALID',
      message: requestCheck.message,
      errors: requestCheck.errors,
      request: null,
      response: null,
    };
  }

  // Foundation: always unavailable / not connected — no live dispatch.
  const normalized = normalizeProviderAdapterFailure({
    code: 'provider_not_connected',
    message: 'Provider adapter boundary has no live provider',
  });

  return {
    ok: true,
    code: 'PROVIDER_ADAPTER_MAPPED_UNAVAILABLE',
    message: 'Adapter request mapped; provider not connected (boundary only)',
    errors: [],
    request,
    response: buildContractOnlyProviderAdapterResponse({
      adapterRequestId,
      gatewayId: plan.gatewayId,
      invocationId: plan.invocationId,
      decisionContextId: plan.decisionContextId,
      normalizedStatus: normalized.normalizedStatus,
      failureCode: normalized.failureCode,
      failureMessage: normalized.failureMessage,
      generatedAt: recordedAt,
    }),
  };
}

/**
 * Validate a provider-independent adapter request.
 */
export function validateProviderAdapterRequest(request) {
  const errors = [];
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return fail('invalid_request', 'Provider adapter request must be a plain object', {
      errors: [{ field: 'request', code: 'required_object' }],
    });
  }

  assertAllowlist(request, ALLOWED_ADAPTER_REQUEST_TOP, 'request', errors);
  assertForbiddenKeys(request, FORBIDDEN_INVOCATION_KEYS, errors, 'request');
  rejectExecutionAuthorityStrings(request, errors, 'request');

  const secretKeys = collectForbiddenSecretKeys(request);
  if (secretKeys.length) {
    errors.push({ field: 'request', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  if (request.schemaVersion !== PROVIDER_ADAPTER_BOUNDARY_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'unsupported_schema_version' });
  }
  if (request.contractVersion !== PROVIDER_ADAPTER_BOUNDARY_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'unsupported_contract_version' });
  }
  if (!isCanonicalUuid(request.adapterRequestId)) {
    errors.push({ field: 'adapterRequestId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(request.gatewayId)) {
    errors.push({ field: 'gatewayId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(request.invocationId)) {
    errors.push({ field: 'invocationId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(request.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (request.gatewayContractVersion !== REQUIRED_GATEWAY_CONTRACT_VERSION) {
    errors.push({ field: 'gatewayContractVersion', code: 'bad_gateway_contract_version' });
  }
  if (request.invocationContractVersion !== REQUIRED_INVOCATION_CONTRACT_VERSION) {
    errors.push({ field: 'invocationContractVersion', code: 'bad_invocation_contract_version' });
  }
  if (request.policyVersion !== PROVIDER_ADAPTER_BOUNDARY_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', code: 'bad_policy_version' });
  }

  const capabilityCheck = validateProviderCapability(request.capability);
  if (!capabilityCheck.ok) errors.push(...(capabilityCheck.errors || []));

  if (assertAllowlist(request.mappedInputSummary, ALLOWED_MAPPED_INPUT, 'mappedInputSummary', errors)) {
    if (!isCanonicalUuid(request.mappedInputSummary.decisionContextId)) {
      errors.push({ field: 'mappedInputSummary.decisionContextId', code: 'invalid_uuid' });
    }
    if (
      String(request.mappedInputSummary.decisionContextId).trim().toLowerCase()
      !== String(request.decisionContextId).trim().toLowerCase()
    ) {
      errors.push({
        field: 'mappedInputSummary.decisionContextId',
        code: 'must_match_decision_context_id',
      });
    }
    if (
      request.mappedInputSummary.gatewayLifecycleState != null
      && !Object.values(INVOCATION_GATEWAY_LIFECYCLE).includes(
        request.mappedInputSummary.gatewayLifecycleState,
      )
    ) {
      errors.push({
        field: 'mappedInputSummary.gatewayLifecycleState',
        code: 'invalid_lifecycle',
      });
    }
    assertStringMax(
      'mappedInputSummary.contentHash',
      request.mappedInputSummary.contentHash,
      errors,
      { required: false, max: 256 },
    );
    if (
      request.mappedInputSummary.boundaryContractVersion != null
      && request.mappedInputSummary.boundaryContractVersion
        !== REQUIRED_PROMPT_BOUNDARY_CONTRACT_VERSION
    ) {
      errors.push({
        field: 'mappedInputSummary.boundaryContractVersion',
        code: 'bad_boundary_contract_version',
      });
    }
    assertStringMax('mappedInputSummary.note', request.mappedInputSummary.note, errors, {
      required: false,
    });
  }

  if (request.transportArmed !== false) {
    errors.push({ field: 'transportArmed', code: 'must_be_false' });
  }
  if (request.providerConnected !== false) {
    errors.push({ field: 'providerConnected', code: 'must_be_false' });
  }

  validateHardFalseFlags(request, errors);
  validateAdapterProvenance(request.provenance, errors);
  validateLimitations(request.limitations, errors);
  validateSideEffects(request.sideEffects, errors);

  if (!isIsoTimestamp(request.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  const bytes = utf8ByteLength(request);
  if (bytes > MAX_ADAPTER_UTF8_BYTES) {
    errors.push({ field: 'request', code: 'too_large', bytes, limit: MAX_ADAPTER_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Provider adapter request failed validation', {
      errors,
      bytes,
    });
  }
  return {
    ok: true,
    code: 'PROVIDER_ADAPTER_REQUEST_VALID',
    message: 'Provider adapter request accepted (boundary only)',
    errors: [],
    bytes,
  };
}

/**
 * Build a contract-only normalized adapter response.
 */
export function buildContractOnlyProviderAdapterResponse(partial = {}) {
  const recordedAt = partial.generatedAt
    || partial.provenance?.recordedAt
    || new Date().toISOString();
  const normalizedStatus = partial.normalizedStatus ?? MODEL_INVOCATION_STATUS.UNAVAILABLE;
  const adapterRequestId = partial.adapterRequestId;

  const invocationResponse = buildContractOnlyModelInvocationResponse({
    invocationId: partial.invocationId,
    status: normalizedStatus,
    generatedAt: recordedAt,
    unavailableReason: partial.failureMessage
      || 'provider_adapter_boundary_not_connected',
    refusalReason: normalizedStatus === MODEL_INVOCATION_STATUS.REFUSAL
      ? (partial.failureMessage || 'provider_adapter_boundary_refusal')
      : undefined,
  });

  return {
    schemaVersion: PROVIDER_ADAPTER_BOUNDARY_SCHEMA_VERSION,
    contractVersion: PROVIDER_ADAPTER_BOUNDARY_CONTRACT_VERSION,
    adapterRequestId,
    gatewayId: partial.gatewayId,
    invocationId: partial.invocationId,
    decisionContextId: partial.decisionContextId,
    normalizedStatus,
    failureCode: partial.failureCode ?? 'provider_not_connected',
    failureMessage: partial.failureMessage ?? 'Provider adapter boundary has no live provider',
    invocationResponse,
    capability: defaultCapability(),
    policyVersion: PROVIDER_ADAPTER_BOUNDARY_POLICY_VERSION,
    advisoryOnly: true,
    authoritative: false,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveEngineStarted: false,
    transportArmed: false,
    providerConnected: false,
    limitations: Array.isArray(partial.limitations) && partial.limitations.length
      ? [...partial.limitations]
      : [...PROVIDER_ADAPTER_LIMITATIONS],
    provenance: {
      writer: PROVIDER_ADAPTER_BOUNDARY_WRITER,
      methodKey: partial.provenance?.methodKey ?? 'contract_only_provider_adapter_response',
      stage: PROVIDER_ADAPTER_BOUNDARY_STAGE,
      note: partial.provenance?.note ?? 'stage_7_2b3c3_provider_adapter_boundary_no_model_call',
      recordedAt,
      providerFamily: 'none',
      providerVersion: null,
      adapterVersion: PROVIDER_ADAPTER_VERSION,
      requestId: adapterRequestId,
      latencyMs: 0,
      fallbackStatus: PROVIDER_FALLBACK_STATUS.NOT_APPLICABLE,
    },
    sideEffects: { ...ZERO_PROVIDER_ADAPTER_SIDE_EFFECTS },
    generatedAt: recordedAt,
  };
}

/**
 * Validate a normalized provider adapter response.
 */
export function validateProviderAdapterResponse(response) {
  const errors = [];
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return fail('invalid_response', 'Provider adapter response must be a plain object', {
      errors: [{ field: 'response', code: 'required_object' }],
    });
  }

  assertAllowlist(response, ALLOWED_ADAPTER_RESPONSE_TOP, 'response', errors);
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

  if (response.schemaVersion !== PROVIDER_ADAPTER_BOUNDARY_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'unsupported_schema_version' });
  }
  if (response.contractVersion !== PROVIDER_ADAPTER_BOUNDARY_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'unsupported_contract_version' });
  }
  if (response.adapterRequestId != null && !isCanonicalUuid(response.adapterRequestId)) {
    errors.push({ field: 'adapterRequestId', code: 'invalid_uuid' });
  }
  if (response.gatewayId != null && !isCanonicalUuid(response.gatewayId)) {
    errors.push({ field: 'gatewayId', code: 'invalid_uuid' });
  }
  if (response.invocationId != null && !isCanonicalUuid(response.invocationId)) {
    errors.push({ field: 'invocationId', code: 'invalid_uuid' });
  }
  if (response.decisionContextId != null && !isCanonicalUuid(response.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (!Object.values(MODEL_INVOCATION_STATUS).includes(response.normalizedStatus)) {
    errors.push({ field: 'normalizedStatus', code: 'invalid_status' });
  }
  if (response.policyVersion !== PROVIDER_ADAPTER_BOUNDARY_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', code: 'bad_policy_version' });
  }

  validateHardFalseFlags(response, errors);
  if (response.transportArmed !== false) {
    errors.push({ field: 'transportArmed', code: 'must_be_false' });
  }
  if (response.providerConnected !== false) {
    errors.push({ field: 'providerConnected', code: 'must_be_false' });
  }

  // Authority escalation: any attempt to flip hard flags is already caught;
  // additionally reject success with providerConnected claims.
  if (
    response.normalizedStatus === MODEL_INVOCATION_STATUS.SUCCESS
    && response.providerConnected !== false
  ) {
    errors.push({ field: 'normalizedStatus', code: 'authority_escalation' });
  }

  const capabilityCheck = validateProviderCapability(response.capability);
  if (!capabilityCheck.ok) errors.push(...(capabilityCheck.errors || []));

  if (response.invocationResponse != null) {
    const responseCheck = validateModelInvocationResponse(response.invocationResponse);
    if (!responseCheck.ok) {
      errors.push({
        field: 'invocationResponse',
        code: responseCheck.code || 'invalid_invocation_response',
        errors: responseCheck.errors || [],
      });
    }
  }

  validateAdapterProvenance(response.provenance, errors);
  validateLimitations(response.limitations, errors);
  validateSideEffects(response.sideEffects, errors);

  if (!isIsoTimestamp(response.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  const bytes = utf8ByteLength(response);
  if (bytes > MAX_ADAPTER_UTF8_BYTES) {
    errors.push({ field: 'response', code: 'too_large', bytes, limit: MAX_ADAPTER_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Provider adapter response failed validation', {
      errors,
      bytes,
    });
  }
  return {
    ok: true,
    code: 'PROVIDER_ADAPTER_RESPONSE_VALID',
    message: 'Provider adapter response accepted (advisory / non-executing)',
    errors: [],
    bytes,
  };
}

export default {
  PROVIDER_ADAPTER_BOUNDARY_STAGE,
  PROVIDER_ADAPTER_BOUNDARY_SCHEMA_VERSION,
  PROVIDER_ADAPTER_BOUNDARY_CONTRACT_VERSION,
  PROVIDER_ADAPTER_BOUNDARY_POLICY_VERSION,
  PROVIDER_ADAPTER_BOUNDARY_WRITER,
  PROVIDER_ADAPTER_VERSION,
  PROVIDER_CAPABILITY,
  PROVIDER_FALLBACK_STATUS,
  PROVIDER_ADAPTER_LIMITATIONS,
  ZERO_PROVIDER_ADAPTER_SIDE_EFFECTS,
  validateProviderCapability,
  normalizeProviderAdapterFailure,
  validateProviderAdapterBoundaryInput,
  mapContractOnlyProviderAdapterRequest,
  validateProviderAdapterRequest,
  buildContractOnlyProviderAdapterResponse,
  validateProviderAdapterResponse,
};
