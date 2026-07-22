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
