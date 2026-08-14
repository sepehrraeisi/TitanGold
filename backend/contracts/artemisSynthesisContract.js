/**
 * Artemis WP-C.2 — qualitative synthesis assessment contract.
 * schemaVersion 1.0.0 / contractVersion artemis-synthesis-1.0.0
 *
 * Pure validation only. No persistence, providers, or execution authorization.
 */

import {
  AVAILABILITY,
  CALIBRATION_STATE,
  CONFIDENCE_KIND,
  CONFIDENCE_SCALE,
  CORRELATION_FAMILY,
  collectForbiddenSecretKeys,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  CONFLICT_STATE,
  DIRECTION_OR_ABSTAIN,
  SYNTHESIS_OUTCOME,
} from './artemisDecisionContract.js';

export const SYNTHESIS_SCHEMA_VERSION = '1.0.0';
export const SYNTHESIS_CONTRACT_VERSION = 'artemis-synthesis-1.0.0';
export const SYNTHESIS_POLICY_VERSION = 'wp-c2-synthesis-1.0.0';
export const MIN_INDEPENDENT_DIRECTIONAL_FAMILIES = 2;
export const MAX_FAMILY_ASSESSMENTS = 16;
export const MAX_OPPORTUNITY_CONTEXT = 16;
export const MAX_LIMITATIONS = 64;
export const MAX_SYNTHESIS_UTF8_BYTES = 16 * 1024;
export const MAX_STRING_CHARS = 256;

export const FAMILY_QUALITATIVE_STATE = Object.freeze({
  COHERENT_BULLISH: 'coherent_bullish',
  COHERENT_BEARISH: 'coherent_bearish',
  COHERENT_NEUTRAL: 'coherent_neutral',
  MIXED: 'mixed',
  UNAVAILABLE: 'unavailable',
  NON_CONFIRMING: 'non_confirming',
});

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

function optionalString(field, value, errors, max = MAX_STRING_CHARS) {
  if (value == null) return;
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    errors.push({ field, code: 'invalid_string' });
  }
}

function rejectUnknownFields(obj, allowed, field, errors) {
  for (const key of Object.keys(obj || {})) {
    if (!allowed.has(key)) errors.push({ field: `${field}.${key}`, code: 'unknown_field' });
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
      methodKey: SYNTHESIS_POLICY_VERSION,
    },
  };
}

/**
 * @param {unknown} assessment
 * @returns {{ ok: true, bytes: number } | { ok: false, code: string, message: string, errors?: object[], bytes?: number }}
 */
