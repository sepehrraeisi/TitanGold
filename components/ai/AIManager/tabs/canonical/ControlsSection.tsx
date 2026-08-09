import React from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import { noviceStatus, noviceTone, productLabel, productLimitation, productStatus } from '../../artemisProductCopy.ts';
import { isSimpleView } from '../../artemisPresentation.ts';
import {
  AlertBanner,
  HelpTip,
  SectionHeader,
  StatusPill,
  StepRow,
  TechnicalDetails,
  TextAction,
} from '../../components/ArtemisUi.tsx';
import type { ArtemisMetricColor } from '../../artemisDesignTokens.ts';

const CHAIN = [
  {
    id: 'risk',
    titleKey: 'artemis_safety_risk',
    title: 'Risk Check',
    purposeKey: 'artemis_safety_risk_purpose',
    purpose: 'Protects the portfolio from unacceptable risk.',
    canBlock: true,
    ownerKey: 'artemis_agent_risk',
    owner: 'Risk Management',
  },
  {
    id: 'portfolio',
    titleKey: 'artemis_safety_portfolio',
    title: 'Capital Allocation',
    purposeKey: 'artemis_safety_portfolio_purpose',
    purpose: 'Keeps position size within available capital and allocation limits.',
    canBlock: true,
    ownerKey: 'artemis_agent_portfolio',
    owner: 'Portfolio Allocation',
  },
  {
    id: 'optimization',
    titleKey: 'artemis_safety_optimization',
    title: 'Strategy Optimization',
    purposeKey: 'artemis_safety_optimization_purpose',
    purpose: 'Balances exposure so one idea does not dominate the book.',
    canBlock: false,
    ownerKey: 'artemis_agent_optimization',
    owner: 'Optimization',
  },
  {
    id: 'liquidity',
    titleKey: 'artemis_safety_liquidity',
    title: 'Liquidity Check',
    purposeKey: 'artemis_safety_liquidity_purpose',
    purpose: 'Makes sure an order could realistically be executed.',
    canBlock: true,
    ownerKey: 'artemis_agent_liquidity',
    owner: 'Liquidity Analysis',
  },
  {
    id: 'runtime',
    titleKey: 'artemis_safety_runtime',
    title: 'Runtime Safety',
    purposeKey: 'artemis_safety_runtime_purpose',
    purpose: 'Enforces Demo/Live mode and Emergency Stop before anything can trade.',
    canBlock: true,
    ownerKey: 'artemis_pipe_runtime',
    owner: 'Runtime safety',
  },
  {
    id: 'order',
    titleKey: 'artemis_safety_order',
    title: 'Order Execution',
    purposeKey: 'artemis_safety_order_purpose',
    purpose: 'Only executes an intent after every required approval.',
    canBlock: true,
    ownerKey: 'artemis_agent_order',
    owner: 'Order Management',
  },
] as const;

export const ControlsSection: React.FC<ArtemisSectionProps> = ({ t, readiness, onNavigate, presentation }) => {
  const simple = isSimpleView(presentation);
  const rt = readiness?.runtime;
  const stepAccent = (id: string): ArtemisMetricColor => {
    if (id === 'liquidity' || id === 'order') return 'red';
    if (id === 'runtime') return rt?.killSwitchActive ? 'red' : 'emerald';
    return 'amber';
  };

  return (
    <div className="space-y-4" data-artemis-page="controls">
      <SectionHeader
        title={productLabel(t, 'artemis_safety_title', 'Safety & Approval')}
        subtitle={productLabel(t, 'artemis_safety_purpose', 'Every recommendation must pass these checks before trading could ever happen.')}
        actions={
          <HelpTip label={productLabel(t, 'artemis_help_risk_label', 'What is a risk veto?')}>
            {productLabel(
              t,
              'artemis_help_risk',
              'Risk can block a recommendation from becoming a trade. Artemis cannot override that protection.',
            )}
          </HelpTip>
        }
      />

      <AlertBanner variant="error" title={productLabel(t, 'artemis_why_execution_unavailable', 'Why execution is unavailable')}>
        <ul className="list-disc ps-4 space-y-0.5">
          <li>{productLabel(t, 'artemis_why_exec_1', 'Agent intelligence is not yet connected to Artemis.')}</li>
          <li>{productLabel(t, 'artemis_why_exec_2', 'Liquidity validation is not available.')}</li>
          <li>{productLabel(t, 'artemis_why_exec_3', 'Automated order execution is not enabled.')}</li>
        </ul>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span>{productLabel(t, 'emergency_stop', 'Emergency Stop')}</span>
          <StatusPill
            label={
              rt
                ? rt.killSwitchActive
                  ? productLabel(t, 'artemis_estop_active_short', 'Emergency Stop active')
                  : productLabel(t, 'artemis_estop_inactive_short', 'Emergency Stop off')
                : noviceStatus('UNAVAILABLE', t)
            }
            tone={rt?.killSwitchActive ? 'danger' : rt ? 'ok' : 'warning'}
          />
          <HelpTip label={productLabel(t, 'emergency_stop', 'Emergency Stop')}>
            {productLabel(
              t,
              'artemis_help_estop',
              'Immediately blocks financial execution while still allowing safe analysis.',
            )}
          </HelpTip>
        </p>
      </AlertBanner>

      <ol className="space-y-2">
        {CHAIN.map((step, index) => {
          const item = readiness?.controlChain?.[step.id];
          const statusCode =
            step.id === 'liquidity'
              ? 'UNAVAILABLE'
              : step.id === 'order'
                ? 'NOT_EXECUTION_ELIGIBLE'
                : item?.readiness || 'PARTIAL';
          return (
            <li key={step.id} data-artemis-control={step.id}>
              <StepRow
                index={index + 1}
                title={productLabel(t, step.titleKey, step.title)}
                purpose={productLabel(t, step.purposeKey, step.purpose)}
                status={noviceStatus(statusCode, t)}
                tone={noviceTone(statusCode)}
                accent={stepAccent(step.id)}
                owner={`${productLabel(t, 'artemis_safety_owner', 'Who owns it?')}: ${productLabel(t, step.ownerKey, step.owner)}`}
                canBlock={`${productLabel(t, 'artemis_safety_can_block', 'Can it block execution?')}: ${
                  step.canBlock ? productLabel(t, 'yes', 'Yes') : productLabel(t, 'no', 'No')
                }`}
                action={
                  <>
                    {item?.ownerNav ? (
                      <TextAction onClick={() => onNavigate?.(item.ownerNav as never)}>
                        {productLabel(t, 'artemis_open_owner', 'Open owner')}
                      </TextAction>
                    ) : null}
                    {!simple && item?.limitationKey ? (
                      <p className="text-[11px] text-muted-foreground mt-1">{productLimitation(item.limitationKey, t)}</p>
                    ) : null}
                  </>
                }
              />
            </li>
          );
        })}
      </ol>

      {!simple ? (
        <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
          {CHAIN.map((step) => {
            const item = readiness?.controlChain?.[step.id];
            return (
              <p key={step.id}>
                {step.id}: authority={item?.authority || '—'} readiness={productStatus(item?.readiness, t)} truth={item?.truth || '—'}
              </p>
            );
          })}
        </TechnicalDetails>
      ) : null}
    </div>
  );
};
