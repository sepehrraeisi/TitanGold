/**
 * TECP-DLP-001 disposable WRITE lease repository + TECP-DLP-002 caller-owned
 * in-transaction mutation entry points.
 *
 * NON_OPERATIONAL proof only. Caller-supplied actor identity is NOT authenticated.
 * Injected PostgreSQL client required. No generic SQL runner. No network listener.
 *
 * Public acquire/renew/release still self-manage transactions (unchanged behavior).
 * In-transaction APIs never issue BEGIN/COMMIT/ROLLBACK and require an owned txn.
 */

export const APPROVED_GOVERNANCE_REVISION = 'DLP001_REACTIVATION_20261031';

/** Transaction-local GUC proving caller-owned TECP lease transaction boundary. */
export const WRITE_LEASE_TXN_OWNER_GUC = 'tecp.dlp_write_lease_txn_owner';
export const WRITE_LEASE_TXN_OWNER_TOKEN = 'TECP_DLP_WRITE_LEASE_TXN_OWNER_V1';

export const WRITE_LEASE_DECISIONS = Object.freeze({
  GRANTED: 'GRANTED',
  RENEWED: 'RENEWED',
  RELEASED: 'RELEASED',
  VALID: 'VALID',
  REPLAY: 'REPLAY',
  DENY_OWNED: 'DENY_OWNED',
  DENY_IDEMPOTENCY_CONFLICT: 'DENY_IDEMPOTENCY_CONFLICT',
  DENY_STALE_FENCING_EPOCH: 'DENY_STALE_FENCING_EPOCH',
  DENY_FOREIGN_ACTOR: 'DENY_FOREIGN_ACTOR',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_VERSION_MISMATCH: 'DENY_VERSION_MISMATCH',
  DENY_INVALID_GOVERNANCE_REVISION: 'DENY_INVALID_GOVERNANCE_REVISION',
  DENY_NOT_FOUND: 'DENY_NOT_FOUND',
  DENY_INVALID_INPUT: 'DENY_INVALID_INPUT',
  DENY_RELEASED: 'DENY_RELEASED',
  DENY_BINDING_MISMATCH: 'DENY_BINDING_MISMATCH',
  DENY_NO_TRANSACTION_OWNERSHIP: 'DENY_NO_TRANSACTION_OWNERSHIP',
  DENY_CLIENT_NOT_IDLE: 'DENY_CLIENT_NOT_IDLE',
  DENY_TRANSACTION_STATUS_UNVERIFIABLE: 'DENY_TRANSACTION_STATUS_UNVERIFIABLE',
  BLOCKED_DB_FAILURE: 'BLOCKED_DB_FAILURE',
});

/** PostgreSQL ReadyForQuery transaction-status bytes (protocol-backed). */
export const PG_READY_FOR_QUERY_STATUS = Object.freeze({
  IDLE: 'I',
  IN_TRANSACTION: 'T',
  IN_FAILED_TRANSACTION: 'E',
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

function toInt(value) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(value);
  return value;
}

function result(decision, extra = {}) {
  const ok = decision === WRITE_LEASE_DECISIONS.GRANTED
    || decision === WRITE_LEASE_DECISIONS.RENEWED
    || decision === WRITE_LEASE_DECISIONS.RELEASED
    || decision === WRITE_LEASE_DECISIONS.VALID
    || decision === WRITE_LEASE_DECISIONS.REPLAY;
  return freezeDeep({
    ok,
    decision,
    reasons: ok ? [] : [decision],
    lease: null,
    operational: false,
    ...extra,
  });
}

function mapLease(row) {
  if (!row) return null;
  return freezeDeep({
    resourceType: row.resource_type,
    resourceKey: row.resource_key,
    leaseKey: row.lease_key,
    actorId: row.actor_id,
    taskId: row.task_id,
    governanceRevision: row.governance_revision,
    fencingEpoch: toInt(row.fencing_epoch),
    version: toInt(row.version),
    status: row.status,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    renewedAt: row.renewed_at ?? null,
    releasedAt: row.released_at ?? null,
  });
}

function requireClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('injected PostgreSQL client with query() is required');
  }
}

