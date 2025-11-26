import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { database } from '../../services/database.ts';
import { AIManagerOverview, ArtemisState, TradingScenario, ArtemisConfig, ArtemisLog, DataHubState, DataSource, DataCategory, DataHubAdvancedFeatures, DetectedSourceType } from '../../types.ts';
import { Backtesting, SystemLogs, ArtemisSettings } from './ArtemisComponents.tsx';
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
    const [artemis, setArtemis] = useState<ArtemisState | null>(null);
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
                    const artemisState = await api.fetchArtemisState();
                    setArtemis(artemisState);
                }
            } catch (e) {
                console.error('Failed to load AIManager data:', e);
                setError(e instanceof Error ? e.message : 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    if (error) {
        return (
            <div className="text-center p-10">
                <p className="text-red-400 mb-4">{t('error_loading') || 'Error loading data'}: {error}</p>
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
            const updated = await api.fetchArtemisState();
            setArtemis(updated);
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
                {activeTab === 'overview' && data && artemis && <ArtemisOverview data={data} artemis={artemis} t={t} onRefresh={refreshArtemis} />}
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

const ArtemisOverview: React.FC<{ data: AIManagerOverview; artemis: ArtemisState; t: (key: string) => string }> = ({ data, artemis, t }) => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                    <h3 className="font-semibold text-foreground mb-3">{t('artemis_core_metrics') || 'Core Metrics'}</h3>
                         <div className="space-y-2">
                        <ProgressBar label={t('total_decisions') || 'Total Decisions'} value={artemis.totalDecisions} />
                        <ProgressBar label={t('success_rate') || 'Success Rate'} value={artemis.successRate} />
                        <ProgressBar label={t('active_agents') || 'Active Agents'} value={artemis.activeAgents.length} maxValue={15} />
                        <ProgressBar label={t('system_health') || 'System Health'} 
                            value={artemis.systemHealth.overall === 'healthy' ? 100 : artemis.systemHealth.overall === 'degraded' ? 70 : 30} />
                         </div>
                    </div>
                     <div>
                        <h3 className="font-semibold text-foreground mb-3">{t('system_summary')}</h3>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <Stat value={data.summary.totalAgents} label={t('total_agents')} />
                            <Stat value={data.summary.activeAgents} label={t('active_agents_count')} />
                            <Stat value={data.summary.inTraining} label={t('in_training')} />
                            <Stat value={`${data.summary.avgAccuracy.toFixed(1)}%`} label={t('avg_accuracy')} />
                        </div>
                    </div>
                </Card>
                <Card>
                <h3 className="font-semibold text-foreground mb-3">{t('decision_engine_status') || 'Decision Engine Status'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 border border-border rounded-lg">
                        <p className="text-xs text-muted-foreground">{t('strategy') || 'Strategy'}</p>
                        <p className="font-bold text-foreground mt-1">{t(artemis.decisionEngine.strategy) || artemis.decisionEngine.strategy}</p>
                    </div>
                    <div className="text-center p-3 border border-border rounded-lg">
                        <p className="text-xs text-muted-foreground">{t('active_model') || 'Active Model'}</p>
                        <p className="font-bold text-foreground mt-1">{t(artemis.decisionEngine.activeModel) || artemis.decisionEngine.activeModel}</p>
                    </div>
                    <div className="text-center p-3 border border-border rounded-lg">
                        <p className="text-xs text-muted-foreground">{t('confidence_threshold') || 'Confidence Threshold'}</p>
                        <p className="font-bold text-foreground mt-1">{artemis.decisionEngine.confidenceThreshold}%</p>
                    </div>
                    </div>
                </Card>
            </div>
            <div className="space-y-6">
                <Card>
                <h3 className="font-semibold text-foreground mb-3">{t('system_health') || 'System Health'}</h3>
                    <div className="space-y-2 text-sm">
                    <Metric label={t('overall_status') || 'Overall'} 
                        value={<span className={`font-semibold ${
                            artemis.systemHealth.overall === 'healthy' ? 'text-green-400' :
                            artemis.systemHealth.overall === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                        }`}>{t(artemis.systemHealth.overall) || artemis.systemHealth.overall}</span>} />
                    <Metric label={t('cpu_usage') || 'CPU'} value={`${artemis.systemHealth.resources.cpu.toFixed(1)}%`} />
                    <Metric label={t('memory_usage') || 'Memory'} value={`${artemis.systemHealth.resources.memory.toFixed(1)}%`} />
                    <Metric label={t('api_quota') || 'API Quota'} 
                        value={`${artemis.systemHealth.resources.apiQuota.used}/${artemis.systemHealth.resources.apiQuota.limit}`} />
                    </div>
                </Card>
                <Card>
                    <h3 className="font-semibold text-foreground mb-3">{t('top_agents')}</h3>
                    <div className="space-y-3">
                        {data.topAgents.map(agent => (
                            <div key={agent.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-semibold text-foreground">{agent.name}</p>
                                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                                </div>
                                <span className="font-bold text-purple-400">{agent.accuracy.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );

const DecisionEngine: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    const [isMakingDecision, setIsMakingDecision] = useState(false);
    
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
            
            // Reload Artemis state
            const updated = await api.fetchArtemisState();
            // Force re-render by updating parent component state
            window.location.reload(); // Simple refresh for now
        } catch (e) {
            console.error('Failed to make decision:', e);
            alert(t('decision_failed') || 'Failed to make decision');
        } finally {
            setIsMakingDecision(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('decision_engine_configuration') || 'Decision Engine Configuration'}</h3>
                    <button
                        onClick={handleMakeDecision}
                        disabled={isMakingDecision}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {isMakingDecision ? t('processing') || 'Processing...' : t('make_decision') || 'Make Decision'}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </Card>
            <Card>
                <h3 className="font-semibold text-foreground mb-4">{t('recent_decisions') || 'Recent Decisions'}</h3>
                {artemis.decisionEngine.recentDecisions.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {artemis.decisionEngine.recentDecisions.slice(0, 10).map(decision => (
                            <div key={decision.id} className="p-3 border border-border rounded-lg text-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-semibold text-foreground">{t(decision.type) || decision.type}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{new Date(decision.timestamp).toLocaleString()}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                        decision.output.confidence >= 80 ? 'bg-green-500/20 text-green-400' :
                                        decision.output.confidence >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-red-500/20 text-red-400'
                                    }`}>
                                        {decision.output.confidence}%
                                    </span>
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
                    <p className="text-center text-muted-foreground py-10">{t('no_decisions_yet') || 'No decisions made yet.'}</p>
                )}
            </Card>
        </div>
    );
};

const Orchestration: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => (
    <div className="space-y-6">
        <Card>
            <h3 className="font-semibold text-foreground mb-4">{t('agent_orchestration') || 'Agent Orchestration'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Stat value={artemis.orchestration.activeAgents} label={t('active_agents') || 'Active Agents'} />
                <Stat value={artemis.orchestration.agentTasks.length} label={t('active_tasks') || 'Active Tasks'} />
                <Stat value={Object.keys(artemis.orchestration.resourceAllocation).length} label={t('allocated_resources') || 'Allocated Resources'} />
            </div>
        </Card>
        <Card>
            <h3 className="font-semibold text-foreground mb-4">{t('agent_tasks') || 'Agent Tasks'}</h3>
            {artemis.orchestration.agentTasks.length > 0 ? (
                <div className="space-y-2">
                    {artemis.orchestration.agentTasks.map(task => (
                        <div key={`${task.agentId}-${task.task}`} className="p-3 border border-border rounded-lg text-sm">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-foreground">{task.agentId}</p>
                                    <p className="text-xs text-muted-foreground">{task.task}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                    task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                    task.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                                    task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {t(task.status) || task.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-muted-foreground py-10">{t('no_active_tasks') || 'No active tasks.'}</p>
            )}
        </Card>
    </div>
);

const LearningSystem: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => (
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
                <h3 className="font-semibold text-foreground mb-4">{t('recent_improvements') || 'Recent Improvements'}</h3>
                {artemis.learningSystem.improvements.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {artemis.learningSystem.improvements.slice(0, 5).map(improvement => (
                            <div key={improvement.id} className="p-3 border border-border rounded-lg text-sm">
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
                    <p className="text-center text-muted-foreground py-10">{t('no_improvements_yet') || 'No improvements recorded yet.'}</p>
                )}
            </Card>
            
            <Card>
                <h3 className="font-semibold text-foreground mb-4">{t('recent_mistakes') || 'Recent Mistakes'}</h3>
                {artemis.learningSystem.mistakes.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {artemis.learningSystem.mistakes.slice(0, 5).map(mistake => (
                            <div key={mistake.id} className="p-3 border border-border rounded-lg text-sm">
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
                    <p className="text-center text-muted-foreground py-10">{t('no_mistakes') || 'No mistakes recorded yet.'}</p>
                )}
            </Card>
        </div>
        
        {artemis.learningSystem.accuracyHistory.length > 0 && (
            <Card>
                <h3 className="font-semibold text-foreground mb-4">{t('accuracy_history') || 'Accuracy History'}</h3>
                <div className="space-y-2">
                    {artemis.learningSystem.accuracyHistory.slice(-7).map((entry, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</span>
                            <div className="flex items-center gap-3">
                                <div className="w-32 bg-secondary rounded-full h-2">
                                    <div 
                                        className="bg-purple-500 h-2 rounded-full" 
                                        style={{width: `${entry.accuracy}%`}}
                                    ></div>
                                </div>
                                <span className="font-semibold text-foreground w-12 text-right">{entry.accuracy.toFixed(1)}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        )}
    </div>
);

const SystemMonitoring: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [lastHealthCheck, setLastHealthCheck] = useState<string | null>(null);
    
    const handleHealthCheck = async () => {
        setIsCheckingHealth(true);
        try {
            const health = await api.checkSystemHealth();
            setLastHealthCheck(new Date().toISOString());
            alert(t('health_check_complete') || `Health check complete. Overall: ${t(health.overall) || health.overall}`);
            // Reload page to show updated health
            window.location.reload();
        } catch (e) {
            console.error('Failed to check health:', e);
            alert(t('health_check_failed') || 'Failed to check system health');
        } finally {
            setIsCheckingHealth(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('system_health_monitoring') || 'System Health Monitoring'}</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleHealthCheck}
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
                        <p className="text-sm text-muted-foreground mb-2">{t('agent_health') || 'Agent Health'}</p>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {artemis.systemHealth.agents.map(agent => (
                                <div key={agent.agentId} className="p-2 border border-border rounded text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold">{agent.agentId}</span>
                                        <span className={`px-2 py-0.5 rounded ${
                                            agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                            agent.status === 'error' ? 'bg-red-500/20 text-red-400' :
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
                                    {agent.errors.length > 0 && (
                                        <div className="mt-1 text-xs text-red-400">
                                            Errors: {agent.errors.join(', ')}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">{t('integrations') || 'Integrations'}</p>
                        <div className="space-y-2">
                            {artemis.systemHealth.integrations.map((integration, idx) => (
                                <div key={idx} className="p-2 border border-border rounded text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold">{integration.name}</span>
                                        <span className={`px-2 py-0.5 rounded ${
                                            integration.status === 'connected' ? 'bg-green-500/20 text-green-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                            {t(integration.status) || integration.status}
                                        </span>
                                    </div>
                                    {integration.latency && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('latency') || 'Latency'}: {integration.latency}ms
                                        </p>
                                    )}
                                    {integration.errorRate !== undefined && (
                                        <p className="text-xs text-muted-foreground">
                                            {t('error_rate') || 'Error Rate'}: {integration.errorRate.toFixed(2)}%
                                        </p>
                                    )}
                                </div>
                            ))}
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
                    <h3 className="font-semibold text-foreground mb-4">{t('system_alerts') || 'System Alerts'}</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {artemis.systemHealth.alerts.map(alert => (
                            <div key={alert.id} className={`p-3 border rounded-lg text-sm ${
                                alert.type === 'critical' ? 'border-red-500 bg-red-500/10' :
                                alert.type === 'warning' ? 'border-yellow-500 bg-yellow-500/10' :
                                'border-blue-500 bg-blue-500/10'
                            }`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-foreground">{alert.message}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('source') || 'Source'}: {alert.source} · {new Date(alert.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                        alert.resolved ? 'bg-green-500/20 text-green-400' :
                                        alert.type === 'critical' ? 'bg-red-500/20 text-red-400' :
                                        alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {alert.resolved ? t('resolved') || 'Resolved' : t(alert.type) || alert.type}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
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
    const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);
    
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
    
    const handleGenerateAIStrategy = async () => {
        setIsGeneratingAI(true);
        try {
            const newScenario = await api.generateAIStrategy();
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
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                    <h3 className="font-semibold text-foreground">{t('trading_scenarios') || 'Trading Scenarios'}</h3>
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
                
                {scenarios.length > 0 ? (
                    <div className="space-y-3">
                        {scenarios.map(scenario => (
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
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                    {scenario.target.profit && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('target_profit') || 'Target Profit'}</p>
                                            <p className="font-semibold text-foreground">${scenario.target.profit}</p>
                                        </div>
                                    )}
                                    {scenario.target.maxTrades && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('max_trades') || 'Max Trades'}</p>
                                            <p className="font-semibold text-foreground">{scenario.target.maxTrades}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('progress') || 'Progress'}</p>
                                        <p className="font-semibold text-foreground">{scenario.progress.percentage.toFixed(1)}%</p>
                                    </div>
                                </div>
                                
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
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground mb-4">{t('no_scenarios') || 'No trading scenarios created yet.'}</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('create_first_scenario') || 'Create First Scenario'}
                        </button>
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
    const [targetProfit, setTargetProfit] = React.useState(scenario.target.profit || 0);
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
                target.profit = targetProfit;
            } else if (type === 'max_trades') {
                target.maxTrades = maxTrades;
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
                            {t('name') || 'Name'} * {autoBadge('name')}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
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
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
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
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                min="1"
                            />
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
                target.profit = targetProfit;
            } else if (type === 'max_trades') {
                target.maxTrades = maxTrades;
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

// Data Hub Component
const DataHub: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    const [dataHub, setDataHub] = useState<DataHubState | null>(artemis.dataHub || null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeView, setActiveView] = useState<'sources' | 'categories' | 'health' | 'logs' | 'advanced' | 'telegram'>('sources');
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
    const telegramCollectorUrl = typeof api.getTelegramCollectorBaseUrl === 'function' ? api.getTelegramCollectorBaseUrl() : undefined;
    
    useEffect(() => {
        const loadDataHub = async () => {
            if (!artemis.dataHub) {
                setIsLoading(true);
                try {
                    const hub = await api.fetchDataHubState();
                    setDataHub(hub);
                } catch (e) {
                    console.error('Failed to load Data Hub:', e);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadDataHub();
    }, [artemis]);
    
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

    const handleCollectorHealth = async () => {
        if (!telegramCollectorUrl) {
            setCollectorError('VITE_TELEGRAM_COLLECTOR_URL تنظیم نشده است.');
            return;
        }
        setIsLoadingCollector(true);
        setCollectorError(null);
        try {
            const health = await api.getTelegramCollectorHealth();
            setCollectorHealth(health);
            setCollectorMessage('وضعیت کلکتور به‌روزرسانی شد.');
        } catch (error: any) {
            setCollectorError(error?.message || 'خطا در دریافت وضعیت کلکتور تلگرام.');
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
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('data_categories') || 'Data Categories'}</h3>
                        <button
                            onClick={() => setShowCreateCategoryModal(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('add_category') || '+ Add Category'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dataHub.categories.map(category => (
                            <div key={category.id} className="border border-border rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-2">{category.name}</h4>
                                {category.description && (
                                    <p className="text-sm text-muted-foreground mb-2">{category.description}</p>
                                )}
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">{t('sources') || 'Sources'}: {category.sourceCount}</span>
                                    <span className="text-muted-foreground">{t('data_types') || 'Data Types'}: {category.dataTypes.length}</span>
                                </div>
                            </div>
                        ))}
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
                    <h3 className="font-semibold text-foreground mb-4">{t('access_logs') || 'Access Logs'}</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {dataHub.accessLogs.length > 0 ? (
                            dataHub.accessLogs.slice(0, 50).map(log => (
                                <div key={log.id} className="border border-border rounded p-2 text-xs">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-foreground">Agent: {log.agentId}</p>
                                            <p className="text-muted-foreground">Source: {log.sourceId} • Type: {log.dataType}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded ${
                                            log.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                            log.status === 'cached' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                            {t(log.status) || log.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-10">{t('no_logs') || 'No access logs yet'}</p>
                        )}
                    </div>
                </Card>
            )}
            
            {activeView === 'advanced' && dataHub && (
                <AdvancedFeatures dataHub={dataHub} setDataHub={setDataHub} onRefresh={onRefresh} t={t} />
            )}

            {activeView === 'telegram' && (
                <Card>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <div>
                            <h3 className="font-semibold text-foreground">{t('telegram_collector') || 'Telegram Collector'}</h3>
                            <p className="text-xs text-muted-foreground">
                                {telegramCollectorUrl
                                    ? `${t('service_url') || 'Service URL'}: ${telegramCollectorUrl}`
                                    : 'VITE_TELEGRAM_COLLECTOR_URL تنظیم نشده است.'}
                            </p>
                        </div>
                        <button
                            onClick={handleCollectorHealth}
                            disabled={isLoadingCollector || !telegramCollectorUrl}
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
                    {collectorHealth && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
                            <div className="bg-secondary/50 rounded p-3">
                                <p className="text-muted-foreground text-xs mb-1">{t('status') || 'Status'}</p>
                                <p className="font-semibold text-foreground">{collectorHealth.status}</p>
                            </div>
                            <div className="bg-secondary/50 rounded p-3">
                                <p className="text-muted-foreground text-xs mb-1">{t('uptime') || 'Uptime'}</p>
                                <p className="font-semibold text-foreground">
                                    {collectorHealth.uptime ? `${Math.floor(collectorHealth.uptime / 1000)}s` : '-'}
                                </p>
                            </div>
                            <div className="bg-secondary/50 rounded p-3">
                                <p className="text-muted-foreground text-xs mb-1">{t('tracked_channels') || 'Tracked Channels'}</p>
                                <p className="font-semibold text-foreground">{collectorHealth.channelsTracked ?? '-'}</p>
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
                                    disabled={isLoadingCollector || !telegramCollectorUrl}
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
                return 'social';
            case 'api':
            case 'third_party':
                return 'data';
            case 'aggregator':
                return 'aggregators';
            case 'webhook':
                return 'automation';
            default:
                return category || '';
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
        
        // Validate based on type
        if (type === 'telegram') {
            if (!telegramUsername) {
                alert(t('telegram_username_required') || 'Telegram channel username is required');
                return;
            }
        } else if (type === 'api' || type === 'webhook' || type === 'rss' || type === 'website') {
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
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {source ? t('edit_source') || 'Edit Source' : t('create_source') || 'Create Data Source'}
                </h3>
                
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
                            >
                                <option value="api">API</option>
                                <option value="webhook">Webhook</option>
                                <option value="rss">RSS</option>
                                <option value="telegram">Telegram</option>
                                <option value="website">Website</option>
                                <option value="aggregator">Aggregator</option>
                                <option value="third_party">Third Party</option>
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
}> = ({ dataHub, setDataHub, onRefresh, t }) => {
    const [activeFeature, setActiveFeature] = useState<'crawlers' | 'discovery' | 'prioritization' | 'access' | 'blacklist' | 'archive' | 'telegram'>('crawlers');
    const [isLoading, setIsLoading] = useState(false);
    const [showCrawlerModal, setShowCrawlerModal] = useState(false);
    const [showPublisherModal, setShowPublisherModal] = useState(false);
    const [editingCrawler, setEditingCrawler] = useState<any>(null);
    const [editingPublisher, setEditingPublisher] = useState<any>(null);
    const [editingAccessControl, setEditingAccessControl] = useState<string | null>(null);
    
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
    
    const handleAddCrawler = () => {
        setEditingCrawler(null);
        setShowCrawlerModal(true);
    };
    
    const handleSaveCrawler = async (crawlerData: any) => {
        setIsLoading(true);
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
            setIsLoading(false);
        }
    };
    
    const handleDeleteCrawler = async (crawlerId: string) => {
        const confirmed = window.confirm(t('confirm_delete') || 'Are you sure?');
        if (confirmed) {
            setIsLoading(true);
            try {
                await api.deleteWebCrawler(crawlerId);
                const updated = await api.fetchDataHubState();
                setDataHub(updated);
                onRefresh();
            } catch (e) {
                alert(t('delete_failed') || 'Failed to delete');
            } finally {
                setIsLoading(false);
            }
        }
    };
    
    const handleAddPublisher = () => {
        setEditingPublisher(null);
        setShowPublisherModal(true);
    };
    
    const handleSavePublisher = async (publisherData: any) => {
        setIsLoading(true);
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
            setIsLoading(false);
        }
    };
    
    const handleDeletePublisher = async (publisherId: string) => {
        const confirmed = window.confirm(t('confirm_delete') || 'Are you sure?');
        if (confirmed) {
            setIsLoading(true);
            try {
                await api.deleteTelegramPublisher(publisherId);
                const updated = await api.fetchDataHubState();
                setDataHub(updated);
                onRefresh();
            } catch (e) {
                alert(t('delete_failed') || 'Failed to delete');
            } finally {
                setIsLoading(false);
            }
        }
    };
    
    const handleToggleAutoDiscovery = async (enabled: boolean) => {
        setIsLoading(true);
        try {
            const updated = await api.fetchDataHubState();
            if (updated.advanced) {
                updated.advanced.autoDiscovery.enabled = enabled;
                setDataHub(updated);
                await database.save('settings', {
                    key: 'data_hub_state',
                    value: updated,
                });
            }
        } catch (e) {
            alert(t('update_failed') || 'Failed to update');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleToggleSmartPrioritization = async (enabled: boolean) => {
        setIsLoading(true);
        try {
            const updated = await api.fetchDataHubState();
            if (updated.advanced) {
                updated.advanced.smartPrioritization.enabled = enabled;
                setDataHub(updated);
                await database.save('settings', {
                    key: 'data_hub_state',
                    value: updated,
                });
            }
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
    
    return (
        <div className="space-y-6">
            <div className="flex gap-2 flex-wrap border-b border-border pb-2">
                {[
                    { id: 'crawlers', label: t('web_crawlers') || 'Web Crawlers' },
                    { id: 'discovery', label: t('auto_discovery') || 'Auto Discovery' },
                    { id: 'prioritization', label: t('smart_prioritization') || 'Smart Prioritization' },
                    { id: 'access', label: t('access_control') || 'Access Control' },
                    { id: 'blacklist', label: t('blacklist_whitelist') || 'Blacklist/Whitelist' },
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
                            {advanced.webCrawlers.map(crawler => (
                                <div key={crawler.id} className="border border-border rounded-lg p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-semibold">{crawler.name}</h4>
                                            <p className="text-xs text-muted-foreground">{crawler.url}</p>
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
                                                className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                                            >
                                                {t('edit') || 'Edit'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCrawler(crawler.id)}
                                                className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                            >
                                                {t('delete') || 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                                    setIsLoading(true);
                                    try {
                                        const discovered = await api.runAutoDiscovery();
                                        alert(t('discovery_complete') || `Found ${discovered.length} sources`);
                                        onRefresh();
                                    } catch (e) {
                                        alert(t('discovery_failed') || 'Discovery failed');
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading || !advanced.autoDiscovery.enabled}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                            >
                                {isLoading ? t('discovering') || 'Discovering...' : t('run_discovery') || 'Run Discovery'}
                            </button>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t('discovered_sources') || 'Discovered'}: {advanced.autoDiscovery.discoveredSources.length}
                    </p>
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
                                    setIsLoading(true);
                                    try {
                                        await api.calculateSourcePriorities();
                                        alert(t('priorities_updated') || 'Priorities updated');
                                        onRefresh();
                                    } catch (e) {
                                        alert(t('update_failed') || 'Update failed');
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading || !advanced.smartPrioritization.enabled}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                            >
                                {isLoading ? t('calculating') || 'Calculating...' : t('calculate_priorities') || 'Calculate'}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {advanced.smartPrioritization.rules.slice(0, 10).map(rule => {
                            const source = dataHub.sources.find(s => s.id === rule.sourceId);
                            return (
                                <div key={rule.sourceId} className="border border-border rounded p-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="font-semibold">{source?.name || rule.sourceId}</span>
                                        <span className="text-purple-400">{rule.calculatedPriority.toFixed(1)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
            
            {activeFeature === 'access' && (
                <Card>
                    <h3 className="font-semibold text-foreground mb-4">{t('access_control') || 'Access Control'}</h3>
                    <div className="space-y-3">
                        {dataHub.sources.map(source => {
                            const control = advanced.accessControl.find(ac => ac.sourceId === source.id);
                            return (
                                <div key={source.id} className="border border-border rounded-lg p-4">
                                    <div className="flex justify-between">
                                        <div>
                                            <h4 className="font-semibold">{source.name}</h4>
                                            <p className="text-xs text-muted-foreground">
                                                {control ? `${t('allowed_agents') || 'Allowed'}: ${control.allowedAgents.length || t('all') || 'All'}` : t('no_restrictions') || 'No restrictions'}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => setEditingAccessControl(source.id)}
                                            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                                        >
                                            {t('configure') || 'Configure'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
            
            {activeFeature === 'blacklist' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <h3 className="font-semibold text-foreground mb-4">{t('blacklist') || 'Blacklist'}</h3>
                        {advanced.blacklist.sources.length > 0 ? (
                            advanced.blacklist.sources.map(sourceId => {
                                const source = dataHub.sources.find(s => s.id === sourceId);
                                return (
                                    <div key={sourceId} className="border border-red-500/20 bg-red-500/10 rounded p-2 text-sm mb-2">
                                        <div className="flex justify-between">
                                            <span className="font-semibold">{source?.name || sourceId}</span>
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
                        <h3 className="font-semibold text-foreground mb-4">{t('whitelist') || 'Whitelist'}</h3>
                        {advanced.whitelist.sources.length > 0 ? (
                            advanced.whitelist.sources.map(sourceId => {
                                const source = dataHub.sources.find(s => s.id === sourceId);
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
                    </Card>
                </div>
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
                        advanced.telegramPublishers.map(publisher => (
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
                                        >
                                            {t('edit') || 'Edit'}
                                        </button>
                                        <button
                                            onClick={() => handleDeletePublisher(publisher.id)}
                                            className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                        >
                                            {t('delete') || 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
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
    
    const handleSubmit = async () => {
        if (!name || !url) {
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }
        
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
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    t: (key: string) => string;
}> = ({ publisher, sources, categories, onClose, onSave, t }) => {
    const [name, setName] = useState(publisher?.name || '');
    const [botToken, setBotToken] = useState(publisher?.botToken || '');
    const [chatId, setChatId] = useState(publisher?.chatId || '');
    const [enabled, setEnabled] = useState(publisher?.enabled ?? true);
    const [template, setTemplate] = useState(publisher?.template || '{{data}}');
    const [selectedSources, setSelectedSources] = useState<string[]>(publisher?.filters?.sources || []);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(publisher?.filters?.categories || []);
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSubmit = async () => {
        if (!name || !botToken || !chatId) {
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }
        
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
