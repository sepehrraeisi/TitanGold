/**
 * Artemis Trust / Weighting Policy Contract
 *
 * Stage 10 — S10-TRUST-WEIGHTING-POLICY-CONTRACT
 * Official: ARTEMIS_TRUST_WEIGHTING_POLICY_CONTRACT
 *
 * V1 MODEL = BINARY_EVIDENCE_ELIGIBILITY
 * NUMERIC_WEIGHT = NONE / NOT_AUTHORIZED
 * TRUST_SCOPE = PER_HOMOGENEOUS_CANONICAL_COHORT
 *
 * Deterministic, library-only, non-SoT validation boundary.
 * Maps Sample Sufficiency verdict → Trust eligibility vocabulary.
 * Does NOT invent numeric weights, mutate trust, promote/demote,
 * execute calibration, invent regime, or persist state.
 *
 * AUTHORITY_CLASS = OUTCOME_EVALUATION
 * RISK_TIER = Tier 3
 * isSourceOfTruth = false
 * PRODUCTION_RUNTIME_REACHABLE = NO
 */

import { hashToUuid } from './artemisReplayContract.js';
import {
  SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
  SUFFICIENCY_VERDICT,
} from './artemisSampleSufficiencyPolicyContract.js';
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
  AVAILABILITY,
  FRESHNESS_STATUS,
} from './artemisEvidenceContract.js';

// ─── Canonical identity ──────────────────────────────────────────────────────

export const TRUST_WEIGHTING_POLICY_SCHEMA_VERSION = '1.0.0';
export const TRUST_WEIGHTING_POLICY_CONTRACT_VERSION =
  'artemis-trust-weighting-policy-1.0.0';
export const TRUST_WEIGHTING_POLICY_POLICY_VERSION =
  'artemis-trust-weighting-policy-policy-1.0.0';
export const TRUST_WEIGHTING_POLICY_IMPLEMENTATION_VERSION = '1.0.0';
export const TRUST_WEIGHTING_POLICY_ARTIFACT_TYPE =
  'ARTEMIS_TRUST_WEIGHTING_POLICY';
export const TRUST_WEIGHTING_POLICY_TYPE = 'TRUST_WEIGHTING_POLICY';
export const TRUST_WEIGHTING_POLICY_AUTHORITY_CLASS = 'OUTCOME_EVALUATION';
export const TRUST_WEIGHTING_POLICY_RISK_TIER = 'Tier 3';
export const TRUST_WEIGHTING_POLICY_SLICE_ID =
  'S10-TRUST-WEIGHTING-POLICY-CONTRACT';
export const TRUST_WEIGHTING_POLICY_OFFICIAL_NAME =
  'ARTEMIS_TRUST_WEIGHTING_POLICY_CONTRACT';
export const TRUST_WEIGHTING_POLICY_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const TRUST_WEIGHTING_POLICY_IS_SOURCE_OF_TRUTH = false;
export const TRUST_WEIGHTING_POLICY_WRITER =
  'artemisTrustWeightingPolicyContract';
export const TRUST_WEIGHTING_POLICY_METHOD_KEY =
  'artemis.trust_weighting_policy.v1';
export const TRUST_WEIGHTING_POLICY_STAGE =
  'ARTEMIS_CORE_STAGE_10_CALIBRATION_AND_PROMOTION_FRAMEWORK';

export const TRUST_WEIGHTING_OWNER =
  'artemisTrustWeightingPolicyContract';
export const V1_MODEL = 'BINARY_EVIDENCE_ELIGIBILITY';
export const NUMERIC_WEIGHT = 'NONE / NOT_AUTHORIZED';
export const TRUST_SCOPE = 'PER_HOMOGENEOUS_CANONICAL_COHORT';
export const AGENT_LEVEL_TRUST = 'DEFERRED';
export const PERSISTENT_WEIGHT_STATE = 'NO';
export const WEIGHT_POLICY_VERSION = 'FORBIDDEN';
export const TRUST_MODEL_VERSION = 'FORBIDDEN';

export const TRUST_ELIGIBILITY_STATUS = Object.freeze({
  TRUST_ELIGIBLE: 'TRUST_ELIGIBLE',
  NOT_TRUST_ELIGIBLE: 'NOT_TRUST_ELIGIBLE',
  TRUST_UNAVAILABLE: 'TRUST_UNAVAILABLE',
});

export const TRUST_ELIGIBILITY_STATUS_VALUES = Object.freeze(
  Object.values(TRUST_ELIGIBILITY_STATUS),
);

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
  'methodKey',
  'methodImplementationVersion',
  'evaluationImplementationVersion',
  'policyVersion',
  'contractVersion',
]);

export const COHORT_DESCRIPTOR_ALLOWLIST = Object.freeze([
  ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  ...CANONICAL_VERSION_BINDING_FIELDS,
]);

export const SEGMENT_SCOPE = Object.freeze({
  SEGMENTED: 'SEGMENTED',
  GLOBAL_AVERAGE_ONLY: 'GLOBAL_AVERAGE_ONLY',
  UNSUPPORTED: 'UNSUPPORTED',
  UNAVAILABLE: 'UNAVAILABLE',
  MISSING: 'MISSING',
});

export const REGIME_IDENTITY_CANONICAL = false;
export const REGIME_CLASSIFIER = 'NOT_AUTHORIZED';
export const REGIME_CREATION = 'FORBIDDEN';
export const GLOBAL_AVERAGE_ONLY = 'NOT_SUFFICIENT_FOR_STAGE10_COMPLETION';
export const GLOBAL_AVERAGE_ONLY_BYPASS = 'CLOSED';

export const TRUST_MUTATION = false;
export const PROMOTION = 'NOT_AUTHORIZED';
export const DEMOTION = 'NOT_AUTHORIZED';
export const CALIBRATION_EXECUTION = false;
export const BINARY_BRIER_EXECUTION = false;
export const CALIBRATION_REQUIRED =
  'NO / CURRENT_NON_PREDICTIVE_PATH';

export const SAMPLE_SUFFICIENCY_MAPPING = Object.freeze({
  [SUFFICIENCY_VERDICT.SUFFICIENT]: TRUST_ELIGIBILITY_STATUS.TRUST_ELIGIBLE,
  [SUFFICIENCY_VERDICT.INSUFFICIENT]:
    TRUST_ELIGIBILITY_STATUS.NOT_TRUST_ELIGIBLE,
  [SUFFICIENCY_VERDICT.UNAVAILABLE]:
    TRUST_ELIGIBILITY_STATUS.TRUST_UNAVAILABLE,
});

export const AGGREGATE_REF_ALLOWLIST = Object.freeze([
  'aggregateId',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
]);

export const SEGMENTED_POLICY_REF_ALLOWLIST = Object.freeze([
  'policyId',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
  'sliceId',
]);

export const SAMPLE_SUFFICIENCY_REF_ALLOWLIST = Object.freeze([
  'policyId',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
  'sliceId',
  'sufficiencyVerdict',
]);

export const DATA_QUALITY_ELIGIBILITY_ALLOWLIST = Object.freeze([
  'availability',
  'freshnessStatus',
]);

export const POLICY_ARTIFACT_INPUT_ALLOWLIST = Object.freeze([
  'aggregateRef',
  'segmentedPerformancePolicyRef',
  'sampleSufficiencyPolicyRef',
  'cohort',
  'segmentScope',
  'recordedAt',
  'dataQualityEligibilityState',
]);

