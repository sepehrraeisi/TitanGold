/**
 * Artemis Core Stage 7.2.b.1 — Cognitive Engine Interface foundation.
 *
 * Bounded interface between Stage 7.2.a Cognitive Kernel Contract and a future
 * Cognitive Engine implementation. Validation-only: no reasoning logic, no
 * model/LLM calls, no synthesis execution, no Artemis Decision runtime, no
 * routes, no execution authorization.
 *
 * Flow:
 *   EvidenceOrchestrationSet (Stage 6)
 *     → Decision Context (Stage 7.1)
 *       → Cognitive Kernel Contract (Stage 7.2.a)
 *         → Cognitive Engine Interface (this stage)
 *           → future Cognitive Engine / Analysis Result runtime (NOT here)
 *
 * UNAVAILABLE / BLOCKED / MISSING remain non-neutral.
 */

import { DECISION_CONTEXT_CONTRACT_VERSION } from './artemisDecisionContextContract.js';
import {
  KERNEL_ABSTENTION_STATE,
  KERNEL_CONTRACT_VERSION,
  KERNEL_UNCERTAINTY_STATE,
} from './artemisCognitiveKernelContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from './artemisEvidenceOrchestrationContract.js';
import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';

export const ENGINE_INTERFACE_STAGE = '7.2.b.1';
export const ENGINE_INTERFACE_SCHEMA_VERSION = '1.0.0';
export const ENGINE_INTERFACE_CONTRACT_VERSION = 'artemis-cognitive-engine-interface-1.0.0';
export const ENGINE_INTERFACE_POLICY_VERSION = 'stage7-2b1-engine-interface-1.0.0';
export const ENGINE_INTERFACE_WRITER = 'artemisCognitiveEngineInterfaceContract';

export const REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION = DECISION_CONTEXT_CONTRACT_VERSION;
export const REQUIRED_KERNEL_CONTRACT_VERSION = KERNEL_CONTRACT_VERSION;
export const REQUIRED_ORCHESTRATION_CONTRACT_VERSION = ORCHESTRATION_CONTRACT_VERSION;

/** Re-export Kernel uncertainty/abstention enums for Engine Interface consumers. */
export { KERNEL_UNCERTAINTY_STATE as ENGINE_UNCERTAINTY_STATE };
export { KERNEL_ABSTENTION_STATE as ENGINE_ABSTENTION_STATE };

export const MAX_ORCHESTRATION_SET_REFS = 8;
export const MAX_LIMITATIONS = 64;
export const MAX_ENGINE_INTERFACE_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 512;

export const ENGINE_INTERFACE_LIMITATIONS = Object.freeze([
  'stage7_2b1_cognitive_engine_interface_only',
  'no_cognitive_reasoning_logic',
  'no_llm_provider_calls',
  'no_model_prompts',
  'no_synthesis_execution',
  'no_artemis_decision_runtime',
  'no_majority_voting',
  'no_weighted_voting',
  'no_execution_authorization',
  'no_order_intent',
  'unavailable_blocked_not_neutral',
  'missing_evidence_not_negative',
  'live_trading_not_authorized',
]);

export const ZERO_ENGINE_INTERFACE_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  agentExecutionCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  llmCallCount: 0,
});

/** Keys forbidden on Engine Interface request (must not appear). */
export const FORBIDDEN_ENGINE_REQUEST_KEYS = Object.freeze([
  'orderId',
  'order_id',
  'executionCommand',
  'execution_command',
  'executionIntent',
  'execution_intent',
  'walletAction',
  'wallet_action',
  'tradeInstruction',
  'trade_instruction',
  'approved',
  'approvedForExecution',
  'executionEligible',
  'decisionEligible',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'credentials',
  'signedQuery',
  'signed_query',
  'prompt',
  'modelResponse',
  'providerPayload',
  'raw',
  'payload',
]);

/**
 * Keys forbidden on Cognitive Analysis Result except required hard-false
 * authorization flags in ALLOWED_RESULT_TOP.
 */
export const FORBIDDEN_ENGINE_RESULT_KEYS = Object.freeze([
  'orderId',
  'order_id',
  'executionCommand',
  'execution_command',
  'executionIntent',
  'execution_intent',
  'walletAction',
  'wallet_action',
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
  'modelResponse',
  'providerPayload',
  'raw',
  'payload',
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
  'engineInterfaceContractVersion',
  'decisionContextId',
  'decisionContextContractVersion',
  'kernelContractVersion',
  'orchestrationSetReferences',
  'lineage',
  'provenance',
  'limitations',
  'sideEffects',
]);

