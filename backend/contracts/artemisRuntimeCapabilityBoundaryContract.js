/**
 * Artemis Core Stage 7.3.2.c.5 — Runtime Capability / RUNTIME_SAFETY boundary.
 *
 * Library-only projector that converts allowlisted, truthful runtime evidence into
 * the exact runtimeSnapshot shape required by artemisControlChainContract.js
 * (Stage 7.3.1) for runtimeGate evaluation.
 *
 * Canonical Runtime SoT (identity only — not imported for I/O):
 *   - backend/services/runtimeExecutionStateService.js
 *
 * Does NOT:
 *   - invent BUY/SELL/LONG/SHORT or trading thesis
 *   - clear Emergency Stop / change runtime mode / enable Live
 *   - authorize execution / place orders / mutate wallet
 *   - call LLM / provider / HTTP / network
 *   - access DB / Redis
 *   - require or emit workerAcknowledgement
 *   - wire Control Chain runtime / orchestrator / routes
 *   - import runtimeExecutionStateService for I/O
 *   - call setGlobalRuntimeMode / activateKillSwitch / clearKillSwitch /
 *     acknowledgeWorkerState
 *
 * Placement:
 *   runtimeEvidence (allowlisted)
 *     → this projector → runtimeSnapshot
 *     → Control Chain runtimeGate (NOT wired here)
 */

import {
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  EFFECTIVE_RUNTIME_MODE,
  REQUESTED_RUNTIME_MODE,
} from './artemisDecisionContextContract.js';
import {
  CAPABILITY_STATE,
  CONTROL_CHAIN_CONTRACT_VERSION,
  FORBIDDEN_CONTROL_CHAIN_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  RUNTIME_GATE_OUTCOME,
  ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
} from './artemisControlChainContract.js';

export const RUNTIME_CAPABILITY_STAGE = '7.3.2.c.5';
export const RUNTIME_CAPABILITY_SCHEMA_VERSION = '1.0.0';
export const RUNTIME_CAPABILITY_CONTRACT_VERSION = 'artemis-runtime-capability-boundary-1.0.0';
export const RUNTIME_CAPABILITY_POLICY_VERSION = 'stage7-3-2-c5-runtime-capability-1.0.0';
export const RUNTIME_CAPABILITY_WRITER = 'artemisRuntimeCapabilityBoundaryContract';
export const RUNTIME_CAPABILITY_METHOD_KEY = 'project_runtime_snapshot_fail_closed';

/** Slice authority label — does NOT modify shared AUTHORITY_CLASS definitions. */
export const SLICE_AUTHORITY = 'RUNTIME_SAFETY';

/** Control Chain gate authority string (must remain exact). */
export const RUNTIME_GATE_AUTHORITY = 'titangold_runtime_safety_ssot';

export const CANONICAL_RUNTIME_SSOT_OWNER = 'runtimeExecutionStateService';

export const REQUIRED_CONTROL_CHAIN_CONTRACT_VERSION = CONTROL_CHAIN_CONTRACT_VERSION;
export const REQUIRED_EVIDENCE_CONTRACT_VERSION = EVIDENCE_CONTRACT_VERSION;

export const MAX_PROJECTOR_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 512;

/** Non-LIVE modes allowed as requested/effective evaluation states. */
export const ALLOWED_NON_LIVE_RUNTIME_MODES = Object.freeze([
  REQUESTED_RUNTIME_MODE.ADVISORY,
  REQUESTED_RUNTIME_MODE.DEMO,
  REQUESTED_RUNTIME_MODE.DRY_RUN,
  REQUESTED_RUNTIME_MODE.SHADOW,
  REQUESTED_RUNTIME_MODE.PAPER,
]);

const ALLOWED_NON_LIVE_MODE_SET = new Set(ALLOWED_NON_LIVE_RUNTIME_MODES);
const ALLOWED_EFFECTIVE_MODE_SET = new Set(Object.values(EFFECTIVE_RUNTIME_MODE));

export const ZERO_RUNTIME_CAPABILITY_SIDE_EFFECTS = Object.freeze({
  ...ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
  llmCallCount: 0,
  networkRequestCount: 0,
  dbWriteCount: 0,
  redisWriteCount: 0,
  runtimeMutationCount: 0,
  emergencyStopClearCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  agentExecutionCount: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  liveTradingEnabled: false,
  providerConnected: false,
  llmCallCount: 0,
  networkRequestCount: 0,
  dbWriteCount: 0,
  redisWriteCount: 0,
  runtimeMutationCount: 0,
  emergencyStopClearCount: 0,
});

