/**
 * TECP-DLP-002 disposable Task → Claim → Lease → Release composition.
 *
 * NON_OPERATIONAL proof only. No trusted Worker authentication.
 * Not a Cursor execution capability. Not MCP action tooling.
 *
 * Composes DLP-001 WRITE lease in-transaction APIs inside one caller-owned
 * PostgreSQL transaction. Does not duplicate the WRITE lease algorithm.
 */

import {
  APPROVED_GOVERNANCE_REVISION,
  WRITE_LEASE_DECISIONS,
  acquireWriteLeaseInTransaction,
  releaseWriteLeaseInTransaction,
  withOwnedWriteLeaseTransaction,
} from './writeLeaseRepository.js';

export const COMPOSITION_DECISIONS = Object.freeze({
  BOUND: 'BOUND',
  REPLAY: 'REPLAY',
  RELEASED: 'RELEASED',
  DENY_INVALID_INPUT: 'DENY_INVALID_INPUT',
  DENY_INVALID_GOVERNANCE_REVISION: 'DENY_INVALID_GOVERNANCE_REVISION',
  DENY_CLAIM_CONFLICT: 'DENY_CLAIM_CONFLICT',
  DENY_IDEMPOTENCY_CONFLICT: 'DENY_IDEMPOTENCY_CONFLICT',
  DENY_LEASE: 'DENY_LEASE',
  DENY_FOREIGN_ACTOR: 'DENY_FOREIGN_ACTOR',
  DENY_STALE_FENCING_EPOCH: 'DENY_STALE_FENCING_EPOCH',
  DENY_NOT_FOUND: 'DENY_NOT_FOUND',
  DENY_BINDING_MISMATCH: 'DENY_BINDING_MISMATCH',
  DENY_ALREADY_RELEASED: 'DENY_ALREADY_RELEASED',
  BLOCKED_DB_FAILURE: 'BLOCKED_DB_FAILURE',
});

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveSafeInt(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function requireClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('injected PostgreSQL client with query() is required');
  }
}

function compositionResult(decision, extra = {}) {
  const ok = decision === COMPOSITION_DECISIONS.BOUND
    || decision === COMPOSITION_DECISIONS.REPLAY
    || decision === COMPOSITION_DECISIONS.RELEASED;
  return freezeDeep({
    ok,
    decision,
    reasons: ok ? [] : [decision],
    task: null,
    claim: null,
    lease: null,
    leaseDecision: null,
    operational: false,
    ...extra,
  });
}

function isDbFailure(error) {
  if (!error) return false;
  const code = error.code;
  if (typeof code === 'string' && /^08/.test(code)) return true;
  if (code === '57P01' || code === '57P02' || code === '57P03') return true;
  const message = String(error.message || '');
  return /connect|Connection terminated|not queryable|ECONNREFUSED|ECONNRESET|socket/i.test(message);
}

function isUniqueViolation(error) {
  return Boolean(error) && error.code === '23505';
}

function uniqueHint(error) {
  return String(error.constraint || error.table || error.detail || error.message || '');
}

function validateBindInput(input) {
  if (!input || typeof input !== 'object') return false;
  return isNonEmptyString(input.taskId)
    && isNonEmptyString(input.actorId)
    && isNonEmptyString(input.resourceType)
    && isNonEmptyString(input.resourceKey)
    && isNonEmptyString(input.claimKey)
    && isNonEmptyString(input.leaseKey)
    && isNonEmptyString(input.governanceRevision)
    && isNonEmptyString(input.compositionIdempotencyKey)
    && isNonEmptyString(input.leaseIdempotencyKey)
    && isPositiveSafeInt(input.ttlMs);
}

function validateReleaseInput(input) {
  if (!input || typeof input !== 'object') return false;
  return isNonEmptyString(input.taskId)
    && isNonEmptyString(input.actorId)
    && isNonEmptyString(input.resourceType)
    && isNonEmptyString(input.resourceKey)
    && isNonEmptyString(input.claimKey)
    && isNonEmptyString(input.leaseKey)
    && isNonEmptyString(input.governanceRevision)
    && isPositiveSafeInt(input.fencingEpoch)
    && isPositiveSafeInt(input.expectedVersion);
}

function mapTask(row) {
  if (!row) return null;
  return freezeDeep({
    taskId: row.task_id,
    actorId: row.actor_id,
    governanceRevision: row.governance_revision,
    status: row.status,
    resourceType: row.resource_type,
    resourceKey: row.resource_key,
    claimKey: row.claim_key,
    compositionIdempotencyKey: row.composition_idempotency_key,
  });
}

