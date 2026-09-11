/**
 * Artemis Core Stage 7.3.2.c.3 — Portfolio CONTROL_SIZING boundary / projector.
 *
 * Library-only projector that converts allowlisted Portfolio sizing evidence into
 * the exact portfolioEvidenceRef shape required by artemisControlChainContract.js
 * (Stage 7.3.1), applying Risk LIMIT / REJECT / UNAVAILABLE interaction rules.
 *
 * Canonical Portfolio SoT (consumed as allowlisted evidence only — not imported):
 *   - backend/services/agents/portfolio.js
 *   - backend/services/portfolioOptimizer.js
 *   - backend/services/artemisEvidenceAdapters/portfolioAdapter.js
 *
 * Does NOT:
 *   - invent BUY/SELL/LONG/SHORT or trading thesis
 *   - override Risk REJECT / clear Risk veto
 *   - call risk-gate / Liquidity / Runtime / Order / tradingEngine
 *   - call LLM / provider / HTTP / network
 *   - access DB / Redis
 *   - mutate wallet / account state
 *   - approve execution or fabricate balances / limits
 *
 * Placement:
 *   Portfolio evidence (allowlisted) + riskEvidenceRef
 *     → this projector → portfolioEvidenceRef
 *     → Control Chain portfolioGate (NOT wired here)
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
  PORTFOLIO_GATE_OUTCOME,
  RISK_GATE_OUTCOME,
  ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
} from './artemisControlChainContract.js';

export const PORTFOLIO_SIZING_STAGE = '7.3.2.c.3';
export const PORTFOLIO_SIZING_SCHEMA_VERSION = '1.0.0';
export const PORTFOLIO_SIZING_CONTRACT_VERSION = 'artemis-portfolio-control-sizing-1.0.0';
export const PORTFOLIO_SIZING_POLICY_VERSION = 'stage7-3-2-c3-portfolio-control-sizing-1.0.0';
export const PORTFOLIO_SIZING_WRITER = 'artemisPortfolioControlSizingBoundaryContract';
export const PORTFOLIO_SIZING_METHOD_KEY = 'project_portfolio_evidence_ref_fail_closed';

export const REQUIRED_CONTROL_CHAIN_CONTRACT_VERSION = CONTROL_CHAIN_CONTRACT_VERSION;
export const REQUIRED_EVIDENCE_CONTRACT_VERSION = EVIDENCE_CONTRACT_VERSION;

export const MAX_PROJECTOR_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 512;

export const ZERO_PORTFOLIO_SIZING_SIDE_EFFECTS = Object.freeze({
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

export const PORTFOLIO_SIZING_LIMITATIONS = Object.freeze([
  'stage7_3_2_c3_portfolio_control_sizing_only',
  'library_only',
  'control_sizing_only',
  'non_directional',
  'does_not_invent_balances_or_limits',
  'does_not_override_risk_reject',
  'does_not_call_risk_gate',
  'does_not_call_liquidity_or_order',
  'does_not_call_llm_or_provider',
  'does_not_access_db_or_redis',
  'does_not_wire_control_chain_runtime',
  'does_not_approve_execution',
  'live_trading_not_authorized',
  'canonical_portfolio_sot_reuse_only',
]);

/** Allowlisted portfolioEvidence fields (flat). Matches Control Chain ALLOWED_EVIDENCE_REF. */
export const ALLOWED_PORTFOLIO_EVIDENCE_FIELDS = Object.freeze([
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

/** Allowlisted riskEvidenceRef fields for Risk interaction (read-only). */
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

const ALLOWED_INPUT_TOP = Object.freeze([
  'portfolioEvidence',
  'riskEvidenceRef',
  'lineage',
  'provenance',
  'decisionId',
  'decisionContextId',
  'recordedAt',
  'sourceContractVersion',
  'sourceEvidenceId',
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
]);

const DIRECTION_FORBIDDEN_KEYS = Object.freeze([
  'direction',
  'side',
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
  'prompt',
  'modelResponse',
  'EXECUTE',
  'tradingThesis',
  'thesis',
]);

const OUTCOME_ALIASES = Object.freeze({
  available: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
  AVAILABLE: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
  pending: PORTFOLIO_GATE_OUTCOME.PENDING,
  PENDING: PORTFOLIO_GATE_OUTCOME.PENDING,
  unavailable: PORTFOLIO_GATE_OUTCOME.UNAVAILABLE,
  UNAVAILABLE: PORTFOLIO_GATE_OUTCOME.UNAVAILABLE,
  not_applicable: PORTFOLIO_GATE_OUTCOME.NOT_APPLICABLE,
  NOT_APPLICABLE: PORTFOLIO_GATE_OUTCOME.NOT_APPLICABLE,
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

const UNSAFE_AVAILABLE_FRESHNESS = new Set([
  FRESHNESS_STATUS.STALE,
  FRESHNESS_STATUS.EXPIRED,
  FRESHNESS_STATUS.UNKNOWN,
  FRESHNESS_STATUS.UNAVAILABLE,
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

function normalizeFreshness(value, errors, field = 'portfolioEvidence.freshness') {
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

function normalizePortfolioOutcome(value, errors, field = 'portfolioEvidence.outcome') {
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

function assertFiniteBound(field, value, errors, { allowNegative = false } = {}) {
  if (value == null) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ field, code: 'invalid_bounds' });
    return;
  }
  if (!allowNegative && value < 0) {
    errors.push({ field, code: 'invalid_negative_bounds' });
  }
}

function validatePortfolioEvidenceShape(evidence, errors) {
  if (!assertAllowlist(evidence, ALLOWED_PORTFOLIO_EVIDENCE_FIELDS, 'portfolioEvidence', errors)) {
    return { outcome: null, freshness: null };
  }

  if (evidence.agentId !== 'portfolio') {
    errors.push({ field: 'portfolioEvidence.agentId', code: 'invalid_agent_id', expected: 'portfolio' });
  }
  if (evidence.authorityClass !== AUTHORITY_CLASS.CONTROL_SIZING) {
    errors.push({
      field: 'portfolioEvidence.authorityClass',
      code: 'authority_escalation',
      expected: AUTHORITY_CLASS.CONTROL_SIZING,
    });
  }
  if (evidence.runId != null && !isCanonicalUuid(evidence.runId)) {
    errors.push({ field: 'portfolioEvidence.runId', code: 'invalid_uuid' });
  }
  assertString('portfolioEvidence.reasonKey', evidence.reasonKey, errors, { required: true });
  assertString('portfolioEvidence.unit', evidence.unit, errors);

  if (evidence.availability != null && !inEnum(evidence.availability, AVAILABILITY)) {
    errors.push({ field: 'portfolioEvidence.availability', code: 'invalid_availability' });
  }
  if (evidence.bookTimestamp != null && !isIsoTimestamp(evidence.bookTimestamp)) {
    errors.push({ field: 'portfolioEvidence.bookTimestamp', code: 'invalid_timestamp' });
  }
  if (evidence.expiryTimestamp != null && !isIsoTimestamp(evidence.expiryTimestamp)) {
    errors.push({ field: 'portfolioEvidence.expiryTimestamp', code: 'invalid_timestamp' });
  }
  if (evidence.accountStateAvailable != null && typeof evidence.accountStateAvailable !== 'boolean') {
    errors.push({ field: 'portfolioEvidence.accountStateAvailable', code: 'invalid_boolean' });
  }

  for (const key of ['min', 'max', 'recommended']) {
    assertFiniteBound(`portfolioEvidence.${key}`, evidence[key], errors);
  }
  if (evidence.limit != null) {
    assertFiniteBound('portfolioEvidence.limit', evidence.limit, errors);
  }

  if (typeof evidence.min === 'number' && typeof evidence.max === 'number' && evidence.min > evidence.max) {
    errors.push({ field: 'portfolioEvidence', code: 'contradictory_bounds' });
  }
  if (typeof evidence.recommended === 'number') {
    if (typeof evidence.min === 'number' && evidence.recommended < evidence.min) {
      errors.push({ field: 'portfolioEvidence.recommended', code: 'recommended_out_of_bounds' });
    }
    if (typeof evidence.max === 'number' && evidence.recommended > evidence.max) {
      errors.push({ field: 'portfolioEvidence.recommended', code: 'recommended_out_of_bounds' });
    }
  }

  for (const key of DIRECTION_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(evidence, key)) {
      errors.push({ field: `portfolioEvidence.${key}`, code: 'direction_forbidden' });
    }
  }

  const outcome = normalizePortfolioOutcome(evidence.outcome, errors);
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
  if (ref.freshness != null && !inEnum(ref.freshness, FRESHNESS_STATUS)
    && !(typeof ref.freshness === 'object' && ref.freshness?.status && inEnum(ref.freshness.status, FRESHNESS_STATUS))) {
    // Allow string freshness only for Risk ref; object status is also accepted via normalizeFreshness path below.
    if (typeof ref.freshness === 'string') {
      errors.push({ field: 'riskEvidenceRef.freshness', code: 'invalid_freshness' });
    }
  }
  const outcome = normalizeRiskOutcome(ref.outcome, errors);
  return { outcome };
}

function validateCallerLineage(lineage, errors, {
  decisionId,
  decisionContextId,
  portfolioEvidence,
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

  // Fail closed on spoofed Portfolio identity in caller lineage.
  // Do not silently normalize mismatched agentId / runId.
  const evidenceAgentId = portfolioEvidence?.agentId;
  if (
    lineage.agentId != null
    && typeof lineage.agentId === 'string'
    && evidenceAgentId != null
    && lineage.agentId !== evidenceAgentId
  ) {
    errors.push({ field: 'lineage.agentId', code: 'lineage_agent_mismatch' });
  }
  const evidenceRunId = portfolioEvidence?.runId;
  if (
    lineage.runId != null
    && typeof lineage.runId === 'string'
    && evidenceRunId != null
    && lineage.runId !== evidenceRunId
  ) {
    errors.push({ field: 'lineage.runId', code: 'lineage_run_mismatch' });
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
  if (provenance.recordedAt != null && !isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_timestamp' });
  }
  // Reject spoofed projector identity in caller provenance when claiming this writer/method.
  if (provenance.writer === PORTFOLIO_SIZING_WRITER
    && provenance.methodKey != null
    && provenance.methodKey !== PORTFOLIO_SIZING_METHOD_KEY) {
    errors.push({ field: 'provenance.methodKey', code: 'provenance_mismatch' });
  }
  if (provenance.methodKey === PORTFOLIO_SIZING_METHOD_KEY
    && provenance.writer != null
    && provenance.writer !== PORTFOLIO_SIZING_WRITER) {
    errors.push({ field: 'provenance.writer', code: 'provenance_mismatch' });
  }
}

/**
 * Validate projector input without projecting.
 */
export function validatePortfolioSizingInput(input) {
  const errors = [];
  const inputIsObject = Boolean(input) && typeof input === 'object' && !Array.isArray(input);
  if (!inputIsObject) {
    errors.push({ field: 'input', code: 'required_object' });
    return fail('INVALID_INPUT', 'Portfolio sizing input failed allowlist validation', { errors });
  }

  // Collect allowlist failures without early-return so contamination classifiers still run.
  assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors);

  const allKeys = collectKeysDeep(input);
  for (const key of allKeys) {
    if (EXTRA_FORBIDDEN_KEYS.includes(key) || LEGACY_MOE_FORBIDDEN_KEYS.includes(key)
      || MODEL_ASSISTED_FORBIDDEN_KEYS.includes(key)) {
      let code = 'forbidden_key';
      if (LEGACY_MOE_FORBIDDEN_KEYS.includes(key)) code = 'legacy_moe_forbidden';
      else if (MODEL_ASSISTED_FORBIDDEN_KEYS.includes(key)) code = 'model_assisted_forbidden';
      else if (key === 'orderId' || key === 'executionIntent' || key === 'walletAction'
        || FORBIDDEN_CONTROL_CHAIN_KEYS.includes(key)) {
        code = 'execution_contamination';
      }
      errors.push({ field: key, code });
    }
    if (DIRECTION_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'direction_forbidden' });
    }
  }

  const forbiddenSecrets = collectForbiddenSecretKeys(input);
  for (const key of forbiddenSecrets) {
    errors.push({ field: key, code: 'forbidden_secret_key' });
  }

  const authorityValues = collectStringValuesDeep(input);
  for (const value of authorityValues) {
    if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
      errors.push({ field: 'value', code: 'execution_authority_forbidden', value });
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
  assertString('sourceContractVersion', input.sourceContractVersion, errors);
  assertString('sourceEvidenceId', input.sourceEvidenceId, errors);

  if (!input.portfolioEvidence) {
    errors.push({ field: 'portfolioEvidence', code: 'required' });
  } else {
    validatePortfolioEvidenceShape(input.portfolioEvidence, errors);
  }

  if (!input.riskEvidenceRef) {
    errors.push({ field: 'riskEvidenceRef', code: 'required' });
  } else {
    validateRiskEvidenceRefShape(input.riskEvidenceRef, errors);
  }

  validateCallerLineage(input.lineage, errors, {
    decisionId: input.decisionId,
    decisionContextId: input.decisionContextId,
    portfolioEvidence: input.portfolioEvidence,
  });
  validateCallerProvenance(input.provenance, errors);

  const recordedAt = input.provenance?.recordedAt ?? input.recordedAt;
  if (!isIsoTimestamp(recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'required_timestamp' });
  }

  if (utf8ByteLength(input) > MAX_PROJECTOR_UTF8_BYTES) {
    errors.push({ field: 'input', code: 'payload_too_large', max: MAX_PROJECTOR_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('INVALID_INPUT', 'Portfolio sizing input validation failed', { errors });
  }
  return { ok: true };
}

function buildLineage(input, evidence) {
  // Canonical Portfolio identity is derived only from validated evidence.
  // Caller lineage agentId/runId are never preferred over evidence (spoof fail-closed above).
  const lineage = {
    projectorContractVersion: PORTFOLIO_SIZING_CONTRACT_VERSION,
    policyVersion: PORTFOLIO_SIZING_POLICY_VERSION,
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
  // Only fill runId from caller lineage when evidence itself has no runId.
  if (input.lineage?.runId != null && lineage.runId == null) lineage.runId = input.lineage.runId;
  if (Array.isArray(input.lineage?.contributingAgentRunIds)) {
    lineage.contributingAgentRunIds = [...input.lineage.contributingAgentRunIds];
  }
  if (Array.isArray(input.lineage?.orchestrationSetIds)) {
    lineage.orchestrationSetIds = [...input.lineage.orchestrationSetIds];
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
    writer: PORTFOLIO_SIZING_WRITER,
    methodKey: PORTFOLIO_SIZING_METHOD_KEY,
    stage: PORTFOLIO_SIZING_STAGE,
    recordedAt,
  };
  if (input.provenance?.sourceWriter != null) {
    provenance.sourceWriter = input.provenance.sourceWriter;
  } else if (input.provenance?.writer != null && input.provenance.writer !== PORTFOLIO_SIZING_WRITER) {
    provenance.sourceWriter = input.provenance.writer;
  }
  if (input.provenance?.sourceMethodKey != null) {
    provenance.sourceMethodKey = input.provenance.sourceMethodKey;
  } else if (input.provenance?.methodKey != null
    && input.provenance.methodKey !== PORTFOLIO_SIZING_METHOD_KEY) {
    provenance.sourceMethodKey = input.provenance.methodKey;
  }
  if (input.provenance?.note != null) provenance.note = input.provenance.note;
  return provenance;
}

function projectRef({
  evidence,
  outcome,
  freshness,
  min,
  max,
  recommended,
  reasonKey,
}) {
  const ref = {
    agentId: 'portfolio',
    authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
    outcome,
    freshness,
    reasonKey,
  };
  if (evidence.runId != null) ref.runId = evidence.runId;
  if (evidence.availability != null) ref.availability = evidence.availability;
  if (evidence.unit != null) ref.unit = evidence.unit;
  if (typeof evidence.accountStateAvailable === 'boolean') {
    ref.accountStateAvailable = evidence.accountStateAvailable;
  }
  if (evidence.bookTimestamp != null) ref.bookTimestamp = evidence.bookTimestamp;
  if (evidence.expiryTimestamp != null) ref.expiryTimestamp = evidence.expiryTimestamp;

  // Only emit sizing numbers when outcome can carry usable sizing.
  if (outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE || outcome === PORTFOLIO_GATE_OUTCOME.PENDING) {
    if (typeof min === 'number') ref.min = min;
    if (typeof max === 'number') ref.max = max;
    if (typeof recommended === 'number') ref.recommended = recommended;
  }
  return ref;
}

/**
 * Project allowlisted Portfolio evidence into Control Chain portfolioEvidenceRef.
 *
 * Fail-closed Risk interaction:
 *   - Risk REJECT → UNAVAILABLE, no usable sizing
 *   - Risk UNAVAILABLE → UNAVAILABLE, no usable sizing
 *   - Risk LIMIT + numeric limit → max MUST NOT exceed Risk limit (never fabricate limit)
 *   - Risk PASS / NOT_APPLICABLE → Portfolio stays within its own bounds
 */
export function projectPortfolioEvidenceRef(input = {}) {
  const validated = validatePortfolioSizingInput(input);
  if (!validated.ok) return validated;

  const evidence = input.portfolioEvidence;
  const riskRef = input.riskEvidenceRef;
  const shapeErrors = [];
  const { outcome: normalizedOutcome, freshness } = validatePortfolioEvidenceShape(evidence, shapeErrors);
  const { outcome: riskOutcome } = validateRiskEvidenceRefShape(riskRef, shapeErrors);
  if (shapeErrors.length || !normalizedOutcome || !freshness || !riskOutcome) {
    return fail('INVALID_INPUT', 'Portfolio/Risk evidence shape invalid after validation', {
      errors: shapeErrors,
    });
  }

  let outcome = normalizedOutcome;
  let reasonKey = evidence.reasonKey;
  let controlOutcome = null;
  const projectionNotes = [];

  let min = typeof evidence.min === 'number' ? evidence.min : undefined;
  let max = typeof evidence.max === 'number' ? evidence.max : undefined;
  let recommended = typeof evidence.recommended === 'number' ? evidence.recommended : undefined;

  const availability = evidence.availability ?? AVAILABILITY.AVAILABLE;
  const availabilityBlocksPositive = availability !== AVAILABILITY.AVAILABLE
    && availability !== AVAILABILITY.NOT_APPLICABLE;

  // Fail-closed freshness: AVAILABLE cannot survive unsafe freshness.
  if (outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE && UNSAFE_AVAILABLE_FRESHNESS.has(freshness)) {
    outcome = PORTFOLIO_GATE_OUTCOME.UNAVAILABLE;
    reasonKey = freshness === FRESHNESS_STATUS.EXPIRED
      ? 'expired_portfolio_cannot_be_available'
      : freshness === FRESHNESS_STATUS.STALE
        ? 'stale_portfolio_cannot_be_available'
        : 'unknown_freshness_portfolio_fail_closed';
    controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
    projectionNotes.push('freshness_blocked_available');
    min = undefined;
    max = undefined;
    recommended = undefined;
  }

  // Missing/unavailable assessment availability cannot stay AVAILABLE.
  if (availabilityBlocksPositive && outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE) {
    outcome = PORTFOLIO_GATE_OUTCOME.UNAVAILABLE;
    reasonKey = 'portfolio_availability_fail_closed';
    controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
    projectionNotes.push('availability_blocked_available');
    min = undefined;
    max = undefined;
    recommended = undefined;
  }

  // Canonical account/exposure required for AVAILABLE sizing.
  if (evidence.accountStateAvailable === false && outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE) {
    outcome = PORTFOLIO_GATE_OUTCOME.UNAVAILABLE;
    reasonKey = 'missing_canonical_account_state';
    controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
    projectionNotes.push('account_state_unavailable');
    min = undefined;
    max = undefined;
    recommended = undefined;
  }

  // Risk REJECT — no usable Portfolio sizing.
  if (riskOutcome === RISK_GATE_OUTCOME.REJECT) {
    outcome = PORTFOLIO_GATE_OUTCOME.UNAVAILABLE;
    reasonKey = 'risk_veto_blocks_sizing';
    controlOutcome = CONTROL_OUTCOME.VETOED;
    projectionNotes.push('risk_reject_blocks_sizing');
    min = undefined;
    max = undefined;
    recommended = undefined;
  }

  // Risk UNAVAILABLE — fail closed.
  if (riskOutcome === RISK_GATE_OUTCOME.UNAVAILABLE) {
    outcome = PORTFOLIO_GATE_OUTCOME.UNAVAILABLE;
    reasonKey = 'risk_unavailable_fail_closed';
    controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
    projectionNotes.push('risk_unavailable_blocks_sizing');
    min = undefined;
    max = undefined;
    recommended = undefined;
  }

  // Risk LIMIT with truthful numeric limit caps Portfolio max (never fabricate).
  if (
    riskOutcome === RISK_GATE_OUTCOME.LIMIT
    && typeof riskRef.limit === 'number'
    && Number.isFinite(riskRef.limit)
    && outcome !== PORTFOLIO_GATE_OUTCOME.UNAVAILABLE
    && outcome !== PORTFOLIO_GATE_OUTCOME.NOT_APPLICABLE
  ) {
    if (typeof max === 'number') {
      if (max > riskRef.limit) {
        max = riskRef.limit;
        projectionNotes.push('risk_limit_capped_max');
        reasonKey = 'portfolio_max_capped_by_risk_limit';
      }
    } else {
      // No portfolio max — do not invent one from Risk limit.
      projectionNotes.push('risk_limit_present_no_portfolio_max_not_fabricated');
    }
    if (typeof recommended === 'number' && recommended > riskRef.limit) {
      recommended = riskRef.limit;
      projectionNotes.push('risk_limit_capped_recommended');
    }
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      outcome = PORTFOLIO_GATE_OUTCOME.UNAVAILABLE;
      reasonKey = 'risk_limit_makes_bounds_contradictory';
      controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
      projectionNotes.push('risk_limit_contradictory_bounds');
      min = undefined;
      max = undefined;
      recommended = undefined;
    }
  } else if (riskOutcome === RISK_GATE_OUTCOME.LIMIT && typeof riskRef.limit !== 'number') {
    // LIMIT without numeric bound — do not fabricate; leave Portfolio own bounds if valid.
    projectionNotes.push('risk_limit_without_numeric_bound_not_fabricated');
  }

  if (outcome === PORTFOLIO_GATE_OUTCOME.UNAVAILABLE && controlOutcome == null) {
    controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
  }

  const portfolioEvidenceRef = projectRef({
    evidence,
    outcome,
    freshness,
    min,
    max,
    recommended,
    reasonKey,
  });

  // Hard invariant: never emit usable sizing after Risk REJECT / UNAVAILABLE.
  const hasUsableSizing = [portfolioEvidenceRef.min, portfolioEvidenceRef.max, portfolioEvidenceRef.recommended]
    .some((value) => typeof value === 'number');
  if (
    (riskOutcome === RISK_GATE_OUTCOME.REJECT || riskOutcome === RISK_GATE_OUTCOME.UNAVAILABLE)
    && hasUsableSizing
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Projector refused to emit usable sizing after Risk block', {
      errors: [{ field: 'portfolioEvidenceRef', code: 'usable_sizing_after_veto' }],
    });
  }

  // Hard invariant: AVAILABLE cannot carry unsafe freshness.
  if (
    portfolioEvidenceRef.outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE
    && UNSAFE_AVAILABLE_FRESHNESS.has(portfolioEvidenceRef.freshness)
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Projector refused to emit stale AVAILABLE', {
      errors: [{ field: 'portfolioEvidenceRef', code: 'stale_portfolio_cannot_be_available' }],
    });
  }

  // Hard invariant: Risk LIMIT numeric must not be exceeded by max.
  if (
    riskOutcome === RISK_GATE_OUTCOME.LIMIT
    && typeof riskRef.limit === 'number'
    && typeof portfolioEvidenceRef.max === 'number'
    && portfolioEvidenceRef.max > riskRef.limit
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Projector refused to emit max above Risk limit', {
      errors: [{ field: 'portfolioEvidenceRef.max', code: 'portfolio_max_exceeds_risk_limit' }],
    });
  }

  const artifact = {
    schemaVersion: PORTFOLIO_SIZING_SCHEMA_VERSION,
    contractVersion: PORTFOLIO_SIZING_CONTRACT_VERSION,
    policyVersion: PORTFOLIO_SIZING_POLICY_VERSION,
    stage: PORTFOLIO_SIZING_STAGE,
    portfolioEvidenceRef,
    controlOutcome,
    lineage: buildLineage(input, evidence),
    provenance: buildProvenance(input),
    limitations: [...PORTFOLIO_SIZING_LIMITATIONS],
    projectionNotes,
    sideEffects: { ...ZERO_PORTFOLIO_SIZING_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
  };

  if (utf8ByteLength(artifact) > MAX_PROJECTOR_UTF8_BYTES) {
    return fail('PAYLOAD_TOO_LARGE', 'Projected Portfolio artifact exceeds size bound', {
      errors: [{ field: 'artifact', code: 'payload_too_large', max: MAX_PROJECTOR_UTF8_BYTES }],
    });
  }

  return { ok: true, artifact };
}

