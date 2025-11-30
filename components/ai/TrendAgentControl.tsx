import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    Timeframe,
    TrendDetectionConfig,
    TrendDetectionMetrics,
    TrendDetectionResult,
    TrendDetectionMethod,
    TrendSignalDetail,
    TrendAlertDetail,
    TrendMapEntry,
    TrendHistoryEntry,
} from '../../types.ts';

type TrendTab =
    | 'overview'
    | 'trend_map'
    | 'history'
    | 'indicators'
    | 'alerts'
    | 'multiframe'
    | 'settings'
    | 'integration';

const TAB_ITEMS: Array<{ id: TrendTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'trend_map', labelKey: 'tab_trend_map' },
    { id: 'history', labelKey: 'tab_trend_history' },
    { id: 'indicators', labelKey: 'tab_indicators' },
    { id: 'alerts', labelKey: 'tab_alerts' },
    { id: 'multiframe', labelKey: 'tab_multi_timeframe' },
    { id: 'settings', labelKey: 'tab_settings' },
    { id: 'integration', labelKey: 'tab_integration' },
];

interface TrendAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const TrendAgentControl: React.FC<TrendAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<TrendTab>('overview');
    const [config, setConfig] = useState<TrendDetectionConfig | null>(agent.trendDetectionConfig || null);
    const [metrics, setMetrics] = useState<TrendDetectionMetrics | null>(agent.trendMetrics || null);
    const [analysis, setAnalysis] = useState<TrendDetectionResult | null>(agent.lastTrendDetection || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchTrendDetectionAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastAnalysis) setAnalysis(data.lastAnalysis);
            } catch (error) {
                console.error('Failed to load trend agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [agent.id]);

    const handleRunAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const result = await api.runTrendDetectionAnalysis(agent.id);
            setAnalysis(result);
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.trendMetrics || null);
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run trend analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: TrendDetectionConfig) => {
        setIsLoading(true);
        try {
            await api.updateTrendDetectionConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated');
        } catch (error) {
            console.error('Failed to update trend config:', error);
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

    const signals = useMemo(() => analysis?.signals ?? [], [analysis?.signals]);
    const trendMap = useMemo(() => analysis?.trendMap ?? [], [analysis?.trendMap]);
    const alertDetails = useMemo(() => analysis?.alertDetails ?? [], [analysis?.alertDetails]);
    const history = useMemo(() => metrics?.history ?? [], [metrics?.history]);
    const multiTimeframe = useMemo(() => analysis?.multiTimeframeComparison ?? {}, [analysis?.multiTimeframeComparison]);

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
                                    ? 'border-blue-500 text-blue-300'
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
                        <OverviewTab agent={agent} analysis={analysis} metrics={metrics} t={t} />
                    )}
                    {activeTab === 'trend_map' && <TrendMapTab trendMap={trendMap} t={t} />}
                    {activeTab === 'history' && <HistoryTab history={history} t={t} />}
                    {activeTab === 'indicators' && <IndicatorsTab signals={signals} t={t} />}
                    {activeTab === 'alerts' && <AlertsTab alerts={alertDetails} t={t} />}
                    {activeTab === 'multiframe' && <MultiTimeframeTab multiTimeframe={multiTimeframe} t={t} />}
                    {activeTab === 'settings' && config && (
                        <SettingsTab config={config} disabled={isLoading} onUpdate={handleUpdateConfig} t={t} />
                    )}
                    {activeTab === 'integration' && config && <IntegrationTab config={config} t={t} />}

                    {!analysis && activeTab === 'overview' && (
                        <EmptyState message={t('no_trend_data') || 'No trend analyses have been executed yet.'} />
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
            <p className="text-xs uppercase tracking-widest text-gray-500">{t('trend_agent') || 'Trend Detection Agent'}</p>
            <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{agent.role}</p>
        </div>
        <div className="flex gap-3">
            <button
                onClick={onRunAnalysis}
                disabled={isAnalyzing || agent.status !== 'active'}
                className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {isAnalyzing ? t('analyzing') || 'Analyzing...' : t('run_analysis')}
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
    analysis: TrendDetectionResult | null;
    metrics: TrendDetectionMetrics | null;
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
                        {t('trends_detected') || 'Trends'}: <span className="text-white font-semibold ml-1">{analysis.signals.length}</span>
                    </span>
                )}
                {metrics && (
                    <span className="text-sm text-gray-400">
                        {t('total_analyses') || 'Analyses'}: <span className="text-white font-semibold ml-1">{metrics.totalAnalyses}</span>
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
    analysis: TrendDetectionResult;
    metrics: TrendDetectionMetrics;
    t: (key: string) => string;
}> = ({ agent, analysis, metrics, t }) => {
    const summary = analysis.summary || { bullish: 0, bearish: 0, sideways: 0, strong: 0 };
    const statCards = [
        {
            label: t('average_confidence') || 'Avg Confidence',
            value: `${metrics.averageConfidence.toFixed(1)}%`,
            helper: t('trend_reliability') || 'Trend reliability score',
        },
        {
            label: t('average_strength') || 'Avg Strength',
            value: `${metrics.averageStrength.toFixed(1)}%`,
            helper: t('trend_power') || 'Overall trend power',
        },
        {
            label: t('reversals_detected') || 'Reversals',
            value: metrics.reversalsDetected || 0,
            helper: t('trend_changes') || 'Trend reversals detected',
        },
        {
            label: t('breakouts_detected') || 'Breakouts',
            value: metrics.breakoutsDetected || 0,
            helper: t('breakout_events') || 'Breakout events',
        },
    ];

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

            <SectionCard title={t('trend_summary') || 'Trend Summary'}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard label={t('bullish_signals') || 'Bullish'} value={summary.bullish} />
                    <MetricCard label={t('bearish_signals') || 'Bearish'} value={summary.bearish} />
                    <MetricCard label={t('sideways_signals') || 'Sideways'} value={summary.sideways} />
                    <MetricCard label={t('strong_trends') || 'Strong'} value={summary.strong} />
                </div>
            </SectionCard>

            {analysis.alerts && analysis.alerts.length > 0 && (
                <SectionCard title={t('recent_alerts') || 'Recent Alerts'}>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                        {analysis.alerts.slice(0, 5).map((alert, index) => (
                            <div key={index} className="text-sm text-gray-300 border border-gray-800 rounded-lg px-4 py-2">
                                {alert}
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Agent Capabilities */}
            <CapabilitiesSection agent={agent} />
        </div>
    );
};

const TrendMapTab: React.FC<{ trendMap: TrendMapEntry[]; t: (key: string) => string }> = ({ trendMap, t }) => (
    <SectionCard title={t('trend_map') || 'Trend Map'}>
        {trendMap.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trendMap.map(entry => (
                    <div key={entry.symbol} className="border border-gray-800 rounded-2xl p-5 bg-gray-900/40 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-semibold text-lg">{entry.symbol}</p>
                                <p className="text-xs text-gray-500">{t('overall') || 'Overall'}: {t(entry.overallDirection)}</p>
                            </div>
                            <InfoBadge
                                label={entry.status.toUpperCase()}
                                tone={entry.status === 'strong' ? 'success' : entry.status === 'moderate' ? 'info' : entry.status === 'weak' ? 'warning' : 'muted'}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {Object.entries(entry.timeframes).map(([tf, data]) => (
                                <div key={tf} className="border border-gray-800 rounded-lg p-3">
                                    <p className="text-xs text-gray-500">{tf}</p>
                                    <p className={`text-white font-semibold ${
                                        data.direction === 'bullish' ? 'text-green-400' :
                                        data.direction === 'bearish' ? 'text-red-400' : 'text-gray-400'
                                    }`}>
                                        {t(data.direction)}
                                    </p>
                                    <p className="text-xs text-gray-400">{data.strength.toFixed(1)}% / {data.confidence.toFixed(0)}%</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_trend_map') || 'No trend map data available.'} />
        )}
    </SectionCard>
);

const HistoryTab: React.FC<{ history: TrendHistoryEntry[]; t: (key: string) => string }> = ({ history, t }) => (
    <SectionCard title={t('trend_history') || 'Trend History'}>
        {history.length ? (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-2">
                {history.slice(-30).reverse().map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-sm text-gray-300 border border-gray-800 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-4">
                            <span>{entry.symbol}</span>
                            <span className="text-xs text-gray-500">{entry.timeframe}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                                entry.direction === 'bullish' ? 'bg-green-500/20 text-green-400' :
                                entry.direction === 'bearish' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>
                                {t(entry.direction)}
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            {entry.reversal && <InfoBadge label={t('reversal') || 'REVERSAL'} tone="danger" />}
                            {entry.continuation && <InfoBadge label={t('continuation') || 'CONT'} tone="success" />}
                            <span>{entry.strength.toFixed(1)}%</span>
                            <span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_history') || 'No trend history tracked yet.'} />
        )}
    </SectionCard>
);

const IndicatorsTab: React.FC<{ signals: TrendSignalDetail[]; t: (key: string) => string }> = ({ signals, t }) => (
    <SectionCard title={t('indicators') || 'Indicators'}>
        {signals.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {signals.map(signal => (
                    <div key={`${signal.symbol}-${signal.timeframe}`} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-white font-semibold">{signal.symbol} · {signal.timeframe}</p>
                                <p className="text-xs text-gray-500">{t('price') || 'Price'}: ${signal.lastPrice.toFixed(2)}</p>
                            </div>
                            <InfoBadge
                                label={t(signal.direction)}
                                tone={signal.direction === 'bullish' ? 'success' : signal.direction === 'bearish' ? 'danger' : 'muted'}
                            />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                                <p className="text-xs text-gray-500">{t('strength') || 'Strength'}</p>
                                <p className="text-white font-semibold">{signal.strength.toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('confidence') || 'Confidence'}</p>
                                <p className="text-white font-semibold">{signal.confidence.toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('slope') || 'Slope'}</p>
                                <p className="text-white font-semibold">{signal.slope.toFixed(4)}</p>
                            </div>
                            {signal.adx !== undefined && (
                                <div>
                                    <p className="text-xs text-gray-500">ADX</p>
                                    <p className="text-white font-semibold">{signal.adx.toFixed(2)}</p>
                                </div>
                            )}
                            {signal.duration !== undefined && (
                                <div>
                                    <p className="text-xs text-gray-500">{t('duration') || 'Duration'}</p>
                                    <p className="text-white font-semibold">{signal.duration}m</p>
                                </div>
                            )}
                        </div>
                        {signal.volumeConfirmed !== undefined && (
                            <div className="mt-2 flex gap-2 text-xs">
                                {signal.volumeConfirmed && <InfoBadge label={t('volume_confirmed') || 'VOL'} tone="success" />}
                                {signal.sentimentValidated && <InfoBadge label={t('sentiment_ok') || 'SENT'} tone="info" />}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_indicators') || 'No indicator data available.'} />
        )}
    </SectionCard>
);

const AlertsTab: React.FC<{ alerts: TrendAlertDetail[]; t: (key: string) => string }> = ({ alerts, t }) => (
    <SectionCard title={t('alerts_signals') || 'Alerts & Signals'}>
        {alerts.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {alerts.map(alert => (
                    <div key={alert.id} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-white font-semibold">{alert.symbol} · {alert.timeframe}</p>
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

const MultiTimeframeTab: React.FC<{ multiTimeframe: Record<string, Record<Timeframe, TrendDirection>>; t: (key: string) => string }> = ({ multiTimeframe, t }) => {
    const symbols = Object.keys(multiTimeframe);
    return (
        <SectionCard title={t('multi_timeframe_analysis') || 'Multi-Timeframe Analysis'}>
            {symbols.length ? (
                <div className="space-y-4">
                    {symbols.map(symbol => (
                        <div key={symbol} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                            <p className="text-white font-semibold text-lg mb-3">{symbol}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {Object.entries(multiTimeframe[symbol]).map(([tf, direction]) => (
                                    <div key={tf} className="border border-gray-800 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500 mb-1">{tf}</p>
                                        <p className={`text-lg font-semibold ${
                                            direction === 'bullish' ? 'text-green-400' :
                                            direction === 'bearish' ? 'text-red-400' : 'text-gray-400'
                                        }`}>
                                            {t(direction)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState message={t('no_multiframe_data') || 'No multi-timeframe data available.'} />
            )}
        </SectionCard>
    );
};

const SettingsTab: React.FC<{
    config: TrendDetectionConfig;
    onUpdate: (config: TrendDetectionConfig) => void;
    disabled: boolean;
    t: (key: string) => string;
}> = ({ config, onUpdate, disabled, t }) => {
    const [draft, setDraft] = useState(config);

    useEffect(() => setDraft(config), [config]);

    const parseList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

    const updateMethod = (methodId: TrendDetectionMethod['id'], changes: Partial<TrendDetectionMethod>) => {
        setDraft(prev => ({
            ...prev,
            methods: prev.methods.map(m => m.id === methodId ? { ...m, ...changes } : m),
        }));
    };

    return (
        <div className="space-y-6">
            <SectionCard title={t('monitored_symbols') || 'Monitored Symbols'}>
                <Field
                    label={t('symbols') || 'Symbols'}
                    type="textarea"
                    value={draft.symbols.join(', ')}
                    onChange={value => setDraft(prev => ({ ...prev, symbols: parseList(value).map(s => s.toUpperCase()) }))}
                />
            </SectionCard>

            <SectionCard title={t('timeframes') || 'Timeframes'}>
                <Field
                    label={t('timeframes') || 'Timeframes (comma separated)'}
                    value={draft.timeframes.join(', ')}
                    onChange={value => setDraft(prev => ({ ...prev, timeframes: parseList(value) as Timeframe[] }))}
                />
            </SectionCard>

            <SectionCard title={t('indicator_settings') || 'Indicator Settings'}>
                <div className="space-y-3">
                    {draft.methods.map(method => (
                        <div key={method.id} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-white font-semibold">{method.id.toUpperCase()}</p>
                                <ToggleField
                                    label={t('enabled') || 'Enabled'}
                                    checked={method.enabled}
                                    onChange={checked => updateMethod(method.id, { enabled: checked })}
                                />
                            </div>
                            <Field
                                label={t('weight') || 'Weight'}
                                type="number"
                                value={method.weight.toString()}
                                onChange={value => updateMethod(method.id, { weight: parseFloat(value) || 0 })}
                            />
                        </div>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('thresholds') || 'Thresholds'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field
                        label={t('strong_strength') || 'Strong Strength'}
                        type="number"
                        value={draft.thresholds.strongStrength.toString()}
                        onChange={value => setDraft(prev => ({ ...prev, thresholds: { ...prev.thresholds, strongStrength: parseFloat(value) || 0 } }))}
                    />
                    <Field
                        label={t('weak_strength') || 'Weak Strength'}
                        type="number"
                        value={draft.thresholds.weakStrength.toString()}
                        onChange={value => setDraft(prev => ({ ...prev, thresholds: { ...prev.thresholds, weakStrength: parseFloat(value) || 0 } }))}
                    />
                    <Field
                        label={t('reversal_sensitivity') || 'Reversal Sensitivity'}
                        type="number"
                        value={(draft.thresholds.reversalSensitivity || 0.6).toString()}
                        onChange={value => setDraft(prev => ({ ...prev, thresholds: { ...prev.thresholds, reversalSensitivity: parseFloat(value) || 0 } }))}
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('alert_settings') || 'Alert Settings'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ToggleField label={t('trend_change') || 'Trend Change'} checked={draft.alerts.onTrendChange} onChange={checked => setDraft(prev => ({ ...prev, alerts: { ...prev.alerts, onTrendChange: checked } }))} />
                    <ToggleField label={t('reversal') || 'Reversal'} checked={draft.alerts.onTrendReversal ?? false} onChange={checked => setDraft(prev => ({ ...prev, alerts: { ...prev.alerts, onTrendReversal: checked } }))} />
                    <ToggleField label={t('breakout') || 'Breakout'} checked={draft.alerts.onBreakout ?? false} onChange={checked => setDraft(prev => ({ ...prev, alerts: { ...prev.alerts, onBreakout: checked } }))} />
                    <ToggleField label={t('strong_trend') || 'Strong Trend'} checked={draft.alerts.onStrongTrend} onChange={checked => setDraft(prev => ({ ...prev, alerts: { ...prev.alerts, onStrongTrend: checked } }))} />
                    <ToggleField label={t('weak_trend') || 'Weak Trend'} checked={draft.alerts.onWeakTrend} onChange={checked => setDraft(prev => ({ ...prev, alerts: { ...prev.alerts, onWeakTrend: checked } }))} />
                </div>
            </SectionCard>

            <SectionCard title={t('filters') || 'Filters'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('volume_confirmation') || 'Volume Confirmation'}
                        checked={draft.filters?.requireVolumeConfirmation ?? false}
                        onChange={checked => setDraft(prev => ({ ...prev, filters: { ...prev.filters, requireVolumeConfirmation: checked } }))}
                    />
                    <ToggleField
                        label={t('sentiment_validation') || 'Sentiment Validation'}
                        checked={draft.filters?.requireSentimentValidation ?? false}
                        onChange={checked => setDraft(prev => ({ ...prev, filters: { ...prev.filters, requireSentimentValidation: checked } }))}
                    />
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
                    onClick={() => onUpdate(draft)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-50"
                    disabled={disabled}
                >
                    {t('save_changes') || 'Save changes'}
                </button>
            </div>
        </div>
    );
};

const IntegrationTab: React.FC<{ config: TrendDetectionConfig; t: (key: string) => string }> = ({ config, t }) => {
    const integrations = config.integrationSettings ?? {
        shareWithArtemis: true,
        syncWithTechnical: true,
        syncWithPattern: true,
        syncWithSentiment: true,
        forwardToExecution: true,
    };
    const channels = config.alertChannels ?? { dashboard: true, email: false, messenger: false };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title={t('integration_settings') || 'Integration Settings'}>
                <div className="space-y-3">
                    <IntegrationRow label={t('share_with_artemis') || 'Share with Artemis'} enabled={integrations.shareWithArtemis} />
                    <IntegrationRow label={t('sync_with_technical') || 'Sync with Technical'} enabled={integrations.syncWithTechnical} />
                    <IntegrationRow label={t('sync_with_pattern') || 'Sync with Pattern'} enabled={integrations.syncWithPattern} />
                    <IntegrationRow label={t('sync_with_sentiment') || 'Sync with Sentiment'} enabled={integrations.syncWithSentiment} />
                    <IntegrationRow label={t('forward_to_execution') || 'Forward to Execution'} enabled={integrations.forwardToExecution} />
                </div>
            </SectionCard>
            <SectionCard title={t('alert_channels') || 'Alert Channels'}>
                <div className="space-y-3">
                    <IntegrationRow label={t('dashboard') || 'Dashboard'} enabled={channels.dashboard} />
                    <IntegrationRow label={t('email') || 'Email'} enabled={channels.email} />
                    <IntegrationRow label={t('messenger') || 'Messenger'} enabled={channels.messenger} />
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
        info: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
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
    checked: boolean;
    onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-3 p-3 border border-gray-800 rounded-xl bg-gray-900/40 cursor-pointer">
        <input
            type="checkbox"
            className="mt-1 accent-blue-500"
            checked={checked}
            onChange={event => onChange(event.target.checked)}
        />
        <p className="text-sm text-white font-semibold">{label}</p>
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

const TREND_CAPABILITY_KEYS = [
    'trend_capability_detection',
    'trend_capability_heatmap',
    'trend_capability_alerts',
    'trend_capability_multiframe',
    'trend_capability_validation',
    'trend_capability_customization',
    'trend_capability_integration',
    'trend_capability_dashboard',
] as const;

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isTrendAgent = agent.id === '9' || agent.role === 'Trend Detection';
    const capabilityItems = isTrendAgent
        ? TREND_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('trend_capability_', '').replace(/_/g, ' ');
              return {
                  key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isTrendAgent ? (
                <ul className="space-y-3 text-sm text-gray-300">
                    {capabilityItems.map(item => (
                        <li key={item.key} className="flex gap-3 items-start">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {capabilityItems.map(item => (
                        <span key={item.key} className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TrendAgentControl;
