/**
 * Artemis Sample Sufficiency Policy Contract
 *
 * Stage 10 — S10-SAMPLE-SUFFICIENCY-POLICY-CONTRACT
 * Official: ARTEMIS_SAMPLE_SUFFICIENCY_POLICY_CONTRACT_BOUNDARY
 * Authority: OUTCOME_EVALUATION · Risk Tier 3
 *
 * Deterministic, non-executing, library-only semantic/validation boundary.
 * Canonical owner for future sample-sufficiency semantics required before
 * Trust/Weighting and Promotion/Demotion.
 *
 * Owner-authorized Sample Sufficiency Threshold Policy (COUNT_ONLY).
 * SAMPLE_SUFFICIENCY_THRESHOLD_POLICY =
 *   COUNT_ONLY / MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT=50 / AUTHORIZED
 * SAMPLE_SUFFICIENCY_POLICY = DEFINED / COUNT_ONLY
 * SUFFICIENCY_SCOPE = PER_HOMOGENEOUS_CANONICAL_COHORT
 * SUFFICIENCY_METHOD = COUNT_ONLY
 * MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT = 50 (Owner governance - not caller configurable)
 *
 * Caller-supplied sufficient/insufficient/minimumN/threshold authority FAIL_CLOSED.
 * Threshold 50 is canonical Owner governance - NOT invention.
 *
 * NOT Source of Truth. No regime classifier. No trust/weight/promotion/demotion.
 * No calibration / Brier execution. No Aggregate performance computation.
 * GLOBAL_AVERAGE_ONLY presented as segmented evidence = FAIL_CLOSED.
 * CALIBRATION_SUFFICIENCY = DORMANT / SEPARATE.
 */

import { hashToUuid } from './artemisReplayContract.js';
import {
  EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
  EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
} from './artemisEvaluationPerformanceAggregateContract.js';
import {
  SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
} from './artemisSegmentedPerformancePolicyContract.js';
import {
  EVALUATION_STATUS,
  OBSERVATION_CLASS,
} from './artemisObservedOutcomeEvaluationContract.js';
import {
  AVAILABILITY,
  FRESHNESS_STATUS,
} from './artemisEvidenceContract.js';

// ─── Canonical identity ──────────────────────────────────────────────────────

export const SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION = '1.1.0';
export const SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION =
  'artemis-sample-sufficiency-policy-1.1.0';
export const SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION =
  'artemis-sample-sufficiency-policy-policy-1.1.0';
export const SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION = '1.1.0';
export const SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TYPE =
  'ARTEMIS_SAMPLE_SUFFICIENCY_POLICY';
export const SAMPLE_SUFFICIENCY_POLICY_TYPE = 'SAMPLE_SUFFICIENCY_POLICY';
export const SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS = 'OUTCOME_EVALUATION';
export const SAMPLE_SUFFICIENCY_POLICY_RISK_TIER = 'Tier 3';
export const SAMPLE_SUFFICIENCY_POLICY_SLICE_ID =
  'S10-SAMPLE-SUFFICIENCY-POLICY-CONTRACT';
export const SAMPLE_SUFFICIENCY_POLICY_OFFICIAL_NAME =
  'ARTEMIS_SAMPLE_SUFFICIENCY_POLICY_CONTRACT_BOUNDARY';
export const SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const SAMPLE_SUFFICIENCY_POLICY_IS_SOURCE_OF_TRUTH = false;
export const SAMPLE_SUFFICIENCY_POLICY_WRITER =
  'artemisSampleSufficiencyPolicyContract';
export const SAMPLE_SUFFICIENCY_POLICY_METHOD_KEY =
  'artemis.sample.sufficiency.policy.v1';
export const SAMPLE_SUFFICIENCY_POLICY_STAGE = 'ARTEMIS_CORE_STAGE_10';

export const CALLER_SELF_REGISTRATION = false;
export const METHOD_REGISTRATION_OWNER = 'NONE';

/** Max UTF-8 bytes for a validated descriptor / policy artifact. */
export const MAX_SAMPLE_SUFFICIENCY_POLICY_BYTES = 65536;

// ─── Policy state (Owner-authorized COUNT_ONLY threshold) ────────────────────

/**
 * Canonical sample-sufficiency policy state.
 * Owner-authorized COUNT_ONLY threshold policy is now DEFINED.
 */
export const SAMPLE_SUFFICIENCY_POLICY = 'DEFINED / COUNT_ONLY';

/**
 * Canonical threshold-policy state (Owner OD-SS-TP).
 * MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT=50 is Owner governance - not invention.
 */
export const SAMPLE_SUFFICIENCY_THRESHOLD_POLICY =
  'COUNT_ONLY / MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT=50 / AUTHORIZED';

/** Owner-approved minimum eligible observations per homogeneous canonical cohort. */
export const MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT = 50;

/** Sufficiency is evaluated per homogeneous canonical cohort only. */
export const SUFFICIENCY_SCOPE = 'PER_HOMOGENEOUS_CANONICAL_COHORT';

/** V1 sufficiency method - count eligible observations only. */
export const SUFFICIENCY_METHOD = 'COUNT_ONLY';

/**
 * Calibration sample sufficiency remains dormant / separate from this COUNT_ONLY
 * directional-performance threshold policy.
 */
export const CALIBRATION_SUFFICIENCY = 'DORMANT / SEPARATE';

/**
 * Canonical sufficiency verdicts for COUNT_ONLY threshold policy.
 * SUFFICIENT = eligible count >= 50
 * INSUFFICIENT = known eligible count > 0 and < 50
 * UNAVAILABLE = required count/identity/evidence unavailable
 * UNDEFINED_DEFERRED reserved for absent-policy semantic (not used while policy DEFINED)
 */
export const SUFFICIENCY_VERDICT = Object.freeze({
  SUFFICIENT: 'SUFFICIENT',
  INSUFFICIENT: 'INSUFFICIENT',
  UNAVAILABLE: 'UNAVAILABLE',
  UNDEFINED_DEFERRED: 'UNDEFINED / DEFERRED',
});
export const SUFFICIENCY_VERDICT_VALUES = Object.freeze(
  Object.values(SUFFICIENCY_VERDICT),
);

export const SAMPLE_SUFFICIENCY_OWNER =
  'artemisSampleSufficiencyPolicyContract';

export const THRESHOLD_INVENTION = 'FORBIDDEN';
export const SAMPLE_SIZE_INVENTION = 'FORBIDDEN';

export const REGIME_IDENTITY_CANONICAL = false;
export const REGIME_CLASSIFIER = false;
export const REGIME_CREATION = false;

export const GLOBAL_AVERAGE_ONLY = 'NOT_SUFFICIENT_FOR_STAGE10';
export const GLOBAL_AVERAGE_ONLY_BYPASS = 'CLOSED';

export const TRUST_WEIGHTING = 'NOT_AUTHORIZED';
export const PROMOTION = 'NOT_AUTHORIZED';
export const DEMOTION = 'NOT_AUTHORIZED';
export const CALIBRATION_EXECUTION = false;
export const BINARY_BRIER_EXECUTION = false;

/** Canonical segment dimensions inherited from closed Stage 10 foundation. */
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

export const DOWNSTREAM_GATING = Object.freeze({
  trustWeighting: 'NOT_AUTHORIZED',
  promotion: 'NOT_AUTHORIZED',
  demotion: 'NOT_AUTHORIZED',
  calibrationExecution: 'NOT_AUTHORIZED',
  reason:
    'SAMPLE_SUFFICIENCY_THRESHOLD_POLICY_AUTHORIZED_TRUST_PROMOTION_DEMOTION_NOT_AUTHORIZED',
});

// ─── Forbidden vocabularies ──────────────────────────────────────────────────

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

export const FORBIDDEN_THRESHOLD_FIELDS = Object.freeze([
  'minimumN',
  'minSampleSize',
  'minimumObservations',
  'minimumSegmentCount',
  'segmentMinimum',
  'minN',
  'sampleThreshold',
  'sufficiencyThreshold',
  'confidenceThreshold',
  'significanceLevel',
  'powerThreshold',
  'statisticalPower',
  'pValue',
  'confidenceIntervalThreshold',
  'requiredSampleSize',
  'sampleSizePolicy',
  'threshold',
]);

export const FORBIDDEN_VERDICT_AUTHORITY_FIELDS = Object.freeze([
  'sufficient',
  'insufficient',
  'sampleSufficient',
  'sufficiencyVerdict',
  'isSufficient',
  'isInsufficient',
  'verdict',
]);

export const FORBIDDEN_TRUST_PROMOTION_FIELDS = Object.freeze([
  'trustScore',
  'weight',
  'agentWeight',
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
]);

export const FORBIDDEN_CALIBRATION_METRIC_FIELDS = Object.freeze([
  'calibrationScore',
  'brier',
  'brierScore',
  'binaryBrier',
  'ece',
  'logLoss',
  'probabilityAdjustment',
  'adjustedConfidence',
  'correctedConfidence',
  'reliabilityCurve',
  'confidenceBucket',
]);

export const FORBIDDEN_PERFORMANCE_COMPUTATION_FIELDS = Object.freeze([
  'matchRate',
  'mismatchRate',
  'accuracy',
  'successRate',
  'matchCount',
  'mismatchCount',
  'performanceScore',
  'aggregateScore',
  'qualityScore',
  'sampleCount',
  'effectiveSampleSize',
  'variance',
  'standardError',
  'confidenceInterval',
  'effectSize',
]);

export const FORBIDDEN_SECRET_KEYS = Object.freeze([
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'privateKey',
  'private_key',
  'accessToken',
  'refreshToken',
  'jwt',
  'credential',
  'credentials',
]);

export const FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  'ohlcv',
  'candles',
  'ticker',
  'orderbook',
  'orderBook',
  'depth',
  'providerResponse',
  'providerPayload',
  'exchangePayload',
  'exchangeResponse',
  'rawMarketData',
  'llmOutput',
  'modelOutputBlob',
  'wallet',
  'orders',
  'order',
  'financialExecution',
]);

export const FORBIDDEN_RUNTIME_FIELDS = Object.freeze([
  'runtimeActivated',
  'runtimeActivation',
  'persistenceEnabled',
  'persistenceActivation',
  'workerActivated',
  'workerActivation',
  'schedulerActivated',
  'schedulerActivation',
  'networkActivation',
  'providerActivation',
  'llmActivation',
  'providerConnected',
  'liveTradingEnabled',
  'paperTradingEnabled',
  'approvedForExecution',
  'decisionEligible',
  'executionEligible',
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
]);

