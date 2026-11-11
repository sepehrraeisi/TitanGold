import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DB_LEASE_CONTEXT_DECISIONS,
  DB_PROVENANCE_CLASS,
  assertContextBoundToTransaction,
  assertPublicBrandRegistrationIsNotDbAuthority,
  invalidateContextsForTransaction,
  isBrandedDbIssuedLeaseContext,
  isDbProvenLeaseContext,
  matchDbIssuedLeaseContext,
  projectDbValidatedLeaseContext,
  projectFromTrustedValidateWriteLease,
  rejectCallerLeaseObject,
} from '../src/dbIssuedLeaseContext.js';
import {
  createOfflineTrustedLeaseFixtureForTests,
} from '../../tecp-ops/src/resourceLeaseAuthority.js';
import {
  registerDbIssuedLeaseContextBrand,
} from '../../tecp-ops/src/operationalResourceLeaseAuthority.js';

describe('S2 dbIssuedLeaseContext Gate C+D offline provenance', () => {
  it('1) rejects unbranded caller lease objects', () => {
    const denied = rejectCallerLeaseObject({
      leaseKey: 'lease-1',
      fencingEpoch: 1,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.decision, DB_LEASE_CONTEXT_DECISIONS.DENY_UNBRANDED);
  });

  it('2) rejects S1 offline fixtures', () => {
    const fixture = createOfflineTrustedLeaseFixtureForTests({
      leaseKey: 'lease-1',
      fencingEpoch: 3,
    });
    assert.equal(
      rejectCallerLeaseObject(fixture).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_S1_OFFLINE_FIXTURE,
    );
    assert.equal(
      projectDbValidatedLeaseContext({
        ok: true,
        valid: true,
        leaseKey: 'lease-1',
        fencingEpoch: 3,
        kind: 'OFFLINE_TRUSTED_LEASE_FIXTURE',
        offlineInterfaceOnly: true,
      }).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_S1_OFFLINE_FIXTURE,
    );
  });

  it('3) projects branded OFFLINE_INTERFACE_ONLY context (not DB_PROVEN)', () => {
    const txn = { id: 'txn-offline-1' };
    const projected = projectDbValidatedLeaseContext({
      ok: true,
      valid: true,
      leaseKey: 'lease-s2-1',
      fencingEpoch: 9,
      offlineInterfaceOnly: true,
      taskId: 'task-1',
    }, txn);
    assert.equal(projected.ok, true);
    assert.equal(isBrandedDbIssuedLeaseContext(projected.context), true);
    assert.equal(isDbProvenLeaseContext(projected.context), false);
    assert.equal(projected.realDbAuthority, false);
    assert.equal(projected.context.provenanceClass, DB_PROVENANCE_CLASS.OFFLINE_INTERFACE_ONLY);
    assert.equal(assertContextBoundToTransaction(projected.context, txn).ok, true);
    assert.equal(
      assertContextBoundToTransaction(projected.context, { id: 'other' }).ok,
      false,
    );
  });

  it('4) plain realDbValidated flag is not trusted DB provenance', () => {
    assert.equal(
      projectDbValidatedLeaseContext({
        ok: true,
        valid: true,
        leaseKey: 'lease-1',
        fencingEpoch: 1,
        realDbValidated: true,
      }).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_CALLER_OBJECT,
    );
    assert.equal(
      projectDbValidatedLeaseContext({
        ok: false,
        valid: false,
        leaseKey: 'lease-1',
        fencingEpoch: 1,
        offlineInterfaceOnly: true,
      }).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_MISSING_DB_VALIDATION,
    );
  });

  it('5) stale fencing / identity mismatch deny', () => {
    const projected = projectDbValidatedLeaseContext({
      ok: true,
      valid: true,
      leaseKey: 'lease-s2-1',
      fencingEpoch: 5,
      offlineInterfaceOnly: true,
    });
    assert.equal(
      matchDbIssuedLeaseContext(projected.context, { fencingEpoch: 6 }).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING,
    );
    assert.equal(
      matchDbIssuedLeaseContext(projected.context, { minimumFencingEpoch: 6 }).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING,
    );
    assert.equal(
      matchDbIssuedLeaseContext(projected.context, { leaseKey: 'other' }).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_MISMATCHED_IDENTITY,
    );
  });

  it('6) trusted validateWriteLease projection yields DB_PROVEN; txn invalidation works', () => {
    const txn = { id: 'txn-db-1' };
    const projected = projectFromTrustedValidateWriteLease({
      ok: true,
      trustedValidateWriteLease: true,
      lease: {
        leaseKey: 'lease-db-1',
        fencingEpoch: 11,
        resourceType: 'WRITE_RESOURCE',
        resourceKey: 'r1',
        taskId: 'task-1',
        actorId: 'worker-1',
        unexpired: true,
      },
    }, txn, { leaseKey: 'lease-db-1', fencingEpoch: 11 });
    assert.equal(projected.ok, true);
    assert.equal(isDbProvenLeaseContext(projected.context), true);
    assert.equal(projected.context.provenanceClass, DB_PROVENANCE_CLASS.DB_PROVEN);
    assert.equal(projected.realDbAuthority, true);

    assert.equal(
      matchDbIssuedLeaseContext(projected.context, { requireDbProven: true }).ok,
      true,
    );

    invalidateContextsForTransaction(txn);
    assert.equal(
      assertContextBoundToTransaction(projected.context, txn).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_TXN_LIFETIME_EXPIRED,
    );
  });

  it('7) public brand registration cannot mint DB_PROVEN authority', () => {
    const forged = Object.freeze({
      kind: 'FAKE',
      leaseKey: 'x',
      fencingEpoch: 1,
      provenanceClass: 'DB_PROVEN',
      realDbValidated: true,
    });
    registerDbIssuedLeaseContextBrand((value) => value === forged);
    assert.equal(isDbProvenLeaseContext(forged), false);
    assert.equal(
      assertPublicBrandRegistrationIsNotDbAuthority(forged).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_PUBLIC_BRAND_NOT_DB_AUTHORITY,
    );
    assert.equal(
      rejectCallerLeaseObject({
        realDbValidated: true,
        provenanceClass: 'DB_PROVEN',
        leaseKey: 'x',
        fencingEpoch: 1,
      }).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_PUBLIC_BRAND_NOT_DB_AUTHORITY,
    );
  });

  it('8) caller-forged trustedValidateWriteLease without lease row denies', () => {
    assert.equal(
      projectFromTrustedValidateWriteLease({
        ok: true,
        trustedValidateWriteLease: true,
        callerForged: true,
        lease: { leaseKey: 'a', fencingEpoch: 1 },
      }, { id: 't' }).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_CALLER_OBJECT,
    );
    assert.equal(
      projectFromTrustedValidateWriteLease({
        ok: true,
        trustedValidateWriteLease: true,
        lease: { leaseKey: 'a', fencingEpoch: 1, unexpired: true },
      }, null).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_TXN_LIFETIME_EXPIRED,
    );
  });
});
