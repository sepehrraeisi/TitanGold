/**
 * Read-only Order → Artemis execution-class metadata adapter.
 * Does not enable BUY/SELL/EXECUTE/LIVE/approved_for_execution.
 * Existing mutation capability is unchanged and not expanded.
 */

import {
  AVAILABILITY,
  CORRELATION_FAMILY,
  DIRECTION,
  DIRECTIONAL_CONTRIBUTION,
  EVIDENCE_TYPE,
  EXECUTION_CLASS,
  LIFECYCLE_STATUS,
} from '../../contracts/artemisEvidenceContract.js';
import { scalarEvidenceValue } from './support.js';
import {
  availableEnvelope,
  failClosedEnvelope,
  hasError,
} from './common.js';
import { unavailableConfidence } from '../artemisEvidenceTruth.js';

function buildEvidence(output) {
  const items = [];
  const action = scalarEvidenceValue(output.action);
  if (action) {
    items.push({
      evidenceId: 'order-action',
      evidenceType: EVIDENCE_TYPE.OTHER,
      canonicalSource: 'order.action',
      value: action,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NOT_APPLICABLE,
      limitation: 'metadata_only_not_execution_authorization',
    });
  }
  if (output.result?.dry_run === true || output.result?.simulated === true) {
    items.push({
      evidenceId: 'order-dry-run',
      evidenceType: EVIDENCE_TYPE.OTHER,
      canonicalSource: 'order.result.dry_run',
      value: true,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NOT_APPLICABLE,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapOrderPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  const args = {
    agentId: 'order',
    row,
    output,
    input,
    nowMs,
    correlationFamily: CORRELATION_FAMILY.EXECUTION_PATH,
  };
  const baseExtra = {
    conclusion: { direction: DIRECTION.NOT_APPLICABLE },
    recommendedNextActionClass: 'not_applicable',
  };
  if (hasError(output)) {
    return failClosedEnvelope({
      ...args,
      reason: 'order_run_failed',
      executionClass: EXECUTION_CLASS.NONE,
      extra: baseExtra,
    });
  }
  return availableEnvelope({
    ...args,
    limitations: ['order_execution_only', 'not_execution_eligible', 'stage3_metadata_only'],
    executionClass: EXECUTION_CLASS.NONE,
    recommendedNextActionClass: 'not_applicable',
    confidence: unavailableConfidence('order_has_no_predictive_confidence', { methodKey: 'order_no_predictive_confidence' }),
    conclusion: { direction: DIRECTION.NOT_APPLICABLE },
    evidence: buildEvidence(output),
    extra: {
      methodKey: 'order_stage3_on_read_adapter',
      note: 'Compatibility metadata only; does not authorize or replay execution',
      lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
    },
  });
}

export default { mapOrderPersistedRun };
