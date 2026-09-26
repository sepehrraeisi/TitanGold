/**
 * Artemis Segmented Performance Policy Contract
 *
 * Stage 10 — S10-SEGMENTED-PERFORMANCE-POLICY-CONTRACT
 * Official: ARTEMIS_SEGMENTED_PERFORMANCE_POLICY_CONTRACT_BOUNDARY
 * Authority: OUTCOME_EVALUATION · Risk Tier 3
 *
 * Deterministic, non-executing, library-only semantic/policy boundary.
 * Establishes canonical segmented-performance policy so a weak global average
 * cannot hide poor performance in a specific meaningful segment.
 *
 * Canonical segment dimensions (ONLY):
 *   venue · marketType · symbol · timeframe
 *
 * NOT Source of Truth. No regime classifier. No sample-sufficiency thresholds.
 * No trust / weight / promotion / demotion. No calibration / Brier execution.
 * No Aggregate performance computation (that remains Aggregate's owner).
 *
 * GLOBAL_AVERAGE_ONLY presented as segmented evidence = FAIL_CLOSED.
 * Caller-supplied segmentId is never authoritative — re-derived and compared.
 */

import { hashToUuid } from './artemisReplayContract.js';

// ─── Canonical identity ──────────────────────────────────────────────────────

export const SEGMENTED_PERFORMANCE_POLICY_SCHEMA_VERSION = '1.0.0';
export const SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION =
  'artemis-segmented-performance-policy-1.0.0';
export const SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION =
  'artemis-segmented-performance-policy-policy-1.0.0';
export const SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION = '1.0.0';
export const SEGMENTED_PERFORMANCE_POLICY_ARTIFACT_TYPE =
  'ARTEMIS_SEGMENTED_PERFORMANCE_POLICY';
export const SEGMENTED_PERFORMANCE_POLICY_TYPE =
  'SEGMENTED_PERFORMANCE_POLICY';
export const SEGMENTED_PERFORMANCE_POLICY_AUTHORITY_CLASS = 'OUTCOME_EVALUATION';
export const SEGMENTED_PERFORMANCE_POLICY_RISK_TIER = 'Tier 3';
export const SEGMENTED_PERFORMANCE_POLICY_SLICE_ID =
  'S10-SEGMENTED-PERFORMANCE-POLICY-CONTRACT';
export const SEGMENTED_PERFORMANCE_POLICY_OFFICIAL_NAME =
  'ARTEMIS_SEGMENTED_PERFORMANCE_POLICY_CONTRACT_BOUNDARY';
export const SEGMENTED_PERFORMANCE_POLICY_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const SEGMENTED_PERFORMANCE_POLICY_IS_SOURCE_OF_TRUTH = false;
export const SEGMENTED_PERFORMANCE_POLICY_WRITER =
  'artemisSegmentedPerformancePolicyContract';
export const SEGMENTED_PERFORMANCE_POLICY_METHOD_KEY =
  'artemis.segmented.performance.policy.v1';
export const SEGMENTED_PERFORMANCE_POLICY_STAGE = 'ARTEMIS_CORE_STAGE_10';

export const CALLER_SELF_REGISTRATION = false;
export const METHOD_REGISTRATION_OWNER = 'NONE';

/** Max UTF-8 bytes for a validated descriptor / segment identity artifact. */
export const MAX_SEGMENTED_PERFORMANCE_POLICY_BYTES = 65536;

// ─── Canonical segment dimensions ────────────────────────────────────────────

/**
 * ONLY authorized segmentation dimensions for this slice.
 * Do NOT expand without explicit Stage 10 authorization.
 */
export const AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS = Object.freeze([
  'venue',
  'marketType',
  'symbol',
  'timeframe',
]);

/** Deterministic dimension order for identity hashing. */
export const CANONICAL_SEGMENT_DIMENSION_ORDER = Object.freeze([
  'venue',
  'marketType',
  'symbol',
  'timeframe',
]);

/**
 * Upstream Aggregate cohort may also carry version-binding fields.
 * These are NOT segmentation dimensions — they preserve homogeneous cohort
 * compatibility with Evaluation Performance Aggregate. Absent = unavailable.
 */
export const CANONICAL_VERSION_BINDING_FIELDS = Object.freeze([
  'methodKey',
  'methodImplementationVersion',
  'evaluationImplementationVersion',
  'policyVersion',
  'contractVersion',
]);

/** Full Aggregate-compatible cohort allowlist (segment dims + version binding). */
export const COHORT_DESCRIPTOR_ALLOWLIST = Object.freeze([
  ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  ...CANONICAL_VERSION_BINDING_FIELDS,
]);

export const SEGMENT_IDENTITY_ALLOWLIST = Object.freeze([
  ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  'segmentId',
]);

/**
 * Public input allowlist for computeCanonicalSegmentId().
 * Validates BEFORE thinning to four canonical dimensions so unsupported /
 * unknown / forbidden fields cannot be silently discarded.
 */
export const COMPUTE_CANONICAL_SEGMENT_ID_ALLOWLIST = Object.freeze([
  ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  'segmentId',
  ...CANONICAL_VERSION_BINDING_FIELDS,
]);

/**
 * Strict top-level allowlist for assertNotGlobalAverageOnlyBypass() claims.
 * No metadata bag; unknown claim fields FAIL_CLOSED.
 */
export const CLAIM_PUBLIC_ALLOWLIST = Object.freeze([
  'segmentScope',
  'claimType',
  'segmented',
  'globalAverageOnly',
  'scope',
  'requiresSegmented',
  'segment',
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'segmentId',
]);

/** Top-level claim fields that compete with nested `segment` as identity source. */
export const CLAIM_TOP_LEVEL_SEGMENT_SOURCE_FIELDS = Object.freeze([
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'segmentId',
]);

