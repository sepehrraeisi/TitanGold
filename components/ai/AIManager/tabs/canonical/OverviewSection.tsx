import React from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import {
  agentArtemisConnection,
  noviceGroup,
  noviceStatus,
  productLabel,
  productLimitation,
  productStatus,
} from '../../artemisProductCopy.ts';
import { isSimpleView } from '../../artemisPresentation.ts';
import { formatCount, resolveAdvisoryWindow, resolveAgentRunWindow } from '../../artemisActivityModel.ts';
import {
  EmptyState,
  ExpandableGroup,
  FlowNode,
  HelpTip,
  LinkAction,
  StatusPill,
  TechnicalDetails,
  TextAction,
} from '../../components/ArtemisUi.tsx';

const STAGES = [
  {
    id: 'data_ai',
    titleKey: 'artemis_stage_data_ai',
    title: 'Data & AI',
    items: (p: ReturnType<typeof stageFacts>) => p.dataAi,
  },
  {
    id: 'intelligence',
    titleKey: 'artemis_stage_intelligence',
    title: 'Artemis Intelligence',
    items: (p: ReturnType<typeof stageFacts>) => p.intelligence,
  },
  {
    id: 'safety',
    titleKey: 'artemis_stage_safety_capital',
    title: 'Safety & Capital',
    items: (p: ReturnType<typeof stageFacts>) => p.safety,
  },
  {
    id: 'execution',
    titleKey: 'artemis_stage_execution',
    title: 'Execution',
    items: (p: ReturnType<typeof stageFacts>) => p.execution,
  },
] as const;

function stageFacts(readiness: NonNullable<ArtemisSectionProps['readiness']>, t: ArtemisSectionProps['t']) {
  const catalog = readiness.catalog?.agents || [];
  const connected = catalog.filter((a) => a.evidenceCompatible || a.evidenceAvailable).length;
  const operational = catalog.filter((a) => a.operationalNow).length;
  return {
    dataAi: [
      {
        ok: readiness.dataHub?.status === 'available',
        label: productLabel(t, 'artemis_stage_datahub_ok', 'Data Hub available'),
        warn: false,
      },
      {
        ok: catalog.length >= 15,
        label: productLabel(t, 'artemis_stage_agents_detected', '{count} Agents detected').replace(
          '{count}',
          String(catalog.length || readiness.inventory?.configuredCount || 15),
        ),
        warn: false,
      },
    ],
    intelligence: [
      {
        ok: connected > 0,
        warn: operational > 0 && connected === 0,
        label:
          connected > 0
            ? productLabel(t, 'artemis_stage_outputs_connected', 'Agent outputs connected to Artemis')
            : productLabel(t, 'artemis_stage_outputs_not_connected', 'Agent outputs not yet connected to Artemis'),
      },
    ],
    safety: [
      {
        ok: readiness.controlChain?.risk?.readiness === 'AVAILABLE',
        warn: readiness.controlChain?.risk?.readiness === 'PARTIAL',
        label: productLabel(t, 'artemis_stage_risk', 'Risk available'),
      },
      {
        ok: readiness.controlChain?.portfolio?.readiness === 'AVAILABLE',
        warn: readiness.controlChain?.portfolio?.readiness === 'PARTIAL',
        label: productLabel(t, 'artemis_stage_portfolio', 'Portfolio available'),
      },
      {
        ok: false,
        warn: false,
        label: productLabel(t, 'artemis_stage_liquidity_missing', 'Liquidity validation unavailable'),
      },
    ],
    execution: [
      {
        ok: false,
        warn: false,
        label: productLabel(t, 'artemis_stage_execution_missing', 'Automated execution unavailable'),
      },
    ],
  };
}

function mark(item: { ok: boolean; warn?: boolean }) {
  if (item.ok) return '✓';
  if (item.warn) return '△';
  return '✕';
}