export const UNSUPPORTED_SEGMENTATION_DIMENSIONS = Object.freeze([
  'regime',
  'marketRegime',
  'bullRegime',
  'bearRegime',
  'volatilityRegime',
  'liquidityRegime',
  'agentRole',
  'agentId',
  'analysisHorizon',
  'market',
  'task',
  'control',
  'horizon',
  'regimeId',
  'regimeLabel',
  'regimeClass',
]);

export const FORBIDDEN_NUMERIC_WEIGHT_FIELDS = Object.freeze([
  'trustScore',
  'weight',
  'agentWeight',
  'confidenceWeight',
  'reliabilityWeight',
  'performanceWeight',
  'baseWeight',
  'normalizedWeight',
  'relativeWeight',
  'absoluteWeight',
  'numericWeight',
  'score',
  'weighting',
]);

export const FORBIDDEN_TRUST_PROMOTION_FIELDS = Object.freeze([
  ...FORBIDDEN_NUMERIC_WEIGHT_FIELDS,
  'trust',
  'trustEligible',
  'weightEligible',
  'promotionEligible',
  'demotionEligible',
  'promotionStatus',
  'demotionStatus',
  'promotionScore',
  'promotionThreshold',
  'demotionThreshold',
  'qualityGrade',
  'pass',
  'fail',
  'good',
  'bad',
  'acceptable',
  'TRUST_HIGH',
  'TRUST_LOW',
  'TRUST_MEDIUM',
  'trustHigh',
  'trustLow',
  'trustMedium',
]);

export const FORBIDDEN_AUTHORITY_OVERRIDE_FIELDS = Object.freeze([
  'authorityClass',
  'sliceId',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
  'schemaVersion',
  'artifactType',
  'ownershipRole',
  'isSourceOfTruth',
  'officialName',
  'trustEligibilityStatus',
  'v1Model',
  'numericWeight',
  'trustScope',
  'weightPolicyVersion',
  'trustModelVersion',
]);

export const FORBIDDEN_CALIBRATION_METRIC_FIELDS = Object.freeze([
  'brier',
  'brierScore',
  'ece',
  'logLoss',
  'reliabilityCurve',
  'calibrationScore',
  'platt',
  'isotonic',
  'temperatureScaling',
]);

export const FORBIDDEN_SECRET_FIELDS = Object.freeze([
  'password',
  'secret',
  'token',
  'apiKey',
  'apiSecret',
  'privateKey',
  'authorization',
  'credential',
  'jwt',
  'bearer',
]);

export const FORBIDDEN_RUNTIME_PERSISTENCE_FIELDS = Object.freeze([
  'persistenceActivation',
  'runtimeActivation',
  'networkActivation',
  'providerActivation',
  'llmActivation',
  'workerActivation',
  'schedulerActivation',
  'dbWrite',
  'redisWrite',
  'persist',
  'save',
  'execute',
  'promote',
  'demote',
  'mutateTrust',
]);

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
  numericWeightAuthorized: false,
  persistentWeightState: false,
});

export const ZERO_TRUST_WEIGHTING_POLICY_SIDE_EFFECTS = Object.freeze({
  networkCallCount: 0,
  providerCallCount: 0,
  dbWriteCount: 0,
  redisWriteCount: 0,
  llmCallCount: 0,
  workerMutationCount: 0,
  schedulerMutationCount: 0,
  runtimeMutationCount: 0,
  persistenceMutationCount: 0,
  trustMutationCount: 0,
  weightMutationCount: 0,
  promotionCount: 0,
  demotionCount: 0,
  calibrationExecutionCount: 0,
  binaryBrierExecutionCount: 0,
  orderCount: 0,
  walletMutationCount: 0,
  financialExecutionCount: 0,
  numericWeightInventionCount: 0,
  thresholdInventionCount: 0,
  regimeInventionCount: 0,
  agentIdentityInventionCount: 0,
});

export const TRUST_WEIGHTING_POLICY_LIMITATIONS = Object.freeze([
  'V1_MODEL=BINARY_EVIDENCE_ELIGIBILITY — no numeric weights',
  'NUMERIC_WEIGHT=NONE / NOT_AUTHORIZED',
  'TRUST_SCOPE=PER_HOMOGENEOUS_CANONICAL_COHORT only',
  'AGENT_LEVEL_TRUST=DEFERRED',
  'REGIME_IDENTITY_CANONICAL=NO',
  'PERSISTENT_WEIGHT_STATE=NO',
  'PROMOTION=NOT_AUTHORIZED',
  'DEMOTION=NOT_AUTHORIZED',
  'TRUST_MUTATION=NOT_AUTHORIZED',
  'CALIBRATION_EXECUTION=NO',
  'BINARY_BRIER_EXECUTION=NO',
  'GLOBAL_AVERAGE_ONLY_BYPASS=CLOSED',
  'LIBRARY_ONLY — no SoT / table / migration / service / runtime',
]);

export const TRUST_WEIGHTING_POLICY_DESCRIPTOR = Object.freeze({
  schemaVersion: TRUST_WEIGHTING_POLICY_SCHEMA_VERSION,
  contractVersion: TRUST_WEIGHTING_POLICY_CONTRACT_VERSION,
  policyVersion: TRUST_WEIGHTING_POLICY_POLICY_VERSION,
  implementationVersion: TRUST_WEIGHTING_POLICY_IMPLEMENTATION_VERSION,
  artifactType: TRUST_WEIGHTING_POLICY_ARTIFACT_TYPE,
  policyType: TRUST_WEIGHTING_POLICY_TYPE,
  authorityClass: TRUST_WEIGHTING_POLICY_AUTHORITY_CLASS,
  riskTier: TRUST_WEIGHTING_POLICY_RISK_TIER,
  sliceId: TRUST_WEIGHTING_POLICY_SLICE_ID,
  officialName: TRUST_WEIGHTING_POLICY_OFFICIAL_NAME,
  ownershipRole: TRUST_WEIGHTING_POLICY_OWNERSHIP_ROLE,
  isSourceOfTruth: TRUST_WEIGHTING_POLICY_IS_SOURCE_OF_TRUTH,
  writer: TRUST_WEIGHTING_POLICY_WRITER,
  methodKey: TRUST_WEIGHTING_POLICY_METHOD_KEY,
  stage: TRUST_WEIGHTING_POLICY_STAGE,
  v1Model: V1_MODEL,
  numericWeight: NUMERIC_WEIGHT,
  trustScope: TRUST_SCOPE,
  agentLevelTrust: AGENT_LEVEL_TRUST,
  persistentWeightState: PERSISTENT_WEIGHT_STATE,
  trustEligibilityStatuses: TRUST_ELIGIBILITY_STATUS,
  sampleSufficiencyMapping: SAMPLE_SUFFICIENCY_MAPPING,
  canonicalSegmentDimensions: AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  regimeIdentityCanonical: REGIME_IDENTITY_CANONICAL,
  globalAverageOnlyBypass: GLOBAL_AVERAGE_ONLY_BYPASS,
  promotion: PROMOTION,
  demotion: DEMOTION,
  calibrationRequired: CALIBRATION_REQUIRED,
  calibrationExecution: CALIBRATION_EXECUTION,
  binaryBrierExecution: BINARY_BRIER_EXECUTION,
  hardFlags: REQUIRED_HARD_FLAGS,
  sideEffects: ZERO_TRUST_WEIGHTING_POLICY_SIDE_EFFECTS,
  limitations: TRUST_WEIGHTING_POLICY_LIMITATIONS,
});

