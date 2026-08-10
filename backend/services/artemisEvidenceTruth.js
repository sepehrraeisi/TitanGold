/**
 * Artemis WP-B.1 — truthful confidence / freshness / data-quality helpers.
 * No fake defaults. No silent 0–100 ↔ 0–1 conversion. No global TTL.
 */

import {
  CONFIDENCE_KIND,
  CONFIDENCE_SCALE,
  DATA_QUALITY_STATUS,
  FRESHNESS_STATUS,
} from '../contracts/artemisEvidenceContract.js';

const KNOWN_TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']);
const TIMEFRAME_MS = Object.freeze({
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
});

export function readPath(source, path) {
  if (!source || typeof source !== 'object' || !path) return undefined;
  return String(path).split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[key];
  }, source);
}

export function asFiniteNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

export function asIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Distinguish generic agentExecutionService missing-confidence fallback (0.5)
 * from an Agent-emitted explicit 0.5. Never use `=== 0.5` alone.
 *
 * @param {{
 *   agentOutput?: object | null,
 *   persistedConfidence?: unknown,
 *   explicitPaths?: string[],
 * }} args
 */
export function resolveConfidenceFromProvenance({
  agentOutput = null,
  persistedConfidence = null,
  explicitPaths = ['confidence'],
} = {}) {
  let explicitPath = null;
  let explicitValue = null;
  for (const path of explicitPaths) {
    const candidate = asFiniteNumber(readPath(agentOutput, path));
    if (candidate != null) {
      explicitPath = path;
      explicitValue = candidate;
      break;
    }
  }

  if (explicitValue != null) {
    return {
      availability: 'available',
      value: explicitValue,
      kind: CONFIDENCE_KIND.HEURISTIC,
      calibrationState: 'uncalibrated',
      sampleWindow: { availability: 'unavailable' },
      provenance: {
        writer: 'agent_output',
        path: explicitPath,
        methodKey: 'explicit_agent_confidence',
      },
    };
  }

  const persisted = asFiniteNumber(persistedConfidence);
  if (persisted === 0.5) {
    return {
      availability: 'unavailable',
      value: null,
      kind: CONFIDENCE_KIND.UNAVAILABLE,
      calibrationState: 'unavailable',
      sampleWindow: { availability: 'unavailable' },
      reasonKey: 'generic_writer_missing_confidence_fallback',
      provenance: {
        writer: 'agentExecutionService',
        methodKey: 'missing_confidence_default_0_5',
      },
    };
  }

  return {
    availability: 'unavailable',
    value: null,
    kind: CONFIDENCE_KIND.UNAVAILABLE,
    calibrationState: 'unavailable',
    sampleWindow: { availability: 'unavailable' },
    reasonKey: persisted == null ? 'confidence_missing' : 'confidence_provenance_unknown',
    provenance: {
      writer: 'unknown',
      methodKey: 'unproven_persisted_confidence',
    },
  };
}

export function unavailableConfidence(reasonKey, extra = {}) {
  return {
    availability: 'unavailable',
    value: null,
    kind: CONFIDENCE_KIND.UNAVAILABLE,
    calibrationState: 'unavailable',
    sampleWindow: { availability: 'unavailable' },
    reasonKey,
    scale: CONFIDENCE_SCALE.UNKNOWN,
    provenance: { writer: extra.writer || 'adapter', methodKey: extra.methodKey || reasonKey },
  };
}

export function heuristicConfidence({ value, scale, path, writer = 'agent_output' }) {
  return {
    availability: 'available',
    value,
    scale,
    kind: CONFIDENCE_KIND.HEURISTIC,
    calibrationState: 'uncalibrated',
    sampleWindow: { availability: 'unavailable' },
    provenance: { writer, path, methodKey: 'explicit_agent_confidence' },
  };
}

export function knownTimeframe(value) {
  if (!value) return null;
  const tf = String(value).trim();
  return KNOWN_TIMEFRAMES.has(tf) ? tf : null;
}

/**
 * Canonical Artemis freshness. Product display fallbacks must not become `fresh`.
 * Missing or ambiguous source/candle time → unknown. Unknown timeframe → do not assume 1h.
 */
