/**
 * TECP-OPS-PILOT-001 S2 — DB-issued lease context boundary.
 *
 * Caller-supplied lease objects are never trusted merely because fields match.
 * Context must derive from a DB-validation result inside an owned transaction.
 * Gate B: negative cases + controlled offline interface only.
 * Does NOT manufacture real DB-issued lease authority from mocks.
 */

import { registerDbIssuedLeaseContextBrand } from '../../tecp-ops/src/operationalResourceLeaseAuthority.js';

export const DB_LEASE_CONTEXT_KIND = 'DB_ISSUED_LEASE_CONTEXT_V1';
export const DB_LEASE_CONTEXT_PROOF_CLASS =
  'OFFLINE_INTERFACE_REQUIRES_DB_VALIDATED_RESULT';

export const DB_LEASE_CONTEXT_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_CALLER_OBJECT: 'DENY_CALLER_OBJECT',
  DENY_UNBRANDED: 'DENY_UNBRANDED',
  DENY_MISSING_DB_VALIDATION: 'DENY_MISSING_DB_VALIDATION',
  DENY_TXN_LIFETIME_EXPIRED: 'DENY_TXN_LIFETIME_EXPIRED',
  DENY_STALE_FENCING: 'DENY_STALE_FENCING',
  DENY_EXPIRED_LEASE: 'DENY_EXPIRED_LEASE',
  DENY_MISMATCHED_IDENTITY: 'DENY_MISMATCHED_IDENTITY',
  DENY_S1_OFFLINE_FIXTURE: 'DENY_S1_OFFLINE_FIXTURE',
  DENY_DB_NOT_AUTHORIZED: 'DENY_DB_NOT_AUTHORIZED',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
});

const brandedContexts = new WeakSet();
const txnBindings = new WeakMap();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function deny(decision, reasons = []) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    context: null,
    classification: DB_LEASE_CONTEXT_PROOF_CLASS,
    realDbAuthority: false,
  });
}

function allow(context, reasons = []) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: DB_LEASE_CONTEXT_DECISIONS.ALLOW,
    reasons: Object.freeze([...reasons]),
    context,
    classification: DB_LEASE_CONTEXT_PROOF_CLASS,
    realDbAuthority: false,
  });
}

export function isBrandedDbIssuedLeaseContext(value) {
  return value !== null && typeof value === 'object' && brandedContexts.has(value);
}

// Register with Operational RLA so LEASE_BOUND can accept these brands only.
registerDbIssuedLeaseContextBrand((value) => isBrandedDbIssuedLeaseContext(value));

/**
 * Project a branded context ONLY from an explicit DB validation result shape.
 * Gate B tests may supply a controlled offline validation result object that
 * itself is marked as NOT real DB authority. This does not prove PostgreSQL.
 */
export function projectDbValidatedLeaseContext(dbValidationResult, txnHandle = null) {
  if (!isPlainObject(dbValidationResult)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MALFORMED, ['DB_VALIDATION_OBJECT_REQUIRED']);
  }
  if (dbValidationResult.ok !== true || dbValidationResult.valid !== true) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MISSING_DB_VALIDATION, [
      'DB_VALIDATION_MUST_BE_OK_AND_VALID',
    ]);
  }
  if (dbValidationResult.source === 'CALLER_OBJECT' || dbValidationResult.callerForged === true) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_CALLER_OBJECT, ['CALLER_FORGED_VALIDATION']);
  }
  if (
    dbValidationResult.kind === 'OFFLINE_TRUSTED_LEASE_FIXTURE'
    || dbValidationResult.proofClass === 'OFFLINE_FIXTURE_NOT_DB_AUTHORITY'
  ) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_S1_OFFLINE_FIXTURE, [
      'S1_OFFLINE_FIXTURE_FORBIDDEN',
    ]);
  }
  if (!isNonEmptyString(dbValidationResult.leaseKey)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MALFORMED, ['LEASE_KEY_REQUIRED']);
  }
  if (!isSafeInteger(dbValidationResult.fencingEpoch) || dbValidationResult.fencingEpoch < 0) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING, ['FENCING_EPOCH_REQUIRED']);
  }
  if (dbValidationResult.expired === true) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_EXPIRED_LEASE, ['LEASE_EXPIRED']);
  }
  if (
    dbValidationResult.realDbValidated !== true
    && dbValidationResult.offlineInterfaceOnly !== true
  ) {
    // Fail closed: either an explicit offline-interface test marker OR a future
    // real DB validation flag must be present. Gate B never sets realDbValidated.
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_DB_NOT_AUTHORIZED, [
      'REAL_DB_VALIDATION_OR_EXPLICIT_OFFLINE_INTERFACE_MARKER_REQUIRED',
    ]);
  }
  if (dbValidationResult.realDbValidated === true) {
    // Gate B cannot prove real DB validation; refuse claiming it.
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_DB_NOT_AUTHORIZED, [
      'GATE_B_FORBIDS_REAL_DB_VALIDATED_CLAIM',
    ]);
  }

  const context = Object.freeze({
    kind: DB_LEASE_CONTEXT_KIND,
    proofClass: DB_LEASE_CONTEXT_PROOF_CLASS,
    leaseKey: dbValidationResult.leaseKey,
    fencingEpoch: dbValidationResult.fencingEpoch,
    taskId: dbValidationResult.taskId ?? null,
    resourceType: dbValidationResult.resourceType ?? null,
    resourceKey: dbValidationResult.resourceKey ?? null,
    principalId: dbValidationResult.principalId ?? null,
    txnBound: txnHandle != null,
    offlineInterfaceOnly: true,
    realDbAuthority: false,
  });
  brandedContexts.add(context);
  if (txnHandle != null && typeof txnHandle === 'object') {
    txnBindings.set(context, txnHandle);
  }
  return allow(context, [
    'DB_LEASE_CONTEXT_PROJECTED_OFFLINE_INTERFACE',
    'NOT_REAL_DB_AUTHORITY',
  ]);
}

