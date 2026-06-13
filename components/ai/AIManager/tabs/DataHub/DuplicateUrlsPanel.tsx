import React, { useMemo, useState } from 'react';
import type { DataSource } from '../../../../../types';
import type { DuplicateUrlGroup, DuplicateUrlSourceDetail } from '../../../../../services/dataSourcesApi';
import {
    useDuplicateUrlDashboardQuery,
    useSetDuplicateUrlIgnoreMutation,
} from '../../../../../hooks/useDataHubState';
import {
    DATAHUB_SHELL,
    BTN_SECONDARY,
    BTN_OUTLINE_AMBER,
    BTN_OUTLINE_SLATE,
    BTN_OUTLINE_SKY,
    MetricCard,
    DataHubAlert,
    DataHubEmpty,
    dataHubWriteGate,
} from './dataHubUi';
import { useDataHubPermissions } from './hooks/useDataHubPermissions';

type Props = {
    t: (key: string) => string;
    formatTimeAgo: (date: string | Date) => string;
    sources: DataSource[];
    onRefresh: () => void;
    onViewSource: (sourceId: string) => void;
    onDisableSource: (sourceId: string) => void | Promise<void>;
    /** When true, omit outer shell (embedded in Data Sources tab). */
    embedded?: boolean;
};

function severityClass(severity: string, ignored: boolean) {
    if (ignored || severity === 'info') return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    if (severity === 'high') return 'bg-red-500/15 text-red-300 border-red-500/30';
    if (severity === 'medium') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
}

function severityLabel(t: (key: string) => string, severity: string, ignored: boolean) {
    if (ignored || severity === 'info') return t('duplicate_severity_info');
    return t(`duplicate_severity_${severity}`);
}

