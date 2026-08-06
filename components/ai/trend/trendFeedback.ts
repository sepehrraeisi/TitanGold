import type { TrendMtfSummary } from '../../../services/trendCoreClient.ts';

export type TrendFeedbackState =
  | 'analysis_preparing'
  | 'analysis_running'
  | 'analysis_completed'
  | 'analysis_completed_with_comparisons'
  | 'analysis_completed_partial_comparisons'
  | 'analysis_comparison_unavailable'
  | 'analysis_failed'
  | 'settings_saving'
  | 'settings_saved'
  | 'settings_validation_failed'
  | 'settings_conflict'
  | 'provider_unavailable'
  | 'stale_data'
  | 'execution_blocked'
  | 'load_failed';

export type TrendFeedback = {
  state: TrendFeedbackState;
  /** Completed comparison count for success messaging. */
  comparisonCount?: number;
  detail?: string;
};

type TFn = (key: string, options?: Record<string, string | number>) => string;

const TITLE_KEYS: Record<TrendFeedbackState, string> = {
  analysis_preparing: 'trend_feedback_analysis_preparing_title',
  analysis_running: 'trend_feedback_analysis_running_title',
  analysis_completed: 'trend_feedback_analysis_completed_title',
  analysis_completed_with_comparisons: 'trend_feedback_analysis_completed_title',
  analysis_completed_partial_comparisons: 'trend_feedback_analysis_partial_title',
  analysis_comparison_unavailable: 'trend_feedback_analysis_comparison_unavailable_title',
  analysis_failed: 'trend_feedback_analysis_failed_title',
  settings_saving: 'trend_feedback_settings_saving_title',
  settings_saved: 'trend_feedback_settings_saved_title',
  settings_validation_failed: 'trend_feedback_settings_validation_title',
  settings_conflict: 'trend_feedback_settings_conflict_title',
  provider_unavailable: 'trend_feedback_provider_unavailable_title',
  stale_data: 'trend_feedback_stale_data_title',
  execution_blocked: 'trend_feedback_execution_blocked_title',
  load_failed: 'trend_feedback_load_failed_title',
};

const MESSAGE_KEYS: Record<TrendFeedbackState, string> = {
  analysis_preparing: 'trend_feedback_analysis_preparing_message',
  analysis_running: 'trend_feedback_analysis_running_message',
  analysis_completed: 'trend_feedback_analysis_completed_message',
  analysis_completed_with_comparisons: 'trend_feedback_analysis_completed_with_comparisons_message',
  analysis_completed_partial_comparisons: 'trend_feedback_analysis_partial_comparisons_message',
  analysis_comparison_unavailable: 'trend_feedback_analysis_comparison_unavailable_message',
  analysis_failed: 'trend_feedback_analysis_failed_message',
  settings_saving: 'trend_feedback_settings_saving_message',
  settings_saved: 'trend_feedback_settings_saved_message',
  settings_validation_failed: 'trend_feedback_settings_validation_message',
  settings_conflict: 'trend_feedback_settings_conflict_message',
  provider_unavailable: 'trend_feedback_provider_unavailable_message',
  stale_data: 'trend_feedback_stale_data_message',
  execution_blocked: 'trend_feedback_execution_blocked_message',
  load_failed: 'trend_feedback_load_failed_message',
};

