import React, { useMemo, useState } from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import { productLabel, productStatus } from '../../artemisProductCopy.ts';
import {
  DetailDrawer,
  EmptyState,
  Field,
  FilterBar,
  NativeInput,
  NativeSelect,
  StatusPill,
  TechnicalDetails,
} from '../../components/ArtemisUi.tsx';

type UnifiedRow = {
  id: string;
  source: 'artemis' | 'agent';
  time?: string | null;
  agent?: string | null;
  type?: string | null;
  context?: string | null;
  status?: string | null;
  message?: string | null;
  raw?: unknown;
};

export const LineageSection: React.FC<ArtemisSectionProps> = ({ t, readiness, audit }) => {
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<UnifiedRow | null>(null);

  const rows: UnifiedRow[] = useMemo(() => {
    const logs = (audit?.systemLogs || []).map((log) => ({
      id: `artemis-${log.id || log.created_at}`,
      source: 'artemis' as const,
      time: log.created_at || null,
      agent: 'Artemis',
      type: productLabel(t, 'artemis_legacy_advisory', 'Legacy advisory'),
      context: String((log.metadata as { opportunity?: { symbol?: string } } | undefined)?.opportunity?.symbol || '—'),
      status: productLabel(t, 'artemis_not_approved_execution', 'Not approved for execution'),
      message: log.message || null,
      raw: log,
    }));
    const runs = (audit?.decisions || readiness?.agentRuns?.recent || []).map((run, index) => ({
      id: `agent-${run.id || index}`,
      source: 'agent' as const,
      time: run.createdAt || null,
      agent: run.agentName || run.agentKey || productLabel(t, 'ai_agents', 'Agents'),
      type: productLabel(t, 'artemis_agent_run', 'Agent analytical run'),
      context: run.symbol || run.action || '—',
      status: run.successful ? productLabel(t, 'artemis_run_recorded', 'Recorded') : productLabel(t, 'artemis_run_failed', 'Failed'),
      message: run.action || null,
      raw: run,
    }));
    return [...logs, ...runs].sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
  }, [audit, readiness, t]);

  const filtered = rows.filter((row) => {
    if (source !== 'all' && row.source !== source) return false;
    if (!query.trim()) return true;
    const blob = `${row.agent} ${row.type} ${row.context} ${row.message}`.toLowerCase();
    return blob.includes(query.trim().toLowerCase());
  });

  return (
    <div className="space-y-4" data-artemis-page="lineage">
      <header>
        <h2 className="text-lg font-bold">{productLabel(t, 'artemis_lineage_workspace', 'Audit workspace')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(
            t,
            'artemis_lineage_purpose',
            'Trace current records. Artemis advisory logs and Agent runs are separate sources.',
          )}
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <article className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-sm font-semibold">{productLabel(t, 'artemis_source_artemis_logs', 'Artemis advisory logs')}</h3>
          <p className="text-2xl font-bold tabular-nums mt-1">{readiness?.advisory?.count ?? audit?.systemLogs.length ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{productStatus(readiness?.advisory?.truth || 'UNAVAILABLE', t)}</p>
        </article>
        <article className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-sm font-semibold">{productLabel(t, 'artemis_source_agent_runs', 'Agent analytical runs')}</h3>
          <p className="text-2xl font-bold tabular-nums mt-1">{readiness?.agentRuns?.count ?? audit?.decisions.length ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{productStatus(readiness?.agentRuns?.truth || 'UNAVAILABLE', t)}</p>
        </article>
        <article className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-sm font-semibold">{productLabel(t, 'artemis_canonical_lineage_readiness', 'Canonical lineage')}</h3>
          <p className="mt-2">
            <StatusPill label={productStatus('UNAVAILABLE', t)} tone="danger" />
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {productLabel(
              t,
              'artemis_lineage_not_implemented',
              'Canonical decision lineage has not been activated yet.',
            )}
          </p>
        </article>
      </section>

      <FilterBar>
        <Field label={productLabel(t, 'artemis_filter_source', 'Source')}>
          <NativeSelect value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">{productLabel(t, 'all', 'All')}</option>
            <option value="artemis">{productLabel(t, 'artemis_source_artemis_logs', 'Artemis advisory logs')}</option>
            <option value="agent">{productLabel(t, 'artemis_source_agent_runs', 'Agent analytical runs')}</option>
          </NativeSelect>
        </Field>
        <Field label={productLabel(t, 'search', 'Search')}>
          <NativeInput value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title={productLabel(t, 'artemis_lineage_empty', 'No audit records')}
          body={productLabel(t, 'artemis_lineage_empty_body', 'No Artemis advisory logs or Agent runs are available yet.')}
        />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-start p-2">{productLabel(t, 'artemis_col_time', 'Time')}</th>
                  <th className="text-start p-2">{productLabel(t, 'artemis_filter_source', 'Source')}</th>
                  <th className="text-start p-2">{productLabel(t, 'artemis_col_agent', 'Agent')}</th>
                  <th className="text-start p-2">{productLabel(t, 'artemis_col_event', 'Event')}</th>
                  <th className="text-start p-2">{productLabel(t, 'artemis_col_context', 'Context')}</th>
                  <th className="text-start p-2">{productLabel(t, 'artemis_col_status', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="p-2 text-xs">{row.time ? new Date(row.time).toLocaleString() : '—'}</td>
                    <td className="p-2">
                      {row.source === 'artemis'
                        ? productLabel(t, 'artemis_source_artemis_short', 'Artemis log')
                        : productLabel(t, 'artemis_source_agent_short', 'Agent run')}
                    </td>
                    <td className="p-2">{row.agent}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                        onClick={() => setSelected(row)}
                      >
                        {row.type}
                      </button>
                    </td>
                    <td className="p-2">{row.context}</td>
                    <td className="p-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-2">
            {filtered.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full text-start bg-card border border-border rounded-lg p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => setSelected(row)}
                >
                  <p className="text-xs text-muted-foreground">{row.time ? new Date(row.time).toLocaleString() : '—'}</p>
                  <p className="font-semibold">{row.agent}</p>
                  <p className="text-sm">{row.type}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <DetailDrawer
        open={Boolean(selected)}
        title={productLabel(t, 'artemis_audit_details', 'Audit details')}
        onClose={() => setSelected(null)}
        closeLabel={productLabel(t, 'close', 'Close')}
      >
        {selected ? (
          <div className="space-y-2 text-sm">
            <p>{selected.agent}</p>
            <p>{selected.type}</p>
            <p>{selected.context}</p>
            <p>{selected.message}</p>
            <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
              <pre className="whitespace-pre-wrap">{JSON.stringify(selected.raw || {}, null, 2).slice(0, 2500)}</pre>
            </TechnicalDetails>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
};
