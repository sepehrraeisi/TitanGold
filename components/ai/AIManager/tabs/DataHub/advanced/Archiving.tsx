
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

interface ArchivingProps {
    t: (key: string) => string;
}

const SHELL =
    'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl p-4 md:p-5';

function healthBadge(status: string) {
    const s = String(status || '').toLowerCase();
    if (s === 'ok') return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40';
    if (s.includes('error')) return 'bg-red-500/10 text-red-300 border border-red-500/40';
    return 'bg-amber-500/10 text-amber-300 border border-amber-500/40';
}

const Archiving: React.FC<ArchivingProps> = ({ t }) => {
    const { data: dashboard, isLoading, refetch } = useArchiveStatsQuery();
    const { data: recordsPage } = useArchivedRecordsQuery(0, 50);

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

    const summary = useMemo(
        () => ({
            active: Number(health?.active_records || 0),
            archived: Number(health?.archived_records || 0),
            pending: Number(health?.records_pending_archive || 0),
            status: health?.status || '—',
        }),
        [health],
    );

    const busy =
        isLoading ||
        previewArchiveMut.isPending ||
        executeArchiveMut.isPending ||
        previewRestoreMut.isPending ||
        executeRestoreMut.isPending;

    return (
        <div className={SHELL}>
            <div className="sticky top-0 z-10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 backdrop-blur-sm border-b border-white/10 -mx-4 px-4 py-4 mb-6">
                <h3 className="text-sm md:text-base font-semibold text-foreground">
                    {t('data_archiving') || 'Data Archiving'}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-2xl">
                    {t('archiving_desc_v3') ||
                        'Manual cold storage for ai_decisions. No cron, no auto-delete in v3.0.'}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-blue-300/80 mb-1">{t('archiving_active_records')}</p>
                    <p className="text-sm font-semibold text-blue-100">{summary.active}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-purple-300/80 mb-1">{t('archiving_archived_records')}</p>
                    <p className="text-sm font-semibold text-purple-100">{summary.archived}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-amber-300/80 mb-1">{t('archiving_pending')}</p>
                    <p className="text-sm font-semibold text-amber-100">{summary.pending}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">{t('status')}</p>
                    <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${healthBadge(summary.status)}`}
                    >
                        {summary.status}
                    </span>
                </div>
            </div>

            {apiError ? (
                <div className="mb-4 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                    <span>{apiError.message}</span>
                    <button type="button" onClick={() => void refetch()} className="px-2 py-1 rounded bg-red-500/20">
                        {t('retry')}
                    </button>
                </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 space-y-3">
                    <h4 className="text-sm font-semibold">{t('archiving_run_archive')}</h4>
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
                            disabled={busy}
                            onClick={async () => {
                                const r = await previewArchiveMut.mutateAsync(daysOld);
                                setArchivePreview(r as Record<string, unknown>);
                            }}
                            className="text-[11px] px-3 py-1.5 rounded-full border border-sky-400/70 text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
                        >
                            {t('archiving_dry_run')}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setShowArchiveConfirm(true)}
                            className="text-[11px] px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
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
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 space-y-3">
                    <h4 className="text-sm font-semibold">{t('archiving_restore')}</h4>
                    <input
                        type="datetime-local"
                        value={restoreStart}
                        onChange={e => setRestoreStart(e.target.value)}
                        className="w-full text-[11px] bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5"
                    />
                    <input
                        type="datetime-local"
                        value={restoreEnd}
                        onChange={e => setRestoreEnd(e.target.value)}
                        className="w-full text-[11px] bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5"
                    />
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={busy || !restoreStart || !restoreEnd}
                            onClick={async () => {
                                const r = await previewRestoreMut.mutateAsync({
                                    start_date: new Date(restoreStart).toISOString(),
                                    end_date: new Date(restoreEnd).toISOString(),
                                });
                                setRestorePreview(r as Record<string, unknown>);
                            }}
                            className="text-[11px] px-3 py-1.5 rounded-full border border-sky-400/70 text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
                        >
                            {t('archiving_dry_run')}
                        </button>
                        <button
                            type="button"
                            disabled={busy || !restoreStart || !restoreEnd}
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

            <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 mb-6">
                <h4 className="text-sm font-semibold mb-2">{t('archiving_purge_preview')}</h4>
                <p className="text-[11px] text-muted-foreground mb-2">{t('archiving_purge_hint')}</p>
                <button
                    type="button"
                    disabled={previewPurgeMut.isPending}
                    onClick={async () => {
                        const r = await previewPurgeMut.mutateAsync({});
                        setPurgePreview(r as Record<string, unknown>);
                    }}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-amber-500/60 text-amber-200 hover:bg-amber-500/10"
                >
                    {t('archiving_purge_count')}
                </button>
                {purgePreview ? (
                    <p className="text-[11px] text-amber-200 mt-2">
                        {String(purgePreview.would_purge_count ?? 0)} — {String(purgePreview.message || '')}
                    </p>
                ) : null}
            </div>

            <div className="overflow-x-auto -mx-3 mt-2 mb-6">
                <p className="text-[11px] text-muted-foreground px-3 mb-2">{t('archiving_partitions')}</p>
                <table className="min-w-full text-xs text-foreground/90">
                    <thead className="border-b border-slate-800 text-[11px] text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 text-left">Partition</th>
                            <th className="px-3 py-2 text-left">Rows</th>
                            <th className="px-3 py-2 text-left">Size</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partitions.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                                    {busy ? t('loading') : t('archiving_no_partitions')}
                                </td>
                            </tr>
                        ) : (
                            partitions.map(p => (
                                <tr key={p.partition_name} className="border-b border-slate-900/60">
                                    <td className="px-3 py-2 font-mono text-[11px]">{p.partition_name}</td>
                                    <td className="px-3 py-2">{p.row_count}</td>
                                    <td className="px-3 py-2">{p.size}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="overflow-x-auto -mx-3 mt-2 mb-4">
                <p className="text-[11px] text-muted-foreground px-3 mb-2">{t('archiving_recent_records')}</p>
                <table className="min-w-full text-xs text-foreground/90">
                    <thead className="border-b border-slate-800 text-[11px] text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Agent</th>
                            <th className="px-3 py-2 text-left">Created</th>
                            <th className="px-3 py-2 text-left">Archived</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                                    {t('archiving_empty_records')}
                                </td>
                            </tr>
                        ) : (
                            records.slice(0, 20).map(r => (
                                <tr key={`${r.id}-${r.created_at}`} className="border-b border-slate-900/60">
                                    <td className="px-3 py-2 font-mono text-[10px]">{r.id.slice(0, 8)}…</td>
                                    <td className="px-3 py-2 text-[11px]">{r.agent_id?.slice(0, 8) || '—'}</td>
                                    <td className="px-3 py-2 text-[11px]">
                                        {new Date(r.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-[11px]">
                                        {r.archived_at ? new Date(r.archived_at).toLocaleString() : '—'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="border-t border-white/10 pt-3">
                <p className="text-[11px] text-muted-foreground mb-2">{t('archiving_recent_ops')}</p>
                {operations.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">{t('no_history')}</p>
                ) : (
                    <div className="space-y-1">
                        {operations.slice(0, 8).map(op => (
                            <div
                                key={op.id}
                                className="text-[10px] text-muted-foreground flex justify-between gap-2"
                            >
                                <span>
                                    {op.operation_type}
                                    {op.dry_run ? ' (dry)' : ''} · {op.status}
                                </span>
                                <span>{new Date(op.started_at).toLocaleString()}</span>
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
                            <button
                                type="button"
                                onClick={() => setShowArchiveConfirm(false)}
                                className="text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await executeArchiveMut.mutateAsync({
                                        days_old: daysOld,
                                        confirm_archive: true,
                                    });
                                    setShowArchiveConfirm(false);
                                    setArchivePreview(null);
                                }}
                                className="text-[11px] px-3 py-1.5 rounded-full bg-purple-600 text-white"
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
                            <button
                                type="button"
                                onClick={() => setShowRestoreConfirm(false)}
                                className="text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await executeRestoreMut.mutateAsync({
                                        start_date: new Date(restoreStart).toISOString(),
                                        end_date: new Date(restoreEnd).toISOString(),
                                        confirm_restore: true,
                                    });
                                    setShowRestoreConfirm(false);
                                    setRestorePreview(null);
                                }}
                                className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-600 text-white"
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
