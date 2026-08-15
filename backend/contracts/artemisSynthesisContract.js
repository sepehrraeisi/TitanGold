/**
 * Artemis WP-C.2 — qualitative synthesis assessment contract.
 * schemaVersion 1.0.0 / contractVersion artemis-synthesis-1.0.0
 *
 * Pure validation only. No persistence, providers, or execution authorization.
 */

import {
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  AVAILABILITY,
  CALIBRATION_STATE,
  CONFIDENCE_KIND,
  CONFIDENCE_SCALE,
  CORRELATION_FAMILY,
  MARKET_TYPE,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isUnavailableRepresentation,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  CONFLICT_STATE,
  DIRECTION_OR_ABSTAIN,
  EVIDENCE_ADMISSION_STATE,
  SYNTHESIS_OUTCOME,
} from './artemisDecisionContract.js';

export const SYNTHESIS_SCHEMA_VERSION = '1.0.0';
export const SYNTHESIS_CONTRACT_VERSION = 'artemis-synthesis-1.0.0';
export const SYNTHESIS_POLICY_VERSION = 'wp-c2-synthesis-1.0.0';
export const MIN_INDEPENDENT_DIRECTIONAL_FAMILIES = 2;
export const MAX_FAMILY_ASSESSMENTS = 16;
export const MAX_OPPORTUNITY_CONTEXT = 16;
export const MAX_MEMBER_AGENT_IDS = 32;
export const MAX_LIMITATIONS = 64;
export const MAX_SUMMARY_REASONS = 64;
export const MAX_SYNTHESIS_UTF8_BYTES = 16 * 1024;
export const MAX_STRING_CHARS = 256;
export const MAX_SYNTHESIS_INPUT_ENVELOPES = 32;

export const FAMILY_QUALITATIVE_STATE = Object.freeze({
  COHERENT_BULLISH: 'coherent_bullish',
  COHERENT_BEARISH: 'coherent_bearish',
  COHERENT_NEUTRAL: 'coherent_neutral',
  MIXED: 'mixed',
  UNAVAILABLE: 'unavailable',
  NON_CONFIRMING: 'non_confirming',
});

/** C.2 may emit only these outcomes; control-stage outcomes are rejected. */
export const C2_SUPPORTED_SYNTHESIS_OUTCOMES = Object.freeze({
  PROPOSED: SYNTHESIS_OUTCOME.PROPOSED,
  HOLD: SYNTHESIS_OUTCOME.HOLD,
  ABSTAIN: SYNTHESIS_OUTCOME.ABSTAIN,
  INSUFFICIENT_EVIDENCE: SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE,
  INCOMPATIBLE_EVIDENCE: SYNTHESIS_OUTCOME.INCOMPATIBLE_EVIDENCE,
});

const QUALIFYING_FAMILY_STATES = new Set([
  FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH,
  FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH,
  FAMILY_QUALITATIVE_STATE.COHERENT_NEUTRAL,
]);

function familyHasConfirmingStructure(fam) {
  if (!fam || !QUALIFYING_FAMILY_STATES.has(fam.qualitativeState)) return false;
  if (!Array.isArray(fam.memberAgentIds) || fam.memberAgentIds.length < 1) return false;
  if (
    typeof fam.admittedDirectionalMemberCount !== 'number'
    || !Number.isInteger(fam.admittedDirectionalMemberCount)
    || fam.admittedDirectionalMemberCount < 1
  ) {
    return false;
  }
  if (fam.admittedDirectionalMemberCount > fam.memberAgentIds.length) return false;
  return true;
}

const ALLOWED_TOP = new Set([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
  'decisionContext',
  'synthesisOutcome',
  'observedDirection',
  'conflictState',
  'independentDirectionalFamilyCount',
  'multiFamilyConfirmation',
  'familyAssessments',
  'opportunityContext',
  'excludedNonConfirmingSummary',
  'limitations',
  'confidence',
  'decisionEligible',
  'executionEligible',
  'artemisConsumable',
]);

const ALLOWED_CONTEXT = new Set([
  'symbol',
  'venue',
  'marketType',
  'timeframe',
  'analysisHorizon',
]);

