/**
 * TECP-OPS-PILOT-001 S2 — allowlisted Operational Dispatcher (NON_OPERATIONAL).
 *
 * Gate B: fail-closed. Must not invoke real DLP mutation, PostgreSQL, Worker,
 * or MCP. OPERATIONAL_DISPATCH_AUTHORIZED remains NO.
 *
 * Frozen DLP-004 interfaces are imported by name for future Gate D wiring only;
 * this module never calls them under Gate B defaults.
 */

import { verifyCapability } from '../../tecp-ops/src/operationalCapabilityIssuer.js';
import {
  isBrandedOwnerApprovalArtifact,
  verifyOwnerApprovalArtifact,
} from '../../tecp-ops/src/ownerApprovalArtifact.js';
import {
  isBrandedVerifiedOperationalPrincipal,
} from '../../tecp-ops/src/operationalWorkerIdentity.js';
import {
  ORLA_DECISIONS,
  S2_STAGES,
  assertNoOperationalDispatch,
  verifyOperationalResourceLeaseAuthority,
} from '../../tecp-ops/src/operationalResourceLeaseAuthority.js';
import {
  isBrandedDbIssuedLeaseContext,
  matchDbIssuedLeaseContext,
  rejectCallerLeaseObject,
} from './dbIssuedLeaseContext.js';

// Import-only reference to frozen DLP-004 public symbols for future composition.
// Intentionally unused for execution in Gate B.
import {
  APPROVED_GOVERNANCE_REVISION as DLP004_GOVERNANCE_REVISION,
} from '../../tecp-persistence/src/taskClaimLeaseAuditRepository.js';

export const DISPATCHER_MODE = 'S2_GATE_B_NON_OPERATIONAL';
export const DISPATCHER_PROOF_CLASS = 'OFFLINE_FAIL_CLOSED_DISPATCHER';
export const OPERATIONAL_DISPATCH_AUTHORIZED = false;

export const DISPATCHER_ACTIONS = Object.freeze({
  BIND_TASK_CLAIM_LEASE_WITH_AUDIT: 'BIND_TASK_CLAIM_LEASE_WITH_AUDIT',
  RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT: 'RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT',
});

export const DISPATCHER_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_EMERGENCY_STOP: 'DENY_EMERGENCY_STOP',
  DENY_UNKNOWN_ACTION: 'DENY_UNKNOWN_ACTION',
  DENY_CALLER_SQL: 'DENY_CALLER_SQL',
  DENY_CALLER_CALLBACK: 'DENY_CALLER_CALLBACK',
  DENY_CALLER_TRUST_ROOT: 'DENY_CALLER_TRUST_ROOT',
  DENY_CALLER_PERSISTENCE_HANDLE: 'DENY_CALLER_PERSISTENCE_HANDLE',
  DENY_MISSING_CP1: 'DENY_MISSING_CP1',
  DENY_CP1: 'DENY_CP1',
  DENY_MISSING_ORLA: 'DENY_MISSING_ORLA',
  DENY_ORLA: 'DENY_ORLA',
  DENY_MISSING_DB_LEASE_CONTEXT: 'DENY_MISSING_DB_LEASE_CONTEXT',
  DENY_UNBRANDED_LEASE_CONTEXT: 'DENY_UNBRANDED_LEASE_CONTEXT',
  DENY_MISSING_OWNED_TXN: 'DENY_MISSING_OWNED_TXN',
  DENY_OPERATIONAL_DISPATCH_DISABLED: 'DENY_OPERATIONAL_DISPATCH_DISABLED',
  DENY_S1_WEAKSET_OR_TEST_SIGNER: 'DENY_S1_WEAKSET_OR_TEST_SIGNER',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
  DENY_MALFORMED: 'DENY_MALFORMED',
});

const privilegedDispatcherLatch = new WeakSet();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function deny(decision, reasons = [], extra = {}) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    classification: DISPATCHER_PROOF_CLASS,
    operationalDispatchAuthorized: false,
    mutationExecuted: false,
    dlpInvoked: false,
    ...extra,
  });
}

