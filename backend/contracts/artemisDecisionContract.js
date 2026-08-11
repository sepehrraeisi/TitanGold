/**
 * Artemis WP-C.1 — canonical ArtemisDecision contract owner.
 * schemaVersion 1.0.0 / contractVersion artemis-decision-1.0.0
 *
 * Pure validation only. Does not synthesize decisions, call providers,
 * mutate runtime, or authorize execution.
 *
 * Hard invariants for C.1:
 * - decisionEligible must be false
 * - executionEligible must be false
 * - approvedForExecution must not be true
 * - legacy approved / BUY/SELL/EXECUTE authorization fields are rejected
 */

import {
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  AVAILABILITY,
  CONFIDENCE_KIND,
  CONFIDENCE_SCALE,
  CALIBRATION_STATE,
  CORRELATION_FAMILY,
  FRESHNESS_STATUS,
  MARKET_TYPE,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  isUnavailableRepresentation,
  utf8ByteLength,
} from './artemisEvidenceContract.js';

export const DECISION_SCHEMA_VERSION = '1.0.0';
export const DECISION_CONTRACT_VERSION = 'artemis-decision-1.0.0';
export const MAX_EVIDENCE_REFS = 32;
export const MAX_LIMITATIONS = 64;
export const MAX_DECISION_UTF8_BYTES = 16 * 1024;
export const MAX_STRING_CHARS = 256;

export const MATURITY_STAGE = Object.freeze({
  CONTRACT_ONLY: 'CONTRACT_ONLY',
  LEGACY_ADVISORY: 'LEGACY_ADVISORY',
  ADVISORY_ONLY: 'ADVISORY_ONLY',
});

export const CLASSIFICATION = Object.freeze({
  CONTRACT_ONLY: 'CONTRACT_ONLY',
  ADVISORY_ONLY: 'ADVISORY_ONLY',
  LEGACY_ADVISORY_ONLY: 'LEGACY_ADVISORY_ONLY',
});

export const SYNTHESIS_OUTCOME = Object.freeze({
  UNSPECIFIED: 'unspecified',
  PROPOSED: 'proposed',
  HOLD: 'hold',
  ABSTAIN: 'abstain',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  INCOMPATIBLE_EVIDENCE: 'incompatible_evidence',
  BLOCKED_BY_RISK: 'blocked_by_risk',
  BLOCKED_BY_RUNTIME: 'blocked_by_runtime',
  UNAVAILABLE: 'unavailable',
});

export const DIRECTION_OR_ABSTAIN = Object.freeze({
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  SIDEWAYS: 'sideways',
  NEUTRAL: 'neutral',
  ABSTAIN: 'abstain',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const CONFLICT_STATE = Object.freeze({
  NONE: 'none',
  INFORMATIONAL: 'informational',
  MATERIAL: 'material',
  BLOCKING: 'blocking',
  UNAVAILABLE: 'unavailable',
});

export const RISK_STATUS = Object.freeze({
  PENDING: 'pending',
  UNAVAILABLE: 'unavailable',
  VETOED: 'vetoed',
  LIMITED: 'limited',
  APPROVED_LIMITS: 'approved_limits',
  NOT_APPLICABLE: 'not_applicable',
});

export const LIQUIDITY_STATUS = Object.freeze({
  PENDING: 'pending',
  UNAVAILABLE: 'unavailable',
  FEASIBLE: 'feasible',
  INFEASIBLE: 'infeasible',
  STALE: 'stale',
  NOT_APPLICABLE: 'not_applicable',
});

export const ALLOCATION_AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  PENDING: 'pending',
  NOT_APPLICABLE: 'not_applicable',
});

export const EVIDENCE_ADMISSION_STATE = Object.freeze({
  ADMITTED: 'ADMITTED',
  ADMITTED_DEGRADED: 'ADMITTED_DEGRADED',
  ADMITTED_NON_CONFIRMING: 'ADMITTED_NON_CONFIRMING',
  EXCLUDED: 'EXCLUDED',
  REJECTED: 'REJECTED',
});

