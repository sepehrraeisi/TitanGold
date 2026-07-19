import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { fetchMexcCapabilitySummary, type MexcCapabilitySummary } from '../../../services/connectionsApi.ts';

/**
 * Wallet uses canonical MEXC Connection — no duplicate credential form.
 * Tier-4 actions remain visibly disabled.
 */
export default function MexcWalletCapabilityBanner() {
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

  const walletConsumer = summary?.consumers?.find((c) => c.consumerId === 'wallet');
  const withdrawBlocked = true;

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

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
          <p className="text-[11px] text-slate-400">{t('mexc_connection_state')}</p>
          <p className="text-sm text-slate-100" data-testid="wallet-mexc-auth-state">
            {summary?.connection?.authState?.replace(/_/g, ' ') || t('connections_not_configured')}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
          <p className="text-[11px] text-slate-400">{t('mexc_wallet_eligibility')}</p>
          <p className="text-sm text-slate-100" data-testid="wallet-mexc-eligibility">
            {walletConsumer?.eligible ? t('mexc_eligible') : t('mexc_blocked')}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
          <p className="text-[11px] text-slate-400">{t('mexc_tier4_status')}</p>
          <p className="text-sm text-amber-200" data-testid="wallet-mexc-tier4">
            {withdrawBlocked ? t('mexc_tier4_blocked') : t('mexc_eligible')}
          </p>
        </div>
      </div>

      {walletConsumer?.blockedReason && (
        <p className="mt-2 text-xs text-amber-200/90">{walletConsumer.blockedReason}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t('mexc_tier4_blocked')}
          className="cursor-not-allowed rounded-md bg-slate-700 px-3 py-2 text-xs text-slate-400"
          data-testid="wallet-withdraw-disabled"
        >
          {t('mexc_withdraw_action')}
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t('mexc_tier4_blocked')}
          className="cursor-not-allowed rounded-md bg-slate-700 px-3 py-2 text-xs text-slate-400"
          data-testid="wallet-transfer-disabled"
        >
          {t('mexc_transfer_action')}
        </button>
        <a
          href="#settings-connections"
          className="rounded-md border border-indigo-400/40 px-3 py-2 text-xs text-indigo-200 hover:bg-indigo-500/10"
          data-testid="wallet-manage-connection-link"
        >
          {t('mexc_manage_connection')}
        </a>
      </div>
    </section>
  );
}