const FORBIDDEN_KEY_LOOKUP = Object.freeze(
  Object.fromEntries(
    [
      ...UNSUPPORTED_SEGMENTATION_DIMENSIONS,
      ...FORBIDDEN_THRESHOLD_FIELDS,
      ...FORBIDDEN_VERDICT_AUTHORITY_FIELDS,
      ...FORBIDDEN_TRUST_PROMOTION_FIELDS,
      ...FORBIDDEN_CALIBRATION_METRIC_FIELDS,
      ...FORBIDDEN_PERFORMANCE_COMPUTATION_FIELDS,
      ...FORBIDDEN_SECRET_KEYS,
      ...FORBIDDEN_PAYLOAD_KEYS,
      ...FORBIDDEN_RUNTIME_FIELDS,
    ].map((k) => [k.toLowerCase(), true]),
  ),
);

// ─── Hard flags / side-effect ledger ─────────────────────────────────────────

export const REQUIRED_HARD_FLAGS = Object.freeze({
  isSourceOfTruth: false,
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
  binaryBrierExecution: false,
  financialExecution: false,
  trustMutationAuthorized: false,
  weightMutationAuthorized: false,
  promotionExecutionAuthorized: false,
  demotionExecutionAuthorized: false,
  calibrationExecutionAuthorized: false,
  selfRegistration: false,
  metricInvention: false,
  thresholdInvention: false,
  sampleSizeInvention: false,
  regimeClassifier: false,
  regimeCreation: false,
});

export const ZERO_SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS = Object.freeze({
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
  binaryBrierExecutionCount: 0,
  orderCount: 0,
  walletMutationCount: 0,
  financialExecutionCount: 0,
  feederMutationCount: 0,
  b10MutationCount: 0,
  liveDbMigrationCount: 0,
  metricInventionCount: 0,
  thresholdInventionCount: 0,
  sampleSizeInventionCount: 0,
  selfRegistrationCount: 0,
  regimeClassifierCount: 0,
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
});

export const SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS = Object.freeze([
  'sample_sufficiency_threshold_policy_count_only_min_50_authorized',
  'sufficiency_scope_per_homogeneous_canonical_cohort',
  'sufficiency_method_count_only',
  'calibration_sufficiency_dormant_separate',
  'threshold_invention_forbidden',
  'sample_size_invention_forbidden',
  'caller_threshold_authority_forbidden_fail_closed',
  'caller_sufficiency_verdict_authority_forbidden_fail_closed',
  'eligible_count_derived_not_caller_supplied',
  'blocked_unavailable_insufficient_data_not_observed_observed_but_unavailable_do_not_count',
  'data_quality_available_plus_fresh_or_aged_required',
  'stale_expired_unknown_unavailable_freshness_not_eligible',
  'canonical_segment_dimensions_only_venue_marketType_symbol_timeframe',
  'regime_identity_canonical_no',
  'regime_classifier_no',
  'regime_creation_no',
  'global_average_only_not_sufficient_for_stage10',
  'global_average_only_bypass_closed',
  'global_average_cannot_become_segmented_evidence',
  'no_statistical_significance_logic',
  'no_p_value_confidence_interval_power_criterion',
  'no_brier_ece_log_loss_reliability_threshold',
  'no_trust_mutation',
  'no_weight_mutation',
  'no_promotion_execution',
  'no_demotion_execution',
  'no_calibration_execution',
  'no_binary_brier_execution',
  'trust_weighting_not_authorized',
  'promotion_not_authorized',
  'demotion_not_authorized',
  'library_only',
  'validation_boundary_not_sot',
  'is_source_of_truth_false',
  'no_runtime_activation',
  'no_persistence',
  'no_network_provider_llm_worker_scheduler',
  'thin_refs_only_no_embedded_upstream_artifacts',
]);

export const UPSTREAM_READ_REFERENCE_ONLY = Object.freeze({
  evaluationPerformanceAggregateContract: 'READ_REFERENCE_ONLY',
  segmentedPerformancePolicyContract: 'READ_REFERENCE_ONLY',
  observedOutcomeEvaluationContract: 'READ_REFERENCE_ONLY',
  observedOutcomeEvaluationSourceOfTruth: 'READ_REFERENCE_ONLY',
  observedOutcomeContract: 'READ_REFERENCE_ONLY',
  confidenceCalibrationContract: 'READ_REFERENCE_ONLY',
  calibrationMeasurementPolicyContract: 'READ_REFERENCE_ONLY',
  decisionLineageContract: 'READ_REFERENCE_ONLY',
  replayContract: 'READ_REFERENCE_ONLY',
  replayResultContract: 'READ_REFERENCE_ONLY',
});

/** Thin Aggregate reference allowlist (identity binding only). */
export const AGGREGATE_REF_ALLOWLIST = Object.freeze([
  'aggregateId',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
]);

/** Thin Segmented Performance Policy reference allowlist. */
export const SEGMENTED_POLICY_REF_ALLOWLIST = Object.freeze([
  'policyId',
  'contractVersion',
  'policyVersion',
  'implementationVersion',
  'sliceId',
]);

/** Public input allowlist for buildSampleSufficiencyPolicyArtifact(). */
export const POLICY_ARTIFACT_INPUT_ALLOWLIST = Object.freeze([
  'aggregateRef',
  'segmentedPerformancePolicyRef',
  'cohort',
  'segmentScope',
  'recordedAt',
  'eligibilityObservations',
]);

/** Thin eligibility observation allowlist (derived count only — never caller authority). */
export const ELIGIBILITY_OBSERVATION_ALLOWLIST = Object.freeze([
  'evaluationStatus',
  'observationClass',
  'comparisonClaims',
  'dataQuality',
  'decisionId',
]);

export const ELIGIBILITY_COMPARISON_CLAIMS_ALLOWLIST = Object.freeze([
  'decisionDirection',
  'observedDirection',
]);

export const ELIGIBILITY_DATA_QUALITY_ALLOWLIST = Object.freeze([
  'availability',
  'freshnessStatus',
]);

/** Comparable directional labels (READ_REFERENCE Aggregate/Decision vocabulary). */
export const COMPARABLE_DIRECTIONS = Object.freeze({
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  SIDEWAYS: 'sideways',
  NEUTRAL: 'neutral',
});
export const COMPARABLE_DIRECTION_VALUES = Object.freeze(
  Object.values(COMPARABLE_DIRECTIONS),
);

/** Hard upper bound on eligibilityObservations array length (fail-closed). */
export const MAX_ELIGIBILITY_OBSERVATIONS = 10000;

// ─── Fail-closed error ───────────────────────────────────────────────────────

export class SampleSufficiencyPolicyContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'SampleSufficiencyPolicyContractError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new SampleSufficiencyPolicyContractError(code, message, details);
}

// ─── Deep freeze (recurse into already-frozen parents) ───────────────────────

function freezeDeep(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      freezeDeep(value[i], seen);
    }
  } else {
    for (const key of Reflect.ownKeys(value)) {
      freezeDeep(value[key], seen);
    }
  }

  if (!Object.isFrozen(value)) {
    Object.freeze(value);
  }
  return value;
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

function assertPlainObject(value, code, message) {
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
    fail(code, message, { actual, expected });
  }
}

function assertExactBoolean(actual, expected, code, message) {
  if (actual !== expected) {
    fail(code, message, { actual, expected });
  }
}

function byteLengthUtf8(value) {
  return Buffer.byteLength(stableJson(value), 'utf8');
}

function assertSizeBound(value, maxBytes, code) {
  const n = byteLengthUtf8(value);
  if (n > maxBytes) {
    fail(code, `Artifact exceeds size bound (${n} > ${maxBytes})`, { bytes: n, maxBytes });
  }
}

function assertAllowlist(obj, allowlist, code, context) {
  const unknown = Object.keys(obj).filter((k) => !allowlist.includes(k));
  if (unknown.length > 0) {
    fail(code, 'Unknown field(s)', { unknown, context });
  }
}

function isForbiddenKey(key) {
  return FORBIDDEN_KEY_LOOKUP[String(key).toLowerCase()] === true;
}

function collectForbiddenKeysDeep(value, path, out, seen) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectForbiddenKeysDeep(value[i], `${path}[${i}]`, out, seen);
    }
    return;
  }

  for (const key of Object.keys(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (isForbiddenKey(key)) {
      const exempt =
        path === ''
        && (
          key === 'sampleSufficiencyPolicy'
          || key === 'sampleSufficiencyThresholdPolicy'
          || key === 'sufficiencyVerdict'
          || key === 'globalAverageOnly'
          || key === 'globalAverageOnlyBypass'
          || key === 'trustWeighting'
          || key === 'promotion'
          || key === 'demotion'
          || key === 'calibrationExecution'
          || key === 'binaryBrierExecution'
          || key === 'regimeIdentityCanonical'
          || key === 'regimeClassifier'
          || key === 'regimeCreation'
          || key === 'thresholdInvention'
          || key === 'sampleSizeInvention'
          || key === 'hardFlags'
          || key === 'sideEffects'
          || key === 'limitations'
          || key === 'upstreamReadReferenceOnly'
          || key === 'downstreamGating'
          || key === 'unsupportedSegmentationDimensions'
          || key === 'forbiddenThresholdFields'
          || key === 'forbiddenVerdictAuthorityFields'
          || key === 'forbiddenTrustPromotionFields'
          || key === 'forbiddenCalibrationMetricFields'
          || key === 'authorizedCanonicalSegmentDimensions'
          || key === 'canonicalSegmentDimensionOrder'
          || key === 'canonicalVersionBindingFields'
          || key === 'cohortDescriptorAllowlist'
        );
      if (!exempt) {
        out.push(nextPath);
      }
    }
    if (
      key === 'hardFlags'
      || key === 'sideEffects'
      || key === 'upstreamReadReferenceOnly'
      || key === 'downstreamGating'
      || key === 'limitations'
      || key === 'unsupportedSegmentationDimensions'
      || key === 'forbiddenThresholdFields'
      || key === 'forbiddenVerdictAuthorityFields'
      || key === 'forbiddenTrustPromotionFields'
      || key === 'forbiddenCalibrationMetricFields'
      || key === 'authorizedCanonicalSegmentDimensions'
      || key === 'canonicalSegmentDimensionOrder'
      || key === 'canonicalVersionBindingFields'
      || key === 'cohortDescriptorAllowlist'
    ) {
      continue;
    }
    collectForbiddenKeysDeep(value[key], nextPath, out, seen);
  }
}

function assertNoForbiddenOrSecrets(value, contextCode) {
  const hits = [];
  collectForbiddenKeysDeep(value, '', hits, new WeakSet());
  if (hits.length > 0) {
    fail(contextCode, 'Forbidden result/secret/payload/unsupported field present', {
      hits: hits.slice(0, 20),
    });
  }
}

