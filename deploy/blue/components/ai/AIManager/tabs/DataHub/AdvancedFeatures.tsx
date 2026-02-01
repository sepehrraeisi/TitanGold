import React, { useState, useMemo } from 'react';
import * as api from '../../../../../services/api.ts';
import {
    DataHubState,
    AIAgent,
    TelegramPublisher,
    AgentTopicRoute,
    PublisherQueueItem,
    NormalizedDataRecord,
    DataPipelineSourceSnapshot,
    DataPipelineCategorySnapshot,
    AgentTopicFormValues,
} from '../../../../../types.ts';
import WebCrawlerModal from './modals/WebCrawlerModal.tsx';
import TelegramPublisherModal from './modals/TelegramPublisherModal.tsx';
import AccessControlModal from './modals/AccessControlModal.tsx';
import AutomationTopicModal from './modals/AutomationTopicModal.tsx';
import QueuePreviewModal from './modals/QueuePreviewModal.tsx';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        {children}
    </div>
);

const AdvancedFeatures: React.FC<{
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    agents: AIAgent[];
    isLoadingAgents: boolean;
}> = ({ dataHub, setDataHub, onRefresh, t, formatTimeAgo, agents, isLoadingAgents }) => {
    const [activeFeature, setActiveFeature] = useState<'crawlers' | 'discovery' | 'prioritization' | 'access' | 'blacklist' | 'archive' | 'telegram' | 'automation'>('crawlers');
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingCrawler, setIsSavingCrawler] = useState(false);
    const [isDeletingCrawler, setIsDeletingCrawler] = useState<string | null>(null);
    const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);
    const [isRunningPrioritization, setIsRunningPrioritization] = useState(false);
    const [isSavingAccess, setIsSavingAccess] = useState(false);
    const [showCrawlerModal, setShowCrawlerModal] = useState(false);
    const [showPublisherModal, setShowPublisherModal] = useState(false);
    const [editingCrawler, setEditingCrawler] = useState<any>(null);
    const [editingPublisher, setEditingPublisher] = useState<any>(null);
    const [editingAccessControl, setEditingAccessControl] = useState<string | null>(null);
    const [accessFilter, setAccessFilter] = useState('');
    const [blacklistSearch, setBlacklistSearch] = useState('');
    const [whitelistSearch, setWhitelistSearch] = useState('');
    const [showAutomationModal, setShowAutomationModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<AgentTopicRoute | null>(null);
    const [isSavingTopic, setIsSavingTopic] = useState(false);
    const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
    const [processingQueueId, setProcessingQueueId] = useState<string | null>(null);
    const [isRefreshingAutomation, setIsRefreshingAutomation] = useState(false);
    const [previewQueueItem, setPreviewQueueItem] = useState<PublisherQueueItem | null>(null);
    const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
    const [isDispatchingAutomation, setIsDispatchingAutomation] = useState(false);
    
    const advanced = dataHub.advanced || {
        webCrawlers: [],
        autoDiscovery: { enabled: false, rules: [], discoveredSources: [] },
        smartPrioritization: { enabled: false, rules: [] },
        accessControl: [],
        blacklist: { sources: [], patterns: [], reasons: {} },
        whitelist: { sources: [], patterns: [] },
        archives: [],
        telegramPublishers: [],
    };
    const automation = advanced.automation;
    const agentMap = useMemo<Record<string, AIAgent>>(() => {
        const map: Record<string, AIAgent> = {};
        agents.forEach(agent => {
            map[agent.id] = agent;
        });
        return map;
    }, [agents]);
    const publisherMap = useMemo<Record<string, TelegramPublisher>>(() => {
        return advanced.telegramPublishers.reduce<Record<string, TelegramPublisher>>((acc, publisher) => {
            acc[publisher.id] = publisher;
            return acc;
        }, {} as Record<string, TelegramPublisher>);
    }, [advanced.telegramPublishers]);
    const availableDataTypes = useMemo(() => {
        const types = new Set<string>();
        dataHub.categories.forEach(category => {
            category.dataTypes.forEach(type => types.add(type));
        });
        return Array.from(types);
    }, [dataHub.categories]);
    const automationSummary = useMemo(() => {
        if (!automation) {
            return null;
        }
        const totalTopics = automation.agentTopics.length;
        if (totalTopics === 0) {
            return { totalTopics: 0, enabledTopics: 0, linkedPublishers: 0, avgPassRate: 0 };
        }
        const enabledTopics = automation.agentTopics.filter(topic => topic.enabled).length;
        const linkedPublishers = new Set(
            automation.agentTopics.flatMap(topic => topic.publisherTargets || []),
        ).size;
        const avgPassRate =
            automation.agentTopics.reduce((sum, topic) => sum + (topic.stats?.last24h.passRate || 0), 0) / totalTopics;
        return {
            totalTopics,
            enabledTopics,
            linkedPublishers,
            avgPassRate: Number(avgPassRate.toFixed(1)),
        };
    }, [automation]);
    const topicMap = useMemo(() => {
        const map = new Map<string, AgentTopicRoute>();
        (automation?.agentTopics || []).forEach(topic => map.set(topic.id, topic));
        return map;
    }, [automation?.agentTopics]);
    const automationQueue = advanced.publisherQueue || [];
    const automationHistory = advanced.publisherHistory || [];
    const normalizedRecordMap = useMemo(() => {
        const map = new Map<string, NormalizedDataRecord>();
        (dataHub.normalizedData || []).forEach(record => map.set(record.id, record));
        return map;
    }, [dataHub.normalizedData]);
    const pipelineSnapshot = dataHub.pipelineSnapshot;
    const normalizationSummary: any = dataHub.normalizationSummary;
    
    const sourceQualityMap = useMemo<Record<string, DataPipelineSourceSnapshot>>(() => {
        if (!pipelineSnapshot?.sources?.length) {
            return {};
        }
        return pipelineSnapshot.sources.reduce((acc, snapshot) => {
            acc[snapshot.sourceId] = snapshot;
            return acc;
        }, {} as Record<string, DataPipelineSourceSnapshot>);
    }, [pipelineSnapshot?.sources]);
    
    const categoryQualityMap = useMemo<Record<string, DataPipelineCategorySnapshot>>(() => {
        if (!pipelineSnapshot?.categories?.length) {
            return {};
        }
        return pipelineSnapshot.categories.reduce((acc, category) => {
            acc[category.categoryId] = category;
            return acc;
        }, {} as Record<string, DataPipelineCategorySnapshot>);
    }, [pipelineSnapshot?.categories]);
    
    const categoryQualityByName = useMemo<Record<string, DataPipelineCategorySnapshot>>(() => {
        if (!pipelineSnapshot?.categories?.length) {
            return {};
        }
        return pipelineSnapshot.categories.reduce((acc, category) => {
            acc[category.name.toLowerCase()] = category;
            return acc;
        }, {} as Record<string, DataPipelineCategorySnapshot>);
    }, [pipelineSnapshot?.categories]);
    
    const findCategorySignal = (categoryKey: string) => {
        if (!categoryKey) return undefined;
        return categoryQualityMap[categoryKey] || categoryQualityByName[categoryKey.toLowerCase()];
    };
    
    const flaggedSources = useMemo(() => {
        if (!pipelineSnapshot?.sources) return [];
        return pipelineSnapshot.sources.filter(
            snapshot => snapshot.lastStatus === 'failed' || (snapshot.issues?.length ?? 0) > 0
        );
    }, [pipelineSnapshot?.sources]);
    
    const pipelinePassRate = useMemo(() => {
        if (!pipelineSnapshot || pipelineSnapshot.totalRequests24h === 0) return null;
        return ((pipelineSnapshot.passed24h / pipelineSnapshot.totalRequests24h) * 100).toFixed(1);
    }, [pipelineSnapshot]);
    
    const getStatusBadgeClass = (status?: string) => {
        switch (status) {
            case 'failed':
                return 'bg-red-500/20 text-red-300';
            case 'timeout':
                return 'bg-yellow-500/20 text-yellow-300';
            case 'cached':
                return 'bg-blue-500/20 text-blue-300';
            case 'success':
            default:
                return 'bg-green-500/20 text-green-300';
        }
    };

    const discoverySummary = useMemo(() => ({
        totalRules: advanced.autoDiscovery.rules.length,
        targets: advanced.autoDiscovery.rules.reduce<Record<string, number>>((acc, rule) => {
            acc[rule.priority] = (acc[rule.priority] || 0) + 1;
            return acc;
        }, {}),
        lastScan: advanced.autoDiscovery.lastScan,
    }), [advanced.autoDiscovery]);

    const prioritizationSummary = useMemo(() => ({
        totalRules: advanced.smartPrioritization.rules.length,
        lastUpdate: advanced.smartPrioritization.lastUpdate,
    }), [advanced.smartPrioritization]);
    
    const handleAddCrawler = () => {
        setEditingCrawler(null);
        setShowCrawlerModal(true);
    };
    
    const handleSaveCrawler = async (crawlerData: any) => {
        setIsSavingCrawler(true);
        try {
            if (editingCrawler) {
                await api.updateWebCrawler(editingCrawler.id, crawlerData);
            } else {
                await api.createWebCrawler(crawlerData);
            }
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
            setShowCrawlerModal(false);
            setEditingCrawler(null);
        } catch (e) {
            alert(t('save_failed') || 'Failed to save crawler');
        } finally {
            setIsSavingCrawler(false);
        }
    };
    
    const handleDeleteCrawler = async (crawlerId: string) => {
        const confirmed = window.confirm(t('confirm_delete') || 'Are you sure?');
        if (confirmed) {
            setIsDeletingCrawler(crawlerId);
            try {
                await api.deleteWebCrawler(crawlerId);
                const updated = await api.fetchDataHubState();
                setDataHub(updated);
                onRefresh();
            } catch (e) {
                alert(t('delete_failed') || 'Failed to delete');
            } finally {
                setIsDeletingCrawler(null);
            }
        }
    };
    
    const handleAddPublisher = () => {
        setEditingPublisher(null);
        setShowPublisherModal(true);
    };
    
    const [publisherSavingId, setPublisherSavingId] = useState<string | null>(null);
    const [publisherDeletingId, setPublisherDeletingId] = useState<string | null>(null);
    
    const handleSavePublisher = async (publisherData: any) => {
        setPublisherSavingId(editingPublisher?.id || 'new');
        try {
            if (editingPublisher) {
                await api.updateTelegramPublisher(editingPublisher.id, publisherData);
            } else {
                await api.createTelegramPublisher(publisherData);
            }
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
            setShowPublisherModal(false);
            setEditingPublisher(null);
        } catch (e) {
            alert(t('save_failed') || 'Failed to save publisher');
        } finally {
            setPublisherSavingId(null);
        }
    };
    
    const handleDeletePublisher = async (publisherId: string) => {
        const confirmed = window.confirm(t('confirm_delete') || 'Are you sure?');
        if (confirmed) {
            setPublisherDeletingId(publisherId);
            try {
                await api.deleteTelegramPublisher(publisherId);
                const updated = await api.fetchDataHubState();
                setDataHub(updated);
                onRefresh();
            } catch (e) {
                alert(t('delete_failed') || 'Failed to delete');
            } finally {
                setPublisherDeletingId(null);
            }
        }
    };
    
    const handleToggleAutoDiscovery = async (enabled: boolean) => {
        setIsLoading(true);
        try {
            const updated = await api.setAutoDiscoveryEnabled(enabled);
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            alert(t('update_failed') || 'Failed to update');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleToggleSmartPrioritization = async (enabled: boolean) => {
        setIsLoading(true);
        try {
            const updated = await api.setSmartPrioritizationEnabled(enabled);
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            alert(t('update_failed') || 'Failed to update');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRemoveFromBlacklist = async (sourceId: string) => {
        setIsLoading(true);
        try {
            await api.removeFromBlacklist(sourceId);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            alert(t('update_failed') || 'Failed to remove');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRemoveFromWhitelist = async (sourceId: string) => {
        setIsLoading(true);
        try {
            await api.removeFromWhitelist(sourceId);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            alert(t('update_failed') || 'Failed to remove');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAddToBlacklist = async (sourceId: string) => {
        setIsLoading(true);
        try {
            await api.addToBlacklist(sourceId, 'Manual addition');
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            alert(t('update_failed') || 'Failed to add');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAddToWhitelist = async (sourceId: string) => {
        setIsLoading(true);
        try {
            await api.addToWhitelist(sourceId);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            alert(t('update_failed') || 'Failed to add');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveTopic = async (topicValues: AgentTopicFormValues) => {
        setIsSavingTopic(true);
        try {
            const payload = {
                ...topicValues,
                agentName: agentMap[topicValues.agentId]?.name || topicValues.agentName || topicValues.agentId,
                tags: topicValues.tags || [],
                publisherTargets: topicValues.publisherTargets || [],
            };
            if (editingTopic) {
                await api.updateAgentTopicRoute(editingTopic.id, payload);
            } else {
                await api.createAgentTopicRoute(payload);
            }
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
            setShowAutomationModal(false);
            setEditingTopic(null);
        } catch (e) {
            console.error('Failed to save automation topic:', e);
            alert(t('save_failed') || 'Failed to save automation topic');
        } finally {
            setIsSavingTopic(false);
        }
    };

    const handleDeleteTopic = async (topicId: string) => {
        const confirmMessage = t('automation_topic_delete_confirm') || 'Delete this routing entry?';
        if (!window.confirm(confirmMessage)) {
            return;
        }
        setDeletingTopicId(topicId);
        try {
            await api.deleteAgentTopicRoute(topicId);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            console.error('Failed to delete automation topic:', e);
            alert(t('delete_failed') || 'Failed to delete automation topic');
        } finally {
            setDeletingTopicId(null);
        }
    };

    const handleProcessQueueItem = async (queueId: string, result: 'sent' | 'failed') => {
        setProcessingQueueId(queueId + result);
        try {
            const updated = await api.simulatePublisherDispatch(queueId, result);
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            console.error('Failed to process queue item:', e);
            alert(t('automation_queue_action_failed') || 'Failed to update queue item');
        } finally {
            setProcessingQueueId(null);
        }
    };

    const handleRefreshAutomation = async () => {
        setIsRefreshingAutomation(true);
        try {
            const updated = await api.refreshAutomationQueue();
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            console.error('Failed to refresh automation queue:', e);
            alert(t('automation_refresh_failed') || 'Failed to refresh automation state');
        } finally {
            setIsRefreshingAutomation(false);
        }
    };

    const handleDispatchAutomation = async () => {
        setIsDispatchingAutomation(true);
        try {
            const updated = await api.dispatchAutomationQueue();
            setDataHub(updated);
            onRefresh();
            alert(t('automation_dispatch_success') || 'Automation queue processed.');
        } catch (e) {
            console.error('Failed to dispatch automation queue:', e);
            alert(t('automation_dispatch_failed') || 'Failed to dispatch automation queue');
        } finally {
            setIsDispatchingAutomation(false);
        }
    };

    const handleToggleSchedule = async (enabled: boolean) => {
        setIsUpdatingSchedule(true);
        try {
            const updated = await api.setAutomationScheduleEnabled(enabled);
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            console.error('Failed to update schedule:', e);
            alert(t('automation_schedule_update_failed') || 'Failed to update schedule');
        } finally {
            setIsUpdatingSchedule(false);
        }
    };

    const handleUpdateScheduleInterval = async (intervalMinutes: number) => {
        setIsUpdatingSchedule(true);
        try {
            const updated = await api.setAutomationScheduleInterval(intervalMinutes);
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            console.error('Failed to update schedule interval:', e);
            alert(t('automation_schedule_update_failed') || 'Failed to update schedule');
        } finally {
            setIsUpdatingSchedule(false);
        }
    };

    const handleUpdateScheduleMaxItems = async (maxItems: number) => {
        setIsUpdatingSchedule(true);
        try {
            const updated = await api.setAutomationScheduleMaxItems(maxItems);
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            console.error('Failed to update schedule max items:', e);
            alert(t('automation_schedule_update_failed') || 'Failed to update schedule');
        } finally {
            setIsUpdatingSchedule(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="flex gap-2 flex-wrap border-b border-border pb-2">
                {[
                    { id: 'crawlers', label: t('web_crawlers') || 'Web Crawlers' },
                    { id: 'discovery', label: t('auto_discovery') || 'Auto Discovery' },
                    { id: 'prioritization', label: t('smart_prioritization') || 'Smart Prioritization' },
                    { id: 'access', label: t('access_control') || 'Access Control' },
                    { id: 'blacklist', label: t('blacklist_whitelist') || 'Blacklist/Whitelist' },
                    { id: 'automation', label: t('automation_routing') || 'Automation' },
                    { id: 'archive', label: t('data_archiving') || 'Data Archiving' },
                    { id: 'telegram', label: t('telegram_publisher') || 'Telegram Publisher' },
                ].map(feature => (
                    <button
                        key={feature.id}
                        onClick={() => setActiveFeature(feature.id as any)}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            activeFeature === feature.id ? 'bg-purple-600 text-white' : 'bg-secondary text-muted-foreground hover:bg-accent'
                        }`}
                    >
                        {feature.label}
                    </button>
                ))}
            </div>
            
            {(pipelineSnapshot || normalizationSummary) ? (
                <Card className="bg-secondary/30 border-dashed border-purple-500/30">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                        <div>
                            <h3 className="font-semibold text-foreground">{t('pipeline_signals_heading') || 'Pipeline Signals'}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t('pipeline_signals_desc') || 'Normalized data and screening metrics feeding Advanced Features.'}
                            </p>
                        </div>
                        {pipelineSnapshot?.lastRefreshed && (
                            <p className="text-xs text-muted-foreground">
                                {t('pipeline_signal_last_refresh') || 'Last refresh'}: {formatTimeAgo(pipelineSnapshot.lastRefreshed)}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="bg-background/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('pipeline_signal_pass_rate') || 'Pass rate (24h)'}</p>
                            <p className="text-foreground text-2xl font-semibold">
                                {pipelinePassRate ? `${pipelinePassRate}%` : '—'}
                            </p>
                        </div>
                        <div className="bg-background/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('pipeline_signal_quality_warnings') || 'Warnings & rejects'}</p>
                            <p className="text-foreground text-2xl font-semibold">
                                {normalizationSummary ? normalizationSummary.warnings + normalizationSummary.rejected : '—'}
                            </p>
                            {normalizationSummary?.lastProcessedAt && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {t('normalized_last_processed') || 'Last processed'}: {formatTimeAgo(normalizationSummary.lastProcessedAt)}
                                </p>
                            )}
                        </div>
                        <div className="bg-background/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('pipeline_signal_flagged_sources') || 'Flagged sources'}</p>
                            <p className="text-foreground text-2xl font-semibold">{flaggedSources.length}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                {flaggedSources.length > 0
                                    ? flaggedSources.slice(0, 3).map(source => source.name).join(', ')
                                    : t('pipeline_signal_none') || 'No alerts'}
                            </p>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card className="bg-secondary/20 border-dashed border-border text-xs text-muted-foreground">
                    {t('pipeline_signal_empty') || 'No pipeline snapshot yet. Refresh Data Pipeline tab to start linking signals.'}
                </Card>
            )}
            
            {activeFeature === 'crawlers' && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('web_crawlers') || 'Web Crawlers'}</h3>
                        <button 
                            onClick={handleAddCrawler}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('add_crawler') || '+ Add Crawler'}
                        </button>
                    </div>
                    {advanced.webCrawlers.length > 0 ? (
                        <div className="space-y-3">
                            {advanced.webCrawlers.map(crawler => {
                                const sourceSignal = crawler.sourceId ? sourceQualityMap[crawler.sourceId] : undefined;
                                return (
                                <div key={crawler.id} className="border border-border rounded-lg p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-semibold">{crawler.name}</h4>
                                            <p className="text-xs text-muted-foreground break-words">{crawler.url}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t('interval') || 'Interval'}: {crawler.interval}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className={`px-2 py-1 rounded text-xs ${crawler.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                {crawler.enabled ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setEditingCrawler(crawler);
                                                    setShowCrawlerModal(true);
                                                }}
                                                disabled={isSavingCrawler || Boolean(isDeletingCrawler)}
                                                className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded"
                                            >
                                                {t('edit') || 'Edit'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCrawler(crawler.id)}
                                                disabled={isDeletingCrawler === crawler.id || isSavingCrawler}
                                                className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded"
                                            >
                                                {isDeletingCrawler === crawler.id ? (t('deleting') || 'Deleting...') : (t('delete') || 'Delete')}
                                            </button>
                                        </div>
                                    </div>
                                    {sourceSignal && (
                                        <div className="mt-3 bg-secondary/30 rounded p-2 text-[11px] text-muted-foreground">
                                            <p className="uppercase tracking-wide text-purple-300 text-[10px]">
                                                {t('pipeline_signal_badge') || 'Pipeline signal'}
                                            </p>
                                            <div className="flex flex-wrap gap-3 mt-1">
                                                <span className="flex items-center gap-1">
                                                    {t('pipeline_signal_last_status') || 'Last status'}:
                                                    <span className={`px-2 py-0.5 rounded-full font-semibold ${getStatusBadgeClass(sourceSignal.lastStatus)}`}>
                                                        {t(`log_status_${sourceSignal.lastStatus}` as any) || t(sourceSignal.lastStatus as any) || sourceSignal.lastStatus}
                                                    </span>
                                                </span>
                                                {typeof sourceSignal.lastResponseTime === 'number' && (
                                                    <span>{t('pipeline_signal_last_response') || 'Response'}: {sourceSignal.lastResponseTime} ms</span>
                                                )}
                                                <span>
                                                    {t('pipeline_signal_last_checked') || 'Checked'}:{' '}
                                                    {sourceSignal.lastChecked ? formatTimeAgo(sourceSignal.lastChecked) : t('never') || 'Never'}
                                                </span>
                                                {sourceSignal.issues && sourceSignal.issues.length > 0 && (
                                                    <span>{t('pipeline_signal_issues') || 'Issues'}: {sourceSignal.issues.join(', ')}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-10">{t('no_crawlers') || 'No web crawlers configured'}</p>
                    )}
                </Card>
            )}
            
            {activeFeature === 'discovery' && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('auto_discovery') || 'Auto Discovery'}</h3>
                        <div className="flex gap-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input 
                                    type="checkbox" 
                                    checked={advanced.autoDiscovery.enabled} 
                                    onChange={(e) => handleToggleAutoDiscovery(e.target.checked)}
                                    className="rounded" 
                                />
                                {t('enable') || 'Enable'}
                            </label>
                            <button
                                onClick={async () => {
                                    setIsRunningDiscovery(true);
                                    try {
                                        const discovered = await api.runAutoDiscovery();
                                        alert(t('discovery_complete') || `Found ${discovered.length} sources`);
                                        onRefresh();
                                    } catch (e) {
                                        alert(t('discovery_failed') || 'Discovery failed');
                                    } finally {
                                        setIsRunningDiscovery(false);
                                    }
                                }}
                                disabled={isRunningDiscovery || !advanced.autoDiscovery.enabled}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                            >
                                {isRunningDiscovery ? t('discovering') || 'Discovering...' : t('run_discovery') || 'Run Discovery'}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground">{t('rules') || 'Rules'}</p>
                            <p className="text-xl font-semibold text-foreground">{discoverySummary.totalRules}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground">{t('discovered_sources') || 'Discovered sources'}</p>
                            <p className="text-xl font-semibold text-foreground">{advanced.autoDiscovery.discoveredSources.length}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground">{t('last_scan') || 'Last scan'}</p>
                            <p className="text-[11px] text-foreground">{discoverySummary.lastScan ? formatTimeAgo(discoverySummary.lastScan) : t('never') || 'Never'}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground">{t('priority_breakdown') || 'Priority breakdown'}</p>
                            <p className="text-[11px] text-foreground">
                                {Object.entries(discoverySummary.targets).map(([priority, count]) => (
                                    <span key={priority} className="inline-block mr-2">{priority}: {count}</span>
                                ))}
                            </p>
                        </div>
                    </div>
                    {advanced.autoDiscovery.discoveredSources.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                            {advanced.autoDiscovery.discoveredSources.slice(0, 5).map(source => (
                                <div key={source.id} className="border border-border rounded p-3">
                                    <p className="font-semibold text-foreground">{source.name}</p>
                                    <p className="text-muted-foreground">{source.url}</p>
                                    <p className="text-muted-foreground text-[11px] mt-1">{source.category}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">{t('discovered_sources_empty') || 'No sources found yet.'}</p>
                    )}
                    {advanced.autoDiscovery.rules.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-sm font-semibold mb-2">{t('discovery_rules') || 'Discovery Rules'}</h4>
                            <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                                {advanced.autoDiscovery.rules.map(rule => {
                                    const categorySignal = findCategorySignal(rule.category);
                                    return (
                                        <div key={rule.id} className="border border-border rounded p-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-foreground">{rule.name}</p>
                                                    <p className="text-muted-foreground break-words">{rule.pattern}</p>
                                                </div>
                                                <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                                                    {rule.priority}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-2">
                                                {t('last_check') || 'Last check'}: {rule.lastCheck ? formatTimeAgo(rule.lastCheck) : t('never') || 'Never'} • {t('discovered_count') || 'Found'}: {rule.discoveredCount}
                                            </p>
                                            {categorySignal && (
                                                <p className="text-[11px] text-muted-foreground mt-1">
                                                    {t('pipeline_signal_category_pass_rate') || 'Category pass rate'}: {categorySignal.passRate.toFixed(1)}% • {t('pipeline_signal_inflow_24h') || 'Inflow'}: {categorySignal.inflow}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </Card>
            )}
            
            {activeFeature === 'prioritization' && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('smart_prioritization') || 'Smart Prioritization'}</h3>
                        <div className="flex gap-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input 
                                    type="checkbox" 
                                    checked={advanced.smartPrioritization.enabled} 
                                    onChange={(e) => handleToggleSmartPrioritization(e.target.checked)}
                                    className="rounded" 
                                />
                                {t('enable') || 'Enable'}
                            </label>
                            <button
                                onClick={async () => {
                                    setIsRunningPrioritization(true);
                                    try {
                                        await api.calculateSourcePriorities();
                                        alert(t('priorities_updated') || 'Priorities updated');
                                        onRefresh();
                                    } catch (e) {
                                        alert(t('update_failed') || 'Update failed');
                                    } finally {
                                        setIsRunningPrioritization(false);
                                    }
                                }}
                                disabled={isRunningPrioritization || !advanced.smartPrioritization.enabled}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                            >
                                {isRunningPrioritization ? t('calculating') || 'Calculating...' : t('calculate_priorities') || 'Calculate'}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {advanced.smartPrioritization.rules.slice(0, 10).map(rule => {
                            const source = dataHub.sources.find(s => s.id === rule.sourceId);
                            const sourceSignal = sourceQualityMap[rule.sourceId];
                            return (
                                <div key={rule.sourceId} className="border border-border rounded p-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="font-semibold">{source?.name || rule.sourceId}</span>
                                        <span className="text-purple-400">{rule.calculatedPriority.toFixed(1)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t('priority_factors') || 'Factors'}:
                                        {Object.entries(rule.factors).map(([key, weight]) => (
                                            <span key={key} className="inline-block ml-2">
                                                {t(key) || key}: {(weight * 100).toFixed(0)}%
                                            </span>
                                        ))}
                                    </p>
                                    {sourceSignal && (
                                        <div className="text-[11px] text-muted-foreground mt-2 flex flex-wrap gap-3">
                                            <span className="flex items-center gap-1">
                                                {t('pipeline_signal_last_status') || 'Last status'}:
                                                <span className={`px-2 py-0.5 rounded-full font-semibold ${getStatusBadgeClass(sourceSignal.lastStatus)}`}>
                                                    {t(`log_status_${sourceSignal.lastStatus}` as any) || t(sourceSignal.lastStatus as any) || sourceSignal.lastStatus}
                                                </span>
                                            </span>
                                            {typeof sourceSignal.lastResponseTime === 'number' && (
                                                <span>{t('pipeline_signal_last_response') || 'Response'}: {sourceSignal.lastResponseTime} ms</span>
                                            )}
                                            <span>
                                                {t('pipeline_signal_last_checked') || 'Checked'}:{' '}
                                                {sourceSignal.lastChecked ? formatTimeAgo(sourceSignal.lastChecked) : t('never') || 'Never'}
                                            </span>
                                            {sourceSignal.issues && sourceSignal.issues.length > 0 && (
                                                <span>{t('pipeline_signal_issues') || 'Issues'}: {sourceSignal.issues.join(', ')}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {advanced.smartPrioritization.rules.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-3">{t('prioritization_rules_empty') || 'No prioritization rules available.'}</p>
                    )}
                </Card>
            )}
            
            {activeFeature === 'access' && (
                <Card>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <div>
                            <h3 className="font-semibold text-foreground">{t('access_control') || 'Access Control'}</h3>
                            <p className="text-xs text-muted-foreground">{t('access_control_desc') || 'Manage rate limits and whitelisted agents per source.'}</p>
                        </div>
                        <input
                            value={accessFilter}
                            onChange={e => setAccessFilter(e.target.value)}
                            placeholder={t('access_filter_placeholder') || 'Filter sources or categories'}
                            className="px-3 py-2 bg-background border border-border rounded text-xs"
                        />
                    </div>
                    <div className="space-y-3">
                        {dataHub.sources
                            .filter(source => {
                                if (!accessFilter.trim()) return true;
                                const query = accessFilter.trim().toLowerCase();
                                return (
                                    source.name.toLowerCase().includes(query) ||
                                    source.category.toLowerCase().includes(query) ||
                                    source.tags.some(tag => tag.toLowerCase().includes(query))
                                );
                            })
                            .map(source => {
                            const control = advanced.accessControl.find(ac => ac.sourceId === source.id);
                            const sourceSignal = sourceQualityMap[source.id];
                            return (
                                <div key={source.id} className="border border-border rounded-lg p-4">
                                    <div className="flex justify-between">
                                        <div>
                                            <h4 className="font-semibold">{source.name}</h4>
                                            <p className="text-xs text-muted-foreground">
                                                {control ? `${t('allowed_agents') || 'Allowed'}: ${control.allowedAgents.length || t('all') || 'All'}` : t('no_restrictions') || 'No restrictions'}
                                            </p>
                                            {control && (
                                                <div className="text-[11px] text-muted-foreground mt-1 space-x-2">
                                                    {control.maxRequestsPerMinute && (
                                                        <span>{t('rate_limit_min') || 'Per minute'}: {control.maxRequestsPerMinute}</span>
                                                    )}
                                                    {control.maxRequestsPerDay && (
                                                        <span>{t('rate_limit_day') || 'Per day'}: {control.maxRequestsPerDay}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => setEditingAccessControl(source.id)}
                                            disabled={isSavingAccess}
                                            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded"
                                        >
                                            {isSavingAccess ? (t('saving') || 'Saving...') : (t('configure') || 'Configure')}
                                        </button>
                                    </div>
                                    {sourceSignal && (
                                        <div className="text-[11px] text-muted-foreground mt-2 flex flex-wrap gap-3">
                                            <span className="flex items-center gap-1">
                                                {t('pipeline_signal_last_status') || 'Last status'}:
                                                <span className={`px-2 py-0.5 rounded-full font-semibold ${getStatusBadgeClass(sourceSignal.lastStatus)}`}>
                                                    {t(`log_status_${sourceSignal.lastStatus}` as any) || t(sourceSignal.lastStatus as any) || sourceSignal.lastStatus}
                                                </span>
                                            </span>
                                            {typeof sourceSignal.lastResponseTime === 'number' && (
                                                <span>{t('pipeline_signal_last_response') || 'Response'}: {sourceSignal.lastResponseTime} ms</span>
                                            )}
                                            <span>
                                                {t('pipeline_signal_last_checked') || 'Checked'}:{' '}
                                                {sourceSignal.lastChecked ? formatTimeAgo(sourceSignal.lastChecked) : t('never') || 'Never'}
                                            </span>
                                            {sourceSignal.issues && sourceSignal.issues.length > 0 && (
                                                <span>{t('pipeline_signal_issues') || 'Issues'}: {sourceSignal.issues.join(', ')}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
            
            {activeFeature === 'blacklist' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <h3 className="font-semibold text-foreground mb-2">{t('blacklist') || 'Blacklist'}</h3>
                        <input
                            value={blacklistSearch}
                            onChange={e => setBlacklistSearch(e.target.value)}
                            placeholder={t('blacklist_search_placeholder') || 'Search by name or reason'}
                            className="w-full px-3 py-2 mb-3 bg-background border border-border rounded text-xs"
                        />
                        {advanced.blacklist.sources.length > 0 ? (
                            advanced.blacklist.sources
                                .filter(sourceId => {
                                    if (!blacklistSearch.trim()) return true;
                                    const query = blacklistSearch.trim().toLowerCase();
                                    const source = dataHub.sources.find(s => s.id === sourceId);
                                    const reason = advanced.blacklist.reasons[sourceId];
                                    return (
                                        (source?.name.toLowerCase().includes(query) ?? false) ||
                                        (reason?.toLowerCase().includes(query) ?? false)
                                    );
                                })
                                .map(sourceId => {
                                const source = dataHub.sources.find(s => s.id === sourceId);
                                const sourceSignal = sourceQualityMap[sourceId];
                                const reason = advanced.blacklist.reasons[sourceId];
                                return (
                                    <div key={sourceId} className="border border-red-500/20 bg-red-500/10 rounded p-2 text-sm mb-2">
                                        <div className="flex justify-between">
                                            <div>
                                                <span className="font-semibold block">{source?.name || sourceId}</span>
                                                {reason && <span className="text-[11px] text-red-300">{reason}</span>}
                                                {sourceSignal && (
                                                    <div className="text-[11px] text-red-200 mt-1 flex flex-wrap gap-2">
                                                        <span>{t('pipeline_signal_last_status') || 'Last status'}: {t(`log_status_${sourceSignal.lastStatus}` as any) || t(sourceSignal.lastStatus as any) || sourceSignal.lastStatus}</span>
                                                        {sourceSignal.lastChecked && (
                                                            <span>{t('pipeline_signal_last_checked') || 'Checked'}: {formatTimeAgo(sourceSignal.lastChecked)}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveFromBlacklist(sourceId)}
                                                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                            >
                                                {t('remove') || 'Remove'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-muted-foreground py-10">{t('no_blacklisted') || 'No blacklisted sources'}</p>
                        )}
                    </Card>
                    <Card>
                        <h3 className="font-semibold text-foreground mb-2">{t('whitelist') || 'Whitelist'}</h3>
                        <input
                            value={whitelistSearch}
                            onChange={e => setWhitelistSearch(e.target.value)}
                            placeholder={t('whitelist_search_placeholder') || 'Search by name or notes'}
                            className="w-full px-3 py-2 mb-3 bg-background border border-border rounded text-xs"
                        />
                        {advanced.whitelist.sources.length > 0 ? (
                            advanced.whitelist.sources
                                .filter(sourceId => {
                                    if (!whitelistSearch.trim()) return true;
                                    const query = whitelistSearch.trim().toLowerCase();
                                    const source = dataHub.sources.find(s => s.id === sourceId);
                                    const notes = source?.notes;
                                    return (
                                        (source?.name.toLowerCase().includes(query) ?? false) ||
                                        (notes?.toLowerCase().includes(query) ?? false)
                                    );
                                })
                                .map(sourceId => {
                                const source = dataHub.sources.find(s => s.id === sourceId);
                                const sourceSignal = sourceQualityMap[sourceId];
                                return (
                                    <div key={sourceId} className="border border-green-500/20 bg-green-500/10 rounded p-2 text-sm mb-2">
                                        <div className="flex justify-between">
                                            <span className="font-semibold">{source?.name || sourceId}</span>
                                            <button 
                                                onClick={() => handleRemoveFromWhitelist(sourceId)}
                                                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                            >
                                                {t('remove') || 'Remove'}
                                            </button>
                                        </div>
                                        {sourceSignal && (
                                            <div className="text-[11px] text-green-200 mt-1 flex flex-wrap gap-2">
                                                <span>{t('pipeline_signal_last_status') || 'Last status'}: {t(`log_status_${sourceSignal.lastStatus}` as any) || t(sourceSignal.lastStatus as any) || sourceSignal.lastStatus}</span>
                                                {sourceSignal.lastChecked && (
                                                    <span>{t('pipeline_signal_last_checked') || 'Checked'}: {formatTimeAgo(sourceSignal.lastChecked)}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-muted-foreground py-10">{t('no_whitelisted') || 'No whitelisted sources'}</p>
                        )}
                        <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="text-sm font-semibold mb-2">{t('add_source') || 'Add Source'}</h4>
                            <div className="flex gap-2 flex-wrap">
                                {dataHub.sources
                                    .filter(s => !advanced.blacklist.sources.includes(s.id) && !advanced.whitelist.sources.includes(s.id))
                                    .slice(0, 5)
                                    .map(source => (
                                        <button
                                            key={source.id}
                                            onClick={() => {
                                                const addToBlacklist = window.confirm(t('add_to_blacklist') || `Add ${source.name} to blacklist?`);
                                                if (addToBlacklist) {
                                                    handleAddToBlacklist(source.id);
                                                } else {
                                                    handleAddToWhitelist(source.id);
                                                }
                                            }}
                                            className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded"
                                        >
                                            {source.name}
                                        </button>
                                    ))}
                            </div>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground">{t('last_update') || 'Last update'}</p>
                            <p className="text-[11px] text-foreground">{prioritizationSummary.lastUpdate ? formatTimeAgo(prioritizationSummary.lastUpdate) : t('never') || 'Never'}</p>
                        </div>
                    </Card>
                </div>
            )}

            {activeFeature === 'automation' && (
                <Card>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <div>
                            <h3 className="font-semibold text-foreground">{t('automation_routing') || 'Automation Routing'}</h3>
                            <p className="text-xs text-muted-foreground">{t('automation_desc') || 'Map screened data streams to specialist agents and Telegram channels.'}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {automation?.lastSync
                                ? `${t('automation_last_sync') || 'Last sync'}: ${formatTimeAgo(automation.lastSync)}`
                                : t('automation_last_sync_never') || 'Not synced yet'}
                        </p>
                    </div>
                    {automation ? (
                        <>
                            {automationSummary && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 text-sm">
                                    <div className="bg-secondary/40 rounded p-3">
                                        <p className="text-muted-foreground text-xs">{t('automation_topics_total') || 'Topics'}</p>
                                        <p className="text-2xl font-semibold text-foreground">{automationSummary.totalTopics}</p>
                                    </div>
                                    <div className="bg-secondary/40 rounded p-3">
                                        <p className="text-muted-foreground text-xs">{t('automation_topics_enabled') || 'Enabled'}</p>
                                        <p className="text-2xl font-semibold text-foreground">{automationSummary.enabledTopics}</p>
                                    </div>
                                    <div className="bg-secondary/40 rounded p-3">
                                        <p className="text-muted-foreground text-xs">{t('automation_linked_publishers') || 'Linked publishers'}</p>
                                        <p className="text-2xl font-semibold text-foreground">{automationSummary.linkedPublishers}</p>
                                    </div>
                                    <div className="bg-secondary/40 rounded p-3">
                                        <p className="text-muted-foreground text-xs">{t('automation_avg_pass_rate') || 'Avg pass rate'}</p>
                                        <p className="text-2xl font-semibold text-foreground">
                                            {automationSummary.avgPassRate
                                                ? `${automationSummary.avgPassRate}%`
                                                : '—'}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {automation.schedule && (
                                <Card className="bg-secondary/20 border-purple-500/30 mb-4">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                                        <div>
                                            <h4 className="font-semibold text-foreground text-sm">{t('automation_schedule_heading') || 'Automatic Publishing Schedule'}</h4>
                                            <p className="text-xs text-muted-foreground">
                                                {t('automation_schedule_desc') || 'Automatically dispatch queue items at regular intervals.'}
                                            </p>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={automation.schedule.enabled}
                                                onChange={(e) => handleToggleSchedule(e.target.checked)}
                                                disabled={isUpdatingSchedule}
                                                className="rounded"
                                            />
                                            <span className={automation.schedule.enabled ? 'text-green-400' : 'text-muted-foreground'}>
                                                {automation.schedule.enabled
                                                    ? (t('automation_schedule_enabled') || 'Enabled')
                                                    : (t('automation_schedule_disabled') || 'Disabled')}
                                            </span>
                                        </label>
                                    </div>
                                    {automation.schedule.enabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    {t('automation_schedule_interval') || 'Interval'}
                                                </label>
                                                <select
                                                    value={automation.schedule.intervalMinutes}
                                                    onChange={(e) => handleUpdateScheduleInterval(Number(e.target.value))}
                                                    disabled={isUpdatingSchedule}
                                                    className="w-full px-3 py-2 bg-background border border-border rounded text-xs"
                                                >
                                                    <option value={1}>{t('automation_schedule_1min') || '1 minute'}</option>
                                                    <option value={5}>{t('automation_schedule_5min') || '5 minutes'}</option>
                                                    <option value={15}>{t('automation_schedule_15min') || '15 minutes'}</option>
                                                    <option value={30}>{t('automation_schedule_30min') || '30 minutes'}</option>
                                                    <option value={60}>{t('automation_schedule_1hour') || '1 hour'}</option>
                                                    <option value={120}>{t('automation_schedule_2hours') || '2 hours'}</option>
                                                    <option value={240}>{t('automation_schedule_4hours') || '4 hours'}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">
                                                    {t('automation_schedule_max_items') || 'Max items per run'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="50"
                                                    value={automation.schedule.maxItemsPerRun}
                                                    onChange={(e) => handleUpdateScheduleMaxItems(Number(e.target.value))}
                                                    disabled={isUpdatingSchedule}
                                                    className="w-full px-3 py-2 bg-background border border-border rounded text-xs"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1">
                                                    {t('automation_schedule_status') || 'Status'}
                                                </p>
                                                <div className="text-xs">
                                                    {automation.schedule.lastRun ? (
                                                        <p className="text-foreground">
                                                            {t('automation_schedule_last_run') || 'Last run'}: {formatTimeAgo(automation.schedule.lastRun)}
                                                        </p>
                                                    ) : (
                                                        <p className="text-muted-foreground">
                                                            {t('automation_schedule_never_run') || 'Not run yet'}
                                                        </p>
                                                    )}
                                                    {automation.schedule.nextRun && (
                                                        <p className="text-foreground mt-1">
                                                            {t('automation_schedule_next_run') || 'Next run'}: {formatTimeAgo(automation.schedule.nextRun)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            )}
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                                <h4 className="font-semibold text-foreground">{t('automation_topics') || 'Agent Topics'}</h4>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={handleRefreshAutomation}
                                        disabled={isRefreshingAutomation}
                                        className="bg-secondary/50 hover:bg-secondary text-xs px-3 py-2 rounded border border-border disabled:opacity-60 text-foreground"
                                    >
                                        {isRefreshingAutomation ? (t('refreshing') || 'Refreshing...') : (t('automation_refresh_queue') || 'Refresh automation')}
                                    </button>
                                    <button
                                        onClick={handleDispatchAutomation}
                                        disabled={isDispatchingAutomation || automationQueue.length === 0}
                                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 rounded disabled:opacity-60"
                                    >
                                        {isDispatchingAutomation ? (t('automation_dispatching') || 'Dispatching...') : (t('automation_dispatch_queue') || 'Dispatch queue')}
                                    </button>
                                    {isLoadingAgents && (
                                        <span className="text-xs text-muted-foreground">{t('automation_loading_agents') || 'Loading agents...'}</span>
                                    )}
                                    <button
                                        onClick={() => {
                                            setEditingTopic(null);
                                            setShowAutomationModal(true);
                                        }}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                                    >
                                        {t('automation_add_topic') || '+ Add Route'}
                                    </button>
                                </div>
                            </div>
                            {automation.agentTopics.length > 0 ? (
                                <div className="space-y-3">
                                    {automation.agentTopics.map(topic => {
                                        const agent = agentMap[topic.agentId];
                                        const stats = topic.stats?.last24h;
                                        const categoryNames = topic.categoryIds.map(catId => {
                                            const category = dataHub.categories.find(cat => cat.id === catId);
                                            return category?.name || catId;
                                        });
                                        const meetsPassRate =
                                            !topic.minPassRate || (stats?.passRate ?? 0) >= topic.minPassRate;
                                        const statusClass = !topic.enabled
                                            ? 'bg-gray-500/20 text-gray-300'
                                            : meetsPassRate
                                                ? 'bg-green-500/20 text-green-300'
                                                : 'bg-yellow-500/20 text-yellow-300';
                                        const statusLabel = !topic.enabled
                                            ? t('disabled') || 'Disabled'
                                            : meetsPassRate
                                                ? t('automation_topic_status_good') || 'Aligned'
                                                : t('automation_topic_status_attention') || 'Needs review';
                                        return (
                                            <div key={topic.id} className="border border-border rounded-lg p-4">
                                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h5 className="font-semibold text-foreground">{topic.title}</h5>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClass}`}>
                                                                {statusLabel}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {topic.description || ''}
                                                        </p>
                                                        <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-2">
                                                            <span>{agent?.name || topic.agentName || topic.agentId}</span>
                                                            <span>•</span>
                                                            <span>{t(topic.priority) || topic.priority}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingTopic(topic);
                                                                setShowAutomationModal(true);
                                                            }}
                                                            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                                                        >
                                                            {t('edit') || 'Edit'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTopic(topic.id)}
                                                            disabled={deletingTopicId === topic.id}
                                                            className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded"
                                                        >
                                                            {deletingTopicId === topic.id
                                                                ? (t('deleting') || 'Deleting...')
                                                                : (t('delete') || 'Delete')}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 text-xs">
                                                    <div>
                                                        <p className="text-muted-foreground">{t('automation_topic_categories') || 'Categories'}</p>
                                                        <p className="text-foreground font-semibold">{categoryNames.join(', ') || '-'}</p>
                                                        <p className="text-muted-foreground mt-1">{t('automation_topic_datatypes') || 'Data types'}: {topic.dataTypes.join(', ') || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">{t('automation_topic_requirements') || 'Requirements'}</p>
                                                        <p>
                                                            {t('automation_topic_min_pass_rate') || 'Min pass'}: {topic.minPassRate ? `${topic.minPassRate}%` : '—'}
                                                        </p>
                                                        <p>
                                                            {t('automation_topic_min_quality') || 'Min quality'}: {topic.minQualityScore ? `${topic.minQualityScore}` : '—'}
                                                        </p>
                                                        <p>
                                                            {t('automation_topic_statuses') || 'Statuses'}: {topic.includeStatuses.join(', ')}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">{t('automation_topic_stats') || 'Last 24h'}</p>
                                                        <p>{t('automation_inflow') || 'Inflow'}: {stats?.inflow ?? 0}</p>
                                                        <p>{t('automation_approved') || 'Approved'}: {stats?.approved ?? 0}</p>
                                                        <p>{t('automation_published') || 'Published'}: {stats?.published ?? 0}</p>
                                                        <p>{t('automation_pass_rate') || 'Pass rate'}: {stats?.passRate ? `${stats.passRate}%` : '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">{t('automation_topic_publishers') || 'Publishers'}</p>
                                                        <p>{topic.publisherTargets.length > 0
                                                            ? topic.publisherTargets.map(id => publisherMap[id]?.name || id).join(', ')
                                                            : t('automation_topic_publishers_none') || 'Not linked'}</p>
                                                        {topic.tags.length > 0 && (
                                                            <p className="text-muted-foreground mt-1">
                                                                {t('automation_topic_tags') || 'Tags'}: {topic.tags.join(', ')}
                                                            </p>
                                                        )}
                                                        {topic.lastEvaluated && (
                                                            <p className="text-muted-foreground mt-1">
                                                                {t('automation_topic_last_checked') || 'Evaluated'}: {formatTimeAgo(topic.lastEvaluated)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">{t('automation_no_topics') || 'No routing rules defined yet.'}</p>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                                <div className="border border-border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-foreground text-sm">{t('automation_queue_heading') || 'Publisher Queue'}</h4>
                                        <span className="text-xs text-muted-foreground">{automationQueue.length}</span>
                                    </div>
                                    {automationQueue.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-xs">
                                                <thead>
                                                    <tr className="text-left text-muted-foreground border-b border-border">
                                                        <th className="py-2 pr-3">{t('automation_queue_preview') || 'Preview'}</th>
                                                        <th className="py-2 pr-3">{t('automation_queue_topic') || 'Topic'}</th>
                                                        <th className="py-2 pr-3">{t('automation_queue_publisher') || 'Publisher'}</th>
                                                        <th className="py-2 pr-3">{t('automation_queue_quality') || 'Quality'}</th>
                                                        <th className="py-2 pr-3">{t('automation_queue_status') || 'Status'}</th>
                                                        <th className="py-2">{t('automation_queue_actions') || 'Actions'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {automationQueue.map(item => {
                                                        const topic = topicMap.get(item.topicId);
                                                        const publisher = publisherMap[item.publisherId];
                                                        const agentName = agentMap[item.agentId]?.name || item.agentId;
                                                        return (
                                                            <tr key={item.id} className="border-b border-border last:border-b-0">
                                                                <td className="py-2 pr-3">
                                                                    <p className="font-semibold text-foreground line-clamp-2">{item.payloadPreview}</p>
                                                                    <p className="text-[11px] text-muted-foreground">
                                                                        {item.category} • {item.dataType} • {t(`normalized_status_${item.normalizedStatus}`) || item.normalizedStatus}
                                                                    </p>
                                                                </td>
                                                                <td className="py-2 pr-3 text-xs">
                                                                    <p className="text-foreground font-semibold">{topic?.title || item.topicId}</p>
                                                                    <p className="text-muted-foreground">{agentName}</p>
                                                                </td>
                                                                <td className="py-2 pr-3 text-xs">
                                                                    <p className="text-foreground">{publisher?.name || item.publisherId}</p>
                                                                    <p className="text-muted-foreground">{publisher?.chatId}</p>
                                                                </td>
                                                                <td className="py-2 pr-3 text-xs">
                                                                    <p>{t('quality_score') || 'Quality'}: {item.qualityScore}</p>
                                                                    <p>{t('priority') || 'Priority'}: {t(item.priority) || item.priority}</p>
                                                                </td>
                                                                <td className="py-2 pr-3 text-xs">
                                                                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-semibold">{t('pending') || 'Pending'}</span>
                                                                </td>
                                                                <td className="py-2 text-xs">
                                                                    <div className="flex flex-col gap-2">
                                                                        <button
                                                                            onClick={() => setPreviewQueueItem(item)}
                                                                            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                                                                        >
                                                                            {t('automation_queue_preview_full') || 'Preview'}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleProcessQueueItem(item.id, 'sent')}
                                                                            disabled={processingQueueId === item.id + 'sent'}
                                                                            className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white"
                                                                        >
                                                                            {processingQueueId === item.id + 'sent' ? (t('processing') || 'Processing...') : (t('automation_queue_publish_now') || 'Publish now')}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleProcessQueueItem(item.id, 'failed')}
                                                                            disabled={processingQueueId === item.id + 'failed'}
                                                                            className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white"
                                                                        >
                                                                            {processingQueueId === item.id + 'failed' ? (t('processing') || 'Processing...') : (t('automation_queue_mark_failed') || 'Mark failed')}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">{t('automation_no_queue') || 'Queue is empty.'}</p>
                                    )}
                                </div>
                                <div className="border border-border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-foreground text-sm">{t('automation_history_heading') || 'Delivery History'}</h4>
                                        <span className="text-xs text-muted-foreground">{(advanced.publisherHistory || []).length}</span>
                                    </div>
                                    {automationHistory.length > 0 ? (
                                        <div className="space-y-3 text-xs">
                                            {automationHistory.slice(0, 6).map(entry => {
                                                const topic = topicMap.get(entry.topicId);
                                                const publisher = publisherMap[entry.publisherId];
                                                return (
                                                    <div key={entry.id} className="border border-border rounded p-2">
                                                        <div className="flex justify-between items-center">
                                                            <p className="font-semibold text-foreground line-clamp-1">{entry.payloadPreview}</p>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${entry.status === 'sent' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                                {entry.status === 'sent' ? (t('automation_history_sent') || 'Sent') : (t('automation_history_failed') || 'Failed')}
                                                            </span>
                                                        </div>
                                                        <p className="text-muted-foreground">
                                                            {topic?.title || entry.topicId} → {publisher?.name || entry.publisherId}
                                                        </p>
                                                        <p className="text-muted-foreground">{formatTimeAgo(entry.sentAt)}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">{t('automation_no_history') || 'No deliveries logged yet.'}</p>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('automation_missing_config') || 'Automation module not configured yet.'}</p>
                    )}
                </Card>
            )}
            
            {activeFeature === 'archive' && (
                <Card>
                    <h3 className="font-semibold text-foreground mb-4">{t('data_archiving') || 'Data Archiving'}</h3>
                    <div className="text-sm text-muted-foreground mb-4">
                        <p>{t('total_archives') || 'Total'}: {advanced.archives.length}</p>
                        <p>{t('used_for_backtest') || 'For Backtest'}: {advanced.archives.filter(a => a.usedForBacktest).length}</p>
                    </div>
                    <button
                        onClick={async () => {
                            try {
                                const archives = await api.getArchivedData();
                                alert(t('archives_loaded') || `Loaded ${archives.length} archives`);
                            } catch (e) {
                                alert(t('load_failed') || 'Failed');
                            }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {t('view_archives') || 'View Archives'}
                    </button>
                </Card>
            )}
            
            {activeFeature === 'telegram' && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('telegram_publisher') || 'Telegram Publisher'}</h3>
                        <button 
                            onClick={handleAddPublisher}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('add_publisher') || '+ Add Publisher'}
                        </button>
                    </div>
                    {advanced.telegramPublishers.length > 0 ? (
                        advanced.telegramPublishers.map(publisher => {
                            const filterAgents = publisher.filters?.agentIds?.map(id => agentMap[id]?.name || id) || [];
                            return (
                            <div key={publisher.id} className="border border-border rounded-lg p-4 mb-3">
                                <div className="flex justify-between">
                                    <div>
                                        <h4 className="font-semibold">{publisher.name}</h4>
                                        <p className="text-xs text-muted-foreground">{t('chat_id') || 'Chat'}: {publisher.chatId}</p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <span className={`px-2 py-1 rounded text-xs ${publisher.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                            {publisher.enabled ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                                        </span>
                                        <button
                                            onClick={() => {
                                                setEditingPublisher(publisher);
                                                setShowPublisherModal(true);
                                            }}
                                            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                                            disabled={publisherSavingId === publisher.id || publisherDeletingId === publisher.id}
                                        >
                                            {publisherSavingId === publisher.id ? (t('saving') || 'Saving...') : (t('edit') || 'Edit')}
                                        </button>
                                        <button
                                            onClick={() => handleDeletePublisher(publisher.id)}
                                            disabled={publisherDeletingId === publisher.id || publisherSavingId === publisher.id}
                                            className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded"
                                        >
                                            {publisherDeletingId === publisher.id ? (t('deleting') || 'Deleting...') : (t('delete') || 'Delete')}
                                        </button>
                                    </div>
                                </div>
                                {(publisher.filters?.sources?.length ||
                                    publisher.filters?.categories?.length ||
                                    filterAgents.length) && (
                                    <div className="mt-3 text-xs text-muted-foreground space-y-1">
                                        {publisher.filters?.sources?.length && (
                                            <p>
                                                {t('filter_sources') || 'Sources'}: {publisher.filters.sources.length}
                                            </p>
                                        )}
                                        {publisher.filters?.categories?.length && (
                                            <p>
                                                {t('filter_categories') || 'Categories'}: {publisher.filters.categories.length}
                                            </p>
                                        )}
                                        {filterAgents.length > 0 && (
                                            <p>
                                                {t('filter_agents') || 'Agents'}: {filterAgents.join(', ')}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-muted-foreground py-10">{t('no_publishers') || 'No publishers'}</p>
                    )}
                </Card>
            )}
            
            {/* Web Crawler Modal */}
            {showCrawlerModal && (
                <WebCrawlerModal
                    crawler={editingCrawler}
                    sources={dataHub.sources}
                    onClose={() => {
                        setShowCrawlerModal(false);
                        setEditingCrawler(null);
                    }}
                    onSave={handleSaveCrawler}
                    t={t}
                />
            )}
            
            {/* Telegram Publisher Modal */}
            {showPublisherModal && (
                <TelegramPublisherModal
                    publisher={editingPublisher}
                    sources={dataHub.sources}
                    categories={dataHub.categories}
                    agents={agents}
                    onClose={() => {
                        setShowPublisherModal(false);
                        setEditingPublisher(null);
                    }}
                    onSave={handleSavePublisher}
                    t={t}
                />
            )}
            
            {/* Access Control Modal */}
            {editingAccessControl && (
                <AccessControlModal
                    sourceId={editingAccessControl}
                    source={dataHub.sources.find(s => s.id === editingAccessControl)}
                    accessControl={advanced.accessControl.find(ac => ac.sourceId === editingAccessControl)}
                    onClose={() => setEditingAccessControl(null)}
                    onSave={async (controlData) => {
                        setIsSavingAccess(true);
                        try {
                            await api.updateSourceAccessControl(editingAccessControl, controlData);
                            const updated = await api.fetchDataHubState();
                            setDataHub(updated);
                            onRefresh();
                            setEditingAccessControl(null);
                        } catch (e) {
                            alert(t('save_failed') || 'Failed to save');
                        } finally {
                            setIsSavingAccess(false);
                        }
                    }}
                    t={t}
                />
            )}

            {showAutomationModal && automation && (
                <AutomationTopicModal
                    topic={editingTopic}
                    agents={agents}
                    isLoadingAgents={isLoadingAgents}
                    categories={dataHub.categories}
                    dataTypes={availableDataTypes}
                    publishers={advanced.telegramPublishers}
                    isSaving={isSavingTopic}
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
                    processingId={processingQueueId}
                />
            )}
        </div>
    );
};

export default AdvancedFeatures;

