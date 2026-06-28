import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    SELECT_CLASS,
    DataHubAlert,
    DataHubEmpty,
    DataHubSectionHeader,
    DataHubSegmentedControl,
    DataHubToolbar,
    DataHubFilterBar,
    DataHubLoadingSpinner,
    MetricCard,
    PrimaryButton,
    SecondaryButton,
    StatusPill,
    priorityVariant,
    sentimentVariant,
    formatTimeRangeLabel,
    TIME_RANGE_OPTIONS,
} from './dataHubUi';

interface AgentMessage {
  id: string;
  message_id: number;
  channel_title: string;
  cleaned_text: string;
  sentiment: string;
  importance_level: string;
  impact_score: string;
  impact_type: string;
  confidence: string;
  relevance_reasons: string[];
  requires_action: boolean;
  action_type: string | null;
  priority_level: string;
  telegram_created_at: string;
  processed_at: string;
}

interface AgentStats {
  agent_key: string;
  agent_name: string;
  total_messages: number;
  action_required_count: number;
  avg_impact_score: number;
  high_priority_count: number;
  last_activity: string;
}

interface AgentDetailPanelProps {
  agentKey: string;
  agentName: string;
  onClose: () => void;
  t: (key: string) => string;
  Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

const AGENT_ICONS: Record<string, string> = {
  technical: '📈',
  trend: '📊',
  sentiment: '💭',
  arbitrage: '⚖️',
  risk: '⚠️',
  liquidity: '💧',
  news: '📰',
  economic: '💰',
  social: '👥',
  correlation: '🔗',
  volatility: '📉',
  momentum: '🚀',
  pattern: '🔍',
  event: '📅',
  regulatory: '⚖️',
};

const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({
  agentKey,
  agentName,
  onClose,
  t,
  Card,
}) => {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(168); // 7 days
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<AgentMessage | null>(null);

  const LIMIT = 20;

  const getAuthHeaders = () => {
    const token =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token')
        : null;
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  useEffect(() => {
    fetchAgentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey, timeRange, priorityFilter, actionFilter, page]);

  const fetchAgentData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query parameters
      let url = `/api/v1/telegram/agents/${agentKey}/feed?timeRange=${timeRange}&limit=${LIMIT}&offset=${
        (page - 1) * LIMIT
      }`;

      if (priorityFilter) {
        url += `&priority=${priorityFilter}`;
      }

      if (actionFilter !== null) {
        url += `&requiresAction=${actionFilter}`;
      }

      // Attach auth token similar to other secured endpoints
      const response = await axios.get(url, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });

      if (response.data.success) {
        const newMessages = response.data.data;

        // Update messages (append for pagination)
        if (page === 1) {
          setMessages(newMessages);
        } else {
          setMessages((prev) => [...prev, ...newMessages]);
        }

        // Check if there are more
        setHasMore(newMessages.length === LIMIT);

        // Update stats
        if (response.data.stats) {
          setStats(response.data.stats);
        }
      } else {
        setError(response.data.message || 'Failed to fetch agent data');
        setHasMore(false);
      }
    } catch (err: any) {
      // Graceful handling for not-yet-implemented backend
      if (err.response?.status === 404) {
        setError('Agent feed API is not available yet for this environment.');
        setHasMore(false);
        setMessages([]);
        setStats(null);
      } else {
        const msg =
          err.response?.data?.message ||
          err.message ||
          'Agent feed is currently not available.';
        setError(msg);
        setHasMore(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  const handleMarkProcessed = async (messageId: string) => {
    try {
      await axios.post(
        `/api/v1/telegram/agents/${agentKey}/mark-processed`,
        { message_ids: [messageId] },
        {
          withCredentials: true,
          headers: getAuthHeaders(),
        },
      );

      // Remove from list
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err: unknown) {
      console.error('Failed to mark processed:', err);
      setError(t('datahub_error_generic'));
    }
  };

  const resetFilters = () => {
    setPriorityFilter(null);
    setActionFilter(null);
    setPage(1);
  };

  const getImpactColor = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 0.7) return 'text-red-400';
    if (numScore >= 0.5) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'critical') return 'bg-red-500';
    if (priority === 'high') return 'bg-orange-500';
    if (priority === 'medium') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      <Card className={DATAHUB_SHELL}>
        <DataHubSectionHeader
          title={agentName}
          subtitle={`Agent Key: ${agentKey}`}
          actions={
            <SecondaryButton type="button" onClick={onClose}>
              ← {t('back') || 'Back to agents'}
            </SecondaryButton>
          }
        />
      </Card>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
          <MetricCard label="Total Messages" value={stats.total_messages} color="blue" />
          <MetricCard label="Action Required" value={stats.action_required_count} color="red" />
          <MetricCard
            label="Avg Impact"
            value={`${(stats.avg_impact_score * 100).toFixed(0)}%`}
            color="purple"
          />
          <MetricCard label="High Priority" value={stats.high_priority_count} color="amber" />
          <MetricCard
            label="Last Activity"
            value={
              stats.last_activity
                ? formatDistanceToNow(new Date(stats.last_activity), { addSuffix: true })
                : 'N/A'
            }
            color="emerald"
          />
        </div>
      )}

      <Card className={DATAHUB_SHELL}>
        <DataHubToolbar>
          <DataHubFilterBar>
            <span className="text-[11px] text-muted-foreground">Time:</span>
            <DataHubSegmentedControl
              ariaLabel="Time range"
              value={timeRange}
              onChange={hours => {
                setTimeRange(hours);
                setPage(1);
              }}
              options={TIME_RANGE_OPTIONS.map(hours => ({
                value: hours,
                label: formatTimeRangeLabel(hours),
              }))}
            />
            <span className="text-[11px] text-muted-foreground">Priority:</span>
            <select
              value={priorityFilter || ''}
              onChange={(e) => {
                setPriorityFilter(e.target.value || null);
                setPage(1);
              }}
              className={SELECT_CLASS}
              aria-label="Priority filter"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <span className="text-[11px] text-muted-foreground">Action:</span>
            <select
              value={actionFilter === null ? '' : actionFilter.toString()}
              onChange={(e) => {
                const val = e.target.value;
                setActionFilter(val === '' ? null : val === 'true');
                setPage(1);
              }}
              className={SELECT_CLASS}
              aria-label="Action filter"
            >
              <option value="">All</option>
              <option value="true">Required</option>
              <option value="false">Not Required</option>
            </select>
          </DataHubFilterBar>
          <SecondaryButton type="button" onClick={resetFilters}>
            🔄 Reset Filters
          </SecondaryButton>
        </DataHubToolbar>
      </Card>

      {error && <DataHubAlert variant="error" message={error} onRetry={fetchAgentData} retryLabel={t('retry')} />}

      <div className="space-y-4">
        {isLoading && messages.length === 0 && (
          <DataHubLoadingSpinner message={t('loading') || 'Loading messages…'} />
        )}
        {!isLoading && messages.length === 0 && !error && (
          <DataHubEmpty message={t('no_messages') || 'No messages found for this agent.'} />
        )}
        {messages.map((msg) => (
          <Card
            key={msg.id}
            className={`${DATAHUB_INNER_LIST} ${msg.requires_action ? 'border-l-4 border-l-red-500/80' : ''}`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill
                    label={msg.priority_level.toUpperCase()}
                    variant={priorityVariant(msg.priority_level)}
                  />
                  <StatusPill
                    label={`Impact: ${(parseFloat(msg.impact_score) * 100).toFixed(0)}%`}
                    variant={
                      parseFloat(msg.impact_score) >= 0.7
                        ? 'error'
                        : parseFloat(msg.impact_score) >= 0.5
                          ? 'warning'
                          : 'success'
                    }
                  />
                  <StatusPill
                    label={`Confidence: ${(parseFloat(msg.confidence) * 100).toFixed(0)}%`}
                    variant="info"
                  />
                  <StatusPill label={msg.sentiment} variant={sentimentVariant(msg.sentiment)} />
                  {msg.requires_action && (
                    <StatusPill label={`⚠️ ${t('action_required') || 'ACTION REQUIRED'}`} variant="error" />
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(msg.telegram_created_at), { addSuffix: true })}
                </span>
              </div>

              {/* Source */}
              <div className="text-xs text-muted-foreground">
                📢 {msg.channel_title} • {msg.impact_type || 'General'}
              </div>

              {/* Message Text */}
              <p className="text-foreground leading-relaxed">{msg.cleaned_text}</p>

              {/* Relevance Reasons */}
              {msg.relevance_reasons && msg.relevance_reasons.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Relevance Reasons:</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.relevance_reasons.map((reason, i) => (
                      <span
                        key={reason + i}
                        className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded"
                      >
                        • {reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                <PrimaryButton type="button" onClick={() => handleMarkProcessed(msg.id)}>
                  ✓ Mark Processed
                </PrimaryButton>
                <SecondaryButton type="button" onClick={() => setSelectedMessage(msg)}>
                  📋 View Details
                </SecondaryButton>
                {msg.requires_action && msg.action_type && (
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      console.log('Execute action:', msg.action_type);
                    }}
                  >
                    🎯 Execute: {msg.action_type}
                  </SecondaryButton>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {hasMore && !isLoading && messages.length > 0 && (
        <div className="text-center">
          <PrimaryButton type="button" onClick={handleLoadMore}>
            Load More Messages
          </PrimaryButton>
        </div>
      )}

      {isLoading && messages.length > 0 && (
        <DataHubLoadingSpinner message={t('loading') || 'Loading…'} size="sm" />
      )}

      {/* View Details Modal */}
      {selectedMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMessage(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div>
                <p className="text-[11px] text-purple-300/80 mb-0.5">
                  Telegram AI Inbox – {agentName}
                </p>
                <h3 className="text-sm md:text-base font-semibold text-foreground">
                  {selectedMessage.channel_title || 'Unknown channel'}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ID: <span className="font-mono">{selectedMessage.message_id}</span> •{' '}
                  {formatDistanceToNow(new Date(selectedMessage.telegram_created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="text-slate-400 hover:text-slate-100 text-lg"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2 py-1 text-[11px] rounded-full text-white ${getPriorityColor(
                    selectedMessage.priority_level,
                  )}`}
                >
                  {selectedMessage.priority_level.toUpperCase()}
                </span>
                <span
                  className={`px-2 py-1 text-[11px] rounded-full bg-slate-900 border border-slate-700 ${getImpactColor(
                    selectedMessage.impact_score,
                  )}`}
                >
                  Impact: {(parseFloat(selectedMessage.impact_score) * 100).toFixed(0)}%
                </span>
                <span className="px-2 py-1 text-[11px] rounded-full bg-slate-900 border border-slate-700 text-blue-300">
                  Confidence: {(parseFloat(selectedMessage.confidence) * 100).toFixed(0)}%
                </span>
                <span
                  className={`px-2 py-1 text-[11px] rounded-full ${
                    selectedMessage.sentiment === 'positive'
                      ? 'bg-green-500/20 text-green-300'
                      : selectedMessage.sentiment === 'negative'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-gray-500/20 text-gray-300'
                  }`}
                >
                  {selectedMessage.sentiment === 'positive'
                    ? '😊'
                    : selectedMessage.sentiment === 'negative'
                      ? '😟'
                      : '😐'}{' '}
                  {selectedMessage.sentiment}
                </span>
                {selectedMessage.requires_action && (
                  <span className="px-2 py-1 text-[11px] rounded-full bg-red-500/20 text-red-300 border border-red-500/50">
                    ⚠️ ACTION REQUIRED
                  </span>
                )}
                {selectedMessage.importance_level && (
                  <span className="px-2 py-1 text-[11px] rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/50">
                    Importance: {selectedMessage.importance_level}
                  </span>
                )}
              </div>

              {/* Message text */}
              <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4">
                <p className="text-xs md:text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {selectedMessage.cleaned_text}
                </p>
              </div>

              {/* Relevance reasons */}
              {selectedMessage.relevance_reasons &&
                selectedMessage.relevance_reasons.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Relevance Reasons
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedMessage.relevance_reasons.map((reason, i) => (
                        <span
                          key={reason + i}
                          className="px-2 py-0.5 text-[11px] bg-purple-500/20 text-purple-300 rounded-full"
                        >
                          • {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Meta info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="mb-1 text-slate-300">Timestamps</p>
                  <p>Telegram: {new Date(selectedMessage.telegram_created_at).toLocaleString()}</p>
                  <p>
                    Processed:{' '}
                    {selectedMessage.processed_at
                      ? new Date(selectedMessage.processed_at).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="mb-1 text-slate-300">IDs</p>
                  <p>
                    Message ID: <span className="font-mono">{selectedMessage.message_id}</span>
                  </p>
                  <p>
                    Internal ID: <span className="font-mono">{selectedMessage.id}</span>
                  </p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="mb-1 text-slate-300">Agent</p>
                  <p>{agentName}</p>
                  <p className="font-mono text-slate-300">{agentKey}</p>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="px-3 py-1.5 text-xs md:text-sm rounded-full bg-slate-700 hover:bg-slate-600 text-white"
              >
                Close
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleMarkProcessed(selectedMessage.id)}
                  className="px-3 py-1.5 text-xs md:text-sm rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  ✓ Mark Processed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDetailPanel;

