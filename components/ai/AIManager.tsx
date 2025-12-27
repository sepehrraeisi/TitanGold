import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIManagerOverview, ArtemisState, TradingScenario, ArtemisConfig, ArtemisLog, DataHubState, DataSource, DataCategory, DataHubAdvancedFeatures, DetectedSourceType, DataPipelineSourceSnapshot, DataPipelineCategorySnapshot, DataNormalizationSummary, AIAgent, AgentTopicRoute, NormalizedDataStatus, TelegramPublisher, PublisherQueueItem, NormalizedDataRecord, AgentHealth, AgentTask, ResourceAllocation, Decision, DecisionEngineState, AgentSignal } from '../../types.ts';
import { Backtesting, SystemLogs, ArtemisSettings } from './ArtemisComponents.tsx';
import { useArtemisState } from './hooks/useArtemisState.ts';
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        {children}
    </div>
);

type ArtemisTab = 'overview' | 'decision_engine' | 'orchestration' | 'learning' | 'monitoring' | 'scenarios' | 'data_hub' | 'settings' | 'backtesting' | 'logs';

const AIManager: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AIManagerOverview | null>(null);
    const { state: artemis, loading: artemisLoading, error: artemisError, reload: reloadArtemis, setSafeState: setArtemis } = useArtemisState();
    const [activeTab, setActiveTab] = useState<ArtemisTab>('overview');
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const managerData = await api.fetchAIManagerData();
                setData(managerData);
                if (managerData.artemis) {
                    setArtemis(managerData.artemis);
                } else {
                    await reloadArtemis();
                }
            } catch (e) {
                console.error('Failed to load AIManager data:', e);
                setError(e instanceof Error ? e.message : 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [reloadArtemis, setArtemis]);

    if (isLoading || artemisLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    const combinedError = error || artemisError;
    if (combinedError) {
        return (
            <div className="text-center p-10">
                <p className="text-red-400 mb-4">{t('error_loading') || 'Error loading data'}: {combinedError}</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                >
                    {t('reload') || 'Reload'}
                </button>
            </div>
        );
    }

    if (!data || !artemis) {
        return <div className="text-center p-10">{t('no_data') || 'No data available'}</div>;
    }
    
    const tabs: { id: ArtemisTab; label: string }[] = [
        { id: 'overview', label: t('artemis_overview') || 'Overview' },
        { id: 'decision_engine', label: t('artemis_decision_engine') || 'Decision Engine' },
        { id: 'orchestration', label: t('artemis_orchestration') || 'Agent Orchestration' },
        { id: 'learning', label: t('artemis_learning') || 'Learning System' },
        { id: 'monitoring', label: t('artemis_monitoring') || 'System Monitoring' },
        { id: 'scenarios', label: t('artemis_scenarios') || 'Trading Scenarios' },
        { id: 'data_hub', label: t('artemis_data_hub') || 'Data Hub' },
        { id: 'backtesting', label: t('artemis_backtesting') || 'Backtesting' },
        { id: 'logs', label: t('artemis_logs') || 'System Logs' },
        { id: 'settings', label: t('artemis_settings') || 'Settings' },
    ];
    
    const refreshArtemis = async () => {
        try {
            await reloadArtemis();
        } catch (e) {
            console.error('Failed to refresh Artemis state:', e);
        }
    };
    
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('artemis_central_ai') || 'Artemis Central AI Controller'}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('artemis_description') || 'Central decision-making and coordination system for autonomous trading'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            artemis.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            artemis.status === 'standby' ? 'bg-yellow-500/20 text-yellow-400' :
                            artemis.status === 'maintenance' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-red-500/20 text-red-400'
                        }`}>
                            {t(artemis.status) || artemis.status}
                        </span>
                        <button
                            onClick={async () => {
                                const newMode = artemis.mode === 'demo' ? 'real' : 'demo';
                                if (confirm(t('switch_mode_confirm') || `Switch to ${newMode} mode? This will affect all trading operations.`)) {
                                    try {
                                        const updated = await api.updateArtemisMode(newMode);
                                        setArtemis(updated);
                                        alert(t('mode_switched') || `Mode switched to ${newMode}`);
                                    } catch (e) {
                                        console.error('Failed to switch mode:', e);
                                        alert(t('mode_switch_failed') || 'Failed to switch mode');
                                    }
                                }
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80 ${
                                artemis.mode === 'real' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}
                            title={t('click_to_switch_mode') || 'Click to switch between demo and real mode'}
                        >
                            {artemis.mode === 'real' ? '🔴 ' : '🟢 '}
                            {t(artemis.mode) || artemis.mode}
                        </button>
                    </div>
                </div>
                
                <div className="border-b border-border">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-purple-500 text-purple-400'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </Card>

            <div className="mt-6">
                {activeTab === 'overview' && data && artemis && <ArtemisOverview data={data} artemis={artemis} t={t} onRefresh={refreshArtemis} onNavigate={(tab) => setActiveTab(tab)} />}
                {activeTab === 'decision_engine' && artemis && <DecisionEngine artemis={artemis} t={t} onRefresh={refreshArtemis} />}
                {activeTab === 'orchestration' && artemis && <Orchestration artemis={artemis} t={t} onRefresh={refreshArtemis} />}
                {activeTab === 'learning' && artemis && <LearningSystem artemis={artemis} t={t} onRefresh={refreshArtemis} />}
                {activeTab === 'monitoring' && artemis && <SystemMonitoring artemis={artemis} t={t} onRefresh={refreshArtemis} />}
                {activeTab === 'scenarios' && <TradingScenarios t={t} onRefresh={refreshArtemis} />}
                {activeTab === 'data_hub' && artemis && <DataHub artemis={artemis} t={t} onRefresh={refreshArtemis} />}
                {activeTab === 'backtesting' && artemis && <Backtesting artemis={artemis} t={t} onRefresh={refreshArtemis} />}
                {activeTab === 'logs' && artemis && <SystemLogs artemis={artemis} t={t} onRefresh={refreshArtemis} />}
                {activeTab === 'settings' && artemis && <ArtemisSettings artemis={artemis} t={t} onRefresh={refreshArtemis} />}
            </div>
        </div>
    );
};

const ArtemisOverview: React.FC<{ data: AIManagerOverview; artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void; onNavigate: (tab: ArtemisTab) => void }> = ({ data, artemis, t, onRefresh, onNavigate }) => {
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [recentLogs, setRecentLogs] = useState<ArtemisLog[]>([]);
    const [scenarios, setScenarios] = useState<TradingScenario[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    
    const loadAdditionalData = async () => {
        try {
            setIsLoadingLogs(true);
            const logs = await api.fetchArtemisLogs({ limit: 5 });
            setRecentLogs(logs || []);
            const scenariosData = await api.fetchTradingScenarios();
            setScenarios(scenariosData || []);
        } catch (e) {
            console.error('Failed to load additional data:', e);
            setRecentLogs([]);
            setScenarios([]);
        } finally {
            setIsLoadingLogs(false);
        }
    };
    
    useEffect(() => {
        loadAdditionalData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    useEffect(() => {
        if (!autoRefresh) return;
        
        const interval = setInterval(() => {
            onRefresh();
            loadAdditionalData();
        }, refreshInterval * 1000);
        
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefresh, refreshInterval]);
    
    if (!artemis) {
        return <Card><div className="text-center p-10">{t('loading') || 'Loading...'}</div></Card>;
    }
    
    const dataHub = artemis.dataHub;
    const learningSystem = artemis.learningSystem;
    const orchestration = artemis.orchestration;
    
    return (
        <div className="space-y-6">
            {/* Header with Auto-refresh */}
            <Card>
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">{t('artemis_overview') || 'Artemis Overview'}</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('overview_description') || 'Comprehensive view of Artemis AI system status and performance'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <span className="text-muted-foreground">{t('auto_refresh') || 'Auto Refresh'}</span>
                        </label>
                        {autoRefresh && (
                            <select
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                                <option value="10">10s</option>
                                <option value="30">30s</option>
                                <option value="60">1m</option>
                                <option value="300">5m</option>
                            </select>
                        )}
                        <button
                            onClick={() => {
                                onRefresh();
                                loadAdditionalData();
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('refresh') || 'Refresh'}
                        </button>
                    </div>
                </div>
            </Card>
            
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                    {/* Core Metrics & System Summary */}
                <Card className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                    <h3 className="font-semibold text-foreground mb-3">{t('artemis_core_metrics') || 'Core Metrics'}</h3>
                         <div className="space-y-2">
                                <ProgressBar label={t('total_decisions') || 'Total Decisions'} value={artemis.totalDecisions || 0} />
                                <ProgressBar label={t('success_rate') || 'Success Rate'} value={artemis.successRate || 0} />
                                <ProgressBar label={t('active_agents') || 'Active Agents'} value={artemis.activeAgents?.length || 0} maxValue={15} />
                        <ProgressBar label={t('system_health') || 'System Health'} 
                                    value={artemis.systemHealth?.overall === 'healthy' ? 100 : artemis.systemHealth?.overall === 'degraded' ? 70 : 30} />
                         </div>
                    </div>
                     <div>
                            <h3 className="font-semibold text-foreground mb-3">{t('system_summary') || 'System Summary'}</h3>
                        <div className="grid grid-cols-2 gap-4 text-center">
                                <Stat value={data?.summary?.totalAgents || 0} label={t('total_agents')} />
                                <Stat value={data?.summary?.activeAgents || 0} label={t('active_agents_count')} />
                                <Stat value={data?.summary?.inTraining || 0} label={t('in_training')} />
                                <Stat value={`${(data?.summary?.avgAccuracy || 0).toFixed(1)}%`} label={t('avg_accuracy')} />
                        </div>
                    </div>
                </Card>
                    
                    {/* Decision Engine Status */}
                <Card>
                <h3 className="font-semibold text-foreground mb-3">{t('decision_engine_status') || 'Decision Engine Status'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 border border-border rounded-lg">
                        <p className="text-xs text-muted-foreground">{t('strategy') || 'Strategy'}</p>
                                <p className="font-bold text-foreground mt-1">{t(artemis.decisionEngine?.strategy) || artemis.decisionEngine?.strategy || 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 border border-border rounded-lg">
                        <p className="text-xs text-muted-foreground">{t('active_model') || 'Active Model'}</p>
                                <p className="font-bold text-foreground mt-1">{t(artemis.decisionEngine?.activeModel) || artemis.decisionEngine?.activeModel || 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 border border-border rounded-lg">
                        <p className="text-xs text-muted-foreground">{t('confidence_threshold') || 'Confidence Threshold'}</p>
                                <p className="font-bold text-foreground mt-1">{artemis.decisionEngine?.confidenceThreshold || 0}%</p>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="bg-secondary/40 rounded p-2 text-center">
                                <p className="text-muted-foreground text-xs">{t('recent_decisions') || 'Recent'}</p>
                                <p className="text-lg font-semibold text-foreground">{artemis.decisionEngine?.recentDecisions?.length || 0}</p>
                            </div>
                            <div className="bg-secondary/40 rounded p-2 text-center">
                                <p className="text-muted-foreground text-xs">{t('avg_confidence') || 'Avg Confidence'}</p>
                                <p className="text-lg font-semibold text-foreground">
                                    {artemis.decisionEngine?.recentDecisions && artemis.decisionEngine.recentDecisions.length > 0
                                        ? `${(artemis.decisionEngine.recentDecisions.reduce((sum, d) => sum + (d.output?.confidence || 0), 0) / artemis.decisionEngine.recentDecisions.length).toFixed(1)}%`
                                        : 'N/A'}
                                </p>
                            </div>
                            <div className="bg-secondary/40 rounded p-2 text-center">
                                <p className="text-muted-foreground text-xs">{t('last_decision') || 'Last Decision'}</p>
                                <p className="text-lg font-semibold text-foreground">
                                    {artemis.lastDecisionTime ? new Date(artemis.lastDecisionTime).toLocaleTimeString() : 'N/A'}
                                </p>
                            </div>
                            <div className="bg-secondary/40 rounded p-2 text-center">
                                <p className="text-muted-foreground text-xs">{t('total_decisions') || 'Total'}</p>
                                <p className="text-lg font-semibold text-foreground">{artemis.totalDecisions || 0}</p>
                    </div>
                    </div>
                </Card>
                    
                    {/* Data Hub Summary */}
                    {dataHub && (
                        <Card>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-foreground">{t('data_hub_summary') || 'Data Hub Summary'}</h3>
                                <button 
                                    onClick={() => onNavigate('data_hub')}
                                    className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                                >
                                    {t('view_details') || 'View Details'} →
                                </button>
            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div className="bg-secondary/40 rounded p-2 text-center">
                                    <p className="text-muted-foreground text-xs">{t('total_sources') || 'Total Sources'}</p>
                                    <p className="text-lg font-semibold text-foreground">{dataHub?.totalSources || 0}</p>
                                </div>
                                <div className="bg-secondary/40 rounded p-2 text-center">
                                    <p className="text-muted-foreground text-xs">{t('active_sources') || 'Active'}</p>
                                    <p className="text-lg font-semibold text-green-400">{dataHub?.activeSources || 0}</p>
                                </div>
                                <div className="bg-secondary/40 rounded p-2 text-center">
                                    <p className="text-muted-foreground text-xs">{t('cache_hit_rate') || 'Cache Hit'}</p>
                                    <p className="text-lg font-semibold text-purple-400">{dataHub?.cache?.hitRate?.toFixed(1) || '0.0'}%</p>
                                </div>
                                <div className="bg-secondary/40 rounded p-2 text-center">
                                    <p className="text-muted-foreground text-xs">{t('health_status') || 'Health'}</p>
                                    <p className={`text-lg font-semibold ${
                                        dataHub?.health?.overall === 'healthy' ? 'text-green-400' :
                                        dataHub?.health?.overall === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                        {t(dataHub?.health?.overall) || dataHub?.health?.overall || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}
                    
                    {/* Learning System Summary */}
                    {learningSystem && (
                        <Card>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-foreground">{t('learning_system_summary') || 'Learning System Summary'}</h3>
                                <button 
                                    onClick={() => onNavigate('learning')}
                                    className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                                >
                                    {t('view_details') || 'View Details'} →
                                </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div className="bg-secondary/40 rounded p-2 text-center">
                                    <p className="text-muted-foreground text-xs">{t('current_accuracy') || 'Current Accuracy'}</p>
                                    <p className="text-lg font-semibold text-foreground">{(learningSystem?.currentAccuracy || 0).toFixed(1)}%</p>
                                </div>
                                <div className="bg-secondary/40 rounded p-2 text-center">
                                    <p className="text-muted-foreground text-xs">{t('improvements') || 'Improvements'}</p>
                                    <p className="text-lg font-semibold text-green-400">{learningSystem?.improvements?.length || 0}</p>
                                </div>
                                <div className="bg-secondary/40 rounded p-2 text-center">
                                    <p className="text-muted-foreground text-xs">{t('mistakes') || 'Mistakes'}</p>
                                    <p className="text-lg font-semibold text-red-400">{learningSystem?.mistakes?.length || 0}</p>
                                </div>
                                <div className="bg-secondary/40 rounded p-2 text-center">
                                    <p className="text-muted-foreground text-xs">{t('model_versions') || 'Versions'}</p>
                                    <p className="text-lg font-semibold text-foreground">{learningSystem?.modelVersions?.length || 0}</p>
                                </div>
                            </div>
                        </Card>
                    )}
                    
                    {/* Trading Scenarios & Backtesting Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-foreground">{t('trading_scenarios') || 'Trading Scenarios'}</h3>
                                <button 
                                    onClick={() => onNavigate('scenarios')}
                                    className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                                >
                                    {t('view_all') || 'View All'} →
                                </button>
                            </div>
                            <div className="space-y-2">
                                <div className="bg-secondary/40 rounded p-2">
                                    <p className="text-muted-foreground text-xs">{t('total_scenarios') || 'Total Scenarios'}</p>
                                    <p className="text-xl font-semibold text-foreground">{scenarios.length}</p>
                                </div>
                                <div className="bg-secondary/40 rounded p-2">
                                    <p className="text-muted-foreground text-xs">{t('active_scenarios') || 'Active'}</p>
                                    <p className="text-xl font-semibold text-green-400">
                                        {scenarios.filter(s => s.status === 'active').length}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-foreground">{t('backtesting') || 'Backtesting'}</h3>
                                <button 
                                    onClick={() => onNavigate('backtesting')}
                                    className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                                >
                                    {t('view_all') || 'View All'} →
                                </button>
                            </div>
                            <div className="space-y-2">
                                <div className="bg-secondary/40 rounded p-2">
                                    <p className="text-muted-foreground text-xs">{t('recent_backtests') || 'Recent Backtests'}</p>
                                    <p className="text-xl font-semibold text-foreground">
                                        {artemis.decisionEngine?.recentDecisions?.filter(d => d.type === 'backtest').length || 0}
                                    </p>
                                </div>
                                <div className="bg-secondary/40 rounded p-2">
                                    <p className="text-muted-foreground text-xs">{t('avg_performance') || 'Avg Performance'}</p>
                                    <p className="text-xl font-semibold text-purple-400">N/A</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                    
                    {/* Recent Activity */}
                    <Card>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-foreground">{t('recent_activity') || 'Recent Activity'}</h3>
                            <button 
                                onClick={() => onNavigate('logs')}
                                className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                            >
                                {t('view_all_logs') || 'View All Logs'} →
                            </button>
                        </div>
                        {isLoadingLogs ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                                {t('loading') || 'Loading...'}
                            </div>
                        ) : recentLogs.length > 0 ? (
                            <div className="space-y-2">
                                {recentLogs.slice(0, 5).map(log => (
                                    <div key={log.id} className="flex justify-between items-start p-2 bg-secondary/40 rounded text-sm">
                                        <div className="flex-1">
                                            <p className="font-semibold text-foreground">{log.action}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {t(log.source) || log.source} · {new Date(log.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                            log.level === 'error' || log.level === 'critical' ? 'bg-red-500/20 text-red-400' :
                                            log.level === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-blue-500/20 text-blue-400'
                                        }`}>
                                            {t(log.level) || log.level}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                                {t('no_recent_activity') || 'No recent activity'}
                            </div>
                        )}
                    </Card>
                </div>
                
                {/* Sidebar */}
            <div className="space-y-6">
                    {/* System Health */}
                <Card>
                <h3 className="font-semibold text-foreground mb-3">{t('system_health') || 'System Health'}</h3>
                    <div className="space-y-2 text-sm">
                    <Metric label={t('overall_status') || 'Overall'} 
                        value={<span className={`font-semibold ${
                                    artemis.systemHealth?.overall === 'healthy' ? 'text-green-400' :
                                    artemis.systemHealth?.overall === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                                }`}>{t(artemis.systemHealth?.overall) || artemis.systemHealth?.overall || 'N/A'}</span>} />
                            <Metric label={t('cpu_usage') || 'CPU'} value={`${artemis.systemHealth?.resources?.cpu?.toFixed(1) || '0.0'}%`} />
                            <Metric label={t('memory_usage') || 'Memory'} value={`${artemis.systemHealth?.resources?.memory?.toFixed(1) || '0.0'}%`} />
                    <Metric label={t('api_quota') || 'API Quota'} 
                                value={`${artemis.systemHealth?.resources?.apiQuota?.used || 0}/${artemis.systemHealth?.resources?.apiQuota?.limit || 0}`} />
                    </div>
                </Card>
                    
                    {/* Top Agents */}
                <Card>
                        <h3 className="font-semibold text-foreground mb-3">{t('top_agents') || 'Top Agents'}</h3>
                    <div className="space-y-3">
                            {(data?.topAgents && data.topAgents.length > 0) ? (
                                data.topAgents.map(agent => (
                            <div key={agent.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-semibold text-foreground">{agent.name}</p>
                                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                                </div>
                                <span className="font-bold text-purple-400">{agent.accuracy.toFixed(1)}%</span>
                            </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                    {t('no_agents_available') || 'No agents available'}
                                </p>
                            )}
                    </div>
                </Card>
                    
                    {/* Orchestration Summary */}
                    {orchestration && (
                        <Card>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-foreground">{t('orchestration') || 'Orchestration'}</h3>
                                <button 
                                    onClick={() => onNavigate('orchestration')}
                                    className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                                >
                                    {t('view_details') || 'View Details'} →
                                </button>
                            </div>
                            <div className="space-y-2 text-sm">
                                <Metric label={t('active_tasks') || 'Active Tasks'} value={orchestration?.activeTasks?.length || 0} />
                                <Metric label={t('queued_tasks') || 'Queued Tasks'} value={orchestration?.taskQueue?.length || 0} />
                                <Metric label={t('total_agents') || 'Total Agents'} value={orchestration?.resourceAllocation?.totalAgents || 0} />
                            </div>
                        </Card>
                    )}
                    
                    {/* Quick Actions */}
                    <Card>
                        <h3 className="font-semibold text-foreground mb-3">{t('quick_actions') || 'Quick Actions'}</h3>
                        <div className="space-y-2">
                            <button 
                                onClick={() => onNavigate('decision_engine')}
                                className="block w-full text-left px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded text-sm cursor-pointer"
                            >
                                {t('make_decision') || 'Make Decision'}
                            </button>
                            <button 
                                onClick={() => onNavigate('scenarios')}
                                className="block w-full text-left px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-sm cursor-pointer"
                            >
                                {t('create_scenario') || 'Create Scenario'}
                            </button>
                            <button 
                                onClick={() => onNavigate('backtesting')}
                                className="block w-full text-left px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded text-sm cursor-pointer"
                            >
                                {t('run_backtest') || 'Run Backtest'}
                            </button>
                            <button 
                                onClick={() => onNavigate('data_hub')}
                                className="block w-full text-left px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded text-sm cursor-pointer"
                            >
                                {t('view_data_hub') || 'View Data Hub'}
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const DecisionEngine: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    const [isMakingDecision, setIsMakingDecision] = useState(false);
    const [decisionFilter, setDecisionFilter] = useState<'all' | 'trade' | 'risk_management' | 'portfolio_adjustment' | 'agent_control'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'executed' | 'failed' | 'cancelled'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

    const decisionSeries = useMemo(() => {
        const decisions = artemis.decisionEngine?.recentDecisions || [];
        return decisions.slice(-30).map((d, idx) => ({
            index: idx,
            confidence: d.output?.confidence ?? d.confidence ?? 0,
            accuracy: d.learning?.accuracy ?? null,
            wasSuccessful: d.learning?.learned ? (d.learning.accuracy ?? 0) >= 70 : null,
            timestamp: d.createdAt || d.timestamp || d.id,
        }));
    }, [artemis.decisionEngine?.recentDecisions]);
    
    const handleMakeDecision = async () => {
        setIsMakingDecision(true);
        try {
            // Simulate agent signals (in production, these would come from actual agents)
            const mockSignals: AgentSignal[] = [
                {
                    agentId: '1',
                    agentName: 'Technical Analysis',
                    signalType: 'buy',
                    confidence: 85,
                    data: { symbol: 'BTCUSDT', price: 45000 },
                    timestamp: new Date().toISOString(),
                },
                {
                    agentId: '5',
                    agentName: 'Price Prediction',
                    signalType: 'buy',
                    confidence: 78,
                    data: { symbol: 'BTCUSDT', predictedPrice: 46000 },
                    timestamp: new Date().toISOString(),
                },
            ];
            
            const decision = await api.makeArtemisDecision(mockSignals);
            alert(t('decision_made') || `Decision made: ${decision.output.action} (${decision.output.confidence}% confidence)`);
            onRefresh(); // Use onRefresh instead of reload
        } catch (e) {
            console.error('Failed to make decision:', e);
            alert(t('decision_failed') || 'Failed to make decision');
        } finally {
            setIsMakingDecision(false);
        }
    };
    
    const handleUpdateConfig = async (updates: Partial<DecisionEngineState>) => {
        setIsUpdatingConfig(true);
        try {
            await api.updateArtemisConfig({
                decisionEngine: {
                    ...artemis.decisionEngine,
                    ...updates,
                },
            });
            onRefresh();
            setShowConfigModal(false);
            alert(t('config_updated') || 'Configuration updated successfully');
        } catch (e) {
            console.error('Failed to update config:', e);
            alert(t('config_update_failed') || 'Failed to update configuration');
        } finally {
            setIsUpdatingConfig(false);
        }
    };
    
    const filteredDecisions = React.useMemo(() => {
        return artemis.decisionEngine.recentDecisions.filter(decision => {
            if (decisionFilter !== 'all' && decision.type !== decisionFilter) {
                return false;
            }
            if (statusFilter !== 'all' && decision.execution.status !== statusFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!decision.output.action.toLowerCase().includes(query) && 
                    !decision.process.method.toLowerCase().includes(query) &&
                    !decision.type.toLowerCase().includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [artemis.decisionEngine.recentDecisions, decisionFilter, statusFilter, searchQuery]);
    
    const performanceStats = React.useMemo(() => {
        const decisions = artemis.decisionEngine.recentDecisions;
        const executed = decisions.filter(d => d.execution.status === 'executed');
        const successful = executed.filter(d => d.learning.accuracy !== undefined && d.learning.accuracy >= 70);
        const avgConfidence = decisions.length > 0 
            ? decisions.reduce((sum, d) => sum + d.output.confidence, 0) / decisions.length 
            : 0;
        
        return {
            total: decisions.length,
            executed: executed.length,
            successful: successful.length,
            successRate: executed.length > 0 ? (successful.length / executed.length) * 100 : 0,
            avgConfidence,
            avgExecutionTime: artemis.decisionEngine.performance.avgExecutionTime,
        };
    }, [artemis.decisionEngine]);
    
    return (
        <div className="space-y-6">
            <Card>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h3 className="font-semibold text-foreground">{t('decision_engine_configuration') || 'Decision Engine Configuration'}</h3>
                    <p className="text-xs text-muted-foreground">
                        {t('decision_engine_desc') || 'Configure decision-making strategy, models, and thresholds'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {t('configure') || 'Configure'}
                    </button>
                    <button
                        onClick={handleMakeDecision}
                        disabled={isMakingDecision}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {isMakingDecision ? t('processing') || 'Processing...' : t('make_decision') || 'Make Decision'}
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('strategy') || 'Strategy'}</p>
                        <p className="font-semibold text-foreground">{t(artemis.decisionEngine.strategy) || artemis.decisionEngine.strategy}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('active_model') || 'Active Model'}</p>
                        <p className="font-semibold text-foreground">{t(artemis.decisionEngine.activeModel) || artemis.decisionEngine.activeModel}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('confidence_threshold') || 'Confidence Threshold'}</p>
                        <p className="font-semibold text-foreground">{artemis.decisionEngine.confidenceThreshold}%</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('performance_accuracy') || 'Performance Accuracy'}</p>
                        <p className="font-semibold text-foreground">{artemis.decisionEngine.performance.accuracy.toFixed(1)}%</p>
                    </div>
                </div>
            {performanceStats.total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('total_decisions') || 'Total'}</p>
                        <p className="text-xl font-semibold text-foreground">{performanceStats.total}</p>
                    </div>
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('executed') || 'Executed'}</p>
                        <p className="text-xl font-semibold text-blue-400">{performanceStats.executed}</p>
                    </div>
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('successful') || 'Successful'}</p>
                        <p className="text-xl font-semibold text-green-400">{performanceStats.successful}</p>
                    </div>
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('success_rate') || 'Success Rate'}</p>
                        <p className="text-xl font-semibold text-foreground">{performanceStats.successRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('avg_confidence') || 'Avg Confidence'}</p>
                        <p className="text-xl font-semibold text-foreground">{performanceStats.avgConfidence.toFixed(1)}%</p>
                    </div>
                </div>
            )}
            </Card>
        
            <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-foreground">{t('recent_decisions') || 'Recent Decisions'}</h3>
                <div className="flex gap-2">
                    <select
                        value={decisionFilter}
                        onChange={(e) => setDecisionFilter(e.target.value as any)}
                        className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                    >
                        <option value="all">{t('all_types') || 'All Types'}</option>
                        <option value="trade">{t('trade') || 'Trade'}</option>
                        <option value="risk_management">{t('risk_management') || 'Risk Management'}</option>
                        <option value="portfolio_adjustment">{t('portfolio_adjustment') || 'Portfolio Adjustment'}</option>
                        <option value="agent_control">{t('agent_control') || 'Agent Control'}</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                    >
                        <option value="all">{t('all_statuses') || 'All Statuses'}</option>
                        <option value="pending">{t('pending') || 'Pending'}</option>
                        <option value="executed">{t('executed') || 'Executed'}</option>
                        <option value="failed">{t('failed') || 'Failed'}</option>
                        <option value="cancelled">{t('cancelled') || 'Cancelled'}</option>
                    </select>
                </div>
            </div>

            {/* Decision Performance Chart */}
            <Card>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h4 className="font-semibold text-foreground">{t('decision_performance') || 'Decision Performance'}</h4>
                        <p className="text-xs text-muted-foreground">
                            {t('decision_performance_desc') || 'Recent decisions confidence & success'}
                        </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {t('last_n_decisions', { n: decisionSeries.length }) || `Last ${decisionSeries.length} decisions`}
                    </div>
                </div>
                {decisionSeries.length >= 2 ? (
                    <div className="h-48 w-full bg-[#0d0f19] rounded-md border border-border flex items-center justify-center">
                        <svg width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none">
                            {/* Grid */}
                            {[1,2,3,4,5].map(i => (
                                <line key={`row-${i}`} x1="0" y1={i*30} x2="500" y2={i*30} stroke="#1f2434" strokeWidth="1" />
                            ))}
                            {/* Confidence line */}
                            {(() => {
                                const maxConf = Math.max(...decisionSeries.map(d => d.confidence), 100);
                                const minConf = Math.min(...decisionSeries.map(d => d.confidence), 0);
                                const range = maxConf - minConf || 1;
                                const points = decisionSeries.map((d, i) => {
                                    const x = (i / Math.max(decisionSeries.length - 1, 1)) * 500;
                                    const y = 170 - ((d.confidence - minConf) / range) * 150;
                                    return `${x},${y}`;
                                }).join(' ');
                                return <polyline points={points} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />;
                            })()}
                            {/* Accuracy markers */}
                            {(() => {
                                const maxAcc = 100;
                                const minAcc = 0;
                                const range = maxAcc - minAcc || 1;
                                return decisionSeries.map((d, i) => {
                                    const x = (i / Math.max(decisionSeries.length - 1, 1)) * 500;
                                    const y = 170 - (( (d.accuracy ?? d.confidence) - minAcc) / range) * 150;
                                    const color = d.wasSuccessful === null ? '#9ca3af' : d.wasSuccessful ? '#22c55e' : '#ef4444';
                                    return <circle key={`acc-${i}`} cx={x} cy={y} r={4} fill={color} opacity="0.9" />;
                                });
                            })()}
                        </svg>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">{t('not_enough_data') || 'Not enough data to render chart.'}</p>
                )}
            </Card>
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_decisions') || 'Search decisions...'}
                className="w-full px-2 py-1 mb-2 bg-background border border-border rounded text-xs text-foreground"
            />
            {filteredDecisions.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredDecisions.slice(0, 20).map(decision => (
                        <div 
                            key={decision.id} 
                            className="p-3 border border-border rounded-lg text-sm hover:border-purple-500/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedDecision(decision)}
                        >
                                <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-foreground">{t(decision.type) || decision.type}</p>
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                            decision.execution.status === 'executed' ? 'bg-green-500/20 text-green-400' :
                                            decision.execution.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                            decision.execution.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400' :
                                            'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {t(decision.execution.status) || decision.execution.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{new Date(decision.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                        decision.output.confidence >= 80 ? 'bg-green-500/20 text-green-400' :
                                        decision.output.confidence >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-red-500/20 text-red-400'
                                    }`}>
                                        {decision.output.confidence}%
                                    </span>
                                </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    <p>{t('method') || 'Method'}: {t(decision.process.method) || decision.process.method}</p>
                                    <p>{t('action') || 'Action'}: {t(decision.output.action) || decision.output.action}</p>
                                    {decision.learning.learned && decision.learning.accuracy !== undefined && (
                                        <p className="mt-1">
                                            {t('accuracy') || 'Accuracy'}: <span className={decision.learning.accuracy >= 70 ? 'text-green-400' : 'text-red-400'}>
                                                {decision.learning.accuracy}%
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                <p className="text-center text-muted-foreground py-10">{t('no_decisions_found') || 'No decisions found.'}</p>
                )}
            </Card>
        
        {selectedDecision && (
            <DecisionDetailsModal
                decision={selectedDecision}
                onClose={() => setSelectedDecision(null)}
                t={t}
            />
        )}
        
        {showConfigModal && (
            <DecisionConfigModal
                decisionEngine={artemis.decisionEngine}
                onClose={() => setShowConfigModal(false)}
                onUpdate={handleUpdateConfig}
                isUpdating={isUpdatingConfig}
                t={t}
            />
        )}
        </div>
    );
};

// Decision Details Modal
const DecisionDetailsModal: React.FC<{
    decision: Decision;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ decision, onClose, t }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{t(decision.type) || decision.type}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('decision_details') || 'Decision Details'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
                        {t('close') || 'Close'}
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('timestamp') || 'Timestamp'}</p>
                            <p className="text-sm font-semibold text-foreground">{new Date(decision.timestamp).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('status') || 'Status'}</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                decision.execution.status === 'executed' ? 'bg-green-500/20 text-green-400' :
                                decision.execution.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                decision.execution.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400' :
                                'bg-yellow-500/20 text-yellow-400'
                            }`}>
                                {t(decision.execution.status) || decision.execution.status}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('confidence') || 'Confidence'}</p>
                            <p className="text-sm font-semibold text-foreground">{decision.output.confidence}%</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('method') || 'Method'}</p>
                            <p className="text-sm font-semibold text-foreground">{t(decision.process.method) || decision.process.method}</p>
                        </div>
                    </div>
                    
                    <div>
                        <p className="text-xs text-muted-foreground mb-2">{t('action') || 'Action'}</p>
                        <p className="text-sm font-semibold text-foreground bg-secondary/40 p-3 rounded border border-border">
                            {decision.output.action}
                        </p>
                    </div>
                    
                    <div>
                        <p className="text-xs text-muted-foreground mb-2">{t('reasoning') || 'Reasoning'}</p>
                        <p className="text-sm text-foreground bg-secondary/40 p-3 rounded border border-border">
                            {decision.process.reasoning}
                        </p>
                    </div>
                    
                    {decision.input.signals && decision.input.signals.length > 0 && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">{t('input_signals') || 'Input Signals'}</p>
                            <div className="space-y-2">
                                {decision.input.signals.map((signal, idx) => (
                                    <div key={idx} className="p-2 bg-secondary/40 rounded border border-border text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-foreground">{signal.agentName || signal.agentId}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded ${
                                                    signal.signalType === 'buy' || signal.signalType === 'entry' ? 'bg-green-500/20 text-green-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                    {t(signal.signalType) || signal.signalType}
                                                </span>
                                                <span className="text-muted-foreground">{signal.confidence}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {decision.learning.learned && decision.learning.accuracy !== undefined && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('learning_accuracy') || 'Learning Accuracy'}</p>
                            <p className={`text-sm font-semibold ${decision.learning.accuracy >= 70 ? 'text-green-400' : 'text-red-400'}`}>
                                {decision.learning.accuracy}%
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Decision Config Modal
const DecisionConfigModal: React.FC<{
    decisionEngine: DecisionEngineState;
    onClose: () => void;
    onUpdate: (updates: Partial<DecisionEngineState>) => Promise<void>;
    isUpdating: boolean;
    t: (key: string) => string;
}> = ({ decisionEngine, onClose, onUpdate, isUpdating, t }) => {
    const [strategy, setStrategy] = useState(decisionEngine.strategy);
    const [activeModel, setActiveModel] = useState(decisionEngine.activeModel);
    const [confidenceThreshold, setConfidenceThreshold] = useState(decisionEngine.confidenceThreshold);
    
    const handleSubmit = async () => {
        await onUpdate({
            strategy,
            activeModel,
            confidenceThreshold,
        });
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-foreground">{t('configure_decision_engine') || 'Configure Decision Engine'}</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
                        {t('close') || 'Close'}
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('strategy') || 'Strategy'}</label>
                        <select
                            value={strategy}
                            onChange={(e) => setStrategy(e.target.value as any)}
                            className="w-full p-2 bg-background border border-border rounded text-foreground"
                        >
                            <option value="voting">{t('voting') || 'Voting'}</option>
                            <option value="weighted">{t('weighted') || 'Weighted'}</option>
                            <option value="mixture_of_experts">{t('mixture_of_experts') || 'Mixture of Experts'}</option>
                            <option value="consensus">{t('consensus') || 'Consensus'}</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('active_model') || 'Active Model'}</label>
                        <select
                            value={activeModel}
                            onChange={(e) => setActiveModel(e.target.value as any)}
                            className="w-full p-2 bg-background border border-border rounded text-foreground"
                        >
                            <option value="internal">{t('internal') || 'Internal'}</option>
                            <option value="claude">{t('claude') || 'Claude'}</option>
                            <option value="gemini">{t('gemini') || 'Gemini'}</option>
                            <option value="openai">{t('openai') || 'OpenAI'}</option>
                            <option value="deepseek">{t('deepseek') || 'DeepSeek'}</option>
                            <option value="openrouter">{t('openrouter') || 'OpenRouter'}</option>
                            <option value="hybrid">{t('hybrid') || 'Hybrid'}</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            {t('confidence_threshold') || 'Confidence Threshold'} (%)
                        </label>
                        <input
                            type="number"
                            value={confidenceThreshold}
                            onChange={(e) => setConfidenceThreshold(parseInt(e.target.value) || 0)}
                            className="w-full p-2 bg-background border border-border rounded text-foreground"
                            min="0"
                            max="100"
                        />
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isUpdating}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isUpdating}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isUpdating ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Orchestration: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    
    const taskStats = React.useMemo(() => {
        const tasks = artemis.orchestration.agentTasks;
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            running: tasks.filter(t => t.status === 'running').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            completionRate: tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0,
        };
    }, [artemis.orchestration.agentTasks]);
    
    const filteredTasks = React.useMemo(() => {
        return artemis.orchestration.agentTasks.filter(task => {
            if (taskFilter !== 'all' && task.status !== taskFilter) {
                return false;
            }
            if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!task.agentId.toLowerCase().includes(query) && 
                    !task.task.toLowerCase().includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [artemis.orchestration.agentTasks, taskFilter, priorityFilter, searchQuery]);
    
    const formatDuration = (assignedAt: string, completedAt?: string) => {
        const start = new Date(assignedAt).getTime();
        const end = completedAt ? new Date(completedAt).getTime() : Date.now();
        const duration = Math.floor((end - start) / 1000); // seconds
        if (duration < 60) return `${duration}s`;
        if (duration < 3600) return `${Math.floor(duration / 60)}m`;
        return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
    };
    
    const handleCancelTask = async (task: AgentTask) => {
        if (!confirm(t('cancel_task_confirm') || `Cancel task "${task.task}" for agent "${task.agentId}"?`)) {
            return;
        }
        try {
            // In production, this would call an API to cancel the task
            alert(t('task_cancelled') || 'Task cancelled successfully');
            onRefresh();
        } catch (e) {
            console.error('Failed to cancel task:', e);
            alert(t('cancel_task_failed') || 'Failed to cancel task');
        }
    };
    
    const handleRetryTask = async (task: AgentTask) => {
        if (!confirm(t('retry_task_confirm') || `Retry task "${task.task}" for agent "${task.agentId}"?`)) {
            return;
        }
        try {
            // In production, this would call an API to retry the task
            alert(t('task_retried') || 'Task retried successfully');
            onRefresh();
        } catch (e) {
            console.error('Failed to retry task:', e);
            alert(t('retry_task_failed') || 'Failed to retry task');
        }
    };
    
    return (
    <div className="space-y-6">
        <Card>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h3 className="font-semibold text-foreground">{t('agent_orchestration') || 'Agent Orchestration'}</h3>
                    <p className="text-xs text-muted-foreground">
                        {t('orchestration_desc') || 'Manage agent coordination, task distribution, and resource allocation'}
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center">
                <Stat value={artemis.orchestration.activeAgents} label={t('active_agents') || 'Active Agents'} />
                <Stat value={artemis.orchestration.agentTasks.length} label={t('total_tasks') || 'Total Tasks'} />
                <Stat value={Object.keys(artemis.orchestration.resourceAllocation).length} label={t('allocated_resources') || 'Allocated Resources'} />
                <Stat value={`${taskStats.completionRate.toFixed(1)}%`} label={t('completion_rate') || 'Completion Rate'} />
            </div>
            {taskStats.total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('pending') || 'Pending'}</p>
                        <p className="text-xl font-semibold text-yellow-400">{taskStats.pending}</p>
                    </div>
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('running') || 'Running'}</p>
                        <p className="text-xl font-semibold text-blue-400">{taskStats.running}</p>
                    </div>
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('completed') || 'Completed'}</p>
                        <p className="text-xl font-semibold text-green-400">{taskStats.completed}</p>
                    </div>
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('failed') || 'Failed'}</p>
                        <p className="text-xl font-semibold text-red-400">{taskStats.failed}</p>
                    </div>
                    <div className="bg-secondary/40 rounded p-3">
                        <p className="text-muted-foreground text-xs">{t('completion_rate') || 'Completion Rate'}</p>
                        <p className="text-xl font-semibold text-foreground">{taskStats.completionRate.toFixed(1)}%</p>
                    </div>
                </div>
            )}
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('agent_tasks') || 'Agent Tasks'}</h3>
                    <div className="flex gap-2">
                        <select
                            value={taskFilter}
                            onChange={(e) => setTaskFilter(e.target.value as any)}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        >
                            <option value="all">{t('all_statuses') || 'All Statuses'}</option>
                            <option value="pending">{t('pending') || 'Pending'}</option>
                            <option value="running">{t('running') || 'Running'}</option>
                            <option value="completed">{t('completed') || 'Completed'}</option>
                            <option value="failed">{t('failed') || 'Failed'}</option>
                        </select>
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value as any)}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        >
                            <option value="all">{t('all_priorities') || 'All Priorities'}</option>
                            <option value="low">{t('low') || 'Low'}</option>
                            <option value="medium">{t('medium') || 'Medium'}</option>
                            <option value="high">{t('high') || 'High'}</option>
                            <option value="critical">{t('critical') || 'Critical'}</option>
                        </select>
                    </div>
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search_tasks') || 'Search tasks...'}
                    className="w-full px-2 py-1 mb-2 bg-background border border-border rounded text-xs text-foreground"
                />
                {filteredTasks.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredTasks.map(task => (
                            <div 
                                key={`${task.agentId}-${task.task}-${task.assignedAt}`} 
                                className="p-3 border border-border rounded-lg text-sm hover:border-purple-500/50 transition-colors cursor-pointer"
                                onClick={() => setSelectedTask(task)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold text-foreground">{task.agentId}</p>
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                task.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                                task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-gray-500/20 text-gray-400'
                                            }`}>
                                                {t(task.priority) || task.priority}
                                            </span>
                                        </div>
                                    <p className="text-xs text-muted-foreground">{task.task}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('assigned_at') || 'Assigned'}: {new Date(task.assignedAt).toLocaleString()}
                                        </p>
                                        {task.completedAt && (
                                            <p className="text-xs text-muted-foreground">
                                                {t('completed_at') || 'Completed'}: {new Date(task.completedAt).toLocaleString()}
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            {t('duration') || 'Duration'}: {formatDuration(task.assignedAt, task.completedAt)}
                                        </p>
                                </div>
                                    <div className="flex flex-col items-end gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                    task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                    task.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                                    task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {t(task.status) || task.status}
                                </span>
                                        {(task.status === 'running' || task.status === 'pending') && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancelTask(task);
                                                }}
                                                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                            >
                                                {t('cancel') || 'Cancel'}
                                            </button>
                                        )}
                                        {task.status === 'failed' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRetryTask(task);
                                                }}
                                                className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                                            >
                                                {t('retry') || 'Retry'}
                                            </button>
                                        )}
                                    </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                    <p className="text-center text-muted-foreground py-10">{t('no_tasks_found') || 'No tasks found.'}</p>
            )}
        </Card>
            
            <Card>
                <h3 className="font-semibold text-foreground mb-4">{t('resource_allocation') || 'Resource Allocation'}</h3>
                {Object.keys(artemis.orchestration.resourceAllocation).length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {Object.entries(artemis.orchestration.resourceAllocation).map(([agentId, allocation]) => (
                            <div 
                                key={agentId}
                                className="p-3 border border-border rounded-lg text-sm hover:border-purple-500/50 transition-colors cursor-pointer"
                                onClick={() => setSelectedAgent(agentId)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <p className="font-semibold text-foreground">{agentId}</p>
                                    <span className="text-xs text-muted-foreground">
                                        {t('priority') || 'Priority'}: {allocation.priority}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">{t('cpu_usage') || 'CPU'}</span>
                                            <span className="text-foreground">{allocation.cpu.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-secondary rounded-full h-2">
                                            <div 
                                                className="bg-blue-500 h-2 rounded-full" 
                                                style={{width: `${allocation.cpu}%`}}
                                            ></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">{t('memory_usage') || 'Memory'}</span>
                                            <span className="text-foreground">{allocation.memory.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-secondary rounded-full h-2">
                                            <div 
                                                className="bg-purple-500 h-2 rounded-full" 
                                                style={{width: `${allocation.memory}%`}}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('max_concurrent_tasks') || 'Max Concurrent Tasks'}: {allocation.maxConcurrentTasks}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-10">{t('no_resource_allocation') || 'No resource allocation configured.'}</p>
                )}
            </Card>
        </div>
        
        {artemis.orchestration.failoverStatus.enabled && (
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('failover_status') || 'Failover Status'}</h3>
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                        {t('enabled') || 'Enabled'}
                    </span>
                </div>
                {artemis.orchestration.failoverStatus.lastFailover && (
                    <div className="p-3 border border-border rounded-lg text-sm">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-foreground">
                                    {t('last_failover') || 'Last Failover'}: {artemis.orchestration.failoverStatus.lastFailover.fromAgent} → {artemis.orchestration.failoverStatus.lastFailover.toAgent}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {artemis.orchestration.failoverStatus.lastFailover.reason}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(artemis.orchestration.failoverStatus.lastFailover.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {Object.keys(artemis.orchestration.failoverStatus.fallbackAgents).length > 0 && (
                    <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-2">{t('fallback_agents') || 'Fallback Agents'}</p>
                        <div className="space-y-2">
                            {Object.entries(artemis.orchestration.failoverStatus.fallbackAgents).map(([agentId, fallbacks]) => (
                                <div key={agentId} className="p-2 border border-border rounded text-xs">
                                    <span className="font-semibold text-foreground">{agentId}</span>
                                    <span className="text-muted-foreground ml-2">→</span>
                                    <span className="text-foreground ml-2">{fallbacks.join(', ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Card>
        )}
        
        {selectedTask && (
            <TaskDetailsModal
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                onCancel={handleCancelTask}
                onRetry={handleRetryTask}
                t={t}
            />
        )}
        
        {selectedAgent && (
            <AgentResourceModal
                agentId={selectedAgent}
                allocation={artemis.orchestration.resourceAllocation[selectedAgent]}
                onClose={() => setSelectedAgent(null)}
                t={t}
            />
        )}
    </div>
);
};

// Task Details Modal
const TaskDetailsModal: React.FC<{
    task: AgentTask;
    onClose: () => void;
    onCancel: (task: AgentTask) => void;
    onRetry: (task: AgentTask) => void;
    t: (key: string) => string;
}> = ({ task, onClose, onCancel, onRetry, t }) => {
    const formatDuration = (assignedAt: string, completedAt?: string) => {
        const start = new Date(assignedAt).getTime();
        const end = completedAt ? new Date(completedAt).getTime() : Date.now();
        const duration = Math.floor((end - start) / 1000);
        if (duration < 60) return `${duration}s`;
        if (duration < 3600) return `${Math.floor(duration / 60)}m`;
        return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{task.agentId}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('task_details') || 'Task Details'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
                        {t('close') || 'Close'}
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('task') || 'Task'}</p>
                            <p className="text-sm font-semibold text-foreground">{task.task}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('status') || 'Status'}</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                task.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                                task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                'bg-gray-500/20 text-gray-400'
                            }`}>
                                {t(task.status) || task.status}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('priority') || 'Priority'}</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                task.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-gray-400'
                            }`}>
                                {t(task.priority) || task.priority}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('duration') || 'Duration'}</p>
                            <p className="text-sm font-semibold text-foreground">{formatDuration(task.assignedAt, task.completedAt)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('assigned_at') || 'Assigned At'}</p>
                            <p className="text-sm font-semibold text-foreground">{new Date(task.assignedAt).toLocaleString()}</p>
                        </div>
                        {task.completedAt && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">{t('completed_at') || 'Completed At'}</p>
                                <p className="text-sm font-semibold text-foreground">{new Date(task.completedAt).toLocaleString()}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-2 pt-4 border-t border-border">
                        {(task.status === 'running' || task.status === 'pending') && (
                            <button
                                onClick={() => {
                                    onCancel(task);
                                    onClose();
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                            >
                                {t('cancel') || 'Cancel'}
                            </button>
                        )}
                        {task.status === 'failed' && (
                            <button
                                onClick={() => {
                                    onRetry(task);
                                    onClose();
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                            >
                                {t('retry') || 'Retry'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Agent Resource Modal
const AgentResourceModal: React.FC<{
    agentId: string;
    allocation: ResourceAllocation;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ agentId, allocation, onClose, t }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{agentId}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('resource_allocation') || 'Resource Allocation'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
                        {t('close') || 'Close'}
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('priority') || 'Priority'}</p>
                        <p className="text-sm font-semibold text-foreground">{allocation.priority}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-2">{t('cpu_usage') || 'CPU Usage'}</p>
                        <div className="w-full bg-secondary rounded-full h-3">
                            <div 
                                className="bg-blue-500 h-3 rounded-full" 
                                style={{width: `${allocation.cpu}%`}}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">{allocation.cpu.toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-2">{t('memory_usage') || 'Memory Usage'}</p>
                        <div className="w-full bg-secondary rounded-full h-3">
                            <div 
                                className="bg-purple-500 h-3 rounded-full" 
                                style={{width: `${allocation.memory}%`}}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">{allocation.memory.toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('max_concurrent_tasks') || 'Max Concurrent Tasks'}</p>
                        <p className="text-sm font-semibold text-foreground">{allocation.maxConcurrentTasks}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LearningSystem: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    const [improvementFilter, setImprovementFilter] = useState<'all' | string>('all');
    const [mistakeFilter, setMistakeFilter] = useState<'all' | 'learned' | 'pending'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedImprovement, setSelectedImprovement] = useState<any>(null);
    const [selectedMistake, setSelectedMistake] = useState<any>(null);
    const [isTriggeringTraining, setIsTriggeringTraining] = useState(false);
    
    const handleTriggerTraining = async () => {
        if (!confirm(t('trigger_training_confirm') || 'Trigger manual training session?')) {
            return;
        }
        setIsTriggeringTraining(true);
        try {
            // In production, this would call an API to trigger training
            alert(t('training_triggered') || 'Training session triggered. This may take some time.');
            // Simulate training completion after a delay
            setTimeout(() => {
                onRefresh();
                setIsTriggeringTraining(false);
            }, 2000);
        } catch (e) {
            console.error('Failed to trigger training:', e);
            alert(t('training_trigger_failed') || 'Failed to trigger training');
            setIsTriggeringTraining(false);
        }
    };
    
    const improvementAreas = React.useMemo(() => {
        const areas = new Set(artemis.learningSystem.improvements.map(i => i.area));
        return Array.from(areas);
    }, [artemis.learningSystem.improvements]);
    
    const filteredImprovements = React.useMemo(() => {
        return artemis.learningSystem.improvements.filter(improvement => {
            if (improvementFilter !== 'all' && improvement.area !== improvementFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!improvement.area.toLowerCase().includes(query) && 
                    !improvement.method.toLowerCase().includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [artemis.learningSystem.improvements, improvementFilter, searchQuery]);
    
    const filteredMistakes = React.useMemo(() => {
        return artemis.learningSystem.mistakes.filter(mistake => {
            if (mistakeFilter === 'learned' && !mistake.learned) {
                return false;
            }
            if (mistakeFilter === 'pending' && mistake.learned) {
                return false;
            }
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!mistake.type.toLowerCase().includes(query) && 
                    !mistake.correction.toLowerCase().includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [artemis.learningSystem.mistakes, mistakeFilter, searchQuery]);
    
    const accuracyStats = React.useMemo(() => {
        if (artemis.learningSystem.accuracyHistory.length === 0) {
            return null;
        }
        const history = artemis.learningSystem.accuracyHistory;
        const latest = history[history.length - 1];
        const previous = history.length > 1 ? history[history.length - 2] : latest;
        const trend = latest.accuracy - previous.accuracy;
        const avgAccuracy = history.reduce((sum, e) => sum + e.accuracy, 0) / history.length;
        const maxAccuracy = Math.max(...history.map(e => e.accuracy));
        const minAccuracy = Math.min(...history.map(e => e.accuracy));
        
        return {
            current: latest.accuracy,
            trend,
            avgAccuracy,
            maxAccuracy,
            minAccuracy,
        };
    }, [artemis.learningSystem.accuracyHistory]);
    
    const improvementRate = React.useMemo(() => {
        if (artemis.learningSystem.improvements.length === 0) return 0;
        const recentImprovements = artemis.learningSystem.improvements
            .filter(i => new Date(i.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        return recentImprovements.length;
    }, [artemis.learningSystem.improvements]);
    
    return (
    <div className="space-y-6">
        <Card>
            <h3 className="font-semibold text-foreground mb-4">{t('learning_system_status') || 'Learning System Status'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Stat value={artemis.learningSystem.totalDecisions} label={t('total_decisions') || 'Total Decisions'} />
                <Stat value={artemis.learningSystem.totalTrades} label={t('total_trades') || 'Total Trades'} />
                <Stat value={artemis.learningSystem.improvements.length} label={t('improvements') || 'Improvements'} />
                <Stat value={artemis.learningSystem.mistakes.length} label={t('mistakes') || 'Mistakes'} />
            </div>
            <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('active_learning') || 'Active Learning'}:</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                    artemis.learningSystem.activeLearning ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                    {artemis.learningSystem.activeLearning ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                </span>
                <span className="text-muted-foreground ml-4">{t('last_training') || 'Last Training'}:</span>
                <span className="text-foreground">{new Date(artemis.learningSystem.lastTraining).toLocaleString()}</span>
            </div>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('recent_improvements') || 'Recent Improvements'}</h3>
                    <select
                        value={improvementFilter}
                        onChange={(e) => setImprovementFilter(e.target.value)}
                        className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                    >
                        <option value="all">{t('all_areas') || 'All Areas'}</option>
                        {improvementAreas.map(area => (
                            <option key={area} value={area}>{area}</option>
                        ))}
                    </select>
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search_improvements') || 'Search improvements...'}
                    className="w-full px-2 py-1 mb-2 bg-background border border-border rounded text-xs text-foreground"
                />
                {filteredImprovements.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredImprovements.slice(0, 10).map(improvement => (
                            <div 
                                key={improvement.id} 
                                className="p-3 border border-border rounded-lg text-sm hover:border-purple-500/50 transition-colors cursor-pointer"
                                onClick={() => setSelectedImprovement(improvement)}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-foreground">{improvement.area}</p>
                                        <p className="text-xs text-muted-foreground">{improvement.method}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(improvement.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-green-400 font-semibold">+{improvement.improvement.toFixed(1)}%</span>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {improvement.before.toFixed(1)}% → {improvement.after.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-10">{t('no_improvements_found') || 'No improvements found.'}</p>
                )}
            </Card>
            
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('recent_mistakes') || 'Recent Mistakes'}</h3>
                    <select
                        value={mistakeFilter}
                        onChange={(e) => setMistakeFilter(e.target.value as any)}
                        className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                    >
                        <option value="all">{t('all') || 'All'}</option>
                        <option value="learned">{t('learned') || 'Learned'}</option>
                        <option value="pending">{t('pending') || 'Pending'}</option>
                    </select>
                </div>
                {filteredMistakes.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredMistakes.slice(0, 10).map(mistake => (
                            <div 
                                key={mistake.id} 
                                className="p-3 border border-border rounded-lg text-sm hover:border-purple-500/50 transition-colors cursor-pointer"
                                onClick={() => setSelectedMistake(mistake)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-foreground">{t(mistake.type) || mistake.type}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{mistake.correction}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(mistake.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                            mistake.learned ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {mistake.learned ? t('learned') || 'Learned' : t('pending') || 'Pending'}
                                        </span>
                                        <p className="text-xs text-red-400 mt-1">Error: {mistake.error.toFixed(1)}%</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-10">{t('no_mistakes_found') || 'No mistakes found.'}</p>
                )}
            </Card>
        </div>
        
        {artemis.learningSystem.modelVersions.length > 0 && (
            <Card>
                <h3 className="font-semibold text-foreground mb-4">{t('model_versions') || 'Model Versions'}</h3>
                <div className="space-y-2">
                    {artemis.learningSystem.modelVersions.map((version, idx) => (
                        <div key={idx} className="p-3 border border-border rounded-lg text-sm">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-foreground">v{version.version}</span>
                                        {version.active && (
                                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
                                                {t('active') || 'Active'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t('trained_at') || 'Trained at'}: {new Date(version.trainedAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-foreground">
                                        {t('accuracy') || 'Accuracy'}: {version.accuracy.toFixed(1)}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t('performance') || 'Performance'}: {version.performance.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        )}
        
        {artemis.learningSystem.accuracyHistory.length > 0 && (
            <Card>
                <h3 className="font-semibold text-foreground mb-4">{t('accuracy_history') || 'Accuracy History'}</h3>
                <div className="space-y-2">
                    {artemis.learningSystem.accuracyHistory.slice(-14).map((entry, idx) => {
                        const prevEntry = idx > 0 ? artemis.learningSystem.accuracyHistory.slice(-14)[idx - 1] : null;
                        const trend = prevEntry ? entry.accuracy - prevEntry.accuracy : 0;
                        return (
                        <div key={idx} className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground w-24">{new Date(entry.date).toLocaleDateString()}</span>
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="flex-1 bg-secondary rounded-full h-3 relative">
                                        <div 
                                            className="bg-purple-500 h-3 rounded-full transition-all" 
                                        style={{width: `${entry.accuracy}%`}}
                                    ></div>
                                </div>
                                    <div className="flex items-center gap-2 w-24 justify-end">
                                        <span className="font-semibold text-foreground">{entry.accuracy.toFixed(1)}%</span>
                                        {trend !== 0 && (
                                            <span className={`text-xs ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {trend > 0 ? '↑' : '↓'}
                                            </span>
                                        )}
                            </div>
                        </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        )}
        
        {selectedImprovement && (
            <ImprovementDetailsModal
                improvement={selectedImprovement}
                onClose={() => setSelectedImprovement(null)}
                t={t}
            />
        )}
        
        {selectedMistake && (
            <MistakeDetailsModal
                mistake={selectedMistake}
                onClose={() => setSelectedMistake(null)}
                t={t}
            />
        )}
    </div>
);
};

// Improvement Details Modal
const ImprovementDetailsModal: React.FC<{
    improvement: any;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ improvement, onClose, t }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{improvement.area}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('improvement_details') || 'Improvement Details'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
                        {t('close') || 'Close'}
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('method') || 'Method'}</p>
                            <p className="text-sm font-semibold text-foreground">{improvement.method}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('timestamp') || 'Timestamp'}</p>
                            <p className="text-sm font-semibold text-foreground">{new Date(improvement.timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                    
                    <div>
                        <p className="text-xs text-muted-foreground mb-2">{t('improvement_progress') || 'Improvement Progress'}</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{t('before') || 'Before'}</span>
                                <span className="text-foreground font-semibold">{improvement.before.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                                <div 
                                    className="bg-red-500 h-2 rounded-full" 
                                    style={{width: `${improvement.before}%`}}
                                ></div>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{t('after') || 'After'}</span>
                                <span className="text-foreground font-semibold">{improvement.after.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                                <div 
                                    className="bg-green-500 h-2 rounded-full" 
                                    style={{width: `${improvement.after}%`}}
                                ></div>
                            </div>
                            <div className="flex justify-between text-sm mt-2">
                                <span className="text-muted-foreground">{t('improvement') || 'Improvement'}</span>
                                <span className="text-green-400 font-semibold">+{improvement.improvement.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Mistake Details Modal
const MistakeDetailsModal: React.FC<{
    mistake: any;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ mistake, onClose, t }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{t(mistake.type) || mistake.type}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('mistake_details') || 'Mistake Details'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
                        {t('close') || 'Close'}
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('status') || 'Status'}</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                mistake.learned ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                                {mistake.learned ? t('learned') || 'Learned' : t('pending') || 'Pending'}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('error_rate') || 'Error Rate'}</p>
                            <p className="text-sm font-semibold text-red-400">{mistake.error.toFixed(1)}%</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('decision_id') || 'Decision ID'}</p>
                            <p className="text-sm font-semibold text-foreground">{mistake.decisionId}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('timestamp') || 'Timestamp'}</p>
                            <p className="text-sm font-semibold text-foreground">{new Date(mistake.timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                    
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('correction') || 'Correction'}</p>
                        <p className="text-sm text-foreground bg-secondary/40 p-3 rounded border border-border">
                            {mistake.correction}
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('prediction') || 'Prediction'}</p>
                            <p className="text-sm text-foreground bg-secondary/40 p-2 rounded">
                                {typeof mistake.prediction === 'object' ? JSON.stringify(mistake.prediction, null, 2) : mistake.prediction}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('actual') || 'Actual'}</p>
                            <p className="text-sm text-foreground bg-secondary/40 p-2 rounded">
                                {typeof mistake.actual === 'object' ? JSON.stringify(mistake.actual, null, 2) : mistake.actual}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SystemMonitoring: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [lastHealthCheck, setLastHealthCheck] = useState<string | null>(null);
    const [agentFilter, setAgentFilter] = useState<'all' | 'active' | 'inactive' | 'error' | 'training'>('all');
    const [integrationFilter, setIntegrationFilter] = useState<'all' | 'connected' | 'disconnected' | 'error'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<AgentHealth | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(30); // seconds
    const [healthHistory, setHealthHistory] = useState<Array<{ timestamp: string; overall: string; agents: number; alerts: number }>>([]);
    
    React.useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                handleHealthCheck(true);
            }, autoRefreshInterval * 1000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, autoRefreshInterval]);
    
    const handleHealthCheck = async (silent = false) => {
        setIsCheckingHealth(true);
        try {
            const health = await api.checkSystemHealth();
            setLastHealthCheck(new Date().toISOString());
            
            // Add to history
            setHealthHistory(prev => [
                {
                    timestamp: new Date().toISOString(),
                    overall: health.overall,
                    agents: health.agents.length,
                    alerts: health.alerts.filter(a => !a.resolved).length,
                },
                ...prev.slice(0, 49), // Keep last 50
            ]);
            
            if (!silent) {
            alert(t('health_check_complete') || `Health check complete. Overall: ${t(health.overall) || health.overall}`);
            }
            onRefresh(); // Refresh instead of reload
        } catch (e) {
            console.error('Failed to check health:', e);
            if (!silent) {
            alert(t('health_check_failed') || 'Failed to check system health');
            }
        } finally {
            setIsCheckingHealth(false);
        }
    };
    
    const handleResolveAlert = async (alertId: string) => {
        try {
            const artemis = await api.fetchArtemisState();
            const alert = artemis.systemHealth.alerts.find(a => a.id === alertId);
            if (alert) {
                alert.resolved = true;
                artemis.systemHealth.alerts = artemis.systemHealth.alerts.map(a => 
                    a.id === alertId ? { ...a, resolved: true } : a
                );
                await api.updateArtemisConfig(artemis);
                onRefresh();
            }
        } catch (e) {
            console.error('Failed to resolve alert:', e);
            alert(t('resolve_alert_failed') || 'Failed to resolve alert');
        }
    };
    
    const handleDismissAlert = async (alertId: string) => {
        try {
            const artemis = await api.fetchArtemisState();
            artemis.systemHealth.alerts = artemis.systemHealth.alerts.filter(a => a.id !== alertId);
            await api.updateArtemisConfig(artemis);
            onRefresh();
        } catch (e) {
            console.error('Failed to dismiss alert:', e);
            alert(t('dismiss_alert_failed') || 'Failed to dismiss alert');
        }
    };
    
    const filteredAgents = React.useMemo(() => {
        return artemis.systemHealth.agents.filter(agent => {
            if (agentFilter !== 'all' && agent.status !== agentFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!agent.agentId.toLowerCase().includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [artemis.systemHealth.agents, agentFilter, searchQuery]);
    
    const filteredIntegrations = React.useMemo(() => {
        return artemis.systemHealth.integrations.filter(integration => {
            if (integrationFilter !== 'all' && integration.status !== integrationFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!integration.name.toLowerCase().includes(query) && 
                    !integration.type.toLowerCase().includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [artemis.systemHealth.integrations, integrationFilter, searchQuery]);
    
    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                    <h3 className="font-semibold text-foreground">{t('system_health_monitoring') || 'System Health Monitoring'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('monitoring_desc') || 'Monitor system health, agents, integrations, and resources'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <span className="text-muted-foreground">{t('auto_refresh') || 'Auto Refresh'}</span>
                        </label>
                        {autoRefresh && (
                            <select
                                value={autoRefreshInterval}
                                onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                                <option value="10">10s</option>
                                <option value="30">30s</option>
                                <option value="60">1m</option>
                                <option value="300">5m</option>
                            </select>
                        )}
                        <button
                            onClick={() => handleHealthCheck(false)}
                            disabled={isCheckingHealth}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isCheckingHealth ? t('checking') || 'Checking...' : t('check_health') || 'Check Health'}
                        </button>
                        {lastHealthCheck && (
                            <span className="text-xs text-muted-foreground self-center">
                                {t('last_check') || 'Last check'}: {new Date(lastHealthCheck).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-muted-foreground">{t('overall_status') || 'Overall Status'}:</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            artemis.systemHealth.overall === 'healthy' ? 'bg-green-500/20 text-green-400' :
                            artemis.systemHealth.overall === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                        }`}>
                            {t(artemis.systemHealth.overall) || artemis.systemHealth.overall}
                        </span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-sm text-muted-foreground">{t('agent_health') || 'Agent Health'}</p>
                            <select
                                value={agentFilter}
                                onChange={(e) => setAgentFilter(e.target.value as any)}
                                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                                <option value="all">{t('all') || 'All'}</option>
                                <option value="active">{t('active') || 'Active'}</option>
                                <option value="inactive">{t('inactive') || 'Inactive'}</option>
                                <option value="error">{t('error') || 'Error'}</option>
                                <option value="training">{t('training') || 'Training'}</option>
                            </select>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('search_agents') || 'Search agents...'}
                            className="w-full px-2 py-1 mb-2 bg-background border border-border rounded text-xs text-foreground"
                        />
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {filteredAgents.length > 0 ? (
                                filteredAgents.map(agent => (
                                    <div 
                                        key={agent.agentId} 
                                        className="p-2 border border-border rounded text-xs hover:border-purple-500/50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedAgent(agent)}
                                    >
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold">{agent.agentId}</span>
                                        <span className={`px-2 py-0.5 rounded ${
                                            agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                            agent.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                                agent.status === 'training' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {t(agent.status) || agent.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-muted-foreground">
                                        <span>CPU: {agent.resourceUsage.cpu.toFixed(1)}%</span>
                                        <span>Mem: {agent.resourceUsage.memory.toFixed(1)}%</span>
                                        <span>API: {agent.resourceUsage.apiCalls}</span>
                                    </div>
                                        <div className="grid grid-cols-2 gap-2 mt-1 text-xs text-muted-foreground">
                                            <span>{t('performance') || 'Performance'}: {agent.performance.toFixed(1)}%</span>
                                            <span>{t('uptime') || 'Uptime'}: {formatUptime(agent.uptime)}</span>
                                    </div>
                                    {agent.errors.length > 0 && (
                                        <div className="mt-1 text-xs text-red-400">
                                                {t('errors') || 'Errors'}: {agent.errors.join(', ')}
                                        </div>
                                    )}
                                </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                    {t('no_agents_found') || 'No agents found'}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-sm text-muted-foreground">{t('integrations') || 'Integrations'}</p>
                            <select
                                value={integrationFilter}
                                onChange={(e) => setIntegrationFilter(e.target.value as any)}
                                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                                <option value="all">{t('all') || 'All'}</option>
                                <option value="connected">{t('connected') || 'Connected'}</option>
                                <option value="disconnected">{t('disconnected') || 'Disconnected'}</option>
                                <option value="error">{t('error') || 'Error'}</option>
                            </select>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {filteredIntegrations.length > 0 ? (
                                filteredIntegrations.map((integration, idx) => (
                                <div key={idx} className="p-2 border border-border rounded text-xs">
                                    <div className="flex justify-between items-center">
                                            <div>
                                        <span className="font-semibold">{integration.name}</span>
                                                <span className="ml-2 text-xs text-muted-foreground">({t(integration.type) || integration.type})</span>
                                            </div>
                                        <span className={`px-2 py-0.5 rounded ${
                                            integration.status === 'connected' ? 'bg-green-500/20 text-green-400' :
                                                integration.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                                'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {t(integration.status) || integration.status}
                                        </span>
                                    </div>
                                        {integration.latency !== undefined && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('latency') || 'Latency'}: {integration.latency}ms
                                        </p>
                                    )}
                                    {integration.errorRate !== undefined && (
                                        <p className="text-xs text-muted-foreground">
                                            {t('error_rate') || 'Error Rate'}: {integration.errorRate.toFixed(2)}%
                                        </p>
                                    )}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('last_check') || 'Last check'}: {new Date(integration.lastCheck).toLocaleString()}
                                        </p>
                                </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                    {t('no_integrations_found') || 'No integrations found'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('cpu_usage') || 'CPU Usage'}</p>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div 
                                className="bg-blue-500 h-2 rounded-full" 
                                style={{width: `${artemis.systemHealth.resources.cpu}%`}}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">{artemis.systemHealth.resources.cpu.toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('memory_usage') || 'Memory Usage'}</p>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div 
                                className="bg-purple-500 h-2 rounded-full" 
                                style={{width: `${artemis.systemHealth.resources.memory}%`}}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">{artemis.systemHealth.resources.memory.toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('network_usage') || 'Network Usage'}</p>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{width: `${artemis.systemHealth.resources.network}%`}}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">{artemis.systemHealth.resources.network.toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('api_quota') || 'API Quota'}</p>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div 
                                className="bg-yellow-500 h-2 rounded-full" 
                                style={{width: `${(artemis.systemHealth.resources.apiQuota.used / artemis.systemHealth.resources.apiQuota.limit) * 100}%`}}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">
                            {artemis.systemHealth.resources.apiQuota.used}/{artemis.systemHealth.resources.apiQuota.limit}
                        </p>
                    </div>
                </div>
            </Card>
            
            {artemis.orchestration.failoverStatus.lastFailover && (
                <Card>
                    <h3 className="font-semibold text-foreground mb-4">{t('failover_status') || 'Failover Status'}</h3>
                    <div className="p-3 border border-border rounded-lg text-sm">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-foreground">
                                    {t('last_failover') || 'Last Failover'}: {artemis.orchestration.failoverStatus.lastFailover.fromAgent} → {artemis.orchestration.failoverStatus.lastFailover.toAgent}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {artemis.orchestration.failoverStatus.lastFailover.reason}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(artemis.orchestration.failoverStatus.lastFailover.timestamp).toLocaleString()}
                                </p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                                artemis.orchestration.failoverStatus.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>
                                {artemis.orchestration.failoverStatus.enabled ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                            </span>
                        </div>
                    </div>
                </Card>
            )}
            
            {artemis.systemHealth.alerts.length > 0 && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('system_alerts') || 'System Alerts'}</h3>
                        <span className="text-xs text-muted-foreground">
                            {artemis.systemHealth.alerts.filter(a => !a.resolved).length} {t('unresolved') || 'unresolved'}
                        </span>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {artemis.systemHealth.alerts
                            .sort((a, b) => {
                                // Sort: unresolved first, then by type (critical > warning > info)
                                if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
                                const typeOrder = { critical: 0, error: 1, warning: 2, info: 3 };
                                return (typeOrder[a.type] || 3) - (typeOrder[b.type] || 3);
                            })
                            .map(alert => (
                            <div key={alert.id} className={`p-3 border rounded-lg text-sm ${
                                alert.type === 'critical' ? 'border-red-500 bg-red-500/10' :
                                alert.type === 'error' ? 'border-red-500/70 bg-red-500/5' :
                                alert.type === 'warning' ? 'border-yellow-500 bg-yellow-500/10' :
                                'border-blue-500 bg-blue-500/10'
                            }`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="font-semibold text-foreground">{alert.message}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('source') || 'Source'}: {alert.source} · {new Date(alert.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                        alert.resolved ? 'bg-green-500/20 text-green-400' :
                                        alert.type === 'critical' ? 'bg-red-500/20 text-red-400' :
                                            alert.type === 'error' ? 'bg-red-500/20 text-red-400' :
                                        alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {alert.resolved ? t('resolved') || 'Resolved' : t(alert.type) || alert.type}
                                    </span>
                                        {!alert.resolved && (
                                            <button
                                                onClick={() => handleResolveAlert(alert.id)}
                                                className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                                                title={t('resolve_alert') || 'Resolve Alert'}
                                            >
                                                ✓
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDismissAlert(alert.id)}
                                            className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
                                            title={t('dismiss_alert') || 'Dismiss Alert'}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            
            {healthHistory.length > 0 && (
                <Card>
                    <h3 className="font-semibold text-foreground mb-4">{t('health_history') || 'Health Check History'}</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {healthHistory.slice(0, 10).map((entry, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 border border-border rounded text-xs">
                                <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 rounded ${
                                        entry.overall === 'healthy' ? 'bg-green-500/20 text-green-400' :
                                        entry.overall === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-red-500/20 text-red-400'
                                    }`}>
                                        {t(entry.overall) || entry.overall}
                                    </span>
                                    <span className="text-muted-foreground">{entry.agents} {t('agents') || 'agents'}</span>
                                    {entry.alerts > 0 && (
                                        <span className="text-red-400">{entry.alerts} {t('alerts') || 'alerts'}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            
            {selectedAgent && (
                <AgentDetailsModal
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    t={t}
                />
            )}
        </div>
    );
};

const TradingScenarios: React.FC<{ t: (key: string) => string; onRefresh: () => void }> = ({ t, onRefresh }) => {
    const [scenarios, setScenarios] = React.useState<TradingScenario[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [showEditModal, setShowEditModal] = React.useState(false);
    const [editingScenario, setEditingScenario] = React.useState<TradingScenario | null>(null);
    const [viewingScenario, setViewingScenario] = React.useState<TradingScenario | null>(null);
    const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'paused' | 'completed' | 'cancelled'>('all');
    const [typeFilter, setTypeFilter] = React.useState<'all' | 'target_profit' | 'max_trades' | 'risk_reward' | 'custom'>('all');
    
    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchTradingScenarios();
                setScenarios(data);
            } catch (e) {
                console.error('Failed to load scenarios:', e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);
    
    const filteredScenarios = React.useMemo(() => {
        return scenarios.filter(scenario => {
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!scenario.name.toLowerCase().includes(query)) {
                    return false;
                }
            }
            if (statusFilter !== 'all' && scenario.status !== statusFilter) {
                return false;
            }
            if (typeFilter !== 'all' && scenario.type !== typeFilter) {
                return false;
            }
            return true;
        });
    }, [scenarios, searchQuery, statusFilter, typeFilter]);
    
    const scenarioStats = React.useMemo(() => {
        const stats = {
            total: scenarios.length,
            active: scenarios.filter(s => s.status === 'active').length,
            paused: scenarios.filter(s => s.status === 'paused').length,
            completed: scenarios.filter(s => s.status === 'completed').length,
            totalTrades: scenarios.reduce((sum, s) => sum + s.trades.length, 0),
            totalProfit: scenarios.reduce((sum, s) => {
                const tradesProfit = s.trades.reduce((tSum, t) => tSum + (t.profit || 0), 0);
                return sum + tradesProfit;
            }, 0),
        };
        return stats;
    }, [scenarios]);
    
    const handleGenerateAIStrategy = async () => {
        setIsGeneratingAI(true);
        try {
            const newScenario = await api.generateAITradingScenario();
            setScenarios([newScenario, ...scenarios]);
            alert(t('ai_strategy_generated') || `AI strategy "${newScenario.name}" generated successfully!`);
        } catch (e) {
            console.error('Failed to generate AI strategy:', e);
            alert(t('ai_strategy_failed') || 'Failed to generate AI strategy. Please try again.');
        } finally {
            setIsGeneratingAI(false);
        }
    };
    
    if (isLoading) {
        return <Card><div className="text-center p-10">{t('loading')}</div></Card>;
    }
    
    const handleRunBacktest = async (scenarioId: string) => {
        if (!confirm(t('scenario_backtest_confirm') || 'Run backtest for this scenario?')) {
            return;
        }
        // Navigate to backtesting tab with scenario pre-selected
        // This would require parent component coordination, for now just show message
        alert(t('scenario_backtest_note') || 'Please go to Backtesting tab and select this scenario to run backtest.');
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                    <h3 className="font-semibold text-foreground">{t('trading_scenarios') || 'Trading Scenarios'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('scenarios_desc') || 'Create and manage trading scenarios with specific targets and rules'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleGenerateAIStrategy}
                            disabled={isGeneratingAI}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm flex items-center gap-2"
                        >
                            {isGeneratingAI ? (
                                <>
                                    <span className="animate-spin">⚙️</span>
                                    {t('generating_ai_strategy') || 'Generating AI Strategy...'}
                                </>
                            ) : (
                                <>
                                    <span>🤖</span>
                                    {t('generate_ai_strategy') || 'Generate AI Strategy'}
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('create_scenario') || '+ Create Scenario'}
                        </button>
                    </div>
                </div>
                
                {scenarios.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('total_scenarios') || 'Total'}</p>
                            <p className="text-xl font-semibold text-foreground">{scenarioStats.total}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('active_scenarios') || 'Active'}</p>
                            <p className="text-xl font-semibold text-green-400">{scenarioStats.active}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('total_trades') || 'Total Trades'}</p>
                            <p className="text-xl font-semibold text-foreground">{scenarioStats.totalTrades}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('total_profit') || 'Total Profit'}</p>
                            <p className={`text-xl font-semibold ${scenarioStats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ${scenarioStats.totalProfit.toFixed(2)}
                            </p>
                        </div>
                    </div>
                )}
                
                {scenarios.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('search_scenarios') || 'Search scenarios...'}
                            className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                        >
                            <option value="all">{t('all_statuses') || 'All Statuses'}</option>
                            <option value="active">{t('active') || 'Active'}</option>
                            <option value="paused">{t('paused') || 'Paused'}</option>
                            <option value="completed">{t('completed') || 'Completed'}</option>
                            <option value="cancelled">{t('cancelled') || 'Cancelled'}</option>
                        </select>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                        >
                            <option value="all">{t('all_types') || 'All Types'}</option>
                            <option value="target_profit">{t('target_profit') || 'Target Profit'}</option>
                            <option value="max_trades">{t('max_trades') || 'Max Trades'}</option>
                            <option value="risk_reward">{t('risk_reward') || 'Risk/Reward'}</option>
                            <option value="custom">{t('custom') || 'Custom'}</option>
                        </select>
                    </div>
                )}
                
                {filteredScenarios.length > 0 ? (
                    <div className="space-y-3">
                        {filteredScenarios.map(scenario => {
                            const tradesProfit = scenario.trades.reduce((sum, t) => sum + (t.profit || 0), 0);
                            const profitableTrades = scenario.trades.filter(t => (t.profit || 0) > 0).length;
                            const winRate = scenario.trades.length > 0 ? (profitableTrades / scenario.trades.length) * 100 : 0;
                            
                            return (
                            <div key={scenario.id} className="p-4 border border-border rounded-lg hover:border-purple-500/50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-foreground">{scenario.name}</p>
                                            {scenario.name.includes('AI') || scenario.name.includes('Artemis') ? (
                                                <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 rounded-full text-xs font-semibold flex items-center gap-1">
                                                    <span>🤖</span>
                                                    <span>AI</span>
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t(scenario.type) || scenario.type} · {t(scenario.status) || scenario.status}
                                        </p>
                                        {(scenario.target as any)?.description && (
                                            <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-purple-500/30 pl-2">
                                                💡 {(scenario.target as any).description}
                                            </p>
                                        )}
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                        scenario.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                        scenario.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                                        scenario.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-gray-500/20 text-gray-400'
                                    }`}>
                                        {t(scenario.status) || scenario.status}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                    {scenario.target.profit && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('target_profit') || 'Target Profit'}</p>
                                            <p className="font-semibold text-foreground">${scenario.target.profit.toFixed(2)}</p>
                                        </div>
                                    )}
                                    {scenario.target.maxTrades && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('max_trades') || 'Max Trades'}</p>
                                            <p className="font-semibold text-foreground">{scenario.target.maxTrades}</p>
                                        </div>
                                    )}
                                    {scenario.target.riskRewardRatio && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('risk_reward_ratio') || 'Risk/Reward'}</p>
                                            <p className="font-semibold text-foreground">{scenario.target.riskRewardRatio.toFixed(2)}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('progress') || 'Progress'}</p>
                                        <p className="font-semibold text-foreground">{scenario.progress.percentage.toFixed(1)}%</p>
                                    </div>
                                </div>
                                
                                {scenario.trades.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">{t('current_profit') || 'Current Profit'}</p>
                                            <p className={`font-semibold ${tradesProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                ${tradesProfit.toFixed(2)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">{t('win_rate') || 'Win Rate'}</p>
                                            <p className="font-semibold text-foreground">{winRate.toFixed(1)}%</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">{t('profitable_trades') || 'Profitable'}</p>
                                            <p className="font-semibold text-foreground">{profitableTrades}/{scenario.trades.length}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">{t('avg_profit') || 'Avg Profit'}</p>
                                            <p className={`font-semibold ${tradesProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                ${scenario.trades.length > 0 ? (tradesProfit / scenario.trades.length).toFixed(2) : '0.00'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="w-full bg-secondary rounded-full h-2 mb-2">
                                    <div 
                                        className="bg-purple-500 h-2 rounded-full" 
                                        style={{width: `${scenario.progress.percentage}%`}}
                                    ></div>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <div className="text-xs text-muted-foreground">
                                        <span>{t('trades') || 'Trades'}: {scenario.trades.length}</span>
                                        <span className="ml-3">{new Date(scenario.updatedAt).toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {scenario.trades.length > 0 && (
                                            <button
                                                onClick={() => setViewingScenario(scenario)}
                                                className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded"
                                            >
                                                {t('view_trades') || 'View Trades'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRunBacktest(scenario.id)}
                                            className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                                        >
                                            {t('run_backtest') || 'Backtest'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingScenario(scenario);
                                                setShowEditModal(true);
                                            }}
                                            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                                        >
                                            {t('edit') || 'Edit'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const confirmed = window.confirm(
                                                    t('confirm_delete_scenario') || `Are you sure you want to delete "${scenario.name}"?`
                                                );
                                                if (confirmed) {
                                                    try {
                                                        await api.deleteTradingScenario(scenario.id);
                                                        setScenarios(scenarios.filter(s => s.id !== scenario.id));
                                                        alert(t('scenario_deleted') || 'Scenario deleted successfully');
                                                    } catch (e) {
                                                        console.error('Failed to delete scenario:', e);
                                                        alert(t('delete_failed') || 'Failed to delete scenario');
                                                    }
                                                }
                                            }}
                                            className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                        >
                                            {t('delete') || 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                        })}
                    </div>
                ) : scenarios.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground mb-4">{t('no_scenarios') || 'No trading scenarios created yet.'}</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('create_first_scenario') || 'Create First Scenario'}
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">{t('no_scenarios_match') || 'No scenarios match your filters.'}</p>
                    </div>
                )}
            </Card>
            
            {showCreateModal && (
                <CreateScenarioModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={async (scenario) => {
                        const newScenario = await api.createTradingScenario(scenario);
                        setScenarios([...scenarios, newScenario]);
                        setShowCreateModal(false);
                    }}
                    t={t}
                />
            )}
            
            {showEditModal && editingScenario && (
                <EditScenarioModal
                    scenario={editingScenario}
                    onClose={() => {
                        setShowEditModal(false);
                        setEditingScenario(null);
                    }}
                    onUpdate={async (updates) => {
                        const updated = await api.updateTradingScenario(editingScenario.id, updates);
                        setScenarios(scenarios.map(s => s.id === editingScenario.id ? updated : s));
                        setShowEditModal(false);
                        setEditingScenario(null);
                    }}
                    t={t}
                />
            )}
            
            {viewingScenario && (
                <ScenarioTradesModal
                    scenario={viewingScenario}
                    onClose={() => setViewingScenario(null)}
                    t={t}
                />
            )}
        </div>
    );
};

// Scenario Trades Modal
const ScenarioTradesModal: React.FC<{
    scenario: TradingScenario;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ scenario, onClose, t }) => {
    const tradesProfit = scenario.trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const profitableTrades = scenario.trades.filter(t => (t.profit || 0) > 0).length;
    const winRate = scenario.trades.length > 0 ? (profitableTrades / scenario.trades.length) * 100 : 0;
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{scenario.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('trades') || 'Trades'}: {scenario.trades.length}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
                        {t('close') || 'Close'}
                    </button>
                </div>
                
                {scenario.trades.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                            <div className="bg-secondary/40 rounded p-3">
                                <p className="text-muted-foreground text-xs">{t('total_profit') || 'Total Profit'}</p>
                                <p className={`text-xl font-semibold ${tradesProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ${tradesProfit.toFixed(2)}
                                </p>
                            </div>
                            <div className="bg-secondary/40 rounded p-3">
                                <p className="text-muted-foreground text-xs">{t('win_rate') || 'Win Rate'}</p>
                                <p className="text-xl font-semibold text-foreground">{winRate.toFixed(1)}%</p>
                            </div>
                            <div className="bg-secondary/40 rounded p-3">
                                <p className="text-muted-foreground text-xs">{t('profitable_trades') || 'Profitable'}</p>
                                <p className="text-xl font-semibold text-foreground">{profitableTrades}/{scenario.trades.length}</p>
                            </div>
                            <div className="bg-secondary/40 rounded p-3">
                                <p className="text-muted-foreground text-xs">{t('avg_profit') || 'Avg Profit'}</p>
                                <p className={`text-xl font-semibold ${tradesProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ${(tradesProfit / scenario.trades.length).toFixed(2)}
                                </p>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            {scenario.trades.map(trade => (
                                <div key={trade.id} className="border border-border rounded-lg p-3 text-sm">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-foreground">{trade.symbol}</span>
                                                <span className={`px-2 py-0.5 rounded text-xs ${
                                                    trade.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                    {t(trade.type) || trade.type}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-xs ${
                                                    trade.status === 'executed' ? 'bg-green-500/20 text-green-400' :
                                                    trade.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                                    trade.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {t(trade.status) || trade.status}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                                                <span>{t('amount') || 'Amount'}: {trade.amount}</span>
                                                <span>{t('price') || 'Price'}: ${trade.price.toFixed(2)}</span>
                                                {trade.profit !== undefined && (
                                                    <span className={trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                        {t('profit') || 'Profit'}: ${trade.profit.toFixed(2)}
                                                    </span>
                                                )}
                                                <span>{new Date(trade.executedAt).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        {t('no_trades') || 'No trades executed for this scenario yet.'}
                    </div>
                )}
            </div>
        </div>
    );
};

// Edit Scenario Modal
const EditScenarioModal: React.FC<{
    scenario: TradingScenario;
    onClose: () => void;
    onUpdate: (updates: Partial<TradingScenario>) => Promise<void>;
    t: (key: string) => string;
}> = ({ scenario, onClose, onUpdate, t }) => {
    const [name, setName] = React.useState(scenario.name);
    const [type, setType] = React.useState<'target_profit' | 'max_trades' | 'risk_reward' | 'custom'>(scenario.type);
    const [status, setStatus] = React.useState<'active' | 'paused' | 'completed' | 'cancelled'>(scenario.status);
    const [targetProfit, setTargetProfit] = React.useState(
        scenario.target.profit || scenario.target.riskRewardRatio || 0
    );
    const [maxTrades, setMaxTrades] = React.useState(scenario.target.maxTrades || 0);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    
    const handleSubmit = async () => {
        if (!name) {
            alert(t('scenario_name_required') || 'Scenario name is required');
            return;
        }
        
        setIsSubmitting(true);
        try {
            const target: TradingScenario['target'] = {};
            if (type === 'target_profit') {
                if (targetProfit <= 0) {
                    alert(t('target_profit_required') || 'Target profit must be greater than 0');
                    return;
                }
                target.profit = targetProfit;
            } else if (type === 'max_trades') {
                if (maxTrades <= 0) {
                    alert(t('max_trades_required') || 'Max trades must be greater than 0');
                    return;
                }
                target.maxTrades = maxTrades;
            } else if (type === 'risk_reward') {
                if (targetProfit <= 0) {
                    alert(t('risk_reward_required') || 'Risk/Reward ratio must be greater than 0');
                    return;
                }
                target.riskRewardRatio = targetProfit;
            } else if (type === 'custom') {
                try {
                    target.customRules = JSON.parse(targetProfit.toString());
                } catch {
                    target.customRules = { description: targetProfit.toString() };
                }
            }
            
            await onUpdate({
                name,
                type,
                status,
                target,
            });
        } catch (e) {
            console.error('Failed to update scenario:', e);
            alert(t('update_failed') || 'Failed to update scenario');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-foreground mb-4">{t('edit_scenario') || 'Edit Scenario'}</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            {t('name') || 'Name'} *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-background border border-border rounded text-foreground"
                            placeholder={t('scenario_name') || 'Scenario name'}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('type') || 'Type'}</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="target_profit">{t('target_profit') || 'Target Profit'}</option>
                            <option value="max_trades">{t('max_trades') || 'Max Trades'}</option>
                            <option value="risk_reward">{t('risk_reward') || 'Risk/Reward'}</option>
                            <option value="custom">{t('custom') || 'Custom'}</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('status') || 'Status'}</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="active">{t('active') || 'Active'}</option>
                            <option value="paused">{t('paused') || 'Paused'}</option>
                            <option value="completed">{t('completed') || 'Completed'}</option>
                            <option value="cancelled">{t('cancelled') || 'Cancelled'}</option>
                        </select>
                    </div>
                    
                    {type === 'target_profit' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">{t('target_profit') || 'Target Profit'} ($)</label>
                            <input
                                type="number"
                                value={targetProfit}
                                onChange={(e) => setTargetProfit(parseFloat(e.target.value) || 0)}
                                className="w-full p-2 bg-background border border-border rounded text-foreground"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    )}
                    
                    {type === 'max_trades' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">{t('max_trades') || 'Max Trades'}</label>
                            <input
                                type="number"
                                value={maxTrades}
                                onChange={(e) => setMaxTrades(parseInt(e.target.value) || 0)}
                                className="w-full p-2 bg-background border border-border rounded text-foreground"
                                min="1"
                            />
                        </div>
                    )}
                    {type === 'risk_reward' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">{t('risk_reward_ratio') || 'Risk/Reward Ratio'}</label>
                            <input
                                type="number"
                                value={targetProfit}
                                onChange={(e) => setTargetProfit(parseFloat(e.target.value) || 0)}
                                className="w-full p-2 bg-background border border-border rounded text-foreground"
                                placeholder="1.5"
                                min="0.1"
                                step="0.1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('risk_reward_hint') || 'Example: 1.5 means risk $1 to gain $1.5'}
                            </p>
                        </div>
                    )}
                    {type === 'custom' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">{t('custom_rules') || 'Custom Rules'}</label>
                            <textarea
                                value={JSON.stringify(scenario.target.customRules || {}, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        setTargetProfit(parsed);
                                    } catch {
                                        // Invalid JSON, keep as is
                                    }
                                }}
                                className="w-full p-2 bg-background border border-border rounded text-foreground text-xs font-mono"
                                placeholder={t('custom_rules_placeholder') || 'Enter custom rules as JSON...'}
                                rows={4}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('custom_rules_hint') || 'Define custom trading rules for this scenario'}
                            </p>
                        </div>
                    )}
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSubmitting}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSubmitting ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CreateScenarioModal: React.FC<{
    onClose: () => void;
    onCreate: (scenario: Omit<TradingScenario, 'id' | 'createdAt' | 'updatedAt' | 'trades' | 'progress'>) => Promise<void>;
    t: (key: string) => string;
}> = ({ onClose, onCreate, t }) => {
    const [name, setName] = React.useState('');
    const [type, setType] = React.useState<'target_profit' | 'max_trades' | 'risk_reward' | 'custom'>('target_profit');
    const [targetProfit, setTargetProfit] = React.useState(0);
    const [maxTrades, setMaxTrades] = React.useState(0);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    
    const handleSubmit = async () => {
        if (!name) {
            alert(t('scenario_name_required') || 'Scenario name is required');
            return;
        }
        
        setIsSubmitting(true);
        try {
            const target: TradingScenario['target'] = {};
            if (type === 'target_profit') {
                if (targetProfit <= 0) {
                    alert(t('target_profit_required') || 'Target profit must be greater than 0');
                    return;
                }
                target.profit = targetProfit;
            } else if (type === 'max_trades') {
                if (maxTrades <= 0) {
                    alert(t('max_trades_required') || 'Max trades must be greater than 0');
                    return;
                }
                target.maxTrades = maxTrades;
            } else if (type === 'risk_reward') {
                if (targetProfit <= 0) {
                    alert(t('risk_reward_required') || 'Risk/Reward ratio must be greater than 0');
                    return;
                }
                target.riskRewardRatio = targetProfit;
            } else if (type === 'custom') {
                try {
                    target.customRules = JSON.parse(targetProfit.toString());
                } catch {
                    target.customRules = { description: targetProfit.toString() };
                }
            }
            
            await onCreate({
                name,
                type,
                target,
                status: 'active',
            });
        } catch (e) {
            console.error('Failed to create scenario:', e);
            alert(t('create_failed') || 'Failed to create scenario');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-foreground mb-4">{t('create_scenario') || 'Create Trading Scenario'}</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('scenario_name') || 'Scenario Name'}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('enter_scenario_name') || 'Enter scenario name'}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('scenario_type') || 'Scenario Type'}</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="target_profit">{t('target_profit') || 'Target Profit'}</option>
                            <option value="max_trades">{t('max_trades') || 'Max Trades'}</option>
                            <option value="risk_reward">{t('risk_reward') || 'Risk/Reward'}</option>
                            <option value="custom">{t('custom') || 'Custom'}</option>
                        </select>
                    </div>
                    
                    {type === 'target_profit' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">{t('target_profit_amount') || 'Target Profit ($)'}</label>
                            <input
                                type="number"
                                value={targetProfit}
                                onChange={(e) => setTargetProfit(parseFloat(e.target.value) || 0)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                placeholder="0"
                            />
                        </div>
                    )}
                    
                    {type === 'max_trades' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">{t('max_trades_count') || 'Max Trades'}</label>
                            <input
                                type="number"
                                value={maxTrades}
                                onChange={(e) => setMaxTrades(parseInt(e.target.value) || 0)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                placeholder="0"
                            />
                        </div>
                    )}
                </div>
                
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-secondary hover:bg-accent text-secondary-foreground font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {isSubmitting ? t('creating') || 'Creating...' : t('create') || 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProgressBar: React.FC<{label: string, value: number, maxValue?: number}> = ({ label, value, maxValue = 100 }) => (
    <div>
        <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground font-semibold">{value}</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full" style={{width: `${(value / maxValue) * 100}%`}}></div>
        </div>
    </div>
);

const Stat: React.FC<{ value: string|number, label: string }> = ({ value, label }) => (
    <div className="bg-secondary p-3 rounded-lg">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
    </div>
);

const Metric: React.FC<{label: string, value: React.ReactNode}> = ({label, value}) => (
    <div className="flex justify-between items-center">
        <span className="text-card-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
    </div>
);

type AgentTopicFormValues = {
    title: string;
    description?: string;
    agentId: string;
    agentName?: string;
    categoryIds: string[];
    dataTypes: string[];
    tags: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    minPassRate?: number;
    minQualityScore?: number;
    includeStatuses: NormalizedDataStatus[];
    publisherTargets: string[];
    enabled: boolean;
};

const QueuePreviewModal: React.FC<{
    item: PublisherQueueItem;
    topic: AgentTopicRoute | null;
    publisherName?: string;
    record: NormalizedDataRecord | null;
    agent?: AIAgent;
    onClose: () => void;
    onPublish: () => Promise<void> | void;
    t: (key: string) => string;
    processingId: string | null;
}> = ({ item, topic, publisherName, record, agent, onClose, onPublish, t, processingId }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{t('automation_preview_title') || 'Preview'}</h3>
                        <p className="text-xs text-muted-foreground">{topic?.title || item.topicId} → {publisherName || item.publisherId}</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">{t('close') || 'Close'}</button>
                </div>
                <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-secondary/30 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('automation_queue_quality') || 'Quality'}</p>
                            <p className="text-foreground font-semibold">{item.qualityScore}</p>
                            <p className="text-muted-foreground mt-1">{t('priority') || 'Priority'}: {t(item.priority) || item.priority}</p>
                            <p className="text-muted-foreground mt-1">{t('normalized_status_' + item.normalizedStatus) || item.normalizedStatus}</p>
                        </div>
                        <div className="bg-secondary/30 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('automation_preview_agent') || 'Agent'}</p>
                            <p className="text-foreground font-semibold">{agent?.name || item.agentId}</p>
                            <p className="text-muted-foreground mt-1">{topic?.description || '-'}</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('automation_preview_payload') || 'Payload'}</p>
                        <div className="bg-secondary/30 border border-border rounded p-3 text-sm text-foreground space-y-2">
                            <p className="font-semibold">{record?.payload?.title || item.payloadPreview}</p>
                            {record?.payload?.content && (
                                <p className="text-muted-foreground whitespace-pre-wrap">{record.payload.content}</p>
                            )}
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                                <span>{t('source') || 'Source'}: {record?.sourceId || '-'}</span>
                                <span>{t('data_type') || 'Data type'}: {record?.dataType || item.dataType}</span>
                                <span>{t('category') || 'Category'}: {record?.category || item.category}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={onPublish}
                        disabled={processingId === item.id + 'sent'}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {processingId === item.id + 'sent' ? (t('processing') || 'Processing...') : (t('automation_queue_publish_now') || 'Publish now')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Data Hub Component
const DataHub: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    const [dataHub, setDataHub] = useState<DataHubState | null>(artemis.dataHub || null);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [isLoadingAgents, setIsLoadingAgents] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(!artemis.dataHub);
    const [isSavingCrawler, setIsSavingCrawler] = useState(false);
    const [isDeletingCrawler, setIsDeletingCrawler] = useState<string | null>(null);
    const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);
    const [isRunningPrioritization, setIsRunningPrioritization] = useState(false);
    const [isSavingAccess, setIsSavingAccess] = useState(false);
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
    const [isDispatchingAutomation, setIsDispatchingAutomation] = useState(false);
    const telegramCollectorUrl = typeof api.getTelegramCollectorBaseUrl === 'function' ? api.getTelegramCollectorBaseUrl() : undefined;
    const telegramCollectorState = dataHub?.telegramCollector;    const telegramChannels = telegramCollectorState?.channels || [];
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
            return;
        }
        let cancelled = false;
        const loadDataHub = async () => {
                setIsLoading(true);
                try {
                    const hub = await api.fetchDataHubState();
                if (!cancelled) {
                    setDataHub(hub);
                }
                } catch (e) {
                    console.error('Failed to load Data Hub:', e);
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
            try {
                const list = await api.fetchAIAgents();
                if (!cancelled) {
                    setAgents(list);
                }
            } catch (e) {
                console.error('Failed to load AI agents for automation routing:', e);
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

// Create/Edit Source Modal
const CreateSourceModal: React.FC<{
    source?: DataSource | null;
    categories: DataCategory[];
    onClose: () => void;
    onSave: (source: Omit<DataSource, 'id' | 'createdAt' | 'updatedAt' | 'errorCount' | 'successRate' | 'reliabilityScore'>) => Promise<void>;
    t: (key: string) => string;
}> = ({ source, categories, onClose, onSave, t }) => {
    const [name, setName] = useState(source?.name || '');
    const [type, setType] = useState<DataSource['type']>(source?.type || 'api');
    const [url, setUrl] = useState(source?.url || '');
    const [endpoint, setEndpoint] = useState(source?.endpoint || '');
    const [category, setCategory] = useState(source?.category || '');
    const [tags, setTags] = useState(source?.tags.join(', ') || '');
    const [priority, setPriority] = useState<DataSource['priority']>(source?.priority || 'medium');
    const [updateInterval, setUpdateInterval] = useState<DataSource['updateInterval']>(source?.updateInterval || '5min');
    const [isSaving, setIsSaving] = useState(false);
    const [isDetectingType, setIsDetectingType] = useState(false);
    const [autoDetection, setAutoDetection] = useState<DetectedSourceType | null>(null);
    const [detectionError, setDetectionError] = useState<string | null>(null);
    const [autoFields, setAutoFields] = useState<Record<string, boolean>>({});
    
    // Telegram specific fields
    const [telegramUsername, setTelegramUsername] = useState(source?.credentials?.username || '');
    const [telegramToken, setTelegramToken] = useState(source?.credentials?.token || '');
    
    // API credentials
    const [apiKey, setApiKey] = useState(source?.credentials?.apiKey || '');
    const [apiSecret, setApiSecret] = useState(source?.credentials?.secret || '');
    
    // Webhook specific
    const [webhookUrl, setWebhookUrl] = useState(source?.url || '');
    
    useEffect(() => {
        if (!url || url.length < 6) {
            setAutoDetection(null);
            setDetectionError(null);
            return;
        }
        if (source && url === source.url) {
            return;
        }
        const handle = setTimeout(() => {
            detectTypeForUrl(url, 'ui-auto-detect');
        }, 800);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);
    
    const markAutoField = (field: string) => {
        setAutoFields(prev => ({ ...prev, [field]: true }));
    };

    const detectTypeForUrl = async (targetUrl?: string, context: string = 'ui-auto-detect') => {
        const value = targetUrl || url;
        if (!value || value.length < 4) return;
        setIsDetectingType(true);
        setDetectionError(null);
        try {
            const result = await api.detectSourceType(value, [context]);
            setAutoDetection(result);
            if (!source) {
                applyDetectionSuggestion(result, false);
            }
        } catch (err: any) {
            setAutoDetection(null);
            setDetectionError(err?.message || 'Failed to detect type');
        } finally {
            setIsDetectingType(false);
        }
    };
    
    const defaultCategoryForType = (detType: DataSource['type']): string => {
        switch (detType) {
            case 'rss':
                return 'news';
            case 'telegram':
                return 'social_feeds';
            case 'api':
                return 'price_data';
            case 'third_party':
                return 'third_party';
            case 'aggregator':
                return 'aggregators';
            case 'webhook':
                return 'automation';
            default:
                return category || 'fundamental';
        }
    };
    
    const defaultTagsForType = (detType: DataSource['type'], metaTags?: string[]) => {
        if (metaTags && metaTags.length > 0) return metaTags.join(', ');
        switch (detType) {
            case 'rss':
                return 'rss,news';
            case 'telegram':
                return 'telegram,social';
            case 'api':
                return 'api,json,data';
            case 'aggregator':
                return 'aggregator,multi-source';
            case 'webhook':
                return 'webhook,push';
            case 'third_party':
                return 'third-party,data';
            default:
                return 'website,html';
        }
    };

    const defaultPriorityForType = (detType: DataSource['type'], metaPriority?: DataSource['priority']): DataSource['priority'] => {
        if (metaPriority) return metaPriority;
        switch (detType) {
            case 'rss':
            case 'telegram':
            case 'api':
            case 'aggregator':
                return 'high';
            case 'webhook':
            case 'third_party':
                return 'medium';
            default:
                return 'medium';
        }
    };

    const defaultIntervalForType = (detType: DataSource['type'], metaInterval?: DataSource['updateInterval']): DataSource['updateInterval'] => {
        if (metaInterval) return metaInterval;
        switch (detType) {
            case 'telegram':
            case 'webhook':
                return 'realtime';
            case 'api':
            case 'aggregator':
                return '1min';
            case 'rss':
                return '15min';
            default:
                return '30min';
        }
    };

    const deriveNameFromDetection = (result: DetectedSourceType): string => {
        if (result.meta?.suggestedName) return result.meta.suggestedName;
        if (result.meta?.host) return result.meta.host;
        try {
            const parsed = new URL(result.normalizedUrl);
            return parsed.hostname.replace(/^www\./, '');
        } catch {
            return result.normalizedUrl;
        }
    };
    
    const autoBadge = (field: string) => (
        autoFields[field]
            ? <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border border-purple-500/40 bg-purple-500/15 text-purple-200">
                {t('auto') || 'Auto'}
            </span>
            : null
    );

    const applyDetectionSuggestion = (result: DetectedSourceType | null, manual = true) => {
        if (!result) return;
        if (type !== result.type) {
            setType(result.type);
            markAutoField('type');
        }
        if (!source && result.normalizedUrl && (!url || url.length < 6 || manual) && url !== result.normalizedUrl) {
            setUrl(result.normalizedUrl);
            markAutoField('url');
        }
        if (!source && !category) {
            const suggestedCategory = defaultCategoryForType(result.type);
            if (suggestedCategory && suggestedCategory !== category) {
                setCategory(suggestedCategory);
                markAutoField('category');
            }
        } else if (!source && manual && result.meta?.suggestedCategory && category !== result.meta.suggestedCategory) {
            setCategory(result.meta.suggestedCategory);
            markAutoField('category');
        }
        const derivedName = deriveNameFromDetection(result);
        if (!source && (!name || manual) && name !== derivedName) {
            setName(derivedName);
            markAutoField('name');
        }
        const suggestedTags = defaultTagsForType(result.type, result.meta?.suggestedTags);
        if (!source && (!tags || manual) && tags !== suggestedTags) {
            setTags(suggestedTags);
            markAutoField('tags');
        }
        const suggestedPriority = defaultPriorityForType(result.type, result.meta?.suggestedPriority);
        if (!source && (manual || !priority) && priority !== suggestedPriority) {
            setPriority(suggestedPriority);
            markAutoField('priority');
        }
        const suggestedInterval = defaultIntervalForType(result.type, result.meta?.suggestedInterval);
        if (!source && (manual || !updateInterval) && updateInterval !== suggestedInterval) {
            setUpdateInterval(suggestedInterval);
            markAutoField('updateInterval');
        }
        if (result.type === 'telegram' && result.meta?.telegramUsername && telegramUsername !== result.meta.telegramUsername) {
            setTelegramUsername(result.meta.telegramUsername);
            markAutoField('telegramUsername');
        }
    };
    
    // Initialize fields from source when editing
    useEffect(() => {
        if (source) {
            setName(source.name || '');
            setType(source.type || 'api');
            setUrl(source.url || '');
            setEndpoint(source.endpoint || '');
            setCategory(source.category || '');
            setTags(source.tags.join(', ') || '');
            setPriority(source.priority || 'medium');
            setUpdateInterval(source.updateInterval || '5min');
            setTelegramUsername(source.credentials?.username || '');
            setTelegramToken(source.credentials?.token || '');
            setApiKey(source.credentials?.apiKey || '');
            setApiSecret(source.credentials?.secret || '');
            setWebhookUrl(source.url || '');
        }
    }, [source]);
    
    useEffect(() => {
        setAutoFields({});
    }, [source?.id]);
    
    // Reset fields when type changes (only for new sources)
    useEffect(() => {
        if (!source) {
            // Reset type-specific fields when type changes
            if (type !== 'telegram') {
                setTelegramUsername('');
                setTelegramToken('');
            }
            if (type !== 'api') {
                setApiKey('');
                setApiSecret('');
                setEndpoint('');
            }
            if (type !== 'webhook') {
                setWebhookUrl('');
            }
            if (type === 'telegram') {
                setUrl('');
                setEndpoint('');
            }
        }
    }, [type, source]);
    
    const handleSubmit = async () => {
        if (!name || !category) {
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }
        if (type === 'telegram') {
            alert(t('telegram_source_manage_in_collector') || 'Telegram sources are managed via Telegram Collector.');
                return;
            }
        
        // Validate based on type
        if (type === 'api' || type === 'webhook' || type === 'rss' || type === 'website') {
            if (!url && type !== 'webhook') {
                alert(t('url_required') || 'URL is required for this type');
                return;
            }
            if (type === 'webhook' && !webhookUrl) {
                alert(t('webhook_url_required') || 'Webhook URL is required');
                return;
            }
        }
        
        setIsSaving(true);
        try {
            const credentials: DataSource['credentials'] = {};
            
            // Set credentials based on type
            if (type === 'telegram') {
                credentials.username = telegramUsername;
                if (telegramToken) credentials.token = telegramToken;
            } else if (type === 'api') {
                if (apiKey) credentials.apiKey = apiKey;
                if (apiSecret) credentials.secret = apiSecret;
            }
            
            // Set URL based on type
            let finalUrl = url;
            if (type === 'telegram') {
                // For telegram, construct URL from username
                finalUrl = `https://t.me/${telegramUsername.replace('@', '')}`;
            } else if (type === 'webhook') {
                finalUrl = webhookUrl;
            }
            
            await onSave({
                name,
                type,
                url: finalUrl || undefined,
                endpoint: (type === 'api' && endpoint) ? endpoint : undefined,
                category,
                tags: tags.split(',').map(t => t.trim()).filter(t => t),
                status: source?.status || 'active',
                priority,
                updateInterval,
                credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
            });
        } catch (e) {
            console.error('Failed to save source:', e);
        } finally {
            setIsSaving(false);
        }
    };
    
    const isExistingTelegram = source?.type === 'telegram';
    const canCreateTelegram = !source;
    const availableTypes: DataSource['type'][] = source
        ? (source.type === 'telegram'
            ? ['telegram']
            : ['api', 'webhook', 'rss', 'website', 'aggregator', 'third_party'])
        : ['api', 'webhook', 'rss', 'website', 'aggregator', 'third_party'];
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {source ? t('edit_source') || 'Edit Source' : t('create_source') || 'Create Data Source'}
                </h3>
                {canCreateTelegram && (
                    <div className="mb-4 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                        {t('telegram_source_hint') || 'Telegram channels are managed via Telegram Collector. Use that tab to add or edit Telegram data sources.'}
                    </div>
                )}
                {isExistingTelegram && (
                    <div className="mb-4 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                        {t('telegram_source_edit_hint') || 'This Telegram source is read-only. Manage details through the Telegram Collector tab.'}
                    </div>
                )}
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('name') || 'Name'} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('enter_source_name') || 'Enter source name'}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('type') || 'Type'} * {autoBadge('type')}
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as DataSource['type'])}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                disabled={isExistingTelegram}
                            >
                                {availableTypes.map(opt => (
                                    <option key={opt} value={opt}>
                                        {opt.charAt(0).toUpperCase() + opt.slice(1).replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('category') || 'Category'} * {autoBadge('category')}
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            >
                                <option value="">{t('select_category') || 'Select category'}</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {/* Dynamic fields based on type */}
                    {type === 'telegram' && (
                        <>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">
                                    {t('telegram_channel_username') || 'Telegram Channel Username'} * {autoBadge('telegramUsername')}
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">@</span>
                                    <input
                                        type="text"
                                        value={telegramUsername.replace('@', '')}
                                        onChange={(e) => setTelegramUsername(e.target.value)}
                                        className="flex-1 p-2 bg-secondary border border-border rounded text-foreground"
                                        placeholder="channel_username"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('telegram_username_hint') || 'Enter channel username without @'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">
                                    {t('telegram_bot_token') || 'Telegram Bot Token'} (Optional)
                                </label>
                                <input
                                    type="password"
                                    value={telegramToken}
                                    onChange={(e) => setTelegramToken(e.target.value)}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('telegram_token_hint') || 'Required if you want to read messages from private channels'}
                                </p>
                            </div>
                        </>
                    )}
                    
                    {type === 'webhook' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('webhook_url') || 'Webhook URL'} *
                            </label>
                            <input
                                type="url"
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                placeholder="https://your-domain.com/webhook"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('webhook_url_hint') || 'URL where data will be sent via POST request'}
                            </p>
                        </div>
                    )}
                    
                    {(type === 'api' || type === 'rss' || type === 'website' || type === 'aggregator' || type === 'third_party') && (
                        <>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">
                                    {t('url') || 'URL'} {type === 'api' || type === 'rss' || type === 'website' ? '*' : ''} {autoBadge('url')}
                                </label>
                                <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                        className="flex-1 p-2 bg-secondary border border-border rounded text-foreground"
                                    placeholder={
                                        type === 'api' ? 'https://api.example.com' :
                                        type === 'rss' ? 'https://example.com/feed.xml' :
                                        type === 'website' ? 'https://example.com' :
                                        'https://example.com'
                                    }
                                />
                                    <button
                                        type="button"
                                        onClick={() => detectTypeForUrl(url, 'ui-manual-detect')}
                                        disabled={isDetectingType || !url}
                                        className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded"
                                    >
                                        {isDetectingType ? (t('detecting') || 'Detecting...') : t('auto_detect') || 'Auto Detect'}
                                    </button>
                                </div>
                                {autoDetection && (
                                    <div className="mt-2 text-xs border border-border rounded-md p-2 bg-secondary/40">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">
                                                    {t('suggested_type') || 'Suggested type'}: <span className="text-purple-300">{autoDetection.type}</span>
                                                </p>
                                                <p className="text-muted-foreground">
                                                    {(t('confidence') || 'Confidence')}: {(autoDetection.confidence * 100).toFixed(0)}% • {autoDetection.reason}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => applyDetectionSuggestion(autoDetection)}
                                                className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded"
                                            >
                                                {t('apply') || 'Apply'}
                                            </button>
                                        </div>
                                        {autoDetection.meta?.contentType && (
                                            <p className="text-muted-foreground mt-1">
                                                {t('content_type') || 'Content'}: {autoDetection.meta.contentType}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {detectionError && (
                                    <p className="text-xs text-red-400 mt-1">{detectionError}</p>
                                )}
                            </div>
                            
                            {type === 'api' && (
                                <>
                                    <div>
                                        <label className="block text-sm text-muted-foreground mb-1">
                                            {t('endpoint') || 'Endpoint'} (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={endpoint}
                                            onChange={(e) => setEndpoint(e.target.value)}
                                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                            placeholder="/api/v1/data"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('endpoint_hint') || 'API endpoint path (will be appended to base URL)'}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-muted-foreground mb-1">
                                                {t('api_key') || 'API Key'} (Optional)
                                            </label>
                                            <input
                                                type="password"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                                placeholder="Your API Key"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-muted-foreground mb-1">
                                                {t('api_secret') || 'API Secret'} (Optional)
                                            </label>
                                            <input
                                                type="password"
                                                value={apiSecret}
                                                onChange={(e) => setApiSecret(e.target.value)}
                                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                                placeholder="Your API Secret"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            {t('tags') || 'Tags'} (comma-separated) {autoBadge('tags')}
                        </label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="price, real-time, market"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('priority') || 'Priority'} {autoBadge('priority')}
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as DataSource['priority'])}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            >
                                <option value="low">{t('low') || 'Low'}</option>
                                <option value="medium">{t('medium') || 'Medium'}</option>
                                <option value="high">{t('high') || 'High'}</option>
                                <option value="critical">{t('critical') || 'Critical'}</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('update_interval') || 'Update Interval'} {autoBadge('updateInterval')}
                            </label>
                            <select
                                value={updateInterval}
                                onChange={(e) => setUpdateInterval(e.target.value as DataSource['updateInterval'])}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            >
                                <option value="realtime">{t('realtime') || 'Real-time'}</option>
                                <option value="1min">{t('1min') || '1 Minute'}</option>
                                <option value="5min">{t('5min') || '5 Minutes'}</option>
                                <option value="15min">{t('15min') || '15 Minutes'}</option>
                                <option value="30min">{t('30min') || '30 Minutes'}</option>
                                <option value="1hour">{t('1hour') || '1 Hour'}</option>
                                <option value="daily">{t('daily') || 'Daily'}</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Create Category Modal
const CreateCategoryModal: React.FC<{
    onClose: () => void;
    onSave: (category: Omit<DataCategory, 'id' | 'createdAt' | 'sourceCount'>) => Promise<void>;
    t: (key: string) => string;
}> = ({ onClose, onSave, t }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [dataTypes, setDataTypes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSubmit = async () => {
        if (!name) {
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }
        
        setIsSaving(true);
        try {
            await onSave({
                name,
                description: description || undefined,
                tags: tags.split(',').map(t => t.trim()).filter(t => t),
                dataTypes: dataTypes.split(',').map(t => t.trim()).filter(t => t),
            });
        } catch (e) {
            console.error('Failed to save category:', e);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-foreground mb-4">{t('create_category') || 'Create Category'}</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('name') || 'Name'} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('enter_category_name') || 'Enter category name'}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('description') || 'Description'}</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            rows={3}
                            placeholder={t('enter_description') || 'Enter description'}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('tags') || 'Tags'} (comma-separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="price, news, analysis"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('data_types') || 'Data Types'} (comma-separated)</label>
                        <input
                            type="text"
                            value={dataTypes}
                            onChange={(e) => setDataTypes(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="json, xml, rss"
                        />
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Advanced Features Component
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
    const normalizationSummary: DataNormalizationSummary | undefined = dataHub.normalizationSummary;
    
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
                                                            ? topic.publisherTargets.map(id => publisherMap[id] || id).join(', ')
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
                        setIsLoading(true);
                        try {
                            await api.updateSourceAccessControl(editingAccessControl, controlData);
                            const updated = await api.fetchDataHubState();
                            setDataHub(updated);
                            onRefresh();
                            setEditingAccessControl(null);
                        } catch (e) {
                            alert(t('save_failed') || 'Failed to save');
                        } finally {
                            setIsLoading(false);
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
                    publisherName={publisherMap[previewQueueItem.publisherId]}
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

// Web Crawler Modal
const WebCrawlerModal: React.FC<{
    crawler?: any;
    sources: DataSource[];
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    t: (key: string) => string;
}> = ({ crawler, sources, onClose, onSave, t }) => {
    const [name, setName] = useState(crawler?.name || '');
    const [url, setUrl] = useState(crawler?.url || '');
    const [sourceId, setSourceId] = useState(crawler?.sourceId || '');
    const [interval, setInterval] = useState<'realtime' | '1min' | '5min' | '15min' | '30min' | '1hour' | 'daily'>(crawler?.interval || '5min');
    const [enabled, setEnabled] = useState(crawler?.enabled ?? true);
    const [selectors, setSelectors] = useState({
        title: crawler?.selectors?.title || '',
        content: crawler?.selectors?.content || '',
        price: crawler?.selectors?.price || '',
        volume: crawler?.selectors?.volume || '',
        date: crawler?.selectors?.date || '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) {
            newErrors.name = t('crawler_name_required') || 'Crawler name is required.';
        }
        if (!url.trim()) {
            newErrors.url = t('crawler_url_required') || 'URL is required.';
        } else {
            try {
                const parsed = new URL(url.trim());
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    newErrors.url = t('crawler_url_invalid') || 'URL must start with http or https.';
                }
            } catch {
                newErrors.url = t('crawler_url_invalid') || 'Please enter a valid URL.';
            }
        }
        const hasSelectors = Object.values(selectors).some(value => value.trim().length > 0);
        if (!hasSelectors) {
            newErrors.selectors = t('crawler_selector_required') || 'Provide at least one CSS selector to extract data.';
        }
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        
        setIsSaving(true);
        try {
            await onSave({
                name,
                url,
                sourceId: sourceId || undefined,
                interval,
                enabled,
                selectors: Object.fromEntries(
                    Object.entries(selectors).filter(([_, v]) => v.trim() !== '')
                ),
            });
        } catch (e) {
            console.error('Failed to save crawler:', e);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {crawler ? t('edit_crawler') || 'Edit Crawler' : t('create_crawler') || 'Create Web Crawler'}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('name') || 'Name'} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('crawler_name') || 'Crawler name'}
                        />
                        {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('url') || 'URL'} *</label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="https://example.com"
                        />
                        {errors.url && <p className="text-xs text-red-400 mt-1">{errors.url}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('link_to_source') || 'Link to Source'} (Optional)</label>
                        <select
                            value={sourceId}
                            onChange={(e) => setSourceId(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="">{t('none') || 'None'}</option>
                            {sources.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">{t('interval') || 'Interval'}</label>
                            <select
                                value={interval}
                                onChange={(e) => setInterval(e.target.value as any)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            >
                                <option value="realtime">{t('realtime') || 'Real-time'}</option>
                                <option value="1min">{t('1min') || '1 Minute'}</option>
                                <option value="5min">{t('5min') || '5 Minutes'}</option>
                                <option value="15min">{t('15min') || '15 Minutes'}</option>
                                <option value="30min">{t('30min') || '30 Minutes'}</option>
                                <option value="1hour">{t('1hour') || '1 Hour'}</option>
                                <option value="daily">{t('daily') || 'Daily'}</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center pt-6">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={(e) => setEnabled(e.target.checked)}
                                    className="rounded"
                                />
                                {t('enabled') || 'Enabled'}
                            </label>
                        </div>
                    </div>
                    
                    <div className="border-t border-border pt-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3">{t('css_selectors') || 'CSS Selectors'} (Optional)</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('title_selector') || 'Title'}</label>
                                <input
                                    type="text"
                                    value={selectors.title}
                                    onChange={(e) => setSelectors({ ...selectors, title: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder="h1.title"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('content_selector') || 'Content'}</label>
                                <input
                                    type="text"
                                    value={selectors.content}
                                    onChange={(e) => setSelectors({ ...selectors, content: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder=".content"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('price_selector') || 'Price'}</label>
                                <input
                                    type="text"
                                    value={selectors.price}
                                    onChange={(e) => setSelectors({ ...selectors, price: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder=".price"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('volume_selector') || 'Volume'}</label>
                                <input
                                    type="text"
                                    value={selectors.volume}
                                    onChange={(e) => setSelectors({ ...selectors, volume: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder=".volume"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('date_selector') || 'Date'}</label>
                                <input
                                    type="text"
                                    value={selectors.date}
                                    onChange={(e) => setSelectors({ ...selectors, date: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder=".date"
                                />
                            </div>
                        </div>
                        {errors.selectors && <p className="text-xs text-red-400 mt-2">{errors.selectors}</p>}
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Telegram Publisher Modal
const TelegramPublisherModal: React.FC<{
    publisher?: any;
    sources: DataSource[];
    categories: DataCategory[];
    agents: AIAgent[];
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    t: (key: string) => string;
}> = ({ publisher, sources, categories, agents, onClose, onSave, t }) => {
    const [name, setName] = useState(publisher?.name || '');
    const [botToken, setBotToken] = useState(publisher?.botToken || '');
    const [chatId, setChatId] = useState(publisher?.chatId || '');
    const [enabled, setEnabled] = useState(publisher?.enabled ?? true);
    const [template, setTemplate] = useState(publisher?.template || '{{data}}');
    const [selectedSources, setSelectedSources] = useState<string[]>(publisher?.filters?.sources || []);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(publisher?.filters?.categories || []);
    const [selectedAgents, setSelectedAgents] = useState<string[]>(publisher?.filters?.agentIds || []);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) {
            newErrors.name = t('publisher_name_required') || 'Publisher name is required.';
        }
        const token = botToken.trim();
        if (!token) {
            newErrors.botToken = t('publisher_token_required') || 'Bot token is required.';
        } else if (!/^\d{5,}:[A-Za-z0-9_-]{10,}$/.test(token)) {
            newErrors.botToken = t('publisher_token_invalid') || 'Bot token format looks invalid.';
        }
        const chat = chatId.trim();
        if (!chat) {
            newErrors.chatId = t('publisher_chat_required') || 'Chat ID is required.';
        } else if (!/^(-100)?\d+$/.test(chat) && !/^@[\w\d_]{5,}$/.test(chat)) {
            newErrors.chatId = t('publisher_chat_invalid') || 'Chat ID must be numeric (e.g. -100...) or @username.';
        }
        if (!template.includes('{{data}}')) {
            newErrors.template = t('publisher_template_placeholder_required') || 'Template must include {{data}} placeholder.';
        }
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        
        setIsSaving(true);
        try {
            await onSave({
                name,
                botToken,
                chatId,
                enabled,
                template,
                filters: {
                    sources: selectedSources.length > 0 ? selectedSources : undefined,
                    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
                    agentIds: selectedAgents.length > 0 ? selectedAgents : undefined,
                },
            });
        } catch (e) {
            console.error('Failed to save publisher:', e);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {publisher ? t('edit_publisher') || 'Edit Publisher' : t('create_publisher') || 'Create Telegram Publisher'}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('name') || 'Name'} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('publisher_name') || 'Publisher name'}
                        />
                        {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('telegram_bot_token') || 'Telegram Bot Token'} *</label>
                        <input
                            type="password"
                            value={botToken}
                            onChange={(e) => setBotToken(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                        />
                        {errors.botToken && <p className="text-xs text-red-400 mt-1">{errors.botToken}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('chat_id') || 'Chat ID'} *</label>
                        <input
                            type="text"
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="-1001234567890"
                        />
                        {errors.chatId && <p className="text-xs text-red-400 mt-1">{errors.chatId}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('message_template') || 'Message Template'}</label>
                        <textarea
                            value={template}
                            onChange={(e) => setTemplate(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            rows={4}
                            placeholder="{{data}} - Use {{data}} to insert data"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('template_hint') || 'Use {{data}} to insert data content'}
                        </p>
                        {errors.template && <p className="text-xs text-red-400 mt-1">{errors.template}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">{t('filter_sources') || 'Filter Sources'} (Optional)</label>
                        <div className="max-h-32 overflow-y-auto border border-border rounded p-2">
                            {sources.map(source => (
                                <label key={source.id} className="flex items-center gap-2 text-sm mb-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedSources.includes(source.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedSources([...selectedSources, source.id]);
                                            } else {
                                                setSelectedSources(selectedSources.filter(id => id !== source.id));
                                            }
                                        }}
                                        className="rounded"
                                    />
                                    {source.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">{t('filter_categories') || 'Filter Categories'} (Optional)</label>
                        <div className="max-h-32 overflow-y-auto border border-border rounded p-2">
                            {categories.map(category => (
                                <label key={category.id} className="flex items-center gap-2 text-sm mb-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.includes(category.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedCategories([...selectedCategories, category.id]);
                                            } else {
                                                setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                                            }
                                        }}
                                        className="rounded"
                                    />
                                    {category.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">{t('filter_agents') || 'Filter Agents'} (Optional)</label>
                        <div className="max-h-32 overflow-y-auto border border-border rounded p-2">
                            {agents.length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t('automation_no_agents_available') || 'No agents available'}</p>
                            ) : (
                                agents.map(agent => (
                                    <label key={agent.id} className="flex items-center gap-2 text-sm mb-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedAgents.includes(agent.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedAgents([...selectedAgents, agent.id]);
                                                } else {
                                                    setSelectedAgents(selectedAgents.filter(id => id !== agent.id));
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        {agent.name} — {agent.role}
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                                className="rounded"
                            />
                            {t('enabled') || 'Enabled'}
                        </label>
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Access Control Modal
const AccessControlModal: React.FC<{
    sourceId: string;
    source?: DataSource;
    accessControl?: any;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    t: (key: string) => string;
}> = ({ sourceId, source, accessControl, onClose, onSave, t }) => {
    const [allowedAgents, setAllowedAgents] = useState<string[]>(accessControl?.allowedAgents || []);
    const [blockedAgents, setBlockedAgents] = useState<string[]>(accessControl?.blockedAgents || []);
    const [allowedDataTypes, setAllowedDataTypes] = useState<string[]>(accessControl?.allowedDataTypes || []);
    const [requireAuth, setRequireAuth] = useState(accessControl?.requireAuth ?? false);
    const [maxRequestsPerMinute, setMaxRequestsPerMinute] = useState(accessControl?.maxRequestsPerMinute || '');
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            await onSave({
                sourceId,
                allowedAgents: allowedAgents.length > 0 ? allowedAgents : [],
                blockedAgents,
                allowedDataTypes: allowedDataTypes.length > 0 ? allowedDataTypes : [],
                requireAuth,
                maxRequestsPerMinute: maxRequestsPerMinute ? parseInt(maxRequestsPerMinute) : undefined,
                rateLimitWindow: 60,
            });
        } catch (e) {
            console.error('Failed to save access control:', e);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {t('configure_access_control') || 'Configure Access Control'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                    {source?.name || sourceId}
                </p>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                            {t('allowed_agents') || 'Allowed Agents'} ({t('empty_for_all') || 'Empty = All'})
                        </label>
                        <input
                            type="text"
                            value={allowedAgents.join(', ')}
                            onChange={(e) => setAllowedAgents(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="agent1, agent2, agent3"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                            {t('blocked_agents') || 'Blocked Agents'}
                        </label>
                        <input
                            type="text"
                            value={blockedAgents.join(', ')}
                            onChange={(e) => setBlockedAgents(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="agent1, agent2"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                            {t('allowed_data_types') || 'Allowed Data Types'} ({t('empty_for_all') || 'Empty = All'})
                        </label>
                        <input
                            type="text"
                            value={allowedDataTypes.join(', ')}
                            onChange={(e) => setAllowedDataTypes(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="price, news, analysis"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('max_requests_per_minute') || 'Max Requests/Minute'}
                            </label>
                            <input
                                type="number"
                                value={maxRequestsPerMinute}
                                onChange={(e) => setMaxRequestsPerMinute(e.target.value)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                placeholder="60"
                            />
                        </div>
                        
                        <div className="flex items-center pt-6">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={requireAuth}
                                    onChange={(e) => setRequireAuth(e.target.checked)}
                                    className="rounded"
                                />
                                {t('require_auth') || 'Require Auth'}
                            </label>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AutomationTopicModal: React.FC<{
    topic: AgentTopicRoute | null;
    agents: AIAgent[];
    isLoadingAgents: boolean;
    categories: DataCategory[];
    dataTypes: string[];
    publishers: TelegramPublisher[];
    isSaving: boolean;
    onClose: () => void;
    onSave: (values: AgentTopicFormValues) => Promise<void> | void;
    t: (key: string) => string;
}> = ({ topic, agents, isLoadingAgents, categories, dataTypes, publishers, isSaving, onClose, onSave, t }) => {
    const [title, setTitle] = useState(topic?.title || '');
    const [description, setDescription] = useState(topic?.description || '');
    const [agentId, setAgentId] = useState(topic?.agentId || (agents[0]?.id ?? ''));
    const [categoryIds, setCategoryIds] = useState<string[]>(topic?.categoryIds || []);
    const [dataTypeSelection, setDataTypeSelection] = useState<string[]>(topic?.dataTypes || []);
    const [tagsInput, setTagsInput] = useState(topic?.tags?.join(', ') || '');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(topic?.priority || 'medium');
    const [minPassRate, setMinPassRate] = useState<string>(topic?.minPassRate !== undefined ? String(topic.minPassRate) : '');
    const [minQualityScore, setMinQualityScore] = useState<string>(topic?.minQualityScore !== undefined ? String(topic.minQualityScore) : '');
    const [includeStatuses, setIncludeStatuses] = useState<NormalizedDataStatus[]>(topic?.includeStatuses || ['ready']);
    const [publisherTargets, setPublisherTargets] = useState<string[]>(topic?.publisherTargets || []);
    const [enabled, setEnabled] = useState(topic?.enabled ?? true);
    const statusOptions: NormalizedDataStatus[] = ['ready', 'warning', 'rejected'];

    useEffect(() => {
        if (!agentId && agents.length > 0) {
            setAgentId(agents[0].id);
        }
    }, [agents, agentId]);

    const handleMultiSelectChange = (event: React.ChangeEvent<HTMLSelectElement>, setter: (values: string[]) => void) => {
        const values = Array.from(event.target.selectedOptions).map(option => option.value);
        setter(values);
    };

    const handleStatusToggle = (status: NormalizedDataStatus) => {
        setIncludeStatuses(prev => prev.includes(status) ? prev.filter(item => item !== status) : [...prev, status]);
    };

    const handleSubmit = () => {
        if (!title.trim()) {
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }
        if (!agentId) {
            alert(t('automation_topic_agent_required') || 'Select an agent for this route.');
            return;
        }
        const parsedPassRate = minPassRate.trim() !== '' ? Number(minPassRate) : undefined;
        const parsedQuality = minQualityScore.trim() !== '' ? Number(minQualityScore) : undefined;
        const tags = tagsInput
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
        onSave({
            title: title.trim(),
            description: description.trim() || undefined,
            agentId,
            categoryIds,
            dataTypes: dataTypeSelection,
            tags,
            priority,
            minPassRate: parsedPassRate,
            minQualityScore: parsedQuality,
            includeStatuses: includeStatuses.length > 0 ? includeStatuses : ['ready'],
            publisherTargets,
            enabled,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {topic ? t('automation_topic_modal_title_edit') || 'Edit Routing' : t('automation_topic_modal_title_create') || 'Create Routing'}
                </h3>
                <div className="space-y-4 text-sm">
                    <div>
                        <label className="block text-muted-foreground mb-1">{t('title') || 'Title'} *</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-secondary border border-border rounded"
                            placeholder="Signals for Crypto VIP"
                        />
                    </div>
                    <div>
                        <label className="block text-muted-foreground mb-1">{t('description') || 'Description'}</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-secondary border border-border rounded"
                            rows={3}
                            placeholder={t('automation_topic_description_placeholder') || 'Explain what this route does'}
                        />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_agent') || 'Agent'} *</label>
                            <select
                                value={agentId}
                                onChange={e => setAgentId(e.target.value)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
                                disabled={isLoadingAgents || agents.length === 0}
                            >
                                {agents.length === 0 ? (
                                    <option value="">{t('automation_no_agents_available') || 'No agents available'}</option>
                                ) : (
                                    agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>
                                            {agent.name} — {agent.role}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('priority') || 'Priority'}</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value as AgentTopicFormValues['priority'])}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
                            >
                                {['low', 'medium', 'high', 'critical'].map(level => (
                                    <option key={level} value={level}>
                                        {t(level) || level}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_categories') || 'Categories'}</label>
                            <select
                                multiple
                                value={categoryIds}
                                onChange={e => handleMultiSelectChange(e, setCategoryIds)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded min-h-[120px]"
                            >
                                {categories.map(category => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_datatypes') || 'Data types'}</label>
                            <select
                                multiple
                                value={dataTypeSelection}
                                onChange={e => handleMultiSelectChange(e, setDataTypeSelection)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded min-h-[120px]"
                            >
                                {dataTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_min_pass_rate') || 'Min pass rate (%)'}</label>
                            <input
                                type="number"
                                value={minPassRate}
                                onChange={e => setMinPassRate(e.target.value)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
                                placeholder="e.g. 70"
                            />
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_min_quality') || 'Min quality score'}</label>
                            <input
                                type="number"
                                value={minQualityScore}
                                onChange={e => setMinQualityScore(e.target.value)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
                                placeholder="e.g. 75"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-muted-foreground mb-1">{t('automation_topic_statuses') || 'Allowed statuses'}</label>
                        <div className="flex flex-wrap gap-3 text-xs">
                            {statusOptions.map(status => (
                                <label key={status} className="flex items-center gap-1">
                                    <input
                                        type="checkbox"
                                        checked={includeStatuses.includes(status)}
                                        onChange={() => handleStatusToggle(status)}
                                        className="rounded"
                                    />
                                    {t(`normalized_status_${status}`) || status}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_publishers') || 'Publishers'}</label>
                            <select
                                multiple
                                value={publisherTargets}
                                onChange={e => handleMultiSelectChange(e, setPublisherTargets)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded min-h-[100px]"
                            >
                                {publishers.length === 0 && <option value="">{t('automation_topic_publishers_none') || 'No Telegram publishers configured'}</option>}
                                {publishers.map(publisher => (
                                    <option key={publisher.id} value={publisher.id}>{publisher.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_tags') || 'Tags (comma separated)'}</label>
                            <input
                                value={tagsInput}
                                onChange={e => setTagsInput(e.target.value)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
                                placeholder="signal, persian, vip"
                            />
                            <label className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={e => setEnabled(e.target.checked)}
                                    className="rounded"
                                />
                                {t('automation_topic_enabled') || 'Route enabled'}
                            </label>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : (t('save') || 'Save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// View Source Data Modal
const ViewSourceDataModal: React.FC<{
    source: DataSource;
    data: any;
    isLoading: boolean;
    onClose: () => void;
    onRefresh: () => void;
    t: (key: string) => string;
}> = ({ source, data, isLoading, onClose, onRefresh, t }) => {
    const formatData = (data: any): string => {
        if (!data) return t('no_data') || 'No data';
        
        try {
            if (typeof data === 'string') {
                return data;
            }
            return JSON.stringify(data, null, 2);
        } catch (e) {
            return String(data);
        }
    };
    
    const formatPriceData = (data: any) => {
        if (!data) return null;
        if (data.symbol && data.price) {
            return {
                symbol: data.symbol,
                price: typeof data.price === 'number' ? data.price.toFixed(2) : data.price,
                change24h: data.change24h ? `${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(2)}%` : 'N/A',
                volume: data.volume ? typeof data.volume === 'number' ? data.volume.toLocaleString() : data.volume : 'N/A',
            };
        }
        return null;
    };
    
    const formatNewsData = (data: any) => {
        if (!data) return null;
        // For Telegram sources, prefer articles format (structured for agents)
        if (data.articles && Array.isArray(data.articles)) {
            return data.articles;
        }
        return null;
    };
    
    const priceData = formatPriceData(data);
    const newsData = formatNewsData(data);
    
    // For Telegram sources, check if we have articles (structured format for agents)
    const telegramArticles = source.type === 'telegram' && data?.articles && Array.isArray(data.articles) ? data.articles : null;
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('view_source_data') || 'View Source Data'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {source.name} • {source.type}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                        >
                            {isLoading ? t('loading') || 'Loading...' : t('refresh') || 'Refresh'}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 bg-secondary hover:bg-accent text-secondary-foreground rounded text-sm"
                        >
                            {t('close') || 'Close'}
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <div className="animate-spin text-4xl mb-2">⚙️</div>
                                <p className="text-muted-foreground">{t('loading_data') || 'Loading data...'}</p>
                            </div>
                        </div>
                    ) : !data ? (
                        <div className="text-center p-10 text-muted-foreground">
                            {t('no_data_available') || 'No data available'}
                        </div>
                    ) : data.error ? (
                        <div className="space-y-4">
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <h4 className="font-semibold text-red-400 mb-2">{t('error_fetching_data') || 'Error Fetching Data'}</h4>
                                <p className="text-sm text-muted-foreground mb-2">{data.message || data.details || 'Unknown error'}</p>
                                {data.url && data.url !== 'Not configured' && (
                                    <p className="text-xs text-muted-foreground">
                                        {t('source_url') || 'Source URL'}: {data.url}
                                    </p>
                                )}
                                {data.channel && (
                                    <p className="text-xs text-muted-foreground">
                                        {t('channel') || 'Channel'}: @{data.channel}
                                    </p>
                                )}
                                {data.note && (
                                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                                        <p className="text-sm text-yellow-400">{data.note}</p>
                                    </div>
                                )}
                                {data.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                                        <p className="text-xs text-blue-400">{data.suggestion}</p>
                                    </div>
                                )}
                                {data.instructions && Array.isArray(data.instructions) && (
                                    <div className="mt-3 p-3 bg-secondary/50 rounded">
                                        <p className="text-xs font-semibold text-foreground mb-2">{t('instructions') || 'Instructions'}:</p>
                                        <ul className="text-xs text-muted-foreground space-y-1">
                                            {data.instructions.map((instruction: string, idx: number) => (
                                                <li key={idx}>{instruction}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            {data.source && (
                                <div className="bg-secondary/50 rounded-lg p-4">
                                    <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                    <pre className="text-xs text-muted-foreground overflow-x-auto">
                                        {formatData(data)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : telegramArticles && telegramArticles.length > 0 ? (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">
                                    {t('telegram_articles') || 'Telegram Articles'}
                                    {data.channel && ` - @${data.channel}`}
                                </h4>
                                {data.totalMessages && (
                                    <p className="text-xs text-muted-foreground mb-3">
                                        {t('total_articles') || 'Total Articles'}: {telegramArticles.length}
                                    </p>
                                )}
                                <div className="space-y-3">
                                    {telegramArticles.map((article: any, idx: number) => (
                                        <div key={idx} className="border border-border rounded p-3 hover:bg-secondary/30 transition-colors">
                                            <h5 className="font-semibold text-foreground mb-2">{article.title}</h5>
                                            <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{article.content}</p>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <div className="flex gap-3">
                                                    {article.author && <span>{article.author}</span>}
                                                    {article.source && <span>{article.source}</span>}
                                                </div>
                                                <div className="flex gap-3">
                                                    {article.link && (
                                                        <a 
                                                            href={article.link} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300"
                                                        >
                                                            {t('view_message') || 'View Message'}
                                                        </a>
                                                    )}
                                                    <span>{new Date(article.publishedAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {data.note && (
                                    <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                                        <p className="text-xs text-blue-400">{data.note}</p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    ) : data.messages && Array.isArray(data.messages) ? (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">
                                    {t('telegram_messages') || 'Telegram Messages'}
                                    {data.channel && ` - @${data.channel}`}
                                </h4>
                                {data.totalMessages && (
                                    <p className="text-xs text-muted-foreground mb-3">
                                        {t('total_messages') || 'Total'}: {data.totalMessages}
                                    </p>
                                )}
                                <div className="space-y-3">
                                    {data.messages.map((msg: any, idx: number) => (
                                        <div key={idx} className="border border-border rounded p-3">
                                            <p className="text-sm text-foreground mb-2">{msg.text}</p>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <span>{msg.chat || data.channel}</span>
                                                <span>{new Date(msg.timestamp).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {data.note && (
                                    <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                                        <p className="text-xs text-blue-400">{data.note}</p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    ) : priceData ? (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('price_data') || 'Price Data'}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('symbol') || 'Symbol'}</p>
                                        <p className="font-semibold text-foreground">{priceData.symbol}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('price') || 'Price'}</p>
                                        <p className="font-semibold text-foreground">${priceData.price}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('change_24h') || '24h Change'}</p>
                                        <p className={`font-semibold ${priceData.change24h.startsWith('+') ? 'text-green-400' : priceData.change24h.startsWith('-') ? 'text-red-400' : 'text-foreground'}`}>
                                            {priceData.change24h}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('volume') || 'Volume'}</p>
                                        <p className="font-semibold text-foreground">{priceData.volume}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    ) : newsData ? (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('news_articles') || 'News Articles'}</h4>
                                <div className="space-y-3">
                                    {newsData.slice(0, 10).map((article: any, idx: number) => (
                                        <div key={idx} className="border border-border rounded p-3">
                                            <h5 className="font-semibold text-foreground mb-1">{article.title || t('no_title') || 'No Title'}</h5>
                                            {article.content && (
                                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{article.content}</p>
                                            )}
                                            {article.timestamp && (
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(article.timestamp).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('data_preview') || 'Data Preview'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                    <p>
                        {t('source_url') || 'Source URL'}: {source.url || t('not_configured') || 'Not configured'}
                    </p>
                    {source.endpoint && (
                        <p>
                            {t('endpoint') || 'Endpoint'}: {source.endpoint}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIManager;
