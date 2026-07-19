import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import {
  fetchExchangeConnections,
  saveMexcConnection,
  testMexcConnectionCanonical,
  deleteMexcConnection,
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

interface DraftSecrets {
  apiKey: string;
  apiSecret: string;
}

const EXCHANGE_ICONS: Record<string, string> = {
  MEXC: '🟣',
  Binance: '🟡',
  Bybit: '🟠',
  KuCoin: '🟢',
  'Gate.io': '🔵',
};

export default function MultiExchangeSettings() {
  const { t } = useLanguage();
  const [connections, setConnections] = useState<SafeConnectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedExchange, setExpandedExchange] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftSecrets>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingExchange, setTestingExchange] = useState<string | null>(null);
  const [savingExchange, setSavingExchange] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error' | 'info'; text: string }>>({});
  const [legacyKeys, setLegacyKeys] = useState<string[]>([]);
  const [removingLegacy, setRemovingLegacy] = useState(false);

  const clearDraft = useCallback((exchange: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[exchange];
      return next;
    });
    setShowSecrets((prev) => ({ ...prev, [exchange]: false }));
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchExchangeConnections();
      // Trust backend metadata only — never invent configured from local state
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
    return () => {
      setDrafts({});
    };
  }, []);

  const updateDraft = (exchange: string, field: keyof DraftSecrets, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [exchange]: {
        apiKey: prev[exchange]?.apiKey || '',
        apiSecret: prev[exchange]?.apiSecret || '',
        [field]: value,
      },
    }));
  };

  const handleSaveConnection = async (exchangeName: string) => {
    if (!isConfigurableProvider(exchangeName)) return;
    const draft = drafts[exchangeName];
    if (!draft?.apiKey?.trim() || !draft?.apiSecret?.trim()) {
      setMessages((prev) => ({
        ...prev,
        [exchangeName]: { type: 'error', text: t('connections_validation_failed') },
      }));
      return;
    }

    try {
      setSavingExchange(exchangeName);
      await saveMexcConnection({
        apiKey: draft.apiKey.trim(),
        apiSecret: draft.apiSecret.trim(),
        isTestnet: false,
      });
      clearDraft(exchangeName);
      setMessages((prev) => ({
        ...prev,
        [exchangeName]: { type: 'info', text: t('connections_saved_untested') },
      }));
      await loadConnections();
    } catch (error: any) {
      setMessages((prev) => ({
        ...prev,
        [exchangeName]: { type: 'error', text: t(error?.message || 'connections_internal_error') },
      }));
    } finally {
      setSavingExchange(null);
      clearDraft(exchangeName);
    }
  };

  const handleTestConnection = async (exchangeName: string) => {
    if (!isConfigurableProvider(exchangeName)) return;
    try {
      setTestingExchange(exchangeName);
      const result = await testMexcConnectionCanonical();
      setMessages((prev) => ({
        ...prev,
        [exchangeName]: { type: 'info', text: t(result.messageKey || 'connections_untested') },
      }));
      await loadConnections();
    } catch (error: any) {
      setMessages((prev) => ({
        ...prev,
        [exchangeName]: { type: 'error', text: t(error?.message || 'connections_internal_error') },
      }));
    } finally {
      setTestingExchange(null);
      clearDraft(exchangeName);
    }
  };

  const handleDeleteConnection = async (exchangeName: string) => {
    if (!isConfigurableProvider(exchangeName)) return;
    if (!window.confirm(t('delete_connection_confirm'))) return;
    try {
      await deleteMexcConnection();
      clearDraft(exchangeName);
      setMessages((prev) => ({
        ...prev,
        [exchangeName]: { type: 'info', text: t('connection_deleted') },
      }));
      setExpandedExchange(null);
      await loadConnections();
    } catch (error: any) {
      setMessages((prev) => ({
        ...prev,
        [exchangeName]: { type: 'error', text: t(error?.message || 'connections_internal_error') },
      }));
    }
  };

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
    setExpandedExchange((prev) => {
      if (prev && prev !== exchange) clearDraft(prev);
      if (prev === exchange) {
        clearDraft(exchange);
        return null;
      }
      return exchange;
    });
  };

  if (loading) {
    return (
      <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6 text-gray-400">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="bg-[#161B22] border border-gray-800 rounded-lg">
      <div className="p-6 border-b border-gray-800">
        <h3 className="text-lg font-semibold text-white">{t('exchange_connections')}</h3>
        <p className="text-sm text-gray-400 mt-1">{t('exchange_connections_desc')}</p>
      </div>

      {legacyKeys.length > 0 && (
        <div
          className="mx-6 mt-4 p-3 rounded-md border border-amber-700/60 bg-amber-950/40 text-amber-100 text-sm"
          role="status"
        >
          <p>{t('connections_legacy_warning')}</p>
          <button
            type="button"
            className="mt-2 px-3 py-1.5 rounded bg-amber-700 text-white text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
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

      <div className="p-6 space-y-3">
        {connections.map((connection) => {
          const exchange = connection.provider || connection.exchange || '';
          const displayStatus = deriveConnectionDisplayStatus({
            provider: exchange,
            configured: connection.configured,
            secretReentryRequired: connection.secretReentryRequired,
            legacyBrowserKeyPresent: legacyKeys.length > 0,
            envCredentialsPresent: true, // even if ENV exists, must not affect label
            publicMarketReachable: true,
          });
          const statusText = t(connectionStatusMessageKey(displayStatus));
          const isMexc = isConfigurableProvider(exchange);
          const expanded = isMexc && expandedExchange === exchange;
          const draft = drafts[exchange] || { apiKey: '', apiSecret: '' };
          const actionKey = mexcPrimaryActionLabelKey(displayStatus);
          const actionLabel = t(actionKey);

          return (
            <div key={exchange} className="border border-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span aria-hidden="true">{EXCHANGE_ICONS[exchange] || '⚪'}</span>
                  <div className="min-w-0">
                    <div className="text-white font-medium">{exchange}</div>
                    <div
                      className="text-xs text-gray-400"
                      data-testid={`connection-status-${exchange}`}
                    >
                      {statusText}
                    </div>
                  </div>
                </div>

                {isMexc ? (
                  <button
                    type="button"
                    className="shrink-0 px-3 py-1.5 text-sm rounded border border-gray-600 text-gray-100 hover:bg-[#0D111C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                    aria-label={`${actionLabel} ${exchange}`}
                    aria-expanded={expanded}
                    data-testid={`connection-action-${exchange}`}
                    onClick={() => openMexcPanel(exchange)}
                  >
                    {actionLabel}
                  </button>
                ) : (
                  <span
                    className="shrink-0 text-xs text-gray-500 px-2 py-1 rounded border border-gray-800"
                    role="status"
                    aria-label={`${exchange}: ${statusText}`}
                    data-testid={`connection-unavailable-${exchange}`}
                  >
                    {statusText}
                  </span>
                )}
              </div>

              {expanded && (
                <div className="p-4 border-t border-gray-800 space-y-3 bg-[#0D111C]">
                  {connection.maskedKeyIdentifier && (
                    <p className="text-xs text-gray-400">
                      {t('connections_masked_key')}: {connection.maskedKeyIdentifier}
                    </p>
                  )}

                  <div>
                    <label className="block text-sm text-gray-300 mb-1" htmlFor={`${exchange}-key`}>
                      {t('mexc_api_key')}
                    </label>
                    <input
                      id={`${exchange}-key`}
                      type="text"
                      autoComplete="off"
                      value={draft.apiKey}
                      onChange={(e) => updateDraft(exchange, 'apiKey', e.target.value)}
                      placeholder={
                        connection.configured ? t('connections_leave_blank_rotate') : t('enter_api_key')
                      }
                      className="w-full p-2 bg-[#161B22] border border-gray-700 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1" htmlFor={`${exchange}-secret`}>
                      {t('api_secret')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`${exchange}-secret`}
                        type={showSecrets[exchange] ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={draft.apiSecret}
                        onChange={(e) => updateDraft(exchange, 'apiSecret', e.target.value)}
                        placeholder={t('enter_api_secret')}
                        className="w-full p-2 bg-[#161B22] border border-gray-700 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                      />
                      <button
                        type="button"
                        className="px-2 text-xs text-gray-300 border border-gray-700 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                        onClick={() => setShowSecrets((p) => ({ ...p, [exchange]: !p[exchange] }))}
                      >
                        {showSecrets[exchange] ? t('hide') : t('show')}
                      </button>
                    </div>
                  </div>

                  {messages[exchange] && (
                    <p
                      className={`text-sm ${
                        messages[exchange].type === 'error'
                          ? 'text-red-400'
                          : messages[exchange].type === 'success'
                            ? 'text-green-400'
                            : 'text-blue-300'
                      }`}
                    >
                      {messages[exchange].text}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingExchange === exchange}
                      onClick={() => handleSaveConnection(exchange)}
                      className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
                    >
                      {t('save_changes')}
                    </button>
                    <button
                      type="button"
                      disabled={testingExchange === exchange || !connection.configured}
                      onClick={() => handleTestConnection(exchange)}
                      className="px-3 py-2 rounded border border-gray-600 text-gray-200 text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                    >
                      {t('test_connection')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearDraft(exchange);
                        setExpandedExchange(null);
                      }}
                      className="px-3 py-2 rounded border border-gray-700 text-gray-300 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                    >
                      {t('cancel')}
                    </button>
                    {connection.configured && (
                      <button
                        type="button"
                        onClick={() => handleDeleteConnection(exchange)}
                        className="px-3 py-2 rounded border border-red-800 text-red-300 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                      >
                        {t('delete')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