export function resolveFreshness({
  analysisTimestamp,
  sourceTimestamp = null,
  sourceCandleTimestamp = null,
  timeframe = null,
  policyId = 'artemis-default-no-global-ttl',
  nowMs = Date.now(),
} = {}) {
  const analysisIso = asIsoOrNull(analysisTimestamp);
  const sourceIso = asIsoOrNull(sourceTimestamp);
  const candleIso = asIsoOrNull(sourceCandleTimestamp);
  const provenSourceIso = candleIso || sourceIso || null;
  const tf = knownTimeframe(timeframe);

  if (!provenSourceIso) {
    return {
      status: FRESHNESS_STATUS.UNKNOWN,
      reasonKey: 'missing_proven_source_timestamp',
      analysisTimestamp: analysisIso,
      sourceTimestamp: null,
      sourceCandleTimestamp: null,
      policyId,
      maxAgeMs: null,
      timeframe: tf,
    };
  }

  if (analysisIso && provenSourceIso === analysisIso) {
    return {
      status: FRESHNESS_STATUS.UNKNOWN,
      reasonKey: 'ambiguous_product_fallback_timestamp',
      analysisTimestamp: analysisIso,
      sourceTimestamp: sourceIso,
      sourceCandleTimestamp: candleIso,
      policyId,
      maxAgeMs: null,
      timeframe: tf,
    };
  }

  if (!tf) {
    return {
      status: FRESHNESS_STATUS.UNKNOWN,
      reasonKey: 'unknown_timeframe_no_default',
      analysisTimestamp: analysisIso,
      sourceTimestamp: sourceIso,
      sourceCandleTimestamp: candleIso,
      policyId,
      maxAgeMs: null,
      timeframe: null,
    };
  }

  const ageMs = Math.max(0, nowMs - Date.parse(provenSourceIso));
  const tfMs = TIMEFRAME_MS[tf];
  const freshThreshold = tfMs * 1.5;
  const staleThreshold = tfMs * 4;
  let status = FRESHNESS_STATUS.AGED;
  let reasonKey = 'source_aged';
  if (ageMs <= freshThreshold) {
    status = FRESHNESS_STATUS.FRESH;
    reasonKey = 'source_fresh';
  } else if (ageMs > staleThreshold) {
    status = FRESHNESS_STATUS.STALE;
    reasonKey = 'source_stale';
  }

  return {
    status,
    reasonKey,
    analysisTimestamp: analysisIso,
    sourceTimestamp: sourceIso,
    sourceCandleTimestamp: candleIso,
    policyId,
    maxAgeMs: staleThreshold,
    timeframe: tf,
    ageMs,
  };
}

export function resolveDataQuality({
  sourceAvailability = 'unavailable',
  sampleAdequacy = 'unavailable',
  mockOrPlaceholder = false,
  freshnessStatus = FRESHNESS_STATUS.UNKNOWN,
  knownLimitationKeys = [],
} = {}) {
  if (mockOrPlaceholder) {
    return {
      status: DATA_QUALITY_STATUS.UNAVAILABLE,
      sourceAvailability: 'unavailable',
      coverage: 'unavailable',
      completeness: 'unavailable',
      staleness: freshnessStatus,
      providerDegradation: 'unavailable',
      sampleAdequacy: 'unavailable',
      knownLimitationKeys: [...knownLimitationKeys, 'mock_or_placeholder_source'],
    };
  }

  let status = DATA_QUALITY_STATUS.OK;
  if (sourceAvailability === 'unavailable' || sampleAdequacy === 'insufficient') {
    status = DATA_QUALITY_STATUS.INSUFFICIENT;
  } else if (
    sourceAvailability === 'degraded'
    || freshnessStatus === FRESHNESS_STATUS.STALE
    || freshnessStatus === FRESHNESS_STATUS.AGED
    || sampleAdequacy === 'degraded'
  ) {
    status = DATA_QUALITY_STATUS.DEGRADED;
  } else if (freshnessStatus === FRESHNESS_STATUS.UNKNOWN || freshnessStatus === FRESHNESS_STATUS.UNAVAILABLE) {
    status = DATA_QUALITY_STATUS.DEGRADED;
  }

  return {
    status,
    sourceAvailability,
    coverage: 'unavailable',
    completeness: sampleAdequacy === 'ok' ? 'ok' : sampleAdequacy === 'insufficient' ? 'degraded' : 'unavailable',
    staleness: freshnessStatus,
    providerDegradation: 'unavailable',
    sampleAdequacy,
    knownLimitationKeys,
  };
}

export default {
  resolveConfidenceFromProvenance,
  unavailableConfidence,
  heuristicConfidence,
  resolveFreshness,
  resolveDataQuality,
  knownTimeframe,
  asIsoOrNull,
  asFiniteNumber,
};
