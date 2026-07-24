/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { getProductIdentity, buildSettingsDto } from '../../services/arbitrageDomain.js';

describe('arbitrageCore execution safety projection', () => {
  it('product identity never advertises execution support', () => {
    const product = getProductIdentity();
    expect(product.executionSupported).toBe(false);
    expect(product.executionEligible).toBe(false);
    expect(product.displayName).toContain('MEXC Spot Spread Monitor');
    expect(product.unavailableModes.some((m) => m.state === 'blocked')).toBe(true);
  });

  it('settings DTO normalizes legacy autoExecute to unsupported', () => {
    const settings = buildSettingsDto({
      symbols: ['BTCUSDT'],
      execution: { autoExecute: true },
    });
    expect(settings.executionSupported).toBe(false);
    expect(settings.executionEligible).toBe(false);
    expect(settings.legacyExecutionPreferenceIgnored).toBe(true);
  });
});