export const CONFIRMATION_SEMANTICS = Object.freeze({
  DIRECTIONAL_CANDIDATE: 'directional_candidate',
  OPPORTUNITY_CONTEXT: 'opportunity_context',
  NON_CONFIRMING: 'non_confirming',
  NONE: 'none',
});

const FORBIDDEN_TOP_LEVEL = new Set([
  'approved',
  'approvedForExecution',
  'action',
  'legacyApprovedFieldSemantics',
  'sideEffectsSuppressed',
  'input_data',
  'output_data',
  'metadata',
  'raw',
  'payload',
]);

const ALLOWED_TOP_LEVEL = new Set([
  'schemaVersion',
  'contractVersion',
  'decisionId',
  'decisionContextId',
  'symbol',
  'baseAsset',
  'quoteAsset',
  'venue',
  'marketType',
  'timeframe',
  'analysisHorizon',
  'createdAt',
  'analysisAt',
  'expiresAt',
  'sourceWindow',
  'evidenceRefs',
  'synthesisOutcome',
  'direction',
  'confidence',
  'conflictState',
  'limitations',
  'riskStatus',
  'allocationProposal',
  'liquidityStatus',
  'runtimeStatus',
  'classification',
  'maturityStage',
  'decisionEligible',
  'executionEligible',
  'policyVersion',
  'implementationVersion',
]);

const ALLOWED_SOURCE_WINDOW = new Set(['start', 'end', 'availability', 'reasonKey']);
const ALLOWED_EVIDENCE_REF = new Set([
  'agentId',
  'runId',
  'agentRecordId',
  'evidenceContractVersion',
  'role',
  'authorityClass',
  'correlationFamily',
  'freshness',
  'availability',
  'admissionState',
  'admissionReason',
  'confirmationSemantics',
  'symbol',
  'venue',
  'marketType',
  'timeframe',
  'analysisHorizon',
  'analysisTimestamp',
]);
const ALLOWED_CONFIDENCE = new Set([
  'availability',
  'value',
  'scale',
  'kind',
  'calibrationState',
  'reasonKey',
  'provenance',
]);
const ALLOWED_CONFIDENCE_PROVENANCE = new Set(['writer', 'path', 'methodKey']);
const ALLOWED_ALLOCATION = new Set(['availability', 'reasonKey', 'unit', 'min', 'max', 'recommended']);
const ALLOWED_RUNTIME_STATUS = new Set([
  'availability',
  'killSwitchActive',
  'effectiveMode',
  'reasonKey',
]);
const ALLOWED_UNAVAILABLE_OBJECT = new Set(['availability', 'reasonKey']);

function inEnum(value, table) {
  return Object.values(table).includes(value);
}

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function rejectUnknownFields(obj, allowed, field, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const unknown = Object.keys(obj).filter((key) => !allowed.has(key));
  if (unknown.length) {
    errors.push({ field, code: 'unknown_field', fields: unknown });
    return true;
  }
  return false;
}

function optionalString(field, value, errors, { max = MAX_STRING_CHARS } = {}) {
  if (value == null) return;
  if (typeof value !== 'string' || !value.trim()) {
    errors.push({ field, code: 'invalid_string' });
    return;
  }
  if (value.length > max) errors.push({ field, code: 'string_too_long', max });
}

function optionalNullableString(field, value, errors, { max = MAX_STRING_CHARS } = {}) {
  if (value == null) return;
  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid_string' });
    return;
  }
  if (value.length > max) errors.push({ field, code: 'string_too_long', max });
}

function assertIsoRequired(field, value, errors) {
  if (!isIsoTimestamp(value)) errors.push({ field, code: 'invalid_timestamp' });
}

