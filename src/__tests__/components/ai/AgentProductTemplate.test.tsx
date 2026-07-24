import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AgentProductDialog } from '../../../../components/ai/product/AgentProductDialog.tsx';
import { AgentActionBar } from '../../../../components/ai/product/AgentActionBar.tsx';
import { AgentSectionNavigation } from '../../../../components/ai/product/AgentSectionNavigation.tsx';

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
        execution_kind_provider: 'Provider',
        agent_state_ready: 'Ready',
        agent_state_label: 'Agent state',
        monitoring_state: 'Monitoring',
        monitoring_active: 'Monitoring active',
        provider_mode_label: 'Provider mode',
        arb_provider_public_market: 'Public market',
        last_run: 'Last run',
        never_run: 'Never',
        arbitrage_execution_blocked_product: 'Execution blocked for analytical monitor.',
        arbitrage_analytical_mode_banner: 'Analytical mode banner',
        run_analytical_scan: 'Run analytical scan',
        tab_overview: 'Overview',
        operational: 'Operational',
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

describe('Agent Product Template polish', () => {
  it('renders status grid and separated last-run metadata', () => {
    render(
      <AgentProductDialog
        agent={agent}
        onClose={() => {}}
        purpose="Analytical monitor"
        latestRunAt="2026-07-24T10:00:00.000Z"
        monitoringState="active"
        actionBar={
          <AgentActionBar>
            <button type="button">Run</button>
          </AgentActionBar>
        }
        sectionNavigation={
          <AgentSectionNavigation
            tabs={[{ id: 'overview', label: 'Overview' }]}
            activeTab="overview"
            onTabChange={() => {}}
            ariaLabel="Tabs"
          />
        }
      >
        <div>Content</div>
      </AgentProductDialog>,
    );

    expect(screen.getByTestId('agent-product-status-grid')).toBeInTheDocument();
    expect(screen.getByTestId('agent-status-agent-state')).toBeInTheDocument();
    expect(screen.getByTestId('agent-status-monitoring')).toBeInTheDocument();
    expect(screen.getByTestId('agent-status-runtime')).toBeInTheDocument();
    expect(screen.getByTestId('agent-status-provider-mode')).toBeInTheDocument();
    expect(screen.getByTestId('agent-product-last-run-meta')).toBeInTheDocument();
    expect(screen.getByTestId('agent-product-last-run')).toHaveTextContent('2026');
  });

  it('uses one toolbar divider and avoids pure-white border classes on action bar', () => {
    render(
      <AgentProductDialog
        agent={agent}
        onClose={() => {}}
        actionBar={<AgentActionBar testId="action-bar-under-test"><span>Run</span></AgentActionBar>}
        sectionNavigation={
          <AgentSectionNavigation
            tabs={[{ id: 'overview', label: 'Overview' }]}
            activeTab="overview"
            onTabChange={() => {}}
            ariaLabel="Tabs"
            testId="nav-under-test"
          />
        }
      >
        <div>Body</div>
      </AgentProductDialog>,
    );

    const actionBar = screen.getByTestId('action-bar-under-test');
    expect(actionBar.className).not.toMatch(/border-b/);
    expect(screen.getByTestId('nav-under-test').className).toMatch(/border-white\/5/);
    expect(screen.getByTestId('agent-product-toolbar')).toBeTruthy();
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
