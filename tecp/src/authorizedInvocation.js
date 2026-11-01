/**
 * TECP-DLP-006 disposable AuthorizedInvocation authorization boundary (offline).
 *
 * Architecture Alternative C: pure authorization boundary first.
 * Reuses frozen DLP-005 verifyCapability without modifying it.
 *
 * NON_OPERATIONAL proof-local decision result only.
 * NOT operational execution authority.
 * Does NOT block direct DLP-004 API calls, MCP, Workers, databases or production.
 *
 * Fresh authorizeWorkerOperation() is required for every phase. A previously
 * returned AuthorizedInvocation MUST NOT authorize a later phase by itself.
 */

import {
  isBrandedVerifiedPrincipal,
  TRUST_LEVELS,
  ATTESTATION_KINDS,
} from './workerIdentity.js';
import {
  BOOTSTRAP_ALLOWED_ACTIONS,
  CAPABILITY_ACTIONS,
  CAPABILITY_DECISIONS,
  CAPABILITY_STAGES,
  LEASE_BOUND_ALLOWED_ACTIONS,
  verifyCapability,
} from './workerCapabilityToken.js';
import {
  isBrandedTrustedLeaseSnapshot,
  isBrandedTrustedLeaseSnapshotReader,
  LEASE_SNAPSHOT_DECISIONS,
  matchTrustedLeaseSnapshot,
} from './trustedLeaseSnapshot.js';

/** Approved governance revision for this disposable DLP-006 proof. */
export const APPROVED_GOVERNANCE_REVISION = 'DLP006_AUTHORIZATION_20261101';

export const AUTHORIZATION_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_DEPS: 'DENY_MISSING_DEPS',
  DENY_MALFORMED_REQUEST: 'DENY_MALFORMED_REQUEST',
  DENY_CALLER_EXPECTATION: 'DENY_CALLER_EXPECTATION',
  DENY_INVALID_PRINCIPAL: 'DENY_INVALID_PRINCIPAL',
  DENY_SPOOFED_ACTOR: 'DENY_SPOOFED_ACTOR',
  DENY_POLICY_UNAVAILABLE: 'DENY_POLICY_UNAVAILABLE',
  DENY_UNBRANDED_POLICY: 'DENY_UNBRANDED_POLICY',
  DENY_INVALID_GOVERNANCE_REVISION: 'DENY_INVALID_GOVERNANCE_REVISION',
  DENY_UNKNOWN_OPERATION: 'DENY_UNKNOWN_OPERATION',
  DENY_FORGED_OPERATION_INTENT: 'DENY_FORGED_OPERATION_INTENT',
  DENY_STAGE_VIOLATION: 'DENY_STAGE_VIOLATION',
  DENY_BOOTSTRAP_MUTATION: 'DENY_BOOTSTRAP_MUTATION',
  DENY_UNSUPPORTED_ACTION: 'DENY_UNSUPPORTED_ACTION',
  DENY_LEASE_SNAPSHOT: 'DENY_LEASE_SNAPSHOT',
  DENY_CAPABILITY: 'DENY_CAPABILITY',
  DENY_PRINCIPAL_TOKEN_MISMATCH: 'DENY_PRINCIPAL_TOKEN_MISMATCH',
  DENY_UNBRANDED_INVOCATION: 'DENY_UNBRANDED_INVOCATION',
  DENY_CROSS_PHASE_REUSE: 'DENY_CROSS_PHASE_REUSE',
  DENY_PHASE_MISMATCH: 'DENY_PHASE_MISMATCH',
  DENY_DEPENDENCY_EXCEPTION: 'DENY_DEPENDENCY_EXCEPTION',
  DENY_EXPIRED_AT_ARTIFACT_ISSUANCE: 'DENY_EXPIRED_AT_ARTIFACT_ISSUANCE',
  /** Authenticity-only result — NEVER an authorization grant. */
  ARTIFACT_AUTHENTIC: 'ARTIFACT_AUTHENTIC',
});

const brandedPolicies = new WeakSet();
const brandedPolicyProviders = new WeakSet();
const brandedInvocations = new WeakSet();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function deny(decision, reasons) {
  return Object.freeze({
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    invocation: null,
    capabilityDecision: null,
    leaseDecision: null,
  });
}

