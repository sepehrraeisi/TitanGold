/**
 * Canonical Candidate presentation mapper — converts machine-readable DTO codes
 * into localized product language. Raw codes belong only in technical mode.
 */

import type { ArbitrageCoreCandidate } from '../services/api.ts';
import { formatRejectionReason } from './arbitrageReasonLabels.ts';

export type CandidatePresentationMode = 'product' | 'technical';

export type TranslateFn = (key: string) => string;

const LIFECYCLE_KEYS: Record<string, string> = {
  observed: 'arb_candidate_lifecycle_observed',
  candidate: 'arb_candidate_lifecycle_candidate',
  rejected: 'arb_candidate_lifecycle_rejected',
  qualified: 'arb_candidate_lifecycle_qualified',
  expired: 'arb_candidate_lifecycle_expired',
  blocked: 'arb_candidate_lifecycle_blocked',
};

const FRESHNESS_KEYS: Record<string, string> = {
  fresh: 'arb_freshness_fresh',
  stale: 'arb_freshness_stale',
};

const LIQUIDITY_KEYS: Record<string, string> = {
  ok: 'arb_liquidity_ok',
  insufficient: 'arb_liquidity_insufficient',
  unknown: 'arb_liquidity_unknown',
};

const MODE_KEYS: Record<string, string> = {
  single_venue_spread_monitoring: 'arb_candidate_mode_single_venue',
};

const SOURCE_KEYS: Record<string, string> = {
  mexc_public: 'arb_candidate_source_mexc_public',
};

const SORT_KEYS: Record<string, string> = {
  'observedAt:desc': 'arb_sort_newest',
  'observedAt:asc': 'arb_sort_oldest',
  'symbol:asc': 'arb_sort_symbol',
  'netSpreadBps:desc': 'arb_sort_net_spread',
  'grossSpreadBps:desc': 'arb_sort_gross_spread',
};

const FILTER_LABEL_KEYS = {
  lifecycle: 'arb_filter_lifecycle',
  rejection: 'arb_filter_rejection',
  freshness: 'arb_filter_freshness',
  search: 'arb_search_symbol',
  sort: 'sort',
  symbol: 'symbol',
  selectedRun: 'arb_selected_run',
} as const;

const FIELD_LABEL_KEYS = {
  grossSpread: 'arb_gross_spread',
  netSpread: 'arb_net_spread',
  assumedFees: 'arb_assumed_fees',
  assumedSlippage: 'arb_assumed_slippage',
  estimatedProfit: 'arb_estimated_profit',
  primaryRejection: 'arb_primary_rejection',
  observedAt: 'observed_at',
  runId: 'run_id',
  mode: 'mode',
  source: 'source',
  riskScore: 'risk_score',
  symbol: 'symbol',
  liquidity: 'arb_field_liquidity',
  freshness: 'arb_field_freshness',
} as const;

const FUNNEL_LABEL_KEYS: Record<string, string> = {
  observed: 'arb_funnel_observed',
  analyticalCandidates: 'arb_funnel_analytical_candidates',
  rejected: 'arb_funnel_rejected',
  qualified: 'arb_funnel_qualified',
  expired: 'arb_funnel_expired',
  blocked: 'arb_funnel_blocked',
};

/** Resolve i18n key to label; never return raw key in product mode. */
export function resolveProductLabel(key: string, t: TranslateFn): string {
  const translated = t(key);
  if (translated && translated !== key) return translated;
  const unavailable = t('unavailable');
  return unavailable && unavailable !== 'unavailable' ? unavailable : 'Unavailable';
}

