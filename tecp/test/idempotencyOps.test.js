import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  IDEMPOTENCY_COMPARISON_DECISIONS,
  IDEMPOTENCY_OPERATION_DECISIONS,
  canonicalizeOperation,
  compareIdempotency,
  validateOperation,
} from '../src/idempotencyOps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(__dirname, '../src/idempotencyOps.js');
const SOURCE_TEXT = readFileSync(SOURCE_PATH, 'utf8');

const EXPECTED_OPERATION_DECISIONS = Object.freeze([
  'VALID',
  'INVALID_OPERATION',
  'INVALID_IDEMPOTENCY_KEY',
  'INVALID_TASK_REFERENCE',
  'INVALID_ACTOR_REFERENCE',
  'INVALID_OPERATION_TYPE',
  'INVALID_GOVERNANCE_REVISION',
]);

const EXPECTED_COMPARISON_DECISIONS = Object.freeze([
  'SAME_OPERATION',
  'DIFFERENT_OPERATION',
  'IDEMPOTENCY_CONFLICT',
  'INVALID_INPUT',
]);

const EXPECTED_PUBLIC_EXPORTS = Object.freeze([
  'IDEMPOTENCY_COMPARISON_DECISIONS',
  'IDEMPOTENCY_OPERATION_DECISIONS',
  'canonicalizeOperation',
  'compareIdempotency',
  'validateOperation',
]);

const FORBIDDEN_SOURCE_TOKENS = Object.freeze([
  'operationId',
  'status',
  'retry',
  'attempt',
  'result',
  'response',
  'error',
  'payload',
  'metadata',
  'createdAt',
  'startedAt',
  'completedAt',
  'expiresAt',
  'retryAfter',
  'timestamp',
  'ttl',
  'expiration',
  'Date.now',
  'new Date',
  'Math.random',
  'randomUUID',
  'rule02Parser',
  'governanceValidator',
  'taskGraph',
  'actorCapabilityEngine',
  'resourceClaims',
  'conflictEngine',
  'leaseEngine',
  'scopeExpansion',
  'auditEvent',
  'evidence',
  'recovery',
  'backend/',
  'node:fs',
  'node:net',
  'node:http',
  'node:https',
  'node:child_process',
  'process.env',
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'pg',
  'sqlite',
  'redis',
  'github',
  'linear',
  'executeOperation',
  'retryOperation',
  'persistOperation',
  'storeOperation',
  'loadOperation',
  'replayOperation',
  'scheduleOperation',
  'recoverOperation',
  'claimOperation',
  'completeOperation',
  'failOperation',
]);

function validOperation(overrides = {}) {
  return {
    idempotencyKey: 'idem-001',
    taskId: 'task-001',
    actorId: 'actor-001',
    operationType: 'CLAIM_RESOURCE',
    governanceRevision: 'rev-001',
    ...overrides,
  };
}

function assertFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
}

describe('TECP-014 Idempotency Ops — decisions and exports', () => {
  it('49. exact validation decision vocabulary', () => {
    assert.deepEqual(
      Object.keys(IDEMPOTENCY_OPERATION_DECISIONS).sort(),
      [...EXPECTED_OPERATION_DECISIONS].sort(),
    );
    for (const key of EXPECTED_OPERATION_DECISIONS) {
      assert.equal(IDEMPOTENCY_OPERATION_DECISIONS[key], key);
    }
    assertFrozen(IDEMPOTENCY_OPERATION_DECISIONS);
  });

  it('50. exact comparison decision vocabulary', () => {
    assert.deepEqual(
      Object.keys(IDEMPOTENCY_COMPARISON_DECISIONS).sort(),
      [...EXPECTED_COMPARISON_DECISIONS].sort(),
    );
    for (const key of EXPECTED_COMPARISON_DECISIONS) {
      assert.equal(IDEMPOTENCY_COMPARISON_DECISIONS[key], key);
    }
    assertFrozen(IDEMPOTENCY_COMPARISON_DECISIONS);
  });

  it('51. exact public export surface', async () => {
    const mod = await import('../src/idempotencyOps.js');
    assert.deepEqual(Object.keys(mod).sort(), [...EXPECTED_PUBLIC_EXPORTS]);
  });
});

