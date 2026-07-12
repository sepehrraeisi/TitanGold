import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    LiquidityAlertDetail,
    LiquidityAnalysisConfig,
    LiquidityAnalysisMetrics,
    LiquidityAnalysisResult,
    LiquidityCapitalFlowEntry,
    LiquidityHeatmapEntry,
    LiquiditySlippageEstimate,
    LiquiditySnapshot,
} from '../../types.ts';

type LiquidityTab =
    | 'overview'
    | 'map'
    | 'orderbook'
    | 'slippage'
    | 'flows'
    | 'alerts'
    | 'settings'
    | 'integration';

const TAB_ITEMS: Array<{ id: LiquidityTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'map', labelKey: 'tab_liquidity_map' },
    { id: 'orderbook', labelKey: 'tab_order_book' },
    { id: 'slippage', labelKey: 'tab_slippage_risk' },
    { id: 'flows', labelKey: 'tab_capital_flow' },
    { id: 'alerts', labelKey: 'tab_alerts' },
    { id: 'settings', labelKey: 'tab_settings' },
    { id: 'integration', labelKey: 'tab_integration' },
];

interface LiquidityAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const LiquidityAgentControl: React.FC<LiquidityAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const { guardExecution } = useAgentExecutionGate();
    const [activeTab, setActiveTab] = useState<LiquidityTab>('overview');
    const [config, setConfig] = useState<LiquidityAnalysisConfig | null>(agent.liquidityAnalysisConfig || null);
    const [metrics, setMetrics] = useState<LiquidityAnalysisMetrics | null>(agent.liquidityMetrics || null);
    const [analysis, setAnalysis] = useState<LiquidityAnalysisResult | null>(agent.lastLiquidityAnalysis || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchLiquidityAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastAnalysis) setAnalysis(data.lastAnalysis);
            } catch (error) {
                console.error('Failed to load liquidity agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [agent.id]);

    const handleRunAnalysis = async () => {
        if (!guardExecution()) return;
        setIsAnalyzing(true);
        try {
            const result = await api.runLiquidityAnalysis(agent.id);
            setAnalysis(result);
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.liquidityMetrics || null);
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run liquidity analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: LiquidityAnalysisConfig) => {
        setIsLoading(true);
        try {
            // 1. Save to backend
            await api.updateLiquidityAnalysisConfig(agent.id, updatedConfig);
            
            // 2. 🆕 Refetch from backend (Golden Rule: Single Source of Truth)
            const freshData = await api.fetchLiquidityAgentData(agent.id);
            
            // 3. Update local state with fresh data
            if (freshData.config) setConfig(freshData.config);
            if (freshData.metrics) setMetrics(freshData.metrics);
            if (freshData.lastAnalysis) setAnalysis(freshData.lastAnalysis);
            
            // 4. Show success
            alert(t('config_updated') || 'Configuration updated');
        } catch (error) {
            console.error('Failed to update liquidity config:', error);
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

    const liquidityMap = useMemo<LiquidityHeatmapEntry[]>(() => analysis?.liquidityMap ?? [], [analysis?.liquidityMap]);
    const slippageRisks = useMemo<LiquiditySlippageEstimate[]>(() => analysis?.slippageRisks ?? [], [analysis?.slippageRisks]);
    const capitalFlows = useMemo<LiquidityCapitalFlowEntry[]>(() => analysis?.capitalFlows ?? [], [analysis?.capitalFlows]);
    const alerts = useMemo<LiquidityAlertDetail[]>(() => analysis?.alerts ?? [], [analysis?.alerts]);
    const snapshots = useMemo<LiquiditySnapshot[]>(() => analysis?.snapshots ?? [], [analysis?.snapshots]);
    const history = useMemo(() => metrics?.history ?? [], [metrics?.history]);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#10141A] border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden">
                <Header agent={agent} t={t} onClose={onClose} onRunAnalysis={handleRunAnalysis} isAnalyzing={isAnalyzing} />
                <StatusBar agent={agent} analysis={analysis} metrics={metrics} onCommand={handleControlCommand} t={t} />

                <nav className="flex flex-wrap gap-4 px-6 border-b border-gray-800 bg-[#0B1017]">
                    {TAB_ITEMS.map(tab => {
                        const translation = t(tab.labelKey);
                        const label = (translation && translation !== tab.labelKey) 
                            ? translation 
                            : tab.labelKey.replace('tab_', '').replace(/_/g, ' ');
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-cyan-500 text-cyan-300'
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-6 bg-[#0F151D] overflow-y-auto" style={{ maxHeight: 'calc(92vh - 200px)' }}>
                    {activeTab === 'overview' && analysis && metrics && (
                        <OverviewTab agent={agent} analysis={analysis} metrics={metrics} history={history} liquidityMap={liquidityMap} t={t} />
                    )}
                    {activeTab === 'map' && <LiquidityMapTab liquidityMap={liquidityMap} t={t} />}
                    {activeTab === 'orderbook' && <OrderBookTab snapshots={snapshots} t={t} />}
                    {activeTab === 'slippage' && <SlippageTab slippageRisks={slippageRisks} t={t} />}
                    {activeTab === 'flows' && <CapitalFlowTab capitalFlows={capitalFlows} t={t} />}
                    {activeTab === 'alerts' && <AlertsTab alerts={alerts} t={t} />}
                    {activeTab === 'settings' && config && (
                        <SettingsTab config={config} disabled={isLoading} onUpdate={handleUpdateConfig} t={t} />
                    )}
                    {activeTab === 'integration' && config && <IntegrationTab config={config} t={t} />}

                    {!analysis && activeTab === 'overview' && (
                        <EmptyState message={t('no_liquidity_data') || 'No liquidity scans have been executed yet.'} />
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
            <p className="text-xs uppercase tracking-widest text-gray-500">{t('liquidity_agent') || 'Liquidity Analysis Agent'}</p>
            <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{agent.role}</p>
        </div>
        <div className="flex gap-3">
            <button
                onClick={onRunAnalysis}
                disabled={isAnalyzing || agent.status !== 'active'}
                className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {isAnalyzing ? t('scanning') || 'Scanning...' : t('run_analysis')}
            </button>
            <button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {t('close')}
            </button>
        </div>
    </div>
);

const StatusBar: React.FC<{
    agent: AIAgent;
    analysis: LiquidityAnalysisResult | null;
    metrics: LiquidityAnalysisMetrics | null;
    onCommand: (command: string) => void;
    t: (key: string) => string;
}> = ({ agent, analysis, metrics, onCommand, t }) => (
    <div className="px-6 py-3 border-b border-gray-800 bg-[#0B1017]">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
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
                <span className="text-sm text-gray-400">
                    {t('accuracy')}: <span className="text-white font-semibold">{agent.accuracy.toFixed(1)}%</span>
                </span>
                {analysis && (
                    <span className="text-sm text-gray-400">
                        {t('liquidity_ratio') || 'Liquidity ratio'}:{' '}
                        <span className="text-white font-semibold ml-1">{analysis.liquidityRatio?.toFixed(2) ?? '--'}</span>
                    </span>
                )}
                {metrics && (
                    <span className="text-sm text-gray-400">
                        {t('total_scans') || 'Scans'}: <span className="text-white font-semibold ml-1">{metrics.totalAnalyses}</span>
                    </span>
                )}
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

const OverviewTab: React.FC<{
    agent: AIAgent;
    analysis: LiquidityAnalysisResult;
    metrics: LiquidityAnalysisMetrics;
    history: LiquidityAnalysisMetrics['history'];
    liquidityMap: LiquidityHeatmapEntry[];
    t: (key: string) => string;
}> = ({ agent, analysis, metrics, history, liquidityMap, t }) => {
    const statCards = [
        {
            label: t('liquidity_ratio') || 'Liquidity ratio',
            value: analysis.liquidityRatio?.toFixed(2) ?? '--',
            helper: t('average_depth') || 'Avg depth vs target',
        },
        {
            label: t('market_impact_score') || 'Market impact',
            value: `${analysis.marketImpactScore ?? 0}%`,
            helper: t('slippage_risk') || 'Slippage risk score',
        },
        {
            label: t('capital_flow_score') || 'Capital flow',
            value: `${analysis.capitalFlowScore ?? 0}%`,
            helper: t('net_flow_indicator') || 'Net inflow/outflow strength',
        },
        {
            label: t('alerts_triggered') || 'Alerts',
            value: analysis.alerts?.length ?? analysis.alertsTriggered.length,
            helper: t('last_scan') || 'Last scan',
        },
    ];

    const topEntries = liquidityMap.slice(0, 4);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {statCards.map(card => (
                    <SectionCard key={card.label} title={card.label}>
                        <p className="text-3xl font-semibold text-white">{card.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{card.helper}</p>
                    </SectionCard>
                ))}
            </div>

            <SectionCard title={t('top_liquid_markets') || 'Top liquid markets'}>
                {topEntries.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {topEntries.map(entry => (
                            <div key={entry.symbol} className="flex items-center justify-between border border-gray-800 rounded-xl p-4 bg-gray-900/50">
                                <div>
                                    <p className="text-white font-semibold">{entry.symbol}</p>
                                    <p className="text-xs text-gray-500">{entry.market}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl text-white font-semibold">{entry.liquidityScore}</p>
                                    <p className="text-xs text-gray-500">{t('volume_24h') || '24h vol'} ${entry.volume24hUSD.toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState message={t('no_liquidity_map') || 'No liquidity comparison data available.'} />
                )}
            </SectionCard>

            <SectionCard title={t('liquidity_history') || 'Liquidity history'}>
                {history && history.length ? (
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-2">
                        {history.slice(-12).reverse().map(entry => (
                            <div key={entry.timestamp} className="flex items-center justify-between text-sm text-gray-300 border border-gray-800 rounded-lg px-4 py-2">
                                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                                <span>
                                    {t('liquidity_ratio') || 'Ratio'}: {entry.liquidityRatio.toFixed(2)}
                                </span>
                                <span>
                                    {t('average_spread') || 'Spread'}: {entry.avgSpread.toFixed(2)} bps
                                </span>
                                <span>
                                    {t('net_flow') || 'Net flow'}: {entry.netFlowUSD.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState message={t('no_history') || 'No history tracked yet.'} />
                )}
            </SectionCard>

            {/* Agent Capabilities */}
            <CapabilitiesSection agent={agent} />
        </div>
    );
};

const LiquidityMapTab: React.FC<{ liquidityMap: LiquidityHeatmapEntry[]; t: (key: string) => string }> = ({ liquidityMap, t }) => (
    <SectionCard title={t('liquidity_map') || 'Liquidity map'}>
        {liquidityMap.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liquidityMap.map(entry => (
                    <div key={entry.symbol} className="border border-gray-800 rounded-2xl p-5 bg-gray-900/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-semibold text-lg">{entry.symbol}</p>
                                <p className="text-xs text-gray-500">{entry.market}</p>
                            </div>
                            <InfoBadge
                                label={entry.status.toUpperCase()}
                                tone={entry.status === 'high' ? 'success' : entry.status === 'low' ? 'danger' : 'warning'}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                            <div>
                                <p className="text-xs text-gray-500">{t('liquidity_score') || 'Score'}</p>
                                <p className="text-white text-xl font-semibold">{entry.liquidityScore}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('spread_bps') || 'Spread (bps)'}</p>
                                <p className="text-white text-xl font-semibold">{entry.spreadBps.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('depth_usd') || 'Depth (USD)'}</p>
                                <p className="text-white font-semibold">${entry.depthUSD.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('volume_24h') || '24h Vol'}</p>
                                <p className="text-white font-semibold">${entry.volume24hUSD.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_liquidity_map') || 'No liquidity comparison data available.'} />
        )}
    </SectionCard>
);

const OrderBookTab: React.FC<{ snapshots: LiquiditySnapshot[]; t: (key: string) => string }> = ({ snapshots, t }) => (
    <SectionCard title={t('order_book_depth') || 'Order book depth'}>
        {snapshots.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {snapshots.map(snapshot => (
                    <div
                        key={snapshot.symbol}
                        className={`p-4 border rounded-xl ${snapshot.severe ? 'border-red-700 bg-red-900/20' : 'border-gray-800 bg-gray-900/40'}`}
                    >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <p className="text-white font-semibold">{snapshot.symbol}</p>
                                <p className="text-xs text-gray-400">
                                    {t('bid_ask') || 'Bid / Ask'}: ${snapshot.bestBid.toFixed(2)} / ${snapshot.bestAsk.toFixed(2)}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-6 text-sm">
                                <MetricBlock label={t('spread_bps') || 'Spread (bps)'} value={snapshot.spreadBps.toFixed(2)} />
                                <MetricBlock label={t('depth_usd') || 'Depth (USD)'} value={`$${snapshot.totalDepthUSD.toLocaleString()}`} />
                                <MetricBlock label={t('imbalance') || 'Imbalance'} value={`${(snapshot.imbalance * 100).toFixed(1)}%`} />
                                <MetricBlock label={t('slippage_usd') || 'Slippage (USD)'} value={`$${snapshot.slippageUSD.toLocaleString()}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_depth_data') || 'No order book data captured.'} />
        )}
    </SectionCard>
);

const MetricBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-white font-semibold">{value}</p>
    </div>
);

const SlippageTab: React.FC<{ slippageRisks: LiquiditySlippageEstimate[]; t: (key: string) => string }> = ({ slippageRisks, t }) => (
    <SectionCard title={t('slippage_risk') || 'Slippage risk'}>
        {slippageRisks.length ? (
            <div className="space-y-3">
                {slippageRisks.map(risk => (
                    <div key={risk.symbol} className="flex items-center justify-between border border-gray-800 rounded-xl p-4 bg-gray-900/50">
                        <div>
                            <p className="text-white font-semibold">{risk.symbol}</p>
                            <p className="text-xs text-gray-500">{t('order_size') || 'Order size'}: ${risk.orderSizeUSD.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <InfoBadge
                                label={`${risk.expectedSlippageBps.toFixed(1)} bps`}
                                tone={risk.riskLevel === 'high' ? 'danger' : risk.riskLevel === 'medium' ? 'warning' : 'success'}
                            />
                            <p className="text-sm text-gray-300">${risk.slippageUSD.toLocaleString()} {t('slippage_usd') || 'slippage'}</p>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_slippage_data') || 'No slippage data available.'} />
        )}
    </SectionCard>
);

const CapitalFlowTab: React.FC<{ capitalFlows: LiquidityCapitalFlowEntry[]; t: (key: string) => string }> = ({ capitalFlows, t }) => {
    const totals = capitalFlows.reduce(
        (acc, flow) => {
            if (flow.netFlowUSD >= 0) acc.inflow += flow.netFlowUSD;
            else acc.outflow += Math.abs(flow.netFlowUSD);
            return acc;
        },
        { inflow: 0, outflow: 0 },
    );

    return (
        <SectionCard title={t('capital_flow') || 'Capital flow'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <MetricCard label={t('total_inflow') || 'Total inflow'} value={`$${totals.inflow.toLocaleString()}`} />
                <MetricCard label={t('total_outflow') || 'Total outflow'} value={`$${totals.outflow.toLocaleString()}`} />
            </div>
            {capitalFlows.length ? (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                    {capitalFlows.map(flow => (
                        <div key={flow.symbol} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40 flex items-center justify-between">
                            <div>
                                <p className="text-white font-semibold">{flow.symbol}</p>
                                <p className="text-xs text-gray-500">
                                    {t('direction') || 'Direction'}: {t(flow.direction)}
                                </p>
                            </div>
                            <div className="text-right text-sm text-gray-300">
                                <p>
                                    {t('net_flow') || 'Net flow'}: ${flow.netFlowUSD.toLocaleString()}
                                </p>
                                <p>
                                    {t('inflow') || 'Inflow'}: ${flow.inflowUSD.toLocaleString()}
                                </p>
                                <p>
                                    {t('outflow') || 'Outflow'}: ${flow.outflowUSD.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState message={t('no_capital_flow') || 'No capital flow data available.'} />
            )}
        </SectionCard>
    );
};

const AlertsTab: React.FC<{ alerts: LiquidityAlertDetail[]; t: (key: string) => string }> = ({ alerts, t }) => (
    <SectionCard title={t('alerts') || 'Alerts'}>
        {alerts.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {alerts.map(alert => (
                    <div key={`${alert.symbol}-${alert.timestamp}-${alert.type}`} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-white font-semibold">{alert.symbol}</p>
                            <InfoBadge
                                label={t(alert.type) || alert.type}
                                tone={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}
                            />
                        </div>
                        <p className="text-sm text-gray-300">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_alerts') || 'No alerts generated yet.'} />
        )}
    </SectionCard>
);

const SettingsTab: React.FC<{
    config: LiquidityAnalysisConfig;
    onUpdate: (config: LiquidityAnalysisConfig) => void;
    disabled: boolean;
    t: (key: string) => string;
}> = ({ config, onUpdate, disabled, t }) => {
    const [draft, setDraft] = useState(config);

    useEffect(() => setDraft(config), [config]);

    const parseList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

    const updateMonitoring = (field: keyof LiquidityAnalysisConfig['monitoring'], value: number) => {
        setDraft(prev => ({
            ...prev,
            monitoring: {
                ...prev.monitoring,
                [field]: value,
            },
        }));
    };

    const updateFilters = <K extends keyof NonNullable<LiquidityAnalysisConfig['filters']>>(field: K, value: NonNullable<LiquidityAnalysisConfig['filters']>[K]) => {
        setDraft(prev => ({
            ...prev,
            filters: {
                targetMarkets: prev.filters?.targetMarkets || ['spot'],
                preferredExchanges: prev.filters?.preferredExchanges || ['MEXC'],
                enforceDepthCheck: prev.filters?.enforceDepthCheck ?? true,
                enforceSpreadCheck: prev.filters?.enforceSpreadCheck ?? true,
                requireMultipleMarkets: prev.filters?.requireMultipleMarkets ?? true,
                [field]: value,
            },
        }));
    };

    const updateSlippageControls = <K extends keyof NonNullable<LiquidityAnalysisConfig['slippageControls']>>(field: K, value: NonNullable<LiquidityAnalysisConfig['slippageControls']>[K]) => {
        setDraft(prev => ({
            ...prev,
            slippageControls: {
                maxSlippageBps: prev.slippageControls?.maxSlippageBps ?? 15,
                targetOrderSizeUSD: prev.slippageControls?.targetOrderSizeUSD ?? 10000,
                alertOnImpactScore: prev.slippageControls?.alertOnImpactScore ?? true,
                [field]: value,
            },
        }));
    };

    const updateCapitalFlow = <K extends keyof NonNullable<LiquidityAnalysisConfig['capitalFlow']>>(field: K, value: NonNullable<LiquidityAnalysisConfig['capitalFlow']>[K]) => {
        setDraft(prev => ({
            ...prev,
            capitalFlow: {
                enabled: prev.capitalFlow?.enabled ?? true,
                lookbackHours: prev.capitalFlow?.lookbackHours ?? 6,
                minFlowUSD: prev.capitalFlow?.minFlowUSD ?? 1000000,
                includeStablecoins: prev.capitalFlow?.includeStablecoins ?? true,
                [field]: value,
            },
        }));
    };

    const updateSchedule = <K extends keyof NonNullable<LiquidityAnalysisConfig['schedule']>>(field: K, value: NonNullable<LiquidityAnalysisConfig['schedule']>[K]) => {
        setDraft(prev => ({
            ...prev,
            schedule: {
                mode: prev.schedule?.mode ?? 'real_time',
                frequencyMinutes: prev.schedule?.frequencyMinutes ?? 5,
                analysisWindow: prev.schedule?.analysisWindow ?? '5m',
                [field]: value,
            },
        }));
    };

    const updateAlerts = <K extends keyof LiquidityAnalysisConfig['alerts']>(field: K, value: LiquidityAnalysisConfig['alerts'][K]) => {
        setDraft(prev => ({
            ...prev,
            alerts: {
                ...prev.alerts,
                [field]: value,
            },
        }));
    };

    const handleSave = () => onUpdate(draft);

    return (
        <div className="space-y-6">
            <SectionCard title={t('monitored_pairs') || 'Monitored pairs'}>
                <Field
                    label={t('symbols_watchlist') || 'Symbols'}
                    type="textarea"
                    value={draft.symbols.join(', ')}
                    onChange={value => setDraft(prev => ({ ...prev, symbols: parseList(value).map(s => s.toUpperCase()) }))}
                />
            </SectionCard>

            <SectionCard title={t('monitoring_thresholds') || 'Monitoring thresholds'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field
                        label={t('spread_threshold_bps') || 'Spread threshold (bps)'}
                        type="number"
                        value={draft.monitoring.spreadThresholdBps.toString()}
                        onChange={value => updateMonitoring('spreadThresholdBps', Number(value) || 0)}
                    />
                    <Field
                        label={t('min_depth_usd') || 'Min depth (USD)'}
                        type="number"
                        value={draft.monitoring.minDepthUSD.toString()}
                        onChange={value => updateMonitoring('minDepthUSD', Number(value) || 0)}
                    />
                    <Field
                        label={t('imbalance_threshold') || 'Imbalance threshold'}
                        type="number"
                        value={draft.monitoring.imbalanceThreshold.toString()}
                        onChange={value => updateMonitoring('imbalanceThreshold', Number(value) || 0)}
                    />
                    <Field
                        label={t('max_slippage_usd') || 'Max slippage (USD)'}
                        type="number"
                        value={draft.monitoring.maxSlippageUSD.toString()}
                        onChange={value => updateMonitoring('maxSlippageUSD', Number(value) || 0)}
                    />
                    <Field
                        label={t('min_volume_24h') || 'Min 24h volume (USD)'}
                        type="number"
                        value={(draft.monitoring.minVolume24hUSD ?? 0).toString()}
                        onChange={value => updateMonitoring('minVolume24hUSD', Number(value) || 0)}
                    />
                    <Field
                        label={t('analysis_interval') || 'Analysis interval (minutes)'}
                        type="number"
                        value={(draft.monitoring.analysisIntervalMinutes ?? 5).toString()}
                        onChange={value => updateMonitoring('analysisIntervalMinutes', Number(value) || 0)}
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('liquidity_filters') || 'Liquidity filters'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                        label={t('target_markets') || 'Target markets'}
                        value={(draft.filters?.targetMarkets || ['spot']).join(', ')}
                        onChange={value => updateFilters('targetMarkets', parseList(value))}
                    />
                    <Field
                        label={t('preferred_exchanges') || 'Preferred exchanges'}
                        value={(draft.filters?.preferredExchanges || ['MEXC']).join(', ')}
                        onChange={value => updateFilters('preferredExchanges', parseList(value))}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <ToggleField
                        label={t('enforce_depth_check') || 'Enforce depth check'}
                        description={t('enforce_depth_check_desc') || 'Alert whenever depth drops below threshold.'}
                        checked={draft.filters?.enforceDepthCheck ?? true}
                        onChange={checked => updateFilters('enforceDepthCheck', checked)}
                    />
                    <ToggleField
                        label={t('enforce_spread_check') || 'Enforce spread check'}
                        description={t('enforce_spread_check_desc') || 'Monitor spread spikes aggressively.'}
                        checked={draft.filters?.enforceSpreadCheck ?? true}
                        onChange={checked => updateFilters('enforceSpreadCheck', checked)}
                    />
                    <ToggleField
                        label={t('require_multiple_markets') || 'Require multi-market'}
                        description={t('require_multiple_markets_desc') || 'Only alert when multiple markets confirm.'}
                        checked={draft.filters?.requireMultipleMarkets ?? true}
                        onChange={checked => updateFilters('requireMultipleMarkets', checked)}
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('slippage_controls') || 'Slippage controls'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field
                        label={t('max_slippage_bps') || 'Max slippage (bps)'}
                        type="number"
                        value={(draft.slippageControls?.maxSlippageBps ?? 15).toString()}
                        onChange={value => updateSlippageControls('maxSlippageBps', Number(value) || 0)}
                    />
                    <Field
                        label={t('target_order_size') || 'Target order size (USD)'}
                        type="number"
                        value={(draft.slippageControls?.targetOrderSizeUSD ?? 10000).toString()}
                        onChange={value => updateSlippageControls('targetOrderSizeUSD', Number(value) || 0)}
                    />
                    <ToggleField
                        label={t('alert_on_impact') || 'Alert on impact'}
                        description={t('alert_on_impact_desc') || 'Notify when impact score breached.'}
                        checked={draft.slippageControls?.alertOnImpactScore ?? true}
                        onChange={checked => updateSlippageControls('alertOnImpactScore', checked)}
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('capital_flow_settings') || 'Capital flow settings'}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <ToggleField
                        label={t('capital_flow_enabled') || 'Enable flow tracking'}
                        checked={draft.capitalFlow?.enabled ?? true}
                        onChange={checked => updateCapitalFlow('enabled', checked)}
                    />
                    <Field
                        label={t('lookback_hours') || 'Lookback (hours)'}
                        type="number"
                        value={(draft.capitalFlow?.lookbackHours ?? 6).toString()}
                        onChange={value => updateCapitalFlow('lookbackHours', Number(value) || 0)}
                    />
                    <Field
                        label={t('min_flow_usd') || 'Min flow (USD)'}
                        type="number"
                        value={(draft.capitalFlow?.minFlowUSD ?? 1000000).toString()}
                        onChange={value => updateCapitalFlow('minFlowUSD', Number(value) || 0)}
                    />
                    <ToggleField
                        label={t('include_stablecoins') || 'Include stablecoins'}
                        checked={draft.capitalFlow?.includeStablecoins ?? true}
                        onChange={checked => updateCapitalFlow('includeStablecoins', checked)}
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('schedule_settings') || 'Schedule'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('mode') || 'Mode'}</label>
                        <select
                            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
                            value={draft.schedule?.mode || 'real_time'}
                            onChange={event => updateSchedule('mode', event.target.value as LiquidityAnalysisConfig['schedule']['mode'])}
                        >
                            <option value="real_time">{t('real_time') || 'Real-time'}</option>
                            <option value="periodic">{t('periodic') || 'Periodic'}</option>
                        </select>
                    </div>
                    <Field
                        label={t('frequency_minutes') || 'Frequency (minutes)'}
                        type="number"
                        value={(draft.schedule?.frequencyMinutes ?? 5).toString()}
                        onChange={value => updateSchedule('frequencyMinutes', Number(value) || 0)}
                    />
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('analysis_window') || 'Analysis window'}</label>
                        <select
                            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
                            value={draft.schedule?.analysisWindow || '5m'}
                            onChange={event => updateSchedule('analysisWindow', event.target.value as LiquidityAnalysisConfig['schedule']['analysisWindow'])}
                        >
                            {['1m', '5m', '15m', '1h', '4h'].map(window => (
                                <option key={window} value={window}>
                                    {window}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </SectionCard>

            <SectionCard title={t('alert_settings') || 'Alert settings'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ToggleField label={t('spread_alert') || 'Spread'} checked={draft.alerts.onSpreadWiden} onChange={checked => updateAlerts('onSpreadWiden', checked)} />
                    <ToggleField label={t('depth_alert') || 'Depth'} checked={draft.alerts.onLiquidityDrop} onChange={checked => updateAlerts('onLiquidityDrop', checked)} />
                    <ToggleField label={t('imbalance_alert') || 'Imbalance'} checked={draft.alerts.onOrderBookImbalance} onChange={checked => updateAlerts('onOrderBookImbalance', checked)} />
                    <ToggleField label={t('high_liquidity_alert') || 'High liquidity'} checked={draft.alerts.onHighLiquidity ?? true} onChange={checked => updateAlerts('onHighLiquidity', checked)} />
                    <ToggleField label={t('low_liquidity_alert') || 'Low liquidity'} checked={draft.alerts.onLowLiquidity ?? true} onChange={checked => updateAlerts('onLowLiquidity', checked)} />
                    <ToggleField label={t('flow_out_alert') || 'Flow out'} checked={draft.alerts.onFlowOut ?? true} onChange={checked => updateAlerts('onFlowOut', checked)} />
                    <ToggleField label={t('slippage_alert') || 'Slippage'} checked={draft.alerts.onSlippageRisk ?? true} onChange={checked => updateAlerts('onSlippageRisk', checked)} />
                </div>
            </SectionCard>

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => setDraft(config)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700"
                    disabled={disabled}
                >
                    {t('reset') || 'Reset'}
                </button>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50"
                    disabled={disabled}
                >
                    {t('save_changes') || 'Save changes'}
                </button>
            </div>
        </div>
    );
};

const IntegrationTab: React.FC<{ config: LiquidityAnalysisConfig; t: (key: string) => string }> = ({ config, t }) => {
    const integrations = config.integrations ?? {
        shareWithArtemis: true,
        syncWithRisk: true,
        syncWithAllocation: true,
        syncWithArbitrage: true,
        forwardToExecution: true,
    };

    const schedule = config.schedule ?? { mode: 'real_time', frequencyMinutes: 5, analysisWindow: '5m' };
    const alertChannels = ['dashboard', 'email', 'telegram'].filter(
        channel => config.alerts.channels?.[channel as keyof typeof config.alerts.channels],
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title={t('integration_settings') || 'Integration settings'}>
                <div className="space-y-3">
                    <IntegrationRow label={t('share_with_artemis') || 'Share with Artemis core'} enabled={integrations.shareWithArtemis} />
                    <IntegrationRow label={t('sync_with_risk') || 'Sync with Risk agent'} enabled={integrations.syncWithRisk} />
                    <IntegrationRow label={t('sync_with_allocation') || 'Sync with Allocation agent'} enabled={integrations.syncWithAllocation} />
                    <IntegrationRow label={t('sync_with_arbitrage') || 'Sync with Arbitrage agent'} enabled={integrations.syncWithArbitrage} />
                    <IntegrationRow label={t('forward_to_execution') || 'Forward to execution stack'} enabled={integrations.forwardToExecution} />
                </div>
            </SectionCard>
            <SectionCard title={t('analysis_schedule') || 'Analysis schedule'}>
                <div className="space-y-3 text-sm text-gray-300">
                    <p>{t('mode') || 'Mode'}: <span className="text-white font-semibold">{t(schedule.mode)}</span></p>
                    <p>{t('frequency_minutes') || 'Frequency (minutes)'}: <span className="text-white font-semibold">{schedule.frequencyMinutes}</span></p>
                    <p>{t('analysis_window') || 'Analysis window'}: <span className="text-white font-semibold">{schedule.analysisWindow}</span></p>
                    <p>{t('alert_channels') || 'Alert channels'}: <span className="text-white font-semibold">{alertChannels.join(', ') || t('dashboard')}</span></p>
                </div>
            </SectionCard>
        </div>
    );
};

const IntegrationRow: React.FC<{ label: string; enabled?: boolean }> = ({ label, enabled }) => (
    <div className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <span className="text-sm text-white">{label}</span>
        <InfoBadge label={enabled ? 'ON' : 'OFF'} tone={enabled ? 'success' : 'muted'} />
    </div>
);

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        {children}
    </section>
);

const MetricCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
    </div>
);

type InfoTone = 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'muted';

const InfoBadge: React.FC<{ label: string; tone?: InfoTone }> = ({ label, tone = 'info' }) => {
    const toneClasses: Record<InfoTone, string> = {
        success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        danger: 'bg-red-500/20 text-red-300 border-red-500/40',
        warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        info: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        accent: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        muted: 'bg-gray-700/40 text-gray-300 border-gray-600/60',
    };

    return <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${toneClasses[tone]}`}>{label}</span>;
};

const Field: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'number' | 'textarea';
}> = ({ label, value, onChange, type = 'text' }) => (
    <label className="block text-sm text-gray-200">
        <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
        {type === 'textarea' ? (
            <textarea
                className="w-full mt-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
                rows={3}
                value={value}
                onChange={event => onChange(event.target.value)}
            />
        ) : (
            <input
                type={type}
                className="w-full mt-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
                value={value}
                onChange={event => onChange(event.target.value)}
            />
        )}
    </label>
);

const ToggleField: React.FC<{
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
    <label className="flex items-start gap-3 p-3 border border-gray-800 rounded-xl bg-gray-900/40 cursor-pointer">
        <input
            type="checkbox"
            className="mt-1 accent-cyan-500"
            checked={checked}
            onChange={event => onChange(event.target.checked)}
        />
        <div>
            <p className="text-sm text-white font-semibold">{label}</p>
            {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
    </label>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center text-gray-400 py-10">
        <p>{message}</p>
    </div>
);

// ----------------------------------------------------------------------------- //
// Capabilities Section
// ----------------------------------------------------------------------------- //

const LIQUIDITY_CAPABILITY_KEYS = [
    'liquidity_capability_realtime_monitoring',
    'liquidity_capability_auto_alerts',
    'liquidity_capability_slippage_analysis',
    'liquidity_capability_market_comparison',
    'liquidity_capability_hybrid_data',
    'liquidity_capability_custom_filters',
    'liquidity_capability_agent_coordination',
    'liquidity_capability_reporting',
] as const;

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isLiquidityAgent = agent.id === '8' || agent.role === 'Liquidity Analysis';
    const capabilityItems = isLiquidityAgent
        ? LIQUIDITY_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('liquidity_capability_', '').replace(/_/g, ' ');
              return {
                  key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isLiquidityAgent ? (
                <ul className="space-y-3 text-sm text-gray-300">
                    {capabilityItems.map(item => (
                        <li key={item.key} className="flex gap-3 items-start">
                            <span className="text-cyan-400 mt-0.5">•</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {capabilityItems.map(item => (
                        <span key={item.key} className="bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-full text-sm">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LiquidityAgentControl;
