import React, { useMemo, useState, useEffect } from 'react';
import * as api from '../../../../services/api.ts';

type Props = {
    t: (key: string) => string;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const OrchestrationTab: React.FC<Props> = ({ t, Card }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<{
        activeAgents: number;
        agentTasks: any[];
        resourceAllocation: Record<string, any>;
        lastUpdated: string;
    } | null>(null);

    const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const orchestrationData = await api.fetchOrchestrationState();
            setData(orchestrationData);
        } catch (e) {
            console.error('Failed to load orchestration data:', e);
            setError(e instanceof Error ? e.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Auto-refresh every 10 seconds
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, []);

    const agentTasks = data?.agentTasks || [];
    const resourceAllocation = data?.resourceAllocation || {};

    const taskStats = useMemo(() => {
        const tasks = agentTasks;
        return {
            total: tasks.length,
            pending: tasks.filter((t: any) => t.status === 'pending').length,
            running: tasks.filter((t: any) => t.status === 'running').length,
            completed: tasks.filter((t: any) => t.status === 'completed').length,
            failed: tasks.filter((t: any) => t.status === 'failed').length,
            completionRate: tasks.length > 0 ? (tasks.filter((t: any) => t.status === 'completed').length / tasks.length) * 100 : 0,
        };
    }, [agentTasks]);

    const filteredTasks = useMemo(() => {
        return agentTasks.filter((task: any) => {
            if (taskFilter !== 'all' && task.status !== taskFilter) return false;
            if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
            return true;
        });
    }, [agentTasks, taskFilter, priorityFilter]);

    if (loading && !data) {
        return <Card><div className="text-center p-4">{t('loading') || 'Loading...'}</div></Card>;
    }

    if (error && !data) {
        return (
            <Card>
                <div className="text-center p-4">
                    <p className="text-red-400 mb-3">{error}</p>
                    <button
                        onClick={loadData}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {t('retry') || 'Retry'}
                    </button>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('orchestration_summary') || 'Orchestration Summary'}</h3>
                        <p className="text-xs text-muted-foreground">{t('orchestration_desc') || 'Real-time agent tasks and resource allocation'}</p>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {loading ? (t('loading') || 'Loading...') : (t('refresh') || 'Refresh')}
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Stat label={t('active_agents_count') || 'Active Agents'} value={data?.activeAgents || 0} />
                    <Stat label={t('agent_tasks') || 'Agent Tasks'} value={agentTasks.length} />
                    <Stat label={t('resources_allocated') || 'Resources Allocated'} value={Object.keys(resourceAllocation).length} />
                    <Stat label={t('completion_rate') || 'Completion Rate'} value={`${taskStats.completionRate.toFixed(1)}%`} />
                </div>
                {taskStats.total > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-4">
                        <SmallStat label={t('pending') || 'Pending'} value={taskStats.pending} valueClass="text-yellow-400" />
                        <SmallStat label={t('running') || 'Running'} value={taskStats.running} valueClass="text-blue-400" />
                        <SmallStat label={t('completed') || 'Completed'} value={taskStats.completed} valueClass="text-green-400" />
                        <SmallStat label={t('failed') || 'Failed'} value={taskStats.failed} valueClass="text-red-400" />
                        <SmallStat label={t('completion_rate') || 'Completion Rate'} value={`${taskStats.completionRate.toFixed(1)}%`} />
                    </div>
                )}
                {data?.lastUpdated && (
                    <p className="text-xs text-muted-foreground mt-3">
                        {t('last_updated') || 'Last updated'}: {new Date(data.lastUpdated).toLocaleTimeString()}
                    </p>
                )}
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-foreground">{t('agent_tasks') || 'Agent Tasks'}</h3>
                    <div className="flex gap-2">
                        <select
                            value={taskFilter}
                            onChange={(e) => setTaskFilter(e.target.value as any)}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        >
                            <option value="all">{t('all_statuses') || 'All Statuses'}</option>
                            <option value="pending">{t('pending') || 'Pending'}</option>
                            <option value="running">{t('running') || 'Running'}</option>
                            <option value="completed">{t('completed') || 'Completed'}</option>
                            <option value="failed">{t('failed') || 'Failed'}</option>
                        </select>
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value as any)}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        >
                            <option value="all">{t('all_priorities') || 'All Priorities'}</option>
                            <option value="low">{t('low') || 'Low'}</option>
                            <option value="medium">{t('medium') || 'Medium'}</option>
                            <option value="high">{t('high') || 'High'}</option>
                            <option value="critical">{t('critical') || 'Critical'}</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-3 text-sm max-h-[500px] overflow-y-auto">
                    {filteredTasks.length === 0 ? (
                        <p className="text-muted-foreground text-xs">{t('no_tasks') || 'No tasks found'}</p>
                    ) : filteredTasks.map((task: any) => {
                        const allocation = resourceAllocation[task.agentId];
                        return (
                            <div key={task.id} className="p-3 bg-secondary/40 rounded-md">
                                <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                        <p className="font-semibold text-foreground">{task.agentName || task.agentId}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {task.type} • {t(task.status) || task.status}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        task.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                        task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                        task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-gray-500/20 text-gray-400'
                                    }`}>
                                        {task.priority}
                                    </span>
                                </div>
                                <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                                    {task.executionTimeMs && (
                                        <span>{t('execution_time') || 'Time'}: {task.executionTimeMs}ms</span>
                                    )}
                                    {allocation && (
                                        <>
                                            <span>CPU: {allocation.cpu}%</span>
                                            <span>Memory: {allocation.memory}%</span>
                                            <span>API Quota: {allocation.apiQuota}%</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card>
                <h3 className="font-semibold text-foreground mb-3">{t('resource_allocation') || 'Resource Allocation'}</h3>
                <div className="space-y-3 text-sm">
                    {Object.entries(resourceAllocation).length === 0 ? (
                        <p className="text-muted-foreground text-xs">{t('no_data') || 'No data available'}</p>
                    ) : Object.entries(resourceAllocation).map(([agentId, allocation]: [string, any]) => (
                        <div key={agentId} className="p-3 bg-secondary/40 rounded-md">
                            <div className="flex justify-between items-center mb-2">
                                <p className="font-semibold text-foreground">{allocation.agentName || agentId}</p>
                                <span className="text-xs text-muted-foreground">
                                    {allocation.taskCount} {t('tasks') || 'tasks'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-xs">
                                <div>
                                    <p className="text-muted-foreground">CPU</p>
                                    <div className="mt-1 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-500"
                                            style={{ width: `${allocation.cpu}%` }}
                                        />
                                    </div>
                                    <p className="text-foreground mt-1">{allocation.cpu}%</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Memory</p>
                                    <div className="mt-1 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500"
                                            style={{ width: `${allocation.memory}%` }}
                                        />
                                    </div>
                                    <p className="text-foreground mt-1">{allocation.memory}%</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">API Quota</p>
                                    <div className="mt-1 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${allocation.apiQuota}%` }}
                                        />
                                    </div>
                                    <p className="text-foreground mt-1">{allocation.apiQuota}%</p>
                                </div>
                            </div>
                            {allocation.avgExecutionTimeMs > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    {t('avg_execution') || 'Avg execution'}: {allocation.avgExecutionTimeMs}ms
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="text-center">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
    </div>
);

const SmallStat: React.FC<{ label: string; value: string | number; valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="text-center">
        <p className={`text-lg font-bold ${valueClass || 'text-foreground'}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
    </div>
);

export default OrchestrationTab;
