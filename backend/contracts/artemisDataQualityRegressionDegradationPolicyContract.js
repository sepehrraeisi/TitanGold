/**
 * Artemis Data Quality / Regression / Degradation Policy Contract Boundary
 *
 * Stage 10 — Calibration and Promotion Framework
 * Exact slice: S10-DATA-QUALITY-REGRESSION-DEGRADATION-POLICY-CONTRACT
 * Official name: ARTEMIS_DATA_QUALITY_REGRESSION_DEGRADATION_POLICY_CONTRACT
 *
 * Deterministic, library-only, non-SoT policy semantic/validation boundary.
 *
 * V1 state model: STABLE · DEGRADED · REGRESSION_UNAVAILABLE
 * Numeric regression model: NONE
 * New thresholds: NONE (Sample Sufficiency min=50 remains separate)
 * DQ usable gate: availability === AVAILABLE AND freshnessStatus ∈ {FRESH, AGED}
 * Baseline: EXPLICIT_CANONICAL_COMPATIBLE_REFERENCE_ONLY
 * Recovery: memoryless deterministic (no cooldown / hysteresis / grace)
 * Calibration: DORMANT / SEPARATE
 *
 * Hard flags remain false. Zero side-effect ledger. Deep freeze.
 * No Promotion / Demotion / Trust mutation / Calibration execution.
 * PRODUCTION_RUNTIME_REACHABLE = NO. IS_SOURCE_OF_TRUTH = false.
 */

import { createHash } from 'node:crypto';
import {
  AVAILABILITY,
  FRESHNESS_STATUS,
} from './artemisEvidenceContract.js';
import { TRUST_ELIGIBILITY_STATUS } from './artemisTrustWeightingPolicyContract.js';
import { SUFFICIENCY_VERDICT } from './artemisSampleSufficiencyPolicyContract.js';

// ─── Identity / versioning ───────────────────────────────────────────────────

export const DQ_REGRESSION_DEGRADATION_POLICY_SCHEMA_VERSION = '1.0.0';
export const DQ_REGRESSION_DEGRADATION_POLICY_CONTRACT_VERSION =
  'artemis-dq-regression-degradation-policy-1.0.0';
export const DQ_REGRESSION_DEGRADATION_POLICY_POLICY_VERSION =
  'artemis-dq-regression-degradation-policy-1.0.0';
export const DQ_REGRESSION_DEGRADATION_POLICY_IMPLEMENTATION_VERSION = '1.0.0';

export const DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_TYPE =
  'ARTEMIS_DATA_QUALITY_REGRESSION_DEGRADATION_POLICY';
export const DQ_REGRESSION_DEGRADATION_POLICY_TYPE =
  'DATA_QUALITY_REGRESSION_DEGRADATION_POLICY';
export const DQ_REGRESSION_DEGRADATION_POLICY_AUTHORITY_CLASS =
  'OUTCOME_EVALUATION';
export const DQ_REGRESSION_DEGRADATION_POLICY_RISK_TIER = 'Tier 3';
export const DQ_REGRESSION_DEGRADATION_POLICY_SLICE_ID =
  'S10-DATA-QUALITY-REGRESSION-DEGRADATION-POLICY-CONTRACT';
export const DQ_REGRESSION_DEGRADATION_POLICY_OFFICIAL_NAME =
  'ARTEMIS_DATA_QUALITY_REGRESSION_DEGRADATION_POLICY_CONTRACT';
export const DQ_REGRESSION_DEGRADATION_POLICY_OWNERSHIP_ROLE =
  'VALIDATION_BOUNDARY';
export const DQ_REGRESSION_DEGRADATION_POLICY_IS_SOURCE_OF_TRUTH = false;
export const DQ_REGRESSION_DEGRADATION_POLICY_WRITER = false;
export const DQ_REGRESSION_DEGRADATION_POLICY_METHOD_KEY =
  'artemis.dq_regression_degradation_policy.v1';
export const DQ_REGRESSION_DEGRADATION_POLICY_STAGE =
  'ARTEMIS_CORE_STAGE_10';

export const DQ_REGRESSION_DEGRADATION_POLICY_OWNER =
  'artemisDataQualityRegressionDegradationPolicyContract';

// ─── V1 semantic constants ───────────────────────────────────────────────────

/** Canonical V1 policy states. */
export const POLICY_STATE = Object.freeze({
  STABLE: 'STABLE',
  DEGRADED: 'DEGRADED',
  REGRESSION_UNAVAILABLE: 'REGRESSION_UNAVAILABLE',
});
export const POLICY_STATE_VALUES = Object.freeze(Object.values(POLICY_STATE));

/** States eligible as explicit reference baselines (not REGRESSION_UNAVAILABLE). */
export const REFERENCE_ELIGIBLE_STATES = Object.freeze([
  POLICY_STATE.STABLE,
  POLICY_STATE.DEGRADED,
]);

export const NUMERIC_REGRESSION_MODEL = 'NONE';
export const NEW_THRESHOLDS = 'NONE';
export const BASELINE_MODEL = 'EXPLICIT_CANONICAL_COMPATIBLE_REFERENCE_ONLY';
export const RECOVERY_MODEL = 'MEMORYLESS_DETERMINISTIC';
export const CALIBRATION_SUFFICIENCY = 'DORMANT / SEPARATE';

/** DQ usable gate: AVAILABLE + (FRESH | AGED). AGED remains eligible. */
export const DQ_USABLE_AVAILABILITY = AVAILABILITY.AVAILABLE;
export const DQ_USABLE_FRESHNESS = Object.freeze([
  FRESHNESS_STATUS.FRESH,
  FRESHNESS_STATUS.AGED,
]);

export const AUTHORIZED_TRUST_ELIGIBILITY_STATUSES = Object.freeze([
  TRUST_ELIGIBILITY_STATUS.TRUST_ELIGIBLE,
  TRUST_ELIGIBILITY_STATUS.NOT_TRUST_ELIGIBLE,
  TRUST_ELIGIBILITY_STATUS.TRUST_UNAVAILABLE,
]);

