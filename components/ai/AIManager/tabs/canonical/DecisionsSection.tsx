import React, { useMemo, useState } from 'react';
import type { ArtemisAuditLog, ArtemisSectionProps } from '../../artemisProductTypes.ts';
import { productLabel, productMode, productStatus } from '../../artemisProductCopy.ts';
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

function metaOf(log: ArtemisAuditLog): Record<string, unknown> {
  return log.metadata && typeof log.metadata === 'object' ? log.metadata : {};
}

function advisoryAction(log: ArtemisAuditLog): string {
  const meta = metaOf(log);
  const decision = (meta.decision as Record<string, unknown> | undefined) || {};
  return String(decision.action || meta.action || '').toUpperCase() || '—';
}

function advisorySymbol(log: ArtemisAuditLog): string {
  const meta = metaOf(log);
  const opportunity = (meta.opportunity as Record<string, unknown> | undefined) || {};
  return String(opportunity.symbol || meta.symbol || '—');
}

function advisoryProvider(log: ArtemisAuditLog): string {
  const meta = metaOf(log);
  const providers = meta.providers;
  if (Array.isArray(providers) && providers.length) return String(providers[0]?.name || providers[0] || '—');
  return String(meta.provider || meta.model || '—');
}

export const DecisionsSection: React.FC<ArtemisSectionProps> = ({ t, readiness, audit }) => {
  const logs = audit?.systemLogs || [];
  const [action, setAction] = useState('all');
  const [provider, setProvider] = useState('all');
  const [from, setFrom] = useState('');
  const [selected, setSelected] = useState<ArtemisAuditLog | null>(null);

  const providers = useMemo(
    () => Array.from(new Set(logs.map(advisoryProvider).filter((p) => p && p !== '—'))),
    [logs],
  );

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (action !== 'all' && advisoryAction(log) !== action) return false;
      if (provider !== 'all' && advisoryProvider(log) !== provider) return false;
      if (from && log.created_at && new Date(log.created_at) < new Date(from)) return false;
      return true;
    });
  }, [logs, action, provider, from]);

  const latest = logs[0]?.created_at || readiness?.advisory?.latestAt || null;

  return (
    <div className="space-y-4" data-artemis-page="decisions">
      <header>
        <h2 className="text-lg font-bold">{productLabel(t, 'artemis_decisions_workspace', 'Advisory decisions')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(
            t,
            'artemis_decisions_purpose',
            'Review legacy advisory conclusions. None of these records authorize execution.',
          )}
        </p>
      </header>

      <section className="bg-card border border-border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{productLabel(t, 'artemis_decision_class', 'Decision class')}</p>
          <p className="font-semibold mt-1">{productStatus(readiness?.classification || 'LEGACY_ADVISORY_ONLY', t)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{productLabel(t, 'execution_eligibility', 'Execution eligibility')}</p>
          <p className="font-semibold mt-1">{productStatus('NOT_EXECUTION_ELIGIBLE', t)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{productLabel(t, 'artemis_latest_decision', 'Latest decision')}</p>
          <p className="font-semibold mt-1 text-xs md:text-sm">{latest ? new Date(latest).toLocaleString() : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{productLabel(t, 'artemis_records_available', 'Records available')}</p>
          <p className="font-semibold mt-1 tabular-nums">{readiness?.advisory?.count ?? logs.length}</p>
        </div>
      </section>

      {logs.length > 0 ? (
        <FilterBar>
          <Field label={productLabel(t, 'artemis_filter_action', 'Advisory action')}>
            <NativeSelect value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">{productLabel(t, 'all', 'All')}</option>
              {['BUY', 'SELL', 'HOLD'].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={productLabel(t, 'artemis_filter_provider', 'Provider')}>
            <NativeSelect value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="all">{productLabel(t, 'all', 'All')}</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={productLabel(t, 'artemis_filter_from', 'From date')}>
            <NativeInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        </FilterBar>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={productLabel(t, 'artemis_no_legacy_logs', 'No advisory records')}
          body={productLabel(t, 'artemis_no_legacy_logs_reason', 'No persisted Artemis advisory logs are available for this session.')}
        />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-start p-2">{productLabel(t, 'artemis_col_time', 'Time')}</th>
                  <th className="text-start p-2">{productLabel(t, 'artemis_col_context', 'Context')}</th>
                  <th className="text-start p-2">{productLabel(t, 'artemis_col_advisory', 'Advisory')}</th>
                  <th className="text-start p-2">{productLabel(t, 'artemis_filter_provider', 'Provider')}</th>
                  <th className="text-start p-2">{productLabel(t, 'artemis_col_class', 'Classification')}</th>
                  <th className="text-start p-2">{productLabel(t, 'execution_eligibility', 'Execution')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={String(log.id || log.created_at)} className="border-t border-border">
                    <td className="p-2 text-xs">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
                    <td className="p-2">{advisorySymbol(log)}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                        onClick={() => setSelected(log)}
                      >
                        {advisoryAction(log)}
                      </button>
                    </td>
                    <td className="p-2">{advisoryProvider(log)}</td>
                    <td className="p-2">
                      <StatusPill label={productLabel(t, 'artemis_legacy_advisory', 'Legacy advisory')} tone="warning" />
                    </td>
                    <td className="p-2">
                      <StatusPill label={productLabel(t, 'artemis_not_approved_execution', 'Not approved for execution')} tone="danger" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-2">
            {filtered.map((log) => (
              <li key={String(log.id || log.created_at)}>
                <button
                  type="button"
                  className="w-full text-start bg-card border border-border rounded-lg p-3 space-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => setSelected(log)}
                >
                  <p className="text-xs text-muted-foreground">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</p>
                  <p className="font-semibold">
                    {advisoryAction(log)} · {advisorySymbol(log)}
                  </p>
                  <StatusPill label={productLabel(t, 'artemis_not_approved_execution', 'Not approved for execution')} tone="danger" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <DetailDrawer
        open={Boolean(selected)}
        title={productLabel(t, 'artemis_decision_details', 'Decision details')}
        onClose={() => setSelected(null)}
        closeLabel={productLabel(t, 'close', 'Close')}
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">{productLabel(t, 'artemis_col_advisory', 'Advisory')}: </span>
              {productLabel(t, 'artemis_advisory_signal', 'Advisory signal')} · {advisoryAction(selected)}
            </p>
            <p>
              <span className="text-muted-foreground">{productLabel(t, 'artemis_col_context', 'Context')}: </span>
              {advisorySymbol(selected)}
            </p>
            <p>
              <span className="text-muted-foreground">{productLabel(t, 'artemis_filter_provider', 'Provider')}: </span>
              {advisoryProvider(selected)}
            </p>
            <p>{selected.message || '—'}</p>
            <StatusPill label={productLabel(t, 'artemis_not_approved_execution', 'Not approved for execution')} tone="danger" />
            <p className="text-xs text-muted-foreground">
              {productLabel(t, 'requested_mode', 'Requested mode')}: {productMode(readiness?.runtime?.requestedMode, t)}
            </p>
            <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
              <p>id: {String(selected.id || '—')}</p>
              <pre className="whitespace-pre-wrap">{JSON.stringify(selected.metadata || {}, null, 2).slice(0, 2000)}</pre>
            </TechnicalDetails>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
};
