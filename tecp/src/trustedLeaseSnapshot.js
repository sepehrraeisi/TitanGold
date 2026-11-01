/**
 * TECP-DLP-006 disposable trusted lease snapshot reader (offline).
 *
 * Injected TEST_ONLY lease-state boundary. Snapshot authority comes ONLY from
 * objects branded by this module's reader. Caller-supplied lease objects, token
 * fencing claims and JSON reconstructions are NOT trusted lease authority.
 *
 * Authoritative store state is module-private (WeakMap keyed by branded reader).
 * Exported APIs never accept a caller-supplied store or unavailable callback.
 *
 * NON_OPERATIONAL. Not a real database-backed lease reader. Not live ownership.
 */

export const LEASE_SNAPSHOT_KINDS = Object.freeze({
  TEST_ONLY_IN_MEMORY: 'TEST_ONLY_IN_MEMORY',
  // Reserved. Not produced by this disposable proof.
  DATABASE_BACKED: 'DATABASE_BACKED',
});

export const LEASE_SNAPSHOT_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_READER: 'DENY_MISSING_READER',
  DENY_UNBRANDED_READER: 'DENY_UNBRANDED_READER',
  DENY_READER_UNAVAILABLE: 'DENY_READER_UNAVAILABLE',
  DENY_MALFORMED_QUERY: 'DENY_MALFORMED_QUERY',
  DENY_LEASE_NOT_FOUND: 'DENY_LEASE_NOT_FOUND',
  DENY_MALFORMED_SNAPSHOT: 'DENY_MALFORMED_SNAPSHOT',
  DENY_UNBRANDED_SNAPSHOT: 'DENY_UNBRANDED_SNAPSHOT',
  DENY_LEASE_NOT_ACTIVE: 'DENY_LEASE_NOT_ACTIVE',
  DENY_LEASE_EXPIRED: 'DENY_LEASE_EXPIRED',
  DENY_WRONG_TASK: 'DENY_WRONG_TASK',
  DENY_WRONG_RESOURCE: 'DENY_WRONG_RESOURCE',
  DENY_FOREIGN_OWNER: 'DENY_FOREIGN_OWNER',
  DENY_WRONG_LEASE: 'DENY_WRONG_LEASE',
  DENY_STALE_FENCING_EPOCH: 'DENY_STALE_FENCING_EPOCH',
  DENY_INCONSISTENT_SCOPE: 'DENY_INCONSISTENT_SCOPE',
  DENY_INCOMPLETE_MATCH_CONTEXT: 'DENY_INCOMPLETE_MATCH_CONTEXT',
  DENY_CLOCK_UNAVAILABLE: 'DENY_CLOCK_UNAVAILABLE',
});

/** Required fields for matchTrustedLeaseSnapshot — omitted fields are never wildcards. */
export const REQUIRED_LEASE_MATCH_FIELDS = Object.freeze([
  'leaseId',
  'taskId',
  'resourceType',
  'resourceId',
  'ownerPrincipalId',
  'ownerActorId',
  'fencingEpoch',
]);

const brandedReaders = new WeakSet();
const brandedSnapshots = new WeakSet();

/**
 * Module-private authoritative state for branded readers.
 * Never exposed to callers. Keyed only by branded reader object identity.
 */
const readerInternalState = new WeakMap();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function deny(decision, reasons) {
  return Object.freeze({
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    snapshot: null,
  });
}

function allow(snapshot) {
  return Object.freeze({
    allowed: true,
    decision: LEASE_SNAPSHOT_DECISIONS.ALLOW,
    reasons: Object.freeze([]),
    snapshot,
  });
}

function freezeAndBrandSnapshot(fields) {
  const snapshot = Object.freeze({
    snapshotKind: LEASE_SNAPSHOT_KINDS.TEST_ONLY_IN_MEMORY,
    // Explicit non-claim: disposable in-memory double is not a DB lease authority.
    databaseBacked: false,
    realLeaseAuthority: false,
    leaseId: fields.leaseId,
    taskId: fields.taskId,
    resourceType: fields.resourceType,
    resourceId: fields.resourceId,
    ownerPrincipalId: fields.ownerPrincipalId,
    ownerActorId: fields.ownerActorId,
    fencingEpoch: fields.fencingEpoch,
    status: fields.status,
    expiresAtMs: fields.expiresAtMs,
  });
  brandedSnapshots.add(snapshot);
  return snapshot;
}

