import { useCallback } from 'react';
import { useCapabilities } from './useCapabilities.ts';
import { useExecutionRuntime } from './useExecutionRuntime.ts';

/**
 * Canonical frontend execution gate — mirrors backend policy surface.
 *
 * Kill Switch does NOT hard-block safe analytical / dry-run execution.
 * Live side-effects remain blocked and must pass through liveCapable checks.
 */
export function useAgentExecutionGate() {
  const { has, loading: capsLoading } = useCapabilities();
  const { runtime, loading: runtimeLoading } = useExecutionRuntime();

  const canExecuteSafe = has('AI_AGENT_EXECUTE_SAFE');
  const canExecuteLive = has('AI_AGENT_EXECUTE_LIVE_CAPABLE') || has('LIVE_TRADING');
  const canConfigure = has('AI_AGENT_CONFIGURE') || has('AI_AGENT_ENABLE_DISABLE');
  const killSwitchActive = runtime?.killSwitchActive === true;
  const effectiveMode = runtime?.killSwitchActive
    ? 'dry_run'
    : (runtime?.effectiveMode || 'demo');
  const workerPending = runtime?.killSwitchActive && !runtime?.workerAcknowledged;
  const dryRunForced =
    killSwitchActive ||
    effectiveMode === 'demo' ||
    effectiveMode === 'dry_run' ||
    runtime?.globalMode === 'demo';

  /** Hard block for all run actions (capability / auth surface). */
  const blockReason = (() => {
    if (capsLoading || runtimeLoading) return 'LOADING';
    if (!canExecuteSafe) return 'CAPABILITY_DENIED';
    return null;
  })();

  /** Extra block when caller requests a live / mutating side effect. */
  const liveBlockReason = (() => {
    if (blockReason && blockReason !== 'LOADING') return blockReason;
    if (killSwitchActive) return 'KILL_SWITCH_ACTIVE';
    if (workerPending) return 'WORKER_ACK_PENDING';
    if (runtime?.globalMode !== 'live') return 'GLOBAL_DEMO';
    if (!canExecuteLive) return 'LIVE_PERMISSION_DENIED';
    return null;
  })();

  const guardExecution = useCallback((opts?: { liveSideEffects?: boolean }) => {
    if (blockReason === 'LOADING') return false;
    if (blockReason) return false;
    if (opts?.liveSideEffects) {
      return !liveBlockReason;
    }
    return true;
  }, [blockReason, liveBlockReason]);

  return {
    canExecuteSafe,
    canExecuteLive,
    canConfigure,
    killSwitchActive,
    effectiveMode,
    dryRunForced,
    workerPending,
    blockReason: blockReason === 'LOADING' ? null : blockReason,
    loading: capsLoading || runtimeLoading,
    liveBlockReason,
    guardExecution,
    runtime,
  };
}
