/**
 * Artemis B10 — append-only Decision persistence (library / repository only).
 *
 * No routes, workers, schedulers, Shadow, Paper, or Live wiring.
 * Never UPDATE/DELETE Decisions. Never write ai_decisions or system_logs.
 */

import { query, transaction } from '../database/db.js';
import {
  DECISION_CONTRACT_VERSION,
  MAX_EVIDENCE_REFS,
  isDecisionSafeEvidenceRef,
  validateArtemisDecision,
} from '../contracts/artemisDecisionContract.js';
import {
  isCanonicalUuid,
  isIsoTimestamp,
} from '../contracts/artemisEvidenceContract.js';
import {
  CANONICALIZATION_VERSION,
  CanonicalizationError,
  buildCanonicalDecisionPayload,
  canonicalizeToJsonString,
  isSupportedCanonicalizationVersion,
  isWithinDecisionByteLimit,
} from './artemisDecisionCanonicalJson.js';

export const PERSIST_STATUS = Object.freeze({
  PERSISTED: 'PERSISTED',
  ALREADY_PERSISTED: 'ALREADY_PERSISTED',
});

export const PERSIST_ERROR = Object.freeze({
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  WRITER_REQUIRED: 'WRITER_REQUIRED',
  DECISION_ID_CONFLICT: 'DECISION_ID_CONFLICT',
  ORDINAL_INVALID: 'ORDINAL_INVALID',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  UNSUPPORTED_CANONICALIZATION_VERSION: 'UNSUPPORTED_CANONICALIZATION_VERSION',
  UNSUPPORTED_CONTRACT_VERSION: 'UNSUPPORTED_CONTRACT_VERSION',
  INTEGRITY_FAILED: 'INTEGRITY_FAILED',
  PROJECTION_MISMATCH: 'PROJECTION_MISMATCH',
  EVIDENCE_INTEGRITY_FAILED: 'EVIDENCE_INTEGRITY_FAILED',
  CANONICALIZATION_FAILED: 'CANONICALIZATION_FAILED',
});

const FORBIDDEN_SQL_TABLES = Object.freeze(['ai_decisions', 'system_logs']);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function assertNoForbiddenSql(sql) {
  const normalized = String(sql).toLowerCase();
  for (const table of FORBIDDEN_SQL_TABLES) {
    if (normalized.includes(table)) {
      throw new Error(`B10 persistence must not touch ${table}`);
    }
  }
}

async function safeQuery(sql, params) {
  assertNoForbiddenSql(sql);
  return query(sql, params);
}

async function safeClientQuery(client, sql, params) {
  assertNoForbiddenSql(sql);
  return client.query(sql, params);
}

function requireWriter(opts) {
  const writer = opts?.writer;
  if (typeof writer !== 'string' || writer.trim().length === 0) {
    return null;
  }
  return writer.trim();
}

/** Project freshness column: string status only; structured unavailable → NULL. */
export function projectFreshness(freshness) {
  if (typeof freshness === 'string') return freshness;
  return null;
}

/** UUID column projection: valid UUID → trim().toLowerCase(); else NULL. */
export function projectUuidOrNull(value) {
  if (!isCanonicalUuid(value)) return null;
  return String(value).trim().toLowerCase();
}

/** Require query UUID; return normalized lowercase or null if invalid. */
export function normalizeQueryUuid(value) {
  if (!isCanonicalUuid(value)) return null;
  return String(value).trim().toLowerCase();
}

/** TIMESTAMPTZ projection: ISO timestamp string only; else NULL. */
export function projectTimestampOrNull(value) {
  return isIsoTimestamp(value) ? value : null;
}

function normalizeComparableTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }
  if (typeof value === 'string') {
    if (!isIsoTimestamp(value)) return null;
    return new Date(value).toISOString();
  }
  return null;
}

function sameTimestamp(a, b) {
  return normalizeComparableTimestamp(a) === normalizeComparableTimestamp(b);
}

function sameNullableText(a, b) {
  const na = a == null ? null : String(a);
  const nb = b == null ? null : String(b);
  return na === nb;
}