// ─── Error ───────────────────────────────────────────────────────────────────

export class TrustWeightingPolicyContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TrustWeightingPolicyContractError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
    Object.freeze(this);
  }
}

function fail(code, message, details) {
  throw new TrustWeightingPolicyContractError(code, message, details);
}

// ─── Deep freeze / helpers ───────────────────────────────────────────────────

function freezeDeep(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Object.isFrozen(value)) {
    // Still walk children in case shallow freeze was applied
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
  // Use toString (not getPrototypeOf === Object.prototype) so structuredClone /
  // Jest experimental-vm-modules cross-realm plain objects are accepted.
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.prototype.toString.call(value) !== '[object Object]'
  ) {
    fail(code, message);
  }
}

function assertExactString(actual, expected, code, message) {
  if (actual !== expected) {
    fail(code, message, { expected, actual });
  }
}

function assertExactBoolean(actual, expected, code, message) {
  if (actual !== expected) {
    fail(code, message, { expected, actual });
  }
}

function assertAllowlist(obj, allowlist, unknownCode, context) {
  const ownKeys = Reflect.ownKeys(obj).filter((k) => typeof k === 'string');
  const unknown = ownKeys.filter((k) => !allowlist.includes(k));
  if (unknown.length > 0) {
    fail(unknownCode, `Unknown field(s) on ${context}`, { context, unknown });
  }
}

function assertExactOwnKeys(obj, expected, unknownCode, missingCode, context) {
  const ownKeys = Reflect.ownKeys(obj);
  const symbolKeys = ownKeys.filter((key) => typeof key === 'symbol');
  if (symbolKeys.length > 0) {
    fail(unknownCode, `Unknown symbol field(s) on ${context}`, {
      context,
      symbolCount: symbolKeys.length,
    });
  }
  const actual = ownKeys.filter((key) => typeof key === 'string');
  const unknown = actual.filter((key) => !expected.includes(key));
  if (unknown.length > 0) {
    fail(unknownCode, `Unknown field(s) on ${context}`, { context, unknown });
  }
  const missing = expected.filter(
    (key) => !Object.prototype.hasOwnProperty.call(obj, key),
  );
  if (missing.length > 0) {
    fail(missingCode, `Missing required field(s) on ${context}`, {
      context,
      missing,
    });
  }
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJson(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}

function scanForbiddenKeys(obj, forbiddenList, code, context, depth = 0) {
  if (obj === null || typeof obj !== 'object' || depth > 8) {
    return;
  }
  const keys = Reflect.ownKeys(obj).filter((k) => typeof k === 'string');
  for (const key of keys) {
    if (forbiddenList.includes(key)) {
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
  // Authority-override fields are checked TOP-LEVEL ONLY.
  // Nested thin refs (aggregateRef / segmentedPerformancePolicyRef /
  // sampleSufficiencyPolicyRef) legitimately carry contractVersion,
  // policyVersion, implementationVersion, and sliceId for binding.
  for (const key of FORBIDDEN_AUTHORITY_OVERRIDE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_CALLER_AUTHORITY_OVERRIDE',
        `Caller authority override field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_TRUST_PROMOTION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_CALLER_TRUST_PROMOTION_FIELD',
        `Caller trust/promotion field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_NUMERIC_WEIGHT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_CALLER_NUMERIC_WEIGHT_FIELD',
        `Caller numeric weight field forbidden: ${key}`,
        { field: key },
      );
    }
  }
  // Deep-scan remaining contamination classes (safe: thin refs never carry these).
  scanForbiddenKeys(
    input,
    FORBIDDEN_CALIBRATION_METRIC_FIELDS,
    'TRUST_WEIGHTING_POLICY_CALLER_CALIBRATION_FIELD',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_SECRET_FIELDS,
    'TRUST_WEIGHTING_POLICY_SECRET_FIELD_REJECTED',
    'input',
  );
  scanForbiddenKeys(
    input,
    FORBIDDEN_RUNTIME_PERSISTENCE_FIELDS,
    'TRUST_WEIGHTING_POLICY_RUNTIME_PERSISTENCE_FIELD_REJECTED',
    'input',
  );
}

function assertNoUnsupportedSegmentation(obj, context) {
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  const keys = Reflect.ownKeys(obj).filter((k) => typeof k === 'string');
  for (const key of keys) {
    if (UNSUPPORTED_SEGMENTATION_DIMENSIONS.includes(key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_UNSUPPORTED_SEGMENT_DIMENSION',
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
    'TRUST_WEIGHTING_POLICY_COHORT_INVALID',
    'cohort must be a plain object',
  );
  assertNoUnsupportedSegmentation(cohortInput, 'cohort');
  assertAllowlist(
    cohortInput,
    COHORT_DESCRIPTOR_ALLOWLIST,
    'TRUST_WEIGHTING_POLICY_COHORT_UNKNOWN_FIELD',
    'cohort',
  );

  const cohort = {};
  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    if (!Object.prototype.hasOwnProperty.call(cohortInput, dim)) {
      fail(
        'TRUST_WEIGHTING_POLICY_COHORT_DIMENSION_MISSING',
        `Missing required cohort dimension "${dim}"`,
        { dimension: dim },
      );
    }
    const value = cohortInput[dim];
    if (typeof value !== 'string' || value.trim().length === 0) {
      fail(
        'TRUST_WEIGHTING_POLICY_COHORT_DIMENSION_INVALID',
        `Cohort dimension "${dim}" must be a non-empty string`,
        { dimension: dim },
      );
    }
    cohort[dim] = value;
  }

  for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(cohortInput, field)) {
      const value = cohortInput[field];
      if (value !== null && (typeof value !== 'string' || value.trim().length === 0)) {
        fail(
          'TRUST_WEIGHTING_POLICY_COHORT_VERSION_BINDING_INVALID',
          `Cohort version binding "${field}" must be null or a non-empty string`,
          { field },
        );
      }
      cohort[field] = value;
    }
  }

  return freezeDeep(cohort);
}

function assertSegmentScope(segmentScope) {
  if (segmentScope === undefined || segmentScope === null) {
    return SEGMENT_SCOPE.SEGMENTED;
  }
  if (typeof segmentScope !== 'string') {
    fail(
      'TRUST_WEIGHTING_POLICY_SEGMENT_SCOPE_INVALID',
      'segmentScope must be a string',
    );
  }
  if (segmentScope === SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY) {
    fail(
      'TRUST_WEIGHTING_POLICY_GLOBAL_AVERAGE_ONLY_REJECTED',
      'GLOBAL_AVERAGE_ONLY cannot satisfy segmented Trust eligibility',
      { segmentScope },
    );
  }
  if (segmentScope !== SEGMENT_SCOPE.SEGMENTED) {
    fail(
      'TRUST_WEIGHTING_POLICY_SEGMENT_SCOPE_UNSUPPORTED',
      'segmentScope must be SEGMENTED for Trust eligibility',
      { segmentScope },
    );
  }
  return SEGMENT_SCOPE.SEGMENTED;
}

// ─── Thin refs ───────────────────────────────────────────────────────────────

