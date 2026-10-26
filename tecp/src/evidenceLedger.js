/**
 * Pure in-memory TECP evidence fact value model.
 * Validates and canonicalizes one evidence fact. No persistence or emission.
 */

export const EVIDENCE_VALIDATION_DECISIONS = Object.freeze({
  VALID: 'VALID',
  INVALID_EVIDENCE: 'INVALID_EVIDENCE',
  INVALID_EVIDENCE_ID: 'INVALID_EVIDENCE_ID',
  INVALID_TASK_REFERENCE: 'INVALID_TASK_REFERENCE',
  INVALID_ACTOR_REFERENCE: 'INVALID_ACTOR_REFERENCE',
  INVALID_GOVERNANCE_REVISION: 'INVALID_GOVERNANCE_REVISION',
  INVALID_EVIDENCE_TYPE: 'INVALID_EVIDENCE_TYPE',
  INVALID_EVIDENCE_REF: 'INVALID_EVIDENCE_REF',
});

const EVIDENCE_KEYS = Object.freeze([
  'evidenceId',
  'taskId',
  'actorId',
  'governanceRevision',
  'evidenceType',
  'evidenceRef',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  }
  return true;
}

function freezeDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
}

function classifyEvidence(evidence) {
  if (!isPlainObject(evidence) || !hasExactKeys(evidence, EVIDENCE_KEYS)) {
    return EVIDENCE_VALIDATION_DECISIONS.INVALID_EVIDENCE;
  }
  if (!isNonEmptyString(evidence.evidenceId)) {
    return EVIDENCE_VALIDATION_DECISIONS.INVALID_EVIDENCE_ID;
  }
  if (!isNonEmptyString(evidence.taskId)) {
    return EVIDENCE_VALIDATION_DECISIONS.INVALID_TASK_REFERENCE;
  }
  if (!isNonEmptyString(evidence.actorId)) {
    return EVIDENCE_VALIDATION_DECISIONS.INVALID_ACTOR_REFERENCE;
  }
  if (!isNonEmptyString(evidence.governanceRevision)) {
    return EVIDENCE_VALIDATION_DECISIONS.INVALID_GOVERNANCE_REVISION;
  }
  if (!isNonEmptyString(evidence.evidenceType)) {
    return EVIDENCE_VALIDATION_DECISIONS.INVALID_EVIDENCE_TYPE;
  }
  if (!isNonEmptyString(evidence.evidenceRef)) {
    return EVIDENCE_VALIDATION_DECISIONS.INVALID_EVIDENCE_REF;
  }
  return EVIDENCE_VALIDATION_DECISIONS.VALID;
}

/**
 * Return a frozen exact-order copy. Does not validate external state.
 * Preserves strings exactly. No normalization. No lookup. No side effects.
 */
export function canonicalizeEvidence(evidence) {
  return Object.freeze({
    evidenceId: evidence.evidenceId,
    taskId: evidence.taskId,
    actorId: evidence.actorId,
    governanceRevision: evidence.governanceRevision,
    evidenceType: evidence.evidenceType,
    evidenceRef: evidence.evidenceRef,
  });
}

function validResult(evidence) {
  return freezeDeep({
    valid: true,
    decision: EVIDENCE_VALIDATION_DECISIONS.VALID,
    reasons: [],
    evidence,
  });
}

function invalidResult(decision) {
  return freezeDeep({
    valid: false,
    decision,
    reasons: [decision],
    evidence: null,
  });
}

export function validateEvidence(evidence) {
  const decision = classifyEvidence(evidence);
  if (decision !== EVIDENCE_VALIDATION_DECISIONS.VALID) {
    return invalidResult(decision);
  }
  return validResult(canonicalizeEvidence(evidence));
}
