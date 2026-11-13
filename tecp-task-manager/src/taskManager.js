/**
 * Single-Cursor Task Manager V1 orchestrator.
 *
 * Import-only reuse of frozen TECP contracts for task graph, resource claims,
 * conflicts, leases, evidence, audit, idempotency, recovery, and actor
 * capability vocabulary. Local workflow claims are NOT production TECP
 * authorization or fencing.
 */

import { randomUUID } from 'node:crypto';
import {
  buildTaskGraph,
  evaluateTaskReadiness,
  TASK_COMPLETION_STATUS,
  TASK_READINESS_DECISIONS,
} from '../../tecp/src/taskGraph.js';
import {
  buildResourceClaims,
  CLAIM_ACCESS_MODES,
  RESOURCE_TYPES,
} from '../../tecp/src/resourceClaims.js';
import {
  evaluateConflictSet,
  CONFLICT_VERDICTS,
} from '../../tecp/src/conflictEngine.js';
import { validateAuditEvent } from '../../tecp/src/auditEvent.js';
import {
  compareIdempotency,
  validateOperation,
  IDEMPOTENCY_COMPARISON_DECISIONS,
} from '../../tecp/src/idempotencyOps.js';
import {
  evaluateRecovery,
  RECOVERY_DECISIONS,
} from '../../tecp/src/recovery.js';
import {
  evaluateCapability,
  TECP_AUTHORITY_BOUNDARY,
} from '../../tecp/src/actorCapabilityEngine.js';
import {
  createTaskRecord,
  freezeTask,
  cloneMutable,
  appendAudit,
  TASK_STATUSES,
  GOVERNANCE_REVISION,
  isActiveWriteStatus,
  isTerminalStatus,
  normalizeAllowlistPath,
} from './taskRecord.js';
import {
  openFileQueueStore,
} from './fileQueueStore.js';
import {
  issueWorkflowLease,
  validateWorkflowLease,
  releaseWorkflowLease,
  DEFAULT_CLAIM_TTL_MS,
  DEFAULT_RUNNING_TTL_MS,
} from './claimLease.js';
import { buildInstructionPacket } from './instructionPacket.js';
import { verifyTaskEvidence, VERIFY_DECISIONS } from './evidenceVerifier.js';

function result(ok, code, extra = {}) {
  return { ok, code, ...extra };
}

function actor(actorId, actorType = 'OWNER') {
  return { actorId, actorType };
}

function requireCapability(actorId, actorType, capability) {
  // Local V1 workflow gate only: imports TECP capability vocabulary.
  // This is NOT production TECP authorization or Owner key custody.
  return evaluateCapability(
    actor(actorId, actorType),
    capability,
    {
      authorityBoundary: TECP_AUTHORITY_BOUNDARY,
      governanceDecision: {
        allowed: true,
        decision: 'LOCAL_V1_WORKFLOW_VOCABULARY_CHECK_NOT_PRODUCTION_AUTHZ',
      },
    },
  );
}

function fileClaimsForTask(task) {
  return (task.fileAllowlist || []).map((resourceKey) => ({
    taskId: task.taskId,
    resourceType: 'FILE',
    resourceKey,
    accessMode: 'WRITE',
  }));
}

function graphStatusForTask(task) {
  if (task.status === TASK_STATUSES.OWNER_ACCEPTED) {
    return TASK_COMPLETION_STATUS.COMPLETED;
  }
  return 'OPEN';
}

/**
 * @param {{ dataDir: string, nowMs?: number, githubReader?: object, claimTtlMs?: number, runningTtlMs?: number }} options
 */
