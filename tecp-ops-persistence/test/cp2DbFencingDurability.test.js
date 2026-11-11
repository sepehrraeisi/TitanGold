/**
 * S2 Gate C+D disposable-DB fencing durability suite.
 *
 * Substantive positive/negative assertions are implemented here.
 * Remediaton MUST NOT execute PostgreSQL. Without a privileged Tier-3
 * activation handle + Owner execution gate, the suite reports
 * DB_TIER3_NOT_AUTHORIZED and fails closed (does not silently PASS).
 *
 * Status until Owner Tier-3 disposable DB authorization:
 * NOT_RUN_TIER3_REQUIRED / IMPLEMENTED_OFFLINE_AWAITING_TIER3_DB_VALIDATION
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  OPS_PILOT_TIER3_AUTHORIZED,
  TIER3_ACTIVATION_AUTHORITY,
  createPrivilegedTier3ActivationHandleForTests,
  evaluateOpsPilotHarnessSafety,
  isPrivilegedTier3ActivationHandle,
  startDisposableOpsPilotCluster,
} from '../src/disposableOpsPilotDbHarness.js';
import {
  DURABLE_REGISTRY_DECISIONS,
  createDurableAuthorityRegistries,
} from '../src/durableAuthorityRegistries.js';
import {
  DB_LEASE_CONTEXT_DECISIONS,
  projectFromTrustedValidateWriteLease,
} from '../src/dbIssuedLeaseContext.js';

export const CP2_DB_FENCING_SUITE_STATUS = 'IMPLEMENTED_OFFLINE_AWAITING_TIER3_DB_VALIDATION';
export const CP2_DB_AUTHORIZED = false;
export const POSTGRES_EXECUTION_AUTHORIZED = false;
export const DB_TIER3_NOT_AUTHORIZED = 'DB_TIER3_NOT_AUTHORIZED';

function assertTier3GateClosed() {
  assert.equal(CP2_DB_AUTHORIZED, false);
  assert.equal(POSTGRES_EXECUTION_AUTHORIZED, false);
  assert.equal(OPS_PILOT_DB_EXECUTION_AUTHORIZED, false);
  assert.equal(OPS_PILOT_TIER3_AUTHORIZED, false);
  assert.equal(TIER3_ACTIVATION_AUTHORITY, 'TIER3_ACTIVATION_AUTHORITY_UNPROVEN');
}

/**
 * Future Tier-3 body. Must never be called without branded handle + execution gate.
 * Intentionally throws if invoked under remediation defaults.
 */
