/**
 * Read-only Risk → Artemis control/veto adapter.
 * Risk score and VaR alpha are not predictive confidence. No directional vote.
 */

import {
  AVAILABILITY,
  CONTROL_KIND,
  CONTROL_OUTCOME,
  CORRELATION_FAMILY,
  DIRECTION,
  DIRECTIONAL_CONTRIBUTION,
  EVIDENCE_TYPE,
  EXECUTION_CLASS,
} from '../../contracts/artemisEvidenceContract.js';
import { asFiniteNumber, unavailableConfidence } from '../artemisEvidenceTruth.js';
import { scalarEvidenceValue } from './support.js';
import {
  availableEnvelope,
  failClosedEnvelope,
  hasError,
} from './common.js';

function mapRiskControl(level) {
  const value = String(level || '').toUpperCase();
  if (value === 'CRITICAL' || value === 'HIGH') {
    return { kind: CONTROL_KIND.VETO, outcome: CONTROL_OUTCOME.REJECT, reasonKey: 'risk_level_blocks' };
  }
  if (value === 'MODERATE') {
    return { kind: CONTROL_KIND.LIMIT, outcome: CONTROL_OUTCOME.LIMIT, reasonKey: 'risk_level_limits' };
  }
  if (value === 'LOW' || value === 'VERY_LOW') {
    return { kind: CONTROL_KIND.VETO, outcome: CONTROL_OUTCOME.PASS, reasonKey: 'risk_level_pass' };
  }
  return null;
}

function buildEvidence(output) {
  const items = [];
  const score = asFiniteNumber(output.analysis?.overall_risk_score);
  if (score != null) {
    items.push({
      evidenceId: 'risk-overall-score',
      evidenceType: EVIDENCE_TYPE.POLICY,
      canonicalSource: 'risk.analysis.overall_risk_score',
      value: score,
      unit: 'score_100',
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NOT_APPLICABLE,
    });
  }
  const level = scalarEvidenceValue(output.analysis?.overall_risk_level);
  if (level) {
    items.push({
      evidenceId: 'risk-overall-level',
      evidenceType: EVIDENCE_TYPE.POLICY,
      canonicalSource: 'risk.analysis.overall_risk_level',
      value: level,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NOT_APPLICABLE,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapRiskPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = {
    agentId: 'risk',
    row,
    output,
    input,
    nowMs,
    correlationFamily: CORRELATION_FAMILY.ACCOUNT_STATE,
  };
  const unavailableControl = {
    kind: CONTROL_KIND.UNAVAILABLE,
    availability: AVAILABILITY.UNAVAILABLE,
    outcome: CONTROL_OUTCOME.UNAVAILABLE,
    reasonKey: 'risk_control_unavailable',
  };
  if (hasError(output)) {
    return failClosedEnvelope({
      ...args,
      reason: 'risk_run_failed',
      extra: { conclusion: { direction: DIRECTION.NOT_APPLICABLE }, control: unavailableControl },
    });
  }
  const mapped = mapRiskControl(output.analysis?.overall_risk_level);
  if (!mapped) {
    return failClosedEnvelope({
      ...args,
      reason: 'risk_level_missing',
      extra: { conclusion: { direction: DIRECTION.NOT_APPLICABLE }, control: unavailableControl },
    });
  }
  return availableEnvelope({
    ...args,
    limitations: ['control_veto_only', 'risk_score_is_not_predictive_confidence'],
    executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
    confidence: unavailableConfidence('risk_score_is_not_confidence', { methodKey: 'risk_no_predictive_confidence' }),
    conclusion: { direction: DIRECTION.NOT_APPLICABLE },
    control: {
      kind: mapped.kind,
      availability: AVAILABILITY.AVAILABLE,
      outcome: mapped.outcome,
      reasonKey: mapped.reasonKey,
    },
    evidence: buildEvidence(output),
    extra: { methodKey: 'risk_stage3_on_read_adapter' },
  });
}

export default { mapRiskPersistedRun };