function classifyStoredRow(row) {
  if (!isPlainObject(row)) return 'ROW_MUST_BE_OBJECT';
  if (!isNonEmptyString(row.leaseId)) return 'INVALID_LEASE_ID';
  if (!isNonEmptyString(row.taskId)) return 'INVALID_TASK_ID';
  if (!isNonEmptyString(row.resourceType)) return 'INVALID_RESOURCE_TYPE';
  if (!isNonEmptyString(row.resourceId)) return 'INVALID_RESOURCE_ID';
  if (!isNonEmptyString(row.ownerPrincipalId)) return 'INVALID_OWNER_PRINCIPAL_ID';
  if (!isNonEmptyString(row.ownerActorId)) return 'INVALID_OWNER_ACTOR_ID';
  if (!isSafeInteger(row.fencingEpoch) || row.fencingEpoch < 0) return 'INVALID_FENCING_EPOCH';
  if (row.status !== 'ACTIVE' && row.status !== 'RELEASED' && row.status !== 'EXPIRED') {
    return 'INVALID_STATUS';
  }
  if (!isSafeInteger(row.expiresAtMs) || row.expiresAtMs < 0) return 'INVALID_EXPIRES_AT';
  return null;
}

/**
 * Returns true only for snapshot object references branded by this module's reader.
 */
export function isBrandedTrustedLeaseSnapshot(snapshot) {
  return snapshot !== null
    && typeof snapshot === 'object'
    && brandedSnapshots.has(snapshot);
}

/**
 * Returns true only for reader instances created by createInMemoryTrustedLeaseSnapshotReader.
 */
export function isBrandedTrustedLeaseSnapshotReader(reader) {
  return reader !== null
    && typeof reader === 'object'
    && brandedReaders.has(reader);
}

/**
 * Injected offline TEST_ONLY trusted lease snapshot reader.
 * Not a PostgreSQL / DLP-001 reader. Not production lease authority.
 */
export function createInMemoryTrustedLeaseSnapshotReader(options = {}) {
  const byLeaseId = new Map();
  let unavailable = options.unavailable === true;

  const reader = {
    kind: LEASE_SNAPSHOT_KINDS.TEST_ONLY_IN_MEMORY,
    databaseBacked: false,
    realLeaseAuthority: false,

    setUnavailable(flag) {
      unavailable = flag === true;
    },

    /**
     * Privileged test harness only: insert/replace a lease row into the double.
     * Callers outside the trusted test setup must not treat put() as production API.
     */
    put(row) {
      const error = classifyStoredRow(row);
      if (error) throw new TypeError(`invalid trusted lease row: ${error}`);
      if (row.ownerActorId !== row.ownerPrincipalId) {
        // Keep deterministic actor binding aligned with DLP-006 deriveActorId equality.
        throw new TypeError('invalid trusted lease row: OWNER_ACTOR_MUST_EQUAL_PRINCIPAL');
      }
      const stored = Object.freeze({
        leaseId: row.leaseId,
        taskId: row.taskId,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        ownerPrincipalId: row.ownerPrincipalId,
        ownerActorId: row.ownerActorId,
        fencingEpoch: row.fencingEpoch,
        status: row.status,
        expiresAtMs: row.expiresAtMs,
      });
      byLeaseId.set(stored.leaseId, stored);
      return stored;
    },

    clear() {
      byLeaseId.clear();
    },

    read(query, clock) {
      return readTrustedLeaseSnapshot(reader, query, clock);
    },
  };

  brandedReaders.add(reader);
  readerInternalState.set(reader, {
    byLeaseId,
    isUnavailable: () => unavailable === true,
  });
  return Object.freeze(reader);
}

/**
 * Read and brand a trusted lease snapshot via an injected branded reader.
 *
 * Authoritative store state is retrieved ONLY from module-private WeakMap ownership
 * of the branded reader. Callers cannot inject a Map, store, or unavailable callback.
 *
 * @param {object} reader branded reader from createInMemoryTrustedLeaseSnapshotReader
 * @param {{ leaseId: string }} query
 * @param {{ now: Function }} clock injected clock (DLP-005 style)
 */
