import React from 'react';
import {
  trendFeedbackMessage,
  trendFeedbackSeverity,
  trendFeedbackTitle,
  type TrendFeedback,
} from './trendFeedback.ts';

type TFn = (key: string) => string;

const BOX: Record<'info' | 'success' | 'warning' | 'error', string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  error: 'border-red-500/30 bg-red-500/10 text-red-100',
};

export type TrendFeedbackBannerProps = {
  feedback: TrendFeedback;
  t: TFn;
  onDismiss?: () => void;
  dismissLabel?: string;
  testId?: string;
};

export const TrendFeedbackBanner: React.FC<TrendFeedbackBannerProps> = ({
  feedback,
  t,
  onDismiss,
  dismissLabel,
  testId = 'trend-feedback-banner',
}) => {
  const severity = trendFeedbackSeverity(feedback.state);
  const title = trendFeedbackTitle(feedback.state, t);
  const message = trendFeedbackMessage(feedback, t);
  const role = severity === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
      data-testid={testId}
      data-feedback-state={feedback.state}
      className={`mb-3 p-3 rounded-lg border text-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 ${BOX[severity]}`}
    >
      <div className="space-y-0.5 min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs opacity-90">{message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs underline opacity-80 hover:opacity-100"
          data-testid={`${testId}-dismiss`}
        >
          {dismissLabel || t('close')}
        </button>
      ) : null}
    </div>
  );
};

export default TrendFeedbackBanner;
