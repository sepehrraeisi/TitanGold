import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { SecondaryButton } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import {
  effectiveExecutionModeLabelKey,
  getAgentExecutionKind,
  shellOperationalReasonKeyFromAgent,
  shellOperationalStatusLabelKeyFromAgent,
} from '../shell/agentCardMeta.ts';
import { useAgentExecutionGate } from '../../../hooks/useAgentExecutionGate.ts';
import { resolveAgentProductStatus } from '../../../utils/agentProductStatus.ts';
import type { AIAgent } from '../../../types.ts';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

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
  const reasonKey = shellOperationalReasonKeyFromAgent(agent, gateContext);
  const effectiveModeKey = effectiveExecutionModeLabelKey(effectiveMode);
  const operationalLabel = t(stateLabelKey) || stateLabelKey;
  const reasonLabel = reasonKey ? t(reasonKey) : null;
  const effectiveModeLabel =
    t(effectiveModeKey) ||
    (effectiveModeKey === 'execution_mode_dry_run'
      ? 'Dry Run'
      : effectiveModeKey === 'execution_mode_live'
        ? 'Live'
        : 'Demo');
  const lastRunLabel = t('never_run') || 'Never';
  const lastRunValue = formatLatestRun(latestRunAt, lastRunLabel);
  const lastRunIsTechnical = Boolean(latestRunAt) && lastRunValue !== lastRunLabel;
  const monitoringLabel =
    monitoringState === 'paused'
      ? t('pause_monitoring') || 'Paused'
      : monitoringState === 'active'
        ? t('monitoring_active') || 'Monitoring active'
        : null;
  const productStatus = resolveAgentProductStatus(agent, gateContext);
  const lastRunHeading =
    productStatus.primaryState === 'operational' || productStatus.primaryState === 'scheduled'
      ? t('last_run') || 'Last run'
      : t('agent_last_recorded_run') || 'Last recorded run';

  return (
    <header
      className={`shrink-0 z-10 bg-[#12161c]/95 border-b border-border ${AGENT_PRODUCT_TOKENS.headerPadding} flex flex-wrap gap-3 items-start justify-between`}
      data-testid="agent-product-header"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className={`${AGENT_PRODUCT_TOKENS.titleLg} text-white truncate`}>{agent.name}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
          {purpose || agent.role}
        </p>
        <div className="flex flex-wrap gap-2 text-[10px] sm:text-[11px]" data-testid="agent-product-status-row">
          <span className="px-2 py-0.5 rounded-full border border-border text-muted-foreground">
            {operationalLabel}
          </span>
          {reasonLabel ? (
            <span
              className="px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground/90"
              title={reasonLabel}
            >
              {reasonLabel}
            </span>
          ) : null}
          {monitoringLabel ? (
            <span className="px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-100">
              {monitoringLabel}
            </span>
          ) : null}
          <span className="px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-100">
            {effectiveModeLabel}
          </span>
          <span className="px-2 py-0.5 rounded-full border border-border text-muted-foreground">
            {t(`execution_kind_${kind}`) || kind}
          </span>
          <span className="px-2 py-0.5 rounded-full border border-border text-muted-foreground">
            {lastRunHeading}:{' '}
            {lastRunIsTechnical ? (
              <AgentTechnicalLtr data-testid="agent-product-last-run">{lastRunValue}</AgentTechnicalLtr>
            ) : (
              lastRunValue
            )}
          </span>
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
