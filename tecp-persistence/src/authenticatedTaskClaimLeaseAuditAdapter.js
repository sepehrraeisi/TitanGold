/**
 * TECP-DLP-007 C1 — disposable authenticated Task/Claim/Lease/Audit composition.
 *
 * NON_OPERATIONAL proof only. TEST_ONLY identity. Not real Worker authentication.
 * Not MCP mutation control. Not production readiness. Does NOT seal public
 * DLP-001..004 APIs (residual R1).
 *
 * Architecture Option C1:
 * - Privileged adapter holds TEST_ONLY principal, policy, capabilityDeps, client
 * - Untrusted requests may supply only token + operationKey + bounded idempotency
 * - Phase 1 BOOTSTRAP: fresh authorize → bind InTransaction → Audit/Evidence
 * - Phase 2 LEASE_BOUND: validateWriteLease → private TEST_ONLY bridge → fresh
 *   authorizeWorkerOperation → release InTransaction → Audit/Evidence
 * - Exactly one withOwnedWriteLeaseTransaction per phase
 * - Never nest public DLP-004 bindTaskClaimLeaseWithAudit / releaseTaskClaimLeaseWithAudit
 * - Soft DENY must throw/abort so owned helper ROLLBACKs
 *
 * Residual R7: duplicates minimal DLP-004 orchestration glue (requireOk + owned txn);
 * frozen underlying Task/Claim/Lease/Audit business rules are reused, not reimplemented.
 */

import {
  APPROVED_GOVERNANCE_REVISION as DLP006_GOVERNANCE_REVISION,
  AUTHORIZATION_DECISIONS,
  authorizeWorkerOperation,
  createTrustedAuthorizationPolicyProvider,
  deriveActorIdFromPrincipalId,
  isBrandedAuthorizedInvocation,
  isBrandedTrustedAuthorizationPolicy,
  isBrandedTrustedAuthorizationPolicyProvider,
  rejectPriorAuthorizationReuse,
} from '../../tecp/src/authorizedInvocation.js';
import {
  CAPABILITY_ACTIONS,
  CAPABILITY_STAGES,
} from '../../tecp/src/workerCapabilityToken.js';
import {
  isBrandedVerifiedPrincipal,
  TRUST_LEVELS,
  ATTESTATION_KINDS,
} from '../../tecp/src/workerIdentity.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP003_GOVERNANCE_REVISION,
  AUDIT_EVIDENCE_DECISIONS,
  appendAuditEventInTransaction,
  appendEvidenceInTransaction,
} from './auditEvidenceRepository.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP002_GOVERNANCE_REVISION,
  COMPOSITION_DECISIONS,
  bindTaskClaimLeaseInTransaction,
  releaseTaskClaimLeaseInTransaction,
} from './taskClaimLeaseRepository.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP001_GOVERNANCE_REVISION,
  WRITE_LEASE_DECISIONS,
  validateWriteLease,
  withOwnedWriteLeaseTransaction,
} from './writeLeaseRepository.js';
import {
  BRIDGE_METADATA,
  authorizeWorkerOperationAgainstDbValidatedLease,
} from './dbValidatedLeaseAuthzBridge.js';

/** Approved governance revision for this disposable DLP-007 composition proof. */
export const APPROVED_GOVERNANCE_REVISION = 'DLP007_AUTHORIZATION_20261102';

export const AUTH_COMPOSITION_DECISIONS = Object.freeze({
  BOUND_AUTHENTICATED: 'BOUND_AUTHENTICATED',
  BOUND_AUTHENTICATED_REPLAY: 'BOUND_AUTHENTICATED_REPLAY',
  RELEASED_AUTHENTICATED: 'RELEASED_AUTHENTICATED',
  DENY_INVALID_INPUT: 'DENY_INVALID_INPUT',
  DENY_UNTRUSTED_REQUEST_FIELD: 'DENY_UNTRUSTED_REQUEST_FIELD',
  DENY_INVALID_GOVERNANCE_REVISION: 'DENY_INVALID_GOVERNANCE_REVISION',
  DENY_MISSING_PRIVILEGED_DEPS: 'DENY_MISSING_PRIVILEGED_DEPS',
  DENY_INVALID_PRINCIPAL: 'DENY_INVALID_PRINCIPAL',
  DENY_AUTHORIZATION: 'DENY_AUTHORIZATION',
  DENY_STAGE_VIOLATION: 'DENY_STAGE_VIOLATION',
  DENY_BOOTSTRAP_ESCALATION: 'DENY_BOOTSTRAP_ESCALATION',
  DENY_WRONG_ACTION: 'DENY_WRONG_ACTION',
  DENY_LEASE_VALIDATION: 'DENY_LEASE_VALIDATION',
  DENY_BRIDGE_FAILURE: 'DENY_BRIDGE_FAILURE',
  DENY_PRIOR_INVOCATION_REUSE: 'DENY_PRIOR_INVOCATION_REUSE',
  DENY_ACTOR_MISMATCH: 'DENY_ACTOR_MISMATCH',
  DENY_BIND: 'DENY_BIND',
  DENY_RELEASE: 'DENY_RELEASE',
  DENY_AUDIT: 'DENY_AUDIT',
  DENY_EVIDENCE: 'DENY_EVIDENCE',
  DENY_IDEMPOTENCY_CONFLICT: 'DENY_IDEMPOTENCY_CONFLICT',
  DENY_CLAIM_CONFLICT: 'DENY_CLAIM_CONFLICT',
  DENY_FOREIGN_ACTOR: 'DENY_FOREIGN_ACTOR',
  DENY_STALE_FENCING_EPOCH: 'DENY_STALE_FENCING_EPOCH',
  DENY_NO_TRANSACTION_OWNERSHIP: 'DENY_NO_TRANSACTION_OWNERSHIP',
  DENY_OPERATION_CONTRACT: 'DENY_OPERATION_CONTRACT',
  DENY_POLICY_PIN: 'DENY_POLICY_PIN',
  DENY_INVOCATION_POLICY_MISMATCH: 'DENY_INVOCATION_POLICY_MISMATCH',
  DENY_DEADLOCK: 'DENY_DEADLOCK',
  BLOCKED_DB_FAILURE: 'BLOCKED_DB_FAILURE',
});

