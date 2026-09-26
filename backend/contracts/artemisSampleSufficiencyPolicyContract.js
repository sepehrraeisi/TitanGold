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
 * CRITICAL: There is currently NO authorized canonical sample-size threshold.
 * SAMPLE_SUFFICIENCY_THRESHOLD_POLICY = UNDEFINED / NOT_AUTHORIZED
 * SAMPLE_SUFFICIENCY_POLICY = UNDEFINED / DEFERRED
 * SUFFICIENCY_VERDICT = UNDEFINED / DEFERRED
 *
 * Do NOT invent N=10/20/30/50/100/200 or any equivalent numeric rule.
 * Do NOT declare SUFFICIENT or INSUFFICIENT while threshold policy is undefined.
 * Caller-supplied sufficient/insufficient/minimumN/threshold authority FAIL_CLOSED.
 *
 * NOT Source of Truth. No regime classifier. No trust/weight/promotion/demotion.
 * No calibration / Brier execution. No Aggregate performance computation.
 * GLOBAL_AVERAGE_ONLY presented as segmented evidence = FAIL_CLOSED.
 */

import { hashToUuid } from './artemisReplayContract.js';

// ─── Canonical identity ──────────────────────────────────────────────────────

export const SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION = '1.0.0';
export const SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION =
  'artemis-sample-sufficiency-policy-1.0.0';
export const SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION =
  'artemis-sample-sufficiency-policy-policy-1.0.0';
export const SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION = '1.0.0';
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

// ─── Policy state (canonical — no threshold inventing) ───────────────────────

/**
 * Canonical sample-sufficiency policy state.
 * Until a later Owner-authorized threshold policy exists, this remains deferred.
 */
export const SAMPLE_SUFFICIENCY_POLICY =
  'UNDEFINED / DEFERRED';

/**
 * Canonical threshold-policy state.
 * There is currently NO authorized numeric threshold.
 */
export const SAMPLE_SUFFICIENCY_THRESHOLD_POLICY =
  'UNDEFINED / NOT_AUTHORIZED';

/**
 * Canonical sufficiency verdict while threshold policy is undefined.
 * NEVER coerce to SUFFICIENT or INSUFFICIENT.
 */
export const SUFFICIENCY_VERDICT = Object.freeze({
  UNDEFINED_DEFERRED: 'UNDEFINED / DEFERRED',
  UNAVAILABLE: 'UNAVAILABLE',
});

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
  trustWeighting: 'BLOCKED_UNTIL_THRESHOLD_POLICY_AUTHORIZED',
  promotion: 'BLOCKED_UNTIL_THRESHOLD_POLICY_AUTHORIZED',
  demotion: 'BLOCKED_UNTIL_THRESHOLD_POLICY_AUTHORIZED',
  calibrationExecution: 'NOT_AUTHORIZED',
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
  'sample_sufficiency_policy_undefined_deferred',
  'sample_sufficiency_threshold_policy_undefined_not_authorized',
  'sufficiency_verdict_undefined_deferred_until_threshold_policy',
  'threshold_invention_forbidden',
  'sample_size_invention_forbidden',
  'no_sufficient_or_insufficient_verdict_without_threshold',
  'canonical_segment_dimensions_only_venue_marketType_symbol_timeframe',
  'regime_identity_canonical_no',
  'regime_classifier_no',
  'regime_creation_no',
  'global_average_only_not_sufficient_for_stage10',
  'global_average_only_bypass_closed',
  'global_average_cannot_become_segmented_evidence',
  'no_trust_mutation',
  'no_weight_mutation',
  'no_promotion_execution',
  'no_demotion_execution',
  'no_calibration_execution',
  'no_binary_brier_execution',
  'library_only',
  'validation_boundary_not_sot',
  'is_source_of_truth_false',
  'no_runtime_activation',
  'no_persistence',
  'no_network_provider_llm_worker_scheduler',
  'caller_supplied_threshold_authority_forbidden',
  'caller_supplied_sufficiency_verdict_authority_forbidden',
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
]);

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
    'sufficiencyVerdict must remain UNDEFINED / DEFERRED',
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

