/**
 * Artemis Core Stage 7.3.1 — Control Chain contract foundation.
 *
 * Canonical validation boundary:
 *   Cognitive Decision → ControlChainArtifact → future gate evaluation
 *
 * CONTRACT-ONLY. This module is not a Control Chain service, not Execution
 * Authorization, not Order Management, and not a provider integration.
 *
 * CONTROL_PASS_BOUNDED never implies approvedForExecution, executionEligible,
 * order intent, or provider submission.
 */

import {
  DECISION_CONTRACT_VERSION,
  buildContractOnlyArtemisDecision,
  validateArtemisDecision,
} from './artemisDecisionContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_LIFECYCLE,
  EFFECTIVE_RUNTIME_MODE,
  ENVIRONMENT,
  REQUESTED_RUNTIME_MODE,
} from './artemisDecisionContextContract.js';
import {
  AUTHORITY_CLASS,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  FRESHNESS_STATUS,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from './artemisEvidenceOrchestrationContract.js';

export const CONTROL_CHAIN_STAGE = '7.3.1';
export const CONTROL_CHAIN_SCHEMA_VERSION = '1.0.0';
export const CONTROL_CHAIN_CONTRACT_VERSION = 'artemis-control-chain-1.0.0';
export const CONTROL_CHAIN_POLICY_VERSION = 'stage7-3-1-control-chain-contract-1.0.0';
export const CONTROL_CHAIN_WRITER = 'artemisControlChainContract';
export const LIQUIDITY_BLOCKED_REASON = 'liquidity_feasibility_not_implemented';

export const REQUIRED_DECISION_CONTRACT_VERSION = DECISION_CONTRACT_VERSION;
export const REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION = DECISION_CONTEXT_CONTRACT_VERSION;
export const REQUIRED_EVIDENCE_CONTRACT_VERSION = EVIDENCE_CONTRACT_VERSION;
export const REQUIRED_ORCHESTRATION_CONTRACT_VERSION = ORCHESTRATION_CONTRACT_VERSION;

export const MAX_CONTROL_CHAIN_UTF8_BYTES = 48 * 1024;
export const MAX_STRING_CHARS = 512;
export const MAX_ID_LIST = 64;
export const MAX_LIMITATIONS = 64;

export const CONTROL_CHAIN_LIFECYCLE = Object.freeze({
  NOT_EVALUATED: 'NOT_EVALUATED',
  INSUFFICIENT_INPUT: 'INSUFFICIENT_INPUT',
  INCOMPATIBLE_CONTEXT: 'INCOMPATIBLE_CONTEXT',
  EVALUATED_PARTIAL: 'EVALUATED_PARTIAL',
  EVALUATED_COMPLETE: 'EVALUATED_COMPLETE',
  BLOCKED: 'BLOCKED',
  STALE_INPUT: 'STALE_INPUT',
  CONTRACT_ONLY: 'CONTRACT_ONLY',
});

export const CONTROL_OUTCOME = Object.freeze({
  HOLD_EVALUATION: 'HOLD_EVALUATION',
  VETOED: 'VETOED',
  LIMITED: 'LIMITED',
  INFEASIBLE: 'INFEASIBLE',
  STALE: 'STALE',
  RUNTIME_BLOCKED: 'RUNTIME_BLOCKED',
  INSUFFICIENT_CONTROL_EVIDENCE: 'INSUFFICIENT_CONTROL_EVIDENCE',
  CONTROL_PASS_BOUNDED: 'CONTROL_PASS_BOUNDED',
  NOT_EVALUATED: 'NOT_EVALUATED',
});

export const REQUESTED_OPERATION_CLASS = Object.freeze({
  OBSERVE: 'observe',
  SIZE_BOUND: 'size_bound',
  FEASIBILITY_CHECK: 'feasibility_check',
});

export const FORBIDDEN_OPERATION_CLASS = Object.freeze(['place_order']);

export const RISK_GATE_OUTCOME = Object.freeze({
  PASS: 'PASS',
  LIMIT: 'LIMIT',
  REJECT: 'REJECT',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

export const PORTFOLIO_GATE_OUTCOME = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  PENDING: 'PENDING',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

export const LIQUIDITY_GATE_OUTCOME = Object.freeze({
  FEASIBLE: 'FEASIBLE',
  INFEASIBLE: 'INFEASIBLE',
  STALE: 'STALE',
  UNAVAILABLE: 'UNAVAILABLE',
  BLOCKED: 'BLOCKED',
  PENDING: 'PENDING',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

export const RUNTIME_GATE_OUTCOME = Object.freeze({
  CLEAR: 'CLEAR',
  RUNTIME_BLOCKED: 'RUNTIME_BLOCKED',
  UNKNOWN: 'UNKNOWN',
});

export const ORDER_MECHANICS_READINESS_STATUS = Object.freeze({
  CONTRACT_ONLY: 'contract_only',
  NOT_READY: 'not_ready',
});

export const CAPABILITY_STATE = Object.freeze({
  GRANTED: 'granted',
  DENIED: 'denied',
  UNKNOWN: 'unknown',
});

export const TRI_STATE = Object.freeze({
  TRUE: true,
  FALSE: false,
  UNKNOWN: 'unknown',
});

export const FORBIDDEN_EXECUTION_AUTHORITY_VALUES = Object.freeze([
  'BUY',
  'SELL',
  'EXECUTE',
  'LONG',
  'SHORT',
]);

export const FORBIDDEN_CONTROL_CHAIN_KEYS = Object.freeze([
  'orderId',
  'executionCommand',
  'executionIntent',
  'walletAction',
  'tradeInstruction',
  'approved',
  'action',
  'apiKey',
  'credentials',
  'prompt',
  'modelResponse',
  'providerPayload',
  'raw',
  'payload',
  'signedQuery',
]);

export const CONTROL_CHAIN_LIMITATIONS = Object.freeze([
  'stage7_3_1_control_chain_contract_only',
  'not_control_chain_service',
  'not_execution_authorization',
  'not_order_management',
  'not_provider_integration',
  'control_pass_bounded_is_not_execution',
  'liquidity_blocked_until_truthful_feasibility',
  'no_llm_provider_calls',
  'live_trading_not_authorized',
  'cognitive_not_control',
  'control_not_execution',
  'execution_not_provider',
]);

export const ZERO_CONTROL_CHAIN_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  agentExecutionCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  llmCallCount: 0,
  networkRequestCount: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  controlChainStarted: false,
  ordersCreated: 0,
  liveTradingEnabled: false,
});

const ALLOWED_EVALUATION_MODES = new Set(Object.values(EFFECTIVE_RUNTIME_MODE));
const ALLOWED_REQUESTED_MODES = new Set(
  Object.values(REQUESTED_RUNTIME_MODE).filter((mode) => mode !== REQUESTED_RUNTIME_MODE.LIVE),
);

const ALLOWED_INPUT_TOP = Object.freeze([
  'artemisCognitiveDecision',
  'decisionContext',
  'lineage',
  'provenance',
  'riskEvidenceRef',
  'portfolioEvidenceRef',
  'liquidityEvidenceRef',
  'runtimeSnapshot',
  'requestedOperationClass',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'decisionId',
  'decisionContextId',
  'contributingAgentRunIds',
  'orchestrationSetIds',
  'decisionContractVersion',
  'decisionContextContractVersion',
  'evidenceContractVersion',
  'orchestrationContractVersion',
  'controlChainContractVersion',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'note',
]);

const ALLOWED_EVIDENCE_REF = Object.freeze([
  'agentId',
  'runId',
  'authorityClass',
  'outcome',
  'freshness',
  'availability',
  'limit',
  'reasonKey',
  'unit',
  'min',
  'max',
  'recommended',
  'accountStateAvailable',
  'bookTimestamp',
  'expiryTimestamp',
]);

const ALLOWED_RUNTIME_SNAPSHOT = Object.freeze([
  'killSwitchActive',
  'requestedRuntimeMode',
  'effectiveRuntimeMode',
  'capabilityState',
  'ssotAvailable',
  'ssotOwner',
]);

const ALLOWED_ARTIFACT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'controlChainArtifactId',
  'decisionId',
  'decisionContextId',
  'lifecycle',
  'controlOutcome',
  'requestedOperationClass',
  'riskGate',
  'portfolioGate',
  'liquidityGate',
  'runtimeGate',
  'orderMechanicsReadiness',
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

const ALLOWED_RISK_GATE = Object.freeze([
  'authorityClass',
  'outcome',
  'freshness',
  'limit',
  'reasonKey',
  'terminalVeto',
]);

const ALLOWED_PORTFOLIO_GATE = Object.freeze([
  'authorityClass',
  'outcome',
  'unit',
  'min',
  'max',
  'recommended',
  'reasonKey',
  'usableSizingEmitted',
]);

const ALLOWED_LIQUIDITY_GATE = Object.freeze([
  'authorityClass',
  'outcome',
  'reasonKey',
  'freshness',
  'bookTimestamp',
  'expiryTimestamp',
]);

const ALLOWED_RUNTIME_GATE = Object.freeze([
  'authorityClass',
  'outcome',
  'killSwitchActive',
  'requestedRuntimeMode',
  'effectiveRuntimeMode',
  'capabilityState',
  'ssotAvailable',
  'ssotOwner',
  'reasonKey',
]);

const ALLOWED_ORDER_READINESS = Object.freeze([
  'status',
  'authorityClass',
  'orderPresent',
  'executionIntentPresent',
  'providerSubmittable',
  'idempotencyKeyPresent',
  'reasonKey',
]);

const PORTFOLIO_DIRECTION_KEYS = Object.freeze([
  'direction',
  'side',
  'action',
  'buy',
  'sell',
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function inEnum(value, table) {
  return Object.values(table).includes(value);
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

function collectForbiddenKeys(obj, acc = []) {
  if (!obj || typeof obj !== 'object') return acc;
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_CONTROL_CHAIN_KEYS.includes(key)) acc.push(key);
    const value = obj[key];
    if (value && typeof value === 'object') collectForbiddenKeys(value, acc);
  }
  return acc;
}

function collectForbiddenAuthorityValues(value, acc = []) {
  if (typeof value === 'string' && FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
    acc.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenAuthorityValues(item, acc));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectForbiddenAuthorityValues(item, acc));
  }
  return acc;
}

function assertString(field, value, errors, { required = false, max = MAX_STRING_CHARS } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (typeof value !== 'string' || !value.trim()) {
    errors.push({ field, code: 'invalid_string' });
    return;
  }
  if (value.length > max) errors.push({ field, code: 'too_long', max });
}

function assertUuidList(field, value, errors) {
  if (!Array.isArray(value)) {
    errors.push({ field, code: 'required_array' });
    return;
  }
  if (value.length > MAX_ID_LIST) {
    errors.push({ field, code: 'too_many', max: MAX_ID_LIST });
  }
  value.forEach((id, index) => {
    if (!isCanonicalUuid(id)) errors.push({ field: `${field}[${index}]`, code: 'invalid_uuid' });
  });
}

function normText(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sameText(a, b) {
  const left = normText(a);
  const right = normText(b);
  if (left == null || right == null) return true;
  return left.toLowerCase() === right.toLowerCase();
}

function killSwitchState(value) {
  if (value === true) return true;
  if (value === false) return false;
  return 'unknown';
}

function validateCognitiveDecision(decision, errors) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    errors.push({ field: 'artemisCognitiveDecision', code: 'invalid_cognitive_decision' });
    return;
  }
  if (decision.executionEligible === true) {
    errors.push({ field: 'artemisCognitiveDecision.executionEligible', code: 'execution_eligible_rejected' });
  }
  if (decision.approvedForExecution === true) {
    errors.push({ field: 'artemisCognitiveDecision.approvedForExecution', code: 'approved_for_execution_rejected' });
  }
  if (decision.decisionEligible === true) {
    errors.push({ field: 'artemisCognitiveDecision.decisionEligible', code: 'decision_eligible_rejected' });
  }
  const validated = validateArtemisDecision(decision);
  if (!validated.ok) {
    errors.push({
      field: 'artemisCognitiveDecision',
      code: validated.code || 'invalid_cognitive_decision',
      details: validated.errors || validated.fields,
    });
  }
}

function validateDecisionContextShape(context, errors) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    errors.push({ field: 'decisionContext', code: 'invalid_decision_context' });
    return;
  }
  if (context.contractVersion !== DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({ field: 'decisionContext.contractVersion', code: 'incompatible_decision_context_contract' });
  }
  if (!isCanonicalUuid(context.contextId)) {
    errors.push({ field: 'decisionContext.contextId', code: 'invalid_uuid' });
  }
  const allowedLifecycle = new Set([
    DECISION_CONTEXT_LIFECYCLE.VALIDATED,
    DECISION_CONTEXT_LIFECYCLE.FROZEN,
  ]);
  if (!allowedLifecycle.has(context.lifecycleState)) {
    errors.push({ field: 'decisionContext.lifecycleState', code: 'decision_context_not_frozen' });
  }
  if (context.executionEligible === true || context.approvedForExecution === true || context.decisionEligible === true) {
    errors.push({ field: 'decisionContext', code: 'authority_escalation' });
  }
  if (!context.marketScope || typeof context.marketScope !== 'object') {
    errors.push({ field: 'decisionContext.marketScope', code: 'required_object' });
  }
  if (!context.mode || typeof context.mode !== 'object') {
    errors.push({ field: 'decisionContext.mode', code: 'required_object' });
  } else {
    if (context.mode.requested === REQUESTED_RUNTIME_MODE.LIVE
      || context.mode.effective === REQUESTED_RUNTIME_MODE.LIVE
      || context.mode.effective === 'live') {
      errors.push({ field: 'decisionContext.mode', code: 'live_runtime_mode_rejected' });
    }
    if (context.mode.effective != null && !ALLOWED_EVALUATION_MODES.has(context.mode.effective)) {
      errors.push({ field: 'decisionContext.mode.effective', code: 'live_runtime_mode_rejected' });
    }
  }
  if (context.environment != null && !Object.values(ENVIRONMENT).includes(context.environment)) {
    errors.push({ field: 'decisionContext.environment', code: 'invalid_environment' });
  }
}

