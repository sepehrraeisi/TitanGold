import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AgentProductDialog } from '../../../../components/ai/product/AgentProductDialog.tsx';

vi.mock('../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    t: (key: string) =>
      ({
        close: 'Close',
        emergency_stop: 'Emergency Stop',
        active: 'Active',
        inactive: 'Inactive',
        broker_label: 'Broker',
        online: 'Online',
        offline: 'Offline',
        runtime_mode: 'Runtime',
        execution_mode_demo: 'Demo',
        execution_support: 'Execution',
        execution_unsupported: 'Unavailable',
        live_side_effects_blocked: 'Live side effects are blocked.',
        execution_kind_analytical: 'Analytical',
        agent_state_ready: 'Ready',
        last_run: 'Last run',
        never_run: 'Never',
        monitoring_active: 'Monitoring active',
        arbitrage_execution_blocked_product: 'Execution blocked for analytical monitor.',
        arbitrage_analytical_mode_banner: 'Analytical mode banner',
        run_analytical_scan: 'Run analytical scan',
        tab_overview: 'Overview',
      })[key] ?? key,
    language: 'en',
  }),
}));

vi.mock('../../../../hooks/useAgentExecutionGate.ts', () => ({
  useAgentExecutionGate: () => ({
    killSwitchActive: true,
    effectiveMode: 'demo',
    liveBlockReason: 'demo_mode',
    runtime: { providerConnected: true },
  }),
}));

const agent = {
  id: '04b6ca95-5fd3-471d-a568-bd7f1c391d83',
  name: 'Arbitrage Agent',
  status: 'active',
  agent_key: 'arbitrage',
  role: 'Analytical monitor',
} as any;

describe('Agent Product Template V1', () => {
  it('renders dialog shell with safety banner and scroll owner', () => {
    render(
      <AgentProductDialog
        agent={agent}
        onClose={() => {}}
        purpose="Analytical monitor"
        latestRunAt="2026-07-24T10:00:00.000Z"
        monitoringState="active"
        actionBar={<div data-testid="fixture-action-bar">Actions</div>}
        sectionNavigation={<div data-testid="fixture-section-nav">Nav</div>}
      >
        <div data-testid="fixture-content">Content</div>
      </AgentProductDialog>,
    );

    expect(screen.getByTestId('agent-product-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('agent-product-header')).toBeInTheDocument();
    expect(screen.getByTestId('agent-safety-banner')).toBeInTheDocument();
    expect(screen.getByTestId('fixture-action-bar')).toBeInTheDocument();
    expect(screen.getByTestId('fixture-section-nav')).toBeInTheDocument();
    expect(screen.getByTestId('agent-product-body')).toBeInTheDocument();
    expect(screen.getByTestId('fixture-content')).toBeInTheDocument();
    expect(screen.getByTestId('agent-product-last-run')).toHaveTextContent('2026');
  });

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn();
    render(
      <AgentProductDialog agent={agent} onClose={onClose} closeTestId="agent-product-close">
        <div>Body</div>
      </AgentProductDialog>,
    );
    fireEvent.click(screen.getByTestId('agent-product-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
