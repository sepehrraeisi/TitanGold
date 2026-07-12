import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import * as api from '../../services/api.ts';
import { fetchSentimentAgentData } from '../../services/api-backend.ts';
import type {
    AIAgent,
    SentimentAnalysisConfig,
    SentimentAnalysisResult,
    SentimentMetrics,
    SentimentTrendingAsset,
    SentimentImpactAlert,
    SentimentIntegrationStatus,
    SentimentSourceStatus,
    SentimentHistoryPoint,
} from '../../types.ts';

type SentimentTab =
    | 'overview'
    | 'newsSocial'
    | 'history'
    | 'alerts'
    | 'trending'
    | 'integration'
    | 'settings';

const TAB_ITEMS: Array<{ id: SentimentTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'newsSocial', labelKey: 'tab_news_social' },
    { id: 'history', labelKey: 'tab_sentiment_history' },
    { id: 'alerts', labelKey: 'tab_impact_alerts' },
    { id: 'trending', labelKey: 'tab_trending_assets' },
    { id: 'integration', labelKey: 'tab_integration' },
    { id: 'settings', labelKey: 'tab_settings' },
];

interface SentimentAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const SentimentAgentControl: React.FC<SentimentAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const { guardExecution } = useAgentExecutionGate();
    const [activeTab, setActiveTab] = useState<SentimentTab>('overview');
    const [config, setConfig] = useState<SentimentAnalysisConfig | null>(agent.sentimentAnalysisConfig || null);
    const [metrics, setMetrics] = useState<SentimentMetrics | null>(agent.sentimentMetrics || null);
    const [lastAnalysis, setLastAnalysis] = useState<SentimentAnalysisResult | null>(agent.lastSentimentAnalysis || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await fetchSentimentAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastAnalysis) setLastAnalysis(data.lastAnalysis);
            } catch (error) {
                console.error('Failed to load sentiment agent data:', error);
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
            const result = await api.runSentimentAnalysis(agent.id);
            setLastAnalysis(result);
            const updatedAgents = await api.fetchAIAgents();
            const refreshedAgent = updatedAgents.find(a => a.id === agent.id);
            if (refreshedAgent) {
                setMetrics(refreshedAgent.sentimentMetrics || null);
                onUpdate(refreshedAgent);
            }
        } catch (error) {
            console.error('Failed to run sentiment analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: SentimentAnalysisConfig) => {
        setIsLoading(true);
        try {
            await api.updateSentimentAnalysisConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated successfully');
        } catch (error) {
            console.error('Failed to update sentiment config:', error);
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
            const refreshedAgent = updatedAgents.find(a => a.id === agent.id);
            if (refreshedAgent) {
                onUpdate(refreshedAgent);
            }
        } catch (error) {
            console.error('Failed to execute command:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsLoading(false);
        }
    };

    const activeAlerts = useMemo(() => {
        if (metrics?.activeAlerts?.length) return metrics.activeAlerts;
        return lastAnalysis?.impactAlerts || [];
    }, [metrics?.activeAlerts, lastAnalysis?.impactAlerts]);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0E141C] border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden">
                <Header agent={agent} t={t} onRunAnalysis={handleRunAnalysis} onClose={onClose} isAnalyzing={isAnalyzing} />
                <StatusBar agent={agent} metrics={metrics} analysis={lastAnalysis} onCommand={handleControlCommand} t={t} />

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
                                        ? 'border-emerald-500 text-emerald-400'
                                        : 'border-transparent text-gray-500 hover:text-white hover:border-gray-600'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-6 bg-[#101722] overflow-y-auto h-full">
                    {activeTab === 'overview' && lastAnalysis && metrics && (
                        <OverviewTab agent={agent} analysis={lastAnalysis} metrics={metrics} alerts={activeAlerts} t={t} />
                    )}
                    {activeTab === 'newsSocial' && lastAnalysis && <NewsSocialTab analysis={lastAnalysis} config={config} t={t} />}
                    {activeTab === 'history' && metrics && <HistoryTab history={metrics.history ?? []} t={t} />}
                    {activeTab === 'alerts' && <AlertsTab alerts={activeAlerts} t={t} />}
                    {activeTab === 'trending' && lastAnalysis && <TrendingTab assets={lastAnalysis.trendingAssets} t={t} />}
                    {activeTab === 'integration' && metrics && (
                        <IntegrationTab
                            integrations={metrics.integrations ?? []}
                            sources={metrics.sourceStatus ?? []}
                            t={t}
                        />
                    )}
                    {activeTab === 'settings' && config && (
                        <SettingsTab config={config} onUpdate={handleUpdateConfig} isUpdating={isLoading} t={t} />
                    )}

                    {!lastAnalysis && activeTab === 'overview' && (
                        <EmptyState message={t('no_analysis_data') || 'No sentiment analysis has been run yet.'} />
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
            <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{agent.role}</p>
        </div>
        <div className="flex gap-3">
            <button
                onClick={onRunAnalysis}
                disabled={isAnalyzing || agent.status !== 'active'}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {isAnalyzing ? t('analyzing') : t('run_analysis')}
            </button>
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm">
                {t('close')}
            </button>
        </div>
    </div>
);

const StatusBar: React.FC<{
    agent: AIAgent;
    metrics: SentimentMetrics | null;
    analysis: SentimentAnalysisResult | null;
    onCommand: (command: string) => void;
    t: (key: string) => string;
}> = ({ agent, metrics, analysis, onCommand, t }) => (
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
                        {t('sentiment_index') || 'Sentiment Index'}:{' '}
                        <span className="text-white font-semibold">{analysis.overallScore.toFixed(1)}</span>
                    </span>
                )}
                {metrics && (
                    <span className="text-sm text-gray-400">
                        {t('active_alerts') || 'Active Alerts'}:{' '}
                        <span className="text-white font-semibold">{metrics.activeAlerts?.length ?? 0}</span>
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
    analysis: SentimentAnalysisResult;
    metrics: SentimentMetrics;
    alerts: SentimentImpactAlert[];
    t: (key: string) => string;
}> = ({ agent, analysis, metrics, alerts, t }) => {
    const alertsTriggered = metrics.alertsTriggered ?? 0;
    const trendShiftAlerts = metrics.trendShiftAlerts ?? 0;
    const sentimentMomentumValue = metrics.sentimentMomentum ?? 0;
    const predictionScore = metrics.predictionScoreAvg ?? 0;

    const quickStats = [
        {
            label: t('sentiment_index') || 'Sentiment Index',
            value: analysis.overallScore.toFixed(1),
            helper: t(analysis.bias.toLowerCase()) || analysis.bias,
        },
        {
            label: t('fear_greed_index') || 'Fear & Greed',
            value: analysis.marketContext.fearGreedIndex.toString(),
            helper: analysis.marketContext.fearGreedLabel,
        },
        {
            label: t('sentiment_momentum') || 'Momentum',
            value: analysis.sentimentMomentum.value.toFixed(1),
            helper: t(analysis.sentimentMomentum.direction) || analysis.sentimentMomentum.label,
        },
        {
            label: t('news_impact_score') || 'News Impact',
            value: analysis.newsImpactScore.toFixed(1),
            helper: `${t('alerts') || 'Alerts'} ${alerts.length}`,
        },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {quickStats.map(stat => (
                    <div key={stat.label} className="bg-gray-900/40 border border-gray-800 rounded-xl p-5">
                        <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
                        <p className="text-3xl font-semibold text-white">{stat.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{stat.helper}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title={t('sentiment_components') || 'Component breakdown'}>
                    <div className="space-y-4">
                        {Object.entries(analysis.components).map(([key, value]) => (
                            <div key={key}>
                                <div className="flex justify-between text-sm text-gray-400">
                                    <span>{t(key) || key}</span>
                                    <span className="text-white font-semibold">{value.toFixed(1)}</span>
                                </div>
                                <div className="h-2 bg-gray-800 rounded mt-2">
                                    <div
                                        className="h-2 rounded bg-gradient-to-r from-emerald-500 to-cyan-500"
                                        style={{ width: `${value}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
                <SectionCard title={t('sentiment_health') || 'Sentiment health'}>
                    <div className="grid grid-cols-2 gap-4">
                        <StatMetric label={t('alerts_triggered') || 'Alerts triggered'} value={alertsTriggered} />
                        <StatMetric label={t('trend_shift_alerts') || 'Trend shifts'} value={trendShiftAlerts} />
                        <StatMetric
                            label={t('sentiment_momentum') || 'Momentum'}
                            value={sentimentMomentumValue.toFixed(1)}
                        />
                        <StatMetric
                            label={t('prediction_score') || 'Prediction score'}
                            value={predictionScore.toFixed(1)}
                        />
                    </div>
                </SectionCard>
            </div>

            <SectionCard title={t('recent_alerts') || 'Recent alerts'}>
                {alerts.length ? (
                    <div className="space-y-3">
                        {alerts.slice(0, 4).map(alert => (
                            <AlertRow key={alert.id} alert={alert} />
                        ))}
                    </div>
                ) : (
                    <EmptyState message={t('no_alerts') || 'No alerts generated for the latest run.'} />
                )}
            </SectionCard>

            {/* Agent Capabilities */}
            <CapabilitiesSection agent={agent} />
        </div>
    );
};

const NewsSocialTab: React.FC<{
    analysis: SentimentAnalysisResult;
    config: SentimentAnalysisConfig | null;
    t: (key: string) => string;
}> = ({ analysis, config, t }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title={t('news_insights') || 'News insights'}>
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                {analysis.newsInsights.length ? (
                    analysis.newsInsights.map(article => (
                        <article key={article.id} className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                <span>{article.source}</span>
                                <span
                                    className={`font-semibold ${
                                        article.sentiment === 'Bullish'
                                            ? 'text-green-400'
                                            : article.sentiment === 'Bearish'
                                            ? 'text-red-400'
                                            : 'text-yellow-400'
                                    }`}
                                >
                                    {t(article.sentiment.toLowerCase()) || article.sentiment}
                                </span>
                            </div>
                            <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white font-semibold hover:text-emerald-400"
                            >
                                {article.title}
                            </a>
                            <p className="text-xs text-gray-500 mt-2">{new Date(article.publishedAt).toLocaleString()}</p>
                        </article>
                    ))
                ) : (
                    <EmptyState message={t('no_news_data') || 'No news articles matched the filters.'} />
                )}
            </div>
        </SectionCard>
        <SectionCard title={t('social_overview') || 'Social overview'}>
            <div className="space-y-4">
                <div className="flex justify-between text-sm text-gray-400">
                    <span>{t('votes_up') || 'Votes up'}</span>
                    <span className="text-white font-semibold">{analysis.socialContext.votesUp.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                    <span>{t('votes_down') || 'Votes down'}</span>
                    <span className="text-white font-semibold">{analysis.socialContext.votesDown.toFixed(1)}%</span>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {analysis.socialContext.sources.map(source => (
                        <div key={source.id} className="p-3 bg-gray-900/40 border border-gray-800 rounded-lg">
                            <div className="flex justify-between text-sm">
                                <span className="text-white font-semibold">{source.name}</span>
                                <span className="text-emerald-400 font-semibold">{source.upVotes.toFixed(1)}%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {t('coverage') || 'Coverage'}: {source.downVotes.toFixed(1)}%
                            </p>
                        </div>
                    ))}
                    {!analysis.socialContext.sources.length && (
                        <EmptyState message={t('no_social_data') || 'No social sentiment data available.'} />
                    )}
                </div>
                {config && (
                    <p className="text-xs text-gray-500">
                        {t('sources_active') || 'Active platforms'}: {config.sources.social.platforms.join(', ')}
                    </p>
                )}
            </div>
        </SectionCard>
    </div>
);

const HistoryTab: React.FC<{ history: SentimentHistoryPoint[]; t: (key: string) => string }> = ({ history, t }) => (
    <SectionCard title={t('history_timeline') || 'Sentiment timeline'}>
        {history.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {[...history].reverse().map(point => (
                    <div
                        key={point.timestamp}
                        className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl"
                    >
                        <div>
                            <p className="text-white font-semibold">{new Date(point.timestamp).toLocaleString()}</p>
                            <p className="text-xs text-gray-500">
                                {t('fear_greed_index') || 'Fear & Greed'}: {point.fearGreed}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl text-white font-bold">{point.overallScore.toFixed(1)}</p>
                            <p className="text-xs text-gray-400">{t(point.bias.toLowerCase()) || point.bias}</p>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_history_data') || 'Run the agent to build sentiment history.'} />
        )}
    </SectionCard>
);

const AlertsTab: React.FC<{ alerts: SentimentImpactAlert[]; t: (key: string) => string }> = ({ alerts, t }) => (
    <SectionCard title={t('impact_alerts') || 'Impact alerts'}>
        {alerts.length ? (
            <div className="space-y-3">
                {alerts.map(alert => (
                    <AlertRow key={alert.id} alert={alert} />
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_alerts') || 'No alerts available.'} />
        )}
    </SectionCard>
);

const TrendingTab: React.FC<{ assets: SentimentTrendingAsset[]; t: (key: string) => string }> = ({ assets, t }) => (
    <SectionCard title={t('trending_assets') || 'Trending assets'}>
        {assets.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assets.map(asset => (
                    <div
                        key={asset.symbol}
                        className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl flex justify-between"
                    >
                        <div>
                            <p className="text-white font-semibold">{asset.name}</p>
                            <p className="text-xs text-gray-500">{asset.symbol}</p>
                            {asset.mentionScore !== undefined && (
                                <p className="text-xs text-gray-400 mt-1">
                                    {t('mentions') || 'Mentions'}: {asset.mentionScore.toFixed(1)}
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <p className={`text-sm font-semibold ${asset.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {asset.change24h >= 0 ? '+' : ''}
                                {asset.change24h.toFixed(2)}%
                            </p>
                            <p className="text-xs text-gray-400">{t(asset.sentiment.toLowerCase()) || asset.sentiment}</p>
                            {asset.socialVolumeChange !== undefined && (
                                <p className="text-xs text-gray-500 mt-1">
                                    {t('social_volume_change') || 'Social Δ'}: {asset.socialVolumeChange.toFixed(1)}%
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_trending_data') || 'No trending asset data available.'} />
        )}
    </SectionCard>
);

const IntegrationTab: React.FC<{
    integrations: SentimentIntegrationStatus[];
    sources: SentimentSourceStatus[];
    t: (key: string) => string;
}> = ({ integrations, sources, t }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title={t('integration_status') || 'Integration status'}>
            {integrations.length ? (
                <div className="space-y-3">
                    {integrations.map(item => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4"
                        >
                            <div>
                                <p className="text-white font-semibold">{item.name}</p>
                                <p className="text-xs text-gray-500">
                                    {t('last_sync') || 'Last sync'}:{' '}
                                    {item.lastSync ? new Date(item.lastSync).toLocaleString() : t('not_available')}
                                </p>
                            </div>
                            <StatusBadge status={item.status} />
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState message={t('no_integrations') || 'No integration data yet.'} />
            )}
        </SectionCard>
        <SectionCard title={t('source_health') || 'Source health'}>
            {sources.length ? (
                <div className="space-y-3">
                    {sources.map(source => (
                        <div key={source.id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-white font-semibold">{source.name}</p>
                                <span className="text-sm text-gray-400">{source.coverage}%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {t('latency') || 'Latency'}: {source.latencyMs}ms
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState message={t('no_source_data') || 'No source telemetry available.'} />
            )}
        </SectionCard>
    </div>
);

const SettingsTab: React.FC<{
    config: SentimentAnalysisConfig;
    onUpdate: (config: SentimentAnalysisConfig) => void;
    isUpdating: boolean;
    t: (key: string) => string;
}> = ({ config, onUpdate, isUpdating, t }) => {
    const [draft, setDraft] = useState(config);

    useEffect(() => {
        setDraft(config);
    }, [config]);

    const updateDraft = (updater: (prev: SentimentAnalysisConfig) => SentimentAnalysisConfig) => {
        setDraft(prev => updater(prev));
    };

    const handleSave = () => onUpdate(draft);
    const parseList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

    return (
        <div className="space-y-6">
            <SectionCard title={t('data_sources') || 'Data sources'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('news_sources') || 'News'}
                        checked={draft.sources.news.enabled}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                sources: { ...prev.sources, news: { ...prev.sources.news, enabled: checked } },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('social_sources') || 'Social'}
                        checked={draft.sources.social.enabled}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                sources: { ...prev.sources, social: { ...prev.sources.social, enabled: checked } },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('market_metrics') || 'Market metrics'}
                        checked={draft.sources.market.enabled}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                sources: { ...prev.sources, market: { ...prev.sources.market, enabled: checked } },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('onchain_data') || 'On-chain data'}
                        checked={Boolean(draft.sources.onchain?.enabled)}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                sources: {
                                    ...prev.sources,
                                    onchain: {
                                        enabled: checked,
                                        metrics: prev.sources.onchain?.metrics || ['inflows', 'outflows'],
                                        whaleThreshold: prev.sources.onchain?.whaleThreshold || 500000,
                                    },
                                },
                            }))
                        }
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <Field
                        label={t('sources_list') || 'News sources'}
                        value={draft.sources.news.sources.join(', ')}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                sources: { ...prev.sources, news: { ...prev.sources.news, sources: parseList(value) } },
                            }))
                        }
                    />
                    <Field
                        label={t('keywords') || 'Keywords'}
                        value={draft.sources.news.keywords.join(', ')}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                sources: { ...prev.sources, news: { ...prev.sources.news, keywords: parseList(value) } },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('analysis_sensitivity') || 'Analysis sensitivity'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                        label={t('noise_filter') || 'Noise filter'}
                        type="number"
                        value={draft.sensitivity.noiseFilter.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                sensitivity: { ...prev.sensitivity, noiseFilter: Number(value) },
                            }))
                        }
                    />
                    <Field
                        label={t('trend_shift_trigger') || 'Trend shift trigger'}
                        type="number"
                        value={draft.sensitivity.trendShiftTrigger.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                sensitivity: { ...prev.sensitivity, trendShiftTrigger: Number(value) },
                            }))
                        }
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <Field
                        label={t('reaction_strategy') || 'Reaction strategy'}
                        type="select"
                        value={draft.reactionStrategy}
                        options={[
                            { value: 'auto', label: t('reaction_auto') || 'Auto' },
                            { value: 'alert', label: t('reaction_alert') || 'Alert' },
                            { value: 'wait', label: t('reaction_wait') || 'Wait' },
                        ]}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                reactionStrategy: value as SentimentAnalysisConfig['reactionStrategy'],
                            }))
                        }
                    />
                    <Field
                        label={t('frequency') || 'Frequency'}
                        type="select"
                        value={draft.monitoring.frequency}
                        options={[
                            { value: 'realtime', label: t('frequency_realtime') || 'Real-time' },
                            { value: '5m', label: '5m' },
                            { value: '15m', label: '15m' },
                            { value: 'hourly', label: t('frequency_hourly') || 'Hourly' },
                        ]}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                monitoring: { ...prev.monitoring, frequency: value as typeof prev.monitoring.frequency },
                            }))
                        }
                    />
                    <Field
                        label={t('assets_watchlist') || 'Assets watchlist'}
                        value={draft.monitoring.assets.join(', ')}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                monitoring: { ...prev.monitoring, assets: parseList(value) },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('alerting_rules') || 'Alerting & channels'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field
                        label={t('impact_threshold') || 'Impact threshold'}
                        type="number"
                        value={draft.alerting.impactThreshold.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                alerting: { ...prev.alerting, impactThreshold: Number(value) },
                            }))
                        }
                    />
                    <Field
                        label={t('sudden_shift_percent') || 'Sudden shift %'}
                        type="number"
                        value={draft.alerting.suddenShiftPercent.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                alerting: { ...prev.alerting, suddenShiftPercent: Number(value) },
                            }))
                        }
                    />
                    <Field
                        label={t('cooldown_minutes') || 'Cooldown (min)'}
                        type="number"
                        value={draft.alerting.cooldownMinutes.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                alerting: { ...prev.alerting, cooldownMinutes: Number(value) },
                            }))
                        }
                    />
                </div>
                <div className="flex flex-wrap gap-4 mt-4">
                    {(['dashboard', 'email', 'telegram'] as const).map(channel => (
                        <ToggleField
                            key={channel}
                            label={t(channel)}
                            checked={draft.alerting.channels[channel]}
                            onChange={checked =>
                                updateDraft(prev => ({
                                    ...prev,
                                    alerting: {
                                        ...prev.alerting,
                                        channels: { ...prev.alerting.channels, [channel]: checked },
                                    },
                                }))
                            }
                        />
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('integration_settings') || 'Integration settings'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('sync_with_technical') || 'Sync with Technical agent'}
                        checked={draft.integrationSettings.syncWithTechnical}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...prev.integrationSettings, syncWithTechnical: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('sync_with_risk') || 'Sync with Risk agent'}
                        checked={draft.integrationSettings.syncWithRisk}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...prev.integrationSettings, syncWithRisk: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('sync_with_timing') || 'Sync with Timing agent'}
                        checked={draft.integrationSettings.syncWithTiming}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...prev.integrationSettings, syncWithTiming: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('share_with_volume') || 'Share with Volume agent'}
                        checked={draft.integrationSettings.shareWithVolume}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...prev.integrationSettings, shareWithVolume: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('share_with_artemis') || 'Artemis core access'}
                        checked={draft.integrationSettings.shareWithArtemisCore}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...prev.integrationSettings, shareWithArtemisCore: checked },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => setDraft(config)}
                    className="px-4 py-2 rounded-lg text-sm bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-50"
                    disabled={isUpdating}
                >
                    {t('reset_changes') || 'Reset'}
                </button>
                <button
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="px-5 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
                >
                    {t('save_changes') || 'Save changes'}
                </button>
            </div>
        </div>
    );
};

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        {children}
    </section>
);

