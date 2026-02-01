import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../../../../services/api.ts';
import {
    ArtemisState,
    DataHubState,
    DataSource,
    DataCategory,
    DataPipelineSnapshot,
    DataNormalizationSummary,
    DataAccessLog,
    AIAgent,
    TelegramPublisher,
    AgentTopicRoute,
    PublisherQueueItem,
    NormalizedDataRecord,
    DataPipelineSourceSnapshot,
    DataPipelineCategorySnapshot,
    TelegramCollectorState,
    TelegramCollectorChannel,
    DetectedSourceType,
    SourceAccessControl,
    AgentTopicFormValues,
} from '../../../../types.ts';
import CreateSourceModal from './DataHub/modals/CreateSourceModal.tsx';
import CreateCategoryModal from './DataHub/modals/CreateCategoryModal.tsx';
import ViewSourceDataModal from './DataHub/modals/ViewSourceDataModal.tsx';
import AdvancedFeatures from './DataHub/AdvancedFeatures.tsx';

type Props = {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const DataHubTab: React.FC<Props> = ({ artemis, t, onRefresh, Card }) => {
    const [dataHub, setDataHub] = useState<DataHubState | null>(artemis.dataHub || null);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [isLoadingAgents, setIsLoadingAgents] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(!artemis.dataHub);
    const [activeView, setActiveView] = useState<'sources' | 'categories' | 'health' | 'logs' | 'advanced' | 'telegram' | 'pipeline'>('sources');
    const [showCreateSourceModal, setShowCreateSourceModal] = useState(false);
    const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
    const [editingSource, setEditingSource] = useState<DataSource | null>(null);
    const [viewingSourceData, setViewingSourceData] = useState<DataSource | null>(null);
    const [sourceData, setSourceData] = useState<any>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [collectorHealth, setCollectorHealth] = useState<any>(null);
    const [isLoadingCollector, setIsLoadingCollector] = useState(false);
    const [collectorMessage, setCollectorMessage] = useState<string | null>(null);
    const [collectorError, setCollectorError] = useState<string | null>(null);
    const [collectorAuthId, setCollectorAuthId] = useState<string | null>(null);
    const [collectorForm, setCollectorForm] = useState({
        apiId: '',
        apiHash: '',
        phoneNumber: '',
        code: '',
        password: '',
    });
    const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
    const [channelTestPreview, setChannelTestPreview] = useState<{
        channelId: string;
        channelHandle: string;
        fetchedAt: string;
        latency?: number;
        messages?: Array<{ text: string; timestamp: string; link?: string }>;
        success: boolean;
        error?: string;
    } | null>(null);
    const [isRefreshingChannels, setIsRefreshingChannels] = useState(false);
    const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
    const [pipelineError, setPipelineError] = useState<string | null>(null);
    const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('latest');
    const [categorySearch, setCategorySearch] = useState('');
    const [sourceSearch, setSourceSearch] = useState('');
    const [sourceStatusFilter, setSourceStatusFilter] = useState<'all' | 'success' | 'cached' | 'failed' | 'timeout'>('all');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categoryTagFilter, setCategoryTagFilter] = useState('');
    const [logsSourceFilter, setLogsSourceFilter] = useState('');
    const [logsAgentFilter, setLogsAgentFilter] = useState('');
    const [logsStatusFilter, setLogsStatusFilter] = useState<'all' | 'success' | 'cached' | 'failed' | 'timeout'>('all');
    const [visibleLogs, setVisibleLogs] = useState(50);
    const [dataHubError, setDataHubError] = useState<string | null>(null);
    const [agentsError, setAgentsError] = useState<string | null>(null);
    const telegramCollectorUrl = typeof api.getTelegramCollectorBaseUrl === 'function' ? api.getTelegramCollectorBaseUrl() : undefined;
    const telegramCollectorState = dataHub?.telegramCollector;
    const telegramChannels = telegramCollectorState?.channels || [];
    const pipelineSnapshot = dataHub?.pipelineSnapshot;
    const pipelineHistory = dataHub?.pipelineHistory || [];
    const latestSnapshot = pipelineSnapshot || pipelineHistory[0]?.snapshot;
    const activeSnapshot = useMemo(() => {
        if (!latestSnapshot) {
            return undefined;
        }
        if (selectedSnapshotId === 'latest' || pipelineHistory.length === 0) {
            return latestSnapshot;
        }
        const entry = pipelineHistory.find(item => item.id === selectedSnapshotId);
        return entry?.snapshot || latestSnapshot;
    }, [selectedSnapshotId, latestSnapshot, pipelineHistory]);
    const filteredCategories = useMemo(() => {
        if (!activeSnapshot) {
            return [];
        }
        const query = categorySearch.trim().toLowerCase();
        return activeSnapshot.categories.filter(category =>
            !query || category.name.toLowerCase().includes(query),
        );
    }, [activeSnapshot, categorySearch]);
    const filteredSources = useMemo(() => {
        if (!activeSnapshot) {
            return [];
        }
        const query = sourceSearch.trim().toLowerCase();
        return activeSnapshot.sources.filter(source => {
            const matchesQuery =
                !query ||
                source.name.toLowerCase().includes(query) ||
                source.category.toLowerCase().includes(query) ||
                source.lastDataType.toLowerCase().includes(query);
            const matchesStatus =
                sourceStatusFilter === 'all' || source.lastStatus === sourceStatusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [activeSnapshot, sourceSearch, sourceStatusFilter]);
    const telegramSources = useMemo(
        () => dataHub?.sources.filter(source => source.type === 'telegram') ?? [],
        [dataHub?.sources]
    );
    const normalizationSummary = dataHub?.normalizationSummary;
    const normalizedData = dataHub?.normalizedData || [];
    const latestNormalized = normalizedData.slice(0, 6);
    const categoryMetricsById = useMemo(() => {
        if (!latestSnapshot) {
            return {};
        }
        return latestSnapshot.categories.reduce<Record<string, { inflow: number; passRate: number }>>((acc, cat) => {
            acc[cat.categoryId] = { inflow: cat.inflow, passRate: cat.passRate };
            return acc;
        }, {});
    }, [latestSnapshot]);
    const filteredCategoriesList = useMemo(() => {
        const query = categoryFilter.trim().toLowerCase();
        const tagQuery = categoryTagFilter.trim().toLowerCase();
        return (dataHub?.categories ?? []).filter(category => {
            const matchesName = !query || category.name.toLowerCase().includes(query);
            const matchesTags =
                !tagQuery ||
                category.tags.some(tag => tag.toLowerCase().includes(tagQuery)) ||
                category.dataTypes.some(type => type.toLowerCase().includes(tagQuery));
            return matchesName && matchesTags;
        });
    }, [dataHub?.categories, categoryFilter, categoryTagFilter]);
    const filteredLogs = useMemo(() => {
        let logs = dataHub?.accessLogs ?? [];
        if (logsSourceFilter.trim()) {
            const query = logsSourceFilter.trim().toLowerCase();
            logs = logs.filter(log =>
                log.sourceId.toLowerCase().includes(query) ||
                log.dataType.toLowerCase().includes(query),
            );
        }
        if (logsAgentFilter.trim()) {
            const query = logsAgentFilter.trim().toLowerCase();
            logs = logs.filter(log => log.agentId.toLowerCase().includes(query));
        }
        if (logsStatusFilter !== 'all') {
            logs = logs.filter(log => log.status === logsStatusFilter);
        }
        return logs;
    }, [dataHub?.accessLogs, logsSourceFilter, logsAgentFilter, logsStatusFilter]);
    const visibleFilteredLogs = useMemo(
        () => filteredLogs.slice(0, visibleLogs),
        [filteredLogs, visibleLogs],
    );
    const logStatusCounts = useMemo(() => {
        return filteredLogs.reduce<Record<string, number>>((acc, log) => {
            acc[log.status] = (acc[log.status] || 0) + 1;
            return acc;
        }, {});
    }, [filteredLogs]);
    
    useEffect(() => {
        if (artemis.dataHub) {
            setDataHub(artemis.dataHub);
            setDataHubError(null);
            return;
        }
        let cancelled = false;
        const loadDataHub = async () => {
                setIsLoading(true);
                setDataHubError(null);
                try {
                    const hub = await api.fetchDataHubState();
                if (!cancelled) {
                    setDataHub(hub);
                }
                } catch (e) {
                    console.error('Failed to load Data Hub:', e);
                    if (!cancelled) {
                        const message = e instanceof Error ? e.message : 'Unknown error';
                        setDataHubError(message);
                    }
                } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };
        loadDataHub();
        return () => {
            cancelled = true;
        };
    }, [artemis.dataHub]);

    useEffect(() => {
        let cancelled = false;
        const loadAgents = async () => {
            setIsLoadingAgents(true);
            setAgentsError(null);
            try {
                const list = await api.fetchAIAgents();
                if (!cancelled) {
                    setAgents(list);
                }
            } catch (e) {
                console.error('Failed to load AI agents for automation routing:', e);
                if (!cancelled) {
                    const message = e instanceof Error ? e.message : 'Unknown error';
                    setAgentsError(message);
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingAgents(false);
                }
            }
        };
        loadAgents();
        return () => {
            cancelled = true;
        };
    }, []);
    
    const handleCheckHealth = async () => {
        setIsLoading(true);
        try {
            const health = await api.checkDataHubHealth();
            if (dataHub) {
                setDataHub({ ...dataHub, health });
            }
        } catch (e) {
            console.error('Failed to check health:', e);
            alert(t('health_check_failed') || 'Failed to check health');
        } finally {
            setIsLoading(false);
        }
    };

    const combinedCollectorHealth = collectorHealth || telegramCollectorState?.healthSummary || null;

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

    const handleCollectorHealth = async () => {
        setIsLoadingCollector(true);
        setCollectorError(null);
        try {
            const health = await api.getTelegramCollectorHealth();
            setCollectorHealth(health);
            setCollectorMessage('وضعیت کلکتور به‌روزرسانی شد.');
        } catch (error: any) {
            setCollectorError(error?.message || 'خطا در دریافت وضعیت کلکتور تلگرام.');
            if (telegramCollectorState?.healthSummary) {
                setCollectorHealth(telegramCollectorState.healthSummary);
            }
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleCollectorInputChange = (field: keyof typeof collectorForm, value: string) => {
        setCollectorForm(prev => ({ ...prev, [field]: value }));
    };

    const handleStartCollectorLogin = async () => {
        if (!collectorForm.phoneNumber.trim()) {
            setCollectorError('شماره تلفن الزامی است.');
            return;
        }
        setIsLoadingCollector(true);
        setCollectorError(null);
        setCollectorMessage(null);
        try {
            const payload: any = {
                phoneNumber: collectorForm.phoneNumber.trim(),
            };
            if (collectorForm.apiId) {
                payload.apiId = Number(collectorForm.apiId);
            }
            if (collectorForm.apiHash) {
                payload.apiHash = collectorForm.apiHash.trim();
            }
            const response = await api.startTelegramCollectorLogin(payload);
            setCollectorAuthId(response.authId);
            setCollectorMessage('کد تایید ارسال شد. لطفاً کد را از تلگرام وارد کنید.');
        } catch (error: any) {
            setCollectorError(error?.message || 'خطا در شروع فرآیند لاگین.');
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleConfirmCollectorLogin = async () => {
        if (!collectorAuthId) {
            setCollectorError('ابتدا باید درخواست ارسال کد را ثبت کنید.');
            return;
        }
        if (!collectorForm.code.trim()) {
            setCollectorError('کد تایید را وارد کنید.');
            return;
        }
        setIsLoadingCollector(true);
        setCollectorError(null);
        setCollectorMessage(null);
        try {
            await api.confirmTelegramCollectorLogin({
                authId: collectorAuthId,
                code: collectorForm.code.trim(),
                password: collectorForm.password.trim() || undefined,
            });
            setCollectorMessage('ورود تلگرام با موفقیت انجام شد و session ذخیره گردید.');
            setCollectorAuthId(null);
            setCollectorForm(prev => ({ ...prev, code: '', password: '' }));
            await handleCollectorHealth();
        } catch (error: any) {
            setCollectorError(error?.message || 'خطا در تایید کد.');
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleCancelCollectorLogin = async () => {
        if (!collectorAuthId) {
            setCollectorError('درخواست فعالی برای لغو وجود ندارد.');
            return;
        }
        setIsLoadingCollector(true);
        setCollectorError(null);
        try {
            await api.cancelTelegramCollectorLogin(collectorAuthId);
            setCollectorAuthId(null);
            setCollectorForm(prev => ({ ...prev, code: '', password: '' }));
            setCollectorMessage('درخواست ورود لغو شد.');
        } catch (error: any) {
            setCollectorError(error?.message || 'خطا در لغو درخواست.');
        } finally {
            setIsLoadingCollector(false);
        }
    };
    
    const handleRefreshCollectorChannels = async () => {
        setIsRefreshingChannels(true);
        setCollectorError(null);
        try {
            const collectorState = await api.refreshTelegramCollectorChannels();
            setDataHub(prev => prev ? { ...prev, telegramCollector: collectorState } : prev);
            setCollectorMessage(t('collector_channels_refreshed') || 'Channel statuses updated.');
        } catch (error: any) {
            setCollectorError(error?.message || t('collector_channels_refresh_failed') || 'Failed to refresh channels.');
        } finally {
            setIsRefreshingChannels(false);
        }
    };

    const handleLinkChannelToSource = async (channelId: string, sourceId?: string) => {
        setCollectorError(null);
        setCollectorMessage(null);
        try {
            const collectorState = await api.linkTelegramChannelToSource(channelId, sourceId || undefined);
            setDataHub(prev => prev ? { ...prev, telegramCollector: collectorState } : prev);
            setCollectorMessage(
                sourceId
                    ? (t('collector_link_source_success') || 'Channel linked to data source.')
                    : (t('collector_link_source_cleared') || 'Channel link cleared.')
            );
        } catch (error: any) {
            setCollectorError(error?.message || t('collector_link_source_failed') || 'Failed to link channel.');
        }
    };
    
    const handleTestCollectorChannel = async (channelId: string) => {
        setTestingChannelId(channelId);
        setCollectorError(null);
        setCollectorMessage(null);
        try {
            const result = await api.testTelegramCollectorChannel(channelId);
            if (result.collector) {
                setDataHub(prev => prev ? { ...prev, telegramCollector: result.collector } : prev);
            }
            setChannelTestPreview({
                channelId: result.channelId,
                channelHandle: result.channelHandle,
                fetchedAt: result.fetchedAt,
                latency: result.latency,
                messages: result.messages,
                success: result.success,
                error: result.error,
            });
            if (result.success) {
                setCollectorMessage(t('collector_channel_test_success') || 'Collector fetched fresh messages.');
            } else {
                setCollectorError(result.error || t('collector_channel_test_failed') || 'Test fetch failed.');
            }
        } catch (error: any) {
            setCollectorError(error?.message || t('collector_channel_test_failed') || 'Test fetch failed.');
        } finally {
            setTestingChannelId(null);
        }
    };
    
    const handleTestSource = async (sourceId: string) => {
        setIsLoading(true);
        try {
            const result = await api.testDataSourceConnection(sourceId);
            if (result.success) {
                alert(t('connection_successful') || `Connection successful! Response time: ${result.responseTime}ms`);
            } else {
                alert(t('connection_failed') || `Connection failed: ${result.message}`);
            }
            // Refresh data
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e) {
            alert(t('test_failed') || 'Test failed');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRefreshPipelineSnapshot = async () => {
        setIsLoadingPipeline(true);
        setPipelineError(null);
        try {
            const snapshot = await api.refreshDataPipelineSnapshot();
            setDataHub(prev => prev ? { ...prev, pipelineSnapshot: snapshot } : prev);
        } catch (error: any) {
            console.error('Failed to refresh pipeline snapshot:', error);
            setPipelineError(error?.message || t('pipeline_refresh_failed') || 'Failed to refresh pipeline snapshot');
        } finally {
            setIsLoadingPipeline(false);
        }
    };
    
    useEffect(() => {
        if (activeView !== 'pipeline') {
            return;
        }
        if (dataHub?.pipelineSnapshot || isLoadingPipeline) {
            return;
        }
        handleRefreshPipelineSnapshot();
    }, [activeView, dataHub?.pipelineSnapshot, isLoadingPipeline]);

    useEffect(() => {
        if (pipelineSnapshot?.lastRefreshed) {
            setSelectedSnapshotId('latest');
        }
    }, [pipelineSnapshot?.lastRefreshed]);
    
    const formatTimeAgo = (timestamp?: string): string => {
        if (!timestamp) return t('never') || 'Never';
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now.getTime() - time.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return t('just_now') || 'Just now';
        if (diffMins < 60) return `${diffMins} ${t('minutes_ago') || 'min ago'}`;
        if (diffHours < 24) return `${diffHours} ${t('hours_ago') || 'hours ago'}`;
        return `${diffDays} ${t('days_ago') || 'days ago'}`;
    };
    
    if (isLoading && !dataHub) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }
    
    if (!dataHub) {
        return <div className="text-center p-10">{t('data_hub_not_available') || 'Data Hub not available'}</div>;
    }
    
    return (
        <div className="space-y-6">
            {dataHubError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                    {t('failed_to_load_data') || 'Failed to load Data Hub state.'}
                </div>
            )}

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">{t('total_sources') || 'Total Sources'}</p>
                        <p className="text-2xl font-bold text-foreground">{dataHub.totalSources}</p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">{t('active_sources') || 'Active Sources'}</p>
                        <p className="text-2xl font-bold text-green-400">{dataHub.activeSources}</p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">{t('cache_hit_rate') || 'Cache Hit Rate'}</p>
                        <p className="text-2xl font-bold text-purple-400">{dataHub.cache.hitRate.toFixed(1)}%</p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">{t('health_status') || 'Health Status'}</p>
                        <p className={`text-2xl font-bold ${
                            dataHub.health.overall === 'healthy' ? 'text-green-400' :
                            dataHub.health.overall === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                            {t(dataHub.health.overall) || dataHub.health.overall}
                        </p>
                    </div>
                </Card>
            </div>
            
            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-border">
                <button
                    onClick={() => setActiveView('sources')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeView === 'sources' 
                            ? 'border-b-2 border-purple-500 text-purple-400' 
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {t('data_sources') || 'Data Sources'}
                </button>
                <button
                    onClick={() => setActiveView('categories')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeView === 'categories' 
                            ? 'border-b-2 border-purple-500 text-purple-400' 
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {t('categories') || 'Categories'}
                </button>
                <button
                    onClick={() => setActiveView('pipeline')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeView === 'pipeline' 
                            ? 'border-b-2 border-purple-500 text-purple-400' 
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {t('data_pipeline') || 'Data Pipeline'}
                </button>
                <button
                    onClick={() => setActiveView('health')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeView === 'health' 
                            ? 'border-b-2 border-purple-500 text-purple-400' 
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {t('health_monitoring') || 'Health'}
                </button>
                <button
                    onClick={() => setActiveView('logs')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeView === 'logs' 
                            ? 'border-b-2 border-purple-500 text-purple-400' 
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {t('access_logs') || 'Access Logs'}
                </button>
                <button
                    onClick={() => setActiveView('advanced')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeView === 'advanced' 
                            ? 'border-b-2 border-purple-500 text-purple-400' 
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {t('advanced_features') || 'Advanced'}
                </button>
                <button
                    onClick={() => setActiveView('telegram')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeView === 'telegram' 
                            ? 'border-b-2 border-purple-500 text-purple-400' 
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {t('telegram_collector') || 'Telegram Collector'}
                </button>
            </div>
            
            {/* Content Views */}
            {activeView === 'sources' && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('data_sources') || 'Data Sources'}</h3>
                        <button
                            onClick={() => {
                                setEditingSource(null);
                                setShowCreateSourceModal(true);
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('add_source') || '+ Add Source'}
                        </button>
                    </div>
                    <div className="space-y-3">
                        {dataHub.sources.map(source => (
                            <div key={source.id} className="border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-semibold text-foreground">{source.name}</h4>
                                        <p className="text-xs text-muted-foreground">{source.type} • {source.category}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            source.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                            source.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                            'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {t(source.status) || source.status}
                                        </span>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            source.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                            source.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                            source.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {t(source.priority) || source.priority}
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                                    <div>
                                        <p className="text-muted-foreground">{t('success_rate') || 'Success Rate'}</p>
                                        <p className="font-semibold text-foreground">{source.successRate.toFixed(1)}%</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">{t('reliability') || 'Reliability'}</p>
                                        <p className="font-semibold text-foreground">{source.reliabilityScore.toFixed(0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">{t('response_time') || 'Response Time'}</p>
                                        <p className="font-semibold text-foreground">{source.responseTime || 0}ms</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">{t('update_interval') || 'Update Interval'}</p>
                                        <p className="font-semibold text-foreground">{t(source.updateInterval) || source.updateInterval}</p>
                                    </div>
                                </div>
                                
                                {/* Connection Status */}
                                <div className="mt-3 pt-3 border-t border-border">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                                source.status === 'active' ? 'bg-green-500 animate-pulse' :
                                                source.status === 'error' ? 'bg-red-500' :
                                                source.status === 'testing' ? 'bg-yellow-500 animate-pulse' :
                                                'bg-gray-500'
                                            }`}></div>
                                            <span className="text-muted-foreground">
                                                {source.status === 'active' ? (t('connected') || 'Connected') :
                                                 source.status === 'error' ? (t('error') || 'Error') :
                                                 source.status === 'testing' ? (t('testing') || 'Testing...') :
                                                 (t('inactive') || 'Inactive')}
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground">
                                            {source.lastSuccess ? (
                                                <span className="text-green-400">
                                                    {t('last_success') || 'Last success'}: {formatTimeAgo(source.lastSuccess)}
                                                </span>
                                            ) : source.lastUpdate ? (
                                                <span>
                                                    {t('last_update') || 'Last update'}: {formatTimeAgo(source.lastUpdate)}
                                                </span>
                                            ) : (
                                                <span>{t('never_updated') || 'Never updated'}</span>
                                            )}
                                        </div>
                                    </div>
                                    {source.lastError && (
                                        <div className="mt-2 text-xs text-red-400">
                                            {t('last_error') || 'Last error'}: {source.lastError}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={async () => {
                                            setViewingSourceData(source);
                                            setIsLoadingData(true);
                                            setSourceData(null); // Reset previous data
                                            try {
                                                // Determine data type based on source category or type
                                                let dataType = 'general';
                                                if (source.category && (source.category.includes('price') || source.category.includes('Price'))) {
                                                    dataType = 'price';
                                                } else if (source.category && (source.category.includes('news') || source.category.includes('News'))) {
                                                    dataType = 'news';
                                                } else if (source.type === 'telegram') {
                                                    dataType = 'telegram';
                                                } else if (source.tags && source.tags.some(tag => tag.toLowerCase().includes('price'))) {
                                                    dataType = 'price';
                                                } else if (source.tags && source.tags.some(tag => tag.toLowerCase().includes('news'))) {
                                                    dataType = 'news';
                                                }
                                                
                                                const response = await api.requestData({
                                                    sourceId: source.id,
                                                    agentId: 'preview',
                                                    dataType: dataType as any,
                                                    cache: false, // Force fresh data
                                                });
                                                
                                                // Always set data, even if it contains error info or is mock data
                                                if (response.data) {
                                                    setSourceData(response.data);
                                                } else if (response.error) {
                                                    // Show error info in modal instead of alert
                                                    setSourceData({
                                                        error: true,
                                                        message: response.error,
                                                        source: source.name,
                                                        url: source.url || 'Not configured',
                                                        note: source.url ? 'Failed to fetch from URL' : 'No URL configured. Please edit the source and add a URL.'
                                                    });
                                                } else {
                                                    // Fallback: show mock data
                                                    setSourceData({
                                                        message: 'No data available',
                                                        source: source.name,
                                                        type: source.type,
                                                        note: 'This source has no URL configured. Please edit the source and add a URL to fetch real data.'
                                                    });
                                                }
                                            } catch (e: any) {
                                                console.error('Failed to fetch source data:', e);
                                                // Show error in modal instead of alert
                                                setSourceData({
                                                    error: true,
                                                    message: e.message || 'Failed to fetch data',
                                                    source: source.name,
                                                    url: source.url || 'Not configured',
                                                    details: e.toString()
                                                });
                                            } finally {
                                                setIsLoadingData(false);
                                            }
                                        }}
                                        disabled={isLoading}
                                        className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                                    >
                                        {t('view_data') || 'View Data'}
                                    </button>
                                    <button
                                        onClick={() => handleTestSource(source.id)}
                                        disabled={isLoading || source.status === 'testing'}
                                        className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                                    >
                                        {source.status === 'testing' ? (t('testing') || 'Testing...') : (t('test_connection') || 'Test Connection')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingSource(source);
                                            setShowCreateSourceModal(true);
                                        }}
                                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                                    >
                                        {t('edit') || 'Edit'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const confirmed = window.confirm(t('confirm_delete') || 'Are you sure you want to delete this source?');
                                            if (confirmed) {
                                                try {
                                                    await api.deleteDataSource(source.id);
                                                    if (dataHub) {
                                                        setDataHub({
                                                            ...dataHub,
                                                            sources: dataHub.sources.filter(s => s.id !== source.id),
                                                            totalSources: dataHub.totalSources - 1,
                                                            activeSources: dataHub.sources.filter(s => s.id !== source.id && s.status === 'active').length,
                                                        });
                                                    }
                                                    onRefresh();
                                                } catch (e) {
                                                    alert(t('delete_failed') || 'Failed to delete source');
                                                }
                                            }
                                        }}
                                        className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                    >
                                        {t('delete') || 'Delete'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            
            {activeView === 'categories' && (
                <Card>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                        <div>
                        <h3 className="font-semibold text-foreground">{t('data_categories') || 'Data Categories'}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t('data_categories_desc') || 'Filter categories by name, tag or data type to inspect their health.'}
                            </p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2">
                            <input
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                placeholder={t('category_filter_placeholder') || 'Filter categories'}
                                className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                            />
                            <input
                                value={categoryTagFilter}
                                onChange={e => setCategoryTagFilter(e.target.value)}
                                placeholder={t('category_tag_filter_placeholder') || 'Filter tags or data types'}
                                className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                            />
                            <button
                                onClick={() => {
                                    setCategoryFilter('');
                                    setCategoryTagFilter('');
                                }}
                                className="text-xs px-3 py-2 border border-border rounded text-muted-foreground hover:text-foreground transition"
                            >
                                {t('reset_filters') || 'Reset'}
                            </button>
                        <button
                            onClick={() => setShowCreateCategoryModal(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('add_category') || '+ Add Category'}
                        </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredCategoriesList.length > 0 ? (
                            filteredCategoriesList.map(category => {
                                const metrics = categoryMetricsById[category.id];
                                return (
                                    <div key={category.id} className="border border-border rounded-lg p-4 space-y-3">
                                        <div className="flex justify-between gap-4">
                                            <div>
                                                <h4 className="font-semibold text-foreground">{category.name}</h4>
                                {category.description && (
                                                    <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                                )}
                                </div>
                                            <div className="text-right text-xs text-muted-foreground">
                                                <div>{t('sources') || 'Sources'}: <span className="text-foreground font-semibold">{category.sourceCount}</span></div>
                                                <div>{t('data_types') || 'Data Types'}: <span className="text-foreground font-semibold">{category.dataTypes.length}</span></div>
                            </div>
                                        </div>
                                        {metrics && (
                                            <div className="flex gap-3 text-xs">
                                                <div className="flex-1 bg-secondary/40 rounded p-2">
                                                    <p className="text-muted-foreground mb-1">{t('category_inflow') || 'Inflow (24h)'}</p>
                                                    <p className="text-lg font-semibold text-foreground">{metrics.inflow}</p>
                                                </div>
                                                <div className="flex-1 bg-secondary/40 rounded p-2">
                                                    <p className="text-muted-foreground mb-1">{t('category_pass_rate') || 'Pass Rate'}</p>
                                                    <p className="text-lg font-semibold text-green-400">{metrics.passRate.toFixed(1)}%</p>
                                                </div>
                                            </div>
                                        )}
                                        {(category.tags.length > 0 || category.dataTypes.length > 0) && (
                                            <div className="text-[11px] text-muted-foreground">
                                                {category.tags.length > 0 && (
                                                    <p className="mb-1">
                                                        {t('tags') || 'Tags'}: {category.tags.join(', ')}
                                                    </p>
                                                )}
                                                {category.dataTypes.length > 0 && (
                                                    <p>
                                                        {t('data_types') || 'Data Types'}: {category.dataTypes.join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('no_categories_match') || 'No categories match the current filters.'}</p>
                        )}
                    </div>
                </Card>
            )}
            
            {activeView === 'health' && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('health_monitoring') || 'Health Monitoring'}</h3>
                        <button
                            onClick={handleCheckHealth}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isLoading ? t('checking') || 'Checking...' : t('check_health') || 'Check Health'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('active_connections') || 'Active Connections'}</p>
                            <p className="text-lg font-bold text-green-400">{dataHub.health.activeConnections}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('failed_connections') || 'Failed Connections'}</p>
                            <p className="text-lg font-bold text-red-400">{dataHub.health.failedConnections}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('avg_response_time') || 'Avg Response Time'}</p>
                            <p className="text-lg font-bold text-foreground">{dataHub.health.averageResponseTime.toFixed(0)}ms</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('cache_hit_rate') || 'Cache Hit Rate'}</p>
                            <p className="text-lg font-bold text-purple-400">{dataHub.health.cacheHitRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </Card>
            )}
            
            {activeView === 'logs' && (
                <Card>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                                        <div>
                            <h3 className="font-semibold text-foreground">{t('access_logs') || 'Access Logs'}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t('access_logs_desc') || 'Filter by source, agent or status to debug requests quickly.'}
                            </p>
                                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs w-full lg:w-auto">
                            <input
                                value={logsSourceFilter}
                                onChange={e => setLogsSourceFilter(e.target.value)}
                                placeholder={t('log_filter_source_placeholder') || 'Source or data type'}
                                className="px-3 py-2 bg-background border border-border rounded text-foreground"
                            />
                            <input
                                value={logsAgentFilter}
                                onChange={e => setLogsAgentFilter(e.target.value)}
                                placeholder={t('log_filter_agent_placeholder') || 'Agent'}
                                className="px-3 py-2 bg-background border border-border rounded text-foreground"
                            />
                            <select
                                value={logsStatusFilter}
                                onChange={e => setLogsStatusFilter(e.target.value as typeof logsStatusFilter)}
                                className="px-3 py-2 bg-background border border-border rounded text-foreground"
                            >
                                <option value="all">{t('status_all') || 'All statuses'}</option>
                                <option value="success">{t('success') || 'Success'}</option>
                                <option value="cached">{t('cached') || 'Cached'}</option>
                                <option value="failed">{t('failed') || 'Failed'}</option>
                                <option value="timeout">{t('timeout') || 'Timeout'}</option>
                            </select>
                            <button
                                onClick={() => {
                                    setLogsSourceFilter('');
                                    setLogsAgentFilter('');
                                    setLogsStatusFilter('all');
                                }}
                                className="px-3 py-2 border border-border rounded text-muted-foreground hover:text-foreground transition"
                            >
                                {t('reset_filters') || 'Reset'}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
                        {['success', 'cached', 'failed', 'timeout'].map(status => (
                            <div key={status} className="bg-secondary/40 rounded p-3">
                                <p className="text-muted-foreground capitalize">{t(status) || status}</p>
                                <p className="text-xl font-semibold text-foreground">{logStatusCounts[status] || 0}</p>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                        {visibleFilteredLogs.length > 0 ? (
                            visibleFilteredLogs.map(log => (
                                <div key={log.id} className="border border-border rounded p-3 text-xs">
                                    <div className="flex justify-between items-center gap-3">
                                        <div>
                                            <p className="font-semibold text-foreground">{t('agent') || 'Agent'}: {log.agentId}</p>
                                            <p className="text-muted-foreground">
                                                {t('source') || 'Source'}: {log.sourceId} • {t('data_type') || 'Data Type'}: {log.dataType}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs ${
                                            log.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                            log.status === 'cached' ? 'bg-blue-500/20 text-blue-400' :
                                            log.status === 'timeout' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                            {t(log.status) || log.status}
                                        </span>
                                    </div>
                                    {log.error && (
                                        <p className="mt-2 text-[11px] text-red-400">{log.error}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-10">{t('no_logs') || 'No access logs yet'}</p>
                        )}
                    </div>
                    {visibleLogs < filteredLogs.length && (
                        <div className="text-center mt-4">
                            <button
                                onClick={() => setVisibleLogs(prev => prev + 50)}
                                className="text-xs px-4 py-2 border border-border rounded hover:bg-secondary/30 transition"
                            >
                                {t('load_more') || 'Load more'}
                            </button>
                        </div>
                    )}
                </Card>
            )}

            {activeView === 'pipeline' && (
                <Card>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <div>
                            <h3 className="font-semibold text-foreground">{t('data_preparation') || 'Data Preparation & Screening'}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t('data_preparation_desc') || 'Aggregate quality metrics to ensure every downstream system receives clean, recent and trusted data.'}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                            {pipelineHistory.length > 0 && (
                                <div className="text-xs">
                                    <label className="block text-muted-foreground mb-1">
                                        {t('snapshot_history') || 'Snapshot History'}
                                    </label>
                                    <select
                                        value={selectedSnapshotId}
                                        onChange={e => setSelectedSnapshotId(e.target.value)}
                                        className="w-full sm:w-48 px-3 py-2 bg-background border border-border rounded text-foreground"
                                    >
                                        <option value="latest">
                                            {t('snapshot_latest') || 'Latest'}
                                        </option>
                                        {pipelineHistory.map(entry => (
                                            <option key={entry.id} value={entry.id}>
                                                {new Date(entry.generatedAt).toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <button
                                onClick={handleRefreshPipelineSnapshot}
                                disabled={isLoadingPipeline}
                                className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded"
                            >
                                {isLoadingPipeline ? (t('refreshing') || 'Refreshing...') : (t('refresh_snapshot') || 'Refresh Snapshot')}
                            </button>
                        </div>
                    </div>
                    {pipelineError && (
                        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                            {pipelineError}
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                        <input
                            value={categorySearch}
                            onChange={e => setCategorySearch(e.target.value)}
                            placeholder={t('category_filter_placeholder') || 'Filter categories'}
                            className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                        />
                        <input
                            value={sourceSearch}
                            onChange={e => setSourceSearch(e.target.value)}
                            placeholder={t('source_filter_placeholder') || 'Search sources or data types'}
                            className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                        />
                        <select
                            value={sourceStatusFilter}
                            onChange={e => setSourceStatusFilter(e.target.value as typeof sourceStatusFilter)}
                            className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                        >
                            <option value="all">{t('status_all') || 'All statuses'}</option>
                            <option value="success">{t('success') || 'Success'}</option>
                            <option value="cached">{t('cached') || 'Cached'}</option>
                            <option value="failed">{t('failed') || 'Failed'}</option>
                            <option value="timeout">{t('timeout') || 'Timeout'}</option>
                        </select>
                    </div>
                    {activeSnapshot ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="bg-secondary/50 rounded p-3">
                                    <p className="text-xs text-muted-foreground mb-1">{t('total_requests_24h') || 'Requests (24h)'}</p>
                                    <p className="text-2xl font-bold text-foreground">{activeSnapshot.totalRequests24h}</p>
                                </div>
                                <div className="bg-secondary/50 rounded p-3">
                                    <p className="text-xs text-muted-foreground mb-1">{t('pass_rate') || 'Pass Rate'}</p>
                                    <p className="text-2xl font-bold text-green-400">
                                        {activeSnapshot.totalRequests24h
                                            ? ((activeSnapshot.passed24h / activeSnapshot.totalRequests24h) * 100).toFixed(1)
                                            : '100'}
                                        %
                                    </p>
                                </div>
                                <div className="bg-secondary/50 rounded p-3">
                                    <p className="text-xs text-muted-foreground mb-1">{t('failed_requests') || 'Failed'}</p>
                                    <p className="text-2xl font-bold text-red-400">{activeSnapshot.failed24h}</p>
                                </div>
                                <div className="bg-secondary/50 rounded p-3">
                                    <p className="text-xs text-muted-foreground mb-1">{t('pending_requests') || 'Pending'}</p>
                                    <p className="text-2xl font-bold text-yellow-400">{activeSnapshot.pending24h}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">{t('category_screening') || 'Category Screening'}</h4>
                                    <div className="space-y-2">
                                        {filteredCategories.slice(0, 6).map(category => (
                                            <div key={category.categoryId} className="border border-border rounded-lg p-3 text-xs flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-foreground">{category.name}</p>
                                                    <p className="text-muted-foreground mt-1">
                                                        {t('inflow') || 'Inflow'}: {category.inflow}
                                                    </p>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                    category.passRate >= 90 ? 'bg-green-500/20 text-green-400' :
                                                    category.passRate >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                    {category.passRate.toFixed(1)}%
                                                </span>
                                            </div>
                                        ))}
                                        {filteredCategories.length === 0 && (
                                            <p className="text-xs text-muted-foreground">{t('pipeline_no_categories') || 'No category samples yet.'}</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">{t('source_quality_board') || 'Source Quality Board'}</h4>
                                    <div className="space-y-2">
                                        {filteredSources.slice(0, 6).map(source => (
                                            <div key={source.sourceId} className="border border-border rounded-lg p-3 text-xs">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-semibold text-foreground">{source.name}</p>
                                                        <p className="text-muted-foreground">{source.category}</p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs ${
                                                        source.lastStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                                                        source.lastStatus === 'cached' ? 'bg-blue-500/20 text-blue-400' :
                                                        source.lastStatus === 'timeout' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                        {t(source.lastStatus) || source.lastStatus}
                                                    </span>
                                                </div>
                                                <div className="mt-2 text-muted-foreground flex flex-wrap gap-3">
                                                    <span>{t('data_type') || 'Type'}: {source.lastDataType}</span>
                                                    {source.lastResponseTime && (
                                                        <span>{t('response') || 'Response'}: {source.lastResponseTime}ms</span>
                                                    )}
                                                    {source.lastChecked && (
                                                        <span>{formatTimeAgo(source.lastChecked)}</span>
                                                    )}
                                                </div>
                                                {source.issues && source.issues.length > 0 && (
                                                    <div className="mt-2 text-[11px] text-red-400">
                                                        {source.issues.map(issue => t(issue) || issue).join(' • ')}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {filteredSources.length === 0 && (
                                            <p className="text-xs text-muted-foreground">{t('pipeline_no_sources') || 'No source telemetry yet.'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {normalizationSummary && (
                                <div className="mt-6">
                                    <h4 className="font-semibold text-sm mb-3">{t('normalization_summary') || 'Normalization Summary'}</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        <div className="bg-secondary/40 rounded p-3">
                                            <p className="text-muted-foreground">{t('normalized_total') || 'Processed'}</p>
                                            <p className="text-xl font-semibold text-foreground">{normalizationSummary.totalProcessed}</p>
                                        </div>
                                        <div className="bg-green-500/10 rounded p-3">
                                            <p className="text-muted-foreground">{t('normalized_ready') || 'Ready'}</p>
                                            <p className="text-xl font-semibold text-green-400">{normalizationSummary.passed}</p>
                                        </div>
                                        <div className="bg-yellow-500/10 rounded p-3">
                                            <p className="text-muted-foreground">{t('normalized_warning') || 'Warnings'}</p>
                                            <p className="text-xl font-semibold text-yellow-400">{normalizationSummary.warnings}</p>
                                        </div>
                                        <div className="bg-red-500/10 rounded p-3">
                                            <p className="text-muted-foreground">{t('normalized_rejected') || 'Rejected'}</p>
                                            <p className="text-xl font-semibold text-red-400">{normalizationSummary.rejected}</p>
                                        </div>
                                    </div>
                                    {normalizationSummary.lastProcessedAt && (
                                        <p className="text-[11px] text-muted-foreground mt-2">
                                            {t('normalized_last_processed') || 'Last processed'}: {new Date(normalizationSummary.lastProcessedAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className="mt-6">
                                <h4 className="font-semibold text-sm mb-2">{t('normalized_feed') || 'Latest normalized records'}</h4>
                                {latestNormalized.length > 0 ? (
                                    <div className="space-y-2">
                                        {latestNormalized.map(record => (
                                            <div key={record.id} className="border border-border rounded p-3 text-xs">
                                                <div className="flex justify-between items-center flex-wrap gap-2">
                                                    <div>
                                                        <p className="font-semibold text-foreground">{record.payload.title || record.sourceId}</p>
                                                        <p className="text-muted-foreground">
                                                            {record.sourceId} • {record.dataType}
                                                        </p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                                                        record.status === 'ready'
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : record.status === 'warning'
                                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                                : 'bg-red-500/20 text-red-400'
                                                    }`}>
                                                        {t(`normalized_status_${record.status}`) || record.status}
                                                    </span>
                                                </div>
                                                {record.payload.content && (
                                                    <p className="mt-2 text-muted-foreground line-clamp-2">{record.payload.content}</p>
                                                )}
                                                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                                    <span>{t('quality_score') || 'Quality'}: {record.qualityScore}</span>
                                                    <span>{t('normalized_received_at') || 'Received'}: {formatTimeAgo(record.receivedAt)}</span>
                                                    {record.issues.length > 0 && (
                                                        <span>{record.issues.join(', ')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">{t('normalized_feed_empty') || 'No normalized records yet.'}</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {t('pipeline_empty_state') || 'No snapshot available yet. Refresh to calculate current screening metrics.'}
                        </p>
                    )}
                </Card>
            )}
            
            {activeView === 'advanced' && dataHub && (
                <AdvancedFeatures
                    dataHub={dataHub}
                    setDataHub={setDataHub}
                    onRefresh={onRefresh}
                    t={t}
                    formatTimeAgo={formatTimeAgo}
                    agents={agents}
                    isLoadingAgents={isLoadingAgents}
                />
            )}

            {activeView === 'telegram' && (
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
                        <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-300">
                            {collectorMessage}
                        </div>
                    )}
                    {collectorError && (
                        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">
                            {collectorError}
                        </div>
                    )}
                    {combinedCollectorHealth && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 text-sm">
                            <div className="bg-secondary/50 rounded p-3">
                                <p className="text-muted-foreground text-xs mb-1">{t('status') || 'Status'}</p>
                                <p className="font-semibold text-foreground">{combinedCollectorHealth.status}</p>
                            </div>
                            <div className="bg-secondary/50 rounded p-3">
                                <p className="text-muted-foreground text-xs mb-1">{t('uptime') || 'Uptime'}</p>
                                <p className="font-semibold text-foreground">
                                    {collectorUptime ? `${Math.floor((collectorUptime as number) / 1000)}s` : '-'}
                                </p>
                            </div>
                            <div className="bg-secondary/50 rounded p-3">
                                <p className="text-muted-foreground text-xs mb-1">{t('tracked_channels') || 'Tracked Channels'}</p>
                                <p className="font-semibold text-foreground">{collectorTrackedChannels}</p>
                            </div>
                            <div className="bg-secondary/50 rounded p-3">
                                <p className="text-muted-foreground text-xs mb-1">{t('collector_channels_with_errors') || 'Channels with errors'}</p>
                                <p className="font-semibold text-foreground">
                                    {collectorChannelsWithErrors}
                                </p>
                                {collectorAvgLatency && (
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {t('collector_avg_latency') || 'Latency'}: {collectorAvgLatency} ms
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
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
                                                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                                                        channel.status === 'error' ? 'bg-red-500/20 text-red-300' :
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
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                                channel.lastTestStatus === 'success'
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
                                                    <span className={`px-2 py-1 rounded text-[11px] font-semibold ${
                                                        channel.usingCollector ? 'bg-purple-500/20 text-purple-300' : 'bg-orange-500/20 text-orange-300'
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
                            <div className={`mt-4 p-3 rounded border text-xs ${
                                channelTestPreview.success ? 'border-green-500/30 bg-green-500/5 text-green-200' : 'border-red-500/30 bg-red-500/5 text-red-200'
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
                                    channelTestPreview.error && (
                                        <p className="mt-2 text-[11px]">
                                            {channelTestPreview.error}
                                        </p>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            )}
            
            {/* Create/Edit Source Modal */}
            {showCreateSourceModal && (
                <CreateSourceModal
                    source={editingSource}
                    categories={dataHub.categories}
                    onClose={() => {
                        setShowCreateSourceModal(false);
                        setEditingSource(null);
                    }}
                    onSave={async (sourceData) => {
                        try {
                            if (editingSource) {
                                await api.updateDataHubSource(editingSource.id, sourceData);
                            } else {
                                await api.createDataSource(sourceData);
                            }
                            const updated = await api.fetchDataHubState();
                            setDataHub(updated);
                            onRefresh();
                            setShowCreateSourceModal(false);
                            setEditingSource(null);
                        } catch (e) {
                            alert(t('save_failed') || 'Failed to save source');
                        }
                    }}
                    t={t}
                />
            )}
            
            {/* Create Category Modal */}
            {showCreateCategoryModal && (
                <CreateCategoryModal
                    onClose={() => setShowCreateCategoryModal(false)}
                    onSave={async (categoryData) => {
                        try {
                            await api.createDataCategory(categoryData);
                            const updated = await api.fetchDataHubState();
                            setDataHub(updated);
                            onRefresh();
                            setShowCreateCategoryModal(false);
                        } catch (e) {
                            alert(t('save_failed') || 'Failed to save category');
                        }
                    }}
                    t={t}
                />
            )}
            
            {/* View Source Data Modal */}
            {viewingSourceData && (
                <ViewSourceDataModal
                    source={viewingSourceData}
                    data={sourceData}
                    isLoading={isLoadingData}
                    onClose={() => {
                        setViewingSourceData(null);
                        setSourceData(null);
                    }}
                    onRefresh={async () => {
                        if (!viewingSourceData) return;
                        setIsLoadingData(true);
                        try {
                            let dataType = 'general';
                            if (viewingSourceData.category.includes('price') || viewingSourceData.tags.includes('price')) {
                                dataType = 'price';
                            } else if (viewingSourceData.category.includes('news') || viewingSourceData.tags.includes('news')) {
                                dataType = 'news';
                            } else if (viewingSourceData.type === 'telegram') {
                                dataType = 'telegram';
                            }
                            
                            const response = await api.requestData({
                                sourceId: viewingSourceData.id,
                                agentId: 'preview',
                                dataType: dataType as any,
                                cache: false,
                            });
                            
                            if (response.success && response.data) {
                                setSourceData(response.data);
                            } else {
                                alert(t('failed_to_fetch_data') || `Failed to fetch data: ${response.error || 'Unknown error'}`);
                            }
                        } catch (e) {
                            console.error('Failed to refresh source data:', e);
                            alert(t('failed_to_fetch_data') || 'Failed to fetch data');
                        } finally {
                            setIsLoadingData(false);
                        }
                    }}
                    t={t}
                />
            )}
        </div>
    );
};

export default DataHubTab;
