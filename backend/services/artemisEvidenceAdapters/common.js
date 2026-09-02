/**
 * Shared Stage 3 adapter helpers.
 * Local, deterministic, no provider/DB/LLM calls.
 */

import {
  ADAPTER_VERSIONS,
  AVAILABILITY,
  DIRECTION,
  EXECUTION_CLASS,
  LIFECYCLE_STATUS,
} from '../../contracts/artemisEvidenceContract.js';
import {
  asFiniteNumber,
  asIsoOrNull,
  knownTimeframe,
  resolveDataQuality,
  resolveFreshness,
  unavailableConfidence,
} from '../artemisEvidenceTruth.js';
import { buildBaseEnvelope, parseJsonObject } from './support.js';

const MOCK_SOURCES = new Set(['mock', 'placeholder', 'synthetic']);

export function agentOutput(rawOutput, row = {}) {
  return parseJsonObject(rawOutput ?? row.output ?? row.output_data);
}

export function agentInput(rawInput, row = {}) {
  return parseJsonObject(rawInput ?? row.input ?? row.input_data);
}

export function analysisTime(output, row) {
  return asIsoOrNull(output?.timestamp || output?._meta?.timestamp || output?.meta?.timestamp)
    || asIsoOrNull(row?.created_at);
}

export function rejectUndatedEnvelope(reason = 'analysis_timestamp_unavailable') {
  return {
    ok: false,
    reason,
    evidenceCompatible: true,
    evidenceAvailable: false,
  };
}

export function outputTimeframe(output, input) {
  return knownTimeframe(output.timeframe || input.timeframe || output.meta?.timeframe);
}

export function detectMockSource(output) {
  const source = String(
    output?._meta?.source || output?.meta?.source || output?.metadata?.source || '',
  ).toLowerCase();
  if (MOCK_SOURCES.has(source)) return true;
  if (String(output?.method || '').toLowerCase() === 'mock') return true;
  const sources = output?.result?.sources;
  if (sources && typeof sources === 'object' && !Array.isArray(sources)) {
    const values = Object.values(sources);
    if (values.length && values.every((item) => item && (item.mock === true || item.error))) {
      return true;
    }
  }
  return false;
}

export function allSentimentSourcesMockOrEmpty(output) {
  const sources = output?.result?.sources;
  if (!sources || typeof sources !== 'object') return false;
  const values = Object.values(sources);
  if (!values.length) return true;
  return values.every((item) => !item || item.mock === true || item.error || !(Number(item.count) > 0));
}

export function mapMarketDirection(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (['bullish', 'very_bullish', 'buy', 'strong_buy', 'long'].includes(value)) return DIRECTION.BULLISH;
  if (['bearish', 'very_bearish', 'sell', 'strong_sell', 'short'].includes(value)) return DIRECTION.BEARISH;
  if (['sideways', 'ranging'].includes(value)) return DIRECTION.SIDEWAYS;
  if (['neutral', 'hold', 'observe', 'wait'].includes(value)) return DIRECTION.NEUTRAL;
  if (!value) return DIRECTION.UNAVAILABLE;
  return DIRECTION.UNAVAILABLE;
}

export function adapterProvenance(agentId, extra = {}) {
  return {
    writer: `${agentId}EvidenceAdapter`,
    source: 'ai_decisions.output_data',
    adapterVersion: ADAPTER_VERSIONS[agentId],
    methodKey: extra.methodKey || `${agentId}_stage3_on_read_adapter`,
    ...(extra.note ? { note: extra.note } : {}),
    ...(extra.path ? { path: extra.path } : {}),
    ...(extra.analyticalMode ? { analyticalMode: extra.analyticalMode } : {}),
  };
}

export function boundedItems(items) {
  return { items: (items || []).slice(0, 32) };
}

export function failClosedEnvelope({
  agentId,
  row = {},
  output = {},
  input = {},
  nowMs,
  reason,
  correlationFamily = null,
  executionClass = EXECUTION_CLASS.ADVISORY_ONLY,
  limitations = [],
  extra = {},
}) {
  const analysisTimestamp = analysisTime(output, row);
  if (!analysisTimestamp) {
    return rejectUndatedEnvelope(reason || 'analysis_timestamp_unavailable');
  }
  const timeframe = outputTimeframe(output, input);
  const candleTimestamp = asIsoOrNull(
    output.last_candle_timestamp || output.sourceCandleTimestamp || output.meta?.last_candle_timestamp,
  );
  const sourceTimestamp = asIsoOrNull(output.sourceTimestamp || output.quoteTimestamp);
  const freshness = resolveFreshness({
    analysisTimestamp,
    sourceTimestamp,
    sourceCandleTimestamp: candleTimestamp,
    timeframe,
    policyId: `${agentId}-stage3`,
    nowMs,
  });
  const keys = [reason, ...limitations];
  return {
    ok: true,
    envelope: buildBaseEnvelope({
      agentId,
      adapterVersion: ADAPTER_VERSIONS[agentId],
      runId: row.id || null,
      agentRecordId: row.agent_id || row.agentId || null,
      analysisTimestamp,
      createdAt: row.created_at,
      sourceTimestamp,
      sourceCandleTimestamp: candleTimestamp,
      symbol: output.symbol || input.symbol || null,
      timeframe,
      correlationFamily,
      availability: extra.availability || AVAILABILITY.UNAVAILABLE,
      unavailableReason: reason,
      lifecycleStatus: extra.lifecycleStatus
        || ((extra.availability === AVAILABILITY.BLOCKED || extra.availability === AVAILABILITY.NOT_APPLICABLE)
          ? LIFECYCLE_STATUS.SKIPPED
          : LIFECYCLE_STATUS.FAILED),
      limitations: keys,
      executionClass,
      recommendedNextActionClass: extra.recommendedNextActionClass,
      freshness,
      dataQuality: resolveDataQuality({
        mockOrPlaceholder: detectMockSource(output) || reason === 'mock_or_placeholder_source',
        sourceAvailability: 'unavailable',
        sampleAdequacy: 'insufficient',
        freshnessStatus: freshness.status,
        knownLimitationKeys: keys,
      }),
      confidence: unavailableConfidence(reason, { methodKey: `${agentId}_fail_closed` }),
      conclusion: extra.conclusion,
      opportunity: extra.opportunity,
      control: extra.control,
      allocation: extra.allocation,
      feasibility: extra.feasibility,
      provenance: adapterProvenance(agentId, { methodKey: `${agentId}_fail_closed`, note: extra.note }),
      modelAlgorithmVersion: extra.modelAlgorithmVersion,
      configurationVersion: extra.configurationVersion,
      codeImplementationVersion: extra.codeImplementationVersion,
    }),
  };
}