function validateThinAggregateRef(ref) {
  assertPlainObject(
    ref,
    'TRUST_WEIGHTING_POLICY_AGGREGATE_REF_INVALID',
    'aggregateRef must be a plain object',
  );
  assertAllowlist(
    ref,
    AGGREGATE_REF_ALLOWLIST,
    'TRUST_WEIGHTING_POLICY_AGGREGATE_REF_UNKNOWN_FIELD',
    'aggregateRef',
  );
  for (const key of AGGREGATE_REF_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(ref, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_AGGREGATE_REF_MISSING_FIELD',
        `aggregateRef missing required field "${key}"`,
        { field: key },
      );
    }
    if (typeof ref[key] !== 'string' || ref[key].trim().length === 0) {
      fail(
        'TRUST_WEIGHTING_POLICY_AGGREGATE_REF_FIELD_INVALID',
        `aggregateRef.${key} must be a non-empty string`,
        { field: key },
      );
    }
  }
  assertExactString(
    ref.contractVersion,
    EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
    'TRUST_WEIGHTING_POLICY_AGGREGATE_CONTRACT_VERSION_MISMATCH',
    'aggregateRef.contractVersion must match canonical Aggregate contract',
  );
  assertExactString(
    ref.policyVersion,
    EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
    'TRUST_WEIGHTING_POLICY_AGGREGATE_POLICY_VERSION_MISMATCH',
    'aggregateRef.policyVersion must match canonical Aggregate policy',
  );
  assertExactString(
    ref.implementationVersion,
    EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
    'TRUST_WEIGHTING_POLICY_AGGREGATE_IMPLEMENTATION_VERSION_MISMATCH',
    'aggregateRef.implementationVersion must match canonical Aggregate implementation',
  );
  return freezeDeep({
    aggregateId: ref.aggregateId,
    contractVersion: ref.contractVersion,
    policyVersion: ref.policyVersion,
    implementationVersion: ref.implementationVersion,
  });
}

function validateThinSegmentedPolicyRef(ref) {
  assertPlainObject(
    ref,
    'TRUST_WEIGHTING_POLICY_SEGMENTED_REF_INVALID',
    'segmentedPerformancePolicyRef must be a plain object',
  );
  assertAllowlist(
    ref,
    SEGMENTED_POLICY_REF_ALLOWLIST,
    'TRUST_WEIGHTING_POLICY_SEGMENTED_REF_UNKNOWN_FIELD',
    'segmentedPerformancePolicyRef',
  );
  for (const key of SEGMENTED_POLICY_REF_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(ref, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_SEGMENTED_REF_MISSING_FIELD',
        `segmentedPerformancePolicyRef missing required field "${key}"`,
        { field: key },
      );
    }
    if (typeof ref[key] !== 'string' || ref[key].trim().length === 0) {
      fail(
        'TRUST_WEIGHTING_POLICY_SEGMENTED_REF_FIELD_INVALID',
        `segmentedPerformancePolicyRef.${key} must be a non-empty string`,
        { field: key },
      );
    }
  }
  assertExactString(
    ref.contractVersion,
    SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
    'TRUST_WEIGHTING_POLICY_SEGMENTED_CONTRACT_VERSION_MISMATCH',
    'segmentedPerformancePolicyRef.contractVersion mismatch',
  );
  assertExactString(
    ref.policyVersion,
    SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
    'TRUST_WEIGHTING_POLICY_SEGMENTED_POLICY_VERSION_MISMATCH',
    'segmentedPerformancePolicyRef.policyVersion mismatch',
  );
  assertExactString(
    ref.implementationVersion,
    SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    'TRUST_WEIGHTING_POLICY_SEGMENTED_IMPLEMENTATION_VERSION_MISMATCH',
    'segmentedPerformancePolicyRef.implementationVersion mismatch',
  );
  assertExactString(
    ref.sliceId,
    SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
    'TRUST_WEIGHTING_POLICY_SEGMENTED_SLICE_ID_MISMATCH',
    'segmentedPerformancePolicyRef.sliceId mismatch',
  );
  return freezeDeep({
    policyId: ref.policyId,
    contractVersion: ref.contractVersion,
    policyVersion: ref.policyVersion,
    implementationVersion: ref.implementationVersion,
    sliceId: ref.sliceId,
  });
}

function validateThinSampleSufficiencyPolicyRef(ref) {
  if (ref === undefined || ref === null) {
    fail(
      'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_REF_MISSING',
      'sampleSufficiencyPolicyRef is required',
    );
  }
  assertPlainObject(
    ref,
    'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_REF_INVALID',
    'sampleSufficiencyPolicyRef must be a plain object',
  );
  assertAllowlist(
    ref,
    SAMPLE_SUFFICIENCY_REF_ALLOWLIST,
    'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_REF_UNKNOWN_FIELD',
    'sampleSufficiencyPolicyRef',
  );
  for (const key of SAMPLE_SUFFICIENCY_REF_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(ref, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_REF_MISSING_FIELD',
        `sampleSufficiencyPolicyRef missing required field "${key}"`,
        { field: key },
      );
    }
    if (typeof ref[key] !== 'string' || ref[key].trim().length === 0) {
      fail(
        'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_REF_FIELD_INVALID',
        `sampleSufficiencyPolicyRef.${key} must be a non-empty string`,
        { field: key },
      );
    }
  }
  assertExactString(
    ref.contractVersion,
    SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
    'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_CONTRACT_VERSION_MISMATCH',
    'sampleSufficiencyPolicyRef.contractVersion mismatch',
  );
  assertExactString(
    ref.policyVersion,
    SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
    'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_POLICY_VERSION_MISMATCH',
    'sampleSufficiencyPolicyRef.policyVersion mismatch',
  );
  assertExactString(
    ref.implementationVersion,
    SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
    'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_IMPLEMENTATION_VERSION_MISMATCH',
    'sampleSufficiencyPolicyRef.implementationVersion mismatch',
  );
  assertExactString(
    ref.sliceId,
    SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
    'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_SLICE_ID_MISMATCH',
    'sampleSufficiencyPolicyRef.sliceId mismatch',
  );

  const verdict = ref.sufficiencyVerdict;
  if (verdict === SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED) {
    fail(
      'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_VERDICT_UNDEFINED',
      'UNDEFINED_DEFERRED sufficiencyVerdict cannot authorize Trust eligibility',
      { sufficiencyVerdict: verdict },
    );
  }
  if (
    verdict !== SUFFICIENCY_VERDICT.SUFFICIENT
    && verdict !== SUFFICIENCY_VERDICT.INSUFFICIENT
    && verdict !== SUFFICIENCY_VERDICT.UNAVAILABLE
  ) {
    fail(
      'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_VERDICT_UNSUPPORTED',
      'sufficiencyVerdict must be SUFFICIENT, INSUFFICIENT, or UNAVAILABLE',
      { sufficiencyVerdict: verdict },
    );
  }

  return freezeDeep({
    policyId: ref.policyId,
    contractVersion: ref.contractVersion,
    policyVersion: ref.policyVersion,
    implementationVersion: ref.implementationVersion,
    sliceId: ref.sliceId,
    sufficiencyVerdict: verdict,
  });
}

