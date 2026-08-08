import React, { useMemo, useState } from 'react';
import type { ArtemisAuditLog, ArtemisSectionProps } from '../../artemisProductTypes.ts';
import { noviceStatus, productLabel } from '../../artemisProductCopy.ts';
import { isSimpleView } from '../../artemisPresentation.ts';
import { formatCount, resolveAdvisoryWindow, resolveRecordWindow } from '../../artemisActivityModel.ts';
import {
  DetailDrawer,
  EmptyState,
  Field,
  FilterBar,
  HelpTip,
  LinkAction,
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
  return String(decision.action || meta.action || '').toUpperCase() || 'HOLD';
}

function advisorySymbol(log: ArtemisAuditLog): string {
  const meta = metaOf(log);
  const opportunity = (meta.opportunity as Record<string, unknown> | undefined) || {};
  return String(opportunity.symbol || meta.symbol || '—');
}

export const DecisionsSection: React.FC<ArtemisSectionProps> = ({ t, readiness, audit, presentation, onRetry }) => {
  const simple = isSimpleView(presentation);
  const windowState = resolveAdvisoryWindow(readiness, audit);
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState('');
  const [selected, setSelected] = useState<ArtemisAuditLog | null>(null);

  const filtered = useMemo(() => {
    return windowState.records.filter((log) => {
      if (action !== 'all' && advisoryAction(log) !== action) return false;
      if (from && log.created_at && new Date(log.created_at) < new Date(from)) return false;
      return true;
    });
  }, [windowState.records, action, from]);

  const filteredWindow = resolveRecordWindow({
    persistedCount: windowState.count,
    latestAt: windowState.latestAt,
    primaryRecords: windowState.records,
    filteredRecords: filtered,
    limit: windowState.limit,
  });

  const latest = windowState.latestAt || windowState.records[0]?.created_at || null;

  return (
    <div className="space-y-4" data-artemis-page="decisions">
      <header>
        <h2 className="text-lg font-bold">
          {productLabel(t, 'artemis_recs_title', 'Recommendations')}
          <HelpTip label={productLabel(t, 'artemis_help_recs_label', 'What is a recommendation?')}>
            {productLabel(
              t,
              'artemis_help_recs',
              'A recommendation is informational advice. It cannot place a trade by itself.',
            )}
          </HelpTip>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(t, 'artemis_recs_purpose', 'Artemis recommendations are informational and cannot place trades.')}
        </p>
      </header>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3" data-artemis-advisory-banner="true">
        <StatusPill label={productLabel(t, 'artemis_recs_banner', 'Current recommendations are advisory only.')} tone="warning" />
      </section>

      <section className="bg-card border border-border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{productLabel(t, 'artemis_recs_status', 'Status')}</p>
          <p className="font-semibold mt-1">{noviceStatus('LEGACY_ADVISORY', t)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{productLabel(t, 'artemis_latest_decision', 'Latest recommendation')}</p>
          <p className="font-semibold mt-1 text-xs md:text-sm">{latest ? new Date(latest).toLocaleString() : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{productLabel(t, 'artemis_records_available', 'Records available')}</p>
          <p className="font-semibold mt-1 tabular-nums" data-artemis-advisory-count={String(windowState.count ?? '')}>
            {formatCount(windowState.count)}
          </p>
          {windowState.showingPartialWindow ? (
            <p className="text-xs text-muted-foreground mt-1">
              {productLabel(t, 'artemis_showing_recent_of', 'Showing the most recent {shown} of {total}')
                .replace('{shown}', formatCount(windowState.loadedCount))
                .replace('{total}', formatCount(windowState.count))}
            </p>
          ) : null}
        </div>
      </section>

      {windowState.detailsAvailable ? (
        <FilterBar>
          <Field label={productLabel(t, 'artemis_filter_action', 'Suggestion')}>
            <NativeSelect value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">{productLabel(t, 'all', 'All')}</option>
              {['BUY', 'SELL', 'HOLD'].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={productLabel(t, 'artemis_filter_from', 'From date')}>
            <NativeInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        </FilterBar>
      ) : null}

      {filteredWindow.kind === 'details_unavailable' ? (
        <EmptyState
          title={productLabel(t, 'artemis_recs_details_unavailable_title', 'Recommendation details unavailable')}
          body={productLabel(
            t,
            'artemis_recs_details_unavailable_body',
            '{count} advisory records exist, but their details could not be loaded.',
          ).replace('{count}', formatCount(windowState.count))}
          action={onRetry ? <LinkAction onClick={onRetry}>{productLabel(t, 'retry', 'Retry')}</LinkAction> : null}
        />
      ) : filteredWindow.kind === 'true_empty' ? (
        <EmptyState
          title={productLabel(t, 'artemis_recs_true_empty_title', 'No recommendations yet')}
          body={productLabel(t, 'artemis_recs_true_empty_body', 'No recommendations have been generated yet.')}
        />
      ) : filteredWindow.kind === 'filtered_empty' ? (
        <EmptyState
          title={productLabel(t, 'artemis_recs_filter_empty_title', 'No matching recommendations')}
          body={productLabel(t, 'artemis_recs_filter_empty_body', 'Try clearing filters to see the recent recommendation window.')}
        />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filtered.map((log) => (
            <li key={String(log.id || log.created_at)}>
              <button
                type="button"
                className="w-full text-start bg-card border border-border rounded-2xl p-4 space-y-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={() => setSelected(log)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-bold">{advisorySymbol(log)}</p>
                  <StatusPill label={noviceStatus('LEGACY_ADVISORY', t)} tone="warning" />
                </div>
                <p className="text-sm">
                  {productLabel(t, 'artemis_recs_suggestion', 'Suggestion')}: {advisoryAction(log)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {productLabel(t, 'artemis_recs_generated', 'Generated')}:{' '}
                  {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                </p>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {productLabel(t, 'artemis_recs_why', 'Why? Open details')}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DetailDrawer
        open={Boolean(selected)}
        title={productLabel(t, 'artemis_decision_details', 'Recommendation details')}
        onClose={() => setSelected(null)}
        closeLabel={productLabel(t, 'close', 'Close')}
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <p>
              {advisorySymbol(selected)} · {advisoryAction(selected)}
            </p>
            <StatusPill label={productLabel(t, 'artemis_recs_banner', 'Current recommendations are advisory only.')} tone="warning" />
            <p>{selected.message || '—'}</p>
            {!simple ? (
              <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
                <p>id: {String(selected.id || '—')}</p>
                <pre className="whitespace-pre-wrap">{JSON.stringify(selected.metadata || {}, null, 2).slice(0, 2000)}</pre>
              </TechnicalDetails>
            ) : null}
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
};