export const OPERATION_PHASES = Object.freeze({
  BOOTSTRAP_BIND: 'BOOTSTRAP_BIND',
  LEASE_BOUND_RELEASE: 'LEASE_BOUND_RELEASE',
});

/** Fields forbidden on untrusted operation requests (authority-bearing). */
export const FORBIDDEN_REQUEST_FIELDS = Object.freeze([
  'principal',
  'actorId',
  'workerId',
  'policy',
  'policyProvider',
  'capabilityDeps',
  'verifiedClaims',
  'decodedToken',
  'expectation',
  'serverExpectation',
  'leaseSnapshotReader',
  'leaseReader',
  'leaseSnapshot',
  'client',
  'db',
  'database',
  'fencingEpoch',
  'authorizedInvocation',
  'invocation',
  'priorInvocation',
  'governanceRevision',
  'compositionGovernanceRevision',
  'bind',
  'release',
  'audit',
  'evidence',
  'taskId',
  'resourceType',
  'resourceKey',
  'resourceId',
  'leaseKey',
  'leaseId',
  'claimKey',
  'ttlMs',
  'expectedVersion',
  'getVerifiedPrincipal',
  'operationContracts',
  'deps',
]);

const ALLOWED_REQUEST_FIELDS = Object.freeze([
  'capabilityToken',
  'operationKey',
  'idempotency',
]);

const ALLOWED_IDEMPOTENCY_FIELDS = Object.freeze([
  'compositionIdempotencyKey',
  'leaseIdempotencyKey',
  'auditIdempotencyKey',
  'auditEventId',
  'evidenceIdempotencyKey',
  'evidenceId',
]);

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveSafeInt(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function requireClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('injected PostgreSQL client with query() is required');
  }
}

function compositionResult(decision, extra = {}) {
  const ok = decision === AUTH_COMPOSITION_DECISIONS.BOUND_AUTHENTICATED
    || decision === AUTH_COMPOSITION_DECISIONS.BOUND_AUTHENTICATED_REPLAY
    || decision === AUTH_COMPOSITION_DECISIONS.RELEASED_AUTHENTICATED;
  return freezeDeep({
    ok,
    decision,
    reasons: ok ? [] : [decision],
    bind: null,
    release: null,
    audit: null,
    evidence: null,
    authorization: null,
    leaseValidation: null,
    bridgeMetadata: BRIDGE_METADATA,
    operational: false,
    realWorkerAuthenticated: false,
    databaseBackedLeaseReader: false,
    ...extra,
  });
}

function isDbFailure(error) {
  if (!error) return false;
  const code = error.code;
  if (typeof code === 'string' && /^08/.test(code)) return true;
  if (code === '57P01' || code === '57P02' || code === '57P03') return true;
  const message = String(error.message || '');
  return /connect|Connection terminated|not queryable|ECONNREFUSED|ECONNRESET|socket/i.test(message);
}

/**
 * M4: PostgreSQL deadlock SQLSTATE 40P01 (and message fallback) fail closed.
 * Detected deadlocks map to DENY_DEADLOCK after owned-txn ROLLBACK.
 * No unbounded retries. Coverage is bounded (not exhaustive concurrency proof).
 */
function isDeadlock(error) {
  return Boolean(error) && (error.code === '40P01' || /deadlock detected/i.test(String(error.message || '')));
}

/**
 * M2: obtain one branded immutable policy for the phase and pin it via a
 * frozen DLP-006 provider wrapping that exact policy object. Subsequent
 * authorizeWorkerOperation calls cannot observe a rotating provider's
 * alternate policy for the remainder of this phase.
 *
 * Does not claim absolute protection against external policy revocation races
 * outside the provider (accepted offline residual).
 */
