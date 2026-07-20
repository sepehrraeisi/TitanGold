import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import {
  fetchExchangeConnections,
  detectLegacyInsecureCredentialKeys,
  removeLegacyInsecureCredentialKeys,
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
import { isMexcManageDeepLink } from '../../utils/settingsNavigation.ts';

const EXCHANGE_ICONS: Record<string, string> = {
  MEXC: '🟣',
  Binance: '🟡',
  Bybit: '🟠',
  KuCoin: '🟢',
  'Gate.io': '🔵',
};

type Props = {
  initialSubtab?: string;
  onNavigate?: OnNavigateHandler;
};

export default function MultiExchangeSettings({ initialSubtab, onNavigate: _onNavigate }: Props) {
  const { t } = useLanguage();
  const [connections, setConnections] = useState<SafeConnectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedExchange, setExpandedExchange] = useState<string | null>(() =>
    isMexcManageDeepLink(initialSubtab) ? 'MEXC' : null,
  );
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error' | 'info'; text: string }>>({});
  const [legacyKeys, setLegacyKeys] = useState<string[]>([]);
  const [removingLegacy, setRemovingLegacy] = useState(false);

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
    if (isMexcManageDeepLink(initialSubtab)) {
      setExpandedExchange('MEXC');
    }
  }, [initialSubtab]);

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
    setExpandedExchange((prev) => (prev === exchange ? null : exchange));
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
          const displayStatus = deriveConnectionDisplayStatus({
            provider: exchange,
            configured: connection.configured,
            secretReentryRequired: connection.secretReentryRequired,
            legacyBrowserKeyPresent: legacyKeys.length > 0,
            envCredentialsPresent: true,
            publicMarketReachable: true,
          });
          const statusText = t(connectionStatusMessageKey(displayStatus));
          const isMexc = isConfigurableProvider(exchange);
          const expanded = isMexc && expandedExchange === exchange;
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
                    {/* One status line only — hide duplicate when panel is open (panel shows detail) */}
                    {!expanded && (
                      <div className="text-xs text-gray-400" data-testid={`connection-status-${exchange}`}>
                        {statusText}
                      </div>
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
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
