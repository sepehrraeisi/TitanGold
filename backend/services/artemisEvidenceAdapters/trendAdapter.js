/**
 * Read-only Trend → Artemis evidence adapter.
 * Does not modify frozen trendDomain / trendRunService product owners.
 */

import {
  ADAPTER_VERSIONS,
  AVAILABILITY,
  CORRELATION_FAMILY,
  DIRECTION,
  DIRECTIONAL_CONTRIBUTION,
  EVIDENCE_TYPE,
  EXECUTION_CLASS,
  LIFECYCLE_STATUS,
  STRENGTH_SCALE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  asFiniteNumber,
  asIsoOrNull,
  knownTimeframe,
  resolveDataQuality,
  resolveFreshness,
  unavailableConfidence,
} from '../artemisEvidenceTruth.js';
import { TREND_DIRECTION, TREND_REGIME, classifyRegime, normalizeDirection } from '../trendDomain.js';
import { buildBaseEnvelope, parseJsonObject, scalarEvidenceValue } from './support.js';

function mapDirection(raw) {
  const direction = normalizeDirection(raw);
  if (direction === TREND_DIRECTION.BULLISH) return DIRECTION.BULLISH;
  if (direction === TREND_DIRECTION.BEARISH) return DIRECTION.BEARISH;
  if (direction === TREND_DIRECTION.SIDEWAYS) return DIRECTION.SIDEWAYS;
  if (direction === TREND_DIRECTION.MIXED) return DIRECTION.NEUTRAL;
  return DIRECTION.UNAVAILABLE;
}

function mapRegime(direction, adxValue) {
  const canonicalDirection = normalizeDirection(
    direction === DIRECTION.BULLISH
      ? 'bullish'
      : direction === DIRECTION.BEARISH
        ? 'bearish'
        : direction === DIRECTION.SIDEWAYS
          ? 'sideways'
          : direction === DIRECTION.NEUTRAL
            ? 'mixed'
            : null,
  );
  const regime = classifyRegime(canonicalDirection, null, adxValue);
  if (regime === TREND_REGIME.TRENDING) return 'trending';
  if (regime === TREND_REGIME.RANGING) return 'ranging';
  if (regime === TREND_REGIME.TRANSITION) return 'transition';
  return 'unavailable';
}

