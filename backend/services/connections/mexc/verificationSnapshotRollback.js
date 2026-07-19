/**
 * Pre-probe snapshot + append-only verification history + transactional rollback.
 * Never deletes verification-history rows.
 * Never deletes the Connection.
 * Never alters encrypted credentials.
 */

import crypto from 'crypto';
import { query, getClient } from '../../../database/db.js';
import { CANONICAL_PROVIDER } from '../../exchangeConnectionService.js';

export const SNAPSHOT_KIND = Object.freeze({
  PRE_PROBE: 'pre_probe',
});

export const VERIFICATION_RUN_STATUS = Object.freeze({
  PLANNED: 'planned',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back',
  SUPERSEDED: 'superseded',
});

/**
 * Capture current safe state snapshot before any future real probe.
 */
export async function capturePreProbeSnapshot({
  connectionId,
  ownerId,
  correlationId = null,
  authState = null,
  providerAvailability = null,
  lastVerifiedAt = null,
  lastSafeFailure = null,
} = {}) {
  if (!connectionId || !ownerId) {
    throw new Error('connectionId and ownerId required for snapshot');
  }

  const { rows: capRows } = await query(
    `SELECT capability_id, provider_support, key_grant, verification_state, operational_state,
            last_verified_at, last_failure_code, sanitized_reason, source_of_evidence
     FROM mexc_connection_capability_state
     WHERE connection_id = $1 AND owner_id = $2
     ORDER BY capability_id`,
    [connectionId, ownerId],
  );

  const snapshotPayload = {
    kind: SNAPSHOT_KIND.PRE_PROBE,
    capturedAt: new Date().toISOString(),
    authState,
    providerAvailability,
    lastVerifiedAt,
    lastSafeFailure,
    capabilityStates: capRows.map((r) => ({
      capabilityId: r.capability_id,
      providerSupport: r.provider_support,
      keyGrant: r.key_grant,
      verificationState: r.verification_state,
      operationalState: r.operational_state,
      lastVerifiedAt: r.last_verified_at,
      lastFailureCode: r.last_failure_code,
      sanitizedReason: r.sanitized_reason,
      sourceOfEvidence: r.source_of_evidence,
    })),
  };

  const corr = correlationId || crypto.randomUUID();

  const { rows } = await query(
    `INSERT INTO mexc_capability_state_snapshots (
       connection_id, owner_id, correlation_id, kind, snapshot_json
     ) VALUES ($1,$2,$3,$4,$5::jsonb)
     RETURNING id, correlation_id, created_at`,
    [connectionId, ownerId, corr, SNAPSHOT_KIND.PRE_PROBE, JSON.stringify(snapshotPayload)],
  );

  await query(
    `INSERT INTO mexc_capability_verification_runs (
       connection_id, owner_id, correlation_id, snapshot_id, status, notes
     ) VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      connectionId,
      ownerId,
      corr,
      rows[0].id,
      VERIFICATION_RUN_STATUS.PLANNED,
      'Pre-probe snapshot captured; real probes not started',
    ],
  );

  return {
    snapshotId: rows[0].id,
    correlationId: corr,
    createdAt: rows[0].created_at,
    capabilityCount: capRows.length,
    provider: CANONICAL_PROVIDER,
  };
}

/**
 * Append-only verification history insert (never UPDATE/DELETE history rows).
 */
export async function appendVerificationHistoryRow({
  connectionId,
  ownerId,
  capabilityId,
  probeId,
  correlationId,
  keyGrant,
  verificationState,
  lastFailureCode,
  sanitizedReason,
  sourceOfEvidence = 'orchestrator_probe',
  latencyMs,
  testedAt,
  runStatus = null,
} = {}) {
  await query(
    `INSERT INTO mexc_capability_verifications (
       connection_id, owner_id, capability_id, probe_id, correlation_id,
       key_grant, verification_state,
       last_failure_code, sanitized_reason, source_of_evidence, latency_ms, tested_at,
       run_status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13)`,
    [
      connectionId,
      ownerId,
      capabilityId,
      probeId,
      correlationId,
      keyGrant,
      verificationState,
      lastFailureCode,
      sanitizedReason,
      sourceOfEvidence,
      latencyMs,
      testedAt || new Date().toISOString(),
      runStatus,
    ],
  );
}

/**
 * Transactional rollback to a prior snapshot.
 * - Restores capability-state rows
 * - Marks verification run rolled_back / superseded
 * - Retains sanitized audit evidence (append-only history never deleted)
 * - Never deletes Connection or alters encrypted credentials
 */
export async function rollbackToCapabilitySnapshot({
  connectionId,
  ownerId,
  snapshotId,
  correlationId = null,
  markSupersededCorrelationIds = [],
} = {}) {
  if (!connectionId || !ownerId || !snapshotId) {
    throw new Error('connectionId, ownerId, snapshotId required');
  }

  const client = typeof getClient === 'function' ? await getClient() : null;
  const run = async (sql, params) => {
    if (client) return client.query(sql, params);
    return query(sql, params);
  };

  try {
    if (client) await client.query('BEGIN');

    const { rows: snapRows } = await run(
      `SELECT id, correlation_id, snapshot_json
       FROM mexc_capability_state_snapshots
       WHERE id = $1 AND connection_id = $2 AND owner_id = $3
       FOR UPDATE`,
      [snapshotId, connectionId, ownerId],
    );
    if (!snapRows.length) {
      throw new Error('Snapshot not found for connection/owner');
    }

    const payload = typeof snapRows[0].snapshot_json === 'string'
      ? JSON.parse(snapRows[0].snapshot_json)
      : snapRows[0].snapshot_json;

    const states = Array.isArray(payload?.capabilityStates) ? payload.capabilityStates : [];

    for (const s of states) {
      await run(
        `INSERT INTO mexc_connection_capability_state (
           connection_id, owner_id, capability_id, provider_support, key_grant, verification_state,
           operational_state, last_verified_at, last_failure_code, sanitized_reason, source_of_evidence, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10,$11,NOW())
         ON CONFLICT (connection_id, capability_id) DO UPDATE SET
           provider_support = EXCLUDED.provider_support,
           key_grant = EXCLUDED.key_grant,
           verification_state = EXCLUDED.verification_state,
           operational_state = EXCLUDED.operational_state,
           last_verified_at = EXCLUDED.last_verified_at,
           last_failure_code = EXCLUDED.last_failure_code,
           sanitized_reason = EXCLUDED.sanitized_reason,
           source_of_evidence = EXCLUDED.source_of_evidence,
           updated_at = NOW()`,
        [
          connectionId,
          ownerId,
          s.capabilityId,
          s.providerSupport,
          s.keyGrant,
          s.verificationState,
          s.operationalState,
          s.lastVerifiedAt,
          s.lastFailureCode,
          s.sanitizedReason,
          s.sourceOfEvidence,
        ],
      );
    }

    const corr = correlationId || snapRows[0].correlation_id || crypto.randomUUID();

    await run(
      `UPDATE mexc_capability_verification_runs
       SET status = $1, updated_at = NOW(), notes = COALESCE(notes,'') || ' | rolled_back'
       WHERE connection_id = $2 AND owner_id = $3 AND snapshot_id = $4`,
      [VERIFICATION_RUN_STATUS.ROLLED_BACK, connectionId, ownerId, snapshotId],
    );

    for (const sid of markSupersededCorrelationIds) {
      await run(
        `UPDATE mexc_capability_verification_runs
         SET status = $1, updated_at = NOW()
         WHERE connection_id = $2 AND owner_id = $3 AND correlation_id = $4`,
        [VERIFICATION_RUN_STATUS.SUPERSEDED, connectionId, ownerId, sid],
      );
    }

    // Append-only audit evidence of rollback — never delete history
    await run(
      `INSERT INTO mexc_capability_verifications (
         connection_id, owner_id, capability_id, probe_id, correlation_id,
         verification_state, sanitized_reason, source_of_evidence, tested_at, run_status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9)`,
      [
        connectionId,
        ownerId,
        'ROLLBACK',
        'capability_snapshot_rollback',
        corr,
        'rolled_back',
        'Capability state restored from pre-probe snapshot; history retained',
        'rollback_service',
        VERIFICATION_RUN_STATUS.ROLLED_BACK,
      ],
    );

    if (client) await client.query('COMMIT');

    return {
      success: true,
      snapshotId,
      correlationId: corr,
      restoredCapabilities: states.length,
      connectionDeleted: false,
      credentialsAltered: false,
      historyDeleted: false,
    };
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    if (client) client.release?.();
  }
}

/**
 * Simulate failed persistence for tests — ensures rollback path is exercised.
 */
export async function persistCapabilityResultsWithRollbackGuard({
  connectionId,
  ownerId,
  correlationId,
  results,
  snapshotId,
  shouldFail = false,
} = {}) {
  const captured = snapshotId
    ? { snapshotId, correlationId }
    : await capturePreProbeSnapshot({ connectionId, ownerId, correlationId });

  try {
    if (shouldFail) {
      throw new Error('SIMULATED_PERSISTENCE_FAILURE');
    }
    for (const result of results || []) {
      await appendVerificationHistoryRow({
        connectionId,
        ownerId,
        capabilityId: result.capabilityId,
        probeId: result.probeId,
        correlationId: captured.correlationId,
        keyGrant: result.keyGrant,
        verificationState: result.verificationState,
        lastFailureCode: result.code,
        sanitizedReason: result.sanitizedReason,
        latencyMs: result.latencyMs,
        testedAt: result.testedAt,
        runStatus: VERIFICATION_RUN_STATUS.SUCCEEDED,
      });
    }
    return { success: true, ...captured, rolledBack: false };
  } catch (err) {
    const rb = await rollbackToCapabilitySnapshot({
      connectionId,
      ownerId,
      snapshotId: captured.snapshotId,
      correlationId: captured.correlationId,
    });
    return {
      success: false,
      error: err.message,
      rolledBack: true,
      rollback: rb,
      ...captured,
    };
  }
}
