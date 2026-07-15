import React from 'react';
import type { ExecutionRuntimeView } from '../../services/executionRuntimeApi';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { AGENT_SAFETY_SHELL, StatusPill } from './shell/agentsShellUi.ts';

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
      <div
        className={`${AGENT_SAFETY_SHELL} mb-4 text-[11px] text-muted-foreground`}
        role="status"
        data-testid="agent-safety-banner-loading"
      >
        {t('loading_runtime') || 'Loading execution runtime…'}
      </div>
    );
  }

  if (!runtime) {
    return (
      <div
        className={`${AGENT_SAFETY_SHELL} mb-4 border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-100/90`}
        role="status"
        data-testid="agent-safety-banner-unavailable"
      >
        {t('runtime_status_unavailable') ||
          'Execution safety status could not be loaded. Treat all agent actions as demo / dry-run until status is available.'}
      </div>
    );
  }

  const effectiveLabel = (runtime.killSwitchActive ? 'demo' : runtime.effectiveMode || 'demo').toUpperCase();
  const publicReason = isPublicKillSwitchReason(runtime.killSwitchReason) ? runtime.killSwitchReason : null;

  return (
    <div
      className={`${AGENT_SAFETY_SHELL} mb-4`}
      role="region"
      aria-label={t('execution_safety') || 'Execution safety'}
      data-testid="agent-safety-banner"
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <StatusPill
          variant="warning"
          label={`${t('effective_mode') || 'Effective Mode'}: ${effectiveLabel}`}
          title={t('runtime_mode_hint') || 'Effective trading mode for this session'}
        />
        {runtime.killSwitchActive && (
          <span data-testid="emergency-stop-badge">
            <StatusPill
              variant="error"
              label={
                !runtime.workerAcknowledged
                  ? `${t('emergency_stop') || 'Emergency Stop'}: ${t('active') || 'Active'} · ${t('worker_ack_pending') || 'Awaiting worker acknowledgement'}`
                  : `${t('emergency_stop') || 'Emergency Stop'}: ${t('active') || 'Active'}`
              }
            />
          </span>
        )}
        {!canExecute && (
          <StatusPill
            variant="neutral"
            label={t('agents_read_only_badge') || 'View only'}
            title={t('agents_read_only_role') || 'Your account can view agents but cannot execute or modify them.'}
          />
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        {t('agents_dry_run_blocked_short') ||
          'Agents run in Dry Run. Live side effects are blocked.'}
        {publicReason ? ` · ${t('stop_reason_label') || 'Reason'}: ${publicReason}` : ''}
      </p>
    </div>
  );
};

export default AgentSafetyBanner;
