import React, { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import * as api from '../services/api.ts';
import type { GoldPageData, GoldPublishItem, GoldTimeRange, GoldNewsArticle } from '../types.ts';
import LiveGoldPriceWidget from './gold/LiveGoldPriceWidget.tsx';
import AIPredictionWidget from './gold/AIPredictionWidget.tsx';
import GoldNewsFeed from './gold/GoldNewsFeed.tsx';
import MarketDriversWidget from './gold/MarketDriversWidget.tsx';
import TelegramPublisher from './gold/TelegramPublisher.tsx';
import Button from './ui/button.tsx';

const GoldPage: React.FC = () => {
    const { t, language } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<GoldPageData | null>(null);
    const [publishQueue, setPublishQueue] = useState<GoldPublishItem[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [watchlistId, setWatchlistId] = useState<string | null>(null);
    const [pinningId, setPinningId] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [statusMessageKey, setStatusMessageKey] = useState<string | null>(null);
    const [statusChannelHandle, setStatusChannelHandle] = useState<string | null>(null);
    const [isCreatingAlert, setIsCreatingAlert] = useState(false);
    const [alertUpdatingId, setAlertUpdatingId] = useState<string | null>(null);
    const [alertAcknowledgingId, setAlertAcknowledgingId] = useState<string | null>(null);
    const [alertDeletingId, setAlertDeletingId] = useState<string | null>(null);
    const [newAlertAssetId, setNewAlertAssetId] = useState('');
    const [newAlertDirection, setNewAlertDirection] = useState<'up' | 'down'>('up');
    const [newAlertThreshold, setNewAlertThreshold] = useState('0.5');
    const [alertThresholdEdits, setAlertThresholdEdits] = useState<Record<string, string>>({});

    const locale = language === 'fa' ? 'fa-IR' : 'en-US';

    useEffect(() => {
        const fetchData = async () => {
            const payload = await api.fetchGoldPageData();
            setData(payload);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (data?.assets?.length && !newAlertAssetId) {
            setNewAlertAssetId(data.assets[0].id);
        }
    }, [data, newAlertAssetId]);

    useEffect(() => {
        if (!data) {
            return;
        }
        const next: Record<string, string> = {};
        data.alerts.forEach(alert => {
            next[alert.id] = alert.threshold.toString();
        });
        setAlertThresholdEdits(next);
    }, [data]);

    const assetLookup = useMemo(() => {
        if (!data) {
            return new Map<string, string>();
        }
        return new Map<string, string>(data.assets.map(asset => [asset.id, asset.name]));
    }, [data]);

    const handleAddToQueue = (item: GoldPublishItem) => {
        setPublishQueue(prev => [item, ...prev]);
        setStatusMessageKey(null);
    };

    const handleClearQueue = () => {
        setPublishQueue([]);
    };

    const handleRefreshSnapshot = async () => {
        setIsRefreshing(true);
        try {
            const updated = await api.refreshGoldMarketSnapshot();
            setData(updated);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleRangeChange = async (range: GoldTimeRange) => {
        if (!data || data.activeRange === range) {
            return;
        }
        const updated = await api.setGoldActiveRange(range);
        setData(updated);
    };

    const handleRegeneratePrediction = async () => {
        setIsRegenerating(true);
        try {
            const updated = await api.regenerateGoldPrediction();
            setData(updated);
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleVerifyArticle = async (articleId: string, status: GoldNewsArticle['verificationStatus']) => {
        setVerifyingId(articleId);
        try {
            const updated = await api.updateGoldNewsVerification(articleId, status);
            setData(updated);
        } finally {
            setVerifyingId(null);
        }
    };

    const handleToggleWatchlist = async (articleId: string) => {
        setWatchlistId(articleId);
        try {
            const updated = await api.toggleGoldNewsWatchlist(articleId);
            setData(updated);
        } finally {
            setWatchlistId(null);
        }
    };

    const handleTogglePin = async (articleId: string) => {
        setPinningId(articleId);
        try {
            const updated = await api.pinGoldNewsArticle(articleId);
            setData(updated);
        } finally {
            setPinningId(null);
        }
    };

    const handlePublishQueue = async (channelId: string, templateId?: string) => {
        if (publishQueue.length === 0) {
            return;
        }
        setIsPublishing(true);
        try {
            const result = await api.publishGoldToTelegram({ channelId, templateId, items: publishQueue });
            setData(result.data);
            setPublishQueue([]);
            setStatusMessageKey(result.message);
            setStatusChannelHandle(result.channel.handle);
        } catch (error) {
            console.error(error);
            setStatusMessageKey('gold_publish_error');
            setStatusChannelHandle(null);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleAlertFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!data || !newAlertAssetId) {
            return;
        }
        const thresholdValue = Number.parseFloat(newAlertThreshold);
        if (!Number.isFinite(thresholdValue)) {
            return;
        }
        setIsCreatingAlert(true);
        try {
            const updated = await api.createGoldAlert({
                assetId: newAlertAssetId,
                direction: newAlertDirection,
                threshold: thresholdValue,
            });
            setData(updated);
            setNewAlertThreshold('0.5');
        } finally {
            setIsCreatingAlert(false);
        }
    };

    const handleResetAlertForm = () => {
        if (data?.assets?.length) {
            setNewAlertAssetId(data.assets[0].id);
        }
        setNewAlertDirection('up');
        setNewAlertThreshold('0.5');
    };

    const handleAlertAssetChange = (event: ChangeEvent<HTMLSelectElement>) => {
        setNewAlertAssetId(event.target.value);
    };

    const handleAlertDirectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value === 'down' ? 'down' : 'up';
        setNewAlertDirection(value);
    };

    const handleAlertThresholdChange = (event: ChangeEvent<HTMLInputElement>) => {
        setNewAlertThreshold(event.target.value);
    };

    const handleAlertThresholdEdit = (alertId: string, event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setAlertThresholdEdits(prev => ({ ...prev, [alertId]: value }));
    };

    const commitAlertThreshold = async (alertId: string) => {
        if (!data) {
            return;
        }
        const alert = data.alerts.find(item => item.id === alertId);
        if (!alert) {
            return;
        }
        const rawValue = alertThresholdEdits[alertId];
        const nextValue = Number.parseFloat(rawValue);
        if (!Number.isFinite(nextValue)) {
            setAlertThresholdEdits(prev => ({ ...prev, [alertId]: alert.threshold.toString() }));
            return;
        }
        const normalizedNext = Number(nextValue.toFixed(2));
        if (Number(alert.threshold.toFixed(2)) === normalizedNext) {
            return;
        }
        setAlertUpdatingId(alertId);
        try {
            const updated = await api.updateGoldAlertThreshold(alertId, normalizedNext);
            setData(updated);
        } finally {
            setAlertUpdatingId(null);
        }
    };

    const handleThresholdBlur = (alertId: string) => {
        void commitAlertThreshold(alertId);
    };

    const handleThresholdKeyDown = (alertId: string, event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void commitAlertThreshold(alertId);
        }
    };

    const handleToggleAlert = async (alertId: string) => {
        setAlertUpdatingId(alertId);
        try {
            const updated = await api.toggleGoldAlertActive(alertId);
            setData(updated);
        } finally {
            setAlertUpdatingId(null);
        }
    };

    const handleAcknowledgeAlert = async (alertId: string) => {
        setAlertAcknowledgingId(alertId);
        try {
            const updated = await api.acknowledgeGoldAlert(alertId);
            setData(updated);
        } finally {
            setAlertAcknowledgingId(null);
        }
    };

    const handleDeleteAlert = async (alertId: string) => {
        setAlertDeletingId(alertId);
        try {
            const updated = await api.deleteGoldAlert(alertId);
            setData(updated);
        } finally {
            setAlertDeletingId(null);
        }
    };

    if (isLoading) {
        return <div className="text-center p-10 text-muted-foreground">{t('loading')}</div>;
    }

    if (!data) {
        return <div className="text-center p-10 text-negative">{t('error_occurred')}</div>;
    }

    const formattedUpdated = data.lastUpdated
        ? new Date(data.lastUpdated).toLocaleString(locale, { hour12: false })
        : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{t('gold_page_title')}</h1>
                    <p className="text-muted-foreground mt-1">{t('gold_page_desc')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {formattedUpdated && <span>{t('last_updated', { time: formattedUpdated })}</span>}
                    <Button variant="outline" onClick={handleRefreshSnapshot} disabled={isRefreshing} className="h-8 px-3">
                        {isRefreshing ? t('loading') : t('refresh_market')}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {data.stats.map(stat => {
                    const directionClass = stat.direction === 'up'
                        ? 'text-positive'
                        : stat.direction === 'down'
                            ? 'text-negative'
                            : 'text-muted-foreground';
                    const deltaLabel = stat.delta % 1 === 0 ? stat.delta.toFixed(0) : stat.delta.toFixed(2);
                    return (
                        <div key={stat.id} className="rounded-lg border border-border bg-secondary/50 p-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t(stat.labelKey)}</p>
                            <div className="mt-2 flex items-baseline justify-between gap-2">
                                <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                                <span className={`text-sm font-semibold ${directionClass}`}>
                                    {stat.direction === 'down' ? '-' : stat.direction === 'up' ? '+' : ''}{deltaLabel}%
                                </span>
                            </div>
                            {stat.hintKey && (
                                <p className="mt-2 text-[11px] text-muted-foreground">{t(stat.hintKey)}</p>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <LiveGoldPriceWidget
                        assets={data.assets}
                        priceRanges={data.priceRanges}
                        activeRange={data.activeRange}
                        onRangeChange={handleRangeChange}
                        onRefresh={handleRefreshSnapshot}
                        isRefreshing={isRefreshing}
                        lastUpdated={data.lastUpdated}
                    />
                    <AIPredictionWidget
                        prediction={data.prediction}
                        onPublish={handleAddToQueue}
                        onRegenerate={handleRegeneratePrediction}
                        isRegenerating={isRegenerating}
                    />
                    <GoldNewsFeed
                        news={data.news}
                        onPublish={handleAddToQueue}
                        onVerify={handleVerifyArticle}
                        onToggleWatchlist={handleToggleWatchlist}
                        onTogglePin={handleTogglePin}
                        verifyingId={verifyingId}
                        watchlistUpdatingId={watchlistId}
                        pinningId={pinningId}
                    />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <MarketDriversWidget
                        drivers={data.marketDrivers}
                        onRefresh={handleRefreshSnapshot}
                        isRefreshing={isRefreshing}
                    />
                    <TelegramPublisher
                        queue={publishQueue}
                        channels={data.telegram.channels}
                        templates={data.telegram.templates}
                        defaultChannelId={data.telegram.defaultChannelId}
                        lastPublishedAt={data.telegram.lastPublishedAt}
                        isPublishing={isPublishing}
                        statusMessageKey={statusMessageKey}
                        statusChannelHandle={statusChannelHandle}
                        onPublish={handlePublishQueue}
                        onClear={handleClearQueue}
                    />
                    <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">{t('gold_alerts')}</h3>
                            <span className="text-xs text-muted-foreground">{t('gold_alert_count', { count: data.alerts.length })}</span>
                        </div>
                        <form className="space-y-3 text-xs" onSubmit={handleAlertFormSubmit}>
                            <div className="flex items-center justify-between text-muted-foreground">
                                <p>{t('gold_alert_form_title')}</p>
                                {isCreatingAlert && <span className="text-[11px]">{t('processing')}</span>}
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('gold_alert_asset_label')}</span>
                                    <select
                                        value={newAlertAssetId}
                                        onChange={handleAlertAssetChange}
                                        className="h-8 rounded-md border border-border bg-background/60 px-2 text-foreground"
                                    >
                                        {data.assets.map(asset => (
                                            <option key={asset.id} value={asset.id}>
                                                {asset.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('gold_alert_direction_label')}</span>
                                    <select
                                        value={newAlertDirection}
                                        onChange={handleAlertDirectionChange}
                                        className="h-8 rounded-md border border-border bg-background/60 px-2 text-foreground"
                                    >
                                        <option value="up">{t('direction_up')}</option>
                                        <option value="down">{t('direction_down')}</option>
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('gold_alert_threshold_label')}</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={newAlertThreshold}
                                        onChange={handleAlertThresholdChange}
                                        className="h-8 rounded-md border border-border bg-background/60 px-2 text-foreground"
                                    />
                                </label>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{t('gold_alert_threshold_hint')}</p>
                            <div className="flex items-center justify-end gap-2">
                                <Button type="button" variant="ghost" className="h-8 px-3" onClick={handleResetAlertForm} disabled={isCreatingAlert}>
                                    {t('gold_alert_reset')}
                                </Button>
                                <Button type="submit" className="h-8 px-3" disabled={isCreatingAlert || !newAlertAssetId}>
                                    {t('gold_alert_submit')}
                                </Button>
                            </div>
                        </form>
                        {data.alerts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('gold_no_alerts')}</p>
                        ) : (
                            <div className="space-y-3">
                                {data.alerts.map(alert => {
                                    const created = new Date(alert.createdAt).toLocaleDateString(locale);
                                    const lastTriggered = alert.lastTriggeredAt
                                        ? new Date(alert.lastTriggeredAt).toLocaleString(locale, { hour12: false })
                                        : t('gold_alert_never_triggered');
                                    const assetName = assetLookup.get(alert.assetId) ?? alert.assetId;
                                    const label = alert.labelKey === 'gold_alert_custom'
                                        ? t('gold_alert_custom', {
                                              asset: assetName,
                                              direction: t(`direction_${alert.direction}`),
                                              threshold: Math.abs(alert.threshold),
                                          })
                                        : t(alert.labelKey);
                                    const pendingUpdate = alertUpdatingId === alert.id;
                                    const pendingAcknowledge = alertAcknowledgingId === alert.id;
                                    const pendingDelete = alertDeletingId === alert.id;
                                    const thresholdValue = alertThresholdEdits[alert.id] ?? alert.threshold.toString();
                                    return (
                                        <div key={alert.id} className="rounded-md border border-border/60 bg-background/40 p-3 text-xs space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-semibold text-foreground">{label}</p>
                                                <span className={alert.active ? 'text-positive font-semibold' : 'text-muted-foreground'}>
                                                    {pendingUpdate ? t('processing') : alert.active ? t('active') : t('inactive')}
                                                </span>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                                                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                                    <span>{t('gold_alert_threshold_display', { value: `${alert.threshold > 0 ? '+' : ''}${alert.threshold}%` })}</span>
                                                    <label className="flex items-center gap-2">
                                                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('gold_alert_threshold_edit_label')}</span>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={thresholdValue}
                                                            onChange={event => handleAlertThresholdEdit(alert.id, event)}
                                                            onBlur={() => handleThresholdBlur(alert.id)}
                                                            onKeyDown={event => handleThresholdKeyDown(alert.id, event)}
                                                            disabled={pendingUpdate}
                                                            className="h-7 w-24 rounded-md border border-border bg-background/60 px-2 text-foreground"
                                                        />
                                                    </label>
                                                </div>
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-7 px-3"
                                                        disabled={pendingUpdate || pendingDelete}
                                                        onClick={() => handleToggleAlert(alert.id)}
                                                    >
                                                        {alert.active ? t('gold_alert_deactivate') : t('gold_alert_activate')}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="h-7 px-3"
                                                        disabled={pendingAcknowledge || pendingDelete}
                                                        onClick={() => handleAcknowledgeAlert(alert.id)}
                                                    >
                                                        {pendingAcknowledge ? t('processing') : t('gold_alert_acknowledge')}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-7 px-3 border border-negative/60 text-negative hover:bg-negative/10"
                                                        disabled={pendingDelete}
                                                        onClick={() => handleDeleteAlert(alert.id)}
                                                    >
                                                        {pendingDelete ? t('processing') : t('gold_alert_remove')}
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="text-muted-foreground">{t('gold_alert_created', { date: created })}</p>
                                            <p className="text-muted-foreground">{t('gold_alert_last_triggered', { time: lastTriggered })}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoldPage;