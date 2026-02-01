import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { AgentPerformanceMetrics } from '../../types.ts';

interface PerformanceMetricsDisplayProps {
  metrics: AgentPerformanceMetrics | null;
  executionTime?: number; // milliseconds
  isCached?: boolean;
  lastExecutionTime?: number;
  cacheHitRate?: number; // percentage 0-100
  historicalData?: Array<{
    timestamp: string;
    executionTime: number;
    cached: boolean;
    success: boolean;
  }>;
}

const PerformanceMetricsDisplay: React.FC<PerformanceMetricsDisplayProps> = ({
  metrics,
  executionTime,
  isCached = false,
  lastExecutionTime,
  cacheHitRate,
  historicalData = [],
}) => {
  const { t } = useLanguage();
  const [activeChart, setActiveChart] = useState<'execution' | 'cache' | 'performance'>('execution');

  // Format execution time
  const formatExecutionTime = (ms: number | undefined) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Calculate average execution time from historical data
  const avgExecutionTime = historicalData.length > 0
    ? historicalData.reduce((sum, d) => sum + d.executionTime, 0) / historicalData.length
    : lastExecutionTime || 0;

  // Calculate cache hit rate from historical data
  const calculatedCacheHitRate = historicalData.length > 0
    ? (historicalData.filter(d => d.cached).length / historicalData.length) * 100
    : cacheHitRate || 0;

  // Get recent 10 executions for mini chart
  const recentExecutions = historicalData.slice(-10);
  const maxExecutionTime = Math.max(...recentExecutions.map(d => d.executionTime), 1);

  return (
    <div className="space-y-4">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Execution Time Card */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('execution_time') || 'Execution Time'}</p>
              <p className="text-2xl font-bold text-white">
                {formatExecutionTime(executionTime || lastExecutionTime)}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${
              (executionTime || lastExecutionTime || 0) < 1000 
                ? 'bg-green-500/20 text-green-400' 
                : (executionTime || lastExecutionTime || 0) < 3000 
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {t('avg') || 'Avg'}: {formatExecutionTime(avgExecutionTime)}
          </div>
        </div>

        {/* Cache Status Card */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('cache_status') || 'Cache Status'}</p>
              <p className="text-2xl font-bold">
                {isCached ? (
                  <span className="text-green-400">HIT</span>
                ) : (
                  <span className="text-orange-400">MISS</span>
                )}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${
              isCached 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-orange-500/20 text-orange-400'
            }`}>
              {isCached ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {t('hit_rate') || 'Hit Rate'}: {calculatedCacheHitRate.toFixed(1)}%
          </div>
        </div>

        {/* Success Rate Card */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('success_rate') || 'Success Rate'}</p>
              <p className="text-2xl font-bold text-white">
                {metrics?.winRate ? `${metrics.winRate.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${
              (metrics?.winRate || 0) >= 70 
                ? 'bg-green-500/20 text-green-400' 
                : (metrics?.winRate || 0) >= 50 
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {metrics?.successfulSignals || 0} / {metrics?.totalSignals || 0} {t('signals') || 'signals'}
          </div>
        </div>
      </div>

      {/* Historical Chart Section */}
      {recentExecutions.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">{t('performance_history') || 'Performance History'}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveChart('execution')}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  activeChart === 'execution'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {t('execution_time') || 'Execution'}
              </button>
              <button
                onClick={() => setActiveChart('cache')}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  activeChart === 'cache'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {t('cache') || 'Cache'}
              </button>
              <button
                onClick={() => setActiveChart('performance')}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  activeChart === 'performance'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {t('success') || 'Success'}
              </button>
            </div>
          </div>

          {/* Mini Bar Chart */}
          <div className="space-y-2">
            {activeChart === 'execution' && (
              <div className="h-32 flex items-end justify-between gap-1">
                {recentExecutions.map((execution, idx) => {
                  const height = (execution.executionTime / maxExecutionTime) * 100;
                  const isSlow = execution.executionTime > avgExecutionTime;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                      <div
                        className={`w-full rounded-t transition-all ${
                          isSlow ? 'bg-orange-500' : 'bg-blue-500'
                        } hover:opacity-80`}
                        style={{ height: `${height}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                        {formatExecutionTime(execution.executionTime)}
                        <br />
                        {new Date(execution.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeChart === 'cache' && (
              <div className="h-32 flex items-end justify-between gap-1">
                {recentExecutions.map((execution, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative">
                    <div
                      className={`w-full rounded-t transition-all ${
                        execution.cached ? 'bg-green-500' : 'bg-gray-600'
                      } hover:opacity-80`}
                      style={{ height: execution.cached ? '100%' : '30%' }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      {execution.cached ? 'Cache HIT' : 'Cache MISS'}
                      <br />
                      {new Date(execution.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeChart === 'performance' && (
              <div className="h-32 flex items-end justify-between gap-1">
                {recentExecutions.map((execution, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative">
                    <div
                      className={`w-full rounded-t transition-all ${
                        execution.success ? 'bg-green-500' : 'bg-red-500'
                      } hover:opacity-80`}
                      style={{ height: '100%' }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      {execution.success ? 'Success' : 'Failed'}
                      <br />
                      {new Date(execution.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chart Legend */}
            <div className="flex items-center justify-center gap-4 text-xs text-gray-400 pt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>{t('fast') || 'Fast'}</span>
              </div>
              {activeChart === 'execution' && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span>{t('slow') || 'Slow'}</span>
                </div>
              )}
              {activeChart === 'cache' && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>{t('hit') || 'Hit'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-600 rounded"></div>
                    <span>{t('miss') || 'Miss'}</span>
                  </div>
                </>
              )}
              {activeChart === 'performance' && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>{t('success') || 'Success'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>{t('failed') || 'Failed'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Additional Metrics (if available) */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">{t('avg_confidence') || 'Avg Confidence'}</p>
            <p className="text-lg font-semibold text-white">{metrics.averageConfidence.toFixed(1)}%</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">{t('profit_factor') || 'Profit Factor'}</p>
            <p className="text-lg font-semibold text-white">{metrics.profitFactor.toFixed(2)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">{t('sharpe_ratio') || 'Sharpe Ratio'}</p>
            <p className="text-lg font-semibold text-white">{metrics.sharpeRatio.toFixed(2)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">{t('max_drawdown') || 'Max Drawdown'}</p>
            <p className="text-lg font-semibold text-red-400">-{metrics.maxDrawdown.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-blue-300">
            <p className="font-semibold mb-1">{t('performance_metrics_help') || 'Performance Metrics Explained'}</p>
            <ul className="space-y-1 text-blue-300/80">
              <li><strong>{t('execution_time') || 'Execution Time'}:</strong> {t('execution_time_help') || 'Time taken to process the request. Lower is better.'}</li>
              <li><strong>{t('cache_status') || 'Cache Status'}:</strong> {t('cache_help') || 'HIT means result was served from cache (faster). MISS means fresh calculation.'}</li>
              <li><strong>{t('hit_rate') || 'Hit Rate'}:</strong> {t('hit_rate_help') || 'Percentage of requests served from cache. Higher means better performance.'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetricsDisplay;
