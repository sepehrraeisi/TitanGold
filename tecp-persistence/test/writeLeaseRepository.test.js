/**
 * TECP-DLP-001 disposable WRITE lease concurrency and fencing tests.
 * NON_OPERATIONAL proof. Requires local ephemeral PostgreSQL via harness.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, test } from 'node:test';

import {
  APPROVED_GOVERNANCE_REVISION,
  PG_READY_FOR_QUERY_STATUS,
  WRITE_LEASE_DECISIONS,
  WRITE_LEASE_TXN_OWNER_GUC,
  WRITE_LEASE_TXN_OWNER_TOKEN,
  acquireWriteLease,
  acquireWriteLeaseInTransaction,
  assertClientIdleForOwnedWriteLeaseTransaction,
  assertOwnedWriteLeaseTransaction,
  readPgReadyForQueryStatus,
  releaseWriteLease,
  releaseWriteLeaseInTransaction,
  renewWriteLease,
  renewWriteLeaseInTransaction,
  validateWriteLease,
  withOwnedWriteLeaseTransaction,
} from '../src/writeLeaseRepository.js';
import {
  HARNESS_ROOT_PREFIX,
  POSTMASTER_STATUS,
  assertVerifiedHarnessPaths,
  createDisposablePgHarness,
  inspectPostmasterStatus,
  isPostmasterRunning,
  removeHarnessRootIfSafe,
  stopClusterAndProveTerminated,
} from './disposablePgHarness.js';

const RESOURCE = Object.freeze({
  resourceType: 'task_worktree',
  resourceKey: 'resource-canonical-1',
});

let harness;
let isolationEvidence;

before(async () => {
  harness = createDisposablePgHarness();
  isolationEvidence = await harness.proveIsolation();
  await harness.createProofDatabase();
});

after(async () => {
  if (harness) {
    await harness.stop();
  }
});

function baseAcquire(overrides = {}) {
  return {
    ...RESOURCE,
    leaseKey: 'lease-a',
    actorId: 'actor-a',
    taskId: 'task-a',
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    idempotencyKey: 'idem-a',
    ttlMs: 30_000,
    ...overrides,
  };
}

async function countActiveOwners(client, resource = RESOURCE) {
  const r = await client.query(
    `SELECT count(*)::int AS n
       FROM dlp_write_lease
      WHERE resource_type = $1
        AND resource_key = $2
        AND status = 'ACTIVE'
        AND expires_at > clock_timestamp()`,
    [resource.resourceType, resource.resourceKey],
  );
  return r.rows[0].n;
}

async function fenceEpoch(client, resource = RESOURCE) {
  const r = await client.query(
    `SELECT fencing_epoch::bigint AS e
       FROM dlp_write_resource_fence
      WHERE resource_type = $1 AND resource_key = $2`,
    [resource.resourceType, resource.resourceKey],
  );
  return r.rowCount === 0 ? null : Number(r.rows[0].e);
}

test('isolation evidence: unix socket only, no env DB URL, listen_addresses empty', () => {
  assert.equal(isolationEvidence.listenAddresses, '');
  assert.equal(isolationEvidence.tcpRejected, true);
  assert.equal(isolationEvidence.databaseUrlUsed, false);
  assert.match(isolationEvidence.postgresVersion, /^postgres \(PostgreSQL\) 14\.24/);
  assert.ok(isolationEvidence.socketDir);
  console.log('DLP001_ISOLATION', JSON.stringify({
    postgresVersion: isolationEvidence.postgresVersion,
    listenAddresses: isolationEvidence.listenAddresses,
    tcpRejected: isolationEvidence.tcpRejected,
    databaseUrlUsed: isolationEvidence.databaseUrlUsed,
    socketPort: isolationEvidence.socketPort,
    isolationFingerprint: harness.isolationFingerprint,
  }));
});

test('two simultaneous competing acquisitions: exactly one committed owner', async () => {
  const resource = { resourceType: 'task_worktree', resourceKey: 'race-2' };
  const c1 = await harness.createClient();
  const c2 = await harness.createClient();
  try {
    const [a, b] = await Promise.all([
      acquireWriteLease(c1, baseAcquire({
        ...resource,
        leaseKey: 'lease-r2-a',
        actorId: 'actor-r2-a',
        taskId: 'task-r2-a',
        idempotencyKey: 'idem-r2-a',
      })),
      acquireWriteLease(c2, baseAcquire({
        ...resource,
        leaseKey: 'lease-r2-b',
        actorId: 'actor-r2-b',
        taskId: 'task-r2-b',
        idempotencyKey: 'idem-r2-b',
      })),
    ]);
    const granted = [a, b].filter((x) => x.decision === WRITE_LEASE_DECISIONS.GRANTED);
    const denied = [a, b].filter((x) => x.decision === WRITE_LEASE_DECISIONS.DENY_OWNED);
    assert.equal(granted.length, 1);
    assert.equal(denied.length, 1);
    assert.equal(await countActiveOwners(c1, resource), 1);
    console.log('DLP001_RACE2', JSON.stringify({
      grantedActor: granted[0].lease.actorId,
      deniedDecision: denied[0].decision,
      fencingEpoch: granted[0].lease.fencingEpoch,
    }));
  } finally {
    await c1.end();
    await c2.end();
  }
});

test('10+ simultaneous competing acquisitions on independent connections: one owner, no ghost state', async () => {
  const resource = { resourceType: 'task_worktree', resourceKey: 'race-12' };
  const N = 12;
  const clients = [];
  for (let i = 0; i < N; i += 1) {
    clients.push(await harness.createClient());
  }
  try {
    const results = await Promise.all(clients.map((client, i) => acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: `lease-r12-${i}`,
      actorId: `actor-r12-${i}`,
      taskId: `task-r12-${i}`,
      idempotencyKey: `idem-r12-${i}`,
    }))));
    const granted = results.filter((x) => x.decision === WRITE_LEASE_DECISIONS.GRANTED);
    const denied = results.filter((x) => x.decision === WRITE_LEASE_DECISIONS.DENY_OWNED);
    assert.equal(granted.length, 1);
    assert.equal(denied.length, N - 1);
    assert.equal(await countActiveOwners(clients[0], resource), 1);

    const leaseRows = await clients[0].query(
      `SELECT count(*)::int AS n FROM dlp_write_lease
        WHERE resource_type = $1 AND resource_key = $2`,
      [resource.resourceType, resource.resourceKey],
    );
    assert.equal(leaseRows.rows[0].n, 1);
    console.log('DLP001_RACE12', JSON.stringify({
      contenders: N,
      granted: granted.length,
      denied: denied.length,
      fencingEpoch: granted[0].lease.fencingEpoch,
    }));
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
});

test('idempotent replay returns original grant; conflicting key DENY', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'idem-1' };
    const first = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-idem',
      actorId: 'actor-idem',
      taskId: 'task-idem',
      idempotencyKey: 'idem-same',
    }));
    assert.equal(first.decision, WRITE_LEASE_DECISIONS.GRANTED);

    const replay = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-idem',
      actorId: 'actor-idem',
      taskId: 'task-idem',
      idempotencyKey: 'idem-same',
    }));
    assert.equal(replay.decision, WRITE_LEASE_DECISIONS.REPLAY);
    assert.equal(replay.lease.fencingEpoch, first.lease.fencingEpoch);
    assert.equal(replay.lease.leaseKey, first.lease.leaseKey);

    const conflict = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-idem-other',
      actorId: 'actor-idem-other',
      taskId: 'task-idem-other',
      idempotencyKey: 'idem-same',
    }));
    assert.equal(conflict.decision, WRITE_LEASE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    assert.equal(await countActiveOwners(client, resource), 1);
  } finally {
    await client.end();
  }
});

test('stale fencing epoch after expiry/regrant is denied; successor unaffected', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'fence-1' };
    const first = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-old',
      actorId: 'actor-old',
      taskId: 'task-old',
      idempotencyKey: 'idem-old',
      ttlMs: 200,
    }));
    assert.equal(first.decision, WRITE_LEASE_DECISIONS.GRANTED);
    const oldEpoch = first.lease.fencingEpoch;

    await delay(350);

    const second = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-new',
      actorId: 'actor-new',
      taskId: 'task-new',
      idempotencyKey: 'idem-new',
      ttlMs: 30_000,
    }));
    assert.equal(second.decision, WRITE_LEASE_DECISIONS.GRANTED);
    assert.ok(second.lease.fencingEpoch > oldEpoch);

    const staleRenew = await renewWriteLease(client, {
      ...resource,
      leaseKey: 'lease-old',
      actorId: 'actor-old',
      taskId: 'task-old',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: oldEpoch,
      expectedVersion: first.lease.version,
      ttlMs: 30_000,
    });
    assert.equal(staleRenew.decision, WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH);

    const staleRelease = await releaseWriteLease(client, {
      ...resource,
      leaseKey: 'lease-old',
      actorId: 'actor-old',
      taskId: 'task-old',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: oldEpoch,
      expectedVersion: first.lease.version,
    });
    assert.equal(staleRelease.decision, WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH);

    const stillValid = await validateWriteLease(client, {
      ...resource,
      leaseKey: 'lease-new',
      actorId: 'actor-new',
      taskId: 'task-new',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: second.lease.fencingEpoch,
    });
    assert.equal(stillValid.decision, WRITE_LEASE_DECISIONS.VALID);
    assert.equal(await fenceEpoch(client, resource), second.lease.fencingEpoch);
  } finally {
    await client.end();
  }
});

test('foreign actor renew/release DENY; owner unaffected', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'foreign-1' };
    const owned = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-owner',
      actorId: 'actor-owner',
      taskId: 'task-owner',
      idempotencyKey: 'idem-owner',
    }));
    assert.equal(owned.decision, WRITE_LEASE_DECISIONS.GRANTED);

    const foreignRenew = await renewWriteLease(client, {
      ...resource,
      leaseKey: 'lease-owner',
      actorId: 'actor-foreign',
      taskId: 'task-owner',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: owned.lease.fencingEpoch,
      expectedVersion: owned.lease.version,
      ttlMs: 30_000,
    });
    assert.equal(foreignRenew.decision, WRITE_LEASE_DECISIONS.DENY_FOREIGN_ACTOR);

    const foreignRelease = await releaseWriteLease(client, {
      ...resource,
      leaseKey: 'lease-owner',
      actorId: 'actor-foreign',
      taskId: 'task-owner',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: owned.lease.fencingEpoch,
      expectedVersion: owned.lease.version,
    });
    assert.equal(foreignRelease.decision, WRITE_LEASE_DECISIONS.DENY_FOREIGN_ACTOR);

    const valid = await validateWriteLease(client, {
      ...resource,
      leaseKey: 'lease-owner',
      actorId: 'actor-owner',
      taskId: 'task-owner',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: owned.lease.fencingEpoch,
    });
    assert.equal(valid.decision, WRITE_LEASE_DECISIONS.VALID);
  } finally {
    await client.end();
  }
});

test('invalid governance revision DENY on acquire/renew/release', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'gov-1' };
    const bad = await acquireWriteLease(client, baseAcquire({
      ...resource,
      governanceRevision: 'NOT_AN_APPROVED_REVISION',
      idempotencyKey: 'idem-gov-bad',
      leaseKey: 'lease-gov-bad',
    }));
    assert.equal(bad.decision, WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
    assert.equal(await countActiveOwners(client, resource), 0);

    const good = await acquireWriteLease(client, baseAcquire({
      ...resource,
      idempotencyKey: 'idem-gov-good',
      leaseKey: 'lease-gov-good',
      actorId: 'actor-gov',
      taskId: 'task-gov',
    }));
    assert.equal(good.decision, WRITE_LEASE_DECISIONS.GRANTED);

    const badRenew = await renewWriteLease(client, {
      ...resource,
      leaseKey: good.lease.leaseKey,
      actorId: good.lease.actorId,
      taskId: good.lease.taskId,
      governanceRevision: 'WRONG_REV',
      fencingEpoch: good.lease.fencingEpoch,
      expectedVersion: good.lease.version,
      ttlMs: 30_000,
    });
    assert.equal(badRenew.decision, WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);

    const badRelease = await releaseWriteLease(client, {
      ...resource,
      leaseKey: good.lease.leaseKey,
      actorId: good.lease.actorId,
      taskId: good.lease.taskId,
      governanceRevision: 'WRONG_REV',
      fencingEpoch: good.lease.fencingEpoch,
      expectedVersion: good.lease.version,
    });
    assert.equal(badRelease.decision, WRITE_LEASE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  } finally {
    await client.end();
  }
});

test('mid-transaction failure rolls back; no ghost ownership or partial state', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'rollback-1' };
    let updates = 0;
    const sabotaged = {
      connection: client.connection,
      query: async (sql, params) => {
        const text = String(sql);
        if (/UPDATE dlp_write_resource_fence/i.test(text)) {
          updates += 1;
          const out = await client.query(sql, params);
          throw new Error('injected mid-transaction failure');
        }
        return client.query(sql, params);
      },
    };

    await assert.rejects(
      () => acquireWriteLease(sabotaged, baseAcquire({
        ...resource,
        leaseKey: 'lease-rb',
        actorId: 'actor-rb',
        taskId: 'task-rb',
        idempotencyKey: 'idem-rb',
      })),
      /injected mid-transaction failure/,
    );
    assert.ok(updates >= 1);
    assert.equal(await countActiveOwners(client, resource), 0);
    const leases = await client.query(
      `SELECT count(*)::int AS n FROM dlp_write_lease
        WHERE resource_type = $1 AND resource_key = $2`,
      [resource.resourceType, resource.resourceKey],
    );
    assert.equal(leases.rows[0].n, 0);
    // Fence insert may exist at epoch 0, but bump must have rolled back.
    const epoch = await fenceEpoch(client, resource);
    assert.ok(epoch === null || epoch === 0);
  } finally {
    await client.end();
  }
});

test('database outage fails closed with no forged success', async () => {
  const client = await harness.createClient();
  await client.end();

  const outageAcquire = await acquireWriteLease(client, baseAcquire({
    resourceKey: 'outage-1',
    idempotencyKey: 'idem-outage',
    leaseKey: 'lease-outage',
  }));
  assert.equal(outageAcquire.ok, false);
  assert.equal(outageAcquire.decision, WRITE_LEASE_DECISIONS.BLOCKED_DB_FAILURE);

  const outageRenew = await renewWriteLease(client, {
    ...RESOURCE,
    resourceKey: 'outage-1',
    leaseKey: 'lease-outage',
    actorId: 'actor-a',
    taskId: 'task-a',
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    fencingEpoch: 1,
    expectedVersion: 1,
    ttlMs: 1000,
  });
  assert.equal(outageRenew.decision, WRITE_LEASE_DECISIONS.BLOCKED_DB_FAILURE);
});

test('owner renew/release happy path with CAS version and fencing bind', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'happy-1' };
    const granted = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-happy',
      actorId: 'actor-happy',
      taskId: 'task-happy',
      idempotencyKey: 'idem-happy',
    }));
    assert.equal(granted.decision, WRITE_LEASE_DECISIONS.GRANTED);

    const renewed = await renewWriteLease(client, {
      ...resource,
      leaseKey: granted.lease.leaseKey,
      actorId: granted.lease.actorId,
      taskId: granted.lease.taskId,
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: granted.lease.fencingEpoch,
      expectedVersion: granted.lease.version,
      ttlMs: 30_000,
    });
    assert.equal(renewed.decision, WRITE_LEASE_DECISIONS.RENEWED);
    assert.equal(renewed.lease.version, granted.lease.version + 1);

    const released = await releaseWriteLease(client, {
      ...resource,
      leaseKey: renewed.lease.leaseKey,
      actorId: renewed.lease.actorId,
      taskId: renewed.lease.taskId,
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: renewed.lease.fencingEpoch,
      expectedVersion: renewed.lease.version,
    });
    assert.equal(released.decision, WRITE_LEASE_DECISIONS.RELEASED);
    assert.equal(await countActiveOwners(client, resource), 0);

    // Fence epoch retained after release (no reset).
    const epochAfterRelease = await fenceEpoch(client, resource);
    assert.equal(epochAfterRelease, granted.lease.fencingEpoch);

    const regrant = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-happy-2',
      actorId: 'actor-happy-2',
      taskId: 'task-happy-2',
      idempotencyKey: 'idem-happy-2',
    }));
    assert.equal(regrant.decision, WRITE_LEASE_DECISIONS.GRANTED);
    assert.ok(regrant.lease.fencingEpoch > epochAfterRelease);
  } finally {
    await client.end();
  }
});

test('exports include public API plus caller-owned in-transaction entry points', async () => {
  const mod = await import('../src/writeLeaseRepository.js');
  const fns = Object.keys(mod).filter((k) => typeof mod[k] === 'function');
  assert.deepEqual(fns.sort(), [
    'acquireWriteLease',
    'acquireWriteLeaseInTransaction',
    'assertClientIdleForOwnedWriteLeaseTransaction',
    'assertOwnedWriteLeaseTransaction',
    'readPgReadyForQueryStatus',
    'releaseWriteLease',
    'releaseWriteLeaseInTransaction',
    'renewWriteLease',
    'renewWriteLeaseInTransaction',
    'validateWriteLease',
    'withOwnedWriteLeaseTransaction',
  ].sort());
  assert.equal(mod.APPROVED_GOVERNANCE_REVISION, 'DLP001_REACTIVATION_20261031');
  assert.equal(mod.WRITE_LEASE_TXN_OWNER_GUC, WRITE_LEASE_TXN_OWNER_GUC);
  assert.equal(mod.WRITE_LEASE_TXN_OWNER_TOKEN, WRITE_LEASE_TXN_OWNER_TOKEN);
  assert.equal(
    mod.WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP,
    'DENY_NO_TRANSACTION_OWNERSHIP',
  );
  assert.equal(mod.WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE, 'DENY_CLIENT_NOT_IDLE');
  assert.equal(
    mod.WRITE_LEASE_DECISIONS.DENY_TRANSACTION_STATUS_UNVERIFIABLE,
    'DENY_TRANSACTION_STATUS_UNVERIFIABLE',
  );
  assert.deepEqual(mod.PG_READY_FOR_QUERY_STATUS, {
    IDLE: 'I',
    IN_TRANSACTION: 'T',
    IN_FAILED_TRANSACTION: 'E',
  });
});

test('DLP-002: bare client / bare BEGIN denied; owned txn acquire works without nested COMMIT trap', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'owned-txn-1' };
    const bare = await acquireWriteLeaseInTransaction(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-bare',
      actorId: 'actor-bare',
      taskId: 'task-bare',
      idempotencyKey: 'idem-bare',
    }));
    assert.equal(bare.decision, WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP);
    assert.equal(await countActiveOwners(client, resource), 0);

    await client.query('BEGIN');
    const unmarked = await acquireWriteLeaseInTransaction(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-unmarked',
      actorId: 'actor-unmarked',
      taskId: 'task-unmarked',
      idempotencyKey: 'idem-unmarked',
    }));
    assert.equal(unmarked.decision, WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP);
    await client.query('ROLLBACK');
    assert.equal(await countActiveOwners(client, resource), 0);

    const granted = await withOwnedWriteLeaseTransaction(client, async () => {
      await assertOwnedWriteLeaseTransaction(client);
      return acquireWriteLeaseInTransaction(client, baseAcquire({
        ...resource,
        leaseKey: 'lease-owned',
        actorId: 'actor-owned',
        taskId: 'task-owned',
        idempotencyKey: 'idem-owned',
      }));
    });
    assert.equal(granted.decision, WRITE_LEASE_DECISIONS.GRANTED);
    assert.equal(await countActiveOwners(client, resource), 1);

    // In-txn APIs must not execute BEGIN/COMMIT/ROLLBACK themselves.
    const src = await import('node:fs').then((fs) => fs.readFileSync(
      new URL('../src/writeLeaseRepository.js', import.meta.url),
      'utf8',
    ));
    const inTxnBlock = src.slice(
      src.indexOf('export async function acquireWriteLeaseInTransaction'),
      src.indexOf('export async function acquireWriteLease('),
    );
    const codeOnly = inTxnBlock
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.equal(/['"]BEGIN['"]/.test(codeOnly), false);
    assert.equal(/['"]COMMIT['"]/.test(codeOnly), false);
    assert.equal(/['"]ROLLBACK['"]/.test(codeOnly), false);
    assert.equal(/query\(\s*['"]BEGIN['"]/i.test(codeOnly), false);
    assert.equal(/query\(\s*['"]COMMIT['"]/i.test(codeOnly), false);
    assert.equal(/query\(\s*['"]ROLLBACK['"]/i.test(codeOnly), false);
  } finally {
    await client.end();
  }
});

test('DLP-002: failure after fencing bump inside owned txn rolls back; no ghost owner', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'owned-fence-rb' };
    const epochBefore = await fenceEpoch(client, resource);
    let bumped = 0;
    const sabotaged = {
      connection: client.connection,
      query: async (sql, params) => {
        const text = String(sql);
        if (/UPDATE dlp_write_resource_fence/i.test(text)) {
          bumped += 1;
          const out = await client.query(sql, params);
          throw new Error('injected owned-txn fencing failure');
        }
        return client.query(sql, params);
      },
    };

    await assert.rejects(
      () => withOwnedWriteLeaseTransaction(sabotaged, async () => (
        acquireWriteLeaseInTransaction(sabotaged, baseAcquire({
          ...resource,
          leaseKey: 'lease-fence-rb',
          actorId: 'actor-fence-rb',
          taskId: 'task-fence-rb',
          idempotencyKey: 'idem-fence-rb',
        }))
      )),
      /injected owned-txn fencing failure/,
    );

    assert.ok(bumped >= 1);
    assert.equal(await countActiveOwners(client, resource), 0);
    const epochAfter = await fenceEpoch(client, resource);
    assert.ok(epochAfter === null || epochAfter === 0 || epochAfter === epochBefore);
  } finally {
    await client.end();
  }
});

test('DLP-002: composition DENY_OWNED aborts owned txn without committing a second owner', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'owned-deny-abort' };
    const first = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-first',
      actorId: 'actor-first',
      taskId: 'task-first',
      idempotencyKey: 'idem-first',
    }));
    assert.equal(first.decision, WRITE_LEASE_DECISIONS.GRANTED);

    await assert.rejects(
      () => withOwnedWriteLeaseTransaction(client, async () => {
        const denied = await acquireWriteLeaseInTransaction(client, baseAcquire({
          ...resource,
          leaseKey: 'lease-second',
          actorId: 'actor-second',
          taskId: 'task-second',
          idempotencyKey: 'idem-second',
        }));
        assert.equal(denied.decision, WRITE_LEASE_DECISIONS.DENY_OWNED);
        throw Object.assign(new Error('COMPOSITION_DENY'), { deny: denied });
      }),
      /COMPOSITION_DENY/,
    );

    assert.equal(await countActiveOwners(client, resource), 1);
    const owner = await validateWriteLease(client, {
      ...resource,
      leaseKey: first.lease.leaseKey,
      actorId: first.lease.actorId,
      taskId: first.lease.taskId,
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: first.lease.fencingEpoch,
    });
    assert.equal(owner.decision, WRITE_LEASE_DECISIONS.VALID);
  } finally {
    await client.end();
  }
});

test('B1: idle client begins valid owned transaction; protocol status I/T round-trip', async () => {
  const client = await harness.createClient();
  try {
    assert.equal(await readPgReadyForQueryStatus(client), PG_READY_FOR_QUERY_STATUS.IDLE);
    await assertClientIdleForOwnedWriteLeaseTransaction(client);

    const granted = await withOwnedWriteLeaseTransaction(client, async () => {
      assert.equal(await readPgReadyForQueryStatus(client), PG_READY_FOR_QUERY_STATUS.IN_TRANSACTION);
      await assertOwnedWriteLeaseTransaction(client);
      return acquireWriteLeaseInTransaction(client, baseAcquire({
        resourceKey: 'b1-idle-ok',
        leaseKey: 'lease-b1-idle',
        actorId: 'actor-b1-idle',
        taskId: 'task-b1-idle',
        idempotencyKey: 'idem-b1-idle',
      }));
    });
    assert.equal(granted.decision, WRITE_LEASE_DECISIONS.GRANTED);
    assert.equal(await readPgReadyForQueryStatus(client), PG_READY_FOR_QUERY_STATUS.IDLE);
  } finally {
    await client.end();
  }
});

test('B1: unmarked BEGIN rejected before inner BEGIN; no nested COMMIT of outer writes', async () => {
  const owner = await harness.createClient();
  const observer = await harness.createClient();
  try {
    await owner.query('BEGIN');
    await owner.query(
      `INSERT INTO dlp_write_resource_fence (resource_type, resource_key, fencing_epoch)
       VALUES ('task_worktree', 'b1-outer-unmarked', 0)`,
    );

    // Invisible to second connection before commit.
    const before = await observer.query(
      `SELECT 1 FROM dlp_write_resource_fence
        WHERE resource_type = 'task_worktree' AND resource_key = 'b1-outer-unmarked'`,
    );
    assert.equal(before.rowCount, 0);

    await assert.rejects(
      () => withOwnedWriteLeaseTransaction(owner, async () => 'should-not-run'),
      (err) => err && err.code === WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE
        && err.transactionStatus === PG_READY_FOR_QUERY_STATUS.IN_TRANSACTION,
    );

    const mid = await observer.query(
      `SELECT 1 FROM dlp_write_resource_fence
        WHERE resource_type = 'task_worktree' AND resource_key = 'b1-outer-unmarked'`,
    );
    assert.equal(mid.rowCount, 0);

    await owner.query('ROLLBACK');
    const after = await observer.query(
      `SELECT 1 FROM dlp_write_resource_fence
        WHERE resource_type = 'task_worktree' AND resource_key = 'b1-outer-unmarked'`,
    );
    assert.equal(after.rowCount, 0);
  } finally {
    try { await owner.query('ROLLBACK'); } catch { /* already idle */ }
    await owner.end();
    await observer.end();
  }
});

