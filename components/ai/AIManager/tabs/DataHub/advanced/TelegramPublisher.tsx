import React, { useEffect, useMemo, useState } from 'react';
import { AIAgent, DataSource, PublisherHistoryItem } from '../../../../../../types';
import { SummaryCard } from '../../../../../ui/summary-card';
import { EmptyState } from '../../../../../ui/empty-state';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import ApiWrapper from '../../../../../common/ApiWrapper';
import {
    useTelegramPublishersQuery,
    usePublisherHistoryQuery,
    useCreateTelegramPublisherMutation,
    useDisableTelegramPublisherMutation,
    useTestTelegramPublisherMutation,
    usePublishTelegramPublisherMutation,
} from '../../../../../../hooks/useTelegramPublishers';
import {
    mapHistoryToUiItem,
    TelegramPublisherRecord,
} from '../../../../../../services/telegramPublishersApi';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';

interface TelegramPublisherProps {
    t: (key: string) => string;
    agents: AIAgent[];
    agentMap: Record<string, AIAgent>;
    telegramSources: DataSource[];
}

const defaultTemplate = `📢 **Signal**
{message}

_Source: Titan DataHub_`;

const TelegramPublisher: React.FC<TelegramPublisherProps> = ({ t, telegramSources }) => {
    const [activeTab, setActiveTab] = useState<'channels' | 'history' | 'templates'>('channels');
    const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: '',
        channel_id: '',
        channel_username: '',
        channel_title: '',
        bot_token: '',
        language: 'en',
        template: defaultTemplate,
    });

    const {
        data: listData,
        isLoading,
        error: listError,
        refetch,
        isFetching,
    } = useTelegramPublishersQuery({ enabled: true });

    const publishers = listData?.publishers ?? [];
    const metrics = listData?.metrics ?? {
        totalChannels: 0,
        delivered24h: 0,
        failed24h: 0,
        successRate: 100,
    };

    useEffect(() => {
        if (publishers.length > 0 && !selectedPublisherId) {
            setSelectedPublisherId(publishers[0].id);
        }
    }, [publishers, selectedPublisherId]);

    const { data: historyData, isLoading: isLoadingHistory } = usePublisherHistoryQuery(
        selectedPublisherId,
        { enabled: activeTab === 'history' && Boolean(selectedPublisherId) },
    );

    const createMutation = useCreateTelegramPublisherMutation();
    const disableMutation = useDisableTelegramPublisherMutation();
    const testMutation = useTestTelegramPublisherMutation();
    const publishMutation = usePublishTelegramPublisherMutation();

    const historyItems: PublisherHistoryItem[] = useMemo(() => {
        return (historyData?.data ?? []).map(mapHistoryToUiItem);
    }, [historyData]);

    const apiError =
        listError instanceof DataHubApiError
            ? listError.message
            : listError instanceof Error
              ? listError.message
              : null;

    const selectedPublisher = publishers.find(p => p.id === selectedPublisherId);

    const handleCreate = async () => {
        setActionError(null);
        try {
            await createMutation.mutateAsync({
                name: form.name.trim(),
                channel_id: form.channel_id.trim(),
                channel_username: form.channel_username.trim() || undefined,
                channel_title: form.channel_title.trim() || undefined,
                bot_token: form.bot_token.trim() || undefined,
                template: form.template,
                language: form.language,
            });
            setShowCreateModal(false);
            setForm({
                name: '',
                channel_id: '',
                channel_username: '',
                channel_title: '',
                bot_token: '',
                language: 'en',
                template: defaultTemplate,
            });
            setActionMessage(t('publisher_created') || 'Publisher created');
            await refetch();
        } catch (e: unknown) {
            setActionError(e instanceof Error ? e.message : 'Create failed');
        }
    };

    const handleTest = async (pub: TelegramPublisherRecord) => {
        setActionError(null);
        try {
            const result = await testMutation.mutateAsync({
                id: pub.id,
                message: 'Test message from Titan DataHub',
            });
            const label = result.dry_run
                ? (t('publisher_test_dry_run') || 'Test recorded (dry-run — no Telegram API call)')
                : result.success
                  ? (t('publisher_test_ok') || 'Test message sent')
                  : (t('publisher_test_failed') || 'Test failed');
            setActionMessage(`${label}${result.error ? `: ${result.error}` : ''}`);
            setSelectedPublisherId(pub.id);
            await refetch();
        } catch (e: unknown) {
            setActionError(e instanceof Error ? e.message : 'Test failed');
        }
    };

    const handlePublish = async (pub: TelegramPublisherRecord) => {
        const message = window.prompt(
            t('publisher_publish_prompt') ||
                'Message to publish (live send requires confirmation in next step):',
            'Sample signal from DataHub',
        );
        if (!message?.trim()) return;

        const confirmed = window.confirm(
            t('publisher_publish_confirm') ||
                'Send this message to Telegram for real? Choose OK for LIVE send, Cancel to abort.',
        );
        if (!confirmed) return;

        setActionError(null);
        try {
            const result = await publishMutation.mutateAsync({
                id: pub.id,
                message: message.trim(),
                confirm_publish: true,
                content_type: 'manual',
            });
            const label = result.dry_run
                ? (t('publisher_publish_dry_run') ||
                      'Publish recorded as dry-run (dev mode or missing bot token)')
                : result.success
                  ? (t('publisher_publish_ok') || 'Published successfully')
                  : (t('publisher_publish_failed') || 'Publish failed');
            setActionMessage(`${label}${result.error ? `: ${result.error}` : ''}`);
            setSelectedPublisherId(pub.id);
            await refetch();
        } catch (e: unknown) {
            setActionError(e instanceof Error ? e.message : 'Publish failed');
        }
    };

    const handleDisable = async (pub: TelegramPublisherRecord) => {
        if (
            !window.confirm(
                t('publisher_disable_confirm') || 'Disable this publisher channel?',
            )
        ) {
            return;
        }
        try {
            await disableMutation.mutateAsync(pub.id);
            setActionMessage(t('publisher_disabled') || 'Publisher disabled');
            if (selectedPublisherId === pub.id) {
                setSelectedPublisherId(null);
            }
            await refetch();
        } catch (e: unknown) {
            setActionError(e instanceof Error ? e.message : 'Disable failed');
        }
    };

    return (
        <ApiWrapper
            error={apiError}
            setError={() => refetch()}
            isLoading={isLoading && publishers.length === 0}
        >
            <div className="bg-card border border-border rounded-lg p-4">
                {actionMessage && (
                    <div className="mb-3 text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded p-2">
                        {actionMessage}
                        <button
                            type="button"
                            className="ml-2 underline"
                            onClick={() => setActionMessage(null)}
                        >
                            {t('dismiss') || 'Dismiss'}
                        </button>
                    </div>
                )}
                {actionError && (
                    <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                        {actionError}
                    </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            📱 {t('telegram_publisher') || 'Telegram Publisher'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('telegram_publisher_desc') ||
                                'Broadcast analyzed signals to dedicated Telegram channels (backend API).'}
                        </p>
                    </div>
                    <ActionButton
                        variant="primary"
                        size="sm"
                        onClick={() => setShowCreateModal(true)}
                    >
                        + {t('new_publisher_channel') || 'New Channel'}
                    </ActionButton>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <SummaryCard
                        label={t('active_channels') || 'Channels'}
                        value={metrics.totalChannels}
                        icon={<span className="text-2xl">📡</span>}
                    />
                    <SummaryCard
                        label={t('delivered_24h') || 'Delivered'}
                        value={metrics.delivered24h}
                        variant="success"
                        icon={<span className="text-2xl">📤</span>}
                    />
                    <SummaryCard
                        label={t('failed_24h') || 'Failed'}
                        value={metrics.failed24h}
                        variant={metrics.failed24h > 0 ? 'error' : 'default'}
                        icon={<span className="text-2xl">❌</span>}
                    />
                    <SummaryCard
                        label={t('success_rate') || 'Success Rate'}
                        value={`${metrics.successRate}%`}
                        variant={metrics.successRate < 90 ? 'warning' : 'success'}
                        icon={<span className="text-2xl">📊</span>}
                    />
                </div>

                <div className="flex gap-4 border-b border-border mb-6">
                    {(['channels', 'history', 'templates'] as const).map(tab => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`pb-2 text-xs font-bold transition-all border-b-2 ${
                                activeTab === tab
                                    ? 'border-purple-500 text-purple-400'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {t(`publisher_tab_${tab}`) || tab.toUpperCase()}
                        </button>
                    ))}
                </div>

                {activeTab === 'channels' && (
                    <div className="space-y-4">
                        {telegramSources.length > 0 && (
                            <div className="bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-slate-900/80 border border-slate-800/60 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-foreground mb-3">
                                    {t('telegram_channel_mapping') || 'Input channels (from Sources API)'}
                                </h5>
                                <div className="space-y-2">
                                    {telegramSources.slice(0, 5).map(source => (
                                        <div
                                            key={source.id}
                                            className="flex items-center justify-between p-2 bg-slate-950/50 rounded border border-slate-800/40 text-[11px]"
                                        >
                                            <span className="truncate">📥 {source.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {publishers.filter(p => p.is_active).length > 0 ? (
                                publishers
                                    .filter(p => p.is_active)
                                    .map(pub => (
                                        <div
                                            key={pub.id}
                                            className={`border rounded-lg p-4 bg-secondary/5 ${
                                                selectedPublisherId === pub.id
                                                    ? 'border-purple-500'
                                                    : 'border-border'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h5 className="font-bold text-foreground">
                                                        {pub.name}
                                                    </h5>
                                                    <p className="text-[10px] text-muted-foreground font-mono">
                                                        {pub.channel_id}
                                                        {pub.channel_username
                                                            ? ` · @${pub.channel_username}`
                                                            : ''}
                                                    </p>
                                                </div>
                                                <StatusBadge
                                                    status={pub.is_active ? 'success' : 'neutral'}
                                                    label={pub.is_active ? 'Active' : 'Off'}
                                                    size="sm"
                                                />
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mb-3">
                                                {pub.has_bot_token
                                                    ? t('bot_token_configured') || 'Bot token stored'
                                                    : t('bot_token_missing_dry_run') ||
                                                      'No token — test/publish will dry-run'}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <ActionButton
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedPublisherId(pub.id)}
                                                >
                                                    {t('select') || 'Select'}
                                                </ActionButton>
                                                <ActionButton
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={testMutation.isPending}
                                                    onClick={() => handleTest(pub)}
                                                >
                                                    {t('test') || 'Test'}
                                                </ActionButton>
                                                <ActionButton
                                                    variant="primary"
                                                    size="sm"
                                                    disabled={publishMutation.isPending}
                                                    onClick={() => handlePublish(pub)}
                                                >
                                                    {t('publish') || 'Publish'}
                                                </ActionButton>
                                                <ActionButton
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={disableMutation.isPending}
                                                    onClick={() => handleDisable(pub)}
                                                >
                                                    {t('disable') || 'Disable'}
                                                </ActionButton>
                                            </div>
                                        </div>
                                    ))
                            ) : (
                                <div className="md:col-span-2">
                                    <EmptyState
                                        title={t('no_publishers') || 'No channels configured'}
                                        description={
                                            t('no_publishers_desc') ||
                                            'Create a publisher with channel ID and optional bot token.'
                                        }
                                        icon={<span className="text-4xl">🤖</span>}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-3">
                        {publishers.length > 0 && (
                            <select
                                value={selectedPublisherId || ''}
                                onChange={e => setSelectedPublisherId(e.target.value)}
                                className="mb-3 px-3 py-2 bg-background border border-border rounded text-xs"
                            >
                                {publishers.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        {isLoadingHistory ? (
                            <p className="text-xs text-muted-foreground text-center py-6">
                                {t('loading') || 'Loading...'}
                            </p>
                        ) : historyItems.length > 0 ? (
                            historyItems.slice(0, 20).map(item => (
                                <div
                                    key={item.id}
                                    className="border border-border rounded-lg p-3 flex justify-between items-center text-xs"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <StatusBadge
                                                status={item.status === 'sent' ? 'success' : 'error'}
                                                label={item.status}
                                                size="sm"
                                            />
                                            <span className="font-semibold truncate">
                                                {item.payloadPreview}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {publishers.find(p => p.id === item.publisherId)?.name ||
                                                item.publisherId}{' '}
                                            • {new Date(item.sentAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <EmptyState
                                title={t('history_empty') || 'History is empty'}
                                description={
                                    t('history_empty_desc') ||
                                    'Run Test or Publish to record delivery history.'
                                }
                                icon={<span className="text-3xl">🏜️</span>}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'templates' && (
                    <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            {selectedPublisher
                                ? `${t('template_for') || 'Template for'}: ${selectedPublisher.name}`
                                : t('select_publisher_for_template') ||
                                  'Select a channel to edit its template via Update API (coming in modal).'}
                        </p>
                        <code className="block bg-background p-3 rounded border border-border text-[10px] whitespace-pre">
                            {selectedPublisher?.template || defaultTemplate}
                        </code>
                    </div>
                )}

                {isFetching && (
                    <p className="text-[10px] text-muted-foreground mt-4 text-center">
                        {t('refreshing') || 'Refreshing...'}
                    </p>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <h4 className="font-semibold mb-4">
                            {t('create_publisher') || 'New Telegram Publisher'}
                        </h4>
                        <div className="space-y-3 text-sm">
                            <input
                                placeholder={t('name') || 'Name'}
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded"
                            />
                            <input
                                placeholder={t('channel_id') || 'Channel ID (@channel or -100…)'}
                                value={form.channel_id}
                                onChange={e =>
                                    setForm(f => ({ ...f, channel_id: e.target.value }))
                                }
                                className="w-full px-3 py-2 bg-background border border-border rounded"
                            />
                            <input
                                placeholder={t('bot_token') || 'Bot token (optional in dev)'}
                                type="password"
                                value={form.bot_token}
                                onChange={e =>
                                    setForm(f => ({ ...f, bot_token: e.target.value }))
                                }
                                className="w-full px-3 py-2 bg-background border border-border rounded"
                            />
                            <textarea
                                placeholder={t('template') || 'Message template'}
                                value={form.template}
                                onChange={e =>
                                    setForm(f => ({ ...f, template: e.target.value }))
                                }
                                rows={5}
                                className="w-full px-3 py-2 bg-background border border-border rounded text-xs font-mono"
                            />
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <ActionButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowCreateModal(false)}
                            >
                                {t('cancel') || 'Cancel'}
                            </ActionButton>
                            <ActionButton
                                variant="primary"
                                size="sm"
                                disabled={createMutation.isPending || !form.name || !form.channel_id}
                                onClick={handleCreate}
                            >
                                {t('create') || 'Create'}
                            </ActionButton>
                        </div>
                    </div>
                </div>
            )}
        </ApiWrapper>
    );
};

export default TelegramPublisher;
