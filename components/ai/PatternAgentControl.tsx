import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    PatternRecognitionConfig,
    PatternAnalysisResult,
    PatternMetrics,
    PatternRule,
    DetectedPattern,
} from '../../types.ts';

interface PatternAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const PatternAgentControl: React.FC<PatternAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const { guardExecution } = useAgentExecutionGate();
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'performance' | 'settings'>('overview');
    const [config, setConfig] = useState<PatternRecognitionConfig | null>(agent.patternRecognitionConfig || null);
    const [metrics, setMetrics] = useState<PatternMetrics | null>(agent.patternMetrics || null);
    const [lastAnalysis, setLastAnalysis] = useState<PatternAnalysisResult | null>(agent.lastPatternAnalysis || null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                const data = await api.fetchPatternRecognitionAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastAnalysis) setLastAnalysis(data.lastAnalysis);
            } catch (error) {
                console.error('Failed to load pattern agent data:', error);
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
            const result = await api.runPatternRecognitionAnalysis(agent.id);
            setLastAnalysis(result);
            const updatedAgents = await api.fetchAIAgents();
            const updatedAgent = updatedAgents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.patternMetrics || null);
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run pattern recognition analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: PatternRecognitionConfig) => {
        setIsLoading(true);
        try {
            await api.updatePatternRecognitionConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated successfully');
        } catch (error) {
            console.error('Failed to update pattern config:', error);
            alert(t('update_failed') || 'Failed to update configuration');
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
            console.error('Failed to execute command:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-[#161B22] border-b border-gray-800 p-6 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{agent.name} - {t('pattern_recognition') || 'Pattern Recognition'}</h2>
                        <p className="text-sm text-gray-400 mt-1">{t('pattern_recognition_desc') || 'Detects candlestick patterns and structural signals.'}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleRunAnalysis}
                            disabled={isAnalyzing || agent.status !== 'active'}
                            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isAnalyzing ? t('analyzing') : t('run_analysis')}
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
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
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
                    <nav className="flex space-x-6 px-6">
                        {(['overview', 'patterns', 'performance', 'settings'] as const).map(tab => {
                            const translation = t(`tab_${tab}`);
                            const label = (translation && translation !== `tab_${tab}`) 
                                ? translation 
                                : tab.charAt(0).toUpperCase() + tab.slice(1);
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        activeTab === tab
                                            ? 'border-amber-500 text-amber-400'
                                            : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && lastAnalysis && metrics && (
                        <PatternOverview agent={agent} analysis={lastAnalysis} metrics={metrics} t={t} />
                    )}
                    {activeTab === 'patterns' && lastAnalysis && (
                        <PatternList patterns={lastAnalysis.detectedPatterns} t={t} />
                    )}
                    {activeTab === 'performance' && metrics && (
                        <PatternPerformance metrics={metrics} t={t} />
                    )}
                    {activeTab === 'settings' && config && (
                        <PatternSettings config={config} onUpdate={handleUpdateConfig} disabled={isLoading} t={t} />
                    )}
                    {!lastAnalysis && activeTab === 'overview' && (
                        <div className="text-center text-gray-400 py-10">
                            <p>{t('no_analysis_data') || 'No pattern analyses have been executed yet.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const PatternOverview: React.FC<{ agent: AIAgent; analysis: PatternAnalysisResult; metrics: PatternMetrics; t: (key: string) => string }> = ({ agent, analysis, metrics, t }) => (
    <div className="space-y-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <p className="text-sm text-gray-400">{t('last_detection') || 'Last Detection'}</p>
                    <p className="text-white text-2xl font-semibold mt-1">{new Date(analysis.timestamp).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{analysis.summary}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-xs text-gray-400 uppercase">{t('bullish') || 'Bullish'}</p>
                        <p className="text-green-400 text-xl font-bold">{analysis.stats.bullish}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase">{t('bearish') || 'Bearish'}</p>
                        <p className="text-red-400 text-xl font-bold">{analysis.stats.bearish}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase">{t('neutral') || 'Neutral'}</p>
                        <p className="text-yellow-400 text-xl font-bold">{analysis.stats.neutral}</p>
                    </div>
                </div>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label={t('total_analyses') || 'Total Analyses'} value={metrics.totalAnalyses} />
            <MetricCard label={t('patterns_detected') || 'Patterns Detected'} value={metrics.patternsDetected} />
            <MetricCard label={t('confirmed_patterns') || 'Confirmed Patterns'} value={metrics.confirmedPatterns} />
            <MetricCard label={t('accuracy') || 'Accuracy'} value={`${metrics.accuracy.toFixed(1)}%`} />
        </div>

        {/* Agent Capabilities */}
        <CapabilitiesSection agent={agent} />
    </div>
);

const PatternList: React.FC<{ patterns: DetectedPattern[]; t: (key: string) => string }> = ({ patterns, t }) => (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
        {patterns.map(pattern => (
            <div key={pattern.id} className="p-4 bg-gray-900/40 border border-gray-800 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <p className="text-white font-semibold">{pattern.patternName}</p>
                    <p className="text-xs text-gray-400">{pattern.symbol} · {pattern.timeframe}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(pattern.detectedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className={`text-sm font-semibold ${
                            pattern.direction === 'bullish' ? 'text-green-400' : 'text-red-400'
                        }`}>
                            {t(pattern.direction) || pattern.direction}
                        </p>
                        <p className="text-xs text-gray-400">{t('confidence') || 'Confidence'}: {pattern.confidence}%</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">{t('price') || 'Price'}</p>
                        <p className="text-white font-semibold">${pattern.price.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        ))}
        {patterns.length === 0 && (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_patterns_detected') || 'No patterns detected during the last scan.'}</p>
            </div>
        )}
    </div>
);

const PatternPerformance: React.FC<{ metrics: PatternMetrics; t: (key: string) => string }> = ({ metrics, t }) => (
    <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label={t('bullish')} value={metrics.bullishPatterns} color="text-green-400" />
            <MetricCard label={t('bearish')} value={metrics.bearishPatterns} color="text-red-400" />
            <MetricCard label={t('false_signals') || 'False Signals'} value={metrics.falseSignals} color="text-yellow-400" />
        </div>
    </div>
);

const PatternSettings: React.FC<{
    config: PatternRecognitionConfig;
    onUpdate: (config: PatternRecognitionConfig) => void;
    disabled: boolean;
    t: (key: string) => string;
}> = ({ config, onUpdate, disabled, t }) => {
    const toggleRule = (rule: PatternRule, enabled: boolean) => {
        onUpdate({
            ...config,
            patternRules: config.patternRules.map(r => r.id === rule.id ? { ...r, enabled } : r),
        });
    };

    const updateMinConfidence = (value: number) => {
        onUpdate({
            ...config,
            alertSettings: {
                ...config.alertSettings,
                minConfidence: value,
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('pattern_rules') || 'Pattern Rules'}</h3>
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
                    {config.patternRules.map(rule => (
                        <div key={rule.id} className="flex items-start justify-between p-3 bg-gray-800/40 border border-gray-700 rounded-lg">
                            <div>
                                <p className="text-white font-semibold">{rule.name}</p>
                                <p className="text-xs text-gray-400">{rule.description}</p>
                                <p className="text-xs text-gray-500 mt-1">{t('min_reliability') || 'Min reliability'}: {(rule.minReliability * 100).toFixed(0)}%</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={rule.enabled}
                                    disabled={disabled}
                                    onChange={(e) => toggleRule(rule, e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('alert_thresholds') || 'Alert Thresholds'}</h3>
                <label className="block text-sm text-gray-400 mb-2">{t('min_confidence') || 'Min confidence (%)'}</label>
                <input
                    type="number"
                    min={0}
                    max={100}
                    value={config.alertSettings.minConfidence}
                    onChange={(e) => updateMinConfidence(parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                />
            </div>
        </div>
    );
};

const MetricCard: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color = 'text-white' }) => (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
);

// ----------------------------------------------------------------------------- //
// Capabilities Section
// ----------------------------------------------------------------------------- //

const PATTERN_CAPABILITY_KEYS = [
    'pattern_capability_detection',
    'pattern_capability_breakout_visuals',
    'pattern_capability_detection_score',
    'pattern_capability_multitimeframe',
    'pattern_capability_history_stats',
    'pattern_capability_customization',
    'pattern_capability_integrations',
    'pattern_capability_trade_signals',
] as const;

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isPatternAgent = agent.id === '4' || agent.role === 'Pattern Recognition';
    const capabilityItems = isPatternAgent
        ? PATTERN_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('pattern_capability_', '').replace(/_/g, ' ');
              return {
                  key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isPatternAgent ? (
                <ul className="space-y-3 text-sm text-gray-300">
                    {capabilityItems.map(item => (
                        <li key={item.key} className="flex gap-3 items-start">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {capabilityItems.map(item => (
                        <span key={item.key} className="bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-sm">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PatternAgentControl;

