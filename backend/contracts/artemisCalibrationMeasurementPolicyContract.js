/**
 * Artemis Core Stage 10 — S10-CALIBRATION-MEASUREMENT-POLICY-CONTRACT
 * ARTEMIS_CALIBRATION_MEASUREMENT_POLICY_CONTRACT_BOUNDARY
 *
 * Deterministic, non-executing, library-only Calibration Measurement Policy
 * semantic / validation boundary. Canonically defines v1 target-event identity,
 * eligibility, provenance requirements, scalar top-label probability semantics,
 * MATCH/MISMATCH correctness mapping, UNIT_INTERVAL normalization, and
 * BINARY_BRIER_SCORE identity/formula metadata.
 *
 * This is NOT a calibration engine. It does NOT compute Brier scores, ECE,
 * aggregates, thresholds, trust/weights, or promotion/demotion.
 *
 * Authority: CALIBRATION · Tier 3 · isSourceOfTruth = false
 *
 * Governed v1 target:
 *   TOP_LABEL_DIRECTIONAL_CORRECTNESS =
 *     P(selected canonical Decision direction matches future canonical
 *       observed direction at compatible evaluation horizon)
 *
 * Confidence kind ∈ {MODEL_PROBABILITY, CALIBRATED} is necessary but NOT
 * sufficient. Explicit provenance/method semantics registered by this policy
 * owner are required. AUTHORIZED_MEASUREMENT_METHODS is empty for v1.
 */

import {
  CONFIDENCE_KIND,
  CONFIDENCE_SCALE,
  utf8ByteLength,
  collectForbiddenSecretKeys,
} from './artemisEvidenceContract.js';
import {
  CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
  CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
  CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
  PREDICTIVE_CONFIDENCE_KINDS as UPSTREAM_PREDICTIVE_CONFIDENCE_KINDS,
} from './artemisConfidenceCalibrationContract.js';
import { EVALUATION_STATUS } from './artemisObservedOutcomeEvaluationContract.js';

// ---------------------------------------------------------------------------
// Version / identity
// ---------------------------------------------------------------------------

export const CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION = '1.0.0';
export const CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION =
  'artemis-calibration-measurement-policy-1.0.0';
export const CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION =
  'stage10-calibration-measurement-policy-1.0.0';
export const CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION = '1.0.0';

export const CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE =
  'ARTEMIS_CALIBRATION_MEASUREMENT_POLICY';
export const CALIBRATION_MEASUREMENT_POLICY_POLICY_TYPE =
  'CALIBRATION_MEASUREMENT_POLICY';
export const CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS = 'CALIBRATION';
export const CALIBRATION_MEASUREMENT_POLICY_SLICE_ID =
  'S10-CALIBRATION-MEASUREMENT-POLICY-CONTRACT';
export const CALIBRATION_MEASUREMENT_POLICY_OWNERSHIP_ROLE =
  'VALIDATION_BOUNDARY';
export const CALIBRATION_MEASUREMENT_POLICY_IS_SOURCE_OF_TRUTH = false;
export const CALIBRATION_MEASUREMENT_POLICY_WRITER =
  'artemisCalibrationMeasurementPolicyContract';
export const CALIBRATION_MEASUREMENT_POLICY_STAGE =
  'ARTEMIS_CORE_STAGE_10_CALIBRATION_MEASUREMENT_POLICY_CONTRACT_BOUNDARY';
export const CALIBRATION_MEASUREMENT_POLICY_METHOD_KEY =
  'artemis.calibration.measurement.policy.v1';

export const MAX_POLICY_DESCRIPTOR_UTF8_BYTES = 16 * 1024;
export const MAX_ELIGIBILITY_ASSESSMENT_UTF8_BYTES = 8 * 1024;
export const MAX_STRING = 256;
export const MAX_NOTE_CHARS = 2048;
export const MAX_REASON_CODES = 32;

// ---------------------------------------------------------------------------
// Governed v1 target event
// ---------------------------------------------------------------------------

export const CALIBRATION_TARGET_EVENT = Object.freeze({
  TOP_LABEL_DIRECTIONAL_CORRECTNESS: 'TOP_LABEL_DIRECTIONAL_CORRECTNESS',
});

export const CALIBRATION_TARGET_EVENT_V1 =
  CALIBRATION_TARGET_EVENT.TOP_LABEL_DIRECTIONAL_CORRECTNESS;

export const CALIBRATION_TARGET_EVENT_V1_SEMANTICS = Object.freeze({
  targetEvent: CALIBRATION_TARGET_EVENT_V1,
  meaning:
    'P(selected_canonical_Decision_direction_matches_future_canonical_observed_direction_at_compatible_evaluation_horizon)',
  prospective: true,
  policyScoped: true,
  inferredFromConfidenceKind: false,
  explicitProvenanceRequired: true,
  fullClassProbabilityVectorRequired: false,
  synthesizesUnselectedClassDistribution: false,
});

export const V1_CALIBRATION_SCOPE = 'TOP_LABEL_DIRECTIONAL_CORRECTNESS';
export const FULL_CLASS_PROBABILITY_VECTOR = false;
export const MULTICLASS_CALIBRATION = 'DEFERRED';

// ---------------------------------------------------------------------------
// Confidence kinds — necessary, not sufficient
// ---------------------------------------------------------------------------

export const ALLOWED_PREDICTIVE_KINDS = Object.freeze({
  MODEL_PROBABILITY: CONFIDENCE_KIND.MODEL_PROBABILITY,
  CALIBRATED: CONFIDENCE_KIND.CALIBRATED,
});
export const ALLOWED_PREDICTIVE_KIND_SET = Object.freeze(
  new Set(Object.values(ALLOWED_PREDICTIVE_KINDS)),
);

/** Non-eligible kinds (never measurement probabilities under this policy). */
export const NON_MEASUREMENT_PROBABILITY_KINDS = Object.freeze({
  MEASURED: CONFIDENCE_KIND.MEASURED,
  HEURISTIC: CONFIDENCE_KIND.HEURISTIC,
  RULE_SCORE: CONFIDENCE_KIND.RULE_SCORE,
  DERIVED: CONFIDENCE_KIND.DERIVED,
  LEGACY: CONFIDENCE_KIND.LEGACY,
  UNAVAILABLE: CONFIDENCE_KIND.UNAVAILABLE,
});
export const NON_MEASUREMENT_PROBABILITY_KIND_SET = Object.freeze(
  new Set(Object.values(NON_MEASUREMENT_PROBABILITY_KINDS)),
);

