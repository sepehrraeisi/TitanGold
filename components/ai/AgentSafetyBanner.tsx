import React from 'react';
import type { ExecutionRuntimeView } from '../services/executionRuntimeApi';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface AgentSafetyBannerProps {
  runtime: ExecutionRuntimeView | null;
  canExecute: boolean;
  loading?: boolean;
}

const badgeClass = (mode: string, kill: boolean) => {
  if (kill) return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (mode === 'live') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (mode === 'dry_run') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
};

export const AgentSafetyBanner: React.FC<AgentSafetyBannerProps> = ({ runtime, canExecute, loading }) => {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="mb-4 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground" role="status">
        {t('loading_runtime') || 'Loading execution runtime…'}
      </div>
    );
  }

  if (!runtime) return null;

  const effective = runtime.killSwitchActive ? 'demo' : runtime.effectiveMode;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card/80 px-4 py-3 space-y-2" role="region" aria-label={t('execution_safety') || 'Execution safety'}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-1 rounded border ${badgeClass(runtime.requestedMode, false)}`}>
          {t('requested_mode') || 'Requested'}: {runtime.requestedMode.toUpperCase()}
        </span>
        <span className={`text-xs font-semibold px-2 py-1 rounded border ${badgeClass(effective, runtime.killSwitchActive)}`}>
          {t('effective_mode') || 'Effective'}: {effective.toUpperCase()}
        </span>
        {runtime.killSwitchActive && (
          <span className="text-xs font-semibold px-2 py-1 rounded border bg-red-600/20 text-red-200 border-red-500/50">
            {t('emergency_stop_active') || 'Emergency stop active'}
            {!runtime.workerAcknowledged ? ` · ${t('worker_pending') || 'worker pending'}` : ''}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {!canExecute
          ? (t('agents_read_only_role') || 'Your account can view agents but cannot execute or modify them.')
          : runtime.requestedMode === 'live' && effective !== 'live'
            ? (t('live_suppressed_notice') || 'Live requested but effective mode is not live — side effects will be suppressed.')
            : (t('demo_safe_execution') || 'Execution runs in demo/dry-run unless all live gates pass.')}
      </p>
      {runtime.killSwitchActive && runtime.killSwitchReason && (
        <p className="text-xs text-red-300/90">{runtime.killSwitchReason}</p>
      )}
    </div>
  );
};

export default AgentSafetyBanner;
