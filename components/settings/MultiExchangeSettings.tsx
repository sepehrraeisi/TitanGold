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
import {
  ExchangeProviderListItem,
  toneForDisplayStatus,
} from './connections/ProviderListCard.tsx';
import type { OnNavigateHandler } from '../../types/navigation.ts';
import {
  isMexcManageDeepLink,
  navigateToConnectionSection,
} from '../../utils/settingsNavigation.ts';
import { buildMexcProviderSummary } from '../../utils/mexcProviderSummary.ts';

type Props = {
  initialSubtab?: string;
  initialProvider?: string;
  initialSection?: string;
  onNavigate?: OnNavigateHandler;
};

export default function MultiExchangeSettings({
  initialSubtab,
  initialProvider,
  initialSection,
  onNavigate,
}: Props) {
  const { t, language } = useLanguage();
  const dir = language === 'fa' ? 'rtl' : 'ltr';
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
        navigateToConnectionSection(onNavigate, 'mexc', initialSection || 'overview');
      } else {
        onNavigate({ view: 'settings', settingsTab: 'connections' });
      }
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/5 bg-slate-950/70 p-6 text-sm text-slate-400">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 shadow-lg">
      <div className="border-b border-white/10 p-4 md:p-6">
        <h3 className="text-sm font-semibold text-foreground md:text-base">{t('exchange_connections')}</h3>
        <p className="mt-1 text-xs text-slate-400">{t('exchange_connections_desc')}</p>
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

      <div className="space-y-3 p-4 md:p-6">
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
            <ExchangeProviderListItem
              key={exchange}
              exchange={exchange}
              isMexc={isMexc}
              expanded={expanded}
              statusText={statusText}
              statusTone={toneForDisplayStatus(displayStatus)}
              actionLabel={actionLabel}
              onAction={() => openMexcPanel(exchange)}
              awaitingAuthProjection={awaitingAuthProjection}
              projection={projection}
              language={language}
              t={t}
              dir={dir}
            >
              {expanded && (
                <MexcConnectionPanel
                  connection={connection}
                  onChanged={loadConnections}
                  onClose={() => setExpandedExchange(null)}
                  onNavigate={onNavigate}
                  initialSection={initialSection}
                />
              )}
            </ExchangeProviderListItem>
          );
        })}
      </div>
    </div>
  );
}