const ALLOWED_FAMILY = new Set([
  'correlationFamily',
  'memberAgentIds',
  'admittedDirectionalMemberCount',
  'degradedMemberCount',
  'nonConfirmingMemberCount',
  'qualitativeState',
  'familyDirection',
  'conflictState',
  'limitations',
]);

const ALLOWED_OPPORTUNITY = new Set([
  'agentId',
  'runId',
  'correlationFamily',
  'admissionState',
  'admissionReason',
  'availability',
]);

const ALLOWED_SUMMARY = new Set([
  'excludedCount',
  'rejectedCount',
  'nonConfirmingCount',
  'degradedCount',
  'reasons',
]);

const ALLOWED_CONFIDENCE = new Set([
  'availability',
  'kind',
  'scale',
  'calibrationState',
  'reasonKey',
  'provenance',
]);

const ALLOWED_PROVENANCE = new Set([
  'writer',
  'path',
  'methodKey',
]);

const FORBIDDEN_TOP = new Set([
  'approved',
  'approvedForExecution',
  'action',
  'weights',
  'score',
  'numericConfidence',
  'correlationCoefficient',
  'rawEvidence',
  'providerPayload',
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function inEnum(value, enumObj) {
  return Object.values(enumObj).includes(value);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownFields(obj, allowed, field, errors) {
  for (const key of Object.keys(obj || {})) {
    if (!allowed.has(key)) errors.push({ field: `${field}.${key}`, code: 'unknown_field' });
  }
}

function requireBoundedString(field, value, errors, { required = true, max = MAX_STRING_CHARS } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required_string' });
    return;
  }
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    errors.push({ field, code: 'invalid_string' });
  }
}

function optionalNullableBoundedString(field, value, errors, { max = MAX_STRING_CHARS } = {}) {
  if (value == null) return;
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    errors.push({ field, code: 'invalid_string' });
  }
}

function validateStringArray(field, value, errors, { required = true, maxItems = MAX_LIMITATIONS } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required_array' });
    return;
  }
  if (!Array.isArray(value)) {
    errors.push({ field, code: 'invalid_array' });
    return;
  }
  if (value.length > maxItems) {
    errors.push({ field, code: 'too_many' });
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.length === 0 || item.length > MAX_STRING_CHARS) {
      errors.push({ field: `${field}[${index}]`, code: 'invalid_string' });
    }
  });
}

function validateNonNegInt(field, value, errors, { max = MAX_FAMILY_ASSESSMENTS } = {}) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    errors.push({ field, code: 'invalid_count' });
  }
}

function validateIdentifier(field, value, errors, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required_identifier' });
    return;
  }
  if (isUnavailableRepresentation(value)) {
    if (typeof value === 'object') {
      rejectUnknownFields(value, new Set(['availability', 'reasonKey']), field, errors);
    }
    return;
  }
  if (!isCanonicalUuid(value)) {
    errors.push({ field, code: 'invalid_uuid_identifier' });
  }
}

export function buildUnavailableSynthesisConfidence(reasonKey = 'qualitative_synthesis_not_calibrated') {
  return {
    availability: AVAILABILITY.UNAVAILABLE,
    kind: CONFIDENCE_KIND.UNAVAILABLE,
    scale: CONFIDENCE_SCALE.UNKNOWN,
    calibrationState: CALIBRATION_STATE.UNAVAILABLE,
    reasonKey,
    provenance: {
      writer: 'artemisDeterministicSynthesisService',
      path: 'deterministic_synthesis',
      methodKey: SYNTHESIS_POLICY_VERSION,
    },
  };
}

export function countDistinctQualifyingFamilies(familyAssessments = []) {
  const seen = new Set();
  for (const fam of familyAssessments) {
    if (!fam || !inEnum(fam.correlationFamily, CORRELATION_FAMILY)) continue;
    if (!familyHasConfirmingStructure(fam)) continue;
    seen.add(fam.correlationFamily);
  }
  return seen.size;
}

/**
 * Validate a family-assessment array for kernel/contract eligibility.
 * Shared by full assessment validation and cross-family kernel gating.
 */
