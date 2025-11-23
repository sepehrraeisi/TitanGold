import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    MarketIntelligenceConfig,
    MarketIntelligenceMetrics,
    MarketIntelligenceResult,
    MarketIntelligenceSignal,
    MarketOverview,
    MacroTrendSignal,
    FlowActivityData,
    OpportunityRiskAlert,
    EventImpactAnalysis,
    CorrelationMatrixEntry,
    HeatmapRanking,
} from '../../types.ts';

interface MarketIntelligenceAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const MarketIntelligenceAgentControl: React.FC<MarketIntelligenceAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    type MITab = 'market_landscape' | 'macro_trend' | 'flow_activity' | 'alerts' | 'event_impact' | 'correlation' | 'settings' | 'integration';
    const [activeTab, setActiveTab] = useState<MITab>('market_landscape');
    const [config, setConfig] = useState<MarketIntelligenceConfig | null>(agent.marketIntelligenceConfig || null);
    const [metrics, setMetrics] = useState<MarketIntelligenceMetrics | null>(agent.marketIntelligenceMetrics || null);
    const [analysis, setAnalysis] = useState<MarketIntelligenceResult | null>(agent.lastMarketIntelligenceResult || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchMarketIntelligenceAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastRun) setAnalysis(data.lastRun);
            } catch (error) {
                console.error('Failed to load market intelligence agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [agent.id]);

    const signals = useMemo<MarketIntelligenceSignal[]>(() => analysis?.signals ?? [], [analysis]);
    const marketOverview = useMemo(() => analysis?.marketOverview, [analysis?.marketOverview]);
    const macroTrendSignals = useMemo(() => analysis?.macroTrendSignals ?? [], [analysis?.macroTrendSignals]);
    const flowActivity = useMemo(() => analysis?.flowActivity ?? [], [analysis?.flowActivity]);
    const opportunityRiskAlerts = useMemo(() => analysis?.opportunityRiskAlerts ?? [], [analysis?.opportunityRiskAlerts]);
    const eventImpacts = useMemo(() => analysis?.eventImpacts ?? [], [analysis?.eventImpacts]);
    const correlationMatrix = useMemo(() => analysis?.correlationMatrix ?? [], [analysis?.correlationMatrix]);
    const heatmapRanking = useMemo(() => analysis?.heatmapRanking ?? [], [analysis?.heatmapRanking]);

    const handleRunCycle = async () => {
        setIsRunning(true);
        try {
            const result = await api.runMarketIntelligenceCycle(agent.id);
            setAnalysis(result);
            const updatedAgents = await api.fetchAIAgents();
            const updatedAgent = updatedAgents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.marketIntelligenceMetrics || null);
                setConfig(updatedAgent.marketIntelligenceConfig || null);
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run market intelligence cycle:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsRunning(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: MarketIntelligenceConfig) => {
        setIsLoading(true);
        try {
            await api.updateMarketIntelligenceConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated');
        } catch (error) {
            console.error('Failed to update market intelligence config:', error);
            alert(t('update_failed') || 'Update failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleControlCommand = async (command: string) => {
        setIsLoading(true);
        try {
            await api.sendAgentControlCommand(agent.id, command);
            const updatedAgents = await api.fetchAIAgents();
            const updatedAgent = updatedAgents.find(a => a.id === agent.id);
            if (updatedAgent) {
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run command:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-[#161B22] border-b border-gray-800 p-6 flex justify-between items-center z-10 gap-3 flex-wrap">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {agent.name} - {t('market_intel_agent') || 'Market Intelligence'}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            {t('market_intel_agent_desc') || 'Combines price, liquidity, news and on-chain data to deliver autonomous signals.'}
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={handleRunCycle}
                            disabled={isRunning || agent.status !== 'active'}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isRunning ? t('processing') || 'Processing…' : t('run_cycle') || 'Run cycle'}
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-900/50 border-b border-gray-800 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                agent.status === 'training' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-gray-400'
                            }`}>
                                {t(agent.status)}
                            </span>
                            <span className="text-sm text-gray-400">
                                {t('accuracy')}: <span className="text-white font-semibold">{agent.accuracy.toFixed(1)}%</span>
                            </span>
                            <span className="text-sm text-gray-400">
                                {t('decisions')}: <span className="text-white font-semibold">{agent.decisions.toLocaleString()}</span>
                            </span>
                        </div>
                        <div className="flex gap-2">
                            {agent.status === 'active' ? (
                                <button
                                    onClick={() => handleControlCommand('pause')}
                                    className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                                >
                                    {t('pause')}
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleControlCommand('start')}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                                >
                                    {t('start')}
                                </button>
                            )}
                            <button
                                onClick={() => handleControlCommand('restart')}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                            >
                                {t('restart')}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="border-b border-gray-800">
                    <nav className="flex flex-wrap gap-4 px-6">
                        {([
                            { id: 'market_landscape', key: 'tab_market_landscape' },
                            { id: 'macro_trend', key: 'tab_macro_trend' },
                            { id: 'flow_activity', key: 'tab_flow_activity' },
                            { id: 'alerts', key: 'tab_alerts' },
                            { id: 'event_impact', key: 'tab_event_impact' },
                            { id: 'correlation', key: 'tab_correlation' },
                            { id: 'settings', key: 'tab_settings' },
                            { id: 'integration', key: 'tab_integration' },
                        ] as const).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as MITab)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-purple-500 text-purple-400'
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                }`}
                            >
                                {t(tab.key) || tab.id.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'market_landscape' && marketOverview && (
                        <MarketLandscapeTab overview={marketOverview} analysis={analysis} t={t} />
                    )}
                    {activeTab === 'macro_trend' && <MacroTrendTab signals={macroTrendSignals} t={t} />}
                    {activeTab === 'flow_activity' && <FlowActivityTab data={flowActivity} t={t} />}
                    {activeTab === 'alerts' && <AlertsTab alerts={opportunityRiskAlerts} t={t} />}
                    {activeTab === 'event_impact' && <EventImpactTab events={eventImpacts} t={t} />}
                    {activeTab === 'correlation' && <CorrelationTab matrix={correlationMatrix} ranking={heatmapRanking} t={t} />}
                    {activeTab === 'settings' && config && (
                        <MarketIntelligenceSettings
                            config={config}
                            disabled={isLoading}
                            onUpdate={handleUpdateConfig}
                            t={t}
                        />
                    )}
                    {activeTab === 'integration' && config && <IntegrationTab config={config} t={t} />}
                    {!analysis && activeTab === 'market_landscape' && (
                        <div className="text-center text-gray-400 py-10">
                            <p>{t('no_market_intel_data') || 'No market intelligence cycles have been executed yet.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const MarketIntelligenceOverview: React.FC<{
    analysis: MarketIntelligenceResult;
    metrics: MarketIntelligenceMetrics | null;
    t: (key: string) => string;
}> = ({ analysis, metrics, t }) => {
    const summary = analysis.summary;
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard label={t('market_intel_roi') || 'Avg ROI'} value={`${summary.roiPercent.toFixed(2)}%`} />
                <MetricCard label={t('market_intel_net_profit') || 'Net Profit'} value={`$${summary.netProfitUsd.toLocaleString()}`} />
                <MetricCard label={t('market_intel_win_loss') || 'Win / Loss'} value={summary.winLossRatio.toFixed(2)} />
                <MetricCard label={t('max_drawdown') || 'Max Drawdown'} value={`${summary.maxDrawdownPercent.toFixed(1)}%`} />
                <MetricCard label={t('market_intel_accuracy') || 'Signal Accuracy'} value={`${summary.signalAccuracy.toFixed(1)}%`} />
                <MetricCard label={t('market_intel_latency') || 'Trade Latency'} value={`${summary.avgLatencyMs} ms`} />
                <MetricCard label={t('market_intel_risk_reward') || 'Risk/Reward'} value={summary.riskReward.toFixed(2)} />
                <MetricCard label={t('market_intel_prediction_success') || 'Prediction Success'} value={`${summary.predictionSuccess.toFixed(1)}%`} />
                <MetricCard label={t('market_intel_active_signals') || 'Active Signals'} value={metrics?.activeSignals ?? 0} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('market_intel_datasets') || 'Datasets'}</h3>
                    <div className="flex flex-wrap gap-2">
                        {analysis.datasetsUsed.map(dataset => (
                            <span key={dataset} className="text-xs bg-purple-500/10 border border-purple-500/30 text-purple-200 px-2 py-1 rounded-full">
                                {dataset}
                            </span>
                        ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">{t('market_intel_markets_scanned') || 'Markets scanned'}: {analysis.marketsScanned}</p>
                </div>
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('market_intel_risk_alerts') || 'Risk Alerts'}</h3>
                    {analysis.riskAlerts.length > 0 ? (
                        <ul className="text-xs text-gray-300 space-y-2 max-h-32 overflow-y-auto pr-2">
                            {analysis.riskAlerts.map(alert => (
                                <li key={alert} className="flex items-start gap-2">
                                    <span className="text-orange-400">•</span>
                                    <span>{alert}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-gray-500">{t('market_intel_alerts_none') || 'No alerts triggered during the last cycle.'}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const MarketIntelligenceSignals: React.FC<{ signals: MarketIntelligenceSignal[]; t: (key: string) => string }> = ({ signals, t }) => (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
        {signals.map(signal => (
            <div key={signal.id} className="p-4 bg-gray-900/40 border border-gray-800 rounded-lg space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <p className="text-white font-semibold">{signal.symbol} · {signal.timeframe.toUpperCase()}</p>
                        <p className="text-xs text-gray-400">{new Date(signal.issuedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            signal.direction === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                            {t(signal.direction) || signal.direction.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            signal.status === 'active' ? 'bg-purple-500/20 text-purple-300' :
                            signal.status === 'executed' ? 'bg-green-500/20 text-green-300' :
                            'bg-gray-600/30 text-gray-200'
                        }`}>
                            {t(signal.status) || signal.status}
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-300">
                    <p>{t('entry') || 'Entry'}: <span className="text-white font-semibold">{signal.entryPrice.toFixed(4)}</span></p>
                    <p>{t('stop_loss') || 'Stop Loss'}: {signal.stopLoss.toFixed(4)}</p>
                    <p>{t('take_profit') || 'Take Profit'}: {signal.takeProfit.toFixed(4)}</p>
                    <p>{t('confidence') || 'Confidence'}: {signal.confidence.toFixed(1)}%</p>
                    <p>{t('market_intel_risk_reward') || 'Risk/Reward'}: {signal.riskReward.toFixed(2)}</p>
                    <p>{t('market_intel_latency') || 'Latency'}: {signal.latencyMs} ms</p>
                    <p>{t('market_intel_prediction_success') || 'Pred. success'}: {signal.roi?.toFixed(2)}%</p>
                </div>
                {signal.reason && <p className="text-xs text-gray-400">{signal.reason}</p>}
                {signal.tags && signal.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {signal.tags.map(tag => (
                            <span key={`${signal.id}-${tag}`} className="text-[11px] bg-gray-800/80 text-gray-200 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        ))}
        {signals.length === 0 && (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_signals') || 'No signals available yet.'}</p>
            </div>
        )}
    </div>
);

const MarketIntelligenceAnalytics: React.FC<{
    analysis: MarketIntelligenceResult;
    metrics: MarketIntelligenceMetrics;
    t: (key: string) => string;
}> = ({ analysis, metrics, t }) => (
    <div className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('market_intel_timeframes') || 'Timeframe breakdown'}</h3>
                {analysis.analytics.timeframeBreakdown.length > 0 ? (
                    <div className="space-y-2 text-xs">
                        {analysis.analytics.timeframeBreakdown.map(item => (
                            <div key={item.timeframe} className="flex items-center justify-between">
                                <span className="text-gray-400">{item.timeframe.toUpperCase()}</span>
                                <span className="text-white font-semibold">{item.signals} · {item.accuracy.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">{t('no_data') || 'No analytics available.'}</p>
                )}
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('market_intel_benchmark') || 'Benchmark comparison'}</h3>
                <p className="text-xs text-gray-400">{t('market_intel_roi') || 'Avg ROI'}</p>
                <p className="text-white text-2xl font-bold">
                    {analysis.analytics.benchmarkComparison.agentRoi.toFixed(2)}%
                    <span className="text-sm text-gray-400 ml-2">
                        vs {analysis.analytics.benchmarkComparison.benchmarkRoi.toFixed(2)}% {t('benchmark') || 'benchmark'}
                    </span>
                </p>
                <p className="text-xs text-gray-400 mt-3">{t('market_intel_signals_week') || 'Signals this week'}: {metrics.periodPerformance.week.signals}</p>
                <p className="text-xs text-gray-400">{t('market_intel_signals_month') || 'Signals this month'}: {metrics.periodPerformance.month.signals}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('market_intel_correlation') || 'Correlation Heatmap'}</h3>
                <div className="space-y-2 text-xs text-gray-300 max-h-36 overflow-y-auto pr-1">
                    {analysis.analytics.correlationHeatmap.map(pair => (
                        <div key={pair.pair} className="flex justify-between border border-gray-800 rounded px-2 py-1">
                            <span>{pair.pair}</span>
                            <span className={pair.correlation >= 0 ? 'text-green-300' : 'text-red-300'}>
                                {pair.correlation.toFixed(2)}
                            </span>
                        </div>
                    ))}
                    {analysis.analytics.correlationHeatmap.length === 0 && (
                        <p className="text-gray-500">{t('no_data') || 'No correlation data available.'}</p>
                    )}
                </div>
            </div>
        </div>
    </div>
);

const MarketIntelligenceRisk: React.FC<{
    analysis: MarketIntelligenceResult;
    config: MarketIntelligenceConfig;
    t: (key: string) => string;
}> = ({ analysis, config, t }) => {
    const exposure = analysis.analytics.riskExposure;
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard label={t('market_intel_risk_status') || 'Risk Status'} value={`${exposure.exposurePercent.toFixed(1)}%`} />
                <MetricCard label={t('market_intel_capital_deployed') || 'Capital Deployed'} value={`${exposure.capitalDeployedPercent.toFixed(1)}%`} />
                <MetricCard label={t('market_intel_risk_alerts') || 'Alerts'} value={analysis.riskAlerts.length} />
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('market_intel_risk_controls') || 'Risk Controls'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-300">
                    <p>{t('market_intel_risk_mode') || 'Risk Mode'}: <span className="text-white font-semibold">{t(config.riskMode) || config.riskMode}</span></p>
                    <p>{t('market_intel_per_trade') || 'Per trade allocation'}: {config.capitalAllocation.perTradePercent}%</p>
                    <p>{t('market_intel_max_daily_loss') || 'Max daily loss'}: {config.capitalAllocation.maxDailyLossPercent}%</p>
                    <p>{t('max_drawdown') || 'Max drawdown'}: {config.capitalAllocation.maxDrawdownPercent}%</p>
                    <p>{t('market_intel_max_concurrent') || 'Max concurrent trades'}: {config.capitalAllocation.maxSimultaneousTrades}</p>
                </div>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('market_intel_risk_alerts') || 'Risk Alerts'}</h3>
                {exposure.alerts.length ? (
                    <ul className="text-xs text-gray-300 space-y-2">
                        {exposure.alerts.map(alert => (
                            <li key={alert} className="flex items-center gap-2">
                                <span className="text-orange-400">⚠</span>
                                <span>{alert}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-gray-500">{t('market_intel_alerts_none') || 'No current alerts.'}</p>
                )}
            </div>
        </div>
    );
};

const MarketIntelligenceSettings: React.FC<{
    config: MarketIntelligenceConfig;
    disabled: boolean;
    onUpdate: (config: MarketIntelligenceConfig) => Promise<void>;
    t: (key: string) => string;
}> = ({ config, disabled, onUpdate, t }) => {
    const [draft, setDraft] = useState<MarketIntelligenceConfig>(config);

    useEffect(() => setDraft(config), [config]);

    const updateField = <K extends keyof MarketIntelligenceConfig>(key: K, value: MarketIntelligenceConfig[K]) => {
        setDraft(prev => ({ ...prev, [key]: value }));
    };

    const updateNested = <K extends keyof MarketIntelligenceConfig, P extends keyof MarketIntelligenceConfig[K]>(
        key: K,
        prop: P,
        value: MarketIntelligenceConfig[K][P],
    ) => {
        setDraft(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] as Record<string, any>),
                [prop]: value,
            },
        }));
    };

    const handleSave = () => {
        onUpdate(draft);
    };

    return (
        <div className="space-y-5">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('tracked_symbols') || 'Tracked Symbols'}</h3>
                <textarea
                    rows={2}
                    disabled={disabled}
                    value={draft.symbols.join(', ')}
                    onChange={(e) => updateField('symbols', e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
                <label className="block text-xs text-gray-400 mb-1">{t('timeframes') || 'Timeframes'}</label>
                <input
                    type="text"
                    disabled={disabled}
                    value={draft.timeframes.join(', ')}
                    onChange={(e) => updateField('timeframes', e.target.value.split(',').map(s => s.trim()) as MarketIntelligenceConfig['timeframes'])}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
            </div>

            {draft.dataSources && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{t('data_sources') || 'Data Sources'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(['news', 'macroIndicators', 'blockTrades', 'capitalFlows', 'parallelMarkets', 'sentiment', 'premiumAPIs'] as const).map(key => (
                            <label key={key} className="flex items-center text-sm text-gray-300 gap-2">
                                <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={draft.dataSources?.[key] ?? false}
                                    onChange={(e) => updateField('dataSources', { ...draft.dataSources, [key]: e.target.checked })}
                                    className="w-4 h-4 accent-purple-500"
                                />
                                {t(key) || key}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {draft.targetMarkets && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{t('target_markets') || 'Target Markets'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {(['stock', 'crypto', 'forex', 'commodity'] as const).map(market => (
                            <label key={market} className="flex items-center text-sm text-gray-300 gap-2">
                                <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={draft.targetMarkets?.includes(market) ?? false}
                                    onChange={(e) => {
                                        const current = draft.targetMarkets || [];
                                        const updated = e.target.checked
                                            ? [...current, market]
                                            : current.filter(m => m !== market);
                                        updateField('targetMarkets', updated);
                                    }}
                                    className="w-4 h-4 accent-purple-500"
                                />
                                {t(market) || market}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {draft.alertSensitivity && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{t('alert_sensitivity') || 'Alert Sensitivity'}</h3>
                    <select
                        disabled={disabled}
                        value={draft.alertSensitivity}
                        onChange={(e) => updateField('alertSensitivity', e.target.value as 'low' | 'medium' | 'high')}
                        className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                    >
                        <option value="low">{t('low') || 'Low'}</option>
                        <option value="medium">{t('medium') || 'Medium'}</option>
                        <option value="high">{t('high') || 'High'}</option>
                    </select>
                </div>
            )}

            {draft.dataCombinationModel && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{t('data_combination_model') || 'Data Combination Model'}</h3>
                    <select
                        disabled={disabled}
                        value={draft.dataCombinationModel}
                        onChange={(e) => updateField('dataCombinationModel', e.target.value as 'traditional' | 'realtime' | 'ai_driven')}
                        className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                    >
                        <option value="traditional">{t('traditional') || 'Traditional'}</option>
                        <option value="realtime">{t('realtime') || 'Real-time'}</option>
                        <option value="ai_driven">{t('ai_driven') || 'AI-Driven'}</option>
                    </select>
                </div>
            )}

            {draft.updateRate && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{t('update_rate') || 'Update Rate'}</h3>
                    <select
                        disabled={disabled}
                        value={draft.updateRate}
                        onChange={(e) => updateField('updateRate', e.target.value as 'realtime' | 'batch')}
                        className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                    >
                        <option value="realtime">{t('realtime') || 'Real-time'}</option>
                        <option value="batch">{t('batch') || 'Batch'}</option>
                    </select>
                </div>
            )}

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('market_intel_position_sizing') || 'Position Sizing'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberInput
                        label={t('market_intel_per_trade') || 'Per trade (%)'}
                        value={draft.capitalAllocation.perTradePercent}
                        disabled={disabled}
                        onChange={(value) => updateNested('capitalAllocation', 'perTradePercent', value)}
                        step={0.1}
                    />
                    <NumberInput
                        label={t('market_intel_max_daily_loss') || 'Max daily loss (%)'}
                        value={draft.capitalAllocation.maxDailyLossPercent}
                        disabled={disabled}
                        onChange={(value) => updateNested('capitalAllocation', 'maxDailyLossPercent', value)}
                        step={0.1}
                    />
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('market_intel_filters') || 'Filters'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberInput
                        label={t('market_intel_min_volume') || 'Min volume (USD)'}
                        value={draft.filters.minVolumeUsd}
                        disabled={disabled}
                        onChange={(value) => updateNested('filters', 'minVolumeUsd', value)}
                        step={100000}
                    />
                    <NumberInput
                        label={t('market_intel_min_liquidity') || 'Min liquidity score'}
                        value={draft.filters.minLiquidityScore}
                        disabled={disabled}
                        onChange={(value) => updateNested('filters', 'minLiquidityScore', value)}
                        step={1}
                    />
                    <NumberInput
                        label={t('market_intel_volatility_filter') || 'Volatility threshold'}
                        value={draft.filters.volatilityThreshold}
                        disabled={disabled}
                        onChange={(value) => updateNested('filters', 'volatilityThreshold', value)}
                        step={0.1}
                    />
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-gray-300">
                    {[
                        { key: 'combineTechnical', label: t('technical') || 'Technical' },
                        { key: 'combineFundamental', label: t('fundamental') || 'Fundamental' },
                        { key: 'combineSentiment', label: t('sentiment') || 'Sentiment' },
                    ].map(option => (
                        <label key={option.key} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={(draft.strategy as any)[option.key]}
                                onChange={(e) => updateNested('strategy', option.key as keyof MarketIntelligenceConfig['strategy'], e.target.checked as never)}
                                className="accent-purple-500"
                            />
                            <span>{option.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('market_intel_automation') || 'Automation'}</h3>
                <div className="flex flex-wrap gap-4 text-xs text-gray-300">
                    {[
                        { key: 'autoExecute', label: t('auto_execute') || 'Auto execute' },
                        { key: 'sendToArtemis', label: 'Send to Artemis' },
                        { key: 'syncWithRiskAgent', label: t('sync_with_risk_agent') || 'Sync with Risk Agent' },
                        { key: 'notifyOnSignal', label: t('notify_on_signal') || 'Notify on signal' },
                        { key: 'notifyOnDegradation', label: t('notify_on_degradation') || 'Notify on degradation' },
                    ].map(option => (
                        <label key={option.key} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={(draft.automation as any)[option.key]}
                                onChange={(e) => updateNested('automation', option.key as keyof MarketIntelligenceConfig['automation'], e.target.checked as never)}
                                className="accent-purple-500"
                            />
                            <span>{option.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={disabled}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
                >
                    {t('save') || 'Save'}
                </button>
            </div>
        </div>
    );
};

const NumberInput: React.FC<{
    label: string;
    value: number;
    disabled: boolean;
    onChange: (value: number) => void;
    step?: number;
}> = ({ label, value, disabled, onChange, step }) => (
    <div>
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        <input
            type="number"
            step={step ?? 1}
            disabled={disabled}
            value={value}
            onChange={(e) => {
                const parsed = e.target.value === '' ? 0 : parseFloat(e.target.value);
                onChange(Number.isNaN(parsed) ? 0 : parsed);
            }}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-xs"
        />
    </div>
);

const MetricCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
    </div>
);

const MarketLandscapeTab: React.FC<{ overview: MarketOverview; analysis: MarketIntelligenceResult | null; t: (key: string) => string }> = ({ overview, analysis, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label={t('market_status') || 'Market Status'} value={t(overview.overallStatus) || overview.overallStatus} />
            <MetricCard label={t('market_score') || 'Market Score'} value={overview.marketScore.toFixed(1)} />
            <MetricCard label={t('opportunities') || 'Opportunities'} value={overview.opportunities} />
            <MetricCard label={t('risks') || 'Risks'} value={overview.risks} />
        </div>
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('key_indicators') || 'Key Indicators'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {overview.keyIndicators.map((indicator, index) => (
                    <div key={index} className="border border-gray-800 rounded-xl p-4 bg-gray-900/60">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-gray-400">{indicator.name}</p>
                            <span className={`px-2 py-1 rounded text-xs ${
                                indicator.status === 'positive' ? 'bg-green-500/20 text-green-400' :
                                indicator.status === 'negative' ? 'bg-red-500/20 text-red-400' :
                                'bg-gray-500/20 text-gray-400'
                            }`}>
                                {t(indicator.status) || indicator.status}
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-white">{indicator.value.toFixed(2)}</p>
                    </div>
                ))}
            </div>
        </div>
        {analysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard label={t('roi_percent') || 'ROI'} value={`${analysis.summary.roiPercent.toFixed(2)}%`} />
                <MetricCard label={t('win_rate') || 'Win Rate'} value={`${analysis.summary.signalAccuracy.toFixed(1)}%`} />
                <MetricCard label={t('risk_reward') || 'Risk/Reward'} value={analysis.summary.riskReward.toFixed(2)} />
            </div>
        )}
    </div>
);

const MacroTrendTab: React.FC<{ signals: MacroTrendSignal[]; t: (key: string) => string }> = ({ signals, t }) => (
    <div className="space-y-4">
        {signals.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {signals.map(signal => (
                    <div key={signal.id} className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-white font-semibold">{signal.market}</h3>
                                <p className="text-xs text-gray-500">{signal.timeframe}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                    signal.trend === 'bullish' ? 'bg-green-500/20 text-green-400' :
                                    signal.trend === 'bearish' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {t(signal.trend) || signal.trend}
                                </span>
                                <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400">
                                    {signal.strength.toFixed(0)}
                                </span>
                            </div>
                        </div>
                        {signal.description && <p className="text-sm text-gray-300 mb-2">{signal.description}</p>}
                        {signal.relatedMarkets.length > 0 && (
                            <div className="text-xs text-gray-500">
                                {t('related_markets') || 'Related Markets'}: {signal.relatedMarkets.join(', ')}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_macro_trends') || 'No macro trend signals available.'}</p>
            </div>
        )}
    </div>
);

const FlowActivityTab: React.FC<{ data: FlowActivityData[]; t: (key: string) => string }> = ({ data, t }) => (
    <div className="space-y-4">
        {data.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {data.map(flow => (
                    <div key={flow.symbol} className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                        <h3 className="text-lg font-semibold text-white mb-4">{flow.symbol}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-gray-500">{t('capital_inflow') || 'Capital Inflow'}</p>
                                <p className="text-white font-semibold">${(flow.capitalInflow / 1000).toFixed(2)}K</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('capital_outflow') || 'Capital Outflow'}</p>
                                <p className="text-white font-semibold">${(flow.capitalOutflow / 1000).toFixed(2)}K</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('net_flow') || 'Net Flow'}</p>
                                <p className={`font-semibold ${flow.netFlow > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ${(flow.netFlow / 1000).toFixed(2)}K
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('whale_transactions') || 'Whale Transactions'}</p>
                                <p className="text-white font-semibold">{flow.whaleTransactions.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('institutional_activity') || 'Institutional Activity'}</p>
                                <p className="text-white font-semibold">{flow.institutionalActivity.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('block_trades') || 'Block Trades'}</p>
                                <p className="text-white font-semibold">{flow.blockTrades.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_flow_data') || 'No flow & activity data available.'}</p>
            </div>
        )}
    </div>
);

const AlertsTab: React.FC<{ alerts: OpportunityRiskAlert[]; t: (key: string) => string }> = ({ alerts, t }) => (
    <div className="space-y-4">
        {alerts.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {alerts.map(alert => (
                    <div key={alert.id} className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    alert.type === 'opportunity' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                                    'bg-red-500/20 text-red-400 border border-red-500/40'
                                }`}>
                                    {t(alert.type) || alert.type}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                    alert.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                    alert.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-blue-500/20 text-blue-400'
                                }`}>
                                    {t(alert.severity) || alert.severity}
                                </span>
                                <span className="text-xs text-gray-500">{t(alert.category) || alert.category}</span>
                            </div>
                            <span className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleString()}</span>
                        </div>
                        <h3 className="text-white font-semibold mb-2">{alert.title}</h3>
                        <p className="text-sm text-gray-300 mb-2">{alert.description}</p>
                        {alert.affectedMarkets.length > 0 && (
                            <p className="text-xs text-gray-500">{t('affected_markets') || 'Affected Markets'}: {alert.affectedMarkets.join(', ')}</p>
                        )}
                        {alert.action && (
                            <div className="mt-3">
                                <button className="px-3 py-1 rounded text-xs bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30">
                                    {alert.action}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_alerts') || 'No opportunity/risk alerts available.'}</p>
            </div>
        )}
    </div>
);

const EventImpactTab: React.FC<{ events: EventImpactAnalysis[]; t: (key: string) => string }> = ({ events, t }) => (
    <div className="space-y-4">
        {events.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {events.map(event => (
                    <div key={event.id} className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-white font-semibold">{event.title}</h3>
                                <p className="text-xs text-gray-500">{new Date(event.date).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                    event.impactDirection === 'positive' ? 'bg-green-500/20 text-green-400' :
                                    event.impactDirection === 'negative' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {t(event.impactDirection) || event.impactDirection}
                                </span>
                                <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400">
                                    {event.impactScore.toFixed(1)}
                                </span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-300 mb-3">{event.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                                <p className="text-gray-500">{t('event_type') || 'Type'}</p>
                                <p className="text-white">{t(event.eventType) || event.eventType}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">{t('impact_score') || 'Impact Score'}</p>
                                <p className="text-white">{event.impactScore.toFixed(1)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">{t('estimated_duration') || 'Duration'}</p>
                                <p className="text-white">{event.estimatedDuration}</p>
                            </div>
                        </div>
                        {event.affectedMarkets.length > 0 && (
                            <p className="text-xs text-gray-500 mt-3">{t('affected_markets') || 'Affected Markets'}: {event.affectedMarkets.join(', ')}</p>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_events') || 'No event impact analysis available.'}</p>
            </div>
        )}
    </div>
);

const CorrelationTab: React.FC<{ matrix: CorrelationMatrixEntry[]; ranking: HeatmapRanking[]; t: (key: string) => string }> = ({ matrix, ranking, t }) => (
    <div className="space-y-6">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('correlation_matrix') || 'Correlation Matrix'}</h3>
            {matrix.length ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {matrix.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded-md px-3 py-2">
                            <span className="text-sm text-white">{entry.asset1} - {entry.asset2}</span>
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                    Math.abs(entry.correlation) > 0.7 ? 'bg-red-500/20 text-red-400' :
                                    Math.abs(entry.correlation) > 0.4 ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-green-500/20 text-green-400'
                                }`}>
                                    {entry.correlation.toFixed(3)}
                                </span>
                                <span className="text-xs text-gray-500">{t(entry.significance) || entry.significance}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-400 text-center py-5">{t('no_correlation_data') || 'No correlation data available.'}</p>
            )}
        </div>
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('heatmap_ranking') || 'Heatmap Ranking'}</h3>
            {ranking.length ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {ranking.map((item, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded-md px-3 py-2">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">#{item.rank}</span>
                                <span className="text-sm text-white font-semibold">{item.asset}</span>
                                <span className="text-xs text-gray-500">{item.category}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-white">{item.score.toFixed(1)}</span>
                                <span className={`text-xs ${item.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-400 text-center py-5">{t('no_ranking_data') || 'No ranking data available.'}</p>
            )}
        </div>
    </div>
);

const IntegrationTab: React.FC<{ config: MarketIntelligenceConfig; t: (key: string) => string }> = ({ config, t }) => {
    const integrations = config.integrationSettings ?? {
        shareWithArtemis: true,
        syncWithTechnical: true,
        syncWithFundamental: true,
        syncWithSentiment: true,
        syncWithPortfolio: true,
        syncWithRisk: true,
        forwardToDashboard: true,
    };
    const channels = config.alertChannels ?? { dashboard: true, email: false, messenger: false };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('integration_settings') || 'Integration Settings'}</h3>
                <div className="space-y-3">
                    <IntegrationRow label={t('share_with_artemis') || 'Share with Artemis'} enabled={integrations.shareWithArtemis} />
                    <IntegrationRow label={t('sync_with_technical') || 'Sync with Technical'} enabled={integrations.syncWithTechnical} />
                    <IntegrationRow label={t('sync_with_fundamental') || 'Sync with Fundamental'} enabled={integrations.syncWithFundamental} />
                    <IntegrationRow label={t('sync_with_sentiment') || 'Sync with Sentiment'} enabled={integrations.syncWithSentiment} />
                    <IntegrationRow label={t('sync_with_portfolio') || 'Sync with Portfolio'} enabled={integrations.syncWithPortfolio} />
                    <IntegrationRow label={t('sync_with_risk') || 'Sync with Risk'} enabled={integrations.syncWithRisk} />
                    <IntegrationRow label={t('forward_to_dashboard') || 'Forward to Dashboard'} enabled={integrations.forwardToDashboard} />
                </div>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('alert_channels') || 'Alert Channels'}</h3>
                <div className="space-y-3">
                    <IntegrationRow label={t('dashboard') || 'Dashboard'} enabled={channels.dashboard} />
                    <IntegrationRow label={t('email') || 'Email'} enabled={channels.email} />
                    <IntegrationRow label={t('messenger') || 'Messenger'} enabled={channels.messenger} />
                </div>
            </div>
        </div>
    );
};

const IntegrationRow: React.FC<{ label: string; enabled?: boolean }> = ({ label, enabled }) => (
    <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <span className="text-sm text-white">{label}</span>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            enabled ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
            'bg-gray-700/40 text-gray-300 border border-gray-600/60'
        }`}>
            {enabled ? 'ON' : 'OFF'}
        </span>
    </div>
);

export default MarketIntelligenceAgentControl;

