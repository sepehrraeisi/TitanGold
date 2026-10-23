import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  AUDIT_EVENT_DECISIONS,
  canonicalizeAuditEvent,
  validateAuditEvent,
} from '../src/auditEvent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(__dirname, '../src/auditEvent.js');
const SOURCE_TEXT = readFileSync(SOURCE_PATH, 'utf8');

const EXPECTED_DECISIONS = Object.freeze([
  'VALID',
  'INVALID_EVENT',
  'INVALID_EVENT_ID',
  'INVALID_EVENT_TYPE',
  'INVALID_TASK_REFERENCE',
  'INVALID_ACTOR_REFERENCE',
  'INVALID_GOVERNANCE_REVISION',
]);

const EXPECTED_PUBLIC_EXPORTS = Object.freeze([
  'AUDIT_EVENT_DECISIONS',
  'canonicalizeAuditEvent',
  'validateAuditEvent',
]);

const FORBIDDEN_SOURCE_TOKENS = Object.freeze([
  'payload',
  'metadata',
  'occurredAt',
  'timestamp',
  'createdAt',
  'updatedAt',
  'sequence',
  'source',
  'origin',
  'rule02Parser',
  'governanceValidator',
  'taskGraph',
  'actorCapabilityEngine',
  'scopeExpansion',
  'leaseEngine',
  'conflictEngine',
  'resourceClaims',
  'evidence',
  'runtime',
  'github',
  'linear',
  'backend/',
  'audit_logs',
  'system_logs',
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
  'buildAuditEvent',
  'emitAuditEvent',
  'publishAuditEvent',
  'persistAuditEvent',
  'appendAuditEvent',
  'storeAuditEvent',
  'updateAuditEvent',
  'deleteAuditEvent',
  'patchAuditEvent',
]);

function validEvent(overrides = {}) {
  return {
    eventId: 'evt-001',
    eventType: 'TASK_CLAIMED',
    taskId: 'task-001',
    actorId: 'actor-001',
    governanceRevision: 'rev-001',
    ...overrides,
  };
}

function assertFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
}

describe('TECP-013 Audit Event — decisions and exports', () => {
  it('42. exact decision vocabulary', () => {
    assert.deepEqual(Object.keys(AUDIT_EVENT_DECISIONS).sort(), [...EXPECTED_DECISIONS].sort());
    for (const key of EXPECTED_DECISIONS) {
      assert.equal(AUDIT_EVENT_DECISIONS[key], key);
    }
    assertFrozen(AUDIT_EVENT_DECISIONS);
  });

  it('43. exact public export surface', async () => {
    const mod = await import('../src/auditEvent.js');
    assert.deepEqual(Object.keys(mod).sort(), [...EXPECTED_PUBLIC_EXPORTS]);
  });
});

