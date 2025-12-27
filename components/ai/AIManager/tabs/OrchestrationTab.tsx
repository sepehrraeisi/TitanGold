import React, { useMemo, useState } from 'react';
import { ArtemisState, AgentTask, ResourceAllocation } from '../../../../types.ts';

type Props = {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const OrchestrationTab: React.FC<Props> = ({ artemis, t, onRefresh, Card }) => {
    const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');

    const agentTasks: AgentTask[] = artemis.orchestration?.agentTasks || [];
    const resourceAllocation: Record<string, ResourceAllocation> = artemis.orchestration?.resourceAllocation || {};

    const taskStats = useMemo(() => {
        const tasks = agentTasks;
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            running: tasks.filter(t => t.status === 'running').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            completionRate: tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0,
        };
    }, [agentTasks]);

    const filteredTasks = useMemo(() => {
        return agentTasks.filter(task => {
            if (taskFilter !== 'all' && task.status !== taskFilter) return false;
            if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
            return true;
        });
    }, [agentTasks, taskFilter, priorityFilter]);

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('orchestration_summary') || 'Orchestration Summary'}</h3>
                        <p className="text-xs text-muted-foreground">{t('orchestration_desc') || 'Tasks, resources, and failover status for agents'}</p>
                    </div>
                    <button
                        onClick={onRefresh}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {t('refresh') || 'Refresh'}
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Stat label={t('active_agents') || 'Active Agents'} value={artemis.orchestration?.activeAgents || 0} />
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
                <div className="space-y-3 text-sm">
                    {filteredTasks.length === 0 ? (
                        <p className="text-muted-foreground text-xs">{t('no_data') || 'No data available'}</p>
                    ) : filteredTasks.map(task => {
                        const allocation = resourceAllocation[task.agentId];
                        const score = allocation ? (allocation.cpu + allocation.memory + allocation.network) / 3 : 0;
                        return (
                            <div key={task.id} className="p-3 bg-secondary/40 rounded-md">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-foreground">{task.task}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {t(task.status) || task.status} • {task.agentId}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {t('priority') || 'Priority'}: {task.priority}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Score: {score.toFixed(0)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card>
                <h3 className="font-semibold text-foreground mb-4">{t('resource_allocation') || 'Resource Allocation'}</h3>
                {Object.keys(resourceAllocation).length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {Object.entries(resourceAllocation).map(([agentId, allocation]) => (
                            <div key={agentId} className="p-3 border border-border rounded-lg text-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="font-semibold text-foreground">{agentId}</p>
                                    <span className="text-xs text-muted-foreground">
                                        {t('priority') || 'Priority'}: {allocation.priority}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <ResourceBar label={t('cpu_usage') || 'CPU'} value={allocation.cpu} color="bg-blue-500" />
                                    <ResourceBar label={t('memory_usage') || 'Memory'} value={allocation.memory} color="bg-purple-500" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-6">
                        {t('no_resource_allocation') || 'No resource allocation configured.'}
                    </p>
                )}
            </Card>

            {artemis.orchestration.failoverStatus && artemis.orchestration.failoverStatus.enabled && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('failover_status') || 'Failover Status'}</h3>
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                            {t('enabled') || 'Enabled'}
                        </span>
                    </div>
                    {artemis.orchestration.failoverStatus.lastFailover && (
                        <div className="p-3 border border-border rounded-lg text-sm">
                            <p className="font-semibold text-foreground">
                                {t('last_failover') || 'Last Failover'}:{' '}
                                {artemis.orchestration.failoverStatus.lastFailover.fromAgent} →{' '}
                                {artemis.orchestration.failoverStatus.lastFailover.toAgent}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {artemis.orchestration.failoverStatus.lastFailover.reason}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {new Date(artemis.orchestration.failoverStatus.lastFailover.timestamp).toLocaleString()}
                            </p>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="text-center p-3 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
    </div>
);

const SmallStat: React.FC<{ label: string; value: string | number; valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="bg-secondary/40 rounded p-3 text-center">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-xl font-semibold text-foreground ${valueClass || ''}`}>{value}</p>
    </div>
);

const ResourceBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div>
        <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground">{value.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
            <div className={`${color} h-2 rounded-full`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }}></div>
        </div>
    </div>
);

export default OrchestrationTab;

