/**
 * Artemis Core Stage 7.3.2.a — Risk Evidence → Control Chain Risk projector.
 *
 * Library-only projector that converts an already-produced, allowlisted Risk
 * evidence representation into the exact riskEvidenceRef shape required by
 * artemisControlChainContract.js (Stage 7.3.1).
 *
 * Does NOT:
 *   - calculate risk
 *   - call risk-gate / risk-agent / agents/risk
 *   - call LLM / provider / HTTP / network
 *   - access DB / Redis
 *   - wire the control chain, Portfolio, Liquidity, Runtime, or Order
 *   - approve execution or invent Cognitive Decisions
 *
 * Placement:
 *   Risk evidence (allowlisted) → this projector → riskEvidenceRef
 *     → future Control Chain gate evaluation (NOT in this slice)
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
  RISK_GATE_OUTCOME,
  ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
} from './artemisControlChainContract.js';

export const RISK_PROJECTOR_STAGE = '7.3.2.a';
export const RISK_PROJECTOR_SCHEMA_VERSION = '1.0.0';
export const RISK_PROJECTOR_CONTRACT_VERSION = 'artemis-risk-control-projector-1.0.0';
export const RISK_PROJECTOR_POLICY_VERSION = 'stage7-3-2a-risk-control-projector-1.0.0';
export const RISK_PROJECTOR_WRITER = 'artemisRiskControlProjectorContract';
export const RISK_PROJECTOR_METHOD_KEY = 'project_risk_evidence_ref_fail_closed';

export const REQUIRED_CONTROL_CHAIN_CONTRACT_VERSION = CONTROL_CHAIN_CONTRACT_VERSION;
export const REQUIRED_EVIDENCE_CONTRACT_VERSION = EVIDENCE_CONTRACT_VERSION;

export const MAX_PROJECTOR_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 512;

export const ZERO_RISK_PROJECTOR_SIDE_EFFECTS = Object.freeze({
  ...ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
});

export const RISK_PROJECTOR_LIMITATIONS = Object.freeze([
  'stage7_3_2a_risk_control_projector_only',
  'library_only',
  'does_not_calculate_risk',
  'does_not_call_risk_gate',
  'does_not_call_risk_agent',
  'does_not_call_agents_risk',
  'does_not_call_llm_or_provider',
  'does_not_access_db_or_redis',
  'does_not_wire_control_chain',
  'does_not_approve_execution',
  'control_veto_projection_only',
  'live_trading_not_authorized',
]);

/** Allowlisted riskEvidence fields (flat). Matches Control Chain ALLOWED_EVIDENCE_REF. */
export const ALLOWED_RISK_EVIDENCE_FIELDS = Object.freeze([
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
  'riskEvidence',
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

const EXTRA_FORBIDDEN_KEYS = Object.freeze([
  ...FORBIDDEN_CONTROL_CHAIN_KEYS,
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
  'BUY',
  'SELL',
  'EXECUTE',
  'LONG',
  'SHORT',
]);

const OUTCOME_ALIASES = Object.freeze({
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

const UNSAFE_PASS_FRESHNESS = new Set([
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

function normalizeFreshness(value, errors, field = 'riskEvidence.freshness') {
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
  // Adapter-shaped freshness object: { status } only — extract status, reject other shapes.
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
    // Reject unknown nested freshness fields beyond status (fail-closed).
    const allowedFreshObj = new Set(['status']);
    const unknown = Object.keys(value).filter((key) => !allowedFreshObj.has(key));
    if (unknown.length) {
      errors.push({ field, code: 'malformed_freshness', fields: unknown });
      return null;
    }
    return status;
  }
  errors.push({ field, code: 'malformed_freshness' });
  return null;
}

function normalizeOutcome(value, errors, field = 'riskEvidence.outcome') {
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

function validateRiskEvidenceShape(evidence, errors) {
  if (!assertAllowlist(evidence, ALLOWED_RISK_EVIDENCE_FIELDS, 'riskEvidence', errors)) {
    return { outcome: null, freshness: null };
  }

  if (evidence.agentId !== 'risk') {
    errors.push({ field: 'riskEvidence.agentId', code: 'invalid_agent_id', expected: 'risk' });
  }
  if (evidence.authorityClass !== AUTHORITY_CLASS.CONTROL_VETO) {
    errors.push({
      field: 'riskEvidence.authorityClass',
      code: 'invalid_authority_class',
      expected: AUTHORITY_CLASS.CONTROL_VETO,
    });
  }
  if (evidence.runId != null && !isCanonicalUuid(evidence.runId)) {
    errors.push({ field: 'riskEvidence.runId', code: 'invalid_uuid' });
  }
  assertString('riskEvidence.reasonKey', evidence.reasonKey, errors, { required: true });
  assertString('riskEvidence.unit', evidence.unit, errors);

  if (evidence.availability != null && !inEnum(evidence.availability, AVAILABILITY)) {
    errors.push({ field: 'riskEvidence.availability', code: 'invalid_availability' });
  }

  if (evidence.bookTimestamp != null && !isIsoTimestamp(evidence.bookTimestamp)) {
    errors.push({ field: 'riskEvidence.bookTimestamp', code: 'invalid_timestamp' });
  }
  if (evidence.expiryTimestamp != null && !isIsoTimestamp(evidence.expiryTimestamp)) {
    errors.push({ field: 'riskEvidence.expiryTimestamp', code: 'invalid_timestamp' });
  }

  if (evidence.accountStateAvailable != null && typeof evidence.accountStateAvailable !== 'boolean') {
    errors.push({ field: 'riskEvidence.accountStateAvailable', code: 'invalid_boolean' });
  }

  for (const key of ['min', 'max', 'recommended']) {
    if (evidence[key] != null && !(typeof evidence[key] === 'number' && Number.isFinite(evidence[key]))) {
      errors.push({ field: `riskEvidence.${key}`, code: 'invalid_number' });
    }
  }
  if (evidence.limit != null && !(typeof evidence.limit === 'number' && Number.isFinite(evidence.limit) && evidence.limit >= 0)) {
    errors.push({ field: 'riskEvidence.limit', code: 'invalid_limit' });
  }

  for (const key of DIRECTION_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(evidence, key)) {
      errors.push({ field: `riskEvidence.${key}`, code: 'direction_forbidden' });
    }
  }

  const outcome = normalizeOutcome(evidence.outcome, errors);
  const freshness = normalizeFreshness(evidence.freshness, errors);
  return { outcome, freshness };
}

function validateCallerLineage(lineage, errors, decisionId, decisionContextId) {
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
}

/**
 * Validate projector input without projecting.
 * @returns {{ ok: true } | { ok: false, code: string, message: string, errors: object[] }}
 */
export function validateRiskProjectorInput(input) {
  const errors = [];
  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('INVALID_INPUT', 'Risk projector input failed allowlist validation', { errors });
  }

  const allKeys = collectKeysDeep(input);
  for (const key of allKeys) {
    if (EXTRA_FORBIDDEN_KEYS.includes(key) || LEGACY_MOE_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: key === 'votes' || LEGACY_MOE_FORBIDDEN_KEYS.includes(key) ? 'legacy_moe_forbidden' : 'forbidden_key' });
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

  if (!input.riskEvidence) {
    errors.push({ field: 'riskEvidence', code: 'required' });
  } else {
    validateRiskEvidenceShape(input.riskEvidence, errors);
  }

  validateCallerLineage(input.lineage, errors, input.decisionId, input.decisionContextId);
  validateCallerProvenance(input.provenance, errors);

  const recordedAt = input.provenance?.recordedAt ?? input.recordedAt;
  if (!isIsoTimestamp(recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'required_timestamp' });
  }

  if (utf8ByteLength(input) > MAX_PROJECTOR_UTF8_BYTES) {
    errors.push({ field: 'input', code: 'payload_too_large', max: MAX_PROJECTOR_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('INVALID_INPUT', 'Risk projector input validation failed', { errors });
  }
  return { ok: true };
}

function buildLineage(input, evidence) {
  const lineage = {
    projectorContractVersion: RISK_PROJECTOR_CONTRACT_VERSION,
    policyVersion: RISK_PROJECTOR_POLICY_VERSION,
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
  if (input.lineage?.agentId != null) {
    // Never replace source agent identity with projector identity; keep source.
    lineage.agentId = input.lineage.agentId;
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
    writer: RISK_PROJECTOR_WRITER,
    methodKey: RISK_PROJECTOR_METHOD_KEY,
    stage: RISK_PROJECTOR_STAGE,
    recordedAt,
  };
  if (input.provenance?.sourceWriter != null) {
    provenance.sourceWriter = input.provenance.sourceWriter;
  } else if (input.provenance?.writer != null && input.provenance.writer !== RISK_PROJECTOR_WRITER) {
    provenance.sourceWriter = input.provenance.writer;
  }
  if (input.provenance?.sourceMethodKey != null) {
    provenance.sourceMethodKey = input.provenance.sourceMethodKey;
  } else if (input.provenance?.methodKey != null && input.provenance.methodKey !== RISK_PROJECTOR_METHOD_KEY) {
    provenance.sourceMethodKey = input.provenance.methodKey;
  }
  if (input.provenance?.note != null) provenance.note = input.provenance.note;
  return provenance;
}

function projectRef({ evidence, outcome, freshness }) {
  const ref = {
    agentId: 'risk',
    authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
    outcome,
    freshness,
    reasonKey: evidence.reasonKey,
  };
  if (evidence.runId != null) ref.runId = evidence.runId;
  if (evidence.availability != null) ref.availability = evidence.availability;
  if (typeof evidence.limit === 'number') ref.limit = evidence.limit;
  if (evidence.unit != null) ref.unit = evidence.unit;
  if (typeof evidence.min === 'number') ref.min = evidence.min;
  if (typeof evidence.max === 'number') ref.max = evidence.max;
  if (typeof evidence.recommended === 'number') ref.recommended = evidence.recommended;
  if (typeof evidence.accountStateAvailable === 'boolean') {
    ref.accountStateAvailable = evidence.accountStateAvailable;
  }
  if (evidence.bookTimestamp != null) ref.bookTimestamp = evidence.bookTimestamp;
  if (evidence.expiryTimestamp != null) ref.expiryTimestamp = evidence.expiryTimestamp;
  return ref;
}

/**
 * Project allowlisted Risk evidence into Control Chain riskEvidenceRef.
 *
 * Fail-closed:
 *   - unknown outcome → validation error (never PASS)
 *   - stale/expired/unknown/missing freshness on PASS → UNAVAILABLE
 *   - non-available availability on PASS/LIMIT → UNAVAILABLE
 *   - LIMIT without numeric limit stays LIMIT with explicit reason
 *
 * @returns projected artifact or validation failure
 */
export function projectRiskEvidenceRef(input = {}) {
  const validated = validateRiskProjectorInput(input);
  if (!validated.ok) return validated;

  const evidence = input.riskEvidence;
  const shapeErrors = [];
  const { outcome: normalizedOutcome, freshness } = validateRiskEvidenceShape(evidence, shapeErrors);
  if (shapeErrors.length || !normalizedOutcome || !freshness) {
    return fail('INVALID_INPUT', 'Risk evidence shape invalid after validation', { errors: shapeErrors });
  }

  let outcome = normalizedOutcome;
  let reasonKey = evidence.reasonKey;
  let controlOutcome = null;
  const projectionNotes = [];

  const availability = evidence.availability ?? AVAILABILITY.AVAILABLE;
  const availabilityBlocksPositive = availability !== AVAILABILITY.AVAILABLE
    && availability !== AVAILABILITY.NOT_APPLICABLE;

  // Fail-closed freshness: PASS cannot survive unsafe freshness.
  if (outcome === RISK_GATE_OUTCOME.PASS && UNSAFE_PASS_FRESHNESS.has(freshness)) {
    outcome = RISK_GATE_OUTCOME.UNAVAILABLE;
    reasonKey = 'stale_risk_cannot_pass';
    controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
    projectionNotes.push('freshness_blocked_pass');
  }

  // Missing/unavailable assessment availability cannot PASS or LIMIT.
  if (
    availabilityBlocksPositive
    && (outcome === RISK_GATE_OUTCOME.PASS || outcome === RISK_GATE_OUTCOME.LIMIT)
  ) {
    outcome = RISK_GATE_OUTCOME.UNAVAILABLE;
    reasonKey = 'risk_availability_fail_closed';
    controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
    projectionNotes.push('availability_blocked_positive_outcome');
  }

  // LIMIT without usable numeric limit: remain LIMIT, never invent, never PASS.
  if (outcome === RISK_GATE_OUTCOME.LIMIT && typeof evidence.limit !== 'number') {
    reasonKey = 'risk_limit_without_numeric_bound';
    projectionNotes.push('limit_without_numeric_bound');
  }

  if (outcome === RISK_GATE_OUTCOME.UNAVAILABLE && controlOutcome == null) {
    controlOutcome = CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE;
  }

  const riskEvidenceRef = projectRef({
    evidence: { ...evidence, reasonKey },
    outcome,
    freshness,
  });

  // Hard invariant: never emit execution authority or PASS after freshness downgrade bug.
  if (
    riskEvidenceRef.outcome === RISK_GATE_OUTCOME.PASS
    && UNSAFE_PASS_FRESHNESS.has(riskEvidenceRef.freshness)
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Projector refused to emit stale PASS', {
      errors: [{ field: 'riskEvidenceRef', code: 'stale_risk_cannot_pass' }],
    });
  }

  const artifact = {
    schemaVersion: RISK_PROJECTOR_SCHEMA_VERSION,
    contractVersion: RISK_PROJECTOR_CONTRACT_VERSION,
    policyVersion: RISK_PROJECTOR_POLICY_VERSION,
    stage: RISK_PROJECTOR_STAGE,
    riskEvidenceRef,
    controlOutcome,
    lineage: buildLineage(input, evidence),
    provenance: buildProvenance(input),
    limitations: [...RISK_PROJECTOR_LIMITATIONS],
    projectionNotes,
    sideEffects: { ...ZERO_RISK_PROJECTOR_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
  };

  if (utf8ByteLength(artifact) > MAX_PROJECTOR_UTF8_BYTES) {
    return fail('PAYLOAD_TOO_LARGE', 'Projected Risk artifact exceeds size bound', {
      errors: [{ field: 'artifact', code: 'payload_too_large', max: MAX_PROJECTOR_UTF8_BYTES }],
    });
  }

  return { ok: true, artifact };
}

/**
 * Validate a projected riskEvidenceRef against Control Chain outcome/freshness rules
 * without invoking the full control-chain builder.
 */
export function validateProjectedRiskEvidenceRef(ref) {
  const errors = [];
  if (!assertAllowlist(ref, ALLOWED_RISK_EVIDENCE_FIELDS, 'riskEvidenceRef', errors)) {
    return fail('INVALID_REF', 'Projected riskEvidenceRef failed allowlist', { errors });
  }
  if (ref.agentId !== 'risk') {
    errors.push({ field: 'riskEvidenceRef.agentId', code: 'invalid_agent_id' });
  }
  if (ref.authorityClass !== AUTHORITY_CLASS.CONTROL_VETO) {
    errors.push({ field: 'riskEvidenceRef.authorityClass', code: 'invalid_authority_class' });
  }
  if (ref.runId != null && !isCanonicalUuid(ref.runId)) {
    errors.push({ field: 'riskEvidenceRef.runId', code: 'invalid_uuid' });
  }
  if (!inEnum(ref.outcome, RISK_GATE_OUTCOME)) {
    errors.push({ field: 'riskEvidenceRef.outcome', code: 'invalid_outcome' });
  }
  if (!inEnum(ref.freshness, FRESHNESS_STATUS)) {
    errors.push({ field: 'riskEvidenceRef.freshness', code: 'invalid_freshness' });
  }
  if (ref.outcome === RISK_GATE_OUTCOME.PASS && UNSAFE_PASS_FRESHNESS.has(ref.freshness)) {
    errors.push({ field: 'riskEvidenceRef', code: 'stale_risk_cannot_pass' });
  }
  if (ref.limit != null && !(typeof ref.limit === 'number' && Number.isFinite(ref.limit) && ref.limit >= 0)) {
    errors.push({ field: 'riskEvidenceRef.limit', code: 'invalid_limit' });
  }
  for (const key of DIRECTION_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(ref, key)) {
      errors.push({ field: `riskEvidenceRef.${key}`, code: 'direction_forbidden' });
    }
  }
  if (errors.length) {
    return fail('INVALID_REF', 'Projected riskEvidenceRef validation failed', { errors });
  }
  return { ok: true };
}

export default {
  projectRiskEvidenceRef,
  validateRiskProjectorInput,
  validateProjectedRiskEvidenceRef,
};