function assertNoCallerAuthorityOverrides(input, contextCode) {
  for (const key of FORBIDDEN_AUTHORITY_OVERRIDE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      // Descriptor validation path re-checks exact values; for artifact input
      // these fields are never caller-authoritative.
      if (POLICY_ARTIFACT_INPUT_ALLOWLIST.includes(key)) continue;
      fail(contextCode, `Caller authority override field forbidden: ${key}`, {
        field: key,
      });
    }
  }
}

function assertNoThresholdOrVerdictAuthority(input, contextCode) {
  for (const key of [
    ...FORBIDDEN_THRESHOLD_FIELDS,
    ...FORBIDDEN_VERDICT_AUTHORITY_FIELDS,
  ]) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      fail(contextCode, `Caller threshold/verdict authority forbidden: ${key}`, {
        field: key,
      });
    }
  }
}

function normalizeSegmentDimensionValue(value, field) {
  if (value === null || value === undefined) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_SEGMENT_DIMENSION_MISSING',
      `Canonical segment dimension missing: ${field}`,
      { field },
    );
  }
  if (typeof value !== 'string') {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_SEGMENT_DIMENSION_INVALID',
      `Canonical segment dimension must be a non-empty string: ${field}`,
      { field, type: typeof value },
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_SEGMENT_DIMENSION_EMPTY',
      `Canonical segment dimension empty: ${field}`,
      { field },
    );
  }
  if (trimmed.toUpperCase() === 'UNAVAILABLE' || trimmed.toUpperCase() === 'UNKNOWN') {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_SEGMENT_DIMENSION_UNAVAILABLE',
      `Unavailable canonical segment cannot authorize sufficiency semantics: ${field}`,
      { field, segmentScope: SEGMENT_SCOPE.UNAVAILABLE },
    );
  }
  return trimmed;
}

function assertNoUnsupportedDimensions(input) {
  for (const key of Object.keys(input)) {
    if (UNSUPPORTED_SEGMENTATION_DIMENSIONS.includes(key)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_UNSUPPORTED_DIMENSION',
        `Unsupported / regime segmentation dimension forbidden: ${key}`,
        { field: key },
      );
    }
  }
}

function extractCohort(input) {
  assertPlainObject(
    input,
    'SAMPLE_SUFFICIENCY_POLICY_COHORT_INVALID',
    'cohort must be a plain object',
  );
  // Unsupported / regime dimensions must fail with a dedicated code before
  // the generic allowlist / deep-forbidden scanners.
  assertNoUnsupportedDimensions(input);
  assertAllowlist(
    input,
    COHORT_DESCRIPTOR_ALLOWLIST,
    'SAMPLE_SUFFICIENCY_POLICY_COHORT_UNKNOWN_FIELD',
    'cohort',
  );
  assertNoForbiddenOrSecrets(
    input,
    'SAMPLE_SUFFICIENCY_POLICY_COHORT_FORBIDDEN_FIELD',
  );

  const cohort = {};
  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    cohort[dim] = normalizeSegmentDimensionValue(input[dim], dim);
  }
  for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      const v = input[field];
      if (v === null || v === undefined) {
        cohort[field] = null;
      } else if (typeof v !== 'string' || v.trim().length === 0) {
        fail(
          'SAMPLE_SUFFICIENCY_POLICY_VERSION_BINDING_INVALID',
          `Version binding field must be a non-empty string or null: ${field}`,
          { field },
        );
      } else {
        cohort[field] = v.trim();
      }
    }
  }
  return cohort;
}

function validateThinAggregateRef(ref) {
  assertPlainObject(
    ref,
    'SAMPLE_SUFFICIENCY_POLICY_AGGREGATE_REF_INVALID',
    'aggregateRef must be a plain object',
  );
  assertAllowlist(
    ref,
    AGGREGATE_REF_ALLOWLIST,
    'SAMPLE_SUFFICIENCY_POLICY_AGGREGATE_REF_UNKNOWN_FIELD',
    'aggregateRef',
  );
  assertNoForbiddenOrSecrets(
    ref,
    'SAMPLE_SUFFICIENCY_POLICY_AGGREGATE_REF_FORBIDDEN_FIELD',
  );
  for (const key of AGGREGATE_REF_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(ref, key)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_AGGREGATE_REF_MISSING_FIELD',
        `aggregateRef missing required field: ${key}`,
        { field: key },
      );
    }
    if (typeof ref[key] !== 'string' || ref[key].trim().length === 0) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_AGGREGATE_REF_FIELD_INVALID',
        `aggregateRef.${key} must be a non-empty string`,
        { field: key },
      );
    }
  }

  assertExactString(
    ref.contractVersion.trim(),
    EVALUATION_PERFORMANCE_AGGREGATE_CONTRACT_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_AGGREGATE_REF_CONTRACT_VERSION_MISMATCH',
    'aggregateRef.contractVersion is not the canonical Aggregate contract version',
  );
  assertExactString(
    ref.policyVersion.trim(),
    EVALUATION_PERFORMANCE_AGGREGATE_POLICY_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_AGGREGATE_REF_POLICY_VERSION_MISMATCH',
    'aggregateRef.policyVersion is not the canonical Aggregate policy version',
  );
  assertExactString(
    ref.implementationVersion.trim(),
    EVALUATION_PERFORMANCE_AGGREGATE_IMPLEMENTATION_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_AGGREGATE_REF_IMPLEMENTATION_VERSION_MISMATCH',
    'aggregateRef.implementationVersion is not the canonical Aggregate implementation version',
  );

  return {
    aggregateId: ref.aggregateId.trim(),
    contractVersion: ref.contractVersion.trim(),
    policyVersion: ref.policyVersion.trim(),
    implementationVersion: ref.implementationVersion.trim(),
  };
}

function validateThinSegmentedPolicyRef(ref) {
  assertPlainObject(
    ref,
    'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_INVALID',
    'segmentedPerformancePolicyRef must be a plain object',
  );
  assertAllowlist(
    ref,
    SEGMENTED_POLICY_REF_ALLOWLIST,
    'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_UNKNOWN_FIELD',
    'segmentedPerformancePolicyRef',
  );
  assertNoForbiddenOrSecrets(
    ref,
    'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_FORBIDDEN_FIELD',
  );
  for (const key of SEGMENTED_POLICY_REF_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(ref, key)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_MISSING_FIELD',
        `segmentedPerformancePolicyRef missing required field: ${key}`,
        { field: key },
      );
    }
    if (typeof ref[key] !== 'string' || ref[key].trim().length === 0) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_FIELD_INVALID',
        `segmentedPerformancePolicyRef.${key} must be a non-empty string`,
        { field: key },
      );
    }
  }
  if (ref.sliceId.trim() !== 'S10-SEGMENTED-PERFORMANCE-POLICY-CONTRACT') {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_SLICE_MISMATCH',
      'segmentedPerformancePolicyRef.sliceId must be S10-SEGMENTED-PERFORMANCE-POLICY-CONTRACT',
      { actual: ref.sliceId },
    );
  }

  assertExactString(
    ref.contractVersion.trim(),
    SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_CONTRACT_VERSION_MISMATCH',
    'segmentedPerformancePolicyRef.contractVersion is not the canonical Segmented Performance Policy contract version',
  );
  assertExactString(
    ref.policyVersion.trim(),
    SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_POLICY_VERSION_MISMATCH',
    'segmentedPerformancePolicyRef.policyVersion is not the canonical Segmented Performance Policy policy version',
  );
  assertExactString(
    ref.implementationVersion.trim(),
    SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_SEGMENTED_REF_IMPLEMENTATION_VERSION_MISMATCH',
    'segmentedPerformancePolicyRef.implementationVersion is not the canonical Segmented Performance Policy implementation version',
  );

  return {
    policyId: ref.policyId.trim(),
    contractVersion: ref.contractVersion.trim(),
    policyVersion: ref.policyVersion.trim(),
    implementationVersion: ref.implementationVersion.trim(),
    sliceId: ref.sliceId.trim(),
  };
}

/**
 * GLOBAL_AVERAGE_ONLY cannot become segmented evidence for sufficiency.
 */
export function assertNotGlobalAverageOnlyAsSegmentedEvidence(claim) {
  assertPlainObject(
    claim,
    'SAMPLE_SUFFICIENCY_POLICY_CLAIM_INVALID',
    'claim must be a plain object',
  );
  assertNoThresholdOrVerdictAuthority(
    claim,
    'SAMPLE_SUFFICIENCY_POLICY_CLAIM_THRESHOLD_OR_VERDICT_FORBIDDEN',
  );
  assertNoForbiddenOrSecrets(
    claim,
    'SAMPLE_SUFFICIENCY_POLICY_CLAIM_FORBIDDEN_FIELD',
  );

  const scope = claim.segmentScope ?? claim.scope ?? claim.claimType;
  if (
    scope === SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY
    || scope === 'GLOBAL_AVERAGE_ONLY'
    || claim.globalAverageOnly === true
  ) {
    if (claim.segmented === true || claim.requiresSegmented === true) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_GLOBAL_AVERAGE_BYPASS',
        'GLOBAL_AVERAGE_ONLY cannot be presented as segmented sufficiency evidence',
        { segmentScope: SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY },
      );
    }
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_GLOBAL_AVERAGE_NOT_SUFFICIENT',
      'GLOBAL_AVERAGE_ONLY is not sufficient for Stage 10 segmented interpretation',
      { segmentScope: SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY },
    );
  }
  return freezeDeep({
    ok: true,
    globalAverageOnlyBypass: GLOBAL_AVERAGE_ONLY_BYPASS,
  });
}

function computePolicyId(identityPayload) {
  return hashToUuid(
    `artemis-sample-sufficiency-policy-v1:${stableJson(identityPayload)}`,
  );
}

// ─── Canonical descriptor ────────────────────────────────────────────────────

