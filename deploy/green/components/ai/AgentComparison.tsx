import React, { useState, useEffect, useMemo } from 'react';
import { AIAgent, AgentPerformanceMetrics } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface AgentComparisonProps {
  availableAgents: AIAgent[];
  onClose?: () => void;
}

interface ComparisonMetric {
  key: string;
  label: string;
  getValue: (agent: AIAgent) => string | number | null;
  format?: 'number' | 'percentage' | 'currency' | 'text';
  isHigherBetter?: boolean;
}

const AgentComparison: React.FC<AgentComparisonProps> = ({ availableAgents, onClose }) => {
  const { t } = useLanguage();
  const [selectedAgents, setSelectedAgents] = useState<AIAgent[]>([]);
  const [comparisonView, setComparisonView] = useState<'overview' | 'performance' | 'config'>('overview');
  const [isExporting, setIsExporting] = useState(false);

  // Limit to 3 agents maximum
  const maxAgents = 3;

  // Toggle agent selection
  const toggleAgent = (agent: AIAgent) => {
    setSelectedAgents((prev) => {
      const isSelected = prev.some((a) => a.id === agent.id);
      if (isSelected) {
        return prev.filter((a) => a.id !== agent.id);
      } else if (prev.length < maxAgents) {
        return [...prev, agent];
      }
      return prev;
    });
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedAgents([]);
  };

  // Define comparison metrics
  const comparisonMetrics: ComparisonMetric[] = [
    {
      key: 'status',
      label: t('status') || 'Status',
      getValue: (agent) => agent.status,
      format: 'text',
    },
    {
      key: 'level',
      label: t('level') || 'Level',
      getValue: (agent) => agent.level,
      format: 'text',
    },
    {
      key: 'decisions',
      label: t('decisions') || 'Total Decisions',
      getValue: (agent) => agent.decisions,
      format: 'number',
      isHigherBetter: true,
    },
    {
      key: 'accuracy',
      label: t('accuracy') || 'Accuracy',
      getValue: (agent) => agent.accuracy !== null && agent.accuracy !== undefined ? agent.accuracy : null,
      format: 'percentage',
      isHigherBetter: true,
    },
    {
      key: 'winRate',
      label: t('win_rate') || 'Win Rate',
      getValue: (agent) => agent.performanceMetrics?.winRate ?? null,
      format: 'percentage',
      isHigherBetter: true,
    },
    {
      key: 'totalSignals',
      label: t('total_signals') || 'Total Signals',
      getValue: (agent) => agent.performanceMetrics?.totalSignals ?? null,
      format: 'number',
      isHigherBetter: true,
    },
    {
      key: 'sharpeRatio',
      label: t('sharpe_ratio') || 'Sharpe Ratio',
      getValue: (agent) => agent.performanceMetrics?.sharpeRatio ?? null,
      format: 'number',
      isHigherBetter: true,
    },
    {
      key: 'profitFactor',
      label: t('profit_factor') || 'Profit Factor',
      getValue: (agent) => agent.performanceMetrics?.profitFactor ?? null,
      format: 'number',
      isHigherBetter: true,
    },
    {
      key: 'maxDrawdown',
      label: t('max_drawdown') || 'Max Drawdown',
      getValue: (agent) => agent.performanceMetrics?.maxDrawdown ?? null,
      format: 'percentage',
      isHigherBetter: false,
    },
  ];

  // Determine if a metric value is best among selected agents
  const isBestValue = (metricKey: string, value: any, isHigherBetter: boolean): boolean => {
    if (value === null || value === undefined) return false;
    
    const values = selectedAgents
      .map((agent) => {
        const metric = comparisonMetrics.find((m) => m.key === metricKey);
        return metric ? metric.getValue(agent) : null;
      })
      .filter((v) => v !== null && v !== undefined) as number[];

    if (values.length === 0) return false;
    
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) return false;

    if (isHigherBetter) {
      return numValue === Math.max(...values);
    } else {
      return numValue === Math.min(...values);
    }
  };

  // Format value based on type
  const formatValue = (value: any, format?: string): string => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (format) {
      case 'percentage':
        return `${typeof value === 'number' ? value.toFixed(2) : value}%`;
      case 'currency':
        return `$${typeof value === 'number' ? value.toLocaleString() : value}`;
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value.toString();
      case 'text':
      default:
        return value.toString();
    }
  };

  // Export comparison report
  const exportComparison = async () => {
    setIsExporting(true);
    try {
      // Generate report content
      const reportContent = generateReportContent();
      
      // Create blob and download
      const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agent-comparison-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(t('export_success') || 'Comparison report exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert(t('export_failed') || 'Failed to export comparison report.');
    } finally {
      setIsExporting(false);
    }
  };

  // Generate report content for export
  const generateReportContent = (): string => {
    const timestamp = new Date().toISOString();
    let report = `TitanGold Agent Comparison Report\n`;
    report += `Generated: ${timestamp}\n`;
    report += `\n${'='.repeat(80)}\n\n`;

    report += `Selected Agents (${selectedAgents.length}):\n`;
    selectedAgents.forEach((agent, idx) => {
      report += `  ${idx + 1}. ${agent.name} (${agent.role})\n`;
    });
    report += `\n${'='.repeat(80)}\n\n`;

    report += `COMPARISON OVERVIEW\n`;
    report += `${'='.repeat(80)}\n\n`;

    comparisonMetrics.forEach((metric) => {
      report += `${metric.label}:\n`;
      selectedAgents.forEach((agent) => {
        const value = metric.getValue(agent);
        const formatted = formatValue(value, metric.format);
        const isBest = metric.isHigherBetter !== undefined && isBestValue(metric.key, value, metric.isHigherBetter);
        report += `  ${agent.name}: ${formatted}${isBest ? ' ⭐' : ''}\n`;
      });
      report += '\n';
    });

    report += `\n${'='.repeat(80)}\n\n`;
    report += `RECENT PERFORMANCE (Last 24h/7d/30d)\n`;
    report += `${'='.repeat(80)}\n\n`;

    selectedAgents.forEach((agent) => {
      report += `${agent.name}:\n`;
      if (agent.performanceMetrics?.recentPerformance) {
        const rp = agent.performanceMetrics.recentPerformance;
        report += `  Last 24h: ${rp.last24h.signals} signals, ${rp.last24h.winRate.toFixed(2)}% win rate\n`;
        report += `  Last 7d:  ${rp.last7d.signals} signals, ${rp.last7d.winRate.toFixed(2)}% win rate\n`;
        report += `  Last 30d: ${rp.last30d.signals} signals, ${rp.last30d.winRate.toFixed(2)}% win rate\n`;
      } else {
        report += `  No recent performance data available\n`;
      }
      report += '\n';
    });

    report += `\n${'='.repeat(80)}\n\n`;
    report += `CAPABILITIES\n`;
    report += `${'='.repeat(80)}\n\n`;

    selectedAgents.forEach((agent) => {
      report += `${agent.name}:\n`;
      if (agent.capabilities && agent.capabilities.length > 0) {
        agent.capabilities.forEach((cap) => {
          report += `  • ${cap}\n`;
        });
      } else {
        report += `  No capabilities listed\n`;
      }
      report += '\n';
    });

    report += `\nEnd of Report\n`;

    return report;
  };

  // Highlight differences
  const getDifferenceClass = (metricKey: string, value: any, isHigherBetter: boolean | undefined): string => {
    if (isHigherBetter === undefined || value === null || value === undefined) return '';
    
    const isBest = isBestValue(metricKey, value, isHigherBetter);
    return isBest ? 'bg-green-100 dark:bg-green-900 font-bold' : '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('agent_comparison') || 'Agent Comparison'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('select_up_to_agents', { count: maxAgents }) || `Select up to ${maxAgents} agents to compare`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Agent Selection */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('select_agents') || 'Select Agents'} ({selectedAgents.length}/{maxAgents})
            </h3>
            {selectedAgents.length > 0 && (
              <button
                onClick={clearSelection}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                {t('clear_selection') || 'Clear Selection'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-40 overflow-y-auto">
            {availableAgents.map((agent) => {
              const isSelected = selectedAgents.some((a) => a.id === agent.id);
              const isDisabled = !isSelected && selectedAgents.length >= maxAgents;
              
              return (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent)}
                  disabled={isDisabled}
                  className={`
                    p-3 rounded-lg border-2 text-left transition-all
                    ${isSelected 
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900 dark:border-yellow-400' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                    }
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {agent.name}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                    {agent.role}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Comparison Content */}
        {selectedAgents.length >= 2 ? (
          <>
            {/* View Tabs */}
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2">
                {(['overview', 'performance', 'config'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setComparisonView(view)}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${comparisonView === view
                        ? 'bg-yellow-500 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {t(view) || view.charAt(0).toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>
              <button
                onClick={exportComparison}
                disabled={isExporting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              >
                {isExporting ? (t('exporting') || 'Exporting...') : (t('export_report') || 'Export Report')}
              </button>
            </div>

            {/* Comparison Table */}
            <div className="flex-1 overflow-auto p-6">
              {comparisonView === 'overview' && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white border-b-2 border-gray-300 dark:border-gray-600">
                          {t('metric') || 'Metric'}
                        </th>
                        {selectedAgents.map((agent) => (
                          <th
                            key={agent.id}
                            className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-b-2 border-gray-300 dark:border-gray-600"
                          >
                            <div>{agent.name}</div>
                            <div className="text-xs font-normal text-gray-600 dark:text-gray-400 mt-1">
                              {agent.role}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonMetrics.map((metric, idx) => (
                        <tr
                          key={metric.key}
                          className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">
                            {metric.label}
                          </td>
                          {selectedAgents.map((agent) => {
                            const value = metric.getValue(agent);
                            const formatted = formatValue(value, metric.format);
                            const diffClass = getDifferenceClass(metric.key, value, metric.isHigherBetter);
                            
                            return (
                              <td
                                key={agent.id}
                                className={`px-4 py-3 text-sm text-center border-b border-gray-200 dark:border-gray-700 ${diffClass}`}
                              >
                                {formatted}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {comparisonView === 'performance' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {selectedAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                      >
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          {agent.name}
                        </h4>
                        
                        {agent.performanceMetrics ? (
                          <>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {t('total_signals') || 'Total Signals'}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {agent.performanceMetrics.totalSignals}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {t('successful_signals') || 'Successful Signals'}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {agent.performanceMetrics.successfulSignals}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {t('win_rate') || 'Win Rate'}
                                </span>
                                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                  {agent.performanceMetrics.winRate.toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {t('sharpe_ratio') || 'Sharpe Ratio'}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {agent.performanceMetrics.sharpeRatio.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {t('profit_factor') || 'Profit Factor'}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {agent.performanceMetrics.profitFactor.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {agent.performanceMetrics.recentPerformance && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                  {t('recent_performance') || 'Recent Performance'}
                                </h5>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">Last 24h:</span>
                                    <span className="text-gray-900 dark:text-white">
                                      {agent.performanceMetrics.recentPerformance.last24h.signals} signals, {agent.performanceMetrics.recentPerformance.last24h.winRate.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">Last 7d:</span>
                                    <span className="text-gray-900 dark:text-white">
                                      {agent.performanceMetrics.recentPerformance.last7d.signals} signals, {agent.performanceMetrics.recentPerformance.last7d.winRate.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">Last 30d:</span>
                                    <span className="text-gray-900 dark:text-white">
                                      {agent.performanceMetrics.recentPerformance.last30d.signals} signals, {agent.performanceMetrics.recentPerformance.last30d.winRate.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">
                            {t('no_performance_data') || 'No performance data available'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {comparisonView === 'config' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {selectedAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                      >
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          {agent.name}
                        </h4>
                        
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              {t('capabilities') || 'Capabilities'}
                            </div>
                            {agent.capabilities && agent.capabilities.length > 0 ? (
                              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                {agent.capabilities.map((cap, idx) => (
                                  <li key={idx}>{cap}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {t('no_capabilities') || 'No capabilities listed'}
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              {t('details') || 'Details'}
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">{t('status') || 'Status'}:</span>
                                <span className={`font-semibold ${
                                  agent.status === 'active' ? 'text-green-600 dark:text-green-400' :
                                  agent.status === 'training' ? 'text-yellow-600 dark:text-yellow-400' :
                                  'text-gray-600 dark:text-gray-400'
                                }`}>
                                  {agent.status}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">{t('level') || 'Level'}:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{agent.level}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">{t('last_update') || 'Last Update'}:</span>
                                <span className="text-gray-900 dark:text-white">{agent.lastUpdate}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t('select_agents_to_compare') || 'Select at least 2 agents to compare'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('comparison_help') || 'Choose agents from the list above to view side-by-side comparison'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentComparison;
