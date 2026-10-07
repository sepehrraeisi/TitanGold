/**
 * TECP-010 conflict engine tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CONFLICT_REASONS,
  CONFLICT_VERDICTS,
  evaluateClaimConflict,
  evaluateConflictSet,
} from '../src/conflictEngine.js';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '../src/conflictEngine.js');

function claim(taskId, resourceType, resourceKey, accessMode) {
  return { taskId, resourceType, resourceKey, accessMode };
}

function fileClaim(taskId, resourceKey, accessMode) {
  return claim(taskId, 'FILE', resourceKey, accessMode);
}

test('1. same task => SAFE_PARALLEL / SAME_TASK', () => {
  const result = evaluateClaimConflict(
    fileClaim('task-a', 'dir/file', 'WRITE'),
    fileClaim('task-a', 'other', 'READ'),
  );
  assert.equal(result.valid, true);
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.equal(result.reason, CONFLICT_REASONS.SAME_TASK);
});

test('2. different resourceType same key => SAFE_PARALLEL', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'FILE', 'same', 'WRITE'),
    claim('task-b', 'COMPONENT', 'same', 'WRITE'),
  );
  assert.equal(result.valid, true);
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.equal(result.reason, CONFLICT_REASONS.DIFFERENT_RESOURCE);
});

test('3. same type different key => SAFE_PARALLEL', () => {
  const result = evaluateClaimConflict(
    fileClaim('task-a', 'alpha', 'WRITE'),
    fileClaim('task-b', 'beta', 'WRITE'),
  );
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.equal(result.reason, CONFLICT_REASONS.DIFFERENT_RESOURCE);
});

test('4. FILE READ/READ => SAFE_PARALLEL', () => {
  const result = evaluateClaimConflict(
    fileClaim('task-a', 'dir/file', 'READ'),
    fileClaim('task-b', 'dir/file', 'READ'),
  );
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.equal(result.reason, CONFLICT_REASONS.READ_READ);
});

test('5. FILE READ/WRITE => SERIALIZE', () => {
  const result = evaluateClaimConflict(
    fileClaim('task-a', 'dir/file', 'READ'),
    fileClaim('task-b', 'dir/file', 'WRITE'),
  );
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(result.reason, CONFLICT_REASONS.READ_WRITE);
});

test('6. FILE WRITE/READ => SERIALIZE', () => {
  const result = evaluateClaimConflict(
    fileClaim('task-a', 'dir/file', 'WRITE'),
    fileClaim('task-b', 'dir/file', 'READ'),
  );
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(result.reason, CONFLICT_REASONS.WRITE_READ);
});

test('7. FILE WRITE/WRITE => SERIALIZE', () => {
  const result = evaluateClaimConflict(
    fileClaim('task-a', 'dir/file', 'WRITE'),
    fileClaim('task-b', 'dir/file', 'WRITE'),
  );
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(result.reason, CONFLICT_REASONS.WRITE_WRITE_SERIALIZE);
});

test('8. COMPONENT READ/READ => SAFE_PARALLEL', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'COMPONENT', 'panel', 'READ'),
    claim('task-b', 'COMPONENT', 'panel', 'READ'),
  );
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.equal(result.reason, CONFLICT_REASONS.READ_READ);
});

test('9. COMPONENT WRITE/WRITE => SERIALIZE', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'COMPONENT', 'panel', 'WRITE'),
    claim('task-b', 'COMPONENT', 'panel', 'WRITE'),
  );
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(result.reason, CONFLICT_REASONS.WRITE_WRITE_SERIALIZE);
});

test('10. RUNTIME READ/READ => SAFE_PARALLEL', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'RUNTIME', 'slot', 'READ'),
    claim('task-b', 'RUNTIME', 'slot', 'READ'),
  );
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
});

test('11. RUNTIME WRITE/WRITE => SERIALIZE', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'RUNTIME', 'slot', 'WRITE'),
    claim('task-b', 'RUNTIME', 'slot', 'WRITE'),
  );
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(result.reason, CONFLICT_REASONS.WRITE_WRITE_SERIALIZE);
});

test('12. SOURCE_OF_TRUTH READ/READ => SAFE_PARALLEL', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'SOURCE_OF_TRUTH', 'owner', 'READ'),
    claim('task-b', 'SOURCE_OF_TRUTH', 'owner', 'READ'),
  );
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
});

test('13. SOURCE_OF_TRUTH READ/WRITE => SERIALIZE', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'SOURCE_OF_TRUTH', 'owner', 'READ'),
    claim('task-b', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
  );
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(result.reason, CONFLICT_REASONS.READ_WRITE);
});

test('14. SOURCE_OF_TRUTH WRITE/WRITE => BLOCKED', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
    claim('task-b', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
  );
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.BLOCKED);
  assert.equal(result.reason, CONFLICT_REASONS.WRITE_WRITE_BLOCKED_SOURCE_OF_TRUTH);
});

test('15. AUTHORITY READ/READ => SAFE_PARALLEL', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'AUTHORITY', 'slice', 'READ'),
    claim('task-b', 'AUTHORITY', 'slice', 'READ'),
  );
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
});

test('16. AUTHORITY READ/WRITE => SERIALIZE', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'AUTHORITY', 'slice', 'READ'),
    claim('task-b', 'AUTHORITY', 'slice', 'WRITE'),
  );
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SERIALIZE);
});

test('17. AUTHORITY WRITE/WRITE => BLOCKED', () => {
  const result = evaluateClaimConflict(
    claim('task-a', 'AUTHORITY', 'slice', 'WRITE'),
    claim('task-b', 'AUTHORITY', 'slice', 'WRITE'),
  );
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.BLOCKED);
  assert.equal(result.reason, CONFLICT_REASONS.WRITE_WRITE_BLOCKED_AUTHORITY);
});

test('18. case-different key => SAFE_PARALLEL', () => {
  const result = evaluateClaimConflict(
    fileClaim('task-a', 'Path/A', 'WRITE'),
    fileClaim('task-b', 'path/a', 'WRITE'),
  );
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.equal(result.reason, CONFLICT_REASONS.DIFFERENT_RESOURCE);
});

test('19. slash-different FILE key => SAFE_PARALLEL', () => {
  const result = evaluateClaimConflict(
    fileClaim('task-a', 'dir/file', 'WRITE'),
    fileClaim('task-b', 'dir/file/', 'WRITE'),
  );
  assert.equal(result.conflict, false);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.equal(result.reason, CONFLICT_REASONS.DIFFERENT_RESOURCE);
});

test('20. invalid left claim => INVALID_INPUT', () => {
  const right = fileClaim('task-b', 'dir/file', 'READ');
  const result = evaluateClaimConflict(null, right);
  assert.equal(result.valid, false);
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.INVALID_INPUT);
  assert.equal(result.reason, CONFLICT_REASONS.INVALID_LEFT_CLAIM);
  assert.equal(result.leftClaim, null);
  assert.deepEqual(result.rightClaim, right);
  assert.notEqual(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
});

test('21. invalid right claim => INVALID_INPUT', () => {
  const left = fileClaim('task-a', 'dir/file', 'READ');
  const result = evaluateClaimConflict(left, { taskId: '', resourceType: 'FILE', resourceKey: 'dir/file', accessMode: 'READ' });
  assert.equal(result.valid, false);
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.INVALID_INPUT);
  assert.equal(result.reason, CONFLICT_REASONS.INVALID_RIGHT_CLAIM);
  assert.deepEqual(result.leftClaim, left);
  assert.equal(result.rightClaim, null);
});

test('22. both invalid => INVALID_INPUT', () => {
  const result = evaluateClaimConflict(null, 'not-a-claim');
  assert.equal(result.valid, false);
  assert.equal(result.conflict, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.INVALID_INPUT);
  assert.equal(result.reason, CONFLICT_REASONS.INVALID_BOTH_CLAIMS);
  assert.equal(result.leftClaim, null);
  assert.equal(result.rightClaim, null);
});

test('23. pair result immutable', () => {
  const left = fileClaim('task-a', 'dir/file', 'READ');
  const right = fileClaim('task-b', 'dir/file', 'WRITE');
  const result = evaluateClaimConflict(left, right);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.leftClaim), true);
  assert.equal(Object.isFrozen(result.rightClaim), true);
  assert.notEqual(result.leftClaim, left);
  assert.notEqual(result.rightClaim, right);
  assert.throws(() => { result.verdict = 'SAFE_PARALLEL'; });
  assert.throws(() => { result.leftClaim.taskId = 'mutated'; });
});

test('24. pair evaluation symmetric in verdict/conflict', () => {
  const pairs = [
    [fileClaim('task-a', 'dir/file', 'READ'), fileClaim('task-b', 'dir/file', 'READ')],
    [fileClaim('task-a', 'dir/file', 'READ'), fileClaim('task-b', 'dir/file', 'WRITE')],
    [fileClaim('task-a', 'dir/file', 'WRITE'), fileClaim('task-b', 'dir/file', 'READ')],
    [fileClaim('task-a', 'dir/file', 'WRITE'), fileClaim('task-b', 'dir/file', 'WRITE')],
    [claim('task-a', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'), claim('task-b', 'SOURCE_OF_TRUTH', 'owner', 'WRITE')],
    [claim('task-a', 'AUTHORITY', 'slice', 'WRITE'), claim('task-b', 'AUTHORITY', 'slice', 'WRITE')],
    [claim('task-a', 'FILE', 'same', 'WRITE'), claim('task-b', 'COMPONENT', 'same', 'WRITE')],
  ];
  for (const [left, right] of pairs) {
    const forward = evaluateClaimConflict(left, right);
    const reverse = evaluateClaimConflict(right, left);
    assert.equal(forward.valid, reverse.valid);
    assert.equal(forward.conflict, reverse.conflict);
    assert.equal(forward.verdict, reverse.verdict);
  }
  const mixed = evaluateClaimConflict(
    fileClaim('task-a', 'dir/file', 'READ'),
    fileClaim('task-b', 'dir/file', 'WRITE'),
  );
  const flipped = evaluateClaimConflict(
    fileClaim('task-b', 'dir/file', 'WRITE'),
    fileClaim('task-a', 'dir/file', 'READ'),
  );
  assert.equal(mixed.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(flipped.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(mixed.reason, CONFLICT_REASONS.READ_WRITE);
  assert.equal(flipped.reason, CONFLICT_REASONS.WRITE_READ);
});

test('25. empty set => SAFE_PARALLEL', () => {
  const result = evaluateConflictSet([]);
  assert.equal(result.valid, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.claimCount, 0);
  assert.equal(result.pairCount, 0);
});

test('26. single claim => SAFE_PARALLEL', () => {
  const result = evaluateConflictSet([fileClaim('task-a', 'dir/file', 'WRITE')]);
  assert.equal(result.valid, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.claimCount, 1);
  assert.equal(result.pairCount, 0);
});

test('27. all different resources => SAFE_PARALLEL', () => {
  const result = evaluateConflictSet([
    fileClaim('task-a', 'one', 'WRITE'),
    fileClaim('task-b', 'two', 'WRITE'),
    claim('task-c', 'COMPONENT', 'one', 'WRITE'),
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.pairCount, 3);
});

test('28. one SERIALIZE pair => SERIALIZE', () => {
  const result = evaluateConflictSet([
    fileClaim('task-a', 'dir/file', 'READ'),
    fileClaim('task-b', 'dir/file', 'WRITE'),
    fileClaim('task-c', 'other', 'WRITE'),
  ]);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(result.conflicts[0].reason, CONFLICT_REASONS.READ_WRITE);
  assert.deepEqual(result.reasons, [CONFLICT_REASONS.READ_WRITE]);
});

test('29. multiple SERIALIZE pairs => SERIALIZE', () => {
  const result = evaluateConflictSet([
    fileClaim('task-a', 'one', 'WRITE'),
    fileClaim('task-b', 'one', 'WRITE'),
    fileClaim('task-c', 'two', 'WRITE'),
    fileClaim('task-d', 'two', 'READ'),
  ]);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SERIALIZE);
  assert.equal(result.conflicts.length, 2);
  assert.equal(result.conflicts.every((item) => item.verdict === CONFLICT_VERDICTS.SERIALIZE), true);
});

test('30. one BLOCKED pair + SERIALIZE pair => BLOCKED', () => {
  const result = evaluateConflictSet([
    claim('task-a', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
    claim('task-b', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
    fileClaim('task-c', 'dir/file', 'WRITE'),
    fileClaim('task-d', 'dir/file', 'WRITE'),
  ]);
  assert.equal(result.verdict, CONFLICT_VERDICTS.BLOCKED);
  assert.equal(result.conflicts.some((item) => item.verdict === CONFLICT_VERDICTS.BLOCKED), true);
  assert.equal(result.conflicts.some((item) => item.verdict === CONFLICT_VERDICTS.SERIALIZE), true);
});

test('31. multiple BLOCKED pairs => BLOCKED', () => {
  const result = evaluateConflictSet([
    claim('task-a', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
    claim('task-b', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
    claim('task-c', 'AUTHORITY', 'slice', 'WRITE'),
    claim('task-d', 'AUTHORITY', 'slice', 'WRITE'),
  ]);
  assert.equal(result.verdict, CONFLICT_VERDICTS.BLOCKED);
  assert.equal(result.conflicts.length, 2);
  assert.equal(result.conflicts.every((item) => item.verdict === CONFLICT_VERDICTS.BLOCKED), true);
});

test('32. same-task duplicate-like claims do not create conflict', () => {
  const result = evaluateConflictSet([
    fileClaim('task-a', 'dir/file', 'READ'),
    fileClaim('task-a', 'dir/file', 'WRITE'),
    claim('task-a', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
    claim('task-a', 'AUTHORITY', 'slice', 'WRITE'),
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
  assert.deepEqual(result.conflicts, []);
});

test('33. only actual conflicts appear in conflicts[]', () => {
  const result = evaluateConflictSet([
    fileClaim('task-a', 'shared', 'READ'),
    fileClaim('task-b', 'shared', 'READ'),
    fileClaim('task-c', 'shared', 'WRITE'),
    fileClaim('task-d', 'other', 'WRITE'),
  ]);
  assert.equal(result.conflicts.length, 2);
  for (const item of result.conflicts) {
    assert.equal(item.resourceKey, 'shared');
    assert.equal(item.verdict, CONFLICT_VERDICTS.SERIALIZE);
    assert.notEqual(item.reason, CONFLICT_REASONS.READ_READ);
    assert.equal(Object.hasOwn(item, 'leftTaskId'), true);
    assert.equal(Object.hasOwn(item, 'rightTaskId'), true);
    assert.equal(Object.hasOwn(item, 'resourceType'), true);
    assert.equal(Object.hasOwn(item, 'winner'), false);
    assert.equal(Object.hasOwn(item, 'order'), false);
  }
});

test('34. invalid claim anywhere => INVALID_INPUT', () => {
  const samples = [
    [null],
    [fileClaim('task-a', 'dir/file', 'READ'), null],
    [fileClaim('task-a', 'dir/file', 'READ'), { taskId: 'task-b' }, fileClaim('task-c', 'dir/file', 'WRITE')],
    'not-an-array',
    null,
    { taskId: 'task-a' },
  ];
  for (const sample of samples) {
    const result = evaluateConflictSet(sample);
    assert.equal(result.valid, false);
    assert.equal(result.verdict, CONFLICT_VERDICTS.INVALID_INPUT);
    assert.notEqual(result.verdict, CONFLICT_VERDICTS.SAFE_PARALLEL);
    assert.deepEqual(result.conflicts, []);
    assert.equal(result.pairCount, 0);
  }
  assert.deepEqual(evaluateConflictSet(null).reasons, [CONFLICT_REASONS.INVALID_CLAIMS_INPUT]);
  assert.deepEqual(
    evaluateConflictSet([fileClaim('task-a', 'dir/file', 'READ'), null]).reasons,
    [CONFLICT_REASONS.INVALID_CLAIM],
  );
});

test('35. input-order-independent verdict', () => {
  const first = [
    fileClaim('task-b', 'dir/file', 'WRITE'),
    claim('task-d', 'AUTHORITY', 'slice', 'WRITE'),
    fileClaim('task-a', 'dir/file', 'READ'),
    claim('task-c', 'AUTHORITY', 'slice', 'WRITE'),
  ];
  const second = [first[3], first[0], first[2], first[1]];
  assert.equal(evaluateConflictSet(first).verdict, CONFLICT_VERDICTS.BLOCKED);
  assert.equal(evaluateConflictSet(first).verdict, evaluateConflictSet(second).verdict);
});

test('36. input-order-independent conflict evidence', () => {
  const first = [
    fileClaim('task-b', 'zeta', 'WRITE'),
    fileClaim('task-a', 'alpha', 'WRITE'),
    fileClaim('task-c', 'alpha', 'READ'),
    fileClaim('task-d', 'zeta', 'WRITE'),
  ];
  const second = [first[2], first[3], first[0], first[1]];
  assert.deepEqual(evaluateConflictSet(first).conflicts, evaluateConflictSet(second).conflicts);
  const evidence = evaluateConflictSet(first).conflicts;
  assert.deepEqual(evidence.map((item) => item.leftTaskId), ['task-a', 'task-b']);
  assert.deepEqual(evidence.map((item) => item.rightTaskId), ['task-c', 'task-d']);
});

test('37. deterministic reasons', () => {
  const claims = [
    claim('task-b', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
    claim('task-a', 'SOURCE_OF_TRUTH', 'owner', 'WRITE'),
    fileClaim('task-d', 'dir/file', 'READ'),
    fileClaim('task-c', 'dir/file', 'WRITE'),
  ];
  const once = evaluateConflictSet(claims);
  const twice = evaluateConflictSet([...claims].reverse());
  assert.deepEqual(once.reasons, twice.reasons);
  assert.deepEqual(once.reasons, once.conflicts.map((item) => item.reason));
  assert.deepEqual(once.reasons, [
    CONFLICT_REASONS.WRITE_WRITE_BLOCKED_SOURCE_OF_TRUTH,
    CONFLICT_REASONS.WRITE_READ,
  ]);
});

test('38. no duplicate A/B and B/A pair evidence', () => {
  const result = evaluateConflictSet([
    fileClaim('task-b', 'dir/file', 'WRITE'),
    fileClaim('task-a', 'dir/file', 'READ'),
  ]);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].leftTaskId, 'task-a');
  assert.equal(result.conflicts[0].rightTaskId, 'task-b');
  const keys = result.conflicts.map((item) => `${item.leftTaskId}|${item.rightTaskId}|${item.resourceKey}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('39. set result immutable', () => {
  const result = evaluateConflictSet([
    fileClaim('task-a', 'dir/file', 'READ'),
    fileClaim('task-b', 'dir/file', 'WRITE'),
  ]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.conflicts), true);
  assert.equal(Object.isFrozen(result.conflicts[0]), true);
  assert.equal(Object.isFrozen(result.reasons), true);
  assert.equal(Object.isFrozen(CONFLICT_VERDICTS), true);
  assert.equal(Object.isFrozen(CONFLICT_REASONS), true);
  assert.throws(() => { result.conflicts.push({}); });
  assert.throws(() => { result.reasons.push('EXTRA'); });
  assert.throws(() => { result.conflicts[0].verdict = 'SAFE_PARALLEL'; });
  assert.throws(() => { CONFLICT_VERDICTS.SAFE_PARALLEL = 'OTHER'; });
});

test('40. input array not mutated', () => {
  const inputs = [
    fileClaim('task-b', 'dir/file', 'WRITE'),
    fileClaim('task-a', 'dir/file', 'READ'),
  ];
  const snapshot = inputs.map((item) => ({ ...item }));
  evaluateConflictSet(inputs);
  assert.deepEqual(inputs, snapshot);
  assert.equal(inputs[0].taskId, 'task-b');
});

test('41. input claims not mutated', () => {
  const left = fileClaim('task-a', 'dir/file', 'WRITE');
  const right = fileClaim('task-b', 'dir/file', 'READ');
  const beforeLeft = { ...left };
  const beforeRight = { ...right };
  evaluateClaimConflict(left, right);
  evaluateConflictSet([left, right]);
  assert.deepEqual(left, beforeLeft);
  assert.deepEqual(right, beforeRight);
});

test('42-48. source boundary', () => {
  const source = readFileSync(sourcePath, 'utf8');
  const importLines = source.split('\n').filter((line) => line.startsWith('import ') || line.includes('require('));
  assert.deepEqual(importLines, [
    'import {',
  ]);
  assert.equal(source.includes("from './resourceClaims.js';"), true);
  assert.equal(source.includes('from \'./taskGraph.js\''), false);
  assert.equal(source.includes('from \'./governanceValidator.js\''), false);
  assert.equal(source.includes('from \'./actorCapabilityEngine.js\''), false);
  assert.equal(source.includes('from \'./rule02Parser.js\''), false);

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
    'SELECT ',
    'INSERT ',
    'UPDATE ',
    'DELETE ',
    'from \'pg\'',
    'from "pg"',
    'postgres',
    'node:sqlite',
    'lease',
    'scheduler',
    'worker',
    'winner',
    'path.normalize',
    'ancestor',
    'descendant',
    'hierarchy',
    'TECP-011',
    'tecp-011',
    'TECP011',
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, token);
  }

  const exported = source.split('export ');
  assert.equal(exported.length, 5);
  assert.equal(source.includes('export function evaluateClaimConflict'), true);
  assert.equal(source.includes('export function evaluateConflictSet'), true);
  assert.equal(source.includes('export const CONFLICT_VERDICTS'), true);
  assert.equal(source.includes('export const CONFLICT_REASONS'), true);
});
