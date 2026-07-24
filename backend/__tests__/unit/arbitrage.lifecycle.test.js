/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  OPPORTUNITY_LIFECYCLE,
  mapOpportunityLifecycle,
  annotateCandidatesWithLifecycle,
  aggregateLifecycleMetrics,
  REJECTION_REASONS,
} from '../../services/arbitrageScanContract.js';

describe('arbitrage opportunity lifecycle', () => {
  it('maps spread candidates to detected or validated', () => {
    expect(
      mapOpportunityLifecycle(
        { classification: 'spread_candidate', netSpreadPct: 0.1 },
        { demoMode: true, killSwitchActive: true },
      ),
    ).toBe(OPPORTUNITY_LIFECYCLE.VALIDATED);
    expect(
      mapOpportunityLifecycle({ classification: 'spread_candidate', netSpreadPct: 0 }, { demoMode: true }),
    ).toBe(OPPORTUNITY_LIFECYCLE.DETECTED);
  });

  it('maps rejected candidates to rejected lifecycle', () => {
    expect(
      mapOpportunityLifecycle(
        { classification: 'rejected_candidate', rejectionReason: REJECTION_REASONS.STALE_QUOTE },
        {},
      ),
    ).toBe(OPPORTUNITY_LIFECYCLE.REJECTED);
  });

  it('aggregates lifecycle metrics without execution states', () => {
    const metrics = aggregateLifecycleMetrics(
      [{ classification: 'spread_candidate', netSpreadPct: 0.2 }],
      [{ classification: 'rejected_candidate', rejectionReason: REJECTION_REASONS.MISSING_QUOTE }],
      { demoMode: true, killSwitchActive: true },
    );
    expect(metrics.validated).toBe(1);
    expect(metrics.rejected).toBe(1);
    expect(metrics.detected).toBe(0);
    expect(metrics.submitted).toBeUndefined();
  });

  it('annotates candidates with lifecycle field', () => {
    const rows = annotateCandidatesWithLifecycle(
      [{ classification: 'spread_candidate', netSpreadPct: 0.05 }],
      { demoMode: true },
    );
    expect(rows[0].lifecycle).toBe(OPPORTUNITY_LIFECYCLE.VALIDATED);
  });
});