function allow(invocation, extra = {}) {
  return Object.freeze({
    allowed: true,
    decision: AUTHORIZATION_DECISIONS.ALLOW,
    reasons: Object.freeze([]),
    invocation,
    capabilityDecision: extra.capabilityDecision || CAPABILITY_DECISIONS.ALLOW,
    leaseDecision: extra.leaseDecision || null,
  });
}

/**
 * Deterministic actorId derivation: actorId === verified principalId.
 * Never accepts a separate caller-supplied identity as authority.
 */
export function deriveActorIdFromPrincipalId(principalId) {
  if (!isNonEmptyString(principalId)) {
    throw new TypeError('principalId required');
  }
  return principalId;
}

function assertTestOnlyPrincipal(principal) {
  if (!isBrandedVerifiedPrincipal(principal)) {
    return 'UNBRANDED_OR_FORGED_PRINCIPAL';
  }
  if (principal.trustLevel !== TRUST_LEVELS.TEST_ATTESTED) {
    return 'UNTRUSTED_TRUST_LEVEL';
  }
  if (principal.attestationKind !== ATTESTATION_KINDS.TEST_ONLY) {
    return 'UNTRUSTED_ATTESTATION_KIND';
  }
  if (principal.osPrincipalAuthenticated === true) {
    return 'OS_AUTH_CLAIM_FORBIDDEN';
  }
  if (principal.realWorkerAuthenticated === true) {
    return 'REAL_WORKER_AUTH_CLAIM_FORBIDDEN';
  }
  if (!isNonEmptyString(principal.principalId)) {
    return 'INVALID_PRINCIPAL_ID';
  }
  return null;
}

function classifyOperation(operation) {
  if (!isPlainObject(operation)) return 'OPERATION_MUST_BE_OBJECT';
  if (!isNonEmptyString(operation.operationKey)) return 'INVALID_OPERATION_KEY';
  if (!isNonEmptyString(operation.capabilityStage)) return 'INVALID_CAPABILITY_STAGE';
  if (!isNonEmptyString(operation.action)) return 'INVALID_ACTION';
  if (!isNonEmptyString(operation.taskId)) return 'INVALID_TASK_ID';
  if (!isNonEmptyString(operation.resourceType)) return 'INVALID_RESOURCE_TYPE';
  if (!isNonEmptyString(operation.resourceId)) return 'INVALID_RESOURCE_ID';
  if (operation.capabilityStage === CAPABILITY_STAGES.BOOTSTRAP_REQUEST) {
    if (operation.action !== CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE) {
      return 'BOOTSTRAP_ACTION_FORBIDDEN';
    }
    if (!BOOTSTRAP_ALLOWED_ACTIONS.includes(operation.action)) {
      return 'BOOTSTRAP_ACTION_NOT_ALLOWLISTED';
    }
  } else if (operation.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND) {
    if (!LEASE_BOUND_ALLOWED_ACTIONS.includes(operation.action)) {
      return 'LEASE_BOUND_ACTION_NOT_ALLOWLISTED';
    }
    if (!isNonEmptyString(operation.leaseId)) return 'LEASE_ID_REQUIRED_FOR_LEASE_BOUND';
  } else {
    return 'UNSUPPORTED_CAPABILITY_STAGE';
  }
  return null;
}

/**
 * Privileged TEST_ONLY policy factory. Brands an immutable policy document.
 * Not a cryptographically authenticated runtime service.
 */
