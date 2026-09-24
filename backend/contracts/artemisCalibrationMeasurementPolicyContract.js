/**
 * Artemis Calibration Measurement Policy Contract Boundary
 * Stage 10 — S10-CALIBRATION-MEASUREMENT-POLICY-CONTRACT
 *
 * Deterministic, non-executing, library-only semantic / validation boundary.
 * AUTHORITY_CLASS = CALIBRATION · RISK_TIER = Tier 3 · isSourceOfTruth = false
 *
 * Governed v1 semantics (COMPLETE):
 * - TARGET_EVENT = TOP_LABEL_DIRECTIONAL_CORRECTNESS
 * - EXPLICIT_PROVENANCE_REQUIRED = YES · NOT_INFERRED_FROM_KIND
 * - AUTHORIZED_MEASUREMENT_METHOD_REGISTRY = EMPTY (immutable; semantically bound shape)
 * - AUTHORIZED_MEASUREMENT_METHODS = EMPTY (immutable frozen array of methodKeys; v1 empty)
 * - FIRST_ALLOWED_PROPER_SCORE = BINARY_BRIER_SCORE ((p−y)² semantics only)
 * - BINARY_BRIER_EXECUTION = NO · AGGREGATE_MEASUREMENT = NO
 * - CALIBRATION_EXECUTION = NO · TRUST/WEIGHT/PROMOTION/DEMOTION = NO
 *
 * Hardening:
 * - No exported mutable Set authority surfaces
 * - Thin observation ref only (calibrationObservationRef)
 * - Strict descriptor allowlist + complete hardFlags/sideEffects
 * - Deep freeze recurses into already-frozen parents
 * - Source-conflict fail-closed · full provenance authority-field identity
 * - Nested confidence requires canonical AVAILABILITY.AVAILABLE
 * - Method authority via semantic registry (NOT string-only membership)
 * - No execution-shaped Brier API surface
 */

import {
  AVAILABILITY,
  CONFIDENCE_KIND,
  CONFIDENCE_SCALE,
  isCanonicalUuid,
} from './artemisEvidenceContract.js';
import {
  CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
  CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
  CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
} from './artemisConfidenceCalibrationContract.js';
import { EVALUATION_STATUS } from './artemisObservedOutcomeEvaluationContract.js';

// ─── Identity / versions ─────────────────────────────────────────────────────

export const CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION =
  'artemis-calibration-measurement-policy-1.0.0';
export const CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION = '1.0.0';
export const CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION = '1.0.0';
export const CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION = '1.0.0';
export const CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE =
  'ARTEMIS_CALIBRATION_MEASUREMENT_POLICY';
export const CALIBRATION_MEASUREMENT_POLICY_TYPE =
  'CALIBRATION_MEASUREMENT_POLICY';
export const CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS = 'CALIBRATION';
export const CALIBRATION_MEASUREMENT_POLICY_SLICE_ID =
  'S10-CALIBRATION-MEASUREMENT-POLICY-CONTRACT';
export const CALIBRATION_MEASUREMENT_POLICY_OFFICIAL_NAME =
  'ARTEMIS_CALIBRATION_MEASUREMENT_POLICY_CONTRACT_BOUNDARY';
export const CALIBRATION_MEASUREMENT_POLICY_RISK_TIER = 'Tier 3';

export const METHOD_REGISTRATION_OWNER =
  'artemisCalibrationMeasurementPolicyContract';
export const CALLER_SELF_REGISTRATION = 'FORBIDDEN';

export const MAX_CALIBRATION_MEASUREMENT_POLICY_BYTES = 48 * 1024;
export const MAX_CALIBRATION_MEASUREMENT_POLICY_NOTE_CHARS = 512;

// ─── Canonical target event / scope ──────────────────────────────────────────

export const CALIBRATION_TARGET_EVENT_V1 = 'TOP_LABEL_DIRECTIONAL_CORRECTNESS';
export const CALIBRATION_TARGET_EVENT_V1_SEMANTICS = Object.freeze({
  identity: CALIBRATION_TARGET_EVENT_V1,
  probabilityMeaning:
    'P(the explicitly selected canonical Decision direction matches the future canonical observed direction at the compatible canonical evaluation horizon)',
  prospective: true,
  policyScoped: true,
  inferredFromConfidenceKindAlone: false,
  explicitProvenanceRequired: true,
  fullClassProbabilityVectorRequired: false,
  synthesizesUnselectedClassDistribution: false,
});

export const TARGET_SEMANTICS_INFERRED_FROM_KIND = false;
export const EXPLICIT_PROVENANCE_REQUIRED = true;
export const MEASUREMENT_SCOPE = 'TOP_LABEL_SELECTED_DIRECTION_SCALAR';
export const SCALAR_SELECTED_CLASS_CONFIDENCE = true;
export const FULL_CLASS_PROBABILITY_VECTOR = false;
export const MULTICLASS_CALIBRATION = 'DEFERRED';

// ─── Authorized measurement method registry — EMPTY / semantically bound (v1) ─
// Object.freeze(new Set(...)) is NOT an immutable Set — .add() still mutates.
// Authority is an immutable registry of semantic registrations, NOT a string list.
// Future entries MUST bind methodKey → targetEvent + measurementScope + policyVersion.
// String-only membership (e.g. METHODS.includes(methodKey)) is FORBIDDEN as authorization.

/**
 * Canonical registration shape for future registry entries.
 * The policy owner — not caller metadata — owns the method→target binding.
 */
export const MEASUREMENT_METHOD_REGISTRATION_REQUIRED_FIELDS = Object.freeze([
  'methodKey',
  'targetEvent',
  'measurementScope',
  'policyVersion',
]);

export const MEASUREMENT_METHOD_REGISTRATION_SHAPE = Object.freeze({
  methodKey: 'string — canonical measurement method identity',
  targetEvent: 'must equal TOP_LABEL_DIRECTIONAL_CORRECTNESS for v1 eligibility',
  measurementScope: 'must equal TOP_LABEL_SELECTED_DIRECTION_SCALAR for v1 eligibility',
  policyVersion: 'string — registration policy version owned by this contract',
});

/**
 * Immutable empty semantic registry. v1: no method is registered / eligible.
 * Entry shape (future): { methodKey, targetEvent, measurementScope, policyVersion }
 */
export const AUTHORIZED_MEASUREMENT_METHOD_REGISTRY = Object.freeze([]);

/**
 * Derived empty methodKey list — NEVER an independent authorization surface.
 * Kept for descriptor/backward-compat reporting only. Authorization uses the registry.
 */
export const AUTHORIZED_MEASUREMENT_METHODS = Object.freeze([]);

export const CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS =
  'NONE / NOT PROVEN';

/** Canonical AVAILABILITY vocabulary values (immutable). */
export const AVAILABILITY_VALUES = Object.freeze(Object.values(AVAILABILITY));

/**
 * Provenance authority fields compared for source-conflict identity.
 * `note` is explicitly excluded as non-authoritative annotation.
 */
export const PROVENANCE_AUTHORITY_FIELDS = Object.freeze([
  'writer',
  'methodKey',
  'source',
  'producer',
  'policyVersion',
  'implementationVersion',
]);

export const PROVENANCE_NOTE_IS_AUTHORITY = false;

export const ALLOWED_PREDICTIVE_KINDS = Object.freeze({
  MODEL_PROBABILITY: CONFIDENCE_KIND.MODEL_PROBABILITY,
  CALIBRATED: CONFIDENCE_KIND.CALIBRATED,
});

/** Immutable frozen array of allowed predictive kind values (authority surface). */
export const ALLOWED_PREDICTIVE_KIND_VALUES = Object.freeze([
  CONFIDENCE_KIND.MODEL_PROBABILITY,
  CONFIDENCE_KIND.CALIBRATED,
]);

export const NON_MEASUREMENT_PROBABILITY_KINDS = Object.freeze({
  HEURISTIC: CONFIDENCE_KIND.HEURISTIC,
  RULE_SCORE: CONFIDENCE_KIND.RULE_SCORE,
  DERIVED: CONFIDENCE_KIND.DERIVED,
  LEGACY: CONFIDENCE_KIND.LEGACY,
  MEASURED: CONFIDENCE_KIND.MEASURED,
  UNAVAILABLE: CONFIDENCE_KIND.UNAVAILABLE,
});

export const NON_MEASUREMENT_PROBABILITY_KIND_VALUES = Object.freeze([
  CONFIDENCE_KIND.HEURISTIC,
  CONFIDENCE_KIND.RULE_SCORE,
  CONFIDENCE_KIND.DERIVED,
  CONFIDENCE_KIND.LEGACY,
  CONFIDENCE_KIND.MEASURED,
  CONFIDENCE_KIND.UNAVAILABLE,
]);

export const MEASURED_KIND_IS_CALIBRATION_RESULT = false;
export const CALIBRATED_KIND_TITANGOLD_VERIFIED = false;
export const CALIBRATED_KIND_SELF_ATTESTATION_ALLOWED = false;

// ─── Binary correctness mapping (policy-scoped) ──────────────────────────────

