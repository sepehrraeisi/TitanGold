/**
 * Maps safe arbitrage reason codes to i18n keys (never show raw enum in product UI).
 */
const REJECTION_REASON_KEYS: Record<string, string> = {
  NON_POSITIVE_NET: 'arb_reason_non_positive_net',
  BELOW_MIN_PROFIT: 'arb_reason_below_min_profit',
  BELOW_MIN_SPREAD: 'arb_reason_below_min_spread',
  INSUFFICIENT_DEPTH: 'arb_reason_insufficient_depth',
  STALE_QUOTE: 'arb_reason_stale_quote',
  STALE_MARKET_DATA: 'arb_reason_stale_market_data',
  INSUFFICIENT_LIQUIDITY: 'arb_reason_insufficient_liquidity',
  ASSUMED_FEES_BPS: 'arb_reason_assumed_fees',
  ASSUMED_SLIPPAGE_BPS: 'arb_reason_assumed_slippage',
  candidate_not_qualified: 'arb_reason_not_qualified',
  unknown: 'arb_reason_unknown',
  monitoring_paused: 'arb_interpretation_monitoring_paused',
  no_scan_history: 'arb_interpretation_no_scan_history',
  latest_scan_failed: 'arb_interpretation_latest_scan_failed',
  no_qualified_candidates: 'arb_interpretation_no_qualified',
  all_symbols_rejected: 'arb_interpretation_all_rejected',
  stale_market_data: 'arb_interpretation_stale_data',
  latest_run_unavailable: 'arb_interpretation_latest_unavailable',
};

const INTERPRETATION_CODE_KEYS: Record<string, string> = {
  monitoring_paused: 'arb_interpretation_monitoring_paused',
  no_scan_history: 'arb_interpretation_no_scan_history',
  latest_scan_failed: 'arb_interpretation_latest_scan_failed',
  no_qualified_candidates: 'arb_interpretation_no_qualified',
  all_symbols_rejected: 'arb_interpretation_all_rejected',
  stale_market_data: 'arb_interpretation_stale_data',
  latest_run_unavailable: 'arb_interpretation_latest_unavailable',
  NON_POSITIVE_NET: 'arb_interpretation_non_positive_net',
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
  if (!code) return t('arb_metric_unavailable') || 'Unavailable';
  return t('arb_reason_unknown') || 'Rejected by configured thresholds';
}

type InterpretationShape = {
  primaryMessage?: string;
  safeReasonCodes?: string[];
  rejectionSummary?: Record<string, number>;
};

function formatCountMessage(
  t: (key: string) => string,
  key: string,
  count: number,
  fallback: string,
): string {
  const template = t(key);
  if (template && template !== key) {
    return template.replace('{count}', String(count));
  }
  return fallback.replace('{count}', String(count));
}

export function formatInterpretationMessage(
  interpretation: string | InterpretationShape | null | undefined,
  t: (key: string) => string,
): string {
  if (!interpretation) {
    return t('arbitrage_overview_interpretation_compact') || 'No interpretation available.';
  }
  if (typeof interpretation === 'string') return interpretation;

  const codes = interpretation.safeReasonCodes || [];
  const rejectionSummary = interpretation.rejectionSummary || {};
  const rejectedTotal = Object.values(rejectionSummary).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );

  for (const code of codes) {
    const key = INTERPRETATION_CODE_KEYS[code];
    if (!key) continue;
    if (code === 'NON_POSITIVE_NET' && rejectedTotal > 0) {
      return formatCountMessage(
        t,
        'arb_interpretation_non_positive_net',
        rejectedTotal,
        '{count} observation(s) were rejected because estimated net spread was not positive.',
      );
    }
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }

  const firstCode = codes[0];
  if (firstCode) {
    const translated = formatRejectionReason(firstCode, t);
    if (translated) return translated;
  }

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
