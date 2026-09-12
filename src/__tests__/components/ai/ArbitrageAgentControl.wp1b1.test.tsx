import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArbitrageAgentControl from '../../../../components/ai/ArbitrageAgentControl.tsx';

vi.mock('../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

vi.mock('../../../../hooks/useAgentExecutionGate.ts', () => ({
  useAgentExecutionGate: () => ({
    guardExecution: () => true,
    dryRunForced: true,
    killSwitchActive: true,
    effectiveMode: 'dry_run',
    liveBlockReason: 'KILL_SWITCH_ACTIVE',
    runtime: { providerConnected: false, killSwitchActive: true, workerAcknowledged: true },
  }),
}));

const fetchArbitrageAgentData = vi.fn();
const fetchArbitrageScanHistory = vi.fn();
const runArbitrageAnalysis = vi.fn();
const updateArbitrageConfig = vi.fn();
const sendAgentControlCommand = vi.fn();
const fetchAIAgents = vi.fn();

vi.mock('../../../../services/api.ts', () => ({
  fetchArbitrageAgentData: (...args: unknown[]) => fetchArbitrageAgentData(...args),
  fetchArbitrageScanHistory: (...args: unknown[]) => fetchArbitrageScanHistory(...args),
  runArbitrageAnalysis: (...args: unknown[]) => runArbitrageAnalysis(...args),
  updateArbitrageConfig: (...args: unknown[]) => updateArbitrageConfig(...args),
  sendAgentControlCommand: (...args: unknown[]) => sendAgentControlCommand(...args),
  fetchAIAgents: (...args: unknown[]) => fetchAIAgents(...args),
}));

const agent = {
  id: '04b6ca95-5fd3-471d-a568-bd7f1c391d83',
  name: 'Arbitrage Agent',
  status: 'active',
  agent_key: 'arbitrage',
  decisions: 12,
  role: 'Arbitrage Scanner',
  lastUpdate: '2026-07-16T10:23:02.000Z',
} as any;

const baseConfig = {
  exchanges: [{ id: 'mexc', name: 'MEXC', enabled: true, markets: ['spot'], tradingFeeBps: 10 }],
  strategies: [{ type: 'spot', enabled: true, minProfitBps: 20, maxSlippageBps: 10, maxExposureUSDT: 1000 }],
  symbols: ['BTCUSDT'],
  opportunityThresholdBps: 20,
  detectionSensitivity: 'balanced',
  execution: { autoExecute: false, preferSpeed: true, maxConcurrent: 1, capitalPerTradeUSDT: 100, maxDailyExecutions: 1 },
  riskControls: { maxLatencyMs: 1000, maxTransferMinutes: 10, minDepthUSD: 1000, riskLimitUSDT: 1000 },
  notifications: { immediate: false, dashboardOnly: true, channels: { email: false, telegram: false, webhook: false } },
  autoActions: { notifyOnOpportunity: false, simulateRoutes: false, pauseOnHighLatency: true },
  learning: { enabled: false, adjustFees: false, tightenThresholds: false },
};

describe('ArbitrageAgentControl ARB-WP1B-1 AgentControlShell frame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchArbitrageAgentData.mockResolvedValue({
      config: baseConfig,
      metrics: {
        totalScans: 12,
        scanStats: { total: 12, lastCompletedAt: '2026-07-16T10:23:02.000Z' },
        candidateStats: { total: 0, rejected: 0, spreadCandidates: 0, qualified: 0 },
        qualifiedStats: { total: 0, bestProfitBps: null, expectedNetProfitUSDT: null },
        riskStats: { averageScore: 0, unit: 'score_0_100' },
        execution: { supported: false, realizedProfitUSDT: null },
        bestProfitBps: null,
        netProfitCapturedUSDT: null,
        opportunitiesFound: 0,
        averageProfitBps: null,
        simulatedVolumeUSDT: null,
        avgExecutionMs: null,
        successRate: null,
        riskAlerts: 0,
        opportunityFrequency24h: null,
      },
      lastScan: null,
    });
    fetchArbitrageScanHistory.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0, hasMore: false },
    });
    fetchAIAgents.mockResolvedValue([agent]);
    sendAgentControlCommand.mockResolvedValue({ ok: true });
    updateArbitrageConfig.mockResolvedValue({ ok: true });
  });

  it('renders inside AgentControlShell with header actions and status row', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('agent-control-shell')).toBeTruthy());

    expect(screen.getByTestId('agent-control-shell').getAttribute('data-agent-key')).toBe('arbitrage');
    expect(screen.getByTestId('agent-control-shell-body').getAttribute('data-testid')).toBe(
      'agent-control-shell-body',
    );
    expect(screen.getByTestId('arb-run-scan').className).toContain('bg-purple-600');
    expect(screen.getByTestId('arb-close').className).toContain('rounded-full');
    expect(screen.getByTestId('arb-status-row')).toBeTruthy();
    expect(screen.getByTestId('arb-tablist')).toBeTruthy();
    expect(screen.getByText('arbitrage_analytical_mode_banner')).toBeTruthy();
    expect(screen.queryByText('net_profit_captured')).toBeNull();
    // local fixed overlay removed — only shared shell overlay
    expect(screen.getAllByTestId('agent-control-shell-overlay').length).toBe(1);
  });

  it('closes via Close button and Escape', async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ArbitrageAgentControl agent={agent} onClose={onClose} onUpdate={() => {}} />,
    );
    await waitFor(() => expect(screen.getByTestId('arb-close')).toBeTruthy());

    fireEvent.click(screen.getByTestId('arb-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    onClose.mockClear();
    render(<ArbitrageAgentControl agent={agent} onClose={onClose} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('agent-control-shell')).toBeTruthy());
    fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('restores focus to the previously focused element on unmount', async () => {
    const origin = document.createElement('button');
    origin.textContent = 'Open Agent';
    document.body.appendChild(origin);
    origin.focus();
    expect(document.activeElement).toBe(origin);

    const onClose = vi.fn();
    const { unmount } = render(
      <ArbitrageAgentControl agent={agent} onClose={onClose} onUpdate={() => {}} />,
    );
    await waitFor(() => expect(screen.getByTestId('agent-control-shell')).toBeTruthy());
    unmount();
    expect(document.activeElement).toBe(origin);
    origin.remove();
  });

  it('keeps Tab focus inside the shell dialog', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('agent-control-shell')).toBeTruthy());

    const shell = screen.getByTestId('agent-control-shell');
    const focusables = within(shell)
      .getAllByRole('button')
      .filter(b => !(b as HTMLButtonElement).disabled);
    expect(focusables.length).toBeGreaterThan(2);

    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(shell.contains(document.activeElement)).toBe(true);
  });

  it('switches all six tabs including keyboard arrows', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-tab-overview')).toBeTruthy());

    for (const id of [
      'overview',
      'candidates',
      'history',
      'profitRisk',
      'settings',
      'integration',
    ]) {
      fireEvent.click(screen.getByTestId(`arb-tab-${id}`));
      expect(screen.getByTestId(`arb-tab-${id}`).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('arb-tab-panel').getAttribute('id')).toBe(`arb-panel-${id}`);
    }

    const overview = screen.getByTestId('arb-tab-overview');
    fireEvent.click(overview);
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(screen.getByTestId('arb-tab-candidates').getAttribute('aria-selected')).toBe('true'),
    );
  });

  it('preserves approved button variants after shell migration', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-run-scan')).toBeTruthy());

    expect(screen.getByTestId('arb-run-scan').getAttribute('data-variant')).toBe('primary');
    expect(screen.getByTestId('arb-close').getAttribute('data-variant')).toBe('neutral');
    expect(screen.getByTestId('arb-pause').getAttribute('data-variant')).toBe('warning');
    expect(screen.getByTestId('arb-restart').getAttribute('data-variant')).toBe('action-blue');

    fireEvent.click(screen.getByTestId('arb-tab-settings'));
    expect((await screen.findByTestId('arb-reset')).getAttribute('data-variant')).toBe('neutral');
    expect(screen.getByTestId('arb-save-changes').getAttribute('data-variant')).toBe('primary');
  });

  it('does not render raw i18n key placeholders for shell chrome in English mock', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-run-scan')).toBeTruthy());
    // mock t returns keys — assert controls still have accessible names and no undefined
    expect(screen.getByTestId('arb-run-scan').textContent).toBeTruthy();
    expect(screen.getByTestId('arb-close').textContent).toBeTruthy();
    expect(screen.queryByText('undefined')).toBeNull();
    expect(screen.queryByText('null')).toBeNull();
  });
});
