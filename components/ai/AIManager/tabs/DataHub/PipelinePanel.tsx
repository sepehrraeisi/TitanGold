import React, { useMemo, useState } from 'react';
import { DataPipelineSnapshot, DataPipelineSourceSnapshot, DataNormalizationSummary, NormalizedDataRecord, PipelineSourceQualityStatus } from '../../../../../types';
import { DataHubApiError } from '../../../../../services/dataSourcesApi';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    INPUT_CLASS,
    SELECT_CLASS,
    BTN_PRIMARY,
    BTN_SECONDARY,
    DataHubAlert,
    DataHubEmpty,
    MetricCard,
    StatusPill,
} from './dataHubUi';
import TelegramTransferHealth from './TelegramTransferHealth';
import { formatDataHubQueryError } from './dataHubI18n';
import { dataHubSourceStatusLabel } from '../../../../../services/dataSourcesApi';
import type { DataSource } from '../../../../../types';

interface PipelinePanelProps {
    t: (key: string) => string;
    pipelineSnapshot: DataPipelineSnapshot | undefined;
    pipelineHistory: { id: string; generatedAt: string; snapshot: DataPipelineSnapshot }[];
    normalizationSummary: DataNormalizationSummary | undefined;
    normalizedData: NormalizedDataRecord[];
    handleRefreshPipelineSnapshot: () => void;
    isLoadingPipeline: boolean;
    isLoadingPipelineBacklog?: boolean;
    pipelineBacklogError?: string | null;
    onRetryPipelineBacklog?: () => void;
    pipelineApiError?: DataHubApiError | Error | null;
    setPipelineError: (err: string | null) => void;
    formatTimeAgo: (date: string | Date | undefined) => string;
    selectedSnapshotId: string;
    setSelectedSnapshotId: (id: string) => void;
}

function statusVariant(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
    if (status === 'success' || status === 'collector_active') return 'success';
    if (status === 'fetch_error' || status === 'collector_error' || status === 'failed') return 'error';
    if (status === 'fetch_timeout' || status === 'no_data' || status === 'timeout') return 'warning';
    if (
        status === 'pending_normalization' ||
        status === 'collector_pending' ||
        status === 'collector_linked' ||
        status === 'cached'
    ) {
        return 'info';
    }
    if (status === 'inactive') return 'neutral';
    return 'neutral';
}

const PIPELINE_STATUS_I18N: Partial<Record<PipelineSourceQualityStatus, string>> = {
    success: 'pipeline_source_status_success',
    pending_normalization: 'pipeline_source_status_pending_normalization',
    no_data: 'pipeline_source_status_no_data',
    fetch_error: 'pipeline_source_status_fetch_error',
    fetch_timeout: 'pipeline_source_status_fetch_timeout',
    inactive: 'pipeline_source_status_inactive',
    collector_active: 'pipeline_source_status_collector_active',
    collector_pending: 'pipeline_source_status_collector_pending',
    collector_linked: 'pipeline_source_status_collector_linked',
    collector_error: 'pipeline_source_status_collector_error',
    failed: 'pipeline_source_status_fetch_error',
    cached: 'pipeline_source_status_collector_pending',
    timeout: 'pipeline_source_status_fetch_timeout',
};

function pipelineStatusLabel(
    t: (key: string) => string,
    src: Pick<DataPipelineSourceSnapshot, 'lastStatus' | 'operationalStatus'>,
): string {
    const key = PIPELINE_STATUS_I18N[src.lastStatus];
    if (key) {
        const translated = t(key);
        if (translated !== key) return translated;
    }
    if (src.operationalStatus) {
        return dataHubSourceStatusLabel(t, src.operationalStatus as DataSource['status']);
    }
    return src.lastStatus;
}

