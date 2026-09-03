/**
 * Artemis Core Stage 7.2.b.3.a — Model-assisted Adapter Contract foundation.
 *
 * Contract-only: validates ModelAssistedContribution artifacts and adapter
 * request envelopes. Does NOT call LLMs, import provider SDKs, build prompts,
 * open network sockets, persist model output, authorize execution, or start
 * the Cognitive Engine product.
 *
 * Placement:
 *   Decision Context (7.1)
 *     → Kernel Contract (7.2.a)
 *       → Engine Interface (7.2.b.1)
 *         → Deterministic Reasoning (7.2.b.2)
 *           → Model-assisted Adapter Contract (this stage)
 *             → future prompt/data boundary / invocation (NOT here)
 *
 * Model output (when a later stage produces it) remains:
 *   untrusted · advisory · non-authoritative
 */

import { DECISION_CONTEXT_CONTRACT_VERSION } from './artemisDecisionContextContract.js';
import {
  ENGINE_INTERFACE_CONTRACT_VERSION,
  ENGINE_INTERFACE_SCHEMA_VERSION,
} from './artemisCognitiveEngineInterfaceContract.js';
import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';

export const MODEL_ASSISTED_ADAPTER_STAGE = '7.2.b.3.a';
export const MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION = '1.0.0';
export const MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION = 'artemis-model-assisted-adapter-1.0.0';
export const MODEL_ASSISTED_ADAPTER_VERSION = 'stage7-2b3a-adapter-contract-1.0.0';
export const MODEL_ASSISTED_ADAPTER_POLICY_VERSION = 'stage7-2b3a-adapter-contract-1.0.0';
export const MODEL_ASSISTED_ADAPTER_WRITER = 'artemisModelAssistedAdapterContract';

export const REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION = DECISION_CONTEXT_CONTRACT_VERSION;
export const REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION = ENGINE_INTERFACE_CONTRACT_VERSION;
export const REQUIRED_ENGINE_INTERFACE_SCHEMA_VERSION = ENGINE_INTERFACE_SCHEMA_VERSION;

export const MAX_LIMITATIONS = 64;
export const MAX_METADATA_KEYS = 16;
export const MAX_STRING_CHARS = 512;
export const MAX_ADAPTER_UTF8_BYTES = 32 * 1024;
export const MAX_SUMMARY_CHARS = 2048;

/**
 * Model-assisted uncertainty kinds (advisory only; do not replace
 * deterministic Engine Interface uncertaintyState).
 */
export const MODEL_ASSISTED_UNCERTAINTY_KIND = Object.freeze({
  NOT_EVALUATED: 'not_evaluated',
  CONTRACT_ONLY: 'contract_only',
  MODEL_EPISTEMIC: 'model_epistemic',
  SCHEMA_INVALID: 'schema_invalid',
  REFUSED: 'refused',
  TIMEOUT: 'timeout',
  RATE_LIMITED: 'rate_limited',
  INSUFFICIENT_CONTEXT: 'insufficient_context',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  UNAVAILABLE: 'unavailable',
});

export const MODEL_ASSISTED_ADAPTER_LIMITATIONS = Object.freeze([
  'stage7_2b3a_model_assisted_adapter_contract_only',
  'no_llm_provider_calls',
  'no_model_prompts',
  'no_prompt_execution',
  'no_network_invocation',
  'no_provider_sdk',
  'model_output_untrusted_advisory_non_authoritative',
  'cannot_override_deterministic_analysis',
  'cannot_modify_lineage',
  'cannot_approve_execution',
  'cannot_veto_risk',
  'cannot_change_controls',
  'no_majority_voting',
  'no_weighted_voting',
  'no_execution_authorization',
  'no_order_intent',
  'cognitive_engine_product_not_started',
  'live_trading_not_authorized',
]);

export const ZERO_MODEL_ASSISTED_ADAPTER_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  agentExecutionCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  llmCallCount: 0,
});