function validateOptionalDataQualityEligibilityState(dq) {
  if (dq === undefined) {
    return null;
  }
  assertPlainObject(
    dq,
    'TRUST_WEIGHTING_POLICY_DQ_INVALID',
    'dataQualityEligibilityState must be a plain object',
  );
  assertAllowlist(
    dq,
    DATA_QUALITY_ELIGIBILITY_ALLOWLIST,
    'TRUST_WEIGHTING_POLICY_DQ_UNKNOWN_FIELD',
    'dataQualityEligibilityState',
  );
  if (
    !Object.prototype.hasOwnProperty.call(dq, 'availability')
    || !Object.prototype.hasOwnProperty.call(dq, 'freshnessStatus')
  ) {
    fail(
      'TRUST_WEIGHTING_POLICY_DQ_MISSING_FIELD',
      'dataQualityEligibilityState requires availability and freshnessStatus',
    );
  }
  if (typeof dq.availability !== 'string') {
    fail(
      'TRUST_WEIGHTING_POLICY_DQ_AVAILABILITY_INVALID',
      'dataQualityEligibilityState.availability must be a string',
    );
  }
  if (typeof dq.freshnessStatus !== 'string') {
    fail(
      'TRUST_WEIGHTING_POLICY_DQ_FRESHNESS_INVALID',
      'dataQualityEligibilityState.freshnessStatus must be a string',
    );
  }
  if (!Object.values(AVAILABILITY).includes(dq.availability)) {
    fail(
      'TRUST_WEIGHTING_POLICY_DQ_AVAILABILITY_UNSUPPORTED',
      'Unsupported dataQualityEligibilityState.availability',
      { availability: dq.availability },
    );
  }
  if (!Object.values(FRESHNESS_STATUS).includes(dq.freshnessStatus)) {
    fail(
      'TRUST_WEIGHTING_POLICY_DQ_FRESHNESS_UNSUPPORTED',
      'Unsupported dataQualityEligibilityState.freshnessStatus',
      { freshnessStatus: dq.freshnessStatus },
    );
  }
  if (dq.availability !== AVAILABILITY.AVAILABLE) {
    fail(
      'TRUST_WEIGHTING_POLICY_DQ_NOT_AVAILABLE',
      'Trust DQ eligibility requires availability=AVAILABLE',
      { availability: dq.availability },
    );
  }
  if (
    dq.freshnessStatus !== FRESHNESS_STATUS.FRESH
    && dq.freshnessStatus !== FRESHNESS_STATUS.AGED
  ) {
    fail(
      'TRUST_WEIGHTING_POLICY_DQ_FRESHNESS_NOT_ELIGIBLE',
      'Trust DQ eligibility requires freshnessStatus FRESH or AGED',
      { freshnessStatus: dq.freshnessStatus },
    );
  }
  return freezeDeep({
    availability: dq.availability,
    freshnessStatus: dq.freshnessStatus,
  });
}

function mapSufficiencyToTrustEligibility(sufficiencyVerdict) {
  const mapped = SAMPLE_SUFFICIENCY_MAPPING[sufficiencyVerdict];
  if (mapped === undefined) {
    fail(
      'TRUST_WEIGHTING_POLICY_MAPPING_UNAVAILABLE',
      'Cannot map sufficiencyVerdict to Trust eligibility',
      { sufficiencyVerdict },
    );
  }
  return mapped;
}

function computePolicyId({
  cohort,
  segmentScope,
  aggregateRef,
  segmentedPerformancePolicyRef,
  sampleSufficiencyPolicyRef,
  trustEligibilityStatus,
}) {
  const material = {
    contractVersion: TRUST_WEIGHTING_POLICY_CONTRACT_VERSION,
    policyVersion: TRUST_WEIGHTING_POLICY_POLICY_VERSION,
    implementationVersion: TRUST_WEIGHTING_POLICY_IMPLEMENTATION_VERSION,
    v1Model: V1_MODEL,
    trustScope: TRUST_SCOPE,
    segmentScope,
    cohort,
    aggregateId: aggregateRef.aggregateId,
    segmentedPolicyId: segmentedPerformancePolicyRef.policyId,
    sampleSufficiencyPolicyId: sampleSufficiencyPolicyRef.policyId,
    sufficiencyVerdict: sampleSufficiencyPolicyRef.sufficiencyVerdict,
    trustEligibilityStatus,
  };
  return hashToUuid(`artemis.trust_weighting_policy.v1:${stableJson(material)}`);
}

// ─── Descriptor API ──────────────────────────────────────────────────────────

export function getTrustWeightingPolicyDescriptor() {
  return TRUST_WEIGHTING_POLICY_DESCRIPTOR;
}

export function validateTrustWeightingPolicyDescriptor(descriptor) {
  assertPlainObject(
    descriptor,
    'TRUST_WEIGHTING_POLICY_DESCRIPTOR_INVALID',
    'Descriptor must be a plain object',
  );
  const expected = getTrustWeightingPolicyDescriptor();
  if (stableJson(descriptor) !== stableJson(expected)) {
    fail(
      'TRUST_WEIGHTING_POLICY_DESCRIPTOR_MISMATCH',
      'Descriptor does not match canonical Trust Weighting Policy descriptor',
    );
  }
  return freezeDeep(structuredClone(expected));
}

// ─── Build artifact ──────────────────────────────────────────────────────────

