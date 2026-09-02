/**
 * Read-only Sentiment → Artemis evidence adapter.
 * Fail-closed when every source is mock/error/empty. Heuristic source-count is not P(direction).
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
  allSentimentSourcesMockOrEmpty,
  availableEnvelope,
  failClosedEnvelope,
  hasError,
  mapMarketDirection,
} from './common.js';

function buildEvidence(output) {
  const items = [];
  const score = asFiniteNumber(output.result?.aggregate_sentiment);
  if (score != null) {
    items.push({
      evidenceId: 'sentiment-aggregate',
      evidenceType: EVIDENCE_TYPE.NARRATIVE,
      canonicalSource: 'sentiment.result.aggregate_sentiment',
      value: score,
      unit: 'unit_interval',
      directionalContribution: score > 0
        ? DIRECTIONAL_CONTRIBUTION.SUPPORTS
        : score < 0
          ? DIRECTIONAL_CONTRIBUTION.CONFLICTS
          : DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const label = scalarEvidenceValue(output.result?.sentiment_label);
  if (label) {
    items.push({
      evidenceId: 'sentiment-label',
      evidenceType: EVIDENCE_TYPE.NARRATIVE,
      canonicalSource: 'sentiment.result.sentiment_label',
      value: label,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapSentimentPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = {
    agentId: 'sentiment',
    row,
    output,
    input,
    nowMs,
    correlationFamily: CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
  };
  if (hasError(output)) {
    return failClosedEnvelope({ ...args, reason: 'sentiment_run_failed' });
  }
  if (!output.result?.sources || allSentimentSourcesMockOrEmpty(output)) {
    return failClosedEnvelope({ ...args, reason: 'mock_or_placeholder_source' });
  }
  const direction = mapMarketDirection(output.result?.sentiment_label);
  const explicit = asFiniteNumber(output.confidence);
  return availableEnvelope({
    ...args,
    limitations: ['advisory_only', 'sentiment_confidence_is_source_count_heuristic'],
    executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
    sampleAdequacy: 'insufficient',
    confidence: explicit == null
      ? unavailableConfidence('sentiment_confidence_missing', { methodKey: 'sentiment_no_calibrated_confidence' })
      : heuristicConfidence({
          value: explicit,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          path: 'confidence',
        }),
    conclusion: { direction },
    evidence: buildEvidence(output),
    extra: { methodKey: 'sentiment_stage3_on_read_adapter' },
  });
}

export default { mapSentimentPersistedRun };
