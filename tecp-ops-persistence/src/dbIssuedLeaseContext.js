/**
 * TECP-OPS-PILOT-001 S2 Gate C+D — DB-issued lease context boundary.
 *
 * Process-local branding ≠ DB provenance.
 * Offline interface branding remains TEST_ONLY (realDbAuthority=false).
 * DB_PROVEN contexts require a genuine validateWriteLease result inside an
 * owned transaction; plain objects and public brand registration cannot mint
 * DB_PROVEN authority.
 */

import { registerDbIssuedLeaseContextBrand } from '../../tecp-ops/src/operationalResourceLeaseAuthority.js';

export const DB_LEASE_CONTEXT_KIND = 'DB_ISSUED_LEASE_CONTEXT_V1';
export const DB_LEASE_CONTEXT_PROOF_CLASS =
  'OFFLINE_OR_DB_PROVEN_REQUIRES_VALIDATED_OWNED_TXN';
export const DB_PROVENANCE_CLASS = Object.freeze({
  OFFLINE_INTERFACE_ONLY: 'OFFLINE_INTERFACE_ONLY',
  DB_PROVEN: 'DB_PROVEN',
});

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
  DENY_NOT_DB_PROVEN: 'DENY_NOT_DB_PROVEN',
  DENY_PUBLIC_BRAND_NOT_DB_AUTHORITY: 'DENY_PUBLIC_BRAND_NOT_DB_AUTHORITY',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
});

const brandedContexts = new WeakSet();
const dbProvenContexts = new WeakSet();
const txnBindings = new WeakMap();
const invalidatedTxnHandles = new WeakSet();

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
    provenanceClass: null,
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
    realDbAuthority: context.realDbAuthority === true,
    provenanceClass: context.provenanceClass,
  });
}

export function isBrandedDbIssuedLeaseContext(value) {
  return value !== null && typeof value === 'object' && brandedContexts.has(value);
}

export function isDbProvenLeaseContext(value) {
  return value !== null && typeof value === 'object' && dbProvenContexts.has(value);
}

// Register offline/DB brands with Operational RLA acceptor list.
// Public registerDbIssuedLeaseContextBrand elsewhere cannot mint DB_PROVEN.
registerDbIssuedLeaseContextBrand((value) => isBrandedDbIssuedLeaseContext(value));

/**
 * Offline interface projection — TEST_ONLY. Never DB_PROVEN.
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

  // Plain realDbValidated=true from caller is NOT sufficient for DB_PROVEN.
  // Use projectFromTrustedValidateWriteLease for DB_PROVEN.
  if (dbValidationResult.realDbValidated === true
    && dbValidationResult.trustedValidateWriteLease !== true) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_CALLER_OBJECT, [
      'PLAIN_REAL_DB_VALIDATED_FLAG_NOT_TRUSTED',
      'USE_projectFromTrustedValidateWriteLease',
    ]);
  }
  if (
    dbValidationResult.offlineInterfaceOnly !== true
    && dbValidationResult.trustedValidateWriteLease !== true
  ) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_DB_NOT_AUTHORIZED, [
      'OFFLINE_INTERFACE_MARKER_OR_TRUSTED_VALIDATE_WRITE_LEASE_REQUIRED',
    ]);
  }

  const context = Object.freeze({
    kind: DB_LEASE_CONTEXT_KIND,
    proofClass: DB_LEASE_CONTEXT_PROOF_CLASS,
    provenanceClass: DB_PROVENANCE_CLASS.OFFLINE_INTERFACE_ONLY,
    leaseKey: dbValidationResult.leaseKey,
    fencingEpoch: dbValidationResult.fencingEpoch,
    taskId: dbValidationResult.taskId ?? null,
    resourceType: dbValidationResult.resourceType ?? null,
    resourceKey: dbValidationResult.resourceKey ?? null,
    principalId: dbValidationResult.principalId ?? null,
    actorId: dbValidationResult.actorId ?? null,
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
 * DB_PROVEN projection from a trusted DLP validateWriteLease result shape.
 * Caller cannot forge this by setting flags on a plain object alone:
 * requires trustedValidateWriteLease=true set only by controlled composition.
 */
