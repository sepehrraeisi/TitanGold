import React, { useState } from 'react';
import type { ArtemisSectionProps } from '../../artemisProductTypes.ts';
import { productLabel, productLimitation, productStatus } from '../../artemisProductCopy.ts';
import { truthLabel } from '../../artemisProductTypes.ts';
import { StatusPill, TechnicalDetails, TextAction } from '../../components/ArtemisUi.tsx';
import { useAppContext } from '../../../../../context/AppContext.tsx';
import { isAdminRole } from '../../../../../utils/auth.ts';

export const SystemSection: React.FC<ArtemisSectionProps> = ({ t, readiness, onNavigate }) => {
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
      title: productLabel(t, 'artemis_dep_llm', 'LLM / AI providers'),
      role: productLabel(t, 'artemis_dep_llm_role', 'Advisory model pool'),
      status: providers?.truth === 'UNAVAILABLE'
        ? productStatus('UNAVAILABLE', t)
        : providers?.ready
          ? productLabel(t, 'artemis_dep_healthy', 'Healthy keys available')
          : productLabel(t, 'artemis_dep_degraded', 'No healthy keys'),
      tone: providers?.ready ? 'ok' : 'warning',
      truth: providers?.truth,
      limitation: providers?.truth === 'UNAVAILABLE' ? productLabel(t, 'artemis_dep_llm_unread', 'Provider health could not be read.') : null,
      action: () => onNavigate?.({ view: 'settings', settingsTab: 'configuration', settingsSubtab: 'integrations' }),
      actionLabel: productLabel(t, 'artemis_open_integrations', 'Open Integrations'),
      diag: `healthyProviders=${providers?.activeHealthy ?? 'n/a'} quorum=${providers?.quorum ?? 'n/a'}`,
    },
    {
      id: 'connections',
      title: productLabel(t, 'connections', 'Connections'),
      role: productLabel(t, 'artemis_dep_connections_role', 'Broker / exchange authentication'),
      status:
        connections?.status === 'available'
          ? productStatus('AVAILABLE', t)
          : connections?.truth === 'UNAVAILABLE'
            ? productStatus('UNAVAILABLE', t)
            : productLabel(t, 'artemis_dep_broker_unavailable', 'Broker unavailable'),
      tone: connections?.status === 'available' ? 'ok' : 'warning',
      truth: connections?.truth,
      limitation: null,
      action: () => onNavigate?.(readiness?.owners?.connections || { view: 'settings', settingsTab: 'connections' }),
      actionLabel: productLabel(t, 'artemis_open_connections', 'Open Connections'),
      diag: `count=${connections?.count ?? 'n/a'}`,
    },
    {
      id: 'datahub',
      title: 'Data Hub',
      role: productLabel(t, 'artemis_datahub_role', 'Market / external-data foundation'),
      status: dh?.status === 'available' ? productStatus('AVAILABLE', t) : productStatus('UNAVAILABLE', t),
      tone: dh?.status === 'available' ? 'ok' : 'warning',
      truth: dh?.truth,
      limitation: null,
      action: () => onNavigate?.({ view: 'ai', aiTab: 'data_hub' }),
      actionLabel: productLabel(t, 'artemis_open_data_hub', 'Open Data Hub'),
      diag: `sources=${dh?.totalSources ?? 'n/a'} active=${dh?.activeSources ?? 'n/a'}`,
    },
    {
      id: 'runtime',
      title: productLabel(t, 'artemis_runtime_safety', 'Runtime safety'),
      role: productLabel(t, 'artemis_dep_runtime_role', 'Requested/effective mode and Emergency Stop'),
      status: runtime
        ? `${productLabel(t, 'effective_mode', 'Effective mode')}: ${String(runtime.effectiveMode || '—')} · ${
            runtime.killSwitchActive ? productLabel(t, 'emergency_stop', 'Emergency Stop') : productLabel(t, 'inactive', 'Inactive')
          }`
        : productStatus('UNAVAILABLE', t),
      tone: runtime?.killSwitchActive ? 'danger' : runtime ? 'ok' : 'warning',
      truth: readiness?.runtimeTruth,
      limitation: null,
      action: () => onNavigate?.({ view: 'settings', settingsTab: 'configuration' }),
      actionLabel: productLabel(t, 'artemis_open_runtime', 'Open runtime settings'),
      diag: `requested=${runtime?.requestedMode || 'n/a'} effective=${runtime?.effectiveMode || 'n/a'}`,
    },
    {
      id: 'decision',
      title: productLabel(t, 'decision_engine', 'Decision Engine'),
      role: productLabel(t, 'artemis_dep_de_role', 'Advisory mixture configuration'),
      status: readiness?.dualConfigLimitationKey
        ? productLabel(t, 'artemis_blocker_dual_decision_config', 'Configuration ownership conflict detected')
        : productLabel(t, 'artemis_op_configured', 'Configured'),
      tone: readiness?.dualConfigLimitationKey ? 'warning' : 'info',
      truth: 'CONFIGURED',
      limitation: readiness?.dualConfigLimitationKey ? productLimitation(readiness.dualConfigLimitationKey, t) : null,
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
      title: productLabel(t, 'artemis_contract_panel', 'Agent contract readiness'),
      role: productLabel(t, 'artemis_dep_contract_role', 'Canonical evidence consumption'),
      status: productLabel(t, 'artemis_status_not_activated', 'Not activated'),
      tone: 'warning',
      truth: 'UNAVAILABLE',
      limitation: productLabel(t, 'artemis_evidence_not_activated', 'Canonical evidence integration has not been activated yet.'),
      action: undefined,
      actionLabel: '',
      diag: `contract=${readiness?.contract.contractVersion || 'n/a'}`,
    },
    {
      id: 'scheduler',
      title: productLabel(t, 'artemis_dep_scheduler', 'Scheduler relationship'),
      role: productLabel(t, 'artemis_dep_scheduler_role', 'Analytical scheduler allowlist (read-only)'),
      status: scheduler?.truth === 'UNAVAILABLE'
        ? productStatus('UNAVAILABLE', t)
        : scheduler?.stale
          ? productLabel(t, 'artemis_dep_scheduler_stale', 'Worker status stale or unread')
          : productLabel(t, 'artemis_dep_scheduler_observed', 'Observed (read-only)'),
      tone: scheduler?.stale || scheduler?.truth === 'UNAVAILABLE' ? 'warning' : 'info',
      truth: scheduler?.truth,
      limitation: productLabel(t, 'artemis_dep_scheduler_note', 'Artemis does not own or mutate the scheduler.'),
      action: undefined,
      actionLabel: '',
      diag: `allowlist=${(scheduler?.allowlist || []).join(',') || 'n/a'} running=${String(scheduler?.isRunning)}`,
    },
    {
      id: 'provenance',
      title: productLabel(t, 'artemis_dep_provenance', 'Deployment / runtime provenance'),
      role: productLabel(t, 'artemis_dep_provenance_role', 'Served runtime marker'),
      status: readiness?.provenance?.runtimeCommit || productStatus('UNAVAILABLE', t),
      tone: readiness?.provenance?.runtimeCommit ? 'info' : 'warning',
      truth: readiness?.provenance?.truth,
      limitation: null,
      action: undefined,
      actionLabel: '',
      diag: `commit=${readiness?.provenance?.runtimeCommit || 'n/a'}`,
    },
  ];

  return (
    <div className="space-y-4" data-artemis-page="system">
      <header>
        <h2 className="text-lg font-bold">{productLabel(t, 'artemis_system_workspace', 'Operational dependencies')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(t, 'artemis_system_purpose', 'Are Artemis dependencies healthy, and where are they managed?')}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card) => (
          <article key={card.id} className="bg-card border border-border rounded-lg p-4 space-y-2" data-artemis-dependency={card.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{card.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{card.role}</p>
              </div>
              <StatusPill label={String(card.status)} tone={card.tone as never} />
            </div>
            <p className="text-xs text-muted-foreground">
              {productLabel(t, 'artemis_source_of_truth', 'Source of truth')}: {truthLabel(String(card.truth || 'UNAVAILABLE'), t)}
            </p>
            {card.limitation ? <p className="text-sm">{card.limitation}</p> : null}
            {card.action ? <TextAction onClick={card.action}>{card.actionLabel}</TextAction> : null}
            <TechnicalDetails title={productLabel(t, 'artemis_diagnostics', 'Diagnostics')}>
              <p>{card.diag}</p>
            </TechnicalDetails>
          </article>
        ))}
      </div>

      {isAdmin ? (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2" data-artemis-legacy-tools="true">
          <h3 className="text-sm font-semibold">{productLabel(t, 'artemis_legacy_tools', 'Administrative / legacy tools')}</h3>
          <p className="text-sm text-muted-foreground">
            {productLabel(
              t,
              'artemis_legacy_tools_note',
              'Not automated-trading ready. Not Live authorization. Hidden from normal Artemis navigation.',
            )}
          </p>
          {!showLegacy ? (
            <TextAction onClick={() => setShowLegacy(true)}>
              {productLabel(t, 'artemis_show_legacy_status', 'Show legacy Autopilot status (read-only)')}
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
