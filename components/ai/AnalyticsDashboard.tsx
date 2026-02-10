import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAnalyticsMetrics, AIAgent, ArtemisState } from '../../types.ts';

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y';
type ViewMode = 'overview' | 'agents' | 'trends' | 'comparison' | 'insights';
type SortField = 'accuracy' | 'successRate' | 'progress' | 'name';
type SortOrder = 'asc' | 'desc';

const AnalyticsDashboard: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AIAnalyticsMetrics | null>(null);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [artemis, setArtemis] = useState<ArtemisState | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');
    const [selectedAgent, setSelectedAgent] = useState<string | 'all'>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('overview');
    const [refreshInterval, setRefreshInterval] = useState<number | null>(30000);
    const [sortField, setSortField] = useState<SortField>('accuracy');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAgentsForComparison, setSelectedAgentsForComparison] = useState<string[]>([]);
    const [showExportModal, setShowExportModal] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [analyticsData, agentsData, artemisState] = await Promise.all([
                    api.fetchAnalyticsData(),
                    api.fetchAIAgents(),
                    api.fetchArtemisState(),
                ]);
                setData(analyticsData);
                setAgents(agentsData);
                setArtemis(artemisState);
            } catch (e) {
                console.error('Failed to load analytics:', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();

        // Auto-refresh
        if (refreshInterval) {
            const interval = setInterval(fetchData, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [refreshInterval]);

    const filteredAndSortedAgents = useMemo(() => {
        if (!data) return [];
        let filtered = data.agentMatrix;

        // Filter by selected agent
        if (selectedAgent !== 'all') {
            filtered = filtered.filter(a => a.id === selectedAgent);
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(query) ||
                a.id.toLowerCase().includes(query)
            );
        }

        // Sort
        filtered = [...filtered].sort((a, b) => {
            let aVal: number | string;
            let bVal: number | string;

            switch (sortField) {
                case 'accuracy':
                    aVal = a.accuracy;
                    bVal = b.accuracy;
                    break;
                case 'successRate':
                    aVal = a.successRate;
                    bVal = b.successRate;
                    break;
                case 'progress':
                    aVal = a.progress;
                    bVal = b.progress;
                    break;
                case 'name':
                    aVal = a.name;
                    bVal = b.name;
                    break;
                default:
                    return 0;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortOrder === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            return sortOrder === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });

        return filtered;
    }, [data, selectedAgent, searchQuery, sortField, sortOrder]);

    const topAgents = useMemo(() => {
        if (!data) return [];
        return [...data.agentMatrix]
            .sort((a, b) => b.accuracy - a.accuracy)
            .slice(0, 5);
    }, [data]);

    const trendData = useMemo(() => {
        if (!data) return { precision: [], recall: [], accuracy: [] };

        // Generate trend data from precision/recall arrays (no random jitter)
        const days = data.resourceUsage.precision.length;
        return {
            precision: data.resourceUsage.precision.map((p, i) => ({
                day: i + 1,
                value: p * 100,
            })),
            recall: data.resourceUsage.recall.map((r, i) => ({
                day: i + 1,
                value: r * 100,
            })),
            accuracy: Array.from({ length: days }, (_, i) => ({
                day: i + 1,
                value: data.performance.avgAccuracy,
            })),
        };
    }, [data]);

    const comparisonData = useMemo(() => {
        if (!data || selectedAgentsForComparison.length === 0) return [];
        return selectedAgentsForComparison
            .map(id => data.agentMatrix.find(a => a.id === id))
            .filter(Boolean) as typeof data.agentMatrix;
    }, [data, selectedAgentsForComparison]);

    const insights = useMemo(() => {
        if (!data || !agents || !artemis) return [];
        const insightsList: Array<{ type: 'warning' | 'info' | 'success'; message: string }> = [];

        // Low accuracy agents
        const lowAccuracyAgents = data.agentMatrix.filter(a => a.accuracy < 80);
        if (lowAccuracyAgents.length > 0) {
            insightsList.push({
                type: 'warning',
                message: `${lowAccuracyAgents.length} agent(s) have accuracy below 80%. Consider training.`,
            });
        }

        // High resource usage
        if (data.resourceUsage.cpu > 85 || data.resourceUsage.memory > 85) {
            insightsList.push({
                type: 'warning',
                message: 'High resource usage detected. Consider scaling resources.',
            });
        }

        // Improving agents
        const improvingAgents = data.agentMatrix.filter(a => a.progress > 50);
        if (improvingAgents.length > 0) {
            insightsList.push({
                type: 'success',
                message: `${improvingAgents.length} agent(s) showing significant training progress.`,
            });
        }

        // System health
        if (data.realtime.systemUptime < 99) {
            insightsList.push({
                type: 'warning',
                message: 'System uptime below 99%. Check system health.',
            });
        }

        // Success rate
        if (data.realtime.successRate > 90) {
            insightsList.push({
                type: 'success',
                message: 'Excellent success rate! System performing optimally.',
            });
        }

        return insightsList;
    }, [data, agents, artemis]);

    const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
        if (!data) return;

        try {
            if (format === 'csv') {
                const csv = [
                    ['Agent', 'Accuracy', 'Success Rate', 'Progress', 'Status'].join(','),
                    ...data.agentMatrix.map(a => [
                        a.name,
                        a.accuracy,
                        a.successRate,
                        a.progress,
                        a.status,
                    ].join(',')),
                ].join('\n');

                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            } else if (format === 'json') {
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } else if (format === 'pdf') {
                // Add a temporary print class to handle high-fidelity PDF generation via browser print
                const style = document.createElement('style');
                style.innerHTML = `@media print { 
                    body * { visibility: hidden; } 
                    #analytics-content, #analytics-content * { visibility: visible; }
                    #analytics-content { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                    .bg-card { border: 1px solid #ddd !important; break-inside: avoid; }
                }`;
                document.head.appendChild(style);

                // Add id to main container if not exists, or just print
                window.print();

                // Cleanup
                document.head.removeChild(style);
            }
        } catch (e) {
            console.error('Export failed:', e);
            alert(t('export_failed') || 'Export failed');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin text-4xl mb-2">⚙️</div>
                    <p className="text-muted-foreground">{t('loading')}</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center p-10 text-red-400">
                {t('failed_to_load_data') || 'Failed to load analytics data'}
            </div>
        );
    }

    const viewModes: { id: ViewMode; label: string; icon: string }[] = [
        { id: 'overview', label: t('overview') || 'Overview', icon: '📊' },
        { id: 'agents', label: t('agents') || 'Agents', icon: '🤖' },
        { id: 'trends', label: t('trends') || 'Trends', icon: '📈' },
        { id: 'comparison', label: t('comparison') || 'Comparison', icon: '⚖️' },
        { id: 'insights', label: t('insights') || 'Insights', icon: '💡' },
    ];

    return (
        <div id="analytics-content" className="space-y-6">
            {/* Header */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">{t('advanced_ai_analytics') || 'Advanced AI Analytics'}</h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            {t('advanced_ai_analytics_desc') || 'Comprehensive performance metrics and insights for AI agents'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                            className="px-3 py-2 bg-secondary border border-border rounded text-foreground text-sm"
                        >
                            <option value="1D">{t('last_24h') || 'Last 24h'}</option>
                            <option value="1W">{t('last_week') || 'Last Week'}</option>
                            <option value="1M">{t('last_month') || 'Last Month'}</option>
                            <option value="3M">{t('last_3months') || 'Last 3 Months'}</option>
                            <option value="1Y">{t('last_year') || 'Last Year'}</option>
                        </select>
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold transition-colors"
                        >
                            {t('export') || 'Export'}
                        </button>
                        <button
                            onClick={() => {
                                const newInterval = refreshInterval ? null : 30000;
                                setRefreshInterval(newInterval);
                            }}
                            className={`px-3 py-2 rounded text-sm font-semibold transition-colors ${refreshInterval
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-secondary hover:bg-accent text-secondary-foreground'
                                }`}
                        >
                            {refreshInterval ? t('auto_refresh_on') || 'Auto: ON' : t('auto_refresh_off') || 'Auto: OFF'}
                        </button>
                        <button
                            onClick={async () => {
                                setIsLoading(true);
                                try {
                                    const [analyticsData, agentsData, artemisState] = await Promise.all([
                                        api.fetchAnalyticsData(),
                                        api.fetchAIAgents(),
                                        api.fetchArtemisState(),
                                    ]);
                                    setData(analyticsData);
                                    setAgents(agentsData);
                                    setArtemis(artemisState);
                                } catch (e) {
                                    console.error('Failed to refresh:', e);
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition-colors"
                        >
                            {t('refresh') || 'Refresh'}
                        </button>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                    {t('last_updated')}: {new Date(data.lastUpdated).toLocaleString()}
                </p>
            </div>

            {/* View Mode Tabs */}
            <div className="bg-card border border-border rounded-lg">
                <div className="flex border-b border-border overflow-x-auto">
                    {viewModes.map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => setViewMode(mode.id)}
                            className={`py-4 px-6 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${viewMode === mode.id
                                ? 'border-purple-500 text-purple-400'
                                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                }`}
                        >
                            <span className="mr-2">{mode.icon}</span>
                            {mode.label}
                        </button>
                    ))}
                </div>

                <div className="p-6" style={{ maxHeight: 'calc(92vh - 300px)', overflowY: 'auto' }}>
                    {viewMode === 'overview' && (
                        <OverviewView data={data} topAgents={topAgents} t={t} />
                    )}
                    {viewMode === 'agents' && (
                        <AgentsView
                            agents={filteredAndSortedAgents}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            sortField={sortField}
                            setSortField={setSortField}
                            sortOrder={sortOrder}
                            setSortOrder={setSortOrder}
                            selectedAgent={selectedAgent}
                            setSelectedAgent={setSelectedAgent}
                            data={data}
                            t={t}
                        />
                    )}
                    {viewMode === 'trends' && (
                        <TrendsView data={data} trendData={trendData} t={t} />
                    )}
                    {viewMode === 'comparison' && (
                        <ComparisonView
                            agents={data.agentMatrix}
                            selectedAgents={selectedAgentsForComparison}
                            setSelectedAgents={setSelectedAgentsForComparison}
                            comparisonData={comparisonData}
                            t={t}
                        />
                    )}
                    {viewMode === 'insights' && (
                        <InsightsView insights={insights} data={data} t={t} />
                    )}
                </div>
            </div>

            {/* Export Modal */}
            {showExportModal && (
                <ExportModal
                    onClose={() => setShowExportModal(false)}
                    onExport={handleExport}
                    t={t}
                />
            )}
        </div>
    );
};

// Overview View Component
const OverviewView: React.FC<{
    data: AIAnalyticsMetrics;
    topAgents: typeof data.agentMatrix;
    t: (key: string) => string;
}> = ({ data, topAgents, t }) => {
    const resourceUsageData = [
        { name: 'CPU', value: data.resourceUsage.cpu, color: 'bg-blue-500' },
        { name: 'GPU', value: data.resourceUsage.gpu, color: 'bg-purple-500' },
        { name: 'Memory', value: data.resourceUsage.memory, color: 'bg-green-500' },
    ];

    const agentDistributionPercentages = {
        active: (data.realtime.agentDistribution.active /
            (data.realtime.agentDistribution.active +
                data.realtime.agentDistribution.training +
                data.realtime.agentDistribution.offline || 1)) * 100,
        training: (data.realtime.agentDistribution.training /
            (data.realtime.agentDistribution.active +
                data.realtime.agentDistribution.training +
                data.realtime.agentDistribution.offline || 1)) * 100,
        offline: (data.realtime.agentDistribution.offline /
            (data.realtime.agentDistribution.active +
                data.realtime.agentDistribution.training +
                data.realtime.agentDistribution.offline || 1)) * 100,
    };

    return (
        <div className="space-y-6">
            {/* Real-time Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label={t('decisions_per_minute') || 'Decisions/Min'}
                    value={data.realtime.decisionRate.toFixed(1)}
                    icon="⚡"
                    trend={data.realtime.decisionRate > 1.0 ? 'up' : 'down'}
                />
                <StatCard
                    label={t('success_rate') || 'Success Rate'}
                    value={`${data.realtime.successRate.toFixed(1)}%`}
                    icon="✅"
                    trend={data.realtime.successRate > 85 ? 'up' : 'down'}
                />
                <StatCard
                    label={t('system_uptime') || 'System Uptime'}
                    value={`${data.realtime.systemUptime.toFixed(1)}%`}
                    icon="🟢"
                    trend={data.realtime.systemUptime > 99 ? 'up' : 'flat'}
                />
                <StatCard
                    label={t('agents_online') || 'Agents Online'}
                    value={`${data.realtime.agentDistribution.active}/${data.realtime.agentDistribution.active + data.realtime.agentDistribution.training + data.realtime.agentDistribution.offline}`}
                    icon="🤖"
                    trend="flat"
                />
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label={t('total_decisions') || 'Total Decisions'}
                    value={data.performance.totalDecisions.toLocaleString()}
                    icon="📊"
                />
                <StatCard
                    label={t('total_learning_hours') || 'Learning Hours'}
                    value={data.performance.totalLearningHours.toFixed(1)}
                    icon="📚"
                />
                <StatCard
                    label={t('average_accuracy') || 'Avg Accuracy'}
                    value={`${data.performance.avgAccuracy.toFixed(1)}%`}
                    icon="🎯"
                    trend={data.performance.avgAccuracy > 85 ? 'up' : 'down'}
                />
                <StatCard
                    label={t('monthly_improvement') || 'Monthly Improvement'}
                    value={`+${data.performance.monthlyImprovement.toFixed(1)}%`}
                    icon="📈"
                    trend="up"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={t('resource_usage') || 'Resource Usage'}>
                    <div className="space-y-4">
                        {resourceUsageData.map((resource, idx) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-foreground font-medium">{resource.name}</span>
                                    <span className="text-muted-foreground">{resource.value.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                                    <div
                                        className={`${resource.color} h-full rounded-full transition-all duration-500`}
                                        style={{ width: `${Math.min(100, resource.value)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title={t('precision_recall') || 'Precision & Recall'}>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-foreground font-medium">{t('precision') || 'Precision'}</span>
                            <span className="text-green-400 font-semibold">
                                {(data.resourceUsage.precision[data.resourceUsage.precision.length - 1] * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-3">
                            <div
                                className="bg-green-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${data.resourceUsage.precision[data.resourceUsage.precision.length - 1] * 100}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-foreground font-medium">{t('recall') || 'Recall'}</span>
                            <span className="text-blue-400 font-semibold">
                                {(data.resourceUsage.recall[data.resourceUsage.recall.length - 1] * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-3">
                            <div
                                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${data.resourceUsage.recall[data.resourceUsage.recall.length - 1] * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Top Agents & Agent Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={t('top_performing_agents') || 'Top Performing Agents'}>
                    <div className="space-y-3">
                        {topAgents.map((agent, idx) => (
                            <div key={agent.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                        idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                                            idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                                                'bg-purple-500/20 text-purple-400'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground text-sm">{agent.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {t('accuracy')}: {agent.accuracy}% | {t('success_rate')}: {agent.successRate}%
                                        </p>
                                    </div>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-semibold ${agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                    agent.status === 'training' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-red-500/20 text-red-400'
                                    }`}>
                                    {t(agent.status)}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title={t('agent_distribution') || 'Agent Distribution'}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                                <span className="text-sm text-foreground">{t('active') || 'Active'}</span>
                            </div>
                            <span className="text-lg font-bold text-foreground">{data.realtime.agentDistribution.active}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                                <span className="text-sm text-foreground">{t('training') || 'Training'}</span>
                            </div>
                            <span className="text-lg font-bold text-foreground">{data.realtime.agentDistribution.training}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                                <span className="text-sm text-foreground">{t('offline') || 'Offline'}</span>
                            </div>
                            <span className="text-lg font-bold text-foreground">{data.realtime.agentDistribution.offline}</span>
                        </div>
                        <div className="pt-4 border-t border-border">
                            <div className="w-full bg-secondary rounded-full h-4 overflow-hidden flex">
                                <div
                                    className="bg-green-500 h-full transition-all duration-500"
                                    style={{ width: `${agentDistributionPercentages.active}%` }}
                                ></div>
                                <div
                                    className="bg-yellow-500 h-full transition-all duration-500"
                                    style={{ width: `${agentDistributionPercentages.training}%` }}
                                ></div>
                                <div
                                    className="bg-red-500 h-full transition-all duration-500"
                                    style={{ width: `${agentDistributionPercentages.offline}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

// Agents View Component
const AgentsView: React.FC<{
    agents: typeof data.agentMatrix;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    sortField: SortField;
    setSortField: (f: SortField) => void;
    sortOrder: SortOrder;
    setSortOrder: (o: SortOrder) => void;
    selectedAgent: string | 'all';
    setSelectedAgent: (a: string | 'all') => void;
    data: AIAnalyticsMetrics;
    t: (key: string) => string;
}> = ({ agents, searchQuery, setSearchQuery, sortField, setSortField, sortOrder, setSortOrder, selectedAgent, setSelectedAgent, data, t }) => {
    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    placeholder={t('search_agents') || 'Search agents...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2 bg-secondary border border-border rounded text-foreground"
                />
                <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="px-4 py-2 bg-secondary border border-border rounded text-foreground"
                >
                    <option value="all">{t('all_agents') || 'All Agents'}</option>
                    {data.agentMatrix.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                </select>
                <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="px-4 py-2 bg-secondary border border-border rounded text-foreground"
                >
                    <option value="name">{t('name') || 'Name'}</option>
                    <option value="accuracy">{t('accuracy') || 'Accuracy'}</option>
                    <option value="successRate">{t('success_rate') || 'Success Rate'}</option>
                    <option value="progress">{t('training_progress') || 'Training Progress'}</option>
                </select>
                <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-4 py-2 bg-secondary border border-border rounded text-foreground hover:bg-accent"
                >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
            </div>

            {/* Agent Performance Matrix */}
            <Card title={t('agent_performance_matrix') || 'Agent Performance Matrix'}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">{t('agent') || 'Agent'}</th>
                                <th className="px-4 py-3 text-center font-semibold">{t('accuracy') || 'Accuracy'}</th>
                                <th className="px-4 py-3 text-center font-semibold">{t('success_rate') || 'Success Rate'}</th>
                                <th className="px-4 py-3 text-center font-semibold">{t('training_progress') || 'Training Progress'}</th>
                                <th className="px-4 py-3 text-center font-semibold">{t('status') || 'Status'}</th>
                            </tr>
                        </thead>
                        <tbody className="text-foreground">
                            {agents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                        {t('no_agents_found') || 'No agents found'}
                                    </td>
                                </tr>
                            ) : (
                                agents.map((agent, idx) => (
                                    <tr
                                        key={agent.id}
                                        className={`border-b border-border hover:bg-secondary/30 transition-colors ${idx % 2 === 0 ? 'bg-background/20' : ''
                                            }`}
                                    >
                                        <td className="px-4 py-3 font-semibold">{agent.name}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span>{agent.accuracy}%</span>
                                                <div className="w-24 bg-secondary rounded-full h-2">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${agent.accuracy >= 90 ? 'bg-green-500' :
                                                            agent.accuracy >= 80 ? 'bg-yellow-500' :
                                                                'bg-red-500'
                                                            }`}
                                                        style={{ width: `${agent.accuracy}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">{agent.successRate}%</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span>{agent.progress}%</span>
                                                <div className="w-24 bg-secondary rounded-full h-2">
                                                    <div
                                                        className="bg-purple-500 h-full rounded-full transition-all"
                                                        style={{ width: `${agent.progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                                agent.status === 'training' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {t(agent.status)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

// Trends View Component
const TrendsView: React.FC<{
    data: AIAnalyticsMetrics;
    trendData: { precision: Array<{ day: number; value: number }>; recall: Array<{ day: number; value: number }>; accuracy: Array<{ day: number; value: number }> };
    t: (key: string) => string;
}> = ({ data, trendData, t }) => {
    const maxValue = Math.max(
        ...trendData.precision.map(d => d.value),
        ...trendData.recall.map(d => d.value),
        ...trendData.accuracy.map(d => d.value),
    );

    return (
        <div className="space-y-6">
            <Card title={t('precision_trend') || 'Precision Trend'}>
                <div className="h-64 flex items-end justify-between gap-1">
                    {trendData.precision.map((point, idx) => (
                        <div
                            key={idx}
                            className="flex-1 bg-green-500 rounded-t transition-all hover:bg-green-400"
                            style={{ height: `${(point.value / maxValue) * 100}%` }}
                            title={`Day ${point.day}: ${point.value.toFixed(1)}%`}
                        ></div>
                    ))}
                </div>
            </Card>

            <Card title={t('recall_trend') || 'Recall Trend'}>
                <div className="h-64 flex items-end justify-between gap-1">
                    {trendData.recall.map((point, idx) => (
                        <div
                            key={idx}
                            className="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-400"
                            style={{ height: `${(point.value / maxValue) * 100}%` }}
                            title={`Day ${point.day}: ${point.value.toFixed(1)}%`}
                        ></div>
                    ))}
                </div>
            </Card>

            <Card title={t('accuracy_trend') || 'Accuracy Trend'}>
                <div className="h-64 flex items-end justify-between gap-1">
                    {trendData.accuracy.map((point, idx) => (
                        <div
                            key={idx}
                            className="flex-1 bg-purple-500 rounded-t transition-all hover:bg-purple-400"
                            style={{ height: `${(point.value / maxValue) * 100}%` }}
                            title={`Day ${point.day}: ${point.value.toFixed(1)}%`}
                        ></div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

// Comparison View Component
const ComparisonView: React.FC<{
    agents: typeof data.agentMatrix;
    selectedAgents: string[];
    setSelectedAgents: (ids: string[]) => void;
    comparisonData: typeof data.agentMatrix;
    t: (key: string) => string;
}> = ({ agents, selectedAgents, setSelectedAgents, comparisonData, t }) => {
    const toggleAgent = (id: string) => {
        setSelectedAgents(
            selectedAgents.includes(id)
                ? selectedAgents.filter(a => a !== id)
                : [...selectedAgents, id].slice(0, 5) // Max 5 agents
        );
    };

    return (
        <div className="space-y-6">
            <Card title={t('select_agents_to_compare') || 'Select Agents to Compare (Max 5)'}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {agents.map(agent => (
                        <button
                            key={agent.id}
                            onClick={() => toggleAgent(agent.id)}
                            disabled={!selectedAgents.includes(agent.id) && selectedAgents.length >= 5}
                            className={`p-3 border rounded-lg text-left transition-all ${selectedAgents.includes(agent.id)
                                ? 'border-purple-500 bg-purple-500/10'
                                : 'border-border hover:border-purple-500/50'
                                } ${!selectedAgents.includes(agent.id) && selectedAgents.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground">{agent.name}</span>
                                {selectedAgents.includes(agent.id) && <span className="text-purple-400">✓</span>}
                            </div>
                        </button>
                    ))}
                </div>
            </Card>

            {comparisonData.length > 0 && (
                <Card title={t('comparison_results') || 'Comparison Results'}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">{t('agent') || 'Agent'}</th>
                                    <th className="px-4 py-3 text-center font-semibold">{t('accuracy') || 'Accuracy'}</th>
                                    <th className="px-4 py-3 text-center font-semibold">{t('success_rate') || 'Success Rate'}</th>
                                    <th className="px-4 py-3 text-center font-semibold">{t('training_progress') || 'Training Progress'}</th>
                                </tr>
                            </thead>
                            <tbody className="text-foreground">
                                {comparisonData.map((agent, idx) => (
                                    <tr
                                        key={agent.id}
                                        className={`border-b border-border ${idx % 2 === 0 ? 'bg-background/20' : ''}`}
                                    >
                                        <td className="px-4 py-3 font-semibold">{agent.name}</td>
                                        <td className="px-4 py-3 text-center">{agent.accuracy}%</td>
                                        <td className="px-4 py-3 text-center">{agent.successRate}%</td>
                                        <td className="px-4 py-3 text-center">{agent.progress}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
};

// Insights View Component
const InsightsView: React.FC<{
    insights: Array<{ type: 'warning' | 'info' | 'success'; message: string }>;
    data: AIAnalyticsMetrics;
    t: (key: string) => string;
}> = ({ insights, data, t }) => {
    return (
        <div className="space-y-6">
            <Card title={t('performance_insights') || 'Performance Insights'}>
                <div className="space-y-3">
                    {insights.length === 0 ? (
                        <p className="text-muted-foreground">{t('no_insights') || 'No insights available'}</p>
                    ) : (
                        insights.map((insight, idx) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-lg border ${insight.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' :
                                    insight.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                                        'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-xl">
                                        {insight.type === 'warning' ? '⚠️' :
                                            insight.type === 'success' ? '✅' : 'ℹ️'}
                                    </span>
                                    <p className="flex-1">{insight.message}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            <Card title={t('recommendations') || 'Recommendations'}>
                <div className="space-y-3">
                    {data.performance.avgAccuracy < 85 && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <p className="text-blue-300">
                                {t('recommendation_low_accuracy') || 'Consider training agents with accuracy below 85% to improve overall system performance.'}
                            </p>
                        </div>
                    )}
                    {data.resourceUsage.cpu > 80 && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <p className="text-yellow-300">
                                {t('recommendation_high_cpu') || 'High CPU usage detected. Consider optimizing agent workloads or scaling resources.'}
                            </p>
                        </div>
                    )}
                    {data.realtime.successRate > 90 && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <p className="text-green-300">
                                {t('recommendation_excellent') || 'Excellent performance! System is operating optimally.'}
                            </p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

// Export Modal Component
const ExportModal: React.FC<{
    onClose: () => void;
    onExport: (format: 'csv' | 'json' | 'pdf') => void;
    t: (key: string) => string;
}> = ({ onClose, onExport, t }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-foreground mb-4">{t('export_data') || 'Export Data'}</h3>
                <div className="space-y-3">
                    <button
                        onClick={() => {
                            onExport('csv');
                            onClose();
                        }}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                        {t('export_csv') || 'Export as CSV'}
                    </button>
                    <button
                        onClick={() => {
                            onExport('json');
                            onClose();
                        }}
                        className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                    >
                        {t('export_json') || 'Export as JSON'}
                    </button>
                    <button
                        onClick={() => {
                            onExport('pdf');
                            onClose();
                        }}
                        className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                    >
                        {t('export_pdf') || 'Export as PDF'}
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="mt-4 w-full px-4 py-2 bg-secondary hover:bg-accent text-foreground rounded-lg transition-colors"
                >
                    {t('cancel') || 'Cancel'}
                </button>
            </div>
        </div>
    );
};

// Card Component
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-card border border-border rounded-lg p-6 h-full">
        <h3 className="font-semibold text-lg text-foreground mb-4">{title}</h3>
        {children}
    </div>
);

// StatCard Component
const StatCard: React.FC<{
    label: string;
    value: string | number;
    icon?: string;
    trend?: 'up' | 'down' | 'flat';
}> = ({ label, value, icon, trend }) => (
    <div className="bg-card border border-border p-6 rounded-lg hover:border-purple-500/50 transition-all">
        <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">{label}</p>
            {icon && <span className="text-2xl">{icon}</span>}
        </div>
        <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {trend && trend !== 'flat' && (
                <span className={`text-lg ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {trend === 'up' ? '↑' : '↓'}
                </span>
            )}
        </div>
    </div>
);

export default AnalyticsDashboard;
