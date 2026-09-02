/**
 * Read-only Portfolio → Artemis allocation/sizing adapter.
 * Weights are not buy/sell recommendations. Sharpe heuristic is not confidence.
 */

import {
  AVAILABILITY,
  CORRELATION_FAMILY,
  DIRECTION,
  DIRECTIONAL_CONTRIBUTION,
  EVIDENCE_TYPE,
  EXECUTION_CLASS,
} from '../../contracts/artemisEvidenceContract.js';
import { asFiniteNumber, unavailableConfidence } from '../artemisEvidenceTruth.js';
import {
  availableEnvelope,
  failClosedEnvelope,
  hasError,
} from './common.js';

function weightEntries(weights) {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) return [];
  return Object.entries(weights)
    .map(([symbol, value]) => [symbol, asFiniteNumber(value)])
    .filter(([, value]) => value != null)
    .slice(0, 16);
}

function buildEvidence(output) {
  return {
    items: weightEntries(output.optimal_allocation?.weights).map(([symbol, value], index) => ({
      evidenceId: `portfolio-weight-${index + 1}`,
      evidenceType: EVIDENCE_TYPE.METRIC,
      canonicalSource: 'portfolio.optimal_allocation.weights',
      value,
      unit: 'weight_ratio',
      interpretation: symbol,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NOT_APPLICABLE,
    })),
  };
}

export function mapPortfolioPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = {
    agentId: 'portfolio',
    row,
    output,
    input,
    nowMs,
    correlationFamily: CORRELATION_FAMILY.ACCOUNT_STATE,
  };
  const unavailableAllocation = {
    availability: AVAILABILITY.UNAVAILABLE,
    reasonKey: 'portfolio_weights_unavailable',
  };
  if (hasError(output)) {
    return failClosedEnvelope({
      ...args,
      reason: 'portfolio_run_failed',
      extra: { conclusion: { direction: DIRECTION.NOT_APPLICABLE }, allocation: unavailableAllocation },
    });
  }
  const entries = weightEntries(output.optimal_allocation?.weights);
  if (!entries.length) {
    return failClosedEnvelope({
      ...args,
      reason: 'portfolio_weights_missing',
      extra: { conclusion: { direction: DIRECTION.NOT_APPLICABLE }, allocation: unavailableAllocation },
    });
  }
  return availableEnvelope({
    ...args,
    limitations: ['control_sizing_only', 'portfolio_sharpe_is_not_predictive_confidence'],
    executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
    confidence: unavailableConfidence('portfolio_sharpe_is_not_confidence', { methodKey: 'portfolio_no_predictive_confidence' }),
    conclusion: { direction: DIRECTION.NOT_APPLICABLE },
    allocation: {
      availability: AVAILABILITY.AVAILABLE,
      unit: 'weight_ratio',
      reasonKey: 'portfolio_optimal_weights',
    },
    evidence: buildEvidence(output),
    extra: { methodKey: 'portfolio_stage3_on_read_adapter' },
  });
}

export default { mapPortfolioPersistedRun };