test('B1: existing marked/owned transaction is rejected (reentrancy guard)', async () => {
  const client = await harness.createClient();
  try {
    await assert.rejects(
      () => withOwnedWriteLeaseTransaction(client, async () => (
        withOwnedWriteLeaseTransaction(client, async () => 'nested-owned')
      )),
      (err) => err && err.code === WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE
        && err.transactionStatus === PG_READY_FOR_QUERY_STATUS.IN_TRANSACTION,
    );
    assert.equal(await readPgReadyForQueryStatus(client), PG_READY_FOR_QUERY_STATUS.IDLE);
  } finally {
    await client.end();
  }
});

test('B1: aborted transaction rejected without COMMIT of outer failed work', async () => {
  const owner = await harness.createClient();
  const observer = await harness.createClient();
  try {
    await owner.query('BEGIN');
    await owner.query(
      `INSERT INTO dlp_write_resource_fence (resource_type, resource_key, fencing_epoch)
       VALUES ('task_worktree', 'b1-aborted-outer', 0)`,
    );
    await assert.rejects(
      () => owner.query('SELECT * FROM definitely_missing_relation_b1_abort'),
      /does not exist|definitely_missing_relation_b1_abort/,
    );
    assert.equal(
      await readPgReadyForQueryStatus(owner),
      PG_READY_FOR_QUERY_STATUS.IN_FAILED_TRANSACTION,
    );

    await assert.rejects(
      () => withOwnedWriteLeaseTransaction(owner, async () => 'should-not-run'),
      (err) => err && err.code === WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE
        && err.transactionStatus === PG_READY_FOR_QUERY_STATUS.IN_FAILED_TRANSACTION,
    );

    const leaked = await observer.query(
      `SELECT 1 FROM dlp_write_resource_fence
        WHERE resource_type = 'task_worktree' AND resource_key = 'b1-aborted-outer'`,
    );
    assert.equal(leaked.rowCount, 0);

    await owner.query('ROLLBACK');
    assert.equal(await readPgReadyForQueryStatus(owner), PG_READY_FOR_QUERY_STATUS.IDLE);
  } finally {
    try { await owner.query('ROLLBACK'); } catch { /* already idle */ }
    await owner.end();
    await observer.end();
  }
});

