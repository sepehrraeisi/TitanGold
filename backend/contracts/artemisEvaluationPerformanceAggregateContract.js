/**
 * Artemis Evaluation Performance Aggregate Contract Boundary
 * ===========================================================
 * SLICE: S10-EVALUATION-PERFORMANCE-AGGREGATE-CONTRACT
 * OFFICIAL: ARTEMIS_EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_BOUNDARY
 * AUTHORITY_CLASS: OUTCOME_EVALUATION
 * RISK_TIER: Tier 3
 *
 * Deterministic, library-only, non-SoT performance aggregation boundary
 * over an explicit caller-supplied set of canonical Observed Outcome
 * Evaluation artifacts.
 *
 * DETERMINISTIC_PERFORMANCE_AGGREGATION_COMPUTATION = YES
 * RUNTIME_EXECUTION = NO
 * CALLER_SUPPLIED_AGGREGATE_AUTHORITY = NO
 * EMPTY_MATCH_PERFORMANCE_BYPASS = CLOSED
 * EXPLICIT_COMPARISON_CLAIMS_REQUIRED = YES (for directional performance)
 * DUPLICATE_EVALUATION_ID_POLICY = FAIL_CLOSED
 * COHORT_VERSION_POLICY = HOMOGENEOUS / FAIL_CLOSED
 * REGIME_IDENTITY_CANONICAL = NO
 * SAMPLE_SUFFICIENCY_POLICY = DEFERRED
 * TRUST / WEIGHT / PROMOTION / DEMOTION / CALIBRATION / BRIER = NO
 * SOURCE_EVALUATION_SOT = READ_REFERENCE_ONLY
 * EVALUATION_SOT_QUERY_AUTHORITY = NO
 * isSourceOfTruth = false
 *
 * Pure computation when explicitly invoked is NOT a side effect and
 * NOT runtime activation.
 */

import {
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
  collectForbiddenSecretKeys,
} from './artemisEvidenceContract.js';
import {
  DIRECTION_OR_ABSTAIN,
  DECISION_CONTRACT_VERSION,
} from './artemisDecisionContract.js';
import {
  OBSERVED_OUTCOME_CONTRACT_VERSION,
} from './artemisObservedOutcomeContract.js';
import { hashToUuid } from './artemisReplayContract.js';
import {
  OBSERVED_OUTCOME_EVALUATION_ARTIFACT_TYPE as EVALUATION_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS as EVALUATION_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_EVALUATION_SLICE_ID as EVALUATION_SLICE_ID,
  OBSERVED_OUTCOME_EVALUATION_SCHEMA_VERSION as EVALUATION_SCHEMA_VERSION,
  OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION as EVALUATION_CONTRACT_VERSION,
  OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION as EVALUATION_POLICY_VERSION,
  OBSERVED_OUTCOME_EVALUATION_IMPLEMENTATION_VERSION as EVALUATION_IMPLEMENTATION_VERSION,
  OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE as EVALUATION_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_EVALUATION_WRITER as EVALUATION_WRITER,
  OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH as EVALUATION_IS_SOURCE_OF_TRUTH,
  EVALUATION_STATUS,
  OBSERVATION_CLASS,
  EVALUATION_METHOD_KEY,
  ZERO_EVALUATION_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS as EVALUATION_REQUIRED_HARD_FLAGS,
} from './artemisObservedOutcomeEvaluationContract.js';

// ---------------------------------------------------------------------------
// Canonical Aggregate identity
// ---------------------------------------------------------------------------

export const EVALUATION_PERFORMANCE_AGGREGATE_SCHEMA_VERSION = '1.0.0';
export const EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION =
  'artemis-evaluation-performance-aggregate-1.0.0';
export const EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION =
  'artemis-evaluation-performance-aggregate-policy-1.0.0';
export const EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION = '1.0.0';
export const EVALUATION_PERFORMANCE_AGGREGATE_ARTIFACT_TYPE =
  'ARTEMIS_EVALUATION_PERFORMANCE_AGGREGATE';
export const EVALUATION_PERFORMANCE_AGGREGATE_AUTHORITY_CLASS =
  'OUTCOME_EVALUATION';
export const EVALUATION_PERFORMANCE_AGGREGATE_SLICE_ID =
  'S10-EVALUATION-PERFORMANCE-AGGREGATE-CONTRACT';
export const EVALUATION_PERFORMANCE_AGGREGATE_WRITER =
  'artemisEvaluationPerformanceAggregateContract';
export const EVALUATION_PERFORMANCE_AGGREGATE_METHOD_KEY =
  'artemis.evaluation.performance.aggregate.v1';
export const EVALUATION_PERFORMANCE_AGGREGATE_OWNERSHIP_ROLE =
  'VALIDATION_BOUNDARY';
export const EVALUATION_PERFORMANCE_AGGREGATE_IS_SOURCE_OF_TRUTH = false;

export const AGGREGATE_RATIO_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
  NO_COMPARABLE_EVIDENCE: 'NO_COMPARABLE_EVIDENCE',
});

/** Directions that may participate in directional performance comparison. */
export const COMPARABLE_DIRECTIONS = Object.freeze({
  BULLISH: DIRECTION_OR_ABSTAIN.BULLISH,
  BEARISH: DIRECTION_OR_ABSTAIN.BEARISH,
  SIDEWAYS: DIRECTION_OR_ABSTAIN.SIDEWAYS,
  NEUTRAL: DIRECTION_OR_ABSTAIN.NEUTRAL,
});
export const COMPARABLE_DIRECTION_VALUES = Object.freeze(
  Object.values(COMPARABLE_DIRECTIONS),
);

export const MAX_AGGREGATE_INPUT_UTF8_BYTES = 256 * 1024;
export const MAX_AGGREGATE_ARTIFACT_UTF8_BYTES = 64 * 1024;
export const MAX_SOURCE_EVALUATIONS = 512;
export const MAX_PROVENANCE_KEYS = 24;
export const MAX_LIMITATIONS = 32;
export const MAX_LIMITATION_CHARS = 512;
export const MAX_STRING = 256;
export const MAX_NOTE_CHARS = 2048;

export const ZERO_AGGREGATE_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  networkCallCount: 0,
  providerCallCount: 0,
  llmCallCount: 0,
  runtimeMutationCount: 0,
  workerMutationCount: 0,
  schedulerMutationCount: 0,
  persistenceMutationCount: 0,
  trustMutationCount: 0,
  weightMutationCount: 0,
  promotionCount: 0,
  demotionCount: 0,
  calibrationExecutionCount: 0,
  brierExecutionCount: 0,
  orderCount: 0,
  walletMutationCount: 0,
  financialExecutionCount: 0,
  networkRequestCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  // Compact aliases
  db: 0,
  redis: 0,
  network: 0,
  provider: 0,
  llm: 0,
  runtime: 0,
  worker: 0,
  scheduler: 0,
  persistence: 0,
  trust: 0,
  weight: 0,
  promotion: 0,
  demotion: 0,
  calibration: 0,
  brier: 0,
  orders: 0,
  wallet: 0,
  financial: 0,
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
  persistenceActivation: false,
  runtimeActivation: false,
  networkActivation: false,
  providerActivation: false,
  llmActivation: false,
  workerActivation: false,
  schedulerActivation: false,
  trustMutation: false,
  weightMutation: false,
  promotionExecution: false,
  demotionExecution: false,
  calibrationExecution: false,
  financialExecution: false,
  trustMutationAuthorized: false,
  weightMutationAuthorized: false,
  promotionExecutionAuthorized: false,
  demotionExecutionAuthorized: false,
  calibrationExecutionAuthorized: false,
});

