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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function hasExactKeys(value) {
  const keys = Object.keys(value);
  if (keys.length !== CASE_KEYS.length) {
    return false;
  }
  for (let i = 0; i < CASE_KEYS.length; i += 1) {
    if (keys[i] !== CASE_KEYS[i]) {
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
 * Structural + field validation. Returns INVALID_RECOVERY_CASE or null when valid.
 */
function classifyInvalid(recoveryCase) {
  if (!isPlainObject(recoveryCase) || !hasExactKeys(recoveryCase)) {
    return RECOVERY_DECISIONS.INVALID_RECOVERY_CASE;
  }
  for (const key of STRING_KEYS) {
    if (!isNonEmptyString(recoveryCase[key])) {
      return RECOVERY_DECISIONS.INVALID_RECOVERY_CASE;
    }
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof recoveryCase[key] !== 'boolean') {
      return RECOVERY_DECISIONS.INVALID_RECOVERY_CASE;
    }
  }
  return null;
}

function invalidResult() {
  return freezeDeep({
    valid: false,
    decision: RECOVERY_DECISIONS.INVALID_RECOVERY_CASE,
    reasons: [RECOVERY_DECISIONS.INVALID_RECOVERY_CASE],
    recoveryCase: null,
  });
}

function validResult(decision, reasons, recoveryCase) {
  return freezeDeep({
    valid: true,
    decision,
    reasons,
    recoveryCase,
  });
}

/**
 * Return a frozen exact-order copy. Does not validate.
 * Preserves exact opaque string and boolean values (no normalization).
 */
export function canonicalizeRecoveryCase(recoveryCase) {
  return copyRecoveryCase(recoveryCase);
}

/**
 * Validate and classify one recovery case.
 * Invalid structure/fields → INVALID_RECOVERY_CASE.
 * Any protected-boundary flag true → OWNER_REVIEW_REQUIRED.
 * All six flags false → RECOVERY_PROPOSABLE.
 */
export function validateRecoveryCase(recoveryCase) {
  if (classifyInvalid(recoveryCase) !== null) {
    return invalidResult();
  }
  const canonical = canonicalizeRecoveryCase(recoveryCase);
  const reasons = collectOwnerReviewReasons(canonical);
  if (reasons.length > 0) {
    return validResult(RECOVERY_DECISIONS.OWNER_REVIEW_REQUIRED, reasons, canonical);
  }
  return validResult(RECOVERY_DECISIONS.RECOVERY_PROPOSABLE, [], canonical);
}

/**
 * Deterministically evaluate one recovery case.
 * Same classification contract as validateRecoveryCase (OD-F / OD-N).
 * RECOVERY_PROPOSABLE is proposal-only and does not authorize execution.
 */
export function evaluateRecovery(recoveryCase) {
  return validateRecoveryCase(recoveryCase);
}
