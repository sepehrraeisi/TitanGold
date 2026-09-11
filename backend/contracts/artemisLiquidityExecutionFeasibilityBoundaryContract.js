/**
 * Artemis Core Stage 7.3.2.c.4 — Liquidity EXECUTION_FEASIBILITY boundary / projector.
 *
 * Library-only projector that converts allowlisted, truthful Liquidity evidence into
 * the exact liquidityEvidenceRef shape required by artemisControlChainContract.js
 * (Stage 7.3.1), with Portfolio sizing binding and Risk REJECT/UNAVAILABLE/LIMIT gates.
 *
 * Canonical Liquidity SoT (consumed as allowlisted evidence only — not imported):
 *   - backend/services/agents/liquidity.js
 *   - backend/services/liquidity/LiquidityAnalyzerService.ts
 *   - backend/services/liquidity/liquidity.types.ts
 *   - backend/services/liquidity/liquidity.config.ts (threshold policy mirrored below)
 *   - backend/services/artemisEvidenceAdapters/liquidityAdapter.js
 *
 * Does NOT:
 *   - invent BUY/SELL/LONG/SHORT or trading thesis
 *   - override Risk / Portfolio max
 *   - approve execution by itself
 *   - place/cancel/modify orders
 *   - change runtime mode / clear Emergency Stop / enable Live
 *   - call LLM / provider / HTTP / network
 *   - access DB / Redis
 *   - fabricate balances, book metrics, spread, slippage, impact, or maxFeasibleSize
 *   - accept MoE / votes / ModelAssistedContribution as authority
 *
 * Placement:
 *   Liquidity evidence (allowlisted) + portfolioEvidenceRef + riskEvidenceRef
 *     → this projector → liquidityEvidenceRef
 *     → Control Chain liquidityGate (NOT wired here)
 */

import {
  AUTHORITY_CLASS,
  AVAILABILITY,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  FRESHNESS_STATUS,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  CONTROL_CHAIN_CONTRACT_VERSION,
  CONTROL_OUTCOME,
  FORBIDDEN_CONTROL_CHAIN_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  LIQUIDITY_GATE_OUTCOME,
  PORTFOLIO_GATE_OUTCOME,
  RISK_GATE_OUTCOME,
  ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
} from './artemisControlChainContract.js';

export const LIQUIDITY_FEASIBILITY_STAGE = '7.3.2.c.4';
export const LIQUIDITY_FEASIBILITY_SCHEMA_VERSION = '1.0.0';
export const LIQUIDITY_FEASIBILITY_CONTRACT_VERSION = 'artemis-liquidity-execution-feasibility-1.0.0';
export const LIQUIDITY_FEASIBILITY_POLICY_VERSION = 'stage7-3-2-c4-liquidity-execution-feasibility-1.0.0';
export const LIQUIDITY_FEASIBILITY_WRITER = 'artemisLiquidityExecutionFeasibilityBoundaryContract';
export const LIQUIDITY_FEASIBILITY_METHOD_KEY = 'project_liquidity_evidence_ref_fail_closed';

export const REQUIRED_CONTROL_CHAIN_CONTRACT_VERSION = CONTROL_CHAIN_CONTRACT_VERSION;
export const REQUIRED_EVIDENCE_CONTRACT_VERSION = EVIDENCE_CONTRACT_VERSION;

export const MAX_PROJECTOR_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 512;

/**
 * Frozen policy thresholds mirrored from liquidity.config.ts DEFAULT_THRESHOLDS
 * (and a bounded marketImpact policy). Do not invent demo values at runtime.
 */
export const LIQUIDITY_FEASIBILITY_POLICY = Object.freeze({
  maxSpreadPct: 0.5,
  maxExpectedSlippagePct: 0.5,
  maxMarketImpactPct: 1.0,
});

/** Order-book side only — never BUY/SELL/LONG/SHORT authority values. */
export const LIQUIDITY_SIDE = Object.freeze({
  BID: 'bid',
  ASK: 'ask',
});

export const VENUE_STATE = Object.freeze({
  OPEN: 'open',
  TRADING: 'trading',
  HALTED: 'halted',
  CLOSED: 'closed',
  UNKNOWN: 'unknown',
});

export const PROVIDER_CAPABILITY = Object.freeze({
  GRANTED: 'granted',
  DENIED: 'denied',
  UNKNOWN: 'unknown',
});

export const ZERO_LIQUIDITY_FEASIBILITY_SIDE_EFFECTS = Object.freeze({
  ...ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
  llmCallCount: 0,
  networkRequestCount: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  liveTradingEnabled: false,
  providerConnected: false,
  llmCallCount: 0,
  networkRequestCount: 0,
});

export const LIQUIDITY_FEASIBILITY_LIMITATIONS = Object.freeze([
  'stage7_3_2_c4_liquidity_execution_feasibility_only',
  'library_only',
  'execution_feasibility_only',
  'non_directional_thesis',
  'does_not_invent_order_book_metrics',
  'does_not_override_risk_or_portfolio',
  'does_not_approve_execution',
  'does_not_call_order_or_provider',
  'does_not_call_llm_or_network',
  'does_not_access_db_or_redis',
  'does_not_wire_control_chain_runtime',
  'live_trading_not_authorized',
  'canonical_liquidity_sot_reuse_only',
  'stub_order_book_not_feasible',
]);

/** Control-Chain-compatible liquidityEvidenceRef fields. */
export const ALLOWED_LIQUIDITY_EVIDENCE_REF_FIELDS = Object.freeze([
  'agentId',
  'runId',
  'authorityClass',
  'outcome',
  'freshness',
  'availability',
  'reasonKey',
  'limit',
  'unit',
  'min',
  'max',
  'recommended',
  'accountStateAvailable',
  'bookTimestamp',
  'expiryTimestamp',
]);

/**
 * Rich allowlisted liquidity evidence input (truthful metrics).
 * Measured fields are never fabricated by this projector.
 */
export const ALLOWED_LIQUIDITY_EVIDENCE_FIELDS = Object.freeze([
  'agentId',
  'runId',
  'authorityClass',
  'outcome',
  'freshness',
  'availability',
  'reasonKey',
  'venue',
  'symbol',
  'marketScope',
  'side',
  'proposedSize',
  'bookTimestamp',
  'spread',
  'expectedSlippage',
  'marketImpact',
  'maxFeasibleSize',
  'depth',
  'expiryTimestamp',
  'expiry',
  'limitations',
  'venueState',
  'providerCapability',
  'unit',
]);

export const ALLOWED_PORTFOLIO_EVIDENCE_REF_FIELDS = Object.freeze([
  'agentId',
  'runId',
  'authorityClass',
  'outcome',
  'freshness',
  'availability',
  'reasonKey',
  'limit',
  'unit',
  'min',
  'max',
  'recommended',
  'accountStateAvailable',
  'bookTimestamp',
  'expiryTimestamp',
]);