export const AGGREGATE_LIMITATIONS = Object.freeze([
  'stage10_evaluation_performance_aggregate_contract_boundary_only',
  'library_only',
  'deterministic_performance_aggregation_computation',
  'runtime_execution_no',
  'validation_boundary_not_sot',
  'is_source_of_truth_false',
  'caller_supplied_evaluation_set',
  'not_dataset_completeness_authority',
  'caller_supplied_aggregate_authority_forbidden',
  'empty_match_performance_bypass_closed',
  'explicit_comparison_claims_required_for_directional_performance',
  'duplicate_evaluation_id_fail_closed',
  'homogeneous_cohort_version_fail_closed',
  'regime_identity_canonical_no',
  'regime_segmentation_deferred',
  'sample_sufficiency_policy_deferred',
  'no_trust_mutation',
  'no_weight_mutation',
  'no_promotion_execution',
  'no_demotion_execution',
  'no_calibration_execution',
  'no_binary_brier_execution',
  'source_evaluation_sot_read_reference_only',
  'evaluation_sot_query_authority_no',
  'exact_rational_ratios_no_rounding_policy',
]);

// ---------------------------------------------------------------------------
// Internal vocabularies (frozen arrays — no Object.freeze(new Set) as authority)
// ---------------------------------------------------------------------------

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));
const SIDE_EFFECT_KEYS = Object.freeze(Object.keys(ZERO_AGGREGATE_SIDE_EFFECTS));
const EVALUATION_HARD_FLAG_KEYS = Object.freeze(
  Object.keys(EVALUATION_REQUIRED_HARD_FLAGS),
);
const EVALUATION_SIDE_EFFECT_KEYS = Object.freeze(
  Object.keys(ZERO_EVALUATION_SIDE_EFFECTS),
);
const EVALUATION_STATUS_VALUES = Object.freeze(Object.values(EVALUATION_STATUS));
const OBSERVATION_CLASS_VALUES = Object.freeze(Object.values(OBSERVATION_CLASS));
const METHOD_KEY_VALUES = Object.freeze(Object.values(EVALUATION_METHOD_KEY));
const DIRECTION_VALUES = Object.freeze(Object.values(DIRECTION_OR_ABSTAIN));
const COMPARABLE_DIRECTION_SET = new Set(COMPARABLE_DIRECTION_VALUES);
const EVALUATION_STATUS_SET = new Set(EVALUATION_STATUS_VALUES);
const OBSERVATION_CLASS_SET = new Set(OBSERVATION_CLASS_VALUES);
const METHOD_KEY_SET = new Set(METHOD_KEY_VALUES);
const DIRECTION_SET = new Set(DIRECTION_VALUES);
const RATIO_STATUS_SET = new Set(Object.values(AGGREGATE_RATIO_STATUS));

const TOP_LEVEL_ALLOWLIST = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'authorityClass',
  'sliceId',
  'aggregateId',
  'recordedAt',
  'cohort',
  'sourceEvaluationRefs',
  'counts',
  'performanceRatios',
  'timeCoverage',
  'versions',
  'provenance',
  'limitations',
  'sideEffects',
  'ownershipRole',
  'isSourceOfTruth',
  'implementationVersion',
  'sourceEvaluationSot',
  'evaluationSotQueryAuthority',
  'callerSuppliedAggregateAuthority',
  'emptyMatchPerformanceBypass',
  'sampleSufficiencyPolicy',
  'regimeIdentityCanonical',
  'regimeSegmentation',
  ...HARD_FLAG_KEYS,
]);

const INPUT_TOP_ALLOWLIST = Object.freeze([
  'evaluations',
  'recordedAt',
  'aggregateId',
  'limitations',
  'provenance',
  'note',
  ...HARD_FLAG_KEYS,
]);

const COHORT_ALLOWLIST = Object.freeze([
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'methodKey',
  'implementationVersion',
  'policyVersion',
  'contractVersion',
]);

const COUNTS_ALLOWLIST = Object.freeze([
  'sourceEvaluationCount',
  'evaluationStatusCounts',
  'observationClassCounts',
  'directionalComparableCount',
  'directionalNonComparableCount',
  'matchCount',
  'mismatchCount',
]);

const EVAL_STATUS_COUNTS_ALLOWLIST = Object.freeze(EVALUATION_STATUS_VALUES);
const OBS_CLASS_COUNTS_ALLOWLIST = Object.freeze(OBSERVATION_CLASS_VALUES);

const PERFORMANCE_RATIOS_ALLOWLIST = Object.freeze([
  'matchRatio',
  'mismatchRatio',
]);

const RATIO_ALLOWLIST = Object.freeze([
  'numerator',
  'denominator',
  'status',
]);

const TIME_COVERAGE_ALLOWLIST = Object.freeze([
  'earliestEvaluationRecordedAt',
  'latestEvaluationRecordedAt',
]);

const VERSIONS_ALLOWLIST = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
  'sourceEvaluationContractVersion',
  'sourceEvaluationPolicyVersion',
  'sourceEvaluationMethodKey',
  'sourceEvaluationMethodImplementationVersion',
]);

const PROVENANCE_ALLOWLIST = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'sliceId',
  'recordedAt',
  'policyVersion',
  'implementationVersion',
  'note',
]);

const SOURCE_REF_ALLOWLIST = Object.freeze([
  'evaluationId',
  'contractVersion',
  'evaluationStatus',
  'observationClass',
  'policyVersion',
  'methodKey',
  'implementationVersion',
]);

