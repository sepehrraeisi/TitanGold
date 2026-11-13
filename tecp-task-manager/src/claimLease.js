/**
 * Local V1 claim/lease helpers.
 *
 * Reuses frozen TECP leaseEngine fact shape (import-only) and adds a local
 * TTL clock for workflow claims. This is NOT production TECP fencing or
 * PostgreSQL-backed lease authority.
 */

import {
  grantLease,
  releaseLease,
  validateLease,
  LEASE_DECISIONS,
  LEASE_STATUSES,
} from '../../tecp/src/leaseEngine.js';
import { GOVERNANCE_REVISION } from './taskRecord.js';

export const DEFAULT_CLAIM_TTL_MS = 60 * 60 * 1000;
export const DEFAULT_RUNNING_TTL_MS = 4 * 60 * 60 * 1000;
export const LOCAL_LEASE_TYPE = 'TASK_MANAGER_V1_WORKFLOW_CLAIM';

/**
 * @param {{
 *   taskId: string,
 *   actorId: string,
 *   attempt: number,
 *   branchName?: string|null,
 *   worktreePath?: string|null,
 *   ttlMs?: number,
 *   nowMs?: number,
 * }} input
 */
export function issueWorkflowLease(input) {
  const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const ttlMs = Number.isFinite(input.ttlMs) ? input.ttlMs : DEFAULT_CLAIM_TTL_MS;
  const leaseKey = `tmv1:${input.taskId}:a${input.attempt}:${input.actorId}`;
  const granted = grantLease({
    leaseKey,
    taskId: input.taskId,
    actorId: input.actorId,
    leaseType: LOCAL_LEASE_TYPE,
    governanceRevision: GOVERNANCE_REVISION,
    branchName: input.branchName || null,
    worktreePath: input.worktreePath || null,
  });
  if (!granted.valid || granted.decision !== LEASE_DECISIONS.VALID) {
    return {
      ok: false,
      code: granted.decision,
      lease: null,
    };
  }
  const lease = {
    ...granted.lease,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
    attempt: input.attempt,
    authorityClass: 'LOCAL_V1_WORKFLOW_CLAIM_NOT_PRODUCTION_TECP_FENCING',
  };
  return { ok: true, code: 'OK', lease: Object.freeze(lease) };
}

export function validateWorkflowLease(lease, expectation = {}) {
  const base = validateLease({
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
  if (base.decision !== LEASE_DECISIONS.VALID) {
    return { ok: false, code: base.decision, expired: false };
  }
  if (lease.leaseType !== LOCAL_LEASE_TYPE) {
    return { ok: false, code: 'INVALID_LEASE_TYPE', expired: false };
  }
  if (expectation.taskId && lease.taskId !== expectation.taskId) {
    return { ok: false, code: 'LEASE_TASK_MISMATCH', expired: false };
  }
  if (expectation.actorId && lease.actorId !== expectation.actorId) {
    return { ok: false, code: 'LEASE_ACTOR_MISMATCH', expired: false };
  }
  if (Number.isInteger(expectation.attempt) && lease.attempt !== expectation.attempt) {
    return { ok: false, code: 'STALE_ATTEMPT', expired: false };
  }
  const nowMs = Number.isFinite(expectation.nowMs) ? expectation.nowMs : Date.now();
  if (!Number.isFinite(lease.expiresAtMs) || lease.expiresAtMs <= nowMs) {
    return { ok: false, code: 'LEASE_EXPIRED', expired: true };
  }
  if (lease.status !== LEASE_STATUSES[0] && lease.status !== 'ACTIVE') {
    return { ok: false, code: 'LEASE_NOT_ACTIVE', expired: false };
  }
  return { ok: true, code: 'OK', expired: false };
}

export function releaseWorkflowLease(lease) {
  const released = releaseLease({
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
  if (released.decision !== LEASE_DECISIONS.VALID) {
    return { ok: false, code: released.decision, lease: null };
  }
  return {
    ok: true,
    code: 'OK',
    lease: Object.freeze({
      ...lease,
      ...released.lease,
      releasedAtMs: Date.now(),
    }),
  };
}