function matchesSourceStatusFilter(
    filter: SourceStatusFilter,
    lastStatus: PipelineSourceQualityStatus,
): boolean {
    if (filter === 'all') return true;
    if (filter === 'success') {
        return lastStatus === 'success' || lastStatus === 'collector_active';
    }
    if (filter === 'pending') {
        return (
            lastStatus === 'pending_normalization' ||
            lastStatus === 'collector_pending' ||
            lastStatus === 'collector_linked'
        );
    }
    if (filter === 'issues') {
        return (
            lastStatus === 'no_data' ||
            lastStatus === 'fetch_error' ||
            lastStatus === 'fetch_timeout' ||
            lastStatus === 'collector_error' ||
            lastStatus === 'inactive' ||
            lastStatus === 'failed' ||
            lastStatus === 'timeout'
        );
    }
    return lastStatus === filter;
}

type SourceStatusFilter = 'all' | 'success' | 'pending' | 'issues' | PipelineSourceQualityStatus;
type SourceSortBy = 'name' | 'backlog' | 'eta' | 'rank';

function interpolateTemplate(template: string, vars: Record<string, string | number>): string {
    return Object.entries(vars).reduce(
        (text, [key, value]) => text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value)),
        template,
    );
}

function formatCollectorEta(
    t: (key: string) => string,
    backlog: DataPipelineSourceSnapshot['collectorBacklog'],
): string | null {
    if (!backlog?.estimatedWaitHours) return null;
    if (backlog.estimatedWaitHours < 1) {
        return t('pipeline_backlog_eta_under_hour');
    }
    if ((backlog.estimatedWaitDays ?? 0) >= 1) {
        return interpolateTemplate(t('pipeline_backlog_eta_days'), {
            days: Number((backlog.estimatedWaitDays ?? 0).toFixed(1)),
        });
    }
    return interpolateTemplate(t('pipeline_backlog_eta_hours'), {
        hours: Math.max(1, Math.round(backlog.estimatedWaitHours)),
    });
}

function renderCollectorBacklogDetails(
    t: (key: string) => string,
    src: DataPipelineSourceSnapshot,
    formatTimeAgo: (date: string | Date | undefined) => string,
): React.ReactNode {
    const backlog = src.collectorBacklog;
    if (!backlog || backlog.backlogCount <= 0) return null;

    const eta = formatCollectorEta(t, backlog);
    return (
        <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
            <div>
                {interpolateTemplate(t('pipeline_backlog_queue'), {
                    count: backlog.backlogCount.toLocaleString(),
                })}
            </div>
            {backlog.oldestQueuedAt && (
                <div>
                    {interpolateTemplate(t('pipeline_backlog_oldest'), {
                        time: formatTimeAgo(backlog.oldestQueuedAt),
                    })}
                </div>
            )}
            {eta && <div>{interpolateTemplate(t('pipeline_backlog_eta'), { eta })}</div>}
            {backlog.queuePositionRank != null && (
                <div>
                    {interpolateTemplate(t('pipeline_backlog_rank'), {
                        rank: backlog.queuePositionRank,
                    })}
                </div>
            )}
        </div>
    );
}

function normStatusVariant(
    status: NormalizedDataRecord['status'],
): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    if (status === 'ready') return 'success';
    if (status === 'warning') return 'warning';
    if (status === 'rejected') return 'error';
    if (status === 'pending_normalization' || status === 'ingested') return 'info';
    return 'neutral';
}

function normalizedStatusLabel(t: (key: string) => string, status: NormalizedDataRecord['status']): string {
    const key = `normalized_status_${status}`;
    const translated = t(key);
    return translated !== key ? translated : status;
}

