import React from 'react';
import type { ArbitrageCoreRunDetail } from '../../../services/api.ts';
import { SecondaryButton, StatusPill } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import { AgentProductDetailLayer } from '../product/AgentProductDetailLayer.tsx';
import { formatRejectionReason } from '../../../utils/arbitrageReasonLabels.ts';
import {
  presentComparisonDelta,
  presentFieldLabel,
  presentPrimaryOutcome,
  presentRuntimeMode,
  presentScanDuration,
  presentScanFreshness,
  presentScanStatus,
  presentScanTrigger,
  presentDryRunBadge,
  resolveProductLabel,
  type ScanRunDetailShape,
  type TranslateFn,
} from '../../../utils/scanRunPresentation.ts';
import { presentFunnelLabel } from '../../../utils/candidatePresentation.ts';

export type ScanRunComparison = {
  hasPrevious: boolean;
  triggerContext?: string | null;
  previousTrigger?: string | null;
  deltas?: Record<string, number | Record<string, number> | null>;
};

export type ArbitrageScanRunDetailPanelProps = {
  run: ScanRunDetailShape;
  comparison?: ScanRunComparison | null;
  open: boolean;
  onClose: () => void;
  onViewCandidates: (runId: string) => void;
  t: TranslateFn;
};

export const ArbitrageScanRunDetailPanel: React.FC<ArbitrageScanRunDetailPanelProps> = ({
  run,
  comparison,
  open,
  onClose,
  onViewCandidates,
  t,
}) => {
  if (!open) return null;

  const funnel = run.funnel || {};
  const rejectionEntries = Object.entries(run.rejectionDistribution || run.rejectionSummary || {});
  const returnFocusTestId = `arb-history-row-${run.runId}`;

  return (
    <AgentProductDetailLayer
      title={formatTimestamp(run.completedAt || run.startedAt, t)}
      closeLabel={t('close') !== 'close' ? t('close') : 'Close'}
      onClose={onClose}
      closeTestId="arb-history-detail-close"
      layerTestId="arb-history-detail-layer"
      panelTestId="arb-history-detail-panel"
      returnFocusTestId={returnFocusTestId}
    >
      <div className="space-y-4 text-sm" data-testid="arb-history-detail-body">
        <div className="flex flex-wrap gap-2 items-center">
          <StatusPill label={presentScanTrigger(run.trigger, t)} variant="info" />
          <StatusPill
            label={presentScanStatus(run.status, t)}
            variant={run.status === 'failed' ? 'warning' : 'success'}
          />
          {run.dryRun !== false ? (
            <StatusPill label={presentDryRunBadge(t)} variant="info" />
          ) : null}
        </div>

        <p className="text-sm">{presentPrimaryOutcome(run, t)}</p>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailItem
            label={presentFieldLabel('startedAt', t)}
            value={<AgentTechnicalLtr>{formatTimestamp(run.startedAt, t)}</AgentTechnicalLtr>}
          />
          <DetailItem
            label={presentFieldLabel('completedAt', t)}
            value={<AgentTechnicalLtr>{formatTimestamp(run.completedAt, t)}</AgentTechnicalLtr>}
          />
          <DetailItem
            label={presentFieldLabel('duration', t)}
            value={presentScanDuration(run, t)}
          />
          <DetailItem
            label={presentFieldLabel('freshness', t)}
            value={presentScanFreshness(run, t)}
          />
          <DetailItem label={presentFieldLabel('runtimeMode', t)} value={presentRuntimeMode(run.runtimeMode, t)} />
          <DetailItem
            label={presentFieldLabel('schedulerOwner', t)}
            value={
              <AgentTechnicalLtr>{run.schedulerOwner ?? resolveProductLabel('unavailable', t)}</AgentTechnicalLtr>
            }
          />
          <DetailItem
            label={presentFieldLabel('runId', t)}
            value={<AgentTechnicalLtr className="break-all">{run.runId}</AgentTechnicalLtr>}
          />
        </dl>

        <section>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">
            {presentFieldLabel('funnel', t)}
          </h4>
          <ul className="grid grid-cols-2 gap-2 text-xs">
            {(['symbolsRequested', 'symbolsEvaluated', 'rawObservations', 'analyticalCandidates', 'rejected', 'qualified', 'expired', 'blocked'] as const).map(
              key => (
                <li key={key}>
                  {presentFunnelLabel(key, t)}: {String(funnel[key] ?? 0)}
                </li>
              ),
            )}
          </ul>
        </section>

        {rejectionEntries.length ? (
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              {resolveProductLabel('arb_primary_rejection', t)}
            </h4>
            <ul className="space-y-1 text-xs">
              {rejectionEntries.map(([reason, count]) => (
                <li key={reason}>
                  {formatRejectionReason(reason, t)}: {count}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {run.failureReason ? (
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">
              {resolveProductLabel('arb_history_failure_details', t)}
            </h4>
            <p className="text-sm">{formatRejectionReason(run.failureReason, t)}</p>
          </section>
        ) : null}

        {comparison?.hasPrevious ? (
          <section data-testid="arb-history-comparison">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              {resolveProductLabel('arb_history_comparison_title', t)}
            </h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>
                {resolveProductLabel('symbols_evaluated', t)}:{' '}
                {presentComparisonDelta(comparison.deltas?.evaluatedSymbols as number, t)}
              </li>
              <li>
                {presentFunnelLabel('analyticalCandidates', t)}:{' '}
                {presentComparisonDelta(comparison.deltas?.analyticalCandidates as number, t)}
              </li>
              <li>
                {presentFunnelLabel('rejected', t)}:{' '}
                {presentComparisonDelta(comparison.deltas?.rejected as number, t)}
              </li>
              <li>
                {presentFunnelLabel('qualified', t)}:{' '}
                {presentComparisonDelta(comparison.deltas?.qualified as number, t)}
              </li>
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <SecondaryButton
            type="button"
            data-testid="arb-history-view-candidates"
            onClick={() => onViewCandidates(run.runId)}
          >
            {resolveProductLabel('arb_history_view_candidates', t)}
          </SecondaryButton>
        </div>

        {run.sideEffectsSuppressed !== false ? (
          <p className="text-xs text-muted-foreground">
            {resolveProductLabel('arb_history_execution_suppressed', t)}
          </p>
        ) : null}
      </div>
    </AgentProductDetailLayer>
  );
};

const formatTimestamp = (value: string | null | undefined, t: TranslateFn) => {
  if (!value) return resolveProductLabel('arb_timestamp_unavailable', t);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return resolveProductLabel('arb_timestamp_unavailable', t);
  return d.toLocaleString();
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm mt-0.5 break-words">{value}</dd>
  </div>
);

export default ArbitrageScanRunDetailPanel;
