import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { AIAgent } from '../../types.ts';
import {
  formatAccuracy,
  formatLastRun,
  getAgentExecutionKind,
  mapAgentOperationalState,
} from './shell/agentCardMeta.ts';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import {
  AGENT_CARD_SHELL,
  BTN_PRIMARY,
  MetricCard,
  StatusPill,
} from './shell/agentsShellUi.ts';

interface AgentCardProps {
  agent: AIAgent;
  onOpen: () => void;
  canOpen?: boolean;
}

const KIND_I18N: Record<string, string> = {
  analytical: 'execution_kind_analytical',
  provider: 'execution_kind_provider',
  simulation: 'execution_kind_simulation',
  live_capable: 'execution_kind_live_capable',
};

const STATE_I18N: Record<string, string> = {
  ready: 'agent_state_ready',
  running: 'agent_state_running',
  paused: 'agent_state_paused',
  error: 'agent_state_error',
  unavailable: 'agent_state_unavailable',
};

const STATE_PILL: Record<string, 'success' | 'info' | 'warning' | 'error' | 'neutral'> = {
  ready: 'success',
  running: 'info',
  paused: 'warning',
  error: 'error',
  unavailable: 'neutral',
};

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onOpen,
  canOpen = true,
}) => {
  const { t } = useLanguage();
  const { dryRunForced, killSwitchActive, liveBlockReason, blockReason } = useAgentExecutionGate();
  const key = agent.agent_key || '';
  const kind = getAgentExecutionKind(key);
  const state = mapAgentOperationalState(agent.status);
  const purpose = agent.role || t('agent_purpose_fallback') || 'Agent';
  const accuracy = formatAccuracy(agent.accuracy, t('not_available') || 'N/A');
  const lastRun = formatLastRun(agent.lastUpdate, t('never_run') || 'Never');
  const decisionsLabel = t('results_count') || 'Results';
  const resultsHint =
    t('results_count_hint') ||
    'Documented result/decision count from the agent summary. N/A when unknown.';
  const decisionsValue =
    agent.decisions != null && Number(agent.decisions) >= 0
      ? Number(agent.decisions).toLocaleString()
      : (t('not_available') || 'N/A');

  const openBlockedReason = !canOpen
    ? (t('execution_blocked_capability_denied') || 'Permission denied')
    : undefined;

  const showLiveBadge = kind === 'live_capable';
  const showDryRun = dryRunForced || killSwitchActive || kind === 'analytical';
  const blockedMessage =
    showLiveBadge && liveBlockReason
      ? t(`execution_blocked_${liveBlockReason.toLowerCase()}`)
      : blockReason
        ? t(`execution_blocked_${blockReason.toLowerCase()}`)
        : null;
  const isBlocked = Boolean(blockedMessage) && showLiveBadge;

  return (
    <article
      className={AGENT_CARD_SHELL}
      data-agent-key={key}
      data-testid={`agent-card-${key || agent.id}`}
    >
      <header className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground leading-snug min-w-0">
            {agent.name}
          </h3>
          <StatusPill
            label={t(STATE_I18N[state]) || state}
            variant={STATE_PILL[state] || 'neutral'}
            className="shrink-0 uppercase tracking-wide"
          />
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{purpose}</p>
      </header>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('agent_metrics') || 'Agent metrics'}>
        <MetricCard
          label={t('last_run') || 'Last Run'}
          value={lastRun}
          color="blue"
          valueTooltip={lastRun}
          valueState={lastRun === (t('never_run') || 'Never') || lastRun === 'Never' ? 'unavailable' : 'loaded'}
        />
        <div title={resultsHint}>
          <MetricCard
            label={decisionsLabel}
            value={decisionsValue}
            color="purple"
            valueState={decisionsValue === (t('not_available') || 'N/A') ? 'unavailable' : 'loaded'}
          />
        </div>
        <MetricCard
          label={t('accuracy')}
          value={<span data-testid="agent-accuracy-value">{accuracy}</span>}
          color="emerald"
          valueState={accuracy === (t('not_available') || 'N/A') || accuracy === 'N/A' ? 'unavailable' : 'loaded'}
        />
        <MetricCard
          label={t('execution_type') || 'Execution Type'}
          value={t(KIND_I18N[kind]) || kind}
          color="amber"
        />
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label={t('agent_safety_badges') || 'Safety'}>
        {showDryRun && (
          <StatusPill label={t('dry_run_badge') || 'Dry Run'} variant="warning" />
        )}
        {kind === 'analytical' && (
          <StatusPill label={t('execution_kind_analytical') || 'Analytical'} variant="info" />
        )}
        {kind === 'provider' && (
          <StatusPill label={t('execution_kind_provider') || 'Provider'} variant="primary" />
        )}
        {kind === 'simulation' && (
          <StatusPill label={t('execution_kind_simulation') || 'Simulation'} variant="info" />
        )}
        {showLiveBadge && (
          <StatusPill label={t('live_capable_badge') || 'Live-capable'} variant="error" />
        )}
        {isBlocked && (
          <StatusPill
            label={t('blocked_badge') || 'Blocked'}
            variant="error"
            title={blockedMessage || undefined}
          />
        )}
      </div>

      <div className="mt-auto pt-1 border-t border-white/5 flex justify-stretch sm:justify-end">
        <button
          type="button"
          onClick={onOpen}
          disabled={!canOpen}
          title={openBlockedReason}
          aria-disabled={!canOpen}
          aria-label={
            openBlockedReason
              ? `${t('open_agent') || 'Open Agent'} — ${openBlockedReason}`
              : (t('open_agent') || 'Open Agent')
          }
          data-testid={`agent-open-${key || agent.id}`}
          className={`${BTN_PRIMARY} w-full sm:w-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`}
        >
          {t('open_agent') || 'Open Agent'}
        </button>
      </div>
    </article>
  );
};

export default AgentCard;
