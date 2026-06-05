import React from 'react';

/** Primary section shell — DESIGN_SYSTEM_DATAHUB.md §5 */
export const DATAHUB_SHELL =
    'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl p-4 md:p-5';

export const DATAHUB_INNER_LIST =
    'bg-slate-950/70 border border-white/5 rounded-xl p-3 md:p-4';

export const INPUT_CLASS =
    'w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground';

export const SELECT_CLASS =
    'w-full text-[11px] bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-foreground';

export const BTN_PRIMARY =
    'text-[11px] px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';

export const BTN_SECONDARY =
    'text-[11px] px-3 py-1.5 rounded-full border border-slate-600/70 bg-slate-900/70 text-foreground hover:border-purple-400 hover:text-purple-200 transition disabled:opacity-50';

export const BTN_OUTLINE_EMERALD =
    'text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40';

export const BTN_OUTLINE_SKY =
    'text-[10px] px-2 py-0.5 rounded-full border border-sky-500/60 text-sky-200 hover:bg-sky-500/10 disabled:opacity-40';

export const BTN_OUTLINE_AMBER =
    'text-[10px] px-2 py-0.5 rounded-full border border-amber-500/60 text-amber-200 hover:bg-amber-500/10 disabled:opacity-40';

export const BTN_OUTLINE_RED =
    'text-[10px] px-2 py-0.5 rounded-full border border-red-500/70 text-red-200 hover:bg-red-500/10 disabled:opacity-40';

export const BTN_OUTLINE_SLATE =
    'text-[10px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-100 hover:bg-slate-600/30';

export const BTN_OUTLINE_PURPLE =
    'text-[10px] px-2 py-0.5 rounded-full border border-purple-500/70 text-purple-200 hover:bg-purple-500/10';

/** Disable + tooltip when user lacks admin/trader write access. */
export function dataHubWriteGate(
    canWrite: boolean,
    t: (key: string) => string,
    extraDisabled = false,
): { disabled: boolean; title?: string } {
    const disabled = extraDisabled || !canWrite;
    return {
        disabled,
        title: !canWrite ? t('datahub_requires_admin_trader') : undefined,
    };
}

type PillVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'primary';

const PILL: Record<PillVariant, string> = {
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
    error: 'bg-red-500/10 text-red-300 border-red-500/40',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
    info: 'bg-blue-500/10 text-blue-300 border-blue-500/40',
    neutral: 'bg-slate-700 text-slate-300 border-slate-600',
    primary: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
};

