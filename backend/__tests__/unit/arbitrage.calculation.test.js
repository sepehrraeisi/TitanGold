/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { calculateSpread, calculateNetProfit } from '../../services/agents/arbitrage.js';
import { mapOpportunityLifecycle, REJECTION_REASONS, OPPORTUNITY_LIFECYCLE } from '../../services/arbitrageScanContract.js';

describe('arbitrage calculation truthfulness', () => {
  it('computes gross spread from bid/ask', () => {
    expect(calculateSpread(100, 101)).toBeCloseTo(0.990099, 4);
    expect(calculateSpread(0, 101)).toBe(0);
  });

  it('subtracts fees and slippage from gross spread for net spread', () => {
    const gross = 1.0;
    const calc = calculateNetProfit(gross, 10000, { feeBps: 10, slippageBps: 10 });
    expect(calc.grossSpreadPct).toBe(1.0);
    expect(calc.feePct).toBeCloseTo(0.1, 6);
    expect(calc.slippagePct).toBeCloseTo(0.1, 6);
    expect(calc.netSpreadPct).toBeCloseTo(0.8, 6);
    expect(calc.profitUSDT).toBeCloseTo(80, 4);
  });

  it('does not mark profitable on raw spread alone when net is non-positive', () => {
    const calc = calculateNetProfit(0.05, 1000, { feeBps: 10, slippageBps: 10 });
    expect(calc.netSpreadPct).toBeLessThan(0);
    const lifecycle = mapOpportunityLifecycle(
      { classification: 'spread_candidate', netSpreadPct: calc.netSpreadPct },
      { demoMode: true, killSwitchActive: true },
    );
    expect(lifecycle).toBe(OPPORTUNITY_LIFECYCLE.DETECTED);
    expect(lifecycle).not.toBe(OPPORTUNITY_LIFECYCLE.VALIDATED);
  });

  it('maps stale and duplicate rejections to rejected lifecycle', () => {
    expect(
      mapOpportunityLifecycle(
        { classification: 'rejected_candidate', rejectionReason: REJECTION_REASONS.STALE_QUOTE },
        { demoMode: true },
      ),
    ).toBe(OPPORTUNITY_LIFECYCLE.REJECTED);
    expect(
      mapOpportunityLifecycle(
        { classification: 'rejected_candidate', rejectionReason: REJECTION_REASONS.INSUFFICIENT_DEPTH },
        { demoMode: true },
      ),
    ).toBe(OPPORTUNITY_LIFECYCLE.REJECTED);
  });

  it('never exposes submitted/filled/executed lifecycle states', () => {
    expect(Object.values(OPPORTUNITY_LIFECYCLE)).not.toContain('submitted');
    expect(Object.values(OPPORTUNITY_LIFECYCLE)).not.toContain('filled');
    expect(Object.values(OPPORTUNITY_LIFECYCLE)).not.toContain('executed');
  });
});
