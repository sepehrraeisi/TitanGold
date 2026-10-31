/**
 * TECP-DLP-004 disposable Task/Claim/Lease + Audit/Evidence composition.
 *
 * NON_OPERATIONAL proof only. No trusted Worker authentication.
 * Not a Cursor execution capability. Not MCP action tooling.
 * No chained-hash integrity claim. No long-running lifecycle transaction.
 *
 * Architecture Option B:
 * - Additive DLP-002 InTransaction exports (no Task/Claim rule duplication)
 * - DLP-003 append APIs inside the same owned transaction per phase
 * - Two short caller-owned phases: bind+audit(+evidence), release+audit(+evidence)
 */

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
  withOwnedWriteLeaseTransaction,
} from './writeLeaseRepository.js';

/** Approved governance revision for this disposable DLP-004 composition proof. */
export const APPROVED_GOVERNANCE_REVISION = 'DLP004_AUTHORIZATION_20261031';

export const LIFECYCLE_DECISIONS = Object.freeze({
  BOUND_WITH_AUDIT: 'BOUND_WITH_AUDIT',
  BOUND_WITH_AUDIT_REPLAY: 'BOUND_WITH_AUDIT_REPLAY',
  RELEASED_WITH_AUDIT: 'RELEASED_WITH_AUDIT',
  DENY_INVALID_INPUT: 'DENY_INVALID_INPUT',
  DENY_INVALID_GOVERNANCE_REVISION: 'DENY_INVALID_GOVERNANCE_REVISION',
  DENY_BIND: 'DENY_BIND',
  DENY_RELEASE: 'DENY_RELEASE',
  DENY_AUDIT: 'DENY_AUDIT',
  DENY_EVIDENCE: 'DENY_EVIDENCE',
  DENY_IDEMPOTENCY_CONFLICT: 'DENY_IDEMPOTENCY_CONFLICT',
  DENY_CLAIM_CONFLICT: 'DENY_CLAIM_CONFLICT',
  DENY_FOREIGN_ACTOR: 'DENY_FOREIGN_ACTOR',
  DENY_STALE_FENCING_EPOCH: 'DENY_STALE_FENCING_EPOCH',
  DENY_NO_TRANSACTION_OWNERSHIP: 'DENY_NO_TRANSACTION_OWNERSHIP',
  BLOCKED_DB_FAILURE: 'BLOCKED_DB_FAILURE',
});

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function requireClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('injected PostgreSQL client with query() is required');
  }
}

