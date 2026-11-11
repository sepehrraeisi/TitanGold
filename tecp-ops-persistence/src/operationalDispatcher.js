/**
 * TECP-OPS-PILOT-001 S2 Gate C+D — Operational Dispatcher + TEST_ONLY composition.
 *
 * authorizeAndDispatch remains HARD_DENY / NON_OPERATIONAL.
 * OPERATIONAL_DISPATCH_AUTHORIZED remains false forever in this module.
 *
 * TEST_ONLY DLP-004 composition is a separate privileged export, not reachable
 * through operational dispatcher requests or arbitrary caller callbacks.
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
  invalidateContextsForTransaction,
  isBrandedDbIssuedLeaseContext,
  isDbProvenLeaseContext,
  matchDbIssuedLeaseContext,
  projectFromTrustedValidateWriteLease,
  rejectCallerLeaseObject,
} from './dbIssuedLeaseContext.js';
import {
  createDurableAuthorityRegistries,
} from './durableAuthorityRegistries.js';

import {
  validateWriteLease,
  withOwnedWriteLeaseTransaction,
} from '../../tecp-persistence/src/writeLeaseRepository.js';
import {
  bindTaskClaimLeaseInTransaction,
  releaseTaskClaimLeaseInTransaction,
} from '../../tecp-persistence/src/taskClaimLeaseRepository.js';
import {
  appendAuditEventInTransaction,
  appendEvidenceInTransaction,
} from '../../tecp-persistence/src/auditEvidenceRepository.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP004_GOVERNANCE_REVISION,
} from '../../tecp-persistence/src/taskClaimLeaseAuditRepository.js';

export const DISPATCHER_MODE = 'S2_GATE_CD_HARD_DENY_PLUS_TEST_ONLY_COMPOSITION';
export const DISPATCHER_PROOF_CLASS = 'OFFLINE_FAIL_CLOSED_DISPATCHER';
export const OPERATIONAL_DISPATCH_AUTHORIZED = false;
export const TEST_ONLY_COMPOSITION_PROOF_CLASS =
  'TEST_ONLY_DLP004_COMPOSITION_AWAITING_TIER3_DB_VALIDATION';

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

export const TEST_ONLY_COMPOSITION_DECISIONS = Object.freeze({
  COMMITTED: 'COMMITTED',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_MISSING_CLIENT: 'DENY_MISSING_CLIENT',
  DENY_MISSING_PRINCIPAL: 'DENY_MISSING_PRINCIPAL',
  DENY_LEASE_VALIDATION: 'DENY_LEASE_VALIDATION',
  DENY_LEASE_CONTEXT: 'DENY_LEASE_CONTEXT',
  DENY_JTI: 'DENY_JTI',
  DENY_UNKNOWN_ACTION: 'DENY_UNKNOWN_ACTION',
  DENY_MUTATION: 'DENY_MUTATION',
  DENY_EXCEPTION: 'DENY_EXCEPTION',
  DENY_NOT_TEST_ONLY: 'DENY_NOT_TEST_ONLY',
  DENY_CALLER_SQL: 'DENY_CALLER_SQL',
  DENY_CALLER_CALLBACK: 'DENY_CALLER_CALLBACK',
  DENY_DB_TIER3_NOT_AUTHORIZED: 'DENY_DB_TIER3_NOT_AUTHORIZED',
});

const privilegedDispatcherLatch = new WeakSet();
const privilegedCompositionLatch = new WeakSet();

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

function compositionDeny(decision, reasons = [], extra = {}) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    classification: TEST_ONLY_COMPOSITION_PROOF_CLASS,
    operationalDispatchAuthorized: false,
    mutationExecuted: false,
    dlpInvoked: Boolean(extra.dlpInvoked),
    jtiConsumedDurable: false,
    committed: false,
    rolledBack: extra.rolledBack !== false,
    ...extra,
  });
}

function requireOk(layerResult, label) {
  if (!layerResult || layerResult.ok !== true) {
    const err = new Error(label);
    err.layerResult = layerResult;
    throw err;
  }
  return layerResult;
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
 * Create a privileged dispatcher. authorizeAndDispatch ALWAYS hard-denies mutation.
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
    persistence = {},
    ownedTransaction = null,
    operationalDispatchAuthorized = false,
  } = privilegedDeps;

  if (operationalDispatchAuthorized === true || OPERATIONAL_DISPATCH_AUTHORIZED === true) {
    throw new Error('GATE_CD_FORBIDS_OPERATIONAL_DISPATCH_AUTHORIZATION_FLAG');
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
      if (ownedTransaction == null && request.ownedTxnHandle == null) {
        return deny(DISPATCHER_DECISIONS.DENY_MISSING_OWNED_TXN, [
          'OWNED_TRANSACTION_REQUIRED_BEFORE_MUTATION',
          'GATE_CD_HAS_NO_AUTHORIZED_OPERATIONAL_TXN',
        ]);
      }
    }

    void durableRegistries;
    void DLP004_GOVERNANCE_REVISION;
    void constructorPersistenceInjection;
    void bindTaskClaimLeaseInTransaction;
    void releaseTaskClaimLeaseInTransaction;
    void withOwnedWriteLeaseTransaction;
    void validateWriteLease;
    return deny(DISPATCHER_DECISIONS.DENY_OPERATIONAL_DISPATCH_DISABLED, [
      'OPERATIONAL_DISPATCH_AUTHORIZED=NO',
      'GATE_CD_FORBIDS_DLP_MUTATION_ON_OPERATIONAL_PATH',
      'GATE_CD_FORBIDS_POSTGRES_ON_OPERATIONAL_PATH',
      'OFFLINE_CONTRACT_CHECKS_MAY_PASS_BUT_MUTATION_DENIED',
      'USE_runTestOnlyDlp004Composition_FOR_FIXTURE_COMPOSITION',
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

export function createTestOnlyDlp004CompositionHandle(input = {}) {
  if (!isPlainObject(input)) {
    throw new TypeError('COMPOSITION_HANDLE_OPTIONS_REQUIRED');
  }
  if (input.proofClass !== 'TEST_ONLY_DLP004_COMPOSITION_HANDLE') {
    throw new TypeError('TEST_ONLY_PROOF_CLASS_REQUIRED');
  }
  if (input.operationalDispatchClaim === true) {
    throw new Error('OPERATIONAL_DISPATCH_CLAIM_FORBIDDEN');
  }
  const handle = Object.freeze({
    kind: 'TEST_ONLY_DLP004_COMPOSITION_HANDLE',
    proofClass: 'TEST_ONLY_DLP004_COMPOSITION_HANDLE',
    operationalDispatchAuthorized: false,
    classification: TEST_ONLY_COMPOSITION_PROOF_CLASS,
  });
  privilegedCompositionLatch.add(handle);
  return handle;
}

export function isTestOnlyDlp004CompositionHandle(value) {
  return value !== null && typeof value === 'object' && privilegedCompositionLatch.has(value);
}

/**
 * TEST_ONLY DLP-004 composition:
 * owned txn → (optional) validateWriteLease → DB_PROVEN context → durable jti
 * → InTransaction bind/release + audit(+evidence) → commit; DENY/exception → rollback.
 *
 * Without a live DB client: DENY_DB_TIER3_NOT_AUTHORIZED (no fake durability).
 * Not reachable via authorizeAndDispatch.
 */
