import React, { useState, useEffect, lazy, Suspense } from 'react';
import axios from 'axios';
import CategoryBreakdown from './CategoryBreakdown';
import BreakingNewsMonitor from './BreakingNewsMonitor';
import AgentDetailPanel from './AgentDetailPanel';
import ErrorBoundary from '../../../../common/ErrorBoundary';

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
    timing: '⏰'
};

const TelegramDataPanel: React.FC<TelegramDataPanelProps> = ({ t, Card, onRefresh }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'categories' | 'breaking' | 'geographic'>(
        'overview',
    );
    const [selectedAgent, setSelectedAgent] = useState<{ key: string; name: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // State for data
    const [health, setHealth] = useState<PipelineHealth | null>(null);
    const [agents, setAgents] = useState<AgentSummary[]>([]);
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
    const [timeRange, setTimeRange] = useState(24);

    const API_BASE = '/api/v1/telegram';

    const getAuthHeaders = () => {
        const token =
            typeof localStorage !== 'undefined'
                ? localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token')
                : null;
        return token ? { Authorization: `Bearer ${token}` } : undefined;
    };

    // Fetch health data (same request style as other DataHub tabs)
    const fetchHealth = async () => {
        try {
            const response = await axios.get(`${API_BASE}/health`, {
                withCredentials: true,
                headers: getAuthHeaders(),
            });
            if (response.data.success) {
                setHealth(response.data.pipeline);
            }
        } catch (err: any) {
            console.error('Failed to fetch health:', err);
        }
    };

    // Fetch agents summary
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
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch agents data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        fetchAgents();
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            fetchHealth();
            fetchAgents();
        }, 30000);

        return () => clearInterval(interval);
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

    return (
        <div className="space-y-6">
            {/* Top metrics + controls in a single styled card */}
            <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg">
                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    <div className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3 backdrop-blur-sm">
                        <p className="text-[11px] text-emerald-300/80 mb-1">Total Messages</p>
                        <p className="text-sm md:text-lg font-semibold text-emerald-100">
                            {health ? formatNumber(health.total_messages) : '-'}
                        </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-3 backdrop-blur-sm">
                        <p className="text-[11px] text-blue-300/80 mb-1">Processed</p>
                        <p className="text-sm md:text-lg font-semibold text-blue-100">
                            {health ? formatNumber(health.processed_count) : '-'}
                        </p>
                        {health && (
                            <p className="text-[11px] text-blue-200/80 mt-1">
                                {(
                                    (parseInt(health.processed_count) /
                                        Math.max(1, parseInt(health.total_messages))) *
                                    100
                                ).toFixed(1)}
                                %
                            </p>
                        )}
                    </div>
                    <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3 backdrop-blur-sm">
                        <p className="text-[11px] text-purple-300/80 mb-1">Actionable</p>
                        <p className="text-sm md:text-lg font-semibold text-purple-100">
                            {health ? formatNumber(health.actionable_count) : '-'}
                        </p>
                        {health && (
                            <p className="text-[11px] text-purple-200/80 mt-1">
                                {(
                                    (parseInt(health.actionable_count) /
                                        Math.max(1, parseInt(health.processed_count))) *
                                    100
                                ).toFixed(1)}
                                %
                            </p>
                        )}
                    </div>
                    <div className="rounded-xl border border-white/5 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent p-3 backdrop-blur-sm">
                        <p className="text-[11px] text-sky-300/80 mb-1">Active Channels</p>
                        <p className="text-sm md:text-lg font-semibold text-sky-100">
                            {health ? health.channels_with_data : '-'}
                        </p>
                        {health && health.avg_processing_time_ms && (
                            <p className="text-[11px] text-sky-200/80 mt-1">
                                {parseFloat(health.avg_processing_time_ms).toFixed(2)}ms avg
                            </p>
                        )}
                    </div>
                </div>

                {/* Time Range + Refresh */}
                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Time Range:</span>
                        <div className="flex gap-2">
                            {[24, 48, 168].map((hours) => (
                                <button
                                    key={hours}
                                    onClick={() => setTimeRange(hours)}
                                    className={`px-3 py-1 text-xs md:text-sm rounded-full border border-slate-700 transition-colors ${
                                        timeRange === hours
                                            ? 'bg-purple-600 text-white border-purple-500'
                                            : 'bg-slate-950/60 text-muted-foreground hover:bg-slate-900'
                                    }`}
                                >
                                    {hours === 24 ? '24h' : hours === 48 ? '2d' : '7d'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            fetchHealth();
                            fetchAgents();
                        }}
                        className="inline-flex items-center justify-center px-4 py-1.5 text-xs md:text-sm rounded-full font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-sm"
                    >
                        🔄 Refresh
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="mt-4 flex gap-2 border-b border-border overflow-x-auto no-scrollbar">
                    {[
                        { id: 'overview', label: '📊 Overview' },
                        { id: 'agents', label: '🤖 Telegram AI Inbox (15 Agents)' },
                        { id: 'categories', label: '📑 Categories' },
                        { id: 'breaking', label: '🚨 Breaking News' },
                        { id: 'geographic', label: '🗺️ Geographic Map' },
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id as any);
                                    setSelectedAgent(null);
                                }}
                                className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 transition-colors ${
                                    isActive
                                        ? 'border-purple-500 text-purple-300'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </Card>

            {/* Content */}
            <div className="mt-2">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded p-4 mb-4">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {activeTab === 'overview' && systemStats && (
                    <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
                            <div>
                                <h3 className="text-sm md:text-base font-semibold text-foreground">System Overview</h3>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    High-level summary of processed Telegram events and agent activity.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
                                <p className="text-[11px] text-muted-foreground mb-1">Processed Messages</p>
                                <p className="text-lg font-semibold text-foreground">
                                    {formatNumber(systemStats.total_processed_messages)}
                                </p>
                            </div>
                            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
                                <p className="text-[11px] text-muted-foreground mb-1">Agent Impacts</p>
                                <p className="text-lg font-semibold text-foreground">
                                    {formatNumber(systemStats.total_agent_impacts)}
                                </p>
                            </div>
                            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
                                <p className="text-[11px] text-muted-foreground mb-1">Active Channels</p>
                                <p className="text-lg font-semibold text-sky-200">
                                    {systemStats.active_channels}
                                </p>
                            </div>
                            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
                                <p className="text-[11px] text-muted-foreground mb-1">Avg Impact Score</p>
                                <p className="text-lg font-semibold text-purple-200">
                                    {formatImpact(systemStats.avg_impact_score)}
                                </p>
                            </div>
                            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
                                <p className="text-[11px] text-muted-foreground mb-1">Actions Required</p>
                                <p className="text-lg font-semibold text-yellow-300">
                                    {systemStats.total_actions_required}
                                </p>
                            </div>
                            <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
                                <p className="text-[11px] text-muted-foreground mb-1">Last Processed</p>
                                <p className="text-xs font-mono text-slate-200">
                                    {systemStats.last_processed_at
                                        ? new Date(systemStats.last_processed_at).toLocaleString()
                                        : '-'}
                                </p>
                            </div>
                        </div>
                    </Card>
                )}

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
                            <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
                                    <div>
                                        <h3 className="text-sm md:text-base font-semibold text-foreground">
                                            Telegram AI Inbox (15 Agents)
                                        </h3>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            Curated Telegram news feed per agent – impact, workload, and priorities ready for review.
                                        </p>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {agents.length > 0 && (
                                            <span>
                                                {agents.length} agents •{' '}
                                                {formatNumber(
                                                    agents.reduce(
                                                        (sum, a) => sum + parseInt(a.total_messages, 10),
                                                        0,
                                                    ),
                                                )}{' '}
                                                messages
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {isLoading ? (
                                    <div className="py-8 flex flex-col items-center justify-center gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                                        <p className="text-xs text-muted-foreground">Loading agents...</p>
                                    </div>
                                ) : agents.length === 0 ? (
                                    <div className="py-10 text-center">
                                        <div className="text-4xl mb-2">🤖</div>
                                        <p className="text-sm font-semibold text-foreground mb-1">
                                            No agent data available
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Once the Telegram pipeline processes messages, agent metrics will show up here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {agents.map((agent) => (
                                            <button
                                                key={agent.agent_key}
                                                type="button"
                                                className="w-full text-left cursor-pointer rounded-xl border border-white/5 bg-slate-900/70 hover:border-purple-500/60 hover:bg-slate-900/90 transition-colors"
                                                onClick={() =>
                                                    setSelectedAgent({
                                                        key: agent.agent_key,
                                                        name: agent.agent_name,
                                                    })
                                                }
                                            >
                                                <div className="flex items-start gap-4 px-3 py-3">
                                                    <div className="text-3xl md:text-4xl">
                                                        {AGENT_ICONS[agent.agent_key] || '🤖'}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <h4 className="text-sm md:text-base font-semibold text-foreground">
                                                                    {agent.agent_name}
                                                                </h4>
                                                                <p className="text-[11px] text-muted-foreground">
                                                                    {agent.agent_key}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-lg md:text-2xl font-bold text-foreground">
                                                                    {formatNumber(agent.total_messages)}
                                                                </p>
                                                                <p className="text-[11px] text-muted-foreground">
                                                                    messages
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-3 mt-3">
                                                            <div>
                                                                <p className="text-[11px] text-muted-foreground mb-0.5">
                                                                    Avg Impact
                                                                </p>
                                                                <p
                                                                    className={`text-sm font-medium ${getImpactColor(
                                                                        agent.average_impact,
                                                                    )}`}
                                                                >
                                                                    {formatImpact(agent.average_impact)}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] text-muted-foreground mb-0.5">
                                                                    Action Required
                                                                </p>
                                                                <p className="text-sm font-medium text-yellow-400">
                                                                    {agent.action_required_count}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] text-muted-foreground mb-0.5">
                                                                    High Priority
                                                                </p>
                                                                <p className="text-sm font-medium text-red-400">
                                                                    {agent.high_count || '0'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {agent.top_event_categories &&
                                                            agent.top_event_categories.length > 0 && (
                                                                <div className="mt-3">
                                                                    <p className="text-[11px] text-muted-foreground mb-1">
                                                                        Top Categories
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {agent.top_event_categories
                                                                            .slice(0, 5)
                                                                            .map((cat, i) => (
                                                                                <span
                                                                                    key={cat + i}
                                                                                    className="px-2 py-0.5 text-[11px] bg-purple-500/20 text-purple-300 rounded-full"
                                                                                >
                                                                                    {cat}
                                                                                </span>
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
                        )}
                    </div>
                )}

                {activeTab === 'categories' && <CategoryBreakdown t={t} Card={Card} />}

                {activeTab === 'breaking' && <BreakingNewsMonitor t={t} Card={Card} />}

                {activeTab === 'geographic' && (
                    <ErrorBoundary>
                        <Suspense
                            fallback={
                                <Card className="bg-slate-950/80 border border-white/5">
                                    <div className="py-12 text-center">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto" />
                                        <p className="mt-3 text-sm text-muted-foreground">
                                            {t('loading_geographic_data') || 'Loading map…'}
                                        </p>
                                    </div>
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
