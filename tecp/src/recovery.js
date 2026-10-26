/**
 * TECP-015 Recovery — pure in-memory recovery assessment value model.
 *
 * Validates, canonicalizes, and deterministically classifies one recovery case.
 * Proposal-only. Does not authorize, execute, retry, replay, resume, requeue,
 * mutate tasks/leases, observe runtime, persist, or emit audit events.
 */

export const RECOVERY_DECISIONS = Object.freeze({
  RECOVERY_PROPOSABLE: 'RECOVERY_PROPOSABLE',
  OWNER_REVIEW_REQUIRED: 'OWNER_REVIEW_REQUIRED',
  INVALID_RECOVERY_CASE: 'INVALID_RECOVERY_CASE',
});

const CASE_KEYS = Object.freeze([
  'recoveryCaseId',
  'taskId',
  'actorId',
  'governanceRevision',
  'failureType',
  'requiresTaskMutation',
  'requiresLeaseMutation',
  'requiresRuntimeObservation',
  'requiresExternalSideEffect',
  'requiresScopeExpansion',
  'requiresConflictOverride',
]);

const STRING_KEYS = Object.freeze([
  'recoveryCaseId',
  'taskId',
  'actorId',
  'governanceRevision',
  'failureType',
]);

const BOOLEAN_KEYS = Object.freeze([
  'requiresTaskMutation',
  'requiresLeaseMutation',
  'requiresRuntimeObservation',
  'requiresExternalSideEffect',
  'requiresScopeExpansion',
  'requiresConflictOverride',
]);

/** Private ordered reason tokens for OWNER_REVIEW_REQUIRED (OD-N / exact order). */
const FLAG_REASON_TOKENS = Object.freeze([
  Object.freeze({ key: 'requiresTaskMutation', reason: 'TASK_MUTATION_REQUIRED' }),
  Object.freeze({ key: 'requiresLeaseMutation', reason: 'LEASE_MUTATION_REQUIRED' }),
  Object.freeze({ key: 'requiresRuntimeObservation', reason: 'RUNTIME_OBSERVATION_REQUIRED' }),
  Object.freeze({ key: 'requiresExternalSideEffect', reason: 'EXTERNAL_SIDE_EFFECT_REQUIRED' }),
  Object.freeze({ key: 'requiresScopeExpansion', reason: 'SCOPE_EXPANSION_REQUIRED' }),
  Object.freeze({ key: 'requiresConflictOverride', reason: 'CONFLICT_OVERRIDE_REQUIRED' }),
]);

/** Private validation reason for structurally/field-invalid recovery cases. */
const INVALID_REASON = 'INVALID_RECOVERY_CASE';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Exact key-set membership only. Input property insertion order must not matter.
 */
function hasExactKeys(value) {
  const keys = Object.keys(value);
  if (keys.length !== CASE_KEYS.length) {
    return false;
  }
  for (const key of CASE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      return false;
    }
  }
  return true;
}

function freezeDeep(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) {
    freezeDeep(nested);
  }
  return Object.freeze(value);
}

function copyRecoveryCase(recoveryCase) {
  return Object.freeze({
    recoveryCaseId: recoveryCase.recoveryCaseId,
    taskId: recoveryCase.taskId,
    actorId: recoveryCase.actorId,
    governanceRevision: recoveryCase.governanceRevision,
    failureType: recoveryCase.failureType,
    requiresTaskMutation: recoveryCase.requiresTaskMutation,
    requiresLeaseMutation: recoveryCase.requiresLeaseMutation,
    requiresRuntimeObservation: recoveryCase.requiresRuntimeObservation,
    requiresExternalSideEffect: recoveryCase.requiresExternalSideEffect,
    requiresScopeExpansion: recoveryCase.requiresScopeExpansion,
    requiresConflictOverride: recoveryCase.requiresConflictOverride,
  });
}

function collectOwnerReviewReasons(recoveryCase) {
  const reasons = [];
  for (const entry of FLAG_REASON_TOKENS) {
    if (recoveryCase[entry.key] === true) {
      reasons.push(entry.reason);
    }
  }
  return reasons;
}

/**
 * Structural + field validation. Returns true when valid, false when invalid.
 * Does not classify protected-boundary flags.
 */
function isStructurallyValid(recoveryCase) {
  if (!isPlainObject(recoveryCase) || !hasExactKeys(recoveryCase)) {
    return false;
  }
  for (const key of STRING_KEYS) {
    if (!isNonEmptyString(recoveryCase[key])) {
      return false;
    }
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof recoveryCase[key] !== 'boolean') {
      return false;
    }
  }
  return true;
}

/**
 * Return a frozen exact-order copy. Does not validate.
 * Preserves exact opaque string and boolean values (no normalization).
 */
export function canonicalizeRecoveryCase(recoveryCase) {
  return copyRecoveryCase(recoveryCase);
}

/**
 * Validate one recovery case. Does not return a public decision and does not
 * classify protected-boundary flags.
 *
 * Valid:   { valid: true, reasons: [], recoveryCase: canonical frozen copy }
 * Invalid: { valid: false, reasons: [private validation reason], recoveryCase: null }
 */
export function validateRecoveryCase(recoveryCase) {
  if (!isStructurallyValid(recoveryCase)) {
    return freezeDeep({
      valid: false,
      reasons: [INVALID_REASON],
      recoveryCase: null,
    });
  }
  return freezeDeep({
    valid: true,
    reasons: [],
    recoveryCase: canonicalizeRecoveryCase(recoveryCase),
  });
}

/**
 * Deterministically evaluate one recovery case.
 * Invalid input => INVALID_RECOVERY_CASE.
 * Any protected-boundary flag true => OWNER_REVIEW_REQUIRED.
 * All six flags false => RECOVERY_PROPOSABLE (proposal-only; does not authorize execution).
 *
 * Returns: { valid, decision, reasons, recoveryCase }
 */
export function evaluateRecovery(recoveryCase) {
  if (!isStructurallyValid(recoveryCase)) {
    return freezeDeep({
      valid: false,
      decision: RECOVERY_DECISIONS.INVALID_RECOVERY_CASE,
      reasons: [RECOVERY_DECISIONS.INVALID_RECOVERY_CASE],
      recoveryCase: null,
    });
  }
  const canonical = canonicalizeRecoveryCase(recoveryCase);
  const reasons = collectOwnerReviewReasons(canonical);
  if (reasons.length > 0) {
    return freezeDeep({
      valid: true,
      decision: RECOVERY_DECISIONS.OWNER_REVIEW_REQUIRED,
      reasons,
      recoveryCase: canonical,
    });
  }
  return freezeDeep({
    valid: true,
    decision: RECOVERY_DECISIONS.RECOVERY_PROPOSABLE,
    reasons: [],
    recoveryCase: canonical,
  });
}