const EVAL_TOP_ALLOWLIST = Object.freeze([
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
const EVAL_MC_REF_ALLOWLIST = Object.freeze([
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

const FORBIDDEN_AGGREGATE_AUTHORITY_KEYS = Object.freeze([
  'matchCount',
  'mismatchCount',
  'directionalComparableCount',
  'directionalNonComparableCount',
  'sourceEvaluationCount',
  'sampleCount',
  'totalEvaluations',
  'totalCount',
  'blockedCount',
  'unavailableCount',
  'insufficientDataCount',
  'accuracy',
  'successRate',
  'matchRate',
  'mismatchRate',
  'performanceScore',
  'qualityScore',
  'aggregateScore',
  'trustScore',
  'trust',
  'weight',
  'agentWeight',
  'reputation',
  'promotionStatus',
  'promotionEligible',
  'demotionStatus',
  'demotionEligible',
  'qualityGrade',
  'grade',
  'rank',
  'pass',
  'fail',
  'good',
  'bad',
  'approved',
  'sufficient',
  'insufficient',
  'mature',
  'trusted',
  'brierScore',
  'brier',
  'ece',
  'calibrationError',
  'calibrationScore',
  'reliabilityCurve',
  'confidenceBuckets',
]);

const SECRET_LIKE_KEYS = Object.freeze([
  'apiKey',
  'api_key',
  'token',
  'password',
  'credential',
  'credentials',
  'privateKey',
  'private_key',
  'secret',
  'walletSecret',
  'wallet_secret',
  'exchangeCredential',
  'exchange_credential',
]);

const RAW_PAYLOAD_KEYS = Object.freeze([
  'providerPayload',
  'marketPayload',
  'rawProviderResponse',
  'orders',
  'balances',
  'walletPayload',
  'ohlcv',
  'candles',
  'orderbook',
  'ticker',
]);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EvaluationPerformanceAggregateContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'EvaluationPerformanceAggregateContractError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new EvaluationPerformanceAggregateContractError(code, message, details);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function assertString(value, field, { max = MAX_STRING, allowEmpty = false } = {}) {
  if (typeof value !== 'string') {
    fail('AGGREGATE_INVALID_STRING', `${field} must be a string`);
  }
  if (!allowEmpty && value.length === 0) {
    fail('AGGREGATE_EMPTY_STRING', `${field} must be non-empty`);
  }
  if (value.length > max) {
    fail('AGGREGATE_STRING_TOO_LONG', `${field} exceeds max length ${max}`);
  }
  return value;
}

function assertExactString(value, expected, field) {
  assertString(value, field);
  if (value !== expected) {
    fail('AGGREGATE_VALUE_MISMATCH', `${field} must equal ${expected}`, {
      field,
      expected,
      actual: value,
    });
  }
  return value;
}

function assertCanonicalUuid(value, field) {
  assertString(value, field, { max: 36 });
  if (!isCanonicalUuid(value)) {
    fail('AGGREGATE_INVALID_UUID', `${field} must be a canonical UUID`);
  }
  return value;
}

function assertIsoTimestamp(value, field) {
  assertString(value, field, { max: 64 });
  if (!isIsoTimestamp(value)) {
    fail('AGGREGATE_INVALID_TIMESTAMP', `${field} must be a valid ISO timestamp`);
  }
  return value;
}

function assertAllowlist(obj, allowlist, code, label) {
  for (const key of Object.keys(obj)) {
    if (!allowlist.includes(key)) {
      fail(code, `${label} contains unknown field: ${key}`, { key });
    }
  }
}

function assertNonNegativeInteger(value, field) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail('AGGREGATE_INVALID_COUNT', `${field} must be a non-negative integer`);
  }
  return value;
}

/**
 * Deep-scan for caller-authority / secret / raw-payload contamination.
 *
 * Confidence Calibration / Replay Result precedent: nested `sideEffects`
 * numeric counter leaves with payload-looking names (`orders`, `wallet`, …)
 * are zero-count ledgers and must NOT false-positive. Object/array values
 * under those names still fail closed.
 *
 * Upstream Evaluation artifacts are validated separately via Option-B; their
 * zero side-effect ledgers are exempted the same way when walked from input.
 */
function isForbiddenAuthorityKey(key) {
  const lower = key.toLowerCase();
  return (
    FORBIDDEN_AGGREGATE_AUTHORITY_KEYS.includes(key)
    || FORBIDDEN_AGGREGATE_AUTHORITY_KEYS.some((k) => k.toLowerCase() === lower)
  );
}

function isSecretLikeKey(key) {
  const lower = key.toLowerCase();
  return SECRET_LIKE_KEYS.some((s) => {
    const needle = s.toLowerCase();
    return lower === needle || lower.includes(needle);
  });
}

function scanForbiddenKeys(value, path = '') {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => scanForbiddenKeys(item, `${path}[${i}]`));
    return;
  }
  for (const key of Object.keys(value)) {
    const nested = value[key];
    const nextPath = path ? `${path}.${key}` : key;

    // Zero-count side-effect ledger exception (orders: 0, wallet: 0, …).
    if (key === 'sideEffects' && isPlainObject(nested)) {
      for (const [seKey, seVal] of Object.entries(nested)) {
        if (typeof seVal === 'number') continue;
        if (isForbiddenAuthorityKey(seKey) || isSecretLikeKey(seKey)
          || RAW_PAYLOAD_KEYS.includes(seKey)) {
          fail(
            'AGGREGATE_RAW_PAYLOAD_FORBIDDEN',
            `Non-numeric sideEffects leaf forbidden: ${seKey}`,
            { key: seKey, path: `${nextPath}.${seKey}` },
          );
        }
        if (seVal && typeof seVal === 'object') {
          scanForbiddenKeys(seVal, `${nextPath}.${seKey}`);
        }
      }
      continue;
    }

    if (isForbiddenAuthorityKey(key)) {
      fail(
        'AGGREGATE_CALLER_AUTHORITY_FORBIDDEN',
        `Caller aggregate authority field forbidden: ${key}`,
        { key, path },
      );
    }
    if (isSecretLikeKey(key)) {
      fail('AGGREGATE_SECRET_CONTAMINATION', `Secret-like key forbidden: ${key}`, {
        key,
        path,
      });
    }
    if (RAW_PAYLOAD_KEYS.includes(key)) {
      fail('AGGREGATE_RAW_PAYLOAD_FORBIDDEN', `Raw payload key forbidden: ${key}`, {
        key,
        path,
      });
    }
    scanForbiddenKeys(nested, nextPath);
  }
}

function assertNoSecrets(value, label) {
  const found = collectForbiddenSecretKeys(value);
  if (found.length > 0) {
    fail('AGGREGATE_SECRET_CONTAMINATION', `${label} contains secret-like keys`, {
      keys: found.slice(0, 8),
    });
  }
}

function emptyStatusCounts() {
  const out = {};
  for (const status of EVALUATION_STATUS_VALUES) out[status] = 0;
  return out;
}

function emptyObservationClassCounts() {
  const out = {};
  for (const cls of OBSERVATION_CLASS_VALUES) out[cls] = 0;
  return out;
}

function isoMs(value) {
  return Date.parse(value);
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}

// ---------------------------------------------------------------------------
// Built Evaluation validation (Option-B)
// ---------------------------------------------------------------------------