export const AUTHORIZED_SAMPLE_SUFFICIENCY_VERDICTS = Object.freeze([
  SUFFICIENCY_VERDICT.SUFFICIENT,
  SUFFICIENCY_VERDICT.INSUFFICIENT,
  SUFFICIENCY_VERDICT.UNAVAILABLE,
]);

export const AUTHORIZED_AVAILABILITY_VALUES = Object.freeze(
  Object.values(AVAILABILITY),
);
export const AUTHORIZED_FRESHNESS_VALUES = Object.freeze(
  Object.values(FRESHNESS_STATUS),
);

/** Canonical segment dimensions (inherited; do not invent). */
export const AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS = Object.freeze([
  'venue',
  'marketType',
  'symbol',
  'timeframe',
]);
export const CANONICAL_SEGMENT_DIMENSION_ORDER = Object.freeze([
  'venue',
  'marketType',
  'symbol',
  'timeframe',
]);
export const CANONICAL_VERSION_BINDING_FIELDS = Object.freeze([
  'contractVersion',
  'policyVersion',
  'implementationVersion',
]);
export const COHORT_DESCRIPTOR_ALLOWLIST = Object.freeze([
  ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  ...CANONICAL_VERSION_BINDING_FIELDS,
]);

export const UNSUPPORTED_SEGMENTATION_DIMENSIONS = Object.freeze([
  'regime',
  'marketRegime',
  'volatilityRegime',
  'bullRegime',
  'bearRegime',
  'liquidityRegime',
  'agentRole',
  'agentId',
  'analysisHorizon',
]);

export const REGIME_IDENTITY_CANONICAL = false;
export const REGIME_CLASSIFIER = false;
export const REGIME_CREATION = false;

export const GLOBAL_AVERAGE_ONLY = 'NOT_SUFFICIENT_FOR_STAGE10';
export const GLOBAL_AVERAGE_ONLY_BYPASS = 'CLOSED';

export const TRUST_MUTATION = false;
export const PROMOTION = 'NOT_AUTHORIZED';
export const DEMOTION = 'NOT_AUTHORIZED';
export const PROMOTION_EXECUTION = false;
export const DEMOTION_EXECUTION = false;
export const CALIBRATION_EXECUTION = false;
export const BINARY_BRIER_EXECUTION = false;

// ─── Forbidden caller authority fields ───────────────────────────────────────

export const FORBIDDEN_SCORE_FIELDS = Object.freeze([
  'qualityScore',
  'healthScore',
  'stabilityScore',
  'regressionScore',
  'degradationScore',
]);

export const FORBIDDEN_THRESHOLD_FIELDS = Object.freeze([
  'regressionThreshold',
  'degradationThreshold',
  'minimumN',
  'threshold',
  'minEligibleObservations',
]);

export const FORBIDDEN_LIFECYCLE_FIELDS = Object.freeze([
  'promotionStatus',
  'demotionStatus',
  'lifecycleMutation',
  'promotionEligible',
  'demotionEligible',
  'severity',
  'cooldown',
  'hysteresis',
  'recoveryWindow',
  'gracePeriod',
  'decay',
  'consecutiveObservationCount',
]);

export const FORBIDDEN_AUTHORITY_OVERRIDE_FIELDS = Object.freeze([
  'policyState',
  'sufficient',
  'insufficient',
  'stable',
  'degraded',
  'authorityClass',
  'sliceId',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
  'schemaVersion',
  'isSourceOfTruth',
]);

export const FORBIDDEN_SECRET_FIELDS = Object.freeze([
  'apiKey',
  'apiSecret',
  'secret',
  'token',
  'password',
  'privateKey',
  'authorization',
  'jwt',
]);

export const FORBIDDEN_RUNTIME_PERSISTENCE_FIELDS = Object.freeze([
  'dbWrite',
  'redisWrite',
  'networkCall',
  'providerCall',
  'persist',
  'migrate',
  'deploy',
]);

// ─── Hard flags / side-effect ledger ─────────────────────────────────────────

export const REQUIRED_HARD_FLAGS = Object.freeze({
  isSourceOfTruth: false,
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
  binaryBrierExecution: false,
  financialExecution: false,
  executionEligible: false,
  decisionEligible: false,
});

export const ZERO_DQ_REGRESSION_DEGRADATION_POLICY_SIDE_EFFECTS = Object.freeze({
  networkCallCount: 0,
  providerCallCount: 0,
  dbWriteCount: 0,
  liveDbMigrationCount: 0,
  redisWriteCount: 0,
  llmCallCount: 0,
  orderCount: 0,
  walletMutationCount: 0,
  financialExecutionCount: 0,
  runtimeMutationCount: 0,
  workerMutationCount: 0,
  schedulerMutationCount: 0,
  feederMutationCount: 0,
  b10MutationCount: 0,
  calibrationExecutionCount: 0,
  binaryBrierExecutionCount: 0,
  trustWeightMutationCount: 0,
  promotionExecutionCount: 0,
  demotionExecutionCount: 0,
  thresholdInventionCount: 0,
  sampleSizeInventionCount: 0,
  regimeInventionCount: 0,
  numericRegressionEvaluationCount: 0,
});

