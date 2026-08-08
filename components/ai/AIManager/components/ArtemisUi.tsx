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

export const EmptyState: React.FC<{ title: string; body: string; action?: React.ReactNode }> = ({
  title,
  body,
  action,
}) => (
  <div className="rounded-lg border border-dashed border-border px-4 py-3" role="status">
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-sm text-muted-foreground mt-1">{body}</p>
    {action ? <div className="mt-3">{action}</div> : null}
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

export const HelpTip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const id = useId();
  const [open, setOpen] = React.useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        className="ms-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute z-30 top-7 start-0 w-64 max-w-[80vw] rounded-md border border-border bg-card p-2 text-xs text-foreground shadow-lg"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
};

export const PresentationToggle: React.FC<{
  mode: 'simple' | 'advanced';
  onChange: (mode: 'simple' | 'advanced') => void;
  simpleLabel: string;
  advancedLabel: string;
}> = ({ mode, onChange, simpleLabel, advancedLabel }) => (
  <div
    className="inline-flex rounded-lg border border-border p-0.5"
    role="group"
    aria-label="Artemis presentation"
    data-artemis-presentation={mode}
  >
    <button
      type="button"
      aria-pressed={mode === 'simple'}
      onClick={() => onChange('simple')}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        mode === 'simple' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-secondary'
      }`}
    >
      {simpleLabel}
    </button>
    <button
      type="button"
      aria-pressed={mode === 'advanced'}
      onClick={() => onChange('advanced')}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        mode === 'advanced' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-secondary'
      }`}
    >
      {advancedLabel}
    </button>
  </div>
);

export const FirstVisitExplainer: React.FC<{
  title: string;
  steps: string[];
  gotItLabel: string;
  learnMoreLabel?: string;
  onGotIt: () => void;
  onLearnMore?: () => void;
}> = ({ title, steps, gotItLabel, learnMoreLabel, onGotIt, onLearnMore }) => (
  <section
    className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4"
    data-artemis-explainer="true"
    aria-label={title}
  >
    <h2 className="text-sm font-bold">{title}</h2>
    <ol className="mt-2 space-y-1 text-sm text-foreground/90">
      {steps.map((step, index) => (
        <li key={step}>
          <span className="font-semibold tabular-nums">{index + 1}.</span> {step}
        </li>
      ))}
    </ol>
    <div className="mt-3 flex flex-wrap gap-2">
      <LinkAction onClick={onGotIt}>{gotItLabel}</LinkAction>
      {learnMoreLabel && onLearnMore ? <TextAction onClick={onLearnMore}>{learnMoreLabel}</TextAction> : null}
    </div>
  </section>
);

export const ExpandableGroup: React.FC<{
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, summary, children, defaultOpen = false }) => (
  <details className="rounded-xl border border-border bg-card p-3" open={defaultOpen || undefined}>
    <summary className="cursor-pointer list-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{summary}</p>
        </div>
      </div>
    </summary>
    <div className="mt-3">{children}</div>
  </details>
);

export const FlowNode: React.FC<{
  label: string;
  status?: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'info' | 'ok';
  onClick?: () => void;
}> = ({ label, status, tone = 'neutral', onClick }) => {
  const body = (
    <>
      <p className="text-sm font-semibold">{label}</p>
      {status ? <div className="mt-1"><StatusPill label={status} tone={tone} /></div> : null}
    </>
  );
  const className = 'min-w-[120px] flex-1 bg-card border border-border rounded-xl p-3 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
};