export const ALLOWED_RISK_EVIDENCE_REF_FIELDS = Object.freeze([
  'agentId',
  'runId',
  'authorityClass',
  'outcome',
  'freshness',
  'availability',
  'reasonKey',
  'limit',
  'unit',
  'min',
  'max',
  'recommended',
  'accountStateAvailable',
  'bookTimestamp',
  'expiryTimestamp',
]);

export const ALLOWED_IDENTITY_FIELDS = Object.freeze([
  'venue',
  'symbol',
  'marketScope',
  'side',
  'proposedSize',
]);

const ALLOWED_INPUT_TOP = Object.freeze([
  'liquidityEvidence',
  'portfolioEvidenceRef',
  'riskEvidenceRef',
  'identity',
  'lineage',
  'provenance',
  'decisionId',
  'decisionContextId',
  'recordedAt',
  'sourceContractVersion',
  'sourceEvidenceId',
  'orchestrationSetIds',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'decisionId',
  'decisionContextId',
  'agentId',
  'runId',
  'contributingAgentRunIds',
  'orchestrationSetIds',
  'sourceEvidenceId',
  'sourceContractVersion',
  'evidenceContractVersion',
  'controlChainContractVersion',
  'projectorContractVersion',
  'policyVersion',
]);

const ALLOWED_PROVENANCE = Object.freeze([
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
  'action',
  'buy',
  'sell',
  'BUY',
  'SELL',
  'LONG',
  'SHORT',
]);

const LEGACY_MOE_FORBIDDEN_KEYS = Object.freeze([
  'votes',
  'vote',
  'weightedVote',
  'weighted_vote',
  'majority',
  'majorityVote',
  'experts',
  'moe',
  'mixtureOfExperts',
  'artemisOrchestrator',
  'agentVotes',
  'consensus',
]);

const MODEL_ASSISTED_FORBIDDEN_KEYS = Object.freeze([
  'ModelAssistedContribution',
  'modelAssistedContribution',
  'modelAssisted',
  'modelContribution',
]);

const EXTRA_FORBIDDEN_KEYS = Object.freeze([
  ...FORBIDDEN_CONTROL_CHAIN_KEYS,
  ...MODEL_ASSISTED_FORBIDDEN_KEYS,
  'orderId',
  'executionIntent',
  'walletAction',
  'providerPayload',
  'raw',
  'payload',
  'credentials',
  'apiKey',
  'secret',
  'prompt',
  'modelResponse',
  'EXECUTE',
  'tradingThesis',
  'thesis',
]);

const OUTCOME_ALIASES = Object.freeze({
  feasible: LIQUIDITY_GATE_OUTCOME.FEASIBLE,
  FEASIBLE: LIQUIDITY_GATE_OUTCOME.FEASIBLE,
  infeasible: LIQUIDITY_GATE_OUTCOME.INFEASIBLE,
  INFEASIBLE: LIQUIDITY_GATE_OUTCOME.INFEASIBLE,
  stale: LIQUIDITY_GATE_OUTCOME.STALE,
  STALE: LIQUIDITY_GATE_OUTCOME.STALE,
  unavailable: LIQUIDITY_GATE_OUTCOME.UNAVAILABLE,
  UNAVAILABLE: LIQUIDITY_GATE_OUTCOME.UNAVAILABLE,
  blocked: LIQUIDITY_GATE_OUTCOME.BLOCKED,
  BLOCKED: LIQUIDITY_GATE_OUTCOME.BLOCKED,
  pending: LIQUIDITY_GATE_OUTCOME.PENDING,
  PENDING: LIQUIDITY_GATE_OUTCOME.PENDING,
  not_applicable: LIQUIDITY_GATE_OUTCOME.NOT_APPLICABLE,
  NOT_APPLICABLE: LIQUIDITY_GATE_OUTCOME.NOT_APPLICABLE,
});

const RISK_OUTCOME_ALIASES = Object.freeze({
  pass: RISK_GATE_OUTCOME.PASS,
  PASS: RISK_GATE_OUTCOME.PASS,
  limit: RISK_GATE_OUTCOME.LIMIT,
  LIMIT: RISK_GATE_OUTCOME.LIMIT,
  reject: RISK_GATE_OUTCOME.REJECT,
  REJECT: RISK_GATE_OUTCOME.REJECT,
  unavailable: RISK_GATE_OUTCOME.UNAVAILABLE,
  UNAVAILABLE: RISK_GATE_OUTCOME.UNAVAILABLE,
  not_applicable: RISK_GATE_OUTCOME.NOT_APPLICABLE,
  NOT_APPLICABLE: RISK_GATE_OUTCOME.NOT_APPLICABLE,
});

const PORTFOLIO_OUTCOME_ALIASES = Object.freeze({
  available: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
  AVAILABLE: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
  pending: PORTFOLIO_GATE_OUTCOME.PENDING,
  PENDING: PORTFOLIO_GATE_OUTCOME.PENDING,
  unavailable: PORTFOLIO_GATE_OUTCOME.UNAVAILABLE,
  UNAVAILABLE: PORTFOLIO_GATE_OUTCOME.UNAVAILABLE,
  not_applicable: PORTFOLIO_GATE_OUTCOME.NOT_APPLICABLE,
  NOT_APPLICABLE: PORTFOLIO_GATE_OUTCOME.NOT_APPLICABLE,
});

const UNSAFE_FEASIBLE_FRESHNESS = new Set([
  FRESHNESS_STATUS.STALE,
  FRESHNESS_STATUS.EXPIRED,
  FRESHNESS_STATUS.UNKNOWN,
  FRESHNESS_STATUS.UNAVAILABLE,
]);

const ALLOWED_VENUE_FOR_FEASIBLE = new Set([VENUE_STATE.OPEN, VENUE_STATE.TRADING]);

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

function collectKeysDeep(obj, acc = [], path = '') {
  if (!obj || typeof obj !== 'object') return acc;
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => collectKeysDeep(item, acc, `${path}[${index}]`));
    return acc;
  }
  for (const [key, nested] of Object.entries(obj)) {
    acc.push({ key, path: path ? `${path}.${key}` : key });
    collectKeysDeep(nested, acc, path ? `${path}.${key}` : key);
  }
  return acc;
}

function collectStringValuesDeep(value, acc = [], path = '') {
  if (typeof value === 'string') {
    acc.push({ value, path });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectStringValuesDeep(item, acc, `${path}[${index}]`));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, nested]) => {
      collectStringValuesDeep(nested, acc, path ? `${path}.${key}` : key);
    });
  }
  return acc;
}

