import React, { useMemo } from 'react';
import type {
  ArbitrageCoreProfitRiskAnalytics,
  ArbitrageCoreProfitRiskResponse,
  ArbitrageCoreRunSummary,
} from '../../../services/api.ts';
import { SecondaryButton, StatusPill } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import {
  AgentEmptyState,
  AgentErrorState,
  AgentLoadingState,
  AgentMetricGrid,
  AgentSectionHeader,
  type AgentMetricItem,
} from '../product/index.ts';
import { formatRejectionReason } from '../../../utils/arbitrageReasonLabels.ts';
import {
  formatLocalizedTimestamp,
  metricStateForSpread,
  presentBps,
  presentEstimateState,
  presentFieldLabel,
  presentFreshnessState,
  presentLiquidityState,
  presentProfitValue,
  presentNotionalValue,
  presentRiskFactor,
  presentRiskScore,
  presentRiskScoreHelp,
  presentRunOptionLabel,
  presentSelectionBasis,
  resolveProductLabel,
  type TranslateFn,
} from '../../../utils/profitRiskPresentation.ts';

export type ArbitrageProfitRiskSectionProps = {
  data: ArbitrageCoreProfitRiskResponse | null;
  loading: boolean;
  error: string | null;
  selectedRunId?: string;
  onRunChange: (runId: string) => void;
  onRefresh: () => void;
  onViewCandidates: (runId: string) => void;
  onOpenSettings: () => void;
  t: TranslateFn;
  locale?: string;
};

function metricBadge(state: string | null | undefined, t: TranslateFn) {
  const label = presentEstimateState(state, t);
  return <StatusPill label={label} variant="info" className="shrink-0" />;
}

function buildEconomicsMetrics(
  analytics: ArbitrageCoreProfitRiskAnalytics,
  t: TranslateFn,
  locale?: string,
): AgentMetricItem[] {
  const profitUnavailable =
    analytics.estimatedProfitValue == null || !Number.isFinite(Number(analytics.estimatedProfitValue));
  const notionalUnavailable =
    analytics.notionalValue == null || !Number.isFinite(Number(analytics.notionalValue));

  return [
    {
      id: 'gross',
      label: presentFieldLabel('grossSpread', t),
      value: (
        <AgentTechnicalLtr>{presentBps(analytics.grossSpreadBps, t)}</AgentTechnicalLtr>
      ),
      badge: metricBadge('market_observation', t),
      valueState: analytics.grossSpreadBps == null ? 'unavailable' : 'loaded',
    },
    {
      id: 'fees',
      label: presentFieldLabel('assumedFees', t),
      value: (
        <AgentTechnicalLtr>{presentBps(analytics.assumedFeesBps, t)}</AgentTechnicalLtr>
      ),
      badge: metricBadge('assumption', t),
      valueState: analytics.assumedFeesBps == null ? 'unavailable' : 'loaded',
    },
    {
      id: 'slippage',
      label: presentFieldLabel('assumedSlippage', t),
      value: (
        <AgentTechnicalLtr>{presentBps(analytics.assumedSlippageBps, t)}</AgentTechnicalLtr>
      ),
      badge: metricBadge('assumption', t),
      valueState: analytics.assumedSlippageBps == null ? 'unavailable' : 'loaded',
    },
    {
      id: 'net',
      label: presentFieldLabel('netSpread', t),
      value: (
        <AgentTechnicalLtr>{presentBps(analytics.estimatedNetSpreadBps, t)}</AgentTechnicalLtr>
      ),
      badge: metricBadge(metricStateForSpread('net'), t),
      valueState: analytics.estimatedNetSpreadBps == null ? 'unavailable' : 'loaded',
      color:
        analytics.estimatedNetSpreadBps != null && analytics.estimatedNetSpreadBps < 0 ? 'red' : 'blue',
    },
    {
      id: 'notional',
      label: presentFieldLabel('analyticalNotional', t),
      value: notionalUnavailable ? (
        resolveProductLabel('arb_pr_state_unavailable', t)
      ) : (
        <AgentTechnicalLtr>
          {presentNotionalValue(analytics.notionalValue, analytics.notionalCurrency, t, locale)}
        </AgentTechnicalLtr>
      ),
      badge: metricBadge(
        notionalUnavailable ? 'unavailable' : analytics.notionalState || 'measured',
        t,
      ),
      valueState: notionalUnavailable ? 'unavailable' : 'loaded',
      hint: notionalUnavailable ? resolveProductLabel('arb_pr_notional_unavailable', t) : undefined,
    },
    {
      id: 'profit',
      label: presentFieldLabel('estimatedProfit', t),
      value: profitUnavailable ? (
        resolveProductLabel('arb_pr_state_unavailable', t)
      ) : (
        <AgentTechnicalLtr>
          {presentProfitValue(
            analytics.estimatedProfitValue,
            analytics.estimatedProfitCurrency,
            t,
          )}
        </AgentTechnicalLtr>
      ),
      hint:
        profitUnavailable && analytics.estimateReason === 'notional_unavailable'
          ? resolveProductLabel('arb_pr_notional_unavailable', t)
          : undefined,
      badge: metricBadge(profitUnavailable ? 'unavailable' : 'derived_estimate', t),
      valueState: profitUnavailable ? 'unavailable' : 'loaded',
    },
    {
      id: 'risk',
      label: presentFieldLabel('riskScore', t),
      value: (
        <AgentTechnicalLtr dir="ltr">
          {presentRiskScore(analytics.riskScore, analytics.riskScoreState, t)}
        </AgentTechnicalLtr>
      ),
      badge: metricBadge(analytics.riskScoreState || 'unavailable', t),
      valueState: analytics.riskScore == null ? 'unavailable' : 'loaded',
      title: presentRiskScoreHelp(
        analytics.riskScore,
        analytics.riskScoreState,
        analytics.riskScoreSource,
        analytics.riskScoreReason,
        t,
      ) || resolveProductLabel('arbitrage_risk_score_help', t),
    },
  ];
}

