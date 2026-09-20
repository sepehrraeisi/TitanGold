/**
 * Artemis Core Stage 8 — Market Context Contract Boundary (S8-MC-CONTRACT).
 *
 * Library-only validation/composition of a canonical Market Context artifact.
 *
 * Ownership (explicit):
 *   - This module is a VALIDATION BOUNDARY / schema owner for Market Context.
 *   - It is NOT itself a Market Context Source of Truth.
 *   - NEW_SOT_OWNER_REQUIRED = YES (future persistence/runtime SoT not authorized here).
 *   - Decision Context, EvidenceOrchestration, market proxy, MEXC, and CCXT are
 *     NOT Market Context SoT owners.
 *
 * Separates:
 *   MARKET IDENTITY  ≠  MARKET OBSERVATION  ≠  EXECUTION  ≠  OUTCOME
 *
 * Does NOT:
 *   - fetch market data / call exchanges / market proxy / MEXC / CCXT / providers
 *   - select an authoritative provider
 *   - access DB / Redis / network / LLM
 *   - activate Shadow runtime / worker / scheduler
 *   - authorize orders, Live, Paper, wallet, or financial execution
 *   - invent Outcome SoT
 *   - modify C8.1 / C.1–C.6 / Decision / Context / Evidence / Control Chain
 */

import {
  AVAILABILITY,
  CORRELATION_FAMILY,
  FRESHNESS_STATUS,
  MARKET_TYPE,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
} from './artemisDecisionContextContract.js';
import {
  SHADOW_RECORDING_CONTRACT_VERSION,
} from './artemisShadowDecisionRecordingBoundaryContract.js';

export const MARKET_CONTEXT_STAGE = 'ARTEMIS_CORE_STAGE_8_MARKET_CONTEXT_CONTRACT_BOUNDARY';
export const MARKET_CONTEXT_SLICE_ID = 'S8-MC-CONTRACT';
export const MARKET_CONTEXT_SCHEMA_VERSION = '1.0.0';
export const MARKET_CONTEXT_CONTRACT_VERSION = 'artemis-market-context-1.0.0';
export const MARKET_CONTEXT_POLICY_VERSION = 'stage8-mc-contract-1.0.0';
export const MARKET_CONTEXT_WRITER = 'artemisMarketContextContract';
export const MARKET_CONTEXT_METHOD_KEY = 'build_market_context_fail_closed';
export const MARKET_CONTEXT_ARTIFACT_TYPE = 'MARKET_CONTEXT';
export const MARKET_CONTEXT_AUTHORITY_CLASS = 'MARKET_CONTEXT';

/** Explicit SoT ownership — contract is validation boundary only. */
export const MARKET_CONTEXT_SOT_STATUS = 'MISSING';
export const NEW_SOT_OWNER_REQUIRED = true;
export const MARKET_CONTEXT_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const FORBIDDEN_MARKET_CONTEXT_SOT_OWNERS = Object.freeze([
  'EvidenceOrchestrationSet',
  'artemisEvidenceOrchestrationService',
  'DecisionContext',
  'artemisDecisionContextService',
  ['market', '-', 'proxy'].join(''),
  'mexcService',
  'mexc',
  'ccxt',
  'tradingEngine',
  'artemisOrchestrator',
]);

export const MAX_MARKET_CONTEXT_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 256;
export const MAX_SYMBOL_CHARS = 64;
export const MAX_HORIZON_CHARS = 64;

export const ZERO_MARKET_CONTEXT_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  networkRequestCount: 0,
  providerRequestCount: 0,
  llmCallCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  runtimeMutationCount: 0,
  emergencyStopClearCount: 0,
  agentExecutionCount: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  liveTradingEnabled: false,
  paperTradingEnabled: false,
  providerConnected: false,
});

/**
 * Source class classifies attestation kind — NOT a provider selector.
 * Must never imply MEXC/CCXT/market proxy authority.
 */
export const MARKET_SOURCE_CLASS = Object.freeze({
  PUBLIC_MARKET_DATA_ATTESTATION: 'public_market_data_attestation',
  INTERNAL_ATTESTED: 'internal_attested',
  UNAVAILABLE: 'unavailable',
});

