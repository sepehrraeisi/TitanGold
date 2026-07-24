import React from 'react';
import type {
  ArbitrageCoreOverview,
  ArbitrageCoreRunSummary,
} from '../../../services/api.ts';
import {
  SecondaryButton,
  StatusPill,
} from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import {
  AgentContentSurface,
  AgentEmptyState,
  AgentErrorState,
  AgentListRow,
  AgentLoadingState,
  AgentMetricGrid,
  AgentSectionHeader,
  type AgentMetricItem,
} from '../product/index.ts';
import {
  formatInterpretationMessage,
  formatRejectionReason,
  FUNNEL_METRIC_DEFINITIONS,
} from '../../../utils/arbitrageReasonLabels.ts';
import {
  formatScanDuration,
  resolveLatestSuccessfulRunAt,
} from '../../../utils/arbitrageScanTiming.ts';
import type { ArbitrageAgentSection } from '../../../types/navigation.ts';

const NA = (t: (k: string) => string) => t('not_available') || 'N/A';

const formatTimestamp = (value: string | null | undefined, t: (k: string) => string) => {
  if (!value) return NA(t);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NA(t);
  return d.toLocaleString();
};

const formatBps = (value: number | null | undefined, t: (k: string) => string) => {
  if (value == null || Number.isNaN(Number(value))) return NA(t);
  return `${Number(value).toFixed(2)} bps`;
};

export type ArbitrageOverviewSectionProps = {
  overview: ArbitrageCoreOverview | null;
  isLoading: boolean;
  loadError: string | null;
  staleWarning?: boolean;
  onRetry: () => void;
  onOpenTab: (tab: ArbitrageAgentSection, runId?: string) => void;
  t: (key: string) => string;
};

