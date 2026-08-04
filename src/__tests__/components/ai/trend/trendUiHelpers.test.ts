import { describe, expect, it } from 'vitest';
import {
  integrationLabel,
  localizeRegime,
  resolveEvidenceText,
} from '../../../../../components/ai/trend/trendUiHelpers.ts';

const t = (key: string) =>
  ({
    trend_regime_transition: 'Transition',
    trend_weakening_adx: 'ADX developing',
    trend_int_public_market_data: 'Public market data',
  })[key] ?? key;

describe('trendUiHelpers', () => {
  it('localizes regime keys', () => {
    expect(localizeRegime('transition', t)).toBe('Transition');
  });

  it('resolves evidence interpretationKey before raw displayKey', () => {
    expect(
      resolveEvidenceText({ displayKey: 'trend_weakening_adx', interpretationKey: 'trend_weakening_adx' }, t),
    ).toBe('ADX developing');
  });

  it('maps integration labels', () => {
    expect(integrationLabel('publicMarketData', t)).toBe('Public market data');
  });
});
