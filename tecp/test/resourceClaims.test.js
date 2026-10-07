/**
 * TECP-009 resource claims tests.
 *
 * Persistent schema owner remains migration 056 (`public.tecp_task_resource_claims`).
 * Conceptual mapping only:
 * taskId ↔ task_id, resourceType ↔ resource_type, resourceKey ↔ resource_key,
 * accessMode ↔ access_mode. Duplicate tuples are in-memory only. This module
 * does not read or write a database and does not create a UNIQUE constraint.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLAIM_ACCESS_MODES,
  RESOURCE_CLAIM_DECISIONS,
  RESOURCE_TYPES,
  buildResourceClaims,
  validateResourceClaim,
} from '../src/resourceClaims.js';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '../src/resourceClaims.js');

function claim(taskId, resourceType, resourceKey, accessMode) {
  return { taskId, resourceType, resourceKey, accessMode };
}

function fileRead(taskId = 'task-1', resourceKey = 'path/a') {
  return claim(taskId, 'FILE', resourceKey, 'READ');
}

test('valid FILE READ claim', () => {
  const result = validateResourceClaim(fileRead());
  assert.equal(result.valid, true);
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.VALID);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.claim, fileRead());
});

test('valid FILE WRITE claim', () => {
  const input = claim('task-1', 'FILE', 'path/a', 'WRITE');
  const result = validateResourceClaim(input);
  assert.equal(result.valid, true);
  assert.deepEqual(result.claim, input);
});

test('valid COMPONENT claim', () => {
  const result = validateResourceClaim(claim('task-1', 'COMPONENT', 'panel', 'READ'));
  assert.equal(result.valid, true);
  assert.equal(result.claim.resourceType, 'COMPONENT');
});

test('valid SOURCE_OF_TRUTH claim', () => {
  const result = validateResourceClaim(claim('task-1', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'));
  assert.equal(result.valid, true);
  assert.equal(result.claim.resourceType, 'SOURCE_OF_TRUTH');
});

test('valid AUTHORITY claim', () => {
  const result = validateResourceClaim(claim('task-1', 'AUTHORITY', 'slice', 'READ'));
  assert.equal(result.valid, true);
  assert.equal(result.claim.resourceType, 'AUTHORITY');
});

test('valid RUNTIME claim', () => {
  const result = validateResourceClaim(claim('task-1', 'RUNTIME', 'worker', 'WRITE'));
  assert.equal(result.valid, true);
  assert.equal(result.claim.resourceType, 'RUNTIME');
});

test('malformed null claim is INVALID_CLAIM', () => {
  const result = validateResourceClaim(null);
  assert.equal(result.valid, false);
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM);
  assert.equal(result.claim, null);
  assert.deepEqual(result.reasons, [RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM]);
});

test('malformed array claim is INVALID_CLAIM', () => {
  const result = validateResourceClaim([fileRead()]);
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM);
  assert.equal(result.claim, null);
});

test('missing required field is INVALID_CLAIM', () => {
  const result = validateResourceClaim({ taskId: 'task-1', resourceType: 'FILE', resourceKey: 'path/a' });
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM);
  assert.equal(result.claim, null);
});

test('extra field is INVALID_CLAIM', () => {
  const result = validateResourceClaim({ ...fileRead(), criticality: 'HIGH' });
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM);
  assert.equal(result.claim, null);
});

test('empty taskId is INVALID_TASK_REFERENCE', () => {
  const result = validateResourceClaim(claim('', 'FILE', 'path/a', 'READ'));
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_TASK_REFERENCE);
  assert.equal(result.claim, null);
});

test('non-string taskId is INVALID_TASK_REFERENCE', () => {
  const result = validateResourceClaim(claim(1, 'FILE', 'path/a', 'READ'));
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_TASK_REFERENCE);
});

test('unknown resourceType is INVALID_RESOURCE_TYPE', () => {
  const result = validateResourceClaim(claim('task-1', 'DATABASE', 'path/a', 'READ'));
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_RESOURCE_TYPE);
});

test('empty resourceKey is INVALID_RESOURCE_KEY', () => {
  const result = validateResourceClaim(claim('task-1', 'FILE', '', 'READ'));
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_RESOURCE_KEY);
});

test('non-string resourceKey is INVALID_RESOURCE_KEY', () => {
  const result = validateResourceClaim(claim('task-1', 'FILE', 9, 'READ'));
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_RESOURCE_KEY);
});

test('unknown accessMode is INVALID_CLAIM_MODE', () => {
  const result = validateResourceClaim(claim('task-1', 'FILE', 'path/a', 'APPEND'));
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM_MODE);
});

test('lowercase resourceType is rejected', () => {
  const result = validateResourceClaim(claim('task-1', 'file', 'path/a', 'READ'));
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_RESOURCE_TYPE);
});

test('lowercase accessMode is rejected', () => {
  const result = validateResourceClaim(claim('task-1', 'FILE', 'path/a', 'read'));
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM_MODE);
});

test('exact duplicate tuple is INVALID_DUPLICATE_CLAIM', () => {
  const result = buildResourceClaims([fileRead(), fileRead()]);
  assert.equal(result.valid, false);
  assert.equal(result.decision, RESOURCE_CLAIM_DECISIONS.INVALID_DUPLICATE_CLAIM);
  assert.equal(result.claims, null);
  assert.deepEqual(result.reasons, ['DUPLICATE_CLAIM:task-1|FILE|path/a|READ']);
});

test('same resource on a different taskId is valid', () => {
  const result = buildResourceClaims([fileRead('task-a'), fileRead('task-b')]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.claims.map((item) => item.taskId), ['task-a', 'task-b']);
});

test('READ and WRITE of the same tuple are both valid', () => {
  const result = buildResourceClaims([
    claim('task-1', 'FILE', 'path/a', 'WRITE'),
    claim('task-1', 'FILE', 'path/a', 'READ'),
  ]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.claims.map((item) => item.accessMode), ['READ', 'WRITE']);
});

test('same tuple except resourceType is valid', () => {
  const result = buildResourceClaims([
    claim('task-1', 'RUNTIME', 'shared', 'READ'),
    claim('task-1', 'FILE', 'shared', 'READ'),
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.claims.length, 2);
});

test('case-different resourceKey values are both valid', () => {
  const result = buildResourceClaims([
    claim('task-1', 'FILE', 'Foo', 'READ'),
    claim('task-1', 'FILE', 'foo', 'READ'),
  ]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.claims.map((item) => item.resourceKey), ['Foo', 'foo']);
});

test('slash-different resourceKey values are both valid', () => {
  const result = buildResourceClaims([
    claim('task-1', 'FILE', '/a/', 'READ'),
    claim('task-1', 'FILE', '/a', 'READ'),
  ]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.claims.map((item) => item.resourceKey), ['/a', '/a/']);
});

test('canonical claim sorting is deterministic', () => {
  const result = buildResourceClaims([
    claim('b', 'RUNTIME', 'z', 'WRITE'),
    claim('a', 'FILE', 'm', 'WRITE'),
    claim('a', 'AUTHORITY', 'm', 'READ'),
    claim('a', 'FILE', 'm', 'READ'),
  ]);
  assert.deepEqual(result.claims.map((item) => [item.taskId, item.resourceType, item.resourceKey, item.accessMode]), [
    ['a', 'AUTHORITY', 'm', 'READ'],
    ['a', 'FILE', 'm', 'READ'],
    ['a', 'FILE', 'm', 'WRITE'],
    ['b', 'RUNTIME', 'z', 'WRITE'],
  ]);
});

test('build output is independent of input order', () => {
  const forward = [
    claim('b', 'COMPONENT', 'k', 'WRITE'),
    claim('a', 'FILE', 'k', 'READ'),
  ];
  const reverse = [forward[1], forward[0]];
  assert.deepEqual(buildResourceClaims(forward), buildResourceClaims(reverse));
});

test('duplicate detection is independent of input order', () => {
  const first = fileRead('task-9', 'same');
  const second = fileRead('task-9', 'same');
  assert.deepEqual(
    buildResourceClaims([first, second]),
    buildResourceClaims([second, first]),
  );
});

test('invalid decision is independent of input order', () => {
  const extra = { ...fileRead(), criticality: 'HIGH' };
  const emptyTask = claim('', 'FILE', 'path/a', 'READ');
  const forward = buildResourceClaims([extra, emptyTask]);
  const reverse = buildResourceClaims([emptyTask, extra]);
  assert.equal(forward.decision, RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM);
  assert.deepEqual(forward, reverse);
  assert.equal(forward.claims, null);
});

test('claim input is not mutated', () => {
  const input = fileRead();
  const snapshot = { ...input };
  const result = validateResourceClaim(input);
  input.taskId = 'changed';
  assert.deepEqual(
    { taskId: snapshot.taskId, resourceType: snapshot.resourceType, resourceKey: snapshot.resourceKey, accessMode: snapshot.accessMode },
    { taskId: 'task-1', resourceType: 'FILE', resourceKey: 'path/a', accessMode: 'READ' },
  );
  assert.equal(result.claim.taskId, 'task-1');
  assert.notEqual(result.claim, input);
});

test('claims array is not mutated', () => {
  const inputs = [claim('b', 'FILE', 'k', 'READ'), claim('a', 'FILE', 'k', 'READ')];
  const snapshot = inputs.map((item) => ({ ...item }));
  buildResourceClaims(inputs);
  assert.deepEqual(inputs, snapshot);
  assert.equal(inputs[0].taskId, 'b');
});

test('result is frozen and copy-safe', () => {
  const validated = validateResourceClaim(fileRead());
  const built = buildResourceClaims([fileRead('z'), fileRead('a', 'other')]);
  assert.equal(Object.isFrozen(validated), true);
  assert.equal(Object.isFrozen(validated.claim), true);
  assert.equal(Object.isFrozen(validated.reasons), true);
  assert.equal(Object.isFrozen(built), true);
  assert.equal(Object.isFrozen(built.claims), true);
  assert.equal(Object.isFrozen(built.claims[0]), true);
  assert.throws(() => { validated.claim.taskId = 'x'; });
  assert.throws(() => { built.claims.push(fileRead()); });
});

test('exported vocabularies are frozen', () => {
  assert.equal(Object.isFrozen(RESOURCE_TYPES), true);
  assert.equal(Object.isFrozen(CLAIM_ACCESS_MODES), true);
  assert.equal(Object.isFrozen(RESOURCE_CLAIM_DECISIONS), true);
  assert.throws(() => { RESOURCE_TYPES.push('EXTRA'); });
  assert.throws(() => { CLAIM_ACCESS_MODES.push('EXTRA'); });
});

test('canonical resource type vocabulary is exact', () => {
  assert.deepEqual(RESOURCE_TYPES, ['FILE', 'COMPONENT', 'SOURCE_OF_TRUTH', 'AUTHORITY', 'RUNTIME']);
});

test('canonical access mode vocabulary is exact', () => {
  assert.deepEqual(CLAIM_ACCESS_MODES, ['READ', 'WRITE']);
});

test('persistence boundary stays conceptual and in-memory', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.match(source, /taskId ↔ task_id/);
  assert.match(source, /resourceType ↔ resource_type/);
  assert.match(source, /resourceKey ↔ resource_key/);
  assert.match(source, /accessMode ↔ access_mode/);
  const canonicalPersistenceReference = 'migration 056 (`public.tecp_task_resource_claims`)';
  assert.equal(source.includes(canonicalPersistenceReference), true);
  const withoutCanonicalTable = source.split('tecp_task_resource_claims').join('');
  assert.equal(withoutCanonicalTable.includes('tecp_resource_claims'), false);
  assert.equal(source.includes('UNIQUE'), true);
  for (const token of ['from \'pg\'', 'from "pg"', 'node:sqlite', 'repository', 'SELECT ', 'INSERT ']) {
    assert.equal(source.includes(token), false, token);
  }
});

test('source has no task graph, backend, or side-effect authority', () => {
  const source = readFileSync(sourcePath, 'utf8');
  const forbidden = [
    'taskGraph',
    'governanceValidator',
    'actorCapabilityEngine',
    'backend/',
    'node:fs',
    'node:net',
    'node:http',
    'node:https',
    'node:child_process',
    'process.env',
    'SAFE_PARALLEL',
    'SERIALIZE',
    'BLOCKED',
    'import ',
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, token);
  }
});