export function readTrustedLeaseSnapshot(reader, query, clock) {
  if (!isBrandedTrustedLeaseSnapshotReader(reader)) {
    if (!isPlainObject(reader) || typeof reader.read !== 'function') {
      return deny(LEASE_SNAPSHOT_DECISIONS.DENY_MISSING_READER, ['TRUSTED_LEASE_READER_REQUIRED']);
    }
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_UNBRANDED_READER, [
      'CALLER_CONSTRUCTED_READER_NOT_TRUSTED',
    ]);
  }

  const state = readerInternalState.get(reader);
  if (!state || !(state.byLeaseId instanceof Map) || typeof state.isUnavailable !== 'function') {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_READER_UNAVAILABLE, [
      'TRUSTED_LEASE_STORE_UNAVAILABLE',
    ]);
  }

  if (state.isUnavailable() === true) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_READER_UNAVAILABLE, [
      'TRUSTED_LEASE_READER_UNAVAILABLE',
    ]);
  }

  if (!isPlainObject(query) || !isNonEmptyString(query.leaseId)) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_MALFORMED_QUERY, ['LEASE_ID_REQUIRED']);
  }

  if (!clock || typeof clock.now !== 'function') {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_CLOCK_UNAVAILABLE, ['CLOCK_REQUIRED']);
  }
  let nowResult;
  try {
    nowResult = clock.now();
  } catch {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_CLOCK_UNAVAILABLE, ['CLOCK_THREW']);
  }
  if (!nowResult || nowResult.available !== true || !isSafeInteger(nowResult.nowMs)) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_CLOCK_UNAVAILABLE, ['CLOCK_UNAVAILABLE']);
  }

  const row = state.byLeaseId.get(query.leaseId);
  if (!row) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_LEASE_NOT_FOUND, ['LEASE_NOT_FOUND']);
  }

  const rowError = classifyStoredRow(row);
  if (rowError) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_MALFORMED_SNAPSHOT, [rowError]);
  }

  if (row.status !== 'ACTIVE') {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_LEASE_NOT_ACTIVE, [`LEASE_STATUS:${row.status}`]);
  }
  if (nowResult.nowMs >= row.expiresAtMs) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_LEASE_EXPIRED, ['LEASE_EXPIRED']);
  }

  return allow(freezeAndBrandSnapshot(row));
}

/**
 * Validate a branded trusted snapshot against a COMPLETE expected authorization context.
 * Omitted/null/empty required fields FAIL CLOSED — never treated as wildcards.
 * Token fencing may only be compared here; it never establishes lease authority.
 */
export function matchTrustedLeaseSnapshot(snapshot, expected) {
  if (!isBrandedTrustedLeaseSnapshot(snapshot)) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_UNBRANDED_SNAPSHOT, [
      'CALLER_SUPPLIED_SNAPSHOT_NOT_TRUSTED',
    ]);
  }
  if (!isPlainObject(expected)) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_INCOMPLETE_MATCH_CONTEXT, [
      'EXPECTED_CONTEXT_REQUIRED',
    ]);
  }

  for (const field of REQUIRED_LEASE_MATCH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(expected, field)) {
      return deny(LEASE_SNAPSHOT_DECISIONS.DENY_INCOMPLETE_MATCH_CONTEXT, [
        `MISSING_MATCH_FIELD:${field}`,
      ]);
    }
    const value = expected[field];
    if (value === null || value === undefined) {
      return deny(LEASE_SNAPSHOT_DECISIONS.DENY_INCOMPLETE_MATCH_CONTEXT, [
        `NULL_MATCH_FIELD:${field}`,
      ]);
    }
    if (field === 'fencingEpoch') {
      if (!isSafeInteger(value) || value < 0) {
        return deny(LEASE_SNAPSHOT_DECISIONS.DENY_INCOMPLETE_MATCH_CONTEXT, [
          'INVALID_MATCH_FENCING_EPOCH',
        ]);
      }
    } else if (typeof value !== 'string' || value.length === 0) {
      return deny(LEASE_SNAPSHOT_DECISIONS.DENY_INCOMPLETE_MATCH_CONTEXT, [
        `INVALID_MATCH_FIELD:${field}`,
      ]);
    }
  }

  if (expected.leaseId !== snapshot.leaseId) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_WRONG_LEASE, ['LEASE_MISMATCH']);
  }
  if (expected.taskId !== snapshot.taskId) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_WRONG_TASK, ['TASK_MISMATCH']);
  }
  if (expected.resourceType !== snapshot.resourceType) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_WRONG_RESOURCE, ['RESOURCE_TYPE_MISMATCH']);
  }
  if (expected.resourceId !== snapshot.resourceId) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_WRONG_RESOURCE, ['RESOURCE_ID_MISMATCH']);
  }
  if (expected.ownerPrincipalId !== snapshot.ownerPrincipalId) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_FOREIGN_OWNER, ['OWNER_PRINCIPAL_MISMATCH']);
  }
  if (expected.ownerActorId !== snapshot.ownerActorId) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_FOREIGN_OWNER, ['OWNER_ACTOR_MISMATCH']);
  }
  if (expected.fencingEpoch !== snapshot.fencingEpoch) {
    return deny(LEASE_SNAPSHOT_DECISIONS.DENY_STALE_FENCING_EPOCH, ['FENCING_EPOCH_MISMATCH']);
  }

  return allow(snapshot);
}
