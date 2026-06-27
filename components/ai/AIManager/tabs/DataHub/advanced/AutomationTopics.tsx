
import React, { useMemo, useState } from 'react';
import { DataCategory, AIAgent, AgentTopicRoute, AgentTopicFormValues, TelegramPublisher } from '../../../../../../types';
import AutomationTopicModal from '../modals/AutomationTopicModal';
import QueuePreviewModal from '../modals/QueuePreviewModal';
import AutomationTopicList from './automation/AutomationTopicList';
import AutomationQueueManager from './automation/AutomationQueueManager';
import AutomationSchedulePanel from './automation/AutomationSchedulePanel';
import {
    useAutomationOverviewQuery,
    useCreateAutomationTopicMutation,
    useUpdateAutomationTopicMutation,
    useDeleteAutomationTopicMutation,
    useUpdateAutomationScheduleMutation,
    useRefreshAutomationQueueMutation,
    useDispatchAutomationQueueMutation,
    useDispatchQueueItemMutation,
    useFailQueueItemMutation,
    useRetryAutomationExecutionMutation,
    useAutomationTestRunMutation,
    useValidateAutomationTopicMutation,
} from '../../../../../../hooks/useDatahubAutomation';
import { useTelegramPublishersQuery } from '../../../../../../hooks/useTelegramPublishers';
import type {
    AutomationExecutionRecord,
    AutomationRefreshSummary,
} from '../../../../../../services/datahubAutomationApi';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    BTN_PRIMARY,
    BTN_SECONDARY,
    BTN_OUTLINE_SLATE,
    DataHubAlert,
    DataHubEmpty,
    DataHubToggle,
    MetricCard,
    StatusPill,
    dataHubWriteGate,
} from '../dataHubUi';
import { formatDataHubQueryError } from '../dataHubI18n';
import { useDataHubPermissions } from '../hooks/useDataHubPermissions';
import { queueEmptyMessage } from './automation/automationErrorLabels';

interface AutomationTopicsProps {
    categories: DataCategory[];
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    agents: AIAgent[];
    isLoadingAgents: boolean;
    agentMap: Record<string, AIAgent>;
    availableDataTypes: string[];
}

