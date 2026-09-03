/**
 * Artemis Core Stage 7.2.a — Cognitive Kernel contract foundation.
 *
 * Bounded contract between Stage 7.1 Decision Context and a future Cognitive
 * Kernel / Artemis Decision artifact. Validation-only: no reasoning engine,
 * no LLM/provider calls, no execution authorization, no routes.
 *
 * Flow:
 *   EvidenceOrchestrationSet (Stage 6)
 *     → Decision Context (Stage 7.1)
 *       → Cognitive Kernel contract (this stage)
 *         → future Kernel engine / Decision artifact (NOT implemented here)
 *
 * UNAVAILABLE / BLOCKED / MISSING remain non-neutral.
 */

import { DECISION_CONTEXT_CONTRACT_VERSION } from './artemisDecisionContextContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from './artemisEvidenceOrchestrationContract.js';
import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';

export const KERNEL_STAGE = '7.2.a';
export const KERNEL_SCHEMA_VERSION = '1.0.0';
export const KERNEL_CONTRACT_VERSION = 'artemis-cognitive-kernel-1.0.0';
export const KERNEL_POLICY_VERSION = 'stage7-2a-kernel-contract-1.0.0';
export const KERNEL_WRITER = 'artemisCognitiveKernelContract';
export const REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION = DECISION_CONTEXT_CONTRACT_VERSION;
export const REQUIRED_ORCHESTRATION_CONTRACT_VERSION = ORCHESTRATION_CONTRACT_VERSION;

export const MAX_ORCHESTRATION_SET_REFS = 8;
export const MAX_LIMITATIONS = 64;
export const MAX_KERNEL_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 512;

/** Uncertainty / evidence-adequacy states for Kernel I/O. */
export const KERNEL_UNCERTAINTY_STATE = Object.freeze({
  SUFFICIENT_EVIDENCE: 'sufficient_evidence',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  CONFLICTING_EVIDENCE: 'conflicting_evidence',
  INCOMPATIBLE_EVIDENCE: 'incompatible_evidence',
  STALE_CONTEXT: 'stale_context',
  BLOCKED: 'blocked',
  UNAVAILABLE: 'unavailable',
  NOT_EVALUATED: 'not_evaluated',
});

/** Abstention posture; never treat blocked/unavailable as neutral votes. */
export const KERNEL_ABSTENTION_STATE = Object.freeze({
  NOT_ABSTAINING: 'not_abstaining',
  ABSTAIN_INSUFFICIENT: 'abstain_insufficient',
  ABSTAIN_CONFLICT: 'abstain_conflict',
  ABSTAIN_INCOMPATIBLE: 'abstain_incompatible',
  ABSTAIN_STALE: 'abstain_stale',
  ABSTAIN_BLOCKED: 'abstain_blocked',
  ABSTAIN_UNAVAILABLE: 'abstain_unavailable',
  CONTRACT_ONLY: 'contract_only',
});

export const KERNEL_LIMITATIONS = Object.freeze([
  'stage7_2a_kernel_contract_only',
  'no_cognitive_reasoning_engine',
  'no_llm_provider_calls',
  'no_artemis_decision_runtime',
  'no_majority_voting',
  'no_weighted_voting',
  'no_execution_authorization',
  'no_order_intent',
  'unavailable_blocked_not_neutral',
  'missing_evidence_not_negative',
  'live_trading_not_authorized',
]);

export const ZERO_KERNEL_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  agentExecutionCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  llmCallCount: 0,
});