export const ArbitrageOverviewSection: React.FC<ArbitrageOverviewSectionProps> = ({
  overview,
  isLoading,
  loadError,
  staleWarning,
  onRetry,
  onOpenTab,
  t,
}) => {
  if (isLoading && !overview) {
    return <AgentLoadingState message={t('loading') || 'Loading...'} testId="arb-overview-loading" />;
  }

  if (loadError && !overview) {
    return (
      <AgentErrorState
        message={loadError}
        onRetry={onRetry}
        retryLabel={t('retry') || 'Retry'}
        testId="arb-overview-error"
      />
    );
  }

  if (!overview) {
    return (
      <AgentEmptyState
        message={t('arbitrage_overview_data_unavailable') || 'Overview data unavailable.'}
        testId="arb-overview-empty"
      />
    );
  }

  const latestRun = overview.latestRun;
  const funnel = latestRun?.funnel || {};
  const historical = overview.historicalSummary;
  const config = overview.configurationSummary;
  const productState = overview.productState;
  const monitoringPaused = overview.settings?.monitoringState === 'paused';
  const hasHistoricalScans = (historical?.totalScanRuns ?? overview.totalScanRuns) > 0;
  const latestSuccessfulAt =
    overview.runTiming?.latestSuccessfulRunAt ||
    resolveLatestSuccessfulRunAt(historical, latestRun);
  const interpretationText = formatInterpretationMessage(overview.interpretation, t);
  const rejectionEntries = Object.entries(latestRun?.rejectionSummary ?? {}).sort((a, b) => b[1] - a[1]);

  const operationalStatus = monitoringPaused
    ? t('agent_state_paused') || 'Paused'
    : productState?.agentStatus === 'active'
      ? t('operational') || 'Operational'
      : t('limited') || 'Limited';

  const funnelMetrics: AgentMetricItem[] = [
    'symbolsRequested',
    'symbolsEvaluated',
    'rawObservations',
    'analyticalCandidates',
    'rejected',
    'qualified',
    'expired',
    'blocked',
  ].map(key => ({
    id: key,
    label: t(`arb_funnel_${key}`) || key,
    value: funnel[key as keyof typeof funnel] ?? latestRun?.[`${key}` as keyof typeof latestRun] ?? 0,
    title: t(FUNNEL_METRIC_DEFINITIONS[key]) || undefined,
    color:
      key === 'qualified'
        ? 'emerald'
        : key === 'rejected'
          ? 'amber'
          : key === 'blocked'
            ? 'red'
            : 'blue',
    valueState: Number(funnel[key as keyof typeof funnel] ?? 0) === 0 ? 'zero' : 'loaded',
  }));

  return (
    <div className="space-y-5" data-testid="arb-overview">
      {staleWarning ? (
        <p className="text-xs text-amber-300/90" data-testid="arb-overview-stale-warning">
          {t('arb_overview_stale_warning') ||
            'Overview data may have changed. Refresh or reopen to load the latest snapshot.'}
        </p>
      ) : null}
      {overview.generatedAt ? (
        <p className="text-[11px] text-muted-foreground" data-testid="arb-overview-snapshot-at">
          {t('arb_overview_snapshot_at') || 'Snapshot'}:{' '}
          <AgentTechnicalLtr>{formatTimestamp(overview.generatedAt, t)}</AgentTechnicalLtr>
        </p>
      ) : null}

      <AgentContentSurface testId="arb-overview-operational">
        <AgentSectionHeader
          title={t('arb_overview_operational_summary') || 'Operational summary'}
          subtitle={
            productState?.productName ||
            overview.product?.displayName ||
            t('strategy_mexc_spot_spread_monitor')
          }
          actions={
            <StatusPill
              label={operationalStatus}
              variant={monitoringPaused ? 'warning' : 'success'}
            />
          }
        />
        <AgentMetricGrid
          columns="3"
          metrics={[
            {
              id: 'monitoring',
              label: t('monitoring_state') || 'Monitoring',
              value: monitoringPaused
                ? t('pause_monitoring') || 'Paused'
                : t('monitoring_active') || 'Active',
              color: monitoringPaused ? 'amber' : 'emerald',
            },
            {
              id: 'latest-success',
              label: t('arb_overview_latest_successful_scan') || 'Latest successful scan',
              value: formatTimestamp(latestSuccessfulAt, t),
              color: 'blue',
              valueState: latestSuccessfulAt ? 'loaded' : 'unavailable',
            },
            {
              id: 'execution',
              label: t('execution_support') || 'Execution',
              value: t('execution_unsupported') || 'Unavailable',
              color: 'red',
              valueState: 'unavailable',
            },
          ]}
        />
      </AgentContentSurface>

      <AgentContentSurface testId="arb-overview-funnel">
        <AgentSectionHeader
          title={t('arb_overview_candidate_funnel') || 'Candidate funnel'}
          subtitle={t('arb_overview_candidate_funnel_subtitle') || 'Latest scan funnel counts'}
        />
        <AgentMetricGrid metrics={funnelMetrics} columns="4" testId="arb-overview-funnel-grid" />
      </AgentContentSurface>

      <AgentContentSurface testId="arb-overview-latest-scan">
        <AgentSectionHeader
          title={t('arbitrage_overview_latest_scan') || 'Latest scan'}
          subtitle={interpretationText}
          actions={
            latestRun ? (
              <StatusPill
                label={
                  latestRun.status === 'failed'
                    ? t('arbitrage_overview_scan_failed') || 'Failed'
                    : t('completed') || 'Completed'
                }
                variant={latestRun.status === 'failed' ? 'error' : 'info'}
              />
            ) : undefined
          }
        />
        {!hasHistoricalScans ? (
          <AgentEmptyState
            message={
              t('arbitrage_overview_never_scanned_help') ||
              'No analytical scan has completed yet.'
            }
          />
        ) : (
          <>
            <AgentMetricGrid
              columns="3"
              metrics={[
                {
                  id: 'started',
                  label: t('arb_overview_scan_started') || 'Started',
                  value: formatTimestamp(latestRun?.startedAt, t),
                  color: 'blue',
                },
                {
                  id: 'completed',
                  label: t('arb_overview_scan_completed') || 'Completed',
                  value: formatTimestamp(latestRun?.completedAt, t),
                  color: 'blue',
                },
                {
                  id: 'duration',
                  label: t('duration') || 'Duration',
                  value: formatScanDuration(latestRun, t),
                  color: 'purple',
                  valueState:
                    latestRun?.durationAvailability === 'unavailable' ? 'unavailable' : 'loaded',
                },
                {
                  id: 'trigger',
                  label: t('arb_overview_scan_trigger') || 'Trigger',
                  value: latestRun?.trigger
                    ? t(`arb_trigger_${latestRun.trigger}`) || latestRun.trigger
                    : NA(t),
                  color: 'blue',
                },
                {
                  id: 'symbols',
                  label: t('arb_overview_symbol_coverage') || 'Symbol coverage',
                  value: `${latestRun?.symbolsEvaluated?.length ?? funnel.symbolsEvaluated ?? 0}/${latestRun?.symbolsRequested?.length ?? funnel.symbolsRequested ?? 0}`,
                  color: 'purple',
                },
                {
                  id: 'freshness',
                  label: t('arb_overview_data_freshness') || 'Data freshness',
                  value:
                    latestRun?.sourceFreshnessMs != null
                      ? `${latestRun.sourceFreshnessMs} ms`
                      : NA(t),
                  color: 'amber',
                },
              ]}
            />
            {rejectionEntries.length ? (
              <div className="space-y-2" data-testid="arb-overview-rejection-summary">
                <p className={AGENT_SECTION_LABEL}>{t('arbitrage_overview_top_rejections') || 'Top rejection reasons'}</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {rejectionEntries.slice(0, 5).map(([code, count]) => (
                    <li key={code}>
                      {formatRejectionReason(code, t)} —{' '}
                      <AgentTechnicalLtr>{count}</AgentTechnicalLtr>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                type="button"
                onClick={() => onOpenTab('candidates', latestRun?.runId)}
              >
                {t('arbitrage_overview_review_candidates') || 'Review candidates'}
              </SecondaryButton>
              <SecondaryButton
                type="button"
                onClick={() => onOpenTab('history', latestRun?.runId)}
              >
                {t('arbitrage_overview_view_scan_history') || 'View scan history'}
              </SecondaryButton>
            </div>
          </>
        )}
      </AgentContentSurface>

      <AgentContentSurface testId="arb-overview-interpretation">
        <AgentSectionHeader
          title={t('arbitrage_overview_interpretation') || 'Interpretation'}
          subtitle={t('arbitrage_overview_interpretation_subtitle') || 'Data-derived summary'}
        />
        <p className="text-sm text-foreground">{interpretationText}</p>
        <p className="text-xs text-muted-foreground">
          {t('arbitrage_overview_execution_truth') ||
            'A scan is not an execution. Candidates are not automatically opportunities.'}
        </p>
      </AgentContentSurface>

      <AgentContentSurface testId="arb-overview-recent">
        <AgentSectionHeader
          title={t('arb_overview_recent_activity') || 'Recent activity'}
          subtitle={t('arb_overview_recent_activity_subtitle') || 'Last runs at snapshot time'}
        />
        {overview.recentRuns?.length ? (
          <div className="space-y-2">
            {overview.recentRuns.slice(0, 10).map((run: ArbitrageCoreRunSummary) => (
              <AgentListRow key={run.runId} testId={`arb-overview-recent-${run.runId}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <AgentTechnicalLtr>
                      {formatTimestamp(run.completedAt || run.startedAt, t)}
                    </AgentTechnicalLtr>
                    {' · '}
                    {run.status === 'failed'
                      ? t('arbitrage_overview_scan_failed') || 'Failed'
                      : t('completed') || 'Completed'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('qualified_opportunities') || 'Qualified'}: {run.funnel?.qualified ?? 0}
                    {' · '}
                    {t('rejected_candidates') || 'Rejected'}: {run.funnel?.rejected ?? 0}
                    {' · '}
                    {formatScanDuration(run, t)}
                  </span>
                </div>
              </AgentListRow>
            ))}
          </div>
        ) : (
          <AgentEmptyState message={t('arbitrage_overview_never_scanned') || 'Never scanned'} />
        )}
        <p className="text-xs text-muted-foreground" data-testid="arb-overview-total-scans">
          {t('total_scans') || 'Total scans'}: {historical?.totalScanRuns ?? overview.totalScanRuns}
          {' · '}
          {t('arb_overview_successful_runs') || 'Successful'}: {historical?.successfulRuns ?? NA(t)}
          {' · '}
          {t('arb_overview_failed_runs') || 'Failed'}: {historical?.failedRuns ?? NA(t)}
        </p>
      </AgentContentSurface>

      <AgentContentSurface testId="arb-overview-limitations">
        <AgentSectionHeader
          title={t('arb_overview_readiness_limitations') || 'Readiness and limitations'}
          subtitle={t('arb_overview_readiness_subtitle') || 'Supported and unavailable capabilities'}
        />
        <ul className="space-y-1.5 text-sm text-muted-foreground list-disc ps-5">
          <li>{t('arb_limitation_single_venue') || 'Single-venue MEXC spot spread monitor only.'}</li>
          <li>{t('arb_limitation_triangular') || 'Triangular arbitrage is unavailable.'}</li>
          <li>{t('arb_limitation_cross_exchange') || 'Cross-exchange arbitrage is unavailable.'}</li>
          <li>{t('arb_limitation_futures_basis') || 'Futures basis analysis is unavailable.'}</li>
          <li>{t('arb_limitation_execution_blocked') || 'Financial execution is blocked.'}</li>
        </ul>
        {config ? (
          <p className="text-xs text-muted-foreground pt-2" data-testid="arb-overview-config-summary">
            {t('arb_overview_config_summary') || 'Settings'}:{' '}
            {config.monitoredSymbolCount} {t('symbols') || 'symbols'},{' '}
            {t('minimum_net_spread') || 'Min net'} {formatBps(config.minimumNetSpreadBps, t)},{' '}
            {t('arb_overview_max_data_age') || 'Max data age'}{' '}
            <AgentTechnicalLtr>{config.maximumDataAgeMs ?? NA(t)} ms</AgentTechnicalLtr>
          </p>
        ) : null}
      </AgentContentSurface>
    </div>
  );
};

const AGENT_SECTION_LABEL = 'text-[11px] uppercase tracking-wide text-muted-foreground';

export default ArbitrageOverviewSection;
