
import React, { useMemo, useState } from 'react';
import AccessControlModal from '../modals/AccessControlModal';
import {
    useAccessControlListQuery,
    useUpsertAccessControlMutation,
    useResetAccessControlMutation,
} from '../../../../../../hooks/useAccessControl';
import type { SourceAccessControlUi } from '../../../../../../services/accessControlApi';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';
import { formatApiErrorForUi } from '../dataHubI18n';
import { dataHubWriteGate } from '../dataHubUi';
import { useDataHubPermissions } from '../hooks/useDataHubPermissions';

interface AccessControlPanelProps {
    t: (key: string) => string;
}

const SHELL =
    'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl p-4 md:p-5';

const AccessControlPanel: React.FC<AccessControlPanelProps> = ({ t }) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const { data: rules = [], isLoading, error, refetch } = useAccessControlListQuery();
    const upsert = useUpsertAccessControlMutation();
    const reset = useResetAccessControlMutation();

    const [searchTerm, setSearchTerm] = useState('');
    const [editing, setEditing] = useState<SourceAccessControlUi | null>(null);

    const metrics = useMemo(() => {
        const custom = rules.filter(r => r.hasCustomRule);
        const restricted = custom.filter(
            r => (r.allowedAgents?.length || 0) > 0 || (r.maxRequestsPerMinute || 0) > 0,
        );
        return {
            totalSources: rules.length,
            customRules: custom.length,
            restricted: restricted.length,
        };
    }, [rules]);

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return rules;
        return rules.filter(
            r =>
                (r.sourceName || '').toLowerCase().includes(q) ||
                (r.sourceCategory || '').toLowerCase().includes(q) ||
                (r.sourceType || '').toLowerCase().includes(q),
        );
    }, [rules, searchTerm]);

    const apiError =
        error instanceof DataHubApiError
            ? formatApiErrorForUi(t, error.message)
            : error instanceof Error
              ? formatApiErrorForUi(t, error.message)
              : null;

    const handleSave = async (data: {
        sourceId: string;
        allowedAgents: string[];
        blockedAgents: string[];
        allowedDataTypes: string[];
        requireAuth: boolean;
        maxRequestsPerMinute?: number;
    }) => {
        await upsert.mutateAsync({
            sourceId: data.sourceId,
            payload: {
                allowed_agents: data.allowedAgents,
                blocked_agents: data.blockedAgents,
                allowed_data_types: data.allowedDataTypes,
                require_auth: data.requireAuth,
                max_requests_per_minute: data.maxRequestsPerMinute ?? 0,
            },
        });
        setEditing(null);
    };

    const handleReset = async (sourceId: string) => {
        if (!window.confirm(t('access_reset_confirm') || 'Reset access rules for this source?')) {
            return;
        }
        await reset.mutateAsync(sourceId);
    };

    return (
        <div className={SHELL}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground flex items-center gap-2">
                        {t('access_control')}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
                        {t('access_control_desc')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isLoading}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-sm disabled:opacity-50"
                >
                    {isLoading ? t('refreshing') : t('refresh')}
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 mb-6">
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-blue-300/80 mb-1">{t('access_metric_sources')}</p>
                    <p className="text-sm font-semibold text-blue-100">{metrics.totalSources}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-purple-300/80 mb-1">{t('access_metric_rules')}</p>
                    <p className="text-sm font-semibold text-purple-100">{metrics.customRules}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3 backdrop-blur-sm col-span-2 md:col-span-1">
                    <p className="text-[11px] text-amber-300/80 mb-1">{t('access_metric_restricted')}</p>
                    <p className="text-sm font-semibold text-amber-100">{metrics.restricted}</p>
                </div>
            </div>

            <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-100">
                {t('access_control_enforcement_notice')}
            </div>

            {apiError && (
                <div className="mb-4 p-2 rounded border border-red-500/30 bg-red-500/10 text-[11px] text-red-100">
                    {apiError}
                </div>
            )}

            <div className="mb-4">
                <label className="text-[11px] text-muted-foreground mb-1 block">
                    {t('search_sources')}
                </label>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={t('search_sources_placeholder')}
                    className="w-full md:max-w-md text-[11px] bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-foreground"
                />
            </div>

            {isLoading && (
                <p className="text-xs text-muted-foreground py-8 text-center">{t('loading')}</p>
            )}

            {!isLoading && filtered.length === 0 && (
                <div className="py-10 text-center text-xs text-muted-foreground bg-slate-900/60 border border-white/5 rounded-lg">
                    {t('access_no_sources')}
                </div>
            )}

            <div className="space-y-3">
                {filtered.map(rule => {
                    const restricted =
                        rule.hasCustomRule &&
                        ((rule.allowedAgents?.length || 0) > 0 || (rule.maxRequestsPerMinute || 0) > 0);
                    return (
                        <div
                            key={rule.sourceId}
                            className="bg-slate-900/60 border border-white/5 rounded-lg p-3 text-xs hover:border-purple-500/30 transition-colors"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-semibold text-foreground truncate">
                                        {rule.sourceName || rule.sourceId}
                                    </h4>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        {rule.sourceType} · {rule.sourceCategory || '—'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                restricted
                                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                                                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
                                            }`}
                                        >
                                            {restricted
                                                ? t('access_status_restricted')
                                                : t('access_status_default')}
                                        </span>
                                        {rule.maxRequestsPerMinute ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/40">
                                                {rule.maxRequestsPerMinute} {t('access_req_per_min')}
                                            </span>
                                        ) : null}
                                        {rule.requireAuth && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/20 text-indigo-200 border border-indigo-400/40">
                                                {t('require_auth')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setEditing(rule)}
                                        disabled={wg().disabled}
                                        title={wg().title}
                                        className="text-[10px] px-2 py-0.5 rounded-full border border-blue-500/60 text-blue-200 hover:bg-blue-500/10 disabled:opacity-50"
                                    >
                                        {t('configure')}
                                    </button>
                                    {rule.hasCustomRule && (
                                        <button
                                            type="button"
                                            onClick={() => handleReset(rule.sourceId)}
                                            disabled={wg(reset.isPending).disabled}
                                            title={wg(reset.isPending).title}
                                            className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/70 text-red-200 hover:bg-red-500/10 disabled:opacity-40"
                                        >
                                            {t('access_reset')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="text-[10px] text-muted-foreground mt-4">
                {t('access_audit_hint')}
            </p>

            {editing && (
                <AccessControlModal
                    sourceId={editing.sourceId}
                    sourceName={editing.sourceName}
                    accessControl={editing}
                    onClose={() => setEditing(null)}
                    onSave={handleSave}
                    isSaving={upsert.isPending}
                    saveDisabled={wg().disabled}
                    saveTitle={wg().title}
                    t={t}
                />
            )}
        </div>
    );
};

export default AccessControlPanel;