/** Keys forbidden on adapter request / contribution (except hard-false flags). */
export const FORBIDDEN_ADAPTER_KEYS = Object.freeze([
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
  'signedQuery',
  'signed_query',
  'prompt',
  'promptText',
  'prompt_text',
  'modelResponse',
  'model_response',
  'providerPayload',
  'provider_payload',
  'raw',
  'payload',
  'rawAgentOutput',
  'raw_agent_output',
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
  'adapterContractVersion',
  'decisionContextId',
  'decisionContextContractVersion',
  'sourceAnalysisReference',
  'boundedMetadata',
  'lineage',
  'provenance',
  'limitations',
  'sideEffects',
]);

const ALLOWED_CONTRIBUTION_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'adapterContractVersion',
  'adapterVersion',
  'contributionId',
  'decisionContextId',
  'sourceAnalysisReference',
  'provenance',
  'uncertainty',
  'limitations',
  'advisoryOnly',
  'authoritative',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'cognitiveEngineStarted',
  'advisorySummary',
  'sideEffects',
  'policyVersion',
  'implementationVersion',
  'generatedAt',
]);

const ALLOWED_SOURCE_ANALYSIS_REF = Object.freeze([
  'decisionContextId',
  'engineInterfaceContractVersion',
  'engineInterfaceSchemaVersion',
  'analysisGeneratedAt',
  'analysisContentHash',
  'uncertaintyState',
  'abstentionState',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'decisionContextId',
  'decisionContextContractVersion',
  'engineInterfaceContractVersion',
  'adapterContractVersion',
  'policyVersion',
  'stage',
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
  'promptPolicyVersion',
  'fallbackUsed',
  'fallbackReason',
]);

const ALLOWED_UNCERTAINTY = Object.freeze([
  'kind',
  'confidence',
  'confidenceMethod',
  'confidenceProvenance',
  'note',
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function inEnum(value, enumObject) {
  return Object.values(enumObject).includes(value);
}

function assertForbiddenKeys(obj, forbiddenList, errors) {
  for (const key of Object.keys(obj)) {
    if (forbiddenList.includes(key)) {
      errors.push({ field: key, code: 'forbidden_execution_or_provider_field' });
    }
  }
}

function assertAllowlist(obj, allowed, fieldPrefix, errors) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push({ field: `${fieldPrefix}.${key}`, code: 'unknown_field' });
    }
  }
}