export const MEASURED_KIND_IS_CALIBRATION_RESULT = false;
export const CALIBRATED_KIND_TITANGOLD_VERIFIED = false;
export const CALIBRATED_KIND_SELF_ATTESTATION_ALLOWED = false;
export const CONFIDENCE_TARGET_SEMANTICS =
  'EXPLICIT_PROVENANCE_REQUIRED / NOT_INFERRED_FROM_KIND';

export const CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS =
  'NONE / NOT PROVEN';

// ---------------------------------------------------------------------------
// Method semantic registry — fail closed / empty for v1
// ---------------------------------------------------------------------------

/**
 * Canonical authorized measurement methods. Empty for v1.
 * Only this policy owner may register methods via a later versioned governance
 * change. Caller-supplied methodKey+targetEvent cannot self-register.
 */
export const AUTHORIZED_MEASUREMENT_METHODS = Object.freeze([]);
export const AUTHORIZED_MEASUREMENT_METHOD_SET = Object.freeze(new Set());

export const METHOD_REGISTRATION_OWNER =
  'artemisCalibrationMeasurementPolicyContract';
export const CALLER_SELF_REGISTRATION = 'FORBIDDEN';

// ---------------------------------------------------------------------------
// Binary correctness mapping (policy-scoped only)
// ---------------------------------------------------------------------------

export const BINARY_CORRECTNESS_MAPPING = Object.freeze({
  MATCH: 1,
  MISMATCH: 0,
});

export const BINARY_CORRECTNESS_SCOPE =
  CALIBRATION_TARGET_EVENT_V1;
export const BINARY_CORRECTNESS_POLICY_SCOPED_ONLY = true;

export const USABLE_BINARY_EVALUATION_STATUS = Object.freeze({
  MATCH: EVALUATION_STATUS.MATCH,
  MISMATCH: EVALUATION_STATUS.MISMATCH,
});
export const USABLE_BINARY_EVALUATION_STATUS_SET = Object.freeze(
  new Set(Object.values(USABLE_BINARY_EVALUATION_STATUS)),
);

// ---------------------------------------------------------------------------
// Measurement domain / scale normalization
// ---------------------------------------------------------------------------

export const MEASUREMENT_DOMAIN = 'UNIT_INTERVAL';
export const MEASUREMENT_DOMAIN_BOUNDS = Object.freeze({ min: 0, max: 1 });

export const SCALE_NORMALIZATION_POLICY = Object.freeze({
  measurementDomain: MEASUREMENT_DOMAIN,
  unit_interval: 'IDENTITY',
  percent_100: 'DIVIDE_BY_100',
  unknown: 'REJECT',
  clamp: false,
  roundingRepair: false,
  guessedScale: false,
  minMaxNormalization: false,
  empiricalNormalization: false,
  coercion: false,
  sourceRawValueUnmodified: true,
  sourceScaleMustBeExplicit: true,
});

export const UNIT_INTERVAL_NORMALIZATION = 'IDENTITY';
export const PERCENT_100_NORMALIZATION = 'DIVIDE_BY_100';
export const UNKNOWN_SCALE = 'REJECT';

export const CONFIDENCE_SCALE_SET = Object.freeze(
  new Set(Object.values(CONFIDENCE_SCALE)),
);

// ---------------------------------------------------------------------------
// BINARY_BRIER_SCORE semantics (identity / formula only — NO execution)
// ---------------------------------------------------------------------------

export const FIRST_ALLOWED_PROPER_SCORE = 'BINARY_BRIER_SCORE';
export const BINARY_BRIER_SCORE = 'BINARY_BRIER_SCORE';
export const BINARY_BRIER_FORMULA_SEMANTICS = '(p-y)^2';
export const BINARY_BRIER_EXECUTION = false;
export const BINARY_BRIER_STANDALONE_CALIBRATION_VERDICT = false;
export const BINARY_BRIER_ROLE =
  'PROPER_PROBABILITY_SCORE / INPUT_TO_LATER_CALIBRATION_EVALUATION';

export const BINARY_BRIER_METRIC_SEMANTICS = Object.freeze({
  metricIdentity: BINARY_BRIER_SCORE,
  formulaIdentity: BINARY_BRIER_FORMULA_SEMANTICS,
  formulaDescription:
    'Per-observation proper score (p - y)^2 with p in [0,1] and y in {0,1}',
  inputDomain: MEASUREMENT_DOMAIN,
  probabilityBounds: MEASUREMENT_DOMAIN_BOUNDS,
  targetMapping: BINARY_CORRECTNESS_MAPPING,
  targetEvent: CALIBRATION_TARGET_EVENT_V1,
  executionAuthorized: false,
  standaloneCalibrationVerdict: false,
  role: BINARY_BRIER_ROLE,
  limitations: Object.freeze([
    'semantics_only',
    'no_numeric_score_computation',
    'no_aggregate',
    'no_threshold',
    'no_grade',
    'no_trust_interpretation',
    'no_promotion_interpretation',
  ]),
});

// ---------------------------------------------------------------------------
// Deferred / unsupported metrics
// ---------------------------------------------------------------------------

export const DEFERRED_METRIC_STATUS = Object.freeze({
  TOP_LABEL_ECE: 'DEFERRED_PENDING_AGGREGATION_AND_BINNING_POLICY',
  EXPECTED_CALIBRATION_ERROR:
    'DEFERRED_PENDING_AGGREGATION_AND_BINNING_POLICY',
  RELIABILITY_CURVE: 'DEFERRED_PENDING_AGGREGATION_AND_BINNING_POLICY',
  CONFIDENCE_BUCKETS: 'DEFERRED_PENDING_AGGREGATION_AND_BINNING_POLICY',
  CLASSWISE_CALIBRATION_ERROR: 'DEFERRED',
  MULTICLASS_BRIER: 'DEFERRED',
  LOG_LOSS: 'DEFERRED',
  CROSS_ENTROPY: 'DEFERRED',
  PLATT_SCALING: 'DEFERRED',
  ISOTONIC_REGRESSION: 'DEFERRED',
  TEMPERATURE_SCALING: 'DEFERRED',
});

