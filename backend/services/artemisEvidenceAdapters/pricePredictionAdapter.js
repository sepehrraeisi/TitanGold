/**
 * Read-only Price Prediction → Artemis opportunity adapter.
 * Mock predictor output is fail-closed. Heuristic confidence is not MODEL_PROBABILITY.
 */

import {
  AVAILABILITY,
  CONFIDENCE_SCALE,
  CORRELATION_FAMILY,
  DIRECTION,
  EXECUTION_CLASS,
  OPPORTUNITY_KIND,
} from '../../contracts/artemisEvidenceContract.js';
import { asFiniteNumber, heuristicConfidence, unavailableConfidence } from '../artemisEvidenceTruth.js';
import {
  availableEnvelope,
  detectMockSource,
  failClosedEnvelope,
  hasError,
} from './common.js';

function forecastDirection(output) {
  const current = asFiniteNumber(output.current_price);
  const predicted = asFiniteNumber(
    output.predictions?.['24h']?.price
    ?? output.predictions?.['4h']?.price
    ?? output.predictions?.['1h']?.price,
  );
  if (current == null || predicted == null) return DIRECTION.UNAVAILABLE;
  if (predicted > current) return DIRECTION.BULLISH;
  if (predicted < current) return DIRECTION.BEARISH;
  return DIRECTION.NEUTRAL;
}

export function mapPricePredictionPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = {
    agentId: 'price_prediction',
    row,
    output,
    input,
    nowMs,
    correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
  };
  if (hasError(output)) {
    return failClosedEnvelope({ ...args, reason: 'price_prediction_run_failed' });
  }
  if (detectMockSource(output) || String(output.method || '').toLowerCase() === 'mock') {
    return failClosedEnvelope({ ...args, reason: 'mock_or_placeholder_source' });
  }
  const explicit = asFiniteNumber(output._meta?.confidence ?? output.insights?.confidence_score);
  return availableEnvelope({
    ...args,
    limitations: ['advisory_only', 'forecast_heuristic_not_calibrated_probability'],
    executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
    confidence: explicit == null
      ? unavailableConfidence('price_prediction_confidence_missing', { methodKey: 'price_prediction_no_calibrated_confidence' })
      : heuristicConfidence({
          value: explicit,
          scale: explicit > 1 ? CONFIDENCE_SCALE.PERCENT_100 : CONFIDENCE_SCALE.UNIT_INTERVAL,
          path: output._meta?.confidence != null ? '_meta.confidence' : 'insights.confidence_score',
        }),
    conclusion: { direction: forecastDirection(output) },
    opportunity: {
      kind: OPPORTUNITY_KIND.FORECAST,
      availability: AVAILABILITY.AVAILABLE,
      horizon: output.timeframe || input.timeframe || null,
      reasonKey: 'price_prediction_statistical_forecast',
    },
    extra: {
      methodKey: 'price_prediction_stage3_on_read_adapter',
      modelAlgorithmVersion: output.method || output._meta?.model || undefined,
      note: 'Forecast opportunity only; not an execution instruction',
    },
  });
}

export default { mapPricePredictionPersistedRun };
