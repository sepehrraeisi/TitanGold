import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    TimingAnalysisConfig,
    TimingAnalysisMetrics,
    TimingAnalysisResult,
    TimingSignal,
} from '../../types.ts';

type TimingTab = 'overview' | 'signal_stream' | 'indicators' | 'multi_timeframe_check' | 'performance' | 'settings' | 'integration';

interface Props {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const TimingAgentControl: React.FC<Props> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<TimingTab>('overview');
    const [config, setConfig] = useState<TimingAnalysisConfig | null>(agent.timingAnalysisConfig || null);
    const [metrics, setMetrics] = useState<TimingAnalysisMetrics | null>(agent.timingMetrics || null);
    const [analysis, setAnalysis] = useState<TimingAnalysisResult | null>(agent.lastTimingAnalysis || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchTimingAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastAnalysis) setAnalysis(data.lastAnalysis);
            } catch (error) {
                console.error('Failed to load timing agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [agent.id]);

    const signals = useMemo<TimingSignal[]>(() => analysis?.signals ?? [], [analysis]);

    const handleRunAnalysis = async () => {
        setIsRunning(true);
        try {
            const result = await api.runTimingAnalysis(agent.id);
            setAnalysis(result);
            const agents = await api.fetchAIAgents();
            const updated = agents.find(a => a.id === agent.id);
            if (updated) {
                setMetrics(updated.timingMetrics || null);
                setConfig(updated.timingAnalysisConfig || null);
                onUpdate(updated);
            }
        } catch (error) {
            console.error('Failed to run timing analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsRunning(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: TimingAnalysisConfig) => {
        setIsLoading(true);
        try {
            await api.updateTimingAnalysisConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated');
        } catch (error) {
            console.error('Failed to update timing config:', error);
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
            if (updated) onUpdate(updated);
        } catch (error) {
            console.error('Failed to run command:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsLoading(false);
        }
    };

    const tabs: TimingTab[] = ['overview', 'signal_stream', 'indicators', 'multi_timeframe_check', 'performance', 'settings', 'integration'];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
                <TimingHeader
                    agent={agent}
                    t={t}
                    isRunning={isRunning}
                    onRun={handleRunAnalysis}
                    onClose={onClose}
                    onCommand={handleControlCommand}
                />

                <div className="border-b border-gray-800 overflow-x-auto">
                    <nav className="flex space-x-6 px-6 min-w-max">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab
                                        ? 'border-sky-500 text-sky-400'
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                }`}
                            >
                                {t(`timing_tab_${tab}`) || tab}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && analysis && (
                        <TimingOverview analysis={analysis} metrics={metrics} t={t} />
                    )}
                    {activeTab === 'signal_stream' && (
                        <TimingSignalStream signals={signals} analysis={analysis} t={t} />
                    )}
                    {activeTab === 'indicators' && analysis && (
                        <TimingIndicators analysis={analysis} t={t} />
                    )}
                    {activeTab === 'multi_timeframe_check' && analysis && (
                        <TimingMultiTimeframe analysis={analysis} t={t} />
                    )}
                    {activeTab === 'performance' && analysis && (
                        <TimingPerformance analysis={analysis} metrics={metrics} t={t} />
                    )}
                    {activeTab === 'settings' && config && (
                        <TimingSettings config={config} disabled={isLoading} onUpdate={handleUpdateConfig} t={t} />
                    )}
                    {activeTab === 'integration' && config && (
                        <TimingIntegration config={config} agent={agent} t={t} />
                    )}
                    {!analysis && activeTab === 'overview' && (
                        <div className="text-center text-gray-400 py-10">
                            {t('no_timing_data') || 'No timing analyses executed yet.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TimingHeader: React.FC<{
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
                {agent.name} - {t('timing_agent') || 'Timing Agent'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
                {t('timing_agent_desc') || 'Optimizes entry/exit timing across multi-timeframe indicator mixes.'}
            </p>
        </div>
        <div className="flex gap-3 flex-wrap">
            <button
                onClick={onRun}
                disabled={isRunning || agent.status !== 'active'}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
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
        <div className="flex flex-wrap justify-between w-full text-sm text-gray-400 mt-4 gap-3">
            <div className="flex items-center gap-4 flex-wrap">
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

const TimingOverview: React.FC<{
    analysis: TimingAnalysisResult;
    metrics: TimingAnalysisMetrics | null;
    t: (key: string) => string;
}> = ({ analysis, metrics, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label={t('timing_entry_accuracy') || 'Entry accuracy'} value={`${analysis.performance.entryAccuracy.toFixed(1)}%`} />
            <MetricCard label={t('timing_exit_accuracy') || 'Exit accuracy'} value={`${analysis.performance.exitAccuracy.toFixed(1)}%`} />
            <MetricCard label={t('timing_avg_hold') || 'Avg hold'} value={`${analysis.performance.avgHoldMinutes}m`} />
            <MetricCard label={t('timing_missed_opportunities') || 'Missed opportunity rate'} value={`${analysis.performance.missedOpportunityRate}%`} />
            <MetricCard label={t('timing_avg_slippage') || 'Avg slippage'} value={`${analysis.performance.avgSlippageBps} bps`} />
            <MetricCard label={t('timing_active_countdowns') || 'Active countdowns'} value={analysis.activeCountdowns.length} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('timing_active_countdowns') || 'Active countdowns'}</h3>
                {analysis.activeCountdowns.length ? (
                    <div className="space-y-2 text-xs text-gray-200 max-h-56 overflow-y-auto pr-2">
                        {analysis.activeCountdowns.map(countdown => (
                            <div key={`${countdown.symbol}-${countdown.expiresAt}`} className="flex justify-between border border-gray-800 rounded px-3 py-2">
                                <div>
                                    <p className="text-white font-semibold">{countdown.symbol}</p>
                                    <p className="text-gray-400">{t(countdown.signalType) || countdown.signalType}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-blue-300 font-semibold">{Math.max(0, Math.round(countdown.remainingSeconds / 60))}m</p>
                                    <p className="text-gray-500">{new Date(countdown.expiresAt).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-xs">{t('no_data') || 'No countdowns available.'}</p>
                )}
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('timing_timeline') || 'Signal timeline'}</h3>
                <div className="space-y-2 text-xs text-gray-200 max-h-56 overflow-y-auto pr-2">
                    {analysis.timeline.map(entry => (
                        <div key={entry.timestamp} className="flex justify-between border border-gray-800 rounded px-3 py-2">
                            <span className="text-gray-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                            <div className="flex gap-3">
                                <span className="text-green-300">E: {entry.entrySignals}</span>
                                <span className="text-red-300">X: {entry.exitSignals}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {metrics && (
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('timing_performance_snapshot') || 'Performance snapshot'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
                    <p>{t('timing_runs_total') || 'Total runs'}: <span className="text-white font-semibold">{metrics.totalRuns}</span></p>
                    <p>{t('timing_signals_generated') || 'Signals generated'}: <span className="text-white font-semibold">{metrics.signalsGenerated}</span></p>
                    <p>{t('timing_active_countdowns') || 'Active countdowns'}: {metrics.activeCountdowns}</p>
                    <p>{t('timing_avg_slippage') || 'Avg slippage'}: {metrics.avgSlippageBps.toFixed(1)} bps</p>
                </div>
            </div>
        )}
    </div>
);

const TimingSignalStream: React.FC<{
    signals: TimingSignal[];
    analysis: TimingAnalysisResult | null;
    t: (key: string) => string;
}> = ({ signals, analysis, t }) => (
    <div className="space-y-6">
        <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t('timing_entry_exit_signals') || 'Entry/Exit Signals'}</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {signals.map(signal => (
                    <div key={signal.id} className="p-4 bg-gray-900/40 border border-gray-800 rounded-lg space-y-2">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                            <div>
                                <p className="text-white font-semibold">{signal.symbol} · {signal.timeframe.toUpperCase()}</p>
                                <p className="text-xs text-gray-400">{t(signal.signalType) || signal.signalType}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                signal.signalType === 'entry' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                            }`}>
                                {t(signal.signalType) || signal.signalType}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-300">
                            <p>{t('price') || 'Price'}: <span className="text-white font-semibold">{signal.price.toFixed(2)}</span></p>
                            <p>{t('confidence') || 'Confidence'}: {signal.confidence.toFixed(1)}%</p>
                            <p>{t('timing_confirmation_score') || 'Confirmation'}: {signal.confirmationScore}%</p>
                            <p>{t('timing_hold_minutes') || 'Hold'}: {signal.holdMinutes}m</p>
                            <p>{t('timing_avg_slippage') || 'Slippage'}: {signal.slippageBps?.toFixed(1)} bps</p>
                            <p>{t('take_profit') || 'Target'}: {signal.recommendedExit?.toFixed(2)}</p>
                            <p>{t('timing_status') || 'Status'}: <span className="text-white">{t(signal.status) || signal.status}</span></p>
                        </div>
                        {signal.notes && <p className="text-xs text-gray-400">{signal.notes}</p>}
                    </div>
                ))}
                {signals.length === 0 && (
                    <div className="text-center text-gray-400 py-10">
                        {t('timing_no_signals') || 'No timing signals yet.'}
                    </div>
                )}
            </div>
        </div>
        {analysis && analysis.alerts.length > 0 && (
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">{t('alerts') || 'Alerts'}</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 text-xs text-gray-200">
                    {analysis.alerts.map(alert => (
                        <div key={alert.id} className="flex justify-between border border-gray-800 rounded px-3 py-2">
                            <div>
                                <p className="text-white font-semibold">{alert.symbol}</p>
                                <p>{alert.message}</p>
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
                </div>
            </div>
        )}
    </div>
);

const TimingIndicators: React.FC<{ analysis: TimingAnalysisResult; t: (key: string) => string }> = ({ analysis, t }) => {
    const entries = Object.entries(analysis.indicators);
    return entries.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map(([key, snapshot]) => (
                <div key={key} className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 space-y-2 text-xs text-gray-300">
                    <div className="flex justify-between text-white font-semibold">
                        <span>{key.replace('_', ' · ')}</span>
                        <span className="text-gray-400">{t(snapshot.maTrend) || snapshot.maTrend}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <p>MA: <span className="text-white">{snapshot.fastMA.toFixed(2)}</span> / {snapshot.slowMA.toFixed(2)}</p>
                        <p>RSI: <span className="text-white">{snapshot.rsi.toFixed(1)}</span></p>
                        <p>MACD: <span className="text-white">{snapshot.macd.toFixed(2)}</span></p>
                        <p>Signal: <span className="text-white">{snapshot.macdSignal.toFixed(2)}</span></p>
                        <p>BB: <span className="text-white">{snapshot.bbLower.toFixed(2)} - {snapshot.bbUpper.toFixed(2)}</span></p>
                        <p>ATR: <span className="text-white">{snapshot.atr.toFixed(2)}</span></p>
                    </div>
                </div>
            ))}
        </div>
    ) : (
        <p className="text-gray-400 text-sm text-center">{t('no_data') || 'No indicator snapshots available.'}</p>
    );
};

