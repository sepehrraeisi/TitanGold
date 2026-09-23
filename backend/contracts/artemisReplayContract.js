/**
 * Artemis Core Stage 9 — S9-REPLAY-CONTRACT
 * ARTEMIS_REPLAY_CONTRACT_BOUNDARY
 *
 * Deterministic, non-executing, library-only Replay semantic / validation boundary.
 * Describes a replay REQUEST safely. Does NOT execute replay, reconstruction,
 * model/provider recomputation, Decision/Evidence/Control Chain rerun, or SoT I/O.
 *
 * Authority: REPLAY · Tier 3 · isSourceOfTruth = false
 * Binds Decision Lineage via thin sourceLineageRef only (READ/REFERENCE).
 */

import { createHash } from 'node:crypto';
import {
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
  collectForbiddenSecretKeys,
} from './artemisEvidenceContract.js';
import {
  DECISION_LINEAGE_CONTRACT_VERSION,
  DECISION_LINEAGE_ARTIFACT_TYPE,
  DECISION_LINEAGE_AUTHORITY_CLASS,
  DECISION_LINEAGE_SLICE_ID,
  RECONSTRUCTABILITY_STATUS,
} from './artemisDecisionLineageContract.js';

/** Canonical reconstructability values from Decision Lineage (READ/REFERENCE). */
const RECONSTRUCTABILITY_STATUS_SET = new Set(
  Object.values(RECONSTRUCTABILITY_STATUS)
);

export const REPLAY_SCHEMA_VERSION = '1.0.0';
export const REPLAY_CONTRACT_VERSION = 'artemis-replay-1.0.0';
export const REPLAY_POLICY_VERSION = 'artemis-replay-policy-1.0.0';
export const REPLAY_ARTIFACT_TYPE = 'ARTEMIS_REPLAY_REQUEST';
export const REPLAY_AUTHORITY_CLASS = 'REPLAY';
export const REPLAY_SLICE_ID = 'S9-REPLAY-CONTRACT';
export const REPLAY_METHOD_KEY = 'artemis.replay.request.v1';
export const REPLAY_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const REPLAY_IS_SOURCE_OF_TRUTH = false;

/** Frozen Replay mode enum — exact Stage 9 authorized distinction only. */
export const REPLAY_MODE = Object.freeze({
  ORIGINAL_HISTORICAL: 'ORIGINAL_HISTORICAL',
  CURRENT_RECOMPUTATION: 'CURRENT_RECOMPUTATION',
});
export const REPLAY_MODE_SET = new Set(Object.values(REPLAY_MODE));

/** Upstream model/config remain unavailable — never fabricate. */
export const UPSTREAM_METADATA_UNAVAILABLE = 'UPSTREAM_METADATA_UNAVAILABLE';
export const CANONICAL_WHERE_UPSTREAM_SUPPORTS = 'CANONICAL_WHERE_UPSTREAM_SUPPORTS';

export const MAX_REPLAY_UTF8_BYTES = 24 * 1024;
export const MAX_PROVENANCE_KEYS = 24;
export const MAX_LIMITATIONS = 32;
export const MAX_LIMITATION_CHARS = 512;
export const MAX_STRING = 256;
export const MAX_NOTE_CHARS = 2048;

export const ZERO_REPLAY_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  networkRequestCount: 0,
  providerRequestCount: 0,
  llmCallCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  runtimeMutationCount: 0,
  redis: 0,
  db: 0,
  network: 0,
  provider: 0,
  llm: 0,
  orders: 0,
  financial: 0,
  runtime: 0,
  replayExecution: 0,
  reconstructionExecution: 0,
  modelRecomputation: 0,
  providerRecomputation: 0,
});

/**
 * Hard authority flags — all must be false.
 * Includes Replay-specific execution authorization flags.
 */
export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  liveTradingEnabled: false,
  paperTradingEnabled: false,
  providerConnected: false,
  runtimeActivated: false,
  shadowRuntimeActivated: false,
  workerActivated: false,
  schedulerActivated: false,
  b10WriteAttempted: false,
  persistenceEnabled: false,
  replayActivated: false,
  replayExecutionAuthorized: false,
  reconstructionExecutionAuthorized: false,
  modelRecomputationAuthorized: false,
  providerRecomputationAuthorized: false,
});

const HARD_FLAG_KEYS = Object.keys(REQUIRED_HARD_FLAGS);

const TOP_LEVEL_ALLOWLIST = new Set([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'authorityClass',
  'sliceId',
  'replayId',
  'recordedAt',
  'replayMode',
  'historicalCutoffAt',
  'sourceLineageRef',
  'sourceLineageArtifact',
  'versions',
  'provenance',
  'limitations',
  'sideEffects',
  'ownershipRole',
  'isSourceOfTruth',
  'implementationVersion',
  ...HARD_FLAG_KEYS,
]);

