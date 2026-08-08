import React, { useEffect, useId, useRef } from 'react';
import type { TruthClass } from '../artemisProductTypes.ts';
import { truthLabel } from '../artemisProductTypes.ts';
import {
  ARTEMIS_BTN_MODAL_CLOSE,
  ARTEMIS_BTN_OUTLINE,
  ARTEMIS_BTN_PRIMARY,
  ARTEMIS_BTN_TEXT,
  ARTEMIS_FOCUS,
  ARTEMIS_INNER,
  ARTEMIS_INPUT,
  ARTEMIS_ROW,
  ARTEMIS_SELECT,
  ARTEMIS_SHELL,
  ARTEMIS_TAB_ACTIVE,
  ARTEMIS_TAB_ITEM,
  ARTEMIS_TAB_STRIP,
  ARTEMIS_TABLE,
  ARTEMIS_TABLE_WRAP,
  ARTEMIS_TD,
  ARTEMIS_TECH,
  ARTEMIS_TH,
  ARTEMIS_THEAD,
  ARTEMIS_TR,
  METRIC_GRADIENT,
  METRIC_LABEL,
  METRIC_VALUE,
  PILL_CLASS,
  toneToMetric,
  toneToVariant,
  type ArtemisMetricColor,
  type ArtemisPillVariant,
  type ArtemisTone,
} from '../artemisDesignTokens.ts';

export {
  ARTEMIS_FOCUS,
  ARTEMIS_SHELL,
  ARTEMIS_INNER,
  ARTEMIS_ROW,
  ARTEMIS_TAB_STRIP,
  ARTEMIS_TAB_ITEM,
  ARTEMIS_TAB_ACTIVE,
  ARTEMIS_TABLE_WRAP,
  ARTEMIS_TABLE,
  ARTEMIS_THEAD,
  ARTEMIS_TH,
  ARTEMIS_TR,
  ARTEMIS_TD,
  ARTEMIS_TECH,
  toneToMetric,
  toneToVariant,
};

