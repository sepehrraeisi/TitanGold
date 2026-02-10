import { TelegramCollectorState, DataSource } from '../../../../../types';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import ApiWrapper from '../../../../common/ApiWrapper';

interface TelegramPanelProps {
    t: (key: string) => string;
    telegramCollectorUrl: string | undefined;
    telegramCollectorState: TelegramCollectorState | undefined;
    telegramSources: DataSource[];
    handleCollectorHealth: () => void;
    isLoadingCollector: boolean;
    collectorMessage: string | null;
    setCollectorMessage: (msg: string | null) => void;
    collectorError: string | null;
    setCollectorError: (err: string | null) => void;
    handleStartCollectorLogin: () => void;
    handleConfirmCollectorLogin: () => void;
    handleCancelCollectorLogin: () => void;
    handleRefreshCollectorChannels: () => void;
    handleLinkChannelToSource: (channelId: string, sourceId?: string) => void;
    handleTestCollectorChannel: (channelId: string) => void;
    formatTimeAgo: (date: string | Date | undefined) => string;
    collectorForm: {
        apiId: string;
        apiHash: string;
        phoneNumber: string;
        code: string;
        password: string;
    };
    handleCollectorInputChange: (field: any, value: string) => void;
    collectorAuthId: string | null;
    testingChannelId: string | null;
    channelTestPreview: any;
    isRefreshingChannels: boolean;
    combinedCollectorHealth: any;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

const TelegramPanel: React.FC<TelegramPanelProps> = ({
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
    Card
}) => {
    const telegramChannels = telegramCollectorState?.channels || [];

    const collectorTrackedChannels = combinedCollectorHealth
        ? (combinedCollectorHealth as any).channelsTracked ?? (combinedCollectorHealth as any).trackedChannels ?? '-'
        : '-';
    const collectorChannelsWithErrors = combinedCollectorHealth
        ? (combinedCollectorHealth as any).channelsWithErrors ?? (combinedCollectorHealth as any).channelsInError ?? 0
        : 0;
    const collectorAvgLatencyRaw = combinedCollectorHealth
        ? (combinedCollectorHealth as any).avgLatencyMs ?? (combinedCollectorHealth as any).latency
        : undefined;
    const collectorAvgLatency = typeof collectorAvgLatencyRaw === 'number' ? collectorAvgLatencyRaw : undefined;
    const collectorUptimeRaw = combinedCollectorHealth
        ? (combinedCollectorHealth as any).uptime ?? (combinedCollectorHealth as any).uptimeMs
        : undefined;
    const collectorUptime = typeof collectorUptimeRaw === 'number' ? collectorUptimeRaw : undefined;

    return (
        <ApiWrapper
            error={collectorError}
            setError={setCollectorError}
            isLoading={isLoadingCollector}
        >
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('telegram_collector') || 'Telegram Collector'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('service_url') || 'Service URL'}: {telegramCollectorUrl || '/api/telegram-collector (proxied)'}
                        </p>
                    </div>
                    <button
                        onClick={handleCollectorHealth}
                        disabled={isLoadingCollector}
                        className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                    >
                        {isLoadingCollector ? (t('loading') || 'Loading...') : (t('refresh_health') || 'Refresh Health')}
                    </button>
                </div>
                {collectorMessage && (
                    <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-300 flex justify-between items-center animate-in fade-in duration-300">
                        <span>{collectorMessage}</span>
                        <button
                            onClick={() => setCollectorMessage(null)}
                            className="ml-2 text-green-300/50 hover:text-green-300"
                        >
                            ✕
                        </button>
                    </div>
                )}
                {combinedCollectorHealth ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 text-sm">
                        {/* ... (existing content) ... */}
                    </div>
                ) : isLoadingCollector ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-secondary/50 rounded p-3 space-y-2">
                                <SkeletonLoader width="40%" height="0.75rem" />
                                <SkeletonLoader width="60%" height="1.5rem" />
                            </div>
                        ))}
                    </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold text-sm text-foreground mb-3">{t('start_login_flow') || 'Start Login Flow'}</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t('telegram_api_id') || 'Telegram API ID'}</label>
                                <input
                                    type="number"
                                    value={collectorForm.apiId}
                                    onChange={e => handleCollectorInputChange('apiId', e.target.value)}
                                    placeholder={t('optional') || 'Optional'}
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t('telegram_api_hash') || 'Telegram API Hash'}</label>
                                <input
                                    value={collectorForm.apiHash}
                                    onChange={e => handleCollectorInputChange('apiHash', e.target.value)}
                                    placeholder={t('optional') || 'Optional'}
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t('phone_number') || 'Phone Number'}</label>
                                <input
                                    value={collectorForm.phoneNumber}
                                    onChange={e => handleCollectorInputChange('phoneNumber', e.target.value)}
                                    placeholder="+98912..."
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                                />
                            </div>
                            <button
                                onClick={handleStartCollectorLogin}
                                disabled={isLoadingCollector}
                                className="w-full text-xs px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                            >
                                {t('send_verification_code') || 'Send Verification Code'}
                            </button>
                            <p className="text-[11px] text-muted-foreground">
                                {t('telegram_login_hint') || 'Collector stores session securely on the server. API credentials are optional if already configured.'}
                            </p>
                        </div>
                    </div>
                    <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold text-sm text-foreground mb-3">{t('confirm_login_flow') || 'Confirm Code'}</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t('verification_code') || 'Verification Code'}</label>
                                <input
                                    value={collectorForm.code}
                                    onChange={e => handleCollectorInputChange('code', e.target.value)}
                                    placeholder="12345"
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                                    disabled={!collectorAuthId}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t('telegram_password_optional') || 'Telegram Password (2FA)'}</label>
                                <input
                                    type="password"
                                    value={collectorForm.password}
                                    onChange={e => handleCollectorInputChange('password', e.target.value)}
                                    placeholder={t('optional') || 'Optional'}
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                                    disabled={!collectorAuthId}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleConfirmCollectorLogin}
                                    disabled={isLoadingCollector || !collectorAuthId}
                                    className="flex-1 text-xs px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                                >
                                    {t('confirm_login') || 'Confirm Login'}
                                </button>
                                <button
                                    onClick={handleCancelCollectorLogin}
                                    disabled={isLoadingCollector || !collectorAuthId}
                                    className="text-xs px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                                >
                                    {t('cancel') || 'Cancel'}
                                </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                {collectorAuthId
                                    ? t('code_sent_status') || 'Code sent. Complete login before it expires.'
                                    : t('no_active_login') || 'No active login request.'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="mt-6 border border-border rounded-lg p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <div>
                            <h4 className="font-semibold text-sm text-foreground">{t('collector_channels_overview') || 'Tracked Telegram Channels'}</h4>
                            <p className="text-xs text-muted-foreground">
                                {telegramCollectorState?.lastRefreshAt
                                    ? `${t('collector_last_refresh') || 'Last refresh'}: ${formatTimeAgo(telegramCollectorState.lastRefreshAt)}`
                                    : t('collector_channels_hint') || 'Monitor channels synced through the collector.'}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleRefreshCollectorChannels}
                                disabled={isRefreshingChannels}
                                className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                            >
                                {isRefreshingChannels ? (t('loading') || 'Loading...') : (t('refresh_channels') || 'Refresh Channels')}
                            </button>
                        </div>
                    </div>
                    {telegramChannels.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('collector_channels_empty') || 'No Telegram channels have been registered yet.'}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                                <thead>
                                    <tr className="text-left text-muted-foreground border-b border-border">
                                        <th className="py-2 pr-4">{t('collector_channel_label') || 'Channel'}</th>
                                        <th className="py-2 pr-4">{t('collector_channel_status') || 'Status'}</th>
                                        <th className="py-2 pr-4">{t('collector_last_sync') || 'Last Sync'}</th>
                                        <th className="py-2 pr-4">{t('collector_messages_24h') || 'Messages (24h)'}</th>
                                        <th className="py-2 pr-4">{t('collector_avg_latency') || 'Latency'}</th>
                                        <th className="py-2 pr-4">{t('collector_last_test') || 'Last Test'}</th>
                                        <th className="py-2 pr-4">{t('collector_source') || 'Source'}</th>
                                        <th className="py-2">{t('collector_actions') || 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {telegramChannels.map(channel => (
                                        <tr key={channel.id} className="border-b border-border last:border-b-0">
                                            <td className="py-3 pr-4">
                                                <p className="font-semibold text-foreground">{channel.title}</p>
                                                <p className="text-muted-foreground">@{channel.handle.replace(/^@/, '')}</p>
                                                {channel.lastError && (
                                                    <p className="text-[11px] text-red-400 mt-1">
                                                        {t('collector_last_error') || 'Last error'}: {channel.lastError}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${channel.status === 'error' ? 'bg-red-500/20 text-red-300' :
                                                    channel.status === 'syncing' ? 'bg-yellow-500/20 text-yellow-300' :
                                                        channel.status === 'paused' ? 'bg-slate-500/20 text-slate-300' :
                                                            'bg-green-500/20 text-green-300'
                                                    }`}>
                                                    {t(`collector_status_${channel.status}`) || channel.status}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <p className="text-foreground">{channel.lastSyncAt ? formatTimeAgo(channel.lastSyncAt) : t('never') || 'Never'}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {channel.lastMessageAt ? `${t('collector_last_message') || 'Last message'}: ${formatTimeAgo(channel.lastMessageAt)}` : ''}
                                                </p>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <p className="text-foreground">{channel.messageCount24h ?? '-'}</p>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <p className="text-foreground">{channel.fetchLatencyMs ? `${channel.fetchLatencyMs} ms` : '-'}</p>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <div className="flex flex-col gap-1">
                                                    <span>{channel.lastTestAt ? formatTimeAgo(channel.lastTestAt) : (t('never') || 'Never')}</span>
                                                    {channel.lastTestStatus && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${channel.lastTestStatus === 'success'
                                                            ? 'bg-green-500/20 text-green-300'
                                                            : 'bg-red-500/20 text-red-300'
                                                            }`}>
                                                            {channel.lastTestStatus === 'success'
                                                                ? (t('collector_test_status_success') || 'Success')
                                                                : (t('collector_test_status_failed') || 'Failed')}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={`px-2 py-1 rounded text-[11px] font-semibold ${channel.usingCollector ? 'bg-purple-500/20 text-purple-300' : 'bg-orange-500/20 text-orange-300'
                                                    }`}>
                                                    {channel.usingCollector
                                                        ? (t('collector_source_collector') || 'Collector')
                                                        : (t('collector_source_fallback') || 'Fallback')}
                                                </span>
                                                {channel.sourceId && (
                                                    <p className="text-[11px] text-muted-foreground mt-1">
                                                        {t('collector_linked_source') || 'Linked data source'}: {channel.sourceId}
                                                    </p>
                                                )}
                                                <div className="mt-2">
                                                    <label className="text-[10px] text-muted-foreground block mb-1">
                                                        {t('collector_link_source') || 'Link to data source'}
                                                    </label>
                                                    {telegramSources.length > 0 ? (
                                                        <select
                                                            value={channel.sourceId || ''}
                                                            onChange={e => handleLinkChannelToSource(channel.id, e.target.value || undefined)}
                                                            className="w-full px-2 py-1 bg-background border border-border rounded text-[11px]"
                                                        >
                                                            <option value="">
                                                                {t('collector_link_source_none') || 'No link'}
                                                            </option>
                                                            {telegramSources.map(source => (
                                                                <option key={source.id} value={source.id}>
                                                                    {source.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {t('collector_link_source_no_options') || 'Create a Telegram data source first.'}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        onClick={() => handleTestCollectorChannel(channel.id)}
                                                        disabled={testingChannelId === channel.id || !telegramCollectorUrl}
                                                        className="text-[11px] px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                                                    >
                                                        {testingChannelId === channel.id
                                                            ? (t('testing') || 'Testing...')
                                                            : (t('collector_test_fetch') || 'Test Fetch')}
                                                    </button>
                                                    <a
                                                        href={`https://t.me/${channel.handle.replace(/^@/, '')}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[11px] px-3 py-1 text-center border border-border rounded hover:bg-secondary/40 transition"
                                                    >
                                                        {t('collector_open_channel') || 'Open channel'}
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {channelTestPreview && (
                        <div className={`mt-4 p-3 rounded border text-xs ${channelTestPreview.success ? 'border-green-500/30 bg-green-500/5 text-green-200' : 'border-red-500/30 bg-red-500/5 text-red-200'
                            }`}>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                <p className="font-semibold">@{channelTestPreview.channelHandle.replace(/^@/, '')}</p>
                                <div className="flex gap-3 text-[11px]">
                                    <span>{t('collector_fetched_at') || 'Fetched'}: {new Date(channelTestPreview.fetchedAt).toLocaleTimeString()}</span>
                                    {channelTestPreview.latency && <span>{t('collector_latency') || 'Latency'}: {channelTestPreview.latency} ms</span>}
                                </div>
                            </div>
                            {channelTestPreview.success && channelTestPreview.messages && channelTestPreview.messages.length > 0 ? (
                                <div className="mt-2 space-y-2">
                                    {channelTestPreview.messages.slice(0, 3).map((msg, idx) => (
                                        <div key={`${msg.timestamp}-${idx}`} className="p-2 bg-background/40 rounded text-foreground">
                                            <p className="text-[11px] text-muted-foreground mb-1">{new Date(msg.timestamp).toLocaleString()}</p>
                                            <p className="leading-relaxed">{msg.text?.slice(0, 220) || '-'}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-2 text-[11px]">
                                    {channelTestPreview.error}
                                </p>
                            )
                            }
                        </div>
                    )}
                </div>
            </Card>
        </ApiWrapper>
    );
};

export default TelegramPanel;
