/**
 * Artemis Core Stage 10 — Promotion Policy Contract Boundary
 *
 * Deterministic, library-only, non-SoT, recommendation-only Promotion Policy
 * semantic/validation boundary (V1).
 *
 * AUTHORIZED_SLICE = S10-PROMOTION-POLICY-CONTRACT
 * OFFICIAL_NAME = ARTEMIS_PROMOTION_POLICY_CONTRACT
 * AUTHORITY_CLASS = OUTCOME_EVALUATION
 * RISK_TIER = Tier 3
 *
 * V1 state model (exact):
 *   PROMOTION_ELIGIBLE
 *   NOT_PROMOTION_ELIGIBLE
 *   PROMOTION_UNAVAILABLE
 *
 * PROMOTION_ELIGIBLE only when ALL required evidence is valid, available,
 * canonical, compatible, and positive:
 *   Trust = TRUST_ELIGIBLE
 *   Sample Sufficiency = SUFFICIENT
 *   DQ availability = AVAILABLE AND freshnessStatus ∈ {FRESH, AGED}
 *   Regression / Degradation = STABLE
 *   Aggregate thin ref present / valid / canonical / compatible
 *   Segmented thin ref present / valid / canonical / compatible
 *   Canonical cohort identity present / compatible
 *   Required version bindings present / compatible
 *   No forbidden authority-bearing caller inputs
 *
 * NOT_PROMOTION_ELIGIBLE only when evidence is valid/available but one or more
 * canonical eligibility gates are validly negative (NOT_TRUST_ELIGIBLE,
 * INSUFFICIENT, valid DQ outside eligible state, DEGRADED).
 *
 * PROMOTION_UNAVAILABLE when required evidence is missing, malformed,
 * unsupported, unavailable, or incompatible (including Trust UNAVAILABLE,
 * Sample Sufficiency UNAVAILABLE, REGRESSION_UNAVAILABLE, Aggregate/Segmented
 * missing/malformed/version mismatch, cohort identity/version issues).
 *
 * Hard boundaries:
 *   - NO numeric Promotion thresholds / scores / cooldowns / hysteresis
 *   - NO memory / recovery window / consecutive counts
 *   - NO Promotion / Demotion / Trust / Calibration execution
 *   - NO persistence / runtime / network / DB / Redis / deploy
 *   - Sample Sufficiency min=50 remains UPSTREAM-ONLY (not reinterpreted here)
 *   - LIBRARY_ONLY / RECOMMENDATION_ONLY / MEMORYLESS / DETERMINISTIC
 *
 * isSourceOfTruth = false
 */

import { createHash } from 'node:crypto';
import {
  AVAILABILITY,
  FRESHNESS_STATUS,
} from './artemisEvidenceContract.js';
import {
  EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
} from './artemisEvaluationPerformanceAggregateContract.js';
import {
  SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
} from './artemisSegmentedPerformancePolicyContract.js';
import {
  TRUST_ELIGIBILITY_STATUS,
} from './artemisTrustWeightingPolicyContract.js';
import {
  SUFFICIENCY_VERDICT,
} from './artemisSampleSufficiencyPolicyContract.js';
import {
  POLICY_STATE,
} from './artemisDataQualityRegressionDegradationPolicyContract.js';

// ─── Identity ────────────────────────────────────────────────────────────────

export const PROMOTION_POLICY_SCHEMA_VERSION = '1.0.0';
export const PROMOTION_POLICY_CONTRACT_VERSION =
  'artemis-promotion-policy-1.0.0';
export const PROMOTION_POLICY_POLICY_VERSION =
  'artemis-promotion-policy-policy-1.0.0';
export const PROMOTION_POLICY_IMPLEMENTATION_VERSION = '1.0.0';
export const PROMOTION_POLICY_ARTIFACT_TYPE =
  'ARTEMIS_PROMOTION_POLICY';
export const PROMOTION_POLICY_TYPE = 'PROMOTION_POLICY';
export const PROMOTION_POLICY_AUTHORITY_CLASS = 'OUTCOME_EVALUATION';
export const PROMOTION_POLICY_RISK_TIER = 'Tier 3';
export const PROMOTION_POLICY_SLICE_ID = 'S10-PROMOTION-POLICY-CONTRACT';
export const PROMOTION_POLICY_OFFICIAL_NAME =
  'ARTEMIS_PROMOTION_POLICY_CONTRACT';
export const PROMOTION_POLICY_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const PROMOTION_POLICY_IS_SOURCE_OF_TRUTH = false;
export const PROMOTION_POLICY_WRITER = 'library-only';
export const PROMOTION_POLICY_METHOD_KEY = 'promotion_policy_v1';
export const PROMOTION_POLICY_STAGE = 'STAGE_10';
export const PROMOTION_POLICY_OWNER =
  'backend/contracts/artemisPromotionPolicyContract.js';

// ─── V1 state model (exact) ──────────────────────────────────────────────────

export const PROMOTION_STATUS = Object.freeze({
  PROMOTION_ELIGIBLE: 'PROMOTION_ELIGIBLE',
  NOT_PROMOTION_ELIGIBLE: 'NOT_PROMOTION_ELIGIBLE',
  PROMOTION_UNAVAILABLE: 'PROMOTION_UNAVAILABLE',
});

export const PROMOTION_NUMERIC_THRESHOLD_V1 = 'NONE';
export const NUMERIC_PROMOTION_MODEL = 'NONE';
export const MEMORYLESS = true;
export const RECOMMENDATION_ONLY = true;
export const LIBRARY_ONLY = true;
export const DETERMINISTIC = true;

// ─── Authorized upstream status sets ─────────────────────────────────────────

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

export const AUTHORIZED_DEGRADATION_POLICY_STATES = Object.freeze([
  POLICY_STATE.STABLE,
  POLICY_STATE.DEGRADED,
  POLICY_STATE.REGRESSION_UNAVAILABLE,
]);

export const AUTHORIZED_AVAILABILITY_VALUES = Object.freeze([
  AVAILABILITY.AVAILABLE,
  AVAILABILITY.UNAVAILABLE,
  AVAILABILITY.NOT_APPLICABLE,
  AVAILABILITY.BLOCKED,
  AVAILABILITY.NOT_RUN,
  AVAILABILITY.PROVIDER_UNAVAILABLE,
  AVAILABILITY.CONTRACT_ERROR,
]);