function validateCompatibility(decision, context, errors) {
  if (!decision || !context || !context.marketScope) return;
  const market = context.marketScope;
  const pairs = [
    ['venue', decision.venue, market.venue ?? market.provider],
    ['provider', decision.venue, market.provider ?? market.venue],
    ['marketType', decision.marketType, market.marketType],
    ['symbol', decision.symbol, market.symbol],
    ['baseAsset', decision.baseAsset, market.baseAsset],
    ['quoteAsset', decision.quoteAsset, market.quoteAsset],
    ['timeframe', decision.timeframe, context.timeframe],
    ['analysisHorizon', decision.analysisHorizon, context.analysisHorizon],
  ];
  for (const [field, left, right] of pairs) {
    if (normText(left) && normText(right) && !sameText(left, right)) {
      errors.push({ field: `compatibility.${field}`, code: 'incompatible_context' });
    }
  }
  if (decision.decisionContextId && context.contextId && decision.decisionContextId !== context.contextId) {
    errors.push({ field: 'compatibility.decisionContextId', code: 'incompatible_context' });
  }
  const decisionWindow = decision.sourceWindow && typeof decision.sourceWindow === 'object'
    ? decision.sourceWindow
    : null;
  const contextWindow = context.sourceWindow && typeof context.sourceWindow === 'object'
    ? context.sourceWindow
    : null;
  if (decisionWindow && contextWindow) {
    if (normText(decisionWindow.start) && normText(contextWindow.since)
      && !sameText(decisionWindow.start, contextWindow.since)) {
      errors.push({ field: 'compatibility.sourceWindow', code: 'incompatible_context' });
    }
    if (normText(decisionWindow.end) && normText(contextWindow.until)
      && !sameText(decisionWindow.end, contextWindow.until)) {
      errors.push({ field: 'compatibility.sourceWindow', code: 'incompatible_context' });
    }
  }
}

