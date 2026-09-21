/**
 * Artemis Core Stage 8 — Shadow Runtime Library Boundary (S8-SHADOW-RT-BOUNDARY).
 *
 * Deterministic, non-executing, in-memory composition of ONE Artemis Shadow
 * evaluation cycle. Composes existing canonical owners only:
 *   marketContextRef → Decision Context → EvidenceOrchestrationSet →
 *   Decision → Control Chain → C8.1 Shadow Decision Recording
 *
 * Does NOT:
 *   - create a new Decision / Evidence / Market Context / Recording SoT
 *   - activate Shadow runtime / worker / scheduler / Task State
 *   - persist (B10), write DB/Redis, network, provider, LLM, orders, wallet
 *   - wire legacy engine / queue / Artemis scheduler / orchestrator /
 *     execution-gate / trading-engine / HTTP decision routes
 *   - mutate C1–C6 / Control Chain / Decision / Context / Evidence / S8-MC / C8.1
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
  ALLOWED_MARKET_CONTEXT_REF,
  SHADOW_RECORDING_CONTRACT_VERSION,
  ZERO_SHADOW_RECORDING_SIDE_EFFECTS,
  buildShadowDecisionRecording,
} from './artemisShadowDecisionRecordingBoundaryContract.js';

export const SHADOW_RUNTIME_STAGE = 'ARTEMIS_CORE_STAGE_8_SHADOW_RUNTIME_LIBRARY_BOUNDARY';
export const SHADOW_RUNTIME_SCHEMA_VERSION = '1.0.0';
export const SHADOW_RUNTIME_CONTRACT_VERSION = 'artemis-shadow-runtime-library-boundary-1.0.0';
export const SHADOW_RUNTIME_POLICY_VERSION = 'stage8-shadow-runtime-library-boundary-1.0.0';
export const SHADOW_RUNTIME_WRITER = 'artemisShadowRuntimeLibraryBoundaryContract';
export const SHADOW_RUNTIME_METHOD_KEY = 'build_shadow_cycle_composition_fail_closed';
export const SHADOW_CYCLE_ARTIFACT_TYPE = 'SHADOW_CYCLE_COMPOSITION_ENVELOPE';

export const MAX_SHADOW_CYCLE_UTF8_BYTES = 96 * 1024;
export const MAX_STRING_CHARS = 512;

export const ZERO_SHADOW_RUNTIME_SIDE_EFFECTS = Object.freeze({
  ...ZERO_SHADOW_RECORDING_SIDE_EFFECTS,
});

/** Authority hard-false for the composition envelope (includes paperTradingEnabled). */
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

export const SHADOW_RUNTIME_LIMITATIONS = Object.freeze([
  'stage8_shadow_runtime_library_boundary_only',
  'library_only',
  'in_memory_only',
  'deterministic_non_executing_composition',
  'composes_c8_1_shadow_recording_only',
  'market_context_ref_required_reference_only',
  'does_not_fetch_or_mutate_market_context_sot',
  'does_not_create_parallel_sot',
  'does_not_activate_shadow_runtime_worker_or_scheduler',
  'does_not_create_task_state',
  'persistence_not_enabled',
  'b10_not_activated',
  'observed_outcome_deferred',
  'does_not_authorize_execution',
  'does_not_call_llm_or_provider',
  'does_not_write_db_or_redis',
  'legacy_runtime_not_canonical',
]);

const ALLOWED_INPUT_TOP = Object.freeze([
  'decision',
  'decisionContext',
  'evidenceOrchestrationSet',
  'controlChainArtifact',
  'marketContextRef',
  'recordedAt',
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
]);

const ALLOWED_ENVELOPE_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'shadowCycleEnvelopeId',
  'recordedAt',
  'marketContextRef',
  'decisionRef',
  'decisionContextRef',
  'evidenceOrchestrationRef',
  'controlChainRef',
  'shadowRecordingRef',
  'shadowRecordingArtifact',
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
  'implementationVersion',
]);

const ALLOWED_SHADOW_RECORDING_REF = Object.freeze([
  'shadowRecordingArtifactId',
  'contractVersion',
  'maturity',
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
  'observedOutcome',
  'realizedPnl',
  'realizedDirection',
  'calibrationScore',
  'evaluationResult',
  'lookahead',
  'lookAhead',
  'taskId',
  'workerId',
  'lease',
  'schedulerState',
  'queueState',
  // Top-level runId is rejected separately. Nested runId under evidence /
  // orchestration remains owned by those canonical artifacts and must pass.
  ['persist', 'Artemis', 'Decision'].join(''),
  'b10',
  'shadowWorker',
  'shadowScheduler',
  'scheduler',
]);

