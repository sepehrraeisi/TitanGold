/**
 * TECP-DLP-003 disposable immutable Audit/Evidence append repository.
 *
 * NON_OPERATIONAL proof only. Caller-supplied actor identity is NOT authenticated.
 * Append APIs never issue BEGIN/COMMIT/ROLLBACK. They require a verified
 * caller-owned transaction (DLP-002 ownership GUC contract) via
 * assertOwnedWriteLeaseTransaction — without modifying frozen DLP-002 sources.
 *
 * No Task+Claim+Lease composition. No hash-chain integrity claim.
 * No trusted Worker authentication. Not MCP action tooling.
 */

import {
  WRITE_LEASE_DECISIONS,
  assertOwnedWriteLeaseTransaction,
} from './writeLeaseRepository.js';

/** Approved governance revision for this disposable DLP-003 proof. */
export const APPROVED_GOVERNANCE_REVISION = 'DLP003_AUTHORIZATION_20261031';

export const AUDIT_EVIDENCE_DECISIONS = Object.freeze({
  APPENDED: 'APPENDED',
  REPLAY: 'REPLAY',
  DENY_INVALID_INPUT: 'DENY_INVALID_INPUT',
  DENY_INVALID_GOVERNANCE_REVISION: 'DENY_INVALID_GOVERNANCE_REVISION',
  DENY_IDEMPOTENCY_CONFLICT: 'DENY_IDEMPOTENCY_CONFLICT',
  DENY_NO_TRANSACTION_OWNERSHIP: 'DENY_NO_TRANSACTION_OWNERSHIP',
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

function requireClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('injected PostgreSQL client with query() is required');
  }
}

function result(decision, extra = {}) {
  const ok = decision === AUDIT_EVIDENCE_DECISIONS.APPENDED
    || decision === AUDIT_EVIDENCE_DECISIONS.REPLAY;
  return freezeDeep({
    ok,
    decision,
    reasons: ok ? [] : [decision],
    record: null,
    operational: false,
    ...extra,
  });
}

function toInt(value) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(value);
  return value;
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

function governanceDenied(governanceRevision) {
  return governanceRevision !== APPROVED_GOVERNANCE_REVISION;
}

function validateAuditInput(input) {
  if (!input || typeof input !== 'object') return false;
  return isNonEmptyString(input.eventId)
    && isNonEmptyString(input.eventType)
    && isNonEmptyString(input.taskId)
    && isNonEmptyString(input.actorId)
    && isNonEmptyString(input.governanceRevision)
    && isNonEmptyString(input.idempotencyKey);
}

function validateEvidenceInput(input) {
  if (!input || typeof input !== 'object') return false;
  return isNonEmptyString(input.evidenceId)
    && isNonEmptyString(input.taskId)
    && isNonEmptyString(input.actorId)
    && isNonEmptyString(input.governanceRevision)
    && isNonEmptyString(input.evidenceType)
    && isNonEmptyString(input.evidenceRef)
    && isNonEmptyString(input.idempotencyKey);
}

function mapAuditRow(row) {
  if (!row) return null;
  return freezeDeep({
    eventId: row.event_id,
    eventType: row.event_type,
    taskId: row.task_id,
    actorId: row.actor_id,
    governanceRevision: row.governance_revision,
    idempotencyKey: row.idempotency_key,
    ord: toInt(row.ord),
    recordedAt: row.recorded_at,
  });
}

function mapEvidenceRow(row) {
  if (!row) return null;
  return freezeDeep({
    evidenceId: row.evidence_id,
    taskId: row.task_id,
    actorId: row.actor_id,
    governanceRevision: row.governance_revision,
    evidenceType: row.evidence_type,
    evidenceRef: row.evidence_ref,
    idempotencyKey: row.idempotency_key,
    ord: toInt(row.ord),
    recordedAt: row.recorded_at,
  });
}

function sameAuditBinding(row, input) {
  return row.event_id === input.eventId
    && row.event_type === input.eventType
    && row.task_id === input.taskId
    && row.actor_id === input.actorId
    && row.governance_revision === input.governanceRevision;
}

