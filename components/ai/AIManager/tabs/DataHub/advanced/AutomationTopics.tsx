
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
} from '../../../../../../hooks/useDatahubAutomation';
import { useTelegramPublishersQuery } from '../../../../../../hooks/useTelegramPublishers';
import type { AutomationExecutionRecord } from '../../../../../../services/datahubAutomationApi';
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

    const [showAutomationModal, setShowAutomationModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<AgentTopicRoute | null>(null);
    const [previewQueueItem, setPreviewQueueItem] = useState<any>(null);
    const [dispatchDryRun, setDispatchDryRun] = useState(false);

    const topics = overview?.topics ?? [];
    const schedule = overview?.schedule;
    const automationQueue = overview?.queue ?? [];
    const executions = overview?.executions ?? [];
    const summary = overview?.summary;

    const publisherMap = useMemo(() => {
        const map: Record<string, { id: string; name: string }> = {};
        for (const p of publishersData?.publishers ?? []) {
            map[p.id] = { id: p.id, name: p.name };
        }
        return map;
    }, [publishersData]);

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

    const historyForUi = useMemo(
        () =>
            executions.map((entry: AutomationExecutionRecord) => ({
                id: entry.id,
                queueId: entry.queueId || '',
                recordId: entry.recordId || '',
                topicId: entry.topicId || '',
                publisherId: entry.publisherId || '',
                agentId: entry.agentId || '',
                status: entry.status,
                sentAt: entry.sentAt,
                latencyMs: entry.latencyMs,
                payloadPreview: entry.payloadPreview || entry.errorMessage || '',
                dryRun: entry.dryRun,
            })),
        [executions],
    );

    const handleRefreshAutomation = async () => {
        await refreshQueue.mutateAsync();
    };

    const handleDispatchAutomation = async () => {
        const limit = schedule?.maxItemsPerRun ?? 5;
        await dispatchQueue.mutateAsync({ limit, dry_run: dispatchDryRun });
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
            await dispatchItem.mutateAsync({ id: itemId, dry_run: dispatchDryRun });
        } else {
            await failItem.mutateAsync(itemId);
        }
        if (previewQueueItem?.id === itemId) {
            setPreviewQueueItem(null);
        }
    };

    const handleSaveTopic = async (topicData: AgentTopicFormValues) => {
        const agentName = agentMap[topicData.agentId]?.name;
        if (editingTopic) {
            await updateTopic.mutateAsync({ id: editingTopic.id, values: { ...topicData, agentName } });
        } else {
            await createTopic.mutateAsync({ ...topicData, agentName });
        }
        setShowAutomationModal(false);
        setEditingTopic(null);
    };

    const handleDeleteTopic = async (topicId: string) => {
        if (window.confirm(t('confirm_delete'))) {
            await deleteTopic.mutateAsync(topicId);
        }
    };

    const handleTestRun = async () => {
        await testRun.mutateAsync({ dry_run: true });
    };

    const handleRetry = async (executionId: string) => {
        await retryExecution.mutateAsync(executionId);
    };

    const combinedError = formatDataHubQueryError(
        t,
        (error as Error | null) ||
            createTopic.error ||
            updateTopic.error ||
            dispatchQueue.error,
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
        testRun.isPending;

    return (
        <div className={DATAHUB_SHELL}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground">
                        {t('automation_routing')}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">{t('automation_desc')}</p>
                </div>
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
                        onClick={handleTestRun}
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            <MetricCard label={t('automation_topics')} value={summary.totalTopics} color="blue" />
                            <MetricCard
                                label={t('active_routing')}
                                value={summary.enabledTopics}
                                color="emerald"
                            />
                            <MetricCard
                                label={t('queue_size')}
                                value={summary.queueSize}
                                color={summary.queueSize > 50 ? 'amber' : 'purple'}
                            />
                            <MetricCard
                                label={t('avg_pass_rate')}
                                value={`${summary.avgPassRate}%`}
                                color={summary.avgPassRate < 80 ? 'amber' : 'emerald'}
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
                                canWrite={canWrite}
                                t={t}
                                onEdit={topic => {
                                    setEditingTopic(topic);
                                    setShowAutomationModal(true);
                                }}
                                onDelete={handleDeleteTopic}
                                deletingTopicId={deleteTopic.isPending ? deleteTopic.variables : null}
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
                            }))}
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
                            t={t}
                        />

                        <div className={DATAHUB_INNER_LIST}>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-[11px] font-semibold text-foreground">
                                    {t('automation_history_heading')}
                                </h4>
                                <span className="text-[10px] text-muted-foreground">
                                    {historyForUi.length} {t('items')}
                                </span>
                            </div>
                            {historyForUi.length > 0 ? (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                    {historyForUi.slice(0, 8).map(entry => {
                                        const topic = topicMap.get(entry.topicId);
                                        const publisher = publisherMap[entry.publisherId];
                                        const isFailed = entry.status === 'failed';
                                        return (
                                            <div
                                                key={entry.id}
                                                className="rounded-lg border border-white/5 bg-slate-950/70 p-3"
                                            >
                                                <div className="flex justify-between items-start mb-1 gap-2">
                                                    <p className="font-semibold text-foreground text-[11px] line-clamp-1 flex-1">
                                                        {entry.payloadPreview}
                                                    </p>
                                                    <StatusPill
                                                        label={
                                                            entry.dryRun
                                                                ? t('dry_run')
                                                                : isFailed
                                                                  ? t('failed')
                                                                  : t('sent')
                                                        }
                                                        variant={
                                                            entry.dryRun
                                                                ? 'info'
                                                                : isFailed
                                                                  ? 'error'
                                                                  : 'success'
                                                        }
                                                    />
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                                    <span className="truncate">
                                                        {topic?.title || entry.topicId} →{' '}
                                                        {publisher?.name || entry.publisherId}
                                                    </span>
                                                    <span className="shrink-0 ml-2">
                                                        {formatTimeAgo(entry.sentAt)}
                                                    </span>
                                                </div>
                                                {isFailed && (
                                                    <button
                                                        type="button"
                                                        disabled={wg(retryExecution.isPending).disabled}
                                                        title={wg(retryExecution.isPending).title}
                                                        onClick={() => handleRetry(entry.id)}
                                                        className={`${BTN_OUTLINE_SLATE} mt-2`}
                                                    >
                                                        {t('retry')}
                                                    </button>
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
