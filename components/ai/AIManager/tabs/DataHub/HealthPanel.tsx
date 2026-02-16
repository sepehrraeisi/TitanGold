import React, { useMemo } from 'react';
import * as api from '../../../../../services/api';
import { DataHubState, TelegramCollectorState } from '../../../../../types';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import ApiWrapper from '../../../../common/ApiWrapper';

interface HealthPanelProps {
    t: (key: string) => string;
    health: DataHubState['health'];
    handleCheckHealth: () => void;
    isLoading: boolean;
    error: string | null;
    setError: (err: string | null) => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
    telegramCollector?: TelegramCollectorState | null;
    dataHub?: DataHubState | null;
}

const HealthPanel: React.FC<HealthPanelProps> = ({
    t,
    health,
    handleCheckHealth,
    isLoading,
    error,
    setError,
    Card,
    telegramCollector,
    dataHub
}) => {
    // Calculate Telegram-specific metrics (TASK-DHT-040, TASK-DHT-041)
    const telegramHealth = useMemo(() => {
        if (!telegramCollector && !dataHub?.telegramCollector) return null;
        const collector = telegramCollector || dataHub?.telegramCollector;
        if (!collector) return null;

        const channels = collector.channels || [];
        const activeChannels = channels.filter((ch: any) => ch.isActive !== false).length;
        const errorChannels = channels.filter((ch: any) => ch.lastError).length;

        // Determine overall status
        let status: 'healthy' | 'degraded' | 'down' = 'healthy';
        if (collector.status === 'offline' || collector.status === 'error') {
            status = 'down';
        } else if (errorChannels > 0 || collector.status === 'degraded') {
            status = 'degraded';
        }

        // Check for flood risk (TASK-DHT-041)
        const hasFloodRisk = channels.some((ch: any) =>
            ch.lastError && (ch.lastError.includes('FLOOD') || ch.lastError.includes('Flood'))
        );

        return {
            status,
            activeChannels,
            totalChannels: channels.length,
            errorChannels,
            hasFloodRisk,
            // از healthSummary که در api.buildCollectorHealthSummary محاسبه می‌شود استفاده می‌کنیم
            avgLatency: collector.healthSummary?.avgLatencyMs ?? null,
        };
    }, [telegramCollector, dataHub?.telegramCollector]);

    // Count Telegram accounts from dataHub sources (if available)
    const telegramAccountsCount = useMemo(() => {
        if (!dataHub?.sources) return null;
        const telegramSources = dataHub.sources.filter(s => s.type === 'telegram');
        return telegramSources.length;
    }, [dataHub?.sources]);

    return (
        <ApiWrapper
            error={error}
            setError={setError}
            isLoading={isLoading && !health}
        >
            <div className="space-y-4">
                {/* Main Health Card */}
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('health_monitoring') || 'Health Monitoring'}</h3>
                        <button
                            onClick={handleCheckHealth}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isLoading ? t('checking') || 'Checking...' : t('check_health') || 'Check Health'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('active_connections') || 'Active Connections'}</p>
                            {isLoading ? <SkeletonLoader width="40px" height="1.75rem" /> : <p className="text-lg font-bold text-green-400">{health.activeConnections}</p>}
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('failed_connections') || 'Failed Connections'}</p>
                            {isLoading ? <SkeletonLoader width="40px" height="1.75rem" /> : <p className="text-lg font-bold text-red-400">{health.failedConnections}</p>}
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('avg_response_time') || 'Avg Response Time'}</p>
                            {isLoading ? <SkeletonLoader width="60px" height="1.75rem" /> : <p className="text-lg font-bold text-foreground">{health.averageResponseTime.toFixed(0)}ms</p>}
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('cache_hit_rate') || 'Cache Hit Rate'}</p>
                            {isLoading ? <SkeletonLoader width="60px" height="1.75rem" /> : <p className="text-lg font-bold text-purple-400">{health.cacheHitRate.toFixed(1)}%</p>}
                        </div>
                    </div>
                </Card>

                {/* Telegram Collector Health Card (TASK-DHT-040, TASK-DHT-041, TASK-DHT-045) */}
                {telegramHealth && (
                    <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-foreground">
                                    {t('telegram_collector_health') || 'Telegram Collector Health'}
                                </h4>
                                <span className={`w-2 h-2 rounded-full ${telegramHealth.status === 'healthy'
                                        ? 'bg-emerald-400 animate-pulse'
                                        : telegramHealth.status === 'degraded'
                                            ? 'bg-amber-400 animate-pulse'
                                            : 'bg-red-500'
                                    }`} />
                            </div>
                            {telegramHealth.hasFloodRisk && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40">
                                    {t('telegram_flood_risk') || 'Flood Risk'}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3 backdrop-blur-sm">
                                <p className="text-[11px] text-emerald-300/80 mb-1">
                                    {t('collector_status') || 'Status'}
                                </p>
                                <p className={`text-sm font-semibold capitalize ${telegramHealth.status === 'healthy'
                                        ? 'text-emerald-100'
                                        : telegramHealth.status === 'degraded'
                                            ? 'text-amber-100'
                                            : 'text-red-100'
                                    }`}>
                                    {telegramHealth.status}
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-3 backdrop-blur-sm">
                                <p className="text-[11px] text-blue-300/80 mb-1">
                                    {t('active_channels') || 'Active Channels'}
                                </p>
                                <p className="text-sm font-semibold text-blue-100">
                                    {telegramHealth.activeChannels} / {telegramHealth.totalChannels}
                                </p>
                            </div>
                            {telegramHealth.avgLatency !== null && (
                                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3 backdrop-blur-sm">
                                    <p className="text-[11px] text-purple-300/80 mb-1">
                                        {t('avg_latency') || 'Avg Latency'}
                                    </p>
                                    <p className="text-sm font-semibold text-purple-100">
                                        {Math.round(telegramHealth.avgLatency)}ms
                                    </p>
                                </div>
                            )}
                            {telegramAccountsCount !== null && (
                                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent p-3 backdrop-blur-sm">
                                    <p className="text-[11px] text-sky-300/80 mb-1">
                                        {t('telegram_sources') || 'Telegram Sources'}
                                    </p>
                                    <p className="text-sm font-semibold text-sky-100">
                                        {telegramAccountsCount}
                                    </p>
                                </div>
                            )}
                        </div>

                        {telegramHealth.errorChannels > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-800/60">
                                <p className="text-[11px] text-red-300">
                                    {t('channels_with_errors') || 'Channels with errors'}: {telegramHealth.errorChannels}
                                </p>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </ApiWrapper>
    );
};

export default HealthPanel;
