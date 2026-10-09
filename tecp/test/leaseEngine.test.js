import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LEASE_DECISIONS,
  LEASE_STATUSES,
  canonicalizeLease,
  grantLease,
  releaseLease,
  validateLease,
} from '../src/leaseEngine.js';
import * as leaseEngine from '../src/leaseEngine.js';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '../src/leaseEngine.js');

function grantRequest(overrides = {}) {
  return {
    leaseKey: 'lease-opaque',
    taskId: 'task-opaque',
    actorId: 'actor-opaque',
    leaseType: 'worktree',
    governanceRevision: 'rev-opaque',
    branchName: 'feat/example',
    worktreePath: '/tmp/example',
    ...overrides,
  };
}

function activeLease(overrides = {}) {
  return {
    leaseKey: 'lease-opaque',
    taskId: 'task-opaque',
    actorId: 'actor-opaque',
    leaseType: 'worktree',
    status: 'ACTIVE',
    governanceRevision: 'rev-opaque',
    branchName: 'feat/example',
    worktreePath: '/tmp/example',
    version: 1,
    ...overrides,
  };
}

function snapshot(value) {
  return structuredClone(value);
}

test('valid ACTIVE lease', () => {
  const input = activeLease();
  const before = snapshot(input);
  const result = validateLease(input);
  assert.equal(result.valid, true);
  assert.equal(result.decision, 'VALID');
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.lease, input);
  assert.notEqual(result.lease, input);
  assert.deepEqual(input, before);
});

test('valid RELEASED lease', () => {
  const input = activeLease({ status: 'RELEASED', version: 2 });
  const result = validateLease(input);
  assert.equal(result.valid, true);
  assert.equal(result.decision, 'VALID');
  assert.equal(result.lease.status, 'RELEASED');
  assert.equal(result.lease.version, 2);
});

test('null is INVALID_LEASE', () => {
  const result = validateLease(null);
  assert.equal(result.valid, false);
  assert.equal(result.decision, 'INVALID_LEASE');
  assert.deepEqual(result.reasons, ['INVALID_LEASE']);
  assert.equal(result.lease, null);
});

test('array is INVALID_LEASE', () => {
  const result = validateLease([]);
  assert.equal(result.decision, 'INVALID_LEASE');
  assert.equal(result.lease, null);
});

test('missing field is INVALID_LEASE', () => {
  const input = activeLease();
  delete input.version;
  const result = validateLease(input);
  assert.equal(result.decision, 'INVALID_LEASE');
});

test('extra field is INVALID_LEASE', () => {
  const result = validateLease({ ...activeLease(), id: 'nope' });
  assert.equal(result.decision, 'INVALID_LEASE');
});

test('empty leaseKey is INVALID_LEASE_KEY', () => {
  assert.equal(validateLease(activeLease({ leaseKey: '' })).decision, 'INVALID_LEASE_KEY');
});

test('non-string leaseKey is INVALID_LEASE_KEY', () => {
  assert.equal(validateLease(activeLease({ leaseKey: 1 })).decision, 'INVALID_LEASE_KEY');
});

test('empty taskId is INVALID_TASK_REFERENCE', () => {
  assert.equal(validateLease(activeLease({ taskId: '' })).decision, 'INVALID_TASK_REFERENCE');
});

test('non-string taskId is INVALID_TASK_REFERENCE', () => {
  assert.equal(validateLease(activeLease({ taskId: 1 })).decision, 'INVALID_TASK_REFERENCE');
});

test('empty actorId is INVALID_ACTOR_REFERENCE', () => {
  assert.equal(validateLease(activeLease({ actorId: '' })).decision, 'INVALID_ACTOR_REFERENCE');
});

test('non-string actorId is INVALID_ACTOR_REFERENCE', () => {
  assert.equal(validateLease(activeLease({ actorId: 1 })).decision, 'INVALID_ACTOR_REFERENCE');
});

test('empty leaseType is INVALID_LEASE_TYPE', () => {
  assert.equal(validateLease(activeLease({ leaseType: '' })).decision, 'INVALID_LEASE_TYPE');
});

