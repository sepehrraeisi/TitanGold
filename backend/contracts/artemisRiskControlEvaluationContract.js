/**
 * Artemis Core Stage 7.3.2.b — Canonical fail-closed Artemis Risk evaluation.
 *
 * Converts truthful, already-available Risk / account inputs into the Risk
 * CONTROL_VETO envelope consumed by Stage 7.3.2.a
 * (`projectRiskEvidenceRef` → `riskEvidenceRef`).
 *
 * Does NOT:
 *   - call risk-gate.js / risk-agent.js / agents/risk.js
 *   - import legacy artemisOrchestrator or MoE consensus
 *   - invent direction / thesis / execution approval
 *   - fabricate numeric LIMIT values
 *   - clear Emergency Stop / Kill Switch
 *   - mutate Portfolio, Liquidity, Runtime, Order, DB, Redis
 *   - call LLM / provider / HTTP / network
 *   - wire the full Control Chain (Stage 7.3.2.c)
 *
 * Placement:
 *   Risk/account assessment inputs
 *     → this evaluation boundary (fail-closed)
 *     → Stage 7.3.2.a projector
 *     → riskEvidenceRef for future Control Chain wiring
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
import {
  RISK_PROJECTOR_CONTRACT_VERSION,
  RISK_PROJECTOR_POLICY_VERSION,
  RISK_PROJECTOR_STAGE,
  projectRiskEvidenceRef,
} from './artemisRiskControlProjectorContract.js';

export const RISK_EVALUATION_STAGE = '7.3.2.b';
export const RISK_EVALUATION_SCHEMA_VERSION = '1.0.0';
export const RISK_EVALUATION_CONTRACT_VERSION = 'artemis-risk-control-evaluation-1.0.0';
export const RISK_EVALUATION_POLICY_VERSION = 'stage7-3-2b-risk-control-evaluation-1.0.0';
export const RISK_EVALUATION_WRITER = 'artemisRiskControlEvaluationContract';
export const RISK_EVALUATION_METHOD_KEY = 'evaluate_artemis_risk_control_fail_closed';

export const REQUIRED_PROJECTOR_CONTRACT_VERSION = RISK_PROJECTOR_CONTRACT_VERSION;
export const REQUIRED_CONTROL_CHAIN_CONTRACT_VERSION = CONTROL_CHAIN_CONTRACT_VERSION;
export const REQUIRED_EVIDENCE_CONTRACT_VERSION = EVIDENCE_CONTRACT_VERSION;

export const MAX_EVALUATION_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 512;

export const ZERO_RISK_EVALUATION_SIDE_EFFECTS = Object.freeze({
  ...ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
});

export const RISK_EVALUATION_LIMITATIONS = Object.freeze([
  'stage7_3_2b_risk_control_evaluation_only',
  'library_only',
  'fail_closed',
  'does_not_call_risk_gate',
  'does_not_call_risk_agent',
  'does_not_call_agents_risk',
  'does_not_import_legacy_moe',
  'does_not_call_llm_or_provider',
  'does_not_access_db_or_redis',
  'does_not_wire_control_chain',
  'does_not_approve_execution',
  'does_not_clear_kill_switch',
  'uses_stage7_3_2a_projector',
  'live_trading_not_authorized',
]);

/** Explicit assessment lifecycle for fail-closed evaluation. */
export const RISK_ASSESSMENT_STATUS = Object.freeze({
  OK: 'ok',
  MISSING: 'missing',
  MALFORMED: 'malformed',
  TIMEOUT: 'timeout',
  EXCEPTION: 'exception',
  ERROR: 'error',
});

/**
 * Canonical overall risk levels from truthful Risk analysis outputs.
 * Mapping mirrors Stage-3 riskAdapter CONTROL_VETO semantics without importing it.
 */
