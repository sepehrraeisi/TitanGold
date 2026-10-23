/**
 * TECP-012 in-memory scope expansion proposal classifier.
 *
 * Proposal classification only. Does not approve, apply, mutate Rule02,
 * grant authority, or perform persistence. Context is injected; this module
 * does not read governance files or depend on Rule02 Parser / Governance Validator.
 */

export const SCOPE_EXPANSION_CATEGORIES = Object.freeze([
  'FILE_SCOPE',
  'AUTHORITY_CLASS',
  'RISK_TIER',
  'PROTECTED_PATH',
  'EXTERNAL_ACCESS',
  'RUNTIME_OR_DEPLOY',
]);

export const SCOPE_EXPANSION_DECISIONS = Object.freeze({
  WITHIN_SCOPE: 'WITHIN_SCOPE',
  OWNER_APPROVAL_REQUIRED: 'OWNER_APPROVAL_REQUIRED',
  INVALID_REQUEST: 'INVALID_REQUEST',
});

export const SCOPE_EXPANSION_REASONS = Object.freeze({
  INVALID_REQUEST_SHAPE: 'INVALID_REQUEST_SHAPE',
  INVALID_CONTEXT_SHAPE: 'INVALID_CONTEXT_SHAPE',
  INVALID_REQUEST_ID: 'INVALID_REQUEST_ID',
  INVALID_TASK_ID: 'INVALID_TASK_ID',
  INVALID_ACTOR_ID: 'INVALID_ACTOR_ID',
  INVALID_CATEGORY: 'INVALID_CATEGORY',
  INVALID_REASON: 'INVALID_REASON',
  INVALID_GOVERNANCE_REVISION: 'INVALID_GOVERNANCE_REVISION',
  INVALID_STOP_CONDITION: 'INVALID_STOP_CONDITION',
  INVALID_REQUESTED_PATHS: 'INVALID_REQUESTED_PATHS',
  INVALID_REQUESTED_AUTHORITY_CLASS: 'INVALID_REQUESTED_AUTHORITY_CLASS',
  INVALID_REQUESTED_RISK_TIER: 'INVALID_REQUESTED_RISK_TIER',
  INVALID_AUTHORIZED_PATHS: 'INVALID_AUTHORIZED_PATHS',
  INVALID_AUTHORITY_CLASS: 'INVALID_AUTHORITY_CLASS',
  INVALID_RISK_TIER: 'INVALID_RISK_TIER',
  TASK_MISMATCH: 'TASK_MISMATCH',
  GOVERNANCE_REVISION_MISMATCH: 'GOVERNANCE_REVISION_MISMATCH',
  STOP_CONDITION_PRESENT: 'STOP_CONDITION_PRESENT',
  ALL_PATHS_WITHIN_SCOPE: 'ALL_PATHS_WITHIN_SCOPE',
  PATH_EXPANSION_REQUIRED: 'PATH_EXPANSION_REQUIRED',
  PROTECTED_PATH_REQUIRES_OWNER: 'PROTECTED_PATH_REQUIRES_OWNER',
  AUTHORITY_CLASS_REQUIRES_OWNER: 'AUTHORITY_CLASS_REQUIRES_OWNER',
  RISK_TIER_REQUIRES_OWNER: 'RISK_TIER_REQUIRES_OWNER',
  EXTERNAL_ACCESS_REQUIRES_OWNER: 'EXTERNAL_ACCESS_REQUIRES_OWNER',
  RUNTIME_OR_DEPLOY_REQUIRES_OWNER: 'RUNTIME_OR_DEPLOY_REQUIRES_OWNER',
});

const REQUEST_KEYS = Object.freeze([
  'requestId',
  'taskId',
  'actorId',
  'category',
  'requestedPaths',
  'requestedAuthorityClass',
  'requestedRiskTier',
  'reason',
  'governanceRevision',
  'stopCondition',
]);

const CONTEXT_KEYS = Object.freeze([
  'taskId',
  'authorizedPaths',
  'authorityClass',
  'riskTier',
  'governanceRevision',
]);

