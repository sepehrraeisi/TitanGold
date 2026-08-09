import React from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import {
  agentArtemisConnection,
  noviceGroup,
  noviceStatus,
  productLabel,
  productLimitation,
} from '../../artemisProductCopy.ts';
import { isSimpleView } from '../../artemisPresentation.ts';
import {
  ARTEMIS_INNER,
  ARTEMIS_ROW,
  ExpandableGroup,
  HelpTip,
  SectionHeader,
  StatusPill,
  TechnicalDetails,
  TextAction,
} from '../../components/ArtemisUi.tsx';
import type { ArtemisMetricColor } from '../../artemisDesignTokens.ts';

const FLOW = ['analytical', 'opportunity', 'capital_risk', 'feasibility', 'execution'] as const;

const FLOW_ACCENT: Record<(typeof FLOW)[number], ArtemisMetricColor> = {
  analytical: 'purple',
  opportunity: 'blue',
  capital_risk: 'amber',
  feasibility: 'red',
  execution: 'red',
};

const FLOW_TONE: Record<(typeof FLOW)[number], 'primary' | 'info' | 'warning' | 'danger'> = {
  analytical: 'primary',
  opportunity: 'info',
  capital_risk: 'warning',
  feasibility: 'danger',
  execution: 'danger',
};

function connectionCopy(
  agent: { key: string; evidenceCompatible?: boolean; evidenceAvailable?: boolean; consumption?: string },
  t: ArtemisSectionProps['t'],
) {
  const state = agentArtemisConnection(agent);
  if (state === 'blocked') return { label: productLabel(t, 'artemis_user_blocked', 'Blocked'), tone: 'danger' as const };
  if (state === 'unavailable') return { label: productLabel(t, 'artemis_user_unavailable', 'Unavailable'), tone: 'danger' as const };
  return { label: productLabel(t, 'artemis_user_not_connected', 'Not connected'), tone: 'warning' as const };
}

export const OrchestrationSection: React.FC<ArtemisSectionProps> = ({ t, readiness, onNavigate, presentation }) => {
  const simple = isSimpleView(presentation);
  const agents = readiness?.catalog?.agents || [];
  return (
    <div className="space-y-4" data-artemis-page="orchestration">
      <SectionHeader
        title={productLabel(t, 'artemis_coord_title', 'Coordination')}
        subtitle={productLabel(
          t,
          'artemis_coord_purpose',
          'Artemis is meant to combine specialized Agents into one recommendation. That coordination is not active yet.',
        )}
      />

      <section className={`${ARTEMIS_INNER} space-y-3`}>
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">
          {FLOW.map((group, index) => {
            const rows = agents.filter((a) => a.group === group);
            return (
              <React.Fragment key={group}>
                <StatusPill label={`${rows.length} ${noviceGroup(group, t)}`} tone={FLOW_TONE[group]} />
                {index < FLOW.length - 1 ? (
                  <span className="text-[11px] text-muted-foreground self-center" aria-hidden>
                    +
                  </span>
                ) : null}
              </React.Fragment>
            );
          })}
          <span className="text-[11px] text-muted-foreground self-center" aria-hidden>
            →
          </span>
          <StatusPill label="Artemis" variant="primary" />
        </div>
        <p className="text-xs">
          {productLabel(t, 'artemis_coord_current', 'Current coordination')}:{' '}
          <StatusPill label={productLabel(t, 'artemis_coord_not_active', 'Not active')} tone="danger" />
        </p>
        <p className="text-[11px] text-muted-foreground">
          {productLabel(
            t,
            'artemis_coord_reason',
            'Agent outputs have not yet been connected using the Artemis evidence contract.',
          )}
        </p>
      </section>

      {FLOW.map((group) => {
        const rows = agents.filter((a) => a.group === group);
        const operational = rows.filter((a) => a.operationalNow).length;
        return (
          <ExpandableGroup
            key={group}
            title={`${noviceGroup(group, t)} · ${rows.length}`}
            summary={productLabel(t, 'artemis_coord_group_summary', '{ready} working independently · 0 connected to Artemis')
              .replace('{ready}', String(operational))}
            accent={FLOW_ACCENT[group]}
          >
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {rows.map((agent) => {
                const connection = connectionCopy(agent, t);
                return (
                  <li key={agent.key} className={ARTEMIS_ROW} data-artemis-coord-agent={agent.key}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-foreground">{productLabel(t, agent.nameKey, agent.key)}</h4>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusPill
                        label={agent.operationalNow ? productLabel(t, 'artemis_op_operational', 'Operational') : noviceStatus(agent.operational, t)}
                        tone={agent.operationalNow ? 'ok' : 'warning'}
                      />
                      {agent.key === 'liquidity' ? (
                        <HelpTip label={productLabel(t, 'artemis_help_liquidity_label', 'What is liquidity?')}>
                          {productLabel(
                            t,
                            'artemis_help_liquidity',
                            'Liquidity checks whether an order could realistically be filled without excessive slippage.',
                          )}
                        </HelpTip>
                      ) : null}
                      <StatusPill label={connection.label} tone={connection.tone} />
                    </div>
                    {!simple && agent.limitationKey ? (
                      <p className="text-[11px] text-amber-200 mt-2">{productLimitation(agent.limitationKey, t)}</p>
                    ) : null}
                    <div className="mt-2">
                      <TextAction onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents', agentId: agent.registryKey })}>
                        {productLabel(t, 'artemis_open_agent', 'Open Agent')}
                      </TextAction>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ExpandableGroup>
        );
      })}

      {!simple ? (
        <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
          <p>realAgentCoordination={String(readiness?.orchestration?.realAgentCoordination === true)}</p>
          <p>orchestration.readiness={String(readiness?.orchestration?.readiness || '')}</p>
        </TechnicalDetails>
      ) : null}
    </div>
  );
};
