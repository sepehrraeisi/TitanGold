/**
 * Artemis Core Stage 7.3.2.c.2 — Risk Control Chain Runtime Integration Boundary.
 *
 * Library-only boundary between Stage 7.3.2.c.1 Risk Gate → Control Chain
 * integration output and a future runtime/application consumer.
 *
 * Does NOT:
 *   - arm or start Control Chain runtime
 *   - authorize execution / orders / trades
 *   - call Portfolio / Liquidity / Order / Runtime owners
 *   - import legacy Risk service modules or Agent Risk entrypoints
 *   - import legacy Artemis orchestrator or MoE consensus
 *   - invent BUY/SELL/direction/thesis/execution approval
 *   - call LLM / provider / HTTP / network
 *   - mutate DB / Redis
 *   - modify Stage 7.3.1 / 7.3.2.a / 7.3.2.b / 7.3.2.c.1 contracts
 *
 * Architectural separation (hard):
 *   Risk PASS ≠ Execution Approved ≠ Order Authorized ≠ Trade Executed
 */

import {
  AUTHORITY_CLASS,
  FRESHNESS_STATUS,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  CONTROL_CHAIN_CONTRACT_VERSION,
  CONTROL_CHAIN_POLICY_VERSION,
  CONTROL_CHAIN_SCHEMA_VERSION,
  CONTROL_CHAIN_STAGE,
  CONTROL_OUTCOME,
  FORBIDDEN_CONTROL_CHAIN_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  RISK_GATE_OUTCOME,
  ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
  validateControlChainArtifact,
} from './artemisControlChainContract.js';
import {
  RISK_GATE_INTEGRATION_CONTRACT_VERSION,
  RISK_GATE_INTEGRATION_POLICY_VERSION,
  RISK_GATE_INTEGRATION_SCHEMA_VERSION,
  RISK_GATE_INTEGRATION_STAGE,
  ZERO_RISK_GATE_INTEGRATION_SIDE_EFFECTS,
} from './artemisRiskGateIntegrationContract.js';

export const RISK_CONTROL_RUNTIME_BOUNDARY_STAGE = '7.3.2.c.2';
export const RISK_CONTROL_RUNTIME_BOUNDARY_SCHEMA_VERSION = '1.0.0';
export const RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION =
  'artemis-risk-control-runtime-boundary-1.0.0';
export const RISK_CONTROL_RUNTIME_BOUNDARY_POLICY_VERSION =
  'stage7-3-2c2-risk-control-runtime-boundary-1.0.0';
export const RISK_CONTROL_RUNTIME_BOUNDARY_WRITER =
  'artemisRiskControlRuntimeBoundaryContract';
export const RISK_CONTROL_RUNTIME_BOUNDARY_METHOD_KEY =
  'accept_risk_control_chain_runtime_boundary';

export const REQUIRED_CONTROL_CHAIN_STAGE = CONTROL_CHAIN_STAGE;
export const REQUIRED_CONTROL_CHAIN_CONTRACT_VERSION = CONTROL_CHAIN_CONTRACT_VERSION;
export const REQUIRED_CONTROL_CHAIN_SCHEMA_VERSION = CONTROL_CHAIN_SCHEMA_VERSION;
export const REQUIRED_CONTROL_CHAIN_POLICY_VERSION = CONTROL_CHAIN_POLICY_VERSION;
export const REQUIRED_INTEGRATION_STAGE = RISK_GATE_INTEGRATION_STAGE;
export const REQUIRED_INTEGRATION_CONTRACT_VERSION = RISK_GATE_INTEGRATION_CONTRACT_VERSION;

export const MAX_BOUNDARY_UTF8_BYTES = 48 * 1024;
export const MAX_STRING_CHARS = 512;
export const MAX_LIMITATIONS = 64;

/**
 * Explicit boundary disposition. Never equals execution authorization.
 */
export const BOUNDARY_DISPOSITION = Object.freeze({
  ADVISORY_NON_EXECUTING: 'ADVISORY_NON_EXECUTING',
  INSUFFICIENT_CONTROL: 'INSUFFICIENT_CONTROL',
  LIMITED_CONTROL: 'LIMITED_CONTROL',
  VETOED_CONTROL: 'VETOED_CONTROL',
});

/**
 * Explicit non-authorization statuses — structurally separate from Risk PASS.
 */
