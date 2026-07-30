import { describe, it, expect } from 'vitest';
import {
  settingsDraftEquals,
  validateSettingsDraft,
  editableSettingsPayload,
} from '../../../utils/settingsPresentation.ts';
import type { ArbitrageCoreSettings } from '../../../services/api.ts';

const settings: ArbitrageCoreSettings = {
  monitoredSymbols: ['BTCUSDT'],
  minimumNetSpreadBps: 25,
  assumedFeesBps: 10,
  assumedSlippageBps: 10,
  maximumDataAgeMs: 30000,
  monitoringState: 'active',
  notificationPreference: false,
  executionSupported: false,
  executionEligible: false,
  version: 2,
};

describe('settingsPresentation', () => {
  it('editableSettingsPayload includes version for optimistic concurrency', () => {
    expect(editableSettingsPayload(settings).version).toBe(2);
  });

  it('settingsDraftEquals ignores non-editable metadata differences', () => {
    const other = {
      ...settings,
      minimumGrossSpreadBps: 99,
      fields: { autoExecute: { effective: false } as any },
    };
    expect(settingsDraftEquals(settings, other)).toBe(true);
  });

  it('validateSettingsDraft rejects net spread below fees and slippage', () => {
    const errors = validateSettingsDraft(
      { ...settings, minimumNetSpreadBps: 5 },
      (key) => key,
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
