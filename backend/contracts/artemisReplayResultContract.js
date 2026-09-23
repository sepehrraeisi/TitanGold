/**
 * Artemis Core Stage 9 — S9-REPLAY-RESULT-CONTRACT
 * ARTEMIS_REPLAY_RESULT_CONTRACT_BOUNDARY
 *
 * Deterministic, non-executing, library-only Replay RESULT semantic /
 * validation boundary. Classifies a thin result envelope against a canonical
 * Replay REQUEST. Does NOT execute replay, reconstruction, model/provider
 * recomputation, comparison, evaluation, or SoT I/O.
 *
 * Authority: REPLAY · Tier 3 · isSourceOfTruth = false
 * Binds Replay Contract via thin sourceReplayRef only (READ/REFERENCE).
 */

import {
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
  collectForbiddenSecretKeys,
} from './artemisEvidenceContract.js';
import {
  REPLAY_ARTIFACT_TYPE,
  REPLAY_AUTHORITY_CLASS,
  REPLAY_CONTRACT_VERSION,
  REPLAY_MODE,
  REPLAY_MODE_SET,
  REPLAY_SLICE_ID,
  REQUIRED_HARD_FLAGS as REPLAY_REQUIRED_HARD_FLAGS,
  UPSTREAM_METADATA_UNAVAILABLE,
  CANONICAL_WHERE_UPSTREAM_SUPPORTS,
  hashToUuid,
} from './artemisReplayContract.js';

export const REPLAY_RESULT_SCHEMA_VERSION = '1.0.0';
export const REPLAY_RESULT_CONTRACT_VERSION = 'artemis-replay-result-1.0.0';
export const REPLAY_RESULT_POLICY_VERSION = 'artemis-replay-result-policy-1.0.0';
export const REPLAY_RESULT_ARTIFACT_TYPE = 'ARTEMIS_REPLAY_RESULT';
/** Canonical authority remains REPLAY — never REPLAY_RESULT. */
export const REPLAY_RESULT_AUTHORITY_CLASS = REPLAY_AUTHORITY_CLASS;
export const REPLAY_RESULT_SLICE_ID = 'S9-REPLAY-RESULT-CONTRACT';
export const REPLAY_RESULT_METHOD_KEY = 'artemis.replay.result.v1';
export const REPLAY_RESULT_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const REPLAY_RESULT_IS_SOURCE_OF_TRUTH = false;

/** Reuse Replay REQUEST mode vocabulary for RESULT classification. */
export const REPLAY_RESULT_CLASSIFICATION = REPLAY_MODE;
export const REPLAY_RESULT_CLASSIFICATION_SET = REPLAY_MODE_SET;

export { UPSTREAM_METADATA_UNAVAILABLE, CANONICAL_WHERE_UPSTREAM_SUPPORTS, hashToUuid };

export const MAX_REPLAY_RESULT_UTF8_BYTES = 16 * 1024;
export const MAX_PROVENANCE_KEYS = 24;
export const MAX_LIMITATIONS = 32;
export const MAX_LIMITATION_CHARS = 512;
export const MAX_STRING = 256;
export const MAX_NOTE_CHARS = 2048;

export const ZERO_REPLAY_RESULT_SIDE_EFFECTS = Object.freeze({
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
  comparisonExecution: 0,
  evaluationExecution: 0,
});

/**
 * Hard authority flags — all must be false.
 * Same Replay execution flags as REQUEST; no invented REPLAY_RESULT class.
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
  'replayResultId',
  'recordedAt',
  'resultClassification',
  'sourceReplayRef',
  'sourceReplayArtifact',
  'versions',
  'provenance',
  'limitations',
  'sideEffects',
  'ownershipRole',
  'isSourceOfTruth',
  'implementationVersion',
  ...HARD_FLAG_KEYS,
]);

const SOURCE_REPLAY_REF_ALLOWLIST = new Set([
  'replayId',
  'contractVersion',
  'replayMode',
  'historicalCutoffAt',
  'recordedAt',
  'lineageId',
]);

const VERSIONS_ALLOWLIST = new Set([
  'replayResultContractVersion',
  'replayContractVersion',
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
  'resultClassification',
  'modelVersionCanonicalStatus',
  'configurationVersionCanonicalStatus',
  'note',
]);

/**
 * Semantic contamination / look-ahead / fabricated result / comparison /
 * evaluation / financial keys. Deep-scanned on every build input.
 */