function validateLineage(lineage, decision, context, errors) {
  if (!assertAllowlist(lineage, ALLOWED_LINEAGE, 'lineage', errors)) return;
  if (!isCanonicalUuid(lineage.decisionId)) errors.push({ field: 'lineage.decisionId', code: 'invalid_uuid' });
  if (!isCanonicalUuid(lineage.decisionContextId)) {
    errors.push({ field: 'lineage.decisionContextId', code: 'invalid_uuid' });
  }
  assertUuidList('lineage.contributingAgentRunIds', lineage.contributingAgentRunIds, errors);
  assertUuidList('lineage.orchestrationSetIds', lineage.orchestrationSetIds, errors);
  if (lineage.decisionContractVersion !== DECISION_CONTRACT_VERSION) {
    errors.push({ field: 'lineage.decisionContractVersion', code: 'incompatible_decision_contract' });
  }
  if (lineage.decisionContextContractVersion !== DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({ field: 'lineage.decisionContextContractVersion', code: 'incompatible_decision_context_contract' });
  }
  if (lineage.evidenceContractVersion !== EVIDENCE_CONTRACT_VERSION) {
    errors.push({ field: 'lineage.evidenceContractVersion', code: 'incompatible_evidence_contract' });
  }
  if (lineage.orchestrationContractVersion !== ORCHESTRATION_CONTRACT_VERSION) {
    errors.push({ field: 'lineage.orchestrationContractVersion', code: 'incompatible_orchestration_contract' });
  }
  if (lineage.controlChainContractVersion !== CONTROL_CHAIN_CONTRACT_VERSION) {
    errors.push({ field: 'lineage.controlChainContractVersion', code: 'incompatible_control_chain_contract' });
  }
  if (decision?.decisionId && lineage.decisionId !== decision.decisionId) {
    errors.push({ field: 'lineage.decisionId', code: 'lineage_decision_mismatch' });
  }
  if (context?.contextId && lineage.decisionContextId !== context.contextId) {
    errors.push({ field: 'lineage.decisionContextId', code: 'lineage_context_mismatch' });
  }
}

function validateProvenance(provenance, errors) {
  if (!assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors)) return;
  assertString('provenance.writer', provenance.writer, errors, { required: true });
  assertString('provenance.methodKey', provenance.methodKey, errors, { required: true });
  assertString('provenance.stage', provenance.stage, errors, { required: true });
  if (!isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_timestamp' });
  }
  if (provenance.stage !== CONTROL_CHAIN_STAGE) {
    errors.push({ field: 'provenance.stage', code: 'invalid_stage' });
  }
  assertString('provenance.note', provenance.note, errors);
}

function validateEvidenceRef(ref, field, expectedAgentId, expectedAuthority, allowedOutcomes, errors) {
  if (ref == null) return;
  if (!assertAllowlist(ref, ALLOWED_EVIDENCE_REF, field, errors)) return;
  if (ref.agentId !== expectedAgentId) {
    errors.push({ field: `${field}.agentId`, code: 'invalid_agent_id', expected: expectedAgentId });
  }
  if (ref.authorityClass !== expectedAuthority) {
    errors.push({ field: `${field}.authorityClass`, code: 'invalid_authority_class', expected: expectedAuthority });
  }
  if (ref.runId != null && !isCanonicalUuid(ref.runId)) {
    errors.push({ field: `${field}.runId`, code: 'invalid_uuid' });
  }
  if (ref.outcome != null && !Object.values(allowedOutcomes).includes(ref.outcome)) {
    errors.push({ field: `${field}.outcome`, code: 'invalid_outcome' });
  }
  if (ref.freshness != null && !Object.values(FRESHNESS_STATUS).includes(ref.freshness)) {
    errors.push({ field: `${field}.freshness`, code: 'invalid_freshness' });
  }
  for (const key of PORTFOLIO_DIRECTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(ref, key)) {
      errors.push({ field: `${field}.${key}`, code: 'direction_forbidden' });
    }
  }
}