function validateBuiltEvaluationArtifact(evaluation, index) {
  const label = `evaluations[${index}]`;
  if (!isPlainObject(evaluation)) {
    fail('AGGREGATE_INVALID_EVALUATION', `${label} must be a plain object`);
  }
  assertAllowlist(
    evaluation,
    EVAL_TOP_ALLOWLIST,
    'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
    label,
  );
  assertExactString(
    evaluation.schemaVersion,
    EVALUATION_SCHEMA_VERSION,
    `${label}.schemaVersion`,
  );
  assertExactString(
    evaluation.contractVersion,
    EVALUATION_CONTRACT_VERSION,
    `${label}.contractVersion`,
  );
  assertExactString(
    evaluation.policyVersion,
    EVALUATION_POLICY_VERSION,
    `${label}.policyVersion`,
  );
  assertExactString(
    evaluation.artifactType,
    EVALUATION_ARTIFACT_TYPE,
    `${label}.artifactType`,
  );
  assertExactString(
    evaluation.authorityClass,
    EVALUATION_AUTHORITY_CLASS,
    `${label}.authorityClass`,
  );
  assertExactString(
    evaluation.sliceId,
    EVALUATION_SLICE_ID,
    `${label}.sliceId`,
  );
  assertCanonicalUuid(evaluation.evaluationId, `${label}.evaluationId`);
  if (!EVALUATION_STATUS_SET.has(evaluation.evaluationStatus)) {
    fail(
      'AGGREGATE_INVALID_EVALUATION_STATUS',
      `${label}.evaluationStatus is not canonical`,
    );
  }
  if (!OBSERVATION_CLASS_SET.has(evaluation.observationClass)) {
    fail(
      'AGGREGATE_INVALID_OBSERVATION_CLASS',
      `${label}.observationClass is not canonical`,
    );
  }
  assertIsoTimestamp(evaluation.recordedAt, `${label}.recordedAt`);
  assertExactString(
    evaluation.ownershipRole,
    EVALUATION_OWNERSHIP_ROLE,
    `${label}.ownershipRole`,
  );
  if (evaluation.isSourceOfTruth !== EVALUATION_IS_SOURCE_OF_TRUTH) {
    fail(
      'AGGREGATE_EVALUATION_SOT_FLAG',
      `${label}.isSourceOfTruth must be false`,
    );
  }
  assertExactString(
    evaluation.implementationVersion,
    EVALUATION_IMPLEMENTATION_VERSION,
    `${label}.implementationVersion`,
  );

  // decisionRef — built thin ref: decisionId + contractVersion only
  if (!isPlainObject(evaluation.decisionRef)) {
    fail('AGGREGATE_INVALID_DECISION_REF', `${label}.decisionRef required`);
  }
  assertAllowlist(
    evaluation.decisionRef,
    EVAL_DECISION_REF_ALLOWLIST,
    'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
    `${label}.decisionRef`,
  );
  assertCanonicalUuid(evaluation.decisionRef.decisionId, `${label}.decisionRef.decisionId`);
  assertString(evaluation.decisionRef.contractVersion, `${label}.decisionRef.contractVersion`);
  if (evaluation.decisionRef.contractVersion !== DECISION_CONTRACT_VERSION) {
    fail(
      'AGGREGATE_EVALUATION_DECISION_CONTRACT_VERSION_MISMATCH',
      `${label}.decisionRef.contractVersion mismatch`,
      {
        expected: DECISION_CONTRACT_VERSION,
        provided: evaluation.decisionRef.contractVersion,
      },
    );
  }

  // outcomeRef — built thin ref: outcomeId + contractVersion only
  if (!isPlainObject(evaluation.outcomeRef)) {
    fail('AGGREGATE_INVALID_OUTCOME_REF', `${label}.outcomeRef required`);
  }
  assertAllowlist(
    evaluation.outcomeRef,
    EVAL_OUTCOME_REF_ALLOWLIST,
    'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
    `${label}.outcomeRef`,
  );
  assertCanonicalUuid(evaluation.outcomeRef.outcomeId, `${label}.outcomeRef.outcomeId`);
  assertString(evaluation.outcomeRef.contractVersion, `${label}.outcomeRef.contractVersion`);
  if (evaluation.outcomeRef.contractVersion !== OBSERVED_OUTCOME_CONTRACT_VERSION) {
    fail(
      'AGGREGATE_EVALUATION_OUTCOME_CONTRACT_VERSION_MISMATCH',
      `${label}.outcomeRef.contractVersion mismatch`,
      {
        expected: OBSERVED_OUTCOME_CONTRACT_VERSION,
        provided: evaluation.outcomeRef.contractVersion,
      },
    );
  }

  // marketContextRef — optional thin ref (Confidence Calibration Option-B)
  let marketContextRef = null;
  if (evaluation.marketContextRef != null) {
    if (!isPlainObject(evaluation.marketContextRef)) {
      fail(
        'AGGREGATE_INVALID_MARKET_CONTEXT_REF',
        `${label}.marketContextRef must be plain object or null`,
      );
    }
    assertAllowlist(
      evaluation.marketContextRef,
      EVAL_MC_REF_ALLOWLIST,
      'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
      `${label}.marketContextRef`,
    );
    if (evaluation.marketContextRef.marketContextId != null) {
      assertCanonicalUuid(
        evaluation.marketContextRef.marketContextId,
        `${label}.marketContextRef.marketContextId`,
      );
    }
    if (evaluation.marketContextRef.contractVersion != null) {
      assertString(
        evaluation.marketContextRef.contractVersion,
        `${label}.marketContextRef.contractVersion`,
      );
    }
    if (evaluation.marketContextRef.sourceTimestamp != null) {
      assertIsoTimestamp(
        evaluation.marketContextRef.sourceTimestamp,
        `${label}.marketContextRef.sourceTimestamp`,
      );
    }
    for (const dim of ['venue', 'marketType', 'symbol', 'timeframe']) {
      if (evaluation.marketContextRef[dim] != null) {
        assertString(
          evaluation.marketContextRef[dim],
          `${label}.marketContextRef.${dim}`,
        );
      }
    }
    marketContextRef = evaluation.marketContextRef;
  }

  // Optional thin refs (allowlist only when present)
  if (evaluation.decisionContextRef != null) {
    assertAllowlist(
      evaluation.decisionContextRef,
      EVAL_CONTEXT_REF_ALLOWLIST,
      'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
      `${label}.decisionContextRef`,
    );
  }
  if (evaluation.shadowRecordingRef != null) {
    assertAllowlist(
      evaluation.shadowRecordingRef,
      EVAL_SHADOW_RECORDING_REF_ALLOWLIST,
      'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
      `${label}.shadowRecordingRef`,
    );
  }
  if (evaluation.taskRef != null) {
    assertAllowlist(
      evaluation.taskRef,
      EVAL_TASK_REF_ALLOWLIST,
      'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
      `${label}.taskRef`,
    );
  }
  if (evaluation.bindingRef != null) {
    assertAllowlist(
      evaluation.bindingRef,
      EVAL_BINDING_REF_ALLOWLIST,
      'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
      `${label}.bindingRef`,
    );
  }
  if (evaluation.outcomeSotRef != null) {
    assertAllowlist(
      evaluation.outcomeSotRef,
      EVAL_OUTCOME_SOT_REF_ALLOWLIST,
      'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
      `${label}.outcomeSotRef`,
    );
  }

  // evaluationMethod
  if (!isPlainObject(evaluation.evaluationMethod)) {
    fail('AGGREGATE_INVALID_EVALUATION_METHOD', `${label}.evaluationMethod required`);
  }
  assertAllowlist(
    evaluation.evaluationMethod,
    EVAL_METHOD_ALLOWLIST,
    'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
    `${label}.evaluationMethod`,
  );
  if (!METHOD_KEY_SET.has(evaluation.evaluationMethod.methodKey)) {
    fail(
      'AGGREGATE_INVALID_METHOD_KEY',
      `${label}.evaluationMethod.methodKey is not canonical`,
    );
  }
  assertString(
    evaluation.evaluationMethod.implementationVersion,
    `${label}.evaluationMethod.implementationVersion`,
  );

  // comparisonClaims (optional)
  let comparisonClaims = null;
  if (evaluation.comparisonClaims !== undefined && evaluation.comparisonClaims !== null) {
    if (!isPlainObject(evaluation.comparisonClaims)) {
      fail(
        'AGGREGATE_INVALID_COMPARISON_CLAIMS',
        `${label}.comparisonClaims must be plain object or null`,
      );
    }
    assertAllowlist(
      evaluation.comparisonClaims,
      EVAL_COMPARISON_CLAIMS_ALLOWLIST,
      'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
      `${label}.comparisonClaims`,
    );
    const { decisionDirection, observedDirection } = evaluation.comparisonClaims;
    if (decisionDirection !== undefined) {
      if (!DIRECTION_SET.has(decisionDirection)) {
        fail(
          'AGGREGATE_INVALID_DIRECTION',
          `${label}.comparisonClaims.decisionDirection invalid`,
        );
      }
    }
    if (observedDirection !== undefined) {
      if (!DIRECTION_SET.has(observedDirection)) {
        fail(
          'AGGREGATE_INVALID_DIRECTION',
          `${label}.comparisonClaims.observedDirection invalid`,
        );
      }
    }
    comparisonClaims = evaluation.comparisonClaims;
  }

  // lineage
  if (!isPlainObject(evaluation.lineage)) {
    fail('AGGREGATE_INVALID_LINEAGE', `${label}.lineage required`);
  }
  assertAllowlist(
    evaluation.lineage,
    EVAL_LINEAGE_ALLOWLIST,
    'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
    `${label}.lineage`,
  );

  // provenance
  if (!isPlainObject(evaluation.provenance)) {
    fail('AGGREGATE_INVALID_PROVENANCE', `${label}.provenance required`);
  }
  assertAllowlist(
    evaluation.provenance,
    EVAL_PROVENANCE_ALLOWLIST,
    'AGGREGATE_EVALUATION_UNKNOWN_FIELD',
    `${label}.provenance`,
  );
  assertExactString(
    evaluation.provenance.writer,
    EVALUATION_WRITER,
    `${label}.provenance.writer`,
  );
  assertIsoTimestamp(evaluation.provenance.recordedAt, `${label}.provenance.recordedAt`);

  // limitations
  if (!Array.isArray(evaluation.limitations)) {
    fail('AGGREGATE_INVALID_LIMITATIONS', `${label}.limitations must be an array`);
  }

  // sideEffects — complete zero ledger
  if (!isPlainObject(evaluation.sideEffects)) {
    fail('AGGREGATE_EVALUATION_SIDE_EFFECTS', `${label}.sideEffects required`);
  }
  for (const key of EVALUATION_SIDE_EFFECT_KEYS) {
    if (!(key in evaluation.sideEffects)) {
      fail(
        'AGGREGATE_EVALUATION_SIDE_EFFECTS',
        `${label}.sideEffects.${key} missing`,
      );
    }
    if (evaluation.sideEffects[key] !== 0) {
      fail(
        'AGGREGATE_EVALUATION_SIDE_EFFECTS',
        `${label}.sideEffects.${key} must be 0`,
      );
    }
  }

  // hard flags — explicit false
  for (const key of EVALUATION_HARD_FLAG_KEYS) {
    if (!(key in evaluation)) {
      fail('AGGREGATE_EVALUATION_HARD_FLAG', `${label}.${key} missing`);
    }
    if (evaluation[key] !== false) {
      fail('AGGREGATE_EVALUATION_HARD_FLAG', `${label}.${key} must be false`);
    }
  }

  assertNoSecrets(evaluation, label);

  return {
    evaluationId: evaluation.evaluationId,
    contractVersion: evaluation.contractVersion,
    policyVersion: evaluation.policyVersion,
    evaluationStatus: evaluation.evaluationStatus,
    observationClass: evaluation.observationClass,
    recordedAt: evaluation.recordedAt,
    methodKey: evaluation.evaluationMethod.methodKey,
    implementationVersion: evaluation.evaluationMethod.implementationVersion,
    marketContextRef,
    comparisonClaims,
    artifact: evaluation,
  };
}

