/**
 * Artemis Core Stage 4 — canonical read-only evidence ingestion.
 *
 * persisted ai_decisions
 *   → Stage 2 identity
 *   → Stage 3 adapter reconstruction
 *   → Stage 2 schema validation
 *   → Stage 4 ingestion policy
 *   → immutable disposition result
 *
 * Zero writes. No Agent execution. No provider calls. No orchestration.
 * Does not call admitEvidenceSet / artemisOrchestrator.
 */

import { query } from '../database/db.js';
import { ARTEMIS_AGENT_CATALOG } from '../../constants/artemisAgentCatalog.js';
import {
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  AVAILABILITY,
  CANONICAL_AGENT_IDS,
  DATA_QUALITY_STATUS,
  FRESHNESS_STATUS,
  validateEvidenceEnvelope,
} from '../contracts/artemisEvidenceContract.js';
import {
  DEFAULT_INGEST_BATCH,
  INGESTION_CONTRACT_VERSION,
  INGESTION_DISPOSITION,
  INGESTION_REASON,
  INGESTION_STAGE,
  INGESTION_WRITER,
  MAX_INGEST_BATCH,
  OWNERSHIP_SCOPE,
  PERSISTENCE_MODEL,
  ZERO_SIDE_EFFECTS,
} from '../contracts/artemisEvidenceIngestionContract.js';
import { applyCanonicalAgentId, resolveArtemisAgentIdentity } from './artemisAgentIdentity.js';
import { projectDecisionRow } from './artemisEvidenceOnReadService.js';
import { projectEvidenceForProduct } from './artemisEvidenceProductProjection.js';
import { evaluateContextCompatibility } from './artemisEvidenceAdmissionService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WRITE_SQL_RE = /^\s*(INSERT|UPDATE|DELETE|UPSERT|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO|WITH\b[\s\S]*\b(INSERT|UPDATE|DELETE)\b)/i;

const UNAVAILABLE_AVAILABILITY = new Set([
  AVAILABILITY.UNAVAILABLE,
  AVAILABILITY.NOT_RUN,
  AVAILABILITY.PROVIDER_UNAVAILABLE,
  AVAILABILITY.CONTRACT_ERROR,
]);

const FORBIDDEN_EXECUTION_CLASS = new Set([
  'executable',
  'approved_for_execution',
  'requires_control_chain',
  'live',
]);

export const AI_DECISIONS_INGEST_READ_SQL = `
SELECT d.id, d.agent_id, d.user_id, d.decision_type, d.confidence,
       d.input_data AS input, d.output_data AS output,
       d.was_successful, d.created_at, d.metadata,
       a.agent_key, a.name AS agent_name
  FROM ai_decisions d
  LEFT JOIN ai_agents a ON a.id = d.agent_id
 WHERE (
        ($2::uuid IS NULL AND d.user_id IS NULL)
     OR ($2::uuid IS NOT NULL AND (d.user_id IS NULL OR d.user_id = $2::uuid))
       )
   AND ($3::timestamptz IS NULL OR d.created_at >= $3::timestamptz)
   AND ($4::timestamptz IS NULL OR d.created_at <= $4::timestamptz)
   AND ($5::text[] IS NULL OR a.agent_key = ANY($5::text[]))
 ORDER BY d.created_at DESC
 LIMIT $1
`;

let lastIngestionMetrics = {
  queryCount: 0,
  rowsLoaded: 0,
  elapsedMs: 0,
  nPlusOne: false,
};

export function getLastIngestionMetrics() {
  return { ...lastIngestionMetrics };
}

export function assertReadOnlySql(text) {
  const sql = String(text || '').trim();
  if (!sql || WRITE_SQL_RE.test(sql) || !/^\s*SELECT\b/i.test(sql)) {
    const error = new Error('STAGE4_READ_ONLY_VIOLATION');
    error.code = 'STAGE4_READ_ONLY_VIOLATION';
    throw error;
  }
  return sql;
}

async function readOnlyQuery(sql, params) {
  assertReadOnlySql(sql);
  return query(sql, params);
}

function sideEffects() {
  return { ...ZERO_SIDE_EFFECTS };
}