function allowContract(reasons = [], extra = {}) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: DISPATCHER_DECISIONS.ALLOW,
    reasons: Object.freeze([...reasons]),
    classification: DISPATCHER_PROOF_CLASS,
    operationalDispatchAuthorized: false,
    mutationExecuted: false,
    dlpInvoked: false,
    ...extra,
  });
}

function rejectUntrustedRequestSurface(request) {
  if (!isPlainObject(request)) {
    return deny(DISPATCHER_DECISIONS.DENY_MALFORMED, ['REQUEST_OBJECT_REQUIRED']);
  }
  if (
    request.sql != null
    || request.queryText != null
    || request.statement != null
    || request.rawSql != null
  ) {
    return deny(DISPATCHER_DECISIONS.DENY_CALLER_SQL, ['CALLER_SQL_FORBIDDEN']);
  }
  if (
    typeof request.work === 'function'
    || typeof request.callback === 'function'
    || typeof request.onAllow === 'function'
    || typeof request.execute === 'function'
  ) {
    return deny(DISPATCHER_DECISIONS.DENY_CALLER_CALLBACK, ['CALLER_CALLBACK_FORBIDDEN']);
  }
  if (
    request.trustRoot != null
    || request.keyRegistry != null
    || request.publicKeyPem != null
    || request.verifier != null
    || request.trustAnchor != null
  ) {
    return deny(DISPATCHER_DECISIONS.DENY_CALLER_TRUST_ROOT, [
      'CALLER_TRUST_ROOT_REPLACEMENT_FORBIDDEN',
    ]);
  }
  if (
    request.bindTaskClaimLeaseWithAudit != null
    || request.releaseTaskClaimLeaseWithAudit != null
    || request.persistence != null
    || request.clientFactory != null
    || request.withOwnedWriteLeaseTransaction != null
    || request.dbClient != null
  ) {
    return deny(DISPATCHER_DECISIONS.DENY_CALLER_PERSISTENCE_HANDLE, [
      'CALLER_PERSISTENCE_HANDLE_FORBIDDEN',
    ]);
  }
  if (
    request.s1WeakSetAuthority === true
    || request.testOnlySignerAsOperational === true
    || request.useS1OfflineFixture === true
  ) {
    return deny(DISPATCHER_DECISIONS.DENY_S1_WEAKSET_OR_TEST_SIGNER, [
      'S1_TEST_ONLY_NOT_OPERATIONAL_PRIVILEGE',
    ]);
  }
  return null;
}

/**
 * Create a privileged dispatcher. Request handlers must not rebuild trust deps.
 * Gate B: authorizeOperationalDispatch always ends in NON_OPERATIONAL deny for
 * mutation execution even after offline contract checks pass.
 */