function buildPolicyDescriptor() {
  return freezeDeep({
    schemaVersion: SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION,
    contractVersion: SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
    policyVersion: SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
    implementationVersion: SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
    artifactType: SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TYPE,
    policyType: SAMPLE_SUFFICIENCY_POLICY_TYPE,
    authorityClass: SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS,
    riskTier: SAMPLE_SUFFICIENCY_POLICY_RISK_TIER,
    sliceId: SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
    officialName: SAMPLE_SUFFICIENCY_POLICY_OFFICIAL_NAME,
    ownershipRole: SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE,
    isSourceOfTruth: false,
    methodRegistrationOwner: METHOD_REGISTRATION_OWNER,
    callerSelfRegistration: CALLER_SELF_REGISTRATION,
    sampleSufficiencyOwner: SAMPLE_SUFFICIENCY_OWNER,

    sampleSufficiencyPolicy: SAMPLE_SUFFICIENCY_POLICY,
    sampleSufficiencyThresholdPolicy: SAMPLE_SUFFICIENCY_THRESHOLD_POLICY,
    minEligibleObservationsPerCohort: MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT,
    sufficiencyScope: SUFFICIENCY_SCOPE,
    sufficiencyMethod: SUFFICIENCY_METHOD,
    calibrationSufficiency: CALIBRATION_SUFFICIENCY,
    sufficiencyVerdict: SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED,
    thresholdInvention: THRESHOLD_INVENTION,
    sampleSizeInvention: SAMPLE_SIZE_INVENTION,

    authorizedCanonicalSegmentDimensions: [
      ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
    ],
    canonicalSegmentDimensionOrder: [...CANONICAL_SEGMENT_DIMENSION_ORDER],
    canonicalVersionBindingFields: [...CANONICAL_VERSION_BINDING_FIELDS],
    cohortDescriptorAllowlist: [...COHORT_DESCRIPTOR_ALLOWLIST],

    regimeIdentityCanonical: REGIME_IDENTITY_CANONICAL,
    regimeClassifier: REGIME_CLASSIFIER,
    regimeCreation: REGIME_CREATION,

    globalAverageOnly: GLOBAL_AVERAGE_ONLY,
    globalAverageOnlyBypass: GLOBAL_AVERAGE_ONLY_BYPASS,

    trustWeighting: TRUST_WEIGHTING,
    promotion: PROMOTION,
    demotion: DEMOTION,
    calibrationExecution: CALIBRATION_EXECUTION,
    binaryBrierExecution: BINARY_BRIER_EXECUTION,

    unsupportedSegmentationDimensions: [...UNSUPPORTED_SEGMENTATION_DIMENSIONS],
    forbiddenThresholdFields: [...FORBIDDEN_THRESHOLD_FIELDS],
    forbiddenVerdictAuthorityFields: [...FORBIDDEN_VERDICT_AUTHORITY_FIELDS],
    forbiddenTrustPromotionFields: [...FORBIDDEN_TRUST_PROMOTION_FIELDS],
    forbiddenCalibrationMetricFields: [...FORBIDDEN_CALIBRATION_METRIC_FIELDS],

    downstreamGating: { ...DOWNSTREAM_GATING },
    hardFlags: { ...REQUIRED_HARD_FLAGS },
    sideEffects: { ...ZERO_SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS },
    limitations: [...SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS],
    upstreamReadReferenceOnly: { ...UPSTREAM_READ_REFERENCE_ONLY },
  });
}

export const SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR = buildPolicyDescriptor();

const DESCRIPTOR_TOP_LEVEL_KEYS = Object.freeze(
  Object.keys(SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR),
);
const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));
const SIDE_EFFECT_KEYS = Object.freeze(
  Object.keys(ZERO_SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS),
);

export function getSampleSufficiencyPolicyDescriptor() {
  return SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR;
}

/**
 * Strict descriptor validation — rejects caller authority overrides.
 * Returns the canonical frozen descriptor — never the caller object.
 */
export function validateSampleSufficiencyPolicyDescriptor(input) {
  assertPlainObject(
    input,
    'SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR_INVALID',
    'Descriptor must be a plain object',
  );
  assertNoForbiddenOrSecrets(
    input,
    'SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR_FORBIDDEN_FIELD',
  );
  assertSizeBound(
    input,
    MAX_SAMPLE_SUFFICIENCY_POLICY_BYTES,
    'SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR_SIZE_EXCEEDED',
  );

  const unknown = Object.keys(input).filter((k) => !DESCRIPTOR_TOP_LEVEL_KEYS.includes(k));
  if (unknown.length > 0) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR_UNKNOWN_FIELD',
      'Unknown descriptor field',
      { unknown },
    );
  }

  for (const key of DESCRIPTOR_TOP_LEVEL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR_MISSING_FIELD',
        `Missing required descriptor field: ${key}`,
        { field: key },
      );
    }
  }

  assertExactString(
    input.schemaVersion,
    SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION_MISMATCH',
    'schemaVersion mismatch',
  );
  assertExactString(
    input.contractVersion,
    SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION_MISMATCH',
    'contractVersion mismatch',
  );
  assertExactString(
    input.policyVersion,
    SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION_MISMATCH',
    'policyVersion mismatch',
  );
  assertExactString(
    input.implementationVersion,
    SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION_MISMATCH',
    'implementationVersion mismatch',
  );
  assertExactString(
    input.artifactType,
    SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TYPE,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TYPE_MISMATCH',
    'artifactType mismatch',
  );
  assertExactString(
    input.policyType,
    SAMPLE_SUFFICIENCY_POLICY_TYPE,
    'SAMPLE_SUFFICIENCY_POLICY_TYPE_MISMATCH',
    'policyType mismatch',
  );
  assertExactString(
    input.authorityClass,
    SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS,
    'SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS_MISMATCH',
    'authorityClass mismatch',
  );
  assertExactString(
    input.sliceId,
    SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
    'SAMPLE_SUFFICIENCY_POLICY_SLICE_ID_MISMATCH',
    'sliceId mismatch',
  );
  assertExactString(
    input.officialName,
    SAMPLE_SUFFICIENCY_POLICY_OFFICIAL_NAME,
    'SAMPLE_SUFFICIENCY_POLICY_OFFICIAL_NAME_MISMATCH',
    'officialName mismatch',
  );
  assertExactString(
    input.riskTier,
    SAMPLE_SUFFICIENCY_POLICY_RISK_TIER,
    'SAMPLE_SUFFICIENCY_POLICY_RISK_TIER_MISMATCH',
    'riskTier mismatch',
  );
  assertExactString(
    input.ownershipRole,
    SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE,
    'SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE_MISMATCH',
    'ownershipRole mismatch',
  );
  assertExactString(
    input.sampleSufficiencyOwner,
    SAMPLE_SUFFICIENCY_OWNER,
    'SAMPLE_SUFFICIENCY_POLICY_OWNER_MISMATCH',
    'sampleSufficiencyOwner mismatch',
  );

  assertExactBoolean(
    input.isSourceOfTruth,
    false,
    'SAMPLE_SUFFICIENCY_POLICY_IS_SOURCE_OF_TRUTH_MISMATCH',
    'isSourceOfTruth must be false',
  );
  assertExactBoolean(
    input.callerSelfRegistration,
    false,
    'SAMPLE_SUFFICIENCY_POLICY_SELF_REGISTRATION_FORBIDDEN',
    'callerSelfRegistration must be false',
  );
  assertExactBoolean(
    input.regimeIdentityCanonical,
    false,
    'SAMPLE_SUFFICIENCY_POLICY_REGIME_IDENTITY_MISMATCH',
    'regimeIdentityCanonical must be false',
  );
  assertExactBoolean(
    input.regimeClassifier,
    false,
    'SAMPLE_SUFFICIENCY_POLICY_REGIME_CLASSIFIER_MISMATCH',
    'regimeClassifier must be false',
  );
  assertExactBoolean(
    input.regimeCreation,
    false,
    'SAMPLE_SUFFICIENCY_POLICY_REGIME_CREATION_MISMATCH',
    'regimeCreation must be false',
  );
  assertExactBoolean(
    input.calibrationExecution,
    false,
    'SAMPLE_SUFFICIENCY_POLICY_CALIBRATION_EXECUTION_MISMATCH',
    'calibrationExecution must be false',
  );
  assertExactBoolean(
    input.binaryBrierExecution,
    false,
    'SAMPLE_SUFFICIENCY_POLICY_BINARY_BRIER_EXECUTION_MISMATCH',
    'binaryBrierExecution must be false',
  );

  assertExactString(
    input.sampleSufficiencyPolicy,
    SAMPLE_SUFFICIENCY_POLICY,
    'SAMPLE_SUFFICIENCY_POLICY_STATE_MISMATCH',
    'sampleSufficiencyPolicy mismatch',
  );
  assertExactString(
    input.sampleSufficiencyThresholdPolicy,
    SAMPLE_SUFFICIENCY_THRESHOLD_POLICY,
    'SAMPLE_SUFFICIENCY_THRESHOLD_POLICY_MISMATCH',
    'sampleSufficiencyThresholdPolicy mismatch',
  );
  assertExactString(
    input.sufficiencyVerdict,
    SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED,
    'SAMPLE_SUFFICIENCY_VERDICT_MISMATCH',
    'descriptor sufficiencyVerdict must remain UNDEFINED / DEFERRED',
  );
  if (input.minEligibleObservationsPerCohort !== MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT) {
    fail(
      'SAMPLE_SUFFICIENCY_MIN_ELIGIBLE_OBSERVATIONS_MISMATCH',
      'minEligibleObservationsPerCohort must equal Owner-approved MIN=50',
      {
        expected: MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT,
        actual: input.minEligibleObservationsPerCohort,
      },
    );
  }
  assertExactString(
    input.sufficiencyScope,
    SUFFICIENCY_SCOPE,
    'SAMPLE_SUFFICIENCY_SCOPE_MISMATCH',
    'sufficiencyScope mismatch',
  );
  assertExactString(
    input.sufficiencyMethod,
    SUFFICIENCY_METHOD,
    'SAMPLE_SUFFICIENCY_METHOD_MISMATCH',
    'sufficiencyMethod mismatch',
  );
  assertExactString(
    input.calibrationSufficiency,
    CALIBRATION_SUFFICIENCY,
    'SAMPLE_SUFFICIENCY_CALIBRATION_SUFFICIENCY_MISMATCH',
    'calibrationSufficiency must remain DORMANT / SEPARATE',
  );
  assertExactString(
    input.thresholdInvention,
    THRESHOLD_INVENTION,
    'SAMPLE_SUFFICIENCY_THRESHOLD_INVENTION_MISMATCH',
    'thresholdInvention must be FORBIDDEN',
  );
  assertExactString(
    input.sampleSizeInvention,
    SAMPLE_SIZE_INVENTION,
    'SAMPLE_SUFFICIENCY_SAMPLE_SIZE_INVENTION_MISMATCH',
    'sampleSizeInvention must be FORBIDDEN',
  );
  assertExactString(
    input.globalAverageOnly,
    GLOBAL_AVERAGE_ONLY,
    'SAMPLE_SUFFICIENCY_POLICY_GLOBAL_AVERAGE_ONLY_MISMATCH',
    'globalAverageOnly mismatch',
  );
  assertExactString(
    input.globalAverageOnlyBypass,
    GLOBAL_AVERAGE_ONLY_BYPASS,
    'SAMPLE_SUFFICIENCY_POLICY_GLOBAL_AVERAGE_BYPASS_MISMATCH',
    'globalAverageOnlyBypass mismatch',
  );
  assertExactString(
    input.trustWeighting,
    TRUST_WEIGHTING,
    'SAMPLE_SUFFICIENCY_POLICY_TRUST_WEIGHTING_MISMATCH',
    'trustWeighting mismatch',
  );
  assertExactString(
    input.promotion,
    PROMOTION,
    'SAMPLE_SUFFICIENCY_POLICY_PROMOTION_MISMATCH',
    'promotion mismatch',
  );
  assertExactString(
    input.demotion,
    DEMOTION,
    'SAMPLE_SUFFICIENCY_POLICY_DEMOTION_MISMATCH',
    'demotion mismatch',
  );

  if (
    stableJson(input.authorizedCanonicalSegmentDimensions)
    !== stableJson(AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS)
  ) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_DIMENSIONS_MISMATCH',
      'authorizedCanonicalSegmentDimensions mismatch',
    );
  }
  if (
    stableJson(input.canonicalSegmentDimensionOrder)
    !== stableJson(CANONICAL_SEGMENT_DIMENSION_ORDER)
  ) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_DIMENSION_ORDER_MISMATCH',
      'canonicalSegmentDimensionOrder mismatch',
    );
  }

  assertPlainObject(
    input.hardFlags,
    'SAMPLE_SUFFICIENCY_POLICY_HARD_FLAGS_INVALID',
    'hardFlags must be a plain object',
  );
  assertAllowlist(
    input.hardFlags,
    HARD_FLAG_KEYS,
    'SAMPLE_SUFFICIENCY_POLICY_HARD_FLAGS_UNKNOWN_FIELD',
    'hardFlags',
  );
  for (const key of HARD_FLAG_KEYS) {
    if (input.hardFlags[key] !== false) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_HARD_FLAG_ESCALATION',
        `hardFlags.${key} must be false`,
        { field: key, actual: input.hardFlags[key] },
      );
    }
  }

  assertPlainObject(
    input.sideEffects,
    'SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS_INVALID',
    'sideEffects must be a plain object',
  );
  assertAllowlist(
    input.sideEffects,
    SIDE_EFFECT_KEYS,
    'SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS_UNKNOWN_FIELD',
    'sideEffects',
  );
  for (const key of SIDE_EFFECT_KEYS) {
    if (input.sideEffects[key] !== 0) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECT_NONZERO',
        `sideEffects.${key} must be 0`,
        { field: key, actual: input.sideEffects[key] },
      );
    }
  }

  if (!Array.isArray(input.limitations) || input.limitations.length === 0) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS_INVALID',
      'limitations must be a non-empty array',
    );
  }
  for (const baseline of SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS) {
    if (!input.limitations.includes(baseline)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS_MISSING',
        `canonical baseline limitation missing: ${baseline}`,
      );
    }
  }

  return getSampleSufficiencyPolicyDescriptor();
}


