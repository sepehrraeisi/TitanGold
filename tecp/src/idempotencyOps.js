'use strict';

/**
 * TECP-014 Idempotency Ops — pure in-memory operation identity + comparison.
 *
 * Owns identity facts and deterministic comparison only.
 * No lifecycle machine. No clock. No store. No side effects.
 */

const OPERATION_KEYS = Object.freeze([
  'idempotencyKey',
  'taskId',
  'actorId',
  'operationType',
  'governanceRevision',
]);

export const IDEMPOTENCY_OPERATION_DECISIONS = Object.freeze({
  VALID: 'VALID',
  INVALID_OPERATION: 'INVALID_OPERATION',
  INVALID_IDEMPOTENCY_KEY: 'INVALID_IDEMPOTENCY_KEY',
  INVALID_TASK_REFERENCE: 'INVALID_TASK_REFERENCE',
  INVALID_ACTOR_REFERENCE: 'INVALID_ACTOR_REFERENCE',
  INVALID_OPERATION_TYPE: 'INVALID_OPERATION_TYPE',
  INVALID_GOVERNANCE_REVISION: 'INVALID_GOVERNANCE_REVISION',
});

export const IDEMPOTENCY_COMPARISON_DECISIONS = Object.freeze({
  SAME_OPERATION: 'SAME_OPERATION',
  DIFFERENT_OPERATION: 'DIFFERENT_OPERATION',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INVALID_INPUT: 'INVALID_INPUT',
});

const REASON_IDENTITY_MATCH = 'IDENTITY_MATCH';
const REASON_TASK_SCOPE_DIFFERS = 'TASK_SCOPE_DIFFERS';
const REASON_IDEMPOTENCY_KEY_DIFFERS = 'IDEMPOTENCY_KEY_DIFFERS';
const REASON_BINDING_MISMATCH = 'BINDING_MISMATCH';
const REASON_LEFT_INVALID = 'LEFT_INVALID';
const REASON_RIGHT_INVALID = 'RIGHT_INVALID';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function hasExactKeys(value, expectedKeys) {
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== expectedKeys.length) {
    return false;
  }
  for (let i = 0; i < expectedKeys.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, expectedKeys[i])) {
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
  Object.freeze(value);
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    freezeDeep(value[keys[i]]);
  }
  return value;
}

function copyOperation(operation) {
  return freezeDeep({
    idempotencyKey: operation.idempotencyKey,
    taskId: operation.taskId,
    actorId: operation.actorId,
    operationType: operation.operationType,
    governanceRevision: operation.governanceRevision,
  });
}

function classifyOperation(operation) {
  if (!isPlainObject(operation) || !hasExactKeys(operation, OPERATION_KEYS)) {
    return IDEMPOTENCY_OPERATION_DECISIONS.INVALID_OPERATION;
  }
  if (!isNonEmptyString(operation.idempotencyKey)) {
    return IDEMPOTENCY_OPERATION_DECISIONS.INVALID_IDEMPOTENCY_KEY;
  }
  if (!isNonEmptyString(operation.taskId)) {
    return IDEMPOTENCY_OPERATION_DECISIONS.INVALID_TASK_REFERENCE;
  }
  if (!isNonEmptyString(operation.actorId)) {
    return IDEMPOTENCY_OPERATION_DECISIONS.INVALID_ACTOR_REFERENCE;
  }
  if (!isNonEmptyString(operation.operationType)) {
    return IDEMPOTENCY_OPERATION_DECISIONS.INVALID_OPERATION_TYPE;
  }
  if (!isNonEmptyString(operation.governanceRevision)) {
    return IDEMPOTENCY_OPERATION_DECISIONS.INVALID_GOVERNANCE_REVISION;
  }
  return IDEMPOTENCY_OPERATION_DECISIONS.VALID;
}

function validValidation(operation) {
  return freezeDeep({
    valid: true,
    decision: IDEMPOTENCY_OPERATION_DECISIONS.VALID,
    reasons: [],
    operation,
  });
}

function invalidValidation(decision) {
  return freezeDeep({
    valid: false,
    decision,
    reasons: [decision],
    operation: null,
  });
}

function validComparison(decision, reasons, leftOperation, rightOperation) {
  return freezeDeep({
    valid: true,
    decision,
    reasons,
    leftOperation,
    rightOperation,
  });
}

function invalidComparison(reasons, leftOperation, rightOperation) {
  return freezeDeep({
    valid: false,
    decision: IDEMPOTENCY_COMPARISON_DECISIONS.INVALID_INPUT,
    reasons,
    leftOperation,
    rightOperation,
  });
}

export function canonicalizeOperation(operation) {
  return copyOperation(operation);
}

export function validateOperation(operation) {
  const decision = classifyOperation(operation);
  if (decision !== IDEMPOTENCY_OPERATION_DECISIONS.VALID) {
    return invalidValidation(decision);
  }
  return validValidation(canonicalizeOperation(operation));
}

export function compareIdempotency(leftOperation, rightOperation) {
  const leftValidation = validateOperation(leftOperation);
  const rightValidation = validateOperation(rightOperation);

  if (!leftValidation.valid || !rightValidation.valid) {
    const reasons = [];
    if (!leftValidation.valid) {
      reasons.push(REASON_LEFT_INVALID);
    }
    if (!rightValidation.valid) {
      reasons.push(REASON_RIGHT_INVALID);
    }
    return invalidComparison(reasons, null, null);
  }

  const left = leftValidation.operation;
  const right = rightValidation.operation;

  if (left.taskId !== right.taskId) {
    return validComparison(
      IDEMPOTENCY_COMPARISON_DECISIONS.DIFFERENT_OPERATION,
      [REASON_TASK_SCOPE_DIFFERS],
      left,
      right,
    );
  }

  if (left.idempotencyKey !== right.idempotencyKey) {
    return validComparison(
      IDEMPOTENCY_COMPARISON_DECISIONS.DIFFERENT_OPERATION,
      [REASON_IDEMPOTENCY_KEY_DIFFERS],
      left,
      right,
    );
  }

  if (
    left.actorId !== right.actorId
    || left.operationType !== right.operationType
    || left.governanceRevision !== right.governanceRevision
  ) {
    return validComparison(
      IDEMPOTENCY_COMPARISON_DECISIONS.IDEMPOTENCY_CONFLICT,
      [REASON_BINDING_MISMATCH],
      left,
      right,
    );
  }

  return validComparison(
    IDEMPOTENCY_COMPARISON_DECISIONS.SAME_OPERATION,
    [REASON_IDENTITY_MATCH],
    left,
    right,
  );
}
