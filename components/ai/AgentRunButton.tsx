import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';

interface AgentRunButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onRun: () => void | Promise<void>;
  running?: boolean;
  label?: string;
  runningLabel?: string;
  /** When true, requires live gates (KS / broker / global live). Default false = safe/dry-run. */
  liveSideEffects?: boolean;
  /** Show Dry Run badge next to label when forced dry-run. */
  showDryRunBadge?: boolean;
}

function blockReasonLabel(t: (k: string) => string, code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  const key = `execution_blocked_${code.toLowerCase()}`;
  const translated = t(key);
  return translated !== key ? translated : code;
}

/** Capability/runtime-aware primary run action for agent control panels */
export const AgentRunButton: React.FC<AgentRunButtonProps> = ({
  onRun,
  running = false,
  label,
  runningLabel,
  className = '',
  disabled,
  liveSideEffects = false,
  showDryRunBadge = true,
  ...rest
}) => {
  const { t } = useLanguage();
  const {
    guardExecution,
    blockReason,
    liveBlockReason,
    loading,
    dryRunForced,
    killSwitchActive,
  } = useAgentExecutionGate();

  const hardBlock = liveSideEffects
    ? (!!liveBlockReason || loading)
    : (!!blockReason || loading);

  const activeBlockCode = liveSideEffects
    ? (liveBlockReason || blockReason)
    : blockReason;

  const isDisabled = Boolean(disabled || running || hardBlock);
  const reason = blockReasonLabel(t, activeBlockCode);
  const disabledBecauseInactive = Boolean(disabled) && !hardBlock && !running;

  const title = [
    reason,
    disabledBecauseInactive ? (t('agent_must_be_active') || 'Start the agent before running.') : null,
    !liveSideEffects && dryRunForced ? (t('dry_run_forced_hint') || 'Runs as Dry Run — no live side effects.') : null,
  ].filter(Boolean).join(' ');

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        {...rest}
        className={className}
        disabled={isDisabled}
        title={title || undefined}
        aria-disabled={isDisabled}
        aria-describedby={isDisabled && reason ? 'agent-run-block-reason' : undefined}
        data-testid="agent-run-button"
        data-block-reason={activeBlockCode || undefined}
        onClick={() => {
          if (guardExecution({ liveSideEffects })) onRun();
        }}
      >
        {running ? (runningLabel || t('processing') || 'Processing…') : (label || t('run_analysis') || 'Run')}
      </button>
      {showDryRunBadge && !liveSideEffects && (dryRunForced || killSwitchActive) && (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 text-amber-100"
          data-testid="dry-run-badge"
        >
          {t('dry_run_badge') || 'Dry Run'}
        </span>
      )}
      {isDisabled && reason ? (
        <span id="agent-run-block-reason" className="sr-only">
          {reason}
        </span>
      ) : null}
    </span>
  );
};

export default AgentRunButton;
