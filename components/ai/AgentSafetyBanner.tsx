import React from 'react';
import type { ExecutionRuntimeView } from '../services/executionRuntimeApi';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface AgentSafetyBannerProps {
  runtime: ExecutionRuntimeView | null;
  canExecute: boolean;
  loading?: boolean;
}

/** Hide internal/test kill-switch reasons from production-facing UI. */
function isPublicKillSwitchReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  const r = reason.toLowerCase();
  if (/perf-|fixture|test|qualification|idempotent|baseline|proc-test|runtime-safety-fixture/.test(r)) {
    return false;
  }
  return reason.length > 0 && reason.length < 120;
}

export const AgentSafetyBanner: React.FC<AgentSafetyBannerProps> = ({ runtime, canExecute, loading }) => {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="mb-4 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground" role="status">
        {t('loading_runtime') || 'Loading execution runtime…'}
      </div>
    );
  }

  if (!runtime) {
    return (
      <div
        className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
        role="status"
        data-testid="agent-safety-banner-unavailable"
      >
        {t('runtime_status_unavailable') ||
          'Execution safety status could not be loaded. Treat all agent actions as demo / dry-run until status is available.'}
      </div>
    );
  }

  const modeLabel = (runtime.killSwitchActive ? 'demo' : runtime.effectiveMode || 'demo').toUpperCase();
  const publicReason = isPublicKillSwitchReason(runtime.killSwitchReason) ? runtime.killSwitchReason : null;

  return (
    <div
      className="mb-4 rounded-lg border border-border bg-card/80 px-4 py-3 space-y-2"
      role="region"
      aria-label={t('execution_safety') || 'Execution safety'}
      data-testid="agent-safety-banner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-md border bg-yellow-500/15 text-yellow-200 border-yellow-500/40"
          title={t('runtime_mode_hint') || 'Effective trading mode for this session'}
        >
          {t('runtime_mode_badge') || 'Mode'}: {modeLabel}
        </span>
        {runtime.killSwitchActive && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-md border bg-red-600/25 text-red-100 border-red-500/50"
            role="status"
            data-testid="emergency-stop-badge"
          >
            {t('emergency_stop') || 'Emergency Stop'}
            {!runtime.workerAcknowledged
              ? ` · ${t('worker_ack_pending') || 'Awaiting worker acknowledgement'}`
              : ''}
          </span>
        )}
      </div>

      {runtime.killSwitchActive ? (
        <p className="text-xs text-red-200/90">
          {t('emergency_stop_explanation') ||
            'Emergency Stop is active. Live trading and external side effects remain blocked until an administrator clears it.'}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {!canExecute
          ? (t('agents_read_only_role') || 'Your account can view agents but cannot execute or modify them.')
          : (t('demo_safe_execution_short') ||
            'Agents run in demo / dry-run. Live execution requires all safety gates to pass.')}
      </p>

      {publicReason ? (
        <p className="text-xs text-muted-foreground">
          {t('stop_reason_label') || 'Reason'}: {publicReason}
        </p>
      ) : null}
    </div>
  );
};

export default AgentSafetyBanner;