export const FORBIDDEN_REPLAY_RESULT_KEYS = new Set([
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
  'providerResponse',
  'exchangeResponse',
  'outcome',
  'outcomes',
  'outcomeId',
  'outcomeRef',
  'evaluation',
  'evaluations',
  'evaluationId',
  'evaluationRef',
  'evaluationScore',
  'evaluationResult',
  'accuracy',
  'precision',
  'recall',
  'winRate',
  'lossRate',
  'calibration',
  'promotionScore',
  'confidenceCalibration',
  'comparison',
  'comparisonResult',
  'difference',
  'delta',
  'scoreDelta',
  'decisionDelta',
  'evidenceDelta',
  'modelDelta',
  'matchRate',
  'agreementRate',
  'modelVersion',
  'configurationVersion',
  'modelSnapshotId',
  'configurationSnapshotId',
  'policySnapshotId',
  'modelOutput',
  'modelResponse',
  'llmOutput',
  'providerOutput',
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
  'simulatedPnl',
  'historicalPnl',
  'pnl',
  'ROI',
  'roi',
  'return',
  'returns',
  'profit',
  'financialResult',
  'replayedDecision',
  'reconstructedDecision',
  'historicalDecision',
  'recomputedDecision',
  'replayedEvidence',
  'reconstructedEvidence',
  'recomputedEvidence',
  'replayedContext',
  'reconstructedContext',
  'recomputedContext',
  'recomputedScore',
  'historicalScore',
  'decisionScore',
  'replaySuccess',
  'successRate',
  'performance',
  'qualityScore',
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
 * Special cases:
 * - `sourceReplayArtifact` is NOT walked here; validated separately via
 *   extractSourceReplayRef (avoids false-positives on Replay sideEffects
 *   counters such as `orders: 0`).
 * - `sideEffects` numeric counter leaves with forbidden-looking names are
 *   allowed; object/array values under those names fail closed.
 */
function collectForbiddenKeysDeep(value, acc = []) {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenKeysDeep(item, acc);
    return acc;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key === 'sourceReplayArtifact') {
      continue;
    }
    if (key === 'sideEffects' && nested && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const [seKey, seVal] of Object.entries(nested)) {
        if (typeof seVal === 'number') continue;
        if (FORBIDDEN_REPLAY_RESULT_KEYS.has(seKey)) acc.push(`sideEffects.${seKey}`);
        if (seVal && typeof seVal === 'object') collectForbiddenKeysDeep(seVal, acc);
      }
      continue;
    }
    if (FORBIDDEN_REPLAY_RESULT_KEYS.has(key)) acc.push(key);
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

function assertHardFlags(input) {
  for (const key of HARD_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== false) {
      fail('REPLAY_RESULT_AUTHORITY_FLAG_INVALID', `Hard flag ${key} must be false`, { key });
    }
  }
}

function normalizeLimitations(raw) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail('REPLAY_RESULT_LIMITATIONS_INVALID', 'limitations must be an array');
  if (raw.length > MAX_LIMITATIONS) fail('REPLAY_RESULT_LIMITATIONS_TOO_MANY', 'Too many limitations');
  const out = [];
  for (const item of raw) {
    assertNonEmptyString(item, 'REPLAY_RESULT_LIMITATION_INVALID', 'limitation', MAX_LIMITATION_CHARS);
    out.push(item);
  }
  return out;
}

