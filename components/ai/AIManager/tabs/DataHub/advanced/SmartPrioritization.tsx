
import React, { useMemo, useState } from 'react';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';
import type { PrioritizationSource } from '../../../../../../services/dataHubPrioritizationApi';
import {
    usePrioritizationSettingsQuery,
    usePrioritizationSourcesQuery,
    usePrioritizationRunsQuery,
    useUpdatePrioritizationSettingsMutation,
    usePreviewPrioritizationMutation,
    useApplyPrioritizationMutation,
    useSetPrioritizationOverrideMutation,
} from '../../../../../../hooks/useDataHubPrioritization';
import { formatDataHubQueryError, safeDynamicT } from '../dataHubI18n';
import { DataHubAlert, dataHubWriteGate } from '../dataHubUi';
import { useDataHubPermissions } from '../hooks/useDataHubPermissions';

interface SmartPrioritizationProps {
    t: (key: string) => string;
}

const SHELL =
    'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl p-4 md:p-5';

function tierPill(tier: string, t: (k: string) => string) {
    const map: Record<string, string> = {
        low: 'bg-red-500/10 text-red-300 border border-red-500/40',
        medium: 'bg-amber-500/10 text-amber-300 border border-amber-500/40',
        high: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40',
        critical: 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/40',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${map[tier] || ''}`}>
            {safeDynamicT(t, 'prioritization_tier_', tier)}
        </span>
    );
}