function validateRiskRef(ref, errors) {
  validateEvidenceRef(ref, 'riskEvidenceRef', 'risk', AUTHORITY_CLASS.CONTROL_VETO, RISK_GATE_OUTCOME, errors);
  if (!ref) return;
  if (ref.outcome === RISK_GATE_OUTCOME.PASS
    && (ref.freshness === FRESHNESS_STATUS.STALE
      || ref.freshness === FRESHNESS_STATUS.EXPIRED
      || ref.freshness === FRESHNESS_STATUS.UNKNOWN)) {
    errors.push({ field: 'riskEvidenceRef', code: 'stale_risk_cannot_pass' });
  }
  if (ref.limit != null && !(typeof ref.limit === 'number' && Number.isFinite(ref.limit) && ref.limit >= 0)) {
    errors.push({ field: 'riskEvidenceRef.limit', code: 'invalid_limit' });
  }
}

function validatePortfolioRef(ref, riskRef, errors) {
  validateEvidenceRef(
    ref,
    'portfolioEvidenceRef',
    'portfolio',
    AUTHORITY_CLASS.CONTROL_SIZING,
    PORTFOLIO_GATE_OUTCOME,
    errors,
  );
  if (!ref) return;
  if (ref.accountStateAvailable === false && ref.outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE) {
    errors.push({ field: 'portfolioEvidenceRef', code: 'missing_account_state' });
  }
  const hasBounds = [ref.min, ref.max, ref.recommended].some((value) => value != null);
  if (hasBounds) {
    for (const key of ['min', 'max', 'recommended']) {
      if (ref[key] != null && !(typeof ref[key] === 'number' && Number.isFinite(ref[key]))) {
        errors.push({ field: `portfolioEvidenceRef.${key}`, code: 'invalid_bounds' });
      }
    }
    if (typeof ref.min === 'number' && typeof ref.max === 'number' && ref.min > ref.max) {
      errors.push({ field: 'portfolioEvidenceRef', code: 'invalid_bounds' });
    }
    if (typeof ref.recommended === 'number') {
      if (typeof ref.min === 'number' && ref.recommended < ref.min) {
        errors.push({ field: 'portfolioEvidenceRef.recommended', code: 'recommended_out_of_bounds' });
      }
      if (typeof ref.max === 'number' && ref.recommended > ref.max) {
        errors.push({ field: 'portfolioEvidenceRef.recommended', code: 'recommended_out_of_bounds' });
      }
    }
  }
  if (riskRef?.outcome === RISK_GATE_OUTCOME.REJECT && hasBounds) {
    errors.push({ field: 'portfolioEvidenceRef', code: 'usable_sizing_after_veto' });
  }
  if (riskRef?.outcome === RISK_GATE_OUTCOME.LIMIT
    && typeof riskRef.limit === 'number'
    && typeof ref.max === 'number'
    && ref.max > riskRef.limit) {
    errors.push({ field: 'portfolioEvidenceRef.max', code: 'portfolio_max_exceeds_risk_limit' });
  }
}

function validateLiquidityRef(ref, errors) {
  validateEvidenceRef(
    ref,
    'liquidityEvidenceRef',
    'liquidity',
    AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
    LIQUIDITY_GATE_OUTCOME,
    errors,
  );
  if (!ref) return;
  if (ref.bookTimestamp != null && !isIsoTimestamp(ref.bookTimestamp)) {
    errors.push({ field: 'liquidityEvidenceRef.bookTimestamp', code: 'invalid_timestamp' });
  }
  if (ref.expiryTimestamp != null && !isIsoTimestamp(ref.expiryTimestamp)) {
    errors.push({ field: 'liquidityEvidenceRef.expiryTimestamp', code: 'invalid_timestamp' });
  }
  if (ref.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE) {
    if (!isIsoTimestamp(ref.bookTimestamp)) {
      errors.push({ field: 'liquidityEvidenceRef.bookTimestamp', code: 'missing_book_timestamp' });
    }
    const staleFreshness = ref.freshness === FRESHNESS_STATUS.STALE
      || ref.freshness === FRESHNESS_STATUS.EXPIRED
      || ref.freshness === FRESHNESS_STATUS.UNKNOWN
      || ref.freshness == null;
    if (staleFreshness) {
      errors.push({ field: 'liquidityEvidenceRef', code: 'stale_liquidity_cannot_be_feasible' });
    }
    if (isIsoTimestamp(ref.expiryTimestamp) && Date.parse(ref.expiryTimestamp) < Date.parse('2026-09-05T00:00:00.000Z')
      && false) {
      // placeholder kept out of live clock; expiry vs recordedAt checked in gate derivation
    }
  }
}

function validateRuntimeSnapshot(snapshot, errors) {
  if (snapshot == null) return;
  if (!assertAllowlist(snapshot, ALLOWED_RUNTIME_SNAPSHOT, 'runtimeSnapshot', errors)) return;
  const kill = snapshot.killSwitchActive;
  if (kill !== true && kill !== false && kill !== 'unknown' && kill != null) {
    errors.push({ field: 'runtimeSnapshot.killSwitchActive', code: 'invalid_kill_switch' });
  }
  if (snapshot.requestedRuntimeMode === REQUESTED_RUNTIME_MODE.LIVE
    || snapshot.effectiveRuntimeMode === REQUESTED_RUNTIME_MODE.LIVE
    || snapshot.requestedRuntimeMode === 'live'
    || snapshot.effectiveRuntimeMode === 'live') {
    errors.push({ field: 'runtimeSnapshot', code: 'live_runtime_mode_rejected' });
  }
  if (snapshot.requestedRuntimeMode != null && !ALLOWED_REQUESTED_MODES.has(snapshot.requestedRuntimeMode)) {
    if (snapshot.requestedRuntimeMode !== REQUESTED_RUNTIME_MODE.LIVE) {
      errors.push({ field: 'runtimeSnapshot.requestedRuntimeMode', code: 'invalid_runtime_mode' });
    }
  }
  if (snapshot.effectiveRuntimeMode != null && !ALLOWED_EVALUATION_MODES.has(snapshot.effectiveRuntimeMode)) {
    errors.push({ field: 'runtimeSnapshot.effectiveRuntimeMode', code: 'live_runtime_mode_rejected' });
  }
  if (snapshot.capabilityState != null && !Object.values(CAPABILITY_STATE).includes(snapshot.capabilityState)) {
    errors.push({ field: 'runtimeSnapshot.capabilityState', code: 'invalid_capability_state' });
  }
  if (snapshot.ssotAvailable != null && typeof snapshot.ssotAvailable !== 'boolean') {
    errors.push({ field: 'runtimeSnapshot.ssotAvailable', code: 'invalid_ssot_available' });
  }
  assertString('runtimeSnapshot.ssotOwner', snapshot.ssotOwner, errors);
}