export const EXECUTION_AUTHORIZATION_STATUS = Object.freeze({
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
});

export const ORDER_AUTHORIZATION_STATUS = Object.freeze({
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
});

export const TRADE_EXECUTION_STATUS = Object.freeze({
  NOT_EXECUTED: 'NOT_EXECUTED',
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  controlChainStarted: false,
  ordersCreated: 0,
  liveTradingEnabled: false,
  runtimeArmed: false,
  transportArmed: false,
  advisoryOnly: true,
});

export const ZERO_RISK_CONTROL_RUNTIME_BOUNDARY_SIDE_EFFECTS = Object.freeze({
  ...ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
});

export const RISK_CONTROL_RUNTIME_BOUNDARY_LIMITATIONS = Object.freeze([
  'stage7_3_2c2_risk_control_runtime_boundary_only',
  'library_only',
  'boundary_not_executor',
  'does_not_arm_runtime',
  'does_not_start_control_chain_service',
  'does_not_approve_execution',
  'does_not_authorize_orders',
  'does_not_execute_trades',
  'risk_pass_is_not_execution_approval',
  'control_pass_bounded_is_not_execution',
  'does_not_call_legacy_risk_services',
  'does_not_import_legacy_moe',
  'does_not_call_llm_or_provider',
  'does_not_access_db_or_redis',
  'does_not_wire_portfolio_liquidity_runtime_order',
  'live_trading_not_authorized',
]);

const ALLOWED_INPUT_TOP = Object.freeze([
  'controlChainArtifact',
  'integration',
]);

const ALLOWED_INTEGRATION_TOP = Object.freeze([
  'stage',
  'contractVersion',
  'policyVersion',
  'schemaVersion',
  'limitations',
  'sideEffects',
]);

const ALLOWED_BOUNDARY_RESULT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'stage',
  'boundaryResultId',
  'decisionId',
  'decisionContextId',
  'controlChainArtifactId',
  'boundaryDisposition',
  'controlOutcome',
  'riskGateSummary',
  'executionAuthorizationStatus',
  'orderAuthorizationStatus',
  'tradeExecutionStatus',
  'advisoryOnly',
  'runtimeArmed',
  'transportArmed',
  'lineage',
  'provenance',
  'limitations',
  'sideEffects',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'controlChainStarted',
  'ordersCreated',
  'liveTradingEnabled',
  'generatedAt',
]);

const ALLOWED_RISK_GATE_SUMMARY = Object.freeze([
  'authorityClass',
  'outcome',
  'freshness',
  'limit',
  'reasonKey',
  'terminalVeto',
]);

const ALLOWED_BOUNDARY_LINEAGE = Object.freeze([
  'decisionId',
  'decisionContextId',
  'controlChainArtifactId',
  'contributingAgentRunIds',
  'orchestrationSetIds',
  'decisionContractVersion',
  'decisionContextContractVersion',
  'evidenceContractVersion',
  'orchestrationContractVersion',
  'controlChainContractVersion',
  'integrationContractVersion',
  'boundaryContractVersion',
]);

const ALLOWED_BOUNDARY_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'note',
  'sourceControlChainStage',
  'sourceControlChainContractVersion',
]);

const DIRECTION_FORBIDDEN_KEYS = Object.freeze([
  'direction',
  'side',
  'action',
  'buy',
  'sell',
]);

const LEGACY_MOE_FORBIDDEN_KEYS = Object.freeze([
  'moe',
  'vote',
  'votes',
  'weightedVote',
  'weighted_vote',
  'majority',
  'majorityVote',
  'experts',
  'mixtureOfExperts',
  'artemisOrchestrator',
  'agentVotes',
  'consensus',
  'legacyMoe',
]);

const MODEL_ASSISTED_FORBIDDEN_KEYS = Object.freeze([
  'modelAssistedContribution',
  'ModelAssistedContribution',
  'modelAssisted',
  'modelContribution',
  'modelResponse',
  'prompt',
  'providerPayload',
]);

const EXTRA_FORBIDDEN_KEYS = Object.freeze([
  ...FORBIDDEN_CONTROL_CHAIN_KEYS,
  'orderId',
  'executionIntent',
  'walletAction',
  'tradeInstruction',
  'executionCommand',
  'credentials',
  'apiKey',
  'raw',
  'payload',
  'signedQuery',
  'BUY',
  'SELL',
  'EXECUTE',
  'LONG',
  'SHORT',
  'place_order',
  'approved',
]);

