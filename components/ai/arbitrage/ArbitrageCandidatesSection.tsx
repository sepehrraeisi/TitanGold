import React, { useMemo, useState } from 'react';
import type {
    ArbitrageCoreCandidate,
    ArbitrageCoreCandidatesFunnel,
    ArbitrageCoreCandidatesResponse,
    ArbitrageCoreRunSummary,
} from '../../../services/api.ts';
import {
    SecondaryButton,
    StatusPill,
} from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import {
    AgentEmptyState,
    AgentErrorState,
    AgentListRow,
    AgentLoadingState,
    AgentMetricGrid,
    AgentSectionHeader,
    type AgentMetricItem,
} from '../product/index.ts';
import { formatRejectionReason } from '../../../utils/arbitrageReasonLabels.ts';
import ArbitrageCandidateDetailDialog from './ArbitrageCandidateDetailDialog.tsx';

export type CandidateFilters = {
    lifecycle: string;
    symbol: string;
    rejectionReason: string;
    freshness: string;
    search: string;
    sort: string;
    page: number;
    pageSize: number;
};

export const DEFAULT_CANDIDATE_FILTERS: CandidateFilters = {
    lifecycle: '',
    symbol: '',
    rejectionReason: '',
    freshness: '',
    search: '',
    sort: 'observedAt:desc',
    page: 1,
    pageSize: 20,
};

export type ArbitrageCandidatesSectionProps = {
    data: ArbitrageCoreCandidatesResponse | null;
    recentRuns: ArbitrageCoreRunSummary[];
    selectedRunId?: string;
    loading: boolean;
    error: string | null;
    filters: CandidateFilters;
    onFiltersChange: (next: Partial<CandidateFilters>) => void;
    onRunChange: (runId: string) => void;
    onRefresh: () => void;
    t: (key: string) => string;
};

const LIFECYCLE_GROUPS: Array<{
    id: string;
    titleKey: string;
    lifecycles: string[];
    defaultCollapsed?: boolean;
}> = [
    { id: 'qualified', titleKey: 'qualified_opportunities', lifecycles: ['qualified'] },
    { id: 'analytical', titleKey: 'spread_candidates', lifecycles: ['candidate', 'observed'] },
    { id: 'rejected', titleKey: 'rejected_candidates', lifecycles: ['rejected'], defaultCollapsed: false },
    { id: 'expired', titleKey: 'arb_lifecycle_expired', lifecycles: ['expired'], defaultCollapsed: true },
    { id: 'blocked', titleKey: 'arb_lifecycle_blocked', lifecycles: ['blocked'], defaultCollapsed: true },
];

const formatTimestamp = (value: string | null | undefined, t: (k: string) => string) => {
    if (!value) return t('arb_timestamp_unavailable') || 'Timestamp unavailable';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return t('arb_timestamp_unavailable') || 'Timestamp unavailable';
    return d.toLocaleString();
};

const formatBps = (value: number | null | undefined, t: (k: string) => string) => {
    if (value == null || Number.isNaN(Number(value))) return t('arb_metric_unavailable') || 'Unavailable';
    return `${Number(value).toFixed(2)} bps`;
};

function buildSummaryMetrics(funnel: ArbitrageCoreCandidatesFunnel, t: (k: string) => string): AgentMetricItem[] {
    return [
        { id: 'observed', label: t('arb_funnel_observed') || 'Observed', value: String(funnel.observed ?? 0) },
        {
            id: 'analytical',
            label: t('arb_funnel_analytical_candidates') || 'Analytical candidates',
            value: String(funnel.analyticalCandidates ?? 0),
        },
        { id: 'rejected', label: t('arb_funnel_rejected') || 'Rejected', value: String(funnel.rejected ?? 0) },
        { id: 'qualified', label: t('arb_funnel_qualified') || 'Qualified', value: String(funnel.qualified ?? 0) },
        { id: 'expired', label: t('arb_funnel_expired') || 'Expired', value: String(funnel.expired ?? 0) },
        { id: 'blocked', label: t('arb_funnel_blocked') || 'Blocked', value: String(funnel.blocked ?? 0) },
    ];
}