function assertStringMax(field, value, errors, { required = false, max = MAX_STRING_CHARS } = {}) {
  if (value == null || value === '') {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (typeof value !== 'string') {
    errors.push({ field, code: 'must_be_string' });
    return;
  }
  if (value.length > max) {
    errors.push({ field, code: 'string_too_long', max });
  }
}

function resolveContractVersion(obj) {
  if (obj?.contractVersion != null) return obj.contractVersion;
  if (obj?.adapterContractVersion != null) return obj.adapterContractVersion;
  return undefined;
}

function rejectExecutionAuthorityStrings(obj, errors, path = '') {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => rejectExecutionAuthorityStrings(item, errors, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    const next = path ? `${path}.${key}` : key;
    if (typeof value === 'string' && FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
      errors.push({ field: next, code: 'forbidden_execution_authority_value', value });
    } else if (value && typeof value === 'object') {
      rejectExecutionAuthorityStrings(value, errors, next);
    }
  }
}

function validateSourceAnalysisReference(ref, expectedDecisionContextId, errors) {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    errors.push({ field: 'sourceAnalysisReference', code: 'required_object' });
    return;
  }
  assertAllowlist(ref, ALLOWED_SOURCE_ANALYSIS_REF, 'sourceAnalysisReference', errors);

  if (!isCanonicalUuid(ref.decisionContextId)) {
    errors.push({ field: 'sourceAnalysisReference.decisionContextId', code: 'invalid_uuid' });
  } else if (
    expectedDecisionContextId
    && String(ref.decisionContextId).trim().toLowerCase()
      !== String(expectedDecisionContextId).trim().toLowerCase()
  ) {
    errors.push({
      field: 'sourceAnalysisReference.decisionContextId',
      code: 'must_match_decision_context_id',
    });
  }

  if (ref.engineInterfaceContractVersion !== REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION) {
    errors.push({
      field: 'sourceAnalysisReference.engineInterfaceContractVersion',
      code: 'incompatible_engine_interface_contract',
      expected: REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION,
    });
  }
  if (
    ref.engineInterfaceSchemaVersion != null
    && ref.engineInterfaceSchemaVersion !== REQUIRED_ENGINE_INTERFACE_SCHEMA_VERSION
  ) {
    errors.push({
      field: 'sourceAnalysisReference.engineInterfaceSchemaVersion',
      code: 'incompatible_engine_interface_schema',
      expected: REQUIRED_ENGINE_INTERFACE_SCHEMA_VERSION,
    });
  }
  if (ref.analysisGeneratedAt != null && !isIsoTimestamp(ref.analysisGeneratedAt)) {
    errors.push({ field: 'sourceAnalysisReference.analysisGeneratedAt', code: 'invalid_iso_timestamp' });
  }
  assertStringMax(
    'sourceAnalysisReference.analysisContentHash',
    ref.analysisContentHash,
    errors,
    { required: false, max: 128 },
  );
  assertStringMax('sourceAnalysisReference.uncertaintyState', ref.uncertaintyState, errors, {
    required: false,
  });
  assertStringMax('sourceAnalysisReference.abstentionState', ref.abstentionState, errors, {
    required: false,
  });
}

function validateLineage(lineage, decisionContextId, errors) {
  if (!lineage || typeof lineage !== 'object' || Array.isArray(lineage)) {
    errors.push({ field: 'lineage', code: 'required_object' });
    return;
  }
  assertAllowlist(lineage, ALLOWED_LINEAGE, 'lineage', errors);

  if (!isCanonicalUuid(lineage.decisionContextId)) {
    errors.push({ field: 'lineage.decisionContextId', code: 'invalid_uuid' });
  } else if (
    decisionContextId
    && String(lineage.decisionContextId).trim().toLowerCase()
      !== String(decisionContextId).trim().toLowerCase()
  ) {
    errors.push({ field: 'lineage.decisionContextId', code: 'must_match_decision_context_id' });
  }

  if (lineage.decisionContextContractVersion !== REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.decisionContextContractVersion',
      code: 'incompatible_decision_context_contract',
      expected: REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION,
    });
  }
  if (lineage.engineInterfaceContractVersion !== REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.engineInterfaceContractVersion',
      code: 'incompatible_engine_interface_contract',
      expected: REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION,
    });
  }
  if (lineage.adapterContractVersion !== MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.adapterContractVersion',
      code: 'incompatible_adapter_contract',
      expected: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
    });
  }
  assertStringMax('lineage.policyVersion', lineage.policyVersion, errors, { required: true });
  if (lineage.stage !== MODEL_ASSISTED_ADAPTER_STAGE) {
    errors.push({
      field: 'lineage.stage',
      code: 'bad_stage',
      expected: MODEL_ASSISTED_ADAPTER_STAGE,
    });
  }
}