function mapDecisionRow(row) {
  if (!row) return null;
  return {
    decisionId: row.decision_id,
    decisionContextId: row.decision_context_id,
    schemaVersion: row.schema_version,
    contractVersion: row.contract_version,
    policyVersion: row.policy_version,
    implementationVersion: row.implementation_version,
    createdAt: row.created_at,
    analysisAt: row.analysis_at,
    expiresAt: row.expires_at,
    symbol: row.symbol,
    venue: row.venue,
    marketType: row.market_type,
    timeframe: row.timeframe,
    analysisHorizon: row.analysis_horizon,
    synthesisOutcome: row.synthesis_outcome,
    observedDirection: row.observed_direction,
    conflictState: row.conflict_state,
    classification: row.classification,
    maturityStage: row.maturity_stage,
    decisionEligible: row.decision_eligible,
    executionEligible: row.execution_eligible,
    decisionPayload: row.decision_payload,
    payloadSha256: row.payload_sha256,
    payloadBytes: row.payload_bytes,
    canonicalizationVersion: row.canonicalization_version,
    persistedAt: row.persisted_at,
    writer: row.writer,
  };
}

function mapEvidenceRow(row) {
  return {
    decisionId: row.decision_id,
    ordinal: row.ordinal,
    agentId: row.agent_id,
    runId: row.run_id,
    agentRecordId: row.agent_record_id,
    evidenceContractVersion: row.evidence_contract_version,
    role: row.role,
    authorityClass: row.authority_class,
    correlationFamily: row.correlation_family,
    freshness: row.freshness,
    availability: row.availability,
    admissionState: row.admission_state,
    admissionReason: row.admission_reason,
    confirmationSemantics: row.confirmation_semantics,
    symbol: row.symbol,
    venue: row.venue,
    marketType: row.market_type,
    timeframe: row.timeframe,
    analysisHorizon: row.analysis_horizon,
    analysisTimestamp: row.analysis_timestamp,
    refPayload: row.ref_payload,
  };
}

export function buildEvidenceRowsFromCanonical(decisionId, evidenceRefs) {
  if (!Array.isArray(evidenceRefs)) {
    throw Object.assign(new Error('evidenceRefs required'), { code: PERSIST_ERROR.INVALID_ARGUMENT });
  }
  if (evidenceRefs.length > MAX_EVIDENCE_REFS) {
    throw Object.assign(new Error('evidence ordinal out of range'), { code: PERSIST_ERROR.ORDINAL_INVALID });
  }
  return evidenceRefs.map((ref, ordinal) => {
    if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= MAX_EVIDENCE_REFS) {
      throw Object.assign(new Error(`invalid evidence ordinal ${ordinal}`), {
        code: PERSIST_ERROR.ORDINAL_INVALID,
        ordinal,
      });
    }
    return {
      decisionId,
      ordinal,
      agentId: ref.agentId,
      runId: projectUuidOrNull(ref.runId),
      agentRecordId: projectUuidOrNull(ref.agentRecordId),
      evidenceContractVersion: ref.evidenceContractVersion,
      role: ref.role ?? null,
      authorityClass: ref.authorityClass ?? null,
      correlationFamily: ref.correlationFamily ?? null,
      freshness: projectFreshness(ref.freshness),
      availability: ref.availability ?? null,
      admissionState: ref.admissionState ?? null,
      admissionReason: ref.admissionReason ?? null,
      confirmationSemantics: ref.confirmationSemantics ?? null,
      symbol: ref.symbol ?? null,
      venue: ref.venue ?? null,
      marketType: ref.marketType ?? null,
      timeframe: ref.timeframe ?? null,
      analysisHorizon: ref.analysisHorizon ?? null,
      analysisTimestamp: projectTimestampOrNull(ref.analysisTimestamp),
      refPayload: ref,
    };
  });
}

