import React from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import {
  productLabel,
  productLimitation,
  productMode,
  productStatus,
  statusTone,
} from '../../artemisProductCopy.ts';
import { EmptyState, LinkAction, PipelineStep, PipelineTrack, StatusPill, TextAction } from '../../components/ArtemisUi.tsx';

export const OverviewSection: React.FC<ArtemisSectionProps> = ({
  t,
  readiness,
  readinessError,
  onNavigate,
  audit,
  onOpenSection,
}) => {
  if (readinessError) {
    return (
      <EmptyState
        title={productLabel(t, 'artemis_readiness_error', 'Readiness unavailable')}
        body={readinessError}
      />
    );
  }
  if (!readiness) {
    return (
      <EmptyState
        title={productLabel(t, 'loading', 'Loading')}
        body={productLabel(t, 'artemis_loading_readiness', 'Loading Artemis readiness…')}
      />
    );
  }

  const rt = readiness.runtime;
  const catalog = readiness.catalog?.agents || [];
  const groups = [
    { id: 'analytical', label: productLabel(t, 'artemis_group_analytical', 'Analytical intelligence') },
    { id: 'opportunity', label: productLabel(t, 'artemis_group_opportunity', 'Opportunity & forecasting') },
    { id: 'capital_risk', label: productLabel(t, 'artemis_group_capital_risk', 'Capital & risk') },
    { id: 'feasibility', label: productLabel(t, 'artemis_group_feasibility', 'Execution feasibility') },
    { id: 'execution', label: productLabel(t, 'artemis_group_execution', 'Execution') },
  ];
  const blockers = (readiness.blockers || []).slice(0, 5);
  const recentLogs = (audit?.systemLogs || []).slice(0, 4);
  const recentRuns = (readiness.agentRuns?.recent || audit?.decisions || []).slice(0, 4);
  const hasActivity = recentLogs.length > 0 || recentRuns.length > 0;
  const refreshed = readiness.generatedAt
    ? new Date(readiness.generatedAt).toLocaleString()
    : productLabel(t, 'artemis_status_unavailable', 'Unavailable');

  const openNav = (nav?: { view?: string; aiTab?: string; settingsTab?: string; settingsSubtab?: string; agentId?: string; artemisSection?: string }) => {
    if (!nav) return;
    if (nav.artemisSection && onOpenSection) {
      onOpenSection(nav.artemisSection as never);
      return;
    }
    if (nav.view && onNavigate) onNavigate(nav as never);
  };

  return (
    <div className="space-y-5" data-artemis-page="overview">
      <section className="bg-card border border-border rounded-xl p-4 md:p-5" aria-labelledby="artemis-hero-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="artemis-hero-title" className="text-lg md:text-xl font-bold">
              {productLabel(t, 'artemis_hero_title', 'What Artemis can do now')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {productLabel(
                t,
                'artemis_hero_purpose',
                'Advisory intelligence only. Artemis cannot approve or place live orders.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={productStatus(readiness.maturityStage, t)} tone="warning" />
            <StatusPill label={productStatus('NOT_EXECUTION_ELIGIBLE', t)} tone="danger" />
          </div>
        </div>
        <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_advisory_capability', 'Advisory capability')}</dt>
            <dd className="font-semibold mt-1">{productLabel(t, 'artemis_advisory_active', 'Active (legacy)')}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{productLabel(t, 'requested_mode', 'Requested mode')}</dt>
            <dd className="font-semibold mt-1">{rt ? productMode(rt.requestedMode, t) : productStatus('UNAVAILABLE', t)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{productLabel(t, 'effective_mode', 'Effective mode')}</dt>
            <dd className="font-semibold mt-1">{rt ? productMode(rt.effectiveMode, t) : productStatus('UNAVAILABLE', t)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{productLabel(t, 'emergency_stop', 'Emergency Stop')}</dt>
            <dd className="font-semibold mt-1">
              {rt
                ? rt.killSwitchActive
                  ? productLabel(t, 'active', 'Active')
                  : productLabel(t, 'inactive', 'Inactive')
                : productStatus('UNAVAILABLE', t)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{productLabel(t, 'artemis_last_refresh', 'Last readiness refresh')}</dt>
            <dd className="font-semibold mt-1 text-xs md:text-sm">{refreshed}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="artemis-pipeline-title">
        <h3 id="artemis-pipeline-title" className="text-sm font-semibold mb-2">
          {productLabel(t, 'artemis_pipeline_title', 'Readiness pipeline')}
        </h3>
        <PipelineTrack>
          {(readiness.pipeline || []).map((step, index, arr) => (
            <PipelineStep
              key={step.id}
              index={index}
              label={productLabel(t, step.labelKey, step.id)}
              status={productStatus(step.status, t)}
              owner={productLabel(t, step.ownerKey, step.ownerKey)}
              blocker={step.blockerKey ? productLimitation(step.blockerKey, t) : null}
              tone={statusTone(step.status)}
              onOpen={step.nav ? () => openNav(step.nav) : undefined}
              openLabel={productLabel(t, 'artemis_open_owner', 'Open owner')}
              isLast={index === arr.length - 1}
            />
          ))}
        </PipelineTrack>
      </section>

      <section aria-labelledby="artemis-agents-summary-title">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 id="artemis-agents-summary-title" className="text-sm font-semibold">
            {productLabel(t, 'artemis_agent_summary_title', 'Agent intelligence summary')}
          </h3>
          <TextAction onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents' })}>
            {productLabel(t, 'artemis_open_agents', 'Open Agents')}
          </TextAction>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
          {groups.map((group) => {
            const members = catalog.filter((a) => a.group === group.id);
            const operational = members.filter((a) => a.operationalNow).length;
            return (
              <div key={group.id} className="bg-card border border-border rounded-lg p-3">
                <p className="text-sm font-semibold">{group.label}</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">
                  {members.length || '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {productLabel(t, 'artemis_operational_count', '{count} operational').replace(
                    '{count}',
                    String(readiness.inventory?.truth === 'UNAVAILABLE' ? '—' : operational),
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="artemis-blockers-title">
        <h3 id="artemis-blockers-title" className="text-sm font-semibold mb-2">
          {productLabel(t, 'artemis_important_blockers', 'Important blockers')}
        </h3>
        <ul className="space-y-2">
          {blockers.map((blocker) => (
            <li key={blocker.code} className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-sm">
              {productLabel(t, blocker.labelKey, productLimitation(blocker.labelKey, t))}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="artemis-activity-title">
        <h3 id="artemis-activity-title" className="text-sm font-semibold mb-2">
          {productLabel(t, 'artemis_recent_activity', 'Recent activity')}
        </h3>
        {!hasActivity ? (
          <EmptyState
            title={productLabel(t, 'artemis_activity_empty_title', 'No recent activity')}
            body={productLabel(t, 'artemis_activity_empty_body', 'No persisted advisory records or Agent runs are available yet.')}
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {recentLogs.map((log) => (
              <li key={log.id || log.created_at} className="px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{log.created_at || '—'}</p>
                <p>{log.message || productLabel(t, 'artemis_legacy_advisory', 'Legacy advisory')}</p>
              </li>
            ))}
            {recentRuns.map((run) => (
              <li key={run.id || run.createdAt} className="px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{run.createdAt || '—'}</p>
                <p>
                  {run.agentName || run.agentKey || productLabel(t, 'ai_agents', 'Agents')}
                  {run.symbol ? ` · ${run.symbol}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="artemis-quick-nav-title" className="flex flex-wrap gap-2">
        <h3 id="artemis-quick-nav-title" className="sr-only">
          {productLabel(t, 'artemis_quick_nav', 'Quick navigation')}
        </h3>
        <LinkAction onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents' })}>
          {productLabel(t, 'artemis_open_agents', 'Open Agents')}
        </LinkAction>
        <LinkAction onClick={() => onNavigate?.({ view: 'ai', aiTab: 'data_hub' })}>
          {productLabel(t, 'artemis_open_data_hub', 'Open Data Hub')}
        </LinkAction>
        <LinkAction
          onClick={() =>
            onNavigate?.({ view: 'settings', settingsTab: 'configuration', settingsSubtab: 'decision-engine' })
          }
        >
          {productLabel(t, 'open_decision_engine_settings', 'Open Decision Engine')}
        </LinkAction>
        <LinkAction onClick={() => onNavigate?.({ view: 'settings', settingsTab: 'connections' })}>
          {productLabel(t, 'connections', 'Connections')}
        </LinkAction>
      </section>
    </div>
  );
};