function buildTrendEvidence(output) {
  const items = [];
  const adx = asFiniteNumber(output?.adx?.value);
  if (adx != null) {
    items.push({
      evidenceId: 'trend-adx',
      evidenceType: EVIDENCE_TYPE.INDICATOR,
      canonicalSource: 'trend.adx.value',
      value: adx,
      unit: 'adx',
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const diPlus = asFiniteNumber(output?.adx?.di_plus);
  const diMinus = asFiniteNumber(output?.adx?.di_minus);
  if (diPlus != null) {
    items.push({
      evidenceId: 'trend-di-plus',
      evidenceType: EVIDENCE_TYPE.INDICATOR,
      canonicalSource: 'trend.adx.di_plus',
      value: diPlus,
      directionalContribution: diPlus > (diMinus || 0) ? DIRECTIONAL_CONTRIBUTION.SUPPORTS : DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  if (diMinus != null) {
    items.push({
      evidenceId: 'trend-di-minus',
      evidenceType: EVIDENCE_TYPE.INDICATOR,
      canonicalSource: 'trend.adx.di_minus',
      value: diMinus,
      directionalContribution: diMinus > (diPlus || 0) ? DIRECTIONAL_CONTRIBUTION.CONFLICTS : DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const maSignal = scalarEvidenceValue(output?.moving_averages?.signal?.signal || output?.moving_averages?.signal);
  if (maSignal) {
    items.push({
      evidenceId: 'trend-ma-signal',
      evidenceType: EVIDENCE_TYPE.INDICATOR,
      canonicalSource: 'trend.moving_averages.signal',
      value: maSignal,
      directionalContribution: String(maSignal).includes('bear')
        ? DIRECTIONAL_CONTRIBUTION.CONFLICTS
        : String(maSignal).includes('bull')
          ? DIRECTIONAL_CONTRIBUTION.SUPPORTS
          : DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapTrendPersistedRun({ row = {}, output: rawOutput, input: rawInput, nowMs } = {}) {
  const output = parseJsonObject(rawOutput ?? row.output ?? row.output_data);
  const input = parseJsonObject(rawInput ?? row.input ?? row.input_data);
  const analysisTimestamp = asIsoOrNull(output.timestamp) || asIsoOrNull(row.created_at);
  const candleTimestamp = asIsoOrNull(output.last_candle_timestamp);
  const timeframe = knownTimeframe(output.timeframe || input.timeframe);
  const freshness = resolveFreshness({
    analysisTimestamp,
    sourceCandleTimestamp: candleTimestamp,
    timeframe,
    policyId: 'trend-closed-candle',
    nowMs,
  });

  if (output.error || output.errorMessage) {
    return {
      ok: true,
      envelope: buildBaseEnvelope({
        agentId: 'trend',
        adapterVersion: ADAPTER_VERSIONS.trend,
        runId: row.id || null,
        agentRecordId: row.agent_id || row.agentId || null,
        analysisTimestamp: analysisTimestamp || new Date().toISOString(),
        createdAt: row.created_at,
        symbol: output.symbol || input.symbol || null,
        timeframe,
        correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
        availability: AVAILABILITY.UNAVAILABLE,
        unavailableReason: 'trend_run_failed',
        lifecycleStatus: LIFECYCLE_STATUS.FAILED,
        limitations: ['trend_run_failed'],
        executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
        freshness,
        dataQuality: resolveDataQuality({
          mockOrPlaceholder: false,
          sourceAvailability: 'unavailable',
          sampleAdequacy: 'insufficient',
          freshnessStatus: freshness.status,
          knownLimitationKeys: ['trend_run_failed'],
        }),
        confidence: unavailableConfidence('trend_strength_is_not_confidence', { methodKey: 'trend_wp_b1_no_epistemic_confidence' }),
        provenance: { writer: 'trendEvidenceAdapter', source: 'ai_decisions.output_data', adapterVersion: ADAPTER_VERSIONS.trend },
      }),
    };
  }

  const direction = mapDirection(output.trend?.direction);
  const adxValue = asFiniteNumber(output.adx?.value);
  const strengthValue = asFiniteNumber(output.trend?.confidence);
  const conclusion = {
    direction,
    regime: mapRegime(direction, adxValue),
    strength:
      strengthValue == null
        ? { availability: 'unavailable', reasonKey: 'trend_strength_missing' }
        : {
            value: strengthValue,
            scale: STRENGTH_SCALE.PERCENT_100,
            provenance: 'trend.raw.trend.confidence',
          },
  };

  const limitations = ['advisory_only', 'trend_confidence_unavailable'];
  if (freshness.status === 'unknown') limitations.push(freshness.reasonKey || 'freshness_unknown');

  return {
    ok: true,
    envelope: buildBaseEnvelope({
      agentId: 'trend',
      adapterVersion: ADAPTER_VERSIONS.trend,
      runId: row.id || null,
      agentRecordId: row.agent_id || row.agentId || null,
      analysisTimestamp: analysisTimestamp || new Date().toISOString(),
      createdAt: row.created_at,
      symbol: output.symbol || input.symbol || null,
      timeframe,
      provider: output._meta?.dataProvider || null,
      correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
      availability: AVAILABILITY.AVAILABLE,
      unavailableReason: null,
      lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
      limitations,
      executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
      freshness,
      dataQuality: resolveDataQuality({
        sourceAvailability: output.trend ? 'available' : 'unavailable',
        sampleAdequacy: output.adx || output.trend ? 'ok' : 'insufficient',
        mockOrPlaceholder: String(output._meta?.source || '').toLowerCase() === 'mock',
        freshnessStatus: freshness.status,
        knownLimitationKeys: limitations,
      }),
      confidence: unavailableConfidence('trend_strength_is_not_confidence', { methodKey: 'trend_wp_b1_no_epistemic_confidence' }),
      conclusion,
      evidence: buildTrendEvidence(output),
      provenance: {
        writer: 'trendEvidenceAdapter',
        source: 'ai_decisions.output_data',
        adapterVersion: ADAPTER_VERSIONS.trend,
        note: '_meta.confidence is normalized trend strength and is not canonical confidence',
      },
    }),
  };
}

export default { mapTrendPersistedRun };
