import { describe, expect, it } from 'vitest';
import {
  presentBps,
  presentEstimateState,
  presentRiskScore,
  isRawProfitRiskKey,
} from '../../../utils/profitRiskPresentation.ts';

const t = (key: string) => {
  const map: Record<string, string> = {
    unavailable: 'Unavailable',
    arb_pr_state_unavailable: 'Unavailable',
    arb_pr_state_measured: 'Measured',
    arb_pr_state_assumption: 'Assumption',
  };
  return map[key] ?? key;
};

describe('profitRiskPresentation', () => {
  it('presents bps values', () => {
    expect(presentBps(12.5, t)).toBe('12.50 bps');
    expect(presentBps(null, t)).toBe('Unavailable');
  });

  it('presents risk score with unavailable state', () => {
    expect(presentRiskScore(null, 'unavailable', t)).toBe('Unavailable');
    expect(presentRiskScore(42, 'measured', t)).toBe('42 / 100');
  });

  it('detects raw keys', () => {
    expect(isRawProfitRiskKey('arb_pr_title')).toBe(true);
    expect(isRawProfitRiskKey('Analytical Profit')).toBe(false);
  });

  it('presents estimate states', () => {
    expect(presentEstimateState('assumption', t)).toBe('Assumption');
  });
});
