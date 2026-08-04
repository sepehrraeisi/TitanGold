import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { SecondaryButton } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import {
  effectiveExecutionModeLabelKey,
  getAgentExecutionKind,
  shellOperationalStatusLabelKeyFromAgent,
} from '../shell/agentCardMeta.ts';
import { useAgentExecutionGate } from '../../../hooks/useAgentExecutionGate.ts';
import { resolveAgentProductStatus } from '../../../utils/agentProductStatus.ts';
import type { AIAgent } from '../../../types.ts';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';
import { AgentStatusItem } from './AgentStatusItem.tsx';

export type AgentProductHeaderProps = {
  agent: AIAgent;
  purpose?: string;
  onClose: () => void;
  closeTestId?: string;
  /** Canonical latest-run timestamp from overview snapshot (not agent card). */
  latestRunAt?: string | null;
  monitoringState?: 'active' | 'paused' | string;
  primaryAction?: React.ReactNode;
};

const formatLatestRun = (value: string | null | undefined, neverLabel: string) => {
  if (!value) return neverLabel;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return neverLabel;
  return d.toLocaleString();
};

export const AgentProductHeader: React.FC<AgentProductHeaderProps> = ({
  agent,
  purpose,
  onClose,
  closeTestId = 'agent-product-close',
  latestRunAt,
  monitoringState,
  primaryAction,
}) => {
  const { t } = useLanguage();
  const { killSwitchActive, effectiveMode } = useAgentExecutionGate();
  const kind = getAgentExecutionKind(agent.agent_key);
  const gateContext = { killSwitchActive, effectiveMode };
  const stateLabelKey = shellOperationalStatusLabelKeyFromAgent(agent, gateContext);
  const effectiveModeKey = effectiveExecutionModeLabelKey(effectiveMode);
  const productStatus = resolveAgentProductStatus(agent, gateContext);

  const agentStateLabel = t(stateLabelKey) || stateLabelKey;
  const agentStateTone =
    productStatus.primaryState === 'blocked' || killSwitchActive
      ? 'danger'
      : productStatus.primaryState === 'operational' || productStatus.primaryState === 'scheduled'
        ? 'success'
        : 'warning';

  const monitoringLabel =
    monitoringState === 'paused'
      ? t('pause_monitoring') || 'Paused'
      : monitoringState === 'active'
        ? t('monitoring_active') || 'Active'
        : monitoringState === 'not_scheduled'
          ? t('trend_scheduled_monitoring_off') || 'Not scheduled'
          : monitoringState === 'manual_only'
            ? t('trend_manual_analysis_available') || 'Manual analysis'
            : t('unavailable') || 'Unavailable';
  const monitoringTone =
    monitoringState === 'active'
      ? 'success'
      : monitoringState === 'paused'
        ? 'warning'
        : monitoringState === 'not_scheduled' || monitoringState === 'manual_only'
          ? 'neutral'
          : 'neutral';

  const runtimeLabel =
    t(effectiveModeKey) ||
    (effectiveMode === 'live' ? 'Live' : effectiveMode === 'demo' ? 'Demo' : 'Dry Run');

  const providerLabel =
    kind === 'provider'
      ? t('arb_provider_public_market') || 'Public market'
      : t(`execution_kind_${kind}`) || kind;

  const lastRunLabel = t('never_run') || 'Never';
  const lastRunValue = formatLatestRun(latestRunAt, lastRunLabel);
  const lastRunIsTechnical = Boolean(latestRunAt) && lastRunValue !== lastRunLabel;
  const lastRunHeading =
    productStatus.primaryState === 'operational' || productStatus.primaryState === 'scheduled'
      ? t('last_run') || 'Last run'
      : t('agent_last_recorded_run') || 'Last recorded run';

  return (
    <header
      className={`shrink-0 z-10 ${AGENT_PRODUCT_TOKENS.surfaces.headerChrome} border-b ${AGENT_PRODUCT_TOKENS.surfaces.divider} ${AGENT_PRODUCT_TOKENS.headerPadding} flex flex-wrap gap-3 items-start justify-between`}
      data-testid="agent-product-header"
    >
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          <h2 className={`${AGENT_PRODUCT_TOKENS.titleLg} text-white truncate`}>{agent.name}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
            {purpose || agent.role}
          </p>
        </div>

        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-2"
          data-testid="agent-product-status-grid"
        >
          <AgentStatusItem
            label={t('agent_state_label') || 'Agent state'}
            value={agentStateLabel}
            tone={agentStateTone}
            testId="agent-status-agent-state"
          />
          <AgentStatusItem
            label={t('monitoring_state') || 'Monitoring'}
            value={monitoringLabel}
            tone={monitoringTone}
            testId="agent-status-monitoring"
          />
          <AgentStatusItem
            label={t('runtime_mode') || 'Runtime'}
            value={runtimeLabel}
            tone="info"
            testId="agent-status-runtime"
          />
          <AgentStatusItem
            label={t('provider_mode_label') || 'Provider mode'}
            value={providerLabel}
            tone="neutral"
            testId="agent-status-provider-mode"
          />
        </div>

        <div
          className={`pt-2 border-t ${AGENT_PRODUCT_TOKENS.surfaces.divider}`}
          data-testid="agent-product-last-run-meta"
        >
          <p className="text-[11px] text-muted-foreground">
            <span className={AGENT_PRODUCT_TOKENS.labelSm.replace('uppercase ', '')}>
              {lastRunHeading}:{' '}
            </span>
            {lastRunIsTechnical ? (
              <AgentTechnicalLtr data-testid="agent-product-last-run">{lastRunValue}</AgentTechnicalLtr>
            ) : (
              <span data-testid="agent-product-last-run">{lastRunValue}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap shrink-0 max-w-full justify-end">
        {primaryAction}
        <SecondaryButton
          type="button"
          data-testid={closeTestId}
          data-variant="neutral"
          onClick={onClose}
          aria-label={t('close') || 'Close'}
        >
          {t('close') || 'Close'}
        </SecondaryButton>
      </div>
    </header>
  );
};