export const ArbitrageCandidatesSection: React.FC<ArbitrageCandidatesSectionProps> = ({
    data,
    recentRuns,
    selectedRunId,
    loading,
    error,
    filters,
    onFiltersChange,
    onRunChange,
    onRefresh,
    t,
}) => {
    const [detailCandidate, setDetailCandidate] = useState<ArbitrageCoreCandidate | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(LIFECYCLE_GROUPS.map(g => [g.id, Boolean(g.defaultCollapsed)])),
    );

    const selectedRun = data?.selectedRun;
    const funnel = data?.funnel ?? {
        observed: 0,
        analyticalCandidates: 0,
        rejected: 0,
        qualified: 0,
        expired: 0,
        blocked: 0,
    };
    const items = data?.items ?? [];
    const available = data?.availableFilters;

    const groupedItems = useMemo(() => {
        const map: Record<string, ArbitrageCoreCandidate[]> = {};
        for (const group of LIFECYCLE_GROUPS) map[group.id] = [];
        for (const item of items) {
            const group = LIFECYCLE_GROUPS.find(g => g.lifecycles.includes(item.lifecycleState));
            if (group) map[group.id].push(item);
        }
        return map;
    }, [items]);

    if (loading && !data) {
        return <AgentLoadingState message={t('loading') || 'Loading...'} testId="arb-candidates-loading" />;
    }

    if (error && !data) {
        return (
            <AgentErrorState
                message={error}
                onRetry={onRefresh}
                retryLabel={t('retry') || 'Retry'}
                testId="arb-candidates-error"
            />
        );
    }

    const runOptions = recentRuns.length
        ? recentRuns
        : selectedRun
          ? [selectedRun]
          : [];

    return (
        <div className="space-y-5" data-testid="arb-candidates-section">
            <AgentSectionHeader
                title={t('tab_arbitrage_candidates') || 'Candidates'}
                subtitle={
                    selectedRun
                        ? `${formatTimestamp(selectedRun.completedAt || selectedRun.startedAt, t)} · ${
                              selectedRun.trigger === 'manual'
                                  ? t('manual') || 'Manual'
                                  : t('scheduled') || 'Scheduled'
                          }`
                        : t('arb_candidates_no_run') || 'No run selected'
                }
                actions={
                    <SecondaryButton type="button" data-testid="arb-candidates-refresh" onClick={onRefresh}>
                        {t('refresh') || 'Refresh'}
                    </SecondaryButton>
                }
            />

            <div className="space-y-2">
                <label htmlFor="arb-candidates-run-selector" className="text-xs text-muted-foreground">
                    {t('arb_selected_run') || 'Selected run'}
                </label>
                <select
                    id="arb-candidates-run-selector"
                    data-testid="arb-candidates-run-selector"
                    className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                    value={selectedRunId || data?.runId || ''}
                    onChange={e => onRunChange(e.target.value)}
                >
                    {runOptions.map(run => (
                        <option key={run.runId} value={run.runId}>
                            {formatTimestamp(run.completedAt || run.startedAt, t)} ·{' '}
                            {run.trigger === 'manual' ? t('manual') || 'Manual' : t('scheduled') || 'Scheduled'} ·{' '}
                            {run.status || t('completed') || 'Completed'}
                        </option>
                    ))}
                </select>
            </div>

            <AgentMetricGrid
                metrics={buildSummaryMetrics(funnel, t)}
                testId="arb-candidates-summary"
            />

            <div
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                data-testid="arb-candidates-filters"
            >
                <FilterField label={t('search') || 'Search'}>
                    <input
                        type="search"
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-search"
                        value={filters.search}
                        onChange={e => onFiltersChange({ search: e.target.value, page: 1 })}
                        placeholder={t('arb_search_symbol') || 'Search symbol'}
                    />
                </FilterField>
                <FilterField label={t('arb_filter_lifecycle') || 'Lifecycle'}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-lifecycle"
                        value={filters.lifecycle}
                        onChange={e => onFiltersChange({ lifecycle: e.target.value, page: 1 })}
                    >
                        <option value="">{t('all') || 'All'}</option>
                        {(available?.lifecycles ?? []).map(lc => (
                            <option key={lc} value={lc}>
                                {lc}
                            </option>
                        ))}
                    </select>
                </FilterField>
                <FilterField label={t('symbol') || 'Symbol'}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-symbol"
                        value={filters.symbol}
                        onChange={e => onFiltersChange({ symbol: e.target.value, page: 1 })}
                    >
                        <option value="">{t('all') || 'All'}</option>
                        {(available?.symbols ?? []).map(sym => (
                            <option key={sym} value={sym}>
                                {sym}
                            </option>
                        ))}
                    </select>
                </FilterField>
                <FilterField label={t('arb_filter_rejection') || 'Rejection reason'}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-rejection"
                        value={filters.rejectionReason}
                        onChange={e => onFiltersChange({ rejectionReason: e.target.value, page: 1 })}
                    >
                        <option value="">{t('all') || 'All'}</option>
                        {(available?.rejectionReasons ?? []).map(reason => (
                            <option key={reason} value={reason}>
                                {formatRejectionReason(reason, t)}
                            </option>
                        ))}
                    </select>
                </FilterField>
                <FilterField label={t('arb_filter_freshness') || 'Freshness'}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-freshness"
                        value={filters.freshness}
                        onChange={e => onFiltersChange({ freshness: e.target.value, page: 1 })}
                    >
                        <option value="">{t('all') || 'All'}</option>
                        {(available?.freshnessStates ?? []).map(state => (
                            <option key={state} value={state}>
                                {state === 'fresh'
                                    ? t('arb_freshness_fresh') || 'Fresh'
                                    : t('arb_freshness_stale') || 'Stale'}
                            </option>
                        ))}
                    </select>
                </FilterField>
                <FilterField label={t('sort') || 'Sort'}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-sort"
                        value={filters.sort}
                        onChange={e => onFiltersChange({ sort: e.target.value, page: 1 })}
                    >
                        <option value="observedAt:desc">{t('arb_sort_newest') || 'Newest first'}</option>
                        <option value="observedAt:asc">{t('arb_sort_oldest') || 'Oldest first'}</option>
                        <option value="symbol:asc">{t('arb_sort_symbol') || 'Symbol A–Z'}</option>
                        <option value="netSpreadBps:desc">{t('arb_sort_net_spread') || 'Net spread high–low'}</option>
                        <option value="grossSpreadBps:desc">{t('arb_sort_gross_spread') || 'Gross spread high–low'}</option>
                    </select>
                </FilterField>
            </div>

            {error ? (
                <AgentErrorState
                    message={error}
                    onRetry={onRefresh}
                    retryLabel={t('retry') || 'Retry'}
                    testId="arb-candidates-partial-error"
                />
            ) : null}

            {!loading && items.length === 0 && !error ? (
                <AgentEmptyState
                    message={t('arb_candidates_empty_run') || 'No candidates match the current filters for this run.'}
                    testId="arb-candidates-empty"
                />
            ) : null}

            <div className="space-y-4">
                {LIFECYCLE_GROUPS.map(group => {
                    const groupItems = groupedItems[group.id] ?? [];
                    if (!groupItems.length && collapsedGroups[group.id]) return null;
                    const collapsed = collapsedGroups[group.id] ?? false;
                    return (
                        <section key={group.id} data-testid={`arb-candidates-group-${group.id}`}>
                            <button
                                type="button"
                                className="flex w-full items-center justify-between rounded-lg border border-gray-800 px-3 py-2 text-left text-sm font-medium hover:bg-gray-900/50"
                                aria-expanded={!collapsed}
                                onClick={() =>
                                    setCollapsedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))
                                }
                            >
                                <span>
                                    {t(group.titleKey) || group.id} ({groupItems.length})
                                </span>
                                <span aria-hidden>{collapsed ? '▸' : '▾'}</span>
                            </button>
                            {!collapsed && groupItems.length > 0 ? (
                                <div className="mt-2 space-y-2">
                                    {groupItems.map(item => (
                                        <CandidateRow
                                            key={item.candidateId}
                                            candidate={item}
                                            t={t}
                                            onOpen={() => setDetailCandidate(item)}
                                        />
                                    ))}
                                </div>
                            ) : !collapsed && !groupItems.length ? (
                                <p className="text-xs text-muted-foreground mt-2 px-1">
                                    {t('arb_group_empty') || 'No items in this group.'}
                                </p>
                            ) : null}
                        </section>
                    );
                })}
            </div>

            {(data?.total ?? 0) > filters.pageSize ? (
                <div className="flex items-center gap-2" data-testid="arb-candidates-pagination">
                    <SecondaryButton
                        type="button"
                        disabled={filters.page <= 1}
                        onClick={() => onFiltersChange({ page: filters.page - 1 })}
                    >
                        {t('previous') || 'Previous'}
                    </SecondaryButton>
                    <span className="text-xs text-muted-foreground">
                        {t('page') || 'Page'} {filters.page} /{' '}
                        {Math.max(1, Math.ceil((data?.total ?? 0) / filters.pageSize))}
                    </span>
                    <SecondaryButton
                        type="button"
                        disabled={!data?.hasNext}
                        onClick={() => onFiltersChange({ page: filters.page + 1 })}
                    >
                        {t('next') || 'Next'}
                    </SecondaryButton>
                </div>
            ) : null}

            <ArbitrageCandidateDetailDialog
                candidate={detailCandidate}
                open={Boolean(detailCandidate)}
                onClose={() => setDetailCandidate(null)}
                t={t}
            />
        </div>
    );
};

