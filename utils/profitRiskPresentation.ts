/**
 * Canonical Profit & Risk presentation mapper.
 */

import type { ArbitrageCoreProfitRiskAnalytics, ArbitrageCoreRunSummary } from '../services/api.ts';
import { formatRejectionReason } from './arbitrageReasonLabels.ts';
import {
  presentScanStatus,
  presentScanTrigger,
  resolveProductLabel as resolveScanLabel,
} from './scanRunPresentation.ts';

export type ProfitRiskPresentationMode = 'product' | 'technical';
export type TranslateFn = (key: string) => string;

const ESTIMATE_STATE_KEYS: Record<string, string> = {
  measured: 'arb_pr_state_measured',
  derived_estimate: 'arb_pr_state_derived',
  assumption: 'arb_pr_state_assumption',
  unavailable: 'arb_pr_state_unavailable',
  unsupported: 'arb_pr_state_unsupported',
  market_observation: 'arb_pr_state_market_observation',
};

const SELECTION_BASIS_KEYS: Record<string, string> = {
  best_qualified_candidate: 'arb_pr_selection_best_qualified',
  best_estimated_net_spread: 'arb_pr_selection_best_net',
  best_observed_gross_spread: 'arb_pr_selection_best_gross',
  best_analytical_candidate: 'arb_pr_selection_best_analytical',
  least_negative_rejected_candidate: 'arb_pr_selection_least_negative_rejected',
};

export function resolveProductLabel(key: string, t: TranslateFn): string {
  const translated = t(key);
  if (translated && translated !== key) return translated;
  const unavailable = t('unavailable');
  return unavailable && unavailable !== 'unavailable' ? unavailable : 'Unavailable';
}

export function presentEstimateState(
  state: string | null | undefined,
  t: TranslateFn,
): string {
  if (!state) return resolveProductLabel('arb_pr_state_unavailable', t);
  const key = ESTIMATE_STATE_KEYS[state];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('arb_pr_state_unavailable', t);
}

export function formatBpsValue(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Number(value).toFixed(2)} bps`;
}

export function formatUnavailableMetric(t: TranslateFn): string {
  return resolveProductLabel('arb_pr_state_unavailable', t);
}

export function presentBps(
  value: number | null | undefined,
  t: TranslateFn,
): string {
  const formatted = formatBpsValue(value);
  return formatted ?? formatUnavailableMetric(t);
}

export function presentProfitValue(
  value: number | null | undefined,
  currency: string | null | undefined,
  t: TranslateFn,
): string {
  if (value == null || !Number.isFinite(value)) {
    return formatUnavailableMetric(t);
  }
  const cur = currency || 'USDT';
  return `${Number(value).toFixed(4)} ${cur}`;
}

export function presentRiskScore(
  value: number | null | undefined,
  state: string | null | undefined,
  t: TranslateFn,
): string {
  if (value == null || !Number.isFinite(value)) {
    return resolveProductLabel('arb_pr_risk_unavailable', t);
  }
  return `${Math.round(value)} / 100`;
}

export function presentRiskFactor(
  code: string,
  t: TranslateFn,
  mode: ProfitRiskPresentationMode = 'product',
): string {
  if (mode === 'technical') return code;
  const key = `arb_pr_risk_${code}`;
  const label = resolveProductLabel(key, t);
  return label !== key ? label : formatRejectionReason(code, t);
}

export function presentFreshnessState(
  state: string | null | undefined,
  t: TranslateFn,
): string {
  if (!state) return resolveProductLabel('arb_pr_state_unavailable', t);
  const key = `arb_pr_freshness_${state}`;
  const label = resolveProductLabel(key, t);
  return label !== key ? label : resolveProductLabel('unavailable', t);
}

export function presentLiquidityState(
  state: string | null | undefined,
  t: TranslateFn,
): string {
  if (!state) return resolveProductLabel('arb_pr_state_unavailable', t);
  const key = `arb_pr_liquidity_${state}`;
  const label = resolveProductLabel(key, t);
  return label !== key ? label : resolveProductLabel('unavailable', t);
}

export function presentSelectionBasis(
  basis: string | null | undefined,
  t: TranslateFn,
): string {
  if (!basis) return resolveProductLabel('arb_pr_state_unavailable', t);
  const key = SELECTION_BASIS_KEYS[basis];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function presentFieldLabel(field: string, t: TranslateFn): string {
  const keys: Record<string, string> = {
    grossSpread: 'arb_pr_gross_spread',
    assumedFees: 'arb_pr_assumed_fees',
    assumedSlippage: 'arb_pr_assumed_slippage',
    netSpread: 'arb_pr_net_spread',
    estimatedProfit: 'arb_pr_estimated_profit',
    riskScore: 'arb_pr_risk_score',
    qualified: 'arb_funnel_qualified',
    rejected: 'arb_funnel_rejected',
    analyticalCandidates: 'arb_funnel_analyticalCandidates',
    assumptions: 'arb_pr_assumptions',
    trend: 'arb_pr_trend',
    limitations: 'arb_pr_limitations',
    selectedCandidate: 'arb_pr_selected_candidate',
    selectionBasis: 'arb_pr_selection_basis',
  };
  const key = keys[field];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function formatLocalizedTimestamp(
  value: string | null | undefined,
  locale?: string,
  t?: TranslateFn,
): string {
  if (!value) return t ? resolveProductLabel('arb_timestamp_unavailable', t) : 'Unavailable';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return t ? resolveProductLabel('arb_timestamp_unavailable', t) : 'Unavailable';
  return d.toLocaleString(locale || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function presentRunOptionLabel(
  run: Pick<ArbitrageCoreRunSummary, 'completedAt' | 'startedAt' | 'trigger' | 'status' | 'runId'>,
  t: TranslateFn,
  locale?: string,
  mode: ProfitRiskPresentationMode = 'product',
): string {
  if (mode === 'technical') return run.runId || '';
  const ts = formatLocalizedTimestamp(run.completedAt || run.startedAt, locale, t);
  const trigger = presentScanTrigger(run.trigger, t);
  const status = presentScanStatus(run.status, t);
  return `${ts} · ${trigger} · ${status}`;
}

export function metricStateForSpread(field: 'gross' | 'net'): string {
  return field === 'gross' ? 'market_observation' : 'derived_estimate';
}

export type ProfitRiskAnalyticsShape = ArbitrageCoreProfitRiskAnalytics;

export function isRawProfitRiskKey(text: string): boolean {
  return /^arb_[a-z0-9_]+$/.test(text) || /^[A-Z_]{4,}$/.test(text);
}

export { resolveScanLabel };
