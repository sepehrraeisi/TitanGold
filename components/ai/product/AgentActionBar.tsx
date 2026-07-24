import React from 'react';
import {
  BTN_ACTION_BLUE,
  BTN_WARNING,
  FOCUS_RING,
  PrimaryButton,
} from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

const btnClass = (base: string) =>
  `${base} ${FOCUS_RING} ${AGENT_PRODUCT_TOKENS.actionMinHeight} inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors`.trim();

export const AgentActionBar: React.FC<{
  children: React.ReactNode;
  testId?: string;
}> = ({ children, testId = 'agent-action-bar' }) => (
  <div
    className={`${AGENT_PRODUCT_TOKENS.contentGutter} shrink-0 py-3 border-b border-border/60`}
    data-testid={testId}
  >
    <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full max-w-full">{children}</div>
  </div>
);

export type AgentActionButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'warning' | 'action-blue';
  testId?: string;
  ariaLabel?: string;
};

export const AgentPrimaryAction: React.FC<AgentActionButtonProps> = ({
  label,
  onClick,
  disabled,
  loading,
  testId,
  ariaLabel,
}) => (
  <PrimaryButton
    type="button"
    data-testid={testId}
    data-variant="primary"
    onClick={onClick}
    disabled={disabled || loading}
    aria-busy={loading}
    aria-label={ariaLabel || label}
    className="w-full sm:w-auto"
  >
    {label}
  </PrimaryButton>
);

export const AgentSecondaryAction: React.FC<AgentActionButtonProps> = ({
  label,
  onClick,
  disabled,
  loading,
  variant = 'action-blue',
  testId,
  ariaLabel,
}) => (
  <button
    type="button"
    data-testid={testId}
    data-variant={variant === 'warning' ? 'warning' : 'action-blue'}
    onClick={onClick}
    disabled={disabled || loading}
    aria-busy={loading}
    aria-label={ariaLabel || label}
    className={`${btnClass(variant === 'warning' ? BTN_WARNING : BTN_ACTION_BLUE)} w-full sm:w-auto`}
  >
    {label}
  </button>
);
