import { describe, expect, it } from 'vitest';
import {
  integrationLabel,
  localizeRegime,
  filterComparableHistoryRuns,
  resolveEvidenceText,
} from '../../../../../components/ai/trend/trendUiHelpers.ts';
import type { TrendRunSummary } from '../../../../../services/trendCoreClient.ts';

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

  it('filterComparableHistoryRuns isolates symbol and timeframe', () => {
    const runs = [
      { runId: '1', status: 'completed', symbol: 'BTC/USDT', timeframe: '1h', snapshotSummary: { adx: 25 }, startedAt: '2026-08-01' },
      { runId: '2', status: 'completed', symbol: 'ETH/USDT', timeframe: '1h', snapshotSummary: { adx: 18 }, startedAt: '2026-08-02' },
      { runId: '3', status: 'failed', symbol: 'BTC/USDT', timeframe: '1h', snapshotSummary: {}, startedAt: '2026-08-03' },
    ] as TrendRunSummary[];
    const btc = filterComparableHistoryRuns(runs, 'BTC/USDT', '1h');
    expect(btc.map((r) => r.runId)).toEqual(['1']);
  });
});
