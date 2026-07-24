import React from 'react';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

export const AgentContentSurface: React.FC<{
  children: React.ReactNode;
  testId?: string;
}> = ({ children, testId = 'agent-content-surface' }) => (
  <div
    className={`${AGENT_PRODUCT_TOKENS.surfaces.sectionCard} ${AGENT_PRODUCT_TOKENS.cardPadding}`}
    data-testid={testId}
  >
    <div className={AGENT_PRODUCT_TOKENS.sectionGap}>{children}</div>
  </div>
);

export const AgentListRow: React.FC<{
  children: React.ReactNode;
  testId?: string;
}> = ({ children, testId }) => (
  <div
    className={`${AGENT_PRODUCT_TOKENS.surfaces.listRow} px-3 py-2.5 text-sm`}
    data-testid={testId}
  >
    {children}
  </div>
);
