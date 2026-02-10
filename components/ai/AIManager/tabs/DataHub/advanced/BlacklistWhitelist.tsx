
import React, { useState, useMemo } from 'react';
import * as api from '../../../../../../services/api';
import { DataHubState } from '../../../../../../types';
import { SummaryCard } from '../../../../../ui/summary-card';
import { EmptyState } from '../../../../../ui/empty-state';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import ApiWrapper from '../../../../../common/ApiWrapper';
import { useAsync } from '../../../../../../hooks/useAsync';

interface BlacklistWhitelistProps {
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    sourceQualityMap: Record<string, any>;
    prioritizationSummary: { lastUpdate?: string };
}

const BlacklistWhitelist: React.FC<BlacklistWhitelistProps> = ({
    dataHub,
    setDataHub,
    onRefresh,
    t,
    formatTimeAgo,
    sourceQualityMap,
    prioritizationSummary
}) => {
    const [activeTab, setActiveTab] = useState<'blacklist' | 'whitelist' | 'rules'>('blacklist');
    const [searchTerm, setSearchTerm] = useState('');
    const listAsync = useAsync(async () => {
        // Placeholder for future refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        return dataHub;
    });

    const advanced = dataHub.advanced || { blacklist: { sources: [], reasons: {} }, whitelist: { sources: [] } };
    const blacklist = advanced.blacklist;
    const whitelist = advanced.whitelist;

    const metrics = useMemo(() => ({
        blockedCount: blacklist.sources.length,
        trustedCount: whitelist.sources.length,
        activeRules: 5, // Placeholder
        lastSync: new Date().toISOString()
    }), [blacklist, whitelist]);

    return (
        <ApiWrapper error={listAsync.error} setError={listAsync.setError} isLoading={listAsync.isLoading}>
            <div className="bg-card border border-border rounded-lg p-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            🛡️ {t('safety_filtering') || 'Safety & Filtering'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('safety_filtering_desc') || 'Manage blocked domains, trusted sources, and automatic filtering rules.'}
                        </p>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <SummaryCard
                        label={t('blocked_sources') || 'Blacklisted'}
                        value={metrics.blockedCount}
                        variant="error"
                        icon={<span className="text-2xl">🚫</span>}
                    />
                    <SummaryCard
                        label={t('trusted_sources') || 'Whitelisted'}
                        value={metrics.trustedCount}
                        variant="success"
                        icon={<span className="text-2xl">✅</span>}
                    />
                    <SummaryCard
                        label={t('filtering_rules') || 'Active Rules'}
                        value={metrics.activeRules}
                        icon={<span className="text-2xl">📖</span>}
                    />
                    <SummaryCard
                        label={t('last_filter_sync') || 'Last Sync'}
                        value="Just now"
                        icon={<span className="text-2xl">🔄</span>}
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-6 border-b border-border mb-6">
                    {(['blacklist', 'whitelist', 'rules'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 text-xs font-bold transition-all relative ${activeTab === tab ? 'text-purple-400' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {t(`safety_tab_${tab}`) || tab.toUpperCase()}
                            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-400 rounded-full" />}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                    <ActionButton variant="primary" size="sm">+ Add Entry</ActionButton>
                </div>

                {/* List Content */}
                {activeTab === 'blacklist' && (
                    <div className="space-y-2">
                        {blacklist.sources.length > 0 ? (
                            blacklist.sources.map(source => (
                                <div key={source} className="border border-border rounded-lg p-3 flex justify-between items-center bg-red-500/5">
                                    <div>
                                        <p className="font-mono text-sm text-red-400">{source}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Reason: {blacklist.reasons[source] || 'Low quality / Suspicious behavior'}
                                        </p>
                                    </div>
                                    <ActionButton variant="ghost" size="sm" className="text-muted-foreground hover:text-green-400">Unblock</ActionButton>
                                </div>
                            ))
                        ) : (
                            <EmptyState title="Blacklist is empty" description="No domains or sources are currently blocked." icon={<span className="text-3xl">🛡️</span>} />
                        )}
                    </div>
                )}

                {activeTab === 'whitelist' && (
                    <div className="space-y-2">
                        {whitelist.sources.length > 0 ? (
                            whitelist.sources.map(source => (
                                <div key={source} className="border border-border rounded-lg p-3 flex justify-between items-center bg-green-500/5">
                                    <div>
                                        <p className="font-mono text-sm text-green-400">{source}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">Trusted since: Oct 12, 2023</p>
                                    </div>
                                    <ActionButton variant="ghost" size="sm" className="text-muted-foreground hover:text-red-400">Remove</ActionButton>
                                </div>
                            ))
                        ) : (
                            <EmptyState title="Whitelist is empty" description="No sources are marked as permanently trusted." icon={<span className="text-3xl">💎</span>} />
                        )}
                    </div>
                )}

                {activeTab === 'rules' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { name: 'Auto-Block Failed Connections', desc: 'Block sources that fail 3 consecutive attempts.', enabled: true },
                            { name: 'Spam Pattern Detection', desc: 'Auto-blacklist sources matching known spam regex.', enabled: true },
                            { name: 'VIP Priority Whitelist', desc: 'Never block official API endpoints.', enabled: true },
                            { name: 'Temporary TTL Blocks', desc: 'Block rate-limited sources for 1 hour.', enabled: false },
                        ].map(rule => (
                            <div key={rule.name} className="border border-border rounded-lg p-4 bg-secondary/5">
                                <div className="flex justify-between mb-2">
                                    <h5 className="font-bold text-sm">{rule.name}</h5>
                                    <input type="checkbox" checked={rule.enabled} className="rounded" readOnly />
                                </div>
                                <p className="text-xs text-muted-foreground">{rule.desc}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ApiWrapper>
    );
};

export default BlacklistWhitelist;
