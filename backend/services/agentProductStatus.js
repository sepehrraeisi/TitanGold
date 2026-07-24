/**
 * Canonical Agent product-status selector (backend mirror of utils/agentProductStatus.ts).
 */

const FINANCIAL_EXECUTION_BLOCKED_KEYS = new Set(['order']);

function limited(reasonKey, details = []) {
  return {
    primaryState: 'limited',
    primaryLabelKey: 'agent_product_limited',
    tone: 'warning',
    primaryReasonKey: reasonKey,
    safeDetails: details,
  };
}

function arbitrageProductStatus(p) {
  if (p.scheduled && p.healthy) {
    const hasRunEvidence =
      p.dataReady && (p.lastRunStatus === 'success' || p.lastRunStatus === 'unknown');
    if (hasRunEvidence) {
      return {
        primaryState: 'operational',
        primaryLabelKey: 'agent_product_operational',
        tone: 'success',
        primaryReasonKey: 'agent_reason_scheduled_monitoring',
        safeDetails: ['allowlisted', 'scheduled', 'execution_unavailable'],
      };
    }
    return {
      primaryState: 'scheduled',
      primaryLabelKey: 'agent_state_scheduled',
      tone: 'info',
      primaryReasonKey: 'agent_reason_awaiting_first_run',
      safeDetails: ['allowlisted', 'scheduled'],
    };
  }
  if (p.allowlisted && !p.scheduled) {
    return limited('agent_reason_scheduler_unavailable', ['allowlisted']);
  }
  return limited('agent_reason_not_scheduled');
}

export function buildAgentProductStatus(projection, context = {}) {
  const p = projection;
  const agentKey = String(p?.agentKey || '').toLowerCase();
  const killSwitchActive = context.killSwitchActive !== false;
  const effectiveMode = String(context.effectiveMode || 'demo').toLowerCase();
  const executionRuntimeBlocked = killSwitchActive || effectiveMode !== 'live';

  if (!p || !p.registered) {
    return {
      primaryState: 'unavailable',
      primaryLabelKey: 'agent_state_unavailable',
      tone: 'neutral',
      primaryReasonKey: 'agent_reason_not_registered',
      safeDetails: [],
    };
  }

  if (p.running) {
    return {
      primaryState: 'running',
      primaryLabelKey: 'agent_state_running',
      tone: 'info',
      primaryReasonKey: null,
      safeDetails: ['running'],
    };
  }

  if (!p.healthy) {
    return {
      primaryState: 'error',
      primaryLabelKey: 'agent_state_error',
      tone: 'error',
      primaryReasonKey: 'agent_reason_unhealthy',
      safeDetails: [],
    };
  }

  if (!p.enabled) {
    return {
      primaryState: 'paused',
      primaryLabelKey: 'agent_state_paused',
      tone: 'warning',
      primaryReasonKey: 'agent_reason_disabled',
      safeDetails: [],
    };
  }

  if (FINANCIAL_EXECUTION_BLOCKED_KEYS.has(agentKey) && executionRuntimeBlocked) {
    return {
      primaryState: 'blocked',
      primaryLabelKey: 'agent_product_blocked',
      tone: 'error',
      primaryReasonKey: 'agent_reason_execution_disabled_runtime',
      safeDetails: killSwitchActive ? ['emergency_stop', 'demo_mode'] : ['demo_mode'],
    };
  }

  if (agentKey === 'arbitrage') {
    return arbitrageProductStatus(p);
  }

  if (p.allowlisted && !p.scheduled) {
    return limited('agent_reason_scheduler_unavailable', ['allowlisted']);
  }

  if (p.liveCapable && executionRuntimeBlocked) {
    return limited('agent_reason_execution_disabled_runtime', ['demo_mode', 'emergency_stop']);
  }

  if (!p.allowlisted) {
    if (!p.configured) {
      return limited('agent_reason_not_configured');
    }
    if (p.consumerRegistered && !p.consumerEligible) {
      return limited('agent_reason_consumer_incomplete');
    }
    if (!p.dataReady) {
      return limited('agent_reason_data_dependency_incomplete');
    }
    return limited('agent_reason_not_scheduled');
  }

  return limited('agent_reason_not_scheduled');
}
