import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  EVIDENCE_VALIDATION_DECISIONS,
  canonicalizeEvidence,
  validateEvidence,
} from '../src/evidenceLedger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(__dirname, '../src/evidenceLedger.js');
const SOURCE_TEXT = readFileSync(SOURCE_PATH, 'utf8');

const EXPECTED_DECISIONS = Object.freeze([
  'VALID',
  'INVALID_EVIDENCE',
  'INVALID_EVIDENCE_ID',
  'INVALID_TASK_REFERENCE',
  'INVALID_ACTOR_REFERENCE',
  'INVALID_GOVERNANCE_REVISION',
  'INVALID_EVIDENCE_TYPE',
  'INVALID_EVIDENCE_REF',
]);

const EXPECTED_PUBLIC_EXPORTS = Object.freeze([
  'EVIDENCE_VALIDATION_DECISIONS',
  'canonicalizeEvidence',
  'validateEvidence',
]);

const CANONICAL_KEY_ORDER = Object.freeze([
  'evidenceId',
  'taskId',
  'actorId',
  'governanceRevision',
  'evidenceType',
  'evidenceRef',
]);

const FORBIDDEN_SOURCE_TOKENS = Object.freeze([
  'payload',
  'metadata',
  'body',
  'content',
  'occurredAt',
  'timestamp',
  'createdAt',
  'updatedAt',
  'sequence',
  'Date.now',
  'new Date',
  'Math.random',
  'randomUUID',
  'TTL',
  'retention',
  'auditEvent',
  'idempotencyOps',
  'recovery',
  'rule02Parser',
  'governanceValidator',
  'taskGraph',
  'actorCapabilityEngine',
  'scopeExpansion',
  'leaseEngine',
  'conflictEngine',
  'resourceClaims',
  'github',
  'linear',
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
  'submitEvidence',
  'storeEvidence',
  'persistEvidence',
  'queryEvidence',
  'listEvidence',
  'getEvidence',
  'deleteEvidence',
  'supersedeEvidence',
  'appendEvidence',
]);

function validEvidence(overrides = {}) {
  return {
    evidenceId: 'ev-001',
    taskId: 'task-001',
    actorId: 'actor-001',
    governanceRevision: 'rev-001',
    evidenceType: 'TEST_TYPE',
    evidenceRef: 'ref-001',
    ...overrides,
  };
}

function assertFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
}

describe('TECP-016 Evidence Ledger — decisions and exports', () => {
  it('exact decision vocabulary', () => {
    assert.deepEqual(
      Object.keys(EVIDENCE_VALIDATION_DECISIONS).sort(),
      [...EXPECTED_DECISIONS].sort(),
    );
    for (const key of EXPECTED_DECISIONS) {
      assert.equal(EVIDENCE_VALIDATION_DECISIONS[key], key);
    }
    assertFrozen(EVIDENCE_VALIDATION_DECISIONS);
  });

  it('exact public export surface', async () => {
    const mod = await import('../src/evidenceLedger.js');
    assert.deepEqual(Object.keys(mod).sort(), [...EXPECTED_PUBLIC_EXPORTS]);
  });
});

