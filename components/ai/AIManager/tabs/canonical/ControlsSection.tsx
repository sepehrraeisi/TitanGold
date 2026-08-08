import React from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import { noviceStatus, noviceTone, productLabel, productLimitation, productStatus } from '../../artemisProductCopy.ts';
import { isSimpleView } from '../../artemisPresentation.ts';
import { HelpTip, StatusPill, TechnicalDetails, TextAction } from '../../components/ArtemisUi.tsx';

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
  return (
    <div className="space-y-4" data-artemis-page="controls">
      <header>
        <h2 className="text-lg font-bold">
          {productLabel(t, 'artemis_safety_title', 'Safety & Approval')}
          <HelpTip label={productLabel(t, 'artemis_help_risk_label', 'What is a risk veto?')}>
            {productLabel(
              t,
              'artemis_help_risk',
              'Risk can block a recommendation from becoming a trade. Artemis cannot override that protection.',
            )}
          </HelpTip>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(t, 'artemis_safety_purpose', 'Every recommendation must pass these checks before trading could ever happen.')}
        </p>
      </header>

      <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 space-y-2">
        <h3 className="text-sm font-bold">{productLabel(t, 'artemis_why_execution_unavailable', 'Why execution is unavailable')}</h3>
        <ul className="list-disc ps-5 text-sm space-y-1">
          <li>{productLabel(t, 'artemis_why_exec_1', 'Agent intelligence is not yet connected to Artemis.')}</li>
          <li>{productLabel(t, 'artemis_why_exec_2', 'Liquidity validation is not available.')}</li>
          <li>{productLabel(t, 'artemis_why_exec_3', 'Automated order execution is not enabled.')}</li>
        </ul>
        <p className="text-sm">
          {productLabel(t, 'emergency_stop', 'Emergency Stop')}:{' '}
          {rt
            ? rt.killSwitchActive
              ? productLabel(t, 'artemis_estop_active_short', 'Emergency Stop active')
              : productLabel(t, 'artemis_estop_inactive_short', 'Emergency Stop off')
            : noviceStatus('UNAVAILABLE', t)}
          <HelpTip label={productLabel(t, 'emergency_stop', 'Emergency Stop')}>
            {productLabel(
              t,
              'artemis_help_estop',
              'Immediately blocks financial execution while still allowing safe analysis.',
            )}
          </HelpTip>
        </p>
      </section>

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
            <li key={step.id}>
              <article className="bg-card border border-border rounded-2xl p-4" data-artemis-control={step.id}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{index + 1}</p>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-bold">{productLabel(t, step.titleKey, step.title)}</h3>
                  <StatusPill label={noviceStatus(statusCode, t)} tone={noviceTone(statusCode)} />
                </div>
                <p className="text-sm mt-2">{productLabel(t, step.purposeKey, step.purpose)}</p>
                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_safety_owner', 'Who owns it?')}</dt>
                    <dd>{productLabel(t, step.ownerKey, step.owner)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_safety_result', 'Current result')}</dt>
                    <dd>{noviceStatus(statusCode, t)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_safety_can_block', 'Can it block execution?')}</dt>
                    <dd>{step.canBlock ? productLabel(t, 'yes', 'Yes') : productLabel(t, 'no', 'No')}</dd>
                  </div>
                </dl>
                {item?.ownerNav ? (
                  <div className="mt-3">
                    <TextAction onClick={() => onNavigate?.(item.ownerNav as never)}>
                      {productLabel(t, 'artemis_open_owner', 'Open owner')}
                    </TextAction>
                  </div>
                ) : null}
                {!simple && item?.limitationKey ? (
                  <p className="text-xs text-muted-foreground mt-2">{productLimitation(item.limitationKey, t)}</p>
                ) : null}
              </article>
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
