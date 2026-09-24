/**
 * Artemis Core Stage 10 — S10-CONFIDENCE-CALIBRATION-CONTRACT
 * ARTEMIS_CONFIDENCE_CALIBRATION_CONTRACT_BOUNDARY
 *
 * Deterministic, non-executing, library-only Confidence Calibration semantic /
 * validation boundary. Produces a thin ARTEMIS_CONFIDENCE_CALIBRATION_OBSERVATION
 * envelope that binds a Decision-level predictive confidence claim to an
 * explicit Observed Outcome Evaluation truth. Does NOT calculate calibration
 * metrics, transform confidence, mutate trust/weights, or promote/demote.
 *
 * Authority: CALIBRATION · Tier 3 · isSourceOfTruth = false
 *
 * Predictive claim source policy (v1):
 *   DECISION_LEVEL_CALIBRATION = SUPPORTED
 *   EVIDENCE_LEVEL_CALIBRATION = DEFERRED_BY_MISSING_CANONICAL_BINDING
 *
 * CALIBRATION_METRIC_CANONICAL_STATUS = UNDEFINED
 * METRIC_INVENTION = FORBIDDEN
 */

import {
  CONFIDENCE_KIND,
  CONFIDENCE_SCALE,
  CALIBRATION_STATE,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
  collectForbiddenSecretKeys,
} from './artemisEvidenceContract.js';
import {
  DECISION_CONTRACT_VERSION,
  DECISION_SCHEMA_VERSION,
  DIRECTION_OR_ABSTAIN,
  validateArtemisDecision,
} from './artemisDecisionContract.js';
import {
  EVALUATION_STATUS,
  OBSERVATION_CLASS,
  EVALUATION_METHOD_KEY,
  OBSERVED_OUTCOME_EVALUATION_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
  OBSERVED_OUTCOME_EVALUATION_SCHEMA_VERSION,
  OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION,
  OBSERVED_OUTCOME_EVALUATION_SLICE_ID,
  OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH,
  OBSERVED_OUTCOME_EVALUATION_IMPLEMENTATION_VERSION,
  REQUIRED_HARD_FLAGS as EVALUATION_REQUIRED_HARD_FLAGS,
  ZERO_EVALUATION_SIDE_EFFECTS,
} from './artemisObservedOutcomeEvaluationContract.js';
import { OBSERVED_OUTCOME_CONTRACT_VERSION } from './artemisObservedOutcomeContract.js';
import { hashToUuid } from './artemisReplayContract.js';

export const CONFIDENCE_CALIBRATION_SCHEMA_VERSION = '1.0.0';
export const CONFIDENCE_CALIBRATION_CONTRACT_VERSION =
  'artemis-confidence-calibration-1.0.0';
export const CONFIDENCE_CALIBRATION_POLICY_VERSION =
  'stage10-confidence-calibration-contract-1.0.0';
export const CONFIDENCE_CALIBRATION_ARTIFACT_TYPE =
  'ARTEMIS_CONFIDENCE_CALIBRATION_OBSERVATION';
export const CONFIDENCE_CALIBRATION_AUTHORITY_CLASS = 'CALIBRATION';
export const CONFIDENCE_CALIBRATION_SLICE_ID =
  'S10-CONFIDENCE-CALIBRATION-CONTRACT';
export const CONFIDENCE_CALIBRATION_METHOD_KEY =
  'artemis.confidence.calibration.observation.v1';
export const CONFIDENCE_CALIBRATION_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const CONFIDENCE_CALIBRATION_IS_SOURCE_OF_TRUTH = false;
export const CONFIDENCE_CALIBRATION_IMPLEMENTATION_VERSION = '1.0.0';
export const CONFIDENCE_CALIBRATION_WRITER =
  'artemisConfidenceCalibrationContract';
export const CONFIDENCE_CALIBRATION_STAGE =
  'ARTEMIS_CORE_STAGE_10_CONFIDENCE_CALIBRATION_CONTRACT_BOUNDARY';

/** Metric vocabulary is intentionally undefined — do not invent Brier/ECE/etc. */
export const CALIBRATION_METRIC_CANONICAL_STATUS = 'UNDEFINED';
export const METRIC_INVENTION = 'FORBIDDEN';

/**
 * Decision-level predictive claims are supported.
 * Evidence-level deferred: no safe Evidence→Decision→Outcome binding proven.
 */
export const DECISION_LEVEL_CALIBRATION = 'SUPPORTED';
export const EVIDENCE_LEVEL_CALIBRATION =
  'DEFERRED_BY_MISSING_CANONICAL_BINDING';
export const PREDICTIVE_CLAIM_SOURCE_POLICY = Object.freeze({
  decisionLevel: DECISION_LEVEL_CALIBRATION,
  evidenceLevel: EVIDENCE_LEVEL_CALIBRATION,
});

/** Repository-evidenced predictive confidence kinds only. */
export const PREDICTIVE_CONFIDENCE_KINDS = Object.freeze({
  MODEL_PROBABILITY: CONFIDENCE_KIND.MODEL_PROBABILITY,
  CALIBRATED: CONFIDENCE_KIND.CALIBRATED,
});
export const PREDICTIVE_CONFIDENCE_KIND_SET = Object.freeze(
  new Set(Object.values(PREDICTIVE_CONFIDENCE_KINDS)),
);

/** Directions that can participate in directional calibration truth. */
export const CALIBRABLE_DIRECTIONS = Object.freeze({
  BULLISH: DIRECTION_OR_ABSTAIN.BULLISH,
  BEARISH: DIRECTION_OR_ABSTAIN.BEARISH,
  SIDEWAYS: DIRECTION_OR_ABSTAIN.SIDEWAYS,
  NEUTRAL: DIRECTION_OR_ABSTAIN.NEUTRAL,
});
export const CALIBRABLE_DIRECTION_SET = Object.freeze(
  new Set(Object.values(CALIBRABLE_DIRECTIONS)),
);

export const USABLE_EVALUATION_STATUS = Object.freeze({
  MATCH: EVALUATION_STATUS.MATCH,
  MISMATCH: EVALUATION_STATUS.MISMATCH,
});
export const USABLE_EVALUATION_STATUS_SET = Object.freeze(
  new Set(Object.values(USABLE_EVALUATION_STATUS)),
);

export const MAX_CALIBRATION_OBSERVATION_UTF8_BYTES = 16 * 1024;
export const MAX_PROVENANCE_KEYS = 24;
export const MAX_LIMITATIONS = 32;
export const MAX_LIMITATION_CHARS = 512;
export const MAX_STRING = 256;
export const MAX_NOTE_CHARS = 2048;

export const ZERO_CONFIDENCE_CALIBRATION_SIDE_EFFECTS = Object.freeze({
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
  calibrationExecutionCount: 0,
  trustWeightMutationCount: 0,
  promotionExecutionCount: 0,
  demotionExecutionCount: 0,
  calibrationExecution: 0,
  trustWeightMutation: 0,
  promotionExecution: 0,
  demotionExecution: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  liveTradingEnabled: false,
  paperTradingEnabled: false,
  providerConnected: false,
  persistenceEnabled: false,
  runtimeActivated: false,
  workerActivated: false,
  schedulerActivated: false,
  calibrationExecutionAuthorized: false,
  trustWeightMutationAuthorized: false,
  promotionExecutionAuthorized: false,
  demotionExecutionAuthorized: false,
});