export const REGIME_IDENTITY_CANONICAL = false;
export const REGIME_CLASSIFIER = false;
export const REGIME_CREATION = false;
export const ANALYSIS_HORIZON_SEGMENTATION = false;

export const SAMPLE_SUFFICIENCY_OWNER = 'NONE';
export const SAMPLE_SUFFICIENCY_POLICY =
  'UNDEFINED / DEFERRED / LATER_STAGE10_DEPENDENCY';

export const GLOBAL_AVERAGE_ONLY = 'NOT_SUFFICIENT_FOR_STAGE10';
export const GLOBAL_AVERAGE_ONLY_BYPASS = 'CLOSED';

export const TRUST_WEIGHTING = 'NOT_AUTHORIZED';
export const PROMOTION = 'NOT_AUTHORIZED';
export const DEMOTION = 'NOT_AUTHORIZED';
export const CALIBRATION_EXECUTION = false;
export const BINARY_BRIER_EXECUTION = false;

/** Explicit scope labels — never coerce MISSING/UNKNOWN/UNAVAILABLE → GLOBAL. */
export const SEGMENT_SCOPE = Object.freeze({
  SEGMENTED: 'SEGMENTED',
  GLOBAL_AVERAGE_ONLY: 'GLOBAL_AVERAGE_ONLY',
  UNSUPPORTED: 'UNSUPPORTED',
  UNAVAILABLE: 'UNAVAILABLE',
  MISSING: 'MISSING',
});

export const SEGMENT_IDENTITY_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
});

// ─── Forbidden / unsupported vocabularies ────────────────────────────────────

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

export const FORBIDDEN_SAMPLE_SUFFICIENCY_FIELDS = Object.freeze([
  'minimumN',
  'minSampleSize',
  'minimumObservations',
  'confidenceThreshold',
  'significanceLevel',
  'powerThreshold',
  'statisticalPower',
  'segmentMinimum',
  'minimumSegmentCount',
  'minN',
  'sampleThreshold',
  'sufficiencyThreshold',
]);

export const FORBIDDEN_TRUST_PROMOTION_FIELDS = Object.freeze([
  'trustScore',
  'weight',
  'agentWeight',
  'trust',
  'promotionEligible',
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

const FORBIDDEN_KEY_LOOKUP = Object.freeze(
  Object.fromEntries(
    [
      ...UNSUPPORTED_SEGMENTATION_DIMENSIONS,
      ...FORBIDDEN_SAMPLE_SUFFICIENCY_FIELDS,
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

export const ZERO_SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECTS = Object.freeze({
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

export const SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS = Object.freeze([
  'canonical_segment_dimensions_only_venue_marketType_symbol_timeframe',
  'regime_identity_canonical_no',
  'regime_classifier_no',
  'regime_creation_no',
  'analysis_horizon_segmentation_no',
  'sample_sufficiency_policy_deferred',
  'sample_sufficiency_owner_none',
  'global_average_only_not_sufficient_for_stage10',
  'global_average_only_bypass_closed',
  'caller_supplied_segment_id_non_authoritative',
  'no_aggregate_performance_computation',
  'no_match_mismatch_rate_computation',
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
  'missing_unknown_unavailable_segment_never_equals_global',
]);

export const UPSTREAM_READ_REFERENCE_ONLY = Object.freeze({
  evaluationPerformanceAggregateContract: 'READ_REFERENCE_ONLY',
  observedOutcomeEvaluationContract: 'READ_REFERENCE_ONLY',
  observedOutcomeEvaluationSourceOfTruth: 'READ_REFERENCE_ONLY',
  observedOutcomeContract: 'READ_REFERENCE_ONLY',
  confidenceCalibrationContract: 'READ_REFERENCE_ONLY',
  calibrationMeasurementPolicyContract: 'READ_REFERENCE_ONLY',
  decisionLineageContract: 'READ_REFERENCE_ONLY',
  replayContract: 'READ_REFERENCE_ONLY',
  replayResultContract: 'READ_REFERENCE_ONLY',
});

// ─── Fail-closed error ───────────────────────────────────────────────────────

export class SegmentedPerformancePolicyContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'SegmentedPerformancePolicyContractError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new SegmentedPerformancePolicyContractError(code, message, details);
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
      // Descriptor may legitimately declare deferred/forbidden policy status.
      const exempt =
        path === ''
        && (
          key === 'sampleSufficiencyPolicy'
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
          || key === 'hardFlags'
          || key === 'sideEffects'
          || key === 'limitations'
          || key === 'upstreamReadReferenceOnly'
          || key === 'unsupportedSegmentationDimensions'
          || key === 'forbiddenSampleSufficiencyFields'
          || key === 'forbiddenTrustPromotionFields'
          || key === 'forbiddenCalibrationMetricFields'
        );
      if (!exempt) {
        out.push(nextPath);
      }
    }
    // Nested hardFlags / sideEffects keys are allowlisted by structure later;
    // still scan children except known status containers already handled above.
    if (
      key === 'hardFlags'
      || key === 'sideEffects'
      || key === 'upstreamReadReferenceOnly'
      || key === 'limitations'
      || key === 'unsupportedSegmentationDimensions'
      || key === 'forbiddenSampleSufficiencyFields'
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

function normalizeSegmentDimensionValue(value, field) {
  if (value === undefined) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_MISSING',
      `Missing required canonical segment dimension: ${field}`,
      { field },
    );
  }
  if (value === null) {
    // Explicit null is allowed as "dimension present but unavailable" only when
    // ALL four dimensions are present keys — still a valid homogeneous null cohort.
    // But for REQUIRED segment identity used as SEGMENTED evidence, null dims
    // make segment identity UNAVAILABLE (cannot masquerade as global).
    return null;
  }
  if (typeof value !== 'string') {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_INVALID',
      `Segment dimension ${field} must be a string or null`,
      { field, type: typeof value },
    );
  }
  if (value.length === 0) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_EMPTY',
      `Segment dimension ${field} must not be empty string`,
      { field },
    );
  }
  if (value.length > 256) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_TOO_LONG',
      `Segment dimension ${field} exceeds max length`,
      { field },
    );
  }
  return value;
}

