import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    VolumeAnalysisConfig,
    VolumeAnalysisMetrics,
    VolumeAnalysisResult,
    VolumeSignal,
    VolumeSpreadAnalysis,
    AccumulationDistributionSignal,
    VolumeAnalytics,
} from '../../types.ts';

interface VolumeAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const tabs = ['overview', 'profile', 'indicators', 'signals_alerts', 'analytics', 'settings', 'integration'] as const;

const VolumeAgentControl: React.FC<VolumeAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<typeof tabs[number]>('overview');
    const [config, setConfig] = useState<VolumeAnalysisConfig | null>(agent.volumeAnalysisConfig || null);
    const [metrics, setMetrics] = useState<VolumeAnalysisMetrics | null>(agent.volumeMetrics || null);
    const [analysis, setAnalysis] = useState<VolumeAnalysisResult | null>(agent.lastVolumeAnalysis || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchVolumeAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastAnalysis) setAnalysis(data.lastAnalysis);
            } catch (error) {
                console.error('Failed to load volume agent data', error);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [agent.id]);

    const signals = useMemo<VolumeSignal[]>(() => analysis?.signals ?? [], [analysis]);

    const handleRun = async () => {
        setIsRunning(true);
        try {
            const result = await api.runVolumeAnalysis(agent.id);
            setAnalysis(result);
            const agents = await api.fetchAIAgents();
            const updated = agents.find(a => a.id === agent.id);
            if (updated) {
                setMetrics(updated.volumeMetrics || null);
                setConfig(updated.volumeAnalysisConfig || null);
                onUpdate(updated);
            }
        } catch (error) {
            console.error('Failed to run volume analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsRunning(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: VolumeAnalysisConfig) => {
        setIsLoading(true);
        try {
            await api.updateVolumeAnalysisConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated');
        } catch (error) {
            console.error('Failed to update config:', error);
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
            const updated = agents.find(a => a.id === agent.id);
            if (updated) {
                onUpdate(updated);
            }
        } catch (error) {
            console.error('Failed to execute command', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
                <Header
                    agent={agent}
                    t={t}
                    isRunning={isRunning}
                    onRun={handleRun}
                    onClose={onClose}
                    onCommand={handleControlCommand}
                />

                <div className="border-b border-gray-800">
                    <nav className="flex space-x-6 px-6 overflow-x-auto">
                        {tabs.map(tab => {
                            const translation = t(`volume_tab_${tab}`);
                            const label = (translation && translation !== `volume_tab_${tab}`) 
                                ? translation 
                                : tab.replace(/_/g, ' ');
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        activeTab === tab
                                            ? 'border-blue-500 text-blue-400'
                                            : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 300px)' }}>
                    {activeTab === 'overview' && analysis && (
                        <Overview agent={agent} analysis={analysis} metrics={metrics} t={t} />
                    )}
                    {activeTab === 'profile' && analysis && (
                        <VolumeProfile analysis={analysis} t={t} />
                    )}
                    {activeTab === 'indicators' && analysis && (
                        <Indicators analysis={analysis} t={t} />
                    )}
                    {activeTab === 'signals_alerts' && analysis && (
                        <SignalsAndAlerts signals={signals} analysis={analysis} t={t} />
                    )}
                    {activeTab === 'analytics' && analysis && (
                        <Analytics analysis={analysis} t={t} />
                    )}
                    {activeTab === 'settings' && config && (
                        <Settings config={config} disabled={isLoading} onUpdate={handleUpdateConfig} t={t} />
                    )}
                    {activeTab === 'integration' && config && (
                        <Integration config={config} agent={agent} t={t} />
                    )}
                    {!analysis && activeTab === 'overview' && (
                        <div className="text-center text-gray-400 py-10">
                            <p>{t('no_volume_data') || 'No volume analyses executed yet.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Header: React.FC<{
    agent: AIAgent;
    t: (key: string) => string;
    isRunning: boolean;
    onRun: () => void;
    onClose: () => void;
    onCommand: (command: string) => void;
}> = ({ agent, t, isRunning, onRun, onClose, onCommand }) => (
    <div className="sticky top-0 bg-[#161B22] border-b border-gray-800 p-6 flex justify-between items-center z-10 gap-3 flex-wrap">
        <div>
            <h2 className="text-2xl font-bold text-white">
                {agent.name} - {t('volume_agent') || 'Volume Analysis'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
                {t('volume_agent_desc') || 'Detects HVN/LVN, RVOL spikes, smart money flow and breakout confirmations.'}
            </p>
        </div>
        <div className="flex gap-3 flex-wrap">
            <button
                onClick={onRun}
                disabled={isRunning || agent.status !== 'active'}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {isRunning ? t('processing') || 'Processing…' : t('run_analysis') || 'Run analysis'}
            </button>
            <button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {t('close')}
            </button>
        </div>
        <div className="flex items-center justify-between w-full text-sm text-gray-400 mt-4">
            <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    agent.status === 'training' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                }`}>
                    {t(agent.status)}
                </span>
                <span>{t('accuracy')}: <span className="text-white font-semibold">{agent.accuracy.toFixed(1)}%</span></span>
                <span>{t('decisions')}: <span className="text-white font-semibold">{agent.decisions.toLocaleString()}</span></span>
            </div>
            <div className="flex gap-2">
                {agent.status === 'active' ? (
                    <button
                        onClick={() => onCommand('pause')}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                    >
                        {t('pause')}
                    </button>
                ) : (
                    <button
                        onClick={() => onCommand('start')}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                    >
                        {t('start')}
                    </button>
                )}
                <button
                    onClick={() => onCommand('restart')}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                >
                    {t('restart')}
                </button>
            </div>
        </div>
    </div>
);

const Overview: React.FC<{
    agent: AIAgent;
    analysis: VolumeAnalysisResult;
    metrics: VolumeAnalysisMetrics | null;
    t: (key: string) => string;
}> = ({ agent, analysis, metrics, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label={t('volume_total_market') || 'Total volume (24h)'} value={`$${analysis.summary.totalVolumeUsd.toLocaleString()}`} />
            <MetricCard label={t('volume_avg_rvol') || 'Average RVOL'} value={analysis.summary.averageRelativeVolume.toFixed(2)} />
            <MetricCard label={t('volume_strength_score') || 'Volume strength'} value={analysis.summary.volumeStrengthScore} />
            <MetricCard label={t('volume_poc') || 'POC'} value={analysis.summary.pocPrice.toFixed(2)} />
            <MetricCard label={t('volume_vah') || 'VAH'} value={analysis.summary.vah.toFixed(2)} />
            <MetricCard label={t('volume_val') || 'VAL'} value={analysis.summary.val.toFixed(2)} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('volume_unusual_list') || 'Unusual volume alerts'}</h3>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-2 text-xs text-gray-300">
                    {analysis.unusualVolume.map(item => (
                        <div key={item.symbol} className="flex justify-between border border-gray-800 rounded-lg px-3 py-1.5">
                            <div>
                                <p className="text-white font-semibold">{item.symbol}</p>
                                <p className="text-gray-400">{t('volume_volume_usd') || 'Volume'}: ${item.volumeUsd.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-blue-300 font-semibold">{item.relativeVolume.toFixed(2)}x</p>
                                <p className={item.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {item.changePercent.toFixed(2)}%
                                </p>
                            </div>
                        </div>
                    ))}
                    {analysis.unusualVolume.length === 0 && (
                        <p className="text-gray-500">{t('no_data') || 'No records available.'}</p>
                    )}
                </div>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('volume_metrics') || 'Recent metrics'}</h3>
                {metrics ? (
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-300">
                        <p>{t('volume_runs_total') || 'Total runs'}: <span className="text-white font-semibold">{metrics.totalRuns}</span></p>
                        <p>{t('alerts')}: <span className="text-white font-semibold">{metrics.alertsTriggered}</span></p>
                        <p>{t('volume_hvn_detected') || 'HVN detected'}: {metrics.hvnDetected}</p>
                        <p>{t('volume_lvn_detected') || 'LVN detected'}: {metrics.lvnDetected}</p>
                        <p>{t('volume_unusual_assets') || 'Unusual assets'}: {metrics.unusualAssets}</p>
                        <p>{t('volume_poc_reliability') || 'POC reliability'}: {metrics.pocReliability.toFixed(1)}</p>
                    </div>
                ) : (
                    <p className="text-gray-500">{t('no_data') || 'No data available.'}</p>
                )}
            </div>
        </div>

        {/* Agent Capabilities */}
        <CapabilitiesSection agent={agent} />
    </div>
);

const VolumeProfile: React.FC<{ analysis: VolumeAnalysisResult; t: (key: string) => string }> = ({ analysis, t }) => (
    <div className="space-y-4">
        {analysis.profile.map(profile => (
            <div key={profile.symbol} className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                    <h3 className="text-white font-semibold">{profile.symbol}</h3>
                    <div className="text-xs text-gray-400 flex gap-3">
                        <span>POC: <span className="text-white">{profile.poc.toFixed(2)}</span></span>
                        <span>VAH: <span className="text-white">{profile.vah.toFixed(2)}</span></span>
                        <span>VAL: <span className="text-white">{profile.val.toFixed(2)}</span></span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                    {profile.hvnLevels.slice(0, 4).map(node => (
                        <span key={`hvn-${profile.symbol}-${node.price}`} className="px-2 py-1 rounded-full bg-green-500/10 text-green-300 border border-green-500/20">
                            HVN {node.price.toFixed(2)}
                        </span>
                    ))}
                    {profile.lvnLevels.slice(0, 4).map(node => (
                        <span key={`lvn-${profile.symbol}-${node.price}`} className="px-2 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">
                            LVN {node.price.toFixed(2)}
                        </span>
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px] text-gray-400">
                    {profile.histogram.slice(0, 30).map(node => (
                        <div key={`${profile.symbol}-${node.price}`} className="flex justify-between border border-gray-800 rounded px-2 py-1">
                            <span>{node.price.toFixed(2)}</span>
                            <span className="text-blue-300">{Math.round(node.volume).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        ))}
        {analysis.profile.length === 0 && (
            <p className="text-gray-400 text-sm text-center">{t('no_data') || 'No profile data yet.'}</p>
        )}
    </div>
);

const Indicators: React.FC<{ analysis: VolumeAnalysisResult; t: (key: string) => string }> = ({ analysis, t }) => {
    const entries = Object.entries(analysis.indicators || {});
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map(([symbol, snapshot]) => (
                <div key={symbol} className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 space-y-2">
                    <h3 className="text-white font-semibold">{symbol}</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-300">
                        <p>OBV: <span className="text-white">{Math.round(snapshot.obv).toLocaleString()}</span></p>
                        <p>VWAP: <span className="text-white">{snapshot.vwap.toFixed(2)}</span></p>
                        <p>MFI: <span className={snapshot.mfi >= 80 ? 'text-red-300' : snapshot.mfi <= 20 ? 'text-green-300' : 'text-white'}>
                            {snapshot.mfi.toFixed(1)}
                        </span></p>
                        <p>CMF: <span className="text-white">{snapshot.cmf.toFixed(2)}</span></p>
                        <p>VPT: <span className="text-white">{Math.round(snapshot.vpt).toLocaleString()}</span></p>
                        <p>PVI/NVI: <span className="text-white">{snapshot.pvi.toFixed(1)} / {snapshot.nvi.toFixed(1)}</span></p>
                    </div>
                </div>
            ))}
            {entries.length === 0 && <p className="text-gray-400">{t('no_data') || 'No indicator snapshot available.'}</p>}
        </div>
    );
};

const SignalsAndAlerts: React.FC<{
    signals: VolumeSignal[];
    analysis: VolumeAnalysisResult;
    t: (key: string) => string;
}> = ({ signals, analysis, t }) => (
    <div className="space-y-6">
        <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t('volume_signals') || 'Volume Signals'}</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {signals.map(signal => (
                    <div key={signal.id} className="p-4 bg-gray-900/40 border border-gray-800 rounded-lg space-y-2">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                            <div>
                                <p className="text-white font-semibold">{signal.symbol} · {signal.timeframe.toUpperCase()}</p>
                                <p className="text-xs text-gray-400">{signal.signalType.toUpperCase()}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                signal.direction === 'bullish' ? 'bg-green-500/20 text-green-300' :
                                signal.direction === 'bearish' ? 'bg-red-500/20 text-red-300' : 'bg-gray-600/20 text-gray-200'
                            }`}>
                                {t(signal.direction) || signal.direction}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-300">
                            <p>{t('confidence') || 'Confidence'}: {signal.confidence.toFixed(1)}%</p>
                            <p>{t('volume_rvol') || 'RVOL'}: {signal.relativeVolume.toFixed(2)}x</p>
                            <p>{t('volume_strength') || 'Strength'}: {signal.volumeStrength.toFixed(2)}</p>
                            <p>{t('volume_buy_sell_ratio') || 'Buy/Sell'}: {(signal.buySellRatio * 100).toFixed(0)}%</p>
                        </div>
                        {signal.notes && <p className="text-xs text-gray-400">{signal.notes}</p>}
                    </div>
                ))}
                {signals.length === 0 && (
                    <div className="text-center text-gray-400 py-10">
                        <p>{t('no_volume_signals') || 'No volume signals yet.'}</p>
                    </div>
                )}
            </div>
        </div>
        <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t('alerts') || 'Alerts'}</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {analysis.alerts.map(alert => (
                    <div key={alert.id} className="flex justify-between border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200">
                        <div>
                            <p className="text-white font-semibold">{alert.symbol} · {t(alert.alertType) || alert.alertType}</p>
                            <p className="text-gray-400">{alert.message}</p>
                        </div>
                        <div className="text-right">
                            <span className={`px-2 py-0.5 rounded-full ${
                                alert.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                                alert.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-blue-500/20 text-blue-300'
                            }`}>
                                {t(alert.severity) || alert.severity}
                            </span>
                            <p className="text-gray-500 mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                        </div>
                    </div>
                ))}
                {analysis.alerts.length === 0 && (
                    <p className="text-center text-gray-400">{t('market_intel_alerts_none') || 'No alerts triggered.'}</p>
                )}
            </div>
        </div>
        {analysis.vsa && analysis.vsa.length > 0 && (
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">{t('volume_vsa') || 'Volume Spread Analysis (VSA)'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysis.vsa.map(vsa => (
                        <div key={`${vsa.symbol}-${vsa.timeframe}`} className="p-3 bg-gray-900/40 border border-gray-800 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-white font-semibold">{vsa.symbol} · {vsa.timeframe.toUpperCase()}</p>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                    vsa.vsaSignal === 'accumulation' ? 'bg-green-500/20 text-green-300' :
                                    vsa.vsaSignal === 'distribution' ? 'bg-red-500/20 text-red-300' :
                                    vsa.vsaSignal === 'climax' ? 'bg-yellow-500/20 text-yellow-300' :
                                    'bg-gray-500/20 text-gray-300'
                                }`}>
                                    {t(`volume_vsa_${vsa.vsaSignal}`) || vsa.vsaSignal}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                                <p>{t('volume_spread') || 'Spread'}: {vsa.spread.toFixed(2)}</p>
                                <p>{t('volume_volume') || 'Volume'}: {vsa.volume.toLocaleString()}</p>
                                <p>{t('confidence') || 'Confidence'}: {vsa.confidence}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
        {analysis.accumulationDistribution && analysis.accumulationDistribution.length > 0 && (
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">{t('volume_acc_dist') || 'Accumulation/Distribution'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysis.accumulationDistribution.map(accDist => (
                        <div key={`${accDist.symbol}-${accDist.timeframe}`} className="p-3 bg-gray-900/40 border border-gray-800 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-white font-semibold">{accDist.symbol} · {accDist.timeframe.toUpperCase()}</p>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                    accDist.signalType === 'accumulation' ? 'bg-green-500/20 text-green-300' :
                                    'bg-red-500/20 text-red-300'
                                }`}>
                                    {t(`volume_${accDist.signalType}`) || accDist.signalType}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                                <p>{t('volume_strength') || 'Strength'}: {accDist.strength.toFixed(2)}</p>
                                <p>{t('volume_price_action') || 'Price'}: {t(accDist.priceAction) || accDist.priceAction}</p>
                                <p>{t('volume_volume_confirmation') || 'Volume Conf'}: {accDist.volumeConfirmation ? '✓' : '✗'}</p>
                                <p>{t('confidence') || 'Confidence'}: {accDist.confidence}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

const Analytics: React.FC<{ analysis: VolumeAnalysisResult; t: (key: string) => string }> = ({ analysis, t }) => {
    if (!analysis.analytics) {
        return (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_data') || 'No analytics data available.'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">{t('volume_value_area_analysis') || 'Value Area Analysis'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.analytics.valueAreaAnalysis.map(item => (
                        <div key={item.symbol} className="p-4 bg-gray-900/40 border border-gray-800 rounded-lg">
                            <p className="text-white font-semibold mb-3">{item.symbol}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                                <p>POC: <span className="text-white">{item.poc.toFixed(2)}</span></p>
                                <p>VAH: <span className="text-white">{item.vah.toFixed(2)}</span></p>
                                <p>VAL: <span className="text-white">{item.val.toFixed(2)}</span></p>
                                <p>{t('volume_value_area_percent') || 'VA %'}: <span className="text-white">{item.valueAreaPercent}%</span></p>
                                <p>{t('volume_value_area_volume') || 'VA Volume'}: <span className="text-white">{item.valueAreaVolume.toLocaleString()}</span></p>
                                <p>{t('volume_total_volume') || 'Total Volume'}: <span className="text-white">{item.totalVolume.toLocaleString()}</span></p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold text-white mb-4">{t('volume_hvn_lvn_analysis') || 'HVN/LVN Analysis'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.analytics.hvnLvnAnalysis.map(item => (
                        <div key={item.symbol} className="p-4 bg-gray-900/40 border border-gray-800 rounded-lg">
                            <p className="text-white font-semibold mb-3">{item.symbol}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                                <p>{t('volume_hvn_count') || 'HVN Count'}: <span className="text-green-300">{item.hvnCount}</span></p>
                                <p>{t('volume_lvn_count') || 'LVN Count'}: <span className="text-red-300">{item.lvnCount}</span></p>
                                {item.strongestHVN && (
                                    <>
                                        <p>{t('volume_strongest_hvn') || 'Strongest HVN'}: <span className="text-white">{item.strongestHVN.price.toFixed(2)}</span></p>
                                        <p>{t('volume_volume') || 'Volume'}: <span className="text-white">{item.strongestHVN.volume.toLocaleString()}</span></p>
                                    </>
                                )}
                                {item.strongestLVN && (
                                    <>
                                        <p>{t('volume_strongest_lvn') || 'Strongest LVN'}: <span className="text-white">{item.strongestLVN.price.toFixed(2)}</span></p>
                                        <p>{t('volume_volume') || 'Volume'}: <span className="text-white">{item.strongestLVN.volume.toLocaleString()}</span></p>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold text-white mb-4">{t('volume_multi_timeframe_breakdown') || 'Multi-Timeframe Breakdown'}</h3>
                <div className="space-y-3">
                    {analysis.analytics.multiTimeframeBreakdown.map(item => (
                        <div key={item.symbol} className="p-4 bg-gray-900/40 border border-gray-800 rounded-lg">
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-white font-semibold">{item.symbol}</p>
                                <p className="text-xs text-gray-400">{t('volume_overall_agreement') || 'Overall Agreement'}: <span className="text-white">{item.overallAgreement}%</span></p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-300">
                                {item.timeframes.map(tf => (
                                    <div key={tf.timeframe} className="border border-gray-800 rounded p-2">
                                        <p className="text-white font-semibold">{tf.timeframe.toUpperCase()}</p>
                                        <p>{t('volume_rvol') || 'RVOL'}: {tf.relativeVolume.toFixed(2)}x</p>
                                        <p>{t('trend') || 'Trend'}: {t(tf.trend) || tf.trend}</p>
                                        <p>{t('volume_agreement') || 'Agreement'}: {tf.agreementScore}%</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Integration: React.FC<{
    config: VolumeAnalysisConfig;
    agent: AIAgent;
    t: (key: string) => string;
}> = ({ config, agent, t }) => (
    <div className="space-y-6">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('volume_integration_settings') || 'Integration Settings'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                    <p className="text-gray-400 mb-1">{t('volume_weight_percent') || 'Weight Percent'}</p>
                    <p className="text-white font-semibold">{config.integration.weightPercent}%</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('volume_priority') || 'Priority'}</p>
                    <p className="text-white font-semibold">{t(config.integration.priority) || config.integration.priority}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('volume_combination_mode') || 'Combination Mode'}</p>
                    <p className="text-white font-semibold">{t(config.integration.combinationMode) || config.integration.combinationMode}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('volume_forward_to') || 'Forward Signals To'}</p>
                    <p className="text-white font-semibold">{config.integration.forwardSignalsTo.length > 0 ? config.integration.forwardSignalsTo.join(', ') : t('none') || 'None'}</p>
                </div>
            </div>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('volume_automation') || 'Automation'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                    <p className="text-gray-400 mb-1">{t('volume_auto_run') || 'Auto Run'}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        config.automation.autoRun ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {config.automation.autoRun ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                    </span>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('volume_interval_minutes') || 'Interval (minutes)'}</p>
                    <p className="text-white font-semibold">{config.automation.intervalMinutes}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('volume_sync_artemis') || 'Sync with Artemis'}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        config.automation.syncWithArtemis ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {config.automation.syncWithArtemis ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                    </span>
                </div>
            </div>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('volume_agent_status') || 'Agent Status'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                    <p className="text-gray-400 mb-1">{t('status') || 'Status'}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        agent.status === 'active' ? 'bg-green-500/20 text-green-300' :
                        agent.status === 'training' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-gray-500/20 text-gray-400'
                    }`}>
                        {t(agent.status) || agent.status}
                    </span>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('accuracy') || 'Accuracy'}</p>
                    <p className="text-white font-semibold">{agent.accuracy.toFixed(1)}%</p>
                </div>
            </div>
        </div>
    </div>
);

const Settings: React.FC<{
    config: VolumeAnalysisConfig;
    disabled: boolean;
    onUpdate: (config: VolumeAnalysisConfig) => void;
    t: (key: string) => string;
}> = ({ config, disabled, onUpdate, t }) => {
    const [draft, setDraft] = useState(config);
    useEffect(() => setDraft(config), [config]);

    const updateField = <K extends keyof VolumeAnalysisConfig>(key: K, value: VolumeAnalysisConfig[K]) => {
        setDraft(prev => ({ ...prev, [key]: value }));
    };

    const updateNested = <K extends keyof VolumeAnalysisConfig, P extends keyof VolumeAnalysisConfig[K]>(
        key: K,
        prop: P,
        value: VolumeAnalysisConfig[K][P],
    ) => {
        setDraft(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] as Record<string, any>),
                [prop]: value,
            },
        }));
    };

    const handleSave = () => onUpdate(draft);

    return (
        <div className="space-y-5">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('volume_profile_settings') || 'Volume Profile'}</h3>
                <label className="block text-xs text-gray-400 mb-1">{t('tracked_symbols') || 'Symbols'}</label>
                <textarea
                    rows={2}
                    disabled={disabled}
                    value={draft.symbols.join(', ')}
                    onChange={(e) => updateField('symbols', e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberInput
                        label={t('volume_profile_rows') || 'Profile rows'}
                        value={draft.profile.rows}
                        disabled={disabled}
                        onChange={(value) => updateNested('profile', 'rows', Math.max(24, Math.min(100, value)))}
                    />
                    <NumberInput
                        label={t('volume_value_area') || 'Value area (%)'}
                        value={draft.profile.valueAreaPercent}
                        disabled={disabled}
                        onChange={(value) => updateNested('profile', 'valueAreaPercent', value)}
                    />
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('volume_filters') || 'Volume Filters'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberInput
                        label={t('volume_min_rvol') || 'Min RVOL'}
                        value={draft.filters.minRelativeVolume}
                        disabled={disabled}
                        step={0.1}
                        onChange={(value) => updateNested('filters', 'minRelativeVolume', value)}
                    />
                    <NumberInput
                        label={t('volume_min_daily') || 'Min daily volume (USD)'}
                        value={draft.filters.minDailyVolumeUsd}
                        disabled={disabled}
                        step={1000000}
                        onChange={(value) => updateNested('filters', 'minDailyVolumeUsd', value)}
                    />
                    <NumberInput
                        label={t('volume_spike_threshold') || 'Volume spike (%)'}
                        value={draft.filters.volumeSpikeThresholdPercent}
                        disabled={disabled}
                        step={10}
                        onChange={(value) => updateNested('filters', 'volumeSpikeThresholdPercent', value)}
                    />
                    <NumberInput
                        label={t('volume_min_buy_sell') || 'Min buy/sell ratio'}
                        value={draft.filters.minBuySellRatio}
                        disabled={disabled}
                        step={0.05}
                        onChange={(value) => updateNested('filters', 'minBuySellRatio', value)}
                    />
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('alerts') || 'Alerts'}</h3>
                <div className="flex flex-wrap gap-4 text-xs text-gray-300">
                    {[
                        { key: 'unusualVolume', label: t('volume_alert_unusual') || 'Unusual volume' },
                        { key: 'breakoutConfirmation', label: t('volume_alert_breakout') || 'Breakout confirmation' },
                        { key: 'smartMoneyFlow', label: t('volume_alert_smart_money') || 'Smart money flow' },
                        { key: 'buySellImbalance', label: t('volume_alert_imbalance') || 'Buy/Sell imbalance' },
                    ].map(option => (
                        <label key={option.key} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={(draft.alerts as any)[option.key]}
                                onChange={(e) => updateNested('alerts', option.key as keyof VolumeAnalysisConfig['alerts'], e.target.checked as never)}
                                className="accent-blue-500"
                            />
                            <span>{option.label}</span>
                        </label>
                    ))}
                </div>
                <label className="block text-xs text-gray-400 mt-3 mb-1">{t('volume_watchlist') || 'Watchlist'}</label>
                <textarea
                    rows={2}
                    disabled={disabled}
                    value={draft.alerts.watchlist.join(', ')}
                    onChange={(e) => updateNested('alerts', 'watchlist', e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={disabled}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
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

// ----------------------------------------------------------------------------- //
// Capabilities Section
// ----------------------------------------------------------------------------- //

const VOLUME_CAPABILITY_KEYS = [
    'volume_analysis_capability_profile',
    'volume_analysis_capability_indicators',
    'volume_analysis_capability_signals',
    'volume_analysis_capability_vsa',
    'volume_analysis_capability_hvn_lvn',
    'volume_analysis_capability_alerts',
    'volume_analysis_capability_analytics',
    'volume_analysis_capability_integration',
] as const;

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isVolumeAgent = agent.id === '14' || agent.role === 'Volume Analysis';
    const capabilityItems = isVolumeAgent
        ? VOLUME_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('volume_analysis_capability_', '').replace(/_/g, ' ');
              return {
                  key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isVolumeAgent ? (
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

export default VolumeAgentControl;