export const RUNTIME_CAPABILITY_LIMITATIONS = Object.freeze([
  'stage7_3_2_c5_runtime_capability_boundary_only',
  'library_only',
  'runtime_safety_only',
  'does_not_authorize_execution',
  'does_not_clear_emergency_stop',
  'does_not_change_runtime_mode',
  'does_not_require_worker_acknowledgement',
  'does_not_call_llm_or_network',
  'does_not_access_db_or_redis',
  'does_not_wire_control_chain_runtime',
  'live_trading_not_authorized',
  'canonical_runtime_ssot_identity_only',
  'does_not_import_runtime_execution_state_service_for_io',
]);

/** Control-Chain-compatible runtimeSnapshot fields (exact allowlist). */
export const ALLOWED_RUNTIME_SNAPSHOT_FIELDS = Object.freeze([
  'killSwitchActive',
  'requestedRuntimeMode',
  'effectiveRuntimeMode',
  'capabilityState',
  'ssotAvailable',
  'ssotOwner',
]);

export const ALLOWED_RUNTIME_EVIDENCE_FIELDS = ALLOWED_RUNTIME_SNAPSHOT_FIELDS;

export const ALLOWED_INPUT_TOP = Object.freeze([
  'runtimeEvidence',
  'decisionId',
  'decisionContextId',
  'runId',
  'recordedAt',
  'sourceContractVersion',
  'orchestrationSetIds',
  'contributingAgentRunIds',
  'lineage',
  'provenance',
]);

export const ALLOWED_LINEAGE = Object.freeze([
  'decisionId',
  'decisionContextId',
  'runId',
  'contributingAgentRunIds',
  'orchestrationSetIds',
  'sourceContractVersion',
  'evidenceContractVersion',
  'controlChainContractVersion',
  'projectorContractVersion',
  'policyVersion',
  'agentId',
  'sourceEvidenceId',
]);

export const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'note',
  'sourceWriter',
  'sourceMethodKey',
  'sourceProviderId',
  'sourceEvidenceIdentity',
]);

const DIRECTION_FORBIDDEN_KEYS = Object.freeze([
  'direction',
  'thesis',
  'BUY',
  'SELL',
  'LONG',
  'SHORT',
  'buy',
  'sell',
  'long',
  'short',
]);

const EXTRA_FORBIDDEN_KEYS = Object.freeze([
  ...FORBIDDEN_CONTROL_CHAIN_KEYS,
  'orderId',
  'executionIntent',
  'walletAction',
  'wallet',
  'order',
  'orders',
  'trade',
  'votes',
  'execution',
  'approvedForExecution',
  'executionEligible',
  'decisionEligible',
  'liveTradingEnabled',
  'workerAcknowledgement',
  'workerAck',
  'acknowledgeWorkerState',
  'setGlobalRuntimeMode',
  'activateKillSwitch',
  'clearKillSwitch',
  'redis',
  'cache',
  'redisKey',
  'redisWrite',
  'votes',
  'majority',
  'weightedVote',
  'consensus',
  'MixtureOfExperts',
  'MoE',
  'ModelAssistedContribution',
  'modelAssistedContribution',
  'providerPayload',
  'credentials',
  'apiKey',
  'apiSecret',
  'prompt',
  'modelResponse',
]);

const LEGACY_MOE_FORBIDDEN_KEYS = Object.freeze([
  'MixtureOfExperts',
  'MoE',
  'moe',
  'moeVotes',
  'expertVotes',
]);

const MODEL_ASSISTED_FORBIDDEN_KEYS = Object.freeze([
  'ModelAssistedContribution',
  'modelAssistedContribution',
  'modelAssisted',
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function assertAllowlist(obj, allowed, field, errors) {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push({ field, code: 'required_object' });
    return false;
  }
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(obj)) {
    if (!allowedSet.has(key)) {
      errors.push({ field: `${field}.${key}`, code: 'unknown_field' });
    }
  }
  return true;
}

function assertString(field, value, errors) {
  if (value == null) return;
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_STRING_CHARS) {
    errors.push({ field, code: 'invalid_string' });
  }
}

function inEnum(value, enumObj) {
  return Object.values(enumObj).includes(value);
}

