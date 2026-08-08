import React from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import {
  productAuthority,
  productControlName,
  productLabel,
  productLimitation,
  productMode,
  productStatus,
  statusTone,
} from '../../artemisProductCopy.ts';
import { StatusPill, TextAction } from '../../components/ArtemisUi.tsx';

const CHAIN = ['risk', 'portfolio', 'optimization', 'liquidity', 'runtime', 'order'] as const;

export const ControlsSection: React.FC<ArtemisSectionProps> = ({ t, readiness, onNavigate }) => {
  const rt = readiness?.runtime;
  return (
    <div className="space-y-4" data-artemis-page="controls">
      <header>
        <h2 className="text-lg font-bold">{productLabel(t, 'artemis_controls_workspace', 'Authority control chain')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(
            t,
            'artemis_controls_purpose',
            'Who can approve, block, size, validate, or execute. Artemis cannot bypass Risk.',
          )}
        </p>
      </header>

      <section className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-sm font-semibold">
          {productLabel(t, 'execution_eligibility', 'Execution eligibility')}: {productStatus('NOT_EXECUTION_ELIGIBLE', t)}
        </p>
        <p className="text-sm mt-1">
          {productLabel(
            t,
            'artemis_why_not_execution',
            'Execution stays unavailable because evidence is not connected, orchestration is not active, liquidity feasibility is unavailable, and Order Management can only execute an already-approved intent.',
          )}
        </p>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-xs">
          <div>
            <dt className="text-muted-foreground">{productLabel(t, 'requested_mode', 'Requested mode')}</dt>
            <dd className="font-medium">{rt ? productMode(rt.requestedMode, t) : productStatus('UNAVAILABLE', t)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{productLabel(t, 'effective_mode', 'Effective mode')}</dt>
            <dd className="font-medium">{rt ? productMode(rt.effectiveMode, t) : productStatus('UNAVAILABLE', t)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{productLabel(t, 'emergency_stop', 'Emergency Stop')}</dt>
            <dd className="font-medium">
              {rt ? (rt.killSwitchActive ? productLabel(t, 'active', 'Active') : productLabel(t, 'inactive', 'Inactive')) : productStatus('UNAVAILABLE', t)}
            </dd>
          </div>
        </dl>
      </section>

      <ol className="space-y-2">
        {CHAIN.map((id, index) => {
          const item = readiness?.controlChain?.[id];
          const veto = id === 'risk';
          return (
            <li key={id}>
              <article
                className={`bg-card border rounded-lg p-4 ${veto ? 'border-red-500/50' : 'border-border'}`}
                data-artemis-control={id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{index + 1}</p>
                    <h3 className={`text-base font-bold ${veto ? 'text-red-700 dark:text-red-300' : ''}`}>
                      {productControlName(id, t)}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={productAuthority(item?.authority || (id === 'runtime' ? 'runtime_safety' : id === 'order' ? 'execution_only' : 'sizing'), t)} tone={veto ? 'danger' : 'info'} />
                    <StatusPill label={productStatus(item?.readiness, t)} tone={statusTone(item?.readiness)} />
                  </div>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_col_role', 'Role')}</dt>
                    <dd>{productControlName(id, t)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_source_of_truth', 'Source of truth')}</dt>
                    <dd>{productStatus(item?.truth || 'CONFIGURED', t)}</dd>
                  </div>
                </dl>
                {id === 'risk' ? (
                  <p className="text-sm mt-2 font-medium">
                    {productLabel(t, 'artemis_risk_veto_note', 'Risk veto cannot be overridden by Artemis.')}
                  </p>
                ) : null}
                {id === 'order' ? (
                  <p className="text-sm mt-2">
                    {productLabel(t, 'artemis_order_boundary', 'Executes an approved intent only. Cannot determine market direction.')}
                  </p>
                ) : null}
                {id === 'liquidity' ? (
                  <p className="text-sm mt-2">
                    {productLabel(t, 'artemis_blocker_liquidity_unavailable', 'Execution feasibility validation is not available yet.')}
                  </p>
                ) : null}
                {item?.limitationKey && id === 'risk' ? (
                  <p className="text-sm mt-2 text-amber-800 dark:text-amber-200">
                    {productLimitation(item.limitationKey, t)}
                  </p>
                ) : null}
                {item?.ownerNav ? (
                  <div className="mt-3">
                    <TextAction onClick={() => onNavigate?.(item.ownerNav as never)}>
                      {productLabel(t, 'artemis_open_owner', 'Open owner')}
                    </TextAction>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