// ─── Eligibility observation derivation (COUNT_ONLY / Owner MIN=50) ──────────

function assertExactEnumString(actual, allowedValues, code, message) {
  if (typeof actual !== 'string' || !allowedValues.includes(actual)) {
    fail(code, message, { actual, allowed: allowedValues });
  }
}

function assertBoundDecisionIdentity(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_DECISION_ID_INVALID',
      'Eligible observation requires a non-empty bound decisionId',
      { decisionId: value },
    );
  }
  return value.trim();
}

function assertEligibilityDataQuality(dq) {
  assertPlainObject(
    dq,
    'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_DATA_QUALITY_INVALID',
    'dataQuality must be a plain object',
  );
  assertAllowlist(
    dq,
    ELIGIBILITY_DATA_QUALITY_ALLOWLIST,
    'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_DATA_QUALITY_UNKNOWN_FIELD',
    'dataQuality',
  );
  if (!Object.prototype.hasOwnProperty.call(dq, 'availability')
    || !Object.prototype.hasOwnProperty.call(dq, 'freshnessStatus')) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_DATA_QUALITY_INCOMPLETE',
      'dataQuality requires availability and freshnessStatus',
    );
  }
  if (typeof dq.availability !== 'string') {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_AVAILABILITY_INVALID',
      'dataQuality.availability must be a string',
    );
  }
  if (typeof dq.freshnessStatus !== 'string') {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_FRESHNESS_INVALID',
      'dataQuality.freshnessStatus must be a string',
    );
  }
  const allowedAvailability = Object.values(AVAILABILITY);
  if (!allowedAvailability.includes(dq.availability)) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_AVAILABILITY_UNSUPPORTED',
      'Unsupported dataQuality.availability',
      { availability: dq.availability },
    );
  }
  const allowedFreshness = Object.values(FRESHNESS_STATUS);
  if (!allowedFreshness.includes(dq.freshnessStatus)) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_FRESHNESS_UNSUPPORTED',
      'Unsupported dataQuality.freshnessStatus',
      { freshnessStatus: dq.freshnessStatus },
    );
  }
  return Object.freeze({
    availability: dq.availability,
    freshnessStatus: dq.freshnessStatus,
  });
}

function isDataQualityEligible(dq) {
  return dq.availability === AVAILABILITY.AVAILABLE
    && (dq.freshnessStatus === FRESHNESS_STATUS.FRESH
      || dq.freshnessStatus === FRESHNESS_STATUS.AGED);
}

function assertEligibilityComparisonClaims(claims, evaluationStatus) {
  assertPlainObject(
    claims,
    'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_COMPARISON_CLAIMS_INVALID',
    'comparisonClaims must be a plain object',
  );
  assertAllowlist(
    claims,
    ELIGIBILITY_COMPARISON_CLAIMS_ALLOWLIST,
    'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_COMPARISON_CLAIMS_UNKNOWN_FIELD',
    'comparisonClaims',
  );
  if (!Object.prototype.hasOwnProperty.call(claims, 'decisionDirection')
    || !Object.prototype.hasOwnProperty.call(claims, 'observedDirection')) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_COMPARISON_CLAIMS_INCOMPLETE',
      'comparisonClaims requires explicit decisionDirection and observedDirection',
    );
  }
  assertExactEnumString(
    claims.decisionDirection,
    COMPARABLE_DIRECTION_VALUES,
    'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_DECISION_DIRECTION_INVALID',
    'decisionDirection must be a comparable canonical direction',
  );
  assertExactEnumString(
    claims.observedDirection,
    COMPARABLE_DIRECTION_VALUES,
    'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVED_DIRECTION_INVALID',
    'observedDirection must be a comparable canonical direction',
  );
  const directionsMatch = claims.decisionDirection === claims.observedDirection;
  if (evaluationStatus === EVALUATION_STATUS.MATCH && !directionsMatch) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_MATCH_DIRECTION_INCONSISTENT',
      'MATCH requires decisionDirection === observedDirection',
      {
        decisionDirection: claims.decisionDirection,
        observedDirection: claims.observedDirection,
      },
    );
  }
  if (evaluationStatus === EVALUATION_STATUS.MISMATCH && directionsMatch) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_MISMATCH_DIRECTION_INCONSISTENT',
      'MISMATCH requires decisionDirection !== observedDirection',
      {
        decisionDirection: claims.decisionDirection,
        observedDirection: claims.observedDirection,
      },
    );
  }
  return Object.freeze({
    decisionDirection: claims.decisionDirection,
    observedDirection: claims.observedDirection,
  });
}

/**
 * Returns true when the observation is COUNT_ONLY eligible.
 * Non-count statuses/classes return false (skip).
 * Missing/malformed DQ or required identity/claims on candidate rows FAIL CLOSED.
 */
function isEligibleObservation(obs) {
  assertPlainObject(
    obs,
    'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVATION_INVALID',
    'eligibilityObservations[] entry must be a plain object',
  );
  assertAllowlist(
    obs,
    ELIGIBILITY_OBSERVATION_ALLOWLIST,
    'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVATION_UNKNOWN_FIELD',
    'eligibilityObservation',
  );

  if (!Object.prototype.hasOwnProperty.call(obs, 'evaluationStatus')
    || !Object.prototype.hasOwnProperty.call(obs, 'observationClass')) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVATION_INCOMPLETE',
      'eligibilityObservations[] requires evaluationStatus and observationClass',
    );
  }

  const allowedStatuses = Object.values(EVALUATION_STATUS);
  if (typeof obs.evaluationStatus !== 'string'
    || !allowedStatuses.includes(obs.evaluationStatus)) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_EVALUATION_STATUS_INVALID',
      'Unsupported evaluationStatus',
      { evaluationStatus: obs.evaluationStatus },
    );
  }
  const allowedClasses = Object.values(OBSERVATION_CLASS);
  if (typeof obs.observationClass !== 'string'
    || !allowedClasses.includes(obs.observationClass)) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVATION_CLASS_INVALID',
      'Unsupported observationClass',
      { observationClass: obs.observationClass },
    );
  }

  // Non-count statuses: skip without throw
  if (obs.evaluationStatus === EVALUATION_STATUS.BLOCKED
    || obs.evaluationStatus === EVALUATION_STATUS.UNAVAILABLE
    || obs.evaluationStatus === EVALUATION_STATUS.INSUFFICIENT_DATA) {
    return false;
  }
  // Non-count observation classes: skip without throw
  if (obs.observationClass === OBSERVATION_CLASS.NOT_OBSERVED
    || obs.observationClass === OBSERVATION_CLASS.OBSERVED_BUT_UNAVAILABLE) {
    return false;
  }

  // Candidate eligibility path requires MATCH|MISMATCH + OBSERVED_AND_EVALUABLE
  if (obs.observationClass !== OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVATION_CLASS_INCONSISTENT',
      'MATCH/MISMATCH eligibility requires OBSERVED_AND_EVALUABLE',
      {
        evaluationStatus: obs.evaluationStatus,
        observationClass: obs.observationClass,
      },
    );
  }
  if (obs.evaluationStatus !== EVALUATION_STATUS.MATCH
    && obs.evaluationStatus !== EVALUATION_STATUS.MISMATCH) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_EVALUATION_STATUS_INCONSISTENT',
      'OBSERVED_AND_EVALUABLE eligibility requires MATCH or MISMATCH',
      { evaluationStatus: obs.evaluationStatus },
    );
  }

  if (!Object.prototype.hasOwnProperty.call(obs, 'decisionId')) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_DECISION_ID_REQUIRED',
      'Eligible observation requires bound decisionId',
    );
  }
  assertBoundDecisionIdentity(obs.decisionId);

  if (!Object.prototype.hasOwnProperty.call(obs, 'comparisonClaims')) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_COMPARISON_CLAIMS_REQUIRED',
      'Eligible observation requires explicit comparisonClaims',
    );
  }
  assertEligibilityComparisonClaims(obs.comparisonClaims, obs.evaluationStatus);

  // DQ: missing/malformed FAIL CLOSED; STALE/EXPIRED/UNKNOWN/UNAVAILABLE → not eligible
  if (!Object.prototype.hasOwnProperty.call(obs, 'dataQuality')) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_DATA_QUALITY_REQUIRED',
      'Eligible observation requires dataQuality; cannot establish DQ eligibility',
    );
  }
  const dq = assertEligibilityDataQuality(obs.dataQuality);
  return isDataQualityEligible(dq);
}