const SEVERITY: Record<TrendFeedbackState, 'info' | 'success' | 'warning' | 'error'> = {
  analysis_preparing: 'info',
  analysis_running: 'info',
  analysis_completed: 'success',
  analysis_completed_with_comparisons: 'success',
  analysis_completed_partial_comparisons: 'warning',
  analysis_comparison_unavailable: 'warning',
  analysis_failed: 'error',
  settings_saving: 'info',
  settings_saved: 'success',
  settings_validation_failed: 'error',
  settings_conflict: 'warning',
  provider_unavailable: 'warning',
  stale_data: 'warning',
  execution_blocked: 'error',
  load_failed: 'error',
};

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function formatTrendCount(value: number, locale?: string): string {
  const raw = String(Math.max(0, Math.floor(value)));
  if (locale !== 'fa') return raw;
  return raw.replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

/** Canonical comparison-complete message keys by completed comparison count. */
export function analysisCompleteComparisonMessageKey(completedCount: number): string {
  if (completedCount <= 0) return 'trend_feedback_analysis_completed_primary_only_message';
  if (completedCount === 1) return 'trend_feedback_analysis_completed_one_comparison_message';
  return 'trend_feedback_analysis_completed_many_comparisons_message';
}

export function formatAnalysisCompleteComparisonMessage(
  completedCount: number,
  t: TFn,
  locale?: string,
): string {
  const count = Math.max(0, Math.min(3, Math.floor(completedCount)));
  const localizedCount = formatTrendCount(count, locale);
  const key = analysisCompleteComparisonMessageKey(count);
  const translated = t(key, count >= 2 ? { count: localizedCount } : count === 1 ? { count: localizedCount } : {});
  if (translated !== key) return translated;
  return t('trend_feedback_analysis_completed_message');
}

export function buildAnalysisCompleteFeedback(mtfSummary?: TrendMtfSummary | null): TrendFeedback {
  if (!mtfSummary || mtfSummary.requestedCount === 0) {
    return { state: 'analysis_completed', comparisonCount: 0 };
  }
  const { lifecycleStatus, requestedCount, completedCount, unavailableCount, failedCount } = mtfSummary;
  if (lifecycleStatus === 'complete') {
    return {
      state: 'analysis_completed_with_comparisons',
      comparisonCount: completedCount,
    };
  }
  if (lifecycleStatus === 'complete_with_partial_comparisons') {
    return {
      state: 'analysis_completed_partial_comparisons',
      detail: `${completedCount}/${requestedCount}`,
    };
  }
  if (lifecycleStatus === 'comparison_unavailable') {
    return {
      state: 'analysis_comparison_unavailable',
      detail: `${unavailableCount + failedCount}/${requestedCount}`,
    };
  }
  return { state: 'analysis_completed', comparisonCount: 0 };
}

export function trendFeedbackSeverity(state: TrendFeedbackState) {
  return SEVERITY[state];
}

export function trendFeedbackTitle(state: TrendFeedbackState, t: TFn): string {
  const key = TITLE_KEYS[state];
  const translated = t(key);
  return translated === key ? state : translated;
}

export function trendFeedbackMessage(feedback: TrendFeedback, t: TFn, locale?: string): string {
  if (feedback.state === 'analysis_completed_with_comparisons') {
    return formatAnalysisCompleteComparisonMessage(feedback.comparisonCount ?? 0, t, locale);
  }

  if (feedback.state === 'analysis_completed' && feedback.comparisonCount === 0) {
    const primaryOnly = t('trend_feedback_analysis_completed_primary_only_message');
    if (primaryOnly !== 'trend_feedback_analysis_completed_primary_only_message') return primaryOnly;
  }

  const key = MESSAGE_KEYS[feedback.state];
  let base = t(key);
  if (base === key) base = feedback.state;

  if (
    (feedback.state === 'analysis_completed_partial_comparisons' ||
      feedback.state === 'analysis_comparison_unavailable') &&
    feedback.detail
  ) {
    const [a, b] = feedback.detail.split('/');
    const countA = formatTrendCount(Number(a), locale);
    const countB = formatTrendCount(Number(b), locale);
    if (feedback.state === 'analysis_comparison_unavailable') {
      const translated = t(key, { unavailable: countA, requested: countB });
      return translated === key ? base : translated;
    }
    const translated = t(key, { completed: countA, requested: countB });
    return translated === key ? base : translated;
  }

  return base;
}

export function sanitizeTrendApiError(error: unknown, t: TFn): TrendFeedback {
  const err = error as Error & { status?: number; code?: string; message?: string };
  const code = err?.code;
  const status = err?.status;
  const raw = String(err?.message || '').trim();

  if (status === 409 || code === 'VERSION_CONFLICT') {
    return { state: 'settings_conflict' };
  }
  if (code === 'VALIDATION_ERROR' || status === 400) {
    const detail = raw && !/^unknown fields/i.test(raw) ? raw : undefined;
    return { state: 'settings_validation_failed', detail };
  }
  if (status === 503 || /provider|mexc|market data/i.test(raw)) {
    return { state: 'provider_unavailable' };
  }
  if (/stale|aged|outdated/i.test(raw)) {
    return { state: 'stale_data' };
  }
  if (status === 401 || status === 403 || /permission|capability|denied/i.test(raw)) {
    return { state: 'execution_blocked' };
  }
  if (raw && raw.length < 120 && !/stack|at\s+\w+/i.test(raw)) {
    return { state: 'analysis_failed', detail: raw };
  }
  return { state: 'analysis_failed' };
}

export function sanitizeTrendSettingsError(error: unknown, t: TFn): TrendFeedback {
  const err = error as Error & { status?: number; code?: string; message?: string };
  const code = err?.code;
  const status = err?.status;
  const raw = String(err?.message || '').trim();

  if (status === 409 || code === 'VERSION_CONFLICT') {
    return { state: 'settings_conflict' };
  }
  if (code === 'VALIDATION_ERROR' || status === 400) {
    let detail: string | undefined;
    if (raw.startsWith('Unknown fields')) {
      detail = t('trend_settings_unknown_fields');
    } else if (raw.startsWith('Invalid timeframe')) {
      detail = t('trend_settings_invalid_timeframe');
    } else if (raw.startsWith('Invalid compare')) {
      detail = t('trend_settings_invalid_compare');
    } else if (raw && raw.length < 120) {
      detail = raw;
    }
    return { state: 'settings_validation_failed', detail };
  }
  if (status === 401 || status === 403) {
    return { state: 'execution_blocked' };
  }
  return { state: 'settings_validation_failed', detail: t('settings_save_failed') };
}