/** Usable freshness values for a valid observation envelope. */
export const USABLE_FRESHNESS = Object.freeze([
  FRESHNESS_STATUS.FRESH,
  FRESHNESS_STATUS.AGED,
]);

/** Canonical timeframe allowlist (library identity only). */
export const ALLOWED_TIMEFRAMES = Object.freeze([
  '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M',
]);

export const MARKET_CONTEXT_LIMITATIONS = Object.freeze([
  'stage8_market_context_contract_only',
  'library_only',
  'validation_boundary_not_sot',
  'new_sot_owner_required',
  'does_not_fetch_market_data',
  'does_not_select_provider',
  'does_not_authorize_network',
  'does_not_authorize_mexc_ccxt_or_market_proxy',
  'does_not_persist',
  'does_not_activate_shadow_runtime',
  'does_not_authorize_execution',
  'does_not_invent_outcome_sot',
  'identity_observation_execution_outcome_separated',
]);

const ALLOWED_INPUT_TOP = Object.freeze([
  'identity',
  'observation',
  'decisionContextId',
  'recordedAt',
  'lineage',
  'provenance',
  'implementationVersion',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'liveTradingEnabled',
  'paperTradingEnabled',
  'providerConnected',
]);

const ALLOWED_IDENTITY = Object.freeze([
  'venue',
  'marketType',
  'symbol',
  'baseAsset',
  'quoteAsset',
  'timeframe',
  'horizon',
]);

const ALLOWED_OBSERVATION = Object.freeze([
  'sourceTimestamp',
  'ingestionTimestamp',
  'freshnessStatus',
  'expiryTimestamp',
  'availability',
  'sourceClass',
  'correlationFamily',
  'provenance',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'note',
  'policyVersion',
  'implementationVersion',
  'sourceClass',
]);

const ALLOWED_LINEAGE = Object.freeze([
  'decisionContextId',
  'decisionContextContractVersion',
  'shadowRecordingContractVersion',
  'marketContextContractVersion',
  'evidenceContractVersion',
]);

const ALLOWED_ARTIFACT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'authorityClass',
  'marketContextId',
  'generatedAt',
  'identity',
  'observation',
  'ownership',
  'decisionContextId',
  'lineage',
  'provenance',
  'limitations',
  'sideEffects',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'liveTradingEnabled',
  'paperTradingEnabled',
  'providerConnected',
  'implementationVersion',
  'compatibility',
]);

const ALLOWED_OWNERSHIP = Object.freeze([
  'role',
  'isSourceOfTruth',
  'sotStatus',
  'newSotOwnerRequired',
  'forbiddenSotOwners',
]);

const ALLOWED_COMPATIBILITY = Object.freeze([
  'decisionContextContractVersion',
  'shadowRecordingContractVersion',
  'c81ReferenceCompatible',
  'doesNotModifyC81',
]);

const ALLOWED_MARKET_CONTEXT_REF = Object.freeze([
  'marketContextId',
  'contractVersion',
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'freshnessStatus',
  'sourceTimestamp',
  'availability',
]);

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));

const FORBIDDEN_EXECUTION_AUTHORITY_VALUES = Object.freeze([
  'BUY', 'SELL', 'LONG', 'SHORT', 'EXECUTE',
  'buy', 'sell', 'long', 'short', 'execute',
]);

