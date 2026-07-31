import type {
  ArbitrageCoreIntegrationAction,
  ArbitrageCoreIntegrationItem,
  ArbitrageCoreIntegrationsResponse,
} from '../services/api.ts';

export type TranslateFn = (key: string) => string;

export function resolveIntegrationLabel(key: string, t: TranslateFn): string {
  const localized = t(key);
  if (!localized || localized === key) return '';
  return localized;
}

export function isRawLocaleKey(text: string | null | undefined): boolean {
  if (!text) return false;
  return /^arb_[a-z0-9_]+$/.test(text.trim());
}

export function presentOperationalState(
  state: string | undefined,
  t: TranslateFn,
): string {
  const key = `arb_int_state_${state || 'unknown'}`;
  const localized = resolveIntegrationLabel(key, t);
  return localized || resolveIntegrationLabel('arb_int_state_unknown', t) || 'Unknown';
}

export function presentVerificationState(
  state: string | undefined,
  t: TranslateFn,
): string {
  const key = `arb_int_verification_${state || 'unknown'}`;
  const localized = resolveIntegrationLabel(key, t);
  return localized || resolveIntegrationLabel('arb_int_verification_unknown', t) || 'Unknown';
}

export function presentReasonCode(code: string | null | undefined, t: TranslateFn): string | null {
  if (!code) return null;
  const key = `arb_int_reason_${code}`;
  const localized = resolveIntegrationLabel(key, t);
  if (!localized || isRawLocaleKey(localized)) return null;
  return localized;
}

export function presentConsumerImpact(code: string | null | undefined, t: TranslateFn): string | null {
  if (!code) return null;
  const key = `arb_int_impact_${code}`;
  const localized = resolveIntegrationLabel(key, t);
  if (!localized || isRawLocaleKey(localized)) return null;
  return localized;
}

export function presentOverallState(state: string | undefined, t: TranslateFn): string {
  const key = `arb_int_overall_${state || 'unknown'}`;
  const localized = resolveIntegrationLabel(key, t);
  return localized || resolveIntegrationLabel('arb_int_overall_unknown', t) || 'Unknown';
}

export function presentReadinessDimension(
  dimension: 'market_data' | 'scheduling' | 'scan_lock' | 'persistence' | 'notifications' | 'execution',
  ready: boolean | undefined,
  t: TranslateFn,
): { label: string; explanation: string; tone: 'success' | 'warning' | 'info' | 'danger' } {
  const label = resolveIntegrationLabel(`arb_int_readiness_${dimension}`, t);
  const readyKey = ready ? 'ready' : 'not_ready';
  const explanation = resolveIntegrationLabel(`arb_int_readiness_${dimension}_${readyKey}`, t);
  let tone: 'success' | 'warning' | 'info' | 'danger' = ready ? 'success' : 'warning';
  if (dimension === 'execution') tone = 'danger';
  if (dimension === 'notifications' && !ready) tone = 'info';
  return {
    label: label || dimension,
    explanation: explanation || '',
    tone,
  };
}

export function presentTimestamp(value: string | null | undefined, t: TranslateFn): string {
  if (!value) return resolveIntegrationLabel('arb_int_timestamp_unavailable', t) || 'Not yet recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return resolveIntegrationLabel('arb_int_timestamp_unavailable', t) || 'Not yet recorded';
  }
  return d.toLocaleString();
}

export function presentBoolean(value: boolean | undefined, t: TranslateFn): string {
  if (value === true) return resolveIntegrationLabel('yes', t) || 'Yes';
  if (value === false) return resolveIntegrationLabel('no', t) || 'No';
  return resolveIntegrationLabel('arb_int_value_unknown', t) || 'Unknown';
}

export function operationalStateVariant(
  state: string | undefined,
): 'success' | 'warning' | 'info' | 'danger' {
  switch (state) {
    case 'operational':
    case 'not_required':
      return 'success';
    case 'degraded':
    case 'limited':
      return 'warning';
    case 'blocked':
    case 'unavailable':
      return 'danger';
    default:
      return 'info';
  }
}

export function findIntegrationItem(
  data: ArbitrageCoreIntegrationsResponse | null,
  id: string,
): ArbitrageCoreIntegrationItem | undefined {
  return data?.items?.find(item => item.id === id);
}

export function presentActionLabel(action: ArbitrageCoreIntegrationAction, t: TranslateFn): string {
  return resolveIntegrationLabel(action.labelKey, t) || action.target;
}

export function presentFallbackMode(value: string | null | undefined, t: TranslateFn): string {
  if (value === 'memory') {
    return resolveIntegrationLabel('arb_int_fallback_mode_memory', t) || resolveIntegrationLabel('memory', t) || 'Memory';
  }
  if (value === 'redis') {
    return resolveIntegrationLabel('arb_int_fallback_mode_redis', t) || 'Redis';
  }
  return resolveIntegrationLabel('arb_int_value_unknown', t) || 'Unknown';
}

export function presentSchedulerDimensionLabel(key: string, t: TranslateFn): string {
  if (key === 'allowlisted') {
    return resolveIntegrationLabel('agent_state_allowlisted', t)
      || resolveIntegrationLabel('arb_int_scheduler_allowlisted', t)
      || key;
  }
  return resolveIntegrationLabel(`arb_int_scheduler_${key}`, t) || key;
}