function freezeResult(result) {
  if (result.sideEffects) Object.freeze(result.sideEffects);
  if (result.lineage) Object.freeze(result.lineage);
  if (result.ingestion) Object.freeze(result.ingestion);
  if (result.ownership) Object.freeze(result.ownership);
  return Object.freeze(result);
}

function nowIso(nowMs) {
  return new Date(Number.isFinite(nowMs) ? nowMs : Date.now()).toISOString();
}

function isMockOrPlaceholder(envelope) {
  const source = String(envelope?.provenance?.source || '').toLowerCase();
  if (source === 'mock' || source === 'placeholder') return true;
  const note = String(envelope?.provenance?.note || '').toLowerCase();
  return note.includes('mock_or_placeholder');
}

function hasForbiddenExecutionClaims(envelope) {
  if (envelope?.executionEligible === true) return true;
  if (envelope?.approvedForExecution === true) return true;
  if (envelope?.approved === true) return true;
  if (FORBIDDEN_EXECUTION_CLASS.has(envelope?.executionClass)) return true;
  return true === envelope?.conclusion?.executionAuthorized;
}

function freshnessStatusOf(envelope) {
  const freshness = envelope?.freshness;
  if (!freshness) return null;
  return typeof freshness === 'string' ? freshness : freshness.status || null;
}

function reasonFromValidation(validation) {
  const errors = validation?.errors || [];
  const codes = new Set(errors.map((item) => item.code));
  if (validation?.code) codes.add(validation.code);
  const fields = new Set(errors.map((item) => item.field));
  if (codes.has('unknown_field')) return INGESTION_REASON.FORBIDDEN_FIELD;
  if (codes.has('authority_mismatch')) return INGESTION_REASON.AUTHORITY_MISMATCH;
  if (codes.has('unknown_agent_id')) return INGESTION_REASON.UNKNOWN_AGENT;
  if (codes.has('forbidden_execution_semantics')) return INGESTION_REASON.FORBIDDEN_EXECUTION_CLAIM;
  if (codes.has('invalid_correlation_family')) return INGESTION_REASON.INVALID_CORRELATION_FAMILY;
  if (codes.has('invalid_timestamp') || fields.has('analysisTimestamp')) return INGESTION_REASON.MALFORMED_TIMESTAMP;
  if (codes.has('forbidden_secret_keys')) return INGESTION_REASON.INVALID_SCHEMA;
  return INGESTION_REASON.INVALID_SCHEMA;
}

function reasonFromProjectFailure(projected) {
  const reason = projected?.reason || projected?.identity?.reason || projected?.identity?.status;
  if (reason === 'empty_identity' || reason === 'invalid') return INGESTION_REASON.INVALID_IDENTITY;
  if (reason === 'unknown_identity' || reason === 'unknown') return INGESTION_REASON.UNKNOWN_AGENT;
  if (reason === 'legacy_agent_n' || reason === 'legacy_unavailable') return INGESTION_REASON.LEGACY_AGENT_N;
  if (reason === 'analysis_timestamp_unavailable') return INGESTION_REASON.MISSING_TIMESTAMP;
  if (reason === 'no_stage3_adapter') return INGESTION_REASON.UNKNOWN_AGENT;
  if (reason === 'adapter_failed') return INGESTION_REASON.ADAPTER_FAILED;
  if (reason === 'envelope_validation_failed') return reasonFromValidation(projected.validation);
  return INGESTION_REASON.ADAPTER_FAILED;
}

function identityDisposition(projected) {
  const status = projected?.identity?.status || projected?.reason;
  if (status === 'legacy_unavailable' || status === 'legacy_agent_n') {
    return INGESTION_DISPOSITION.REJECTED_IDENTITY;
  }
  if (
    status === 'unknown'
    || status === 'unknown_identity'
    || status === 'invalid'
    || status === 'empty_identity'
    || status === 'no_stage3_adapter'
  ) {
    return INGESTION_DISPOSITION.REJECTED_IDENTITY;
  }
  return INGESTION_DISPOSITION.REJECTED_INVALID;
}