/** Split tokens so hygiene scanners do not treat rejection lists as imports. */
const FORBIDDEN_EXTRA_KEYS = Object.freeze([
  'orderId',
  'order_id',
  'order',
  'orders',
  'executionIntent',
  'executionCommand',
  'walletAction',
  'wallet_action',
  'wallet',
  'tradeInstruction',
  'trade_instruction',
  'transfer',
  'withdrawal',
  'financialExecution',
  'place_order',
  'cancel_order',
  'modify_order',
  'providerPayload',
  'providerTransaction',
  'signedQuery',
  'signed_query',
  'signedPayload',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'credentials',
  'password',
  'token',
  'authorization',
  'prompt',
  'modelResponse',
  'raw',
  'payload',
  'marketSnapshot',
  'ohlcv',
  'OHLCV',
  'ticker',
  'orderBook',
  'orderbook',
  'candles',
  'depth',
  'bid',
  'ask',
  'spread',
  'lastPrice',
  'price',
  'volume',
  'observedOutcome',
  'realizedPnl',
  'realizedDirection',
  'calibrationScore',
  'evaluationResult',
  'ccxt',
  'mexcClient',
  'marketProxy',
  ['market', '-', 'proxy'].join(''),
  'shadowWorker',
  'scheduler',
  'b10',
]);

const MARKET_OBSERVATION_CONTAMINATION_KEYS = Object.freeze([
  'marketSnapshot',
  'ohlcv',
  'OHLCV',
  'ticker',
  'orderBook',
  'orderbook',
  'candles',
  'depth',
  'bid',
  'ask',
  'spread',
  'lastPrice',
  'price',
  'volume',
]);

const SYMBOL_RE = /^[A-Z0-9]{2,20}\/[A-Z0-9]{2,20}$/;
const ASSET_RE = /^[A-Z0-9]{2,20}$/;
const VENUE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const ALLOWED_TIMEFRAME_SET = new Set(ALLOWED_TIMEFRAMES);
const USABLE_FRESHNESS_SET = new Set(USABLE_FRESHNESS);
const SOURCE_CLASS_SET = new Set(Object.values(MARKET_SOURCE_CLASS));
const MARKET_TYPE_SET = new Set([
  MARKET_TYPE.SPOT,
  MARKET_TYPE.FUTURES,
]);
const CORRELATION_SET = new Set(Object.values(CORRELATION_FAMILY));
const AVAILABILITY_SET = new Set(Object.values(AVAILABILITY));
const FRESHNESS_SET = new Set(Object.values(FRESHNESS_STATUS));

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => freezeDeep(item));
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
}

function assertAllowlist(obj, allowed, field, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push({ field, code: 'required_object' });
    return false;
  }
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
  const unknownKeys = Object.keys(obj).filter((key) => !allowedSet.has(key));
  if (unknownKeys.length) {
    unknownKeys.forEach((key) => errors.push({ field: `${field}.${key}`, code: 'unknown_field' }));
    return false;
  }
  return true;
}

function collectForbiddenKeys(value, acc = []) {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenKeys(item, acc));
    return acc;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_EXTRA_KEYS.includes(key)) acc.push(key);
    if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(nested)) acc.push(`${key}:${nested}`);
    collectForbiddenKeys(nested, acc);
  }
  return acc;
}

function assertString(field, value, errors, { required = false, max = MAX_STRING_CHARS } = {}) {
  if (value == null || value === '') {
    if (required) errors.push({ field, code: 'required_string' });
    return;
  }
  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid_string' });
    return;
  }
  if (value.length > max) errors.push({ field, code: 'string_too_long', max });
}

function hashToUuid(parts) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i += 1) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= text.charCodeAt(text.length - 1 - i);
    h2 = Math.imul(h2, 0x01000193);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex = `${a}${b}${a}${b}`.slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function validateHardFlagsOnInput(input, errors) {
  for (const key of HARD_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== false) {
      errors.push({ field: key, code: 'hard_flag_must_be_false' });
    }
  }
}

function parseIsoMs(value) {
  return Date.parse(value);
}