export const CONFIDENCE_CALIBRATION_LIMITATIONS = Object.freeze([
  'stage10_confidence_calibration_contract_boundary_only',
  'library_only',
  'deterministic_non_executing',
  'validation_boundary_not_sot',
  'is_source_of_truth_false',
  'metric_agnostic',
  'calibration_metric_canonical_status_undefined',
  'metric_invention_forbidden',
  'no_calibration_execution',
  'no_confidence_transform',
  'no_trust_weight_mutation',
  'no_promotion_execution',
  'no_demotion_execution',
  'decision_level_only',
  'evidence_level_deferred_by_missing_canonical_binding',
  'empty_match_not_calibratable',
  'explicit_comparison_claims_required',
  'thin_refs_only',
  'anti_lookahead',
  'temporal_integrity_required',
  'does_not_write_db_or_redis',
  'does_not_call_llm_or_provider',
  'does_not_activate_worker_or_scheduler',
  'does_not_authorize_execution',
]);

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));
const EVALUATION_HARD_FLAG_KEYS = Object.freeze(
  Object.keys(EVALUATION_REQUIRED_HARD_FLAGS),
);
const EVALUATION_SIDE_EFFECT_KEYS = Object.freeze(
  Object.keys(ZERO_EVALUATION_SIDE_EFFECTS),
);
const EVALUATION_STATUS_SET = Object.freeze(
  new Set(Object.values(EVALUATION_STATUS)),
);
const OBSERVATION_CLASS_SET = Object.freeze(
  new Set(Object.values(OBSERVATION_CLASS)),
);
const METHOD_KEY_SET = Object.freeze(
  new Set(Object.values(EVALUATION_METHOD_KEY)),
);
const DIRECTION_SET = Object.freeze(
  new Set(Object.values(DIRECTION_OR_ABSTAIN)),
);
const CONFIDENCE_SCALE_SET = Object.freeze(
  new Set(Object.values(CONFIDENCE_SCALE)),
);
const CALIBRATION_STATE_SET = Object.freeze(
  new Set(Object.values(CALIBRATION_STATE)),
);

const TOP_LEVEL_ALLOWLIST = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'authorityClass',
  'sliceId',
  'calibrationObservationId',
  'recordedAt',
  'predictiveClaimRef',
  'observedTruthRef',
  'versions',
  'provenance',
  'limitations',
  'sideEffects',
  'ownershipRole',
  'isSourceOfTruth',
  'implementationVersion',
  'predictiveClaimSourcePolicy',
  'calibrationMetricCanonicalStatus',
  'metricInvention',
  ...HARD_FLAG_KEYS,
]);

const INPUT_TOP_ALLOWLIST = Object.freeze([
  'decision',
  'sourceDecision',
  'evaluationArtifact',
  'recordedAt',
  'calibrationObservationId',
  'limitations',
  'provenance',
  'implementationVersion',
  'policyVersion',
  ...HARD_FLAG_KEYS,
]);

const PREDICTIVE_CLAIM_REF_ALLOWLIST = Object.freeze([
  'decisionId',
  'contractVersion',
  'direction',
  'analysisAt',
  'createdAt',
  'symbol',
  'venue',
  'marketType',
  'timeframe',
  'analysisHorizon',
  'confidence',
  'policyVersion',
  'implementationVersion',
]);

const PREDICTIVE_CONFIDENCE_ALLOWLIST = Object.freeze([
  'availability',
  'kind',
  'value',
  'scale',
  'calibrationState',
  'provenance',
]);

const PREDICTIVE_CONFIDENCE_PROVENANCE_ALLOWLIST = Object.freeze([
  'writer',
  'path',
  'methodKey',
]);

const OBSERVED_TRUTH_REF_ALLOWLIST = Object.freeze([
  'evaluationId',
  'contractVersion',
  'evaluationStatus',
  'observationClass',
  'decisionId',
  'outcomeId',
  'recordedAt',
  'decisionDirection',
  'observedDirection',
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'sourceTimestamp',
]);

const VERSIONS_ALLOWLIST = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
  'decisionContractVersion',
  'evaluationContractVersion',
]);

const PROVENANCE_ALLOWLIST = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'policyVersion',
  'implementationVersion',
  'note',
]);

/** Evaluation built-artifact Option B allowlists (mirror Evaluation contract). */
const EVAL_ARTIFACT_TOP_ALLOWLIST = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'authorityClass',
  'sliceId',
  'evaluationId',
  'evaluationStatus',
  'observationClass',
  'recordedAt',
  'decisionRef',
  'decisionContextRef',
  'shadowRecordingRef',
  'taskRef',
  'bindingRef',
  'outcomeRef',
  'marketContextRef',
  'outcomeSotRef',
  'evaluationMethod',
  'comparisonClaims',
  'lineage',
  'provenance',
  'limitations',
  'sideEffects',
  'ownershipRole',
  'isSourceOfTruth',
  'implementationVersion',
  'realizedPnlStatus',
  'blockedReason',
  ...EVALUATION_HARD_FLAG_KEYS,
]);

const EVAL_DECISION_REF_ALLOWLIST = Object.freeze([
  'decisionId',
  'contractVersion',
]);
const EVAL_CONTEXT_REF_ALLOWLIST = Object.freeze([
  'contextId',
  'contractVersion',
]);
const EVAL_SHADOW_RECORDING_REF_ALLOWLIST = Object.freeze([
  'shadowRecordingArtifactId',
  'contractVersion',
]);
const EVAL_TASK_REF_ALLOWLIST = Object.freeze([
  'taskId',
  'contractVersion',
  'attempt',
]);
const EVAL_BINDING_REF_ALLOWLIST = Object.freeze([
  'bindingId',
  'contractVersion',
]);
const EVAL_OUTCOME_REF_ALLOWLIST = Object.freeze([
  'outcomeId',
  'contractVersion',
]);
const EVAL_MARKET_CONTEXT_REF_ALLOWLIST = Object.freeze([
  'marketContextId',
  'contractVersion',
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'sourceTimestamp',
]);
const EVAL_OUTCOME_SOT_REF_ALLOWLIST = Object.freeze([
  'outcomeId',
  'contractVersion',
]);
const EVAL_METHOD_ALLOWLIST = Object.freeze([
  'methodKey',
  'implementationVersion',
]);
const EVAL_COMPARISON_CLAIMS_ALLOWLIST = Object.freeze([
  'decisionDirection',
  'observedDirection',
]);
const EVAL_LINEAGE_ALLOWLIST = Object.freeze([
  'decisionId',
  'outcomeId',
  'contextId',
  'shadowRecordingArtifactId',
  'taskId',
  'bindingId',
  'marketContextId',
  'decisionContractVersion',
  'decisionContextContractVersion',
  'shadowRecordingContractVersion',
  'observedOutcomeContractVersion',
  'observedOutcomeSotContractVersion',
  'shadowTaskStateContractVersion',
  'shadowTaskCycleBindingContractVersion',
  'marketContextContractVersion',
  'evaluationContractVersion',
]);
const EVAL_PROVENANCE_ALLOWLIST = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'policyVersion',
  'implementationVersion',
  'decisionProvenance',
  'outcomeProvenance',
  'note',
]);

