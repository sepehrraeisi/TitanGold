import React from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import {
  productAuthority,
  productGroup,
  productLabel,
  productLimitation,
  productStatus,
  statusTone,
} from '../../artemisProductCopy.ts';
import { StatusPill, TechnicalDetails, TextAction } from '../../components/ArtemisUi.tsx';

const FLOW = ['analytical', 'opportunity', 'capital_risk', 'feasibility', 'execution'] as const;

export const OrchestrationSection: React.FC<ArtemisSectionProps> = ({ t, readiness, onNavigate }) => {
  const agents = readiness?.catalog?.agents || [];
  return (
    <div className="space-y-4" data-artemis-page="orchestration">
      <header>
        <h2 className="text-lg font-bold">{productLabel(t, 'artemis_orchestration_workspace', 'Orchestration readiness')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(
            t,
            'artemis_orchestration_purpose',
            'Intended coordination topology. Canonical orchestration is not active.',
          )}
        </p>
      </header>

      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatusPill label={productLabel(t, 'artemis_canonical_orchestration', 'Canonical orchestration')} tone="danger" />
          <StatusPill label={productStatus('UNAVAILABLE', t)} tone="danger" />
        </div>
        <p className="text-sm">
          {productLabel(
            t,
            'artemis_orchestration_human',
            'Artemis is intended to combine Agent intelligence, then apply the control chain. That coordination path is not active yet.',
          )}
        </p>
        <div className="flex flex-col md:flex-row md:flex-wrap gap-2 text-sm font-medium">
          <span className="rounded-md border border-border px-2 py-1">{productGroup('analytical', t)}</span>
          <span className="text-muted-foreground self-center">+</span>
          <span className="rounded-md border border-border px-2 py-1">{productGroup('opportunity', t)}</span>
          <span className="text-muted-foreground self-center">→</span>
          <span className="rounded-md border border-dashed border-amber-500/40 px-2 py-1">
            {productLabel(t, 'artemis_pipe_evidence', 'Evidence compatibility')}
          </span>
          <span className="text-muted-foreground self-center">→</span>
          <span className="rounded-md border border-blue-500/40 px-2 py-1">Artemis</span>
          <span className="text-muted-foreground self-center">→</span>
          <span className="rounded-md border border-border px-2 py-1">
            {productLabel(t, 'artemis_control_chain', 'Control chain')}
          </span>
        </div>
      </section>

      {FLOW.map((group) => {
        const rows = agents.filter((a) => a.group === group);
        return (
          <section key={group} className="space-y-2" aria-label={productGroup(group, t)}>
            <h3 className="text-sm font-semibold">{productGroup(group, t)}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {rows.map((agent) => (
                <article key={agent.key} className="bg-card border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm">{productLabel(t, agent.nameKey, agent.key)}</h4>
                    <StatusPill label={productStatus(agent.operational === 'operational' ? 'AVAILABLE' : agent.readiness, t)} tone={statusTone(agent.readiness)} />
                  </div>
                  <p className="text-xs text-muted-foreground">{productAuthority(agent.authority, t)}</p>
                  <p className="text-xs">
                    {agent.exists
                      ? productLabel(t, 'artemis_op_configured', 'Configured')
                      : productLabel(t, 'artemis_op_unconfigured', 'Not configured')}
                    {' · '}
                    {productStatus(agent.consumption, t)}
                  </p>
                  {agent.limitationKey ? (
                    <p className="text-xs text-amber-800 dark:text-amber-200">{productLimitation(agent.limitationKey, t)}</p>
                  ) : null}
                  <TextAction onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents', agentId: agent.registryKey })}>
                    {productLabel(t, 'artemis_open_agent', 'Open Agent')}
                  </TextAction>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section className="rounded-lg border border-dashed border-border p-4 space-y-2 opacity-90">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {productLabel(t, 'artemis_legacy_coordination', 'Legacy coordination')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {productLabel(
            t,
            'artemis_legacy_coordination_note',
            'Legacy coordination is retained for compatibility but is not used as canonical Artemis orchestration.',
          )}
        </p>
        <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
          <p>{productLabel(t, 'artemis_diag_legacy_graph', 'Legacy identity graph is not canonical and must not be used for coordination.')}</p>
          <p>realAgentCoordination: {String(readiness?.orchestration?.realAgentCoordination === true)}</p>
        </TechnicalDetails>
      </section>
    </div>
  );
};
