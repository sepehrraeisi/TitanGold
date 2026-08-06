import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentProductHeader } from '../../../../../components/ai/product/AgentProductHeader';

vi.mock('../../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    t: (key: string) =>
      (
        {
          agent_state_label: 'Agent state',
          monitoring_state: 'Monitoring',
          runtime_mode: 'Runtime',
          provider_mode_label: 'Provider mode',
          never_run: 'Never',
          agent_last_recorded_run: 'Last recorded run',
          pause_monitoring: 'Paused',
          monitoring_active: 'Monitoring active',
          agent_monitoring_not_scheduled: 'Not scheduled',
          agent_manual_only: 'Manual only',
          unavailable: 'Unavailable',
          dry_run_mode: 'Dry Run',
          execution_kind_analytical: 'Analytical',
          close: 'Close',
        } as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock('../../../../../hooks/useAgentExecutionGate.ts', () => ({
  useAgentExecutionGate: () => ({
    killSwitchActive: false,
    effectiveMode: 'dry_run',
  }),
}));

describe('AgentProductHeader', () => {
  const agent = {
    id: 'agent-1',
    name: 'Trend Detection',
    agent_key: 'trend_detection',
    role: 'Trend analysis',
    status: 'active',
    type: 'analytical',
    capabilities: [],
  } as any;

  it('uses generic shared labels for not scheduled and manual only monitoring states', () => {
    const { rerender } = render(
      <AgentProductHeader agent={agent} onClose={() => {}} monitoringState="not_scheduled" />,
    );
    expect(screen.getByTestId('agent-status-monitoring')).toHaveTextContent('Not scheduled');

    rerender(<AgentProductHeader agent={agent} onClose={() => {}} monitoringState="manual_only" />);
    expect(screen.getByTestId('agent-status-monitoring')).toHaveTextContent('Manual only');
  });
});
