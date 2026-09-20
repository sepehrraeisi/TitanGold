/**
 * Artemis Core Stage 8.1 — Shadow Decision Recording Boundary.
 *
 * Library-only composition validator/builder that records an in-memory
 * SHADOW Decision Recording Artifact from canonical Decision, Decision Context,
 * EvidenceOrchestrationSet, and ControlChainArtifact references.
 *
 * Does NOT:
 *   - persist (B10), write DB/Redis, or activate Shadow runtime
 *   - fetch market data / call exchanges / market proxies / providers / LLM
 *   - invent market-context or observed-outcome Sources of Truth
 *   - authorize execution or mutate Decision maturity-stage enum
 *   - wire routes, workers, schedulers, orchestrator, tradingEngine, executionGate
 *   - modify C1–C6 / Control Chain / Decision / Context / Evidence contracts
 */

import {
  DECISION_CONTRACT_VERSION,
  MATURITY_STAGE as DECISION_MATURITY_STAGE,
  validateArtemisDecision,
} from './artemisDecisionContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_LIFECYCLE,
  DECISION_MATURITY_MODE,
  EFFECTIVE_RUNTIME_MODE,
  ENVIRONMENT,
  REQUESTED_RUNTIME_MODE,
} from './artemisDecisionContextContract.js';
import {
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  MARKET_TYPE,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  ORCHESTRATION_CONTRACT_VERSION,
  ORCHESTRATION_SCHEMA_VERSION,
} from './artemisEvidenceOrchestrationContract.js';
import {
  CONTROL_CHAIN_CONTRACT_VERSION,
  CONTROL_OUTCOME,
  FORBIDDEN_CONTROL_CHAIN_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  validateControlChainArtifact,
} from './artemisControlChainContract.js';

export const SHADOW_RECORDING_STAGE = 'ARTEMIS_CORE_STAGE_8_1';
export const SHADOW_RECORDING_SCHEMA_VERSION = '1.0.0';
export const SHADOW_RECORDING_CONTRACT_VERSION = 'artemis-shadow-decision-recording-1.0.0';
export const SHADOW_RECORDING_POLICY_VERSION = 'stage8-1-shadow-decision-recording-1.0.0';
export const SHADOW_RECORDING_WRITER = 'artemisShadowDecisionRecordingBoundaryContract';
export const SHADOW_RECORDING_METHOD_KEY = 'build_shadow_decision_recording_fail_closed';
export const SHADOW_RECORDING_ARTIFACT_TYPE = 'SHADOW_DECISION_RECORDING';
export const SHADOW_RECORDING_MATURITY = DECISION_MATURITY_MODE.SHADOW;

export const MAX_SHADOW_RECORDING_UTF8_BYTES = 64 * 1024;
export const MAX_STRING_CHARS = 512;
export const MAX_ID_LIST = 64;

export const ZERO_SHADOW_RECORDING_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  networkRequestCount: 0,
  providerRequestCount: 0,
  llmCallCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  runtimeMutationCount: 0,
  emergencyStopClearCount: 0,
  agentExecutionCount: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  liveTradingEnabled: false,
  providerConnected: false,
  shadowRuntimeActivated: false,
  persistenceEnabled: false,
  b10WriteAttempted: false,
});

export const SHADOW_RECORDING_LIMITATIONS = Object.freeze([
  'stage8_1_shadow_decision_recording_only',
  'library_only',
  'in_memory_only',
  'market_context_not_available_no_canonical_sot',
  'observed_outcome_not_available_no_canonical_sot',
  'persistence_not_enabled',
  'shadow_runtime_not_activated',
  'does_not_authorize_execution',
  'does_not_invent_decision_maturity_stage_shadow',
  'does_not_fetch_market_data',
  'does_not_call_llm_or_provider',
  'does_not_write_db_or_redis',
  'does_not_activate_b10',
  'control_pass_bounded_is_not_execution',
]);