const FORBIDDEN_KEYS = Object.freeze([
  // Metric invention / calibration scores
  'calibrationScore',
  'calibrationError',
  'brierScore',
  'brier',
  'ece',
  'expectedCalibrationError',
  'logLoss',
  'reliabilityScore',
  'reliabilityCurve',
  'reliabilityError',
  'platt',
  'isotonic',
  'temperatureScaling',
  'bucketAccuracy',
  'observedFrequency',
  'expectedFrequency',
  'binCount',
  'bucketCounts',
  'confidenceBucket',
  // Confidence transforms
  'correctedConfidence',
  'adjustedConfidence',
  'adjustedProbability',
  'calibratedConfidence',
  'newConfidence',
  'probabilityAdjustment',
  'confidenceDelta',
  // Trust / promotion / demotion
  'trustScore',
  'agentWeight',
  'weight',
  'weightDelta',
  'reputation',
  'promotion',
  'promotionScore',
  'promotionGate',
  'promote',
  'demote',
  'demotionScore',
  'threshold',
  'promotionThreshold',
  'demotionThreshold',
  // Lookahead / contamination
  'lookahead',
  'lookAhead',
  'futureData',
  'futureEvidence',
  'futureMarketData',
  'postDecisionEvidenceAsInput',
  'outcomeAsDecisionInput',
  'evaluationAsDecisionInput',
  'currentDataAsHistorical',
  // Financial / execution
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
  'fill',
  'fillPrice',
  'pnl',
  'realizedPnl',
  'simulatedPnl',
  'ROI',
  'roi',
  'profit',
  'return',
  'financialResult',
  // Raw market / provider
  'ohlcv',
  'candles',
  'ticker',
  'orderBook',
  'depth',
  'providerPayload',
  'exchangeResponse',
  'rawSeries',
  'rawMarketData',
  'marketSnapshot',
]);

function fail(code, message, extra = {}) {
  const err = new Error(message || code);
  // Assign extras first, then pin `code` so upstream codes cannot overwrite.
  Object.assign(err, extra);
  err.code = code;
  throw err;
}

function freezeDeep(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
}

function assertPlainObject(value, code, message) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, message);
  }
}

function assertAllowlist(obj, allowed, codePrefix) {
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
  const unknown = Object.keys(obj).filter((k) => !allowedSet.has(k));
  if (unknown.length) {
    fail(`${codePrefix}_UNKNOWN_FIELD`, `Unknown field(s): ${unknown.join(',')}`, {
      unknownFields: unknown,
    });
  }
}

function assertUuid(field, value, code) {
  if (!isCanonicalUuid(value)) {
    fail(code, `${field} must be a canonical UUID`, { field, value });
  }
}

function assertIso(field, value, code) {
  if (!isIsoTimestamp(value)) {
    fail(code, `${field} must be a canonical ISO-8601 timestamp`, { field, value });
  }
}

function assertString(field, value, code, { max = MAX_STRING, required = true } = {}) {
  if (value == null || value === '') {
    if (required) fail(code, `${field} required string`, { field });
    return;
  }
  if (typeof value !== 'string') {
    fail(code, `${field} must be a string`, { field });
  }
  if (value.length > max) {
    fail(code, `${field} exceeds max length`, { field, max });
  }
}

/**
 * Deep-scan for forbidden contamination keys.
 *
 * Special cases (Replay Result precedent):
 * - `decision` / `sourceDecision` / `evaluationArtifact` are NOT walked on the
 *   top-level input; they are validated separately (Decision validator + Option B
 *   Evaluation allowlists) so zero-count sideEffects ledgers like `orders: 0`
 *   do not false-positive.
 * - Nested `sideEffects` numeric counter leaves with forbidden-looking names
 *   (`orders`, `wallet`, …) are allowed; object/array values under those names
 *   fail closed.
 */
function collectForbiddenKeysDeep(value, found = new Set(), path = '', { skipUpstreamRefs = false } = {}) {
  if (value == null || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      collectForbiddenKeysDeep(item, found, `${path}[${i}]`, { skipUpstreamRefs: false });
    });
    return found;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (
      skipUpstreamRefs
      && (key === 'decision' || key === 'sourceDecision' || key === 'evaluationArtifact')
    ) {
      continue;
    }
    if (key === 'sideEffects' && nested && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const [seKey, seVal] of Object.entries(nested)) {
        if (typeof seVal === 'number') continue;
        if (FORBIDDEN_KEYS.includes(seKey)) {
          found.add(path ? `${path}.sideEffects.${seKey}` : `sideEffects.${seKey}`);
        }
        if (seVal && typeof seVal === 'object') {
          collectForbiddenKeysDeep(seVal, found, path ? `${path}.sideEffects.${seKey}` : `sideEffects.${seKey}`);
        }
      }
      continue;
    }
    if (FORBIDDEN_KEYS.includes(key)) found.add(path ? `${path}.${key}` : key);
    collectForbiddenKeysDeep(nested, found, path ? `${path}.${key}` : key);
  }
  return found;
}

function assertNoForbiddenOrSecrets(input, { skipUpstreamRefs = false } = {}) {
  const forbidden = [...collectForbiddenKeysDeep(input, new Set(), '', { skipUpstreamRefs })];
  if (forbidden.length) {
    fail('CALIBRATION_FORBIDDEN_FIELD', 'Forbidden calibration/execution field present', {
      forbiddenFields: forbidden,
    });
  }
  const secrets = collectForbiddenSecretKeys(input);
  if (secrets.length) {
    fail('CALIBRATION_SECRET_FIELD', 'Secret-bearing field rejected', {
      secretFields: secrets,
    });
  }
}

function assertHardFlags(input) {
  for (const key of HARD_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== false) {
      fail('CALIBRATION_AUTHORITY_FLAG_INVALID', `Hard flag ${key} must be false`, {
        key,
      });
    }
  }
}

function normalizeLimitations(inputLimitations) {
  const base = [...CONFIDENCE_CALIBRATION_LIMITATIONS];
  if (inputLimitations == null) return freezeDeep(base);
  if (!Array.isArray(inputLimitations)) {
    fail('CALIBRATION_LIMITATIONS_INVALID', 'limitations must be an array');
  }
  if (inputLimitations.length > MAX_LIMITATIONS) {
    fail('CALIBRATION_LIMITATIONS_TOO_MANY', 'Too many limitations', {
      max: MAX_LIMITATIONS,
    });
  }
  const out = [...base];
  for (const item of inputLimitations) {
    if (typeof item !== 'string' || !item || item.length > MAX_LIMITATION_CHARS) {
      fail('CALIBRATION_LIMITATION_INVALID', 'Invalid limitation entry');
    }
    if (!out.includes(item)) out.push(item);
  }
  return freezeDeep(out);
}