test('B1: unknown/unverifiable transaction status fails closed when probe is nonsensical', async () => {
  const fake = {
    query: async () => {
      const err = new Error('synthetic probe failure');
      err.code = 'XX000';
      throw err;
    },
  };
  await assert.rejects(
    () => assertClientIdleForOwnedWriteLeaseTransaction(fake),
    (err) => err && err.code === WRITE_LEASE_DECISIONS.DENY_TRANSACTION_STATUS_UNVERIFIABLE,
  );
  await assert.rejects(
    () => withOwnedWriteLeaseTransaction(fake, async () => 'nope'),
    (err) => err && err.code === WRITE_LEASE_DECISIONS.DENY_TRANSACTION_STATUS_UNVERIFIABLE,
  );
});

test('B1: query-only wrapper without connection uses proven SAVEPOINT idle probe', async () => {
  const real = await harness.createClient();
  try {
    const wrapper = {
      query: (text, params) => real.query(text, params),
    };
    const granted = await withOwnedWriteLeaseTransaction(wrapper, async () => (
      acquireWriteLeaseInTransaction(wrapper, baseAcquire({
        resourceKey: 'b1-wrapper-idle',
        leaseKey: 'lease-b1-wrap',
        actorId: 'actor-b1-wrap',
        taskId: 'task-b1-wrap',
        idempotencyKey: 'idem-b1-wrap',
      }))
    ));
    assert.equal(granted.decision, WRITE_LEASE_DECISIONS.GRANTED);

    await real.query('BEGIN');
    await assert.rejects(
      () => withOwnedWriteLeaseTransaction(wrapper, async () => 'nope'),
      (err) => err && err.code === WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE,
    );
    await real.query('ROLLBACK');
  } finally {
    try { await real.query('ROLLBACK'); } catch { /* idle */ }
    await real.end();
  }
});