function normalizeProvenance(raw, defaults) {
  if (raw === undefined) {
    return { ...defaults };
  }
  assertPlainObject(raw, 'REPLAY_RESULT_PROVENANCE_INVALID', 'provenance must be an object');
  assertAllowlist(raw, PROVENANCE_ALLOWLIST, 'REPLAY_RESULT_PROVENANCE_UNKNOWN_FIELD', 'provenance');
  if (Object.keys(raw).length > MAX_PROVENANCE_KEYS) {
    fail('REPLAY_RESULT_PROVENANCE_TOO_MANY_KEYS', 'provenance has too many keys');
  }
  const out = { ...defaults };
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (key === 'note') {
      assertNonEmptyString(v, 'REPLAY_RESULT_PROVENANCE_NOTE_INVALID', 'provenance.note', MAX_NOTE_CHARS);
      out.note = v;
      continue;
    }
    if (key === 'recordedAt') {
      assertIso(v, 'REPLAY_RESULT_PROVENANCE_RECORDED_AT_INVALID', 'provenance.recordedAt');
      if (v !== defaults.recordedAt) {
        fail(
          'REPLAY_RESULT_PROVENANCE_RECORDED_AT_MISMATCH',
          'provenance.recordedAt must match top-level recordedAt'
        );
      }
      out.recordedAt = v;
      continue;
    }
    if (typeof v !== 'string' || v.length === 0 || v.length > MAX_STRING) {
      fail('REPLAY_RESULT_PROVENANCE_FIELD_INVALID', `Invalid provenance.${key}`, { key });
    }
    if (defaults[key] !== undefined && v !== defaults[key]) {
      fail(
        'REPLAY_RESULT_PROVENANCE_FIELD_MISMATCH',
        `provenance.${key} conflicts with canonical value`,
        { key }
      );
    }
    out[key] = v;
  }
  return out;
}

function assertReplayArtifactHardFlags(artifact) {
  for (const key of Object.keys(REPLAY_REQUIRED_HARD_FLAGS)) {
    if (Object.prototype.hasOwnProperty.call(artifact, key) && artifact[key] !== false) {
      fail(
        'REPLAY_RESULT_SOURCE_REPLAY_AUTHORITY_INVALID',
        `sourceReplayArtifact.${key} must be false`,
        { key }
      );
    }
  }
}

/**
 * Extract thin sourceReplayRef from a built Replay REQUEST artifact.
 * Does not embed or mutate the artifact.
 */
export function extractSourceReplayRef(artifact) {
  assertPlainObject(artifact, 'REPLAY_RESULT_SOURCE_REPLAY_ARTIFACT_INVALID', 'sourceReplayArtifact must be an object');

  if (artifact.artifactType !== REPLAY_ARTIFACT_TYPE) {
    fail('REPLAY_RESULT_SOURCE_REPLAY_ARTIFACT_TYPE_INVALID', 'sourceReplayArtifact.artifactType invalid');
  }
  if (artifact.authorityClass !== REPLAY_AUTHORITY_CLASS) {
    fail('REPLAY_RESULT_SOURCE_REPLAY_AUTHORITY_INVALID', 'sourceReplayArtifact.authorityClass invalid');
  }
  if (artifact.sliceId !== REPLAY_SLICE_ID) {
    fail('REPLAY_RESULT_SOURCE_REPLAY_SLICE_INVALID', 'sourceReplayArtifact.sliceId invalid');
  }
  if (artifact.contractVersion !== REPLAY_CONTRACT_VERSION) {
    fail(
      'REPLAY_RESULT_SOURCE_REPLAY_CONTRACT_VERSION_MISMATCH',
      'sourceReplayArtifact.contractVersion mismatch'
    );
  }
  if (artifact.isSourceOfTruth !== false) {
    fail('REPLAY_RESULT_SOURCE_REPLAY_IS_SOT_INVALID', 'sourceReplayArtifact.isSourceOfTruth must be false');
  }

  assertReplayArtifactHardFlags(artifact);

  assertUuid(artifact.replayId, 'REPLAY_RESULT_SOURCE_REPLAY_ID_INVALID', 'sourceReplayArtifact.replayId');
  assertNonEmptyString(artifact.replayMode, 'REPLAY_RESULT_SOURCE_REPLAY_MODE_INVALID', 'sourceReplayArtifact.replayMode');
  if (!REPLAY_MODE_SET.has(artifact.replayMode)) {
    fail('REPLAY_RESULT_SOURCE_REPLAY_MODE_UNKNOWN', `Unknown source replayMode: ${artifact.replayMode}`);
  }
  assertIso(
    artifact.historicalCutoffAt,
    'REPLAY_RESULT_SOURCE_HISTORICAL_CUTOFF_INVALID',
    'sourceReplayArtifact.historicalCutoffAt'
  );
  assertIso(artifact.recordedAt, 'REPLAY_RESULT_SOURCE_REPLAY_RECORDED_AT_INVALID', 'sourceReplayArtifact.recordedAt');

  const ref = {
    replayId: artifact.replayId,
    contractVersion: artifact.contractVersion,
    replayMode: artifact.replayMode,
    historicalCutoffAt: artifact.historicalCutoffAt,
    recordedAt: artifact.recordedAt,
  };

  const lineageRef = artifact.sourceLineageRef;
  if (lineageRef != null) {
    assertPlainObject(
      lineageRef,
      'REPLAY_RESULT_SOURCE_LINEAGE_REF_INVALID',
      'sourceReplayArtifact.sourceLineageRef must be an object'
    );
    if (lineageRef.lineageId !== undefined) {
      assertUuid(
        lineageRef.lineageId,
        'REPLAY_RESULT_SOURCE_LINEAGE_ID_INVALID',
        'sourceReplayArtifact.sourceLineageRef.lineageId'
      );
      ref.lineageId = lineageRef.lineageId;
    }
  }

  return ref;
}

