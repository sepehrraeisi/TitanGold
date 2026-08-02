import React, { useMemo } from 'react';
import type {
  ArbitrageCoreHistoricalSummary,
  ArbitrageCoreRunSummary,
} from '../../../services/api.ts';
import { SecondaryButton, StatusPill } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
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
  presentFieldLabel,
  presentPrimaryOutcome,
  presentScanDuration,
  presentScanFreshness,
  presentScanStatus,
  presentScanTrigger,
  presentSortOption,
  presentDryRunBadge,
  resolveProductLabel,
  type TranslateFn,
} from '../../../utils/scanRunPresentation.ts';

export type HistoryFilters = {
  trigger: string;
  status: string;
  search: string;
  sort: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
};

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  trigger: '',
  status: '',
  search: '',
  sort: 'startedAt:desc',
  dateFrom: '',
  dateTo: '',
  page: 1,
  pageSize: 20,
};

export type ArbitrageScanHistorySectionProps = {
  runs: ArbitrageCoreRunSummary[];
  total: number;
  summary: ArbitrageCoreHistoricalSummary | null;
  generatedAt: string | null;
  loading: boolean;
  error: string | null;
  filters: HistoryFilters;
  availableFilters?: { triggers: string[]; statuses: string[] };
  onFiltersChange: (next: Partial<HistoryFilters>) => void;
  onRefresh: () => void;
  onOpenDetail: (run: ArbitrageCoreRunSummary) => void;
  t: TranslateFn;
};

const formatTimestamp = (value: string | null | undefined, t: TranslateFn) => {
  if (!value) return resolveProductLabel('arb_timestamp_unavailable', t);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return resolveProductLabel('arb_timestamp_unavailable', t);
  return d.toLocaleString();
};

function buildSummaryMetrics(
  summary: ArbitrageCoreHistoricalSummary | null,
  total: number,
  t: TranslateFn,
): AgentMetricItem[] {
  return [
    { id: 'total', label: resolveProductLabel('arb_history_total_runs', t), value: String(summary?.totalScanRuns ?? total ?? 0) },
    { id: 'completed', label: resolveProductLabel('arb_history_completed', t), value: String(summary?.successfulRuns ?? 0) },
    { id: 'failed', label: resolveProductLabel('arb_history_failed', t), value: String(summary?.failedRuns ?? 0) },
    { id: 'manual', label: resolveProductLabel('manual', t), value: String(summary?.manualRuns ?? 0) },
    { id: 'scheduled', label: resolveProductLabel('scheduled', t), value: String(summary?.scheduledRuns ?? 0) },
    {
      id: 'latest',
      label: resolveProductLabel('arb_history_latest_success', t),
      value: summary?.latestSuccessfulRunAt
        ? formatTimestamp(summary.latestSuccessfulRunAt, t)
        : resolveProductLabel('unavailable', t),
    },
  ];
}

