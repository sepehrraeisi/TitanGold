/**
 * TECP-OPS-PILOT-001 CP2-I — offline TEST_ONLY composition.
 *
 * Verifies CP1 principal / Owner-approval / capability against intended
 * operational mutations as an OFFLINE CONTRACT ONLY.
 *
 * Option B (HQA-02): NON_DISPATCH. This gate must not invoke frozen DLP-004
 * bind/release ports, constructor-injected persistence ports, client.query, or
 * caller-supplied work callbacks. Durable persistence requires a separately
 * governed CP2-DB / operational authorization.
 *
 * Does not prove durable DB atomicity, fencing, crash recovery, privilege
 * isolation, exactly-once semantics, or signed DLP resource/lease authority.
 *
 * Never accepts caller-supplied verifiers, trust anchors, key registries or
 * privileged issuers as execution authority.
 */

import {
  CAPABILITY_DECISIONS,
  verifyCapability,
} from '../../tecp-ops/src/operationalCapabilityIssuer.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP004_GOVERNANCE_REVISION,
  LIFECYCLE_DECISIONS,
} from '../../tecp-persistence/src/taskClaimLeaseAuditRepository.js';

export const CP2_I_CHECKPOINT = 'CP2-I';
export const CP2_I_MODE = 'OFFLINE_TEST_ONLY_NON_OPERATIONAL';
export const CP2_I_SLICE_ID = 'TECP-OPS-PILOT-001-CONTROLLED-ONE-TO-FIVE-CURSOR';
export const CP2_I_REPOSITORY_ID = 'sepehrraeisi/TitanGold';

/** Exact seven CP2-I NEW paths. Upper bound for this checkpoint. */
export const CP2_I_PATHS = Object.freeze([
  'tecp-ops-persistence/package.json',
  'tecp-ops-persistence/package-lock.json',
  'tecp-ops-persistence/src/operationalTaskLeaseAuditRepository.js',
  'tecp-ops-persistence/src/nonProdDbHarness.js',
  'tecp-ops-persistence/test/operationalTaskLeaseAuditRepository.test.js',
  'tecp-ops-persistence/test/disposableOpsPilotSchema.sql',
  'tecp-ops-persistence/test/fencingConcurrency.test.js',
]);

export const CP2_I_ACTIONS = Object.freeze({
  BIND_TASK_CLAIM_LEASE_WITH_AUDIT: 'CP2_I_BIND_TASK_CLAIM_LEASE_WITH_AUDIT',
  RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT: 'CP2_I_RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT',
});