const SmartPrioritization: React.FC<SmartPrioritizationProps> = ({ t }) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const { data: settings, isLoading: settingsLoading, error: settingsError, refetch } =
        usePrioritizationSettingsQuery();
    const { data: sources = [], isLoading: sourcesLoading, error: sourcesError } = usePrioritizationSourcesQuery();
    const { data: runs = [] } = usePrioritizationRunsQuery();

    const settingsMut = useUpdatePrioritizationSettingsMutation();
    const previewMut = usePreviewPrioritizationMutation();
    const applyMut = useApplyPrioritizationMutation();
    const overrideMut = useSetPrioritizationOverrideMutation();

    const [showConfig, setShowConfig] = useState(false);
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [showApplyConfirm, setShowApplyConfirm] = useState(false);
    const [activeBreakdown, setActiveBreakdown] = useState<PrioritizationSource | null>(null);
    const [overrideSource, setOverrideSource] = useState<PrioritizationSource | null>(null);
    const [overrideValue, setOverrideValue] = useState<number>(50);
    const [overrideNote, setOverrideNote] = useState('');

    const apiError =
        [settingsMut.error, previewMut.error, applyMut.error, overrideMut.error].find(
            e => e instanceof DataHubApiError,
        ) as DataHubApiError | undefined;

    const queryError = formatDataHubQueryError(
        t,
        (settingsError as Error | null) || (sourcesError as Error | null),
    );
    const mutationError = apiError ? formatDataHubQueryError(t, apiError) : null;

    const summary = useMemo(() => {
        const total = sources.length;
        const avg = total > 0 ? sources.reduce((acc, s) => acc + s.final_score, 0) / total : 0;
        return {
            total,
            avg: avg.toFixed(1),
            low: sources.filter(s => s.suggested_tier === 'low').length,
            medium: sources.filter(s => s.suggested_tier === 'medium').length,
            high: sources.filter(s => s.suggested_tier === 'high').length,
            critical: sources.filter(s => s.suggested_tier === 'critical').length,
        };
    }, [sources]);

    const sorted = useMemo(() => [...sources].sort((a, b) => b.final_score - a.final_score), [sources]);
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const isLoading =
        settingsLoading || sourcesLoading || settingsMut.isPending || previewMut.isPending || applyMut.isPending;

    return (
        <div className={SHELL}>
            <div className="sticky top-0 z-10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 backdrop-blur-sm border-b border-white/10 -mx-4 px-4 py-4 mb-6">
                <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground">{t('smart_prioritization')}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
                        {t('prioritization_desc_v3') ||
                            'Preview and manually apply source priorities. No auto-apply in v3.0.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={settings?.is_enabled ?? false}
                            disabled={wg(settingsMut.isPending).disabled}
                            title={wg(settingsMut.isPending).title}
                            onChange={e => {
                                if (!canWrite) return;
                                settingsMut.mutate({
                                    is_enabled: e.target.checked,
                                    factor_weights: settings?.factor_weights || {},
                                    tier_thresholds: settings?.tier_thresholds || {},
                                });
                            }}
                            className="rounded"
                        />
                        {t('prioritization_enabled')}
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            setWeights(settings?.factor_weights || {});
                            setShowConfig(true);
                        }}
                        disabled={wg().disabled}
                        title={wg().title}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-white/10 disabled:opacity-50"
                    >
                        {t('configure')}
                    </button>
                    <button
                        type="button"
                        onClick={() => previewMut.mutate()}
                        disabled={wg(previewMut.isPending || !settings?.is_enabled).disabled}
                        title={wg(previewMut.isPending || !settings?.is_enabled).title}
                        className="text-[11px] px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                    >
                        {previewMut.isPending ? t('loading') : t('prioritization_preview')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowApplyConfirm(true)}
                        disabled={wg(applyMut.isPending || sorted.length === 0).disabled}
                        title={wg(applyMut.isPending || sorted.length === 0).title}
                        className="text-[11px] px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                    >
                        {applyMut.isPending ? t('loading') : t('prioritization_apply')}
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

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mb-5">
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-muted-foreground mb-1">{t('total_sources')}</p>
                    <p className="text-sm font-semibold">{summary.total}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-muted-foreground mb-1">{t('avg_priority')}</p>
                    <p className="text-sm font-semibold">{summary.avg}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-emerald-300/80 mb-1">{t('high')}</p>
                    <p className="text-sm font-semibold text-emerald-100">{summary.high + summary.critical}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-amber-300/80 mb-1">{t('medium')}</p>
                    <p className="text-sm font-semibold text-amber-100">{summary.medium}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent p-3 backdrop-blur-sm">
                    <p className="text-[11px] text-red-300/80 mb-1">{t('low')}</p>
                    <p className="text-sm font-semibold text-red-100">{summary.low}</p>
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
                <div className="mb-4 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                    <span>{mutationError.message}</span>
                    {mutationError.retryable ? (
                        <button
                            type="button"
                            onClick={() => {
                                void refetch();
                            }}
                            className="px-2 py-1 rounded bg-red-500/20"
                        >
                            {t('retry')}
                        </button>
                    ) : null}
                </div>
            ) : null}

            {isLoading ? (
                <p className="text-[11px] text-muted-foreground py-8 text-center">{t('loading')}</p>
            ) : sorted.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm font-medium">{t('prioritization_empty_title')}</p>
                    <p className="text-[11px] mt-1">{t('prioritization_empty_hint')}</p>
                </div>
            ) : (
                <div className="overflow-x-auto -mx-3 mt-2">
                    <table className="min-w-full text-xs text-foreground/90">
                        <thead className="border-b border-slate-800 text-[11px] text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 text-left">Source</th>
                                <th className="px-3 py-2 text-left">Tier</th>
                                <th className="px-3 py-2 text-left">Score</th>
                                <th className="px-3 py-2 text-left">Reliability</th>
                                <th className="px-3 py-2 text-left">Freshness</th>
                                <th className="px-3 py-2 text-left">Health</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map(source => {
                                const b = (source.score_breakdown || {}) as any;
                                const reliability = typeof b.reliability === 'number' ? b.reliability : null;
                                const successRate = typeof b.success_rate === 'number' ? b.success_rate : null;
                                const freshness = typeof b.freshness === 'number' ? b.freshness : null;
                                const errorHealth = typeof b.error_health === 'number' ? b.error_health : null;

                                return (
                                    <tr
                                        key={source.source_id}
                                        className="border-b border-slate-900/60 last:border-0"
                                    >
                                        <td className="px-3 py-2 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-xs font-semibold text-foreground">
                                                        {source.source_name}
                                                    </span>
                                                    {tierPill(source.suggested_tier, t)}
                                                    {source.override_score != null ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200">
                                                            {t('prioritization_override')}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {source.source_type} · {source.category || 'uncategorized'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="text-[11px] text-muted-foreground">
                                                {safeDynamicT(t, 'prioritization_tier_', source.suggested_tier)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-24 rounded-full bg-slate-800 overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-amber-500 to-purple-500"
                                                        style={{
                                                            width: `${Math.max(
                                                                0,
                                                                Math.min(100, source.final_score),
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-[11px] font-semibold text-purple-200">
                                                    {source.final_score.toFixed(1)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-medium">
                                                    {reliability != null ? reliability.toFixed(0) : '—'}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {successRate != null ? `SR ${successRate.toFixed(0)}` : ''}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-medium">
                                                    {freshness != null ? freshness.toFixed(0) : '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-medium">
                                                    {errorHealth != null ? errorHealth.toFixed(0) : '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 align-top text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveBreakdown(source)}
                                                    className="text-[11px] px-2 py-1 rounded-full border border-white/10 text-foreground hover:bg-white/5"
                                                >
                                                    {t('prioritization_breakdown')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOverrideSource(source);
                                                        setOverrideValue(
                                                            Math.round(source.override_score ?? source.final_score ?? 50),
                                                        );
                                                        setOverrideNote(source.override_note || '');
                                                    }}
                                                    disabled={wg().disabled}
                                                    title={wg().title}
                                                    className="text-[11px] px-2 py-1 rounded-full border border-purple-500/40 text-purple-200 hover:bg-purple-500/10 disabled:opacity-50"
                                                >
                                                    {t('override')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-5 border-t border-white/10 pt-3">
                <p className="text-[11px] text-muted-foreground mb-2">{t('prioritization_recent_runs')}</p>
                {runs.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">{t('no_history')}</p>
                ) : (
                    <div className="space-y-1">
                        {runs.slice(0, 5).map(run => (
                            <div
                                key={run.id}
                                className="text-[10px] text-muted-foreground flex items-center justify-between"
                            >
                                <span>
                                    {run.run_type} · {run.source_count} {t('total')}
                                </span>
                                <span>{new Date(run.created_at).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showConfig ? (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl p-4">
                        <h4 className="text-sm font-semibold mb-3">{t('configure_factors')}</h4>
                        <div className="space-y-3">
                            {Object.entries(weights).map(([key, value]) => (
                                <div key={key}>
                                    <label className="block text-[11px] mb-1">
                                        {safeDynamicT(t, 'prioritization_factor_', key)}: {value}
                                    </label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={value}
                                        onChange={e =>
                                            setWeights(prev => ({
                                                ...prev,
                                                [key]: Number(e.target.value),
                                            }))
                                        }
                                        className="w-full"
                                    />
                                </div>
                            ))}
                            <p className="text-[11px] text-muted-foreground">
                                {t('total')}: {totalWeight}%
                            </p>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowConfig(false)}
                                className="text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await settingsMut.mutateAsync({
                                        is_enabled: settings?.is_enabled ?? false,
                                        factor_weights: weights,
                                        tier_thresholds: settings?.tier_thresholds || {},
                                    });
                                    setShowConfig(false);
                                }}
                                disabled={wg(totalWeight !== 100 || settingsMut.isPending).disabled}
                                title={wg(totalWeight !== 100 || settingsMut.isPending).title}
                                className="text-[11px] px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {showApplyConfirm ? (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl p-4">
                        <h4 className="text-sm font-semibold mb-2">{t('prioritization_apply_confirm_title')}</h4>
                        <p className="text-[11px] text-muted-foreground mb-4">
                            {t('prioritization_apply_confirm_desc')}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowApplyConfirm(false)}
                                className="text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await applyMut.mutateAsync({});
                                    setShowApplyConfirm(false);
                                }}
                                className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={wg(applyMut.isPending).disabled}
                                title={wg(applyMut.isPending).title}
                            >
                                {t('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {activeBreakdown ? (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl p-4">
                        <h4 className="text-sm font-semibold mb-1">{t('prioritization_breakdown')}</h4>
                        <p className="text-[11px] text-muted-foreground mb-3">{activeBreakdown.source_name}</p>
                        <div className="space-y-1 max-h-[50vh] overflow-auto">
                            {Object.entries(activeBreakdown.score_breakdown || {}).map(([k, v]) => (
                                <div key={k} className="text-[11px] flex justify-between border-b border-white/5 py-1">
                                    <span>{safeDynamicT(t, 'prioritization_factor_', k)}</span>
                                    <span className="text-purple-200">
                                        {typeof v === 'number' ? v.toFixed(1) : JSON.stringify(v)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setActiveBreakdown(null)}
                                className="text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5"
                            >
                                {t('close') || 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {overrideSource ? (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl p-4">
                        <h4 className="text-sm font-semibold mb-1">{t('prioritization_override_title')}</h4>
                        <p className="text-[11px] text-muted-foreground mb-3">{overrideSource.source_name}</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] mb-1">
                                    {t('prioritization_override_score')}: {overrideValue}
                                </label>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={overrideValue}
                                    onChange={e => setOverrideValue(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                            <textarea
                                value={overrideNote}
                                onChange={e => setOverrideNote(e.target.value)}
                                placeholder={t('prioritization_override_note')}
                                className="w-full min-h-20 text-[11px] rounded-lg border border-white/10 bg-slate-900 px-2 py-2"
                            />
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setOverrideSource(null)}
                                className="text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await overrideMut.mutateAsync({
                                        sourceId: overrideSource.source_id,
                                        override_score: null,
                                        override_note: null,
                                    });
                                    setOverrideSource(null);
                                }}
                                disabled={wg().disabled}
                                title={wg().title}
                                className="text-[11px] px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50"
                            >
                                {t('reset')}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await overrideMut.mutateAsync({
                                        sourceId: overrideSource.source_id,
                                        override_score: overrideValue,
                                        override_note: overrideNote || null,
                                    });
                                    setOverrideSource(null);
                                }}
                                disabled={wg().disabled}
                                title={wg().title}
                                className="text-[11px] px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default SmartPrioritization;