export const ECE = DEFERRED_METRIC_STATUS.TOP_LABEL_ECE;
export const RELIABILITY_CURVE = DEFERRED_METRIC_STATUS.RELIABILITY_CURVE;
export const BINNING_POLICY = 'UNDEFINED / DEFERRED';
export const SAMPLE_SUFFICIENCY_POLICY = 'UNDEFINED / DEFERRED';
export const SEGMENTED_PERFORMANCE_POLICY =
  'DEFERRED / REQUIRED_BEFORE_STAGE10_COMPLETION';
export const GLOBAL_AVERAGE_ONLY =
  'NOT SUFFICIENT FOR STAGE10_COMPLETION';

export const DEFERRED_CAPABILITIES = Object.freeze({
  ...DEFERRED_METRIC_STATUS,
  BINNING_POLICY,
  SAMPLE_SUFFICIENCY_POLICY,
  SEGMENTED_PERFORMANCE_POLICY,
  MULTICLASS_CALIBRATION,
  FULL_CLASS_PROBABILITY_VECTOR,
  AGGREGATE_MEASUREMENT: false,
  CALIBRATION_EXECUTION: false,
  TRUST_WEIGHT_MUTATION: false,
  PROMOTION_EXECUTION: false,
  DEMOTION_EXECUTION: false,
});

// ---------------------------------------------------------------------------
// Side-effect ledger / hard flags
// ---------------------------------------------------------------------------

export const ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  networkCallCount: 0,
  networkRequestCount: 0,
  providerCallCount: 0,
  providerRequestCount: 0,
  llmCallCount: 0,
  workerMutationCount: 0,
  schedulerMutationCount: 0,
  runtimeMutationCount: 0,
  calibrationExecutionCount: 0,
  aggregateMeasurementCount: 0,
  trustMutationCount: 0,
  trustWeightMutationCount: 0,
  weightMutationCount: 0,
  promotionCount: 0,
  promotionExecutionCount: 0,
  demotionCount: 0,
  demotionExecutionCount: 0,
  orderCount: 0,
  orderOperationCount: 0,
  walletMutationCount: 0,
  financialExecutionCount: 0,
  redis: 0,
  db: 0,
  network: 0,
  provider: 0,
  llm: 0,
  orders: 0,
  financial: 0,
  runtime: 0,
  calibrationExecution: 0,
  aggregateMeasurement: 0,
  trustWeightMutation: 0,
  promotionExecution: 0,
  demotionExecution: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  isSourceOfTruth: false,
  calibrationExecution: false,
  aggregateMeasurement: false,
  trustMutation: false,
  weightMutation: false,
  promotionExecution: false,
  demotionExecution: false,
  runtimeActivation: false,
  persistenceActivation: false,
  networkActivation: false,
  providerActivation: false,
  llmActivation: false,
  workerActivation: false,
  schedulerActivation: false,
  financialExecution: false,
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

export const CALIBRATION_MEASUREMENT_POLICY_LIMITATIONS = Object.freeze([
  'stage10_calibration_measurement_policy_contract_boundary_only',
  'library_only',
  'deterministic_non_executing',
  'validation_boundary_not_sot',
  'is_source_of_truth_false',
  'no_calibration_execution',
  'no_brier_numeric_computation',
  'no_aggregate_measurement',
  'no_ece',
  'no_reliability_curve',
  'no_binning_policy',
  'no_sample_sufficiency_policy',
  'no_threshold',
  'no_trust_weight_mutation',
  'no_promotion_execution',
  'no_demotion_execution',
  'authorized_measurement_methods_empty_v1',
  'current_production_calibration_eligible_producers_none_not_proven',
  'kind_necessary_not_sufficient',
  'explicit_provenance_required',
  'calibrated_kind_not_titangold_verified',
  'measured_kind_is_not_calibration_result',
  'no_full_class_probability_vector',
  'no_1_minus_confidence_distribution',
  'binary_correctness_policy_scoped_only',
  'segmented_performance_deferred',
  'does_not_write_db_or_redis',
  'does_not_call_llm_or_provider',
  'does_not_activate_worker_or_scheduler',
  'does_not_authorize_execution',
]);

// ---------------------------------------------------------------------------
// Forbidden contamination keys
// ---------------------------------------------------------------------------

const FORBIDDEN_RESULT_KEYS = Object.freeze([
  'brierScore',
  'brier',
  'score',
  'loss',
  'calibrationError',
  'calibrationScore',
  'ece',
  'expectedCalibrationError',
  'reliability',
  'reliabilityScore',
  'reliabilityCurve',
  'bucket',
  'bucketCounts',
  'confidenceBucket',
  'binCount',
  'sampleCount',
  'meanScore',
  'aggregateScore',
  'calibrationGrade',
  'calibrationPass',
  'trustScore',
  'weight',
  'agentWeight',
  'weightDelta',
  'promotionStatus',
  'demotionStatus',
  'promotion',
  'demotion',
  'promotionScore',
  'demotionScore',
  'promotionThreshold',
  'demotionThreshold',
  'threshold',
  'correctedConfidence',
  'adjustedConfidence',
  'calibratedConfidence',
  'platt',
  'isotonic',
  'temperatureScaling',
]);

const FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  'apiKey',
  'apiSecret',
  'token',
  'secret',
  'password',
  'credential',
  'credentials',
  'walletSecret',
  'exchangeCredential',
  'authorization',
  'rawProviderPayload',
  'providerPayload',
  'rawMarketPayload',
  'ohlcv',
  'candles',
  'ticker',
  'orderBook',
  'depth',
  'order',
  'orders',
  'balance',
  'wallet',
  'transfer',
  'withdrawal',
  'pnl',
  'realizedPnl',
  'simulatedPnl',
]);

const FORBIDDEN_KEYS = Object.freeze([
  ...FORBIDDEN_RESULT_KEYS,
  ...FORBIDDEN_PAYLOAD_KEYS,
]);