describe('TECP-014 Idempotency Ops — validateOperation', () => {
  it('1. valid operation', () => {
    const input = validOperation();
    const result = validateOperation(input);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'VALID');
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.operation, {
      idempotencyKey: 'idem-001',
      taskId: 'task-001',
      actorId: 'actor-001',
      operationType: 'CLAIM_RESOURCE',
      governanceRevision: 'rev-001',
    });
    assertFrozen(result);
    assertFrozen(result.reasons);
    assertFrozen(result.operation);
  });

  it('2. null => INVALID_OPERATION', () => {
    const result = validateOperation(null);
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_OPERATION');
    assert.deepEqual(result.reasons, ['INVALID_OPERATION']);
    assert.equal(result.operation, null);
  });

  it('3. array => INVALID_OPERATION', () => {
    const result = validateOperation([]);
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_OPERATION');
    assert.equal(result.operation, null);
  });

  it('4. primitive => INVALID_OPERATION', () => {
    const result = validateOperation('not-an-object');
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_OPERATION');
    assert.equal(result.operation, null);
  });

  it('5. missing field => INVALID_OPERATION', () => {
    const input = validOperation();
    delete input.actorId;
    const result = validateOperation(input);
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_OPERATION');
    assert.equal(result.operation, null);
  });

  it('6. extra field => INVALID_OPERATION', () => {
    const result = validateOperation({
      ...validOperation(),
      operationId: 'op-extra',
    });
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_OPERATION');
    assert.equal(result.operation, null);
  });

  it('7. empty idempotencyKey', () => {
    const result = validateOperation(validOperation({ idempotencyKey: '' }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_IDEMPOTENCY_KEY');
    assert.deepEqual(result.reasons, ['INVALID_IDEMPOTENCY_KEY']);
    assert.equal(result.operation, null);
  });

  it('8. non-string idempotencyKey', () => {
    const result = validateOperation(validOperation({ idempotencyKey: 42 }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_IDEMPOTENCY_KEY');
    assert.equal(result.operation, null);
  });

  it('9. empty taskId', () => {
    const result = validateOperation(validOperation({ taskId: '' }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_TASK_REFERENCE');
    assert.equal(result.operation, null);
  });

  it('10. non-string taskId', () => {
    const result = validateOperation(validOperation({ taskId: null }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_TASK_REFERENCE');
    assert.equal(result.operation, null);
  });

  it('11. empty actorId', () => {
    const result = validateOperation(validOperation({ actorId: '' }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_ACTOR_REFERENCE');
    assert.equal(result.operation, null);
  });

  it('12. non-string actorId', () => {
    const result = validateOperation(validOperation({ actorId: true }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_ACTOR_REFERENCE');
    assert.equal(result.operation, null);
  });

  it('13. empty operationType', () => {
    const result = validateOperation(validOperation({ operationType: '' }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_OPERATION_TYPE');
    assert.equal(result.operation, null);
  });

  it('14. non-string operationType', () => {
    const result = validateOperation(validOperation({ operationType: {} }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_OPERATION_TYPE');
    assert.equal(result.operation, null);
  });

  it('15. empty governanceRevision', () => {
    const result = validateOperation(validOperation({ governanceRevision: '' }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_GOVERNANCE_REVISION');
    assert.equal(result.operation, null);
  });

  it('16. non-string governanceRevision', () => {
    const result = validateOperation(validOperation({ governanceRevision: 7 }));
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_GOVERNANCE_REVISION');
    assert.equal(result.operation, null);
  });

  it('17. malformed precedence', () => {
    const result = validateOperation({
      idempotencyKey: '',
      taskId: '',
      actorId: '',
      operationType: '',
      governanceRevision: '',
      extra: true,
    });
    assert.equal(result.decision, 'INVALID_OPERATION');
  });

  it('18. key before task', () => {
    const result = validateOperation(validOperation({
      idempotencyKey: '',
      taskId: '',
    }));
    assert.equal(result.decision, 'INVALID_IDEMPOTENCY_KEY');
  });

  it('19. task before actor', () => {
    const result = validateOperation(validOperation({
      taskId: '',
      actorId: '',
    }));
    assert.equal(result.decision, 'INVALID_TASK_REFERENCE');
  });

  it('20. actor before operationType', () => {
    const result = validateOperation(validOperation({
      actorId: '',
      operationType: '',
    }));
    assert.equal(result.decision, 'INVALID_ACTOR_REFERENCE');
  });

  it('21. operationType before governanceRevision', () => {
    const result = validateOperation(validOperation({
      operationType: '',
      governanceRevision: '',
    }));
    assert.equal(result.decision, 'INVALID_OPERATION_TYPE');
  });
});

describe('TECP-014 Idempotency Ops — canonicalizeOperation', () => {
  it('22. exact field order', () => {
    const canonical = canonicalizeOperation(validOperation());
    assert.deepEqual(Object.keys(canonical), [
      'idempotencyKey',
      'taskId',
      'actorId',
      'operationType',
      'governanceRevision',
    ]);
  });

  it('23. extra input fields excluded by canonicalizer', () => {
    const input = {
      ...validOperation(),
      operationId: 'should-not-appear',
      status: 'PENDING',
    };
    const canonical = canonicalizeOperation(input);
    assert.equal(Object.prototype.hasOwnProperty.call(canonical, 'operationId'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(canonical, 'status'), false);
    assert.deepEqual(Object.keys(canonical), [
      'idempotencyKey',
      'taskId',
      'actorId',
      'operationType',
      'governanceRevision',
    ]);
  });

  it('24. exact strings preserved', () => {
    const input = validOperation({
      idempotencyKey: 'Idem-Key-Exact',
      taskId: 'Task-001',
      actorId: 'Actor-XYZ',
      operationType: 'Op.Type',
      governanceRevision: 'Rev/sha',
    });
    const canonical = canonicalizeOperation(input);
    assert.equal(canonical.idempotencyKey, 'Idem-Key-Exact');
    assert.equal(canonical.taskId, 'Task-001');
    assert.equal(canonical.actorId, 'Actor-XYZ');
    assert.equal(canonical.operationType, 'Op.Type');
    assert.equal(canonical.governanceRevision, 'Rev/sha');
  });

  it('25. whitespace preserved', () => {
    const input = validOperation({
      idempotencyKey: '  key  ',
      taskId: ' task ',
      actorId: ' actor ',
      operationType: ' type ',
      governanceRevision: ' rev ',
    });
    const canonical = canonicalizeOperation(input);
    assert.equal(canonical.idempotencyKey, '  key  ');
    assert.equal(canonical.taskId, ' task ');
    assert.equal(canonical.actorId, ' actor ');
    assert.equal(canonical.operationType, ' type ');
    assert.equal(canonical.governanceRevision, ' rev ');
  });

  it('26. case preserved', () => {
    const input = validOperation({
      idempotencyKey: 'KeY',
      taskId: 'TaSk',
      actorId: 'AcToR',
      operationType: 'OpTyPe',
      governanceRevision: 'ReV',
    });
    const canonical = canonicalizeOperation(input);
    assert.equal(canonical.idempotencyKey, 'KeY');
    assert.equal(canonical.taskId, 'TaSk');
    assert.equal(canonical.actorId, 'AcToR');
    assert.equal(canonical.operationType, 'OpTyPe');
    assert.equal(canonical.governanceRevision, 'ReV');
  });

  it('27. no normalization', () => {
    const input = validOperation({
      idempotencyKey: 'a/b\\c',
      taskId: 't\n1',
      actorId: 'a\t2',
      operationType: 'OP::TYPE',
      governanceRevision: 'sha ABC',
    });
    const canonical = canonicalizeOperation(input);
    assert.equal(canonical.idempotencyKey, 'a/b\\c');
    assert.equal(canonical.taskId, 't\n1');
    assert.equal(canonical.actorId, 'a\t2');
    assert.equal(canonical.operationType, 'OP::TYPE');
    assert.equal(canonical.governanceRevision, 'sha ABC');
  });

  it('28. frozen canonical result', () => {
    const canonical = canonicalizeOperation(validOperation());
    assertFrozen(canonical);
  });

  it('29. input not mutated', () => {
    const input = validOperation();
    const snapshot = structuredClone(input);
    canonicalizeOperation(input);
    assert.deepEqual(input, snapshot);
  });

  it('30. same input => deep-equal output', () => {
    const input = validOperation();
    const a = canonicalizeOperation(input);
    const b = canonicalizeOperation(input);
    assert.deepEqual(a, b);
    assert.notEqual(a, b);
  });
});

describe('TECP-014 Idempotency Ops — compareIdempotency', () => {
  it('31. same task + same key + identical bindings => SAME_OPERATION', () => {
    const left = validOperation();
    const right = validOperation();
    const result = compareIdempotency(left, right);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'SAME_OPERATION');
    assert.deepEqual(result.reasons, ['IDENTITY_MATCH']);
    assert.deepEqual(result.leftOperation, canonicalizeOperation(left));
    assert.deepEqual(result.rightOperation, canonicalizeOperation(right));
  });

  it('32. different task + same key => DIFFERENT_OPERATION', () => {
    const left = validOperation({ taskId: 'task-a' });
    const right = validOperation({ taskId: 'task-b' });
    const result = compareIdempotency(left, right);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'DIFFERENT_OPERATION');
    assert.deepEqual(result.reasons, ['TASK_SCOPE_DIFFERS']);
  });

  it('33. same task + different key => DIFFERENT_OPERATION', () => {
    const left = validOperation({ idempotencyKey: 'k1' });
    const right = validOperation({ idempotencyKey: 'k2' });
    const result = compareIdempotency(left, right);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'DIFFERENT_OPERATION');
    assert.deepEqual(result.reasons, ['IDEMPOTENCY_KEY_DIFFERS']);
  });

  it('34. same task/key but different actor => IDEMPOTENCY_CONFLICT', () => {
    const left = validOperation({ actorId: 'actor-a' });
    const right = validOperation({ actorId: 'actor-b' });
    const result = compareIdempotency(left, right);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'IDEMPOTENCY_CONFLICT');
    assert.deepEqual(result.reasons, ['BINDING_MISMATCH']);
  });

  it('35. same task/key but different operationType => IDEMPOTENCY_CONFLICT', () => {
    const left = validOperation({ operationType: 'TYPE_A' });
    const right = validOperation({ operationType: 'TYPE_B' });
    const result = compareIdempotency(left, right);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'IDEMPOTENCY_CONFLICT');
    assert.deepEqual(result.reasons, ['BINDING_MISMATCH']);
  });

  it('36. same task/key but different governanceRevision => IDEMPOTENCY_CONFLICT', () => {
    const left = validOperation({ governanceRevision: 'rev-a' });
    const right = validOperation({ governanceRevision: 'rev-b' });
    const result = compareIdempotency(left, right);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'IDEMPOTENCY_CONFLICT');
    assert.deepEqual(result.reasons, ['BINDING_MISMATCH']);
  });

  it('37. multiple binding differences => IDEMPOTENCY_CONFLICT', () => {
    const left = validOperation({
      actorId: 'a1',
      operationType: 'T1',
      governanceRevision: 'r1',
    });
    const right = validOperation({
      actorId: 'a2',
      operationType: 'T2',
      governanceRevision: 'r2',
    });
    const result = compareIdempotency(left, right);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'IDEMPOTENCY_CONFLICT');
    assert.deepEqual(result.reasons, ['BINDING_MISMATCH']);
  });

  it('38. invalid left => INVALID_INPUT', () => {
    const result = compareIdempotency(null, validOperation());
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_INPUT');
    assert.deepEqual(result.reasons, ['LEFT_INVALID']);
    assert.equal(result.leftOperation, null);
    assert.equal(result.rightOperation, null);
  });

  it('39. invalid right => INVALID_INPUT', () => {
    const result = compareIdempotency(validOperation(), []);
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_INPUT');
    assert.deepEqual(result.reasons, ['RIGHT_INVALID']);
    assert.equal(result.leftOperation, null);
    assert.equal(result.rightOperation, null);
  });

  it('40. both invalid => INVALID_INPUT', () => {
    const result = compareIdempotency(null, '');
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_INPUT');
    assert.deepEqual(result.reasons, ['LEFT_INVALID', 'RIGHT_INVALID']);
    assert.equal(result.leftOperation, null);
    assert.equal(result.rightOperation, null);
  });

  it('41. canonical left/right returned for valid compare', () => {
    const left = validOperation({ taskId: 't-a' });
    const right = validOperation({ taskId: 't-b' });
    const result = compareIdempotency(left, right);
    assert.deepEqual(result.leftOperation, canonicalizeOperation(left));
    assert.deepEqual(result.rightOperation, canonicalizeOperation(right));
  });

  it('42. invalid operand represented as null', () => {
    const result = compareIdempotency(validOperation({ idempotencyKey: '' }), validOperation());
    assert.equal(result.leftOperation, null);
    assert.equal(result.rightOperation, null);
  });

  it('43. deterministic compare reasons', () => {
    const left = validOperation();
    const right = validOperation();
    const a = compareIdempotency(left, right);
    const b = compareIdempotency(left, right);
    assert.deepEqual(a.reasons, b.reasons);
    assert.deepEqual(a.reasons, ['IDENTITY_MATCH']);
  });

  it('44. comparison result frozen', () => {
    const result = compareIdempotency(validOperation(), validOperation());
    assertFrozen(result);
  });

  it('45. reasons frozen', () => {
    const result = compareIdempotency(validOperation(), validOperation());
    assertFrozen(result.reasons);
  });

  it('46. operation copies frozen', () => {
    const result = compareIdempotency(validOperation(), validOperation());
    assertFrozen(result.leftOperation);
    assertFrozen(result.rightOperation);
  });

  it('47. same pair => deep-equal output', () => {
    const left = validOperation();
    const right = validOperation({ taskId: 'other-task' });
    const a = compareIdempotency(left, right);
    const b = compareIdempotency(left, right);
    assert.deepEqual(a, b);
  });

  it('48. comparison does not mutate inputs', () => {
    const left = validOperation({ actorId: 'a1' });
    const right = validOperation({ actorId: 'a2' });
    const leftSnap = structuredClone(left);
    const rightSnap = structuredClone(right);
    compareIdempotency(left, right);
    assert.deepEqual(left, leftSnap);
    assert.deepEqual(right, rightSnap);
  });
});

describe('TECP-014 Idempotency Ops — boundary exclusions', () => {
  it('52. no operationId', () => {
    assert.equal(SOURCE_TEXT.includes('operationId'), false);
  });

  it('53. no status fields', () => {
    assert.equal(SOURCE_TEXT.includes('status'), false);
  });

  it('54. no retry fields/APIs', () => {
    assert.equal(SOURCE_TEXT.includes('retry'), false);
  });

  it('55. no attempt count', () => {
    assert.equal(SOURCE_TEXT.includes('attempt'), false);
  });

  it('56. no result/error/payload', () => {
    assert.equal(SOURCE_TEXT.includes('result'), false);
    assert.equal(SOURCE_TEXT.includes('response'), false);
    assert.equal(SOURCE_TEXT.includes('error'), false);
    assert.equal(SOURCE_TEXT.includes('payload'), false);
    assert.equal(SOURCE_TEXT.includes('metadata'), false);
  });

  it('57. no time/TTL', () => {
    assert.equal(SOURCE_TEXT.includes('createdAt'), false);
    assert.equal(SOURCE_TEXT.includes('startedAt'), false);
    assert.equal(SOURCE_TEXT.includes('completedAt'), false);
    assert.equal(SOURCE_TEXT.includes('expiresAt'), false);
    assert.equal(SOURCE_TEXT.includes('retryAfter'), false);
    assert.equal(SOURCE_TEXT.includes('timestamp'), false);
    assert.equal(SOURCE_TEXT.includes('ttl'), false);
    assert.equal(SOURCE_TEXT.includes('expiration'), false);
    assert.equal(SOURCE_TEXT.includes('Date.now'), false);
    assert.equal(SOURCE_TEXT.includes('new Date'), false);
  });

  it('58. no persistence', () => {
    assert.equal(SOURCE_TEXT.includes('persistOperation'), false);
    assert.equal(SOURCE_TEXT.includes('storeOperation'), false);
    assert.equal(SOURCE_TEXT.includes('loadOperation'), false);
  });

  it('59. no Redis', () => {
    assert.equal(SOURCE_TEXT.includes('redis'), false);
  });

  it('60. no inbox/outbox', () => {
    assert.equal(SOURCE_TEXT.toLowerCase().includes('inbox'), false);
    assert.equal(SOURCE_TEXT.toLowerCase().includes('outbox'), false);
  });

  it('61. no recovery APIs', () => {
    assert.equal(SOURCE_TEXT.includes('recovery'), false);
    assert.equal(SOURCE_TEXT.includes('recoverOperation'), false);
    assert.equal(SOURCE_TEXT.includes('replayOperation'), false);
  });

  it('62. no Lease import', () => {
    assert.equal(SOURCE_TEXT.includes('leaseEngine'), false);
  });

  it('63. no Conflict import', () => {
    assert.equal(SOURCE_TEXT.includes('conflictEngine'), false);
  });

  it('64. no Audit Event import', () => {
    assert.equal(SOURCE_TEXT.includes('auditEvent'), false);
  });

  it('65. no Evidence Ledger import', () => {
    assert.equal(SOURCE_TEXT.includes('evidence'), false);
  });

  it('66. no Task Graph import', () => {
    assert.equal(SOURCE_TEXT.includes('taskGraph'), false);
  });

  it('67. no Actor Capability import', () => {
    assert.equal(SOURCE_TEXT.includes('actorCapabilityEngine'), false);
  });

  it('68. no DB/SQL', () => {
    assert.equal(SOURCE_TEXT.includes('SELECT'), false);
    assert.equal(SOURCE_TEXT.includes('INSERT'), false);
    assert.equal(SOURCE_TEXT.includes('UPDATE'), false);
    assert.equal(SOURCE_TEXT.includes('DELETE'), false);
    assert.equal(SOURCE_TEXT.includes('pg'), false);
    assert.equal(SOURCE_TEXT.includes('sqlite'), false);
  });

  it('69. no filesystem', () => {
    assert.equal(SOURCE_TEXT.includes('node:fs'), false);
  });

  it('70. no network', () => {
    assert.equal(SOURCE_TEXT.includes('node:net'), false);
    assert.equal(SOURCE_TEXT.includes('node:http'), false);
    assert.equal(SOURCE_TEXT.includes('node:https'), false);
  });

  it('71. no process.env', () => {
    assert.equal(SOURCE_TEXT.includes('process.env'), false);
  });

  it('72. no child process', () => {
    assert.equal(SOURCE_TEXT.includes('node:child_process'), false);
  });

  it('73. no clock', () => {
    assert.equal(SOURCE_TEXT.includes('Date.now'), false);
    assert.equal(SOURCE_TEXT.includes('new Date'), false);
  });

  it('74. no random/UUID', () => {
    assert.equal(SOURCE_TEXT.includes('Math.random'), false);
    assert.equal(SOURCE_TEXT.includes('randomUUID'), false);
  });

  it('75. no GitHub/Linear', () => {
    assert.equal(SOURCE_TEXT.includes('github'), false);
    assert.equal(SOURCE_TEXT.includes('linear'), false);
  });

  it('76. only authorized source/test files changed — forbidden tokens absent', () => {
    for (const token of FORBIDDEN_SOURCE_TOKENS) {
      assert.equal(
        SOURCE_TEXT.includes(token),
        false,
        `forbidden token present in source: ${token}`,
      );
    }
  });
});