function validateProvenance(provenance, errors, { requireRecordedAt = true } = {}) {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    errors.push({ field: 'provenance', code: 'required_object' });
    return;
  }
  assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors);
  assertStringMax('provenance.writer', provenance.writer, errors, { required: true });
  assertStringMax('provenance.methodKey', provenance.methodKey, errors, { required: true });
  if (provenance.stage !== MODEL_ASSISTED_ADAPTER_STAGE) {
    errors.push({
      field: 'provenance.stage',
      code: 'bad_stage',
      expected: MODEL_ASSISTED_ADAPTER_STAGE,
    });
  }
  assertStringMax('provenance.note', provenance.note, errors, { required: false, max: 1024 });
  if (requireRecordedAt) {
    if (!isIsoTimestamp(provenance.recordedAt)) {
      errors.push({ field: 'provenance.recordedAt', code: 'invalid_iso_timestamp' });
    }
  } else if (provenance.recordedAt != null && !isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_iso_timestamp' });
  }

  // Contract-only stage forbids live provider/model invocation identifiers.
  for (const field of ['providerId', 'modelId', 'modelVersion', 'promptPolicyVersion']) {
    if (provenance[field] != null) {
      errors.push({
        field: `provenance.${field}`,
        code: 'forbidden_in_stage_7_2b3a_contract_only',
      });
    }
  }
  if (provenance.fallbackUsed === true) {
    errors.push({
      field: 'provenance.fallbackUsed',
      code: 'forbidden_in_stage_7_2b3a_contract_only',
    });
  }
}

function validateUncertainty(uncertainty, errors) {
  if (!uncertainty || typeof uncertainty !== 'object' || Array.isArray(uncertainty)) {
    errors.push({ field: 'uncertainty', code: 'required_object' });
    return;
  }
  assertAllowlist(uncertainty, ALLOWED_UNCERTAINTY, 'uncertainty', errors);
  if (!inEnum(uncertainty.kind, MODEL_ASSISTED_UNCERTAINTY_KIND)) {
    errors.push({ field: 'uncertainty.kind', code: 'invalid_uncertainty_kind' });
  }
  if (uncertainty.confidence != null) {
    if (typeof uncertainty.confidence !== 'number' || Number.isNaN(uncertainty.confidence)) {
      errors.push({ field: 'uncertainty.confidence', code: 'must_be_number' });
    } else if (uncertainty.confidence < 0 || uncertainty.confidence > 1) {
      errors.push({ field: 'uncertainty.confidence', code: 'out_of_range' });
    }
    assertStringMax('uncertainty.confidenceMethod', uncertainty.confidenceMethod, errors, {
      required: true,
    });
    assertStringMax('uncertainty.confidenceProvenance', uncertainty.confidenceProvenance, errors, {
      required: true,
    });
  }
  assertStringMax('uncertainty.note', uncertainty.note, errors, { required: false, max: 1024 });
}

function validateLimitations(limitations, errors) {
  if (!Array.isArray(limitations)) {
    errors.push({ field: 'limitations', code: 'must_be_array' });
    return;
  }
  if (limitations.length < 1) {
    errors.push({ field: 'limitations', code: 'required_non_empty' });
  }
  if (limitations.length > MAX_LIMITATIONS) {
    errors.push({ field: 'limitations', code: 'too_many', max: MAX_LIMITATIONS });
  }
  limitations.forEach((item, index) => {
    assertStringMax(`limitations[${index}]`, item, errors, { required: true, max: 128 });
  });
}

function validateSideEffects(sideEffects, errors) {
  if (!sideEffects || typeof sideEffects !== 'object' || Array.isArray(sideEffects)) {
    errors.push({ field: 'sideEffects', code: 'required_object' });
    return;
  }
  for (const [key, expected] of Object.entries(ZERO_MODEL_ASSISTED_ADAPTER_SIDE_EFFECTS)) {
    if (sideEffects[key] !== expected) {
      errors.push({
        field: `sideEffects.${key}`,
        code: 'must_be_zero',
        expected,
        actual: sideEffects[key],
      });
    }
  }
  for (const key of Object.keys(sideEffects)) {
    if (!(key in ZERO_MODEL_ASSISTED_ADAPTER_SIDE_EFFECTS)) {
      errors.push({ field: `sideEffects.${key}`, code: 'unknown_field' });
    }
  }
}

