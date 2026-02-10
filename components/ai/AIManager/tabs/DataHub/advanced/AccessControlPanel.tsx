
import React, { useState, useMemo } from 'react';
import * as api from '../../../../../../services/api';
import { DataHubState, AIAgent } from '../../../../../../types';
import { SummaryCard } from '../../../../../ui/summary-card';
import { EmptyState } from '../../../../../ui/empty-state';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import ApiWrapper from '../../../../../common/ApiWrapper';
import { useAsync } from '../../../../../../hooks/useAsync';

interface AccessControlPanelProps {
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    agents: AIAgent[];
    sourceQualityMap: Record<string, any>;
    getStatusBadgeClass: (status?: string) => string;
}

const AccessControlPanel: React.FC<AccessControlPanelProps> = ({
    dataHub,
    setDataHub,
    onRefresh,
    t,
    formatTimeAgo,
    agents,
    sourceQualityMap,
    getStatusBadgeClass
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'permissions' | 'roles' | 'logs' | 'keys' | 'ip'>('permissions');
    const accessAsync = useAsync(async () => {
        // Placeholder for future access control refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        return dataHub;
    });
    const [searchTerm, setSearchTerm] = useState('');

    const advanced = dataHub.advanced || { accessControl: [], accessLogs: [] };
    const accessControl = advanced.accessControl || [];
    const accessLogs = advanced.accessLogs || [];

    // Calculate metrics
    const metrics = useMemo(() => {
        return {
            totalRules: accessControl.length,
            restrictedSources: accessControl.filter(ac => ac.allowedAgents.length > 0 || ac.maxRequestsPerMinute).length,
            activeKeys: 12, // Placeholder
            blockedAttempts: accessLogs.filter(l => l.status === 'denied').length,
        };
    }, [accessControl, accessLogs]);

    const filteredSources = useMemo(() => {
        return dataHub.sources.filter(source =>
            !searchTerm ||
            source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            source.category.toLowerCase().includes(query => query.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [dataHub.sources, searchTerm]);

    return (
        <ApiWrapper error={accessAsync.error} setError={accessAsync.setError} isLoading={accessAsync.isLoading}>
            <div className="bg-card border border-border rounded-lg p-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            🔐 {t('access_control') || 'Access Control'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('access_control_desc') || 'Manage permissions, roles, API keys, and access security.'}
                        </p>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <SummaryCard
                        label={t('access_rules') || 'Access Rules'}
                        value={metrics.totalRules}
                        icon={<span className="text-2xl">🛡️</span>}
                    />
                    <SummaryCard
                        label={t('restricted_sources') || 'Restricted'}
                        value={metrics.restrictedSources}
                        variant={metrics.restrictedSources > 0 ? 'warning' : 'default'}
                        icon={<span className="text-2xl">🚫</span>}
                    />
                    <SummaryCard
                        label={t('active_api_keys') || 'API Keys'}
                        value={metrics.activeKeys}
                        icon={<span className="text-2xl">🔑</span>}
                    />
                    <SummaryCard
                        label={t('denied_requests') || 'Blocked'}
                        value={metrics.blockedAttempts}
                        variant={metrics.blockedAttempts > 0 ? 'error' : 'default'}
                        icon={<span className="text-2xl">⚠️</span>}
                    />
                </div>

                {/* Sub-Tabs */}
                <div className="flex gap-1 border-b border-border mb-6">
                    {(['permissions', 'roles', 'logs', 'keys', 'ip'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveSubTab(tab)}
                            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${activeSubTab === tab
                                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20'
                                }`}
                        >
                            {t(`access_tab_${tab}`) || tab.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Permissions View */}
                {activeSubTab === 'permissions' && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={t('search_sources') || 'Search sources...'}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                            />
                            <ActionButton variant="secondary" size="sm">
                                {t('bulk_edit') || 'Bulk Edit'}
                            </ActionButton>
                        </div>

                        <div className="space-y-3">
                            {filteredSources.map(source => {
                                const control = accessControl.find(ac => ac.sourceId === source.id);
                                return (
                                    <div key={source.id} className="border border-border rounded-lg p-3 hover:bg-secondary/10 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-semibold text-sm">{source.name}</h4>
                                                <p className="text-[11px] text-muted-foreground">{source.category}</p>

                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {control ? (
                                                        <>
                                                            <StatusBadge
                                                                status={control.allowedAgents.length > 0 ? 'warning' : 'success'}
                                                                label={control.allowedAgents.length > 0 ? `${control.allowedAgents.length} Agents` : 'Public (Internal)'}
                                                                size="sm"
                                                            />
                                                            {control.maxRequestsPerMinute && (
                                                                <StatusBadge
                                                                    status="info"
                                                                    label={`${control.maxRequestsPerMinute} req/min`}
                                                                    size="sm"
                                                                />
                                                            )}
                                                        </>
                                                    ) : (
                                                        <StatusBadge status="neutral" label="Default Access" size="sm" />
                                                    )}
                                                </div>
                                            </div>
                                            <ActionButton variant="ghost" size="sm">
                                                {t('configure') || 'Configure'}
                                            </ActionButton>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Roles View */}
                {activeSubTab === 'roles' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">{t('user_roles') || 'Roles & Responsibilities'}</h4>
                            <ActionButton variant="primary" size="sm">+ {t('add_role') || 'Add Role'}</ActionButton>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {['Admin', 'Editor', 'Analyst', 'Viewer'].map(role => (
                                <div key={role} className="border border-border rounded-lg p-4 bg-secondary/5">
                                    <div className="flex justify-between mb-2">
                                        <h5 className="font-bold text-purple-400">{role}</h5>
                                        <StatusBadge status="info" label="Built-in" size="sm" />
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        {role === 'Admin' ? 'Full system access.' :
                                            role === 'Editor' ? 'Can manage data and pipelines.' :
                                                role === 'Analyst' ? 'Can view and export reports.' : 'Read-only access.'}
                                    </p>
                                    <div className="flex gap-2">
                                        <ActionButton variant="ghost" size="sm">{t('edit_permissions') || 'Edit'}</ActionButton>
                                        <ActionButton variant="ghost" size="sm">{t('view_users') || 'Users'}</ActionButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Logs View */}
                {activeSubTab === 'logs' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">{t('access_audit_logs') || 'Access Audit Logs'}</h4>
                            <ActionButton variant="ghost" size="sm">{t('clear_logs') || 'Clear'}</ActionButton>
                        </div>
                        {accessLogs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="text-muted-foreground border-b border-border">
                                        <tr>
                                            <th className="py-2 px-1">Time</th>
                                            <th className="py-2 px-1">User/Agent</th>
                                            <th className="py-2 px-1">Action</th>
                                            <th className="py-2 px-1">Resource</th>
                                            <th className="py-2 px-1">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accessLogs.map((log, i) => (
                                            <tr key={i} className="border-b border-border/50 hover:bg-secondary/5">
                                                <td className="py-2 px-1 text-muted-foreground">{formatTimeAgo(log.timestamp)}</td>
                                                <td className="py-2 px-1 font-medium">{log.subjectId}</td>
                                                <td className="py-2 px-1 uppercase text-[10px]">{log.action}</td>
                                                <td className="py-2 px-1 text-muted-foreground truncate max-w-[150px]">{log.resourceId}</td>
                                                <td className="py-2 px-1">
                                                    <StatusBadge
                                                        status={log.status === 'denied' ? 'error' : 'success'}
                                                        label={log.status}
                                                        size="sm"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState
                                title="No access logs recorded"
                                description="All security-related actions will be logged here for auditing."
                                icon={<span className="text-3xl">📋</span>}
                            />
                        )}
                    </div>
                )}

                {/* Keys View */}
                {activeSubTab === 'keys' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">{t('api_keys') || 'External API Keys'}</h4>
                            <ActionButton variant="primary" size="sm">+ {t('generate_key') || 'New Key'}</ActionButton>
                        </div>
                        <div className="space-y-2">
                            {[1, 2, 3].map(id => (
                                <div key={id} className="border border-border rounded-lg p-3 flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-medium">Production Export Key {id}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">tk_live_••••••••••••</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <ActionButton variant="ghost" size="sm">Revoke</ActionButton>
                                        <ActionButton variant="secondary" size="sm">Copy</ActionButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* IP Whitelist View */}
                {activeSubTab === 'ip' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">{t('ip_whitelisting') || 'IP Access Control'}</h4>
                            <ActionButton variant="primary" size="sm">+ {t('add_ip') || 'Add IP'}</ActionButton>
                        </div>
                        <div className="bg-secondary/20 p-4 rounded-lg border border-border">
                            <p className="text-xs font-semibold mb-2">Default Policy: <span className="text-red-400">Deny all except whitelisted</span></p>
                            <div className="space-y-2 mt-3">
                                {['192.168.1.1', '10.0.0.45', '45.123.4.5'].map(ip => (
                                    <div key={ip} className="flex justify-between items-center bg-background p-2 rounded border border-border">
                                        <span className="text-xs font-mono">{ip}</span>
                                        <button className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ApiWrapper>
    );
};

export default AccessControlPanel;
