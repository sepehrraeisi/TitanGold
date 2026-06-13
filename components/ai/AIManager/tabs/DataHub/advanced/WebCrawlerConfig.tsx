import React, { useMemo, useState } from 'react';
import WebCrawlerModal from '../modals/WebCrawlerModal';
import {
    useDataHubCrawlersQuery,
    useCreateCrawlerMutation,
    useUpdateCrawlerMutation,
    useDeleteCrawlerMutation,
    useRunCrawlerMutation,
    useCrawlerRunsQuery,
    useCrawlerRecentOutputsQuery,
} from '../../../../../../hooks/useDataHubCrawlers';
import { useDataSourcesQuery } from '../../../../../../hooks/useDataHubState';
import type { DataHubCrawler } from '../../../../../../services/dataHubCrawlersApi';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';
import type { CreateCrawlerPayload } from '../../../../../../services/dataHubCrawlersApi';
import { formatApiErrorForUi } from '../dataHubI18n';
import { dataHubWriteGate } from '../dataHubUi';
import { useDataHubPermissions } from '../hooks/useDataHubPermissions';
import { formatAvgLatency } from '../pipelineHealthFormat';

interface WebCrawlerConfigProps {
    t: (key: string) => string;
}

const SHELL =
    'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl p-4 md:p-5';

function runErrorCode(error: unknown): string | undefined {
    if (!(error instanceof DataHubApiError)) return undefined;
    const body = error.details as Record<string, unknown> | undefined;
    return typeof body?.code === 'string' ? body.code : undefined;
}