export const CP2_I_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  OFFLINE_CONTRACT_ONLY: 'OFFLINE_CONTRACT_ONLY',
  DENY_MISSING_PRIVILEGED_TRUST: 'DENY_MISSING_PRIVILEGED_TRUST',
  DENY_CALLER_TRUST_ANCHOR: 'DENY_CALLER_TRUST_ANCHOR',
  DENY_CALLER_VERIFIER: 'DENY_CALLER_VERIFIER',
  DENY_CALLER_KEY_REGISTRY: 'DENY_CALLER_KEY_REGISTRY',
  DENY_CALLER_PERSISTENCE_PORT: 'DENY_CALLER_PERSISTENCE_PORT',
  DENY_CONSTRUCTOR_PERSISTENCE_INJECTION: 'DENY_CONSTRUCTOR_PERSISTENCE_INJECTION',
  DENY_OPERATIONAL_WORK_CALLBACK: 'DENY_OPERATIONAL_WORK_CALLBACK',
  DENY_MISSING_CAPABILITY: 'DENY_MISSING_CAPABILITY',
  DENY_CAPABILITY: 'DENY_CAPABILITY',
  DENY_WRONG_PRINCIPAL: 'DENY_WRONG_PRINCIPAL',
  DENY_WRONG_TASK: 'DENY_WRONG_TASK',
  DENY_WRONG_RESOURCE: 'DENY_WRONG_RESOURCE',
  DENY_WRONG_ACTION: 'DENY_WRONG_ACTION',
  DENY_MISSING_OWNER_APPROVAL: 'DENY_MISSING_OWNER_APPROVAL',
  DENY_SCOPE_ESCAPE: 'DENY_SCOPE_ESCAPE',
  DENY_INVALID_INPUT: 'DENY_INVALID_INPUT',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
  DENY_SOFT_MUTATION_BLOCKED: 'DENY_SOFT_MUTATION_BLOCKED',
  DENY_NESTED_PUBLIC_TXN_FORBIDDEN: 'DENY_NESTED_PUBLIC_TXN_FORBIDDEN',
  DENY_PERSISTENCE_TASK_MISMATCH: 'DENY_PERSISTENCE_TASK_MISMATCH',
  DENY_PERSISTENCE_ACTOR_MISMATCH: 'DENY_PERSISTENCE_ACTOR_MISMATCH',
  DENY_PERSISTENCE_ACTION_MISMATCH: 'DENY_PERSISTENCE_ACTION_MISMATCH',
  DENY_PERSISTENCE_AUDIT_MISMATCH: 'DENY_PERSISTENCE_AUDIT_MISMATCH',
  DENY_PERSISTENCE_EVIDENCE_MISMATCH: 'DENY_PERSISTENCE_EVIDENCE_MISMATCH',
  DENY_MISSING_CLAIM_LEASE_BINDING: 'DENY_MISSING_CLAIM_LEASE_BINDING',
  DENY_PERSISTENCE_CLAIM_LEASE_MISMATCH: 'DENY_PERSISTENCE_CLAIM_LEASE_MISMATCH',
});

const privilegedGateBrand = new WeakSet();
const authorizedInvocationBrand = new WeakSet();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
  }
  return value;
}

function deny(decision, reasons = [], extra = {}) {
  return freezeDeep({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    classification: 'CP2_I_OFFLINE_DENY / NOT_EXECUTION_AUTHORITY',
    ...extra,
  });
}

function allowAuthz(extra) {
  const result = freezeDeep({
    ok: true,
    allowed: true,
    decision: CP2_I_DECISIONS.ALLOW,
    reasons: Object.freeze(['CP2_I_CAPABILITY_VERIFIED_TEST_ONLY']),
    classification: 'CP2_I_OFFLINE_TEST_ONLY / NOT_EXECUTION_AUTHORITY',
    ...extra,
  });
  authorizedInvocationBrand.add(result);
  return result;
}

export function isBrandedCp2IAuthorizedInvocation(value) {
  return authorizedInvocationBrand.has(value);
}

export function isPrivilegedOperationalCompositionGate(value) {
  return privilegedGateBrand.has(value);
}

/**
 * Reject any attempt by an untrusted request to supply trust material or
 * persistence ports. Privileged dependencies must be injected only at gate
 * construction time.
 */
function rejectCallerTrustSurface(request) {
  if (!isPlainObject(request)) {
    return deny(CP2_I_DECISIONS.DENY_INVALID_INPUT, ['REQUEST_OBJECT_REQUIRED']);
  }
  if (request.trustAnchor != null
    || request.publicKey != null
    || request.verifier != null
    || request.attestationVerifier != null) {
    return deny(CP2_I_DECISIONS.DENY_CALLER_TRUST_ANCHOR, ['CALLER_TRUST_ANCHOR_FORBIDDEN']);
  }
  if (request.keyRegistry != null
    || request.revocationRegistry != null
    || request.replayRegistry != null
    || request.clock != null
    || request.capabilityIssuer != null
    || request.ownerApprovalIssuer != null) {
    return deny(CP2_I_DECISIONS.DENY_CALLER_VERIFIER, ['CALLER_VERIFIER_OR_REGISTRY_FORBIDDEN']);
  }
  if (request.bindTaskClaimLeaseWithAudit != null
    || request.releaseTaskClaimLeaseWithAudit != null
    || request.persistence != null
    || request.withOwnedWriteLeaseTransaction != null) {
    return deny(CP2_I_DECISIONS.DENY_CALLER_PERSISTENCE_PORT, ['CALLER_PERSISTENCE_PORT_FORBIDDEN']);
  }
  if (request.rule02Yes === true
    || request.validatorAllow === true
    || request.implementationAuthorized === true) {
    return deny(CP2_I_DECISIONS.DENY_DEFAULT_FAIL_CLOSED, ['RULE02_OR_VALIDATOR_NOT_AUTHORITY']);
  }
  return null;
}

