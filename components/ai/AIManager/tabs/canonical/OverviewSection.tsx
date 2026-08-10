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
  ARTEMIS_ROW,
  AlertBanner,
  EmptyState,
  ExpandableGroup,
  FlowNode,
  HelpTip,
  LinkAction,
  MetricCard,
  SectionHeader,
  TechnicalDetails,
  TextAction,
  toneToMetric,
} from '../../components/ArtemisUi.tsx';

const STAGES = [
  {
    id: 'data_ai',
    titleKey: 'artemis_stage_data_ai',
    title: 'Data & AI',
    accent: 'emerald' as const,
    items: (p: ReturnType<typeof stageFacts>) => p.dataAi,
  },
  {
    id: 'intelligence',
    titleKey: 'artemis_stage_intelligence',
    title: 'Artemis Intelligence',
    accent: 'purple' as const,
    items: (p: ReturnType<typeof stageFacts>) => p.intelligence,
  },
  {
    id: 'safety',
    titleKey: 'artemis_stage_safety_capital',
    title: 'Safety & Capital',
    accent: 'amber' as const,
    items: (p: ReturnType<typeof stageFacts>) => p.safety,
  },
  {
    id: 'execution',
    titleKey: 'artemis_stage_execution',
    title: 'Execution',
    accent: 'red' as const,
    items: (p: ReturnType<typeof stageFacts>) => p.execution,
  },
] as const;

const TEAM_ACCENT = {
  analytical: 'purple',
  opportunity: 'blue',
  capital_risk: 'amber',
  feasibility: 'red',
  execution: 'red',
} as const;

function stageFacts(readiness: NonNullable<ArtemisSectionProps['readiness']>, t: ArtemisSectionProps['t']) {
  const catalog = readiness.catalog?.agents || [];
  const artemisConsumable =
    readiness.evidence?.artemisConsumable === true || readiness.contract?.artemisConsumable === true;
  const connected = artemisConsumable
    ? catalog.filter((a) => a.evidenceCompatible || a.evidenceAvailable).length
    : 0;
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
    <div className="space-y-4" data-artemis-page="overview">
      <section
        className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-slate-950/80 to-slate-900/80 p-4 md:p-5 backdrop-blur-sm"
        aria-labelledby="artemis-hero-title"
        data-artemis-hero="true"
      >
        <p className="text-[11px] text-muted-foreground">
          {productLabel(t, 'artemis_right_now', 'Artemis right now')}
        </p>
        <h2 id="artemis-hero-title" className="text-base md:text-lg font-semibold mt-1 text-foreground">
          {productLabel(t, 'artemis_hero_analyzing_only', 'Artemis is analyzing only')}
        </h2>
        <p className="text-[11px] text-muted-foreground mt-1">
          {productLabel(t, 'artemis_hero_trading_unavailable', 'Automated trading is unavailable')}
          <HelpTip label={productLabel(t, 'artemis_help_execution_label', 'What does execution mean?')}>
            {productLabel(
              t,
              'artemis_help_execution',
              'Execution means placing a real trade. Artemis can advise, but it cannot trade until every safety check is ready.',
            )}
          </HelpTip>
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
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
            <MetricCard
              key={chip.label}
              label={chip.label}
              value={chip.value}
              color={toneToMetric(chip.tone)}
              badge={'help' in chip && chip.help ? (
                <HelpTip label={productLabel(t, 'emergency_stop', 'Emergency Stop')}>{chip.help}</HelpTip>
              ) : null}
            />
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
        <SectionHeader title={productLabel(t, 'artemis_why_cant_trade', "Why can't Artemis trade yet?")} titleId="artemis-why-title" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {STAGES.map((stage) => {
            const items = stage.items(facts);
            return (
              <ExpandableGroup
                key={stage.id}
                title={productLabel(t, stage.titleKey, stage.title)}
                summary={items.map((item) => `${mark(item)} ${item.label}`).join(' · ')}
                accent={stage.accent}
              >
                <ul className="space-y-1 text-xs">
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
        <SectionHeader title={productLabel(t, 'artemis_how_it_works', 'How Artemis works')} titleId="artemis-how-title" />
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
        <SectionHeader
          title={productLabel(t, 'artemis_your_ai_team', 'Your AI team')}
          titleId="artemis-team-title"
          subtitle={productLabel(t, 'artemis_team_count', '{count} AI Agents').replace('{count}', String(catalog.length || 15))}
          actions={
            <TextAction onClick={() => onNavigate?.({ view: 'ai', aiTab: 'agents' })}>
              {productLabel(t, 'artemis_open_agents', 'Open Agents')}
            </TextAction>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2">
          {groups.map((group) => {
            const members = catalog.filter((a) => a.group === group.id);
            const operational = members.filter((a) => a.operationalNow).length;
            const connected = members.filter((a) => agentArtemisConnection(a) !== 'not_connected' && (a.evidenceCompatible || a.evidenceAvailable)).length;
            return (
              <MetricCard
                key={group.id}
                label={noviceGroup(group.id, t)}
                value={members.length || group.expected}
                color={TEAM_ACCENT[group.id]}
                hint={`${productLabel(t, 'artemis_group_ready_count', '{count} Agents ready').replace('{count}', String(operational))} · ${productLabel(t, 'artemis_group_connected_count', '{count} currently connected to Artemis').replace('{count}', String(connected))}`}
              />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="artemis-attention-title">
        <SectionHeader title={productLabel(t, 'artemis_needs_attention', 'What needs attention?')} titleId="artemis-attention-title" />
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {blockers.map((blocker) => {
            const blocking = blocker.code === 'liquidity_unavailable' || blocker.code === 'execution_unavailable';
            return (
              <li key={blocker.code}>
                <AlertBanner variant={blocking ? 'error' : 'warning'} title={
                  blocker.code === 'evidence_not_connected'
                    ? productLabel(t, 'artemis_attention_connect', 'Connect Agent intelligence')
                    : blocker.code === 'liquidity_unavailable'
                      ? productLabel(t, 'artemis_attention_liquidity', 'Liquidity validation')
                      : blocker.code === 'execution_unavailable'
                        ? productLabel(t, 'artemis_attention_execution', 'Automated trading')
                        : productLabel(t, 'artemis_attention_coordination', 'Coordination not active')
                }>
                  {blocker.code === 'evidence_not_connected'
                    ? productLabel(
                        t,
                        'artemis_attention_connect_body',
                        'The Agents work independently, but Artemis cannot consume their standardized outputs yet.',
                      )
                    : productLabel(t, blocker.labelKey, productLimitation(blocker.labelKey, t))}
                </AlertBanner>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="artemis-activity-title">
        <SectionHeader title={productLabel(t, 'artemis_recent_activity', 'Recent activity')} titleId="artemis-activity-title" />
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
          <ul className="space-y-2">
            {recentLogs.map((log) => (
              <li key={String(log.id || log.created_at)} className={ARTEMIS_ROW}>
                <p className="text-[11px] text-muted-foreground">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</p>
                <p className="text-xs mt-0.5">{log.message || productLabel(t, 'artemis_user_advisory', 'Advisory only')}</p>
              </li>
            ))}
            {recentRuns.map((run) => (
              <li key={String(run.id || run.createdAt)} className={ARTEMIS_ROW}>
                <p className="text-[11px] text-muted-foreground">{run.createdAt ? new Date(run.createdAt).toLocaleString() : '—'}</p>
                <p className="text-xs mt-0.5">
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
