import React, { useMemo } from 'react';
import { DataHubState, DataSource } from '../../../../../types';
import { DataHubApiError } from '../../../../../services/dataSourcesApi';
import type { DataSourcesPagination } from '../../../../../services/dataSourcesApi';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    BTN_PRIMARY,
    BTN_SECONDARY,
    BTN_OUTLINE_EMERALD,
    BTN_OUTLINE_SKY,
    BTN_OUTLINE_AMBER,
    BTN_OUTLINE_RED,
    BTN_OUTLINE_SLATE,
    BTN_OUTLINE_PURPLE,
    DataHubAlert,
    DataHubEmpty,
    MetricCard,
    StatusPill,
    sourceStatusVariant,
    priorityVariant,
    dataHubWriteGate,
} from './dataHubUi';
import { formatDataHubQueryError } from './dataHubI18n';
import { useDataHubPermissions } from './hooks/useDataHubPermissions';

type Props = {
    t: (key: string) => string;
    formatTimeAgo: (date: string | Date) => string;
    onRefresh: () => void;
    downloadCSV: (filename: string, rows: any[]) => void;
    setEditingSource: (source: DataSource | null) => void;
    setShowCreateSourceModal: (show: boolean) => void;
    setViewingSourceData: (source: DataSource | null) => void;
    handleTestSource: (sourceId: string) => void | Promise<void>;
    handleDeleteSource: (sourceId: string, hard?: boolean) => void | Promise<void>;
    handleRestoreSource: (sourceId: string) => void | Promise<void>;
    dataHub: DataHubState;
    setActiveView?: (view: 'sources' | 'categories' | 'pipeline' | 'health' | 'logs' | 'advanced' | 'telegram') => void;
    pagination?: DataSourcesPagination;
    page: number;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
    apiError?: DataHubApiError | Error | null;
};