describe('TECP-016 Evidence Ledger — validateEvidence', () => {
  it('valid evidence', () => {
    const input = validEvidence();
    const result = validateEvidence(input);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'VALID');
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.evidence, {
      evidenceId: 'ev-001',
      taskId: 'task-001',
      actorId: 'actor-001',
      governanceRevision: 'rev-001',
      evidenceType: 'TEST_TYPE',
      evidenceRef: 'ref-001',
    });
  });

  it('null => INVALID_EVIDENCE', () => {
    const result = validateEvidence(null);
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_EVIDENCE');
    assert.deepEqual(result.reasons, ['INVALID_EVIDENCE']);
    assert.equal(result.evidence, null);
  });

  it('array => INVALID_EVIDENCE', () => {
    const result = validateEvidence([]);
    assert.equal(result.decision, 'INVALID_EVIDENCE');
    assert.equal(result.evidence, null);
  });

  it('primitive => INVALID_EVIDENCE', () => {
    assert.equal(validateEvidence('x').decision, 'INVALID_EVIDENCE');
    assert.equal(validateEvidence(1).decision, 'INVALID_EVIDENCE');
    assert.equal(validateEvidence(true).decision, 'INVALID_EVIDENCE');
    assert.equal(validateEvidence(undefined).decision, 'INVALID_EVIDENCE');
  });

  it('missing key => INVALID_EVIDENCE', () => {
    const { evidenceId, ...rest } = validEvidence();
    assert.equal(validateEvidence(rest).decision, 'INVALID_EVIDENCE');
  });

  it('extra key => INVALID_EVIDENCE', () => {
    const result = validateEvidence({ ...validEvidence(), extra: 'x' });
    assert.equal(result.decision, 'INVALID_EVIDENCE');
  });

  it('input key order irrelevant', () => {
    const shuffled = {
      evidenceRef: 'ref-001',
      evidenceType: 'TEST_TYPE',
      governanceRevision: 'rev-001',
      actorId: 'actor-001',
      taskId: 'task-001',
      evidenceId: 'ev-001',
    };
    const result = validateEvidence(shuffled);
    assert.equal(result.valid, true);
    assert.deepEqual(Object.keys(result.evidence), [...CANONICAL_KEY_ORDER]);
  });

  it('empty evidenceId => INVALID_EVIDENCE_ID', () => {
    assert.equal(
      validateEvidence(validEvidence({ evidenceId: '' })).decision,
      'INVALID_EVIDENCE_ID',
    );
  });

  it('non-string evidenceId => INVALID_EVIDENCE_ID', () => {
    assert.equal(
      validateEvidence(validEvidence({ evidenceId: 1 })).decision,
      'INVALID_EVIDENCE_ID',
    );
  });

  it('empty taskId => INVALID_TASK_REFERENCE', () => {
    assert.equal(
      validateEvidence(validEvidence({ taskId: '' })).decision,
      'INVALID_TASK_REFERENCE',
    );
  });

  it('non-string taskId => INVALID_TASK_REFERENCE', () => {
    assert.equal(
      validateEvidence(validEvidence({ taskId: [] })).decision,
      'INVALID_TASK_REFERENCE',
    );
  });

  it('empty actorId => INVALID_ACTOR_REFERENCE', () => {
    assert.equal(
      validateEvidence(validEvidence({ actorId: '' })).decision,
      'INVALID_ACTOR_REFERENCE',
    );
  });

  it('non-string actorId => INVALID_ACTOR_REFERENCE', () => {
    assert.equal(
      validateEvidence(validEvidence({ actorId: 0 })).decision,
      'INVALID_ACTOR_REFERENCE',
    );
  });

  it('empty governanceRevision => INVALID_GOVERNANCE_REVISION', () => {
    assert.equal(
      validateEvidence(validEvidence({ governanceRevision: '' })).decision,
      'INVALID_GOVERNANCE_REVISION',
    );
  });

  it('non-string governanceRevision => INVALID_GOVERNANCE_REVISION', () => {
    assert.equal(
      validateEvidence(validEvidence({ governanceRevision: false })).decision,
      'INVALID_GOVERNANCE_REVISION',
    );
  });

  it('empty evidenceType => INVALID_EVIDENCE_TYPE', () => {
    assert.equal(
      validateEvidence(validEvidence({ evidenceType: '' })).decision,
      'INVALID_EVIDENCE_TYPE',
    );
  });

  it('non-string evidenceType => INVALID_EVIDENCE_TYPE', () => {
    assert.equal(
      validateEvidence(validEvidence({ evidenceType: null })).decision,
      'INVALID_EVIDENCE_TYPE',
    );
  });

  it('empty evidenceRef => INVALID_EVIDENCE_REF', () => {
    assert.equal(
      validateEvidence(validEvidence({ evidenceRef: '' })).decision,
      'INVALID_EVIDENCE_REF',
    );
  });

  it('non-string evidenceRef => INVALID_EVIDENCE_REF', () => {
    assert.equal(
      validateEvidence(validEvidence({ evidenceRef: {} })).decision,
      'INVALID_EVIDENCE_REF',
    );
  });

  it('precedence: malformed beats field checks', () => {
    assert.equal(validateEvidence({ evidenceId: '' }).decision, 'INVALID_EVIDENCE');
  });

  it('precedence: evidenceId before taskId', () => {
    assert.equal(
      validateEvidence(validEvidence({ evidenceId: '', taskId: '' })).decision,
      'INVALID_EVIDENCE_ID',
    );
  });

  it('precedence: taskId before actorId', () => {
    assert.equal(
      validateEvidence(validEvidence({ taskId: '', actorId: '' })).decision,
      'INVALID_TASK_REFERENCE',
    );
  });

  it('precedence: actorId before governanceRevision', () => {
    assert.equal(
      validateEvidence(validEvidence({ actorId: '', governanceRevision: '' })).decision,
      'INVALID_ACTOR_REFERENCE',
    );
  });

  it('precedence: governanceRevision before evidenceType', () => {
    assert.equal(
      validateEvidence(validEvidence({ governanceRevision: '', evidenceType: '' })).decision,
      'INVALID_GOVERNANCE_REVISION',
    );
  });

  it('precedence: evidenceType before evidenceRef', () => {
    assert.equal(
      validateEvidence(validEvidence({ evidenceType: '', evidenceRef: '' })).decision,
      'INVALID_EVIDENCE_TYPE',
    );
  });

  it('valid result contract: frozen copy + reasons', () => {
    const input = validEvidence();
    const result = validateEvidence(input);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'VALID');
    assert.deepEqual(result.reasons, []);
    assert.notEqual(result.evidence, input);
    assertFrozen(result);
    assertFrozen(result.reasons);
    assertFrozen(result.evidence);
  });

  it('invalid result contract: frozen + null evidence', () => {
    const result = validateEvidence(null);
    assert.equal(result.valid, false);
    assert.equal(result.evidence, null);
    assert.deepEqual(result.reasons, [result.decision]);
    assertFrozen(result);
    assertFrozen(result.reasons);
  });

  it('input not mutated on validate', () => {
    const input = validEvidence();
    const snapshot = JSON.stringify(input);
    validateEvidence(input);
    assert.equal(JSON.stringify(input), snapshot);
  });

  it('same input => deep-equal validation output', () => {
    const input = validEvidence();
    const a = validateEvidence(input);
    const b = validateEvidence(input);
    assert.deepEqual(a, b);
    assert.notEqual(a, b);
    assert.notEqual(a.evidence, b.evidence);
  });
});