export function validateSynthesisFamilyAssessmentSet(familyAssessments) {
  const errors = [];
  if (!Array.isArray(familyAssessments)) {
    return {
      ok: false,
      code: 'invalid_family_assessment_set',
      message: 'familyAssessments must be an array',
      errors: [{ field: 'familyAssessments', code: 'invalid_array' }],
    };
  }
  if (familyAssessments.length > MAX_FAMILY_ASSESSMENTS) {
    return {
      ok: false,
      code: 'invalid_family_assessment_set',
      message: 'Too many family assessments',
      errors: [{ field: 'familyAssessments', code: 'too_many' }],
    };
  }

  const seenFamilies = new Set();
  familyAssessments.forEach((fam, index) => {
    const field = `familyAssessments[${index}]`;
    if (!isPlainObject(fam)) {
      errors.push({ field, code: 'invalid_family' });
      return;
    }
    rejectUnknownFields(fam, ALLOWED_FAMILY, field, errors);

    if (!inEnum(fam.correlationFamily, CORRELATION_FAMILY)) {
      errors.push({ field: `${field}.correlationFamily`, code: 'correlation_family_required' });
    } else if (seenFamilies.has(fam.correlationFamily)) {
      errors.push({ field: `${field}.correlationFamily`, code: 'duplicate_correlation_family' });
    } else {
      seenFamilies.add(fam.correlationFamily);
    }

    if (!Array.isArray(fam.memberAgentIds)) {
      errors.push({ field: `${field}.memberAgentIds`, code: 'invalid_array' });
    } else if (fam.memberAgentIds.length > MAX_MEMBER_AGENT_IDS) {
      errors.push({ field: `${field}.memberAgentIds`, code: 'too_many' });
    } else {
      const seenAgents = new Set();
      fam.memberAgentIds.forEach((agentId, agentIndex) => {
        const af = `${field}.memberAgentIds[${agentIndex}]`;
        if (typeof agentId !== 'string' || agentId.length === 0 || agentId.length > MAX_STRING_CHARS) {
          errors.push({ field: af, code: 'invalid_string' });
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(AGENT_CONTRACT_ROLE, agentId)) {
          errors.push({ field: af, code: 'unknown_agent_id' });
        } else if (
          AGENT_CONTRACT_ROLE[agentId].authorityClass !== AUTHORITY_CLASS.ANALYTICAL_EVIDENCE
        ) {
          errors.push({ field: af, code: 'non_analytical_family_member' });
        }
        if (seenAgents.has(agentId)) {
          errors.push({ field: af, code: 'duplicate_agent_id' });
        }
        seenAgents.add(agentId);
      });
      const memberCount = fam.memberAgentIds.length;
      for (const countKey of [
        'admittedDirectionalMemberCount',
        'degradedMemberCount',
        'nonConfirmingMemberCount',
      ]) {
        validateNonNegInt(`${field}.${countKey}`, fam[countKey], errors, { max: MAX_MEMBER_AGENT_IDS });
        if (typeof fam[countKey] === 'number' && fam[countKey] > memberCount) {
          errors.push({ field: `${field}.${countKey}`, code: 'count_exceeds_members' });
        }
      }
    }

    if (!inEnum(fam.qualitativeState, FAMILY_QUALITATIVE_STATE)) {
      errors.push({ field: `${field}.qualitativeState`, code: 'invalid_qualitative_state' });
    }
    if (!inEnum(fam.familyDirection, DIRECTION_OR_ABSTAIN)) {
      errors.push({ field: `${field}.familyDirection`, code: 'invalid_family_direction' });
    }
    if (!inEnum(fam.conflictState, CONFLICT_STATE)) {
      errors.push({ field: `${field}.conflictState`, code: 'invalid_conflict_state' });
    }
    validateStringArray(`${field}.limitations`, fam.limitations, errors, { required: true });
    validateFamilyConsistency(fam, field, errors);
  });

  if (errors.length) {
    return {
      ok: false,
      code: 'invalid_family_assessment_set',
      message: 'Family assessment set failed structural validation',
      errors,
    };
  }
  return { ok: true };
}

