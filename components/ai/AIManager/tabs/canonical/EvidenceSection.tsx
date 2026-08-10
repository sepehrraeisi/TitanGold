import React, { useMemo, useState } from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import {
  agentArtemisConnection,
  noviceGroup,
  noviceStatus,
  noviceTone,
  productAuthority,
  productLabel,
  productLimitation,
} from '../../artemisProductCopy.ts';
import { isSimpleView } from '../../artemisPresentation.ts';
import {
  ARTEMIS_FOCUS,
  ARTEMIS_INNER,
  ARTEMIS_ROW,
  ARTEMIS_TABLE,
  ARTEMIS_TABLE_WRAP,
  ARTEMIS_TD,
  ARTEMIS_TH,
  ARTEMIS_THEAD,
  ARTEMIS_TR,
  EmptyState,
  Field,
  FilterBar,
  HelpTip,
  NativeInput,
  NativeSelect,
  SectionHeader,
  StatusPill,
  TechnicalDetails,
  TextAction,
} from '../../components/ArtemisUi.tsx';
import { METRIC_GRADIENT, type ArtemisMetricColor } from '../../artemisDesignTokens.ts';

const GROUPS = ['analytical', 'opportunity', 'capital_risk', 'feasibility', 'execution'] as const;

const GROUP_ACCENT: Record<(typeof GROUPS)[number], ArtemisMetricColor> = {
  analytical: 'purple',
  opportunity: 'blue',
  capital_risk: 'amber',
  feasibility: 'red',
  execution: 'red',
};

function connectionLabel(
  agent: { key: string; evidenceCompatible?: boolean; evidenceAvailable?: boolean; consumption?: string },
  t: ArtemisSectionProps['t'],
) {
  const state = agentArtemisConnection(agent);
  if (state === 'blocked') return productLabel(t, 'artemis_user_blocked', 'Blocked');
  if (state === 'unavailable') return productLabel(t, 'artemis_user_unavailable', 'Unavailable');
  return productLabel(t, 'artemis_user_not_connected', 'Not connected');
}