function pinTrustedPolicyForPhase(policyProvider) {
  let policyResult;
  try {
    policyResult = policyProvider.getPolicy();
  } catch {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN, {
      reasons: [AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN, 'POLICY_PROVIDER_THREW'],
    });
  }
  if (!policyResult || policyResult.available !== true || !policyResult.policy) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN, {
      reasons: [
        AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN,
        policyResult && policyResult.unbranded === true
          ? 'UNBRANDED_POLICY'
          : 'POLICY_UNAVAILABLE',
      ],
    });
  }
  if (!isBrandedTrustedAuthorizationPolicy(policyResult.policy)) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN, {
      reasons: [AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN, 'POLICY_NOT_BRANDED'],
    });
  }
  if (policyResult.policy.governanceRevision !== DLP006_GOVERNANCE_REVISION) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN, {
      reasons: [
        AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN,
        'GOVERNANCE_REVISION_MISMATCH',
      ],
    });
  }
  // Pin the exact branded policy object — not a caller-owned reconstruction.
  const pinnedProvider = createTrustedAuthorizationPolicyProvider(policyResult.policy);
  if (!isBrandedTrustedAuthorizationPolicyProvider(pinnedProvider)) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN, {
      reasons: [AUTH_COMPOSITION_DECISIONS.DENY_POLICY_PIN, 'PINNED_PROVIDER_UNBRANDED'],
    });
  }
  return Object.freeze({
    policy: policyResult.policy,
    pinnedProvider,
  });
}

function assertInvocationMatchesPinnedOperation(invocation, operation) {
  if (!invocation || !operation) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_INVOCATION_POLICY_MISMATCH);
  }
  if (invocation.operationKey !== operation.operationKey
    || invocation.capabilityStage !== operation.capabilityStage
    || invocation.action !== operation.action
    || invocation.taskId !== operation.taskId
    || invocation.resourceType !== operation.resourceType
    || invocation.resourceId !== operation.resourceId
    || (operation.leaseId != null && invocation.leaseId !== operation.leaseId)
    || (operation.leaseId == null && invocation.leaseId != null)) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_INVOCATION_POLICY_MISMATCH, {
      reasons: [
        AUTH_COMPOSITION_DECISIONS.DENY_INVOCATION_POLICY_MISMATCH,
        'INVOCATION_DOES_NOT_MATCH_PINNED_OPERATION',
      ],
    });
  }
}

function isUniqueViolation(error) {
  return Boolean(error) && error.code === '23505';
}

function uniqueHint(error) {
  return String(error.constraint || error.table || error.detail || error.message || '');
}

class AuthCompositionAbort extends Error {
  constructor(decision, extra = {}) {
    super(decision);
    this.name = 'AuthCompositionAbort';
    this.authCompositionDecision = decision;
    this.extra = extra;
  }
}

function abort(decision, extra = {}) {
  throw new AuthCompositionAbort(decision, extra);
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

function rejectUntrustedRequest(request) {
  if (!isPlainObject(request)) {
    return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT);
  }
  for (const key of Object.keys(request)) {
    if (FORBIDDEN_REQUEST_FIELDS.includes(key)) {
      return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD, {
        reasons: [AUTH_COMPOSITION_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD, `FORBIDDEN_FIELD:${key}`],
        forbiddenField: key,
      });
    }
    if (!ALLOWED_REQUEST_FIELDS.includes(key)) {
      return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD, {
        reasons: [AUTH_COMPOSITION_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD, `UNKNOWN_FIELD:${key}`],
        forbiddenField: key,
      });
    }
  }
  if (!isNonEmptyString(request.capabilityToken) || !isNonEmptyString(request.operationKey)) {
    return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT);
  }
  if (request.idempotency !== undefined) {
    if (!isPlainObject(request.idempotency)) {
      return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT);
    }
    for (const key of Object.keys(request.idempotency)) {
      if (!ALLOWED_IDEMPOTENCY_FIELDS.includes(key)) {
        return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD, {
          reasons: [
            AUTH_COMPOSITION_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD,
            `FORBIDDEN_IDEMPOTENCY_FIELD:${key}`,
          ],
          forbiddenField: key,
        });
      }
      if (!isNonEmptyString(request.idempotency[key])) {
        return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT);
      }
    }
  }
  return null;
}

function validateBindContract(contract) {
  return isPlainObject(contract)
    && contract.phase === OPERATION_PHASES.BOOTSTRAP_BIND
    && isNonEmptyString(contract.claimKey)
    && isNonEmptyString(contract.leaseKey)
    && isPositiveSafeInt(contract.ttlMs)
    && isNonEmptyString(contract.auditEventType);
}

function validateReleaseContract(contract) {
  return isPlainObject(contract)
    && contract.phase === OPERATION_PHASES.LEASE_BOUND_RELEASE
    && isNonEmptyString(contract.claimKey)
    && isNonEmptyString(contract.auditEventType);
}