function assertNoUnsupportedOrAuthorityFields(input) {
  for (const key of Object.keys(input)) {
    if (UNSUPPORTED_SEGMENTATION_DIMENSIONS.includes(key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_UNSUPPORTED_DIMENSION',
        `Unsupported segmentation dimension: ${key}`,
        { dimension: key },
      );
    }
    if (FORBIDDEN_SAMPLE_SUFFICIENCY_FIELDS.includes(key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_SAMPLE_SUFFICIENCY_FORBIDDEN',
        `Sample sufficiency field forbidden: ${key}`,
        { field: key },
      );
    }
    if (FORBIDDEN_TRUST_PROMOTION_FIELDS.includes(key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_TRUST_PROMOTION_FORBIDDEN',
        `Trust/promotion/demotion field forbidden: ${key}`,
        { field: key },
      );
    }
    if (FORBIDDEN_CALIBRATION_METRIC_FIELDS.includes(key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_CALIBRATION_METRIC_FORBIDDEN',
        `Calibration metric field forbidden: ${key}`,
        { field: key },
      );
    }
    if (FORBIDDEN_PERFORMANCE_COMPUTATION_FIELDS.includes(key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_PERFORMANCE_COMPUTATION_FORBIDDEN',
        `Performance computation field forbidden: ${key}`,
        { field: key },
      );
    }
  }
}

function extractSegmentDimensions(input) {
  assertPlainObject(
    input,
    'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_INVALID',
    'Segment identity input must be a plain object',
  );

  // Reject unsupported / forbidden keys first (before allowlist so codes are precise).
  assertNoUnsupportedOrAuthorityFields(input);

  assertAllowlist(
    input,
    SEGMENT_IDENTITY_ALLOWLIST,
    'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_UNKNOWN_FIELD',
    'segmentIdentity',
  );
  assertNoForbiddenOrSecrets(
    input,
    'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_FORBIDDEN_FIELD',
  );

  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    if (!Object.prototype.hasOwnProperty.call(input, dim)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_MISSING',
        `Missing required canonical segment dimension: ${dim}`,
        { field: dim },
      );
    }
  }

  return Object.freeze({
    venue: normalizeSegmentDimensionValue(input.venue, 'venue'),
    marketType: normalizeSegmentDimensionValue(input.marketType, 'marketType'),
    symbol: normalizeSegmentDimensionValue(input.symbol, 'symbol'),
    timeframe: normalizeSegmentDimensionValue(input.timeframe, 'timeframe'),
  });
}

/**
 * Deterministic segment identity from the four canonical dimensions only.
 * Uses repository Replay hashToUuid (same Aggregate ID convention).
 * Does NOT include Date.now / random / caller ordering.
 * Version-binding fields (if present on a cohort descriptor) are ignored for
 * segmentId — they are not segmentation dimensions.
 */
export function computeCanonicalSegmentId(segmentDimensions) {
  if (!isPlainObjectSafe(segmentDimensions)) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_INVALID',
      'segmentDimensions must be a plain object',
    );
  }

  // FAIL_CLOSED on public input BEFORE thinning — unsupported / unknown /
  // forbidden fields must never be silently discarded.
  assertSizeBound(
    segmentDimensions,
    MAX_SEGMENTED_PERFORMANCE_POLICY_BYTES,
    'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_SIZE_EXCEEDED',
  );
  assertNoUnsupportedOrAuthorityFields(segmentDimensions);
  assertAllowlist(
    segmentDimensions,
    COMPUTE_CANONICAL_SEGMENT_ID_ALLOWLIST,
    'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_UNKNOWN_FIELD',
    'computeCanonicalSegmentId',
  );
  assertNoForbiddenOrSecrets(
    segmentDimensions,
    'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_FORBIDDEN_FIELD',
  );

  // Accept either a thin segment object or an Aggregate-compatible cohort.
  // Thin ONLY after public validation so identity algorithm stays unchanged.
  const thin = {};
  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    if (Object.prototype.hasOwnProperty.call(segmentDimensions, dim)) {
      thin[dim] = segmentDimensions[dim];
    }
  }
  if (Object.prototype.hasOwnProperty.call(segmentDimensions, 'segmentId')) {
    // segmentId is never an identity input — ignore for hashing.
  }

  const dims = extractSegmentDimensions(thin);

  const material = {
    schemaVersion: SEGMENTED_PERFORMANCE_POLICY_SCHEMA_VERSION,
    contractVersion: SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
    policyVersion: SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
    implementationVersion: SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    venue: dims.venue,
    marketType: dims.marketType,
    symbol: dims.symbol,
    timeframe: dims.timeframe,
  };

  return hashToUuid(
    `artemis-segmented-performance-policy-segment-v1|${stableJson(material)}`,
  );
}

function isPlainObjectSafe(value) {
  return (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.toString.call(value) === '[object Object]'
  );
}

function allSegmentDimensionsNull(dims) {
  return (
    dims.venue === null
    && dims.marketType === null
    && dims.symbol === null
    && dims.timeframe === null
  );
}

/**
 * Validate and canonicalize a segment identity.
 * Caller-supplied segmentId is never authoritative — must match re-derivation.
 */
