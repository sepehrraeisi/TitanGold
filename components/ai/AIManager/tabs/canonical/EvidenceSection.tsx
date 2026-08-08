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
  EmptyState,
  Field,
  FilterBar,
  HelpTip,
  NativeInput,
  NativeSelect,
  StatusPill,
  TechnicalDetails,
  TextAction,
} from '../../components/ArtemisUi.tsx';

const GROUPS = ['analytical', 'opportunity', 'capital_risk', 'feasibility', 'execution'] as const;

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
      <header>
        <h2 className="text-lg font-bold">
          {productLabel(t, 'artemis_inputs_title', 'AI Inputs')}
          <HelpTip label={productLabel(t, 'artemis_help_evidence_label', 'What is evidence?')}>
            {productLabel(
              t,
              'artemis_help_evidence',
              'Evidence is the structured intelligence an Agent produces. Artemis can only combine it after that output is connected.',
            )}
          </HelpTip>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(t, 'artemis_inputs_intro', 'Artemis receives intelligence from 15 specialized AI Agents.')}
        </p>
        <p className="text-sm mt-2">
          {productLabel(
            t,
            'artemis_inputs_distinction',
            'These Agents are operational on their own, but their outputs are not yet connected to Artemis.',
          )}
        </p>
      </header>

      <section className="rounded-xl border border-border bg-secondary/20 p-3 text-xs md:text-sm" aria-label={productLabel(t, 'artemis_inputs_legend', 'Status legend')}>
        <p className="font-semibold mb-1">{productLabel(t, 'artemis_inputs_legend', 'Status legend')}</p>
        <p>{productLabel(t, 'artemis_legend_working', 'Working — the Agent can run independently.')}</p>
        <p>{productLabel(t, 'artemis_legend_not_connected', 'Not connected — Artemis cannot yet consume its output.')}</p>
        <p>{productLabel(t, 'artemis_legend_blocked', 'Blocked — this capability is not ready for Artemis.')}</p>
        <p>{productLabel(t, 'artemis_legend_unavailable', 'Unavailable — execution or feasibility is not enabled.')}</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {grouped.map((group) => {
          const operational = group.rows.filter((a) => a.operationalNow).length;
          const connected = group.rows.filter((a) => a.evidenceCompatible || a.evidenceAvailable).length;
          const usable = 0;
          const first = group.rows[0];
          const connection = first ? connectionLabel(first, t) : productLabel(t, 'artemis_user_not_connected', 'Not connected');
          return (
            <article key={group.id} className="bg-card border border-border rounded-2xl p-4 space-y-2" data-artemis-input-group={group.id}>
              <h3 className="font-semibold">{group.label}</h3>
              <p className="text-sm text-muted-foreground">
                {productLabel(t, 'artemis_inputs_agents_count', '{count} Agents').replace('{count}', String(group.rows.length))}
              </p>
              <dl className="text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <dt>{productLabel(t, 'artemis_inputs_independent', 'Working independently?')}</dt>
                  <dd>
                    <StatusPill
                      label={operational > 0 ? productLabel(t, 'artemis_user_working', 'Working') : productLabel(t, 'artemis_user_needs_setup', 'Needs setup')}
                      tone={operational > 0 ? 'ok' : 'warning'}
                    />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{productLabel(t, 'artemis_inputs_connected', 'Connected to Artemis?')}</dt>
                  <dd>
                    <StatusPill label={connection} tone={connected > 0 ? 'ok' : noviceTone(first?.consumption || 'contract_pending')} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{productLabel(t, 'artemis_inputs_usable', 'Evidence currently usable?')}</dt>
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
              <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-start p-2">{productLabel(t, 'artemis_col_agent', 'Agent')}</th>
                      <th className="text-start p-2">{productLabel(t, 'artemis_col_role', 'Role')}</th>
                      <th className="text-start p-2">{productLabel(t, 'artemis_agent_status', 'Agent status')}</th>
                      <th className="text-start p-2">{productLabel(t, 'artemis_connection_status', 'Artemis connection')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((agent) => (
                      <tr key={agent.key} className="border-t border-border">
                        <td className="p-2">
                          <button
                            type="button"
                            className="font-medium text-start hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                            onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents', agentId: agent.registryKey })}
                          >
                            {productLabel(t, agent.nameKey, agent.key)}
                          </button>
                        </td>
                        <td className="p-2">{simple ? noviceGroup(agent.group, t) : productAuthority(agent.authority, t)}</td>
                        <td className="p-2">
                          <StatusPill
                            label={agent.operationalNow ? productLabel(t, 'artemis_user_working', 'Working') : noviceStatus(agent.operational, t)}
                            tone={agent.operationalNow ? 'ok' : 'warning'}
                          />
                        </td>
                        <td className="p-2">
                          <StatusPill label={connectionLabel(agent, t)} tone={noviceTone(agent.consumption)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden space-y-2">
                {filtered.map((agent) => (
                  <li key={agent.key} className="bg-card border border-border rounded-xl p-3 space-y-2">
                    <p className="font-semibold">{productLabel(t, agent.nameKey, agent.key)}</p>
                    <p className="text-xs text-muted-foreground">{noviceGroup(agent.group, t)}</p>
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