const TimingPerformance: React.FC<{
    analysis: TimingAnalysisResult;
    metrics: TimingAnalysisMetrics | null;
    t: (key: string) => string;
}> = ({ analysis, metrics, t }) => (
    <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label={t('timing_entry_accuracy') || 'Entry accuracy'} value={`${analysis.performance.entryAccuracy.toFixed(1)}%`} />
            <MetricCard label={t('timing_exit_accuracy') || 'Exit accuracy'} value={`${analysis.performance.exitAccuracy.toFixed(1)}%`} />
            <MetricCard label={t('timing_avg_hold') || 'Avg hold'} value={`${analysis.performance.avgHoldMinutes}m`} />
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('timing_duration_distribution') || 'Trade duration distribution'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-200">
                {analysis.performance.tradeDurationDistribution.map(item => (
                    <div key={item.label} className="border border-gray-800 rounded px-3 py-2 flex justify-between">
                        <span>{item.label}</span>
                        <span className="text-white font-semibold">{item.count}</span>
                    </div>
                ))}
            </div>
        </div>

        {metrics && (
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('timing_timeframe_performance') || 'Timeframe performance'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-200">
                    {metrics.timeframeStats.map(item => (
                        <div key={item.timeframe} className="border border-gray-800 rounded px-3 py-2 flex justify-between">
                            <span>{item.timeframe.toUpperCase()}</span>
                            <span className="text-green-300">{Math.round(item.entryAccuracy)}% / {Math.round(item.exitAccuracy)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

const TimingMultiTimeframe: React.FC<{ analysis: TimingAnalysisResult; t: (key: string) => string }> = ({ analysis, t }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
        {analysis.multiTimeframe.map(entry => (
            <div key={`${entry.symbol}-${entry.timeframe}`} className="border border-gray-800 rounded-lg p-3 flex justify-between">
                <div>
                    <p className="text-white font-semibold">{entry.symbol}</p>
                    <p>{entry.timeframe.toUpperCase()}</p>
                </div>
                <div className="text-right">
                    <p>{t('timing_confirmation_score') || 'Confirmation'}: {entry.confirmation}%</p>
                    <p>{t('timing_relative_volume') || 'Relative volume'}: {entry.relativeVolume.toFixed(2)}x</p>
                    <p>{t(entry.trend) || entry.trend}</p>
                </div>
            </div>
        ))}
        {analysis.multiTimeframe.length === 0 && (
            <p className="text-gray-400">{t('no_data') || 'No multi-timeframe data yet.'}</p>
        )}
    </div>
);

const TimingIntegration: React.FC<{
    config: TimingAnalysisConfig;
    agent: AIAgent;
    t: (key: string) => string;
}> = ({ config, agent, t }) => (
    <div className="space-y-6">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('timing_integration_settings') || 'Integration Settings'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_indicator_mix') || 'Indicator Mix'}</p>
                    <p className="text-white font-semibold">{t(config.indicatorMix) || config.indicatorMix}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_confirmation_score') || 'Confirmation Score'}</p>
                    <p className="text-white font-semibold">{config.confirmationScore}%</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_hold_minutes') || 'Hold Time (minutes)'}</p>
                    <p className="text-white font-semibold">{config.holdTimeMinutes}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_max_slippage') || 'Max Slippage (bps)'}</p>
                    <p className="text-white font-semibold">{config.maxSlippageBps}</p>
                </div>
            </div>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('timing_automation') || 'Automation'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_auto_execute') || 'Auto Execute'}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        config.automation.autoExecute ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {config.automation.autoExecute ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                    </span>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_require_confirmation') || 'Require Confirmation'}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        config.automation.requireConfirmation ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {config.automation.requireConfirmation ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                    </span>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_sync_volume') || 'Sync with Volume Agent'}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        config.automation.syncWithVolumeAgent ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {config.automation.syncWithVolumeAgent ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                    </span>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_schedule') || 'Schedule'}</p>
                    <p className="text-white font-semibold">{t(config.automation.schedule) || config.automation.schedule}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_confirmation_candles') || 'Confirmation Candles'}</p>
                    <p className="text-white font-semibold">{config.automation.confirmationCandles}</p>
                </div>
            </div>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('timing_agent_status') || 'Agent Status'}</h3>
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
                <div>
                    <p className="text-gray-400 mb-1">{t('decisions') || 'Decisions'}</p>
                    <p className="text-white font-semibold">{agent.decisions.toLocaleString()}</p>
                </div>
            </div>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('timing_alert_channels') || 'Alert Channels'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_channel_dashboard') || 'Dashboard'}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        config.alerts.channels.dashboard ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {config.alerts.channels.dashboard ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                    </span>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_channel_email') || 'Email'}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        config.alerts.channels.email ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {config.alerts.channels.email ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                    </span>
                </div>
                <div>
                    <p className="text-gray-400 mb-1">{t('timing_channel_telegram') || 'Telegram'}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        config.alerts.channels.telegram ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {config.alerts.channels.telegram ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                    </span>
                </div>
            </div>
        </div>
    </div>
);

const TimingSettings: React.FC<{
    config: TimingAnalysisConfig;
    disabled: boolean;
    onUpdate: (config: TimingAnalysisConfig) => void;
    t: (key: string) => string;
}> = ({ config, disabled, onUpdate, t }) => {
    const [draft, setDraft] = useState(config);
    useEffect(() => setDraft(config), [config]);

    const updateField = <K extends keyof TimingAnalysisConfig>(key: K, value: TimingAnalysisConfig[K]) => {
        setDraft(prev => ({ ...prev, [key]: value }));
    };

    const updateNested = <K extends keyof TimingAnalysisConfig, P extends keyof TimingAnalysisConfig[K]>(
        key: K,
        prop: P,
        value: TimingAnalysisConfig[K][P],
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
                <h3 className="text-lg font-semibold text-white">{t('timing_settings_title') || 'Timing settings'}</h3>
                <label className="block text-xs text-gray-400 mb-1">{t('timing_symbols') || 'Symbols'}</label>
                <textarea
                    rows={2}
                    disabled={disabled}
                    value={draft.symbols.join(', ')}
                    onChange={(e) => updateField('symbols', e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
                <label className="block text-xs text-gray-400 mb-1">{t('timing_timeframes') || 'Timeframes'}</label>
                <textarea
                    rows={2}
                    disabled={disabled}
                    value={draft.timeframes.join(', ')}
                    onChange={(e) => updateField('timeframes', e.target.value.split(',').map(s => s.trim()) as TimingAnalysisConfig['timeframes'])}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <NumberInput
                        label={t('timing_confirmation_score') || 'Confirmation score'}
                        value={draft.confirmationScore}
                        disabled={disabled}
                        onChange={(value) => updateField('confirmationScore', value)}
                    />
                    <NumberInput
                        label={t('timing_hold_minutes') || 'Hold minutes'}
                        value={draft.holdTimeMinutes}
                        disabled={disabled}
                        onChange={(value) => updateField('holdTimeMinutes', value)}
                    />
                    <NumberInput
                        label={t('timing_max_slippage') || 'Max slippage (bps)'}
                        value={draft.maxSlippageBps}
                        disabled={disabled}
                        onChange={(value) => updateField('maxSlippageBps', value)}
                    />
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('timing_indicator_mix') || 'Indicator mix'}</h3>
                <select
                    disabled={disabled}
                    value={draft.indicatorMix}
                    onChange={(e) => updateField('indicatorMix', e.target.value as TimingAnalysisConfig['indicatorMix'])}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                >
                    <option value="ma_rsi">MA + RSI</option>
                    <option value="macd_bb">MACD + Bollinger</option>
                    <option value="hybrid">Hybrid</option>
                </select>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-300">
                    <NumberInput
                        label="Fast MA"
                        value={draft.indicators.movingAverages.fast}
                        disabled={disabled}
                        onChange={(value) => updateNested('indicators', 'movingAverages', { ...draft.indicators.movingAverages, fast: value })}
                    />
                    <NumberInput
                        label="Slow MA"
                        value={draft.indicators.movingAverages.slow}
                        disabled={disabled}
                        onChange={(value) => updateNested('indicators', 'movingAverages', { ...draft.indicators.movingAverages, slow: value })}
                    />
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('timing_automation') || 'Automation'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
                    <Checkbox
                        label={t('timing_auto_execute') || 'Auto execute'}
                        disabled={disabled}
                        checked={draft.automation.autoExecute}
                        onChange={(checked) => updateNested('automation', 'autoExecute', checked)}
                    />
                    <Checkbox
                        label={t('timing_require_confirmation') || 'Require confirmation'}
                        disabled={disabled}
                        checked={draft.automation.requireConfirmation}
                        onChange={(checked) => updateNested('automation', 'requireConfirmation', checked)}
                    />
                    <Checkbox
                        label={t('timing_sync_volume') || 'Sync with volume agent'}
                        disabled={disabled}
                        checked={draft.automation.syncWithVolumeAgent}
                        onChange={(checked) => updateNested('automation', 'syncWithVolumeAgent', checked)}
                    />
                    <NumberInput
                        label={t('timing_confirmation_candles') || 'Confirmation candles'}
                        value={draft.automation.confirmationCandles}
                        disabled={disabled}
                        onChange={(value) => updateNested('automation', 'confirmationCandles', value)}
                    />
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('timing_alert_preferences') || 'Alert preferences'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
                    <Checkbox
                        label={t('timing_entry_alerts') || 'Entry alerts'}
                        disabled={disabled}
                        checked={draft.alerts.entryAlerts}
                        onChange={(checked) => updateNested('alerts', 'entryAlerts', checked)}
                    />
                    <Checkbox
                        label={t('timing_exit_alerts') || 'Exit alerts'}
                        disabled={disabled}
                        checked={draft.alerts.exitAlerts}
                        onChange={(checked) => updateNested('alerts', 'exitAlerts', checked)}
                    />
                    <Checkbox
                        label={t('timing_volatility_alerts') || 'Volatility alerts'}
                        disabled={disabled}
                        checked={draft.alerts.volatilityAlerts}
                        onChange={(checked) => updateNested('alerts', 'volatilityAlerts', checked)}
                    />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-300">
                    {[
                        { key: 'dashboard', label: t('timing_channel_dashboard') || 'Dashboard' },
                        { key: 'email', label: t('timing_channel_email') || 'Email' },
                        { key: 'telegram', label: t('timing_channel_telegram') || 'Telegram' },
                    ].map(channel => (
                        <label key={channel.key} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={(draft.alerts.channels as any)[channel.key]}
                                onChange={(e) =>
                                    updateNested('alerts', 'channels', {
                                        ...draft.alerts.channels,
                                        [channel.key]: e.target.checked,
                                    })
                                }
                                className="accent-sky-500"
                            />
                            <span>{channel.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={disabled}
                    className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
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
}> = ({ label, value, disabled, onChange }) => (
    <div>
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        <input
            type="number"
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

const Checkbox: React.FC<{
    label: string;
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}> = ({ label, checked, disabled, onChange }) => (
    <label className="flex items-center gap-2">
        <input
            type="checkbox"
            disabled={disabled}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-sky-500"
        />
        <span className="text-xs text-gray-300">{label}</span>
    </label>
);

const MetricCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
    </div>
);

export default TimingAgentControl;