const SOURCE_LINEAGE_REF_ALLOWLIST = new Set([
  'lineageId',
  'contractVersion',
  'reconstructabilityStatus',
  'recordedAt',
  'decisionAnalysisAt',
  'decisionCreatedAt',
]);

const VERSIONS_ALLOWLIST = new Set([
  'replayContractVersion',
  'decisionLineageContractVersion',
  'policyVersion',
  'implementationVersion',
  'modelVersionCanonicalStatus',
  'configurationVersionCanonicalStatus',
  'policyVersionCanonicalStatus',
  'implementationVersionCanonicalStatus',
]);

const PROVENANCE_ALLOWLIST = new Set([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'policyVersion',
  'implementationVersion',
  'historicalClassification',
  'modelVersionCanonicalStatus',
  'configurationVersionCanonicalStatus',
  'note',
]);

/**
 * Semantic contamination / look-ahead / raw-market / financial / fabrication keys.
 * Deep-scanned on every build input. Presence anywhere → fail closed.
 */
export const FORBIDDEN_REPLAY_KEYS = new Set([
  'lookahead',
  'lookAhead',
  'look_ahead',
  'futureData',
  'futureEvidence',
  'futureMarketData',
  'futureMarketContext',
  'postDecisionEvidenceAsInput',
  'currentDataAsHistorical',
  'currentModelAsHistorical',
  'currentProviderAsHistorical',
  'currentConfigurationAsHistorical',
  'ohlcv',
  'candles',
  'ticker',
  'orderBook',
  'orderbook',
  'depth',
  'rawSeries',
  'rawMarketData',
  'marketSnapshot',
  'providerPayload',
  'exchangeResponse',
  'outcome',
  'outcomes',
  'outcomeId',
  'outcomeRef',
  'evaluation',
  'evaluations',
  'evaluationId',
  'evaluationRef',
  'modelVersion',
  'configurationVersion',
  'modelSnapshotId',
  'configurationSnapshotId',
  'policySnapshotId',
  'order',
  'orders',
  'orderId',
  'executionIntent',
  'executionCommand',
  'wallet',
  'balance',
  'transfer',
  'withdrawal',
  'tradeExecution',
  'realizedPnl',
  'pnl',
  'ROI',
  'roi',
  'return',
  'profit',
  'financialResult',
  'replayedDecision',
  'replayedEvidence',
  'recomputedDecision',
  'recomputedScore',
  'recomputedEvaluation',
  'simulatedPnl',
  'historicalPnl',
  'replaySuccess',
  'replayPerformance',
  'replayEngine',
  'replayService',
  'reconstructionEngine',
  'b10',
  'password',
  'secret',
  'apiKey',
  'apiSecret',
  'privateKey',
  'accessToken',
  'refreshToken',
  'authorization',
  'credential',
  'jwt',
]);

function fail(code, message, details = undefined) {
  const err = new Error(message);
  err.code = code;
  if (details !== undefined) err.details = details;
  throw err;
}

function assertPlainObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, message);
  }
}

function assertAllowlist(obj, allowlist, code, path) {
  for (const key of Object.keys(obj)) {
    if (!allowlist.has(key)) {
      fail(code, `Unknown field not allowed: ${path}.${key}`, { path, key });
    }
  }
}

function assertNonEmptyString(value, code, field, max = MAX_STRING) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    fail(code, `Invalid ${field}`);
  }
}

function assertUuid(value, code, field) {
  if (!isCanonicalUuid(value)) fail(code, `Invalid ${field} UUID`);
}

function assertIso(value, code, field) {
  if (!isIsoTimestamp(value)) fail(code, `Invalid ${field} ISO timestamp`);
}

/**
 * Deep-scan for forbidden semantic contamination keys.
 *
 * Special cases (Decision Lineage convention):
 * - `sourceLineageArtifact` is NOT walked here; it is validated separately via
 *   Decision Lineage contract (extractSourceLineageRef). Walking it would false-
 *   positive on Lineage sideEffects counters such as `orders: 0`.
 * - `sideEffects` numeric counter leaves with forbidden-looking names (e.g.
 *   `orders: 0`) are allowed; object/array values under those names fail closed.
 */
function collectForbiddenKeysDeep(value, acc = []) {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenKeysDeep(item, acc);
    return acc;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key === 'sourceLineageArtifact') {
      continue;
    }
    if (key === 'sideEffects' && nested && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const [seKey, seVal] of Object.entries(nested)) {
        if (typeof seVal === 'number') continue;
        if (FORBIDDEN_REPLAY_KEYS.has(seKey)) acc.push(`sideEffects.${seKey}`);
        if (seVal && typeof seVal === 'object') collectForbiddenKeysDeep(seVal, acc);
      }
      continue;
    }
    if (FORBIDDEN_REPLAY_KEYS.has(key)) acc.push(key);
    collectForbiddenKeysDeep(nested, acc);
  }
  return acc;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  for (const nested of Object.values(value)) freezeDeep(nested);
  return Object.freeze(value);
}