const PATH_REQUIRED_CATEGORIES = Object.freeze(['FILE_SCOPE', 'PROTECTED_PATH']);
const AUTHORITY_REQUIRED_CATEGORIES = Object.freeze(['AUTHORITY_CLASS']);
const RISK_REQUIRED_CATEGORIES = Object.freeze(['RISK_TIER']);
const NULL_FIELD_CATEGORIES = Object.freeze(['EXTERNAL_ACCESS', 'RUNTIME_OR_DEPLOY']);

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
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

/**
 * Valid repo-relative path/prefix: non-empty string, not absolute, no `..`
 * segment, `/` separators, case-sensitive, no normalization.
 * Empty segments (e.g. `foo//bar`) are accepted literally — governance does
 * not forbid them and inventing normalization is prohibited.
 */
export function isValidRepoRelativePath(value) {
  if (!isNonEmptyString(value)) return false;
  if (value.startsWith('/')) return false;
  const segments = value.split('/');
  for (const segment of segments) {
    if (segment === '..') return false;
  }
  return true;
}

function isValidPathList(value, { allowEmpty }) {
  if (!Array.isArray(value)) return false;
  if (!allowEmpty && value.length === 0) return false;
  const seen = new Set();
  for (const entry of value) {
    if (!isValidRepoRelativePath(entry)) return false;
    if (seen.has(entry)) return false;
    seen.add(entry);
  }
  return true;
}

function copyPathList(value) {
  return Object.freeze(value.map((entry) => entry));
}

function pathIsCovered(requestedPath, authorizedEntry) {
  return requestedPath === authorizedEntry
    || requestedPath.startsWith(`${authorizedEntry}/`);
}

function uncoverPaths(requestedPaths, authorizedPaths) {
  const uncovered = [];
  for (const path of requestedPaths) {
    let covered = false;
    for (const authorized of authorizedPaths) {
      if (pathIsCovered(path, authorized)) {
        covered = true;
        break;
      }
    }
    if (!covered) uncovered.push(path);
  }
  return Object.freeze(uncovered);
}

function classifyCategoryFields(request) {
  const category = request.category;
  const paths = request.requestedPaths;
  const authority = request.requestedAuthorityClass;
  const risk = request.requestedRiskTier;

  if (PATH_REQUIRED_CATEGORIES.includes(category)) {
    if (!isValidPathList(paths, { allowEmpty: false })) {
      return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_PATHS;
    }
    if (authority !== null) return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_AUTHORITY_CLASS;
    if (risk !== null) return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_RISK_TIER;
    return null;
  }

  if (AUTHORITY_REQUIRED_CATEGORIES.includes(category)) {
    if (!isNonEmptyString(authority)) {
      return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_AUTHORITY_CLASS;
    }
    if (paths !== null) return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_PATHS;
    if (risk !== null) return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_RISK_TIER;
    return null;
  }

  if (RISK_REQUIRED_CATEGORIES.includes(category)) {
    if (!isNonEmptyString(risk)) {
      return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_RISK_TIER;
    }
    if (paths !== null) return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_PATHS;
    if (authority !== null) return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_AUTHORITY_CLASS;
    return null;
  }

  if (NULL_FIELD_CATEGORIES.includes(category)) {
    if (paths !== null) return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_PATHS;
    if (authority !== null) return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_AUTHORITY_CLASS;
    if (risk !== null) return SCOPE_EXPANSION_REASONS.INVALID_REQUESTED_RISK_TIER;
    return null;
  }

  return SCOPE_EXPANSION_REASONS.INVALID_CATEGORY;
}