const PipelinePanel: React.FC<PipelinePanelProps> = ({
    t,
    pipelineSnapshot,
    pipelineHistory,
    normalizationSummary,
    normalizedData,
    handleRefreshPipelineSnapshot,
    isLoadingPipeline,
    isLoadingPipelineBacklog = false,
    pipelineBacklogError = null,
    onRetryPipelineBacklog,
    pipelineApiError = null,
    setPipelineError,
    formatTimeAgo,
    selectedSnapshotId,
    setSelectedSnapshotId,
}) => {
    const queryError = formatDataHubQueryError(t, pipelineApiError);

    const [sourceSearch, setSourceSearch] = useState('');
    const [sourceStatusFilter, setSourceStatusFilter] = useState<SourceStatusFilter>('all');
    const [sourceSortBy, setSourceSortBy] = useState<SourceSortBy>('name');

    const latestSnapshot = pipelineSnapshot || pipelineHistory[0]?.snapshot;

    const activeSnapshot = useMemo(() => {
        if (!latestSnapshot) return undefined;
        if (selectedSnapshotId === 'latest' || pipelineHistory.length === 0) {
            return latestSnapshot;
        }
        const entry = pipelineHistory.find(item => item.id === selectedSnapshotId);
        return entry?.snapshot || latestSnapshot;
    }, [selectedSnapshotId, latestSnapshot, pipelineHistory]);

    const filteredSources = useMemo(() => {
        if (!activeSnapshot) return [];
        const query = sourceSearch.trim().toLowerCase();
        const filtered = activeSnapshot.sources.filter(source => {
            const matchesQuery =
                !query ||
                source.name.toLowerCase().includes(query) ||
                source.category.toLowerCase().includes(query) ||
                source.lastDataType.toLowerCase().includes(query);
            const matchesStatus = matchesSourceStatusFilter(sourceStatusFilter, source.lastStatus);
            return matchesQuery && matchesStatus;
        });

        return [...filtered].sort((a, b) => {
            switch (sourceSortBy) {
                case 'backlog':
                    return (
                        (b.collectorBacklog?.backlogCount ?? -1) -
                        (a.collectorBacklog?.backlogCount ?? -1)
                    );
                case 'eta':
                    return (
                        (b.collectorBacklog?.estimatedWaitHours ?? -1) -
                        (a.collectorBacklog?.estimatedWaitHours ?? -1)
                    );
                case 'rank': {
                    const rankA = a.collectorBacklog?.queuePositionRank ?? Number.MAX_SAFE_INTEGER;
                    const rankB = b.collectorBacklog?.queuePositionRank ?? Number.MAX_SAFE_INTEGER;
                    return rankA - rankB;
                }
                default:
                    return a.name.localeCompare(b.name);
            }
        });
    }, [activeSnapshot, sourceSearch, sourceStatusFilter, sourceSortBy]);

    const previewNormalized = normalizedData.slice(0, 8);

    return (
        <div className={DATAHUB_SHELL}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                    <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground">{t('data_preparation')}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">{t('data_preparation_desc')}</p>
                    {activeSnapshot?.lastRefreshed && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {t('pipeline_last_refreshed')}: {formatTimeAgo(activeSnapshot.lastRefreshed)}
                        </p>
                    )}
                    </div>
                <div className="flex flex-wrap items-end gap-2">
                        {pipelineHistory.length > 0 && (
                        <div>
                            <label className="block text-[10px] text-muted-foreground mb-1">
                                {t('snapshot_history')}
                                </label>
                                <select
                                    value={selectedSnapshotId}
                                    onChange={e => setSelectedSnapshotId(e.target.value)}
                                className={SELECT_CLASS}
                                >
                                <option value="latest">{t('snapshot_latest')}</option>
                                    {pipelineHistory.map(entry => (
                                        <option key={entry.id} value={entry.id}>
                                            {new Date(entry.generatedAt).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button
                        type="button"
                            onClick={handleRefreshPipelineSnapshot}
                            disabled={isLoadingPipeline}
                        className={BTN_PRIMARY}
                        >
                        {isLoadingPipeline ? t('refreshing') : t('refresh_pipeline')}
                        </button>
                    </div>
                </div>

            {queryError && (
                <DataHubAlert
                    variant={queryError.variant}
                    message={queryError.message}
                    onRetry={
                        queryError.retryable
                            ? () => {
                                  setPipelineError(null);
                                  handleRefreshPipelineSnapshot();
                              }
                            : undefined
                    }
                    retryLabel={t('retry')}
                />
            )}

            {isLoadingPipeline && !activeSnapshot ? (
                <div className="py-12 text-center text-xs text-muted-foreground">{t('pipeline_loading')}</div>
            ) : !activeSnapshot ? (
                <DataHubEmpty message={t('pipeline_empty_state')} />
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                        <MetricCard label={t('total_records')} value={activeSnapshot.totalRecords || 0} color="blue" />
                        <MetricCard
                            label={t('normalized_percent')}
                            value={`${(activeSnapshot.normalizedPercent || 0).toFixed(1)}%`}
                            color="purple"
                        />
                        <MetricCard
                            label={t('pipeline_metric_requests')}
                            value={activeSnapshot.totalRequests24h || 0}
                            color="emerald"
                            hint={t('pipeline_metric_requests_hint')}
                        />
                        <MetricCard
                            label={t('pipeline_metric_passed')}
                            value={activeSnapshot.passed24h || 0}
                            color="emerald"
                        />
                        <MetricCard
                            label={t('pipeline_metric_failed')}
                            value={activeSnapshot.failed24h || 0}
                            color="red"
                        />
                        <MetricCard
                            label={t('pipeline_metric_pending')}
                            value={activeSnapshot.pending24h || 0}
                            color="amber"
                        />
                    </div>

                    <p
                        className="text-[10px] text-muted-foreground/90 mb-5 -mt-2"
                        title={t('pipeline_telegram_comparison_hint')}
                    >
                        {t('pipeline_telegram_comparison_hint')}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-5">
                    <input
                        value={sourceSearch}
                        onChange={e => setSourceSearch(e.target.value)}
                            placeholder={t('source_filter_placeholder')}
                            className={INPUT_CLASS}
                    />
                    <select
                        value={sourceStatusFilter}
                            onChange={e =>
                                setSourceStatusFilter(e.target.value as typeof sourceStatusFilter)
                            }
                            className={SELECT_CLASS}
                        >
                            <option value="all">{t('status_all')}</option>
                            <option value="success">{t('pipeline_source_status_success')}</option>
                            <option value="pending">{t('pipeline_filter_pending')}</option>
                            <option value="no_data">{t('pipeline_source_status_no_data')}</option>
                            <option value="fetch_error">{t('pipeline_source_status_fetch_error')}</option>
                            <option value="fetch_timeout">{t('pipeline_source_status_fetch_timeout')}</option>
                            <option value="inactive">{t('pipeline_source_status_inactive')}</option>
                            <option value="issues">{t('pipeline_filter_issues')}</option>
                        </select>
                        <select
                            value={sourceSortBy}
                            onChange={e => setSourceSortBy(e.target.value as SourceSortBy)}
                            className={SELECT_CLASS}
                            aria-label={t('pipeline_sort_label')}
                        >
                            <option value="name">{t('pipeline_sort_name')}</option>
                            <option value="backlog">{t('pipeline_sort_backlog')}</option>
                            <option value="eta">{t('pipeline_sort_eta')}</option>
                            <option value="rank">{t('pipeline_sort_rank')}</option>
                    </select>
                </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                        <TelegramTransferHealth
                            t={t}
                            snapshot={activeSnapshot}
                            isLoading={isLoadingPipelineBacklog}
                            isPipelineLoaded={Boolean(activeSnapshot)}
                            error={pipelineBacklogError}
                            onRetry={onRetryPipelineBacklog}
                            formatTimeAgo={formatTimeAgo}
                        />

                        <div className={DATAHUB_INNER_LIST}>
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <h4 className="text-[11px] font-semibold text-foreground">
                                    {t('source_quality_board')}
                                </h4>
                                {isLoadingPipelineBacklog && (
                                    <span className="text-[10px] text-muted-foreground">
                                        {t('pipeline_backlog_loading')}
                                    </span>
                                )}
                            </div>
                            {filteredSources.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground">{t('pipeline_no_sources')}</p>
                            ) : (
                                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                    <table className="w-full text-[11px]">
                                        <thead className="sticky top-0 bg-slate-950/90">
                                            <tr className="border-b border-slate-800 text-muted-foreground text-left">
                                                <th className="py-2 pr-2">{t('name')}</th>
                                                <th className="py-2 pr-2">{t('data_type')}</th>
                                                <th className="py-2 pr-2">{t('status')}</th>
                                                <th className="py-2">{t('response_ms')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSources.map(src => (
                                                <tr
                                                    key={src.sourceId}
                                                    className="border-b border-slate-900/60 hover:bg-slate-900/40"
                                                >
                                                    <td className="py-2 pr-2">
                                                        <div className="text-foreground font-medium">{src.name}</div>
                                                        <div className="text-[10px] text-muted-foreground">
                                                            {src.category}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 pr-2 text-muted-foreground">
                                                        {src.lastDataType}
                                                    </td>
                                                    <td className="py-2 pr-2">
                                                        <StatusPill
                                                            label={pipelineStatusLabel(t, src)}
                                                            variant={statusVariant(src.lastStatus)}
                                                            title={
                                                                src.statusHint
                                                                    ? t(src.statusHint)
                                                                    : undefined
                                                            }
                                                        />
                                                        {renderCollectorBacklogDetails(t, src, formatTimeAgo)}
                                                    </td>
                                                    <td className="py-2">
                                                        {src.lastResponseTime != null
                                                            ? `${src.lastResponseTime}ms`
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {normalizationSummary && (
                        <div className={`${DATAHUB_INNER_LIST} mb-5`}>
                            <h4 className="text-[11px] font-semibold text-foreground mb-3">
                                {t('normalization_summary')}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <MetricCard
                                    label={t('normalization_processed')}
                                    value={normalizationSummary.totalProcessed}
                                    color="blue"
                                />
                                <MetricCard
                                    label={t('normalization_passed')}
                                    value={normalizationSummary.passed}
                                    color="emerald"
                                />
                                <MetricCard
                                    label={t('normalization_warnings')}
                                    value={normalizationSummary.warnings}
                                    color="amber"
                                />
                                <MetricCard
                                    label={t('normalization_rejected')}
                                    value={normalizationSummary.rejected}
                                    color="red"
                                />
                            </div>
                        </div>
                    )}

                    {previewNormalized.length > 0 && (
                        <div className={DATAHUB_INNER_LIST}>
                            <h4 className="text-[11px] font-semibold text-foreground mb-3">
                                {t('normalized_data_preview')}
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-muted-foreground text-left">
                                            <th className="py-2 pr-2">{t('source')}</th>
                                            <th className="py-2 pr-2">{t('category')}</th>
                                            <th className="py-2 pr-2">{t('data_type')}</th>
                                            <th className="py-2 pr-2">{t('quality_score')}</th>
                                            <th className="py-2">{t('status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewNormalized.map(row => (
                                            <tr
                                                key={row.id}
                                                className="border-b border-slate-900/60 hover:bg-slate-900/40"
                                            >
                                                <td className="py-2 pr-2">
                                                    <span
                                                        className="text-foreground font-medium"
                                                        title={row.sourceId}
                                                    >
                                                        {row.sourceName || row.sourceId}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-2">{row.category}</td>
                                                <td className="py-2 pr-2">{row.dataType}</td>
                                                <td className="py-2 pr-2">
                                                    {row.qualityPending
                                                        ? t('pipeline_quality_pending')
                                                        : row.qualityScore != null
                                                          ? (
                                                              <span
                                                                  title={
                                                                      row.qualityReasonCodes?.length
                                                                          ? row.qualityReasonCodes.slice(0, 5).join(', ')
                                                                          : undefined
                                                                  }
                                                              >
                                                                  {row.qualityScore}
                                                              </span>
                                                            )
                                                          : '—'}
                                                </td>
                                                <td className="py-2">
                                                    <StatusPill
                                                        label={normalizedStatusLabel(t, row.status)}
                                                        variant={normStatusVariant(row.status)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                    </div>
                    </div>
                )}
                </>
            )}
        </div>
    );
};

export default PipelinePanel;
