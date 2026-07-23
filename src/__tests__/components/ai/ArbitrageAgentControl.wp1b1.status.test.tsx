import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ArbitrageAgentControl from '../../../../components/ai/ArbitrageAgentControl.tsx';

const translations: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  online: 'Online',
  offline: 'Offline',
  emergency_stop: 'Emergency Stop',
  broker_label: 'Broker',
  last_run: 'Last run',
  never_run: 'Never',
  close: 'Close',
  run_scan: 'Run Scan',
  pause: 'Pause',
  restart: 'Restart',
  execution_mode_dry_run: 'Dry Run',
  execution_mode_demo: 'Demo',
  execution_mode_live: 'Live',
  execution_kind_provider: 'Provider',
  live_side_effects_blocked: 'Live side effects are blocked.',
  agent_state_ready: 'Ready',
  agent_state_paused: 'Paused',
  agent_state_running: 'Running',
  agent_state_error: 'Error',
  agent_state_unavailable: 'Unavailable',
  agent_state_scheduled: 'Scheduled',
  agent_reason_awaiting_first_run: 'Awaiting first scheduled run',
  dry_run_badge: 'Dry Run',
  mode_active_short: 'Active',
  broker_disconnected: 'Broker offline',
  broker_connected: 'Broker connected',
  arbitrage_analytical_mode_banner:
    'Analytical mode: MEXC spot bid/ask spread monitor. Not executable multi-leg arbitrage. No live orders.',
  tab_overview: 'Overview',
  tab_arbitrage_candidates: 'Candidates',
  tab_scan_history: 'Scan history',
  tab_profit_risk: 'Profit & Risk',
  tab_settings: 'Settings',
  tab_integration: 'Integrations',
  not_available: 'N/A',
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
  statusProjection: {
    agentKey: 'arbitrage',
    registered: true,
    configured: true,
    enabled: true,
    allowlisted: true,
    scheduled: true,
    running: false,
    healthy: true,
    dataReady: false,
    consumerRegistered: true,
    consumerEligible: true,
    executionEligible: false,
    lastRunStatus: 'never',
    schedulerOwner: 'titan-engine-worker',
  },
} as any;

const baseConfig = {
  exchanges: [{ id: 'mexc', name: 'MEXC', enabled: true, markets: ['spot'], tradingFeeBps: 10 }],
  strategies: [
    { type: 'spot', enabled: true, minProfitBps: 20, maxSlippageBps: 10, maxExposureUSDT: 1000 },
  ],
  symbols: ['BTCUSDT'],
  opportunityThresholdBps: 20,
  detectionSensitivity: 'balanced',
  execution: {
    autoExecute: false,
    preferSpeed: true,
    maxConcurrent: 1,
    capitalPerTradeUSDT: 100,
    maxDailyExecutions: 1,
  },
  riskControls: {
    maxLatencyMs: 1000,
    maxTransferMinutes: 10,
    minDepthUSD: 1000,
    riskLimitUSDT: 1000,
  },
  notifications: {
    immediate: false,
    dashboardOnly: true,
    channels: { email: false, telegram: false, webhook: false },
  },
  autoActions: { notifyOnOpportunity: false, simulateRoutes: false, pauseOnHighLatency: true },
  learning: { enabled: false, adjustFees: false, tightenThresholds: false },
};