export const DQ_REGRESSION_DEGRADATION_POLICY_LIMITATIONS = Object.freeze([
  'LIBRARY_ONLY_NON_SOT_VALIDATION_BOUNDARY',
  'NUMERIC_REGRESSION_MODEL_NONE',
  'NEW_THRESHOLDS_NONE',
  'SAMPLE_SUFFICIENCY_MINIMUM_REMAINS_SEPARATE',
  'BASELINE_EXPLICIT_CANONICAL_COMPATIBLE_REFERENCE_ONLY',
  'NO_IMPLICIT_ROLLING_OR_GLOBAL_AVERAGE_BASELINE',
  'RECOVERY_MEMORYLESS_DETERMINISTIC',
  'NO_COOLDOWN_HYSTERESIS_GRACE_DECAY',
  'CALIBRATION_SUFFICIENCY_DORMANT_SEPARATE',
  'NO_TRUST_MUTATION',
  'NO_PROMOTION_EXECUTION',
  'NO_DEMOTION_EXECUTION',
  'NO_CALIBRATION_EXECUTION',
  'NO_PERSISTENCE',
  'NO_RUNTIME_ACTIVATION',
  'PRODUCTION_RUNTIME_REACHABLE_NO',
]);

// ─── Allowlists ──────────────────────────────────────────────────────────────

export const INPUT_ALLOWLIST = Object.freeze([
  'trustEligibilityStatus',
  'sampleSufficiencyVerdict',
  'dataQuality',
  'cohort',
  'reference',
  'comparisonRequested',
  'recordedAt',
]);

export const DATA_QUALITY_ALLOWLIST = Object.freeze([
  'availability',
  'freshnessStatus',
]);

export const REFERENCE_ALLOWLIST = Object.freeze([
  'policyState',
  'cohort',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
]);

export const ARTIFACT_ALLOWLIST = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'policyType',
  'authorityClass',
  'sliceId',
  'officialName',
  'ownershipRole',
  'isSourceOfTruth',
  'writer',
  'methodKey',
  'stage',
  'policyId',
  'recordedAt',
  'policyState',
  'currentState',
  'referenceState',
  'comparisonPerformed',
  'comparisonUnavailableReason',
  'degradationReasons',
  'cohort',
  'trustEligibilityStatus',
  'sampleSufficiencyVerdict',
  'dataQuality',
  'dqUsable',
  'numericRegressionModel',
  'newThresholds',
  'baselineModel',
  'recoveryModel',
  'calibrationSufficiency',
  'limitations',
  'hardFlags',
  'sideEffects',
  'implementationVersion',
]);

export const DQ_REGRESSION_DEGRADATION_POLICY_DESCRIPTOR = Object.freeze({
  schemaVersion: DQ_REGRESSION_DEGRADATION_POLICY_SCHEMA_VERSION,
  contractVersion: DQ_REGRESSION_DEGRADATION_POLICY_CONTRACT_VERSION,
  policyVersion: DQ_REGRESSION_DEGRADATION_POLICY_POLICY_VERSION,
  artifactType: DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_TYPE,
  policyType: DQ_REGRESSION_DEGRADATION_POLICY_TYPE,
  authorityClass: DQ_REGRESSION_DEGRADATION_POLICY_AUTHORITY_CLASS,
  riskTier: DQ_REGRESSION_DEGRADATION_POLICY_RISK_TIER,
  sliceId: DQ_REGRESSION_DEGRADATION_POLICY_SLICE_ID,
  officialName: DQ_REGRESSION_DEGRADATION_POLICY_OFFICIAL_NAME,
  ownershipRole: DQ_REGRESSION_DEGRADATION_POLICY_OWNERSHIP_ROLE,
  isSourceOfTruth: DQ_REGRESSION_DEGRADATION_POLICY_IS_SOURCE_OF_TRUTH,
  writer: DQ_REGRESSION_DEGRADATION_POLICY_WRITER,
  methodKey: DQ_REGRESSION_DEGRADATION_POLICY_METHOD_KEY,
  stage: DQ_REGRESSION_DEGRADATION_POLICY_STAGE,
  owner: DQ_REGRESSION_DEGRADATION_POLICY_OWNER,
  policyStateModel: POLICY_STATE,
  numericRegressionModel: NUMERIC_REGRESSION_MODEL,
  newThresholds: NEW_THRESHOLDS,
  baselineModel: BASELINE_MODEL,
  recoveryModel: RECOVERY_MODEL,
  calibrationSufficiency: CALIBRATION_SUFFICIENCY,
  dqUsableAvailability: DQ_USABLE_AVAILABILITY,
  dqUsableFreshness: DQ_USABLE_FRESHNESS,
  authorizedCanonicalSegmentDimensions: AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  regimeIdentityCanonical: REGIME_IDENTITY_CANONICAL,
  globalAverageOnlyBypass: GLOBAL_AVERAGE_ONLY_BYPASS,
  trustMutation: TRUST_MUTATION,
  promotion: PROMOTION,
  demotion: DEMOTION,
  promotionExecution: PROMOTION_EXECUTION,
  demotionExecution: DEMOTION_EXECUTION,
  calibrationExecution: CALIBRATION_EXECUTION,
  binaryBrierExecution: BINARY_BRIER_EXECUTION,
  hardFlags: REQUIRED_HARD_FLAGS,
  sideEffects: ZERO_DQ_REGRESSION_DEGRADATION_POLICY_SIDE_EFFECTS,
  limitations: DQ_REGRESSION_DEGRADATION_POLICY_LIMITATIONS,
  implementationVersion: DQ_REGRESSION_DEGRADATION_POLICY_IMPLEMENTATION_VERSION,
});

// ─── Error ───────────────────────────────────────────────────────────────────

export class DataQualityRegressionDegradationPolicyContractError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'DataQualityRegressionDegradationPolicyContractError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = null) {
  throw new DataQualityRegressionDegradationPolicyContractError(
    code,
    message,
    details,
  );
}

// ─── Freeze / identity helpers ───────────────────────────────────────────────

function freezeDeep(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Object.isFrozen(value)) {
    // Still walk frozen parents — children may be mutable.
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      freezeDeep(value[i]);
    }
  } else {
    for (const key of Reflect.ownKeys(value)) {
      freezeDeep(value[key]);
    }
  }
  return Object.freeze(value);
}

function assertPlainObject(value, code, message) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(code, message);
  }
}