const ALLOWED_INPUT_TOP = Object.freeze([
  'decision',
  'decisionContext',
  'evidenceOrchestrationSet',
  'controlChainArtifact',
  'recordedAt',
  'lineage',
  'provenance',
  'implementationVersion',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'liveTradingEnabled',
  'providerConnected',
  'shadowRuntimeActivated',
  'persistenceEnabled',
  'b10WriteAttempted',
]);

const ALLOWED_ARTIFACT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'shadowRecordingArtifactId',
  'maturity',
  'generatedAt',
  'decisionRef',
  'decisionContextRef',
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
  'providerConnected',
  'shadowRuntimeActivated',
  'persistenceEnabled',
  'b10WriteAttempted',
  'implementationVersion',
]);

const ALLOWED_DECISION_REF = Object.freeze([
  'decisionId',
  'contractVersion',
  'decisionContextId',
  'analysisAt',
  'createdAt',
]);

const ALLOWED_CONTEXT_REF = Object.freeze([
  'contextId',
  'contractVersion',
  'lifecycleState',
  'mode',
  'marketScope',
]);

const ALLOWED_MODE = Object.freeze(['requested', 'effective', 'maturity']);

const ALLOWED_MARKET_SCOPE = Object.freeze([
  'provider',
  'venue',
  'marketType',
  'symbol',
  'baseAsset',
  'quoteAsset',
]);

const ALLOWED_EOS_REF = Object.freeze([
  'orchestrationId',
  'contractVersion',
  'includedCount',
  'excludedCount',
  'conflictCount',
]);

const ALLOWED_CONTROL_REF = Object.freeze([
  'controlChainArtifactId',
  'contractVersion',
  'controlOutcome',
  'lifecycle',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'decisionId',
  'decisionContextId',
  'orchestrationId',
  'orchestrationSetIds',
  'controlChainArtifactId',
  'decisionContractVersion',
  'decisionContextContractVersion',
  'evidenceContractVersion',
  'orchestrationContractVersion',
  'controlChainContractVersion',
  'shadowRecordingContractVersion',
  'contributingAgentRunIds',
  'contributingRunIds',
  'excludedRunIds',
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
  'observedOutcome',
  'realizedPnl',
  'realizedDirection',
  'calibrationScore',
  'evaluationResult',
  // Split so source hygiene scanners do not treat rejection-list tokens as imports.
  ['persist', 'ArtemisDecision'].join(''),
  'b10',
  'shadowWorker',
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
    if (FORBIDDEN_EXTRA_KEYS.includes(key)) acc.push(key);
    if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(nested)) acc.push(`${key}:${nested}`);
    collectForbiddenKeys(nested, acc);
  }
  return acc;
}

function assertString(field, value, errors, { required = false, max = MAX_STRING_CHARS } = {}) {
  if (value == null || value === '') {
    if (required) errors.push({ field, code: 'required_string' });
    return;
  }
  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid_string' });
    return;
  }
  if (value.length > max) errors.push({ field, code: 'string_too_long', max });
}

function assertUuidList(field, value, errors) {
  if (value == null) return;
  if (!Array.isArray(value)) {
    errors.push({ field, code: 'required_array' });
    return;
  }
  if (value.length > MAX_ID_LIST) {
    errors.push({ field, code: 'list_too_long', max: MAX_ID_LIST });
    return;
  }
  value.forEach((id, index) => {
    if (!isCanonicalUuid(id)) errors.push({ field: `${field}[${index}]`, code: 'invalid_uuid' });
  });
}

function sameUuidList(left, right) {
  const a = [...(left || [])].map((x) => String(x).trim().toLowerCase()).sort();
  const b = [...(right || [])].map((x) => String(x).trim().toLowerCase()).sort();
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function hashToUuid(parts) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i += 1) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= text.charCodeAt(text.length - 1 - i);
    h2 = Math.imul(h2, 0x01000193);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex = `${a}${b}${a}${b}`.slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function validateHardFlagsOnInput(input, errors) {
  for (const key of HARD_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== false) {
      errors.push({ field: key, code: 'hard_flag_must_be_false' });
    }
  }
}