export const BINARY_CORRECTNESS_MAPPING = Object.freeze({
  MATCH: 1,
  MISMATCH: 0,
  policyScopedOnly: true,
  changesObservedOutcomeEvaluationContract: false,
  missingStaleIncompatibleUnavailableAreNotZero: true,
});

export const MATCH_NUMERIC = 1;
export const MISMATCH_NUMERIC = 0;

export const USABLE_BINARY_EVALUATION_STATUSES = Object.freeze([
  EVALUATION_STATUS.MATCH,
  EVALUATION_STATUS.MISMATCH,
]);

// ─── Measurement domain / scale normalization ────────────────────────────────

export const MEASUREMENT_DOMAIN = 'UNIT_INTERVAL';
export const UNIT_INTERVAL_NORMALIZATION = 'IDENTITY';
export const PERCENT_100_NORMALIZATION = 'DIVIDE_BY_100';
export const UNKNOWN_SCALE_POLICY = 'REJECT';

export const SCALE_NORMALIZATION_POLICY = Object.freeze({
  measurementDomain: MEASUREMENT_DOMAIN,
  unit_interval: UNIT_INTERVAL_NORMALIZATION,
  percent_100: PERCENT_100_NORMALIZATION,
  unknown: UNKNOWN_SCALE_POLICY,
  clamp: false,
  empirical: false,
  minMax: false,
  inferredScale: false,
  hiddenRounding: false,
});

export const CONFIDENCE_SCALE_VALUES = Object.freeze([
  CONFIDENCE_SCALE.UNIT_INTERVAL,
  CONFIDENCE_SCALE.PERCENT_100,
  CONFIDENCE_SCALE.UNKNOWN,
]);

// ─── First allowed proper score (semantics only — NO execution) ──────────────

export const FIRST_ALLOWED_PROPER_SCORE = 'BINARY_BRIER_SCORE';
export const BINARY_BRIER_SCORE = 'BINARY_BRIER_SCORE';
export const BINARY_BRIER_FORMULA_SEMANTICS = '(p-y)^2';
export const BINARY_BRIER_EXECUTION = false;
export const BINARY_BRIER_STANDALONE_CALIBRATION_VERDICT = false;
export const BINARY_BRIER_ROLE =
  'PROPER_PROBABILITY_SCORE / INPUT_TO_LATER_CALIBRATION_EVALUATION';

export const BINARY_BRIER_SEMANTIC_DESCRIPTOR = Object.freeze({
  metricIdentity: BINARY_BRIER_SCORE,
  formulaIdentity: BINARY_BRIER_FORMULA_SEMANTICS,
  perObservationLoss: '(p-y)^2',
  pDomain: '[0,1]',
  yDomain: '{0,1}',
  ySource: 'MATCH=1 / MISMATCH=0 (policy-scoped)',
  executionAuthorized: false,
  aggregateAuthorized: false,
  standaloneCalibrationVerdict: false,
  role: BINARY_BRIER_ROLE,
});

export const ECE = 'DEFERRED_PENDING_AGGREGATION_AND_BINNING_POLICY';
export const RELIABILITY_CURVE = 'DEFERRED_PENDING_AGGREGATION_AND_BINNING_POLICY';
export const BINNING_POLICY = 'UNDEFINED / DEFERRED';
export const SAMPLE_SUFFICIENCY_POLICY = 'UNDEFINED / DEFERRED';
export const PROMOTION_THRESHOLD = 'UNDEFINED';
export const DEMOTION_THRESHOLD = 'UNDEFINED';
export const SEGMENTED_PERFORMANCE_POLICY =
  'DEFERRED / REQUIRED_BEFORE_STAGE10_COMPLETION';
export const GLOBAL_AVERAGE_ONLY = 'NOT SUFFICIENT FOR STAGE10 COMPLETION';

export const DEFERRED_METRIC_STATUS = Object.freeze({
  TOP_LABEL_ECE: ECE,
  RELIABILITY_CURVE,
  MULTICLASS_CALIBRATION,
  CLASSWISE_CALIBRATION: 'DEFERRED',
  MULTICLASS_BRIER: 'DEFERRED',
  LOG_LOSS: 'DEFERRED',
  PLATT: 'DEFERRED',
  ISOTONIC: 'DEFERRED',
  TEMPERATURE_SCALING: 'DEFERRED',
  CONFIDENCE_BUCKETS: 'DEFERRED',
  BINNING_POLICY,
  SAMPLE_SUFFICIENCY_POLICY,
  PROMOTION_THRESHOLD,
  DEMOTION_THRESHOLD,
  SEGMENTED_PERFORMANCE_POLICY,
});

// ─── Hard flags / side-effect ledger ─────────────────────────────────────────

export const REQUIRED_HARD_FLAGS = Object.freeze({
  isSourceOfTruth: false,
  calibrationExecution: false,
  aggregateMeasurement: false,
  binaryBrierExecution: false,
  eceExecution: false,
  reliabilityCurveExecution: false,
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
  feederActivation: false,
  b10Activation: false,
  financialExecution: false,
  liveExecution: false,
  paperExecution: false,
  orderPlacement: false,
  walletMutation: false,
  emergencyStopClear: false,
  decisionEligible: false,
  controlEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  metricInvention: false,
  thresholdInvention: false,
  sampleSizeInvention: false,
  producerReclassification: false,
  selfRegistration: false,
});

/**
 * Explicit zero side-effect counters only.
 * Ambiguous aliases that collide with forbidden result vocabulary (e.g. `orders`)
 * are intentionally absent — use `orderCount` etc.
 */
export const ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS = Object.freeze({
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
  aggregateMeasurementCount: 0,
  binaryBrierExecutionCount: 0,
  eceExecutionCount: 0,
  reliabilityCurveExecutionCount: 0,
  trustMutationCount: 0,
  weightMutationCount: 0,
  promotionCount: 0,
  demotionCount: 0,
  metricInventionCount: 0,
  thresholdInventionCount: 0,
  sampleSizeInventionCount: 0,
  producerReclassificationCount: 0,
  selfRegistrationCount: 0,
});

export const CALIBRATION_MEASUREMENT_POLICY_LIMITATIONS = Object.freeze([
  'AUTHORIZED_MEASUREMENT_METHOD_REGISTRY is EMPTY for v1 — no method is measurement-eligible',
  'AUTHORIZED_MEASUREMENT_METHODS is EMPTY for v1 — reporting list only; not an authorization surface',
  'Method authorization requires registry-owned semantic binding (methodKey + targetEvent + measurementScope + policyVersion)',
  'String-only methodKey membership is FORBIDDEN as authorization',
  'CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS = NONE / NOT PROVEN',
  'BINARY_BRIER_SCORE semantics only — execution of (p−y)² is NOT authorized',
  'BINARY_BRIER_SCORE is NOT a standalone calibration verdict',
  'ECE / reliability curve / multiclass / binning / sample sufficiency deferred',
  'CALIBRATED kind does NOT mean TitanGold-verified calibration',
  'MEASURED kind is NOT a calibration result',
  'Caller targetEvent / targetSemantics NEVER authorize a method',
  'Top-level methodKey NEVER substitutes for canonical provenance.methodKey',
  'Nested confidence without availability=available is not structurally predictive',
  'Provenance note is non-authoritative annotation (PROVENANCE_NOTE_IS_AUTHORITY=false)',
  'Only thin calibrationObservationRef is accepted — not a full observation artifact',
  'No Calibration SoT / table / migration / service / runtime / persistence',
  'No trust / weight / promotion / demotion mutation',
  'No network / provider / LLM / worker / scheduler / feeder / B10 / financial',
]);

export const UPSTREAM_READ_REFERENCE_ONLY = Object.freeze({
  confidenceCalibrationContract: 'READ_REFERENCE_ONLY',
  evidenceContract: 'READ_REFERENCE_ONLY',
  decisionContract: 'READ_REFERENCE_ONLY',
  observedOutcomeContract: 'READ_REFERENCE_ONLY',
  observedOutcomeEvaluationContract: 'READ_REFERENCE_ONLY',
  decisionLineageContract: 'READ_REFERENCE_ONLY',
  replayContract: 'READ_REFERENCE_ONLY',
  replayResultContract: 'READ_REFERENCE_ONLY',
});

// ─── Fail-closed error ───────────────────────────────────────────────────────

export class CalibrationMeasurementPolicyContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'CalibrationMeasurementPolicyContractError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new CalibrationMeasurementPolicyContractError(code, message, details);
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

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
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

function assertFiniteNumber(value, code, message) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(code, message, { value });
  }
}

function byteLengthUtf8(value) {
  return Buffer.byteLength(stableStringify(value), 'utf8');
}

function assertSizeBound(value, maxBytes, code) {
  const n = byteLengthUtf8(value);
  if (n > maxBytes) {
    fail(code, `Artifact exceeds size bound (${n} > ${maxBytes})`, { bytes: n, maxBytes });
  }
}

// ─── Immutable membership helpers (no exported mutable Sets) ─────────────────

function isCanonicalAvailability(value) {
  return typeof value === 'string' && AVAILABILITY_VALUES.includes(value);
}

