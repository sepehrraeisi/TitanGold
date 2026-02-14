import React, { useEffect, useMemo, useState } from 'react';
import type { DataSource, TelegramCollectorState } from '../../../../../types.ts';

type Props = {
    t: (key: string) => string;
    telegramCollectorUrl: string;
    telegramCollectorState: TelegramCollectorState | null;
    telegramSources: DataSource[];
    handleCollectorHealth: () => Promise<void> | void;
    isLoadingCollector: boolean;
    collectorMessage: string | null;
    collectorError: string | null;
    handleStartCollectorLogin: () => Promise<void> | void;
    handleConfirmCollectorLogin: () => Promise<void> | void;
    handleCancelCollectorLogin: () => Promise<void> | void;
    handleRefreshCollectorChannels: () => Promise<void> | void;
    handleLinkChannelToSource: (channelId: string, sourceId?: string, channelInfo?: { id: string; title?: string | null; username?: string | null }) => Promise<void> | void;
    handleTestCollectorChannel: (channelId: string) => Promise<void> | void;
    formatTimeAgo: (timestamp?: string) => string;
    collectorForm: {
        apiId: string;
        apiHash: string;
        phoneNumber: string;
        code: string;
        password: string;
    };
    handleCollectorInputChange: (field: keyof Props['collectorForm'], value: string) => void;
    collectorAuthId: string | null;
    testingChannelId: string | null;
    channelTestPreview: any[] | null;
    isRefreshingChannels: boolean;
    combinedCollectorHealth: any;
    setCollectorError: (msg: string | null) => void;
    setCollectorMessage: (msg: string | null) => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
    collectorCooldownSeconds: number;
    handleDiagnoseCollector: () => Promise<void> | void;
    showLoginWizard: boolean;
    setShowLoginWizard: (open: boolean) => void;
    accountsRefreshTrigger?: number;
    channelsRefreshTrigger?: number;
};

type TelegramAccountStatus = 'active' | 'disabled' | 'flooded' | 'error' | 'pending_login';

type TelegramAccount = {
    id: string;
    phone: string;
    label?: string | null;
    status: TelegramAccountStatus;
    last_login_at?: string | null;
    last_used_at?: string | null;
    last_flood_until?: string | null;
    is_primary: boolean;
};

type CollectorChannel = {
    id: string;
    channelId: string;
    username?: string | null;
    title?: string | null;
    description?: string | null;
    category?: string | null;
    isActive: boolean;
    accountId?: string | null;
    lastSyncedAt?: string | null;
    config?: any;
};

const resolveTelegramCollectorBaseUrl = (): string => {
    const viteEnv = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || undefined;
    const fromImportMeta = viteEnv?.VITE_TELEGRAM_COLLECTOR_URL as string | undefined;
    const fromNode =
        typeof process !== 'undefined' ? ((process as any)?.env?.VITE_TELEGRAM_COLLECTOR_URL as string | undefined) : undefined;
    const value = fromImportMeta || fromNode;
    if (!value) return '';
    // Only accept full URLs (for local dev); otherwise use relative path so Nginx proxy works
    if (/^https?:\/\//i.test(value)) {
        return value.replace(/\/$/, '');
    }
    return '';
};

const buildCollectorUrl = (path: string) => {
    const base = resolveTelegramCollectorBaseUrl();
    if (!base) return path;
    return `${base}${path}`;
};

