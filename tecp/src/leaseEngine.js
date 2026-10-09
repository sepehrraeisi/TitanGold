/**
 * TECP-011 in-memory lease facts.
 *
 * Conceptual column mapping only:
 *   leaseKey ↔ lease_key
 *   taskId ↔ task_id
 *   actorId ↔ actor_id
 *   leaseType ↔ lease_type
 *   status ↔ status
 *   governanceRevision ↔ governance_revision
 *   branchName ↔ branch_name
 *   worktreePath ↔ worktree_path
 *   version ↔ version
 *
 * Canonical table name: public.tecp_leases
 * This module performs no persistence access.
 */

export const LEASE_STATUSES = Object.freeze(['ACTIVE', 'RELEASED']);

export const LEASE_DECISIONS = Object.freeze({
  VALID: 'VALID',
  INVALID_LEASE: 'INVALID_LEASE',
  INVALID_LEASE_KEY: 'INVALID_LEASE_KEY',
  INVALID_TASK_REFERENCE: 'INVALID_TASK_REFERENCE',
  INVALID_ACTOR_REFERENCE: 'INVALID_ACTOR_REFERENCE',
  INVALID_LEASE_TYPE: 'INVALID_LEASE_TYPE',
  INVALID_LEASE_STATUS: 'INVALID_LEASE_STATUS',
  INVALID_GOVERNANCE_REVISION: 'INVALID_GOVERNANCE_REVISION',
  INVALID_BRANCH_NAME: 'INVALID_BRANCH_NAME',
  INVALID_WORKTREE_PATH: 'INVALID_WORKTREE_PATH',
  INVALID_VERSION: 'INVALID_VERSION',
});

const LEASE_KEYS = Object.freeze([
  'leaseKey',
  'taskId',
  'actorId',
  'leaseType',
  'status',
  'governanceRevision',
  'branchName',
  'worktreePath',
  'version',
]);

const GRANT_KEYS = Object.freeze([
  'leaseKey',
  'taskId',
  'actorId',
  'leaseType',
  'governanceRevision',
  'branchName',
  'worktreePath',
]);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value) {
  return value === null || typeof value === 'string';
}

function isValidVersion(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function invalidResult(decision, extra) {
  return freezeDeep({
    valid: false,
    decision,
    reasons: [decision],
    lease: null,
    ...extra,
  });
}

function validResult(lease, extra) {
  return freezeDeep({
    valid: true,
    decision: LEASE_DECISIONS.VALID,
    reasons: [],
    lease,
    ...extra,
  });
}

export function canonicalizeLease(lease) {
  return Object.freeze({
    leaseKey: lease.leaseKey,
    taskId: lease.taskId,
    actorId: lease.actorId,
    leaseType: lease.leaseType,
    status: lease.status,
    governanceRevision: lease.governanceRevision,
    branchName: lease.branchName,
    worktreePath: lease.worktreePath,
    version: lease.version,
  });
}

function classifyLease(lease) {
  if (!isPlainObject(lease) || !hasExactKeys(lease, LEASE_KEYS)) {
    return LEASE_DECISIONS.INVALID_LEASE;
  }
  if (!isNonEmptyString(lease.leaseKey)) return LEASE_DECISIONS.INVALID_LEASE_KEY;
  if (!isNonEmptyString(lease.taskId)) return LEASE_DECISIONS.INVALID_TASK_REFERENCE;
  if (!isNonEmptyString(lease.actorId)) return LEASE_DECISIONS.INVALID_ACTOR_REFERENCE;
  if (!isNonEmptyString(lease.leaseType)) return LEASE_DECISIONS.INVALID_LEASE_TYPE;
  if (!LEASE_STATUSES.includes(lease.status)) return LEASE_DECISIONS.INVALID_LEASE_STATUS;
  if (!isNonEmptyString(lease.governanceRevision)) return LEASE_DECISIONS.INVALID_GOVERNANCE_REVISION;
  if (!isOptionalString(lease.branchName)) return LEASE_DECISIONS.INVALID_BRANCH_NAME;
  if (!isOptionalString(lease.worktreePath)) return LEASE_DECISIONS.INVALID_WORKTREE_PATH;
  if (!isValidVersion(lease.version)) return LEASE_DECISIONS.INVALID_VERSION;
  return LEASE_DECISIONS.VALID;
}

function classifyGrant(request) {
  if (!isPlainObject(request) || !hasExactKeys(request, GRANT_KEYS)) {
    return LEASE_DECISIONS.INVALID_LEASE;
  }
  if (!isNonEmptyString(request.leaseKey)) return LEASE_DECISIONS.INVALID_LEASE_KEY;
  if (!isNonEmptyString(request.taskId)) return LEASE_DECISIONS.INVALID_TASK_REFERENCE;
  if (!isNonEmptyString(request.actorId)) return LEASE_DECISIONS.INVALID_ACTOR_REFERENCE;
  if (!isNonEmptyString(request.leaseType)) return LEASE_DECISIONS.INVALID_LEASE_TYPE;
  if (!isNonEmptyString(request.governanceRevision)) return LEASE_DECISIONS.INVALID_GOVERNANCE_REVISION;
  if (!isOptionalString(request.branchName)) return LEASE_DECISIONS.INVALID_BRANCH_NAME;
  if (!isOptionalString(request.worktreePath)) return LEASE_DECISIONS.INVALID_WORKTREE_PATH;
  return LEASE_DECISIONS.VALID;
}

export function validateLease(lease) {
  const decision = classifyLease(lease);
  if (decision !== LEASE_DECISIONS.VALID) return invalidResult(decision);
  return validResult(canonicalizeLease(lease));
}

export function grantLease(request) {
  const decision = classifyGrant(request);
  if (decision !== LEASE_DECISIONS.VALID) return invalidResult(decision);
  return validResult(canonicalizeLease({
    leaseKey: request.leaseKey,
    taskId: request.taskId,
    actorId: request.actorId,
    leaseType: request.leaseType,
    status: 'ACTIVE',
    governanceRevision: request.governanceRevision,
    branchName: request.branchName,
    worktreePath: request.worktreePath,
    version: 1,
  }));
}

export function releaseLease(lease) {
  const checked = validateLease(lease);
  if (!checked.valid) {
    return invalidResult(checked.decision, { changed: false });
  }
  if (checked.lease.status === 'RELEASED') {
    return validResult(canonicalizeLease(checked.lease), { changed: false });
  }
  const nextVersion = checked.lease.version + 1;
  if (!isValidVersion(nextVersion)) {
    return invalidResult(LEASE_DECISIONS.INVALID_VERSION, { changed: false });
  }
  return validResult(canonicalizeLease({
    ...checked.lease,
    status: 'RELEASED',
    version: nextVersion,
  }), { changed: true });
}