const UNSAFE_PASS_FRESHNESS = Object.freeze([
  FRESHNESS_STATUS.STALE,
  FRESHNESS_STATUS.EXPIRED,
  FRESHNESS_STATUS.UNKNOWN,
  FRESHNESS_STATUS.UNAVAILABLE,
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

function collectKeysDeep(obj, acc = []) {
  if (!obj || typeof obj !== 'object') return acc;
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectKeysDeep(item, acc));
    return acc;
  }
  for (const [key, nested] of Object.entries(obj)) {
    acc.push(key);
    collectKeysDeep(nested, acc);
  }
  return acc;
}

function collectStringValuesDeep(value, acc = []) {
  if (typeof value === 'string') {
    acc.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStringValuesDeep(item, acc));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStringValuesDeep(item, acc));
  }
  return acc;
}

function detectContamination(input, errors) {
  for (const key of Object.keys(input)) {
    if (MODEL_ASSISTED_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'model_assisted_contamination' });
    }
    if (LEGACY_MOE_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'legacy_moe_forbidden' });
    }
    if (EXTRA_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'forbidden_key' });
    }
    if (DIRECTION_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'direction_forbidden' });
    }
  }

  const surfaces = [];
  if (input.controlChainArtifact != null) surfaces.push(input.controlChainArtifact);
  if (input.integration != null) surfaces.push(input.integration);

  for (const surface of surfaces) {
    const keys = collectKeysDeep(surface);
    for (const key of keys) {
      if (MODEL_ASSISTED_FORBIDDEN_KEYS.includes(key)) {
        errors.push({ field: key, code: 'model_assisted_contamination' });
      }
      if (LEGACY_MOE_FORBIDDEN_KEYS.includes(key)) {
        errors.push({ field: key, code: 'legacy_moe_forbidden' });
      }
      if (EXTRA_FORBIDDEN_KEYS.includes(key)) {
        errors.push({ field: key, code: 'forbidden_key' });
      }
      if (DIRECTION_FORBIDDEN_KEYS.includes(key)) {
        errors.push({ field: key, code: 'direction_forbidden' });
      }
    }
    const values = collectStringValuesDeep(surface);
    for (const value of values) {
      if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
        errors.push({ field: 'controlChainArtifact', code: 'forbidden_execution_authority_value', value });
      }
      const lower = value.toLowerCase();
      if (lower === 'majority' || lower === 'weighted_vote' || lower === 'weightedvote') {
        errors.push({ field: 'controlChainArtifact', code: 'vote_contamination', value });
      }
    }
  }

  const secrets = collectForbiddenSecretKeys(input);
  if (secrets.length) {
    errors.push({ field: 'input', code: 'forbidden_secret_keys', keys: [...new Set(secrets)] });
  }
}

function assertHardFlags(obj, errors, prefix = '') {
  for (const [key, expected] of Object.entries(REQUIRED_HARD_FLAGS)) {
    if (obj[key] !== expected) {
      errors.push({
        field: `${prefix}${key}`,
        code: 'hard_flag_violation',
        expected,
        actual: obj[key],
      });
    }
  }
}

function assertZeroSideEffects(sideEffects, errors, field = 'sideEffects') {
  if (!sideEffects || typeof sideEffects !== 'object') {
    errors.push({ field, code: 'required_object' });
    return;
  }
  for (const [key, expected] of Object.entries(ZERO_RISK_CONTROL_RUNTIME_BOUNDARY_SIDE_EFFECTS)) {
    if (sideEffects[key] !== expected) {
      errors.push({
        field: `${field}.${key}`,
        code: 'nonzero_side_effect',
        expected,
        actual: sideEffects[key],
      });
    }
  }
}