export function validateCanonicalSegmentIdentity(input) {
  assertPlainObject(
    input,
    'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_INVALID',
    'Segment identity input must be a plain object',
  );
  assertSizeBound(
    input,
    MAX_SEGMENTED_PERFORMANCE_POLICY_BYTES,
    'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_SIZE_EXCEEDED',
  );

  const callerSegmentId = Object.prototype.hasOwnProperty.call(input, 'segmentId')
    ? input.segmentId
    : undefined;

  const dims = extractSegmentDimensions(input);
  const derivedSegmentId = computeCanonicalSegmentId(dims);

  if (callerSegmentId !== undefined) {
    if (typeof callerSegmentId !== 'string' || callerSegmentId.length === 0) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_ID_INVALID',
        'Caller-supplied segmentId must be a non-empty string when present',
      );
    }
    if (callerSegmentId !== derivedSegmentId) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_ID_MISMATCH',
        'Caller-supplied segmentId does not match canonical derivation',
        { expected: derivedSegmentId },
      );
    }
  }

  const unavailable = allSegmentDimensionsNull(dims);
  const artifact = {
    schemaVersion: SEGMENTED_PERFORMANCE_POLICY_SCHEMA_VERSION,
    contractVersion: SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
    policyVersion: SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
    implementationVersion: SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    artifactType: SEGMENTED_PERFORMANCE_POLICY_ARTIFACT_TYPE,
    authorityClass: SEGMENTED_PERFORMANCE_POLICY_AUTHORITY_CLASS,
    sliceId: SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
    ownershipRole: SEGMENTED_PERFORMANCE_POLICY_OWNERSHIP_ROLE,
    isSourceOfTruth: false,
    segmentId: derivedSegmentId,
    segmentScope: SEGMENT_SCOPE.SEGMENTED,
    segmentIdentityStatus: unavailable
      ? SEGMENT_IDENTITY_STATUS.UNAVAILABLE
      : SEGMENT_IDENTITY_STATUS.AVAILABLE,
    venue: dims.venue,
    marketType: dims.marketType,
    symbol: dims.symbol,
    timeframe: dims.timeframe,
    regimeIdentityCanonical: false,
    sampleSufficiencyPolicy: SAMPLE_SUFFICIENCY_POLICY,
    globalAverageOnlyBypass: GLOBAL_AVERAGE_ONLY_BYPASS,
    hardFlags: { ...REQUIRED_HARD_FLAGS },
    sideEffects: { ...ZERO_SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECTS },
    provenance: {
      writer: SEGMENTED_PERFORMANCE_POLICY_WRITER,
      methodKey: SEGMENTED_PERFORMANCE_POLICY_METHOD_KEY,
      stage: SEGMENTED_PERFORMANCE_POLICY_STAGE,
      sliceId: SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
      policyVersion: SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
      implementationVersion: SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    },
    limitations: [...SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS],
  };

  return freezeDeep(artifact);
}

/**
 * Fail closed if GLOBAL_AVERAGE_ONLY (or missing/unsupported/unavailable
 * segment) is presented as segmented Stage 10 performance evidence.
 */
export function assertNotGlobalAverageOnlyBypass(claim) {
  assertPlainObject(
    claim,
    'SEGMENTED_PERFORMANCE_POLICY_CLAIM_INVALID',
    'Performance claim must be a plain object',
  );
  assertSizeBound(
    claim,
    MAX_SEGMENTED_PERFORMANCE_POLICY_BYTES,
    'SEGMENTED_PERFORMANCE_POLICY_CLAIM_SIZE_EXCEEDED',
  );
  // Forbidden codes first so existing CLAIM_FORBIDDEN_FIELD regressions stay precise.
  assertNoForbiddenOrSecrets(
    claim,
    'SEGMENTED_PERFORMANCE_POLICY_CLAIM_FORBIDDEN_FIELD',
  );
  assertAllowlist(
    claim,
    CLAIM_PUBLIC_ALLOWLIST,
    'SEGMENTED_PERFORMANCE_POLICY_CLAIM_UNKNOWN_FIELD',
    'performanceClaim',
  );

  // Dual representation: nested `segment` XOR top-level dims/segmentId — never merge.
  if (isPlainObjectSafe(claim.segment)) {
    const competing = CLAIM_TOP_LEVEL_SEGMENT_SOURCE_FIELDS.filter((field) => (
      Object.prototype.hasOwnProperty.call(claim, field)
    ));
    if (competing.length > 0) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_CLAIM_AMBIGUOUS_SEGMENT_SOURCE',
        'Claim must not supply both nested segment and top-level segment identity fields',
        { competing },
      );
    }
  }

  const scope = claim.segmentScope;
  const claimType = claim.claimType;
  const segmented = claim.segmented === true;
  const globalOnly =
    scope === SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY
    || claimType === 'GLOBAL_AVERAGE_ONLY'
    || claim.globalAverageOnly === true
    || claim.scope === 'GLOBAL'
    || claim.scope === 'GLOBAL_AVERAGE_ONLY';

  if (globalOnly && (segmented || scope === SEGMENT_SCOPE.SEGMENTED)) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_GLOBAL_AVERAGE_BYPASS',
      'GLOBAL_AVERAGE_ONLY cannot masquerade as segmented performance evidence',
      { scope, claimType },
    );
  }

  if (globalOnly) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_GLOBAL_AVERAGE_NOT_SUFFICIENT',
      'GLOBAL_AVERAGE_ONLY is not sufficient for Stage 10 segmented performance',
      { scope, claimType },
    );
  }

  if (
    scope === SEGMENT_SCOPE.MISSING
    || scope === SEGMENT_SCOPE.UNAVAILABLE
    || scope === SEGMENT_SCOPE.UNSUPPORTED
  ) {
    if (segmented || claim.segmentId != null) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_INVALID_SEGMENT_SCOPE_COERCION',
        'MISSING/UNAVAILABLE/UNSUPPORTED segment cannot become segmented or global',
        { scope },
      );
    }
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_SCOPE_NOT_SEGMENTED',
      'Segment scope is not a valid canonical segmented identity',
      { scope },
    );
  }

  // A claim that asserts segmented evidence must carry canonical segment identity.
  if (segmented || scope === SEGMENT_SCOPE.SEGMENTED || claim.requiresSegmented === true) {
    if (!isPlainObjectSafe(claim.segment) && claim.venue === undefined) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_REQUIRED',
        'Segmented performance claim requires canonical segment identity',
      );
    }
    const segmentInput = isPlainObjectSafe(claim.segment)
      ? claim.segment
      : {
        venue: claim.venue,
        marketType: claim.marketType,
        symbol: claim.symbol,
        timeframe: claim.timeframe,
        ...(claim.segmentId !== undefined ? { segmentId: claim.segmentId } : {}),
      };
    return validateCanonicalSegmentIdentity(segmentInput);
  }

  fail(
    'SEGMENTED_PERFORMANCE_POLICY_CLAIM_NOT_SEGMENTED',
    'Claim is not a valid segmented performance evidence request',
  );
}