export function buildTrustWeightingPolicyArtifact(input) {
  assertPlainObject(
    input,
    'TRUST_WEIGHTING_POLICY_INPUT_INVALID',
    'Input must be a plain object',
  );
  assertAllowlist(
    input,
    POLICY_ARTIFACT_INPUT_ALLOWLIST,
    'TRUST_WEIGHTING_POLICY_INPUT_UNKNOWN_FIELD',
    'input',
  );
  assertNoCallerAuthorityOverrides(input);

  if (!Object.prototype.hasOwnProperty.call(input, 'aggregateRef')) {
    fail(
      'TRUST_WEIGHTING_POLICY_AGGREGATE_REF_MISSING',
      'aggregateRef is required',
    );
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'segmentedPerformancePolicyRef')) {
    fail(
      'TRUST_WEIGHTING_POLICY_SEGMENTED_REF_MISSING',
      'segmentedPerformancePolicyRef is required',
    );
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'sampleSufficiencyPolicyRef')) {
    fail(
      'TRUST_WEIGHTING_POLICY_SAMPLE_SUFFICIENCY_REF_MISSING',
      'sampleSufficiencyPolicyRef is required',
    );
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'cohort')) {
    fail(
      'TRUST_WEIGHTING_POLICY_COHORT_MISSING',
      'cohort is required',
    );
  }

  const aggregateRef = validateThinAggregateRef(input.aggregateRef);
  const segmentedPerformancePolicyRef = validateThinSegmentedPolicyRef(
    input.segmentedPerformancePolicyRef,
  );
  const sampleSufficiencyPolicyRef = validateThinSampleSufficiencyPolicyRef(
    input.sampleSufficiencyPolicyRef,
  );
  const cohort = extractCohort(input.cohort);
  const segmentScope = assertSegmentScope(input.segmentScope);
  const dataQualityEligibilityState = validateOptionalDataQualityEligibilityState(
    Object.prototype.hasOwnProperty.call(input, 'dataQualityEligibilityState')
      ? input.dataQualityEligibilityState
      : undefined,
  );

  let recordedAt = null;
  if (Object.prototype.hasOwnProperty.call(input, 'recordedAt')) {
    if (input.recordedAt !== null) {
      if (typeof input.recordedAt !== 'string' || input.recordedAt.trim().length === 0) {
        fail(
          'TRUST_WEIGHTING_POLICY_RECORDED_AT_INVALID',
          'recordedAt must be null or a non-empty string',
        );
      }
      recordedAt = input.recordedAt;
    }
  }

  const trustEligibilityStatus = mapSufficiencyToTrustEligibility(
    sampleSufficiencyPolicyRef.sufficiencyVerdict,
  );

  const policyId = computePolicyId({
    cohort,
    segmentScope,
    aggregateRef,
    segmentedPerformancePolicyRef,
    sampleSufficiencyPolicyRef,
    trustEligibilityStatus,
  });

  const artifact = {
    schemaVersion: TRUST_WEIGHTING_POLICY_SCHEMA_VERSION,
    contractVersion: TRUST_WEIGHTING_POLICY_CONTRACT_VERSION,
    policyVersion: TRUST_WEIGHTING_POLICY_POLICY_VERSION,
    implementationVersion: TRUST_WEIGHTING_POLICY_IMPLEMENTATION_VERSION,
    artifactType: TRUST_WEIGHTING_POLICY_ARTIFACT_TYPE,
    policyType: TRUST_WEIGHTING_POLICY_TYPE,
    authorityClass: TRUST_WEIGHTING_POLICY_AUTHORITY_CLASS,
    riskTier: TRUST_WEIGHTING_POLICY_RISK_TIER,
    sliceId: TRUST_WEIGHTING_POLICY_SLICE_ID,
    officialName: TRUST_WEIGHTING_POLICY_OFFICIAL_NAME,
    ownershipRole: TRUST_WEIGHTING_POLICY_OWNERSHIP_ROLE,
    isSourceOfTruth: false,
    trustWeightingOwner: TRUST_WEIGHTING_OWNER,
    policyId,
    recordedAt,
    segmentScope,
    cohort,
    aggregateRef,
    segmentedPerformancePolicyRef,
    sampleSufficiencyPolicyRef,
    dataQualityEligibilityState,
    v1Model: V1_MODEL,
    trustScope: TRUST_SCOPE,
    agentLevelTrust: AGENT_LEVEL_TRUST,
    persistentWeightState: PERSISTENT_WEIGHT_STATE,
    trustEligibilityStatus,
    sampleSufficiencyVerdict: sampleSufficiencyPolicyRef.sufficiencyVerdict,
    regimeIdentityCanonical: false,
    globalAverageOnly: GLOBAL_AVERAGE_ONLY,
    globalAverageOnlyBypass: GLOBAL_AVERAGE_ONLY_BYPASS,
    trustMutation: false,
    promotion: PROMOTION,
    demotion: DEMOTION,
    calibrationRequired: CALIBRATION_REQUIRED,
    calibrationExecution: false,
    binaryBrierExecution: false,
    hardFlags: { ...REQUIRED_HARD_FLAGS },
    sideEffects: { ...ZERO_TRUST_WEIGHTING_POLICY_SIDE_EFFECTS },
    limitations: [...TRUST_WEIGHTING_POLICY_LIMITATIONS],
    provenance: freezeDeep({
      writer: TRUST_WEIGHTING_POLICY_WRITER,
      methodKey: TRUST_WEIGHTING_POLICY_METHOD_KEY,
      stage: TRUST_WEIGHTING_POLICY_STAGE,
      sampleSufficiencyMappingApplied: true,
    }),
  };

  return freezeDeep(artifact);
}

// ─── Validate artifact ───────────────────────────────────────────────────────

const TRUST_WEIGHTING_POLICY_ARTIFACT_TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
  'artifactType',
  'policyType',
  'authorityClass',
  'riskTier',
  'sliceId',
  'officialName',
  'ownershipRole',
  'isSourceOfTruth',
  'trustWeightingOwner',
  'policyId',
  'recordedAt',
  'segmentScope',
  'cohort',
  'aggregateRef',
  'segmentedPerformancePolicyRef',
  'sampleSufficiencyPolicyRef',
  'dataQualityEligibilityState',
  'v1Model',
  'trustScope',
  'agentLevelTrust',
  'persistentWeightState',
  'trustEligibilityStatus',
  'sampleSufficiencyVerdict',
  'regimeIdentityCanonical',
  'globalAverageOnly',
  'globalAverageOnlyBypass',
  'trustMutation',
  'promotion',
  'demotion',
  'calibrationRequired',
  'calibrationExecution',
  'binaryBrierExecution',
  'hardFlags',
  'sideEffects',
  'limitations',
  'provenance',
]);

function buildInputFromArtifact(artifact) {
  const input = {
    aggregateRef: structuredClone(artifact.aggregateRef),
    segmentedPerformancePolicyRef: structuredClone(
      artifact.segmentedPerformancePolicyRef,
    ),
    sampleSufficiencyPolicyRef: structuredClone(
      artifact.sampleSufficiencyPolicyRef,
    ),
    cohort: structuredClone(artifact.cohort),
    segmentScope: artifact.segmentScope,
    recordedAt: artifact.recordedAt,
  };
  if (artifact.dataQualityEligibilityState !== null) {
    input.dataQualityEligibilityState = structuredClone(
      artifact.dataQualityEligibilityState,
    );
  }
  return input;
}