const ELIGIBILITY_INPUT_ALLOWLIST = Object.freeze([
  'confidenceKind',
  'kind',
  'value',
  'scale',
  'methodKey',
  'targetEvent',
  'targetSemantics',
  'provenance',
  'confidence',
  'predictiveClaimRef',
  'calibrationObservation',
  'calibrationObservationRef',
  'note',
]);

const PROVENANCE_ALLOWLIST = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'policyVersion',
  'implementationVersion',
  'note',
  'targetEvent',
  'targetSemantics',
]);

const CONFIDENCE_ALLOWLIST = Object.freeze([
  'kind',
  'value',
  'scale',
  'availability',
  'calibrationState',
  'provenance',
  'method',
  'methodKey',
]);

const PREDICTIVE_CLAIM_REF_ALLOWLIST = Object.freeze([
  'decisionId',
  'confidence',
  'contractVersion',
  'schemaVersion',
  'artifactType',
]);

const CALIBRATION_OBSERVATION_REF_ALLOWLIST = Object.freeze([
  'calibrationObservationId',
  'artifactType',
  'contractVersion',
  'schemaVersion',
  'predictiveClaimRef',
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function fail(code, message, extra = {}) {
  const err = new Error(message || code);
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

function collectForbiddenKeysDeep(value, found = new Set()) {
  if (value == null || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenKeysDeep(item, found);
    return found;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      const leaf = value[key];
      // Numeric zero side-effect counters with forbidden-looking names are allowed.
      if (
        typeof leaf === 'number'
        && Number.isFinite(leaf)
        && leaf === 0
        && (
          key === 'orders'
          || key === 'orderCount'
          || key === 'walletMutationCount'
          || key === 'financialExecutionCount'
          || key === 'score'
          || key === 'sampleCount'
          || key === 'weight'
        )
      ) {
        // allow zero counter leaf
      } else {
        found.add(key);
      }
    }
    collectForbiddenKeysDeep(value[key], found);
  }
  return found;
}

function assertNoForbiddenOrSecrets(input) {
  const forbidden = collectForbiddenKeysDeep(input);
  if (forbidden.size) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_FORBIDDEN_FIELD',
      `Forbidden field(s): ${[...forbidden].join(',')}`,
      { forbiddenFields: [...forbidden] },
    );
  }
  const secrets = collectForbiddenSecretKeys(input);
  if (secrets && secrets.length) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_SECRET_FIELD',
      `Secret-bearing field(s): ${secrets.join(',')}`,
      { secretFields: secrets },
    );
  }
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function resolveKind(input) {
  if (input.confidenceKind != null) return input.confidenceKind;
  if (input.kind != null) return input.kind;
  if (input.confidence && input.confidence.kind != null) {
    return input.confidence.kind;
  }
  if (
    input.predictiveClaimRef
    && input.predictiveClaimRef.confidence
    && input.predictiveClaimRef.confidence.kind != null
  ) {
    return input.predictiveClaimRef.confidence.kind;
  }
  return null;
}

function resolveValue(input) {
  if (input.value != null) return input.value;
  if (input.confidence && input.confidence.value != null) {
    return input.confidence.value;
  }
  if (
    input.predictiveClaimRef
    && input.predictiveClaimRef.confidence
    && input.predictiveClaimRef.confidence.value != null
  ) {
    return input.predictiveClaimRef.confidence.value;
  }
  return undefined;
}

function resolveScale(input) {
  if (input.scale != null) return input.scale;
  if (input.confidence && input.confidence.scale != null) {
    return input.confidence.scale;
  }
  if (
    input.predictiveClaimRef
    && input.predictiveClaimRef.confidence
    && input.predictiveClaimRef.confidence.scale != null
  ) {
    return input.predictiveClaimRef.confidence.scale;
  }
  return null;
}

function resolveMethodKey(input) {
  if (input.methodKey != null) return input.methodKey;
  if (input.provenance && input.provenance.methodKey != null) {
    return input.provenance.methodKey;
  }
  if (
    input.confidence
    && input.confidence.provenance
    && input.confidence.provenance.methodKey != null
  ) {
    return input.confidence.provenance.methodKey;
  }
  if (input.confidence && input.confidence.methodKey != null) {
    return input.confidence.methodKey;
  }
  if (
    input.predictiveClaimRef
    && input.predictiveClaimRef.confidence
    && input.predictiveClaimRef.confidence.provenance
    && input.predictiveClaimRef.confidence.provenance.methodKey != null
  ) {
    return input.predictiveClaimRef.confidence.provenance.methodKey;
  }
  return null;
}

function resolveTargetEvent(input) {
  if (input.targetEvent != null) return input.targetEvent;
  if (input.provenance && input.provenance.targetEvent != null) {
    return input.provenance.targetEvent;
  }
  if (
    input.confidence
    && input.confidence.provenance
    && input.confidence.provenance.targetEvent != null
  ) {
    return input.confidence.provenance.targetEvent;
  }
  return null;
}

function resolveProvenance(input) {
  if (input.provenance != null) return input.provenance;
  if (input.confidence && input.confidence.provenance != null) {
    return input.confidence.provenance;
  }
  if (
    input.predictiveClaimRef
    && input.predictiveClaimRef.confidence
    && input.predictiveClaimRef.confidence.provenance != null
  ) {
    return input.predictiveClaimRef.confidence.provenance;
  }
  return null;
}

function isMethodAuthorized(methodKey) {
  return (
    typeof methodKey === 'string'
    && methodKey.length > 0
    && AUTHORIZED_MEASUREMENT_METHOD_SET.has(methodKey)
  );
}

function validateNestedConfidence(confidence, codePrefix) {
  assertPlainObject(confidence, `${codePrefix}_CONFIDENCE_INVALID`, 'confidence must be object');
  assertAllowlist(confidence, CONFIDENCE_ALLOWLIST, `${codePrefix}_CONFIDENCE`);
  if (confidence.provenance != null) {
    assertPlainObject(
      confidence.provenance,
      `${codePrefix}_PROVENANCE_INVALID`,
      'provenance must be object',
    );
    assertAllowlist(confidence.provenance, PROVENANCE_ALLOWLIST, `${codePrefix}_PROVENANCE`);
  }
}

