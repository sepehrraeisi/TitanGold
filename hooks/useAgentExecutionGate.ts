import { useCallback } from 'react';
import { useCapabilities } from './useCapabilities.ts';
import { useExecutionRuntime } from './useExecutionRuntime.ts';

/**
 * Canonical frontend execution gate — mirrors backend policy surface.
 */
export function useAgentExecutionGate() {
  const { has, loading: capsLoading } = useCapabilities();
  const { runtime, loading: runtimeLoading } = useExecutionRuntime();

  const canExecuteSafe = has('AI_AGENT_EXECUTE_SAFE');
  const canConfigure = has('AI_AGENT_CONFIGURE') || has('AI_AGENT_ENABLE_DISABLE');
  const killSwitchActive = runtime?.killSwitchActive === true;
  const effectiveMode = runtime?.killSwitchActive ? 'demo' : (runtime?.effectiveMode || 'demo');
  const workerPending = runtime?.killSwitchActive && !runtime?.workerAcknowledged;

  const blockReason = (() => {
    if (capsLoading || runtimeLoading) return null;
    if (!canExecuteSafe) return 'CAPABILITY_DENIED';
    if (killSwitchActive) return 'KILL_SWITCH_ACTIVE';
    if (workerPending) return 'WORKER_ACK_PENDING';
    return null;
  })();

  const guardExecution = useCallback(() => {
    if (blockReason) {
      return false;
    }
    return true;
  }, [blockReason]);

  return {
    canExecuteSafe,
    canConfigure,
    killSwitchActive,
    effectiveMode,
    workerPending,
    blockReason,
    guardExecution,
    runtime,
    loading: capsLoading || runtimeLoading,
  };
}