function assertAllowlist(obj, allowlist, code, context) {
  const allowed = new Set(allowlist);
  for (const key of Reflect.ownKeys(obj)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      fail(code, `Unknown field "${String(key)}" on ${context}`, {
        context,
        field: String(key),
      });
    }
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const keys = Reflect.ownKeys(value)
    .filter((k) => typeof k === 'string')
    .sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}

function hashToUuid(material) {
  const digest = createHash('sha256').update(material, 'utf8').digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonicalNowIso(recordedAt) {
  if (recordedAt === undefined || recordedAt === null) {
    return new Date(0).toISOString();
  }
  if (typeof recordedAt !== 'string' || Number.isNaN(Date.parse(recordedAt))) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_RECORDED_AT_INVALID',
      'recordedAt must be a valid ISO-8601 timestamp string when provided',
    );
  }
  return recordedAt;
}

// ─── Forbidden field scanning ────────────────────────────────────────────────

function scanForbiddenKeys(obj, forbiddenList, code, context, depth = 0) {
  if (obj === null || typeof obj !== 'object' || depth > 8) {
    return;
  }
  const forbidden = new Set(forbiddenList);
  for (const key of Reflect.ownKeys(obj)) {
    if (typeof key === 'string' && forbidden.has(key)) {
      fail(code, `Forbidden field "${key}" on ${context}`, {
        context,
        field: key,
      });
    }
    const child = obj[key];
    if (child !== null && typeof child === 'object') {
      scanForbiddenKeys(child, forbiddenList, code, `${context}.${key}`, depth + 1);
    }
  }
}

function assertNoCallerAuthorityOverrides(input) {
  for (const key of FORBIDDEN_AUTHORITY_OVERRIDE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'DQ_REGRESSION_DEGRADATION_POLICY_CALLER_AUTHORITY_OVERRIDE',
        `Caller authority override field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_SCORE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'DQ_REGRESSION_DEGRADATION_POLICY_CALLER_SCORE_FIELD',
        `Caller score field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_THRESHOLD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'DQ_REGRESSION_DEGRADATION_POLICY_CALLER_THRESHOLD_FIELD',
        `Caller threshold field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_LIFECYCLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'DQ_REGRESSION_DEGRADATION_POLICY_CALLER_LIFECYCLE_FIELD',
        `Caller lifecycle field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  scanForbiddenKeys(
    input,
    FORBIDDEN_SECRET_FIELDS,
    'DQ_REGRESSION_DEGRADATION_POLICY_SECRET_FIELD_REJECTED',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_RUNTIME_PERSISTENCE_FIELDS,
    'DQ_REGRESSION_DEGRADATION_POLICY_RUNTIME_PERSISTENCE_FIELD_REJECTED',
    'input',
  );
  // Deep-scan scores / thresholds / lifecycle that may appear nested.
  scanForbiddenKeys(
    input,
    FORBIDDEN_SCORE_FIELDS,
    'DQ_REGRESSION_DEGRADATION_POLICY_CALLER_SCORE_FIELD',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_THRESHOLD_FIELDS,
    'DQ_REGRESSION_DEGRADATION_POLICY_CALLER_THRESHOLD_FIELD',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_LIFECYCLE_FIELDS,
    'DQ_REGRESSION_DEGRADATION_POLICY_CALLER_LIFECYCLE_FIELD',
    'input',
  );
}

function assertNoUnsupportedSegmentation(obj, context) {
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  for (const key of Reflect.ownKeys(obj)) {
    if (
      typeof key === 'string' &&
      UNSUPPORTED_SEGMENTATION_DIMENSIONS.includes(key)
    ) {
      fail(
        'DQ_REGRESSION_DEGRADATION_POLICY_UNSUPPORTED_SEGMENT_DIMENSION',
        `Unsupported segmentation dimension "${key}" on ${context}`,
        { context, dimension: key },
      );
    }
  }
}

// ─── Cohort ──────────────────────────────────────────────────────────────────

function extractCohort(cohortInput) {
  assertPlainObject(
    cohortInput,
    'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_INVALID',
    'cohort must be a plain object',
  );
  assertNoUnsupportedSegmentation(cohortInput, 'cohort');
  assertAllowlist(
    cohortInput,
    COHORT_DESCRIPTOR_ALLOWLIST,
    'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_UNKNOWN_FIELD',
    'cohort',
  );

  const cohort = {};
  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    if (!Object.prototype.hasOwnProperty.call(cohortInput, dim)) {
      fail(
        'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_DIMENSION_MISSING',
        `Missing required cohort dimension "${dim}"`,
        { dimension: dim },
      );
    }
    const value = cohortInput[dim];
    if (typeof value !== 'string' || value.trim().length === 0) {
      fail(
        'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_DIMENSION_INVALID',
        `Cohort dimension "${dim}" must be a non-empty string`,
        { dimension: dim },
      );
    }
    cohort[dim] = value;
  }

  for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(cohortInput, field)) {
      const value = cohortInput[field];
      if (
        value !== null &&
        (typeof value !== 'string' || value.trim().length === 0)
      ) {
        fail(
          'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_VERSION_BINDING_INVALID',
          `Cohort version binding "${field}" must be null or a non-empty string`,
          { field },
        );
      }
      cohort[field] = value;
    } else {
      cohort[field] = null;
    }
  }

  return Object.freeze(cohort);
}

function cohortsCompatible(a, b) {
  if (a === null || b === null) {
    return false;
  }
  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    if (a[dim] !== b[dim]) {
      return false;
    }
  }
  for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
    const av = a[field] ?? null;
    const bv = b[field] ?? null;
    if (av !== bv) {
      return false;
    }
  }
  return true;
}

function versionsCompatible(ref, currentVersions) {
  for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
    const rv = ref[field] ?? null;
    const cv = currentVersions[field] ?? null;
    if (rv !== null && cv !== null && rv !== cv) {
      return false;
    }
  }
  return true;
}