function sameStringArray(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function collectKeysDeep(value, path = '', out = []) {
  if (value == null || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectKeysDeep(item, `${path}[${index}]`, out));
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    out.push({ key, path: next });
    collectKeysDeep(child, next, out);
  }
  return out;
}

function collectStringValuesDeep(value, path = '', out = []) {
  if (typeof value === 'string') {
    out.push({ value, path });
    return out;
  }
  if (value == null || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStringValuesDeep(item, `${path}[${index}]`, out));
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    collectStringValuesDeep(child, next, out);
  }
  return out;
}

function killSwitchState(value) {
  if (value === true) return true;
  if (value === false) return false;
  return 'unknown';
}

/**
 * Mirror of Control Chain deriveRuntimeGate semantics for library preview only.
 * Does not modify artemisControlChainContract.js.
 */
export function previewRuntimeGate(snapshot) {
  const requested = snapshot?.requestedRuntimeMode ?? EFFECTIVE_RUNTIME_MODE.ADVISORY;
  const effective = snapshot?.effectiveRuntimeMode ?? EFFECTIVE_RUNTIME_MODE.ADVISORY;
  const kill = snapshot ? killSwitchState(snapshot.killSwitchActive) : 'unknown';
  const capability = snapshot?.capabilityState ?? CAPABILITY_STATE.UNKNOWN;
  const ssotAvailable = snapshot ? snapshot.ssotAvailable === true : false;
  let outcome = RUNTIME_GATE_OUTCOME.CLEAR;
  let reasonKey = 'runtime_gate_contract_only';
  if (kill === true) {
    outcome = RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED;
    reasonKey = 'kill_switch_active';
  } else if (kill === 'unknown') {
    outcome = RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED;
    reasonKey = 'kill_switch_unknown';
  } else if (!ssotAvailable) {
    outcome = RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED;
    reasonKey = 'runtime_ssot_unavailable';
  } else if (effective == null || capability === CAPABILITY_STATE.UNKNOWN) {
    outcome = RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED;
    reasonKey = capability === CAPABILITY_STATE.UNKNOWN ? 'capability_unknown' : 'effective_mode_unknown';
  } else if (capability === CAPABILITY_STATE.DENIED) {
    outcome = RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED;
    reasonKey = 'capability_denied';
  }
  return {
    authorityClass: RUNTIME_GATE_AUTHORITY,
    outcome,
    killSwitchActive: kill,
    requestedRuntimeMode: requested,
    effectiveRuntimeMode: effective,
    capabilityState: capability,
    ssotAvailable,
    ssotOwner: snapshot?.ssotOwner ?? CANONICAL_RUNTIME_SSOT_OWNER,
    reasonKey,
  };
}

function validateRuntimeEvidenceShape(evidence, errors) {
  if (evidence == null) {
    errors.push({ field: 'runtimeEvidence', code: 'missing_runtime_evidence' });
    return null;
  }
  if (!assertAllowlist(evidence, ALLOWED_RUNTIME_EVIDENCE_FIELDS, 'runtimeEvidence', errors)) {
    return null;
  }

  for (const field of ALLOWED_RUNTIME_EVIDENCE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(evidence, field)) {
      errors.push({ field: `runtimeEvidence.${field}`, code: 'missing_field' });
    }
  }

  const kill = evidence.killSwitchActive;
  if (kill !== true && kill !== false && kill !== 'unknown') {
    errors.push({ field: 'runtimeEvidence.killSwitchActive', code: 'invalid_kill_switch' });
  }

  if (evidence.requestedRuntimeMode === REQUESTED_RUNTIME_MODE.LIVE
    || evidence.requestedRuntimeMode === 'live') {
    errors.push({ field: 'runtimeEvidence.requestedRuntimeMode', code: 'live_runtime_mode_rejected' });
  } else if (evidence.requestedRuntimeMode != null
    && !ALLOWED_NON_LIVE_MODE_SET.has(evidence.requestedRuntimeMode)) {
    errors.push({ field: 'runtimeEvidence.requestedRuntimeMode', code: 'invalid_runtime_mode' });
  }

  if (evidence.effectiveRuntimeMode === REQUESTED_RUNTIME_MODE.LIVE
    || evidence.effectiveRuntimeMode === 'live') {
    errors.push({ field: 'runtimeEvidence.effectiveRuntimeMode', code: 'live_runtime_mode_rejected' });
  } else if (evidence.effectiveRuntimeMode != null
    && !ALLOWED_EFFECTIVE_MODE_SET.has(evidence.effectiveRuntimeMode)) {
    errors.push({ field: 'runtimeEvidence.effectiveRuntimeMode', code: 'invalid_runtime_mode' });
  }

  if (evidence.capabilityState != null
    && !Object.values(CAPABILITY_STATE).includes(evidence.capabilityState)) {
    errors.push({ field: 'runtimeEvidence.capabilityState', code: 'invalid_capability_state' });
  }

  if (evidence.ssotAvailable != null && typeof evidence.ssotAvailable !== 'boolean') {
    errors.push({ field: 'runtimeEvidence.ssotAvailable', code: 'invalid_ssot_available' });
  }

  if (evidence.ssotOwner !== CANONICAL_RUNTIME_SSOT_OWNER) {
    errors.push({
      field: 'runtimeEvidence.ssotOwner',
      code: 'invalid_ssot_owner',
      expected: CANONICAL_RUNTIME_SSOT_OWNER,
    });
  }

  // Never fabricate granted — unknown/missing already covered by missing_field /
  // invalid_capability_state. Denied/unknown remain projectable as BLOCKED.
  return evidence;
}