export const StatusPill: React.FC<{
  label: string;
  tone?: ArtemisTone | string;
  variant?: ArtemisPillVariant;
}> = ({ label, tone = 'neutral', variant }) => {
  const resolved = variant || toneToVariant(tone);
  return (
    <span
      data-artemis-pill={resolved}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${PILL_CLASS[resolved]}`}
    >
      {label}
    </span>
  );
};

export const MetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  color?: ArtemisMetricColor;
  hint?: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ label, value, color = 'purple', hint, badge }) => (
  <div
    data-artemis-metric={color}
    className={`rounded-xl border border-white/5 bg-gradient-to-br ${METRIC_GRADIENT[color]} to-transparent p-3 backdrop-blur-sm`}
  >
    <div className="flex items-center justify-between gap-1 mb-1">
      <p className={`text-[11px] ${METRIC_LABEL[color]}`}>{label}</p>
      {badge}
    </div>
    <p className={`text-sm font-semibold ${METRIC_VALUE[color]}`}>{value}</p>
    {hint ? <p className="text-[10px] text-muted-foreground/80 mt-1">{hint}</p> : null}
  </div>
);

export const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  titleId?: string;
}> = ({ title, subtitle, actions, titleId }) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3 md:mb-4">
    <div>
      <h2 id={titleId} className="text-sm md:text-base font-semibold text-foreground">
        {title}
      </h2>
      {subtitle ? <p className="text-[11px] text-muted-foreground mt-1 max-w-2xl">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
  </div>
);

export const ArtemisCard: React.FC<{
  title?: string;
  children: React.ReactNode;
  className?: string;
  truth?: TruthClass | string;
  t?: (key: string) => string;
  accent?: ArtemisMetricColor;
}> = ({ title, children, className = '', truth, t, accent }) => (
  <section
    className={`${accent ? `rounded-xl border border-white/5 bg-gradient-to-br ${METRIC_GRADIENT[accent]} to-transparent p-3 md:p-4 backdrop-blur-sm` : ARTEMIS_INNER} ${className}`}
    aria-label={title}
  >
    {title ? (
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {truth && t ? <StatusPill label={truthLabel(truth, t)} variant="neutral" /> : null}
      </div>
    ) : null}
    {children}
  </section>
);

export const EmptyState: React.FC<{ title: string; body: string; action?: React.ReactNode }> = ({
  title,
  body,
  action,
}) => (
  <div className="py-8 text-center bg-slate-900/60 border border-white/5 rounded-lg px-4" role="status">
    <p className="text-xs font-medium text-foreground">{title}</p>
    <p className="text-[11px] text-muted-foreground mt-1">{body}</p>
    {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
  </div>
);

export const UnavailableBlock: React.FC<{
  title: string;
  reason: string;
  t: (key: string) => string;
}> = ({ title, reason }) => <EmptyState title={title} body={reason} />;

export const AlertBanner: React.FC<{
  variant: 'warning' | 'error' | 'info';
  title?: string;
  children: React.ReactNode;
}> = ({ variant, title, children }) => {
  const box =
    variant === 'error'
      ? 'border-red-500/30 bg-red-500/10 text-red-100'
      : variant === 'info'
        ? 'border-blue-500/30 bg-blue-500/10 text-blue-100'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  return (
    <div className={`p-2 rounded border text-[11px] ${box}`} data-artemis-alert={variant}>
      {title ? <p className="font-semibold mb-0.5">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
};

export const LinkAction: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className = '' }) => (
  <button type="button" onClick={onClick} data-artemis-primary-action="true" className={`${ARTEMIS_BTN_PRIMARY} ${className}`}>
    {children}
  </button>
);

export const OutlineAction: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => (
  <button type="button" onClick={onClick} className={ARTEMIS_BTN_OUTLINE}>
    {children}
  </button>
);

export const TextAction: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => (
  <button type="button" onClick={onClick} className={ARTEMIS_BTN_TEXT}>
    {children}
  </button>
);

export const TechnicalDetails: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <details className={`${ARTEMIS_TECH} mt-3`} data-artemis-technical="true">
    <summary className={`cursor-pointer font-medium text-muted-foreground ${ARTEMIS_FOCUS} rounded`}>
      {title}
    </summary>
    <div className="mt-2 space-y-1 break-all" data-artemis-diagnostics="true">
      {children}
    </div>
  </details>
);

export const PipelineTrack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ol className="flex flex-col md:flex-row md:flex-wrap gap-2 md:items-stretch" aria-label="Readiness pipeline">
    {children}
  </ol>
);

export const PipelineStep: React.FC<{
  index: number;
  label: string;
  status: string;
  owner: string;
  blocker?: string | null;
  tone?: ArtemisTone;
  onOpen?: () => void;
  openLabel?: string;
  isLast?: boolean;
}> = ({ index, label, status, owner, blocker, tone = 'neutral', onOpen, openLabel, isLast }) => (
  <li className="flex md:flex-1 min-w-[120px] gap-2">
    <div className="flex md:flex-col items-stretch gap-2 flex-1">
      <div className={`flex-1 ${ARTEMIS_ROW}`}>
        <p className="text-[10px] font-medium text-muted-foreground">{index + 1}</p>
        <h4 className="text-sm font-semibold mt-0.5">{label}</h4>
        <div className="mt-2">
          <StatusPill label={status} tone={tone} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">{owner}</p>
        {blocker ? <p className="text-[11px] text-amber-200 mt-1">{blocker}</p> : null}
        {onOpen ? <div className="mt-2"><TextAction onClick={onOpen}>{openLabel || 'Open'}</TextAction></div> : null}
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      data-artemis-drawer="true"
    >
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label={closeLabel} onClick={onClose} />
      <div className="relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col m-0">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 id={headingId} className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          <button ref={closeRef} type="button" onClick={onClose} className={ARTEMIS_BTN_MODAL_CLOSE}>
            {closeLabel}
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 text-xs">{children}</div>
      </div>
    </div>
  );
};

export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 md:gap-3">{children}</div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1 text-[11px] text-muted-foreground min-w-[140px] flex-1">
    <span>{label}</span>
    {children}
  </label>
);

export const NativeInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`${ARTEMIS_INPUT} ${props.className || ''}`} />
);

export const NativeSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select {...props} className={`${ARTEMIS_SELECT} ${props.className || ''}`} />
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
        className={`ms-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/10 text-[10px] text-muted-foreground hover:bg-slate-900/90 ${ARTEMIS_FOCUS}`}
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
          className="absolute z-30 top-6 start-0 w-64 max-w-[80vw] rounded-lg border border-white/10 bg-slate-950/95 p-2 text-[11px] text-foreground shadow-2xl"
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
    className="inline-flex flex-wrap gap-1.5 p-1 border border-white/5 bg-slate-950/70 rounded-xl"
    role="group"
    aria-label="Artemis presentation"
    data-artemis-presentation={mode}
  >
    {([
      ['simple', simpleLabel],
      ['advanced', advancedLabel],
    ] as const).map(([value, label]) => {
      const active = mode === value;
      return (
        <button
          key={value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(value)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${ARTEMIS_FOCUS} ${
            active
              ? 'bg-purple-600/20 border-purple-500/60 text-purple-300'
              : 'border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground'
          }`}
        >
          {label}
        </button>
      );
    })}
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
    className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-slate-950/80 to-slate-900/80 p-3 md:p-4 backdrop-blur-sm"
    data-artemis-explainer="true"
    aria-label={title}
  >
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600/20 border border-purple-500/40 text-[11px] font-semibold text-purple-200"
        aria-hidden
      >
        i
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <ol className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
          {steps.map((step, index) => (
            <li key={step}>
              <span className="font-medium text-foreground/80 tabular-nums">{index + 1}.</span> {step}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkAction onClick={onGotIt}>{gotItLabel}</LinkAction>
          {learnMoreLabel && onLearnMore ? <TextAction onClick={onLearnMore}>{learnMoreLabel}</TextAction> : null}
        </div>
      </div>
    </div>
  </section>
);

export const ExpandableGroup: React.FC<{
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: ArtemisMetricColor;
}> = ({ title, summary, children, defaultOpen = false, accent = 'purple' }) => (
  <details
    className={`rounded-xl border border-white/5 bg-gradient-to-br ${METRIC_GRADIENT[accent]} to-transparent p-3 backdrop-blur-sm`}
    {...(defaultOpen ? { open: true } : {})}
  >
    <summary className={`cursor-pointer list-none ${ARTEMIS_FOCUS} rounded`}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-[11px] text-muted-foreground mt-1">{summary}</p>
    </summary>
    <div className="mt-3">{children}</div>
  </details>
);

export const FlowNode: React.FC<{
  label: string;
  status?: string;
  tone?: ArtemisTone;
  onClick?: () => void;
}> = ({ label, status, tone = 'neutral', onClick }) => {
  const color = toneToMetric(tone);
  const body = (
    <>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {status ? (
        <div className="mt-1">
          <StatusPill label={status} tone={tone} />
        </div>
      ) : null}
    </>
  );
  const className = `min-w-[110px] flex-1 text-start rounded-xl border border-white/5 bg-gradient-to-br ${METRIC_GRADIENT[color]} to-transparent p-3 backdrop-blur-sm ${ARTEMIS_FOCUS}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
};

export const StepRow: React.FC<{
  index: number;
  title: string;
  purpose: string;
  status: string;
  tone?: ArtemisTone;
  owner?: string;
  canBlock?: string;
  action?: React.ReactNode;
  accent?: ArtemisMetricColor;
}> = ({ index, title, purpose, status, tone = 'warning', owner, canBlock, action, accent }) => (
  <article
    className={`rounded-xl border border-white/5 bg-gradient-to-br ${METRIC_GRADIENT[accent || toneToMetric(tone)]} to-transparent p-3 backdrop-blur-sm`}
    data-artemis-step={index}
  >
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground">{index}</p>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-[11px] text-muted-foreground mt-1">{purpose}</p>
      </div>
      <StatusPill label={status} tone={tone} />
    </div>
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-foreground/90">
      {owner ? <p>{owner}</p> : null}
      {canBlock ? <p>{canBlock}</p> : null}
    </div>
    {action ? <div className="mt-2">{action}</div> : null}
  </article>
);