const DataSourcesPanel: React.FC<Props> = ({
    t,
    formatTimeAgo,
    onRefresh,
    downloadCSV,
    setEditingSource,
    setShowCreateSourceModal,
    setViewingSourceData,
    handleTestSource,
    handleDeleteSource,
    handleRestoreSource,
    dataHub,
    setActiveView,
    pagination,
    page,
    onPageChange,
    isLoading,
    apiError,
}) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const sources = dataHub.sources || [];

    const metrics = useMemo(() => {
        const active = sources.filter(s => s.status === 'active').length;
        const errors = sources.filter(s => s.status === 'error').length;
        const telegram = sources.filter(s => s.type === 'telegram').length;
        return {
            total: pagination?.total ?? sources.length,
            active,
            errors,
            telegram,
        };
    }, [sources, pagination?.total]);

    const handleExport = () => {
        if (!sources.length) return;
        downloadCSV(sources, 'data-sources');
    };

    const queryError = formatDataHubQueryError(t, apiError);

    const paginationSummary =
        pagination &&
        t('sources_pagination_summary')
            .replace('{{page}}', String(pagination.page))
            .replace('{{shown}}', String(sources.length))
            .replace('{{total}}', String(pagination.total));

    return (
        <div className={DATAHUB_SHELL}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground">{t('data_sources')}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">{t('data_sources_desc')}</p>
                    {paginationSummary && (
                        <p className="text-[10px] text-muted-foreground mt-1">{paginationSummary}</p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={onRefresh} disabled={isLoading} className={BTN_SECONDARY}>
                        {isLoading ? t('refreshing') : t('refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={!sources.length}
                        className={BTN_SECONDARY}
                    >
                        {t('export_csv')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEditingSource(null);
                            setShowCreateSourceModal(true);
                        }}
                        className={BTN_PRIMARY}
                        disabled={wg().disabled}
                        title={wg().title}
                    >
                        {t('add_source')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <MetricCard label={t('sources_metric_total')} value={metrics.total} color="blue" />
                <MetricCard label={t('sources_metric_active')} value={metrics.active} color="emerald" />
                <MetricCard label={t('sources_metric_errors')} value={metrics.errors} color="red" />
                <MetricCard label={t('sources_metric_telegram')} value={metrics.telegram} color="purple" />
            </div>

            {queryError && (
                <DataHubAlert
                    variant={queryError.variant}
                    message={queryError.message}
                    onRetry={queryError.retryable ? onRefresh : undefined}
                    retryLabel={t('retry')}
                />
            )}

            <div className={DATAHUB_INNER_LIST}>
                {isLoading && sources.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">{t('sources_loading')}</div>
                ) : sources.length === 0 ? (
                    <DataHubEmpty message={t('no_data_sources')} />
                ) : (
                    <div className="space-y-3">
                        {sources.map(source => {
                            const isTelegram = source.type === 'telegram';
                            return (
                                <div
                                    key={source.id}
                                    className="rounded-xl border border-white/5 bg-slate-900/60 px-4 py-3 hover:border-purple-500/50 transition-colors"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-sm font-semibold text-foreground">{source.name}</h4>
                                                {isTelegram && (
                                                    <StatusPill label={t('telegram')} variant="info" />
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                {source.type} • {source.category}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 justify-end">
                                            <StatusPill
                                                label={t(source.status)}
                                                variant={sourceStatusVariant(source.status)}
                                            />
                                            <StatusPill
                                                label={t(source.priority)}
                                                variant={priorityVariant(source.priority)}
                                            />
                                        </div>
                                    </div>

                                    {isTelegram && source.config && (
                                        <div className="mt-3 pt-3 border-t border-slate-800/60">
                                            <p className="text-[10px] text-muted-foreground mb-2">
                                                {t('telegram_channel_settings')}
                                            </p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                                                {source.config.channelUsername && (
                                                    <div>
                                                        <p className="text-muted-foreground">{t('username')}</p>
                                                        <p className="font-mono text-sky-300">
                                                            @{source.config.channelUsername}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-[11px]">
                                        <div>
                                            <p className="text-muted-foreground">{t('success_rate')}</p>
                                            <p className="font-semibold text-foreground">
                                                {source.successRate.toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">{t('reliability')}</p>
                                            <p className="font-semibold text-foreground">
                                                {source.reliabilityScore.toFixed(0)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">{t('response_time')}</p>
                                            <p className="font-semibold text-foreground">
                                                {(source.responseTime || 0) + 'ms'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">{t('update_interval')}</p>
                                            <p className="font-semibold text-foreground">
                                                {t(source.updateInterval)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    source.status === 'active'
                                                        ? 'bg-emerald-400 animate-pulse'
                                                        : source.status === 'error'
                                                          ? 'bg-red-500'
                                                          : source.status === 'testing'
                                                            ? 'bg-amber-400 animate-pulse'
                                                            : 'bg-slate-500'
                                                }`}
                                            />
                                            <span className="text-muted-foreground">
                                                {source.status === 'active'
                                                    ? t('connected')
                                                    : source.status === 'error'
                                                      ? t('error')
                                                      : source.status === 'testing'
                                                        ? t('testing')
                                                        : t('inactive')}
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground">
                                            {source.lastSuccess ? (
                                                <span className="text-emerald-300">
                                                    {t('last_success')}: {formatTimeAgo(source.lastSuccess)}
                                                </span>
                                            ) : source.lastUpdate ? (
                                                <span>
                                                    {t('last_update')}: {formatTimeAgo(source.lastUpdate)}
                                                </span>
                                            ) : (
                                                <span>{t('never_updated')}</span>
                                            )}
                                        </div>
                                    </div>

                                    {source.lastError && (
                                        <div className="mt-2 text-[11px] text-red-300">
                                            {t('last_error')}: {source.lastError}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {isTelegram && setActiveView && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveView('telegram')}
                                                className={BTN_OUTLINE_SKY}
                                            >
                                                {t('open_in_telegram_collector')}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setViewingSourceData(source)}
                                            className={BTN_OUTLINE_PURPLE}
                                        >
                                            {t('view_data')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleTestSource(source.id)}
                                            className={BTN_OUTLINE_EMERALD}
                                            disabled={wg().disabled}
                                            title={wg().title}
                                        >
                                            {t('test_connection')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingSource(source);
                                                setShowCreateSourceModal(true);
                                            }}
                                            className={BTN_OUTLINE_SLATE}
                                            disabled={wg().disabled}
                                            title={wg().title}
                                        >
                                            {t('edit')}
                                        </button>
                                        {source.status === 'inactive' ? (
                                            <button
                                                type="button"
                                                onClick={() => handleRestoreSource(source.id)}
                                                className={BTN_OUTLINE_SKY}
                                                disabled={wg().disabled}
                                                title={wg().title}
                                            >
                                                {t('restore')}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSource(source.id, false)}
                                                className={BTN_OUTLINE_AMBER}
                                                disabled={wg().disabled}
                                                title={wg().title}
                                            >
                                                {t('soft_delete')}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSource(source.id, true)}
                                            className={BTN_OUTLINE_RED}
                                            disabled={wg().disabled}
                                            title={wg().title}
                                        >
                                            {t('hard_delete')}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 text-[11px] mt-4">
                    <button
                        type="button"
                        disabled={!pagination.hasPrevPage || isLoading}
                        onClick={() => onPageChange(page - 1)}
                        className={BTN_SECONDARY}
                    >
                        {t('previous')}
                    </button>
                    <span className="text-muted-foreground">
                        {t('page_of')} {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                        type="button"
                        disabled={!pagination.hasNextPage || isLoading}
                        onClick={() => onPageChange(page + 1)}
                        className={BTN_SECONDARY}
                    >
                        {t('next')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default DataSourcesPanel;