function assertIsoOptional(field, value, errors) {
  if (value == null) return;
  if (isUnavailableRepresentation(value)) return;
  if (!isIsoTimestamp(value)) errors.push({ field, code: 'invalid_timestamp' });
}

function validateIdentifier(field, value, errors, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'identifier_required' });
    return;
  }
  if (isUnavailableRepresentation(value)) {
    if (typeof value === 'object') rejectUnknownFields(value, ALLOWED_UNAVAILABLE_OBJECT, field, errors);
    return;
  }
  if (!isCanonicalUuid(value)) {
    errors.push({ field, code: 'invalid_uuid_identifier' });
  }
}

function validateSourceWindow(window, errors) {
  if (window == null) return;
  if (typeof window !== 'object' || Array.isArray(window)) {
    errors.push({ field: 'sourceWindow', code: 'invalid_source_window' });
    return;
  }
  rejectUnknownFields(window, ALLOWED_SOURCE_WINDOW, 'sourceWindow', errors);
  if (window.availability != null && !inEnum(window.availability, AVAILABILITY)) {
    errors.push({ field: 'sourceWindow.availability', code: 'invalid_availability' });
  }
  optionalString('sourceWindow.reasonKey', window.reasonKey, errors);
  assertIsoOptional('sourceWindow.start', window.start, errors);
  assertIsoOptional('sourceWindow.end', window.end, errors);
  if (isIsoTimestamp(window.start) && isIsoTimestamp(window.end)) {
    if (Date.parse(window.end) < Date.parse(window.start)) {
      errors.push({ field: 'sourceWindow', code: 'invalid_time_ordering' });
    }
  }
}

function validateConfidence(confidence, errors) {
  if (confidence == null) {
    errors.push({ field: 'confidence', code: 'confidence_required' });
    return;
  }
  if (typeof confidence !== 'object' || Array.isArray(confidence)) {
    errors.push({ field: 'confidence', code: 'invalid_confidence' });
    return;
  }
  rejectUnknownFields(confidence, ALLOWED_CONFIDENCE, 'confidence', errors);
  if (!['available', 'unavailable'].includes(confidence.availability)) {
    errors.push({ field: 'confidence.availability', code: 'invalid_confidence_availability' });
    return;
  }
  if (confidence.calibrationState != null && !inEnum(confidence.calibrationState, CALIBRATION_STATE)) {
    errors.push({ field: 'confidence.calibrationState', code: 'invalid_calibration_state' });
  }
  if (confidence.provenance != null) {
    if (typeof confidence.provenance === 'string') {
      if (!confidence.provenance.trim()) errors.push({ field: 'confidence.provenance', code: 'invalid_confidence_provenance' });
    } else if (typeof confidence.provenance === 'object' && !Array.isArray(confidence.provenance)) {
      rejectUnknownFields(confidence.provenance, ALLOWED_CONFIDENCE_PROVENANCE, 'confidence.provenance', errors);
      optionalString('confidence.provenance.writer', confidence.provenance.writer, errors);
      optionalString('confidence.provenance.path', confidence.provenance.path, errors);
      optionalString('confidence.provenance.methodKey', confidence.provenance.methodKey, errors);
    } else {
      errors.push({ field: 'confidence.provenance', code: 'invalid_confidence_provenance' });
    }
  }
  if (confidence.availability === 'unavailable') {
    if (confidence.value != null) {
      errors.push({ field: 'confidence.value', code: 'unavailable_confidence_must_omit_value' });
    }
    if (confidence.kind != null && !inEnum(confidence.kind, CONFIDENCE_KIND)) {
      errors.push({ field: 'confidence.kind', code: 'invalid_confidence_kind' });
    }
    if (confidence.scale != null && !inEnum(confidence.scale, CONFIDENCE_SCALE)) {
      errors.push({ field: 'confidence.scale', code: 'invalid_confidence_scale' });
    }
    optionalString('confidence.reasonKey', confidence.reasonKey, errors);
    return;
  }
  if (typeof confidence.value !== 'number' || !Number.isFinite(confidence.value)) {
    errors.push({ field: 'confidence.value', code: 'invalid_confidence_value' });
  }
  if (!inEnum(confidence.scale, CONFIDENCE_SCALE) || confidence.scale === CONFIDENCE_SCALE.UNKNOWN) {
    errors.push({ field: 'confidence.scale', code: 'invalid_confidence_scale' });
  }
  if (!inEnum(confidence.kind, CONFIDENCE_KIND) || confidence.kind === CONFIDENCE_KIND.UNAVAILABLE) {
    errors.push({ field: 'confidence.kind', code: 'invalid_confidence_kind' });
  }
  if (confidence.provenance == null) {
    errors.push({ field: 'confidence.provenance', code: 'confidence_provenance_required' });
  }
}

function validateAllocationProposal(allocation, errors) {
  if (allocation == null) return;
  if (typeof allocation !== 'object' || Array.isArray(allocation)) {
    errors.push({ field: 'allocationProposal', code: 'invalid_allocation_proposal' });
    return;
  }
  rejectUnknownFields(allocation, ALLOWED_ALLOCATION, 'allocationProposal', errors);
  if (!inEnum(allocation.availability, ALLOCATION_AVAILABILITY)) {
    errors.push({ field: 'allocationProposal.availability', code: 'invalid_allocation_availability' });
  }
  optionalString('allocationProposal.reasonKey', allocation.reasonKey, errors);
  optionalNullableString('allocationProposal.unit', allocation.unit, errors);
  for (const key of ['min', 'max', 'recommended']) {
    if (allocation[key] != null && (typeof allocation[key] !== 'number' || !Number.isFinite(allocation[key]))) {
      errors.push({ field: `allocationProposal.${key}`, code: 'invalid_allocation_number' });
    }
  }
}

function validateRuntimeStatus(runtime, errors) {
  if (runtime == null) return;
  if (typeof runtime !== 'object' || Array.isArray(runtime)) {
    errors.push({ field: 'runtimeStatus', code: 'invalid_runtime_status' });
    return;
  }
  rejectUnknownFields(runtime, ALLOWED_RUNTIME_STATUS, 'runtimeStatus', errors);
  if (runtime.availability != null && !inEnum(runtime.availability, AVAILABILITY)) {
    errors.push({ field: 'runtimeStatus.availability', code: 'invalid_availability' });
  }
  if (runtime.killSwitchActive != null && typeof runtime.killSwitchActive !== 'boolean') {
    errors.push({ field: 'runtimeStatus.killSwitchActive', code: 'invalid_boolean' });
  }
  optionalNullableString('runtimeStatus.effectiveMode', runtime.effectiveMode, errors);
  optionalString('runtimeStatus.reasonKey', runtime.reasonKey, errors);
}