/**
 * Deterministic UUIDv4-shaped identity from canonical semantic parts.
 * Same convention as Decision Lineage / Evaluation contracts.
 * Forbidden for identity: Date.now / Math.random / randomUUID / randomBytes.
 */
export function hashToUuid(parts) {
  const h = createHash('sha256');
  for (const part of parts) {
    h.update(String(part ?? ''));
    h.update('|');
  }
  const buf = h.digest();
  const bytes = Buffer.from(buf.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Canonical Decision-time boundary ms from analysisAt (preferred) then createdAt.
 * Mirrors Decision Lineage decisionTimeMs semantics.
 */
export function decisionBoundaryMs(analysisAt, createdAt) {
  if (analysisAt != null && analysisAt !== '') {
    if (!isIsoTimestamp(analysisAt)) fail('REPLAY_DECISION_ANALYSIS_AT_INVALID', 'decisionAnalysisAt invalid');
    return Date.parse(analysisAt);
  }
  if (createdAt != null && createdAt !== '') {
    if (!isIsoTimestamp(createdAt)) fail('REPLAY_DECISION_CREATED_AT_INVALID', 'decisionCreatedAt invalid');
    return Date.parse(createdAt);
  }
  return null;
}

function assertHardFlags(input) {
  for (const key of HARD_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== false) {
      fail('REPLAY_AUTHORITY_FLAG_INVALID', `Hard flag ${key} must be false`, { key });
    }
  }
}

function normalizeLimitations(raw) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail('REPLAY_LIMITATIONS_INVALID', 'limitations must be an array');
  if (raw.length > MAX_LIMITATIONS) fail('REPLAY_LIMITATIONS_TOO_MANY', 'Too many limitations');
  const out = [];
  for (const item of raw) {
    assertNonEmptyString(item, 'REPLAY_LIMITATION_INVALID', 'limitation', MAX_LIMITATION_CHARS);
    out.push(item);
  }
  return out;
}

function normalizeProvenance(raw, defaults) {
  if (raw === undefined) {
    return { ...defaults };
  }
  assertPlainObject(raw, 'REPLAY_PROVENANCE_INVALID', 'provenance must be an object');
  assertAllowlist(raw, PROVENANCE_ALLOWLIST, 'REPLAY_PROVENANCE_UNKNOWN_FIELD', 'provenance');
  if (Object.keys(raw).length > MAX_PROVENANCE_KEYS) {
    fail('REPLAY_PROVENANCE_TOO_MANY_KEYS', 'provenance has too many keys');
  }
  const out = { ...defaults };
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (key === 'note') {
      assertNonEmptyString(v, 'REPLAY_PROVENANCE_NOTE_INVALID', 'provenance.note', MAX_NOTE_CHARS);
      out.note = v;
      continue;
    }
    if (key === 'recordedAt') {
      assertIso(v, 'REPLAY_PROVENANCE_RECORDED_AT_INVALID', 'provenance.recordedAt');
      if (v !== defaults.recordedAt) {
        fail('REPLAY_PROVENANCE_RECORDED_AT_MISMATCH', 'provenance.recordedAt must match top-level recordedAt');
      }
      out.recordedAt = v;
      continue;
    }
    if (typeof v !== 'string' || v.length === 0 || v.length > MAX_STRING) {
      fail('REPLAY_PROVENANCE_FIELD_INVALID', `Invalid provenance.${key}`, { key });
    }
    if (defaults[key] !== undefined && v !== defaults[key]) {
      fail('REPLAY_PROVENANCE_FIELD_MISMATCH', `provenance.${key} conflicts with canonical value`, { key });
    }
    out[key] = v;
  }
  return out;
}

/**
 * Extract thin sourceLineageRef from a built Decision Lineage artifact.
 * Does not embed or mutate the artifact.
 */