/**
 * Derive eligibleObservationCount from caller-supplied thin observations.
 * Omitted → null (UNAVAILABLE). Array → non-negative integer (never coerce null→0).
 */
function deriveEligibleObservationCount(input) {
  if (!Object.prototype.hasOwnProperty.call(input, 'eligibilityObservations')) {
    return null;
  }
  const observations = input.eligibilityObservations;
  if (!Array.isArray(observations)) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVATIONS_INVALID',
      'eligibilityObservations must be an array when present',
    );
  }
  if (observations.length > MAX_ELIGIBILITY_OBSERVATIONS) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVATIONS_SIZE_EXCEEDED',
      `eligibilityObservations exceeds bound (${observations.length} > ${MAX_ELIGIBILITY_OBSERVATIONS})`,
      { length: observations.length, max: MAX_ELIGIBILITY_OBSERVATIONS },
    );
  }
  let count = 0;
  for (let i = 0; i < observations.length; i += 1) {
    if (isEligibleObservation(observations[i])) {
      count += 1;
    }
  }
  return count;
}

function deriveSufficiencyVerdict(eligibleObservationCount) {
  if (eligibleObservationCount === null || eligibleObservationCount === undefined) {
    return SUFFICIENCY_VERDICT.UNAVAILABLE;
  }
  if (typeof eligibleObservationCount !== 'number'
    || !Number.isInteger(eligibleObservationCount)
    || eligibleObservationCount < 0) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBLE_COUNT_INVALID',
      'eligibleObservationCount must be null or a non-negative integer',
      { eligibleObservationCount },
    );
  }
  // Known count 0 → UNAVAILABLE (not INSUFFICIENT; never coerce unknown→0)
  if (eligibleObservationCount === 0) {
    return SUFFICIENCY_VERDICT.UNAVAILABLE;
  }
  if (eligibleObservationCount < MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT) {
    return SUFFICIENCY_VERDICT.INSUFFICIENT;
  }
  return SUFFICIENCY_VERDICT.SUFFICIENT;
}

/**
 * Build a library-only Sample Sufficiency Policy artifact.
 *
 * COUNT_ONLY Owner threshold: MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT=50.
 * Derives eligibleObservationCount + sufficiencyVerdict (SUFFICIENT|INSUFFICIENT|UNAVAILABLE).
 * Does NOT invent thresholds. Caller threshold/verdict authority FAIL_CLOSED.
 * Thin refs only — never embeds upstream Aggregate/Segmented artifacts.
 */
export function buildSampleSufficiencyPolicyArtifact(input = {}) {
  assertPlainObject(
    input,
    'SAMPLE_SUFFICIENCY_POLICY_INPUT_INVALID',
    'Input must be a plain object',
  );
  assertAllowlist(
    input,
    POLICY_ARTIFACT_INPUT_ALLOWLIST,
    'SAMPLE_SUFFICIENCY_POLICY_INPUT_UNKNOWN_FIELD',
    'input',
  );
  assertNoThresholdOrVerdictAuthority(
    input,
    'SAMPLE_SUFFICIENCY_POLICY_CALLER_THRESHOLD_OR_VERDICT_FORBIDDEN',
  );
  assertNoCallerAuthorityOverrides(
    input,
    'SAMPLE_SUFFICIENCY_POLICY_CALLER_AUTHORITY_OVERRIDE_FORBIDDEN',
  );
  assertSizeBound(
    input,
    MAX_SAMPLE_SUFFICIENCY_POLICY_BYTES,
    'SAMPLE_SUFFICIENCY_POLICY_INPUT_SIZE_EXCEEDED',
  );

  let segmentScope = SEGMENT_SCOPE.MISSING;
  if (Object.prototype.hasOwnProperty.call(input, 'segmentScope')) {
    if (typeof input.segmentScope !== 'string') {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_SEGMENT_SCOPE_INVALID',
        'segmentScope must be a string',
      );
    }
    const allowedScopes = Object.values(SEGMENT_SCOPE);
    if (!allowedScopes.includes(input.segmentScope)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_SEGMENT_SCOPE_UNSUPPORTED',
        'Unsupported segmentScope',
        { segmentScope: input.segmentScope },
      );
    }
    segmentScope = input.segmentScope;
  }

  if (segmentScope === SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_GLOBAL_AVERAGE_NOT_SUFFICIENT',
      'GLOBAL_AVERAGE_ONLY is not sufficient for Stage 10 segmented interpretation',
      { segmentScope },
    );
  }

  let cohort = null;
  if (Object.prototype.hasOwnProperty.call(input, 'cohort')) {
    // Validate cohort before deep forbidden scan so unsupported dimensions
    // (regime / agentRole / …) emit dedicated codes, not generic forbidden.
    cohort = extractCohort(input.cohort);
    if (segmentScope === SEGMENT_SCOPE.MISSING) {
      segmentScope = SEGMENT_SCOPE.SEGMENTED;
    }
    if (segmentScope !== SEGMENT_SCOPE.SEGMENTED) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_COHORT_SCOPE_MISMATCH',
        'cohort requires segmentScope=SEGMENTED',
        { segmentScope },
      );
    }
  } else if (segmentScope === SEGMENT_SCOPE.SEGMENTED) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_COHORT_REQUIRED',
      'segmentScope=SEGMENTED requires canonical cohort identity',
    );
  }

  let aggregateRef = null;
  if (Object.prototype.hasOwnProperty.call(input, 'aggregateRef')) {
    aggregateRef = validateThinAggregateRef(input.aggregateRef);
  }

  let segmentedPerformancePolicyRef = null;
  if (Object.prototype.hasOwnProperty.call(input, 'segmentedPerformancePolicyRef')) {
    segmentedPerformancePolicyRef = validateThinSegmentedPolicyRef(
      input.segmentedPerformancePolicyRef,
    );
  }

  // Deep forbidden scan after cohort extraction — skip validated cohort path.
  const inputForForbiddenScan = { ...input };
  delete inputForForbiddenScan.cohort;
  assertNoForbiddenOrSecrets(
    inputForForbiddenScan,
    'SAMPLE_SUFFICIENCY_POLICY_INPUT_FORBIDDEN_FIELD',
  );

  let recordedAt = null;
  if (Object.prototype.hasOwnProperty.call(input, 'recordedAt')) {
    if (typeof input.recordedAt !== 'string' || input.recordedAt.trim().length === 0) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_RECORDED_AT_INVALID',
        'recordedAt must be a non-empty string when present',
      );
    }
    recordedAt = input.recordedAt.trim();
  }

  const eligibleObservationCount = deriveEligibleObservationCount(input);
  const sufficiencyVerdict = deriveSufficiencyVerdict(eligibleObservationCount);

  // Semantic identity excludes recordedAt (bookkeeping only).
  const identityPayload = {
    schemaVersion: SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION,
    contractVersion: SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
    policyVersion: SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
    implementationVersion: SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
    sliceId: SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
    sampleSufficiencyPolicy: SAMPLE_SUFFICIENCY_POLICY,
    sampleSufficiencyThresholdPolicy: SAMPLE_SUFFICIENCY_THRESHOLD_POLICY,
    minEligibleObservationsPerCohort: MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT,
    sufficiencyScope: SUFFICIENCY_SCOPE,
    sufficiencyMethod: SUFFICIENCY_METHOD,
    calibrationSufficiency: CALIBRATION_SUFFICIENCY,
    eligibleObservationCount,
    sufficiencyVerdict,
    segmentScope,
    cohort,
    aggregateRef,
    segmentedPerformancePolicyRef,
  };

  const policyId = computePolicyId(identityPayload);

  return freezeDeep({
    schemaVersion: SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION,
    contractVersion: SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
    policyVersion: SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
    implementationVersion: SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
    artifactType: SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TYPE,
    policyType: SAMPLE_SUFFICIENCY_POLICY_TYPE,
    authorityClass: SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS,
    riskTier: SAMPLE_SUFFICIENCY_POLICY_RISK_TIER,
    sliceId: SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
    officialName: SAMPLE_SUFFICIENCY_POLICY_OFFICIAL_NAME,
    ownershipRole: SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE,
    isSourceOfTruth: false,
    sampleSufficiencyOwner: SAMPLE_SUFFICIENCY_OWNER,
    policyId,
    recordedAt,
    segmentScope,
    cohort,
    aggregateRef,
    segmentedPerformancePolicyRef,
    sampleSufficiencyPolicy: SAMPLE_SUFFICIENCY_POLICY,
    sampleSufficiencyThresholdPolicy: SAMPLE_SUFFICIENCY_THRESHOLD_POLICY,
    minEligibleObservationsPerCohort: MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT,
    sufficiencyScope: SUFFICIENCY_SCOPE,
    sufficiencyMethod: SUFFICIENCY_METHOD,
    calibrationSufficiency: CALIBRATION_SUFFICIENCY,
    eligibleObservationCount,
    sufficiencyVerdict,
    thresholdInvention: THRESHOLD_INVENTION,
    sampleSizeInvention: SAMPLE_SIZE_INVENTION,
    regimeIdentityCanonical: REGIME_IDENTITY_CANONICAL,
    globalAverageOnly: GLOBAL_AVERAGE_ONLY,
    globalAverageOnlyBypass: GLOBAL_AVERAGE_ONLY_BYPASS,
    trustWeighting: TRUST_WEIGHTING,
    promotion: PROMOTION,
    demotion: DEMOTION,
    calibrationExecution: CALIBRATION_EXECUTION,
    binaryBrierExecution: BINARY_BRIER_EXECUTION,
    downstreamGating: { ...DOWNSTREAM_GATING },
    hardFlags: { ...REQUIRED_HARD_FLAGS },
    sideEffects: { ...ZERO_SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS },
    limitations: [...SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS],
    provenance: {
      writer: SAMPLE_SUFFICIENCY_POLICY_WRITER,
      methodKey: SAMPLE_SUFFICIENCY_POLICY_METHOD_KEY,
      stage: SAMPLE_SUFFICIENCY_POLICY_STAGE,
      identityIncludesRecordedAt: false,
    },
  });
}