export function projectFromTrustedValidateWriteLease(validation, txnHandle, expectation = {}) {
  if (!isPlainObject(validation)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MALFORMED, ['VALIDATION_OBJECT_REQUIRED']);
  }
  if (validation.callerForged === true || validation.source === 'CALLER_OBJECT') {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_CALLER_OBJECT, ['CALLER_FORGED_VALIDATION']);
  }
  if (validation.trustedValidateWriteLease !== true) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_NOT_DB_PROVEN, [
      'TRUSTED_VALIDATE_WRITE_LEASE_MARKER_REQUIRED',
    ]);
  }
  if (validation.ok !== true) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MISSING_DB_VALIDATION, [
      validation.decision || 'VALIDATE_WRITE_LEASE_DENIED',
    ]);
  }
  if (txnHandle == null || typeof txnHandle !== 'object') {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_TXN_LIFETIME_EXPIRED, [
      'OWNED_TXN_HANDLE_REQUIRED_FOR_DB_PROVEN',
    ]);
  }
  if (invalidatedTxnHandles.has(txnHandle)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_TXN_LIFETIME_EXPIRED, [
      'TXN_HANDLE_ALREADY_INVALIDATED',
    ]);
  }

  const lease = validation.lease;
  if (!isPlainObject(lease)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MALFORMED, ['LEASE_ROW_REQUIRED']);
  }
  if (!isNonEmptyString(lease.leaseKey) || !isSafeInteger(lease.fencingEpoch)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MALFORMED, ['LEASE_KEY_AND_FENCING_REQUIRED']);
  }
  if (lease.expired === true || lease.unexpired === false) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_EXPIRED_LEASE, ['LEASE_EXPIRED']);
  }

  if (isPlainObject(expectation)) {
    if (isNonEmptyString(expectation.leaseKey) && expectation.leaseKey !== lease.leaseKey) {
      return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MISMATCHED_IDENTITY, ['LEASE_KEY_MISMATCH']);
    }
    if (isSafeInteger(expectation.fencingEpoch)
      && expectation.fencingEpoch !== lease.fencingEpoch) {
      return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING, ['FENCING_MISMATCH']);
    }
    if (isSafeInteger(expectation.minimumFencingEpoch)
      && lease.fencingEpoch < expectation.minimumFencingEpoch) {
      return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING, ['FENCING_STALE']);
    }
    if (isNonEmptyString(expectation.resourceType)
      && expectation.resourceType !== lease.resourceType) {
      return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MISMATCHED_IDENTITY, ['RESOURCE_TYPE_MISMATCH']);
    }
    if (isNonEmptyString(expectation.resourceKey)
      && expectation.resourceKey !== lease.resourceKey) {
      return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MISMATCHED_IDENTITY, ['RESOURCE_KEY_MISMATCH']);
    }
    if (isNonEmptyString(expectation.taskId) && expectation.taskId !== lease.taskId) {
      return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MISMATCHED_IDENTITY, ['TASK_MISMATCH']);
    }
    if (isNonEmptyString(expectation.principalId)
      && expectation.principalId !== lease.actorId
      && expectation.principalId !== lease.principalId) {
      return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MISMATCHED_IDENTITY, ['PRINCIPAL_MISMATCH']);
    }
  }

  const context = Object.freeze({
    kind: DB_LEASE_CONTEXT_KIND,
    proofClass: DB_LEASE_CONTEXT_PROOF_CLASS,
    provenanceClass: DB_PROVENANCE_CLASS.DB_PROVEN,
    leaseKey: lease.leaseKey,
    fencingEpoch: lease.fencingEpoch,
    taskId: lease.taskId ?? null,
    resourceType: lease.resourceType ?? null,
    resourceKey: lease.resourceKey ?? null,
    principalId: lease.principalId ?? lease.actorId ?? null,
    actorId: lease.actorId ?? null,
    txnBound: true,
    offlineInterfaceOnly: false,
    realDbAuthority: true,
  });
  brandedContexts.add(context);
  dbProvenContexts.add(context);
  txnBindings.set(context, txnHandle);
  return allow(context, [
    'DB_PROVEN_LEASE_CONTEXT_FROM_VALIDATE_WRITE_LEASE',
    'TXN_BOUND',
  ]);
}