function validateOptionalIntegration(integration, errors) {
  if (integration == null) return;
  if (!assertAllowlist(integration, ALLOWED_INTEGRATION_TOP, 'integration', errors)) return;
  if (integration.stage !== RISK_GATE_INTEGRATION_STAGE) {
    errors.push({ field: 'integration.stage', code: 'invalid_integration_stage' });
  }
  if (integration.contractVersion !== RISK_GATE_INTEGRATION_CONTRACT_VERSION) {
    errors.push({ field: 'integration.contractVersion', code: 'invalid_integration_contract' });
  }
  if (
    integration.schemaVersion != null
    && integration.schemaVersion !== RISK_GATE_INTEGRATION_SCHEMA_VERSION
  ) {
    errors.push({ field: 'integration.schemaVersion', code: 'invalid_integration_schema' });
  }
  if (
    integration.policyVersion != null
    && integration.policyVersion !== RISK_GATE_INTEGRATION_POLICY_VERSION
  ) {
    errors.push({ field: 'integration.policyVersion', code: 'invalid_integration_policy' });
  }
  if (integration.sideEffects != null) {
    for (const [key, expected] of Object.entries(ZERO_RISK_GATE_INTEGRATION_SIDE_EFFECTS)) {
      if (integration.sideEffects[key] !== expected) {
        errors.push({
          field: `integration.sideEffects.${key}`,
          code: 'nonzero_side_effect',
          expected,
          actual: integration.sideEffects[key],
        });
      }
    }
  }
  if (
    integration.decisionEligible === true
    || integration.executionEligible === true
    || integration.approvedForExecution === true
  ) {
    errors.push({ field: 'integration', code: 'authority_escalation' });
  }
}

/**
 * Fail-closed Risk ↔ controlOutcome consistency for boundary admission.
 */
function assertRiskControlConsistency(artifact, errors) {
  const riskGate = artifact.riskGate;
  const outcome = artifact.controlOutcome;
  if (!riskGate || typeof riskGate !== 'object') {
    errors.push({ field: 'controlChainArtifact.riskGate', code: 'required_object' });
    return;
  }

  if (riskGate.authorityClass !== AUTHORITY_CLASS.CONTROL_VETO) {
    errors.push({ field: 'riskGate.authorityClass', code: 'must_be_control_veto' });
  }

  if (riskGate.outcome === RISK_GATE_OUTCOME.PASS) {
    if (UNSAFE_PASS_FRESHNESS.includes(riskGate.freshness)) {
      errors.push({ field: 'riskGate', code: 'stale_risk_cannot_pass' });
    }
    if (
      artifact.approvedForExecution === true
      || artifact.executionEligible === true
      || artifact.decisionEligible === true
    ) {
      errors.push({ field: 'controlChainArtifact', code: 'risk_pass_cannot_authorize_execution' });
    }
  }

  if (riskGate.outcome === RISK_GATE_OUTCOME.LIMIT) {
    if (outcome !== CONTROL_OUTCOME.LIMITED) {
      errors.push({ field: 'controlOutcome', code: 'inconsistent_control_outcome_vs_risk_gate' });
    }
    if (
      riskGate.limit != null
      && !(typeof riskGate.limit === 'number'
        && Number.isFinite(riskGate.limit)
        && riskGate.limit >= 0)
    ) {
      errors.push({ field: 'riskGate.limit', code: 'invalid_limit' });
    }
  }

  if (riskGate.outcome === RISK_GATE_OUTCOME.REJECT) {
    if (riskGate.terminalVeto !== true) {
      errors.push({ field: 'riskGate.terminalVeto', code: 'reject_requires_terminal_veto' });
    }
    if (outcome !== CONTROL_OUTCOME.VETOED) {
      errors.push({ field: 'controlOutcome', code: 'inconsistent_control_outcome_vs_risk_gate' });
    }
  }

  if (riskGate.outcome === RISK_GATE_OUTCOME.UNAVAILABLE) {
    if (outcome !== CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE) {
      errors.push({ field: 'controlOutcome', code: 'inconsistent_control_outcome_vs_risk_gate' });
    }
  }

  if (riskGate.terminalVeto === true && outcome !== CONTROL_OUTCOME.VETOED) {
    errors.push({ field: 'controlOutcome', code: 'terminal_veto_requires_vetoed' });
  }
}

