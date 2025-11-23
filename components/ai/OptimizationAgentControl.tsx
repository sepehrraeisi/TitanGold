import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    OptimizationConfig,
    OptimizationMetrics,
    OptimizationResult,
    OptimizationRecommendation,
    OptimizationTargetParameter,
    OptimizationObjective,
    CurrentVsOptimized,
    StrategyRankingEntry,
    BacktestResult,
    OptimizationLogEntry,
} from '../../types.ts';

interface OptimizationAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const OptimizationAgentControl: React.FC<OptimizationAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    type OptimizationTab = 'overview' | 'current_vs_optimized' | 'log' | 'strategy_ranking' | 'backtest' | 'suggestions' | 'settings' | 'integration';
    const [activeTab, setActiveTab] = useState<OptimizationTab>('overview');
    const [config, setConfig] = useState<OptimizationConfig | null>(agent.optimizationConfig || null);
    const [metrics, setMetrics] = useState<OptimizationMetrics | null>(agent.optimizationMetrics || null);
    const [analysis, setAnalysis] = useState<OptimizationResult | null>(agent.lastOptimizationResult || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchOptimizationAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastOptimization) setAnalysis(data.lastOptimization);
            } catch (error) {
                console.error('Failed to load optimization agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [agent.id]);

    const handleRunOptimization = async () => {
        setIsOptimizing(true);
        try {
            const result = await api.runOptimizationCycle(agent.id);
            setAnalysis(result);
            const updatedAgents = await api.fetchAIAgents();
            const updatedAgent = updatedAgents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.optimizationMetrics || null);
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run optimization analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: OptimizationConfig) => {
        setIsLoading(true);
        try {
            await api.updateOptimizationConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated');
        } catch (error) {
            console.error('Failed to update optimization config:', error);
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

    const suggestions = useMemo<OptimizationRecommendation[]>(() => analysis?.recommendations ?? [], [analysis]);
    const currentVsOptimized = useMemo<CurrentVsOptimized[]>(() => analysis?.currentVsOptimized ?? [], [analysis?.currentVsOptimized]);
    const strategyRankings = useMemo<StrategyRankingEntry[]>(() => analysis?.strategyRankings ?? metrics?.strategyRankings ?? [], [analysis?.strategyRankings, metrics?.strategyRankings]);
    const backtestResults = useMemo<BacktestResult[]>(() => analysis?.backtestResults ?? [], [analysis?.backtestResults]);
    const optimizationLog = useMemo<OptimizationLogEntry[]>(() => metrics?.optimizationLog ?? [], [metrics?.optimizationLog]);

    const handleApplySuggestion = async (suggestion: OptimizationRecommendation) => {
        if (!config) return;
        const updatedConfig: OptimizationConfig = {
            ...config,
            parameters: config.parameters.map(param =>
                param.id === suggestion.parameterId
                    ? { ...param, currentValue: suggestion.proposedValue }
                    : param
            ),
        };
        await handleUpdateConfig(updatedConfig);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-[#161B22] border-b border-gray-800 p-6 flex flex-wrap gap-4 justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {agent.name} - {t('optimization_agent') || 'Optimization'}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            {t('optimization_agent_desc') || 'Tunes agent parameters using real MEXC data, learning from Artemis feedback.'}
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={handleRunOptimization}
                            disabled={isOptimizing || agent.status !== 'active'}
                            className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isOptimizing ? t('optimizing') || 'Optimizing...' : t('run_analysis')}
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
                            { id: 'current_vs_optimized', key: 'tab_current_vs_optimized' },
                            { id: 'log', key: 'tab_optimization_log' },
                            { id: 'strategy_ranking', key: 'tab_strategy_ranking' },
                            { id: 'backtest', key: 'tab_backtest' },
                            { id: 'suggestions', key: 'tab_suggestions' },
                            { id: 'settings', key: 'tab_settings' },
                            { id: 'integration', key: 'tab_integration' },
                        ] as const).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as OptimizationTab)}
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
                    {activeTab === 'overview' && analysis && metrics && (
                        <OptimizationOverview analysis={analysis} metrics={metrics} t={t} />
                    )}
                    {activeTab === 'current_vs_optimized' && <CurrentVsOptimizedTab data={currentVsOptimized} t={t} />}
                    {activeTab === 'log' && <OptimizationLogTab log={optimizationLog} t={t} />}
                    {activeTab === 'strategy_ranking' && <StrategyRankingTab rankings={strategyRankings} t={t} />}
                    {activeTab === 'backtest' && <BacktestTab results={backtestResults} t={t} />}
                    {activeTab === 'suggestions' && (
                        <OptimizationSuggestions
                            suggestions={suggestions}
                            disabled={isLoading}
                            onApply={handleApplySuggestion}
                            t={t}
                        />
                    )}
                    {activeTab === 'settings' && config && (
                        <OptimizationSettings
                            config={config}
                            disabled={isLoading}
                            onUpdate={handleUpdateConfig}
                            t={t}
                        />
                    )}
                    {activeTab === 'integration' && config && <IntegrationTab config={config} t={t} />}
                    {!analysis && activeTab === 'overview' && (
                        <div className="text-center text-gray-400 py-10">
                            <p>{t('no_optimization_data') || 'No optimization cycles have been executed yet.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const OptimizationOverview: React.FC<{
    analysis: OptimizationResult;
    metrics: OptimizationMetrics;
    t: (key: string) => string;
}> = ({ analysis, metrics, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <OverviewCard
                label={t('fitness_score') || 'Fitness'}
                value={`${analysis.fitnessScore.toFixed(2)}%`}
                hint={analysis.mode}
            />
            <OverviewCard
                label={t('efficiency_index') || 'Efficiency Index'}
                value={`${(analysis.efficiencyIndex ?? metrics.efficiencyIndex ?? 0).toFixed(2)}%`}
                hint={t('system_efficiency') || 'System efficiency'}
            />
            <OverviewCard
                label={t('objective_satisfaction') || 'Objective Hit'}
                value={`${metrics.objectiveSatisfactionRate.toFixed(1)}%`}
                hint={t('optimization_success_rate') || 'Satisfaction rate'}
            />
            <OverviewCard
                label={t('avg_improvement') || 'Avg Improvement'}
                value={`${metrics.averageImprovement.toFixed(2)}%`}
                hint={t('accuracy')} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <OverviewCard
                label={t('best_fitness') || 'Best Fitness'}
                value={`${metrics.bestFitness.toFixed(2)}%`}
                hint={t('lifetime_best') || 'Lifetime best'}
            />
            <OverviewCard
                label={t('total_runs') || 'Total Runs'}
                value={metrics.totalRuns}
                hint={t('optimization_cycles') || 'Optimization cycles'}
            />
            <OverviewCard
                label={t('successful_runs') || 'Successful'}
                value={metrics.successfulRuns}
                hint={`${metrics.totalRuns > 0 ? Math.round(metrics.successfulRuns / metrics.totalRuns * 100) : 0}%`}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('objective_breakdown') || 'Objective Scores'}</h3>
                <div className="space-y-3">
                    {analysis.objectiveScores.map(score => (
                        <div key={score.objectiveId} className="flex items-center justify-between text-sm">
                            <div>
                                <p className="text-white font-semibold">{score.metric}</p>
                                <p className="text-xs text-gray-500">{t('target')}: {score.target}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-white font-semibold">{score.achieved.toFixed(2)}%</p>
                                <p className="text-xs text-gray-500">{t('weight') || 'Weight'} {score.weight}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('dataset_snapshot') || 'Dataset Snapshot'}</h3>
                {analysis.datasetSample ? (
                    <ul className="text-sm text-gray-300 space-y-1">
                        <li>{analysis.datasetSample.symbol} · {analysis.datasetSample.timeframe}</li>
                        <li>{t('volatility') || 'Volatility'}: {analysis.datasetSample.volatility.toFixed(2)}%</li>
                        <li>{t('trend_slope') || 'Trend slope'}: {analysis.datasetSample.trendSlope.toFixed(2)}</li>
                        <li>{t('liquidity_score') || 'Liquidity score'}: {analysis.datasetSample.liquidityScore}</li>
                    </ul>
                ) : (
                    <p className="text-gray-500 text-sm">{t('no_dataset_snapshot') || 'No dataset summary available.'}</p>
                )}
            </div>
        </div>
    </div>
);

const OptimizationSuggestions: React.FC<{
    suggestions: OptimizationRecommendation[];
    disabled: boolean;
    onApply: (suggestion: OptimizationRecommendation) => void;
    t: (key: string) => string;
}> = ({ suggestions, disabled, onApply, t }) => (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
        {suggestions.map(suggestion => (
            <div key={suggestion.id} className="p-4 bg-gray-900/40 border border-gray-800 rounded-lg flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <p className="text-white font-semibold">{suggestion.description}</p>
                        <p className="text-xs text-gray-400">
                            {t('expected_impact') || 'Impact'}: {suggestion.expectedImpact.toFixed(2)}% · {t('confidence') || 'Confidence'} {suggestion.confidence}%
                        </p>
                    </div>
                    <button
                        disabled={disabled}
                        onClick={() => onApply(suggestion)}
                        className="text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-1.5 px-3 rounded-md"
                    >
                        {t('apply_change') || 'Apply change'}
                    </button>
                </div>
                {suggestion.constraint && (
                    <p className="text-xs text-yellow-400">{t('constraint') || 'Constraint'}: {suggestion.constraint}</p>
                )}
            </div>
        ))}
        {suggestions.length === 0 && (
            <div className="text-center text-gray-400 py-10">
                <p>{t('no_suggestions_available') || 'No active recommendations. Run an optimization cycle first.'}</p>
            </div>
        )}
    </div>
);

const OptimizationPerformance: React.FC<{ metrics: OptimizationMetrics; t: (key: string) => string }> = ({ metrics, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OverviewCard label={t('total_runs') || 'Total Runs'} value={metrics.totalRuns} />
            <OverviewCard label={t('successful_runs') || 'Successful'} value={metrics.successfulRuns} />
            <OverviewCard label={t('recent_improvement') || 'Recent Improvement'} value={`${(metrics.lastRun?.improvement ?? 0).toFixed(2)}%`} />
        </div>
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('recent_runs') || 'Recent Runs'}</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
                {metrics.recentRuns.length === 0 && (
                    <p className="text-sm text-gray-500">{t('no_recent_runs') || 'No optimization history yet.'}</p>
                )}
                {metrics.recentRuns.map(run => (
                    <div key={run.timestamp} className="flex justify-between text-sm text-gray-300">
                        <span>{new Date(run.timestamp).toLocaleString()}</span>
                        <span>{t('fitness_score') || 'Fitness'} {run.fitness.toFixed(2)}% · {t('improvement') || 'Δ'} {run.improvement.toFixed(2)}%</span>
                    </div>
                ))}
            </div>
        </div>
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('parameter_history') || 'Parameter History'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {metrics.parameterHistory.length === 0 && (
                    <p className="text-sm text-gray-500">{t('no_parameter_history') || 'No tracked parameters yet.'}</p>
                )}
                {metrics.parameterHistory.map(param => (
                    <div key={param.parameterId} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 text-sm">
                        <p className="text-white font-semibold">{param.label}</p>
                        <p className="text-xs text-gray-500">{t('last_value') || 'Last'}: {param.lastValue}</p>
                        <p className="text-xs text-gray-500">{t('impact') || 'Impact'}: {param.impact.toFixed(2)}%</p>
                        <p className={`text-xs font-semibold ${
                            param.trend === 'up' ? 'text-green-400' :
                            param.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                        }`}>
                            {t(param.trend) || param.trend}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const OptimizationSettings: React.FC<{
    config: OptimizationConfig;
    disabled: boolean;
    onUpdate: (config: OptimizationConfig) => void;
    t: (key: string) => string;
}> = ({ config, disabled, onUpdate, t }) => {
    const updateField = (field: keyof OptimizationConfig, value: any) => {
        onUpdate({ ...config, [field]: value });
    };

    const updateParameters = (parameterId: string, key: keyof OptimizationTargetParameter, value: number) => {
        onUpdate({
            ...config,
            parameters: config.parameters.map(param =>
                param.id === parameterId ? { ...param, [key]: value } : param
            ),
        });
    };

    const updateObjectives = (objectiveId: string, key: keyof OptimizationObjective, value: number) => {
        onUpdate({
            ...config,
            objectives: config.objectives.map(obj =>
                obj.id === objectiveId ? { ...obj, [key]: value } : obj
            ),
        });
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
                <label className="block text-sm text-gray-400 mt-2 mb-1">{t('timeframes') || 'Timeframes'}</label>
                <input
                    type="text"
                    disabled={disabled}
                    value={config.timeframes.join(', ')}
                    onChange={(e) => updateField('timeframes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('exploration_settings') || 'Exploration'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('max_iterations') || 'Max Iterations'}</label>
                        <input
                            type="number"
                            min={5}
                            disabled={disabled}
                            value={config.exploration.maxIterations}
                            onChange={(e) => updateField('exploration', { ...config.exploration, maxIterations: parseInt(e.target.value, 10) })}
                            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('exploration_rate') || 'Exploration rate'}</label>
                        <input
                            type="number"
                            step={0.05}
                            min={0.1}
                            max={0.9}
                            disabled={disabled}
                            value={config.exploration.explorationRate}
                            onChange={(e) => updateField('exploration', { ...config.exploration, explorationRate: parseFloat(e.target.value) })}
                            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('max_drawdown') || 'Max Drawdown %'}</label>
                        <input
                            type="number"
                            disabled={disabled}
                            value={config.constraints.maxDrawdownPercent}
                            onChange={(e) => updateField('constraints', { ...config.constraints, maxDrawdownPercent: parseFloat(e.target.value) })}
                            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('min_win_rate') || 'Min Win rate %'}</label>
                        <input
                            type="number"
                            disabled={disabled}
                            value={config.constraints.minWinRatePercent}
                            onChange={(e) => updateField('constraints', { ...config.constraints, minWinRatePercent: parseFloat(e.target.value) })}
                            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('max_latency') || 'Max Latency (ms)'}</label>
                        <input
                            type="number"
                            disabled={disabled}
                            value={config.constraints.maxLatencyMs}
                            onChange={(e) => updateField('constraints', { ...config.constraints, maxLatencyMs: parseInt(e.target.value, 10) })}
                            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('parameters') || 'Parameters'}</h3>
                <div className="space-y-3">
                    {config.parameters.map(parameter => (
                        <div key={parameter.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 border border-gray-800 rounded-lg p-3">
                            <div>
                                <p className="text-sm text-gray-400">{parameter.label}</p>
                                <p className="text-xs text-gray-500">{parameter.parameterKey}</p>
                            </div>
                            <NumberInput
                                label={t('current_value') || 'Current'}
                                value={parameter.currentValue}
                                onChange={(value) => updateParameters(parameter.id, 'currentValue', value)}
                                disabled={disabled}
                            />
                            <NumberInput
                                label={t('min_value') || 'Min'}
                                value={parameter.min}
                                onChange={(value) => updateParameters(parameter.id, 'min', value)}
                                disabled={disabled}
                            />
                            <NumberInput
                                label={t('max_value') || 'Max'}
                                value={parameter.max}
                                onChange={(value) => updateParameters(parameter.id, 'max', value)}
                                disabled={disabled}
                            />
                            <NumberInput
                                label={t('weight') || 'Weight'}
                                value={parameter.weight}
                                step={0.05}
                                onChange={(value) => updateParameters(parameter.id, 'weight', value)}
                                disabled={disabled}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('objective_settings') || 'Objectives'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.objectives.map(objective => (
                        <div key={objective.id} className="border border-gray-800 rounded-lg p-3">
                            <p className="text-sm font-semibold text-white mb-2">{objective.metric}</p>
                            <NumberInput
                                label={t('target') || 'Target'}
                                value={objective.target}
                                onChange={(value) => updateObjectives(objective.id, 'target', value)}
                                disabled={disabled}
                            />
                            <NumberInput
                                label={t('weight') || 'Weight'}
                                value={objective.weight}
                                step={0.05}
                                onChange={(value) => updateObjectives(objective.id, 'weight', value)}
                                disabled={disabled}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <ToggleCard
                    title={t('automation_settings') || 'Automation'}
                    options={[
                        {
                            label: t('auto_deploy') || 'Auto deploy',
                            value: config.automation.autoDeploy,
                            onChange: (value) => updateField('automation', { ...config.automation, autoDeploy: value }),
                        },
                        {
                            label: t('notify_on_improvement') || 'Notify on improvement',
                            value: config.automation.notifyOnImprovement,
                            onChange: (value) => updateField('automation', { ...config.automation, notifyOnImprovement: value }),
                        },
                        {
                            label: t('require_approval') || 'Require approval',
                            value: config.automation.requireApproval,
                            onChange: (value) => updateField('automation', { ...config.automation, requireApproval: value }),
                        },
                    ]}
                    disabled={disabled}
                />
                <ToggleCard
                    title={t('learning_settings') || 'Learning'}
                    options={[
                        {
                            label: t('learning_enabled') || 'Enable learning',
                            value: config.learning.enabled,
                            onChange: (value) => updateField('learning', { ...config.learning, enabled: value }),
                        },
                        {
                            label: t('adjust_exploration') || 'Adjust exploration',
                            value: config.learning.adjustExploration,
                            onChange: (value) => updateField('learning', { ...config.learning, adjustExploration: value }),
                        },
                        {
                            label: t('adapt_objectives') || 'Adapt objectives',
                            value: config.learning.adaptObjectives,
                            onChange: (value) => updateField('learning', { ...config.learning, adaptObjectives: value }),
                        },
                    ]}
                    disabled={disabled}
                />
            </div>
        </div>
    );
};

const NumberInput: React.FC<{
    label: string;
    value: number;
    disabled: boolean;
    step?: number;
    onChange: (value: number) => void;
}> = ({ label, value, disabled, onChange, step }) => (
    <div>
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        <input
            type="number"
            step={step ?? 0.1}
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

const ToggleCard: React.FC<{
    title: string;
    options: Array<{ label: string; value: boolean; onChange: (value: boolean) => void }>;
    disabled: boolean;
}> = ({ title, options, disabled }) => (
    <div className="border border-gray-800 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-semibold text-white mb-2">{title}</h4>
        {options.map(option => (
            <label key={option.label} className="flex items-center justify-between text-sm text-gray-300">
                <span>{option.label}</span>
                <input
                    type="checkbox"
                    disabled={disabled}
                    checked={option.value}
                    onChange={(e) => option.onChange(e.target.checked)}
                    className="w-4 h-4 accent-purple-500"
                />
            </label>
        ))}
    </div>
);

const OverviewCard: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
);

const CurrentVsOptimizedTab: React.FC<{ data: CurrentVsOptimized[]; t: (key: string) => string }> = ({ data, t }) => (
    <div className="space-y-4">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('current_vs_optimized') || 'Current vs Optimized'}</h3>
            {data.length ? (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                    {data.map(item => (
                        <div key={item.parameterId} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-white font-semibold">{item.parameterLabel}</p>
                                {item.applied && (
                                    <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/40">
                                        {t('applied') || 'Applied'}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500">{t('current_value') || 'Current'}</p>
                                    <p className="text-white font-semibold">{item.currentValue.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('optimized_value') || 'Optimized'}</p>
                                    <p className="text-purple-400 font-semibold">{item.optimizedValue.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('improvement') || 'Improvement'}</p>
                                    <p className={`font-semibold ${item.improvement >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {item.improvement >= 0 ? '+' : ''}{item.improvement.toFixed(2)}%
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('confidence') || 'Confidence'}</p>
                                    <p className="text-white font-semibold">{item.confidence}%</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-10">
                    <p>{t('no_comparison_data') || 'No comparison data available.'}</p>
                </div>
            )}
        </div>
    </div>
);

const OptimizationLogTab: React.FC<{ log: OptimizationLogEntry[]; t: (key: string) => string }> = ({ log, t }) => (
    <div className="space-y-4">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('optimization_log') || 'Optimization Log'}</h3>
            {log.length ? (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                    {log.map(entry => (
                        <div key={entry.id} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        entry.status === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                                        entry.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                                        'bg-red-500/20 text-red-400 border border-red-500/40'
                                    }`}>
                                        {t(entry.status) || entry.status}
                                    </span>
                                    <span className="text-xs text-gray-500">{t(entry.type) || entry.type}</span>
                                </div>
                                <span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-gray-300 mb-2">{entry.description}</p>
                            {entry.result && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400 mt-3">
                                    <p>{t('fitness_score') || 'Fitness'}: {entry.result.fitnessScore.toFixed(2)}</p>
                                    <p>{t('improvement') || 'Improvement'}: {entry.result.improvement.toFixed(2)}%</p>
                                    <p>{t('objectives_met') || 'Objectives'}: {entry.result.objectivesMet}/{entry.result.objectivesTotal}</p>
                                </div>
                            )}
                            {entry.error && <p className="text-xs text-red-400 mt-2">{entry.error}</p>}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-10">
                    <p>{t('no_log_entries') || 'No log entries yet.'}</p>
                </div>
            )}
        </div>
    </div>
);

const StrategyRankingTab: React.FC<{ rankings: StrategyRankingEntry[]; t: (key: string) => string }> = ({ rankings, t }) => (
    <div className="space-y-4">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('strategy_ranking') || 'Strategy Ranking'}</h3>
            {rankings.length ? (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                    {rankings.map(strategy => (
                        <div key={strategy.strategyId} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-white font-semibold">{strategy.strategyName}</p>
                                    <p className="text-xs text-gray-500">{t('agent') || 'Agent'}: {strategy.agentId}</p>
                                </div>
                                <div className="text-right">
                                    <span className="px-3 py-1 rounded-full text-lg font-bold text-purple-400 bg-purple-500/20 border border-purple-500/40">
                                        #{strategy.rank}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500">{t('performance_score') || 'Performance'}</p>
                                    <p className="text-white font-semibold">{strategy.performanceScore.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('profit_score') || 'Profit'}</p>
                                    <p className="text-green-400 font-semibold">{strategy.profitScore.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('risk_score') || 'Risk'}</p>
                                    <p className="text-white font-semibold">{strategy.riskScore.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('efficiency_score') || 'Efficiency'}</p>
                                    <p className="text-white font-semibold">{strategy.efficiencyScore.toFixed(2)}</p>
                                </div>
                            </div>
                            {strategy.sharpeRatio !== undefined && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400 mt-3">
                                    <p>Sharpe: {strategy.sharpeRatio.toFixed(2)}</p>
                                    <p>{t('max_drawdown') || 'Max DD'}: {strategy.maxDrawdown?.toFixed(2)}%</p>
                                    <p>{t('win_rate') || 'Win Rate'}: {strategy.winRate?.toFixed(1)}%</p>
                                    <p>{t('total_trades') || 'Trades'}: {strategy.totalTrades}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-10">
                    <p>{t('no_strategy_rankings') || 'No strategy rankings available.'}</p>
                </div>
            )}
        </div>
    </div>
);

const BacktestTab: React.FC<{ results: BacktestResult[]; t: (key: string) => string }> = ({ results, t }) => (
    <div className="space-y-4">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('backtest_simulation') || 'Backtest & Simulation'}</h3>
            {results.length ? (
                <div className="space-y-4">
                    {results.map(result => (
                        <div key={result.id} className="border border-gray-800 rounded-xl p-5 bg-gray-900/40">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-white font-semibold text-lg">{result.strategyName}</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(result.startDate).toLocaleDateString()} - {new Date(result.endDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded text-sm font-semibold ${
                                    result.totalReturn >= 0 ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                                    'bg-red-500/20 text-red-400 border border-red-500/40'
                                }`}>
                                    {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500">{t('initial_capital') || 'Initial'}</p>
                                    <p className="text-white font-semibold">${result.initialCapital.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('final_capital') || 'Final'}</p>
                                    <p className="text-white font-semibold">${result.finalCapital.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('sharpe_ratio') || 'Sharpe'}</p>
                                    <p className="text-white font-semibold">{result.sharpeRatio.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('max_drawdown') || 'Max DD'}</p>
                                    <p className="text-red-400 font-semibold">{result.maxDrawdown.toFixed(2)}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('win_rate') || 'Win Rate'}</p>
                                    <p className="text-white font-semibold">{result.winRate.toFixed(1)}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('total_trades') || 'Trades'}</p>
                                    <p className="text-white font-semibold">{result.totalTrades}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('profit_factor') || 'Profit Factor'}</p>
                                    <p className="text-white font-semibold">{result.profitFactor.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('avg_win') || 'Avg Win'}</p>
                                    <p className="text-green-400 font-semibold">${result.averageWin.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-10">
                    <p>{t('no_backtest_results') || 'No backtest results available.'}</p>
                </div>
            )}
        </div>
    </div>
);

const IntegrationTab: React.FC<{ config: OptimizationConfig; t: (key: string) => string }> = ({ config, t }) => {
    const integrations = config.integrationSettings ?? {
        shareWithArtemis: true,
        syncWithRisk: true,
        syncWithPortfolio: true,
        syncWithExecution: true,
        forwardToDashboard: true,
    };
    const channels = config.alertChannels ?? { dashboard: true, email: false, messenger: false };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('integration_settings') || 'Integration Settings'}</h3>
                <div className="space-y-3">
                    <IntegrationRow label={t('share_with_artemis') || 'Share with Artemis'} enabled={integrations.shareWithArtemis} />
                    <IntegrationRow label={t('sync_with_risk') || 'Sync with Risk'} enabled={integrations.syncWithRisk} />
                    <IntegrationRow label={t('sync_with_portfolio') || 'Sync with Portfolio'} enabled={integrations.syncWithPortfolio} />
                    <IntegrationRow label={t('sync_with_execution') || 'Sync with Execution'} enabled={integrations.syncWithExecution} />
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

export default OptimizationAgentControl;

