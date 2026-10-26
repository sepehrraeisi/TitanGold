import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  RECOVERY_DECISIONS,
  canonicalizeRecoveryCase,
  evaluateRecovery,
  validateRecoveryCase,
} from '../src/recovery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(__dirname, '../src/recovery.js');
const SOURCE_TEXT = readFileSync(SOURCE_PATH, 'utf8');

const EXPECTED_DECISIONS = Object.freeze([
  'RECOVERY_PROPOSABLE',
  'OWNER_REVIEW_REQUIRED',
  'INVALID_RECOVERY_CASE',
]);

const EXPECTED_PUBLIC_EXPORTS = Object.freeze([
  'RECOVERY_DECISIONS',
  'canonicalizeRecoveryCase',
  'evaluateRecovery',
  'validateRecoveryCase',
]);

const CASE_KEYS = Object.freeze([
  'recoveryCaseId',
  'taskId',
  'actorId',
  'governanceRevision',
  'failureType',
  'requiresTaskMutation',
  'requiresLeaseMutation',
  'requiresRuntimeObservation',
  'requiresExternalSideEffect',
  'requiresScopeExpansion',
  'requiresConflictOverride',
]);

const STRING_KEYS = Object.freeze([
  'recoveryCaseId',
  'taskId',
  'actorId',
  'governanceRevision',
  'failureType',
]);

const BOOLEAN_KEYS = Object.freeze([
  'requiresTaskMutation',
  'requiresLeaseMutation',
  'requiresRuntimeObservation',
  'requiresExternalSideEffect',
  'requiresScopeExpansion',
  'requiresConflictOverride',
]);

const FLAG_REASON_ORDER = Object.freeze([
  Object.freeze({ key: 'requiresTaskMutation', reason: 'TASK_MUTATION_REQUIRED' }),
  Object.freeze({ key: 'requiresLeaseMutation', reason: 'LEASE_MUTATION_REQUIRED' }),
  Object.freeze({ key: 'requiresRuntimeObservation', reason: 'RUNTIME_OBSERVATION_REQUIRED' }),
  Object.freeze({ key: 'requiresExternalSideEffect', reason: 'EXTERNAL_SIDE_EFFECT_REQUIRED' }),
  Object.freeze({ key: 'requiresScopeExpansion', reason: 'SCOPE_EXPANSION_REQUIRED' }),
  Object.freeze({ key: 'requiresConflictOverride', reason: 'CONFLICT_OVERRIDE_REQUIRED' }),
]);

const FORBIDDEN_SOURCE_TOKENS = Object.freeze([
  'rule02Parser',
  'governanceValidator',
  'taskGraph',
  'actorCapabilityEngine',
  'resourceClaims',
  'conflictEngine',
  'leaseEngine',
  'scopeExpansion',
  'auditEvent',
  'idempotencyOps',
  'evidenceLedger',
  'backend/',
  'node:fs',
  'node:net',
  'node:http',
  'node:https',
  'node:child_process',
  'process.env',
  'Date.now',
  'new Date',
  'Math.random',
  'randomUUID',
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'pg',
  'sqlite',
  'redis',
  'github',
  'linear',
  'executeRecovery',
  'retryRecovery',
  'resumeRecovery',
  'requeueRecovery',
  'replayRecovery',
  'mutateTask',
  'mutateLease',
  'takeOverLease',
  'observeRuntime',
  'queryProvider',
  'persistRecovery',
  'storeCheckpoint',
  'recoverOperation',
  'createdAt',
  'startedAt',
  'completedAt',
  'expiresAt',
  'retryAfter',
  'timestamp',
  'ttl',
  'expiration',
  'heartbeat',
]);

function proposableCase(overrides = {}) {
  return {
    recoveryCaseId: 'rc-001',
    taskId: 'task-001',
    actorId: 'actor-001',
    governanceRevision: 'rev-001',
    failureType: 'WORKER_CRASH',
    requiresTaskMutation: false,
    requiresLeaseMutation: false,
    requiresRuntimeObservation: false,
    requiresExternalSideEffect: false,
    requiresScopeExpansion: false,
    requiresConflictOverride: false,
    ...overrides,
  };
}

function assertFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
}

function assertInvalid(result) {
  assert.equal(result.valid, false);
  assert.equal(result.decision, 'INVALID_RECOVERY_CASE');
  assert.deepEqual(result.reasons, ['INVALID_RECOVERY_CASE']);
  assert.equal(result.recoveryCase, null);
  assertFrozen(result);
  assertFrozen(result.reasons);
}

