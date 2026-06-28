
import React, { useMemo, useState } from 'react';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';
import {
    useArchiveStatsQuery,
    useArchivedRecordsQuery,
    usePreviewArchiveMutation,
    useExecuteArchiveMutation,
    usePreviewRestoreMutation,
    useExecuteRestoreMutation,
    usePreviewPurgeMutation,
} from '../../../../../../hooks/useDataHubArchiving';
import { formatDataHubQueryError } from '../dataHubI18n';
import {
    DATAHUB_SHELL,
    BTN_PRIMARY,
    BTN_SECONDARY,
    DataHubAlert,
    DataHubEmpty,
    MetricCard,
    StatusPill,
    dataHubWriteGate,
} from '../dataHubUi';
import { useDataHubPermissions } from '../hooks/useDataHubPermissions';
import {
    archiveHealthLabel,
    archiveHealthVariant,
    formatLastArchiveRun,
    operationLabel,
    partitionDisplayLabel,
} from './archiving/archivingLabels';

interface ArchivingProps {
    t: (key: string) => string;
}

const Archiving: React.FC<ArchivingProps> = ({ t }) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const { data: dashboard, isLoading, error: statsError, refetch } = useArchiveStatsQuery();
    const { data: recordsPage, isLoading: recordsLoading } = useArchivedRecordsQuery(0, 50);

    const previewArchiveMut = usePreviewArchiveMutation();
    const executeArchiveMut = useExecuteArchiveMutation();
    const previewRestoreMut = usePreviewRestoreMutation();
    const executeRestoreMut = useExecuteRestoreMutation();
    const previewPurgeMut = usePreviewPurgeMutation();

    const [daysOld, setDaysOld] = useState(90);
    const [archivePreview, setArchivePreview] = useState<Record<string, unknown> | null>(null);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

    const [restoreStart, setRestoreStart] = useState('');
    const [restoreEnd, setRestoreEnd] = useState('');
    const [restorePreview, setRestorePreview] = useState<Record<string, unknown> | null>(null);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

    const [purgePreview, setPurgePreview] = useState<Record<string, unknown> | null>(null);

    const health = dashboard?.health;
    const partitions = dashboard?.partitions || [];
    const operations = dashboard?.recent_operations || [];
    const records = recordsPage?.records || [];

    const apiError = [
        previewArchiveMut.error,
        executeArchiveMut.error,
        previewRestoreMut.error,
        executeRestoreMut.error,
        previewPurgeMut.error,
    ].find(e => e instanceof DataHubApiError) as DataHubApiError | undefined;

    const queryError = formatDataHubQueryError(t, statsError as Error | null);
    const mutationError = apiError ? formatDataHubQueryError(t, apiError) : null;

    const statusCode = health?.status_code || health?.status || 'no_archives';

    const summary = useMemo(
        () => ({
            active: Number(health?.active_records || 0),
            archived: Number(health?.archived_records || 0),
            pending: Number(health?.records_pending_archive || 0),
            lastRun: formatLastArchiveRun(health, t),
        }),
        [health, t],
    );

    const busy =
        isLoading ||
        previewArchiveMut.isPending ||
        executeArchiveMut.isPending ||
        previewRestoreMut.isPending ||
        executeRestoreMut.isPending;

    const restoreDatesValid = Boolean(restoreStart && restoreEnd && new Date(restoreStart) < new Date(restoreEnd));

    const skeleton = (w = 'w-12') => (
        <span className={`inline-block h-4 ${w} rounded bg-slate-800/80 animate-pulse`} />
    );

    return (
        <div className={DATAHUB_SHELL}>
            {/* Explanation */}
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 mb-5">
                <h3 className="text-sm font-semibold text-foreground mb-1">{t('data_archiving')}</h3>
                <p className="text-[11px] text-muted-foreground max-w-3xl">{t('archiving_explanation_p2')}</p>
                <p className="text-[10px] text-amber-200/90 mt-2">{t('archiving_scheduler_note_p2')}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{t('archiving_maintenance_note_p2')}</p>
            </div>

            {/* Lifecycle */}
            <div className="rounded-xl border border-white/5 bg-slate-950/60 px-4 py-3 mb-5">
                <p className="text-[10px] text-muted-foreground">{t('archiving_lifecycle_p2')}</p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mb-5">
                <MetricCard
                    label={t('archiving_active_records')}
                    value={isLoading ? skeleton() : summary.active}
                    color="blue"
                />
                <MetricCard
                    label={t('archiving_archived_records')}
                    value={isLoading ? skeleton() : summary.archived}
                    color="purple"
                />
                <MetricCard
                    label={t('archiving_pending')}
                    value={isLoading ? skeleton() : summary.pending}
                    color={summary.pending > 0 ? 'amber' : 'blue'}
                />
                <MetricCard
                    label={t('archiving_last_run')}
                    value={isLoading ? skeleton('w-24') : summary.lastRun}
                    color="blue"
                />
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">{t('status')}</p>
                    {isLoading ? (
                        skeleton('w-20')
                    ) : (
                        <StatusPill
                            label={archiveHealthLabel(String(statusCode), t)}
                            variant={archiveHealthVariant(String(statusCode))}
                        />
                    )}
                </div>
            </div>

            {queryError && (
                <div className="mb-4">
                    <DataHubAlert
                        variant={queryError.variant}
                        message={queryError.message}
                        onRetry={queryError.retryable ? () => void refetch() : undefined}
                        retryLabel={t('retry')}
                    />
                </div>
            )}

            {mutationError ? (
                <div className="mb-4">
                    <DataHubAlert variant={mutationError.variant} message={mutationError.message} />
                </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Archive panel */}
                <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 space-y-3">
                    <h4 className="text-sm font-semibold">{t('archiving_run_archive')}</h4>
                    <p className="text-[10px] text-muted-foreground">{t('archiving_apply_safety_note')}</p>
                    <label className="text-[11px] text-muted-foreground block">
                        {t('archiving_days_old')}: {daysOld}
                        <input
                            type="range"
                            min={30}
                            max={365}
                            value={daysOld}
                            onChange={e => setDaysOld(Number(e.target.value))}
                            className="w-full mt-1"
                        />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={wg(busy).disabled}
                            title={wg(busy).title}
                            onClick={async () => {
                                const r = await previewArchiveMut.mutateAsync(daysOld);
                                setArchivePreview(r as Record<string, unknown>);
                            }}
                            className={`${BTN_SECONDARY} disabled:opacity-50`}
                        >
                            {t('archiving_dry_run')}
                        </button>
                        <button
                            type="button"
                            disabled={wg(busy).disabled}
                            title={wg(busy).title}
                            onClick={() => setShowArchiveConfirm(true)}
                            className={`${BTN_PRIMARY} disabled:opacity-50`}
                        >
                            {t('archiving_apply')}
                        </button>
                    </div>
                    {archivePreview ? (
                        <p className="text-[11px] text-muted-foreground">
                            {t('archiving_preview_result')}: {String(archivePreview.pending_count ?? 0)}{' '}
                            {t('records')}
                        </p>
                    ) : null}
                    {!isLoading && summary.pending === 0 ? (
                        <p className="text-[10px] text-muted-foreground">{t('archiving_no_pending')}</p>
                    ) : null}
                </div>

                {/* Restore panel */}
                <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 space-y-3">
                    <h4 className="text-sm font-semibold">{t('archiving_restore')}</h4>
                    <label className="text-[10px] text-muted-foreground block">
                        {t('archiving_restore_start')}
                        <input
                            type="datetime-local"
                            value={restoreStart}
                            onChange={e => setRestoreStart(e.target.value)}
                            className="w-full text-[11px] bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 mt-1"
                        />
                    </label>
                    <label className="text-[10px] text-muted-foreground block">
                        {t('archiving_restore_end')}
                        <input
                            type="datetime-local"
                            value={restoreEnd}
                            onChange={e => setRestoreEnd(e.target.value)}
                            className="w-full text-[11px] bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 mt-1"
                        />
                    </label>
                    {!restoreDatesValid && (restoreStart || restoreEnd) ? (
                        <p className="text-[10px] text-amber-300">{t('archiving_restore_date_invalid')}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={wg(busy || !restoreDatesValid).disabled}
                            title={wg(busy || !restoreDatesValid).title}
                            onClick={async () => {
                                const r = await previewRestoreMut.mutateAsync({
                                    start_date: new Date(restoreStart).toISOString(),
                                    end_date: new Date(restoreEnd).toISOString(),
                                });
                                setRestorePreview(r as Record<string, unknown>);
                            }}
                            className={`${BTN_SECONDARY} disabled:opacity-50`}
                        >
                            {t('archiving_dry_run')}
                        </button>
                        <button
                            type="button"
                            disabled={wg(busy || !restoreDatesValid).disabled}
                            title={wg(busy || !restoreDatesValid).title}
                            onClick={() => setShowRestoreConfirm(true)}
                            className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                        >
                            {t('restore')}
                        </button>
                    </div>
                    {restorePreview ? (
                        <p className="text-[11px] text-muted-foreground">
                            {t('archiving_preview_result')}: {String(restorePreview.pending_count ?? 0)}
                        </p>
                    ) : null}
                </div>
            </div>

            {/* Purge panel */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h4 className="text-sm font-semibold">{t('archiving_purge_preview')}</h4>
                    <StatusPill label={t('archiving_non_destructive')} variant="info" />
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">{t('archiving_purge_hint')}</p>
                <button
                    type="button"
                    disabled={wg(previewPurgeMut.isPending).disabled}
                    title={wg(previewPurgeMut.isPending).title}
                    onClick={async () => {
                        const r = await previewPurgeMut.mutateAsync({});
                        setPurgePreview(r as Record<string, unknown>);
                    }}
                    className={`${BTN_SECONDARY} disabled:opacity-50`}
                >
                    {t('archiving_purge_count')}
                </button>
                {purgePreview ? (
                    <p className="text-[11px] text-amber-200 mt-2">
                        {String(purgePreview.would_purge_count ?? 0)} — {t('archiving_purge_count_only_msg')}
                    </p>
                ) : null}
            </div>

            {/* Partitions */}
            <div className="mb-6">
                <p className="text-[11px] text-muted-foreground mb-2">{t('archiving_partitions')}</p>
                <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="min-w-full text-xs text-foreground/90">
                        <thead className="border-b border-slate-800 text-[11px] text-muted-foreground bg-slate-950/80">
                            <tr>
                                <th className="px-3 py-2 text-left">{t('archiving_col_partition')}</th>
                                <th className="px-3 py-2 text-left">{t('archiving_col_year')}</th>
                                <th className="px-3 py-2 text-left">{t('archiving_col_date_range')}</th>
                                <th className="px-3 py-2 text-left">{t('archiving_col_rows')}</th>
                                <th className="px-3 py-2 text-left">{t('archiving_col_size')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                                        {t('loading')}
                                    </td>
                                </tr>
                            ) : partitions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-6 text-center">
                                        <DataHubEmpty message={t('archiving_no_partitions')} />
                                    </td>
                                </tr>
                            ) : (
                                partitions.map(p => (
                                    <tr key={p.label} className="border-b border-slate-900/60">
                                        <td className="px-3 py-2 text-[11px]">{partitionDisplayLabel(p)}</td>
                                        <td className="px-3 py-2">{p.year ?? '—'}</td>
                                        <td className="px-3 py-2 text-[10px] text-muted-foreground">
                                            {p.start_date?.slice(0, 10)} → {p.end_date?.slice(0, 10)}
                                        </td>
                                        <td className="px-3 py-2">{p.row_count}</td>
                                        <td className="px-3 py-2">{p.size}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent archived records */}
            <div className="mb-6">
                <p className="text-[11px] text-muted-foreground mb-2">{t('archiving_recent_records')}</p>
                {recordsLoading ? (
                    <p className="text-[11px] text-muted-foreground px-1">{t('loading')}</p>
                ) : records.length === 0 ? (
                    <DataHubEmpty message={t('archiving_empty_records')} />
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="min-w-full text-xs">
                            <thead className="border-b border-slate-800 text-[11px] text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 text-left">ID</th>
                                    <th className="px-3 py-2 text-left">{t('agent')}</th>
                                    <th className="px-3 py-2 text-left">{t('created')}</th>
                                    <th className="px-3 py-2 text-left">{t('archiving_col_archived_at')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.slice(0, 20).map(r => (
                                    <tr key={`${r.id}-${r.created_at}`} className="border-b border-slate-900/60">
                                        <td className="px-3 py-2 font-mono text-[10px]">{r.id.slice(0, 8)}…</td>
                                        <td className="px-3 py-2">{r.agent_id?.slice(0, 8) || '—'}</td>
                                        <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                                        <td className="px-3 py-2">
                                            {r.archived_at ? new Date(r.archived_at).toLocaleString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Operations timeline */}
            <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] text-muted-foreground mb-2">{t('archiving_recent_ops')}</p>
                {operations.length === 0 ? (
                    <DataHubEmpty message={t('archiving_no_operations')} />
                ) : (
                    <div className="space-y-2">
                        {operations.slice(0, 10).map(op => (
                            <div
                                key={op.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-slate-950/50 px-3 py-2"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-medium">{operationLabel(op, t)}</span>
                                    {op.dry_run ? (
                                        <StatusPill label={t('archiving_dry_run_badge')} variant="info" />
                                    ) : null}
                                    <StatusPill
                                        label={op.status === 'success' ? t('successful') : t('failed')}
                                        variant={op.status === 'success' ? 'success' : 'error'}
                                    />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                    {new Date(op.started_at).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showArchiveConfirm ? (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl p-4">
                        <h4 className="text-sm font-semibold mb-2">{t('archiving_confirm_title')}</h4>
                        <p className="text-[11px] text-muted-foreground mb-4">{t('archiving_confirm_archive_desc')}</p>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowArchiveConfirm(false)} className={BTN_SECONDARY}>
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={wg(executeArchiveMut.isPending).disabled}
                                title={wg(executeArchiveMut.isPending).title}
                                onClick={async () => {
                                    await executeArchiveMut.mutateAsync({
                                        days_old: daysOld,
                                        confirm_archive: true,
                                    });
                                    setShowArchiveConfirm(false);
                                    setArchivePreview(null);
                                }}
                                className={`${BTN_PRIMARY} disabled:opacity-50`}
                            >
                                {t('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {showRestoreConfirm ? (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl p-4">
                        <h4 className="text-sm font-semibold mb-2">{t('archiving_restore_confirm_title')}</h4>
                        <p className="text-[11px] text-muted-foreground mb-4">{t('archiving_confirm_restore_desc')}</p>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowRestoreConfirm(false)} className={BTN_SECONDARY}>
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={wg(executeRestoreMut.isPending).disabled}
                                title={wg(executeRestoreMut.isPending).title}
                                onClick={async () => {
                                    await executeRestoreMut.mutateAsync({
                                        start_date: new Date(restoreStart).toISOString(),
                                        end_date: new Date(restoreEnd).toISOString(),
                                        confirm_restore: true,
                                    });
                                    setShowRestoreConfirm(false);
                                    setRestorePreview(null);
                                }}
                                className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-600 text-white disabled:opacity-50"
                            >
                                {t('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default Archiving;
