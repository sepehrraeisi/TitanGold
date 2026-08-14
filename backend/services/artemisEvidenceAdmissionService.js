/**
 * Artemis WP-C.1 — deterministic evidence admission / compatibility library.
 *
 * Pure. No DB. No network. No provider. No Agent execution. No synthesis scoring.
 * Reuses frozen WP-B.1 evidence validator and identity helpers without changing them.
 */

import {
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  AVAILABILITY,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  FORBIDDEN_EXECUTION_CLASS,
  FRESHNESS_STATUS,
  LIFECYCLE_STATUS,
  isCanonicalUuid,
  isUnavailableRepresentation,
  validateEvidenceEnvelope,
} from '../contracts/artemisEvidenceContract.js';
import {
  CONFIRMATION_SEMANTICS,
  EVIDENCE_ADMISSION_STATE,
} from '../contracts/artemisDecisionContract.js';
import { resolveArtemisAgentIdentity } from './artemisAgentIdentity.js';

export const ADMISSION_REASON = Object.freeze({
  VALID_ANALYTICAL_EVIDENCE: 'VALID_ANALYTICAL_EVIDENCE',
  VALID_OPPORTUNITY_CONTEXT: 'VALID_OPPORTUNITY_CONTEXT',
  INVALID_SCHEMA: 'INVALID_SCHEMA',
  UNKNOWN_AGENT: 'UNKNOWN_AGENT',
  LEGACY_AGENT_N: 'LEGACY_AGENT_N',
  ROLE_NOT_ADMISSIBLE: 'ROLE_NOT_ADMISSIBLE',
  ROLE_MISMATCH: 'ROLE_MISMATCH',
  CONTEXT_MISMATCH: 'CONTEXT_MISMATCH',
  CONTEXT_INCOMPATIBLE: 'CONTEXT_INCOMPATIBLE',
  UNAVAILABLE: 'UNAVAILABLE',
  FAILED: 'FAILED',
  STALE: 'STALE',
  EXPIRED: 'EXPIRED',
  FRESHNESS_UNKNOWN: 'FRESHNESS_UNKNOWN',
  FRESHNESS_AGED: 'FRESHNESS_AGED',
  MOCK_OR_PLACEHOLDER: 'MOCK_OR_PLACEHOLDER',
  DATA_QUALITY_BLOCKED: 'DATA_QUALITY_BLOCKED',
  DATA_QUALITY_DEGRADED: 'DATA_QUALITY_DEGRADED',
  EXECUTION_CLAIM_FORBIDDEN: 'EXECUTION_CLAIM_FORBIDDEN',
  DUPLICATE_REFERENCE: 'DUPLICATE_REFERENCE',
  UNSUPPORTED_ROLE: 'UNSUPPORTED_ROLE',
  NOT_APPLICABLE_ROLE: 'NOT_APPLICABLE_ROLE',
  MISSING_ENVELOPE: 'MISSING_ENVELOPE',
});

const ANALYTICAL_ROLES = new Set([AUTHORITY_CLASS.ANALYTICAL_EVIDENCE]);
const OPPORTUNITY_ROLES = new Set([AUTHORITY_CLASS.OPPORTUNITY_FORECAST]);
const NON_ANALYTICAL_CONTROL_ROLES = new Set([
  AUTHORITY_CLASS.CONTROL_VETO,
  AUTHORITY_CLASS.CONTROL_SIZING,
  AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
  AUTHORITY_CLASS.EXECUTION,
  AUTHORITY_CLASS.NOT_APPLICABLE,
]);

function freshnessStatusOf(envelope) {
  const freshness = envelope?.freshness;
  if (freshness == null) return FRESHNESS_STATUS.UNKNOWN;
  if (typeof freshness === 'string') return freshness;
  if (typeof freshness === 'object' && freshness.status) return freshness.status;
  return FRESHNESS_STATUS.UNKNOWN;
}