function normalizeFreshness(value, errors, field = 'liquidityEvidence.freshness') {
  if (value == null) {
    errors.push({ field, code: 'missing_freshness' });
    return null;
  }
  if (typeof value === 'string') {
    if (!inEnum(value, FRESHNESS_STATUS)) {
      errors.push({ field, code: 'invalid_freshness' });
      return null;
    }
    return value;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (!Object.prototype.hasOwnProperty.call(value, 'status')) {
      errors.push({ field, code: 'malformed_freshness' });
      return null;
    }
    const status = value.status;
    if (typeof status !== 'string' || !inEnum(status, FRESHNESS_STATUS)) {
      errors.push({ field: `${field}.status`, code: 'invalid_freshness' });
      return null;
    }
    const unknown = Object.keys(value).filter((key) => key !== 'status');
    if (unknown.length) {
      errors.push({ field, code: 'malformed_freshness', fields: unknown });
      return null;
    }
    return status;
  }
  errors.push({ field, code: 'malformed_freshness' });
  return null;
}

function normalizeLiquidityOutcome(value, errors, field = 'liquidityEvidence.outcome') {
  if (value == null) {
    errors.push({ field, code: 'required' });
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid_outcome' });
    return null;
  }
  const mapped = OUTCOME_ALIASES[value];
  if (!mapped) {
    errors.push({ field, code: 'unknown_outcome', value });
    return null;
  }
  return mapped;
}

function normalizeRiskOutcome(value, errors, field = 'riskEvidenceRef.outcome') {
  if (value == null) {
    errors.push({ field, code: 'required' });
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid_outcome' });
    return null;
  }
  const mapped = RISK_OUTCOME_ALIASES[value];
  if (!mapped) {
    errors.push({ field, code: 'unknown_outcome', value });
    return null;
  }
  return mapped;
}

function normalizePortfolioOutcome(value, errors, field = 'portfolioEvidenceRef.outcome') {
  if (value == null) {
    errors.push({ field, code: 'required' });
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid_outcome' });
    return null;
  }
  const mapped = PORTFOLIO_OUTCOME_ALIASES[value];
  if (!mapped) {
    errors.push({ field, code: 'unknown_outcome', value });
    return null;
  }
  return mapped;
}

function assertFiniteNonNegative(field, value, errors, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    errors.push({ field, code: 'invalid_metric' });
  }
}

function assertFinitePositive(field, value, errors, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    errors.push({ field, code: 'invalid_proposed_size' });
  }
}

function resolveExpiryTimestamp(evidence) {
  if (evidence.expiryTimestamp != null) return evidence.expiryTimestamp;
  if (evidence.expiry != null) return evidence.expiry;
  return null;
}

function validateLiquidityEvidenceShape(evidence, errors) {
  if (!assertAllowlist(evidence, ALLOWED_LIQUIDITY_EVIDENCE_FIELDS, 'liquidityEvidence', errors)) {
    return { outcome: null, freshness: null };
  }

  if (evidence.agentId !== 'liquidity') {
    errors.push({ field: 'liquidityEvidence.agentId', code: 'invalid_agent_id', expected: 'liquidity' });
  }
  if (evidence.authorityClass !== AUTHORITY_CLASS.EXECUTION_FEASIBILITY) {
    errors.push({
      field: 'liquidityEvidence.authorityClass',
      code: 'authority_escalation',
      expected: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
    });
  }
  if (evidence.runId != null && !isCanonicalUuid(evidence.runId)) {
    errors.push({ field: 'liquidityEvidence.runId', code: 'invalid_uuid' });
  }
  assertString('liquidityEvidence.reasonKey', evidence.reasonKey, errors, { required: true });
  assertString('liquidityEvidence.venue', evidence.venue, errors);
  assertString('liquidityEvidence.symbol', evidence.symbol, errors);
  assertString('liquidityEvidence.marketScope', evidence.marketScope, errors);
  assertString('liquidityEvidence.unit', evidence.unit, errors);

  if (evidence.side != null) {
    if (evidence.side !== LIQUIDITY_SIDE.BID && evidence.side !== LIQUIDITY_SIDE.ASK) {
      errors.push({ field: 'liquidityEvidence.side', code: 'invalid_side' });
    }
  }

  if (evidence.availability != null && !inEnum(evidence.availability, AVAILABILITY)) {
    errors.push({ field: 'liquidityEvidence.availability', code: 'invalid_availability' });
  }
  if (evidence.bookTimestamp != null && !isIsoTimestamp(evidence.bookTimestamp)) {
    errors.push({ field: 'liquidityEvidence.bookTimestamp', code: 'invalid_timestamp' });
  }
  const expiryTs = resolveExpiryTimestamp(evidence);
  if (expiryTs != null && !isIsoTimestamp(expiryTs)) {
    errors.push({ field: 'liquidityEvidence.expiryTimestamp', code: 'invalid_timestamp' });
  }
  if (evidence.venueState != null && !inEnum(evidence.venueState, VENUE_STATE)) {
    errors.push({ field: 'liquidityEvidence.venueState', code: 'invalid_venue_state' });
  }
  if (evidence.providerCapability != null && !inEnum(evidence.providerCapability, PROVIDER_CAPABILITY)) {
    errors.push({ field: 'liquidityEvidence.providerCapability', code: 'invalid_provider_capability' });
  }
  if (evidence.limitations != null) {
    if (!Array.isArray(evidence.limitations)) {
      errors.push({ field: 'liquidityEvidence.limitations', code: 'invalid_array' });
    } else {
      evidence.limitations.forEach((item, index) => {
        if (typeof item !== 'string' || !item.trim()) {
          errors.push({ field: `liquidityEvidence.limitations[${index}]`, code: 'invalid_string' });
        }
      });
    }
  }

  assertFinitePositive('liquidityEvidence.proposedSize', evidence.proposedSize, errors);
  for (const key of ['spread', 'expectedSlippage', 'marketImpact', 'maxFeasibleSize', 'depth']) {
    assertFiniteNonNegative(`liquidityEvidence.${key}`, evidence[key], errors);
  }

  for (const key of DIRECTION_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(evidence, key)) {
      errors.push({ field: `liquidityEvidence.${key}`, code: 'direction_forbidden' });
    }
  }

  const outcome = normalizeLiquidityOutcome(evidence.outcome, errors);
  const freshness = normalizeFreshness(evidence.freshness, errors);
  return { outcome, freshness };
}

function validateRiskEvidenceRefShape(ref, errors) {
  if (!assertAllowlist(ref, ALLOWED_RISK_EVIDENCE_REF_FIELDS, 'riskEvidenceRef', errors)) {
    return { outcome: null };
  }
  if (ref.agentId !== 'risk') {
    errors.push({ field: 'riskEvidenceRef.agentId', code: 'invalid_agent_id', expected: 'risk' });
  }
  if (ref.authorityClass !== AUTHORITY_CLASS.CONTROL_VETO) {
    errors.push({
      field: 'riskEvidenceRef.authorityClass',
      code: 'invalid_authority_class',
      expected: AUTHORITY_CLASS.CONTROL_VETO,
    });
  }
  if (ref.runId != null && !isCanonicalUuid(ref.runId)) {
    errors.push({ field: 'riskEvidenceRef.runId', code: 'invalid_uuid' });
  }
  if (ref.limit != null && !(typeof ref.limit === 'number' && Number.isFinite(ref.limit) && ref.limit >= 0)) {
    errors.push({ field: 'riskEvidenceRef.limit', code: 'invalid_limit' });
  }
  const outcome = normalizeRiskOutcome(ref.outcome, errors);
  return { outcome };
}