function projectionFieldsFromCanonical(canonicalDecision) {
  return {
    decisionId: projectUuidOrNull(canonicalDecision.decisionId),
    decisionContextId: projectUuidOrNull(canonicalDecision.decisionContextId),
    schemaVersion: canonicalDecision.schemaVersion,
    contractVersion: canonicalDecision.contractVersion,
    policyVersion: canonicalDecision.policyVersion ?? null,
    implementationVersion: canonicalDecision.implementationVersion ?? null,
    createdAt: canonicalDecision.createdAt,
    analysisAt: canonicalDecision.analysisAt,
    expiresAt: projectTimestampOrNull(canonicalDecision.expiresAt),
    symbol: canonicalDecision.symbol ?? null,
    venue: canonicalDecision.venue ?? null,
    marketType: canonicalDecision.marketType ?? null,
    timeframe: canonicalDecision.timeframe ?? null,
    analysisHorizon: canonicalDecision.analysisHorizon ?? null,
    synthesisOutcome: canonicalDecision.synthesisOutcome,
    observedDirection: canonicalDecision.direction ?? null,
    conflictState: canonicalDecision.conflictState ?? null,
    classification: canonicalDecision.classification,
    maturityStage: canonicalDecision.maturityStage,
    decisionEligible: canonicalDecision.decisionEligible,
    executionEligible: canonicalDecision.executionEligible,
  };
}

function sameUuidColumn(stored, expected) {
  return projectUuidOrNull(stored) === (expected == null ? null : expected);
}

function compareEvidenceProjection(child, expected) {
  return (
    child.agentId === expected.agentId
    && sameUuidColumn(child.runId, expected.runId)
    && sameUuidColumn(child.agentRecordId, expected.agentRecordId)
    && child.evidenceContractVersion === expected.evidenceContractVersion
    && sameNullableText(child.role, expected.role)
    && sameNullableText(child.authorityClass, expected.authorityClass)
    && sameNullableText(child.correlationFamily, expected.correlationFamily)
    && sameNullableText(child.freshness, expected.freshness)
    && sameNullableText(child.availability, expected.availability)
    && sameNullableText(child.admissionState, expected.admissionState)
    && sameNullableText(child.admissionReason, expected.admissionReason)
    && sameNullableText(child.confirmationSemantics, expected.confirmationSemantics)
    && sameNullableText(child.symbol, expected.symbol)
    && sameNullableText(child.venue, expected.venue)
    && sameNullableText(child.marketType, expected.marketType)
    && sameNullableText(child.timeframe, expected.timeframe)
    && sameNullableText(child.analysisHorizon, expected.analysisHorizon)
    && sameTimestamp(child.analysisTimestamp, expected.analysisTimestamp)
  );
}

/**
 * Fail-closed verification of a durable Decision row.
 * @param {object} row mapped or raw-compatible row with decisionPayload fields
 */