/**
 * Look up a canonical measurement-method registration by methodKey.
 * v1 registry is empty ⇒ always returns null for real callers.
 * Does NOT authorize via string membership alone.
 */
export function findCanonicalMeasurementMethodRegistration(methodKey) {
  if (typeof methodKey !== 'string' || methodKey.length === 0) {
    return null;
  }
  for (const entry of AUTHORIZED_MEASUREMENT_METHOD_REGISTRY) {
    if (entry != null
      && typeof entry === 'object'
      && entry.methodKey === methodKey) {
      return entry;
    }
  }
  return null;
}

/**
 * INTERNAL ONLY — shape/semantic check for a registry entry already returned
 * by findCanonicalMeasurementMethodRegistration.
 *
 * MUST NOT be exported. Caller-fabricated registration objects must never be
 * certified as authorized merely because their fields look canonical.
 */
function isSemanticallyBoundMeasurementRegistration(registration) {
  return registration != null
    && typeof registration === 'object'
    && typeof registration.methodKey === 'string'
    && registration.methodKey.length > 0
    && registration.targetEvent === CALIBRATION_TARGET_EVENT_V1
    && registration.measurementScope === MEASUREMENT_SCOPE
    && typeof registration.policyVersion === 'string'
    && registration.policyVersion.length > 0;
}

/**
 * Public authorization helper — registry lookup ONLY.
 * Returns true ONLY when:
 *   1. methodKey exists in AUTHORIZED_MEASUREMENT_METHOD_REGISTRY
 *   2. registry entry targetEvent matches governed V1 target
 *   3. registry entry measurementScope matches governed scope
 *   4. registry entry policyVersion is a non-empty string
 *
 * FORBIDDEN:
 *   - AUTHORIZED_MEASUREMENT_METHODS.includes(methodKey) alone
 *   - certifying arbitrary caller-owned registration objects
 *
 * v1 empty registry ⇒ always false for every real caller.
 */
export function isAuthorizedMeasurementMethod(methodKey) {
  const registration = findCanonicalMeasurementMethodRegistration(methodKey);
  return isSemanticallyBoundMeasurementRegistration(registration);
}

function isAllowedPredictiveKind(kind) {
  return ALLOWED_PREDICTIVE_KIND_VALUES.includes(kind);
}

function isNonMeasurementProbabilityKind(kind) {
  return NON_MEASUREMENT_PROBABILITY_KIND_VALUES.includes(kind);
}

function isUsableBinaryEvaluationStatus(status) {
  return USABLE_BINARY_EVALUATION_STATUSES.includes(status);
}

function isKnownConfidenceScale(scale) {
  return CONFIDENCE_SCALE_VALUES.includes(scale);
}

// ─── Forbidden contamination vocabulary ──────────────────────────────────────

const FORBIDDEN_RESULT_KEYS = Object.freeze([
  'brierScore',
  'brier',
  'ece',
  'expectedCalibrationError',
  'reliabilityCurve',
  'reliability',
  'logLoss',
  'log_loss',
  'platt',
  'isotonic',
  'temperatureScaling',
  'temperature_scaling',
  'score',
  'scores',
  'metricValue',
  'metricResult',
  'aggregateScore',
  'meanBrier',
  'mean_brier',
  'sampleCount',
  'minimumSampleCount',
  'binCount',
  'bucketCounts',
  'bins',
  'buckets',
  'threshold',
  'thresholds',
  'promotionThreshold',
  'demotionThreshold',
  'trustScore',
  'trustWeight',
  'weight',
  'weights',
  'promotionStatus',
  'demotionStatus',
  'promoted',
  'demoted',
  'y',
  'correctnessNumeric',
  'probabilityLoss',
]);

const FORBIDDEN_SECRET_KEYS = Object.freeze([
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

const FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  'ohlcv',
  'candles',
  'ticker',
  'orderbook',
  'depth',
  'providerResponse',
  'exchangePayload',
  'rawMarketData',
  'llmOutput',
  'modelOutputBlob',
  'wallet',
  'orders',
  'order',
  'financialExecution',
]);

const FORBIDDEN_KEY_LOOKUP = Object.freeze(
  Object.fromEntries(
    [...FORBIDDEN_RESULT_KEYS, ...FORBIDDEN_SECRET_KEYS, ...FORBIDDEN_PAYLOAD_KEYS].map((k) => [
      k.toLowerCase(),
      true,
    ]),
  ),
);

/**
 * Paths/keys that are legitimate policy-descriptor vocabulary and must not be
 * treated as result-payload contamination when scanning the canonical descriptor.
 * Eligibility inputs do NOT use these exemptions — score:0 / weight:0 remain forbidden.
 */
const DESCRIPTOR_FORBIDDEN_SCAN_EXEMPT_PREFIXES = Object.freeze([
  'hardFlags.',
  'sideEffects.',
  'deferredMetricStatus.',
  'metricSemantics.',
  'binaryCorrectnessMapping.',
  'scaleNormalizationPolicy.',
  'upstreamReadReferenceOnly.',
]);

const DESCRIPTOR_FORBIDDEN_SCAN_EXEMPT_TOP_KEYS = Object.freeze([
  'promotionThreshold',
  'demotionThreshold',
  'binningPolicy',
  'sampleSufficiencyPolicy',
  'segmentedPerformancePolicy',
  'eceStatus',
  'reliabilityCurveStatus',
  'deferredMetricStatus',
  'hardFlags',
  'sideEffects',
  'metricSemantics',
]);

function isDescriptorForbiddenScanExempt(path, key) {
  if (DESCRIPTOR_FORBIDDEN_SCAN_EXEMPT_TOP_KEYS.includes(key) && (path === key || path === '')) {
    return true;
  }
  if (DESCRIPTOR_FORBIDDEN_SCAN_EXEMPT_TOP_KEYS.includes(key) && path === key) {
    return true;
  }
  // Exempt the key node itself when it is a known top-level deferred/policy field.
  if (path === key && DESCRIPTOR_FORBIDDEN_SCAN_EXEMPT_TOP_KEYS.includes(key)) {
    return true;
  }
  for (const prefix of DESCRIPTOR_FORBIDDEN_SCAN_EXEMPT_PREFIXES) {
    if (path.startsWith(prefix) || path === prefix.slice(0, -1)) {
      return true;
    }
  }
  return false;
}

function collectForbiddenKeysDeep(value, path, out, seen, options = {}) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      collectForbiddenKeysDeep(item, `${path}[${i}]`, out, seen, options);
    });
    return;
  }

  for (const key of Object.keys(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    const exempt = options.descriptorMode === true
      && isDescriptorForbiddenScanExempt(nextPath, key);
    if (!exempt && FORBIDDEN_KEY_LOOKUP[key.toLowerCase()]) {
      // Forbidden calibration/result/payload/secret fields remain forbidden even at zero.
      out.push({ path: nextPath, key });
    }
    collectForbiddenKeysDeep(value[key], nextPath, out, seen, options);
  }
}

function assertNoForbiddenOrSecrets(value, contextCode, options = {}) {
  const hits = [];
  collectForbiddenKeysDeep(value, '', hits, new WeakSet(), options);
  if (hits.length > 0) {
    fail(
      contextCode || 'CALIBRATION_MEASUREMENT_POLICY_FORBIDDEN_FIELD',
      'Forbidden result/secret/payload field present',
      { hits: hits.slice(0, 20) },
    );
  }
}

// ─── Canonical descriptor construction ───────────────────────────────────────