function validateEvidenceRef(ref, index, errors) {
  const field = `evidenceRefs[${index}]`;
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    errors.push({ field, code: 'invalid_evidence_ref' });
    return;
  }
  rejectUnknownFields(ref, ALLOWED_EVIDENCE_REF, field, errors);
  if (!ref.agentId || typeof ref.agentId !== 'string' || !Object.prototype.hasOwnProperty.call(AGENT_CONTRACT_ROLE, ref.agentId)) {
    errors.push({ field: `${field}.agentId`, code: 'unknown_agent_id' });
  }
  validateIdentifier(`${field}.runId`, ref.runId, errors);
  validateIdentifier(`${field}.agentRecordId`, ref.agentRecordId, errors);
  optionalString(`${field}.evidenceContractVersion`, ref.evidenceContractVersion, errors);
  if (ref.role != null && !inEnum(ref.role, AUTHORITY_CLASS)) {
    errors.push({ field: `${field}.role`, code: 'invalid_role' });
  }
  if (ref.authorityClass != null && !inEnum(ref.authorityClass, AUTHORITY_CLASS)) {
    errors.push({ field: `${field}.authorityClass`, code: 'invalid_authority_class' });
  }
  if (ref.correlationFamily != null && !inEnum(ref.correlationFamily, CORRELATION_FAMILY)) {
    errors.push({ field: `${field}.correlationFamily`, code: 'invalid_correlation_family' });
  }
  if (ref.freshness != null && !inEnum(ref.freshness, FRESHNESS_STATUS) && !isUnavailableRepresentation(ref.freshness)) {
    if (typeof ref.freshness === 'object' && !Array.isArray(ref.freshness) && ref.freshness.status != null) {
      if (!inEnum(ref.freshness.status, FRESHNESS_STATUS)) {
        errors.push({ field: `${field}.freshness`, code: 'invalid_freshness_status' });
      }
    } else {
      errors.push({ field: `${field}.freshness`, code: 'invalid_freshness_status' });
    }
  }
  if (ref.availability != null && !inEnum(ref.availability, AVAILABILITY)) {
    errors.push({ field: `${field}.availability`, code: 'invalid_availability' });
  }
  if (ref.admissionState != null && !inEnum(ref.admissionState, EVIDENCE_ADMISSION_STATE)) {
    errors.push({ field: `${field}.admissionState`, code: 'invalid_admission_state' });
  }
  optionalString(`${field}.admissionReason`, ref.admissionReason, errors);
  if (ref.confirmationSemantics != null && !inEnum(ref.confirmationSemantics, CONFIRMATION_SEMANTICS)) {
    errors.push({ field: `${field}.confirmationSemantics`, code: 'invalid_confirmation_semantics' });
  }
  optionalNullableString(`${field}.symbol`, ref.symbol, errors);
  optionalNullableString(`${field}.venue`, ref.venue, errors);
  optionalNullableString(`${field}.timeframe`, ref.timeframe, errors);
  optionalNullableString(`${field}.analysisHorizon`, ref.analysisHorizon, errors);
  if (ref.marketType != null && !inEnum(ref.marketType, MARKET_TYPE)) {
    errors.push({ field: `${field}.marketType`, code: 'invalid_market_type' });
  }
  assertIsoOptional(`${field}.analysisTimestamp`, ref.analysisTimestamp, errors);
}

/**
 * @param {unknown} decision
 * @returns {{ ok: true, bytes: number } | { ok: false, code: string, message: string, errors?: object[], fields?: string[], bytes?: number }}
 */
