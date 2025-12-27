import React, { useEffect, useMemo, useState } from 'react';
import { ArtemisState, SystemHealth, AgentHealth } from '../../../../types.ts';
import * as api from '../../../../services/api.ts';

type Props = {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const MonitoringTab: React.FC<Props> = ({ artemis, t, onRefresh, Card }) => {
    const health: SystemHealth | undefined = artemis.systemHealth;
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [lastHealthCheck, setLastHealthCheck] = useState<string | null>(null);
    const [agentFilter, setAgentFilter] = useState<'all' | 'active' | 'inactive' | 'error' | 'training'>('all');
    const [integrationFilter, setIntegrationFilter] = useState<'all' | 'connected' | 'disconnected' | 'error'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<AgentHealth | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(30); // seconds
    const [healthHistory, setHealthHistory] = useState<Array<{ timestamp: string; overall: string; agents: number; alerts: number }>>([]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            handleHealthCheck(true);
        }, autoRefreshInterval * 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefresh, autoRefreshInterval]);

    if (!health) {
        return <Card><p className="text-sm text-muted-foreground">{t('no_data') || 'No data available'}</p></Card>;
    }

    const handleHealthCheck = async (silent = false) => {
        setIsCheckingHealth(true);
        try {
            const newHealth = await api.checkSystemHealth();
            setLastHealthCheck(new Date().toISOString());

            setHealthHistory(prev => [
                {
                    timestamp: new Date().toISOString(),
                    overall: newHealth.overall,
                    agents: newHealth.agents.length,
                    alerts: newHealth.alerts.filter(a => !a.resolved).length,
                },
                ...prev.slice(0, 49),
            ]);

            if (!silent) {
                alert(t('health_check_complete') || `Health check complete. Overall: ${t(newHealth.overall) || newHealth.overall}`);
            }
            onRefresh();
        } catch (e) {
            console.error('Failed to check health:', e);
            if (!silent) {
                alert(t('health_check_failed') || 'Failed to check system health');
            }
        } finally {
            setIsCheckingHealth(false);
        }
    };

    const handleResolveAlert = async (alertId: string) => {
        try {
            const current = await api.fetchArtemisState();
            const alert = current.systemHealth.alerts.find(a => a.id === alertId);
            if (!alert) return;

            const updated = {
                ...current,
                systemHealth: {
                    ...current.systemHealth,
                    alerts: current.systemHealth.alerts.map(a =>
                        a.id === alertId ? { ...a, resolved: true } : a
                    ),
                },
            };

            await api.updateArtemisConfig(updated);
            onRefresh();
        } catch (e) {
            console.error('Failed to resolve alert:', e);
            alert(t('resolve_alert_failed') || 'Failed to resolve alert');
        }
    };

    const handleDismissAlert = async (alertId: string) => {
        try {
            const current = await api.fetchArtemisState();
            const updated = {
                ...current,
                systemHealth: {
                    ...current.systemHealth,
                    alerts: current.systemHealth.alerts.filter(a => a.id !== alertId),
                },
            };
            await api.updateArtemisConfig(updated);
            onRefresh();
        } catch (e) {
            console.error('Failed to dismiss alert:', e);
            alert(t('dismiss_alert_failed') || 'Failed to dismiss alert');
        }
    };

    const filteredAgents = useMemo(() => {
        return health.agents.filter(agent => {
            if (agentFilter !== 'all' && agent.status !== agentFilter) return false;
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!agent.agentId.toLowerCase().includes(query)) return false;
            }
            return true;
        });
    }, [health.agents, agentFilter, searchQuery]);

    const filteredIntegrations = useMemo(() => {
        return health.integrations.filter(integration => {
            if (integrationFilter !== 'all' && integration.status !== integrationFilter) return false;
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (
                    !integration.name.toLowerCase().includes(query) &&
                    !integration.type.toLowerCase().includes(query)
                ) {
                    return false;
                }
            }
            return true;
        });
    }, [health.integrations, integrationFilter, searchQuery]);

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('system_health_monitoring') || 'System Health Monitoring'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('monitoring_desc') || 'Monitor system health, agents, integrations, and resources'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <span className="text-muted-foreground">{t('auto_refresh') || 'Auto Refresh'}</span>
                        </label>
                        {autoRefresh && (
                            <select
                                value={autoRefreshInterval}
                                onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value, 10))}
                                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                                <option value="10">10s</option>
                                <option value="30">30s</option>
                                <option value="60">1m</option>
                                <option value="300">5m</option>
                            </select>
                        )}
                        <button
                            onClick={() => handleHealthCheck(false)}
                            disabled={isCheckingHealth}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isCheckingHealth ? t('checking') || 'Checking...' : t('check_health') || 'Check Health'}
                        </button>
                        {lastHealthCheck && (
                            <span className="text-xs text-muted-foreground self-center">
                                {t('last_check') || 'Last check'}: {new Date(lastHealthCheck).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>

                <div className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-muted-foreground">{t('overall_status') || 'Overall Status'}:</span>
                        <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                health.overall === 'healthy'
                                    ? 'bg-green-500/20 text-green-400'
                                    : health.overall === 'degraded'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-red-500/20 text-red-400'
                            }`}
                        >
                            {t(health.overall) || health.overall}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-sm text-muted-foreground">{t('agent_health') || 'Agent Health'}</p>
                            <select
                                value={agentFilter}
                                onChange={(e) => setAgentFilter(e.target.value as any)}
                                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                                <option value="all">{t('all') || 'All'}</option>
                                <option value="active">{t('active') || 'Active'}</option>
                                <option value="inactive">{t('inactive') || 'Inactive'}</option>
                                <option value="error">{t('error') || 'Error'}</option>
                                <option value="training">{t('training') || 'Training'}</option>
                            </select>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('search_agents') || 'Search agents...'}
                            className="w-full px-2 py-1 mb-2 bg-background border border-border rounded text-xs text-foreground"
                        />
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {filteredAgents.length > 0 ? (
                                filteredAgents.map(agent => (
                                    <div
                                        key={agent.agentId}
                                        className="p-2 border border-border rounded text-xs hover:border-purple-500/50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedAgent(agent)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold">{agent.agentId}</span>
                                            <span
                                                className={`px-2 py-0.5 rounded ${
                                                    agent.status === 'active'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : agent.status === 'error'
                                                        ? 'bg-red-500/20 text-red-400'
                                                        : agent.status === 'training'
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                                }`}
                                            >
                                                {t(agent.status) || agent.status}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-muted-foreground">
                                            <span>CPU: {agent.resourceUsage.cpu.toFixed(1)}%</span>
                                            <span>Mem: {agent.resourceUsage.memory.toFixed(1)}%</span>
                                            <span>API: {agent.resourceUsage.apiCalls}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-1 text-xs text-muted-foreground">
                                            <span>{t('performance') || 'Performance'}: {agent.performance.toFixed(1)}%</span>
                                            <span>{t('uptime') || 'Uptime'}: {formatUptime(agent.uptime)}</span>
                                        </div>
                                        {agent.errors.length > 0 && (
                                            <div className="mt-1 text-xs text-red-400">
                                                {t('errors') || 'Errors'}: {agent.errors.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                    {t('no_agents_found') || 'No agents found'}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-sm text-muted-foreground">{t('integrations') || 'Integrations'}</p>
                            <select
                                value={integrationFilter}
                                onChange={(e) => setIntegrationFilter(e.target.value as any)}
                                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                                <option value="all">{t('all') || 'All'}</option>
                                <option value="connected">{t('connected') || 'Connected'}</option>
                                <option value="disconnected">{t('disconnected') || 'Disconnected'}</option>
                                <option value="error">{t('error') || 'Error'}</option>
                            </select>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {filteredIntegrations.length > 0 ? (
                                filteredIntegrations.map((integration, idx) => (
                                    <div key={idx} className="p-2 border border-border rounded text-xs">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="font-semibold">{integration.name}</span>
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    ({t(integration.type) || integration.type})
                                                </span>
                                            </div>
                                            <span
                                                className={`px-2 py-0.5 rounded ${
                                                    integration.status === 'connected'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : integration.status === 'error'
                                                        ? 'bg-red-500/20 text-red-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                                }`}
                                            >
                                                {t(integration.status) || integration.status}
                                            </span>
                                        </div>
                                        {integration.latency !== undefined && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t('latency') || 'Latency'}: {integration.latency}ms
                                            </p>
                                        )}
                                        {integration.errorRate !== undefined && (
                                            <p className="text-xs text-muted-foreground">
                                                {t('error_rate') || 'Error Rate'}: {integration.errorRate.toFixed(2)}%
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('last_check') || 'Last check'}:{' '}
                                            {integration.lastCheck
                                                ? new Date(integration.lastCheck).toLocaleString()
                                                : '-'}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                    {t('no_integrations_found') || 'No integrations found'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">
                            {t('cpu_usage') || 'CPU Usage'}
                        </p>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${health.resources.cpu}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">
                            {health.resources.cpu.toFixed(1)}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">
                            {t('memory_usage') || 'Memory Usage'}
                        </p>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div
                                className="bg-purple-500 h-2 rounded-full"
                                style={{ width: `${health.resources.memory}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">
                            {health.resources.memory.toFixed(1)}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">
                            {t('network_usage') || 'Network Usage'}
                        </p>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${health.resources.network}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">
                            {health.resources.network.toFixed(1)}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">
                            {t('api_quota') || 'API Quota'}
                        </p>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div
                                className="bg-yellow-500 h-2 rounded-full"
                                style={{
                                    width: `${
                                        (health.resources.apiQuota.used / health.resources.apiQuota.limit) * 100
                                    }%`,
                                }}
                            ></div>
                        </div>
                        <p className="text-xs text-foreground mt-1">
                            {health.resources.apiQuota.used}/{health.resources.apiQuota.limit}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {t('reset_at') || 'Reset At'}:{' '}
                            {health.resources.apiQuota.resetAt
                                ? new Date(health.resources.apiQuota.resetAt).toLocaleTimeString()
                                : '-'}
                        </p>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="font-semibold text-foreground mb-3">{t('alerts') || 'Alerts'}</h3>
                <div className="space-y-2 text-sm">
                    {health.alerts.length === 0 ? (
                        <p className="text-muted-foreground text-xs">
                            {t('no_data') || 'No data available'}
                        </p>
                    ) : (
                        health.alerts.map((alert) => (
                            <div
                                key={alert.id}
                                className="p-2 rounded bg-secondary/40 flex justify-between items-center gap-3"
                            >
                                <div>
                                    <p className="font-semibold text-foreground text-sm">{alert.message}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {alert.type} {alert.timestamp ? `• ${new Date(alert.timestamp).toLocaleTimeString()}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!alert.resolved && (
                                        <button
                                            onClick={() => handleResolveAlert(alert.id!)}
                                            className="text-xs px-2 py-1 rounded bg-green-600/60 text-white hover:bg-green-600"
                                        >
                                            {t('resolve') || 'Resolve'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDismissAlert(alert.id!)}
                                        className="text-xs px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600"
                                    >
                                        {t('dismiss') || 'Dismiss'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            {selectedAgent && (
                <Card>
                    <h3 className="font-semibold text-foreground mb-2">
                        {t('agent_details') || 'Agent Details'}: {selectedAgent.agentId}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-foreground">
                        <div>
                            <p>{t('status') || 'Status'}: {t(selectedAgent.status) || selectedAgent.status}</p>
                            <p>{t('performance') || 'Performance'}: {selectedAgent.performance.toFixed(1)}%</p>
                            <p>{t('uptime') || 'Uptime'}: {formatUptime(selectedAgent.uptime)}</p>
                        </div>
                        <div>
                            <p>CPU: {selectedAgent.resourceUsage.cpu.toFixed(1)}%</p>
                            <p>{t('memory') || 'Memory'}: {selectedAgent.resourceUsage.memory.toFixed(1)}%</p>
                            <p>API: {selectedAgent.resourceUsage.apiCalls}</p>
                        </div>
                    </div>
                    {selectedAgent.errors.length > 0 && (
                        <div className="mt-2 text-xs text-red-400">
                            {t('errors') || 'Errors'}: {selectedAgent.errors.join(', ')}
                        </div>
                    )}
                </Card>
            )}

            {healthHistory.length > 0 && (
                <Card>
                    <h3 className="font-semibold text-foreground mb-3">
                        {t('health_history') || 'Health History'}
                    </h3>
                    <div className="space-y-1 text-xs text-foreground max-h-40 overflow-y-auto">
                        {healthHistory.map((h) => (
                            <div key={h.timestamp} className="flex justify-between">
                                <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
                                <span>{t(h.overall) || h.overall}</span>
                                <span>{t('agents') || 'Agents'}: {h.agents}</span>
                                <span>{t('alerts') || 'Alerts'}: {h.alerts}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string | number; valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="text-center p-3 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold text-foreground mt-1 ${valueClass || ''}`}>{value}</p>
    </div>
);

const SmallStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-secondary/40 rounded p-3 text-center">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
);

export default MonitoringTab;