const StatMetric: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
);

const AlertRow: React.FC<{ alert: SentimentImpactAlert }> = ({ alert }) => (
    <div className="flex items-center justify-between bg-gray-950/40 border border-gray-800 rounded-xl p-4">
        <div>
            <p className="text-white font-semibold">{alert.message}</p>
            <p className="text-xs text-gray-500">{new Date(alert.detectedAt).toLocaleString()}</p>
        </div>
        <div className="text-right">
            <span className="text-sm text-gray-400 block">{alert.channel}</span>
            <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    alert.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400'
                        : alert.severity === 'high'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-yellow-500/20 text-yellow-300'
                }`}
            >
                {alert.severity}
            </span>
        </div>
    </div>
);

const ToggleField: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({
    label,
    checked,
    onChange,
}) => (
    <label className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4 text-sm text-gray-200">
        <span>{label}</span>
        <input type="checkbox" className="accent-emerald-500 w-4 h-4" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
);

interface FieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'number' | 'select';
    options?: Array<{ value: string; label: string }>;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, type = 'text', options }) => (
    <label className="text-sm text-gray-300 space-y-2">
        <span>{label}</span>
        {type === 'select' ? (
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
            >
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

const StatusBadge: React.FC<{ status: 'synced' | 'pending' | 'disabled' }> = ({ status }) => {
    const colors: Record<'synced' | 'pending' | 'disabled', string> = {
        synced: 'bg-emerald-500/20 text-emerald-400',
        pending: 'bg-yellow-500/20 text-yellow-400',
        disabled: 'bg-gray-600/30 text-gray-300',
    };
    return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors[status]}`}>{status}</span>;
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center text-gray-400 py-10 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
        {message}
    </div>
);

// ----------------------------------------------------------------------------- //
// Capabilities Section
// ----------------------------------------------------------------------------- //

const SENTIMENT_CAPABILITY_KEYS = [
    'sentiment_capability_market_mood',
    'sentiment_capability_trend_shift',
    'sentiment_capability_news_monitoring',
    'sentiment_capability_social_tracking',
    'sentiment_capability_alerting',
    'sentiment_capability_onchain_context',
    'sentiment_capability_customization',
    'sentiment_capability_integrations',
] as const;

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isSentimentAgent = agent.id === '3' || agent.role === 'Sentiment Analysis';
    const capabilityItems = isSentimentAgent
        ? SENTIMENT_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('sentiment_capability_', '').replace(/_/g, ' ');
              return {
                  key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isSentimentAgent ? (
                <ul className="space-y-3 text-sm text-gray-300">
                    {capabilityItems.map(item => (
                        <li key={item.key} className="flex gap-3 items-start">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {capabilityItems.map(item => (
                        <span key={item.key} className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SentimentAgentControl;