function buildPolicyDescriptor() {
  return freezeDeep({
    schemaVersion: CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION,
    contractVersion: CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION,
    policyVersion: CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION,
    implementationVersion: CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION,
    artifactType: CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE,
    policyType: CALIBRATION_MEASUREMENT_POLICY_TYPE,
    authorityClass: CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS,
    riskTier: CALIBRATION_MEASUREMENT_POLICY_RISK_TIER,
    sliceId: CALIBRATION_MEASUREMENT_POLICY_SLICE_ID,
    officialName: CALIBRATION_MEASUREMENT_POLICY_OFFICIAL_NAME,
    isSourceOfTruth: false,
    methodRegistrationOwner: METHOD_REGISTRATION_OWNER,
    callerSelfRegistration: CALLER_SELF_REGISTRATION,

    targetEvent: CALIBRATION_TARGET_EVENT_V1,
    targetEventSemantics: CALIBRATION_TARGET_EVENT_V1_SEMANTICS,
    targetSemanticsInferredFromKind: TARGET_SEMANTICS_INFERRED_FROM_KIND,
    explicitProvenanceRequired: EXPLICIT_PROVENANCE_REQUIRED,

    measurementScope: MEASUREMENT_SCOPE,
    scalarSelectedClassConfidence: SCALAR_SELECTED_CLASS_CONFIDENCE,
    fullClassProbabilityVector: FULL_CLASS_PROBABILITY_VECTOR,
    multiclassCalibration: MULTICLASS_CALIBRATION,

    authorizedMeasurementMethods: AUTHORIZED_MEASUREMENT_METHODS,
    authorizedMeasurementMethodRegistry: AUTHORIZED_MEASUREMENT_METHOD_REGISTRY,
    measurementMethodRegistrationRequiredFields:
      MEASUREMENT_METHOD_REGISTRATION_REQUIRED_FIELDS,
    measurementMethodRegistrationShape: MEASUREMENT_METHOD_REGISTRATION_SHAPE,
    provenanceAuthorityFields: PROVENANCE_AUTHORITY_FIELDS,
    provenanceNoteIsAuthority: PROVENANCE_NOTE_IS_AUTHORITY,
    currentProductionCalibrationEligibleProducers:
      CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS,

    allowedPredictiveKinds: ALLOWED_PREDICTIVE_KIND_VALUES,
    nonMeasurementProbabilityKinds: NON_MEASUREMENT_PROBABILITY_KIND_VALUES,
    measuredKindIsCalibrationResult: MEASURED_KIND_IS_CALIBRATION_RESULT,
    calibratedKindTitanGoldVerified: CALIBRATED_KIND_TITANGOLD_VERIFIED,
    calibratedKindSelfAttestationAllowed: CALIBRATED_KIND_SELF_ATTESTATION_ALLOWED,

    binaryCorrectnessMapping: BINARY_CORRECTNESS_MAPPING,
    usableBinaryEvaluationStatuses: USABLE_BINARY_EVALUATION_STATUSES,

    measurementDomain: MEASUREMENT_DOMAIN,
    scaleNormalizationPolicy: SCALE_NORMALIZATION_POLICY,

    firstAllowedProperScore: FIRST_ALLOWED_PROPER_SCORE,
    metricSemantics: Object.freeze({
      BINARY_BRIER_SCORE: BINARY_BRIER_SEMANTIC_DESCRIPTOR,
    }),
    binaryBrierExecution: BINARY_BRIER_EXECUTION,
    binaryBrierStandaloneCalibrationVerdict: BINARY_BRIER_STANDALONE_CALIBRATION_VERDICT,
    binaryBrierRole: BINARY_BRIER_ROLE,

    eceStatus: ECE,
    reliabilityCurveStatus: RELIABILITY_CURVE,
    deferredMetricStatus: DEFERRED_METRIC_STATUS,
    binningPolicy: BINNING_POLICY,
    sampleSufficiencyPolicy: SAMPLE_SUFFICIENCY_POLICY,
    promotionThreshold: PROMOTION_THRESHOLD,
    demotionThreshold: DEMOTION_THRESHOLD,
    segmentedPerformancePolicy: SEGMENTED_PERFORMANCE_POLICY,
    globalAverageOnly: GLOBAL_AVERAGE_ONLY,

    hardFlags: { ...REQUIRED_HARD_FLAGS },
    sideEffects: { ...ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS },
    limitations: [...CALIBRATION_MEASUREMENT_POLICY_LIMITATIONS],
    upstreamReadReferenceOnly: { ...UPSTREAM_READ_REFERENCE_ONLY },
  });
}

export const CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR = buildPolicyDescriptor();

const DESCRIPTOR_TOP_LEVEL_KEYS = Object.freeze(
  Object.keys(CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR),
);

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));
const SIDE_EFFECT_KEYS = Object.freeze(
  Object.keys(ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS),
);

/**
 * Strict descriptor validation — full canonical shape.
 * Does not merely freeze arbitrary caller data.
 */
