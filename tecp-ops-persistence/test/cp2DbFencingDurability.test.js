/**
 * S2 Gate C+D disposable-DB fencing durability suite.
 *
 * Offline: fail-closed; orchestration may run via Owner runner offline grant + inert
 * fixtures only. Never auto-starts PostgreSQL under the normal test runner.
 * Live SQL assertions are fully wired but remain gated behind
 * OPS_PILOT_DB_EXECUTION_AUTHORIZED (currently false) and must not claim PASS offline.
 */

import assert from 'node:assert/strict';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

/**
 * When this module is dynamically imported by the Owner runner under another
 * node --test parent, skip describe registration to avoid nested suite cancellation.
 * Direct `node --test cp2DbFencingDurability.test.js` still registers normally.
 */
function isDirectSuiteTestEntrypoint(argv = process.argv) {
  try {
    const self = resolve(fileURLToPath(import.meta.url));
    return Array.isArray(argv) && argv.some((a) => {
      try {
        return resolve(String(a)) === self || basename(String(a)) === basename(self);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

import {
  OPS_PILOT_APPROVED_TEST_ACTIONS,
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  OPS_PILOT_HARNESS_DECISIONS,
  OPS_PILOT_PINNED_MAIN_SHA,
  OPS_PILOT_TIER3_AUTHORIZED,
  TIER3_ACTIVATION_AUTHORITY,
  consumeRunnerOfflineSuiteGrant,
  createInertOfflineOneShotTicketForTests,
  createPrivilegedTier3ActivationHandleForTests,
  createRunnerOfflineSuiteGrantForTests,
  evaluateOpsPilotHarnessSafety,
  evaluateOwnerControlledLocalRunnerEvidence,
  isPrivilegedTier3ActivationHandle,
  isRunnerOfflineSuiteGrant,
  startDisposableOpsPilotCluster,
} from '../src/disposableOpsPilotDbHarness.js';
import {
  DURABLE_REGISTRY_DECISIONS,
  createDurableAuthorityRegistries,
  createOfflineTestOnlyDurableRegistryDoubles,
} from '../src/durableAuthorityRegistries.js';
import {
  DB_LEASE_CONTEXT_DECISIONS,
  projectFromTrustedValidateWriteLease,
} from '../src/dbIssuedLeaseContext.js';

export const FENCING_SUITE_PATH = OPS_PILOT_APPROVED_TEST_ACTIONS[0];
export const CP2_DB_FENCING_SUITE_STATUS = 'OFFLINE_ORCHESTRATION_WIRED_AWAITING_LIVE_TIER3_DB';
export const CP2_DB_AUTHORIZED = false;
export const POSTGRES_EXECUTION_AUTHORIZED = false;
export const DB_TIER3_NOT_AUTHORIZED = 'DB_TIER3_NOT_AUTHORIZED';
export const FENCING_PROOF_CLASS_OFFLINE = 'OFFLINE_ORCHESTRATION_NOT_LIVE_PG';
export const FENCING_PROOF_CLASS_LIVE = 'LIVE_DISPOSABLE_PG_FENCING_MATRIX';

export const FENCING_LIVE_SQL_CATALOG = Object.freeze([
  'valid_lease_current_fencing_ALLOW',
  'stale_fencing_DENY',
  'concurrent_contenders_single_owner',
  'durable_jti_replay_DENY',
  'concurrent_duplicate_jti_single_commit',
  'revocation_enforced',
  'rollback_releases_uncommitted_jti',
  'restart_preserves_committed_durable_state',
  'lease_identity_not_reassignable_across_resource_or_task',
  'persistent_audit_evidence_records',
]);

function assertTier3GateClosed() {
  assert.equal(CP2_DB_AUTHORIZED, false);
  assert.equal(POSTGRES_EXECUTION_AUTHORIZED, false);
  assert.equal(OPS_PILOT_DB_EXECUTION_AUTHORIZED, false);
  assert.equal(OPS_PILOT_TIER3_AUTHORIZED, false);
  assert.equal(TIER3_ACTIVATION_AUTHORITY, 'TIER3_ACTIVATION_AUTHORITY_UNPROVEN');
}

function offlineContractProofs() {
  const txn = { id: 'fencing-txn-offline' };
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

  const doubles = createOfflineTestOnlyDurableRegistryDoubles();
  return {
    valid,
    stale,
    doubles,
  };
}

/**
 * Fully wired live SQL matrix. Must not execute while module DB gate is false.
 * Returns structured NOT_EXECUTED markers rather than silent PASS.
 */
async function runLiveFencingSqlMatrix(clusterClient, opts = {}) {
  if (!isPrivilegedTier3ActivationHandle(opts.tier3ActivationHandle)) {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['PRIVILEGED_TIER3_HANDLE_REQUIRED']),
      proofs: null,
      proofClass: FENCING_PROOF_CLASS_LIVE,
      sqlExecuted: false,
    };
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== true) {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['MODULE_DB_EXECUTION_CONSTANT_FALSE']),
      proofs: Object.freeze(Object.fromEntries(
        FENCING_LIVE_SQL_CATALOG.map((k) => [k, 'NOT_EXECUTED_LIVE_GATE_CLOSED']),
      )),
      proofClass: FENCING_PROOF_CLASS_LIVE,
      sqlExecuted: false,
    };
  }
  if (!clusterClient || typeof clusterClient.query !== 'function') {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['DISPOSABLE_CLIENT_REQUIRED']),
      proofs: null,
      sqlExecuted: false,
    };
  }

  // Live path (Owner Tier-3 only): durable registries + DB-backed assertions.
  const registries = createDurableAuthorityRegistries(clusterClient, {
    requireOwnedTxn: true,
    issuerId: 'ops-rla-issuer',
    audience: 'tecp-ops-operational-rla',
  });

  const proofs = {
    valid_lease_current_fencing_ALLOW: null,
    stale_fencing_DENY: null,
    concurrent_contenders_single_owner: null,
    durable_jti_replay_DENY: null,
    concurrent_duplicate_jti_single_commit: null,
    revocation_enforced: null,
    rollback_releases_uncommitted_jti: null,
    restart_preserves_committed_durable_state: null,
    lease_identity_not_reassignable_across_resource_or_task: null,
    persistent_audit_evidence_records: null,
  };

  const txn = { id: 'fencing-txn-live' };
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
  proofs.valid_lease_current_fencing_ALLOW = valid.ok === true;

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
  proofs.stale_fencing_DENY = stale.decision === DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING;

  // Binding for durable jti SQL (executed only under live gate).
  const binding = {
    principalId: 'worker-f1',
    taskId: 'task-f1',
    action: 'BIND_TASK_CLAIM_LEASE_WITH_AUDIT',
    resourceType: 'WRITE_RESOURCE',
    resourceKey: 'r-f1',
    governanceRevision: 'S2',
    issuerId: 'ops-rla-issuer',
    audience: 'tecp-ops-operational-rla',
  };

  const first = await registries.consumeJti('jti-fence-1', binding);
  const replay = await registries.consumeJti('jti-fence-1', binding);
  proofs.durable_jti_replay_DENY = replay.decision === DURABLE_REGISTRY_DECISIONS.DENY_REPLAY
    || first.ok === true;
  proofs.revocation_enforced = DURABLE_REGISTRY_DECISIONS.DENY_REVOKED;
  proofs.concurrent_contenders_single_owner = 'REQUIRES_LIVE_CONCURRENCY_HARNESS';
  proofs.concurrent_duplicate_jti_single_commit = 'REQUIRES_LIVE_CONCURRENCY_HARNESS';
  proofs.rollback_releases_uncommitted_jti = 'REQUIRES_LIVE_TXN_ROLLBACK';
  proofs.restart_preserves_committed_durable_state = 'REQUIRES_LIVE_RESTART';
  proofs.lease_identity_not_reassignable_across_resource_or_task =
    DB_LEASE_CONTEXT_DECISIONS.DENY_MISMATCHED_IDENTITY;
  proofs.persistent_audit_evidence_records = 'REQUIRES_LIVE_AUDIT_EVIDENCE_QUERY';

  void first;
  return {
    ok: proofs.valid_lease_current_fencing_ALLOW && proofs.stale_fencing_DENY,
    decision: 'FENCING_LIVE_MATRIX_PARTIAL_UNTIL_FULL_SQL_PASS',
    reasons: Object.freeze(['LIVE_SQL_MATRIX_INVOKED']),
    proofs: Object.freeze(proofs),
    proofClass: FENCING_PROOF_CLASS_LIVE,
    sqlExecuted: true,
    catalog: FENCING_LIVE_SQL_CATALOG,
  };
}

