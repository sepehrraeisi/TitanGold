/**
 * Read-only Technical → Artemis evidence adapter.
 * Production owner always emits _meta.source=mock; fail-closed unless a proven source exists.
 */

import {
  CONFIDENCE_SCALE,
  CORRELATION_FAMILY,
  DIRECTIONAL_CONTRIBUTION,
  EVIDENCE_TYPE,
  EXECUTION_CLASS,
} from '../../contracts/artemisEvidenceContract.js';
import { asFiniteNumber, heuristicConfidence, unavailableConfidence } from '../artemisEvidenceTruth.js';
import {
  availableEnvelope,
  detectMockSource,
  failClosedEnvelope,
  hasError,
  mapMarketDirection,
} from './common.js';

function buildEvidence(output) {
  const items = [];
  const rsi = asFiniteNumber(output.indicators?.rsi);
  if (rsi != null) {
    items.push({
      evidenceId: 'technical-rsi',
      evidenceType: EVIDENCE_TYPE.INDICATOR,
      canonicalSource: 'technical.indicators.rsi',
      value: rsi,
      unit: 'rsi',
      directionalContribution: rsi > 70
        ? DIRECTIONAL_CONTRIBUTION.CONFLICTS
        : rsi < 30
          ? DIRECTIONAL_CONTRIBUTION.SUPPORTS
          : DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const histogram = asFiniteNumber(output.indicators?.macd?.histogram);
  if (histogram != null) {
    items.push({
      evidenceId: 'technical-macd-histogram',
      evidenceType: EVIDENCE_TYPE.INDICATOR,
      canonicalSource: 'technical.indicators.macd.histogram',
      value: histogram,
      directionalContribution: histogram > 0
        ? DIRECTIONAL_CONTRIBUTION.SUPPORTS
        : histogram < 0
          ? DIRECTIONAL_CONTRIBUTION.CONFLICTS
          : DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapTechnicalPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = { agentId: 'technical', row, output, input, nowMs, correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE };
  if (hasError(output)) {
    return failClosedEnvelope({ ...args, reason: 'technical_run_failed' });
  }
  const provenCandle = Boolean(output.last_candle_timestamp);
  const provenProvider = Boolean(output._meta?.dataProvider || output.meta?.dataProvider);
  if (detectMockSource(output) || !provenCandle || !provenProvider) {
    return failClosedEnvelope({ ...args, reason: 'mock_or_placeholder_source' });
  }
  const direction = mapMarketDirection(output.indicators?.trend || output.signal);
  const explicit = asFiniteNumber(output.confidence);
  return availableEnvelope({
    ...args,
    limitations: ['advisory_only', 'technical_heuristic_confidence_uncalibrated'],
    executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
    confidence: explicit == null
      ? unavailableConfidence('technical_confidence_missing', { methodKey: 'technical_no_epistemic_confidence' })
      : heuristicConfidence({
          value: explicit,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          path: 'confidence',
        }),
    conclusion: { direction },
    evidence: buildEvidence(output),
    extra: { methodKey: 'technical_stage3_on_read_adapter', note: 'RSI/MACD are indicators, not predictive confidence' },
  });
}

export default { mapTechnicalPersistedRun };