function acceptedReason(envelope) {
  const authority = envelope?.authorityClass;
  if (authority === AUTHORITY_CLASS.CONTROL_VETO || authority === AUTHORITY_CLASS.CONTROL_SIZING) {
    return INGESTION_REASON.VALID_CONTROL_EVIDENCE;
  }
  if (authority === AUTHORITY_CLASS.EXECUTION) {
    return INGESTION_REASON.VALID_METADATA_ONLY;
  }
  return INGESTION_REASON.VALID_CURRENT_EVIDENCE;
}

function unavailableReasonKey(envelope) {
  const availability = envelope?.availability;
  if (availability === AVAILABILITY.NOT_RUN) return INGESTION_REASON.NOT_RUN;
  if (availability === AVAILABILITY.PROVIDER_UNAVAILABLE) return INGESTION_REASON.PROVIDER_UNAVAILABLE;
  if (availability === AVAILABILITY.CONTRACT_ERROR) return INGESTION_REASON.CONTRACT_ERROR;
  const reason = String(envelope?.unavailableReason || '');
  if (reason === 'mock_or_placeholder_source') return INGESTION_REASON.MOCK_OR_PLACEHOLDER;
  if (reason === 'not_run') return INGESTION_REASON.NOT_RUN;
  return INGESTION_REASON.UNAVAILABLE;
}

/**
 * Deterministic Stage 4 disposition. Fail closed. Never treats
 * UNAVAILABLE / BLOCKED / NOT_APPLICABLE / STALE as NEUTRAL.
 */
export function applyIngestionDisposition({
  envelope,
  validation,
  nowMs = Date.now(),
  decisionContext = null,
} = {}) {
  if (!envelope) {
    return {
      disposition: INGESTION_DISPOSITION.REJECTED_INVALID,
      reasonKey: INGESTION_REASON.MISSING_SOURCE,
    };
  }

  if (validation && validation.ok === false) {
    return {
      disposition: INGESTION_DISPOSITION.REJECTED_INVALID,
      reasonKey: reasonFromValidation(validation),
      validation,
    };
  }

  if (hasForbiddenExecutionClaims(envelope)) {
    return {
      disposition: INGESTION_DISPOSITION.REJECTED_INVALID,
      reasonKey: INGESTION_REASON.FORBIDDEN_EXECUTION_CLAIM,
    };
  }

  if (decisionContext && typeof decisionContext === 'object') {
    const contextCompatibility = evaluateContextCompatibility(decisionContext, envelope);
    if (!contextCompatibility.compatible) {
      return {
        disposition: INGESTION_DISPOSITION.REJECTED_CONTEXT,
        reasonKey: INGESTION_REASON.CONTEXT_INCOMPATIBLE,
        contextCompatibility,
      };
    }
  }

  if (envelope.availability === AVAILABILITY.BLOCKED) {
    return { disposition: INGESTION_DISPOSITION.BLOCKED, reasonKey: INGESTION_REASON.BLOCKED };
  }
  if (envelope.availability === AVAILABILITY.NOT_APPLICABLE) {
    return { disposition: INGESTION_DISPOSITION.NOT_APPLICABLE, reasonKey: INGESTION_REASON.NOT_APPLICABLE };
  }
  if (UNAVAILABLE_AVAILABILITY.has(envelope.availability) || isMockOrPlaceholder(envelope)) {
    return {
      disposition: INGESTION_DISPOSITION.UNAVAILABLE,
      reasonKey: unavailableReasonKey(envelope),
    };
  }

  const freshnessStatus = freshnessStatusOf(envelope);
  const expiryMs = envelope.expiryTimestamp ? Date.parse(envelope.expiryTimestamp) : NaN;
  if (
    freshnessStatus === FRESHNESS_STATUS.EXPIRED
    || (Number.isFinite(expiryMs) && expiryMs < nowMs)
  ) {
    return { disposition: INGESTION_DISPOSITION.REJECTED_EXPIRED, reasonKey: INGESTION_REASON.EXPIRED };
  }
  if (freshnessStatus === FRESHNESS_STATUS.STALE) {
    return { disposition: INGESTION_DISPOSITION.REJECTED_STALE, reasonKey: INGESTION_REASON.STALE };
  }
  if (
    freshnessStatus == null
    || freshnessStatus === FRESHNESS_STATUS.UNKNOWN
    || freshnessStatus === FRESHNESS_STATUS.UNAVAILABLE
  ) {
    return {
      disposition: INGESTION_DISPOSITION.REJECTED_INVALID,
      reasonKey: INGESTION_REASON.FRESHNESS_UNKNOWN,
    };
  }

  const quality = envelope.dataQuality?.status;
  if (quality === DATA_QUALITY_STATUS.INVALID) {
    return {
      disposition: INGESTION_DISPOSITION.REJECTED_INVALID,
      reasonKey: INGESTION_REASON.DATA_QUALITY_BLOCKED,
    };
  }

  return {
    disposition: INGESTION_DISPOSITION.ACCEPTED,
    reasonKey: acceptedReason(envelope),
  };
}

