import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
    const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'categories' | 'breaking'>('overview');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // State for data
    const [health, setHealth] = useState<PipelineHealth | null>(null);
    const [agents, setAgents] = useState<AgentSummary[]>([]);
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
    const [timeRange, setTimeRange] = useState(24);

    const API_BASE = '/api/v1/telegram';

    // Fetch health data
    const fetchHealth = async () => {
        try {
            const response = await axios.get(`${API_BASE}/health`);
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
            const response = await axios.get(`${API_BASE}/agents/summary?timeRange=${timeRange}`);
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

    const formatNumber = (value: string | number) => {
        const num = typeof value === 'string' ? parseInt(value) : value;
        return num.toLocaleString();
    };

    const formatImpact = (value: string) => {
        const num = parseFloat(value);
        return (num * 100).toFixed(1) + '%';
    };

    const getImpactColor = (value: string) => {
        const num = parseFloat(value);
        if (num >= 0.7) return 'text-red-400';
        if (num >= 0.5) return 'text-yellow-400';
        return 'text-green-400';
    };

    return (
        <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Messages</p>
                        <p className="text-2xl font-bold text-foreground">
                            {health ? formatNumber(health.total_messages) : '-'}
                        </p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Processed</p>
                        <p className="text-2xl font-bold text-green-400">
                            {health ? formatNumber(health.processed_count) : '-'}
                        </p>
                        {health && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {((parseInt(health.processed_count) / parseInt(health.total_messages)) * 100).toFixed(1)}%
                            </p>
                        )}
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Actionable</p>
                        <p className="text-2xl font-bold text-purple-400">
                            {health ? formatNumber(health.actionable_count) : '-'}
                        </p>
                        {health && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {((parseInt(health.actionable_count) / parseInt(health.processed_count)) * 100).toFixed(1)}%
                            </p>
                        )}
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Active Channels</p>
                        <p className="text-2xl font-bold text-blue-400">
                            {health ? health.channels_with_data : '-'}
                        </p>
                        {health && health.avg_processing_time_ms && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {parseFloat(health.avg_processing_time_ms).toFixed(2)}ms avg
                            </p>
                        )}
                    </div>
                </Card>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Time Range:</span>
                <div className="flex gap-2">
                    {[24, 48, 168].map((hours) => (
                        <button
                            key={hours}
                            onClick={() => setTimeRange(hours)}
                            className={`px-3 py-1 text-sm rounded transition-colors ${
                                timeRange === hours
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-card hover:bg-card/80 text-muted-foreground'
                            }`}
                        >
                            {hours === 24 ? '24h' : hours === 48 ? '2d' : '7d'}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => {
                        fetchHealth();
                        fetchAgents();
                    }}
                    className="ml-auto px-4 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-border">
                {[
                    { id: 'overview', label: '📊 Overview' },
                    { id: 'agents', label: '🤖 AI Agents' },
                    { id: 'categories', label: '📑 Categories' },
                    { id: 'breaking', label: '🚨 Breaking News' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'border-b-2 border-purple-500 text-purple-400'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="mt-4">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded p-4 mb-4">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {activeTab === 'overview' && systemStats && (
                    <Card>
                        <h3 className="text-lg font-semibold mb-4">System Overview</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-card/50 rounded border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Processed Messages</p>
                                <p className="text-xl font-bold">{formatNumber(systemStats.total_processed_messages)}</p>
                            </div>
                            <div className="p-4 bg-card/50 rounded border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Agent Impacts</p>
                                <p className="text-xl font-bold">{formatNumber(systemStats.total_agent_impacts)}</p>
                            </div>
                            <div className="p-4 bg-card/50 rounded border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Active Channels</p>
                                <p className="text-xl font-bold">{systemStats.active_channels}</p>
                            </div>
                            <div className="p-4 bg-card/50 rounded border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Avg Impact Score</p>
                                <p className="text-xl font-bold">{formatImpact(systemStats.avg_impact_score)}</p>
                            </div>
                            <div className="p-4 bg-card/50 rounded border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Actions Required</p>
                                <p className="text-xl font-bold text-yellow-400">{systemStats.total_actions_required}</p>
                            </div>
                            <div className="p-4 bg-card/50 rounded border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Last Processed</p>
                                <p className="text-sm font-medium">
                                    {new Date(systemStats.last_processed_at).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </Card>
                )}

                {activeTab === 'agents' && (
                    <div className="space-y-4">
                        {isLoading ? (
                            <Card>
                                <p className="text-center text-muted-foreground">Loading agents...</p>
                            </Card>
                        ) : agents.length === 0 ? (
                            <Card>
                                <p className="text-center text-muted-foreground">No agent data available</p>
                            </Card>
                        ) : (
                            agents.map((agent) => (
                                <Card key={agent.agent_key}>
                                    <div className="flex items-start gap-4">
                                        <div className="text-4xl">{AGENT_ICONS[agent.agent_key] || '🤖'}</div>
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-semibold text-lg">{agent.agent_name}</h4>
                                                    <p className="text-sm text-muted-foreground">{agent.agent_key}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold">{formatNumber(agent.total_messages)}</p>
                                                    <p className="text-xs text-muted-foreground">messages</p>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-4 mt-4">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Avg Impact</p>
                                                    <p className={`text-sm font-medium ${getImpactColor(agent.average_impact)}`}>
                                                        {formatImpact(agent.average_impact)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Action Required</p>
                                                    <p className="text-sm font-medium text-yellow-400">
                                                        {agent.action_required_count}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">High Priority</p>
                                                    <p className="text-sm font-medium text-red-400">
                                                        {agent.high_count || '0'}
                                                    </p>
                                                </div>
                                            </div>

                                            {agent.top_event_categories && agent.top_event_categories.length > 0 && (
                                                <div className="mt-3">
                                                    <p className="text-xs text-muted-foreground mb-1">Top Categories:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {agent.top_event_categories.slice(0, 5).map((cat, i) => (
                                                            <span
                                                                key={i}
                                                                className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded"
                                                            >
                                                                {cat}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'categories' && (
                    <Card>
                        <h3 className="text-lg font-semibold mb-4">Categories Distribution</h3>
                        <p className="text-sm text-muted-foreground">Coming soon: Category breakdown charts and timelines</p>
                    </Card>
                )}

                {activeTab === 'breaking' && (
                    <Card>
                        <h3 className="text-lg font-semibold mb-4">Breaking News Monitor</h3>
                        <p className="text-sm text-muted-foreground">Coming soon: Real-time breaking news alerts</p>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default TelegramDataPanel;