const MARKET_CONTAMINATION_KEYS = Object.freeze([
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
  'freshnessClaim',
]);

const OUTCOME_CONTAMINATION_KEYS = Object.freeze([
  'observedOutcome',
  'realizedPnl',
  'realizedDirection',
  'calibrationScore',
  'evaluationResult',
  'lookahead',
  'lookAhead',
]);

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));

function fail(code, message, extra = {}) {
  return { ok: false, code, message, envelope: null, artifact: null, ...extra };
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

/**
 * Build one deterministic Shadow Cycle Composition Envelope.
 * Requires marketContextRef (reference-only). Delegates recording to C8.1.
 *
 * @param {object} input
 * @returns {{ ok: true, envelope: object, artifact: object, sideEffects: object }
 *   | { ok: false, code: string, message: string, errors?: array }}
 */
export function buildShadowCycleComposition(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Shadow runtime cycle input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }

  const errors = [];

  // Top-level runId / taskId are forbidden before allowlist (identity / Task State isolation).
  if (Object.prototype.hasOwnProperty.call(input, 'runId')) {
    errors.push({ field: 'runId', code: 'forbidden_recording_identity' });
  }
  if (Object.prototype.hasOwnProperty.call(input, 'taskId')) {
    errors.push({ field: 'taskId', code: 'task_state_forbidden' });
  }
  if (errors.length) {
    return fail('shadow_cycle_input_invalid', 'Shadow cycle composition input failed validation', {
      errors,
    });
  }

  const forbidden = collectForbiddenKeys(input);
  forbidden.forEach((key) => errors.push({ field: key, code: 'forbidden_key' }));
  const secretKeys = collectForbiddenSecretKeys(input);
  secretKeys.forEach((key) => errors.push({ field: key, code: 'forbidden_secret_key' }));

  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Unknown Shadow runtime cycle input fields', { errors });
  }

  for (const key of OUTCOME_CONTAMINATION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      errors.push({ field: key, code: 'outcome_contamination' });
    }
  }
  for (const key of MARKET_CONTAMINATION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      errors.push({ field: key, code: 'market_contamination' });
    }
  }

  validateHardFlagsOnInput(input, errors);

  if (!isIsoTimestamp(input.recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'invalid_iso_timestamp' });
  }

  if (input.decision == null) {
    errors.push({ field: 'decision', code: 'missing_decision' });
  }
  if (input.decisionContext == null) {
    errors.push({ field: 'decisionContext', code: 'missing_decision_context' });
  }
  if (input.evidenceOrchestrationSet == null) {
    errors.push({ field: 'evidenceOrchestrationSet', code: 'missing_evidence_orchestration_set' });
  }
  if (input.controlChainArtifact == null) {
    errors.push({ field: 'controlChainArtifact', code: 'missing_control_chain' });
  }
  if (input.marketContextRef == null) {
    errors.push({ field: 'marketContextRef', code: 'missing_market_context_ref' });
  } else if (typeof input.marketContextRef !== 'object' || Array.isArray(input.marketContextRef)) {
    errors.push({ field: 'marketContextRef', code: 'malformed_market_context_ref' });
  }

  if (errors.length) {
    return fail('shadow_cycle_input_invalid', 'Shadow cycle composition input failed validation', {
      errors,
    });
  }

  // C8.1 does not accept paperTradingEnabled — strip RT-only hard flags before delegate.
  const {
    paperTradingEnabled: _paperTradingEnabled,
    ...c81Input
  } = input;

  const recording = buildShadowDecisionRecording(c81Input);
  if (!recording.ok) {
    return fail(
      recording.code || 'shadow_recording_failed',
      recording.message || 'C8.1 Shadow recording composition failed',
      { errors: recording.errors || [] },
    );
  }

  const recordingArtifact = recording.artifact;
  if (recordingArtifact.marketContextRef == null) {
    return fail('market_context_ref_required', 'Shadow cycle requires validated marketContextRef', {
      errors: [{ field: 'marketContextRef', code: 'missing_market_context_ref' }],
    });
  }

  const shadowCycleEnvelopeId = hashToUuid([
    SHADOW_RUNTIME_CONTRACT_VERSION,
    SHADOW_CYCLE_ARTIFACT_TYPE,
    input.recordedAt,
    recordingArtifact.shadowRecordingArtifactId,
    recordingArtifact.decisionRef?.decisionId,
    recordingArtifact.decisionContextRef?.contextId,
    recordingArtifact.evidenceOrchestrationRef?.orchestrationId,
    recordingArtifact.controlChainRef?.controlChainArtifactId,
    recordingArtifact.marketContextRef?.marketContextId,
  ]);

  if (!isCanonicalUuid(shadowCycleEnvelopeId)) {
    return fail('envelope_identity_failed', 'Failed to derive deterministic shadowCycleEnvelopeId');
  }

  const envelope = {
    schemaVersion: SHADOW_RUNTIME_SCHEMA_VERSION,
    contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    policyVersion: SHADOW_RUNTIME_POLICY_VERSION,
    artifactType: SHADOW_CYCLE_ARTIFACT_TYPE,
    shadowCycleEnvelopeId,
    recordedAt: input.recordedAt,
    marketContextRef: recordingArtifact.marketContextRef,
    decisionRef: recordingArtifact.decisionRef,
    decisionContextRef: recordingArtifact.decisionContextRef,
    evidenceOrchestrationRef: recordingArtifact.evidenceOrchestrationRef,
    controlChainRef: recordingArtifact.controlChainRef,
    shadowRecordingRef: {
      shadowRecordingArtifactId: recordingArtifact.shadowRecordingArtifactId,
      contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
      maturity: recordingArtifact.maturity,
    },
    shadowRecordingArtifact: recordingArtifact,
    lineage: {
      ...recordingArtifact.lineage,
      shadowRuntimeContractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
      shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
      shadowCycleEnvelopeId,
    },
    provenance: {
      writer: SHADOW_RUNTIME_WRITER,
      methodKey: SHADOW_RUNTIME_METHOD_KEY,
      stage: SHADOW_RUNTIME_STAGE,
      recordedAt: input.recordedAt,
      policyVersion: SHADOW_RUNTIME_POLICY_VERSION,
      note: input.provenance?.note,
      implementationVersion: input.implementationVersion || input.provenance?.implementationVersion,
    },
    limitations: [...SHADOW_RUNTIME_LIMITATIONS],
    sideEffects: { ...ZERO_SHADOW_RUNTIME_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
    implementationVersion: input.implementationVersion || input.provenance?.implementationVersion,
  };

  const finalErrors = [];
  assertAllowlist(envelope, ALLOWED_ENVELOPE_TOP, 'envelope', finalErrors);
  assertAllowlist(envelope.marketContextRef, ALLOWED_MARKET_CONTEXT_REF, 'marketContextRef', finalErrors);
  assertAllowlist(envelope.shadowRecordingRef, ALLOWED_SHADOW_RECORDING_REF, 'shadowRecordingRef', finalErrors);

  for (const key of HARD_FLAG_KEYS) {
    if (envelope[key] !== false) {
      finalErrors.push({ field: key, code: 'hard_flag_must_be_false' });
    }
  }

  const bytes = utf8ByteLength(envelope);
  if (bytes > MAX_SHADOW_CYCLE_UTF8_BYTES) {
    finalErrors.push({ field: 'envelope', code: 'too_large', bytes });
  }
  if (finalErrors.length) {
    return fail('envelope_validation_failed', 'Built Shadow cycle envelope failed allowlist', {
      errors: finalErrors,
    });
  }

  const frozen = freezeDeep(envelope);
  return {
    ok: true,
    code: 'SHADOW_CYCLE_COMPOSITION_BUILT',
    message: 'Shadow Cycle Composition Envelope validated',
    envelope: frozen,
    artifact: frozen,
    sideEffects: { ...ZERO_SHADOW_RUNTIME_SIDE_EFFECTS },
    bytes,
  };
}

/** Compatible alias — single canonical builder surface. */
export function validateShadowCycleComposition(input = {}) {
  return buildShadowCycleComposition(input);
}

export default {
  SHADOW_RUNTIME_STAGE,
  SHADOW_RUNTIME_SCHEMA_VERSION,
  SHADOW_RUNTIME_CONTRACT_VERSION,
  SHADOW_RUNTIME_POLICY_VERSION,
  SHADOW_RUNTIME_WRITER,
  SHADOW_RUNTIME_METHOD_KEY,
  SHADOW_CYCLE_ARTIFACT_TYPE,
  ZERO_SHADOW_RUNTIME_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS,
  SHADOW_RUNTIME_LIMITATIONS,
  buildShadowCycleComposition,
  validateShadowCycleComposition,
};
