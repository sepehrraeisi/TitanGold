import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { fetchMexcCapabilitySummary, type MexcCapabilitySummary } from '../../services/connectionsApi.ts';

/** Futures integration — maintenance-aware; Spot auth does not grant Futures. */
export default function MexcFuturesCapabilityPanel() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<MexcCapabilitySummary | null>(null);

  useEffect(() => {
    fetchMexcCapabilitySummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  const caps = summary?.capabilityMatrix?.capabilities || [];
  const byId = Object.fromEntries(caps.map((c) => [c.capabilityId, c]));
  const consumer = summary?.consumers?.find((c) => c.consumerId === 'futures_trading');
  const exec = byId.FUTURES_TRADE_EXECUTE;

  return (
    <section
      className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-4"
      data-testid="mexc-futures-capability-panel"
    >
      <h3 className="text-sm font-semibold text-white">{t('mexc_futures_gates')}</h3>
      <ul className="mt-3 space-y-1 text-xs text-slate-300">
        <li>Public futures market: {byId.MARKET_DATA_FUTURES_PUBLIC?.providerSupport === 'supported' ? 'available' : 'N/A'}</li>
        <li>Account read: {byId.FUTURES_ACCOUNT_READ?.operationalState || 'disabled'}</li>
        <li>Positions: {byId.FUTURES_POSITION_READ?.operationalState || 'disabled'}</li>
        <li>Orders read: {byId.FUTURES_ORDER_READ?.operationalState || 'disabled'}</li>
        <li>
          Trade execute: Provider {exec?.providerSupport || 'unknown'}
          {exec?.providerSupport === 'maintenance' ? ' · Temporarily unavailable' : ''}
        </li>
        <li>Docs verified: 2026-07-19</li>
        <li>Spot credentials do not grant Futures permission</li>
        <li>Consumer eligibility: {consumer?.eligible ? t('mexc_eligible') : t('mexc_blocked')}</li>
      </ul>
      {consumer?.blockedReason && <p className="mt-2 text-xs text-amber-200">{consumer.blockedReason}</p>}
    </section>
  );
}