/**
 * Reject plain caller objects that merely look like lease rows.
 */
export function rejectCallerLeaseObject(candidate) {
  if (!isPlainObject(candidate)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MALFORMED, ['OBJECT_REQUIRED']);
  }
  if (isBrandedDbIssuedLeaseContext(candidate)) {
    return allow(candidate, ['ALREADY_BRANDED']);
  }
  if (
    candidate.kind === 'OFFLINE_TRUSTED_LEASE_FIXTURE'
    || candidate.proofClass === 'OFFLINE_FIXTURE_NOT_DB_AUTHORITY'
  ) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_S1_OFFLINE_FIXTURE, [
      'S1_OFFLINE_FIXTURE_FORBIDDEN',
    ]);
  }
  return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_UNBRANDED, [
    'CALLER_LEASE_OBJECT_NOT_TRUSTED',
  ]);
}

/**
 * Context validity is limited to the owning transaction lifetime.
 */
export function assertContextBoundToTransaction(context, txnHandle) {
  if (!isBrandedDbIssuedLeaseContext(context)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_UNBRANDED, ['BRANDED_CONTEXT_REQUIRED']);
  }
  const bound = txnBindings.get(context);
  if (bound == null) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_TXN_LIFETIME_EXPIRED, [
      'CONTEXT_NOT_TXN_BOUND',
    ]);
  }
  if (txnHandle == null || bound !== txnHandle) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_TXN_LIFETIME_EXPIRED, [
      'TXN_HANDLE_MISMATCH_OR_ENDED',
    ]);
  }
  return allow(context, ['TXN_BINDING_VALID']);
}

export function invalidateContextsForTransaction(txnHandle) {
  // WeakMap cannot enumerate; callers drop the txn handle reference to end lifetime.
  // Explicit API retained for documentation / future harness wiring.
  void txnHandle;
  return Object.freeze({
    ok: true,
    decision: 'TXN_INVALIDATION_BY_HANDLE_DROP',
    note: 'Contexts become unbound when txn handle is discarded',
  });
}

/**
 * Compare expected identity against branded context.
 */
export function matchDbIssuedLeaseContext(context, expectation = {}) {
  if (!isBrandedDbIssuedLeaseContext(context)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_UNBRANDED, ['BRANDED_CONTEXT_REQUIRED']);
  }
  if (!isPlainObject(expectation)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MALFORMED, ['EXPECTATION_REQUIRED']);
  }
  if (
    isNonEmptyString(expectation.leaseKey)
    && expectation.leaseKey !== context.leaseKey
  ) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MISMATCHED_IDENTITY, ['LEASE_KEY_MISMATCH']);
  }
  if (
    isSafeInteger(expectation.fencingEpoch)
    && expectation.fencingEpoch !== context.fencingEpoch
  ) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING, ['FENCING_MISMATCH']);
  }
  if (
    isSafeInteger(expectation.minimumFencingEpoch)
    && context.fencingEpoch < expectation.minimumFencingEpoch
  ) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING, ['FENCING_STALE']);
  }
  return allow(context, ['CONTEXT_MATCH']);
}
