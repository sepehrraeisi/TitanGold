/**
 * Artemis WP-B.1 — canonical Agent → Artemis Evidence contract owner.
 * schemaVersion 1.0.0 / contractVersion artemis-evidence-1.0.0
 * Adapter versions are separate and must not bump this contract.
 *
 * Envelopes must contain canonical identity only. Alias normalization happens
 * before validation. Nested objects are allowlisted; secret-key scan is defense in depth.
 *
 * Identifier null/unavailable semantics (agentRecordId, runId, correlationId, decisionContextId):
 * - omitted or null → not present; allowed; not required
 * - RFC 4122 UUID string → canonical available identifier
 * - "unavailable" → explicit unavailable token
 * - { availability: "unavailable"|"not_applicable"|"blocked", reasonKey? } → structured unavailable
 * - any other string (foo, run-1, agent-N) → rejected
 */

export const SCHEMA_VERSION = '1.0.0';
export const CONTRACT_VERSION = 'artemis-evidence-1.0.0';
export const MAX_EVIDENCE_ITEMS = 32;
export const MAX_ENVELOPE_UTF8_BYTES = 8 * 1024;
export const MAX_EVIDENCE_VALUE_CHARS = 256;

export const ADAPTER_VERSIONS = Object.freeze({
  trend: '1.0.0',
  arbitrage: '1.0.0',
  volume: '1.0.0',
});

export const AUTHORITY_CLASS = Object.freeze({
  ANALYTICAL_EVIDENCE: 'analytical_evidence',
  OPPORTUNITY_FORECAST: 'opportunity_forecast',
  CONTROL_VETO: 'control_veto',
  CONTROL_SIZING: 'control_sizing',
  EXECUTION_FEASIBILITY: 'execution_feasibility',
  EXECUTION: 'execution',
  NOT_APPLICABLE: 'not_applicable',
});

export const EXECUTION_CLASS = Object.freeze({
  NONE: 'none',
  ADVISORY_ONLY: 'advisory_only',
  NOT_APPLICABLE: 'not_applicable',
});

export const FORBIDDEN_EXECUTION_CLASS = Object.freeze([
  'executable',
  'approved_for_execution',
  'requires_control_chain',
  'live',
]);

export const AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
  BLOCKED: 'blocked',
});

export const FRESHNESS_STATUS = Object.freeze({
  FRESH: 'fresh',
  AGED: 'aged',
  STALE: 'stale',
  EXPIRED: 'expired',
  UNKNOWN: 'unknown',
  UNAVAILABLE: 'unavailable',
});

