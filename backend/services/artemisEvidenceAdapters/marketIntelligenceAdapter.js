/**
 * Read-only Market Intelligence → Artemis evidence adapter.
 * Maps BUY/SELL recommendation to direction only. Never copies position_sizing into allocation.
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

function confidenceScale(value) {
  return value > 1 ? CONFIDENCE_SCALE.PERCENT_100 : CONFIDENCE_SCALE.UNIT_INTERVAL;
}

function buildEvidence(output) {
  const items = [];
  const action = scalarEvidenceValue(output.recommendation?.action);
  if (action) {
    items.push({
      evidenceId: 'mi-recommendation-action',
      evidenceType: EVIDENCE_TYPE.NARRATIVE,
      canonicalSource: 'market_intelligence.recommendation.action',
      value: action,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
      limitation: 'mapped_to_direction_only_not_execution_signal',
    });
  }
  const anomalyCount = asFiniteNumber(output.metadata?.anomalies_detected);
  if (anomalyCount != null) {
    items.push({
      evidenceId: 'mi-anomaly-count',
      evidenceType: EVIDENCE_TYPE.METRIC,
      canonicalSource: 'market_intelligence.metadata.anomalies_detected',
      value: anomalyCount,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapMarketIntelligencePersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = {
    agentId: 'market_intelligence',
    row,
    output,
    input,
    nowMs,
    correlationFamily: CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
    sourceTimestamp: output.metadata?.data_freshness?.news || output.metadata?.data_freshness?.macro,
  };
  if (hasError(output)) {
    return failClosedEnvelope({ ...args, reason: 'market_intelligence_run_failed' });
  }
  if (detectMockSource(output)) {
    return failClosedEnvelope({ ...args, reason: 'mock_or_placeholder_source' });
  }
  const direction = mapMarketDirection(output.recommendation?.action);
  const explicit = asFiniteNumber(output.confidence);
  return availableEnvelope({
    ...args,
    limitations: ['advisory_only', 'recommendation_action_is_not_execution_authorization'],
    executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
    confidence: explicit == null
      ? unavailableConfidence('market_intelligence_confidence_missing', { methodKey: 'mi_no_calibrated_confidence' })
      : heuristicConfidence({
          value: explicit,
          scale: confidenceScale(explicit),
          path: 'confidence',
        }),
    conclusion: { direction },
    evidence: buildEvidence(output),
    extra: {
      methodKey: 'market_intelligence_stage3_on_read_adapter',
      note: 'BUY/SELL mapped to direction only; position_sizing is not allocation authority',
    },
  });
}

export default { mapMarketIntelligencePersistedRun };