function assertProposable(result, input) {
  assert.equal(result.valid, true);
  assert.equal(result.decision, 'RECOVERY_PROPOSABLE');
  assert.deepEqual(result.reasons, []);
  assert.notEqual(result.recoveryCase, null);
  assert.notEqual(result.recoveryCase, input);
  assert.deepEqual(Object.keys(result.recoveryCase), [...CASE_KEYS]);
  assert.equal(result.recoveryCase.recoveryCaseId, input.recoveryCaseId);
  assert.equal(result.recoveryCase.taskId, input.taskId);
  assert.equal(result.recoveryCase.actorId, input.actorId);
  assert.equal(result.recoveryCase.governanceRevision, input.governanceRevision);
  assert.equal(result.recoveryCase.failureType, input.failureType);
  for (const key of BOOLEAN_KEYS) {
    assert.equal(result.recoveryCase[key], false);
  }
  assertFrozen(result);
  assertFrozen(result.reasons);
  assertFrozen(result.recoveryCase);
}

function assertOwnerReview(result, input, expectedReasons) {
  assert.equal(result.valid, true);
  assert.equal(result.decision, 'OWNER_REVIEW_REQUIRED');
  assert.deepEqual(result.reasons, expectedReasons);
  assert.notEqual(result.recoveryCase, null);
  assert.notEqual(result.recoveryCase, input);
  assert.deepEqual(Object.keys(result.recoveryCase), [...CASE_KEYS]);
  assertFrozen(result);
  assertFrozen(result.reasons);
  assertFrozen(result.recoveryCase);
}

describe('TECP-015 Recovery — decisions and exports', () => {
  it('1. exact decision vocabulary', () => {
    assert.deepEqual(Object.keys(RECOVERY_DECISIONS).sort(), [...EXPECTED_DECISIONS].sort());
    for (const key of EXPECTED_DECISIONS) {
      assert.equal(RECOVERY_DECISIONS[key], key);
    }
    assertFrozen(RECOVERY_DECISIONS);
  });

  it('2. exact public export surface', async () => {
    const mod = await import('../src/recovery.js');
    assert.deepEqual(Object.keys(mod).sort(), [...EXPECTED_PUBLIC_EXPORTS]);
  });
});

describe('TECP-015 Recovery — valid proposable case', () => {
  it('3. validateRecoveryCase proposable', () => {
    const input = proposableCase();
    assertProposable(validateRecoveryCase(input), input);
  });

  it('4. evaluateRecovery proposable', () => {
    const input = proposableCase();
    assertProposable(evaluateRecovery(input), input);
  });

  it('5. validate and evaluate agree on proposable', () => {
    const input = proposableCase();
    assert.deepEqual(validateRecoveryCase(input), evaluateRecovery(input));
  });
});

describe('TECP-015 Recovery — invalid string fields', () => {
  for (const key of STRING_KEYS) {
    it(`6. empty ${key} is invalid`, () => {
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: '' })));
      assertInvalid(evaluateRecovery(proposableCase({ [key]: '' })));
    });

    it(`7. non-string ${key} is invalid`, () => {
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: 1 })));
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: null })));
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: undefined })));
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: ['x'] })));
    });
  }
});

describe('TECP-015 Recovery — invalid boolean fields', () => {
  for (const key of BOOLEAN_KEYS) {
    it(`8. non-boolean ${key} is invalid`, () => {
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: 'false' })));
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: 0 })));
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: 1 })));
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: null })));
      assertInvalid(validateRecoveryCase(proposableCase({ [key]: undefined })));
    });
  }
});

describe('TECP-015 Recovery — malformed objects / missing / extra keys', () => {
  it('9. null / array / non-object', () => {
    assertInvalid(validateRecoveryCase(null));
    assertInvalid(validateRecoveryCase(undefined));
    assertInvalid(validateRecoveryCase([]));
    assertInvalid(validateRecoveryCase('rc'));
    assertInvalid(validateRecoveryCase(42));
  });

  it('10. missing key', () => {
    const input = proposableCase();
    delete input.failureType;
    assertInvalid(validateRecoveryCase(input));
  });

  it('11. extra key', () => {
    const input = proposableCase({ extra: 'nope' });
    // extra key changes Object.keys order / length relative to CASE_KEYS
    assertInvalid(validateRecoveryCase(input));
  });

  it('12. wrong key order is invalid', () => {
    const input = {
      taskId: 'task-001',
      recoveryCaseId: 'rc-001',
      actorId: 'actor-001',
      governanceRevision: 'rev-001',
      failureType: 'WORKER_CRASH',
      requiresTaskMutation: false,
      requiresLeaseMutation: false,
      requiresRuntimeObservation: false,
      requiresExternalSideEffect: false,
      requiresScopeExpansion: false,
      requiresConflictOverride: false,
    };
    assertInvalid(validateRecoveryCase(input));
  });
});

describe('TECP-015 Recovery — OWNER_REVIEW_REQUIRED per protected flag', () => {
  for (const entry of FLAG_REASON_ORDER) {
    it(`13. only ${entry.key}=true => OWNER_REVIEW with ${entry.reason}`, () => {
      const input = proposableCase({ [entry.key]: true });
      const validated = validateRecoveryCase(input);
      const evaluated = evaluateRecovery(input);
      assertOwnerReview(validated, input, [entry.reason]);
      assertOwnerReview(evaluated, input, [entry.reason]);
      assert.deepEqual(validated, evaluated);
    });
  }
});