export function validateArtemisSynthesisAssessment(assessment) {
  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
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
  optionalString('implementationVersion', assessment.implementationVersion, errors);

  if (!assessment.decisionContext || typeof assessment.decisionContext !== 'object') {
    errors.push({ field: 'decisionContext', code: 'required' });
  } else {
    rejectUnknownFields(assessment.decisionContext, ALLOWED_CONTEXT, 'decisionContext', errors);
  }

  if (!inEnum(assessment.synthesisOutcome, SYNTHESIS_OUTCOME)) {
    errors.push({ field: 'synthesisOutcome', code: 'invalid_synthesis_outcome' });
  }
  if (!inEnum(assessment.observedDirection, DIRECTION_OR_ABSTAIN)) {
    errors.push({ field: 'observedDirection', code: 'invalid_direction' });
  }
  if (!inEnum(assessment.conflictState, CONFLICT_STATE)) {
    errors.push({ field: 'conflictState', code: 'invalid_conflict_state' });
  }

  if (
    typeof assessment.independentDirectionalFamilyCount !== 'number'
    || !Number.isInteger(assessment.independentDirectionalFamilyCount)
    || assessment.independentDirectionalFamilyCount < 0
    || assessment.independentDirectionalFamilyCount > MAX_FAMILY_ASSESSMENTS
  ) {
    errors.push({ field: 'independentDirectionalFamilyCount', code: 'invalid_count' });
  }
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
    assessment.familyAssessments.forEach((fam, index) => {
      const field = `familyAssessments[${index}]`;
      if (!fam || typeof fam !== 'object' || Array.isArray(fam)) {
        errors.push({ field, code: 'invalid_family' });
        return;
      }
      rejectUnknownFields(fam, ALLOWED_FAMILY, field, errors);
      if (fam.correlationFamily != null && !inEnum(fam.correlationFamily, CORRELATION_FAMILY)) {
        errors.push({ field: `${field}.correlationFamily`, code: 'invalid_correlation_family' });
      }
      if (!Array.isArray(fam.memberAgentIds)) {
        errors.push({ field: `${field}.memberAgentIds`, code: 'invalid_array' });
      }
      if (!inEnum(fam.qualitativeState, FAMILY_QUALITATIVE_STATE)) {
        errors.push({ field: `${field}.qualitativeState`, code: 'invalid_qualitative_state' });
      }
      if (fam.familyDirection != null && !inEnum(fam.familyDirection, DIRECTION_OR_ABSTAIN)) {
        errors.push({ field: `${field}.familyDirection`, code: 'invalid_family_direction' });
      }
      if (!inEnum(fam.conflictState, CONFLICT_STATE)) {
        errors.push({ field: `${field}.conflictState`, code: 'invalid_conflict_state' });
      }
      for (const countKey of [
        'admittedDirectionalMemberCount',
        'degradedMemberCount',
        'nonConfirmingMemberCount',
      ]) {
        const n = fam[countKey];
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
          errors.push({ field: `${field}.${countKey}`, code: 'invalid_count' });
        }
      }
      if (Array.isArray(fam.limitations) && fam.limitations.length > MAX_LIMITATIONS) {
        errors.push({ field: `${field}.limitations`, code: 'too_many' });
      }
    });
  }

  if (!Array.isArray(assessment.opportunityContext)) {
    errors.push({ field: 'opportunityContext', code: 'invalid_array' });
  } else if (assessment.opportunityContext.length > MAX_OPPORTUNITY_CONTEXT) {
    errors.push({ field: 'opportunityContext', code: 'too_many' });
  } else {
    assessment.opportunityContext.forEach((row, index) => {
      const field = `opportunityContext[${index}]`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        errors.push({ field, code: 'invalid_opportunity' });
        return;
      }
      rejectUnknownFields(row, ALLOWED_OPPORTUNITY, field, errors);
      optionalString(`${field}.agentId`, row.agentId, errors);
      optionalString(`${field}.runId`, row.runId, errors);
    });
  }

  if (!assessment.excludedNonConfirmingSummary || typeof assessment.excludedNonConfirmingSummary !== 'object') {
    errors.push({ field: 'excludedNonConfirmingSummary', code: 'required' });
  } else {
    rejectUnknownFields(
      assessment.excludedNonConfirmingSummary,
      ALLOWED_SUMMARY,
      'excludedNonConfirmingSummary',
      errors,
    );
  }

  if (!Array.isArray(assessment.limitations)) {
    errors.push({ field: 'limitations', code: 'invalid_array' });
  } else if (assessment.limitations.length > MAX_LIMITATIONS) {
    errors.push({ field: 'limitations', code: 'too_many' });
  }

  if (!assessment.confidence || typeof assessment.confidence !== 'object') {
    errors.push({ field: 'confidence', code: 'required' });
  } else {
    rejectUnknownFields(assessment.confidence, ALLOWED_CONFIDENCE, 'confidence', errors);
    if (assessment.confidence.availability !== AVAILABILITY.UNAVAILABLE) {
      errors.push({ field: 'confidence.availability', code: 'must_be_unavailable' });
    }
    if (typeof assessment.confidence.value === 'number') {
      errors.push({ field: 'confidence.value', code: 'numeric_confidence_forbidden' });
    }
  }

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
  FAMILY_QUALITATIVE_STATE,
  validateArtemisSynthesisAssessment,
  buildUnavailableSynthesisConfidence,
};
