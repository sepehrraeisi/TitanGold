import React, { useMemo, useState } from 'react';
import type { ArbitrageCoreSettings } from '../../../services/api.ts';
import {
  DataHubAlert,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import {
  AgentContentSurface,
  AgentErrorState,
  AgentLoadingState,
  AgentMetricGrid,
  AgentSectionHeader,
  type AgentMetricItem,
} from '../product/index.ts';
import {
  getFieldMeta,
  presentBpsValue,
  presentMonitoringState,
  presentMsValue,
  presentSourceBadge,
  presentTimestamp,
  resolveSettingsLabel,
  settingsDraftEquals,
  validateSettingsDraft,
  type TranslateFn,
} from '../../../utils/settingsPresentation.ts';

export type ArbitrageSettingsSectionProps = {
  settings: ArbitrageCoreSettings | null;
  confirmed: ArbitrageCoreSettings | null;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  loadState: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
  saveError: string | null;
  saveSuccess: boolean;
  validationErrors: string[];
  onChange: (next: ArbitrageCoreSettings) => void;
  onSave: () => void;
  onResetDraft: () => void;
  onRetry: () => void;
  t: TranslateFn;
};

const UNSUPPORTED_CAPABILITY_KEYS = [
  { id: 'auto_execute', labelKey: 'arb_settings_cap_auto_execute' },
  { id: 'triangular_arbitrage', labelKey: 'arb_settings_cap_triangular' },
  { id: 'cross_exchange_arbitrage', labelKey: 'arb_settings_cap_cross_exchange' },
  { id: 'futures_basis', labelKey: 'arb_settings_cap_futures' },
  { id: 'settlement_transfers', labelKey: 'arb_settings_cap_settlement' },
  { id: 'private_account_execution', labelKey: 'arb_settings_cap_private_execution' },
] as const;

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; testId?: string }> = ({
  title,
  children,
  testId,
}) => (
  <section
    className="rounded-lg border border-gray-800 bg-gray-950/60 p-4 space-y-3"
    data-testid={testId}
  >
    <h3 className="text-sm font-medium text-gray-200">{title}</h3>
    {children}
  </section>
);

const FieldHint: React.FC<{ text?: string | null }> = ({ text }) => {
  if (!text) return null;
  return <p className="text-[11px] text-gray-500 mt-1">{text}</p>;
}

const SourceBadge: React.FC<{ settings: ArbitrageCoreSettings; field: keyof NonNullable<ArbitrageCoreSettings['fields']>; t: TranslateFn }> = ({
  settings,
  field,
  t,
}) => {
  const meta = getFieldMeta(settings, field);
  if (!meta) return null;
  return (
    <StatusPill
      label={presentSourceBadge(meta.source, t)}
      variant={meta.source === 'configured' ? 'success' : 'info'}
      className="shrink-0"
    />
  );
};

