import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DB_LEASE_CONTEXT_DECISIONS,
  assertContextBoundToTransaction,
  isBrandedDbIssuedLeaseContext,
  matchDbIssuedLeaseContext,
  projectDbValidatedLeaseContext,
  rejectCallerLeaseObject,
} from '../src/dbIssuedLeaseContext.js';
import {
  createOfflineTrustedLeaseFixtureForTests,
} from '../../tecp-ops/src/resourceLeaseAuthority.js';

describe('S2 dbIssuedLeaseContext offline boundary', () => {
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

  it('3) projects branded context from explicit offline interface marker', () => {
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
    assert.equal(projected.realDbAuthority, false);
    assert.equal(assertContextBoundToTransaction(projected.context, txn).ok, true);
    assert.equal(
      assertContextBoundToTransaction(projected.context, { id: 'other' }).ok,
      false,
    );
  });

  it('4) denies realDbValidated claim in Gate B and missing validation', () => {
    assert.equal(
      projectDbValidatedLeaseContext({
        ok: true,
        valid: true,
        leaseKey: 'lease-1',
        fencingEpoch: 1,
        realDbValidated: true,
      }).decision,
      DB_LEASE_CONTEXT_DECISIONS.DENY_DB_NOT_AUTHORIZED,
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
});