function mapClaim(row) {
  if (!row) return null;
  return freezeDeep({
    taskId: row.task_id,
    resourceType: row.resource_type,
    resourceKey: row.resource_key,
    actorId: row.actor_id,
    claimKey: row.claim_key,
    accessMode: row.access_mode,
    status: row.status,
    governanceRevision: row.governance_revision,
  });
}

function leaseDenyDecision(leaseResult) {
  if (!leaseResult || leaseResult.ok) return null;
  if (leaseResult.decision === WRITE_LEASE_DECISIONS.DENY_FOREIGN_ACTOR) {
    return COMPOSITION_DECISIONS.DENY_FOREIGN_ACTOR;
  }
  if (leaseResult.decision === WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH) {
    return COMPOSITION_DECISIONS.DENY_STALE_FENCING_EPOCH;
  }
  if (leaseResult.decision === WRITE_LEASE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT) {
    return COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT;
  }
  if (leaseResult.decision === WRITE_LEASE_DECISIONS.BLOCKED_DB_FAILURE) {
    return COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE;
  }
  return COMPOSITION_DECISIONS.DENY_LEASE;
}

class CompositionAbort extends Error {
  constructor(compositionDecision, extra = {}) {
    super(compositionDecision);
    this.name = 'CompositionAbort';
    this.compositionDecision = compositionDecision;
    this.extra = extra;
  }
}

function abort(decision, extra = {}) {
  throw new CompositionAbort(decision, extra);
}

async function resolveCompositionReplay(client, input, idemRow) {
  const taskRes = await client.query(
    `SELECT * FROM dlp_task WHERE task_id = $1 FOR UPDATE`,
    [idemRow.task_id],
  );
  const claimRes = await client.query(
    `SELECT * FROM dlp_task_claim
      WHERE task_id = $1 AND resource_type = $2 AND resource_key = $3
      FOR UPDATE`,
    [idemRow.task_id, idemRow.resource_type, idemRow.resource_key],
  );

  if (taskRes.rowCount !== 1 || claimRes.rowCount !== 1) {
    abort(COMPOSITION_DECISIONS.DENY_NOT_FOUND);
  }

  const task = taskRes.rows[0];
  const claim = claimRes.rows[0];
  if (task.actor_id !== input.actorId
    || task.governance_revision !== input.governanceRevision
    || task.claim_key !== input.claimKey
    || claim.actor_id !== input.actorId
    || claim.claim_key !== input.claimKey
    || claim.status !== 'HELD'
    || task.status !== 'CLAIMED') {
    abort(COMPOSITION_DECISIONS.DENY_BINDING_MISMATCH, {
      task: mapTask(task),
      claim: mapClaim(claim),
    });
  }

  const leaseResult = await acquireWriteLeaseInTransaction(client, {
    resourceType: input.resourceType,
    resourceKey: input.resourceKey,
    leaseKey: input.leaseKey,
    actorId: input.actorId,
    taskId: input.taskId,
    governanceRevision: input.governanceRevision,
    idempotencyKey: input.leaseIdempotencyKey,
    ttlMs: input.ttlMs,
  });

  if (!leaseResult.ok) {
    abort(leaseDenyDecision(leaseResult) || COMPOSITION_DECISIONS.DENY_LEASE, {
      task: mapTask(task),
      claim: mapClaim(claim),
      lease: leaseResult.lease,
      leaseDecision: leaseResult.decision,
    });
  }

  if (leaseResult.lease.fencingEpoch !== Number(idemRow.fencing_epoch)
    || leaseResult.lease.leaseKey !== idemRow.lease_key) {
    abort(COMPOSITION_DECISIONS.DENY_BINDING_MISMATCH, {
      task: mapTask(task),
      claim: mapClaim(claim),
      lease: leaseResult.lease,
      leaseDecision: leaseResult.decision,
    });
  }

  return compositionResult(COMPOSITION_DECISIONS.REPLAY, {
    task: mapTask(task),
    claim: mapClaim(claim),
    lease: leaseResult.lease,
    leaseDecision: leaseResult.decision,
  });
}

