import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';

interface AgentRunButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onRun: () => void | Promise<void>;
  running?: boolean;
  label?: string;
  runningLabel?: string;
}

/** Capability/runtime-aware primary run action for agent control panels */
export const AgentRunButton: React.FC<AgentRunButtonProps> = ({
  onRun,
  running = false,
  label,
  runningLabel,
  className = '',
  disabled,
  ...rest
}) => {
  const { t } = useLanguage();
  const { guardExecution, blockReason, loading } = useAgentExecutionGate();

  const blocked = !!blockReason || loading;
  const isDisabled = disabled || running || blocked;

  const title = blockReason
    ? t(`execution_blocked_${blockReason.toLowerCase()}`) || blockReason
    : undefined;

  return (
    <button
      type="button"
      {...rest}
      className={className}
      disabled={isDisabled}
      title={title}
      aria-disabled={isDisabled}
      onClick={() => {
        if (guardExecution()) onRun();
      }}
    >
      {running ? (runningLabel || t('processing') || 'Processing…') : (label || t('run_analysis') || 'Run')}
    </button>
  );
};