const AutomationTopics: React.FC<AutomationTopicsProps> = ({
    categories,
    t,
    formatTimeAgo,
    agents,
    isLoadingAgents,
    agentMap,
    availableDataTypes,
}) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const { data: overview, isLoading, error, refetch } = useAutomationOverviewQuery();
    const { data: publishersData } = useTelegramPublishersQuery();

    const createTopic = useCreateAutomationTopicMutation();
    const updateTopic = useUpdateAutomationTopicMutation();
    const deleteTopic = useDeleteAutomationTopicMutation();
    const updateSchedule = useUpdateAutomationScheduleMutation();
    const refreshQueue = useRefreshAutomationQueueMutation();
    const dispatchQueue = useDispatchAutomationQueueMutation();
    const dispatchItem = useDispatchQueueItemMutation();
    const failItem = useFailQueueItemMutation();
    const retryExecution = useRetryAutomationExecutionMutation();
    const testRun = useAutomationTestRunMutation();
    const validateTopic = useValidateAutomationTopicMutation();

    const [showAutomationModal, setShowAutomationModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<AgentTopicRoute | null>(null);
    const [repairPublisherId, setRepairPublisherId] = useState<string | null>(null);
    const [previewQueueItem, setPreviewQueueItem] = useState<any>(null);
    const [dispatchDryRun, setDispatchDryRun] = useState(true);
    const [refreshSummary, setRefreshSummary] = useState<AutomationRefreshSummary | null>(null);
    const [actionMessage, setActionMessage] = useState('');
    const [validatingTopicId, setValidatingTopicId] = useState<string | null>(null);
    const [testingTopicId, setTestingTopicId] = useState<string | null>(null);

    const topics = overview?.topics ?? [];
    const schedule = overview?.schedule;
    const automationQueue = overview?.queue ?? [];
    const executions = overview?.executions ?? [];
    const summary = overview?.summary;
    const health = overview?.health;

    const publisherMap = useMemo(() => {
        const map: Record<string, { id: string; name: string; isActive: boolean }> = {};
        for (const p of publishersData?.publishers ?? []) {
            map[p.id] = { id: p.id, name: p.name, isActive: p.is_active };
        }
        return map;
    }, [publishersData]);

    const activePublisherId = useMemo(
        () => publishersData?.publishers?.find(p => p.is_active)?.id || null,
        [publishersData],
    );

    const publishersForModal: TelegramPublisher[] = useMemo(
        () =>
            (publishersData?.publishers ?? []).map(p => ({
                id: p.id,
                name: p.name,
                botToken: p.has_bot_token ? 'configured' : '',
                chatId: p.channel_id,
                enabled: p.is_active,
                filters: {},
                template: p.template || '',
                sentCount: p.sent_count,
            })),
        [publishersData],
    );

    const topicMap = useMemo(() => {
        const map = new Map<string, AgentTopicRoute>();
        topics.forEach(topic => map.set(topic.id, topic));
        return map;
    }, [topics]);

    const queueEmptyText = useMemo(
        () => queueEmptyMessage(health?.banner, refreshSummary, t),
        [health?.banner, refreshSummary, t],
    );

    const handleRefreshAutomation = async () => {
        setActionMessage('');
        const result = await refreshQueue.mutateAsync();
        if (result.summary) setRefreshSummary(result.summary);
        setActionMessage(
            result.summary
                ? `${t('refresh')} — ${result.summary.queued} ${t('automation_queued') || 'queued'}, ${result.summary.skipped} ${t('skipped')}, ${result.summary.blocked} ${t('blocked')}`
                : `${t('refresh')} — ${result.added} ${t('automation_queued') || 'queued'}`,
        );
    };

    const handleDispatchAutomation = async () => {
        const limit = schedule?.maxItemsPerRun ?? 5;
        const confirm_live = !dispatchDryRun && window.confirm(t('automation_confirm_live_publish'));
        if (!dispatchDryRun && !confirm_live) return;
        setActionMessage('');
        const result = await dispatchQueue.mutateAsync({ limit, dry_run: dispatchDryRun, confirm_live });
        const ok = result.executions?.some(
            (e: AutomationExecutionRecord) => e.status === 'dry_run' || e.status === 'sent',
        );
        setActionMessage(
            ok
                ? t('automation_dispatch_success') || 'Dry-run dispatch completed successfully.'
                : t('automation_dispatch_no_items') || 'Dispatch finished with no successful deliveries.',
        );
    };

    const handleToggleSchedule = async (enabled: boolean) => {
        if (!schedule) return;
        await updateSchedule.mutateAsync({ ...schedule, enabled });
    };

    const handleUpdateScheduleInterval = async (minutes: number) => {
        if (!schedule) return;
        await updateSchedule.mutateAsync({ ...schedule, intervalMinutes: minutes });
    };

    const handleProcessQueueItem = async (itemId: string, action: 'sent' | 'failed') => {
        if (action === 'sent') {
            const confirm_live = !dispatchDryRun && window.confirm(t('automation_confirm_live_publish'));
            if (!dispatchDryRun && !confirm_live) return;
            await dispatchItem.mutateAsync({ id: itemId, dry_run: dispatchDryRun, confirm_live });
        } else {
            await failItem.mutateAsync(itemId);
        }
        if (previewQueueItem?.id === itemId) setPreviewQueueItem(null);
    };

    const openEditTopic = (topic: AgentTopicRoute, repair?: { publisherId?: string }) => {
        setEditingTopic(
            repair?.publisherId
                ? { ...topic, publisherTargets: [repair.publisherId] }
                : topic,
        );
        setRepairPublisherId(repair?.publisherId || null);
        setShowAutomationModal(true);
    };

    const handleSaveTopic = async (topicData: AgentTopicFormValues) => {
        const agentName = agentMap[topicData.agentId]?.name;
        if (editingTopic) {
            await updateTopic.mutateAsync({ id: editingTopic.id, values: { ...topicData, agentName } });
            setActionMessage(t('settings_saved') || 'Settings saved');
        } else {
            await createTopic.mutateAsync({ ...topicData, agentName });
        }
        setShowAutomationModal(false);
        setEditingTopic(null);
        setRepairPublisherId(null);
    };

    const handleDeleteTopic = async (topicId: string) => {
        if (window.confirm(t('confirm_delete'))) {
            await deleteTopic.mutateAsync(topicId);
        }
    };

    const handleValidateTopic = async (topicId: string) => {
        setValidatingTopicId(topicId);
        setActionMessage('');
        try {
            const result = await validateTopic.mutateAsync(topicId);
            const reason = result.validity?.reasons?.[0] || t('automation_valid') || 'Valid';
            setActionMessage(
                result.validity?.valid
                    ? `${t('automation_validate') || 'Validate'}: ${t('automation_valid') || 'Valid'} (${result.validity.matchingCandidates ?? 0} candidates)`
                    : `${t('automation_validate') || 'Validate'}: ${reason}`,
            );
        } finally {
            setValidatingTopicId(null);
        }
    };

    const handleTestRun = async (topicId?: string) => {
        if (topicId) setTestingTopicId(topicId);
        setActionMessage('');
        try {
            await testRun.mutateAsync({ topic_id: topicId, dry_run: true });
            setActionMessage(t('automation_test_dry_run_success') || 'Dry-run test completed.');
        } finally {
            setTestingTopicId(null);
        }
    };

    const handleRetry = async (executionId: string) => {
        await retryExecution.mutateAsync({ id: executionId, dry_run: true });
    };

    const combinedError = formatDataHubQueryError(
        t,
        (error as Error | null) ||
            createTopic.error ||
            updateTopic.error ||
            dispatchQueue.error ||
            dispatchItem.error ||
            retryExecution.error ||
            testRun.error ||
            validateTopic.error,
    );

    const isBusy =
        createTopic.isPending ||
        updateTopic.isPending ||
        deleteTopic.isPending ||
        updateSchedule.isPending ||
        refreshQueue.isPending ||
        dispatchQueue.isPending ||
        dispatchItem.isPending ||
        failItem.isPending ||
        retryExecution.isPending ||
        testRun.isPending ||
        validateTopic.isPending;

    const healthVariant =
        health?.banner === 'healthy' ? 'success' : health?.banner === 'needs_setup' ? 'warning' : 'error';

    return (
        <div className={DATAHUB_SHELL}>
            <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 mb-5">
                <h3 className="text-sm font-semibold text-foreground">{t('automation_routing')}</h3>
                <p className="text-[11px] text-muted-foreground mt-2 max-w-3xl leading-relaxed">
                    {t('automation_explanation') ||
                        'Routes processed DataHub records to configured Telegram Publisher targets. This does not collect Telegram messages and does not store bot credentials.'}
                </p>
                <p className="text-[10px] text-sky-200/80 mt-2 font-mono">
                    Processed Data → Topic Rule → ACL / Filters → Publisher Mapping → Telegram Publisher → Dry-run / Live
                </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div className="flex flex-wrap gap-2 items-center">
                    <DataHubToggle
                        id="automation-dry-run"
                        checked={dispatchDryRun}
                        onChange={setDispatchDryRun}
                        label={t('dry_run')}
                    />
                    <button
                        type="button"
                        disabled={wg(testRun.isPending).disabled}
                        title={wg(testRun.isPending).title}
                        onClick={() => handleTestRun()}
                        className={BTN_SECONDARY}
                    >
                        {t('test_run')}
                    </button>
                    <button
                        type="button"
                        disabled={wg(refreshQueue.isPending).disabled}
                        title={wg(refreshQueue.isPending).title}
                        onClick={handleRefreshAutomation}
                        className={BTN_SECONDARY}
                    >
                        {t('refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEditingTopic(null);
                            setRepairPublisherId(null);
                            setShowAutomationModal(true);
                        }}
                        className={BTN_PRIMARY}
                        disabled={wg().disabled}
                        title={wg().title}
                    >
                        {t('add_topic')}
                    </button>
                </div>
            </div>

            {health && (
                <div
                    className={`mb-4 rounded-xl border p-3 ${
                        healthVariant === 'success'
                            ? 'border-emerald-500/40 bg-emerald-500/10'
                            : healthVariant === 'warning'
                              ? 'border-amber-500/40 bg-amber-500/10'
                              : 'border-red-500/40 bg-red-500/10'
                    }`}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <StatusPill label={health.label} variant={healthVariant} />
                    </div>
                    <p className="text-[11px] text-foreground/90">{health.message}</p>
                </div>
            )}

            {actionMessage && (
                <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                    {actionMessage}
                </div>
            )}

            {combinedError && (
                <DataHubAlert
                    variant={combinedError.variant}
                    message={combinedError.message}
                    onRetry={combinedError.retryable ? () => refetch() : undefined}
                    retryLabel={t('retry')}
                />
            )}

            {isLoading && !overview ? (
                <div className="py-12 text-center text-xs text-muted-foreground">{t('automation_loading')}</div>
            ) : (
                <>
                    {summary && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                            <MetricCard label={t('automation_topics')} value={summary.totalTopics} color="blue" />
                            <MetricCard
                                label={t('automation_valid_topics') || 'Valid topics'}
                                value={summary.validTopics ?? 0}
                                color="emerald"
                            />
                            <MetricCard
                                label={t('automation_invalid_topics') || 'Invalid topics'}
                                value={summary.invalidTopics ?? 0}
                                color={summary.invalidTopics ? 'amber' : 'emerald'}
                            />
                            <MetricCard
                                label={t('queue_size')}
                                value={summary.queueSize}
                                color={summary.queueSize > 0 ? 'purple' : 'blue'}
                            />
                            <MetricCard
                                label={t('avg_pass_rate')}
                                value={summary.avgPassRate > 0 ? `${summary.avgPassRate}%` : '—'}
                                color="blue"
                            />
                            <MetricCard
                                label={t('automation_last_blocked') || 'Last blocked'}
                                value={summary.lastBlockedReason ? '!' : '—'}
                                color={summary.lastBlockedReason ? 'amber' : 'blue'}
                            />
                        </div>
                    )}

                    {schedule && (
                        <AutomationSchedulePanel
                            schedule={{
                                enabled: schedule.enabled,
                                interval: schedule.intervalMinutes,
                                lastRun: schedule.lastRun ? formatTimeAgo(schedule.lastRun) : undefined,
                                nextRun: schedule.nextRun ? formatTimeAgo(schedule.nextRun) : undefined,
                            }}
                            isUpdating={updateSchedule.isPending}
                            onToggle={handleToggleSchedule}
                            onUpdateInterval={handleUpdateScheduleInterval}
                            canWrite={canWrite}
                            t={t}
                        />
                    )}

                    <div className="mb-6">
                        {topics.length > 0 ? (
                            <AutomationTopicList
                                topics={topics}
                                agentMap={agentMap}
                                publisherMap={publisherMap}
                                activePublisherId={activePublisherId}
                                canWrite={canWrite}
                                t={t}
                                onEdit={openEditTopic}
                                onDelete={handleDeleteTopic}
                                onValidate={handleValidateTopic}
                                onTestDryRun={handleTestRun}
                                deletingTopicId={deleteTopic.isPending ? deleteTopic.variables : null}
                                validatingTopicId={validatingTopicId}
                                testingTopicId={testingTopicId}
                            />
                        ) : (
                            <DataHubEmpty message={t('automation_no_topics')} />
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <AutomationQueueManager
                            queue={automationQueue.map(item => ({
                                ...item,
                                topicId: topicMap.get(item.topicId)?.title || item.topicId,
                                publisherName: publisherMap[item.publisherId]?.name,
                                publisherActive: publisherMap[item.publisherId]?.isActive,
                            }))}
                            isDryRun={dispatchDryRun}
                            canWrite={canWrite}
                            isDispatching={dispatchQueue.isPending}
                            onDispatch={handleDispatchAutomation}
                            onPreview={setPreviewQueueItem}
                            onProcess={handleProcessQueueItem}
                            processingId={
                                dispatchItem.isPending || failItem.isPending
                                    ? dispatchItem.variables?.id || failItem.variables
                                    : null
                            }
                            formatTimeAgo={formatTimeAgo}
                            emptyMessage={queueEmptyText}
                            refreshSummary={refreshSummary}
                            t={t}
                        />

                        <div className={DATAHUB_INNER_LIST}>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-[11px] font-semibold text-foreground">
                                    {t('automation_history_heading')}
                                </h4>
                                <span className="text-[10px] text-muted-foreground">
                                    {executions.length} {t('items')}
                                </span>
                            </div>
                            {executions.length > 0 ? (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                    {executions.slice(0, 10).map(entry => {
                                        const topic = topicMap.get(entry.topicId || '');
                                        const publisher = entry.publisherId
                                            ? publisherMap[entry.publisherId]
                                            : undefined;
                                        const isFailed = entry.status === 'failed';
                                        const isBlocked = entry.status === 'blocked';
                                        const isSkipped = entry.status === 'skipped';
                                        const isDry = entry.status === 'dry_run' || entry.dryRun;
                                        return (
                                            <div
                                                key={entry.id}
                                                className="rounded-lg border border-white/5 bg-slate-950/70 p-3"
                                            >
                                                <div className="flex justify-between items-start mb-1 gap-2">
                                                    <p className="font-semibold text-foreground text-[11px] line-clamp-1 flex-1">
                                                        {entry.payloadPreview || entry.topicName || entry.topicId}
                                                    </p>
                                                    <div className="flex gap-1 shrink-0">
                                                        {isDry && (
                                                            <StatusPill label={t('dry_run')} variant="info" />
                                                        )}
                                                        <StatusPill
                                                            label={
                                                                isBlocked
                                                                    ? t('blocked')
                                                                    : isSkipped
                                                                      ? t('skipped')
                                                                      : isFailed
                                                                        ? t('failed')
                                                                        : t('sent')
                                                            }
                                                            variant={
                                                                isBlocked || isSkipped || isFailed
                                                                    ? 'error'
                                                                    : 'success'
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                                    <span className="truncate">
                                                        {topic?.title || entry.topicName || entry.topicId} →{' '}
                                                        {publisher?.name || entry.publisherName || entry.publisherId}
                                                    </span>
                                                    <span className="shrink-0 ml-2">
                                                        {formatTimeAgo(entry.sentAt)}
                                                    </span>
                                                </div>
                                                {(entry.errorLabel || entry.errorCode) && (
                                                    <p className="text-[10px] text-amber-200 mt-1 leading-relaxed">
                                                        {entry.errorLabel || entry.errorCode}
                                                        {entry.isStale && (
                                                            <span className="text-muted-foreground">
                                                                {' '}
                                                                ({t('automation_stale_history') || 'stale'})
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                                {isFailed && entry.retryAllowed && (
                                                    <button
                                                        type="button"
                                                        disabled={wg(retryExecution.isPending).disabled}
                                                        title={wg(retryExecution.isPending).title}
                                                        onClick={() => handleRetry(entry.id)}
                                                        className={`${BTN_OUTLINE_SLATE} mt-2`}
                                                    >
                                                        {t('retry_dry_run')}
                                                    </button>
                                                )}
                                                {isFailed && entry.retryAllowed === false && (
                                                    <p className="text-[10px] text-muted-foreground mt-2">
                                                        {t('automation_retry_disabled') ||
                                                            'Retry is disabled for this history entry.'}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <DataHubEmpty message={t('no_history')} />
                            )}
                        </div>
                    </div>
                </>
            )}

            {isBusy && overview && (
                <p className="text-[10px] text-muted-foreground mt-4 text-center">{t('processing')}</p>
            )}

            {showAutomationModal && (
                <AutomationTopicModal
                    topic={editingTopic}
                    agents={agents}
                    isLoadingAgents={isLoadingAgents}
                    categories={categories}
                    dataTypes={availableDataTypes}
                    publishers={publishersForModal}
                    isSaving={createTopic.isPending || updateTopic.isPending}
                    onClose={() => {
                        setShowAutomationModal(false);
                        setEditingTopic(null);
                        setRepairPublisherId(null);
                    }}
                    onSave={handleSaveTopic}
                    t={t}
                />
            )}

            {previewQueueItem && (
                <QueuePreviewModal
                    item={previewQueueItem}
                    topic={topicMap.get(previewQueueItem.topicId) || null}
                    publisherName={publisherMap[previewQueueItem.publisherId]?.name}
                    record={null}
                    agent={agentMap[previewQueueItem.agentId]}
                    onClose={() => setPreviewQueueItem(null)}
                    onPublish={() => handleProcessQueueItem(previewQueueItem.id, 'sent')}
                    t={t}
                    processingId={
                        dispatchItem.isPending && dispatchItem.variables?.id === previewQueueItem.id
                            ? previewQueueItem.id + 'sent'
                            : null
                    }
                />
            )}
        </div>
    );
};

export default AutomationTopics;
