/**
 * Read-only Volume → Artemis evidence adapter.
 * Uses explicit Agent confidence only. Generic writer 0.5 → UNAVAILABLE.
 */

import {
  ADAPTER_VERSIONS,
  AVAILABILITY,
  CONFIDENCE_SCALE,
  CORRELATION_FAMILY,
  DIRECTION,
  DIRECTIONAL_CONTRIBUTION,
  EVIDENCE_TYPE,
  EXECUTION_CLASS,
  LIFECYCLE_STATUS,
} from '../../contracts/artemisEvidenceContract.js';
import {
  asFiniteNumber,
  asIsoOrNull,
  heuristicConfidence,
  knownTimeframe,
  resolveConfidenceFromProvenance,
  resolveDataQuality,
  resolveFreshness,
} from '../artemisEvidenceTruth.js';
import { buildBaseEnvelope, parseJsonObject, scalarEvidenceValue } from './support.js';

function mapVolumeDirection(action) {
  const value = String(action || '').toUpperCase();
  if (value === 'BUY') return DIRECTION.BULLISH;
  if (value === 'SELL') return DIRECTION.BEARISH;
  if (value === 'HOLD' || value === 'NEUTRAL') return DIRECTION.NEUTRAL;
  return DIRECTION.UNAVAILABLE;
}

function buildVolumeEvidence(output) {
  const items = [];
  const obv = asFiniteNumber(output.obv?.current);
  if (obv != null) {
    items.push({
      evidenceId: 'volume-obv',
      evidenceType: EVIDENCE_TYPE.INDICATOR,
      canonicalSource: 'volume.obv.current',
      value: obv,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const vwap = asFiniteNumber(output.vwap?.current);
  if (vwap != null) {
    items.push({
      evidenceId: 'volume-vwap',
      evidenceType: EVIDENCE_TYPE.INDICATOR,
      canonicalSource: 'volume.vwap.current',
      value: vwap,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const ratio = asFiniteNumber(output.volume_spikes?.volumeRatio);
  if (ratio != null) {
    items.push({
      evidenceId: 'volume-spike-ratio',
      evidenceType: EVIDENCE_TYPE.METRIC,
      canonicalSource: 'volume.volume_spikes.volumeRatio',
      value: ratio,
      directionalContribution: output.volume_spikes?.isSpike ? DIRECTIONAL_CONTRIBUTION.SUPPORTS : DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const obvTrend = scalarEvidenceValue(output.obv?.trend || output.obv?.signal?.reason);
  if (obvTrend) {
    items.push({
      evidenceId: 'volume-obv-trend',
      evidenceType: EVIDENCE_TYPE.INDICATOR,
      canonicalSource: 'volume.obv.trend',
      value: obvTrend,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapVolumePersistedRun({ row = {}, output: rawOutput, input: rawInput, persistedConfidence, nowMs } = {}) {
  const output = parseJsonObject(rawOutput ?? row.output ?? row.output_data);
  const input = parseJsonObject(rawInput ?? row.input ?? row.input_data);
  const analysisTimestamp = asIsoOrNull(output.timestamp || output.metadata?.timestamp) || asIsoOrNull(row.created_at);
  const candleTimestamp = asIsoOrNull(output.last_candle_timestamp || output.sourceCandleTimestamp);
  const timeframe = knownTimeframe(output.timeframe || input.timeframe);
  const freshness = resolveFreshness({
    analysisTimestamp,
    sourceCandleTimestamp: candleTimestamp,
    timeframe,
    policyId: 'volume-closed-candle',
    nowMs,
  });

  const mock = ['mock', 'placeholder'].includes(String(output._meta?.source || output.metadata?.source || '').toLowerCase());
  const hasCore = output.obv != null || output.vwap != null;
  const resolved = resolveConfidenceFromProvenance({
    agentOutput: output,
    persistedConfidence: persistedConfidence ?? row.confidence,
    explicitPaths: ['trading_recommendation.confidence', 'confidence'],
  });
  const explicitScale = resolved.provenance?.path === 'trading_recommendation.confidence'
    ? CONFIDENCE_SCALE.PERCENT_100
    : CONFIDENCE_SCALE.UNIT_INTERVAL;
  const confidence = resolved.availability === 'available'
    ? heuristicConfidence({
        value: resolved.value,
        scale: explicitScale,
        path: resolved.provenance?.path,
      })
    : { ...resolved, scale: CONFIDENCE_SCALE.UNKNOWN };

  if (!analysisTimestamp) {
    return { ok: false, reason: 'analysis_timestamp_unavailable' };
  }

  if (mock || !hasCore) {
    return {
      ok: true,
      envelope: buildBaseEnvelope({
        agentId: 'volume',
        adapterVersion: ADAPTER_VERSIONS.volume,
        runId: row.id || null,
        agentRecordId: row.agent_id || row.agentId || null,
        analysisTimestamp,
        createdAt: row.created_at,
        symbol: output.symbol || input.symbol || null,
        timeframe,
        correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
        availability: AVAILABILITY.UNAVAILABLE,
        unavailableReason: mock ? 'mock_or_placeholder_source' : 'volume_core_indicators_missing',
        lifecycleStatus: LIFECYCLE_STATUS.FAILED,
        limitations: [mock ? 'mock_or_placeholder_source' : 'volume_core_indicators_missing'],
        executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
        freshness,
        dataQuality: resolveDataQuality({
          mockOrPlaceholder: mock,
          sourceAvailability: 'unavailable',
          sampleAdequacy: 'insufficient',
          freshnessStatus: freshness.status,
          knownLimitationKeys: [mock ? 'mock_or_placeholder_source' : 'volume_core_indicators_missing'],
        }),
        confidence,
        provenance: { writer: 'volumeEvidenceAdapter', source: 'ai_decisions.output_data', adapterVersion: ADAPTER_VERSIONS.volume },
      }),
    };
  }

  const limitations = ['advisory_only', 'volume_confidence_heuristic_uncalibrated'];
  if (freshness.status === 'unknown') limitations.push(freshness.reasonKey || 'freshness_unknown');

  return {
    ok: true,
    envelope: buildBaseEnvelope({
      agentId: 'volume',
      adapterVersion: ADAPTER_VERSIONS.volume,
      runId: row.id || null,
      agentRecordId: row.agent_id || row.agentId || null,
      analysisTimestamp,
      createdAt: row.created_at,
      symbol: output.symbol || input.symbol || null,
      timeframe,
      correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
      availability: AVAILABILITY.AVAILABLE,
      unavailableReason: null,
      lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
      limitations,
      executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
      freshness,
      dataQuality: resolveDataQuality({
        sourceAvailability: 'available',
        sampleAdequacy: asFiniteNumber(output.metadata?.dataPoints) >= 20 ? 'ok' : 'insufficient',
        mockOrPlaceholder: false,
        freshnessStatus: freshness.status,
        knownLimitationKeys: limitations,
      }),
      confidence,
      conclusion: {
        direction: mapVolumeDirection(output.trading_recommendation?.action),
        signal: scalarEvidenceValue(output.trading_recommendation?.action) || 'unavailable',
      },
      evidence: buildVolumeEvidence(output),
      provenance: {
        writer: 'volumeEvidenceAdapter',
        source: 'ai_decisions.output_data',
        adapterVersion: ADAPTER_VERSIONS.volume,
      },
    }),
  };
}

export default { mapVolumePersistedRun };
