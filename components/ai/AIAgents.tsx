import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAgent } from '../../types.ts';
import ErrorBoundary from '../ErrorBoundary.tsx';
import { getAgentControl } from './agentRegistry.ts';
import { AgentLoadingSpinner } from '../ui/LoadingSpinner';
import { AgentListSkeleton } from '../ui/SkeletonLoader';
import { useAgentFavorites } from '../../hooks/useAgentFavorites';
import { useDebounce } from '../../hooks/useDebounce';
import { useWebSocket, WebSocketMessage } from '../../hooks/useWebSocket.ts';
import { useExecutionRuntime } from '../../hooks/useExecutionRuntime.ts';
import AgentSafetyBanner from './AgentSafetyBanner.tsx';
import { useCapabilities } from '../../hooks/useCapabilities.ts';
import { AgentCard } from './AgentCard.tsx';
import { mapAgentOperationalState } from './shell/agentCardMeta.ts';

type StatusFilter = 'all' | 'ready' | 'paused' | 'error';
type SortMode = 'name' | 'last_run' | 'status';

const AIAgents: React.FC = () => {
    const { t } = useLanguage();
    const { runtime, loading: runtimeLoading } = useExecutionRuntime();
    const { has: hasCapability } = useCapabilities();
    const canExecute = hasCapability('AI_AGENT_EXECUTE_SAFE');
    const canRead = hasCapability('AI_AGENT_READ') || canExecute;
    const [isLoading, setIsLoading] = useState(true);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { isFavorite, toggleFavorite } = useAgentFavorites();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortMode, setSortMode] = useState<SortMode>('name');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const agentData = await api.fetchAIAgents();
            setAgents(agentData);
        } catch (e: any) {
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
        setSelectedAgent(prev => prev && prev.id === updatedAgent.id ? updatedAgent : prev);
    };

    const authToken = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token') || undefined;

    const getWebSocketUrl = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws/agents`;
    };

    const {
        isConnected,
        realtimeUnavailable,
        send,
        connect: reconnectRealtime,
    } = useWebSocket({
        url: getWebSocketUrl(),
        token: authToken,
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
                                lastUpdate: new Date().toISOString(),
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

    const showRealtimeDegraded = realtimeUnavailable && !isConnected;

    const filteredAgents = useMemo(() => {
        let filtered = [...agents];

        if (statusFilter !== 'all') {
            filtered = filtered.filter(agent => mapAgentOperationalState(agent.status) === statusFilter);
        }

        if (debouncedSearchTerm.trim()) {
            const searchLower = debouncedSearchTerm.toLowerCase();
            filtered = filtered.filter(agent => {
                const caps = (agent.capabilities || []).join(' ').toLowerCase();
                return (
                    agent.name.toLowerCase().includes(searchLower) ||
                    (agent.role || '').toLowerCase().includes(searchLower) ||
                    caps.includes(searchLower) ||
                    String(agent.agent_key || '').toLowerCase().includes(searchLower)
                );
            });
        }

        return filtered;
    }, [agents, statusFilter, debouncedSearchTerm]);

    const sortedAgents = useMemo(() => {
        const list = [...filteredAgents];
        list.sort((a, b) => {
            const aFav = isFavorite(a.id);
            const bFav = isFavorite(b.id);
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;

            if (sortMode === 'status') {
                return mapAgentOperationalState(a.status).localeCompare(mapAgentOperationalState(b.status));
            }
            if (sortMode === 'last_run') {
                const at = new Date(a.lastUpdate || 0).getTime();
                const bt = new Date(b.lastUpdate || 0).getTime();
                return bt - at;
            }
            return a.name.localeCompare(b.name);
        });
        return list;
    }, [filteredAgents, isFavorite, sortMode]);

    if (isLoading) {
        return <AgentListSkeleton count={6} />;
    }

    if (error) {
        return (
            <div className="text-center p-10 space-y-3" data-testid="agents-error">
                <p className="text-sm text-red-400">
                    {t('failed_to_load_data') || 'Failed to load AI agents.'}
                </p>
                <button
                    onClick={fetchData}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold"
                >
                    {t('retry') || 'Retry'}
                </button>
            </div>
        );
    }

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
                    <span>{t('agent_realtime_unavailable')}</span>
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
                    {t('agent_realtime_connected')}
                </div>
            )}

            <div className="mb-5 space-y-3">
                <div className="relative">
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('search_agents') || 'Search by name, purpose, or capability…'}
                        className="w-full px-4 py-2.5 pl-10 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        aria-label={t('search_agents') || 'Search agents'}
                        data-testid="agents-search"
                    />
                    <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <label className="text-xs text-muted-foreground" htmlFor="agents-status-filter">
                        {t('status') || 'Status'}
                    </label>
                    <select
                        id="agents-status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        className="text-xs bg-card border border-border rounded-md px-2 py-1.5 text-foreground"
                        data-testid="agents-status-filter"
                    >
                        <option value="all">{t('all') || 'All'}</option>
                        <option value="ready">{t('agent_state_ready') || 'Active'}</option>
                        <option value="paused">{t('agent_state_paused') || 'Paused'}</option>
                        <option value="error">{t('agent_state_error') || 'Error'}</option>
                    </select>

                    <label className="text-xs text-muted-foreground ms-1" htmlFor="agents-sort">
                        {t('sort') || 'Sort'}
                    </label>
                    <select
                        id="agents-sort"
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as SortMode)}
                        className="text-xs bg-card border border-border rounded-md px-2 py-1.5 text-foreground"
                        data-testid="agents-sort"
                    >
                        <option value="name">{t('sort_by_name') || 'Name'}</option>
                        <option value="last_run">{t('sort_by_last_run') || 'Last Run'}</option>
                        <option value="status">{t('sort_by_status') || 'Status'}</option>
                    </select>

                    {(debouncedSearchTerm || statusFilter !== 'all') && (
                        <span className="text-xs text-muted-foreground ms-auto">
                            {t('showing_results', { count: sortedAgents.length, total: agents.length }) ||
                                `${sortedAgents.length} / ${agents.length}`}
                        </span>
                    )}
                </div>
            </div>

            {sortedAgents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="agents-grid">
                    {sortedAgents.map(agent => (
                        <AgentCard
                            key={agent.id}
                            agent={agent}
                            onOpen={() => setSelectedAgent(agent)}
                            isFavorite={isFavorite(agent.id)}
                            onToggleFavorite={() => toggleFavorite(agent.id)}
                            canOpen={canRead}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12" data-testid="agents-empty">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        {t('no_agents_found') || 'No agents found'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        {t('try_different_search') || 'Try adjusting your search or status filter'}
                    </p>
                    {(searchTerm || statusFilter !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setStatusFilter('all');
                            }}
                            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-sm font-semibold"
                        >
                            {t('clear_filters') || 'Clear filters'}
                        </button>
                    )}
                </div>
            )}

            {selectedAgent && agentRegistryEntry && (
                <ErrorBoundary fallbackTitle={agentRegistryEntry.fallbackTitle}>
                    <Suspense fallback={
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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

export default AIAgents;
