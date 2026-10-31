/**
 * TECP-DLP-004 disposable Task/Claim/Lease + Audit/Evidence composition tests.
 * NON_OPERATIONAL proof. Requires local ephemeral PostgreSQL via harness.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import pg from 'pg';

import {
  APPROVED_GOVERNANCE_REVISION as DLP003_REV,
  AUDIT_EVIDENCE_DECISIONS,
} from '../src/auditEvidenceRepository.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP002_REV,
  COMPOSITION_DECISIONS,
  bindTaskClaimLease,
} from '../src/taskClaimLeaseRepository.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP004_REV,
  DLP002_GOVERNANCE_REVISION,
  DLP003_GOVERNANCE_REVISION,
  LIFECYCLE_DECISIONS,
  bindTaskClaimLeaseWithAudit,
  releaseTaskClaimLeaseWithAudit,
} from '../src/taskClaimLeaseAuditRepository.js';
import {
  WRITE_LEASE_DECISIONS,
  withOwnedWriteLeaseTransaction,
} from '../src/writeLeaseRepository.js';
import {
  createDisposablePgHarness,
} from './disposablePgHarness.js';

const { Client } = pg;
const here = dirname(fileURLToPath(import.meta.url));
const taskClaimSchemaSql = readFileSync(join(here, 'disposableTaskClaimLeaseSchema.sql'), 'utf8');
const auditSchemaSql = readFileSync(join(here, 'disposableAuditEvidenceSchema.sql'), 'utf8');
const compositionSchemaSql = readFileSync(join(here, 'disposableTaskClaimLeaseAuditSchema.sql'), 'utf8');
const adapterSrc = readFileSync(join(here, '../src/taskClaimLeaseAuditRepository.js'), 'utf8');

let harness;
let isolationEvidence;

async function applyAllSchemas() {
  const client = await harness.createClient();
  try {
    await client.query(taskClaimSchemaSql);
    await client.query(auditSchemaSql);
    await client.query(compositionSchemaSql);
  } finally {
    await client.end();
  }
}

function createCompositionClient() {
  return new Client({
    host: harness.socketDir,
    port: harness.socketPort,
    user: 'dlp_composition_proof',
    database: 'dlp_proof',
  });
}

before(async () => {
  harness = createDisposablePgHarness();
  isolationEvidence = await harness.proveIsolation();
  await harness.createProofDatabase();
  await applyAllSchemas();
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
    governanceRevision: DLP002_REV,
    compositionIdempotencyKey: 'comp-idem-a',
    leaseIdempotencyKey: 'lease-idem-a',
    ttlMs: 30_000,
    ...overrides,
  };
}

function baseAudit(overrides = {}) {
  return {
    eventId: 'evt-1',
    eventType: 'TASK_BOUND',
    taskId: 'task-a',
    actorId: 'actor-a',
    governanceRevision: DLP003_REV,
    idempotencyKey: 'audit-idem-1',
    ...overrides,
  };
}

function baseEvidence(overrides = {}) {
  return {
    evidenceId: 'evd-1',
    taskId: 'task-a',
    actorId: 'actor-a',
    governanceRevision: DLP003_REV,
    evidenceType: 'TEST_LOG',
    evidenceRef: 'sha256:abc',
    idempotencyKey: 'evd-idem-1',
    ...overrides,
  };
}

function bindPhase(bindOverrides = {}, auditOverrides = {}, evidence = undefined) {
  const bind = baseBind(bindOverrides);
  const audit = baseAudit({
    taskId: bind.taskId,
    actorId: bind.actorId,
    ...auditOverrides,
  });
  const input = {
    compositionGovernanceRevision: DLP004_REV,
    bind,
    audit,
  };
  if (evidence !== undefined) {
    input.evidence = evidence && {
      ...baseEvidence({ taskId: bind.taskId, actorId: bind.actorId }),
      ...evidence,
    };
  }
  return input;
}

function releasePhase(bound, releaseOverrides = {}, auditOverrides = {}, evidence = undefined) {
  const release = {
    taskId: bound.bind.task.taskId,
    actorId: bound.bind.task.actorId,
    resourceType: bound.bind.lease.resourceType,
    resourceKey: bound.bind.lease.resourceKey,
    claimKey: bound.bind.claim.claimKey,
    leaseKey: bound.bind.lease.leaseKey,
    governanceRevision: DLP002_REV,
    fencingEpoch: bound.bind.lease.fencingEpoch,
    expectedVersion: bound.bind.lease.version,
    ...releaseOverrides,
  };
  const input = {
    compositionGovernanceRevision: DLP004_REV,
    release,
    audit: baseAudit({
      eventId: 'evt-release-1',
      eventType: 'TASK_RELEASED',
      taskId: release.taskId,
      actorId: release.actorId,
      idempotencyKey: 'audit-release-1',
      ...auditOverrides,
    }),
  };
  if (evidence !== undefined) {
    input.evidence = evidence && {
      ...baseEvidence({
        evidenceId: 'evd-release-1',
        taskId: release.taskId,
        actorId: release.actorId,
        idempotencyKey: 'evd-release-1',
      }),
      ...evidence,
    };
  }
  return input;
}

async function countHeldClaims(client, resourceType, resourceKey) {
  const r = await client.query(
    `SELECT count(*)::int AS n FROM dlp_task_claim
      WHERE resource_type = $1 AND resource_key = $2 AND status = 'HELD'`,
    [resourceType, resourceKey],
  );
  return r.rows[0].n;
}

async function countActiveLeases(client, resourceType, resourceKey) {
  const r = await client.query(
    `SELECT count(*)::int AS n FROM dlp_write_lease
      WHERE resource_type = $1 AND resource_key = $2
        AND status = 'ACTIVE' AND expires_at > clock_timestamp()`,
    [resourceType, resourceKey],
  );
  return r.rows[0].n;
}

async function countAudit(client, eventId) {
  const r = await client.query(
    'SELECT count(*)::int AS n FROM dlp_audit_event WHERE event_id = $1',
    [eventId],
  );
  return r.rows[0].n;
}

async function countEvidence(client, evidenceId) {
  const r = await client.query(
    'SELECT count(*)::int AS n FROM dlp_evidence_fact WHERE evidence_id = $1',
    [evidenceId],
  );
  return r.rows[0].n;
}

async function countTask(client, taskId) {
  const r = await client.query(
    'SELECT count(*)::int AS n FROM dlp_task WHERE task_id = $1',
    [taskId],
  );
  return r.rows[0].n;
}

test('DLP-004 isolation: unix socket only disposable PostgreSQL', () => {
  assert.equal(isolationEvidence.listenAddresses, '');
  assert.equal(isolationEvidence.tcpRejected, true);
  assert.equal(isolationEvidence.databaseUrlUsed, false);
  assert.match(isolationEvidence.postgresVersion, /^postgres \(PostgreSQL\) 14\.24/);
  console.log('DLP004_ISOLATION', JSON.stringify({
    postgresVersion: isolationEvidence.postgresVersion,
    listenAddresses: isolationEvidence.listenAddresses,
    tcpRejected: isolationEvidence.tcpRejected,
    databaseUrlUsed: isolationEvidence.databaseUrlUsed,
    socketPort: isolationEvidence.socketPort,
    isolationFingerprint: harness.isolationFingerprint,
  }));
});

test('adapter source: no BEGIN/COMMIT/ROLLBACK; no hash-chain; layer revisions distinct', () => {
  assert.equal(DLP002_GOVERNANCE_REVISION, DLP002_REV);
  assert.equal(DLP003_GOVERNANCE_REVISION, DLP003_REV);
  assert.equal(DLP004_REV, 'DLP004_AUTHORIZATION_20261031');
  assert.notEqual(DLP002_REV, DLP003_REV);
  assert.notEqual(DLP004_REV, DLP002_REV);
  assert.match(adapterSrc, /NON_OPERATIONAL/);
  assert.match(adapterSrc, /bindTaskClaimLeaseInTransaction/);
  assert.match(adapterSrc, /releaseTaskClaimLeaseInTransaction/);
  assert.match(adapterSrc, /appendAuditEventInTransaction/);
  assert.match(adapterSrc, /withOwnedWriteLeaseTransaction/);
  const codeOnly = adapterSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(codeOnly, /hash[_-]?chain/i);
  assert.doesNotMatch(codeOnly, /['"`]BEGIN['"`]/i);
  assert.doesNotMatch(codeOnly, /['"`]COMMIT['"`]/i);
  assert.doesNotMatch(codeOnly, /['"`]ROLLBACK['"`]/i);
  // Must not call self-managing public bind/release.
  assert.doesNotMatch(codeOnly, /bindTaskClaimLease\(/);
  assert.doesNotMatch(codeOnly, /releaseTaskClaimLease\(/);
});

test('bind + Audit atomic COMMIT', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    const input = bindPhase({
      taskId: 'task-bind-audit',
      actorId: 'actor-bind-audit',
      resourceKey: 'res-bind-audit',
      claimKey: 'claim-bind-audit',
      leaseKey: 'lease-bind-audit',
      compositionIdempotencyKey: 'comp-idem-bind-audit',
      leaseIdempotencyKey: 'lease-idem-bind-audit',
    }, {
      eventId: 'evt-bind-audit',
      idempotencyKey: 'audit-bind-audit',
    });
    const out = await bindTaskClaimLeaseWithAudit(client, input);
    assert.equal(out.decision, LIFECYCLE_DECISIONS.BOUND_WITH_AUDIT);
    assert.equal(out.ok, true);
    assert.equal(out.operational, false);
    assert.equal(out.bind.decision, COMPOSITION_DECISIONS.BOUND);
    assert.equal(out.audit.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
    assert.equal(await countHeldClaims(client, 'task_worktree', 'res-bind-audit'), 1);
    assert.equal(await countActiveLeases(client, 'task_worktree', 'res-bind-audit'), 1);
    assert.equal(await countAudit(client, 'evt-bind-audit'), 1);
  } finally {
    await client.end();
  }
});

test('bind + Audit + Evidence atomic COMMIT', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    const input = bindPhase({
      taskId: 'task-bind-ev',
      actorId: 'actor-bind-ev',
      resourceKey: 'res-bind-ev',
      claimKey: 'claim-bind-ev',
      leaseKey: 'lease-bind-ev',
      compositionIdempotencyKey: 'comp-idem-bind-ev',
      leaseIdempotencyKey: 'lease-idem-bind-ev',
    }, {
      eventId: 'evt-bind-ev',
      idempotencyKey: 'audit-bind-ev',
    }, {
      evidenceId: 'evd-bind-ev',
      idempotencyKey: 'evd-idem-bind-ev',
    });
    const out = await bindTaskClaimLeaseWithAudit(client, input);
    assert.equal(out.decision, LIFECYCLE_DECISIONS.BOUND_WITH_AUDIT);
    assert.equal(out.evidence.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
    assert.equal(await countEvidence(client, 'evd-bind-ev'), 1);
    assert.equal(await countAudit(client, 'evt-bind-ev'), 1);
    assert.equal(await countTask(client, 'task-bind-ev'), 1);
  } finally {
    await client.end();
  }
});

test('Audit DENY after bind causes full bind-phase rollback (no ghost rows)', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    // Seed a conflicting audit idempotency binding first.
    const seed = bindPhase({
      taskId: 'task-seed-audit',
      actorId: 'actor-seed',
      resourceKey: 'res-seed-audit',
      claimKey: 'claim-seed-audit',
      leaseKey: 'lease-seed-audit',
      compositionIdempotencyKey: 'comp-idem-seed-audit',
      leaseIdempotencyKey: 'lease-idem-seed-audit',
    }, {
      eventId: 'evt-seed-conflict',
      idempotencyKey: 'audit-conflict-key',
    });
    const seeded = await bindTaskClaimLeaseWithAudit(client, seed);
    assert.equal(seeded.ok, true);

    const conflict = bindPhase({
      taskId: 'task-audit-deny',
      actorId: 'actor-audit-deny',
      resourceKey: 'res-audit-deny',
      claimKey: 'claim-audit-deny',
      leaseKey: 'lease-audit-deny',
      compositionIdempotencyKey: 'comp-idem-audit-deny',
      leaseIdempotencyKey: 'lease-idem-audit-deny',
    }, {
      eventId: 'evt-audit-deny',
      idempotencyKey: 'audit-conflict-key', // same key, different binding
      eventType: 'OTHER_TYPE',
    });
    const denied = await bindTaskClaimLeaseWithAudit(client, conflict);
    assert.equal(denied.ok, false);
    assert.equal(denied.decision, LIFECYCLE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    assert.equal(await countTask(client, 'task-audit-deny'), 0);
    assert.equal(await countHeldClaims(client, 'task_worktree', 'res-audit-deny'), 0);
    assert.equal(await countActiveLeases(client, 'task_worktree', 'res-audit-deny'), 0);
    assert.equal(await countAudit(client, 'evt-audit-deny'), 0);
  } finally {
    await client.end();
  }
});

test('Evidence failure causes full bind-phase rollback', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    const seed = bindPhase({
      taskId: 'task-seed-ev',
      actorId: 'actor-seed-ev',
      resourceKey: 'res-seed-ev',
      claimKey: 'claim-seed-ev',
      leaseKey: 'lease-seed-ev',
      compositionIdempotencyKey: 'comp-idem-seed-ev',
      leaseIdempotencyKey: 'lease-idem-seed-ev',
    }, {
      eventId: 'evt-seed-ev',
      idempotencyKey: 'audit-seed-ev',
    }, {
      evidenceId: 'evd-seed-conflict',
      idempotencyKey: 'evd-conflict-key',
    });
    assert.equal((await bindTaskClaimLeaseWithAudit(client, seed)).ok, true);

    const conflict = bindPhase({
      taskId: 'task-ev-deny',
      actorId: 'actor-ev-deny',
      resourceKey: 'res-ev-deny',
      claimKey: 'claim-ev-deny',
      leaseKey: 'lease-ev-deny',
      compositionIdempotencyKey: 'comp-idem-ev-deny',
      leaseIdempotencyKey: 'lease-idem-ev-deny',
    }, {
      eventId: 'evt-ev-deny',
      idempotencyKey: 'audit-ev-deny',
    }, {
      evidenceId: 'evd-ev-deny',
      idempotencyKey: 'evd-conflict-key',
      evidenceType: 'OTHER',
    });
    const denied = await bindTaskClaimLeaseWithAudit(client, conflict);
    assert.equal(denied.ok, false);
    assert.equal(denied.decision, LIFECYCLE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    assert.equal(await countTask(client, 'task-ev-deny'), 0);
    assert.equal(await countAudit(client, 'evt-ev-deny'), 0);
    assert.equal(await countEvidence(client, 'evd-ev-deny'), 0);
    assert.equal(await countHeldClaims(client, 'task_worktree', 'res-ev-deny'), 0);
  } finally {
    await client.end();
  }
});

test('release + Audit atomic COMMIT', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    const bound = await bindTaskClaimLeaseWithAudit(client, bindPhase({
      taskId: 'task-rel',
      actorId: 'actor-rel',
      resourceKey: 'res-rel',
      claimKey: 'claim-rel',
      leaseKey: 'lease-rel',
      compositionIdempotencyKey: 'comp-idem-rel',
      leaseIdempotencyKey: 'lease-idem-rel',
    }, {
      eventId: 'evt-rel-bind',
      idempotencyKey: 'audit-rel-bind',
    }));
    assert.equal(bound.ok, true);

    const released = await releaseTaskClaimLeaseWithAudit(client, releasePhase(bound, {}, {
      eventId: 'evt-rel-ok',
      idempotencyKey: 'audit-rel-ok',
    }));
    assert.equal(released.decision, LIFECYCLE_DECISIONS.RELEASED_WITH_AUDIT);
    assert.equal(released.release.decision, COMPOSITION_DECISIONS.RELEASED);
    assert.equal(released.audit.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
    assert.equal(await countHeldClaims(client, 'task_worktree', 'res-rel'), 0);
    assert.equal(await countActiveLeases(client, 'task_worktree', 'res-rel'), 0);
    assert.equal(await countAudit(client, 'evt-rel-ok'), 1);
  } finally {
    await client.end();
  }
});

test('Audit DENY after release rolls back release phase; prior held state preserved', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    const seedAudit = bindPhase({
      taskId: 'task-seed-rel-audit',
      actorId: 'actor-seed-rel',
      resourceKey: 'res-seed-rel-audit',
      claimKey: 'claim-seed-rel-audit',
      leaseKey: 'lease-seed-rel-audit',
      compositionIdempotencyKey: 'comp-idem-seed-rel-audit',
      leaseIdempotencyKey: 'lease-idem-seed-rel-audit',
    }, {
      eventId: 'evt-seed-rel-conflict',
      idempotencyKey: 'audit-rel-conflict-key',
    });
    assert.equal((await bindTaskClaimLeaseWithAudit(client, seedAudit)).ok, true);

    const bound = await bindTaskClaimLeaseWithAudit(client, bindPhase({
      taskId: 'task-rel-deny',
      actorId: 'actor-rel-deny',
      resourceKey: 'res-rel-deny',
      claimKey: 'claim-rel-deny',
      leaseKey: 'lease-rel-deny',
      compositionIdempotencyKey: 'comp-idem-rel-deny',
      leaseIdempotencyKey: 'lease-idem-rel-deny',
    }, {
      eventId: 'evt-rel-deny-bind',
      idempotencyKey: 'audit-rel-deny-bind',
    }));
    assert.equal(bound.ok, true);
    assert.equal(await countHeldClaims(client, 'task_worktree', 'res-rel-deny'), 1);

    const denied = await releaseTaskClaimLeaseWithAudit(client, releasePhase(bound, {}, {
      eventId: 'evt-rel-deny',
      idempotencyKey: 'audit-rel-conflict-key',
      eventType: 'OTHER_RELEASE',
    }));
    assert.equal(denied.ok, false);
    assert.equal(denied.decision, LIFECYCLE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    assert.equal(await countHeldClaims(client, 'task_worktree', 'res-rel-deny'), 1);
    assert.equal(await countActiveLeases(client, 'task_worktree', 'res-rel-deny'), 1);
    assert.equal(await countAudit(client, 'evt-rel-deny'), 0);
    const task = await client.query(`SELECT status FROM dlp_task WHERE task_id = 'task-rel-deny'`);
    assert.equal(task.rows[0].status, 'CLAIMED');
  } finally {
    await client.end();
  }
});

test('idempotent same-key replay and conflicting composition key DENY', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    const input = bindPhase({
      taskId: 'task-idem',
      actorId: 'actor-idem',
      resourceKey: 'res-idem',
      claimKey: 'claim-idem',
      leaseKey: 'lease-idem',
      compositionIdempotencyKey: 'comp-idem-same',
      leaseIdempotencyKey: 'lease-idem-same',
    }, {
      eventId: 'evt-idem',
      idempotencyKey: 'audit-idem-same',
    });
    const first = await bindTaskClaimLeaseWithAudit(client, input);
    assert.equal(first.ok, true);

    const replay = await bindTaskClaimLeaseWithAudit(client, input);
    assert.equal(replay.ok, true);
    assert.ok([
      LIFECYCLE_DECISIONS.BOUND_WITH_AUDIT,
      LIFECYCLE_DECISIONS.BOUND_WITH_AUDIT_REPLAY,
    ].includes(replay.decision));
    assert.equal(replay.bind.decision, COMPOSITION_DECISIONS.REPLAY);
    assert.equal(replay.audit.decision, AUDIT_EVIDENCE_DECISIONS.REPLAY);

    const conflict = bindPhase({
      taskId: 'task-idem-other',
      actorId: 'actor-idem-other',
      resourceKey: 'res-idem-other',
      claimKey: 'claim-idem-other',
      leaseKey: 'lease-idem-other',
      compositionIdempotencyKey: 'comp-idem-same',
      leaseIdempotencyKey: 'lease-idem-other',
    }, {
      eventId: 'evt-idem-other',
      idempotencyKey: 'audit-idem-other',
    });
    const denied = await bindTaskClaimLeaseWithAudit(client, conflict);
    assert.equal(denied.ok, false);
    assert.ok([
      LIFECYCLE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT,
      LIFECYCLE_DECISIONS.DENY_BIND,
    ].includes(denied.decision));
    assert.equal(await countTask(client, 'task-idem-other'), 0);
  } finally {
    await client.end();
  }
});

test('two concurrent contenders: exactly one successful held owner', async () => {
  const resourceKey = 'res-race-2';
  const c1 = createCompositionClient();
  const c2 = createCompositionClient();
  await c1.connect();
  await c2.connect();
  try {
    const [a, b] = await Promise.all([
      bindTaskClaimLeaseWithAudit(c1, bindPhase({
        taskId: 'task-r2-a',
        actorId: 'actor-r2-a',
        resourceKey,
        claimKey: 'claim-r2-a',
        leaseKey: 'lease-r2-a',
        compositionIdempotencyKey: 'comp-idem-r2-a',
        leaseIdempotencyKey: 'lease-idem-r2-a',
      }, { eventId: 'evt-r2-a', idempotencyKey: 'audit-r2-a' })),
      bindTaskClaimLeaseWithAudit(c2, bindPhase({
        taskId: 'task-r2-b',
        actorId: 'actor-r2-b',
        resourceKey,
        claimKey: 'claim-r2-b',
        leaseKey: 'lease-r2-b',
        compositionIdempotencyKey: 'comp-idem-r2-b',
        leaseIdempotencyKey: 'lease-idem-r2-b',
      }, { eventId: 'evt-r2-b', idempotencyKey: 'audit-r2-b' })),
    ]);
    const ok = [a, b].filter((x) => x.ok);
    const denied = [a, b].filter((x) => !x.ok);
    assert.equal(ok.length, 1);
    assert.equal(denied.length, 1);
    assert.equal(await countHeldClaims(c1, 'task_worktree', resourceKey), 1);
    assert.equal(await countActiveLeases(c1, 'task_worktree', resourceKey), 1);
    console.log('DLP004_RACE2', JSON.stringify({
      boundActor: ok[0].bind.lease.actorId,
      deniedDecision: denied[0].decision,
    }));
  } finally {
    await c1.end();
    await c2.end();
  }
});

test('10+ concurrent contenders: exactly one successful held owner', async () => {
  const resourceKey = 'res-race-12';
  const N = 12;
  const clients = [];
  for (let i = 0; i < N; i += 1) {
    const c = createCompositionClient();
    await c.connect();
    clients.push(c);
  }
  try {
    const results = await Promise.all(clients.map((client, i) => bindTaskClaimLeaseWithAudit(client, bindPhase({
      taskId: `task-r12-${i}`,
      actorId: `actor-r12-${i}`,
      resourceKey,
      claimKey: `claim-r12-${i}`,
      leaseKey: `lease-r12-${i}`,
      compositionIdempotencyKey: `comp-idem-r12-${i}`,
      leaseIdempotencyKey: `lease-idem-r12-${i}`,
    }, {
      eventId: `evt-r12-${i}`,
      idempotencyKey: `audit-r12-${i}`,
    }))));
    const ok = results.filter((x) => x.ok);
    const denied = results.filter((x) => !x.ok);
    assert.equal(ok.length, 1);
    assert.equal(denied.length, N - 1);
    assert.equal(await countHeldClaims(clients[0], 'task_worktree', resourceKey), 1);
    console.log('DLP004_RACE12', JSON.stringify({
      contenders: N,
      bound: ok.length,
      denied: denied.length,
    }));
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
});

test('no nested transaction: public bind inside owned txn still DENY_CLIENT_NOT_IDLE', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    await assert.rejects(
      () => withOwnedWriteLeaseTransaction(client, async () => (
        bindTaskClaimLease(client, baseBind({
          taskId: 'task-nested',
          actorId: 'actor-nested',
          resourceKey: 'res-nested',
          claimKey: 'claim-nested',
          leaseKey: 'lease-nested',
          compositionIdempotencyKey: 'comp-idem-nested',
          leaseIdempotencyKey: 'lease-idem-nested',
        }))
      )),
      (err) => err && err.code === WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE,
    );
  } finally {
    await client.end();
  }
});

test('layer-specific governance revision DENY', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    const badComp = await bindTaskClaimLeaseWithAudit(client, {
      ...bindPhase({
        taskId: 'task-gov-c',
        resourceKey: 'res-gov-c',
        claimKey: 'claim-gov-c',
        leaseKey: 'lease-gov-c',
        compositionIdempotencyKey: 'comp-idem-gov-c',
        leaseIdempotencyKey: 'lease-idem-gov-c',
      }, { eventId: 'evt-gov-c', idempotencyKey: 'audit-gov-c' }),
      compositionGovernanceRevision: 'WRONG_DLP004',
    });
    assert.equal(badComp.decision, LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);

    const badBind = await bindTaskClaimLeaseWithAudit(client, bindPhase({
      taskId: 'task-gov-b',
      resourceKey: 'res-gov-b',
      claimKey: 'claim-gov-b',
      leaseKey: 'lease-gov-b',
      compositionIdempotencyKey: 'comp-idem-gov-b',
      leaseIdempotencyKey: 'lease-idem-gov-b',
      governanceRevision: 'WRONG_DLP002',
    }, { eventId: 'evt-gov-b', idempotencyKey: 'audit-gov-b' }));
    assert.equal(badBind.decision, LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);

    const badAudit = await bindTaskClaimLeaseWithAudit(client, bindPhase({
      taskId: 'task-gov-a',
      resourceKey: 'res-gov-a',
      claimKey: 'claim-gov-a',
      leaseKey: 'lease-gov-a',
      compositionIdempotencyKey: 'comp-idem-gov-a',
      leaseIdempotencyKey: 'lease-idem-gov-a',
    }, {
      eventId: 'evt-gov-a',
      idempotencyKey: 'audit-gov-a',
      governanceRevision: 'WRONG_DLP003',
    }));
    assert.equal(badAudit.decision, LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
    assert.equal(await countTask(client, 'task-gov-a'), 0);
  } finally {
    await client.end();
  }
});

test('database outage fails closed', async () => {
  const client = createCompositionClient();
  await client.connect();
  await client.end();
  const outage = await bindTaskClaimLeaseWithAudit(client, bindPhase({
    taskId: 'task-outage',
    resourceKey: 'res-outage',
    claimKey: 'claim-outage',
    leaseKey: 'lease-outage',
    compositionIdempotencyKey: 'comp-idem-outage',
    leaseIdempotencyKey: 'lease-idem-outage',
  }, { eventId: 'evt-outage', idempotencyKey: 'audit-outage' }));
  assert.equal(outage.ok, false);
  assert.equal(outage.decision, LIFECYCLE_DECISIONS.BLOCKED_DB_FAILURE);
});

test('composition role: least privilege, no audit mutate, no trigger disable, no owner assume', async () => {
  const client = createCompositionClient();
  await client.connect();
  try {
    const attrs = await client.query(`
      SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolname
        FROM pg_roles WHERE rolname = current_user`);
    assert.equal(attrs.rows[0].rolname, 'dlp_composition_proof');
    assert.equal(attrs.rows[0].rolsuper, false);
    assert.equal(attrs.rows[0].rolcreatedb, false);
    assert.equal(attrs.rows[0].rolcreaterole, false);
    assert.equal(attrs.rows[0].rolbypassrls, false);

    await assert.rejects(
      () => client.query(`UPDATE dlp_audit_event SET event_type = 'X' WHERE false`),
      /permission denied/i,
    );
    await assert.rejects(
      () => client.query(`DELETE FROM dlp_audit_event WHERE false`),
      /permission denied/i,
    );
    await assert.rejects(
      () => client.query(`ALTER TABLE dlp_audit_event DISABLE TRIGGER USER`),
      /must be owner|permission denied/i,
    );
    await assert.rejects(
      () => client.query(`SET ROLE dlp_audit_owner`),
      /permission denied|cannot/i,
    );

    // Insert-only works for audit under composition role when inside owned txn via API.
    const ok = await bindTaskClaimLeaseWithAudit(client, bindPhase({
      taskId: 'task-role',
      actorId: 'actor-role',
      resourceKey: 'res-role',
      claimKey: 'claim-role',
      leaseKey: 'lease-role',
      compositionIdempotencyKey: 'comp-idem-role',
      leaseIdempotencyKey: 'lease-idem-role',
    }, { eventId: 'evt-role', idempotencyKey: 'audit-role' }));
    assert.equal(ok.ok, true);

    // Even with a row present, UPDATE/DELETE still denied (privilege + would hit trigger if owner).
    await assert.rejects(
      () => client.query(`UPDATE dlp_audit_event SET event_type = 'HACK' WHERE event_id = 'evt-role'`),
      /permission denied|DLP003_IMMUTABLE_ROW/i,
    );
  } finally {
    await client.end();
  }
});
