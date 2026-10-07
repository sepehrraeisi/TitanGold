/**
 * TECP-009 in-memory resource claims.
 *
 * Persistent schema owner remains migration 056 (`tecp_resource_claims`).
 * Conceptual field mapping only:
 *   taskId ↔ task_id
 *   resourceType ↔ resource_type
 *   resourceKey ↔ resource_key
 *   accessMode ↔ access_mode
 * Exact duplicate identity is an in-memory tuple only. This module creates
 * no UNIQUE constraint, reads no database, and owns no compatibility verdict.
 */

export const RESOURCE_TYPES = Object.freeze([
  'FILE',
  'COMPONENT',
  'SOURCE_OF_TRUTH',
  'AUTHORITY',
  'RUNTIME',
]);

export const CLAIM_ACCESS_MODES = Object.freeze([
  'READ',
  'WRITE',
]);

export const RESOURCE_CLAIM_DECISIONS = Object.freeze({
  VALID: 'VALID',
  INVALID_CLAIM: 'INVALID_CLAIM',
  INVALID_DUPLICATE_CLAIM: 'INVALID_DUPLICATE_CLAIM',
  INVALID_TASK_REFERENCE: 'INVALID_TASK_REFERENCE',
  INVALID_RESOURCE_TYPE: 'INVALID_RESOURCE_TYPE',
  INVALID_RESOURCE_KEY: 'INVALID_RESOURCE_KEY',
  INVALID_CLAIM_MODE: 'INVALID_CLAIM_MODE',
});

const CLAIM_KEYS = Object.freeze(['taskId', 'resourceType', 'resourceKey', 'accessMode']);

const DECISION_PRIORITY = Object.freeze([
  RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM,
  RESOURCE_CLAIM_DECISIONS.INVALID_TASK_REFERENCE,
  RESOURCE_CLAIM_DECISIONS.INVALID_RESOURCE_TYPE,
  RESOURCE_CLAIM_DECISIONS.INVALID_RESOURCE_KEY,
  RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM_MODE,
]);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  return keys.every((key) => actual.includes(key));
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function rawField(value, key) {
  if (!isPlainObject(value) || !Object.prototype.hasOwnProperty.call(value, key)) return '';
  const field = value[key];
  return typeof field === 'string' ? field : `\u0000${typeof field}`;
}

function compareDiagnostic(left, right) {
  for (const key of CLAIM_KEYS) {
    const leftField = rawField(left, key);
    const rightField = rawField(right, key);
    if (leftField < rightField) return -1;
    if (leftField > rightField) return 1;
  }
  return 0;
}

function classifyClaim(claim) {
  if (!isPlainObject(claim) || !hasExactKeys(claim, CLAIM_KEYS)) {
    return RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM;
  }
  if (!isNonEmptyString(claim.taskId)) return RESOURCE_CLAIM_DECISIONS.INVALID_TASK_REFERENCE;
  if (!RESOURCE_TYPES.includes(claim.resourceType)) return RESOURCE_CLAIM_DECISIONS.INVALID_RESOURCE_TYPE;
  if (!isNonEmptyString(claim.resourceKey)) return RESOURCE_CLAIM_DECISIONS.INVALID_RESOURCE_KEY;
  if (!CLAIM_ACCESS_MODES.includes(claim.accessMode)) return RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM_MODE;
  return RESOURCE_CLAIM_DECISIONS.VALID;
}

export function canonicalizeResourceClaim(claim) {
  return Object.freeze({
    taskId: claim.taskId,
    resourceType: claim.resourceType,
    resourceKey: claim.resourceKey,
    accessMode: claim.accessMode,
  });
}

function claimIdentity(claim) {
  return `${claim.taskId}\u0000${claim.resourceType}\u0000${claim.resourceKey}\u0000${claim.accessMode}`;
}

function compareClaim(left, right) {
  if (left.taskId < right.taskId) return -1;
  if (left.taskId > right.taskId) return 1;
  if (left.resourceType < right.resourceType) return -1;
  if (left.resourceType > right.resourceType) return 1;
  if (left.resourceKey < right.resourceKey) return -1;
  if (left.resourceKey > right.resourceKey) return 1;
  if (left.accessMode < right.accessMode) return -1;
  if (left.accessMode > right.accessMode) return 1;
  return 0;
}

function invalidResult(decision, reasons) {
  return freezeDeep({
    valid: false,
    decision,
    reasons,
    claims: null,
  });
}

export function validateResourceClaim(claim) {
  const decision = classifyClaim(claim);
  if (decision !== RESOURCE_CLAIM_DECISIONS.VALID) {
    return freezeDeep({
      valid: false,
      decision,
      reasons: [decision],
      claim: null,
    });
  }
  return freezeDeep({
    valid: true,
    decision: RESOURCE_CLAIM_DECISIONS.VALID,
    reasons: [],
    claim: canonicalizeResourceClaim(claim),
  });
}

export function buildResourceClaims(claims) {
  if (!Array.isArray(claims)) {
    return invalidResult(RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM, [RESOURCE_CLAIM_DECISIONS.INVALID_CLAIM]);
  }

  const classified = claims.map((claim) => ({
    claim,
    decision: classifyClaim(claim),
  }));
  const invalid = classified.filter((item) => item.decision !== RESOURCE_CLAIM_DECISIONS.VALID);
  if (invalid.length > 0) {
    const selected = [...invalid].sort((left, right) => {
      const priorityDelta = DECISION_PRIORITY.indexOf(left.decision) - DECISION_PRIORITY.indexOf(right.decision);
      if (priorityDelta !== 0) return priorityDelta;
      return compareDiagnostic(left.claim, right.claim);
    })[0];
    return invalidResult(selected.decision, [selected.decision]);
  }

  const canonical = classified.map((item) => canonicalizeResourceClaim(item.claim));
  const seen = new Map();
  for (const claim of canonical) {
    const key = claimIdentity(claim);
    const group = seen.get(key);
    if (group) group.push(claim);
    else seen.set(key, [claim]);
  }
  const duplicateKeys = [...seen.keys()].filter((key) => seen.get(key).length > 1).sort();
  if (duplicateKeys.length > 0) {
    const reasons = duplicateKeys.map((key) => {
      const claim = seen.get(key)[0];
      return `DUPLICATE_CLAIM:${claim.taskId}|${claim.resourceType}|${claim.resourceKey}|${claim.accessMode}`;
    });
    return invalidResult(RESOURCE_CLAIM_DECISIONS.INVALID_DUPLICATE_CLAIM, reasons);
  }

  canonical.sort(compareClaim);
  return freezeDeep({
    valid: true,
    decision: RESOURCE_CLAIM_DECISIONS.VALID,
    reasons: [],
    claims: canonical,
  });
}