export function extractSourceLineageRef(artifact) {
  assertPlainObject(artifact, 'REPLAY_SOURCE_LINEAGE_ARTIFACT_INVALID', 'sourceLineageArtifact must be an object');

  if (artifact.artifactType !== DECISION_LINEAGE_ARTIFACT_TYPE) {
    fail('REPLAY_SOURCE_LINEAGE_ARTIFACT_TYPE_INVALID', 'sourceLineageArtifact.artifactType invalid');
  }
  if (artifact.authorityClass !== DECISION_LINEAGE_AUTHORITY_CLASS) {
    fail('REPLAY_SOURCE_LINEAGE_AUTHORITY_INVALID', 'sourceLineageArtifact.authorityClass invalid');
  }
  if (artifact.sliceId !== DECISION_LINEAGE_SLICE_ID) {
    fail('REPLAY_SOURCE_LINEAGE_SLICE_INVALID', 'sourceLineageArtifact.sliceId invalid');
  }
  if (artifact.contractVersion !== DECISION_LINEAGE_CONTRACT_VERSION) {
    fail('REPLAY_SOURCE_LINEAGE_CONTRACT_VERSION_MISMATCH', 'sourceLineageArtifact.contractVersion mismatch');
  }
  assertUuid(artifact.lineageId, 'REPLAY_SOURCE_LINEAGE_ID_INVALID', 'sourceLineageArtifact.lineageId');
  assertIso(artifact.recordedAt, 'REPLAY_SOURCE_LINEAGE_RECORDED_AT_INVALID', 'sourceLineageArtifact.recordedAt');
  if (!RECONSTRUCTABILITY_STATUS_SET.has(artifact.reconstructabilityStatus)) {
    fail('REPLAY_SOURCE_LINEAGE_RECONSTRUCTABILITY_INVALID', 'sourceLineageArtifact.reconstructabilityStatus invalid');
  }

  const decision = artifact.decision;
  assertPlainObject(decision, 'REPLAY_SOURCE_LINEAGE_DECISION_INVALID', 'sourceLineageArtifact.decision required');
  const decisionRef = decision.decisionRef;
  assertPlainObject(decisionRef, 'REPLAY_SOURCE_LINEAGE_DECISION_REF_INVALID', 'decision.decisionRef required');

  const ref = {
    lineageId: artifact.lineageId,
    contractVersion: artifact.contractVersion,
    reconstructabilityStatus: artifact.reconstructabilityStatus,
    recordedAt: artifact.recordedAt,
  };
  if (decisionRef.analysisAt != null) {
    assertIso(decisionRef.analysisAt, 'REPLAY_SOURCE_LINEAGE_ANALYSIS_AT_INVALID', 'decision.decisionRef.analysisAt');
    ref.decisionAnalysisAt = decisionRef.analysisAt;
  }
  if (decisionRef.createdAt != null) {
    assertIso(decisionRef.createdAt, 'REPLAY_SOURCE_LINEAGE_CREATED_AT_INVALID', 'decision.decisionRef.createdAt');
    ref.decisionCreatedAt = decisionRef.createdAt;
  }
  return ref;
}

function normalizeSourceLineageRef(raw) {
  assertPlainObject(raw, 'REPLAY_SOURCE_LINEAGE_REF_INVALID', 'sourceLineageRef must be an object');
  assertAllowlist(raw, SOURCE_LINEAGE_REF_ALLOWLIST, 'REPLAY_SOURCE_LINEAGE_REF_UNKNOWN_FIELD', 'sourceLineageRef');
  assertUuid(raw.lineageId, 'REPLAY_SOURCE_LINEAGE_ID_INVALID', 'sourceLineageRef.lineageId');

  const out = { lineageId: raw.lineageId };

  if (raw.contractVersion !== undefined) {
    assertNonEmptyString(raw.contractVersion, 'REPLAY_SOURCE_LINEAGE_CONTRACT_VERSION_INVALID', 'sourceLineageRef.contractVersion');
    if (raw.contractVersion !== DECISION_LINEAGE_CONTRACT_VERSION) {
      fail('REPLAY_SOURCE_LINEAGE_CONTRACT_VERSION_MISMATCH', 'sourceLineageRef.contractVersion mismatch');
    }
    out.contractVersion = raw.contractVersion;
  } else {
    out.contractVersion = DECISION_LINEAGE_CONTRACT_VERSION;
  }

  if (raw.reconstructabilityStatus !== undefined) {
    if (!RECONSTRUCTABILITY_STATUS_SET.has(raw.reconstructabilityStatus)) {
      fail('REPLAY_SOURCE_LINEAGE_RECONSTRUCTABILITY_INVALID', 'sourceLineageRef.reconstructabilityStatus invalid');
    }
    out.reconstructabilityStatus = raw.reconstructabilityStatus;
  }

  if (raw.recordedAt !== undefined) {
    assertIso(raw.recordedAt, 'REPLAY_SOURCE_LINEAGE_RECORDED_AT_INVALID', 'sourceLineageRef.recordedAt');
    out.recordedAt = raw.recordedAt;
  }

  if (raw.decisionAnalysisAt !== undefined) {
    assertIso(raw.decisionAnalysisAt, 'REPLAY_SOURCE_LINEAGE_ANALYSIS_AT_INVALID', 'sourceLineageRef.decisionAnalysisAt');
    out.decisionAnalysisAt = raw.decisionAnalysisAt;
  }
  if (raw.decisionCreatedAt !== undefined) {
    assertIso(raw.decisionCreatedAt, 'REPLAY_SOURCE_LINEAGE_CREATED_AT_INVALID', 'sourceLineageRef.decisionCreatedAt');
    out.decisionCreatedAt = raw.decisionCreatedAt;
  }

  return out;
}