function normalizeProvenance(inputProvenance, recordedAt, policyVersion, implementationVersion) {
  const defaults = {
    writer: CONFIDENCE_CALIBRATION_WRITER,
    methodKey: CONFIDENCE_CALIBRATION_METHOD_KEY,
    stage: CONFIDENCE_CALIBRATION_STAGE,
    recordedAt,
    policyVersion,
    implementationVersion,
  };
  if (inputProvenance == null) return freezeDeep(defaults);
  assertPlainObject(
    inputProvenance,
    'CALIBRATION_PROVENANCE_INVALID',
    'provenance must be an object',
  );
  assertAllowlist(inputProvenance, PROVENANCE_ALLOWLIST, 'CALIBRATION_PROVENANCE');
  if (Object.keys(inputProvenance).length > MAX_PROVENANCE_KEYS) {
    fail('CALIBRATION_PROVENANCE_TOO_MANY_KEYS', 'provenance exceeds key bound');
  }
  const merged = { ...defaults, ...inputProvenance };
  if (merged.writer !== CONFIDENCE_CALIBRATION_WRITER) {
    fail('CALIBRATION_PROVENANCE_WRITER_MISMATCH', 'provenance.writer mismatch');
  }
  if (merged.methodKey !== CONFIDENCE_CALIBRATION_METHOD_KEY) {
    fail('CALIBRATION_PROVENANCE_METHOD_MISMATCH', 'provenance.methodKey mismatch');
  }
  if (merged.stage !== CONFIDENCE_CALIBRATION_STAGE) {
    fail('CALIBRATION_PROVENANCE_STAGE_MISMATCH', 'provenance.stage mismatch');
  }
  if (merged.recordedAt !== recordedAt) {
    fail('CALIBRATION_PROVENANCE_RECORDED_AT_MISMATCH', 'provenance.recordedAt mismatch');
  }
  if (merged.policyVersion !== policyVersion) {
    fail('CALIBRATION_PROVENANCE_POLICY_MISMATCH', 'provenance.policyVersion mismatch');
  }
  if (merged.implementationVersion !== implementationVersion) {
    fail(
      'CALIBRATION_PROVENANCE_IMPLEMENTATION_MISMATCH',
      'provenance.implementationVersion mismatch',
    );
  }
  if (merged.note != null) {
    assertString('provenance.note', merged.note, 'CALIBRATION_PROVENANCE_NOTE_INVALID', {
      max: MAX_NOTE_CHARS,
    });
  }
  return freezeDeep(merged);
}

/**
 * Extract and validate a Decision-level predictive confidence claim.
 * Requires availability=available and kind ∈ {MODEL_PROBABILITY, CALIBRATED}.
 * Preserves value/scale exactly — no conversion, clamp, or round.
 */
function extractPredictiveConfidence(confidence) {
  assertPlainObject(
    confidence,
    'CALIBRATION_CONFIDENCE_REQUIRED',
    'decision.confidence required',
  );
  if (confidence.availability !== 'available') {
    fail(
      'CALIBRATION_CONFIDENCE_UNAVAILABLE',
      'Predictive confidence availability must be available',
      { availability: confidence.availability },
    );
  }
  if (!PREDICTIVE_CONFIDENCE_KIND_SET.has(confidence.kind)) {
    fail(
      'CALIBRATION_CONFIDENCE_KIND_NOT_PREDICTIVE',
      'Confidence kind is not a repository-evidenced predictive kind',
      { kind: confidence.kind },
    );
  }
  if (confidence.scale === CONFIDENCE_SCALE.UNKNOWN || confidence.scale == null) {
    fail(
      'CALIBRATION_CONFIDENCE_SCALE_UNKNOWN',
      'Predictive confidence scale must not be unknown',
      { scale: confidence.scale },
    );
  }
  if (
    confidence.scale !== CONFIDENCE_SCALE.UNIT_INTERVAL
    && confidence.scale !== CONFIDENCE_SCALE.PERCENT_100
  ) {
    fail(
      'CALIBRATION_CONFIDENCE_SCALE_INVALID',
      'Confidence scale must be unit_interval or percent_100',
      { scale: confidence.scale },
    );
  }
  if (typeof confidence.value !== 'number' || !Number.isFinite(confidence.value)) {
    fail(
      'CALIBRATION_CONFIDENCE_VALUE_INVALID',
      'Predictive confidence value must be a finite number',
    );
  }
  if (confidence.scale === CONFIDENCE_SCALE.UNIT_INTERVAL) {
    if (confidence.value < 0 || confidence.value > 1) {
      fail(
        'CALIBRATION_CONFIDENCE_UNIT_INTERVAL_OUT_OF_RANGE',
        'unit_interval confidence must be in [0,1]',
        { value: confidence.value },
      );
    }
  }
  if (confidence.scale === CONFIDENCE_SCALE.PERCENT_100) {
    if (confidence.value < 0 || confidence.value > 100) {
      fail(
        'CALIBRATION_CONFIDENCE_PERCENT_OUT_OF_RANGE',
        'percent_100 confidence must be in [0,100]',
        { value: confidence.value },
      );
    }
  }
  if (
    confidence.calibrationState != null
    && !CALIBRATION_STATE_SET.has(confidence.calibrationState)
  ) {
    fail(
      'CALIBRATION_CONFIDENCE_CALIBRATION_STATE_INVALID',
      'Invalid calibrationState',
      { calibrationState: confidence.calibrationState },
    );
  }

  const thin = {
    availability: 'available',
    kind: confidence.kind,
    value: confidence.value,
    scale: confidence.scale,
  };
  if (confidence.calibrationState != null) {
    thin.calibrationState = confidence.calibrationState;
  }
  if (confidence.provenance != null) {
    assertPlainObject(
      confidence.provenance,
      'CALIBRATION_CONFIDENCE_PROVENANCE_INVALID',
      'confidence.provenance must be an object',
    );
    assertAllowlist(
      confidence.provenance,
      PREDICTIVE_CONFIDENCE_PROVENANCE_ALLOWLIST,
      'CALIBRATION_CONFIDENCE_PROVENANCE',
    );
    const p = {};
    if (confidence.provenance.writer != null) p.writer = confidence.provenance.writer;
    if (confidence.provenance.path != null) p.path = confidence.provenance.path;
    if (confidence.provenance.methodKey != null) {
      p.methodKey = confidence.provenance.methodKey;
    }
    if (Object.keys(p).length) thin.provenance = p;
  }
  return thin;
}

function extractPredictiveClaimRef(decision) {
  if (!CALIBRABLE_DIRECTION_SET.has(decision.direction)) {
    fail(
      'CALIBRATION_DIRECTION_NOT_CALIBRABLE',
      'Decision direction must be bullish|bearish|sideways|neutral',
      { direction: decision.direction },
    );
  }
  const confidence = extractPredictiveConfidence(decision.confidence);
  const ref = {
    decisionId: decision.decisionId,
    contractVersion: decision.contractVersion,
    direction: decision.direction,
    analysisAt: decision.analysisAt,
    confidence,
  };
  if (decision.createdAt != null) ref.createdAt = decision.createdAt;
  if (decision.symbol != null) ref.symbol = decision.symbol;
  if (decision.venue != null) ref.venue = decision.venue;
  if (decision.marketType != null) ref.marketType = decision.marketType;
  if (decision.timeframe != null) ref.timeframe = decision.timeframe;
  if (decision.analysisHorizon != null) ref.analysisHorizon = decision.analysisHorizon;
  if (decision.policyVersion != null) ref.policyVersion = decision.policyVersion;
  if (decision.implementationVersion != null) {
    ref.implementationVersion = decision.implementationVersion;
  }
  assertAllowlist(ref, PREDICTIVE_CLAIM_REF_ALLOWLIST, 'CALIBRATION_PREDICTIVE_CLAIM_REF');
  assertAllowlist(
    ref.confidence,
    PREDICTIVE_CONFIDENCE_ALLOWLIST,
    'CALIBRATION_PREDICTIVE_CONFIDENCE',
  );
  return ref;
}

