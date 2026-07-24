import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../../hooks/useAgentExecutionGate.ts';
import { getAgentExecutionKind } from '../shell/agentCardMeta.ts';
import type { AIAgent } from '../../../types.ts';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

export type AgentSafetyBannerProps = {
  agent: AIAgent;
  /** Optional product-specific analytical note (shown once). */
  productNote?: string;
  testId?: string;
};

/**
 * Canonical safety strip for Agent product dialogs.
 * Emergency Stop, broker, demo/runtime, live-side-effect state in one place.
 */
export const AgentSafetyBanner: React.FC<AgentSafetyBannerProps> = ({
  agent,
  productNote,
  testId = 'agent-safety-banner',
}) => {
  const { t } = useLanguage();
  const { killSwitchActive, effectiveMode, liveBlockReason, runtime } = useAgentExecutionGate();
  const kind = getAgentExecutionKind(agent.agent_key);
  const brokerConnected = runtime?.providerConnected === true;
  const brokerValue = brokerConnected ? t('online') || 'Online' : t('offline') || 'Offline';
  const effectiveModeLabel =
    t(`execution_mode_${effectiveMode}`) ||
    (effectiveMode === 'live' ? 'Live' : effectiveMode === 'demo' ? 'Demo' : 'Dry Run');
  const liveBlocked =
    killSwitchActive ||
    effectiveMode !== 'live' ||
    Boolean(liveBlockReason) ||
    kind !== 'live_capable';

  const safetyDetail = killSwitchActive
    ? t('live_side_effects_blocked') || 'Live side effects are blocked.'
    : liveBlockReason
      ? t(`execution_blocked_${liveBlockReason.toLowerCase()}`)
      : t('arbitrage_execution_blocked_product') ||
        'Financial execution is unavailable for this analytical monitor.';

  return (
    <div
      className={`shrink-0 ${AGENT_PRODUCT_TOKENS.contentGutter} py-2.5 text-xs border-b border-red-500/20 bg-red-500/10 text-red-100/90 space-y-1.5`}
      role="status"
      data-testid={testId}
    >
      <p data-testid="agent-safety-primary">
        {t('emergency_stop') || 'Emergency Stop'}:{' '}
        {killSwitchActive ? t('active') || 'Active' : t('inactive') || 'Inactive'}
        {' · '}
        {t('broker_label') || 'Broker'}: {brokerValue}
        {' · '}
        {t('runtime_mode') || 'Runtime'}: {effectiveModeLabel}
        {' · '}
        {t('execution_support') || 'Execution'}:{' '}
        {liveBlocked ? t('execution_unsupported') || 'Unavailable' : t('execution_supported') || 'Supported'}
      </p>
      {safetyDetail ? <p data-testid="agent-safety-detail">{safetyDetail}</p> : null}
      {productNote ? (
        <p className="text-amber-200/90" data-testid="agent-safety-product-note">
          {productNote}
        </p>
      ) : null}
    </div>
  );
};