export const CONFIDENCE_KIND = Object.freeze({
  MEASURED: 'MEASURED',
  MODEL_PROBABILITY: 'MODEL_PROBABILITY',
  CALIBRATED: 'CALIBRATED',
  HEURISTIC: 'HEURISTIC',
  RULE_SCORE: 'RULE_SCORE',
  DERIVED: 'DERIVED',
  LEGACY: 'LEGACY',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const CONFIDENCE_SCALE = Object.freeze({
  UNIT_INTERVAL: 'unit_interval',
  PERCENT_100: 'percent_100',
  UNKNOWN: 'unknown',
});

export const CALIBRATION_STATE = Object.freeze({
  UNCALIBRATED: 'uncalibrated',
  PENDING: 'pending',
  CALIBRATED: 'calibrated',
  NOT_APPLICABLE: 'not_applicable',
  UNAVAILABLE: 'unavailable',
});

export const STRENGTH_SCALE = Object.freeze({
  PERCENT_100: 'percent_100',
  UNIT_INTERVAL: 'unit_interval',
  UNKNOWN: 'unknown',
  NOT_APPLICABLE: 'not_applicable',
});

export const DATA_QUALITY_STATUS = Object.freeze({
  OK: 'ok',
  DEGRADED: 'degraded',
  INSUFFICIENT: 'insufficient',
  UNAVAILABLE: 'unavailable',
});

export const SOURCE_AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  DEGRADED: 'degraded',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const COMPLETENESS = Object.freeze({
  OK: 'ok',
  DEGRADED: 'degraded',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const SAMPLE_ADEQUACY = Object.freeze({
  OK: 'ok',
  INSUFFICIENT: 'insufficient',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const SAMPLE_WINDOW_UNIT = Object.freeze({
  CANDLES: 'candles',
  BARS: 'bars',
  SAMPLES: 'samples',
  MILLISECONDS: 'milliseconds',
  SECONDS: 'seconds',
  MINUTES: 'minutes',
  HOURS: 'hours',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const COVERAGE_UNIT = Object.freeze({
  RATIO: 'ratio',
  PERCENT: 'percent',
  COUNT: 'count',
  CANDLES: 'candles',
  SAMPLES: 'samples',
  NOT_APPLICABLE: 'not_applicable',
});

export const LIFECYCLE_STATUS = Object.freeze({
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL: 'partial',
  SKIPPED: 'skipped',
});

export const DIRECTION = Object.freeze({
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  SIDEWAYS: 'sideways',
  NEUTRAL: 'neutral',
  NOT_APPLICABLE: 'not_applicable',
  UNAVAILABLE: 'unavailable',
});

export const CORRELATION_FAMILY = Object.freeze({
  OHLCV_CANDLE: 'ohlcv_candle_family',
  MICROSTRUCTURE: 'microstructure_family',
  EXTERNAL_NARRATIVE: 'external_narrative_family',
  ACCOUNT_STATE: 'account_state_family',
  SPREAD_MONITOR: 'spread_monitor_family',
  EXECUTION_PATH: 'execution_path_family',
});

export const EVIDENCE_TYPE = Object.freeze({
  INDICATOR: 'indicator',
  PATTERN: 'pattern',
  SPREAD: 'spread',
  METRIC: 'metric',
  NARRATIVE: 'narrative',
  POLICY: 'policy',
  OTHER: 'other',
});

export const DIRECTIONAL_CONTRIBUTION = Object.freeze({
  SUPPORTS: 'supports',
  CONFLICTS: 'conflicts',
  NEUTRAL: 'neutral',
  NOT_APPLICABLE: 'not_applicable',
});

export const MARKET_TYPE = Object.freeze({
  SPOT: 'spot',
  FUTURES: 'futures',
  UNKNOWN: 'unknown',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const NEXT_ACTION_CLASS = Object.freeze({
  OBSERVE: 'observe',
  NONE: 'none',
  ADVISORY_ONLY: 'advisory_only',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const CONTROL_KIND = Object.freeze({
  VETO: 'veto',
  LIMIT: 'limit',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const CONTROL_OUTCOME = Object.freeze({
  REJECT: 'reject',
  LIMIT: 'limit',
  PASS: 'pass',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const OPPORTUNITY_KIND = Object.freeze({
  SPREAD: 'spread',
  FORECAST: 'forecast',
  TIMING_WINDOW: 'timing_window',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not_applicable',
});

export const AGENT_CONTRACT_ROLE = Object.freeze({
  technical: { agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
  trend: { agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
  pattern: { agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
  volume: { agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
  sentiment: { agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
  fundamental: { agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
  market_intelligence: { agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
  price_prediction: { agentRole: AUTHORITY_CLASS.OPPORTUNITY_FORECAST, authorityClass: AUTHORITY_CLASS.OPPORTUNITY_FORECAST },
  timing: { agentRole: AUTHORITY_CLASS.OPPORTUNITY_FORECAST, authorityClass: AUTHORITY_CLASS.OPPORTUNITY_FORECAST },
  arbitrage: { agentRole: AUTHORITY_CLASS.OPPORTUNITY_FORECAST, authorityClass: AUTHORITY_CLASS.OPPORTUNITY_FORECAST },
  risk: { agentRole: AUTHORITY_CLASS.CONTROL_VETO, authorityClass: AUTHORITY_CLASS.CONTROL_VETO },
  portfolio: { agentRole: AUTHORITY_CLASS.CONTROL_SIZING, authorityClass: AUTHORITY_CLASS.CONTROL_SIZING },
  optimization: { agentRole: AUTHORITY_CLASS.NOT_APPLICABLE, authorityClass: AUTHORITY_CLASS.NOT_APPLICABLE },
  liquidity: { agentRole: AUTHORITY_CLASS.EXECUTION_FEASIBILITY, authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY },
  order: { agentRole: AUTHORITY_CLASS.EXECUTION, authorityClass: AUTHORITY_CLASS.EXECUTION },
});

export const CANONICAL_AGENT_IDS = Object.freeze(Object.keys(AGENT_CONTRACT_ROLE));

export const ANALYTICAL_AGENT_IDS = Object.freeze([
  'technical', 'trend', 'pattern', 'volume', 'sentiment', 'fundamental', 'market_intelligence',
]);
export const OPPORTUNITY_AGENT_IDS = Object.freeze(['price_prediction', 'timing', 'arbitrage']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const FORBIDDEN_SECRET_KEY_RE = /^(api[_-]?key|api[_-]?secret|secret|password|token|jwt|authorization|auth[_-]?header|chat[_-]?id|signed[_-]?url|private[_-]?key)$/i;
const FORBIDDEN_RAW_PAYLOAD_KEYS = new Set(['input_data', 'output_data', 'metadata', 'input', 'output']);
const ANALYTICAL_DIRECTIONS = new Set(['bullish', 'bearish', 'sideways', 'neutral']);
const EXECUTION_SIGNALS = new Set(['BUY', 'SELL', 'EXECUTE', 'LONG', 'SHORT']);

const ALLOWED_TOP_LEVEL = new Set([
  'schemaVersion',
  'contractVersion',
  'adapterVersion',
  'agentId',
  'agentRecordId',
  'agentRole',
  'authorityClass',
  'runId',
  'correlationId',
  'decisionContextId',
  'ownershipScope',
  'provider',
  'venue',
  'marketType',
  'symbol',
  'baseAsset',
  'quoteAsset',
  'timeframe',
  'analysisHorizon',
  'analysisTimestamp',
  'sourceTimestamp',
  'sourceCandleTimestamp',
  'expiryTimestamp',
  'freshness',
  'provenance',
  'dataQuality',
  'availability',
  'unavailableReason',
  'lifecycleStatus',
  'limitations',
  'executionClass',
  'conclusion',
  'confidence',
  'evidence',
  'correlationFamily',
  'recommendedNextActionClass',
  'opportunity',
  'control',
  'allocation',
  'feasibility',
  'codeImplementationVersion',
  'modelAlgorithmVersion',
  'configurationVersion',
  'createdAt',
  'completedAt',
]);

const ALLOWED_CONCLUSION = new Set(['direction', 'regime', 'signal', 'strength']);
const ALLOWED_STRENGTH = new Set(['availability', 'value', 'scale', 'provenance', 'reasonKey']);
const ALLOWED_CONFIDENCE = new Set([
  'availability',
  'value',
  'scale',
  'kind',
  'calibrationState',
  'sampleWindow',
  'reasonKey',
  'provenance',
]);
const ALLOWED_CONFIDENCE_PROVENANCE = new Set(['writer', 'path', 'methodKey']);
const ALLOWED_SAMPLE_WINDOW = new Set(['availability', 'reasonKey', 'start', 'end', 'size', 'unit']);
const ALLOWED_FRESHNESS = new Set([
  'status',
  'reasonKey',
  'analysisTimestamp',
  'sourceTimestamp',
  'sourceCandleTimestamp',
  'policyId',
  'maxAgeMs',
  'timeframe',
  'ageMs',
]);
const ALLOWED_DATA_QUALITY = new Set([
  'status',
  'sourceAvailability',
  'coverage',
  'completeness',
  'staleness',
  'providerDegradation',
  'sampleAdequacy',
  'knownLimitationKeys',
]);
const ALLOWED_COVERAGE_MEASURED = new Set(['expected', 'observed', 'unit', 'reasonKey']);
const ALLOWED_PROVENANCE = new Set([
  'writer',
  'source',
  'adapterVersion',
  'note',
  'analyticalMode',
  'methodKey',
  'path',
]);
const ALLOWED_EVIDENCE = new Set(['items', 'counterItems']);
const ALLOWED_EVIDENCE_ITEM = new Set([
  'evidenceId',
  'evidenceType',
  'canonicalSource',
  'value',
  'unit',
  'directionalContribution',
  'interpretation',
  'timestamp',
  'freshness',
  'provenance',
  'quality',
  'limitation',
  'correlationFamily',
  'explanationKey',
]);
const ALLOWED_OWNERSHIP_SCOPE = new Set(['userId', 'tenantId', 'scopeType']);
const ALLOWED_UNAVAILABLE_OBJECT = new Set(['availability', 'reasonKey']);
const ALLOWED_OPPORTUNITY = new Set(['kind', 'availability', 'horizon', 'expiryTimestamp', 'reasonKey', 'invalidatingConditionKeys']);
const ALLOWED_CONTROL = new Set(['kind', 'availability', 'outcome', 'reasonKey', 'limitationKey']);
const ALLOWED_ALLOCATION = new Set(['availability', 'reasonKey', 'unit', 'min', 'max', 'recommended']);
const ALLOWED_FEASIBILITY = new Set([
  'availability',
  'reasonKey',
  'spread',
  'depth',
  'slippage',
  'maxFeasibleSize',
  'bookTimestamp',
  'expiryTimestamp',
]);
const FEASIBILITY_MEASURED_KEYS = ['spread', 'depth', 'slippage', 'maxFeasibleSize', 'bookTimestamp', 'expiryTimestamp'];
const IDENTIFIER_FIELDS = ['agentRecordId', 'runId', 'correlationId', 'decisionContextId'];

export function isCanonicalUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function isUnavailableRepresentation(value) {
  if (value == null) return false;
  if (value === 'unavailable' || value === 'not_applicable' || value === 'blocked') return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (!keys.length || keys.some((key) => !ALLOWED_UNAVAILABLE_OBJECT.has(key))) return false;
  return inEnum(value.availability, AVAILABILITY) && value.availability !== AVAILABILITY.AVAILABLE;
}

export function canonicalIdentifier(value, reasonKey = 'non_canonical_identifier') {
  if (value == null || value === '') return null;
  if (isUnavailableRepresentation(value)) return value;
  if (isCanonicalUuid(value)) return String(value).trim().toLowerCase();
  return { availability: AVAILABILITY.UNAVAILABLE, reasonKey };
}

export function collectForbiddenSecretKeys(value, acc = []) {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenSecretKeys(item, acc));
    return acc;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_SECRET_KEY_RE.test(key) || FORBIDDEN_RAW_PAYLOAD_KEYS.has(key)) acc.push(key);
    collectForbiddenSecretKeys(nested, acc);
  }
  return acc;
}

export function utf8ByteLength(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
}

export function isIsoTimestamp(value) {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function inEnum(value, table) {
  return Object.values(table).includes(value);
}

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function rejectUnknownFields(obj, allowed, field, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const unknown = Object.keys(obj).filter((key) => !allowed.has(key));
  if (unknown.length) {
    errors.push({ field, code: 'unknown_field', fields: unknown });
    return true;
  }
  return false;
}

function optionalString(field, value, errors) {
  if (value == null) return;
  if (typeof value !== 'string' || !value.trim()) {
    errors.push({ field, code: 'invalid_string' });
  }
}

function optionalNullableString(field, value, errors) {
  if (value == null) return;
  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid_string' });
  }
}

function assertIsoOptional(field, value, errors) {
  if (value == null) return;
  if (isUnavailableRepresentation(value)) return;
  if (!isIsoTimestamp(value)) errors.push({ field, code: 'invalid_timestamp' });
}

function validateIdentifier(field, value, errors) {
  if (value == null) return;
  if (isUnavailableRepresentation(value)) {
    if (typeof value === 'object') rejectUnknownFields(value, ALLOWED_UNAVAILABLE_OBJECT, field, errors);
    return;
  }
  if (!isCanonicalUuid(value)) {
    errors.push({ field, code: 'invalid_uuid_identifier' });
  }
}

function validateOwnershipScope(scope, errors) {
  if (scope == null) return;
  if (typeof scope === 'string') {
    if (!scope.trim()) errors.push({ field: 'ownershipScope', code: 'invalid_ownership_scope' });
    return;
  }
  if (typeof scope !== 'object' || Array.isArray(scope)) {
    errors.push({ field: 'ownershipScope', code: 'invalid_ownership_scope' });
    return;
  }
  rejectUnknownFields(scope, ALLOWED_OWNERSHIP_SCOPE, 'ownershipScope', errors);
  optionalString('ownershipScope.userId', scope.userId, errors);
  optionalString('ownershipScope.tenantId', scope.tenantId, errors);
  optionalString('ownershipScope.scopeType', scope.scopeType, errors);
}

function validateStrength(strength, errors) {
  if (strength == null) return;
  if (typeof strength !== 'object' || Array.isArray(strength)) {
    errors.push({ field: 'conclusion.strength', code: 'invalid_strength' });
    return;
  }
  rejectUnknownFields(strength, ALLOWED_STRENGTH, 'conclusion.strength', errors);
  if (strength.availability === 'unavailable' || strength.availability === 'not_applicable') {
    if (strength.availability != null && !['available', 'unavailable', 'not_applicable'].includes(strength.availability)) {
      errors.push({ field: 'conclusion.strength.availability', code: 'invalid_strength_availability' });
    }
    optionalString('conclusion.strength.reasonKey', strength.reasonKey, errors);
    if (strength.scale != null && !inEnum(strength.scale, STRENGTH_SCALE)) {
      errors.push({ field: 'conclusion.strength.scale', code: 'invalid_strength_scale' });
    }
    if (strength.provenance != null && typeof strength.provenance !== 'string') {
      errors.push({ field: 'conclusion.strength.provenance', code: 'invalid_strength_provenance' });
    }
    return;
  }
  if (typeof strength.value !== 'number' || !Number.isFinite(strength.value)) {
    errors.push({ field: 'conclusion.strength.value', code: 'invalid_strength_value' });
  }
  if (!inEnum(strength.scale, STRENGTH_SCALE)) {
    errors.push({ field: 'conclusion.strength.scale', code: 'invalid_strength_scale' });
  }
  if (strength.provenance != null && typeof strength.provenance !== 'string') {
    errors.push({ field: 'conclusion.strength.provenance', code: 'invalid_strength_provenance' });
  }
}

function validateSampleWindow(window, errors, field = 'confidence.sampleWindow') {
  if (window == null) return;
  if (typeof window !== 'object' || Array.isArray(window)) {
    errors.push({ field, code: 'invalid_sample_window' });
    return;
  }
  rejectUnknownFields(window, ALLOWED_SAMPLE_WINDOW, field, errors);
  if (window.availability != null && !inEnum(window.availability, AVAILABILITY)) {
    errors.push({ field: `${field}.availability`, code: 'invalid_sample_window_availability' });
    return;
  }
  optionalString(`${field}.reasonKey`, window.reasonKey, errors);
  const unavailable = window.availability && window.availability !== AVAILABILITY.AVAILABLE;
  if (unavailable) {
    if (window.start != null || window.end != null || window.size != null || (window.unit != null && window.unit !== SAMPLE_WINDOW_UNIT.UNAVAILABLE && window.unit !== SAMPLE_WINDOW_UNIT.NOT_APPLICABLE)) {
      errors.push({ field, code: 'sample_window_unavailable_must_not_include_measured_fields' });
    }
    return;
  }
  if (window.availability === AVAILABILITY.AVAILABLE) {
    assertIsoOptional(`${field}.start`, window.start, errors);
    assertIsoOptional(`${field}.end`, window.end, errors);
    if (window.size == null || !Number.isInteger(window.size) || window.size < 0) {
      errors.push({ field: `${field}.size`, code: 'invalid_sample_window_size' });
    }
    if (!inEnum(window.unit, SAMPLE_WINDOW_UNIT) || window.unit === SAMPLE_WINDOW_UNIT.UNAVAILABLE) {
      errors.push({ field: `${field}.unit`, code: 'invalid_sample_window_unit' });
    }
  }
}

function validateConfidenceProvenance(provenance, errors, field = 'confidence.provenance') {
  if (provenance == null) return;
  if (typeof provenance === 'string') {
    if (!provenance.trim()) errors.push({ field, code: 'invalid_confidence_provenance' });
    return;
  }
  if (typeof provenance !== 'object' || Array.isArray(provenance)) {
    errors.push({ field, code: 'invalid_confidence_provenance' });
    return;
  }
  rejectUnknownFields(provenance, ALLOWED_CONFIDENCE_PROVENANCE, field, errors);
  optionalString(`${field}.writer`, provenance.writer, errors);
  optionalString(`${field}.path`, provenance.path, errors);
  optionalString(`${field}.methodKey`, provenance.methodKey, errors);
}

function validateConfidence(confidence, errors) {
  if (confidence == null) {
    errors.push({ field: 'confidence', code: 'confidence_required' });
    return;
  }
  if (typeof confidence !== 'object' || Array.isArray(confidence)) {
    errors.push({ field: 'confidence', code: 'invalid_confidence' });
    return;
  }
  rejectUnknownFields(confidence, ALLOWED_CONFIDENCE, 'confidence', errors);
  if (!['available', 'unavailable'].includes(confidence.availability)) {
    errors.push({ field: 'confidence.availability', code: 'invalid_confidence_availability' });
    return;
  }
  if (confidence.calibrationState != null && !inEnum(confidence.calibrationState, CALIBRATION_STATE)) {
    errors.push({ field: 'confidence.calibrationState', code: 'invalid_calibration_state' });
  }
  validateSampleWindow(confidence.sampleWindow, errors);
  validateConfidenceProvenance(confidence.provenance, errors);
  if (confidence.availability === 'unavailable') {
    if (!inEnum(confidence.kind || CONFIDENCE_KIND.UNAVAILABLE, CONFIDENCE_KIND)) {
      errors.push({ field: 'confidence.kind', code: 'invalid_confidence_kind' });
    }
    if (confidence.scale != null && !inEnum(confidence.scale, CONFIDENCE_SCALE)) {
      errors.push({ field: 'confidence.scale', code: 'invalid_confidence_scale' });
    }
    optionalString('confidence.reasonKey', confidence.reasonKey, errors);
    return;
  }
  if (typeof confidence.value !== 'number' || !Number.isFinite(confidence.value)) {
    errors.push({ field: 'confidence.value', code: 'invalid_confidence_value' });
  }
  if (!inEnum(confidence.scale, CONFIDENCE_SCALE)) {
    errors.push({ field: 'confidence.scale', code: 'invalid_confidence_scale' });
  }
  if (!inEnum(confidence.kind, CONFIDENCE_KIND) || confidence.kind === CONFIDENCE_KIND.UNAVAILABLE) {
    errors.push({ field: 'confidence.kind', code: 'invalid_confidence_kind' });
  }
}

function validateFreshness(freshness, errors, field = 'freshness', { required = true } = {}) {
  if (freshness == null) {
    if (required) errors.push({ field, code: 'freshness_required' });
    return;
  }
  if (isUnavailableRepresentation(freshness)) {
    if (typeof freshness === 'object') rejectUnknownFields(freshness, ALLOWED_UNAVAILABLE_OBJECT, field, errors);
    return;
  }
  if (typeof freshness === 'string') {
    if (!inEnum(freshness, FRESHNESS_STATUS)) errors.push({ field, code: 'invalid_freshness_status' });
    return;
  }
  if (typeof freshness !== 'object' || Array.isArray(freshness)) {
    errors.push({ field, code: 'invalid_freshness' });
    return;
  }
  rejectUnknownFields(freshness, ALLOWED_FRESHNESS, field, errors);
  if (!inEnum(freshness.status, FRESHNESS_STATUS)) {
    errors.push({ field: `${field}.status`, code: 'invalid_freshness_status' });
  }
  optionalString(`${field}.reasonKey`, freshness.reasonKey, errors);
  optionalString(`${field}.policyId`, freshness.policyId, errors);
  optionalNullableString(`${field}.timeframe`, freshness.timeframe, errors);
  assertIsoOptional(`${field}.analysisTimestamp`, freshness.analysisTimestamp, errors);
  assertIsoOptional(`${field}.sourceTimestamp`, freshness.sourceTimestamp, errors);
  assertIsoOptional(`${field}.sourceCandleTimestamp`, freshness.sourceCandleTimestamp, errors);
  if (freshness.maxAgeMs != null && (typeof freshness.maxAgeMs !== 'number' || !Number.isFinite(freshness.maxAgeMs))) {
    errors.push({ field: `${field}.maxAgeMs`, code: 'invalid_freshness_max_age' });
  }
  if (freshness.ageMs != null && (typeof freshness.ageMs !== 'number' || !Number.isFinite(freshness.ageMs))) {
    errors.push({ field: `${field}.ageMs`, code: 'invalid_freshness_age' });
  }
}

function validateCoverage(coverage, errors, field = 'dataQuality.coverage') {
  if (coverage == null) return;
  if (isUnavailableRepresentation(coverage)) {
    if (typeof coverage === 'object') rejectUnknownFields(coverage, ALLOWED_UNAVAILABLE_OBJECT, field, errors);
    return;
  }
  if (typeof coverage !== 'object' || Array.isArray(coverage)) {
    errors.push({ field, code: 'invalid_coverage' });
    return;
  }
  rejectUnknownFields(coverage, ALLOWED_COVERAGE_MEASURED, field, errors);
  if (typeof coverage.expected !== 'number' || !Number.isFinite(coverage.expected) || coverage.expected < 0) {
    errors.push({ field: `${field}.expected`, code: 'invalid_coverage_expected' });
  }
  if (typeof coverage.observed !== 'number' || !Number.isFinite(coverage.observed) || coverage.observed < 0) {
    errors.push({ field: `${field}.observed`, code: 'invalid_coverage_observed' });
  }
  if (!inEnum(coverage.unit, COVERAGE_UNIT)) {
    errors.push({ field: `${field}.unit`, code: 'invalid_coverage_unit' });
  }
  optionalString(`${field}.reasonKey`, coverage.reasonKey, errors);
}

function validateProviderDegradation(value, errors, field = 'dataQuality.providerDegradation') {
  if (value == null) return;
  if (typeof value === 'boolean') return;
  if (isUnavailableRepresentation(value)) {
    if (typeof value === 'object') rejectUnknownFields(value, ALLOWED_UNAVAILABLE_OBJECT, field, errors);
    return;
  }
  errors.push({ field, code: 'invalid_provider_degradation' });
}

function validateStaleness(value, errors, field = 'dataQuality.staleness') {
  if (value == null) return;
  if (isUnavailableRepresentation(value)) {
    if (typeof value === 'object') rejectUnknownFields(value, ALLOWED_UNAVAILABLE_OBJECT, field, errors);
    return;
  }
  if (!inEnum(value, FRESHNESS_STATUS)) {
    errors.push({ field, code: 'invalid_data_quality_staleness' });
  }
}

function validateDataQuality(dataQuality, errors) {
  if (!dataQuality || typeof dataQuality !== 'object' || Array.isArray(dataQuality)) {
    errors.push({ field: 'dataQuality', code: 'data_quality_required' });
    return;
  }
  rejectUnknownFields(dataQuality, ALLOWED_DATA_QUALITY, 'dataQuality', errors);
  if (!inEnum(dataQuality.status, DATA_QUALITY_STATUS)) {
    errors.push({ field: 'dataQuality.status', code: 'invalid_data_quality_status' });
  }
  if (dataQuality.sourceAvailability != null && !inEnum(dataQuality.sourceAvailability, SOURCE_AVAILABILITY)) {
    errors.push({ field: 'dataQuality.sourceAvailability', code: 'invalid_source_availability' });
  }
  if (dataQuality.completeness != null && !inEnum(dataQuality.completeness, COMPLETENESS)) {
    errors.push({ field: 'dataQuality.completeness', code: 'invalid_completeness' });
  }
  if (dataQuality.sampleAdequacy != null && !inEnum(dataQuality.sampleAdequacy, SAMPLE_ADEQUACY)) {
    errors.push({ field: 'dataQuality.sampleAdequacy', code: 'invalid_sample_adequacy' });
  }
  validateCoverage(dataQuality.coverage, errors);
  validateStaleness(dataQuality.staleness, errors);
  validateProviderDegradation(dataQuality.providerDegradation, errors);
  if (dataQuality.knownLimitationKeys != null) {
    if (!Array.isArray(dataQuality.knownLimitationKeys) || dataQuality.knownLimitationKeys.some((item) => typeof item !== 'string')) {
      errors.push({ field: 'dataQuality.knownLimitationKeys', code: 'invalid_known_limitation_keys' });
    }
  }
}

function validateProvenance(provenance, errors, field = 'provenance', { required = true } = {}) {
  if (provenance == null) {
    if (required) errors.push({ field, code: 'provenance_required' });
    return;
  }
  if (isUnavailableRepresentation(provenance)) {
    if (typeof provenance === 'object') rejectUnknownFields(provenance, ALLOWED_UNAVAILABLE_OBJECT, field, errors);
    return;
  }
  if (typeof provenance === 'string') {
    if (!provenance.trim()) errors.push({ field, code: 'invalid_provenance' });
    return;
  }
  if (typeof provenance !== 'object' || Array.isArray(provenance)) {
    errors.push({ field, code: 'invalid_provenance' });
    return;
  }
  rejectUnknownFields(provenance, ALLOWED_PROVENANCE, field, errors);
  optionalString(`${field}.writer`, provenance.writer, errors);
  optionalString(`${field}.source`, provenance.source, errors);
  optionalString(`${field}.adapterVersion`, provenance.adapterVersion, errors);
  optionalNullableString(`${field}.note`, provenance.note, errors);
  optionalNullableString(`${field}.analyticalMode`, provenance.analyticalMode, errors);
  optionalString(`${field}.methodKey`, provenance.methodKey, errors);
  optionalString(`${field}.path`, provenance.path, errors);
}

function validateEvidenceItems(items, field, errors) {
  if (items == null) return;
  if (!Array.isArray(items)) {
    errors.push({ field, code: 'invalid_evidence_items' });
    return;
  }
  if (items.length > MAX_EVIDENCE_ITEMS) {
    errors.push({ field, code: 'evidence_item_limit', limit: MAX_EVIDENCE_ITEMS, count: items.length });
  }
  for (const [i, item] of items.entries()) {
    const prefix = `${field}[${i}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push({ field: prefix, code: 'invalid_evidence_item' });
      continue;
    }
    rejectUnknownFields(item, ALLOWED_EVIDENCE_ITEM, prefix, errors);
    if (!item.evidenceId || typeof item.evidenceId !== 'string') {
      errors.push({ field: `${prefix}.evidenceId`, code: 'invalid_evidence_id' });
    }
    if (!inEnum(item.evidenceType, EVIDENCE_TYPE)) {
      errors.push({ field: `${prefix}.evidenceType`, code: 'invalid_evidence_type' });
    }
    if (!item.canonicalSource || typeof item.canonicalSource !== 'string') {
      errors.push({ field: `${prefix}.canonicalSource`, code: 'invalid_canonical_source' });
    }
    if (!inEnum(item.directionalContribution, DIRECTIONAL_CONTRIBUTION)) {
      errors.push({ field: `${prefix}.directionalContribution`, code: 'invalid_directional_contribution' });
    }
    if (item.value != null && typeof item.value === 'string' && item.value.length > MAX_EVIDENCE_VALUE_CHARS) {
      errors.push({ field: `${prefix}.value`, code: 'evidence_value_too_long' });
    }
    if (item.value != null && typeof item.value === 'object') {
      errors.push({ field: `${prefix}.value`, code: 'nested_evidence_value_forbidden' });
    }
    if (item.value != null && typeof item.value !== 'string' && typeof item.value !== 'number' && typeof item.value !== 'boolean') {
      errors.push({ field: `${prefix}.value`, code: 'invalid_evidence_value' });
    }
    optionalString(`${prefix}.unit`, item.unit, errors);
    optionalString(`${prefix}.interpretation`, item.interpretation, errors);
    optionalString(`${prefix}.limitation`, item.limitation, errors);
    optionalString(`${prefix}.explanationKey`, item.explanationKey, errors);
    if (item.quality != null && !inEnum(item.quality, DATA_QUALITY_STATUS) && !isUnavailableRepresentation(item.quality)) {
      errors.push({ field: `${prefix}.quality`, code: 'invalid_item_quality' });
    }
    assertIsoOptional(`${prefix}.timestamp`, item.timestamp, errors);
    if (item.correlationFamily != null && !inEnum(item.correlationFamily, CORRELATION_FAMILY)) {
      errors.push({ field: `${prefix}.correlationFamily`, code: 'invalid_correlation_family' });
    }
    validateFreshness(item.freshness, errors, `${prefix}.freshness`, { required: false });
    validateProvenance(item.provenance, errors, `${prefix}.provenance`, { required: false });
  }
}

function validateEvidence(evidence, errors) {
  if (evidence == null) return;
  if (typeof evidence !== 'object' || Array.isArray(evidence)) {
    errors.push({ field: 'evidence', code: 'invalid_evidence' });
    return;
  }
  rejectUnknownFields(evidence, ALLOWED_EVIDENCE, 'evidence', errors);
  const items = evidence.items;
  const counter = evidence.counterItems;
  const totalItems = (Array.isArray(items) ? items.length : 0) + (Array.isArray(counter) ? counter.length : 0);
  if (totalItems > MAX_EVIDENCE_ITEMS) {
    errors.push({ field: 'evidence', code: 'evidence_item_limit', limit: MAX_EVIDENCE_ITEMS, count: totalItems });
  }
  validateEvidenceItems(items, 'evidence.items', errors);
  validateEvidenceItems(counter, 'evidence.counterItems', errors);
}

function validateConclusion(conclusion, errors) {
  if (conclusion == null) return;
  if (typeof conclusion !== 'object' || Array.isArray(conclusion)) {
    errors.push({ field: 'conclusion', code: 'invalid_conclusion' });
    return;
  }
  rejectUnknownFields(conclusion, ALLOWED_CONCLUSION, 'conclusion', errors);
  if (conclusion.direction != null && !inEnum(conclusion.direction, DIRECTION)) {
    errors.push({ field: 'conclusion.direction', code: 'invalid_direction' });
  }
  optionalString('conclusion.regime', conclusion.regime, errors);
  optionalNullableString('conclusion.signal', conclusion.signal, errors);
  validateStrength(conclusion.strength, errors);
}

function hasAnalyticalMarketVote(conclusion) {
  if (!conclusion || typeof conclusion !== 'object') return false;
  if (ANALYTICAL_DIRECTIONS.has(conclusion.direction)) return true;
  const signal = String(conclusion.signal || '').trim().toUpperCase();
  return EXECUTION_SIGNALS.has(signal);
}

function validateOpportunity(opportunity, errors) {
  if (opportunity == null) return;
  if (typeof opportunity !== 'object' || Array.isArray(opportunity)) {
    errors.push({ field: 'opportunity', code: 'invalid_opportunity' });
    return;
  }
  rejectUnknownFields(opportunity, ALLOWED_OPPORTUNITY, 'opportunity', errors);
  if (opportunity.availability != null && !inEnum(opportunity.availability, AVAILABILITY)) {
    errors.push({ field: 'opportunity.availability', code: 'invalid_opportunity_availability' });
  }
  if (opportunity.kind != null && !inEnum(opportunity.kind, OPPORTUNITY_KIND)) {
    errors.push({ field: 'opportunity.kind', code: 'invalid_opportunity_kind' });
  }
  optionalString('opportunity.horizon', opportunity.horizon, errors);
  optionalString('opportunity.reasonKey', opportunity.reasonKey, errors);
  assertIsoOptional('opportunity.expiryTimestamp', opportunity.expiryTimestamp, errors);
  if (opportunity.invalidatingConditionKeys != null) {
    if (!Array.isArray(opportunity.invalidatingConditionKeys) || opportunity.invalidatingConditionKeys.some((item) => typeof item !== 'string')) {
      errors.push({ field: 'opportunity.invalidatingConditionKeys', code: 'invalid_invalidating_conditions' });
    }
  }
}

function validateControl(control, errors) {
  if (control == null) return;
  if (typeof control !== 'object' || Array.isArray(control)) {
    errors.push({ field: 'control', code: 'invalid_control' });
    return;
  }
  rejectUnknownFields(control, ALLOWED_CONTROL, 'control', errors);
  if (control.availability != null && !inEnum(control.availability, AVAILABILITY)) {
    errors.push({ field: 'control.availability', code: 'invalid_control_availability' });
  }
  if (control.kind != null && !inEnum(control.kind, CONTROL_KIND)) {
    errors.push({ field: 'control.kind', code: 'invalid_control_kind' });
  }
  if (control.outcome != null && !inEnum(control.outcome, CONTROL_OUTCOME)) {
    errors.push({ field: 'control.outcome', code: 'invalid_control_outcome' });
  }
  optionalString('control.reasonKey', control.reasonKey, errors);
  optionalString('control.limitationKey', control.limitationKey, errors);
}

function validateAllocation(allocation, errors) {
  if (allocation == null) return;
  if (typeof allocation !== 'object' || Array.isArray(allocation)) {
    errors.push({ field: 'allocation', code: 'invalid_allocation' });
    return;
  }
  rejectUnknownFields(allocation, ALLOWED_ALLOCATION, 'allocation', errors);
  if (allocation.availability != null && !inEnum(allocation.availability, AVAILABILITY)) {
    errors.push({ field: 'allocation.availability', code: 'invalid_allocation_availability' });
  }
  optionalString('allocation.reasonKey', allocation.reasonKey, errors);
  optionalString('allocation.unit', allocation.unit, errors);
  const unavailable = allocation.availability && allocation.availability !== AVAILABILITY.AVAILABLE;
  if (unavailable && (allocation.min != null || allocation.max != null || allocation.recommended != null)) {
    errors.push({ field: 'allocation', code: 'allocation_unavailable_must_not_include_measured_fields' });
  }
  for (const key of ['min', 'max', 'recommended']) {
    if (allocation[key] != null && (typeof allocation[key] !== 'number' || !Number.isFinite(allocation[key]))) {
      errors.push({ field: `allocation.${key}`, code: 'invalid_allocation_number' });
    }
  }
}

function validateFeasibility(feasibility, errors) {
  if (feasibility == null) return;
  if (typeof feasibility !== 'object' || Array.isArray(feasibility)) {
    errors.push({ field: 'feasibility', code: 'invalid_feasibility' });
    return;
  }
  rejectUnknownFields(feasibility, ALLOWED_FEASIBILITY, 'feasibility', errors);
  if (feasibility.availability != null && !inEnum(feasibility.availability, AVAILABILITY)) {
    errors.push({ field: 'feasibility.availability', code: 'invalid_feasibility_availability' });
  }
  optionalString('feasibility.reasonKey', feasibility.reasonKey, errors);
  const unavailable = !feasibility.availability || feasibility.availability !== AVAILABILITY.AVAILABLE;
  if (unavailable) {
    const measured = FEASIBILITY_MEASURED_KEYS.filter((key) => feasibility[key] != null);
    if (measured.length) {
      errors.push({ field: 'feasibility', code: 'feasibility_unavailable_must_not_include_measured_fields', fields: measured });
    }
    return;
  }
  assertIsoOptional('feasibility.bookTimestamp', feasibility.bookTimestamp, errors);
  assertIsoOptional('feasibility.expiryTimestamp', feasibility.expiryTimestamp, errors);
  for (const key of ['spread', 'depth', 'slippage', 'maxFeasibleSize']) {
    if (feasibility[key] != null && (typeof feasibility[key] !== 'number' || !Number.isFinite(feasibility[key]))) {
      errors.push({ field: `feasibility.${key}`, code: 'invalid_feasibility_number' });
    }
  }
}

function validateRoleSemantics(envelope, errors) {
  const role = envelope.authorityClass;
  const conclusion = envelope.conclusion;

  if (envelope.opportunity != null && role !== AUTHORITY_CLASS.OPPORTUNITY_FORECAST) {
    errors.push({ field: 'opportunity', code: 'role_extension_mismatch' });
  }
  if (envelope.control != null && role !== AUTHORITY_CLASS.CONTROL_VETO) {
    errors.push({ field: 'control', code: 'role_extension_mismatch' });
  }
  if (envelope.allocation != null && role !== AUTHORITY_CLASS.CONTROL_SIZING) {
    errors.push({ field: 'allocation', code: 'role_extension_mismatch' });
  }
  if (envelope.feasibility != null && role !== AUTHORITY_CLASS.EXECUTION_FEASIBILITY) {
    errors.push({ field: 'feasibility', code: 'role_extension_mismatch' });
  }

  validateOpportunity(envelope.opportunity, errors);
  validateControl(envelope.control, errors);
  validateAllocation(envelope.allocation, errors);
  validateFeasibility(envelope.feasibility, errors);

  if (role === AUTHORITY_CLASS.ANALYTICAL_EVIDENCE) return;

  if (role === AUTHORITY_CLASS.OPPORTUNITY_FORECAST) {
    if (envelope.agentId === 'arbitrage' && hasAnalyticalMarketVote(conclusion)) {
      errors.push({ field: 'conclusion', code: 'arbitrage_not_directional_vote' });
    }
    return;
  }

  if (hasAnalyticalMarketVote(conclusion)) {
    errors.push({ field: 'conclusion', code: 'role_analytical_vote_forbidden' });
  }
}

export function validateEvidenceEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return fail('invalid_envelope', 'Envelope must be a plain object');
  }

  const unknown = Object.keys(envelope).filter((key) => !ALLOWED_TOP_LEVEL.has(key));
  if (unknown.length) {
    return fail('unknown_field', 'Unknown top-level fields are rejected', { fields: unknown });
  }

  const errors = [];

  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'bad_schema_version', expected: SCHEMA_VERSION });
  }
  if (envelope.contractVersion !== CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'bad_contract_version', expected: CONTRACT_VERSION });
  }
  if (envelope.adapterVersion != null) {
    if (typeof envelope.adapterVersion !== 'string' || !SEMVER_RE.test(envelope.adapterVersion)) {
      errors.push({ field: 'adapterVersion', code: 'invalid_adapter_version' });
    }
  }

  if (!envelope.agentId || typeof envelope.agentId !== 'string') {
    errors.push({ field: 'agentId', code: 'invalid_agent_id' });
  } else if (!Object.prototype.hasOwnProperty.call(AGENT_CONTRACT_ROLE, envelope.agentId)) {
    errors.push({ field: 'agentId', code: 'unknown_agent_id' });
  }

  if (!inEnum(envelope.agentRole, AUTHORITY_CLASS)) {
    errors.push({ field: 'agentRole', code: 'invalid_agent_role' });
  }
  if (!inEnum(envelope.authorityClass, AUTHORITY_CLASS)) {
    errors.push({ field: 'authorityClass', code: 'invalid_authority_class' });
  }

  const expectedRole = AGENT_CONTRACT_ROLE[envelope.agentId];
  if (expectedRole) {
    if (envelope.agentRole !== expectedRole.agentRole || envelope.authorityClass !== expectedRole.authorityClass) {
      errors.push({ field: 'authorityClass', code: 'authority_mismatch', expected: expectedRole });
    }
  }

  for (const field of IDENTIFIER_FIELDS) {
    validateIdentifier(field, envelope[field], errors);
  }
  optionalNullableString('symbol', envelope.symbol, errors);
  optionalNullableString('timeframe', envelope.timeframe, errors);
  optionalNullableString('provider', envelope.provider, errors);
  optionalNullableString('venue', envelope.venue, errors);
  optionalNullableString('baseAsset', envelope.baseAsset, errors);
  optionalNullableString('quoteAsset', envelope.quoteAsset, errors);
  optionalNullableString('analysisHorizon', envelope.analysisHorizon, errors);
  optionalNullableString('unavailableReason', envelope.unavailableReason, errors);
  optionalString('codeImplementationVersion', envelope.codeImplementationVersion, errors);
  optionalString('modelAlgorithmVersion', envelope.modelAlgorithmVersion, errors);
  optionalString('configurationVersion', envelope.configurationVersion, errors);
  validateOwnershipScope(envelope.ownershipScope, errors);

  if (envelope.marketType != null && !inEnum(envelope.marketType, MARKET_TYPE)) {
    errors.push({ field: 'marketType', code: 'invalid_market_type' });
  }
  if (envelope.correlationFamily != null && !inEnum(envelope.correlationFamily, CORRELATION_FAMILY)) {
    errors.push({ field: 'correlationFamily', code: 'invalid_correlation_family' });
  }
  if (envelope.recommendedNextActionClass != null && !inEnum(envelope.recommendedNextActionClass, NEXT_ACTION_CLASS)) {
    errors.push({ field: 'recommendedNextActionClass', code: 'invalid_next_action_class' });
  }

  if (!inEnum(envelope.availability, AVAILABILITY)) {
    errors.push({ field: 'availability', code: 'invalid_availability' });
  }
  if (envelope.availability !== AVAILABILITY.AVAILABLE && !envelope.unavailableReason) {
    errors.push({ field: 'unavailableReason', code: 'unavailable_reason_required' });
  }
  if (!inEnum(envelope.lifecycleStatus, LIFECYCLE_STATUS)) {
    errors.push({ field: 'lifecycleStatus', code: 'invalid_lifecycle_status' });
  }
  if (!Array.isArray(envelope.limitations) || envelope.limitations.some((item) => typeof item !== 'string')) {
    errors.push({ field: 'limitations', code: 'limitations_required' });
  }
  if (!inEnum(envelope.executionClass, EXECUTION_CLASS)) {
    errors.push({ field: 'executionClass', code: 'invalid_execution_class' });
  }
  if (FORBIDDEN_EXECUTION_CLASS.includes(envelope.executionClass)) {
    errors.push({ field: 'executionClass', code: 'forbidden_execution_semantics' });
  }
  if (envelope.approvedForExecution === true || envelope.executionEligible === true) {
    errors.push({ field: 'execution', code: 'forbidden_execution_semantics' });
  }

  if (!isIsoTimestamp(envelope.analysisTimestamp)) {
    errors.push({ field: 'analysisTimestamp', code: 'invalid_timestamp' });
  }
  assertIsoOptional('sourceTimestamp', envelope.sourceTimestamp, errors);
  assertIsoOptional('sourceCandleTimestamp', envelope.sourceCandleTimestamp, errors);
  assertIsoOptional('expiryTimestamp', envelope.expiryTimestamp, errors);
  assertIsoOptional('createdAt', envelope.createdAt, errors);
  assertIsoOptional('completedAt', envelope.completedAt, errors);

  validateFreshness(envelope.freshness, errors);
  validateDataQuality(envelope.dataQuality, errors);
  validateProvenance(envelope.provenance, errors);
  validateConclusion(envelope.conclusion, errors);
  validateConfidence(envelope.confidence, errors);
  validateEvidence(envelope.evidence, errors);
  validateRoleSemantics(envelope, errors);

  const secretKeys = collectForbiddenSecretKeys(envelope);
  if (secretKeys.length) {
    errors.push({ field: 'envelope', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  const bytes = utf8ByteLength(envelope);
  if (bytes > MAX_ENVELOPE_UTF8_BYTES) {
    errors.push({ field: 'envelope', code: 'envelope_too_large', bytes, limit: MAX_ENVELOPE_UTF8_BYTES });
  }

  if (errors.length) {
    return fail('validation_failed', 'Evidence envelope failed strict validation', { errors, bytes });
  }
  return { ok: true, bytes };
}

export default {
  SCHEMA_VERSION,
  CONTRACT_VERSION,
  ADAPTER_VERSIONS,
  CANONICAL_AGENT_IDS,
  ANALYTICAL_AGENT_IDS,
  OPPORTUNITY_AGENT_IDS,
  validateEvidenceEnvelope,
  utf8ByteLength,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isUnavailableRepresentation,
  canonicalIdentifier,
};