function assertHardFlags(obj, errors, prefix = '') {
  if (obj.decisionEligible !== false) {
    errors.push({ field: `${prefix}decisionEligible`, code: 'must_be_false' });
  }
  if (obj.executionEligible !== false) {
    errors.push({ field: `${prefix}executionEligible`, code: 'must_be_false' });
  }
  if (obj.approvedForExecution !== false) {
    errors.push({ field: `${prefix}approvedForExecution`, code: 'must_be_false' });
  }
  if (obj.controlChainStarted !== false) {
    errors.push({ field: `${prefix}controlChainStarted`, code: 'must_be_false' });
  }
  if (obj.ordersCreated !== 0) {
    errors.push({ field: `${prefix}ordersCreated`, code: 'must_be_zero' });
  }
  if (obj.liveTradingEnabled !== false) {
    errors.push({ field: `${prefix}liveTradingEnabled`, code: 'must_be_false' });
  }
}

function assertZeroSideEffects(sideEffects, errors) {
  if (!sideEffects || typeof sideEffects !== 'object') {
    errors.push({ field: 'sideEffects', code: 'required_object' });
    return;
  }
  for (const [key, expected] of Object.entries(ZERO_CONTROL_CHAIN_SIDE_EFFECTS)) {
    if (sideEffects[key] !== expected) {
      errors.push({ field: `sideEffects.${key}`, code: 'side_effect_must_be_zero' });
    }
  }
}

function deriveRiskGate(ref) {
  if (!ref) {
    return {
      authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
      outcome: RISK_GATE_OUTCOME.UNAVAILABLE,
      freshness: FRESHNESS_STATUS.UNKNOWN,
      reasonKey: 'missing_required_risk_evidence',
      terminalVeto: false,
    };
  }
  const outcome = ref.outcome ?? RISK_GATE_OUTCOME.UNAVAILABLE;
  return {
    authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
    outcome,
    freshness: ref.freshness ?? FRESHNESS_STATUS.UNKNOWN,
    ...(typeof ref.limit === 'number' ? { limit: ref.limit } : {}),
    reasonKey: ref.reasonKey ?? (
      outcome === RISK_GATE_OUTCOME.UNAVAILABLE ? 'risk_unavailable_fail_closed' : 'risk_gate_contract_only'
    ),
    terminalVeto: outcome === RISK_GATE_OUTCOME.REJECT,
  };
}

function derivePortfolioGate(ref, riskGate) {
  if (riskGate.outcome === RISK_GATE_OUTCOME.REJECT) {
    return {
      authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
      outcome: PORTFOLIO_GATE_OUTCOME.UNAVAILABLE,
      reasonKey: 'risk_veto_blocks_sizing',
      usableSizingEmitted: false,
    };
  }
  if (!ref || ref.accountStateAvailable === false) {
    return {
      authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
      outcome: PORTFOLIO_GATE_OUTCOME.UNAVAILABLE,
      reasonKey: ref?.accountStateAvailable === false
        ? 'missing_canonical_account_state'
        : 'portfolio_not_evaluated',
      usableSizingEmitted: false,
    };
  }
  const gate = {
    authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
    outcome: ref.outcome ?? PORTFOLIO_GATE_OUTCOME.PENDING,
    reasonKey: ref.reasonKey ?? 'portfolio_gate_contract_only',
    usableSizingEmitted: false,
  };
  if (ref.unit != null) gate.unit = ref.unit;
  if (typeof ref.min === 'number') gate.min = ref.min;
  if (typeof ref.max === 'number') gate.max = ref.max;
  if (typeof ref.recommended === 'number') gate.recommended = ref.recommended;
  gate.usableSizingEmitted = [gate.min, gate.max, gate.recommended].some((value) => typeof value === 'number');
  return gate;
}

function deriveLiquidityGate(ref, recordedAt) {
  if (!ref) {
    return {
      authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
      outcome: LIQUIDITY_GATE_OUTCOME.BLOCKED,
      reasonKey: LIQUIDITY_BLOCKED_REASON,
      freshness: FRESHNESS_STATUS.UNKNOWN,
    };
  }
  let outcome = ref.outcome ?? LIQUIDITY_GATE_OUTCOME.BLOCKED;
  if (outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE) {
    const stale = ref.freshness === FRESHNESS_STATUS.STALE
      || ref.freshness === FRESHNESS_STATUS.EXPIRED
      || ref.freshness === FRESHNESS_STATUS.UNKNOWN
      || !isIsoTimestamp(ref.bookTimestamp);
    const expired = isIsoTimestamp(ref.expiryTimestamp)
      && isIsoTimestamp(recordedAt)
      && Date.parse(ref.expiryTimestamp) < Date.parse(recordedAt);
    if (stale || expired) outcome = LIQUIDITY_GATE_OUTCOME.STALE;
  }
  const gate = {
    authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
    outcome,
    reasonKey: ref.reasonKey ?? (
      outcome === LIQUIDITY_GATE_OUTCOME.BLOCKED ? LIQUIDITY_BLOCKED_REASON : 'liquidity_gate_contract_only'
    ),
    freshness: ref.freshness ?? FRESHNESS_STATUS.UNKNOWN,
  };
  if (isIsoTimestamp(ref.bookTimestamp)) gate.bookTimestamp = ref.bookTimestamp;
  if (isIsoTimestamp(ref.expiryTimestamp)) gate.expiryTimestamp = ref.expiryTimestamp;
  return gate;
}

function deriveRuntimeGate(snapshot, context) {
  const requested = snapshot?.requestedRuntimeMode ?? context?.mode?.requested ?? EFFECTIVE_RUNTIME_MODE.ADVISORY;
  const effective = snapshot?.effectiveRuntimeMode ?? context?.mode?.effective ?? EFFECTIVE_RUNTIME_MODE.ADVISORY;
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
    authorityClass: 'titangold_runtime_safety_ssot',
    outcome,
    killSwitchActive: kill,
    requestedRuntimeMode: requested,
    effectiveRuntimeMode: effective,
    capabilityState: capability,
    ssotAvailable,
    ssotOwner: snapshot?.ssotOwner ?? 'runtimeExecutionStateService',
    reasonKey,
  };
}

function deriveOrderMechanicsReadiness() {
  return {
    status: ORDER_MECHANICS_READINESS_STATUS.CONTRACT_ONLY,
    authorityClass: AUTHORITY_CLASS.EXECUTION,
    orderPresent: false,
    executionIntentPresent: false,
    providerSubmittable: false,
    idempotencyKeyPresent: false,
    reasonKey: 'order_mechanics_readiness_only',
  };
}