export const OverviewSection: React.FC<ArtemisSectionProps> = ({
  t,
  readiness,
  readinessError,
  onNavigate,
  audit,
  onOpenSection,
  presentation,
  onRetry,
}) => {
  const simple = isSimpleView(presentation);
  if (readinessError) {
    return (
      <EmptyState
        title={productLabel(t, 'artemis_readiness_error', 'Artemis status unavailable')}
        body={readinessError}
        action={onRetry ? <LinkAction onClick={onRetry}>{productLabel(t, 'retry', 'Retry')}</LinkAction> : null}
      />
    );
  }
  if (!readiness) {
    return (
      <EmptyState
        title={productLabel(t, 'loading', 'Loading')}
        body={productLabel(t, 'artemis_loading_readiness', 'Loading Artemis…')}
      />
    );
  }

  const rt = readiness.runtime;
  const catalog = readiness.catalog?.agents || [];
  const groups = [
    { id: 'analytical', expected: 7 },
    { id: 'opportunity', expected: 3 },
    { id: 'capital_risk', expected: 3 },
    { id: 'feasibility', expected: 1 },
    { id: 'execution', expected: 1 },
  ];
  const blockers = (readiness.blockers || [])
    .filter((b) => ['evidence_not_connected', 'liquidity_unavailable', 'execution_unavailable', 'orchestration_not_active'].includes(b.code))
    .slice(0, 4);
  const advisory = resolveAdvisoryWindow(readiness, audit);
  const runs = resolveAgentRunWindow(readiness, audit);
  const recentLogs = advisory.records.slice(0, 4);
  const recentRuns = runs.records.slice(0, 4);
  const facts = stageFacts(readiness, t);
  const analysisLimited = catalog.some((a) => !a.operationalNow) || (readiness.inventory?.operationalCount || 0) < 15;
  const killActive = rt?.killSwitchActive === true;

  const openNav = (nav?: { view?: string; aiTab?: string; settingsTab?: string; settingsSubtab?: string; agentId?: string; artemisSection?: string }) => {
    if (!nav) return;
    if (nav.artemisSection && onOpenSection) {
      onOpenSection(nav.artemisSection as never);
      return;
    }
    if (nav.view && onNavigate) onNavigate(nav as never);
  };

  const flow = [
    { id: 'datahub', label: 'Data Hub', status: readiness.dataHub?.status === 'available' ? noviceStatus('AVAILABLE', t) : noviceStatus('UNAVAILABLE', t), tone: readiness.dataHub?.status === 'available' ? 'ok' : 'warning', nav: { view: 'ai', aiTab: 'data_hub' } },
    { id: 'agents', label: productLabel(t, 'ai_agents', 'AI Agents'), status: productLabel(t, 'artemis_user_working', 'Working'), tone: 'ok', nav: { view: 'ai', aiTab: 'agents' } },
    { id: 'artemis', label: 'Artemis', status: noviceStatus('LEGACY_ADVISORY', t), tone: 'warning', nav: { artemisSection: 'overview' } },
    { id: 'risk', label: productLabel(t, 'artemis_flow_risk_portfolio', 'Risk & Portfolio'), status: noviceStatus('PARTIAL', t), tone: 'warning', nav: { artemisSection: 'controls' } },
    { id: 'liquidity', label: productLabel(t, 'artemis_flow_liquidity', 'Liquidity Check'), status: noviceStatus('UNAVAILABLE', t), tone: 'danger', nav: { artemisSection: 'controls' } },
    { id: 'order', label: productLabel(t, 'artemis_flow_order', 'Order Management'), status: noviceStatus('NOT_EXECUTION_ELIGIBLE', t), tone: 'danger', nav: { view: 'ai', aiTab: 'agents', agentId: 'order' } },
  ] as const;

  return (
    <div className="space-y-5" data-artemis-page="overview">
      <section className="bg-card border border-border rounded-2xl p-4 md:p-6" aria-labelledby="artemis-hero-title">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {productLabel(t, 'artemis_right_now', 'Artemis right now')}
        </p>
        <h2 id="artemis-hero-title" className="text-2xl md:text-3xl font-bold mt-1">
          {productLabel(t, 'artemis_hero_analyzing_only', 'Artemis is analyzing only')}
        </h2>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          {productLabel(t, 'artemis_hero_trading_unavailable', 'Automated trading is unavailable')}
          <HelpTip label={productLabel(t, 'artemis_help_execution_label', 'What does execution mean?')}>
            {productLabel(
              t,
              'artemis_help_execution',
              'Execution means placing a real trade. Artemis can advise, but it cannot trade until every safety check is ready.',
            )}
          </HelpTip>
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
          {[
            {
              label: productLabel(t, 'artemis_chip_ai_analysis', 'AI analysis'),
              value: analysisLimited
                ? productLabel(t, 'artemis_user_limited', 'Limited')
                : productLabel(t, 'artemis_user_ready', 'Available'),
              tone: analysisLimited ? 'warning' : 'ok',
            },
            {
              label: productLabel(t, 'artemis_chip_safety', 'Safety'),
              value: killActive
                ? productLabel(t, 'artemis_estop_active_short', 'Emergency Stop active')
                : productLabel(t, 'artemis_estop_inactive_short', 'Emergency Stop off'),
              tone: killActive ? 'danger' : 'ok',
              help: productLabel(t, 'artemis_help_estop', 'Immediately blocks financial execution while still allowing safe analysis.'),
            },
            {
              label: productLabel(t, 'artemis_chip_recommendations', 'Recommendations'),
              value: noviceStatus('LEGACY_ADVISORY', t),
              tone: 'warning',
            },
            {
              label: productLabel(t, 'artemis_chip_trading', 'Trading'),
              value: productLabel(t, 'artemis_user_unavailable', 'Unavailable'),
              tone: 'danger',
            },
          ].map((chip) => (
            <div key={chip.label} className="rounded-xl border border-border bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground">
                {chip.label}
                {'help' in chip && chip.help ? (
                  <HelpTip label={productLabel(t, 'emergency_stop', 'Emergency Stop')}>{chip.help}</HelpTip>
                ) : null}
              </p>
              <div className="mt-2">
                <StatusPill label={chip.value} tone={chip.tone as never} />
              </div>
            </div>
          ))}
        </div>
        {!simple ? (
          <TechnicalDetails title={productLabel(t, 'artemis_technical_details', 'Technical details')}>
            <p>{productLabel(t, 'artemis_maturity_legacy_advisory', 'Legacy advisory')}</p>
            <p>classification={readiness.classification}</p>
            <p>executionEligible={String(readiness.executionEligible)}</p>
          </TechnicalDetails>
        ) : null}
      </section>

      <section aria-labelledby="artemis-why-title">
        <h3 id="artemis-why-title" className="text-sm font-semibold mb-2">
          {productLabel(t, 'artemis_why_cant_trade', "Why can't Artemis trade yet?")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {STAGES.map((stage) => {
            const items = stage.items(facts);
            return (
              <ExpandableGroup
                key={stage.id}
                title={productLabel(t, stage.titleKey, stage.title)}
                summary={items.map((item) => `${mark(item)} ${item.label}`).join(' · ')}
              >
                <ul className="space-y-1 text-sm">
                  {items.map((item) => (
                    <li key={item.label}>
                      <span aria-hidden>{mark(item)}</span> {item.label}
                    </li>
                  ))}
                </ul>
              </ExpandableGroup>
            );
          })}
        </div>
        {!simple ? (
          <div className="mt-3">
            <TechnicalDetails title={productLabel(t, 'artemis_advanced_pipeline', 'Full pipeline')}>
              <ul className="space-y-1">
                {(readiness.pipeline || []).map((step) => (
                  <li key={step.id}>
                    {step.id}: {productStatus(step.status, t)}
                  </li>
                ))}
              </ul>
            </TechnicalDetails>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="artemis-how-title">
        <h3 id="artemis-how-title" className="text-sm font-semibold mb-2">
          {productLabel(t, 'artemis_how_it_works', 'How Artemis works')}
        </h3>
        <div className="flex flex-col md:flex-row md:flex-wrap gap-2 md:items-stretch">
          {flow.map((node, index) => (
            <React.Fragment key={node.id}>
              <FlowNode
                label={node.label}
                status={node.status}
                tone={node.tone as never}
                onClick={() => openNav(node.nav)}
              />
              {index < flow.length - 1 ? (
                <>
                  <div className="flex md:hidden justify-center text-muted-foreground" aria-hidden>
                    ↓
                  </div>
                  <div className="hidden md:flex items-center text-muted-foreground px-1" aria-hidden>
                    →
                  </div>
                </>
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section aria-labelledby="artemis-team-title">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 id="artemis-team-title" className="text-sm font-semibold">
            {productLabel(t, 'artemis_your_ai_team', 'Your AI team')}
          </h3>
          <TextAction onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents' })}>
            {productLabel(t, 'artemis_open_agents', 'Open Agents')}
          </TextAction>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {productLabel(t, 'artemis_team_count', '{count} AI Agents').replace('{count}', String(catalog.length || 15))}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
          {groups.map((group) => {
            const members = catalog.filter((a) => a.group === group.id);
            const operational = members.filter((a) => a.operationalNow).length;
            const connected = members.filter((a) => agentArtemisConnection(a) !== 'not_connected' && (a.evidenceCompatible || a.evidenceAvailable)).length;
            return (
              <article key={group.id} className="bg-card border border-border rounded-xl p-3">
                <p className="text-sm font-semibold">{noviceGroup(group.id, t)}</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">{members.length || group.expected}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {productLabel(t, 'artemis_group_ready_count', '{count} Agents ready').replace('{count}', String(operational))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {productLabel(t, 'artemis_group_connected_count', '{count} currently connected to Artemis').replace(
                    '{count}',
                    String(connected),
                  )}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="artemis-attention-title">
        <h3 id="artemis-attention-title" className="text-sm font-semibold mb-2">
          {productLabel(t, 'artemis_needs_attention', 'What needs attention?')}
        </h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {blockers.map((blocker) => (
            <li key={blocker.code} className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-3">
              <p className="text-sm font-semibold">
                {blocker.code === 'evidence_not_connected'
                  ? productLabel(t, 'artemis_attention_connect', 'Connect Agent intelligence')
                  : blocker.code === 'liquidity_unavailable'
                    ? productLabel(t, 'artemis_attention_liquidity', 'Liquidity validation')
                    : blocker.code === 'execution_unavailable'
                      ? productLabel(t, 'artemis_attention_execution', 'Automated trading')
                      : productLabel(t, 'artemis_attention_coordination', 'Coordination not active')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {blocker.code === 'evidence_not_connected'
                  ? productLabel(
                      t,
                      'artemis_attention_connect_body',
                      'The Agents work independently, but Artemis cannot consume their standardized outputs yet.',
                    )
                  : productLabel(t, blocker.labelKey, productLimitation(blocker.labelKey, t))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="artemis-activity-title">
        <h3 id="artemis-activity-title" className="text-sm font-semibold mb-2">
          {productLabel(t, 'artemis_recent_activity', 'Recent activity')}
        </h3>
        {advisory.kind === 'details_unavailable' || (advisory.kind === 'true_empty' && runs.kind === 'details_unavailable') ? (
          <EmptyState
            title={productLabel(t, 'artemis_activity_details_unavailable_title', 'Activity details unavailable')}
            body={productLabel(
              t,
              'artemis_activity_details_unavailable_body',
              '{count} records exist, but their details could not be loaded.',
            ).replace('{count}', formatCount((advisory.count || 0) + (runs.count || 0)))}
            action={onRetry ? <LinkAction onClick={onRetry}>{productLabel(t, 'retry', 'Retry')}</LinkAction> : null}
          />
        ) : recentLogs.length === 0 && recentRuns.length === 0 ? (
          <EmptyState
            title={productLabel(t, 'artemis_activity_empty_title', 'No recent activity')}
            body={productLabel(t, 'artemis_activity_empty_expected', 'No Artemis recommendations or Agent runs have been generated yet.')}
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {recentLogs.map((log) => (
              <li key={String(log.id || log.created_at)} className="px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</p>
                <p>{log.message || productLabel(t, 'artemis_user_advisory', 'Advisory only')}</p>
              </li>
            ))}
            {recentRuns.map((run) => (
              <li key={String(run.id || run.createdAt)} className="px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{run.createdAt ? new Date(run.createdAt).toLocaleString() : '—'}</p>
                <p>
                  {run.agentName || run.agentKey || productLabel(t, 'ai_agents', 'Agents')}
                  {run.symbol ? ` · ${run.symbol}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