export function createTrustedAuthorizationPolicy(input) {
  if (!isPlainObject(input)) {
    throw new TypeError('trusted policy input required');
  }
  if (input.governanceRevision !== APPROVED_GOVERNANCE_REVISION) {
    throw new TypeError('invalid governance revision for DLP-006 policy');
  }
  if (!isNonEmptyString(input.audience)) {
    throw new TypeError('audience required');
  }
  if (!Array.isArray(input.operations) || input.operations.length === 0) {
    throw new TypeError('operations required');
  }

  const operations = new Map();
  for (const raw of input.operations) {
    const error = classifyOperation(raw);
    if (error) throw new TypeError(`invalid operation: ${error}`);
    if (operations.has(raw.operationKey)) {
      throw new TypeError(`duplicate operationKey: ${raw.operationKey}`);
    }
    const op = Object.freeze({
      operationKey: raw.operationKey,
      capabilityStage: raw.capabilityStage,
      action: raw.action,
      taskId: raw.taskId,
      resourceType: raw.resourceType,
      resourceId: raw.resourceId,
      leaseId: raw.leaseId === undefined ? null : raw.leaseId,
    });
    operations.set(op.operationKey, op);
  }

  const policy = Object.freeze({
    policyKind: 'TEST_ONLY_INJECTED',
    // Explicit non-claim.
    cryptographicallyAuthenticatedService: false,
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    audience: input.audience,
    operations: Object.freeze([...operations.values()]),
    getOperation(operationKey) {
      if (!isNonEmptyString(operationKey)) return null;
      return operations.get(operationKey) || null;
    },
  });
  brandedPolicies.add(policy);
  return policy;
}

export function isBrandedTrustedAuthorizationPolicy(policy) {
  return policy !== null
    && typeof policy === 'object'
    && brandedPolicies.has(policy);
}

/**
 * Injected TEST_ONLY policy provider. Unavailable / unbranded providers FAIL CLOSED.
 */
export function createTrustedAuthorizationPolicyProvider(policyOrFactory) {
  let unavailable = false;
  let policy = null;

  if (typeof policyOrFactory === 'function') {
    // Lazy factory evaluated on getPolicy().
  } else if (isBrandedTrustedAuthorizationPolicy(policyOrFactory)) {
    policy = policyOrFactory;
  } else {
    policy = createTrustedAuthorizationPolicy(policyOrFactory);
  }

  const provider = Object.freeze({
    kind: 'TEST_ONLY_POLICY_PROVIDER',
    cryptographicallyAuthenticatedService: false,
    setUnavailable(flag) {
      unavailable = flag === true;
    },
    getPolicy() {
      if (unavailable) {
        return Object.freeze({ available: false, policy: null });
      }
      let resolved = policy;
      if (typeof policyOrFactory === 'function') {
        try {
          resolved = policyOrFactory();
        } catch {
          return Object.freeze({ available: false, policy: null });
        }
      }
      if (!isBrandedTrustedAuthorizationPolicy(resolved)) {
        return Object.freeze({ available: false, policy: null, unbranded: true });
      }
      return Object.freeze({ available: true, policy: resolved });
    },
  });
  brandedPolicyProviders.add(provider);
  return provider;
}

export function isBrandedTrustedAuthorizationPolicyProvider(provider) {
  return provider !== null
    && typeof provider === 'object'
    && brandedPolicyProviders.has(provider);
}

export function isBrandedAuthorizedInvocation(invocation) {
  return invocation !== null
    && typeof invocation === 'object'
    && brandedInvocations.has(invocation);
}

function brandAuthorizedInvocation(fields) {
  const invocation = Object.freeze({
    artifactKind: 'AUTHORIZED_INVOCATION',
    // Explicit non-claims.
    operationalExecutionAuthority: false,
    realWorkerAuthenticated: false,
    osPrincipalAuthenticated: false,
    persistenceConnected: false,
    principalId: fields.principalId,
    actorId: fields.actorId,
    audience: fields.audience,
    taskId: fields.taskId,
    resourceType: fields.resourceType,
    resourceId: fields.resourceId,
    action: fields.action,
    capabilityStage: fields.capabilityStage,
    jti: fields.jti,
    governanceRevision: fields.governanceRevision,
    operationKey: fields.operationKey,
    leaseId: fields.leaseId,
    fencingEpoch: fields.fencingEpoch,
    authorizedAtMs: fields.authorizedAtMs,
  });
  brandedInvocations.add(invocation);
  return invocation;
}