export function contextFreshness({ output, input, row, agentId, nowMs, sourceTimestamp, sourceCandleTimestamp }) {
  const analysisTimestamp = analysisTime(output, row);
  const timeframe = outputTimeframe(output, input);
  const candle = sourceCandleTimestamp
    || asIsoOrNull(output.last_candle_timestamp || output.sourceCandleTimestamp);
  const source = sourceTimestamp || asIsoOrNull(output.sourceTimestamp || output.quoteTimestamp);
  return {
    analysisTimestamp,
    timeframe,
    sourceTimestamp: source,
    sourceCandleTimestamp: candle,
    freshness: resolveFreshness({
      analysisTimestamp,
      sourceTimestamp: source,
      sourceCandleTimestamp: candle,
      timeframe,
      policyId: `${agentId}-stage3`,
      nowMs,
    }),
  };
}

export function nonZeroNumber(value) {
  const n = asFiniteNumber(value);
  if (n == null || n === 0) return null;
  return n;
}

export function hasError(output) {
  return Boolean(output?.error || output?.errorMessage || output?._meta?.error || output?.meta?.source === 'error');
}

export function availableEnvelope({
  agentId,
  row = {},
  output = {},
  input = {},
  nowMs,
  correlationFamily = null,
  executionClass = EXECUTION_CLASS.ADVISORY_ONLY,
  limitations = [],
  confidence,
  conclusion,
  evidence,
  opportunity,
  control,
  allocation,
  feasibility,
  recommendedNextActionClass,
  mockOrPlaceholder = false,
  sourceAvailability = 'available',
  sampleAdequacy = 'ok',
  sourceTimestamp,
  sourceCandleTimestamp,
  extra = {},
}) {
  const ctx = contextFreshness({
    output,
    input,
    row,
    agentId,
    nowMs,
    sourceTimestamp,
    sourceCandleTimestamp,
  });
  if (!ctx.analysisTimestamp) {
    return failClosedEnvelope({
      agentId,
      row,
      output,
      input,
      nowMs,
      reason: 'analysis_timestamp_unavailable',
      correlationFamily,
      executionClass,
      limitations,
      extra,
    });
  }
  const keys = [...limitations];
  if (ctx.freshness.status === 'unknown') keys.push(ctx.freshness.reasonKey || 'freshness_unknown');
  return {
    ok: true,
    envelope: buildBaseEnvelope({
      agentId,
      adapterVersion: ADAPTER_VERSIONS[agentId],
      runId: row.id || null,
      agentRecordId: row.agent_id || row.agentId || null,
      analysisTimestamp: ctx.analysisTimestamp,
      createdAt: row.created_at,
      sourceTimestamp: ctx.sourceTimestamp,
      sourceCandleTimestamp: ctx.sourceCandleTimestamp,
      symbol: output.symbol || input.symbol || null,
      timeframe: ctx.timeframe,
      provider: extra.provider || output._meta?.dataProvider || output.meta?.dataProvider || null,
      venue: extra.venue || null,
      correlationFamily,
      availability: AVAILABILITY.AVAILABLE,
      unavailableReason: null,
      lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
      limitations: keys,
      executionClass,
      recommendedNextActionClass,
      freshness: ctx.freshness,
      dataQuality: resolveDataQuality({
        mockOrPlaceholder,
        sourceAvailability,
        sampleAdequacy,
        freshnessStatus: ctx.freshness.status,
        knownLimitationKeys: keys,
      }),
      confidence,
      conclusion,
      evidence,
      opportunity,
      control,
      allocation,
      feasibility,
      provenance: adapterProvenance(agentId, extra),
      modelAlgorithmVersion: extra.modelAlgorithmVersion,
      configurationVersion: extra.configurationVersion,
      codeImplementationVersion: extra.codeImplementationVersion,
    }),
  };
}