function mergeSourceLineageInputs(input) {
  const hasRef = Object.prototype.hasOwnProperty.call(input, 'sourceLineageRef');
  const hasArtifact = Object.prototype.hasOwnProperty.call(input, 'sourceLineageArtifact');

  if (!hasRef && !hasArtifact) {
    fail('REPLAY_SOURCE_LINEAGE_REQUIRED', 'sourceLineageRef or sourceLineageArtifact is required');
  }

  let fromArtifact = null;
  if (hasArtifact) {
    fromArtifact = extractSourceLineageRef(input.sourceLineageArtifact);
  }

  let fromRef = null;
  if (hasRef) {
    fromRef = normalizeSourceLineageRef(input.sourceLineageRef);
  }

  if (fromArtifact && fromRef) {
    if (fromArtifact.lineageId !== fromRef.lineageId) {
      fail('REPLAY_SOURCE_LINEAGE_ID_CONFLICT', 'sourceLineageRef.lineageId conflicts with sourceLineageArtifact');
    }
    if (fromRef.contractVersion && fromArtifact.contractVersion !== fromRef.contractVersion) {
      fail('REPLAY_SOURCE_LINEAGE_CONTRACT_VERSION_CONFLICT', 'source lineage contractVersion conflict');
    }
    if (
      fromRef.reconstructabilityStatus !== undefined &&
      fromArtifact.reconstructabilityStatus !== fromRef.reconstructabilityStatus
    ) {
      fail('REPLAY_SOURCE_LINEAGE_RECONSTRUCTABILITY_CONFLICT', 'source lineage reconstructability conflict');
    }
    if (fromRef.recordedAt !== undefined && fromArtifact.recordedAt !== fromRef.recordedAt) {
      fail('REPLAY_SOURCE_LINEAGE_RECORDED_AT_CONFLICT', 'source lineage recordedAt conflict');
    }
    // Prefer artifact-derived timestamps when present; allow ref to supply missing boundary.
    return {
      lineageId: fromArtifact.lineageId,
      contractVersion: fromArtifact.contractVersion,
      reconstructabilityStatus: fromArtifact.reconstructabilityStatus,
      recordedAt: fromArtifact.recordedAt,
      decisionAnalysisAt: fromArtifact.decisionAnalysisAt ?? fromRef.decisionAnalysisAt,
      decisionCreatedAt: fromArtifact.decisionCreatedAt ?? fromRef.decisionCreatedAt,
    };
  }

  return fromArtifact || fromRef;
}

function assertReconstructabilityAcceptable(status) {
  if (status === undefined) {
    // Thin ref without status: allow only when caller did not claim INSUFFICIENT.
    // Semantic request may proceed; incompleteness recorded in limitations.
    return;
  }
  if (status === RECONSTRUCTABILITY_STATUS.INSUFFICIENT) {
    fail(
      'REPLAY_SOURCE_LINEAGE_INSUFFICIENT',
      'Replay semantics cannot be stated for INSUFFICIENT Decision Lineage reconstructability'
    );
  }
  if (
    status !== RECONSTRUCTABILITY_STATUS.COMPLETE &&
    status !== RECONSTRUCTABILITY_STATUS.PARTIAL
  ) {
    fail('REPLAY_SOURCE_LINEAGE_RECONSTRUCTABILITY_INVALID', 'reconstructabilityStatus invalid');
  }
}

function assertHistoricalCutoff(mode, historicalCutoffAt, sourceRef) {
  assertIso(historicalCutoffAt, 'REPLAY_HISTORICAL_CUTOFF_INVALID', 'historicalCutoffAt');
  const cutoffMs = Date.parse(historicalCutoffAt);
  if (!Number.isFinite(cutoffMs)) {
    fail('REPLAY_HISTORICAL_CUTOFF_INVALID', 'historicalCutoffAt not parseable');
  }

  const boundaryMs = decisionBoundaryMs(sourceRef.decisionAnalysisAt, sourceRef.decisionCreatedAt);

  if (mode === REPLAY_MODE.ORIGINAL_HISTORICAL) {
    if (boundaryMs == null) {
      fail(
        'REPLAY_DECISION_BOUNDARY_REQUIRED',
        'ORIGINAL_HISTORICAL requires Decision-time boundary (decisionAnalysisAt or decisionCreatedAt) from source lineage'
      );
    }
    // Cutoff must not permit post-decision information into Decision-side historical input.
    // Fail closed — no silent clamp.
    if (cutoffMs > boundaryMs) {
      fail(
        'REPLAY_HISTORICAL_CUTOFF_BEYOND_DECISION_BOUNDARY',
        'historicalCutoffAt must not exceed canonical Decision-time boundary for ORIGINAL_HISTORICAL'
      );
    }
  } else if (mode === REPLAY_MODE.CURRENT_RECOMPUTATION) {
    // Recomputation still binds a historical cutoff; if Decision boundary is known,
    // the cutoff must not invent post-decision history as Decision-time input.
    if (boundaryMs != null && cutoffMs > boundaryMs) {
      fail(
        'REPLAY_HISTORICAL_CUTOFF_BEYOND_DECISION_BOUNDARY',
        'historicalCutoffAt must not exceed canonical Decision-time boundary'
      );
    }
  }

  if (sourceRef.recordedAt !== undefined) {
    assertIso(sourceRef.recordedAt, 'REPLAY_SOURCE_LINEAGE_RECORDED_AT_INVALID', 'sourceLineageRef.recordedAt');
    // Cutoff after lineage recordedAt would imply future-of-record data for this lineage envelope.
    if (cutoffMs > Date.parse(sourceRef.recordedAt)) {
      fail(
        'REPLAY_HISTORICAL_CUTOFF_AFTER_LINEAGE_RECORDED_AT',
        'historicalCutoffAt must not be after source lineage recordedAt'
      );
    }
  }

  return historicalCutoffAt;
}

