import React, { useEffect, useId, useRef } from 'react';
import type { ArbitrageCoreCandidate } from '../../../services/api.ts';
import { AGENT_PRODUCT_LAYERS } from '../product/agentProductTokens.ts';
import { StatusPill } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import { formatRejectionReason } from '../../../utils/arbitrageReasonLabels.ts';

const formatBps = (value: number | null | undefined) =>
    value != null && Number.isFinite(value) ? `${Number(value).toFixed(2)} bps` : null;

const formatUsd = (value: number | null | undefined) =>
    value != null && Number.isFinite(value) ? `$${Number(value).toFixed(2)}` : null;

export type ArbitrageCandidateDetailDialogProps = {
    candidate: ArbitrageCoreCandidate | null;
    open: boolean;
    onClose: () => void;
    t: (key: string) => string;
    technicalMode?: boolean;
};

export const ArbitrageCandidateDetailDialog: React.FC<ArbitrageCandidateDetailDialogProps> = ({
    candidate,
    open,
    onClose,
    t,
    technicalMode = false,
}) => {
    const titleId = useId();
    const closeRef = useRef<HTMLButtonElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open || !candidate) return;
        previouslyFocused.current = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused.current?.focus?.();
        };
    }, [open, candidate, onClose]);

    if (!open || !candidate) return null;

    const primaryReason = candidate.rejectionReasons[0] ?? null;

    return (
        <div
            className="fixed inset-0 flex items-end sm:items-center justify-center p-4"
            style={{ zIndex: AGENT_PRODUCT_LAYERS.confirmation }}
            data-testid="arb-candidate-detail-layer"
            role="presentation"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#0f1318] p-5 shadow-2xl"
                data-testid="arb-candidate-detail-panel"
                onClick={e => e.stopPropagation()}
            >
                <div className="space-y-4 text-sm" data-testid="arb-candidate-detail-body">
                    <div className="flex items-start justify-between gap-3">
                        <h4 id={titleId} className="text-base font-semibold text-foreground">
                            {candidate.symbol || t('arb_candidate_detail') || 'Candidate detail'}
                        </h4>
                        <button
                            ref={closeRef}
                            type="button"
                            className="rounded-lg border border-gray-700 px-2 py-1 text-xs hover:bg-gray-800/60"
                            data-testid="arb-candidate-detail-close"
                            onClick={onClose}
                        >
                            {t('close') || 'Close'}
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <StatusPill label={candidate.lifecycleState} variant="info" />
                        <StatusPill
                            label={
                                candidate.freshnessState === 'fresh'
                                    ? t('arb_freshness_fresh') || 'Fresh'
                                    : t('arb_freshness_stale') || 'Stale'
                            }
                            variant={candidate.freshnessState === 'fresh' ? 'success' : 'warning'}
                        />
                        <StatusPill
                            label={
                                candidate.liquidityState === 'ok'
                                    ? t('arb_liquidity_ok') || 'Liquidity OK'
                                    : t('arb_liquidity_insufficient') || 'Insufficient liquidity'
                            }
                            variant={candidate.liquidityState === 'ok' ? 'success' : 'warning'}
                        />
                    </div>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <DetailItem label={t('symbol') || 'Symbol'} value={<AgentTechnicalLtr>{candidate.symbol}</AgentTechnicalLtr>} />
                        <DetailItem
                            label={t('arb_gross_spread') || 'Gross spread'}
                            value={formatBps(candidate.grossSpreadBps) ?? t('arb_metric_unavailable')}
                        />
                        <DetailItem
                            label={t('arb_net_spread') || 'Net spread'}
                            value={formatBps(candidate.netSpreadBps) ?? t('arb_metric_unavailable')}
                        />
                        <DetailItem
                            label={t('arb_assumed_fees') || 'Assumed fees'}
                            value={formatBps(candidate.assumedFeesBps) ?? t('arb_metric_unavailable')}
                        />
                        <DetailItem
                            label={t('arb_assumed_slippage') || 'Assumed slippage'}
                            value={formatBps(candidate.estimatedSlippageBps) ?? t('arb_metric_unavailable')}
                        />
                        <DetailItem
                            label={t('arb_estimated_profit') || 'Estimated profit'}
                            value={
                                formatUsd(candidate.estimatedProfit) ??
                                (candidate.estimatedProfitUnavailableReason
                                    ? formatRejectionReason(candidate.estimatedProfitUnavailableReason, t)
                                    : t('arb_metric_unavailable'))
                            }
                        />
                        <DetailItem
                            label={t('risk_score') || 'Risk score'}
                            value={
                                candidate.riskScore != null
                                    ? `${candidate.riskScore} / 100`
                                    : candidate.riskScoreUnavailableReason
                                      ? formatRejectionReason(candidate.riskScoreUnavailableReason, t)
                                      : t('arb_metric_unavailable')
                            }
                        />
                        <DetailItem label={t('mode') || 'Mode'} value={candidate.mode} />
                        <DetailItem label={t('source') || 'Source'} value={candidate.source} />
                        <DetailItem
                            label={t('observed_at') || 'Observed at'}
                            value={
                                candidate.observedAt
                                    ? new Date(candidate.observedAt).toLocaleString()
                                    : t('arb_timestamp_unavailable')
                            }
                        />
                        <DetailItem
                            label={t('run_id') || 'Run ID'}
                            value={<AgentTechnicalLtr>{candidate.runId ?? t('arb_metric_unavailable')}</AgentTechnicalLtr>}
                        />
                    </dl>

                    {primaryReason ? (
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">
                                {t('arb_primary_rejection') || 'Primary rejection reason'}
                            </p>
                            <p className="text-sm">{formatRejectionReason(primaryReason, t)}</p>
                            {technicalMode ? (
                                <p className="text-xs text-muted-foreground mt-1 font-mono">{primaryReason}</p>
                            ) : null}
                        </div>
                    ) : null}

                    {candidate.rejectionReasons.length > 1 ? (
                        <ul className="list-disc ps-5 space-y-1 text-xs text-muted-foreground">
                            {candidate.rejectionReasons.slice(1).map(reason => (
                                <li key={reason}>{formatRejectionReason(reason, t)}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm mt-0.5 break-words">{value}</dd>
    </div>
);

export default ArbitrageCandidateDetailDialog;
