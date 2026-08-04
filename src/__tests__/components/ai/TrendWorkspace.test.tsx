import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrendWorkspace from '../../../../components/ai/TrendWorkspace';
import type { AIAgent } from '../../../../types';

const translations: Record<string, string> = {
  tab_overview: 'Overview',
  trend_tab_regime_strength: 'Regime & Strength',
  trend_tab_evidence: 'Evidence',
  trend_tab_weakening_reversal: 'Weakening',
  trend_tab_multi_timeframe: 'Multi-Timeframe',
  trend_tab_history: 'History',
  tab_settings: 'Settings',
  tab_integration: 'Integrations',
  trend_run_analysis: 'Run analysis',
  trend_confirm_analysis_title: 'Run trend analysis?',
  trend_confirm_analysis_desc: 'Read-only public analysis.',
  cancel: 'Cancel',
  close: 'Close',
  loading: 'Loading',
  no_trend_data: 'No analyses yet',
  not_available: 'N/A',
  trend_sections: 'Trend sections',
  symbol: 'Symbol',
  timeframe: 'Timeframe',
  save: 'Save',
};

vi.mock('../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    t: (key: string) => translations[key] ?? key,
    language: 'en',
  }),
}));

vi.mock('../../../../services/trendCoreClient.ts', () => ({
  fetchTrendOverview: vi.fn(),
  fetchTrendRuns: vi.fn(),
  fetchTrendSettings: vi.fn(),
  fetchTrendIntegrations: vi.fn(),
  fetchTrendRunDetail: vi.fn(),
  runTrendAnalysis: vi.fn(),
  updateTrendSettings: vi.fn(),
  createTrendIdempotencyKey: vi.fn(() => 'trend-test-key'),
}));

vi.mock('../../../../hooks/useAgentExecutionGate.ts', () => ({
  useAgentExecutionGate: () => ({
    guardExecution: () => true,
    blockReason: null,
    canExecuteSafe: true,
    loading: false,
  }),
}));

vi.mock('../../../../hooks/useExecutionRuntime.ts', () => ({
  useExecutionRuntime: () => ({ runtime: { globalMode: 'demo', killSwitchActive: true }, loading: false }),
}));

const mockAgent: AIAgent = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  name: 'Trend Detection',
  agent_key: 'trend_detection',
  role: 'Trend analysis',
  status: 'active',
  type: 'analytical',
  capabilities: [],
  accuracy: null,
  lastUpdate: null,
};

import * as trendClient from '../../../../services/trendCoreClient.ts';

describe('TrendWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trendClient.fetchTrendOverview).mockResolvedValue({
      productIdentity: { executionClass: 'analytical' },
      settings: {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        compareTimeframes: [],
        adxPeriod: 14,
        smaPeriod: 50,
        emaPeriod: 20,
        trendLineLookback: 20,
        candleCount: 200,
        autoExecute: { supported: false, effective: false, reason: 'execution_blocked' },
        version: 1,
      },
      latestSnapshot: null,
      latestRun: null,
      comparison: { available: false },
      metrics: { totalRuns: 0, lastRunAt: null, lastRunId: null },
      runtime: {},
      scheduler: {},
    });
    vi.mocked(trendClient.fetchTrendRuns).mockResolvedValue({ runs: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    vi.mocked(trendClient.fetchTrendSettings).mockResolvedValue({
      symbol: 'BTC/USDT',
      timeframe: '1h',
      compareTimeframes: [],
      adxPeriod: 14,
      smaPeriod: 50,
      emaPeriod: 20,
      trendLineLookback: 20,
      candleCount: 200,
      autoExecute: { supported: false, effective: false, reason: 'execution_blocked' },
      version: 1,
    });
    vi.mocked(trendClient.fetchTrendIntegrations).mockResolvedValue({
      publicMarketData: { status: 'available' },
      trendAnalyzer: { status: 'available' },
    });
  });

  it('renders workspace shell and first-run empty overview', async () => {
    render(
      <TrendWorkspace agent={mockAgent} onBack={vi.fn()} onUpdate={vi.fn()} embedded />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('trend-workspace')).toBeInTheDocument();
    });
    expect(screen.getByTestId('trend-run-analytical-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('trend-overview-empty')).toBeInTheDocument();
  });

  it('opens confirmation without native dialog when run is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TrendWorkspace agent={mockAgent} onBack={vi.fn()} onUpdate={vi.fn()} embedded />,
    );
    await waitFor(() => screen.getByTestId('trend-run-analytical-analysis'));
    await user.click(screen.getByTestId('trend-run-analytical-analysis'));
    expect(screen.getByTestId('trend-analyze-confirm-run')).toBeInTheDocument();
    expect(screen.getByTestId('trend-analyze-confirm-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('trend-analyze-timeframe')).toBeInTheDocument();
  });

  it('navigates specialized trend tabs', async () => {
    const user = userEvent.setup();
    render(
      <TrendWorkspace agent={mockAgent} onBack={vi.fn()} onUpdate={vi.fn()} embedded />,
    );
    await waitFor(() => screen.getByTestId('trend-tab-evidence'));
    await user.click(screen.getByTestId('trend-tab-evidence'));
    expect(screen.getByTestId('trend-tab-evidence')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('trend-panel-evidence')).toBeInTheDocument();
  });
});