/**
 * Validate a projected portfolioEvidenceRef against Control Chain rules
 * without invoking the full control-chain builder.
 */
export function validateProjectedPortfolioEvidenceRef(ref, riskRef = null) {
  const errors = [];
  if (!assertAllowlist(ref, ALLOWED_PORTFOLIO_EVIDENCE_FIELDS, 'portfolioEvidenceRef', errors)) {
    return fail('INVALID_REF', 'Projected portfolioEvidenceRef failed allowlist', { errors });
  }
  if (ref.agentId !== 'portfolio') {
    errors.push({ field: 'portfolioEvidenceRef.agentId', code: 'invalid_agent_id' });
  }
  if (ref.authorityClass !== AUTHORITY_CLASS.CONTROL_SIZING) {
    errors.push({ field: 'portfolioEvidenceRef.authorityClass', code: 'invalid_authority_class' });
  }
  if (ref.runId != null && !isCanonicalUuid(ref.runId)) {
    errors.push({ field: 'portfolioEvidenceRef.runId', code: 'invalid_uuid' });
  }
  if (!inEnum(ref.outcome, PORTFOLIO_GATE_OUTCOME)) {
    errors.push({ field: 'portfolioEvidenceRef.outcome', code: 'invalid_outcome' });
  }
  if (!inEnum(ref.freshness, FRESHNESS_STATUS)) {
    errors.push({ field: 'portfolioEvidenceRef.freshness', code: 'invalid_freshness' });
  }
  if (ref.outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE && UNSAFE_AVAILABLE_FRESHNESS.has(ref.freshness)) {
    errors.push({ field: 'portfolioEvidenceRef', code: 'stale_portfolio_cannot_be_available' });
  }
  if (ref.accountStateAvailable === false && ref.outcome === PORTFOLIO_GATE_OUTCOME.AVAILABLE) {
    errors.push({ field: 'portfolioEvidenceRef', code: 'missing_account_state' });
  }
  for (const key of ['min', 'max', 'recommended']) {
    if (ref[key] != null && !(typeof ref[key] === 'number' && Number.isFinite(ref[key]))) {
      errors.push({ field: `portfolioEvidenceRef.${key}`, code: 'invalid_bounds' });
    }
  }
  if (typeof ref.min === 'number' && typeof ref.max === 'number' && ref.min > ref.max) {
    errors.push({ field: 'portfolioEvidenceRef', code: 'contradictory_bounds' });
  }
  if (typeof ref.recommended === 'number') {
    if (typeof ref.min === 'number' && ref.recommended < ref.min) {
      errors.push({ field: 'portfolioEvidenceRef.recommended', code: 'recommended_out_of_bounds' });
    }
    if (typeof ref.max === 'number' && ref.recommended > ref.max) {
      errors.push({ field: 'portfolioEvidenceRef.recommended', code: 'recommended_out_of_bounds' });
    }
  }
  const hasBounds = [ref.min, ref.max, ref.recommended].some((value) => value != null);
  if (riskRef?.outcome === RISK_GATE_OUTCOME.REJECT && hasBounds) {
    errors.push({ field: 'portfolioEvidenceRef', code: 'usable_sizing_after_veto' });
  }
  if (riskRef?.outcome === RISK_GATE_OUTCOME.LIMIT
    && typeof riskRef.limit === 'number'
    && typeof ref.max === 'number'
    && ref.max > riskRef.limit) {
    errors.push({ field: 'portfolioEvidenceRef.max', code: 'portfolio_max_exceeds_risk_limit' });
  }
  for (const key of DIRECTION_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(ref, key)) {
      errors.push({ field: `portfolioEvidenceRef.${key}`, code: 'direction_forbidden' });
    }
  }
  if (errors.length) {
    return fail('INVALID_REF', 'Projected portfolioEvidenceRef validation failed', { errors });
  }
  return { ok: true };
}

export default {
  projectPortfolioEvidenceRef,
  validatePortfolioSizingInput,
  validateProjectedPortfolioEvidenceRef,
};
