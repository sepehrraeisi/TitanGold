import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('ArbitrageAgentControl WP1A', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchArbitrageAgentData.mockResolvedValue({
      config: {
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
      },
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
  });

  it('shows canonical total scans and N/A best qualified profit without captured profit', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('total_scans')).toBeTruthy();
    });

    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.queryByText('net_profit_captured')).toBeNull();
    expect(screen.queryByText(/\$\-51/)).toBeNull();
    expect(screen.getByText('best_qualified_profit_bps')).toBeTruthy();
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