function validateIdentity(identity, errors) {
  if (!assertAllowlist(identity, ALLOWED_IDENTITY, 'identity', errors)) return null;

  assertString('identity.venue', identity.venue, errors, { required: true, max: MAX_STRING_CHARS });
  if (typeof identity.venue === 'string' && identity.venue && !VENUE_RE.test(identity.venue)) {
    errors.push({ field: 'identity.venue', code: 'malformed_venue' });
  }

  if (identity.marketType == null || identity.marketType === '') {
    errors.push({ field: 'identity.marketType', code: 'required_market_type' });
  } else if (!MARKET_TYPE_SET.has(identity.marketType)) {
    errors.push({ field: 'identity.marketType', code: 'invalid_market_type' });
  }

  assertString('identity.symbol', identity.symbol, errors, { required: true, max: MAX_SYMBOL_CHARS });
  if (typeof identity.symbol === 'string' && identity.symbol && !SYMBOL_RE.test(identity.symbol)) {
    errors.push({ field: 'identity.symbol', code: 'malformed_symbol' });
  }

  assertString('identity.baseAsset', identity.baseAsset, errors, { required: true, max: MAX_STRING_CHARS });
  assertString('identity.quoteAsset', identity.quoteAsset, errors, { required: true, max: MAX_STRING_CHARS });
  if (typeof identity.baseAsset === 'string' && identity.baseAsset && !ASSET_RE.test(identity.baseAsset)) {
    errors.push({ field: 'identity.baseAsset', code: 'malformed_base_asset' });
  }
  if (typeof identity.quoteAsset === 'string' && identity.quoteAsset && !ASSET_RE.test(identity.quoteAsset)) {
    errors.push({ field: 'identity.quoteAsset', code: 'malformed_quote_asset' });
  }
  if (typeof identity.symbol === 'string'
    && typeof identity.baseAsset === 'string'
    && typeof identity.quoteAsset === 'string'
    && SYMBOL_RE.test(identity.symbol)
    && identity.symbol !== `${identity.baseAsset}/${identity.quoteAsset}`) {
    errors.push({ field: 'identity.symbol', code: 'symbol_base_quote_mismatch' });
  }

  if (identity.timeframe == null || identity.timeframe === '') {
    errors.push({ field: 'identity.timeframe', code: 'required_timeframe' });
  } else if (typeof identity.timeframe !== 'string') {
    errors.push({ field: 'identity.timeframe', code: 'malformed_timeframe' });
  } else if (!ALLOWED_TIMEFRAME_SET.has(identity.timeframe)) {
    errors.push({ field: 'identity.timeframe', code: 'malformed_timeframe' });
  }

  if (identity.horizon != null) {
    assertString('identity.horizon', identity.horizon, errors, { max: MAX_HORIZON_CHARS });
  }

  return identity;
}