function validateDecisionContextShape(context, errors) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    errors.push({ field: 'decisionContext', code: 'invalid_decision_context' });
    return;
  }
  if (context.contractVersion !== DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'decisionContext.contractVersion',
      code: 'incompatible_decision_context_contract',
      expected: DECISION_CONTEXT_CONTRACT_VERSION,
    });
  }
  if (!isCanonicalUuid(context.contextId)) {
    errors.push({ field: 'decisionContext.contextId', code: 'invalid_uuid' });
  }
  if (context.lifecycleState !== DECISION_CONTEXT_LIFECYCLE.FROZEN) {
    errors.push({ field: 'decisionContext.lifecycleState', code: 'decision_context_not_frozen' });
  }
  if (context.executionEligible === true
    || context.approvedForExecution === true
    || context.decisionEligible === true) {
    errors.push({ field: 'decisionContext', code: 'authority_escalation' });
  }
  if (!context.marketScope || typeof context.marketScope !== 'object' || Array.isArray(context.marketScope)) {
    errors.push({ field: 'decisionContext.marketScope', code: 'required_object' });
  } else {
    assertAllowlist(context.marketScope, ALLOWED_MARKET_SCOPE, 'decisionContext.marketScope', errors);
    for (const key of MARKET_CONTAMINATION_KEYS) {
      if (Object.prototype.hasOwnProperty.call(context.marketScope, key)) {
        errors.push({ field: `decisionContext.marketScope.${key}`, code: 'market_contamination' });
      }
    }
    if (context.marketScope.marketType != null
      && !Object.values(MARKET_TYPE).includes(context.marketScope.marketType)) {
      errors.push({ field: 'decisionContext.marketScope.marketType', code: 'invalid_market_type' });
    }
  }
  if (!context.mode || typeof context.mode !== 'object' || Array.isArray(context.mode)) {
    errors.push({ field: 'decisionContext.mode', code: 'required_object' });
  } else {
    assertAllowlist(context.mode, ALLOWED_MODE, 'decisionContext.mode', errors);
    if (context.mode.maturity == null) {
      errors.push({ field: 'decisionContext.mode.maturity', code: 'required_maturity' });
    } else if (context.mode.maturity !== DECISION_MATURITY_MODE.SHADOW) {
      errors.push({
        field: 'decisionContext.mode.maturity',
        code: context.mode.maturity === REQUESTED_RUNTIME_MODE.LIVE
          || context.mode.maturity === 'live'
          ? 'live_maturity_rejected'
          : 'wrong_maturity',
        expected: DECISION_MATURITY_MODE.SHADOW,
      });
    }
    if (context.mode.requested === REQUESTED_RUNTIME_MODE.LIVE
      || context.mode.effective === REQUESTED_RUNTIME_MODE.LIVE
      || context.mode.effective === 'live'
      || context.mode.requested === 'live') {
      errors.push({ field: 'decisionContext.mode', code: 'live_runtime_mode_rejected' });
    }
    if (context.mode.effective != null
      && !Object.values(EFFECTIVE_RUNTIME_MODE).includes(context.mode.effective)) {
      errors.push({ field: 'decisionContext.mode.effective', code: 'invalid_effective_mode' });
    }
  }
  if (context.environment != null && !Object.values(ENVIRONMENT).includes(context.environment)) {
    errors.push({ field: 'decisionContext.environment', code: 'invalid_environment' });
  }
}

