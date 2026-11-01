import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createInjectedClock } from '../src/workerCapabilityToken.js';
import {
  LEASE_SNAPSHOT_DECISIONS,
  LEASE_SNAPSHOT_KINDS,
  REQUIRED_LEASE_MATCH_FIELDS,
  createInMemoryTrustedLeaseSnapshotReader,
  isBrandedTrustedLeaseSnapshot,
  isBrandedTrustedLeaseSnapshotReader,
  matchTrustedLeaseSnapshot,
  readTrustedLeaseSnapshot,
} from '../src/trustedLeaseSnapshot.js';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '../src/trustedLeaseSnapshot.js');

function activeRow(overrides = {}) {
  return {
    leaseId: 'lease-1',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    ownerPrincipalId: 'worker-a',
    ownerActorId: 'worker-a',
    fencingEpoch: 7,
    status: 'ACTIVE',
    expiresAtMs: 1_700_000_060_000,
    ...overrides,
  };
}

test('branded reader and active snapshot ALLOW', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  assert.equal(isBrandedTrustedLeaseSnapshotReader(reader), true);
  assert.equal(reader.databaseBacked, false);
  assert.equal(reader.realLeaseAuthority, false);
  assert.equal(reader.kind, LEASE_SNAPSHOT_KINDS.TEST_ONLY_IN_MEMORY);

  reader.put(activeRow());
  const clock = createInjectedClock(1_700_000_000_000);
  const result = reader.read({ leaseId: 'lease-1' }, clock);
  assert.equal(result.allowed, true);
  assert.equal(result.decision, LEASE_SNAPSHOT_DECISIONS.ALLOW);
  assert.equal(isBrandedTrustedLeaseSnapshot(result.snapshot), true);
  assert.equal(result.snapshot.fencingEpoch, 7);
  assert.equal(result.snapshot.databaseBacked, false);
});

test('caller-constructed reader and snapshot DENY', () => {
  const clock = createInjectedClock();
  const fakeReader = {
    read() {
      return { allowed: true, snapshot: activeRow() };
    },
  };
  assert.equal(isBrandedTrustedLeaseSnapshotReader(fakeReader), false);
  const denied = readTrustedLeaseSnapshot(fakeReader, { leaseId: 'lease-1' }, clock);
  assert.equal(denied.allowed, false);
  assert.equal(denied.decision, LEASE_SNAPSHOT_DECISIONS.DENY_UNBRANDED_READER);

  const match = matchTrustedLeaseSnapshot(
    { ...activeRow(), snapshotKind: LEASE_SNAPSHOT_KINDS.TEST_ONLY_IN_MEMORY },
    {
      leaseId: 'lease-1',
      taskId: 'task-1',
      resourceType: 'TASK',
      resourceId: 'task-1',
      ownerPrincipalId: 'worker-a',
      ownerActorId: 'worker-a',
      fencingEpoch: 7,
    },
  );
  assert.equal(match.allowed, false);
  assert.equal(match.decision, LEASE_SNAPSHOT_DECISIONS.DENY_UNBRANDED_SNAPSHOT);
});

test('F1: caller-supplied Map cannot brand a snapshot via readTrustedLeaseSnapshot', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  const clock = createInjectedClock(1_700_000_000_000);
  const attackerMap = new Map();
  attackerMap.set('lease-evil', activeRow({
    leaseId: 'lease-evil',
    taskId: 'task-evil',
    resourceId: 'task-evil',
    ownerPrincipalId: 'attacker',
    ownerActorId: 'attacker',
    fencingEpoch: 99,
  }));
  // Extra args must be ignored — no public store injection.
  const result = readTrustedLeaseSnapshot(
    reader,
    { leaseId: 'lease-evil' },
    clock,
    attackerMap,
    () => false,
  );
  assert.equal(result.allowed, false);
  assert.equal(result.decision, LEASE_SNAPSHOT_DECISIONS.DENY_LEASE_NOT_FOUND);
  assert.equal(isBrandedTrustedLeaseSnapshot(result.snapshot), false);
  assert.equal(readTrustedLeaseSnapshot.length, 3);
});

test('copied / JSON-reconstructed snapshot DENY', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  reader.put(activeRow());
  const clock = createInjectedClock(1_700_000_000_000);
  const ok = reader.read({ leaseId: 'lease-1' }, clock);
  assert.equal(ok.allowed, true);

  const copy = { ...ok.snapshot };
  assert.equal(isBrandedTrustedLeaseSnapshot(copy), false);
  assert.equal(
    matchTrustedLeaseSnapshot(copy, { leaseId: 'lease-1' }).decision,
    LEASE_SNAPSHOT_DECISIONS.DENY_UNBRANDED_SNAPSHOT,
  );

  const roundTrip = JSON.parse(JSON.stringify(ok.snapshot));
  assert.equal(isBrandedTrustedLeaseSnapshot(roundTrip), false);
});

test('missing lease DENY', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  const clock = createInjectedClock();
  const result = reader.read({ leaseId: 'missing' }, clock);
  assert.equal(result.decision, LEASE_SNAPSHOT_DECISIONS.DENY_LEASE_NOT_FOUND);
});