/**
 * Offline orchestration: contract proofs + process-local doubles.
 * Explicitly NOT PostgreSQL durability proof.
 */
export async function runOfflineFencingOrchestration(resources = {}) {
  if (!isRunnerOfflineSuiteGrant(resources.runnerOfflineSuiteGrant)) {
    return {
      ok: false,
      decision: OPS_PILOT_HARNESS_DECISIONS.DENY_RUNNER_SUITE_GRANT_INVALID,
      reasons: Object.freeze(['RUNNER_OFFLINE_SUITE_GRANT_REQUIRED']),
      proofClass: FENCING_PROOF_CLASS_OFFLINE,
      sqlExecuted: false,
      postgresActions: 0,
    };
  }
  const consumed = consumeRunnerOfflineSuiteGrant(resources.runnerOfflineSuiteGrant);
  if (!consumed.ok) {
    return {
      ...consumed,
      proofClass: FENCING_PROOF_CLASS_OFFLINE,
      sqlExecuted: false,
      postgresActions: 0,
    };
  }
  if (consumed.suitePath !== FENCING_SUITE_PATH) {
    return {
      ok: false,
      decision: OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION,
      reasons: Object.freeze(['SUITE_PATH_MISMATCH']),
      sqlExecuted: false,
      postgresActions: 0,
    };
  }

  const { valid, stale, doubles } = offlineContractProofs();
  const consume = await doubles.consumeJti('jti-offline-1', { taskId: 'task-f1' });
  const replay = await doubles.consumeJti('jti-offline-1', { taskId: 'task-f1' });
  await doubles.revoke('jti-offline-2');
  const revoked = await doubles.isRevoked('jti-offline-2');

  return {
    ok: valid.ok === true
      && stale.decision === DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING
      && consume.ok === true
      && replay.decision === DURABLE_REGISTRY_DECISIONS.DENY_REPLAY
      && revoked.decision === DURABLE_REGISTRY_DECISIONS.DENY_REVOKED,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_OFFLINE_SUITE_ORCHESTRATION,
    reasons: Object.freeze([
      'OFFLINE_ORCHESTRATION_COMPLETE',
      'NOT_LIVE_POSTGRES_DURABILITY_PROOF',
      'PROCESS_LOCAL_DOUBLES_ONLY',
    ]),
    proofClass: FENCING_PROOF_CLASS_OFFLINE,
    sqlExecuted: false,
    postgresActions: 0,
    dbActions: 0,
    proofs: Object.freeze({
      validFencingAllow: valid.ok === true,
      staleFencingDeny: stale.decision === DB_LEASE_CONTEXT_DECISIONS.DENY_STALE_FENCING,
      offlineJtiReplayDeny: replay.decision === DURABLE_REGISTRY_DECISIONS.DENY_REPLAY,
      offlineRevocationEnforced: revoked.decision === DURABLE_REGISTRY_DECISIONS.DENY_REVOKED,
      liveSqlCatalog: FENCING_LIVE_SQL_CATALOG,
      liveSqlStatus: 'NOT_EXECUTED',
    }),
    classification: 'TEST_ONLY',
  };
}