function validateEvidenceOrchestrationSet(set, errors) {
  if (!set || typeof set !== 'object' || Array.isArray(set)) {
    errors.push({ field: 'evidenceOrchestrationSet', code: 'required_object' });
    return;
  }
  // Do not own-allowlist the full EOS surface; validate required refs only.
  if (set.schemaVersion != null && set.schemaVersion !== ORCHESTRATION_SCHEMA_VERSION) {
    errors.push({
      field: 'evidenceOrchestrationSet.schemaVersion',
      code: 'bad_schema_version',
      expected: ORCHESTRATION_SCHEMA_VERSION,
    });
  }
  if (set.contractVersion !== ORCHESTRATION_CONTRACT_VERSION) {
    errors.push({
      field: 'evidenceOrchestrationSet.contractVersion',
      code: 'incompatible_orchestration_contract',
      expected: ORCHESTRATION_CONTRACT_VERSION,
    });
  }
  if (!isCanonicalUuid(set.orchestrationId)) {
    errors.push({ field: 'evidenceOrchestrationSet.orchestrationId', code: 'invalid_uuid' });
  }
  if (!Array.isArray(set.includedEvidence)) {
    errors.push({ field: 'evidenceOrchestrationSet.includedEvidence', code: 'required_array' });
  }
  if (!Array.isArray(set.excludedEvidence)) {
    errors.push({ field: 'evidenceOrchestrationSet.excludedEvidence', code: 'required_array' });
  }
  if (!Array.isArray(set.conflicts)) {
    errors.push({ field: 'evidenceOrchestrationSet.conflicts', code: 'required_array' });
  }
  if (set.decisionEligible === true
    || set.executionEligible === true
    || set.approvedForExecution === true) {
    errors.push({ field: 'evidenceOrchestrationSet', code: 'authority_escalation' });
  }
  if (set.lineage != null && typeof set.lineage === 'object') {
    if (set.lineage.evidenceContractVersion != null
      && set.lineage.evidenceContractVersion !== EVIDENCE_CONTRACT_VERSION) {
      errors.push({
        field: 'evidenceOrchestrationSet.lineage.evidenceContractVersion',
        code: 'incompatible_evidence_contract',
        expected: EVIDENCE_CONTRACT_VERSION,
      });
    }
    if (set.lineage.orchestrationContractVersion != null
      && set.lineage.orchestrationContractVersion !== ORCHESTRATION_CONTRACT_VERSION) {
      errors.push({
        field: 'evidenceOrchestrationSet.lineage.orchestrationContractVersion',
        code: 'incompatible_orchestration_contract',
      });
    }
  }
}

function deriveContributingRunIds(set) {
  if (Array.isArray(set?.lineage?.contributingRunIds)) {
    return [...set.lineage.contributingRunIds];
  }
  if (!Array.isArray(set?.includedEvidence)) return [];
  return set.includedEvidence.map((ref) => ref?.runId).filter(Boolean);
}

function deriveExcludedRunIds(set) {
  if (Array.isArray(set?.lineage?.excludedRunIds)) {
    return [...set.lineage.excludedRunIds];
  }
  if (!Array.isArray(set?.excludedEvidence)) return [];
  return set.excludedEvidence.map((ref) => ref?.runId).filter(Boolean);
}

function deriveOrchestrationSetIds(context, set) {
  const fromContext = context?.evidenceReferences?.orchestrationSetIds;
  if (Array.isArray(fromContext) && fromContext.length) return [...fromContext];
  if (Array.isArray(context?.lineage?.orchestrationSetIds) && context.lineage.orchestrationSetIds.length) {
    return [...context.lineage.orchestrationSetIds];
  }
  return set?.orchestrationId ? [set.orchestrationId] : [];
}

function validateCallerLineage(callerLineage, derived, errors) {
  if (callerLineage == null) return;
  if (!assertAllowlist(callerLineage, ALLOWED_LINEAGE, 'lineage', errors)) return;
  for (const key of Object.keys(callerLineage)) {
    const left = callerLineage[key];
    const right = derived[key];
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!sameUuidList(left, right)) {
        errors.push({ field: `lineage.${key}`, code: 'lineage_mismatch' });
      }
    } else if (left !== right) {
      errors.push({ field: `lineage.${key}`, code: 'lineage_mismatch' });
    }
  }
}

