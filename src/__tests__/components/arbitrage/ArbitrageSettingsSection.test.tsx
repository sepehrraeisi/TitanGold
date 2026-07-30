import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArbitrageSettingsSection } from '../../../../components/ai/arbitrage/ArbitrageSettingsSection.tsx';
import en from '../../../../deploy/blue/locales/en.json';
import fa from '../../../../deploy/blue/locales/fa.json';
import type { ArbitrageCoreSettings } from '../../../../services/api.ts';

const baseSettings: ArbitrageCoreSettings = {
  monitoredSymbols: ['BTCUSDT'],
  minimumNetSpreadBps: 25,
  minimumGrossSpreadBps: 20,
  assumedFeesBps: 10,
  assumedSlippageBps: 10,
  minimumLiquidity: 100000,
  maximumDataAgeMs: 30000,
  scanIntervalSeconds: 300,
  monitoringState: 'active',
  notificationPreference: false,
  notificationDeliveryAvailable: false,
  version: 3,
  updatedAt: '2026-07-16T10:00:00.000Z',
  executionSupported: false,
  executionEligible: false,
  fields: {
    monitoredSymbols: {
      effective: ['BTCUSDT'],
      configured: ['BTCUSDT'],
      defaultValue: ['BTCUSDT', 'ETHUSDT'],
      source: 'configured',
      supported: true,
      editable: true,
      readOnly: false,
    },
    minimumNetSpreadBps: {
      effective: 25,
      configured: 25,
      defaultValue: 20,
      source: 'configured',
      supported: true,
      editable: true,
      readOnly: false,
      unit: 'bps',
    },
    autoExecute: {
      effective: false,
      configured: null,
      defaultValue: false,
      source: 'blocked',
      supported: false,
      editable: false,
      readOnly: true,
    },
  },
};

const t = (key: string) => (en as Record<string, string>)[key] ?? key;

describe('ArbitrageSettingsSection', () => {
  it('renders configured summary and notification disclaimer in EN', () => {
    render(
      <ArbitrageSettingsSection
        settings={baseSettings}
        confirmed={baseSettings}
        dirty={false}
        loading={false}
        saving={false}
        loadState="loaded"
        error={null}
        saveError={null}
        saveSuccess={false}
        validationErrors={[]}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onResetDraft={vi.fn()}
        onRetry={vi.fn()}
        t={t}
      />,
    );

    expect(screen.getByTestId('arb-settings')).toBeTruthy();
    expect(screen.getByTestId('arb-settings-notification-disclaimer').textContent).toContain(
      'Delivery is not currently enabled',
    );
    expect(screen.getByTestId('arb-execution-supported-false')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /auto execute/i })).toBeNull();
  });

  it('shows dirty state and reset draft restores confirmed values', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <ArbitrageSettingsSection
        settings={{ ...baseSettings, minimumNetSpreadBps: 40 }}
        confirmed={baseSettings}
        dirty
        loading={false}
        saving={false}
        loadState="loaded"
        error={null}
        saveError={null}
        saveSuccess={false}
        validationErrors={[]}
        onChange={onChange}
        onSave={vi.fn()}
        onResetDraft={onReset}
        onRetry={vi.fn()}
        t={t}
      />,
    );

    expect(screen.getByTestId('arb-settings-dirty-banner')).toBeTruthy();
    fireEvent.click(screen.getByTestId('arb-settings-reset-draft'));
    expect(onReset).toHaveBeenCalled();
  });

  it('renders FA notification disclaimer without raw locale keys', () => {
    const tFa = (key: string) => (fa as Record<string, string>)[key] ?? key;
    render(
      <ArbitrageSettingsSection
        settings={baseSettings}
        confirmed={baseSettings}
        dirty={false}
        loading={false}
        saving={false}
        loadState="loaded"
        error={null}
        saveError={null}
        saveSuccess={false}
        validationErrors={[]}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onResetDraft={vi.fn()}
        onRetry={vi.fn()}
        t={tFa}
      />,
    );

    const disclaimer = screen.getByTestId('arb-settings-notification-disclaimer').textContent || '';
    expect(disclaimer).toContain('ارسال اعلان');
    expect(disclaimer).not.toContain('arb_settings_notification_disclaimer');
  });
});
