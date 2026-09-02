/**
 * Read-only Optimization → Artemis not_applicable adapter.
 * Registry owner (`services/agents/optimization.js`) is a real backtester, not sizing authority.
 * Stage 3 class C: normalize native backtest output to Stage 2 NOT_APPLICABLE.
 * Do not map BUY/SELL into control/sizing/direction. Authority mapping unchanged.
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