test('non-string leaseType is INVALID_LEASE_TYPE', () => {
  assert.equal(validateLease(activeLease({ leaseType: 1 })).decision, 'INVALID_LEASE_TYPE');
});

test('invalid status is INVALID_LEASE_STATUS', () => {
  assert.equal(validateLease(activeLease({ status: 'PAUSED' })).decision, 'INVALID_LEASE_STATUS');
});

test('empty governanceRevision is INVALID_GOVERNANCE_REVISION', () => {
  assert.equal(
    validateLease(activeLease({ governanceRevision: '' })).decision,
    'INVALID_GOVERNANCE_REVISION',
  );
});

test('non-string governanceRevision is INVALID_GOVERNANCE_REVISION', () => {
  assert.equal(
    validateLease(activeLease({ governanceRevision: 9 })).decision,
    'INVALID_GOVERNANCE_REVISION',
  );
});

test('invalid branchName type is INVALID_BRANCH_NAME', () => {
  assert.equal(validateLease(activeLease({ branchName: 1 })).decision, 'INVALID_BRANCH_NAME');
});

test('invalid worktreePath type is INVALID_WORKTREE_PATH', () => {
  assert.equal(validateLease(activeLease({ worktreePath: 1 })).decision, 'INVALID_WORKTREE_PATH');
});

test('version 0 is INVALID_VERSION', () => {
  assert.equal(validateLease(activeLease({ version: 0 })).decision, 'INVALID_VERSION');
});

test('negative version is INVALID_VERSION', () => {
  assert.equal(validateLease(activeLease({ version: -1 })).decision, 'INVALID_VERSION');
});

test('non-integer version is INVALID_VERSION', () => {
  assert.equal(validateLease(activeLease({ version: 1.5 })).decision, 'INVALID_VERSION');
});

test('unsafe integer version is INVALID_VERSION', () => {
  assert.equal(
    validateLease(activeLease({ version: Number.MAX_SAFE_INTEGER + 1 })).decision,
    'INVALID_VERSION',
  );
});

test('valid grant creates ACTIVE version 1', () => {
  const request = grantRequest();
  const before = snapshot(request);
  const result = grantLease(request);
  assert.equal(result.valid, true);
  assert.equal(result.decision, 'VALID');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.lease.status, 'ACTIVE');
  assert.equal(result.lease.version, 1);
  assert.equal(result.lease.leaseKey, request.leaseKey);
  assert.deepEqual(request, before);
});

test('branchName null accepted', () => {
  const result = grantLease(grantRequest({ branchName: null }));
  assert.equal(result.valid, true);
  assert.equal(result.lease.branchName, null);
});

test('worktreePath null accepted', () => {
  const result = grantLease(grantRequest({ worktreePath: null }));
  assert.equal(result.valid, true);
  assert.equal(result.lease.worktreePath, null);
});

test('empty optional metadata strings are valid opaque strings', () => {
  const result = grantLease(grantRequest({ branchName: '', worktreePath: '' }));
  assert.equal(result.valid, true);
  assert.equal(result.lease.branchName, '');
  assert.equal(result.lease.worktreePath, '');
  const validated = validateLease(result.lease);
  assert.equal(validated.valid, true);
});

test('malformed grant request is INVALID_LEASE', () => {
  assert.equal(grantLease(null).decision, 'INVALID_LEASE');
  assert.equal(grantLease([]).decision, 'INVALID_LEASE');
  const missing = grantRequest();
  delete missing.leaseKey;
  assert.equal(grantLease(missing).decision, 'INVALID_LEASE');
});

test('extra grant field is INVALID_LEASE', () => {
  assert.equal(grantLease({ ...grantRequest(), status: 'ACTIVE' }).decision, 'INVALID_LEASE');
  assert.equal(grantLease({ ...grantRequest(), version: 1 }).decision, 'INVALID_LEASE');
});

test('grant invalid leaseKey', () => {
  assert.equal(grantLease(grantRequest({ leaseKey: '' })).decision, 'INVALID_LEASE_KEY');
  assert.equal(grantLease(grantRequest({ leaseKey: 1 })).decision, 'INVALID_LEASE_KEY');
});

