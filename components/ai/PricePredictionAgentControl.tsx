import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import * as api from '../../services/api.ts';
import type { AIAgent, PricePredictionConfig, PricePredictionResult, PricePredictionMetrics } from '../../types.ts';

type PredictionTab =
    | 'overview'
    | 'chart'
    | 'scenarios'
    | 'history'
    | 'performance'
    | 'integration'
    | 'settings';

const TAB_ITEMS: Array<{ id: PredictionTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'chart', labelKey: 'tab_prediction_chart' },
    { id: 'scenarios', labelKey: 'tab_forecast_scenarios' },
    { id: 'history', labelKey: 'tab_prediction_history' },
    { id: 'performance', labelKey: 'tab_model_performance' },
    { id: 'integration', labelKey: 'tab_integration' },
    { id: 'settings', labelKey: 'tab_settings' },
];

interface PricePredictionAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const PricePredictionAgentControl: React.FC<PricePredictionAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const { guardExecution } = useAgentExecutionGate();
    const [activeTab, setActiveTab] = useState<PredictionTab>('overview');
    const [config, setConfig] = useState<PricePredictionConfig | null>(agent.pricePredictionConfig || null);
    const [metrics, setMetrics] = useState<PricePredictionMetrics | null>(agent.pricePredictionMetrics || null);
    const [prediction, setPrediction] = useState<PricePredictionResult | null>(agent.lastPricePrediction || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPredicting, setIsPredicting] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchPricePredictionAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastPrediction) setPrediction(data.lastPrediction);
            } catch (error) {
                console.error('Failed to load price prediction agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [agent.id]);

    const handleRunPrediction = async () => {
        if (!guardExecution()) return;
        setIsPredicting(true);
        try {
            const result = await api.runPricePredictionAnalysis(agent.id);
            setPrediction(result);
            const agents = await api.fetchAIAgents();
            const refreshed = agents.find(a => a.id === agent.id);
            if (refreshed) {
                setMetrics(refreshed.pricePredictionMetrics || null);
                onUpdate(refreshed);
            }
        } catch (error) {
            console.error('Failed to run prediction:', error);
            alert(t('analysis_failed') || 'Prediction failed');
        } finally {
            setIsPredicting(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: PricePredictionConfig) => {
        setIsLoading(true);
        try {
            await api.updatePricePredictionConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated successfully');
        } catch (error) {
            console.error('Failed to update configuration:', error);
            alert(t('update_failed') || 'Failed to update configuration');
        } finally {
            setIsLoading(false);
        }
    };

    const handleControlCommand = async (command: string) => {
        setIsLoading(true);
        try {
            await api.sendAgentControlCommand(agent.id, command);
            const agents = await api.fetchAIAgents();
            const refreshed = agents.find(a => a.id === agent.id);
            if (refreshed) {
                onUpdate(refreshed);
            }
        } catch (error) {
            console.error('Failed to execute command:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsLoading(false);
        }
    };

    const scenarioDistribution = useMemo(
        () => metrics?.scenarioDistribution ?? { bullish: 0, neutral: 0, bearish: 0 },
        [metrics?.scenarioDistribution],
    );

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#10141A] border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden">
                <Header
                    agent={agent}
                    t={t}
                    onClose={onClose}
                    onRunPrediction={handleRunPrediction}
                    isPredicting={isPredicting}
                />
                <StatusBar agent={agent} prediction={prediction} metrics={metrics} onCommand={handleControlCommand} t={t} />

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
                                        ? 'border-indigo-500 text-indigo-400'
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-6 bg-[#0F151D] overflow-y-auto" style={{ maxHeight: 'calc(92vh - 200px)' }}>
                    {activeTab === 'overview' && prediction && metrics && (
                        <OverviewTab agent={agent} prediction={prediction} metrics={metrics} scenarioDistribution={scenarioDistribution} t={t} />
                    )}
                    {activeTab === 'chart' && prediction && <PredictionChartTab prediction={prediction} t={t} />}
                    {activeTab === 'scenarios' && prediction && <ScenariosTab prediction={prediction} t={t} />}
                    {activeTab === 'history' && <HistoryTab metrics={metrics} t={t} />}
                    {activeTab === 'performance' && metrics && <PerformanceTab metrics={metrics} t={t} />}
                    {activeTab === 'integration' && config && <IntegrationTab config={config} t={t} />}
                    {activeTab === 'settings' && config && (
                        <SettingsTab config={config} onUpdate={handleUpdateConfig} disabled={isLoading} t={t} />
                    )}
                    {!prediction && activeTab === 'overview' && (
                        <EmptyState message={t('no_prediction_data') || 'No predictions have been generated yet.'} />
                    )}
                </div>
            </div>
        </div>
    );
};

const Header: React.FC<{
    agent: AIAgent;
    t: (key: string) => string;
    onRunPrediction: () => void;
    onClose: () => void;
    isPredicting: boolean;
}> = ({ agent, t, onRunPrediction, onClose, isPredicting }) => (
    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-[#0B1017]">
        <div>
            <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{agent.role}</p>
        </div>
        <div className="flex gap-3">
            <button
                onClick={onRunPrediction}
                disabled={isPredicting || agent.status !== 'active'}
                className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {isPredicting ? t('predicting') || 'Predicting...' : t('run_prediction') || 'Run Prediction'}
            </button>
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm">
                {t('close')}
            </button>
        </div>
    </div>
);

const StatusBar: React.FC<{
    agent: AIAgent;
    prediction: PricePredictionResult | null;
    metrics: PricePredictionMetrics | null;
    onCommand: (command: string) => void;
    t: (key: string) => string;
}> = ({ agent, prediction, metrics, onCommand, t }) => (
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
                {prediction && (
                    <span className="text-sm text-gray-400">
                        {t('predicted_price') || 'Predicted'}:{' '}
                        <span className="text-white font-semibold">${prediction.forecasts[0]?.predictedPrice?.toLocaleString() ?? '—'}</span>
                    </span>
                )}
                {metrics && (
                    <span className="text-sm text-gray-400">
                        {t('total_predictions') || 'Predictions'}:{' '}
                        <span className="text-white font-semibold">{metrics.totalPredictions}</span>
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
    prediction: PricePredictionResult;
    metrics: PricePredictionMetrics;
    scenarioDistribution: { bullish: number; neutral: number; bearish: number };
    t: (key: string) => string;
}> = ({ agent, prediction, metrics, scenarioDistribution, t }) => {
    const overviewStats = [
        {
            label: t('predicted_price') || 'Predicted price',
            value: `$${prediction.forecasts[0]?.predictedPrice?.toLocaleString() ?? '—'}`,
            helper: new Date(prediction.timestamp).toLocaleString(),
        },
        {
            label: t('trend_direction') || 'Trend direction',
            value: prediction.trendPrediction ? (t(prediction.trendPrediction.direction) || prediction.trendPrediction.direction) : (t('unknown') || '—'),
            helper: prediction.trendPrediction ? `${prediction.trendPrediction.probability}%` : '--',
        },
        {
            label: t('confidence_interval') || 'Confidence interval',
            value: prediction.confidenceInterval
                ? `$${prediction.confidenceInterval.lower.toLocaleString()} - $${prediction.confidenceInterval.upper.toLocaleString()}`
                : '—',
            helper: prediction.confidenceInterval ? `${prediction.confidenceInterval.level}%` : '--',
        },
        {
            label: t('alerts_triggered') || 'Alerts triggered',
            value: metrics.alertsTriggered,
            helper: `${t('total_predictions') || 'Total'}: ${metrics.totalPredictions}`,
        },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {overviewStats.map(stat => (
                    <SectionCard key={stat.label} title={stat.label}>
                        <p className="text-3xl font-semibold text-white">{stat.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{stat.helper}</p>
                    </SectionCard>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title={t('scenario_summary') || 'Scenario summary'}>
                    <div className="space-y-3">
                        <ScenarioSummary label={t('scenario_optimistic') || 'Optimistic'} scenario={prediction.scenarios?.optimistic} tone="success" />
                        <ScenarioSummary label={t('scenario_base') || 'Base'} scenario={prediction.scenarios?.base} tone="info" />
                        <ScenarioSummary label={t('scenario_pessimistic') || 'Pessimistic'} scenario={prediction.scenarios?.pessimistic} tone="danger" />
                    </div>
                </SectionCard>
                <SectionCard title={t('scenario_distribution') || 'Scenario distribution'}>
                    <div className="flex flex-col gap-3">
                        <DistributionRow label={t('bullish') || 'Bullish'} value={scenarioDistribution.bullish} tone="success" />
                        <DistributionRow label={t('neutral') || 'Neutral'} value={scenarioDistribution.neutral} tone="warning" />
                        <DistributionRow label={t('bearish') || 'Bearish'} value={scenarioDistribution.bearish} tone="danger" />
                    </div>
                </SectionCard>
            </div>

            {/* Agent Capabilities */}
            <CapabilitiesSection agent={agent} />
        </div>
    );
};

const ScenarioSummary: React.FC<{
    label: string;
    scenario?: { targetPrice: number; probability: number; narrative: string };
    tone: InfoTone;
}> = ({ label, scenario, tone }) => (
    <div className="flex items-center justify-between gap-4">
        <div>
            <p className="text-white font-semibold">{label}</p>
            <p className="text-xs text-gray-500">{scenario?.narrative || '—'}</p>
        </div>
        <div className="text-right">
            <InfoBadge label={`$${scenario?.targetPrice?.toLocaleString() ?? '—'}`} tone={tone} />
            <p className="text-xs text-gray-400 mt-1">{scenario ? `${scenario.probability}%` : '--'}</p>
        </div>
    </div>
);

type InfoTone = 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'muted';

const PredictionChartTab: React.FC<{ prediction: PricePredictionResult; t: (key: string) => string }> = ({ prediction, t }) => (
    <SectionCard title={t('prediction_chart') || 'Prediction chart'}>
        {prediction.forecasts.length ? (
            <div className="space-y-3">
                {prediction.forecasts.map(forecast => (
                    <div key={forecast.horizon} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                        <div>
                            <p className="text-white font-semibold">{t(`horizon_${forecast.horizon}`) || forecast.horizon}</p>
                            <p className="text-xs text-gray-500">
                                {t('predicted_price') || 'Predicted'}: ${forecast.predictedPrice.toLocaleString()}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <InfoBadge
                                label={`${forecast.expectedMovePercent >= 0 ? '+' : ''}${forecast.expectedMovePercent}%`}
                                tone={forecast.expectedMovePercent >= 0 ? 'success' : 'danger'}
                            />
                            <InfoBadge label={`${t('confidence') || 'Confidence'} ${forecast.confidence}%`} tone="info" />
                            <InfoBadge label={`${t('error_margin') || 'Error'} ±${forecast.errorMargin}%`} tone="accent" />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_forecasts') || 'No forecast data available.'} />
        )}
    </SectionCard>
);

const ScenariosTab: React.FC<{ prediction: PricePredictionResult; t: (key: string) => string }> = ({ prediction, t }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ScenarioCard title={t('scenario_optimistic') || 'Optimistic'} scenario={prediction.scenarios?.optimistic} tone="success" />
        <ScenarioCard title={t('scenario_base') || 'Base'} scenario={prediction.scenarios?.base} tone="info" />
        <ScenarioCard title={t('scenario_pessimistic') || 'Pessimistic'} scenario={prediction.scenarios?.pessimistic} tone="danger" />
    </div>
);

const ScenarioCard: React.FC<{ title: string; scenario?: { targetPrice: number; probability: number; narrative: string }; tone: InfoTone }> = ({
    title,
    scenario,
    tone,
}) => (
    <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        {scenario ? (
            <>
                <p className="text-3xl font-bold text-white">${scenario.targetPrice.toLocaleString()}</p>
                <InfoBadge label={`${scenario.probability}%`} tone={tone} />
                <p className="text-xs text-gray-400 mt-2">{scenario.narrative}</p>
            </>
        ) : (
            <EmptyState message="--" />
        )}
    </section>
);

const HistoryTab: React.FC<{ metrics: PricePredictionMetrics | null; t: (key: string) => string }> = ({ metrics, t }) => (
    <SectionCard title={t('forecast_history') || 'Forecast history'}>
        {metrics?.forecastHistory && metrics.forecastHistory.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {metrics.forecastHistory.map(entry => (
                    <div key={entry.timestamp} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                        <div>
                            <p className="text-white font-semibold">{new Date(entry.timestamp).toLocaleString()}</p>
                            <p className="text-xs text-gray-500">
                                {t('predicted_price') || 'Predicted'}: ${entry.predicted.toLocaleString()}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400">
                                {t('actual_price') || 'Actual'}: ${entry.actual.toLocaleString()}
                            </p>
                            <InfoBadge
                                label={`${entry.errorPercent.toFixed(2)}%`}
                                tone={Math.abs(entry.errorPercent) < 5 ? 'success' : 'warning'}
                            />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_prediction_history') || 'No prediction history yet.'} />
        )}
    </SectionCard>
);

const PerformanceTab: React.FC<{ metrics: PricePredictionMetrics; t: (key: string) => string }> = ({ metrics, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SectionCard title={t('average_error') || 'Average error %'}>
                <p className="text-3xl text-white font-semibold">{metrics.averageErrorPercent.toFixed(2)}%</p>
            </SectionCard>
            <SectionCard title={t('hit_rate') || 'Hit rate'}>
                <p className="text-3xl text-white font-semibold">{metrics.hitRate.toFixed(1)}%</p>
            </SectionCard>
            <SectionCard title={t('rmse') || 'RMSE'}>
                <p className="text-3xl text-white font-semibold">{metrics.rmse?.toFixed(2) ?? '--'}</p>
            </SectionCard>
            <SectionCard title={t('mae') || 'MAE'}>
                <p className="text-3xl text-white font-semibold">{metrics.mae?.toFixed(2) ?? '--'}</p>
            </SectionCard>
        </div>
        <SectionCard title={t('confidence_score') || 'Confidence score'}>
            <div className="flex items-center gap-4">
                <InfoBadge label={`${metrics.confidenceScore?.toFixed(1) ?? '--'}%`} tone="accent" />
                <p className="text-xs text-gray-400">
                    {t('forecast_bias') || 'Forecast bias'}: {metrics.forecastBias?.toFixed(2) ?? '--'}
                </p>
            </div>
        </SectionCard>
    </div>
);

const IntegrationTab: React.FC<{ config: PricePredictionConfig; t: (key: string) => string }> = ({ config, t }) => {
    const dataSources = config.dataSources ?? { sentiment: true, news: true, onchain: true, macro: false };
    const integrations = config.integrationSettings ?? {
        shareWithTechnical: true,
        shareWithVolume: true,
        shareWithSentiment: true,
        forwardToArtemis: true,
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title={t('data_sources') || 'Data sources'}>
                <div className="space-y-3">
                    <IntegrationRow label={t('sentiment_data') || 'Sentiment data'} enabled={dataSources.sentiment} />
                    <IntegrationRow label={t('news_data') || 'News feeds'} enabled={dataSources.news} />
                    <IntegrationRow label={t('onchain_data') || 'On-chain metrics'} enabled={dataSources.onchain} />
                    <IntegrationRow label={t('macro_data') || 'Macro data'} enabled={dataSources.macro} />
                </div>
            </SectionCard>
            <SectionCard title={t('integration_settings') || 'Integration settings'}>
                <div className="space-y-3">
                    <IntegrationRow label={t('share_with_technical') || 'Share with Technical'} enabled={integrations.shareWithTechnical} />
                    <IntegrationRow label={t('share_with_volume') || 'Share with Volume'} enabled={integrations.shareWithVolume} />
                    <IntegrationRow label={t('share_with_sentiment') || 'Share with Sentiment'} enabled={integrations.shareWithSentiment} />
                    <IntegrationRow label={t('forward_to_artemis') || 'Forward to Artemis'} enabled={integrations.forwardToArtemis} />
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

const SettingsTab: React.FC<{
    config: PricePredictionConfig;
    onUpdate: (config: PricePredictionConfig) => void;
    disabled: boolean;
    t: (key: string) => string;
}> = ({ config, onUpdate, disabled, t }) => {
    const [draft, setDraft] = useState(config);

    useEffect(() => setDraft(config), [config]);

    const parseList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

    const updateDraft = (updater: (prev: PricePredictionConfig) => PricePredictionConfig) => {
        setDraft(prev => updater(prev));
    };

    const handleSave = () => onUpdate(draft);

    const integrationLabelMap = {
        shareWithTechnical: t('share_with_technical') || 'Share with Technical agent',
        shareWithVolume: t('share_with_volume') || 'Share with Volume agent',
        shareWithSentiment: t('share_with_sentiment') || 'Share with Sentiment agent',
        forwardToArtemis: t('forward_to_artemis') || 'Forward to Artemis',
    };

    return (
        <div className="space-y-6">
            <SectionCard title={t('symbols_watchlist') || 'Symbols'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                        label={t('symbols_watchlist') || 'Symbols'}
                        value={draft.symbols.join(', ')}
                        onChange={value => updateDraft(prev => ({ ...prev, symbols: parseList(value) }))}
                    />
                    <Field
                        label={t('prediction_horizons') || 'Prediction horizons'}
                        value={draft.horizons.join(', ')}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                horizons: parseList(value) as typeof prev.horizons,
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('model_weights') || 'Model weights'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(['trend', 'momentum', 'meanReversion'] as const).map(key => (
                        <Field
                            key={key}
                            label={t(key) || key}
                            type="number"
                            value={draft.modelWeights[key].toString()}
                            onChange={value =>
                                updateDraft(prev => ({
                                    ...prev,
                                    modelWeights: {
                                        ...prev.modelWeights,
                                        [key]: parseFloat(value) || 0,
                                    },
                                }))
                            }
                        />
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('confidence_levels') || 'Confidence levels'}>
                <Field
                    label={t('confidence_levels') || 'Confidence levels'}
                    value={(draft.confidenceLevels ?? []).join(', ')}
                    onChange={value =>
                        updateDraft(prev => ({
                            ...prev,
                            confidenceLevels: parseList(value).map(item => Number(item) || 0),
                        }))
                    }
                />
            </SectionCard>

            <SectionCard title={t('scenario_weights') || 'Scenario weights'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(['optimistic', 'base', 'pessimistic'] as const).map(key => (
                        <Field
                            key={key}
                            label={t(`scenario_${key}`) || key}
                            type="number"
                            value={(draft.scenarioWeights?.[key] ?? 0).toString()}
                            onChange={value =>
                                updateDraft(prev => ({
                                    ...prev,
                                    scenarioWeights: {
                                        ...prev.scenarioWeights,
                                        [key]: Number(value) || 0,
                                    },
                                }))
                            }
                        />
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('alert_settings') || 'Alert settings'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                        label={t('min_confidence') || 'Min confidence'}
                        type="number"
                        value={draft.alertThresholds.minConfidence.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                alertThresholds: { ...prev.alertThresholds, minConfidence: Number(value) || 0 },
                            }))
                        }
                    />
                    <Field
                        label={t('max_error_percent') || 'Max error %'}
                        type="number"
                        value={draft.alertThresholds.maxErrorPercent.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                alertThresholds: { ...prev.alertThresholds, maxErrorPercent: Number(value) || 0 },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('data_sources') || 'Data sources'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['sentiment', 'news', 'onchain', 'macro'] as const).map(source => (
                        <ToggleField
                            key={source}
                            label={t(`${source}_data`) || source}
                            checked={draft.dataSources?.[source] ?? false}
                            onChange={checked =>
                                updateDraft(prev => ({
                                    ...prev,
                                    dataSources: {
                                        ...prev.dataSources,
                                        [source]: checked,
                                    },
                                }))
                            }
                        />
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('auto_actions') || 'Auto actions'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('notify_breakout') || 'Notify on breakout'}
                        checked={draft.autoActions.notifyOnBreakout}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoActions: { ...prev.autoActions, notifyOnBreakout: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('pause_on_high_error') || 'Pause on high error'}
                        checked={draft.autoActions.pauseTradesOnHighError}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoActions: { ...prev.autoActions, pauseTradesOnHighError: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('sync_with_risk') || 'Sync with Risk agent'}
                        checked={draft.autoActions.syncWithRisk ?? false}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoActions: { ...prev.autoActions, syncWithRisk: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('push_to_dashboard') || 'Push to dashboard'}
                        checked={draft.autoActions.pushToDashboard ?? true}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoActions: { ...prev.autoActions, pushToDashboard: checked },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('integration_settings') || 'Integration settings'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['shareWithTechnical', 'shareWithVolume', 'shareWithSentiment', 'forwardToArtemis'] as const).map(key => (
                        <ToggleField
                            key={key}
                            label={integrationLabelMap[key]}
                            checked={draft.integrationSettings?.[key] ?? true}
                            onChange={checked =>
                                updateDraft(prev => ({
                                    ...prev,
                                    integrationSettings: {
                                        ...prev.integrationSettings,
                                        [key]: checked,
                                    },
                                }))
                            }
                        />
                    ))}
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
                    className="px-5 py-2 rounded-lg text-sm bg-indigo-500 hover:bg-indigo-400 text-white font-semibold disabled:opacity-50"
                >
                    {t('save_changes') || 'Save changes'}
                </button>
            </div>
        </div>
    );
};

const Field: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'number' | 'select';
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
        <input type="checkbox" className="accent-indigo-500 w-4 h-4" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
);

const DistributionRow: React.FC<{ label: string; value: number; tone: InfoTone }> = ({ label, value, tone }) => (
    <div className="flex items-center justify-between">
        <span className="text-sm text-white">{label}</span>
        <InfoBadge label={`${value}%`} tone={tone} />
    </div>
);

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        {children}
    </section>
);

const InfoBadge: React.FC<{ label: string; tone?: InfoTone }> = ({ label, tone = 'info' }) => {
    const tones: Record<InfoTone, string> = {
        success: 'bg-green-500/15 text-green-300',
        danger: 'bg-red-500/15 text-red-300',
        warning: 'bg-yellow-500/15 text-yellow-200',
        info: 'bg-blue-500/15 text-blue-200',
        accent: 'bg-indigo-500/20 text-indigo-200',
        muted: 'bg-gray-600/20 text-gray-300',
    };
    return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${tones[tone]}`}>{label}</span>;
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center text-gray-400 py-10 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">{message}</div>
);

// ----------------------------------------------------------------------------- //
// Capabilities Section
// ----------------------------------------------------------------------------- //

const PRICE_CAPABILITY_KEYS = [
    'price_capability_ai_models',
    'price_capability_scenarios',
    'price_capability_confidence',
    'price_capability_chart_analysis',
    'price_capability_history_metrics',
    'price_capability_customization',
    'price_capability_integrations',
    'price_capability_alerts',
] as const;

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isPriceAgent = agent.id === '5' || agent.role === 'Price Prediction';
    const capabilityItems = isPriceAgent
        ? PRICE_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('price_capability_', '').replace(/_/g, ' ');
              return {
                  key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isPriceAgent ? (
                <ul className="space-y-3 text-sm text-gray-300">
                    {capabilityItems.map(item => (
                        <li key={item.key} className="flex gap-3 items-start">
                            <span className="text-indigo-400 mt-0.5">•</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {capabilityItems.map(item => (
                        <span key={item.key} className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-sm">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PricePredictionAgentControl;