// ─── Input validation ────────────────────────────────────────────────────────

function validateTrustEligibilityStatus(status) {
  if (status === undefined || status === null) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_TRUST_STATUS_MISSING',
      'trustEligibilityStatus is required',
    );
  }
  if (typeof status !== 'string') {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_TRUST_STATUS_MALFORMED',
      'trustEligibilityStatus must be a string',
    );
  }
  if (!AUTHORIZED_TRUST_ELIGIBILITY_STATUSES.includes(status)) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_TRUST_STATUS_UNSUPPORTED',
      `Unsupported trustEligibilityStatus: ${status}`,
      { trustEligibilityStatus: status },
    );
  }
  return status;
}

function validateSampleSufficiencyVerdict(verdict) {
  if (verdict === undefined || verdict === null) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_SAMPLE_SUFFICIENCY_MISSING',
      'sampleSufficiencyVerdict is required',
    );
  }
  if (typeof verdict !== 'string') {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_SAMPLE_SUFFICIENCY_MALFORMED',
      'sampleSufficiencyVerdict must be a string',
    );
  }
  if (!AUTHORIZED_SAMPLE_SUFFICIENCY_VERDICTS.includes(verdict)) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_SAMPLE_SUFFICIENCY_UNSUPPORTED',
      `Unsupported sampleSufficiencyVerdict: ${verdict}`,
      { sampleSufficiencyVerdict: verdict },
    );
  }
  return verdict;
}

function validateDataQuality(dq) {
  if (dq === undefined || dq === null) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_DQ_MISSING',
      'dataQuality is required',
    );
  }
  if (
    typeof dq !== 'object' ||
    Array.isArray(dq) ||
    Object.getPrototypeOf(dq) !== Object.prototype
  ) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_DQ_MALFORMED',
      'dataQuality must be a plain object',
    );
  }
  assertAllowlist(
    dq,
    DATA_QUALITY_ALLOWLIST,
    'DQ_REGRESSION_DEGRADATION_POLICY_DQ_UNKNOWN_FIELD',
    'dataQuality',
  );

  if (!Object.prototype.hasOwnProperty.call(dq, 'availability')) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_DQ_AVAILABILITY_MISSING',
      'dataQuality.availability is required',
    );
  }
  if (!Object.prototype.hasOwnProperty.call(dq, 'freshnessStatus')) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_DQ_FRESHNESS_MISSING',
      'dataQuality.freshnessStatus is required',
    );
  }

  const { availability, freshnessStatus } = dq;

  if (typeof availability !== 'string') {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_DQ_AVAILABILITY_MALFORMED',
      'dataQuality.availability must be a string',
    );
  }
  if (!AUTHORIZED_AVAILABILITY_VALUES.includes(availability)) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_DQ_AVAILABILITY_UNSUPPORTED',
      `Unsupported dataQuality.availability: ${availability}`,
      { availability },
    );
  }

  if (typeof freshnessStatus !== 'string') {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_DQ_FRESHNESS_MALFORMED',
      'dataQuality.freshnessStatus must be a string',
    );
  }
  if (!AUTHORIZED_FRESHNESS_VALUES.includes(freshnessStatus)) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_DQ_FRESHNESS_UNSUPPORTED',
      `Unsupported dataQuality.freshnessStatus: ${freshnessStatus}`,
      { freshnessStatus },
    );
  }

  return Object.freeze({ availability, freshnessStatus });
}

function isDqUsable(dataQuality) {
  return (
    dataQuality.availability === DQ_USABLE_AVAILABILITY &&
    DQ_USABLE_FRESHNESS.includes(dataQuality.freshnessStatus)
  );
}

function evaluateCurrentState(trustStatus, sufficiencyVerdict, dataQuality) {
  const degradationReasons = [];

  if (trustStatus !== TRUST_ELIGIBILITY_STATUS.TRUST_ELIGIBLE) {
    degradationReasons.push(`TRUST:${trustStatus}`);
  }
  if (sufficiencyVerdict !== SUFFICIENCY_VERDICT.SUFFICIENT) {
    degradationReasons.push(`SAMPLE_SUFFICIENCY:${sufficiencyVerdict}`);
  }
  if (!isDqUsable(dataQuality)) {
    if (dataQuality.availability !== DQ_USABLE_AVAILABILITY) {
      degradationReasons.push(`DQ_AVAILABILITY:${dataQuality.availability}`);
    }
    if (!DQ_USABLE_FRESHNESS.includes(dataQuality.freshnessStatus)) {
      degradationReasons.push(`DQ_FRESHNESS:${dataQuality.freshnessStatus}`);
    }
  }

  if (degradationReasons.length === 0) {
    return {
      policyState: POLICY_STATE.STABLE,
      degradationReasons: Object.freeze([]),
      dqUsable: true,
    };
  }
  return {
    policyState: POLICY_STATE.DEGRADED,
    degradationReasons: Object.freeze(degradationReasons),
    dqUsable: isDqUsable(dataQuality),
  };
}

function extractReference(referenceInput) {
  assertPlainObject(
    referenceInput,
    'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_MALFORMED',
    'reference must be a plain object',
  );
  assertAllowlist(
    referenceInput,
    REFERENCE_ALLOWLIST,
    'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_UNKNOWN_FIELD',
    'reference',
  );

  if (!Object.prototype.hasOwnProperty.call(referenceInput, 'policyState')) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_STATE_MISSING',
      'reference.policyState is required',
    );
  }
  const { policyState } = referenceInput;
  if (typeof policyState !== 'string') {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_STATE_MALFORMED',
      'reference.policyState must be a string',
    );
  }
  if (!REFERENCE_ELIGIBLE_STATES.includes(policyState)) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_STATE_UNSUPPORTED',
      `Unsupported reference.policyState: ${policyState}`,
      { policyState },
    );
  }

  if (!Object.prototype.hasOwnProperty.call(referenceInput, 'cohort')) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_COHORT_MISSING',
      'reference.cohort is required for explicit comparison',
    );
  }
  const cohort = extractCohort(referenceInput.cohort);

  const versions = {};
  for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(referenceInput, field)) {
      const value = referenceInput[field];
      if (
        value !== null &&
        (typeof value !== 'string' || value.trim().length === 0)
      ) {
        fail(
          'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_VERSION_INVALID',
          `reference.${field} must be null or a non-empty string`,
          { field },
        );
      }
      versions[field] = value;
    } else {
      versions[field] = null;
    }
  }

  return Object.freeze({
    policyState,
    cohort,
    ...versions,
  });
}