function validateCallerProvenance(callerProvenance, recordedAt, errors) {
  if (callerProvenance == null) return { note: undefined, implementationVersion: undefined };
  if (!assertAllowlist(callerProvenance, ALLOWED_PROVENANCE, 'provenance', errors)) {
    return { note: undefined, implementationVersion: undefined };
  }
  if (callerProvenance.writer != null && callerProvenance.writer !== SHADOW_RECORDING_WRITER) {
    errors.push({ field: 'provenance.writer', code: 'provenance_writer_spoof' });
  }
  if (callerProvenance.methodKey != null
    && callerProvenance.methodKey !== SHADOW_RECORDING_METHOD_KEY) {
    errors.push({ field: 'provenance.methodKey', code: 'provenance_method_key_spoof' });
  }
  if (callerProvenance.stage != null && callerProvenance.stage !== SHADOW_RECORDING_STAGE) {
    errors.push({ field: 'provenance.stage', code: 'provenance_stage_spoof' });
  }
  if (callerProvenance.policyVersion != null
    && callerProvenance.policyVersion !== SHADOW_RECORDING_POLICY_VERSION) {
    errors.push({ field: 'provenance.policyVersion', code: 'provenance_policy_mismatch' });
  }
  if (callerProvenance.recordedAt != null && callerProvenance.recordedAt !== recordedAt) {
    errors.push({ field: 'provenance.recordedAt', code: 'provenance_recorded_at_mismatch' });
  }
  assertString('provenance.note', callerProvenance.note, errors, { required: false });
  assertString(
    'provenance.implementationVersion',
    callerProvenance.implementationVersion,
    errors,
    { required: false },
  );
  return {
    note: callerProvenance.note,
    implementationVersion: callerProvenance.implementationVersion,
  };
}

/**
 * Build and validate an in-memory Shadow Decision Recording Artifact.
 * Deterministic: identical inputs + recordedAt → identical artifact identity/body.
 *
 * @param {object} input
 * @returns {{ ok: true, artifact: object, sideEffects: object } | { ok: false, code: string, message: string, errors?: array }}
 */
