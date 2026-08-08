import React, { useMemo, useState } from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import {
  productAuthority,
  productGroup,
  productLabel,
  productLimitation,
  productStatus,
  statusTone,
} from '../../artemisProductCopy.ts';
import { EmptyState, Field, FilterBar, NativeInput, NativeSelect, StatusPill, TechnicalDetails, TextAction } from '../../components/ArtemisUi.tsx';

const GROUPS = ['all', 'analytical', 'opportunity', 'capital_risk', 'feasibility', 'execution'] as const;
const READY_FILTERS = ['all', 'ROLE_MAPPED', 'BLOCKED', 'NOT_EXECUTION_ELIGIBLE'] as const;

export const EvidenceSection: React.FC<ArtemisSectionProps> = ({ t, readiness, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('all');
  const [ready, setReady] = useState<(typeof READY_FILTERS)[number]>('all');
  const agents = readiness?.catalog?.agents || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((agent) => {
      if (group !== 'all' && agent.group !== group) return false;
      if (ready !== 'all' && agent.readiness !== ready) return false;
      if (!q) return true;
      const name = productLabel(t, agent.nameKey, agent.key).toLowerCase();
      return name.includes(q) || agent.key.toLowerCase().includes(q);
    });
  }, [agents, group, ready, query, t]);

  const grouped = GROUPS.filter((g) => g !== 'all').map((id) => ({
    id,
    label: productGroup(id, t),
    rows: filtered.filter((a) => a.group === id),
  }));

  return (
    <div className="space-y-4" data-artemis-page="evidence">
      <header>
        <h2 className="text-lg font-bold">{productLabel(t, 'artemis_evidence_workspace', 'Agent evidence readiness')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(
            t,
            'artemis_evidence_purpose',
            'See which Agents exist, whether they are operational, and whether Artemis can consume their evidence.',
          )}
        </p>
      </header>

      <section className="bg-card border border-border rounded-lg p-4" aria-labelledby="artemis-contract-title">
        <h3 id="artemis-contract-title" className="text-sm font-semibold">
          {productLabel(t, 'artemis_contract_panel', 'Contract readiness')}
        </h3>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_contract_version', 'Contract version')}</dt>
            <dd className="font-medium mt-1">{readiness?.contract.contractVersion || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_schema_version', 'Schema version')}</dt>
            <dd className="font-medium mt-1">{readiness?.contract.schemaVersion || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_implementation', 'Implementation')}</dt>
            <dd className="mt-1">
              <StatusPill
                label={
                  readiness?.contract.implemented
                    ? productLabel(t, 'artemis_status_available', 'Available')
                    : productLabel(t, 'artemis_status_not_activated', 'Not activated')
                }
                tone="warning"
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_compatible_agents', 'Compatible Agents')}</dt>
            <dd className="font-medium mt-1">
              {readiness?.contract.compatibleAgentCount ?? 0}/{readiness?.contract.catalogAgentCount || agents.length || 15}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground mt-3">
          {productLabel(
            t,
            'artemis_evidence_not_activated',
            'Canonical evidence integration has not been activated yet.',
          )}
        </p>
        <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
          <p>{productLabel(t, 'artemis_diag_contract_readiness', 'Contract readiness code')}: {readiness?.contract.readiness}</p>
          <p>{productLabel(t, 'artemis_diag_adapters', 'Adapters required')}: {String(readiness?.contract.adaptersRequired !== false)}</p>
        </TechnicalDetails>
      </section>

      <FilterBar>
        <Field label={productLabel(t, 'search', 'Search')}>
          <NativeInput value={query} onChange={(e) => setQuery(e.target.value)} aria-label={productLabel(t, 'search', 'Search')} />
        </Field>
        <Field label={productLabel(t, 'artemis_filter_role', 'Role')}>
          <NativeSelect value={group} onChange={(e) => setGroup(e.target.value as (typeof GROUPS)[number])}>
            <option value="all">{productLabel(t, 'all', 'All')}</option>
            {GROUPS.filter((g) => g !== 'all').map((g) => (
              <option key={g} value={g}>
                {productGroup(g, t)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={productLabel(t, 'artemis_filter_readiness', 'Readiness')}>
          <NativeSelect value={ready} onChange={(e) => setReady(e.target.value as (typeof READY_FILTERS)[number])}>
            <option value="all">{productLabel(t, 'all', 'All')}</option>
            {READY_FILTERS.filter((r) => r !== 'all').map((r) => (
              <option key={r} value={r}>
                {productStatus(r, t)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title={productLabel(t, 'artemis_evidence_filter_empty', 'No Agents match these filters')}
          body={productLabel(t, 'artemis_evidence_filter_empty_body', 'Adjust search or filters to see Agent evidence readiness.')}
        />
      ) : (
        grouped
          .filter((g) => g.rows.length)
          .map((g) => (
            <section key={g.id} className="space-y-2" aria-label={g.label}>
              <h3 className="text-sm font-semibold">{g.label}</h3>
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-start p-2">{productLabel(t, 'artemis_col_agent', 'Agent')}</th>
                      <th className="text-start p-2">{productLabel(t, 'artemis_col_role', 'Role')}</th>
                      <th className="text-start p-2">{productLabel(t, 'artemis_col_exists', 'Exists')}</th>
                      <th className="text-start p-2">{productLabel(t, 'artemis_col_operational', 'Operational')}</th>
                      <th className="text-start p-2">{productLabel(t, 'artemis_col_compatible', 'Evidence compatible')}</th>
                      <th className="text-start p-2">{productLabel(t, 'artemis_col_available', 'Evidence available')}</th>
                      <th className="text-start p-2">{productLabel(t, 'artemis_col_eligible', 'Artemis eligibility')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((agent) => (
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
                        <td className="p-2">{productAuthority(agent.authority, t)}</td>
                        <td className="p-2">{agent.exists ? productLabel(t, 'yes', 'Yes') : productLabel(t, 'no', 'No')}</td>
                        <td className="p-2">{productStatus(agent.operational, t)}</td>
                        <td className="p-2">{productLabel(t, 'no', 'No')}</td>
                        <td className="p-2">{productLabel(t, 'no', 'No')}</td>
                        <td className="p-2">
                          <StatusPill label={productStatus(agent.readiness, t)} tone={statusTone(agent.readiness)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden space-y-2">
                {g.rows.map((agent) => (
                  <li key={agent.key} className="bg-card border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{productLabel(t, agent.nameKey, agent.key)}</p>
                      <StatusPill label={productStatus(agent.readiness, t)} tone={statusTone(agent.readiness)} />
                    </div>
                    <p className="text-xs text-muted-foreground">{productAuthority(agent.authority, t)}</p>
                    <p className="text-xs">
                      {productLabel(t, 'artemis_col_exists', 'Exists')}: {agent.exists ? productLabel(t, 'yes', 'Yes') : productLabel(t, 'no', 'No')}
                      {' · '}
                      {productLabel(t, 'artemis_col_operational', 'Operational')}: {productStatus(agent.operational, t)}
                    </p>
                    {agent.limitationKey ? (
                      <p className="text-xs text-amber-800 dark:text-amber-200">{productLimitation(agent.limitationKey, t)}</p>
                    ) : null}
                    <TextAction onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents', agentId: agent.registryKey })}>
                      {productLabel(t, 'artemis_open_agent', 'Open Agent')}
                    </TextAction>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
};