export const EvidenceSection: React.FC<ArtemisSectionProps> = ({ t, readiness, onNavigate, presentation }) => {
  const simple = isSimpleView(presentation);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(!simple);
  const agents = readiness?.catalog?.agents || [];

  const grouped = GROUPS.map((id) => ({
    id,
    label: noviceGroup(id, t),
    rows: agents.filter((a) => a.group === id),
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) => {
      const name = productLabel(t, agent.nameKey, agent.key).toLowerCase();
      return name.includes(q) || agent.key.toLowerCase().includes(q);
    });
  }, [agents, query, t]);

  return (
    <div className="space-y-4" data-artemis-page="evidence">
      <SectionHeader
        title={productLabel(t, 'artemis_inputs_title', 'AI Inputs')}
        subtitle={productLabel(t, 'artemis_inputs_intro', 'Artemis receives intelligence from 15 specialized AI Agents.')}
        actions={
          <HelpTip label={productLabel(t, 'artemis_help_evidence_label', 'What is evidence?')}>
            {productLabel(
              t,
              'artemis_help_evidence',
              'Evidence is the structured intelligence an Agent produces. Artemis can only combine it after that output is connected.',
            )}
          </HelpTip>
        }
      />
      <p className="text-[11px] text-muted-foreground -mt-2">
        {productLabel(
          t,
          'artemis_inputs_distinction',
          'These Agents are operational on their own, but their outputs are not yet connected to Artemis.',
        )}
      </p>

      <section className={`${ARTEMIS_INNER} text-[11px] text-muted-foreground`} aria-label={productLabel(t, 'artemis_inputs_legend', 'Status legend')}>
        <p className="text-xs font-semibold text-foreground mb-1">{productLabel(t, 'artemis_inputs_legend', 'Status legend')}</p>
        <p>{productLabel(t, 'artemis_legend_working', 'Working — the Agent can run independently.')}</p>
        <p>{productLabel(t, 'artemis_legend_not_connected', 'Not connected — Artemis cannot yet consume its output.')}</p>
        <p>{productLabel(t, 'artemis_legend_blocked', 'Blocked — this capability is not ready for Artemis.')}</p>
        <p>{productLabel(t, 'artemis_legend_unavailable', 'Unavailable — execution or feasibility is not enabled.')}</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {grouped.map((group) => {
          const operational = group.rows.filter((a) => a.operationalNow).length;
          const usable = 0;
          const first = group.rows[0];
          const connection = first ? connectionLabel(first, t) : productLabel(t, 'artemis_user_not_connected', 'Not connected');
          const accent = GROUP_ACCENT[group.id];
          return (
            <article
              key={group.id}
              className={`rounded-xl border border-white/5 bg-gradient-to-br ${METRIC_GRADIENT[accent]} to-transparent p-3 backdrop-blur-sm space-y-2`}
              data-artemis-input-group={group.id}
            >
              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
              <p className="text-[11px] text-muted-foreground">
                {productLabel(t, 'artemis_inputs_agents_count', '{count} Agents').replace('{count}', String(group.rows.length))}
              </p>
              <dl className="text-xs space-y-1.5">
                <div className="flex justify-between gap-2 items-center">
                  <dt className="text-muted-foreground">{productLabel(t, 'artemis_inputs_independent', 'Working independently?')}</dt>
                  <dd>
                    <StatusPill
                      label={operational > 0 ? productLabel(t, 'artemis_user_working', 'Working') : productLabel(t, 'artemis_user_needs_setup', 'Needs setup')}
                      tone={operational > 0 ? 'ok' : 'warning'}
                    />
                  </dd>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <dt className="text-muted-foreground">{productLabel(t, 'artemis_inputs_connected', 'Connected to Artemis?')}</dt>
                  <dd>
                    <StatusPill label={connection} tone={noviceTone(first?.consumption || 'contract_pending')} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <dt className="text-muted-foreground">{productLabel(t, 'artemis_inputs_usable', 'Evidence currently usable?')}</dt>
                  <dd>
                    <StatusPill
                      label={usable > 0 ? productLabel(t, 'yes', 'Yes') : productLabel(t, 'no', 'No')}
                      tone={usable > 0 ? 'ok' : 'warning'}
                    />
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      {!showAll ? (
        <TextAction onClick={() => setShowAll(true)}>{productLabel(t, 'artemis_view_all_agents', 'View all Agents')}</TextAction>
      ) : (
        <>
          <FilterBar>
            <Field label={productLabel(t, 'search', 'Search')}>
              <NativeInput value={query} onChange={(e) => setQuery(e.target.value)} aria-label={productLabel(t, 'search', 'Search')} />
            </Field>
            <Field label={productLabel(t, 'artemis_filter_role', 'Role')}>
              <NativeSelect value="all" disabled>
                <option value="all">{productLabel(t, 'all', 'All')}</option>
              </NativeSelect>
            </Field>
          </FilterBar>
          {filtered.length === 0 ? (
            <EmptyState
              title={productLabel(t, 'artemis_evidence_filter_empty', 'No Agents match these filters')}
              body={productLabel(t, 'artemis_evidence_filter_empty_body', 'Adjust search or filters to see Agent readiness.')}
            />
          ) : (
            <>
              <div className={`hidden md:block ${ARTEMIS_TABLE_WRAP} rounded-xl border border-white/5`}>
                <table className={ARTEMIS_TABLE}>
                  <thead className={ARTEMIS_THEAD}>
                    <tr>
                      <th className={ARTEMIS_TH}>{productLabel(t, 'artemis_col_agent', 'Agent')}</th>
                      <th className={ARTEMIS_TH}>{productLabel(t, 'artemis_col_role', 'Role')}</th>
                      <th className={ARTEMIS_TH}>{productLabel(t, 'artemis_agent_status', 'Agent status')}</th>
                      <th className={ARTEMIS_TH}>{productLabel(t, 'artemis_connection_status', 'Artemis connection')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((agent) => (
                      <tr key={agent.key} className={ARTEMIS_TR}>
                        <td className={ARTEMIS_TD}>
                          <button
                            type="button"
                            className={`font-medium text-start hover:underline ${ARTEMIS_FOCUS} rounded`}
                            onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents', agentId: agent.registryKey })}
                          >
                            {productLabel(t, agent.nameKey, agent.key)}
                          </button>
                        </td>
                        <td className={ARTEMIS_TD}>{simple ? noviceGroup(agent.group, t) : productAuthority(agent.authority, t)}</td>
                        <td className={ARTEMIS_TD}>
                          <StatusPill
                            label={agent.operationalNow ? productLabel(t, 'artemis_user_working', 'Working') : noviceStatus(agent.operational, t)}
                            tone={agent.operationalNow ? 'ok' : 'warning'}
                          />
                        </td>
                        <td className={ARTEMIS_TD}>
                          <StatusPill label={connectionLabel(agent, t)} tone={noviceTone(agent.consumption)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden space-y-2">
                {filtered.map((agent) => (
                  <li key={agent.key} className={`${ARTEMIS_ROW} space-y-2`}>
                    <p className="text-sm font-semibold">{productLabel(t, agent.nameKey, agent.key)}</p>
                    <p className="text-[11px] text-muted-foreground">{noviceGroup(agent.group, t)}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill label={agent.operationalNow ? productLabel(t, 'artemis_user_working', 'Working') : noviceStatus(agent.operational, t)} tone={agent.operationalNow ? 'ok' : 'warning'} />
                      <StatusPill label={connectionLabel(agent, t)} tone={noviceTone(agent.consumption)} />
                    </div>
                    <TextAction onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents', agentId: agent.registryKey })}>
                      {productLabel(t, 'artemis_open_agent', 'Open Agent')}
                    </TextAction>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {!simple ? (
        <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
          <p>contractVersion={readiness?.contract.contractVersion || '—'}</p>
          <p>schemaVersion={readiness?.contract.schemaVersion || '—'}</p>
          <p>implemented={String(readiness?.contract.implemented === true)}</p>
          {agents.map((agent) => (
            <p key={agent.key}>
              {agent.key}: operational={agent.operational} consumption={agent.consumption} {agent.limitationKey ? productLimitation(agent.limitationKey, t) : ''}
            </p>
          ))}
        </TechnicalDetails>
      ) : null}
    </div>
  );
};
