import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    FundamentalAnalysisConfig,
    FundamentalAnalysisMetrics,
    FundamentalAnalysisResult,
    FundamentalSignal,
    CompanyProjectData,
    EventImpactAnalysis,
    OnChainData,
    FairValueHistoryEntry,
    FinancialRatio,
} from '../../types.ts';

interface FundamentalAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const FundamentalAgentControl: React.FC<FundamentalAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    type FundamentalTab = 'overview' | 'company_data' | 'financial_ratios' | 'events' | 'onchain' | 'fair_value' | 'settings' | 'integration';
    const [activeTab, setActiveTab] = useState<FundamentalTab>('overview');
    const [config, setConfig] = useState<FundamentalAnalysisConfig | null>(agent.fundamentalAnalysisConfig || null);
    const [metrics, setMetrics] = useState<FundamentalAnalysisMetrics | null>(agent.fundamentalMetrics || null);
    const [analysis, setAnalysis] = useState<FundamentalAnalysisResult | null>(agent.lastFundamentalAnalysis || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchFundamentalAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastAnalysis) setAnalysis(data.lastAnalysis);
            } catch (error) {
                console.error('Failed to load fundamental agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [agent.id]);

    const handleRunAnalysis = async () => {
        setIsRunning(true);
        try {
            const result = await api.runFundamentalAnalysis(agent.id);
            setAnalysis(result);
            const updatedAgents = await api.fetchAIAgents();
            const updatedAgent = updatedAgents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.fundamentalMetrics || null);
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run fundamental analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsRunning(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: FundamentalAnalysisConfig) => {
        setIsLoading(true);
        try {
            await api.updateFundamentalAnalysisConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated');
        } catch (error) {
            console.error('Failed to update fundamental config:', error);
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

    const signals = useMemo<FundamentalSignal[]>(() => analysis?.signals ?? [], [analysis]);
    const companyData = useMemo(() => analysis?.companyProjectData ?? [], [analysis?.companyProjectData]);
    const eventImpacts = useMemo(() => analysis?.eventImpacts ?? [], [analysis?.eventImpacts]);
    const onChainData = useMemo(() => analysis?.onChainData ?? [], [analysis?.onChainData]);
    const fairValueHistory = useMemo(() => analysis?.fairValueHistory ?? metrics?.fairValueHistory ?? [], [analysis?.fairValueHistory, metrics?.fairValueHistory]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-[#161B22] border-b border-gray-800 p-6 flex justify-between items-center z-10 gap-3 flex-wrap">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {agent.name} - {t('fundamental_agent') || 'Fundamental Analysis'}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            {t('fundamental_agent_desc') || 'Evaluates macro, on-chain, funding and news data from MEXC ecosystem.'}
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={handleRunAnalysis}
                            disabled={isRunning || agent.status !== 'active'}
                            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isRunning ? t('processing') || 'Processing…' : t('run_analysis')}
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
                            { id: 'overview', key: 'tab_overview' },
                            { id: 'company_data', key: 'tab_company_data' },
                            { id: 'financial_ratios', key: 'tab_financial_ratios' },
                            { id: 'events', key: 'tab_events' },
                            { id: 'onchain', key: 'tab_onchain' },
                            { id: 'fair_value', key: 'tab_fair_value' },
                            { id: 'settings', key: 'tab_settings' },
                            { id: 'integration', key: 'tab_integration' },
                        ] as const).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as FundamentalTab)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-orange-500 text-orange-400'
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                }`}
                            >
                                {t(tab.key) || tab.id.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && analysis && metrics && (
                        <FundamentalOverview analysis={analysis} metrics={metrics} signals={signals} t={t} />
                    )}
                    {activeTab === 'company_data' && <CompanyDataTab data={companyData} t={t} />}
                    {activeTab === 'financial_ratios' && <FinancialRatiosTab signals={signals} t={t} />}
                    {activeTab === 'events' && <EventsTab events={eventImpacts} t={t} />}
                    {activeTab === 'onchain' && <OnChainTab data={onChainData} t={t} />}
                    {activeTab === 'fair_value' && <FairValueHistoryTab history={fairValueHistory} t={t} />}
                    {activeTab === 'settings' && config && (
                        <FundamentalSettings config={config} disabled={isLoading} onUpdate={handleUpdateConfig} t={t} />
                    )}
                    {activeTab === 'integration' && config && <IntegrationTab config={config} t={t} />}
                    {!analysis && activeTab === 'overview' && (
                        <div className="text-center text-gray-400 py-10">
                            <p>{t('no_fundamental_data') || 'No fundamental analyses executed yet.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const FundamentalOverview: React.FC<{ analysis: FundamentalAnalysisResult; metrics: FundamentalAnalysisMetrics; signals: FundamentalSignal[]; t: (key: string) => string }> = ({ analysis, metrics, signals, t }) => {
    const undervaluedCount = signals.filter(s => s.valuationStatus === 'undervalued').length;
    const overvaluedCount = signals.filter(s => s.valuationStatus === 'overvalued').length;
    return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label={t('avg_fundamental_score') || 'Avg score'} value={analysis.averageScore.toFixed(2)} />
            <MetricCard label={t('macro_context') || 'Macro'} value={`${analysis.marketSummary.fearGreed} · ${analysis.marketSummary.macroLabel}`} />
            <MetricCard label={t('funding_imbl') || 'Funding imbalance'} value={`${analysis.marketSummary.fundingImbalance.toFixed(1)} bps`} />
            <MetricCard label={t('alerts') || 'Alerts'} value={analysis.alerts.length} />
        </div>
        {analysis.alerts.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/40 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-orange-200">{t('recent_alerts') || 'Recent Alerts'}</h3>
                <ul className="text-xs text-gray-200 space-y-1 list-disc pl-4">
                    {analysis.alerts.slice(0, 6).map(alert => (
                        <li key={alert}>{alert}</li>
                    ))}
                </ul>
            </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label={t('bullish_signals') || 'Bullish'} value={metrics.bullishCount} />
            <MetricCard label={t('bearish_signals') || 'Bearish'} value={metrics.bearishCount} />
            <MetricCard label={t('neutral_signals') || 'Neutral'} value={metrics.neutralCount} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard label={t('undervalued_detections') || 'Undervalued'} value={undervaluedCount} />
            <MetricCard label={t('overvalued_detections') || 'Overvalued'} value={overvaluedCount} />
        </div>
        {signals.length > 0 && (
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('valuation_summary') || 'Valuation Summary'}</h3>
                <div className="space-y-2">
                    {signals.slice(0, 5).map(signal => (
                        <div key={signal.symbol} className="flex items-center justify-between text-sm bg-gray-900/60 border border-gray-800 rounded-md px-3 py-2">
                            <span className="text-white">{signal.symbol}</span>
                            <div className="flex items-center gap-3">
                                {signal.intrinsicValue && (
                                    <span className="text-gray-400 text-xs">
                                        {t('intrinsic_value') || 'Intrinsic'}: ${signal.intrinsicValue.toFixed(2)}
                                    </span>
                                )}
                                {signal.valuationStatus && (
                                    <span className={`px-2 py-1 rounded text-xs ${
                                        signal.valuationStatus === 'undervalued' ? 'bg-green-500/20 text-green-400' :
                                        signal.valuationStatus === 'overvalued' ? 'bg-red-500/20 text-red-400' :
                                        'bg-gray-500/20 text-gray-400'
                                    }`}>
                                        {t(signal.valuationStatus) || signal.valuationStatus}
                                    </span>
                                )}
                                {signal.rating && (
                                    <span className={`px-2 py-1 rounded text-xs ${
                                        signal.rating === 'buy' ? 'bg-emerald-500/20 text-emerald-400' :
                                        signal.rating === 'sell' ? 'bg-red-500/20 text-red-400' :
                                        'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                        {t(signal.rating) || signal.rating.toUpperCase()}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
    );
};

const CompanyDataTab: React.FC<{ data: CompanyProjectData[]; t: (key: string) => string }> = ({ data, t }) => (
    <div className="space-y-4">
        {data.length ? (
            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2">
                {data.map(company => (
                    <div key={company.symbol} className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white">{company.name}</h3>
                                <p className="text-xs text-gray-500">{company.symbol} · {t(company.type) || company.type}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${
                                company.type === 'crypto' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                                {t(company.type) || company.type}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {company.marketCap && (
                                <div>
                                    <p className="text-xs text-gray-500">{t('market_cap') || 'Market Cap'}</p>
                                    <p className="text-white font-semibold">${(company.marketCap / 1000000).toFixed(2)}M</p>
                                </div>
                            )}
                            {company.circulatingSupply && (
                                <div>
                                    <p className="text-xs text-gray-500">{t('circulating_supply') || 'Circulating Supply'}</p>
                                    <p className="text-white font-semibold">{(company.circulatingSupply / 1000000).toFixed(2)}M</p>
                                </div>
                            )}
                            {company.totalSupply && (
                                <div>
                                    <p className="text-xs text-gray-500">{t('total_supply') || 'Total Supply'}</p>
                                    <p className="text-white font-semibold">{(company.totalSupply / 1000000).toFixed(2)}M</p>
                                </div>
                            )}
                        </div>
                        {company.team && (
                            <div className="mt-4 pt-4 border-t border-gray-800">
                                <p className="text-xs text-gray-500 mb-2">{t('team') || 'Team'}</p>
                                <p className="text-sm text-gray-300">
                                    {company.team.active ? t('active') || 'Active' : t('inactive') || 'Inactive'}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_company_data') || 'No company/project data available.'}</p>
            </div>
        )}
    </div>
);

const FinancialRatiosTab: React.FC<{ signals: FundamentalSignal[]; t: (key: string) => string }> = ({ signals, t }) => {
    const signalsWithRatios = signals.filter(s => s.financialRatios && s.financialRatios.length > 0);
    return (
        <div className="space-y-4">
            {signalsWithRatios.length ? (
                <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2">
                    {signalsWithRatios.map(signal => (
                        <div key={signal.symbol} className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">{signal.symbol}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {signal.financialRatios?.map((ratio, index) => (
                                    <div key={index} className="border border-gray-800 rounded-xl p-4 bg-gray-900/60">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-semibold text-white">{ratio.name}</p>
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                ratio.status === 'good' ? 'bg-green-500/20 text-green-400' :
                                                ratio.status === 'fair' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-red-500/20 text-red-400'
                                            }`}>
                                                {t(ratio.status) || ratio.status}
                                            </span>
                                        </div>
                                        <p className="text-2xl font-bold text-white">{ratio.value}</p>
                                        {ratio.benchmark && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                {t('benchmark') || 'Benchmark'}: {ratio.benchmark}
                                            </p>
                                        )}
                                        {ratio.description && (
                                            <p className="text-xs text-gray-400 mt-2">{ratio.description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-10">
                    <p>{t('no_financial_ratios') || 'No financial ratios available.'}</p>
                </div>
            )}
        </div>
    );
};

const EventsTab: React.FC<{ events: EventImpactAnalysis[]; t: (key: string) => string }> = ({ events, t }) => (
    <div className="space-y-4">
        {events.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {events.map(event => (
                    <div key={event.id} className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-white font-semibold">{event.title}</h3>
                                <p className="text-xs text-gray-500">{event.symbol} · {new Date(event.date).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                    event.impactDirection === 'positive' ? 'bg-green-500/20 text-green-400' :
                                    event.impactDirection === 'negative' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {t(event.impactDirection) || event.impactDirection}
                                </span>
                                <span className="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-400">
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
                            {event.estimatedPriceImpact !== undefined && (
                                <div>
                                    <p className="text-gray-500">{t('price_impact') || 'Price Impact'}</p>
                                    <p className={`font-semibold ${event.estimatedPriceImpact > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {event.estimatedPriceImpact > 0 ? '+' : ''}{event.estimatedPriceImpact.toFixed(2)}%
                                    </p>
                                </div>
                            )}
                        </div>
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

const OnChainTab: React.FC<{ data: OnChainData[]; t: (key: string) => string }> = ({ data, t }) => (
    <div className="space-y-4">
        {data.length ? (
            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2">
                {data.map(onchain => (
                    <div key={onchain.symbol} className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">{onchain.symbol}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/60">
                                <h4 className="text-sm font-semibold text-gray-300 mb-3">{t('whale_distribution') || 'Whale Distribution'}</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('top_10') || 'Top 10'}</span>
                                        <span className="text-white font-semibold">{onchain.whaleDistribution.top10.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('top_100') || 'Top 100'}</span>
                                        <span className="text-white font-semibold">{onchain.whaleDistribution.top100.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('concentration') || 'Concentration'}</span>
                                        <span className="text-white font-semibold">{onchain.whaleDistribution.concentration.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/60">
                                <h4 className="text-sm font-semibold text-gray-300 mb-3">{t('address_activity') || 'Address Activity'}</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('active_addresses') || 'Active Addresses'}</span>
                                        <span className="text-white font-semibold">{onchain.addressActivity.activeAddresses.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('new_addresses') || 'New Addresses'}</span>
                                        <span className="text-white font-semibold">{onchain.addressActivity.newAddresses.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('transactions') || 'Transactions'}</span>
                                        <span className="text-white font-semibold">{onchain.addressActivity.transactionCount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/60">
                                <h4 className="text-sm font-semibold text-gray-300 mb-3">{t('tokenomics') || 'Tokenomics'}</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('total_supply') || 'Total Supply'}</span>
                                        <span className="text-white font-semibold">{(onchain.tokenomics.totalSupply / 1000000).toFixed(2)}M</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('circulating_supply') || 'Circulating'}</span>
                                        <span className="text-white font-semibold">{(onchain.tokenomics.circulatingSupply / 1000000).toFixed(2)}M</span>
                                    </div>
                                    {onchain.tokenomics.inflationRate !== undefined && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">{t('inflation_rate') || 'Inflation Rate'}</span>
                                            <span className="text-white font-semibold">{onchain.tokenomics.inflationRate.toFixed(2)}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/60">
                                <h4 className="text-sm font-semibold text-gray-300 mb-3">{t('network_health') || 'Network Health'}</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('transaction_volume') || 'Transaction Volume'}</span>
                                        <span className="text-white font-semibold">{(onchain.networkHealth.transactionVolume / 1000).toFixed(2)}K</span>
                                    </div>
                                    {onchain.networkHealth.hashRate && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">{t('hash_rate') || 'Hash Rate'}</span>
                                            <span className="text-white font-semibold">{(onchain.networkHealth.hashRate / 1000000).toFixed(2)}M</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_onchain_data') || 'No on-chain data available.'}</p>
            </div>
        )}
    </div>
);

const FairValueHistoryTab: React.FC<{ history: FairValueHistoryEntry[]; t: (key: string) => string }> = ({ history, t }) => (
    <div className="space-y-4">
        {history.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {history.slice(-30).reverse().map((entry, index) => (
                    <div key={index} className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-white font-semibold">{entry.symbol}</p>
                                <p className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${
                                entry.valuationStatus === 'undervalued' ? 'bg-green-500/20 text-green-400' :
                                entry.valuationStatus === 'overvalued' ? 'bg-red-500/20 text-red-400' :
                                'bg-gray-500/20 text-gray-400'
                            }`}>
                                {t(entry.valuationStatus) || entry.valuationStatus}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                                <p className="text-xs text-gray-500">{t('intrinsic_value') || 'Intrinsic Value'}</p>
                                <p className="text-white font-semibold">${entry.intrinsicValue.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('market_price') || 'Market Price'}</p>
                                <p className="text-white font-semibold">${entry.marketPrice.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('fair_value_ratio') || 'Fair Value Ratio'}</p>
                                <p className="text-white font-semibold">{entry.fairValueRatio.toFixed(3)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('difference') || 'Difference'}</p>
                                <p className={`font-semibold ${
                                    entry.intrinsicValue > entry.marketPrice ? 'text-green-400' : 'text-red-400'
                                }`}>
                                    {((entry.intrinsicValue - entry.marketPrice) / entry.marketPrice * 100).toFixed(2)}%
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_fair_value_history') || 'No fair value history available.'}</p>
            </div>
        )}
    </div>
);

const IntegrationTab: React.FC<{ config: FundamentalAnalysisConfig; t: (key: string) => string }> = ({ config, t }) => {
    const integrations = config.integrationSettings ?? {
        shareWithArtemis: true,
        syncWithPricePrediction: true,
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
                    <IntegrationRow label={t('sync_with_price_prediction') || 'Sync with Price Prediction'} enabled={integrations.syncWithPricePrediction} />
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

const FundamentalSignals: React.FC<{ signals: FundamentalSignal[]; analysisTimestamp?: string; t: (key: string) => string }> = ({ signals, analysisTimestamp, t }) => (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
        {signals.map(signal => (
            <div key={signal.symbol} className="p-4 bg-gray-900/40 border border-gray-800 rounded-lg space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-white font-semibold">{signal.symbol}</p>
                        {analysisTimestamp && (
                            <p className="text-xs text-gray-400">{new Date(analysisTimestamp).toLocaleString()}</p>
                        )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        signal.verdict === 'bullish' ? 'bg-green-500/20 text-green-400' :
                        signal.verdict === 'bearish' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-300'
                    }`}>
                        {t(signal.verdict) || signal.verdict}
                    </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400">
                    <p>{t('score') || 'Score'}: <span className="text-white font-semibold">{signal.score.toFixed(2)}</span></p>
                    <p>{t('funding_rate') || 'Funding'}: {signal.fundingRate !== undefined ? `${signal.fundingRate} bps` : '—'}</p>
                    <p>{t('macro_score') || 'Macro'}: {signal.macroScore?.toFixed(1) ?? '—'}</p>
                    <p>{t('news_score') || 'News'}: {signal.newsScore?.toFixed(1) ?? '—'}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
                    {signal.factors.map(factor => (
                        <div key={`${signal.symbol}-${factor.name}`} className="flex justify-between border border-gray-800 rounded-md px-2 py-1">
                            <span>{factor.name}</span>
                            <span className="text-white">{factor.value.toFixed(1)}</span>
                        </div>
                    ))}
                </div>
                {signal.notes && <p className="text-xs text-gray-300">{signal.notes}</p>}
            </div>
        ))}
        {signals.length === 0 && (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_signals') || 'No signals available yet.'}</p>
            </div>
        )}
    </div>
);

const FundamentalPerformance: React.FC<{ metrics: FundamentalAnalysisMetrics; t: (key: string) => string }> = ({ metrics, t }) => (
    <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label={t('total_runs') || 'Analyses'} value={metrics.totalAnalyses} />
            <MetricCard label={t('avg_fundamental_score') || 'Average score'} value={metrics.averageScore.toFixed(2)} />
            <MetricCard label={t('alerts') || 'Alerts'} value={metrics.alertsTriggered} />
        </div>
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('recent_performance') || 'Recent performance'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
                <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{t('last24h') || 'Last 24h'}</p>
                    <p className="text-white font-semibold">{metrics.recentPerformance.last24h.analyses} · {metrics.recentPerformance.last24h.avgScore.toFixed(2)}</p>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{t('last7d') || 'Last 7d'}</p>
                    <p className="text-white font-semibold">{metrics.recentPerformance.last7d.analyses} · {metrics.recentPerformance.last7d.avgScore.toFixed(2)}</p>
                </div>
            </div>
        </div>
    </div>
);

const FundamentalSettings: React.FC<{
    config: FundamentalAnalysisConfig;
    disabled: boolean;
    onUpdate: (config: FundamentalAnalysisConfig) => void;
    t: (key: string) => string;
}> = ({ config, disabled, onUpdate, t }) => {
    const updateField = (field: keyof FundamentalAnalysisConfig, value: any) => {
        onUpdate({ ...config, [field]: value });
    };

    const updateWeights = (key: keyof FundamentalAnalysisConfig['weights'], value: number) => {
        updateField('weights', { ...config.weights, [key]: value });
    };

    const updateThreshold = (key: keyof FundamentalAnalysisConfig['thresholds'], value: number) => {
        updateField('thresholds', { ...config.thresholds, [key]: value });
    };

    return (
        <div className="space-y-5">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('tracked_symbols') || 'Tracked Symbols'}</h3>
                <textarea
                    rows={2}
                    disabled={disabled}
                    value={config.symbols.join(', ')}
                    onChange={(e) => updateField('symbols', e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
                <label className="block text-sm text-gray-400 mt-2 mb-1">{t('lookback_days') || 'Lookback (days)'}</label>
                <input
                    type="number"
                    disabled={disabled}
                    value={config.lookbackDays}
                    onChange={(e) => updateField('lookbackDays', parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('data_sources') || 'Data Sources'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(['onchain', 'macro', 'funding', 'news', 'financial', 'events'] as const).map(key => (
                        <label key={key} className="flex items-center text-sm text-gray-300 gap-2">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={config.dataSources[key] ?? false}
                                onChange={(e) => updateField('dataSources', { ...config.dataSources, [key]: e.target.checked })}
                                className="w-4 h-4 accent-orange-500"
                            />
                            {t(key) || key}
                        </label>
                    ))}
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('weights') || 'Weights'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['onchain', 'macro', 'funding', 'news', 'financial', 'events'] as const).map(key => (
                        <NumberInput
                            key={key}
                            label={t(key) || key}
                            value={config.weights[key] ?? 0}
                            step={0.05}
                            disabled={disabled}
                            onChange={(value) => updateWeights(key, value)}
                        />
                    ))}
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('thresholds') || 'Thresholds'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberInput
                        label={t('bullish_threshold') || 'Bullish threshold'}
                        value={config.thresholds.bullish}
                        disabled={disabled}
                        onChange={(value) => updateThreshold('bullish', value)}
                    />
                    <NumberInput
                        label={t('bearish_threshold') || 'Bearish threshold'}
                        value={config.thresholds.bearish}
                        disabled={disabled}
                        onChange={(value) => updateThreshold('bearish', value)}
                    />
                    <NumberInput
                        label={t('overvalued_threshold') || 'Overvalued threshold'}
                        value={config.thresholds.overvalued ?? 1.1}
                        step={0.01}
                        disabled={disabled}
                        onChange={(value) => updateThreshold('overvalued', value)}
                    />
                    <NumberInput
                        label={t('undervalued_threshold') || 'Undervalued threshold'}
                        value={config.thresholds.undervalued ?? 0.9}
                        step={0.01}
                        disabled={disabled}
                        onChange={(value) => updateThreshold('undervalued', value)}
                    />
                </div>
            </div>

            {config.assetTypes && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{t('asset_types') || 'Asset Types'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(['stock', 'crypto', 'mixed'] as const).map(type => (
                            <label key={type} className="flex items-center text-sm text-gray-300 gap-2">
                                <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={config.assetTypes?.includes(type) ?? false}
                                    onChange={(e) => {
                                        const current = config.assetTypes || [];
                                        const updated = e.target.checked
                                            ? [...current, type]
                                            : current.filter(t => t !== type);
                                        updateField('assetTypes', updated);
                                    }}
                                    className="w-4 h-4 accent-orange-500"
                                />
                                {t(type) || type}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {config.analysisTimeframe && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{t('analysis_timeframe') || 'Analysis Timeframe'}</h3>
                    <select
                        disabled={disabled}
                        value={config.analysisTimeframe}
                        onChange={(e) => updateField('analysisTimeframe', e.target.value as 'short' | 'medium' | 'long')}
                        className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                    >
                        <option value="short">{t('short_term') || 'Short Term'}</option>
                        <option value="medium">{t('medium_term') || 'Medium Term'}</option>
                        <option value="long">{t('long_term') || 'Long Term'}</option>
                    </select>
                </div>
            )}

            {config.outputType && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{t('output_type') || 'Output Type'}</h3>
                    <select
                        disabled={disabled}
                        value={config.outputType}
                        onChange={(e) => updateField('outputType', e.target.value as 'alerts_only' | 'buy_sell' | 'rating')}
                        className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                    >
                        <option value="alerts_only">{t('alerts_only') || 'Alerts Only'}</option>
                        <option value="buy_sell">{t('buy_sell') || 'Buy/Sell'}</option>
                        <option value="rating">{t('rating') || 'Rating'}</option>
                    </select>
                </div>
            )}
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
        <p className="text-2xl font-bold text-white">{value}</p>
    </div>
);

export default FundamentalAgentControl;