function mapBindDecision(bindResult) {
  if (!bindResult || bindResult.ok) return null;
  switch (bindResult.decision) {
    case COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT:
      return AUTH_COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT;
    case COMPOSITION_DECISIONS.DENY_CLAIM_CONFLICT:
      return AUTH_COMPOSITION_DECISIONS.DENY_CLAIM_CONFLICT;
    case COMPOSITION_DECISIONS.DENY_FOREIGN_ACTOR:
      return AUTH_COMPOSITION_DECISIONS.DENY_FOREIGN_ACTOR;
    case COMPOSITION_DECISIONS.DENY_STALE_FENCING_EPOCH:
      return AUTH_COMPOSITION_DECISIONS.DENY_STALE_FENCING_EPOCH;
    case COMPOSITION_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP:
      return AUTH_COMPOSITION_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP;
    case COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE:
      return AUTH_COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE;
    case COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION:
      return AUTH_COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION;
    case COMPOSITION_DECISIONS.DENY_INVALID_INPUT:
      return AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT;
    default:
      return AUTH_COMPOSITION_DECISIONS.DENY_BIND;
  }
}

function mapReleaseDecision(releaseResult) {
  if (!releaseResult || releaseResult.ok) return null;
  switch (releaseResult.decision) {
    case COMPOSITION_DECISIONS.DENY_FOREIGN_ACTOR:
      return AUTH_COMPOSITION_DECISIONS.DENY_FOREIGN_ACTOR;
    case COMPOSITION_DECISIONS.DENY_STALE_FENCING_EPOCH:
      return AUTH_COMPOSITION_DECISIONS.DENY_STALE_FENCING_EPOCH;
    case COMPOSITION_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP:
      return AUTH_COMPOSITION_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP;
    case COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE:
      return AUTH_COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE;
    case COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION:
      return AUTH_COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION;
    case COMPOSITION_DECISIONS.DENY_INVALID_INPUT:
      return AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT;
    default:
      return AUTH_COMPOSITION_DECISIONS.DENY_RELEASE;
  }
}

function mapAuditDecision(auditResult) {
  if (!auditResult || auditResult.ok) return null;
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT) {
    return AUTH_COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT;
  }
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION) {
    return AUTH_COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION;
  }
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_INPUT) {
    return AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT;
  }
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP) {
    return AUTH_COMPOSITION_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP;
  }
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE) {
    return AUTH_COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE;
  }
  return AUTH_COMPOSITION_DECISIONS.DENY_AUDIT;
}

function mapEvidenceDecision(evidenceResult) {
  if (!evidenceResult || evidenceResult.ok) return null;
  if (evidenceResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT) {
    return AUTH_COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT;
  }
  if (evidenceResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION) {
    return AUTH_COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION;
  }
  if (evidenceResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_INPUT) {
    return AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT;
  }
  if (evidenceResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP) {
    return AUTH_COMPOSITION_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP;
  }
  if (evidenceResult.decision === AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE) {
    return AUTH_COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE;
  }
  return AUTH_COMPOSITION_DECISIONS.DENY_EVIDENCE;
}

function requireOk(layerResult, mapFn, fallback) {
  if (layerResult && layerResult.ok) return layerResult;
  const decision = mapFn(layerResult) || fallback;
  abort(decision, {
    layerDecision: layerResult ? layerResult.decision : null,
    layer: layerResult || null,
  });
  return layerResult;
}

function mapCaughtError(error) {
  if (error instanceof AuthCompositionAbort) {
    return compositionResult(error.authCompositionDecision, error.extra);
  }
  if (error && (error.name === 'CompositionAbort' || error.compositionDecision)) {
    const mapped = mapBindDecision({
      ok: false,
      decision: error.compositionDecision,
    }) || mapReleaseDecision({
      ok: false,
      decision: error.compositionDecision,
    }) || AUTH_COMPOSITION_DECISIONS.DENY_BIND;
    return compositionResult(mapped, {
      layerDecision: error.compositionDecision,
      ...(error.extra || {}),
    });
  }
  if (isDeadlock(error)) {
    return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_DEADLOCK, {
      errorClass: error.code || '40P01',
      rolledBack: true,
    });
  }
  if (isUniqueViolation(error)) {
    const hint = uniqueHint(error);
    if (/idempotency/i.test(hint)) {
      return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    }
    return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_CLAIM_CONFLICT);
  }
  if (isDbFailure(error)) {
    return compositionResult(AUTH_COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE, {
      errorClass: error.code || error.name || 'DB_FAILURE',
      // Do not claim ROLLBACK succeeded if the connection failed before confirmation.
      rollbackConfirmed: false,
    });
  }
  return null;
}

function resolvePrincipal(getVerifiedPrincipal) {
  let principal;
  try {
    principal = getVerifiedPrincipal();
  } catch {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_INVALID_PRINCIPAL, {
      reasons: [AUTH_COMPOSITION_DECISIONS.DENY_INVALID_PRINCIPAL, 'PRINCIPAL_PROVIDER_THREW'],
    });
  }
  const err = assertTestOnlyPrincipal(principal);
  if (err) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_INVALID_PRINCIPAL, {
      reasons: [AUTH_COMPOSITION_DECISIONS.DENY_INVALID_PRINCIPAL, err],
    });
  }
  return principal;
}

