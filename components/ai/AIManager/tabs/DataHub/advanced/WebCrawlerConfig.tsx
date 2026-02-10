
import React, { useState, useMemo } from 'react';
import * as api from '../../../../../../services/api';
import { DataHubState, DataPipelineSourceSnapshot } from '../../../../../../types';
import WebCrawlerModal from '../modals/WebCrawlerModal';
import { SummaryCard } from '../../../../../ui/summary-card';
import { EmptyState } from '../../../../../ui/empty-state';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import ApiWrapper from '../../../../../common/ApiWrapper';
import { useAsync } from '../../../../../../hooks/useAsync';

interface WebCrawlerConfigProps {
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    sourceQualityMap: Record<string, DataPipelineSourceSnapshot>;
    getStatusBadgeClass: (status?: string) => string;
}

const WebCrawlerConfig: React.FC<WebCrawlerConfigProps> = ({
    dataHub,
    setDataHub,
    onRefresh,
    t,
    formatTimeAgo,
    sourceQualityMap,
    getStatusBadgeClass
}) => {
    const [showCrawlerModal, setShowCrawlerModal] = useState(false);
    const [editingCrawler, setEditingCrawler] = useState<any>(null);

    const saveAsync = useAsync(async (crawlerData: any) => {
        if (editingCrawler) {
            return api.updateWebCrawler(editingCrawler.id, crawlerData);
        } else {
            return api.createWebCrawler(crawlerData);
        }
    });

    const deleteAsync = useAsync(api.deleteWebCrawler);

    const advanced = dataHub.advanced || { webCrawlers: [] };
    const crawlers = advanced.webCrawlers;

    const metrics = useMemo(() => ({
        total: crawlers.length,
        active: crawlers.filter(c => c.enabled).length,
        avgInterval: crawlers.length > 0
            ? Math.round(crawlers.reduce((acc, c) => acc + (parseInt(c.interval) || 0), 0) / crawlers.length)
            : 0,
        unhealthy: crawlers.filter(c => {
            const signal = c.sourceId ? sourceQualityMap[c.sourceId] : undefined;
            return signal && signal.lastStatus === 'failed';
        }).length
    }), [crawlers, sourceQualityMap]);

    const handleAddCrawler = () => {
        setEditingCrawler(null);
        setShowCrawlerModal(true);
    };

    const handleSaveCrawler = async (crawlerData: any) => {
        try {
            await saveAsync.execute(crawlerData);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
            setShowCrawlerModal(false);
            setEditingCrawler(null);
        } catch (e: any) {
            console.error('Failed to save crawler:', e);
        }
    };

    const handleDeleteCrawler = async (crawlerId: string) => {
        const confirmed = window.confirm(t('confirm_delete') || 'Are you sure?');
        if (confirmed) {
            try {
                await deleteAsync.execute(crawlerId);
                const updated = await api.fetchDataHubState();
                setDataHub(updated);
                onRefresh();
            } catch (e: any) {
                console.error('Failed to delete crawler:', e);
            }
        }
    };

    return (
        <ApiWrapper
            error={saveAsync.error || deleteAsync.error}
            setError={() => { saveAsync.setError(null); deleteAsync.setError(null); }}
            isLoading={saveAsync.isLoading || deleteAsync.isLoading}
        >
            <div className="bg-card border border-border rounded-lg p-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            🕷️ {t('web_crawlers') || 'Web Crawlers'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('web_crawlers_desc') || 'Configure high-frequency data collection from web endpoints and HTML sources.'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <ActionButton variant="secondary" size="sm">Bulk Play/Pause</ActionButton>
                        <ActionButton variant="primary" size="sm" onClick={handleAddCrawler}>+ Add Crawler</ActionButton>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <SummaryCard
                        label={t('total_crawlers') || 'Total'}
                        value={metrics.total}
                        icon={<span className="text-2xl">🕷️</span>}
                    />
                    <SummaryCard
                        label={t('active_crawlers') || 'Active'}
                        value={metrics.active}
                        variant="success"
                        icon={<span className="text-2xl">⚡</span>}
                    />
                    <SummaryCard
                        label={t('avg_interval') || 'Avg Interval'}
                        value={`${metrics.avgInterval}m`}
                        icon={<span className="text-2xl">⏱️</span>}
                    />
                    <SummaryCard
                        label={t('unhealthy_crawlers') || 'Unhealthy'}
                        value={metrics.unhealthy}
                        variant={metrics.unhealthy > 0 ? 'error' : 'default'}
                        icon={<span className="text-2xl">⚠️</span>}
                    />
                </div>

                {/* Content Area */}
                {crawlers.length > 0 ? (
                    <div className="space-y-4">
                        {crawlers.map(crawler => {
                            const sourceSignal = crawler.sourceId ? sourceQualityMap[crawler.sourceId] : undefined;
                            const isUnhealthy = sourceSignal?.lastStatus === 'failed';

                            return (
                                <div key={crawler.id} className={`border rounded-lg p-4 transition-all ${isUnhealthy ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-secondary/5'}`}>
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-foreground truncate">{crawler.name}</h4>
                                                <StatusBadge
                                                    status={crawler.enabled ? 'success' : 'neutral'}
                                                    label={crawler.enabled ? 'Running' : 'Paused'}
                                                    size="sm"
                                                />
                                                {isUnhealthy && <StatusBadge status="error" label="Failed" size="sm" pulse />}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-mono break-all opacity-70 mb-2">{crawler.url}</p>

                                            <div className="flex flex-wrap gap-4 text-[11px]">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-muted-foreground">Interval:</span>
                                                    <span className="font-semibold">{crawler.interval} minutes</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-muted-foreground">Last Run:</span>
                                                    <span className="font-semibold">{sourceSignal?.lastChecked ? formatTimeAgo(sourceSignal.lastChecked) : 'Never'}</span>
                                                </div>
                                                {sourceSignal?.lastResponseTime && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-muted-foreground">Latency:</span>
                                                        <span className="text-purple-300">{sourceSignal.lastResponseTime}ms</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 shrink-0">
                                            <ActionButton variant="ghost" size="sm" onClick={() => { setEditingCrawler(crawler); setShowCrawlerModal(true); }}>Edit</ActionButton>
                                            <ActionButton variant="danger" size="sm" loading={deleteAsync.isLoading} onClick={() => handleDeleteCrawler(crawler.id)}>Delete</ActionButton>
                                        </div>
                                    </div>

                                    {/* Mini Timeline Placeholder */}
                                    <div className="mt-3 pt-3 border-t border-border/30 flex gap-1">
                                        {[1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1].map((s, i) => (
                                            <div key={i} className={`h-4 flex-1 rounded-sm ${s ? 'bg-green-500/30' : 'bg-red-500/50 animate-pulse'}`} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState
                        title="No crawlers configured"
                        description="Automate data collection from websites by creating your first crawler rule."
                        icon={<span className="text-4xl">🕸️</span>}
                        action={<ActionButton variant="primary" onClick={handleAddCrawler}>+ Add Crawler</ActionButton>}
                    />
                )}

                {showCrawlerModal && (
                    <WebCrawlerModal
                        crawler={editingCrawler}
                        sources={dataHub.sources}
                        onClose={() => {
                            setShowCrawlerModal(false);
                            setEditingCrawler(null);
                        }}
                        onSave={handleSaveCrawler}
                        t={t}
                    />
                )}
            </div>
        </ApiWrapper>
    );
};

export default WebCrawlerConfig;