export function deriveAggregateControlOutcome({
  riskPresent,
  riskGate,
  portfolioGate,
  liquidityGate,
  runtimeGate,
} = {}) {
  if (runtimeGate?.outcome === RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED) {
    return CONTROL_OUTCOME.RUNTIME_BLOCKED;
  }
  if (riskGate?.outcome === RISK_GATE_OUTCOME.REJECT) return CONTROL_OUTCOME.VETOED;
  if (!riskPresent || riskGate?.outcome === RISK_GATE_OUTCOME.UNAVAILABLE) {
    return CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
  }
  if (liquidityGate?.outcome === LIQUIDITY_GATE_OUTCOME.STALE) return CONTROL_OUTCOME.STALE;
  if (liquidityGate?.outcome === LIQUIDITY_GATE_OUTCOME.INFEASIBLE) return CONTROL_OUTCOME.INFEASIBLE;
  if (riskGate?.outcome === RISK_GATE_OUTCOME.LIMIT) return CONTROL_OUTCOME.LIMITED;
  if (
    riskGate?.outcome === RISK_GATE_OUTCOME.PASS
    && liquidityGate?.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
    && runtimeGate?.outcome === RUNTIME_GATE_OUTCOME.CLEAR
    && portfolioGate?.usableSizingEmitted === true
  ) {
    return CONTROL_OUTCOME.CONTROL_PASS_BOUNDED;
  }
  if (liquidityGate?.outcome === LIQUIDITY_GATE_OUTCOME.BLOCKED) return CONTROL_OUTCOME.HOLD_EVALUATION;
  return CONTROL_OUTCOME.NOT_EVALUATED;
}

function deriveLifecycle({ riskPresent, riskGate, liquidityGate, runtimeGate, controlOutcome }) {
  if (controlOutcome === CONTROL_OUTCOME.RUNTIME_BLOCKED) return CONTROL_CHAIN_LIFECYCLE.BLOCKED;
  if (!riskPresent || riskGate?.outcome === RISK_GATE_OUTCOME.UNAVAILABLE) {
    return CONTROL_CHAIN_LIFECYCLE.INSUFFICIENT_INPUT;
  }
  if (liquidityGate?.outcome === LIQUIDITY_GATE_OUTCOME.STALE) return CONTROL_CHAIN_LIFECYCLE.STALE_INPUT;
  if (liquidityGate?.outcome === LIQUIDITY_GATE_OUTCOME.BLOCKED) return CONTROL_CHAIN_LIFECYCLE.BLOCKED;
  if (controlOutcome === CONTROL_OUTCOME.CONTROL_PASS_BOUNDED) {
    return CONTROL_CHAIN_LIFECYCLE.EVALUATED_COMPLETE;
  }
  if (runtimeGate?.outcome === RUNTIME_GATE_OUTCOME.CLEAR && riskPresent) {
    return CONTROL_CHAIN_LIFECYCLE.EVALUATED_PARTIAL;
  }
  return CONTROL_CHAIN_LIFECYCLE.CONTRACT_ONLY;
}

/**
 * @param {unknown} input
 * @returns {{ ok: true } | { ok: false, code: string, message: string, errors: object[] }}
 */
