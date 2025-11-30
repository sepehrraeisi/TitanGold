import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type { AIAgent, TechnicalAnalysisConfig, TechnicalIndicator, Timeframe, TechnicalAnalysisResult, AgentPerformanceMetrics } from '../../types.ts';

interface TechnicalAnalysisAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (updatedAgent: AIAgent) => void;
}

const TechnicalAnalysisAgentControl: React.FC<TechnicalAnalysisAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'indicators' | 'strategies' | 'performance' | 'settings'>('overview');
    const [config, setConfig] = useState<TechnicalAnalysisConfig | null>(agent.technicalAnalysisConfig || null);
    const [performance, setPerformance] = useState<AgentPerformanceMetrics | null>(agent.performanceMetrics || null);
    const [lastAnalysis, setLastAnalysis] = useState<TechnicalAnalysisResult | null>(agent.lastAnalysis || null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        // Initialize config if not exists
        if (!config && agent.id === '1') {
            // Agent 1 is Technical Analysis - initialize default config
            const defaultConfig: TechnicalAnalysisConfig = {
                enabledIndicators: [
                    { id: 'rsi', name: 'RSI', enabled: true, parameters: { period: 14 }, weight: 20 },
                    { id: 'macd', name: 'MACD', enabled: true, parameters: { fast: 12, slow: 26, signal: 9 }, weight: 25 },
                    { id: 'ema', name: 'EMA', enabled: true, parameters: { period: 50 }, weight: 15 },
                    { id: 'bb', name: 'Bollinger Bands', enabled: true, parameters: { period: 20, stdDev: 2 }, weight: 20 },
                    { id: 'volume', name: 'Volume', enabled: true, parameters: {}, weight: 10 },
                    { id: 'stoch', name: 'Stochastic', enabled: false, parameters: { k: 14, d: 3 }, weight: 10 },
                ],
                timeframes: ['1h', '4h', '1d'] as Timeframe[],
                riskLevel: 'medium',
                minConfidence: 70,
                maxPositions: 5,
                autoTrading: false,
                notificationSettings: {
                    onSignal: true,
                    onAlert: true,
                    onError: true,
                },
                advancedSettings: {
                    useMachineLearning: true,
                    useDeepLearning: false,
                    ensembleMode: true,
                    realTimeAnalysis: true,
                },
            };
            setConfig(defaultConfig);
        }
        loadAgentData();
    }, [agent.id]);

    const loadAgentData = async () => {
        setIsLoading(true);
        try {
            const agentData = await api.fetchTechnicalAnalysisAgentData(agent.id);
            if (agentData.config) setConfig(agentData.config);
            if (agentData.performance) setPerformance(agentData.performance);
            if (agentData.lastAnalysis) setLastAnalysis(agentData.lastAnalysis);
        } catch (error) {
            console.error('Failed to load agent data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRunAnalysis = async (symbol?: string, timeframe?: Timeframe) => {
        setIsAnalyzing(true);
        try {
            const result = await api.runTechnicalAnalysis(agent.id, symbol, timeframe);
            setLastAnalysis(result);
            // Refresh agent data
            await loadAgentData();
            const updatedAgents = await api.fetchAIAgents();
            const currentAgent = updatedAgents.find(a => a.id === agent.id);
            if (currentAgent) {
                onUpdate(currentAgent);
            }
        } catch (error) {
            console.error('Failed to run analysis:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert((t('analysis_failed') || 'Analysis failed') + (errorMessage ? `: ${errorMessage}` : ''));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: TechnicalAnalysisConfig) => {
        setIsLoading(true);
        try {
            await api.updateTechnicalAnalysisConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated successfully');
        } catch (error) {
            console.error('Failed to update config:', error);
            alert(t('update_failed') || 'Failed to update configuration');
        } finally {
            setIsLoading(false);
        }
    };

    const handleControlCommand = async (command: string) => {
        setIsLoading(true);
        try {
            await api.sendAgentControlCommand(agent.id, command);
            // Refresh agent
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

    // Always render the modal - config will be initialized in useEffect or loaded from API
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-[#161B22] border-b border-gray-800 p-6 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{agent.name} - {t('technical_analysis')}</h2>
                        <p className="text-sm text-gray-400 mt-1">{agent.role}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleRunAnalysis}
                            disabled={isAnalyzing || agent.status !== 'active'}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
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

                {/* Status Bar */}
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

                {/* Tabs */}
                <div className="border-b border-gray-800">
                    <nav className="flex space-x-6 px-6">
                        {(['overview', 'indicators', 'strategies', 'performance', 'learning', 'settings'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab
                                        ? 'border-purple-500 text-purple-400'
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                }`}
                            >
                                {t(`tab_${tab}`) || (tab.charAt(0).toUpperCase() + tab.slice(1))}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'overview' && (
                        <OverviewTab
                            agent={agent}
                            lastAnalysis={lastAnalysis}
                            performance={performance}
                            config={config}
                        />
                    )}
                    {activeTab === 'indicators' && (
                        config ? (
                            <IndicatorsTab
                                config={config}
                                onUpdate={(updated) => handleUpdateConfig(updated)}
                            />
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <p>{t('loading') || 'Loading configuration...'}</p>
                            </div>
                        )
                    )}
                    {activeTab === 'strategies' && (
                        config ? (
                            <StrategiesTab
                                config={config}
                                onUpdate={(updated) => handleUpdateConfig(updated)}
                            />
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <p>{t('loading') || 'Loading configuration...'}</p>
                            </div>
                        )
                    )}
                    {activeTab === 'performance' && (
                        <PerformanceTab performance={performance} />
                    )}
                    {activeTab === 'learning' && (
                        <LearningTab agent={agent} />
                    )}
                    {activeTab === 'settings' && (
                        config ? (
                            <SettingsTab
                                config={config}
                                onUpdate={(updated) => handleUpdateConfig(updated)}
                            />
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <p>{t('loading') || 'Loading configuration...'}</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

// Overview Tab Component
const TECHNICAL_CAPABILITY_KEYS = [
    'technical_capability_trend',
    'technical_capability_patterns',
    'technical_capability_indicators',
    'technical_capability_entry_exit',
    'technical_capability_divergence',
    'technical_capability_support_resistance',
    'technical_capability_customization',
    'technical_capability_alerts',
] as const;

const OverviewTab: React.FC<{
    agent: AIAgent;
    lastAnalysis: TechnicalAnalysisResult | null;
    performance: AgentPerformanceMetrics | null;
    config: TechnicalAnalysisConfig | null;
}> = ({ agent, lastAnalysis, performance, config }) => {
    const { t } = useLanguage();
    
    return (
        <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    label={t('total_signals') || 'Total Signals'}
                    value={performance?.totalSignals || 0}
                    icon="📊"
                />
                <StatCard
                    label={t('win_rate') || 'Win Rate'}
                    value={`${(performance?.winRate || 0).toFixed(1)}%`}
                    icon="🎯"
                />
                <StatCard
                    label={t('avg_confidence') || 'Avg Confidence'}
                    value={`${(performance?.averageConfidence || 0).toFixed(1)}%`}
                    icon="💎"
                />
                <StatCard
                    label={t('active_indicators') || 'Active Indicators'}
                    value={config?.enabledIndicators.filter(i => i.enabled).length || 0}
                    icon="⚙️"
                />
            </div>

            {/* Last Analysis Result */}
            {lastAnalysis && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white">{t('last_analysis') || 'Last Analysis'}</h3>
                        <span className="text-xs text-gray-400">
                            {new Date(lastAnalysis.timestamp).toLocaleString()}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <p className="text-sm text-gray-400 mb-1">{t('symbol') || 'Symbol'}</p>
                            <p className="text-white font-semibold">{lastAnalysis.symbol}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400 mb-1">{t('timeframe') || 'Timeframe'}</p>
                            <p className="text-white font-semibold">{lastAnalysis.timeframe}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400 mb-1">{t('signal') || 'Signal'}</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                lastAnalysis.signal === 'buy' ? 'bg-green-500/20 text-green-400' :
                                lastAnalysis.signal === 'sell' ? 'bg-red-500/20 text-red-400' :
                                'bg-gray-500/20 text-gray-400'
                            }`}>
                                {t(lastAnalysis.signal) || lastAnalysis.signal.toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400 mb-1">{t('confidence') || 'Confidence'}</p>
                            <p className="text-white font-semibold">{lastAnalysis.confidence.toFixed(1)}%</p>
                        </div>
                        {lastAnalysis.priceTarget && (
                            <>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{t('entry_price') || 'Entry'}</p>
                                    <p className="text-white font-semibold">${lastAnalysis.priceTarget.entry.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{t('stop_loss') || 'Stop Loss'}</p>
                                    <p className="text-red-400 font-semibold">${lastAnalysis.priceTarget.stopLoss.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{t('take_profit') || 'Take Profit'}</p>
                                    <p className="text-green-400 font-semibold">${lastAnalysis.priceTarget.takeProfit.toFixed(2)}</p>
                                </div>
                            </>
                        )}
                    </div>
                    {lastAnalysis.indicators && lastAnalysis.indicators.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm text-gray-400 mb-2">{t('indicator_signals') || 'Indicator Signals'}</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {lastAnalysis.indicators.map((ind, idx) => (
                                    <div key={idx} className="p-2 bg-gray-800/50 rounded text-xs">
                                        <p className="text-white font-semibold">{ind.indicatorId}</p>
                                        <p className="text-gray-400">
                                            {t(ind.signal) || ind.signal} ({ind.value.toFixed(2)})
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {lastAnalysis.reasoning && (
                        <div className="mt-4">
                            <p className="text-sm text-gray-400 mb-2">{t('reasoning') || 'Reasoning'}</p>
                            <p className="text-white text-sm bg-gray-800/50 p-3 rounded">{lastAnalysis.reasoning}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Agent Capabilities */}
            <CapabilitiesSection agent={agent} />
        </div>
    );
};

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isTechnicalAgent = agent.id === '1' || agent.role === 'Technical Analysis';
    const capabilityItems = isTechnicalAgent
        ? TECHNICAL_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              // Check if translation was found (if t returns the key itself, translation not found)
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('technical_capability_', '').replace(/_/g, ' ');
              return {
              key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isTechnicalAgent ? (
                <ul className="space-y-3 text-sm text-gray-300">
                    {capabilityItems.map(item => (
                        <li key={item.key} className="flex gap-3 items-start">
                            <span className="text-purple-400 mt-0.5">•</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {capabilityItems.map(item => (
                        <span key={item.key} className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// Indicators Tab Component
const IndicatorsTab: React.FC<{
    config: TechnicalAnalysisConfig;
    onUpdate: (config: TechnicalAnalysisConfig) => void;
}> = ({ config, onUpdate }) => {
    const { t } = useLanguage();
    
    const toggleIndicator = (indicatorId: string) => {
        const updated = {
            ...config,
            enabledIndicators: config.enabledIndicators.map(ind =>
                ind.id === indicatorId ? { ...ind, enabled: !ind.enabled } : ind
            ),
        };
        onUpdate(updated);
    };

    const updateIndicatorWeight = (indicatorId: string, weight: number) => {
        const updated = {
            ...config,
            enabledIndicators: config.enabledIndicators.map(ind =>
                ind.id === indicatorId ? { ...ind, weight: Math.max(0, Math.min(100, weight)) } : ind
            ),
        };
        onUpdate(updated);
    };

    const toggleTimeframe = (timeframe: Timeframe) => {
        const updated = {
            ...config,
            timeframes: config.timeframes.includes(timeframe)
                ? config.timeframes.filter(t => t !== timeframe)
                : [...config.timeframes, timeframe],
        };
        onUpdate(updated);
    };

    const availableTimeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

    return (
        <div className="space-y-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('technical_indicators') || 'Technical Indicators'}</h3>
                <div className="space-y-3">
                    {config.enabledIndicators.map(indicator => (
                        <div key={indicator.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={indicator.enabled}
                                        onChange={() => toggleIndicator(indicator.id)}
                                        className="rounded"
                                    />
                                    <div>
                                        <p className="text-white font-semibold">{indicator.name}</p>
                                        <p className="text-xs text-gray-400">
                                            {Object.entries(indicator.parameters).length > 0
                                                ? Object.entries(indicator.parameters).map(([key, value]) => `${key}: ${value}`).join(', ')
                                                : t('no_parameters') || 'No parameters'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-sm text-gray-400">{t('weight') || 'Weight'}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={indicator.weight}
                                    onChange={(e) => updateIndicatorWeight(indicator.id, parseFloat(e.target.value) || 0)}
                                    className="w-20 p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                />
                                <span className="text-xs text-gray-400">%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('timeframes') || 'Timeframes'}</h3>
                <div className="flex flex-wrap gap-2">
                    {availableTimeframes.map(timeframe => (
                        <button
                            key={timeframe}
                            onClick={() => toggleTimeframe(timeframe)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                config.timeframes.includes(timeframe)
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            {timeframe}
                        </button>
                    ))}
                </div>
                {config.timeframes.length === 0 && (
                    <p className="text-xs text-yellow-400 mt-2">{t('at_least_one_timeframe') || 'At least one timeframe must be selected'}</p>
                )}
            </div>
        </div>
    );
};

// Strategies Tab Component
const StrategiesTab: React.FC<{
    config: TechnicalAnalysisConfig;
    onUpdate: (config: TechnicalAnalysisConfig) => void;
}> = ({ config, onUpdate }) => {
    const { t } = useLanguage();
    
    return (
        <div className="space-y-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('trading_strategies') || 'Trading Strategies'}</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                        <div>
                            <p className="text-white font-semibold">{t('auto_trading') || 'Auto Trading'}</p>
                            <p className="text-xs text-gray-400">{t('auto_trading_desc') || 'Allow agent to execute trades automatically'}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.autoTrading}
                                onChange={(e) => onUpdate({ ...config, autoTrading: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                    <div className="p-4 bg-gray-800/50 rounded-lg">
                        <label className="block text-sm text-gray-400 mb-2">{t('risk_level') || 'Risk Level'}</label>
                        <select
                            value={config.riskLevel}
                            onChange={(e) => onUpdate({ ...config, riskLevel: e.target.value as any })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                        >
                            <option value="low">{t('low') || 'Low'}</option>
                            <option value="medium">{t('medium') || 'Medium'}</option>
                            <option value="high">{t('high') || 'High'}</option>
                        </select>
                    </div>
                    <div className="p-4 bg-gray-800/50 rounded-lg">
                        <label className="block text-sm text-gray-400 mb-2">{t('min_confidence') || 'Minimum Confidence (%)'}</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.minConfidence}
                            onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                const clamped = Math.max(0, Math.min(100, value));
                                onUpdate({ ...config, minConfidence: clamped });
                            }}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t('min_confidence_desc') || 'Minimum confidence level required for signals (0-100%)'}</p>
                    </div>
                    <div className="p-4 bg-gray-800/50 rounded-lg">
                        <label className="block text-sm text-gray-400 mb-2">{t('max_positions') || 'Maximum Positions'}</label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={config.maxPositions}
                            onChange={(e) => {
                                const value = parseInt(e.target.value) || 1;
                                const clamped = Math.max(1, Math.min(20, value));
                                onUpdate({ ...config, maxPositions: clamped });
                            }}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t('max_positions_desc') || 'Maximum number of concurrent positions (1-20)'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Performance Tab Component
const PerformanceTab: React.FC<{
    performance: AgentPerformanceMetrics | null;
}> = ({ performance }) => {
    const { t } = useLanguage();
    
    if (!performance) {
        return (
            <div className="text-center py-10 text-gray-400">
                <p>{t('no_performance_data') || 'No performance data available'}</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label={t('total_signals') || 'Total Signals'} value={performance.totalSignals} icon="📊" />
                <StatCard label={t('successful_signals') || 'Successful'} value={performance.successfulSignals} icon="✅" />
                <StatCard label={t('win_rate') || 'Win Rate'} value={`${performance.winRate.toFixed(1)}%`} icon="🎯" />
            </div>
            
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('advanced_metrics') || 'Advanced Metrics'}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricItem label={t('profit_factor') || 'Profit Factor'} value={performance.profitFactor.toFixed(2)} />
                    <MetricItem label={t('sharpe_ratio') || 'Sharpe Ratio'} value={performance.sharpeRatio.toFixed(2)} />
                    <MetricItem label={t('max_drawdown') || 'Max Drawdown'} value={`${performance.maxDrawdown.toFixed(2)}%`} />
                    <MetricItem label={t('avg_confidence') || 'Avg Confidence'} value={`${performance.averageConfidence.toFixed(1)}%`} />
                </div>
            </div>
            
            {performance.recentPerformance && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">{t('recent_performance') || 'Recent Performance'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <p className="text-sm text-gray-400 mb-1">{t('last_24h') || 'Last 24h'}</p>
                            <p className="text-white font-semibold text-lg">{performance.recentPerformance.last24h.signals} {t('signals')}</p>
                            <p className="text-xs text-gray-400">{performance.recentPerformance.last24h.winRate.toFixed(1)}% {t('win_rate')}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <p className="text-sm text-gray-400 mb-1">{t('last_7d') || 'Last 7d'}</p>
                            <p className="text-white font-semibold text-lg">{performance.recentPerformance.last7d.signals} {t('signals')}</p>
                            <p className="text-xs text-gray-400">{performance.recentPerformance.last7d.winRate.toFixed(1)}% {t('win_rate')}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <p className="text-sm text-gray-400 mb-1">{t('last_30d') || 'Last 30d'}</p>
                            <p className="text-white font-semibold text-lg">{performance.recentPerformance.last30d.signals} {t('signals')}</p>
                            <p className="text-xs text-gray-400">{performance.recentPerformance.last30d.winRate.toFixed(1)}% {t('win_rate')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Learning Tab Component
const LearningTab: React.FC<{
    agent: AIAgent;
}> = ({ agent }) => {
    const { t } = useLanguage();
    
    return (
        <div className="space-y-6">
            {/* Learning Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    label={t('training_progress') || 'Training Progress'}
                    value={`${agent.trainingProgress.toFixed(1)}%`}
                    icon="📈"
                />
                <StatCard
                    label={t('learning_time_hours') || 'Learning Time'}
                    value={`${agent.learningTime.toFixed(1)}h`}
                    icon="⏱️"
                />
                <StatCard
                    label={t('knowledge_size_mb') || 'Knowledge Size'}
                    value={`${agent.knowledgeSize.toFixed(1)}MB`}
                    icon="🧠"
                />
                <StatCard
                    label={t('level') || 'Level'}
                    value={agent.level}
                    icon="⭐"
                />
            </div>
            
            {/* Learning Data */}
            {agent.learningData && (
                <>
                    {agent.learningData.mistakes && agent.learningData.mistakes.length > 0 && (
                        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">{t('recent_mistakes') || 'Recent Mistakes'}</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {agent.learningData.mistakes.slice(-10).map((mistake, idx) => (
                                    <div key={idx} className="p-3 bg-gray-800/50 rounded-lg text-sm">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className="text-white font-semibold">{t('error') || 'Error'}: {mistake.error.toFixed(2)}%</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {new Date(mistake.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {agent.learningData.improvements && agent.learningData.improvements.length > 0 && (
                        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">{t('recent_improvements') || 'Recent Improvements'}</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {agent.learningData.improvements.slice(-10).map((improvement, idx) => (
                                    <div key={idx} className="p-3 bg-gray-800/50 rounded-lg text-sm">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className="text-white font-semibold">{t('accuracy_gain') || 'Accuracy Gain'}: +{improvement.accuracyGain.toFixed(2)}%</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {new Date(improvement.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
            
            {(!agent.learningData || (agent.learningData.mistakes?.length === 0 && agent.learningData.improvements?.length === 0)) && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 text-center">
                    <p className="text-gray-400">{t('no_learning_data') || 'No learning data available yet'}</p>
                </div>
            )}
        </div>
    );
};

// Settings Tab Component
const SettingsTab: React.FC<{
    config: TechnicalAnalysisConfig;
    onUpdate: (config: TechnicalAnalysisConfig) => void;
}> = ({ config, onUpdate }) => {
    const { t } = useLanguage();
    
    return (
        <div className="space-y-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('notification_settings') || 'Notification Settings'}</h3>
                <div className="space-y-3">
                    {(['onSignal', 'onAlert', 'onError'] as const).map(setting => (
                        <div key={setting} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                            <div>
                                <p className="text-white font-semibold">{t(setting) || setting}</p>
                                <p className="text-xs text-gray-400">{t(`${setting}_desc`) || `Notify when ${setting}`}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.notificationSettings[setting]}
                                    onChange={(e) => onUpdate({
                                        ...config,
                                        notificationSettings: {
                                            ...config.notificationSettings,
                                            [setting]: e.target.checked,
                                        },
                                    })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('advanced_settings') || 'Advanced Settings'}</h3>
                <div className="space-y-3">
                    {(['useMachineLearning', 'useDeepLearning', 'ensembleMode', 'realTimeAnalysis'] as const).map(setting => (
                        <div key={setting} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                            <div>
                                <p className="text-white font-semibold">{t(setting) || setting}</p>
                                <p className="text-xs text-gray-400">{t(`${setting}_desc`) || `Enable ${setting}`}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.advancedSettings[setting]}
                                    onChange={(e) => onUpdate({
                                        ...config,
                                        advancedSettings: {
                                            ...config.advancedSettings,
                                            [setting]: e.target.checked,
                                        },
                                    })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Helper Components
const StatCard: React.FC<{ label: string; value: string | number; icon: string }> = ({ label, value, icon }) => (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-gray-400 mb-1">{label}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
            </div>
            <span className="text-3xl">{icon}</span>
        </div>
    </div>
);

const MetricItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="p-3 bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
    </div>
);

export default TechnicalAnalysisAgentControl;