function applyRegressionComparison(currentState, reference) {
  // Memoryless: current STABLE always → STABLE; current DEGRADED → DEGRADED.
  // Reference STABLE + current DEGRADED → DEGRADED (regression observed as state).
  // Reference DEGRADED + current STABLE → STABLE (recovery).
  // No separate recovery state. No severity.
  if (currentState === POLICY_STATE.STABLE) {
    return POLICY_STATE.STABLE;
  }
  if (currentState === POLICY_STATE.DEGRADED) {
    return POLICY_STATE.DEGRADED;
  }
  // Should not reach — currentState is only STABLE|DEGRADED from evaluateCurrentState.
  return POLICY_STATE.REGRESSION_UNAVAILABLE;
}

function computePolicyId(parts) {
  return hashToUuid(
    stableStringify({
      contractVersion: DQ_REGRESSION_DEGRADATION_POLICY_CONTRACT_VERSION,
      policyVersion: DQ_REGRESSION_DEGRADATION_POLICY_POLICY_VERSION,
      implementationVersion:
        DQ_REGRESSION_DEGRADATION_POLICY_IMPLEMENTATION_VERSION,
      methodKey: DQ_REGRESSION_DEGRADATION_POLICY_METHOD_KEY,
      ...parts,
    }),
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getDataQualityRegressionDegradationPolicyDescriptor() {
  return freezeDeep({ ...DQ_REGRESSION_DEGRADATION_POLICY_DESCRIPTOR });
}

export function validateDataQualityRegressionDegradationPolicyDescriptor(
  descriptor,
) {
  assertPlainObject(
    descriptor,
    'DQ_REGRESSION_DEGRADATION_POLICY_DESCRIPTOR_INVALID',
    'descriptor must be a plain object',
  );
  const expected = DQ_REGRESSION_DEGRADATION_POLICY_DESCRIPTOR;
  for (const key of Reflect.ownKeys(expected)) {
    if (typeof key !== 'string') continue;
    if (!Object.prototype.hasOwnProperty.call(descriptor, key)) {
      fail(
        'DQ_REGRESSION_DEGRADATION_POLICY_DESCRIPTOR_FIELD_MISSING',
        `Missing descriptor field: ${key}`,
        { field: key },
      );
    }
  }
  return freezeDeep({ ...descriptor });
}

/**
 * Build a deterministic DQ / Regression / Degradation Policy artifact.
 *
 * @param {object} input
 * @param {string} input.trustEligibilityStatus
 * @param {string} input.sampleSufficiencyVerdict
 * @param {{availability:string,freshnessStatus:string}} input.dataQuality
 * @param {object} [input.cohort] — required when comparisonRequested
 * @param {object} [input.reference] — explicit reference artifact for comparison
 * @param {boolean} [input.comparisonRequested]
 * @param {string} [input.recordedAt]
 */
export function buildDataQualityRegressionDegradationPolicyArtifact(input) {
  if (input === undefined || input === null) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_INPUT_MISSING',
      'input object is required',
    );
  }
  assertPlainObject(
    input,
    'DQ_REGRESSION_DEGRADATION_POLICY_INPUT_MALFORMED',
    'input must be a plain object',
  );
  assertAllowlist(
    input,
    INPUT_ALLOWLIST,
    'DQ_REGRESSION_DEGRADATION_POLICY_INPUT_UNKNOWN_FIELD',
    'input',
  );
  assertNoCallerAuthorityOverrides(input);

  const trustEligibilityStatus = validateTrustEligibilityStatus(
    input.trustEligibilityStatus,
  );
  const sampleSufficiencyVerdict = validateSampleSufficiencyVerdict(
    input.sampleSufficiencyVerdict,
  );
  const dataQuality = validateDataQuality(input.dataQuality);

  const comparisonRequested = input.comparisonRequested === true;

  let cohort = null;
  if (
    Object.prototype.hasOwnProperty.call(input, 'cohort') &&
    input.cohort !== undefined &&
    input.cohort !== null
  ) {
    cohort = extractCohort(input.cohort);
  } else if (comparisonRequested) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_REQUIRED_FOR_COMPARISON',
      'cohort is required when comparisonRequested is true',
    );
  }

  const currentEval = evaluateCurrentState(
    trustEligibilityStatus,
    sampleSufficiencyVerdict,
    dataQuality,
  );

  let policyState = currentEval.policyState;
  let referenceState = null;
  let comparisonPerformed = false;
  let comparisonUnavailableReason = null;

  if (comparisonRequested) {
    if (
      !Object.prototype.hasOwnProperty.call(input, 'reference') ||
      input.reference === undefined ||
      input.reference === null
    ) {
      policyState = POLICY_STATE.REGRESSION_UNAVAILABLE;
      comparisonUnavailableReason = 'REFERENCE_MISSING';
    } else {
      let reference;
      try {
        reference = extractReference(input.reference);
      } catch (err) {
        if (
          err instanceof DataQualityRegressionDegradationPolicyContractError
        ) {
          // Malformed reference identity → REGRESSION_UNAVAILABLE for comparison
          // request path only when the error is identity/compatibility class;
          // unsupported/malformed authority still fail-closed via rethrow for
          // score/threshold contamination already scanned. Identity errors map
          // to REGRESSION_UNAVAILABLE.
          const unavailableCodes = new Set([
            'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_MALFORMED',
            'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_STATE_MISSING',
            'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_STATE_MALFORMED',
            'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_STATE_UNSUPPORTED',
            'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_COHORT_MISSING',
            'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_VERSION_INVALID',
            'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_INVALID',
            'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_DIMENSION_MISSING',
            'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_DIMENSION_INVALID',
            'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_VERSION_BINDING_INVALID',
            'DQ_REGRESSION_DEGRADATION_POLICY_COHORT_UNKNOWN_FIELD',
            'DQ_REGRESSION_DEGRADATION_POLICY_REFERENCE_UNKNOWN_FIELD',
            'DQ_REGRESSION_DEGRADATION_POLICY_UNSUPPORTED_SEGMENT_DIMENSION',
          ]);
          if (unavailableCodes.has(err.code)) {
            policyState = POLICY_STATE.REGRESSION_UNAVAILABLE;
            comparisonUnavailableReason = err.code;
            reference = null;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      if (reference !== null && reference !== undefined) {
        if (cohort === null) {
          policyState = POLICY_STATE.REGRESSION_UNAVAILABLE;
          comparisonUnavailableReason = 'CURRENT_COHORT_MISSING';
        } else if (!cohortsCompatible(reference.cohort, cohort)) {
          policyState = POLICY_STATE.REGRESSION_UNAVAILABLE;
          comparisonUnavailableReason = 'COHORT_IDENTITY_MISMATCH';
        } else if (
          !versionsCompatible(reference, {
            contractVersion: cohort.contractVersion,
            policyVersion: cohort.policyVersion,
            implementationVersion: cohort.implementationVersion,
          })
        ) {
          policyState = POLICY_STATE.REGRESSION_UNAVAILABLE;
          comparisonUnavailableReason = 'VERSION_INCOMPATIBLE';
        } else {
          referenceState = reference.policyState;
          policyState = applyRegressionComparison(
            currentEval.policyState,
            reference,
          );
          comparisonPerformed = true;
        }
      }
    }
  }

  const recordedAt = canonicalNowIso(input.recordedAt);

  const policyId = computePolicyId({
    policyState,
    currentState: currentEval.policyState,
    referenceState,
    comparisonPerformed,
    comparisonUnavailableReason,
    trustEligibilityStatus,
    sampleSufficiencyVerdict,
    dataQuality,
    cohort,
    degradationReasons: currentEval.degradationReasons,
  });

  const artifact = {
    schemaVersion: DQ_REGRESSION_DEGRADATION_POLICY_SCHEMA_VERSION,
    contractVersion: DQ_REGRESSION_DEGRADATION_POLICY_CONTRACT_VERSION,
    policyVersion: DQ_REGRESSION_DEGRADATION_POLICY_POLICY_VERSION,
    artifactType: DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_TYPE,
    policyType: DQ_REGRESSION_DEGRADATION_POLICY_TYPE,
    authorityClass: DQ_REGRESSION_DEGRADATION_POLICY_AUTHORITY_CLASS,
    sliceId: DQ_REGRESSION_DEGRADATION_POLICY_SLICE_ID,
    officialName: DQ_REGRESSION_DEGRADATION_POLICY_OFFICIAL_NAME,
    ownershipRole: DQ_REGRESSION_DEGRADATION_POLICY_OWNERSHIP_ROLE,
    isSourceOfTruth: DQ_REGRESSION_DEGRADATION_POLICY_IS_SOURCE_OF_TRUTH,
    writer: DQ_REGRESSION_DEGRADATION_POLICY_WRITER,
    methodKey: DQ_REGRESSION_DEGRADATION_POLICY_METHOD_KEY,
    stage: DQ_REGRESSION_DEGRADATION_POLICY_STAGE,
    policyId,
    recordedAt,
    policyState,
    currentState: currentEval.policyState,
    referenceState,
    comparisonPerformed,
    comparisonUnavailableReason,
    degradationReasons: currentEval.degradationReasons,
    cohort,
    trustEligibilityStatus,
    sampleSufficiencyVerdict,
    dataQuality,
    dqUsable: currentEval.dqUsable,
    numericRegressionModel: NUMERIC_REGRESSION_MODEL,
    newThresholds: NEW_THRESHOLDS,
    baselineModel: BASELINE_MODEL,
    recoveryModel: RECOVERY_MODEL,
    calibrationSufficiency: CALIBRATION_SUFFICIENCY,
    limitations: DQ_REGRESSION_DEGRADATION_POLICY_LIMITATIONS,
    hardFlags: { ...REQUIRED_HARD_FLAGS },
    sideEffects: { ...ZERO_DQ_REGRESSION_DEGRADATION_POLICY_SIDE_EFFECTS },
    implementationVersion:
      DQ_REGRESSION_DEGRADATION_POLICY_IMPLEMENTATION_VERSION,
  };

  return freezeDeep(artifact);
}

export function validateDataQualityRegressionDegradationPolicyArtifact(
  artifact,
) {
  assertPlainObject(
    artifact,
    'DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_INVALID',
    'artifact must be a plain object',
  );
  assertAllowlist(
    artifact,
    ARTIFACT_ALLOWLIST,
    'DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_UNKNOWN_FIELD',
    'artifact',
  );

  if (artifact.isSourceOfTruth !== false) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_SOT_MUST_BE_FALSE',
      'isSourceOfTruth must be false',
    );
  }
  if (artifact.numericRegressionModel !== NUMERIC_REGRESSION_MODEL) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_NUMERIC_MODEL_INVALID',
      'numericRegressionModel must be NONE',
    );
  }
  if (artifact.newThresholds !== NEW_THRESHOLDS) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_THRESHOLDS_INVALID',
      'newThresholds must be NONE',
    );
  }
  if (!POLICY_STATE_VALUES.includes(artifact.policyState)) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_STATE_INVALID',
      `Invalid policyState: ${artifact.policyState}`,
    );
  }

  // Rebuild equality — reconstruct from canonical semantic fields.
  const rebuildInput = {
    trustEligibilityStatus: artifact.trustEligibilityStatus,
    sampleSufficiencyVerdict: artifact.sampleSufficiencyVerdict,
    dataQuality: {
      availability: artifact.dataQuality.availability,
      freshnessStatus: artifact.dataQuality.freshnessStatus,
    },
    recordedAt: artifact.recordedAt,
  };
  if (artifact.cohort !== null && artifact.cohort !== undefined) {
    rebuildInput.cohort = { ...artifact.cohort };
  }
  if (artifact.comparisonPerformed === true || artifact.comparisonUnavailableReason !== null) {
    rebuildInput.comparisonRequested = true;
  }
  if (
    artifact.referenceState !== null &&
    artifact.referenceState !== undefined &&
    artifact.cohort !== null
  ) {
    // Rebuild reference from artifact cohort + referenceState when comparison
    // was performed successfully. When unavailable, omit reference to reproduce
    // REGRESSION_UNAVAILABLE paths.
    if (artifact.comparisonPerformed === true) {
      rebuildInput.reference = {
        policyState: artifact.referenceState,
        cohort: { ...artifact.cohort },
        contractVersion: artifact.cohort.contractVersion,
        policyVersion: artifact.cohort.policyVersion,
        implementationVersion: artifact.cohort.implementationVersion,
      };
    }
  }

  const rebuilt = buildDataQualityRegressionDegradationPolicyArtifact(
    rebuildInput,
  );

  if (rebuilt.policyId !== artifact.policyId) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_IDENTITY_MISMATCH',
      'artifact policyId does not match canonical rebuild',
    );
  }
  if (rebuilt.policyState !== artifact.policyState) {
    fail(
      'DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_STATE_MISMATCH',
      'artifact policyState does not match canonical rebuild',
    );
  }

  return rebuilt;
}