function assertNoCurrentAsHistoricalContamination(input, mode) {
  // Explicit mode confusion: CURRENT_RECOMPUTATION must not claim original historical truth.
  if (mode === REPLAY_MODE.CURRENT_RECOMPUTATION) {
    const p = input.provenance;
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      if (p.historicalClassification === REPLAY_MODE.ORIGINAL_HISTORICAL) {
        fail(
          'REPLAY_MODE_CLASSIFICATION_CONFLICT',
          'CURRENT_RECOMPUTATION cannot declare historicalClassification=ORIGINAL_HISTORICAL'
        );
      }
    }
  }
}

/**
 * Compute deterministic replayId from semantic identity components.
 *
 * Identity-relevant (ONLY):
 *   REPLAY_CONTRACT_VERSION, REPLAY_METHOD_KEY, lineageId, replayMode,
 *   historicalCutoffAt, implementationVersion
 *
 * recordedAt is bookkeeping / audit only and does NOT participate in replayId
 * (same precedent as Decision Lineage recordedAt vs lineageId).
 */
export function computeReplayId({
  lineageId,
  replayMode,
  historicalCutoffAt,
  implementationVersion,
}) {
  return hashToUuid([
    REPLAY_CONTRACT_VERSION,
    REPLAY_METHOD_KEY,
    lineageId,
    replayMode,
    historicalCutoffAt,
    implementationVersion,
  ]);
}