export function verifyStoredDecisionRow(row) {
  if (!row || typeof row !== 'object') {
    return fail(PERSIST_ERROR.INTEGRITY_FAILED, 'missing stored decision row');
  }

  const canonicalizationVersion = row.canonicalizationVersion ?? row.canonicalization_version;
  if (!isSupportedCanonicalizationVersion(canonicalizationVersion)) {
    return fail(
      PERSIST_ERROR.UNSUPPORTED_CANONICALIZATION_VERSION,
      'unsupported canonicalization_version',
      { canonicalizationVersion },
    );
  }

  const decisionPayload = row.decisionPayload ?? row.decision_payload;
  if (!decisionPayload || typeof decisionPayload !== 'object' || Array.isArray(decisionPayload)) {
    return fail(PERSIST_ERROR.INTEGRITY_FAILED, 'decision_payload must be an object');
  }

  const storedContract = row.contractVersion ?? row.contract_version;
  if (storedContract !== decisionPayload.contractVersion) {
    return fail(PERSIST_ERROR.INTEGRITY_FAILED, 'contract_version projection disagrees with payload', {
      storedContract,
      payloadContract: decisionPayload.contractVersion,
    });
  }

  if (decisionPayload.contractVersion !== DECISION_CONTRACT_VERSION) {
    return fail(
      PERSIST_ERROR.UNSUPPORTED_CONTRACT_VERSION,
      'unsupported Decision contractVersion',
      { contractVersion: decisionPayload.contractVersion },
    );
  }

  const validation = validateArtemisDecision(decisionPayload);
  if (!validation.ok) {
    return fail(PERSIST_ERROR.VALIDATION_FAILED, 'stored decision_payload failed validation', {
      validation,
    });
  }

  let recomputed;
  try {
    recomputed = buildCanonicalDecisionPayload(decisionPayload);
  } catch (err) {
    return fail(PERSIST_ERROR.CANONICALIZATION_FAILED, err.message, {
      codeDetail: err.code,
    });
  }

  const storedSha = row.payloadSha256 ?? row.payload_sha256;
  const storedBytes = row.payloadBytes ?? row.payload_bytes;
  if (storedSha !== recomputed.payloadSha256) {
    return fail(PERSIST_ERROR.INTEGRITY_FAILED, 'stored payload_sha256 mismatch', {
      storedSha,
      recomputedSha: recomputed.payloadSha256,
    });
  }
  if (Number(storedBytes) !== recomputed.payloadBytes) {
    return fail(PERSIST_ERROR.INTEGRITY_FAILED, 'stored payload_bytes mismatch', {
      storedBytes,
      recomputedBytes: recomputed.payloadBytes,
    });
  }

  const expected = projectionFieldsFromCanonical(recomputed.canonicalObject);
  const mapped = {
    decisionId: row.decisionId ?? row.decision_id,
    decisionContextId: row.decisionContextId ?? row.decision_context_id,
    schemaVersion: row.schemaVersion ?? row.schema_version,
    contractVersion: row.contractVersion ?? row.contract_version,
    policyVersion: row.policyVersion ?? row.policy_version ?? null,
    implementationVersion: row.implementationVersion ?? row.implementation_version ?? null,
    createdAt: row.createdAt ?? row.created_at,
    analysisAt: row.analysisAt ?? row.analysis_at,
    expiresAt: row.expiresAt ?? row.expires_at,
    symbol: row.symbol ?? null,
    venue: row.venue ?? null,
    marketType: row.marketType ?? row.market_type ?? null,
    timeframe: row.timeframe ?? null,
    analysisHorizon: row.analysisHorizon ?? row.analysis_horizon ?? null,
    synthesisOutcome: row.synthesisOutcome ?? row.synthesis_outcome,
    observedDirection: row.observedDirection ?? row.observed_direction ?? null,
    conflictState: row.conflictState ?? row.conflict_state ?? null,
    classification: row.classification,
    maturityStage: row.maturityStage ?? row.maturity_stage,
    decisionEligible: row.decisionEligible ?? row.decision_eligible,
    executionEligible: row.executionEligible ?? row.execution_eligible,
  };

  const mismatches = [];
  if (!sameUuidColumn(mapped.decisionId, expected.decisionId)) mismatches.push('decisionId');
  if (!sameUuidColumn(mapped.decisionContextId, expected.decisionContextId)) mismatches.push('decisionContextId');
  if (mapped.schemaVersion !== expected.schemaVersion) mismatches.push('schemaVersion');
  if (mapped.contractVersion !== expected.contractVersion) mismatches.push('contractVersion');
  if (!sameNullableText(mapped.policyVersion, expected.policyVersion)) mismatches.push('policyVersion');
  if (!sameNullableText(mapped.implementationVersion, expected.implementationVersion)) {
    mismatches.push('implementationVersion');
  }
  if (!sameTimestamp(mapped.createdAt, expected.createdAt)) mismatches.push('createdAt');
  if (!sameTimestamp(mapped.analysisAt, expected.analysisAt)) mismatches.push('analysisAt');
  if (!sameTimestamp(mapped.expiresAt, expected.expiresAt)) mismatches.push('expiresAt');
  if (!sameNullableText(mapped.symbol, expected.symbol)) mismatches.push('symbol');
  if (!sameNullableText(mapped.venue, expected.venue)) mismatches.push('venue');
  if (!sameNullableText(mapped.marketType, expected.marketType)) mismatches.push('marketType');
  if (!sameNullableText(mapped.timeframe, expected.timeframe)) mismatches.push('timeframe');
  if (!sameNullableText(mapped.analysisHorizon, expected.analysisHorizon)) mismatches.push('analysisHorizon');
  if (mapped.synthesisOutcome !== expected.synthesisOutcome) mismatches.push('synthesisOutcome');
  if (!sameNullableText(mapped.observedDirection, expected.observedDirection)) mismatches.push('observedDirection');
  if (!sameNullableText(mapped.conflictState, expected.conflictState)) mismatches.push('conflictState');
  if (mapped.classification !== expected.classification) mismatches.push('classification');
  if (mapped.maturityStage !== expected.maturityStage) mismatches.push('maturityStage');
  if (mapped.decisionEligible !== expected.decisionEligible) mismatches.push('decisionEligible');
  if (mapped.executionEligible !== expected.executionEligible) mismatches.push('executionEligible');

  if (mismatches.length) {
    return fail(PERSIST_ERROR.PROJECTION_MISMATCH, 'projection columns disagree with canonical payload', {
      mismatches,
    });
  }

  return {
    ok: true,
    decision: recomputed.canonicalObject,
    payloadSha256: recomputed.payloadSha256,
    payloadBytes: recomputed.payloadBytes,
    canonicalizationVersion,
    persistedAt: row.persistedAt ?? row.persisted_at,
    writer: row.writer,
  };
}

