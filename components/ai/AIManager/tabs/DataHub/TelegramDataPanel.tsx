import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import axios from 'axios';
import CategoryBreakdown from './CategoryBreakdown';
import BreakingNewsMonitor from './BreakingNewsMonitor';
import AgentDetailPanel from './AgentDetailPanel';
import ErrorBoundary from '../../../../common/ErrorBoundary';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    DataHubSubTabBar,
    DataHubAlert,
    DataHubEmpty,
    DataHubSectionHeader,
    DataHubSegmentedControl,
    DataHubToolbar,
    DataHubFilterBar,
    DataHubSearchInput,
    DataHubLoadingSpinner,
    MetricCard,
    PrimaryButton,
    StatusPill,
    formatTimeRangeLabel,
    TIME_RANGE_OPTIONS_SHORT,
} from './dataHubUi';
import {
    formatNewsCategoryLabel,
    formatAgentKeyLabel,
} from './telegramCollectorLabels';
import { formatDataHubQueryError } from './dataHubI18n';
import { DataHubApiError } from '../../../../../services/dataSourcesApi';

const GeographicHeatMap = lazy(() => import('./GeographicHeatMap'));

interface TelegramDataPanelProps {
    t: (key: string) => string;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
    onRefresh: () => void;
}

interface AgentSummary {
    agent_key: string;
    agent_name: string;
    total_messages: string;
    action_required_count: string;
    critical_count: string;
    high_count: string;
    average_impact: string;
    last_message_at: string;
    top_event_categories: string[];
    top_news_categories: string[];
}

interface SystemStats {
    total_processed_messages: string;
    total_agent_impacts: string;
    active_channels: string;
    avg_impact_score: string;
    total_actions_required: string;
    last_processed_at: string;
}

interface PipelineHealth {
    total_messages: string;
    processed_count: string;
    pending_count: string;
    failed_count: string;
    actionable_count: string;
    signal_count: string;
    avg_processing_time_ms: string;
    channels_with_data: string;
}

const AGENT_ICONS: Record<string, string> = {
    technical: '📊',
    risk: '⚠️',
    sentiment: '💭',
    pattern: '🔍',
    price_prediction: '📈',
    arbitrage: '⚖️',
    portfolio: '💼',
    liquidity: '💧',
    trend: '📉',
    optimization: '⚙️',
    order: '📝',
    fundamental: '🏢',
    market_intelligence: '🧠',
    volume: '📊',
    timing: '⏰',
};

