import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { fetchMexcCapabilitySummary, type MexcCapabilitySummary } from '../../../services/connectionsApi.ts';
import type { OnNavigateHandler } from '../../../types/navigation.ts';
import { buildMexcManageNavigation } from '../../../utils/settingsNavigation.ts';
import { buildMexcProviderSummary } from '../../../utils/mexcProviderSummary.ts';
import {
  selectConsumerProductReason,
  translateReasonKind,
} from '../../../utils/mexcReasonPriority.ts';

type Props = {
  onNavigate?: OnNavigateHandler;
};

/**
 * Wallet uses canonical MEXC Connection — no duplicate credential form.
 * Tier-4 actions remain visibly disabled.
 */
export default function MexcWalletCapabilityBanner({ onNavigate }: Props) {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<MexcCapabilitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchMexcCapabilitySummary();
        if (!cancelled) setSummary(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'connections_internal_error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const projection = summary
    ? buildMexcProviderSummary({
      connection: {
        provider: 'MEXC',
        configured: summary.connection?.configured,
        privateAuthVerified: summary.privateAuthentication?.verified,
        maskedKeyIdentifier: summary.connection?.maskedKeyIdentifier,
      },
      summary,
    })
    : null;

  const walletRead = summary?.consumers?.find((c) => c.consumerId === 'wallet');
  const walletWithdraw = summary?.consumers?.find((c) => c.consumerId === 'wallet_withdrawal_execute');
  const walletTransfer = summary?.consumers?.find((c) => c.consumerId === 'wallet_transfer_execute');
  const capabilityById = new Map(
    (summary?.capabilityMatrix?.capabilities || []).map((cap) => [cap.capabilityId, cap]),
  );

  const walletLimited = Boolean(
    walletRead
    && (walletRead.consumerReadiness === 'limited' || walletRead.limitedByDataContract),
  );

  const primaryReasonKind = walletLimited
    ? selectConsumerProductReason(walletRead as any, capabilityById)
    : selectConsumerProductReason(
      (walletWithdraw || walletTransfer || walletRead || { eligible: false, blockedReason: null }) as any,
      capabilityById,
    );

  const handleManageConnection = () => {
    if (onNavigate) {
      onNavigate(buildMexcManageNavigation('overview'));
    }
  };

  const onManageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleManageConnection();
    }
  };

  const authLabel = projection
    ? t(projection.overallStatusLabelKey)
    : t('connections_not_configured');

  const readEligibilityLabel = walletLimited
    ? t('mexc_limited')
    : walletRead?.eligible
      ? t('mexc_eligible')
      : t('mexc_limited');

  return (
    <section
      className="mb-4 rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-4"
      data-testid="mexc-wallet-capability-banner"
      aria-labelledby="mexc-wallet-banner-title"
    >
      <h3 id="mexc-wallet-banner-title" className="text-sm font-semibold text-white">
        {t('mexc_wallet_integration')}
      </h3>
      <p className="mt-1 text-xs text-slate-400">{t('mexc_wallet_integration_hint')}</p>

      {error && <p className="mt-2 text-sm text-red-300">{t(error)}</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
          <p className="text-[11px] text-slate-400">{t('mexc_connection_state')}</p>
          <p className="text-sm text-slate-100" data-testid="wallet-mexc-auth-state">
            {authLabel}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
          <p className="text-[11px] text-slate-400">{t('mexc_wallet_read_eligibility')}</p>
          <p className="text-sm text-slate-100" data-testid="wallet-mexc-eligibility">
            {readEligibilityLabel}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
          <p className="text-[11px] text-slate-400">{t('mexc_wallet_withdraw_eligibility')}</p>
          <p className="text-sm text-amber-200" data-testid="wallet-mexc-withdraw">
            {t('mexc_blocked')}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
          <p className="text-[11px] text-slate-400">{t('mexc_wallet_transfer_eligibility')}</p>
          <p className="text-sm text-amber-200" data-testid="wallet-mexc-transfer">
            {t('mexc_blocked')}
          </p>
        </div>
      </div>

      <div className="mt-2 space-y-1" data-testid="wallet-mexc-primary-reason">
        <p className="text-xs text-amber-200/90">
          {translateReasonKind(
            walletLimited
              ? 'wallet_consumer_limited'
              : primaryReasonKind === 'available'
                ? 'runtime_tier4'
                : primaryReasonKind,
            t,
          )}
        </p>
        {walletLimited && (
          <p className="text-[11px] text-slate-400">{t('mexc_wallet_structures_unsupported')}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t('mexc_reason_runtime_tier4')}
          className="cursor-not-allowed rounded-md bg-slate-700 px-3 py-2 text-xs text-slate-400"
          data-testid="wallet-withdraw-disabled"
        >
          {t('mexc_withdraw_action')}
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t('mexc_reason_runtime_tier4')}
          className="cursor-not-allowed rounded-md bg-slate-700 px-3 py-2 text-xs text-slate-400"
          data-testid="wallet-transfer-disabled"
        >
          {t('mexc_transfer_action')}
        </button>
        <button
          type="button"
          onClick={handleManageConnection}
          onKeyDown={onManageKeyDown}
          className="rounded-md border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200 hover:bg-indigo-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          data-testid="wallet-manage-connection-link"
        >
          {t('mexc_manage_connection')}
        </button>
      </div>
    </section>
  );
}