export function validateCalibrationMeasurementPolicyDescriptor(input) {
  assertPlainObject(
    input,
    'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_INVALID',
    'Descriptor must be a plain object',
  );
  assertNoForbiddenOrSecrets(
    input,
    'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_FORBIDDEN_FIELD',
    { descriptorMode: true },
  );
  assertSizeBound(
    input,
    MAX_CALIBRATION_MEASUREMENT_POLICY_BYTES,
    'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_SIZE_EXCEEDED',
  );

  const unknown = Object.keys(input).filter((k) => !DESCRIPTOR_TOP_LEVEL_KEYS.includes(k));
  if (unknown.length > 0) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_UNKNOWN_FIELD',
      'Unknown descriptor field',
      { unknown },
    );
  }

  for (const key of DESCRIPTOR_TOP_LEVEL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_MISSING_FIELD',
        `Missing required descriptor field: ${key}`,
        { field: key },
      );
    }
  }

  assertExactString(
    input.schemaVersion,
    CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION,
    'CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION_MISMATCH',
    'schemaVersion mismatch',
  );
  assertExactString(
    input.contractVersion,
    CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION,
    'CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION_MISMATCH',
    'contractVersion mismatch',
  );
  assertExactString(
    input.policyVersion,
    CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION,
    'CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION_MISMATCH',
    'policyVersion mismatch',
  );
  assertExactString(
    input.implementationVersion,
    CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION,
    'CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION_MISMATCH',
    'implementationVersion mismatch',
  );
  assertExactString(
    input.artifactType,
    CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE,
    'CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE_MISMATCH',
    'artifactType mismatch',
  );
  assertExactString(
    input.policyType,
    CALIBRATION_MEASUREMENT_POLICY_TYPE,
    'CALIBRATION_MEASUREMENT_POLICY_TYPE_MISMATCH',
    'policyType mismatch',
  );
  assertExactString(
    input.authorityClass,
    CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS,
    'CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS_MISMATCH',
    'authorityClass mismatch',
  );
  assertExactString(
    input.sliceId,
    CALIBRATION_MEASUREMENT_POLICY_SLICE_ID,
    'CALIBRATION_MEASUREMENT_POLICY_SLICE_ID_MISMATCH',
    'sliceId mismatch',
  );
  assertExactString(
    input.officialName,
    CALIBRATION_MEASUREMENT_POLICY_OFFICIAL_NAME,
    'CALIBRATION_MEASUREMENT_POLICY_OFFICIAL_NAME_MISMATCH',
    'officialName mismatch',
  );
  assertExactString(
    input.riskTier,
    CALIBRATION_MEASUREMENT_POLICY_RISK_TIER,
    'CALIBRATION_MEASUREMENT_POLICY_RISK_TIER_MISMATCH',
    'riskTier mismatch',
  );

  if (input.isSourceOfTruth !== false) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_IS_SOURCE_OF_TRUTH_FORBIDDEN',
      'isSourceOfTruth must be false',
    );
  }
  assertExactString(
    input.methodRegistrationOwner,
    METHOD_REGISTRATION_OWNER,
    'CALIBRATION_MEASUREMENT_POLICY_METHOD_REGISTRATION_OWNER_MISMATCH',
    'methodRegistrationOwner mismatch',
  );
  assertExactString(
    input.callerSelfRegistration,
    CALLER_SELF_REGISTRATION,
    'CALIBRATION_MEASUREMENT_POLICY_CALLER_SELF_REGISTRATION_MISMATCH',
    'callerSelfRegistration mismatch',
  );

  assertExactString(
    input.targetEvent,
    CALIBRATION_TARGET_EVENT_V1,
    'CALIBRATION_MEASUREMENT_POLICY_TARGET_EVENT_MISMATCH',
    'targetEvent mismatch',
  );
  if (input.targetSemanticsInferredFromKind !== false) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_TARGET_INFERENCE_FORBIDDEN',
      'targetSemanticsInferredFromKind must be false',
    );
  }
  if (input.explicitProvenanceRequired !== true) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_EXPLICIT_PROVENANCE_REQUIRED',
      'explicitProvenanceRequired must be true',
    );
  }
  assertExactString(
    input.measurementScope,
    MEASUREMENT_SCOPE,
    'CALIBRATION_MEASUREMENT_POLICY_MEASUREMENT_SCOPE_MISMATCH',
    'measurementScope mismatch',
  );
  assertExactString(
    input.measurementDomain,
    MEASUREMENT_DOMAIN,
    'CALIBRATION_MEASUREMENT_POLICY_MEASUREMENT_DOMAIN_MISMATCH',
    'measurementDomain mismatch',
  );

  if (!Array.isArray(input.authorizedMeasurementMethods)
    || input.authorizedMeasurementMethods.length !== 0) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_AUTHORIZED_METHODS_MUST_BE_EMPTY',
      'authorizedMeasurementMethods must be exactly empty for v1',
    );
  }

  if (!Array.isArray(input.authorizedMeasurementMethodRegistry)
    || input.authorizedMeasurementMethodRegistry.length !== 0) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_AUTHORIZED_REGISTRY_MUST_BE_EMPTY',
      'authorizedMeasurementMethodRegistry must be exactly empty for v1',
    );
  }

  if (!Array.isArray(input.measurementMethodRegistrationRequiredFields)
    || input.measurementMethodRegistrationRequiredFields.length
      !== MEASUREMENT_METHOD_REGISTRATION_REQUIRED_FIELDS.length
    || !MEASUREMENT_METHOD_REGISTRATION_REQUIRED_FIELDS.every(
      (k, i) => input.measurementMethodRegistrationRequiredFields[i] === k,
    )) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_REGISTRATION_FIELDS_MISMATCH',
      'measurementMethodRegistrationRequiredFields must match canonical shape',
    );
  }

  if (!Array.isArray(input.allowedPredictiveKinds)
    || input.allowedPredictiveKinds.length !== ALLOWED_PREDICTIVE_KIND_VALUES.length
    || !ALLOWED_PREDICTIVE_KIND_VALUES.every((k, i) => input.allowedPredictiveKinds[i] === k)) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_ALLOWED_PREDICTIVE_KINDS_MISMATCH',
      'allowedPredictiveKinds must match canonical MODEL_PROBABILITY | CALIBRATED',
    );
  }

  assertPlainObject(
    input.binaryCorrectnessMapping,
    'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_MAPPING_INVALID',
    'binaryCorrectnessMapping must be a plain object',
  );
  if (input.binaryCorrectnessMapping.MATCH !== 1
    || input.binaryCorrectnessMapping.MISMATCH !== 0
    || input.binaryCorrectnessMapping.policyScopedOnly !== true) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_MAPPING_MISMATCH',
      'binaryCorrectnessMapping must be MATCH=1 / MISMATCH=0 / policyScopedOnly',
    );
  }

  assertPlainObject(
    input.scaleNormalizationPolicy,
    'CALIBRATION_MEASUREMENT_POLICY_SCALE_POLICY_INVALID',
    'scaleNormalizationPolicy must be a plain object',
  );
  assertExactString(
    input.scaleNormalizationPolicy.measurementDomain,
    MEASUREMENT_DOMAIN,
    'CALIBRATION_MEASUREMENT_POLICY_SCALE_DOMAIN_MISMATCH',
    'scaleNormalizationPolicy.measurementDomain mismatch',
  );
  assertExactString(
    input.scaleNormalizationPolicy.unit_interval,
    UNIT_INTERVAL_NORMALIZATION,
    'CALIBRATION_MEASUREMENT_POLICY_UNIT_INTERVAL_NORMALIZATION_MISMATCH',
    'unit_interval normalization mismatch',
  );
  assertExactString(
    input.scaleNormalizationPolicy.percent_100,
    PERCENT_100_NORMALIZATION,
    'CALIBRATION_MEASUREMENT_POLICY_PERCENT_100_NORMALIZATION_MISMATCH',
    'percent_100 normalization mismatch',
  );
  assertExactString(
    input.scaleNormalizationPolicy.unknown,
    UNKNOWN_SCALE_POLICY,
    'CALIBRATION_MEASUREMENT_POLICY_UNKNOWN_SCALE_POLICY_MISMATCH',
    'unknown scale policy mismatch',
  );

  assertExactString(
    input.firstAllowedProperScore,
    FIRST_ALLOWED_PROPER_SCORE,
    'CALIBRATION_MEASUREMENT_POLICY_FIRST_PROPER_SCORE_MISMATCH',
    'firstAllowedProperScore mismatch',
  );
  if (input.binaryBrierExecution !== false) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_BINARY_BRIER_EXECUTION_FORBIDDEN',
      'binaryBrierExecution must be false',
    );
  }

  assertPlainObject(
    input.metricSemantics,
    'CALIBRATION_MEASUREMENT_POLICY_METRIC_SEMANTICS_INVALID',
    'metricSemantics must be a plain object',
  );
  const metricKeys = Object.keys(input.metricSemantics);
  if (metricKeys.length !== 1 || metricKeys[0] !== 'BINARY_BRIER_SCORE') {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_METRIC_SEMANTICS_MISMATCH',
      'metricSemantics must contain exactly BINARY_BRIER_SCORE',
    );
  }
  assertPlainObject(
    input.metricSemantics.BINARY_BRIER_SCORE,
    'CALIBRATION_MEASUREMENT_POLICY_BRIER_DESCRIPTOR_INVALID',
    'BINARY_BRIER_SCORE descriptor must be a plain object',
  );
  const brier = input.metricSemantics.BINARY_BRIER_SCORE;
  assertExactString(
    brier.metricIdentity,
    BINARY_BRIER_SCORE,
    'CALIBRATION_MEASUREMENT_POLICY_BRIER_IDENTITY_MISMATCH',
    'BINARY_BRIER_SCORE.metricIdentity mismatch',
  );
  assertExactString(
    brier.formulaIdentity,
    BINARY_BRIER_FORMULA_SEMANTICS,
    'CALIBRATION_MEASUREMENT_POLICY_BRIER_FORMULA_MISMATCH',
    'BINARY_BRIER_SCORE.formulaIdentity mismatch',
  );
  if (brier.executionAuthorized !== false || brier.aggregateAuthorized !== false) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_BRIER_EXECUTION_FLAG_FORBIDDEN',
      'BINARY_BRIER_SCORE execution/aggregate flags must be false',
    );
  }

  // Hard flags — complete, all false, no unknown
  assertPlainObject(
    input.hardFlags,
    'CALIBRATION_MEASUREMENT_POLICY_HARD_FLAGS_INVALID',
    'hardFlags must be a plain object',
  );
  const hardUnknown = Object.keys(input.hardFlags).filter((k) => !HARD_FLAG_KEYS.includes(k));
  if (hardUnknown.length > 0) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_HARD_FLAGS_UNKNOWN',
      'Unknown hardFlags key',
      { unknown: hardUnknown },
    );
  }
  for (const key of HARD_FLAG_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input.hardFlags, key)) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_HARD_FLAGS_MISSING',
        `Missing hardFlags.${key}`,
        { field: key },
      );
    }
    if (input.hardFlags[key] !== false) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_HARD_FLAGS_MUST_BE_FALSE',
        `hardFlags.${key} must be false`,
        { field: key, value: input.hardFlags[key] },
      );
    }
  }

  // Side-effect ledger — complete, all numeric zero, no unknown
  assertPlainObject(
    input.sideEffects,
    'CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS_INVALID',
    'sideEffects must be a plain object',
  );
  const seUnknown = Object.keys(input.sideEffects).filter((k) => !SIDE_EFFECT_KEYS.includes(k));
  if (seUnknown.length > 0) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS_UNKNOWN',
      'Unknown sideEffects key',
      { unknown: seUnknown },
    );
  }
  for (const key of SIDE_EFFECT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input.sideEffects, key)) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS_MISSING',
        `Missing sideEffects.${key}`,
        { field: key },
      );
    }
    if (input.sideEffects[key] !== 0) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS_NONZERO',
        `sideEffects.${key} must be numeric zero`,
        { field: key, value: input.sideEffects[key] },
      );
    }
  }

  if (!Array.isArray(input.limitations) || input.limitations.length === 0) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_LIMITATIONS_INVALID',
      'limitations must be a non-empty array',
    );
  }

  assertPlainObject(
    input.upstreamReadReferenceOnly,
    'CALIBRATION_MEASUREMENT_POLICY_UPSTREAM_REF_INVALID',
    'upstreamReadReferenceOnly must be a plain object',
  );
  for (const [k, v] of Object.entries(UPSTREAM_READ_REFERENCE_ONLY)) {
    if (input.upstreamReadReferenceOnly[k] !== v) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_UPSTREAM_REF_MISMATCH',
        `upstreamReadReferenceOnly.${k} mismatch`,
      );
    }
  }

  // Canonical equality vs frozen descriptor (fail-closed against mutated authority)
  if (stableStringify(input) !== stableStringify(CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR)) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR_NOT_CANONICAL',
      'Descriptor must equal the canonical frozen policy descriptor',
    );
  }

  return CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR;
}

export function getCalibrationMeasurementPolicyDescriptor() {
  return CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR;
}

// ─── Scale normalization (pure semantic helper — NOT metric execution) ───────

export function normalizeConfidenceToUnitInterval(value, scale) {
  if (scale === CONFIDENCE_SCALE.UNKNOWN || scale === 'unknown') {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_UNKNOWN_SCALE_REJECTED',
      'UNKNOWN_SCALE must be rejected',
    );
  }
  assertFiniteNumber(value, 'CALIBRATION_MEASUREMENT_POLICY_VALUE_INVALID', 'value must be finite');

  let normalized;
  if (scale === CONFIDENCE_SCALE.UNIT_INTERVAL || scale === 'unit_interval') {
    normalized = value;
  } else if (scale === CONFIDENCE_SCALE.PERCENT_100 || scale === 'percent_100') {
    normalized = value / 100;
  } else {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_SCALE_REJECTED',
      'Unsupported or unknown confidence scale',
      { scale },
    );
  }

  if (!(normalized >= 0 && normalized <= 1)) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_NORMALIZED_OUT_OF_UNIT_INTERVAL',
      'Normalized confidence must lie in [0,1]',
      { value, scale, normalized },
    );
  }
  return normalized;
}

// ─── Binary correctness mapping (policy-scoped semantic helper) ──────────────

