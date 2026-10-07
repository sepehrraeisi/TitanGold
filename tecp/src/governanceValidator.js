/**
 * TECP-006 governance validator.
 *
 * Consumes structured parseRule02 output only. Does not parse raw Rule02
 * and does not create authorization.
 *
 * Fail-closed decision precedence:
 * 1. DENY_MISSING_GOVERNANCE_FACT
 * 2. DENY_NOT_AUTHORIZED
 * 3. DENY_SLICE_MISMATCH
 * 4. DENY_AUTHORITY_CLASS_MISMATCH
 * 5. DENY_RISK_TIER_MISMATCH
 * 6. DENY_DEPLOY
 * 7. DENY_PRODUCTION_MUTATION
 * 8. DENY_PROTECTED_PATH
 * 9. DENY_PATH_OUT_OF_SCOPE
 * 10. DENY_STOP_CONDITION
 * 11. ALLOW
 */

export const GOVERNANCE_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_NOT_AUTHORIZED: 'DENY_NOT_AUTHORIZED',
  DENY_SLICE_MISMATCH: 'DENY_SLICE_MISMATCH',
  DENY_AUTHORITY_CLASS_MISMATCH: 'DENY_AUTHORITY_CLASS_MISMATCH',
  DENY_RISK_TIER_MISMATCH: 'DENY_RISK_TIER_MISMATCH',
  DENY_PATH_OUT_OF_SCOPE: 'DENY_PATH_OUT_OF_SCOPE',
  DENY_PROTECTED_PATH: 'DENY_PROTECTED_PATH',
  DENY_STOP_CONDITION: 'DENY_STOP_CONDITION',
  DENY_DEPLOY: 'DENY_DEPLOY',
  DENY_PRODUCTION_MUTATION: 'DENY_PRODUCTION_MUTATION',
  DENY_MISSING_GOVERNANCE_FACT: 'DENY_MISSING_GOVERNANCE_FACT',
});

/**
 * Exact operation-class vocabulary. Unknown values fail closed.
 * IMPLEMENT triggers no stop-condition token.
 * Every other class triggers the stop token of the same name, and only
 * when that token is present in the active stopConditions list.
 */
export const OPERATION_CLASSES = Object.freeze({
  IMPLEMENT: 'IMPLEMENT',
  RAW_RULE02_PARSE: 'RAW_RULE02_PARSE',
  PARSER_SOURCE_MUTATION: 'PARSER_SOURCE_MUTATION',
  PACKAGE_CHANGE: 'PACKAGE_CHANGE',
  FIXTURE_CHANGE: 'FIXTURE_CHANGE',
  BACKEND_CHANGE: 'BACKEND_CHANGE',
  DB: 'DB',
  NETWORK: 'NETWORK',
  GITHUB: 'GITHUB',
  LINEAR: 'LINEAR',
  DEPLOY: 'DEPLOY',
  PRODUCTION_MUTATION: 'PRODUCTION_MUTATION',
  RULE02_WRITE: 'RULE02_WRITE',
  RUNTIME: 'RUNTIME',
  CREDENTIAL_READ: 'CREDENTIAL_READ',
  TASK_MUTATION: 'TASK_MUTATION',
  LEASE_ISSUANCE: 'LEASE_ISSUANCE',
  CONFLICT_RESOLUTION: 'CONFLICT_RESOLUTION',
  SELF_AUTHORIZATION: 'SELF_AUTHORIZATION',
  TECP007_PLUS: 'TECP007_PLUS',
  SECOND_PARSER_OWNER: 'SECOND_PARSER_OWNER',
  EXTERNAL_DEPENDENCY_REQUIRED: 'EXTERNAL_DEPENDENCY_REQUIRED',
});

const EFFECTIVE_IMPLEMENTATION_AUTHORIZATION =
  'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES';