function assertCanonicalArtifactShape(artifact) {
  assertExactOwnKeys(
    artifact,
    TRUST_WEIGHTING_POLICY_ARTIFACT_TOP_LEVEL_KEYS,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_UNKNOWN_FIELD',
    'TRUST_WEIGHTING_POLICY_ARTIFACT_MISSING_FIELD',
    'artifact',
  );

  assertExactString(
    artifact.schemaVersion,
    TRUST_WEIGHTING_POLICY_SCHEMA_VERSION,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_SCHEMA_VERSION_MISMATCH',
    'schemaVersion mismatch',
  );
  assertExactString(
    artifact.contractVersion,
    TRUST_WEIGHTING_POLICY_CONTRACT_VERSION,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_CONTRACT_VERSION_MISMATCH',
    'contractVersion mismatch',
  );
  assertExactString(
    artifact.policyVersion,
    TRUST_WEIGHTING_POLICY_POLICY_VERSION,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_POLICY_VERSION_MISMATCH',
    'policyVersion mismatch',
  );
  assertExactString(
    artifact.implementationVersion,
    TRUST_WEIGHTING_POLICY_IMPLEMENTATION_VERSION,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_IMPLEMENTATION_VERSION_MISMATCH',
    'implementationVersion mismatch',
  );
  assertExactString(
    artifact.artifactType,
    TRUST_WEIGHTING_POLICY_ARTIFACT_TYPE,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_ARTIFACT_TYPE_MISMATCH',
    'artifactType mismatch',
  );
  assertExactString(
    artifact.policyType,
    TRUST_WEIGHTING_POLICY_TYPE,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_POLICY_TYPE_MISMATCH',
    'policyType mismatch',
  );
  assertExactString(
    artifact.authorityClass,
    TRUST_WEIGHTING_POLICY_AUTHORITY_CLASS,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_AUTHORITY_CLASS_MISMATCH',
    'authorityClass mismatch',
  );
  assertExactString(
    artifact.riskTier,
    TRUST_WEIGHTING_POLICY_RISK_TIER,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_RISK_TIER_MISMATCH',
    'riskTier mismatch',
  );
  assertExactString(
    artifact.sliceId,
    TRUST_WEIGHTING_POLICY_SLICE_ID,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_SLICE_ID_MISMATCH',
    'sliceId mismatch',
  );
  assertExactString(
    artifact.officialName,
    TRUST_WEIGHTING_POLICY_OFFICIAL_NAME,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_OFFICIAL_NAME_MISMATCH',
    'officialName mismatch',
  );
  assertExactString(
    artifact.ownershipRole,
    TRUST_WEIGHTING_POLICY_OWNERSHIP_ROLE,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_OWNERSHIP_ROLE_MISMATCH',
    'ownershipRole mismatch',
  );
  assertExactBoolean(
    artifact.isSourceOfTruth,
    false,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_IS_SOT_MISMATCH',
    'isSourceOfTruth must be false',
  );
  assertExactString(
    artifact.trustWeightingOwner,
    TRUST_WEIGHTING_OWNER,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_OWNER_MISMATCH',
    'trustWeightingOwner mismatch',
  );
  assertExactString(
    artifact.v1Model,
    V1_MODEL,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_V1_MODEL_MISMATCH',
    'v1Model mismatch',
  );
  assertExactString(
    artifact.trustScope,
    TRUST_SCOPE,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_TRUST_SCOPE_MISMATCH',
    'trustScope mismatch',
  );
  assertExactString(
    artifact.agentLevelTrust,
    AGENT_LEVEL_TRUST,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_AGENT_LEVEL_TRUST_MISMATCH',
    'agentLevelTrust mismatch',
  );
  assertExactString(
    artifact.persistentWeightState,
    PERSISTENT_WEIGHT_STATE,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_PERSISTENT_WEIGHT_STATE_MISMATCH',
    'persistentWeightState mismatch',
  );
  if (!TRUST_ELIGIBILITY_STATUS_VALUES.includes(artifact.trustEligibilityStatus)) {
    fail(
      'TRUST_WEIGHTING_POLICY_ARTIFACT_TRUST_STATUS_INVALID',
      'trustEligibilityStatus must be a canonical Trust eligibility value',
      { actual: artifact.trustEligibilityStatus },
    );
  }
  assertExactBoolean(
    artifact.regimeIdentityCanonical,
    false,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_REGIME_IDENTITY_MISMATCH',
    'regimeIdentityCanonical must be false',
  );
  assertExactString(
    artifact.globalAverageOnly,
    GLOBAL_AVERAGE_ONLY,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_GLOBAL_AVERAGE_MISMATCH',
    'globalAverageOnly mismatch',
  );
  assertExactString(
    artifact.globalAverageOnlyBypass,
    GLOBAL_AVERAGE_ONLY_BYPASS,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_GLOBAL_AVERAGE_BYPASS_MISMATCH',
    'globalAverageOnlyBypass mismatch',
  );
  assertExactBoolean(
    artifact.trustMutation,
    false,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_TRUST_MUTATION_MISMATCH',
    'trustMutation must be false',
  );
  assertExactString(
    artifact.promotion,
    PROMOTION,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_PROMOTION_MISMATCH',
    'promotion mismatch',
  );
  assertExactString(
    artifact.demotion,
    DEMOTION,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_DEMOTION_MISMATCH',
    'demotion mismatch',
  );
  assertExactString(
    artifact.calibrationRequired,
    CALIBRATION_REQUIRED,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_CALIBRATION_REQUIRED_MISMATCH',
    'calibrationRequired mismatch',
  );
  assertExactBoolean(
    artifact.calibrationExecution,
    false,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_CALIBRATION_EXECUTION_MISMATCH',
    'calibrationExecution must be false',
  );
  assertExactBoolean(
    artifact.binaryBrierExecution,
    false,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_BINARY_BRIER_EXECUTION_MISMATCH',
    'binaryBrierExecution must be false',
  );

  if (typeof artifact.policyId !== 'string' || artifact.policyId.trim().length === 0) {
    fail(
      'TRUST_WEIGHTING_POLICY_ARTIFACT_POLICY_ID_INVALID',
      'policyId must be a non-empty string',
    );
  }
  if (
    artifact.recordedAt !== null
    && (typeof artifact.recordedAt !== 'string' || artifact.recordedAt.trim().length === 0)
  ) {
    fail(
      'TRUST_WEIGHTING_POLICY_ARTIFACT_RECORDED_AT_INVALID',
      'recordedAt must be null or a non-empty string',
    );
  }
  if (artifact.segmentScope !== SEGMENT_SCOPE.SEGMENTED) {
    fail(
      'TRUST_WEIGHTING_POLICY_ARTIFACT_SEGMENT_SCOPE_INVALID',
      'segmentScope must be SEGMENTED',
      { actual: artifact.segmentScope },
    );
  }

  // Reject numeric weight fields if smuggled somehow
  scanForbiddenKeys(
    artifact,
    FORBIDDEN_NUMERIC_WEIGHT_FIELDS,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_NUMERIC_WEIGHT_FIELD',
    'artifact',
  );

  // hardFlags
  assertPlainObject(
    artifact.hardFlags,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_HARD_FLAGS_INVALID',
    'hardFlags must be a plain object',
  );
  assertExactOwnKeys(
    artifact.hardFlags,
    Object.keys(REQUIRED_HARD_FLAGS),
    'TRUST_WEIGHTING_POLICY_ARTIFACT_HARD_FLAGS_UNKNOWN_FIELD',
    'TRUST_WEIGHTING_POLICY_ARTIFACT_HARD_FLAGS_MISSING_FIELD',
    'hardFlags',
  );
  for (const [key, expected] of Object.entries(REQUIRED_HARD_FLAGS)) {
    assertExactBoolean(
      artifact.hardFlags[key],
      expected,
      'TRUST_WEIGHTING_POLICY_ARTIFACT_HARD_FLAG_MISMATCH',
      `hardFlags.${key} mismatch`,
    );
  }

  // sideEffects
  assertPlainObject(
    artifact.sideEffects,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_SIDE_EFFECTS_INVALID',
    'sideEffects must be a plain object',
  );
  assertExactOwnKeys(
    artifact.sideEffects,
    Object.keys(ZERO_TRUST_WEIGHTING_POLICY_SIDE_EFFECTS),
    'TRUST_WEIGHTING_POLICY_ARTIFACT_SIDE_EFFECTS_UNKNOWN_FIELD',
    'TRUST_WEIGHTING_POLICY_ARTIFACT_SIDE_EFFECTS_MISSING_FIELD',
    'sideEffects',
  );
  for (const [key, expected] of Object.entries(ZERO_TRUST_WEIGHTING_POLICY_SIDE_EFFECTS)) {
    if (artifact.sideEffects[key] !== expected) {
      fail(
        'TRUST_WEIGHTING_POLICY_ARTIFACT_SIDE_EFFECT_NONZERO',
        `sideEffects.${key} must be ${expected}`,
        { key, expected, actual: artifact.sideEffects[key] },
      );
    }
  }

  if (!Array.isArray(artifact.limitations)) {
    fail(
      'TRUST_WEIGHTING_POLICY_ARTIFACT_LIMITATIONS_INVALID',
      'limitations must be an array',
    );
  }
  assertPlainObject(
    artifact.provenance,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_PROVENANCE_INVALID',
    'provenance must be a plain object',
  );
}

function assertCanonicalArtifactEqualsRebuild(artifact, rebuilt) {
  if (stableJson(artifact) !== stableJson(rebuilt)) {
    fail(
      'TRUST_WEIGHTING_POLICY_ARTIFACT_REBUILD_MISMATCH',
      'Artifact does not equal canonical rebuild',
    );
  }
}

/**
 * Artifact-side authority surface check (Sample Sufficiency pattern).
 * Does NOT reject canonical authorityClass / sliceId / versions /
 * trustEligibilityStatus — those are required on the built artifact and
 * are re-derived via rebuild equality. Caller input overrides remain
 * gated by assertNoCallerAuthorityOverrides at build time only.
 *
 * Top-level only: nested hardFlags intentionally carry persistenceActivation
 * etc. as hard-false authority flags and must not be treated as smuggling.
 */