function lineageFromEnvelope(envelope) {
  if (!envelope) return Object.freeze({ runId: null, agentRecordId: null, correlationId: null });
  return Object.freeze({
    runId: envelope.runId ?? null,
    agentRecordId: envelope.agentRecordId ?? null,
    correlationId: envelope.correlationId ?? null,
    decisionContextId: envelope.decisionContextId ?? null,
    contractVersion: envelope.contractVersion ?? null,
    schemaVersion: envelope.schemaVersion ?? null,
    adapterVersion: envelope.adapterVersion ?? envelope.provenance?.adapterVersion ?? null,
    correlationFamily: envelope.correlationFamily ?? null,
    analysisTimestamp: envelope.analysisTimestamp ?? null,
    sourceTimestamp: envelope.sourceTimestamp ?? null,
    sourceCandleTimestamp: envelope.sourceCandleTimestamp ?? null,
    provenanceWriter: envelope.provenance?.writer ?? null,
    confidenceKind: envelope.confidence?.kind ?? null,
    confidenceMethodKey: envelope.confidence?.methodKey
      ?? envelope.confidence?.provenance?.methodKey
      ?? null,
    limitations: Array.isArray(envelope.limitations) ? [...envelope.limitations] : [],
  });
}

function ownershipFromRow(row, ownerUserId) {
  const rowUser = row?.user_id ?? row?.userId ?? null;
  if (ownerUserId && rowUser && String(rowUser) !== String(ownerUserId)) {
    return {
      mismatch: true,
      scope: OWNERSHIP_SCOPE.USER,
      reasonKey: INGESTION_REASON.OWNERSHIP_SCOPE_MISMATCH,
    };
  }
  return {
    mismatch: false,
    scope: rowUser ? OWNERSHIP_SCOPE.USER : OWNERSHIP_SCOPE.GLOBAL,
  };
}

function buildResult({
  disposition,
  reasonKey,
  agentId = null,
  identity = null,
  envelope = undefined,
  product = undefined,
  validation = undefined,
  persistenceModel = PERSISTENCE_MODEL.LEGACY_RECONSTRUCTED,
  ownership = undefined,
  contextCompatibility = undefined,
  errors = undefined,
  nowMs,
}) {
  const result = {
    disposition,
    reasonKey,
    agentId,
    identity,
    persistenceModel,
    envelope,
    product,
    validation,
    lineage: lineageFromEnvelope(envelope),
    freshness: envelope?.freshness ?? null,
    availability: envelope?.availability ?? null,
    authorityClass: envelope?.authorityClass ?? AGENT_CONTRACT_ROLE[agentId]?.authorityClass ?? null,
    provenancePreserved: Boolean(envelope?.provenance?.writer && envelope.provenance.writer !== 'artemis'),
    ingestion: {
      stage: INGESTION_STAGE,
      writer: INGESTION_WRITER,
      contractVersion: INGESTION_CONTRACT_VERSION,
      ingestedAt: nowIso(nowMs),
    },
    ownership,
    contextCompatibility,
    errors,
    sideEffects: sideEffects(),
    executionEligible: false,
    decisionEligible: false,
  };
  return freezeResult(result);
}