export async function createTaskManager(options) {
  if (!options || typeof options.dataDir !== 'string') {
    throw new Error('createTaskManager requires options.dataDir');
  }
  const store = await openFileQueueStore(options.dataDir, { nowMs: options.nowMs });
  const claimTtlMs = Number.isFinite(options.claimTtlMs) ? options.claimTtlMs : DEFAULT_CLAIM_TTL_MS;
  const runningTtlMs = Number.isFinite(options.runningTtlMs)
    ? options.runningTtlMs
    : DEFAULT_RUNNING_TTL_MS;
  const githubReader = options.githubReader || null;
  const seenIdempotency = new Map();

  async function loadAllTasks() {
    const ids = await store.listTaskIds();
    const tasks = [];
    for (const id of ids) {
      const t = await store.readTask(id);
      if (t) tasks.push(freezeTask(t));
    }
    return tasks;
  }

  async function save(task, auditEvent) {
    let next = task;
    if (auditEvent) {
      const validated = validateAuditEvent({
        eventId: auditEvent.eventId,
        eventType: auditEvent.eventType,
        taskId: task.taskId,
        actorId: auditEvent.actorId,
        governanceRevision: GOVERNANCE_REVISION,
      });
      if (!validated.valid) {
        return result(false, `AUDIT_${validated.decision}`);
      }
      next = appendAudit(task, {
        eventId: auditEvent.eventId,
        eventType: auditEvent.eventType,
        actorId: auditEvent.actorId,
        atMs: auditEvent.atMs,
        note: auditEvent.note,
      });
    }
    await store.writeTask(next);
    await store.appendEvent({
      atMs: auditEvent ? auditEvent.atMs : Date.now(),
      taskId: next.taskId,
      status: next.status,
      type: auditEvent ? auditEvent.eventType : 'PERSIST',
    });
    return result(true, 'OK', { task: next });
  }

  function buildGraph(tasks) {
    const nodes = tasks.map((t) => ({
      taskId: t.taskId,
      status: graphStatusForTask(t),
    }));
    const deps = [];
    for (const t of tasks) {
      for (const d of t.dependsOnTaskIds || []) {
        deps.push({ taskId: t.taskId, dependsOnTaskId: d });
      }
    }
    return buildTaskGraph(nodes, deps);
  }

  function collectActiveFileClaims(tasks, exceptTaskId = null) {
    const claims = [];
    for (const t of tasks) {
      if (exceptTaskId && t.taskId === exceptTaskId) continue;
      if (!isActiveWriteStatus(t.status)) continue;
      claims.push(...fileClaimsForTask(t));
    }
    return claims;
  }

  async function checkIdempotency(op) {
    const validated = validateOperation(op);
    if (!validated.valid) {
      return result(false, validated.decision);
    }
    const prev = seenIdempotency.get(op.idempotencyKey);
    if (!prev) {
      seenIdempotency.set(op.idempotencyKey, validated.operation);
      return result(true, 'OK', { replay: false });
    }
    const cmp = compareIdempotency(prev, validated.operation);
    if (cmp.decision === IDEMPOTENCY_COMPARISON_DECISIONS.SAME_OPERATION) {
      return result(true, 'IDEMPOTENT_REPLAY', { replay: true });
    }
    return result(false, 'IDEMPOTENCY_CONFLICT', { comparison: cmp.decision });
  }

  const api = {
    dataDir: store.root,
    governanceRevision: GOVERNANCE_REVISION,

    async create(input) {
      const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
      const built = createTaskRecord(input, { nowMs });
      if (!built.ok) return result(false, built.code);
      const existing = await store.readTask(built.task.taskId);
      if (existing) return result(false, 'DUPLICATE_TASK_ID');

      const tasks = await loadAllTasks();
      // Validate dependency graph including new task
      const withNew = [...tasks, built.task];
      const graph = buildGraph(withNew);
      if (!graph.valid) {
        return result(false, graph.decision || 'INVALID_GRAPH', { reasons: graph.reasons });
      }

      // Validate resource claim shapes
      const claims = buildResourceClaims(fileClaimsForTask(built.task));
      if (!claims.valid) {
        return result(false, claims.decision || 'INVALID_RESOURCE_CLAIMS');
      }

      const cap = requireCapability(built.task.ownerActorId, 'OWNER', 'REQUEST_IMPLEMENTATION');
      if (cap.decision !== 'ALLOW') {
        return result(false, cap.decision);
      }

      return save(built.task, {
        eventId: randomUUID(),
        eventType: 'TASK_CREATED',
        actorId: built.task.ownerActorId,
        atMs: nowMs,
      });
    },

    async claim({ taskId, actorId, actorType = 'CURSOR_WORKER', nowMs, idempotencyKey }) {
      const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
      const cap = requireCapability(actorId, actorType, 'CLAIM_TASK');
      if (cap.decision !== 'ALLOW') return result(false, cap.decision);

      if (idempotencyKey) {
        const idem = await checkIdempotency({
          idempotencyKey,
          taskId,
          actorId,
          operationType: 'CLAIM',
          governanceRevision: GOVERNANCE_REVISION,
        });
        if (!idem.ok) return idem;
        if (idem.replay) {
          const task = await store.readTask(taskId);
          return result(true, 'IDEMPOTENT_REPLAY', { task: task ? freezeTask(task) : null });
        }
      }

      const task = await store.readTask(taskId);
      if (!task) return result(false, 'TASK_NOT_FOUND');
      if (task.status !== TASK_STATUSES.PENDING) {
        return result(false, 'INVALID_TRANSITION', { status: task.status });
      }

      const tasks = await loadAllTasks();
      const graph = buildGraph(tasks);
      if (!graph.valid) return result(false, 'INVALID_GRAPH', { reasons: graph.reasons });
      const readinessResult = evaluateTaskReadiness(graph.graph, taskId);
      if (readinessResult.decision !== TASK_READINESS_DECISIONS.READY) {
        return result(false, readinessResult.decision, { readiness: readinessResult });
      }

      const proposedClaims = fileClaimsForTask(task);
      const active = collectActiveFileClaims(tasks, task.taskId);
      const conflict = evaluateConflictSet([...active, ...proposedClaims]);
      if (!conflict.valid) return result(false, 'INVALID_CONFLICT_INPUT');
      if (conflict.verdict === CONFLICT_VERDICTS.BLOCKED
        || conflict.verdict === CONFLICT_VERDICTS.SERIALIZE) {
        return result(false, 'RESOURCE_CONFLICT', {
          verdict: conflict.verdict,
          conflicts: conflict.conflicts,
        });
      }

      const attempt = task.attempt + 1;
      const lease = issueWorkflowLease({
        taskId,
        actorId,
        attempt,
        branchName: task.branchName,
        ttlMs: claimTtlMs,
        nowMs: ts,
      });
      if (!lease.ok) return result(false, lease.code);

      const next = cloneMutable(task);
      next.status = TASK_STATUSES.CLAIMED;
      next.actorId = actorId;
      next.attempt = attempt;
      next.lease = lease.lease;
      next.updatedAtMs = ts;
      return save(freezeTask(next), {
        eventId: randomUUID(),
        eventType: 'TASK_CLAIMED',
        actorId,
        atMs: ts,
      });
    },

    async prepare({ taskId, actorId, nowMs }) {
      const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
      const task = await store.readTask(taskId);
      if (!task) return result(false, 'TASK_NOT_FOUND');
      if (task.status !== TASK_STATUSES.CLAIMED) {
        return result(false, 'INVALID_TRANSITION', { status: task.status });
      }
      if (task.actorId !== actorId) return result(false, 'ACTOR_MISMATCH');
      const leaseCheck = validateWorkflowLease(task.lease, {
        taskId,
        actorId,
        attempt: task.attempt,
        nowMs: ts,
      });
      if (!leaseCheck.ok) {
        if (leaseCheck.expired) {
          return api.recover({ taskId, actorId, nowMs: ts, reason: 'CLAIM_LEASE_EXPIRED' });
        }
        return result(false, leaseCheck.code);
      }

      const packet = buildInstructionPacket(task, {
        attempt: task.attempt,
        actorId,
        nowMs: ts,
      });
      const next = cloneMutable(task);
      next.status = TASK_STATUSES.PREPARED;
      next.instructionPacket = {
        issuedAtMs: packet.issuedAtMs,
        markdown: packet.markdown,
        structured: packet.structured,
      };
      next.updatedAtMs = ts;
      const saved = await save(freezeTask(next), {
        eventId: randomUUID(),
        eventType: 'INSTRUCTION_PREPARED',
        actorId,
        atMs: ts,
      });
      if (!saved.ok) return saved;
      return result(true, 'OK', { task: saved.task, instruction: packet });
    },

    async ackRunning({ taskId, actorId, nowMs }) {
      const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
      const task = await store.readTask(taskId);
      if (!task) return result(false, 'TASK_NOT_FOUND');
      if (task.status !== TASK_STATUSES.PREPARED) {
        return result(false, 'INVALID_TRANSITION', { status: task.status });
      }
      if (task.actorId !== actorId) return result(false, 'ACTOR_MISMATCH');
      const leaseCheck = validateWorkflowLease(task.lease, {
        taskId,
        actorId,
        attempt: task.attempt,
        nowMs: ts,
      });
      if (!leaseCheck.ok) {
        if (leaseCheck.expired) {
          return api.recover({ taskId, actorId, nowMs: ts, reason: 'CLAIM_LEASE_EXPIRED' });
        }
        return result(false, leaseCheck.code);
      }

      // Extend TTL for running phase (local workflow only)
      const extended = issueWorkflowLease({
        taskId,
        actorId,
        attempt: task.attempt,
        branchName: task.branchName,
        ttlMs: runningTtlMs,
        nowMs: ts,
      });
      if (!extended.ok) return result(false, extended.code);

      const next = cloneMutable(task);
      next.status = TASK_STATUSES.RUNNING;
      next.lease = extended.lease;
      next.updatedAtMs = ts;
      return save(freezeTask(next), {
        eventId: randomUUID(),
        eventType: 'RUNNING_ACK',
        actorId,
        atMs: ts,
        note: 'Owner acknowledges supervised Cursor work started; not automatic execution',
      });
    },

    async submitEvidence({ taskId, actorId, prNumber, headShaHint, evidenceId, nowMs, attempt }) {
      const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
      const cap = requireCapability(actorId, 'CURSOR_WORKER', 'SUBMIT_EVIDENCE');
      // OWNER may also submit
      const capOwner = requireCapability(actorId, 'OWNER', 'SUBMIT_EVIDENCE');
      if (cap.decision !== 'ALLOW' && capOwner.decision !== 'ALLOW') {
        return result(false, cap.decision);
      }

      const task = await store.readTask(taskId);
      if (!task) return result(false, 'TASK_NOT_FOUND');
      if (task.status !== TASK_STATUSES.RUNNING && task.status !== TASK_STATUSES.PREPARED) {
        return result(false, 'INVALID_TRANSITION', { status: task.status });
      }
      if (Number.isInteger(attempt) && attempt !== task.attempt) {
        return result(false, 'STALE_ATTEMPT');
      }
      if (task.lease) {
        const leaseCheck = validateWorkflowLease(task.lease, {
          taskId,
          actorId: task.actorId,
          attempt: task.attempt,
          nowMs: ts,
        });
        if (!leaseCheck.ok && leaseCheck.expired) {
          return result(false, 'LEASE_EXPIRED_RECOVERY_REQUIRED');
        }
      }

      const next = cloneMutable(task);
      next.status = TASK_STATUSES.EVIDENCE_SUBMITTED;
      next.evidence = {
        submittedAtMs: ts,
        submittedBy: actorId,
        prNumber,
        headShaHint: headShaHint || null,
        evidenceId: evidenceId || null,
        // Explicitly ignore any success flag
        callerSuccessFlagIgnored: true,
      };
      next.updatedAtMs = ts;
      return save(freezeTask(next), {
        eventId: randomUUID(),
        eventType: 'EVIDENCE_SUBMITTED',
        actorId,
        atMs: ts,
      });
    },

    async verify({ taskId, actorId, nowMs }) {
      const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
      const task = await store.readTask(taskId);
      if (!task) return result(false, 'TASK_NOT_FOUND');
      if (task.status !== TASK_STATUSES.EVIDENCE_SUBMITTED) {
        return result(false, 'INVALID_TRANSITION', { status: task.status });
      }
      if (!task.evidence) return result(false, 'MISSING_EVIDENCE');

      const verification = await verifyTaskEvidence(
        task,
        {
          prNumber: task.evidence.prNumber,
          headShaHint: task.evidence.headShaHint,
          evidenceId: task.evidence.evidenceId,
          actorId: task.evidence.submittedBy || actorId,
          attempt: task.attempt,
        },
        { githubReader, nowMs: ts },
      );

      const next = cloneMutable(task);
      next.verification = {
        decision: verification.decision,
        code: verification.code,
        atMs: ts,
        remote: verification.remote || null,
        limitations: verification.limitations || null,
      };
      next.updatedAtMs = ts;

      if (verification.ok && verification.decision === VERIFY_DECISIONS.PASS) {
        next.status = TASK_STATUSES.EVIDENCE_VERIFIED;
      } else if (verification.decision === VERIFY_DECISIONS.BLOCKED
        || verification.unverified) {
        next.status = TASK_STATUSES.BLOCKED;
      } else {
        next.status = TASK_STATUSES.FAILED;
      }

      const saved = await save(freezeTask(next), {
        eventId: randomUUID(),
        eventType: 'EVIDENCE_VERIFIED',
        actorId: actorId || task.ownerActorId,
        atMs: ts,
        note: verification.code,
      });
      if (!saved.ok) return saved;
      return result(verification.ok, verification.code, {
        task: saved.task,
        verification,
      });
    },

    async accept({ taskId, actorId, nowMs, acknowledgement }) {
      const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
      const cap = requireCapability(actorId, 'OWNER', 'APPROVE_MERGE');
      // APPROVE_MERGE capability on OWNER is used as local review vocabulary only
      if (cap.decision !== 'ALLOW') {
        // fall back to APPROVE_HUMAN_QA
        const cap2 = requireCapability(actorId, 'OWNER', 'APPROVE_HUMAN_QA');
        if (cap2.decision !== 'ALLOW') return result(false, cap.decision);
      }

      const task = await store.readTask(taskId);
      if (!task) return result(false, 'TASK_NOT_FOUND');
      if (task.status !== TASK_STATUSES.EVIDENCE_VERIFIED) {
        return result(false, 'INVALID_TRANSITION', { status: task.status });
      }

      const next = cloneMutable(task);
      next.status = TASK_STATUSES.OWNER_ACCEPTED;
      next.ownerReview = {
        decision: 'ACCEPT',
        actorId,
        atMs: ts,
        acknowledgement: acknowledgement || null,
        identityLimitation:
          'LOCAL_CLI_ACK_SAME_UID_NOT_INDEPENDENT_OWNER_AUTHENTICATION',
        authorityClass: 'LOCAL_OWNER_REVIEW_NOT_PRODUCTION_AUTHZ',
      };
      if (next.lease) {
        const released = releaseWorkflowLease(next.lease);
        if (released.ok) next.lease = released.lease;
      }
      next.updatedAtMs = ts;
      return save(freezeTask(next), {
        eventId: randomUUID(),
        eventType: 'OWNER_ACCEPTED',
        actorId,
        atMs: ts,
      });
    },

    async reject({ taskId, actorId, nowMs, reason }) {
      const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
      const task = await store.readTask(taskId);
      if (!task) return result(false, 'TASK_NOT_FOUND');
      if (![
        TASK_STATUSES.EVIDENCE_VERIFIED,
        TASK_STATUSES.EVIDENCE_SUBMITTED,
        TASK_STATUSES.BLOCKED,
        TASK_STATUSES.FAILED,
        TASK_STATUSES.RECOVERY_REQUIRED,
        TASK_STATUSES.UNCERTAIN_RUNNING,
      ].includes(task.status)) {
        return result(false, 'INVALID_TRANSITION', { status: task.status });
      }

      const next = cloneMutable(task);
      next.status = TASK_STATUSES.OWNER_REJECTED;
      next.ownerReview = {
        decision: 'REJECT',
        actorId,
        atMs: ts,
        reason: reason || null,
        identityLimitation:
          'LOCAL_CLI_ACK_SAME_UID_NOT_INDEPENDENT_OWNER_AUTHENTICATION',
        authorityClass: 'LOCAL_OWNER_REVIEW_NOT_PRODUCTION_AUTHZ',
      };
      if (next.lease) {
        const released = releaseWorkflowLease(next.lease);
        if (released.ok) next.lease = released.lease;
      }
      next.updatedAtMs = ts;
      return save(freezeTask(next), {
        eventId: randomUUID(),
        eventType: 'OWNER_REJECTED',
        actorId,
        atMs: ts,
        note: reason || null,
      });
    },

    async recover({ taskId, actorId, nowMs, reason }) {
      const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
      const task = await store.readTask(taskId);
      if (!task) return result(false, 'TASK_NOT_FOUND');
      if (isTerminalStatus(task.status)) {
        return result(false, 'ALREADY_TERMINAL', { status: task.status });
      }

      const wasRunning = task.status === TASK_STATUSES.RUNNING
        || task.status === TASK_STATUSES.UNCERTAIN_RUNNING;
      const leaseExpired = task.lease
        ? validateWorkflowLease(task.lease, {
          taskId: task.taskId,
          actorId: task.actorId,
          attempt: task.attempt,
          nowMs: ts,
        }).expired
        : false;

      const recoveryCase = {
        recoveryCaseId: `rc:${task.taskId}:${task.attempt}:${ts}`,
        taskId: task.taskId,
        actorId: actorId || task.ownerActorId,
        governanceRevision: GOVERNANCE_REVISION,
        failureType: reason || (leaseExpired ? 'LEASE_EXPIRED' : 'MANUAL_RECOVER'),
        requiresTaskMutation: true,
        requiresLeaseMutation: true,
        requiresRuntimeObservation: wasRunning,
        requiresExternalSideEffect: false,
        requiresScopeExpansion: false,
        requiresConflictOverride: false,
      };
      const recovery = evaluateRecovery(recoveryCase);

      const next = cloneMutable(task);
      if (wasRunning || (task.status === TASK_STATUSES.RUNNING && leaseExpired)) {
        // NEVER silently reassign; mark uncertain / recovery-required
        next.status = TASK_STATUSES.UNCERTAIN_RUNNING;
      } else if (leaseExpired || task.status === TASK_STATUSES.CLAIMED
        || task.status === TASK_STATUSES.PREPARED) {
        next.status = TASK_STATUSES.RECOVERY_REQUIRED;
      } else {
        next.status = TASK_STATUSES.RECOVERY_REQUIRED;
      }
      next.recovery = {
        atMs: ts,
        reason: reason || null,
        decision: recovery.decision,
        reasons: recovery.reasons,
        note: wasRunning
          ? 'Expired/uncertain RUNNING must not be silently reassigned; Owner review required'
          : 'Claim/prepare recovery requires Owner review before re-claim',
      };
      // Clear active lease binding without granting a new assignment
      if (next.lease && next.lease.status === 'ACTIVE') {
        const released = releaseWorkflowLease(next.lease);
        if (released.ok) next.lease = released.lease;
      }
      next.updatedAtMs = ts;

      if (recovery.decision === RECOVERY_DECISIONS.INVALID_RECOVERY_CASE) {
        return result(false, recovery.decision);
      }

      return save(freezeTask(next), {
        eventId: randomUUID(),
        eventType: 'RECOVERY_MARKED',
        actorId: actorId || task.ownerActorId,
        atMs: ts,
        note: next.recovery.note,
      });
    },

    async status({ taskId } = {}) {
      if (taskId) {
        const task = await store.readTask(taskId);
        if (!task) return result(false, 'TASK_NOT_FOUND');
        return result(true, 'OK', { task: freezeTask(task) });
      }
      const tasks = await loadAllTasks();
      return result(true, 'OK', { tasks });
    },

    async next({ nowMs } = {}) {
      const ts = Number.isFinite(nowMs) ? nowMs : Date.now();
      const tasks = await loadAllTasks();
      // Expire RUNNING/CLAIMED leases into recovery without silent reassignment
      for (const t of tasks) {
        if (!t.lease || t.lease.status !== 'ACTIVE') continue;
        if (![TASK_STATUSES.CLAIMED, TASK_STATUSES.PREPARED, TASK_STATUSES.RUNNING]
          .includes(t.status)) continue;
        const check = validateWorkflowLease(t.lease, {
          taskId: t.taskId,
          actorId: t.actorId,
          attempt: t.attempt,
          nowMs: ts,
        });
        if (check.expired) {
          await api.recover({
            taskId: t.taskId,
            actorId: t.ownerActorId,
            nowMs: ts,
            reason: 'LEASE_EXPIRED_ON_NEXT',
          });
        }
      }

      const refreshed = await loadAllTasks();
      const graph = buildGraph(refreshed);
      if (!graph.valid) {
        return result(false, 'INVALID_GRAPH', { reasons: graph.reasons });
      }

      const pending = refreshed
        .filter((t) => t.status === TASK_STATUSES.PENDING)
        .sort((a, b) => a.createdAtMs - b.createdAtMs || a.taskId.localeCompare(b.taskId));

      const activeClaims = collectActiveFileClaims(refreshed);
      for (const candidate of pending) {
        const readiness = evaluateTaskReadiness(graph.graph, candidate.taskId);
        if (readiness.decision !== TASK_READINESS_DECISIONS.READY) continue;
        const proposed = fileClaimsForTask(candidate);
        const conflict = evaluateConflictSet([...activeClaims, ...proposed]);
        if (!conflict.valid) continue;
        if (conflict.verdict === CONFLICT_VERDICTS.BLOCKED
          || conflict.verdict === CONFLICT_VERDICTS.SERIALIZE) {
          continue;
        }
        return result(true, 'OK', { task: candidate });
      }
      return result(false, 'NO_ELIGIBLE_TASK');
    },

    async close() {
      await store.close();
    },
  };

  void RESOURCE_TYPES;
  void CLAIM_ACCESS_MODES;

  return api;
}

export {
  TASK_STATUSES,
  GOVERNANCE_REVISION,
  normalizeAllowlistPath,
  openFileQueueStore,
};
