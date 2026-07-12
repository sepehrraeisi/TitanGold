import React, { useMemo, useState } from 'react';
import DiscoveryRuleModal from '../modals/DiscoveryRuleModal';
import {
    useDiscoveryStatsQuery,
    useDiscoverySuggestionsQuery,
    useDiscoveryRulesQuery,
    useDiscoveryHistoryQuery,
    useDiscoveryScanDetailQuery,
    useUpdateDiscoverySettingsMutation,
    useRunDiscoveryScanMutation,
    useApproveSuggestionMutation,
    useRejectSuggestionMutation,
    useIgnoreSuggestionMutation,
    useCreateDiscoveryRuleMutation,
    useDeleteDiscoveryRuleMutation,
} from '../../../../../../hooks/useDataHubDiscovery';
import type {
    DiscoveryDuplicateDetail,
    DiscoveryScan,
    DiscoverySuggestion,
} from '../../../../../../services/dataHubDiscoveryApi';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';
import { formatDataHubQueryError, safeDynamicT } from '../dataHubI18n';
import { DataHubAlert, DataHubSubTabBar, dataHubWriteGate } from '../dataHubUi';
import { useDataHubPermissions } from '../hooks/useDataHubPermissions';

interface AutoDiscoveryConfigProps {
    t: (key: string) => string;
}

const SHELL =
    'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl p-4 md:p-5';

