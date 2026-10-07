/**
 * TECP-010 in-memory conflict evaluation.
 *
 * Consumes TECP-009 claim facts and returns pairwise and set verdicts.
 * Facts only: no execution order, no resource reservation, no status change.
 */
import {
  CLAIM_ACCESS_MODES,
  RESOURCE_TYPES,
  validateResourceClaim,
} from './resourceClaims.js';

const READ = CLAIM_ACCESS_MODES.find((mode) => mode === 'READ');
const WRITE = CLAIM_ACCESS_MODES.find((mode) => mode === 'WRITE');
const SOURCE_OF_TRUTH = RESOURCE_TYPES.find((type) => type === 'SOURCE_OF_TRUTH');
const AUTHORITY = RESOURCE_TYPES.find((type) => type === 'AUTHORITY');

export const CONFLICT_VERDICTS = Object.freeze({
  SAFE_PARALLEL: 'SAFE_PARALLEL',
  SERIALIZE: 'SERIALIZE',
  BLOCKED: 'BLOCKED',
  INVALID_INPUT: 'INVALID_INPUT',
});

export const CONFLICT_REASONS = Object.freeze({
  SAME_TASK: 'SAME_TASK',
  DIFFERENT_RESOURCE: 'DIFFERENT_RESOURCE',
  READ_READ: 'READ_READ',
  READ_WRITE: 'READ_WRITE',
  WRITE_READ: 'WRITE_READ',
  WRITE_WRITE_SERIALIZE: 'WRITE_WRITE_SERIALIZE',
  WRITE_WRITE_BLOCKED_SOURCE_OF_TRUTH: 'WRITE_WRITE_BLOCKED_SOURCE_OF_TRUTH',
  WRITE_WRITE_BLOCKED_AUTHORITY: 'WRITE_WRITE_BLOCKED_AUTHORITY',
  INVALID_LEFT_CLAIM: 'INVALID_LEFT_CLAIM',
  INVALID_RIGHT_CLAIM: 'INVALID_RIGHT_CLAIM',
  INVALID_BOTH_CLAIMS: 'INVALID_BOTH_CLAIMS',
  INVALID_CLAIMS_INPUT: 'INVALID_CLAIMS_INPUT',
  INVALID_CLAIM: 'INVALID_CLAIM',
});

function freezeDeep(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const item of Object.values(value)) {
    if (item !== null && typeof item === 'object') freezeDeep(item);
  }
  return Object.freeze(value);
}

