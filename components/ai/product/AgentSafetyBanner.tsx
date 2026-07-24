import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../../hooks/useAgentExecutionGate.ts';
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
 */
export const AgentSafetyBanner: React.FC<AgentSafetyBannerProps> = ({
  productNote,
  testId = 'agent-safety-banner',
}) => {
  const { t } = useLanguage();
  const { killSwitchActive, effectiveMode, liveBlockReason, runtime } = useAgentExecutionGate();
  const brokerConnected = runtime?.providerConnected === true;
  const brokerValue = brokerConnected ? t('online') || 'Online' : t('offline') || 'Offline';

  const safetyDetail = killSwitchActive
    ? t('live_side_effects_blocked') || 'Live side effects are blocked.'
    : liveBlockReason
      ? t(`execution_blocked_${liveBlockReason.toLowerCase()}`)
      : t('arbitrage_execution_blocked_product') ||
        'Financial execution is unavailable for this analytical monitor.';

  return (
    <div
      className={`shrink-0 ${AGENT_PRODUCT_TOKENS.contentGutter} py-2.5 text-xs ${AGENT_PRODUCT_TOKENS.surfaces.safetySurface} text-amber-100/90 space-y-1`}
      role="status"
      aria-live="polite"
      data-testid={testId}
    >
      <p data-testid="agent-safety-primary">
        <span className="font-medium">{t('emergency_stop') || 'Emergency Stop'}:</span>{' '}
        {killSwitchActive ? t('active') || 'Active' : t('inactive') || 'Inactive'}
        <span aria-hidden="true"> · </span>
        <span className="font-medium">{t('broker_label') || 'Broker'}:</span> {brokerValue}
        <span aria-hidden="true"> · </span>
        <span className="font-medium">{t('execution_support') || 'Execution'}:</span>{' '}
        {t('execution_unsupported') || 'Unavailable'}
      </p>
      {safetyDetail ? (
        <p className="text-amber-200/80" data-testid="agent-safety-detail">
          {safetyDetail}
        </p>
      ) : null}
      {productNote ? (
        <p className="text-amber-200/80" data-testid="agent-safety-product-note">
          {productNote}
        </p>
      ) : null}
    </div>
  );
};