function validatePortfolioEvidenceRefShape(ref, errors) {
  if (ref == null) return { outcome: null, present: false };
  if (!assertAllowlist(ref, ALLOWED_PORTFOLIO_EVIDENCE_REF_FIELDS, 'portfolioEvidenceRef', errors)) {
    return { outcome: null, present: true };
  }
  if (ref.agentId !== 'portfolio') {
    errors.push({ field: 'portfolioEvidenceRef.agentId', code: 'invalid_agent_id', expected: 'portfolio' });
  }
  if (ref.authorityClass !== AUTHORITY_CLASS.CONTROL_SIZING) {
    errors.push({
      field: 'portfolioEvidenceRef.authorityClass',
      code: 'invalid_authority_class',
      expected: AUTHORITY_CLASS.CONTROL_SIZING,
    });
  }
  if (ref.runId != null && !isCanonicalUuid(ref.runId)) {
    errors.push({ field: 'portfolioEvidenceRef.runId', code: 'invalid_uuid' });
  }
  for (const key of ['min', 'max', 'recommended', 'limit']) {
    if (ref[key] != null && !(typeof ref[key] === 'number' && Number.isFinite(ref[key]))) {
      errors.push({ field: `portfolioEvidenceRef.${key}`, code: 'invalid_bounds' });
    }
  }
  const outcome = normalizePortfolioOutcome(ref.outcome, errors);
  return { outcome, present: true };
}

function validateIdentityBinding(identity, evidence, errors) {
  if (identity == null) return;
  if (!assertAllowlist(identity, ALLOWED_IDENTITY_FIELDS, 'identity', errors)) return;

  if (identity.venue != null && evidence.venue != null && identity.venue !== evidence.venue) {
    errors.push({ field: 'identity.venue', code: 'venue_mismatch' });
  }
  if (identity.symbol != null && evidence.symbol != null && identity.symbol !== evidence.symbol) {
    errors.push({ field: 'identity.symbol', code: 'symbol_mismatch' });
  }
  if (identity.marketScope != null && evidence.marketScope != null
    && identity.marketScope !== evidence.marketScope) {
    errors.push({ field: 'identity.marketScope', code: 'market_scope_mismatch' });
  }
  if (identity.side != null && evidence.side != null && identity.side !== evidence.side) {
    errors.push({ field: 'identity.side', code: 'side_mismatch' });
  }
  if (identity.proposedSize != null && evidence.proposedSize != null
    && identity.proposedSize !== evidence.proposedSize) {
    errors.push({ field: 'identity.proposedSize', code: 'proposed_size_mismatch' });
  }
  if (identity.side != null
    && identity.side !== LIQUIDITY_SIDE.BID
    && identity.side !== LIQUIDITY_SIDE.ASK) {
    errors.push({ field: 'identity.side', code: 'invalid_side' });
  }
}

