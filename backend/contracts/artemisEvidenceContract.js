/**
 * Artemis WP-B.1 — canonical Agent → Artemis Evidence contract owner.
 * schemaVersion 1.0.0 / contractVersion artemis-evidence-1.0.0
 * Adapter versions are separate and must not bump this contract.
 *
 * Envelopes must contain canonical identity only. Alias normalization happens
 * before validation. Nested objects are allowlisted; secret-key scan is defense in depth.
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
const ALLOWED_SAMPLE_WINDOW = new Set(['availability', 'start', 'end', 'size', 'unit']);
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

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const FORBIDDEN_SECRET_KEY_RE = /^(api[_-]?key|api[_-]?secret|secret|password|token|jwt|authorization|auth[_-]?header|chat[_-]?id|signed[_-]?url|private[_-]?key)$/i;
const FORBIDDEN_RAW_PAYLOAD_KEYS = new Set(['input_data', 'output_data', 'metadata', 'input', 'output']);

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
  if (value === 'unavailable') return;
  if (typeof value === 'object' && value?.availability === 'unavailable') return;
  if (!isIsoTimestamp(value)) errors.push({ field, code: 'invalid_timestamp' });
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

function validateSampleWindow(window, errors) {
  if (window == null) return;
  if (typeof window !== 'object' || Array.isArray(window)) {
    errors.push({ field: 'confidence.sampleWindow', code: 'invalid_sample_window' });
    return;
  }
  rejectUnknownFields(window, ALLOWED_SAMPLE_WINDOW, 'confidence.sampleWindow', errors);
  if (window.availability != null && !inEnum(window.availability, AVAILABILITY)) {
    errors.push({ field: 'confidence.sampleWindow.availability', code: 'invalid_sample_window_availability' });
  }
}

function validateConfidenceProvenance(provenance, errors) {
  if (provenance == null) return;
  if (typeof provenance !== 'object' || Array.isArray(provenance)) {
    errors.push({ field: 'confidence.provenance', code: 'invalid_confidence_provenance' });
    return;
  }
  rejectUnknownFields(provenance, ALLOWED_CONFIDENCE_PROVENANCE, 'confidence.provenance', errors);
  optionalString('confidence.provenance.writer', provenance.writer, errors);
  optionalString('confidence.provenance.path', provenance.path, errors);
  optionalString('confidence.provenance.methodKey', provenance.methodKey, errors);
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

function validateFreshness(freshness, errors) {
  if (!freshness || typeof freshness !== 'object' || Array.isArray(freshness)) {
    errors.push({ field: 'freshness', code: 'freshness_required' });
    return;
  }
  rejectUnknownFields(freshness, ALLOWED_FRESHNESS, 'freshness', errors);
  if (!inEnum(freshness.status, FRESHNESS_STATUS)) {
    errors.push({ field: 'freshness.status', code: 'invalid_freshness_status' });
  }
  optionalString('freshness.reasonKey', freshness.reasonKey, errors);
  optionalString('freshness.policyId', freshness.policyId, errors);
  optionalNullableString('freshness.timeframe', freshness.timeframe, errors);
  assertIsoOptional('freshness.analysisTimestamp', freshness.analysisTimestamp, errors);
  assertIsoOptional('freshness.sourceTimestamp', freshness.sourceTimestamp, errors);
  assertIsoOptional('freshness.sourceCandleTimestamp', freshness.sourceCandleTimestamp, errors);
  if (freshness.maxAgeMs != null && (typeof freshness.maxAgeMs !== 'number' || !Number.isFinite(freshness.maxAgeMs))) {
    errors.push({ field: 'freshness.maxAgeMs', code: 'invalid_freshness_max_age' });
  }
  if (freshness.ageMs != null && (typeof freshness.ageMs !== 'number' || !Number.isFinite(freshness.ageMs))) {
    errors.push({ field: 'freshness.ageMs', code: 'invalid_freshness_age' });
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
  optionalString('dataQuality.sourceAvailability', dataQuality.sourceAvailability, errors);
  optionalString('dataQuality.coverage', dataQuality.coverage, errors);
  optionalString('dataQuality.completeness', dataQuality.completeness, errors);
  if (dataQuality.staleness != null && !inEnum(dataQuality.staleness, FRESHNESS_STATUS) && typeof dataQuality.staleness !== 'string') {
    errors.push({ field: 'dataQuality.staleness', code: 'invalid_data_quality_staleness' });
  }
  optionalString('dataQuality.providerDegradation', dataQuality.providerDegradation, errors);
  optionalString('dataQuality.sampleAdequacy', dataQuality.sampleAdequacy, errors);
  if (dataQuality.knownLimitationKeys != null) {
    if (!Array.isArray(dataQuality.knownLimitationKeys) || dataQuality.knownLimitationKeys.some((item) => typeof item !== 'string')) {
      errors.push({ field: 'dataQuality.knownLimitationKeys', code: 'invalid_known_limitation_keys' });
    }
  }
}

function validateProvenance(provenance, errors) {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    errors.push({ field: 'provenance', code: 'provenance_required' });
    return;
  }
  rejectUnknownFields(provenance, ALLOWED_PROVENANCE, 'provenance', errors);
  optionalString('provenance.writer', provenance.writer, errors);
  optionalString('provenance.source', provenance.source, errors);
  optionalString('provenance.adapterVersion', provenance.adapterVersion, errors);
  optionalNullableString('provenance.note', provenance.note, errors);
  optionalNullableString('provenance.analyticalMode', provenance.analyticalMode, errors);
  optionalString('provenance.methodKey', provenance.methodKey, errors);
  optionalString('provenance.path', provenance.path, errors);
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
    optionalString(`${prefix}.quality`, item.quality, errors);
    assertIsoOptional(`${prefix}.timestamp`, item.timestamp, errors);
    if (item.correlationFamily != null && !inEnum(item.correlationFamily, CORRELATION_FAMILY)) {
      errors.push({ field: `${prefix}.correlationFamily`, code: 'invalid_correlation_family' });
    }
    if (item.freshness != null && typeof item.freshness === 'object') {
      rejectUnknownFields(item.freshness, ALLOWED_FRESHNESS, `${prefix}.freshness`, errors);
    } else if (item.freshness != null && typeof item.freshness !== 'string') {
      errors.push({ field: `${prefix}.freshness`, code: 'invalid_item_freshness' });
    }
    if (item.provenance != null && typeof item.provenance === 'object') {
      rejectUnknownFields(item.provenance, ALLOWED_PROVENANCE, `${prefix}.provenance`, errors);
    } else if (item.provenance != null && typeof item.provenance !== 'string') {
      errors.push({ field: `${prefix}.provenance`, code: 'invalid_item_provenance' });
    }
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

  optionalNullableString('agentRecordId', envelope.agentRecordId, errors);
  optionalNullableString('runId', envelope.runId, errors);
  optionalNullableString('correlationId', envelope.correlationId, errors);
  optionalNullableString('decisionContextId', envelope.decisionContextId, errors);
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
  validateEvidenceEnvelope,
  utf8ByteLength,
  collectForbiddenSecretKeys,
};
