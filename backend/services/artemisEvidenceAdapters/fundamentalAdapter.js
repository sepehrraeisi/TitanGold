/**
 * Read-only Fundamental → Artemis evidence adapter.
 * Does not emit lastPrice/marketCap zeros as measured success.
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
  nonZeroNumber,
} from './common.js';

function buildEvidence(output) {
  const items = [];
  const fearGreed = asFiniteNumber(output.marketSummary?.fearGreed);
  if (fearGreed != null) {
    items.push({
      evidenceId: 'fundamental-fear-greed',
      evidenceType: EVIDENCE_TYPE.METRIC,
      canonicalSource: 'fundamental.marketSummary.fearGreed',
      value: fearGreed,
      unit: 'index',
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const total = asFiniteNumber(output.score?.total ?? output.averageScore);
  if (total != null) {
    items.push({
      evidenceId: 'fundamental-total-score',
      evidenceType: EVIDENCE_TYPE.METRIC,
      canonicalSource: 'fundamental.score.total',
      value: total,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  const lastPrice = nonZeroNumber(output.overview?.lastPrice);
  if (lastPrice != null) {
    items.push({
      evidenceId: 'fundamental-last-price',
      evidenceType: EVIDENCE_TYPE.METRIC,
      canonicalSource: 'fundamental.overview.lastPrice',
      value: lastPrice,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NEUTRAL,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapFundamentalPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = {
    agentId: 'fundamental',
    row,
    output,
    input,
    nowMs,
    correlationFamily: CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
  };
  if (hasError(output)) {
    return failClosedEnvelope({ ...args, reason: 'fundamental_run_failed' });
  }
  if (detectMockSource(output)) {
    return failClosedEnvelope({ ...args, reason: 'mock_or_placeholder_source' });
  }
  const direction = mapMarketDirection(output.decision);
  const explicit = asFiniteNumber(output.confidence);
  return availableEnvelope({
    ...args,
    limitations: ['advisory_only', 'placeholder_news_onchain_scores'],
    executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
    sampleAdequacy: 'insufficient',
    confidence: explicit == null
      ? unavailableConfidence('fundamental_confidence_missing', { methodKey: 'fundamental_no_calibrated_confidence' })
      : heuristicConfidence({
          value: explicit,
          scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
          path: 'confidence',
        }),
    conclusion: { direction },
    evidence: buildEvidence(output),
    extra: {
      methodKey: 'fundamental_stage3_on_read_adapter',
      note: 'Zero lastPrice/marketCap are omitted; news/onchain scores may be placeholders',
    },
  });
}

export default { mapFundamentalPersistedRun };