function requireFreshAuthorization(authz) {
  if (!authz || !authz.allowed || !isBrandedAuthorizedInvocation(authz.invocation)) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION, {
      authorization: authz || null,
      reasons: [
        AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION,
        (authz && authz.decision) || AUTHORIZATION_DECISIONS.DENY_MALFORMED_REQUEST,
        ...((authz && authz.reasons) || []),
      ],
    });
  }
  return authz;
}

function buildAuditInput(invocation, contract, idempotency, includeEvidence) {
  const actorId = invocation.actorId;
  if (actorId !== deriveActorIdFromPrincipalId(invocation.principalId)) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_ACTOR_MISMATCH);
  }
  const audit = {
    eventId: idempotency.auditEventId,
    eventType: contract.auditEventType,
    taskId: invocation.taskId,
    actorId,
    governanceRevision: DLP003_GOVERNANCE_REVISION,
    idempotencyKey: idempotency.auditIdempotencyKey,
  };
  let evidence = null;
  if (includeEvidence) {
    if (!isNonEmptyString(idempotency.evidenceId)
      || !isNonEmptyString(idempotency.evidenceIdempotencyKey)
      || !isNonEmptyString(contract.evidenceType)
      || !isNonEmptyString(contract.evidenceRef)) {
      abort(AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT, {
        reasons: [AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT, 'EVIDENCE_CONTRACT_INCOMPLETE'],
      });
    }
    evidence = {
      evidenceId: idempotency.evidenceId,
      taskId: invocation.taskId,
      actorId,
      governanceRevision: DLP003_GOVERNANCE_REVISION,
      evidenceType: contract.evidenceType,
      evidenceRef: contract.evidenceRef,
      idempotencyKey: idempotency.evidenceIdempotencyKey,
    };
  }
  return { audit, evidence };
}

async function appendAuditAndOptionalEvidence(client, audit, evidence) {
  const auditOut = await appendAuditEventInTransaction(client, audit);
  requireOk(auditOut, mapAuditDecision, AUTH_COMPOSITION_DECISIONS.DENY_AUDIT);

  let evidenceOut = null;
  if (evidence) {
    evidenceOut = await appendEvidenceInTransaction(client, evidence);
    requireOk(evidenceOut, mapEvidenceDecision, AUTH_COMPOSITION_DECISIONS.DENY_EVIDENCE);
  }
  return { auditOut, evidenceOut };
}

/**
 * Read current fencing epoch for a resource as a DB lookup hint only.
 * Token fencing is never treated as lease authority; authorizeWorkerOperation
 * still requires signed token fencing to match the DB-projected snapshot.
 */
async function readCurrentFencingEpochHint(client, resourceType, resourceKey) {
  const result = await client.query(
    `SELECT fencing_epoch::bigint AS fencing_epoch
       FROM dlp_write_lease
      WHERE resource_type = $1
        AND resource_key = $2
      FOR SHARE`,
    [resourceType, resourceKey],
  );
  if (result.rowCount !== 1) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_LEASE_VALIDATION, {
      reasons: [
        AUTH_COMPOSITION_DECISIONS.DENY_LEASE_VALIDATION,
        WRITE_LEASE_DECISIONS.DENY_NOT_FOUND,
      ],
    });
  }
  const fencingEpoch = Number(result.rows[0].fencing_epoch);
  if (!Number.isSafeInteger(fencingEpoch) || fencingEpoch < 0) {
    abort(AUTH_COMPOSITION_DECISIONS.DENY_LEASE_VALIDATION, {
      reasons: [
        AUTH_COMPOSITION_DECISIONS.DENY_LEASE_VALIDATION,
        'INVALID_DB_FENCING_EPOCH',
      ],
    });
  }
  return fencingEpoch;
}

function validatePrivilegedDeps(deps) {
  if (!isPlainObject(deps)) return 'DEPS_REQUIRED';
  if (!deps.client || typeof deps.client.query !== 'function') return 'CLIENT_REQUIRED';
  if (typeof deps.getVerifiedPrincipal !== 'function') return 'PRINCIPAL_PROVIDER_REQUIRED';
  if (!isBrandedTrustedAuthorizationPolicyProvider(deps.policyProvider)) {
    return 'BRANDED_POLICY_PROVIDER_REQUIRED';
  }
  if (!isPlainObject(deps.capabilityDeps)) return 'CAPABILITY_DEPS_REQUIRED';
  if (!deps.capabilityDeps.clock || typeof deps.capabilityDeps.clock.now !== 'function') {
    return 'CLOCK_REQUIRED';
  }
  if (!isPlainObject(deps.operationContracts)) return 'OPERATION_CONTRACTS_REQUIRED';
  return null;
}

/**
 * Privileged TEST_ONLY factory (M1 / residual R5 — ACCEPTED_OFFLINE_ONLY).
 * Creation/injection must be restricted to the trusted test harness.
 * A publicly callable factory is not itself a security boundary without that
 * restriction. Untrusted execute* request objects cannot replace these deps.
 *
 * @param {object} privilegedDeps
 * @param {object} privilegedDeps.client disposable PostgreSQL client
 * @param {function(): object} privilegedDeps.getVerifiedPrincipal
 * @param {object} privilegedDeps.policyProvider branded DLP-006 policy provider
 * @param {object} privilegedDeps.capabilityDeps DLP-005 verify deps
 * @param {object} privilegedDeps.operationContracts server-controlled persistence contracts
 */