export const ArbitrageScanHistorySection: React.FC<ArbitrageScanHistorySectionProps> = ({
  runs,
  total,
  summary,
  generatedAt,
  loading,
  error,
  filters,
  availableFilters,
  onFiltersChange,
  onRefresh,
  onOpenDetail,
  t,
}) => {
  const metrics = useMemo(() => buildSummaryMetrics(summary, total, t), [summary, total, t]);

  if (loading && !runs.length && !error) {
    return (
      <AgentLoadingState message={resolveProductLabel('loading', t)} testId="arb-history-loading" />
    );
  }

  if (error && !runs.length) {
    return (
      <AgentErrorState
        message={error}
        onRetry={onRefresh}
        retryLabel={t('retry') || 'Retry'}
        testId="arb-history-error"
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="space-y-5" data-testid="arb-history-section">
      <AgentSectionHeader
        title={resolveProductLabel('tab_scan_history', t)}
        subtitle={
          generatedAt
            ? `${resolveProductLabel('arb_history_refreshed_at', t)}: ${formatTimestamp(generatedAt, t)}`
            : resolveProductLabel('arb_history_analytical_only_product', t)
        }
        actions={
          <SecondaryButton type="button" data-testid="arb-history-refresh" onClick={onRefresh}>
            {resolveProductLabel('refresh', t)}
          </SecondaryButton>
        }
      />

      <p className="text-xs text-muted-foreground" data-testid="arb-history-product-note">
        {resolveProductLabel('arb_history_available_records_note', t)}
      </p>

      <AgentMetricGrid metrics={metrics} testId="arb-history-summary" />

      <div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
        data-testid="arb-history-filters"
      >
        <FilterField label={resolveProductLabel('arb_history_filter_trigger', t)}>
          <select
            className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
            data-testid="arb-history-filter-trigger"
            value={filters.trigger}
            onChange={e => onFiltersChange({ trigger: e.target.value, page: 1 })}
          >
            <option value="">{resolveProductLabel('all', t)}</option>
            {(availableFilters?.triggers ?? ['manual', 'scheduled']).map(tr => (
              <option key={tr} value={tr}>
                {presentScanTrigger(tr, t)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label={resolveProductLabel('arb_history_filter_status', t)}>
          <select
            className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
            data-testid="arb-history-filter-status"
            value={filters.status}
            onChange={e => onFiltersChange({ status: e.target.value, page: 1 })}
          >
            <option value="">{resolveProductLabel('all', t)}</option>
            {(availableFilters?.statuses ?? ['completed', 'failed']).map(st => (
              <option key={st} value={st}>
                {presentScanStatus(st, t)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label={resolveProductLabel('arb_history_search_run', t)}>
          <input
            type="search"
            className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
            data-testid="arb-history-filter-search"
            value={filters.search}
            onChange={e => onFiltersChange({ search: e.target.value, page: 1 })}
            placeholder={resolveProductLabel('arb_history_search_run', t)}
          />
        </FilterField>
        <FilterField label={resolveProductLabel('sort', t)}>
          <select
            className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
            data-testid="arb-history-filter-sort"
            value={filters.sort}
            onChange={e => onFiltersChange({ sort: e.target.value, page: 1 })}
          >
            <option value="startedAt:desc">{presentSortOption('startedAt:desc', t)}</option>
            <option value="startedAt:asc">{presentSortOption('startedAt:asc', t)}</option>
            <option value="completedAt:desc">{presentSortOption('completedAt:desc', t)}</option>
            <option value="completedAt:asc">{presentSortOption('completedAt:asc', t)}</option>
          </select>
        </FilterField>
        <FilterField label={resolveProductLabel('arb_history_date_from', t)}>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
            data-testid="arb-history-filter-date-from"
            value={filters.dateFrom}
            onChange={e => onFiltersChange({ dateFrom: e.target.value, page: 1 })}
          />
        </FilterField>
        <FilterField label={resolveProductLabel('arb_history_date_to', t)}>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
            data-testid="arb-history-filter-date-to"
            value={filters.dateTo}
            onChange={e => onFiltersChange({ dateTo: e.target.value, page: 1 })}
          />
        </FilterField>
      </div>

      {error ? (
        <AgentErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('retry') || 'Retry'}
          testId="arb-history-partial-error"
        />
      ) : null}

      {!loading && !runs.length && !error ? (
        <AgentEmptyState
          message={resolveProductLabel('arbitrage_no_scan_history', t)}
          testId="arb-history-empty"
        />
      ) : null}

      <div className="space-y-2" data-testid="arb-history-list">
        {runs.map(run => (
          <HistoryRow key={run.runId} run={run} t={t} onOpen={() => onOpenDetail(run)} />
        ))}
      </div>

      {total > filters.pageSize ? (
        <div className="flex items-center gap-2" data-testid="arb-history-pagination">
          <SecondaryButton
            type="button"
            disabled={filters.page <= 1}
            onClick={() => onFiltersChange({ page: filters.page - 1 })}
          >
            {t('previous') || 'Previous'}
          </SecondaryButton>
          <span className="text-xs text-muted-foreground">
            {t('page') || 'Page'} {filters.page} / {totalPages}
          </span>
          <SecondaryButton
            type="button"
            disabled={filters.page >= totalPages}
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

const HistoryRow: React.FC<{
  run: ArbitrageCoreRunSummary;
  t: TranslateFn;
  onOpen: () => void;
}> = ({ run, t, onOpen }) => (
  <button
    type="button"
    className="w-full text-left"
    data-testid={`arb-history-row-${run.runId}`}
    onClick={onOpen}
  >
    <AgentListRow testId={`arb-history-row-inner-${run.runId}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">
              <AgentTechnicalLtr>{formatTimestamp(run.completedAt || run.startedAt, t)}</AgentTechnicalLtr>
            </span>
            <StatusPill label={presentScanTrigger(run.trigger, t)} variant="info" />
            <StatusPill
              label={presentScanStatus(run.status, t)}
              variant={run.status === 'failed' ? 'warning' : 'success'}
            />
            {run.dryRun !== false ? (
              <StatusPill label={presentDryRunBadge(t)} variant="info" />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {presentPrimaryOutcome(run, t)}
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-1 text-xs text-muted-foreground shrink-0">
          <span>
            {presentFieldLabel('duration', t)}: {presentScanDuration(run, t)}
          </span>
          <span>
            {resolveProductLabel('symbols_evaluated', t)}: {run.funnel?.symbolsEvaluated ?? run.evaluatedSymbols ?? '—'}
          </span>
          <span>
            {resolveProductLabel('arb_funnel_rejected', t)}: {run.rejectedCount ?? run.funnel?.rejected ?? 0}
          </span>
          <span>{presentScanFreshness(run, t)}</span>
        </div>
      </div>
    </AgentListRow>
  </button>
);

export default ArbitrageScanHistorySection;