function isMockOrPlaceholder(envelope) {
  const limitations = Array.isArray(envelope?.limitations) ? envelope.limitations : [];
  const known = Array.isArray(envelope?.dataQuality?.knownLimitationKeys)
    ? envelope.dataQuality.knownLimitationKeys
    : [];
  if (limitations.includes('mock_or_placeholder_source') || known.includes('mock_or_placeholder_source')) {
    return true;
  }
  const source = String(envelope?.provenance?.source || '').toLowerCase();
  if (source === 'mock' || source === 'placeholder') return true;
  const note = String(envelope?.provenance?.note || '').toLowerCase();
  if (note.includes('mock_or_placeholder')) return true;
  return false;
}

/**
 * Field-semantic + role-aware execution-claim detection.
 * Analytical conclusion.signal values such as BUY/SELL/HOLD/LONG/SHORT are
 * directional analytical signals under frozen WP-B.1 — NOT execution authorization.
 */
function hasForbiddenExecutionClaims(envelope) {
  if (envelope?.executionEligible === true) return true;
  if (envelope?.approvedForExecution === true) return true;
  if (envelope?.approved === true) return true;
  if (FORBIDDEN_EXECUTION_CLASS.includes(envelope?.executionClass)) return true;
  return false;
}

function normalizeContextValue(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.toLowerCase() : null;
}

/**
 * Deterministic context compatibility.
 * Unknown context fields do not default to a synthetic value (e.g. no default 1h).
 * Mismatch => incompatible (not silently coerced).
 * Opportunity envelopes may omit directional timeframe; mismatch still reported when both present.
 */
export function evaluateContextCompatibility(decisionContext = {}, envelope = {}) {
  const mismatches = [];
  const pairs = [
    ['symbol', decisionContext.symbol, envelope.symbol],
    ['venue', decisionContext.venue || decisionContext.provider, envelope.venue || envelope.provider],
    ['marketType', decisionContext.marketType, envelope.marketType],
    ['timeframe', decisionContext.timeframe, envelope.timeframe],
    ['analysisHorizon', decisionContext.analysisHorizon, envelope.analysisHorizon],
  ];

  for (const [field, leftRaw, rightRaw] of pairs) {
    const left = normalizeContextValue(leftRaw);
    const right = normalizeContextValue(rightRaw);
    if (left && right && left !== right) {
      mismatches.push({ field, context: left, evidence: right });
    }
  }

  return {
    compatible: mismatches.length === 0,
    mismatches,
  };
}

function buildRef(envelope, admissionState, admissionReason, confirmationSemantics) {
  // C.1 Decision refs keep freshness as a canonical status string only.
  const freshness = freshnessStatusOf(envelope);
  return {
    agentId: envelope.agentId,
    runId: envelope.runId ?? null,
    agentRecordId: envelope.agentRecordId ?? null,
    evidenceContractVersion: envelope.contractVersion || EVIDENCE_CONTRACT_VERSION,
    role: envelope.agentRole || envelope.authorityClass || null,
    authorityClass: envelope.authorityClass || null,
    correlationFamily: envelope.correlationFamily || null,
    freshness,
    availability: envelope.availability || null,
    admissionState,
    admissionReason,
    confirmationSemantics,
    symbol: envelope.symbol ?? null,
    venue: envelope.venue || envelope.provider || null,
    marketType: envelope.marketType ?? null,
    timeframe: envelope.timeframe ?? null,
    analysisHorizon: envelope.analysisHorizon ?? null,
    analysisTimestamp: envelope.analysisTimestamp ?? null,
  };
}