/**
 * Build a validated, deeply immutable Artemis Replay Request artifact.
 * Semantic envelope only — zero side effects; no replay execution.
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function buildArtemisReplayRequest(input) {
  assertPlainObject(input, 'REPLAY_INPUT_INVALID', 'Replay input must be a plain object');

  // Forbidden / secret before allowlist so contamination codes are specific
  // (REPLAY_FORBIDDEN_FIELD / REPLAY_SECRET_FIELD), not REPLAY_UNKNOWN_FIELD.
  const forbidden = collectForbiddenKeysDeep(input);
  if (forbidden.length > 0) {
    fail('REPLAY_FORBIDDEN_FIELD', `Forbidden field present: ${forbidden[0]}`, { keys: forbidden });
  }
  const secrets = collectForbiddenSecretKeys(input);
  if (secrets.length > 0) {
    fail('REPLAY_SECRET_FIELD', `Secret-like field present: ${secrets[0]}`, { keys: secrets });
  }

  assertAllowlist(input, TOP_LEVEL_ALLOWLIST, 'REPLAY_UNKNOWN_FIELD', 'replay');
  assertHardFlags(input);

  if (input.schemaVersion !== undefined && input.schemaVersion !== REPLAY_SCHEMA_VERSION) {
    fail('REPLAY_SCHEMA_VERSION_MISMATCH', 'schemaVersion mismatch');
  }
  if (input.contractVersion !== undefined && input.contractVersion !== REPLAY_CONTRACT_VERSION) {
    fail('REPLAY_CONTRACT_VERSION_MISMATCH', 'contractVersion mismatch');
  }
  if (input.policyVersion !== undefined && input.policyVersion !== REPLAY_POLICY_VERSION) {
    fail('REPLAY_POLICY_VERSION_MISMATCH', 'policyVersion mismatch');
  }
  if (input.artifactType !== undefined && input.artifactType !== REPLAY_ARTIFACT_TYPE) {
    fail('REPLAY_ARTIFACT_TYPE_MISMATCH', 'artifactType mismatch');
  }
  if (input.authorityClass !== undefined && input.authorityClass !== REPLAY_AUTHORITY_CLASS) {
    fail('REPLAY_AUTHORITY_CLASS_MISMATCH', 'authorityClass mismatch');
  }
  if (input.sliceId !== undefined && input.sliceId !== REPLAY_SLICE_ID) {
    fail('REPLAY_SLICE_ID_MISMATCH', 'sliceId mismatch');
  }
  if (input.ownershipRole !== undefined && input.ownershipRole !== REPLAY_OWNERSHIP_ROLE) {
    fail('REPLAY_OWNERSHIP_ROLE_MISMATCH', 'ownershipRole mismatch');
  }
  if (input.isSourceOfTruth !== undefined && input.isSourceOfTruth !== false) {
    fail('REPLAY_IS_SOURCE_OF_TRUTH_INVALID', 'isSourceOfTruth must be false');
  }

  assertIso(input.recordedAt, 'REPLAY_RECORDED_AT_INVALID', 'recordedAt');
  assertNonEmptyString(input.replayMode, 'REPLAY_MODE_INVALID', 'replayMode');
  if (!REPLAY_MODE_SET.has(input.replayMode)) {
    fail('REPLAY_MODE_UNKNOWN', `Unknown replayMode: ${input.replayMode}`);
  }

  assertNoCurrentAsHistoricalContamination(input, input.replayMode);

  const sourceRef = mergeSourceLineageInputs(input);
  assertReconstructabilityAcceptable(sourceRef.reconstructabilityStatus);

  assertNonEmptyString(input.historicalCutoffAt, 'REPLAY_HISTORICAL_CUTOFF_REQUIRED', 'historicalCutoffAt');
  const historicalCutoffAt = assertHistoricalCutoff(
    input.replayMode,
    input.historicalCutoffAt,
    sourceRef
  );

  // recordedAt must not precede historicalCutoffAt in a way that claims future bookkeeping
  // relative to cutoff — allow recordedAt >= cutoff (audit after request formation).
  // Reject recordedAt before cutoff only if it would imply the request was recorded
  // before the historical domain it claims (clock smuggling into bookkeeping).
  // Bookkeeping recordedAt is independent of identity; no silent repair.

  const implementationVersion =
    input.implementationVersion !== undefined
      ? (() => {
          assertNonEmptyString(input.implementationVersion, 'REPLAY_IMPLEMENTATION_VERSION_INVALID', 'implementationVersion');
          return input.implementationVersion;
        })()
      : REPLAY_CONTRACT_VERSION;

  if (input.versions !== undefined) {
    assertPlainObject(input.versions, 'REPLAY_VERSIONS_INVALID', 'versions must be an object');
    assertAllowlist(input.versions, VERSIONS_ALLOWLIST, 'REPLAY_VERSIONS_UNKNOWN_FIELD', 'versions');
    // Reject any attempt to supply fabricated model/configuration version values via versions.
    for (const banned of ['modelVersion', 'configurationVersion', 'modelSnapshotId', 'configurationSnapshotId']) {
      if (Object.prototype.hasOwnProperty.call(input.versions, banned)) {
        fail('REPLAY_VERSION_FABRICATION', `versions.${banned} is not allowed`);
      }
    }
    if (
      input.versions.modelVersionCanonicalStatus !== undefined &&
      input.versions.modelVersionCanonicalStatus !== UPSTREAM_METADATA_UNAVAILABLE
    ) {
      fail('REPLAY_MODEL_VERSION_STATUS_INVALID', 'modelVersionCanonicalStatus must be UPSTREAM_METADATA_UNAVAILABLE');
    }
    if (
      input.versions.configurationVersionCanonicalStatus !== undefined &&
      input.versions.configurationVersionCanonicalStatus !== UPSTREAM_METADATA_UNAVAILABLE
    ) {
      fail(
        'REPLAY_CONFIGURATION_VERSION_STATUS_INVALID',
        'configurationVersionCanonicalStatus must be UPSTREAM_METADATA_UNAVAILABLE'
      );
    }
    if (
      input.versions.replayContractVersion !== undefined &&
      input.versions.replayContractVersion !== REPLAY_CONTRACT_VERSION
    ) {
      fail('REPLAY_VERSIONS_CONTRACT_MISMATCH', 'versions.replayContractVersion mismatch');
    }
    if (
      input.versions.decisionLineageContractVersion !== undefined &&
      input.versions.decisionLineageContractVersion !== sourceRef.contractVersion
    ) {
      fail('REPLAY_VERSIONS_LINEAGE_CONTRACT_MISMATCH', 'versions.decisionLineageContractVersion mismatch');
    }
  }

  if (input.sideEffects !== undefined) {
    assertPlainObject(input.sideEffects, 'REPLAY_SIDE_EFFECTS_INVALID', 'sideEffects must be an object');
    for (const [k, v] of Object.entries(input.sideEffects)) {
      if (!Object.prototype.hasOwnProperty.call(ZERO_REPLAY_SIDE_EFFECTS, k)) {
        fail('REPLAY_SIDE_EFFECTS_UNKNOWN_FIELD', `Unknown sideEffects.${k}`);
      }
      if (v !== 0) {
        fail('REPLAY_SIDE_EFFECTS_NONZERO', `sideEffects.${k} must be 0`);
      }
    }
  }

  const historicalClassification =
    input.replayMode === REPLAY_MODE.ORIGINAL_HISTORICAL
      ? 'ORIGINAL_HISTORICAL'
      : 'CURRENT_RECOMPUTATION_INTENT';

  const provenanceDefaults = {
    writer: 'artemisReplayContract',
    methodKey: REPLAY_METHOD_KEY,
    stage: 'ARTEMIS_CORE_STAGE_9',
    recordedAt: input.recordedAt,
    policyVersion: REPLAY_POLICY_VERSION,
    implementationVersion,
    historicalClassification,
    modelVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
    configurationVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
  };
  const provenance = normalizeProvenance(input.provenance, provenanceDefaults);

  const limitations = normalizeLimitations(input.limitations);
  if (sourceRef.reconstructabilityStatus === RECONSTRUCTABILITY_STATUS.PARTIAL) {
    const note = 'source_lineage_reconstructability=PARTIAL';
    if (!limitations.includes(note)) limitations.push(note);
  }

  const thinSourceLineageRef = {
    lineageId: sourceRef.lineageId,
    contractVersion: sourceRef.contractVersion,
  };
  if (sourceRef.reconstructabilityStatus !== undefined) {
    thinSourceLineageRef.reconstructabilityStatus = sourceRef.reconstructabilityStatus;
  }
  if (sourceRef.recordedAt !== undefined) {
    thinSourceLineageRef.recordedAt = sourceRef.recordedAt;
  }
  if (sourceRef.decisionAnalysisAt !== undefined) {
    thinSourceLineageRef.decisionAnalysisAt = sourceRef.decisionAnalysisAt;
  }
  if (sourceRef.decisionCreatedAt !== undefined) {
    thinSourceLineageRef.decisionCreatedAt = sourceRef.decisionCreatedAt;
  }

  const computedReplayId = computeReplayId({
    lineageId: thinSourceLineageRef.lineageId,
    replayMode: input.replayMode,
    historicalCutoffAt,
    implementationVersion,
  });

  if (input.replayId !== undefined) {
    assertUuid(input.replayId, 'REPLAY_ID_INVALID', 'replayId');
    if (input.replayId !== computedReplayId) {
      fail('REPLAY_ID_CONFLICT', 'Caller-supplied replayId does not match computed deterministic identity');
    }
  }

  const artifact = {
    schemaVersion: REPLAY_SCHEMA_VERSION,
    contractVersion: REPLAY_CONTRACT_VERSION,
    policyVersion: REPLAY_POLICY_VERSION,
    artifactType: REPLAY_ARTIFACT_TYPE,
    authorityClass: REPLAY_AUTHORITY_CLASS,
    sliceId: REPLAY_SLICE_ID,
    replayId: computedReplayId,
    recordedAt: input.recordedAt,
    replayMode: input.replayMode,
    historicalCutoffAt,
    sourceLineageRef: thinSourceLineageRef,
    versions: {
      replayContractVersion: REPLAY_CONTRACT_VERSION,
      decisionLineageContractVersion: thinSourceLineageRef.contractVersion,
      policyVersion: REPLAY_POLICY_VERSION,
      implementationVersion,
      modelVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
      configurationVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
      policyVersionCanonicalStatus: CANONICAL_WHERE_UPSTREAM_SUPPORTS,
      implementationVersionCanonicalStatus: CANONICAL_WHERE_UPSTREAM_SUPPORTS,
    },
    provenance,
    limitations,
    sideEffects: { ...ZERO_REPLAY_SIDE_EFFECTS },
    ownershipRole: REPLAY_OWNERSHIP_ROLE,
    isSourceOfTruth: false,
    implementationVersion,
    ...REQUIRED_HARD_FLAGS,
  };

  const bytes = utf8ByteLength(JSON.stringify(artifact));
  if (bytes > MAX_REPLAY_UTF8_BYTES) {
    fail('REPLAY_ARTIFACT_TOO_LARGE', `Replay artifact exceeds ${MAX_REPLAY_UTF8_BYTES} bytes`, { bytes });
  }

  return freezeDeep(artifact);
}

/** Alias — validate === build (fail-closed). */
export function validateArtemisReplayRequest(input) {
  return buildArtemisReplayRequest(input);
}

export default {
  REPLAY_SCHEMA_VERSION,
  REPLAY_CONTRACT_VERSION,
  REPLAY_POLICY_VERSION,
  REPLAY_ARTIFACT_TYPE,
  REPLAY_AUTHORITY_CLASS,
  REPLAY_SLICE_ID,
  REPLAY_METHOD_KEY,
  REPLAY_OWNERSHIP_ROLE,
  REPLAY_IS_SOURCE_OF_TRUTH,
  REPLAY_MODE,
  REPLAY_MODE_SET,
  UPSTREAM_METADATA_UNAVAILABLE,
  CANONICAL_WHERE_UPSTREAM_SUPPORTS,
  MAX_REPLAY_UTF8_BYTES,
  ZERO_REPLAY_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS,
  FORBIDDEN_REPLAY_KEYS,
  hashToUuid,
  computeReplayId,
  decisionBoundaryMs,
  extractSourceLineageRef,
  buildArtemisReplayRequest,
  validateArtemisReplayRequest,
};
