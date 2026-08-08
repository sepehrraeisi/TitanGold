import React, { useMemo, useState } from 'react';
import type { ArtemisAuditLog, ArtemisSectionProps } from '../../artemisProductTypes.ts';
import { noviceStatus, productLabel } from '../../artemisProductCopy.ts';
import { isSimpleView } from '../../artemisPresentation.ts';
import { formatCount, resolveAdvisoryWindow, resolveRecordWindow } from '../../artemisActivityModel.ts';
import {
  ARTEMIS_FOCUS,
  AlertBanner,
  DetailDrawer,
  EmptyState,
  Field,
  FilterBar,
  HelpTip,
  LinkAction,
  MetricCard,
  NativeInput,
  NativeSelect,
  SectionHeader,
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
      <SectionHeader
        title={productLabel(t, 'artemis_recs_title', 'Recommendations')}
        subtitle={productLabel(t, 'artemis_recs_purpose', 'Artemis recommendations are informational and cannot place trades.')}
        actions={
          <HelpTip label={productLabel(t, 'artemis_help_recs_label', 'What is a recommendation?')}>
            {productLabel(
              t,
              'artemis_help_recs',
              'A recommendation is informational advice. It cannot place a trade by itself.',
            )}
          </HelpTip>
        }
      />

      <div data-artemis-advisory-banner="true">
        <AlertBanner variant="warning">
          <StatusPill label={productLabel(t, 'artemis_recs_banner', 'Current recommendations are advisory only.')} tone="warning" />
        </AlertBanner>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricCard
          label={productLabel(t, 'artemis_recs_status', 'Status')}
          value={noviceStatus('LEGACY_ADVISORY', t)}
          color="amber"
        />
        <MetricCard
          label={productLabel(t, 'artemis_latest_decision', 'Latest recommendation')}
          value={latest ? new Date(latest).toLocaleString() : '—'}
          color="purple"
        />
        <MetricCard
          label={productLabel(t, 'artemis_records_available', 'Records available')}
          value={<span data-artemis-advisory-count={String(windowState.count ?? '')}>{formatCount(windowState.count)}</span>}
          color="blue"
          hint={
            windowState.showingPartialWindow
              ? productLabel(t, 'artemis_showing_recent_of', 'Showing the most recent {shown} of {total}')
                  .replace('{shown}', formatCount(windowState.loadedCount))
                  .replace('{total}', formatCount(windowState.count))
              : undefined
          }
        />
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
                className={`w-full text-start rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-3 backdrop-blur-sm space-y-1.5 ${ARTEMIS_FOCUS}`}
                onClick={() => setSelected(log)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold font-mono">{advisorySymbol(log)}</p>
                  <StatusPill label={noviceStatus('LEGACY_ADVISORY', t)} tone="warning" />
                </div>
                <p className="text-xs">
                  {productLabel(t, 'artemis_recs_suggestion', 'Suggestion')}: {advisoryAction(log)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {productLabel(t, 'artemis_recs_generated', 'Generated')}:{' '}
                  {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                </p>
                <p className="text-[11px] font-medium text-sky-300">
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
          <div className="space-y-3 text-xs">
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
