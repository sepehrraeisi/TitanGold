import React from 'react';
import { DataHubAlert, DataHubEmpty } from '../shell/agentsShellUi.ts';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

export const AgentLoadingState: React.FC<{ message: string; testId?: string }> = ({
  message,
  testId = 'agent-loading-state',
}) => (
  <div className={AGENT_PRODUCT_TOKENS.sectionGap} role="status" data-testid={testId}>
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

export const AgentEmptyState: React.FC<{ message: string; testId?: string }> = ({
  message,
  testId = 'agent-empty-state',
}) => (
  <div data-testid={testId}>
    <DataHubEmpty message={message} />
  </div>
);

export const AgentErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  testId?: string;
}> = ({ message, onRetry, retryLabel, testId = 'agent-error-state' }) => (
  <div data-testid={testId}>
    <DataHubAlert variant="error" message={message} onRetry={onRetry} retryLabel={retryLabel} />
  </div>
);