const WebCrawlerConfig: React.FC<WebCrawlerConfigProps> = ({ t }) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const { data, isLoading, error, refetch } = useDataHubCrawlersQuery();
    const { data: sourcesResult } = useDataSourcesQuery({ page: 1, limit: 100 });
    const sources = sourcesResult?.data ?? [];

    const createMut = useCreateCrawlerMutation();
    const updateMut = useUpdateCrawlerMutation();
    const deleteMut = useDeleteCrawlerMutation();
    const runMut = useRunCrawlerMutation();

    const crawlers = data?.crawlers ?? [];
    const summary = data?.summary;

    const [modalCrawler, setModalCrawler] = useState<DataHubCrawler | null | undefined>(undefined);
    const [expandedRunsId, setExpandedRunsId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: runs = [], isLoading: runsLoading } = useCrawlerRunsQuery(expandedRunsId);
    const { data: recentOutputs = [], isLoading: outputsLoading } =
        useCrawlerRecentOutputsQuery(expandedRunsId);

    const avgLatency = useMemo(
        () => formatAvgLatency(summary?.avg_latency_ms ?? null),
        [summary?.avg_latency_ms],
    );

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return crawlers;
        return crawlers.filter(
            c =>
                c.name.toLowerCase().includes(q) ||
                c.start_url.toLowerCase().includes(q) ||
                (c.source_name || '').toLowerCase().includes(q),
        );
    }, [crawlers, searchTerm]);

    const apiError =
        error instanceof DataHubApiError
            ? formatApiErrorForUi(t, error.message)
            : error instanceof Error
              ? formatApiErrorForUi(t, error.message)
              : null;

    const handleSave = async (payload: CreateCrawlerPayload) => {
        if (modalCrawler?.id) {
            await updateMut.mutateAsync({ id: modalCrawler.id, payload });
        } else {
            await createMut.mutateAsync(payload);
        }
        setModalCrawler(undefined);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('crawler_delete_confirm'))) return;
        await deleteMut.mutateAsync(id);
        if (expandedRunsId === id) setExpandedRunsId(null);
    };

    const handleRun = async (id: string, dryRun: boolean, forceOverride = false) => {
        await runMut.mutateAsync({ id, dry_run: dryRun, force_override: forceOverride });
    };

    const ingestionOwnerLabel = (crawler: DataHubCrawler) => {
        if (crawler.target_type === 'website') return t('crawler_ingestion_website');
        if (crawler.ingestion_owner === 'crawler') return t('crawler_ingestion_crawler');
        return t('crawler_ingestion_data_fetcher');
    };

    const runModeLabel = (crawler: DataHubCrawler) =>
        crawler.run_mode === 'web_crawler'
            ? t('crawler_run_mode_web_crawler')
            : t('crawler_run_mode_scheduler');

    return (
        <div className={SHELL}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground">
                        {t('web_crawlers')}
                        </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
                        {t('web_crawlers_desc')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isLoading}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                >
                    {isLoading ? t('refreshing') : t('refresh')}
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-6">
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3">
                    <p className="text-[11px] text-purple-300/80 mb-1">{t('total_crawlers')}</p>
                    <p className="text-sm font-semibold text-purple-100">{summary?.total ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3">
                    <p className="text-[11px] text-emerald-300/80 mb-1">{t('active_crawlers')}</p>
                    <p className="text-sm font-semibold text-emerald-100">{summary?.enabled ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3">
                    <p className="text-[11px] text-amber-300/80 mb-1">{t('crawler_metric_errors')}</p>
                    <p className="text-sm font-semibold text-amber-100">{summary?.failed24h ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent p-3">
                    <p className="text-[11px] text-sky-300/80 mb-1">{t('avg_latency')}</p>
                    <p
                        className="text-sm font-semibold text-sky-100"
                        title={
                            avgLatency.available ? undefined : t('pipeline_latency_not_available')
                        }
                    >
                        {avgLatency.display}
                        </p>
                    </div>
            </div>

            <div className="mb-4 text-[11px] text-sky-200 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2">
                {t('crawler_linked_profile_banner')}
            </div>

            {apiError ? (
                <div className="mb-4 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {apiError}
                    </div>
            ) : null}

            {runMut.error instanceof DataHubApiError ? (
                <div className="mb-4 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {runErrorCode(runMut.error) === 'RSS_DATAFETCHER_OWNS'
                        ? t('crawler_rss_datafetcher_owns_error')
                        : runErrorCode(runMut.error) === 'SOURCE_INACTIVE'
                          ? t('crawler_source_inactive_error')
                          : formatApiErrorForUi(t, runMut.error.message)}
                    {runMut.error.status === 400 &&
                    String(runMut.error.message).includes('RENDER_JS') ? (
                        <p className="mt-1 opacity-80">{t('crawler_render_js_disabled_hint')}</p>
                    ) : null}
                </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                    type="text"
                    placeholder={t('crawler_search_placeholder')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-slate-900/60 text-sm"
                />
                <button
                    type="button"
                    onClick={() => setModalCrawler(null)}
                    className="text-[11px] px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white whitespace-nowrap disabled:opacity-50"
                    disabled={wg().disabled}
                    title={wg().title}
                >
                    {t('crawler_add')}
                </button>
            </div>

            {isLoading ? (
                <p className="text-[11px] text-muted-foreground py-8 text-center">{t('loading')}</p>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm font-medium">{t('crawler_empty_title')}</p>
                    <p className="text-[11px] mt-1">{t('crawler_empty_hint')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(crawler => {
                        const realRunBlocked =
                            crawler.real_run_blocked ||
                            crawler.source_is_active === false;
                        const showOverride =
                            crawler.duplicate_risk && crawler.source_is_active !== false;

                            return (
                            <div
                                key={crawler.id}
                                className="rounded-xl border border-white/5 bg-slate-900/40 p-3"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground">
                                                {crawler.name}
                                            </span>
                                            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                                {crawler.target_type}
                                            </span>
                                            <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full ${
                                                    crawler.is_enabled
                                                        ? 'bg-emerald-500/20 text-emerald-300'
                                                        : 'bg-slate-700 text-slate-400'
                                                }`}
                                            >
                                                {crawler.is_enabled
                                                    ? t('crawler_enabled')
                                                    : t('crawler_paused')}
                                            </span>
                                            {crawler.source_is_active === false ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">
                                                    {t('crawler_source_disabled')}
                                                </span>
                                            ) : null}
                                            {crawler.synced_from_source ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">
                                                    {t('crawler_synced_from_source')}
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
                                            {crawler.start_url}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {t('crawler_linked_source')}:{' '}
                                            <span className="text-foreground">
                                                {crawler.source_name || crawler.source_id}
                                            </span>
                                            {' · '}
                                            {t('crawler_source_type')}:{' '}
                                            <span className="text-foreground">
                                                {crawler.source_type || crawler.target_type}
                                            </span>
                                            {' · '}
                                            {t('crawler_ingestion_owner')}:{' '}
                                            <span className="text-foreground">
                                                {ingestionOwnerLabel(crawler)}
                                            </span>
                                            {' · '}
                                            {t('crawler_run_mode')}:{' '}
                                            <span className="text-foreground">
                                                {runModeLabel(crawler)}
                                            </span>
                                            {' · '}
                                            {t('crawler_depth')}: {crawler.max_depth}
                                            {' · '}
                                            {t('crawler_max_pages')}: {crawler.max_pages_per_run}
                                        </p>
                                        {crawler.duplicate_risk ? (
                                            <p className="text-[10px] text-amber-300 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
                                                {t('crawler_rss_duplicate_warning')}
                                            </p>
                                        ) : null}
                                        {crawler.duplicate_url_severity === 'high' ||
                                        crawler.duplicate_url_severity === 'medium' ? (
                                            <p className="text-[10px] text-orange-300 mt-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1.5">
                                                {t('crawler_linked_source_duplicate_names')}
                                                {': '}
                                                {(crawler.duplicate_url_siblings ?? [])
                                                    .map(s => s.name)
                                                    .filter(Boolean)
                                                    .join(' · ') ||
                                                    t('crawler_linked_source_duplicate_url').replace(
                                                        '{{count}}',
                                                        String(
                                                            Math.max(
                                                                (crawler.duplicate_url_count ?? 1) - 1,
                                                                1,
                                                            ),
                                                        ),
                                                    )}
                                            </p>
                                        ) : null}
                                        {crawler.last_error ? (
                                            <p className="text-[10px] text-red-300 mt-1">
                                                {crawler.last_error}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleRun(crawler.id, true)}
                                            disabled={wg(runMut.isPending).disabled}
                                            title={t('crawler_dry_run_hint')}
                                            className="text-[11px] px-2 py-1 rounded-full border border-sky-500/40 text-sky-200"
                                        >
                                            {t('crawler_dry_run')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRun(crawler.id, false)}
                                            disabled={
                                                wg(runMut.isPending).disabled || realRunBlocked
                                            }
                                            title={
                                                realRunBlocked
                                                    ? t('crawler_run_blocked_hint')
                                                    : wg(runMut.isPending).title
                                            }
                                            className="text-[11px] px-2 py-1 rounded-full bg-emerald-600/80 hover:bg-emerald-500 text-white disabled:opacity-40"
                                        >
                                            {t('crawler_run')}
                                        </button>
                                        {showOverride ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (
                                                        !window.confirm(
                                                            t('crawler_force_override_confirm'),
                                                        )
                                                    ) {
                                                        return;
                                                    }
                                                    void handleRun(crawler.id, false, true);
                                                }}
                                                disabled={wg(runMut.isPending).disabled}
                                                title={wg(runMut.isPending).title}
                                                className="text-[11px] px-2 py-1 rounded-full border border-amber-500/40 text-amber-200"
                                            >
                                                {t('crawler_run_override')}
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedRunsId(
                                                    expandedRunsId === crawler.id
                                                        ? null
                                                        : crawler.id,
                                                )
                                            }
                                            className="text-[11px] px-2 py-1 rounded-full border border-white/10"
                                        >
                                            {t('crawler_history')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setModalCrawler(crawler)}
                                            className="text-[11px] px-2 py-1 rounded-full border border-white/10"
                                            disabled={wg().disabled}
                                            title={wg().title}
                                        >
                                            {t('edit')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(crawler.id)}
                                            className="text-[11px] px-2 py-1 rounded-full border border-red-500/30 text-red-300"
                                            disabled={wg().disabled}
                                            title={wg().title}
                                        >
                                            {t('delete')}
                                        </button>
                                    </div>
                                            </div>

                                {expandedRunsId === crawler.id ? (
                                    <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                                        <div>
                                            <p className="text-[10px] font-medium text-muted-foreground mb-2">
                                                {t('crawler_history')}
                                            </p>
                                            {runsLoading ? (
                                                <p className="text-[10px] text-muted-foreground">
                                                    {t('loading')}
                                                </p>
                                            ) : runs.length === 0 ? (
                                                <p className="text-[10px] text-muted-foreground">
                                                    {t('crawler_no_runs')}
                                                </p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {runs.map(run => (
                                                        <div
                                                            key={run.id}
                                                            className="flex flex-wrap gap-2 text-[10px] text-muted-foreground py-1"
                                                        >
                                                            <span
                                                                className={
                                                                    run.status === 'success'
                                                                        ? 'text-emerald-400'
                                                                        : run.status === 'failed'
                                                                          ? 'text-red-400'
                                                                          : 'text-amber-400'
                                                                }
                                                            >
                                                                {run.status}
                                                            </span>
                                                            {run.dry_run ? (
                                                                <span className="text-sky-400">
                                                                    {t('crawler_run_simulated')}
                                                                </span>
                                                            ) : (
                                                                <span className="text-emerald-300/80">
                                                                    {t('crawler_run_records_written')}
                                                                </span>
                                                            )}
                                                            <span>
                                                                {run.pages_fetched}{' '}
                                                                {t('crawler_pages')} ·{' '}
                                                                {run.dry_run
                                                                    ? t('crawler_simulated_count')
                                                                    : t('crawler_ingested')}
                                                                : {run.items_ingested}
                                                                {run.items_blocked > 0
                                                                    ? ` · ${run.items_blocked} ${t('crawler_blocked')}`
                                                                    : ''}
                                                            </span>
                                                            {run.duration_ms != null ? (
                                                                <span>{run.duration_ms} ms</span>
                                                            ) : null}
                                                            {run.error_message ? (
                                                                <span className="text-red-300">
                                                                    {run.error_message}
                                                                </span>
                                                            ) : null}
                                                </div>
                                                    ))}
                                                    </div>
                                                )}
                                        </div>

                                        <div>
                                            <p className="text-[10px] font-medium text-muted-foreground mb-2">
                                                {t('crawler_recent_outputs')}
                                            </p>
                                            {outputsLoading ? (
                                                <p className="text-[10px] text-muted-foreground">
                                                    {t('loading')}
                                                </p>
                                            ) : recentOutputs.length === 0 ? (
                                                <p className="text-[10px] text-muted-foreground">
                                                    {t('crawler_no_recent_outputs')}
                                                </p>
                                            ) : (
                                                <ul className="space-y-1">
                                                    {recentOutputs.map(row => (
                                                        <li
                                                            key={row.id}
                                                            className="text-[10px] text-muted-foreground flex flex-wrap gap-2"
                                                        >
                                                            <span className="text-foreground truncate max-w-md">
                                                                {row.title}
                                                            </span>
                                                            <span className="text-sky-300/80">
                                                                {t('crawler_origin_crawler')}
                                                            </span>
                                                            <span>
                                                                {new Date(
                                                                    row.collected_at,
                                                                ).toLocaleString()}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                                </div>
                            );
                        })}
                    </div>
            )}

            {modalCrawler !== undefined ? (
                    <WebCrawlerModal
                    crawler={modalCrawler || undefined}
                    sources={sources}
                    onClose={() => setModalCrawler(undefined)}
                    onSave={handleSave}
                    isSaving={createMut.isPending || updateMut.isPending}
                        t={t}
                    />
            ) : null}
            </div>
    );
};

export default WebCrawlerConfig;