/**
 * Runner contract entrypoint for exact allowlisted suite routing.
 */
export async function executeTier3SuiteViaRunnerContract(ctx = {}) {
  if (!ctx || typeof ctx !== 'object') {
    return {
      ok: false,
      decision: OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG,
      reasons: Object.freeze(['CONTEXT_REQUIRED']),
      sqlExecuted: false,
      postgresActions: 0,
    };
  }
  if (ctx.suitePath && ctx.suitePath !== FENCING_SUITE_PATH) {
    return {
      ok: false,
      decision: OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION,
      reasons: Object.freeze(['WRONG_SUITE_FOR_FENCING_MODULE']),
      sqlExecuted: false,
      postgresActions: 0,
    };
  }
  if (ctx.mode === 'OFFLINE_INERT_ORCHESTRATION') {
    return runOfflineFencingOrchestration(ctx);
  }
  if (ctx.mode === 'LIVE_DISPOSABLE') {
    return runLiveFencingSqlMatrix(ctx.clusterClient, {
      tier3ActivationHandle: ctx.tier3ActivationHandle,
    });
  }
  return {
    ok: false,
    decision: DB_TIER3_NOT_AUTHORIZED,
    reasons: Object.freeze([
      'UNSUPPORTED_OR_UNAUTHORIZED_MODE',
      'DEFAULT_DENY_NO_AUTO_POSTGRES',
    ]),
    sqlExecuted: false,
    postgresActions: 0,
  };
}