// ---------------------------------------------------------------------------
// Directional classification
// ---------------------------------------------------------------------------

function classifyDirectional(validated) {
  const { observationClass, comparisonClaims, evaluationStatus, evaluationId } =
    validated;

  const hasExplicitClaims = (
    comparisonClaims !== null
    && comparisonClaims.decisionDirection !== undefined
    && comparisonClaims.observedDirection !== undefined
  );

  if (
    observationClass === OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE
    && hasExplicitClaims
  ) {
    const { decisionDirection, observedDirection } = comparisonClaims;
    if (
      COMPARABLE_DIRECTION_SET.has(decisionDirection)
      && COMPARABLE_DIRECTION_SET.has(observedDirection)
    ) {
      const expectedStatus = decisionDirection === observedDirection
        ? EVALUATION_STATUS.MATCH
        : EVALUATION_STATUS.MISMATCH;
      if (evaluationStatus !== expectedStatus) {
        fail(
          'EVALUATION_DIRECTION_STATUS_CONFLICT',
          'evaluationStatus conflicts with explicit comparisonClaims directions',
          {
            evaluationId,
            evaluationStatus,
            expectedStatus,
            decisionDirection,
            observedDirection,
          },
        );
      }
      return {
        comparable: true,
        match: expectedStatus === EVALUATION_STATUS.MATCH,
      };
    }
  }

  return { comparable: false, match: false };
}

// ---------------------------------------------------------------------------
// Cohort / version homogeneity
// ---------------------------------------------------------------------------

function extractCohortDescriptor(validatedList) {
  const first = validatedList[0];
  const mc = first.marketContextRef;
  const cohort = {
    venue: mc ? mc.venue : null,
    marketType: mc ? mc.marketType : null,
    symbol: mc ? mc.symbol : null,
    timeframe: mc ? mc.timeframe : null,
    methodKey: first.methodKey,
    implementationVersion: first.implementationVersion,
    policyVersion: first.policyVersion,
    contractVersion: first.contractVersion,
  };

  for (let i = 1; i < validatedList.length; i += 1) {
    const v = validatedList[i];
    const vMc = v.marketContextRef;
    const next = {
      venue: vMc ? vMc.venue : null,
      marketType: vMc ? vMc.marketType : null,
      symbol: vMc ? vMc.symbol : null,
      timeframe: vMc ? vMc.timeframe : null,
      methodKey: v.methodKey,
      implementationVersion: v.implementationVersion,
      policyVersion: v.policyVersion,
      contractVersion: v.contractVersion,
    };

    // Version homogeneity
    if (
      next.contractVersion !== cohort.contractVersion
      || next.policyVersion !== cohort.policyVersion
      || next.methodKey !== cohort.methodKey
      || next.implementationVersion !== cohort.implementationVersion
    ) {
      fail(
        'MIXED_EVALUATION_VERSION_COHORT',
        'Source evaluations have mixed contract/policy/method/implementation versions',
        { index: i, cohort, next },
      );
    }

    // Market cohort homogeneity
    if (
      next.venue !== cohort.venue
      || next.marketType !== cohort.marketType
      || next.symbol !== cohort.symbol
      || next.timeframe !== cohort.timeframe
    ) {
      fail(
        'MIXED_COHORT',
        'Source evaluations have mixed venue/marketType/symbol/timeframe cohort',
        { index: i, cohort, next },
      );
    }
  }

  return cohort;
}

// ---------------------------------------------------------------------------
// Aggregate ID
// ---------------------------------------------------------------------------

export function computeEvaluationPerformanceAggregateId({
  cohort,
  evaluationIds,
  contractVersion = EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
  policyVersion = EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
} = {}) {
  if (!isPlainObject(cohort)) {
    fail('AGGREGATE_INVALID_COHORT', 'cohort must be a plain object for identity');
  }
  if (!Array.isArray(evaluationIds) || evaluationIds.length === 0) {
    fail('AGGREGATE_INVALID_IDENTITY', 'evaluationIds must be a non-empty array');
  }
  const sortedIds = [...evaluationIds].sort();
  const material = {
    contractVersion,
    policyVersion,
    cohort: {
      venue: cohort.venue ?? null,
      marketType: cohort.marketType ?? null,
      symbol: cohort.symbol ?? null,
      timeframe: cohort.timeframe ?? null,
      methodKey: cohort.methodKey,
      implementationVersion: cohort.implementationVersion,
      policyVersion: cohort.policyVersion,
      contractVersion: cohort.contractVersion,
    },
    evaluationIds: sortedIds,
  };
  return hashToUuid(
    `artemis-evaluation-performance-aggregate-v1|${stableJson(material)}`,
  );
}

// ---------------------------------------------------------------------------
// Ratio builders
// ---------------------------------------------------------------------------

function buildRatio(numerator, denominator) {
  if (denominator === 0) {
    return deepFreeze({
      numerator: 0,
      denominator: 0,
      status: AGGREGATE_RATIO_STATUS.UNAVAILABLE,
      // Explicit secondary status token for NO_COMPARABLE_EVIDENCE
      reason: AGGREGATE_RATIO_STATUS.NO_COMPARABLE_EVIDENCE,
    });
  }
  return deepFreeze({
    numerator,
    denominator,
    status: AGGREGATE_RATIO_STATUS.AVAILABLE,
  });
}

// ---------------------------------------------------------------------------
// Core build
// ---------------------------------------------------------------------------

