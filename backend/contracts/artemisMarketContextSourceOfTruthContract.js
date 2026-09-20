/**
 * Artemis Core Stage 8 — Market Context Source of Truth (S8-MC-SOT).
 *
 * Canonical durable owner for ATTESTED Market Context observation envelopes.
 * Validation reuses S8-MC-CONTRACT (`artemisMarketContextContract.js`).
 *
 * Does NOT:
 *   - fetch market data / network / MEXC / CCXT / market-proxy
 *   - store raw OHLCV / ticker / orderBook / price series
 *   - activate Shadow runtime / worker / scheduler
 *   - activate B10 / Outcome
 *   - authorize Live / Paper / orders / wallet / LLM
 *   - mutate C8.1 / C.1–C.6 / Control Chain
 */

import { createHash } from 'node:crypto';
import {
  MARKET_CONTEXT_CONTRACT_VERSION,
  MARKET_CONTEXT_POLICY_VERSION,
  MARKET_CONTEXT_SCHEMA_VERSION,
  REQUIRED_HARD_FLAGS,
  toMarketContextRef,
} from './artemisMarketContextContract.js';

export const MARKET_CONTEXT_SOT_STAGE = 'ARTEMIS_CORE_STAGE_8_MARKET_CONTEXT_SOURCE_OF_TRUTH';
export const MARKET_CONTEXT_SOT_SLICE_ID = 'S8-MC-SOT';
export const MARKET_CONTEXT_SOT_SCHEMA_VERSION = '1.0.0';
export const MARKET_CONTEXT_SOT_CONTRACT_VERSION = 'artemis-market-context-sot-1.0.0';
export const MARKET_CONTEXT_SOT_POLICY_VERSION = 'stage8-mc-sot-1.0.0';
export const MARKET_CONTEXT_SOT_WRITER = 'artemisMarketContextSourceOfTruth';
export const MARKET_CONTEXT_SOT_METHOD_KEY = 'accept_attested_observation_append_only';
export const MARKET_CONTEXT_SOT_ARTIFACT_TYPE = 'MARKET_CONTEXT_OBSERVATION_ENVELOPE';
export const MARKET_CONTEXT_SOT_AUTHORITY_CLASS = 'MARKET_CONTEXT';
export const MARKET_CONTEXT_SOT_OWNERSHIP_ROLE = 'SOURCE_OF_TRUTH';
export const MARKET_CONTEXT_SOT_IS_SOURCE_OF_TRUTH = true;
export const MARKET_CONTEXT_SOT_IMPLEMENTATION_SHAPE =
  'HYBRID_ATTESTATION_FIRST / ATTESTED_ENVELOPE_SOT_ONLY';

/** Owner-locked V1 observation uniqueness (order fixed). */
export const OBSERVATION_UNIQUENESS_FIELDS = Object.freeze([
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'sourceTimestamp',
  'sourceClass',
]);

export const OBSERVATION_UNIQUENESS_TUPLE =
  'venue + marketType + symbol + timeframe + sourceTimestamp + sourceClass';

export const ACCEPT_STATUS = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  ALREADY_PRESENT: 'ALREADY_PRESENT',
  CONFLICT: 'CONFLICT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REJECTED: 'REJECTED',
});

export const ZERO_MARKET_CONTEXT_SOT_SIDE_EFFECTS = Object.freeze({
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
  sotAppendCount: 0,
  sotUpdateCount: 0,
  sotDeleteCount: 0,
});

export const MARKET_CONTEXT_SOT_LIMITATIONS = Object.freeze([
  'stage8_market_context_sot_only',
  'attestation_first_no_fetch',
  'append_only_observation_envelopes',
  'no_raw_series_storage',
  'no_network_provider_feeder',
  'no_shadow_runtime',
  'no_b10_activation',
  'no_outcome_sot',
  'does_not_authorize_execution',
  'reuses_s8_mc_validation_boundary',
  'does_not_modify_c81',
  'semantic_freshness_only_no_global_ttl',
]);

export { REQUIRED_HARD_FLAGS };

/**
 * Deterministic FNV-style UUID (same algorithm as S8-MC contract; local copy
 * so S8-MC remains unmodified).
 * @param {string[]} parts
 * @returns {string}
 */
export function deterministicHashToUuid(parts) {
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

/**
 * @param {{ venue: string, marketType: string, symbol: string, timeframe: string, sourceTimestamp: string, sourceClass: string }} parts
 * @returns {string}
 */
export function buildObservationUniquenessKey(parts) {
  return [
    parts.venue,
    parts.marketType,
    parts.symbol,
    parts.timeframe,
    parts.sourceTimestamp,
    parts.sourceClass,
  ].join('|');
}

/**
 * Durable observation row id — distinct from marketContextId.
 * @param {{ venue: string, marketType: string, symbol: string, timeframe: string, sourceTimestamp: string, sourceClass: string }} parts
 * @returns {string}
 */
export function buildObservationRowId(parts) {
  return deterministicHashToUuid([
    MARKET_CONTEXT_SOT_CONTRACT_VERSION,
    'observation_row',
    parts.venue,
    parts.marketType,
    parts.symbol,
    parts.timeframe,
    parts.sourceTimestamp,
    parts.sourceClass,
  ]);
}

function canonicalizeValue(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeValue(value[k])}`).join(',')}}`;
}

/**
 * Payload hash for identical/conflict detection.
 * Excludes marketContextId and decisionContextId (not observation identity).
 * @param {object} durablePayload
 * @returns {string} hex sha256
 */