describe('TECP-016 Evidence Ledger — canonicalizeEvidence', () => {
  it('exact field order', () => {
    const canonical = canonicalizeEvidence(validEvidence());
    assert.deepEqual(Object.keys(canonical), [...CANONICAL_KEY_ORDER]);
  });

  it('no extra fields copied', () => {
    const input = { ...validEvidence(), extra: 'x' };
    const canonical = canonicalizeEvidence(input);
    assert.deepEqual(Object.keys(canonical), [...CANONICAL_KEY_ORDER]);
    assert.equal('extra' in canonical, false);
  });

  it('strings preserved exactly (whitespace + case)', () => {
    const input = validEvidence({
      evidenceId: ' Ev-Aa ',
      taskId: ' Task ',
      actorId: 'Actor',
      governanceRevision: 'Rev',
      evidenceType: 'Type X',
      evidenceRef: ' Ref ',
    });
    const canonical = canonicalizeEvidence(input);
    assert.equal(canonical.evidenceId, ' Ev-Aa ');
    assert.equal(canonical.taskId, ' Task ');
    assert.equal(canonical.actorId, 'Actor');
    assert.equal(canonical.governanceRevision, 'Rev');
    assert.equal(canonical.evidenceType, 'Type X');
    assert.equal(canonical.evidenceRef, ' Ref ');
  });

  it('no normalization', () => {
    const input = validEvidence({ evidenceId: '  id  ' });
    assert.equal(canonicalizeEvidence(input).evidenceId, '  id  ');
  });

  it('canonical result frozen', () => {
    assertFrozen(canonicalizeEvidence(validEvidence()));
  });

  it('input not mutated', () => {
    const input = validEvidence();
    const snapshot = JSON.stringify(input);
    canonicalizeEvidence(input);
    assert.equal(JSON.stringify(input), snapshot);
  });

  it('same input => deep-equal canonical output', () => {
    const input = validEvidence();
    const a = canonicalizeEvidence(input);
    const b = canonicalizeEvidence(input);
    assert.deepEqual(a, b);
    assert.notEqual(a, b);
  });
});

describe('TECP-016 Evidence Ledger — boundary exclusions', () => {
  it('forbidden APIs not exported', async () => {
    const mod = await import('../src/evidenceLedger.js');
    for (const name of [
      'submitEvidence',
      'storeEvidence',
      'persistEvidence',
      'queryEvidence',
      'listEvidence',
      'getEvidence',
      'deleteEvidence',
      'supersedeEvidence',
      'appendEvidence',
    ]) {
      assert.equal(mod[name], undefined, name);
    }
  });

  it('forbidden fields rejected as extra keys', () => {
    for (const field of [
      'payload',
      'body',
      'content',
      'metadata',
      'timestamp',
      'createdAt',
      'sequence',
    ]) {
      assert.equal(
        validateEvidence({ ...validEvidence(), [field]: 'x' }).decision,
        'INVALID_EVIDENCE',
        field,
      );
    }
  });

  it('source boundary — forbidden tokens absent', () => {
    for (const token of FORBIDDEN_SOURCE_TOKENS) {
      assert.equal(SOURCE_TEXT.includes(token), false, `forbidden token present: ${token}`);
    }
  });

  it('authorized source path only', () => {
    assert.equal(SOURCE_PATH.endsWith('tecp/src/evidenceLedger.js'), true);
  });
});
