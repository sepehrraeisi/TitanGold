import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAppContext } from '../../context/AppContext.tsx';
import * as api from '../../services/api.ts';
import { AIAgent } from '../../types.ts';
import ErrorBoundary from '../ErrorBoundary.tsx';
import { getAgentControl } from './agentRegistry.ts';
import LoadingSpinner, { AgentLoadingSpinner } from '../ui/LoadingSpinner';
import SkeletonLoader, { AgentListSkeleton } from '../ui/SkeletonLoader';
import { useAgentFavorites } from '../../hooks/useAgentFavorites';
import { useDebounce } from '../../hooks/useDebounce';
import { useWebSocket, WebSocketMessage } from '../../hooks/useWebSocket.ts';
import { useExecutionRuntime } from '../../hooks/useExecutionRuntime.ts';
import AgentSafetyBanner from './AgentSafetyBanner.tsx';
import { useCapabilities } from '../../hooks/useCapabilities.ts';

const AIAgents: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAppContext();
    const { runtime, loading: runtimeLoading } = useExecutionRuntime();
    const { has: hasCapability } = useCapabilities();
    const canExecute = hasCapability('AI_AGENT_EXECUTE_SAFE');
    const [isLoading, setIsLoading] = useState(true);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { isFavorite, toggleFavorite } = useAgentFavorites();

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Debounced search term (300ms delay)
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const agentData = await api.fetchAIAgents();
            setAgents(agentData);
        } catch (e: any) {
            console.error('Failed to load AI agents:', e);
            const message = e?.message || e?.toString() || 'Unknown error';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAgentUpdate = (updatedAgent: AIAgent) => {
        setAgents(prev => prev.map(a => a.id === updatedAgent.id ? updatedAgent : a));
        // Only update selected agent if it's the one being updated
        setSelectedAgent(prev => prev && prev.id === updatedAgent.id ? updatedAgent : prev);
    };

    // 🚀 WebSocket for Real-time Agent Updates
    const authToken = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token') || undefined;

    const getWebSocketUrl = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/ws/agents`;
    };

    const {
        isConnected,
        realtimeUnavailable,
        send,
        connect: reconnectRealtime,
    } = useWebSocket({
        url: getWebSocketUrl(),
        token: authToken,
        // Bounded attempts + sticky unavailable (no flash / spam)
        maxReconnectAttempts: 3,
        reconnectInterval: 2000,
        quiet: true,
        onMessage: (message: WebSocketMessage) => {
            if (message.type === 'agent_update' && message.data) {
                const agentData = message.data;
                if (agentData.agent_id) {
                    setAgents(prev => prev.map(a => {
                        if (a.id === agentData.agent_id) {
                            return {
                                ...a,
                                status: agentData.new_status || a.status,
                                accuracy: agentData.result?.confidence != null
                                    ? agentData.result.confidence * 100
                                    : a.accuracy,
                                lastUpdate: new Date().toISOString()
                            };
                        }
                        return a;
                    }));
                }
            } else if (message.type === 'connected') {
                send({ type: 'subscribe', payload: { channel: 'agent:*' } });
            }
        },
    });
    // Sticky degraded banner only — never oscillate while unavailable.
    const showRealtimeDegraded = realtimeUnavailable && !isConnected;

    // Extract unique categories from agents
    const categories = useMemo(() => {
        const uniqueCategories = new Set(agents.map(agent => agent.role));
        return ['all', ...Array.from(uniqueCategories).sort()];
    }, [agents]);

    // Filter and search agents
    const filteredAgents = useMemo(() => {
        let filtered = [...agents];

        // Apply category filter
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(agent => agent.role === selectedCategory);
        }

        // Apply search filter
        if (debouncedSearchTerm.trim()) {
            const searchLower = debouncedSearchTerm.toLowerCase();
            filtered = filtered.filter(agent =>
                agent.name.toLowerCase().includes(searchLower) ||
                agent.role.toLowerCase().includes(searchLower) ||
                agent.capabilities.some(cap => cap.toLowerCase().includes(searchLower))
            );
        }

        return filtered;
    }, [agents, selectedCategory, debouncedSearchTerm]);

    // Sort agents: favorites first, then by name
    const sortedAgents = useMemo(() => {
        return [...filteredAgents].sort((a, b) => {
            const aFav = isFavorite(a.id);
            const bFav = isFavorite(b.id);

            // Favorites first
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;

            // Then sort by name
            return a.name.localeCompare(b.name);
        });
    }, [filteredAgents, isFavorite]);

    if (isLoading) {
        return <AgentListSkeleton count={6} />;
    }

    if (error) {
        return (
            <div className="text-center p-10 space-y-3">
                <p className="text-sm text-red-400">
                    {t('failed_to_load_data') || 'Failed to load AI agents.'}
                </p>
                <button
                    onClick={fetchData}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
                >
                    {t('retry') || 'Retry'}
                </button>
            </div>
        );
    }

    // Get the agent control component dynamically
    const agentRegistryEntry = selectedAgent ? getAgentControl(selectedAgent.agent_key) : null;

    return (
        <>
            <AgentSafetyBanner runtime={runtime} canExecute={canExecute} loading={runtimeLoading} />
            {showRealtimeDegraded && (
                <div
                    className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100/90 flex flex-wrap items-center justify-between gap-2"
                    role="status"
                    data-testid="agent-realtime-unavailable"
                >
                    <span>
                        {t('agent_realtime_unavailable')}
                    </span>
                    <button
                        type="button"
                        onClick={() => reconnectRealtime({ force: true })}
                        className="px-3 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-50 hover:bg-amber-500/30 font-semibold"
                        data-testid="agent-realtime-retry"
                    >
                        {t('retry')}
                    </button>
                </div>
            )}
            {isConnected && (
                <div className="sr-only" data-testid="agent-realtime-connected" aria-live="polite">
                    {t('agent_realtime_connected') || 'Realtime updates connected'}
                </div>
            )}
            {/* Search and Filter Bar */}
            <div className="mb-6 space-y-4">
                {/* Search Input */}
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('search_agents') || 'Search agents by name, role, or capability...'}
                        className="w-full px-4 py-3 pl-10 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        aria-label="Search agents"
                    />
                    <svg
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-muted-foreground">
                        {t('filter_by_category') || 'Filter by category:'}
                    </span>
                    <div className="flex gap-2 flex-wrap">
                        {categories.map(category => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`
                                    px-4 py-1.5 rounded-full text-sm font-medium transition-all
                                    ${selectedCategory === category
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-secondary text-foreground hover:bg-purple-100 dark:hover:bg-purple-900'
                                    }
                                `}
                                aria-label={`Filter by ${category}`}
                                aria-pressed={selectedCategory === category}
                            >
                                {category === 'all' ? t('all_categories') || 'All' : category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results Count */}
                {(debouncedSearchTerm || selectedCategory !== 'all') && (
                    <div className="text-sm text-muted-foreground">
                        {t('showing_results', { count: sortedAgents.length, total: agents.length }) ||
                            `Showing ${sortedAgents.length} of ${agents.length} agents`}
                    </div>
                )}
            </div>

            {/* Agent Grid */}
            {sortedAgents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedAgents.map(agent => (
                        <AgentCard
                            key={agent.id}
                            agent={agent}
                            onOpenControlPanel={() => setSelectedAgent(agent)}
                            isFavorite={isFavorite(agent.id)}
                            onToggleFavorite={() => toggleFavorite(agent.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                        {t('no_agents_found') || 'No agents found'}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                        {t('try_different_search') || 'Try adjusting your search or filter criteria'}
                    </p>
                    {(searchTerm || selectedCategory !== 'all') && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('all');
                            }}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold"
                        >
                            {t('clear_filters') || 'Clear all filters'}
                        </button>
                    )}
                </div>
            )}

            {/* Lazy-loaded agent control panel with loading spinner */}
            {selectedAgent && agentRegistryEntry && (
                <ErrorBoundary fallbackTitle={agentRegistryEntry.fallbackTitle}>
                    <Suspense fallback={
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-card border border-border rounded-lg p-8">
                                <AgentLoadingSpinner agentName={selectedAgent.name} />
                            </div>
                        </div>
                    }>
                        <agentRegistryEntry.component
                            agent={selectedAgent}
                            onClose={() => setSelectedAgent(null)}
                            onUpdate={handleAgentUpdate}
                        />
                    </Suspense>
                </ErrorBoundary>
            )}
        </>
    );
};

const AgentCard: React.FC<{
    agent: AIAgent;
    onOpenControlPanel: () => void;
    isFavorite: boolean;
    onToggleFavorite: () => void;
}> = ({ agent, onOpenControlPanel, isFavorite, onToggleFavorite }) => {
    const { t } = useLanguage();

    return (
        <div
          className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between relative"
          data-agent-key={agent.agent_key}
          data-testid={`agent-card-${agent.agent_key}`}
        >
            {/* Favorite Star Icon */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                }}
                className="absolute top-3 right-3 text-2xl hover:scale-110 transition-transform z-10"
                title={isFavorite ? t('remove_from_favorites') || 'Remove from favorites' : t('add_to_favorites') || 'Add to favorites'}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
                {isFavorite ? '⭐' : '☆'}
            </button>

            <div>
                <div className="flex justify-between items-start pr-8">
                    <div>
                        <h3 className="font-bold text-foreground">{agent.name}: {agent.role}</h3>
                        <p className={`text-xs font-semibold ${agent.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>{t(agent.status)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-purple-400">
                            {agent.accuracy != null && Number(agent.accuracy) > 0
                                ? `${Number(agent.accuracy).toFixed(1)}%`
                                : (t('not_available') || 'N/A')}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('accuracy')}</p>
                    </div>
                </div>
                <div className="my-4 space-y-2 text-xs">
                    <ProgressBar label={t('training_progress')} value={agent.trainingProgress} />
                    <Metric label={t('decisions')} value={agent.decisions.toLocaleString()} />
                    <Metric label={t('learning_time_hours')} value={agent.learningTime.toLocaleString()} />
                    <Metric label={t('knowledge_size_mb')} value={`${agent.knowledgeSize.toFixed(1)}MB`} />
                </div>
                <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">{t('capabilities')}</h4>
                    <div className="flex flex-wrap gap-1">
                        {agent.capabilities.map(c => <span key={c} className="text-xs bg-secondary px-2 py-0.5 rounded">{c}</span>)}
                    </div>
                </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                <button
                    onClick={onOpenControlPanel}
                    data-testid={`agent-open-${agent.agent_key}`}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1 px-3 rounded-md"
                >
                    {t('control_panel')}
                </button>
                <span className="text-xs text-muted-foreground">{t('last_update')}: {new Date(agent.lastUpdate).toLocaleTimeString()}</span>
            </div>
        </div>
    )
};

const Metric: React.FC<{ label: string, value: string }> = ({ label, value }) => (
    <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
    </div>
);

const ProgressBar: React.FC<{ label: string, value: number }> = ({ label, value }) => (
    <div>
        <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground font-semibold">{value.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${value}%` }}></div>
        </div>
    </div>
);

export default AIAgents;