const ALLOWED_RESULT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'engineInterfaceContractVersion',
  'decisionContextId',
  'orchestrationSetReferences',
  'lineage',
  'provenance',
  'uncertaintyState',
  'abstentionState',
  'limitations',
  'reasoningSummary',
  'analyticalConclusion',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'cognitiveEngineStarted',
  'sideEffects',
  'policyVersion',
  'implementationVersion',
  'generatedAt',
]);

const ALLOWED_ORCH_REF = Object.freeze([
  'orchestrationSetId',
  'orchestrationContractVersion',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'decisionContextId',
  'decisionContextContractVersion',
  'orchestrationSetIds',
  'orchestrationContractVersion',
  'kernelContractVersion',
  'engineInterfaceContractVersion',
  'policyVersion',
  'stage',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'note',
  'recordedAt',
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
  if (obj?.engineInterfaceContractVersion != null) return obj.engineInterfaceContractVersion;
  return undefined;
}

function validateOrchestrationSetReferences(refs, errors) {
  if (!Array.isArray(refs) || refs.length < 1) {
    errors.push({ field: 'orchestrationSetReferences', code: 'required_non_empty' });
    return;
  }
  if (refs.length > MAX_ORCHESTRATION_SET_REFS) {
    errors.push({
      field: 'orchestrationSetReferences',
      code: 'too_many',
      max: MAX_ORCHESTRATION_SET_REFS,
    });
  }
  const seen = new Set();
  refs.forEach((ref, index) => {
    const prefix = `orchestrationSetReferences[${index}]`;
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
      errors.push({ field: prefix, code: 'must_be_object' });
      return;
    }
    assertAllowlist(ref, ALLOWED_ORCH_REF, prefix, errors);
    if (!isCanonicalUuid(ref.orchestrationSetId)) {
      errors.push({ field: `${prefix}.orchestrationSetId`, code: 'invalid_uuid' });
    } else {
      const id = String(ref.orchestrationSetId).trim().toLowerCase();
      if (seen.has(id)) {
        errors.push({ field: `${prefix}.orchestrationSetId`, code: 'duplicate_orchestration_set_id' });
      }
      seen.add(id);
    }
    if (ref.orchestrationContractVersion !== REQUIRED_ORCHESTRATION_CONTRACT_VERSION) {
      errors.push({
        field: `${prefix}.orchestrationContractVersion`,
        code: 'incompatible_orchestration_contract',
        expected: REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
      });
    }
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
    isCanonicalUuid(decisionContextId)
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
  if (lineage.orchestrationContractVersion !== REQUIRED_ORCHESTRATION_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.orchestrationContractVersion',
      code: 'incompatible_orchestration_contract',
      expected: REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
    });
  }
  if (lineage.kernelContractVersion !== REQUIRED_KERNEL_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.kernelContractVersion',
      code: 'incompatible_kernel_contract',
      expected: REQUIRED_KERNEL_CONTRACT_VERSION,
    });
  }
  if (lineage.engineInterfaceContractVersion !== ENGINE_INTERFACE_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.engineInterfaceContractVersion',
      code: 'bad_engine_interface_contract_version',
      expected: ENGINE_INTERFACE_CONTRACT_VERSION,
    });
  }
  if (!Array.isArray(lineage.orchestrationSetIds) || lineage.orchestrationSetIds.length < 1) {
    errors.push({ field: 'lineage.orchestrationSetIds', code: 'required_non_empty' });
  } else {
    lineage.orchestrationSetIds.forEach((id, index) => {
      if (!isCanonicalUuid(id)) {
        errors.push({ field: `lineage.orchestrationSetIds[${index}]`, code: 'invalid_uuid' });
      }
    });
  }
  assertStringMax('lineage.policyVersion', lineage.policyVersion, errors, { required: false });
  assertStringMax('lineage.stage', lineage.stage, errors, { required: false });
}