function classifyRoleAdmission(envelope) {
  const role = envelope.authorityClass || envelope.agentRole;
  if (!role) {
    return { state: EVIDENCE_ADMISSION_STATE.REJECTED, reason: ADMISSION_REASON.ROLE_MISMATCH };
  }
  if (role === AUTHORITY_CLASS.NOT_APPLICABLE) {
    return { state: EVIDENCE_ADMISSION_STATE.EXCLUDED, reason: ADMISSION_REASON.NOT_APPLICABLE_ROLE };
  }
  if (NON_ANALYTICAL_CONTROL_ROLES.has(role) && role !== AUTHORITY_CLASS.NOT_APPLICABLE) {
    return { state: EVIDENCE_ADMISSION_STATE.EXCLUDED, reason: ADMISSION_REASON.ROLE_NOT_ADMISSIBLE };
  }
  if (ANALYTICAL_ROLES.has(role)) {
    return { state: EVIDENCE_ADMISSION_STATE.ADMITTED, reason: ADMISSION_REASON.VALID_ANALYTICAL_EVIDENCE, confirmation: CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE };
  }
  if (OPPORTUNITY_ROLES.has(role)) {
    return { state: EVIDENCE_ADMISSION_STATE.ADMITTED, reason: ADMISSION_REASON.VALID_OPPORTUNITY_CONTEXT, confirmation: CONFIRMATION_SEMANTICS.OPPORTUNITY_CONTEXT };
  }
  return { state: EVIDENCE_ADMISSION_STATE.REJECTED, reason: ADMISSION_REASON.UNSUPPORTED_ROLE };
}

/**
 * Deterministic duplicate identity.
 * - Canonical UUID runId => primary stable key (agentId + runId)
 * - null / unavailable runId => do NOT collapse all same-Agent evidence
 * - Fallback only when analysisTimestamp + bounded context fields are present
 * - Otherwise decline to deduplicate (return null)
 */
export function resolveDuplicateIdentityKey(envelope) {
  const agentId = envelope?.agentId;
  if (!agentId || typeof agentId !== 'string') return null;

  const runId = envelope?.runId;
  if (typeof runId === 'string' && isCanonicalUuid(runId)) {
    return `run:${agentId}:${runId.trim().toLowerCase()}`;
  }
  if (runId != null && !isUnavailableRepresentation(runId)) {
    // Non-canonical runId should already fail schema; do not invent a key.
    return null;
  }

  const analysisTimestamp = typeof envelope?.analysisTimestamp === 'string'
    ? envelope.analysisTimestamp.trim()
    : '';
  if (!analysisTimestamp) return null;

  const symbol = normalizeContextValue(envelope?.symbol) || '';
  const timeframe = normalizeContextValue(envelope?.timeframe) || '';
  const venue = normalizeContextValue(envelope?.venue || envelope?.provider) || '';
  const marketType = normalizeContextValue(envelope?.marketType) || '';
  // Require at least one bounded context field besides timestamp to avoid false collapse.
  if (!symbol && !timeframe && !venue && !marketType) return null;

  return `ctx:${agentId}:${analysisTimestamp}:${symbol}|${timeframe}|${venue}|${marketType}`;
}

/**
 * Admit a single WP-B.1 evidence envelope against a decision context.
 * @returns {{
 *   admissionState: string,
 *   admissionReason: string,
 *   confirmationSemantics: string,
 *   evidenceRef: object,
 *   schemaValidation: object,
 *   contextCompatibility: object,
 *   preserved: { correlationFamily: string|null, limitations: string[], dataQualityStatus: string|null }
 * }}
 */