function validateCalibrationObservationBinding(obs) {
  assertPlainObject(
    obs,
    'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_INVALID',
    'calibrationObservation must be object',
  );
  assertAllowlist(
    obs,
    CALIBRATION_OBSERVATION_REF_ALLOWLIST,
    'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION',
  );
  if (obs.artifactType != null
    && obs.artifactType !== CONFIDENCE_CALIBRATION_ARTIFACT_TYPE) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_ARTIFACT_TYPE_MISMATCH',
      'calibrationObservation.artifactType must match Confidence Calibration Contract',
    );
  }
  if (obs.contractVersion != null
    && obs.contractVersion !== CONFIDENCE_CALIBRATION_CONTRACT_VERSION) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_CONTRACT_VERSION_MISMATCH',
      'calibrationObservation.contractVersion must match Confidence Calibration Contract',
    );
  }
  if (obs.schemaVersion != null
    && obs.schemaVersion !== CONFIDENCE_CALIBRATION_SCHEMA_VERSION) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_SCHEMA_VERSION_MISMATCH',
      'calibrationObservation.schemaVersion must match Confidence Calibration Contract',
    );
  }
  if (obs.predictiveClaimRef != null) {
    assertPlainObject(
      obs.predictiveClaimRef,
      'CALIBRATION_MEASUREMENT_POLICY_PREDICTIVE_REF_INVALID',
      'predictiveClaimRef must be object',
    );
    assertAllowlist(
      obs.predictiveClaimRef,
      PREDICTIVE_CLAIM_REF_ALLOWLIST,
      'CALIBRATION_MEASUREMENT_POLICY_PREDICTIVE_REF',
    );
    if (obs.predictiveClaimRef.confidence != null) {
      validateNestedConfidence(
        obs.predictiveClaimRef.confidence,
        'CALIBRATION_MEASUREMENT_POLICY_PREDICTIVE_REF',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Canonical policy descriptor
// ---------------------------------------------------------------------------

function buildPolicyDescriptor() {
  return freezeDeep({
    schemaVersion: CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION,
    contractVersion: CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION,
    policyVersion: CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION,
    artifactType: CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE,
    policyType: CALIBRATION_MEASUREMENT_POLICY_POLICY_TYPE,
    authorityClass: CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS,
    sliceId: CALIBRATION_MEASUREMENT_POLICY_SLICE_ID,
    ownershipRole: CALIBRATION_MEASUREMENT_POLICY_OWNERSHIP_ROLE,
    isSourceOfTruth: CALIBRATION_MEASUREMENT_POLICY_IS_SOURCE_OF_TRUTH,
    writer: CALIBRATION_MEASUREMENT_POLICY_WRITER,
    stage: CALIBRATION_MEASUREMENT_POLICY_STAGE,
    methodKey: CALIBRATION_MEASUREMENT_POLICY_METHOD_KEY,
    implementationVersion: CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION,
    targetEvent: CALIBRATION_TARGET_EVENT_V1,
    targetEventSemantics: CALIBRATION_TARGET_EVENT_V1_SEMANTICS,
    measurementScope: V1_CALIBRATION_SCOPE,
    measurementDomain: MEASUREMENT_DOMAIN,
    measurementDomainBounds: MEASUREMENT_DOMAIN_BOUNDS,
    allowedPredictiveKinds: Object.values(ALLOWED_PREDICTIVE_KINDS),
    nonMeasurementProbabilityKinds: Object.values(NON_MEASUREMENT_PROBABILITY_KINDS),
    confidenceTargetSemantics: CONFIDENCE_TARGET_SEMANTICS,
    measuredKindIsCalibrationResult: MEASURED_KIND_IS_CALIBRATION_RESULT,
    calibratedKindTitangoldVerified: CALIBRATED_KIND_TITANGOLD_VERIFIED,
    calibratedKindSelfAttestationAllowed: CALIBRATED_KIND_SELF_ATTESTATION_ALLOWED,
    correctnessMapping: BINARY_CORRECTNESS_MAPPING,
    correctnessMappingScope: BINARY_CORRECTNESS_SCOPE,
    correctnessMappingPolicyScopedOnly: BINARY_CORRECTNESS_POLICY_SCOPED_ONLY,
    scaleNormalizationPolicy: SCALE_NORMALIZATION_POLICY,
    unitIntervalNormalization: UNIT_INTERVAL_NORMALIZATION,
    percent100Normalization: PERCENT_100_NORMALIZATION,
    unknownScale: UNKNOWN_SCALE,
    firstAllowedProperScore: FIRST_ALLOWED_PROPER_SCORE,
    metricSemantics: {
      BINARY_BRIER_SCORE: BINARY_BRIER_METRIC_SEMANTICS,
    },
    binaryBrierExecution: BINARY_BRIER_EXECUTION,
    binaryBrierStandaloneCalibrationVerdict:
      BINARY_BRIER_STANDALONE_CALIBRATION_VERDICT,
    authorizedMeasurementMethods: AUTHORIZED_MEASUREMENT_METHODS,
    methodRegistrationOwner: METHOD_REGISTRATION_OWNER,
    callerSelfRegistration: CALLER_SELF_REGISTRATION,
    currentProductionCalibrationEligibleProducers:
      CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS,
    deferredCapabilities: DEFERRED_CAPABILITIES,
    // Deferred statuses live under deferredCapabilities / exported constants.
    // Do NOT expose ambiguous result keys: ece, reliabilityCurve, score, …
    eceStatus: ECE,
    reliabilityCurveStatus: RELIABILITY_CURVE,
    multiclassCalibration: MULTICLASS_CALIBRATION,
    fullClassProbabilityVector: FULL_CLASS_PROBABILITY_VECTOR,
    binningPolicy: BINNING_POLICY,
    sampleSufficiencyPolicy: SAMPLE_SUFFICIENCY_POLICY,
    segmentedPerformancePolicy: SEGMENTED_PERFORMANCE_POLICY,
    globalAverageOnly: GLOBAL_AVERAGE_ONLY,
    limitations: CALIBRATION_MEASUREMENT_POLICY_LIMITATIONS,
    sideEffects: ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS,
    hardFlags: REQUIRED_HARD_FLAGS,
    upstreamReadReference: Object.freeze({
      confidenceCalibrationContractVersion: CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
      confidenceCalibrationArtifactType: CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
      upstreamPredictiveKinds: Object.freeze({
        MODEL_PROBABILITY: UPSTREAM_PREDICTIVE_CONFIDENCE_KINDS.MODEL_PROBABILITY,
        CALIBRATED: UPSTREAM_PREDICTIVE_CONFIDENCE_KINDS.CALIBRATED,
      }),
    }),
  });
}

/** Canonical immutable policy descriptor (built once). */
export const CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR = buildPolicyDescriptor();

/**
 * Returns the canonical deeply-immutable Calibration Measurement Policy descriptor.
 * Deterministic — no Date.now / random / wall-clock.
 */
export function getCalibrationMeasurementPolicyDescriptor() {
  return CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR;
}

export function validateCalibrationMeasurementPolicyDescriptor(descriptor = {}) {
  assertPlainObject(
    descriptor,
    'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_INVALID',
    'descriptor must be object',
  );
  assertNoForbiddenOrSecrets(descriptor);
  if (descriptor.schemaVersion !== CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION) {
    fail('CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION_MISMATCH', 'schemaVersion mismatch');
  }
  if (descriptor.contractVersion !== CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION) {
    fail('CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION_MISMATCH', 'contractVersion mismatch');
  }
  if (descriptor.policyVersion !== CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION) {
    fail('CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION_MISMATCH', 'policyVersion mismatch');
  }
  if (descriptor.targetEvent !== CALIBRATION_TARGET_EVENT_V1) {
    fail('CALIBRATION_MEASUREMENT_POLICY_TARGET_EVENT_MISMATCH', 'targetEvent mismatch');
  }
  if (descriptor.firstAllowedProperScore !== FIRST_ALLOWED_PROPER_SCORE) {
    fail('CALIBRATION_MEASUREMENT_POLICY_PROPER_SCORE_MISMATCH', 'proper score mismatch');
  }
  if (descriptor.binaryBrierExecution !== false) {
    fail('CALIBRATION_MEASUREMENT_POLICY_BRIER_EXECUTION_FORBIDDEN', 'Brier execution must be false');
  }
  if (!Array.isArray(descriptor.authorizedMeasurementMethods)
    || descriptor.authorizedMeasurementMethods.length !== 0) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_METHODS_NOT_EMPTY',
      'authorizedMeasurementMethods must be empty for v1',
    );
  }
  const bytes = utf8ByteLength(JSON.stringify(descriptor));
  if (bytes > MAX_POLICY_DESCRIPTOR_UTF8_BYTES) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_TOO_LARGE',
      'descriptor exceeds max size',
      { bytes, max: MAX_POLICY_DESCRIPTOR_UTF8_BYTES },
    );
  }
  return freezeDeep(descriptor);
}

