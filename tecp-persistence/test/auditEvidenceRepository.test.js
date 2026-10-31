/**
 * TECP-DLP-003 disposable immutable Audit/Evidence append tests.
 * NON_OPERATIONAL proof. Requires local ephemeral PostgreSQL via harness.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import pg from 'pg';

import {
  APPROVED_GOVERNANCE_REVISION,
  AUDIT_EVIDENCE_DECISIONS,
  appendAuditEventInTransaction,
  appendEvidenceInTransaction,
  listAuditEventsByTask,
  listEvidenceByTask,
} from '../src/auditEvidenceRepository.js';
import {
  WRITE_LEASE_DECISIONS,
  withOwnedWriteLeaseTransaction,
} from '../src/writeLeaseRepository.js';
import {
  createDisposablePgHarness,
} from './disposablePgHarness.js';

const { Client } = pg;
const here = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(here, 'disposableAuditEvidenceSchema.sql'), 'utf8');
const repoSrc = readFileSync(join(here, '../src/auditEvidenceRepository.js'), 'utf8');

let harness;
let isolationEvidence;

async function applyAuditEvidenceSchema() {
  const client = await harness.createClient();
  try {
    await client.query(schemaSql);
  } finally {
    await client.end();
  }
}

function createProofRoleClient() {
  return new Client({
    host: harness.socketDir,
    port: harness.socketPort,
    user: 'dlp_audit_proof',
    database: 'dlp_proof',
  });
}

function createOwnerRoleClient() {
  return new Client({
    host: harness.socketDir,
    port: harness.socketPort,
    user: 'dlp_audit_owner',
    database: 'dlp_proof',
  });
}

before(async () => {
  harness = createDisposablePgHarness();
  isolationEvidence = await harness.proveIsolation();
  await harness.createProofDatabase();
  await applyAuditEvidenceSchema();
});

after(async () => {
  if (harness) {
    await harness.stop();
  }
});

function baseAudit(overrides = {}) {
  return {
    eventId: 'evt-1',
    eventType: 'TASK_CLAIMED',
    taskId: 'task-a',
    actorId: 'actor-a',
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    idempotencyKey: 'audit-idem-1',
    ...overrides,
  };
}

function baseEvidence(overrides = {}) {
  return {
    evidenceId: 'evd-1',
    taskId: 'task-a',
    actorId: 'actor-a',
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    evidenceType: 'TEST_LOG',
    evidenceRef: 'sha256:abc',
    idempotencyKey: 'evd-idem-1',
    ...overrides,
  };
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

test('isolation evidence: unix socket only, no env DB URL, listen_addresses empty', () => {
  assert.equal(isolationEvidence.listenAddresses, '');
  assert.equal(isolationEvidence.tcpRejected, true);
  assert.equal(isolationEvidence.databaseUrlUsed, false);
  assert.ok(isolationEvidence.socketDir);
  assert.match(isolationEvidence.postgresVersion, /^postgres \(PostgreSQL\) 14\.24/);
});

test('repository source never issues BEGIN/COMMIT/ROLLBACK and reuses owned-txn assert', () => {
  assert.match(repoSrc, /assertOwnedWriteLeaseTransaction/);
  assert.match(repoSrc, /NON_OPERATIONAL/);
  // Ignore documentation comments; forbid executable SQL transaction verbs only.
  const codeOnly = repoSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(codeOnly, /['"`]BEGIN['"`]/i);
  assert.doesNotMatch(codeOnly, /['"`]COMMIT['"`]/i);
  assert.doesNotMatch(codeOnly, /['"`]ROLLBACK['"`]/i);
  assert.doesNotMatch(codeOnly, /bindTaskClaimLease/);
  assert.doesNotMatch(codeOnly, /releaseTaskClaimLease/);
  assert.doesNotMatch(codeOnly, /hash[_-]?chain/i);
});

test('successful audit append inside caller-owned transaction', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    const out = await withOwnedWriteLeaseTransaction(client, async () => (
      appendAuditEventInTransaction(client, baseAudit({
        eventId: 'evt-success-a',
        idempotencyKey: 'audit-success-a',
      }))
    ));
    assert.equal(out.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
    assert.equal(out.ok, true);
    assert.equal(out.operational, false);
    assert.equal(out.record.eventId, 'evt-success-a');
    assert.equal(out.record.eventType, 'TASK_CLAIMED');
    assert.equal(typeof out.record.ord, 'number');
    assert.ok(out.record.ord >= 1);
    assert.equal(await countAudit(client, 'evt-success-a'), 1);
  } finally {
    await client.end();
  }
});

test('successful evidence append inside caller-owned transaction', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    const out = await withOwnedWriteLeaseTransaction(client, async () => (
      appendEvidenceInTransaction(client, baseEvidence({
        evidenceId: 'evd-success-a',
        idempotencyKey: 'evd-success-a',
      }))
    ));
    assert.equal(out.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
    assert.equal(out.ok, true);
    assert.equal(out.operational, false);
    assert.equal(out.record.evidenceId, 'evd-success-a');
    assert.equal(out.record.evidenceType, 'TEST_LOG');
    assert.equal(await countEvidence(client, 'evd-success-a'), 1);
  } finally {
    await client.end();
  }
});

test('unmarked client DENY_NO_TRANSACTION_OWNERSHIP', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    const out = await appendAuditEventInTransaction(client, baseAudit({
      eventId: 'evt-unmarked',
      idempotencyKey: 'audit-unmarked',
    }));
    assert.equal(out.decision, AUDIT_EVIDENCE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP);
    assert.equal(out.ok, false);
    assert.equal(await countAudit(client, 'evt-unmarked'), 0);
  } finally {
    await client.end();
  }
});

test('BEGIN without ownership GUC DENY_NO_TRANSACTION_OWNERSHIP', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    await client.query('BEGIN');
    const out = await appendEvidenceInTransaction(client, baseEvidence({
      evidenceId: 'evd-bare-begin',
      idempotencyKey: 'evd-bare-begin',
    }));
    assert.equal(out.decision, AUDIT_EVIDENCE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP);
    await client.query('ROLLBACK');
    assert.equal(await countEvidence(client, 'evd-bare-begin'), 0);
  } finally {
    await client.end();
  }
});

test('same-key same-binding audit replay', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    const input = baseAudit({
      eventId: 'evt-replay',
      idempotencyKey: 'audit-replay',
    });
    const first = await withOwnedWriteLeaseTransaction(client, async () => (
      appendAuditEventInTransaction(client, input)
    ));
    assert.equal(first.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
    const second = await withOwnedWriteLeaseTransaction(client, async () => (
      appendAuditEventInTransaction(client, input)
    ));
    assert.equal(second.decision, AUDIT_EVIDENCE_DECISIONS.REPLAY);
    assert.equal(second.record.ord, first.record.ord);
    assert.equal(await countAudit(client, 'evt-replay'), 1);
  } finally {
    await client.end();
  }
});

test('same-key different-binding audit DENY_IDEMPOTENCY_CONFLICT preserves row', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    const first = await withOwnedWriteLeaseTransaction(client, async () => (
      appendAuditEventInTransaction(client, baseAudit({
        eventId: 'evt-conflict-a',
        idempotencyKey: 'audit-conflict',
        actorId: 'actor-a',
      }))
    ));
    assert.equal(first.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
    const conflict = await withOwnedWriteLeaseTransaction(client, async () => (
      appendAuditEventInTransaction(client, baseAudit({
        eventId: 'evt-conflict-b',
        idempotencyKey: 'audit-conflict',
        actorId: 'actor-b',
      }))
    ));
    assert.equal(conflict.decision, AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    assert.equal(await countAudit(client, 'evt-conflict-a'), 1);
    assert.equal(await countAudit(client, 'evt-conflict-b'), 0);
  } finally {
    await client.end();
  }
});

test('concurrent conflicting audit appends yield one winner and conflict DENYs', async () => {
  const n = 8;
  const clients = [];
  for (let i = 0; i < n; i += 1) {
    const c = createProofRoleClient();
    await c.connect();
    clients.push(c);
  }
  try {
    const results = await Promise.all(clients.map((client, i) => (
      withOwnedWriteLeaseTransaction(client, async () => (
        appendAuditEventInTransaction(client, baseAudit({
          eventId: `evt-race-${i}`,
          actorId: `actor-race-${i}`,
          idempotencyKey: 'audit-race-shared',
        }))
      ))
    )));
    const appended = results.filter((r) => r.decision === AUDIT_EVIDENCE_DECISIONS.APPENDED);
    const conflicts = results.filter((r) => r.decision === AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    const replays = results.filter((r) => r.decision === AUDIT_EVIDENCE_DECISIONS.REPLAY);
    assert.equal(appended.length, 1);
    assert.equal(appended.length + conflicts.length + replays.length, n);
    const reader = createProofRoleClient();
    await reader.connect();
    try {
      const count = await reader.query(
        'SELECT count(*)::int AS n FROM dlp_audit_event WHERE idempotency_key = $1',
        ['audit-race-shared'],
      );
      assert.equal(count.rows[0].n, 1);
    } finally {
      await reader.end();
    }
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
});

test('invalid governance revision DENY', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    const out = await withOwnedWriteLeaseTransaction(client, async () => (
      appendAuditEventInTransaction(client, baseAudit({
        eventId: 'evt-gov-bad',
        idempotencyKey: 'audit-gov-bad',
        governanceRevision: 'NOT_AUTHORIZED_REVISION',
      }))
    ));
    assert.equal(out.decision, AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
    assert.equal(await countAudit(client, 'evt-gov-bad'), 0);

    const evd = await withOwnedWriteLeaseTransaction(client, async () => (
      appendEvidenceInTransaction(client, baseEvidence({
        evidenceId: 'evd-gov-bad',
        idempotencyKey: 'evd-gov-bad',
        governanceRevision: 'NOT_AUTHORIZED_REVISION',
      }))
    ));
    assert.equal(evd.decision, AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
    assert.equal(await countEvidence(client, 'evd-gov-bad'), 0);
  } finally {
    await client.end();
  }
});

test('mid-transaction ROLLBACK leaves no ghost audit or evidence rows', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    await assert.rejects(
      () => withOwnedWriteLeaseTransaction(client, async () => {
        const a = await appendAuditEventInTransaction(client, baseAudit({
          eventId: 'evt-rb',
          idempotencyKey: 'audit-rb',
        }));
        assert.equal(a.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
        const e = await appendEvidenceInTransaction(client, baseEvidence({
          evidenceId: 'evd-rb',
          idempotencyKey: 'evd-rb',
        }));
        assert.equal(e.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
        throw new Error('FORCE_ROLLBACK');
      }),
      /FORCE_ROLLBACK/,
    );
    assert.equal(await countAudit(client, 'evt-rb'), 0);
    assert.equal(await countEvidence(client, 'evd-rb'), 0);
  } finally {
    await client.end();
  }
});

test('proof-role UPDATE/DELETE denied by privileges', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    await withOwnedWriteLeaseTransaction(client, async () => (
      appendAuditEventInTransaction(client, baseAudit({
        eventId: 'evt-priv',
        idempotencyKey: 'audit-priv',
      }))
    ));
    await assert.rejects(
      () => client.query(
        `UPDATE dlp_audit_event SET event_type = 'MUTATED' WHERE event_id = 'evt-priv'`,
      ),
      (err) => {
        assert.ok(err);
        assert.match(String(err.message), /permission denied|must be owner/i);
        return true;
      },
    );
    await assert.rejects(
      () => client.query(`DELETE FROM dlp_audit_event WHERE event_id = 'evt-priv'`),
      (err) => {
        assert.ok(err);
        assert.match(String(err.message), /permission denied|must be owner/i);
        return true;
      },
    );
    const row = await client.query(
      `SELECT event_type FROM dlp_audit_event WHERE event_id = 'evt-priv'`,
    );
    assert.equal(row.rows[0].event_type, 'TASK_CLAIMED');
  } finally {
    await client.end();
  }
});

test('owner-role UPDATE/DELETE denied by immutability trigger', async () => {
  const proof = createProofRoleClient();
  await proof.connect();
  try {
    await withOwnedWriteLeaseTransaction(proof, async () => (
      appendEvidenceInTransaction(proof, baseEvidence({
        evidenceId: 'evd-trg',
        idempotencyKey: 'evd-trg',
      }))
    ));
  } finally {
    await proof.end();
  }

  const owner = createOwnerRoleClient();
  await owner.connect();
  try {
    // Owner has UPDATE/DELETE privilege; trigger must still fail closed.
    await assert.rejects(
      () => owner.query(
        `UPDATE dlp_evidence_fact SET evidence_ref = 'tampered' WHERE evidence_id = 'evd-trg'`,
      ),
      (err) => {
        assert.ok(err);
        assert.match(String(err.message), /DLP003_IMMUTABLE_ROW/);
        return true;
      },
    );
    await assert.rejects(
      () => owner.query(`DELETE FROM dlp_evidence_fact WHERE evidence_id = 'evd-trg'`),
      (err) => {
        assert.ok(err);
        assert.match(String(err.message), /DLP003_IMMUTABLE_ROW/);
        return true;
      },
    );
    const row = await owner.query(
      `SELECT evidence_ref FROM dlp_evidence_fact WHERE evidence_id = 'evd-trg'`,
    );
    assert.equal(row.rows[0].evidence_ref, 'sha256:abc');
  } finally {
    await owner.end();
  }
});

test('database outage fail-closed maps to BLOCKED_DB_FAILURE', async () => {
  const fake = {
    query: async () => {
      const err = new Error('Connection terminated unexpectedly');
      err.code = '08006';
      throw err;
    },
  };
  const out = await appendAuditEventInTransaction(fake, baseAudit({
    eventId: 'evt-outage',
    idempotencyKey: 'audit-outage',
  }));
  assert.equal(out.decision, AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE);
  assert.equal(out.ok, false);
});

test('event ordering uses database-issued ord without commit-order claim', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    await withOwnedWriteLeaseTransaction(client, async () => {
      const a = await appendAuditEventInTransaction(client, baseAudit({
        eventId: 'evt-ord-1',
        taskId: 'task-ord',
        idempotencyKey: 'audit-ord-1',
      }));
      const b = await appendAuditEventInTransaction(client, baseAudit({
        eventId: 'evt-ord-2',
        taskId: 'task-ord',
        idempotencyKey: 'audit-ord-2',
      }));
      assert.equal(a.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
      assert.equal(b.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);
      assert.ok(b.record.ord > a.record.ord);
    });
    const listed = await listAuditEventsByTask(client, 'task-ord');
    assert.equal(listed.ok, true);
    assert.equal(listed.orderingNote, 'ORDER_BY_DATABASE_ISSUED_ORD_NOT_COMMIT_ORDER_PROOF');
    assert.equal(listed.records.length, 2);
    assert.ok(listed.records[0].ord < listed.records[1].ord);
    assert.equal(listed.records[0].eventId, 'evt-ord-1');
    assert.equal(listed.records[1].eventId, 'evt-ord-2');

    await withOwnedWriteLeaseTransaction(client, async () => {
      await appendEvidenceInTransaction(client, baseEvidence({
        evidenceId: 'evd-ord-1',
        taskId: 'task-ord',
        idempotencyKey: 'evd-ord-1',
      }));
      await appendEvidenceInTransaction(client, baseEvidence({
        evidenceId: 'evd-ord-2',
        taskId: 'task-ord',
        idempotencyKey: 'evd-ord-2',
      }));
    });
    const evListed = await listEvidenceByTask(client, 'task-ord');
    assert.equal(evListed.ok, true);
    assert.equal(evListed.orderingNote, 'ORDER_BY_DATABASE_ISSUED_ORD_NOT_COMMIT_ORDER_PROOF');
    assert.equal(evListed.records.length, 2);
    assert.ok(evListed.records[0].ord < evListed.records[1].ord);
  } finally {
    await client.end();
  }
});

test('DENY paths do not COMMIT ghost rows from a failed owned transaction', async () => {
  const client = createProofRoleClient();
  await client.connect();
  try {
    const conflictSeed = await withOwnedWriteLeaseTransaction(client, async () => (
      appendAuditEventInTransaction(client, baseAudit({
        eventId: 'evt-seed',
        idempotencyKey: 'audit-seed',
        actorId: 'actor-seed',
      }))
    ));
    assert.equal(conflictSeed.decision, AUDIT_EVIDENCE_DECISIONS.APPENDED);

    const denied = await withOwnedWriteLeaseTransaction(client, async () => (
      appendAuditEventInTransaction(client, baseAudit({
        eventId: 'evt-ghost',
        idempotencyKey: 'audit-seed',
        actorId: 'actor-other',
      }))
    ));
    assert.equal(denied.decision, AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    assert.equal(await countAudit(client, 'evt-ghost'), 0);
  } finally {
    await client.end();
  }
});

test('source documents NON_OPERATIONAL and no unsupported claims', () => {
  assert.match(repoSrc, /NON_OPERATIONAL/);
  assert.match(repoSrc, /NOT authenticated/i);
  assert.doesNotMatch(repoSrc, /trusted operational/i);
  assert.equal(
    WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP,
    'DENY_NO_TRANSACTION_OWNERSHIP',
  );
});