function normalizeSourceReplayRef(raw) {
  assertPlainObject(raw, 'REPLAY_RESULT_SOURCE_REPLAY_REF_INVALID', 'sourceReplayRef must be an object');
  assertAllowlist(raw, SOURCE_REPLAY_REF_ALLOWLIST, 'REPLAY_RESULT_SOURCE_REPLAY_REF_UNKNOWN_FIELD', 'sourceReplayRef');
  assertUuid(raw.replayId, 'REPLAY_RESULT_SOURCE_REPLAY_ID_INVALID', 'sourceReplayRef.replayId');

  const out = { replayId: raw.replayId };

  if (raw.contractVersion !== undefined) {
    assertNonEmptyString(
      raw.contractVersion,
      'REPLAY_RESULT_SOURCE_REPLAY_CONTRACT_VERSION_INVALID',
      'sourceReplayRef.contractVersion'
    );
    if (raw.contractVersion !== REPLAY_CONTRACT_VERSION) {
      fail(
        'REPLAY_RESULT_SOURCE_REPLAY_CONTRACT_VERSION_MISMATCH',
        'sourceReplayRef.contractVersion mismatch'
      );
    }
    out.contractVersion = raw.contractVersion;
  } else {
    out.contractVersion = REPLAY_CONTRACT_VERSION;
  }

  if (raw.replayMode !== undefined) {
    assertNonEmptyString(raw.replayMode, 'REPLAY_RESULT_SOURCE_REPLAY_MODE_INVALID', 'sourceReplayRef.replayMode');
    if (!REPLAY_MODE_SET.has(raw.replayMode)) {
      fail('REPLAY_RESULT_SOURCE_REPLAY_MODE_UNKNOWN', `Unknown source replayMode: ${raw.replayMode}`);
    }
    out.replayMode = raw.replayMode;
  }

  if (raw.historicalCutoffAt !== undefined) {
    assertIso(
      raw.historicalCutoffAt,
      'REPLAY_RESULT_SOURCE_HISTORICAL_CUTOFF_INVALID',
      'sourceReplayRef.historicalCutoffAt'
    );
    out.historicalCutoffAt = raw.historicalCutoffAt;
  }

  if (raw.recordedAt !== undefined) {
    assertIso(raw.recordedAt, 'REPLAY_RESULT_SOURCE_REPLAY_RECORDED_AT_INVALID', 'sourceReplayRef.recordedAt');
    out.recordedAt = raw.recordedAt;
  }

  if (raw.lineageId !== undefined) {
    assertUuid(raw.lineageId, 'REPLAY_RESULT_SOURCE_LINEAGE_ID_INVALID', 'sourceReplayRef.lineageId');
    out.lineageId = raw.lineageId;
  }

  return out;
}