function validateFamilyConsistency(fam, field, errors) {
  const state = fam.qualitativeState;
  const dir = fam.familyDirection;
  const conflict = fam.conflictState;
  const memberCount = Array.isArray(fam.memberAgentIds) ? fam.memberAgentIds.length : 0;
  const admitted = fam.admittedDirectionalMemberCount;

  if (
    state === FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH
    || state === FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH
    || state === FAMILY_QUALITATIVE_STATE.COHERENT_NEUTRAL
  ) {
    if (memberCount < 1) {
      errors.push({ field: `${field}.memberAgentIds`, code: 'coherent_requires_members' });
    }
    if (typeof admitted !== 'number' || admitted < 1) {
      errors.push({ field: `${field}.admittedDirectionalMemberCount`, code: 'coherent_requires_directional_members' });
    }
  }

  if (
    state === FAMILY_QUALITATIVE_STATE.NON_CONFIRMING
    || state === FAMILY_QUALITATIVE_STATE.UNAVAILABLE
  ) {
    if (admitted !== 0) {
      errors.push({ field: `${field}.admittedDirectionalMemberCount`, code: 'non_confirming_requires_zero_directional' });
    }
  }

  if (state === FAMILY_QUALITATIVE_STATE.MIXED) {
    if (typeof admitted !== 'number' || admitted < 2) {
      errors.push({ field: `${field}.admittedDirectionalMemberCount`, code: 'mixed_requires_min_directional_members' });
    }
  }

  if (state === FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH) {
    if (dir !== DIRECTION_OR_ABSTAIN.BULLISH) {
      errors.push({ field: `${field}.familyDirection`, code: 'family_direction_inconsistent' });
    }
    if (conflict !== CONFLICT_STATE.NONE && conflict !== CONFLICT_STATE.INFORMATIONAL) {
      errors.push({ field: `${field}.conflictState`, code: 'family_conflict_inconsistent' });
    }
  }
  if (state === FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH) {
    if (dir !== DIRECTION_OR_ABSTAIN.BEARISH) {
      errors.push({ field: `${field}.familyDirection`, code: 'family_direction_inconsistent' });
    }
    if (conflict !== CONFLICT_STATE.NONE && conflict !== CONFLICT_STATE.INFORMATIONAL) {
      errors.push({ field: `${field}.conflictState`, code: 'family_conflict_inconsistent' });
    }
  }
  if (state === FAMILY_QUALITATIVE_STATE.COHERENT_NEUTRAL) {
    if (dir !== DIRECTION_OR_ABSTAIN.NEUTRAL && dir !== DIRECTION_OR_ABSTAIN.SIDEWAYS) {
      errors.push({ field: `${field}.familyDirection`, code: 'family_direction_inconsistent' });
    }
  }
  if (state === FAMILY_QUALITATIVE_STATE.MIXED) {
    if (dir !== DIRECTION_OR_ABSTAIN.ABSTAIN) {
      errors.push({ field: `${field}.familyDirection`, code: 'family_direction_inconsistent' });
    }
    if (conflict !== CONFLICT_STATE.MATERIAL && conflict !== CONFLICT_STATE.BLOCKING) {
      errors.push({ field: `${field}.conflictState`, code: 'family_conflict_inconsistent' });
    }
  }
  if (
    (state === FAMILY_QUALITATIVE_STATE.NON_CONFIRMING || state === FAMILY_QUALITATIVE_STATE.UNAVAILABLE)
    && (dir === DIRECTION_OR_ABSTAIN.BULLISH || dir === DIRECTION_OR_ABSTAIN.BEARISH)
  ) {
    errors.push({ field: `${field}.familyDirection`, code: 'non_confirming_actionable_forbidden' });
  }
}