/**
 * Validate a previously built Sample Sufficiency Policy artifact.
 * Re-derives policyId and rejects caller-supplied authority / verdicts.
 */
const SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TOP_LEVEL_KEYS = Object.freeze([
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
  'sampleSufficiencyOwner',
  'policyId',
  'recordedAt',
  'segmentScope',
  'cohort',
  'aggregateRef',
  'segmentedPerformancePolicyRef',
  'sampleSufficiencyPolicy',
  'sampleSufficiencyThresholdPolicy',
  'minEligibleObservationsPerCohort',
  'sufficiencyScope',
  'sufficiencyMethod',
  'calibrationSufficiency',
  'eligibleObservationCount',
  'sufficiencyVerdict',
  'thresholdInvention',
  'sampleSizeInvention',
  'regimeIdentityCanonical',
  'globalAverageOnly',
  'globalAverageOnlyBypass',
  'trustWeighting',
  'promotion',
  'demotion',
  'calibrationExecution',
  'binaryBrierExecution',
  'downstreamGating',
  'hardFlags',
  'sideEffects',
  'limitations',
  'provenance',
]);

function assertExactOwnKeys(obj, expected, unknownCode, missingCode, context) {
  const ownKeys = Reflect.ownKeys(obj);
  const symbolKeys = ownKeys.filter((key) => typeof key === 'symbol');
  if (symbolKeys.length > 0) {
    fail(
      unknownCode,
      `Unknown symbol field(s) on ${context}`,
      { context, symbolCount: symbolKeys.length },
    );
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
    fail(missingCode, `Missing required field(s) on ${context}`, { context, missing });
  }
}

function assertExactArrayKeys(array, context) {
  assertExactOwnKeys(
    array,
    ['length', ...Array.from({ length: array.length }, (_, i) => String(i))],
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_UNKNOWN_FIELD',
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_MISSING_FIELD',
    context,
  );
}