/**
 * Reject plain caller objects that merely look like lease rows.
 * Already-branded offline contexts are accepted as branded but NOT DB_PROVEN.
 */
export function rejectCallerLeaseObject(candidate) {
  if (!isPlainObject(candidate)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_MALFORMED, ['OBJECT_REQUIRED']);
  }
  if (isDbProvenLeaseContext(candidate)) {
    return allow(candidate, ['ALREADY_DB_PROVEN']);
  }
  if (isBrandedDbIssuedLeaseContext(candidate)) {
    return allow(candidate, ['ALREADY_BRANDED_NOT_NECESSARILY_DB_PROVEN']);
  }
  if (
    candidate.kind === 'OFFLINE_TRUSTED_LEASE_FIXTURE'
    || candidate.proofClass === 'OFFLINE_FIXTURE_NOT_DB_AUTHORITY'
  ) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_S1_OFFLINE_FIXTURE, [
      'S1_OFFLINE_FIXTURE_FORBIDDEN',
    ]);
  }
  if (candidate.realDbValidated === true || candidate.provenanceClass === 'DB_PROVEN') {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_PUBLIC_BRAND_NOT_DB_AUTHORITY, [
      'CALLER_CLAIMED_DB_PROVEN_WITHOUT_MODULE_BRAND',
    ]);
  }
  return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_UNBRANDED, [
    'CALLER_LEASE_OBJECT_NOT_TRUSTED',
  ]);
}

export function assertContextBoundToTransaction(context, txnHandle) {
  if (!isBrandedDbIssuedLeaseContext(context)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_UNBRANDED, ['BRANDED_CONTEXT_REQUIRED']);
  }
  if (txnHandle != null && invalidatedTxnHandles.has(txnHandle)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_TXN_LIFETIME_EXPIRED, [
      'TXN_HANDLE_INVALIDATED',
    ]);
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

/**
 * Invalidate all contexts bound to a txn handle (commit/rollback/exception).
 */
export function invalidateContextsForTransaction(txnHandle) {
  if (txnHandle != null && typeof txnHandle === 'object') {
    invalidatedTxnHandles.add(txnHandle);
  }
  return Object.freeze({
    ok: true,
    decision: 'TXN_INVALIDATED',
    note: 'Bound contexts fail assertContextBoundToTransaction after invalidation',
  });
}

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
  if (expectation.requireDbProven === true && !isDbProvenLeaseContext(context)) {
    return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_NOT_DB_PROVEN, [
      'DB_PROVEN_CONTEXT_REQUIRED',
    ]);
  }
  return allow(context, ['CONTEXT_MATCH']);
}

/**
 * Document that public brand registration cannot create DB_PROVEN authority.
 */
export function assertPublicBrandRegistrationIsNotDbAuthority(candidate) {
  if (isDbProvenLeaseContext(candidate)) {
    return allow(candidate, ['MODULE_DB_PROVEN_OK']);
  }
  return deny(DB_LEASE_CONTEXT_DECISIONS.DENY_PUBLIC_BRAND_NOT_DB_AUTHORITY, [
    'PUBLIC_REGISTER_OR_PLAIN_OBJECT_NOT_DB_PROVEN',
  ]);
}