describe('TECP-015 Recovery — multiple flags ordered reasons', () => {
  it('14. first and last flags true => ordered reasons', () => {
    const input = proposableCase({
      requiresTaskMutation: true,
      requiresConflictOverride: true,
    });
    assertOwnerReview(evaluateRecovery(input), input, [
      'TASK_MUTATION_REQUIRED',
      'CONFLICT_OVERRIDE_REQUIRED',
    ]);
  });

  it('15. all six flags true => full ordered reasons', () => {
    const input = proposableCase({
      requiresTaskMutation: true,
      requiresLeaseMutation: true,
      requiresRuntimeObservation: true,
      requiresExternalSideEffect: true,
      requiresScopeExpansion: true,
      requiresConflictOverride: true,
    });
    assertOwnerReview(
      evaluateRecovery(input),
      input,
      FLAG_REASON_ORDER.map((entry) => entry.reason),
    );
  });

  it('16. middle flags only preserve relative order', () => {
    const input = proposableCase({
      requiresLeaseMutation: true,
      requiresScopeExpansion: true,
      requiresRuntimeObservation: true,
    });
    assertOwnerReview(evaluateRecovery(input), input, [
      'LEASE_MUTATION_REQUIRED',
      'RUNTIME_OBSERVATION_REQUIRED',
      'SCOPE_EXPANSION_REQUIRED',
    ]);
  });
});

describe('TECP-015 Recovery — canonicalize', () => {
  it('17. canonical field order and exact preservation', () => {
    const input = proposableCase({
      recoveryCaseId: 'Rc-CaseSensitive',
      taskId: ' Task-With-Spaces ',
      actorId: 'actor-Χ',
      governanceRevision: 'rev/with/slash',
      failureType: 'TYPE_A',
      requiresTaskMutation: true,
    });
    const canonical = canonicalizeRecoveryCase(input);
    assert.deepEqual(Object.keys(canonical), [...CASE_KEYS]);
    assert.equal(canonical.recoveryCaseId, 'Rc-CaseSensitive');
    assert.equal(canonical.taskId, ' Task-With-Spaces ');
    assert.equal(canonical.actorId, 'actor-Χ');
    assert.equal(canonical.governanceRevision, 'rev/with/slash');
    assert.equal(canonical.failureType, 'TYPE_A');
    assert.equal(canonical.requiresTaskMutation, true);
    assert.notEqual(canonical, input);
    assertFrozen(canonical);
  });

  it('18. no string normalization (whitespace / case preserved)', () => {
    const input = proposableCase({
      recoveryCaseId: '  id  ',
      failureType: 'AbC',
    });
    const result = evaluateRecovery(input);
    assert.equal(result.recoveryCase.recoveryCaseId, '  id  ');
    assert.equal(result.recoveryCase.failureType, 'AbC');
  });
});

describe('TECP-015 Recovery — immutability, determinism, input safety', () => {
  it('19. results and nested values are frozen', () => {
    const proposable = evaluateRecovery(proposableCase());
    assertFrozen(proposable);
    assertFrozen(proposable.reasons);
    assertFrozen(proposable.recoveryCase);

    const review = evaluateRecovery(proposableCase({ requiresLeaseMutation: true }));
    assertFrozen(review);
    assertFrozen(review.reasons);
    assertFrozen(review.recoveryCase);

    const invalid = evaluateRecovery(null);
    assertFrozen(invalid);
    assertFrozen(invalid.reasons);
  });

  it('20. determinism — same input same output', () => {
    const input = proposableCase({ requiresRuntimeObservation: true });
    const a = evaluateRecovery(input);
    const b = evaluateRecovery(input);
    assert.deepEqual(a, b);
    assert.deepEqual(validateRecoveryCase(input), a);
  });

  it('21. input is not mutated', () => {
    const input = proposableCase({ requiresTaskMutation: true });
    const before = JSON.stringify(input);
    evaluateRecovery(input);
    validateRecoveryCase(input);
    canonicalizeRecoveryCase(input);
    assert.equal(JSON.stringify(input), before);
  });

  it('22. returned recoveryCase is a copy', () => {
    const input = proposableCase();
    const result = evaluateRecovery(input);
    assert.notEqual(result.recoveryCase, input);
    input.recoveryCaseId = 'mutated';
    assert.equal(result.recoveryCase.recoveryCaseId, 'rc-001');
  });
});

describe('TECP-015 Recovery — source boundary', () => {
  it('23. forbidden imports and side-effect tokens absent from source', () => {
    for (const token of FORBIDDEN_SOURCE_TOKENS) {
      assert.equal(
        SOURCE_TEXT.includes(token),
        false,
        `forbidden token present in recovery.js: ${token}`,
      );
    }
  });

  it('24. no import statements in recovery source', () => {
    assert.match(SOURCE_TEXT, /^\/\*\*/);
    assert.equal(/\bimport\s+/.test(SOURCE_TEXT), false);
    assert.equal(/\brequire\s*\(/.test(SOURCE_TEXT), false);
  });
});