/**
 * Normalize an Aggregate-compatible cohort descriptor.
 * Segment dims required; version-binding fields optional (null when absent).
 * Rejects mixed unsupported dimensions and forbidden fields.
 */
export function validateCohortDescriptor(input) {
  assertPlainObject(
    input,
    'SEGMENTED_PERFORMANCE_POLICY_COHORT_INVALID',
    'Cohort descriptor must be a plain object',
  );
  assertSizeBound(
    input,
    MAX_SEGMENTED_PERFORMANCE_POLICY_BYTES,
    'SEGMENTED_PERFORMANCE_POLICY_COHORT_SIZE_EXCEEDED',
  );

  for (const key of Object.keys(input)) {
    if (UNSUPPORTED_SEGMENTATION_DIMENSIONS.includes(key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_UNSUPPORTED_DIMENSION',
        `Unsupported segmentation dimension: ${key}`,
        { dimension: key },
      );
    }
    if (FORBIDDEN_SAMPLE_SUFFICIENCY_FIELDS.includes(key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_SAMPLE_SUFFICIENCY_FORBIDDEN',
        `Sample sufficiency field forbidden: ${key}`,
        { field: key },
      );
    }
    if (FORBIDDEN_TRUST_PROMOTION_FIELDS.includes(key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_TRUST_PROMOTION_FORBIDDEN',
        `Trust/promotion/demotion field forbidden: ${key}`,
        { field: key },
      );
    }
    if (FORBIDDEN_CALIBRATION_METRIC_FIELDS.includes(key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_CALIBRATION_METRIC_FORBIDDEN',
        `Calibration metric field forbidden: ${key}`,
        { field: key },
      );
    }
  }

  assertAllowlist(
    input,
    COHORT_DESCRIPTOR_ALLOWLIST,
    'SEGMENTED_PERFORMANCE_POLICY_COHORT_UNKNOWN_FIELD',
    'cohort',
  );
  assertNoForbiddenOrSecrets(
    input,
    'SEGMENTED_PERFORMANCE_POLICY_COHORT_FORBIDDEN_FIELD',
  );

  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    if (!Object.prototype.hasOwnProperty.call(input, dim)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_MISSING',
        `Missing required canonical segment dimension: ${dim}`,
        { field: dim },
      );
    }
  }

  const cohort = {
    venue: normalizeSegmentDimensionValue(input.venue, 'venue'),
    marketType: normalizeSegmentDimensionValue(input.marketType, 'marketType'),
    symbol: normalizeSegmentDimensionValue(input.symbol, 'symbol'),
    timeframe: normalizeSegmentDimensionValue(input.timeframe, 'timeframe'),
  };

  for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      cohort[field] = null;
      continue;
    }
    const v = input[field];
    if (v === null) {
      cohort[field] = null;
      continue;
    }
    if (typeof v !== 'string' || v.length === 0 || v.length > 512) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_VERSION_BINDING_INVALID',
        `Version binding field ${field} must be a non-empty string or null`,
        { field },
      );
    }
    cohort[field] = v;
  }

  return freezeDeep(cohort);
}

/**
 * Homogeneous cohort check across a list of Aggregate-compatible descriptors.
 * Mixed venue/marketType/symbol/timeframe → MIXED_COHORT.
 * Mixed version-binding fields → MIXED_EVALUATION_VERSION_COHORT.
 */
export function assertHomogeneousSegmentCohort(cohortList) {
  if (!Array.isArray(cohortList) || cohortList.length === 0) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_COHORT_LIST_INVALID',
      'cohortList must be a non-empty array',
    );
  }
  if (cohortList.length > 10000) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_COHORT_LIST_TOO_LARGE',
      'cohortList exceeds max size',
    );
  }

  const normalized = cohortList.map((item, index) => {
    try {
      return validateCohortDescriptor(item);
    } catch (err) {
      if (err instanceof SegmentedPerformancePolicyContractError) {
        fail(err.code, err.message, { ...(err.details || {}), index });
      }
      throw err;
    }
  });

  const first = normalized[0];
  for (let i = 1; i < normalized.length; i += 1) {
    const next = normalized[i];

    for (const field of CANONICAL_VERSION_BINDING_FIELDS) {
      if (next[field] !== first[field]) {
        fail(
          'MIXED_EVALUATION_VERSION_COHORT',
          'Cohort items have mixed contract/policy/method/implementation versions',
          { index: i, field, expected: first[field], actual: next[field] },
        );
      }
    }

    for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
      if (next[dim] !== first[dim]) {
        fail(
          'MIXED_COHORT',
          `Cohort items have mixed ${dim}`,
          { index: i, field: dim, expected: first[dim], actual: next[dim] },
        );
      }
    }
  }

  // Homogeneous UNAVAILABLE dimensions must not yield a usable segmented identity.
  // validateCohortDescriptor may still represent explicit null as UNAVAILABLE;
  // this assertion rejects unavailable cohorts as segmented performance evidence.
  for (const dim of AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS) {
    if (first[dim] === null) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_UNAVAILABLE_SEGMENT_NOT_ELIGIBLE',
        'Unavailable canonical segment cannot be used as a valid segmented performance cohort',
        { field: dim, segmentScope: SEGMENT_SCOPE.UNAVAILABLE },
      );
    }
  }

  const segmentId = computeCanonicalSegmentId(first);
  return freezeDeep({
    cohort: first,
    segmentId,
    count: normalized.length,
    homogeneous: true,
  });
}