function lifecycleResult(decision, extra = {}) {
  const ok = decision === LIFECYCLE_DECISIONS.BOUND_WITH_AUDIT
    || decision === LIFECYCLE_DECISIONS.BOUND_WITH_AUDIT_REPLAY
    || decision === LIFECYCLE_DECISIONS.RELEASED_WITH_AUDIT;
  return freezeDeep({
    ok,
    decision,
    reasons: ok ? [] : [decision],
    bind: null,
    release: null,
    audit: null,
    evidence: null,
    operational: false,
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

function isUniqueViolation(error) {
  return Boolean(error) && error.code === '23505';
}

function uniqueHint(error) {
  return String(error.constraint || error.table || error.detail || error.message || '');
}

function validateAuditPart(audit) {
  if (!audit || typeof audit !== 'object') return false;
  return isNonEmptyString(audit.eventId)
    && isNonEmptyString(audit.eventType)
    && isNonEmptyString(audit.taskId)
    && isNonEmptyString(audit.actorId)
    && isNonEmptyString(audit.governanceRevision)
    && isNonEmptyString(audit.idempotencyKey);
}

function validateEvidencePart(evidence) {
  if (evidence == null) return true;
  if (typeof evidence !== 'object') return false;
  return isNonEmptyString(evidence.evidenceId)
    && isNonEmptyString(evidence.taskId)
    && isNonEmptyString(evidence.actorId)
    && isNonEmptyString(evidence.governanceRevision)
    && isNonEmptyString(evidence.evidenceType)
    && isNonEmptyString(evidence.evidenceRef)
    && isNonEmptyString(evidence.idempotencyKey);
}

function validateBindPhaseInput(input) {
  if (!input || typeof input !== 'object') return false;
  if (!input.bind || typeof input.bind !== 'object') return false;
  if (!validateAuditPart(input.audit)) return false;
  if (!validateEvidencePart(input.evidence)) return false;
  return isNonEmptyString(input.compositionGovernanceRevision);
}

function validateReleasePhaseInput(input) {
  if (!input || typeof input !== 'object') return false;
  if (!input.release || typeof input.release !== 'object') return false;
  if (!validateAuditPart(input.audit)) return false;
  if (!validateEvidencePart(input.evidence)) return false;
  return isNonEmptyString(input.compositionGovernanceRevision);
}

class LifecycleAbort extends Error {
  constructor(decision, extra = {}) {
    super(decision);
    this.name = 'LifecycleAbort';
    this.lifecycleDecision = decision;
    this.extra = extra;
  }
}

function abort(decision, extra = {}) {
  throw new LifecycleAbort(decision, extra);
}

function mapBindDecision(bindResult) {
  if (!bindResult || bindResult.ok) return null;
  switch (bindResult.decision) {
    case COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT:
      return LIFECYCLE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT;
    case COMPOSITION_DECISIONS.DENY_CLAIM_CONFLICT:
      return LIFECYCLE_DECISIONS.DENY_CLAIM_CONFLICT;
    case COMPOSITION_DECISIONS.DENY_FOREIGN_ACTOR:
      return LIFECYCLE_DECISIONS.DENY_FOREIGN_ACTOR;
    case COMPOSITION_DECISIONS.DENY_STALE_FENCING_EPOCH:
      return LIFECYCLE_DECISIONS.DENY_STALE_FENCING_EPOCH;
    case COMPOSITION_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP:
      return LIFECYCLE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP;
    case COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE:
      return LIFECYCLE_DECISIONS.BLOCKED_DB_FAILURE;
    case COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION:
      return LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION;
    case COMPOSITION_DECISIONS.DENY_INVALID_INPUT:
      return LIFECYCLE_DECISIONS.DENY_INVALID_INPUT;
    default:
      return LIFECYCLE_DECISIONS.DENY_BIND;
  }
}

function mapReleaseDecision(releaseResult) {
  if (!releaseResult || releaseResult.ok) return null;
  switch (releaseResult.decision) {
    case COMPOSITION_DECISIONS.DENY_FOREIGN_ACTOR:
      return LIFECYCLE_DECISIONS.DENY_FOREIGN_ACTOR;
    case COMPOSITION_DECISIONS.DENY_STALE_FENCING_EPOCH:
      return LIFECYCLE_DECISIONS.DENY_STALE_FENCING_EPOCH;
    case COMPOSITION_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP:
      return LIFECYCLE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP;
    case COMPOSITION_DECISIONS.BLOCKED_DB_FAILURE:
      return LIFECYCLE_DECISIONS.BLOCKED_DB_FAILURE;
    case COMPOSITION_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION:
      return LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION;
    case COMPOSITION_DECISIONS.DENY_INVALID_INPUT:
      return LIFECYCLE_DECISIONS.DENY_INVALID_INPUT;
    default:
      return LIFECYCLE_DECISIONS.DENY_RELEASE;
  }
}

function mapAuditDecision(auditResult) {
  if (!auditResult || auditResult.ok) return null;
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT) {
    return LIFECYCLE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT;
  }
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION) {
    return LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION;
  }
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_INPUT) {
    return LIFECYCLE_DECISIONS.DENY_INVALID_INPUT;
  }
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP) {
    return LIFECYCLE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP;
  }
  if (auditResult.decision === AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE) {
    return LIFECYCLE_DECISIONS.BLOCKED_DB_FAILURE;
  }
  return LIFECYCLE_DECISIONS.DENY_AUDIT;
}

function mapEvidenceDecision(evidenceResult) {
  if (!evidenceResult || evidenceResult.ok) return null;
  if (evidenceResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT) {
    return LIFECYCLE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT;
  }
  if (evidenceResult.decision === AUDIT_EVIDENCE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION) {
    return LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION;
  }
  if (evidenceResult.decision === AUDIT_EVIDENCE_DECISIONS.BLOCKED_DB_FAILURE) {
    return LIFECYCLE_DECISIONS.BLOCKED_DB_FAILURE;
  }
  return LIFECYCLE_DECISIONS.DENY_EVIDENCE;
}

function requireOk(layerResult, mapFn) {
  if (layerResult && layerResult.ok) return layerResult;
  const decision = mapFn(layerResult) || LIFECYCLE_DECISIONS.DENY_BIND;
  abort(decision, {
    bind: layerResult && layerResult.task !== undefined ? layerResult : null,
    release: layerResult && layerResult.task !== undefined ? layerResult : null,
    audit: layerResult && layerResult.record !== undefined ? layerResult : null,
    evidence: layerResult && layerResult.record !== undefined ? layerResult : null,
    layerDecision: layerResult ? layerResult.decision : null,
  });
  return layerResult;
}