export function StatusPill({
    label,
    variant = 'neutral',
    className = '',
    title,
}: {
    label: string;
    variant?: PillVariant;
    className?: string;
    title?: string;
}) {
    return (
        <span
            title={title}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${PILL[variant]} ${className}`}
        >
            {label}
        </span>
    );
}

type MetricColor = 'emerald' | 'blue' | 'purple' | 'amber' | 'red';

const METRIC_GRADIENT: Record<MetricColor, string> = {
    emerald: 'from-emerald-500/10 via-emerald-500/5',
    blue: 'from-blue-500/10 via-blue-500/5',
    purple: 'from-purple-500/10 via-purple-500/5',
    amber: 'from-amber-500/10 via-amber-500/5',
    red: 'from-red-500/10 via-red-500/5',
};

const METRIC_TEXT: Record<MetricColor, string> = {
    emerald: 'text-emerald-300/80 text-emerald-100',
    blue: 'text-blue-300/80 text-blue-100',
    purple: 'text-purple-300/80 text-purple-100',
    amber: 'text-amber-300/80 text-amber-100',
    red: 'text-red-300/80 text-red-100',
};

export function MetricCard({
    label,
    value,
    color = 'blue',
}: {
    label: string;
    value: React.ReactNode;
    color?: MetricColor;
}) {
    return (
        <div
            className={`rounded-xl border border-white/5 bg-gradient-to-br ${METRIC_GRADIENT[color]} to-transparent p-3 backdrop-blur-sm`}
        >
            <p className={`text-[11px] mb-1 ${METRIC_TEXT[color].split(' ')[0]}`}>{label}</p>
            <p className={`text-sm font-semibold ${METRIC_TEXT[color].split(' ')[1]}`}>{value}</p>
        </div>
    );
}

export function DataHubAlert({
    variant,
    message,
    onRetry,
    retryLabel,
}: {
    variant: 'error' | 'warning';
    message: string;
    onRetry?: () => void;
    retryLabel?: string;
}) {
    const box =
        variant === 'error'
            ? 'border-red-500/30 bg-red-500/10 text-red-100'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    return (
        <div className={`p-2 rounded border text-[11px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${box}`}>
            <span>{message}</span>
            {onRetry && (
                <button type="button" onClick={onRetry} className={BTN_OUTLINE_RED}>
                    {retryLabel}
                </button>
            )}
        </div>
    );
}

export function DataHubEmpty({ message }: { message: string }) {
    return (
        <div className="py-12 text-center text-xs text-muted-foreground bg-slate-900/60 border border-white/5 rounded-lg">
            {message}
        </div>
    );
}

export function DataHubToggle({
    checked,
    onChange,
    label,
    id,
    disabled = false,
    title,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    id: string;
    disabled?: boolean;
    title?: string;
}) {
    return (
        <label
            htmlFor={id}
            title={title}
            className={`flex items-center gap-2 text-[11px] text-foreground ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
        >
            <button
                type="button"
                id={id}
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className={`inline-flex items-center justify-center w-8 h-4 rounded-full transition-colors shrink-0 ${
                    checked ? 'bg-emerald-500/80' : 'bg-slate-700'
                }`}
            >
                <span
                    className={`w-3 h-3 rounded-full bg-white shadow transform transition-transform ${
                        checked ? 'translate-x-2' : '-translate-x-2'
                    }`}
                />
            </button>
            {label}
        </label>
    );
}

export function DataHubModal({
    title,
    subtitle,
    onClose,
    children,
    footer,
    maxWidth = 'max-w-2xl',
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer: React.ReactNode;
    maxWidth?: string;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <div
                className={`relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full ${maxWidth} max-h-[85vh] overflow-hidden flex flex-col`}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                        {subtitle && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground text-xl leading-none"
                        aria-label="close"
                    >
                        ×
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">{children}</div>
                {footer && (
                    <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export function sourceStatusVariant(status: string): PillVariant {
    if (status === 'active') return 'success';
    if (status === 'error') return 'error';
    if (status === 'testing') return 'warning';
    if (status === 'pending') return 'warning';
    if (status === 'linked') return 'info';
    return 'neutral';
}

export function priorityVariant(priority: string): PillVariant {
    if (priority === 'critical') return 'error';
    if (priority === 'high') return 'warning';
    if (priority === 'medium') return 'info';
    return 'neutral';
}

// --- Tab / header primitives (DESIGN_SYSTEM_DATAHUB.md §14, TAB_HEADER_REDESIGN_PLAN) ---

export type DataHubTabVariant = 'default' | 'telegram' | 'warning';

const TAB_STRIP_ACTIVE: Record<DataHubTabVariant, string> = {
    default: 'bg-purple-600/20 border-purple-500/60 text-purple-300',
    telegram: 'bg-sky-500/15 border-sky-500/60 text-sky-300',
    warning: 'bg-amber-500/15 border-amber-500/60 text-amber-300',
};

const TAB_STRIP_ITEM_BASE =
    'px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';

const TAB_STRIP_CONTAINER =
    'border border-white/5 bg-slate-950/70 rounded-xl p-2 overflow-x-auto no-scrollbar';

export type DataHubTabStripItem = {
    id: string;
    label: string;
    icon?: React.ReactNode;
    activeVariant?: DataHubTabVariant;
    disabled?: boolean;
};

export function DataHubTabStrip({
    items,
    activeId,
    onChange,
    ariaLabel,
    wrap = false,
    className = '',
}: {
    items: DataHubTabStripItem[];
    activeId: string;
    onChange: (id: string) => void;
    ariaLabel?: string;
    wrap?: boolean;
    className?: string;
}) {
    return (
        <div className={`${TAB_STRIP_CONTAINER} ${className}`.trim()}>
            <div
                role="tablist"
                aria-label={ariaLabel}
                className={`flex gap-2 whitespace-nowrap ${wrap ? 'flex-wrap' : ''}`}
            >
                {items.map(item => {
                    const isActive = activeId === item.id;
                    const variant = item.activeVariant ?? 'default';
                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            disabled={item.disabled}
                            onClick={() => onChange(item.id)}
                            className={`${TAB_STRIP_ITEM_BASE} ${
                                isActive ? TAB_STRIP_ACTIVE[variant] : ''
                            }`}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                {item.icon ? <span aria-hidden>{item.icon}</span> : null}
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export type DataHubSubTabItem = {
    id: string;
    label: string;
    disabled?: boolean;
    activeVariant?: DataHubTabVariant;
};

const SUB_TAB_ACTIVE: Record<DataHubTabVariant, string> = {
    default: 'border-purple-500 text-purple-300',
    telegram: 'border-sky-500 text-sky-300',
    warning: 'border-amber-500 text-amber-300',
};

export function DataHubSubTabBar({
    items,
    activeId,
    onChange,
    ariaLabel,
    className = '',
}: {
    items: DataHubSubTabItem[];
    activeId: string;
    onChange: (id: string) => void;
    ariaLabel?: string;
    className?: string;
}) {
    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={`flex gap-2 md:gap-4 border-b border-white/10 overflow-x-auto no-scrollbar ${className}`.trim()}
        >
            {items.map(item => {
                const isActive = activeId === item.id;
                const variant = item.activeVariant ?? 'default';
                return (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        disabled={item.disabled}
                        onClick={() => onChange(item.id)}
                        className={`pb-2 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isActive
                                ? SUB_TAB_ACTIVE[variant]
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

export function DataHubSectionHeader({
    title,
    subtitle,
    actions,
    className = '',
}: {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 md:mb-5 ${className}`.trim()}
        >
            <div>
                <h3 className="text-sm md:text-base font-semibold text-foreground">{title}</h3>
                {subtitle ? (
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">{subtitle}</p>
                ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
        </div>
    );
}

/** Skeleton placeholder matching DataHubTabStrip pill shape */
export function DataHubTabStripSkeleton({ count = 7 }: { count?: number }) {
    return (
        <div className={TAB_STRIP_CONTAINER}>
            <div className="flex gap-2 whitespace-nowrap">
                {Array.from({ length: count }, (_, i) => (
                    <div
                        key={i}
                        className="h-8 rounded-full bg-slate-900/60 border border-white/5 animate-pulse"
                        style={{ width: `${3.5 + (i % 3) * 0.75}rem` }}
                    />
                ))}
            </div>
        </div>
    );
}
