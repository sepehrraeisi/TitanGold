import React, { useEffect, useMemo, useState } from 'react';
import { DataSource, PublisherHistoryItem } from '../../../../../../types';
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
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    INPUT_CLASS,
    SELECT_CLASS,
    BTN_PRIMARY,
    BTN_SECONDARY,
    BTN_OUTLINE_EMERALD,
    BTN_OUTLINE_PURPLE,
    BTN_OUTLINE_RED,
    BTN_OUTLINE_SLATE,
    DataHubAlert,
    DataHubEmpty,
    DataHubModal,
    MetricCard,
    StatusPill,
    DataHubSectionHeader,
    DataHubSubTabBar,
} from '../dataHubUi';

interface TelegramPublisherProps {
    t: (key: string) => string;
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

    const { data: listData, isLoading, error: listError, refetch, isFetching } =
        useTelegramPublishersQuery({ enabled: true });

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

    const historyItems: PublisherHistoryItem[] = useMemo(
        () => (historyData?.data ?? []).map(mapHistoryToUiItem),
        [historyData],
    );

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
            setActionMessage(t('publisher_created'));
            await refetch();
        } catch (e: unknown) {
            setActionError(e instanceof Error ? e.message : t('publisher_create_failed'));
        }
    };

    const handleTest = async (pub: TelegramPublisherRecord) => {
        setActionError(null);
        try {
            const result = await testMutation.mutateAsync({
                id: pub.id,
                message: t('publisher_test_message_default'),
            });
            const label = result.dry_run
                ? t('publisher_test_dry_run')
                : result.success
                  ? t('publisher_test_ok')
                  : t('publisher_test_failed');
            setActionMessage(`${label}${result.error ? `: ${result.error}` : ''}`);
            setSelectedPublisherId(pub.id);
            await refetch();
        } catch (e: unknown) {
            setActionError(e instanceof Error ? e.message : t('publisher_test_failed'));
        }
    };

    const handlePublish = async (pub: TelegramPublisherRecord) => {
        const message = window.prompt(t('publisher_publish_prompt'), t('publisher_publish_sample'));
        if (!message?.trim()) return;
        if (!window.confirm(t('publisher_publish_confirm'))) return;

        setActionError(null);
        try {
            const result = await publishMutation.mutateAsync({
                id: pub.id,
                message: message.trim(),
                confirm_publish: true,
                content_type: 'manual',
            });
            const label = result.dry_run
                ? t('publisher_publish_dry_run')
                : result.success
                  ? t('publisher_publish_ok')
                  : t('publisher_publish_failed');
            setActionMessage(`${label}${result.error ? `: ${result.error}` : ''}`);
            setSelectedPublisherId(pub.id);
            await refetch();
        } catch (e: unknown) {
            setActionError(e instanceof Error ? e.message : t('publisher_publish_failed'));
        }
    };

    const handleDisable = async (pub: TelegramPublisherRecord) => {
        if (!window.confirm(t('publisher_disable_confirm'))) return;
        try {
            await disableMutation.mutateAsync(pub.id);
            setActionMessage(t('publisher_disabled'));
            if (selectedPublisherId === pub.id) setSelectedPublisherId(null);
            await refetch();
        } catch (e: unknown) {
            setActionError(e instanceof Error ? e.message : t('publisher_disable_failed'));
        }
    };

    return (
        <div className={DATAHUB_SHELL}>
            {actionMessage && (
                <div className="mb-3 p-2 rounded border border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span>{actionMessage}</span>
                    <button type="button" className={BTN_OUTLINE_SLATE} onClick={() => setActionMessage(null)}>
                        {t('dismiss')}
                    </button>
                </div>
            )}
            {actionError && <DataHubAlert variant="error" message={actionError} />}

            <DataHubSectionHeader
                title={t('telegram_publisher')}
                subtitle={t('telegram_publisher_desc')}
                actions={
                    <button type="button" onClick={() => setShowCreateModal(true)} className={BTN_PRIMARY}>
                        {t('new_publisher_channel')}
                    </button>
                }
            />

            {apiError && (
                <DataHubAlert variant="error" message={apiError} onRetry={() => refetch()} retryLabel={t('retry')} />
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <MetricCard label={t('active_channels')} value={metrics.totalChannels} color="blue" />
                <MetricCard label={t('delivered_24h')} value={metrics.delivered24h} color="emerald" />
                <MetricCard
                    label={t('failed_24h')}
                    value={metrics.failed24h}
                    color={metrics.failed24h > 0 ? 'red' : 'emerald'}
                />
                <MetricCard
                    label={t('success_rate')}
                    value={`${metrics.successRate}%`}
                    color={metrics.successRate < 90 ? 'amber' : 'emerald'}
                />
            </div>

            <DataHubSubTabBar
                className="mb-5"
                ariaLabel={t('telegram_publisher') || 'Telegram publisher'}
                activeId={activeTab}
                onChange={id => setActiveTab(id as typeof activeTab)}
                items={(['channels', 'history', 'templates'] as const).map(tab => ({
                    id: tab,
                    label: t(`publisher_tab_${tab}`),
                    activeVariant: tab === 'channels' ? ('telegram' as const) : ('default' as const),
                }))}
            />

            {isLoading && publishers.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">{t('publisher_loading')}</div>
            ) : (
                <>
                    {activeTab === 'channels' && (
                        <div className="space-y-4">
                            {telegramSources.length > 0 && (
                                <div className={DATAHUB_INNER_LIST}>
                                    <h4 className="text-[11px] font-semibold text-foreground mb-3">
                                        {t('telegram_channel_mapping')}
                                    </h4>
                                    <div className="space-y-2">
                                        {telegramSources.slice(0, 5).map(source => (
                                            <div
                                                key={source.id}
                                                className="flex items-center justify-between p-2 rounded-lg border border-white/5 bg-slate-900/60 text-[11px]"
                                            >
                                                <span className="truncate">{source.name}</span>
                                                <StatusPill label={t('telegram')} variant="info" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {publishers.filter(p => p.is_active).length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {publishers
                                        .filter(p => p.is_active)
                                        .map(pub => (
                                            <div
                                                key={pub.id}
                                                className={`rounded-xl border p-4 bg-slate-900/60 transition-colors ${
                                                    selectedPublisherId === pub.id
                                                        ? 'border-purple-500/60'
                                                        : 'border-white/5 hover:border-purple-500/40'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-3 gap-2">
                                                    <div className="min-w-0">
                                                        <h5 className="text-sm font-semibold text-foreground truncate">
                                                            {pub.name}
                                                        </h5>
                                                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                                                            {pub.channel_id}
                                                            {pub.channel_username
                                                                ? ` · @${pub.channel_username}`
                                                                : ''}
                                                        </p>
                                                    </div>
                                                    <StatusPill
                                                        label={
                                                            pub.is_active ? t('active') : t('inactive')
                                                        }
                                                        variant={pub.is_active ? 'success' : 'neutral'}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mb-3">
                                                    {pub.has_bot_token
                                                        ? t('bot_token_configured')
                                                        : t('bot_token_missing_dry_run')}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedPublisherId(pub.id)}
                                                        className={BTN_OUTLINE_SLATE}
                                                    >
                                                        {t('select')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={testMutation.isPending}
                                                        onClick={() => handleTest(pub)}
                                                        className={BTN_OUTLINE_EMERALD}
                                                    >
                                                        {t('test')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={publishMutation.isPending}
                                                        onClick={() => handlePublish(pub)}
                                                        className={BTN_OUTLINE_PURPLE}
                                                    >
                                                        {t('publish')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={disableMutation.isPending}
                                                        onClick={() => handleDisable(pub)}
                                                        className={BTN_OUTLINE_RED}
                                                    >
                                                        {t('disable')}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <DataHubEmpty message={t('no_publishers')} />
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className={DATAHUB_INNER_LIST}>
                            {publishers.length > 0 && (
                                <select
                                    value={selectedPublisherId || ''}
                                    onChange={e => setSelectedPublisherId(e.target.value)}
                                    className={`${SELECT_CLASS} mb-4 max-w-xs`}
                                >
                                    {publishers.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {isLoadingHistory ? (
                                <p className="text-[11px] text-muted-foreground text-center py-8">
                                    {t('publisher_history_loading')}
                                </p>
                            ) : historyItems.length > 0 ? (
                                <div className="space-y-2">
                                    {historyItems.slice(0, 20).map(item => (
                                        <div
                                            key={item.id}
                                            className="rounded-lg border border-white/5 bg-slate-950/70 p-3 flex justify-between items-center gap-3 text-[11px]"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <StatusPill
                                                        label={t(`publisher_status_${item.status}`)}
                                                        variant={
                                                            item.status === 'sent' ? 'success' : 'error'
                                                        }
                                                    />
                                                    <span className="font-semibold truncate">
                                                        {item.payloadPreview}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {publishers.find(p => p.id === item.publisherId)?.name ||
                                                        item.publisherId}{' '}
                                                    · {new Date(item.sentAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <DataHubEmpty message={t('history_empty')} />
                            )}
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <div className={DATAHUB_INNER_LIST}>
                            <p className="text-[11px] text-muted-foreground mb-3">
                                {selectedPublisher
                                    ? `${t('template_for')}: ${selectedPublisher.name}`
                                    : t('select_publisher_for_template')}
                            </p>
                            <pre className="block bg-slate-950/80 border border-slate-700 rounded-lg p-3 text-[10px] whitespace-pre-wrap text-foreground font-mono">
                                {selectedPublisher?.template || defaultTemplate}
                            </pre>
                        </div>
                    )}
                </>
            )}

            {isFetching && (
                <p className="text-[10px] text-muted-foreground mt-4 text-center">{t('refreshing')}</p>
            )}

            {showCreateModal && (
                <DataHubModal
                    title={t('create_publisher')}
                    subtitle={t('create_publisher_desc')}
                    onClose={() => setShowCreateModal(false)}
                    maxWidth="max-w-md"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className={BTN_SECONDARY}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={
                                    createMutation.isPending || !form.name || !form.channel_id
                                }
                                onClick={handleCreate}
                                className={BTN_PRIMARY}
                            >
                                {createMutation.isPending ? t('saving') : t('create')}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <input
                            placeholder={t('name')}
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className={INPUT_CLASS}
                        />
                        <input
                            placeholder={t('channel_id')}
                            value={form.channel_id}
                            onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))}
                            className={INPUT_CLASS}
                        />
                        <input
                            placeholder={t('bot_token')}
                            type="password"
                            value={form.bot_token}
                            onChange={e => setForm(f => ({ ...f, bot_token: e.target.value }))}
                            className={INPUT_CLASS}
                        />
                        <textarea
                            placeholder={t('template')}
                            value={form.template}
                            onChange={e => setForm(f => ({ ...f, template: e.target.value }))}
                            rows={5}
                            className={`${INPUT_CLASS} font-mono resize-none`}
                        />
                    </div>
                </DataHubModal>
            )}
        </div>
    );
};

export default TelegramPublisher;