function validateAcquireInput(input) {
  if (!input || typeof input !== 'object') return false;
  return isNonEmptyString(input.resourceType)
    && isNonEmptyString(input.resourceKey)
    && isNonEmptyString(input.leaseKey)
    && isNonEmptyString(input.actorId)
    && isNonEmptyString(input.taskId)
    && isNonEmptyString(input.governanceRevision)
    && isNonEmptyString(input.idempotencyKey)
    && isPositiveSafeInt(input.ttlMs);
}

function validateMutationInput(input, requireExpectedVersion) {
  if (!input || typeof input !== 'object') return false;
  if (!(isNonEmptyString(input.resourceType)
    && isNonEmptyString(input.resourceKey)
    && isNonEmptyString(input.leaseKey)
    && isNonEmptyString(input.actorId)
    && isNonEmptyString(input.taskId)
    && isNonEmptyString(input.governanceRevision)
    && isPositiveSafeInt(input.fencingEpoch))) {
    return false;
  }
  if (requireExpectedVersion && !isPositiveSafeInt(input.expectedVersion)) return false;
  if (input.ttlMs !== undefined && !isPositiveSafeInt(input.ttlMs)) return false;
  return true;
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

function uniqueViolationConstraint(error) {
  return String(error.constraint || error.table || error.detail || '');
}

function governanceDenied(governanceRevision) {
  return governanceRevision !== APPROVED_GOVERNANCE_REVISION;
}

function bindingMismatch(row, input) {
  return row.lease_key !== input.leaseKey
    || row.actor_id !== input.actorId
    || row.task_id !== input.taskId
    || row.governance_revision !== input.governanceRevision
    || toInt(row.fencing_epoch) !== input.fencingEpoch;
}

function sameIdempotencyBinding(row, input) {
  return row.resource_type === input.resourceType
    && row.resource_key === input.resourceKey
    && row.actor_id === input.actorId
    && row.task_id === input.taskId
    && row.governance_revision === input.governanceRevision
    && row.lease_key === input.leaseKey;
}

/**
 * Mark the current PostgreSQL transaction as TECP lease-transaction owned.
 * Must be called only after BEGIN. Setting is transaction-local (is_local=true).
 */
async function markOwnedTransaction(client) {
  await client.query(
    'SELECT set_config($1, $2, true)',
    [WRITE_LEASE_TXN_OWNER_GUC, WRITE_LEASE_TXN_OWNER_TOKEN],
  );
}

/**
 * Verify the injected client is inside an authorized TECP-owned transaction.
 * Never trusts a bare client merely because query() exists.
 */
export async function assertOwnedWriteLeaseTransaction(client) {
  requireClient(client);
  let row;
  try {
    const res = await client.query(
      'SELECT current_setting($1, true) AS owner',
      [WRITE_LEASE_TXN_OWNER_GUC],
    );
    row = res.rows[0];
  } catch (error) {
    if (isDbFailure(error)) {
      const blocked = new Error('BLOCKED_DB_FAILURE');
      blocked.code = error.code || 'DB_FAILURE';
      blocked.cause = error;
      throw blocked;
    }
    throw error;
  }
  if (!row || row.owner !== WRITE_LEASE_TXN_OWNER_TOKEN) {
    const err = new Error(WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP);
    err.code = WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP;
    throw err;
  }
}

function transactionBoundaryError(code, details = {}) {
  const err = new Error(code);
  err.code = code;
  Object.assign(err, details);
  return err;
}

/**
 * Read PostgreSQL transaction-block status from the wire ReadyForQuery message.
 *
 * pg@8.16.3 does not expose getTransactionStatus(). The pure-JS driver still
 * parses ReadyForQuery status ('I' | 'T' | 'E') on client.connection. This probe
 * issues a read-only SELECT and captures that protocol status. Missing connection
 * surface or non-I/T/E status fails closed as unverifiable.
 */
export async function readPgReadyForQueryStatus(client) {
  requireClient(client);
  const con = client.connection;
  if (!con || typeof con.on !== 'function' || typeof con.removeListener !== 'function') {
    throw transactionBoundaryError(
      WRITE_LEASE_DECISIONS.DENY_TRANSACTION_STATUS_UNVERIFIABLE,
      { reason: 'missing_connection_readyForQuery_surface' },
    );
  }

  let statusFromEvent = null;
  const onReady = (msg) => {
    if (msg && typeof msg.status === 'string') {
      statusFromEvent = msg.status;
    }
  };
  con.on('readyForQuery', onReady);
  try {
    try {
      await client.query('SELECT 1 AS tecp_dlp_txn_status_probe');
    } catch (error) {
      if (statusFromEvent === PG_READY_FOR_QUERY_STATUS.IN_FAILED_TRANSACTION
        || error.code === '25P02') {
        return PG_READY_FOR_QUERY_STATUS.IN_FAILED_TRANSACTION;
      }
      // Preserve original driver errors so public API fail-closed mapping still works.
      if (isDbFailure(error)) {
        throw error;
      }
      if (statusFromEvent === PG_READY_FOR_QUERY_STATUS.IDLE
        || statusFromEvent === PG_READY_FOR_QUERY_STATUS.IN_TRANSACTION
        || statusFromEvent === PG_READY_FOR_QUERY_STATUS.IN_FAILED_TRANSACTION) {
        return statusFromEvent;
      }
      throw transactionBoundaryError(
        WRITE_LEASE_DECISIONS.DENY_TRANSACTION_STATUS_UNVERIFIABLE,
        {
          reason: 'probe_failed_without_protocol_status',
          causeMessage: String(error.message || error),
        },
      );
    }
  } finally {
    con.removeListener('readyForQuery', onReady);
  }

  if (statusFromEvent !== PG_READY_FOR_QUERY_STATUS.IDLE
    && statusFromEvent !== PG_READY_FOR_QUERY_STATUS.IN_TRANSACTION
    && statusFromEvent !== PG_READY_FOR_QUERY_STATUS.IN_FAILED_TRANSACTION) {
    throw transactionBoundaryError(
      WRITE_LEASE_DECISIONS.DENY_TRANSACTION_STATUS_UNVERIFIABLE,
      { reason: 'missing_or_unknown_readyForQuery_status', status: statusFromEvent },
    );
  }
  return statusFromEvent;
}

/**
 * Proven fallback for query-only injected clients that lack client.connection
 * ReadyForQuery surface (pg@8.16.3 pure-JS Client exposes connection; thin test
 * wrappers may not). Empirically on PostgreSQL 14.24 + pg 8.16.3:
 * - idle → SQLSTATE 25P01
 * - open txn → SAVEPOINT succeeds (then RELEASE probe only)
 * - aborted txn → SQLSTATE 25P02
 * Never COMMIT/ROLLBACK the caller's transaction.
 */
async function assertIdleViaSavepointProbe(client) {
  try {
    await client.query('SAVEPOINT tecp_dlp_write_lease_idle_probe');
  } catch (error) {
    if (error && error.code === '25P01') {
      return;
    }
    if (error && error.code === '25P02') {
      throw transactionBoundaryError(WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE, {
        transactionStatus: PG_READY_FOR_QUERY_STATUS.IN_FAILED_TRANSACTION,
        reason: 'aborted_or_failed_transaction_block',
        probe: 'savepoint',
      });
    }
    if (isDbFailure(error)) {
      throw error;
    }
    throw transactionBoundaryError(
      WRITE_LEASE_DECISIONS.DENY_TRANSACTION_STATUS_UNVERIFIABLE,
      {
        reason: 'savepoint_probe_failed',
        causeMessage: String(error && error.message || error),
        causeCode: error && error.code,
      },
    );
  }

  try {
    await client.query('RELEASE SAVEPOINT tecp_dlp_write_lease_idle_probe');
  } catch (error) {
    throw transactionBoundaryError(WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE, {
      transactionStatus: PG_READY_FOR_QUERY_STATUS.IN_TRANSACTION,
      reason: 'open_transaction_block_release_failed',
      probe: 'savepoint',
      causeMessage: String(error && error.message || error),
    });
  }

  throw transactionBoundaryError(WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE, {
    transactionStatus: PG_READY_FOR_QUERY_STATUS.IN_TRANSACTION,
    reason: 'open_transaction_block',
    probe: 'savepoint',
  });
}

/**
 * Fail closed unless the injected connection is idle.
 * Prefers protocol ReadyForQuery status via client.connection (pg@8.16.3).
 * Falls back to the proven SAVEPOINT probe only when that surface is absent.
 * Does not BEGIN, COMMIT, or ROLLBACK a caller-owned transaction.
 */
export async function assertClientIdleForOwnedWriteLeaseTransaction(client) {
  requireClient(client);
  const con = client.connection;
  if (con && typeof con.on === 'function' && typeof con.removeListener === 'function') {
    const status = await readPgReadyForQueryStatus(client);
    if (status !== PG_READY_FOR_QUERY_STATUS.IDLE) {
      throw transactionBoundaryError(WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE, {
        transactionStatus: status,
        reason: status === PG_READY_FOR_QUERY_STATUS.IN_FAILED_TRANSACTION
          ? 'aborted_or_failed_transaction_block'
          : 'open_transaction_block',
        probe: 'readyForQuery',
      });
    }
    return;
  }
  await assertIdleViaSavepointProbe(client);
}

/**
 * Caller-owned transaction helper for composition. Sets ownership GUC after BEGIN.
 * In-transaction lease APIs refuse to run without this ownership mark.
 *
 * Refuses to BEGIN unless ReadyForQuery status is idle ('I'), preventing nested
 * COMMIT from finalizing an unrelated outer transaction.
 */
export async function withOwnedWriteLeaseTransaction(client, work) {
  requireClient(client);
  // Probe first: never BEGIN/COMMIT/ROLLBACK when not verifiably idle.
  await assertClientIdleForOwnedWriteLeaseTransaction(client);

  await client.query('BEGIN');
  try {
    await markOwnedTransaction(client);
    const value = await work();
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // fail closed; original error wins
    }
    throw error;
  }
}