const DuplicateUrlsPanel: React.FC<Props> = ({
    t,
    formatTimeAgo,
    sources,
    onRefresh,
    onViewSource,
    onDisableSource,
    embedded = false,
}) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extra = false) => dataHubWriteGate(canWrite, t, extra);
    const { data, isLoading, error, refetch, isFetching } = useDuplicateUrlDashboardQuery();
    const ignoreMut = useSetDuplicateUrlIgnoreMutation();
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [showIgnored, setShowIgnored] = useState(false);

    const summary = data?.summary;
    const groups = useMemo(() => {
        const all = data?.groups ?? [];
        if (showIgnored) return all;
        return all.filter(g => !g.ignored);
    }, [data?.groups, showIgnored]);

    const handleIgnore = async (source: DuplicateUrlSourceDetail, ignore: boolean) => {
        await ignoreMut.mutateAsync({ sourceId: source.id, ignore });
        void refetch();
        onRefresh();
    };

    const renderSourceActions = (source: DuplicateUrlSourceDetail, group: DuplicateUrlGroup) => (
        <div className="flex flex-wrap gap-1.5 mt-2">
            <button
                type="button"
                className={BTN_OUTLINE_SKY}
                onClick={() => onViewSource(source.id)}
            >
                {t('duplicate_action_view_source')}
            </button>
            {source.isActive ? (
                <button
                    type="button"
                    className={BTN_OUTLINE_AMBER}
                    disabled={wg(ignoreMut.isPending).disabled}
                    title={wg(ignoreMut.isPending).title}
                    onClick={() => void onDisableSource(source.id)}
                >
                    {t('duplicate_action_disable_source')}
                </button>
            ) : null}
            {source.ignoreDuplicateUrl ? (
                <button
                    type="button"
                    className={BTN_OUTLINE_SLATE}
                    disabled={wg(ignoreMut.isPending).disabled}
                    title={wg(ignoreMut.isPending).title}
                    onClick={() => void handleIgnore(source, false)}
                >
                    {t('duplicate_action_unignore')}
                </button>
            ) : (
                <button
                    type="button"
                    className={BTN_OUTLINE_SLATE}
                    disabled={wg(ignoreMut.isPending).disabled}
                    title={wg(ignoreMut.isPending).title}
                    onClick={() => void handleIgnore(source, true)}
                >
                    {t('duplicate_action_ignore')}
                </button>
            )}
        </div>
    );

    const renderSourceDetail = (source: DuplicateUrlSourceDetail) => (
        <div
            key={source.id}
            className="rounded-lg border border-white/5 bg-slate-950/40 p-3"
        >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-foreground">{source.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {source.type} · {source.isActive ? t('active') : t('inactive')}
                        {source.ignoreDuplicateUrl ? ` · ${t('duplicate_ignored_label')}` : ''}
                    </p>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-md">
                    {source.url}
                </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[10px]">
                <div>
                    <p className="text-muted-foreground">{t('duplicate_collected')}</p>
                    <p className="font-semibold">{source.collectedCount ?? 0}</p>
                </div>
                <div>
                    <p className="text-muted-foreground">{t('duplicate_fetch_count')}</p>
                    <p className="font-semibold">{source.fetchCount ?? 0}</p>
                </div>
                <div>
                    <p className="text-muted-foreground">{t('update_interval')}</p>
                    <p className="font-semibold">
                        {source.refreshInterval != null ? `${source.refreshInterval}m` : '—'}
                    </p>
                </div>
                <div>
                    <p className="text-muted-foreground">{t('duplicate_crawler_linked')}</p>
                    <p className="font-semibold">
                        {source.crawlerLinked
                            ? source.crawlerName || t('yes')
                            : t('no')}
                    </p>
                </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
                {t('created')}:{' '}
                {source.createdAt ? new Date(source.createdAt).toLocaleString() : '—'}
                {' · '}
                {t('last_fetch')}:{' '}
                {source.lastFetchAt ? formatTimeAgo(source.lastFetchAt) : '—'}
                {' · '}
                {t('duplicate_last_collected')}:{' '}
                {source.lastCollectedAt ? formatTimeAgo(source.lastCollectedAt) : '—'}
            </p>
            {renderSourceActions(source, {} as DuplicateUrlGroup)}
        </div>
    );

    const shellClass = embedded ? 'space-y-4' : DATAHUB_SHELL;

    return (
        <div className={shellClass}>
            {!embedded ? (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                    <div>
                        <h3 className="text-sm md:text-base font-semibold text-foreground">
                            {t('duplicate_urls_title')}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
                            {t('duplicate_urls_desc')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            void refetch();
                            onRefresh();
                        }}
                        disabled={isLoading || isFetching}
                        className={BTN_SECONDARY}
                    >
                        {isFetching ? t('refreshing') : t('refresh')}
                    </button>
                </div>
            ) : null}

            {error ? (
                <DataHubAlert variant="error" message={t('duplicate_urls_load_error')} />
            ) : null}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <MetricCard
                    label={t('duplicate_metric_groups')}
                    value={summary?.duplicateGroups ?? 0}
                    color="purple"
                />
                <MetricCard
                    label={t('duplicate_metric_active_sources')}
                    value={summary?.activeDuplicateSources ?? 0}
                    color="red"
                />
                <MetricCard
                    label={t('duplicate_metric_inactive_sources')}
                    value={summary?.inactiveDuplicateSources ?? 0}
                    color="amber"
                />
                <MetricCard
                    label={t('duplicate_metric_high_risk')}
                    value={summary?.highRiskGroups ?? 0}
                    color="red"
                />
            </div>

            <label className="flex items-center gap-2 text-[11px] text-muted-foreground mb-4">
                <input
                    type="checkbox"
                    checked={showIgnored}
                    onChange={e => setShowIgnored(e.target.checked)}
                />
                {t('duplicate_show_ignored_groups')}
            </label>

            {isLoading && !data ? (
                <p className="text-[11px] text-muted-foreground py-8 text-center">{t('loading')}</p>
            ) : groups.length === 0 ? (
                <DataHubEmpty message={t('duplicate_urls_empty')} />
            ) : (
                <div className="space-y-3">
                    {groups.map(group => {
                        const expanded = expandedKey === group.duplicateUrlKey;
                        return (
                            <div
                                key={group.duplicateUrlKey}
                                className="rounded-xl border border-white/5 bg-slate-900/50 overflow-hidden"
                            >
                                <button
                                    type="button"
                                    className="w-full text-left p-4 hover:bg-slate-900/80 transition-colors"
                                    onClick={() =>
                                        setExpandedKey(
                                            expanded ? null : group.duplicateUrlKey,
                                        )
                                    }
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[10px] uppercase text-muted-foreground mb-1">
                                                {t('duplicate_url_group')}
                                            </p>
                                            <p className="text-sm font-mono text-foreground break-all">
                                                {group.normalizedUrl}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                {group.activeCount} {t('duplicate_active_sources_label')}
                                                {' · '}
                                                {group.totalCollectedCount} {t('duplicate_collected_records')}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${severityClass(group.severity, group.ignored)}`}
                                        >
                                            {severityLabel(t, group.severity, group.ignored)}
                                        </span>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        {group.sources.map(s => (
                                            <div
                                                key={s.id}
                                                className="flex flex-wrap items-center gap-2 text-[11px]"
                                            >
                                                <span className="font-medium text-foreground">
                                                    [{s.name}]
                                                </span>
                                                <span
                                                    className={
                                                        s.isActive
                                                            ? 'text-emerald-300'
                                                            : 'text-slate-400'
                                                    }
                                                >
                                                    {s.isActive ? t('active') : t('inactive')}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {s.collectedCount ?? 0} {t('records')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </button>

                                {expanded ? (
                                    <div className="border-t border-white/5 p-4 space-y-4 bg-slate-950/30">
                                        <div className="text-[11px] text-muted-foreground">
                                            <p className="font-medium text-foreground mb-1">
                                                {t('duplicate_why_flagged')}
                                            </p>
                                            <p>{group.flagReason || t('duplicate_flag_same_url')}</p>
                                        </div>
                                        <div className="space-y-3">
                                            {group.sources.map(renderSourceDetail)}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DuplicateUrlsPanel;