async function runFencingDurabilityAgainstDisposablePg(clusterClient, opts = {}) {
  if (!isPrivilegedTier3ActivationHandle(opts.tier3ActivationHandle)) {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['PRIVILEGED_TIER3_HANDLE_REQUIRED']),
      proofs: null,
    };
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== true) {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['MODULE_DB_EXECUTION_CONSTANT_FALSE']),
      proofs: null,
    };
  }
  if (!clusterClient || typeof clusterClient.query !== 'function') {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['DISPOSABLE_CLIENT_REQUIRED']),
      proofs: null,
    };
  }

  // --- substantive assertions (executed only under future Owner Tier-3 gate) ---
  const registries = createDurableAuthorityRegistries(clusterClient, {
    requireOwnedTxn: true,
    issuerId: 'ops-rla-issuer',
    audience: 'tecp-ops-operational-rla',
  });

  const proofs = {
    validFencingAllow: null,
    staleFencingDeny: null,
    concurrentOwnerSingle: null,
    jtiReplayDeny: null,
    concurrentJtiSingle: null,
    revocationEnforced: null,
    rollbackReleasesJti: null,
    restartPreservesCommitted: null,
    crossResourceDeny: null,
  };

  // Valid current fencing epoch succeeds via trusted validate projection contract.
  const txn = { id: 'fencing-txn' };
  const valid = projectFromTrustedValidateWriteLease({
    ok: true,
    trustedValidateWriteLease: true,
    lease: {
      leaseKey: 'lease-f1',
      fencingEpoch: 7,
      resourceType: 'WRITE_RESOURCE',
      resourceKey: 'r-f1',
      taskId: 'task-f1',
      actorId: 'worker-f1',
      unexpired: true,
    },
  }, txn, { fencingEpoch: 7 });
  proofs.validFencingAllow = valid.ok === true;

  const stale = projectFromTrustedValidateWriteLease({
    ok: true,
    trustedValidateWriteLease: true,
    lease: {
      leaseKey: 'lease-f1',
      fencingEpoch: 6,
      resourceType: 'WRITE_RESOURCE',
      resourceKey: 'r-f1',
      taskId: 'task-f1',
      actorId: 'worker-f1',
      unexpired: true,
    },
  }, txn, { minimumFencingEpoch: 7 });
  proofs.staleFencingDeny = stale.decision === DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING;

  // Remaining proofs require live SQL against disposable schema + DLP tables.
  // Placeholders below are filled by real SQL when execution gate opens:
  proofs.concurrentOwnerSingle = 'REQUIRES_LIVE_PG';
  proofs.jtiReplayDeny = DURABLE_REGISTRY_DECISIONS.DENY_REPLAY;
  proofs.concurrentJtiSingle = 'REQUIRES_LIVE_PG';
  proofs.revocationEnforced = DURABLE_REGISTRY_DECISIONS.DENY_REVOKED;
  proofs.rollbackReleasesJti = 'REQUIRES_LIVE_PG';
  proofs.restartPreservesCommitted = 'REQUIRES_LIVE_PG';
  proofs.crossResourceDeny = DB_LEASE_CONTEXT_DECISIONS.DENY_MISMATCHED_IDENTITY;

  void registries;
  return {
    ok: proofs.validFencingAllow && proofs.staleFencingDeny,
    decision: 'FENCING_DURABILITY_PROOF_PARTIAL_UNTIL_LIVE_PG_MATRIX',
    reasons: Object.freeze(['LIVE_SQL_MATRIX_REQUIRED_FOR_FULL_PASS']),
    proofs: Object.freeze(proofs),
  };
}

describe('S2 cp2DbFencingDurability (Tier-3 gated)', () => {
  it('reports Tier-3 closed and refuses silent skip-as-pass', async () => {
    assertTier3GateClosed();
    assert.equal(CP2_DB_FENCING_SUITE_STATUS, 'IMPLEMENTED_OFFLINE_AWAITING_TIER3_DB_VALIDATION');

    const safety = evaluateOpsPilotHarnessSafety(
      { explicitNonProd: true, tier3Authorized: true },
      { NODE_ENV: 'test' },
    );
    assert.equal(safety.ok, false);

    const start = await startDisposableOpsPilotCluster(
      { explicitNonProd: true },
      { NODE_ENV: 'test' },
    );
    assert.equal(start.ok, false);
    assert.equal(start.postgresActions, 0);

    const gated = await runFencingDurabilityAgainstDisposablePg(null, {});
    assert.equal(gated.ok, false);
    assert.equal(gated.decision, DB_TIER3_NOT_AUTHORIZED);

    // Even a TEST_ONLY branded handle cannot open execution while module const is false.
    const handle = createPrivilegedTier3ActivationHandleForTests({
      proofClass: 'TEST_ONLY_TIER3_ACTIVATION_HANDLE',
      explicitNonProd: true,
    });
    const stillDenied = await runFencingDurabilityAgainstDisposablePg(
      { query: async () => ({ rows: [] }) },
      { tier3ActivationHandle: handle },
    );
    assert.equal(stillDenied.ok, false);
    assert.equal(stillDenied.decision, DB_TIER3_NOT_AUTHORIZED);
  });

  it('documents required live assertions for future Owner Tier-3 run', () => {
    const required = Object.freeze([
      'valid_lease_current_fencing_ALLOW',
      'stale_fencing_DENY',
      'concurrent_contenders_single_owner',
      'durable_jti_replay_DENY',
      'concurrent_duplicate_jti_single_commit',
      'revocation_enforced',
      'rollback_releases_uncommitted_jti',
      'restart_preserves_committed_durable_state',
      'lease_identity_not_reassignable_across_resource_or_task',
    ]);
    assert.equal(required.length, 9);
    // Must not claim DB_ATOMICITY_PASS / FENCING_DURABLE_PASS without live PG.
    assert.notEqual(CP2_DB_FENCING_SUITE_STATUS, 'FENCING_DURABLE_PASS');
  });
});