function normalizeLimitations(inputLimitations) {
  const out = [...AGGREGATE_LIMITATIONS];
  if (inputLimitations === undefined) return Object.freeze(out);
  if (!Array.isArray(inputLimitations)) {
    fail('AGGREGATE_INVALID_LIMITATIONS', 'limitations must be an array');
  }
  if (inputLimitations.length > MAX_LIMITATIONS) {
    fail('AGGREGATE_LIMITATIONS_TOO_MANY', 'limitations exceed max');
  }
  for (const item of inputLimitations) {
    assertString(item, 'limitations[]', { max: MAX_LIMITATION_CHARS });
    if (!out.includes(item)) out.push(item);
  }
  return Object.freeze(out);
}

function buildProvenance(recordedAt, callerProvenance) {
  const base = {
    writer: EVALUATION_PERFORMANCE_AGGREGATE_WRITER,
    methodKey: EVALUATION_PERFORMANCE_AGGREGATE_METHOD_KEY,
    stage: 'ARTEMIS_CORE_STAGE_10',
    sliceId: EVALUATION_PERFORMANCE_AGGREGATE_SLICE_ID,
    recordedAt,
    policyVersion: EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
    implementationVersion: EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
  };
  if (callerProvenance === undefined) return deepFreeze(base);
  if (!isPlainObject(callerProvenance)) {
    fail('AGGREGATE_INVALID_PROVENANCE', 'provenance must be a plain object');
  }
  assertAllowlist(
    callerProvenance,
    PROVENANCE_ALLOWLIST,
    'AGGREGATE_PROVENANCE_UNKNOWN_FIELD',
    'provenance',
  );
  // Caller may not override authority identity fields
  for (const locked of [
    'writer',
    'methodKey',
    'policyVersion',
    'implementationVersion',
    'stage',
    'sliceId',
  ]) {
    if (
      callerProvenance[locked] !== undefined
      && callerProvenance[locked] !== base[locked]
    ) {
      fail(
        'AGGREGATE_PROVENANCE_OVERRIDE_FORBIDDEN',
        `Caller must not override provenance.${locked}`,
      );
    }
  }
  if (callerProvenance.note !== undefined) {
    assertString(callerProvenance.note, 'provenance.note', { max: MAX_NOTE_CHARS });
    base.note = callerProvenance.note;
  }
  if (callerProvenance.recordedAt !== undefined) {
    assertIsoTimestamp(callerProvenance.recordedAt, 'provenance.recordedAt');
  }
  return deepFreeze(base);
}

function assertHardFlags(input) {
  for (const key of HARD_FLAG_KEYS) {
    if (key in input) {
      if (input[key] !== false) {
        fail('AGGREGATE_HARD_FLAG', `hard flag ${key} must be false when present`);
      }
    }
  }
}

/**
 * Build a deterministic Evaluation Performance Aggregate artifact from an
 * explicit caller-supplied set of canonical Observed Outcome Evaluation
 * artifacts.
 */
