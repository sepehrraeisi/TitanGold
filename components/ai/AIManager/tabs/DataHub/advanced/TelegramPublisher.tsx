import React, { useEffect, useMemo, useState } from 'react';
import { DataSource } from '../../../../../../types';
import {
    useTelegramPublishersQuery,
    usePublisherHistoryQuery,
    useCreateTelegramPublisherMutation,
    useDisableTelegramPublisherMutation,
    useTestTelegramPublisherMutation,
    usePublishTelegramPublisherMutation,
    usePublisherMappingsQuery,
    useCreatePublisherMappingMutation,
    useUpdatePublisherMappingMutation,
    useDisablePublisherMappingMutation,
    usePublisherRuntimeModeQuery,
    useSetPublisherRuntimeModeMutation,
} from '../../../../../../hooks/useTelegramPublishers';
import {
    formatPublisherApiError,
    PublisherMappingRecord,
    PublisherRuntimeModeView,
    PublishActionResult,
    TelegramPublisherRecord,
} from '../../../../../../services/telegramPublishersApi';
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
    dataHubWriteGate,
} from '../dataHubUi';
import { formatDataHubQueryError } from '../dataHubI18n';
import { useDataHubPermissions } from '../hooks/useDataHubPermissions';

interface TelegramPublisherProps {
    t: (key: string) => string;
    telegramSources: DataSource[];
}

const defaultTemplate = `📢 **Signal**
{message}

_Source: Titan DataHub_`;

const defaultPublishMessage = 'Dry-run DataHub publisher validation message.';

type RuntimeModeChoice = 'dry_run' | 'live_test' | 'live';

function formatLiveTestCountdown(expiresAt?: string | null): string | null {
    if (!expiresAt) return null;
    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) return '0';
    return String(Math.max(1, Math.ceil(remainingMs / 60000)));
}

function resolveDeliveryActionLabels(
    effectiveMode: RuntimeModeChoice,
    t: (key: string) => string,
) {
    if (effectiveMode === 'live_test') {
        return {
            testLabel: t('publisher_btn_test_live_test'),
            publishLabel: t('publisher_btn_publish_live_test'),
            helper: t('publisher_delivery_helper_live_test'),
        };
    }
    if (effectiveMode === 'live') {
        return {
            testLabel: t('publisher_btn_test_live'),
            publishLabel: t('publisher_btn_publish_live'),
            helper: t('publisher_delivery_helper_live'),
        };
    }
    return {
        testLabel: t('publisher_btn_test_dry_run'),
        publishLabel: t('publisher_btn_publish_dry_run'),
        helper: t('publisher_delivery_helper_dry_run'),
    };
}

function resolvePublishSuccessMessage(result: PublishActionResult, t: (key: string) => string): string {
    if (result.liveTestConsumed) return t('publisher_success_live_test_consumed');
    if (result.dry_run || result.effectiveMode === 'dry_run') return t('publisher_success_dry_run');
    if (result.effectiveMode === 'live_test') return t('publisher_success_live_test');
    return t('publisher_success_live');
}