async function withTransaction(client, work) {
  return withOwnedWriteLeaseTransaction(client, work);
}

/**
 * Replay is usable only when the original grant is still the current ACTIVE,
 * unexpired owner for the same lease_key and fencing_epoch.
 */
async function resolveIdempotentReplay(client, input, idemRow) {
  const leaseRes = await client.query(
    `SELECT
        l.*,
        (l.status = 'ACTIVE'
          AND l.expires_at > clock_timestamp()
          AND l.lease_key = $3
          AND l.fencing_epoch = $4
          AND l.actor_id = $5
          AND l.task_id = $6
          AND l.governance_revision = $7) AS replayable,
        (l.expires_at > clock_timestamp()) AS unexpired
       FROM dlp_write_lease l
      WHERE l.resource_type = $1
        AND l.resource_key = $2
      FOR UPDATE`,
    [
      input.resourceType,
      input.resourceKey,
      idemRow.lease_key,
      idemRow.fencing_epoch,
      idemRow.actor_id,
      idemRow.task_id,
      idemRow.governance_revision,
    ],
  );

  if (leaseRes.rowCount !== 1) {
    return result(WRITE_LEASE_DECISIONS.DENY_NOT_FOUND);
  }

  const row = leaseRes.rows[0];
  if (row.replayable === true) {
    return result(WRITE_LEASE_DECISIONS.REPLAY, { lease: mapLease(row) });
  }
  if (row.status === 'RELEASED') {
    return result(WRITE_LEASE_DECISIONS.DENY_RELEASED, { lease: mapLease(row) });
  }
  if (toInt(row.fencing_epoch) !== toInt(idemRow.fencing_epoch)
    || row.lease_key !== idemRow.lease_key) {
    return result(WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH, { lease: mapLease(row) });
  }
  if (row.unexpired !== true) {
    return result(WRITE_LEASE_DECISIONS.DENY_EXPIRED, { lease: mapLease(row) });
  }
  if (row.actor_id !== idemRow.actor_id) {
    return result(WRITE_LEASE_DECISIONS.DENY_FOREIGN_ACTOR, { lease: mapLease(row) });
  }
  return result(WRITE_LEASE_DECISIONS.DENY_BINDING_MISMATCH, { lease: mapLease(row) });
}