async function loadExistingDecisionFull(decisionId) {
  const result = await safeQuery(
    `SELECT *
     FROM artemis_decisions
     WHERE decision_id = $1`,
    [decisionId],
  );
  return result.rows[0] || null;
}

async function resolveUniqueViolation(decisionId, attemptedSha256) {
  const existing = await loadExistingDecisionFull(decisionId);
  if (!existing) {
    return fail(PERSIST_ERROR.DECISION_ID_CONFLICT, 'decision_id conflict without readable existing row', {
      decisionId,
    });
  }

  const verified = verifyStoredDecisionRow(existing);
  if (!verified.ok) {
    return fail(PERSIST_ERROR.INTEGRITY_FAILED, 'existing durable Decision failed integrity', {
      decisionId,
      integrity: verified,
    });
  }

  if (verified.payloadSha256 === attemptedSha256) {
    return {
      ok: true,
      status: PERSIST_STATUS.ALREADY_PERSISTED,
      decisionId,
      decision: verified.decision,
      payloadSha256: verified.payloadSha256,
      payloadBytes: verified.payloadBytes,
      canonicalizationVersion: verified.canonicalizationVersion,
      persistedAt: verified.persistedAt,
      writer: verified.writer,
    };
  }

  return fail(
    PERSIST_ERROR.DECISION_ID_CONFLICT,
    'same decision_id with different payload_sha256; never overwrite',
    {
      decisionId,
      existingPayloadSha256: verified.payloadSha256,
      attemptedPayloadSha256: attemptedSha256,
    },
  );
}

/**
 * Persist ArtemisDecision + evidence refs atomically.
 * Order: writer → strict canonicalize → validate(canonicalObject) → byte limit → project → TX
 */
