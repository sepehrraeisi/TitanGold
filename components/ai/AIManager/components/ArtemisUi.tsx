import React from 'react';
import type { TruthClass } from '../artemisProductTypes.ts';
import { truthLabel } from '../artemisProductTypes.ts';

export const ArtemisCard: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
  truth?: TruthClass | string;
  t: (key: string) => string;
}> = ({ title, children, className = '', truth, t }) => (
  <section
    className={`bg-card border border-border rounded-lg p-4 space-y-3 ${className}`}
    aria-label={title}
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {truth ? (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-2 py-0.5">
          {truthLabel(truth, t)}
        </span>
      ) : null}
    </div>
    {children}
  </section>
);

export const UnavailableBlock: React.FC<{
  title: string;
  reason: string;
  t: (key: string) => string;
}> = ({ title, reason, t }) => (
  <div
    className="rounded-lg border border-dashed border-border bg-secondary/20 p-4"
    role="status"
    aria-live="polite"
  >
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-sm text-muted-foreground mt-1">{reason}</p>
    <p className="text-xs text-muted-foreground mt-2">
      {t('artemis_unavailable_not_zero') || 'Unavailable is not zero and is not success.'}
    </p>
  </div>
);

export const StatusPill: React.FC<{
  label: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'info' | 'ok';
}> = ({ label, tone = 'neutral' }) => {
  const tones: Record<string, string> = {
    neutral: 'bg-secondary text-foreground border-border',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    danger: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    info: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
};
