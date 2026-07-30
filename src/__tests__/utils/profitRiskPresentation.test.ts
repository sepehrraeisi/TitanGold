import { describe, expect, it } from 'vitest';
import {
  formatBpsValue,
  formatLocalizedTimestamp,
  presentBps,
  presentEstimateState,
  presentProfitValue,
  presentRiskScore,
  presentRunOptionLabel,
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

  it('presents negative net spread', () => {
    expect(presentBps(-19.08, t)).toBe('-19.08 bps');
  });

  it('presents unavailable profit without using derived estimate as monetary value', () => {
    expect(presentProfitValue(null, 'USDT', t)).toBe('Unavailable');
  });

  it('presents unavailable risk score', () => {
    expect(presentRiskScore(null, 'unavailable', t)).toBe('Risk score unavailable');
    expect(presentRiskScore(42, 'measured', t)).toBe('42 / 100');
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
    expect(label).toContain('Completed');
    expect(label).not.toContain('uuid-123');
  });

  it('formats localized timestamps without raw ISO as primary label', () => {
    const formatted = formatLocalizedTimestamp('2026-07-30T15:34:00.000Z', 'en-US', t);
    expect(formatted).not.toBe('2026-07-30T15:34:00.000Z');
    expect(formatted.length).toBeGreaterThan(5);
  });

  it('detects raw keys', () => {
    expect(isRawProfitRiskKey('arb_pr_title')).toBe(true);
    expect(isRawProfitRiskKey('Analytical Profit')).toBe(false);
  });

  it('presents estimate states for metric badges', () => {
    expect(presentEstimateState('assumption', t)).toBe('Assumption');
    expect(presentEstimateState('derived_estimate', t)).toBe('Derived estimate');
    expect(presentEstimateState('market_observation', t)).toBe('Market observation');
  });
});