function assertOptionalUuidRef(obj, idField, codePrefix) {
  if (obj == null) return;
  assertPlainObject(obj, `${codePrefix}_INVALID`, `${codePrefix} must be an object`);
}

/**
 * Option B: strict-validate a built Observed Outcome Evaluation artifact
 * against exported Evaluation constants and reimplemented allowlists.
 * Does NOT call validateObservedOutcomeEvaluation (builder-input API).
 */
function validateBuiltEvaluationArtifact(evaluation) {
  assertPlainObject(
    evaluation,
    'CALIBRATION_EVALUATION_REQUIRED',
    'evaluationArtifact required',
  );
  assertAllowlist(evaluation, EVAL_ARTIFACT_TOP_ALLOWLIST, 'CALIBRATION_EVALUATION');

  if (evaluation.schemaVersion !== OBSERVED_OUTCOME_EVALUATION_SCHEMA_VERSION) {
    fail(
      'CALIBRATION_EVALUATION_SCHEMA_VERSION_MISMATCH',
      'evaluation schemaVersion mismatch',
    );
  }
  if (evaluation.contractVersion !== OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION) {
    fail(
      'CALIBRATION_EVALUATION_CONTRACT_VERSION_MISMATCH',
      'evaluation contractVersion mismatch',
    );
  }
  if (evaluation.policyVersion !== OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION) {
    fail(
      'CALIBRATION_EVALUATION_POLICY_VERSION_MISMATCH',
      'evaluation policyVersion mismatch',
    );
  }
  if (evaluation.artifactType !== OBSERVED_OUTCOME_EVALUATION_ARTIFACT_TYPE) {
    fail(
      'CALIBRATION_EVALUATION_ARTIFACT_TYPE_MISMATCH',
      'evaluation artifactType mismatch',
    );
  }
  if (evaluation.authorityClass !== OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS) {
    fail(
      'CALIBRATION_EVALUATION_AUTHORITY_CLASS_MISMATCH',
      'evaluation authorityClass mismatch',
    );
  }
  if (evaluation.sliceId !== OBSERVED_OUTCOME_EVALUATION_SLICE_ID) {
    fail('CALIBRATION_EVALUATION_SLICE_ID_MISMATCH', 'evaluation sliceId mismatch');
  }
  if (evaluation.ownershipRole !== OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE) {
    fail(
      'CALIBRATION_EVALUATION_OWNERSHIP_ROLE_MISMATCH',
      'evaluation ownershipRole mismatch',
    );
  }
  if (evaluation.isSourceOfTruth !== OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH) {
    fail(
      'CALIBRATION_EVALUATION_IS_SOURCE_OF_TRUTH_INVALID',
      'evaluation isSourceOfTruth must be false',
    );
  }
  assertUuid(
    'evaluationId',
    evaluation.evaluationId,
    'CALIBRATION_EVALUATION_ID_INVALID',
  );
  assertIso(
    'evaluation.recordedAt',
    evaluation.recordedAt,
    'CALIBRATION_EVALUATION_RECORDED_AT_INVALID',
  );

  if (!EVALUATION_STATUS_SET.has(evaluation.evaluationStatus)) {
    fail(
      'CALIBRATION_EVALUATION_STATUS_INVALID',
      'Invalid evaluationStatus',
      { evaluationStatus: evaluation.evaluationStatus },
    );
  }
  if (!OBSERVATION_CLASS_SET.has(evaluation.observationClass)) {
    fail(
      'CALIBRATION_OBSERVATION_CLASS_INVALID',
      'Invalid observationClass',
      { observationClass: evaluation.observationClass },
    );
  }

  assertPlainObject(
    evaluation.decisionRef,
    'CALIBRATION_EVALUATION_DECISION_REF_REQUIRED',
    'evaluation.decisionRef required',
  );
  assertAllowlist(
    evaluation.decisionRef,
    EVAL_DECISION_REF_ALLOWLIST,
    'CALIBRATION_EVALUATION_DECISION_REF',
  );
  assertUuid(
    'decisionRef.decisionId',
    evaluation.decisionRef.decisionId,
    'CALIBRATION_EVALUATION_DECISION_ID_INVALID',
  );
  assertString(
    'decisionRef.contractVersion',
    evaluation.decisionRef.contractVersion,
    'CALIBRATION_EVALUATION_DECISION_CONTRACT_VERSION_INVALID',
  );
  if (evaluation.decisionRef.contractVersion !== DECISION_CONTRACT_VERSION) {
    fail(
      'CALIBRATION_EVALUATION_DECISION_CONTRACT_VERSION_MISMATCH',
      'evaluation decisionRef.contractVersion mismatch',
      {
        expected: DECISION_CONTRACT_VERSION,
        provided: evaluation.decisionRef.contractVersion,
      },
    );
  }

  assertPlainObject(
    evaluation.outcomeRef,
    'CALIBRATION_EVALUATION_OUTCOME_REF_REQUIRED',
    'evaluation.outcomeRef required',
  );
  assertAllowlist(
    evaluation.outcomeRef,
    EVAL_OUTCOME_REF_ALLOWLIST,
    'CALIBRATION_EVALUATION_OUTCOME_REF',
  );
  assertUuid(
    'outcomeRef.outcomeId',
    evaluation.outcomeRef.outcomeId,
    'CALIBRATION_EVALUATION_OUTCOME_ID_INVALID',
  );
  assertString(
    'outcomeRef.contractVersion',
    evaluation.outcomeRef.contractVersion,
    'CALIBRATION_EVALUATION_OUTCOME_CONTRACT_VERSION_INVALID',
  );
  if (evaluation.outcomeRef.contractVersion !== OBSERVED_OUTCOME_CONTRACT_VERSION) {
    fail(
      'CALIBRATION_EVALUATION_OUTCOME_CONTRACT_VERSION_MISMATCH',
      'evaluation outcomeRef.contractVersion mismatch',
      {
        expected: OBSERVED_OUTCOME_CONTRACT_VERSION,
        provided: evaluation.outcomeRef.contractVersion,
      },
    );
  }

  assertPlainObject(
    evaluation.evaluationMethod,
    'CALIBRATION_EVALUATION_METHOD_REQUIRED',
    'evaluation.evaluationMethod required',
  );
  assertAllowlist(
    evaluation.evaluationMethod,
    EVAL_METHOD_ALLOWLIST,
    'CALIBRATION_EVALUATION_METHOD',
  );
  if (!METHOD_KEY_SET.has(evaluation.evaluationMethod.methodKey)) {
    fail(
      'CALIBRATION_EVALUATION_METHOD_KEY_INVALID',
      'Invalid evaluationMethod.methodKey',
    );
  }
  assertString(
    'evaluationMethod.implementationVersion',
    evaluation.evaluationMethod.implementationVersion,
    'CALIBRATION_EVALUATION_METHOD_IMPLEMENTATION_INVALID',
  );

  if (evaluation.marketContextRef != null) {
    assertAllowlist(
      evaluation.marketContextRef,
      EVAL_MARKET_CONTEXT_REF_ALLOWLIST,
      'CALIBRATION_EVALUATION_MARKET_CONTEXT_REF',
    );
    if (evaluation.marketContextRef.marketContextId != null) {
      assertUuid(
        'marketContextRef.marketContextId',
        evaluation.marketContextRef.marketContextId,
        'CALIBRATION_EVALUATION_MARKET_CONTEXT_ID_INVALID',
      );
    }
    if (evaluation.marketContextRef.sourceTimestamp != null) {
      assertIso(
        'marketContextRef.sourceTimestamp',
        evaluation.marketContextRef.sourceTimestamp,
        'CALIBRATION_EVALUATION_SOURCE_TIMESTAMP_INVALID',
      );
    }
  }

  if (evaluation.decisionContextRef != null) {
    assertAllowlist(
      evaluation.decisionContextRef,
      EVAL_CONTEXT_REF_ALLOWLIST,
      'CALIBRATION_EVALUATION_CONTEXT_REF',
    );
  }
  if (evaluation.shadowRecordingRef != null) {
    assertAllowlist(
      evaluation.shadowRecordingRef,
      EVAL_SHADOW_RECORDING_REF_ALLOWLIST,
      'CALIBRATION_EVALUATION_SHADOW_RECORDING_REF',
    );
  }
  if (evaluation.taskRef != null) {
    assertAllowlist(
      evaluation.taskRef,
      EVAL_TASK_REF_ALLOWLIST,
      'CALIBRATION_EVALUATION_TASK_REF',
    );
  }
  if (evaluation.bindingRef != null) {
    assertAllowlist(
      evaluation.bindingRef,
      EVAL_BINDING_REF_ALLOWLIST,
      'CALIBRATION_EVALUATION_BINDING_REF',
    );
  }
  if (evaluation.outcomeSotRef != null) {
    assertAllowlist(
      evaluation.outcomeSotRef,
      EVAL_OUTCOME_SOT_REF_ALLOWLIST,
      'CALIBRATION_EVALUATION_OUTCOME_SOT_REF',
    );
  }
  if (evaluation.lineage != null) {
    assertAllowlist(
      evaluation.lineage,
      EVAL_LINEAGE_ALLOWLIST,
      'CALIBRATION_EVALUATION_LINEAGE',
    );
  }
  if (evaluation.provenance != null) {
    assertAllowlist(
      evaluation.provenance,
      EVAL_PROVENANCE_ALLOWLIST,
      'CALIBRATION_EVALUATION_PROVENANCE',
    );
  }
  if (evaluation.comparisonClaims != null) {
    assertAllowlist(
      evaluation.comparisonClaims,
      EVAL_COMPARISON_CLAIMS_ALLOWLIST,
      'CALIBRATION_EVALUATION_COMPARISON_CLAIMS',
    );
  }

  for (const key of EVALUATION_HARD_FLAG_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(evaluation, key)) {
      fail(
        'CALIBRATION_EVALUATION_HARD_FLAG_MISSING',
        `evaluation hard flag ${key} is required`,
        { key },
      );
    }
    if (evaluation[key] !== false) {
      fail(
        'CALIBRATION_EVALUATION_HARD_FLAG_INVALID',
        `evaluation hard flag ${key} must be false`,
        { key },
      );
    }
  }

  assertPlainObject(
    evaluation.sideEffects,
    'CALIBRATION_EVALUATION_SIDE_EFFECTS_REQUIRED',
    'evaluation.sideEffects required',
  );
  assertAllowlist(
    evaluation.sideEffects,
    EVALUATION_SIDE_EFFECT_KEYS,
    'CALIBRATION_EVALUATION_SIDE_EFFECTS',
  );
  for (const key of EVALUATION_SIDE_EFFECT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(evaluation.sideEffects, key)) {
      fail(
        'CALIBRATION_EVALUATION_SIDE_EFFECT_MISSING',
        `evaluation side effect ${key} is required`,
        { key },
      );
    }
    if (evaluation.sideEffects[key] !== 0) {
      fail(
        'CALIBRATION_EVALUATION_SIDE_EFFECT_NONZERO',
        `evaluation side effect ${key} must be zero`,
        { key, value: evaluation.sideEffects[key] },
      );
    }
  }

  if (
    evaluation.implementationVersion != null
    && evaluation.implementationVersion !== OBSERVED_OUTCOME_EVALUATION_IMPLEMENTATION_VERSION
  ) {
    // Allow matching or equal; Evaluation build may set implementationVersion from input.
    // Accept any non-empty string that was already allowlisted above — do not invent.
    assertString(
      'evaluation.implementationVersion',
      evaluation.implementationVersion,
      'CALIBRATION_EVALUATION_IMPLEMENTATION_VERSION_INVALID',
    );
  }

  return evaluation;
}