export function computeEnvelopeSha256(durablePayload) {
  const utf8 = canonicalizeValue(durablePayload);
  return createHash('sha256').update(utf8, 'utf8').digest('hex');
}

/**
 * Build durable envelope payload from a validated S8-MC artifact.
 * @param {object} artifact
 * @returns {object}
 */
export function buildDurableObservationPayload(artifact) {
  const identity = artifact.identity;
  const observation = artifact.observation;
  const obsProv = observation.provenance || {};

  const payload = {
    venue: identity.venue,
    marketType: identity.marketType,
    symbol: identity.symbol,
    baseAsset: identity.baseAsset,
    quoteAsset: identity.quoteAsset,
    timeframe: identity.timeframe,
    sourceTimestamp: observation.sourceTimestamp,
    ingestionTimestamp: observation.ingestionTimestamp,
    freshnessStatus: observation.freshnessStatus,
    availability: observation.availability,
    sourceClass: observation.sourceClass,
    correlationFamily: observation.correlationFamily,
    writer: obsProv.writer,
    methodKey: obsProv.methodKey,
    stage: obsProv.stage,
    recordedAt: obsProv.recordedAt,
    schemaVersion: MARKET_CONTEXT_SOT_SCHEMA_VERSION,
    contractVersion: MARKET_CONTEXT_SOT_CONTRACT_VERSION,
    policyVersion: MARKET_CONTEXT_SOT_POLICY_VERSION,
    validationContractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    validationSchemaVersion: MARKET_CONTEXT_SCHEMA_VERSION,
    validationPolicyVersion: MARKET_CONTEXT_POLICY_VERSION,
  };

  if (identity.horizon != null) payload.horizon = identity.horizon;
  if (observation.expiryTimestamp != null) payload.expiryTimestamp = observation.expiryTimestamp;
  if (obsProv.policyVersion != null) payload.observationPolicyVersion = obsProv.policyVersion;
  if (obsProv.implementationVersion != null) {
    payload.implementationVersion = obsProv.implementationVersion;
  }
  if (obsProv.note != null) payload.note = obsProv.note;
  if (obsProv.sourceClass != null) payload.provenanceSourceClass = obsProv.sourceClass;

  return payload;
}

/**
 * Compose an immutable SoT observation record from validated artifact.
 * @param {object} artifact
 * @returns {object}
 */
export function composeObservationRecord(artifact) {
  const uniqueness = {
    venue: artifact.identity.venue,
    marketType: artifact.identity.marketType,
    symbol: artifact.identity.symbol,
    timeframe: artifact.identity.timeframe,
    sourceTimestamp: artifact.observation.sourceTimestamp,
    sourceClass: artifact.observation.sourceClass,
  };

  const durablePayload = buildDurableObservationPayload(artifact);
  const observationRowId = buildObservationRowId(uniqueness);
  const uniquenessKey = buildObservationUniquenessKey(uniqueness);
  const envelopeSha256 = computeEnvelopeSha256(durablePayload);
  const marketContextRef = toMarketContextRef(artifact);

  const record = {
    observationRowId,
    uniquenessKey,
    envelopeSha256,
    marketContextId: artifact.marketContextId,
    marketContextRef: marketContextRef.ok ? marketContextRef.ref : null,
    venue: uniqueness.venue,
    marketType: uniqueness.marketType,
    symbol: uniqueness.symbol,
    baseAsset: artifact.identity.baseAsset,
    quoteAsset: artifact.identity.quoteAsset,
    timeframe: uniqueness.timeframe,
    horizon: artifact.identity.horizon ?? null,
    sourceTimestamp: uniqueness.sourceTimestamp,
    ingestionTimestamp: artifact.observation.ingestionTimestamp,
    freshnessStatus: artifact.observation.freshnessStatus,
    expiryTimestamp: artifact.observation.expiryTimestamp ?? null,
    availability: artifact.observation.availability,
    sourceClass: uniqueness.sourceClass,
    correlationFamily: artifact.observation.correlationFamily,
    writer: artifact.observation.provenance.writer,
    methodKey: artifact.observation.provenance.methodKey,
    stage: artifact.observation.provenance.stage,
    recordedAt: artifact.observation.provenance.recordedAt,
    policyVersion: MARKET_CONTEXT_SOT_POLICY_VERSION,
    schemaVersion: MARKET_CONTEXT_SOT_SCHEMA_VERSION,
    contractVersion: MARKET_CONTEXT_SOT_CONTRACT_VERSION,
    implementationVersion: artifact.observation.provenance.implementationVersion ?? null,
    note: artifact.observation.provenance.note ?? null,
    durablePayload,
    hardFlags: { ...REQUIRED_HARD_FLAGS },
    ownership: {
      role: MARKET_CONTEXT_SOT_OWNERSHIP_ROLE,
      isSourceOfTruth: MARKET_CONTEXT_SOT_IS_SOURCE_OF_TRUTH,
      sliceId: MARKET_CONTEXT_SOT_SLICE_ID,
      stage: MARKET_CONTEXT_SOT_STAGE,
      writer: MARKET_CONTEXT_SOT_WRITER,
      methodKey: MARKET_CONTEXT_SOT_METHOD_KEY,
    },
    limitations: [...MARKET_CONTEXT_SOT_LIMITATIONS],
  };

  return Object.freeze(record);
}

export function createZeroSideEffects(overrides = {}) {
  return { ...ZERO_MARKET_CONTEXT_SOT_SIDE_EFFECTS, ...overrides };
}
