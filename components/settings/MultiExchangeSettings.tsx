import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import {
  fetchExchangeConnections,
  fetchMexcCapabilitySummary,
  detectLegacyInsecureCredentialKeys,
  removeLegacyInsecureCredentialKeys,
  type MexcCapabilitySummary,
  type SafeConnectionDto,
} from '../../services/connectionsApi.ts';
import {
  deriveConnectionDisplayStatus,
  connectionStatusMessageKey,
  mexcPrimaryActionLabelKey,
  isConfigurableProvider,
} from '../../services/connectionDisplayStatus.ts';
import MexcConnectionPanel from './connections/MexcConnectionPanel.tsx';
import type { OnNavigateHandler } from '../../types/navigation.ts';
import {
  buildMexcManageNavigation,
  isMexcManageDeepLink,
} from '../../utils/settingsNavigation.ts';
import { buildMexcProviderSummary } from '../../utils/mexcProviderSummary.ts';

const EXCHANGE_ICONS: Record<string, string> = {
  MEXC: '🟣',
  Binance: '🟡',
  Bybit: '🟠',
  KuCoin: '🟢',
  'Gate.io': '🔵',
};

type Props = {
  initialSubtab?: string;
  initialProvider?: string;
  initialSection?: string;
  onNavigate?: OnNavigateHandler;
};

