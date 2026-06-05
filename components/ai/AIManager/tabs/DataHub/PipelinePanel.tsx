import React, { useMemo, useState } from 'react';
import { DataPipelineSnapshot, DataPipelineSourceSnapshot, DataNormalizationSummary, NormalizedDataRecord } from '../../../../../types';
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
    pipelineApiError?: DataHubApiError | Error | null;
    setPipelineError: (err: string | null) => void;
    formatTimeAgo: (date: string | Date | undefined) => string;
    selectedSnapshotId: string;
    setSelectedSnapshotId: (id: string) => void;
}

function statusVariant(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
    if (status === 'success') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'timeout') return 'warning';
    if (status === 'cached') return 'info';
    return 'neutral';
}

function pipelineStatusLabel(
    t: (key: string) => string,
    src: { lastStatus: string; operationalStatus?: DataPipelineSourceSnapshot['operationalStatus'] },
): string {
    if (src.operationalStatus) {
        return dataHubSourceStatusLabel(t, src.operationalStatus as DataSource['status']);
    }
    return t(src.lastStatus);
}

function normStatusVariant(status: NormalizedDataRecord['status']): 'success' | 'warning' | 'error' {
    if (status === 'ready') return 'success';
    if (status === 'warning') return 'warning';
    return 'error';
}

const PipelinePanel: React.FC<PipelinePanelProps> = ({
    t,
    pipelineSnapshot,
    pipelineHistory,
    normalizationSummary,
    normalizedData,
    handleRefreshPipelineSnapshot,
    isLoadingPipeline,
    pipelineApiError = null,
    setPipelineError,
    formatTimeAgo,
    selectedSnapshotId,
    setSelectedSnapshotId,
}) => {
    const queryError = formatDataHubQueryError(t, pipelineApiError);

    const [categorySearch, setCategorySearch] = useState('');
    const [sourceSearch, setSourceSearch] = useState('');
    const [sourceStatusFilter, setSourceStatusFilter] = useState<'all' | 'success' | 'cached' | 'failed' | 'timeout'>(
        'all',
    );

    const latestSnapshot = pipelineSnapshot || pipelineHistory[0]?.snapshot;

    const activeSnapshot = useMemo(() => {
        if (!latestSnapshot) return undefined;
        if (selectedSnapshotId === 'latest' || pipelineHistory.length === 0) {
            return latestSnapshot;
        }
        const entry = pipelineHistory.find(item => item.id === selectedSnapshotId);
        return entry?.snapshot || latestSnapshot;
    }, [selectedSnapshotId, latestSnapshot, pipelineHistory]);

    const filteredCategories = useMemo(() => {
        if (!activeSnapshot) return [];
        const query = categorySearch.trim().toLowerCase();
        return activeSnapshot.categories.filter(
            category => !query || category.name.toLowerCase().includes(query),
        );
    }, [activeSnapshot, categorySearch]);

    const filteredSources = useMemo(() => {
        if (!activeSnapshot) return [];
        const query = sourceSearch.trim().toLowerCase();
        return activeSnapshot.sources.filter(source => {
            const matchesQuery =
                !query ||
                source.name.toLowerCase().includes(query) ||
                source.category.toLowerCase().includes(query) ||
                source.lastDataType.toLowerCase().includes(query);
            const matchesStatus = sourceStatusFilter === 'all' || source.lastStatus === sourceStatusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [activeSnapshot, sourceSearch, sourceStatusFilter]);

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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-5">
                        <input
                            value={categorySearch}
                            onChange={e => setCategorySearch(e.target.value)}
                            placeholder={t('category_filter_placeholder')}
                            className={INPUT_CLASS}
                        />
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
                            <option value="success">{t('success')}</option>
                            <option value="cached">{t('cached')}</option>
                            <option value="failed">{t('failed')}</option>
                            <option value="timeout">{t('timeout')}</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                        <div className={DATAHUB_INNER_LIST}>
                            <h4 className="text-[11px] font-semibold text-foreground mb-3">
                                {t('category_screening')}
                            </h4>
                            {filteredCategories.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground">{t('pipeline_no_categories')}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="border-b border-slate-800 text-muted-foreground text-left">
                                                <th className="py-2 pr-2">{t('name')}</th>
                                                <th className="py-2 pr-2">{t('category_inflow')}</th>
                                                <th className="py-2">{t('category_pass_rate')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCategories.map(cat => (
                                                <tr
                                                    key={cat.categoryId}
                                                    className="border-b border-slate-900/60 hover:bg-slate-900/40"
                                                >
                                                    <td className="py-2 pr-2 text-foreground">{cat.name}</td>
                                                    <td className="py-2 pr-2">{cat.inflow}</td>
                                                    <td className="py-2 text-emerald-300">
                                                        {cat.passRate.toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className={DATAHUB_INNER_LIST}>
                            <h4 className="text-[11px] font-semibold text-foreground mb-3">
                                {t('source_quality_board')}
                            </h4>
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
                                                        />
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
                                                <td className="py-2 pr-2">{row.qualityScore}</td>
                                                <td className="py-2">
                                                    <StatusPill
                                                        label={
                                                            row.status === 'ready'
                                                                ? t('normalized_status_ready')
                                                                : row.status === 'warning'
                                                                  ? t('normalized_status_warning')
                                                                  : t('normalized_status_rejected')
                                                        }
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