/** Keys forbidden on Kernel input (must not appear). */
export const FORBIDDEN_KERNEL_INPUT_KEYS = Object.freeze([
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
 * Keys forbidden on Kernel candidate output except the required hard-false
 * authorization flags listed in ALLOWED_OUTPUT_TOP.
 */
export const FORBIDDEN_KERNEL_OUTPUT_KEYS = Object.freeze([
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

const ALLOWED_INPUT_TOP = Object.freeze([
  'schemaVersion',
  'kernelContractVersion',
  'decisionContextId',
  'decisionContextContractVersion',
  'orchestrationSetReferences',
  'lineage',
  'provenance',
  'limitations',
  'sideEffects',
]);

const ALLOWED_OUTPUT_TOP = Object.freeze([
  'schemaVersion',
  'kernelContractVersion',
  'decisionContextId',
  'orchestrationSetReferences',
  'lineage',
  'provenance',
  'uncertaintyState',
  'abstentionState',
  'limitations',
  'reasoningSummary',
  'synthesizedDirection',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'cognitiveKernelStarted',
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
  if (lineage.kernelContractVersion != null
    && lineage.kernelContractVersion !== KERNEL_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.kernelContractVersion',
      code: 'bad_kernel_contract_version',
      expected: KERNEL_CONTRACT_VERSION,
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
  for (const [key, expected] of Object.entries(ZERO_KERNEL_SIDE_EFFECTS)) {
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
 * Validate Cognitive Kernel *input* envelope (Stage 7.2.a).
 * Does not run the Kernel; only schema / lineage / provenance gates.
 *
 * @param {unknown} input
 */
export function validateCognitiveKernelInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Cognitive Kernel input must be a plain object');
  }

  const errors = [];
  assertForbiddenKeys(input, FORBIDDEN_KERNEL_INPUT_KEYS, errors);
  assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors);

  if (input.schemaVersion !== KERNEL_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'bad_schema_version', expected: KERNEL_SCHEMA_VERSION });
  }
  if (input.kernelContractVersion !== KERNEL_CONTRACT_VERSION) {
    errors.push({
      field: 'kernelContractVersion',
      code: 'bad_kernel_contract_version',
      expected: KERNEL_CONTRACT_VERSION,
    });
  }
  if (!isCanonicalUuid(input.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (input.decisionContextContractVersion !== REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'decisionContextContractVersion',
      code: 'incompatible_decision_context_contract',
      expected: REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION,
    });
  }

  validateOrchestrationSetReferences(input.orchestrationSetReferences, errors);
  validateLineage(input.lineage, input.decisionContextId, errors);
  validateProvenance(input.provenance, errors);
  validateLimitations(input.limitations, errors);
  validateSideEffects(input.sideEffects, errors);
  assertOrchRefsMatchLineage(input.orchestrationSetReferences, input.lineage, errors);
  rejectExecutionAuthorityStrings(input, errors);

  const secretKeys = collectForbiddenSecretKeys(input);
  if (secretKeys.length) {
    errors.push({ field: 'input', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  const bytes = utf8ByteLength(input);
  if (bytes > MAX_KERNEL_UTF8_BYTES) {
    errors.push({ field: 'input', code: 'too_large', bytes, limit: MAX_KERNEL_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Cognitive Kernel input failed strict validation', {
      errors,
      bytes,
    });
  }
  return { ok: true, bytes };
}

/**
 * Validate Cognitive Kernel *candidate output* skeleton (future Decision shape).
 * Requires executionEligible=false and approvedForExecution=false.
 *
 * @param {unknown} output
 */
export function validateCognitiveKernelCandidateOutput(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return fail('invalid_output', 'Cognitive Kernel candidate output must be a plain object');
  }

  const errors = [];
  assertForbiddenKeys(output, FORBIDDEN_KERNEL_OUTPUT_KEYS, errors);
  assertAllowlist(output, ALLOWED_OUTPUT_TOP, 'output', errors);

  if (output.schemaVersion !== KERNEL_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'bad_schema_version', expected: KERNEL_SCHEMA_VERSION });
  }
  if (output.kernelContractVersion !== KERNEL_CONTRACT_VERSION) {
    errors.push({
      field: 'kernelContractVersion',
      code: 'bad_kernel_contract_version',
      expected: KERNEL_CONTRACT_VERSION,
    });
  }
  if (!isCanonicalUuid(output.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }

  validateOrchestrationSetReferences(output.orchestrationSetReferences, errors);
  validateLineage(output.lineage, output.decisionContextId, errors);
  validateProvenance(output.provenance, errors);
  validateLimitations(output.limitations, errors);
  validateSideEffects(output.sideEffects, errors);
  assertOrchRefsMatchLineage(output.orchestrationSetReferences, output.lineage, errors);

  if (!inEnum(output.uncertaintyState, KERNEL_UNCERTAINTY_STATE)) {
    errors.push({ field: 'uncertaintyState', code: 'invalid_uncertainty_state' });
  }
  if (!inEnum(output.abstentionState, KERNEL_ABSTENTION_STATE)) {
    errors.push({ field: 'abstentionState', code: 'invalid_abstention_state' });
  }

  if (output.reasoningSummary != null) {
    assertStringMax('reasoningSummary', output.reasoningSummary, errors, { max: 2048 });
  }
  if (output.synthesizedDirection != null) {
    errors.push({ field: 'synthesizedDirection', code: 'must_be_null_in_stage_7_2a' });
  }
  if (output.decisionEligible !== false) {
    errors.push({ field: 'decisionEligible', code: 'must_be_false' });
  }
  if (output.executionEligible !== false) {
    errors.push({ field: 'executionEligible', code: 'must_be_false' });
  }
  if (output.approvedForExecution !== false) {
    errors.push({ field: 'approvedForExecution', code: 'must_be_false' });
  }
  if (output.cognitiveKernelStarted !== false) {
    errors.push({ field: 'cognitiveKernelStarted', code: 'must_be_false_in_stage_7_2a' });
  }

  assertStringMax('policyVersion', output.policyVersion, errors, { required: false });
  assertStringMax('implementationVersion', output.implementationVersion, errors, {
    required: false,
  });
  if (output.generatedAt != null && !isIsoTimestamp(output.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  rejectExecutionAuthorityStrings(output, errors);

  const secretKeys = collectForbiddenSecretKeys(output);
  if (secretKeys.length) {
    errors.push({ field: 'output', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  const bytes = utf8ByteLength(output);
  if (bytes > MAX_KERNEL_UTF8_BYTES) {
    errors.push({ field: 'output', code: 'too_large', bytes, limit: MAX_KERNEL_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Cognitive Kernel candidate output failed strict validation', {
      errors,
      bytes,
    });
  }
  return { ok: true, bytes };
}

/**
 * Build a Stage 7.2.a contract-only candidate output skeleton.
 * Always non-executing / Kernel-not-started.
 */
export function buildKernelContractOnlyCandidate(partial = {}) {
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
    schemaVersion: KERNEL_SCHEMA_VERSION,
    kernelContractVersion: KERNEL_CONTRACT_VERSION,
    decisionContextId,
    orchestrationSetReferences,
    lineage: {
      decisionContextId,
      decisionContextContractVersion: REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION,
      orchestrationSetIds,
      orchestrationContractVersion: REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
      kernelContractVersion: KERNEL_CONTRACT_VERSION,
      policyVersion: KERNEL_POLICY_VERSION,
      stage: KERNEL_STAGE,
    },
    provenance: {
      writer: KERNEL_WRITER,
      methodKey: partial.provenance?.methodKey ?? 'contract_only_skeleton',
      stage: KERNEL_STAGE,
      note: partial.provenance?.note ?? 'stage_7_2a_kernel_contract_not_cognitive_engine',
      recordedAt,
    },
    uncertaintyState: partial.uncertaintyState ?? KERNEL_UNCERTAINTY_STATE.NOT_EVALUATED,
    abstentionState: partial.abstentionState ?? KERNEL_ABSTENTION_STATE.CONTRACT_ONLY,
    limitations: Array.isArray(partial.limitations) && partial.limitations.length
      ? [...partial.limitations]
      : [...KERNEL_LIMITATIONS],
    reasoningSummary: null,
    synthesizedDirection: null,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveKernelStarted: false,
    sideEffects: { ...ZERO_KERNEL_SIDE_EFFECTS },
    policyVersion: partial.policyVersion ?? KERNEL_POLICY_VERSION,
    implementationVersion: partial.implementationVersion ?? KERNEL_POLICY_VERSION,
    generatedAt: partial.generatedAt ?? recordedAt,
  };
}

export default {
  KERNEL_STAGE,
  KERNEL_SCHEMA_VERSION,
  KERNEL_CONTRACT_VERSION,
  KERNEL_POLICY_VERSION,
  KERNEL_WRITER,
  REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION,
  REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
  KERNEL_UNCERTAINTY_STATE,
  KERNEL_ABSTENTION_STATE,
  KERNEL_LIMITATIONS,
  ZERO_KERNEL_SIDE_EFFECTS,
  FORBIDDEN_KERNEL_INPUT_KEYS,
  FORBIDDEN_KERNEL_OUTPUT_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  validateCognitiveKernelInput,
  validateCognitiveKernelCandidateOutput,
  buildKernelContractOnlyCandidate,
};