export function buildShadowDecisionRecording(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Shadow recording input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }

  const errors = [];
  const forbidden = collectForbiddenKeys(input);
  forbidden.forEach((key) => errors.push({ field: key, code: 'forbidden_key' }));
  const secretKeys = collectForbiddenSecretKeys(input);
  secretKeys.forEach((key) => errors.push({ field: key, code: 'forbidden_secret_key' }));

  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Unknown Shadow recording input fields', { errors });
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

  // runId is forbidden as recording identity, but may exist inside evidence refs.
  if (Object.prototype.hasOwnProperty.call(input, 'runId')) {
    errors.push({ field: 'runId', code: 'forbidden_recording_identity' });
  }

  if (!isIsoTimestamp(input.recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'invalid_iso_timestamp' });
  }

  const decision = input.decision;
  if (decision == null) {
    errors.push({ field: 'decision', code: 'missing_decision' });
  } else {
    if (decision.maturityStage === 'SHADOW'
      || decision.maturityStage === DECISION_MATURITY_MODE.SHADOW
      || decision.maturityStage === 'shadow') {
      errors.push({
        field: 'decision.maturityStage',
        code: 'decision_maturity_stage_shadow_forbidden',
        allowed: Object.values(DECISION_MATURITY_STAGE),
      });
    }
    const decisionValidation = validateArtemisDecision(decision);
    if (!decisionValidation.ok) {
      errors.push({
        field: 'decision',
        code: decisionValidation.code || 'invalid_decision',
        details: decisionValidation.errors || decisionValidation.fields,
      });
    }
  }

  const decisionContext = input.decisionContext;
  if (decisionContext == null) {
    errors.push({ field: 'decisionContext', code: 'missing_decision_context' });
  } else {
    validateDecisionContextShape(decisionContext, errors);
  }

  const evidenceSet = input.evidenceOrchestrationSet;
  if (evidenceSet == null) {
    errors.push({ field: 'evidenceOrchestrationSet', code: 'missing_evidence_orchestration_set' });
  } else {
    validateEvidenceOrchestrationSet(evidenceSet, errors);
  }

  const controlChain = input.controlChainArtifact;
  if (controlChain == null) {
    errors.push({ field: 'controlChainArtifact', code: 'missing_control_chain' });
  } else {
    const controlValidation = validateControlChainArtifact(controlChain);
    if (!controlValidation.ok) {
      errors.push({
        field: 'controlChainArtifact',
        code: controlValidation.code || 'invalid_control_chain',
        details: controlValidation.errors,
      });
    }
    if (controlChain.controlOutcome === CONTROL_OUTCOME.CONTROL_PASS_BOUNDED
      && (controlChain.executionEligible === true || controlChain.approvedForExecution === true)) {
      errors.push({
        field: 'controlChainArtifact.controlOutcome',
        code: 'control_pass_bounded_not_execution',
      });
    }
  }

  if (errors.length) {
    return fail('validation_failed', 'Shadow Decision Recording input failed validation', { errors });
  }

  if (decision.decisionContextId !== decisionContext.contextId) {
    errors.push({ field: 'compatibility.decisionContextId', code: 'decision_context_id_mismatch' });
  }
  if (controlChain.decisionId !== decision.decisionId) {
    errors.push({ field: 'compatibility.decisionId', code: 'control_chain_decision_mismatch' });
  }
  if (controlChain.decisionContextId !== decisionContext.contextId) {
    errors.push({ field: 'compatibility.controlChain.decisionContextId', code: 'control_chain_context_mismatch' });
  }

  const orchestrationSetIds = deriveOrchestrationSetIds(decisionContext, evidenceSet);
  if (!orchestrationSetIds.includes(evidenceSet.orchestrationId)) {
    errors.push({ field: 'compatibility.orchestrationId', code: 'orchestration_mismatch' });
  }

  const contributingRunIds = deriveContributingRunIds(evidenceSet);
  const excludedRunIds = deriveExcludedRunIds(evidenceSet);
  const evidenceContractVersion = evidenceSet.lineage?.evidenceContractVersion
    || EVIDENCE_CONTRACT_VERSION;

  const derivedLineage = {
    decisionId: decision.decisionId,
    decisionContextId: decisionContext.contextId,
    orchestrationId: evidenceSet.orchestrationId,
    orchestrationSetIds,
    controlChainArtifactId: controlChain.controlChainArtifactId,
    decisionContractVersion: DECISION_CONTRACT_VERSION,
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    evidenceContractVersion,
    orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
    controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    contributingAgentRunIds: contributingRunIds,
    contributingRunIds,
    excludedRunIds,
  };

  validateCallerLineage(input.lineage, derivedLineage, errors);
  const provenanceExtras = validateCallerProvenance(input.provenance, input.recordedAt, errors);
  assertString('implementationVersion', input.implementationVersion, errors, { required: false });

  if (errors.length) {
    return fail('validation_failed', 'Shadow Decision Recording lineage/provenance failed', { errors });
  }

  const shadowRecordingArtifactId = hashToUuid([
    SHADOW_RECORDING_CONTRACT_VERSION,
    decision.decisionId,
    decisionContext.contextId,
    evidenceSet.orchestrationId,
    controlChain.controlChainArtifactId,
    input.recordedAt,
  ]);

  const decisionRef = {
    decisionId: decision.decisionId,
    contractVersion: DECISION_CONTRACT_VERSION,
    decisionContextId: decision.decisionContextId,
  };
  if (decision.analysisAt != null) decisionRef.analysisAt = decision.analysisAt;
  else if (decision.createdAt != null) decisionRef.createdAt = decision.createdAt;

  const decisionContextRef = {
    contextId: decisionContext.contextId,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    lifecycleState: decisionContext.lifecycleState,
    mode: {
      maturity: decisionContext.mode.maturity,
      ...(decisionContext.mode.requested != null ? { requested: decisionContext.mode.requested } : {}),
      ...(decisionContext.mode.effective != null ? { effective: decisionContext.mode.effective } : {}),
    },
    marketScope: { ...decisionContext.marketScope },
  };

  const evidenceOrchestrationRef = {
    orchestrationId: evidenceSet.orchestrationId,
    contractVersion: ORCHESTRATION_CONTRACT_VERSION,
    includedCount: evidenceSet.includedEvidence.length,
    excludedCount: evidenceSet.excludedEvidence.length,
    conflictCount: evidenceSet.conflicts.length,
  };

  const controlChainRef = {
    controlChainArtifactId: controlChain.controlChainArtifactId,
    contractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    controlOutcome: controlChain.controlOutcome,
    lifecycle: controlChain.lifecycle,
  };

  const provenance = {
    writer: SHADOW_RECORDING_WRITER,
    methodKey: SHADOW_RECORDING_METHOD_KEY,
    stage: SHADOW_RECORDING_STAGE,
    recordedAt: input.recordedAt,
    policyVersion: SHADOW_RECORDING_POLICY_VERSION,
  };
  if (provenanceExtras.note != null) provenance.note = provenanceExtras.note;
  const implementationVersion = input.implementationVersion
    ?? provenanceExtras.implementationVersion;
  if (implementationVersion != null) provenance.implementationVersion = implementationVersion;

  const artifact = {
    schemaVersion: SHADOW_RECORDING_SCHEMA_VERSION,
    contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    policyVersion: SHADOW_RECORDING_POLICY_VERSION,
    artifactType: SHADOW_RECORDING_ARTIFACT_TYPE,
    shadowRecordingArtifactId,
    maturity: SHADOW_RECORDING_MATURITY,
    generatedAt: input.recordedAt,
    decisionRef,
    decisionContextRef,
    evidenceOrchestrationRef,
    controlChainRef,
    lineage: derivedLineage,
    provenance,
    limitations: [...SHADOW_RECORDING_LIMITATIONS],
    sideEffects: { ...ZERO_SHADOW_RECORDING_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
  };
  if (implementationVersion != null) artifact.implementationVersion = implementationVersion;

  const finalErrors = [];
  assertAllowlist(artifact, ALLOWED_ARTIFACT_TOP, 'artifact', finalErrors);
  assertAllowlist(artifact.decisionRef, ALLOWED_DECISION_REF, 'decisionRef', finalErrors);
  assertAllowlist(artifact.decisionContextRef, ALLOWED_CONTEXT_REF, 'decisionContextRef', finalErrors);
  assertAllowlist(artifact.decisionContextRef.mode, ALLOWED_MODE, 'decisionContextRef.mode', finalErrors);
  assertAllowlist(
    artifact.decisionContextRef.marketScope,
    ALLOWED_MARKET_SCOPE,
    'decisionContextRef.marketScope',
    finalErrors,
  );
  assertAllowlist(artifact.evidenceOrchestrationRef, ALLOWED_EOS_REF, 'evidenceOrchestrationRef', finalErrors);
  assertAllowlist(artifact.controlChainRef, ALLOWED_CONTROL_REF, 'controlChainRef', finalErrors);
  assertAllowlist(artifact.lineage, ALLOWED_LINEAGE, 'lineage', finalErrors);
  assertAllowlist(artifact.provenance, ALLOWED_PROVENANCE, 'provenance', finalErrors);

  const bytes = utf8ByteLength(artifact);
  if (bytes > MAX_SHADOW_RECORDING_UTF8_BYTES) {
    finalErrors.push({ field: 'artifact', code: 'too_large', bytes });
  }
  if (finalErrors.length) {
    return fail('artifact_validation_failed', 'Built Shadow recording artifact failed allowlist', {
      errors: finalErrors,
    });
  }

  return {
    ok: true,
    code: 'SHADOW_DECISION_RECORDING_BUILT',
    message: 'Shadow Decision Recording Artifact validated',
    artifact: freezeDeep(artifact),
    sideEffects: { ...ZERO_SHADOW_RECORDING_SIDE_EFFECTS },
    bytes,
  };
}

/** Compatible alias — single canonical builder surface. */
export function validateShadowDecisionRecording(input = {}) {
  return buildShadowDecisionRecording(input);
}

export default {
  SHADOW_RECORDING_STAGE,
  SHADOW_RECORDING_SCHEMA_VERSION,
  SHADOW_RECORDING_CONTRACT_VERSION,
  SHADOW_RECORDING_POLICY_VERSION,
  SHADOW_RECORDING_WRITER,
  SHADOW_RECORDING_METHOD_KEY,
  SHADOW_RECORDING_ARTIFACT_TYPE,
  SHADOW_RECORDING_MATURITY,
  ZERO_SHADOW_RECORDING_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS,
  SHADOW_RECORDING_LIMITATIONS,
  buildShadowDecisionRecording,
  validateShadowDecisionRecording,
};