function validateOutcomeInvariants(assessment, errors) {
  const outcome = assessment.synthesisOutcome;
  const direction = assessment.observedDirection;
  const conflict = assessment.conflictState;
  const multi = assessment.multiFamilyConfirmation;
  const count = assessment.independentDirectionalFamilyCount;

  if (outcome === SYNTHESIS_OUTCOME.PROPOSED) {
    if (direction !== DIRECTION_OR_ABSTAIN.BULLISH && direction !== DIRECTION_OR_ABSTAIN.BEARISH) {
      errors.push({ field: 'observedDirection', code: 'proposed_direction_invalid' });
    }
    if (multi !== true) errors.push({ field: 'multiFamilyConfirmation', code: 'proposed_requires_multi_family' });
    if (typeof count !== 'number' || count < MIN_INDEPENDENT_DIRECTIONAL_FAMILIES) {
      errors.push({ field: 'independentDirectionalFamilyCount', code: 'proposed_requires_min_families' });
    }
    if (conflict === CONFLICT_STATE.MATERIAL || conflict === CONFLICT_STATE.BLOCKING) {
      errors.push({ field: 'conflictState', code: 'proposed_conflict_forbidden' });
    }
  }

  if (
    outcome === SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE
    || outcome === SYNTHESIS_OUTCOME.INCOMPATIBLE_EVIDENCE
    || outcome === SYNTHESIS_OUTCOME.ABSTAIN
  ) {
    if (direction !== DIRECTION_OR_ABSTAIN.ABSTAIN) {
      errors.push({ field: 'observedDirection', code: 'abstain_direction_required' });
    }
    if (multi !== false) {
      errors.push({ field: 'multiFamilyConfirmation', code: 'must_be_false' });
    }
  }

  if (outcome === SYNTHESIS_OUTCOME.HOLD) {
    if (direction !== DIRECTION_OR_ABSTAIN.NEUTRAL && direction !== DIRECTION_OR_ABSTAIN.SIDEWAYS) {
      errors.push({ field: 'observedDirection', code: 'hold_direction_invalid' });
    }
    if (multi !== false) {
      errors.push({ field: 'multiFamilyConfirmation', code: 'must_be_false' });
    }
  }
}

/**
 * @param {unknown} assessment
 * @returns {{ ok: true, bytes: number } | { ok: false, code: string, message: string, errors?: object[], bytes?: number }}
 */