const FilterField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="space-y-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {children}
    </div>
);

const CandidateRow: React.FC<{
    candidate: ArbitrageCoreCandidate;
    t: (key: string) => string;
    onOpen: () => void;
}> = ({ candidate, t, onOpen }) => {
    const primaryReason = candidate.rejectionReasons[0];
    return (
        <button
            type="button"
            className="w-full text-left"
            data-testid={`arb-candidate-row-${candidate.candidateId}`}
            onClick={onOpen}
        >
            <AgentListRow testId={`arb-candidate-row-inner-${candidate.candidateId}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">
                                <AgentTechnicalLtr>{candidate.symbol}</AgentTechnicalLtr>
                            </span>
                            <StatusPill label={candidate.lifecycleState} variant="info" />
                        </div>
                        {primaryReason ? (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                                {formatRejectionReason(primaryReason, t)}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground shrink-0">
                        <span>{formatBps(candidate.grossSpreadBps, t)}</span>
                        <span>{formatBps(candidate.netSpreadBps, t)}</span>
                        <StatusPill
                            label={
                                candidate.freshnessState === 'fresh'
                                    ? t('arb_freshness_fresh') || 'Fresh'
                                    : t('arb_freshness_stale') || 'Stale'
                            }
                            variant={candidate.freshnessState === 'fresh' ? 'success' : 'warning'}
                        />
                        {candidate.riskScore != null ? (
                            <span>
                                {t('risk_score') || 'Risk'}: {candidate.riskScore}
                            </span>
                        ) : null}
                    </div>
                </div>
            </AgentListRow>
        </button>
    );
};

export default ArbitrageCandidatesSection;