function ingestCanonicalEnvelope(rawEnvelope, options = {}) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  if (!rawEnvelope || typeof rawEnvelope !== 'object') {
    return buildResult({
      disposition: INGESTION_DISPOSITION.REJECTED_INVALID,
      reasonKey: INGESTION_REASON.MISSING_SOURCE,
      persistenceModel: PERSISTENCE_MODEL.CANONICAL_PERSISTED,
      nowMs,
    });
  }

  const normalized = applyCanonicalAgentId(rawEnvelope);
  const identity = resolveArtemisAgentIdentity(normalized.agentId);
  if (identity.status !== 'ok') {
    return buildResult({
      disposition: INGESTION_DISPOSITION.REJECTED_IDENTITY,
      reasonKey: identity.reason === 'legacy_agent_n'
        ? INGESTION_REASON.LEGACY_AGENT_N
        : identity.reason === 'empty_identity'
          ? INGESTION_REASON.INVALID_IDENTITY
          : INGESTION_REASON.UNKNOWN_AGENT,
      identity,
      persistenceModel: PERSISTENCE_MODEL.CANONICAL_PERSISTED,
      nowMs,
    });
  }

  const validation = validateEvidenceEnvelope(normalized, { nowMs });
  const policy = applyIngestionDisposition({
    envelope: normalized,
    validation,
    nowMs,
    decisionContext: options.decisionContext || null,
  });

  return buildResult({
    disposition: policy.disposition,
    reasonKey: policy.reasonKey,
    agentId: identity.agentId,
    identity,
    envelope: normalized,
    product: validation.ok ? projectEvidenceForProduct(normalized) : undefined,
    validation,
    persistenceModel: PERSISTENCE_MODEL.CANONICAL_PERSISTED,
    contextCompatibility: policy.contextCompatibility,
    nowMs,
  });
}

function ingestPersistedRow(row, options = {}) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  if (!row || typeof row !== 'object') {
    return buildResult({
      disposition: INGESTION_DISPOSITION.REJECTED_INVALID,
      reasonKey: INGESTION_REASON.MISSING_SOURCE,
      nowMs,
    });
  }

  const ownership = ownershipFromRow(row, options.ownerUserId);
  if (ownership.mismatch) {
    return buildResult({
      disposition: INGESTION_DISPOSITION.REJECTED_CONTEXT,
      reasonKey: INGESTION_REASON.OWNERSHIP_SCOPE_MISMATCH,
      identity: resolveArtemisAgentIdentity(row.agent_key || row.agentKey),
      ownership: { scope: OWNERSHIP_SCOPE.USER, matched: false },
      nowMs,
    });
  }

  const projected = projectDecisionRow(row, { nowMs, includeInternalEnvelope: true });
  if (!projected.ok) {
    return buildResult({
      disposition: identityDisposition(projected),
      reasonKey: reasonFromProjectFailure(projected),
      agentId: projected.agentId || projected.identity?.agentId || null,
      identity: projected.identity || null,
      validation: projected.validation,
      ownership: { scope: ownership.scope, matched: true },
      nowMs,
    });
  }

  const policy = applyIngestionDisposition({
    envelope: projected.envelope,
    validation: projected.validation,
    nowMs,
    decisionContext: options.decisionContext || null,
  });

  return buildResult({
    disposition: policy.disposition,
    reasonKey: policy.reasonKey,
    agentId: projected.agentId,
    identity: resolveArtemisAgentIdentity(projected.agentId),
    envelope: projected.envelope,
    product: projected.product,
    validation: projected.validation,
    persistenceModel: PERSISTENCE_MODEL.LEGACY_RECONSTRUCTED,
    ownership: { scope: ownership.scope, matched: true },
    contextCompatibility: policy.contextCompatibility,
    nowMs,
  });
}

/**
 * Ingest one evidence source: a persisted ai_decisions row and/or a canonical envelope.
 * Never mutates the native Agent run.
 */
export function ingestEvidence(input = {}, options = {}) {
  if (input?.envelope && !input?.row) {
    return ingestCanonicalEnvelope(input.envelope, options);
  }
  if (input?.row) {
    return ingestPersistedRow(input.row, options);
  }
  if (input && (input.agent_key || input.agentKey || input.output || input.output_data)) {
    return ingestPersistedRow(input, options);
  }
  if (input?.agentId || input?.schemaVersion) {
    return ingestCanonicalEnvelope(input, options);
  }
  return ingestCanonicalEnvelope(null, options);
}