function rejectCallerAuthorityFields(request) {
  if (!isPlainObject(request)) {
    return deny(AUTHORIZATION_DECISIONS.DENY_MALFORMED_REQUEST, ['REQUEST_REQUIRED']);
  }
  // Caller-supplied expectation is never authorization authority.
  if (Object.prototype.hasOwnProperty.call(request, 'expectation')) {
    return deny(AUTHORIZATION_DECISIONS.DENY_CALLER_EXPECTATION, [
      'CALLER_EXPECTATION_NOT_AUTHORITY',
    ]);
  }
  if (Object.prototype.hasOwnProperty.call(request, 'serverExpectation')) {
    return deny(AUTHORIZATION_DECISIONS.DENY_CALLER_EXPECTATION, [
      'CALLER_SUPPLIED_SERVER_EXPECTATION_FORBIDDEN',
    ]);
  }
  return null;
}

function buildServerExpectation(policy, operation, principal, leaseSnapshot) {
  const expectation = {
    audience: policy.audience,
    taskId: operation.taskId,
    resourceType: operation.resourceType,
    resourceId: operation.resourceId,
    // From verified branded principal — NEVER from decoded unverified token claims.
    principalId: principal.principalId,
    action: operation.action,
    capabilityStage: operation.capabilityStage,
  };
  if (operation.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND) {
    expectation.leaseContext = Object.freeze({
      leaseId: leaseSnapshot.leaseId,
      fencingEpoch: leaseSnapshot.fencingEpoch,
    });
  }
  return Object.freeze(expectation);
}

/**
 * Authorize one proposed Worker operation.
 *
 * Fresh verification is required for every call / phase. Do not reuse a prior
 * AuthorizedInvocation as authority for a different operationKey or stage.
 *
 * @param {object} request
 * @param {string} request.capabilityToken signed DLP-005 capability token
 * @param {string} request.operationKey key into trusted policy allowlist
 * @param {object} request.principal branded TEST_ONLY verified principal
 * @param {object} deps
 * @param {object} deps.policyProvider branded trusted policy provider
 * @param {object} deps.capabilityDeps DLP-005 verifyCapability deps
 * @param {object} [deps.leaseSnapshotReader] required for LEASE_BOUND
 */