/**
 * Require explicit directional truth for a usable calibration observation.
 * Empty/absent comparisonClaims under MATCH must NOT become calibratable.
 */
function extractUsableObservedTruth(evaluation, sourceDecision) {
  if (evaluation.observationClass !== OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE) {
    fail(
      'CALIBRATION_OBSERVATION_CLASS_NOT_EVALUABLE',
      'observationClass must be OBSERVED_AND_EVALUABLE for usable calibration',
      { observationClass: evaluation.observationClass },
    );
  }
  if (!USABLE_EVALUATION_STATUS_SET.has(evaluation.evaluationStatus)) {
    fail(
      'CALIBRATION_EVALUATION_STATUS_NOT_USABLE',
      'evaluationStatus must be MATCH or MISMATCH for usable calibration',
      { evaluationStatus: evaluation.evaluationStatus },
    );
  }

  const claims = evaluation.comparisonClaims;
  if (claims == null || typeof claims !== 'object' || Array.isArray(claims)) {
    fail(
      'CALIBRATION_COMPARISON_CLAIMS_REQUIRED',
      'Explicit comparisonClaims required; empty MATCH is not calibratable',
    );
  }
  if (
    !Object.prototype.hasOwnProperty.call(claims, 'decisionDirection')
    || claims.decisionDirection == null
    || claims.decisionDirection === ''
  ) {
    fail(
      'CALIBRATION_COMPARISON_DECISION_DIRECTION_REQUIRED',
      'comparisonClaims.decisionDirection required',
    );
  }
  if (
    !Object.prototype.hasOwnProperty.call(claims, 'observedDirection')
    || claims.observedDirection == null
    || claims.observedDirection === ''
  ) {
    fail(
      'CALIBRATION_COMPARISON_OBSERVED_DIRECTION_REQUIRED',
      'comparisonClaims.observedDirection required',
    );
  }
  if (!CALIBRABLE_DIRECTION_SET.has(claims.decisionDirection)) {
    fail(
      'CALIBRATION_COMPARISON_DECISION_DIRECTION_NOT_CALIBRABLE',
      'comparisonClaims.decisionDirection not calibrable',
      { decisionDirection: claims.decisionDirection },
    );
  }
  if (!CALIBRABLE_DIRECTION_SET.has(claims.observedDirection)) {
    fail(
      'CALIBRATION_COMPARISON_OBSERVED_DIRECTION_NOT_CALIBRABLE',
      'comparisonClaims.observedDirection not calibrable',
      { observedDirection: claims.observedDirection },
    );
  }

  if (evaluation.decisionRef.decisionId !== sourceDecision.decisionId) {
    fail(
      'CALIBRATION_DECISION_ID_MISMATCH',
      'evaluation.decisionRef.decisionId must equal source Decision decisionId',
      {
        evaluationDecisionId: evaluation.decisionRef.decisionId,
        sourceDecisionId: sourceDecision.decisionId,
      },
    );
  }
  if (sourceDecision.direction !== claims.decisionDirection) {
    fail(
      'CALIBRATION_SOURCE_DIRECTION_MISMATCH',
      'source Decision direction must equal comparisonClaims.decisionDirection',
      {
        sourceDirection: sourceDecision.direction,
        claimDecisionDirection: claims.decisionDirection,
      },
    );
  }

  const expectedStatus =
    claims.decisionDirection === claims.observedDirection
      ? EVALUATION_STATUS.MATCH
      : EVALUATION_STATUS.MISMATCH;
  if (evaluation.evaluationStatus !== expectedStatus) {
    fail(
      'CALIBRATION_EVALUATION_STATUS_INCONSISTENT',
      'evaluationStatus inconsistent with comparisonClaims directions',
      {
        evaluationStatus: evaluation.evaluationStatus,
        expectedStatus,
        decisionDirection: claims.decisionDirection,
        observedDirection: claims.observedDirection,
      },
    );
  }

  const ref = {
    evaluationId: evaluation.evaluationId,
    contractVersion: evaluation.contractVersion,
    evaluationStatus: evaluation.evaluationStatus,
    observationClass: evaluation.observationClass,
    decisionId: evaluation.decisionRef.decisionId,
    recordedAt: evaluation.recordedAt,
    decisionDirection: claims.decisionDirection,
    observedDirection: claims.observedDirection,
  };
  if (evaluation.outcomeRef?.outcomeId != null) {
    ref.outcomeId = evaluation.outcomeRef.outcomeId;
  }
  const mc = evaluation.marketContextRef;
  if (mc) {
    if (mc.venue != null) ref.venue = mc.venue;
    if (mc.marketType != null) ref.marketType = mc.marketType;
    if (mc.symbol != null) ref.symbol = mc.symbol;
    if (mc.timeframe != null) ref.timeframe = mc.timeframe;
    if (mc.sourceTimestamp != null) ref.sourceTimestamp = mc.sourceTimestamp;
  }
  assertAllowlist(ref, OBSERVED_TRUTH_REF_ALLOWLIST, 'CALIBRATION_OBSERVED_TRUTH_REF');
  return ref;
}