function validateCallerLineage(lineage, errors, {
  decisionId,
  decisionContextId,
  runId,
  contributingAgentRunIds,
  orchestrationSetIds,
  sourceContractVersion,
} = {}) {
  if (lineage == null) return;
  if (!assertAllowlist(lineage, ALLOWED_LINEAGE, 'lineage', errors)) return;

  if (lineage.decisionId != null && !isCanonicalUuid(lineage.decisionId)) {
    errors.push({ field: 'lineage.decisionId', code: 'invalid_uuid' });
  }
  if (lineage.decisionContextId != null && !isCanonicalUuid(lineage.decisionContextId)) {
    errors.push({ field: 'lineage.decisionContextId', code: 'invalid_uuid' });
  }
  if (lineage.runId != null && !isCanonicalUuid(lineage.runId)) {
    errors.push({ field: 'lineage.runId', code: 'invalid_uuid' });
  }

  if (lineage.contributingAgentRunIds != null) {
    if (!Array.isArray(lineage.contributingAgentRunIds)) {
      errors.push({ field: 'lineage.contributingAgentRunIds', code: 'invalid_array' });
    } else {
      lineage.contributingAgentRunIds.forEach((id, index) => {
        if (!isCanonicalUuid(id)) {
          errors.push({ field: `lineage.contributingAgentRunIds[${index}]`, code: 'invalid_uuid' });
        }
      });
    }
  }

  if (lineage.orchestrationSetIds != null) {
    if (!Array.isArray(lineage.orchestrationSetIds)) {
      errors.push({ field: 'lineage.orchestrationSetIds', code: 'invalid_array' });
    } else {
      lineage.orchestrationSetIds.forEach((id, index) => {
        if (typeof id !== 'string' || !id.trim()) {
          errors.push({ field: `lineage.orchestrationSetIds[${index}]`, code: 'invalid_string' });
        }
      });
    }
  }

  assertString('lineage.sourceContractVersion', lineage.sourceContractVersion, errors);
  assertString('lineage.evidenceContractVersion', lineage.evidenceContractVersion, errors);
  assertString('lineage.controlChainContractVersion', lineage.controlChainContractVersion, errors);
  assertString('lineage.projectorContractVersion', lineage.projectorContractVersion, errors);
  assertString('lineage.policyVersion', lineage.policyVersion, errors);
  assertString('lineage.agentId', lineage.agentId, errors);
  assertString('lineage.sourceEvidenceId', lineage.sourceEvidenceId, errors);

  if (decisionId && lineage.decisionId && lineage.decisionId !== decisionId) {
    errors.push({ field: 'lineage.decisionId', code: 'lineage_decision_mismatch' });
  }
  if (decisionContextId && lineage.decisionContextId
    && lineage.decisionContextId !== decisionContextId) {
    errors.push({ field: 'lineage.decisionContextId', code: 'lineage_context_mismatch' });
  }
  if (runId && lineage.runId && lineage.runId !== runId) {
    errors.push({ field: 'lineage.runId', code: 'lineage_run_mismatch' });
  }

  if (Array.isArray(lineage.contributingAgentRunIds) && Array.isArray(contributingAgentRunIds)) {
    if (!sameStringArray(lineage.contributingAgentRunIds, contributingAgentRunIds)) {
      errors.push({
        field: 'lineage.contributingAgentRunIds',
        code: 'lineage_contributing_agent_run_mismatch',
      });
    }
  } else if (Array.isArray(lineage.contributingAgentRunIds) && contributingAgentRunIds == null) {
    // Allowed when only lineage carries the list.
  }

  if (Array.isArray(lineage.orchestrationSetIds)) {
    if (!Array.isArray(orchestrationSetIds)) {
      errors.push({
        field: 'lineage.orchestrationSetIds',
        code: 'lineage_orchestration_set_mismatch',
      });
    } else if (!sameStringArray(lineage.orchestrationSetIds, orchestrationSetIds)) {
      errors.push({
        field: 'lineage.orchestrationSetIds',
        code: 'lineage_orchestration_set_mismatch',
      });
    }
  }

  if (
    sourceContractVersion != null
    && typeof sourceContractVersion === 'string'
    && lineage.sourceContractVersion != null
    && typeof lineage.sourceContractVersion === 'string'
    && sourceContractVersion !== lineage.sourceContractVersion
  ) {
    errors.push({
      field: 'lineage.sourceContractVersion',
      code: 'lineage_source_contract_version_mismatch',
    });
  }

  if (lineage.evidenceContractVersion != null
    && lineage.evidenceContractVersion !== EVIDENCE_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.evidenceContractVersion',
      code: 'lineage_evidence_contract_version_mismatch',
      expected: EVIDENCE_CONTRACT_VERSION,
    });
  }

  if (lineage.controlChainContractVersion != null
    && lineage.controlChainContractVersion !== CONTROL_CHAIN_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.controlChainContractVersion',
      code: 'lineage_control_chain_contract_version_mismatch',
      expected: CONTROL_CHAIN_CONTRACT_VERSION,
    });
  }

  if (lineage.projectorContractVersion != null
    && lineage.projectorContractVersion !== RUNTIME_CAPABILITY_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.projectorContractVersion',
      code: 'lineage_projector_contract_version_mismatch',
      expected: RUNTIME_CAPABILITY_CONTRACT_VERSION,
    });
  }
}

