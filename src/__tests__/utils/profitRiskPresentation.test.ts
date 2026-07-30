import { describe, expect, it } from 'vitest';
import {
  formatBpsValue,
  formatLocalizedTimestamp,
  presentBps,
  presentEstimateState,
  presentNotionalDerivationBasis,
  presentNotionalValue,
  presentProfitNotRealizedDisclaimer,
  presentProfitValue,
  presentRiskScore,
  presentRiskScoreHelp,
  presentRunOptionLabel,
  presentFieldLabel,
  verifyProfitFormula,
  isRawProfitRiskKey,
} from '../../../utils/profitRiskPresentation.ts';

const t = (key: string) => {
  const map: Record<string, string> = {
    unavailable: 'Unavailable',
    arb_pr_state_unavailable: 'Unavailable',
    arb_pr_state_measured: 'Measured',
    arb_pr_state_assumption: 'Assumption',
    arb_pr_state_derived: 'Derived estimate',
    arb_pr_state_market_observation: 'Market observation',
    arb_pr_risk_unavailable: 'Risk score unavailable',
    arb_pr_notional_unavailable: 'Notional unavailable',
    arb_pr_analytical_notional: 'Analytical notional',
    arb_pr_estimated_analytical_profit: 'Estimated analytical profit',
    arb_pr_notional_derivation_basis:
      'Basis: 1% of public 24-hour market volume, capped at 10,000 USDT.',
    arb_pr_profit_not_realized_disclaimer:
      'This is not realized, captured, or executable profit.',
    arb_pr_risk_zero_measured_help: 'Lowest measured analytical risk',
    arb_pr_risk_source_run_risk_stats_average: 'Run aggregate risk statistics',
    scheduled: 'Scheduled',
    arb_scan_status_completed: 'Completed',
    arb_timestamp_unavailable: 'Timestamp unavailable',
  };
  return map[key] ?? key;
};

describe('profitRiskPresentation', () => {
  it('presents bps values without substituting state label as value', () => {
    expect(formatBpsValue(12.5)).toBe('12.50 bps');
    expect(presentBps(12.5, t)).toBe('12.50 bps');
    expect(presentBps(null, t)).toBe('Unavailable');
  });

  it('presents analytical notional with locale formatting', () => {
    expect(presentNotionalValue(10000, 'USDT', t, 'en-US')).toBe('10,000.00 USDT');
    expect(presentNotionalValue(null, 'USDT', t)).toBe('Unavailable');
  });

  it('shows derived estimate wording for notional basis', () => {
    expect(presentEstimateState('derived_estimate', t)).toBe('Derived estimate');
    expect(presentNotionalDerivationBasis(t)).toContain('1%');
    expect(presentNotionalDerivationBasis(t)).toContain('10,000 USDT');
  });

  it('verifies profit formula parity', () => {
    expect(verifyProfitFormula(10000, -14.165694, -14.165694)).toBe(true);
    expect(verifyProfitFormula(null, -14, null)).toBe(true);
    expect(verifyProfitFormula(1000, 10, 999)).toBe(false);
  });

  it('presents unavailable profit without notional', () => {
    expect(presentProfitValue(null, 'USDT', t)).toBe('Unavailable');
  });

  it('presents estimated analytical profit label and disclaimer', () => {
    expect(presentFieldLabel('estimatedAnalyticalProfit', t)).toBe('Estimated analytical profit');
    expect(presentProfitNotRealizedDisclaimer(t)).toContain('not realized');
  });

  it('presents valid zero risk with help', () => {
    expect(presentRiskScore(0, 'measured', t)).toBe('0 / 100');
    expect(presentRiskScoreHelp(0, 'measured', 'run_risk_stats_average', null, t)).toBe(
      'Lowest measured analytical risk',
    );
  });

  it('presents unavailable risk score', () => {
    expect(presentRiskScore(null, 'unavailable', t)).toBe('Risk score unavailable');
  });

  it('presents human-readable run selector label without raw UUID', () => {
    const label = presentRunOptionLabel(
      {
        runId: 'uuid-123',
        completedAt: '2026-07-30T15:34:00.000Z',
        trigger: 'scheduled',
        status: 'completed',
      },
      t,
      'en-US',
    );
    expect(label).toContain('Scheduled');
    expect(label).not.toContain('uuid-123');
  });

  it('detects raw keys', () => {
    expect(isRawProfitRiskKey('arb_pr_title')).toBe(true);
    expect(isRawProfitRiskKey('Analytical Profit')).toBe(false);
  });
});
