import React from 'react';
import type { ArbitrageCoreCandidate } from '../../../services/api.ts';
import { StatusPill } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import { AgentProductDetailLayer } from '../product/AgentProductDetailLayer.tsx';
import {
  presentEstimatedProfit,
  presentFieldLabel,
  presentFreshness,
  presentLifecycle,
  presentLiquidity,
  presentMetricUnavailable,
  presentMode,
  presentPrimaryRejection,
  presentRiskScoreDetail,
  presentSource,
  presentTimestamp,
  presentBps,
  type TranslateFn,
} from '../../../utils/candidatePresentation.ts';

export type ArbitrageCandidateDetailPanelProps = {
  candidate: ArbitrageCoreCandidate;
  open: boolean;
  onClose: () => void;
  t: TranslateFn;
  technicalMode?: boolean;
};

export const ArbitrageCandidateDetailPanel: React.FC<ArbitrageCandidateDetailPanelProps> = ({
  candidate,
  open,
  onClose,
  t,
  technicalMode = false,
}) => {
  if (!open) return null;

  const presentationMode = technicalMode ? 'technical' : 'product';
  const primaryReason = candidate.rejectionReasons[0] ?? null;
  const returnFocusTestId = `arb-candidate-row-${candidate.candidateId}`;

  return (
    <AgentProductDetailLayer
      title={candidate.symbol || presentFieldLabel('symbol', t)}
      closeLabel={t('close') !== 'close' ? t('close') : 'Close'}
      onClose={onClose}
      closeTestId="arb-candidate-detail-close"
      layerTestId="arb-candidate-detail-layer"
      panelTestId="arb-candidate-detail-panel"
      returnFocusTestId={returnFocusTestId}
    >
      <div className="space-y-4 text-sm" data-testid="arb-candidate-detail-body">
        <div className="flex flex-wrap gap-2 items-center">
          <StatusPill
            label={presentLifecycle(candidate.lifecycleState, t, presentationMode)}
            variant="info"
          />
          <StatusPill
            label={presentFreshness(candidate.freshnessState, t, presentationMode)}
            variant={candidate.freshnessState === 'fresh' ? 'success' : 'warning'}
          />
          <StatusPill
            label={presentLiquidity(candidate.liquidityState, t, presentationMode)}
            variant={candidate.liquidityState === 'ok' ? 'success' : 'warning'}
          />
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailItem
            label={presentFieldLabel('symbol', t)}
            value={<AgentTechnicalLtr>{candidate.symbol}</AgentTechnicalLtr>}
          />
          <DetailItem
            label={presentFieldLabel('grossSpread', t)}
            value={presentBps(candidate.grossSpreadBps, t) ?? presentMetricUnavailable(t)}
          />
          <DetailItem
            label={presentFieldLabel('netSpread', t)}
            value={presentBps(candidate.netSpreadBps, t) ?? presentMetricUnavailable(t)}
          />
          <DetailItem
            label={presentFieldLabel('assumedFees', t)}
            value={presentBps(candidate.assumedFeesBps, t) ?? presentMetricUnavailable(t)}
          />
          <DetailItem
            label={presentFieldLabel('assumedSlippage', t)}
            value={presentBps(candidate.estimatedSlippageBps, t) ?? presentMetricUnavailable(t)}
          />
          <DetailItem
            label={presentFieldLabel('estimatedProfit', t)}
            value={presentEstimatedProfit(candidate, t)}
          />
          <DetailItem
            label={presentFieldLabel('riskScore', t)}
            value={presentRiskScoreDetail(candidate, t)}
          />
          <DetailItem
            label={presentFieldLabel('mode', t)}
            value={presentMode(candidate.mode, t, presentationMode)}
          />
          <DetailItem
            label={presentFieldLabel('source', t)}
            value={presentSource(candidate.source, t, presentationMode)}
          />
          <DetailItem
            label={presentFieldLabel('observedAt', t)}
            value={
              <AgentTechnicalLtr>{presentTimestamp(candidate.observedAt, t)}</AgentTechnicalLtr>
            }
          />
          <DetailItem
            label={presentFieldLabel('runId', t)}
            value={
              <AgentTechnicalLtr>
                {candidate.runId ?? presentMetricUnavailable(t)}
              </AgentTechnicalLtr>
            }
          />
        </dl>

        {primaryReason ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {presentFieldLabel('primaryRejection', t)}
            </p>
            <p className="text-sm">{presentPrimaryRejection(primaryReason, t, presentationMode)}</p>
            {technicalMode ? (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                <AgentTechnicalLtr>{primaryReason}</AgentTechnicalLtr>
              </p>
            ) : null}
          </div>
        ) : null}

        {candidate.rejectionReasons.length > 1 ? (
          <ul className="list-disc ps-5 space-y-1 text-xs text-muted-foreground">
            {candidate.rejectionReasons.slice(1).map(reason => (
              <li key={reason}>{presentPrimaryRejection(reason, t, presentationMode)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </AgentProductDetailLayer>
  );
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm mt-0.5 break-words">{value}</dd>
  </div>
);

export default ArbitrageCandidateDetailPanel;