async function bindTaskClaimLeaseWork(client, input) {
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
    [input.compositionIdempotencyKey],
  );

  const existingIdem = await client.query(
    `SELECT *
       FROM dlp_task_claim_composition_idempotency
      WHERE composition_idempotency_key = $1
      FOR UPDATE`,
    [input.compositionIdempotencyKey],
  );

  if (existingIdem.rowCount === 1) {
    const row = existingIdem.rows[0];
    const same = row.task_id === input.taskId
      && row.actor_id === input.actorId
      && row.resource_type === input.resourceType
      && row.resource_key === input.resourceKey
      && row.claim_key === input.claimKey
      && row.lease_key === input.leaseKey
      && row.governance_revision === input.governanceRevision;
    if (!same) {
      abort(COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    }
    return resolveCompositionReplay(client, input, row);
  }

  await client.query(
    `INSERT INTO dlp_task (
        task_id, actor_id, governance_revision, status,
        resource_type, resource_key, claim_key, composition_idempotency_key
     ) VALUES ($1,$2,$3,'CLAIMED',$4,$5,$6,$7)`,
    [
      input.taskId,
      input.actorId,
      input.governanceRevision,
      input.resourceType,
      input.resourceKey,
      input.claimKey,
      input.compositionIdempotencyKey,
    ],
  );

  await client.query(
    `INSERT INTO dlp_task_claim (
        task_id, resource_type, resource_key, actor_id, claim_key,
        access_mode, status, governance_revision
     ) VALUES ($1,$2,$3,$4,$5,'WRITE','HELD',$6)`,
    [
      input.taskId,
      input.resourceType,
      input.resourceKey,
      input.actorId,
      input.claimKey,
      input.governanceRevision,
    ],
  );

  const leaseResult = await acquireWriteLeaseInTransaction(client, {
    resourceType: input.resourceType,
    resourceKey: input.resourceKey,
    leaseKey: input.leaseKey,
    actorId: input.actorId,
    taskId: input.taskId,
    governanceRevision: input.governanceRevision,
    idempotencyKey: input.leaseIdempotencyKey,
    ttlMs: input.ttlMs,
  });

  if (!leaseResult.ok) {
    abort(leaseDenyDecision(leaseResult) || COMPOSITION_DECISIONS.DENY_LEASE, {
      lease: leaseResult.lease,
      leaseDecision: leaseResult.decision,
    });
  }

  await client.query(
    `INSERT INTO dlp_task_claim_composition_idempotency (
        composition_idempotency_key, task_id, actor_id, resource_type, resource_key,
        claim_key, lease_key, governance_revision, fencing_epoch, lease_version, decision
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.compositionIdempotencyKey,
      input.taskId,
      input.actorId,
      input.resourceType,
      input.resourceKey,
      input.claimKey,
      input.leaseKey,
      input.governanceRevision,
      leaseResult.lease.fencingEpoch,
      leaseResult.lease.version,
      COMPOSITION_DECISIONS.BOUND,
    ],
  );

  const taskRes = await client.query(`SELECT * FROM dlp_task WHERE task_id = $1`, [input.taskId]);
  const claimRes = await client.query(
    `SELECT * FROM dlp_task_claim
      WHERE task_id = $1 AND resource_type = $2 AND resource_key = $3`,
    [input.taskId, input.resourceType, input.resourceKey],
  );

  return compositionResult(COMPOSITION_DECISIONS.BOUND, {
    task: mapTask(taskRes.rows[0]),
    claim: mapClaim(claimRes.rows[0]),
    lease: leaseResult.lease,
    leaseDecision: leaseResult.decision,
  });
}

async function releaseTaskClaimLeaseWork(client, input) {
  const taskRes = await client.query(
    `SELECT * FROM dlp_task WHERE task_id = $1 FOR UPDATE`,
    [input.taskId],
  );
  if (taskRes.rowCount !== 1) {
    abort(COMPOSITION_DECISIONS.DENY_NOT_FOUND);
  }
  const task = taskRes.rows[0];
  if (task.actor_id !== input.actorId) {
    abort(COMPOSITION_DECISIONS.DENY_FOREIGN_ACTOR, { task: mapTask(task) });
  }
  if (task.governance_revision !== input.governanceRevision
    || task.claim_key !== input.claimKey
    || task.resource_type !== input.resourceType
    || task.resource_key !== input.resourceKey) {
    abort(COMPOSITION_DECISIONS.DENY_BINDING_MISMATCH, { task: mapTask(task) });
  }
  if (task.status === 'RELEASED') {
    abort(COMPOSITION_DECISIONS.DENY_ALREADY_RELEASED, { task: mapTask(task) });
  }

  const claimRes = await client.query(
    `SELECT * FROM dlp_task_claim
      WHERE task_id = $1 AND resource_type = $2 AND resource_key = $3
      FOR UPDATE`,
    [input.taskId, input.resourceType, input.resourceKey],
  );
  if (claimRes.rowCount !== 1) {
    abort(COMPOSITION_DECISIONS.DENY_NOT_FOUND, { task: mapTask(task) });
  }
  const claim = claimRes.rows[0];
  if (claim.actor_id !== input.actorId || claim.claim_key !== input.claimKey) {
    abort(COMPOSITION_DECISIONS.DENY_BINDING_MISMATCH, {
      task: mapTask(task),
      claim: mapClaim(claim),
    });
  }
  if (claim.status !== 'HELD') {
    abort(COMPOSITION_DECISIONS.DENY_ALREADY_RELEASED, {
      task: mapTask(task),
      claim: mapClaim(claim),
    });
  }

  const leaseResult = await releaseWriteLeaseInTransaction(client, {
    resourceType: input.resourceType,
    resourceKey: input.resourceKey,
    leaseKey: input.leaseKey,
    actorId: input.actorId,
    taskId: input.taskId,
    governanceRevision: input.governanceRevision,
    fencingEpoch: input.fencingEpoch,
    expectedVersion: input.expectedVersion,
  });

  if (!leaseResult.ok) {
    abort(leaseDenyDecision(leaseResult) || COMPOSITION_DECISIONS.DENY_LEASE, {
      task: mapTask(task),
      claim: mapClaim(claim),
      lease: leaseResult.lease,
      leaseDecision: leaseResult.decision,
    });
  }

  const releasedClaim = await client.query(
    `UPDATE dlp_task_claim
        SET status = 'RELEASED',
            released_at = clock_timestamp()
      WHERE task_id = $1
        AND resource_type = $2
        AND resource_key = $3
        AND status = 'HELD'
      RETURNING *`,
    [input.taskId, input.resourceType, input.resourceKey],
  );
  if (releasedClaim.rowCount !== 1) {
    abort(COMPOSITION_DECISIONS.DENY_CLAIM_CONFLICT, {
      task: mapTask(task),
      claim: mapClaim(claim),
      lease: leaseResult.lease,
      leaseDecision: leaseResult.decision,
    });
  }

  const releasedTask = await client.query(
    `UPDATE dlp_task
        SET status = 'RELEASED',
            updated_at = clock_timestamp()
      WHERE task_id = $1
        AND status = 'CLAIMED'
      RETURNING *`,
    [input.taskId],
  );
  if (releasedTask.rowCount !== 1) {
    abort(COMPOSITION_DECISIONS.DENY_BINDING_MISMATCH, {
      lease: leaseResult.lease,
      leaseDecision: leaseResult.decision,
    });
  }

  return compositionResult(COMPOSITION_DECISIONS.RELEASED, {
    task: mapTask(releasedTask.rows[0]),
    claim: mapClaim(releasedClaim.rows[0]),
    lease: leaseResult.lease,
    leaseDecision: leaseResult.decision,
  });
}

function mapCaughtError(error) {
  if (error instanceof CompositionAbort) {
    return compositionResult(error.compositionDecision, error.extra);
  }
  if (isUniqueViolation(error)) {
    const hint = uniqueHint(error);
    if (/idempotency/i.test(hint)) {
      return compositionResult(COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    }
    if (/dlp_task_claim_one_held_owner|dlp_task_claim|held/i.test(hint)
      || /dlp_task_pkey|dlp_task /i.test(hint)) {
      return compositionResult(COMPOSITION_DECISIONS.DENY_CLAIM_CONFLICT);
    }
    return compositionResult(COMPOSITION_DECISIONS.DENY_CLAIM_CONFLICT);
  }
  if (isDbFailure(error)) {
    return compositionResult(COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE, {
      errorClass: error.code || error.name || 'DB_FAILURE',
    });
  }
  return null;
}

/**
 * Atomically bind Task + WRITE Claim + WRITE Lease in one owned transaction.
 */
export async function bindTaskClaimLease(client, input) {
  requireClient(client);
  if (!validateBindInput(input)) {
    return compositionResult(COMPOSITION_DECISIONS.DENY_INVALID_INPUT);
  }
  if (input.governanceRevision !== APPROVED_GOVERNANCE_REVISION) {
    return compositionResult(COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }

  try {
    return await withOwnedWriteLeaseTransaction(client, async () => (
      bindTaskClaimLeaseWork(client, input)
    ));
  } catch (error) {
    const mapped = mapCaughtError(error);
    if (mapped) return mapped;
    throw error;
  }
}

/**
 * Atomically release Lease + Claim + Task in one owned transaction.
 */
export async function releaseTaskClaimLease(client, input) {
  requireClient(client);
  if (!validateReleaseInput(input)) {
    return compositionResult(COMPOSITION_DECISIONS.DENY_INVALID_INPUT);
  }
  if (input.governanceRevision !== APPROVED_GOVERNANCE_REVISION) {
    return compositionResult(COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }

  try {
    return await withOwnedWriteLeaseTransaction(client, async () => (
      releaseTaskClaimLeaseWork(client, input)
    ));
  } catch (error) {
    const mapped = mapCaughtError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export { APPROVED_GOVERNANCE_REVISION };