const TelegramPublisher: React.FC<TelegramPublisherProps> = ({ t, telegramSources }) => {
    const { canWrite, role } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const [activeTab, setActiveTab] = useState<'channels' | 'history' | 'templates'>('channels');
    const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [selectedSourceId, setSelectedSourceId] = useState<string>('');
    const [publishMessage, setPublishMessage] = useState(defaultPublishMessage);
    const [publishContentType, setPublishContentType] = useState('manual');
    const [allowTemporaryPublish, setAllowTemporaryPublish] = useState(false);
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [editingMapping, setEditingMapping] = useState<PublisherMappingRecord | null>(null);
    const [mappingForm, setMappingForm] = useState({
        source_id: '',
        publisher_id: '',
        is_enabled: true,
    });
    const [showModeModal, setShowModeModal] = useState(false);
    const [pendingMode, setPendingMode] = useState<RuntimeModeChoice | null>(null);
    const [modeReason, setModeReason] = useState('');
    const [modeAcknowledged, setModeAcknowledged] = useState(false);

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
    const { data: runtimeModeData, refetch: refetchRuntimeMode } =
        usePublisherRuntimeModeQuery({ enabled: true });
    const { data: mappingData, isLoading: isLoadingMappings } =
        usePublisherMappingsQuery({ enabled: true });

    const publishers = listData?.publishers ?? [];
    const runtimeMode: PublisherRuntimeModeView = runtimeModeData ||
        listData?.runtimeMode || {
            configuredMode: 'dry_run',
            effectiveMode: 'dry_run',
            serverSafetyOverride: listData?.system?.dry_run_forced ?? false,
            liveTestRemainingSends: 0,
            canChangeMode: false,
            warnings: [],
        };
    const effectiveMode = runtimeMode.effectiveMode;
    const deliveryLabels = resolveDeliveryActionLabels(effectiveMode, t);
    const isAdmin = role === 'admin';
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

    useEffect(() => {
        if (telegramSources.length > 0 && !selectedSourceId) {
            setSelectedSourceId(telegramSources[0].id);
        }
    }, [telegramSources, selectedSourceId]);

    const { data: historyData, isLoading: isLoadingHistory } = usePublisherHistoryQuery(
        selectedPublisherId,
        { enabled: activeTab === 'history' && Boolean(selectedPublisherId) },
    );

    const createMutation = useCreateTelegramPublisherMutation();
    const disableMutation = useDisableTelegramPublisherMutation();
    const testMutation = useTestTelegramPublisherMutation();
    const publishMutation = usePublishTelegramPublisherMutation();
    const createMappingMutation = useCreatePublisherMappingMutation();
    const updateMappingMutation = useUpdatePublisherMappingMutation();
    const disableMappingMutation = useDisablePublisherMappingMutation();
    const setRuntimeModeMutation = useSetPublisherRuntimeModeMutation();

    const mappings = mappingData?.mappings ?? [];

    const listQueryError = formatDataHubQueryError(t, listError);
    const actionQueryError = formatDataHubQueryError(
        t,
        createMutation.error ||
            disableMutation.error ||
            testMutation.error ||
            publishMutation.error ||
            createMappingMutation.error ||
            updateMappingMutation.error ||
            disableMappingMutation.error ||
            setRuntimeModeMutation.error,
    );

    const selectedPublisher = publishers.find(p => p.id === selectedPublisherId);
    const selectedSource = telegramSources.find(source => source.id === selectedSourceId);
    const selectedMapping = mappings.find(
        mapping =>
            mapping.publisher_id === selectedPublisherId &&
            mapping.source_id === selectedSourceId &&
            mapping.is_enabled,
    );

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
            setActionError(
                formatDataHubQueryError(t, e instanceof Error ? e : new Error(t('publisher_create_failed')))
                    ?.message || t('publisher_create_failed'),
            );
        }
    };

    const handleTest = async (pub: TelegramPublisherRecord) => {
        setActionError(null);
        try {
            const result = await testMutation.mutateAsync({
                id: pub.id,
                message: t('publisher_test_message_default'),
            });
            const label = result.success
                ? resolvePublishSuccessMessage(result, t)
                : t('publisher_test_failed');
            setActionMessage(`${label}${result.error ? `: ${result.error}` : ''}`);
            setSelectedPublisherId(pub.id);
            await refetch();
            await refetchRuntimeMode();
        } catch (e: unknown) {
            setActionError(
                formatDataHubQueryError(t, e instanceof Error ? e : new Error(t('publisher_test_failed')))
                    ?.message || t('publisher_test_failed'),
            );
        }
    };

    const handlePublish = async (pub: TelegramPublisherRecord) => {
        if (!selectedSourceId) {
            setActionError(t('publisher_source_required'));
            return;
        }
        if (!publishMessage.trim()) {
            setActionError(t('publisher_message_required'));
            return;
        }
        if (!selectedMapping && !allowTemporaryPublish) {
            setActionError(t('publisher_mapping_required'));
            return;
        }

        setActionError(null);
        try {
            const result = await publishMutation.mutateAsync({
                id: pub.id,
                source_id: selectedSourceId,
                data_type: selectedSource?.type || 'manual',
                message: publishMessage.trim(),
                confirm_publish: true,
                content_type: publishContentType,
                title: selectedSource?.name,
                content: publishMessage.trim(),
                allow_temporary_publish: allowTemporaryPublish,
            });
            const label = result.success
                ? resolvePublishSuccessMessage(result, t)
                : t('publisher_publish_failed');
            setActionMessage(`${label}${result.error ? `: ${result.error}` : ''}`);
            setSelectedPublisherId(pub.id);
            await refetch();
            await refetchRuntimeMode();
        } catch (e: unknown) {
            setActionError(formatPublisherApiError(e) || t('publisher_publish_failed'));
        }
    };

    const openCreateMapping = () => {
        setEditingMapping(null);
        setMappingForm({
            source_id: selectedSourceId || telegramSources[0]?.id || '',
            publisher_id: selectedPublisherId || publishers[0]?.id || '',
            is_enabled: true,
        });
        setShowMappingModal(true);
    };

    const openEditMapping = (mapping: PublisherMappingRecord) => {
        setEditingMapping(mapping);
        setMappingForm({
            source_id: mapping.source_id,
            publisher_id: mapping.publisher_id,
            is_enabled: mapping.is_enabled,
        });
        setSelectedSourceId(mapping.source_id);
        setSelectedPublisherId(mapping.publisher_id);
        setShowMappingModal(true);
    };

    const handleMappingSubmit = async () => {
        if (!mappingForm.source_id || !mappingForm.publisher_id) {
            setActionError(t('publisher_mapping_fields_required'));
            return;
        }
        setActionError(null);
        try {
            if (editingMapping) {
                await updateMappingMutation.mutateAsync({
                    id: editingMapping.id,
                    payload: {
                        source_id: mappingForm.source_id,
                        publisher_id: mappingForm.publisher_id,
                        is_enabled: mappingForm.is_enabled,
                    },
                });
                setActionMessage(t('publisher_mapping_updated'));
            } else {
                await createMappingMutation.mutateAsync({
                    source_id: mappingForm.source_id,
                    publisher_id: mappingForm.publisher_id,
                    is_enabled: mappingForm.is_enabled,
                });
                setActionMessage(t('publisher_mapping_created'));
            }
            setShowMappingModal(false);
        } catch (e: unknown) {
            setActionError(formatPublisherApiError(e) || t('publisher_mapping_save_failed'));
        }
    };

    const handleDisableMapping = async (mapping: PublisherMappingRecord) => {
        if (!window.confirm(t('publisher_mapping_disable_confirm'))) return;
        try {
            await disableMappingMutation.mutateAsync(mapping.id);
            setActionMessage(t('publisher_mapping_disabled'));
        } catch (e: unknown) {
            setActionError(formatPublisherApiError(e) || t('publisher_mapping_save_failed'));
        }
    };

    const openModeModal = (mode: RuntimeModeChoice) => {
        setPendingMode(mode);
        setModeReason('');
        setModeAcknowledged(false);
        setShowModeModal(true);
    };

    const handleModeChange = async () => {
        if (!pendingMode) return;
        if (modeReason.trim().length < 5) {
            setActionError(t('publisher_mode_reason_required'));
            return;
        }
        if ((pendingMode === 'live' || pendingMode === 'live_test') && !modeAcknowledged) {
            setActionError(t('publisher_mode_ack_required'));
            return;
        }
        setActionError(null);
        try {
            await setRuntimeModeMutation.mutateAsync({
                mode: pendingMode,
                confirm_runtime_mode_change: true,
                reason: modeReason.trim(),
                ...(pendingMode === 'live' || pendingMode === 'live_test'
                    ? { acknowledge_live_delivery_risk: true as const }
                    : {}),
            });
            setShowModeModal(false);
            setActionMessage(t(`publisher_mode_enabled_${pendingMode}`));
            await refetch();
            await refetchRuntimeMode();
        } catch (e: unknown) {
            setActionError(formatPublisherApiError(e) || t('publisher_mode_change_failed'));
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
            setActionError(
                formatDataHubQueryError(t, e instanceof Error ? e : new Error(t('publisher_disable_failed')))
                    ?.message || t('publisher_disable_failed'),
            );
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
            {(actionQueryError || actionError) && (
                <DataHubAlert
                    variant={actionQueryError?.variant || 'error'}
                    message={actionQueryError?.message || actionError || ''}
                />
            )}

            <DataHubSectionHeader
                title={t('telegram_publisher')}
                subtitle={t('telegram_publisher_desc')}
                actions={
                    <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        className={BTN_PRIMARY}
                        disabled={wg().disabled}
                        title={wg().title}
                    >
                        {t('new_publisher_channel')}
                    </button>
                }
            />

            {listQueryError && (
                <DataHubAlert
                    variant={listQueryError.variant}
                    message={listQueryError.message}
                    onRetry={listQueryError.retryable ? () => refetch() : undefined}
                    retryLabel={t('retry')}
                />
            )}

            {runtimeMode.serverSafetyOverride && (
                <div className="mb-4">
                    <DataHubAlert
                        variant="warning"
                        message={t('publisher_server_override_banner')}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                        {t('publisher_server_override_hint')}
                    </p>
                </div>
            )}

            <div className={`${DATAHUB_INNER_LIST} mb-5`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <h4 className="text-[11px] font-semibold text-foreground">
                            {t('publisher_delivery_mode_title')}
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {deliveryLabels.helper}
                        </p>
                    </div>
                    <StatusPill
                        label={t(`publisher_mode_${runtimeMode.configuredMode}`)}
                        variant={
                            runtimeMode.effectiveMode === 'live'
                                ? 'error'
                                : runtimeMode.effectiveMode === 'live_test'
                                  ? 'warning'
                                  : 'neutral'
                        }
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] mb-3">
                    <div>
                        <p className="text-muted-foreground">{t('publisher_mode_configured')}</p>
                        <p className="font-semibold text-foreground">
                            {t(`publisher_mode_${runtimeMode.configuredMode}`)}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">{t('publisher_mode_effective')}</p>
                        <p className="font-semibold text-foreground">
                            {runtimeMode.serverSafetyOverride
                                ? t('publisher_mode_effective_override')
                                : runtimeMode.effectiveMode === 'live_test' &&
                                    runtimeMode.liveTestExpiresAt
                                  ? `${t('publisher_mode_live_test')} · ${formatLiveTestCountdown(runtimeMode.liveTestExpiresAt)} ${t('publisher_minutes_remaining')}`
                                  : t(`publisher_mode_${runtimeMode.effectiveMode}`)}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">{t('publisher_server_override_label')}</p>
                        <p className="font-semibold text-foreground">
                            {runtimeMode.serverSafetyOverride
                                ? t('publisher_server_override_active')
                                : t('publisher_server_override_inactive')}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">{t('publisher_mode_last_changed')}</p>
                        <p className="font-semibold text-foreground">
                            {runtimeMode.lastChangedBy || t('unknown')}
                            {runtimeMode.lastChangedAt
                                ? ` · ${new Date(runtimeMode.lastChangedAt).toLocaleString()}`
                                : ''}
                        </p>
                    </div>
                    {runtimeMode.reason && (
                        <div className="md:col-span-2">
                            <p className="text-muted-foreground">{t('publisher_mode_reason_label')}</p>
                            <p className="text-foreground">{runtimeMode.reason}</p>
                        </div>
                    )}
                    {runtimeMode.effectiveMode === 'live_test' && (
                        <>
                            <div>
                                <p className="text-muted-foreground">{t('publisher_live_test_remaining')}</p>
                                <p className="font-semibold text-foreground">
                                    {runtimeMode.liveTestRemainingSends}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">{t('publisher_live_test_expires')}</p>
                                <p className="font-semibold text-foreground">
                                    {runtimeMode.liveTestExpiresAt
                                        ? new Date(runtimeMode.liveTestExpiresAt).toLocaleString()
                                        : t('unknown')}
                                </p>
                            </div>
                        </>
                    )}
                </div>
                {runtimeMode.stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <MetricCard
                            label={t('publisher_stats_sent_today')}
                            value={runtimeMode.stats.messagesSentToday}
                            color="emerald"
                        />
                        <MetricCard
                            label={t('publisher_stats_dry_runs_today')}
                            value={runtimeMode.stats.dryRunsToday}
                            color="blue"
                        />
                        <MetricCard
                            label={t('publisher_stats_failed_today')}
                            value={runtimeMode.stats.failedSendsToday}
                            color={runtimeMode.stats.failedSendsToday > 0 ? 'red' : 'emerald'}
                        />
                        <MetricCard
                            label={t('publisher_stats_last_delivery')}
                            value={
                                runtimeMode.stats.lastTelegramDeliveryAt
                                    ? new Date(runtimeMode.stats.lastTelegramDeliveryAt).toLocaleTimeString()
                                    : t('none')
                            }
                            color="purple"
                        />
                    </div>
                )}
                {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={BTN_OUTLINE_SLATE}
                            disabled={wg(setRuntimeModeMutation.isPending).disabled}
                            title={wg(setRuntimeModeMutation.isPending).title}
                            onClick={() => openModeModal('dry_run')}
                        >
                            {t('publisher_enable_dry_run')}
                        </button>
                        <button
                            type="button"
                            className={BTN_OUTLINE_EMERALD}
                            disabled={
                                wg(
                                    setRuntimeModeMutation.isPending ||
                                        runtimeMode.serverSafetyOverride ||
                                        !runtimeMode.canChangeMode,
                                ).disabled
                            }
                            title={wg(setRuntimeModeMutation.isPending).title}
                            onClick={() => openModeModal('live_test')}
                        >
                            {t('publisher_enable_live_test')}
                        </button>
                        <button
                            type="button"
                            className={BTN_OUTLINE_RED}
                            disabled={
                                wg(
                                    setRuntimeModeMutation.isPending ||
                                        runtimeMode.serverSafetyOverride ||
                                        !runtimeMode.canChangeMode,
                                ).disabled
                            }
                            title={wg(setRuntimeModeMutation.isPending).title}
                            onClick={() => openModeModal('live')}
                        >
                            {t('publisher_enable_live')}
                        </button>
                    </div>
                )}
            </div>

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
                            <div className={DATAHUB_INNER_LIST}>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <h4 className="text-[11px] font-semibold text-foreground">
                                            {t('source_mapping')}
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {t('source_mapping_desc')}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={openCreateMapping}
                                        className={BTN_OUTLINE_PURPLE}
                                        disabled={wg(createMappingMutation.isPending || publishers.length === 0 || telegramSources.length === 0).disabled}
                                        title={wg(createMappingMutation.isPending).title}
                                    >
                                        {t('create_mapping')}
                                    </button>
                                </div>
                                {isLoadingMappings ? (
                                    <p className="text-[11px] text-muted-foreground">{t('publisher_mapping_loading')}</p>
                                ) : mappings.length > 0 ? (
                                    <div className="space-y-2">
                                        {mappings.map(mapping => (
                                            <button
                                                key={mapping.id}
                                                type="button"
                                                onClick={() => openEditMapping(mapping)}
                                                className="w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-white/5 bg-slate-900/60 hover:border-purple-500/40 text-[11px]"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-foreground truncate">
                                                        {mapping.source_name} → {mapping.publisher_name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground truncate">
                                                        {mapping.source_type} · {mapping.publisher_channel_id}
                                                        {mapping.publisher_channel_username ? ` · @${mapping.publisher_channel_username}` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                                                    <StatusPill
                                                        label={mapping.is_enabled ? t('enabled') : t('disabled')}
                                                        variant={mapping.is_enabled ? 'success' : 'neutral'}
                                                    />
                                                    <StatusPill label={t('policy_acl_filter_protected')} variant="info" />
                                                    <StatusPill
                                                        label={mapping.last_status ? t(`publisher_status_${mapping.last_status}`) : t('no_recent_activity')}
                                                        variant={mapping.last_status === 'failed' || mapping.last_status === 'blocked' ? 'error' : 'neutral'}
                                                    />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-white/10 p-4 text-[11px] text-muted-foreground">
                                        {t('source_mapping_empty')}
                                    </div>
                                )}
                            </div>

                            <div className={DATAHUB_INNER_LIST}>
                                <h4 className="text-[11px] font-semibold text-foreground mb-2">
                                    {t('publish_from_source')}
                                </h4>
                                <p className="text-[10px] text-muted-foreground mb-3">
                                    {t('publish_from_source_desc')}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                    <select
                                        value={selectedSourceId}
                                        onChange={e => setSelectedSourceId(e.target.value)}
                                        className={SELECT_CLASS}
                                    >
                                        <option value="">{t('select_source')}</option>
                                        {telegramSources.map(source => (
                                            <option key={source.id} value={source.id}>
                                                {source.name}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedPublisherId || ''}
                                        onChange={e => setSelectedPublisherId(e.target.value)}
                                        className={SELECT_CLASS}
                                    >
                                        <option value="">{t('select_publisher_channel')}</option>
                                        {publishers.filter(p => p.is_active).map(pub => (
                                            <option key={pub.id} value={pub.id}>
                                                {pub.name}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        value={publishContentType}
                                        onChange={e => setPublishContentType(e.target.value)}
                                        className={INPUT_CLASS}
                                        placeholder={t('content_type')}
                                    />
                                </div>
                                <textarea
                                    value={publishMessage}
                                    onChange={e => setPublishMessage(e.target.value)}
                                    rows={4}
                                    className={`${INPUT_CLASS} resize-none`}
                                    placeholder={t('publisher_publish_sample')}
                                />
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            checked={allowTemporaryPublish}
                                            onChange={e => setAllowTemporaryPublish(e.target.checked)}
                                            className="rounded"
                                        />
                                        {t('allow_temporary_publish')}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedMapping ? (
                                            <StatusPill label={t('mapping_enabled')} variant="success" />
                                        ) : (
                                            <StatusPill label={t('mapping_required')} variant="warning" />
                                        )}
                                        <button
                                            type="button"
                                            disabled={wg(publishMutation.isPending || !selectedPublisher).disabled}
                                            title={wg(publishMutation.isPending || !selectedPublisher).title}
                                            onClick={() => selectedPublisher && handlePublish(selectedPublisher)}
                                            className={BTN_OUTLINE_PURPLE}
                                        >
                                            {deliveryLabels.publishLabel}
                                        </button>
                                    </div>
                                </div>
                            </div>

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
                                                        disabled={wg(testMutation.isPending).disabled}
                                                        title={wg(testMutation.isPending).title}
                                                        onClick={() => handleTest(pub)}
                                                        className={BTN_OUTLINE_EMERALD}
                                                    >
                                                        {deliveryLabels.testLabel}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={wg(publishMutation.isPending).disabled}
                                                        title={wg(publishMutation.isPending).title}
                                                        onClick={() => handlePublish(pub)}
                                                        className={BTN_OUTLINE_PURPLE}
                                                    >
                                                        {deliveryLabels.publishLabel}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={wg(disableMutation.isPending).disabled}
                                                        title={wg(disableMutation.isPending).title}
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
                            ) : (historyData?.data ?? []).length > 0 ? (
                                <div className="space-y-2">
                                    {(historyData?.data ?? []).slice(0, 20).map(item => (
                                        <div
                                            key={item.id}
                                            className="rounded-lg border border-white/5 bg-slate-950/70 p-3 flex justify-between items-center gap-3 text-[11px]"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <StatusPill
                                                        label={t(`publisher_status_${item.status}`)}
                                                        variant={
                                                            item.status === 'sent' || item.status === 'test'
                                                                ? 'success'
                                                                : item.status === 'dry_run'
                                                                  ? 'warning'
                                                                  : 'error'
                                                        }
                                                    />
                                                    {item.delivery_mode && (
                                                        <StatusPill
                                                            label={t(`delivery_mode_${item.delivery_mode}`)}
                                                            variant="neutral"
                                                        />
                                                    )}
                                                    <span className="font-semibold truncate">
                                                        {item.content_summary || item.error_message || item.status}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground truncate">
                                                    {item.publisher_name || item.publisher_id}
                                                    {item.source_name ? ` · ${item.source_name}` : ''}
                                                    {item.error_code ? ` · ${item.error_code}` : ''}
                                                    {item.content_type ? ` · ${item.content_type}` : ''}
                                                    {item.created_by_email ? ` · ${item.created_by_email}` : ''}
                                                    {' '}· {new Date(item.created_at).toLocaleString()}
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
                            <h4 className="text-[11px] font-semibold text-foreground mb-2">
                                {t('message_preview_templates')}
                            </h4>
                            <p className="text-[11px] text-muted-foreground mb-3">
                                {selectedPublisher
                                    ? `${t('template_for')}: ${selectedPublisher.name}`
                                    : t('select_publisher_for_template')}
                            </p>
                            <p className="text-[10px] text-muted-foreground mb-3">
                                {t('message_preview_templates_desc')}
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

            {showMappingModal && (
                <DataHubModal
                    title={editingMapping ? t('edit_mapping') : t('create_mapping')}
                    subtitle={t('mapping_modal_desc')}
                    onClose={() => setShowMappingModal(false)}
                    maxWidth="max-w-md"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={() => setShowMappingModal(false)}
                                className={BTN_SECONDARY}
                            >
                                {t('cancel')}
                            </button>
                            {editingMapping && (
                                <button
                                    type="button"
                                    onClick={() => handleDisableMapping(editingMapping)}
                                    className={BTN_OUTLINE_RED}
                                    disabled={wg(disableMappingMutation.isPending).disabled}
                                    title={wg(disableMappingMutation.isPending).title}
                                >
                                    {t('disable_mapping')}
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={wg(
                                    createMappingMutation.isPending ||
                                        updateMappingMutation.isPending ||
                                        !mappingForm.source_id ||
                                        !mappingForm.publisher_id,
                                ).disabled}
                                title={wg(createMappingMutation.isPending || updateMappingMutation.isPending).title}
                                onClick={handleMappingSubmit}
                                className={BTN_PRIMARY}
                            >
                                {t('save_mapping')}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <select
                            value={mappingForm.source_id}
                            onChange={e => setMappingForm(f => ({ ...f, source_id: e.target.value }))}
                            className={SELECT_CLASS}
                        >
                            <option value="">{t('select_source')}</option>
                            {telegramSources.map(source => (
                                <option key={source.id} value={source.id}>
                                    {source.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={mappingForm.publisher_id}
                            onChange={e => setMappingForm(f => ({ ...f, publisher_id: e.target.value }))}
                            className={SELECT_CLASS}
                        >
                            <option value="">{t('select_publisher_channel')}</option>
                            {publishers.map(pub => (
                                <option key={pub.id} value={pub.id}>
                                    {pub.name}
                                </option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={mappingForm.is_enabled}
                                onChange={e => setMappingForm(f => ({ ...f, is_enabled: e.target.checked }))}
                                className="rounded"
                            />
                            {t('mapping_enabled')}
                        </label>
                        <DataHubAlert variant="warning" message={t('mapping_policy_note')} />
                    </div>
                </DataHubModal>
            )}

            {showModeModal && pendingMode && (
                <DataHubModal
                    title={t(`publisher_mode_modal_title_${pendingMode}`)}
                    subtitle={t(`publisher_mode_modal_desc_${pendingMode}`)}
                    onClose={() => setShowModeModal(false)}
                    maxWidth="max-w-md"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={() => setShowModeModal(false)}
                                className={BTN_SECONDARY}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={wg(setRuntimeModeMutation.isPending).disabled}
                                title={wg(setRuntimeModeMutation.isPending).title}
                                onClick={handleModeChange}
                                className={pendingMode === 'live' ? BTN_OUTLINE_RED : BTN_PRIMARY}
                            >
                                {t(`publisher_mode_confirm_${pendingMode}`)}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <textarea
                            value={modeReason}
                            onChange={e => setModeReason(e.target.value)}
                            rows={3}
                            className={`${INPUT_CLASS} resize-none`}
                            placeholder={t('publisher_mode_reason_placeholder')}
                        />
                        {(pendingMode === 'live' || pendingMode === 'live_test') && (
                            <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={modeAcknowledged}
                                    onChange={e => setModeAcknowledged(e.target.checked)}
                                    className="rounded mt-0.5"
                                />
                                <span>{t(`publisher_mode_ack_${pendingMode}`)}</span>
                            </label>
                        )}
                        {pendingMode === 'live' && (
                            <DataHubAlert variant="error" message={t('publisher_mode_live_warning')} />
                        )}
                    </div>
                </DataHubModal>
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
                                    wg(
                                        createMutation.isPending ||
                                            !form.name ||
                                            !form.channel_id,
                                    ).disabled
                                }
                                title={wg(createMutation.isPending).title}
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