function deriveBoundaryDisposition(controlOutcome) {
  if (controlOutcome === CONTROL_OUTCOME.VETOED) {
    return BOUNDARY_DISPOSITION.VETOED_CONTROL;
  }
  if (controlOutcome === CONTROL_OUTCOME.LIMITED) {
    return BOUNDARY_DISPOSITION.LIMITED_CONTROL;
  }
  if (
    controlOutcome === CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE
    || controlOutcome === CONTROL_OUTCOME.STALE
  ) {
    return BOUNDARY_DISPOSITION.INSUFFICIENT_CONTROL;
  }
  // HOLD_EVALUATION, CONTROL_PASS_BOUNDED, RUNTIME_BLOCKED, INFEASIBLE,
  // NOT_EVALUATED → advisory / non-executing only.
  return BOUNDARY_DISPOSITION.ADVISORY_NON_EXECUTING;
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

function cloneRiskGateSummary(riskGate) {
  const summary = {
    authorityClass: riskGate.authorityClass,
    outcome: riskGate.outcome,
  };
  if (riskGate.freshness != null) summary.freshness = riskGate.freshness;
  if (Object.prototype.hasOwnProperty.call(riskGate, 'limit')) {
    summary.limit = riskGate.limit;
  }
  if (riskGate.reasonKey != null) summary.reasonKey = riskGate.reasonKey;
  if (Object.prototype.hasOwnProperty.call(riskGate, 'terminalVeto')) {
    summary.terminalVeto = riskGate.terminalVeto;
  }
  return summary;
}

function buildLineage(artifact, integration) {
  const source = artifact.lineage ?? {};
  const lineage = {
    decisionId: artifact.decisionId,
    decisionContextId: artifact.decisionContextId,
    controlChainArtifactId: artifact.controlChainArtifactId,
    contributingAgentRunIds: [...(source.contributingAgentRunIds ?? [])],
    orchestrationSetIds: [...(source.orchestrationSetIds ?? [])],
    decisionContractVersion: source.decisionContractVersion,
    decisionContextContractVersion: source.decisionContextContractVersion,
    evidenceContractVersion: source.evidenceContractVersion,
    orchestrationContractVersion: source.orchestrationContractVersion,
    controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    boundaryContractVersion: RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION,
  };
  if (integration?.contractVersion) {
    lineage.integrationContractVersion = integration.contractVersion;
  }
  return lineage;
}

/**
 * Validate boundary input allowlists before artifact admission.
 */
export function validateRiskControlRuntimeBoundaryInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Risk control runtime boundary input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }
  const errors = [];
  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Unknown risk control runtime boundary input fields', { errors });
  }
  detectContamination(input, errors);

  if (input.controlChainArtifact == null) {
    errors.push({ field: 'controlChainArtifact', code: 'missing_artifact' });
  } else if (
    typeof input.controlChainArtifact !== 'object'
    || Array.isArray(input.controlChainArtifact)
  ) {
    errors.push({ field: 'controlChainArtifact', code: 'malformed_artifact' });
  }

  validateOptionalIntegration(input.integration, errors);

  if (errors.length) {
    return fail('validation_failed', 'Risk control runtime boundary input failed validation', {
      errors,
    });
  }
  return { ok: true };
}

/**
 * Validate a boundary result artifact.
 */
export function validateRiskControlRuntimeBoundaryResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return fail('invalid_result', 'Boundary result must be a plain object', {
      errors: [{ field: 'result', code: 'required_object' }],
    });
  }
  const errors = [];
  if (!assertAllowlist(result, ALLOWED_BOUNDARY_RESULT_TOP, 'result', errors)) {
    return fail('unknown_field', 'Unknown boundary result fields', { errors });
  }
  if (result.schemaVersion !== RISK_CONTROL_RUNTIME_BOUNDARY_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'bad_schema_version' });
  }
  if (result.contractVersion !== RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'bad_contract_version' });
  }
  if (result.policyVersion !== RISK_CONTROL_RUNTIME_BOUNDARY_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', code: 'bad_policy_version' });
  }
  if (result.stage !== RISK_CONTROL_RUNTIME_BOUNDARY_STAGE) {
    errors.push({ field: 'stage', code: 'invalid_stage' });
  }
  if (!isCanonicalUuid(result.boundaryResultId)) {
    errors.push({ field: 'boundaryResultId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(result.decisionId)) {
    errors.push({ field: 'decisionId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(result.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(result.controlChainArtifactId)) {
    errors.push({ field: 'controlChainArtifactId', code: 'invalid_uuid' });
  }
  if (!Object.values(BOUNDARY_DISPOSITION).includes(result.boundaryDisposition)) {
    errors.push({ field: 'boundaryDisposition', code: 'invalid_boundary_disposition' });
  }
  if (!Object.values(CONTROL_OUTCOME).includes(result.controlOutcome)) {
    errors.push({ field: 'controlOutcome', code: 'invalid_control_outcome' });
  }
  if (result.executionAuthorizationStatus !== EXECUTION_AUTHORIZATION_STATUS.NOT_AUTHORIZED) {
    errors.push({ field: 'executionAuthorizationStatus', code: 'execution_must_remain_not_authorized' });
  }
  if (result.orderAuthorizationStatus !== ORDER_AUTHORIZATION_STATUS.NOT_AUTHORIZED) {
    errors.push({ field: 'orderAuthorizationStatus', code: 'order_must_remain_not_authorized' });
  }
  if (result.tradeExecutionStatus !== TRADE_EXECUTION_STATUS.NOT_EXECUTED) {
    errors.push({ field: 'tradeExecutionStatus', code: 'trade_must_remain_not_executed' });
  }
  assertHardFlags(result, errors);
  if (!assertAllowlist(result.riskGateSummary, ALLOWED_RISK_GATE_SUMMARY, 'riskGateSummary', errors)) {
    /* recorded */
  }
  if (!assertAllowlist(result.lineage, ALLOWED_BOUNDARY_LINEAGE, 'lineage', errors)) {
    /* recorded */
  } else {
    if (result.lineage.decisionId !== result.decisionId) {
      errors.push({ field: 'lineage.decisionId', code: 'lineage_decision_mismatch' });
    }
    if (result.lineage.decisionContextId !== result.decisionContextId) {
      errors.push({ field: 'lineage.decisionContextId', code: 'lineage_context_mismatch' });
    }
    if (result.lineage.controlChainArtifactId !== result.controlChainArtifactId) {
      errors.push({ field: 'lineage.controlChainArtifactId', code: 'lineage_artifact_mismatch' });
    }
    if (result.lineage.controlChainContractVersion !== CONTROL_CHAIN_CONTRACT_VERSION) {
      errors.push({ field: 'lineage.controlChainContractVersion', code: 'invalid_control_chain_contract' });
    }
    if (result.lineage.boundaryContractVersion !== RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION) {
      errors.push({ field: 'lineage.boundaryContractVersion', code: 'invalid_boundary_contract' });
    }
  }
  if (!assertAllowlist(result.provenance, ALLOWED_BOUNDARY_PROVENANCE, 'provenance', errors)) {
    /* recorded */
  } else {
    if (result.provenance.writer !== RISK_CONTROL_RUNTIME_BOUNDARY_WRITER) {
      errors.push({ field: 'provenance.writer', code: 'invalid_writer' });
    }
    if (result.provenance.methodKey !== RISK_CONTROL_RUNTIME_BOUNDARY_METHOD_KEY) {
      errors.push({ field: 'provenance.methodKey', code: 'invalid_method_key' });
    }
    if (result.provenance.stage !== RISK_CONTROL_RUNTIME_BOUNDARY_STAGE) {
      errors.push({ field: 'provenance.stage', code: 'invalid_stage' });
    }
    if (result.provenance.sourceControlChainStage !== CONTROL_CHAIN_STAGE) {
      errors.push({ field: 'provenance.sourceControlChainStage', code: 'invalid_source_stage' });
    }
    if (result.provenance.sourceControlChainContractVersion !== CONTROL_CHAIN_CONTRACT_VERSION) {
      errors.push({
        field: 'provenance.sourceControlChainContractVersion',
        code: 'invalid_source_contract',
      });
    }
    if (!isIsoTimestamp(result.provenance.recordedAt)) {
      errors.push({ field: 'provenance.recordedAt', code: 'invalid_timestamp' });
    }
  }
  if (!Array.isArray(result.limitations) || !result.limitations.length) {
    errors.push({ field: 'limitations', code: 'required_array' });
  } else if (result.limitations.length > MAX_LIMITATIONS) {
    errors.push({ field: 'limitations', code: 'too_many' });
  }
  assertZeroSideEffects(result.sideEffects, errors);
  if (!isIsoTimestamp(result.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_timestamp' });
  }
  if (result.boundaryDisposition === BOUNDARY_DISPOSITION.ADVISORY_NON_EXECUTING) {
    if (
      result.riskGateSummary?.outcome === RISK_GATE_OUTCOME.PASS
      && (
        result.executionAuthorizationStatus !== EXECUTION_AUTHORIZATION_STATUS.NOT_AUTHORIZED
        || result.approvedForExecution === true
        || result.executionEligible === true
      )
    ) {
      errors.push({ field: 'result', code: 'risk_pass_cannot_authorize_execution' });
    }
  }
  const secrets = collectForbiddenSecretKeys(result);
  if (secrets.length) {
    errors.push({ field: 'result', code: 'forbidden_secret_keys', keys: [...new Set(secrets)] });
  }
  const bytes = utf8ByteLength(result);
  if (bytes > MAX_BOUNDARY_UTF8_BYTES) {
    errors.push({ field: 'result', code: 'too_large', bytes });
  }
  if (errors.length) {
    return fail('validation_failed', 'Boundary result failed validation', { errors, bytes });
  }
  return { ok: true, bytes };
}

/**
 * Admit a Stage 7.3.1 ControlChainArtifact (from c.1 or equivalent validated
 * contract path) into a deterministic runtime-boundary result.
 *
 * Never arms runtime. Never authorizes execution.
 *
 * @param {object} input
 * @returns {{ ok: true, result: object } | { ok: false, code: string, message: string, errors?: object[] }}
 */
export function acceptRiskControlChainRuntimeBoundary(input = {}) {
  const pre = validateRiskControlRuntimeBoundaryInput(input);
  if (!pre.ok) return pre;

  const artifact = input.controlChainArtifact;
  const validated = validateControlChainArtifact(artifact);
  if (!validated.ok) {
    return fail(
      validated.code ?? 'invalid_control_chain_artifact',
      validated.message ?? 'ControlChainArtifact failed Stage 7.3.1 validation',
      { errors: validated.errors ?? [{ field: 'controlChainArtifact', code: 'malformed_artifact' }] },
    );
  }

  const errors = [];

  if (artifact.contractVersion !== CONTROL_CHAIN_CONTRACT_VERSION) {
    errors.push({ field: 'controlChainArtifact.contractVersion', code: 'wrong_contract_version' });
  }
  if (artifact.schemaVersion !== CONTROL_CHAIN_SCHEMA_VERSION) {
    errors.push({ field: 'controlChainArtifact.schemaVersion', code: 'wrong_schema_version' });
  }
  if (artifact.policyVersion !== CONTROL_CHAIN_POLICY_VERSION) {
    errors.push({ field: 'controlChainArtifact.policyVersion', code: 'wrong_policy_version' });
  }
  if (artifact.provenance?.stage !== CONTROL_CHAIN_STAGE) {
    errors.push({ field: 'controlChainArtifact.provenance.stage', code: 'wrong_stage' });
  }
  if (!artifact.lineage || typeof artifact.lineage !== 'object') {
    errors.push({ field: 'controlChainArtifact.lineage', code: 'missing_lineage' });
  } else if (artifact.lineage.controlChainContractVersion !== CONTROL_CHAIN_CONTRACT_VERSION) {
    errors.push({ field: 'controlChainArtifact.lineage', code: 'lineage_mismatch' });
  }

  // Hard safety flags on admitted artifact (belt + suspenders beyond 7.3.1).
  if (artifact.approvedForExecution === true) {
    errors.push({ field: 'approvedForExecution', code: 'approved_for_execution_forbidden' });
  }
  if (artifact.executionEligible === true) {
    errors.push({ field: 'executionEligible', code: 'execution_eligible_forbidden' });
  }
  if (artifact.decisionEligible === true) {
    errors.push({ field: 'decisionEligible', code: 'decision_eligible_forbidden' });
  }
  if (artifact.controlChainStarted === true) {
    errors.push({ field: 'controlChainStarted', code: 'control_chain_started_forbidden' });
  }
  if (artifact.ordersCreated !== 0) {
    errors.push({ field: 'ordersCreated', code: 'orders_created_nonzero' });
  }
  if (artifact.liveTradingEnabled === true) {
    errors.push({ field: 'liveTradingEnabled', code: 'live_trading_enabled_forbidden' });
  }

  assertRiskControlConsistency(artifact, errors);
  assertZeroSideEffects(artifact.sideEffects, errors, 'controlChainArtifact.sideEffects');

  if (errors.length) {
    return fail('validation_failed', 'ControlChainArtifact failed runtime-boundary admission', {
      errors,
    });
  }

  const recordedAt = artifact.provenance?.recordedAt ?? artifact.generatedAt;
  if (!isIsoTimestamp(recordedAt)) {
    return fail('invalid_timestamp', 'ControlChainArtifact recordedAt/generatedAt missing', {
      errors: [{ field: 'controlChainArtifact.provenance.recordedAt', code: 'invalid_timestamp' }],
    });
  }

  const boundaryDisposition = deriveBoundaryDisposition(artifact.controlOutcome);
  const boundaryResultId = hashToUuid([
    RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION,
    artifact.controlChainArtifactId,
    artifact.decisionId,
    artifact.decisionContextId,
    artifact.controlOutcome,
    boundaryDisposition,
    recordedAt,
  ]);

  const result = {
    schemaVersion: RISK_CONTROL_RUNTIME_BOUNDARY_SCHEMA_VERSION,
    contractVersion: RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION,
    policyVersion: RISK_CONTROL_RUNTIME_BOUNDARY_POLICY_VERSION,
    stage: RISK_CONTROL_RUNTIME_BOUNDARY_STAGE,
    boundaryResultId,
    decisionId: artifact.decisionId,
    decisionContextId: artifact.decisionContextId,
    controlChainArtifactId: artifact.controlChainArtifactId,
    boundaryDisposition,
    controlOutcome: artifact.controlOutcome,
    riskGateSummary: cloneRiskGateSummary(artifact.riskGate),
    executionAuthorizationStatus: EXECUTION_AUTHORIZATION_STATUS.NOT_AUTHORIZED,
    orderAuthorizationStatus: ORDER_AUTHORIZATION_STATUS.NOT_AUTHORIZED,
    tradeExecutionStatus: TRADE_EXECUTION_STATUS.NOT_EXECUTED,
    advisoryOnly: true,
    runtimeArmed: false,
    transportArmed: false,
    lineage: buildLineage(artifact, input.integration),
    provenance: {
      writer: RISK_CONTROL_RUNTIME_BOUNDARY_WRITER,
      methodKey: RISK_CONTROL_RUNTIME_BOUNDARY_METHOD_KEY,
      stage: RISK_CONTROL_RUNTIME_BOUNDARY_STAGE,
      recordedAt,
      note: 'stage7_3_2c2_risk_control_runtime_boundary',
      sourceControlChainStage: CONTROL_CHAIN_STAGE,
      sourceControlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    },
    limitations: [...RISK_CONTROL_RUNTIME_BOUNDARY_LIMITATIONS],
    sideEffects: { ...ZERO_RISK_CONTROL_RUNTIME_BOUNDARY_SIDE_EFFECTS },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    controlChainStarted: false,
    ordersCreated: 0,
    liveTradingEnabled: false,
    generatedAt: recordedAt,
  };

  const post = validateRiskControlRuntimeBoundaryResult(result);
  if (!post.ok) return post;

  // Explicit structural proof: Risk PASS never becomes execution authorization.
  if (
    result.riskGateSummary.outcome === RISK_GATE_OUTCOME.PASS
    && (
      result.executionAuthorizationStatus !== EXECUTION_AUTHORIZATION_STATUS.NOT_AUTHORIZED
      || result.orderAuthorizationStatus !== ORDER_AUTHORIZATION_STATUS.NOT_AUTHORIZED
      || result.tradeExecutionStatus !== TRADE_EXECUTION_STATUS.NOT_EXECUTED
      || result.approvedForExecution === true
      || result.executionEligible === true
    )
  ) {
    return fail('risk_pass_cannot_authorize_execution', 'Risk PASS must remain non-executing at boundary', {
      errors: [{ field: 'result', code: 'risk_pass_cannot_authorize_execution' }],
    });
  }

  return { ok: true, result };
}

export default {
  acceptRiskControlChainRuntimeBoundary,
  validateRiskControlRuntimeBoundaryInput,
  validateRiskControlRuntimeBoundaryResult,
  RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION,
  RISK_CONTROL_RUNTIME_BOUNDARY_STAGE,
  BOUNDARY_DISPOSITION,
};
