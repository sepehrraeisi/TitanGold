
import React, { useMemo, useState } from 'react';
import { DataCategory, AIAgent, AgentTopicRoute, AgentTopicFormValues, TelegramPublisher } from '../../../../../../types';
import AutomationTopicModal from '../modals/AutomationTopicModal';
import QueuePreviewModal from '../modals/QueuePreviewModal';
import { SummaryCard } from '../../../../../ui/summary-card';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import { EmptyState } from '../../../../../ui/empty-state';
import ApiWrapper from '../../../../../common/ApiWrapper';
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

    const isMutating =
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
        const confirmed = window.confirm(t('confirm_delete') || 'Are you sure?');
        if (confirmed) {
            await deleteTopic.mutateAsync(topicId);
        }
    };

    const handleTestRun = async () => {
        await testRun.mutateAsync({ dry_run: true });
    };

    const handleRetry = async (executionId: string) => {
        await retryExecution.mutateAsync(executionId);
    };

    const combinedError =
        (error as Error | null)?.message ||
        createTopic.error?.message ||
        updateTopic.error?.message ||
        deleteTopic.error?.message ||
        refreshQueue.error?.message ||
        dispatchQueue.error?.message ||
        null;

    return (
        <ApiWrapper
            error={combinedError}
            setError={() => {}}
            isLoading={isLoading || isMutating}
        >
            <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            🤖 {t('automation_routing') || 'Automation & Routing'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('automation_desc') ||
                                'Backend-first automation topics, queue, and manual dispatch.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={dispatchDryRun}
                                onChange={e => setDispatchDryRun(e.target.checked)}
                            />
                            {t('dry_run') || 'Dry-run'}
                        </label>
                        <ActionButton
                            variant="secondary"
                            size="sm"
                            loading={testRun.isPending}
                            onClick={handleTestRun}
                        >
                            🧪 {t('test_run') || 'Test run'}
                        </ActionButton>
                        <ActionButton
                            variant="secondary"
                            size="sm"
                            loading={refreshQueue.isPending}
                            onClick={handleRefreshAutomation}
                        >
                            🔄 {t('refresh') || 'Refresh queue'}
                        </ActionButton>
                        <ActionButton
                            variant="primary"
                            size="sm"
                            onClick={() => {
                                setEditingTopic(null);
                                setShowAutomationModal(true);
                            }}
                        >
                            + {t('add_topic') || 'Add Topic'}
                        </ActionButton>
                    </div>
                </div>

                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <SummaryCard
                            label={t('automation_topics') || 'Topics'}
                            value={summary.totalTopics}
                            icon={<span className="text-2xl">📚</span>}
                        />
                        <SummaryCard
                            label={t('active_routing') || 'Active'}
                            value={summary.enabledTopics}
                            variant="success"
                            icon={<span className="text-2xl">⚡</span>}
                        />
                        <SummaryCard
                            label={t('queue_size') || 'In Queue'}
                            value={summary.queueSize}
                            variant={summary.queueSize > 50 ? 'warning' : 'default'}
                            icon={<span className="text-2xl">📥</span>}
                        />
                        <SummaryCard
                            label={t('avg_pass_rate') || 'Avg Pass Rate'}
                            value={`${summary.avgPassRate}%`}
                            variant={summary.avgPassRate < 80 ? 'warning' : 'success'}
                            icon={<span className="text-2xl">📊</span>}
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
                        t={t}
                    />
                )}

                <div className="mb-8">
                    {topics.length > 0 ? (
                        <AutomationTopicList
                            topics={topics}
                            agentMap={agentMap}
                            publisherMap={publisherMap}
                            t={t}
                            onEdit={topic => {
                                setEditingTopic(topic);
                                setShowAutomationModal(true);
                            }}
                            onDelete={handleDeleteTopic}
                            deletingTopicId={deleteTopic.isPending ? deleteTopic.variables : null}
                        />
                    ) : (
                        <EmptyState
                            title={t('automation_no_topics') || 'No routing rules defined'}
                            description={
                                t('automation_no_topics_desc') ||
                                'Define your first automation topic to start publishing.'
                            }
                            icon={<span className="text-3xl">🧭</span>}
                            className="py-10"
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                    <AutomationQueueManager
                        queue={automationQueue.map(item => ({
                            ...item,
                            topicId: topicMap.get(item.topicId)?.title || item.topicId,
                        }))}
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

                    <div className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                                🕒 {t('automation_history_heading') || 'Execution History'}
                            </h4>
                            <span className="text-xs text-muted-foreground">{historyForUi.length} items</span>
                        </div>
                        {historyForUi.length > 0 ? (
                            <div className="space-y-3">
                                {historyForUi.slice(0, 8).map(entry => {
                                    const topic = topicMap.get(entry.topicId);
                                    const publisher = publisherMap[entry.publisherId];
                                    const isFailed = entry.status === 'failed';
                                    return (
                                        <div
                                            key={entry.id}
                                            className="border border-border rounded-lg p-3 bg-secondary/5"
                                        >
                                            <div className="flex justify-between items-start mb-1 gap-2">
                                                <p className="font-semibold text-foreground text-xs line-clamp-1 flex-1">
                                                    {entry.payloadPreview}
                                                </p>
                                                <StatusBadge
                                                    status={isFailed ? 'error' : 'success'}
                                                    label={
                                                        entry.dryRun
                                                            ? 'Dry-run'
                                                            : isFailed
                                                              ? 'Failed'
                                                              : 'Sent'
                                                    }
                                                    size="sm"
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                                <span>
                                                    {topic?.title || entry.topicId} →{' '}
                                                    {publisher?.name || entry.publisherId}
                                                </span>
                                                <span>{formatTimeAgo(entry.sentAt)}</span>
                                            </div>
                                            {isFailed && (
                                                <ActionButton
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mt-2 text-xs"
                                                    loading={retryExecution.isPending}
                                                    onClick={() => handleRetry(entry.id)}
                                                >
                                                    {t('retry') || 'Retry'}
                                                </ActionButton>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyState
                                title={t('no_history') || 'No history yet'}
                                description={
                                    t('no_history_desc') ||
                                    'Dispatch or test-run to record execution history.'
                                }
                                icon={<span className="text-2xl">⏳</span>}
                                className="py-10"
                            />
                        )}
                    </div>
                </div>

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
        </ApiWrapper>
    );
};

export default AutomationTopics;