describe('ARB-WP1B-1 header status presentation', () => {
  beforeEach(() => {
    Object.assign(translations, {
      active: 'Active',
      inactive: 'Inactive',
      online: 'Online',
      offline: 'Offline',
      emergency_stop: 'Emergency Stop',
      broker_label: 'Broker',
      last_run: 'Last run',
      execution_mode_dry_run: 'Dry Run',
      execution_kind_provider: 'Provider',
      live_side_effects_blocked: 'Live side effects are blocked.',
      close: 'Close',
      run_scan: 'Run Scan',
    });
    vi.clearAllMocks();
    fetchArbitrageAgentData.mockResolvedValue({
      config: baseConfig,
      metrics: {
        totalScans: 12,
        scanStats: { total: 12, lastCompletedAt: '2026-07-16T10:23:02.000Z' },
        candidateStats: { total: 0, rejected: 0, rawCandidates: 0, qualified: 0 },
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
  });

  it('shows Scheduled status, one Dry Run mode, and clean Broker Offline', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-overview')).toBeTruthy());

    const shellText = screen.getByTestId('agent-control-shell').textContent || '';

    expect(screen.getByTestId('agent-shell-status').textContent).toBe('Scheduled');
    expect(screen.getByTestId('agent-shell-effective-mode').textContent).toBe('Dry Run');
    expect(screen.getByTestId('agent-shell-execution-kind').textContent).toBe('Provider');

    expect(shellText).not.toMatch(/DRY_RUN/);
    expect(shellText).not.toMatch(/\bdry_run\b/);
    expect(shellText).not.toContain('Active: DRY_RUN');
    expect(shellText).not.toContain('Broker: Broker offline');
    expect(shellText).not.toContain('Broker offline');

    const safetyPrimary = screen.getByTestId('agent-shell-safety-primary').textContent || '';
    expect(safetyPrimary).toContain('Emergency Stop: Active');
    expect(safetyPrimary).toContain('Broker: Offline');
    expect(screen.getByTestId('agent-shell-safety-detail').textContent).toBe(
      'Live side effects are blocked.',
    );

    // Dry Run appears once in the intended header status badge (Overview must not duplicate it)
    const dryRunMatches = (screen.getByTestId('agent-shell-status-row').textContent || '').match(/Dry Run/g) || [];
    expect(dryRunMatches.length).toBe(1);
    expect(screen.getByTestId('arb-overview').textContent || '').not.toContain('Dry Run');
  });

  it('preserves approved button variants and WP1A metrics row', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-run-scan')).toBeTruthy());

    expect(screen.getByTestId('arb-run-scan').getAttribute('data-variant')).toBe('primary');
    expect(screen.getByTestId('arb-close').getAttribute('data-variant')).toBe('neutral');
    expect(screen.getByTestId('arb-pause').getAttribute('data-variant')).toBe('warning');
    expect(screen.getByTestId('arb-restart').getAttribute('data-variant')).toBe('action-blue');
    expect(screen.getByTestId('arb-status-row')).toBeTruthy();
    expect(screen.queryByText('undefined')).toBeNull();
  });
});

describe('ARB-WP1B-1 header status presentation (Persian)', () => {
  beforeEach(() => {
    translations.active = 'فعال';
    translations.inactive = 'غیرفعال';
    translations.online = 'آنلاین';
    translations.offline = 'آفلاین';
    translations.emergency_stop = 'توقف اضطراری';
    translations.broker_label = 'کارگزار';
    translations.last_run = 'آخرین اجرا';
    translations.execution_mode_dry_run = 'اجرای آزمایشی';
    translations.execution_kind_provider = 'ارائه‌دهنده';
    translations.live_side_effects_blocked = 'اثرات جانبی زنده مسدود است.';
    translations.close = 'بستن';
    translations.run_scan = 'اجرای اسکن';
    translations.agent_state_scheduled = 'زمان‌بندی‌شده';
    translations.agent_reason_awaiting_first_run = 'در انتظار اولین اجرای زمان‌بندی‌شده';

    vi.clearAllMocks();
    fetchArbitrageAgentData.mockResolvedValue({
      config: baseConfig,
      metrics: {
        totalScans: 1,
        scanStats: { total: 1, lastCompletedAt: null },
        candidateStats: { total: 0, rejected: 0, rawCandidates: 0, qualified: 0 },
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
  });

  it('renders localized status labels without English leakage or raw enums', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('agent-shell-status')).toBeTruthy());

    expect(screen.getByTestId('agent-shell-status').textContent).toBe('زمان‌بندی‌شده');
    expect(screen.getByTestId('agent-shell-effective-mode').textContent).toBe('اجرای آزمایشی');
    expect(screen.getByTestId('agent-shell-execution-kind').textContent).toBe('ارائه‌دهنده');

    const shellText = screen.getByTestId('agent-control-shell').textContent || '';
    expect(shellText).not.toMatch(/DRY_RUN/);
    expect(shellText).not.toMatch(/\bdry_run\b/);
    expect(shellText).not.toContain('Broker offline');
    expect(shellText).not.toContain('Dry Run');

    const safetyPrimary = screen.getByTestId('agent-shell-safety-primary').textContent || '';
    expect(safetyPrimary).toContain('توقف اضطراری');
    expect(safetyPrimary).toContain('فعال');
    expect(safetyPrimary).toContain('کارگزار');
    expect(safetyPrimary).toContain('آفلاین');
    expect(safetyPrimary).not.toContain('کارگزار آفلاین');
  });
});