// ---------------------------------------------------------------------------
// Scale normalization helper (pure; does not mutate source)
// ---------------------------------------------------------------------------

/**
 * Project a valid source probability into the canonical UNIT_INTERVAL domain.
 * Does NOT mutate the source artifact. Fail-closed on unknown/out-of-range.
 *
 * @param {number} rawValue
 * @param {string} scale — CONFIDENCE_SCALE.UNIT_INTERVAL | PERCENT_100
 * @returns {{ normalized: number, sourceScale: string, sourceRawValue: number, measurementDomain: string }}
 */
export function normalizeCalibrationProbability(rawValue, scale) {
  if (scale == null || scale === '' || scale === CONFIDENCE_SCALE.UNKNOWN) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_UNKNOWN_SCALE',
      'source scale must be explicit and known',
      { scale },
    );
  }
  if (!CONFIDENCE_SCALE_SET.has(scale) || scale === CONFIDENCE_SCALE.UNKNOWN) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_UNKNOWN_SCALE',
      'source scale rejected',
      { scale },
    );
  }
  if (!isFiniteNumber(rawValue)) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_VALUE_NOT_FINITE',
      'raw value must be a finite number',
      { rawValue },
    );
  }

  let normalized;
  if (scale === CONFIDENCE_SCALE.UNIT_INTERVAL) {
    if (rawValue < 0 || rawValue > 1) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_UNIT_INTERVAL_OUT_OF_RANGE',
        'unit_interval value must be in [0,1]',
        { rawValue },
      );
    }
    normalized = rawValue; // IDENTITY
  } else if (scale === CONFIDENCE_SCALE.PERCENT_100) {
    if (rawValue < 0 || rawValue > 100) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_PERCENT_100_OUT_OF_RANGE',
        'percent_100 value must be in [0,100]',
        { rawValue },
      );
    }
    normalized = rawValue / 100; // DIVIDE_BY_100
  } else {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_UNKNOWN_SCALE',
      'unsupported scale',
      { scale },
    );
  }

  if (!isFiniteNumber(normalized) || normalized < 0 || normalized > 1) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_NORMALIZED_OUT_OF_RANGE',
      'normalized probability must be finite in [0,1]',
      { normalized },
    );
  }

  return freezeDeep({
    normalized,
    sourceScale: scale,
    sourceRawValue: rawValue,
    measurementDomain: MEASUREMENT_DOMAIN,
    normalization:
      scale === CONFIDENCE_SCALE.PERCENT_100
        ? PERCENT_100_NORMALIZATION
        : UNIT_INTERVAL_NORMALIZATION,
  });
}

// ---------------------------------------------------------------------------
// Binary correctness mapping helper (pure)
// ---------------------------------------------------------------------------

/**
 * Map MATCH → 1, MISMATCH → 0 within TOP_LABEL_DIRECTIONAL_CORRECTNESS policy.
 * Fail-closed on other evaluation statuses / missing / arbitrary strings.
 * Does not manufacture observed truth.
 *
 * @param {string} evaluationStatus
 * @returns {{ y: 0|1, evaluationStatus: string, targetEvent: string }}
 */