export function authorizeWorkerOperation(request, deps) {
  const callerReject = rejectCallerAuthorityFields(request);
  if (callerReject) return callerReject;

  if (!isPlainObject(deps)
    || !isBrandedTrustedAuthorizationPolicyProvider(deps.policyProvider)
    || !isPlainObject(deps.capabilityDeps)) {
    return deny(AUTHORIZATION_DECISIONS.DENY_MISSING_DEPS, ['TRUSTED_DEPS_REQUIRED']);
  }

  if (!isNonEmptyString(request.capabilityToken)) {
    return deny(AUTHORIZATION_DECISIONS.DENY_MALFORMED_REQUEST, ['CAPABILITY_TOKEN_REQUIRED']);
  }
  if (!isNonEmptyString(request.operationKey)) {
    return deny(AUTHORIZATION_DECISIONS.DENY_MALFORMED_REQUEST, ['OPERATION_KEY_REQUIRED']);
  }

  const principalError = assertTestOnlyPrincipal(request.principal);
  if (principalError) {
    return deny(AUTHORIZATION_DECISIONS.DENY_INVALID_PRINCIPAL, [principalError]);
  }
  const principal = request.principal;
  const actorId = deriveActorIdFromPrincipalId(principal.principalId);

  // Spoofed caller actorId/workerId that disagrees with derived identity DENY.
  if (Object.prototype.hasOwnProperty.call(request, 'actorId')) {
    if (request.actorId !== actorId) {
      return deny(AUTHORIZATION_DECISIONS.DENY_SPOOFED_ACTOR, ['CALLER_ACTOR_ID_MISMATCH']);
    }
  }
  if (Object.prototype.hasOwnProperty.call(request, 'workerId')) {
    if (request.workerId !== actorId) {
      return deny(AUTHORIZATION_DECISIONS.DENY_SPOOFED_ACTOR, ['CALLER_WORKER_ID_MISMATCH']);
    }
  }

  // Optional forged operationIntent overlay: if present, must exactly match policy op.
  const hasForgedIntent = Object.prototype.hasOwnProperty.call(request, 'operationIntent');

  let policyResult;
  try {
    policyResult = deps.policyProvider.getPolicy();
  } catch {
    return deny(AUTHORIZATION_DECISIONS.DENY_POLICY_UNAVAILABLE, ['POLICY_PROVIDER_THREW']);
  }
  if (!policyResult || policyResult.available !== true || !policyResult.policy) {
    if (policyResult && policyResult.unbranded === true) {
      return deny(AUTHORIZATION_DECISIONS.DENY_UNBRANDED_POLICY, ['UNBRANDED_POLICY']);
    }
    return deny(AUTHORIZATION_DECISIONS.DENY_POLICY_UNAVAILABLE, ['POLICY_UNAVAILABLE']);
  }
  const policy = policyResult.policy;
  if (!isBrandedTrustedAuthorizationPolicy(policy)) {
    return deny(AUTHORIZATION_DECISIONS.DENY_UNBRANDED_POLICY, ['POLICY_NOT_BRANDED']);
  }
  if (policy.governanceRevision !== APPROVED_GOVERNANCE_REVISION) {
    return deny(AUTHORIZATION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION, [
      'GOVERNANCE_REVISION_MISMATCH',
    ]);
  }

  const operation = policy.getOperation(request.operationKey);
  if (!operation) {
    return deny(AUTHORIZATION_DECISIONS.DENY_UNKNOWN_OPERATION, ['OPERATION_NOT_IN_POLICY']);
  }

  if (hasForgedIntent) {
    const intent = request.operationIntent;
    if (!isPlainObject(intent)
      || intent.operationKey !== operation.operationKey
      || intent.capabilityStage !== operation.capabilityStage
      || intent.action !== operation.action
      || intent.taskId !== operation.taskId
      || intent.resourceType !== operation.resourceType
      || intent.resourceId !== operation.resourceId
      || (operation.leaseId != null && intent.leaseId !== operation.leaseId)) {
      return deny(AUTHORIZATION_DECISIONS.DENY_FORGED_OPERATION_INTENT, [
        'OPERATION_INTENT_DOES_NOT_MATCH_TRUSTED_POLICY',
      ]);
    }
  }

  // Two-stage enforcement (defense in depth beyond policy classify).
  if (operation.capabilityStage === CAPABILITY_STAGES.BOOTSTRAP_REQUEST) {
    if (operation.action !== CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE
      || !BOOTSTRAP_ALLOWED_ACTIONS.includes(operation.action)) {
      return deny(AUTHORIZATION_DECISIONS.DENY_BOOTSTRAP_MUTATION, [
        'BOOTSTRAP_CANNOT_AUTHORIZE_MUTATION_OR_EVIDENCE',
      ]);
    }
  } else if (operation.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND) {
    if (BOOTSTRAP_ALLOWED_ACTIONS.includes(operation.action)
      || !LEASE_BOUND_ALLOWED_ACTIONS.includes(operation.action)) {
      return deny(AUTHORIZATION_DECISIONS.DENY_UNSUPPORTED_ACTION, [
        'LEASE_BOUND_ACTION_NOT_ALLOWLISTED',
      ]);
    }
  } else {
    return deny(AUTHORIZATION_DECISIONS.DENY_STAGE_VIOLATION, ['UNSUPPORTED_STAGE']);
  }

  let leaseSnapshot = null;
  let leaseDecision = null;
  if (operation.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND) {
    if (!isBrandedTrustedLeaseSnapshotReader(deps.leaseSnapshotReader)) {
      return deny(AUTHORIZATION_DECISIONS.DENY_LEASE_SNAPSHOT, [
        'TRUSTED_LEASE_READER_REQUIRED',
      ]);
    }
    let snapResult;
    try {
      snapResult = deps.leaseSnapshotReader.read(
        { leaseId: operation.leaseId },
        deps.capabilityDeps.clock,
      );
    } catch {
      return deny(AUTHORIZATION_DECISIONS.DENY_DEPENDENCY_EXCEPTION, [
        'LEASE_READER_THREW',
      ]);
    }
    leaseDecision = snapResult ? snapResult.decision : null;
    if (!snapResult || !snapResult.allowed || !isBrandedTrustedLeaseSnapshot(snapResult.snapshot)) {
      return Object.freeze({
        allowed: false,
        decision: AUTHORIZATION_DECISIONS.DENY_LEASE_SNAPSHOT,
        reasons: Object.freeze([
          (snapResult && snapResult.decision)
            || LEASE_SNAPSHOT_DECISIONS.DENY_READER_UNAVAILABLE,
          ...((snapResult && snapResult.reasons) || []),
        ]),
        invocation: null,
        capabilityDecision: null,
        leaseDecision: snapResult ? snapResult.decision : null,
      });
    }
    leaseSnapshot = snapResult.snapshot;

    // Complete match context — fencingEpoch mandatory; omitted fields are not wildcards.
    const match = matchTrustedLeaseSnapshot(leaseSnapshot, {
      leaseId: operation.leaseId,
      taskId: operation.taskId,
      resourceType: operation.resourceType,
      resourceId: operation.resourceId,
      ownerPrincipalId: principal.principalId,
      ownerActorId: actorId,
      fencingEpoch: leaseSnapshot.fencingEpoch,
    });
    if (!match.allowed) {
      return Object.freeze({
        allowed: false,
        decision: AUTHORIZATION_DECISIONS.DENY_LEASE_SNAPSHOT,
        reasons: Object.freeze([match.decision, ...(match.reasons || [])]),
        invocation: null,
        capabilityDecision: null,
        leaseDecision: match.decision,
      });
    }
  }

  // Server-built expectation only. Never pass caller expectation through.
  const serverExpectation = buildServerExpectation(
    policy,
    operation,
    principal,
    leaseSnapshot,
  );

  let verified;
  try {
    verified = verifyCapability(
      request.capabilityToken,
      serverExpectation,
      deps.capabilityDeps,
    );
  } catch {
    return deny(AUTHORIZATION_DECISIONS.DENY_DEPENDENCY_EXCEPTION, [
      'CAPABILITY_VERIFY_THREW',
    ]);
  }
  if (!verified || !verified.allowed) {
    return Object.freeze({
      allowed: false,
      decision: AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
      reasons: Object.freeze([
        (verified && verified.decision) || CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE,
        ...((verified && verified.reasons) || []),
      ]),
      invocation: null,
      capabilityDecision: verified ? verified.decision : null,
      leaseDecision,
    });
  }

  const claims = verified.claims;
  if (!claims
    || claims.principalId !== principal.principalId
    || claims.principalGeneration !== principal.principalGeneration) {
    return deny(AUTHORIZATION_DECISIONS.DENY_PRINCIPAL_TOKEN_MISMATCH, [
      'VERIFIED_PRINCIPAL_TOKEN_MISMATCH',
    ]);
  }

  // Post-verify clock + expiry recheck before artifact issuance (fail closed on throw).
  let nowMs;
  try {
    if (!deps.capabilityDeps.clock || typeof deps.capabilityDeps.clock.now !== 'function') {
      return deny(AUTHORIZATION_DECISIONS.DENY_DEPENDENCY_EXCEPTION, [
        'CLOCK_REQUIRED_AFTER_VERIFY',
      ]);
    }
    const clock = deps.capabilityDeps.clock.now();
    if (!clock || clock.available !== true || !isSafeInteger(clock.nowMs)) {
      return deny(AUTHORIZATION_DECISIONS.DENY_DEPENDENCY_EXCEPTION, [
        'CLOCK_UNAVAILABLE_AFTER_VERIFY',
      ]);
    }
    nowMs = clock.nowMs;
  } catch {
    return deny(AUTHORIZATION_DECISIONS.DENY_DEPENDENCY_EXCEPTION, [
      'CLOCK_THREW_AFTER_VERIFY',
    ]);
  }

  if (!isSafeInteger(claims.exp) || nowMs >= claims.exp) {
    return deny(AUTHORIZATION_DECISIONS.DENY_EXPIRED_AT_ARTIFACT_ISSUANCE, [
      'CAPABILITY_EXPIRED_AT_ARTIFACT_ISSUANCE',
    ]);
  }

  const invocation = brandAuthorizedInvocation({
    principalId: principal.principalId,
    actorId,
    audience: policy.audience,
    taskId: operation.taskId,
    resourceType: operation.resourceType,
    resourceId: operation.resourceId,
    action: operation.action,
    capabilityStage: operation.capabilityStage,
    jti: claims.jti,
    governanceRevision: policy.governanceRevision,
    operationKey: operation.operationKey,
    leaseId: leaseSnapshot ? leaseSnapshot.leaseId : null,
    fencingEpoch: leaseSnapshot ? leaseSnapshot.fencingEpoch : null,
    authorizedAtMs: nowMs,
  });

  return allow(invocation, {
    capabilityDecision: verified.decision,
    leaseDecision,
  });
}