function assertValidatedArtifactAuthoritySurface(artifact) {
  for (const key of FORBIDDEN_TRUST_PROMOTION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(artifact, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_ARTIFACT_TRUST_PROMOTION_FIELD',
        `Caller trust/promotion field forbidden on artifact: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_SECRET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(artifact, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_SECRET_FIELD_REJECTED',
        `Secret-bearing field forbidden on artifact: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_RUNTIME_PERSISTENCE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(artifact, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_RUNTIME_PERSISTENCE_FIELD_REJECTED',
        `Runtime/persistence field forbidden on artifact: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_CALIBRATION_METRIC_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(artifact, key)) {
      fail(
        'TRUST_WEIGHTING_POLICY_CALLER_CALIBRATION_FIELD',
        `Calibration field forbidden on artifact: ${key}`,
        { field: key },
      );
    }
  }
}

export function validateTrustWeightingPolicyArtifact(input) {
  assertPlainObject(
    input,
    'TRUST_WEIGHTING_POLICY_ARTIFACT_INVALID',
    'Artifact must be a plain object',
  );

  const artifact = input;
  assertCanonicalArtifactShape(artifact);
  assertValidatedArtifactAuthoritySurface(artifact);

  // Re-validate thin refs and mapping consistency
  validateThinAggregateRef(artifact.aggregateRef);
  validateThinSegmentedPolicyRef(artifact.segmentedPerformancePolicyRef);
  const ssRef = validateThinSampleSufficiencyPolicyRef(
    artifact.sampleSufficiencyPolicyRef,
  );
  extractCohort(artifact.cohort);

  const expectedStatus = mapSufficiencyToTrustEligibility(ssRef.sufficiencyVerdict);
  if (artifact.trustEligibilityStatus !== expectedStatus) {
    fail(
      'TRUST_WEIGHTING_POLICY_ARTIFACT_TRUST_STATUS_MAPPING_MISMATCH',
      'trustEligibilityStatus must match Sample Sufficiency mapping',
      {
        sufficiencyVerdict: ssRef.sufficiencyVerdict,
        expected: expectedStatus,
        actual: artifact.trustEligibilityStatus,
      },
    );
  }
  if (artifact.sampleSufficiencyVerdict !== ssRef.sufficiencyVerdict) {
    fail(
      'TRUST_WEIGHTING_POLICY_ARTIFACT_SAMPLE_SUFFICIENCY_VERDICT_MISMATCH',
      'sampleSufficiencyVerdict must match sampleSufficiencyPolicyRef.sufficiencyVerdict',
    );
  }

  if (artifact.dataQualityEligibilityState !== null) {
    validateOptionalDataQualityEligibilityState(artifact.dataQualityEligibilityState);
  }

  const rebuilt = buildTrustWeightingPolicyArtifact(buildInputFromArtifact(artifact));

  if (rebuilt.policyId !== artifact.policyId) {
    fail(
      'TRUST_WEIGHTING_POLICY_ARTIFACT_IDENTITY_MISMATCH',
      'policyId does not match canonical re-derivation',
      { claimed: artifact.policyId, expected: rebuilt.policyId },
    );
  }

  assertCanonicalArtifactEqualsRebuild(artifact, rebuilt);
  return rebuilt;
}

export function assertNotGlobalAverageOnlyAsSegmentedTrustEvidence(segmentScope) {
  if (segmentScope === SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY) {
    fail(
      'TRUST_WEIGHTING_POLICY_GLOBAL_AVERAGE_ONLY_REJECTED',
      'GLOBAL_AVERAGE_ONLY cannot satisfy segmented Trust eligibility',
    );
  }
}

// ─── Public API surface ──────────────────────────────────────────────────────
// Intentionally ABSENT:
//   setWeight, setTrustScore, markTrustEligible, markNotTrustEligible,
//   computeWeight, normalizeWeights, equalWeights, promote, demote,
//   mutateTrust, inventRegime, inventAgentTrust, executeBrier, executeEce

export default Object.freeze({
  TRUST_WEIGHTING_POLICY_SCHEMA_VERSION,
  TRUST_WEIGHTING_POLICY_CONTRACT_VERSION,
  TRUST_WEIGHTING_POLICY_POLICY_VERSION,
  TRUST_WEIGHTING_POLICY_IMPLEMENTATION_VERSION,
  TRUST_WEIGHTING_POLICY_ARTIFACT_TYPE,
  TRUST_WEIGHTING_POLICY_TYPE,
  TRUST_WEIGHTING_POLICY_AUTHORITY_CLASS,
  TRUST_WEIGHTING_POLICY_RISK_TIER,
  TRUST_WEIGHTING_POLICY_SLICE_ID,
  TRUST_WEIGHTING_POLICY_OFFICIAL_NAME,
  TRUST_WEIGHTING_POLICY_OWNERSHIP_ROLE,
  TRUST_WEIGHTING_POLICY_IS_SOURCE_OF_TRUTH,
  TRUST_WEIGHTING_POLICY_WRITER,
  TRUST_WEIGHTING_POLICY_METHOD_KEY,
  TRUST_WEIGHTING_POLICY_STAGE,
  TRUST_WEIGHTING_OWNER,
  V1_MODEL,
  NUMERIC_WEIGHT,
  TRUST_SCOPE,
  AGENT_LEVEL_TRUST,
  PERSISTENT_WEIGHT_STATE,
  TRUST_ELIGIBILITY_STATUS,
  TRUST_ELIGIBILITY_STATUS_VALUES,
  SAMPLE_SUFFICIENCY_MAPPING,
  AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  CANONICAL_SEGMENT_DIMENSION_ORDER,
  CANONICAL_VERSION_BINDING_FIELDS,
  COHORT_DESCRIPTOR_ALLOWLIST,
  SEGMENT_SCOPE,
  REGIME_IDENTITY_CANONICAL,
  REGIME_CLASSIFIER,
  REGIME_CREATION,
  GLOBAL_AVERAGE_ONLY,
  GLOBAL_AVERAGE_ONLY_BYPASS,
  TRUST_MUTATION,
  PROMOTION,
  DEMOTION,
  CALIBRATION_EXECUTION,
  BINARY_BRIER_EXECUTION,
  CALIBRATION_REQUIRED,
  UNSUPPORTED_SEGMENTATION_DIMENSIONS,
  FORBIDDEN_NUMERIC_WEIGHT_FIELDS,
  FORBIDDEN_TRUST_PROMOTION_FIELDS,
  FORBIDDEN_AUTHORITY_OVERRIDE_FIELDS,
  FORBIDDEN_CALIBRATION_METRIC_FIELDS,
  REQUIRED_HARD_FLAGS,
  ZERO_TRUST_WEIGHTING_POLICY_SIDE_EFFECTS,
  TRUST_WEIGHTING_POLICY_LIMITATIONS,
  TRUST_WEIGHTING_POLICY_DESCRIPTOR,
  TrustWeightingPolicyContractError,
  getTrustWeightingPolicyDescriptor,
  validateTrustWeightingPolicyDescriptor,
  buildTrustWeightingPolicyArtifact,
  validateTrustWeightingPolicyArtifact,
  assertNotGlobalAverageOnlyAsSegmentedTrustEvidence,
});
