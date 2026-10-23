/**
 * TECP-013 Audit Event — pure in-memory immutable value model.
 *
 * Validates and canonicalizes control-plane audit-event facts only.
 * No persistence, emission, collection, ordering, clock fields, or free-form body.
 * Distinct from application log tables and future ledger owners.
 */

export const AUDIT_EVENT_DECISIONS = Object.freeze({
  VALID: 'VALID',
  INVALID_EVENT: 'INVALID_EVENT',
  INVALID_EVENT_ID: 'INVALID_EVENT_ID',
  INVALID_EVENT_TYPE: 'INVALID_EVENT_TYPE',
  INVALID_TASK_REFERENCE: 'INVALID_TASK_REFERENCE',
  INVALID_ACTOR_REFERENCE: 'INVALID_ACTOR_REFERENCE',
  INVALID_GOVERNANCE_REVISION: 'INVALID_GOVERNANCE_REVISION',
});

const EVENT_KEYS = Object.freeze([
  'eventId',
  'eventType',
  'taskId',
  'actorId',
  'governanceRevision',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  }
  return true;
}

function freezeDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
}

function classifyEvent(event) {
  if (!isPlainObject(event) || !hasExactKeys(event, EVENT_KEYS)) {
    return AUDIT_EVENT_DECISIONS.INVALID_EVENT;
  }
  if (!isNonEmptyString(event.eventId)) {
    return AUDIT_EVENT_DECISIONS.INVALID_EVENT_ID;
  }
  if (!isNonEmptyString(event.eventType)) {
    return AUDIT_EVENT_DECISIONS.INVALID_EVENT_TYPE;
  }
  if (!isNonEmptyString(event.taskId)) {
    return AUDIT_EVENT_DECISIONS.INVALID_TASK_REFERENCE;
  }
  if (!isNonEmptyString(event.actorId)) {
    return AUDIT_EVENT_DECISIONS.INVALID_ACTOR_REFERENCE;
  }
  if (!isNonEmptyString(event.governanceRevision)) {
    return AUDIT_EVENT_DECISIONS.INVALID_GOVERNANCE_REVISION;
  }
  return AUDIT_EVENT_DECISIONS.VALID;
}

/**
 * Return a frozen exact-order copy. Does not validate external state.
 * Callers that need validation must use validateAuditEvent first.
 * Invalid/malformed input that is not a plain object with exact keys
 * still produces a deterministic frozen copy of the five fields when
 * present as own properties; missing fields become undefined.
 * Per TECP-013 contract, canonicalizeAuditEvent is used after validation
 * for valid events and preserves exact string semantics.
 */
export function canonicalizeAuditEvent(event) {
  return Object.freeze({
    eventId: event.eventId,
    eventType: event.eventType,
    taskId: event.taskId,
    actorId: event.actorId,
    governanceRevision: event.governanceRevision,
  });
}

function validResult(event) {
  return freezeDeep({
    valid: true,
    decision: AUDIT_EVENT_DECISIONS.VALID,
    reasons: [],
    event,
  });
}

function invalidResult(decision) {
  return freezeDeep({
    valid: false,
    decision,
    reasons: [decision],
    event: null,
  });
}

export function validateAuditEvent(event) {
  const decision = classifyEvent(event);
  if (decision !== AUDIT_EVENT_DECISIONS.VALID) {
    return invalidResult(decision);
  }
  return validResult(canonicalizeAuditEvent(event));
}