export function mapBinaryCorrectnessTarget(evaluationStatus) {
  if (evaluationStatus == null) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_MISSING',
      'evaluationStatus is required for binary correctness mapping',
    );
  }
  if (typeof evaluationStatus !== 'string') {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_INVALID',
      'evaluationStatus must be a string',
    );
  }
  if (evaluationStatus === EVALUATION_STATUS.MATCH) return MATCH_NUMERIC;
  if (evaluationStatus === EVALUATION_STATUS.MISMATCH) return MISMATCH_NUMERIC;
  if (!isUsableBinaryEvaluationStatus(evaluationStatus)) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_REJECTED',
      'Only MATCH/MISMATCH may map to binary correctness; unavailable-class statuses are not zero',
      { evaluationStatus },
    );
  }
  fail(
    'CALIBRATION_MEASUREMENT_POLICY_CORRECTNESS_STATUS_REJECTED',
    'evaluationStatus rejected for binary correctness mapping',
    { evaluationStatus },
  );
}

// ─── Eligibility assessment (non-executing) ──────────────────────────────────

const ELIGIBILITY_INPUT_ALLOWLIST = Object.freeze([
  'confidenceKind',
  'kind',
  'value',
  'scale',
  'availability',
  'confidence',
  'predictiveClaimRef',
  'calibrationObservationRef',
  'methodKey',
  'provenance',
  'targetEvent',
  'targetSemantics',
  'note',
]);

const CONFIDENCE_OBJECT_ALLOWLIST = Object.freeze([
  'kind',
  'value',
  'scale',
  'availability',
  'methodKey',
  'provenance',
  'note',
]);

const PROVENANCE_ALLOWLIST = Object.freeze([
  'writer',
  'methodKey',
  'source',
  'producer',
  'policyVersion',
  'implementationVersion',
  'note',
]);

const PREDICTIVE_CLAIM_REF_ALLOWLIST = Object.freeze([
  'kind',
  'value',
  'scale',
  'availability',
  'methodKey',
  'provenance',
  'confidence',
  'note',
]);

/** Thin observation reference — NOT a full Confidence Calibration artifact. */
const OBSERVATION_REF_ALLOWLIST = Object.freeze([
  'calibrationObservationId',
  'artifactType',
  'contractVersion',
  'schemaVersion',
]);

function assertAllowlist(obj, allowlist, code) {
  const unknown = Object.keys(obj).filter((k) => !allowlist.includes(k));
  if (unknown.length > 0) {
    fail(code, 'Unknown field(s)', { unknown });
  }
}

function validateProvenanceObject(prov, codePrefix) {
  assertPlainObject(prov, `${codePrefix}_INVALID`, 'provenance must be a plain object');
  assertAllowlist(prov, PROVENANCE_ALLOWLIST, `${codePrefix}_UNKNOWN_FIELD`);
  if (prov.methodKey != null && typeof prov.methodKey !== 'string') {
    fail(`${codePrefix}_METHOD_KEY_INVALID`, 'provenance.methodKey must be a string');
  }
  if (prov.writer != null && typeof prov.writer !== 'string') {
    fail(`${codePrefix}_WRITER_INVALID`, 'provenance.writer must be a string');
  }
  if (prov.source != null && typeof prov.source !== 'string') {
    fail(`${codePrefix}_SOURCE_INVALID`, 'provenance.source must be a string');
  }
  if (prov.producer != null && typeof prov.producer !== 'string') {
    fail(`${codePrefix}_PRODUCER_INVALID`, 'provenance.producer must be a string');
  }
  return freezeDeep({ ...prov });
}

/**
 * Nested canonical-style confidence object.
 * availability must be `available` before structurally predictive.
 */
function validateNestedConfidence(confidence) {
  assertPlainObject(
    confidence,
    'CALIBRATION_MEASUREMENT_POLICY_CONFIDENCE_INVALID',
    'confidence must be a plain object',
  );
  assertAllowlist(
    confidence,
    CONFIDENCE_OBJECT_ALLOWLIST,
    'CALIBRATION_MEASUREMENT_POLICY_CONFIDENCE_UNKNOWN_FIELD',
  );

  if (confidence.kind != null && typeof confidence.kind !== 'string') {
    fail('CALIBRATION_MEASUREMENT_POLICY_CONFIDENCE_KIND_INVALID', 'confidence.kind must be a string');
  }
  if (confidence.value != null) {
    assertFiniteNumber(
      confidence.value,
      'CALIBRATION_MEASUREMENT_POLICY_CONFIDENCE_VALUE_INVALID',
      'confidence.value must be finite',
    );
  }
  if (confidence.scale != null) {
    if (typeof confidence.scale !== 'string' || !isKnownConfidenceScale(confidence.scale)) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_CONFIDENCE_SCALE_INVALID',
        'confidence.scale must be a known confidence scale',
        { scale: confidence.scale },
      );
    }
  }
  if (confidence.availability != null) {
    if (typeof confidence.availability !== 'string'
      || !isCanonicalAvailability(confidence.availability)) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_CONFIDENCE_AVAILABILITY_INVALID',
        'confidence.availability must be a canonical AVAILABILITY value',
        { availability: confidence.availability },
      );
    }
  }
  if (confidence.methodKey != null && typeof confidence.methodKey !== 'string') {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_CONFIDENCE_METHOD_KEY_INVALID',
      'confidence.methodKey must be a string',
    );
  }

  let provenance = undefined;
  if (confidence.provenance != null) {
    provenance = validateProvenanceObject(
      confidence.provenance,
      'CALIBRATION_MEASUREMENT_POLICY_CONFIDENCE_PROVENANCE',
    );
  }

  return freezeDeep({
    kind: confidence.kind,
    value: confidence.value,
    scale: confidence.scale,
    availability: confidence.availability,
    methodKey: confidence.methodKey,
    provenance,
    note: confidence.note,
  });
}

/**
 * Fail-closed thin Calibration Observation reference.
 * Requires canonical identity fields — not merely calibrationObservationId.
 */
function validateCalibrationObservationRef(ref) {
  assertPlainObject(
    ref,
    'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_REF_INVALID',
    'calibrationObservationRef must be a plain object',
  );
  assertAllowlist(
    ref,
    OBSERVATION_REF_ALLOWLIST,
    'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_REF_UNKNOWN_FIELD',
  );

  if (ref.calibrationObservationId == null) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_ID_MISSING',
      'calibrationObservationRef.calibrationObservationId is required',
    );
  }
  if (typeof ref.calibrationObservationId !== 'string'
    || !isCanonicalUuid(ref.calibrationObservationId)) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_ID_INVALID',
      'calibrationObservationRef.calibrationObservationId must be a canonical UUID',
    );
  }

  if (ref.artifactType == null) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_ARTIFACT_TYPE_MISSING',
      'calibrationObservationRef.artifactType is required',
    );
  }
  assertExactString(
    ref.artifactType,
    CONFIDENCE_CALIBRATION_ARTIFACT_TYPE,
    'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_ARTIFACT_TYPE_MISMATCH',
    'calibrationObservationRef.artifactType mismatch',
  );

  if (ref.contractVersion == null) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_CONTRACT_VERSION_MISSING',
      'calibrationObservationRef.contractVersion is required',
    );
  }
  assertExactString(
    ref.contractVersion,
    CONFIDENCE_CALIBRATION_CONTRACT_VERSION,
    'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_CONTRACT_VERSION_MISMATCH',
    'calibrationObservationRef.contractVersion mismatch',
  );

  if (ref.schemaVersion == null) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_SCHEMA_VERSION_MISSING',
      'calibrationObservationRef.schemaVersion is required',
    );
  }
  assertExactString(
    ref.schemaVersion,
    CONFIDENCE_CALIBRATION_SCHEMA_VERSION,
    'CALIBRATION_MEASUREMENT_POLICY_OBSERVATION_SCHEMA_VERSION_MISMATCH',
    'calibrationObservationRef.schemaVersion mismatch',
  );

  return freezeDeep({
    calibrationObservationId: String(ref.calibrationObservationId).trim().toLowerCase(),
    artifactType: ref.artifactType,
    contractVersion: ref.contractVersion,
    schemaVersion: ref.schemaVersion,
  });
}

/**
 * Collect claim values from multiple representations; fail closed on conflict.
 */
function resolveUniqueClaim(candidates, fieldName) {
  const present = candidates.filter((c) => c !== undefined && c !== null);
  if (present.length === 0) return undefined;
  const first = present[0];
  for (let i = 1; i < present.length; i += 1) {
    if (present[i] !== first) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_SOURCE_CONFLICT',
        `Conflicting ${fieldName} across claim sources`,
        { field: fieldName, values: present },
      );
    }
  }
  return first;
}

function resolveUniqueProvenance(candidates) {
  const present = candidates.filter((c) => c !== undefined && c !== null);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];

  // Semantic identity across all authority fields (note excluded — non-authoritative).
  // Defined-values-must-agree: any authority field present on any candidate must
  // match on every other candidate that also defines it; presence asymmetry fails closed.
  const snapshots = present.map((prov) => {
    const snap = {};
    for (const field of PROVENANCE_AUTHORITY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(prov, field) && prov[field] != null) {
        snap[field] = prov[field];
      }
    }
    return snap;
  });

  const unionKeys = new Set();
  for (const snap of snapshots) {
    for (const k of Object.keys(snap)) unionKeys.add(k);
  }

  for (const field of unionKeys) {
    const values = snapshots.map((s) => s[field]);
    const defined = values.filter((v) => v !== undefined);
    if (defined.length !== snapshots.length) {
      fail(
        'CALIBRATION_MEASUREMENT_POLICY_SOURCE_CONFLICT',
        `Conflicting provenance.${field} presence across claim sources`,
        { field, values },
      );
    }
    const first = defined[0];
    for (let i = 1; i < defined.length; i += 1) {
      if (defined[i] !== first) {
        fail(
          'CALIBRATION_MEASUREMENT_POLICY_SOURCE_CONFLICT',
          `Conflicting provenance.${field} across claim sources`,
          { field, values: defined },
        );
      }
    }
  }

  return present[0];
}

