/**
 * Read-only Optimization → Artemis not_applicable adapter.
 * Stage 2 authority remains NOT_APPLICABLE. Backtest BUY/SELL is not mapped.
 */

import {
  AVAILABILITY,
  DIRECTION,
  EXECUTION_CLASS,
  LIFECYCLE_STATUS,
} from '../../contracts/artemisEvidenceContract.js';
import { failClosedEnvelope } from './common.js';

export function mapOptimizationPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  return failClosedEnvelope({
    agentId: 'optimization',
    row,
    output,
    input,
    nowMs,
    reason: 'optimization_not_sizing_authority',
    executionClass: EXECUTION_CLASS.NOT_APPLICABLE,
    extra: {
      availability: AVAILABILITY.NOT_APPLICABLE,
      lifecycleStatus: LIFECYCLE_STATUS.SKIPPED,
      recommendedNextActionClass: 'not_applicable',
      conclusion: { direction: DIRECTION.NOT_APPLICABLE },
      note: 'Stage 2 mapping remains not_applicable; backtest metrics are not control authority',
    },
  });
}

export default { mapOptimizationPersistedRun };
