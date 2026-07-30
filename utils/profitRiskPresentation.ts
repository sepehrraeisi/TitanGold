/**
 * Canonical Profit & Risk presentation mapper.
 */

import type { ArbitrageCoreProfitRiskAnalytics } from '../services/api.ts';
import { formatRejectionReason } from './arbitrageReasonLabels.ts';

export type ProfitRiskPresentationMode = 'product' | 'technical';
export type TranslateFn = (key: string) => string;

const ESTIMATE_STATE_KEYS: Record<string, string> = {
  measured: 'arb_pr_state_measured',
  derived_estimate: 'arb_pr_state_derived',
  assumption: 'arb_pr_state_assumption',
  unavailable: 'arb_pr_state_unavailable',
  unsupported: 'arb_pr_state_unsupported',
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

export function presentBps(
  value: number | null | undefined,
  t: TranslateFn,
  state?: string | null,
): string {
  if (value == null || !Number.isFinite(value)) {
    return presentEstimateState(state || 'unavailable', t);
  }
  return `${Number(value).toFixed(2)} bps`;
}

export function presentProfitValue(
  value: number | null | undefined,
  currency: string | null | undefined,
  t: TranslateFn,
  estimateState?: string | null,
): string {
  if (value == null || !Number.isFinite(value)) {
    return presentEstimateState(estimateState || 'unavailable', t);
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
    return presentEstimateState(state || 'unavailable', t);
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
  };
  const key = keys[field];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export type ProfitRiskAnalyticsShape = ArbitrageCoreProfitRiskAnalytics;

export function isRawProfitRiskKey(text: string): boolean {
  return /^arb_[a-z0-9_]+$/.test(text) || /^[A-Z_]{4,}$/.test(text);
}