const TelegramDataPanel: React.FC<TelegramDataPanelProps> = ({ t, Card, onRefresh }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'categories' | 'breaking' | 'geographic'>(
        'overview',
    );
    const [selectedAgent, setSelectedAgent] = useState<{ key: string; name: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const [health, setHealth] = useState<PipelineHealth | null>(null);
    const [agents, setAgents] = useState<AgentSummary[]>([]);
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
    const [timeRange, setTimeRange] = useState(24);
    const [agentSearch, setAgentSearch] = useState('');

    const filteredAgents = useMemo(() => {
        const q = agentSearch.trim().toLowerCase();
        if (!q) return agents;
        return agents.filter(
            a =>
                a.agent_name.toLowerCase().includes(q) ||
                a.agent_key.toLowerCase().includes(q),
        );
    }, [agents, agentSearch]);

    const inboxSummary = useMemo(() => {
        const totalMessages = agents.reduce((sum, a) => sum + parseInt(a.total_messages, 10), 0);
        const totalActions = agents.reduce((sum, a) => sum + parseInt(a.action_required_count, 10), 0);
        const totalHigh = agents.reduce((sum, a) => sum + parseInt(a.high_count || '0', 10), 0);
        return { totalMessages, totalActions, totalHigh, count: agents.length };
    }, [agents]);

    const toQueryError = (err: unknown): Error => {
        const axiosErr = err as {
            response?: { status?: number; data?: { message?: string } };
            message?: string;
        };
        const status = axiosErr.response?.status ?? 0;
        const message =
            axiosErr.response?.data?.message || axiosErr.message || t('datahub_error_generic');
        return status > 0 ? new DataHubApiError(status, message) : new Error(message);
    };

    const API_BASE = '/api/v1/telegram';

    const getAuthHeaders = () => {
        const token =
            typeof localStorage !== 'undefined'
                ? localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token')
                : null;
        return token ? { Authorization: `Bearer ${token}` } : undefined;
    };

    const displayError = formatDataHubQueryError(t, error);

    const fetchHealth = async () => {
        try {
            const response = await axios.get(`${API_BASE}/health`, {
                withCredentials: true,
                headers: getAuthHeaders(),
            });
            if (response.data.success) {
                setHealth(response.data.pipeline);
            }
        } catch (err: unknown) {
            console.error('Failed to fetch health:', err);
        }
    };

    const fetchAgents = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_BASE}/agents/summary?timeRange=${timeRange}`, {
                withCredentials: true,
                headers: getAuthHeaders(),
            });
            if (response.data.success) {
                setAgents(response.data.agents);
                setSystemStats(response.data.systemStats);
            }
        } catch (err: unknown) {
            setError(toQueryError(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        onRefresh();
        await Promise.all([fetchHealth(), fetchAgents()]);
        setIsRefreshing(false);
    };

    useEffect(() => {
        fetchHealth();
        fetchAgents();

        const interval = setInterval(() => {
            fetchHealth();
            fetchAgents();
        }, 30000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange]);

    const formatNumber = (value: string | number | null | undefined) => {
        if (value === null || value === undefined || value === '') return '0';
        const num = typeof value === 'string' ? parseInt(value, 10) : Number(value);
        return Number.isFinite(num) ? num.toLocaleString() : '0';
    };

    const formatImpact = (value: string | null | undefined) => {
        if (value === null || value === undefined || value === '') return '0%';
        const num = parseFloat(String(value));
        return Number.isFinite(num) ? (num * 100).toFixed(1) + '%' : '0%';
    };

    const getImpactColor = (value: string) => {
        const num = parseFloat(value);
        if (!Number.isFinite(num)) return 'text-muted-foreground';
        if (num >= 0.7) return 'text-red-400';
        if (num >= 0.5) return 'text-yellow-400';
        return 'text-green-400';
    };

    const processedPct =
        health && parseInt(health.total_messages, 10) > 0
            ? (
                  (parseInt(health.processed_count, 10) / parseInt(health.total_messages, 10)) *
                  100
              ).toFixed(1) + '%'
            : undefined;

    const actionablePct =
        health && parseInt(health.processed_count, 10) > 0
            ? (
                  (parseInt(health.actionable_count, 10) / parseInt(health.processed_count, 10)) *
                  100
              ).toFixed(1) + '%'
            : undefined;

    const avgProcessing =
        health?.avg_processing_time_ms && parseFloat(health.avg_processing_time_ms) > 0
            ? `${parseFloat(health.avg_processing_time_ms).toFixed(2)}ms avg`
            : undefined;

    const analyticsTabs = [
        { id: 'overview', label: t('telegram_data_tab_overview') },
        { id: 'agents', label: t('telegram_data_tab_agents') },
        { id: 'categories', label: t('telegram_data_tab_categories') },
        { id: 'breaking', label: t('telegram_data_tab_breaking') },
        { id: 'geographic', label: t('telegram_data_tab_geographic') },
    ] as const;

    return (
        <div className="space-y-6">
            <Card className={DATAHUB_SHELL}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    <MetricCard
                        label={t('total_messages') || 'Total Messages'}
                        value={health ? formatNumber(health.total_messages) : '-'}
                        color="emerald"
                    />
                    <MetricCard
                        label={t('processed') || 'Processed'}
                        value={
                            health ? (
                                <>
                                    {formatNumber(health.processed_count)}
                                    {processedPct && (
                                        <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                                            {processedPct}
                                        </span>
                                    )}
                                </>
                            ) : (
                                '-'
                            )
                        }
                        color="blue"
                    />
                    <MetricCard
                        label={t('actionable') || 'Actionable'}
                        value={
                            health ? (
                                <>
                                    {formatNumber(health.actionable_count)}
                                    {actionablePct && (
                                        <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                                            {actionablePct}
                                        </span>
                                    )}
                                </>
                            ) : (
                                '-'
                            )
                        }
                        color="purple"
                    />
                    <MetricCard
                        label={t('active_channels') || 'Active Channels'}
                        value={
                            health ? (
                                <>
                                    {health.channels_with_data}
                                    {avgProcessing && (
                                        <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                                            {avgProcessing}
                                        </span>
                                    )}
                                </>
                            ) : (
                                '-'
                            )
                        }
                        color="blue"
                    />
                </div>

                <DataHubToolbar className="mt-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[11px] text-muted-foreground">
                            {t('time_range') || 'Time Range'}:
                        </span>
                        <DataHubSegmentedControl
                            ariaLabel={t('time_range') || 'Time range'}
                            value={timeRange}
                            onChange={setTimeRange}
                            options={TIME_RANGE_OPTIONS_SHORT.map(hours => ({
                                value: hours,
                                label: formatTimeRangeLabel(hours),
                            }))}
                        />
                    </div>
                    <PrimaryButton
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        aria-label={t('refresh') || 'Refresh'}
                    >
                        {isRefreshing ? t('loading') || 'Loading…' : `🔄 ${t('refresh') || 'Refresh'}`}
                    </PrimaryButton>
                </DataHubToolbar>

                <DataHubSubTabBar
                    className="mt-4"
                    ariaLabel={t('telegram_data_navigation') || 'Telegram analytics'}
                    activeId={activeTab}
                    onChange={id => {
                        setActiveTab(id as typeof activeTab);
                        setSelectedAgent(null);
                    }}
                    items={analyticsTabs.map(tab => ({
                        id: tab.id,
                        label: tab.label,
                        activeVariant: 'telegram' as const,
                    }))}
                />
            </Card>

            <div className="mt-2">
                {displayError && (
                    <div className="mb-4">
                        <DataHubAlert
                            variant={displayError.variant}
                            message={displayError.message}
                            onRetry={
                                displayError.retryable
                                    ? () => {
                                          fetchHealth();
                                          fetchAgents();
                                      }
                                    : undefined
                            }
                            retryLabel={t('retry')}
                        />
                    </div>
                )}

                {activeTab === 'overview' &&
                    (isLoading && !systemStats ? (
                        <DataHubLoadingSpinner message={t('telegram_data_overview_loading')} />
                    ) : !systemStats ? (
                        <DataHubEmpty message={t('telegram_data_overview_empty')} />
                    ) : (
                        <Card className={DATAHUB_SHELL}>
                            <DataHubSectionHeader
                                title={t('telegram_data_tab_overview')}
                                subtitle={t('telegram_data_overview_desc')}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <MetricCard
                                    label={t('processed_messages')}
                                    value={formatNumber(systemStats.total_processed_messages)}
                                    color="blue"
                                />
                                <MetricCard
                                    label={t('agent_impacts')}
                                    value={formatNumber(systemStats.total_agent_impacts)}
                                    color="purple"
                                />
                                <MetricCard
                                    label={t('active_channels')}
                                    value={systemStats.active_channels}
                                    color="blue"
                                />
                                <MetricCard
                                    label={t('avg_impact_score')}
                                    value={formatImpact(systemStats.avg_impact_score)}
                                    color="purple"
                                />
                                <MetricCard
                                    label={t('actions_required')}
                                    value={systemStats.total_actions_required}
                                    color="amber"
                                />
                                <MetricCard
                                    label={t('last_processed')}
                                    value={
                                        systemStats.last_processed_at
                                            ? new Date(systemStats.last_processed_at).toLocaleString()
                                            : '-'
                                    }
                                    color="emerald"
                                />
                            </div>
                        </Card>
                    ))}

                {activeTab === 'agents' && (
                    <div className="space-y-4">
                        {selectedAgent ? (
                            <AgentDetailPanel
                                agentKey={selectedAgent.key}
                                agentName={selectedAgent.name}
                                onClose={() => setSelectedAgent(null)}
                                t={t}
                                Card={Card}
                            />
                        ) : (
                            <div className="space-y-4">
                                <Card className={DATAHUB_SHELL}>
                                    <DataHubSectionHeader
                                        title={t('telegram_data_tab_agents')}
                                        subtitle={t('telegram_ai_inbox_desc')}
                                    />
                                    {agents.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
                                            <MetricCard
                                                label={t('telegram_ai_inbox_summary_agents')}
                                                value={inboxSummary.count}
                                                color="blue"
                                            />
                                            <MetricCard
                                                label={t('telegram_ai_inbox_summary_messages')}
                                                value={formatNumber(inboxSummary.totalMessages)}
                                                color="emerald"
                                            />
                                            <MetricCard
                                                label={t('telegram_ai_inbox_summary_actions')}
                                                value={formatNumber(inboxSummary.totalActions)}
                                                color="amber"
                                            />
                                            <MetricCard
                                                label={t('telegram_ai_inbox_summary_high_priority')}
                                                value={formatNumber(inboxSummary.totalHigh)}
                                                color="red"
                                            />
                                        </div>
                                    )}
                                    <DataHubFilterBar className="mb-4">
                                        <DataHubSearchInput
                                            value={agentSearch}
                                            onChange={setAgentSearch}
                                            placeholder={t('telegram_ai_inbox_search')}
                                            ariaLabel={t('telegram_ai_inbox_search')}
                                        />
                                    </DataHubFilterBar>
                                    {isLoading ? (
                                        <DataHubLoadingSpinner message={t('loading')} />
                                    ) : agents.length === 0 ? (
                                        <DataHubEmpty message={t('telegram_ai_inbox_empty')} />
                                    ) : filteredAgents.length === 0 ? (
                                        <DataHubEmpty message={t('telegram_ai_inbox_search')} />
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {filteredAgents.map(agent => (
                                                <button
                                                    key={agent.agent_key}
                                                    type="button"
                                                    data-agent-key={agent.agent_key}
                                                    className={`${DATAHUB_INNER_LIST} w-full text-left cursor-pointer hover:border-sky-500/50 hover:bg-slate-900/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60`}
                                                    onClick={() =>
                                                        setSelectedAgent({
                                                            key: agent.agent_key,
                                                            name: agent.agent_name,
                                                        })
                                                    }
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="text-2xl md:text-3xl shrink-0" aria-hidden>
                                                            {AGENT_ICONS[agent.agent_key] || '🤖'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div>
                                                                    <h4 className="text-sm font-semibold text-foreground">
                                                                        {agent.agent_name}
                                                                    </h4>
                                                                    <p className="text-[11px] text-muted-foreground">
                                                                        {formatAgentKeyLabel(agent.agent_key, t)}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-lg font-bold text-foreground">
                                                                        {formatNumber(agent.total_messages)}
                                                                    </p>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        {t('telegram_ai_inbox_messages')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2 mt-3">
                                                                <div>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        {t('telegram_ai_inbox_avg_impact')}
                                                                    </p>
                                                                    <p
                                                                        className={`text-xs font-medium ${getImpactColor(agent.average_impact)}`}
                                                                    >
                                                                        {formatImpact(agent.average_impact)}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        {t('telegram_ai_inbox_action_required')}
                                                                    </p>
                                                                    <p className="text-xs font-medium text-yellow-400">
                                                                        {agent.action_required_count}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        {t('telegram_ai_inbox_high_priority')}
                                                                    </p>
                                                                    <p className="text-xs font-medium text-red-400">
                                                                        {agent.high_count || '0'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {agent.top_event_categories?.length > 0 && (
                                                                <div className="mt-2">
                                                                    <p className="text-[10px] text-muted-foreground mb-1">
                                                                        {t('telegram_ai_inbox_top_categories')}
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {agent.top_event_categories.slice(0, 4).map((cat, i) => (
                                                                            <StatusPill
                                                                                key={cat + i}
                                                                                label={formatNewsCategoryLabel(cat, t)}
                                                                                variant="primary"
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'categories' && <CategoryBreakdown t={t} Card={Card} />}

                {activeTab === 'breaking' && <BreakingNewsMonitor t={t} Card={Card} />}

                {activeTab === 'geographic' && (
                    <ErrorBoundary>
                        <Suspense
                            fallback={
                                <Card className={DATAHUB_SHELL}>
                                    <DataHubLoadingSpinner
                                        message={t('loading_geographic_data') || 'Loading map…'}
                                        size="lg"
                                    />
                                </Card>
                            }
                        >
                            <GeographicHeatMap t={t} Card={Card} />
                        </Suspense>
                    </ErrorBoundary>
                )}
            </div>
        </div>
    );
};

export default TelegramDataPanel;
