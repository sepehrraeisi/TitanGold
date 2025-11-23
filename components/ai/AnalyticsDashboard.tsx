import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAnalyticsMetrics } from '../../types.ts';

const AnalyticsDashboard: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AIAnalyticsMetrics | null>(null);
    const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');
    const [selectedAgent, setSelectedAgent] = useState<string | 'all'>('all');
    const [refreshInterval, setRefreshInterval] = useState<number | null>(30000); // 30 seconds

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
            const analyticsData = await api.fetchAnalyticsData();
            setData(analyticsData);
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

    const filteredAgentMatrix = useMemo(() => {
        if (!data) return [];
        if (selectedAgent === 'all') return data.agentMatrix;
        return data.agentMatrix.filter(a => a.id === selectedAgent);
    }, [data, selectedAgent]);

    const topAgents = useMemo(() => {
        if (!data) return [];
        return [...data.agentMatrix]
            .sort((a, b) => b.accuracy - a.accuracy)
            .slice(0, 5);
    }, [data]);

    const resourceUsageData = useMemo(() => {
        if (!data) return [];
        return [
            { name: 'CPU', value: data.resourceUsage.cpu, color: 'bg-blue-500' },
            { name: 'GPU', value: data.resourceUsage.gpu, color: 'bg-purple-500' },
            { name: 'Memory', value: data.resourceUsage.memory, color: 'bg-green-500' },
        ];
    }, [data]);

    const agentDistributionPercentages = useMemo(() => {
        if (!data) return { active: 0, training: 0, offline: 0 };
        const total = data.realtime.agentDistribution.active + 
                     data.realtime.agentDistribution.training + 
                     data.realtime.agentDistribution.offline || 1;
        return {
            active: (data.realtime.agentDistribution.active / total) * 100,
            training: (data.realtime.agentDistribution.training / total) * 100,
            offline: (data.realtime.agentDistribution.offline / total) * 100,
        };
    }, [data]);

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

    return (
        <div className="space-y-6">
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
                            onChange={(e) => setTimeRange(e.target.value as any)}
                            className="px-3 py-2 bg-secondary border border-border rounded text-foreground text-sm"
                        >
                            <option value="1D">{t('last_24h') || 'Last 24h'}</option>
                            <option value="1W">{t('last_week') || 'Last Week'}</option>
                            <option value="1M">{t('last_month') || 'Last Month'}</option>
                            <option value="3M">{t('last_3months') || 'Last 3 Months'}</option>
                            <option value="1Y">{t('last_year') || 'Last Year'}</option>
                        </select>
                        <select
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                            className="px-3 py-2 bg-secondary border border-border rounded text-foreground text-sm"
                        >
                            <option value="all">{t('all_agents') || 'All Agents'}</option>
                            {data.agentMatrix.map(agent => (
                                <option key={agent.id} value={agent.id}>{agent.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                const newInterval = refreshInterval ? null : 30000;
                                setRefreshInterval(newInterval);
                            }}
                            className={`px-3 py-2 rounded text-sm font-semibold transition-colors ${
                                refreshInterval
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
                                    const analyticsData = await api.fetchAnalyticsData();
                                    setData(analyticsData);
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
                {/* Resource Usage */}
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
                        <div className="pt-4 border-t border-border">
                            <div className="grid grid-cols-3 gap-4 text-xs">
                                <div className="text-center">
                                    <p className="text-muted-foreground">{t('cpu') || 'CPU'}</p>
                                    <p className="text-foreground font-semibold">{data.resourceUsage.cpu.toFixed(1)}%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-muted-foreground">{t('gpu') || 'GPU'}</p>
                                    <p className="text-foreground font-semibold">{data.resourceUsage.gpu.toFixed(1)}%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-muted-foreground">{t('memory') || 'Memory'}</p>
                                    <p className="text-foreground font-semibold">{data.resourceUsage.memory.toFixed(1)}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Precision/Recall Chart */}
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
                        <div className="pt-4 border-t border-border">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <p className="text-muted-foreground mb-1">{t('avg_precision') || 'Avg Precision'}</p>
                                    <p className="text-foreground font-semibold">
                                        {(data.resourceUsage.precision.reduce((a, b) => a + b, 0) / data.resourceUsage.precision.length * 100).toFixed(1)}%
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground mb-1">{t('avg_recall') || 'Avg Recall'}</p>
                                    <p className="text-foreground font-semibold">
                                        {(data.resourceUsage.recall.reduce((a, b) => a + b, 0) / data.resourceUsage.recall.length * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
             </div>
             
            {/* Top Agents & Agent Distribution */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Agents */}
                <Card title={t('top_performing_agents') || 'Top Performing Agents'}>
                    <div className="space-y-3">
                        {topAgents.map((agent, idx) => (
                            <div key={agent.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                        idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
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
                                <div className={`px-2 py-1 rounded text-xs font-semibold ${
                                    agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                    agent.status === 'training' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/20 text-red-400'
                                }`}>
                                    {t(agent.status)}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Agent Distribution */}
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
                            {filteredAgentMatrix.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                        {t('no_agents_found') || 'No agents found'}
                                    </td>
                                </tr>
                            ) : (
                                filteredAgentMatrix.map((agent, idx) => (
                                    <tr
                                        key={agent.id}
                                        className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                                            idx % 2 === 0 ? 'bg-background/20' : ''
                                        }`}
                                    >
                                        <td className="px-4 py-3 font-semibold">{agent.name}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span>{agent.accuracy}%</span>
                                                <div className="w-24 bg-secondary rounded-full h-2">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${
                                                            agent.accuracy >= 90 ? 'bg-green-500' :
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
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
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

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-card border border-border rounded-lg p-6 h-full">
        <h3 className="font-semibold text-lg text-foreground mb-4">{title}</h3>
        {children}
    </div>
);

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