/**
 * Assess whether a predictive confidence claim is structurally compatible with
 * this measurement policy. Does NOT execute metrics. Does NOT authorize methods
 * outside the empty immutable registry. Does NOT reclassify producers.
 *
 * Honest API: accepts thin `calibrationObservationRef` only (not a full artifact).
 */
export function assessCalibrationMeasurementEligibility(input) {
  assertPlainObject(
    input,
    'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_INPUT_INVALID',
    'Eligibility input must be a plain object',
  );
  assertNoForbiddenOrSecrets(input, 'CALIBRATION_MEASUREMENT_POLICY_FORBIDDEN_FIELD');
  assertSizeBound(
    input,
    MAX_CALIBRATION_MEASUREMENT_POLICY_BYTES,
    'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_SIZE_EXCEEDED',
  );
  assertAllowlist(
    input,
    ELIGIBILITY_INPUT_ALLOWLIST,
    'CALIBRATION_MEASUREMENT_POLICY_ELIGIBILITY_UNKNOWN_FIELD',
  );

  if (input.note != null) {
    if (typeof input.note !== 'string') {
      fail('CALIBRATION_MEASUREMENT_POLICY_NOTE_INVALID', 'note must be a string');
    }
    if (input.note.length > MAX_CALIBRATION_MEASUREMENT_POLICY_NOTE_CHARS) {
      fail('CALIBRATION_MEASUREMENT_POLICY_NOTE_INVALID', 'note exceeds max length');
    }
  }

  // Reject misleading full-artifact key if caller still supplies it.
  // (Not on allowlist — caught as unknown — but document fail-closed intent.)

  let nestedConfidence = undefined;
  if (input.confidence != null) {
    nestedConfidence = validateNestedConfidence(input.confidence);
  }

  let predictiveClaimRef = undefined;
  if (input.predictiveClaimRef != null) {
    assertPlainObject(
      input.predictiveClaimRef,
      'CALIBRATION_MEASUREMENT_POLICY_PREDICTIVE_CLAIM_REF_INVALID',
      'predictiveClaimRef must be a plain object',
    );
    assertAllowlist(
      input.predictiveClaimRef,
      PREDICTIVE_CLAIM_REF_ALLOWLIST,
      'CALIBRATION_MEASUREMENT_POLICY_PREDICTIVE_CLAIM_REF_UNKNOWN_FIELD',
    );
    let claimConfidence = undefined;
    if (input.predictiveClaimRef.confidence != null) {
      claimConfidence = validateNestedConfidence(input.predictiveClaimRef.confidence);
    }
    let claimProv = undefined;
    if (input.predictiveClaimRef.provenance != null) {
      claimProv = validateProvenanceObject(
        input.predictiveClaimRef.provenance,
        'CALIBRATION_MEASUREMENT_POLICY_PREDICTIVE_CLAIM_PROVENANCE',
      );
    }
    predictiveClaimRef = freezeDeep({
      kind: input.predictiveClaimRef.kind,
      value: input.predictiveClaimRef.value,
      scale: input.predictiveClaimRef.scale,
      availability: input.predictiveClaimRef.availability,
      methodKey: input.predictiveClaimRef.methodKey,
      provenance: claimProv,
      confidence: claimConfidence,
      note: input.predictiveClaimRef.note,
    });
  }

  let calibrationObservationRef = undefined;
  if (input.calibrationObservationRef != null) {
    calibrationObservationRef = validateCalibrationObservationRef(
      input.calibrationObservationRef,
    );
  }

  let topProvenance = undefined;
  if (input.provenance != null) {
    topProvenance = validateProvenanceObject(
      input.provenance,
      'CALIBRATION_MEASUREMENT_POLICY_PROVENANCE',
    );
  }

  // ── Source-conflict fail-closed resolution ──
  const kind = resolveUniqueClaim([
    input.confidenceKind,
    input.kind,
    nestedConfidence?.kind,
    predictiveClaimRef?.kind,
    predictiveClaimRef?.confidence?.kind,
  ], 'kind');

  const value = resolveUniqueClaim([
    input.value,
    nestedConfidence?.value,
    predictiveClaimRef?.value,
    predictiveClaimRef?.confidence?.value,
  ], 'value');

  const scale = resolveUniqueClaim([
    input.scale,
    nestedConfidence?.scale,
    predictiveClaimRef?.scale,
    predictiveClaimRef?.confidence?.scale,
  ], 'scale');

  const availability = resolveUniqueClaim([
    input.availability,
    nestedConfidence?.availability,
    predictiveClaimRef?.availability,
    predictiveClaimRef?.confidence?.availability,
  ], 'availability');

  if (availability != null && !isCanonicalAvailability(availability)) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_CONFIDENCE_AVAILABILITY_INVALID',
      'availability must be a canonical AVAILABILITY value',
      { availability },
    );
  }

  // Canonical provenance method identity (does NOT include bare top-level methodKey)
  const provenance = resolveUniqueProvenance([
    topProvenance,
    nestedConfidence?.provenance,
    predictiveClaimRef?.provenance,
    predictiveClaimRef?.confidence?.provenance,
  ]);

  const topLevelMethodKey = resolveUniqueClaim([
    input.methodKey,
    nestedConfidence?.methodKey,
    predictiveClaimRef?.methodKey,
    predictiveClaimRef?.confidence?.methodKey,
  ], 'methodKey');

  // Top-level / nested methodKey must agree with provenance.methodKey when both present.
  if (topLevelMethodKey != null && provenance?.methodKey != null
    && topLevelMethodKey !== provenance.methodKey) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_SOURCE_CONFLICT',
      'methodKey conflicts with provenance.methodKey',
      { methodKey: topLevelMethodKey, provenanceMethodKey: provenance.methodKey },
    );
  }

  // Canonical method identity for eligibility = provenance.methodKey only.
  // Top-level methodKey alone NEVER substitutes for missing provenance.methodKey.
  const canonicalMethodKey = provenance?.methodKey;

  const targetEvent = resolveUniqueClaim([
    input.targetEvent,
    input.targetSemantics,
  ], 'targetEvent');

  // Caller targetEvent / targetSemantics are claims only — NEVER authorize a method.
  if (targetEvent != null && targetEvent !== CALIBRATION_TARGET_EVENT_V1) {
    fail(
      'CALIBRATION_MEASUREMENT_POLICY_TARGET_EVENT_REJECTED',
      'Caller targetEvent/targetSemantics must equal TOP_LABEL_DIRECTIONAL_CORRECTNESS when supplied',
      { targetEvent },
    );
  }

  const reasons = [];
  let structurallyPredictive = true;

  // Nested confidence availability gate — missing/unavailable cannot be structurally predictive.
  // Do NOT infer availability from value/kind/scale.
  const nestedConfidencePresent = nestedConfidence != null
    || (predictiveClaimRef != null && predictiveClaimRef.confidence != null);
  if (nestedConfidencePresent) {
    if (availability == null) {
      structurallyPredictive = false;
      reasons.push('NESTED_CONFIDENCE_AVAILABILITY_MISSING');
    } else if (availability !== AVAILABILITY.AVAILABLE) {
      structurallyPredictive = false;
      reasons.push('NESTED_CONFIDENCE_UNAVAILABLE');
    }
  } else if (availability != null && availability !== AVAILABILITY.AVAILABLE) {
    structurallyPredictive = false;
    reasons.push('NESTED_CONFIDENCE_UNAVAILABLE');
  }

  if (kind == null) {
    structurallyPredictive = false;
    reasons.push('CONFIDENCE_KIND_MISSING');
  } else if (!isAllowedPredictiveKind(kind)) {
    structurallyPredictive = false;
    if (isNonMeasurementProbabilityKind(kind)) {
      reasons.push('NON_MEASUREMENT_PROBABILITY_KIND');
    } else {
      reasons.push('CONFIDENCE_KIND_NOT_PREDICTIVE');
    }
    if (kind === CONFIDENCE_KIND.MEASURED) {
      reasons.push('MEASURED_KIND_IS_NOT_CALIBRATION_RESULT');
    }
  }

  if (value == null) {
    structurallyPredictive = false;
    reasons.push('CONFIDENCE_VALUE_MISSING');
  } else if (typeof value !== 'number' || !Number.isFinite(value)) {
    structurallyPredictive = false;
    reasons.push('CONFIDENCE_VALUE_INVALID');
  }

  if (scale == null) {
    structurallyPredictive = false;
    reasons.push('CONFIDENCE_SCALE_MISSING');
  } else if (scale === CONFIDENCE_SCALE.UNKNOWN || scale === 'unknown') {
    structurallyPredictive = false;
    reasons.push('UNKNOWN_SCALE_REJECTED');
  } else if (!isKnownConfidenceScale(scale)
    && scale !== 'unit_interval'
    && scale !== 'percent_100') {
    structurallyPredictive = false;
    reasons.push('CONFIDENCE_SCALE_REJECTED');
  }

  let normalizedUnitInterval = undefined;
  if (
    structurallyPredictive
    && typeof value === 'number'
    && Number.isFinite(value)
    && scale != null
    && scale !== CONFIDENCE_SCALE.UNKNOWN
  ) {
    try {
      normalizedUnitInterval = normalizeConfidenceToUnitInterval(value, scale);
    } catch (err) {
      structurallyPredictive = false;
      reasons.push(err?.code || 'NORMALIZE_FAILED');
    }
  }

  // Provenance method authority — top-level methodKey alone is insufficient.
  if (canonicalMethodKey == null || canonicalMethodKey === '') {
    reasons.push('PROVENANCE_METHOD_KEY_MISSING');
  } else if (topLevelMethodKey != null && provenance == null) {
    // Explicit: top-level methodKey without provenance object cannot authorize.
    reasons.push('PROVENANCE_METHOD_KEY_MISSING');
  }

  // Method authorization — empty immutable semantic registry; caller cannot self-register.
  // Future eligibility:
  //   registration = findCanonicalMeasurementMethodRegistration(canonicalMethodKey)
  //   && registration.targetEvent === TOP_LABEL_DIRECTIONAL_CORRECTNESS
  //   && registration.measurementScope === governed scope
  //   && caller target claim (if supplied) does not conflict
  // FORBIDDEN: string-only AUTHORIZED_MEASUREMENT_METHODS.includes(methodKey)
  // Caller-supplied targetEvent NEVER opens eligibility / never substitutes for registry binding.
  const registration = findCanonicalMeasurementMethodRegistration(canonicalMethodKey);
  const methodAuthorized = isAuthorizedMeasurementMethod(canonicalMethodKey);

  if (!methodAuthorized) {
    reasons.push('METHOD_NOT_AUTHORIZED');
  }

  if (methodAuthorized
    && registration != null
    && targetEvent != null
    && targetEvent !== registration.targetEvent) {
    reasons.push('TARGET_EVENT_NOT_BOUND_BY_REGISTRY');
  }

  if (kind === CONFIDENCE_KIND.CALIBRATED) {
    reasons.push('CALIBRATED_KIND_NOT_TITANGOLD_VERIFIED');
  }

  // v1 empty immutable registry ⇒ registration=null ⇒ measurementEligible always false.
  // Future-safe form binds registry-owned target/scope — not caller self-registration.
  const measurementEligible = structurallyPredictive
    && methodAuthorized
    && registration != null
    && registration.targetEvent === CALIBRATION_TARGET_EVENT_V1
    && registration.measurementScope === MEASUREMENT_SCOPE
    && (targetEvent == null || targetEvent === registration.targetEvent);

  if (!measurementEligible && structurallyPredictive) {
    if (!reasons.includes('METHOD_NOT_AUTHORIZED')) {
      reasons.push('METHOD_NOT_AUTHORIZED');
    }
    if (!reasons.includes('KIND_NECESSARY_NOT_SUFFICIENT')) {
      reasons.push('KIND_NECESSARY_NOT_SUFFICIENT');
    }
  }

  return freezeDeep({
    schemaVersion: CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION,
    contractVersion: CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION,
    policyVersion: CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION,
    artifactType: CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE,
    authorityClass: CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS,
    targetEvent: CALIBRATION_TARGET_EVENT_V1,
    structurallyPredictive,
    measurementEligible,
    ineligibilityIsNotZeroScore: true,
    confidenceKind: kind ?? null,
    scale: scale ?? null,
    normalizedUnitInterval: normalizedUnitInterval ?? null,
    methodKey: canonicalMethodKey ?? null,
    callerMethodKey: topLevelMethodKey ?? null,
    methodAuthorized,
    calibratedKindTitanGoldVerified: CALIBRATED_KIND_TITANGOLD_VERIFIED,
    measuredKindIsCalibrationResult: MEASURED_KIND_IS_CALIBRATION_RESULT,
    authorizedMeasurementMethods: AUTHORIZED_MEASUREMENT_METHODS,
    authorizedMeasurementMethodRegistry: AUTHORIZED_MEASUREMENT_METHOD_REGISTRY,
    currentProductionCalibrationEligibleProducers:
      CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS,
    binaryBrierExecution: BINARY_BRIER_EXECUTION,
    reasons: Object.freeze([...reasons]),
    calibrationObservationRef: calibrationObservationRef ?? null,
    hardFlags: Object.freeze({
      calibrationExecution: false,
      aggregateMeasurement: false,
      binaryBrierExecution: false,
      trustMutation: false,
      weightMutation: false,
      promotionExecution: false,
      demotionExecution: false,
      selfRegistration: false,
      metricInvention: false,
    }),
  });
}