test('expired lease DENY', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  reader.put(activeRow({ expiresAtMs: 1_700_000_000_000 }));
  const clock = createInjectedClock(1_700_000_000_000);
  const result = reader.read({ leaseId: 'lease-1' }, clock);
  assert.equal(result.decision, LEASE_SNAPSHOT_DECISIONS.DENY_LEASE_EXPIRED);
});

test('non-active lease DENY', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  reader.put(activeRow({ status: 'RELEASED' }));
  const clock = createInjectedClock(1_700_000_000_000);
  const result = reader.read({ leaseId: 'lease-1' }, clock);
  assert.equal(result.decision, LEASE_SNAPSHOT_DECISIONS.DENY_LEASE_NOT_ACTIVE);
});

test('reader unavailable FAIL CLOSED', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  reader.put(activeRow());
  reader.setUnavailable(true);
  const clock = createInjectedClock(1_700_000_000_000);
  const result = reader.read({ leaseId: 'lease-1' }, clock);
  assert.equal(result.decision, LEASE_SNAPSHOT_DECISIONS.DENY_READER_UNAVAILABLE);
});

test('clock unavailable FAIL CLOSED', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  reader.put(activeRow());
  const clock = createInjectedClock();
  clock.setUnavailable(true);
  const result = reader.read({ leaseId: 'lease-1' }, clock);
  assert.equal(result.decision, LEASE_SNAPSHOT_DECISIONS.DENY_CLOCK_UNAVAILABLE);
});

function completeMatch(overrides = {}) {
  return {
    leaseId: 'lease-1',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    ownerPrincipalId: 'worker-a',
    ownerActorId: 'worker-a',
    fencingEpoch: 7,
    ...overrides,
  };
}

test('F2: incomplete match context FAIL CLOSED — empty/partial expected DENY', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  reader.put(activeRow());
  const clock = createInjectedClock(1_700_000_000_000);
  const ok = reader.read({ leaseId: 'lease-1' }, clock);
  assert.equal(ok.allowed, true);

  assert.equal(
    matchTrustedLeaseSnapshot(ok.snapshot, {}).decision,
    LEASE_SNAPSHOT_DECISIONS.DENY_INCOMPLETE_MATCH_CONTEXT,
  );
  assert.equal(
    matchTrustedLeaseSnapshot(ok.snapshot, { leaseId: 'lease-1' }).decision,
    LEASE_SNAPSHOT_DECISIONS.DENY_INCOMPLETE_MATCH_CONTEXT,
  );
  for (const field of REQUIRED_LEASE_MATCH_FIELDS) {
    const partial = completeMatch();
    delete partial[field];
    assert.equal(
      matchTrustedLeaseSnapshot(ok.snapshot, partial).decision,
      LEASE_SNAPSHOT_DECISIONS.DENY_INCOMPLETE_MATCH_CONTEXT,
      field,
    );
  }
  assert.equal(matchTrustedLeaseSnapshot(ok.snapshot, completeMatch()).allowed, true);
});

test('foreign owner and stale fencing DENY via match', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  reader.put(activeRow());
  const clock = createInjectedClock(1_700_000_000_000);
  const ok = reader.read({ leaseId: 'lease-1' }, clock);
  assert.equal(ok.allowed, true);

  assert.equal(
    matchTrustedLeaseSnapshot(ok.snapshot, completeMatch({
      ownerPrincipalId: 'other-worker',
      ownerActorId: 'other-worker',
    })).decision,
    LEASE_SNAPSHOT_DECISIONS.DENY_FOREIGN_OWNER,
  );
  assert.equal(
    matchTrustedLeaseSnapshot(ok.snapshot, completeMatch({ fencingEpoch: 99 })).decision,
    LEASE_SNAPSHOT_DECISIONS.DENY_STALE_FENCING_EPOCH,
  );
  assert.equal(
    matchTrustedLeaseSnapshot(ok.snapshot, completeMatch({ taskId: 'task-other' })).decision,
    LEASE_SNAPSHOT_DECISIONS.DENY_WRONG_TASK,
  );
  assert.equal(
    matchTrustedLeaseSnapshot(ok.snapshot, completeMatch({ resourceId: 'other' })).decision,
    LEASE_SNAPSHOT_DECISIONS.DENY_WRONG_RESOURCE,
  );
});

test('ownerActorId must equal ownerPrincipalId on put', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  assert.throws(
    () => reader.put(activeRow({ ownerActorId: 'different' })),
    /OWNER_ACTOR_MUST_EQUAL_PRINCIPAL/,
  );
});

test('malformed query DENY', () => {
  const reader = createInMemoryTrustedLeaseSnapshotReader();
  const clock = createInjectedClock();
  assert.equal(
    reader.read({}, clock).decision,
    LEASE_SNAPSHOT_DECISIONS.DENY_MALFORMED_QUERY,
  );
});

test('source remains offline / non-operational and claims no DB authority', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.match(source, /NON_OPERATIONAL/);
  assert.match(source, /TEST_ONLY/);
  assert.match(source, /realLeaseAuthority: false/);
  assert.equal(source.includes('pg.Client'), false);
  assert.equal(source.includes('DATABASE_URL'), false);
  assert.equal(source.includes('createConnection'), false);
});