export default Object.freeze({
  DQ_REGRESSION_DEGRADATION_POLICY_SCHEMA_VERSION,
  DQ_REGRESSION_DEGRADATION_POLICY_CONTRACT_VERSION,
  DQ_REGRESSION_DEGRADATION_POLICY_POLICY_VERSION,
  DQ_REGRESSION_DEGRADATION_POLICY_IMPLEMENTATION_VERSION,
  DQ_REGRESSION_DEGRADATION_POLICY_ARTIFACT_TYPE,
  DQ_REGRESSION_DEGRADATION_POLICY_TYPE,
  DQ_REGRESSION_DEGRADATION_POLICY_AUTHORITY_CLASS,
  DQ_REGRESSION_DEGRADATION_POLICY_RISK_TIER,
  DQ_REGRESSION_DEGRADATION_POLICY_SLICE_ID,
  DQ_REGRESSION_DEGRADATION_POLICY_OFFICIAL_NAME,
  DQ_REGRESSION_DEGRADATION_POLICY_OWNERSHIP_ROLE,
  DQ_REGRESSION_DEGRADATION_POLICY_IS_SOURCE_OF_TRUTH,
  DQ_REGRESSION_DEGRADATION_POLICY_WRITER,
  DQ_REGRESSION_DEGRADATION_POLICY_METHOD_KEY,
  DQ_REGRESSION_DEGRADATION_POLICY_STAGE,
  DQ_REGRESSION_DEGRADATION_POLICY_OWNER,
  POLICY_STATE,
  POLICY_STATE_VALUES,
  REFERENCE_ELIGIBLE_STATES,
  NUMERIC_REGRESSION_MODEL,
  NEW_THRESHOLDS,
  BASELINE_MODEL,
  RECOVERY_MODEL,
  CALIBRATION_SUFFICIENCY,
  DQ_USABLE_AVAILABILITY,
  DQ_USABLE_FRESHNESS,
  AUTHORIZED_TRUST_ELIGIBILITY_STATUSES,
  AUTHORIZED_SAMPLE_SUFFICIENCY_VERDICTS,
  AUTHORIZED_AVAILABILITY_VALUES,
  AUTHORIZED_FRESHNESS_VALUES,
  AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  CANONICAL_SEGMENT_DIMENSION_ORDER,
  CANONICAL_VERSION_BINDING_FIELDS,
  COHORT_DESCRIPTOR_ALLOWLIST,
  UNSUPPORTED_SEGMENTATION_DIMENSIONS,
  REGIME_IDENTITY_CANONICAL,
  REGIME_CLASSIFIER,
  REGIME_CREATION,
  GLOBAL_AVERAGE_ONLY,
  GLOBAL_AVERAGE_ONLY_BYPASS,
  TRUST_MUTATION,
  PROMOTION,
  DEMOTION,
  PROMOTION_EXECUTION,
  DEMOTION_EXECUTION,
  CALIBRATION_EXECUTION,
  BINARY_BRIER_EXECUTION,
  FORBIDDEN_SCORE_FIELDS,
  FORBIDDEN_THRESHOLD_FIELDS,
  FORBIDDEN_LIFECYCLE_FIELDS,
  FORBIDDEN_AUTHORITY_OVERRIDE_FIELDS,
  REQUIRED_HARD_FLAGS,
  ZERO_DQ_REGRESSION_DEGRADATION_POLICY_SIDE_EFFECTS,
  DQ_REGRESSION_DEGRADATION_POLICY_LIMITATIONS,
  DQ_REGRESSION_DEGRADATION_POLICY_DESCRIPTOR,
  DataQualityRegressionDegradationPolicyContractError,
  getDataQualityRegressionDegradationPolicyDescriptor,
  validateDataQualityRegressionDegradationPolicyDescriptor,
  buildDataQualityRegressionDegradationPolicyArtifact,
  validateDataQualityRegressionDegradationPolicyArtifact,
});
