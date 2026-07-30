import type { ArbitrageCoreSettings, ArbitrageSettingsFieldMeta } from '../services/api.ts';

export type TranslateFn = (key: string) => string;

export function resolveSettingsLabel(key: string, t: TranslateFn): string {
  return t(key) || key;
}

export function presentSourceBadge(
  source: ArbitrageSettingsFieldMeta['source'] | undefined,
  t: TranslateFn,
): string {
  switch (source) {
    case 'configured':
      return resolveSettingsLabel('arb_settings_source_configured', t);
    case 'default':
      return resolveSettingsLabel('arb_settings_source_default', t);
    case 'legacy_normalized':
      return resolveSettingsLabel('arb_settings_source_legacy', t);
    case 'blocked':
      return resolveSettingsLabel('arb_settings_source_blocked', t);
    case 'unsupported':
      return resolveSettingsLabel('arb_settings_source_unsupported', t);
    case 'read_only':
      return resolveSettingsLabel('arb_settings_source_read_only', t);
    default:
      return resolveSettingsLabel('arb_settings_source_default', t);
  }
}

export function presentMonitoringState(
  state: string | undefined,
  t: TranslateFn,
): string {
  if (state === 'paused') return resolveSettingsLabel('monitoring_paused', t);
  if (state === 'active') return resolveSettingsLabel('monitoring_active', t);
  return resolveSettingsLabel('unavailable', t);
}

export function presentBpsValue(value: number | null | undefined, t: TranslateFn): string {
  if (value == null || !Number.isFinite(Number(value))) {
    return resolveSettingsLabel('arb_settings_value_unavailable', t);
  }
  return `${Number(value).toFixed(2)} bps`;
}

export function presentMsValue(value: number | null | undefined, t: TranslateFn): string {
  if (value == null || !Number.isFinite(Number(value))) {
    return resolveSettingsLabel('arb_settings_value_unavailable', t);
  }
  return `${Number(value).toLocaleString()} ms`;
}

export function presentTimestamp(value: string | null | undefined, t: TranslateFn): string {
  if (!value) return resolveSettingsLabel('arb_timestamp_unavailable', t);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return resolveSettingsLabel('arb_timestamp_unavailable', t);
  return d.toLocaleString();
}

export function getFieldMeta(
  settings: ArbitrageCoreSettings,
  field: keyof NonNullable<ArbitrageCoreSettings['fields']>,
): ArbitrageSettingsFieldMeta | undefined {
  return settings.fields?.[field];
}

export function editableSettingsPayload(settings: ArbitrageCoreSettings) {
  return {
    monitoredSymbols: settings.monitoredSymbols,
    minimumNetSpreadBps: settings.minimumNetSpreadBps,
    assumedFeesBps: settings.assumedFeesBps,
    assumedSlippageBps: settings.assumedSlippageBps,
    maximumDataAgeMs: settings.maximumDataAgeMs,
    notificationPreference: settings.notificationPreference,
    version: settings.version,
  };
}

export function settingsDraftEquals(
  a: ArbitrageCoreSettings | null,
  b: ArbitrageCoreSettings | null,
): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify(editableSettingsPayload(a)) === JSON.stringify(editableSettingsPayload(b));
}

export function validateSettingsDraft(
  draft: ArbitrageCoreSettings,
  t: TranslateFn,
): string[] {
  const errors: string[] = [];
  const symbols = draft.monitoredSymbols || [];
  if (symbols.length === 0) {
    errors.push(resolveSettingsLabel('arb_settings_error_symbols_required', t));
  }
  const unique = new Set(symbols.map((s) => s.toUpperCase()));
  if (unique.size !== symbols.length) {
    errors.push(resolveSettingsLabel('arb_settings_error_symbols_duplicate', t));
  }
  for (const sym of symbols) {
    if (!/^[A-Z0-9]{5,20}$/.test(sym.toUpperCase())) {
      errors.push(resolveSettingsLabel('arb_settings_error_symbol_invalid', t));
      break;
    }
  }
  const minNet = Number(draft.minimumNetSpreadBps);
  const fees = Number(draft.assumedFeesBps ?? 10);
  const slip = Number(draft.assumedSlippageBps ?? 10);
  if (!Number.isFinite(minNet) || minNet < 0) {
    errors.push(resolveSettingsLabel('arb_settings_error_net_spread', t));
  } else if (minNet < fees + slip) {
    errors.push(resolveSettingsLabel('arb_settings_error_net_spread_threshold', t));
  }
  if (draft.assumedFeesBps != null && (!Number.isFinite(Number(draft.assumedFeesBps)) || Number(draft.assumedFeesBps) < 0)) {
    errors.push(resolveSettingsLabel('arb_settings_error_fees', t));
  }
  if (draft.assumedSlippageBps != null && (!Number.isFinite(Number(draft.assumedSlippageBps)) || Number(draft.assumedSlippageBps) < 0)) {
    errors.push(resolveSettingsLabel('arb_settings_error_slippage', t));
  }
  if (draft.maximumDataAgeMs != null) {
    const age = Number(draft.maximumDataAgeMs);
    if (!Number.isFinite(age) || age < 1 || age > 600000) {
      errors.push(resolveSettingsLabel('arb_settings_error_data_age', t));
    }
  }
  return errors;
}
