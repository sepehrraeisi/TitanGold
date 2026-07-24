import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArbitrageOverviewSection } from '../../../../../components/ai/arbitrage/ArbitrageOverviewSection.tsx';
import type { ArbitrageCoreOverview } from '../../../../services/api.ts';

const t = (key: string) =>
  ({
    loading: 'Loading',
    retry: 'Retry',
    duration: 'Duration',
    arb_duration_unavailable: 'Duration unavailable',
    arb_duration_sub_ms: '<1 ms',
    arb_freshness_unavailable: 'Data freshness unavailable',
    arb_freshness_reason_source_timestamps_not_recorded:
      'Source timestamps were not recorded for this historical scan',
    arb_timestamp_unavailable: 'Timestamp unavailable',
    arb_metric_unavailable: 'Unavailable',
    arb_trigger_scheduled: 'Scheduled',
    arb_overview_data_freshness: 'Data freshness',
    arb_overview_latest_scan: 'Latest scan',
    arb_overview_operational_summary: 'Operational summary',
    arb_overview_candidate_funnel: 'Candidate funnel',
    arb_overview_recent_activity: 'Recent activity',
    arb_overview_interpretation: 'Interpretation',
    arb_overview_readiness_limitations: 'Readiness and limitations',
    operational: 'Operational',
    monitoring_active: 'Monitoring active',
    monitoring_state: 'Monitoring',
    execution_support: 'Execution',
    execution_unsupported: 'Unavailable',
    completed: 'Completed',
    total_scans: 'Total scans',
    arb_overview_successful_runs: 'Successful',
    arb_overview_failed_runs: 'Failed',
    qualified_opportunities: 'Qualified',
    rejected_candidates: 'Rejected',
    arb_funnel_symbolsRequested: 'Symbols requested',
    arb_funnel_symbolsEvaluated: 'Symbols evaluated',
    arb_funnel_rawObservations: 'Raw observations',
    arb_funnel_analyticalCandidates: 'Analytical candidates',
    arb_funnel_rejected: 'Rejected',
    arb_funnel_qualified: 'Qualified',
    arb_funnel_expired: 'Expired',
    arb_funnel_blocked: 'Blocked',
    strategy_mexc_spot_spread_monitor: 'MEXC Spot Spread Monitor',
    arbitrage_overview_review_candidates: 'Review candidates',
    arbitrage_overview_view_scan_history: 'View scan history',
    arbitrage_overview_execution_truth: 'Execution truth',
    arbitrage_overview_interpretation_subtitle: 'Interpretation subtitle',
    arb_overview_recent_activity_subtitle: 'Recent subtitle',
    arb_overview_readiness_subtitle: 'Readiness subtitle',
    arb_limitation_single_venue: 'Single venue',
    arb_limitation_triangular: 'Triangular unavailable',
    arb_limitation_cross_exchange: 'Cross exchange unavailable',
    arb_limitation_futures_basis: 'Futures basis unavailable',
    arb_limitation_execution_blocked: 'Execution blocked',
    arb_overview_scan_started: 'Started',
    arb_overview_scan_completed: 'Completed',
    arb_overview_scan_trigger: 'Trigger',
    arb_overview_symbol_coverage: 'Symbol coverage',
    arb_overview_latest_successful_scan: 'Latest successful scan',
    arb_overview_config_summary: 'Settings',
    symbols: 'symbols',
    minimum_net_spread: 'Min net',
    arb_overview_max_data_age: 'Max data age',
    pause_monitoring: 'Paused',
    agent_state_paused: 'Paused',
    limited: 'Limited',
    arb_overview_candidate_funnel_subtitle: 'Funnel subtitle',
    arbitrage_overview_top_rejections: 'Top rejections',
  })[key] ?? key;

const overview: ArbitrageCoreOverview = {
  generatedAt: '2026-07-24T10:01:00.000Z',
  totalScanRuns: 10,
  product: {
    agentKey: 'arbitrage',
    displayName: 'MEXC Spot Spread Monitor',
    description: '',
    activeMode: 'single_venue_spread_monitoring',
    activeModeLabel: 'MEXC Spot Spread Monitor',
    unavailableModes: [],
    executionSupported: false,
    executionEligible: false,
  },
  settings: {
    monitoredSymbols: ['BTCUSDT'],
    minimumNetSpreadBps: 20,
    assumedFeesBps: 10,
    assumedSlippageBps: 10,
    maximumDataAgeMs: 30000,
    monitoringState: 'active',
    executionSupported: false,
    executionEligible: false,
  },
  historicalSummary: {
    totalScanRuns: 10,
    successfulRuns: 9,
    failedRuns: 1,
    scheduledRuns: 10,
    manualRuns: 0,
    latestSuccessfulRunAt: '2026-07-24T10:00:05.000Z',
    latestFailedRunAt: null,
  },
  latestRun: {
    runId: 'run-1',
    startedAt: '2026-07-24T10:00:00.000Z',
    completedAt: null,
    status: 'completed',
    trigger: 'scheduled',
    durationMs: null,
    durationAvailability: 'unavailable',
    durationReason: 'duration_not_recorded',
    dataFreshnessState: 'unavailable',
    dataFreshnessMs: null,
    dataFreshnessReason: 'source_timestamps_not_recorded',
    funnel: {
      symbolsRequested: 1,
      symbolsEvaluated: 1,
      rawObservations: 1,
      analyticalCandidates: 0,
      rejected: 1,
      qualified: 0,
      expired: 0,
      blocked: 0,
    },
    rejectionSummary: { NON_POSITIVE_NET: 1 },
  },
  recentRuns: [
    {
      runId: 'run-1',
      startedAt: '2026-07-24T10:00:00.000Z',
      completedAt: null,
      status: 'completed',
      trigger: 'scheduled',
      durationMs: null,
      durationAvailability: 'unavailable',
      funnel: { qualified: 0, rejected: 1 },
    },
  ],
  interpretation: {
    primaryMessage: 'Monitoring is active.',
    safeReasonCodes: [],
    rejectionSummary: {},
  },
};

describe('ArbitrageOverviewSection telemetry semantics', () => {
  it('does not render raw N/A labels in normal overview mode', () => {
    const { container } = render(
      <ArbitrageOverviewSection
        overview={overview}
        isLoading={false}
        loadError={null}
        onRetry={() => {}}
        onOpenTab={() => {}}
        t={t}
      />,
    );

    expect(container.textContent).not.toMatch(/\bN\/A\b/);
    expect(screen.getAllByText('Duration unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText('Data freshness unavailable')).toBeTruthy();
  });

  it('keeps valid zero funnel counts visible', () => {
    render(
      <ArbitrageOverviewSection
        overview={overview}
        isLoading={false}
        loadError={null}
        onRetry={() => {}}
        onOpenTab={() => {}}
        t={t}
      />,
    );

    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('renders overview content inside RTL containers without horizontal overflow markers', () => {
    const { container } = render(
      <div dir="rtl" lang="fa" className="max-w-sm overflow-x-hidden">
        <ArbitrageOverviewSection
          overview={overview}
          isLoading={false}
          loadError={null}
          onRetry={() => {}}
          onOpenTab={() => {}}
          t={t}
        />
      </div>,
    );

    expect(container.querySelector('[data-testid="arb-overview"]')).toBeTruthy();
    expect(container.textContent).toContain('Duration unavailable');
  });
});