function sameStringArray(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function validateCallerLineage(lineage, errors, {
  decisionId,
  decisionContextId,
  liquidityEvidence,
  sourceEvidenceId,
  sourceContractVersion,
  orchestrationSetIds,
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
  assertString('lineage.agentId', lineage.agentId, errors);
  assertString('lineage.sourceEvidenceId', lineage.sourceEvidenceId, errors);
  assertString('lineage.sourceContractVersion', lineage.sourceContractVersion, errors);
  assertString('lineage.evidenceContractVersion', lineage.evidenceContractVersion, errors);
  assertString('lineage.controlChainContractVersion', lineage.controlChainContractVersion, errors);
  assertString('lineage.projectorContractVersion', lineage.projectorContractVersion, errors);
  assertString('lineage.policyVersion', lineage.policyVersion, errors);

  if (decisionId && lineage.decisionId && lineage.decisionId !== decisionId) {
    errors.push({ field: 'lineage.decisionId', code: 'lineage_decision_mismatch' });
  }
  if (decisionContextId && lineage.decisionContextId && lineage.decisionContextId !== decisionContextId) {
    errors.push({ field: 'lineage.decisionContextId', code: 'lineage_context_mismatch' });
  }

  const evidenceAgentId = liquidityEvidence?.agentId;
  if (
    lineage.agentId != null
    && typeof lineage.agentId === 'string'
    && evidenceAgentId != null
    && lineage.agentId !== evidenceAgentId
  ) {
    errors.push({ field: 'lineage.agentId', code: 'lineage_agent_mismatch' });
  }
  const evidenceRunId = liquidityEvidence?.runId;
  if (
    lineage.runId != null
    && typeof lineage.runId === 'string'
    && evidenceRunId != null
    && lineage.runId !== evidenceRunId
  ) {
    errors.push({ field: 'lineage.runId', code: 'lineage_run_mismatch' });
  }

  if (
    sourceEvidenceId != null
    && typeof sourceEvidenceId === 'string'
    && lineage.sourceEvidenceId != null
    && typeof lineage.sourceEvidenceId === 'string'
    && sourceEvidenceId !== lineage.sourceEvidenceId
  ) {
    errors.push({ field: 'lineage.sourceEvidenceId', code: 'lineage_source_evidence_mismatch' });
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

  if (Array.isArray(lineage.contributingAgentRunIds)) {
    const authorized = new Set();
    if (typeof evidenceRunId === 'string' && isCanonicalUuid(evidenceRunId)) {
      authorized.add(evidenceRunId);
    }
    for (let index = 0; index < lineage.contributingAgentRunIds.length; index += 1) {
      const id = lineage.contributingAgentRunIds[index];
      if (typeof id !== 'string' || !isCanonicalUuid(id)) continue;
      if (!authorized.has(id)) {
        errors.push({
          field: `lineage.contributingAgentRunIds[${index}]`,
          code: 'lineage_contributing_agent_run_mismatch',
        });
      }
    }
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
  if (provenance.writer === LIQUIDITY_FEASIBILITY_WRITER
    && provenance.methodKey != null
    && provenance.methodKey !== LIQUIDITY_FEASIBILITY_METHOD_KEY) {
    errors.push({ field: 'provenance.methodKey', code: 'provenance_mismatch' });
  }
  if (provenance.methodKey === LIQUIDITY_FEASIBILITY_METHOD_KEY
    && provenance.writer != null
    && provenance.writer !== LIQUIDITY_FEASIBILITY_WRITER) {
    errors.push({ field: 'provenance.writer', code: 'provenance_mismatch' });
  }
  if (provenance.stage != null
    && provenance.writer === LIQUIDITY_FEASIBILITY_WRITER
    && provenance.stage !== LIQUIDITY_FEASIBILITY_STAGE) {
    errors.push({ field: 'provenance.stage', code: 'provenance_mismatch' });
  }
}

/**
 * Validate projector input without projecting.
 */
export function validateLiquidityFeasibilityInput(input) {
  const errors = [];
  const inputIsObject = Boolean(input) && typeof input === 'object' && !Array.isArray(input);
  if (!inputIsObject) {
    errors.push({ field: 'input', code: 'required_object' });
    return fail('INVALID_INPUT', 'Liquidity feasibility input failed allowlist validation', { errors });
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
        || FORBIDDEN_CONTROL_CHAIN_KEYS.includes(key)) {
        code = 'execution_contamination';
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
      // Allowlisted bid/ask side paths never emit BUY/SELL; reject all authority values.
      errors.push({ field: path || 'value', code: 'execution_authority_forbidden', value });
    }
  }

  if (input.decisionId != null && !isCanonicalUuid(input.decisionId)) {
    errors.push({ field: 'decisionId', code: 'invalid_uuid' });
  }
  if (input.decisionContextId != null && !isCanonicalUuid(input.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (input.recordedAt != null && !isIsoTimestamp(input.recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'invalid_timestamp' });
  }
  assertString('sourceEvidenceId', input.sourceEvidenceId, errors);
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

  if (input.liquidityEvidence == null) {
    errors.push({ field: 'liquidityEvidence', code: 'missing_liquidity_evidence' });
  } else {
    validateLiquidityEvidenceShape(input.liquidityEvidence, errors);
    validateIdentityBinding(input.identity, input.liquidityEvidence, errors);
  }

  if (input.riskEvidenceRef == null) {
    errors.push({ field: 'riskEvidenceRef', code: 'required' });
  } else {
    validateRiskEvidenceRefShape(input.riskEvidenceRef, errors);
  }

  if (input.portfolioEvidenceRef != null) {
    validatePortfolioEvidenceRefShape(input.portfolioEvidenceRef, errors);
  }

  validateCallerLineage(input.lineage, errors, {
    decisionId: input.decisionId,
    decisionContextId: input.decisionContextId,
    liquidityEvidence: input.liquidityEvidence,
    sourceEvidenceId: input.sourceEvidenceId,
    sourceContractVersion: input.sourceContractVersion,
    orchestrationSetIds: input.orchestrationSetIds,
  });
  validateCallerProvenance(input.provenance, errors);

  if (utf8ByteLength(input) > MAX_PROJECTOR_UTF8_BYTES) {
    errors.push({ field: 'input', code: 'payload_too_large', max: MAX_PROJECTOR_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('INVALID_INPUT', 'Liquidity feasibility input validation failed', { errors });
  }
  return { ok: true };
}

function buildLineage(input, evidence) {
  const lineage = {
    projectorContractVersion: LIQUIDITY_FEASIBILITY_CONTRACT_VERSION,
    policyVersion: LIQUIDITY_FEASIBILITY_POLICY_VERSION,
    controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    evidenceContractVersion: input.lineage?.evidenceContractVersion
      ?? input.sourceContractVersion
      ?? EVIDENCE_CONTRACT_VERSION,
    agentId: evidence.agentId,
  };
  if (evidence.runId != null) lineage.runId = evidence.runId;
  if (input.decisionId != null) lineage.decisionId = input.decisionId;
  if (input.decisionContextId != null) lineage.decisionContextId = input.decisionContextId;
  if (input.lineage?.decisionId != null) lineage.decisionId = input.lineage.decisionId;
  if (input.lineage?.decisionContextId != null) lineage.decisionContextId = input.lineage.decisionContextId;
  if (input.lineage?.runId != null && lineage.runId == null) lineage.runId = input.lineage.runId;

  if (Array.isArray(input.lineage?.contributingAgentRunIds)) {
    lineage.contributingAgentRunIds = [...input.lineage.contributingAgentRunIds];
  }
  if (Array.isArray(input.orchestrationSetIds)) {
    lineage.orchestrationSetIds = [...input.orchestrationSetIds];
  }

  const sourceEvidenceId = input.sourceEvidenceId ?? input.lineage?.sourceEvidenceId;
  if (sourceEvidenceId != null) lineage.sourceEvidenceId = sourceEvidenceId;
  const sourceContractVersion = input.sourceContractVersion ?? input.lineage?.sourceContractVersion;
  if (sourceContractVersion != null) lineage.sourceContractVersion = sourceContractVersion;
  return lineage;
}

function buildProvenance(input) {
  const recordedAt = input.provenance?.recordedAt ?? input.recordedAt;
  const provenance = {
    writer: LIQUIDITY_FEASIBILITY_WRITER,
    methodKey: LIQUIDITY_FEASIBILITY_METHOD_KEY,
    stage: LIQUIDITY_FEASIBILITY_STAGE,
    recordedAt,
  };
  if (input.provenance?.sourceWriter != null) {
    provenance.sourceWriter = input.provenance.sourceWriter;
  } else if (input.provenance?.writer != null && input.provenance.writer !== LIQUIDITY_FEASIBILITY_WRITER) {
    provenance.sourceWriter = input.provenance.writer;
  }
  if (input.provenance?.sourceMethodKey != null) {
    provenance.sourceMethodKey = input.provenance.sourceMethodKey;
  } else if (input.provenance?.methodKey != null
    && input.provenance.methodKey !== LIQUIDITY_FEASIBILITY_METHOD_KEY) {
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

function projectRef({
  evidence,
  outcome,
  freshness,
  reasonKey,
  includeBookTimestamps,
}) {
  const ref = {
    agentId: 'liquidity',
    authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
    outcome,
    freshness,
    reasonKey,
  };
  if (evidence.runId != null) ref.runId = evidence.runId;
  if (evidence.availability != null) ref.availability = evidence.availability;
  if (evidence.unit != null) ref.unit = evidence.unit;

  if (includeBookTimestamps) {
    if (evidence.bookTimestamp != null) ref.bookTimestamp = evidence.bookTimestamp;
    const expiryTs = resolveExpiryTimestamp(evidence);
    if (expiryTs != null) ref.expiryTimestamp = expiryTs;
  }
  return ref;
}

function buildMeasuredMetrics(evidence) {
  const metrics = {
    venue: evidence.venue,
    symbol: evidence.symbol,
    side: evidence.side,
    proposedSize: evidence.proposedSize,
    bookTimestamp: evidence.bookTimestamp,
    spread: evidence.spread,
    expectedSlippage: evidence.expectedSlippage,
    marketImpact: evidence.marketImpact,
    maxFeasibleSize: evidence.maxFeasibleSize,
  };
  if (evidence.depth != null) metrics.depth = evidence.depth;
  if (evidence.marketScope != null) metrics.marketScope = evidence.marketScope;
  const expiryTs = resolveExpiryTimestamp(evidence);
  if (expiryTs != null) metrics.expiryTimestamp = expiryTs;
  if (Array.isArray(evidence.limitations)) metrics.limitations = [...evidence.limitations];
  if (evidence.venueState != null) metrics.venueState = evidence.venueState;
  if (evidence.providerCapability != null) metrics.providerCapability = evidence.providerCapability;
  return metrics;
}

function hasAllTruthfulFeasibleMetrics(evidence) {
  return (
    typeof evidence.venue === 'string' && evidence.venue.trim()
    && typeof evidence.symbol === 'string' && evidence.symbol.trim()
    && (evidence.side === LIQUIDITY_SIDE.BID || evidence.side === LIQUIDITY_SIDE.ASK)
    && typeof evidence.proposedSize === 'number' && Number.isFinite(evidence.proposedSize) && evidence.proposedSize > 0
    && isIsoTimestamp(evidence.bookTimestamp)
    && typeof evidence.spread === 'number' && Number.isFinite(evidence.spread) && evidence.spread >= 0
    && typeof evidence.expectedSlippage === 'number' && Number.isFinite(evidence.expectedSlippage)
    && evidence.expectedSlippage >= 0
    && typeof evidence.marketImpact === 'number' && Number.isFinite(evidence.marketImpact)
    && evidence.marketImpact >= 0
    && typeof evidence.maxFeasibleSize === 'number' && Number.isFinite(evidence.maxFeasibleSize)
    && evidence.maxFeasibleSize >= 0
    && typeof evidence.depth === 'number' && Number.isFinite(evidence.depth) && evidence.depth >= 0
  );
}

/**
 * Project allowlisted Liquidity evidence into Control Chain liquidityEvidenceRef.
 *
 * Fail-closed semantics:
 *   - missing / malformed evidence → reject (validation)
 *   - missing evidence at project time → BLOCKED
 *   - STALE / EXPIRED / UNKNOWN / UNAVAILABLE freshness → never FEASIBLE
 *   - Risk REJECT / UNAVAILABLE → never FEASIBLE (BLOCKED)
 *   - Portfolio UNAVAILABLE → never FEASIBLE (BLOCKED)
 *   - proposedSize > Portfolio max → INFEASIBLE
 *   - proposedSize > Risk LIMIT → INFEASIBLE
 *   - proposedSize > maxFeasibleSize / insufficient depth / excessive metrics → INFEASIBLE
 *   - unknown venue / denied provider capability → BLOCKED
 */
export function projectLiquidityEvidenceRef(input = {}) {
  const validated = validateLiquidityFeasibilityInput(input);
  if (!validated.ok) return validated;

  const evidence = input.liquidityEvidence;
  const riskRef = input.riskEvidenceRef;
  const portfolioRef = input.portfolioEvidenceRef;
  const shapeErrors = [];
  const { outcome: normalizedOutcome, freshness } = validateLiquidityEvidenceShape(evidence, shapeErrors);
  const { outcome: riskOutcome } = validateRiskEvidenceRefShape(riskRef, shapeErrors);
  const portfolioShape = validatePortfolioEvidenceRefShape(portfolioRef, shapeErrors);
  if (shapeErrors.length || !normalizedOutcome || !freshness || !riskOutcome) {
    return fail('INVALID_INPUT', 'Liquidity/Risk/Portfolio evidence shape invalid after validation', {
      errors: shapeErrors,
    });
  }

  let outcome = normalizedOutcome;
  let reasonKey = evidence.reasonKey;
  let controlOutcome = null;
  const projectionNotes = [];
  let measuredMetrics = null;

  const recordedAt = input.provenance?.recordedAt ?? input.recordedAt;
  const expiryTs = resolveExpiryTimestamp(evidence);
  const availability = evidence.availability ?? AVAILABILITY.AVAILABLE;

  const blockFeasible = (nextOutcome, nextReason, note, nextControl = CONTROL_OUTCOME.HOLD_EVALUATION) => {
    if (outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
      || outcome === LIQUIDITY_GATE_OUTCOME.PENDING
      || outcome === LIQUIDITY_GATE_OUTCOME.NOT_APPLICABLE) {
      outcome = nextOutcome;
      reasonKey = nextReason;
      controlOutcome = nextControl;
      projectionNotes.push(note);
    } else if (nextOutcome === LIQUIDITY_GATE_OUTCOME.BLOCKED
      && outcome !== LIQUIDITY_GATE_OUTCOME.BLOCKED) {
      // Escalate to BLOCKED when safety gates require it.
      outcome = nextOutcome;
      reasonKey = nextReason;
      controlOutcome = nextControl;
      projectionNotes.push(note);
    } else {
      projectionNotes.push(note);
      if (controlOutcome == null) controlOutcome = nextControl;
    }
  };

  // Freshness fail-closed.
  if (freshness === FRESHNESS_STATUS.STALE) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.STALE,
      'stale_liquidity_cannot_be_feasible',
      'freshness_stale',
      CONTROL_OUTCOME.STALE,
    );
  } else if (freshness === FRESHNESS_STATUS.EXPIRED) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.STALE,
      'expired_liquidity_cannot_be_feasible',
      'freshness_expired',
      CONTROL_OUTCOME.STALE,
    );
  } else if (freshness === FRESHNESS_STATUS.UNKNOWN) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'unknown_freshness_liquidity_fail_closed',
      'freshness_unknown',
    );
  } else if (freshness === FRESHNESS_STATUS.UNAVAILABLE) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.UNAVAILABLE,
      'unavailable_freshness_liquidity_fail_closed',
      'freshness_unavailable',
      CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE,
    );
  }

  // Expiry relative to recordedAt (Control Chain semantics) — never FEASIBLE when expired.
  if (
    isIsoTimestamp(expiryTs)
    && isIsoTimestamp(recordedAt)
    && Date.parse(expiryTs) < Date.parse(recordedAt)
  ) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.STALE,
      'expired_liquidity_cannot_be_feasible',
      'expiry_before_recorded_at',
      CONTROL_OUTCOME.STALE,
    );
  }

  // Availability fail-closed.
  if (availability === AVAILABILITY.UNAVAILABLE) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.UNAVAILABLE,
      'liquidity_availability_unavailable',
      'availability_unavailable',
      CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE,
    );
  } else if (availability === AVAILABILITY.BLOCKED) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'liquidity_availability_blocked',
      'availability_blocked',
    );
  } else if (availability !== AVAILABILITY.AVAILABLE && availability !== AVAILABILITY.NOT_APPLICABLE) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'liquidity_availability_fail_closed',
      'availability_unknown',
    );
  }

  // Venue / provider capability gates.
  if (evidence.venueState == null || evidence.venueState === VENUE_STATE.UNKNOWN) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'unknown_venue_state_fail_closed',
      'venue_state_unknown_or_missing',
    );
  } else if (!ALLOWED_VENUE_FOR_FEASIBLE.has(evidence.venueState)) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'venue_state_not_tradable',
      'venue_state_not_open',
    );
  }

  if (evidence.providerCapability == null
    || evidence.providerCapability === PROVIDER_CAPABILITY.UNKNOWN) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'provider_capability_unknown_fail_closed',
      'provider_capability_unknown_or_missing',
    );
  } else if (evidence.providerCapability === PROVIDER_CAPABILITY.DENIED) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'provider_capability_denied',
      'provider_capability_denied',
    );
  }

  // Risk REJECT / UNAVAILABLE cannot yield FEASIBLE.
  if (riskOutcome === RISK_GATE_OUTCOME.REJECT) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'risk_reject_blocks_liquidity_feasibility',
      'risk_reject',
      CONTROL_OUTCOME.VETOED,
    );
  }
  if (riskOutcome === RISK_GATE_OUTCOME.UNAVAILABLE) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'risk_unavailable_blocks_liquidity_feasibility',
      'risk_unavailable',
      CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE,
    );
  }

  // Portfolio UNAVAILABLE (e.g. after Risk veto sizing block) cannot yield FEASIBLE.
  if (portfolioShape.present && portfolioShape.outcome === PORTFOLIO_GATE_OUTCOME.UNAVAILABLE) {
    blockFeasible(
      LIQUIDITY_GATE_OUTCOME.BLOCKED,
      'portfolio_unavailable_blocks_liquidity_feasibility',
      'portfolio_unavailable',
      CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE,
    );
  }

  // Metric truthfulness for any remaining FEASIBLE candidate.
  if (outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE) {
    if (evidence.bookTimestamp == null) {
      blockFeasible(
        LIQUIDITY_GATE_OUTCOME.BLOCKED,
        'missing_book_timestamp',
        'missing_book_timestamp',
      );
    } else if (!hasAllTruthfulFeasibleMetrics(evidence)) {
      blockFeasible(
        LIQUIDITY_GATE_OUTCOME.BLOCKED,
        'missing_required_liquidity_metric',
        'missing_required_metric_no_fabrication',
      );
    } else {
      // Threshold / size checks → INFEASIBLE (truthful metrics present).
      if (evidence.depth < evidence.proposedSize) {
        blockFeasible(
          LIQUIDITY_GATE_OUTCOME.INFEASIBLE,
          'insufficient_depth',
          'insufficient_depth',
          CONTROL_OUTCOME.INFEASIBLE,
        );
      }
      if (evidence.spread > LIQUIDITY_FEASIBILITY_POLICY.maxSpreadPct) {
        blockFeasible(
          LIQUIDITY_GATE_OUTCOME.INFEASIBLE,
          'excessive_spread',
          'excessive_spread',
          CONTROL_OUTCOME.INFEASIBLE,
        );
      }
      if (evidence.expectedSlippage > LIQUIDITY_FEASIBILITY_POLICY.maxExpectedSlippagePct) {
        blockFeasible(
          LIQUIDITY_GATE_OUTCOME.INFEASIBLE,
          'excessive_expected_slippage',
          'excessive_expected_slippage',
          CONTROL_OUTCOME.INFEASIBLE,
        );
      }
      if (evidence.marketImpact > LIQUIDITY_FEASIBILITY_POLICY.maxMarketImpactPct) {
        blockFeasible(
          LIQUIDITY_GATE_OUTCOME.INFEASIBLE,
          'excessive_market_impact',
          'excessive_market_impact',
          CONTROL_OUTCOME.INFEASIBLE,
        );
      }
      if (evidence.proposedSize > evidence.maxFeasibleSize) {
        blockFeasible(
          LIQUIDITY_GATE_OUTCOME.INFEASIBLE,
          'proposed_size_exceeds_max_feasible',
          'proposed_size_gt_max_feasible',
          CONTROL_OUTCOME.INFEASIBLE,
        );
      }

      // Portfolio max binding — never invent proposedSize; never enlarge Portfolio max.
      if (
        portfolioShape.present
        && (portfolioShape.outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE
          || portfolioShape.outcome === PORTFOLIO_GATE_OUTCOME.PENDING)
        && typeof portfolioRef.max === 'number'
      ) {
        if (evidence.proposedSize > portfolioRef.max) {
          blockFeasible(
            LIQUIDITY_GATE_OUTCOME.INFEASIBLE,
            'proposed_size_exceeds_portfolio_max',
            'portfolio_max_binding',
            CONTROL_OUTCOME.INFEASIBLE,
          );
        }
      } else if (
        portfolioShape.present
        && (portfolioShape.outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE
          || portfolioShape.outcome === PORTFOLIO_GATE_OUTCOME.PENDING)
        && typeof evidence.proposedSize === 'number'
        && typeof portfolioRef.max !== 'number'
      ) {
        // Portfolio present without max — cannot bind; fail closed rather than invent.
        blockFeasible(
          LIQUIDITY_GATE_OUTCOME.BLOCKED,
          'portfolio_max_missing_for_proposed_size_binding',
          'portfolio_max_missing',
        );
      }

      // Risk LIMIT interaction.
      if (
        riskOutcome === RISK_GATE_OUTCOME.LIMIT
        && typeof riskRef.limit === 'number'
        && evidence.proposedSize > riskRef.limit
      ) {
        blockFeasible(
          LIQUIDITY_GATE_OUTCOME.INFEASIBLE,
          'proposed_size_exceeds_risk_limit',
          'risk_limit_binding',
          CONTROL_OUTCOME.INFEASIBLE,
        );
      }
    }
  }

  // Emit measured metrics only when truthful and not fabricating under BLOCKED/UNAVAILABLE/STALE.
  if (
    outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
    || outcome === LIQUIDITY_GATE_OUTCOME.INFEASIBLE
  ) {
    if (hasAllTruthfulFeasibleMetrics(evidence)) {
      measuredMetrics = buildMeasuredMetrics(evidence);
    }
  }

  const includeBookTimestamps = outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
    || outcome === LIQUIDITY_GATE_OUTCOME.INFEASIBLE
    || outcome === LIQUIDITY_GATE_OUTCOME.STALE
    || (outcome === LIQUIDITY_GATE_OUTCOME.PENDING && evidence.bookTimestamp != null);

  const liquidityEvidenceRef = projectRef({
    evidence,
    outcome,
    freshness,
    reasonKey,
    includeBookTimestamps: includeBookTimestamps && evidence.bookTimestamp != null,
  });

  // Hard invariants.
  if (
    liquidityEvidenceRef.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
    && UNSAFE_FEASIBLE_FRESHNESS.has(liquidityEvidenceRef.freshness)
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Projector refused to emit unsafe FEASIBLE freshness', {
      errors: [{ field: 'liquidityEvidenceRef', code: 'stale_liquidity_cannot_be_feasible' }],
    });
  }
  if (
    liquidityEvidenceRef.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
    && !liquidityEvidenceRef.bookTimestamp
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Projector refused FEASIBLE without bookTimestamp', {
      errors: [{ field: 'liquidityEvidenceRef.bookTimestamp', code: 'missing_book_timestamp' }],
    });
  }
  if (
    (riskOutcome === RISK_GATE_OUTCOME.REJECT || riskOutcome === RISK_GATE_OUTCOME.UNAVAILABLE)
    && liquidityEvidenceRef.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Projector refused FEASIBLE after Risk block', {
      errors: [{ field: 'liquidityEvidenceRef', code: 'feasible_after_risk_block' }],
    });
  }
  if (
    portfolioShape.present
    && portfolioShape.outcome === PORTFOLIO_GATE_OUTCOME.UNAVAILABLE
    && liquidityEvidenceRef.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Projector refused FEASIBLE after Portfolio UNAVAILABLE', {
      errors: [{ field: 'liquidityEvidenceRef', code: 'feasible_after_portfolio_unavailable' }],
    });
  }
  if (
    liquidityEvidenceRef.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE
    && measuredMetrics
    && typeof measuredMetrics.proposedSize === 'number'
    && typeof measuredMetrics.maxFeasibleSize === 'number'
    && measuredMetrics.proposedSize > measuredMetrics.maxFeasibleSize
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Projector refused FEASIBLE above maxFeasibleSize', {
      errors: [{ field: 'measuredMetrics', code: 'proposed_size_exceeds_max_feasible' }],
    });
  }

  if (outcome === LIQUIDITY_GATE_OUTCOME.INFEASIBLE && controlOutcome == null) {
    controlOutcome = CONTROL_OUTCOME.INFEASIBLE;
  }
  if (outcome === LIQUIDITY_GATE_OUTCOME.BLOCKED && controlOutcome == null) {
    controlOutcome = CONTROL_OUTCOME.HOLD_EVALUATION;
  }
  if (outcome === LIQUIDITY_GATE_OUTCOME.UNAVAILABLE && controlOutcome == null) {
    controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
  }
  if (outcome === LIQUIDITY_GATE_OUTCOME.STALE && controlOutcome == null) {
    controlOutcome = CONTROL_OUTCOME.STALE;
  }
  if (outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE && controlOutcome == null) {
    controlOutcome = CONTROL_OUTCOME.CONTROL_PASS_BOUNDED;
  }

  const artifact = {
    schemaVersion: LIQUIDITY_FEASIBILITY_SCHEMA_VERSION,
    contractVersion: LIQUIDITY_FEASIBILITY_CONTRACT_VERSION,
    policyVersion: LIQUIDITY_FEASIBILITY_POLICY_VERSION,
    stage: LIQUIDITY_FEASIBILITY_STAGE,
    liquidityEvidenceRef,
    measuredMetrics,
    controlOutcome,
    lineage: buildLineage(input, evidence),
    provenance: buildProvenance(input),
    limitations: [...LIQUIDITY_FEASIBILITY_LIMITATIONS],
    projectionNotes,
    policy: { ...LIQUIDITY_FEASIBILITY_POLICY },
    sideEffects: { ...ZERO_LIQUIDITY_FEASIBILITY_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
  };

  if (utf8ByteLength(artifact) > MAX_PROJECTOR_UTF8_BYTES) {
    return fail('PAYLOAD_TOO_LARGE', 'Projected Liquidity artifact exceeds size bound', {
      errors: [{ field: 'artifact', code: 'payload_too_large', max: MAX_PROJECTOR_UTF8_BYTES }],
    });
  }

  return { ok: true, artifact };
}

