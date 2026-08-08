import React, { useMemo, useState } from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import { productLabel } from '../../artemisProductCopy.ts';
import { isSimpleView } from '../../artemisPresentation.ts';
import { formatCount, resolveAdvisoryWindow, resolveAgentRunWindow } from '../../artemisActivityModel.ts';
import {
  ARTEMIS_FOCUS,
  ARTEMIS_ROW,
  DetailDrawer,
  EmptyState,
  Field,
  FilterBar,
  LinkAction,
  MetricCard,
  NativeInput,
  NativeSelect,
  SectionHeader,
  StatusPill,
  TechnicalDetails,
} from '../../components/ArtemisUi.tsx';

type UnifiedRow = {
  id: string;
  source: 'artemis' | 'agent' | 'safety';
  time?: string | null;
  agent?: string | null;
  type?: string | null;
  context?: string | null;
  status?: string | null;
  message?: string | null;
  raw?: unknown;
};

export const LineageSection: React.FC<ArtemisSectionProps> = ({ t, readiness, audit, presentation, onRetry }) => {
  const simple = isSimpleView(presentation);
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<UnifiedRow | null>(null);
  const advisory = resolveAdvisoryWindow(readiness, audit);
  const runs = resolveAgentRunWindow(readiness, audit);

  const rows: UnifiedRow[] = useMemo(() => {
    const logs = advisory.records.map((log) => ({
      id: `artemis-${log.id || log.created_at}`,
      source: 'artemis' as const,
      time: log.created_at || null,
      agent: 'Artemis',
      type: productLabel(t, 'artemis_user_advisory', 'Advisory only'),
      context: String((log.metadata as { opportunity?: { symbol?: string } } | undefined)?.opportunity?.symbol || '—'),
      status: productLabel(t, 'artemis_not_approved_execution', 'Not approved for execution'),
      message: log.message || null,
      raw: log,
    }));
    const agentRows = runs.records.map((run, index) => ({
      id: `agent-${run.id || index}`,
      source: 'agent' as const,
      time: run.createdAt || null,
      agent: run.agentName || run.agentKey || productLabel(t, 'ai_agents', 'Agents'),
      type: productLabel(t, 'artemis_agent_run', 'Agent activity'),
      context: run.symbol || run.action || '—',
      status: run.successful ? productLabel(t, 'artemis_run_recorded', 'Recorded') : productLabel(t, 'artemis_run_failed', 'Failed'),
      message: run.action || null,
      raw: run,
    }));
    const safety: UnifiedRow[] = [];
    if (readiness?.runtime?.killSwitchActive) {
      safety.push({
        id: 'safety-estop',
        source: 'safety',
        time: readiness.generatedAt || null,
        agent: productLabel(t, 'artemis_chip_safety', 'Safety'),
        type: productLabel(t, 'emergency_stop', 'Emergency Stop'),
        context: productLabel(t, 'artemis_estop_active_short', 'Emergency Stop active'),
        status: productLabel(t, 'active', 'Active'),
      });
    }
    return [...logs, ...agentRows, ...safety].sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
  }, [advisory.records, runs.records, readiness, t]);

  const filtered = rows.filter((row) => {
    if (source !== 'all' && row.source !== source) return false;
    if (!query.trim()) return true;
    const blob = `${row.agent} ${row.type} ${row.context} ${row.message}`.toLowerCase();
    return blob.includes(query.trim().toLowerCase());
  });

  const detailsUnavailable =
    ((advisory.count || 0) > 0 && !advisory.detailsAvailable && source !== 'agent') ||
    ((runs.count || 0) > 0 && !runs.detailsAvailable && source !== 'artemis');

  return (
    <div className="space-y-4" data-artemis-page="lineage">
      <SectionHeader
        title={productLabel(t, 'artemis_history_title', 'History & Audit')}
        subtitle={productLabel(t, 'artemis_history_purpose', 'Recent Artemis recommendations, Agent activity, and safety events.')}
      />

      <section className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricCard
          label={productLabel(t, 'artemis_history_recs', 'Recent Artemis recommendations')}
          value={<span data-artemis-history-advisory-count={String(advisory.count ?? '')}>{formatCount(advisory.count)}</span>}
          color="purple"
          hint={
            advisory.showingPartialWindow || (advisory.count || 0) > 0
              ? productLabel(t, 'artemis_showing_latest', 'Showing latest {shown}').replace(
                  '{shown}',
                  formatCount(Math.min(advisory.loadedCount || advisory.limit, advisory.limit)),
                )
              : undefined
          }
        />
        <MetricCard
          label={productLabel(t, 'artemis_history_agents', 'Recent Agent activity')}
          value={<span data-artemis-history-run-count={String(runs.count ?? '')}>{formatCount(runs.count)}</span>}
          color="blue"
          hint={
            (runs.count || 0) > 0 ? (
              <span data-artemis-history-run-window="true">
                {productLabel(t, 'artemis_runs_recorded_showing', '{total} Agent runs recorded · Showing latest {shown}')
                  .replace('{total}', formatCount(runs.count))
                  .replace('{shown}', formatCount(runs.loadedCount || Math.min(runs.limit, runs.count || 0)))}
              </span>
            ) : undefined
          }
        />
        <MetricCard
          label={productLabel(t, 'artemis_history_safety', 'Safety / system events')}
          value={
            <StatusPill
              label={
                readiness?.runtime?.killSwitchActive
                  ? productLabel(t, 'artemis_estop_active_short', 'Emergency Stop active')
                  : productLabel(t, 'artemis_estop_inactive_short', 'Emergency Stop off')
              }
              tone={readiness?.runtime?.killSwitchActive ? 'danger' : 'ok'}
            />
          }
          color={readiness?.runtime?.killSwitchActive ? 'red' : 'emerald'}
        />
      </section>

      <FilterBar>
        <Field label={productLabel(t, 'artemis_filter_source', 'Source')}>
          <NativeSelect value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">{productLabel(t, 'all', 'All')}</option>
            <option value="artemis">{productLabel(t, 'artemis', 'Artemis')}</option>
            <option value="agent">{productLabel(t, 'ai_agents', 'Agents')}</option>
            <option value="safety">{productLabel(t, 'artemis_chip_safety', 'Safety')}</option>
          </NativeSelect>
        </Field>
        <Field label={productLabel(t, 'search', 'Search')}>
          <NativeInput value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
      </FilterBar>

      {detailsUnavailable && filtered.length === 0 ? (
        <EmptyState
          title={productLabel(t, 'artemis_history_details_unavailable_title', 'History details unavailable')}
          body={
            (runs.count || 0) > 0 && !runs.detailsAvailable
              ? productLabel(
                  t,
                  'artemis_history_runs_unavailable_body',
                  '{count} Agent runs recorded, but recent details could not be loaded.',
                ).replace('{count}', formatCount(runs.count))
              : productLabel(
                  t,
                  'artemis_history_recs_unavailable_body',
                  '{count} Artemis advisory records exist, but their details could not be loaded.',
                ).replace('{count}', formatCount(advisory.count))
          }
          action={onRetry ? <LinkAction onClick={onRetry}>{productLabel(t, 'retry', 'Retry')}</LinkAction> : null}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={productLabel(t, 'artemis_history_true_empty_title', 'No history yet')}
          body={productLabel(t, 'artemis_history_true_empty_body', 'No Artemis recommendations or Agent activity have been recorded yet.')}
        />
      ) : (
        <ol className="space-y-2">
          {filtered.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`w-full text-start ${ARTEMIS_ROW} ${ARTEMIS_FOCUS}`}
                onClick={() => setSelected(row)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">{row.time ? new Date(row.time).toLocaleString() : '—'}</p>
                  <StatusPill
                    label={row.source === 'artemis' ? 'Artemis' : row.source === 'safety' ? productLabel(t, 'artemis_chip_safety', 'Safety') : productLabel(t, 'ai_agents', 'Agents')}
                    tone={row.source === 'safety' ? 'danger' : row.source === 'artemis' ? 'primary' : 'info'}
                  />
                </div>
                <p className="text-xs font-semibold mt-1">{row.agent}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row.type}
                  {row.context && row.context !== '—' ? ` · ${row.context}` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{row.status}</p>
              </button>
            </li>
          ))}
        </ol>
      )}

      {!simple ? (
        <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
          <p>{productLabel(t, 'artemis_lineage_not_implemented', 'Canonical decision lineage has not been activated yet.')}</p>
          <p>advisory.count={String(advisory.count)} loaded={String(advisory.loadedCount)}</p>
          <p>agentRuns.count={String(runs.count)} loaded={String(runs.loadedCount)}</p>
        </TechnicalDetails>
      ) : null}

      <DetailDrawer
        open={Boolean(selected)}
        title={productLabel(t, 'artemis_audit_details', 'History details')}
        onClose={() => setSelected(null)}
        closeLabel={productLabel(t, 'close', 'Close')}
      >
        {selected ? (
          <div className="space-y-2 text-xs">
            <p>{selected.agent}</p>
            <p>{selected.type}</p>
            <p>{selected.context}</p>
            <p>{selected.message}</p>
            {!simple ? (
              <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
                <pre className="whitespace-pre-wrap">{JSON.stringify(selected.raw || {}, null, 2).slice(0, 2500)}</pre>
              </TechnicalDetails>
            ) : null}
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
};