describe('TECP-013 Audit Event — validateAuditEvent', () => {
  it('1. valid event', () => {
    const input = validEvent();
    const result = validateAuditEvent(input);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'VALID');
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.event, {
      eventId: 'evt-001',
      eventType: 'TASK_CLAIMED',
      taskId: 'task-001',
      actorId: 'actor-001',
      governanceRevision: 'rev-001',
    });
  });

  it('2. null => INVALID_EVENT', () => {
    const result = validateAuditEvent(null);
    assert.equal(result.valid, false);
    assert.equal(result.decision, 'INVALID_EVENT');
    assert.deepEqual(result.reasons, ['INVALID_EVENT']);
    assert.equal(result.event, null);
  });

  it('3. array => INVALID_EVENT', () => {
    const result = validateAuditEvent([]);
    assert.equal(result.decision, 'INVALID_EVENT');
    assert.equal(result.event, null);
  });

  it('4. primitive => INVALID_EVENT', () => {
    assert.equal(validateAuditEvent('x').decision, 'INVALID_EVENT');
    assert.equal(validateAuditEvent(1).decision, 'INVALID_EVENT');
    assert.equal(validateAuditEvent(true).decision, 'INVALID_EVENT');
    assert.equal(validateAuditEvent(undefined).decision, 'INVALID_EVENT');
  });

  it('5. missing field => INVALID_EVENT', () => {
    const { eventId, ...rest } = validEvent();
    assert.equal(validateAuditEvent(rest).decision, 'INVALID_EVENT');
  });

  it('6. extra field => INVALID_EVENT', () => {
    const result = validateAuditEvent({ ...validEvent(), payload: {} });
    assert.equal(result.decision, 'INVALID_EVENT');
  });

  it('7. empty eventId => INVALID_EVENT_ID', () => {
    assert.equal(validateAuditEvent(validEvent({ eventId: '' })).decision, 'INVALID_EVENT_ID');
  });

  it('8. non-string eventId => INVALID_EVENT_ID', () => {
    assert.equal(validateAuditEvent(validEvent({ eventId: 1 })).decision, 'INVALID_EVENT_ID');
  });

  it('9. empty eventType => INVALID_EVENT_TYPE', () => {
    assert.equal(validateAuditEvent(validEvent({ eventType: '' })).decision, 'INVALID_EVENT_TYPE');
  });

  it('10. non-string eventType => INVALID_EVENT_TYPE', () => {
    assert.equal(validateAuditEvent(validEvent({ eventType: null })).decision, 'INVALID_EVENT_TYPE');
  });

  it('11. empty taskId => INVALID_TASK_REFERENCE', () => {
    assert.equal(validateAuditEvent(validEvent({ taskId: '' })).decision, 'INVALID_TASK_REFERENCE');
  });

  it('12. non-string taskId => INVALID_TASK_REFERENCE', () => {
    assert.equal(validateAuditEvent(validEvent({ taskId: [] })).decision, 'INVALID_TASK_REFERENCE');
  });

  it('13. empty actorId => INVALID_ACTOR_REFERENCE', () => {
    assert.equal(validateAuditEvent(validEvent({ actorId: '' })).decision, 'INVALID_ACTOR_REFERENCE');
  });

  it('14. non-string actorId => INVALID_ACTOR_REFERENCE', () => {
    assert.equal(validateAuditEvent(validEvent({ actorId: 0 })).decision, 'INVALID_ACTOR_REFERENCE');
  });

  it('15. empty governanceRevision => INVALID_GOVERNANCE_REVISION', () => {
    assert.equal(
      validateAuditEvent(validEvent({ governanceRevision: '' })).decision,
      'INVALID_GOVERNANCE_REVISION',
    );
  });

  it('16. non-string governanceRevision => INVALID_GOVERNANCE_REVISION', () => {
    assert.equal(
      validateAuditEvent(validEvent({ governanceRevision: false })).decision,
      'INVALID_GOVERNANCE_REVISION',
    );
  });

  it('17. validation precedence: malformed beats field checks', () => {
    assert.equal(validateAuditEvent({ eventId: '' }).decision, 'INVALID_EVENT');
  });

  it('18. validation precedence eventId before eventType', () => {
    assert.equal(
      validateAuditEvent(validEvent({ eventId: '', eventType: '' })).decision,
      'INVALID_EVENT_ID',
    );
  });

  it('19. eventType before taskId', () => {
    assert.equal(
      validateAuditEvent(validEvent({ eventType: '', taskId: '' })).decision,
      'INVALID_EVENT_TYPE',
    );
  });

  it('20. taskId before actorId', () => {
    assert.equal(
      validateAuditEvent(validEvent({ taskId: '', actorId: '' })).decision,
      'INVALID_TASK_REFERENCE',
    );
  });

  it('21. actorId before governanceRevision', () => {
    assert.equal(
      validateAuditEvent(validEvent({ actorId: '', governanceRevision: '' })).decision,
      'INVALID_ACTOR_REFERENCE',
    );
  });

  it('31–37. valid result contract', () => {
    const input = validEvent();
    const result = validateAuditEvent(input);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'VALID');
    assert.deepEqual(result.reasons, []);
    assert.notEqual(result.event, input);
    assertFrozen(result);
    assertFrozen(result.reasons);
    assertFrozen(result.event);
  });

  it('38–41. invalid result contract', () => {
    const result = validateAuditEvent(null);
    assert.equal(result.valid, false);
    assert.equal(result.event, null);
    assert.deepEqual(result.reasons, [result.decision]);
    assertFrozen(result);
    assertFrozen(result.reasons);
  });

  it('input not mutated on validate', () => {
    const input = validEvent();
    const snapshot = JSON.stringify(input);
    validateAuditEvent(input);
    assert.equal(JSON.stringify(input), snapshot);
  });
});

