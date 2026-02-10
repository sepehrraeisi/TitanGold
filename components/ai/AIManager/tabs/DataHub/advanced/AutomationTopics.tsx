
import React, { useState, useMemo } from 'react';
import * as api from '../../../../../../services/api';
import { DataHubState, AIAgent } from '../../../../../../types';
import AutomationTopicModal from '../modals/AutomationTopicModal';
import QueuePreviewModal from '../modals/QueuePreviewModal';
import { SummaryCard } from '../../../../../ui/summary-card';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import { EmptyState } from '../../../../../ui/empty-state';
import ApiWrapper from '../../../../../common/ApiWrapper';
import { useAsync } from '../../../../../../hooks/useAsync';

// Sub-components
import AutomationTopicList from './automation/AutomationTopicList';
import AutomationQueueManager from './automation/AutomationQueueManager';
import AutomationSchedulePanel from './automation/AutomationSchedulePanel';

interface AutomationTopicsProps {
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    agents: AIAgent[];
    isLoadingAgents: boolean;
    agentMap: Record<string, AIAgent>;
    topicMap: Map<string, any>;
    publisherMap: Record<string, any>;
}

const AutomationTopics: React.FC<AutomationTopicsProps> = ({
    dataHub,
    setDataHub,
    onRefresh,
    t,
    formatTimeAgo,
    agents,
    isLoadingAgents,
    agentMap,
    topicMap,
    publisherMap
}) => {
    const refreshAsync = useAsync(api.refreshAutomationQueue);
    const dispatchAsync = useAsync(api.dispatchAutomationQueue);
    const scheduleAsync = useAsync(api.updateAutomationSchedule);
    const processAsync = useAsync(api.processQueueItem);
    const saveTopicAsync = useAsync(async (topicData: any) => {
        if (editingTopic) {
            return api.updateAutomationTopic(editingTopic.id, topicData);
        } else {
            return api.createAutomationTopic(topicData);
        }
    });
    const deleteTopicAsync = useAsync(api.deleteAutomationTopic);

    const [showAutomationModal, setShowAutomationModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<any>(null);
    const [previewQueueItem, setPreviewQueueItem] = useState<any>(null);

    const advanced = dataHub.advanced || { telegramPublishers: [] };
    const automation = dataHub.automation;

    const availableDataTypes = useMemo(() => {
        const types = new Set<string>();
        dataHub.sources.forEach(s => types.add(s.type));
        return Array.from(types);
    }, [dataHub.sources]);

    const automationSummary = useMemo(() => {
        if (!automation) return null;
        return {
            totalTopics: automation.agentTopics.length,
            enabledTopics: automation.agentTopics.filter(t => t.enabled).length,
            linkedPublishers: automation.agentTopics.reduce((acc, t) => acc + t.publisherTargets.length, 0),
            avgPassRate: automation.agentTopics.length > 0
                ? Math.round(automation.agentTopics.reduce((acc, t) => acc + (t.stats?.last24h?.passRate || 0), 0) / automation.agentTopics.length)
                : 0
        };
    }, [automation]);

    const automationQueue = automation?.queue || [];
    const automationHistory = advanced.publisherHistory || [];

    const normalizedRecordMap = new Map<string, any>();

    const handleRefreshAutomation = async () => {
        try {
            const updated = await refreshAsync.execute();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to refresh automation:', e);
        }
    };

    const handleDispatchAutomation = async () => {
        try {
            await dispatchAsync.execute();
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to dispatch automation:', e);
        }
    };

    const handleToggleSchedule = async (enabled: boolean) => {
        if (!automation?.schedule) return;
        try {
            await scheduleAsync.execute({ ...automation.schedule, enabled });
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to update schedule:', e);
        }
    };

    const handleUpdateScheduleInterval = async (minutes: number) => {
        if (!automation?.schedule) return;
        try {
            await scheduleAsync.execute({ ...automation.schedule, intervalMinutes: minutes });
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to update schedule interval:', e);
        }
    };

    const handleProcessQueueItem = async (itemId: string, action: 'sent' | 'failed') => {
        try {
            await processAsync.execute(itemId, action);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            if (previewQueueItem?.id === itemId) {
                setPreviewQueueItem(null);
            }
            onRefresh();
        } catch (e: any) {
            console.error('Failed to process item:', e);
        }
    };

    const handleSaveTopic = async (topicData: any) => {
        try {
            await saveTopicAsync.execute(topicData);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
            setShowAutomationModal(false);
            setEditingTopic(null);
        } catch (e: any) {
            console.error('Failed to save topic:', e);
        }
    };

    const handleDeleteTopic = async (topicId: string) => {
        const confirmed = window.confirm(t('confirm_delete') || 'Are you sure?');
        if (confirmed) {
            try {
                await deleteTopicAsync.execute(topicId);
                const updated = await api.fetchDataHubState();
                setDataHub(updated);
                onRefresh();
            } catch (e: any) {
                console.error('Failed to delete topic:', e);
            }
        }
    };

    const isLoading = refreshAsync.isLoading || dispatchAsync.isLoading || scheduleAsync.isLoading || saveTopicAsync.isLoading || deleteTopicAsync.isLoading || processAsync.isLoading;

    return (
        <ApiWrapper
            error={refreshAsync.error || dispatchAsync.error || scheduleAsync.error || saveTopicAsync.error || deleteTopicAsync.error || processAsync.error}
            setError={() => {
                refreshAsync.setError(null);
                dispatchAsync.setError(null);
                scheduleAsync.setError(null);
                saveTopicAsync.setError(null);
                deleteTopicAsync.setError(null);
                processAsync.setError(null);
            }}
            isLoading={isLoading}
        >
            <div className="bg-card border border-border rounded-lg p-4">
                {!automation ? (
                    <div className="py-10">
                        <h3 className="font-semibold text-foreground mb-4">{t('automation_routing') || 'Automation Routing'}</h3>
                        <p className="text-sm text-muted-foreground">{t('automation_missing_config') || 'Automation module not configured yet.'}</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                            <div>
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    🤖 {t('automation_routing') || 'Automation & Routing'}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('automation_desc') || 'Define how data flows through agents and publishers based on topics and rules.'}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <ActionButton
                                    variant="secondary"
                                    size="sm"
                                    loading={refreshAsync.isLoading}
                                    onClick={handleRefreshAutomation}
                                >
                                    🔄 {t('refresh') || 'Refresh'}
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

                        {/* Metrics */}
                        {automationSummary && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <SummaryCard
                                    label={t('automation_topics') || 'Topics'}
                                    value={automationSummary.totalTopics}
                                    icon={<span className="text-2xl">📚</span>}
                                />
                                <SummaryCard
                                    label={t('active_routing') || 'Active'}
                                    value={automationSummary.enabledTopics}
                                    variant="success"
                                    icon={<span className="text-2xl">⚡</span>}
                                />
                                <SummaryCard
                                    label={t('queue_size') || 'In Queue'}
                                    value={automationQueue.length}
                                    variant={automationQueue.length > 50 ? 'warning' : 'default'}
                                    icon={<span className="text-2xl">📥</span>}
                                />
                                <SummaryCard
                                    label={t('avg_pass_rate') || 'Avg Pass Rate'}
                                    value={`${automationSummary.avgPassRate}%`}
                                    variant={automationSummary.avgPassRate < 80 ? 'warning' : 'success'}
                                    icon={<span className="text-2xl">📊</span>}
                                />
                            </div>
                        )}

                        {/* Schedule Configuration */}
                        {automation.schedule && (
                            <AutomationSchedulePanel
                                schedule={{
                                    enabled: automation.schedule.enabled,
                                    interval: automation.schedule.intervalMinutes,
                                    lastRun: automation.schedule.lastRun ? formatTimeAgo(automation.schedule.lastRun) : undefined,
                                    nextRun: automation.schedule.nextRun ? formatTimeAgo(automation.schedule.nextRun) : undefined,
                                }}
                                isUpdating={scheduleAsync.isLoading}
                                onToggle={handleToggleSchedule}
                                onUpdateInterval={handleUpdateScheduleInterval}
                                t={t}
                            />
                        )}

                        {/* Topics Routing Rules */}
                        <div className="mb-8">
                            {automation.agentTopics.length > 0 ? (
                                <AutomationTopicList
                                    topics={automation.agentTopics}
                                    agentMap={agentMap}
                                    publisherMap={publisherMap}
                                    t={t}
                                    onEdit={(topic) => {
                                        setEditingTopic(topic);
                                        setShowAutomationModal(true);
                                    }}
                                    onDelete={handleDeleteTopic}
                                    deletingTopicId={deleteTopicAsync.isLoading ? (deleteTopicAsync as any).args?.[0] : null}
                                />
                            ) : (
                                <EmptyState
                                    title={t('automation_no_topics') || 'No routing rules defined'}
                                    description={t('automation_no_topics_desc') || 'Define your first routing topic to start automating your data pipeline.'}
                                    icon={<span className="text-3xl">🧭</span>}
                                    className="py-10"
                                />
                            )}
                        </div>

                        {/* Queue & History Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                            <AutomationQueueManager
                                queue={automationQueue.map(item => ({
                                    ...item,
                                    payloadPreview: item.payloadPreview,
                                    topicId: topicMap.get(item.topicId)?.title || item.topicId
                                }))}
                                isDispatching={isDispatchingAutomation}
                                onDispatch={handleDispatchAutomation}
                                onPreview={setPreviewQueueItem}
                                onProcess={handleProcessQueueItem}
                                processingId={processAsync.isLoading ? (processAsync as any).args?.[0] + (processAsync as any).args?.[1] : null}
                                formatTimeAgo={formatTimeAgo}
                                t={t}
                            />

                            <div className="border border-border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                                        🕒 {t('automation_history_heading') || 'Delivery History'}
                                    </h4>
                                    <span className="text-xs text-muted-foreground">{(advanced.publisherHistory || []).length} items</span>
                                </div>
                                {automationHistory.length > 0 ? (
                                    <div className="space-y-3">
                                        {automationHistory.slice(0, 5).map(entry => {
                                            const topic = topicMap.get(entry.topicId);
                                            const publisher = publisherMap[entry.publisherId];
                                            return (
                                                <div key={entry.id} className="border border-border rounded-lg p-3 bg-secondary/5">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <p className="font-semibold text-foreground text-xs line-clamp-1 flex-1">{entry.payloadPreview}</p>
                                                        <StatusBadge
                                                            status={entry.status === 'sent' ? 'success' : 'error'}
                                                            label={entry.status === 'sent' ? 'Sent' : 'Failed'}
                                                            size="sm"
                                                        />
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                                        <span>
                                                            {topic?.title || entry.topicId} → {publisher?.name || entry.publisherId}
                                                        </span>
                                                        <span>{formatTimeAgo(entry.sentAt)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {automationHistory.length > 5 && (
                                            <ActionButton variant="ghost" size="sm" className="w-full text-xs">
                                                {t('view_full_history') || 'View Full History'}
                                            </ActionButton>
                                        )}
                                    </div>
                                ) : (
                                    <EmptyState
                                        title={t('no_history') || 'No history yet'}
                                        description={t('no_history_desc') || 'Successful deliveries will appear here.'}
                                        icon={<span className="text-2xl">⏳</span>}
                                        className="py-10"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Modals */}
                        {showAutomationModal && automation && (
                            <AutomationTopicModal
                                topic={editingTopic}
                                agents={agents}
                                isLoadingAgents={isLoadingAgents}
                                categories={dataHub.categories}
                                dataTypes={availableDataTypes}
                                publishers={advanced.telegramPublishers}
                                isSaving={saveTopicAsync.isLoading}
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
                                record={normalizedRecordMap.get(previewQueueItem.recordId) || null}
                                agent={agentMap[previewQueueItem.agentId]}
                                onClose={() => setPreviewQueueItem(null)}
                                onPublish={() => handleProcessQueueItem(previewQueueItem.id, 'sent')}
                                t={t}
                                processingId={processAsync.isLoading ? (processAsync as any).args?.[0] : null}
                            />
                        )}
                    </>
                )}
            </div>
        </ApiWrapper>
    );
};

export default AutomationTopics;