function mapCaughtError(error) {
  if (error instanceof LifecycleAbort) {
    return lifecycleResult(error.lifecycleDecision, error.extra);
  }
  if (error && (error.name === 'CompositionAbort' || error.compositionDecision)) {
    const mapped = mapBindDecision({
      ok: false,
      decision: error.compositionDecision,
    }) || mapReleaseDecision({
      ok: false,
      decision: error.compositionDecision,
    }) || LIFECYCLE_DECISIONS.DENY_BIND;
    return lifecycleResult(mapped, {
      layerDecision: error.compositionDecision,
      ...(error.extra || {}),
    });
  }
  if (isUniqueViolation(error)) {
    const hint = uniqueHint(error);
    if (/idempotency/i.test(hint)) {
      return lifecycleResult(LIFECYCLE_DECISIONS.DENY_IDEMPOTENCY_CONFLICT);
    }
    if (/dlp_task_claim_one_held_owner|dlp_task_claim|held/i.test(hint)
      || /dlp_task_pkey|dlp_task /i.test(hint)
      || /dlp_write_lease/i.test(hint)) {
      return lifecycleResult(LIFECYCLE_DECISIONS.DENY_CLAIM_CONFLICT);
    }
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_CLAIM_CONFLICT);
  }
  if (isDbFailure(error)) {
    return lifecycleResult(LIFECYCLE_DECISIONS.BLOCKED_DB_FAILURE, {
      errorClass: error.code || error.name || 'DB_FAILURE',
    });
  }
  return null;
}

async function appendAuditAndOptionalEvidence(client, audit, evidence) {
  const auditOut = await appendAuditEventInTransaction(client, audit);
  requireOk(auditOut, mapAuditDecision);

  let evidenceOut = null;
  if (evidence) {
    evidenceOut = await appendEvidenceInTransaction(client, evidence);
    requireOk(evidenceOut, mapEvidenceDecision);
  }
  return { auditOut, evidenceOut };
}

/**
 * Phase 1: bind Task/Claim/Lease + Audit (+ optional Evidence) in one owned txn.
 * Never spans Cursor/Worker work. Maps DENY only after ROLLBACK.
 */
export async function bindTaskClaimLeaseWithAudit(client, input) {
  requireClient(client);
  if (!validateBindPhaseInput(input)) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (input.compositionGovernanceRevision !== APPROVED_GOVERNANCE_REVISION) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  // Layer-specific revisions are enforced by DLP-002 / DLP-003 repositories.
  // Adapter documents expected constants for callers.
  if (input.bind.governanceRevision !== DLP002_GOVERNANCE_REVISION) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  if (input.audit.governanceRevision !== DLP003_GOVERNANCE_REVISION) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  if (input.evidence && input.evidence.governanceRevision !== DLP003_GOVERNANCE_REVISION) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }

  try {
    return await withOwnedWriteLeaseTransaction(client, async () => {
      const bind = await bindTaskClaimLeaseInTransaction(client, input.bind);
      requireOk(bind, mapBindDecision);
      const { auditOut, evidenceOut } = await appendAuditAndOptionalEvidence(
        client,
        input.audit,
        input.evidence,
      );
      const replay = bind.decision === COMPOSITION_DECISIONS.REPLAY
        && (auditOut.decision === AUDIT_EVIDENCE_DECISIONS.REPLAY
          || auditOut.decision === AUDIT_EVIDENCE_DECISIONS.APPENDED);
      return lifecycleResult(
        replay && auditOut.decision === AUDIT_EVIDENCE_DECISIONS.REPLAY
          ? LIFECYCLE_DECISIONS.BOUND_WITH_AUDIT_REPLAY
          : LIFECYCLE_DECISIONS.BOUND_WITH_AUDIT,
        {
          bind,
          audit: auditOut,
          evidence: evidenceOut,
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
 * Phase 2: release Task/Claim/Lease + Audit (+ optional Evidence) in one owned txn.
 * Never spans Cursor/Worker work. Maps DENY only after ROLLBACK.
 */
export async function releaseTaskClaimLeaseWithAudit(client, input) {
  requireClient(client);
  if (!validateReleasePhaseInput(input)) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_INPUT);
  }
  if (input.compositionGovernanceRevision !== APPROVED_GOVERNANCE_REVISION) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  if (input.release.governanceRevision !== DLP002_GOVERNANCE_REVISION) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  if (input.audit.governanceRevision !== DLP003_GOVERNANCE_REVISION) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }
  if (input.evidence && input.evidence.governanceRevision !== DLP003_GOVERNANCE_REVISION) {
    return lifecycleResult(LIFECYCLE_DECISIONS.DENY_INVALID_GOVERNANCE_REVISION);
  }

  try {
    return await withOwnedWriteLeaseTransaction(client, async () => {
      const release = await releaseTaskClaimLeaseInTransaction(client, input.release);
      requireOk(release, mapReleaseDecision);
      const { auditOut, evidenceOut } = await appendAuditAndOptionalEvidence(
        client,
        input.audit,
        input.evidence,
      );
      return lifecycleResult(LIFECYCLE_DECISIONS.RELEASED_WITH_AUDIT, {
        release,
        audit: auditOut,
        evidence: evidenceOut,
      });
    });
  } catch (error) {
    const mapped = mapCaughtError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export {
  DLP002_GOVERNANCE_REVISION,
  DLP003_GOVERNANCE_REVISION,
};