function mergeSourceReplayInputs(input) {
  const hasRef = Object.prototype.hasOwnProperty.call(input, 'sourceReplayRef');
  const hasArtifact = Object.prototype.hasOwnProperty.call(input, 'sourceReplayArtifact');

  if (!hasRef && !hasArtifact) {
    fail('REPLAY_RESULT_SOURCE_REPLAY_REQUIRED', 'sourceReplayRef or sourceReplayArtifact is required');
  }

  let fromArtifact = null;
  if (hasArtifact) {
    fromArtifact = extractSourceReplayRef(input.sourceReplayArtifact);
  }

  let fromRef = null;
  if (hasRef) {
    fromRef = normalizeSourceReplayRef(input.sourceReplayRef);
  }

  if (fromArtifact && fromRef) {
    if (fromArtifact.replayId !== fromRef.replayId) {
      fail(
        'REPLAY_RESULT_SOURCE_REPLAY_ID_CONFLICT',
        'sourceReplayRef.replayId conflicts with sourceReplayArtifact'
      );
    }
    if (fromRef.contractVersion && fromArtifact.contractVersion !== fromRef.contractVersion) {
      fail(
        'REPLAY_RESULT_SOURCE_REPLAY_CONTRACT_VERSION_CONFLICT',
        'source Replay contractVersion conflict'
      );
    }
    if (fromRef.replayMode !== undefined && fromArtifact.replayMode !== fromRef.replayMode) {
      fail('REPLAY_RESULT_SOURCE_REPLAY_MODE_CONFLICT', 'source Replay replayMode conflict');
    }
    if (
      fromRef.historicalCutoffAt !== undefined &&
      fromArtifact.historicalCutoffAt !== fromRef.historicalCutoffAt
    ) {
      fail(
        'REPLAY_RESULT_SOURCE_HISTORICAL_CUTOFF_CONFLICT',
        'source Replay historicalCutoffAt conflict'
      );
    }
    if (fromRef.recordedAt !== undefined && fromArtifact.recordedAt !== fromRef.recordedAt) {
      fail('REPLAY_RESULT_SOURCE_REPLAY_RECORDED_AT_CONFLICT', 'source Replay recordedAt conflict');
    }
    if (
      fromRef.lineageId !== undefined &&
      fromArtifact.lineageId !== undefined &&
      fromArtifact.lineageId !== fromRef.lineageId
    ) {
      fail('REPLAY_RESULT_SOURCE_LINEAGE_ID_CONFLICT', 'source Replay lineageId conflict');
    }

    return {
      replayId: fromArtifact.replayId,
      contractVersion: fromArtifact.contractVersion,
      replayMode: fromArtifact.replayMode,
      historicalCutoffAt: fromArtifact.historicalCutoffAt,
      recordedAt: fromArtifact.recordedAt,
      lineageId: fromArtifact.lineageId ?? fromRef.lineageId,
    };
  }

  return fromArtifact || fromRef;
}

/**
 * Compute deterministic replayResultId from semantic identity components.
 *
 * Identity-relevant (ONLY):
 *   REPLAY_RESULT_CONTRACT_VERSION, REPLAY_RESULT_METHOD_KEY,
 *   source replayId, resultClassification, historicalCutoffAt,
 *   lineageId (empty when unavailable), implementationVersion
 *
 * Result recordedAt is bookkeeping only and does NOT participate.
 */
export function computeReplayResultId({
  sourceReplayId,
  resultClassification,
  historicalCutoffAt,
  lineageId,
  implementationVersion,
}) {
  return hashToUuid([
    REPLAY_RESULT_CONTRACT_VERSION,
    REPLAY_RESULT_METHOD_KEY,
    sourceReplayId,
    resultClassification,
    historicalCutoffAt ?? '',
    lineageId ?? '',
    implementationVersion,
  ]);
}