export function isMeasurementEligiblePredictiveClaim(input) {
  return assessCalibrationMeasurementEligibility(input).measurementEligible === true;
}

// ─── Public API surface ──────────────────────────────────────────────────────
// Intentionally ABSENT (no execution-shaped stubs):
//   computeBrierScore, calculateBrier, scoreObservation, aggregateBrier, meanBrier
// Absence of an execution API is stronger than a throwing execution API.

export default Object.freeze({
  CALIBRATION_MEASUREMENT_POLICY_CONTRACT_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_SCHEMA_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_POLICY_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_IMPLEMENTATION_VERSION,
  CALIBRATION_MEASUREMENT_POLICY_ARTIFACT_TYPE,
  CALIBRATION_MEASUREMENT_POLICY_TYPE,
  CALIBRATION_MEASUREMENT_POLICY_AUTHORITY_CLASS,
  CALIBRATION_MEASUREMENT_POLICY_SLICE_ID,
  CALIBRATION_MEASUREMENT_POLICY_OFFICIAL_NAME,
  CALIBRATION_MEASUREMENT_POLICY_RISK_TIER,
  METHOD_REGISTRATION_OWNER,
  CALLER_SELF_REGISTRATION,
  CALIBRATION_TARGET_EVENT_V1,
  CALIBRATION_TARGET_EVENT_V1_SEMANTICS,
  TARGET_SEMANTICS_INFERRED_FROM_KIND,
  EXPLICIT_PROVENANCE_REQUIRED,
  AUTHORIZED_MEASUREMENT_METHODS,
  AUTHORIZED_MEASUREMENT_METHOD_REGISTRY,
  MEASUREMENT_METHOD_REGISTRATION_REQUIRED_FIELDS,
  MEASUREMENT_METHOD_REGISTRATION_SHAPE,
  AVAILABILITY_VALUES,
  PROVENANCE_AUTHORITY_FIELDS,
  PROVENANCE_NOTE_IS_AUTHORITY,
  CURRENT_PRODUCTION_CALIBRATION_ELIGIBLE_PRODUCERS,
  ALLOWED_PREDICTIVE_KINDS,
  ALLOWED_PREDICTIVE_KIND_VALUES,
  NON_MEASUREMENT_PROBABILITY_KINDS,
  NON_MEASUREMENT_PROBABILITY_KIND_VALUES,
  MEASURED_KIND_IS_CALIBRATION_RESULT,
  CALIBRATED_KIND_TITANGOLD_VERIFIED,
  BINARY_CORRECTNESS_MAPPING,
  MATCH_NUMERIC,
  MISMATCH_NUMERIC,
  USABLE_BINARY_EVALUATION_STATUSES,
  MEASUREMENT_DOMAIN,
  SCALE_NORMALIZATION_POLICY,
  CONFIDENCE_SCALE_VALUES,
  FIRST_ALLOWED_PROPER_SCORE,
  BINARY_BRIER_SCORE,
  BINARY_BRIER_FORMULA_SEMANTICS,
  BINARY_BRIER_EXECUTION,
  BINARY_BRIER_STANDALONE_CALIBRATION_VERDICT,
  BINARY_BRIER_SEMANTIC_DESCRIPTOR,
  ECE,
  RELIABILITY_CURVE,
  MULTICLASS_CALIBRATION,
  DEFERRED_METRIC_STATUS,
  REQUIRED_HARD_FLAGS,
  ZERO_CALIBRATION_MEASUREMENT_POLICY_SIDE_EFFECTS,
  CALIBRATION_MEASUREMENT_POLICY_DESCRIPTOR,
  CalibrationMeasurementPolicyContractError,
  getCalibrationMeasurementPolicyDescriptor,
  validateCalibrationMeasurementPolicyDescriptor,
  normalizeConfidenceToUnitInterval,
  mapBinaryCorrectnessTarget,
  findCanonicalMeasurementMethodRegistration,
  isAuthorizedMeasurementMethod,
  assessCalibrationMeasurementEligibility,
  isMeasurementEligiblePredictiveClaim,
});