// ─── Canonical descriptor ────────────────────────────────────────────────────

function buildPolicyDescriptor() {
  return freezeDeep({
    schemaVersion: SEGMENTED_PERFORMANCE_POLICY_SCHEMA_VERSION,
    contractVersion: SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
    policyVersion: SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
    implementationVersion: SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    artifactType: SEGMENTED_PERFORMANCE_POLICY_ARTIFACT_TYPE,
    policyType: SEGMENTED_PERFORMANCE_POLICY_TYPE,
    authorityClass: SEGMENTED_PERFORMANCE_POLICY_AUTHORITY_CLASS,
    riskTier: SEGMENTED_PERFORMANCE_POLICY_RISK_TIER,
    sliceId: SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
    officialName: SEGMENTED_PERFORMANCE_POLICY_OFFICIAL_NAME,
    ownershipRole: SEGMENTED_PERFORMANCE_POLICY_OWNERSHIP_ROLE,
    isSourceOfTruth: false,
    methodRegistrationOwner: METHOD_REGISTRATION_OWNER,
    callerSelfRegistration: CALLER_SELF_REGISTRATION,

    authorizedCanonicalSegmentDimensions: [
      ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
    ],
    canonicalSegmentDimensionOrder: [...CANONICAL_SEGMENT_DIMENSION_ORDER],
    canonicalVersionBindingFields: [...CANONICAL_VERSION_BINDING_FIELDS],
    cohortDescriptorAllowlist: [...COHORT_DESCRIPTOR_ALLOWLIST],

    regimeIdentityCanonical: REGIME_IDENTITY_CANONICAL,
    regimeClassifier: REGIME_CLASSIFIER,
    regimeCreation: REGIME_CREATION,
    analysisHorizonSegmentation: ANALYSIS_HORIZON_SEGMENTATION,

    sampleSufficiencyOwner: SAMPLE_SUFFICIENCY_OWNER,
    sampleSufficiencyPolicy: SAMPLE_SUFFICIENCY_POLICY,

    globalAverageOnly: GLOBAL_AVERAGE_ONLY,
    globalAverageOnlyBypass: GLOBAL_AVERAGE_ONLY_BYPASS,

    trustWeighting: TRUST_WEIGHTING,
    promotion: PROMOTION,
    demotion: DEMOTION,
    calibrationExecution: CALIBRATION_EXECUTION,
    binaryBrierExecution: BINARY_BRIER_EXECUTION,

    unsupportedSegmentationDimensions: [...UNSUPPORTED_SEGMENTATION_DIMENSIONS],
    forbiddenSampleSufficiencyFields: [...FORBIDDEN_SAMPLE_SUFFICIENCY_FIELDS],
    forbiddenTrustPromotionFields: [...FORBIDDEN_TRUST_PROMOTION_FIELDS],
    forbiddenCalibrationMetricFields: [...FORBIDDEN_CALIBRATION_METRIC_FIELDS],

    hardFlags: { ...REQUIRED_HARD_FLAGS },
    sideEffects: { ...ZERO_SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECTS },
    limitations: [...SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS],
    upstreamReadReferenceOnly: { ...UPSTREAM_READ_REFERENCE_ONLY },
  });
}

export const SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR = buildPolicyDescriptor();

const DESCRIPTOR_TOP_LEVEL_KEYS = Object.freeze(
  Object.keys(SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR),
);
const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));
const SIDE_EFFECT_KEYS = Object.freeze(
  Object.keys(ZERO_SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECTS),
);

export function getSegmentedPerformancePolicyDescriptor() {
  return SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR;
}

/**
 * Strict descriptor validation — rejects caller authority overrides.
 * Does not freeze arbitrary caller data as canonical.
 */
