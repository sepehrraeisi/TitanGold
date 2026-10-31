/**
 * TECP-DLP-002 disposable Task/Claim/Lease composition tests.
 * NON_OPERATIONAL proof. Requires local ephemeral PostgreSQL via harness.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

import {
  APPROVED_GOVERNANCE_REVISION,
  COMPOSITION_DECISIONS,
  bindTaskClaimLease,
  releaseTaskClaimLease,
} from '../src/taskClaimLeaseRepository.js';
import {
  WRITE_LEASE_DECISIONS,
  validateWriteLease,
} from '../src/writeLeaseRepository.js';
import {
  createDisposablePgHarness,
} from './disposablePgHarness.js';

const here = dirname(fileURLToPath(import.meta.url));
const compositionSchemaSql = readFileSync(
  join(here, 'disposableTaskClaimLeaseSchema.sql'),
  'utf8',
);

let harness;
let isolationEvidence;

async function applyCompositionSchema() {
  const client = await harness.createClient();
  try {
    await client.query(compositionSchemaSql);
  } finally {
    await client.end();
  }
}

before(async () => {
  harness = createDisposablePgHarness();
  isolationEvidence = await harness.proveIsolation();
  await harness.createProofDatabase();
  await applyCompositionSchema();
});

after(async () => {
  if (harness) {
    await harness.stop();
  }
});

function baseBind(overrides = {}) {
  return {
    taskId: 'task-a',
    actorId: 'actor-a',
    resourceType: 'task_worktree',
    resourceKey: 'comp-resource-1',
    claimKey: 'claim-a',
    leaseKey: 'lease-a',
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    compositionIdempotencyKey: 'comp-idem-a',
    leaseIdempotencyKey: 'lease-idem-a',
    ttlMs: 30_000,
    ...overrides,
  };
}

async function countHeldClaims(client, resourceType, resourceKey) {
  const r = await client.query(
    `SELECT count(*)::int AS n
       FROM dlp_task_claim
      WHERE resource_type = $1
        AND resource_key = $2
        AND status = 'HELD'`,
    [resourceType, resourceKey],
  );
  return r.rows[0].n;
}

async function countActiveLeases(client, resourceType, resourceKey) {
  const r = await client.query(
    `SELECT count(*)::int AS n
       FROM dlp_write_lease
      WHERE resource_type = $1
        AND resource_key = $2
        AND status = 'ACTIVE'
        AND expires_at > clock_timestamp()`,
    [resourceType, resourceKey],
  );
  return r.rows[0].n;
}

async function fenceEpoch(client, resourceType, resourceKey) {
  const r = await client.query(
    `SELECT fencing_epoch::bigint AS e
       FROM dlp_write_resource_fence
      WHERE resource_type = $1 AND resource_key = $2`,
    [resourceType, resourceKey],
  );
  return r.rowCount === 0 ? null : Number(r.rows[0].e);
}

test('DLP-002 isolation: unix socket only disposable PostgreSQL', () => {
  assert.equal(isolationEvidence.listenAddresses, '');
  assert.equal(isolationEvidence.tcpRejected, true);
  assert.equal(isolationEvidence.databaseUrlUsed, false);
  assert.match(isolationEvidence.postgresVersion, /^postgres \(PostgreSQL\) 14\.24/);
  console.log('DLP002_ISOLATION', JSON.stringify({
    postgresVersion: isolationEvidence.postgresVersion,
    listenAddresses: isolationEvidence.listenAddresses,
    tcpRejected: isolationEvidence.tcpRejected,
    databaseUrlUsed: isolationEvidence.databaseUrlUsed,
    socketPort: isolationEvidence.socketPort,
    isolationFingerprint: harness.isolationFingerprint,
  }));
});

test('atomic Task+Claim+Lease success and Release consistency', async () => {
  const client = await harness.createClient();
  try {
    const input = baseBind({
      taskId: 'task-happy',
      actorId: 'actor-happy',
      resourceKey: 'comp-happy',
      claimKey: 'claim-happy',
      leaseKey: 'lease-happy',
      compositionIdempotencyKey: 'comp-idem-happy',
      leaseIdempotencyKey: 'lease-idem-happy',
    });
    const bound = await bindTaskClaimLease(client, input);
    assert.equal(bound.decision, COMPOSITION_DECISIONS.BOUND);
    assert.equal(bound.ok, true);
    assert.equal(bound.operational, false);
    assert.equal(bound.task.status, 'CLAIMED');
    assert.equal(bound.claim.status, 'HELD');
    assert.equal(bound.leaseDecision, WRITE_LEASE_DECISIONS.GRANTED);
    assert.equal(await countHeldClaims(client, input.resourceType, input.resourceKey), 1);
    assert.equal(await countActiveLeases(client, input.resourceType, input.resourceKey), 1);

    const valid = await validateWriteLease(client, {
      resourceType: input.resourceType,
      resourceKey: input.resourceKey,
      leaseKey: bound.lease.leaseKey,
      actorId: bound.lease.actorId,
      taskId: bound.lease.taskId,
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: bound.lease.fencingEpoch,
    });
    assert.equal(valid.decision, WRITE_LEASE_DECISIONS.VALID);

    const released = await releaseTaskClaimLease(client, {
      taskId: input.taskId,
      actorId: input.actorId,
      resourceType: input.resourceType,
      resourceKey: input.resourceKey,
      claimKey: input.claimKey,
      leaseKey: input.leaseKey,
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: bound.lease.fencingEpoch,
      expectedVersion: bound.lease.version,
    });
    assert.equal(released.decision, COMPOSITION_DECISIONS.RELEASED);
    assert.equal(released.task.status, 'RELEASED');
    assert.equal(released.claim.status, 'RELEASED');
    assert.equal(await countHeldClaims(client, input.resourceType, input.resourceKey), 0);
    assert.equal(await countActiveLeases(client, input.resourceType, input.resourceKey), 0);
    const epoch = await fenceEpoch(client, input.resourceType, input.resourceKey);
    assert.equal(epoch, bound.lease.fencingEpoch);
  } finally {
    await client.end();
  }
});

test('DENY_OWNED composition rolls back Task/Claim; no ghost owner or fencing bump', async () => {
  const client = await harness.createClient();
  try {
    const resourceKey = 'comp-deny-owned';
    const first = await bindTaskClaimLease(client, baseBind({
      taskId: 'task-owner',
      actorId: 'actor-owner',
      resourceKey,
      claimKey: 'claim-owner',
      leaseKey: 'lease-owner',
      compositionIdempotencyKey: 'comp-idem-owner',
      leaseIdempotencyKey: 'lease-idem-owner',
    }));
    assert.equal(first.decision, COMPOSITION_DECISIONS.BOUND);
    const epochBefore = await fenceEpoch(client, 'task_worktree', resourceKey);

    const denied = await bindTaskClaimLease(client, baseBind({
      taskId: 'task-loser',
      actorId: 'actor-loser',
      resourceKey,
      claimKey: 'claim-loser',
      leaseKey: 'lease-loser',
      compositionIdempotencyKey: 'comp-idem-loser',
      leaseIdempotencyKey: 'lease-idem-loser',
    }));
    assert.equal(denied.ok, false);
    assert.ok([
      COMPOSITION_DECISIONS.DENY_CLAIM_CONFLICT,
      COMPOSITION_DECISIONS.DENY_LEASE,
    ].includes(denied.decision));

    assert.equal(await countHeldClaims(client, 'task_worktree', resourceKey), 1);
    assert.equal(await countActiveLeases(client, 'task_worktree', resourceKey), 1);
    assert.equal(await fenceEpoch(client, 'task_worktree', resourceKey), epochBefore);

    const ghostTasks = await client.query(
      `SELECT count(*)::int AS n FROM dlp_task WHERE task_id = 'task-loser'`,
    );
    assert.equal(ghostTasks.rows[0].n, 0);
    const ghostClaims = await client.query(
      `SELECT count(*)::int AS n FROM dlp_task_claim WHERE claim_key = 'claim-loser'`,
    );
    assert.equal(ghostClaims.rows[0].n, 0);
  } finally {
    await client.end();
  }
});

test('two concurrent contenders: exactly one bound owner', async () => {
  const resourceKey = 'comp-race-2';
  const c1 = await harness.createClient();
  const c2 = await harness.createClient();
  try {
    const [a, b] = await Promise.all([
      bindTaskClaimLease(c1, baseBind({
        taskId: 'task-r2-a',
        actorId: 'actor-r2-a',
        resourceKey,
        claimKey: 'claim-r2-a',
        leaseKey: 'lease-r2-a',
        compositionIdempotencyKey: 'comp-idem-r2-a',
        leaseIdempotencyKey: 'lease-idem-r2-a',
      })),
      bindTaskClaimLease(c2, baseBind({
        taskId: 'task-r2-b',
        actorId: 'actor-r2-b',
        resourceKey,
        claimKey: 'claim-r2-b',
        leaseKey: 'lease-r2-b',
        compositionIdempotencyKey: 'comp-idem-r2-b',
        leaseIdempotencyKey: 'lease-idem-r2-b',
      })),
    ]);
    const bound = [a, b].filter((x) => x.decision === COMPOSITION_DECISIONS.BOUND);
    const denied = [a, b].filter((x) => x.ok === false);
    assert.equal(bound.length, 1);
    assert.equal(denied.length, 1);
    assert.equal(await countHeldClaims(c1, 'task_worktree', resourceKey), 1);
    assert.equal(await countActiveLeases(c1, 'task_worktree', resourceKey), 1);
    console.log('DLP002_RACE2', JSON.stringify({
      boundActor: bound[0].lease.actorId,
      deniedDecision: denied[0].decision,
      fencingEpoch: bound[0].lease.fencingEpoch,
    }));
  } finally {
    await c1.end();
    await c2.end();
  }
});

test('10+ concurrent contenders: exactly one bound owner, no ghost state', async () => {
  const resourceKey = 'comp-race-12';
  const N = 12;
  const clients = [];
  for (let i = 0; i < N; i += 1) {
    clients.push(await harness.createClient());
  }
  try {
    const results = await Promise.all(clients.map((client, i) => bindTaskClaimLease(client, baseBind({
      taskId: `task-r12-${i}`,
      actorId: `actor-r12-${i}`,
      resourceKey,
      claimKey: `claim-r12-${i}`,
      leaseKey: `lease-r12-${i}`,
      compositionIdempotencyKey: `comp-idem-r12-${i}`,
      leaseIdempotencyKey: `lease-idem-r12-${i}`,
    }))));
    const bound = results.filter((x) => x.decision === COMPOSITION_DECISIONS.BOUND);
    const denied = results.filter((x) => x.ok === false);
    assert.equal(bound.length, 1);
    assert.equal(denied.length, N - 1);
    assert.equal(await countHeldClaims(clients[0], 'task_worktree', resourceKey), 1);
    assert.equal(await countActiveLeases(clients[0], 'task_worktree', resourceKey), 1);

    const tasks = await clients[0].query(
      `SELECT count(*)::int AS n FROM dlp_task
        WHERE resource_key = $1 AND status = 'CLAIMED'`,
      [resourceKey],
    );
    assert.equal(tasks.rows[0].n, 1);
    console.log('DLP002_RACE12', JSON.stringify({
      contenders: N,
      bound: bound.length,
      denied: denied.length,
      fencingEpoch: bound[0].lease.fencingEpoch,
    }));
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
});

test('idempotent composition replay and conflicting composition key DENY', async () => {
  const client = await harness.createClient();
  try {
    const resourceKey = 'comp-idem';
    const input = baseBind({
      taskId: 'task-idem',
      actorId: 'actor-idem',
      resourceKey,
      claimKey: 'claim-idem',
      leaseKey: 'lease-idem',
      compositionIdempotencyKey: 'comp-idem-same',
      leaseIdempotencyKey: 'lease-idem-same',
    });
    const first = await bindTaskClaimLease(client, input);
    assert.equal(first.decision, COMPOSITION_DECISIONS.BOUND);

    const replay = await bindTaskClaimLease(client, input);
    assert.equal(replay.decision, COMPOSITION_DECISIONS.REPLAY);
    assert.equal(replay.lease.fencingEpoch, first.lease.fencingEpoch);
    assert.equal(replay.lease.leaseKey, first.lease.leaseKey);

    const conflict = await bindTaskClaimLease(client, baseBind({
      taskId: 'task-idem-other',
      actorId: 'actor-idem-other',
      resourceKey: 'comp-idem-other',
      claimKey: 'claim-idem-other',
      leaseKey: 'lease-idem-other',
      compositionIdempotencyKey: 'comp-idem-same',
      leaseIdempotencyKey: 'lease-idem-other',
    }));
    assert.equal(conflict.decision, COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    assert.equal(await countHeldClaims(client, 'task_worktree', resourceKey), 1);
  } finally {
    await client.end();
  }
});

test('foreign actor release DENY; owner still held', async () => {
  const client = await harness.createClient();
  try {
    const resourceKey = 'comp-foreign';
    const bound = await bindTaskClaimLease(client, baseBind({
      taskId: 'task-foreign',
      actorId: 'actor-owner',
      resourceKey,
      claimKey: 'claim-foreign',
      leaseKey: 'lease-foreign',
      compositionIdempotencyKey: 'comp-idem-foreign',
      leaseIdempotencyKey: 'lease-idem-foreign',
    }));
    assert.equal(bound.decision, COMPOSITION_DECISIONS.BOUND);

    const foreign = await releaseTaskClaimLease(client, {
      taskId: 'task-foreign',
      actorId: 'actor-intruder',
      resourceType: 'task_worktree',
      resourceKey,
      claimKey: 'claim-foreign',
      leaseKey: 'lease-foreign',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: bound.lease.fencingEpoch,
      expectedVersion: bound.lease.version,
    });
    assert.equal(foreign.decision, COMPOSITION_DECISIONS.DENY_FOREIGN_ACTOR);
    assert.equal(await countHeldClaims(client, 'task_worktree', resourceKey), 1);
    assert.equal(await countActiveLeases(client, 'task_worktree', resourceKey), 1);
  } finally {
    await client.end();
  }
});

test('stale fencing epoch release DENY', async () => {
  const client = await harness.createClient();
  try {
    const resourceKey = 'comp-stale';
    const bound = await bindTaskClaimLease(client, baseBind({
      taskId: 'task-stale',
      actorId: 'actor-stale',
      resourceKey,
      claimKey: 'claim-stale',
      leaseKey: 'lease-stale',
      compositionIdempotencyKey: 'comp-idem-stale',
      leaseIdempotencyKey: 'lease-idem-stale',
    }));
    assert.equal(bound.decision, COMPOSITION_DECISIONS.BOUND);

    const stale = await releaseTaskClaimLease(client, {
      taskId: 'task-stale',
      actorId: 'actor-stale',
      resourceType: 'task_worktree',
      resourceKey,
      claimKey: 'claim-stale',
      leaseKey: 'lease-stale',
      governanceRevision: APPROVED_GOVERNANCE_REVISION,
      fencingEpoch: bound.lease.fencingEpoch + 10,
      expectedVersion: bound.lease.version,
    });
    assert.equal(stale.decision, COMPOSITION_DECISIONS.DENY_STALE_FENCING_EPOCH);
    assert.equal(await countHeldClaims(client, 'task_worktree', resourceKey), 1);
    assert.equal(await countActiveLeases(client, 'task_worktree', resourceKey), 1);
  } finally {
    await client.end();
  }
});

test('invalid governance revision DENY on bind and release', async () => {
  const client = await harness.createClient();
  try {
    const bad = await bindTaskClaimLease(client, baseBind({
      taskId: 'task-gov',
      resourceKey: 'comp-gov',
      claimKey: 'claim-gov',
      leaseKey: 'lease-gov',
      compositionIdempotencyKey: 'comp-idem-gov',
      leaseIdempotencyKey: 'lease-idem-gov',
      governanceRevision: 'NOT_APPROVED',
    }));
    assert.equal(bad.decision, COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
    assert.equal(await countHeldClaims(client, 'task_worktree', 'comp-gov'), 0);

    const bound = await bindTaskClaimLease(client, baseBind({
      taskId: 'task-gov-ok',
      actorId: 'actor-gov',
      resourceKey: 'comp-gov',
      claimKey: 'claim-gov-ok',
      leaseKey: 'lease-gov-ok',
      compositionIdempotencyKey: 'comp-idem-gov-ok',
      leaseIdempotencyKey: 'lease-idem-gov-ok',
    }));
    assert.equal(bound.decision, COMPOSITION_DECISIONS.BOUND);

    const badRelease = await releaseTaskClaimLease(client, {
      taskId: 'task-gov-ok',
      actorId: 'actor-gov',
      resourceType: 'task_worktree',
      resourceKey: 'comp-gov',
      claimKey: 'claim-gov-ok',
      leaseKey: 'lease-gov-ok',
      governanceRevision: 'WRONG',
      fencingEpoch: bound.lease.fencingEpoch,
      expectedVersion: bound.lease.version,
    });
    assert.equal(badRelease.decision, COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  } finally {
    await client.end();
  }
});

test('database failure fails closed with no forged success', async () => {
  const client = await harness.createClient();
  await client.end();

  const outage = await bindTaskClaimLease(client, baseBind({
    taskId: 'task-outage',
    resourceKey: 'comp-outage',
    claimKey: 'claim-outage',
    leaseKey: 'lease-outage',
    compositionIdempotencyKey: 'comp-idem-outage',
    leaseIdempotencyKey: 'lease-idem-outage',
  }));
  assert.equal(outage.ok, false);
  assert.equal(outage.decision, COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE);
});

test('mid-composition injected failure rolls back Task/Claim/Lease together', async () => {
  const client = await harness.createClient();
  try {
    const resourceKey = 'comp-mid-fail';
    let sawLeaseInsert = 0;
    const sabotaged = {
      query: async (sql, params) => {
        const text = String(sql);
        if (/INSERT INTO dlp_write_lease/i.test(text)) {
          sawLeaseInsert += 1;
          const out = await client.query(sql, params);
          throw new Error('injected composition failure after lease insert');
        }
        return client.query(sql, params);
      },
    };

    await assert.rejects(
      () => bindTaskClaimLease(sabotaged, baseBind({
        taskId: 'task-mid',
        actorId: 'actor-mid',
        resourceKey,
        claimKey: 'claim-mid',
        leaseKey: 'lease-mid',
        compositionIdempotencyKey: 'comp-idem-mid',
        leaseIdempotencyKey: 'lease-idem-mid',
      })),
      /injected composition failure after lease insert/,
    );
    assert.ok(sawLeaseInsert >= 1);
    assert.equal(await countHeldClaims(client, 'task_worktree', resourceKey), 0);
    assert.equal(await countActiveLeases(client, 'task_worktree', resourceKey), 0);
    const tasks = await client.query(
      `SELECT count(*)::int AS n FROM dlp_task WHERE task_id = 'task-mid'`,
    );
    assert.equal(tasks.rows[0].n, 0);
    const epoch = await fenceEpoch(client, 'task_worktree', resourceKey);
    assert.ok(epoch === null || epoch === 0);
  } finally {
    await client.end();
  }
});

test('source does not duplicate WRITE lease SQL algorithm', async () => {
  const src = readFileSync(join(here, '../src/taskClaimLeaseRepository.js'), 'utf8');
  assert.equal(/dlp_write_resource_fence/i.test(src), false);
  assert.equal(/INSERT INTO dlp_write_lease/i.test(src), false);
  assert.equal(/UPDATE dlp_write_lease/i.test(src), false);
  assert.match(src, /acquireWriteLeaseInTransaction/);
  assert.match(src, /releaseWriteLeaseInTransaction/);
  assert.match(src, /withOwnedWriteLeaseTransaction/);
  assert.match(src, /NON_OPERATIONAL/);
});