export function buildArtemisEvaluationPerformanceAggregate(input) {
  if (!isPlainObject(input)) {
    fail('AGGREGATE_INVALID_INPUT', 'input must be a plain object');
  }

  const inputBytes = utf8ByteLength(JSON.stringify(input));
  if (inputBytes > MAX_AGGREGATE_INPUT_UTF8_BYTES) {
    fail('AGGREGATE_INPUT_TOO_LARGE', 'input exceeds size bound', {
      bytes: inputBytes,
      max: MAX_AGGREGATE_INPUT_UTF8_BYTES,
    });
  }

  assertAllowlist(
    input,
    INPUT_TOP_ALLOWLIST,
    'AGGREGATE_UNKNOWN_FIELD',
    'input',
  );
  scanForbiddenKeys(input);
  assertNoSecrets(input, 'input');
  assertHardFlags(input);

  if (!Array.isArray(input.evaluations)) {
    fail('AGGREGATE_EVALUATIONS_REQUIRED', 'evaluations must be a non-empty array');
  }
  if (input.evaluations.length === 0) {
    fail('AGGREGATE_EVALUATIONS_REQUIRED', 'evaluations must be a non-empty array');
  }
  if (input.evaluations.length > MAX_SOURCE_EVALUATIONS) {
    fail(
      'AGGREGATE_TOO_MANY_EVALUATIONS',
      `evaluations exceed max ${MAX_SOURCE_EVALUATIONS}`,
    );
  }

  const recordedAt = assertIsoTimestamp(input.recordedAt, 'recordedAt');

  // Validate each Evaluation (Option-B)
  const validated = input.evaluations.map((ev, i) =>
    validateBuiltEvaluationArtifact(ev, i));

  // Duplicate evaluationId → FAIL CLOSED
  const seenIds = new Set();
  for (const v of validated) {
    if (seenIds.has(v.evaluationId)) {
      fail(
        'AGGREGATE_DUPLICATE_EVALUATION_ID',
        `Duplicate evaluationId: ${v.evaluationId}`,
        { evaluationId: v.evaluationId },
      );
    }
    seenIds.add(v.evaluationId);
  }

  // Order-independent: sort by evaluationId
  const sorted = [...validated].sort((a, b) =>
    (a.evaluationId < b.evaluationId ? -1 : a.evaluationId > b.evaluationId ? 1 : 0));

  // recordedAt must be >= latest source Evaluation recordedAt
  let latestSource = sorted[0].recordedAt;
  let earliestSource = sorted[0].recordedAt;
  for (const v of sorted) {
    if (isoMs(v.recordedAt) > isoMs(latestSource)) latestSource = v.recordedAt;
    if (isoMs(v.recordedAt) < isoMs(earliestSource)) earliestSource = v.recordedAt;
  }
  if (isoMs(recordedAt) < isoMs(latestSource)) {
    fail(
      'AGGREGATE_RECORDED_AT_BEFORE_SOURCE',
      'aggregate recordedAt must be >= latest source Evaluation recordedAt',
      { recordedAt, latestSource },
    );
  }

  const cohort = extractCohortDescriptor(sorted);

  // Reject regime / agentRole / analysisHorizon fabrication attempts already
  // covered by allowlists; double-check cohort has no such keys
  for (const forbidden of ['regime', 'agentRole', 'analysisHorizon']) {
    if (Object.prototype.hasOwnProperty.call(cohort, forbidden)) {
      fail('AGGREGATE_REGIME_INVENTED', `${forbidden} must not appear in cohort`);
    }
  }

  // Derive counts
  const evaluationStatusCounts = emptyStatusCounts();
  const observationClassCounts = emptyObservationClassCounts();
  let directionalComparableCount = 0;
  let directionalNonComparableCount = 0;
  let matchCount = 0;
  let mismatchCount = 0;

  for (const v of sorted) {
    evaluationStatusCounts[v.evaluationStatus] += 1;
    observationClassCounts[v.observationClass] += 1;

    const classification = classifyDirectional(v);
    if (classification.comparable) {
      directionalComparableCount += 1;
      if (classification.match) matchCount += 1;
      else mismatchCount += 1;
    } else {
      directionalNonComparableCount += 1;
    }
  }

  const sourceEvaluationCount = sorted.length;

  // Invariants
  if (matchCount + mismatchCount !== directionalComparableCount) {
    fail(
      'AGGREGATE_INTERNAL_INVARIANT',
      'matchCount + mismatchCount must equal directionalComparableCount',
    );
  }
  if (
    directionalComparableCount + directionalNonComparableCount
    !== sourceEvaluationCount
  ) {
    fail(
      'AGGREGATE_INTERNAL_INVARIANT',
      'comparable + nonComparable must equal sourceEvaluationCount',
    );
  }
  const statusSum = EVALUATION_STATUS_VALUES.reduce(
    (acc, s) => acc + evaluationStatusCounts[s],
    0,
  );
  if (statusSum !== sourceEvaluationCount) {
    fail(
      'AGGREGATE_INTERNAL_INVARIANT',
      'sum(evaluationStatusCounts) must equal sourceEvaluationCount',
    );
  }
  const obsSum = OBSERVATION_CLASS_VALUES.reduce(
    (acc, c) => acc + observationClassCounts[c],
    0,
  );
  if (obsSum !== sourceEvaluationCount) {
    fail(
      'AGGREGATE_INTERNAL_INVARIANT',
      'sum(observationClassCounts) must equal sourceEvaluationCount',
    );
  }

  const computedId = computeEvaluationPerformanceAggregateId({
    cohort,
    evaluationIds: sorted.map((v) => v.evaluationId),
  });
  if (input.aggregateId !== undefined) {
    assertCanonicalUuid(input.aggregateId, 'aggregateId');
    if (input.aggregateId !== computedId) {
      fail(
        'AGGREGATE_ID_MISMATCH',
        'Caller aggregateId does not match deterministic identity',
        { expected: computedId, actual: input.aggregateId },
      );
    }
  }

  const sourceEvaluationRefs = Object.freeze(
    sorted.map((v) =>
      deepFreeze({
        evaluationId: v.evaluationId,
        contractVersion: v.contractVersion,
        evaluationStatus: v.evaluationStatus,
        observationClass: v.observationClass,
        policyVersion: v.policyVersion,
        methodKey: v.methodKey,
        implementationVersion: v.implementationVersion,
      })),
  );

  const artifact = {
    schemaVersion: EVALUATION_PERFORMANCE_AGGREGATE_SCHEMA_VERSION,
    contractVersion: EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
    policyVersion: EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
    artifactType: EVALUATION_PERFORMANCE_AGGREGATE_ARTIFACT_TYPE,
    authorityClass: EVALUATION_PERFORMANCE_AGGREGATE_AUTHORITY_CLASS,
    sliceId: EVALUATION_PERFORMANCE_AGGREGATE_SLICE_ID,
    aggregateId: computedId,
    recordedAt,
    cohort: deepFreeze({ ...cohort }),
    sourceEvaluationRefs,
    counts: deepFreeze({
      sourceEvaluationCount,
      evaluationStatusCounts: deepFreeze({ ...evaluationStatusCounts }),
      observationClassCounts: deepFreeze({ ...observationClassCounts }),
      directionalComparableCount,
      directionalNonComparableCount,
      matchCount,
      mismatchCount,
    }),
    performanceRatios: deepFreeze({
      matchRatio: buildRatio(matchCount, directionalComparableCount),
      mismatchRatio: buildRatio(mismatchCount, directionalComparableCount),
    }),
    timeCoverage: deepFreeze({
      earliestEvaluationRecordedAt: earliestSource,
      latestEvaluationRecordedAt: latestSource,
    }),
    versions: deepFreeze({
      schemaVersion: EVALUATION_PERFORMANCE_AGGREGATE_SCHEMA_VERSION,
      contractVersion: EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
      policyVersion: EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
      implementationVersion: EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
      sourceEvaluationContractVersion: cohort.contractVersion,
      sourceEvaluationPolicyVersion: cohort.policyVersion,
      sourceEvaluationMethodKey: cohort.methodKey,
      sourceEvaluationMethodImplementationVersion: cohort.implementationVersion,
    }),
    provenance: buildProvenance(recordedAt, input.provenance),
    limitations: normalizeLimitations(input.limitations),
    sideEffects: deepFreeze({ ...ZERO_AGGREGATE_SIDE_EFFECTS }),
    ownershipRole: EVALUATION_PERFORMANCE_AGGREGATE_OWNERSHIP_ROLE,
    isSourceOfTruth: EVALUATION_PERFORMANCE_AGGREGATE_IS_SOURCE_OF_TRUTH,
    implementationVersion: EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
    sourceEvaluationSot: 'READ_REFERENCE_ONLY',
    evaluationSotQueryAuthority: false,
    callerSuppliedAggregateAuthority: false,
    emptyMatchPerformanceBypass: 'CLOSED',
    sampleSufficiencyPolicy: 'DEFERRED',
    regimeIdentityCanonical: false,
    regimeSegmentation: 'DEFERRED',
    ...Object.fromEntries(HARD_FLAG_KEYS.map((k) => [k, false])),
  };

  const artifactBytes = utf8ByteLength(JSON.stringify(artifact));
  if (artifactBytes > MAX_AGGREGATE_ARTIFACT_UTF8_BYTES) {
    fail('AGGREGATE_ARTIFACT_TOO_LARGE', 'artifact exceeds size bound', {
      bytes: artifactBytes,
      max: MAX_AGGREGATE_ARTIFACT_UTF8_BYTES,
    });
  }

  return deepFreeze(artifact);
}

/**
 * Validate a built Aggregate artifact by re-deriving from its thin source
 * refs' corresponding full Evaluation artifacts when provided via
 * `sourceEvaluations`, OR by structural validation of a previously built
 * artifact when `evaluations` are re-supplied.
 *
 * Preferred path: pass the same shape as build (evaluations + recordedAt) —
 * validation re-builds and compares identity.
 *
 * Alternative: pass `{ artifact, evaluations }` to assert the artifact matches
 * a fresh rebuild from the same Evaluation set.
 */
export function validateArtemisEvaluationPerformanceAggregate(input) {
  if (!isPlainObject(input)) {
    fail('AGGREGATE_INVALID_INPUT', 'input must be a plain object');
  }

  // Path A: build-input shape → rebuild and return
  if (Array.isArray(input.evaluations) && input.artifact === undefined) {
    return buildArtemisEvaluationPerformanceAggregate(input);
  }

  // Path B: { artifact, evaluations } → rebuild and compare identity + counts
  if (isPlainObject(input.artifact) && Array.isArray(input.evaluations)) {
    const rebuilt = buildArtemisEvaluationPerformanceAggregate({
      evaluations: input.evaluations,
      recordedAt: input.recordedAt ?? input.artifact.recordedAt,
      limitations: input.limitations,
      provenance: input.provenance,
    });
    assertBuiltArtifactStructure(input.artifact);
    if (input.artifact.aggregateId !== rebuilt.aggregateId) {
      fail('AGGREGATE_ID_MISMATCH', 'artifact aggregateId does not match rebuild');
    }
    if (
      input.artifact.counts.matchCount !== rebuilt.counts.matchCount
      || input.artifact.counts.mismatchCount !== rebuilt.counts.mismatchCount
      || input.artifact.counts.directionalComparableCount
        !== rebuilt.counts.directionalComparableCount
    ) {
      fail(
        'AGGREGATE_COUNT_MISMATCH',
        'artifact directional counts do not match rebuild from source Evaluations',
      );
    }
    return deepFreeze(input.artifact);
  }

  // Path C: structural-only on a claimed artifact (must still not trust counts
  // without source Evaluations — reject)
  if (isPlainObject(input.artifact) && input.evaluations === undefined) {
    fail(
      'AGGREGATE_SOURCE_EVALUATIONS_REQUIRED',
      'Validation requires source Evaluations; caller counts are non-authoritative',
    );
  }

  fail(
    'AGGREGATE_INVALID_VALIDATE_INPUT',
    'validate requires build-input or { artifact, evaluations }',
  );
}

