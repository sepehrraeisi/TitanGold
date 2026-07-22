import React from 'react';

export interface DraftSecrets {
  apiKey: string;
  apiSecret: string;
}

export const GROUP_ORDER = [
  'Market Data',
  'Spot',
  'Futures',
  'Wallet',
  'Transfers',
  'P2P',
  'Account',
];

/** Product-facing consumers — read and execute kept separate */
export const PRIMARY_CONSUMER_IDS = [
  'portfolio',
  'arbitrage',
  'market_data_agents',
  'spot_trading_read',
  'spot_trading_execute',
  'futures_trading_read',
  'futures_trading_execute',
  'wallet',
  'wallet_withdrawal_execute',
  'wallet_transfer_execute',
  'risk_agents',
] as const;

export function StatePill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'ok' | 'warn' | 'bad' | 'neutral' | 'info';
}) {
  const tones: Record<string, string> = {
    ok: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40',
    warn: 'bg-amber-500/10 text-amber-200 border-amber-500/40',
    bad: 'bg-red-500/10 text-red-200 border-red-500/40',
    info: 'bg-blue-500/10 text-blue-200 border-blue-500/40',
    neutral: 'bg-slate-700/40 text-slate-200 border-slate-600/50',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${tones[tone]}`}>
      {label}
    </span>
  );
}

export function formatDuration(iso: string | null | undefined, language: string, t: (k: string) => string): string {
  if (!iso) return t('mexc_never');
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return t('mexc_never');
  const diffMs = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (language === 'fa') {
    if (days > 0) return `${days} روز`;
    if (hours > 0) return `${hours} ساعت`;
    if (minutes > 0) return `${minutes} دقیقه`;
    return 'کمتر از یک دقیقه';
  }
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

export function formatLocalizedDateTime(iso: string | null | undefined, language: string, t: (k: string) => string): string {
  if (!iso) return t('mexc_never');
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return t('mexc_never');
  return d.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function productStatusLabel(status: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    available: 'mexc_status_available',
    pending: 'mexc_status_pending',
    blocked: 'mexc_status_blocked',
    unavailable: 'mexc_status_unavailable',
  };
  return t(map[status] || 'mexc_status_blocked');
}

export function toneForProductStatus(status: string) {
  if (status === 'available') return 'ok' as const;
  if (status === 'pending') return 'warn' as const;
  if (status === 'unavailable') return 'neutral' as const;
  return 'bad' as const;
}

export function consumerEligibilityLabel(
  consumer: {
    eligible?: boolean;
    registered?: boolean;
    sideEffectClass?: string;
    consumerReadiness?: string | null;
    limitedByDataContract?: boolean;
  },
  t: (k: string) => string,
): { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' } {
  if (consumer.registered === false) {
    return { label: t('mexc_not_registered'), tone: 'neutral' };
  }
  if (consumer.consumerReadiness === 'limited' || consumer.limitedByDataContract) {
    return { label: t('mexc_limited'), tone: 'warn' };
  }
  if (consumer.eligible) return { label: t('mexc_eligible'), tone: 'ok' };
  if (consumer.sideEffectClass === 'financial_write' || consumer.sideEffectClass === 'account_mutation') {
    return { label: t('mexc_blocked'), tone: 'bad' };
  }
  return { label: t('mexc_limited'), tone: 'warn' };
}

export function summarizePrimaryConsumers(
  consumers: Array<{
    consumerId?: string;
    eligible?: boolean;
    registered?: boolean;
    sideEffectClass?: string;
    consumerReadiness?: string | null;
    limitedByDataContract?: boolean;
  }>,
): { registered: number; eligible: number; limited: number; blocked: number } {
  const byId = new Map(consumers.map((c) => [String(c.consumerId || ''), c]));
  let eligible = 0;
  let limited = 0;
  let blocked = 0;
  for (const id of PRIMARY_CONSUMER_IDS) {
    const c = byId.get(id);
    if (!c || c.registered === false) {
      blocked += 1;
      continue;
    }
    if (c.consumerReadiness === 'limited' || c.limitedByDataContract) {
      limited += 1;
    } else if (c.eligible) {
      eligible += 1;
    } else if (
      c.sideEffectClass === 'financial_write'
      || c.sideEffectClass === 'account_mutation'
    ) {
      blocked += 1;
    } else {
      limited += 1;
    }
  }
  return { registered: PRIMARY_CONSUMER_IDS.length, eligible, limited, blocked };
}

/** Product credential status — never expose raw lowercase enums in normal view */
export function credentialStatusProductLabel(
  raw: string | null | undefined,
  authenticated: boolean,
  t: (k: string) => string,
): string {
  if (authenticated || /authenticated/i.test(String(raw || ''))) {
    return t('mexc_authenticated');
  }
  const value = String(raw || '').trim();
  if (!value) return t('connections_not_configured');
  if (/^[a-z0-9_]+$/i.test(value) && value === value.toLowerCase()) {
    // Raw enum guard — map known values, otherwise fall back to configured/not configured
    if (value.includes('reentry')) return t('connections_secret_reentry_required');
    if (value.includes('configured')) return t('connections_configured_not_verified');
    return t('connections_not_configured');
  }
  return value;
}

export type ConnectionsSectionItem = {
  id: string;
  label: string;
  activeVariant?: 'default' | 'warning';
};

export function ConnectionsSectionNav({
  items,
  activeId,
  onChange,
  ariaLabel,
}: {
  items: ConnectionsSectionItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const ids = items.map((i) => i.id);
    const idx = ids.indexOf(activeId);
    if (idx < 0) return;
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      next = (idx + dir + ids.length) % ids.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = ids.length - 1;
    } else {
      return;
    }
    onChange(ids[next]);
    const el = document.getElementById(`mexc-tab-${ids[next]}`);
    el?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="mb-2 flex gap-2 overflow-x-auto border-b border-white/10 no-scrollbar md:gap-4"
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const isActive = activeId === item.id;
        const activeClass = item.activeVariant === 'warning'
          ? 'border-amber-500 text-amber-300'
          : 'border-indigo-400 text-indigo-200';
        return (
          <button
            key={item.id}
            id={`mexc-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`mexc-panel-${item.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(item.id);
              }
            }}
            className={`whitespace-nowrap border-b-2 pb-2 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
              isActive ? activeClass : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid={`mexc-section-tab-${item.id}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
