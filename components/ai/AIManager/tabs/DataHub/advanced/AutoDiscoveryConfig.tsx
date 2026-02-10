
import React, { useState, useMemo } from 'react';
import * as api from '../../../../../../services/api';
import { DataHubState, DataPipelineCategorySnapshot } from '../../../../../../types';
import { SummaryCard } from '../../../../../ui/summary-card';
import { EmptyState } from '../../../../../ui/empty-state';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import ApiWrapper from '../../../../../common/ApiWrapper';
import { useAsync } from '../../../../../../hooks/useAsync';

interface AutoDiscoveryConfigProps {
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    findCategorySignal: (categoryKey: string) => DataPipelineCategorySnapshot | undefined;
}

const AutoDiscoveryConfig: React.FC<AutoDiscoveryConfigProps> = ({
    dataHub,
    setDataHub,
    onRefresh,
    t,
    formatTimeAgo,
    findCategorySignal
}) => {
    const toggleAsync = useAsync(api.setAutoDiscoveryEnabled);
    const discoveryAsync = useAsync(api.runAutoDiscovery);

    const [activeTab, setActiveTab] = useState<'discovered' | 'rules' | 'patterns'>('discovered');

    const advanced = dataHub.advanced || { autoDiscovery: { enabled: false, rules: [], discoveredSources: [] } };
    const discovery = advanced.autoDiscovery;

    const metrics = useMemo(() => ({
        totalRules: discovery.rules.length,
        discoveredCount: discovery.discoveredSources.length,
        pendingApproval: discovery.discoveredSources.filter(s => !s.approved).length,
        lastScan: discovery.lastScan,
    }), [discovery]);

    const handleToggleAutoDiscovery = async (enabled: boolean) => {
        try {
            const updated = await toggleAsync.execute(enabled);
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to toggle auto discovery:', e);
        }
    };

    const handleRunDiscovery = async () => {
        try {
            await discoveryAsync.execute();
            onRefresh();
        } catch (e: any) {
            console.error('Discovery failed:', e);
        }
    };

    return (
        <ApiWrapper
            error={toggleAsync.error || discoveryAsync.error}
            setError={() => { toggleAsync.setError(null); discoveryAsync.setError(null); }}
            isLoading={toggleAsync.isLoading || discoveryAsync.isLoading}
        >
            <div className="bg-card border border-border rounded-lg p-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            🔍 {t('auto_discovery') || 'Auto Discovery'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('auto_discovery_desc') || 'Automatically find and suggest new data sources based on existing patterns.'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={discovery.enabled}
                                onChange={(e) => handleToggleAutoDiscovery(e.target.checked)}
                                disabled={toggleAsync.isLoading}
                                className="rounded"
                            />
                            <span className="text-foreground">{t('enable') || 'Enable'}</span>
                        </label>
                        <ActionButton
                            variant="primary"
                            size="sm"
                            loading={discoveryAsync.isLoading}
                            onClick={handleRunDiscovery}
                            disabled={!discovery.enabled}
                        >
                            {t('run_discovery_btn') || 'Scan for Sources'}
                        </ActionButton>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <SummaryCard
                        label={t('discovery_rules') || 'Active Rules'}
                        value={metrics.totalRules}
                        icon={<span className="text-2xl">📋</span>}
                    />
                    <SummaryCard
                        label={t('discovered_total') || 'Total Found'}
                        value={metrics.discoveredCount}
                        icon={<span className="text-2xl">✨</span>}
                    />
                    <SummaryCard
                        label={t('pending_approval') || 'Pending'}
                        value={metrics.pendingApproval}
                        variant={metrics.pendingApproval > 0 ? 'warning' : 'default'}
                        icon={<span className="text-2xl">⏳</span>}
                    />
                    <SummaryCard
                        label={t('last_scan') || 'Last Scan'}
                        value={metrics.lastScan ? formatTimeAgo(metrics.lastScan) : 'Never'}
                        icon={<span className="text-2xl">📅</span>}
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b border-border mb-4">
                    {(['discovered', 'rules', 'patterns'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-2 text-xs font-semibold transition-colors relative ${activeTab === tab ? 'text-purple-400' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {t(`discovery_tab_${tab}`) || tab.toUpperCase()}
                            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400 rounded-full" />}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                {activeTab === 'discovered' && (
                    <div className="space-y-3">
                        {discovery.discoveredSources.length > 0 ? (
                            discovery.discoveredSources.map(source => (
                                <div key={source.id} className="border border-border rounded-lg p-3 flex justify-between items-center group">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-sm">{source.name}</h4>
                                            <StatusBadge status={source.approved ? 'success' : 'warning'} label={source.approved ? 'Approved' : 'New'} size="sm" />
                                        </div>
                                        <p className="text-[11px] text-muted-foreground break-all">{source.url}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[10px] bg-secondary/30 px-1.5 rounded text-muted-foreground">{source.category}</span>
                                            <span className="text-[10px] text-purple-300">Confidence: {source.confidence || 85}%</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ActionButton variant="ghost" size="sm" className="text-red-400">Ignore</ActionButton>
                                        <ActionButton variant="success" size="sm">Approve</ActionButton>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <EmptyState
                                title="No sources discovered yet"
                                description="Run a network scan to automatically find potential data sources based on your configured rules."
                                icon={<span className="text-4xl">🔎</span>}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'rules' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">Scanning Rules</h4>
                            <ActionButton variant="secondary" size="sm">+ Add Rule</ActionButton>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {discovery.rules.map(rule => (
                                <div key={rule.id} className="border border-border rounded-lg p-3 bg-secondary/10">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-sm">{rule.name}</span>
                                        <StatusBadge status="info" label={rule.priority} size="sm" />
                                    </div>
                                    <code className="text-[10px] bg-background p-1 block rounded mb-2 font-mono truncate">{rule.pattern}</code>
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Found: {rule.discoveredCount}</span>
                                        <span>Last checked: {rule.lastCheck ? formatTimeAgo(rule.lastCheck) : 'Never'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'patterns' && (
                    <div className="py-8">
                        <EmptyState
                            title="Discovery Patterns visualization"
                            description="This view will show clusters of discovered data and how they relate to existing categories."
                            icon={<span className="text-4xl">🕸️</span>}
                        />
                    </div>
                )}
            </div>
        </ApiWrapper>
    );
};

export default AutoDiscoveryConfig;