function validateCallerProvenance(provenance, errors) {
  if (provenance == null) return;
  if (!assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors)) return;
  assertString('provenance.writer', provenance.writer, errors);
  assertString('provenance.methodKey', provenance.methodKey, errors);
  assertString('provenance.stage', provenance.stage, errors);
  assertString('provenance.note', provenance.note, errors);
  assertString('provenance.sourceWriter', provenance.sourceWriter, errors);
  assertString('provenance.sourceMethodKey', provenance.sourceMethodKey, errors);
  assertString('provenance.sourceProviderId', provenance.sourceProviderId, errors);
  assertString('provenance.sourceEvidenceIdentity', provenance.sourceEvidenceIdentity, errors);
  if (provenance.recordedAt != null && !isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_timestamp' });
  }

  // Reject spoofed canonical projector identity.
  if (provenance.writer === RUNTIME_CAPABILITY_WRITER
    && provenance.methodKey != null
    && provenance.methodKey !== RUNTIME_CAPABILITY_METHOD_KEY) {
    errors.push({ field: 'provenance.methodKey', code: 'provenance_mismatch' });
  }
  if (provenance.methodKey === RUNTIME_CAPABILITY_METHOD_KEY
    && provenance.writer != null
    && provenance.writer !== RUNTIME_CAPABILITY_WRITER) {
    errors.push({ field: 'provenance.writer', code: 'provenance_mismatch' });
  }
  if (provenance.stage != null
    && provenance.writer === RUNTIME_CAPABILITY_WRITER
    && provenance.stage !== RUNTIME_CAPABILITY_STAGE) {
    errors.push({ field: 'provenance.stage', code: 'provenance_mismatch' });
  }
}

/**
 * Validate projector input without projecting.
 */
