import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { fetchMexcCapabilitySummary, type MexcCapabilitySummary } from '../../services/connectionsApi.ts';

/** Spot Trading integration status — public prices continue; real orders gated. */
export default function MexcSpotCapabilityPanel() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<MexcCapabilitySummary | null>(null);

  useEffect(() => {
    fetchMexcCapabilitySummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  const caps = summary?.capabilityMatrix?.capabilities || [];
  const byId = Object.fromEntries(caps.map((c) => [c.capabilityId, c]));
  const consumer = summary?.consumers?.find((c) => c.consumerId === 'spot_trading');

  return (
    <section
      className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-4"
      data-testid="mexc-spot-capability-panel"
    >
      <h3 className="text-sm font-semibold text-white">{t('mexc_spot_gates')}</h3>
      <ul className="mt-3 space-y-1 text-xs text-slate-300">
        <li>Public price data: {byId.MARKET_DATA_SPOT_PUBLIC?.providerSupport === 'supported' ? 'available' : 'N/A'}</li>
        <li>Account read: {byId.SPOT_ACCOUNT_READ?.operationalState || 'disabled'}</li>
        <li>Order read: {byId.SPOT_ORDER_READ?.operationalState || 'disabled'}</li>
        <li>Trade history: {byId.SPOT_TRADE_HISTORY_READ?.operationalState || 'disabled'}</li>
        <li>Test order: blocked pending separate approval</li>
        <li>Real order / cancel: blocked (Tier-4)</li>
        <li>Consumer eligibility: {consumer?.eligible ? t('mexc_eligible') : t('mexc_blocked')}</li>
      </ul>
      {consumer?.blockedReason && <p className="mt-2 text-xs text-amber-200">{consumer.blockedReason}</p>}
    </section>
  );
}