function sameEvidenceBinding(row, input) {
  return row.evidence_id === input.evidenceId
    && row.task_id === input.taskId
    && row.actor_id === input.actorId
    && row.governance_revision === input.governanceRevision
    && row.evidence_type === input.evidenceType
    && row.evidence_ref === input.evidenceRef;
}

function mapOwnershipOrDbFailure(error) {
  if (error && error.code === WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP) {
    return result(AUDIT_EVIDENCE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP);
  }
  if (error && error.message === WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP) {
    return result(AUDIT_EVIDENCE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP);
  }
  if (error && error.message === 'BLOCKED_DB_FAILURE') {
    return result(AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE, {
      errorClass: error.code || 'DB_FAILURE',
    });
  }
  if (isDbFailure(error)) {
    return result(AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE, {
      errorClass: error.code || error.name || 'DB_FAILURE',
    });
  }
  return null;
}

async function lockIdempotencyKey(client, kind, idempotencyKey) {
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
    [`dlp003:${kind}:${idempotencyKey}`],
  );
}

async function appendAuditWork(client, input) {
  await lockIdempotencyKey(client, 'audit', input.idempotencyKey);

  // Advisory xact lock serializes same-key contenders. Avoid SELECT FOR UPDATE:
  // that requires UPDATE privilege, which the append-only proof role must not have.
  const existing = await client.query(
    `SELECT *
       FROM dlp_audit_event
      WHERE idempotency_key = $1`,
    [input.idempotencyKey],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (!sameAuditBinding(row, input)) {
      return result(AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT, {
        record: mapAuditRow(row),
      });
    }
    return result(AUDIT_EVIDENCE_DECISIONS.REPLAY, {
      record: mapAuditRow(row),
    });
  }

  try {
    const inserted = await client.query(
      `INSERT INTO dlp_audit_event (
          event_id, event_type, task_id, actor_id, governance_revision, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
      [
        input.eventId,
        input.eventType,
        input.taskId,
        input.actorId,
        input.governanceRevision,
        input.idempotencyKey,
      ],
    );
    return result(AUDIT_EVIDENCE_DECISIONS.APPENDED, {
      record: mapAuditRow(inserted.rows[0]),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await client.query(
        `SELECT *
           FROM dlp_audit_event
          WHERE idempotency_key = $1`,
        [input.idempotencyKey],
      );
      if (raced.rows[0]) {
        const row = raced.rows[0];
        if (!sameAuditBinding(row, input)) {
          return result(AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT, {
            record: mapAuditRow(row),
          });
        }
        return result(AUDIT_EVIDENCE_DECISIONS.REPLAY, {
          record: mapAuditRow(row),
        });
      }
      if (error.constraint === 'dlp_audit_event_pkey') {
        return result(AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
      }
    }
    if (isDbFailure(error)) {
      return result(AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE, {
        errorClass: error.code || error.name || 'DB_FAILURE',
      });
    }
    throw error;
  }
}

async function appendEvidenceWork(client, input) {
  await lockIdempotencyKey(client, 'evidence', input.idempotencyKey);

  const existing = await client.query(
    `SELECT *
       FROM dlp_evidence_fact
      WHERE idempotency_key = $1`,
    [input.idempotencyKey],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (!sameEvidenceBinding(row, input)) {
      return result(AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT, {
        record: mapEvidenceRow(row),
      });
    }
    return result(AUDIT_EVIDENCE_DECISIONS.REPLAY, {
      record: mapEvidenceRow(row),
    });
  }

  try {
    const inserted = await client.query(
      `INSERT INTO dlp_evidence_fact (
          evidence_id, task_id, actor_id, governance_revision,
          evidence_type, evidence_ref, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
      [
        input.evidenceId,
        input.taskId,
        input.actorId,
        input.governanceRevision,
        input.evidenceType,
        input.evidenceRef,
        input.idempotencyKey,
      ],
    );
    return result(AUDIT_EVIDENCE_DECISIONS.APPENDED, {
      record: mapEvidenceRow(inserted.rows[0]),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await client.query(
        `SELECT *
           FROM dlp_evidence_fact
          WHERE idempotency_key = $1`,
        [input.idempotencyKey],
      );
      if (raced.rows[0]) {
        const row = raced.rows[0];
        if (!sameEvidenceBinding(row, input)) {
          return result(AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT, {
            record: mapEvidenceRow(row),
          });
        }
        return result(AUDIT_EVIDENCE_DECISIONS.REPLAY, {
          record: mapEvidenceRow(row),
        });
      }
      if (error.constraint === 'dlp_evidence_fact_pkey') {
        return result(AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
      }
    }
    if (isDbFailure(error)) {
      return result(AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE, {
        errorClass: error.code || error.name || 'DB_FAILURE',
      });
    }
    throw error;
  }
}

/**
 * Append one Audit event inside a verified caller-owned transaction.
 * Never issues BEGIN/COMMIT/ROLLBACK.
 */
export async function appendAuditEventInTransaction(client, input) {
  requireClient(client);
  if (!validateAuditInput(input)) {
    return result(AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (governanceDenied(input.governanceRevision)) {
    return result(AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  try {
    await assertOwnedWriteLeaseTransaction(client);
    return await appendAuditWork(client, input);
  } catch (error) {
    const mapped = mapOwnershipOrDbFailure(error);
    if (mapped) return mapped;
    throw error;
  }
}

/**
 * Append one Evidence fact inside a verified caller-owned transaction.
 * Never issues BEGIN/COMMIT/ROLLBACK.
 */
export async function appendEvidenceInTransaction(client, input) {
  requireClient(client);
  if (!validateEvidenceInput(input)) {
    return result(AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (governanceDenied(input.governanceRevision)) {
    return result(AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  try {
    await assertOwnedWriteLeaseTransaction(client);
    return await appendEvidenceWork(client, input);
  } catch (error) {
    const mapped = mapOwnershipOrDbFailure(error);
    if (mapped) return mapped;
    throw error;
  }
}

/**
 * List audit events for a task ordered by database-issued ord ASC.
 * Does NOT claim that ord equals transaction commit order across sessions.
 */
export async function listAuditEventsByTask(client, taskId) {
  requireClient(client);
  if (!isNonEmptyString(taskId)) {
    return freezeDeep({ ok: false, decision: AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_INPUT, records: [] });
  }
  try {
    const res = await client.query(
      `SELECT *
         FROM dlp_audit_event
        WHERE task_id = $1
        ORDER BY ord ASC`,
      [taskId],
    );
    return freezeDeep({
      ok: true,
      decision: 'LISTED',
      records: res.rows.map(mapAuditRow),
      orderingNote: 'ORDER_BY_DATABASE_ISSUED_ORD_NOT_COMMIT_ORDER_PROOF',
    });
  } catch (error) {
    if (isDbFailure(error)) {
      return freezeDeep({
        ok: false,
        decision: AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE,
        records: [],
      });
    }
    throw error;
  }
}

/**
 * List evidence facts for a task ordered by database-issued ord ASC.
 * Does NOT claim that ord equals transaction commit order across sessions.
 */
export async function listEvidenceByTask(client, taskId) {
  requireClient(client);
  if (!isNonEmptyString(taskId)) {
    return freezeDeep({ ok: false, decision: AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_INPUT, records: [] });
  }
  try {
    const res = await client.query(
      `SELECT *
         FROM dlp_evidence_fact
        WHERE task_id = $1
        ORDER BY ord ASC`,
      [taskId],
    );
    return freezeDeep({
      ok: true,
      decision: 'LISTED',
      records: res.rows.map(mapEvidenceRow),
      orderingNote: 'ORDER_BY_DATABASE_ISSUED_ORD_NOT_COMMIT_ORDER_PROOF',
    });
  } catch (error) {
    if (isDbFailure(error)) {
      return freezeDeep({
        ok: false,
        decision: AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE,
        records: [],
      });
    }
    throw error;
  }
}
