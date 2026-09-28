import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArbitrageAgentControl from '../../../../components/ai/ArbitrageAgentControl.tsx';
import {
  BTN_ACTION_BLUE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_WARNING,
} from '../../../../components/ai/AIManager/tabs/DataHub/dataHubUi.tsx';

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
} as any;

const baseConfig = {
  exchanges: [{ id: 'mexc', name: 'MEXC', enabled: true, markets: ['spot'], tradingFeeBps: 10 }],
  strategies: [{ type: 'spot', enabled: true, minProfitBps: 20, maxSlippageBps: 10, maxExposureUSDT: 1000 }],
  symbols: ['BTCUSDT'],
  opportunityThresholdBps: 20,
  detectionSensitivity: 'balanced',
  execution: { autoExecute: true, preferSpeed: true, maxConcurrent: 1, capitalPerTradeUSDT: 100, maxDailyExecutions: 1 },
  riskControls: { maxLatencyMs: 1000, maxTransferMinutes: 10, minDepthUSD: 1000, riskLimitUSDT: 1000 },
  notifications: { immediate: false, dashboardOnly: true, channels: { email: false, telegram: false, webhook: false } },
  autoActions: { notifyOnOpportunity: false, simulateRoutes: false, pauseOnHighLatency: true },
  learning: { enabled: false, adjustFees: false, tightenThresholds: false },
};

function mockPanelData(overrides: Record<string, unknown> = {}) {
  fetchArbitrageAgentData.mockResolvedValue({
    config: baseConfig,
    metrics: {
      totalScans: 12,
      scanStats: { total: 12, lastCompletedAt: '2026-07-16T10:23:02.000Z' },
      candidateStats: { total: 3, rejected: 3, spreadCandidates: 0, qualified: 0 },
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
    lastScan: {
      timestamp: '2026-07-16T10:23:02.000Z',
      candidates: [],
      rejectedCandidates: [
        {
          id: '1',
          symbol: 'ADAUSDT',
          classification: 'rejected_candidate',
          strategy: 'mexc_spot_spread_monitor',
          strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
          path: ['Observe bid ADAUSDT', 'Observe ask ADAUSDT'],
          expectedProfitBps: -13.8,
          netProfitUSDT: -13.8,
          riskScore: 0,
          timestamp: '2026-07-16T10:23:02.000Z',
          rejectionReason: 'LEGACY_NEGATIVE_ESTIMATE',
          analytical: true,
          executableArbitrage: false,
        },
      ],
      qualifiedOpportunities: [],
      opportunities: [],
      candidateStats: { total: 1, rejected: 1, spreadCandidates: 0, qualified: 0 },
      qualifiedStats: { total: 0, bestProfitBps: null, expectedNetProfitUSDT: null },
      avgRiskScore: 0,
      netProfitPotentialUSDT: null,
      avgExecutionMs: null,
      exchangesChecked: ['mexc'],
      symbolsChecked: [],
    },
    ...overrides,
  });
  fetchArbitrageScanHistory.mockResolvedValue({
    items: [
      {
        id: 'scan-1',
        decisionType: 'arbitrage_scan',
        completedAt: '2026-07-16T10:23:02.000Z',
        startedAt: '2026-07-16T10:23:02.000Z',
        status: 'completed',
        legacy: true,
        analyticalMode: 'analytical_spread_monitor',
        strategyClassification: 'mexc_spot_spread_monitor',
        candidateStats: { total: 3, rejected: 3, spreadCandidates: 0, qualified: 0 },
        qualifiedStats: { total: 0, bestProfitBps: null, expectedNetProfitUSDT: null },
        riskStats: { averageScore: 0, unit: 'score_0_100' },
        dryRun: true,
        errorMessage: null,
        confidence: 0.5,
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 12, totalPages: 2, hasMore: true },
  });
  runArbitrageAnalysis.mockResolvedValue({
    timestamp: '2026-07-16T10:24:00.000Z',
    candidates: [],
    rejectedCandidates: [],
    qualifiedOpportunities: [],
    opportunities: [],
    candidateStats: { total: 0, rejected: 0, spreadCandidates: 0, qualified: 0 },
    qualifiedStats: { total: 0, bestProfitBps: null, expectedNetProfitUSDT: null },
    avgRiskScore: 0,
    netProfitPotentialUSDT: null,
    avgExecutionMs: null,
    exchangesChecked: ['mexc'],
    symbolsChecked: [],
  });
  fetchAIAgents.mockResolvedValue([agent]);
  sendAgentControlCommand.mockResolvedValue({ ok: true });
  updateArbitrageConfig.mockResolvedValue({ ok: true });
}

describe('ArbitrageAgentControl WP1A', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPanelData();
  });

  it('shows canonical total scans and N/A best qualified profit without captured profit', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId('arb-status-row').textContent || '').toMatch(/total_scans/);
    });

    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.queryByText('net_profit_captured')).toBeNull();
    expect(screen.queryByText(/\$\-51/)).toBeNull();
    expect(screen.getByTestId('arb-status-row').textContent || '').toMatch(/best_qualified_profit_bps/);
    expect(screen.getAllByText('not_available').length).toBeGreaterThan(0);
    expect(screen.queryByText('strategy_spot')).toBeNull();
    expect(screen.queryByText('strategy_triangle')).toBeNull();
    expect(screen.getByText('arbitrage_analytical_mode_banner')).toBeTruthy();
  });

  it('loads real scan history and marks execution unsupported', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(fetchArbitrageScanHistory).toHaveBeenCalled());

    screen.getByText('tab_scan_history').click();
    await waitFor(() => {
      expect(screen.getByText('execution_history_unavailable')).toBeTruthy();
    });
    expect(screen.getByText(/legacy_scan/)).toBeTruthy();
  });
});