function classifyRequest(request) {
  if (!isPlainObject(request) || !hasExactKeys(request, REQUEST_KEYS)) {
    return SCOPE_EXPANSION_REASONS.INVALID_REQUEST_SHAPE;
  }
  if (!isNonEmptyString(request.requestId)) return SCOPE_EXPANSION_REASONS.INVALID_REQUEST_ID;
  if (!isNonEmptyString(request.taskId)) return SCOPE_EXPANSION_REASONS.INVALID_TASK_ID;
  if (!isNonEmptyString(request.actorId)) return SCOPE_EXPANSION_REASONS.INVALID_ACTOR_ID;
  if (!SCOPE_EXPANSION_CATEGORIES.includes(request.category)) {
    return SCOPE_EXPANSION_REASONS.INVALID_CATEGORY;
  }
  if (!isNonEmptyString(request.reason)) return SCOPE_EXPANSION_REASONS.INVALID_REASON;
  if (!isNonEmptyString(request.governanceRevision)) {
    return SCOPE_EXPANSION_REASONS.INVALID_GOVERNANCE_REVISION;
  }
  if (!(request.stopCondition === null || isNonEmptyString(request.stopCondition))) {
    return SCOPE_EXPANSION_REASONS.INVALID_STOP_CONDITION;
  }
  return classifyCategoryFields(request);
}

function classifyContext(context) {
  if (!isPlainObject(context) || !hasExactKeys(context, CONTEXT_KEYS)) {
    return SCOPE_EXPANSION_REASONS.INVALID_CONTEXT_SHAPE;
  }
  if (!isNonEmptyString(context.taskId)) return SCOPE_EXPANSION_REASONS.INVALID_TASK_ID;
  if (!isValidPathList(context.authorizedPaths, { allowEmpty: true })) {
    return SCOPE_EXPANSION_REASONS.INVALID_AUTHORIZED_PATHS;
  }
  if (!isNonEmptyString(context.authorityClass)) {
    return SCOPE_EXPANSION_REASONS.INVALID_AUTHORITY_CLASS;
  }
  if (!isNonEmptyString(context.riskTier)) return SCOPE_EXPANSION_REASONS.INVALID_RISK_TIER;
  if (!isNonEmptyString(context.governanceRevision)) {
    return SCOPE_EXPANSION_REASONS.INVALID_GOVERNANCE_REVISION;
  }
  return null;
}

export function canonicalizeScopeExpansionRequest(request) {
  return Object.freeze({
    requestId: request.requestId,
    taskId: request.taskId,
    actorId: request.actorId,
    category: request.category,
    requestedPaths: request.requestedPaths === null
      ? null
      : copyPathList(request.requestedPaths),
    requestedAuthorityClass: request.requestedAuthorityClass,
    requestedRiskTier: request.requestedRiskTier,
    reason: request.reason,
    governanceRevision: request.governanceRevision,
    stopCondition: request.stopCondition,
  });
}

export function canonicalizeScopeExpansionContext(context) {
  return Object.freeze({
    taskId: context.taskId,
    authorizedPaths: copyPathList(context.authorizedPaths),
    authorityClass: context.authorityClass,
    riskTier: context.riskTier,
    governanceRevision: context.governanceRevision,
  });
}

function invalidRequestResult(reason) {
  return freezeDeep({
    valid: false,
    decision: SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST,
    reasons: [reason],
    request: null,
  });
}

function invalidContextResult(reason) {
  return freezeDeep({
    valid: false,
    decision: SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST,
    reasons: [reason],
    context: null,
  });
}

function invalidEvaluationResult(reason) {
  return freezeDeep({
    valid: false,
    decision: SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST,
    reasons: [reason],
    request: null,
    context: null,
    uncoveredPaths: Object.freeze([]),
  });
}

export function validateScopeExpansionRequest(request) {
  const reason = classifyRequest(request);
  if (reason !== null) return invalidRequestResult(reason);
  return freezeDeep({
    valid: true,
    decision: SCOPE_EXPANSION_DECISIONS.WITHIN_SCOPE,
    reasons: [],
    request: canonicalizeScopeExpansionRequest(request),
  });
}

export function validateScopeExpansionContext(context) {
  const reason = classifyContext(context);
  if (reason !== null) return invalidContextResult(reason);
  return freezeDeep({
    valid: true,
    decision: SCOPE_EXPANSION_DECISIONS.WITHIN_SCOPE,
    reasons: [],
    context: canonicalizeScopeExpansionContext(context),
  });
}