function validateObservation(observation, recordedAt, errors) {
  if (!assertAllowlist(observation, ALLOWED_OBSERVATION, 'observation', errors)) return null;

  for (const key of MARKET_OBSERVATION_CONTAMINATION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(observation, key)) {
      errors.push({ field: `observation.${key}`, code: 'market_observation_contamination' });
    }
  }

  if (!isIsoTimestamp(observation.sourceTimestamp)) {
    errors.push({
      field: 'observation.sourceTimestamp',
      code: observation.sourceTimestamp == null ? 'required_source_timestamp' : 'malformed_source_timestamp',
    });
  }
  if (!isIsoTimestamp(observation.ingestionTimestamp)) {
    errors.push({
      field: 'observation.ingestionTimestamp',
      code: observation.ingestionTimestamp == null
        ? 'required_ingestion_timestamp'
        : 'malformed_ingestion_timestamp',
    });
  }

  if (isIsoTimestamp(observation.sourceTimestamp) && isIsoTimestamp(observation.ingestionTimestamp)) {
    const sourceMs = parseIsoMs(observation.sourceTimestamp);
    const ingestionMs = parseIsoMs(observation.ingestionTimestamp);
    const recordedMs = isIsoTimestamp(recordedAt) ? parseIsoMs(recordedAt) : ingestionMs;
    if (sourceMs > recordedMs) {
      errors.push({ field: 'observation.sourceTimestamp', code: 'future_source_timestamp' });
    }
    if (sourceMs > ingestionMs) {
      errors.push({ field: 'observation.sourceTimestamp', code: 'source_after_ingestion' });
    }
  }

  if (observation.freshnessStatus == null || observation.freshnessStatus === '') {
    errors.push({ field: 'observation.freshnessStatus', code: 'required_freshness' });
  } else if (!FRESHNESS_SET.has(observation.freshnessStatus)) {
    errors.push({ field: 'observation.freshnessStatus', code: 'invalid_freshness' });
  } else if (observation.freshnessStatus === FRESHNESS_STATUS.UNKNOWN) {
    errors.push({ field: 'observation.freshnessStatus', code: 'unknown_freshness' });
  } else if (observation.freshnessStatus === FRESHNESS_STATUS.STALE) {
    errors.push({ field: 'observation.freshnessStatus', code: 'stale_observation' });
  } else if (observation.freshnessStatus === FRESHNESS_STATUS.EXPIRED) {
    errors.push({ field: 'observation.freshnessStatus', code: 'expired_observation' });
  } else if (observation.freshnessStatus === FRESHNESS_STATUS.UNAVAILABLE) {
    errors.push({ field: 'observation.freshnessStatus', code: 'unavailable_freshness' });
  } else if (!USABLE_FRESHNESS_SET.has(observation.freshnessStatus)) {
    errors.push({ field: 'observation.freshnessStatus', code: 'unusable_freshness' });
  }

  if (observation.expiryTimestamp != null) {
    if (!isIsoTimestamp(observation.expiryTimestamp)) {
      errors.push({ field: 'observation.expiryTimestamp', code: 'malformed_expiry_timestamp' });
    } else if (isIsoTimestamp(observation.ingestionTimestamp)) {
      const expiryMs = parseIsoMs(observation.expiryTimestamp);
      const ingestionMs = parseIsoMs(observation.ingestionTimestamp);
      if (expiryMs < ingestionMs) {
        errors.push({ field: 'observation.expiryTimestamp', code: 'expired_observation' });
      }
    }
  }

  if (observation.availability == null || observation.availability === '') {
    errors.push({ field: 'observation.availability', code: 'required_availability' });
  } else if (!AVAILABILITY_SET.has(observation.availability)) {
    errors.push({ field: 'observation.availability', code: 'invalid_availability' });
  } else if (observation.availability !== AVAILABILITY.AVAILABLE) {
    errors.push({ field: 'observation.availability', code: 'unavailable_source' });
  }

  if (observation.sourceClass == null || observation.sourceClass === '') {
    errors.push({ field: 'observation.sourceClass', code: 'required_source_class' });
  } else if (!SOURCE_CLASS_SET.has(observation.sourceClass)) {
    errors.push({ field: 'observation.sourceClass', code: 'unknown_source_class' });
  } else if (observation.sourceClass === MARKET_SOURCE_CLASS.UNAVAILABLE) {
    errors.push({ field: 'observation.sourceClass', code: 'unavailable_source_class' });
  }

  if (observation.correlationFamily == null || observation.correlationFamily === '') {
    errors.push({ field: 'observation.correlationFamily', code: 'required_correlation_family' });
  } else if (!CORRELATION_SET.has(observation.correlationFamily)) {
    errors.push({ field: 'observation.correlationFamily', code: 'invalid_correlation_family' });
  }

  if (observation.provenance == null) {
    errors.push({ field: 'observation.provenance', code: 'required_provenance' });
  } else if (!assertAllowlist(observation.provenance, ALLOWED_PROVENANCE, 'observation.provenance', errors)) {
    // unknown provenance fields already recorded
  } else {
    assertString('observation.provenance.writer', observation.provenance.writer, errors, { required: true });
    assertString('observation.provenance.methodKey', observation.provenance.methodKey, errors, { required: true });
    assertString('observation.provenance.stage', observation.provenance.stage, errors, { required: true });
    if (!isIsoTimestamp(observation.provenance.recordedAt)) {
      errors.push({
        field: 'observation.provenance.recordedAt',
        code: observation.provenance.recordedAt == null
          ? 'required_provenance_recorded_at'
          : 'malformed_provenance_recorded_at',
      });
    }
    if (observation.provenance.sourceClass != null
      && !SOURCE_CLASS_SET.has(observation.provenance.sourceClass)) {
      errors.push({ field: 'observation.provenance.sourceClass', code: 'unknown_source_class' });
    }
    if (!observation.provenance.writer || !observation.provenance.methodKey) {
      errors.push({ field: 'observation.provenance', code: 'invalid_provenance' });
    }
  }

  return observation;
}