/**
 * Capability resourcePaths reuse frozen CP1 exact-scope contracts (CP1 issuer
 * cannot approve CP2-I package paths without mutating CP1). CP2_I_PATHS remains
 * the implementation file-scope metadata for this checkpoint.
 */
function assertSafeResourcePaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return deny(CP2_I_DECISIONS.DENY_SCOPE_ESCAPE, ['RESOURCE_PATHS_REQUIRED']);
  }
  for (const path of paths) {
    if (typeof path !== 'string' || path.length === 0) {
      return deny(CP2_I_DECISIONS.DENY_SCOPE_ESCAPE, ['PATH_NOT_STRING']);
    }
    if (path.includes('..') || path.startsWith('/') || path.includes('\\')) {
      return deny(CP2_I_DECISIONS.DENY_SCOPE_ESCAPE, [`PATH_TRAVERSAL_OR_ABSOLUTE:${path}`]);
    }
  }
  return null;
}

/**
 * Create a privileged composition gate. Only harness/setup code may construct
 * this. Request handlers must never receive the ability to rebuild trust deps.
 */
export function createOperationalCompositionGate(privilegedDeps = {}) {
  if (!isPlainObject(privilegedDeps)) {
    throw new Error('PRIVILEGED_DEPS_REQUIRED');
  }
  const {
    baselineSha,
    repositoryId = CP2_I_REPOSITORY_ID,
    buildCapabilityVerifyDeps,
    persistence = {},
    ownedTransaction,
  } = privilegedDeps;

  if (typeof baselineSha !== 'string' || baselineSha.length < 7) {
    throw new Error('BASELINE_SHA_REQUIRED');
  }
  if (typeof buildCapabilityVerifyDeps !== 'function') {
    throw new Error('BUILD_CAPABILITY_VERIFY_DEPS_REQUIRED');
  }

  // Option B: never wire or execute mutation ports. Constructor persistence /
  // ownedTransaction injection is recorded and denied on any dispatch attempt.
  // No default fallback to frozen DLP-004 bind/release executors.
  if (!isPlainObject(persistence)) {
    throw new Error('PERSISTENCE_OBJECT_REQUIRED_IF_PROVIDED');
  }
  const constructorPersistenceInjection = persistence.bindTaskClaimLeaseWithAudit != null
    || persistence.releaseTaskClaimLeaseWithAudit != null
    || persistence.bind != null
    || persistence.release != null
    || Object.keys(persistence).length > 0;
  const constructorOwnedTxnInjection = ownedTransaction != null;

  /**
   * Verify CP1 capability chain for an intended CP2-I mutation. Does not mutate.
   */
  function authorizeOperationalMutation(request = {}) {
    const callerReject = rejectCallerTrustSurface(request);
    if (callerReject) return callerReject;

    const action = request.action;
    const taskId = request.taskId;
    const resourcePaths = request.resourcePaths;
    const actorId = request.actorId;
    const capabilityToken = request.capabilityToken;

    if (typeof action !== 'string'
      || (action !== CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT
        && action !== CP2_I_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT)) {
      return deny(CP2_I_DECISIONS.DENY_WRONG_ACTION, ['UNSUPPORTED_OR_MISSING_ACTION']);
    }
    if (typeof taskId !== 'string' || taskId.length === 0) {
      return deny(CP2_I_DECISIONS.DENY_WRONG_TASK, ['TASK_ID_REQUIRED']);
    }
    if (typeof actorId !== 'string' || actorId.length === 0) {
      return deny(CP2_I_DECISIONS.DENY_WRONG_PRINCIPAL, ['ACTOR_ID_REQUIRED']);
    }
    const scopeDeny = assertSafeResourcePaths(resourcePaths);
    if (scopeDeny) return scopeDeny;

    if (capabilityToken == null) {
      return deny(CP2_I_DECISIONS.DENY_MISSING_CAPABILITY, ['CAPABILITY_TOKEN_REQUIRED']);
    }

    let verifyDeps;
    try {
      verifyDeps = buildCapabilityVerifyDeps(request);
    } catch (err) {
      return deny(CP2_I_DECISIONS.DENY_MISSING_PRIVILEGED_TRUST, [
        err?.code || err?.message || 'TRUST_DEPS_THREW',
      ]);
    }
    if (!isPlainObject(verifyDeps)
      || verifyDeps.keyRegistry == null
      || verifyDeps.clock == null
      || verifyDeps.revocationRegistry == null
      || verifyDeps.replayRegistry == null
      || verifyDeps.principal == null) {
      return deny(CP2_I_DECISIONS.DENY_MISSING_PRIVILEGED_TRUST, ['INCOMPLETE_TRUST_DEPS']);
    }
    if (verifyDeps.approvalToken == null) {
      return deny(CP2_I_DECISIONS.DENY_MISSING_OWNER_APPROVAL, ['APPROVAL_TOKEN_REQUIRED']);
    }

    // Principal binding: branded principal must match request actor.
    const principal = verifyDeps.principal;
    const principalId = principal.principalId || principal.actorId || principal.sub;
    if (principalId !== actorId) {
      return deny(CP2_I_DECISIONS.DENY_WRONG_PRINCIPAL, ['PRINCIPAL_ACTOR_MISMATCH']);
    }

    const verified = verifyCapability(
      capabilityToken,
      {
        taskId,
        action,
        repositoryId,
        baselineSha,
        resourcePaths: [...resourcePaths],
      },
      verifyDeps,
    );

    if (!verified.ok) {
      if (verified.decision === CAPABILITY_DECISIONS.DENY_WRONG_TASK) {
        return deny(CP2_I_DECISIONS.DENY_WRONG_TASK, [verified.decision, ...(verified.reasons || [])]);
      }
      if (verified.decision === CAPABILITY_DECISIONS.DENY_WRONG_RESOURCE) {
        return deny(CP2_I_DECISIONS.DENY_WRONG_RESOURCE, [verified.decision, ...(verified.reasons || [])]);
      }
      if (verified.decision === CAPABILITY_DECISIONS.DENY_WRONG_WORKER) {
        return deny(CP2_I_DECISIONS.DENY_WRONG_PRINCIPAL, [verified.decision, ...(verified.reasons || [])]);
      }
      if (verified.decision === CAPABILITY_DECISIONS.DENY_MISSING_OWNER_APPROVAL
        || verified.decision === CAPABILITY_DECISIONS.DENY_INVALID_OWNER_APPROVAL) {
        return deny(CP2_I_DECISIONS.DENY_MISSING_OWNER_APPROVAL, [
          verified.decision,
          ...(verified.reasons || []),
        ]);
      }
      if (verified.decision === CAPABILITY_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR) {
        return deny(CP2_I_DECISIONS.DENY_CALLER_TRUST_ANCHOR, [
          verified.decision,
          ...(verified.reasons || []),
        ]);
      }
      return deny(CP2_I_DECISIONS.DENY_CAPABILITY, [
        verified.decision,
        ...(verified.reasons || []),
      ]);
    }

    if (verified.claims.sub !== actorId) {
      return deny(CP2_I_DECISIONS.DENY_WRONG_PRINCIPAL, ['CAPABILITY_SUB_MISMATCH']);
    }

    // DLP resource/lease keys are not carried by CP1 capability resourcePaths.
    // When present on the request they are stamped onto the branded authz for
    // later exact equality against persistenceInput; absence is checked before
    // any persistence dispatch.
    const resourceType = request.resourceType;
    const resourceKey = request.resourceKey;
    const leaseKey = request.leaseKey;

    return allowAuthz({
      action,
      taskId,
      actorId,
      resourcePaths: Object.freeze([...resourcePaths]),
      capabilityClaims: verified.claims,
      ...(typeof resourceType === 'string' && resourceType.length > 0
        ? { resourceType } : {}),
      ...(typeof resourceKey === 'string' && resourceKey.length > 0
        ? { resourceKey } : {}),
      ...(typeof leaseKey === 'string' && leaseKey.length > 0
        ? { leaseKey } : {}),
    });
  }

  /**
   * Enforce AUTHORIZED_INVOCATION ↔ persistenceInput binding before any DLP
   * port call. A valid capability for one operation must never authorize a
   * different persistence mutation.
   */
  function assertPersistenceMatchesAuthz(authz, persistenceInput, expectedAction) {
    if (!isBrandedCp2IAuthorizedInvocation(authz) || !authz.ok) {
      return deny(CP2_I_DECISIONS.DENY_DEFAULT_FAIL_CLOSED, ['AUTHORIZED_INVOCATION_REQUIRED'], {
        authz,
        mutationAttempted: false,
      });
    }
    if (!isPlainObject(persistenceInput)) {
      return deny(CP2_I_DECISIONS.DENY_INVALID_INPUT, ['PERSISTENCE_INPUT_REQUIRED'], {
        authz,
        mutationAttempted: false,
      });
    }
    if (authz.action !== expectedAction) {
      return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_ACTION_MISMATCH, [
        'AUTHZ_ACTION_UNEXPECTED',
        String(authz.action),
      ], { authz, mutationAttempted: false });
    }

    const isBind = expectedAction === CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT;
    const op = isBind ? persistenceInput.bind : persistenceInput.release;
    const forbiddenSibling = isBind ? persistenceInput.release : persistenceInput.bind;

    if (forbiddenSibling != null) {
      return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_ACTION_MISMATCH, [
        isBind ? 'RELEASE_PAYLOAD_ON_BIND' : 'BIND_PAYLOAD_ON_RELEASE',
      ], { authz, mutationAttempted: false });
    }
    if (!isPlainObject(op)) {
      return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_ACTION_MISMATCH, [
        isBind ? 'BIND_PAYLOAD_REQUIRED' : 'RELEASE_PAYLOAD_REQUIRED',
      ], { authz, mutationAttempted: false });
    }

    if (op.taskId !== authz.taskId) {
      return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_TASK_MISMATCH, [
        'PERSISTENCE_TASK_NE_AUTHZ_TASK',
      ], { authz, mutationAttempted: false });
    }
    if (op.actorId !== authz.actorId) {
      return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_ACTOR_MISMATCH, [
        'PERSISTENCE_ACTOR_NE_AUTHZ_ACTOR',
      ], { authz, mutationAttempted: false });
    }

    if (typeof authz.resourceType !== 'string' || authz.resourceType.length === 0
      || typeof authz.resourceKey !== 'string' || authz.resourceKey.length === 0
      || typeof authz.leaseKey !== 'string' || authz.leaseKey.length === 0) {
      return deny(CP2_I_DECISIONS.DENY_MISSING_CLAIM_LEASE_BINDING, [
        'REQUEST_RESOURCE_TYPE_KEY_LEASE_REQUIRED',
      ], { authz, mutationAttempted: false });
    }
    if (op.resourceType !== authz.resourceType
      || op.resourceKey !== authz.resourceKey
      || op.leaseKey !== authz.leaseKey) {
      return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_CLAIM_LEASE_MISMATCH, [
        'PERSISTENCE_CLAIM_LEASE_NE_AUTHZ',
      ], { authz, mutationAttempted: false });
    }

    const audit = persistenceInput.audit;
    if (!isPlainObject(audit)) {
      return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_AUDIT_MISMATCH, [
        'AUDIT_PAYLOAD_REQUIRED',
      ], { authz, mutationAttempted: false });
    }
    if (audit.taskId !== authz.taskId) {
      return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_AUDIT_MISMATCH, [
        'AUDIT_TASK_NE_AUTHZ_TASK',
      ], { authz, mutationAttempted: false });
    }
    if (audit.actorId !== authz.actorId) {
      return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_AUDIT_MISMATCH, [
        'AUDIT_ACTOR_NE_AUTHZ_ACTOR',
      ], { authz, mutationAttempted: false });
    }

    if (persistenceInput.evidence != null) {
      const evidence = persistenceInput.evidence;
      if (!isPlainObject(evidence)) {
        return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_EVIDENCE_MISMATCH, [
          'EVIDENCE_PAYLOAD_INVALID',
        ], { authz, mutationAttempted: false });
      }
      if (evidence.taskId !== authz.taskId) {
        return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_EVIDENCE_MISMATCH, [
          'EVIDENCE_TASK_NE_AUTHZ_TASK',
        ], { authz, mutationAttempted: false });
      }
      if (evidence.actorId !== authz.actorId) {
        return deny(CP2_I_DECISIONS.DENY_PERSISTENCE_EVIDENCE_MISMATCH, [
          'EVIDENCE_ACTOR_NE_AUTHZ_ACTOR',
        ], { authz, mutationAttempted: false });
      }
    }

    return null;
  }

  /**
   * Option B: never invoke caller-supplied work callbacks or owned-txn helpers.
   * Preserved as a fail-closed public method for offline contract compatibility.
   */
  async function executeAuthorizedOwnedWork(client, authz, work) {
    void client;
    void work;
    if (!isBrandedCp2IAuthorizedInvocation(authz) || !authz.ok) {
      return authz && authz.ok === false
        ? { ...authz, operationalDispatch: false, mutationAttempted: false }
        : deny(CP2_I_DECISIONS.DENY_DEFAULT_FAIL_CLOSED, ['AUTHORIZED_INVOCATION_REQUIRED'], {
          operationalDispatch: false,
          mutationAttempted: false,
        });
    }
    if (constructorOwnedTxnInjection) {
      return deny(CP2_I_DECISIONS.DENY_CONSTRUCTOR_PERSISTENCE_INJECTION, [
        'OWNED_TRANSACTION_INJECTION_FORBIDDEN',
      ], {
        authz,
        operationalDispatch: false,
        mutationAttempted: false,
      });
    }
    return deny(CP2_I_DECISIONS.DENY_OPERATIONAL_WORK_CALLBACK, [
      'OFFLINE_CONTRACT_NON_DISPATCH',
      'CALLER_WORK_CALLBACK_NOT_EXECUTED',
    ], {
      authz,
      operationalDispatch: false,
      mutationAttempted: false,
    });
  }

  function offlineContractOnly(authz, action) {
    return freezeDeep({
      ok: true,
      allowed: true,
      decision: CP2_I_DECISIONS.OFFLINE_CONTRACT_ONLY,
      reasons: Object.freeze([
        'CP2_I_OFFLINE_CONTRACT_EVALUATED',
        'NO_OPERATIONAL_PERSISTENCE_DISPATCH',
        'RESOURCE_LEASE_AUTHORITY_NOT_PROVEN',
        String(action),
      ]),
      classification: 'CP2_I_OFFLINE_CONTRACT_ONLY / NOT_OPERATIONAL_BIND_OR_RELEASE / NOT_DB_DURABILITY_PROOF',
      authz,
      operationalDispatch: false,
      mutationAttempted: false,
    });
  }

  /**
   * Authorize + HQA-01 binding checks only. Never dispatches persistence.
   */
  async function bindOperationalTaskClaimLeaseWithAudit(client, request = {}) {
    void client;
    const authz = authorizeOperationalMutation({
      ...request,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    });
    if (!authz.ok) {
      return deny(authz.decision, authz.reasons, {
        authz,
        mutationAttempted: false,
        operationalDispatch: false,
      });
    }
    if (!isPlainObject(request.persistenceInput)) {
      return deny(CP2_I_DECISIONS.DENY_INVALID_INPUT, ['PERSISTENCE_INPUT_REQUIRED'], {
        authz,
        mutationAttempted: false,
        operationalDispatch: false,
      });
    }

    // HQA-01 binding checks remain mandatory before any success classification.
    const bindingDeny = assertPersistenceMatchesAuthz(
      authz,
      request.persistenceInput,
      CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    );
    if (bindingDeny) {
      return deny(bindingDeny.decision, bindingDeny.reasons, {
        authz,
        mutationAttempted: false,
        operationalDispatch: false,
      });
    }

    if (constructorPersistenceInjection || constructorOwnedTxnInjection) {
      return deny(CP2_I_DECISIONS.DENY_CONSTRUCTOR_PERSISTENCE_INJECTION, [
        'CONSTRUCTOR_PERSISTENCE_OR_TXN_INJECTION_FORBIDDEN',
      ], {
        authz,
        mutationAttempted: false,
        operationalDispatch: false,
      });
    }

    // Non-dispatch: do not call DLP ports, client.query, or any mutation sink.
    return offlineContractOnly(authz, CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT);
  }

  async function releaseOperationalTaskClaimLeaseWithAudit(client, request = {}) {
    void client;
    const authz = authorizeOperationalMutation({
      ...request,
      action: CP2_I_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
    });
    if (!authz.ok) {
      return deny(authz.decision, authz.reasons, {
        authz,
        mutationAttempted: false,
        operationalDispatch: false,
      });
    }
    if (!isPlainObject(request.persistenceInput)) {
      return deny(CP2_I_DECISIONS.DENY_INVALID_INPUT, ['PERSISTENCE_INPUT_REQUIRED'], {
        authz,
        mutationAttempted: false,
        operationalDispatch: false,
      });
    }

    const bindingDeny = assertPersistenceMatchesAuthz(
      authz,
      request.persistenceInput,
      CP2_I_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
    );
    if (bindingDeny) {
      return deny(bindingDeny.decision, bindingDeny.reasons, {
        authz,
        mutationAttempted: false,
        operationalDispatch: false,
      });
    }

    if (constructorPersistenceInjection || constructorOwnedTxnInjection) {
      return deny(CP2_I_DECISIONS.DENY_CONSTRUCTOR_PERSISTENCE_INJECTION, [
        'CONSTRUCTOR_PERSISTENCE_OR_TXN_INJECTION_FORBIDDEN',
      ], {
        authz,
        mutationAttempted: false,
        operationalDispatch: false,
      });
    }

    return offlineContractOnly(authz, CP2_I_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT);
  }

  const gate = Object.freeze({
    baselineSha,
    repositoryId,
    checkpoint: CP2_I_CHECKPOINT,
    mode: CP2_I_MODE,
    sliceId: CP2_I_SLICE_ID,
    authorizedFileScope: CP2_I_PATHS,
    dlp004GovernanceRevision: DLP004_GOVERNANCE_REVISION,
    dispatchMode: 'OFFLINE_CONTRACT_NON_DISPATCH',
    authorizeOperationalMutation,
    executeAuthorizedOwnedWork,
    bindOperationalTaskClaimLeaseWithAudit,
    releaseOperationalTaskClaimLeaseWithAudit,
  });
  privilegedGateBrand.add(gate);
  return gate;
}

export {
  DLP004_GOVERNANCE_REVISION,
  LIFECYCLE_DECISIONS,
  CAPABILITY_DECISIONS,
};
