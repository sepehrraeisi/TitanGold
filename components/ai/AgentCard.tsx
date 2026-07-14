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

interface AgentCardProps {
  agent: AIAgent;
  onOpen: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
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

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onOpen,
  isFavorite,
  onToggleFavorite,
  canOpen = true,
}) => {
  const { t } = useLanguage();
  const { dryRunForced, killSwitchActive, liveBlockReason, blockReason } = useAgentExecutionGate();
  const key = agent.agent_key || '';
  const kind = getAgentExecutionKind(key);
  const state = mapAgentOperationalState(agent.status);
  const purpose = agent.role || t('agent_purpose_fallback') || 'Agent';
  const accuracy = formatAccuracy(agent.accuracy, t('not_available') || 'N/A');
  const lastRun = formatLastRun(agent.lastUpdate, t('never_run') || 'Never run');
  const decisionsLabel = t('results_count') || t('decisions') || 'Results';
  const decisionsValue =
    agent.decisions != null && Number(agent.decisions) >= 0
      ? Number(agent.decisions).toLocaleString()
      : (t('not_available') || 'N/A');

  const openBlockedReason = !canOpen
    ? (t('execution_blocked_capability_denied') || 'Permission denied')
    : undefined;

  const showLiveBadge = kind === 'live_capable';
  const showDryRun = dryRunForced || killSwitchActive || kind === 'analytical';
  const blocked =
    showLiveBadge && liveBlockReason
      ? t(`execution_blocked_${liveBlockReason.toLowerCase()}`)
      : blockReason
        ? t(`execution_blocked_${blockReason.toLowerCase()}`)
        : null;

  const stateColor =
    state === 'ready'
      ? 'text-emerald-400'
      : state === 'running'
        ? 'text-sky-400'
        : state === 'error'
          ? 'text-red-400'
          : 'text-amber-400';

  return (
    <article
      className="bg-card/80 border border-border rounded-xl p-4 flex flex-col gap-3 relative min-h-[180px]"
      data-agent-key={key}
      data-testid={`agent-card-${key || agent.id}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="absolute top-3 right-3 text-lg leading-none opacity-80 hover:opacity-100"
        title={isFavorite ? t('remove_from_favorites') : t('add_to_favorites')}
        aria-label={isFavorite ? t('remove_from_favorites') : t('add_to_favorites')}
      >
        {isFavorite ? '★' : '☆'}
      </button>

      <header className="pr-7 space-y-1">
        <h3 className="font-semibold text-foreground text-sm leading-snug">{agent.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{purpose}</p>
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${stateColor}`}>
          {t(STATE_I18N[state]) || state}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-muted-foreground">{t('last_run') || 'Last run'}</p>
          <p className="text-foreground font-medium truncate" title={lastRun}>{lastRun}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('accuracy')}</p>
          <p className="text-foreground font-medium" data-testid="agent-accuracy-value">{accuracy}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{decisionsLabel}</p>
          <p className="text-foreground font-medium">{decisionsValue}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('execution_type') || 'Type'}</p>
          <p className="text-foreground font-medium">{t(KIND_I18N[kind]) || kind}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {showDryRun && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-100">
            {t('dry_run_badge') || 'Dry Run'}
          </span>
        )}
        {showLiveBadge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-100">
            {t('live_capable_badge') || 'Live-capable'}
          </span>
        )}
      </div>

      {blocked && (
        <p className="text-[10px] text-red-200/90 line-clamp-2" title={blocked}>
          {blocked}
        </p>
      )}

      <div className="mt-auto pt-2 border-t border-border flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          disabled={!canOpen}
          title={openBlockedReason}
          aria-disabled={!canOpen}
          data-testid={`agent-open-${key || agent.id}`}
          className="text-xs bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-1.5 px-3 rounded-md"
        >
          {t('open_agent') || 'Open Agent'}
        </button>
      </div>
    </article>
  );
};

export default AgentCard;