export function validateSegmentedPerformancePolicyDescriptor(input) {
  assertPlainObject(
    input,
    'SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR_INVALID',
    'Descriptor must be a plain object',
  );
  assertNoForbiddenOrSecrets(
    input,
    'SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR_FORBIDDEN_FIELD',
  );
  assertSizeBound(
    input,
    MAX_SEGMENTED_PERFORMANCE_POLICY_BYTES,
    'SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR_SIZE_EXCEEDED',
  );

  const unknown = Object.keys(input).filter((k) => !DESCRIPTOR_TOP_LEVEL_KEYS.includes(k));
  if (unknown.length > 0) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR_UNKNOWN_FIELD',
      'Unknown descriptor field',
      { unknown },
    );
  }

  for (const key of DESCRIPTOR_TOP_LEVEL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR_MISSING_FIELD',
        `Missing required descriptor field: ${key}`,
        { field: key },
      );
    }
  }

  assertExactString(
    input.schemaVersion,
    SEGMENTED_PERFORMANCE_POLICY_SCHEMA_VERSION,
    'SEGMENTED_PERFORMANCE_POLICY_SCHEMA_VERSION_MISMATCH',
    'schemaVersion mismatch',
  );
  assertExactString(
    input.contractVersion,
    SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
    'SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION_MISMATCH',
    'contractVersion mismatch',
  );
  assertExactString(
    input.policyVersion,
    SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
    'SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION_MISMATCH',
    'policyVersion mismatch',
  );
  assertExactString(
    input.implementationVersion,
    SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
    'SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION_MISMATCH',
    'implementationVersion mismatch',
  );
  assertExactString(
    input.artifactType,
    SEGMENTED_PERFORMANCE_POLICY_ARTIFACT_TYPE,
    'SEGMENTED_PERFORMANCE_POLICY_ARTIFACT_TYPE_MISMATCH',
    'artifactType mismatch',
  );
  assertExactString(
    input.policyType,
    SEGMENTED_PERFORMANCE_POLICY_TYPE,
    'SEGMENTED_PERFORMANCE_POLICY_TYPE_MISMATCH',
    'policyType mismatch',
  );
  assertExactString(
    input.authorityClass,
    SEGMENTED_PERFORMANCE_POLICY_AUTHORITY_CLASS,
    'SEGMENTED_PERFORMANCE_POLICY_AUTHORITY_CLASS_MISMATCH',
    'authorityClass mismatch',
  );
  assertExactString(
    input.sliceId,
    SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
    'SEGMENTED_PERFORMANCE_POLICY_SLICE_ID_MISMATCH',
    'sliceId mismatch',
  );
  assertExactString(
    input.officialName,
    SEGMENTED_PERFORMANCE_POLICY_OFFICIAL_NAME,
    'SEGMENTED_PERFORMANCE_POLICY_OFFICIAL_NAME_MISMATCH',
    'officialName mismatch',
  );
  assertExactString(
    input.riskTier,
    SEGMENTED_PERFORMANCE_POLICY_RISK_TIER,
    'SEGMENTED_PERFORMANCE_POLICY_RISK_TIER_MISMATCH',
    'riskTier mismatch',
  );
  assertExactString(
    input.ownershipRole,
    SEGMENTED_PERFORMANCE_POLICY_OWNERSHIP_ROLE,
    'SEGMENTED_PERFORMANCE_POLICY_OWNERSHIP_ROLE_MISMATCH',
    'ownershipRole mismatch',
  );

  assertExactBoolean(
    input.isSourceOfTruth,
    false,
    'SEGMENTED_PERFORMANCE_POLICY_IS_SOURCE_OF_TRUTH_MISMATCH',
    'isSourceOfTruth must be false',
  );
  assertExactBoolean(
    input.callerSelfRegistration,
    false,
    'SEGMENTED_PERFORMANCE_POLICY_SELF_REGISTRATION_FORBIDDEN',
    'callerSelfRegistration must be false',
  );
  assertExactBoolean(
    input.regimeIdentityCanonical,
    false,
    'SEGMENTED_PERFORMANCE_POLICY_REGIME_IDENTITY_MISMATCH',
    'regimeIdentityCanonical must be false',
  );
  assertExactBoolean(
    input.regimeClassifier,
    false,
    'SEGMENTED_PERFORMANCE_POLICY_REGIME_CLASSIFIER_MISMATCH',
    'regimeClassifier must be false',
  );
  assertExactBoolean(
    input.regimeCreation,
    false,
    'SEGMENTED_PERFORMANCE_POLICY_REGIME_CREATION_MISMATCH',
    'regimeCreation must be false',
  );
  assertExactBoolean(
    input.analysisHorizonSegmentation,
    false,
    'SEGMENTED_PERFORMANCE_POLICY_ANALYSIS_HORIZON_MISMATCH',
    'analysisHorizonSegmentation must be false',
  );
  assertExactBoolean(
    input.calibrationExecution,
    false,
    'SEGMENTED_PERFORMANCE_POLICY_CALIBRATION_EXECUTION_MISMATCH',
    'calibrationExecution must be false',
  );
  assertExactBoolean(
    input.binaryBrierExecution,
    false,
    'SEGMENTED_PERFORMANCE_POLICY_BINARY_BRIER_EXECUTION_MISMATCH',
    'binaryBrierExecution must be false',
  );

  assertExactString(
    input.sampleSufficiencyOwner,
    SAMPLE_SUFFICIENCY_OWNER,
    'SEGMENTED_PERFORMANCE_POLICY_SAMPLE_SUFFICIENCY_OWNER_MISMATCH',
    'sampleSufficiencyOwner mismatch',
  );
  assertExactString(
    input.sampleSufficiencyPolicy,
    SAMPLE_SUFFICIENCY_POLICY,
    'SEGMENTED_PERFORMANCE_POLICY_SAMPLE_SUFFICIENCY_POLICY_MISMATCH',
    'sampleSufficiencyPolicy mismatch',
  );
  assertExactString(
    input.globalAverageOnly,
    GLOBAL_AVERAGE_ONLY,
    'SEGMENTED_PERFORMANCE_POLICY_GLOBAL_AVERAGE_ONLY_MISMATCH',
    'globalAverageOnly mismatch',
  );
  assertExactString(
    input.globalAverageOnlyBypass,
    GLOBAL_AVERAGE_ONLY_BYPASS,
    'SEGMENTED_PERFORMANCE_POLICY_GLOBAL_AVERAGE_BYPASS_MISMATCH',
    'globalAverageOnlyBypass mismatch',
  );
  assertExactString(
    input.trustWeighting,
    TRUST_WEIGHTING,
    'SEGMENTED_PERFORMANCE_POLICY_TRUST_WEIGHTING_MISMATCH',
    'trustWeighting mismatch',
  );
  assertExactString(
    input.promotion,
    PROMOTION,
    'SEGMENTED_PERFORMANCE_POLICY_PROMOTION_MISMATCH',
    'promotion mismatch',
  );
  assertExactString(
    input.demotion,
    DEMOTION,
    'SEGMENTED_PERFORMANCE_POLICY_DEMOTION_MISMATCH',
    'demotion mismatch',
  );

  if (!Array.isArray(input.authorizedCanonicalSegmentDimensions)) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_DIMENSIONS_INVALID',
      'authorizedCanonicalSegmentDimensions must be an array',
    );
  }
  if (
    stableJson(input.authorizedCanonicalSegmentDimensions)
    !== stableJson(AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS)
  ) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_DIMENSIONS_MISMATCH',
      'authorizedCanonicalSegmentDimensions mismatch',
    );
  }
  if (
    stableJson(input.canonicalSegmentDimensionOrder)
    !== stableJson(CANONICAL_SEGMENT_DIMENSION_ORDER)
  ) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_DIMENSION_ORDER_MISMATCH',
      'canonicalSegmentDimensionOrder mismatch',
    );
  }

  assertPlainObject(
    input.hardFlags,
    'SEGMENTED_PERFORMANCE_POLICY_HARD_FLAGS_INVALID',
    'hardFlags must be a plain object',
  );
  assertAllowlist(
    input.hardFlags,
    HARD_FLAG_KEYS,
    'SEGMENTED_PERFORMANCE_POLICY_HARD_FLAGS_UNKNOWN_FIELD',
    'hardFlags',
  );
  for (const key of HARD_FLAG_KEYS) {
    if (input.hardFlags[key] !== false) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_HARD_FLAG_ESCALATION',
        `hardFlags.${key} must be false`,
        { field: key, actual: input.hardFlags[key] },
      );
    }
  }

  assertPlainObject(
    input.sideEffects,
    'SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECTS_INVALID',
    'sideEffects must be a plain object',
  );
  assertAllowlist(
    input.sideEffects,
    SIDE_EFFECT_KEYS,
    'SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECTS_UNKNOWN_FIELD',
    'sideEffects',
  );
  for (const key of SIDE_EFFECT_KEYS) {
    if (input.sideEffects[key] !== 0) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECT_NONZERO',
        `sideEffects.${key} must be 0`,
        { field: key, actual: input.sideEffects[key] },
      );
    }
  }

  if (!Array.isArray(input.limitations) || input.limitations.length === 0) {
    fail(
      'SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS_INVALID',
      'limitations must be a non-empty array',
    );
  }
  for (const baseline of SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS) {
    if (!input.limitations.includes(baseline)) {
      fail(
        'SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS_MISSING',
        `canonical baseline limitation missing: ${baseline}`,
      );
    }
  }

  // Return canonical descriptor — never caller object.
  return getSegmentedPerformancePolicyDescriptor();
}