export function validateArtemisSynthesisAssessment(assessment) {
  if (!isPlainObject(assessment)) {
    return fail('invalid_assessment', 'Synthesis assessment must be a plain object');
  }

  const forbidden = Object.keys(assessment).filter((k) => FORBIDDEN_TOP.has(k));
  if (forbidden.length) {
    return fail('forbidden_execution_or_scoring_field', 'Forbidden synthesis fields present', {
      fields: forbidden,
    });
  }

  const errors = [];
  rejectUnknownFields(assessment, ALLOWED_TOP, 'assessment', errors);

  const secretHits = collectForbiddenSecretKeys(assessment);
  if (secretHits.length) {
    return fail('secret_like_field', 'Secret-like keys are forbidden', { fields: secretHits });
  }

  if (assessment.schemaVersion !== SYNTHESIS_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'unsupported_schema_version' });
  }
  if (assessment.contractVersion !== SYNTHESIS_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'unsupported_contract_version' });
  }
  if (assessment.policyVersion !== SYNTHESIS_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', code: 'unsupported_policy_version' });
  }
  requireBoundedString('implementationVersion', assessment.implementationVersion, errors);

  if (!isPlainObject(assessment.decisionContext)) {
    errors.push({ field: 'decisionContext', code: 'required_object' });
  } else {
    const ctx = assessment.decisionContext;
    rejectUnknownFields(ctx, ALLOWED_CONTEXT, 'decisionContext', errors);
    for (const key of Object.keys(ctx)) {
      if (typeof ctx[key] === 'object' && ctx[key] !== null) {
        errors.push({ field: `decisionContext.${key}`, code: 'nested_object_forbidden' });
      }
    }
    optionalNullableBoundedString('decisionContext.symbol', ctx.symbol, errors);
    optionalNullableBoundedString('decisionContext.venue', ctx.venue, errors);
    optionalNullableBoundedString('decisionContext.timeframe', ctx.timeframe, errors);
    optionalNullableBoundedString('decisionContext.analysisHorizon', ctx.analysisHorizon, errors);
    if (ctx.marketType != null && !inEnum(ctx.marketType, MARKET_TYPE)) {
      errors.push({ field: 'decisionContext.marketType', code: 'invalid_market_type' });
    }
  }

  if (!inEnum(assessment.synthesisOutcome, C2_SUPPORTED_SYNTHESIS_OUTCOMES)) {
    errors.push({ field: 'synthesisOutcome', code: 'unsupported_c2_synthesis_outcome' });
  }
  if (!inEnum(assessment.observedDirection, DIRECTION_OR_ABSTAIN)) {
    errors.push({ field: 'observedDirection', code: 'invalid_direction' });
  }
  if (!inEnum(assessment.conflictState, CONFLICT_STATE)) {
    errors.push({ field: 'conflictState', code: 'invalid_conflict_state' });
  }

  validateNonNegInt(
    'independentDirectionalFamilyCount',
    assessment.independentDirectionalFamilyCount,
    errors,
    { max: MAX_FAMILY_ASSESSMENTS },
  );
  if (typeof assessment.multiFamilyConfirmation !== 'boolean') {
    errors.push({ field: 'multiFamilyConfirmation', code: 'invalid_boolean' });
  }
  if (assessment.decisionEligible !== false) {
    errors.push({ field: 'decisionEligible', code: 'must_be_false' });
  }
  if (assessment.executionEligible !== false) {
    errors.push({ field: 'executionEligible', code: 'must_be_false' });
  }
  if (assessment.artemisConsumable !== false) {
    errors.push({ field: 'artemisConsumable', code: 'must_be_false' });
  }

  if (!Array.isArray(assessment.familyAssessments)) {
    errors.push({ field: 'familyAssessments', code: 'invalid_array' });
  } else if (assessment.familyAssessments.length > MAX_FAMILY_ASSESSMENTS) {
    errors.push({ field: 'familyAssessments', code: 'too_many' });
  } else {
    const familySetValidation = validateSynthesisFamilyAssessmentSet(assessment.familyAssessments);
    if (!familySetValidation.ok && Array.isArray(familySetValidation.errors)) {
      errors.push(...familySetValidation.errors);
    }
  }

  if (Array.isArray(assessment.familyAssessments)) {
    const expectedCount = countDistinctQualifyingFamilies(assessment.familyAssessments);
    if (
      typeof assessment.independentDirectionalFamilyCount === 'number'
      && assessment.independentDirectionalFamilyCount !== expectedCount
    ) {
      errors.push({
        field: 'independentDirectionalFamilyCount',
        code: 'family_count_inconsistent',
        expected: expectedCount,
      });
    }
  }

  if (!Array.isArray(assessment.opportunityContext)) {
    errors.push({ field: 'opportunityContext', code: 'invalid_array' });
  } else if (assessment.opportunityContext.length > MAX_OPPORTUNITY_CONTEXT) {
    errors.push({ field: 'opportunityContext', code: 'too_many' });
  } else {
    assessment.opportunityContext.forEach((row, index) => {
      const field = `opportunityContext[${index}]`;
      if (!isPlainObject(row)) {
        errors.push({ field, code: 'invalid_opportunity' });
        return;
      }
      rejectUnknownFields(row, ALLOWED_OPPORTUNITY, field, errors);
      requireBoundedString(`${field}.agentId`, row.agentId, errors);
      if (
        row.agentId
        && Object.prototype.hasOwnProperty.call(AGENT_CONTRACT_ROLE, row.agentId)
        && AGENT_CONTRACT_ROLE[row.agentId].authorityClass !== AUTHORITY_CLASS.OPPORTUNITY_FORECAST
      ) {
        errors.push({ field: `${field}.agentId`, code: 'opportunity_role_required' });
      }
      if (
        row.agentId
        && !Object.prototype.hasOwnProperty.call(AGENT_CONTRACT_ROLE, row.agentId)
      ) {
        errors.push({ field: `${field}.agentId`, code: 'unknown_agent_id' });
      }
      validateIdentifier(`${field}.runId`, row.runId, errors, { required: false });
      if (row.correlationFamily != null && !inEnum(row.correlationFamily, CORRELATION_FAMILY)) {
        errors.push({ field: `${field}.correlationFamily`, code: 'invalid_correlation_family' });
      }
      if (!inEnum(row.admissionState, EVIDENCE_ADMISSION_STATE)) {
        errors.push({ field: `${field}.admissionState`, code: 'invalid_admission_state' });
      }
      optionalNullableBoundedString(`${field}.admissionReason`, row.admissionReason, errors);
      if (!inEnum(row.availability, AVAILABILITY)) {
        errors.push({ field: `${field}.availability`, code: 'invalid_availability' });
      }
    });
  }

  if (!isPlainObject(assessment.excludedNonConfirmingSummary)) {
    errors.push({ field: 'excludedNonConfirmingSummary', code: 'required_object' });
  } else {
    const summary = assessment.excludedNonConfirmingSummary;
    rejectUnknownFields(summary, ALLOWED_SUMMARY, 'excludedNonConfirmingSummary', errors);
    for (const key of ['excludedCount', 'rejectedCount', 'nonConfirmingCount', 'degradedCount']) {
      validateNonNegInt(`excludedNonConfirmingSummary.${key}`, summary[key], errors, {
        max: 10_000,
      });
    }
    validateStringArray('excludedNonConfirmingSummary.reasons', summary.reasons, errors, {
      required: true,
      maxItems: MAX_SUMMARY_REASONS,
    });
  }

  validateStringArray('limitations', assessment.limitations, errors, { required: true });

  if (!isPlainObject(assessment.confidence)) {
    errors.push({ field: 'confidence', code: 'required_object' });
  } else {
    const conf = assessment.confidence;
    rejectUnknownFields(conf, ALLOWED_CONFIDENCE, 'confidence', errors);
    if (Object.prototype.hasOwnProperty.call(conf, 'value')) {
      errors.push({ field: 'confidence.value', code: 'numeric_confidence_forbidden' });
    }
    if (conf.availability !== AVAILABILITY.UNAVAILABLE) {
      errors.push({ field: 'confidence.availability', code: 'must_be_unavailable' });
    }
    if (conf.kind !== CONFIDENCE_KIND.UNAVAILABLE) {
      errors.push({ field: 'confidence.kind', code: 'must_be_unavailable' });
    }
    if (conf.scale !== CONFIDENCE_SCALE.UNKNOWN) {
      errors.push({ field: 'confidence.scale', code: 'must_be_unknown' });
    }
    if (conf.calibrationState !== CALIBRATION_STATE.UNAVAILABLE) {
      errors.push({ field: 'confidence.calibrationState', code: 'must_be_unavailable' });
    }
    requireBoundedString('confidence.reasonKey', conf.reasonKey, errors);
    if (!isPlainObject(conf.provenance)) {
      errors.push({ field: 'confidence.provenance', code: 'required_object' });
    } else {
      rejectUnknownFields(conf.provenance, ALLOWED_PROVENANCE, 'confidence.provenance', errors);
      requireBoundedString('confidence.provenance.writer', conf.provenance.writer, errors);
      requireBoundedString('confidence.provenance.methodKey', conf.provenance.methodKey, errors);
      optionalNullableBoundedString('confidence.provenance.path', conf.provenance.path, errors);
    }
  }

  validateOutcomeInvariants(assessment, errors);

  const bytes = utf8ByteLength(JSON.stringify(assessment));
  if (bytes > MAX_SYNTHESIS_UTF8_BYTES) {
    return fail('payload_too_large', 'Synthesis assessment exceeds UTF-8 byte budget', { bytes });
  }

  if (errors.length) {
    return fail('validation_failed', 'Synthesis assessment failed validation', { errors, bytes });
  }
  return { ok: true, bytes };
}

export default {
  SYNTHESIS_SCHEMA_VERSION,
  SYNTHESIS_CONTRACT_VERSION,
  SYNTHESIS_POLICY_VERSION,
  MIN_INDEPENDENT_DIRECTIONAL_FAMILIES,
  MAX_SYNTHESIS_INPUT_ENVELOPES,
  FAMILY_QUALITATIVE_STATE,
  C2_SUPPORTED_SYNTHESIS_OUTCOMES,
  validateArtemisSynthesisAssessment,
  validateSynthesisFamilyAssessmentSet,
  buildUnavailableSynthesisConfidence,
  countDistinctQualifyingFamilies,
};
