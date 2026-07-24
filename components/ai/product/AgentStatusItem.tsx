import React from 'react';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

export type AgentStatusTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

const TONE_VALUE: Record<AgentStatusTone, string> = {
  neutral: 'text-foreground',
  success: 'text-emerald-200',
  warning: 'text-amber-200',
  info: 'text-blue-200',
  danger: 'text-red-200',
};

export const AgentStatusItem: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: AgentStatusTone;
  testId?: string;
  title?: string;
}> = ({ label, value, tone = 'neutral', testId, title }) => (
  <div
    className={`${AGENT_PRODUCT_TOKENS.surfaces.statusItem} ${AGENT_PRODUCT_TOKENS.statusItemMinHeight} min-w-[7.5rem] flex-1 basis-[calc(50%-0.25rem)] lg:basis-[calc(25%-0.5625rem)] px-3 py-2`}
    data-testid={testId}
    title={title}
  >
    <p className={AGENT_PRODUCT_TOKENS.labelSm}>{label}</p>
    <p className={`text-xs font-medium mt-0.5 truncate ${TONE_VALUE[tone]}`}>{value}</p>
  </div>
);