const TelegramPanel: React.FC<Props> = (props) => {
    const {
    t,
    telegramCollectorUrl,
    telegramCollectorState,
    telegramSources,
    handleCollectorHealth,
    isLoadingCollector,
    collectorMessage,
    collectorError,
    handleStartCollectorLogin,
    handleConfirmCollectorLogin,
    handleCancelCollectorLogin,
    handleRefreshCollectorChannels,
    handleLinkChannelToSource,
    handleTestCollectorChannel,
    formatTimeAgo,
    collectorForm,
    handleCollectorInputChange,
    collectorAuthId,
    testingChannelId,
    channelTestPreview,
    isRefreshingChannels,
    combinedCollectorHealth,
    setCollectorError,
    setCollectorMessage,
        Card,
        collectorCooldownSeconds,
        handleDiagnoseCollector,
        showLoginWizard,
        setShowLoginWizard,
        accountsRefreshTrigger = 0,
        channelsRefreshTrigger = 0,
    } = props;

    const [accounts, setAccounts] = useState<TelegramAccount[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [accountsError, setAccountsError] = useState<string | null>(null);

    const [collectorChannels, setCollectorChannels] = useState<CollectorChannel[]>([]);
    const [isLoadingCollectorChannels, setIsLoadingCollectorChannels] = useState(false);
    const [channelsError, setChannelsError] = useState<string | null>(null);

    const [accountFilter, setAccountFilter] = useState<'all' | 'unassigned' | string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
    const [channelSearch, setChannelSearch] = useState('');
    const [isSyncingDataSources, setIsSyncingDataSources] = useState(false);
    const [viewingMessagesChannelId, setViewingMessagesChannelId] = useState<string | null>(null);
    const [channelMessages, setChannelMessages] = useState<any[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [accountMetrics, setAccountMetrics] = useState<Record<string, { channels: number; messages24h: number; lastFloodWait?: string }>>({});

    const [showImportModal, setShowImportModal] = useState(false);
    const [telegramDialogs, setTelegramDialogs] = useState<{ id: number; title: string; username?: string }[]>([]);
    const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
    const [isLoadingDialogs, setIsLoadingDialogs] = useState(false);
    const [isRegisteringChannels, setIsRegisteringChannels] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    // ------------------------------------------------------------------------
    // Data loading helpers
    // ------------------------------------------------------------------------

    const loadAccounts = async () => {
        setIsLoadingAccounts(true);
        setAccountsError(null);
        try {
            const response = await fetch(buildCollectorUrl('/api/telegram-collector/accounts'));
            if (!response.ok) {
                throw new Error(`Failed to load accounts (${response.status})`);
            }
            const data = await response.json();
            setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
        } catch (error: any) {
            console.error('Failed to load telegram accounts:', error);
            setAccountsError(error?.message || 'Failed to load accounts');
        } finally {
            setIsLoadingAccounts(false);
        }
    };

    const loadCollectorChannels = async () => {
        setIsLoadingCollectorChannels(true);
        setChannelsError(null);
        try {
            const url = new URL(buildCollectorUrl('/api/telegram-collector/collector-channels'), window.location.origin);
            if (accountFilter !== 'all') {
                url.searchParams.set('account_id', accountFilter);
            }
            if (statusFilter !== 'all') {
                url.searchParams.set('status', statusFilter);
            }
            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`Failed to load channels (${response.status})`);
            }
            const data = await response.json();
            setCollectorChannels(Array.isArray(data.channels) ? data.channels : []);
        } catch (error: any) {
            console.error('Failed to load collector channels:', error);
            setChannelsError(error?.message || 'Failed to load channels');
        } finally {
            setIsLoadingCollectorChannels(false);
        }
    };

    const handleSyncTelegramDataSources = async () => {
        setIsSyncingDataSources(true);
        setCollectorError(null);
        setCollectorMessage(null);
        try {
            const response = await fetch('/api/v1/data-sources/telegram-sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            const data = await response.json();

            if (!response.ok || data?.success === false) {
                throw new Error(
                    data?.error ||
                        `${t('telegram_sync_failed') || 'Telegram sync failed'} (${response.status})`,
                );
            }

            setCollectorMessage(
                `${t('telegram_sync_completed') || 'Telegram channels synced with Data Sources.'} ` +
                    `(${t('created') || 'created'}: ${data.created ?? 0}, ` +
                    `${t('updated') || 'updated'}: ${data.updated ?? 0})`,
            );
        } catch (error: any) {
            console.error('Failed to sync telegram data sources:', error);
            setCollectorError(
                error?.message ||
                    t('telegram_sync_failed') ||
                    'Failed to sync Telegram channels with Data Sources.',
            );
        } finally {
            setIsSyncingDataSources(false);
        }
    };

    // Load messages for a channel (TASK-DHT-070)
    const loadChannelMessages = async (channelId: string) => {
        setIsLoadingMessages(true);
        setChannelMessages([]);
        try {
            const response = await fetch(buildCollectorUrl(`/api/telegram-collector/channels/${channelId}/messages?limit=50`), {
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error(`Failed to load messages (${response.status})`);
            }
            const data = await response.json();
            setChannelMessages(Array.isArray(data.messages) ? data.messages : []);
            setViewingMessagesChannelId(channelId);
        } catch (error: any) {
            console.error('Failed to load channel messages:', error);
            setCollectorError(error?.message || 'Failed to load messages');
        } finally {
            setIsLoadingMessages(false);
        }
    };

    // Import from Telegram: load dialogs and register selected (TASK 1)
    const openImportModal = () => {
        setShowImportModal(true);
        setImportError(null);
        setTelegramDialogs([]);
        setSelectedForImport(new Set());
    };

    const loadTelegramDialogs = async () => {
        setIsLoadingDialogs(true);
        setImportError(null);
        try {
            const response = await fetch(buildCollectorUrl('/api/telegram-collector/channels'), { credentials: 'include' });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData?.message || errData?.error || `Failed to load channels (${response.status})`);
            }
            const data = await response.json();
            const list = Array.isArray(data.channels) ? data.channels : [];
            setTelegramDialogs(list);
            setSelectedForImport(new Set());
        } catch (error: any) {
            console.error('Failed to load telegram dialogs:', error);
            setImportError(error?.message || 'Failed to load channels from Telegram');
        } finally {
            setIsLoadingDialogs(false);
        }
    };

    const toggleImportSelection = (id: string) => {
        setSelectedForImport((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const registerSelectedChannels = async () => {
        if (selectedForImport.size === 0) return;
        setIsRegisteringChannels(true);
        setImportError(null);
        try {
            const base = buildCollectorUrl('/api/telegram-collector/channels/register');
            for (const id of selectedForImport) {
                const ch = telegramDialogs.find((d) => String(d.id) === id);
                if (!ch) continue;
                const res = await fetch(base, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        channel_id: String(ch.id),
                        username: ch.username ?? undefined,
                        title: ch.title || `Channel ${ch.id}`,
                    }),
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData?.message || errData?.error || `Register failed (${res.status})`);
                }
            }
            await loadCollectorChannels();
            setShowImportModal(false);
            setSelectedForImport(new Set());
            setTelegramDialogs([]);
        } catch (error: any) {
            console.error('Failed to register channels:', error);
            setImportError(error?.message || 'Failed to register selected channels');
        } finally {
            setIsRegisteringChannels(false);
        }
    };

    // Calculate per-account metrics (TASK-DHT-071)
    useEffect(() => {
        if (accounts.length === 0 || collectorChannels.length === 0) {
            setAccountMetrics({});
            return;
        }

        const metrics: Record<string, { channels: number; messages24h: number; lastFloodWait?: string }> = {};
        const now = Date.now();
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

        accounts.forEach(account => {
            const accountChannels = collectorChannels.filter(ch => ch.accountId === account.id);
            metrics[account.id] = {
                channels: accountChannels.length,
                messages24h: 0, // Will be calculated from backend if available
                lastFloodWait: account.last_flood_until || undefined,
            };
        });

        setAccountMetrics(metrics);
    }, [accounts, collectorChannels]);

    useEffect(() => {
        loadAccounts().catch(() => undefined);
        loadCollectorChannels().catch(() => undefined);
    }, []);

    useEffect(() => {
        if (accountsRefreshTrigger > 0) {
            loadAccounts().catch(() => undefined);
        }
    }, [accountsRefreshTrigger]);

    useEffect(() => {
        if (channelsRefreshTrigger > 0) {
            loadCollectorChannels().catch(() => undefined);
        }
    }, [channelsRefreshTrigger]);

    // Reload channels when account/status filters change
    useEffect(() => {
        loadCollectorChannels().catch(() => undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountFilter, statusFilter]);

    const primaryAccount = useMemo(
        () => accounts.find((a) => a.is_primary) || null,
        [accounts],
    );

    const filteredChannels = useMemo(() => {
        return collectorChannels.filter((ch) => {
            const matchesSearch =
                !channelSearch ||
                ch.title?.toLowerCase().includes(channelSearch.toLowerCase()) ||
                ch.username?.toLowerCase().includes(channelSearch.toLowerCase()) ||
                ch.channelId.toLowerCase().includes(channelSearch.toLowerCase());
            return matchesSearch;
        });
    }, [collectorChannels, channelSearch]);

    // ------------------------------------------------------------------------
    // Account actions
    // ------------------------------------------------------------------------

    const updateAccount = async (id: string, updates: Partial<Pick<TelegramAccount, 'label' | 'status' | 'is_primary'>>) => {
        try {
            const response = await fetch(buildCollectorUrl(`/api/telegram-collector/accounts/${id}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            const data = await response.json();
            if (!response.ok || data?.success === false) {
                throw new Error(data?.error || `Failed to update account (${response.status})`);
            }
            setAccounts((prev) => prev.map((a) => (a.id === id ? data.account : a)));
        } catch (error: any) {
            console.error('Failed to update account:', error);
            setAccountsError(error?.message || 'Failed to update account');
        }
    };

    const handleLogoutAccount = async (id: string) => {
        try {
            const response = await fetch(buildCollectorUrl(`/api/telegram-collector/accounts/${id}/logout`), {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok || data?.success === false) {
                throw new Error(data?.error || `Failed to logout account (${response.status})`);
            }
            setAccounts((prev) => prev.map((a) => (a.id === id ? data.account : a)));
        } catch (error: any) {
            console.error('Failed to logout account:', error);
            setAccountsError(error?.message || 'Failed to logout account');
        }
    };

    const formatStatus = (status: TelegramAccountStatus) => {
        switch (status) {
            case 'active':
                return t('telegram_account_status_active') || 'Active';
            case 'disabled':
                return t('telegram_account_status_disabled') || 'Disabled';
            case 'flooded':
                return t('telegram_account_status_flooded') || 'Flooded';
            case 'error':
                return t('telegram_account_status_error') || 'Error';
            case 'pending_login':
                return t('telegram_account_status_pending') || 'Pending Login';
            default:
                return status;
        }
    };

    const formatPhoneLabel = (account: TelegramAccount) => {
        if (account.label && account.label !== account.phone) {
            return `${account.label} (${account.phone})`;
        }
        return account.phone;
    };

    // ------------------------------------------------------------------------
    // Channel actions
    // ------------------------------------------------------------------------

    const toggleChannelActive = async (channel: CollectorChannel) => {
        try {
            const response = await fetch(
                buildCollectorUrl(`/api/telegram-collector/collector-channels/${channel.id}`),
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: !channel.isActive }),
                },
            );
            const data = await response.json();
            if (!response.ok || data?.success === false) {
                throw new Error(data?.error || `Failed to update channel (${response.status})`);
            }
            setCollectorChannels((prev) => prev.map((ch) => (ch.id === channel.id ? data.channel : ch)));
        } catch (error: any) {
            console.error('Failed to toggle channel:', error);
            setChannelsError(error?.message || 'Failed to update channel');
        }
    };

    const assignChannelToAccount = async (channel: CollectorChannel, accountId: string | null) => {
        try {
            const response = await fetch(
                buildCollectorUrl(`/api/telegram-collector/collector-channels/${channel.id}`),
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account_id: accountId }),
                },
            );
            const data = await response.json();
            if (!response.ok || data?.success === false) {
                throw new Error(data?.error || `Failed to update channel account (${response.status})`);
            }
            setCollectorChannels((prev) => prev.map((ch) => (ch.id === channel.id ? data.channel : ch)));
        } catch (error: any) {
            console.error('Failed to assign channel account:', error);
            setChannelsError(error?.message || 'Failed to assign account to channel');
        }
    };

    // ------------------------------------------------------------------------
    // Render helpers
    // ------------------------------------------------------------------------

    const renderStatusBadge = (status: TelegramAccountStatus) => {
        const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium';
        let color = 'bg-slate-700 text-slate-100';
        if (status === 'active') color = 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40';
        if (status === 'disabled') color = 'bg-slate-700 text-slate-300 border border-slate-600';
        if (status === 'flooded') color = 'bg-amber-500/10 text-amber-300 border border-amber-500/40';
        if (status === 'error') color = 'bg-red-500/10 text-red-300 border border-red-500/40';
        if (status === 'pending_login') color = 'bg-blue-500/10 text-blue-300 border border-blue-500/40';
        return <span className={`${base} ${color}`}>{formatStatus(status)}</span>;
    };

    const renderCollectorHealthSummary = () => {
        if (!telegramCollectorState) return null;
        const status = combinedCollectorHealth || telegramCollectorState.status || 'unknown';
        const channels = telegramCollectorState.channels || [];
        const errorChannels = channels.filter((ch: any) => ch.lastError).length;
        const avgLatency = telegramCollectorState.metrics?.avgLatencyMs;

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-emerald-300/80 mb-1">
                        {t('collector_status') || 'Collector Status'}
                    </p>
                    <p className="text-sm font-semibold text-emerald-100 capitalize">
                        {typeof status === 'string' ? status : JSON.stringify(status)}
                    </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-blue-300/80 mb-1">
                        {t('tracked_channels') || 'Tracked Channels'}
                    </p>
                    <p className="text-sm font-semibold text-blue-100">{channels.length}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-purple-300/80 mb-1">
                        {t('collector_avg_latency') || 'Avg Latency'}
                    </p>
                    <p className="text-sm font-semibold text-purple-100">
                        {avgLatency ? `${Math.round(avgLatency)} ms` : '-'}
                    </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-red-300/80 mb-1">
                        {t('collector_channels_with_errors') || 'Channels with errors'}
                    </p>
                    <p className="text-sm font-semibold text-red-100">{errorChannels}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h3 className="font-semibold text-foreground text-sm md:text-base">
                            {t('telegram_collector') || 'Telegram Collector'}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {t('service_url') || 'Service URL'}:{' '}
                            <span className="font-mono text-xs">
                                {telegramCollectorUrl || '/api/telegram-collector (proxied)'}
                            </span>
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end items-center">
                        {collectorCooldownSeconds > 0 && (
                            <span className="text-[10px] text-amber-300/90">
                                {t('telegram_retry_after_seconds') ||
                                    'Retry after'}{' '}
                                {collectorCooldownSeconds}s
                            </span>
                        )}
                        <button
                            onClick={() => setShowLoginWizard(true)}
                            disabled={collectorCooldownSeconds > 0}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('start_login_wizard') || 'Start Login Wizard'}
                        </button>
                        <button
                            onClick={handleCollectorHealth}
                            disabled={isLoadingCollector}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                        >
                            {isLoadingCollector
                                ? t('loading') || 'Loading...'
                                : t('refresh_health') || 'Refresh Health'}
                        </button>
                        <button
                            onClick={handleSyncTelegramDataSources}
                            disabled={isSyncingDataSources}
                            className="px-3 py-1.5 rounded-full text-xs font-medium border border-sky-400/70 text-sky-200 hover:bg-sky-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSyncingDataSources
                                ? t('telegram_syncing') || 'Syncing...'
                                : t('telegram_sync_data_sources') || 'Sync Data Sources'}
                        </button>
                        <button
                            onClick={handleDiagnoseCollector}
                            disabled={isLoadingCollector}
                            className="px-3 py-1.5 rounded-full text-xs font-medium border border-amber-400/60 text-amber-200 hover:bg-amber-500/10"
                        >
                            {t('diagnose_collector_endpoints') || 'Diagnose Endpoints'}
                        </button>
                    </div>
                </div>

                {collectorMessage && (
                    <div className="mt-3 p-2 rounded border border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-100">
                        {collectorMessage}
                    </div>
                )}
                {collectorError && (
                    <div className="mt-3 p-2 rounded border border-red-500/30 bg-red-500/10 text-[11px] text-red-100">
                        {collectorError}
                    </div>
                )}

                <div className="mt-4">{renderCollectorHealthSummary()}</div>
            </Card>

            {/* Per-Account Summary Cards (TASK-DHT-071) */}
            {accounts.length > 0 && (
                <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg">
                    <h4 className="text-sm font-semibold text-foreground mb-3">
                        {t('account_summary') || 'Account Summary'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {accounts.map(account => {
                            const metrics = accountMetrics[account.id] || { channels: 0, messages24h: 0 };
                            return (
                                <div
                                    key={account.id}
                                    className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-950/80 to-slate-900/80 p-3 backdrop-blur-sm"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold text-foreground">
                                                {formatPhoneLabel(account)}
                                            </p>
                                            {account.is_primary && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/40 mt-1 inline-block">
                                                    {t('primary') || 'Primary'}
                                                </span>
                                            )}
                                        </div>
                                        {renderStatusBadge(account.status)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div className="bg-slate-950/60 rounded-lg p-2 border border-white/5">
                                            <p className="text-[10px] text-muted-foreground mb-0.5">
                                                {t('channels') || 'Channels'}
                                            </p>
                                            <p className="text-sm font-semibold text-blue-200">
                                                {metrics.channels}
                                            </p>
                                        </div>
                                        <div className="bg-slate-950/60 rounded-lg p-2 border border-white/5">
                                            <p className="text-[10px] text-muted-foreground mb-0.5">
                                                {t('messages_24h') || '24h Messages'}
                                            </p>
                                            <p className="text-sm font-semibold text-emerald-200">
                                                {metrics.messages24h > 0 ? metrics.messages24h : '-'}
                                            </p>
                                        </div>
                                    </div>
                                    {metrics.lastFloodWait && (
                                        <div className="mt-2 pt-2 border-t border-slate-800/60">
                                            <p className="text-[10px] text-amber-300">
                                                ⚠️ {t('flood_wait_until') || 'Flood wait until'}:{' '}
                                                {new Date(metrics.lastFloodWait).toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Accounts & Channels layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Accounts column */}
                <Card className="lg:col-span-1 bg-slate-950/70 border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-foreground">
                            {t('telegram_accounts') || 'Telegram Accounts'}
                        </h4>
                        <button
                            onClick={() => {
                                setShowLoginWizard(true);
                            }}
                            className="text-[11px] px-2 py-1 rounded-full bg-purple-600/80 hover:bg-purple-500 text-white"
                        >
                            {t('add_account') || 'Add Account'}
                        </button>
                    </div>
                    {isLoadingAccounts ? (
                        <p className="text-xs text-muted-foreground">
                            {t('loading') || 'Loading...'}
                        </p>
                    ) : accountsError ? (
                        <p className="text-xs text-red-400">{accountsError}</p>
                    ) : accounts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            {t('no_telegram_accounts') || 'No Telegram accounts connected yet.'}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {accounts.map((account) => (
                                <div
                                    key={account.id}
                                    className="flex items-start justify-between gap-2 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-medium text-foreground">
                                                {formatPhoneLabel(account)}
                                            </p>
                                            {account.is_primary && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/40">
                                                    {t('primary') || 'Primary'}
                                                </span>
                                            )}
                            </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {renderStatusBadge(account.status)}
                                            {account.last_used_at && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    {t('last_used') || 'Last used'}:{' '}
                                                    {formatTimeAgo(account.last_used_at)}
                                                </span>
                                            )}
                                            {account.last_flood_until && (
                                                <span className="text-[10px] text-amber-300">
                                                    {t('flood_wait_until') || 'Flood wait until'}:{' '}
                                                    {new Date(account.last_flood_until).toLocaleString()}
                                                </span>
                                            )}
                            </div>
                            </div>
                                    <div className="flex flex-col gap-1 items-end">
                            <button
                                            onClick={() => updateAccount(account.id, { is_primary: true })}
                                            disabled={account.is_primary}
                                            className="text-[10px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-100 hover:border-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {t('set_primary') || 'Set Primary'}
                            </button>
                                <button
                                            onClick={() =>
                                                updateAccount(account.id, {
                                                    status: account.status === 'disabled' ? 'active' : 'disabled',
                                                })
                                            }
                                            className="text-[10px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-100 hover:border-amber-400"
                                        >
                                            {account.status === 'disabled'
                                                ? t('enable') || 'Enable'
                                                : t('disable') || 'Disable'}
                                </button>
                                <button
                                            onClick={() => handleLogoutAccount(account.id)}
                                            className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/70 text-red-200 hover:bg-red-500/10"
                                >
                                            {t('logout') || 'Logout'}
                                </button>
                            </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Channels + test preview column */}
                <Card className="lg:col-span-2 bg-slate-950/70 border border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-foreground">
                                {t('telegram_channels') || 'Telegram Channels'}
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                                {t('telegram_channels_hint') ||
                                    'Use the power toggle to enable/disable polling, and assign each channel to a specific account.'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={accountFilter}
                                onChange={(e) =>
                                    setAccountFilter(e.target.value as 'all' | 'unassigned' | string)
                                }
                                className="text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-foreground"
                            >
                                <option value="all">
                                    {t('all_accounts') || 'All accounts'}
                                </option>
                                <option value="unassigned">
                                    {t('unassigned') || 'Unassigned'}
                                </option>
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {formatPhoneLabel(acc)}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value as 'all' | 'enabled' | 'disabled')
                                }
                                className="text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-foreground"
                            >
                                <option value="all">
                                    {t('all_statuses') || 'All'}
                                </option>
                                <option value="enabled">
                                    {t('enabled') || 'Enabled'}
                                </option>
                                <option value="disabled">
                                    {t('disabled') || 'Disabled'}
                                </option>
                            </select>
                            <input
                                type="text"
                                value={channelSearch}
                                onChange={(e) => setChannelSearch(e.target.value)}
                                placeholder={t('search_channels') || 'Search channels...'}
                                className="text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-foreground w-full md:w-40"
                            />
                            <button
                                type="button"
                                onClick={() => { openImportModal(); loadTelegramDialogs(); }}
                                disabled={isLoadingDialogs}
                                className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded px-2 py-1 disabled:opacity-50"
                            >
                                {isLoadingDialogs ? (t('loading') || 'Loading...') : (t('import_from_telegram') || 'Import from Telegram')}
                            </button>
                        </div>
                    </div>

                    {isLoadingCollectorChannels ? (
                        <p className="text-xs text-muted-foreground">
                            {t('loading') || 'Loading...'}
                        </p>
                    ) : channelsError ? (
                        <p className="text-xs text-red-400">{channelsError}</p>
                    ) : filteredChannels.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            {t('no_collector_channels') || 'No channels registered in the collector yet.'}
                        </p>
                    ) : (
                        <div className="overflow-x-auto -mx-3 mt-2">
                            <table className="min-w-full text-xs text-foreground/90">
                                <thead>
                                    <tr className="border-b border-slate-800 text-[11px] text-muted-foreground">
                                        <th className="px-3 py-2 text-left">
                                            {t('channel') || 'Channel'}
                                        </th>
                                        <th className="px-3 py-2 text-left hidden md:table-cell">
                                            {t('account') || 'Account'}
                                        </th>
                                        <th className="px-3 py-2 text-left hidden md:table-cell">
                                            {t('last_synced') || 'Last synced'}
                                        </th>
                                        <th className="px-3 py-2 text-center">
                                            {t('enabled') || 'Enabled'}
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                            {t('actions') || 'Actions'}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredChannels.map((ch) => {
                                        const account =
                                            ch.accountId &&
                                            accounts.find((a) => a.id === ch.accountId);
                                        const hasUsableAccount = accounts.some(
                                            (a) => a.status === 'active',
                                        );
                                        return (
                                            <tr
                                                key={ch.id}
                                                className="border-b border-slate-900/60 last:border-0"
                                            >
                                                <td className="px-3 py-2 align-top">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-medium">
                                                            {ch.title || ch.username || ch.channelId}
                                                </span>
                                                        <span className="text-[11px] text-muted-foreground">
                                                            {ch.username
                                                                ? `@${ch.username}`
                                                                : ch.channelId}
                                                        </span>
                                                </div>
                                            </td>
                                                <td className="px-3 py-2 align-top hidden md:table-cell">
                                                        <select
                                                        value={ch.accountId || ''}
                                                        onChange={(e) =>
                                                            assignChannelToAccount(
                                                                ch,
                                                                e.target.value || null,
                                                            )
                                                        }
                                                        className="text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-foreground w-full"
                                                        >
                                                            <option value="">
                                                            {t('unassigned') || 'Unassigned'}
                                                        </option>
                                                        {accounts.map((acc) => (
                                                            <option key={acc.id} value={acc.id}>
                                                                {formatPhoneLabel(acc)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                </td>
                                                <td className="px-3 py-2 align-top hidden md:table-cell text-[11px] text-muted-foreground">
                                                    {ch.lastSyncedAt
                                                        ? formatTimeAgo(ch.lastSyncedAt)
                                                        : t('never') || 'never'}
                                            </td>
                                                <td className="px-3 py-2 align-top text-center">
                                                    <button
                                                        onClick={() => toggleChannelActive(ch)}
                                                        className={`inline-flex items-center justify-center w-8 h-4 rounded-full transition-colors ${
                                                            ch.isActive
                                                                ? 'bg-emerald-500/80'
                                                                : 'bg-slate-700'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`w-3 h-3 rounded-full bg-white shadow transform transition-transform ${
                                                                ch.isActive
                                                                    ? 'translate-x-2'
                                                                    : '-translate-x-2'
                                                            }`}
                                                        />
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2 align-top text-right">
                                                    <div className="flex flex-wrap gap-1 justify-end">
                                                        <button
                                                            onClick={() => loadChannelMessages(ch.channelId)}
                                                            disabled={!hasUsableAccount}
                                                            className="text-[10px] px-2 py-0.5 rounded-full border border-sky-500/60 text-sky-200 hover:bg-sky-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            {t('view_messages') || 'View Messages'}
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleTestCollectorChannel(
                                                                    ch.username ||
                                                                        ch.channelId,
                                                                )
                                                            }
                                                            disabled={!hasUsableAccount}
                                                            className="text-[10px] px-2 py-0.5 rounded-full border border-blue-500/60 text-blue-200 hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            {t('test_fetch') || 'Test Fetch'}
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleLinkChannelToSource(ch.channelId, undefined, {
                                                                    id: ch.channelId,
                                                                    title: ch.title ?? null,
                                                                    username: ch.username ?? null,
                                                                })
                                                            }
                                                            disabled={!hasUsableAccount}
                                                            className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            {t('link_to_source') || 'Link to Source'}
                                                        </button>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Test preview */}
                    {channelTestPreview && channelTestPreview.length > 0 && (
                        <div className="mt-4 border-t border-slate-800 pt-3">
                            <p className="text-[11px] font-semibold mb-2 text-foreground">
                                {t('test_fetch_preview') || 'Test fetch preview'}
                            </p>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {channelTestPreview.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className="text-[11px] text-muted-foreground bg-slate-900/70 border border-slate-800 rounded px-2 py-1"
                                    >
                                        {msg.text || JSON.stringify(msg)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* Channel Messages Modal (TASK-DHT-070) */}
            {viewingMessagesChannelId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => {
                        setViewingMessagesChannelId(null);
                        setChannelMessages([]);
                    }}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div
                        className="relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">
                                    {t('channel_messages') || 'Channel Messages'}
                                </h3>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {collectorChannels.find(ch => ch.channelId === viewingMessagesChannelId)?.title ||
                                        collectorChannels.find(ch => ch.channelId === viewingMessagesChannelId)?.username ||
                                        viewingMessagesChannelId}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setViewingMessagesChannelId(null);
                                    setChannelMessages([]);
                                }}
                                className="text-muted-foreground hover:text-foreground text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoadingMessages ? (
                                <p className="text-xs text-muted-foreground text-center py-8">
                                    {t('loading') || 'Loading messages...'}
                                </p>
                            ) : channelMessages.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-8">
                                    {t('no_messages_found') || 'No messages found for this channel.'}
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {channelMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-slate-900/60 border border-white/5 rounded-lg p-3 text-xs"
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                    {msg.message_id || idx + 1}
                                                </span>
                                                {msg.telegram_created_at && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(msg.telegram_created_at).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-foreground whitespace-pre-wrap break-words">
                                                {msg.message_text || msg.text || JSON.stringify(msg)}
                                            </p>
                                            {msg.has_media && msg.media_url && (
                                                <a
                                                    href={msg.media_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] text-sky-300 hover:text-sky-200 mt-1 inline-block"
                                                >
                                                    📎 {t('view_media') || 'View Media'}
                                                </a>
                                            )}
                                            {msg.sentiment_score !== null && (
                                                <div className="mt-1 text-[10px] text-muted-foreground">
                                                    {t('sentiment') || 'Sentiment'}: {msg.sentiment_score}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Import from Telegram Modal (Task 1) */}
            {showImportModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => !isRegisteringChannels && setShowImportModal(false)}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div
                        className="relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-sm font-semibold text-foreground">
                                {t('import_from_telegram') || 'Import from Telegram'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => !isRegisteringChannels && setShowImportModal(false)}
                                className="text-muted-foreground hover:text-foreground text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            {importError && (
                                <p className="text-xs text-red-400 mb-3">{importError}</p>
                            )}
                            {telegramDialogs.length === 0 && !isLoadingDialogs && (
                                <p className="text-xs text-muted-foreground mb-3">
                                    {t('import_dialogs_hint') || 'Click "Load channels" to fetch channels you are a member of from Telegram.'}
                                </p>
                            )}
                            {isLoadingDialogs ? (
                                <p className="text-xs text-muted-foreground text-center py-6">
                                    {t('loading') || 'Loading...'}
                                </p>
                            ) : telegramDialogs.length > 0 ? (
                                <div className="space-y-1 max-h-80 overflow-y-auto">
                                    {telegramDialogs.map((ch) => {
                                        const idStr = String(ch.id);
                                        const checked = selectedForImport.has(idStr);
                                        return (
                                            <label
                                                key={idStr}
                                                className="flex items-center gap-2 py-2 px-2 rounded hover:bg-white/5 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleImportSelection(idStr)}
                                                    className="rounded border-slate-600"
                                                />
                                                <span className="text-xs text-foreground truncate flex-1">
                                                    {ch.title || ch.username || idStr}
                                                </span>
                                                {ch.username && (
                                                    <span className="text-[11px] text-muted-foreground">@{ch.username}</span>
                                                )}
                                            </label>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 p-4 border-t border-white/10">
                            <button
                                type="button"
                                onClick={loadTelegramDialogs}
                                disabled={isLoadingDialogs}
                                className="text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5 disabled:opacity-50"
                            >
                                {isLoadingDialogs ? (t('loading') || 'Loading...') : (t('load_channels') || 'Load channels')}
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => !isRegisteringChannels && setShowImportModal(false)}
                                    className="text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5"
                                >
                                    {t('cancel') || 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={registerSelectedChannels}
                                    disabled={isRegisteringChannels || selectedForImport.size === 0}
                                    className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1.5 disabled:opacity-50"
                                >
                                    {isRegisteringChannels
                                        ? (t('loading') || 'Registering...')
                                        : (t('register_selected') || 'Register selected') + ` (${selectedForImport.size})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Login Wizard Modal (multi-account aware) */}
            {showLoginWizard && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowLoginWizard(false)}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-900/85 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 pt-4 pb-3 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-purple-300/80">
                                    {t('telegram_collector') || 'Telegram Collector'}
                                </p>
                                <h3 className="text-sm font-semibold text-foreground">
                                    {t('start_login_wizard') || 'Start Login Wizard'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowLoginWizard(false)}
                                className="text-slate-400 hover:text-slate-100 text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-5 py-4 space-y-4">
                            {/* Cooldown / FloodWait message */}
                            {collectorCooldownSeconds > 0 && (
                                <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
                                    {t('telegram_error_flood_wait') ||
                                        'Telegram has restricted login attempts for this account. Please wait and try again later.'}
                                    <br />
                                    <span className="font-mono">
                                        {t('telegram_retry_after_seconds') || 'Retry after'}{' '}
                                        {collectorCooldownSeconds}s
                                    </span>
                                </div>
                            )}

                            {/* Step 1: phone + API */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                        {t('telegram_api_id') || 'Telegram API ID'}
                                    </label>
                                    <input
                                        type="number"
                                        value={collectorForm.apiId}
                                        onChange={(e) =>
                                            handleCollectorInputChange('apiId', e.target.value)
                                        }
                                        placeholder={t('optional') || 'Optional'}
                                        className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                        {t('telegram_api_hash') || 'Telegram API Hash'}
                                    </label>
                                    <input
                                        value={collectorForm.apiHash}
                                        onChange={(e) =>
                                            handleCollectorInputChange('apiHash', e.target.value)
                                        }
                                        placeholder={t('optional') || 'Optional'}
                                        className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                        {t('phone_number') || 'Phone Number'}
                                    </label>
                                    <input
                                        value={collectorForm.phoneNumber}
                                        onChange={(e) =>
                                            handleCollectorInputChange('phoneNumber', e.target.value)
                                        }
                                        placeholder="+98912..."
                                        className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                                    />
                                </div>
                                <button
                                    onClick={() => handleStartCollectorLogin()}
                                    disabled={isLoadingCollector || collectorCooldownSeconds > 0}
                                    className="w-full text-xs px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
                                >
                                    {t('send_verification_code') || 'Send Verification Code'}
                                </button>
                                <p className="text-[11px] text-muted-foreground">
                                    {t('telegram_login_hint') ||
                                        'Collector stores the Telegram session securely on the server. API credentials are optional if already configured.'}
                                </p>
                            </div>

                            {/* Step 2: code + 2FA */}
                            <div className="mt-3 border-t border-white/5 pt-3 space-y-3">
                                <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                        {t('verification_code') || 'Verification Code'}
                                    </label>
                                    <input
                                        value={collectorForm.code}
                                        onChange={(e) =>
                                            handleCollectorInputChange('code', e.target.value)
                                        }
                                        placeholder="12345"
                                        className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                                        disabled={!collectorAuthId}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                        {t('telegram_password_optional') ||
                                            'Telegram Password (2FA)'}
                                    </label>
                                    <input
                                        type="password"
                                        value={collectorForm.password}
                                        onChange={(e) =>
                                            handleCollectorInputChange('password', e.target.value)
                                        }
                                        placeholder={t('optional') || 'Optional'}
                                        className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                                        disabled={!collectorAuthId}
                                    />
                                        </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleConfirmCollectorLogin()}
                                        disabled={isLoadingCollector || !collectorAuthId}
                                        className="flex-1 text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
                                    >
                                        {t('confirm_login') || 'Confirm Login'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleCancelCollectorLogin();
                                            setShowLoginWizard(false);
                                        }}
                                        disabled={isLoadingCollector || !collectorAuthId}
                                        className="text-xs px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
                                    >
                                        {t('cancel') || 'Cancel'}
                                    </button>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    {collectorAuthId
                                        ? t('code_sent_status') ||
                                          'Code sent. Complete login before it expires.'
                                        : t('no_active_login') ||
                                          'No active login request yet. Start by sending the code.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TelegramPanel;