// ─── Public API surface ──────────────────────────────────────────────────────
// Intentionally ABSENT:
//   computeMatchRate, computeAccuracy, computeBrier, computeEce,
//   registerSegmentationDimension, registerRegimeClassifier,
//   setSampleSufficiencyThreshold, promote, demote, mutateTrust

export default Object.freeze({
  SEGMENTED_PERFORMANCE_POLICY_SCHEMA_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_ARTIFACT_TYPE,
  SEGMENTED_PERFORMANCE_POLICY_TYPE,
  SEGMENTED_PERFORMANCE_POLICY_AUTHORITY_CLASS,
  SEGMENTED_PERFORMANCE_POLICY_RISK_TIER,
  SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
  SEGMENTED_PERFORMANCE_POLICY_OFFICIAL_NAME,
  SEGMENTED_PERFORMANCE_POLICY_OWNERSHIP_ROLE,
  SEGMENTED_PERFORMANCE_POLICY_IS_SOURCE_OF_TRUTH,
  SEGMENTED_PERFORMANCE_POLICY_WRITER,
  SEGMENTED_PERFORMANCE_POLICY_METHOD_KEY,
  SEGMENTED_PERFORMANCE_POLICY_STAGE,
  AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  CANONICAL_SEGMENT_DIMENSION_ORDER,
  CANONICAL_VERSION_BINDING_FIELDS,
  COHORT_DESCRIPTOR_ALLOWLIST,
  SEGMENT_IDENTITY_ALLOWLIST,
  COMPUTE_CANONICAL_SEGMENT_ID_ALLOWLIST,
  CLAIM_PUBLIC_ALLOWLIST,
  CLAIM_TOP_LEVEL_SEGMENT_SOURCE_FIELDS,
  REGIME_IDENTITY_CANONICAL,
  REGIME_CLASSIFIER,
  REGIME_CREATION,
  ANALYSIS_HORIZON_SEGMENTATION,
  SAMPLE_SUFFICIENCY_OWNER,
  SAMPLE_SUFFICIENCY_POLICY,
  GLOBAL_AVERAGE_ONLY,
  GLOBAL_AVERAGE_ONLY_BYPASS,
  TRUST_WEIGHTING,
  PROMOTION,
  DEMOTION,
  CALIBRATION_EXECUTION,
  BINARY_BRIER_EXECUTION,
  SEGMENT_SCOPE,
  SEGMENT_IDENTITY_STATUS,
  UNSUPPORTED_SEGMENTATION_DIMENSIONS,
  FORBIDDEN_SAMPLE_SUFFICIENCY_FIELDS,
  FORBIDDEN_TRUST_PROMOTION_FIELDS,
  FORBIDDEN_CALIBRATION_METRIC_FIELDS,
  REQUIRED_HARD_FLAGS,
  ZERO_SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECTS,
  SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS,
  SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR,
  SegmentedPerformancePolicyContractError,
  getSegmentedPerformancePolicyDescriptor,
  validateSegmentedPerformancePolicyDescriptor,
  computeCanonicalSegmentId,
  validateCanonicalSegmentIdentity,
  validateCohortDescriptor,
  assertHomogeneousSegmentCohort,
  assertNotGlobalAverageOnlyBypass,
});
