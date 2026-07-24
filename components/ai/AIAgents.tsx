import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAgent } from '../../types.ts';
import ErrorBoundary from '../ErrorBoundary.tsx';
import { getAgentControl } from './agentRegistry.ts';
import { AgentLoadingSpinner } from '../ui/LoadingSpinner';
import { useDebounce } from '../../hooks/useDebounce';
import { useWebSocket, WebSocketMessage } from '../../hooks/useWebSocket.ts';
import { useExecutionRuntime } from '../../hooks/useExecutionRuntime.ts';
import AgentSafetyBanner from './AgentSafetyBanner.tsx';
import { useCapabilities } from '../../hooks/useCapabilities.ts';
import { AgentCard } from './AgentCard.tsx';
import { mapAgentOperationalStateFromAgent } from './shell/agentCardMeta.ts';
import { mapProductStateToFilterBucket, resolveAgentProductStatus } from '../../utils/agentProductStatus.ts';
import {
  BTN_SECONDARY,
  DataHubAlert,
  DataHubEmpty,
  INPUT_CLASS,
  SELECT_CLASS,
} from './shell/agentsShellUi.ts';
import Skeleton from '../ui/skeleton';

type StatusFilter = 'all' | 'ready' | 'paused' | 'error' | 'running';
type SortMode = 'name' | 'last_run' | 'status';

function getAgentsResultsLabel(
  t: (key: string, options?: { [key: string]: string | number }) => string,
  visibleCount: number,
  totalCount: number,
  hasActiveFilters: boolean,
) {
  if (visibleCount <= 0) {
    return t('agents_results_none');
  }
  if (visibleCount === 1) {
    return t('agents_results_one');
  }
  if (hasActiveFilters && visibleCount !== totalCount) {
    return t('agents_results_filtered', { count: visibleCount, total: totalCount });
  }
  return t('agents_results_all', { count: visibleCount });
}

const AgentsShellSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div
    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4"
    data-testid="agents-loading-skeleton"
    role="status"
    aria-label="loading"
  >
    <span className="sr-only">loading</span>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 rounded-xl p-4 space-y-3"
      >
        <div className="flex justify-between gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full ms-auto" />
      </div>
    ))}
  </div>
);

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
                    const completedAt =
                        agentData.completed_at ||
                        agentData.result?.completed_at ||
                        (agentData.event === 'execution_completed' ? message.timestamp : null);
                    setAgents(prev => prev.map(a => {
                        if (a.id === agentData.agent_id) {
                            return {
                                ...a,
                                status: agentData.new_status || a.status,
                                accuracy: agentData.result?.confidence != null
                                    ? agentData.result.confidence * 100
                                    : a.accuracy,
                                ...(completedAt ? { lastUpdate: completedAt } : {}),
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

    const killSwitchActive = runtime?.killSwitchActive !== false;
    const effectiveMode = runtime?.globalMode || runtime?.effectiveMode || 'demo';
    const gateContext = { killSwitchActive, effectiveMode };

    const filteredAgents = useMemo(() => {
        let filtered = [...agents];

        if (statusFilter !== 'all') {
            filtered = filtered.filter(agent => {
                const bucket = mapProductStateToFilterBucket(
                    resolveAgentProductStatus(agent, gateContext),
                );
                return bucket === statusFilter;
            });
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
    }, [agents, statusFilter, debouncedSearchTerm, killSwitchActive, effectiveMode]);

    const sortedAgents = useMemo(() => {
        const list = [...filteredAgents];
        list.sort((a, b) => {
            if (sortMode === 'status') {
                return mapAgentOperationalStateFromAgent(a, gateContext).localeCompare(
                    mapAgentOperationalStateFromAgent(b, gateContext),
                );
            }
            if (sortMode === 'last_run') {
                const at = new Date(a.lastUpdate || 0).getTime();
                const bt = new Date(b.lastUpdate || 0).getTime();
                return bt - at;
            }
            return a.name.localeCompare(b.name);
        });
        return list;
    }, [filteredAgents, sortMode, killSwitchActive, effectiveMode]);

    if (isLoading) {
        return <AgentsShellSkeleton count={6} />;
    }

    if (error) {
        return (
            <div className="space-y-3" data-testid="agents-error">
                <DataHubAlert
                    variant="error"
                    message={t('failed_to_load_data') || 'Failed to load AI agents.'}
                    onRetry={fetchData}
                    retryLabel={t('retry') || 'Retry'}
                />
            </div>
        );
    }

    const agentRegistryEntry = selectedAgent ? getAgentControl(selectedAgent.agent_key) : null;
    const hasActiveFilters = Boolean(debouncedSearchTerm) || statusFilter !== 'all';
    const emptyMessage = hasActiveFilters
        ? t('try_different_search')
        : t('no_agents_found');
    const resultsLabel = getAgentsResultsLabel(t, sortedAgents.length, agents.length, hasActiveFilters);

    return (
        <>
            <AgentSafetyBanner runtime={runtime} canExecute={canExecute} loading={runtimeLoading} />

            {showRealtimeDegraded && (
                <div className="mb-4" data-testid="agent-realtime-unavailable">
                    <DataHubAlert
                        variant="warning"
                        message={t('agent_realtime_unavailable')}
                        onRetry={() => reconnectRealtime({ force: true })}
                        retryLabel={t('retry') || 'Retry'}
                    />
                </div>
            )}
            {isConnected && (
                <div className="sr-only" data-testid="agent-realtime-connected" aria-live="polite">
                    {t('agent_realtime_connected')}
                </div>
            )}

            {!canRead && (
                <div className="mb-4" data-testid="agents-permission-limited">
                    <DataHubAlert
                        variant="warning"
                        message={t('agents_permission_limited') ||
                            'Your role has limited agent access. Some actions may be unavailable.'}
                    />
                </div>
            )}

            <div className="mb-4 md:mb-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3">
                    <div className="relative flex-1 min-w-0">
                        <label htmlFor="agents-search" className="sr-only">
                            {t('search_agents') || 'Search agents'}
                        </label>
                        <input
                            id="agents-search"
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('search_agents') || 'Search by name, purpose, or capability…'}
                            className={`${INPUT_CLASS} pl-9`}
                            aria-label={t('search_agents') || 'Search agents'}
                            data-testid="agents-search"
                        />
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end shrink-0 w-full md:w-auto">
                        <div className="flex-1 sm:flex-initial min-w-[9rem]">
                            <label className="text-[11px] text-muted-foreground mb-1 block" htmlFor="agents-status-filter">
                                {t('status') || 'Status'}
                            </label>
                            <select
                                id="agents-status-filter"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                                className={SELECT_CLASS}
                                data-testid="agents-status-filter"
                            >
                                <option value="all">{t('all') || 'All'}</option>
                                <option value="ready">{t('agent_state_ready') || 'Ready'}</option>
                                <option value="running">{t('agent_state_running') || 'Running'}</option>
                                <option value="paused">{t('agent_state_paused') || 'Paused'}</option>
                                <option value="error">{t('agent_state_error') || 'Error'}</option>
                            </select>
                        </div>

                        <div className="flex-1 sm:flex-initial min-w-[9rem]">
                            <label className="text-[11px] text-muted-foreground mb-1 block" htmlFor="agents-sort">
                                {t('sort') || 'Sort'}
                            </label>
                            <select
                                id="agents-sort"
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value as SortMode)}
                                className={SELECT_CLASS}
                                data-testid="agents-sort"
                            >
                                <option value="name">{t('sort_by_name') || 'Name'}</option>
                                <option value="last_run">{t('sort_by_last_run') || 'Last Run'}</option>
                                <option value="status">{t('sort_by_status') || 'Status'}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <p
                    className="text-[11px] text-muted-foreground mt-2"
                    aria-live="polite"
                    data-testid="agents-results-count"
                >
                    {resultsLabel}
                </p>
            </div>

            {sortedAgents.length > 0 ? (
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 items-stretch"
                    data-testid="agents-grid"
                >
                    {sortedAgents.map(agent => (
                        <AgentCard
                            key={agent.id}
                            agent={agent}
                            onOpen={() => setSelectedAgent(agent)}
                            canOpen={canRead}
                        />
                    ))}
                </div>
            ) : (
                <div data-testid="agents-empty" className="space-y-3">
                    <DataHubEmpty message={emptyMessage} />
                    {hasActiveFilters && (
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setStatusFilter('all');
                                }}
                                className={`${BTN_SECONDARY} focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`}
                                aria-label={t('clear_filters')}
                                data-testid="agents-clear-filters"
                            >
                                {t('clear_filters')}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {selectedAgent && agentRegistryEntry && (
                <ErrorBoundary fallbackTitle={agentRegistryEntry.fallbackTitle}>
                    <Suspense fallback={
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                            <div className="relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl p-8">
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
