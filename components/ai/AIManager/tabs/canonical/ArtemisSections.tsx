import React from 'react';
import { OnNavigateHandler } from '../../../../types/navigation.ts';
import type { ArtemisReadiness } from '../artemisProductTypes.ts';
import { ArtemisCard, UnavailableBlock, StatusPill } from '../../components/ArtemisUi.tsx';

type CommonProps = {
  t: (key: string) => string;
  readiness: ArtemisReadiness | null;
  readinessError?: string | null;
  onNavigate?: OnNavigateHandler;
  logs?: any[];
};

const limitText = (t: (k: string) => string, key: string) =>
  t(key) !== key ? t(key) : key.replace(/^artemis_/, '').replace(/_/g, ' ');

export const OverviewSection: React.FC<CommonProps> = ({ t, readiness, readinessError }) => {
  if (readinessError) {
    return <UnavailableBlock title={t('artemis_readiness_error') || 'Readiness unavailable'} reason={readinessError} t={t} />;
  }
  if (!readiness) {
    return <UnavailableBlock title={t('loading') || 'Loading'} reason={t('artemis_loading_readiness') || 'Loading Artemis readiness…'} t={t} />;
  }
  const rt = readiness.runtime;
  return (
    <div className="space-y-4">
      <ArtemisCard title={t('artemis_readiness_title') || 'Artemis Readiness'} truth="CONFIGURED" t={t}>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={t('artemis_stage_legacy_advisory') || 'LEGACY ADVISORY'} tone="warning" />
          <StatusPill label={t('artemis_not_execution_eligible') || 'NOT EXECUTION ELIGIBLE'} tone="danger" />
          <StatusPill
            label={`${t('artemis_contract') || 'Contract'}: ${readiness.contract.contractVersion}`}
            tone="info"
          />
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {t('artemis_overview_purpose') ||
            'What can Artemis truthfully do right now? Advisory intelligence only — not automated trading.'}
        </p>
      </ArtemisCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ArtemisCard title={t('artemis_runtime_safety') || 'Runtime Safety'} truth={readiness.runtimeTruth} t={t}>
          {rt ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">{t('requested_mode') || 'Requested Mode'}</dt>
              <dd className="font-medium">{String(rt.requestedMode).toUpperCase()}</dd>
              <dt className="text-muted-foreground">{t('effective_mode') || 'Effective Mode'}</dt>
              <dd className="font-medium">{String(rt.effectiveMode).toUpperCase()}</dd>
              <dt className="text-muted-foreground">{t('emergency_stop') || 'Emergency Stop'}</dt>
              <dd className="font-medium">{rt.killSwitchActive ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}</dd>
              <dt className="text-muted-foreground">{t('execution_eligibility') || 'Execution Eligibility'}</dt>
              <dd className="font-medium text-red-600 dark:text-red-300">{t('no') || 'No'}</dd>
            </dl>
          ) : (
            <UnavailableBlock
              title={t('artemis_runtime_unavailable') || 'Runtime state unavailable'}
              reason={t('artemis_runtime_ssot_missing') || 'Canonical runtime SSOT could not be read.'}
              t={t}
            />
          )}
        </ArtemisCard>

        <ArtemisCard title={t('artemis_control_chain') || 'Control Chain'} truth="CONFIGURED" t={t}>
          <ol className="space-y-2 text-sm">
            {(['risk', 'portfolio', 'optimization', 'liquidity', 'runtime', 'order'] as const).map((k) => {
              const item = readiness.controlChain[k];
              return (
                <li key={k} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <span className="font-medium capitalize">{k}</span>
                  <span className="text-xs text-muted-foreground">
                    {item?.authority} · {item?.readiness}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted-foreground mt-2">
            {t('artemis_risk_veto_note') || 'Risk veto cannot be overridden by Artemis.'}
          </p>
        </ArtemisCard>
      </div>

      <ArtemisCard title={t('artemis_intelligence_inputs') || 'Intelligence Inputs'} truth="CONFIGURED" t={t}>
        <div className="space-y-2 text-sm">
          {Object.entries(readiness.agents).map(([group, meta]) => (
            <div key={group} className="flex flex-wrap justify-between gap-2 border-b border-border/50 pb-2">
              <span className="font-medium">{group}</span>
              <span className="text-muted-foreground">
                {meta.readiness}
                {meta.limitationKey ? ` · ${limitText(t, meta.limitationKey)}` : ''}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {t('artemis_unavailable_not_zero') || 'Unavailable is not zero or success.'}
        </p>
      </ArtemisCard>

      <ArtemisCard title={t('artemis_limitations') || 'Current Limitations'} truth="CONFIGURED" t={t}>
        <ul className="list-disc ps-5 space-y-1 text-sm text-muted-foreground">
          {readiness.limitations.map((key) => (
            <li key={key}>{limitText(t, key)}</li>
          ))}
        </ul>
      </ArtemisCard>
    </div>
  );
};

export const EvidenceSection: React.FC<CommonProps> = ({ t, readiness }) => (
  <div className="space-y-4">
    <ArtemisCard title={t('artemis_evidence_title') || 'Evidence'} truth="UNAVAILABLE" t={t}>
      <UnavailableBlock
        title={t('artemis_evidence_not_ready') || 'Canonical evidence contract not implemented yet'}
        reason={
          t('artemis_evidence_wp_b') ||
          'WP-B/WP-D will publish versioned Agent→Artemis evidence envelopes. Until then, no fabricated envelopes are shown.'
        }
        t={t}
      />
    </ArtemisCard>
    <ArtemisCard title={t('artemis_agent_role_readiness') || 'Agent role readiness'} truth="CONFIGURED" t={t}>
      <div className="space-y-2 text-sm">
        {readiness
          ? Object.entries(readiness.agents).map(([group, meta]) => (
              <div key={group} className="flex flex-wrap justify-between gap-2 border-b border-border/50 pb-2">
                <span className="font-medium">{group}</span>
                <span className="text-muted-foreground">
                  {meta.readiness} · {meta.keys.join(', ')}
                </span>
              </div>
            ))
          : null}
      </div>
    </ArtemisCard>
  </div>
);

export const DecisionsSection: React.FC<CommonProps> = ({ t, logs = [] }) => (
  <div className="space-y-4">
    <ArtemisCard title={t('artemis_decisions_title') || 'Decisions'} truth="LEGACY" t={t}>
      <div className="flex flex-wrap gap-2 mb-3">
        <StatusPill label={t('artemis_legacy_advisory') || 'Legacy Advisory'} tone="warning" />
        <StatusPill label={t('artemis_not_execution_approval') || 'NOT EXECUTION APPROVAL'} tone="danger" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t('artemis_decisions_disclaimer') ||
          'Legacy Artemis outputs may include approved:true as an advisory signal only. They must never be read as Approved for Execution.'}
      </p>
      {logs.length === 0 ? (
        <UnavailableBlock
          title={t('artemis_no_legacy_logs') || 'No legacy advisory logs available'}
          reason={t('artemis_no_legacy_logs_reason') || 'No persisted artemis_decision logs were returned for this session.'}
          t={t}
        />
      ) : (
        <ul className="space-y-3">
          {logs.slice(0, 15).map((log, idx) => (
            <li key={log.id || idx} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap gap-2 mb-1">
                <StatusPill label={t('artemis_legacy_advisory') || 'Legacy Advisory'} tone="warning" />
                <StatusPill label={t('no') || 'No'} tone="danger" />
              </div>
              <p className="text-muted-foreground text-xs">{log.created_at || log.timestamp || '—'}</p>
              <p className="mt-1">{log.message || JSON.stringify(log.metadata || log).slice(0, 240)}</p>
              <p className="text-xs mt-2 text-muted-foreground">
                {t('execution_eligibility') || 'Execution eligibility'}: {t('no') || 'No'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </ArtemisCard>
  </div>
);

export const OrchestrationSection: React.FC<CommonProps> = ({ t, readiness }) => (
  <ArtemisCard title={t('artemis_orchestration_title') || 'Orchestration'} truth="LEGACY" t={t}>
    <StatusPill label={t('artemis_legacy_orchestration') || 'Legacy Orchestration'} tone="warning" />
    <p className="text-sm text-muted-foreground mt-3">
      {t('artemis_orchestration_truth') ||
        'Canonical 15-Agent coordination is unavailable. The legacy coordinateAgents path uses mock signals and a broken identity graph.'}
    </p>
    <UnavailableBlock
      title={t('artemis_canonical_orchestration_unavailable') || 'Canonical orchestration unavailable'}
      reason={
        readiness?.orchestration?.reasonKey
          ? limitText(t, readiness.orchestration.reasonKey)
          : t('artemis_orchestration_mock_legacy') || 'Mock/legacy coordination only'
      }
      t={t}
    />
  </ArtemisCard>
);

export const ControlsSection: React.FC<CommonProps> = ({ t, readiness, onNavigate }) => (
  <div className="space-y-4">
    <ArtemisCard title={t('artemis_controls_title') || 'Controls'} truth="CONFIGURED" t={t}>
      <p className="text-sm text-muted-foreground mb-3">
        {t('artemis_controls_purpose') ||
          'Authoritative visibility for the decision control chain — not a trading panel. Artemis cannot bypass Risk.'}
      </p>
      <div className="space-y-3">
        {(
          [
            ['risk', 'veto', 'danger'],
            ['portfolio', 'sizing', 'info'],
            ['optimization', 'sizing', 'info'],
            ['liquidity', 'feasibility', 'warning'],
            ['runtime', 'runtime_safety', 'warning'],
            ['order', 'execution_only', 'neutral'],
          ] as const
        ).map(([key, auth, tone]) => {
          const item = readiness?.controlChain?.[key];
          return (
            <div key={key} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold capitalize">{key}</h4>
                <StatusPill label={auth} tone={tone as any} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('readiness') || 'Readiness'}: {item?.readiness || 'UNAVAILABLE'} · {t('truth') || 'Truth'}:{' '}
                {item?.truth || 'UNAVAILABLE'}
              </p>
              {item?.limitationKey ? (
                <p className="text-xs mt-1 text-amber-700 dark:text-amber-300">{limitText(t, item.limitationKey)}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {onNavigate ? (
        <button
          type="button"
          className="mt-4 text-sm text-blue-600 dark:text-blue-300 underline"
          onClick={() => onNavigate({ view: 'settings', settingsTab: 'configuration', settingsSubtab: 'decision-engine' })}
        >
          {t('open_decision_engine_settings') || 'Open Decision Engine settings'}
        </button>
      ) : null}
    </ArtemisCard>
  </div>
);

export const LineageSection: React.FC<CommonProps> = ({ t, logs = [] }) => (
  <div className="space-y-4">
    <ArtemisCard title={t('artemis_lineage_title') || 'Lineage & Audit'} truth="LEGACY" t={t}>
      <p className="text-sm text-muted-foreground mb-3">
        {t('artemis_lineage_disclaimer') ||
          'system_logs is not the canonical Artemis decision lineage. Canonical lineage arrives in WP-C.'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-border p-3">
          <p className="font-medium">{t('artemis_current_audit_sources') || 'Current Audit Sources'}</p>
          <p className="text-muted-foreground mt-1">system_logs (artemis_decision) · ai_decisions (Agent runs)</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="font-medium">{t('artemis_canonical_lineage_readiness') || 'Canonical Lineage Readiness'}</p>
          <p className="text-muted-foreground mt-1">{t('unavailable') || 'Unavailable'}</p>
        </div>
      </div>
    </ArtemisCard>
    <ArtemisCard title={t('artemis_legacy_decision_logs') || 'Legacy Decision Logs'} truth="LEGACY" t={t}>
      {logs.length === 0 ? (
        <UnavailableBlock
          title={t('artemis_no_legacy_logs') || 'No legacy logs'}
          reason={t('artemis_no_legacy_logs_reason') || 'No records returned.'}
          t={t}
        />
      ) : (
        <ul className="space-y-2 text-sm">
          {logs.slice(0, 20).map((log, i) => (
            <li key={log.id || i} className="border-b border-border/50 pb-2">
              <span className="text-xs text-muted-foreground">{log.created_at || '—'}</span>
              <p>{log.message || '—'}</p>
            </li>
          ))}
        </ul>
      )}
    </ArtemisCard>
  </div>
);

export const SystemSection: React.FC<CommonProps> = ({ t, readiness, onNavigate }) => (
  <div className="space-y-4">
    <ArtemisCard title={t('artemis_system_title') || 'System & Integrations'} truth="CONFIGURED" t={t}>
      <ul className="space-y-2 text-sm">
        <li>{t('artemis_llm_health_link') || 'LLM/provider health'}: /api/v1/artemis/health</li>
        <li>
          {t('artemis_dual_config_note') ||
            'Decision Engine config may exist in both artemis_state and system_config — limitation documented.'}
        </li>
      </ul>
      <div className="flex flex-wrap gap-3 mt-4">
        <button
          type="button"
          className="text-sm underline text-blue-600 dark:text-blue-300"
          onClick={() => onNavigate?.({ view: 'settings', settingsTab: 'configuration', settingsSubtab: 'decision-engine' })}
        >
          {t('decision_engine') || 'Decision Engine'}
        </button>
        <button
          type="button"
          className="text-sm underline text-blue-600 dark:text-blue-300"
          onClick={() => onNavigate?.({ view: 'settings', settingsTab: 'connections' })}
        >
          {t('connections') || 'Connections'}
        </button>
        <button
          type="button"
          className="text-sm underline text-blue-600 dark:text-blue-300"
          onClick={() => onNavigate?.({ view: 'ai' /* Data Hub remains closed product; link via AI Center manager legacy only if needed */ })}
        >
          {t('ai_center') || 'AI Center'}
        </button>
      </div>
      {readiness?.dualConfigLimitationKey ? (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          {limitText(t, readiness.dualConfigLimitationKey)}
        </p>
      ) : null}
    </ArtemisCard>
  </div>
);
