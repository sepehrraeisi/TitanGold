import React from 'react';
import ActionButton from '../../ui/action-button.tsx';
import { StatePill } from './mexcPanelShared.tsx';
import type { ProviderSummaryProjection } from '../../../utils/mexcProviderSummary.ts';
import type { ConnectionDisplayStatus } from '../../../services/connectionDisplayStatus.ts';

const PROVIDER_MARKS: Record<string, { initials: string; accent: string }> = {
  MEXC: { initials: 'MX', accent: 'from-indigo-500/30 via-purple-500/20 to-indigo-600/10 text-indigo-100' },
  Binance: { initials: 'BN', accent: 'from-amber-500/25 via-yellow-500/15 to-amber-600/10 text-amber-100' },
  Bybit: { initials: 'BY', accent: 'from-orange-500/25 via-orange-400/15 to-orange-600/10 text-orange-100' },
  KuCoin: { initials: 'KC', accent: 'from-emerald-500/25 via-green-500/15 to-emerald-600/10 text-emerald-100' },
  'Gate.io': { initials: 'GT', accent: 'from-sky-500/25 via-blue-500/15 to-sky-600/10 text-sky-100' },
};

export function providerMarkFor(exchange: string) {
  return PROVIDER_MARKS[exchange] || {
    initials: exchange.slice(0, 2).toUpperCase() || 'EX',
    accent: 'from-slate-600/30 via-slate-500/15 to-slate-700/10 text-slate-100',
  };
}