export const ArbitrageSettingsSection: React.FC<ArbitrageSettingsSectionProps> = ({
  settings,
  confirmed,
  dirty,
  loading,
  saving,
  loadState,
  error,
  saveError,
  saveSuccess,
  validationErrors,
  onChange,
  onSave,
  onResetDraft,
  onRetry,
  t,
}) => {
  const [symbolInput, setSymbolInput] = useState('');

  const summaryMetrics: AgentMetricItem[] = useMemo(() => {
    if (!settings) return [];
    return [
      {
        id: 'monitoring',
        label: resolveSettingsLabel('monitoring_state', t),
        value: presentMonitoringState(settings.monitoringState, t),
        badge: <SourceBadge settings={settings} field="monitoringState" t={t} />,
      },
      {
        id: 'symbols',
        label: resolveSettingsLabel('arb_settings_monitored_symbol_count', t),
        value: String(settings.monitoredSymbols?.length ?? 0),
        badge: <SourceBadge settings={settings} field="monitoredSymbols" t={t} />,
      },
      {
        id: 'net',
        label: resolveSettingsLabel('arb_settings_min_net_spread', t),
        value: <AgentTechnicalLtr>{presentBpsValue(settings.minimumNetSpreadBps, t)}</AgentTechnicalLtr>,
        badge: <SourceBadge settings={settings} field="minimumNetSpreadBps" t={t} />,
      },
      {
        id: 'fees',
        label: resolveSettingsLabel('arb_settings_assumed_fees', t),
        value: <AgentTechnicalLtr>{presentBpsValue(settings.assumedFeesBps, t)}</AgentTechnicalLtr>,
        badge: <SourceBadge settings={settings} field="assumedFeesBps" t={t} />,
      },
      {
        id: 'slippage',
        label: resolveSettingsLabel('arb_settings_assumed_slippage', t),
        value: <AgentTechnicalLtr>{presentBpsValue(settings.assumedSlippageBps, t)}</AgentTechnicalLtr>,
        badge: <SourceBadge settings={settings} field="assumedSlippageBps" t={t} />,
      },
      {
        id: 'dataAge',
        label: resolveSettingsLabel('arb_settings_max_data_age', t),
        value: <AgentTechnicalLtr>{presentMsValue(settings.maximumDataAgeMs, t)}</AgentTechnicalLtr>,
        badge: <SourceBadge settings={settings} field="maximumDataAgeMs" t={t} />,
      },
      {
        id: 'revision',
        label: resolveSettingsLabel('arb_settings_revision', t),
        value: <AgentTechnicalLtr>{String(settings.version ?? 1)}</AgentTechnicalLtr>,
      },
      {
        id: 'updated',
        label: resolveSettingsLabel('arb_settings_last_saved', t),
        value: presentTimestamp(settings.updatedAt, t),
      },
    ];
  }, [settings, t]);

  if (loadState === 'loading' || (loadState === 'idle' && !settings)) {
    return <AgentLoadingState message={resolveSettingsLabel('loading', t)} testId="arb-settings-loading" />;
  }

  if (loadState === 'error' || !settings) {
    return (
      <AgentErrorState
        message={error || resolveSettingsLabel('load_failed', t)}
        onRetry={onRetry}
        retryLabel={resolveSettingsLabel('retry', t)}
        testId="arb-settings-error"
      />
    );
  }

  const addSymbol = () => {
    const next = symbolInput.trim().toUpperCase();
    if (!next) return;
    const current = settings.monitoredSymbols || [];
    if (current.includes(next)) {
      setSymbolInput('');
      return;
    }
    onChange({ ...settings, monitoredSymbols: [...current, next] });
    setSymbolInput('');
  };

  const removeSymbol = (symbol: string) => {
    onChange({
      ...settings,
      monitoredSymbols: (settings.monitoredSymbols || []).filter((s) => s !== symbol),
    });
  };

  const clientValidation = validateSettingsDraft(settings, t);
  const allValidationErrors = [...validationErrors, ...clientValidation];

  return (
    <div className="space-y-5" data-testid="arb-settings">
      <AgentSectionHeader
        title={resolveSettingsLabel('tab_settings', t)}
        subtitle={resolveSettingsLabel('arb_settings_subtitle', t)}
      />

      {settings.legacyExecutionPreferenceIgnored ? (
        <DataHubAlert
          variant="warning"
          message={resolveSettingsLabel('arb_settings_legacy_auto_execute_warning', t)}
          testId="arb-settings-legacy-warning"
        />
      ) : null}

      {dirty ? (
        <div data-testid="arb-settings-dirty-banner">
          <DataHubAlert
            variant="warning"
            message={resolveSettingsLabel('arb_settings_unsaved_changes', t)}
          />
        </div>
      ) : null}

      {saveSuccess ? (
        <div
          role="status"
          className="p-2 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 text-[11px]"
          data-testid="arb-settings-save-success"
        >
          {resolveSettingsLabel('config_updated', t)}
        </div>
      ) : null}

      {saveError ? (
        <DataHubAlert variant="error" message={saveError} testId="arb-settings-save-error" />
      ) : null}

      {allValidationErrors.length > 0 ? (
        <DataHubAlert
          variant="error"
          message={allValidationErrors.join(' ')}
          testId="arb-settings-validation-error"
        />
      ) : null}

      <SettingsCard title={resolveSettingsLabel('arb_settings_current_configuration', t)} testId="arb-settings-summary">
        <AgentMetricGrid metrics={summaryMetrics} columns={2} />
      </SettingsCard>

      <SettingsCard title={resolveSettingsLabel('arb_settings_market_universe', t)} testId="arb-settings-symbols">
        <p className="text-xs text-gray-400">{resolveSettingsLabel('arb_settings_market_universe_help', t)}</p>
        <div className="flex flex-wrap gap-2 min-h-[2rem]" data-testid="arb-settings-symbol-list">
          {(settings.monitoredSymbols || []).map((symbol) => (
            <span
              key={symbol}
              className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100"
            >
              <AgentTechnicalLtr>{symbol}</AgentTechnicalLtr>
              <button
                type="button"
                className="text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                aria-label={`${resolveSettingsLabel('remove', t)} ${symbol}`}
                onClick={() => removeSymbol(symbol)}
                disabled={loading || saving}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSymbol();
              }
            }}
            placeholder={resolveSettingsLabel('arb_settings_symbol_placeholder', t)}
            disabled={loading || saving}
            aria-label={resolveSettingsLabel('arb_settings_add_symbol', t)}
            data-testid="arb-settings-symbol-input"
          />
          <SecondaryButton type="button" onClick={addSymbol} disabled={loading || saving || !symbolInput.trim()}>
            {resolveSettingsLabel('arb_settings_add_symbol', t)}
          </SecondaryButton>
        </div>
      </SettingsCard>

      <SettingsCard title={resolveSettingsLabel('arb_settings_analytical_thresholds', t)} testId="arb-settings-thresholds">
        <p className="text-xs text-gray-400">{resolveSettingsLabel('arb_settings_thresholds_disclaimer', t)}</p>
        <label className="text-xs text-gray-400 block">
          {resolveSettingsLabel('arb_settings_min_net_spread', t)}
          <input
            type="number"
            min={0}
            step={0.01}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
            value={settings.minimumNetSpreadBps ?? ''}
            onChange={(e) =>
              onChange({ ...settings, minimumNetSpreadBps: Number(e.target.value) })
            }
            disabled={loading || saving}
            data-testid="arb-settings-min-net-spread"
          />
          <FieldHint text={resolveSettingsLabel('arb_settings_min_net_spread_help', t)} />
        </label>
        <div className="rounded border border-gray-800 bg-gray-900/40 p-3 text-xs text-gray-400">
          <div className="flex items-center justify-between gap-2">
            <span>{resolveSettingsLabel('arb_settings_min_gross_spread', t)}</span>
            <SourceBadge settings={settings} field="minimumGrossSpreadBps" t={t} />
          </div>
          <AgentTechnicalLtr className="text-white mt-1 block">
            {presentBpsValue(settings.minimumGrossSpreadBps, t)}
          </AgentTechnicalLtr>
          <FieldHint text={getFieldMeta(settings, 'minimumGrossSpreadBps')?.reason} />
        </div>
      </SettingsCard>

      <SettingsCard title={resolveSettingsLabel('arb_settings_analytical_assumptions', t)} testId="arb-settings-assumptions">
        <p className="text-xs text-gray-400">{resolveSettingsLabel('arb_settings_assumptions_disclaimer', t)}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-400 block">
            {resolveSettingsLabel('arb_settings_assumed_fees', t)}
            <input
              type="number"
              min={0}
              step={0.01}
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              value={settings.assumedFeesBps ?? ''}
              onChange={(e) => onChange({ ...settings, assumedFeesBps: Number(e.target.value) })}
              disabled={loading || saving}
              data-testid="arb-settings-fees"
            />
            <FieldHint text={resolveSettingsLabel('arb_settings_assumed_fees_help', t)} />
          </label>
          <label className="text-xs text-gray-400 block">
            {resolveSettingsLabel('arb_settings_assumed_slippage', t)}
            <input
              type="number"
              min={0}
              step={0.01}
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              value={settings.assumedSlippageBps ?? ''}
              onChange={(e) => onChange({ ...settings, assumedSlippageBps: Number(e.target.value) })}
              disabled={loading || saving}
              data-testid="arb-settings-slippage"
            />
            <FieldHint text={resolveSettingsLabel('arb_settings_assumed_slippage_help', t)} />
          </label>
          <label className="text-xs text-gray-400 block md:col-span-2">
            {resolveSettingsLabel('arb_settings_max_data_age', t)}
            <input
              type="number"
              min={1}
              max={600000}
              step={1}
              className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              value={settings.maximumDataAgeMs ?? ''}
              onChange={(e) => onChange({ ...settings, maximumDataAgeMs: Number(e.target.value) })}
              disabled={loading || saving}
              data-testid="arb-settings-data-age"
            />
            <FieldHint text={resolveSettingsLabel('arb_settings_max_data_age_help', t)} />
          </label>
        </div>
      </SettingsCard>

      <SettingsCard title={resolveSettingsLabel('arb_settings_notification_preference', t)} testId="arb-settings-notification">
        <label className="flex items-start gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(settings.notificationPreference)}
            onChange={(e) => onChange({ ...settings, notificationPreference: e.target.checked })}
            disabled={loading || saving}
            data-testid="arb-settings-notification-toggle"
          />
          <span>{resolveSettingsLabel('notify_on_opportunity', t)}</span>
        </label>
        <p className="text-xs text-amber-300/90 mt-2" data-testid="arb-settings-notification-disclaimer">
          {resolveSettingsLabel('arb_settings_notification_disclaimer', t)}
        </p>
      </SettingsCard>

      <SettingsCard title={resolveSettingsLabel('unsupported_capabilities', t)} testId="arb-settings-unsupported">
        <ul className="text-sm text-gray-400 space-y-2">
          {UNSUPPORTED_CAPABILITY_KEYS.map((cap) => (
            <li key={cap.id} className="flex items-center justify-between gap-2">
              <span>{resolveSettingsLabel(cap.labelKey, t)}</span>
              <StatusPill
                label={resolveSettingsLabel('arb_settings_cap_unavailable', t)}
                variant="warning"
              />
            </li>
          ))}
        </ul>
        <p className="text-xs text-amber-300 mt-3" data-testid="arb-execution-supported-false">
          {resolveSettingsLabel('execution_support', t)}: {resolveSettingsLabel('execution_unsupported', t)}
        </p>
      </SettingsCard>

      <AgentContentSurface testId="arb-settings-actions">
        <div className="flex flex-wrap gap-2">
          <PrimaryButton
            type="button"
            onClick={onSave}
            disabled={!dirty || saving || loading || allValidationErrors.length > 0}
            data-testid="arb-settings-save"
          >
            {saving ? resolveSettingsLabel('saving', t) : resolveSettingsLabel('save_changes', t)}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            onClick={onResetDraft}
            disabled={!dirty || saving || loading || !confirmed}
            data-testid="arb-settings-reset-draft"
          >
            {resolveSettingsLabel('arb_settings_reset_draft', t)}
          </SecondaryButton>
        </div>
      </AgentContentSurface>
    </div>
  );
};

export { settingsDraftEquals, validateSettingsDraft };
