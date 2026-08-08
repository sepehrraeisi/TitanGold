import React, { useState } from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import { noviceStatus, productLabel } from '../../artemisProductCopy.ts';
import { isSimpleView } from '../../artemisPresentation.ts';
import { StatusPill, TechnicalDetails, TextAction } from '../../components/ArtemisUi.tsx';
import { useAppContext } from '../../../../../context/AppContext.tsx';
import { isAdminRole } from '../../../../../utils/auth.ts';

export const SystemSection: React.FC<ArtemisSectionProps> = ({ t, readiness, onNavigate, presentation }) => {
  const simple = isSimpleView(presentation);
  const { user } = useAppContext();
  const isAdmin = isAdminRole(user?.role);
  const [showLegacy, setShowLegacy] = useState(false);
  const dh = readiness?.dataHub;
  const providers = readiness?.providers;
  const connections = readiness?.connections;
  const scheduler = readiness?.scheduler;
  const runtime = readiness?.runtime;

  const cards = [
    {
      id: 'providers',
      title: productLabel(t, 'artemis_dep_llm_simple', 'AI Providers'),
      why: productLabel(t, 'artemis_why_providers', 'Artemis uses these models to explain and combine Agent insights.'),
      status: providers?.truth === 'UNAVAILABLE'
        ? noviceStatus('UNAVAILABLE', t)
        : providers?.ready
          ? productLabel(t, 'artemis_user_ready', 'Ready')
          : productLabel(t, 'artemis_user_needs_setup', 'Needs setup'),
      tone: providers?.ready ? 'ok' : 'warning',
      action: () => onNavigate?.({ view: 'settings', settingsTab: 'configuration', settingsSubtab: 'integrations' }),
      actionLabel: productLabel(t, 'artemis_open_integrations', 'Open Integrations'),
      diag: `healthyProviders=${providers?.activeHealthy ?? 'n/a'} quorum=${providers?.quorum ?? 'n/a'}`,
    },
    {
      id: 'connections',
      title: productLabel(t, 'connections', 'Connections'),
      why: productLabel(
        t,
        'artemis_why_connections',
        'Artemis can analyze markets, but trading-related provider actions are unavailable until a broker is connected.',
      ),
      status:
        connections?.status === 'available'
          ? noviceStatus('AVAILABLE', t)
          : productLabel(t, 'artemis_dep_broker_simple', 'Broker is not connected'),
      tone: connections?.status === 'available' ? 'ok' : 'warning',
      action: () => onNavigate?.(readiness?.owners?.connections || { view: 'settings', settingsTab: 'connections' }),
      actionLabel: productLabel(t, 'artemis_open_connections', 'Open Connections'),
      diag: `count=${connections?.count ?? 'n/a'}`,
    },
    {
      id: 'datahub',
      title: 'Data Hub',
      why: productLabel(t, 'artemis_why_datahub', 'Market and external data that Agents and Artemis rely on.'),
      status: dh?.status === 'available' ? noviceStatus('AVAILABLE', t) : noviceStatus('UNAVAILABLE', t),
      tone: dh?.status === 'available' ? 'ok' : 'warning',
      action: () => onNavigate?.({ view: 'ai', aiTab: 'data_hub' }),
      actionLabel: productLabel(t, 'artemis_open_data_hub', 'Open Data Hub'),
      diag: `sources=${dh?.totalSources ?? 'n/a'} active=${dh?.activeSources ?? 'n/a'}`,
    },
    {
      id: 'runtime',
      title: productLabel(t, 'artemis_runtime_safety_simple', 'Runtime Safety'),
      why: productLabel(t, 'artemis_why_runtime', 'Keeps Demo/Live mode and Emergency Stop in charge of financial safety.'),
      status: runtime?.killSwitchActive
        ? productLabel(t, 'artemis_estop_active_short', 'Emergency Stop active')
        : runtime
          ? productLabel(t, 'artemis_user_ready', 'Ready')
          : noviceStatus('UNAVAILABLE', t),
      tone: runtime?.killSwitchActive ? 'danger' : runtime ? 'ok' : 'warning',
      action: () => onNavigate?.({ view: 'settings', settingsTab: 'configuration' }),
      actionLabel: productLabel(t, 'artemis_open_runtime', 'Open runtime settings'),
      diag: `requested=${runtime?.requestedMode || 'n/a'} effective=${runtime?.effectiveMode || 'n/a'}`,
    },
    {
      id: 'decision',
      title: productLabel(t, 'artemis_dep_engine_simple', 'Decision Engine'),
      why: productLabel(t, 'artemis_why_engine', 'Holds advisory mixture settings. It does not authorize live trading.'),
      status: readiness?.dualConfigLimitationKey
        ? productLabel(t, 'artemis_user_needs_setup', 'Needs setup')
        : productLabel(t, 'artemis_user_partial', 'Partially ready'),
      tone: readiness?.dualConfigLimitationKey ? 'warning' : 'info',
      action: () =>
        onNavigate?.(
          readiness?.owners?.decisionEngine || {
            view: 'settings',
            settingsTab: 'configuration',
            settingsSubtab: 'decision-engine',
          },
        ),
      actionLabel: productLabel(t, 'open_decision_engine_settings', 'Open Decision Engine'),
      diag: 'owner=settings.configuration.decision-engine',
    },
    {
      id: 'contract',
      title: productLabel(t, 'artemis_dep_agent_connection', 'Agent Connection'),
      why: productLabel(t, 'artemis_why_agent_connection', 'Until Agent outputs are connected, Artemis can only advise from legacy records.'),
      status: productLabel(t, 'artemis_user_not_connected', 'Not connected'),
      tone: 'warning',
      action: undefined,
      actionLabel: '',
      diag: `contract=${readiness?.contract.contractVersion || 'n/a'}`,
    },
    {
      id: 'scheduler',
      title: productLabel(t, 'artemis_dep_scheduler_simple', 'Scheduler'),
      why: productLabel(t, 'artemis_why_scheduler', 'Runs independent Agent analysis. Artemis does not change the scheduler.'),
      status: scheduler?.truth === 'UNAVAILABLE'
        ? noviceStatus('UNAVAILABLE', t)
        : scheduler?.stale
          ? productLabel(t, 'artemis_user_partial', 'Partially ready')
          : productLabel(t, 'artemis_user_ready', 'Ready'),
      tone: scheduler?.stale || scheduler?.truth === 'UNAVAILABLE' ? 'warning' : 'ok',
      action: undefined,
      actionLabel: '',
      diag: `allowlist=${(scheduler?.allowlist || []).join(',') || 'n/a'} running=${String(scheduler?.isRunning)}`,
    },
    {
      id: 'provenance',
      title: productLabel(t, 'artemis_dep_deployment_simple', 'Deployment'),
      why: productLabel(t, 'artemis_why_deployment', 'Shows which software version is currently running.'),
      status: readiness?.provenance?.runtimeCommit
        ? productLabel(t, 'artemis_user_ready', 'Ready')
        : noviceStatus('UNAVAILABLE', t),
      tone: readiness?.provenance?.runtimeCommit ? 'ok' : 'warning',
      action: undefined,
      actionLabel: '',
      diag: `commit=${readiness?.provenance?.runtimeCommit || 'n/a'}`,
    },
  ];

  return (
    <div className="space-y-4" data-artemis-page="system">
      <header>
        <h2 className="text-lg font-bold">{productLabel(t, 'artemis_system_title_simple', 'System Health')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(t, 'artemis_system_purpose_simple', 'Are the systems Artemis depends on healthy, and where do you manage them?')}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card) => (
          <article key={card.id} className="bg-card border border-border rounded-2xl p-4 space-y-2" data-artemis-dependency={card.id}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{card.title}</h3>
              <StatusPill label={String(card.status)} tone={card.tone as never} />
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{productLabel(t, 'artemis_why_it_matters', 'Why it matters')}: </span>
              {card.why}
            </p>
            {card.action ? <TextAction onClick={card.action}>{card.actionLabel}</TextAction> : null}
            {!simple ? (
              <TechnicalDetails title={productLabel(t, 'artemis_diagnostics', 'Diagnostics')}>
                <p>{card.diag}</p>
              </TechnicalDetails>
            ) : null}
          </article>
        ))}
      </div>

      {isAdmin ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2" data-artemis-legacy-tools="true">
          <h3 className="text-sm font-semibold">{productLabel(t, 'artemis_legacy_tools', 'Administrative tools')}</h3>
          <p className="text-sm text-muted-foreground">
            {productLabel(t, 'artemis_legacy_tools_note_simple', 'Not automated-trading ready. Not Live authorization.')}
          </p>
          {!showLegacy ? (
            <TextAction onClick={() => setShowLegacy(true)}>
              {productLabel(t, 'artemis_show_legacy_status', 'Show Autopilot status (read-only)')}
            </TextAction>
          ) : (
            <p className="text-sm">
              {productLabel(
                t,
                'artemis_legacy_autopilot_hidden_ops',
                'Enable Autopilot and Run Once remain server-capable but are not exposed in the product at this maturity.',
              )}
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
};