export function getValidatedEvidence(input = {}, options = {}) {
  return ingestEvidence(input, options);
}

function aliasesForAgentFilter(agentIds) {
  if (!agentIds?.length) return null;
  const wanted = new Set(
    agentIds
      .map((value) => resolveArtemisAgentIdentity(value))
      .filter((item) => item.status === 'ok')
      .map((item) => item.agentId),
  );
  if (!wanted.size) return null;
  return ARTEMIS_AGENT_CATALOG
    .filter((row) => wanted.has(row.key))
    .flatMap((row) => row.aliases);
}

function emptyCounts() {
  return {
    accepted: 0,
    rejected: 0,
    unavailable: 0,
    blocked: 0,
    notApplicable: 0,
    total: 0,
  };
}

function tallyDisposition(counts, disposition) {
  counts.total += 1;
  if (disposition === INGESTION_DISPOSITION.ACCEPTED) counts.accepted += 1;
  else if (disposition === INGESTION_DISPOSITION.UNAVAILABLE) counts.unavailable += 1;
  else if (disposition === INGESTION_DISPOSITION.BLOCKED) counts.blocked += 1;
  else if (disposition === INGESTION_DISPOSITION.NOT_APPLICABLE) counts.notApplicable += 1;
  else counts.rejected += 1;
}

function normalizeOwnerUuid(ownerUserId) {
  if (ownerUserId == null || ownerUserId === '') return null;
  const text = String(ownerUserId).trim();
  if (!UUID_RE.test(text)) {
    const error = new Error('STAGE4_INVALID_OWNER_SCOPE');
    error.code = 'STAGE4_INVALID_OWNER_SCOPE';
    throw error;
  }
  return text;
}

/**
 * Bounded batch read from ai_decisions. One SELECT. Per-item disposition.
 * Invalid items do not fail the batch. Never executes Agents.
 */
export async function ingestEvidenceBatch(options = {}) {
  const started = Date.now();
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_INGEST_BATCH, 1), MAX_INGEST_BATCH);
  const ownerUserId = normalizeOwnerUuid(options.ownerUserId);
  const since = options.since || options.sinceAt || null;
  const until = options.until || options.untilAt || null;
  const agentKeys = aliasesForAgentFilter(
    options.agentIds || options.agents || (options.agentId ? [options.agentId] : null),
  );

  const result = await readOnlyQuery(AI_DECISIONS_INGEST_READ_SQL, [
    limit,
    ownerUserId,
    since,
    until,
    agentKeys,
  ]);
  const rows = result.rows || [];
  const items = rows.map((row) => ingestPersistedRow(row, {
    nowMs,
    ownerUserId,
    decisionContext: options.decisionContext || null,
  }));

  const counts = emptyCounts();
  for (const item of items) tallyDisposition(counts, item.disposition);

  lastIngestionMetrics = {
    queryCount: 1,
    rowsLoaded: rows.length,
    elapsedMs: Date.now() - started,
    nPlusOne: false,
    bounded: true,
    limit,
  };

  return freezeResult({
    items,
    counts,
    query: {
      bounded: true,
      limit,
      maxLimit: MAX_INGEST_BATCH,
      nPlusOne: false,
      sqlKind: 'select',
      ownerScoped: Boolean(ownerUserId),
      agentFilter: Boolean(agentKeys),
    },
    canonicalAgentCount: CANONICAL_AGENT_IDS.length,
    sideEffects: sideEffects(),
    metrics: getLastIngestionMetrics(),
    ingestion: {
      stage: INGESTION_STAGE,
      writer: INGESTION_WRITER,
      contractVersion: INGESTION_CONTRACT_VERSION,
      ingestedAt: nowIso(nowMs),
    },
    executionEligible: false,
    decisionEligible: false,
  });
}

export default {
  ingestEvidence,
  ingestEvidenceBatch,
  getValidatedEvidence,
  applyIngestionDisposition,
  assertReadOnlySql,
  getLastIngestionMetrics,
  AI_DECISIONS_INGEST_READ_SQL,
};
