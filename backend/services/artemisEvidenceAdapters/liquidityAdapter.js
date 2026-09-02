/**
 * Read-only Liquidity → Artemis feasibility adapter.
 * Registry owner is an MVP stub. Do not fabricate spread/depth from confidence 0.55.
 */

import {
  AVAILABILITY,
  DIRECTION,
  EXECUTION_CLASS,
  LIFECYCLE_STATUS,
} from '../../contracts/artemisEvidenceContract.js';
import { failClosedEnvelope } from './common.js';

export function mapLiquidityPersistedRun({ row = {}, output = {}, input = {}, nowMs } = {}) {
  return failClosedEnvelope({
    agentId: 'liquidity',
    row,
    output,
    input,
    nowMs,
    reason: 'liquidity_feasibility_not_implemented',
    executionClass: EXECUTION_CLASS.NONE,
    extra: {
      availability: AVAILABILITY.BLOCKED,
      lifecycleStatus: LIFECYCLE_STATUS.SKIPPED,
      recommendedNextActionClass: 'unavailable',
      conclusion: { direction: DIRECTION.NOT_APPLICABLE },
      feasibility: {
        availability: AVAILABILITY.UNAVAILABLE,
        reasonKey: 'liquidity_stub_no_order_book',
      },
      note: 'MVP stub is not execution-feasibility evidence; no fabricated spread/depth',
    },
  });
}

export default { mapLiquidityPersistedRun };