test('B1: prior transaction marker cannot authorize a later unmarked transaction', async () => {
  const client = await harness.createClient();
  try {
    await withOwnedWriteLeaseTransaction(client, async () => {
      await assertOwnedWriteLeaseTransaction(client);
      return 'ok';
    });
    await client.query('BEGIN');
    const guc = await client.query(
      'SELECT current_setting($1, true) AS owner',
      [WRITE_LEASE_TXN_OWNER_GUC],
    );
    assert.ok(guc.rows[0].owner == null || guc.rows[0].owner === '');
    await assert.rejects(
      () => assertOwnedWriteLeaseTransaction(client),
      (err) => err && err.code === WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP,
    );
    await assert.rejects(
      () => withOwnedWriteLeaseTransaction(client, async () => 'nope'),
      (err) => err && err.code === WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE,
    );
    await client.query('ROLLBACK');
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* idle */ }
    await client.end();
  }
});

test('FINDING1: expired/released/superseded idempotency replay is never ACTIVE/usable', async () => {
  const client = await harness.createClient();
  try {
    const expiredResource = { resourceType: 'task_worktree', resourceKey: 'idem-expired' };
    const expiredGrant = await acquireWriteLease(client, baseAcquire({
      ...expiredResource,
      leaseKey: 'lease-idem-exp',
      actorId: 'actor-idem-exp',
      taskId: 'task-idem-exp',
      idempotencyKey: 'idem-exp-key',
      ttlMs: 200,
    }));
    assert.equal(expiredGrant.decision, WRITE_LEASE_DECISIONS.GRANTED);
    await delay(350);
    const expiredReplay = await acquireWriteLease(client, baseAcquire({
      ...expiredResource,
      leaseKey: 'lease-idem-exp',
      actorId: 'actor-idem-exp',
      taskId: 'task-idem-exp',
      idempotencyKey: 'idem-exp-key',
      ttlMs: 30_000,
    }));
    assert.equal(expiredReplay.ok, false);
    assert.equal(expiredReplay.decision, WRITE_LEASE_DECISIONS.DENY_EXPIRED);
    assert.notEqual(expiredReplay.lease?.status, undefined);

    const releasedResource = { resourceType: 'task_worktree', resourceKey: 'idem-released' };
    const releasedGrant = await acquireWriteLease(client, baseAcquire({
      ...releasedResource,
      leaseKey: 'lease-idem-rel',
      actorId: 'actor-idem-rel',
      taskId: 'task-idem-rel',
      idempotencyKey: 'idem-rel-key',
    }));
    assert.equal(releasedGrant.decision, WRITE_LEASE_DECISIONS.GRANTED);
    const released = await releaseWriteLease(client, {
      ...releasedResource,
      leaseKey: releasedGrant.lease.leaseKey,
      actorId: releasedGrant.lease.actorId,
      taskId: releasedGrant.lease.taskId,
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: releasedGrant.lease.fencingEpoch,
      expectedVersion: releasedGrant.lease.version,
    });
    assert.equal(released.decision, WRITE_LEASE_DECISIONS.RELEASED);
    const releasedReplay = await acquireWriteLease(client, baseAcquire({
      ...releasedResource,
      leaseKey: 'lease-idem-rel',
      actorId: 'actor-idem-rel',
      taskId: 'task-idem-rel',
      idempotencyKey: 'idem-rel-key',
    }));
    assert.equal(releasedReplay.ok, false);
    assert.equal(releasedReplay.decision, WRITE_LEASE_DECISIONS.DENY_RELEASED);

    const superResource = { resourceType: 'task_worktree', resourceKey: 'idem-super' };
    const oldGrant = await acquireWriteLease(client, baseAcquire({
      ...superResource,
      leaseKey: 'lease-idem-old',
      actorId: 'actor-idem-old',
      taskId: 'task-idem-old',
      idempotencyKey: 'idem-super-old',
      ttlMs: 200,
    }));
    assert.equal(oldGrant.decision, WRITE_LEASE_DECISIONS.GRANTED);
    await delay(350);
    const successor = await acquireWriteLease(client, baseAcquire({
      ...superResource,
      leaseKey: 'lease-idem-new',
      actorId: 'actor-idem-new',
      taskId: 'task-idem-new',
      idempotencyKey: 'idem-super-new',
    }));
    assert.equal(successor.decision, WRITE_LEASE_DECISIONS.GRANTED);
    const supersededReplay = await acquireWriteLease(client, baseAcquire({
      ...superResource,
      leaseKey: 'lease-idem-old',
      actorId: 'actor-idem-old',
      taskId: 'task-idem-old',
      idempotencyKey: 'idem-super-old',
    }));
    assert.equal(supersededReplay.ok, false);
    assert.equal(supersededReplay.decision, WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH);
  } finally {
    await client.end();
  }
});

