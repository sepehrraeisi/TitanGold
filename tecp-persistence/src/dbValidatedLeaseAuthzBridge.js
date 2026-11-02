/**
 * TECP-DLP-007 C1 — private DB-validated lease → DLP-006 authz bridge.
 *
 * Architecture Option C1: after frozen validateWriteLease succeeds inside an
 * owned transaction, project ONLY validated DB fields into a PRIVATE
 * DLP-006-compatible TEST_ONLY in-memory lease reader.
 *
 * Honest metadata (never DATABASE_BACKED):
 *   kind = TEST_ONLY_IN_MEMORY
 *   databaseBacked = false
 *   realLeaseAuthority = false
 *
 * Real lease authority remains the frozen PostgreSQL validation.
 * The private reader is compatibility machinery for authorizeWorkerOperation.
 *
 * M3 remediation: the branded reader is module-private. No public export returns
 * the reader or exposes put/clear. External callers cannot inject forged fencing
 * or owner identity into the authorization path through this module's API.
 * Population is allowed ONLY from a validated DLP-001 lease object.
 *
 * Mapping (trusted policy + validated DB row only; never caller remapping):
 *   DLP006.leaseId       = DLP001.leaseKey
 *   DLP006.resourceId    = DLP001.resourceKey
 *   DLP006.resourceType  = DLP001.resourceType
 *   DLP006.taskId        = DLP001.taskId
 *   DLP006.fencingEpoch  = DB-issued fencing_epoch
 *
 * NON_OPERATIONAL. Not a production lease reader.
 */

import {
  authorizeWorkerOperation,
} from '../../tecp/src/authorizedInvocation.js';
import {
  createInMemoryTrustedLeaseSnapshotReader,
  isBrandedTrustedLeaseSnapshotReader,
  LEASE_SNAPSHOT_KINDS,
} from '../../tecp/src/trustedLeaseSnapshot.js';

export const BRIDGE_METADATA = Object.freeze({
  kind: LEASE_SNAPSHOT_KINDS.TEST_ONLY_IN_MEMORY,
  databaseBacked: false,
  realLeaseAuthority: false,
});

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Convert a pg driver expires_at representation to integer epoch milliseconds.
 * Fail closed on missing, malformed or unsafe timestamps.
 * Never extends expiration.
 *
 * @param {unknown} expiresAt
 * @returns {number}
 */
export function convertPgExpiresAtToEpochMs(expiresAt) {
  if (expiresAt instanceof Date) {
    const ms = expiresAt.getTime();
    if (!Number.isFinite(ms) || !Number.isSafeInteger(ms) || ms < 0) {
      throw new TypeError('INVALID_PG_EXPIRES_AT_DATE');
    }
    return ms;
  }
  if (typeof expiresAt === 'number') {
    if (!Number.isSafeInteger(expiresAt) || expiresAt < 0) {
      throw new TypeError('INVALID_PG_EXPIRES_AT_NUMBER');
    }
    return expiresAt;
  }
  if (typeof expiresAt === 'string' && expiresAt.length > 0) {
    const ms = Date.parse(expiresAt);
    if (!Number.isFinite(ms) || !Number.isSafeInteger(ms) || ms < 0) {
      throw new TypeError('INVALID_PG_EXPIRES_AT_STRING');
    }
    return ms;
  }
  throw new TypeError('INVALID_PG_EXPIRES_AT');
}

/**
 * Map a validated DLP-001 lease object into a DLP-006 snapshot row.
 * Mapping authority originates from the validated DB row + verified principal.
 * Pure mapping helper — does not create or expose a lease reader.
 *
 * @param {object} validatedLease mapLease result from validateWriteLease
 * @param {string} ownerPrincipalId verified TEST_ONLY principalId
 * @param {string} ownerActorId derived actorId (must equal principalId)
 */