/**
 * Prove that a prior AuthorizedInvocation cannot authorize a different phase/operation
 * without a fresh authorizeWorkerOperation call. Always DENY when used as authority.
 */
export function rejectPriorAuthorizationReuse(priorInvocation, nextOperationKey) {
  if (!isBrandedAuthorizedInvocation(priorInvocation)) {
    return deny(AUTHORIZATION_DECISIONS.DENY_UNBRANDED_INVOCATION, [
      'PRIOR_INVOCATION_NOT_BRANDED',
    ]);
  }
  if (!isNonEmptyString(nextOperationKey)) {
    return deny(AUTHORIZATION_DECISIONS.DENY_MALFORMED_REQUEST, ['NEXT_OPERATION_KEY_REQUIRED']);
  }
  if (nextOperationKey === priorInvocation.operationKey
    && priorInvocation.capabilityStage === CAPABILITY_STAGES.BOOTSTRAP_REQUEST) {
    // Even same-key bootstrap artifacts are NOT standing authority for a later phase.
    return deny(AUTHORIZATION_DECISIONS.DENY_CROSS_PHASE_REUSE, [
      'PRIOR_AUTHORIZATION_NOT_STANDING_AUTHORITY',
    ]);
  }
  if (nextOperationKey !== priorInvocation.operationKey) {
    return deny(AUTHORIZATION_DECISIONS.DENY_CROSS_PHASE_REUSE, [
      'PRIOR_AUTHORIZATION_CANNOT_AUTHORIZE_DIFFERENT_OPERATION',
    ]);
  }
  return deny(AUTHORIZATION_DECISIONS.DENY_CROSS_PHASE_REUSE, [
    'FRESH_AUTHORIZE_WORKER_OPERATION_REQUIRED',
  ]);
}