const REQUEST_FIELDS = Object.freeze([
  'sliceId',
  'authorityClass',
  'riskTier',
  'requestedPaths',
  'operationClass',
  'requiresDeploy',
  'requiresProductionMutation',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function copyStringArray(value) {
  return Object.freeze(value.slice());
}

function decision(code, reasons, matchedFacts, request) {
  return Object.freeze({
    allowed: code === GOVERNANCE_DECISIONS.ALLOW,
    decision: code,
    reasons: Object.freeze(reasons.slice()),
    matchedFacts: Object.freeze(matchedFacts),
    request,
  });
}

function deny(code, reasons, facts, request) {
  return decision(code, reasons, facts, request);
}

/**
 * Path matching does not normalize `..` and does not resolve absolute paths.
 * A `..` segment can never become an authorized path.
 *
 * Supported patterns:
 * - exact string
 * - directory scope ending in `/` (the directory token itself and descendants)
 * - glob-like `**` suffix of the form `name/**` (the directory and descendants)
 */
function pathHasDotDot(pathValue) {
  return pathValue.split('/').includes('..');
}

function matchesPattern(pathValue, pattern) {
  if (pattern.endsWith('/**')) {
    const root = pattern.slice(0, -3);
    return pathValue === root || pathValue.startsWith(`${root}/`);
  }
  if (pattern.endsWith('/')) {
    return pathValue === pattern || pathValue.startsWith(pattern);
  }
  return pathValue === pattern;
}

function classifyPath(pathValue, protectedPaths, authorizedFileScope) {
  if (!isNonEmptyString(pathValue) || pathValue.includes('\0') || pathValue.includes('\\')) {
    return {
      code: GOVERNANCE_DECISIONS.DENY_PATH_OUT_OF_SCOPE,
      reason: `PATH_REJECTED:${String(pathValue)}`,
    };
  }
  const protectedHit = protectedPaths.find((pattern) => matchesPattern(pathValue, pattern));
  if (protectedHit) {
    return {
      code: GOVERNANCE_DECISIONS.DENY_PROTECTED_PATH,
      reason: `PROTECTED_PATH:${pathValue}`,
    };
  }
  if (pathHasDotDot(pathValue) || pathValue.startsWith('/')) {
    return {
      code: GOVERNANCE_DECISIONS.DENY_PATH_OUT_OF_SCOPE,
      reason: `PATH_REJECTED:${pathValue}`,
    };
  }
  const authorized = authorizedFileScope.some((pattern) => matchesPattern(pathValue, pattern));
  if (!authorized) {
    return {
      code: GOVERNANCE_DECISIONS.DENY_PATH_OUT_OF_SCOPE,
      reason: `PATH_OUT_OF_SCOPE:${pathValue}`,
    };
  }
  return null;
}

function triggeredStopToken(operationClass) {
  if (operationClass === OPERATION_CLASSES.IMPLEMENT) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(OPERATION_CLASSES, operationClass)
    && OPERATION_CLASSES[operationClass] === operationClass) {
    return operationClass;
  }
  return undefined;
}

function readFacts(parsedRule02) {
  const missing = [];
  if (!isPlainObject(parsedRule02)) {
    return { missing: ['parsedRule02'] };
  }
  const tecp = parsedRule02.tecp;
  const authority = parsedRule02.authority;
  const facts = parsedRule02.governanceFacts;
  const lifecycle = parsedRule02.lifecyclePrecedence;
  const awp = isPlainObject(authority) ? authority.activeWorkPackage : null;
  const authState = isPlainObject(tecp) ? tecp.implementationAuthorizationState : null;

  if (!isPlainObject(tecp) || !isNonEmptyString(tecp.TECP_AUTHORIZED_SLICE)) {
    missing.push('tecp.TECP_AUTHORIZED_SLICE');
  }
  if (!isPlainObject(awp) || !isNonEmptyString(awp.sliceId)) {
    missing.push('authority.activeWorkPackage.sliceId');
  }
  if (!isPlainObject(facts)) {
    missing.push('governanceFacts');
  } else {
    if (!isNonEmptyString(facts.riskTier)) missing.push('governanceFacts.riskTier');
    if (!isNonEmptyString(facts.authorityClass)) missing.push('governanceFacts.authorityClass');
    if (!isStringArray(facts.authorizedFileScope) || facts.authorizedFileScope.length === 0) {
      missing.push('governanceFacts.authorizedFileScope');
    } else if (facts.authorizedFileScope.some((entry) => entry.length === 0)) {
      missing.push('governanceFacts.authorizedFileScope');
    }
    if (!isStringArray(facts.protectedPaths)) missing.push('governanceFacts.protectedPaths');
    if (!isStringArray(facts.stopConditions)) missing.push('governanceFacts.stopConditions');
  }
  if (!isPlainObject(authState) || !isNonEmptyString(authState.activeWorkPackage)) {
    missing.push('implementationAuthorizationState.activeWorkPackage');
  }
  if (!isPlainObject(lifecycle) || !isNonEmptyString(lifecycle.rawImplementationAuthorization)) {
    missing.push('lifecyclePrecedence.rawImplementationAuthorization');
  }
  if (missing.length > 0) {
    return { missing };
  }
  if (tecp.TECP_AUTHORIZED_SLICE !== awp.sliceId) {
    return { missing: ['ACTIVE_SLICE_IDENTITY_CONFLICT'] };
  }
  if (authState.activeWorkPackage !== lifecycle.rawImplementationAuthorization) {
    return { missing: ['IMPLEMENTATION_AUTHORIZATION_CONFLICT'] };
  }
  return {
    missing: [],
    sliceId: awp.sliceId,
    authorityClass: facts.authorityClass,
    riskTier: facts.riskTier,
    authorizedFileScope: facts.authorizedFileScope,
    protectedPaths: facts.protectedPaths,
    stopConditions: facts.stopConditions,
    implementationAuthorization: authState.activeWorkPackage,
  };
}

function readRequest(request) {
  const missing = [];
  if (!isPlainObject(request)) {
    return { missing: ['request'] };
  }
  for (const field of REQUEST_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(request, field)) {
      missing.push(`request.${field}`);
    }
  }
  if (missing.length > 0) return { missing };
  if (!isNonEmptyString(request.sliceId)) missing.push('request.sliceId');
  if (!isNonEmptyString(request.authorityClass)) missing.push('request.authorityClass');
  if (!isNonEmptyString(request.riskTier)) missing.push('request.riskTier');
  if (!isStringArray(request.requestedPaths)) missing.push('request.requestedPaths');
  if (!isNonEmptyString(request.operationClass)) missing.push('request.operationClass');
  if (typeof request.requiresDeploy !== 'boolean') missing.push('request.requiresDeploy');
  if (typeof request.requiresProductionMutation !== 'boolean') {
    missing.push('request.requiresProductionMutation');
  }
  return { missing, request };
}