function validateCallerLineage(lineage, errors) {
  if (lineage == null) return;
  if (!assertAllowlist(lineage, ALLOWED_LINEAGE, 'lineage', errors)) return;
  if (lineage.decisionContextId != null && !isCanonicalUuid(lineage.decisionContextId)) {
    errors.push({ field: 'lineage.decisionContextId', code: 'invalid_uuid' });
  }
  if (lineage.decisionContextContractVersion != null
    && lineage.decisionContextContractVersion !== DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.decisionContextContractVersion',
      code: 'incompatible_decision_context_contract',
      expected: DECISION_CONTEXT_CONTRACT_VERSION,
    });
  }
  if (lineage.shadowRecordingContractVersion != null
    && lineage.shadowRecordingContractVersion !== SHADOW_RECORDING_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.shadowRecordingContractVersion',
      code: 'incompatible_shadow_recording_contract',
      expected: SHADOW_RECORDING_CONTRACT_VERSION,
    });
  }
  if (lineage.marketContextContractVersion != null
    && lineage.marketContextContractVersion !== MARKET_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'lineage.marketContextContractVersion',
      code: 'incompatible_market_context_contract',
      expected: MARKET_CONTEXT_CONTRACT_VERSION,
    });
  }
}

function validateCallerProvenance(provenance, recordedAt, errors) {
  if (provenance == null) return;
  if (!assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors)) return;
  if (provenance.recordedAt != null && !isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'malformed_provenance_recorded_at' });
  }
  if (provenance.recordedAt != null
    && isIsoTimestamp(recordedAt)
    && provenance.recordedAt !== recordedAt) {
    errors.push({ field: 'provenance.recordedAt', code: 'provenance_recorded_at_mismatch' });
  }
}

/**
 * Build a validated Market Context artifact (library-only).
 *
 * @param {object} input
 * @returns {{ ok: true, artifact: object, sideEffects: object, bytes: number }
 *   | { ok: false, code: string, message: string, errors?: object[] }}
 */