export function mapBinaryCorrectnessTarget(evaluationStatus) {
  if (evaluationStatus == null || evaluationStatus === '') {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_MISSING',
      'evaluationStatus required',
    );
  }
  if (typeof evaluationStatus !== 'string') {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_INVALID',
      'evaluationStatus must be a string',
      { evaluationStatus },
    );
  }
  if (!USABLE_BINARY_EVALUATION_STATUS_SET.has(evaluationStatus)) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_REJECTED',
      'evaluationStatus not usable for binary calibration measurement',
      { evaluationStatus },
    );
  }
  const y = BINARY_CORRECTNESS_MAPPING[evaluationStatus];
  return freezeDeep({
    y,
    evaluationStatus,
    targetEvent: CALIBRATION_TARGET_EVENT_V1,
    policyScopedOnly: true,
  });
}

// ---------------------------------------------------------------------------
// Eligibility assessment — structurally predictive vs measurement eligible
// ---------------------------------------------------------------------------

/**
 * Assess whether an input confidence claim is structurally predictive and/or
 * measurement-eligible under the v1 Calibration Measurement Policy.
 *
 * MODEL_PROBABILITY / CALIBRATED + valid numeric + valid scale ⇒
 *   structurallyPredictive = true
 * Without a canonically registered methodKey in AUTHORIZED_MEASUREMENT_METHODS
 * (empty for v1) ⇒ measurementEligible = false.
 *
 * Ineligibility is NOT a zero score.
 *
 * @param {object} input
 * @returns {object} frozen eligibility assessment
 */
export function assessCalibrationMeasurementEligibility(input = {}) {
  assertPlainObject(
    input,
    'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_INPUT_INVALID',
    'eligibility input must be object',
  );
  assertAllowlist(
    input,
    ELIGIBILITY_INPUT_ALLOWLIST,
    'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY',
  );
  assertNoForbiddenOrSecrets(input);

  if (input.note != null) {
    assertString('note', input.note, 'CALIBRATION_MEASUREMENT_POLICY_NOTE_INVALID', {
      max: MAX_NOTE_CHARS,
      required: false,
    });
  }
  if (input.provenance != null) {
    assertPlainObject(
      input.provenance,
      'CALIBRATION_MEASUREMENT_POLICY_PROVENANCE_INVALID',
      'provenance must be object',
    );
    assertAllowlist(input.provenance, PROVENANCE_ALLOWLIST, 'CALIBRATION_MEASUREMENT_POLICY_PROVENANCE');
  }
  if (input.confidence != null) {
    validateNestedConfidence(input.confidence, 'CALIBRATION_MEASUREMENT_POLICY');
  }
  if (input.predictiveClaimRef != null) {
    assertPlainObject(
      input.predictiveClaimRef,
      'CALIBRATION_MEASUREMENT_POLICY_PREDICTIVE_REF_INVALID',
      'predictiveClaimRef must be object',
    );
    assertAllowlist(
      input.predictiveClaimRef,
      PREDICTIVE_CLAIM_REF_ALLOWLIST,
      'CALIBRATION_MEASUREMENT_POLICY_PREDICTIVE_REF',
    );
    if (input.predictiveClaimRef.confidence != null) {
      validateNestedConfidence(
        input.predictiveClaimRef.confidence,
        'CALIBRATION_MEASUREMENT_POLICY_PREDICTIVE_REF',
      );
    }
  }
  if (input.calibrationObservation != null) {
    validateCalibrationObservationBinding(input.calibrationObservation);
  }
  if (input.calibrationObservationRef != null) {
    validateCalibrationObservationBinding(input.calibrationObservationRef);
  }

  // Reject caller self-registration of arbitrary method+target as eligibility.
  if (
    input.targetSemantics != null
    && typeof input.targetSemantics === 'object'
    && !Array.isArray(input.targetSemantics)
  ) {
    // Caller-supplied targetSemantics cannot authorize a method.
    assertAllowlist(
      input.targetSemantics,
      Object.freeze(['targetEvent', 'description', 'note']),
      'CALIBRATION_MEASUREMENT_POLICY_TARGET_SEMANTICS',
    );
  }

  const reasonCodes = [];
  const kind = resolveKind(input);
  const value = resolveValue(input);
  const scale = resolveScale(input);
  const methodKey = resolveMethodKey(input);
  const targetEvent = resolveTargetEvent(input);
  const provenance = resolveProvenance(input);

  let structurallyPredictive = false;
  let measurementEligible = false;

  if (kind == null) {
    reasonCodes.push('CONFIDENCE_KIND_MISSING');
  } else if (NON_MEASUREMENT_PROBABILITY_KIND_SET.has(kind)) {
    reasonCodes.push('CONFIDENCE_KIND_NOT_MEASUREMENT_PROBABILITY');
    if (kind === CONFIDENCE_KIND.MEASURED) {
      reasonCodes.push('MEASURED_KIND_IS_NOT_CALIBRATION_RESULT');
    }
    if (kind === CONFIDENCE_KIND.HEURISTIC) {
      reasonCodes.push('HEURISTIC_NOT_PROBABILITY');
    }
  } else if (!ALLOWED_PREDICTIVE_KIND_SET.has(kind)) {
    reasonCodes.push('CONFIDENCE_KIND_NOT_ALLOWED_PREDICTIVE');
  } else {
    // Kind is necessary (MODEL_PROBABILITY | CALIBRATED).
    if (kind === CONFIDENCE_KIND.CALIBRATED) {
      reasonCodes.push('CALIBRATED_KIND_NOT_TITANGOLD_VERIFIED');
      // Informational — does not by itself make ineligible beyond method rules.
    }

    if (value === undefined || value === null) {
      reasonCodes.push('CONFIDENCE_VALUE_MISSING');
    } else if (!isFiniteNumber(value)) {
      reasonCodes.push('CONFIDENCE_VALUE_NOT_FINITE');
    } else if (scale == null || scale === CONFIDENCE_SCALE.UNKNOWN) {
      reasonCodes.push('CONFIDENCE_SCALE_MISSING_OR_UNKNOWN');
    } else if (!CONFIDENCE_SCALE_SET.has(scale)) {
      reasonCodes.push('CONFIDENCE_SCALE_UNKNOWN');
    } else {
      // Validate domain bounds without mutating source.
      try {
        normalizeCalibrationProbability(value, scale);
        structurallyPredictive = true;
      } catch (err) {
        reasonCodes.push(err.code || 'CONFIDENCE_VALUE_SCALE_REJECTED');
      }
    }
  }

  // Provenance / method registration — required for measurement eligibility.
  if (provenance == null) {
    reasonCodes.push('PROVENANCE_MISSING');
  }
  if (methodKey == null || methodKey === '') {
    reasonCodes.push('METHOD_KEY_MISSING');
  } else if (!isMethodAuthorized(methodKey)) {
    reasonCodes.push('METHOD_KEY_NOT_AUTHORIZED');
    // Explicit: caller cannot self-register.
    if (
      targetEvent === CALIBRATION_TARGET_EVENT_V1
      || (input.targetSemantics
        && input.targetSemantics.targetEvent === CALIBRATION_TARGET_EVENT_V1)
    ) {
      reasonCodes.push('CALLER_SELF_REGISTRATION_REJECTED');
    }
  }

  if (targetEvent != null && targetEvent !== CALIBRATION_TARGET_EVENT_V1) {
    reasonCodes.push('TARGET_EVENT_NOT_V1');
  }

  // Kind alone never establishes measurement eligibility.
  if (structurallyPredictive) {
    reasonCodes.push('KIND_NECESSARY_NOT_SUFFICIENT');
  }

  // v1 registry empty ⇒ no path to measurementEligible=true.
  if (
    structurallyPredictive
    && isMethodAuthorized(methodKey)
    && (targetEvent == null || targetEvent === CALIBRATION_TARGET_EVENT_V1)
    && provenance != null
  ) {
    // Defensive: if a future version populates the registry, this path opens.
    measurementEligible = true;
    // Remove the "not sufficient" reason when fully authorized.
    const idx = reasonCodes.indexOf('KIND_NECESSARY_NOT_SUFFICIENT');
    if (idx >= 0) reasonCodes.splice(idx, 1);
    const idx2 = reasonCodes.indexOf('METHOD_KEY_NOT_AUTHORIZED');
    if (idx2 >= 0) reasonCodes.splice(idx2, 1);
    const idx3 = reasonCodes.indexOf('CALLER_SELF_REGISTRATION_REJECTED');
    if (idx3 >= 0) reasonCodes.splice(idx3, 1);
    const idx4 = reasonCodes.indexOf('CALIBRATED_KIND_NOT_TITANGOLD_VERIFIED');
    // CALIBRATED still never means TitanGold-verified; keep informational flag.
    void idx4;
  }

  // Deduplicate reason codes; bound count.
  const uniqueReasons = [...new Set(reasonCodes)].slice(0, MAX_REASON_CODES);

  const assessment = freezeDeep({
    schemaVersion: CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION,
    contractVersion: CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION,
    policyVersion: CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION,
    artifactType: 'ARTEMIS_CALIBRATION_MEASUREMENT_ELIGIBILITY_ASSESSMENT',
    authorityClass: CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS,
    sliceId: CALIBRATION_MEASUREMENT_POLICY_SLICE_ID,
    implementationVersion: CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION,
    targetEvent: CALIBRATION_TARGET_EVENT_V1,
    confidenceKind: kind,
    scale,
    methodKey,
    claimedTargetEvent: targetEvent,
    structurallyPredictive,
    measurementEligible,
    ineligibilityIsNotZeroScore: true,
    calibratedKindTitangoldVerified: CALIBRATED_KIND_TITANGOLD_VERIFIED,
    measuredKindIsCalibrationResult: MEASURED_KIND_IS_CALIBRATION_RESULT,
    authorizedMeasurementMethodsEmpty: AUTHORIZED_MEASUREMENT_METHODS.length === 0,
    currentProductionCalibrationEligibleProducers:
      CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS,
    reasonCodes: Object.freeze(uniqueReasons),
    sideEffects: ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS,
    hardFlags: REQUIRED_HARD_FLAGS,
    // Explicitly absent: no numeric score fields.
  });

  const bytes = utf8ByteLength(JSON.stringify(assessment));
  if (bytes > MAX_ELIGIBILITY_ASSESSMENT_UTF8_BYTES) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_TOO_LARGE',
      'eligibility assessment exceeds max size',
      { bytes, max: MAX_ELIGIBILITY_ASSESSMENT_UTF8_BYTES },
    );
  }
  return assessment;
}