/**
 * Validate a projected liquidityEvidenceRef against Control Chain allowlist rules
 * without invoking the full control-chain builder.
 */
export function validateProjectedLiquidityEvidenceRef(ref) {
  const errors = [];
  if (!assertAllowlist(ref, ALLOWED_LIQUIDITY_EVIDENCE_REF_FIELDS, 'liquidityEvidenceRef', errors)) {
    return fail('INVALID_REF', 'Projected liquidityEvidenceRef failed allowlist', { errors });
  }
  if (ref.agentId !== 'liquidity') {
    errors.push({ field: 'liquidityEvidenceRef.agentId', code: 'invalid_agent_id' });
  }
  if (ref.authorityClass !== AUTHORITY_CLASS.EXECUTION_FEASIBILITY) {
    errors.push({ field: 'liquidityEvidenceRef.authorityClass', code: 'invalid_authority_class' });
  }
  if (ref.runId != null && !isCanonicalUuid(ref.runId)) {
    errors.push({ field: 'liquidityEvidenceRef.runId', code: 'invalid_uuid' });
  }
  if (!inEnum(ref.outcome, LIQUIDITY_GATE_OUTCOME)) {
    errors.push({ field: 'liquidityEvidenceRef.outcome', code: 'invalid_outcome' });
  }
  if (!inEnum(ref.freshness, FRESHNESS_STATUS)) {
    errors.push({ field: 'liquidityEvidenceRef.freshness', code: 'invalid_freshness' });
  }
  if (ref.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE && UNSAFE_FEASIBLE_FRESHNESS.has(ref.freshness)) {
    errors.push({ field: 'liquidityEvidenceRef', code: 'stale_liquidity_cannot_be_feasible' });
  }
  if (ref.outcome === LIQUIDITY_GATE_OUTCOME.FEASIBLE && !ref.bookTimestamp) {
    errors.push({ field: 'liquidityEvidenceRef.bookTimestamp', code: 'missing_book_timestamp' });
  }
  if (ref.bookTimestamp != null && !isIsoTimestamp(ref.bookTimestamp)) {
    errors.push({ field: 'liquidityEvidenceRef.bookTimestamp', code: 'invalid_timestamp' });
  }
  if (ref.expiryTimestamp != null && !isIsoTimestamp(ref.expiryTimestamp)) {
    errors.push({ field: 'liquidityEvidenceRef.expiryTimestamp', code: 'invalid_timestamp' });
  }

  if (errors.length) {
    return fail('INVALID_REF', 'Projected liquidityEvidenceRef validation failed', { errors });
  }
  return { ok: true };
}

export default {
  LIQUIDITY_FEASIBILITY_STAGE,
  LIQUIDITY_FEASIBILITY_SCHEMA_VERSION,
  LIQUIDITY_FEASIBILITY_CONTRACT_VERSION,
  LIQUIDITY_FEASIBILITY_POLICY_VERSION,
  LIQUIDITY_FEASIBILITY_WRITER,
  LIQUIDITY_FEASIBILITY_METHOD_KEY,
  LIQUIDITY_FEASIBILITY_POLICY,
  LIQUIDITY_SIDE,
  VENUE_STATE,
  PROVIDER_CAPABILITY,
  ZERO_LIQUIDITY_FEASIBILITY_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS,
  LIQUIDITY_FEASIBILITY_LIMITATIONS,
  ALLOWED_LIQUIDITY_EVIDENCE_FIELDS,
  ALLOWED_LIQUIDITY_EVIDENCE_REF_FIELDS,
  validateLiquidityFeasibilityInput,
  projectLiquidityEvidenceRef,
  validateProjectedLiquidityEvidenceRef,
};