function statusPill(status: string, t: (k: string) => string) {
    const map: Record<string, string> = {
        pending: 'bg-amber-500/20 text-amber-300',
        approved: 'bg-emerald-500/20 text-emerald-300',
        rejected: 'bg-slate-600/40 text-slate-400',
        duplicate: 'bg-red-500/15 text-red-300',
        ignored: 'bg-slate-500/20 text-slate-400',
    };
    return (
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${map[status] || ''}`}>
            {safeDynamicT(t, 'discovery_status_', status)}
        </span>
    );
}

function formatDuration(startedAt: string, finishedAt?: string | null) {
    if (!finishedAt) return '—';
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function reasonLabel(t: (k: string) => string, reason?: string | null) {
    if (!reason) return '—';
    return safeDynamicT(t, 'discovery_reason_', reason);
}

function DuplicateDetailList({
    details,
    t,
}: {
    details: DiscoveryDuplicateDetail[];
    t: (k: string) => string;
}) {
    if (!details.length) return null;
    return (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            {details.map((d, idx) => (
                <div
                    key={`${d.suggested_url}-${idx}`}
                    className="rounded-lg border border-red-500/15 bg-red-500/5 p-2 text-[10px]"
                >
                    <p className="font-semibold text-red-200">{d.suggested_name}</p>
                    <p className="font-mono text-muted-foreground truncate">{d.suggested_url}</p>
                    <p className="text-muted-foreground mt-1">
                        {t('discovery_matched_source')}:{' '}
                        {d.matched_source_name || d.matched_source_url || '—'}
                    </p>
                    <p>
                        {t('discovery_reason')}: {reasonLabel(t, d.duplicate_reason)} ·{' '}
                        {t('discovery_confidence')}: {d.duplicate_confidence ?? '—'} ·{' '}
                        {d.match_type === 'weak'
                            ? t('discovery_match_weak')
                            : t('discovery_match_exact')}
                    </p>
                </div>
            ))}
        </div>
    );
}

function ScanDetailPanel({
    scanId,
    t,
    onClose,
}: {
    scanId: string;
    t: (k: string) => string;
    onClose: () => void;
}) {
    const { data, isLoading } = useDiscoveryScanDetailQuery(scanId);
    if (isLoading) {
        return <p className="text-[11px] text-muted-foreground py-4">{t('loading')}</p>;
    }
    if (!data) return null;
    return (
        <div className="rounded-xl border border-white/10 bg-slate-950/80 p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold">{t('discovery_scan_details_title')}</h4>
                <button type="button" onClick={onClose} className="text-[10px] text-muted-foreground">
                    {t('cancel')}
                </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] mb-3">
                <div>
                    <span className="text-muted-foreground">{t('discovery_scan_candidates')}</span>
                    <p className="font-semibold">{data.scan.candidates_scanned ?? 0}</p>
                </div>
                <div>
                    <span className="text-muted-foreground">{t('discovery_scan_new_suggestions')}</span>
                    <p className="font-semibold text-emerald-300">{data.scan.added_count}</p>
                </div>
                <div>
                    <span className="text-muted-foreground">{t('discovery_scan_duplicates_skipped')}</span>
                    <p className="font-semibold text-amber-300">{data.scan.duplicate_count}</p>
                </div>
                <div>
                    <span className="text-muted-foreground">{t('discovery_scan_blocked')}</span>
                    <p className="font-semibold">{data.scan.blocked_count}</p>
                </div>
            </div>
            <DuplicateDetailList details={data.duplicate_details} t={t} />
        </div>
    );
}

function HistoryTable({
    scans,
    t,
    onViewDetails,
}: {
    scans: DiscoveryScan[];
    t: (k: string) => string;
    onViewDetails: (id: string) => void;
}) {
    if (!scans.length) {
        return (
            <p className="text-[11px] text-muted-foreground py-6 text-center">
                {t('discovery_history_empty')}
            </p>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
                <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/10">
                        <th className="py-2 pr-2">{t('discovery_history_scan_time')}</th>
                        <th className="py-2 pr-2">{t('discovery_history_duration')}</th>
                        <th className="py-2 pr-2">{t('discovery_history_status')}</th>
                        <th className="py-2 pr-2">{t('discovery_history_candidates')}</th>
                        <th className="py-2 pr-2">{t('discovery_history_suggestions')}</th>
                        <th className="py-2 pr-2">{t('discovery_history_duplicates')}</th>
                        <th className="py-2 pr-2">{t('discovery_history_blocked')}</th>
                        <th className="py-2 pr-2">{t('discovery_history_errors')}</th>
                        <th className="py-2" />
                    </tr>
                </thead>
                <tbody>
                    {scans.map(scan => (
                        <tr key={scan.id} className="border-b border-white/5">
                            <td className="py-2 pr-2 whitespace-nowrap">
                                {new Date(scan.started_at).toLocaleString()}
                            </td>
                            <td className="py-2 pr-2">
                                {formatDuration(scan.started_at, scan.finished_at)}
                            </td>
                            <td className="py-2 pr-2">{scan.status}</td>
                            <td className="py-2 pr-2">{scan.candidates_scanned ?? '—'}</td>
                            <td className="py-2 pr-2">{scan.added_count}</td>
                            <td className="py-2 pr-2">{scan.duplicate_count}</td>
                            <td className="py-2 pr-2">{scan.blocked_count}</td>
                            <td className="py-2 pr-2 truncate max-w-[120px]">
                                {scan.error_message || '—'}
                            </td>
                            <td className="py-2">
                                <button
                                    type="button"
                                    onClick={() => onViewDetails(scan.id)}
                                    className="text-purple-300 hover:underline"
                                >
                                    {t('discovery_history_view')}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const AutoDiscoveryConfig: React.FC<AutoDiscoveryConfigProps> = ({ t }) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const { data: stats, isLoading: statsLoading, error: statsError, refetch } = useDiscoveryStatsQuery();
    const { data: pending = [], isLoading: sugLoading, error: suggestionsError } =
        useDiscoverySuggestionsQuery('pending');
    const { data: rules = [] } = useDiscoveryRulesQuery();
    const { data: history = [], isLoading: historyLoading } = useDiscoveryHistoryQuery(20);

    const settingsMut = useUpdateDiscoverySettingsMutation();
    const scanMut = useRunDiscoveryScanMutation();
    const approveMut = useApproveSuggestionMutation();
    const rejectMut = useRejectSuggestionMutation();
    const ignoreMut = useIgnoreSuggestionMutation();
    const createRuleMut = useCreateDiscoveryRuleMutation();
    const deleteRuleMut = useDeleteDiscoveryRuleMutation();

    const [activeTab, setActiveTab] = useState<'discovered' | 'rules' | 'history'>('discovered');
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');
    const [detailScanId, setDetailScanId] = useState<string | null>(null);
    const [showScanDetails, setShowScanDetails] = useState(false);

    const apiError =
        [scanMut.error, approveMut.error, rejectMut.error, ignoreMut.error].find(
            e => e instanceof DataHubApiError,
        ) as DataHubApiError | undefined;

    const queryError = formatDataHubQueryError(
        t,
        (statsError as Error | null) || (suggestionsError as Error | null),
    );

    const mutationError = apiError
        ? apiError.status === 409 &&
          (apiError.body?.code === 'DUPLICATE_ACTIVE_URL' ||
              apiError.body?.code === 'DUPLICATE_ACTIVE_TELEGRAM')
            ? { message: t('discovery_approve_duplicate_error'), variant: 'error' as const }
            : formatDataHubQueryError(t, apiError)
        : null;

    const isLoading = statsLoading || sugLoading;
    const noRulesWarning = rules.length === 0;

    const handleApprove = async (s: DiscoverySuggestion) => {
        await approveMut.mutateAsync({ id: s.id, name: s.suggested_name });
    };

    const handleReject = async (id: string) => {
        await rejectMut.mutateAsync({ id, review_note: rejectNote || undefined });
        setRejectingId(null);
        setRejectNote('');
    };

    const handleIgnore = async (id: string) => {
        await ignoreMut.mutateAsync({ id });
    };

    const sortedPending = useMemo(
        () => [...pending].sort((a, b) => b.priority_score - a.priority_score),
        [pending],
    );

    return (
        <div className={SHELL}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground">
                        {t('auto_discovery')}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
                        {t('auto_discovery_desc')}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={stats?.settings?.enabled ?? false}
                            disabled={wg(settingsMut.isPending).disabled}
                            title={wg(settingsMut.isPending).title}
                            onChange={e => canWrite && settingsMut.mutate(e.target.checked)}
                            className="rounded"
                        />
                        {t('discovery_enabled')}
                    </label>
                    <button
                        type="button"
                        onClick={() => scanMut.mutate()}
                        disabled={wg(scanMut.isPending || !stats?.settings?.enabled).disabled}
                        title={wg(scanMut.isPending || !stats?.settings?.enabled).title}
                        className="text-[11px] px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                    >
                        {scanMut.isPending ? t('loading') : t('run_discovery_btn')}
                    </button>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-white/10"
                    >
                        {t('refresh')}
                    </button>
                </div>
            </div>

            {noRulesWarning ? (
                <div className="mb-4 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    {t('discovery_no_rules_warning')}
                </div>
            ) : null}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-6">
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3">
                    <p className="text-[11px] text-purple-300/80 mb-1">{t('discovery_rules')}</p>
                    <p className="text-sm font-semibold text-purple-100">{rules.length}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3">
                    <p className="text-[11px] text-amber-300/80 mb-1">{t('pending_approval')}</p>
                    <p className="text-sm font-semibold text-amber-100">{stats?.pending ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3">
                    <p className="text-[11px] text-emerald-300/80 mb-1">{t('discovery_approved')}</p>
                    <p className="text-sm font-semibold text-emerald-100">{stats?.approved ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent p-3">
                    <p className="text-[11px] text-slate-300/80 mb-1">{t('last_scan')}</p>
                    <p className="text-[11px] font-semibold text-slate-100 truncate">
                        {stats?.settings?.last_scan_at
                            ? new Date(stats.settings.last_scan_at).toLocaleString()
                            : t('discovery_never')}
                    </p>
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
                <div className="mb-4 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {mutationError.message}
                </div>
            ) : null}

            {scanMut.data ? (
                <div className="mb-4 text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    <p className="font-semibold mb-2">{t('discovery_scan_result')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                            <span className="text-muted-foreground">{t('discovery_scan_candidates')}</span>
                            <p className="font-semibold">{scanMut.data.candidates_scanned}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">
                                {t('discovery_scan_new_suggestions')}
                            </span>
                            <p className="font-semibold">{scanMut.data.added}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">
                                {t('discovery_scan_duplicates_skipped')}
                            </span>
                            <p className="font-semibold">{scanMut.data.duplicates}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">{t('discovery_scan_blocked')}</span>
                            <p className="font-semibold">{scanMut.data.blocked}</p>
                        </div>
                    </div>
                    {scanMut.data.duplicate_details?.length ? (
                        <>
                            <button
                                type="button"
                                className="mt-2 text-purple-300 hover:underline"
                                onClick={() => setShowScanDetails(v => !v)}
                            >
                                {t('discovery_view_details')}
                            </button>
                            {showScanDetails ? (
                                <DuplicateDetailList
                                    details={scanMut.data.duplicate_details}
                                    t={t}
                                />
                            ) : null}
                        </>
                    ) : null}
                </div>
            ) : null}

            {detailScanId ? (
                <ScanDetailPanel
                    scanId={detailScanId}
                    t={t}
                    onClose={() => setDetailScanId(null)}
                />
            ) : null}

            <DataHubSubTabBar
                className="mb-4"
                ariaLabel={t('auto_discovery') || 'Auto discovery'}
                activeId={activeTab}
                onChange={id => setActiveTab(id as typeof activeTab)}
                items={(['discovered', 'rules', 'history'] as const).map(tab => ({
                    id: tab,
                    label: safeDynamicT(t, 'discovery_tab_', tab),
                }))}
            />

            {activeTab === 'discovered' && (
                <div className="space-y-2">
                    {isLoading ? (
                        <p className="text-[11px] text-muted-foreground py-8 text-center">{t('loading')}</p>
                    ) : sortedPending.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <p className="text-sm font-medium">{t('discovery_empty_title')}</p>
                            <p className="text-[11px] mt-1">{t('discovery_empty_hint')}</p>
                        </div>
                    ) : (
                        sortedPending.map(s => (
                            <div
                                key={s.id}
                                className="rounded-xl border border-white/5 bg-slate-900/50 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold">{s.suggested_name}</span>
                                        {statusPill(s.status, t)}
                                        <span className="text-[10px] text-purple-300">
                                            {t('discovery_score')}: {s.priority_score}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                                        {s.suggested_url}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {t('discovery_discovered_via')}:{' '}
                                        {safeDynamicT(t, 'discovery_source_', s.discovery_source)} ·{' '}
                                        {s.suggested_type} · {s.category}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {new Date(s.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleApprove(s)}
                                        disabled={wg(approveMut.isPending).disabled}
                                        title={wg(approveMut.isPending).title}
                                        className="text-[11px] px-3 py-1 rounded-full bg-emerald-600/90 text-white"
                                    >
                                        {t('discovery_approve')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRejectingId(s.id)}
                                        disabled={wg().disabled}
                                        title={wg().title}
                                        className="text-[11px] px-3 py-1 rounded-full border border-red-500/40 text-red-300"
                                    >
                                        {t('discovery_reject')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleIgnore(s.id)}
                                        disabled={wg(ignoreMut.isPending).disabled}
                                        title={wg(ignoreMut.isPending).title}
                                        className="text-[11px] px-3 py-1 rounded-full border border-white/20 text-slate-300"
                                    >
                                        {t('discovery_ignore')}
                                    </button>
                                </div>
                                {rejectingId === s.id ? (
                                    <div className="w-full flex gap-2 mt-2">
                                        <input
                                            value={rejectNote}
                                            onChange={e => setRejectNote(e.target.value)}
                                            placeholder={t('discovery_review_note')}
                                            className="flex-1 text-[11px] rounded-lg border border-white/10 bg-slate-950 px-2 py-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleReject(s.id)}
                                            disabled={wg().disabled}
                                            title={wg().title}
                                            className="text-[11px] px-2 py-1 rounded-full bg-red-600/80 text-white"
                                        >
                                            {t('confirm')}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'rules' && (
                <div>
                    <div className="flex justify-between mb-3">
                        <p className="text-[11px] text-muted-foreground">{t('discovery_rules_desc')}</p>
                        <button
                            type="button"
                            onClick={() => setShowRuleModal(true)}
                            disabled={wg().disabled}
                            title={wg().title}
                            className="text-[11px] px-3 py-1 rounded-full bg-purple-600 text-white disabled:opacity-50"
                        >
                            {t('discovery_rule_add')}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {rules.map(rule => (
                            <div
                                key={rule.id}
                                className="rounded-xl border border-white/5 p-3 bg-slate-900/40"
                            >
                                <div className="flex justify-between">
                                    <span className="text-sm font-semibold">{rule.name}</span>
                                    <button
                                        type="button"
                                        disabled={wg().disabled}
                                        title={wg().title}
                                        onClick={() => {
                                            if (!canWrite) return;
                                            if (window.confirm(t('discovery_rule_delete_confirm'))) {
                                                deleteRuleMut.mutate(rule.id);
                                            }
                                        }}
                                        className="text-[10px] text-red-300 disabled:opacity-50"
                                    >
                                        {t('delete')}
                                    </button>
                                </div>
                                <code className="text-[10px] font-mono text-muted-foreground block mt-1 truncate">
                                    {rule.pattern}
                                </code>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div>
                    <p className="text-[11px] text-muted-foreground mb-3">{t('discovery_history_hint')}</p>
                    {historyLoading ? (
                        <p className="text-[11px] text-muted-foreground py-6 text-center">{t('loading')}</p>
                    ) : (
                        <HistoryTable
                            scans={history}
                            t={t}
                            onViewDetails={id => {
                                setDetailScanId(id);
                                setActiveTab('history');
                            }}
                        />
                    )}
                </div>
            )}

            {showRuleModal ? (
                <DiscoveryRuleModal
                    onClose={() => setShowRuleModal(false)}
                    onSave={async payload => {
                        await createRuleMut.mutateAsync(payload);
                        setShowRuleModal(false);
                    }}
                    isSaving={createRuleMut.isPending}
                    t={t}
                />
            ) : null}
        </div>
    );
};

export default AutoDiscoveryConfig;