/**
 * Build a library-only Sample Sufficiency Policy artifact.
 *
 * Always emits sufficiencyVerdict = UNDEFINED / DEFERRED.
 * Does NOT invent thresholds. Does NOT declare sufficient/insufficient.
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

  // Semantic identity excludes recordedAt (bookkeeping only).
  const identityPayload = {
    schemaVersion: SAMPLE_SUFFICIENCY_POLICY_SCHEMA_VERSION,
    contractVersion: SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
    policyVersion: SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
    implementationVersion: SAMPLE_SUFFICIENCY_POLICY_IMPLEMENTATION_VERSION,
    sliceId: SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
    sampleSufficiencyPolicy: SAMPLE_SUFFICIENCY_POLICY,
    sampleSufficiencyThresholdPolicy: SAMPLE_SUFFICIENCY_THRESHOLD_POLICY,
    sufficiencyVerdict: SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED,
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
    sufficiencyVerdict: SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED,
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
export function validateSampleSufficiencyPolicyArtifact(artifact) {
  assertPlainObject(
    artifact,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_INVALID',
    'Artifact must be a plain object',
  );

  // Inventing fields (minimumN / sufficient / …) remain forbidden on artifacts.
  // Canonical `sufficiencyVerdict` / policy-state keys are validated exactly below
  // — do NOT treat their presence as caller authority.
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

  assertExactString(
    artifact.contractVersion,
    SAMPLE_SUFFICIENCY_POLICY_CONTRACT_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_CONTRACT_VERSION_MISMATCH',
    'contractVersion mismatch',
  );
  assertExactString(
    artifact.policyVersion,
    SAMPLE_SUFFICIENCY_POLICY_POLICY_VERSION,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_POLICY_VERSION_MISMATCH',
    'policyVersion mismatch',
  );
  assertExactString(
    artifact.authorityClass,
    SAMPLE_SUFFICIENCY_POLICY_AUTHORITY_CLASS,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_AUTHORITY_CLASS_MISMATCH',
    'authorityClass mismatch',
  );
  assertExactString(
    artifact.sliceId,
    SAMPLE_SUFFICIENCY_POLICY_SLICE_ID,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_SLICE_ID_MISMATCH',
    'sliceId mismatch',
  );
  assertExactBoolean(
    artifact.isSourceOfTruth,
    false,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_IS_SOT_MISMATCH',
    'isSourceOfTruth must be false',
  );
  assertExactString(
    artifact.sampleSufficiencyPolicy,
    SAMPLE_SUFFICIENCY_POLICY,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_STATE_MISMATCH',
    'sampleSufficiencyPolicy mismatch',
  );
  assertExactString(
    artifact.sampleSufficiencyThresholdPolicy,
    SAMPLE_SUFFICIENCY_THRESHOLD_POLICY,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_THRESHOLD_STATE_MISMATCH',
    'sampleSufficiencyThresholdPolicy mismatch',
  );
  assertExactString(
    artifact.sufficiencyVerdict,
    SUFFICIENCY_VERDICT.UNDEFINED_DEFERRED,
    'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_VERDICT_MISMATCH',
    'sufficiencyVerdict must remain UNDEFINED / DEFERRED',
  );

  const input = {};
  if (artifact.cohort != null) input.cohort = artifact.cohort;
  if (artifact.aggregateRef != null) input.aggregateRef = artifact.aggregateRef;
  if (artifact.segmentedPerformancePolicyRef != null) {
    input.segmentedPerformancePolicyRef = artifact.segmentedPerformancePolicyRef;
  }
  if (artifact.segmentScope != null) input.segmentScope = artifact.segmentScope;
  if (artifact.recordedAt != null) input.recordedAt = artifact.recordedAt;

  const rebuilt = buildSampleSufficiencyPolicyArtifact(input);
  if (rebuilt.policyId !== artifact.policyId) {
    fail(
      'SAMPLE_SUFFICIENCY_POLICY_ARTIFACT_IDENTITY_MISMATCH',
      'policyId does not match canonical re-derivation',
      { claimed: artifact.policyId, expected: rebuilt.policyId },
    );
  }
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