export function validateArtemisDecision(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    return fail('invalid_decision', 'ArtemisDecision must be a plain object');
  }

  const forbiddenPresent = Object.keys(decision).filter((key) => FORBIDDEN_TOP_LEVEL.has(key));
  if (forbiddenPresent.length) {
    return fail('forbidden_legacy_or_execution_field', 'Legacy/execution-like fields are rejected', {
      fields: forbiddenPresent,
    });
  }

  const unknown = Object.keys(decision).filter((key) => !ALLOWED_TOP_LEVEL.has(key));
  if (unknown.length) {
    return fail('unknown_field', 'Unknown top-level fields are rejected', { fields: unknown });
  }

  const errors = [];

  if (decision.schemaVersion !== DECISION_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'bad_schema_version', expected: DECISION_SCHEMA_VERSION });
  }
  if (decision.contractVersion !== DECISION_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'bad_contract_version', expected: DECISION_CONTRACT_VERSION });
  }

  validateIdentifier('decisionId', decision.decisionId, errors, { required: true });
  validateIdentifier('decisionContextId', decision.decisionContextId, errors, { required: true });

  optionalNullableString('symbol', decision.symbol, errors);
  optionalNullableString('baseAsset', decision.baseAsset, errors);
  optionalNullableString('quoteAsset', decision.quoteAsset, errors);
  optionalNullableString('venue', decision.venue, errors);
  optionalNullableString('timeframe', decision.timeframe, errors);
  optionalNullableString('analysisHorizon', decision.analysisHorizon, errors);
  optionalString('policyVersion', decision.policyVersion, errors);
  optionalString('implementationVersion', decision.implementationVersion, errors);

  if (decision.marketType != null && !inEnum(decision.marketType, MARKET_TYPE)) {
    errors.push({ field: 'marketType', code: 'invalid_market_type' });
  }

  assertIsoRequired('createdAt', decision.createdAt, errors);
  assertIsoRequired('analysisAt', decision.analysisAt, errors);
  assertIsoOptional('expiresAt', decision.expiresAt, errors);
  validateSourceWindow(decision.sourceWindow, errors);

  if (isIsoTimestamp(decision.createdAt) && isIsoTimestamp(decision.analysisAt)) {
    // analysisAt may precede createdAt; reject only clearly inverted expiry
  }
  if (isIsoTimestamp(decision.analysisAt) && isIsoTimestamp(decision.expiresAt)) {
    if (Date.parse(decision.expiresAt) < Date.parse(decision.analysisAt)) {
      errors.push({ field: 'expiresAt', code: 'invalid_time_ordering' });
    }
  }

  if (!Array.isArray(decision.evidenceRefs)) {
    errors.push({ field: 'evidenceRefs', code: 'evidence_refs_required' });
  } else {
    if (decision.evidenceRefs.length > MAX_EVIDENCE_REFS) {
      errors.push({ field: 'evidenceRefs', code: 'evidence_refs_too_many', max: MAX_EVIDENCE_REFS });
    }
    decision.evidenceRefs.forEach((ref, index) => validateEvidenceRef(ref, index, errors));
  }

  if (!inEnum(decision.synthesisOutcome, SYNTHESIS_OUTCOME)) {
    errors.push({ field: 'synthesisOutcome', code: 'invalid_synthesis_outcome' });
  }
  if (!inEnum(decision.direction, DIRECTION_OR_ABSTAIN)) {
    errors.push({ field: 'direction', code: 'invalid_direction' });
  }
  if (!inEnum(decision.conflictState, CONFLICT_STATE)) {
    errors.push({ field: 'conflictState', code: 'invalid_conflict_state' });
  }
  if (!inEnum(decision.riskStatus, RISK_STATUS)) {
    errors.push({ field: 'riskStatus', code: 'invalid_risk_status' });
  }
  if (!inEnum(decision.liquidityStatus, LIQUIDITY_STATUS)) {
    errors.push({ field: 'liquidityStatus', code: 'invalid_liquidity_status' });
  }
  if (!inEnum(decision.classification, CLASSIFICATION)) {
    errors.push({ field: 'classification', code: 'invalid_classification' });
  }
  if (!inEnum(decision.maturityStage, MATURITY_STAGE)) {
    errors.push({ field: 'maturityStage', code: 'invalid_maturity_stage' });
  }

  if (!Array.isArray(decision.limitations) || decision.limitations.some((item) => typeof item !== 'string')) {
    errors.push({ field: 'limitations', code: 'limitations_required' });
  } else if (decision.limitations.length > MAX_LIMITATIONS) {
    errors.push({ field: 'limitations', code: 'limitations_too_many', max: MAX_LIMITATIONS });
  }

  validateConfidence(decision.confidence, errors);
  validateAllocationProposal(decision.allocationProposal, errors);
  validateRuntimeStatus(decision.runtimeStatus, errors);

  if (decision.decisionEligible !== false) {
    errors.push({ field: 'decisionEligible', code: 'decision_eligible_must_be_false' });
  }
  if (decision.executionEligible !== false) {
    errors.push({ field: 'executionEligible', code: 'execution_eligible_must_be_false' });
  }

  const secretKeys = collectForbiddenSecretKeys(decision);
  if (secretKeys.length) {
    errors.push({ field: 'decision', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  const bytes = utf8ByteLength(decision);
  if (bytes > MAX_DECISION_UTF8_BYTES) {
    errors.push({ field: 'decision', code: 'decision_too_large', bytes, limit: MAX_DECISION_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'ArtemisDecision failed strict validation', { errors, bytes });
  }
  return { ok: true, bytes };
}

/**
 * Build a C.1-safe minimal skeleton (still requires caller-supplied ids/timestamps).
 * Always non-decision-eligible / non-execution-eligible.
 */
export function buildContractOnlyArtemisDecision(partial = {}) {
  return {
    schemaVersion: DECISION_SCHEMA_VERSION,
    contractVersion: DECISION_CONTRACT_VERSION,
    decisionId: partial.decisionId,
    decisionContextId: partial.decisionContextId,
    symbol: partial.symbol ?? null,
    baseAsset: partial.baseAsset ?? null,
    quoteAsset: partial.quoteAsset ?? null,
    venue: partial.venue ?? null,
    marketType: partial.marketType ?? MARKET_TYPE.UNKNOWN,
    timeframe: partial.timeframe ?? null,
    analysisHorizon: partial.analysisHorizon ?? null,
    createdAt: partial.createdAt,
    analysisAt: partial.analysisAt,
    expiresAt: partial.expiresAt ?? null,
    sourceWindow: partial.sourceWindow ?? null,
    evidenceRefs: Array.isArray(partial.evidenceRefs) ? partial.evidenceRefs : [],
    synthesisOutcome: partial.synthesisOutcome ?? SYNTHESIS_OUTCOME.UNSPECIFIED,
    direction: partial.direction ?? DIRECTION_OR_ABSTAIN.UNAVAILABLE,
    confidence: partial.confidence ?? {
      availability: 'unavailable',
      kind: CONFIDENCE_KIND.UNAVAILABLE,
      scale: CONFIDENCE_SCALE.UNKNOWN,
      calibrationState: CALIBRATION_STATE.UNAVAILABLE,
      reasonKey: 'wp_c1_no_synthesis_confidence',
      provenance: { writer: 'artemisDecisionContract', methodKey: 'contract_only' },
    },
    conflictState: partial.conflictState ?? CONFLICT_STATE.UNAVAILABLE,
    limitations: Array.isArray(partial.limitations)
      ? partial.limitations
      : ['wp_c1_contract_only', 'no_synthesis', 'decision_eligible_false', 'execution_eligible_false'],
    riskStatus: partial.riskStatus ?? RISK_STATUS.UNAVAILABLE,
    allocationProposal: partial.allocationProposal ?? {
      availability: ALLOCATION_AVAILABILITY.UNAVAILABLE,
      reasonKey: 'wp_c1_portfolio_not_integrated',
    },
    liquidityStatus: partial.liquidityStatus ?? LIQUIDITY_STATUS.UNAVAILABLE,
    runtimeStatus: partial.runtimeStatus ?? {
      availability: AVAILABILITY.UNAVAILABLE,
      reasonKey: 'wp_c1_runtime_not_integrated',
    },
    classification: CLASSIFICATION.CONTRACT_ONLY,
    maturityStage: MATURITY_STAGE.CONTRACT_ONLY,
    decisionEligible: false,
    executionEligible: false,
    policyVersion: partial.policyVersion ?? 'wp-c1-1.0.0',
    implementationVersion: partial.implementationVersion ?? 'wp-c1-1.0.0',
  };
}

export default {
  DECISION_SCHEMA_VERSION,
  DECISION_CONTRACT_VERSION,
  validateArtemisDecision,
  buildContractOnlyArtemisDecision,
  MATURITY_STAGE,
  CLASSIFICATION,
  SYNTHESIS_OUTCOME,
  DIRECTION_OR_ABSTAIN,
  CONFLICT_STATE,
  RISK_STATUS,
  LIQUIDITY_STATUS,
  ALLOCATION_AVAILABILITY,
  EVIDENCE_ADMISSION_STATE,
  CONFIRMATION_SEMANTICS,
};
