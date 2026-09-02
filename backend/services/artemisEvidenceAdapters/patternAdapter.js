/**
 * Read-only Pattern → Artemis evidence adapter.
 * Production meta.source is always 'realtime' even after mock OHLCV fallback.
 * Fail-closed unless a proven candle timestamp and dataProvider exist.
 */

import {
  CONFIDENCE_SCALE,
  CORRELATION_FAMILY,
  DIRECTIONAL_CONTRIBUTION,
  EVIDENCE_TYPE,
  EXECUTION_CLASS,
} from '../../contracts/artemisEvidenceContract.js';
import { asFiniteNumber, heuristicConfidence, unavailableConfidence } from '../artemisEvidenceTruth.js';
import { scalarEvidenceValue } from './support.js';
import {
  availableEnvelope,
  detectMockSource,
  failClosedEnvelope,
  hasError,
  mapMarketDirection,
} from './common.js';

function buildEvidence(output) {
  const items = [];
  const count = asFiniteNumber(output.result?.patterns_detected);
  if (count != null) {
    items.push({
      evidenceId: 'pattern-count',
      evidenceType: EVIDENCE_TYPE.METRIC,
      canonicalSource: 'pattern.result.patterns_detected',
      value: count,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const dominant = scalarEvidenceValue(output.result?.dominant_signal);
  if (dominant) {
    items.push({
      evidenceId: 'pattern-dominant-signal',
      evidenceType: EVIDENCE_TYPE.PATTERN,
      canonicalSource: 'pattern.result.dominant_signal',
      value: dominant,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapPatternPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = { agentId: 'pattern', row, output, input, nowMs, correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE };
  if (hasError(output)) {
    return failClosedEnvelope({ ...args, reason: 'pattern_run_failed' });
  }
  const provenCandle = Boolean(output.last_candle_timestamp);
  const provenProvider = Boolean(output._meta?.dataProvider || output.meta?.dataProvider);
  if (detectMockSource(output) || !provenCandle || !provenProvider) {
    return failClosedEnvelope({ ...args, reason: 'mock_or_placeholder_source' });
  }
  const direction = mapMarketDirection(
    output.result?.dominant_signal || output.result?.recommendation?.action || output.result?.recommendation,
  );
  const explicit = asFiniteNumber(output.confidence);
  return availableEnvelope({
    ...args,
    limitations: ['advisory_only', 'pattern_confidence_is_pattern_score_not_probability'],
    executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
    confidence: explicit == null
      ? unavailableConfidence('pattern_confidence_missing', { methodKey: 'pattern_no_calibrated_confidence' })
      : heuristicConfidence({
          value: explicit,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          path: 'confidence',
        }),
    conclusion: { direction },
    evidence: buildEvidence(output),
    extra: {
      methodKey: 'pattern_stage3_on_read_adapter',
      note: 'Requires proven candle timestamp and dataProvider; mock OHLCV is fail-closed',
    },
  });
}

export default { mapPatternPersistedRun };