function validateBoundedMetadata(metadata, errors) {
  if (metadata == null) return;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    errors.push({ field: 'boundedMetadata', code: 'must_be_object' });
    return;
  }
  const keys = Object.keys(metadata);
  if (keys.length > MAX_METADATA_KEYS) {
    errors.push({ field: 'boundedMetadata', code: 'too_many_keys', max: MAX_METADATA_KEYS });
  }
  for (const key of keys) {
    if (FORBIDDEN_ADAPTER_KEYS.includes(key)) {
      errors.push({ field: `boundedMetadata.${key}`, code: 'forbidden_execution_or_provider_field' });
    }
    const value = metadata[key];
    if (value != null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      errors.push({ field: `boundedMetadata.${key}`, code: 'must_be_scalar' });
    }
    if (typeof value === 'string' && value.length > MAX_STRING_CHARS) {
      errors.push({ field: `boundedMetadata.${key}`, code: 'string_too_long', max: MAX_STRING_CHARS });
    }
  }
}

/**
 * Validate Stage 7.2.b.3.a adapter request (contract input only).
 * Accepts Decision Context reference + Cognitive Analysis Result reference +
 * bounded metadata. Rejects secrets, providers, prompts, execution fields.
 *
 * @param {unknown} request
 */
export function validateModelAssistedAdapterRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return fail('invalid_request', 'Model-assisted adapter request must be a plain object');
  }

  const errors = [];
  assertForbiddenKeys(request, FORBIDDEN_ADAPTER_KEYS, errors);
  assertAllowlist(request, ALLOWED_REQUEST_TOP, 'request', errors);

  if (request.schemaVersion !== MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION) {
    errors.push({
      field: 'schemaVersion',
      code: 'bad_schema_version',
      expected: MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION,
    });
  }

  const contractVersion = resolveContractVersion(request);
  if (contractVersion !== MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION) {
    errors.push({
      field: 'contractVersion',
      code: 'bad_adapter_contract_version',
      expected: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
    });
  }
  if (request.contractVersion == null) {
    errors.push({ field: 'contractVersion', code: 'required' });
  }
  if (
    request.adapterContractVersion != null
    && request.adapterContractVersion !== MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION
  ) {
    errors.push({
      field: 'adapterContractVersion',
      code: 'bad_adapter_contract_version',
      expected: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
    });
  }

  if (!isCanonicalUuid(request.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (request.decisionContextContractVersion !== REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'decisionContextContractVersion',
      code: 'incompatible_decision_context_contract',
      expected: REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION,
    });
  }

  validateSourceAnalysisReference(
    request.sourceAnalysisReference,
    request.decisionContextId,
    errors,
  );
  validateBoundedMetadata(request.boundedMetadata, errors);
  validateLineage(request.lineage, request.decisionContextId, errors);
  validateProvenance(request.provenance, errors);
  validateLimitations(request.limitations, errors);
  validateSideEffects(request.sideEffects, errors);
  rejectExecutionAuthorityStrings(request, errors);

  const secretKeys = collectForbiddenSecretKeys(request);
  if (secretKeys.length) {
    errors.push({ field: 'request', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  const bytes = utf8ByteLength(request);
  if (bytes > MAX_ADAPTER_UTF8_BYTES) {
    errors.push({ field: 'request', code: 'too_large', bytes, limit: MAX_ADAPTER_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Model-assisted adapter request failed strict validation', {
      errors,
      bytes,
    });
  }
  return { ok: true, bytes };
}

/**
 * Validate ModelAssistedContribution artifact.
 * Hard-enforces advisory/non-authoritative/non-executing flags.
 *
 * @param {unknown} contribution
 */
export function validateModelAssistedContribution(contribution) {
  if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
    return fail('invalid_contribution', 'ModelAssistedContribution must be a plain object');
  }

  const errors = [];
  assertForbiddenKeys(contribution, FORBIDDEN_ADAPTER_KEYS, errors);
  assertAllowlist(contribution, ALLOWED_CONTRIBUTION_TOP, 'contribution', errors);

  if (contribution.schemaVersion !== MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION) {
    errors.push({
      field: 'schemaVersion',
      code: 'bad_schema_version',
      expected: MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION,
    });
  }

  const contractVersion = resolveContractVersion(contribution);
  if (contractVersion !== MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION) {
    errors.push({
      field: 'contractVersion',
      code: 'bad_adapter_contract_version',
      expected: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
    });
  }
  if (contribution.contractVersion == null) {
    errors.push({ field: 'contractVersion', code: 'required' });
  }
  if (
    contribution.adapterContractVersion != null
    && contribution.adapterContractVersion !== MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION
  ) {
    errors.push({
      field: 'adapterContractVersion',
      code: 'bad_adapter_contract_version',
      expected: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
    });
  }

  if (contribution.adapterVersion !== MODEL_ASSISTED_ADAPTER_VERSION) {
    errors.push({
      field: 'adapterVersion',
      code: 'bad_adapter_version',
      expected: MODEL_ASSISTED_ADAPTER_VERSION,
    });
  }
  if (!isCanonicalUuid(contribution.contributionId)) {
    errors.push({ field: 'contributionId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(contribution.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }

  validateSourceAnalysisReference(
    contribution.sourceAnalysisReference,
    contribution.decisionContextId,
    errors,
  );
  validateProvenance(contribution.provenance, errors);
  validateUncertainty(contribution.uncertainty, errors);
  validateLimitations(contribution.limitations, errors);
  validateSideEffects(contribution.sideEffects, errors);

  if (contribution.advisoryOnly !== true) {
    errors.push({ field: 'advisoryOnly', code: 'must_be_true' });
  }
  if (contribution.authoritative !== false) {
    errors.push({ field: 'authoritative', code: 'must_be_false' });
  }
  if (contribution.decisionEligible !== false) {
    errors.push({ field: 'decisionEligible', code: 'must_be_false' });
  }
  if (contribution.executionEligible !== false) {
    errors.push({ field: 'executionEligible', code: 'must_be_false' });
  }
  if (contribution.approvedForExecution !== false) {
    errors.push({ field: 'approvedForExecution', code: 'must_be_false' });
  }
  if (contribution.cognitiveEngineStarted !== false) {
    errors.push({ field: 'cognitiveEngineStarted', code: 'must_be_false' });
  }

  if (contribution.advisorySummary != null) {
    assertStringMax('advisorySummary', contribution.advisorySummary, errors, {
      max: MAX_SUMMARY_CHARS,
    });
  }

  assertStringMax('policyVersion', contribution.policyVersion, errors, { required: false });
  assertStringMax('implementationVersion', contribution.implementationVersion, errors, {
    required: false,
  });
  if (contribution.generatedAt != null && !isIsoTimestamp(contribution.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  rejectExecutionAuthorityStrings(contribution, errors);

  const secretKeys = collectForbiddenSecretKeys(contribution);
  if (secretKeys.length) {
    errors.push({
      field: 'contribution',
      code: 'forbidden_secret_keys',
      keys: [...new Set(secretKeys)],
    });
  }

  const bytes = utf8ByteLength(contribution);
  if (bytes > MAX_ADAPTER_UTF8_BYTES) {
    errors.push({ field: 'contribution', code: 'too_large', bytes, limit: MAX_ADAPTER_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'ModelAssistedContribution failed strict validation', {
      errors,
      bytes,
    });
  }
  return { ok: true, bytes };
}

/**
 * Build a Stage 7.2.b.3.a contract-only ModelAssistedContribution skeleton.
 * Always advisory / non-authoritative / non-executing. No model call.
 */
export function buildContractOnlyModelAssistedContribution(partial = {}) {
  const decisionContextId = partial.decisionContextId;
  const contributionId = partial.contributionId;
  const recordedAt = partial.provenance?.recordedAt
    ?? partial.generatedAt
    ?? null;

  const sourceAnalysisReference = partial.sourceAnalysisReference
    ? {
      decisionContextId: partial.sourceAnalysisReference.decisionContextId ?? decisionContextId,
      engineInterfaceContractVersion:
          partial.sourceAnalysisReference.engineInterfaceContractVersion
          ?? REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION,
      engineInterfaceSchemaVersion:
          partial.sourceAnalysisReference.engineInterfaceSchemaVersion
          ?? REQUIRED_ENGINE_INTERFACE_SCHEMA_VERSION,
      analysisGeneratedAt: partial.sourceAnalysisReference.analysisGeneratedAt ?? null,
      analysisContentHash: partial.sourceAnalysisReference.analysisContentHash,
      uncertaintyState: partial.sourceAnalysisReference.uncertaintyState,
      abstentionState: partial.sourceAnalysisReference.abstentionState,
    }
    : {
      decisionContextId,
      engineInterfaceContractVersion: REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION,
      engineInterfaceSchemaVersion: REQUIRED_ENGINE_INTERFACE_SCHEMA_VERSION,
      analysisGeneratedAt: null,
    };

  return {
    schemaVersion: MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION,
    contractVersion: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
    adapterContractVersion: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
    adapterVersion: MODEL_ASSISTED_ADAPTER_VERSION,
    contributionId,
    decisionContextId,
    sourceAnalysisReference,
    provenance: {
      writer: MODEL_ASSISTED_ADAPTER_WRITER,
      methodKey: partial.provenance?.methodKey ?? 'contract_only_skeleton',
      stage: MODEL_ASSISTED_ADAPTER_STAGE,
      note: partial.provenance?.note ?? 'stage_7_2b3a_adapter_contract_no_model_call',
      recordedAt,
    },
    uncertainty: {
      kind: partial.uncertainty?.kind ?? MODEL_ASSISTED_UNCERTAINTY_KIND.CONTRACT_ONLY,
      confidence: partial.uncertainty?.confidence ?? null,
      confidenceMethod: partial.uncertainty?.confidenceMethod,
      confidenceProvenance: partial.uncertainty?.confidenceProvenance,
      note: partial.uncertainty?.note ?? 'no_model_invocation_in_stage_7_2b3a',
    },
    limitations: Array.isArray(partial.limitations) && partial.limitations.length
      ? [...partial.limitations]
      : [...MODEL_ASSISTED_ADAPTER_LIMITATIONS],
    advisoryOnly: true,
    authoritative: false,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveEngineStarted: false,
    advisorySummary: partial.advisorySummary ?? null,
    sideEffects: { ...ZERO_MODEL_ASSISTED_ADAPTER_SIDE_EFFECTS },
    policyVersion: partial.policyVersion ?? MODEL_ASSISTED_ADAPTER_POLICY_VERSION,
    implementationVersion: partial.implementationVersion ?? MODEL_ASSISTED_ADAPTER_POLICY_VERSION,
    generatedAt: partial.generatedAt ?? recordedAt,
  };
}

export default {
  MODEL_ASSISTED_ADAPTER_STAGE,
  MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION,
  MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
  MODEL_ASSISTED_ADAPTER_VERSION,
  MODEL_ASSISTED_ADAPTER_POLICY_VERSION,
  MODEL_ASSISTED_ADAPTER_WRITER,
  REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION,
  REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION,
  REQUIRED_ENGINE_INTERFACE_SCHEMA_VERSION,
  MODEL_ASSISTED_UNCERTAINTY_KIND,
  MODEL_ASSISTED_ADAPTER_LIMITATIONS,
  ZERO_MODEL_ASSISTED_ADAPTER_SIDE_EFFECTS,
  FORBIDDEN_ADAPTER_KEYS,
  validateModelAssistedAdapterRequest,
  validateModelAssistedContribution,
  buildContractOnlyModelAssistedContribution,
};