test('grant invalid taskId', () => {
  assert.equal(grantLease(grantRequest({ taskId: '' })).decision, 'INVALID_TASK_REFERENCE');
  assert.equal(grantLease(grantRequest({ taskId: 1 })).decision, 'INVALID_TASK_REFERENCE');
});

test('grant invalid actorId', () => {
  assert.equal(grantLease(grantRequest({ actorId: '' })).decision, 'INVALID_ACTOR_REFERENCE');
  assert.equal(grantLease(grantRequest({ actorId: 1 })).decision, 'INVALID_ACTOR_REFERENCE');
});

test('grant invalid leaseType', () => {
  assert.equal(grantLease(grantRequest({ leaseType: '' })).decision, 'INVALID_LEASE_TYPE');
  assert.equal(grantLease(grantRequest({ leaseType: 1 })).decision, 'INVALID_LEASE_TYPE');
});

test('grant invalid governanceRevision', () => {
  assert.equal(
    grantLease(grantRequest({ governanceRevision: '' })).decision,
    'INVALID_GOVERNANCE_REVISION',
  );
  assert.equal(
    grantLease(grantRequest({ governanceRevision: 1 })).decision,
    'INVALID_GOVERNANCE_REVISION',
  );
});

test('grant invalid branchName', () => {
  assert.equal(grantLease(grantRequest({ branchName: 1 })).decision, 'INVALID_BRANCH_NAME');
});

test('grant invalid worktreePath', () => {
  assert.equal(grantLease(grantRequest({ worktreePath: 1 })).decision, 'INVALID_WORKTREE_PATH');
});

test('same grant request is deep-equal and deterministic', () => {
  const request = grantRequest();
  assert.deepEqual(grantLease(request), grantLease(snapshot(request)));
});

test('ACTIVE v1 releases to RELEASED v2', () => {
  const input = activeLease({ version: 1 });
  const before = snapshot(input);
  const result = releaseLease(input);
  assert.equal(result.valid, true);
  assert.equal(result.changed, true);
  assert.equal(result.lease.status, 'RELEASED');
  assert.equal(result.lease.version, 2);
  assert.equal(result.lease.leaseKey, input.leaseKey);
  assert.equal(result.lease.taskId, input.taskId);
  assert.equal(result.lease.actorId, input.actorId);
  assert.equal(result.lease.leaseType, input.leaseType);
  assert.equal(result.lease.governanceRevision, input.governanceRevision);
  assert.equal(result.lease.branchName, input.branchName);
  assert.equal(result.lease.worktreePath, input.worktreePath);
  assert.deepEqual(input, before);
});

test('ACTIVE v7 releases to RELEASED v8', () => {
  const result = releaseLease(activeLease({ version: 7 }));
  assert.equal(result.lease.status, 'RELEASED');
  assert.equal(result.lease.version, 8);
  assert.equal(result.changed, true);
});

test('RELEASED v2 stays RELEASED v2', () => {
  const input = activeLease({ status: 'RELEASED', version: 2, branchName: null, worktreePath: '' });
  const result = releaseLease(input);
  assert.equal(result.valid, true);
  assert.equal(result.changed, false);
  assert.equal(result.lease.status, 'RELEASED');
  assert.equal(result.lease.version, 2);
  assert.equal(result.lease.branchName, null);
  assert.equal(result.lease.worktreePath, '');
});

test('repeated release is deep-equal and idempotent', () => {
  const once = releaseLease(activeLease());
  const twice = releaseLease(once.lease);
  const thrice = releaseLease(twice.lease);
  assert.equal(twice.changed, false);
  assert.deepEqual(twice, thrice);
  assert.deepEqual(twice.lease, thrice.lease);
});

test('release invalid lease fails closed', () => {
  const result = releaseLease(activeLease({ status: 'PAUSED' }));
  assert.equal(result.valid, false);
  assert.equal(result.decision, 'INVALID_LEASE_STATUS');
  assert.deepEqual(result.reasons, ['INVALID_LEASE_STATUS']);
  assert.equal(result.lease, null);
  assert.equal(result.changed, false);
  assert.equal(releaseLease(null).decision, 'INVALID_LEASE');
});

