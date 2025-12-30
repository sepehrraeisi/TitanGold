import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { authenticatedFetch } from '../../../services/api-auth';

interface HealthData {
  ok: boolean;
  db: boolean;
  uptimeSec: number;
  timestamp: string;
  version: string;
}

interface SummaryData {
  window: string;
  since: string;
  requests: number;
  errors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  topRoutes: Array<{
    path: string;
    count: number;
    avgMs: number;
  }>;
}

interface ErrorLog {
  id: string;
  context: string;
  message: string;
  stack?: string;
  meta: any;
  timestamp: string;
}

type TimeWindow = '1h' | '24h';

const Monitoring: React.FC = () => {
  const { t } = useLanguage();
  
  const [health, setHealth] = useState<HealthData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [window, setWindow] = useState<TimeWindow>('1h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, [window]);

  const loadAllData = async () => {
    if (!loading) setRefreshing(true);
    setError(null);

    try {
      await Promise.all([
        loadHealth(),
        loadSummary(),
        loadErrors()
      ]);
    } catch (err) {
      console.error('Error loading monitoring data:', err);
      setError(t('Failed to load monitoring data'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadHealth = async () => {
    try {
      const response = await fetch('https://titan.zala.ir/api/monitoring/health');
      if (!response.ok) throw new Error('Health check failed');
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      console.error('Health check error:', err);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await authenticatedFetch(`/monitoring/summary?window=${window}`, {
        method: 'GET'
      });
      
      if (!response.ok) throw new Error('Failed to fetch summary');
      const data = await response.json();
      if (data.success) {
        setSummary(data);
      }
    } catch (err) {
      console.error('Summary error:', err);
    }
  };

  const loadErrors = async () => {
    try {
      const response = await authenticatedFetch('/monitoring/errors?limit=50', {
        method: 'GET'
      });
      
      if (!response.ok) throw new Error('Failed to fetch errors');
      const data = await response.json();
      if (data.success) {
        setErrors(data.errors);
      }
    } catch (err) {
      console.error('Errors fetch error:', err);
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('System Monitoring')}
          </h2>
          <p className="text-gray-400 text-sm">
            {t('Health status, request metrics, and error logs')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Window Selector */}
          <select
            value={window}
            onChange={(e) => setWindow(e.target.value as TimeWindow)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            <option value="1h">{t('Last 1 Hour')}</option>
            <option value="24h">{t('Last 24 Hours')}</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={loadAllData}
            disabled={refreshing}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              refreshing
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-500 text-gray-900 hover:bg-yellow-400'
            }`}
          >
            {refreshing ? t('Refreshing...') : t('Refresh')}
          </button>
        </div>
      </div>

      {/* Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Health Card */}
      {health && (
        <div className={`rounded-xl p-6 border ${
          health.ok 
            ? 'bg-green-500/10 border-green-500/50' 
            : 'bg-red-500/10 border-red-500/50'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {t('System Health')}
              </h3>
              <div className="space-y-1 text-sm">
                <p className={health.ok ? 'text-green-400' : 'text-red-400'}>
                  • API: {health.ok ? t('Online') : t('Offline')}
                </p>
                <p className={health.db ? 'text-green-400' : 'text-red-400'}>
                  • Database: {health.db ? t('Connected') : t('Disconnected')}
                </p>
                <p className="text-gray-400">
                  • {t('Uptime')}: {formatUptime(health.uptimeSec)}
                </p>
              </div>
            </div>
            <div className={`text-6xl ${health.ok ? 'text-green-400' : 'text-red-400'}`}>
              {health.ok ? '✓' : '✗'}
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Requests */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📊</span>
              <h4 className="text-sm font-medium text-gray-400">{t('Total Requests')}</h4>
            </div>
            <p className="text-3xl font-bold text-white">{summary.requests.toLocaleString()}</p>
          </div>

          {/* Errors */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-sm font-medium text-gray-400">{t('Errors')}</h4>
            </div>
            <p className="text-3xl font-bold text-red-400">{summary.errors.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.requests > 0 
                ? `${((summary.errors / summary.requests) * 100).toFixed(2)}% error rate`
                : '0% error rate'}
            </p>
          </div>

          {/* Avg Latency */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚡</span>
              <h4 className="text-sm font-medium text-gray-400">{t('Avg Latency')}</h4>
            </div>
            <p className="text-3xl font-bold text-blue-400">{Math.round(summary.avgLatencyMs)}ms</p>
          </div>

          {/* P95 Latency */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📈</span>
              <h4 className="text-sm font-medium text-gray-400">{t('P95 Latency')}</h4>
            </div>
            <p className="text-3xl font-bold text-purple-400">{Math.round(summary.p95LatencyMs)}ms</p>
          </div>
        </div>
      )}

      {/* Top Routes */}
      {summary && summary.topRoutes.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">{t('Top Routes')}</h3>
          <div className="space-y-2">
            {summary.topRoutes.map((route, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700/30 last:border-0">
                <span className="text-sm text-gray-300 font-mono">{route.path}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">{route.count} reqs</span>
                  <span className="text-blue-400">{Math.round(route.avgMs)}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Errors */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">
          {t('Recent Errors')} ({errors.length})
        </h3>
        
        {errors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">✓ {t('No errors recorded')}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {errors.map((err) => (
              <div 
                key={err.id} 
                className="bg-gray-900/50 rounded-lg p-4 border border-red-500/20 hover:border-red-500/40 transition-colors cursor-pointer"
                onClick={() => setExpandedError(expandedError === err.id ? null : err.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-red-400 bg-red-500/20 px-2 py-0.5 rounded">
                        {err.context}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(err.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-white truncate">{err.message}</p>
                    
                    {expandedError === err.id && err.stack && (
                      <pre className="mt-3 text-xs text-gray-400 bg-gray-950/50 p-3 rounded overflow-x-auto">
                        {err.stack}
                      </pre>
                    )}
                  </div>
                  <button className="text-gray-400 hover:text-white text-xs">
                    {expandedError === err.id ? '▼' : '▶'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-2">
          ℹ️ {t('Monitoring Info')}
        </h3>
        <ul className="text-xs text-blue-300/80 space-y-1">
          <li>• {t('Metrics are collected from live request logs')}</li>
          <li>• {t('Error logs are limited to last 50 entries')}</li>
          <li>• {t('Data refreshes every time you change the time window')}</li>
          <li>• {t('Click on errors to expand stack traces')}</li>
        </ul>
      </div>
    </div>
  );
};

export default Monitoring;
