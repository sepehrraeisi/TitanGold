/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  sanitizeConfigForWrite,
  validateSettingsInput,
} from '../../services/arbitrageDomain.js';

describe('arbitrageCore autoExecute safety', () => {
  it('validateSettingsInput rejects autoExecute=true', () => {
    const result = validateSettingsInput({
      monitoredSymbols: ['BTCUSDT'],
      execution: { autoExecute: true },
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('Auto Execute'))).toBe(true);
  });

  it('sanitizeConfigForWrite forces autoExecute false and preserves stored preference', () => {
    const sanitized = sanitizeConfigForWrite({
      symbols: ['BTCUSDT'],
      execution: {
        autoExecute: true,
        preferSpeed: true,
      },
      autoTrade: true,
    });

    expect(sanitized.execution.autoExecute).toBe(false);
    expect(sanitized.execution.autoExecuteStoredPreference).toBe(true);
    expect(sanitized.execution.autoExecuteSupported).toBe(false);
    expect(sanitized.autoTrade).toBe(false);
  });

  it('sanitizeConfigForWrite keeps autoExecute false when already false', () => {
    const sanitized = sanitizeConfigForWrite({
      execution: { autoExecute: false },
    });

    expect(sanitized.execution.autoExecute).toBe(false);
    expect(sanitized.execution.autoExecuteStoredPreference).toBe(false);
  });
});
