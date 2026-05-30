import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

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
      {/* Header */}
      <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl md:text-4xl">{AGENT_ICONS[agentKey] || '🤖'}</div>
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-foreground">{agentName}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Agent Key: <span className="font-mono">{agentKey}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs md:text-sm rounded-full border border-slate-700 text-slate-100 bg-slate-900/70 hover:border-purple-400 hover:text-purple-200 transition-colors"
          >
            ← Back to agents
          </button>
        </div>
      </Card>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-slate-900/60 border border-white/5 rounded-lg">
            <div className="text-center p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Total Messages</p>
              <p className="text-lg md:text-2xl font-semibold text-foreground">{stats.total_messages}</p>
            </div>
          </Card>
          <Card className="bg-slate-900/60 border border-white/5 rounded-lg">
            <div className="text-center p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Action Required</p>
              <p className="text-lg md:text-2xl font-semibold text-red-300">
                {stats.action_required_count}
              </p>
            </div>
          </Card>
          <Card className="bg-slate-900/60 border border-white/5 rounded-lg">
            <div className="text-center p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Avg Impact</p>
              <p
                className={`text-lg md:text-2xl font-semibold ${getImpactColor(
                  stats.avg_impact_score.toString(),
                )}`}
              >
                {(stats.avg_impact_score * 100).toFixed(0)}%
              </p>
            </div>
          </Card>
          <Card className="bg-slate-900/60 border border-white/5 rounded-lg">
            <div className="text-center p-3">
              <p className="text-[11px] text-muted-foreground mb-1">High Priority</p>
              <p className="text-lg md:text-2xl font-semibold text-orange-300">
                {stats.high_priority_count}
              </p>
            </div>
          </Card>
          <Card className="bg-slate-900/60 border border-white/5 rounded-lg">
            <div className="text-center p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Last Activity</p>
              <p className="text-xs font-mono text-slate-200">
                {stats.last_activity
                  ? formatDistanceToNow(new Date(stats.last_activity), { addSuffix: true })
                  : 'N/A'}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-slate-950/70 border border-white/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Time Range */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Time:</span>
            {[24, 48, 168, 720].map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => {
                  setTimeRange(hours);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs md:text-sm rounded-full border border-slate-700 transition-colors ${
                  timeRange === hours
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-slate-950/60 text-muted-foreground hover:bg-slate-900'
                }`}
              >
                {hours === 24 ? '24h' : hours === 48 ? '2d' : hours === 168 ? '7d' : '30d'}
              </button>
            ))}
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Priority:</span>
            <select
              value={priorityFilter || ''}
              onChange={(e) => {
                setPriorityFilter(e.target.value || null);
                setPage(1);
              }}
              className="px-2 py-1 text-xs md:text-sm bg-slate-900 border border-slate-700 rounded text-foreground"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Action:</span>
            <select
              value={actionFilter === null ? '' : actionFilter.toString()}
              onChange={(e) => {
                const val = e.target.value;
                setActionFilter(val === '' ? null : val === 'true');
                setPage(1);
              }}
              className="px-2 py-1 text-xs md:text-sm bg-slate-900 border border-slate-700 rounded text-foreground"
            >
              <option value="">All</option>
              <option value="true">Required</option>
              <option value="false">Not Required</option>
            </select>
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-1 text-xs md:text-sm rounded-full border border-slate-700 text-slate-100 bg-slate-900/70 hover:border-purple-400 hover:text-purple-200 transition-colors"
          >
            🔄 Reset Filters
          </button>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm font-medium text-red-200 mb-1">Agent feed error</p>
          <p className="text-[11px] text-red-300">{error}</p>
        </div>
      )}

      {/* Messages Feed */}
      <div className="space-y-4">
        {messages.map((msg) => (
          <Card
            key={msg.id}
            className={`bg-slate-950/80 border border-white/5 rounded-xl shadow-sm ${
              msg.requires_action ? 'border-l-4 border-red-500/80' : ''
            }`}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Priority Badge */}
                  <span
                    className={`px-2 py-1 text-xs rounded text-white ${getPriorityColor(
                      msg.priority_level,
                    )}`}
                  >
                    {msg.priority_level.toUpperCase()}
                  </span>

                  {/* Impact Score */}
                  <span
                    className={`px-2 py-1 text-xs rounded bg-card border border-border ${getImpactColor(
                      msg.impact_score,
                    )}`}
                  >
                    Impact: {(parseFloat(msg.impact_score) * 100).toFixed(0)}%
                  </span>

                  {/* Confidence */}
                  <span className="px-2 py-1 text-xs rounded bg-card border border-border text-blue-300">
                    Confidence: {(parseFloat(msg.confidence) * 100).toFixed(0)}%
                  </span>

                  {/* Sentiment */}
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      msg.sentiment === 'positive'
                        ? 'bg-green-500/20 text-green-300'
                        : msg.sentiment === 'negative'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-gray-500/20 text-gray-300'
                    }`}
                  >
                    {msg.sentiment === 'positive'
                      ? '😊'
                      : msg.sentiment === 'negative'
                        ? '😟'
                        : '😐'}{' '}
                    {msg.sentiment}
                  </span>

                  {/* Action Required */}
                  {msg.requires_action && (
                    <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300 border border-red-500/50">
                      ⚠️ ACTION REQUIRED
                    </span>
                  )}
                </div>

                {/* Time */}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
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

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => handleMarkProcessed(msg.id)}
                  className="px-3 py-1 text-xs md:text-sm rounded-full bg-green-600 hover:bg-green-500 text-white font-medium shadow-sm transition-colors"
                >
                  ✓ Mark Processed
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(msg)}
                  className="px-3 py-1 text-xs md:text-sm rounded-full bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-sm transition-colors"
                >
                  📋 View Details
                </button>
                {msg.requires_action && msg.action_type && (
                  <button
                    type="button"
                    onClick={() => {
                      // Execute action
                      // Placeholder for future expansion
                      // eslint-disable-next-line no-console
                      console.log('Execute action:', msg.action_type);
                    }}
                    className="px-3 py-1 text-xs md:text-sm rounded-full bg-red-600 hover:bg-red-500 text-white font-medium shadow-sm transition-colors"
                  >
                    🎯 Execute: {msg.action_type}
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Load More */}
      {hasMore && !isLoading && messages.length > 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="inline-flex items-center justify-center px-6 py-2 text-xs md:text-sm rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors"
          >
            Load More Messages
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" />
        </div>
      )}

      {/* No Messages */}
      {!isLoading && messages.length === 0 && !error && (
        <Card className="bg-slate-950/80 border border-white/5">
          <div className="text-center py-10">
            <div className="text-5xl mb-3">{AGENT_ICONS[agentKey] || '🤖'}</div>
            <p className="text-sm md:text-base font-semibold mb-1 text-foreground">
              No Messages Found
            </p>
            <p className="text-[11px] text-muted-foreground">
              Try adjusting your filters or time range once this agent starts receiving data.
            </p>
          </div>
        </Card>
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