export async function runTestOnlyDlp004Composition(compositionHandle, fixture = {}) {
  if (!isTestOnlyDlp004CompositionHandle(compositionHandle)) {
    return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_NOT_TEST_ONLY, [
      'PRIVILEGED_TEST_ONLY_COMPOSITION_HANDLE_REQUIRED',
    ]);
  }
  if (!isPlainObject(fixture)) {
    return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_MALFORMED, [
      'FIXTURE_OBJECT_REQUIRED',
    ]);
  }
  if (
    fixture.sql != null
    || fixture.queryText != null
    || fixture.rawSql != null
  ) {
    return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_CALLER_SQL, [
      'CALLER_SQL_FORBIDDEN',
    ]);
  }
  if (
    typeof fixture.callback === 'function'
    || typeof fixture.execute === 'function'
    || typeof fixture.work === 'function'
    || fixture.clientFactory != null
  ) {
    return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_CALLER_CALLBACK, [
      'CALLER_CALLBACK_FORBIDDEN',
    ]);
  }

  const client = fixture.dbClient;
  if (!client || typeof client.query !== 'function') {
    return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_DB_TIER3_NOT_AUTHORIZED, [
      'DB_CLIENT_REQUIRED',
      'TIER3_DISPOSABLE_POSTGRES_NOT_AUTHORIZED_IN_REMEDIATION',
      'NO_FAKE_CLIENT_AS_DURABILITY_PROOF',
    ]);
  }

  if (!isBrandedVerifiedOperationalPrincipal(fixture.principal)) {
    return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_MISSING_PRINCIPAL, [
      'BRANDED_PRINCIPAL_REQUIRED',
    ]);
  }

  const action = fixture.action;
  if (
    action !== DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT
    && action !== DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT
  ) {
    return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_UNKNOWN_ACTION, [
      `UNSUPPORTED_ACTION:${String(action)}`,
    ]);
  }
  if (!isNonEmptyString(fixture.jti)) {
    return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_MALFORMED, ['JTI_REQUIRED']);
  }

  const txnHandle = { id: `test-only-comp-${Date.now()}`, client };
  const registries = createDurableAuthorityRegistries(client, {
    issuerId: fixture.issuerId,
    audience: fixture.audience,
    requireOwnedTxn: fixture.requireOwnedTxn !== false,
  });

  let dlpInvoked = false;
  try {
    const committed = await withOwnedWriteLeaseTransaction(client, async () => {
      let dbProvenContext = null;

      const needsLeaseValidation = action === DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT
        || fixture.requireLeaseValidation === true;
      if (needsLeaseValidation) {
        if (!isPlainObject(fixture.leaseValidationInput)) {
          const err = new Error('LEASE_VALIDATION_INPUT');
          err.compositionDeny = compositionDeny(
            TEST_ONLY_COMPOSITION_DECISIONS.DENY_MALFORMED,
            ['LEASE_VALIDATION_INPUT_REQUIRED'],
            { rolledBack: true },
          );
          throw err;
        }
        const rawValidation = await validateWriteLease(client, fixture.leaseValidationInput);
        if (!rawValidation.ok) {
          const err = new Error('LEASE_VALIDATION');
          err.compositionDeny = compositionDeny(
            TEST_ONLY_COMPOSITION_DECISIONS.DENY_LEASE_VALIDATION,
            [rawValidation.decision, ...(rawValidation.reasons || [])],
            { rolledBack: true },
          );
          throw err;
        }
        const projected = projectFromTrustedValidateWriteLease(
          { ...rawValidation, trustedValidateWriteLease: true, ok: true },
          txnHandle,
          fixture.leaseExpectation || {},
        );
        if (!projected.ok || !isDbProvenLeaseContext(projected.context)) {
          const err = new Error('LEASE_CONTEXT');
          err.compositionDeny = compositionDeny(
            TEST_ONLY_COMPOSITION_DECISIONS.DENY_LEASE_CONTEXT,
            [projected.decision, ...(projected.reasons || [])],
            { rolledBack: true },
          );
          throw err;
        }
        dbProvenContext = projected.context;
      }

      const consume = await registries.consumeJti(fixture.jti, {
        principalId: fixture.principal.principalId || fixture.principalId,
        taskId: fixture.taskId,
        action,
        resourceType: fixture.resourceType,
        resourceKey: fixture.resourceKey,
        governanceRevision: fixture.governanceRevision,
        issuerId: fixture.issuerId,
        audience: fixture.audience,
      });
      if (!consume.ok) {
        const err = new Error('JTI');
        err.compositionDeny = compositionDeny(
          TEST_ONLY_COMPOSITION_DECISIONS.DENY_JTI,
          [consume.decision, ...(consume.reasons || [])],
          { rolledBack: true },
        );
        throw err;
      }

      if (fixture.forceSoftDeny === true) {
        const err = new Error('SOFT_DENY');
        err.compositionDeny = compositionDeny(
          TEST_ONLY_COMPOSITION_DECISIONS.DENY_MUTATION,
          ['FIXTURE_SOFT_DENY'],
          { rolledBack: true, dlpInvoked: false },
        );
        throw err;
      }
      if (typeof fixture.forceThrow === 'string') {
        throw new Error(fixture.forceThrow);
      }

      dlpInvoked = true;
      let bind = null;
      let release = null;
      let audit = null;
      let evidence = null;

      if (action === DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT) {
        if (!isPlainObject(fixture.bind) || !isPlainObject(fixture.audit)) {
          const err = new Error('BIND_AUDIT_REQUIRED');
          err.compositionDeny = compositionDeny(
            TEST_ONLY_COMPOSITION_DECISIONS.DENY_MALFORMED,
            ['BIND_AND_AUDIT_INPUT_REQUIRED'],
            { rolledBack: true, dlpInvoked: true },
          );
          throw err;
        }
        bind = requireOk(
          await bindTaskClaimLeaseInTransaction(client, fixture.bind),
          'BIND_DENY',
        );
        audit = requireOk(
          await appendAuditEventInTransaction(client, fixture.audit),
          'AUDIT_DENY',
        );
        if (fixture.evidence) {
          evidence = requireOk(
            await appendEvidenceInTransaction(client, fixture.evidence),
            'EVIDENCE_DENY',
          );
        }
      } else {
        if (!isPlainObject(fixture.release) || !isPlainObject(fixture.audit)) {
          const err = new Error('RELEASE_AUDIT_REQUIRED');
          err.compositionDeny = compositionDeny(
            TEST_ONLY_COMPOSITION_DECISIONS.DENY_MALFORMED,
            ['RELEASE_AND_AUDIT_INPUT_REQUIRED'],
            { rolledBack: true, dlpInvoked: true },
          );
          throw err;
        }
        release = requireOk(
          await releaseTaskClaimLeaseInTransaction(client, fixture.release),
          'RELEASE_DENY',
        );
        audit = requireOk(
          await appendAuditEventInTransaction(client, fixture.audit),
          'AUDIT_DENY',
        );
        if (fixture.evidence) {
          evidence = requireOk(
            await appendEvidenceInTransaction(client, fixture.evidence),
            'EVIDENCE_DENY',
          );
        }
      }

      return Object.freeze({
        ok: true,
        allowed: true,
        decision: TEST_ONLY_COMPOSITION_DECISIONS.COMMITTED,
        reasons: Object.freeze([
          'TEST_ONLY_DLP004_IN_TRANSACTION_COMPOSITION_COMMITTED',
        ]),
        classification: TEST_ONLY_COMPOSITION_PROOF_CLASS,
        operationalDispatchAuthorized: false,
        mutationExecuted: true,
        dlpInvoked: true,
        jtiConsumedDurable: true,
        committed: true,
        rolledBack: false,
        bind,
        release,
        audit,
        evidence,
        dbProvenContext,
        dlp004GovernanceRevision: DLP004_GOVERNANCE_REVISION,
        note: 'DURABILITY_NOT_PROVEN_UNTIL_TIER3_DISPOSABLE_POSTGRES_RUNS',
      });
    });

    invalidateContextsForTransaction(txnHandle);
    return committed;
  } catch (error) {
    invalidateContextsForTransaction(txnHandle);
    if (error && error.compositionDeny) {
      return error.compositionDeny;
    }
    if (error && error.layerResult) {
      return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_MUTATION, [
        error.message || 'LAYER_DENY',
        error.layerResult.decision,
        ...(error.layerResult.reasons || []),
      ], { rolledBack: true, dlpInvoked: true });
    }
    return compositionDeny(TEST_ONLY_COMPOSITION_DECISIONS.DENY_EXCEPTION, [
      error?.message || 'COMPOSITION_EXCEPTION',
    ], { rolledBack: true, dlpInvoked });
  }
}

export function assertOperationalDispatcherHardDeny(result) {
  if (!isPlainObject(result)) {
    return deny(DISPATCHER_DECISIONS.DENY_MALFORMED, ['RESULT_REQUIRED']);
  }
  if (result.mutationExecuted === true || result.dlpInvoked === true) {
    return deny(DISPATCHER_DECISIONS.DENY_OPERATIONAL_DISPATCH_DISABLED, [
      'UNEXPECTED_OPERATIONAL_MUTATION',
    ]);
  }
  if (result.ok === true && result.decision === DISPATCHER_DECISIONS.ALLOW) {
    return deny(DISPATCHER_DECISIONS.DENY_OPERATIONAL_DISPATCH_DISABLED, [
      'UNEXPECTED_OPERATIONAL_ALLOW',
    ]);
  }
  return allowContract(['HARD_DENY_BOUNDARY_INTACT'], {
    observedDecision: result.decision,
  });
}
