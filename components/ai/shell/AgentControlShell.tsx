import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { AIAgent } from '../../../types.ts';
import {
  formatLastRun,
  getAgentExecutionKind,
  mapAgentOperationalState,
} from './agentCardMeta.ts';
import { useAgentExecutionGate } from '../../../hooks/useAgentExecutionGate.ts';

export interface AgentControlShellProps {
  agent: AIAgent;
  onClose: () => void;
  purpose?: string;
  primaryAction?: React.ReactNode;
  summary?: React.ReactNode;
  results?: React.ReactNode;
  history?: React.ReactNode;
  settings?: React.ReactNode;
  integrations?: React.ReactNode;
  safetyExtra?: React.ReactNode;
  children?: React.ReactNode;
  /** When true, render only chrome + children (agent owns tabs). */
  embedChildren?: boolean;
}

/**
 * Shared Control Panel shell — consistent modal chrome for agent panels.
 * Individual agents keep their own business tabs; this owns positioning / safety header.
 */
export const AgentControlShell: React.FC<AgentControlShellProps> = ({
  agent,
  onClose,
  purpose,
  primaryAction,
  summary,
  results,
  history,
  settings,
  integrations,
  safetyExtra,
  children,
  embedChildren = true,
}) => {
  const { t } = useLanguage();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { dryRunForced, killSwitchActive, effectiveMode, liveBlockReason, runtime } =
    useAgentExecutionGate();

  const kind = getAgentExecutionKind(agent.agent_key);
  const state = mapAgentOperationalState(agent.status);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const suppression =
    liveBlockReason
      ? t(`execution_blocked_${liveBlockReason.toLowerCase()}`)
      : killSwitchActive
        ? t('execution_blocked_kill_switch_active')
        : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
      role="presentation"
      onClick={onClose}
      data-testid="agent-control-shell-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="agent-control-shell"
        data-agent-key={agent.agent_key}
        className="bg-[#12161c] border border-border rounded-xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 bg-[#12161c]/95 border-b border-border px-4 sm:px-6 py-4 flex flex-wrap gap-3 items-start justify-between">
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="text-lg sm:text-xl font-bold text-white truncate">
              {agent.name}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {purpose || agent.role}
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] sm:text-[11px]">
              <span className="px-2 py-0.5 rounded border border-border text-muted-foreground">
                {t(`agent_state_${state}`) || state}
              </span>
              <span className="px-2 py-0.5 rounded border border-amber-500/30 text-amber-100">
                {t('mode_active_short')}: {(effectiveMode || 'demo').toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded border border-border text-muted-foreground">
                {t(`execution_kind_${kind}`) || kind}
              </span>
              <span className="px-2 py-0.5 rounded border border-border text-muted-foreground">
                {t('last_run')}: {formatLastRun(agent.lastUpdate, t('never_run') || 'Never run')}
              </span>
              {(dryRunForced || killSwitchActive) && (
                <span className="px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-100">
                  {t('dry_run_badge')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {primaryAction}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-2 px-3 rounded-lg text-sm"
            >
              {t('close')}
            </button>
          </div>
        </header>

        {(killSwitchActive || kind === 'live_capable') && (
          <div
            className="px-4 sm:px-6 py-2 text-xs border-b border-red-500/20 bg-red-500/10 text-red-100/90 space-y-1"
            role="status"
            data-testid="agent-shell-safety"
          >
            <p>
              {t('emergency_stop')}: {killSwitchActive ? t('active') : t('inactive')}
              {' · '}
              {t('broker_label') || 'Broker'}:{' '}
              {runtime?.providerConnected ? t('broker_connected') : t('broker_disconnected')}
            </p>
            {suppression && <p>{suppression}</p>}
            {safetyExtra}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {embedChildren ? (
            children
          ) : (
            <div className="p-4 sm:p-6 space-y-6">
              {summary && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('summary') || 'Summary'}</h3>
                  {summary}
                </section>
              )}
              {results && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('results') || 'Results'}</h3>
                  {results}
                </section>
              )}
              {history && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('history') || 'History'}</h3>
                  {history}
                </section>
              )}
              {settings && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('settings') || 'Settings'}</h3>
                  {settings}
                </section>
              )}
              {integrations && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('integrations') || 'Integrations'}</h3>
                  {integrations}
                </section>
              )}
              {children}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AgentControlShell;
