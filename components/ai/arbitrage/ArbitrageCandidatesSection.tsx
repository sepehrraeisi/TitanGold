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
import {
  presentEmptyGroupMessage,
  presentFieldLabel,
  presentFilterLabel,
  presentFunnelLabel,
  presentFreshness,
  presentLifecycle,
  presentPrimaryRejection,
  presentBpsWithLabel,
  presentRiskScore,
  presentSortOption,
  presentTimestamp,
  resolveProductLabel,
  type TranslateFn,
} from '../../../utils/candidatePresentation.ts';

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
    onOpenDetail: (candidate: ArbitrageCoreCandidate) => void;
    t: TranslateFn;
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

const formatTimestamp = (value: string | null | undefined, t: TranslateFn) =>
    presentTimestamp(value, t);

function buildSummaryMetrics(funnel: ArbitrageCoreCandidatesFunnel, t: TranslateFn): AgentMetricItem[] {
    return [
        { id: 'observed', label: presentFunnelLabel('observed', t), value: String(funnel.observed ?? 0) },
        {
            id: 'analytical',
            label: presentFunnelLabel('analyticalCandidates', t),
            value: String(funnel.analyticalCandidates ?? 0),
        },
        { id: 'rejected', label: presentFunnelLabel('rejected', t), value: String(funnel.rejected ?? 0) },
        { id: 'qualified', label: presentFunnelLabel('qualified', t), value: String(funnel.qualified ?? 0) },
        { id: 'expired', label: presentFunnelLabel('expired', t), value: String(funnel.expired ?? 0) },
        { id: 'blocked', label: presentFunnelLabel('blocked', t), value: String(funnel.blocked ?? 0) },
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
    onOpenDetail,
    t,
}) => {
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
        return (
            <AgentLoadingState
                message={resolveProductLabel('loading', t)}
                testId="arb-candidates-loading"
            />
        );
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
                title={resolveProductLabel('tab_arbitrage_candidates', t)}
                subtitle={
                    selectedRun
                        ? `${formatTimestamp(selectedRun.completedAt || selectedRun.startedAt, t)} · ${
                              selectedRun.trigger === 'manual'
                                  ? resolveProductLabel('manual', t)
                                  : resolveProductLabel('scheduled', t)
                          }`
                        : resolveProductLabel('arb_candidates_no_run', t)
                }
                actions={
                    <SecondaryButton type="button" data-testid="arb-candidates-refresh" onClick={onRefresh}>
                        {resolveProductLabel('refresh', t)}
                    </SecondaryButton>
                }
            />

            <div className="space-y-2">
                <label htmlFor="arb-candidates-run-selector" className="text-xs text-muted-foreground">
                    {presentFilterLabel('selectedRun', t)}
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
                            {run.trigger === 'manual'
                                ? resolveProductLabel('manual', t)
                                : resolveProductLabel('scheduled', t)}{' '}
                            · {run.status || resolveProductLabel('completed', t)}
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
                <FilterField label={presentFilterLabel('search', t)}>
                    <input
                        type="search"
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-search"
                        value={filters.search}
                        onChange={e => onFiltersChange({ search: e.target.value, page: 1 })}
                        placeholder={presentFilterLabel('search', t)}
                    />
                </FilterField>
                <FilterField label={presentFilterLabel('lifecycle', t)}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-lifecycle"
                        value={filters.lifecycle}
                        onChange={e => onFiltersChange({ lifecycle: e.target.value, page: 1 })}
                    >
                        <option value="">{resolveProductLabel('all', t)}</option>
                        {(available?.lifecycles ?? []).map(lc => (
                            <option key={lc} value={lc}>
                                {presentLifecycle(lc, t)}
                            </option>
                        ))}
                    </select>
                </FilterField>
                <FilterField label={presentFilterLabel('symbol', t)}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-symbol"
                        value={filters.symbol}
                        onChange={e => onFiltersChange({ symbol: e.target.value, page: 1 })}
                    >
                        <option value="">{resolveProductLabel('all', t)}</option>
                        {(available?.symbols ?? []).map(sym => (
                            <option key={sym} value={sym}>
                                {sym}
                            </option>
                        ))}
                    </select>
                </FilterField>
                <FilterField label={presentFilterLabel('rejection', t)}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-rejection"
                        value={filters.rejectionReason}
                        onChange={e => onFiltersChange({ rejectionReason: e.target.value, page: 1 })}
                    >
                        <option value="">{resolveProductLabel('all', t)}</option>
                        {(available?.rejectionReasons ?? []).map(reason => (
                            <option key={reason} value={reason}>
                                {presentPrimaryRejection(reason, t)}
                            </option>
                        ))}
                    </select>
                </FilterField>
                <FilterField label={presentFilterLabel('freshness', t)}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-freshness"
                        value={filters.freshness}
                        onChange={e => onFiltersChange({ freshness: e.target.value, page: 1 })}
                    >
                        <option value="">{resolveProductLabel('all', t)}</option>
                        {(available?.freshnessStates ?? []).map(state => (
                            <option key={state} value={state}>
                                {presentFreshness(state, t)}
                            </option>
                        ))}
                    </select>
                </FilterField>
                <FilterField label={presentFilterLabel('sort', t)}>
                    <select
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
                        data-testid="arb-candidates-filter-sort"
                        value={filters.sort}
                        onChange={e => onFiltersChange({ sort: e.target.value, page: 1 })}
                    >
                        <option value="observedAt:desc">{presentSortOption('observedAt:desc', t)}</option>
                        <option value="observedAt:asc">{presentSortOption('observedAt:asc', t)}</option>
                        <option value="symbol:asc">{presentSortOption('symbol:asc', t)}</option>
                        <option value="netSpreadBps:desc">{presentSortOption('netSpreadBps:desc', t)}</option>
                        <option value="grossSpreadBps:desc">{presentSortOption('grossSpreadBps:desc', t)}</option>
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
                    message={resolveProductLabel('arb_candidates_empty_run', t)}
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
                                    {resolveProductLabel(group.titleKey, t)} ({groupItems.length})
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
                                            onOpen={() => onOpenDetail(item)}
                                        />
                                    ))}
                                </div>
                            ) : !collapsed && !groupItems.length ? (
                                <p className="text-xs text-muted-foreground mt-2 px-1">
                                    {presentEmptyGroupMessage(t)}
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
    t: TranslateFn;
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
                            <StatusPill
                                label={presentLifecycle(candidate.lifecycleState, t)}
                                variant="info"
                            />
                        </div>
                        {primaryReason ? (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                                {presentPrimaryRejection(primaryReason, t)}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-col sm:items-end gap-1 text-xs text-muted-foreground shrink-0">
                        <span>{presentBpsWithLabel('netSpread', candidate.netSpreadBps, t)}</span>
                        <div className="flex flex-wrap gap-2 items-center">
                            <StatusPill
                                label={presentFreshness(candidate.freshnessState, t)}
                                variant={candidate.freshnessState === 'fresh' ? 'success' : 'warning'}
                            />
                            <span>{presentRiskScore(candidate.riskScore, t)}</span>
                        </div>
                    </div>
                </div>
            </AgentListRow>
        </button>
    );
};

export default ArbitrageCandidatesSection;
