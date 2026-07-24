/**
 * Maps safe arbitrage reason codes to i18n keys (never show raw enum in product UI).
 */
const REJECTION_REASON_KEYS: Record<string, string> = {
  NON_POSITIVE_NET: 'arb_reason_non_positive_net',
  BELOW_MIN_PROFIT: 'arb_reason_below_min_profit',
  BELOW_MIN_SPREAD: 'arb_reason_below_min_spread',
  INSUFFICIENT_DEPTH: 'arb_reason_insufficient_depth',
  STALE_QUOTE: 'arb_reason_stale_quote',
  ASSUMED_FEES_BPS: 'arb_reason_assumed_fees',
  ASSUMED_SLIPPAGE_BPS: 'arb_reason_assumed_slippage',
  candidate_not_qualified: 'arb_reason_not_qualified',
  unknown: 'arb_reason_unknown',
  monitoring_paused: 'arb_reason_monitoring_paused',
  no_scan_history: 'arb_reason_no_scan_history',
  latest_scan_failed: 'arb_reason_latest_scan_failed',
  no_qualified_candidates: 'arb_reason_no_qualified',
  all_symbols_rejected: 'arb_reason_all_rejected',
  stale_market_data: 'arb_reason_stale_data',
  latest_run_unavailable: 'arb_reason_latest_unavailable',
};

export function rejectionReasonLabelKey(code: string | null | undefined): string {
  if (!code) return 'arb_reason_unknown';
  const normalized = String(code).trim();
  return REJECTION_REASON_KEYS[normalized] || 'arb_reason_unknown';
}

export function formatRejectionReason(
  code: string | null | undefined,
  t: (key: string) => string,
): string {
  const key = rejectionReasonLabelKey(code);
  const mapped = t(key);
  if (mapped && mapped !== key) return mapped;
  if (!code) return t('not_available') || 'N/A';
  return t('arb_reason_unknown') || 'Rejected by configured thresholds';
}

export function formatInterpretationMessage(
  interpretation: string | { primaryMessage?: string; safeReasonCodes?: string[] } | null | undefined,
  t: (key: string) => string,
): string {
  if (!interpretation) {
    return t('arbitrage_overview_interpretation_compact') || 'No interpretation available.';
  }
  if (typeof interpretation === 'string') return interpretation;
  if (interpretation.primaryMessage) return interpretation.primaryMessage;
  const firstCode = interpretation.safeReasonCodes?.[0];
  if (firstCode) return formatRejectionReason(firstCode, t);
  return t('arbitrage_overview_interpretation_compact') || 'No interpretation available.';
}

export const FUNNEL_METRIC_DEFINITIONS: Record<string, string> = {
  symbolsRequested: 'arb_funnel_symbols_requested_help',
  symbolsEvaluated: 'arb_funnel_symbols_evaluated_help',
  rawObservations: 'arb_funnel_raw_observations_help',
  analyticalCandidates: 'arb_funnel_analytical_candidates_help',
  rejected: 'arb_funnel_rejected_help',
  qualified: 'arb_funnel_qualified_help',
  expired: 'arb_funnel_expired_help',
  blocked: 'arb_funnel_blocked_help',
};
