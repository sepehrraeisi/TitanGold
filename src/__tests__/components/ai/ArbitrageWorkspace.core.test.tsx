import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ArbitrageWorkspace from '../../../../components/ai/ArbitrageWorkspace.tsx';

const translations: Record<string, string> = {
  back_to_agents: 'Back to agents',
  run_analytical_scan: 'Run analytical scan',
  pause_monitoring: 'Pause monitoring',
  resume_monitoring: 'Resume monitoring',
  scanning: 'Scanning...',
  strategy_mexc_spot_spread_monitor: 'MEXC Spot Spread Monitor',
  arbitrage_agent_desc: 'Analytical MEXC spot bid/ask spread monitor.',
  arbitrage_analytical_mode_banner: 'Analytical mode banner',
  tab_overview: 'Overview',
  tab_arbitrage_candidates: 'Candidates',
  tab_scan_history: 'Scan history',
  tab_profit_risk: 'Profit & Risk',
  tab_settings: 'Settings',
  tab_integration: 'Integrations',
  loading: 'Loading...',
  unavailable: 'Unavailable',
  execution_support: 'Execution',
  execution_unsupported: 'Not supported',
};

vi.mock('../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    t: (key: string) => translations[key] ?? key,
    language: 'en',
  }),
}));

vi.mock('../../../../hooks/useAgentExecutionGate.ts', () => ({
  useAgentExecutionGate: () => ({
    guardExecution: () => true,
  }),
}));

const fetchArbitrageOverview = vi.fn();
const fetchArbitrageCandidates = vi.fn();
const fetchArbitrageRuns = vi.fn();
const fetchArbitrageRunDetail = vi.fn();
const fetchArbitrageSettings = vi.fn();
const fetchArbitrageIntegrations = vi.fn();
const updateArbitrageCoreSettings = vi.fn();
const runArbitrageAnalyticalScan = vi.fn();
const updateArbitrageMonitoringState = vi.fn();
const fetchAIAgents = vi.fn();

vi.mock('../../../../services/api.ts', () => ({
  fetchArbitrageOverview: (...args: unknown[]) => fetchArbitrageOverview(...args),
  fetchArbitrageCandidates: (...args: unknown[]) => fetchArbitrageCandidates(...args),
  fetchArbitrageRuns: (...args: unknown[]) => fetchArbitrageRuns(...args),
  fetchArbitrageRunDetail: (...args: unknown[]) => fetchArbitrageRunDetail(...args),
  fetchArbitrageIntegrations: (...args: unknown[]) => fetchArbitrageIntegrations(...args),
  fetchArbitrageSettings: (...args: unknown[]) => fetchArbitrageSettings(...args),
  updateArbitrageCoreSettings: (...args: unknown[]) => updateArbitrageCoreSettings(...args),
  runArbitrageAnalyticalScan: (...args: unknown[]) => runArbitrageAnalyticalScan(...args),
  updateArbitrageMonitoringState: (...args: unknown[]) => updateArbitrageMonitoringState(...args),
  fetchAIAgents: (...args: unknown[]) => fetchAIAgents(...args),
}));

const agent = {
  id: '04b6ca95-5fd3-471d-a568-bd7f1c391d83',
  name: 'Arbitrage Agent',
  status: 'active',
  agent_key: 'arbitrage',
} as any;

const overview = {
  product: {
    agentKey: 'arbitrage',
    displayName: 'MEXC Spot Spread Monitor',
    description: 'Single-venue analytical monitor.',
    activeMode: 'single_venue_spread_monitoring',
    activeModeLabel: 'MEXC Spot Spread Monitor',
    unavailableModes: [
      { mode: 'triangular_arbitrage', label: 'Triangular arbitrage', state: 'unavailable' },
    ],
    executionSupported: false as const,
    executionEligible: false as const,
  },
  settings: {
    monitoredSymbols: ['BTCUSDT'],
    minimumNetSpreadBps: 20,
    monitoringState: 'active' as const,
    notificationPreference: false,
    executionSupported: false as const,
    executionEligible: false as const,
  },
  totalScanRuns: 3,
  latestRun: {
    runId: 'run-1',
    startedAt: '2026-07-16T10:23:02.000Z',
    completedAt: '2026-07-16T10:23:05.000Z',
    status: 'completed',
    trigger: 'manual',
    funnel: { analyticalCandidates: 1, rejected: 0, qualified: 0 },
  },
  recentRuns: [],
  interpretation: 'Latest analytical scan completed successfully.',
};

describe('ArbitrageWorkspace core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchArbitrageOverview.mockResolvedValue(overview);
    fetchArbitrageSettings.mockResolvedValue(overview.settings);
    fetchArbitrageCandidates.mockResolvedValue({
      runId: 'run-1',
      spreadCandidates: [],
      rejectedCandidates: [],
      qualifiedCandidates: [],
    });
    fetchArbitrageRuns.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0, hasMore: false },
    });
    fetchArbitrageIntegrations.mockResolvedValue({
      dataSources: ['MEXC spot (public market data)'],
      executionSupported: false,
      executionEligible: false,
      unavailableIntegrations: ['Live execution'],
    });
    fetchAIAgents.mockResolvedValue([agent]);
  });

  it('renders page workspace with analytical scan and monitoring controls', async () => {
    render(
      <ArbitrageWorkspace
        agent={agent}
        onBack={() => {}}
        onUpdate={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('arb-workspace')).toBeTruthy());
    expect(screen.getByTestId('arb-run-analytical-scan').textContent).toContain('Run analytical scan');
    expect(screen.queryByText('Run Scan')).toBeNull();
    expect(screen.getByTestId('arb-pause-monitoring').textContent).toContain('Pause monitoring');
    expect(screen.queryByTestId('arb-restart')).toBeNull();
    expect(screen.getByTestId('arb-workspace-back').textContent).toContain('Back to agents');
  });

  it('switches tabs and calls onNavigate with agentSection', async () => {
    const onNavigate = vi.fn();
    render(
      <ArbitrageWorkspace
        agent={agent}
        initialSection="overview"
        onBack={() => {}}
        onNavigate={onNavigate}
        onUpdate={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('arb-tab-candidates')).toBeTruthy());
    fireEvent.click(screen.getByTestId('arb-tab-candidates'));

    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          view: 'ai',
          agentId: agent.id,
          agentSection: 'candidates',
        }),
      ),
    );
    expect(screen.getByTestId('arb-tab-candidates').getAttribute('aria-selected')).toBe('true');
  });

  it('shows execution unsupported in settings section', async () => {
    render(
      <ArbitrageWorkspace
        agent={agent}
        initialSection="settings"
        onBack={() => {}}
        onUpdate={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('arb-execution-supported-false')).toBeTruthy());
    expect(screen.queryByLabelText(/Auto Execute/i)).toBeNull();
  });
});
