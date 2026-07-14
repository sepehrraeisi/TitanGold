import React, { useEffect, useState } from 'react';
import * as api from '../../../../services/api.ts';
import { AIManagerOverview, ArtemisLog, ArtemisState, TradingScenario, DecisionEngineState, DataHubState, LearningSystemState, OrchestrationState } from '../../../../types.ts';

type Props = {
    data: AIManagerOverview;
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    onNavigate: (tab: any) => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const OverviewTab: React.FC<Props> = ({ data, artemis, t, onRefresh, onNavigate, Card }) => {
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [recentLogs, setRecentLogs] = useState<ArtemisLog[]>([]);
    const [scenarios, setScenarios] = useState<TradingScenario[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadAdditionalData = async () => {
        try {
            setIsLoadingLogs(true);
            setLoadError(null);
            const logs = await api.fetchArtemisLogs({ limit: 5 });
            setRecentLogs(logs || []);
            const scenariosData = await api.fetchTradingScenarios();
            setScenarios(scenariosData || []);
        } catch (e) {
            console.error('Failed to load additional data:', e);
            setRecentLogs([]);
            setScenarios([]);
            const message = e instanceof Error ? e.message : 'Unknown error';
            setLoadError(message);
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

    const dataHub: DataHubState | undefined = artemis.dataHub;
    const learningSystem: LearningSystemState | undefined = artemis.learningSystem;
    const orchestration: OrchestrationState | undefined = artemis.orchestration;
    const decisionEngine: DecisionEngineState | undefined = artemis.decisionEngine;

    return (
        <div className="space-y-6">
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
                    <Card className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold text-foreground mb-3">{t('artemis_core_metrics') || 'Core Metrics'}</h3>
                            <div className="space-y-2">
                                <ProgressBar label={t('total_decisions') || 'Total Decisions'} value={artemis.totalDecisions || 0} />
                                <ProgressBar label={t('success_rate') || 'Success Rate'} value={artemis.successRate || 0} />
                                <ProgressBar
                                    label={t('active_agents', {
                                        active: artemis.activeAgents?.length || 0,
                                        total: 15,
                                    })}
                                    value={artemis.activeAgents?.length || 0}
                                    maxValue={15}
                                />
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

                    <Card>
                        <h3 className="font-semibold text-foreground mb-3">{t('decision_engine_status') || 'Decision Engine Status'}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InfoBox label={t('strategy') || 'Strategy'} value={t(decisionEngine?.strategy || '') || decisionEngine?.strategy || 'N/A'} />
                            <InfoBox label={t('active_model') || 'Active Model'} value={t(decisionEngine?.activeModel || '') || decisionEngine?.activeModel || 'N/A'} />
                            <InfoBox label={t('confidence_threshold') || 'Confidence Threshold'} value={`${decisionEngine?.confidenceThreshold || 0}%`} />
                        </div>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <SmallStat label={t('recent_decisions') || 'Recent'} value={decisionEngine?.recentDecisions?.length || 0} />
                            <SmallStat label={t('avg_confidence') || 'Avg Confidence'} value={
                                decisionEngine?.recentDecisions?.length
                                    ? `${(decisionEngine.recentDecisions.reduce((sum, d) => sum + (d.output?.confidence || 0), 0) / decisionEngine.recentDecisions.length).toFixed(1)}%`
                                    : 'N/A'
                            } />
                            <SmallStat label={t('last_decision') || 'Last Decision'} value={
                                artemis.lastDecisionTime ? new Date(artemis.lastDecisionTime).toLocaleTimeString() : 'N/A'
                            } />
                            <SmallStat label={t('total_decisions') || 'Total'} value={artemis.totalDecisions || 0} />
                        </div>
                    </Card>

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
                                <SmallStat label={t('total_sources') || 'Total Sources'} value={dataHub?.totalSources || 0} />
                                <SmallStat label={t('active_sources') || 'Active'} value={dataHub?.activeSources || 0} valueClass="text-green-400" />
                                <SmallStat label={t('cache_hit_rate') || 'Cache Hit'} value={`${dataHub?.cache?.hitRate?.toFixed(1) || '0.0'}%`} valueClass="text-purple-400" />
                                <SmallStat label={t('health_status') || 'Health'} value={t(dataHub?.health?.overall || '') || dataHub?.health?.overall || 'N/A'} valueClass={
                                    dataHub?.health?.overall === 'healthy' ? 'text-green-400' :
                                        dataHub?.health?.overall === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                                } />
                            </div>
                        </Card>
                    )}

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
                                <SmallStat label={t('total_trades') || 'Total Trades'} value={learningSystem?.totalTrades || 0} />
                                <SmallStat label={t('total_decisions') || 'Total Decisions'} value={learningSystem?.totalDecisions || 0} />
                                <SmallStat label={t('model_versions') || 'Model Versions'} value={learningSystem?.modelVersions?.length || 0} />
                                <SmallStat label={t('last_training') || 'Last Training'} value={
                                    learningSystem?.lastTraining ? new Date(learningSystem.lastTraining).toLocaleDateString() : 'N/A'
                                } />
                            </div>
                        </Card>
                    )}

                    {orchestration && (
                        <Card>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-foreground">{t('orchestration_summary') || 'Orchestration Summary'}</h3>
                                <button
                                    onClick={() => onNavigate('orchestration')}
                                    className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                                >
                                    {t('view_details') || 'View Details'} →
                                </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <SmallStat label={t('active_agents_count') || 'Active Agents'} value={orchestration?.activeAgents || 0} />
                                <SmallStat label={t('agent_tasks') || 'Agent Tasks'} value={orchestration?.agentTasks?.length || 0} />
                                <SmallStat label={t('failover_enabled') || 'Failover'} value={orchestration?.failoverStatus?.enabled ? 'On' : 'Off'} />
                                <SmallStat label={t('resources_allocated') || 'Resources'} value={Object.keys(orchestration?.resourceAllocation || {}).length} />
                            </div>
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    <Card>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-foreground">{t('recent_logs') || 'Recent Logs'}</h3>
                            <button
                                onClick={() => onNavigate('logs')}
                                className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                            >
                                {t('view_details') || 'View Details'} →
                            </button>
                        </div>
                        {isLoadingLogs ? (
                            <p className="text-sm text-muted-foreground">{t('loading')}</p>
                        ) : (
                            <div className="space-y-2 text-sm">
                                {loadError && recentLogs.length === 0 && (
                                    <p className="text-xs text-red-400">
                                        {t('failed_to_load_data') || 'Failed to load recent logs.'}
                                    </p>
                                )}
                                {recentLogs.length === 0 && !loadError ? (
                                    <p className="text-muted-foreground text-xs">{t('no_data') || 'No data available'}</p>
                                ) : recentLogs.map(log => (
                                    <div key={log.id} className="p-2 rounded bg-secondary/40 flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-foreground text-xs">{log.action}</p>
                                            <p className="text-muted-foreground text-[11px]">{new Date(log.timestamp).toLocaleString()}</p>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground">{log.type}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-foreground">{t('trading_scenarios') || 'Trading Scenarios'}</h3>
                            <button
                                onClick={() => onNavigate('scenarios')}
                                className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                            >
                                {t('view_details') || 'View Details'} →
                            </button>
                        </div>
                        <div className="space-y-3 text-sm">
                            {loadError && scenarios.length === 0 && (
                                <p className="text-xs text-red-400">
                                    {t('failed_to_load_data') || 'Failed to load trading scenarios summary.'}
                                </p>
                            )}
                            {scenarios.length === 0 && !loadError ? (
                                <p className="text-muted-foreground text-xs">{t('no_data') || 'No data available'}</p>
                            ) : scenarios.map(scenario => (
                                <div key={scenario.id} className="p-2 rounded bg-secondary/40 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-foreground text-xs">{scenario.name}</p>
                                        <p className="text-muted-foreground text-[11px]">{scenario.type}</p>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">{scenario.status}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const ProgressBar: React.FC<{ label: string; value: number; maxValue?: number }> = ({ label, value, maxValue = 100 }) => {
    const percentage = Math.min(100, Math.round((value / maxValue) * 100));
    return (
        <div>
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{label}</span>
                <span>{percentage}%</span>
            </div>
            <div className="w-full bg-secondary/40 rounded-full h-2 mt-1">
                <div className="h-2 rounded-full bg-purple-500" style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const Stat: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
    <div className="text-center p-3 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
    </div>
);

const InfoBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="text-center p-3 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-bold text-foreground mt-1">{value}</p>
    </div>
);

const SmallStat: React.FC<{ label: string; value: string | number; valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="bg-secondary/40 rounded p-2 text-center">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-lg font-semibold text-foreground ${valueClass || ''}`}>{value}</p>
    </div>
);

export default OverviewTab;