export const ArbitrageProfitRiskSection: React.FC<ArbitrageProfitRiskSectionProps> = ({
  data,
  loading,
  error,
  selectedRunId,
  onRunChange,
  onRefresh,
  onViewCandidates,
  onOpenSettings,
  t,
  locale,
}) => {
  const analytics = data?.analytics;
  const metrics = useMemo(
    () => (analytics ? buildEconomicsMetrics(analytics, t, locale) : []),
    [analytics, t, locale],
  );

  if (loading && !data) {
    return <AgentLoadingState message={resolveProductLabel('loading', t)} testId="arb-pr-loading" />;
  }

  if (error && !data) {
    return (
      <AgentErrorState
        message={error}
        onRetry={onRefresh}
        retryLabel={t('retry') || 'Retry'}
        testId="arb-pr-error"
      />
    );
  }

  if (!analytics?.runId) {
    return (
      <AgentEmptyState
        message={resolveProductLabel('arb_pr_no_scan_history', t)}
        testId="arb-pr-empty"
      />
    );
  }

  const rejectionEntries = Object.entries(analytics.rejectionDistribution || {});
  const runId = analytics.runId;

  return (
    <div className="space-y-5" data-testid="arb-profit-risk-section">
      <AgentSectionHeader
        title={resolveProductLabel('arb_pr_title', t)}
        subtitle={resolveProductLabel('arb_pr_subtitle', t)}
        actions={
          <SecondaryButton type="button" data-testid="arb-pr-refresh" onClick={onRefresh}>
            {resolveProductLabel('refresh', t)}
          </SecondaryButton>
        }
      />

      <p className="text-xs text-muted-foreground" data-testid="arb-pr-coverage-note">
        {resolveProductLabel('arb_pr_available_records_note', t)}
      </p>

      {data?.availableRuns?.length ? (
        <div className="space-y-1" data-testid="arb-pr-run-select">
          <span className="text-xs text-muted-foreground">{resolveProductLabel('arb_pr_run_selector', t)}</span>
          <select
            className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm"
            value={selectedRunId || runId}
            onChange={e => onRunChange(e.target.value)}
            data-testid="arb-pr-run-picker"
          >
            {data.availableRuns.map((run: ArbitrageCoreRunSummary & { runId: string }) => (
              <option key={run.runId} value={run.runId}>
                {presentRunOptionLabel(run, t, locale)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">
            {resolveProductLabel('run_id', t)}:{' '}
            <AgentTechnicalLtr>{runId}</AgentTechnicalLtr>
          </p>
        </div>
      ) : null}

      {analytics.selectedCandidateSymbol ? (
        <section className="text-xs space-y-1" data-testid="arb-pr-selected-candidate">
          <h4 className="text-sm font-semibold">{presentFieldLabel('selectedCandidate', t)}</h4>
          <p>
            <AgentTechnicalLtr>{analytics.selectedCandidateSymbol}</AgentTechnicalLtr>
            {analytics.selectedCandidateId ? (
              <>
                {' '}
                (<AgentTechnicalLtr>{analytics.selectedCandidateId}</AgentTechnicalLtr>)
              </>
            ) : null}
          </p>
          <p className="text-muted-foreground">
            {presentFieldLabel('selectionBasis', t)}: {presentSelectionBasis(analytics.selectionBasis, t)}
          </p>
        </section>
      ) : null}

      <AgentMetricGrid metrics={metrics} testId="arb-pr-economics" />

      <section data-testid="arb-pr-qualification">
        <h4 className="text-sm font-semibold mb-2">{resolveProductLabel('arb_pr_qualification', t)}</h4>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <li>{presentFieldLabel('analyticalCandidates', t)}: {analytics.analyticalCandidateCount ?? 0}</li>
          <li>{presentFieldLabel('qualified', t)}: {analytics.qualifiedCandidateCount ?? 0}</li>
          <li>{presentFieldLabel('rejected', t)}: {analytics.rejectedCandidateCount ?? 0}</li>
        </ul>
        {rejectionEntries.length ? (
          <ul className="mt-2 space-y-1 text-xs">
            {rejectionEntries.map(([reason, count]) => (
              <li key={reason}>
                {formatRejectionReason(reason, t)}: {count}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3">
          <SecondaryButton type="button" data-testid="arb-pr-view-candidates" onClick={() => onViewCandidates(runId)}>
            {resolveProductLabel('arb_history_view_candidates', t)}
          </SecondaryButton>
        </div>
      </section>

      <section data-testid="arb-pr-risk-overview">
        <h4 className="text-sm font-semibold mb-2">{resolveProductLabel('arb_pr_risk_overview', t)}</h4>
        <p className="text-sm">
          {presentFieldLabel('riskScore', t)}:{' '}
          <AgentTechnicalLtr dir="ltr">
            {presentRiskScore(analytics.riskScore, analytics.riskScoreState, t)}
          </AgentTechnicalLtr>
        </p>
        {analytics.riskScoreSource ? (
          <p className="text-[10px] text-muted-foreground mt-1">
            {resolveProductLabel(`arb_pr_risk_source_${analytics.riskScoreSource}`, t)}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground mt-1">
          {presentFreshnessState(analytics.freshnessState, t)} ·{' '}
          {presentLiquidityState(analytics.liquidityState, t)}
        </p>
        {analytics.riskFactors?.length ? (
          <ul className="mt-2 space-y-1 text-xs">
            {analytics.riskFactors.map(f => (
              <li key={f.code}>
                {presentRiskFactor(f.code, t)}
                {f.count != null ? `: ${f.count}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section data-testid="arb-pr-assumptions">
        <h4 className="text-sm font-semibold mb-2">{presentFieldLabel('assumptions', t)}</h4>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">{presentFieldLabel('assumedFees', t)}</dt>
            <dd>
              <AgentTechnicalLtr>{presentBps(analytics.assumptions?.assumedFeesBps, t)}</AgentTechnicalLtr>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{presentFieldLabel('assumedSlippage', t)}</dt>
            <dd>
              <AgentTechnicalLtr>{presentBps(analytics.assumptions?.assumedSlippageBps, t)}</AgentTechnicalLtr>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{resolveProductLabel('min_profit_bps', t)}</dt>
            <dd>
              <AgentTechnicalLtr>{presentBps(analytics.assumptions?.minimumNetSpreadBps, t)}</AgentTechnicalLtr>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{resolveProductLabel('monitored_symbols', t)}</dt>
            <dd>
              <AgentTechnicalLtr>
                {(analytics.assumptions?.monitoredSymbols || []).join(', ') || resolveProductLabel('unavailable', t)}
              </AgentTechnicalLtr>
            </dd>
          </div>
        </dl>
        <SecondaryButton type="button" className="mt-2" data-testid="arb-pr-open-settings" onClick={onOpenSettings}>
          {resolveProductLabel('tab_settings', t)}
        </SecondaryButton>
      </section>

      {analytics.historicalTrend?.length ? (
        <section data-testid="arb-pr-trend">
          <h4 className="text-sm font-semibold mb-2">{presentFieldLabel('trend', t)}</h4>
          <div className="overflow-x-auto max-w-full">
            <table className="w-full min-w-[320px] text-xs">
              <thead>
                <tr className="text-muted-foreground text-start">
                  <th className="py-1 pe-2 whitespace-nowrap">{resolveProductLabel('arb_history_completed_at', t)}</th>
                  <th className="py-1 pe-2">{presentFieldLabel('qualified', t)}</th>
                  <th className="py-1 pe-2">{presentFieldLabel('rejected', t)}</th>
                  <th className="py-1 pe-2 whitespace-nowrap">{presentFieldLabel('netSpread', t)}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.historicalTrend.slice(0, 8).map(row => {
                  const isSelected = row.runId === runId || row.isSelected;
                  return (
                    <tr
                      key={row.runId}
                      className={`border-t border-gray-800 ${isSelected ? 'bg-purple-500/10' : ''}`}
                      data-testid={isSelected ? 'arb-pr-trend-selected' : undefined}
                    >
                      <td className="py-1 pe-2 whitespace-nowrap">
                        <span>{formatLocalizedTimestamp(row.completedAt, locale, t)}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          <AgentTechnicalLtr>{row.completedAt || '—'}</AgentTechnicalLtr>
                        </span>
                      </td>
                      <td className="py-1 pe-2">{row.qualifiedCount ?? 0}</td>
                      <td className="py-1 pe-2">{row.rejectedCount ?? 0}</td>
                      <td className="py-1 pe-2 whitespace-nowrap">
                        <AgentTechnicalLtr>{presentBps(row.netSpreadBps, t)}</AgentTechnicalLtr>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section data-testid="arb-pr-limitations">
        <h4 className="text-sm font-semibold mb-2">{presentFieldLabel('limitations', t)}</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc ps-4">
          <li>{resolveProductLabel('arb_pr_limit_execution', t)}</li>
          <li>{resolveProductLabel('arb_pr_limit_realized', t)}</li>
          <li>{resolveProductLabel('arb_pr_limit_captured', t)}</li>
          <li>{resolveProductLabel('arb_pr_limit_public_data', t)}</li>
        </ul>
        <div className="mt-2">
          <StatusPill
            label={`${resolveProductLabel('execution_support', t)}: ${resolveProductLabel('execution_unsupported', t)}`}
            variant="warning"
          />
        </div>
      </section>
    </div>
  );
};

export default ArbitrageProfitRiskSection;
