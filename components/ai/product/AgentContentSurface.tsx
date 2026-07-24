import React from 'react';
import { DATAHUB_SHELL } from '../shell/agentsShellUi.ts';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

export const AgentContentSurface: React.FC<{
  children: React.ReactNode;
  testId?: string;
  padded?: boolean;
}> = ({ children, testId = 'agent-content-surface', padded = true }) => (
  <div
    className={`${DATAHUB_SHELL} ${padded ? AGENT_PRODUCT_TOKENS.cardPadding : ''}`}
    data-testid={testId}
  >
    <div className={AGENT_PRODUCT_TOKENS.sectionGap}>{children}</div>
  </div>
);