export const CANONICAL_OVERALL_RISK_LEVEL = Object.freeze({
  VERY_LOW: 'VERY_LOW',
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const ALLOWED_INPUT_TOP = Object.freeze([
  'assessmentStatus',
  'overallRiskLevel',
  'controlOutcome',
  'reasonKey',
  'freshness',
  'availability',
  'riskLimit',
  'unit',
  'min',
  'max',
  'recommended',
  'accountStateAvailable',
  'bookTimestamp',
  'expiryTimestamp',
  'runId',
  'killSwitchActive',
  'decisionId',
  'decisionContextId',
  'recordedAt',
  'sourceEvidenceId',
  'sourceContractVersion',
  'lineage',
  'provenance',
  // Contamination markers — accepted only so they can be rejected fail-closed.
  'riskGateFailOpen',
  'riskGateAllowedOnError',
  'riskGateErrorCode',
  'riskAgentSource',
  'heuristicFallback',
  'legacyMoe',
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
  'evaluationContractVersion',
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
  'place_order',
  'approved',
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

const RISK_GATE_FAIL_OPEN_CODES = Object.freeze([
  'RISK_GATE_ERROR_FAIL_OPEN',
  'DEMO_FAIL_OPEN',
  'FAIL_OPEN',
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

function normalizeFreshness(value, errors, field = 'freshness') {
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

function mapOverallRiskLevel(level) {
  if (level == null) return null;
  const value = String(level).toUpperCase();
  if (value === CANONICAL_OVERALL_RISK_LEVEL.CRITICAL || value === CANONICAL_OVERALL_RISK_LEVEL.HIGH) {
    return {
      outcome: RISK_GATE_OUTCOME.REJECT,
      reasonKey: 'risk_level_blocks',
    };
  }
  if (value === CANONICAL_OVERALL_RISK_LEVEL.MODERATE) {
    return {
      outcome: RISK_GATE_OUTCOME.LIMIT,
      reasonKey: 'risk_level_limits',
    };
  }
  if (value === CANONICAL_OVERALL_RISK_LEVEL.LOW || value === CANONICAL_OVERALL_RISK_LEVEL.VERY_LOW) {
    return {
      outcome: RISK_GATE_OUTCOME.PASS,
      reasonKey: 'risk_level_pass',
    };
  }
  return null;
}

function detectRiskGateFailOpenLeak(input, errors) {
  if (input.riskGateFailOpen === true || input.riskGateAllowedOnError === true) {
    errors.push({ field: 'riskGateFailOpen', code: 'risk_gate_fail_open_forbidden' });
  }
  if (typeof input.riskGateErrorCode === 'string'
    && RISK_GATE_FAIL_OPEN_CODES.includes(input.riskGateErrorCode)) {
    errors.push({ field: 'riskGateErrorCode', code: 'risk_gate_fail_open_forbidden' });
  }
}

function detectHeuristicLeak(input, errors) {
  if (input.heuristicFallback === true) {
    errors.push({ field: 'heuristicFallback', code: 'risk_agent_heuristic_forbidden' });
  }
  if (typeof input.riskAgentSource === 'string') {
    const source = input.riskAgentSource.toLowerCase();
    if (source === 'heuristic' || source === 'risk-agent' || source === 'risk_agent') {
      errors.push({ field: 'riskAgentSource', code: 'risk_agent_heuristic_forbidden' });
    }
  }
}

function detectLegacyMoe(input, errors) {
  if (input.legacyMoe != null) {
    errors.push({ field: 'legacyMoe', code: 'legacy_moe_forbidden' });
  }
}

/**
 * Validate evaluation input allowlists and hard-forbidden contamination.
 * @returns {{ ok: true } | { ok: false, code: string, message: string, errors: object[] }}
 */
export function validateRiskEvaluationInput(input) {
  const errors = [];
  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('INVALID_INPUT', 'Risk evaluation input failed allowlist validation', { errors });
  }

  const allKeys = collectKeysDeep(input);
  for (const key of allKeys) {
    if (EXTRA_FORBIDDEN_KEYS.includes(key) || LEGACY_MOE_FORBIDDEN_KEYS.includes(key)) {
      errors.push({
        field: key,
        code: LEGACY_MOE_FORBIDDEN_KEYS.includes(key) ? 'legacy_moe_forbidden' : 'forbidden_key',
      });
    }
    if (DIRECTION_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'direction_forbidden' });
    }
  }

  for (const key of collectForbiddenSecretKeys(input)) {
    errors.push({ field: key, code: 'forbidden_secret_key' });
  }

  for (const value of collectStringValuesDeep(input)) {
    if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
      errors.push({ field: 'value', code: 'execution_authority_forbidden', value });
    }
  }

  detectRiskGateFailOpenLeak(input, errors);
  detectHeuristicLeak(input, errors);
  detectLegacyMoe(input, errors);

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
  if (input.bookTimestamp != null && !isIsoTimestamp(input.bookTimestamp)) {
    errors.push({ field: 'bookTimestamp', code: 'invalid_timestamp' });
  }
  if (input.expiryTimestamp != null && !isIsoTimestamp(input.expiryTimestamp)) {
    errors.push({ field: 'expiryTimestamp', code: 'invalid_timestamp' });
  }
  assertString('sourceContractVersion', input.sourceContractVersion, errors);
  assertString('sourceEvidenceId', input.sourceEvidenceId, errors);
  assertString('unit', input.unit, errors);
  assertString('reasonKey', input.reasonKey, errors);

  if (input.assessmentStatus != null && !inEnum(input.assessmentStatus, RISK_ASSESSMENT_STATUS)) {
    errors.push({ field: 'assessmentStatus', code: 'invalid_assessment_status' });
  }
  if (input.availability != null && !inEnum(input.availability, AVAILABILITY)) {
    errors.push({ field: 'availability', code: 'invalid_availability' });
  }
  if (input.accountStateAvailable != null && typeof input.accountStateAvailable !== 'boolean') {
    errors.push({ field: 'accountStateAvailable', code: 'invalid_boolean' });
  }
  if (input.killSwitchActive != null && typeof input.killSwitchActive !== 'boolean') {
    errors.push({ field: 'killSwitchActive', code: 'invalid_boolean' });
  }

  for (const key of ['min', 'max', 'recommended']) {
    if (input[key] != null && !(typeof input[key] === 'number' && Number.isFinite(input[key]))) {
      errors.push({ field: key, code: 'invalid_number' });
    }
  }

  // Invalid numeric LIMIT must fail closed before any PASS/LIMIT emission.
  if (input.riskLimit != null) {
    if (!(typeof input.riskLimit === 'number' && Number.isFinite(input.riskLimit) && input.riskLimit >= 0)) {
      errors.push({ field: 'riskLimit', code: 'invalid_limit' });
    }
  }

  if (input.controlOutcome != null) {
    if (typeof input.controlOutcome !== 'string' || !OUTCOME_ALIASES[input.controlOutcome]) {
      errors.push({ field: 'controlOutcome', code: 'unknown_outcome', value: input.controlOutcome });
    }
  }

  if (input.overallRiskLevel != null) {
    const mapped = mapOverallRiskLevel(input.overallRiskLevel);
    if (!mapped) {
      errors.push({ field: 'overallRiskLevel', code: 'unknown_risk_level', value: input.overallRiskLevel });
    }
  }

  if (input.lineage != null) {
    if (!assertAllowlist(input.lineage, ALLOWED_LINEAGE, 'lineage', errors)) {
      // already recorded
    } else {
      if (input.lineage.decisionId != null && !isCanonicalUuid(input.lineage.decisionId)) {
        errors.push({ field: 'lineage.decisionId', code: 'invalid_uuid' });
      }
      if (input.lineage.decisionContextId != null && !isCanonicalUuid(input.lineage.decisionContextId)) {
        errors.push({ field: 'lineage.decisionContextId', code: 'invalid_uuid' });
      }
      if (input.decisionId && input.lineage.decisionId && input.lineage.decisionId !== input.decisionId) {
        errors.push({ field: 'lineage.decisionId', code: 'lineage_decision_mismatch' });
      }
      if (
        input.decisionContextId
        && input.lineage.decisionContextId
        && input.lineage.decisionContextId !== input.decisionContextId
      ) {
        errors.push({ field: 'lineage.decisionContextId', code: 'lineage_context_mismatch' });
      }
    }
  }

  if (input.provenance != null) {
    assertAllowlist(input.provenance, ALLOWED_PROVENANCE, 'provenance', errors);
  }

  const recordedAt = input.provenance?.recordedAt ?? input.recordedAt;
  if (!isIsoTimestamp(recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'required_timestamp' });
  }

  if (utf8ByteLength(input) > MAX_EVALUATION_UTF8_BYTES) {
    errors.push({ field: 'input', code: 'payload_too_large', max: MAX_EVALUATION_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('INVALID_INPUT', 'Risk evaluation input validation failed', { errors });
  }
  return { ok: true };
}

function resolveAssessmentStatus(input) {
  if (input.assessmentStatus != null) return input.assessmentStatus;
  return RISK_ASSESSMENT_STATUS.OK;
}

function buildUnavailableEvidence({ reasonKey, freshness, runId, availability }) {
  const evidence = {
    agentId: 'risk',
    authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
    outcome: RISK_GATE_OUTCOME.UNAVAILABLE,
    freshness: freshness ?? FRESHNESS_STATUS.UNKNOWN,
    availability: availability ?? AVAILABILITY.UNAVAILABLE,
    reasonKey,
  };
  if (runId != null) evidence.runId = runId;
  return evidence;
}

function buildRiskEvidenceFromAssessment(input, freshness, evaluationNotes) {
  const status = resolveAssessmentStatus(input);

  // Fail-closed assessment lifecycle — never PASS.
  if (status === RISK_ASSESSMENT_STATUS.MISSING) {
    evaluationNotes.push('assessment_missing');
    return buildUnavailableEvidence({
      reasonKey: 'risk_assessment_missing',
      freshness: freshness ?? FRESHNESS_STATUS.UNKNOWN,
      runId: input.runId,
    });
  }
  if (status === RISK_ASSESSMENT_STATUS.MALFORMED) {
    evaluationNotes.push('assessment_malformed');
    return buildUnavailableEvidence({
      reasonKey: 'risk_assessment_malformed',
      freshness: freshness ?? FRESHNESS_STATUS.UNKNOWN,
      runId: input.runId,
    });
  }
  if (status === RISK_ASSESSMENT_STATUS.TIMEOUT) {
    evaluationNotes.push('assessment_timeout');
    return buildUnavailableEvidence({
      reasonKey: 'risk_assessment_timeout',
      freshness: freshness ?? FRESHNESS_STATUS.UNKNOWN,
      runId: input.runId,
    });
  }
  if (status === RISK_ASSESSMENT_STATUS.EXCEPTION || status === RISK_ASSESSMENT_STATUS.ERROR) {
    evaluationNotes.push('assessment_exception_or_error');
    return buildUnavailableEvidence({
      reasonKey: 'risk_assessment_exception',
      freshness: freshness ?? FRESHNESS_STATUS.UNKNOWN,
      runId: input.runId,
    });
  }

  let outcome = null;
  let reasonKey = input.reasonKey ?? null;

  if (input.controlOutcome != null) {
    outcome = OUTCOME_ALIASES[input.controlOutcome];
    reasonKey = reasonKey ?? (
      outcome === RISK_GATE_OUTCOME.PASS ? 'risk_level_pass'
        : outcome === RISK_GATE_OUTCOME.LIMIT ? 'risk_level_limits'
          : outcome === RISK_GATE_OUTCOME.REJECT ? 'risk_level_blocks'
            : outcome === RISK_GATE_OUTCOME.NOT_APPLICABLE ? 'risk_not_applicable'
              : 'risk_control_unavailable'
    );
  } else if (input.overallRiskLevel != null) {
    const mapped = mapOverallRiskLevel(input.overallRiskLevel);
    outcome = mapped.outcome;
    reasonKey = reasonKey ?? mapped.reasonKey;
  } else {
    evaluationNotes.push('no_truthful_risk_signal');
    return buildUnavailableEvidence({
      reasonKey: 'risk_assessment_missing',
      freshness: freshness ?? FRESHNESS_STATUS.UNKNOWN,
      runId: input.runId,
    });
  }

  // Kill Switch is not cleared here; active kill switch cannot yield PASS/LIMIT.
  if (input.killSwitchActive === true
    && (outcome === RISK_GATE_OUTCOME.PASS || outcome === RISK_GATE_OUTCOME.LIMIT)) {
    evaluationNotes.push('kill_switch_blocks_positive_risk_outcome');
    outcome = RISK_GATE_OUTCOME.REJECT;
    reasonKey = 'kill_switch_active_blocks_risk_pass';
  }

  const evidence = {
    agentId: 'risk',
    authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
    outcome,
    freshness,
    availability: input.availability ?? AVAILABILITY.AVAILABLE,
    reasonKey,
  };
  if (input.runId != null) evidence.runId = input.runId;
  if (typeof input.accountStateAvailable === 'boolean') {
    evidence.accountStateAvailable = input.accountStateAvailable;
  }
  if (input.bookTimestamp != null) evidence.bookTimestamp = input.bookTimestamp;
  if (input.expiryTimestamp != null) evidence.expiryTimestamp = input.expiryTimestamp;
  if (input.unit != null) evidence.unit = input.unit;
  if (typeof input.min === 'number') evidence.min = input.min;
  if (typeof input.max === 'number') evidence.max = input.max;
  if (typeof input.recommended === 'number') evidence.recommended = input.recommended;

  // Numeric LIMIT only from canonical riskLimit — never fabricate from min/max/recommended.
  if (outcome === RISK_GATE_OUTCOME.LIMIT && typeof input.riskLimit === 'number') {
    evidence.limit = input.riskLimit;
  } else if (outcome === RISK_GATE_OUTCOME.LIMIT) {
    evaluationNotes.push('limit_without_canonical_numeric_bound');
  }

  return evidence;
}

function deriveRiskGateFromRef(ref) {
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
      outcome === RISK_GATE_OUTCOME.UNAVAILABLE
        ? 'risk_unavailable_fail_closed'
        : 'risk_evaluation_contract_only'
    ),
    terminalVeto: outcome === RISK_GATE_OUTCOME.REJECT,
  };
}

function buildEvaluationLineage(input, projectorArtifact) {
  const lineage = {
    ...(projectorArtifact?.lineage ?? {}),
    evaluationContractVersion: RISK_EVALUATION_CONTRACT_VERSION,
    policyVersion: RISK_EVALUATION_POLICY_VERSION,
    projectorContractVersion: RISK_PROJECTOR_CONTRACT_VERSION,
    controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
  };
  if (input.decisionId != null) lineage.decisionId = input.decisionId;
  if (input.decisionContextId != null) lineage.decisionContextId = input.decisionContextId;
  if (input.lineage?.decisionId != null) lineage.decisionId = input.lineage.decisionId;
  if (input.lineage?.decisionContextId != null) {
    lineage.decisionContextId = input.lineage.decisionContextId;
  }
  return lineage;
}

function buildEvaluationProvenance(input) {
  const recordedAt = input.provenance?.recordedAt ?? input.recordedAt;
  const provenance = {
    writer: RISK_EVALUATION_WRITER,
    methodKey: RISK_EVALUATION_METHOD_KEY,
    stage: RISK_EVALUATION_STAGE,
    recordedAt,
    note: 'stage7_3_2b_fail_closed_risk_evaluation',
  };
  if (input.provenance?.writer != null) {
    provenance.sourceWriter = input.provenance.writer;
  } else if (input.provenance?.sourceWriter != null) {
    provenance.sourceWriter = input.provenance.sourceWriter;
  }
  if (input.provenance?.methodKey != null) {
    provenance.sourceMethodKey = input.provenance.methodKey;
  } else if (input.provenance?.sourceMethodKey != null) {
    provenance.sourceMethodKey = input.provenance.sourceMethodKey;
  }
  return provenance;
}

/**
 * Evaluate truthful Risk/account inputs into a projected CONTROL_VETO envelope.
 *
 * @returns projected evaluation artifact or validation failure
 */
export function evaluateArtemisRiskControl(input = {}) {
  const validated = validateRiskEvaluationInput(input);
  if (!validated.ok) return validated;

  const evaluationNotes = [];
  const freshnessErrors = [];
  const freshness = normalizeFreshness(input.freshness, freshnessErrors);

  // Missing/malformed freshness on an otherwise OK assessment fails closed.
  // Assessment failure statuses may omit freshness and default to UNKNOWN.
  const status = resolveAssessmentStatus(input);
  const statusIsFailure = status !== RISK_ASSESSMENT_STATUS.OK;
  if (!statusIsFailure && freshnessErrors.length) {
    return fail('INVALID_INPUT', 'Risk evaluation freshness validation failed', {
      errors: freshnessErrors,
    });
  }
  if (statusIsFailure && freshnessErrors.length) {
    evaluationNotes.push('freshness_defaulted_unknown_on_failed_assessment');
  }

  const riskEvidence = buildRiskEvidenceFromAssessment(
    input,
    freshness ?? FRESHNESS_STATUS.UNKNOWN,
    evaluationNotes,
  );

  const projectorInput = {
    riskEvidence,
    recordedAt: input.provenance?.recordedAt ?? input.recordedAt,
    decisionId: input.decisionId,
    decisionContextId: input.decisionContextId,
    sourceEvidenceId: input.sourceEvidenceId,
    sourceContractVersion: input.sourceContractVersion,
  };
  if (input.lineage != null) {
    projectorInput.lineage = { ...input.lineage };
  }
  if (input.provenance != null) {
    projectorInput.provenance = {
      writer: input.provenance.writer,
      methodKey: input.provenance.methodKey,
      stage: input.provenance.stage,
      recordedAt: input.provenance.recordedAt ?? input.recordedAt,
      note: input.provenance.note,
      sourceWriter: input.provenance.sourceWriter,
      sourceMethodKey: input.provenance.sourceMethodKey,
    };
  }

  const projected = projectRiskEvidenceRef(projectorInput);
  if (!projected.ok) {
    return fail(projected.code ?? 'PROJECTOR_REJECTED', projected.message ?? 'Stage 7.3.2.a projector rejected Risk evidence', {
      errors: projected.errors ?? [],
      evaluationNotes,
    });
  }

  const riskEvidenceRef = projected.artifact.riskEvidenceRef;
  // Hard invariant: evaluation must never emit PASS under unsafe freshness.
  if (
    riskEvidenceRef.outcome === RISK_GATE_OUTCOME.PASS
    && (
      riskEvidenceRef.freshness === FRESHNESS_STATUS.STALE
      || riskEvidenceRef.freshness === FRESHNESS_STATUS.EXPIRED
      || riskEvidenceRef.freshness === FRESHNESS_STATUS.UNKNOWN
      || riskEvidenceRef.freshness === FRESHNESS_STATUS.UNAVAILABLE
    )
  ) {
    return fail('INTERNAL_FAIL_CLOSED', 'Evaluation refused to emit stale PASS', {
      errors: [{ field: 'riskEvidenceRef', code: 'stale_risk_cannot_pass' }],
      evaluationNotes,
    });
  }

  const riskGate = deriveRiskGateFromRef(riskEvidenceRef);
  const artifact = {
    schemaVersion: RISK_EVALUATION_SCHEMA_VERSION,
    contractVersion: RISK_EVALUATION_CONTRACT_VERSION,
    policyVersion: RISK_EVALUATION_POLICY_VERSION,
    stage: RISK_EVALUATION_STAGE,
    riskEvidenceRef,
    riskGate,
    controlOutcome: projected.artifact.controlOutcome,
    projector: {
      stage: RISK_PROJECTOR_STAGE,
      contractVersion: RISK_PROJECTOR_CONTRACT_VERSION,
      policyVersion: RISK_PROJECTOR_POLICY_VERSION,
      projectionNotes: projected.artifact.projectionNotes ?? [],
    },
    lineage: buildEvaluationLineage(input, projected.artifact),
    provenance: buildEvaluationProvenance(input),
    limitations: [...RISK_EVALUATION_LIMITATIONS],
    evaluationNotes,
    sideEffects: { ...ZERO_RISK_EVALUATION_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
  };

  if (utf8ByteLength(artifact) > MAX_EVALUATION_UTF8_BYTES) {
    return fail('PAYLOAD_TOO_LARGE', 'Risk evaluation artifact exceeds size bound', {
      errors: [{ field: 'artifact', code: 'payload_too_large', max: MAX_EVALUATION_UTF8_BYTES }],
    });
  }

  return { ok: true, artifact };
}

export default {
  evaluateArtemisRiskControl,
  validateRiskEvaluationInput,
  RISK_EVALUATION_CONTRACT_VERSION,
  RISK_ASSESSMENT_STATUS,
  CANONICAL_OVERALL_RISK_LEVEL,
};