export function validateRuntimeCapabilityInput(input) {
  const errors = [];
  const inputIsObject = Boolean(input) && typeof input === 'object' && !Array.isArray(input);
  if (!inputIsObject) {
    errors.push({ field: 'input', code: 'required_object' });
    return fail('INVALID_INPUT', 'Runtime capability input failed allowlist validation', { errors });
  }

  assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors);

  const allKeys = collectKeysDeep(input);
  for (const { key, path } of allKeys) {
    if (EXTRA_FORBIDDEN_KEYS.includes(key) || LEGACY_MOE_FORBIDDEN_KEYS.includes(key)
      || MODEL_ASSISTED_FORBIDDEN_KEYS.includes(key)) {
      let code = 'forbidden_key';
      if (LEGACY_MOE_FORBIDDEN_KEYS.includes(key)) code = 'legacy_moe_forbidden';
      else if (MODEL_ASSISTED_FORBIDDEN_KEYS.includes(key)) code = 'model_assisted_forbidden';
      else if (key === 'orderId' || key === 'executionIntent' || key === 'walletAction'
        || FORBIDDEN_CONTROL_CHAIN_KEYS.includes(key)
        || key === 'order' || key === 'wallet' || key === 'execution') {
        code = 'execution_contamination';
      } else if (key === 'redis' || key === 'cache' || key === 'redisKey' || key === 'redisWrite') {
        code = 'redis_contamination';
      } else if (key === 'votes' || key === 'majority' || key === 'weightedVote' || key === 'consensus') {
        code = 'vote_contamination';
      }
      errors.push({ field: path || key, code });
    }
    if (DIRECTION_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: path || key, code: 'direction_forbidden' });
    }
  }

  const forbiddenSecrets = collectForbiddenSecretKeys(input);
  for (const key of forbiddenSecrets) {
    errors.push({ field: key, code: 'forbidden_secret_key' });
  }

  const authorityValues = collectStringValuesDeep(input);
  for (const { value, path } of authorityValues) {
    if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
      errors.push({ field: path || 'value', code: 'execution_authority_forbidden', value });
    }
  }

  if (input.decisionId != null && !isCanonicalUuid(input.decisionId)) {
    errors.push({ field: 'decisionId', code: 'invalid_uuid' });
  }
  if (input.decisionContextId != null && !isCanonicalUuid(input.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (input.runId != null && !isCanonicalUuid(input.runId)) {
    errors.push({ field: 'runId', code: 'invalid_uuid' });
  }
  if (input.recordedAt != null && !isIsoTimestamp(input.recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'invalid_timestamp' });
  }
  assertString('sourceContractVersion', input.sourceContractVersion, errors);

  if (input.orchestrationSetIds != null) {
    if (!Array.isArray(input.orchestrationSetIds)) {
      errors.push({ field: 'orchestrationSetIds', code: 'invalid_array' });
    } else {
      input.orchestrationSetIds.forEach((id, index) => {
        if (typeof id !== 'string' || !id.trim()) {
          errors.push({ field: `orchestrationSetIds[${index}]`, code: 'invalid_string' });
        }
      });
    }
  }

  if (input.contributingAgentRunIds != null) {
    if (!Array.isArray(input.contributingAgentRunIds)) {
      errors.push({ field: 'contributingAgentRunIds', code: 'invalid_array' });
    } else {
      input.contributingAgentRunIds.forEach((id, index) => {
        if (!isCanonicalUuid(id)) {
          errors.push({ field: `contributingAgentRunIds[${index}]`, code: 'invalid_uuid' });
        }
      });
    }
  }

  validateRuntimeEvidenceShape(input.runtimeEvidence, errors);

  validateCallerLineage(input.lineage, errors, {
    decisionId: input.decisionId,
    decisionContextId: input.decisionContextId,
    runId: input.runId,
    contributingAgentRunIds: input.contributingAgentRunIds,
    orchestrationSetIds: input.orchestrationSetIds,
    sourceContractVersion: input.sourceContractVersion,
  });
  validateCallerProvenance(input.provenance, errors);

  if (utf8ByteLength(input) > MAX_PROJECTOR_UTF8_BYTES) {
    errors.push({ field: 'input', code: 'payload_too_large', max: MAX_PROJECTOR_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('INVALID_INPUT', 'Runtime capability input validation failed', { errors });
  }
  return { ok: true };
}

function buildLineage(input) {
  const lineage = {
    projectorContractVersion: RUNTIME_CAPABILITY_CONTRACT_VERSION,
    policyVersion: RUNTIME_CAPABILITY_POLICY_VERSION,
    controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    evidenceContractVersion: input.lineage?.evidenceContractVersion
      ?? input.sourceContractVersion
      ?? EVIDENCE_CONTRACT_VERSION,
    sliceAuthority: SLICE_AUTHORITY,
  };
  if (input.decisionId != null) lineage.decisionId = input.decisionId;
  if (input.decisionContextId != null) lineage.decisionContextId = input.decisionContextId;
  if (input.runId != null) lineage.runId = input.runId;
  if (input.lineage?.decisionId != null) lineage.decisionId = input.lineage.decisionId;
  if (input.lineage?.decisionContextId != null) {
    lineage.decisionContextId = input.lineage.decisionContextId;
  }
  if (input.lineage?.runId != null && lineage.runId == null) lineage.runId = input.lineage.runId;

  if (Array.isArray(input.contributingAgentRunIds)) {
    lineage.contributingAgentRunIds = [...input.contributingAgentRunIds];
  } else if (Array.isArray(input.lineage?.contributingAgentRunIds)) {
    lineage.contributingAgentRunIds = [...input.lineage.contributingAgentRunIds];
  }
  if (Array.isArray(input.orchestrationSetIds)) {
    lineage.orchestrationSetIds = [...input.orchestrationSetIds];
  } else if (Array.isArray(input.lineage?.orchestrationSetIds)) {
    lineage.orchestrationSetIds = [...input.lineage.orchestrationSetIds];
  }

  const sourceContractVersion = input.sourceContractVersion ?? input.lineage?.sourceContractVersion;
  if (sourceContractVersion != null) lineage.sourceContractVersion = sourceContractVersion;
  if (input.lineage?.sourceEvidenceId != null) {
    lineage.sourceEvidenceId = input.lineage.sourceEvidenceId;
  }
  if (input.lineage?.agentId != null) lineage.agentId = input.lineage.agentId;
  return lineage;
}

function buildProvenance(input) {
  const recordedAt = input.provenance?.recordedAt ?? input.recordedAt;
  const provenance = {
    writer: RUNTIME_CAPABILITY_WRITER,
    methodKey: RUNTIME_CAPABILITY_METHOD_KEY,
    stage: RUNTIME_CAPABILITY_STAGE,
    recordedAt,
  };
  if (input.provenance?.sourceWriter != null) {
    provenance.sourceWriter = input.provenance.sourceWriter;
  } else if (input.provenance?.writer != null
    && input.provenance.writer !== RUNTIME_CAPABILITY_WRITER) {
    provenance.sourceWriter = input.provenance.writer;
  }
  if (input.provenance?.sourceMethodKey != null) {
    provenance.sourceMethodKey = input.provenance.sourceMethodKey;
  } else if (input.provenance?.methodKey != null
    && input.provenance.methodKey !== RUNTIME_CAPABILITY_METHOD_KEY) {
    provenance.sourceMethodKey = input.provenance.methodKey;
  }
  if (input.provenance?.sourceProviderId != null) {
    provenance.sourceProviderId = input.provenance.sourceProviderId;
  }
  if (input.provenance?.sourceEvidenceIdentity != null) {
    provenance.sourceEvidenceIdentity = input.provenance.sourceEvidenceIdentity;
  }
  if (input.provenance?.note != null) provenance.note = input.provenance.note;
  return provenance;
}

/**
 * Project allowlisted runtimeEvidence into Control-Chain-compatible runtimeSnapshot.
 *
 * @param {object} input
 * @returns {{ ok: true, artifact: object } | { ok: false, code: string, message: string, errors?: object[] }}
 */
export function projectRuntimeSnapshot(input = {}) {
  const validated = validateRuntimeCapabilityInput(input);
  if (!validated.ok) return validated;

  const evidence = input.runtimeEvidence;
  const runtimeSnapshot = {
    killSwitchActive: evidence.killSwitchActive,
    requestedRuntimeMode: evidence.requestedRuntimeMode,
    effectiveRuntimeMode: evidence.effectiveRuntimeMode,
    capabilityState: evidence.capabilityState,
    ssotAvailable: evidence.ssotAvailable,
    ssotOwner: evidence.ssotOwner,
  };

  const runtimeGatePreview = previewRuntimeGate(runtimeSnapshot);

  const artifact = {
    schemaVersion: RUNTIME_CAPABILITY_SCHEMA_VERSION,
    contractVersion: RUNTIME_CAPABILITY_CONTRACT_VERSION,
    policyVersion: RUNTIME_CAPABILITY_POLICY_VERSION,
    stage: RUNTIME_CAPABILITY_STAGE,
    sliceAuthority: SLICE_AUTHORITY,
    runtimeGateAuthority: RUNTIME_GATE_AUTHORITY,
    runtimeSnapshot,
    runtimeGatePreview,
    lineage: buildLineage(input),
    provenance: buildProvenance(input),
    limitations: [...RUNTIME_CAPABILITY_LIMITATIONS],
    sideEffects: { ...ZERO_RUNTIME_CAPABILITY_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
  };

  if (utf8ByteLength(artifact) > MAX_PROJECTOR_UTF8_BYTES) {
    return fail('PAYLOAD_TOO_LARGE', 'Projected Runtime Capability artifact exceeds size bound', {
      errors: [{ field: 'artifact', code: 'payload_too_large', max: MAX_PROJECTOR_UTF8_BYTES }],
    });
  }

  return { ok: true, artifact };
}

/**
 * Validate a projected runtimeSnapshot against Control Chain allowlist rules
 * without invoking the full control-chain builder.
 */
export function validateProjectedRuntimeSnapshot(snapshot) {
  const errors = [];
  if (!assertAllowlist(snapshot, ALLOWED_RUNTIME_SNAPSHOT_FIELDS, 'runtimeSnapshot', errors)) {
    return fail('INVALID_SNAPSHOT', 'Projected runtimeSnapshot failed allowlist', { errors });
  }

  const kill = snapshot.killSwitchActive;
  if (kill !== true && kill !== false && kill !== 'unknown') {
    errors.push({ field: 'runtimeSnapshot.killSwitchActive', code: 'invalid_kill_switch' });
  }
  if (snapshot.requestedRuntimeMode === REQUESTED_RUNTIME_MODE.LIVE
    || snapshot.effectiveRuntimeMode === REQUESTED_RUNTIME_MODE.LIVE
    || snapshot.requestedRuntimeMode === 'live'
    || snapshot.effectiveRuntimeMode === 'live') {
    errors.push({ field: 'runtimeSnapshot', code: 'live_runtime_mode_rejected' });
  }
  if (snapshot.requestedRuntimeMode != null
    && !ALLOWED_NON_LIVE_MODE_SET.has(snapshot.requestedRuntimeMode)
    && snapshot.requestedRuntimeMode !== REQUESTED_RUNTIME_MODE.LIVE) {
    errors.push({ field: 'runtimeSnapshot.requestedRuntimeMode', code: 'invalid_runtime_mode' });
  }
  if (snapshot.effectiveRuntimeMode != null
    && !ALLOWED_EFFECTIVE_MODE_SET.has(snapshot.effectiveRuntimeMode)
    && snapshot.effectiveRuntimeMode !== REQUESTED_RUNTIME_MODE.LIVE) {
    errors.push({ field: 'runtimeSnapshot.effectiveRuntimeMode', code: 'invalid_runtime_mode' });
  }
  if (snapshot.capabilityState != null
    && !Object.values(CAPABILITY_STATE).includes(snapshot.capabilityState)) {
    errors.push({ field: 'runtimeSnapshot.capabilityState', code: 'invalid_capability_state' });
  }
  if (snapshot.ssotAvailable != null && typeof snapshot.ssotAvailable !== 'boolean') {
    errors.push({ field: 'runtimeSnapshot.ssotAvailable', code: 'invalid_ssot_available' });
  }
  if (snapshot.ssotOwner !== CANONICAL_RUNTIME_SSOT_OWNER) {
    errors.push({
      field: 'runtimeSnapshot.ssotOwner',
      code: 'invalid_ssot_owner',
      expected: CANONICAL_RUNTIME_SSOT_OWNER,
    });
  }

  // workerAcknowledgement must never appear on the snapshot.
  if (Object.prototype.hasOwnProperty.call(snapshot, 'workerAcknowledgement')) {
    errors.push({ field: 'runtimeSnapshot.workerAcknowledgement', code: 'unknown_field' });
  }

  if (errors.length) {
    return fail('INVALID_SNAPSHOT', 'Projected runtimeSnapshot validation failed', { errors });
  }
  return { ok: true };
}

export default {
  RUNTIME_CAPABILITY_STAGE,
  RUNTIME_CAPABILITY_SCHEMA_VERSION,
  RUNTIME_CAPABILITY_CONTRACT_VERSION,
  RUNTIME_CAPABILITY_POLICY_VERSION,
  RUNTIME_CAPABILITY_WRITER,
  RUNTIME_CAPABILITY_METHOD_KEY,
  SLICE_AUTHORITY,
  RUNTIME_GATE_AUTHORITY,
  CANONICAL_RUNTIME_SSOT_OWNER,
  projectRuntimeSnapshot,
  validateRuntimeCapabilityInput,
  validateProjectedRuntimeSnapshot,
  previewRuntimeGate,
};