function evaluateCategory(request, context) {
  if (request.stopCondition !== null) {
    return freezeDeep({
      valid: true,
      decision: SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED,
      reasons: [SCOPE_EXPANSION_REASONS.STOP_CONDITION_PRESENT],
      request,
      context,
      uncoveredPaths: Object.freeze([]),
    });
  }

  switch (request.category) {
    case 'FILE_SCOPE': {
      const uncovered = uncoverPaths(request.requestedPaths, context.authorizedPaths);
      if (uncovered.length === 0) {
        return freezeDeep({
          valid: true,
          decision: SCOPE_EXPANSION_DECISIONS.WITHIN_SCOPE,
          reasons: [SCOPE_EXPANSION_REASONS.ALL_PATHS_WITHIN_SCOPE],
          request,
          context,
          uncoveredPaths: uncovered,
        });
      }
      return freezeDeep({
        valid: true,
        decision: SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED,
        reasons: [SCOPE_EXPANSION_REASONS.PATH_EXPANSION_REQUIRED],
        request,
        context,
        uncoveredPaths: uncovered,
      });
    }
    case 'PROTECTED_PATH':
      return freezeDeep({
        valid: true,
        decision: SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED,
        reasons: [SCOPE_EXPANSION_REASONS.PROTECTED_PATH_REQUIRES_OWNER],
        request,
        context,
        uncoveredPaths: Object.freeze([]),
      });
    case 'AUTHORITY_CLASS':
      return freezeDeep({
        valid: true,
        decision: SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED,
        reasons: [SCOPE_EXPANSION_REASONS.AUTHORITY_CLASS_REQUIRES_OWNER],
        request,
        context,
        uncoveredPaths: Object.freeze([]),
      });
    case 'RISK_TIER':
      return freezeDeep({
        valid: true,
        decision: SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED,
        reasons: [SCOPE_EXPANSION_REASONS.RISK_TIER_REQUIRES_OWNER],
        request,
        context,
        uncoveredPaths: Object.freeze([]),
      });
    case 'EXTERNAL_ACCESS':
      return freezeDeep({
        valid: true,
        decision: SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED,
        reasons: [SCOPE_EXPANSION_REASONS.EXTERNAL_ACCESS_REQUIRES_OWNER],
        request,
        context,
        uncoveredPaths: Object.freeze([]),
      });
    case 'RUNTIME_OR_DEPLOY':
      return freezeDeep({
        valid: true,
        decision: SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED,
        reasons: [SCOPE_EXPANSION_REASONS.RUNTIME_OR_DEPLOY_REQUIRES_OWNER],
        request,
        context,
        uncoveredPaths: Object.freeze([]),
      });
    default:
      return invalidEvaluationResult(SCOPE_EXPANSION_REASONS.INVALID_CATEGORY);
  }
}

export function evaluateScopeExpansion(request, context) {
  const requestChecked = validateScopeExpansionRequest(request);
  if (!requestChecked.valid) {
    return freezeDeep({
      valid: false,
      decision: SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST,
      reasons: requestChecked.reasons,
      request: null,
      context: null,
      uncoveredPaths: Object.freeze([]),
    });
  }

  const contextChecked = validateScopeExpansionContext(context);
  if (!contextChecked.valid) {
    return freezeDeep({
      valid: false,
      decision: SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST,
      reasons: contextChecked.reasons,
      request: null,
      context: null,
      uncoveredPaths: Object.freeze([]),
    });
  }

  const canonicalRequest = requestChecked.request;
  const canonicalContext = contextChecked.context;

  if (canonicalRequest.taskId !== canonicalContext.taskId) {
    return invalidEvaluationResult(SCOPE_EXPANSION_REASONS.TASK_MISMATCH);
  }
  if (canonicalRequest.governanceRevision !== canonicalContext.governanceRevision) {
    return invalidEvaluationResult(SCOPE_EXPANSION_REASONS.GOVERNANCE_REVISION_MISMATCH);
  }

  return evaluateCategory(canonicalRequest, canonicalContext);
}