function assertTemporalIntegrity(decision, evaluation, observedTruthRef, calibrationRecordedAt) {
  assertIso(
    'decision.analysisAt',
    decision.analysisAt,
    'CALIBRATION_DECISION_ANALYSIS_AT_INVALID',
  );
  const predictionMs = Date.parse(decision.analysisAt);
  const evaluationMs = Date.parse(evaluation.recordedAt);
  if (!(predictionMs < evaluationMs)) {
    fail(
      'CALIBRATION_TEMPORAL_VIOLATION',
      'Predictive claim analysisAt must precede evaluation recordedAt',
      {
        analysisAt: decision.analysisAt,
        evaluationRecordedAt: evaluation.recordedAt,
      },
    );
  }
  if (decision.createdAt != null) {
    assertIso(
      'decision.createdAt',
      decision.createdAt,
      'CALIBRATION_DECISION_CREATED_AT_INVALID',
    );
    const createdMs = Date.parse(decision.createdAt);
    if (!(createdMs <= evaluationMs)) {
      fail(
        'CALIBRATION_TEMPORAL_CREATED_AT_VIOLATION',
        'Decision createdAt must not be after evaluation recordedAt',
      );
    }
  }
  if (observedTruthRef.sourceTimestamp != null) {
    const sourceMs = Date.parse(observedTruthRef.sourceTimestamp);
    if (!(predictionMs < sourceMs)) {
      fail(
        'CALIBRATION_TEMPORAL_SOURCE_TIMESTAMP_VIOLATION',
        'Predictive analysisAt must precede observed marketContextRef.sourceTimestamp',
      );
    }
  }
  const calibrationRecordedMs = Date.parse(calibrationRecordedAt);
  if (!(evaluationMs <= calibrationRecordedMs)) {
    fail(
      'CALIBRATION_TEMPORAL_RECORDED_AT_VIOLATION',
      'Calibration observation recordedAt must not precede evaluation recordedAt',
      {
        evaluationRecordedAt: evaluation.recordedAt,
        calibrationRecordedAt,
      },
    );
  }
}

/**
 * Deterministic observation identity.
 * recordedAt is bookkeeping and does NOT participate (Replay Result precedent).
 */
export function computeCalibrationObservationId({
  decisionId,
  evaluationId,
  direction,
  observedDirection,
  confidenceKind,
  confidenceValue,
  confidenceScale,
  implementationVersion = CONFIDENCE_CALIBRATION_IMPLEMENTATION_VERSION,
}) {
  return hashToUuid([
    CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
    CONFIDENCE_CALIBRATION_METHOD_KEY,
    decisionId,
    evaluationId,
    direction,
    observedDirection,
    confidenceKind,
    String(confidenceValue),
    confidenceScale,
    implementationVersion,
  ]);
}

/**
 * Build a thin Confidence Calibration Observation envelope.
 *
 * @param {object} input
 * @param {object} input.decision|input.sourceDecision - Artemis Decision artifact
 * @param {object} input.evaluationArtifact - built Observed Outcome Evaluation artifact
 * @param {string} input.recordedAt - caller-supplied ISO timestamp (bookkeeping)
 * @param {string} [input.calibrationObservationId] - optional; must match computed
 * @returns {object} frozen calibration observation artifact
 */
