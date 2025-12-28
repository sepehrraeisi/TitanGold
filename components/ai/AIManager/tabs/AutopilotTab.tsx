/**
 * Autopilot Tab
 * Human control panel for autopilot system
 * 
 * Features:
 * - Status dashboard
 * - Suggestions list with approve/reject/rollback
 * - Manual trigger
 * - Circuit breaker visualization
 */

import React, { useState, useEffect } from 'react';
import * as api from '../../../../services/api';

interface AutopilotTabProps {
  t: (key: string) => string;
  Card: React.ComponentType<any>;
  onRefresh?: () => void;
}

interface AutopilotStatus {
  enabled: boolean;
  last_run: string | null;
  cycle_count: number;
  fail_count: number;
  config: {
    max_change_percent: number;
    min_cycle_interval_minutes: number;
    max_consecutive_failures: number;
    require_human_approval: boolean;
  };
}

interface Suggestion {
  id: string;
  action_type: string;
  status: string;
  agent_id: string;
  agent_name: string;
  agent_type: string;
  old_config: any;
  new_config: any;
  change_summary: string;
  reason: string;
  confidence: number;
  triggering_events: any[];
  metrics: any;
  suggested_at: string;
  approved_by: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
  applied_at: string | null;
}

const AutopilotTab: React.FC<AutopilotTabProps> = ({ t, Card, onRefresh }) => {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusData, suggestionsData] = await Promise.all([
        api.fetchAutopilotStatus(),
        api.fetchAutopilotSuggestions({ status: statusFilter as any, limit: 50 })
      ]);

      setStatus(statusData);
      setSuggestions(suggestionsData.suggestions);

    } catch (err: any) {
      console.error('[Autopilot] Failed to fetch data:', err);
      setError(err.message || 'Failed to load autopilot data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  // Toggle autopilot
  const handleToggle = async () => {
    if (!status) return;

    try {
      setActionLoading('toggle');

      if (status.enabled) {
        await api.disableAutopilot();
      } else {
        await api.enableAutopilot();
      }

      await fetchData();
      onRefresh?.();

    } catch (err: any) {
      alert(err.message || 'Failed to toggle autopilot');
    } finally {
      setActionLoading(null);
    }
  };

  // Manual run
  const handleManualRun = async () => {
    try {
      setActionLoading('run');
      await api.runAutopilotOnce(24);
      await fetchData();
      alert('Autopilot cycle completed');
    } catch (err: any) {
      alert(err.message || 'Failed to run autopilot');
    } finally {
      setActionLoading(null);
    }
  };

  // Approve suggestion
  const handleApprove = async (suggestionId: string) => {
    if (!confirm('Approve this suggestion? This will apply the config changes.')) {
      return;
    }

    try {
      setActionLoading(suggestionId);
      await api.approveAutopilotSuggestion(suggestionId);
      await fetchData();
      alert('Suggestion approved and applied');
    } catch (err: any) {
      alert(err.message || 'Failed to approve suggestion');
    } finally {
      setActionLoading(null);
    }
  };

  // Reject suggestion
  const handleReject = async (suggestionId: string) => {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return; // User cancelled

    try {
      setActionLoading(suggestionId);
      await api.rejectAutopilotSuggestion(suggestionId, reason || undefined);
      await fetchData();
      alert('Suggestion rejected');
    } catch (err: any) {
      alert(err.message || 'Failed to reject suggestion');
    } finally {
      setActionLoading(null);
    }
  };

  // Rollback suggestion
  const handleRollback = async (suggestionId: string) => {
    if (!confirm('Rollback this suggestion? This will restore the previous config.')) {
      return;
    }

    try {
      setActionLoading(suggestionId);
      await api.rollbackAutopilotSuggestion(suggestionId);
      await fetchData();
      alert('Suggestion rolled back successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to rollback suggestion');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !status) {
    return (
      <Card>
        <div className="p-4 text-center">Loading autopilot data...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-4 text-center text-red-500">
          Error: {error}
          <button onClick={fetchData} className="ml-4 text-blue-500 underline">
            Retry
          </button>
        </div>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <div className="p-4 text-center">No autopilot data available</div>
      </Card>
    );
  }

  const circuitBreakerActive = status.fail_count >= status.config.max_consecutive_failures;

  return (
    <div className="space-y-4">
      {/* Status Dashboard */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {t('autopilot_status') || 'Autopilot Status'}
            </h3>
            <button
              onClick={fetchData}
              className="text-sm text-blue-500 hover:text-blue-600"
              disabled={loading}
            >
              🔄 {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {status.enabled ? '🟢' : '⚪'}
              </div>
              <div className="text-sm text-gray-600">
                {status.enabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">{status.cycle_count}</div>
              <div className="text-sm text-gray-600">Cycles Run</div>
            </div>

            <div className="text-center">
              <div className={`text-2xl font-bold ${circuitBreakerActive ? 'text-red-500' : ''}`}>
                {status.fail_count} / {status.config.max_consecutive_failures}
              </div>
              <div className="text-sm text-gray-600">Fail Count</div>
            </div>

            <div className="text-center">
              <div className="text-sm font-mono text-gray-700">
                {status.last_run 
                  ? new Date(status.last_run).toLocaleTimeString()
                  : 'Never'}
              </div>
              <div className="text-sm text-gray-600">Last Run</div>
            </div>
          </div>

          {/* Circuit Breaker Warning */}
          {circuitBreakerActive && (
            <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-bold">⚠️ CIRCUIT BREAKER ACTIVE</span>
              </div>
              <div className="text-sm text-red-700 mt-1">
                Autopilot has been auto-disabled due to {status.fail_count} consecutive failures.
                Investigate and fix issues before re-enabling.
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={handleToggle}
              disabled={actionLoading === 'toggle' || circuitBreakerActive}
              className={`px-4 py-2 rounded font-medium ${
                status.enabled
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {actionLoading === 'toggle' 
                ? 'Processing...'
                : status.enabled 
                  ? '⏸️ Disable Autopilot'
                  : '▶️ Enable Autopilot'}
            </button>

            <button
              onClick={handleManualRun}
              disabled={actionLoading === 'run' || circuitBreakerActive}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'run' ? 'Running...' : '🔄 Run Once'}
            </button>
          </div>

          {/* Config (Read-only) */}
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-sm border border-gray-200 dark:border-gray-700">
            <div className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Configuration:</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
              <div><span className="font-medium">Max Change:</span> {status.config.max_change_percent}%</div>
              <div><span className="font-medium">Min Interval:</span> {status.config.min_cycle_interval_minutes}min</div>
              <div><span className="font-medium">Max Failures:</span> {status.config.max_consecutive_failures}</div>
              <div><span className="font-medium">Human Approval:</span> {status.config.require_human_approval ? '✅ Required' : '⚠️ Optional'}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Suggestions Panel */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {t('autopilot_suggestions') || 'Autopilot Suggestions'}
            </h3>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="pending">Pending</option>
              <option value="applied">Applied</option>
              <option value="rejected">Rejected</option>
              <option value="rolled_back">Rolled Back</option>
              <option value="">All</option>
            </select>
          </div>

          {/* Suggestions List */}
          {suggestions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No {statusFilter} suggestions found
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="border rounded p-4 hover:bg-gray-50"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold">
                        {suggestion.agent_name || suggestion.agent_id}
                        <span className="ml-2 text-sm text-gray-500">
                          ({suggestion.agent_type})
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {suggestion.change_summary}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Confidence Badge */}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        suggestion.confidence >= 80 ? 'bg-green-100 text-green-700' :
                        suggestion.confidence >= 60 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {suggestion.confidence}% confident
                      </span>

                      {/* Status Badge */}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        suggestion.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                        suggestion.status === 'applied' ? 'bg-green-100 text-green-700' :
                        suggestion.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {suggestion.status}
                      </span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="text-sm text-gray-700 mb-3">
                    {suggestion.reason}
                  </div>

                  {/* Expand Details */}
                  <button
                    onClick={() => setExpandedSuggestion(
                      expandedSuggestion === suggestion.id ? null : suggestion.id
                    )}
                    className="text-sm text-blue-500 hover:text-blue-600 mb-2"
                  >
                    {expandedSuggestion === suggestion.id ? '▼ Hide Details' : '▶ Show Details'}
                  </button>

                  {/* Expanded Details */}
                  {expandedSuggestion === suggestion.id && (
                    <div className="bg-gray-100 rounded p-3 mt-2 text-sm space-y-2">
                      <div>
                        <span className="font-semibold">Triggering Events:</span>
                        <pre className="mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(suggestion.triggering_events, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="font-semibold">Metrics:</span>
                        <pre className="mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(suggestion.metrics, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="font-semibold">Config Changes:</span>
                        <pre className="mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(suggestion.new_config, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {suggestion.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(suggestion.id)}
                          disabled={actionLoading === suggestion.id}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium disabled:opacity-50"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleReject(suggestion.id)}
                          disabled={actionLoading === suggestion.id}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium disabled:opacity-50"
                        >
                          ❌ Reject
                        </button>
                      </>
                    )}

                    {suggestion.status === 'applied' && (
                      <button
                        onClick={() => handleRollback(suggestion.id)}
                        disabled={actionLoading === suggestion.id}
                        className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-medium disabled:opacity-50"
                      >
                        ↩️ Rollback
                      </button>
                    )}

                    {actionLoading === suggestion.id && (
                      <span className="text-sm text-gray-500">Processing...</span>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="mt-2 text-xs text-gray-500">
                    Suggested: {new Date(suggestion.suggested_at).toLocaleString()}
                    {suggestion.approved_by_email && (
                      <> • Approved by: {suggestion.approved_by_email}</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AutopilotTab;