/**
 * Inspect proof-local artifact authenticity ONLY.
 *
 * A branded AuthorizedInvocation proves provenance, NOT standing authorization.
 * This API NEVER returns an authorization grant (allowed is always false).
 * Fresh authorizeWorkerOperation() is required for every authorization decision.
 *
 * @returns {{
 *   authentic: boolean,
 *   allowed: false,
 *   authorizationGranted: false,
 *   decision: string,
 *   reasons: string[],
 *   invocation: object|null,
 * }}
 */
export function assertBrandedAuthorizedInvocation(candidate) {
  if (!isBrandedAuthorizedInvocation(candidate)) {
    return Object.freeze({
      authentic: false,
      // Never an authorization ALLOW — authenticity check is not authority.
      allowed: false,
      authorizationGranted: false,
      decision: AUTHORIZATION_DECISIONS.DENY_UNBRANDED_INVOCATION,
      reasons: Object.freeze(['FORGED_OR_COPIED_AUTHORIZED_INVOCATION']),
      invocation: null,
      capabilityDecision: null,
      leaseDecision: null,
    });
  }
  return Object.freeze({
    authentic: true,
    allowed: false,
    authorizationGranted: false,
    decision: AUTHORIZATION_DECISIONS.ARTIFACT_AUTHENTIC,
    reasons: Object.freeze([
      'ARTIFACT_PROVENANCE_ONLY',
      'FRESH_AUTHORIZE_WORKER_OPERATION_REQUIRED_FOR_AUTHORIZATION',
    ]),
    invocation: candidate,
    capabilityDecision: null,
    leaseDecision: null,
  });
}