export function validateControlChainInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Control chain input must be a plain object', { errors: [{ field: 'input', code: 'required_object' }] });
  }
  const errors = [];
  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Unknown control chain input fields', { errors });
  }

  const forbiddenKeys = collectForbiddenKeys(input);
  if (forbiddenKeys.includes('orderId')) {
    errors.push({ field: 'orderId', code: 'forbidden_key' });
  }
  if (forbiddenKeys.includes('apiKey')) {
    errors.push({ field: 'apiKey', code: 'forbidden_key' });
  }
  forbiddenKeys.forEach((key) => {
    if (key !== 'orderId' && key !== 'apiKey') {
      errors.push({ field: key, code: 'forbidden_key' });
    }
  });
  const authorityValues = collectForbiddenAuthorityValues(input);
  if (authorityValues.includes('BUY')) errors.push({ field: 'input', code: 'buy_rejected' });
  if (authorityValues.includes('SELL')) errors.push({ field: 'input', code: 'sell_rejected' });
  authorityValues.forEach((value) => {
    if (value !== 'BUY' && value !== 'SELL') {
      errors.push({ field: 'input', code: 'forbidden_execution_authority_value', value });
    }
  });
  const secretKeys = collectForbiddenSecretKeys(input);
  if (secretKeys.length) {
    errors.push({ field: 'input', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  if (input.requestedOperationClass === 'place_order'
    || FORBIDDEN_OPERATION_CLASS.includes(input.requestedOperationClass)) {
    errors.push({ field: 'requestedOperationClass', code: 'place_order_rejected' });
  } else if (input.requestedOperationClass != null
    && !Object.values(REQUESTED_OPERATION_CLASS).includes(input.requestedOperationClass)) {
    errors.push({ field: 'requestedOperationClass', code: 'invalid_operation_class' });
  }

  if (input.artemisCognitiveDecision == null) {
    errors.push({ field: 'artemisCognitiveDecision', code: 'invalid_cognitive_decision' });
  } else {
    validateCognitiveDecision(input.artemisCognitiveDecision, errors);
  }
  if (input.decisionContext == null) {
    errors.push({ field: 'decisionContext', code: 'invalid_decision_context' });
  } else {
    validateDecisionContextShape(input.decisionContext, errors);
    if (input.artemisCognitiveDecision) {
      validateCompatibility(input.artemisCognitiveDecision, input.decisionContext, errors);
    }
  }
  if (input.lineage == null) {
    errors.push({ field: 'lineage', code: 'required_object' });
  } else {
    validateLineage(input.lineage, input.artemisCognitiveDecision, input.decisionContext, errors);
  }
  if (input.provenance == null) {
    errors.push({ field: 'provenance', code: 'required_object' });
  } else {
    validateProvenance(input.provenance, errors);
  }

  validateRiskRef(input.riskEvidenceRef, errors);
  validatePortfolioRef(input.portfolioEvidenceRef, input.riskEvidenceRef, errors);
  validateLiquidityRef(input.liquidityEvidenceRef, errors);
  if (input.liquidityEvidenceRef?.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
    && isIsoTimestamp(input.liquidityEvidenceRef.expiryTimestamp)
    && isIsoTimestamp(input.provenance?.recordedAt)
    && Date.parse(input.liquidityEvidenceRef.expiryTimestamp) < Date.parse(input.provenance.recordedAt)) {
    errors.push({ field: 'liquidityEvidenceRef.expiryTimestamp', code: 'expired_liquidity_cannot_be_feasible' });
  }
  validateRuntimeSnapshot(input.runtimeSnapshot, errors);

  if (errors.some((error) => error.code === 'incompatible_context')) {
    return fail(
      CONTROL_CHAIN_LIFECYCLE.INCOMPATIBLE_CONTEXT,
      'Control chain input is incompatible with Decision Context',
      { errors },
    );
  }
  if (errors.length) {
    return fail('validation_failed', 'Control chain input failed validation', { errors });
  }
  return { ok: true };
}

function validateGateEnvelope(gate, field, allowed, outcomeTable, errors) {
  if (!assertAllowlist(gate, allowed, field, errors)) return;
  if (gate.authorityClass == null) errors.push({ field: `${field}.authorityClass`, code: 'required' });
  if (!Object.values(outcomeTable).includes(gate.outcome) && field !== 'runtimeGate' && field !== 'orderMechanicsReadiness') {
    errors.push({ field: `${field}.outcome`, code: 'invalid_outcome' });
  }
}

/**
 * @param {unknown} artifact
 */
export function validateControlChainArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return fail('invalid_artifact', 'ControlChainArtifact must be a plain object', {
      errors: [{ field: 'artifact', code: 'required_object' }],
    });
  }
  const errors = [];
  const forbidden = collectForbiddenKeys(artifact);
  forbidden.forEach((key) => errors.push({ field: key, code: 'forbidden_key' }));
  if (!assertAllowlist(artifact, ALLOWED_ARTIFACT_TOP, 'artifact', errors)) {
    return fail('unknown_field', 'Unknown ControlChainArtifact fields', { errors });
  }
  if (artifact.schemaVersion !== CONTROL_CHAIN_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'bad_schema_version' });
  }
  if (artifact.contractVersion !== CONTROL_CHAIN_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'bad_contract_version' });
  }
  if (artifact.policyVersion !== CONTROL_CHAIN_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', code: 'bad_policy_version' });
  }
  if (!isCanonicalUuid(artifact.controlChainArtifactId)) {
    errors.push({ field: 'controlChainArtifactId', code: 'invalid_uuid' });
  }
  if (!isCanonicalUuid(artifact.decisionId)) errors.push({ field: 'decisionId', code: 'invalid_uuid' });
  if (!isCanonicalUuid(artifact.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (!inEnum(artifact.lifecycle, CONTROL_CHAIN_LIFECYCLE)) {
    errors.push({ field: 'lifecycle', code: 'invalid_lifecycle' });
  }
  if (!inEnum(artifact.controlOutcome, CONTROL_OUTCOME)) {
    errors.push({ field: 'controlOutcome', code: 'invalid_control_outcome' });
  }
  if (!Object.values(REQUESTED_OPERATION_CLASS).includes(artifact.requestedOperationClass)) {
    errors.push({ field: 'requestedOperationClass', code: 'invalid_operation_class' });
  }
  assertHardFlags(artifact, errors);
  if (artifact.controlOutcome === CONTROL_OUTCOME.CONTROL_PASS_BOUNDED) {
    if (artifact.approvedForExecution === true || artifact.executionEligible === true) {
      errors.push({ field: 'controlOutcome', code: 'control_pass_bounded_not_execution' });
    }
  }

  validateGateEnvelope(artifact.riskGate, 'riskGate', ALLOWED_RISK_GATE, RISK_GATE_OUTCOME, errors);
  if (artifact.riskGate?.authorityClass !== AUTHORITY_CLASS.CONTROL_VETO) {
    errors.push({ field: 'riskGate.authorityClass', code: 'must_be_control_veto' });
  }
  validateGateEnvelope(artifact.portfolioGate, 'portfolioGate', ALLOWED_PORTFOLIO_GATE, PORTFOLIO_GATE_OUTCOME, errors);
  if (artifact.portfolioGate?.authorityClass !== AUTHORITY_CLASS.CONTROL_SIZING) {
    errors.push({ field: 'portfolioGate.authorityClass', code: 'must_be_control_sizing' });
  }
  if (artifact.portfolioGate) {
    for (const key of PORTFOLIO_DIRECTION_KEYS) {
      if (Object.prototype.hasOwnProperty.call(artifact.portfolioGate, key)) {
        errors.push({ field: `portfolioGate.${key}`, code: 'direction_forbidden' });
      }
    }
    const { min, max, recommended } = artifact.portfolioGate;
    if (typeof recommended === 'number') {
      if (typeof min === 'number' && recommended < min) {
        errors.push({ field: 'portfolioGate.recommended', code: 'recommended_out_of_bounds' });
      }
      if (typeof max === 'number' && recommended > max) {
        errors.push({ field: 'portfolioGate.recommended', code: 'recommended_out_of_bounds' });
      }
    }
    if (artifact.riskGate?.outcome === RISK_GATE_OUTCOME.LIMIT
      && typeof artifact.riskGate.limit === 'number'
      && typeof max === 'number'
      && max > artifact.riskGate.limit) {
      errors.push({ field: 'portfolioGate.max', code: 'portfolio_max_exceeds_risk_limit' });
    }
    if (artifact.riskGate?.outcome === RISK_GATE_OUTCOME.REJECT
      && artifact.portfolioGate.usableSizingEmitted === true) {
      errors.push({ field: 'portfolioGate', code: 'usable_sizing_after_veto' });
    }
  }

  validateGateEnvelope(artifact.liquidityGate, 'liquidityGate', ALLOWED_LIQUIDITY_GATE, LIQUIDITY_GATE_OUTCOME, errors);
  if (artifact.liquidityGate?.authorityClass !== AUTHORITY_CLASS.EXECUTION_FEASIBILITY) {
    errors.push({ field: 'liquidityGate.authorityClass', code: 'must_be_execution_feasibility' });
  }
  if (artifact.liquidityGate?.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE) {
    const liq = artifact.liquidityGate;
    if (!isIsoTimestamp(liq.bookTimestamp)) {
      errors.push({ field: 'liquidityGate.bookTimestamp', code: 'missing_book_timestamp' });
    }
    if (liq.freshness !== FRESHNESS_STATUS.FRESH) {
      errors.push({ field: 'liquidityGate', code: 'stale_liquidity_cannot_be_feasible' });
    }
    if (isIsoTimestamp(liq.expiryTimestamp) && isIsoTimestamp(artifact.generatedAt)
      && Date.parse(liq.expiryTimestamp) < Date.parse(artifact.generatedAt)) {
      errors.push({ field: 'liquidityGate.expiryTimestamp', code: 'expired_liquidity_cannot_be_feasible' });
    }
  }
  if (artifact.liquidityGate?.outcome === LIQUIDITY_GATE_OUTCOME.BLOCKED
    && artifact.liquidityGate.reasonKey !== LIQUIDITY_BLOCKED_REASON
    && artifact.liquidityGate.reasonKey !== 'liquidity_gate_contract_only') {
    errors.push({ field: 'liquidityGate.reasonKey', code: 'unexpected_blocked_reason' });
  }

  if (!assertAllowlist(artifact.runtimeGate, ALLOWED_RUNTIME_GATE, 'runtimeGate', errors)) {
    /* already recorded */
  } else if (!Object.values(RUNTIME_GATE_OUTCOME).includes(artifact.runtimeGate.outcome)) {
    errors.push({ field: 'runtimeGate.outcome', code: 'invalid_outcome' });
  }
  if (artifact.runtimeGate?.requestedRuntimeMode === REQUESTED_RUNTIME_MODE.LIVE
    || artifact.runtimeGate?.effectiveRuntimeMode === REQUESTED_RUNTIME_MODE.LIVE) {
    errors.push({ field: 'runtimeGate', code: 'live_runtime_mode_rejected' });
  }

  if (!assertAllowlist(
    artifact.orderMechanicsReadiness,
    ALLOWED_ORDER_READINESS,
    'orderMechanicsReadiness',
    errors,
  )) {
    /* already recorded */
  } else {
    const readiness = artifact.orderMechanicsReadiness;
    if (readiness.orderPresent !== false
      || readiness.executionIntentPresent !== false
      || readiness.providerSubmittable !== false) {
      errors.push({ field: 'orderMechanicsReadiness', code: 'readiness_cannot_become_order' });
    }
    if (readiness.authorityClass !== AUTHORITY_CLASS.EXECUTION) {
      errors.push({ field: 'orderMechanicsReadiness.authorityClass', code: 'must_be_execution_mechanics' });
    }
  }

  validateLineage(artifact.lineage, { decisionId: artifact.decisionId }, { contextId: artifact.decisionContextId }, errors);
  validateProvenance(artifact.provenance, errors);
  if (!Array.isArray(artifact.limitations) || !artifact.limitations.length) {
    errors.push({ field: 'limitations', code: 'required_array' });
  } else if (artifact.limitations.length > MAX_LIMITATIONS) {
    errors.push({ field: 'limitations', code: 'too_many' });
  }
  assertZeroSideEffects(artifact.sideEffects, errors);
  if (!isIsoTimestamp(artifact.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_timestamp' });
  }
  const secretKeys = collectForbiddenSecretKeys(artifact);
  if (secretKeys.length) {
    errors.push({ field: 'artifact', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }
  const bytes = utf8ByteLength(artifact);
  if (bytes > MAX_CONTROL_CHAIN_UTF8_BYTES) {
    errors.push({ field: 'artifact', code: 'too_large', bytes });
  }
  if (errors.length) {
    return fail('validation_failed', 'ControlChainArtifact failed validation', { errors, bytes });
  }
  return { ok: true, bytes };
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

/**
 * Build a contract-only ControlChainArtifact. Does not start a control-chain
 * service and never authorizes execution.
 *
 * @param {object} input validateControlChainInput-compatible object
 * @returns {{ ok: true, artifact: object } | { ok: false, code: string, message: string, errors?: object[] }}
 */
export function buildContractOnlyControlChainArtifact(input = {}) {
  const validated = validateControlChainInput(input);
  if (!validated.ok) return validated;

  const recordedAt = input.provenance.recordedAt;
  const riskPresent = Boolean(input.riskEvidenceRef);
  const riskGate = deriveRiskGate(input.riskEvidenceRef);
  const portfolioGate = derivePortfolioGate(input.portfolioEvidenceRef, riskGate);
  const liquidityGate = deriveLiquidityGate(input.liquidityEvidenceRef, recordedAt);
  const runtimeGate = deriveRuntimeGate(input.runtimeSnapshot, input.decisionContext);
  const orderMechanicsReadiness = deriveOrderMechanicsReadiness();
  const controlOutcome = deriveAggregateControlOutcome({
    riskPresent,
    riskGate,
    portfolioGate,
    liquidityGate,
    runtimeGate,
  });
  const lifecycle = input.lifecycleOverride && inEnum(input.lifecycleOverride, CONTROL_CHAIN_LIFECYCLE)
    ? input.lifecycleOverride
    : deriveLifecycle({ riskPresent, riskGate, liquidityGate, runtimeGate, controlOutcome });

  const decision = input.artemisCognitiveDecision;
  const context = input.decisionContext;
  const artifactId = hashToUuid([
    CONTROL_CHAIN_CONTRACT_VERSION,
    decision.decisionId,
    context.contextId,
    recordedAt,
    controlOutcome,
    lifecycle,
  ]);

  const artifact = {
    schemaVersion: CONTROL_CHAIN_SCHEMA_VERSION,
    contractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    policyVersion: CONTROL_CHAIN_POLICY_VERSION,
    controlChainArtifactId: artifactId,
    decisionId: decision.decisionId,
    decisionContextId: context.contextId,
    lifecycle: CONTROL_CHAIN_LIFECYCLE.CONTRACT_ONLY,
    controlOutcome,
    requestedOperationClass: input.requestedOperationClass ?? REQUESTED_OPERATION_CLASS.OBSERVE,
    riskGate,
    portfolioGate,
    liquidityGate,
    runtimeGate,
    orderMechanicsReadiness,
    lineage: {
      ...input.lineage,
      controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    },
    provenance: {
      writer: CONTROL_CHAIN_WRITER,
      methodKey: 'buildContractOnlyControlChainArtifact',
      stage: CONTROL_CHAIN_STAGE,
      recordedAt,
      note: input.provenance.note ?? 'control_chain_contract_only',
    },
    limitations: [...CONTROL_CHAIN_LIMITATIONS],
    sideEffects: { ...ZERO_CONTROL_CHAIN_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
    generatedAt: recordedAt,
  };

  if (lifecycle !== CONTROL_CHAIN_LIFECYCLE.CONTRACT_ONLY) {
    artifact.lifecycle = CONTROL_CHAIN_LIFECYCLE.CONTRACT_ONLY;
    artifact.limitations = [...artifact.limitations, `derived_lifecycle_${lifecycle}`];
  }

  const artifactValidation = validateControlChainArtifact(artifact);
  if (!artifactValidation.ok) return artifactValidation;
  return { ok: true, artifact };
}

export {
  buildContractOnlyArtemisDecision,
  validateArtemisDecision,
};

export default {
  CONTROL_CHAIN_STAGE,
  CONTROL_CHAIN_SCHEMA_VERSION,
  CONTROL_CHAIN_CONTRACT_VERSION,
  CONTROL_CHAIN_POLICY_VERSION,
  CONTROL_CHAIN_LIFECYCLE,
  CONTROL_OUTCOME,
  validateControlChainInput,
  validateControlChainArtifact,
  buildContractOnlyControlChainArtifact,
  deriveAggregateControlOutcome,
};