function matchedFrom(facts) {
  return {
    sliceId: facts.sliceId,
    authorityClass: facts.authorityClass,
    riskTier: facts.riskTier,
    implementationAuthorization: facts.implementationAuthorization,
    authorizedFileScope: copyStringArray(facts.authorizedFileScope),
    protectedPaths: copyStringArray(facts.protectedPaths),
    stopConditions: copyStringArray(facts.stopConditions),
  };
}

function emptyFacts() {
  return {
    sliceId: null,
    authorityClass: null,
    riskTier: null,
    implementationAuthorization: null,
    authorizedFileScope: Object.freeze([]),
    protectedPaths: Object.freeze([]),
    stopConditions: Object.freeze([]),
  };
}

/**
 * @param {object} parsedRule02 structured output of parseRule02
 * @param {object} request implementation request
 * @returns {{allowed: boolean, decision: string, reasons: string[], matchedFacts: object, request: object}}
 */
export function validateGovernance(parsedRule02, request) {
  const requestCopy = isPlainObject(request) ? structuredClone(request) : request;
  const requestFacts = readRequest(request);
  if (requestFacts.missing.length > 0) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_MISSING_GOVERNANCE_FACT,
      requestFacts.missing,
      emptyFacts(),
      requestCopy,
    );
  }

  const factsResult = readFacts(parsedRule02);
  if (factsResult.missing.length > 0) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_MISSING_GOVERNANCE_FACT,
      factsResult.missing,
      emptyFacts(),
      requestCopy,
    );
  }

  const facts = matchedFrom(factsResult);

  if (factsResult.implementationAuthorization !== EFFECTIVE_IMPLEMENTATION_AUTHORIZATION) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_NOT_AUTHORIZED,
      ['IMPLEMENTATION_AUTHORIZATION_NOT_EFFECTIVE'],
      facts,
      requestCopy,
    );
  }

  if (request.sliceId !== factsResult.sliceId) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_SLICE_MISMATCH,
      [`SLICE_MISMATCH:${request.sliceId}`],
      facts,
      requestCopy,
    );
  }

  if (request.authorityClass !== factsResult.authorityClass) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_AUTHORITY_CLASS_MISMATCH,
      [`AUTHORITY_CLASS_MISMATCH:${request.authorityClass}`],
      facts,
      requestCopy,
    );
  }

  if (request.riskTier !== factsResult.riskTier) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_RISK_TIER_MISMATCH,
      [`RISK_TIER_MISMATCH:${request.riskTier}`],
      facts,
      requestCopy,
    );
  }

  if (request.requiresDeploy === true) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_DEPLOY,
      ['DEPLOY_NOT_AUTHORIZED'],
      facts,
      requestCopy,
    );
  }

  if (request.requiresProductionMutation === true) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_PRODUCTION_MUTATION,
      ['PRODUCTION_MUTATION_NOT_AUTHORIZED'],
      facts,
      requestCopy,
    );
  }

  for (const pathValue of request.requestedPaths) {
    const pathDecision = classifyPath(
      pathValue,
      factsResult.protectedPaths,
      factsResult.authorizedFileScope,
    );
    if (pathDecision) {
      return deny(pathDecision.code, [pathDecision.reason], facts, requestCopy);
    }
  }

  const stopToken = triggeredStopToken(request.operationClass);
  if (stopToken === undefined) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_STOP_CONDITION,
      [`UNSUPPORTED_OPERATION_CLASS:${request.operationClass}`],
      facts,
      requestCopy,
    );
  }
  if (stopToken !== null && factsResult.stopConditions.includes(stopToken)) {
    return deny(
      GOVERNANCE_DECISIONS.DENY_STOP_CONDITION,
      [`STOP_CONDITION:${stopToken}`],
      facts,
      requestCopy,
    );
  }

  return decision(GOVERNANCE_DECISIONS.ALLOW, ['AUTHORIZED_EXACT_SLICE'], facts, requestCopy);
}