test('release result is immutable', () => {
  const result = releaseLease(activeLease());
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.lease), true);
  assert.equal(Object.isFrozen(result.reasons), true);
  assert.throws(() => {
    result.lease.status = 'ACTIVE';
  });
});

test('validation result is immutable and input stays unchanged', () => {
  const input = activeLease();
  const result = validateLease(input);
  input.leaseKey = 'mutated';
  assert.equal(result.lease.leaseKey, 'lease-opaque');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.lease), true);
});

test('exact statuses are ACTIVE and RELEASED', () => {
  assert.deepEqual([...LEASE_STATUSES], ['ACTIVE', 'RELEASED']);
  assert.equal(Object.isFrozen(LEASE_STATUSES), true);
});

test('exact decision vocabulary', () => {
  assert.deepEqual(Object.values(LEASE_DECISIONS), [
    'VALID',
    'INVALID_LEASE',
    'INVALID_LEASE_KEY',
    'INVALID_TASK_REFERENCE',
    'INVALID_ACTOR_REFERENCE',
    'INVALID_LEASE_TYPE',
    'INVALID_LEASE_STATUS',
    'INVALID_GOVERNANCE_REVISION',
    'INVALID_BRANCH_NAME',
    'INVALID_WORKTREE_PATH',
    'INVALID_VERSION',
  ]);
  assert.equal(Object.isFrozen(LEASE_DECISIONS), true);
});

test('canonicalizeLease is a lossless ordered copy', () => {
  const input = activeLease();
  const copy = canonicalizeLease(input);
  assert.deepEqual(copy, input);
  assert.notEqual(copy, input);
  assert.deepEqual(Object.keys(copy), [
    'leaseKey',
    'taskId',
    'actorId',
    'leaseType',
    'status',
    'governanceRevision',
    'branchName',
    'worktreePath',
    'version',
  ]);
  input.version = 9;
  assert.equal(copy.version, 1);
});

test('whitespace and case remain exact opaque strings', () => {
  const result = grantLease(grantRequest({
    leaseKey: ' Lease ',
    taskId: 'Task',
    actorId: 'Actor',
    leaseType: 'Type',
    governanceRevision: 'Rev',
  }));
  assert.equal(result.lease.leaseKey, ' Lease ');
  assert.equal(validateLease(result.lease).valid, true);
  const other = grantLease(grantRequest({ leaseKey: ' lease ' }));
  assert.notEqual(result.lease.leaseKey, other.lease.leaseKey);
});

test('source boundary excludes clocks, lifecycle, imports, and persistence', () => {
  const source = readFileSync(sourcePath, 'utf8');
  const forbidden = [
    'Date.now',
    'new Date',
    'setTimeout',
    'setInterval',
    'expires',
    'ttl',
    'renewLease',
    'revokeLease',
    'EXPIRED',
    'REVOKED',
    'heartbeat',
    'conflictEngine',
    'taskGraph',
    'actorCapabilityEngine',
    'governanceValidator',
    'backend/',
    'node:fs',
    'node:net',
    'node:http',
    'node:https',
    'node:child_process',
    'process.env',
    'Math.random',
    'crypto.randomUUID',
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'sqlite',
    'repository',
    'DAO',
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, token);
  }
  assert.equal(/\bpg\b/.test(source), false);
  assert.equal(/^import /m.test(source), false);
  assert.equal(source.includes('SAFE_PARALLEL'), false);
  assert.equal(source.includes('SERIALIZE'), false);
  assert.equal(source.includes('BLOCKED'), false);
});

test('public export surface is exactly the lease boundary', () => {
  assert.deepEqual(Object.keys(leaseEngine).sort(), [
    'LEASE_DECISIONS',
    'LEASE_STATUSES',
    'canonicalizeLease',
    'grantLease',
    'releaseLease',
    'validateLease',
  ]);
  const forbidden = [
    'renewLease',
    'revokeLease',
    'heartbeatLease',
    'expireLease',
    'persistLease',
    'saveLease',
    'loadLease',
    'scheduleLease',
    'lockLease',
    'acquireRuntimeLock',
  ];
  for (const name of forbidden) {
    assert.equal(Object.hasOwn(leaseEngine, name), false, name);
  }
});
