/**
 * Artemis WP-B.1 — canonical Agent → Artemis Evidence contract owner.
 * schemaVersion 1.0.0 / contractVersion artemis-evidence-1.0.0
 * Adapter versions are separate and must not bump this contract.
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

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const FORBIDDEN_SECRET_KEY_RE = /^(api[_-]?key|api[_-]?secret|secret|password|token|jwt|authorization|auth[_-]?header|chat[_-]?id|signed[_-]?url|private[_-]?key)$/i;

export function collectForbiddenSecretKeys(value, acc = []) {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenSecretKeys(item, acc));
    return acc;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_SECRET_KEY_RE.test(key)) acc.push(key);
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

function assertIsoOptional(field, value, errors) {
  if (value == null) return;
  if (value === 'unavailable') return;
  if (typeof value === 'object' && value?.availability === 'unavailable') return;
  if (!isIsoTimestamp(value)) errors.push({ field, code: 'invalid_timestamp' });
}

function validateStrength(strength, errors) {
  if (strength == null) return;
  if (typeof strength !== 'object' || Array.isArray(strength)) {
    errors.push({ field: 'conclusion.strength', code: 'invalid_strength' });
    return;
  }
  if (strength.availability === 'unavailable') return;
  if (typeof strength.value !== 'number' || !Number.isFinite(strength.value)) {
    errors.push({ field: 'conclusion.strength.value', code: 'invalid_strength_value' });
  }
  if (!inEnum(strength.scale, STRENGTH_SCALE)) {
    errors.push({ field: 'conclusion.strength.scale', code: 'invalid_strength_scale' });
  }
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
  if (!['available', 'unavailable'].includes(confidence.availability)) {
    errors.push({ field: 'confidence.availability', code: 'invalid_confidence_availability' });
    return;
  }
  if (confidence.availability === 'unavailable') {
    if (!inEnum(confidence.kind || CONFIDENCE_KIND.UNAVAILABLE, CONFIDENCE_KIND)) {
      errors.push({ field: 'confidence.kind', code: 'invalid_confidence_kind' });
    }
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
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push({ field: `${field}[${i}]`, code: 'invalid_evidence_item' });
      continue;
    }
    if (!item.evidenceId || typeof item.evidenceId !== 'string') {
      errors.push({ field: `${field}[${i}].evidenceId`, code: 'invalid_evidence_id' });
    }
    if (!inEnum(item.evidenceType, EVIDENCE_TYPE)) {
      errors.push({ field: `${field}[${i}].evidenceType`, code: 'invalid_evidence_type' });
    }
    if (!item.canonicalSource || typeof item.canonicalSource !== 'string') {
      errors.push({ field: `${field}[${i}].canonicalSource`, code: 'invalid_canonical_source' });
    }
    if (!inEnum(item.directionalContribution, DIRECTIONAL_CONTRIBUTION)) {
      errors.push({ field: `${field}[${i}].directionalContribution`, code: 'invalid_directional_contribution' });
    }
    if (item.value != null && typeof item.value === 'string' && item.value.length > MAX_EVIDENCE_VALUE_CHARS) {
      errors.push({ field: `${field}[${i}].value`, code: 'evidence_value_too_long' });
    }
    if (item.value != null && typeof item.value === 'object') {
      errors.push({ field: `${field}[${i}].value`, code: 'nested_evidence_value_forbidden' });
    }
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
  if (!envelope.agentId || typeof envelope.agentId !== 'string') {
    errors.push({ field: 'agentId', code: 'invalid_agent_id' });
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

  if (!inEnum(envelope.availability, AVAILABILITY)) {
    errors.push({ field: 'availability', code: 'invalid_availability' });
  }
  if (envelope.availability !== AVAILABILITY.AVAILABLE && !envelope.unavailableReason) {
    errors.push({ field: 'unavailableReason', code: 'unavailable_reason_required' });
  }
  if (!inEnum(envelope.lifecycleStatus, LIFECYCLE_STATUS)) {
    errors.push({ field: 'lifecycleStatus', code: 'invalid_lifecycle_status' });
  }
  if (!Array.isArray(envelope.limitations)) {
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
  assertIsoOptional('createdAt', envelope.createdAt, errors);
  assertIsoOptional('completedAt', envelope.completedAt, errors);

  if (!envelope.freshness || typeof envelope.freshness !== 'object') {
    errors.push({ field: 'freshness', code: 'freshness_required' });
  } else if (!inEnum(envelope.freshness.status, FRESHNESS_STATUS)) {
    errors.push({ field: 'freshness.status', code: 'invalid_freshness_status' });
  }

  if (!envelope.dataQuality || typeof envelope.dataQuality !== 'object') {
    errors.push({ field: 'dataQuality', code: 'data_quality_required' });
  } else if (!inEnum(envelope.dataQuality.status, DATA_QUALITY_STATUS)) {
    errors.push({ field: 'dataQuality.status', code: 'invalid_data_quality_status' });
  }

  if (!envelope.provenance || typeof envelope.provenance !== 'object') {
    errors.push({ field: 'provenance', code: 'provenance_required' });
  }

  if (envelope.conclusion) {
    if (typeof envelope.conclusion !== 'object' || Array.isArray(envelope.conclusion)) {
      errors.push({ field: 'conclusion', code: 'invalid_conclusion' });
    } else {
      if (envelope.conclusion.direction != null && !inEnum(envelope.conclusion.direction, DIRECTION)) {
        errors.push({ field: 'conclusion.direction', code: 'invalid_direction' });
      }
      validateStrength(envelope.conclusion.strength, errors);
    }
  }

  validateConfidence(envelope.confidence, errors);

  const items = envelope.evidence?.items;
  const counter = envelope.evidence?.counterItems;
  const totalItems = (Array.isArray(items) ? items.length : 0) + (Array.isArray(counter) ? counter.length : 0);
  if (totalItems > MAX_EVIDENCE_ITEMS) {
    errors.push({ field: 'evidence', code: 'evidence_item_limit', limit: MAX_EVIDENCE_ITEMS, count: totalItems });
  }
  validateEvidenceItems(items, 'evidence.items', errors);
  validateEvidenceItems(counter, 'evidence.counterItems', errors);

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
  validateEvidenceEnvelope,
  utf8ByteLength,
  collectForbiddenSecretKeys,
};