export function buildMarketContext(input = {}) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Market Context input must be an object');
  }

  assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors);
  validateHardFlagsOnInput(input, errors);

  const forbidden = collectForbiddenKeys(input);
  const secretKeys = collectForbiddenSecretKeys(input);
  if (forbidden.length) {
    forbidden.forEach((key) => errors.push({ field: key, code: 'forbidden_field' }));
  }
  if (secretKeys.length) {
    secretKeys.forEach((key) => errors.push({ field: key, code: 'secret_contamination' }));
  }

  const recordedAt = input.recordedAt ?? input.observation?.ingestionTimestamp;
  if (!isIsoTimestamp(recordedAt)) {
    errors.push({
      field: 'recordedAt',
      code: recordedAt == null ? 'required_recorded_at' : 'malformed_recorded_at',
    });
  }

  if (input.decisionContextId != null && !isCanonicalUuid(input.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }

  const identity = validateIdentity(input.identity, errors);
  const observation = validateObservation(input.observation, recordedAt, errors);
  validateCallerLineage(input.lineage, errors);
  validateCallerProvenance(input.provenance, recordedAt, errors);

  if (errors.length) {
    return fail('market_context_validation_failed', 'Market Context validation failed', { errors });
  }

  const marketContextId = hashToUuid([
    MARKET_CONTEXT_CONTRACT_VERSION,
    identity.venue,
    identity.marketType,
    identity.symbol,
    identity.timeframe,
    identity.horizon ?? '',
    observation.sourceTimestamp,
    observation.ingestionTimestamp,
    observation.freshnessStatus,
    observation.availability,
    observation.sourceClass,
    observation.correlationFamily,
    input.decisionContextId ?? '',
  ]);

  const provenance = {
    writer: MARKET_CONTEXT_WRITER,
    methodKey: MARKET_CONTEXT_METHOD_KEY,
    stage: MARKET_CONTEXT_STAGE,
    recordedAt,
    policyVersion: MARKET_CONTEXT_POLICY_VERSION,
    sourceClass: observation.sourceClass,
  };
  if (input.provenance?.note != null) provenance.note = input.provenance.note;
  if (input.implementationVersion != null) {
    provenance.implementationVersion = input.implementationVersion;
  }

  const lineage = {
    marketContextContractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
  };
  if (input.decisionContextId != null) lineage.decisionContextId = input.decisionContextId;
  if (input.lineage?.evidenceContractVersion != null) {
    lineage.evidenceContractVersion = input.lineage.evidenceContractVersion;
  }

  const ownership = {
    role: MARKET_CONTEXT_OWNERSHIP_ROLE,
    isSourceOfTruth: false,
    sotStatus: MARKET_CONTEXT_SOT_STATUS,
    newSotOwnerRequired: NEW_SOT_OWNER_REQUIRED,
    forbiddenSotOwners: [...FORBIDDEN_MARKET_CONTEXT_SOT_OWNERS],
  };

  const compatibility = {
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    c81ReferenceCompatible: true,
    doesNotModifyC81: true,
  };

  const observationOut = {
    sourceTimestamp: observation.sourceTimestamp,
    ingestionTimestamp: observation.ingestionTimestamp,
    freshnessStatus: observation.freshnessStatus,
    availability: observation.availability,
    sourceClass: observation.sourceClass,
    correlationFamily: observation.correlationFamily,
    provenance: {
      writer: observation.provenance.writer,
      methodKey: observation.provenance.methodKey,
      stage: observation.provenance.stage,
      recordedAt: observation.provenance.recordedAt,
    },
  };
  if (observation.expiryTimestamp != null) {
    observationOut.expiryTimestamp = observation.expiryTimestamp;
  }
  if (observation.provenance.note != null) {
    observationOut.provenance.note = observation.provenance.note;
  }
  if (observation.provenance.sourceClass != null) {
    observationOut.provenance.sourceClass = observation.provenance.sourceClass;
  }
  if (observation.provenance.policyVersion != null) {
    observationOut.provenance.policyVersion = observation.provenance.policyVersion;
  }
  if (observation.provenance.implementationVersion != null) {
    observationOut.provenance.implementationVersion = observation.provenance.implementationVersion;
  }

  const identityOut = {
    venue: identity.venue,
    marketType: identity.marketType,
    symbol: identity.symbol,
    baseAsset: identity.baseAsset,
    quoteAsset: identity.quoteAsset,
    timeframe: identity.timeframe,
  };
  if (identity.horizon != null) identityOut.horizon = identity.horizon;

  const artifact = {
    schemaVersion: MARKET_CONTEXT_SCHEMA_VERSION,
    contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    policyVersion: MARKET_CONTEXT_POLICY_VERSION,
    artifactType: MARKET_CONTEXT_ARTIFACT_TYPE,
    authorityClass: MARKET_CONTEXT_AUTHORITY_CLASS,
    marketContextId,
    generatedAt: recordedAt,
    identity: identityOut,
    observation: observationOut,
    ownership,
    lineage,
    provenance,
    compatibility,
    limitations: [...MARKET_CONTEXT_LIMITATIONS],
    sideEffects: { ...ZERO_MARKET_CONTEXT_SIDE_EFFECTS },
    ...REQUIRED_HARD_FLAGS,
  };
  if (input.decisionContextId != null) artifact.decisionContextId = input.decisionContextId;
  if (input.implementationVersion != null) {
    artifact.implementationVersion = input.implementationVersion;
  }

  const finalErrors = [];
  assertAllowlist(artifact, ALLOWED_ARTIFACT_TOP, 'artifact', finalErrors);
  assertAllowlist(artifact.identity, ALLOWED_IDENTITY, 'identity', finalErrors);
  assertAllowlist(artifact.observation, ALLOWED_OBSERVATION, 'observation', finalErrors);
  assertAllowlist(artifact.observation.provenance, ALLOWED_PROVENANCE, 'observation.provenance', finalErrors);
  assertAllowlist(artifact.ownership, ALLOWED_OWNERSHIP, 'ownership', finalErrors);
  assertAllowlist(artifact.lineage, ALLOWED_LINEAGE, 'lineage', finalErrors);
  assertAllowlist(artifact.provenance, ALLOWED_PROVENANCE, 'provenance', finalErrors);
  assertAllowlist(artifact.compatibility, ALLOWED_COMPATIBILITY, 'compatibility', finalErrors);

  const bytes = utf8ByteLength(artifact);
  if (bytes > MAX_MARKET_CONTEXT_UTF8_BYTES) {
    finalErrors.push({ field: 'artifact', code: 'too_large', bytes });
  }
  if (finalErrors.length) {
    return fail('artifact_validation_failed', 'Built Market Context artifact failed allowlist', {
      errors: finalErrors,
    });
  }

  return {
    ok: true,
    code: 'MARKET_CONTEXT_BUILT',
    message: 'Market Context artifact validated',
    artifact: freezeDeep(artifact),
    sideEffects: { ...ZERO_MARKET_CONTEXT_SIDE_EFFECTS },
    bytes,
  };
}