export function mapValidatedLeaseToAuthzRow(validatedLease, ownerPrincipalId, ownerActorId) {
  if (!isPlainObject(validatedLease)) {
    throw new TypeError('VALIDATED_LEASE_REQUIRED');
  }
  if (!isNonEmptyString(ownerPrincipalId) || !isNonEmptyString(ownerActorId)) {
    throw new TypeError('OWNER_IDENTITY_REQUIRED');
  }
  if (ownerActorId !== ownerPrincipalId) {
    throw new TypeError('OWNER_ACTOR_MUST_EQUAL_PRINCIPAL');
  }
  if (!isNonEmptyString(validatedLease.leaseKey)
    || !isNonEmptyString(validatedLease.taskId)
    || !isNonEmptyString(validatedLease.resourceType)
    || !isNonEmptyString(validatedLease.resourceKey)
    || !isSafeInteger(validatedLease.fencingEpoch)
    || validatedLease.fencingEpoch < 0) {
    throw new TypeError('VALIDATED_LEASE_FIELDS_INVALID');
  }
  if (validatedLease.actorId !== ownerActorId) {
    throw new TypeError('VALIDATED_LEASE_ACTOR_MISMATCH');
  }
  if (validatedLease.status !== 'ACTIVE') {
    throw new TypeError('VALIDATED_LEASE_NOT_ACTIVE');
  }

  const expiresAtMs = convertPgExpiresAtToEpochMs(validatedLease.expiresAt);

  return Object.freeze({
    leaseId: validatedLease.leaseKey,
    taskId: validatedLease.taskId,
    resourceType: validatedLease.resourceType,
    resourceId: validatedLease.resourceKey,
    ownerPrincipalId,
    ownerActorId,
    fencingEpoch: validatedLease.fencingEpoch,
    status: 'ACTIVE',
    expiresAtMs,
  });
}

/**
 * Authorize against a private DB-validated lease projection.
 *
 * The branded TEST_ONLY reader is created, populated exclusively from the
 * validated lease, passed only into frozen authorizeWorkerOperation, then
 * cleared. The reader is NEVER returned.
 *
 * Callers MUST NOT supply deps.leaseSnapshotReader — forged readers are rejected.
 *
 * @param {object} args
 * @param {object} args.validatedLease DLP-001 validateWriteLease.lease
 * @param {string} args.ownerPrincipalId
 * @param {string} args.ownerActorId
 * @param {object} args.request authorizeWorkerOperation request (no lease reader)
 * @param {object} args.deps { policyProvider, capabilityDeps } — no leaseSnapshotReader
 * @returns {{ authorization: object, authzRow: object }}
 */
export function authorizeWorkerOperationAgainstDbValidatedLease(args) {
  if (!isPlainObject(args)) {
    throw new TypeError('BRIDGE_ARGS_REQUIRED');
  }
  if (!isPlainObject(args.deps)) {
    throw new TypeError('BRIDGE_DEPS_REQUIRED');
  }
  // M3: reject any caller-supplied reader / snapshot injection.
  if (Object.prototype.hasOwnProperty.call(args.deps, 'leaseSnapshotReader')
    || Object.prototype.hasOwnProperty.call(args.deps, 'leaseReader')
    || Object.prototype.hasOwnProperty.call(args.deps, 'leaseSnapshot')
    || Object.prototype.hasOwnProperty.call(args, 'leaseSnapshotReader')
    || Object.prototype.hasOwnProperty.call(args, 'leaseReader')) {
    throw new TypeError('CALLER_LEASE_READER_FORBIDDEN');
  }

  const authzRow = mapValidatedLeaseToAuthzRow(
    args.validatedLease,
    args.ownerPrincipalId,
    args.ownerActorId,
  );

  const reader = createInMemoryTrustedLeaseSnapshotReader();
  try {
    reader.put(authzRow);
    if (!isBrandedTrustedLeaseSnapshotReader(reader)) {
      throw new Error('PRIVATE_BRIDGE_READER_UNBRANDED');
    }
    // Defense in depth: refuse further external mutation after population.
    // put/clear remain on the object but the bridge never returns it; clear() in finally.
    const authorization = authorizeWorkerOperation(args.request, {
      policyProvider: args.deps.policyProvider,
      capabilityDeps: args.deps.capabilityDeps,
      leaseSnapshotReader: reader,
    });
    return Object.freeze({
      authorization,
      authzRow,
      // Explicit non-escape: no reader field.
      bridgeMetadata: BRIDGE_METADATA,
    });
  } finally {
    try {
      reader.clear();
    } catch {
      // fail closed: ignore clear errors after auth decision
    }
  }
}

/**
 * Source-backed proof helper for adversarial tests: public bridge API surface
 * must not include reader constructors or put/clear accessors.
 */
export const BRIDGE_PUBLIC_API = Object.freeze([
  'BRIDGE_METADATA',
  'BRIDGE_PUBLIC_API',
  'convertPgExpiresAtToEpochMs',
  'mapValidatedLeaseToAuthzRow',
  'authorizeWorkerOperationAgainstDbValidatedLease',
]);
