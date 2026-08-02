import React from 'react';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

export const AgentSectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  testId?: string;
}> = ({ title, subtitle, actions, testId = 'agent-section-header' }) => (
  <div
    className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
    data-testid={testId}
  >
    <div className="min-w-0 space-y-1">
      <h3 className={AGENT_PRODUCT_TOKENS.titleMd + ' text-foreground'}>{title}</h3>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
  </div>
);