function formatCardDate(iso: string | null | undefined, language: string, t: (k: string) => string): string {
  if (!iso) return t('mexc_never');
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return t('mexc_never');
  return d.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function walletDataLabel(readiness: string, t: (k: string) => string): string {
  if (readiness === 'ready') return t('mexc_status_available') || 'Ready';
  if (readiness === 'limited') return t('mexc_limited') || 'Limited';
  if (readiness === 'blocked') return t('mexc_blocked') || 'Blocked';
  return t('mexc_unknown') || 'Unknown';
}

function publicMarketLabel(status: string, t: (k: string) => string): string {
  if (status === 'available') return t('mexc_available');
  if (status === 'unavailable') return t('mexc_status_unavailable');
  return t('mexc_unknown');
}

function privateAccessLabel(status: string, t: (k: string) => string): string {
  if (status === 'authenticated' || status === 'verified') {
    return t('mexc_authenticated') || 'Authenticated';
  }
  if (status === 'unverified' || status === 'pending') {
    return t('mexc_status_pending');
  }
  if (status === 'failed') return t('mexc_status_blocked');
  return t('connections_not_configured');
}

export default function MultiExchangeSettings({
  initialSubtab,
  initialProvider,
  initialSection,
  onNavigate,
}: Props) {
  const { t, language } = useLanguage();
  const [connections, setConnections] = useState<SafeConnectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedExchange, setExpandedExchange] = useState<string | null>(() =>
    (isMexcManageDeepLink(initialSubtab, initialProvider) ? 'MEXC' : null),
  );
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error' | 'info'; text: string }>>({});
  const [legacyKeys, setLegacyKeys] = useState<string[]>([]);
  const [removingLegacy, setRemovingLegacy] = useState(false);
  const [mexcSummary, setMexcSummary] = useState<MexcCapabilitySummary | null>(null);
  const [mexcSummaryLoading, setMexcSummaryLoading] = useState(false);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchExchangeConnections();
      setConnections(list);
    } catch (error: any) {
      const key = error?.message || 'connections_internal_error';
      setMessages((prev) => ({
        ...prev,
        _global: { type: 'error', text: t(key) },
      }));
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadConnections();
    setLegacyKeys(detectLegacyInsecureCredentialKeys());
  }, [loadConnections]);

  useEffect(() => {
    if (isMexcManageDeepLink(initialSubtab, initialProvider)) {
      setExpandedExchange('MEXC');
    }
  }, [initialSubtab, initialProvider]);

  useEffect(() => {
    const mexc = connections.find(
      (c) => isConfigurableProvider(c.provider || c.exchange),
    );
    if (!mexc) {
      setMexcSummary(null);
      return;
    }
    let cancelled = false;
    setMexcSummaryLoading(true);
    (async () => {
      try {
        const data = await fetchMexcCapabilitySummary();
        if (!cancelled) setMexcSummary(data);
      } catch {
        if (!cancelled) setMexcSummary(null);
      } finally {
        if (!cancelled) setMexcSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connections]);

  const handleRemoveLegacy = async () => {
    if (!window.confirm(t('connections_legacy_remove_confirm'))) return;
    setRemovingLegacy(true);
    try {
      await removeLegacyInsecureCredentialKeys();
      setLegacyKeys(detectLegacyInsecureCredentialKeys());
      setMessages((prev) => ({
        ...prev,
        _global: { type: 'info', text: t('connections_legacy_removed') },
      }));
    } finally {
      setRemovingLegacy(false);
    }
  };

  const openMexcPanel = (exchange: string) => {
    const next = expandedExchange === exchange ? null : exchange;
    setExpandedExchange(next);
    if (onNavigate) {
      if (next === 'MEXC') {
        onNavigate(buildMexcManageNavigation(initialSection || 'overview'));
      } else {
        onNavigate({ view: 'settings', settingsTab: 'connections' });
      }
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-800 bg-[#161B22] p-6 text-gray-400">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-[#161B22]">
      <div className="border-b border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white">{t('exchange_connections')}</h3>
        <p className="mt-1 text-sm text-gray-400">{t('exchange_connections_desc')}</p>
      </div>

      {legacyKeys.length > 0 && (
        <div
          className="mx-6 mt-4 rounded-md border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-100"
          role="status"
        >
          <p>{t('connections_legacy_warning')}</p>
          <button
            type="button"
            className="mt-2 rounded bg-amber-700 px-3 py-1.5 text-sm text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            disabled={removingLegacy}
            onClick={handleRemoveLegacy}
          >
            {t('connections_legacy_remove')}
          </button>
        </div>
      )}

      {messages._global && (
        <div className={`mx-6 mt-4 text-sm ${messages._global.type === 'error' ? 'text-red-400' : 'text-blue-300'}`}>
          {messages._global.text}
        </div>
      )}

      <div className="space-y-3 p-6">
        {connections.map((connection) => {
          const exchange = connection.provider || connection.exchange || '';
          const isMexc = isConfigurableProvider(exchange);
          const expanded = isMexc && expandedExchange === exchange;

          const projection = isMexc
            ? buildMexcProviderSummary({ connection, summary: mexcSummary })
            : null;

          const displayStatus = deriveConnectionDisplayStatus({
            provider: exchange,
            configured: connection.configured,
            secretReentryRequired: connection.secretReentryRequired,
            privateAuthVerified: connection.privateAuthVerified,
            overallStatusCode: mexcSummary?.overallTruthfulState?.code,
            status: connection.status,
            credentialStatus: connection.credentialStatus,
            legacyBrowserKeyPresent: legacyKeys.length > 0,
            envCredentialsPresent: true,
            publicMarketReachable: true,
          });

          // While loading summary for authenticated connection, never flash "Configured · Not verified"
          const awaitingAuthProjection =
            isMexc
            && connection.configured
            && (connection.privateAuthVerified === true || mexcSummaryLoading)
            && mexcSummaryLoading
            && !mexcSummary;

          const statusText = awaitingAuthProjection
            ? ''
            : t(
              projection
                ? projection.overallStatusLabelKey
                : connectionStatusMessageKey(displayStatus),
            );

          const actionLabel = expanded
            ? t('mexc_collapse_panel')
            : t(mexcPrimaryActionLabelKey(displayStatus));

          return (
            <div key={exchange} className="overflow-hidden rounded-lg border border-gray-800" data-mexc-expanded={expanded ? 'true' : 'false'}>
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true">{EXCHANGE_ICONS[exchange] || '⚪'}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-white" data-testid={`connection-heading-${exchange}`}>
                      {exchange}
                    </div>
                    {!expanded && isMexc && (
                      <div className="text-xs text-gray-400" data-testid={`connection-status-${exchange}`}>
                        {awaitingAuthProjection ? (
                          <span className="inline-block h-3 w-40 animate-pulse rounded bg-slate-700/60" aria-hidden="true" />
                        ) : (
                          statusText
                        )}
                      </div>
                    )}
                    {!expanded && isMexc && projection && !awaitingAuthProjection && (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400" data-testid="mexc-collapsed-summary">
                        <li>
                          {t('mexc_card_public_market')}: {publicMarketLabel(projection.publicMarketStatus, t)}
                        </li>
                        <li>
                          {t('mexc_card_private_access')}: {privateAccessLabel(projection.privateAuthenticationStatus, t)}
                        </li>
                        <li>
                          {t('mexc_card_verified_reads')}: {projection.verifiedPrivateReadCount}
                        </li>
                        <li>
                          {t('mexc_card_wallet_data')}: {walletDataLabel(projection.walletReadiness, t)}
                        </li>
                        <li>
                          {t('mexc_latest_successful_verification')}:{' '}
                          {formatCardDate(projection.lastSuccessfulVerificationAt, language, t)}
                        </li>
                      </ul>
                    )}
                  </div>
                </div>

                {isMexc ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-100 hover:bg-[#0D111C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                    aria-label={`${actionLabel} ${exchange}`}
                    aria-expanded={expanded}
                    data-testid={`connection-action-${exchange}`}
                    onClick={() => openMexcPanel(exchange)}
                  >
                    {actionLabel}
                  </button>
                ) : (
                  <span
                    className="shrink-0 rounded border border-gray-800 px-2 py-1 text-xs text-gray-500"
                    role="status"
                    aria-label={`${exchange}: ${statusText}`}
                    data-testid={`connection-unavailable-${exchange}`}
                  >
                    {statusText}
                  </span>
                )}
              </div>

              {expanded && (
                <MexcConnectionPanel
                  connection={connection}
                  onChanged={loadConnections}
                  onClose={() => setExpandedExchange(null)}
                  onNavigate={onNavigate}
                  initialSection={initialSection}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