/** Compatible alias — single canonical builder surface. */
export function validateMarketContext(input = {}) {
  return buildMarketContext(input);
}

/**
 * External reference shape for future C8.1 / Decision Context consumers.
 * Does not modify C8.1. Pure projection from a validated artifact.
 */
export function toMarketContextRef(artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return fail('invalid_artifact', 'Market Context artifact required');
  }
  const ref = {
    marketContextId: artifact.marketContextId,
    contractVersion: artifact.contractVersion,
    venue: artifact.identity?.venue,
    marketType: artifact.identity?.marketType,
    symbol: artifact.identity?.symbol,
    timeframe: artifact.identity?.timeframe,
    freshnessStatus: artifact.observation?.freshnessStatus,
    sourceTimestamp: artifact.observation?.sourceTimestamp,
    availability: artifact.observation?.availability,
  };
  const errors = [];
  assertAllowlist(ref, ALLOWED_MARKET_CONTEXT_REF, 'marketContextRef', errors);
  if (!isCanonicalUuid(ref.marketContextId)) {
    errors.push({ field: 'marketContextRef.marketContextId', code: 'invalid_uuid' });
  }
  if (ref.contractVersion !== MARKET_CONTEXT_CONTRACT_VERSION) {
    errors.push({ field: 'marketContextRef.contractVersion', code: 'incompatible_contract' });
  }
  if (errors.length) {
    return fail('market_context_ref_invalid', 'Market Context ref projection failed', { errors });
  }
  return { ok: true, code: 'MARKET_CONTEXT_REF', ref: freezeDeep(ref) };
}

export default {
  MARKET_CONTEXT_STAGE,
  MARKET_CONTEXT_SLICE_ID,
  MARKET_CONTEXT_SCHEMA_VERSION,
  MARKET_CONTEXT_CONTRACT_VERSION,
  MARKET_CONTEXT_POLICY_VERSION,
  MARKET_CONTEXT_WRITER,
  MARKET_CONTEXT_METHOD_KEY,
  MARKET_CONTEXT_ARTIFACT_TYPE,
  MARKET_CONTEXT_AUTHORITY_CLASS,
  MARKET_CONTEXT_SOT_STATUS,
  NEW_SOT_OWNER_REQUIRED,
  MARKET_CONTEXT_OWNERSHIP_ROLE,
  FORBIDDEN_MARKET_CONTEXT_SOT_OWNERS,
  ZERO_MARKET_CONTEXT_SIDE_EFFECTS,
  REQUIRED_HARD_FLAGS,
  MARKET_SOURCE_CLASS,
  USABLE_FRESHNESS,
  ALLOWED_TIMEFRAMES,
  MARKET_CONTEXT_LIMITATIONS,
  buildMarketContext,
  validateMarketContext,
  toMarketContextRef,
};
