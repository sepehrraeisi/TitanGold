/**
 * Read-only Timing → Artemis opportunity adapter.
 * Production always uses generateMockHistoricalData. Fail-closed unless a proven source exists.
 */

import {
  AVAILABILITY,
  CONFIDENCE_SCALE,
  CORRELATION_FAMILY,
  EXECUTION_CLASS,
  OPPORTUNITY_KIND,
} from '../../contracts/artemisEvidenceContract.js';
import { asFiniteNumber, heuristicConfidence, unavailableConfidence } from '../artemisEvidenceTruth.js';
import {
  availableEnvelope,
  detectMockSource,
  failClosedEnvelope,
  hasError,
  mapMarketDirection,
} from './common.js';

function isTimingMock(output) {
  const source = String(output._meta?.source || '').toLowerCase();
  return source === 'timing_agent' || detectMockSource(output);
}

export function mapTimingPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = {
    agentId: 'timing',
    row,
    output,
    input,
    nowMs,
    correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
  };
  if (hasError(output)) {
    return failClosedEnvelope({ ...args, reason: 'timing_run_failed' });
  }
  const provenCandle = Boolean(output.last_candle_timestamp);
  const provenProvider = Boolean(output._meta?.dataProvider || output.meta?.dataProvider);
  if (isTimingMock(output) || !provenCandle || !provenProvider) {
    return failClosedEnvelope({ ...args, reason: 'mock_or_placeholder_source' });
  }
  const explicit = asFiniteNumber(output.confidence);
  return availableEnvelope({
    ...args,
    limitations: ['advisory_only', 'timing_score_is_not_predictive_confidence'],
    executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
    confidence: explicit == null
      ? unavailableConfidence('timing_confidence_missing', { methodKey: 'timing_no_calibrated_confidence' })
      : heuristicConfidence({
          value: explicit,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          path: 'confidence',
        }),
    conclusion: { direction: mapMarketDirection(output.signal || output.analysis?.recommendations?.action) },
    opportunity: {
      kind: OPPORTUNITY_KIND.TIMING_WINDOW,
      availability: AVAILABILITY.AVAILABLE,
      reasonKey: 'timing_window_from_cycle_analysis',
    },
    extra: { methodKey: 'timing_stage3_on_read_adapter' },
  });
}

export default { mapTimingPersistedRun };