function assertCanonicalArtifactShape(artifact) {
  assertExactOwnKeys(
    artifact,
    SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TOP_LEVEL_KEYS,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_UNKNOWN_FIELD',
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_MISSING_FIELD',
    'artifact',
  );

  assertExactString(artifact.schemaVersion, SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_SCHEMA_VERSION_MISMATCH', 'schemaVersion mismatch');
  assertExactString(artifact.contractVersion, SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CONTRACT_VERSION_MISMATCH', 'contractVersion mismatch');
  assertExactString(artifact.policyVersion, SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_POLICY_VERSION_MISMATCH', 'policyVersion mismatch');
  assertExactString(artifact.implementationVersion, SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_IMPLEMENTATION_VERSION_MISMATCH', 'implementationVersion mismatch');
  assertExactString(artifact.artifactType, SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TYPE,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_ARTIFACT_TYPE_MISMATCH', 'artifactType mismatch');
  assertExactString(artifact.policyType, SAMPLE_SUFFICIENCY_POLICY_TYPE,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_POLICY_TYPE_MISMATCH', 'policyType mismatch');
  assertExactString(artifact.authorityClass, SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_AUTHORITY_CLASS_MISMATCH', 'authorityClass mismatch');
  assertExactString(artifact.riskTier, SAMPLE_SUFFICIENCY_POLICY_RISK_TIER,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_RISK_TIER_MISMATCH', 'riskTier mismatch');
  assertExactString(artifact.sliceId, SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_SLICE_ID_MISMATCH', 'sliceId mismatch');
  assertExactString(artifact.officialName, SAMPLE_SUFFICIENCY_POLICY_OFFICIAL_NAME,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_OFFICIAL_NAME_MISMATCH', 'officialName mismatch');
  assertExactString(artifact.ownershipRole, SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_OWNERSHIP_ROLE_MISMATCH', 'ownershipRole mismatch');
  assertExactBoolean(artifact.isSourceOfTruth, false,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_IS_SOT_MISMATCH', 'isSourceOfTruth must be false');
  assertExactString(artifact.sampleSufficiencyOwner, SAMPLE_SUFFICIENCY_OWNER,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_OWNER_MISMATCH', 'sampleSufficiencyOwner mismatch');
  assertExactString(artifact.sampleSufficiencyPolicy, SAMPLE_SUFFICIENCY_POLICY,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_STATE_MISMATCH', 'sampleSufficiencyPolicy mismatch');
  assertExactString(artifact.sampleSufficiencyThresholdPolicy, SAMPLE_SUFFICIENCY_THRESHOLD_POLICY,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_THRESHOLD_STATE_MISMATCH', 'sampleSufficiencyThresholdPolicy mismatch');
  if (artifact.minEligibleObservationsPerCohort !== MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_MIN_ELIGIBLE_MISMATCH',
      'minEligibleObservationsPerCohort must equal Owner-approved MIN=50',
      {
        expected: MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT,
        actual: artifact.minEligibleObservationsPerCohort,
      },
    );
  }
  assertExactString(artifact.sufficiencyScope, SUFFICIENCY_SCOPE,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_SCOPE_MISMATCH', 'sufficiencyScope mismatch');
  assertExactString(artifact.sufficiencyMethod, SUFFICIENCY_METHOD,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_METHOD_MISMATCH', 'sufficiencyMethod mismatch');
  assertExactString(artifact.calibrationSufficiency, CALIBRATION_SUFFICIENCY,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CALIBRATION_SUFFICIENCY_MISMATCH',
    'calibrationSufficiency must remain DORMANT / SEPARATE');
  if (artifact.eligibleObservationCount !== null) {
    if (!Number.isInteger(artifact.eligibleObservationCount)
      || artifact.eligibleObservationCount < 0
      || Object.is(artifact.eligibleObservationCount, -0)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_ELIGIBLE_COUNT_INVALID',
        'eligibleObservationCount must be null or a non-negative integer',
        { actual: artifact.eligibleObservationCount },
      );
    }
  }
  if (typeof artifact.sufficiencyVerdict !== 'string'
    || !SUFFICIENCY_VERDICT_VALUES.includes(artifact.sufficiencyVerdict)
    || artifact.sufficiencyVerdict === SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_VERDICT_MISMATCH',
      'sufficiencyVerdict must be SUFFICIENT, INSUFFICIENT, or UNAVAILABLE',
      { actual: artifact.sufficiencyVerdict },
    );
  }
  if (deriveSufficiencyVerdict(artifact.eligibleObservationCount) !== artifact.sufficiencyVerdict) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_VERDICT_COUNT_INCONSISTENT',
      'sufficiencyVerdict must match derived eligibleObservationCount',
      {
        eligibleObservationCount: artifact.eligibleObservationCount,
        sufficiencyVerdict: artifact.sufficiencyVerdict,
      },
    );
  }
  assertExactString(artifact.thresholdInvention, THRESHOLD_INVENTION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_THRESHOLD_INVENTION_MISMATCH', 'thresholdInvention mismatch');
  assertExactString(artifact.sampleSizeInvention, SAMPLE_SIZE_INVENTION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_SAMPLE_SIZE_INVENTION_MISMATCH', 'sampleSizeInvention mismatch');
  assertExactBoolean(artifact.regimeIdentityCanonical, false,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_REGIME_IDENTITY_MISMATCH', 'regimeIdentityCanonical must be false');
  assertExactString(artifact.globalAverageOnly, GLOBAL_AVERAGE_ONLY,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_GLOBAL_AVERAGE_MISMATCH', 'globalAverageOnly mismatch');
  assertExactString(artifact.globalAverageOnlyBypass, GLOBAL_AVERAGE_ONLY_BYPASS,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_GLOBAL_AVERAGE_BYPASS_MISMATCH', 'globalAverageOnlyBypass mismatch');
  assertExactString(artifact.trustWeighting, TRUST_WEIGHTING,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TRUST_WEIGHTING_MISMATCH', 'trustWeighting mismatch');
  assertExactString(artifact.promotion, PROMOTION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_PROMOTION_MISMATCH', 'promotion mismatch');
  assertExactString(artifact.demotion, DEMOTION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_DEMOTION_MISMATCH', 'demotion mismatch');
  assertExactBoolean(artifact.calibrationExecution, false,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CALIBRATION_EXECUTION_MISMATCH', 'calibrationExecution must be false');
  assertExactBoolean(artifact.binaryBrierExecution, false,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_BINARY_BRIER_EXECUTION_MISMATCH', 'binaryBrierExecution must be false');

  if (typeof artifact.policyId !== 'string' || artifact.policyId.trim().length === 0) {
    fail('SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_POLICY_ID_INVALID', 'policyId must be a non-empty string');
  }
  if (artifact.recordedAt !== null
    && (typeof artifact.recordedAt !== 'string' || artifact.recordedAt.trim().length === 0)) {
    fail('SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_RECORDED_AT_INVALID', 'recordedAt must be null or a non-empty string');
  }
  if (typeof artifact.segmentScope !== 'string' || !Object.values(SEGMENT_SCOPE).includes(artifact.segmentScope)) {
    fail('SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_SEGMENT_SCOPE_INVALID', 'segmentScope must be a canonical SEGMENT_SCOPE value');
  }

  if (artifact.cohort !== null) {
    assertPlainObject(
      artifact.cohort,
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_COHORT_INVALID',
      'artifact.cohort must be a plain object or null',
    );
    const allowedCohortKeys = [
      ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
      ...CANONICAL_VERSION_BINDING_FIELDS,
    ];
    const cohortKeys = Reflect.ownKeys(artifact.cohort);
    if (cohortKeys.some((key) => typeof key === 'symbol')) {
      fail('SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_UNKNOWN_FIELD', 'artifact.cohort contains symbol fields');
    }
    const unknown = cohortKeys.filter(
      (key) => typeof key === 'string' && !allowedCohortKeys.includes(key),
    );
    if (unknown.length > 0) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_UNKNOWN_FIELD',
        'artifact.cohort contains unknown fields',
        { unknown },
      );
    }
    for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
      if (!Object.prototype.hasOwnProperty.call(artifact.cohort, dim)) {
        fail(
          'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_MISSING_FIELD',
          `artifact.cohort missing canonical dimension: ${dim}`,
        );
      }
    }
    const normalizedCohort = extractCohort(artifact.cohort);
    if (stableJson(normalizedCohort) !== stableJson(artifact.cohort)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_COHORT_CANONICAL_MISMATCH',
        'artifact.cohort diverges from canonical normalization',
      );
    }
  }

  if (artifact.aggregateRef !== null) validateThinAggregateRef(artifact.aggregateRef);
  if (artifact.segmentedPerformancePolicyRef !== null) {
    validateThinSegmentedPolicyRef(artifact.segmentedPerformancePolicyRef);
  }

  assertExactOwnKeys(
    artifact.downstreamGating,
    Object.keys(DOWNSTREAM_GATING),
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_UNKNOWN_FIELD',
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_MISSING_FIELD',
    'artifact.downstreamGating',
  );
  assertExactOwnKeys(
    artifact.hardFlags,
    Object.keys(REQUIRED_HARD_FLAGS),
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_UNKNOWN_FIELD',
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_MISSING_FIELD',
    'artifact.hardFlags',
  );
  assertExactOwnKeys(
    artifact.sideEffects,
    Object.keys(ZERO_SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS),
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_UNKNOWN_FIELD',
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_MISSING_FIELD',
    'artifact.sideEffects',
  );
  assertExactOwnKeys(
    artifact.provenance,
    ['writer', 'methodKey', 'stage', 'identityIncludesRecordedAt'],
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_UNKNOWN_FIELD',
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_SHAPE_MISSING_FIELD',
    'artifact.provenance',
  );
  if (!Array.isArray(artifact.limitations)) {
    fail('SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_LIMITATIONS_INVALID', 'limitations must be an array');
  }
  assertExactArrayKeys(artifact.limitations, 'artifact.limitations');
}

function assertCanonicalArtifactEqualsRebuild(artifact, rebuilt) {
  if (stableJson(artifact) !== stableJson(rebuilt)) {
    const mismatches = SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TOP_LEVEL_KEYS.filter(
      (key) => stableJson(artifact[key]) !== stableJson(rebuilt[key]),
    );
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CANONICAL_FIELD_MISMATCH',
      'Artifact diverges from canonical rebuilt artifact',
      { mismatches },
    );
  }
}

function assertValidatedArtifactAuthoritySurface(artifact) {
  // Caller-controlled threshold/verdict/secret/runtime fields remain forbidden.
  for (const key of FORBIDDEN_THRESHOLD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(artifact, key)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_THRESHOLD_OR_VERDICT_FORBIDDEN',
        `Caller threshold/verdict authority forbidden: ${key}`,
        { field: key },
      );
    }
  }
  for (const key of FORBIDDEN_VERDICT_AUTHORITY_FIELDS) {
    if (key === 'sufficiencyVerdict') continue;
    if (Object.prototype.hasOwnProperty.call(artifact, key)) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_THRESHOLD_OR_VERDICT_FORBIDDEN',
        `Caller threshold/verdict authority forbidden: ${key}`,
        { field: key },
      );
    }
  }
  assertNoForbiddenOrSecrets(
    artifact,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_FORBIDDEN_FIELD',
  );
  assertSizeBound(
    artifact,
    MAX_SAMPLE_SUFFICIENCY_POLICY_BYTES,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_SIZE_EXCEEDED',
  );
}

function buildInputFromArtifact(artifact, eligibilityObservations) {
  const input = {
    segmentScope: artifact.segmentScope,
  };
  if (artifact.cohort !== null) input.cohort = artifact.cohort;
  if (artifact.aggregateRef !== null) input.aggregateRef = artifact.aggregateRef;
  if (artifact.segmentedPerformancePolicyRef !== null) {
    input.segmentedPerformancePolicyRef = artifact.segmentedPerformancePolicyRef;
  }
  if (artifact.recordedAt !== null) input.recordedAt = artifact.recordedAt;
  if (eligibilityObservations !== undefined) {
    input.eligibilityObservations = eligibilityObservations;
  }
  return input;
}

/**
 * Validate a built Sample Sufficiency Policy artifact.
 *
 * Path A: artifact alone — allowed only when eligibleObservationCount === null
 *         (no eligibility observations were supplied at build time).
 * Path B: { artifact, eligibilityObservations } — required whenever a known
 *         eligibleObservationCount is claimed (including 0). Caller counts /
 *         verdicts are never authoritative; rebuild equality is required.
 */
export function validateSampleSufficiencyPolicyArtifact(input) {
  assertPlainObject(
    input,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_INVALID',
    'Artifact must be a plain object',
  );

  // Path B: { artifact, eligibilityObservations? }
  if (Object.prototype.hasOwnProperty.call(input, 'artifact')) {
    const pathBKeys = Reflect.ownKeys(input).filter((key) => typeof key === 'string');
    const unknownPathB = pathBKeys.filter(
      (key) => key !== 'artifact' && key !== 'eligibilityObservations',
    );
    if (unknownPathB.length > 0) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_VALIDATE_UNKNOWN_FIELD',
        'Unknown field(s) on validate Path B input',
        { unknown: unknownPathB },
      );
    }
    if (pathBKeys.includes('eligibilityObservations') === false && pathBKeys.length !== 1) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_VALIDATE_UNKNOWN_FIELD',
        'Path B input must contain only artifact and optional eligibilityObservations',
        { keys: pathBKeys },
      );
    }

    const artifact = input.artifact;
    assertPlainObject(
      artifact,
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_INVALID',
      'Path B artifact must be a plain object',
    );
    assertCanonicalArtifactShape(artifact);
    assertValidatedArtifactAuthoritySurface(artifact);

    if (artifact.eligibleObservationCount !== null
      && !Object.prototype.hasOwnProperty.call(input, 'eligibilityObservations')) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVATIONS_REQUIRED',
        'Validation of a known eligibleObservationCount requires eligibilityObservations',
        { eligibleObservationCount: artifact.eligibleObservationCount },
      );
    }

    const rebuilt = buildSampleSufficiencyPolicyArtifact(
      buildInputFromArtifact(
        artifact,
        Object.prototype.hasOwnProperty.call(input, 'eligibilityObservations')
          ? input.eligibilityObservations
          : undefined,
      ),
    );

    if (rebuilt.policyId !== artifact.policyId) {
      fail(
        'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_IDENTITY_MISMATCH',
        'policyId does not match canonical re-derivation',
        { claimed: artifact.policyId, expected: rebuilt.policyId },
      );
    }

    assertCanonicalArtifactEqualsRebuild(artifact, rebuilt);
    return rebuilt;
  }

  // Path A: artifact alone — only when eligibleObservationCount is null.
  const artifact = input;
  assertCanonicalArtifactShape(artifact);
  assertValidatedArtifactAuthoritySurface(artifact);

  if (artifact.eligibleObservationCount !== null) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ELIGIBILITY_OBSERVATIONS_REQUIRED',
      'Validation of a known eligibleObservationCount requires Path B eligibilityObservations',
      { eligibleObservationCount: artifact.eligibleObservationCount },
    );
  }

  const rebuilt = buildSampleSufficiencyPolicyArtifact(buildInputFromArtifact(artifact));

  if (rebuilt.policyId !== artifact.policyId) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_IDENTITY_MISMATCH',
      'policyId does not match canonical re-derivation',
      { claimed: artifact.policyId, expected: rebuilt.policyId },
    );
  }

  assertCanonicalArtifactEqualsRebuild(artifact, rebuilt);
  return rebuilt;
}

// ─── Public API surface ──────────────────────────────────────────────────────
// Intentionally ABSENT:
//   setMinimumN, setThreshold, markSufficient, markInsufficient,
//   computeSampleSize, computePower, computePValue, computeConfidenceInterval,
//   computeBrier, computeEce, promote, demote, mutateTrust, inventRegime

export default Object.freeze({
  SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
  SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_TYPE,
  SAMPLE_SUFFICIENCY_POLICY_TYPE,
  SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS,
  SAMPLE_SUFFICIENCY_POLICY_RISK_TIER,
  SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
  SAMPLE_SUFFICIENCY_POLICY_OFFICIAL_NAME,
  SAMPLE_SUFFICIENCY_POLICY_OWNERSHIP_ROLE,
  SAMPLE_SUFFICIENCY_POLICY_IS_SOURCE_OF_TRUTH,
  SAMPLE_SUFFICIENCY_POLICY_WRITER,
  SAMPLE_SUFFICIENCY_POLICY_METHOD_KEY,
  SAMPLE_SUFFICIENCY_POLICY_STAGE,
  SAMPLE_SUFFICIENCY_POLICY,
  SAMPLE_SUFFICIENCY_THRESHOLD_POLICY,
  MIN_ELIGIBLE_OBSERVATIONS_PER_COHORT,
  SUFFICIENCY_SCOPE,
  SUFFICIENCY_METHOD,
  CALIBRATION_SUFFICIENCY,
  SUFFICIENCY_VERDICT,
  SAMPLE_SUFFICIENCY_OWNER,
  THRESHOLD_INVENTION,
  SAMPLE_SIZE_INVENTION,
  AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  CANONICAL_SEGMENT_DIMENSION_ORDER,
  CANONICAL_VERSION_BINDING_FIELDS,
  COHORT_DESCRIPTOR_ALLOWLIST,
  REGIME_IDENTITY_CANONICAL,
  REGIME_CLASSIFIER,
  REGIME_CREATION,
  GLOBAL_AVERAGE_ONLY,
  GLOBAL_AVERAGE_ONLY_BYPASS,
  TRUST_WEIGHTING,
  PROMOTION,
  DEMOTION,
  CALIBRATION_EXECUTION,
  BINARY_BRIER_EXECUTION,
  SEGMENT_SCOPE,
  DOWNSTREAM_GATING,
  UNSUPPORTED_SEGMENTATION_DIMENSIONS,
  FORBIDDEN_THRESHOLD_FIELDS,
  FORBIDDEN_VERDICT_AUTHORITY_FIELDS,
  FORBIDDEN_TRUST_PROMOTION_FIELDS,
  FORBIDDEN_CALIBRATION_METRIC_FIELDS,
  REQUIRED_HARD_FLAGS,
  ZERO_SAMPLE_SUFFICIENCY_POLICY_SIDE_EFFECTS,
  SAMPLE_SUFFICIENCY_POLICY_LIMITATIONS,
  SAMPLE_SUFFICIENCY_POLICY_DESCRIPTOR,
  SampleSufficiencyPolicyContractError,
  getSampleSufficiencyPolicyDescriptor,
  validateSampleSufficiencyPolicyDescriptor,
  buildSampleSufficiencyPolicyArtifact,
  validateSampleSufficiencyPolicyArtifact,
  assertNotGlobalAverageOnlyAsSegmentedEvidence,
});