/**
 * Convenience: true only when assessment.measurementEligible === true.
 * Does not compute scores.
 */
export function isCalibrationMeasurementEligible(input = {}) {
  return assessCalibrationMeasurementEligibility(input).measurementEligible === true;
}

/**
 * Convenience: true when assessment.structurallyPredictive === true.
 * Does not imply measurement eligibility.
 */
export function isStructurallyPredictiveConfidence(input = {}) {
  return assessCalibrationMeasurementEligibility(input).structurallyPredictive === true;
}

// ---------------------------------------------------------------------------
// Explicit non-execution guards (fail-closed if called)
// ---------------------------------------------------------------------------

export function computeBrierScore() {
  fail(
    'CALIBRATION_MEASUREMENT_POLICY_BRIER_EXECUTION_FORBIDDEN',
    'BINARY_BRIER_SCORE numeric execution is not authorized in this slice',
  );
}

export function calculateBrier() {
  fail(
    'CALIBRATION_MEASUREMENT_POLICY_BRIER_EXECUTION_FORBIDDEN',
    'BINARY_BRIER_SCORE numeric execution is not authorized in this slice',
  );
}

export function scoreObservation() {
  fail(
    'CALIBRATION_MEASUREMENT_POLICY_SCORE_EXECUTION_FORBIDDEN',
    'Observation scoring is not authorized in this slice',
  );
}

export function aggregateBrier() {
  fail(
    'CALIBRATION_MEASUREMENT_POLICY_AGGREGATE_FORBIDDEN',
    'Aggregate Brier measurement is not authorized in this slice',
  );
}

export function meanBrier() {
  fail(
    'CALIBRATION_MEASUREMENT_POLICY_AGGREGATE_FORBIDDEN',
    'Mean Brier measurement is not authorized in this slice',
  );
}

// Re-export scale/kind enums for test convenience (read-reference).
export { CONFIDENCE_KIND, CONFIDENCE_SCALE, EVALUATION_STATUS };
