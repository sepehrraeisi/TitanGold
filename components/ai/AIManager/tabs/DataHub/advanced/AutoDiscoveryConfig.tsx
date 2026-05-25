import React, { useMemo, useState } from 'react';
import DiscoveryRuleModal from '../modals/DiscoveryRuleModal';
import {
    useDiscoveryStatsQuery,
    useDiscoverySuggestionsQuery,
    useDiscoveryRulesQuery,
    useUpdateDiscoverySettingsMutation,
    useRunDiscoveryScanMutation,
    useApproveSuggestionMutation,
    useRejectSuggestionMutation,
    useCreateDiscoveryRuleMutation,
    useDeleteDiscoveryRuleMutation,
} from '../../../../../../hooks/useDataHubDiscovery';
import type { DiscoverySuggestion } from '../../../../../../services/dataHubDiscoveryApi';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';

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
    };
    return (
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${map[status] || ''}`}>
            {t(`discovery_status_${status}`)}
        </span>
    );
}

const AutoDiscoveryConfig: React.FC<AutoDiscoveryConfigProps> = ({ t }) => {
    const { data: stats, isLoading: statsLoading, refetch } = useDiscoveryStatsQuery();
    const { data: pending = [], isLoading: sugLoading } = useDiscoverySuggestionsQuery('pending');
    const { data: rules = [] } = useDiscoveryRulesQuery();

    const settingsMut = useUpdateDiscoverySettingsMutation();
    const scanMut = useRunDiscoveryScanMutation();
    const approveMut = useApproveSuggestionMutation();
    const rejectMut = useRejectSuggestionMutation();
    const createRuleMut = useCreateDiscoveryRuleMutation();
    const deleteRuleMut = useDeleteDiscoveryRuleMutation();

    const [activeTab, setActiveTab] = useState<'discovered' | 'rules' | 'history'>('discovered');
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');

    const apiError =
        [scanMut.error, approveMut.error, rejectMut.error].find(e => e instanceof DataHubApiError) as
            | DataHubApiError
            | undefined;

    const isLoading = statsLoading || sugLoading;

    const handleApprove = async (s: DiscoverySuggestion) => {
        await approveMut.mutateAsync({ id: s.id, name: s.suggested_name });
    };

    const handleReject = async (id: string) => {
        await rejectMut.mutateAsync({ id, review_note: rejectNote || undefined });
        setRejectingId(null);
        setRejectNote('');
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
                            disabled={settingsMut.isPending}
                            onChange={e => settingsMut.mutate(e.target.checked)}
                            className="rounded"
                        />
                        {t('discovery_enabled')}
                    </label>
                    <button
                        type="button"
                        onClick={() => scanMut.mutate()}
                        disabled={scanMut.isPending || !stats?.settings?.enabled}
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

            {apiError ? (
                <div className="mb-4 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {apiError.message}
                </div>
            ) : null}

            {scanMut.data ? (
                <div className="mb-4 text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    {t('discovery_scan_result')}: +{scanMut.data.added} · {t('discovery_dup')}{' '}
                    {scanMut.data.duplicates} · {t('discovery_blocked')} {scanMut.data.blocked}
                </div>
            ) : null}

            <div className="flex flex-wrap gap-4 border-b border-white/10 mb-4">
                {(['discovered', 'rules', 'history'] as const).map(tab => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`pb-2 text-[11px] font-bold ${
                            activeTab === tab ? 'text-purple-400' : 'text-muted-foreground'
                        }`}
                    >
                        {t(`discovery_tab_${tab}`)}
                    </button>
                ))}
            </div>

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
                                        {s.discovery_source} · {s.category}
                                    </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleApprove(s)}
                                        disabled={approveMut.isPending}
                                        className="text-[11px] px-3 py-1 rounded-full bg-emerald-600/90 text-white"
                                    >
                                        {t('discovery_approve')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRejectingId(s.id)}
                                        className="text-[11px] px-3 py-1 rounded-full border border-red-500/40 text-red-300"
                                    >
                                        {t('discovery_reject')}
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
                            className="text-[11px] px-3 py-1 rounded-full bg-purple-600 text-white"
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
                                        onClick={() => {
                                            if (window.confirm(t('discovery_rule_delete_confirm'))) {
                                                deleteRuleMut.mutate(rule.id);
                                            }
                                        }}
                                        className="text-[10px] text-red-300"
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
                <p className="text-[11px] text-muted-foreground py-6 text-center">
                    {t('discovery_history_hint')}
                </p>
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