export function ProviderIdentityMark({
  exchange,
  muted = false,
}: {
  exchange: string;
  muted?: boolean;
}) {
  const mark = providerMarkFor(exchange);
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br text-xs font-semibold tracking-tight ${
        muted ? 'from-slate-800/80 via-slate-900/70 to-slate-950/80 text-slate-400' : mark.accent
      }`}
      aria-hidden="true"
      data-testid={`provider-mark-${exchange}`}
    >
      {mark.initials}
    </div>
  );
}

export function toneForDisplayStatus(status: ConnectionDisplayStatus): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (status === 'authenticated_capabilities_partial') return 'ok';
  if (status === 'configured_not_verified') return 'warn';
  if (status === 'secret_reentry_required') return 'bad';
  return 'neutral';
}

function formatCardDate(iso: string | null | undefined, language: string, t: (k: string) => string): string {
  if (!iso) return t('mexc_never');
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return t('mexc_never');
  return d.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function publicMarketLabel(status: string, t: (k: string) => string): string {
  if (status === 'available') return t('mexc_available');
  if (status === 'unavailable') return t('mexc_status_unavailable');
  return t('mexc_unknown');
}

export function privateAccessLabel(status: string, t: (k: string) => string): string {
  if (status === 'authenticated' || status === 'verified') {
    return t('mexc_authenticated') || 'Authenticated';
  }
  if (status === 'unverified' || status === 'pending') {
    return t('mexc_status_pending');
  }
  if (status === 'failed') return t('mexc_status_blocked');
  return t('connections_not_configured');
}

export function walletDataLabel(readiness: string, t: (k: string) => string): string {
  if (readiness === 'ready') return t('mexc_status_available') || 'Ready';
  if (readiness === 'limited') return t('mexc_limited') || 'Limited';
  if (readiness === 'blocked') return t('mexc_blocked') || 'Blocked';
  return t('mexc_unknown') || 'Unknown';
}

function ProviderSummaryMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'emerald' | 'blue' | 'amber' | 'neutral';
}) {
  const tones = {
    emerald: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-100',
    blue: 'from-blue-500/10 via-blue-500/5 to-transparent text-blue-100',
    amber: 'from-amber-500/10 via-amber-500/5 to-transparent text-amber-100',
    neutral: 'from-slate-500/10 via-slate-500/5 to-transparent text-slate-100',
  };
  const labelTones = {
    emerald: 'text-emerald-300/80',
    blue: 'text-blue-300/80',
    amber: 'text-amber-300/80',
    neutral: 'text-slate-400',
  };
  return (
    <div
      className={`rounded-xl border border-white/5 bg-gradient-to-br p-3 backdrop-blur-sm ${tones[tone]}`}
    >
      <p className={`mb-1 text-[11px] ${labelTones[tone]}`}>{label}</p>
      <p className="text-sm font-semibold leading-snug">{value}</p>
    </div>
  );
}

export function MexcCollapsedSummary({
  projection,
  language,
  t,
}: {
  projection: ProviderSummaryProjection;
  language: string;
  t: (k: string) => string;
}) {
  return (
    <>
      <div
        className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4"
        data-testid="mexc-collapsed-summary"
      >
        <ProviderSummaryMetric
          label={t('mexc_card_public_market')}
          value={publicMarketLabel(projection.publicMarketStatus, t)}
          tone="emerald"
        />
        <ProviderSummaryMetric
          label={t('mexc_card_private_access')}
          value={privateAccessLabel(projection.privateAuthenticationStatus, t)}
          tone="blue"
        />
        <ProviderSummaryMetric
          label={t('mexc_card_verified_reads')}
          value={String(projection.verifiedPrivateReadCount)}
          tone="neutral"
        />
        <ProviderSummaryMetric
          label={t('mexc_card_wallet_data')}
          value={walletDataLabel(projection.walletReadiness, t)}
          tone={projection.walletReadiness === 'limited' ? 'amber' : 'neutral'}
        />
      </div>
      <p
        className="mt-3 text-[11px] text-slate-400"
        data-testid="mexc-collapsed-last-verified"
      >
        {t('mexc_latest_successful_verification')}:{' '}
        {formatCardDate(projection.lastSuccessfulVerificationAt, language, t)}
      </p>
    </>
  );
}

export function ExchangeProviderListItem({
  exchange,
  isMexc,
  expanded,
  statusText,
  statusTone,
  actionLabel,
  onAction,
  awaitingAuthProjection = false,
  projection = null,
  language,
  t,
  dir = 'ltr',
  children,
}: {
  exchange: string;
  isMexc: boolean;
  expanded: boolean;
  statusText: string;
  statusTone: 'ok' | 'warn' | 'bad' | 'neutral';
  actionLabel: string;
  onAction: () => void;
  awaitingAuthProjection?: boolean;
  projection?: ProviderSummaryProjection | null;
  language: string;
  t: (k: string) => string;
  dir?: 'ltr' | 'rtl';
  children?: React.ReactNode;
}) {
  const cardShell = isMexc
    ? 'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 shadow-lg'
    : 'bg-slate-950/70';

  return (
    <article
      className={`overflow-hidden rounded-xl border border-white/5 ${cardShell}`}
      data-mexc-expanded={expanded ? 'true' : 'false'}
      data-testid={isMexc ? 'provider-list-card-mexc' : `provider-list-card-${exchange}`}
      dir={dir}
    >
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <ProviderIdentityMark exchange={exchange} muted={!isMexc} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4
                  className="text-sm font-semibold text-foreground"
                  data-testid={`connection-heading-${exchange}`}
                >
                  {exchange}
                </h4>
                {!awaitingAuthProjection && statusText && (
                  <StatePill label={statusText} tone={statusTone} />
                )}
                {awaitingAuthProjection && (
                  <span
                    className="inline-block h-5 w-36 animate-pulse rounded-md bg-slate-700/60"
                    aria-hidden="true"
                    data-testid={`connection-status-${exchange}`}
                  />
                )}
              </div>
              {!expanded && isMexc && !awaitingAuthProjection && statusText && (
                <p className="sr-only" data-testid={`connection-status-${exchange}`}>
                  {statusText}
                </p>
              )}
            </div>
          </div>

          {isMexc ? (
            <ActionButton
              variant={expanded ? 'secondary' : 'primary'}
              size="sm"
              className="shrink-0"
              aria-label={`${actionLabel} ${exchange}`}
              aria-expanded={expanded}
              data-testid={`connection-action-${exchange}`}
              onClick={onAction}
            >
              {actionLabel}
            </ActionButton>
          ) : (
            <span data-testid={`connection-unavailable-${exchange}`}>
              <StatePill label={statusText} tone="neutral" />
            </span>
          )}
        </div>

        {!expanded && isMexc && projection && !awaitingAuthProjection && (
          <MexcCollapsedSummary projection={projection} language={language} t={t} />
        )}

        {!isMexc && (
          <p className="sr-only" data-testid={`connection-unavailable-${exchange}-label`}>
            {statusText}
          </p>
        )}
      </div>

      {expanded && children}
    </article>
  );
}