function compareCanonicalClaim(left, right) {
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

function pairResult(valid, conflict, verdict, reason, leftClaim, rightClaim) {
  return freezeDeep({
    valid,
    conflict,
    verdict,
    reason,
    leftClaim,
    rightClaim,
  });
}

function invalidPair(reason, leftClaim, rightClaim) {
  return pairResult(
    false,
    true,
    CONFLICT_VERDICTS.INVALID_INPUT,
    reason,
    leftClaim,
    rightClaim,
  );
}

function safePair(reason, leftClaim, rightClaim) {
  return pairResult(
    true,
    false,
    CONFLICT_VERDICTS.SAFE_PARALLEL,
    reason,
    leftClaim,
    rightClaim,
  );
}

function conflictingPair(verdict, reason, leftClaim, rightClaim) {
  return pairResult(true, true, verdict, reason, leftClaim, rightClaim);
}

function sameEffectiveResource(left, right) {
  return left.resourceType === right.resourceType && left.resourceKey === right.resourceKey;
}

function writeWriteVerdict(resourceType) {
  if (resourceType === SOURCE_OF_TRUTH) {
    return {
      verdict: CONFLICT_VERDICTS.BLOCKED,
      reason: CONFLICT_REASONS.WRITE_WRITE_BLOCKED_SOURCE_OF_TRUTH,
    };
  }
  if (resourceType === AUTHORITY) {
    return {
      verdict: CONFLICT_VERDICTS.BLOCKED,
      reason: CONFLICT_REASONS.WRITE_WRITE_BLOCKED_AUTHORITY,
    };
  }
  return {
    verdict: CONFLICT_VERDICTS.SERIALIZE,
    reason: CONFLICT_REASONS.WRITE_WRITE_SERIALIZE,
  };
}

function accessVerdict(left, right) {
  if (left.accessMode === READ && right.accessMode === READ) {
    return {
      conflict: false,
      verdict: CONFLICT_VERDICTS.SAFE_PARALLEL,
      reason: CONFLICT_REASONS.READ_READ,
    };
  }
  if (left.accessMode === READ && right.accessMode === WRITE) {
    return {
      conflict: true,
      verdict: CONFLICT_VERDICTS.SERIALIZE,
      reason: CONFLICT_REASONS.READ_WRITE,
    };
  }
  if (left.accessMode === WRITE && right.accessMode === READ) {
    return {
      conflict: true,
      verdict: CONFLICT_VERDICTS.SERIALIZE,
      reason: CONFLICT_REASONS.WRITE_READ,
    };
  }
  return {
    conflict: true,
    ...writeWriteVerdict(left.resourceType),
  };
}

export function evaluateClaimConflict(leftClaim, rightClaim) {
  const left = validateResourceClaim(leftClaim);
  const right = validateResourceClaim(rightClaim);
  const leftCopy = left.valid ? left.claim : null;
  const rightCopy = right.valid ? right.claim : null;

  if (!left.valid && !right.valid) {
    return invalidPair(CONFLICT_REASONS.INVALID_BOTH_CLAIMS, null, null);
  }
  if (!left.valid) {
    return invalidPair(CONFLICT_REASONS.INVALID_LEFT_CLAIM, null, rightCopy);
  }
  if (!right.valid) {
    return invalidPair(CONFLICT_REASONS.INVALID_RIGHT_CLAIM, leftCopy, null);
  }
  if (leftCopy.taskId === rightCopy.taskId) {
    return safePair(CONFLICT_REASONS.SAME_TASK, leftCopy, rightCopy);
  }
  if (!sameEffectiveResource(leftCopy, rightCopy)) {
    return safePair(CONFLICT_REASONS.DIFFERENT_RESOURCE, leftCopy, rightCopy);
  }

  const access = accessVerdict(leftCopy, rightCopy);
  if (!access.conflict) {
    return safePair(access.reason, leftCopy, rightCopy);
  }
  return conflictingPair(access.verdict, access.reason, leftCopy, rightCopy);
}

function conflictEvidence(pair) {
  return {
    leftTaskId: pair.leftClaim.taskId,
    rightTaskId: pair.rightClaim.taskId,
    resourceType: pair.leftClaim.resourceType,
    resourceKey: pair.leftClaim.resourceKey,
    verdict: pair.verdict,
    reason: pair.reason,
  };
}

function setResult(valid, verdict, conflicts, reasons, claimCount, pairCount) {
  return freezeDeep({
    valid,
    verdict,
    conflicts,
    reasons,
    claimCount,
    pairCount,
  });
}

function invalidSet(reason, claimCount) {
  return setResult(
    false,
    CONFLICT_VERDICTS.INVALID_INPUT,
    [],
    [reason],
    claimCount,
    0,
  );
}

function aggregateVerdict(conflicts) {
  if (conflicts.some((item) => item.verdict === CONFLICT_VERDICTS.BLOCKED)) {
    return CONFLICT_VERDICTS.BLOCKED;
  }
  if (conflicts.some((item) => item.verdict === CONFLICT_VERDICTS.SERIALIZE)) {
    return CONFLICT_VERDICTS.SERIALIZE;
  }
  return CONFLICT_VERDICTS.SAFE_PARALLEL;
}

export function evaluateConflictSet(claims) {
  if (!Array.isArray(claims)) {
    return invalidSet(CONFLICT_REASONS.INVALID_CLAIMS_INPUT, null);
  }

  const canonical = [];
  for (const claim of claims) {
    const validated = validateResourceClaim(claim);
    if (!validated.valid) {
      return invalidSet(CONFLICT_REASONS.INVALID_CLAIM, claims.length);
    }
    canonical.push(validated.claim);
  }

  const ordered = canonical.slice().sort(compareCanonicalClaim);
  const conflicts = [];
  const pairCount = ordered.length < 2
    ? 0
    : (ordered.length * (ordered.length - 1)) / 2;

  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const pair = evaluateClaimConflict(ordered[i], ordered[j]);
      if (!pair.valid || pair.verdict === CONFLICT_VERDICTS.INVALID_INPUT) {
        return invalidSet(CONFLICT_REASONS.INVALID_CLAIM, claims.length);
      }
      if (pair.conflict) {
        conflicts.push(conflictEvidence(pair));
      }
    }
  }

  return setResult(
    true,
    aggregateVerdict(conflicts),
    conflicts,
    conflicts.map((item) => item.reason),
    ordered.length,
    pairCount,
  );
}