/**
 * Build a validated, deeply immutable Artemis Replay Result artifact.
 * Semantic classification envelope only — zero side effects; no replay execution.
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function buildArtemisReplayResult(input) {
  assertPlainObject(input, 'REPLAY_RESULT_INPUT_INVALID', 'Replay Result input must be a plain object');

  const forbidden = collectForbiddenKeysDeep(input);
  if (forbidden.length > 0) {
    fail('REPLAY_RESULT_FORBIDDEN_FIELD', `Forbidden field present: ${forbidden[0]}`, { keys: forbidden });
  }
  const secrets = collectForbiddenSecretKeys(input);
  if (secrets.length > 0) {
    fail('REPLAY_RESULT_SECRET_FIELD', `Secret-like field present: ${secrets[0]}`, { keys: secrets });
  }

  assertAllowlist(input, TOP_LEVEL_ALLOWLIST, 'REPLAY_RESULT_UNKNOWN_FIELD', 'replayResult');
  assertHardFlags(input);

  if (input.schemaVersion !== undefined && input.schemaVersion !== REPLAY_RESULT_SCHEMA_VERSION) {
    fail('REPLAY_RESULT_SCHEMA_VERSION_MISMATCH', 'schemaVersion mismatch');
  }
  if (input.contractVersion !== undefined && input.contractVersion !== REPLAY_RESULT_CONTRACT_VERSION) {
    fail('REPLAY_RESULT_CONTRACT_VERSION_MISMATCH', 'contractVersion mismatch');
  }
  if (input.policyVersion !== undefined && input.policyVersion !== REPLAY_RESULT_POLICY_VERSION) {
    fail('REPLAY_RESULT_POLICY_VERSION_MISMATCH', 'policyVersion mismatch');
  }
  if (input.artifactType !== undefined && input.artifactType !== REPLAY_RESULT_ARTIFACT_TYPE) {
    fail('REPLAY_RESULT_ARTIFACT_TYPE_MISMATCH', 'artifactType mismatch');
  }
  if (input.authorityClass !== undefined && input.authorityClass !== REPLAY_RESULT_AUTHORITY_CLASS) {
    fail('REPLAY_RESULT_AUTHORITY_CLASS_MISMATCH', 'authorityClass must be REPLAY');
  }
  if (input.sliceId !== undefined && input.sliceId !== REPLAY_RESULT_SLICE_ID) {
    fail('REPLAY_RESULT_SLICE_ID_MISMATCH', 'sliceId mismatch');
  }
  if (input.ownershipRole !== undefined && input.ownershipRole !== REPLAY_RESULT_OWNERSHIP_ROLE) {
    fail('REPLAY_RESULT_OWNERSHIP_ROLE_MISMATCH', 'ownershipRole mismatch');
  }
  if (input.isSourceOfTruth !== undefined && input.isSourceOfTruth !== false) {
    fail('REPLAY_RESULT_IS_SOURCE_OF_TRUTH_INVALID', 'isSourceOfTruth must be false');
  }

  assertIso(input.recordedAt, 'REPLAY_RESULT_RECORDED_AT_INVALID', 'recordedAt');

  assertNonEmptyString(
    input.resultClassification,
    'REPLAY_RESULT_CLASSIFICATION_INVALID',
    'resultClassification'
  );
  if (!REPLAY_RESULT_CLASSIFICATION_SET.has(input.resultClassification)) {
    fail(
      'REPLAY_RESULT_CLASSIFICATION_UNKNOWN',
      `Unknown resultClassification: ${input.resultClassification}`
    );
  }

  const sourceRef = mergeSourceReplayInputs(input);

  if (sourceRef.replayMode === undefined) {
    fail(
      'REPLAY_RESULT_SOURCE_REPLAY_MODE_REQUIRED',
      'source Replay replayMode is required for classification consistency'
    );
  }
  if (sourceRef.historicalCutoffAt === undefined) {
    fail(
      'REPLAY_RESULT_SOURCE_HISTORICAL_CUTOFF_REQUIRED',
      'source Replay historicalCutoffAt is required'
    );
  }

  // Fail-closed: result classification must match source request mode. No silent conversion.
  if (input.resultClassification !== sourceRef.replayMode) {
    fail(
      'REPLAY_RESULT_CLASSIFICATION_SOURCE_MODE_MISMATCH',
      'resultClassification must match source Replay replayMode'
    );
  }

  if (sourceRef.recordedAt !== undefined) {
    const resultMs = Date.parse(input.recordedAt);
    const sourceMs = Date.parse(sourceRef.recordedAt);
    if (!Number.isFinite(resultMs) || !Number.isFinite(sourceMs)) {
      fail('REPLAY_RESULT_TEMPORAL_INVALID', 'recordedAt timestamps not parseable');
    }
    if (resultMs < sourceMs) {
      fail(
        'REPLAY_RESULT_RECORDED_AT_BEFORE_SOURCE',
        'result recordedAt must not precede source Replay recordedAt'
      );
    }
  }

  const implementationVersion =
    input.implementationVersion !== undefined
      ? (() => {
          assertNonEmptyString(
            input.implementationVersion,
            'REPLAY_RESULT_IMPLEMENTATION_VERSION_INVALID',
            'implementationVersion'
          );
          return input.implementationVersion;
        })()
      : REPLAY_RESULT_CONTRACT_VERSION;

  if (input.versions !== undefined) {
    assertPlainObject(input.versions, 'REPLAY_RESULT_VERSIONS_INVALID', 'versions must be an object');
    assertAllowlist(input.versions, VERSIONS_ALLOWLIST, 'REPLAY_RESULT_VERSIONS_UNKNOWN_FIELD', 'versions');
    for (const banned of [
      'modelVersion',
      'configurationVersion',
      'modelSnapshotId',
      'configurationSnapshotId',
      'policySnapshotId',
    ]) {
      if (Object.prototype.hasOwnProperty.call(input.versions, banned)) {
        fail('REPLAY_RESULT_VERSION_FABRICATION', `versions.${banned} is not allowed`);
      }
    }
    if (
      input.versions.modelVersionCanonicalStatus !== undefined &&
      input.versions.modelVersionCanonicalStatus !== UPSTREAM_METADATA_UNAVAILABLE
    ) {
      fail(
        'REPLAY_RESULT_MODEL_VERSION_STATUS_INVALID',
        'modelVersionCanonicalStatus must be UPSTREAM_METADATA_UNAVAILABLE'
      );
    }
    if (
      input.versions.configurationVersionCanonicalStatus !== undefined &&
      input.versions.configurationVersionCanonicalStatus !== UPSTREAM_METADATA_UNAVAILABLE
    ) {
      fail(
        'REPLAY_RESULT_CONFIGURATION_VERSION_STATUS_INVALID',
        'configurationVersionCanonicalStatus must be UPSTREAM_METADATA_UNAVAILABLE'
      );
    }
    if (
      input.versions.replayResultContractVersion !== undefined &&
      input.versions.replayResultContractVersion !== REPLAY_RESULT_CONTRACT_VERSION
    ) {
      fail('REPLAY_RESULT_VERSIONS_CONTRACT_MISMATCH', 'versions.replayResultContractVersion mismatch');
    }
    if (
      input.versions.replayContractVersion !== undefined &&
      input.versions.replayContractVersion !== sourceRef.contractVersion
    ) {
      fail('REPLAY_RESULT_VERSIONS_REPLAY_CONTRACT_MISMATCH', 'versions.replayContractVersion mismatch');
    }
  }

  if (input.sideEffects !== undefined) {
    assertPlainObject(input.sideEffects, 'REPLAY_RESULT_SIDE_EFFECTS_INVALID', 'sideEffects must be an object');
    for (const [k, v] of Object.entries(input.sideEffects)) {
      if (!Object.prototype.hasOwnProperty.call(ZERO_REPLAY_RESULT_SIDE_EFFECTS, k)) {
        fail('REPLAY_RESULT_SIDE_EFFECTS_UNKNOWN_FIELD', `Unknown sideEffects.${k}`);
      }
      if (v !== 0) {
        fail('REPLAY_RESULT_SIDE_EFFECTS_NONZERO', `sideEffects.${k} must be 0`);
      }
    }
  }

  const provenanceDefaults = {
    writer: 'artemisReplayResultContract',
    methodKey: REPLAY_RESULT_METHOD_KEY,
    stage: 'ARTEMIS_CORE_STAGE_9',
    recordedAt: input.recordedAt,
    policyVersion: REPLAY_RESULT_POLICY_VERSION,
    implementationVersion,
    resultClassification: input.resultClassification,
    modelVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
    configurationVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
  };
  const provenance = normalizeProvenance(input.provenance, provenanceDefaults);

  const limitations = normalizeLimitations(input.limitations);

  const thinSourceReplayRef = {
    replayId: sourceRef.replayId,
    contractVersion: sourceRef.contractVersion,
    replayMode: sourceRef.replayMode,
    historicalCutoffAt: sourceRef.historicalCutoffAt,
  };
  if (sourceRef.recordedAt !== undefined) {
    thinSourceReplayRef.recordedAt = sourceRef.recordedAt;
  }
  if (sourceRef.lineageId !== undefined) {
    thinSourceReplayRef.lineageId = sourceRef.lineageId;
  }

  const computedReplayResultId = computeReplayResultId({
    sourceReplayId: thinSourceReplayRef.replayId,
    resultClassification: input.resultClassification,
    historicalCutoffAt: thinSourceReplayRef.historicalCutoffAt,
    lineageId: thinSourceReplayRef.lineageId,
    implementationVersion,
  });

  if (input.replayResultId !== undefined) {
    assertUuid(input.replayResultId, 'REPLAY_RESULT_ID_INVALID', 'replayResultId');
    if (input.replayResultId !== computedReplayResultId) {
      fail(
        'REPLAY_RESULT_ID_CONFLICT',
        'Caller-supplied replayResultId does not match computed deterministic identity'
      );
    }
  }

  const artifact = {
    schemaVersion: REPLAY_RESULT_SCHEMA_VERSION,
    contractVersion: REPLAY_RESULT_CONTRACT_VERSION,
    policyVersion: REPLAY_RESULT_POLICY_VERSION,
    artifactType: REPLAY_RESULT_ARTIFACT_TYPE,
    authorityClass: REPLAY_RESULT_AUTHORITY_CLASS,
    sliceId: REPLAY_RESULT_SLICE_ID,
    replayResultId: computedReplayResultId,
    recordedAt: input.recordedAt,
    resultClassification: input.resultClassification,
    sourceReplayRef: thinSourceReplayRef,
    versions: {
      replayResultContractVersion: REPLAY_RESULT_CONTRACT_VERSION,
      replayContractVersion: thinSourceReplayRef.contractVersion,
      policyVersion: REPLAY_RESULT_POLICY_VERSION,
      implementationVersion,
      modelVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
      configurationVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
      policyVersionCanonicalStatus: CANONICAL_WHERE_UPSTREAM_SUPPORTS,
      implementationVersionCanonicalStatus: CANONICAL_WHERE_UPSTREAM_SUPPORTS,
    },
    provenance,
    limitations,
    sideEffects: { ...ZERO_REPLAY_RESULT_SIDE_EFFECTS },
    ownershipRole: REPLAY_RESULT_OWNERSHIP_ROLE,
    isSourceOfTruth: false,
    implementationVersion,
    ...REQUIRED_HARD_FLAGS,
  };

  const bytes = utf8ByteLength(JSON.stringify(artifact));
  if (bytes > MAX_REPLAY_RESULT_UTF8_BYTES) {
    fail(
      'REPLAY_RESULT_ARTIFACT_TOO_LARGE',
      `Replay Result artifact exceeds ${MAX_REPLAY_RESULT_UTF8_BYTES} bytes`,
      { bytes }
    );
  }

  return freezeDeep(artifact);
}

/** Alias — validate === build (fail-closed). */
export function validateArtemisReplayResult(input) {
  return buildArtemisReplayResult(input);
}

export default {
  REPLAY_RESULT_SCHEMA_VERSION,
  REPLAY_RESULT_CONTRACT_VERSION,
  REPLAY_RESULT_POLICY_VERSION,
  REPLAY_RESULT_ARTIFACT_TYPE,
  REPLAY_RESULT_AUTHORITY_CLASS,
  REPLAY_RESULT_SLICE_ID,
  REPLAY_RESULT_METHOD_KEY,
  REPLAY_RESULT_OWNERSHIP_ROLE,
  REPLAY_RESULT_IS_SOURCE_OF_TRUTH,
  REPLAY_RESULT_CLASSIFICATION,
  REPLAY_RESULT_CLASSIFICATION_SET,
  UPSTREAM_METADATA_UNAVAILABLE,
  CANONICAL_WHERE_UPSTREAM_SUPPORTS,
  MAX_REPLAY_RESULT_UTF8_BYTES,
  ZERO_REPLAY_RESULT_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS,
  FORBIDDEN_REPLAY_RESULT_KEYS,
  hashToUuid,
  computeReplayResultId,
  extractSourceReplayRef,
  buildArtemisReplayResult,
  validateArtemisReplayResult,
};
