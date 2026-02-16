
import React, { useState, useMemo } from 'react';
import * as api from '../../../../../../services/api';
import { DataHubState, AIAgent } from '../../../../../../types';
import { SummaryCard } from '../../../../../ui/summary-card';
import { EmptyState } from '../../../../../ui/empty-state';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import ApiWrapper from '../../../../../common/ApiWrapper';
import { useAsync } from '../../../../../../hooks/useAsync';

interface TelegramPublisherProps {
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    agents: AIAgent[];
    agentMap: Record<string, AIAgent>;
}

const TelegramPublisher: React.FC<TelegramPublisherProps> = ({
    dataHub,
    setDataHub,
    onRefresh,
    t,
    agents,
    agentMap
}) => {
    const [activeTab, setActiveTab] = useState<'channels' | 'history' | 'templates'>('channels');
    const publisherAsync = useAsync(async () => {
        // Placeholder for future refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        return dataHub;
    });

    const advanced = dataHub.advanced || { telegramPublishers: [], publisherHistory: [] };
    const publishers = advanced.telegramPublishers;
    const history = advanced.publisherHistory;

    const metrics = useMemo(() => ({
        totalChannels: publishers.length,
        delivered24h: history.filter(h => h.status === 'sent').length,
        failed24h: history.filter(h => h.status === 'failed').length,
        successRate: history.length > 0
            ? Math.round((history.filter(h => h.status === 'sent').length / history.length) * 100)
            : 100
    }), [publishers, history]);

    return (
        <ApiWrapper error={publisherAsync.error} setError={publisherAsync.setError} isLoading={publisherAsync.isLoading}>
            <div className="bg-card border border-border rounded-lg p-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            📱 {t('telegram_publisher') || 'Telegram Publisher'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('telegram_publisher_desc') || 'Broadcast analyzed signals to dedicated Telegram channels and groups.'}
                        </p>
                    </div>
                    <ActionButton variant="primary" size="sm">+ New Channel</ActionButton>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <SummaryCard
                        label={t('active_channels') || 'Channels'}
                        value={metrics.totalChannels}
                        icon={<span className="text-2xl">📡</span>}
                    />
                    <SummaryCard
                        label={t('delivered_24h') || 'Delivered'}
                        value={metrics.delivered24h}
                        variant="success"
                        icon={<span className="text-2xl">📤</span>}
                    />
                    <SummaryCard
                        label={t('failed_24h') || 'Failed'}
                        value={metrics.failed24h}
                        variant={metrics.failed24h > 0 ? 'error' : 'default'}
                        icon={<span className="text-2xl">❌</span>}
                    />
                    <SummaryCard
                        label={t('success_rate') || 'Success Rate'}
                        value={`${metrics.successRate}%`}
                        variant={metrics.successRate < 90 ? 'warning' : 'success'}
                        icon={<span className="text-2xl">📊</span>}
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b border-border mb-6">
                    {(['channels', 'history', 'templates'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-2 text-xs font-bold transition-all border-b-2 ${activeTab === tab ? 'border-purple-500 text-purple-400' : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {t(`publisher_tab_${tab}`) || tab.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                {activeTab === 'channels' && (
                    <div className="space-y-4">
                        {/* Input/Output Channel Mapping Section (TASK-DHT-061) */}
                        {dataHub.sources && dataHub.sources.filter(s => s.type === 'telegram').length > 0 && (
                            <div className="bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-slate-900/80 border border-slate-800/60 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                    <span className="text-sky-400">🔗</span>
                                    {t('telegram_channel_mapping') || 'Input/Output Channel Mapping'}
                                </h5>
                                <p className="text-[11px] text-muted-foreground mb-3">
                                    {t('telegram_mapping_desc') || 'Telegram channels collecting data (input) can be mapped to publisher channels (output) for automated signal broadcasting.'}
                                </p>
                                <div className="space-y-2">
                                    {dataHub.sources
                                        .filter(s => s.type === 'telegram')
                                        .slice(0, 5)
                                        .map(source => {
                                            const linkedPublishers = publishers.filter(p => 
                                                p.sourceIds?.includes(source.id) || 
                                                (p.agentId && dataHub.automation?.agentTopics.some(t => 
                                                    t.agentId === p.agentId && 
                                                    t.dataTypes.includes('telegram') &&
                                                    t.publisherTargets.includes(p.id)
                                                ))
                                            );
                                            return (
                                                <div key={source.id} className="flex items-center justify-between p-2 bg-slate-950/50 rounded border border-slate-800/40">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-semibold text-foreground truncate">
                                                            📥 {source.name || source.id}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                                                            {source.url || source.id}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-3">
                                                        <span className="text-[10px] text-muted-foreground">→</span>
                                                        {linkedPublishers.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {linkedPublishers.map(pub => (
                                                                    <span 
                                                                        key={pub.id}
                                                                        className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/40"
                                                                    >
                                                                        📤 {pub.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground italic">
                                                                {t('no_output_mapping') || 'No output'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                        
                        {/* Publisher Channels List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {publishers.length > 0 ? (
                                publishers.map(pub => (
                                    <div key={pub.id} className="border border-border rounded-lg p-4 bg-secondary/5">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h5 className="font-bold text-foreground">{pub.name}</h5>
                                                <p className="text-[10px] text-muted-foreground font-mono">{pub.chatId}</p>
                                            </div>
                                            <StatusBadge status={pub.enabled ? 'success' : 'neutral'} label={pub.enabled ? 'Active' : 'Paused'} size="sm" />
                                        </div>
                                        <div className="space-y-1 mb-4">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-muted-foreground">Attached Agent:</span>
                                                <span className="text-purple-300">{pub.agentId ? agentMap[pub.agentId]?.name : 'None'}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-muted-foreground">Security:</span>
                                                <span className="text-foreground">{pub.isPrivate ? 'Private' : 'Public'}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <ActionButton variant="ghost" size="sm">Edit</ActionButton>
                                            <ActionButton variant="secondary" size="sm">Test</ActionButton>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="md:col-span-2">
                                    <EmptyState title="No channels configured" description="Register a Telegram bot and add chat IDs to start publishing signals." icon={<span className="text-4xl">🤖</span>} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-3">
                        {history.length > 0 ? (
                            history.slice(0, 10).map(item => (
                                <div key={item.id} className="border border-border rounded-lg p-3 flex justify-between items-center text-xs">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <StatusBadge status={item.status === 'sent' ? 'success' : 'error'} label={item.status} size="sm" />
                                            <span className="font-semibold truncate">{item.payloadPreview}</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            To: {publishers.find(p => p.id === item.publisherId)?.name || item.publisherId} • {new Date(item.sentAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <ActionButton variant="ghost" size="sm">Details</ActionButton>
                                </div>
                            ))
                        ) : (
                            <EmptyState title="History is empty" description="Successfully delivered messages will appear here." icon={<span className="text-3xl">🏜️</span>} />
                        )}
                    </div>
                )}

                {activeTab === 'templates' && (
                    <div className="space-y-4">
                        <div className="bg-secondary/20 p-4 rounded-lg border border-border">
                            <h5 className="text-sm font-bold mb-2">Default Signal Template</h5>
                            <code className="block bg-background p-3 rounded border border-border text-[10px] mb-3 whitespace-pre">
                                {`📢 **{{signal_type}} Alert**
Asset: {{asset}}
Price: {{price}} {{currency}}
Priority: {{priority}}
Confidence: {{confidence}}%

{{description}}`}
                            </code>
                            <ActionButton variant="secondary" size="sm">Edit Template</ActionButton>
                        </div>
                    </div>
                )}
            </div>
        </ApiWrapper>
    );
};

export default TelegramPublisher;
