export type TrendFeedbackState =
  | 'analysis_preparing'
  | 'analysis_running'
  | 'analysis_completed'
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
  detail?: string;
};

type TFn = (key: string) => string;

const TITLE_KEYS: Record<TrendFeedbackState, string> = {
  analysis_preparing: 'trend_feedback_analysis_preparing_title',
  analysis_running: 'trend_feedback_analysis_running_title',
  analysis_completed: 'trend_feedback_analysis_completed_title',
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

export function trendFeedbackSeverity(state: TrendFeedbackState) {
  return SEVERITY[state];
}

export function trendFeedbackTitle(state: TrendFeedbackState, t: TFn): string {
  const key = TITLE_KEYS[state];
  const translated = t(key);
  return translated === key ? state : translated;
}

export function trendFeedbackMessage(feedback: TrendFeedback, t: TFn): string {
  const key = MESSAGE_KEYS[feedback.state];
  const base = t(key);
  const translated = base === key ? feedback.state : base;
  if (feedback.detail) return `${translated} ${feedback.detail}`.trim();
  return translated;
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