export async function persistArtemisDecision(decision, opts = {}) {
  const writer = requireWriter(opts);
  if (!writer) {
    return fail(PERSIST_ERROR.WRITER_REQUIRED, 'writer is required');
  }

  let canonical;
  try {
    canonical = buildCanonicalDecisionPayload(decision);
  } catch (err) {
    if (err instanceof CanonicalizationError) {
      return fail(PERSIST_ERROR.CANONICALIZATION_FAILED, err.message, { codeDetail: err.code });
    }
    return fail(PERSIST_ERROR.CANONICALIZATION_FAILED, err?.message || 'canonicalization failed');
  }

  let validation;
  try {
    validation = validateArtemisDecision(canonical.canonicalObject);
  } catch (err) {
    return fail(PERSIST_ERROR.VALIDATION_FAILED, 'validator exception after canonicalization', {
      validatorException: String(err?.message || err).slice(0, 200),
    });
  }
  if (!validation.ok) {
    return fail(PERSIST_ERROR.VALIDATION_FAILED, validation.message || 'Decision validation failed', {
      validation,
    });
  }

  if (!isWithinDecisionByteLimit(canonical.payloadBytes)) {
    return fail(PERSIST_ERROR.PAYLOAD_TOO_LARGE, 'canonical payload exceeds 16384 UTF-8 bytes', {
      payloadBytes: canonical.payloadBytes,
      limit: 16384,
    });
  }

  const c = canonical.canonicalObject;
  const projections = projectionFieldsFromCanonical(c);
  let evidenceRows;
  try {
    evidenceRows = buildEvidenceRowsFromCanonical(projections.decisionId, c.evidenceRefs || []);
  } catch (err) {
    return fail(err.code || PERSIST_ERROR.ORDINAL_INVALID, err.message, { ordinal: err.ordinal });
  }

  const insertDecisionSql = `
    INSERT INTO artemis_decisions (
      decision_id,
      decision_context_id,
      schema_version,
      contract_version,
      policy_version,
      implementation_version,
      created_at,
      analysis_at,
      expires_at,
      symbol,
      venue,
      market_type,
      timeframe,
      analysis_horizon,
      synthesis_outcome,
      observed_direction,
      conflict_state,
      classification,
      maturity_stage,
      decision_eligible,
      execution_eligible,
      decision_payload,
      payload_sha256,
      payload_bytes,
      canonicalization_version,
      writer
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22::jsonb,$23,$24,$25,$26
    )
  `;

  const insertRefSql = `
    INSERT INTO artemis_decision_evidence_refs (
      decision_id,
      ordinal,
      agent_id,
      run_id,
      agent_record_id,
      evidence_contract_version,
      role,
      authority_class,
      correlation_family,
      freshness,
      availability,
      admission_state,
      admission_reason,
      confirmation_semantics,
      symbol,
      venue,
      market_type,
      timeframe,
      analysis_horizon,
      analysis_timestamp,
      ref_payload
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21::jsonb
    )
  `;

  try {
    await transaction(async (client) => {
      await safeClientQuery(client, insertDecisionSql, [
        projections.decisionId,
        projections.decisionContextId,
        projections.schemaVersion,
        projections.contractVersion,
        projections.policyVersion,
        projections.implementationVersion,
        projections.createdAt,
        projections.analysisAt,
        projections.expiresAt,
        projections.symbol,
        projections.venue,
        projections.marketType,
        projections.timeframe,
        projections.analysisHorizon,
        projections.synthesisOutcome,
        projections.observedDirection,
        projections.conflictState,
        projections.classification,
        projections.maturityStage,
        projections.decisionEligible,
        projections.executionEligible,
        canonical.canonicalUtf8,
        canonical.payloadSha256,
        canonical.payloadBytes,
        CANONICALIZATION_VERSION,
        writer,
      ]);

      for (const row of evidenceRows) {
        await safeClientQuery(client, insertRefSql, [
          row.decisionId,
          row.ordinal,
          row.agentId,
          row.runId,
          row.agentRecordId,
          row.evidenceContractVersion,
          row.role,
          row.authorityClass,
          row.correlationFamily,
          row.freshness,
          row.availability,
          row.admissionState,
          row.admissionReason,
          row.confirmationSemantics,
          row.symbol,
          row.venue,
          row.marketType,
          row.timeframe,
          row.analysisHorizon,
          row.analysisTimestamp,
          canonicalizeToJsonString(row.refPayload),
        ]);
      }
    });
  } catch (err) {
    if (err && err.code === '23505') {
      return resolveUniqueViolation(projections.decisionId, canonical.payloadSha256);
    }
    throw err;
  }

  return {
    ok: true,
    status: PERSIST_STATUS.PERSISTED,
    decisionId: projections.decisionId,
    decision: c,
    payloadSha256: canonical.payloadSha256,
    payloadBytes: canonical.payloadBytes,
    canonicalizationVersion: CANONICALIZATION_VERSION,
  };
}

export async function getDecisionById(decisionId) {
  const id = normalizeQueryUuid(decisionId);
  if (!id) {
    return fail(PERSIST_ERROR.INVALID_ARGUMENT, 'decisionId must be a canonical UUID');
  }
  const result = await safeQuery(
    `SELECT *
     FROM artemis_decisions
     WHERE decision_id = $1`,
    [id],
  );
  if (!result.rows[0]) {
    return { ok: true, found: false, decision: null };
  }
  const verified = verifyStoredDecisionRow(result.rows[0]);
  if (!verified.ok) {
    return verified;
  }
  return {
    ok: true,
    found: true,
    decision: verified.decision,
    payloadSha256: verified.payloadSha256,
    payloadBytes: verified.payloadBytes,
    canonicalizationVersion: verified.canonicalizationVersion,
    persistedAt: verified.persistedAt,
    writer: verified.writer,
  };
}