test('FINDING1: concurrent identical idempotency keys serialize to one consistent logical result', async () => {
  const resource = { resourceType: 'task_worktree', resourceKey: 'idem-race-same' };
  const payload = baseAcquire({
    ...resource,
    leaseKey: 'lease-idem-race',
    actorId: 'actor-idem-race',
    taskId: 'task-idem-race',
    idempotencyKey: 'idem-race-same-key',
  });
  const clients = [];
  for (let i = 0; i < 8; i += 1) {
    clients.push(await harness.createClient());
  }
  try {
    const results = await Promise.all(clients.map((c) => acquireWriteLease(c, payload)));
    const granted = results.filter((r) => r.decision === WRITE_LEASE_DECISIONS.GRANTED);
    const replayed = results.filter((r) => r.decision === WRITE_LEASE_DECISIONS.REPLAY);
    assert.equal(granted.length, 1);
    assert.equal(replayed.length, 7);
    assert.equal(await countActiveOwners(clients[0], resource), 1);
    const epochs = new Set(results.map((r) => r.lease.fencingEpoch));
    const leaseKeys = new Set(results.map((r) => r.lease.leaseKey));
    assert.equal(epochs.size, 1);
    assert.equal(leaseKeys.size, 1);
    for (const r of results) {
      assert.equal(r.ok, true);
      assert.equal(r.lease.status, 'ACTIVE');
    }
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
});

test('FINDING1: conflicting idempotency bindings DENY deterministically without unique-constraint throw', async () => {
  const resource = { resourceType: 'task_worktree', resourceKey: 'idem-conflict-race' };
  const c1 = await harness.createClient();
  const c2 = await harness.createClient();
  try {
    const first = await acquireWriteLease(c1, baseAcquire({
      ...resource,
      leaseKey: 'lease-idem-c1',
      actorId: 'actor-idem-c1',
      taskId: 'task-idem-c1',
      idempotencyKey: 'idem-conflict-shared',
    }));
    assert.equal(first.decision, WRITE_LEASE_DECISIONS.GRANTED);

    const conflictors = await Promise.all([
      acquireWriteLease(c1, baseAcquire({
        ...resource,
        leaseKey: 'lease-idem-c2',
        actorId: 'actor-idem-c2',
        taskId: 'task-idem-c2',
        idempotencyKey: 'idem-conflict-shared',
      })),
      acquireWriteLease(c2, baseAcquire({
        ...resource,
        leaseKey: 'lease-idem-c3',
        actorId: 'actor-idem-c3',
        taskId: 'task-idem-c3',
        idempotencyKey: 'idem-conflict-shared',
      })),
    ]);
    for (const conflict of conflictors) {
      assert.equal(conflict.ok, false);
      assert.equal(conflict.decision, WRITE_LEASE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    }
    assert.equal(await countActiveOwners(c1, resource), 1);
  } finally {
    await c1.end();
    await c2.end();
  }
});

test('F1: post-lease idempotency unique-violation ROLLBACKs owner, fencing and partial idempotency', async () => {
  const stableResource = { resourceType: 'task_worktree', resourceKey: 'f1-stable-owner' };
  const raceResource = { resourceType: 'task_worktree', resourceKey: 'f1-rollback-race' };
  const observer = await harness.createClient();
  const sideClient = await harness.createClient();
  const raceClient = await harness.createClient();
  const originalQuery = raceClient.query.bind(raceClient);
  try {
    const stable = await acquireWriteLease(observer, baseAcquire({
      ...stableResource,
      leaseKey: 'lease-f1-stable',
      actorId: 'actor-f1-stable',
      taskId: 'task-f1-stable',
      idempotencyKey: 'idem-f1-stable',
    }));
    assert.equal(stable.decision, WRITE_LEASE_DECISIONS.GRANTED);
    const stableBefore = { ...stable.lease };

    assert.equal(await fenceEpoch(observer, raceResource), null);
    assert.equal(await countActiveOwners(observer, raceResource), 0);

    const conflictKey = 'idem-f1-post-lease-unique';
    let injected = false;
    raceClient.query = async (text, params) => {
      const sql = typeof text === 'string' ? text : String(text?.text || '');
      if (!injected && /INSERT INTO dlp_write_acquire_idempotency/i.test(sql)) {
        injected = true;
        // Commit a conflicting idempotency row on a separate connection after the
        // in-transaction lease upsert, forcing PostgreSQL 23505 on the next INSERT.
        await sideClient.query(
          `INSERT INTO dlp_write_acquire_idempotency (
              idempotency_key, resource_type, resource_key, actor_id, task_id,
              governance_revision, lease_key, fencing_epoch, version, decision, expires_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, clock_timestamp() + INTERVAL '1 hour')`,
          [
            conflictKey,
            'task_worktree',
            'f1-foreign-binding',
            'actor-f1-foreign',
            'task-f1-foreign',
            APPROVED_GOVERNANCE_REVISION,
            'lease-f1-foreign',
            1,
            1,
            WRITE_LEASE_DECISIONS.GRANTED,
          ],
        );
      }
      return originalQuery(text, params);
    };

    const denied = await acquireWriteLease(raceClient, baseAcquire({
      ...raceResource,
      leaseKey: 'lease-f1-ghost',
      actorId: 'actor-f1-ghost',
      taskId: 'task-f1-ghost',
      idempotencyKey: conflictKey,
    }));

    assert.equal(injected, true);
    assert.equal(denied.ok, false);
    assert.equal(denied.decision, WRITE_LEASE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    assert.equal(denied.lease, null);

    assert.equal(await countActiveOwners(observer, raceResource), 0);
    assert.equal(await fenceEpoch(observer, raceResource), null);

    const ghostLease = await observer.query(
      `SELECT * FROM dlp_write_lease
        WHERE resource_type = $1 AND resource_key = $2`,
      [raceResource.resourceType, raceResource.resourceKey],
    );
    assert.equal(ghostLease.rowCount, 0);

    const rejectedIdem = await observer.query(
      `SELECT * FROM dlp_write_acquire_idempotency
        WHERE idempotency_key = $1
          AND lease_key = $2
          AND actor_id = $3`,
      [conflictKey, 'lease-f1-ghost', 'actor-f1-ghost'],
    );
    assert.equal(rejectedIdem.rowCount, 0);

    const seedOnly = await observer.query(
      `SELECT lease_key, actor_id, resource_key
         FROM dlp_write_acquire_idempotency
        WHERE idempotency_key = $1`,
      [conflictKey],
    );
    assert.equal(seedOnly.rowCount, 1);
    assert.equal(seedOnly.rows[0].lease_key, 'lease-f1-foreign');
    assert.equal(seedOnly.rows[0].resource_key, 'f1-foreign-binding');

    const stableAfter = await validateWriteLease(observer, {
      ...stableResource,
      leaseKey: stableBefore.leaseKey,
      actorId: stableBefore.actorId,
      taskId: stableBefore.taskId,
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: stableBefore.fencingEpoch,
    });
    assert.equal(stableAfter.decision, WRITE_LEASE_DECISIONS.VALID);
    assert.equal(stableAfter.lease.version, stableBefore.version);
    assert.equal(stableAfter.lease.fencingEpoch, stableBefore.fencingEpoch);
    assert.equal(stableAfter.lease.actorId, stableBefore.actorId);

    const later = await acquireWriteLease(observer, baseAcquire({
      ...raceResource,
      leaseKey: 'lease-f1-legit',
      actorId: 'actor-f1-legit',
      taskId: 'task-f1-legit',
      idempotencyKey: 'idem-f1-legit-after-rollback',
    }));
    assert.equal(later.decision, WRITE_LEASE_DECISIONS.GRANTED);
    assert.equal(later.lease.fencingEpoch, 1);
    assert.equal(await countActiveOwners(observer, raceResource), 1);
    assert.equal(await fenceEpoch(observer, raceResource), 1);
  } finally {
    raceClient.query = originalQuery;
    await Promise.all([observer.end(), sideClient.end(), raceClient.end()]);
  }
});

test('FINDING2: validate uses one consistent row snapshot; replacement never reports prior owner VALID', async () => {
  const resource = { resourceType: 'task_worktree', resourceKey: 'validate-race-1' };
  const ownerClient = await harness.createClient();
  const replacerClient = await harness.createClient();
  const validatorClient = await harness.createClient();
  try {
    const first = await acquireWriteLease(ownerClient, baseAcquire({
      ...resource,
      leaseKey: 'lease-val-old',
      actorId: 'actor-val-old',
      taskId: 'task-val-old',
      idempotencyKey: 'idem-val-old',
      ttlMs: 250,
    }));
    assert.equal(first.decision, WRITE_LEASE_DECISIONS.GRANTED);

    await delay(350);

    // Hold the lease row so validate's FOR SHARE waits, then observe the replaced owner.
    await replacerClient.query('BEGIN');
    await replacerClient.query(
      `SELECT * FROM dlp_write_lease
        WHERE resource_type = $1 AND resource_key = $2
        FOR UPDATE`,
      [resource.resourceType, resource.resourceKey],
    );
    await replacerClient.query(
      `SELECT fencing_epoch FROM dlp_write_resource_fence
        WHERE resource_type = $1 AND resource_key = $2 FOR UPDATE`,
      [resource.resourceType, resource.resourceKey],
    );

    const validateDuringReplacement = validateWriteLease(validatorClient, {
      ...resource,
      leaseKey: 'lease-val-old',
      actorId: 'actor-val-old',
      taskId: 'task-val-old',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: first.lease.fencingEpoch,
    });

    // Give validate a chance to block on FOR SHARE behind the replacer lock.
    await delay(80);

    await replacerClient.query(
      `UPDATE dlp_write_resource_fence
          SET fencing_epoch = fencing_epoch + 1
        WHERE resource_type = $1 AND resource_key = $2`,
      [resource.resourceType, resource.resourceKey],
    );
    const epochRow = await replacerClient.query(
      `SELECT fencing_epoch::bigint AS e FROM dlp_write_resource_fence
        WHERE resource_type = $1 AND resource_key = $2`,
      [resource.resourceType, resource.resourceKey],
    );
    const newEpoch = Number(epochRow.rows[0].e);
    await replacerClient.query(
      `UPDATE dlp_write_lease
          SET lease_key = $3,
              actor_id = $4,
              task_id = $5,
              fencing_epoch = $6,
              version = 1,
              status = 'ACTIVE',
              granted_at = clock_timestamp(),
              expires_at = clock_timestamp() + INTERVAL '30 seconds',
              renewed_at = NULL,
              released_at = NULL
        WHERE resource_type = $1 AND resource_key = $2`,
      [
        resource.resourceType,
        resource.resourceKey,
        'lease-val-new',
        'actor-val-new',
        'task-val-new',
        newEpoch,
      ],
    );
    await replacerClient.query('COMMIT');

    const priorValidate = await validateDuringReplacement;
    assert.equal(priorValidate.ok, false);
    assert.ok([
      WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH,
      WRITE_LEASE_DECISIONS.DENY_EXPIRED,
      WRITE_LEASE_DECISIONS.DENY_FOREIGN_ACTOR,
      WRITE_LEASE_DECISIONS.DENY_BINDING_MISMATCH,
    ].includes(priorValidate.decision));
    assert.notEqual(priorValidate.decision, WRITE_LEASE_DECISIONS.VALID);

    const after = await validateWriteLease(validatorClient, {
      ...resource,
      leaseKey: 'lease-val-old',
      actorId: 'actor-val-old',
      taskId: 'task-val-old',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: first.lease.fencingEpoch,
    });
    assert.equal(after.ok, false);
    assert.equal(after.decision, WRITE_LEASE_DECISIONS.DENY_STALE_FENCING_EPOCH);

    const successorValid = await validateWriteLease(validatorClient, {
      ...resource,
      leaseKey: 'lease-val-new',
      actorId: 'actor-val-new',
      taskId: 'task-val-new',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: newEpoch,
    });
    assert.equal(successorValid.decision, WRITE_LEASE_DECISIONS.VALID);
  } finally {
    try {
      await replacerClient.query('ROLLBACK');
    } catch {
      // ignore if already committed
    }
    await ownerClient.end();
    await replacerClient.end();
    await validatorClient.end();
  }
});

test('FINDING3: expired lease release is DENY_EXPIRED, not successful RELEASED', async () => {
  const client = await harness.createClient();
  try {
    const resource = { resourceType: 'task_worktree', resourceKey: 'release-expired-1' };
    const granted = await acquireWriteLease(client, baseAcquire({
      ...resource,
      leaseKey: 'lease-exp-rel',
      actorId: 'actor-exp-rel',
      taskId: 'task-exp-rel',
      idempotencyKey: 'idem-exp-rel',
      ttlMs: 200,
    }));
    assert.equal(granted.decision, WRITE_LEASE_DECISIONS.GRANTED);
    await delay(350);

    const released = await releaseWriteLease(client, {
      ...resource,
      leaseKey: granted.lease.leaseKey,
      actorId: granted.lease.actorId,
      taskId: granted.lease.taskId,
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: granted.lease.fencingEpoch,
      expectedVersion: granted.lease.version,
    });
    assert.equal(released.ok, false);
    assert.equal(released.decision, WRITE_LEASE_DECISIONS.DENY_EXPIRED);

    const row = await client.query(
      `SELECT status, version::bigint AS version
         FROM dlp_write_lease
        WHERE resource_type = $1 AND resource_key = $2`,
      [resource.resourceType, resource.resourceKey],
    );
    assert.equal(row.rows[0].status, 'ACTIVE');
    assert.equal(Number(row.rows[0].version), granted.lease.version);
  } finally {
    await client.end();
  }
});

test('V2-A: startup failure after server starts refuses pre-start delete; keeps live dir when stop unproven', () => {
  let error;
  try {
    createDisposablePgHarness({
      startCluster: ({ dataDir, socketDir, socketPort, logFile, pgBinDir, run }) => {
        run(join(pgBinDir, 'pg_ctl'), [
          '-D', dataDir,
          '-l', logFile,
          '-o', `-c listen_addresses= -c unix_socket_directories=${socketDir} -c port=${socketPort}`,
          '-w',
          'start',
        ]);
        throw new Error('injected failure after PostgreSQL actually started');
      },
      stopFn: () => ({ status: 1, stderr: 'injected stop failure after late startup error', stdout: '' }),
    });
  } catch (err) {
    error = err;
  }

  assert.ok(error);
  assert.match(String(error.message), /BLOCKED: setup failed and safe cleanup could not be established/);
  assert.equal(error.dlpCleanup?.startupAttempted, true);
  assert.equal(error.dlpCleanup?.cleanupBlocked, true);
  const capturedRoot = error.dlpCleanup.root;
  const capturedDataDir = error.dlpCleanup.dataDir;
  assert.ok(capturedRoot);
  assert.ok(capturedDataDir);
  assert.equal(existsSync(capturedRoot), true);
  assert.equal(isPostmasterRunning(capturedDataDir), true);
  console.log('DLP001_V2A_STARTUP_AFTER_START', JSON.stringify({
    startupAttempted: error.dlpCleanup.startupAttempted,
    cleanupBlocked: error.dlpCleanup.cleanupBlocked,
    rootExists: existsSync(capturedRoot),
    postmasterRunning: true,
  }));

  const proof = stopClusterAndProveTerminated(capturedDataDir);
  assert.equal(proof.terminated, true);
  removeHarnessRootIfSafe(capturedRoot, capturedDataDir);
  assert.equal(existsSync(capturedRoot), false);
});

test('V2-B: startup failure before any server starts cleans disposable artifacts', () => {
  let error;
  try {
    createDisposablePgHarness({
      beforeStart: ({ root, dataDir }) => {
        assert.equal(existsSync(root), true);
        assert.equal(existsSync(dataDir), true);
        throw new Error('injected failure before pg_ctl start');
      },
    });
  } catch (err) {
    error = err;
  }

  assert.ok(error);
  assert.match(String(error.message), /injected failure before pg_ctl start/);
  assert.equal(error.dlpCleanup?.startupAttempted, false);
  assert.equal(error.dlpCleanup?.cleaned, true);
  assert.equal(error.dlpCleanup?.cleanupBlocked, false);
  assert.equal(existsSync(error.dlpCleanup.root), false);
  console.log('DLP001_V2B_STARTUP_BEFORE_START', JSON.stringify({
    startupAttempted: error.dlpCleanup.startupAttempted,
    cleaned: error.dlpCleanup.cleaned,
    rootExists: existsSync(error.dlpCleanup.root),
  }));
});

test('V2-C: uncertain postmaster status is BLOCKED, not proof of termination', () => {
  const local = createDisposablePgHarness();
  const { root, dataDir } = local;
  try {
    assert.throws(
      () => isPostmasterRunning(dataDir, {
        pgCtlStatusFn: () => {
          throw new Error('injected pg_ctl status failure');
        },
      }),
      /BLOCKED: uncertain postmaster status/,
    );

    const forcedUncertain = {
      status: POSTMASTER_STATUS.UNCERTAIN,
      reason: 'injected_uncertain_status',
    };
    const proof = stopClusterAndProveTerminated(dataDir, {
      stopFn: () => ({ status: 0, stdout: 'stop pretended ok', stderr: '' }),
      inspectFn: () => forcedUncertain,
    });
    assert.equal(proof.terminated, false);
    assert.equal(proof.blocked, true);
    assert.equal(proof.status, POSTMASTER_STATUS.UNCERTAIN);

    assert.throws(
      () => removeHarnessRootIfSafe(root, dataDir, { inspectFn: () => forcedUncertain }),
      /BLOCKED: refusing to delete cluster directory with uncertain postmaster status/,
    );
    assert.equal(existsSync(root), true);
    console.log('DLP001_V2C_UNCERTAIN_STATUS', JSON.stringify({
      proofBlocked: proof.blocked,
      proofStatus: proof.status,
      rootExists: existsSync(root),
    }));
  } finally {
    const stopped = local.stop();
    assert.equal(stopped.deleted, true);
    assert.equal(existsSync(root), false);
  }
});

test('V2-D: arbitrary-directory cleanup refusal (disposable fixtures only)', () => {
  const arbitraryRoot = mkdtempSync(join(tmpdir(), 'not-harness-'));
  const arbitraryData = join(arbitraryRoot, 'data');
  mkdirSync(arbitraryData);

  assert.throws(
    () => assertVerifiedHarnessPaths(arbitraryRoot, arbitraryData),
    /BLOCKED: refusing path that is not a harness-created tecp-dlp001 temporary root/,
  );
  assert.throws(
    () => removeHarnessRootIfSafe(arbitraryRoot, arbitraryData),
    /BLOCKED: refusing path that is not a harness-created tecp-dlp001 temporary root/,
  );
  assert.equal(existsSync(arbitraryRoot), true);

  const unmarkedRoot = mkdtempSync(join(tmpdir(), HARNESS_ROOT_PREFIX));
  const unmarkedData = join(unmarkedRoot, 'data');
  mkdirSync(unmarkedData);
  assert.throws(
    () => removeHarnessRootIfSafe(unmarkedRoot, unmarkedData),
    /BLOCKED: missing harness verification marker/,
  );
  assert.equal(existsSync(unmarkedRoot), true);

  const local = createDisposablePgHarness();
  try {
    assert.throws(
      () => removeHarnessRootIfSafe(local.root, join(local.root, 'other-data')),
      /BLOCKED: dataDir must be the matching harness root\/data directory/,
    );
    assert.equal(existsSync(local.root), true);
  } finally {
    local.stop();
  }

  rmSync(arbitraryRoot, { recursive: true, force: true });
  rmSync(unmarkedRoot, { recursive: true, force: true });
  console.log('DLP001_V2D_ARBITRARY_PATH_REFUSAL', JSON.stringify({
    arbitraryRootRefused: true,
    unmarkedRootRefused: true,
    mismatchedDataDirRefused: true,
  }));
});

test('V2-E: correct cleanup after positively verified shutdown', () => {
  const local = createDisposablePgHarness();
  const { root, dataDir } = local;
  assert.equal(isPostmasterRunning(dataDir), true);
  assert.equal(existsSync(root), true);

  assert.throws(
    () => removeHarnessRootIfSafe(root, dataDir),
    /BLOCKED: refusing to delete live cluster data directory/,
  );

  const failedStop = stopClusterAndProveTerminated(dataDir, {
    stopFn: () => ({ status: 1, stderr: 'injected stop failure', stdout: '' }),
  });
  assert.equal(failedStop.terminated, false);
  assert.equal(failedStop.blocked, true);
  assert.equal(existsSync(root), true);

  const proof = stopClusterAndProveTerminated(dataDir);
  assert.equal(proof.terminated, true);
  assert.equal(proof.status, POSTMASTER_STATUS.STOPPED);
  assert.equal(inspectPostmasterStatus(dataDir).status, POSTMASTER_STATUS.STOPPED);

  const removed = removeHarnessRootIfSafe(root, dataDir);
  assert.equal(removed.deleted, true);
  assert.equal(existsSync(root), false);
  console.log('DLP001_V2E_VERIFIED_SHUTDOWN_CLEANUP', JSON.stringify({
    terminated: proof.terminated,
    deleted: removed.deleted,
    rootExists: existsSync(root),
  }));
});