export function createAuthenticatedTaskClaimLeaseAuditAdapter(privilegedDeps) {
  const depError = validatePrivilegedDeps(privilegedDeps);
  if (depError) {
    throw new TypeError(`privileged deps invalid: ${depError}`);
  }

  // Capture privileged references once at construction. Request objects never
  // rebind these (see FORBIDDEN_REQUEST_FIELDS + rejectUntrustedRequest).
  const client = privilegedDeps.client;
  const getVerifiedPrincipal = privilegedDeps.getVerifiedPrincipal;
  const policyProvider = privilegedDeps.policyProvider;
  const capabilityDeps = privilegedDeps.capabilityDeps;
  const operationContracts = Object.freeze({ ...privilegedDeps.operationContracts });

  requireClient(client);

  /**
   * Phase 1 — BOOTSTRAP bind inside one short owned transaction.
   */
  async function executeAuthenticatedBind(untrustedRequest) {
    const rejected = rejectUntrustedRequest(untrustedRequest);
    if (rejected) return rejected;

    const contract = operationContracts[untrustedRequest.operationKey];
    if (!validateBindContract(contract)) {
      return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_OPERATION_CONTRACT);
    }

    const idempotency = untrustedRequest.idempotency || {};
    if (!isNonEmptyString(idempotency.compositionIdempotencyKey)
      || !isNonEmptyString(idempotency.leaseIdempotencyKey)
      || !isNonEmptyString(idempotency.auditIdempotencyKey)
      || !isNonEmptyString(idempotency.auditEventId)) {
      return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT);
    }

    try {
      return await withOwnedWriteLeaseTransaction(client, async () => {
        const principal = resolvePrincipal(getVerifiedPrincipal);

        // Reject any attempt to pass a prior AuthorizedInvocation as standing authority.
        if (Object.prototype.hasOwnProperty.call(untrustedRequest, 'authorizedInvocation')
          || Object.prototype.hasOwnProperty.call(untrustedRequest, 'priorInvocation')) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_PRIOR_INVOCATION_REUSE);
        }

        // M2: pin one branded policy for the entire BOOTSTRAP phase.
        const { policy: pinnedPolicy, pinnedProvider } = pinTrustedPolicyForPhase(policyProvider);
        const pinnedOperation = pinnedPolicy.getOperation(untrustedRequest.operationKey);
        if (!pinnedOperation) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION, {
            reasons: [
              AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION,
              'OPERATION_NOT_IN_POLICY',
            ],
          });
        }
        if (pinnedOperation.capabilityStage !== CAPABILITY_STAGES.BOOTSTRAP_REQUEST
          || pinnedOperation.action !== CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_STAGE_VIOLATION);
        }

        let authz;
        try {
          authz = authorizeWorkerOperation(
            {
              capabilityToken: untrustedRequest.capabilityToken,
              operationKey: untrustedRequest.operationKey,
              principal,
            },
            {
              policyProvider: pinnedProvider,
              capabilityDeps,
            },
          );
        } catch {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION, {
            reasons: [
              AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION,
              'AUTHORIZE_THREW',
            ],
          });
        }
        authz = requireFreshAuthorization(authz);
        const invocation = authz.invocation;
        assertInvocationMatchesPinnedOperation(invocation, pinnedOperation);

        if (invocation.capabilityStage !== CAPABILITY_STAGES.BOOTSTRAP_REQUEST
          || invocation.action !== CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_STAGE_VIOLATION);
        }

        const actorId = invocation.actorId;
        if (actorId !== deriveActorIdFromPrincipalId(principal.principalId)) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_ACTOR_MISMATCH);
        }

        // Persistence inputs come from the pinned-operation-consistent invocation only.
        const bindInput = {
          taskId: invocation.taskId,
          actorId,
          resourceType: invocation.resourceType,
          resourceKey: invocation.resourceId,
          claimKey: contract.claimKey,
          leaseKey: contract.leaseKey,
          governanceRevision: DLP002_GOVERNANCE_REVISION,
          compositionIdempotencyKey: idempotency.compositionIdempotencyKey,
          leaseIdempotencyKey: idempotency.leaseIdempotencyKey,
          ttlMs: contract.ttlMs,
        };

        const bind = await bindTaskClaimLeaseInTransaction(client, bindInput);
        requireOk(bind, mapBindDecision, AUTH_COMPOSITION_DECISIONS.DENY_BIND);

        const includeEvidence = contract.includeEvidence === true;
        const { audit, evidence } = buildAuditInput(
          invocation,
          contract,
          idempotency,
          includeEvidence,
        );
        const { auditOut, evidenceOut } = await appendAuditAndOptionalEvidence(
          client,
          audit,
          evidence,
        );

        const replay = bind.decision === COMPOSITION_DECISIONS.REPLAY
          && auditOut.decision === AUDIT_EVIDENCE_DECISIONS.REPLAY;

        return compositionResult(
          replay
            ? AUTH_COMPOSITION_DECISIONS.BOUND_AUTHENTICATED_REPLAY
            : AUTH_COMPOSITION_DECISIONS.BOUND_AUTHENTICATED,
          {
            bind,
            audit: auditOut,
            evidence: evidenceOut,
            authorization: {
              decision: authz.decision,
              operationKey: invocation.operationKey,
              capabilityStage: invocation.capabilityStage,
              action: invocation.action,
              actorId: invocation.actorId,
              principalId: invocation.principalId,
              taskId: invocation.taskId,
              resourceType: invocation.resourceType,
              resourceId: invocation.resourceId,
              jti: invocation.jti,
              // Explicit: artifact is proof-local, not standing authority.
              standingAuthority: false,
            },
            lease: bind.lease
              ? {
                leaseKey: bind.lease.leaseKey,
                fencingEpoch: bind.lease.fencingEpoch,
                version: bind.lease.version,
                resourceType: bind.lease.resourceType,
                resourceKey: bind.lease.resourceKey,
                taskId: bind.lease.taskId,
              }
              : null,
          },
        );
      });
    } catch (error) {
      const mapped = mapCaughtError(error);
      if (mapped) return mapped;
      throw error;
    }
  }

  /**
   * Phase 2 — LEASE_BOUND release inside a NEW short owned transaction.
   */
  async function executeAuthenticatedRelease(untrustedRequest) {
    const rejected = rejectUntrustedRequest(untrustedRequest);
    if (rejected) return rejected;

    const contract = operationContracts[untrustedRequest.operationKey];
    if (!validateReleaseContract(contract)) {
      return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_OPERATION_CONTRACT);
    }

    const idempotency = untrustedRequest.idempotency || {};
    if (!isNonEmptyString(idempotency.auditIdempotencyKey)
      || !isNonEmptyString(idempotency.auditEventId)) {
      return compositionResult(AUTH_COMPOSITION_DECISIONS.DENY_INVALID_INPUT);
    }

    try {
      return await withOwnedWriteLeaseTransaction(client, async () => {
        const principal = resolvePrincipal(getVerifiedPrincipal);
        const actorId = deriveActorIdFromPrincipalId(principal.principalId);

        // M2: pin one branded policy for the entire LEASE_BOUND phase.
        const { policy: pinnedPolicy, pinnedProvider } = pinTrustedPolicyForPhase(policyProvider);
        const operation = pinnedPolicy.getOperation(untrustedRequest.operationKey);
        if (!operation) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION, {
            reasons: [
              AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION,
              'OPERATION_NOT_IN_POLICY',
            ],
          });
        }
        if (operation.capabilityStage !== CAPABILITY_STAGES.LEASE_BOUND) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_STAGE_VIOLATION);
        }
        if (operation.action !== CAPABILITY_ACTIONS.RELEASE_TASK) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_WRONG_ACTION, {
            reasons: [
              AUTH_COMPOSITION_DECISIONS.DENY_WRONG_ACTION,
              `ACTION:${operation.action}`,
            ],
          });
        }
        if (!isNonEmptyString(operation.leaseId)) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_OPERATION_CONTRACT);
        }

        // DB fencing hint (authoritative row). Token fencing is NOT lease authority.
        const fencingEpochHint = await readCurrentFencingEpochHint(
          client,
          operation.resourceType,
          operation.resourceId,
        );

        const leaseValidation = await validateWriteLease(client, {
          resourceType: operation.resourceType,
          resourceKey: operation.resourceId,
          leaseKey: operation.leaseId,
          actorId,
          taskId: operation.taskId,
          governanceRevision: DLP001_GOVERNANCE_REVISION,
          fencingEpoch: fencingEpochHint,
        });
        if (!leaseValidation || !leaseValidation.ok || !leaseValidation.lease) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_LEASE_VALIDATION, {
            leaseValidation,
            reasons: [
              AUTH_COMPOSITION_DECISIONS.DENY_LEASE_VALIDATION,
              (leaseValidation && leaseValidation.decision)
                || WRITE_LEASE_DECISIONS.DENY_NOT_FOUND,
            ],
          });
        }

        // M3: authorize via bridge helper that never returns the private reader.
        let bridgeOut;
        try {
          bridgeOut = authorizeWorkerOperationAgainstDbValidatedLease({
            validatedLease: leaseValidation.lease,
            ownerPrincipalId: principal.principalId,
            ownerActorId: actorId,
            request: {
              capabilityToken: untrustedRequest.capabilityToken,
              operationKey: untrustedRequest.operationKey,
              principal,
            },
            deps: {
              policyProvider: pinnedProvider,
              capabilityDeps,
            },
          });
        } catch (bridgeError) {
          if (bridgeError && bridgeError.message === 'CALLER_LEASE_READER_FORBIDDEN') {
            abort(AUTH_COMPOSITION_DECISIONS.DENY_BRIDGE_FAILURE, {
              reasons: [
                AUTH_COMPOSITION_DECISIONS.DENY_BRIDGE_FAILURE,
                'CALLER_LEASE_READER_FORBIDDEN',
              ],
            });
          }
          abort(AUTH_COMPOSITION_DECISIONS.DENY_BRIDGE_FAILURE, {
            reasons: [
              AUTH_COMPOSITION_DECISIONS.DENY_BRIDGE_FAILURE,
              String(bridgeError && bridgeError.message ? bridgeError.message : bridgeError),
            ],
          });
        }

        const authz = requireFreshAuthorization(bridgeOut.authorization);
        const invocation = authz.invocation;
        const authzRow = bridgeOut.authzRow;
        assertInvocationMatchesPinnedOperation(invocation, operation);

        if (invocation.capabilityStage !== CAPABILITY_STAGES.LEASE_BOUND
          || invocation.action !== CAPABILITY_ACTIONS.RELEASE_TASK) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_STAGE_VIOLATION);
        }
        if (invocation.leaseId !== authzRow.leaseId
          || invocation.fencingEpoch !== authzRow.fencingEpoch
          || invocation.taskId !== leaseValidation.lease.taskId
          || invocation.resourceType !== leaseValidation.lease.resourceType
          || invocation.resourceId !== leaseValidation.lease.resourceKey
          || invocation.actorId !== actorId) {
          abort(AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION, {
            reasons: [
              AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION,
              'INVOCATION_DB_INCONSISTENT',
            ],
          });
        }

        // Prior AuthorizedInvocation is never standing authority for this phase.
        if (contract.priorInvocationForReuseCheck) {
          const reuse = rejectPriorAuthorizationReuse(
            contract.priorInvocationForReuseCheck,
            untrustedRequest.operationKey,
          );
          if (reuse.allowed) {
            abort(AUTH_COMPOSITION_DECISIONS.DENY_PRIOR_INVOCATION_REUSE);
          }
        }

        const releaseInput = {
          taskId: leaseValidation.lease.taskId,
          actorId: invocation.actorId,
          resourceType: leaseValidation.lease.resourceType,
          resourceKey: leaseValidation.lease.resourceKey,
          claimKey: contract.claimKey,
          leaseKey: leaseValidation.lease.leaseKey,
          governanceRevision: DLP002_GOVERNANCE_REVISION,
          fencingEpoch: leaseValidation.lease.fencingEpoch,
          expectedVersion: leaseValidation.lease.version,
        };

        const release = await releaseTaskClaimLeaseInTransaction(client, releaseInput);
        requireOk(release, mapReleaseDecision, AUTH_COMPOSITION_DECISIONS.DENY_RELEASE);

        const includeEvidence = contract.includeEvidence === true;
        const { audit, evidence } = buildAuditInput(
          invocation,
          contract,
          idempotency,
          includeEvidence,
        );
        const { auditOut, evidenceOut } = await appendAuditAndOptionalEvidence(
          client,
          audit,
          evidence,
        );

        return compositionResult(AUTH_COMPOSITION_DECISIONS.RELEASED_AUTHENTICATED, {
          release,
          audit: auditOut,
          evidence: evidenceOut,
          leaseValidation: {
            decision: leaseValidation.decision,
            leaseKey: leaseValidation.lease.leaseKey,
            fencingEpoch: leaseValidation.lease.fencingEpoch,
            version: leaseValidation.lease.version,
          },
          authorization: {
            decision: authz.decision,
            operationKey: invocation.operationKey,
            capabilityStage: invocation.capabilityStage,
            action: invocation.action,
            actorId: invocation.actorId,
            principalId: invocation.principalId,
            leaseId: invocation.leaseId,
            fencingEpoch: invocation.fencingEpoch,
            jti: invocation.jti,
            standingAuthority: false,
          },
          bridgeRow: {
            leaseId: authzRow.leaseId,
            resourceId: authzRow.resourceId,
            fencingEpoch: authzRow.fencingEpoch,
          },
        });
      });
    } catch (error) {
      const mapped = mapCaughtError(error);
      if (mapped) return mapped;
      throw error;
    }
  }

  return Object.freeze({
    kind: 'TEST_ONLY_AUTHENTICATED_COMPOSITION_ADAPTER',
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    architecture: 'OPTION_C1',
    operational: false,
    realWorkerAuthenticated: false,
    databaseBackedLeaseReader: false,
    bridgeMetadata: BRIDGE_METADATA,
    executeAuthenticatedBind,
    executeAuthenticatedRelease,
    // Explicit non-exports: no getLeaseReader / no exposeBridge.
  });
}

export {
  DLP001_GOVERNANCE_REVISION,
  DLP002_GOVERNANCE_REVISION,
  DLP003_GOVERNANCE_REVISION,
  DLP006_GOVERNANCE_REVISION,
  BRIDGE_METADATA,
  AUTHORIZATION_DECISIONS,
  WRITE_LEASE_DECISIONS,
};

/**
 * M1 / R5: Privileged factory construction is a TEST_ONLY trust root.
 * Untrusted request objects cannot supply client, principal, policyProvider,
 * capabilityDeps, operationContracts or lease readers (FORBIDDEN_REQUEST_FIELDS).
 * This is ACCEPTED_OFFLINE_ONLY residual R5 — not an untrusted Worker API.
 */