function validateProvenance(provenance, errors) {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    errors.push({ field: 'provenance', code: 'required_object' });
    return;
  }
  assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors);
  assertStringMax('provenance.writer', provenance.writer, errors, { required: true });
  assertStringMax('provenance.methodKey', provenance.methodKey, errors, { required: true });
  assertStringMax('provenance.stage', provenance.stage, errors, { required: false });
  assertStringMax('provenance.note', provenance.note, errors, { required: true, max: 1024 });
  if (provenance.recordedAt != null && !isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_iso_timestamp' });
  }
}

function validateLimitations(limitations, errors) {
  if (!Array.isArray(limitations) || limitations.length < 1) {
    errors.push({ field: 'limitations', code: 'required_non_empty' });
    return;
  }
  if (limitations.length > MAX_LIMITATIONS) {
    errors.push({ field: 'limitations', code: 'too_many', max: MAX_LIMITATIONS });
  }
  if (limitations.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push({ field: 'limitations', code: 'must_be_non_empty_strings' });
  }
}

function validateSideEffects(sideEffects, errors) {
  if (sideEffects == null) return;
  if (typeof sideEffects !== 'object' || Array.isArray(sideEffects)) {
    errors.push({ field: 'sideEffects', code: 'must_be_object' });
    return;
  }
  for (const [key, expected] of Object.entries(ZERO_ENGINE_INTERFACE_SIDE_EFFECTS)) {
    if (sideEffects[key] !== expected) {
      errors.push({ field: `sideEffects.${key}`, code: 'must_be_zero', expected });
    }
  }
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

function assertOrchRefsMatchLineage(refs, lineage, errors) {
  if (!Array.isArray(refs) || !Array.isArray(lineage?.orchestrationSetIds)) return;
  const refIds = refs
    .filter((r) => isCanonicalUuid(r?.orchestrationSetId))
    .map((r) => String(r.orchestrationSetId).trim().toLowerCase())
    .sort();
  const lineageIds = lineage.orchestrationSetIds
    .filter((id) => isCanonicalUuid(id))
    .map((id) => String(id).trim().toLowerCase())
    .sort();
  if (refIds.join(',') !== lineageIds.join(',')) {
    errors.push({
      field: 'lineage.orchestrationSetIds',
      code: 'must_match_orchestration_set_references',
    });
  }
}

/**
 * Validate Cognitive Engine Interface *request* (Stage 7.2.b.1).
 * Does not run the Cognitive Engine; only schema / lineage / provenance gates.
 *
 * @param {unknown} request
 */
export function validateCognitiveEngineInterfaceRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return fail('invalid_request', 'Cognitive Engine Interface request must be a plain object');
  }

  const errors = [];
  assertForbiddenKeys(request, FORBIDDEN_ENGINE_REQUEST_KEYS, errors);
  assertAllowlist(request, ALLOWED_REQUEST_TOP, 'request', errors);

  if (request.schemaVersion !== ENGINE_INTERFACE_SCHEMA_VERSION) {
    errors.push({
      field: 'schemaVersion',
      code: 'bad_schema_version',
      expected: ENGINE_INTERFACE_SCHEMA_VERSION,
    });
  }

  const contractVersion = resolveContractVersion(request);
  if (contractVersion !== ENGINE_INTERFACE_CONTRACT_VERSION) {
    errors.push({
      field: 'contractVersion',
      code: 'bad_engine_interface_contract_version',
      expected: ENGINE_INTERFACE_CONTRACT_VERSION,
    });
  }
  if (
    request.engineInterfaceContractVersion != null
    && request.engineInterfaceContractVersion !== ENGINE_INTERFACE_CONTRACT_VERSION
  ) {
    errors.push({
      field: 'engineInterfaceContractVersion',
      code: 'bad_engine_interface_contract_version',
      expected: ENGINE_INTERFACE_CONTRACT_VERSION,
    });
  }
  if (
    request.contractVersion != null
    && request.engineInterfaceContractVersion != null
    && request.contractVersion !== request.engineInterfaceContractVersion
  ) {
    errors.push({
      field: 'contractVersion',
      code: 'must_match_engine_interface_contract_version',
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
  if (request.kernelContractVersion !== REQUIRED_KERNEL_CONTRACT_VERSION) {
    errors.push({
      field: 'kernelContractVersion',
      code: 'incompatible_kernel_contract',
      expected: REQUIRED_KERNEL_CONTRACT_VERSION,
    });
  }

  validateOrchestrationSetReferences(request.orchestrationSetReferences, errors);
  validateLineage(request.lineage, request.decisionContextId, errors);
  validateProvenance(request.provenance, errors);
  validateLimitations(request.limitations, errors);
  validateSideEffects(request.sideEffects, errors);
  assertOrchRefsMatchLineage(request.orchestrationSetReferences, request.lineage, errors);
  rejectExecutionAuthorityStrings(request, errors);

  const secretKeys = collectForbiddenSecretKeys(request);
  if (secretKeys.length) {
    errors.push({ field: 'request', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  const bytes = utf8ByteLength(request);
  if (bytes > MAX_ENGINE_INTERFACE_UTF8_BYTES) {
    errors.push({ field: 'request', code: 'too_large', bytes, limit: MAX_ENGINE_INTERFACE_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Cognitive Engine Interface request failed strict validation', {
      errors,
      bytes,
    });
  }
  return { ok: true, bytes };
}

/**
 * Validate Cognitive Analysis Result envelope (Stage 7.2.b.1 interface only).
 * Requires executionEligible=false, approvedForExecution=false, decisionEligible=false.
 *
 * @param {unknown} result
 */
export function validateCognitiveAnalysisResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return fail('invalid_result', 'Cognitive Analysis Result must be a plain object');
  }

  const errors = [];
  assertForbiddenKeys(result, FORBIDDEN_ENGINE_RESULT_KEYS, errors);
  assertAllowlist(result, ALLOWED_RESULT_TOP, 'result', errors);

  if (result.schemaVersion !== ENGINE_INTERFACE_SCHEMA_VERSION) {
    errors.push({
      field: 'schemaVersion',
      code: 'bad_schema_version',
      expected: ENGINE_INTERFACE_SCHEMA_VERSION,
    });
  }

  const contractVersion = resolveContractVersion(result);
  if (contractVersion !== ENGINE_INTERFACE_CONTRACT_VERSION) {
    errors.push({
      field: 'contractVersion',
      code: 'bad_engine_interface_contract_version',
      expected: ENGINE_INTERFACE_CONTRACT_VERSION,
    });
  }
  if (result.contractVersion == null) {
    errors.push({ field: 'contractVersion', code: 'required' });
  }
  if (
    result.engineInterfaceContractVersion != null
    && result.engineInterfaceContractVersion !== ENGINE_INTERFACE_CONTRACT_VERSION
  ) {
    errors.push({
      field: 'engineInterfaceContractVersion',
      code: 'bad_engine_interface_contract_version',
      expected: ENGINE_INTERFACE_CONTRACT_VERSION,
    });
  }

  if (!isCanonicalUuid(result.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }

  validateOrchestrationSetReferences(result.orchestrationSetReferences, errors);
  validateLineage(result.lineage, result.decisionContextId, errors);
  validateProvenance(result.provenance, errors);
  validateLimitations(result.limitations, errors);
  validateSideEffects(result.sideEffects, errors);
  assertOrchRefsMatchLineage(result.orchestrationSetReferences, result.lineage, errors);

  if (!inEnum(result.uncertaintyState, KERNEL_UNCERTAINTY_STATE)) {
    errors.push({ field: 'uncertaintyState', code: 'invalid_uncertainty_state' });
  }
  if (!inEnum(result.abstentionState, KERNEL_ABSTENTION_STATE)) {
    errors.push({ field: 'abstentionState', code: 'invalid_abstention_state' });
  }

  if (result.reasoningSummary != null) {
    assertStringMax('reasoningSummary', result.reasoningSummary, errors, { max: 2048 });
  }
  if (result.analyticalConclusion != null) {
    errors.push({ field: 'analyticalConclusion', code: 'must_be_null_in_stage_7_2b1' });
  }
  if (result.decisionEligible !== false) {
    errors.push({ field: 'decisionEligible', code: 'must_be_false' });
  }
  if (result.executionEligible !== false) {
    errors.push({ field: 'executionEligible', code: 'must_be_false' });
  }
  if (result.approvedForExecution !== false) {
    errors.push({ field: 'approvedForExecution', code: 'must_be_false' });
  }
  if (result.cognitiveEngineStarted !== false) {
    errors.push({ field: 'cognitiveEngineStarted', code: 'must_be_false_in_stage_7_2b1' });
  }

  assertStringMax('policyVersion', result.policyVersion, errors, { required: false });
  assertStringMax('implementationVersion', result.implementationVersion, errors, {
    required: false,
  });
  if (result.generatedAt != null && !isIsoTimestamp(result.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  rejectExecutionAuthorityStrings(result, errors);

  const secretKeys = collectForbiddenSecretKeys(result);
  if (secretKeys.length) {
    errors.push({ field: 'result', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  const bytes = utf8ByteLength(result);
  if (bytes > MAX_ENGINE_INTERFACE_UTF8_BYTES) {
    errors.push({ field: 'result', code: 'too_large', bytes, limit: MAX_ENGINE_INTERFACE_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Cognitive Analysis Result failed strict validation', {
      errors,
      bytes,
    });
  }
  return { ok: true, bytes };
}

/**
 * Build a Stage 7.2.b.1 interface-only Cognitive Analysis Result skeleton.
 * Always non-executing / engine-not-started.
 */
export function buildInterfaceOnlyCognitiveAnalysisResult(partial = {}) {
  const decisionContextId = partial.decisionContextId;
  const orchestrationSetReferences = Array.isArray(partial.orchestrationSetReferences)
    ? partial.orchestrationSetReferences.map((ref) => ({
      orchestrationSetId: ref.orchestrationSetId,
      orchestrationContractVersion:
          ref.orchestrationContractVersion ?? REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
    }))
    : [];
  const orchestrationSetIds = orchestrationSetReferences
    .map((ref) => ref.orchestrationSetId)
    .filter(Boolean);

  const recordedAt = partial.provenance?.recordedAt
    ?? partial.generatedAt
    ?? null;

  return {
    schemaVersion: ENGINE_INTERFACE_SCHEMA_VERSION,
    contractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    decisionContextId,
    orchestrationSetReferences,
    lineage: {
      decisionContextId,
      decisionContextContractVersion: REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION,
      orchestrationSetIds,
      orchestrationContractVersion: REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
      kernelContractVersion: REQUIRED_KERNEL_CONTRACT_VERSION,
      engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
      policyVersion: ENGINE_INTERFACE_POLICY_VERSION,
      stage: ENGINE_INTERFACE_STAGE,
    },
    provenance: {
      writer: ENGINE_INTERFACE_WRITER,
      methodKey: partial.provenance?.methodKey ?? 'interface_only_skeleton',
      stage: ENGINE_INTERFACE_STAGE,
      note: partial.provenance?.note ?? 'stage_7_2b1_engine_interface_not_cognitive_engine',
      recordedAt,
    },
    uncertaintyState: partial.uncertaintyState ?? KERNEL_UNCERTAINTY_STATE.NOT_EVALUATED,
    abstentionState: partial.abstentionState ?? KERNEL_ABSTENTION_STATE.CONTRACT_ONLY,
    limitations: Array.isArray(partial.limitations) && partial.limitations.length
      ? [...partial.limitations]
      : [...ENGINE_INTERFACE_LIMITATIONS],
    reasoningSummary: null,
    analyticalConclusion: null,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveEngineStarted: false,
    sideEffects: { ...ZERO_ENGINE_INTERFACE_SIDE_EFFECTS },
    policyVersion: partial.policyVersion ?? ENGINE_INTERFACE_POLICY_VERSION,
    implementationVersion: partial.implementationVersion ?? ENGINE_INTERFACE_POLICY_VERSION,
    generatedAt: partial.generatedAt ?? recordedAt,
  };
}

export default {
  ENGINE_INTERFACE_STAGE,
  ENGINE_INTERFACE_SCHEMA_VERSION,
  ENGINE_INTERFACE_CONTRACT_VERSION,
  ENGINE_INTERFACE_POLICY_VERSION,
  ENGINE_INTERFACE_WRITER,
  REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION,
  REQUIRED_KERNEL_CONTRACT_VERSION,
  REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
  ENGINE_UNCERTAINTY_STATE: KERNEL_UNCERTAINTY_STATE,
  ENGINE_ABSTENTION_STATE: KERNEL_ABSTENTION_STATE,
  ENGINE_INTERFACE_LIMITATIONS,
  ZERO_ENGINE_INTERFACE_SIDE_EFFECTS,
  FORBIDDEN_ENGINE_REQUEST_KEYS,
  FORBIDDEN_ENGINE_RESULT_KEYS,
  validateCognitiveEngineInterfaceRequest,
  validateCognitiveAnalysisResult,
  buildInterfaceOnlyCognitiveAnalysisResult,
};
