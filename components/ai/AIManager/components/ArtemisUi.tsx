import React, { useEffect, useId, useRef } from 'react';
import type { TruthClass } from '../artemisProductTypes.ts';
import { truthLabel } from '../artemisProductTypes.ts';

export const StatusPill: React.FC<{
  label: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'info' | 'ok';
}> = ({ label, tone = 'neutral' }) => {
  const tones: Record<string, string> = {
    neutral: 'bg-secondary text-foreground border-border',
    warning: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30',
    danger: 'bg-red-500/15 text-red-800 dark:text-red-200 border-red-500/30',
    info: 'bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-500/30',
    ok: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
};

export const ArtemisCard: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
  truth?: TruthClass | string;
  t: (key: string) => string;
}> = ({ title, children, className = '', truth, t }) => (
  <section className={`bg-card border border-border rounded-lg p-4 space-y-3 ${className}`} aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {truth ? (
        <span className="text-[10px] tracking-wide text-muted-foreground border border-border rounded px-2 py-0.5">
          {truthLabel(truth, t)}
        </span>
      ) : null}
    </div>
    {children}
  </section>
);

export const EmptyState: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="rounded-lg border border-dashed border-border px-4 py-3" role="status">
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-sm text-muted-foreground mt-1">{body}</p>
  </div>
);

export const UnavailableBlock: React.FC<{
  title: string;
  reason: string;
  t: (key: string) => string;
}> = ({ title, reason }) => <EmptyState title={title} body={reason} />;

export const LinkAction: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${className}`}
  >
    {children}
  </button>
);

export const TextAction: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-sm font-medium text-blue-700 dark:text-blue-300 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
  >
    {children}
  </button>
);

export const TechnicalDetails: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <details className="rounded-md border border-border/70 bg-secondary/20 px-3 py-2 text-xs">
    <summary className="cursor-pointer font-medium text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
      {title}
    </summary>
    <div className="mt-2 space-y-1 text-muted-foreground font-mono break-all" data-artemis-diagnostics="true">
      {children}
    </div>
  </details>
);

export const PipelineTrack: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <ol className="flex flex-col md:flex-row md:flex-wrap gap-2 md:gap-0" aria-label="Readiness pipeline">
    {children}
  </ol>
);

export const PipelineStep: React.FC<{
  index: number;
  label: string;
  status: string;
  owner: string;
  blocker?: string | null;
  tone?: 'neutral' | 'warning' | 'danger' | 'info' | 'ok';
  onOpen?: () => void;
  openLabel?: string;
  isLast?: boolean;
}> = ({ index, label, status, owner, blocker, tone = 'neutral', onOpen, openLabel, isLast }) => (
  <li className="flex md:flex-1 min-w-[140px] gap-2">
    <div className="flex md:flex-col items-stretch gap-2 flex-1">
      <div className="bg-card border border-border rounded-lg p-3 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{index + 1}</p>
        <h4 className="text-sm font-semibold mt-0.5">{label}</h4>
        <div className="mt-2">
          <StatusPill label={status} tone={tone} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{owner}</p>
        {blocker ? <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">{blocker}</p> : null}
        {onOpen ? (
          <TextAction onClick={onOpen}>{openLabel || 'Open'}</TextAction>
        ) : null}
      </div>
      {!isLast ? (
        <div className="hidden md:flex items-center justify-center text-muted-foreground px-1" aria-hidden>
          →
        </div>
      ) : null}
    </div>
  </li>
);

export const DetailDrawer: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
}> = ({ open, title, onClose, closeLabel, children }) => {
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={closeLabel} onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 m-0 sm:m-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 id={headingId} className="text-base font-semibold">
            {title}
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">{children}</div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1 text-xs text-muted-foreground min-w-[140px] flex-1">
    <span>{label}</span>
    {children}
  </label>
);

export const NativeInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${props.className || ''}`}
  />
);

export const NativeSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select
    {...props}
    className={`rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${props.className || ''}`}
  />
);