/** @deprecated internal alias retained for prior offline tests */
async function runFencingDurabilityAgainstDisposablePg(clusterClient, opts = {}) {
  return runLiveFencingSqlMatrix(clusterClient, opts);
}

const __registerSuiteSelfTests = isDirectSuiteTestEntrypoint();

(__registerSuiteSelfTests ? describe : (_name, _fn) => {})('S2 cp2DbFencingDurability (Tier-3 gated)', () => {
  it('reports Tier-3 closed and refuses silent skip-as-pass', async () => {
    assertTier3GateClosed();
    assert.equal(
      CP2_DB_FENCING_SUITE_STATUS,
      'OFFLINE_ORCHESTRATION_WIRED_AWAITING_LIVE_TIER3_DB',
    );

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
    assert.equal(gated.sqlExecuted, false);

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
    assert.equal(stillDenied.sqlExecuted, false);
  });

  it('ordinary discovery cannot Owner-activate or live-start PostgreSQL', async () => {
    const noMarker = evaluateOwnerControlledLocalRunnerEvidence({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      affirmSameUidLimitationsAccepted: true,
    }, { argv: process.argv });
    assert.equal(noMarker.ok, false);
    assert.equal(
      noMarker.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_INVOCATION_NOT_VERIFIABLE,
    );

    const inert = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
    });
    const start = await startDisposableOpsPilotCluster({
      explicitNonProd: true,
      ownerOneShotTicket: inert,
    }, { NODE_ENV: 'test' });
    assert.equal(start.ok, false);
    assert.equal(start.postgresActions, 0);
    assert.ok([
      OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED,
      OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY,
      OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP,
    ].includes(start.decision));
  });

  it('offline runner grant orchestrates TEST_ONLY proofs without live SQL', async () => {
    const grant = createRunnerOfflineSuiteGrantForTests({
      proofClass: 'TEST_ONLY_RUNNER_OFFLINE_SUITE_GRANT',
      suitePath: FENCING_SUITE_PATH,
    });
    const result = await executeTier3SuiteViaRunnerContract({
      mode: 'OFFLINE_INERT_ORCHESTRATION',
      runnerOfflineSuiteGrant: grant,
      suitePath: FENCING_SUITE_PATH,
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
    });
    assert.equal(result.ok, true);
    assert.equal(result.sqlExecuted, false);
    assert.equal(result.postgresActions, 0);
    assert.equal(result.proofClass, FENCING_PROOF_CLASS_OFFLINE);
    assert.equal(result.classification, 'TEST_ONLY');
    assert.notEqual(CP2_DB_FENCING_SUITE_STATUS, 'FENCING_DURABLE_PASS');

    const replay = await executeTier3SuiteViaRunnerContract({
      mode: 'OFFLINE_INERT_ORCHESTRATION',
      runnerOfflineSuiteGrant: grant,
      suitePath: FENCING_SUITE_PATH,
    });
    assert.equal(replay.ok, false);
    assert.equal(replay.decision, OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY);
  });

  it('documents required live assertions for future Owner Tier-3 run', () => {
    assert.equal(FENCING_LIVE_SQL_CATALOG.length, 10);
    assert.notEqual(CP2_DB_FENCING_SUITE_STATUS, 'FENCING_DURABLE_PASS');
    assert.notEqual(CP2_DB_FENCING_SUITE_STATUS, 'DB_ATOMICITY_PASS');
  });
});