export function presentLifecycle(
  value: string | null | undefined,
  t: TranslateFn,
  mode: CandidatePresentationMode = 'product',
): string {
  if (!value) return resolveProductLabel('unavailable', t);
  if (mode === 'technical') return value;
  const key = LIFECYCLE_KEYS[value];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function presentFreshness(
  value: string | null | undefined,
  t: TranslateFn,
  mode: CandidatePresentationMode = 'product',
): string {
  if (!value) return resolveProductLabel('unavailable', t);
  if (mode === 'technical') return value;
  const key = FRESHNESS_KEYS[value];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function presentLiquidity(
  value: string | null | undefined,
  t: TranslateFn,
  mode: CandidatePresentationMode = 'product',
): string {
  if (!value) return resolveProductLabel('unavailable', t);
  if (mode === 'technical') return value;
  const key = LIQUIDITY_KEYS[value] ?? (value === 'ok' ? LIQUIDITY_KEYS.ok : LIQUIDITY_KEYS.insufficient);
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function presentMode(
  value: string | null | undefined,
  t: TranslateFn,
  mode: CandidatePresentationMode = 'product',
): string {
  if (!value) return resolveProductLabel('unavailable', t);
  if (mode === 'technical') return value;
  const key = MODE_KEYS[value];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function presentSource(
  value: string | null | undefined,
  t: TranslateFn,
  mode: CandidatePresentationMode = 'product',
): string {
  if (!value) return resolveProductLabel('unavailable', t);
  if (mode === 'technical') return value;
  const key = SOURCE_KEYS[value];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function presentSortOption(sort: string, t: TranslateFn): string {
  const key = SORT_KEYS[sort];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('sort', t);
}

export function presentFilterLabel(
  filter: keyof typeof FILTER_LABEL_KEYS,
  t: TranslateFn,
): string {
  return resolveProductLabel(FILTER_LABEL_KEYS[filter], t);
}

export function presentFieldLabel(
  field: keyof typeof FIELD_LABEL_KEYS,
  t: TranslateFn,
): string {
  return resolveProductLabel(FIELD_LABEL_KEYS[field], t);
}

export function presentFunnelLabel(metric: string, t: TranslateFn): string {
  const key = FUNNEL_LABEL_KEYS[metric];
  if (key) return resolveProductLabel(key, t);
  if (metric === 'analyticalCandidates') {
    return resolveProductLabel('arb_funnel_analytical_candidates', t);
  }
  return resolveProductLabel('unavailable', t);
}

export function presentBps(
  value: number | null | undefined,
  t: TranslateFn,
): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return `${Number(value).toFixed(2)} bps`;
}

export function presentBpsWithLabel(
  labelKey: keyof typeof FIELD_LABEL_KEYS,
  value: number | null | undefined,
  t: TranslateFn,
): string {
  const bps = presentBps(value, t);
  if (!bps) return `${presentFieldLabel(labelKey, t)}: ${resolveProductLabel('arb_metric_unavailable', t)}`;
  return `${presentFieldLabel(labelKey, t)}: ${bps}`;
}

export function presentRiskScore(
  value: number | null | undefined,
  t: TranslateFn,
): string {
  if (value != null && Number.isFinite(Number(value))) {
    return `${presentFieldLabel('riskScore', t)}: ${Number(value).toFixed(0)} / 100`;
  }
  return `${presentFieldLabel('riskScore', t)}: ${resolveProductLabel('arb_metric_unavailable', t)}`;
}

/**
 * Estimated profit uses estimatedProfit only. Unavailability is separate from rejection reasons.
 */
export function presentEstimatedProfit(
  candidate: Pick<
    ArbitrageCoreCandidate,
    'estimatedProfit' | 'estimatedProfitUnavailableReason' | 'estimatedNotional'
  >,
  t: TranslateFn,
): string {
  if (candidate.estimatedProfit != null && Number.isFinite(Number(candidate.estimatedProfit))) {
    const amount = Number(candidate.estimatedProfit);
    return `${amount.toFixed(2)} USDT`;
  }
  return resolveProductLabel('arb_estimated_profit_unavailable', t);
}

export function presentEstimatedProfitUnavailableReason(
  _reason: string | null | undefined,
  t: TranslateFn,
): string | null {
  return resolveProductLabel('arb_estimated_profit_unavailable', t);
}

export function presentRiskScoreDetail(
  candidate: Pick<ArbitrageCoreCandidate, 'riskScore' | 'riskScoreUnavailableReason'>,
  t: TranslateFn,
): string {
  if (candidate.riskScore != null && Number.isFinite(Number(candidate.riskScore))) {
    return `${Number(candidate.riskScore).toFixed(0)} / 100`;
  }
  return resolveProductLabel('arb_risk_score_unavailable', t);
}

export function presentPrimaryRejection(
  code: string | null | undefined,
  t: TranslateFn,
  mode: CandidatePresentationMode = 'product',
): string {
  if (!code) return resolveProductLabel('unavailable', t);
  if (mode === 'technical') return code;
  return formatRejectionReason(code, t);
}

export function presentTimestamp(
  value: string | null | undefined,
  t: TranslateFn,
): string {
  if (!value) return resolveProductLabel('arb_timestamp_unavailable', t);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return resolveProductLabel('arb_timestamp_unavailable', t);
  return d.toLocaleString();
}

export function presentEmptyGroupMessage(t: TranslateFn): string {
  return resolveProductLabel('arb_group_empty', t);
}

export function presentMetricUnavailable(t: TranslateFn): string {
  return resolveProductLabel('arb_metric_unavailable', t);
}

export function isRawLocalizationKey(text: string): boolean {
  return /^arb_[a-z0-9_]+$/.test(text) || /^[a-z]+_[a-z0-9_]+$/.test(text);
}