export function admitEvidenceEnvelope(decisionContext, envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.REJECTED,
      admissionReason: ADMISSION_REASON.MISSING_ENVELOPE,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: null,
      schemaValidation: { ok: false, code: 'missing_envelope' },
      contextCompatibility: { compatible: false, mismatches: [] },
      preserved: { correlationFamily: null, limitations: [], dataQualityStatus: null },
    };
  }

  const identity = resolveArtemisAgentIdentity(envelope.agentId);
  if (identity.status === 'legacy_unavailable') {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.REJECTED,
      admissionReason: ADMISSION_REASON.LEGACY_AGENT_N,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(envelope, EVIDENCE_ADMISSION_STATE.REJECTED, ADMISSION_REASON.LEGACY_AGENT_N, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation: { ok: false, code: 'legacy_agent_n' },
      contextCompatibility: { compatible: false, mismatches: [] },
      preserved: {
        correlationFamily: envelope.correlationFamily || null,
        limitations: Array.isArray(envelope.limitations) ? envelope.limitations : [],
        dataQualityStatus: envelope.dataQuality?.status || null,
      },
    };
  }
  if (identity.status !== 'ok') {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.REJECTED,
      admissionReason: ADMISSION_REASON.UNKNOWN_AGENT,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(envelope, EVIDENCE_ADMISSION_STATE.REJECTED, ADMISSION_REASON.UNKNOWN_AGENT, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation: { ok: false, code: 'unknown_agent' },
      contextCompatibility: { compatible: false, mismatches: [] },
      preserved: {
        correlationFamily: envelope.correlationFamily || null,
        limitations: Array.isArray(envelope.limitations) ? envelope.limitations : [],
        dataQualityStatus: envelope.dataQuality?.status || null,
      },
    };
  }

  // Ensure envelope uses canonical agentId before schema validation.
  const normalizedEnvelope = envelope.agentId === identity.agentId
    ? envelope
    : { ...envelope, agentId: identity.agentId };

  const expectedRole = AGENT_CONTRACT_ROLE[identity.agentId];
  if (
    expectedRole
    && (
      (normalizedEnvelope.agentRole && normalizedEnvelope.agentRole !== expectedRole.agentRole)
      || (normalizedEnvelope.authorityClass && normalizedEnvelope.authorityClass !== expectedRole.authorityClass)
    )
  ) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.REJECTED,
      admissionReason: ADMISSION_REASON.ROLE_MISMATCH,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(normalizedEnvelope, EVIDENCE_ADMISSION_STATE.REJECTED, ADMISSION_REASON.ROLE_MISMATCH, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation: { ok: false, code: 'role_mismatch' },
      contextCompatibility: evaluateContextCompatibility(decisionContext, normalizedEnvelope),
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  const schemaValidation = validateEvidenceEnvelope(normalizedEnvelope);
  if (!schemaValidation.ok) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.REJECTED,
      admissionReason: ADMISSION_REASON.INVALID_SCHEMA,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(normalizedEnvelope, EVIDENCE_ADMISSION_STATE.REJECTED, ADMISSION_REASON.INVALID_SCHEMA, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation,
      contextCompatibility: evaluateContextCompatibility(decisionContext, normalizedEnvelope),
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  if (hasForbiddenExecutionClaims(normalizedEnvelope)) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.REJECTED,
      admissionReason: ADMISSION_REASON.EXECUTION_CLAIM_FORBIDDEN,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(normalizedEnvelope, EVIDENCE_ADMISSION_STATE.REJECTED, ADMISSION_REASON.EXECUTION_CLAIM_FORBIDDEN, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation,
      contextCompatibility: evaluateContextCompatibility(decisionContext, normalizedEnvelope),
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  const roleAdmission = classifyRoleAdmission(normalizedEnvelope);
  if (roleAdmission.state === EVIDENCE_ADMISSION_STATE.REJECTED || roleAdmission.state === EVIDENCE_ADMISSION_STATE.EXCLUDED) {
    return {
      admissionState: roleAdmission.state,
      admissionReason: roleAdmission.reason,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(normalizedEnvelope, roleAdmission.state, roleAdmission.reason, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation,
      contextCompatibility: evaluateContextCompatibility(decisionContext, normalizedEnvelope),
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  const contextCompatibility = evaluateContextCompatibility(decisionContext, normalizedEnvelope);
  if (!contextCompatibility.compatible) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.EXCLUDED,
      admissionReason: ADMISSION_REASON.CONTEXT_INCOMPATIBLE,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(
        normalizedEnvelope,
        EVIDENCE_ADMISSION_STATE.EXCLUDED,
        ADMISSION_REASON.CONTEXT_INCOMPATIBLE,
        CONFIRMATION_SEMANTICS.NONE,
      ),
      schemaValidation,
      contextCompatibility,
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  if (normalizedEnvelope.availability !== AVAILABILITY.AVAILABLE) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.EXCLUDED,
      admissionReason: ADMISSION_REASON.UNAVAILABLE,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(normalizedEnvelope, EVIDENCE_ADMISSION_STATE.EXCLUDED, ADMISSION_REASON.UNAVAILABLE, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation,
      contextCompatibility,
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  if (normalizedEnvelope.lifecycleStatus === LIFECYCLE_STATUS.FAILED) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.EXCLUDED,
      admissionReason: ADMISSION_REASON.FAILED,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(normalizedEnvelope, EVIDENCE_ADMISSION_STATE.EXCLUDED, ADMISSION_REASON.FAILED, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation,
      contextCompatibility,
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  if (isMockOrPlaceholder(normalizedEnvelope)) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.EXCLUDED,
      admissionReason: ADMISSION_REASON.MOCK_OR_PLACEHOLDER,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(normalizedEnvelope, EVIDENCE_ADMISSION_STATE.EXCLUDED, ADMISSION_REASON.MOCK_OR_PLACEHOLDER, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation,
      contextCompatibility,
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  if (normalizedEnvelope.dataQuality?.status === 'insufficient') {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.EXCLUDED,
      admissionReason: ADMISSION_REASON.DATA_QUALITY_BLOCKED,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
      evidenceRef: buildRef(normalizedEnvelope, EVIDENCE_ADMISSION_STATE.EXCLUDED, ADMISSION_REASON.DATA_QUALITY_BLOCKED, CONFIRMATION_SEMANTICS.NONE),
      schemaValidation,
      contextCompatibility,
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  const freshness = freshnessStatusOf(normalizedEnvelope);
  if (freshness === FRESHNESS_STATUS.STALE) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING,
      admissionReason: ADMISSION_REASON.STALE,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NON_CONFIRMING,
      evidenceRef: buildRef(
        normalizedEnvelope,
        EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING,
        ADMISSION_REASON.STALE,
        CONFIRMATION_SEMANTICS.NON_CONFIRMING,
      ),
      schemaValidation,
      contextCompatibility,
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }
  if (freshness === FRESHNESS_STATUS.EXPIRED) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING,
      admissionReason: ADMISSION_REASON.EXPIRED,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NON_CONFIRMING,
      evidenceRef: buildRef(
        normalizedEnvelope,
        EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING,
        ADMISSION_REASON.EXPIRED,
        CONFIRMATION_SEMANTICS.NON_CONFIRMING,
      ),
      schemaValidation,
      contextCompatibility,
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }
  if (freshness === FRESHNESS_STATUS.UNKNOWN || freshness === FRESHNESS_STATUS.UNAVAILABLE) {
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING,
      admissionReason: ADMISSION_REASON.FRESHNESS_UNKNOWN,
      confirmationSemantics: CONFIRMATION_SEMANTICS.NON_CONFIRMING,
      evidenceRef: buildRef(
        normalizedEnvelope,
        EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING,
        ADMISSION_REASON.FRESHNESS_UNKNOWN,
        CONFIRMATION_SEMANTICS.NON_CONFIRMING,
      ),
      schemaValidation,
      contextCompatibility,
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }
  if (freshness === FRESHNESS_STATUS.AGED || normalizedEnvelope.dataQuality?.status === 'degraded') {
    const degradedReason = freshness === FRESHNESS_STATUS.AGED
      ? ADMISSION_REASON.FRESHNESS_AGED
      : ADMISSION_REASON.DATA_QUALITY_DEGRADED;
    return {
      admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED_DEGRADED,
      admissionReason: degradedReason,
      confirmationSemantics: roleAdmission.confirmation,
      evidenceRef: buildRef(
        normalizedEnvelope,
        EVIDENCE_ADMISSION_STATE.ADMITTED_DEGRADED,
        degradedReason,
        roleAdmission.confirmation,
      ),
      schemaValidation,
      contextCompatibility,
      preserved: {
        correlationFamily: normalizedEnvelope.correlationFamily || null,
        limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
        dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
      },
    };
  }

  return {
    admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED,
    admissionReason: roleAdmission.reason,
    confirmationSemantics: roleAdmission.confirmation,
    evidenceRef: buildRef(
      normalizedEnvelope,
      EVIDENCE_ADMISSION_STATE.ADMITTED,
      roleAdmission.reason,
      roleAdmission.confirmation,
    ),
    schemaValidation,
    contextCompatibility,
    preserved: {
      correlationFamily: normalizedEnvelope.correlationFamily || null,
      limitations: Array.isArray(normalizedEnvelope.limitations) ? normalizedEnvelope.limitations : [],
      dataQualityStatus: normalizedEnvelope.dataQuality?.status || null,
    },
  };
}

/**
 * Admit many envelopes. Duplicate agentId+runId refs are deterministically excluded.
 * Does not score correlation; only preserves correlationFamily metadata on refs.
 */
export function admitEvidenceSet(decisionContext, envelopes = []) {
  const results = [];
  const seen = new Set();
  const list = Array.isArray(envelopes) ? envelopes : [];

  for (const envelope of list) {
    const result = admitEvidenceEnvelope(decisionContext, envelope);
    if (result.evidenceRef && result.admissionState !== EVIDENCE_ADMISSION_STATE.REJECTED) {
      const key = resolveDuplicateIdentityKey(envelope || {});
      if (key && seen.has(key)) {
        const duplicate = {
          ...result,
          admissionState: EVIDENCE_ADMISSION_STATE.EXCLUDED,
          admissionReason: ADMISSION_REASON.DUPLICATE_REFERENCE,
          confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
          evidenceRef: {
            ...result.evidenceRef,
            admissionState: EVIDENCE_ADMISSION_STATE.EXCLUDED,
            admissionReason: ADMISSION_REASON.DUPLICATE_REFERENCE,
            confirmationSemantics: CONFIRMATION_SEMANTICS.NONE,
          },
        };
        results.push(duplicate);
        continue;
      }
      if (key) seen.add(key);
    }
    results.push(result);
  }

  const evidenceRefs = results.map((row) => row.evidenceRef).filter(Boolean);
  const admitted = results.filter((row) => (
    row.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED
    || row.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED_DEGRADED
    || row.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING
  ));

  return {
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    results,
    evidenceRefs,
    counts: {
      total: results.length,
      admitted: results.filter((r) => r.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED).length,
      admittedDegraded: results.filter((r) => r.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED_DEGRADED).length,
      admittedNonConfirming: results.filter((r) => r.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING).length,
      excluded: results.filter((r) => r.admissionState === EVIDENCE_ADMISSION_STATE.EXCLUDED).length,
      rejected: results.filter((r) => r.admissionState === EVIDENCE_ADMISSION_STATE.REJECTED).length,
      directionalCandidates: admitted.filter((r) => r.confirmationSemantics === CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE).length,
      opportunityContext: admitted.filter((r) => r.confirmationSemantics === CONFIRMATION_SEMANTICS.OPPORTUNITY_CONTEXT).length,
    },
    correlationFamilies: [...new Set(evidenceRefs.map((ref) => ref.correlationFamily).filter(Boolean))],
  };
}

export default {
  ADMISSION_REASON,
  admitEvidenceEnvelope,
  admitEvidenceSet,
  evaluateContextCompatibility,
  resolveDuplicateIdentityKey,
};