export async function listDecisionsByContextId(contextId, opts = {}) {
  const id = normalizeQueryUuid(contextId);
  if (!id) {
    return fail(PERSIST_ERROR.INVALID_ARGUMENT, 'contextId must be a canonical UUID');
  }
  const limit = Number.isInteger(opts.limit) && opts.limit > 0 ? Math.min(opts.limit, 200) : 50;
  const offset = Number.isInteger(opts.offset) && opts.offset >= 0 ? opts.offset : 0;
  const result = await safeQuery(
    `SELECT *
     FROM artemis_decisions
     WHERE decision_context_id = $1
     ORDER BY created_at DESC, persisted_at DESC
     LIMIT $2 OFFSET $3`,
    [id, limit, offset],
  );

  const decisions = [];
  for (const row of result.rows) {
    const verified = verifyStoredDecisionRow(row);
    if (!verified.ok) {
      return fail(verified.code, verified.message, {
        ...verified,
        decisionId: row.decision_id,
      });
    }
    decisions.push({
      decision: verified.decision,
      payloadSha256: verified.payloadSha256,
      payloadBytes: verified.payloadBytes,
      canonicalizationVersion: verified.canonicalizationVersion,
      persistedAt: verified.persistedAt,
      writer: verified.writer,
    });
  }

  return {
    ok: true,
    decisions,
    limit,
    offset,
  };
}

export async function listEvidenceRefs(decisionId) {
  const id = normalizeQueryUuid(decisionId);
  if (!id) {
    return fail(PERSIST_ERROR.INVALID_ARGUMENT, 'decisionId must be a canonical UUID');
  }

  const parent = await getDecisionById(id);
  if (!parent.ok) return parent;
  if (!parent.found) {
    return fail(PERSIST_ERROR.INVALID_ARGUMENT, 'decision not found', { decisionId: id });
  }

  const expectedRefs = parent.decision.evidenceRefs || [];
  const result = await safeQuery(
    `SELECT *
     FROM artemis_decision_evidence_refs
     WHERE decision_id = $1
     ORDER BY ordinal ASC`,
    [id],
  );
  const children = result.rows.map(mapEvidenceRow);

  if (children.length !== expectedRefs.length) {
    return fail(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED, 'evidence child count drift', {
      expected: expectedRefs.length,
      actual: children.length,
    });
  }

  for (let i = 0; i < expectedRefs.length; i += 1) {
    const child = children[i];
    const parentRef = expectedRefs[i];
    if (!child || child.ordinal !== i) {
      return fail(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED, 'evidence ordinal drift', {
        expectedOrdinal: i,
        actualOrdinal: child?.ordinal,
      });
    }
    if (!isDecisionSafeEvidenceRef(parentRef)) {
      return fail(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED, 'parent evidence ref is not Decision-safe', {
        ordinal: i,
      });
    }

    let expectedCanonicalRef;
    try {
      expectedCanonicalRef = JSON.parse(canonicalizeToJsonString(parentRef));
    } catch (err) {
      return fail(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED, 'failed to canonicalize parent evidence ref', {
        ordinal: i,
        detail: err.message,
      });
    }

    let childCanonicalRef;
    try {
      childCanonicalRef = JSON.parse(canonicalizeToJsonString(child.refPayload));
    } catch (err) {
      return fail(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED, 'failed to canonicalize child ref_payload', {
        ordinal: i,
        detail: err.message,
      });
    }

    if (canonicalizeToJsonString(expectedCanonicalRef) !== canonicalizeToJsonString(childCanonicalRef)) {
      return fail(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED, 'ref_payload drift vs parent evidenceRefs', {
        ordinal: i,
      });
    }

    const expectedProjection = buildEvidenceRowsFromCanonical(id, [expectedCanonicalRef])[0];
    if (!compareEvidenceProjection(child, expectedProjection)) {
      return fail(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED, 'normalized evidence projection drift', {
        ordinal: i,
      });
    }
  }

  return {
    ok: true,
    evidenceRefs: children,
  };
}

export default {
  persistArtemisDecision,
  getDecisionById,
  listDecisionsByContextId,
  listEvidenceRefs,
  verifyStoredDecisionRow,
  projectUuidOrNull,
  normalizeQueryUuid,
  projectTimestampOrNull,
  projectFreshness,
  buildEvidenceRowsFromCanonical,
  PERSIST_STATUS,
  PERSIST_ERROR,
};
