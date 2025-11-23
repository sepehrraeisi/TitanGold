import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    AllocationCorrelation,
    AllocationLiquidityAlert,
    AllocationRoiProjection,
    PortfolioAllocationConfig,
    PortfolioAllocationMetrics,
    PortfolioAllocationResult,
    PortfolioGoal,
    RebalanceAction,
} from '../../types.ts';

type PortfolioTab =
    | 'overview'
    | 'suggestion'
    | 'risk'
    | 'history'
    | 'performance'
    | 'settings'
    | 'integration';

const TAB_ITEMS: Array<{ id: PortfolioTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'suggestion', labelKey: 'tab_allocation_suggestion' },
    { id: 'risk', labelKey: 'tab_risk_diversification' },
    { id: 'history', labelKey: 'tab_rebalance_history' },
    { id: 'performance', labelKey: 'tab_performance' },
    { id: 'settings', labelKey: 'tab_settings' },
    { id: 'integration', labelKey: 'tab_integration' },
];

interface PortfolioAllocationAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const PortfolioAllocationAgentControl: React.FC<PortfolioAllocationAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<PortfolioTab>('overview');
    const [config, setConfig] = useState<PortfolioAllocationConfig | null>(agent.portfolioAllocationConfig || null);
    const [metrics, setMetrics] = useState<PortfolioAllocationMetrics | null>(agent.allocationMetrics || null);
    const [analysis, setAnalysis] = useState<PortfolioAllocationResult | null>(agent.lastAllocationAnalysis || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchPortfolioAllocationAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastAnalysis) setAnalysis(data.lastAnalysis);
            } catch (error) {
                console.error('Failed to load allocation agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [agent.id]);

    const handleRunAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const result = await api.runPortfolioAllocationAnalysis(agent.id);
            setAnalysis(result);
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.allocationMetrics || null);
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run allocation analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: PortfolioAllocationConfig) => {
        setIsLoading(true);
        try {
            await api.updatePortfolioAllocationConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated');
        } catch (error) {
            console.error('Failed to update allocation config:', error);
            alert(t('update_failed') || 'Update failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleControlCommand = async (command: string) => {
        setIsLoading(true);
        try {
            await api.sendAgentControlCommand(agent.id, command);
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) {
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to execute command:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsLoading(false);
        }
    };

    const recommendedActions = useMemo(() => analysis?.recommendedActions ?? [], [analysis]);
    const roiProjections = useMemo(() => analysis?.expectedRoi ?? [], [analysis]);
    const correlationMatrix = useMemo<AllocationCorrelation[]>(() => analysis?.correlationMatrix ?? [], [analysis]);
    const liquidityAlerts = useMemo<AllocationLiquidityAlert[]>(() => analysis?.liquidityAlerts ?? [], [analysis]);
    const history = useMemo(() => metrics?.history ?? [], [metrics?.history]);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#10141A] border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden">
                <Header agent={agent} t={t} onClose={onClose} onRunAnalysis={handleRunAnalysis} isAnalyzing={isAnalyzing} />
                <StatusBar agent={agent} metrics={metrics} analysis={analysis} onCommand={handleControlCommand} t={t} />

                <nav className="flex flex-wrap gap-4 px-6 border-b border-gray-800 bg-[#0B1017]">
                    {TAB_ITEMS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-cyan-500 text-cyan-300'
                                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
                            }`}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </nav>

                <div className="p-6 bg-[#0F151D] overflow-y-auto h-full">
                    {activeTab === 'overview' && analysis && metrics && (
                        <OverviewTab analysis={analysis} metrics={metrics} liquidityAlerts={liquidityAlerts} t={t} />
                    )}
                    {activeTab === 'suggestion' && analysis && (
                        <SuggestionTab analysis={analysis} actions={recommendedActions} roiProjections={roiProjections} t={t} />
                    )}
                    {activeTab === 'risk' && analysis && (
                        <RiskTab
                            analysis={analysis}
                            correlationMatrix={correlationMatrix}
                            liquidityAlerts={liquidityAlerts}
                            metrics={metrics}
                            t={t}
                        />
                    )}
                    {activeTab === 'history' && (
                        <HistoryTab history={history} actions={recommendedActions} t={t} />
                    )}
                    {activeTab === 'performance' && metrics && (
                        <PerformanceTab metrics={metrics} t={t} />
                    )}
                    {activeTab === 'settings' && config && (
                        <SettingsTab config={config} disabled={isLoading} onUpdate={handleUpdateConfig} t={t} />
                    )}
                    {activeTab === 'integration' && config && (
                        <IntegrationTab config={config} t={t} />
                    )}

                    {!analysis && activeTab === 'overview' && (
                        <EmptyState message={t('no_allocation_data') || 'No allocation analyses have been run yet.'} />
                    )}
                </div>
            </div>
        </div>
    );
};

const Header: React.FC<{
    agent: AIAgent;
    t: (key: string) => string;
    onRunAnalysis: () => void;
    onClose: () => void;
    isAnalyzing: boolean;
}> = ({ agent, t, onRunAnalysis, onClose, isAnalyzing }) => (
    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-[#0B1017]">
        <div>
            <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{t('allocation_agent_desc') || 'Balances holdings using live wallet and market data.'}</p>
        </div>
        <div className="flex gap-3">
            <button
                onClick={onRunAnalysis}
                disabled={isAnalyzing || agent.status !== 'active'}
                className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {isAnalyzing ? t('analyzing') || 'Analyzing...' : t('run_analysis')}
            </button>
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm">
                {t('close')}
            </button>
        </div>
    </div>
);

const StatusBar: React.FC<{
    agent: AIAgent;
    metrics: PortfolioAllocationMetrics | null;
    analysis: PortfolioAllocationResult | null;
    onCommand: (command: string) => void;
    t: (key: string) => string;
}> = ({ agent, metrics, analysis, onCommand, t }) => (
    <div className="px-6 py-3 border-b border-gray-800 bg-[#0B1017]">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
                <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        agent.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : agent.status === 'training'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-gray-500/20 text-gray-400'
                    }`}
                >
                    {t(agent.status)}
                </span>
                <StatusMetric label={t('total_value') || 'Total value'} value={analysis ? `$${analysis.totalValueUSDT.toLocaleString()}` : '--'} />
                <StatusMetric label={t('average_drift') || 'Avg drift'} value={`${metrics?.averageDrift?.toFixed(2) ?? '--'}%`} />
                <StatusMetric label={t('risk_reward_score') || 'Risk/Reward'} value={analysis?.riskRewardScore ?? '--'} />
                <StatusMetric label={t('diversification_index') || 'Diversification'} value={`${analysis?.diversificationIndex ?? '--'}`} />
            </div>
            <div className="flex gap-2">
                {agent.status === 'active' ? (
                    <button
                        onClick={() => onCommand('pause')}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                    >
                        {t('pause')}
                    </button>
                ) : (
                    <button
                        onClick={() => onCommand('start')}
                        className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                    >
                        {t('start')}
                    </button>
                )}
                <button
                    onClick={() => onCommand('restart')}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                >
                    {t('restart')}
                </button>
            </div>
        </div>
    </div>
);