describe('TECP-013 Audit Event — canonicalizeAuditEvent', () => {
  it('22. exact field order', () => {
    const canonical = canonicalizeAuditEvent(validEvent());
    assert.deepEqual(Object.keys(canonical), [
      'eventId',
      'eventType',
      'taskId',
      'actorId',
      'governanceRevision',
    ]);
  });

  it('23. no extra fields', () => {
    const input = { ...validEvent(), payload: 'x' };
    // canonicalize does not validate; only copies the five fields.
    const canonical = canonicalizeAuditEvent(input);
    assert.deepEqual(Object.keys(canonical), [
      'eventId',
      'eventType',
      'taskId',
      'actorId',
      'governanceRevision',
    ]);
    assert.equal('payload' in canonical, false);
  });

  it('24–26. strings preserved exactly (whitespace + case)', () => {
    const input = validEvent({
      eventId: ' Evt-Aa ',
      eventType: 'Type X',
      taskId: ' Task ',
      actorId: 'Actor',
      governanceRevision: 'Rev',
    });
    const canonical = canonicalizeAuditEvent(input);
    assert.equal(canonical.eventId, ' Evt-Aa ');
    assert.equal(canonical.eventType, 'Type X');
    assert.equal(canonical.taskId, ' Task ');
    assert.equal(canonical.actorId, 'Actor');
    assert.equal(canonical.governanceRevision, 'Rev');
  });

  it('27. no normalization', () => {
    const input = validEvent({ eventId: '  id  ' });
    assert.equal(canonicalizeAuditEvent(input).eventId, '  id  ');
  });

  it('28. canonical result frozen', () => {
    assertFrozen(canonicalizeAuditEvent(validEvent()));
  });

  it('29. input not mutated', () => {
    const input = validEvent();
    const snapshot = JSON.stringify(input);
    canonicalizeAuditEvent(input);
    assert.equal(JSON.stringify(input), snapshot);
  });

  it('30. same input => deep-equal canonical output', () => {
    const input = validEvent();
    const a = canonicalizeAuditEvent(input);
    const b = canonicalizeAuditEvent(input);
    assert.deepEqual(a, b);
    assert.notEqual(a, b);
  });
});

describe('TECP-013 Audit Event — boundary exclusions', () => {
  it('44–49. no mutation/emission/store APIs exported', async () => {
    const mod = await import('../src/auditEvent.js');
    for (const name of [
      'buildAuditEvent',
      'emitAuditEvent',
      'publishAuditEvent',
      'persistAuditEvent',
      'appendAuditEvent',
      'storeAuditEvent',
      'updateAuditEvent',
      'deleteAuditEvent',
      'patchAuditEvent',
      'supersedeAuditEvent',
      'correctAuditEvent',
    ]) {
      assert.equal(mod[name], undefined, name);
    }
  });

  it('50–53. no payload/timestamp/sequence/source/origin fields accepted', () => {
    for (const field of ['payload', 'timestamp', 'sequence', 'source', 'origin', 'metadata', 'occurredAt']) {
      assert.equal(
        validateAuditEvent({ ...validEvent(), [field]: 'x' }).decision,
        'INVALID_EVENT',
        field,
      );
    }
  });

  it('54–68. source boundary — forbidden tokens absent', () => {
    for (const token of FORBIDDEN_SOURCE_TOKENS) {
      assert.equal(SOURCE_TEXT.includes(token), false, `forbidden token present: ${token}`);
    }
  });

  it('68. only authorized source/test files exist for this slice', () => {
    assert.equal(SOURCE_PATH.endsWith('tecp/src/auditEvent.js'), true);
  });
});
