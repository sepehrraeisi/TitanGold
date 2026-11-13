/**
 * Local V1 task record model.
 *
 * Reuses TECP-compatible field meanings (taskId, actorId, resource claims,
 * lease facts, evidence facts) without claiming production TECP authorization
 * or durable PostgreSQL fencing.
 */

export const GOVERNANCE_REVISION = 'OPS_PILOT_001_TASK_MANAGER_V1_LOCAL_WORKFLOW_20261113';

export const TASK_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  CLAIMED: 'CLAIMED',
  PREPARED: 'PREPARED',
  RUNNING: 'RUNNING',
  EVIDENCE_SUBMITTED: 'EVIDENCE_SUBMITTED',
  EVIDENCE_VERIFIED: 'EVIDENCE_VERIFIED',
  OWNER_ACCEPTED: 'OWNER_ACCEPTED',
  OWNER_REJECTED: 'OWNER_REJECTED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
  RECOVERY_REQUIRED: 'RECOVERY_REQUIRED',
  UNCERTAIN_RUNNING: 'UNCERTAIN_RUNNING',
});

export const TERMINAL_STATUSES = Object.freeze([
  TASK_STATUSES.OWNER_ACCEPTED,
  TASK_STATUSES.OWNER_REJECTED,
  TASK_STATUSES.FAILED,
]);

export const ACTIVE_WRITE_STATUSES = Object.freeze([
  TASK_STATUSES.CLAIMED,
  TASK_STATUSES.PREPARED,
  TASK_STATUSES.RUNNING,
  TASK_STATUSES.EVIDENCE_SUBMITTED,
  TASK_STATUSES.EVIDENCE_VERIFIED,
  TASK_STATUSES.UNCERTAIN_RUNNING,
  TASK_STATUSES.RECOVERY_REQUIRED,
]);

const REQUIRED_CREATE_KEYS = Object.freeze([
  'taskId',
  'ownerActorId',
  'goal',
  'repository',
  'baseSha',
  'fileAllowlist',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);
}

function normalizePath(p) {
  if (!isNonEmptyString(p)) return null;
  const trimmed = p.trim().replace(/\\/g, '/');
  if (trimmed.startsWith('/') || trimmed.includes('\0')) return null;
  if (trimmed.split('/').includes('..')) return null;
  return trimmed;
}

/**
 * @param {object} input
 * @param {{ nowMs?: number }} [opts]
 */
export function createTaskRecord(input, opts = {}) {
  if (!isPlainObject(input)) {
    return { ok: false, code: 'INVALID_TASK_INPUT', task: null };
  }
  for (const key of REQUIRED_CREATE_KEYS) {
    if (!(key in input)) {
      return { ok: false, code: `MISSING_${key}`, task: null };
    }
  }
  if (!isNonEmptyString(input.taskId)) {
    return { ok: false, code: 'INVALID_TASK_ID', task: null };
  }
  if (!isNonEmptyString(input.ownerActorId)) {
    return { ok: false, code: 'INVALID_OWNER', task: null };
  }
  if (!isNonEmptyString(input.goal)) {
    return { ok: false, code: 'INVALID_GOAL', task: null };
  }
  if (!isNonEmptyString(input.repository)) {
    return { ok: false, code: 'INVALID_REPOSITORY', task: null };
  }
  if (!isSha(input.baseSha)) {
    return { ok: false, code: 'INVALID_BASE_SHA', task: null };
  }
  if (!Array.isArray(input.fileAllowlist) || input.fileAllowlist.length === 0) {
    return { ok: false, code: 'INVALID_FILE_ALLOWLIST', task: null };
  }
  const allowlist = [];
  for (const entry of input.fileAllowlist) {
    const path = normalizePath(entry);
    if (!path) {
      return { ok: false, code: 'FORBIDDEN_OR_INVALID_PATH', task: null };
    }
    if (!allowlist.includes(path)) allowlist.push(path);
  }

  const dependsOn = Array.isArray(input.dependsOnTaskIds)
    ? [...new Set(input.dependsOnTaskIds.filter(isNonEmptyString))]
    : [];

  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const task = {
    taskId: input.taskId.trim(),
    ownerActorId: input.ownerActorId.trim(),
    goal: input.goal.trim(),
    repository: input.repository.trim(),
    baseSha: input.baseSha.toLowerCase(),
    branchName: isNonEmptyString(input.branchName) ? input.branchName.trim() : null,
    prNumber: Number.isInteger(input.prNumber) ? input.prNumber : null,
    fileAllowlist: Object.freeze([...allowlist].sort()),
    dependsOnTaskIds: Object.freeze(dependsOn),
    status: TASK_STATUSES.PENDING,
    actorId: null,
    attempt: 0,
    lease: null,
    instructionPacket: null,
    evidence: null,
    verification: null,
    ownerReview: null,
    recovery: null,
    auditTrail: Object.freeze([]),
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    governanceRevision: GOVERNANCE_REVISION,
    authorityClass: 'LOCAL_V1_WORKFLOW_CLAIM_NOT_PRODUCTION_TECP_AUTHZ',
  };
  return { ok: true, code: 'OK', task: freezeTask(task) };
}

export function freezeTask(task) {
  return Object.freeze({
    ...task,
    fileAllowlist: Object.freeze([...(task.fileAllowlist || [])]),
    dependsOnTaskIds: Object.freeze([...(task.dependsOnTaskIds || [])]),
    auditTrail: Object.freeze([...(task.auditTrail || [])].map((e) => Object.freeze({ ...e }))),
    lease: task.lease ? Object.freeze({ ...task.lease }) : null,
    instructionPacket: task.instructionPacket
      ? Object.freeze({ ...task.instructionPacket })
      : null,
    evidence: task.evidence ? Object.freeze({ ...task.evidence }) : null,
    verification: task.verification ? Object.freeze({ ...task.verification }) : null,
    ownerReview: task.ownerReview ? Object.freeze({ ...task.ownerReview }) : null,
    recovery: task.recovery ? Object.freeze({ ...task.recovery }) : null,
  });
}

export function cloneMutable(task) {
  return {
    ...task,
    fileAllowlist: [...(task.fileAllowlist || [])],
    dependsOnTaskIds: [...(task.dependsOnTaskIds || [])],
    auditTrail: [...(task.auditTrail || [])].map((e) => ({ ...e })),
    lease: task.lease ? { ...task.lease } : null,
    instructionPacket: task.instructionPacket ? { ...task.instructionPacket } : null,
    evidence: task.evidence ? { ...task.evidence } : null,
    verification: task.verification ? { ...task.verification } : null,
    ownerReview: task.ownerReview ? { ...task.ownerReview } : null,
    recovery: task.recovery ? { ...task.recovery } : null,
  };
}

export function appendAudit(task, event) {
  const next = cloneMutable(task);
  next.auditTrail.push({
    eventId: event.eventId,
    eventType: event.eventType,
    actorId: event.actorId,
    atMs: event.atMs,
    note: event.note || null,
  });
  next.updatedAtMs = event.atMs;
  return freezeTask(next);
}

export function isActiveWriteStatus(status) {
  return ACTIVE_WRITE_STATUSES.includes(status);
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

export function normalizeAllowlistPath(path) {
  return normalizePath(path);
}