const StatusMetric: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <span className="text-xs text-gray-400">
        {label}: <span className="text-white font-semibold">{value}</span>
    </span>
);

const OverviewTab: React.FC<{
    analysis: PortfolioAllocationResult;
    metrics: PortfolioAllocationMetrics;
    liquidityAlerts: AllocationLiquidityAlert[];
    t: (key: string) => string;
}> = ({ analysis, metrics, liquidityAlerts, t }) => {
    const summaryCards = [
        { label: t('total_value') || 'Total Value', value: `$${analysis.totalValueUSDT.toLocaleString()}` },
        { label: t('drift_score') || 'Drift Score', value: `${analysis.driftScore.toFixed(2)}%` },
        { label: t('risk_reward_score') || 'Risk/Reward', value: analysis.riskRewardScore ?? '--' },
        { label: t('diversification_index') || 'Diversification', value: analysis.diversificationIndex ?? '--' },
    ];
    const allocations = analysis.allocations.slice(0, 6);
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {summaryCards.map(card => (
                    <SectionCard key={card.label} title={card.label}>
                        <p className="text-2xl text-white font-semibold">{card.value}</p>
                    </SectionCard>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title={t('current_allocations') || 'Current allocations'}>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {allocations.map(item => (
                            <div key={item.symbol} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-3">
                                <div>
                                    <p className="text-white font-semibold">{item.symbol}</p>
                                    <p className="text-xs text-gray-500">{formatCurrency(item.valueUSDT)}</p>
                                </div>
                                <InfoBadge label={`${item.percentage.toFixed(2)}%`} tone="accent" />
                            </div>
                        ))}
                    </div>
                </SectionCard>
                <SectionCard title={t('rebalance_signal') || 'Rebalance signal'}>
                    {analysis.rebalanceSignal ? (
                        <div className="space-y-2">
                            <InfoBadge
                                label={t(`rebalance_action_${analysis.rebalanceSignal.action}`) || analysis.rebalanceSignal.action}
                                tone={analysis.rebalanceSignal.action === 'rebalance' ? 'warning' : 'info'}
                            />
                            <p className="text-sm text-white font-semibold">{analysis.rebalanceSignal.reason}</p>
                            <p className="text-xs text-gray-400">
                                {t('signal_window') || 'Window'}: {analysis.rebalanceSignal.window}
                            </p>
                            <p className="text-xs text-gray-400">
                                {t('confidence') || 'Confidence'}: {analysis.rebalanceSignal.confidence}%
                            </p>
                        </div>
                    ) : (
                        <EmptyState message={t('no_rebalance_needed') || 'Portfolio is within target bands.'} />
                    )}
                </SectionCard>
            </div>
            <SectionCard title={t('liquidity_alerts') || 'Liquidity alerts'}>
                {liquidityAlerts.length ? (
                    <div className="space-y-2">
                        {liquidityAlerts.map(alert => (
                            <div key={`${alert.symbol}-${alert.message}`} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-3">
                                <div>
                                    <p className="text-white font-semibold">{alert.symbol}</p>
                                    <p className="text-xs text-gray-400">{alert.message}</p>
                                </div>
                                <InfoBadge label={t(alert.severity) || alert.severity} tone={alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : 'muted'} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState message={t('no_liquidity_alerts') || 'No liquidity warnings detected.'} />
                )}
            </SectionCard>
        </div>
    );
};

const SuggestionTab: React.FC<{
    analysis: PortfolioAllocationResult;
    actions: RebalanceAction[];
    roiProjections: AllocationRoiProjection[];
    t: (key: string) => string;
}> = ({ analysis, actions, roiProjections, t }) => {
    const optimal = analysis.optimalAllocation ?? [];
    return (
        <div className="space-y-6">
            <SectionCard title={t('optimal_allocation') || 'Optimal allocation'}>
                {optimal.length ? (
                    <div className="space-y-3">
                        {optimal.map(target => {
                            const current = analysis.allocations.find(a => a.symbol === target.symbol);
                            return (
                                <div key={target.symbol} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-3">
                                    <div>
                                        <p className="text-white font-semibold">{target.symbol}</p>
                                        <p className="text-xs text-gray-400">
                                            {t('current_vs_target') || 'Current → Target'}:{' '}
                                            {current ? `${current.percentage.toFixed(2)}%` : '0%'} → {target.percentage.toFixed(2)}%
                                        </p>
                                    </div>
                                    <InfoBadge
                                        label={`${(target.percentage - (current?.percentage ?? 0)).toFixed(2)}%`}
                                        tone={target.percentage > (current?.percentage ?? 0) ? 'accent' : 'info'}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState message={t('no_suggestion_data') || 'No allocation suggestion available yet.'} />
                )}
            </SectionCard>
            <SectionCard title={t('expected_roi') || 'Expected ROI'}>
                {roiProjections.length ? (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
                        {roiProjections.map(projection => (
                            <div key={projection.symbol} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-3">
                                <div>
                                    <p className="text-white font-semibold">{projection.symbol}</p>
                                    <p className="text-xs text-gray-400">
                                        {t('expected_roi') || 'Expected ROI'}: {projection.expectedRoiPercent}%
                                    </p>
                                </div>
                                <div className="text-right text-xs text-gray-400">
                                    <p>
                                        {t('expected_volatility') || 'Expected volatility'}: {projection.expectedVolatilityPercent}%
                                    </p>
                                    <p>
                                        {t('confidence') || 'Confidence'}: {projection.confidence}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState message={t('no_roi_data') || 'No ROI projection available.'} />
                )}
            </SectionCard>
            <SectionCard title={t('rebalance_actions') || 'Rebalance actions'}>
                <RebalanceActionsList actions={actions} t={t} />
            </SectionCard>
        </div>
    );
};

const RiskTab: React.FC<{
    analysis: PortfolioAllocationResult;
    correlationMatrix: AllocationCorrelation[];
    liquidityAlerts: AllocationLiquidityAlert[];
    metrics: PortfolioAllocationMetrics | null;
    t: (key: string) => string;
}> = ({ analysis, correlationMatrix, liquidityAlerts, metrics, t }) => (
    <div className="space-y-6">
        <SectionCard title={t('correlation_matrix') || 'Correlation matrix'}>
            {correlationMatrix.length ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 text-sm">
                    {correlationMatrix.map(pair => (
                        <div key={pair.pair} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-3">
                            <span className="text-white font-semibold">{pair.pair}</span>
                            <InfoBadge label={pair.value.toFixed(2)} tone={Math.abs(pair.value) > 0.6 ? 'danger' : 'info'} />
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState message={t('no_correlation_data') || 'No correlation data yet.'} />
            )}
        </SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label={t('diversification_index') || 'Diversification'} value={analysis.diversificationIndex ?? '--'} />
            <MetricCard label={t('risk_reward_score') || 'Risk/Reward'} value={analysis.riskRewardScore ?? '--'} />
            <MetricCard label={t('liquidity_alerts') || 'Liquidity alerts'} value={liquidityAlerts.length} />
        </div>
        <SectionCard title={t('risk_insights') || 'Risk insights'}>
            <ul className="text-sm text-gray-300 space-y-1">
                <li>{t('total_rebalances') || 'Rebalances'}: {metrics?.totalRebalances ?? 0}</li>
                <li>{t('constraints_breached') || 'Constraint breaches'}: {metrics?.constraintsBreached ?? 0}</li>
                <li>{t('liquidity_alerts_last24h') || 'Liquidity alerts (24h)'}: {metrics?.liquidityAlerts24h ?? 0}</li>
            </ul>
        </SectionCard>
    </div>
);

const HistoryTab: React.FC<{ history: PortfolioAllocationMetrics['history'] | undefined; actions: RebalanceAction[]; t: (key: string) => string }> = ({
    history,
    actions,
    t,
}) => (
    <div className="space-y-6">
        <SectionCard title={t('rebalance_history') || 'Rebalance history'}>
            {history && history.length ? (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                    {history.map(entry => (
                        <div key={entry.timestamp} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-3">
                            <div>
                                <p className="text-white font-semibold">{new Date(entry.timestamp).toLocaleString()}</p>
                                <p className="text-xs text-gray-400">
                                    {t('total_value') || 'Total value'}: {formatCurrency(entry.totalValueUSDT)}
                                </p>
                            </div>
                            <div className="text-right text-xs text-gray-400">
                                <p>{t('expected_roi') || 'Expected ROI'}: {entry.roiPercent}%</p>
                                <p>{t('drift_score') || 'Drift score'}: {entry.driftScore.toFixed(2)}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState message={t('no_rebalance_history') || 'No rebalance history yet.'} />
            )}
        </SectionCard>
        <SectionCard title={t('rebalance_actions') || 'Rebalance actions'}>
            <RebalanceActionsList actions={actions} t={t} />
        </SectionCard>
    </div>
);

const PerformanceTab: React.FC<{ metrics: PortfolioAllocationMetrics; t: (key: string) => string }> = ({ metrics, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label={t('total_analyses') || 'Analyses'} value={metrics.totalAnalyses} />
            <MetricCard label={t('total_rebalances') || 'Rebalances'} value={metrics.totalRebalances} />
            <MetricCard label={t('auto_rebalances') || 'Auto rebalances'} value={metrics.autoRebalances} />
            <MetricCard label={t('liquidity_alerts') || 'Liquidity alerts'} value={metrics.liquidityAlerts24h ?? 0} />
        </div>
        <SectionCard title={t('recent_performance') || 'Recent performance'}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                <div>
                    <p className="text-xs uppercase text-gray-500">{t('last24h_analyses') || 'Analyses 24h'}</p>
                    <p className="text-white font-semibold">{metrics.recentPerformance.last24h.analyses}</p>
                    <p className="text-xs text-gray-500">{t('average_drift') || 'Avg drift'}: {metrics.recentPerformance.last24h.avgDrift.toFixed(2)}%</p>
                </div>
                <div>
                    <p className="text-xs uppercase text-gray-500">{t('last7d') || 'Last 7d'}</p>
                    <p className="text-white font-semibold">{metrics.recentPerformance.last7d.analyses}</p>
                </div>
                <div>
                    <p className="text-xs uppercase text-gray-500">{t('last30d') || 'Last 30d'}</p>
                    <p className="text-white font-semibold">{metrics.recentPerformance.last30d.analyses}</p>
                </div>
            </div>
        </SectionCard>
    </div>
);

const GOAL_OPTIONS: Array<{ value: PortfolioGoal; labelKey: string }> = [
    { value: 'growth', labelKey: 'goal_growth' },
    { value: 'income', labelKey: 'goal_income' },
    { value: 'capital_preservation', labelKey: 'goal_capital_preservation' },
    { value: 'diversification', labelKey: 'goal_diversification' },
    { value: 'market_focus', labelKey: 'goal_market_focus' },
];

const SettingsTab: React.FC<{
    config: PortfolioAllocationConfig;
    disabled: boolean;
    onUpdate: (config: PortfolioAllocationConfig) => void;
    t: (key: string) => string;
}> = ({ config, disabled, onUpdate, t }) => {
    const [draft, setDraft] = useState(config);

    useEffect(() => setDraft(config), [config]);

    const updateDraft = (updater: (prev: PortfolioAllocationConfig) => PortfolioAllocationConfig) => {
        setDraft(prev => updater(prev));
    };

    const handleSave = () => onUpdate(draft);

    const toggleGoal = (goal: PortfolioGoal) => {
        updateDraft(prev => ({
            ...prev,
            goals: prev.goals.includes(goal) ? prev.goals.filter(item => item !== goal) : [...prev.goals, goal],
        }));
    };

    const updateTarget = (symbol: string, field: 'targetPercent' | 'rebalanceThreshold', value: number) => {
        updateDraft(prev => ({
            ...prev,
            targets: prev.targets.map(target => (target.symbol === symbol ? { ...target, [field]: value } : target)),
        }));
    };

    const priorityValue = (draft.priorityAssets ?? []).map(asset => `${asset.symbol}:${asset.priority}`).join(', ');

    const handlePriorityChange = (value: string) => {
        const items = value
            .split(',')
            .map(entry => entry.trim())
            .filter(Boolean)
            .map(item => {
                const [symbol, priority] = item.split(':').map(part => part.trim());
                const normalizedPriority = (priority?.toLowerCase() as 'low' | 'medium' | 'high') || 'medium';
                return { symbol: symbol?.toUpperCase() || 'ASSET', priority: normalizedPriority };
            });
        updateDraft(prev => ({ ...prev, priorityAssets: items }));
    };

    return (
        <div className="space-y-6">
            <SectionCard title={t('allocation_goals') || 'Portfolio goals'}>
                <div className="flex flex-wrap gap-3">
                    {GOAL_OPTIONS.map(option => (
                        <label key={option.value} className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={draft.goals.includes(option.value)}
                                onChange={() => toggleGoal(option.value)}
                                disabled={disabled}
                            />
                            <span>{t(option.labelKey)}</span>
                        </label>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('base_currency') || 'Base currency'}>
                <Field
                    label={t('base_currency') || 'Base currency'}
                    value={draft.baseCurrency}
                    onChange={value => updateDraft(prev => ({ ...prev, baseCurrency: value.toUpperCase() }))}
                />
            </SectionCard>

            <SectionCard title={t('target_allocations') || 'Target allocations'}>
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                    {draft.targets.map(target => (
                        <div key={target.symbol} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-white font-semibold">{target.symbol}</p>
                                    <p className="text-xs text-gray-400">
                                        {t('min') || 'Min'} {target.minPercent}% · {t('max') || 'Max'} {target.maxPercent}%
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <Field
                                    label={t('target_percent') || 'Target %'}
                                    type="number"
                                    value={target.targetPercent.toString()}
                                    onChange={value => updateTarget(target.symbol, 'targetPercent', Number(value))}
                                />
                                <Field
                                    label={t('rebalance_threshold') || 'Rebalance threshold %'}
                                    type="number"
                                    value={target.rebalanceThreshold.toString()}
                                    onChange={value => updateTarget(target.symbol, 'rebalanceThreshold', Number(value))}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('auto_settings') || 'Automation'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('auto_execute') || 'Enable auto allocation'}
                        checked={draft.autoSettings.enabled}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoSettings: { ...prev.autoSettings, enabled: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('require_confirmation') || 'Require confirmation'}
                        checked={draft.autoSettings.requireConfirmation}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoSettings: { ...prev.autoSettings, requireConfirmation: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('rebalance_on_signal') || 'Rebalance on signal'}
                        checked={draft.autoSettings.rebalanceOnSignal}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoSettings: { ...prev.autoSettings, rebalanceOnSignal: checked },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('monitoring_settings') || 'Monitoring'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field
                        label={t('sensitivity') || 'Sensitivity'}
                        type="select"
                        value={draft.monitoring.sensitivity}
                        options={[
                            { value: 'low', label: t('sensitivity_low') || 'Low' },
                            { value: 'medium', label: t('sensitivity_medium') || 'Medium' },
                            { value: 'high', label: t('sensitivity_high') || 'High' },
                        ]}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                monitoring: { ...prev.monitoring, sensitivity: value as PortfolioAllocationConfig['monitoring']['sensitivity'] },
                            }))
                        }
                    />
                    <Field
                        label={t('rebalance_threshold') || 'Drift threshold %'}
                        type="number"
                        value={draft.monitoring.rebalanceSignalThreshold.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                monitoring: { ...prev.monitoring, rebalanceSignalThreshold: Number(value) },
                            }))
                        }
                    />
                    <Field
                        label={t('rebalance_period') || 'Rebalance period'}
                        type="select"
                        value={draft.monitoring.rebalancePeriod}
                        options={[
                            { value: 'daily', label: t('daily') || 'Daily' },
                            { value: 'weekly', label: t('weekly') || 'Weekly' },
                            { value: 'monthly', label: t('monthly') || 'Monthly' },
                        ]}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                monitoring: { ...prev.monitoring, rebalancePeriod: value as PortfolioAllocationConfig['monitoring']['rebalancePeriod'] },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('liquidity_filters') || 'Liquidity filters'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                        label={t('min_daily_volume') || 'Min daily volume (USD)'}
                        type="number"
                        value={draft.liquidityFilters.minDailyVolumeUSD.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                liquidityFilters: { ...prev.liquidityFilters, minDailyVolumeUSD: Number(value) },
                            }))
                        }
                    />
                    <Field
                        label={t('min_market_cap') || 'Min market cap (USD)'}
                        type="number"
                        value={draft.liquidityFilters.minMarketCapUSD.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                liquidityFilters: { ...prev.liquidityFilters, minMarketCapUSD: Number(value) },
                            }))
                        }
                    />
                    <Field
                        label={t('max_concentration') || 'Max concentration %'}
                        type="number"
                        value={draft.liquidityFilters.maxConcentrationPercent.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                liquidityFilters: { ...prev.liquidityFilters, maxConcentrationPercent: Number(value) },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('enforce_stable_reserve') || 'Enforce stable reserve'}
                        checked={draft.liquidityFilters.enforceStableReserve}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                liquidityFilters: { ...prev.liquidityFilters, enforceStableReserve: checked },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('priority_assets') || 'Priority assets'}>
                <Field
                    label={t('priority_assets_hint') || 'Symbol:priority (comma separated)'}
                    type="textarea"
                    value={priorityValue}
                    onChange={handlePriorityChange}
                />
            </SectionCard>

            <SectionCard title={t('notification_settings') || 'Notifications'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('notify_on_drift') || 'Notify on drift'}
                        checked={draft.notificationSettings.onDrift}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                notificationSettings: { ...prev.notificationSettings, onDrift: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('notify_on_constraint') || 'Notify on constraint breach'}
                        checked={draft.notificationSettings.onConstraintBreach}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                notificationSettings: { ...prev.notificationSettings, onConstraintBreach: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('notify_on_auto_rebalance') || 'Notify on auto rebalance'}
                        checked={draft.notificationSettings.onAutoRebalance}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                notificationSettings: { ...prev.notificationSettings, onAutoRebalance: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('notify_on_liquidity') || 'Notify on liquidity issues'}
                        checked={draft.notificationSettings.onLiquidity}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                notificationSettings: { ...prev.notificationSettings, onLiquidity: checked },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('integration_settings') || 'Integration settings'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('share_with_risk') || 'Share with Risk agent'}
                        checked={draft.integrationSettings?.shareWithRisk ?? true}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...(prev.integrationSettings ?? {}), shareWithRisk: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('share_with_technical') || 'Share with Technical agent'}
                        checked={draft.integrationSettings?.shareWithTechnical ?? true}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...(prev.integrationSettings ?? {}), shareWithTechnical: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('share_with_prediction') || 'Share with Prediction agent'}
                        checked={draft.integrationSettings?.shareWithPrediction ?? true}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...(prev.integrationSettings ?? {}), shareWithPrediction: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('share_with_sentiment') || 'Share with Sentiment agent'}
                        checked={draft.integrationSettings?.shareWithSentiment ?? true}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...(prev.integrationSettings ?? {}), shareWithSentiment: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('forward_to_artemis') || 'Forward to Artemis'}
                        checked={draft.integrationSettings?.forwardToArtemis ?? true}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...(prev.integrationSettings ?? {}), forwardToArtemis: checked },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => setDraft(config)}
                    disabled={disabled}
                    className="px-4 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                >
                    {t('reset_changes') || 'Reset'}
                </button>
                <button
                    onClick={handleSave}
                    disabled={disabled}
                    className="px-5 py-2 rounded-lg text-sm bg-cyan-500 hover:bg-cyan-400 text-white font-semibold disabled:opacity-50"
                >
                    {t('save_changes') || 'Save changes'}
                </button>
            </div>
        </div>
    );
};

const IntegrationTab: React.FC<{ config: PortfolioAllocationConfig; t: (key: string) => string }> = ({ config, t }) => {
    const integration = config.integrationSettings;
    const items = [
        { label: t('share_with_risk') || 'Share with Risk', enabled: integration?.shareWithRisk },
        { label: t('share_with_technical') || 'Share with Technical', enabled: integration?.shareWithTechnical },
        { label: t('share_with_prediction') || 'Share with Prediction', enabled: integration?.shareWithPrediction },
        { label: t('share_with_sentiment') || 'Share with Sentiment', enabled: integration?.shareWithSentiment },
        { label: t('forward_to_artemis') || 'Forward to Artemis', enabled: integration?.forwardToArtemis },
    ];
    return (
        <div className="space-y-6">
            <SectionCard title={t('integration_settings') || 'Integration settings'}>
                <div className="space-y-2">
                    {items.map(item => (
                        <div key={item.label} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-3">
                            <span className="text-white text-sm">{item.label}</span>
                            <InfoBadge label={item.enabled ? t('connected') || 'Connected' : t('disabled') || 'Disabled'} tone={item.enabled ? 'success' : 'muted'} />
                        </div>
                    ))}
                </div>
            </SectionCard>
            <SectionCard title={t('allocation_goals') || 'Portfolio goals'}>
                <div className="flex flex-wrap gap-2">
                    {config.goals.map(goal => (
                        <InfoBadge key={goal} label={t(`goal_${goal}`) || goal} tone="info" />
                    ))}
                </div>
            </SectionCard>
            <SectionCard title={t('priority_assets') || 'Priority assets'}>
                {config.priorityAssets?.length ? (
                    <div className="flex flex-wrap gap-2">
                        {config.priorityAssets.map(asset => (
                            <InfoBadge key={asset.symbol} label={`${asset.symbol} (${asset.priority})`} tone="accent" />
                        ))}
                    </div>
                ) : (
                    <EmptyState message={t('no_priority_assets') || 'No priority assets defined.'} />
                )}
            </SectionCard>
        </div>
    );
};

const RebalanceActionsList: React.FC<{ actions: RebalanceAction[]; t: (key: string) => string }> = ({ actions, t }) => (
    <>
        {actions.length ? (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                {actions.map(action => (
                    <div key={`${action.symbol}-${action.action}`} className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <p className="text-white font-semibold">
                                {action.symbol} · {action.action === 'buy' ? t('buy') || 'Buy' : t('sell') || 'Sell'}
                            </p>
                            <p className="text-xs text-gray-400">
                                {t('current_vs_target') || 'Current → Target'}: {action.currentPercent.toFixed(2)}% → {action.targetPercent.toFixed(2)}%
                            </p>
                        </div>
                        <div className="flex gap-6 text-sm">
                            <MiniStat label={t('difference') || 'Difference'} value={`${action.differencePercent.toFixed(2)}%`} />
                            <MiniStat label={t('required_amount') || 'Required (USDT)'} value={formatCurrency(action.requiredAmountUSDT)} />
                            <MiniStat label={t('priority') || 'Priority'} value={t(action.priority) || action.priority} />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_rebalance_needed') || 'Portfolio is within target bands.'} />
        )}
    </>
);

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        {children}
    </section>
);

const MetricCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
    </div>
);

const MiniStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div>
        <p className="text-xs text-gray-500 uppercase">{label}</p>
        <p className="text-white font-semibold">{value}</p>
    </div>
);

const InfoBadge: React.FC<{ label: string | number; tone?: 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'muted' }> = ({ label, tone = 'info' }) => {
    const tones: Record<typeof tone, string> = {
        success: 'bg-green-500/15 text-green-300',
        danger: 'bg-red-500/15 text-red-300',
        warning: 'bg-yellow-500/15 text-yellow-200',
        info: 'bg-blue-500/15 text-blue-200',
        accent: 'bg-cyan-500/20 text-cyan-200',
        muted: 'bg-gray-600/20 text-gray-300',
    };
    return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${tones[tone]}`}>{label}</span>;
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center text-gray-400 py-10 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">{message}</div>
);

const Field: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'number' | 'select' | 'textarea';
    options?: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, type = 'text', options }) => (
    <label className="text-sm text-gray-300 space-y-2">
        <span>{label}</span>
        {type === 'select' ? (
            <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm">
                {options?.map(option => (
                    <option key={option.value} value={option.value} className="text-black">
                        {option.label}
                    </option>
                ))}
            </select>
        ) : type === 'textarea' ? (
            <textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                rows={3}
            />
        ) : (
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
            />
        )}
    </label>
);

const ToggleField: React.FC<{ label: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4 text-sm text-gray-200">
        <span>{label}</span>
        <input type="checkbox" className="accent-cyan-500 w-4 h-4" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
);

const formatCurrency = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '--';
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

export default PortfolioAllocationAgentControl;

