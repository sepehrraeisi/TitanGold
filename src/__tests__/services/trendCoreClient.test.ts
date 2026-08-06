import { describe, expect, it } from 'vitest';
import { buildSettingsPatch } from '../../../services/trendCoreClient.ts';

describe('buildSettingsPatch', () => {
  it('excludes read-only autoExecute from PATCH body', () => {
    const patch = buildSettingsPatch({
      symbol: 'ETH/USDT',
      timeframe: '15m',
      compareTimeframes: ['1h'],
      autoExecute: { supported: false, effective: false, reason: 'execution_blocked' },
      version: 2,
    } as any);
    expect(patch).toEqual({
      symbol: 'ETH/USDT',
      timeframe: '15m',
      compareTimeframes: ['1h'],
      version: 2,
    });
    expect(patch).not.toHaveProperty('autoExecute');
  });
});