/**
 * Shared acquire algorithm. Caller must already own the transaction.
 * Does not BEGIN/COMMIT/ROLLBACK.
 */
async function acquireWriteLeaseWork(client, input) {
  // Serialize all acquires that share this idempotency key.
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
    [input.idempotencyKey],
  );

  const existingIdem = await client.query(
    `SELECT *
       FROM dlp_write_acquire_idempotency
      WHERE idempotency_key = $1
      FOR UPDATE`,
    [input.idempotencyKey],
  );
  if (existingIdem.rowCount === 1) {
    const row = existingIdem.rows[0];
    if (!sameIdempotencyBinding(row, input)) {
      return result(WRITE_LEASE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    }
    return resolveIdempotentReplay(client, input, row);
  }

  await client.query(
    `INSERT INTO dlp_write_resource_fence (resource_type, resource_key, fencing_epoch)
     VALUES ($1, $2, 0)
     ON CONFLICT (resource_type, resource_key) DO NOTHING`,
    [input.resourceType, input.resourceKey],
  );

  await client.query(
    `SELECT fencing_epoch
       FROM dlp_write_resource_fence
      WHERE resource_type = $1 AND resource_key = $2
      FOR UPDATE`,
    [input.resourceType, input.resourceKey],
  );

  const current = await client.query(
    `SELECT
        *,
        (status = 'ACTIVE' AND expires_at > clock_timestamp()) AS usable
       FROM dlp_write_lease
      WHERE resource_type = $1 AND resource_key = $2
      FOR UPDATE`,
    [input.resourceType, input.resourceKey],
  );

  if (current.rowCount === 1 && current.rows[0].usable === true) {
    return result(WRITE_LEASE_DECISIONS.DENY_OWNED, {
      lease: mapLease(current.rows[0]),
    });
  }

  const epochRes = await client.query(
    `UPDATE dlp_write_resource_fence
        SET fencing_epoch = fencing_epoch + 1
      WHERE resource_type = $1 AND resource_key = $2
      RETURNING fencing_epoch`,
    [input.resourceType, input.resourceKey],
  );
  const fencingEpoch = toInt(epochRes.rows[0].fencing_epoch);

  const leaseRes = await client.query(
    `INSERT INTO dlp_write_lease (
        resource_type, resource_key, lease_key, actor_id, task_id,
        governance_revision, fencing_epoch, version, status,
        granted_at, expires_at, renewed_at, released_at
     ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, 1, 'ACTIVE',
        clock_timestamp(),
        clock_timestamp() + ($8::bigint * INTERVAL '1 millisecond'),
        NULL, NULL
     )
     ON CONFLICT (resource_type, resource_key) DO UPDATE
       SET lease_key = EXCLUDED.lease_key,
           actor_id = EXCLUDED.actor_id,
           task_id = EXCLUDED.task_id,
           governance_revision = EXCLUDED.governance_revision,
           fencing_epoch = EXCLUDED.fencing_epoch,
           version = 1,
           status = 'ACTIVE',
           granted_at = clock_timestamp(),
           expires_at = clock_timestamp() + ($8::bigint * INTERVAL '1 millisecond'),
           renewed_at = NULL,
           released_at = NULL
     RETURNING *`,
    [
      input.resourceType,
      input.resourceKey,
      input.leaseKey,
      input.actorId,
      input.taskId,
      input.governanceRevision,
      fencingEpoch,
      input.ttlMs,
    ],
  );

  const lease = mapLease(leaseRes.rows[0]);

  // Unique violations must throw so the owning transaction ROLLBACKs the lease
  // upsert and fencing increment. Outer catch maps 23505 → DENY.
  await client.query(
    `INSERT INTO dlp_write_acquire_idempotency (
        idempotency_key, resource_type, resource_key, actor_id, task_id,
        governance_revision, lease_key, fencing_epoch, version, decision, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.idempotencyKey,
      lease.resourceType,
      lease.resourceKey,
      lease.actorId,
      lease.taskId,
      lease.governanceRevision,
      lease.leaseKey,
      lease.fencingEpoch,
      lease.version,
      WRITE_LEASE_DECISIONS.GRANTED,
      lease.expiresAt,
    ],
  );

  return result(WRITE_LEASE_DECISIONS.GRANTED, { lease });
}

async function renewWriteLeaseWork(client, input) {
  const current = await client.query(
    `SELECT
        *,
        (expires_at > clock_timestamp()) AS unexpired
       FROM dlp_write_lease
      WHERE resource_type = $1 AND resource_key = $2
      FOR UPDATE`,
    [input.resourceType, input.resourceKey],
  );
  if (current.rowCount !== 1) {
    return result(WRITE_LEASE_DECISIONS.DENY_NOT_FOUND);
  }
  const row = current.rows[0];
  if (row.status === 'RELEASED') {
    return result(WRITE_LEASE_DECISIONS.DENY_RELEASED, { lease: mapLease(row) });
  }
  if (toInt(row.fencing_epoch) !== input.fencingEpoch) {
    return result(WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH, { lease: mapLease(row) });
  }
  if (row.actor_id !== input.actorId) {
    return result(WRITE_LEASE_DECISIONS.DENY_FOREIGN_ACTOR, { lease: mapLease(row) });
  }
  if (bindingMismatch(row, input)) {
    return result(WRITE_LEASE_DECISIONS.DENY_BINDING_MISMATCH, { lease: mapLease(row) });
  }
  if (row.unexpired !== true) {
    return result(WRITE_LEASE_DECISIONS.DENY_EXPIRED, { lease: mapLease(row) });
  }
  if (toInt(row.version) !== input.expectedVersion) {
    return result(WRITE_LEASE_DECISIONS.DENY_VERSION_MISMATCH, { lease: mapLease(row) });
  }

  const updated = await client.query(
    `UPDATE dlp_write_lease
        SET expires_at = clock_timestamp() + ($1::bigint * INTERVAL '1 millisecond'),
            renewed_at = clock_timestamp(),
            version = version + 1
      WHERE resource_type = $2
        AND resource_key = $3
        AND version = $4
        AND fencing_epoch = $5
        AND actor_id = $6
        AND task_id = $7
        AND lease_key = $8
        AND governance_revision = $9
        AND status = 'ACTIVE'
        AND expires_at > clock_timestamp()
      RETURNING *`,
    [
      input.ttlMs,
      input.resourceType,
      input.resourceKey,
      input.expectedVersion,
      input.fencingEpoch,
      input.actorId,
      input.taskId,
      input.leaseKey,
      input.governanceRevision,
    ],
  );
  if (updated.rowCount !== 1) {
    return result(WRITE_LEASE_DECISIONS.DENY_VERSION_MISMATCH);
  }
  return result(WRITE_LEASE_DECISIONS.RENEWED, { lease: mapLease(updated.rows[0]) });
}

async function releaseWriteLeaseWork(client, input) {
  const current = await client.query(
    `SELECT
        *,
        (expires_at > clock_timestamp()) AS unexpired
       FROM dlp_write_lease
      WHERE resource_type = $1 AND resource_key = $2
      FOR UPDATE`,
    [input.resourceType, input.resourceKey],
  );
  if (current.rowCount !== 1) {
    return result(WRITE_LEASE_DECISIONS.DENY_NOT_FOUND);
  }
  const row = current.rows[0];
  if (row.status === 'RELEASED') {
    return result(WRITE_LEASE_DECISIONS.DENY_RELEASED, { lease: mapLease(row) });
  }
  if (toInt(row.fencing_epoch) !== input.fencingEpoch) {
    return result(WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH, { lease: mapLease(row) });
  }
  if (row.actor_id !== input.actorId) {
    return result(WRITE_LEASE_DECISIONS.DENY_FOREIGN_ACTOR, { lease: mapLease(row) });
  }
  if (bindingMismatch(row, input)) {
    return result(WRITE_LEASE_DECISIONS.DENY_BINDING_MISMATCH, { lease: mapLease(row) });
  }
  if (row.unexpired !== true) {
    return result(WRITE_LEASE_DECISIONS.DENY_EXPIRED, { lease: mapLease(row) });
  }
  if (toInt(row.version) !== input.expectedVersion) {
    return result(WRITE_LEASE_DECISIONS.DENY_VERSION_MISMATCH, { lease: mapLease(row) });
  }

  const updated = await client.query(
    `UPDATE dlp_write_lease
        SET status = 'RELEASED',
            released_at = clock_timestamp(),
            version = version + 1
      WHERE resource_type = $1
        AND resource_key = $2
        AND version = $3
        AND fencing_epoch = $4
        AND actor_id = $5
        AND task_id = $6
        AND lease_key = $7
        AND governance_revision = $8
        AND status = 'ACTIVE'
        AND expires_at > clock_timestamp()
      RETURNING *`,
    [
      input.resourceType,
      input.resourceKey,
      input.expectedVersion,
      input.fencingEpoch,
      input.actorId,
      input.taskId,
      input.leaseKey,
      input.governanceRevision,
    ],
  );
  if (updated.rowCount !== 1) {
    return result(WRITE_LEASE_DECISIONS.DENY_EXPIRED);
  }
  return result(WRITE_LEASE_DECISIONS.RELEASED, { lease: mapLease(updated.rows[0]) });
}

function mapOwnershipOrDbFailure(error) {
  if (error && error.code === WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP) {
    return result(WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP);
  }
  if (error && error.message === 'BLOCKED_DB_FAILURE') {
    return result(WRITE_LEASE_DECISIONS.BLOCKED_DB_FAILURE, {
      errorClass: error.code || 'DB_FAILURE',
    });
  }
  if (isDbFailure(error)) {
    return result(WRITE_LEASE_DECISIONS.BLOCKED_DB_FAILURE, {
      errorClass: error.code || error.name || 'DB_FAILURE',
    });
  }
  return null;
}

/**
 * Acquire exclusive WRITE ownership inside a verified owned transaction.
 * Never issues BEGIN/COMMIT/ROLLBACK.
 */
export async function acquireWriteLeaseInTransaction(client, input) {
  requireClient(client);
  if (!validateAcquireInput(input)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (governanceDenied(input.governanceRevision)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  try {
    await assertOwnedWriteLeaseTransaction(client);
    return await acquireWriteLeaseWork(client, input);
  } catch (error) {
    const mapped = mapOwnershipOrDbFailure(error);
    if (mapped) return mapped;
    throw error;
  }
}

/**
 * Renew an owned WRITE lease inside a verified owned transaction.
 * Never issues BEGIN/COMMIT/ROLLBACK.
 */
export async function renewWriteLeaseInTransaction(client, input) {
  requireClient(client);
  if (!validateMutationInput(input, true) || !isPositiveSafeInt(input.ttlMs)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (governanceDenied(input.governanceRevision)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  try {
    await assertOwnedWriteLeaseTransaction(client);
    return await renewWriteLeaseWork(client, input);
  } catch (error) {
    const mapped = mapOwnershipOrDbFailure(error);
    if (mapped) return mapped;
    throw error;
  }
}

/**
 * Release an owned WRITE lease inside a verified owned transaction.
 * Never issues BEGIN/COMMIT/ROLLBACK. Fence epoch is retained.
 */
export async function releaseWriteLeaseInTransaction(client, input) {
  requireClient(client);
  if (!validateMutationInput(input, true)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (governanceDenied(input.governanceRevision)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  try {
    await assertOwnedWriteLeaseTransaction(client);
    return await releaseWriteLeaseWork(client, input);
  } catch (error) {
    const mapped = mapOwnershipOrDbFailure(error);
    if (mapped) return mapped;
    throw error;
  }
}

/**
 * Acquire exclusive WRITE ownership for one canonical resource.
 * Self-managing transaction (public API; behavior preserved).
 */
export async function acquireWriteLease(client, input) {
  requireClient(client);
  if (!validateAcquireInput(input)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (governanceDenied(input.governanceRevision)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }

  try {
    return await withTransaction(client, async () => acquireWriteLeaseWork(client, input));
  } catch (error) {
    if (isUniqueViolation(error)
      && /idempotency/i.test(uniqueViolationConstraint(error))) {
      return result(WRITE_LEASE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    }
    if (isDbFailure(error)) {
      return result(WRITE_LEASE_DECISIONS.BLOCKED_DB_FAILURE, {
        errorClass: error.code || error.name || 'DB_FAILURE',
      });
    }
    throw error;
  }
}

/**
 * Renew an owned WRITE lease using CAS expected_version and fencing epoch.
 * Self-managing transaction (public API; behavior preserved).
 */
export async function renewWriteLease(client, input) {
  requireClient(client);
  if (!validateMutationInput(input, true) || !isPositiveSafeInt(input.ttlMs)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (governanceDenied(input.governanceRevision)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }

  try {
    return await withTransaction(client, async () => renewWriteLeaseWork(client, input));
  } catch (error) {
    if (isDbFailure(error)) {
      return result(WRITE_LEASE_DECISIONS.BLOCKED_DB_FAILURE, {
        errorClass: error.code || error.name || 'DB_FAILURE',
      });
    }
    throw error;
  }
}

/**
 * Release an owned WRITE lease. Fence epoch is retained and never resets.
 * Expired leases cannot receive a successful active-owner release.
 * Self-managing transaction (public API; behavior preserved).
 */
export async function releaseWriteLease(client, input) {
  requireClient(client);
  if (!validateMutationInput(input, true)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (governanceDenied(input.governanceRevision)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }

  try {
    return await withTransaction(client, async () => releaseWriteLeaseWork(client, input));
  } catch (error) {
    if (isDbFailure(error)) {
      return result(WRITE_LEASE_DECISIONS.BLOCKED_DB_FAILURE, {
        errorClass: error.code || error.name || 'DB_FAILURE',
      });
    }
    throw error;
  }
}

/**
 * Validate current WRITE ownership without mutating state.
 * Ownership, fencing, binding, status, and expiration are read from one row snapshot.
 */
export async function validateWriteLease(client, input) {
  requireClient(client);
  if (!validateMutationInput(input, false)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (governanceDenied(input.governanceRevision)) {
    return result(WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }

  try {
    const current = await client.query(
      `SELECT
          *,
          (expires_at > clock_timestamp()) AS unexpired
         FROM dlp_write_lease
        WHERE resource_type = $1
          AND resource_key = $2
        FOR SHARE`,
      [input.resourceType, input.resourceKey],
    );
    if (current.rowCount !== 1) {
      return result(WRITE_LEASE_DECISIONS.DENY_NOT_FOUND);
    }
    const row = current.rows[0];
    if (row.status === 'RELEASED') {
      return result(WRITE_LEASE_DECISIONS.DENY_RELEASED, { lease: mapLease(row) });
    }
    if (toInt(row.fencing_epoch) !== input.fencingEpoch) {
      return result(WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH, { lease: mapLease(row) });
    }
    if (row.actor_id !== input.actorId) {
      return result(WRITE_LEASE_DECISIONS.DENY_FOREIGN_ACTOR, { lease: mapLease(row) });
    }
    if (bindingMismatch(row, input)) {
      return result(WRITE_LEASE_DECISIONS.DENY_BINDING_MISMATCH, { lease: mapLease(row) });
    }
    if (row.unexpired !== true) {
      return result(WRITE_LEASE_DECISIONS.DENY_EXPIRED, { lease: mapLease(row) });
    }
    return result(WRITE_LEASE_DECISIONS.VALID, { lease: mapLease(row) });
  } catch (error) {
    if (isDbFailure(error)) {
      return result(WRITE_LEASE_DECISIONS.BLOCKED_DB_FAILURE, {
        errorClass: error.code || error.name || 'DB_FAILURE',
      });
    }
    throw error;
  }
}