function assertBuiltArtifactStructure(artifact) {
  if (!isPlainObject(artifact)) {
    fail('AGGREGATE_INVALID_ARTIFACT', 'artifact must be a plain object');
  }
  assertAllowlist(
    artifact,
    TOP_LEVEL_ALLOWLIST,
    'AGGREGATE_UNKNOWN_FIELD',
    'artifact',
  );
  assertExactString(
    artifact.schemaVersion,
    EVALUATION_PERFORMANCE_AGGREGATE_SCHEMA_VERSION,
    'artifact.schemaVersion',
  );
  assertExactString(
    artifact.contractVersion,
    EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
    'artifact.contractVersion',
  );
  assertExactString(
    artifact.policyVersion,
    EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
    'artifact.policyVersion',
  );
  assertExactString(
    artifact.artifactType,
    EVALUATION_PERFORMANCE_AGGREGATE_ARTIFACT_TYPE,
    'artifact.artifactType',
  );
  assertExactString(
    artifact.authorityClass,
    EVALUATION_PERFORMANCE_AGGREGATE_AUTHORITY_CLASS,
    'artifact.authorityClass',
  );
  assertExactString(
    artifact.sliceId,
    EVALUATION_PERFORMANCE_AGGREGATE_SLICE_ID,
    'artifact.sliceId',
  );
  assertCanonicalUuid(artifact.aggregateId, 'artifact.aggregateId');
  assertIsoTimestamp(artifact.recordedAt, 'artifact.recordedAt');
  if (artifact.isSourceOfTruth !== false) {
    fail('AGGREGATE_SOT_FLAG', 'isSourceOfTruth must be false');
  }
  if (!isPlainObject(artifact.sideEffects)) {
    fail('AGGREGATE_SIDE_EFFECTS', 'sideEffects required');
  }
  for (const key of SIDE_EFFECT_KEYS) {
    if (!(key in artifact.sideEffects)) {
      fail('AGGREGATE_SIDE_EFFECTS', `sideEffects.${key} missing`);
    }
    if (artifact.sideEffects[key] !== 0) {
      fail('AGGREGATE_SIDE_EFFECTS', `sideEffects.${key} must be 0`);
    }
  }
  for (const key of HARD_FLAG_KEYS) {
    if (!(key in artifact)) {
      fail('AGGREGATE_HARD_FLAG', `${key} missing`);
    }
    if (artifact[key] !== false) {
      fail('AGGREGATE_HARD_FLAG', `${key} must be false`);
    }
  }
  if (!isPlainObject(artifact.counts)) {
    fail('AGGREGATE_INVALID_COUNTS', 'counts required');
  }
  assertAllowlist(
    artifact.counts,
    COUNTS_ALLOWLIST,
    'AGGREGATE_UNKNOWN_FIELD',
    'counts',
  );
  if (!isPlainObject(artifact.performanceRatios)) {
    fail('AGGREGATE_INVALID_RATIOS', 'performanceRatios required');
  }
  assertAllowlist(
    artifact.performanceRatios,
    PERFORMANCE_RATIOS_ALLOWLIST,
    'AGGREGATE_UNKNOWN_FIELD',
    'performanceRatios',
  );
  for (const ratioKey of PERFORMANCE_RATIOS_ALLOWLIST) {
    const ratio = artifact.performanceRatios[ratioKey];
    if (!isPlainObject(ratio)) {
      fail('AGGREGATE_INVALID_RATIOS', `${ratioKey} must be plain object`);
    }
    assertAllowlist(
      ratio,
      Object.freeze(['numerator', 'denominator', 'status', 'reason']),
      'AGGREGATE_UNKNOWN_FIELD',
      ratioKey,
    );
    assertNonNegativeInteger(ratio.numerator, `${ratioKey}.numerator`);
    assertNonNegativeInteger(ratio.denominator, `${ratioKey}.denominator`);
    if (!RATIO_STATUS_SET.has(ratio.status)
      && ratio.status !== AGGREGATE_RATIO_STATUS.UNAVAILABLE) {
      // status must be AVAILABLE or UNAVAILABLE
      if (ratio.status !== AGGREGATE_RATIO_STATUS.AVAILABLE
        && ratio.status !== AGGREGATE_RATIO_STATUS.UNAVAILABLE) {
        fail('AGGREGATE_INVALID_RATIO_STATUS', `${ratioKey}.status invalid`);
      }
    }
    if (typeof ratio.numerator === 'number' && !Number.isFinite(ratio.numerator)) {
      fail('AGGREGATE_NAN_INFINITY', `${ratioKey}.numerator is not finite`);
    }
    if (typeof ratio.denominator === 'number' && !Number.isFinite(ratio.denominator)) {
      fail('AGGREGATE_NAN_INFINITY', `${ratioKey}.denominator is not finite`);
    }
  }
  if (!Array.isArray(artifact.sourceEvaluationRefs)) {
    fail('AGGREGATE_INVALID_SOURCE_REFS', 'sourceEvaluationRefs must be an array');
  }
  for (const ref of artifact.sourceEvaluationRefs) {
    if (!isPlainObject(ref)) {
      fail('AGGREGATE_INVALID_SOURCE_REFS', 'source ref must be plain object');
    }
    assertAllowlist(
      ref,
      SOURCE_REF_ALLOWLIST,
      'AGGREGATE_UNKNOWN_FIELD',
      'sourceEvaluationRef',
    );
  }
  if (!isPlainObject(artifact.cohort)) {
    fail('AGGREGATE_INVALID_COHORT', 'cohort required');
  }
  assertAllowlist(
    artifact.cohort,
    COHORT_ALLOWLIST,
    'AGGREGATE_UNKNOWN_FIELD',
    'cohort',
  );
  for (const banned of ['regime', 'agentRole', 'analysisHorizon']) {
    if (Object.prototype.hasOwnProperty.call(artifact.cohort, banned)) {
      fail('AGGREGATE_REGIME_INVENTED', `cohort must not contain ${banned}`);
    }
  }
  if (artifact.sampleSufficiencyPolicy !== 'DEFERRED') {
    fail(
      'AGGREGATE_SAMPLE_SUFFICIENCY',
      'sampleSufficiencyPolicy must be DEFERRED',
    );
  }
  if (artifact.regimeIdentityCanonical !== false) {
    fail('AGGREGATE_REGIME_INVENTED', 'regimeIdentityCanonical must be false');
  }
  if (artifact.callerSuppliedAggregateAuthority !== false) {
    fail(
      'AGGREGATE_CALLER_AUTHORITY_FORBIDDEN',
      'callerSuppliedAggregateAuthority must be false',
    );
  }
}

export default {
  EVALUATION_PERFORMANCE_AGGREGATE_SCHEMA_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_ARTIFACT_TYPE,
  EVALUATION_PERFORMANCE_AGGREGATE_AUTHORITY_CLASS,
  EVALUATION_PERFORMANCE_AGGREGATE_SLICE_ID,
  EVALUATION_PERFORMANCE_AGGREGATE_WRITER,
  EVALUATION_PERFORMANCE_AGGREGATE_METHOD_KEY,
  EVALUATION_PERFORMANCE_AGGREGATE_OWNERSHIP_ROLE,
  EVALUATION_PERFORMANCE_AGGREGATE_IS_SOURCE_OF_TRUTH,
  AGGREGATE_RATIO_STATUS,
  COMPARABLE_DIRECTIONS,
  COMPARABLE_DIRECTION_VALUES,
  ZERO_AGGREGATE_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS,
  AGGREGATE_LIMITATIONS,
  EvaluationPerformanceAggregateContractError,
  buildArtemisEvaluationPerformanceAggregate,
  validateArtemisEvaluationPerformanceAggregate,
  computeEvaluationPerformanceAggregateId,
};