export function buildArtemisConfidenceCalibrationObservation(input = {}) {
  assertPlainObject(input, 'CALIBRATION_INPUT_REQUIRED', 'input must be an object');
  // Forbidden/secret scan BEFORE allowlist so contamination fields surface as
  // CALIBRATION_FORBIDDEN_FIELD / CALIBRATION_SECRET_FIELD (not UNKNOWN_FIELD).
  // Skip walking upstream Decision/Evaluation refs here — Option B / Decision
  // validator own their shape; sideEffects zero-counters must not false-positive.
  assertNoForbiddenOrSecrets(input, { skipUpstreamRefs: true });
  assertAllowlist(input, INPUT_TOP_ALLOWLIST, 'CALIBRATION_INPUT');
  assertHardFlags(input);

  const decision = input.decision ?? input.sourceDecision;
  if (decision == null) {
    fail('CALIBRATION_DECISION_REQUIRED', 'decision (or sourceDecision) required');
  }
  assertPlainObject(decision, 'CALIBRATION_DECISION_INVALID', 'decision must be an object');
  assertNoForbiddenOrSecrets(decision);

  const decisionResult = validateArtemisDecision(decision);
  if (!decisionResult || decisionResult.ok !== true) {
    fail(
      'CALIBRATION_DECISION_VALIDATION_FAILED',
      'source Decision failed validateArtemisDecision',
      {
        errors: decisionResult?.errors || [],
        upstreamCode: decisionResult?.code,
      },
    );
  }
  if (decision.contractVersion !== DECISION_CONTRACT_VERSION) {
    fail(
      'CALIBRATION_DECISION_CONTRACT_VERSION_MISMATCH',
      'Decision contractVersion mismatch',
      { contractVersion: decision.contractVersion },
    );
  }
  if (decision.schemaVersion != null && decision.schemaVersion !== DECISION_SCHEMA_VERSION) {
    fail(
      'CALIBRATION_DECISION_SCHEMA_VERSION_MISMATCH',
      'Decision schemaVersion mismatch',
    );
  }

  const evaluationArtifact = input.evaluationArtifact;
  if (evaluationArtifact == null) {
    fail('CALIBRATION_EVALUATION_REQUIRED', 'evaluationArtifact required');
  }
  assertNoForbiddenOrSecrets(evaluationArtifact);
  const evaluation = validateBuiltEvaluationArtifact(evaluationArtifact);

  assertIso('recordedAt', input.recordedAt, 'CALIBRATION_RECORDED_AT_INVALID');

  const predictiveClaimRef = extractPredictiveClaimRef(decision);
  const observedTruthRef = extractUsableObservedTruth(evaluation, decision);
  assertTemporalIntegrity(decision, evaluation, observedTruthRef, input.recordedAt);

  const implementationVersion =
    input.implementationVersion ?? CONFIDENCE_CALIBRATION_IMPLEMENTATION_VERSION;
  assertString(
    'implementationVersion',
    implementationVersion,
    'CALIBRATION_IMPLEMENTATION_VERSION_INVALID',
  );
  const policyVersion = input.policyVersion ?? CONFIDENCE_CALIBRATION_POLICY_VERSION;
  assertString('policyVersion', policyVersion, 'CALIBRATION_POLICY_VERSION_INVALID');

  const computedId = computeCalibrationObservationId({
    decisionId: predictiveClaimRef.decisionId,
    evaluationId: observedTruthRef.evaluationId,
    direction: predictiveClaimRef.direction,
    observedDirection: observedTruthRef.observedDirection,
    confidenceKind: predictiveClaimRef.confidence.kind,
    confidenceValue: predictiveClaimRef.confidence.value,
    confidenceScale: predictiveClaimRef.confidence.scale,
    implementationVersion,
  });

  if (input.calibrationObservationId != null) {
    assertUuid(
      'calibrationObservationId',
      input.calibrationObservationId,
      'CALIBRATION_OBSERVATION_ID_INVALID',
    );
    if (input.calibrationObservationId !== computedId) {
      fail(
        'CALIBRATION_OBSERVATION_ID_CONFLICT',
        'Caller-supplied calibrationObservationId conflicts with computed identity',
        {
          supplied: input.calibrationObservationId,
          computed: computedId,
        },
      );
    }
  }

  const versions = freezeDeep({
    schemaVersion: CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
    contractVersion: CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
    policyVersion,
    implementationVersion,
    decisionContractVersion: decision.contractVersion,
    evaluationContractVersion: evaluation.contractVersion,
  });
  assertAllowlist(versions, VERSIONS_ALLOWLIST, 'CALIBRATION_VERSIONS');

  const artifact = {
    schemaVersion: CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
    contractVersion: CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
    policyVersion,
    artifactType: CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
    authorityClass: CONFIDENCE_CALIBRATION_AUTHORITY_CLASS,
    sliceId: CONFIDENCE_CALIBRATION_SLICE_ID,
    calibrationObservationId: computedId,
    recordedAt: input.recordedAt,
    predictiveClaimRef: freezeDeep(predictiveClaimRef),
    observedTruthRef: freezeDeep(observedTruthRef),
    versions,
    provenance: normalizeProvenance(
      input.provenance,
      input.recordedAt,
      policyVersion,
      implementationVersion,
    ),
    limitations: normalizeLimitations(input.limitations),
    sideEffects: { ...ZERO_CONFIDENCE_CALIBRATION_SIDE_EFFECTS },
    ownershipRole: CONFIDENCE_CALIBRATION_OWNERSHIP_ROLE,
    isSourceOfTruth: CONFIDENCE_CALIBRATION_IS_SOURCE_OF_TRUTH,
    implementationVersion,
    predictiveClaimSourcePolicy: { ...PREDICTIVE_CLAIM_SOURCE_POLICY },
    calibrationMetricCanonicalStatus: CALIBRATION_METRIC_CANONICAL_STATUS,
    metricInvention: METRIC_INVENTION,
    ...REQUIRED_HARD_FLAGS,
  };

  assertAllowlist(artifact, TOP_LEVEL_ALLOWLIST, 'CALIBRATION_ARTIFACT');

  const frozen = freezeDeep(artifact);
  const bytes = utf8ByteLength(JSON.stringify(frozen));
  if (bytes > MAX_CALIBRATION_OBSERVATION_UTF8_BYTES) {
    fail('CALIBRATION_ARTIFACT_TOO_LARGE', 'Calibration observation exceeds size bound', {
      bytes,
      max: MAX_CALIBRATION_OBSERVATION_UTF8_BYTES,
    });
  }
  return frozen;
}

export function validateArtemisConfidenceCalibrationObservation(input = {}) {
  return buildArtemisConfidenceCalibrationObservation(input);
}

export default {
  CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
  CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
  CONFIDENCE_CALIBRATION_POLICY_VERSION,
  CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
  CONFIDENCE_CALIBRATION_AUTHORITY_CLASS,
  CONFIDENCE_CALIBRATION_SLICE_ID,
  CONFIDENCE_CALIBRATION_METHOD_KEY,
  CONFIDENCE_CALIBRATION_OWNERSHIP_ROLE,
  CONFIDENCE_CALIBRATION_IS_SOURCE_OF_TRUTH,
  CONFIDENCE_CALIBRATION_IMPLEMENTATION_VERSION,
  CONFIDENCE_CALIBRATION_WRITER,
  CONFIDENCE_CALIBRATION_STAGE,
  CALIBRATION_METRIC_CANONICAL_STATUS,
  METRIC_INVENTION,
  DECISION_LEVEL_CALIBRATION,
  EVIDENCE_LEVEL_CALIBRATION,
  PREDICTIVE_CLAIM_SOURCE_POLICY,
  PREDICTIVE_CONFIDENCE_KINDS,
  PREDICTIVE_CONFIDENCE_KIND_SET,
  CALIBRABLE_DIRECTIONS,
  CALIBRABLE_DIRECTION_SET,
  USABLE_EVALUATION_STATUS,
  USABLE_EVALUATION_STATUS_SET,
  REQUIRED_HARD_FLAGS,
  ZERO_CONFIDENCE_CALIBRATION_SIDE_EFFECTS,
  CONFIDENCE_CALIBRATION_LIMITATIONS,
  computeCalibrationObservationId,
  buildArtemisConfidenceCalibrationObservation,
  validateArtemisConfidenceCalibrationObservation,
  hashToUuid,
};