export const AUTHORIZED_FRESHNESS_VALUES = Object.freeze([
  FRESHNESS_STATUS.FRESH,
  FRESHNESS_STATUS.AGED,
  FRESHNESS_STATUS.STALE,
  FRESHNESS_STATUS.EXPIRED,
  FRESHNESS_STATUS.UNKNOWN,
  FRESHNESS_STATUS.UNAVAILABLE,
]);

export const DQ_USABLE_AVAILABILITY = AVAILABILITY.AVAILABLE;
export const DQ_USABLE_FRESHNESS = Object.freeze([
  FRESHNESS_STATUS.FRESH,
  FRESHNESS_STATUS.AGED,
]);

export const AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS = Object.freeze([
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
export const GLOBAL_AVERAGE_ONLY_BYPASS = 'CLOSED';

export const TRUST_MUTATION = false;
export const PROMOTION_EXECUTION = false;
export const DEMOTION_EXECUTION = false;
export const CALIBRATION_EXECUTION = false;
export const BINARY_BRIER_EXECUTION = false;
export const DEMOTION = 'DEFERRED';

// ─── Forbidden caller authority fields ───────────────────────────────────────

export const FORBIDDEN_PROMOTION_AUTHORITY_FIELDS = Object.freeze([
  'promotionStatus',
  'promoted',
  'promotionEligible',
  'promotionScore',
  'promotionThreshold',
  'activation',
  'tier',
  'lifecycleMutation',
  'runtimeActivation',
  'agentActivation',
  'modelActivation',
  'paperActivation',
  'liveActivation',
  'cooldown',
  'hysteresis',
  'recoveryWindow',
  'consecutiveSuccessCount',
  'consecutiveFailureCount',
]);

export const FORBIDDEN_SCORE_FIELDS = Object.freeze([
  'qualityScore',
  'healthScore',
  'stabilityScore',
  'trustScore',
  'winRate',
  'matchRatioThreshold',
  'mismatchRatioThreshold',
]);

export const FORBIDDEN_THRESHOLD_FIELDS = Object.freeze([
  'threshold',
  'minimumN',
  'minEligibleObservations',
  'promotionThreshold',
  'cooldownCount',
  'consecutiveSuccessCount',
  'consecutiveFailureCount',
  'timeWindowThreshold',
]);

export const FORBIDDEN_LIFECYCLE_FIELDS = Object.freeze([
  'demotionStatus',
  'demotionEligible',
  'lifecycle',
  'gracePeriod',
  'decay',
  'rollingState',
  'persistentState',
  'timer',
]);

export const FORBIDDEN_AUTHORITY_OVERRIDE_FIELDS = Object.freeze([
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

export const ZERO_PROMOTION_POLICY_SIDE_EFFECTS = Object.freeze({
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
  numericPromotionEvaluationCount: 0,
});

export const PROMOTION_POLICY_LIMITATIONS = Object.freeze([
  'LIBRARY_ONLY_NON_SOT_VALIDATION_BOUNDARY',
  'RECOMMENDATION_ONLY',
  'MEMORYLESS_DETERMINISTIC',
  'NUMERIC_PROMOTION_THRESHOLD_V1_NONE',
  'NO_PROMOTION_SCORE',
  'NO_COOLDOWN_HYSTERESIS_RECOVERY',
  'SAMPLE_SUFFICIENCY_MINIMUM_REMAINS_UPSTREAM_ONLY',
  'DEMOTION_DEFERRED',
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
  'degradationPolicyState',
  'aggregateRef',
  'segmentedPerformancePolicyRef',
  'cohort',
  'recordedAt',
]);

export const DATA_QUALITY_ALLOWLIST = Object.freeze([
  'availability',
  'freshnessStatus',
]);

export const AGGREGATE_REF_ALLOWLIST = Object.freeze([
  'aggregateId',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
]);

export const SEGMENTED_POLICY_REF_ALLOWLIST = Object.freeze([
  'policyId',
  'sliceId',
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
  'promotionStatus',
  'unavailableReason',
  'negativeGates',
  'trustEligibilityStatus',
  'sampleSufficiencyVerdict',
  'dataQuality',
  'dqUsable',
  'degradationPolicyState',
  'aggregateRef',
  'segmentedPerformancePolicyRef',
  'cohort',
  'numericPromotionThreshold',
  'memoryless',
  'recommendationOnly',
  'limitations',
  'hardFlags',
  'sideEffects',
  'implementationVersion',
]);

export const PROMOTION_POLICY_DESCRIPTOR = Object.freeze({
  schemaVersion: PROMOTION_POLICY_SCHEMA_VERSION,
  contractVersion: PROMOTION_POLICY_CONTRACT_VERSION,
  policyVersion: PROMOTION_POLICY_POLICY_VERSION,
  artifactType: PROMOTION_POLICY_ARTIFACT_TYPE,
  policyType: PROMOTION_POLICY_TYPE,
  authorityClass: PROMOTION_POLICY_AUTHORITY_CLASS,
  riskTier: PROMOTION_POLICY_RISK_TIER,
  sliceId: PROMOTION_POLICY_SLICE_ID,
  officialName: PROMOTION_POLICY_OFFICIAL_NAME,
  ownershipRole: PROMOTION_POLICY_OWNERSHIP_ROLE,
  isSourceOfTruth: PROMOTION_POLICY_IS_SOURCE_OF_TRUTH,
  writer: PROMOTION_POLICY_WRITER,
  methodKey: PROMOTION_POLICY_METHOD_KEY,
  stage: PROMOTION_POLICY_STAGE,
  owner: PROMOTION_POLICY_OWNER,
  promotionStatusModel: PROMOTION_STATUS,
  numericPromotionThreshold: PROMOTION_NUMERIC_THRESHOLD_V1,
  numericPromotionModel: NUMERIC_PROMOTION_MODEL,
  memoryless: MEMORYLESS,
  recommendationOnly: RECOMMENDATION_ONLY,
  libraryOnly: LIBRARY_ONLY,
  deterministic: DETERMINISTIC,
  dqUsableAvailability: DQ_USABLE_AVAILABILITY,
  dqUsableFreshness: DQ_USABLE_FRESHNESS,
  authorizedCanonicalSegmentDimensions: AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  regimeIdentityCanonical: REGIME_IDENTITY_CANONICAL,
  globalAverageOnlyBypass: GLOBAL_AVERAGE_ONLY_BYPASS,
  trustMutation: TRUST_MUTATION,
  demotion: DEMOTION,
  promotionExecution: PROMOTION_EXECUTION,
  demotionExecution: DEMOTION_EXECUTION,
  calibrationExecution: CALIBRATION_EXECUTION,
  binaryBrierExecution: BINARY_BRIER_EXECUTION,
  hardFlags: REQUIRED_HARD_FLAGS,
  sideEffects: ZERO_PROMOTION_POLICY_SIDE_EFFECTS,
  limitations: PROMOTION_POLICY_LIMITATIONS,
  implementationVersion: PROMOTION_POLICY_IMPLEMENTATION_VERSION,
});

// ─── Error ───────────────────────────────────────────────────────────────────

export class PromotionPolicyContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'PromotionPolicyContractError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function fail(code, message, details) {
  throw new PromotionPolicyContractError(code, message, details);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function freezeDeep(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Object.isFrozen(value)) {
    // Still freeze nested if already frozen parent (idempotent walk).
  }
  for (const key of Reflect.ownKeys(value)) {
    freezeDeep(value[key]);
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
  for (const key of Reflect.ownKeys(obj)) {
    if (typeof key !== 'string' || !allowlist.includes(key)) {
      fail(code, `Unknown field "${String(key)}" in ${context}`, {
        field: String(key),
        context,
      });
    }
  }
}

function assertExactString(actual, expected, code, message) {
  if (actual !== expected) {
    fail(code, message, { actual, expected });
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function hashToUuid(input) {
  const hex = createHash('sha256').update(String(input), 'utf8').digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
      .toString(16)
      .padStart(2, '0') + hex.slice(18, 20),
    hex.slice(20, 32),
  ].join('-');
}

function canonicalNowIso() {
  return new Date().toISOString();
}

function scanForbiddenKeys(obj, forbidden, code, context) {
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  for (const key of Reflect.ownKeys(obj)) {
    if (typeof key === 'string' && forbidden.includes(key)) {
      fail(code, `Forbidden field "${key}" in ${context}`, {
        field: key,
        context,
      });
    }
    const child = obj[key];
    if (child !== null && typeof child === 'object') {
      scanForbiddenKeys(child, forbidden, code, `${context}.${String(key)}`);
    }
  }
}

function assertNoCallerAuthorityOverrides(input) {
  for (const key of FORBIDDEN_PROMOTION_AUTHORITY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'PROMOTION_POLICY_CALLER_AUTHORITY_OVERRIDE',
        `Caller authority override field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_AUTHORITY_OVERRIDE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'PROMOTION_POLICY_CALLER_AUTHORITY_OVERRIDE',
        `Caller authority override field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_SCORE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'PROMOTION_POLICY_CALLER_SCORE_FIELD',
        `Caller score field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_THRESHOLD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'PROMOTION_POLICY_CALLER_THRESHOLD_FIELD',
        `Caller threshold field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_LIFECYCLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'PROMOTION_POLICY_CALLER_LIFECYCLE_FIELD',
        `Caller lifecycle field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  scanForbiddenKeys(
    input,
    FORBIDDEN_PROMOTION_AUTHORITY_FIELDS,
    'PROMOTION_POLICY_CALLER_AUTHORITY_OVERRIDE',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_SCORE_FIELDS,
    'PROMOTION_POLICY_CALLER_SCORE_FIELD',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_THRESHOLD_FIELDS,
    'PROMOTION_POLICY_CALLER_THRESHOLD_FIELD',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_LIFECYCLE_FIELDS,
    'PROMOTION_POLICY_CALLER_LIFECYCLE_FIELD',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_SECRET_FIELDS,
    'PROMOTION_POLICY_SECRET_FIELD_REJECTED',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_RUNTIME_PERSISTENCE_FIELDS,
    'PROMOTION_POLICY_RUNTIME_PERSISTENCE_FIELD_REJECTED',
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
        'PROMOTION_POLICY_UNSUPPORTED_SEGMENTATION_DIMENSION',
        `Unsupported segmentation dimension "${key}" in ${context}`,
        { field: key, context },
      );
    }
  }
}

// ─── Cohort ──────────────────────────────────────────────────────────────────

function extractCohort(cohortInput) {
  assertPlainObject(
    cohortInput,
    'PROMOTION_POLICY_COHORT_INVALID',
    'cohort must be a plain object',
  );
  assertNoUnsupportedSegmentation(cohortInput, 'cohort');
  assertAllowlist(
    cohortInput,
    COHORT_DESCRIPTOR_ALLOWLIST,
    'PROMOTION_POLICY_COHORT_UNKNOWN_FIELD',
    'cohort',
  );

  const cohort = {};
  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    if (!Object.prototype.hasOwnProperty.call(cohortInput, dim)) {
      fail(
        'PROMOTION_POLICY_COHORT_DIMENSION_MISSING',
        `Missing required cohort dimension "${dim}"`,
        { dimension: dim },
      );
    }
    const value = cohortInput[dim];
    if (typeof value !== 'string' || value.trim().length === 0) {
      fail(
        'PROMOTION_POLICY_COHORT_DIMENSION_INVALID',
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
          'PROMOTION_POLICY_COHORT_VERSION_BINDING_INVALID',
          `Cohort version binding "${field}" must be null or a non-empty string`,
          { field },
        );
      }
      cohort[field] = value;
    }
  }

  return freezeDeep(cohort);
}

function classifyCohortCompatibility(cohort) {
  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    const value = cohort[dim];
    if (
      value === 'UNAVAILABLE' ||
      value === 'GLOBAL_AVERAGE_ONLY' ||
      (typeof value === 'string' && value.startsWith('MIXED_'))
    ) {
      return {
        ok: false,
        reason: 'COHORT_MISMATCH',
        detail: { dimension: dim, value },
      };
    }
  }

  for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(cohort, field)) {
      return {
        ok: false,
        reason: 'VERSION_BINDING_MISSING',
        detail: { field },
      };
    }
    const value = cohort[field];
    if (value === null || value === undefined) {
      return {
        ok: false,
        reason: 'VERSION_BINDING_MISSING',
        detail: { field },
      };
    }
  }

  const expected = {
    contractVersion: PROMOTION_POLICY_CONTRACT_VERSION,
    policyVersion: PROMOTION_POLICY_POLICY_VERSION,
    implementationVersion: PROMOTION_POLICY_IMPLEMENTATION_VERSION,
  };
  for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
    if (cohort[field] !== expected[field]) {
      return {
        ok: false,
        reason: 'VERSION_BINDING_MISMATCH',
        detail: {
          field,
          actual: cohort[field],
          expected: expected[field],
        },
      };
    }
  }

  return { ok: true };
}

// ─── Status validators (throw on missing/malformed/unsupported) ──────────────

function validateTrustEligibilityStatus(status) {
  if (status === undefined || status === null) {
    fail(
      'PROMOTION_POLICY_TRUST_MISSING',
      'trustEligibilityStatus is required',
    );
  }
  if (typeof status !== 'string') {
    fail(
      'PROMOTION_POLICY_TRUST_MALFORMED',
      'trustEligibilityStatus must be a string',
    );
  }
  if (!AUTHORIZED_TRUST_ELIGIBILITY_STATUSES.includes(status)) {
    fail(
      'PROMOTION_POLICY_TRUST_UNSUPPORTED',
      `Unsupported trustEligibilityStatus: ${status}`,
      { trustEligibilityStatus: status },
    );
  }
  return status;
}

function validateSampleSufficiencyVerdict(verdict) {
  if (verdict === undefined || verdict === null) {
    fail(
      'PROMOTION_POLICY_SAMPLE_SUFFICIENCY_MISSING',
      'sampleSufficiencyVerdict is required',
    );
  }
  if (typeof verdict !== 'string') {
    fail(
      'PROMOTION_POLICY_SAMPLE_SUFFICIENCY_MALFORMED',
      'sampleSufficiencyVerdict must be a string',
    );
  }
  if (!AUTHORIZED_SAMPLE_SUFFICIENCY_VERDICTS.includes(verdict)) {
    fail(
      'PROMOTION_POLICY_SAMPLE_SUFFICIENCY_UNSUPPORTED',
      `Unsupported sampleSufficiencyVerdict: ${verdict}`,
      { sampleSufficiencyVerdict: verdict },
    );
  }
  return verdict;
}

function validateDegradationPolicyState(state) {
  if (state === undefined || state === null) {
    fail(
      'PROMOTION_POLICY_DEGRADATION_MISSING',
      'degradationPolicyState is required',
    );
  }
  if (typeof state !== 'string') {
    fail(
      'PROMOTION_POLICY_DEGRADATION_MALFORMED',
      'degradationPolicyState must be a string',
    );
  }
  if (!AUTHORIZED_DEGRADATION_POLICY_STATES.includes(state)) {
    fail(
      'PROMOTION_POLICY_DEGRADATION_UNSUPPORTED',
      `Unsupported degradationPolicyState: ${state}`,
      { degradationPolicyState: state },
    );
  }
  return state;
}

function validateDataQuality(dq) {
  if (dq === undefined || dq === null) {
    fail('PROMOTION_POLICY_DQ_MISSING', 'dataQuality is required');
  }
  if (
    typeof dq !== 'object' ||
    Array.isArray(dq) ||
    Object.getPrototypeOf(dq) !== Object.prototype
  ) {
    fail(
      'PROMOTION_POLICY_DQ_MALFORMED',
      'dataQuality must be a plain object',
    );
  }
  assertAllowlist(
    dq,
    DATA_QUALITY_ALLOWLIST,
    'PROMOTION_POLICY_DQ_UNKNOWN_FIELD',
    'dataQuality',
  );

  if (!Object.prototype.hasOwnProperty.call(dq, 'availability')) {
    fail(
      'PROMOTION_POLICY_DQ_AVAILABILITY_MISSING',
      'dataQuality.availability is required',
    );
  }
  if (!Object.prototype.hasOwnProperty.call(dq, 'freshnessStatus')) {
    fail(
      'PROMOTION_POLICY_DQ_FRESHNESS_MISSING',
      'dataQuality.freshnessStatus is required',
    );
  }

  const { availability, freshnessStatus } = dq;

  if (typeof availability !== 'string') {
    fail(
      'PROMOTION_POLICY_DQ_AVAILABILITY_MALFORMED',
      'dataQuality.availability must be a string',
    );
  }
  if (!AUTHORIZED_AVAILABILITY_VALUES.includes(availability)) {
    fail(
      'PROMOTION_POLICY_DQ_AVAILABILITY_UNSUPPORTED',
      `Unsupported dataQuality.availability: ${availability}`,
      { availability },
    );
  }

  if (typeof freshnessStatus !== 'string') {
    fail(
      'PROMOTION_POLICY_DQ_FRESHNESS_MALFORMED',
      'dataQuality.freshnessStatus must be a string',
    );
  }
  if (!AUTHORIZED_FRESHNESS_VALUES.includes(freshnessStatus)) {
    fail(
      'PROMOTION_POLICY_DQ_FRESHNESS_UNSUPPORTED',
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

// ─── Thin refs (soft-map failures → PROMOTION_UNAVAILABLE via catch) ──────────

function validateThinAggregateRef(ref) {
  if (ref === undefined || ref === null) {
    fail(
      'PROMOTION_POLICY_AGGREGATE_REF_MISSING',
      'aggregateRef is required',
    );
  }
  assertPlainObject(
    ref,
    'PROMOTION_POLICY_AGGREGATE_REF_INVALID',
    'aggregateRef must be a plain object',
  );
  assertAllowlist(
    ref,
    AGGREGATE_REF_ALLOWLIST,
    'PROMOTION_POLICY_AGGREGATE_REF_UNKNOWN_FIELD',
    'aggregateRef',
  );
  for (const key of AGGREGATE_REF_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(ref, key)) {
      fail(
        'PROMOTION_POLICY_AGGREGATE_REF_MISSING_FIELD',
        `aggregateRef missing required field "${key}"`,
        { field: key },
      );
    }
    if (typeof ref[key] !== 'string' || ref[key].trim().length === 0) {
      fail(
        'PROMOTION_POLICY_AGGREGATE_REF_FIELD_INVALID',
        `aggregateRef.${key} must be a non-empty string`,
        { field: key },
      );
    }
  }
  assertExactString(
    ref.contractVersion,
    EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
    'PROMOTION_POLICY_AGGREGATE_CONTRACT_VERSION_MISMATCH',
    'aggregateRef.contractVersion must match canonical Aggregate contract',
  );
  assertExactString(
    ref.policyVersion,
    EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
    'PROMOTION_POLICY_AGGREGATE_POLICY_VERSION_MISMATCH',
    'aggregateRef.policyVersion must match canonical Aggregate policy',
  );
  assertExactString(
    ref.implementationVersion,
    EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
    'PROMOTION_POLICY_AGGREGATE_IMPLEMENTATION_VERSION_MISMATCH',
    'aggregateRef.implementationVersion must match canonical Aggregate implementation',
  );
  return Object.freeze({
    aggregateId: ref.aggregateId,
    contractVersion: ref.contractVersion,
    policyVersion: ref.policyVersion,
    implementationVersion: ref.implementationVersion,
  });
}

function validateThinSegmentedPolicyRef(ref) {
  if (ref === undefined || ref === null) {
    fail(
      'PROMOTION_POLICY_SEGMENTED_REF_MISSING',
      'segmentedPerformancePolicyRef is required',
    );
  }
  assertPlainObject(
    ref,
    'PROMOTION_POLICY_SEGMENTED_REF_INVALID',
    'segmentedPerformancePolicyRef must be a plain object',
  );
  assertAllowlist(
    ref,
    SEGMENTED_POLICY_REF_ALLOWLIST,
    'PROMOTION_POLICY_SEGMENTED_REF_UNKNOWN_FIELD',
    'segmentedPerformancePolicyRef',
  );
  for (const key of SEGMENTED_POLICY_REF_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(ref, key)) {
      fail(
        'PROMOTION_POLICY_SEGMENTED_REF_MISSING_FIELD',
        `segmentedPerformancePolicyRef missing required field "${key}"`,
        { field: key },
      );
    }
    if (typeof ref[key] !== 'string' || ref[key].trim().length === 0) {
      fail(
        'PROMOTION_POLICY_SEGMENTED_REF_FIELD_INVALID',
        `segmentedPerformancePolicyRef.${key} must be a non-empty string`,
        { field: key },
      );
    }
  }
  assertExactString(
    ref.contractVersion,
    SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
    'PROMOTION_POLICY_SEGMENTED_CONTRACT_VERSION_MISMATCH',
    'segmentedPerformancePolicyRef.contractVersion must match canonical Segmented contract',
  );
  assertExactString(
    ref.policyVersion,
    SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
    'PROMOTION_POLICY_SEGMENTED_POLICY_VERSION_MISMATCH',
    'segmentedPerformancePolicyRef.policyVersion must match canonical Segmented policy',
  );
  assertExactString(
    ref.implementationVersion,
    SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    'PROMOTION_POLICY_SEGMENTED_IMPLEMENTATION_VERSION_MISMATCH',
    'segmentedPerformancePolicyRef.implementationVersion must match canonical Segmented implementation',
  );
  assertExactString(
    ref.sliceId,
    SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
    'PROMOTION_POLICY_SEGMENTED_SLICE_ID_MISMATCH',
    'segmentedPerformancePolicyRef.sliceId must match canonical Segmented slice',
  );
  return Object.freeze({
    policyId: ref.policyId,
    sliceId: ref.sliceId,
    contractVersion: ref.contractVersion,
    policyVersion: ref.policyVersion,
    implementationVersion: ref.implementationVersion,
  });
}

function tryValidateThinRef(validator, value) {
  try {
    return { ok: true, value: validator(value) };
  } catch (err) {
    if (err instanceof PromotionPolicyContractError) {
      return {
        ok: false,
        reason: err.code,
        message: err.message,
        details: err.details,
      };
    }
    throw err;
  }
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

function evaluatePromotionStatus({
  trustEligibilityStatus,
  sampleSufficiencyVerdict,
  dataQuality,
  degradationPolicyState,
  aggregateRefResult,
  segmentedRefResult,
  cohortCompatibility,
}) {
  const negativeGates = [];
  const unavailableReasons = [];

  // Unavailable / incompatible evidence → PROMOTION_UNAVAILABLE
  if (
    trustEligibilityStatus === TRUST_ELIGIBILITY_STATUS.TRUST_UNAVAILABLE
  ) {
    unavailableReasons.push('TRUST_UNAVAILABLE');
  }
  if (sampleSufficiencyVerdict === SUFFICIENCY_VERDICT.UNAVAILABLE) {
    unavailableReasons.push('SAMPLE_SUFFICIENCY_UNAVAILABLE');
  }
  if (degradationPolicyState === POLICY_STATE.REGRESSION_UNAVAILABLE) {
    unavailableReasons.push('REGRESSION_UNAVAILABLE');
  }
  if (!aggregateRefResult.ok) {
    unavailableReasons.push(aggregateRefResult.reason || 'AGGREGATE_UNAVAILABLE');
  }
  if (!segmentedRefResult.ok) {
    unavailableReasons.push(segmentedRefResult.reason || 'SEGMENTED_UNAVAILABLE');
  }
  if (!cohortCompatibility.ok) {
    unavailableReasons.push(cohortCompatibility.reason);
  }

  if (unavailableReasons.length > 0) {
    return {
      promotionStatus: PROMOTION_STATUS.PROMOTION_UNAVAILABLE,
      unavailableReason: unavailableReasons[0],
      unavailableReasons: Object.freeze([...unavailableReasons]),
      negativeGates: Object.freeze([]),
    };
  }

  // Valid negative gates → NOT_PROMOTION_ELIGIBLE
  if (
    trustEligibilityStatus === TRUST_ELIGIBILITY_STATUS.NOT_TRUST_ELIGIBLE
  ) {
    negativeGates.push('NOT_TRUST_ELIGIBLE');
  }
  if (sampleSufficiencyVerdict === SUFFICIENCY_VERDICT.INSUFFICIENT) {
    negativeGates.push('INSUFFICIENT');
  }
  if (!isDqUsable(dataQuality)) {
    negativeGates.push('DQ_OUTSIDE_ELIGIBLE_STATE');
  }
  if (degradationPolicyState === POLICY_STATE.DEGRADED) {
    negativeGates.push('DEGRADED');
  }

  if (negativeGates.length > 0) {
    return {
      promotionStatus: PROMOTION_STATUS.NOT_PROMOTION_ELIGIBLE,
      unavailableReason: null,
      unavailableReasons: Object.freeze([]),
      negativeGates: Object.freeze([...negativeGates]),
    };
  }

  // All positive
  if (
    trustEligibilityStatus === TRUST_ELIGIBILITY_STATUS.TRUST_ELIGIBLE &&
    sampleSufficiencyVerdict === SUFFICIENCY_VERDICT.SUFFICIENT &&
    isDqUsable(dataQuality) &&
    degradationPolicyState === POLICY_STATE.STABLE
  ) {
    return {
      promotionStatus: PROMOTION_STATUS.PROMOTION_ELIGIBLE,
      unavailableReason: null,
      unavailableReasons: Object.freeze([]),
      negativeGates: Object.freeze([]),
    };
  }

  // Defensive fail-closed (should be unreachable given validators above)
  return {
    promotionStatus: PROMOTION_STATUS.PROMOTION_UNAVAILABLE,
    unavailableReason: 'EVALUATION_INDETERMINATE',
    unavailableReasons: Object.freeze(['EVALUATION_INDETERMINATE']),
    negativeGates: Object.freeze([]),
  };
}

function computePolicyId(parts) {
  return hashToUuid(
    stableStringify({
      contractVersion: PROMOTION_POLICY_CONTRACT_VERSION,
      policyVersion: PROMOTION_POLICY_POLICY_VERSION,
      implementationVersion: PROMOTION_POLICY_IMPLEMENTATION_VERSION,
      methodKey: PROMOTION_POLICY_METHOD_KEY,
      ...parts,
    }),
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getPromotionPolicyDescriptor() {
  return PROMOTION_POLICY_DESCRIPTOR;
}

export function validatePromotionPolicyDescriptor(descriptor) {
  assertPlainObject(
    descriptor,
    'PROMOTION_POLICY_DESCRIPTOR_INVALID',
    'descriptor must be a plain object',
  );
  assertExactString(
    descriptor.contractVersion,
    PROMOTION_POLICY_CONTRACT_VERSION,
    'PROMOTION_POLICY_DESCRIPTOR_CONTRACT_VERSION_MISMATCH',
    'descriptor.contractVersion mismatch',
  );
  assertExactString(
    descriptor.policyVersion,
    PROMOTION_POLICY_POLICY_VERSION,
    'PROMOTION_POLICY_DESCRIPTOR_POLICY_VERSION_MISMATCH',
    'descriptor.policyVersion mismatch',
  );
  assertExactString(
    descriptor.implementationVersion,
    PROMOTION_POLICY_IMPLEMENTATION_VERSION,
    'PROMOTION_POLICY_DESCRIPTOR_IMPLEMENTATION_VERSION_MISMATCH',
    'descriptor.implementationVersion mismatch',
  );
  assertExactString(
    descriptor.sliceId,
    PROMOTION_POLICY_SLICE_ID,
    'PROMOTION_POLICY_DESCRIPTOR_SLICE_ID_MISMATCH',
    'descriptor.sliceId mismatch',
  );
  assertExactString(
    descriptor.authorityClass,
    PROMOTION_POLICY_AUTHORITY_CLASS,
    'PROMOTION_POLICY_DESCRIPTOR_AUTHORITY_CLASS_MISMATCH',
    'descriptor.authorityClass mismatch',
  );
  if (descriptor.isSourceOfTruth !== false) {
    fail(
      'PROMOTION_POLICY_DESCRIPTOR_IS_SOURCE_OF_TRUTH_INVALID',
      'descriptor.isSourceOfTruth must be false',
    );
  }
  return PROMOTION_POLICY_DESCRIPTOR;
}

export function buildPromotionPolicyArtifact(input) {
  assertPlainObject(
    input,
    'PROMOTION_POLICY_INPUT_INVALID',
    'input must be a plain object',
  );
  assertAllowlist(
    input,
    INPUT_ALLOWLIST,
    'PROMOTION_POLICY_INPUT_UNKNOWN_FIELD',
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
  const degradationPolicyState = validateDegradationPolicyState(
    input.degradationPolicyState,
  );

  if (
    !Object.prototype.hasOwnProperty.call(input, 'cohort') ||
    input.cohort === undefined ||
    input.cohort === null
  ) {
    // Soft-map missing cohort to PROMOTION_UNAVAILABLE (mission tests 24)
    const recordedAtMissingCohort =
      typeof input.recordedAt === 'string' && input.recordedAt.trim().length > 0
        ? input.recordedAt
        : canonicalNowIso();
    const policyIdMissingCohort = computePolicyId({
      promotionStatus: PROMOTION_STATUS.PROMOTION_UNAVAILABLE,
      unavailableReason: 'COHORT_MISSING',
      trustEligibilityStatus,
      sampleSufficiencyVerdict,
      degradationPolicyState,
      dataQuality,
    });
    return freezeDeep({
      schemaVersion: PROMOTION_POLICY_SCHEMA_VERSION,
      contractVersion: PROMOTION_POLICY_CONTRACT_VERSION,
      policyVersion: PROMOTION_POLICY_POLICY_VERSION,
      artifactType: PROMOTION_POLICY_ARTIFACT_TYPE,
      policyType: PROMOTION_POLICY_TYPE,
      authorityClass: PROMOTION_POLICY_AUTHORITY_CLASS,
      sliceId: PROMOTION_POLICY_SLICE_ID,
      officialName: PROMOTION_POLICY_OFFICIAL_NAME,
      ownershipRole: PROMOTION_POLICY_OWNERSHIP_ROLE,
      isSourceOfTruth: PROMOTION_POLICY_IS_SOURCE_OF_TRUTH,
      writer: PROMOTION_POLICY_WRITER,
      methodKey: PROMOTION_POLICY_METHOD_KEY,
      stage: PROMOTION_POLICY_STAGE,
      policyId: policyIdMissingCohort,
      recordedAt: recordedAtMissingCohort,
      promotionStatus: PROMOTION_STATUS.PROMOTION_UNAVAILABLE,
      unavailableReason: 'COHORT_MISSING',
      negativeGates: Object.freeze([]),
      trustEligibilityStatus,
      sampleSufficiencyVerdict,
      dataQuality,
      dqUsable: isDqUsable(dataQuality),
      degradationPolicyState,
      aggregateRef: null,
      segmentedPerformancePolicyRef: null,
      cohort: null,
      numericPromotionThreshold: PROMOTION_NUMERIC_THRESHOLD_V1,
      memoryless: MEMORYLESS,
      recommendationOnly: RECOMMENDATION_ONLY,
      limitations: PROMOTION_POLICY_LIMITATIONS,
      hardFlags: { ...REQUIRED_HARD_FLAGS },
      sideEffects: { ...ZERO_PROMOTION_POLICY_SIDE_EFFECTS },
      implementationVersion: PROMOTION_POLICY_IMPLEMENTATION_VERSION,
    });
  }

  let cohort;
  try {
    cohort = extractCohort(input.cohort);
  } catch (err) {
    if (err instanceof PromotionPolicyContractError) {
      // Soft-map malformed cohort structural issues that are "mismatch" style;
      // dimension missing/invalid still throw (fail-closed on bad shape).
      // For mission test 24 (missing) handled above; malformed → throw.
      throw err;
    }
    throw err;
  }

  const cohortCompatibility = classifyCohortCompatibility(cohort);
  const aggregateRefResult = tryValidateThinRef(
    validateThinAggregateRef,
    input.aggregateRef,
  );
  const segmentedRefResult = tryValidateThinRef(
    validateThinSegmentedPolicyRef,
    input.segmentedPerformancePolicyRef,
  );

  const evaluation = evaluatePromotionStatus({
    trustEligibilityStatus,
    sampleSufficiencyVerdict,
    dataQuality,
    degradationPolicyState,
    aggregateRefResult,
    segmentedRefResult,
    cohortCompatibility,
  });

  const recordedAt =
    typeof input.recordedAt === 'string' && input.recordedAt.trim().length > 0
      ? input.recordedAt
      : canonicalNowIso();

  const policyId = computePolicyId({
    promotionStatus: evaluation.promotionStatus,
    unavailableReason: evaluation.unavailableReason,
    negativeGates: evaluation.negativeGates,
    trustEligibilityStatus,
    sampleSufficiencyVerdict,
    degradationPolicyState,
    dataQuality,
    aggregateRef: aggregateRefResult.ok ? aggregateRefResult.value : null,
    segmentedPerformancePolicyRef: segmentedRefResult.ok
      ? segmentedRefResult.value
      : null,
    cohort,
  });

  return freezeDeep({
    schemaVersion: PROMOTION_POLICY_SCHEMA_VERSION,
    contractVersion: PROMOTION_POLICY_CONTRACT_VERSION,
    policyVersion: PROMOTION_POLICY_POLICY_VERSION,
    artifactType: PROMOTION_POLICY_ARTIFACT_TYPE,
    policyType: PROMOTION_POLICY_TYPE,
    authorityClass: PROMOTION_POLICY_AUTHORITY_CLASS,
    sliceId: PROMOTION_POLICY_SLICE_ID,
    officialName: PROMOTION_POLICY_OFFICIAL_NAME,
    ownershipRole: PROMOTION_POLICY_OWNERSHIP_ROLE,
    isSourceOfTruth: PROMOTION_POLICY_IS_SOURCE_OF_TRUTH,
    writer: PROMOTION_POLICY_WRITER,
    methodKey: PROMOTION_POLICY_METHOD_KEY,
    stage: PROMOTION_POLICY_STAGE,
    policyId,
    recordedAt,
    promotionStatus: evaluation.promotionStatus,
    unavailableReason: evaluation.unavailableReason,
    negativeGates: evaluation.negativeGates,
    trustEligibilityStatus,
    sampleSufficiencyVerdict,
    dataQuality,
    dqUsable: isDqUsable(dataQuality),
    degradationPolicyState,
    aggregateRef: aggregateRefResult.ok ? aggregateRefResult.value : null,
    segmentedPerformancePolicyRef: segmentedRefResult.ok
      ? segmentedRefResult.value
      : null,
    cohort,
    numericPromotionThreshold: PROMOTION_NUMERIC_THRESHOLD_V1,
    memoryless: MEMORYLESS,
    recommendationOnly: RECOMMENDATION_ONLY,
    limitations: PROMOTION_POLICY_LIMITATIONS,
    hardFlags: { ...REQUIRED_HARD_FLAGS },
    sideEffects: { ...ZERO_PROMOTION_POLICY_SIDE_EFFECTS },
    implementationVersion: PROMOTION_POLICY_IMPLEMENTATION_VERSION,
  });
}

export function validatePromotionPolicyArtifact(artifact) {
  assertPlainObject(
    artifact,
    'PROMOTION_POLICY_ARTIFACT_INVALID',
    'artifact must be a plain object',
  );
  assertAllowlist(
    artifact,
    ARTIFACT_ALLOWLIST,
    'PROMOTION_POLICY_ARTIFACT_UNKNOWN_FIELD',
    'artifact',
  );

  assertExactString(
    artifact.schemaVersion,
    PROMOTION_POLICY_SCHEMA_VERSION,
    'PROMOTION_POLICY_ARTIFACT_SCHEMA_VERSION_MISMATCH',
    'artifact.schemaVersion mismatch',
  );
  assertExactString(
    artifact.contractVersion,
    PROMOTION_POLICY_CONTRACT_VERSION,
    'PROMOTION_POLICY_ARTIFACT_CONTRACT_VERSION_MISMATCH',
    'artifact.contractVersion mismatch',
  );
  assertExactString(
    artifact.policyVersion,
    PROMOTION_POLICY_POLICY_VERSION,
    'PROMOTION_POLICY_ARTIFACT_POLICY_VERSION_MISMATCH',
    'artifact.policyVersion mismatch',
  );
  assertExactString(
    artifact.implementationVersion,
    PROMOTION_POLICY_IMPLEMENTATION_VERSION,
    'PROMOTION_POLICY_ARTIFACT_IMPLEMENTATION_VERSION_MISMATCH',
    'artifact.implementationVersion mismatch',
  );
  assertExactString(
    artifact.artifactType,
    PROMOTION_POLICY_ARTIFACT_TYPE,
    'PROMOTION_POLICY_ARTIFACT_TYPE_MISMATCH',
    'artifact.artifactType mismatch',
  );
  assertExactString(
    artifact.authorityClass,
    PROMOTION_POLICY_AUTHORITY_CLASS,
    'PROMOTION_POLICY_ARTIFACT_AUTHORITY_CLASS_MISMATCH',
    'artifact.authorityClass mismatch',
  );
  assertExactString(
    artifact.sliceId,
    PROMOTION_POLICY_SLICE_ID,
    'PROMOTION_POLICY_ARTIFACT_SLICE_ID_MISMATCH',
    'artifact.sliceId mismatch',
  );
  if (artifact.isSourceOfTruth !== false) {
    fail(
      'PROMOTION_POLICY_ARTIFACT_IS_SOURCE_OF_TRUTH_INVALID',
      'artifact.isSourceOfTruth must be false',
    );
  }
  if (
    !Object.values(PROMOTION_STATUS).includes(artifact.promotionStatus)
  ) {
    fail(
      'PROMOTION_POLICY_ARTIFACT_STATUS_UNSUPPORTED',
      `Unsupported artifact.promotionStatus: ${artifact.promotionStatus}`,
    );
  }
  if (artifact.numericPromotionThreshold !== PROMOTION_NUMERIC_THRESHOLD_V1) {
    fail(
      'PROMOTION_POLICY_ARTIFACT_NUMERIC_THRESHOLD_INVALID',
      'artifact.numericPromotionThreshold must be NONE',
    );
  }
  if (artifact.memoryless !== true) {
    fail(
      'PROMOTION_POLICY_ARTIFACT_MEMORYLESS_INVALID',
      'artifact.memoryless must be true',
    );
  }
  if (artifact.recommendationOnly !== true) {
    fail(
      'PROMOTION_POLICY_ARTIFACT_RECOMMENDATION_ONLY_INVALID',
      'artifact.recommendationOnly must be true',
    );
  }

  // Rebuild equality from canonical semantic inputs.
  const rebuildInput = {
    trustEligibilityStatus: artifact.trustEligibilityStatus,
    sampleSufficiencyVerdict: artifact.sampleSufficiencyVerdict,
    dataQuality: artifact.dataQuality,
    degradationPolicyState: artifact.degradationPolicyState,
    aggregateRef: artifact.aggregateRef,
    segmentedPerformancePolicyRef: artifact.segmentedPerformancePolicyRef,
    cohort: artifact.cohort,
    recordedAt: artifact.recordedAt,
  };
  // Missing cohort soft-path: rebuild with absent cohort.
  if (artifact.cohort === null || artifact.cohort === undefined) {
    delete rebuildInput.cohort;
  }
  if (artifact.aggregateRef === null) {
    delete rebuildInput.aggregateRef;
  }
  if (artifact.segmentedPerformancePolicyRef === null) {
    delete rebuildInput.segmentedPerformancePolicyRef;
  }

  const rebuilt = buildPromotionPolicyArtifact(rebuildInput);

  if (rebuilt.promotionStatus !== artifact.promotionStatus) {
    fail(
      'PROMOTION_POLICY_ARTIFACT_STATUS_REBUILD_MISMATCH',
      'artifact.promotionStatus does not match canonical rebuild',
      {
        actual: artifact.promotionStatus,
        expected: rebuilt.promotionStatus,
      },
    );
  }
  if (rebuilt.policyId !== artifact.policyId) {
    fail(
      'PROMOTION_POLICY_ARTIFACT_POLICY_ID_REBUILD_MISMATCH',
      'artifact.policyId does not match canonical rebuild',
      { actual: artifact.policyId, expected: rebuilt.policyId },
    );
  }
  if (rebuilt.unavailableReason !== artifact.unavailableReason) {
    fail(
      'PROMOTION_POLICY_ARTIFACT_UNAVAILABLE_REASON_REBUILD_MISMATCH',
      'artifact.unavailableReason does not match canonical rebuild',
    );
  }

  for (const [flag, expected] of Object.entries(REQUIRED_HARD_FLAGS)) {
    if (artifact.hardFlags?.[flag] !== expected) {
      fail(
        'PROMOTION_POLICY_ARTIFACT_HARD_FLAG_INVALID',
        `artifact.hardFlags.${flag} must be ${expected}`,
        { flag, expected },
      );
    }
  }
  for (const [key, expected] of Object.entries(
    ZERO_PROMOTION_POLICY_SIDE_EFFECTS,
  )) {
    if (artifact.sideEffects?.[key] !== expected) {
      fail(
        'PROMOTION_POLICY_ARTIFACT_SIDE_EFFECT_NONZERO',
        `artifact.sideEffects.${key} must be ${expected}`,
        { key, expected },
      );
    }
  }

  return freezeDeep(artifact);
}

export default Object.freeze({
  PROMOTION_STATUS,
  PROMOTION_POLICY_SCHEMA_VERSION,
  PROMOTION_POLICY_CONTRACT_VERSION,
  PROMOTION_POLICY_POLICY_VERSION,
  PROMOTION_POLICY_IMPLEMENTATION_VERSION,
  PROMOTION_POLICY_ARTIFACT_TYPE,
  PROMOTION_POLICY_AUTHORITY_CLASS,
  PROMOTION_POLICY_SLICE_ID,
  PROMOTION_POLICY_OFFICIAL_NAME,
  PROMOTION_NUMERIC_THRESHOLD_V1,
  REQUIRED_HARD_FLAGS,
  ZERO_PROMOTION_POLICY_SIDE_EFFECTS,
  PROMOTION_POLICY_DESCRIPTOR,
  PromotionPolicyContractError,
  getPromotionPolicyDescriptor,
  validatePromotionPolicyDescriptor,
  buildPromotionPolicyArtifact,
  validatePromotionPolicyArtifact,
});