describe('ArbitrageAgentControl ARB-A9 button design system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPanelData();
    runArbitrageAnalysis.mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(
            () =>
              resolve({
                timestamp: '2026-07-16T10:24:00.000Z',
                candidates: [],
                rejectedCandidates: [],
                qualifiedOpportunities: [],
                opportunities: [],
                candidateStats: { total: 0, rejected: 0, spreadCandidates: 0, qualified: 0 },
                qualifiedStats: { total: 0, bestProfitBps: null, expectedNetProfitUSDT: null },
                avgRiskScore: 0,
                netProfitPotentialUSDT: null,
                avgExecutionMs: null,
                exchangesChecked: ['mexc'],
                symbolsChecked: [],
              }),
            50,
          );
        }),
    );
    sendAgentControlCommand.mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve({ ok: true }), 80);
        }),
    );
  });

  async function openPanel(onClose = () => {}) {
    render(<ArbitrageAgentControl agent={agent} onClose={onClose} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-overview')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('arb-run-scan')).not.toBeDisabled());
  }

  it('maps six actions to canonical design-system variants', async () => {
    await openPanel();

    const runScan = screen.getByTestId('arb-run-scan');
    const closeBtn = screen.getByTestId('arb-close');
    const pauseBtn = screen.getByTestId('arb-pause');
    const restartBtn = screen.getByTestId('arb-restart');

    expect(runScan.getAttribute('data-variant')).toBe('primary');
    expect(closeBtn.getAttribute('data-variant')).toBe('neutral');
    expect(pauseBtn.getAttribute('data-variant')).toBe('warning');
    expect(restartBtn.getAttribute('data-variant')).toBe('action-blue');

    expect(runScan.className).toContain('bg-purple-600');
    expect(runScan.className).toContain('rounded-full');
    expect(runScan.className).not.toMatch(/bg-emerald|bg-green/);

    expect(closeBtn.className).toContain('border-slate-600');
    expect(closeBtn.className).toContain('rounded-full');

    expect(pauseBtn.className).toContain('bg-amber-600');
    expect(pauseBtn.className).toContain('rounded-full');

    expect(restartBtn.className).toContain('bg-blue-600');
    expect(restartBtn.className).toContain('rounded-full');

    expect(BTN_PRIMARY).toContain('bg-purple-600');
    expect(BTN_SECONDARY).toContain('border-slate-600');
    expect(BTN_WARNING).toContain('bg-amber-600');
    expect(BTN_ACTION_BLUE).toContain('bg-blue-600');

    fireEvent.click(screen.getByText('tab_settings'));
    const resetBtn = await screen.findByTestId('arb-reset');
    const saveBtn = screen.getByTestId('arb-save-changes');
    expect(resetBtn.getAttribute('data-variant')).toBe('neutral');
    expect(saveBtn.getAttribute('data-variant')).toBe('primary');
    expect(resetBtn.className).toContain('rounded-full');
    expect(saveBtn.className).toContain('bg-purple-600');
    expect(saveBtn.className).not.toMatch(/bg-emerald|bg-green/);
    expect(resetBtn).toBeDisabled();
    expect(saveBtn).toBeDisabled();
  });

  it('preserves handlers, loading, and double-click protection', async () => {
    const onClose = vi.fn();
    await openPanel(onClose);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('arb-run-scan'));
    await user.click(screen.getByTestId('arb-run-scan'));
    await waitFor(() => expect(runArbitrageAnalysis).toHaveBeenCalledTimes(1));

    await user.click(screen.getByTestId('arb-pause'));
    await user.click(screen.getByTestId('arb-pause'));
    await waitFor(() => expect(sendAgentControlCommand).toHaveBeenCalledTimes(1));
    expect(sendAgentControlCommand).toHaveBeenCalledWith(agent.id, 'pause');

    await waitFor(() => expect(screen.getByTestId('arb-restart')).not.toBeDisabled());
    await user.click(screen.getByTestId('arb-restart'));
    await waitFor(() => expect(sendAgentControlCommand).toHaveBeenCalledWith(agent.id, 'restart'));

    await user.click(screen.getByTestId('arb-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables Save/Reset until dirty and prevents repeated save', async () => {
    await openPanel();

    fireEvent.click(screen.getByText('tab_settings'));
    const resetBtn = await screen.findByTestId('arb-reset');
    const saveBtn = screen.getByTestId('arb-save-changes');
    expect(resetBtn).toBeDisabled();
    expect(saveBtn).toBeDisabled();

    const threshold = screen.getByLabelText('opportunity_threshold_bps');
    fireEvent.change(threshold, { target: { value: '25' } });
    await waitFor(() => {
      expect(screen.getByTestId('arb-save-changes')).not.toBeDisabled();
      expect(screen.getByTestId('arb-reset')).not.toBeDisabled();
    });

    updateArbitrageConfig.mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve({ ok: true }), 80);
        }),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('arb-save-changes'));
    await user.click(screen.getByTestId('arb-save-changes'));
    await waitFor(() => expect(updateArbitrageConfig).toHaveBeenCalledTimes(1));
    expect(updateArbitrageConfig.mock.calls[0][0]).toBe(agent.id);
  });

  it('uses type=button on action controls to avoid accidental form submit', async () => {
    await openPanel();
    for (const id of ['arb-run-scan', 'arb-close', 'arb-pause', 'arb-restart']) {
      expect(screen.getByTestId(id).getAttribute('type')).toBe('button');
    }
    fireEvent.click(screen.getByText('tab_settings'));
    expect((await screen.findByTestId('arb-reset')).getAttribute('type')).toBe('button');
    expect(screen.getByTestId('arb-save-changes').getAttribute('type')).toBe('button');
  });
});