export function createOperationalDispatcher(privilegedDeps = {}) {
  if (!isPlainObject(privilegedDeps)) {
    throw new Error('PRIVILEGED_DEPS_REQUIRED');
  }

  const {
    emergencyStop,
    trustRoot,
    buildCapabilityVerifyDeps,
    buildOwnerApprovalVerifyDeps,
    orlaVerifyDeps,
    durableRegistries,
    // Persistence ports may be recorded but MUST NOT be invoked in Gate B.
    persistence = {},
    ownedTransaction = null,
    operationalDispatchAuthorized = false,
  } = privilegedDeps;

  if (operationalDispatchAuthorized === true || OPERATIONAL_DISPATCH_AUTHORIZED === true) {
    throw new Error('GATE_B_FORBIDS_OPERATIONAL_DISPATCH_AUTHORIZATION_FLAG');
  }
  if (trustRoot == null) {
    throw new Error('TRUST_ROOT_REQUIRED');
  }
  if (typeof buildCapabilityVerifyDeps !== 'function') {
    throw new Error('BUILD_CAPABILITY_VERIFY_DEPS_REQUIRED');
  }

  const constructorPersistenceInjection = isPlainObject(persistence)
    && Object.keys(persistence).length > 0;
  const constructorOwnedTxnInjection = ownedTransaction != null;

  function authorizeAndDispatch(request = {}) {
    const surfaceDeny = rejectUntrustedRequestSurface(request);
    if (surfaceDeny) return surfaceDeny;

    if (emergencyStop != null && typeof emergencyStop.assertNotStopped === 'function') {
      const stopState = emergencyStop.assertNotStopped();
      if (!stopState.ok) {
        return deny(DISPATCHER_DECISIONS.DENY_EMERGENCY_STOP, stopState.reasons || [
          'EMERGENCY_STOP_ACTIVE',
        ]);
      }
    }

    const action = request.action;
    if (
      action !== DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT
      && action !== DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT
    ) {
      return deny(DISPATCHER_DECISIONS.DENY_UNKNOWN_ACTION, [
        `UNSUPPORTED_ACTION:${String(action)}`,
      ]);
    }

    if (!isBrandedVerifiedOperationalPrincipal(request.principal)) {
      return deny(DISPATCHER_DECISIONS.DENY_MISSING_CP1, ['BRANDED_PRINCIPAL_REQUIRED']);
    }
    if (request.ownerApprovalArtifact != null) {
      if (!isBrandedOwnerApprovalArtifact(request.ownerApprovalArtifact)
        && request.ownerApprovalToken == null) {
        return deny(DISPATCHER_DECISIONS.DENY_MISSING_CP1, [
          'OWNER_APPROVAL_MUST_BE_BRANDED_OR_TOKEN',
        ]);
      }
    }

    if (request.capabilityToken == null) {
      return deny(DISPATCHER_DECISIONS.DENY_MISSING_CP1, ['CAPABILITY_TOKEN_REQUIRED']);
    }

    let capabilityDeps;
    try {
      capabilityDeps = buildCapabilityVerifyDeps(request);
    } catch (err) {
      return deny(DISPATCHER_DECISIONS.DENY_CP1, [
        err?.message || 'CAPABILITY_DEPS_BUILD_FAILED',
      ]);
    }
    if (!isPlainObject(capabilityDeps) || capabilityDeps.keyRegistry == null) {
      return deny(DISPATCHER_DECISIONS.DENY_CP1, ['PRIVILEGED_CAPABILITY_DEPS_REQUIRED']);
    }
    if (capabilityDeps.trustAnchor != null || capabilityDeps.publicKey != null) {
      return deny(DISPATCHER_DECISIONS.DENY_CALLER_TRUST_ROOT, [
        'CAPABILITY_DEPS_TRUST_ANCHOR_FORBIDDEN',
      ]);
    }
    // Prefer branded principal from privileged deps; fall back to request principal.
    if (capabilityDeps.principal == null) {
      capabilityDeps = {
        ...capabilityDeps,
        principal: request.principal,
      };
    }
    const capabilityResult = verifyCapability(
      request.capabilityToken,
      request.capabilityExpectation || {},
      capabilityDeps,
    );
    if (!capabilityResult.ok) {
      return deny(DISPATCHER_DECISIONS.DENY_CP1, [
        capabilityResult.decision || 'CAPABILITY_DENY',
        ...(capabilityResult.reasons || []),
      ]);
    }

    if (request.ownerApprovalToken != null && typeof buildOwnerApprovalVerifyDeps === 'function') {
      const approvalDeps = buildOwnerApprovalVerifyDeps(request);
      const approval = verifyOwnerApprovalArtifact(
        request.ownerApprovalToken,
        request.ownerApprovalExpectation || {},
        approvalDeps,
      );
      if (!approval.ok) {
        return deny(DISPATCHER_DECISIONS.DENY_CP1, [
          approval.decision || 'OWNER_APPROVAL_DENY',
          ...(approval.reasons || []),
        ]);
      }
    }

    if (request.orlaToken == null) {
      return deny(DISPATCHER_DECISIONS.DENY_MISSING_ORLA, ['ORLA_TOKEN_REQUIRED']);
    }
    if (!isPlainObject(orlaVerifyDeps) || orlaVerifyDeps.trustRoot == null) {
      return deny(DISPATCHER_DECISIONS.DENY_MISSING_ORLA, [
        'PRIVILEGED_ORLA_VERIFY_DEPS_REQUIRED',
      ]);
    }
    // Force privileged trust root; ignore any request-supplied root.
    const orlaDeps = {
      ...orlaVerifyDeps,
      trustRoot,
    };
    const stage = action === DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT
      ? S2_STAGES.BOOTSTRAP
      : S2_STAGES.LEASE_BOUND;
    const orlaExpectation = {
      ...(request.orlaExpectation || {}),
      stage,
    };
    if (stage === S2_STAGES.LEASE_BOUND) {
      const leaseCtx = request.dbIssuedLeaseContext;
      const leaseReject = rejectCallerLeaseObject(leaseCtx || {});
      if (!leaseCtx || !isBrandedDbIssuedLeaseContext(leaseCtx)) {
        return deny(DISPATCHER_DECISIONS.DENY_UNBRANDED_LEASE_CONTEXT, [
          ...(leaseReject.reasons || ['DB_ISSUED_LEASE_CONTEXT_REQUIRED']),
        ]);
      }
      const matched = matchDbIssuedLeaseContext(leaseCtx, request.leaseExpectation || {});
      if (!matched.ok) {
        return deny(DISPATCHER_DECISIONS.DENY_MISSING_DB_LEASE_CONTEXT, matched.reasons);
      }
      orlaExpectation.dbIssuedLeaseContext = leaseCtx;
    }

    const orlaResult = verifyOperationalResourceLeaseAuthority(
      request.orlaToken,
      orlaExpectation,
      orlaDeps,
    );
    if (!orlaResult.ok) {
      return deny(DISPATCHER_DECISIONS.DENY_ORLA, [
        orlaResult.decision || ORLA_DECISIONS.DENY_DEFAULT_FAIL_CLOSED,
        ...(orlaResult.reasons || []),
      ]);
    }
    const noDispatch = assertNoOperationalDispatch(orlaResult);
    if (noDispatch.operationalDispatchAuthorized === true) {
      return deny(DISPATCHER_DECISIONS.DENY_OPERATIONAL_DISPATCH_DISABLED, [
        'ORLA_DISPATCH_FLAG_CORRUPT',
      ]);
    }

    if (constructorOwnedTxnInjection !== true && request.requireOwnedTxn !== false) {
      // Gate B never has an authorized owned txn. Missing txn => deny before mutation.
      if (ownedTransaction == null && request.ownedTxnHandle == null) {
        return deny(DISPATCHER_DECISIONS.DENY_MISSING_OWNED_TXN, [
          'OWNED_TRANSACTION_REQUIRED_BEFORE_MUTATION',
          'GATE_B_HAS_NO_AUTHORIZED_TXN',
        ]);
      }
    }

    if (durableRegistries != null && typeof durableRegistries.consumeJti === 'function') {
      // Do not consume jti on a path that will hard-deny mutation; Gate B stops here.
    }

    // Hard non-operational gate: never invoke DLP-004 or persistence ports.
    void DLP004_GOVERNANCE_REVISION;
    void constructorPersistenceInjection;
    return deny(DISPATCHER_DECISIONS.DENY_OPERATIONAL_DISPATCH_DISABLED, [
      'OPERATIONAL_DISPATCH_AUTHORIZED=NO',
      'GATE_B_FORBIDS_DLP_MUTATION',
      'GATE_B_FORBIDS_POSTGRES',
      'OFFLINE_CONTRACT_CHECKS_MAY_PASS_BUT_MUTATION_DENIED',
    ], {
      offlineContractObservations: Object.freeze({
        capabilityOk: true,
        orlaOk: true,
        emergencyStopClear: true,
      }),
    });
  }

  const dispatcher = Object.freeze({
    kind: 'OPERATIONAL_DISPATCHER',
    mode: DISPATCHER_MODE,
    proofClass: DISPATCHER_PROOF_CLASS,
    operationalDispatchAuthorized: false,
    authorizeAndDispatch,
  });
  privilegedDispatcherLatch.add(dispatcher);
  return dispatcher;
}

export function isPrivilegedOperationalDispatcher(value) {
  return value !== null && typeof value === 'object' && privilegedDispatcherLatch.has(value);
}
