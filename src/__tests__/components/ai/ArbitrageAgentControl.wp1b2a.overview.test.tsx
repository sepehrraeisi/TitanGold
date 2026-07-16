import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  execution_kind_provider: 'Provider',
  live_side_effects_blocked: 'Live side effects are blocked.',
  agent_state_ready: 'Ready',
  agent_state_paused: 'Paused',
  agent_state_running: 'Running',
  agent_state_error: 'Error',
  agent_state_unavailable: 'Unavailable',
  tab_overview: 'Overview',
  tab_arbitrage_candidates: 'Candidates',
  tab_scan_history: 'Scan history',
  tab_profit_risk: 'Profit & Risk',
  tab_settings: 'Settings',
  tab_integration: 'Integrations',
  not_available: 'N/A',
  loading: 'Loading...',
  retry: 'Retry',
  completed: 'Completed',
  analytical: 'Analytical',
  rejection_reason: 'Rejection',
  execution_unsupported: 'Not supported',
  last_scan_at: 'Last scan',
  spread_candidates: 'Spread candidates',
  rejected_candidates: 'Rejected candidates',
  qualified_opportunities: 'Qualified opportunities',
  arbitrage_avg_risk_score: 'Avg risk score',
  risk_score: 'Risk score',
  execution_support: 'Execution support',
  dry_run: 'Dry Run',
  arbitrage_overview_latest_scan: 'Latest Scan',
  arbitrage_overview_scan_outcome: 'Scan Outcome',
  arbitrage_overview_scan_outcome_subtitle:
    'Candidate, rejected, and qualified counts are distinct and use the latest verified scan contract.',
  arbitrage_overview_interpretation: 'Analytical Interpretation',
  arbitrage_overview_interpretation_subtitle: 'What the latest scan does and does not tell you.',
  arbitrage_overview_recent_summary: 'Recent Candidate Summary',
  arbitrage_overview_recent_summary_subtitle:
    'A compact preview of the latest analytical result. Full lists remain in Candidates.',
  arbitrage_overview_never_scanned: 'Never scanned',
  arbitrage_overview_never_scanned_help:
    'No analytical scan has completed yet. Run a safe scan to inspect current same-market spread conditions.',
  arbitrage_overview_scan_failed: 'Scan failed',
  arbitrage_overview_scan_failed_help:
    'The latest analytical scan did not complete successfully. Retry or review scan history for failure details.',
  arbitrage_overview_data_unavailable: 'Data unavailable',
  arbitrage_overview_no_candidates_help:
    'No positive analytical spread candidate was detected in the latest completed scan.',
  arbitrage_overview_all_rejected_help:
    'Candidates were detected but all were rejected before qualifying as analytical spread candidates.',
  arbitrage_overview_no_qualified_help:
    'Positive spread candidates were observed, but none qualify as executable arbitrage opportunities in the current analytical monitor.',
  arbitrage_overview_top_rejections: 'Top rejection reasons',
  arbitrage_overview_execution_truth:
    'A scan is not an execution. Candidates are not automatically opportunities, and execution support is not available.',
  arbitrage_overview_next_step: 'What should you do next?',
  arbitrage_overview_review_candidates: 'Review candidates',
  arbitrage_overview_view_scan_history: 'View scan history',
  arbitrage_overview_adjust_settings: 'Review settings',
  arbitrage_overview_qualified_hint:
    'Qualified requires an executable proven strategy. Current monitor is analytical only.',
  arbitrage_overview_legacy_hint: 'Legacy normalized scan record.',
  arbitrage_overview_why_no_qualified: 'Why is there no qualified opportunity?',
  arbitrage_overview_truth_scan_not_execution: 'A scan is not an execution.',
  arbitrage_overview_truth_candidate_not_opportunity:
    'A candidate is not automatically a qualified opportunity.',
  arbitrage_overview_truth_execution_unavailable:
    'Execution-backed profit figures are unavailable because execution is not supported.',
  arbitrage_overview_permission_limited_title: 'Permission limited',
  arbitrage_overview_permission_limited: 'You do not have permission to view this overview.',
  arbitrage_overview_auth_required: 'Authentication is required to load this overview.',
  arbitrage_overview_network_error: 'Network error while loading the overview.',
  arbitrage_overview_error_title: 'Overview unavailable',
  arbitrage_overview_error_help: 'Failed to load overview data. Retry when ready.',
  arbitrage_overview_spread_candidates_helper: 'Positive analytical spread detections before qualification.',
  arbitrage_overview_rejected_candidates_helper:
    'Detected candidates that failed threshold, depth, or execution-leg checks.',
  arbitrage_overview_qualified_candidates_helper:
    'Executable qualified opportunities are not expected in this analytical same-market monitor.',
  arbitrage_overview_legacy_help:
    'This result uses legacy normalized scan data. Only fields present in the historical contract are shown.',
  arbitrage_expected_profit: 'Expected profit',
  arbitrage_no_qualified_reason:
    'Same-market bid/ask spreads are analytical only. Qualified arbitrage opportunities require a proven multi-leg executable strategy (not available in this slice).',
  arbitrage_no_spread_candidates: 'No positive analytical spread candidates in the last scan.',
  legacy_scan: 'Legacy scan',
  arbitrage_rejection_legacy_negative_estimate: 'Legacy estimate is non-positive',
  arbitrage_rejection_below_min_profit: 'Below minimum profit threshold',
  arbitrage_rejection_non_positive_net: 'Net estimate is not positive',
  arbitrage_rejection_risk_limit: 'Risk limit exceeded',
  arbitrage_analytical_mode_banner:
    'Analytical mode: MEXC spot bid/ask spread monitor. Not executable multi-leg arbitrage. No live orders.',
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

function baseMetrics() {
  return {
    totalScans: 12,
    scanStats: { total: 12, lastCompletedAt: '2026-07-16T10:23:02.000Z' },
    candidateStats: { total: 3, rejected: 1, spreadCandidates: 2, qualified: 0 },
    qualifiedStats: { total: 0, bestProfitBps: null, expectedNetProfitUSDT: null },
    riskStats: { averageScore: 42, unit: 'score_0_100' },
    execution: { supported: false, realizedProfitUSDT: null },
    bestProfitBps: null,
    netProfitCapturedUSDT: null,
    opportunitiesFound: 2,
    averageProfitBps: null,
    simulatedVolumeUSDT: null,
    avgExecutionMs: null,
    successRate: null,
    riskAlerts: 0,
    opportunityFrequency24h: null,
  };
}

function mockData(overrides: Record<string, any> = {}) {
  fetchArbitrageAgentData.mockResolvedValue({
    config: baseConfig,
    metrics: baseMetrics(),
    lastScan: {
      timestamp: '2026-07-16T10:23:02.000Z',
      analyticalMode: 'analytical_spread_monitor',
      strategyClassification: 'mexc_spot_spread_monitor',
      candidates: [
        {
          id: 'cand-1',
          symbol: 'BTCUSDT',
          classification: 'spread_candidate',
          strategy: 'mexc_spot_spread_monitor',
          strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
          path: ['Observe bid BTCUSDT', 'Observe ask BTCUSDT'],
          expectedProfitBps: 24.2,
          netProfitUSDT: 4.2,
          riskScore: 38,
          timestamp: '2026-07-16T10:23:02.000Z',
          analytical: true,
          executableArbitrage: false,
        },
      ],
      rejectedCandidates: [
        {
          id: 'rej-1',
          symbol: 'ETHUSDT',
          classification: 'rejected_candidate',
          strategy: 'mexc_spot_spread_monitor',
          strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
          path: ['Observe bid ETHUSDT', 'Observe ask ETHUSDT'],
          expectedProfitBps: null,
          netProfitUSDT: null,
          riskScore: null,
          timestamp: '2026-07-16T10:23:02.000Z',
          rejectionReason: 'BELOW_MIN_PROFIT',
          analytical: true,
          executableArbitrage: false,
        },
      ],
      qualifiedOpportunities: [],
      opportunities: [],
      candidateStats: { total: 2, rejected: 1, spreadCandidates: 1, qualified: 0 },
      qualifiedStats: { total: 0, bestProfitBps: null, expectedNetProfitUSDT: null },
      riskStats: { averageScore: 42, unit: 'score_0_100' },
      avgRiskScore: 42,
      netProfitPotentialUSDT: null,
      avgExecutionMs: null,
      exchangesChecked: ['mexc'],
      symbolsChecked: ['BTCUSDT', 'ETHUSDT'],
      legacy: false,
      dryRun: true,
    },
    ...overrides,
  });
  fetchArbitrageScanHistory.mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0, hasMore: false },
  });
  fetchAIAgents.mockResolvedValue([agent]);
  runArbitrageAnalysis.mockResolvedValue({});
  updateArbitrageConfig.mockResolvedValue({ ok: true });
  sendAgentControlCommand.mockResolvedValue({ ok: true });
}

describe('ARB-WP1B-2A Overview redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(translations, {
      active: 'Active',
      execution_mode_dry_run: 'Dry Run',
      offline: 'Offline',
      broker_label: 'Broker',
    });
    mockData();
  });

  it('renders latest scan, distinct outcome counts, and no duplicated shell metrics', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-overview')).toBeTruthy());

    expect(screen.getByText('Latest Scan')).toBeTruthy();
    expect(screen.getByText('Scan Outcome')).toBeTruthy();
    expect(screen.getByText('Analytical Interpretation')).toBeTruthy();
    expect(screen.getByText('Recent Candidate Summary')).toBeTruthy();
    expect(screen.getByText('Review candidates')).toBeTruthy();
    expect(screen.getByText('View scan history')).toBeTruthy();

    const overviewText = screen.getByTestId('arb-overview').textContent || '';
    expect(overviewText).not.toContain('Total scans');
    expect(overviewText).not.toContain('Best qualified profit');
    expect(overviewText).toContain('Execution-backed profit figures are unavailable');
    expect(overviewText).not.toMatch(/\bcaptured profit\b/i);
    expect(overviewText).not.toMatch(/\brealized profit\b/i);
    expect(overviewText).not.toMatch(/DRY_RUN|\bdry_run\b/);
    expect(overviewText).not.toContain('arbitrage_overview_');
  });

  it('shows never-scanned empty state with useful guidance', async () => {
    mockData({ metrics: { ...baseMetrics(), totalScans: 0, scanStats: { total: 0, lastCompletedAt: null } }, lastScan: null });
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByText('Never scanned')).toBeTruthy());
    expect(screen.getAllByText(/No analytical scan has completed yet/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Review settings')).toBeTruthy();
  });

  it('shows all-rejected state and human-readable rejection reasons', async () => {
    mockData({
      metrics: { ...baseMetrics(), candidateStats: { total: 1, rejected: 1, spreadCandidates: 0, qualified: 0 } },
      lastScan: {
        timestamp: '2026-07-16T10:23:02.000Z',
        candidates: [],
        rejectedCandidates: [
          {
            id: 'rej-legacy',
            symbol: 'ADAUSDT',
            classification: 'rejected_candidate',
            strategy: 'mexc_spot_spread_monitor',
            strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
            path: ['Observe bid ADAUSDT', 'Observe ask ADAUSDT'],
            expectedProfitBps: null,
            netProfitUSDT: null,
            riskScore: null,
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
        riskStats: { averageScore: null, unit: 'score_0_100' },
        avgRiskScore: null,
        netProfitPotentialUSDT: null,
        avgExecutionMs: null,
        exchangesChecked: ['mexc'],
        symbolsChecked: ['ADAUSDT'],
        legacy: true,
        dryRun: true,
      },
    });
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-overview-rejection-summary')).toBeTruthy());
    const overviewText = screen.getByTestId('arb-overview').textContent || '';
    expect(overviewText).toContain('Candidates were detected but all were rejected');
    expect(overviewText).toContain('Legacy estimate is non-positive');
    expect(overviewText).not.toContain('LEGACY_NEGATIVE_ESTIMATE');
  });

  it('shows failed state and retry action on API failure', async () => {
    fetchArbitrageAgentData.mockRejectedValueOnce(new Error('Failed to fetch arbitrage data: 500'));
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-overview-error')).toBeTruthy());
    expect(screen.getByText('Overview unavailable')).toBeTruthy();
    expect(screen.getAllByText('Failed to load overview data. Retry when ready.').length).toBeGreaterThan(0);
    expect(screen.getByTestId('arb-overview-error').textContent || '').not.toContain('500');
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(fetchArbitrageAgentData).toHaveBeenCalledTimes(2));
  });

  it('shows permission-limited state for 403 without exposing internals', async () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    fetchArbitrageAgentData.mockRejectedValueOnce(err);
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('arb-overview-permission')).toBeTruthy());
    const overviewText = screen.getByTestId('arb-overview-permission').textContent || '';
    expect(overviewText).toContain('Permission limited');
    expect(overviewText).toContain('You do not have permission to view this overview.');
    expect(overviewText).not.toContain('403');
    expect(overviewText).not.toContain('CAPABILITY');
  });

  it('shows loading skeleton before overview data resolves', async () => {
    fetchArbitrageAgentData.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({ config: baseConfig, metrics: baseMetrics(), lastScan: null }), 40)),
    );
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    expect(screen.getByTestId('arb-overview-loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('arb-overview')).toBeTruthy());
  });

  it('navigates from overview guidance to candidates and history tabs', async () => {
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getByText('Review candidates')).toBeTruthy());

    fireEvent.click(screen.getByText('Review candidates'));
    await waitFor(() => expect(screen.getByTestId('arb-tab-candidates').getAttribute('aria-selected')).toBe('true'));

    fireEvent.click(screen.getByTestId('arb-tab-overview'));
    await waitFor(() => expect(screen.getByText('View scan history')).toBeTruthy());
    fireEvent.click(screen.getByText('View scan history'));
    await waitFor(() => expect(screen.getByTestId('arb-tab-history').getAttribute('aria-selected')).toBe('true'));
  });

  it('renders Persian overview copy without raw keys or English leakage in status states', async () => {
    Object.assign(translations, {
      arbitrage_overview_latest_scan: 'آخرین اسکن',
      arbitrage_overview_scan_outcome: 'خروجی اسکن',
      arbitrage_overview_scan_outcome_subtitle:
        'شمارش کاندید، ردشده و واجد شرایط متمایز است و از قرارداد تأییدشدهٔ آخرین اسکن استفاده می‌کند.',
      arbitrage_overview_interpretation: 'تفسیر تحلیلی',
      arbitrage_overview_interpretation_subtitle: 'آخرین اسکن چه چیزی را نشان می‌دهد و چه چیزی را نشان نمی‌دهد.',
      arbitrage_overview_recent_summary: 'خلاصه اخیر کاندیدها',
      arbitrage_overview_recent_summary_subtitle:
        'پیش‌نمایش فشرده از آخرین نتیجه تحلیلی. فهرست کامل در تب کاندیدهاست.',
      arbitrage_overview_review_candidates: 'بررسی کاندیدها',
      arbitrage_overview_view_scan_history: 'مشاهده تاریخچه اسکن',
      arbitrage_overview_adjust_settings: 'مرور تنظیمات',
      arbitrage_overview_no_candidates_help: 'در آخرین اسکن کامل، هیچ کاندید اسپرد تحلیلی مثبتی شناسایی نشد.',
      arbitrage_overview_never_scanned: 'هنوز اسکن نشده',
      arbitrage_overview_execution_truth: 'اسکن معادل اجرا نیست. کاندیدها به‌طور خودکار فرصت نیستند و پشتیبانی اجرا در دسترس نیست.',
      arbitrage_overview_data_unavailable: 'داده در دسترس نیست',
      arbitrage_overview_never_scanned_help:
        'هنوز هیچ اسکن تحلیلی کامل نشده است. برای بررسی شرایط فعلی اسپرد همان‌بازار، یک اسکن امن اجرا کنید.',
      arbitrage_overview_permission_limited_title: 'دسترسی محدود',
      arbitrage_overview_permission_limited: 'شما مجوز مشاهده این نمای کلی را ندارید.',
      arbitrage_overview_why_no_qualified: 'چرا فرصت واجد شرایط وجود ندارد؟',
      arbitrage_overview_next_step: 'گام بعدی چیست؟',
      arbitrage_overview_qualified_hint:
        'واجد شرایط بودن نیازمند استراتژی اجرایی اثبات‌شده است. مانیتور فعلی فقط تحلیلی است.',
      arbitrage_overview_spread_candidates_helper: 'شناسایی‌های مثبت اسپرد تحلیلی پیش از مرحله واجد شرایط.',
      arbitrage_overview_rejected_candidates_helper:
        'کاندیدهایی که در آستانه، عمق یا پایه‌های اجرا رد شده‌اند.',
      arbitrage_overview_qualified_candidates_helper:
        'فرصت‌های اجرایی واجد شرایط در این مانیتور تحلیلی همان‌بازار انتظار نمی‌رود.',
      arbitrage_overview_truth_scan_not_execution: 'اسکن معادل اجرا نیست.',
      arbitrage_overview_truth_candidate_not_opportunity: 'کاندید به‌طور خودکار فرصت واجد شرایط نیست.',
      arbitrage_overview_truth_execution_unavailable:
        'به‌دلیل پشتیبانی‌نشدن اجرا، رقم سود مبتنی بر اجرا در دسترس نیست.',
      arbitrage_no_qualified_reason:
        'اسپردهای bid/ask همان‌بازار فقط تحلیلی هستند. فرصت آربیتراژ واجد شرایط نیازمند استراتژی چندپایهٔ اجرایی اثبات‌شده است.',
      arbitrage_no_spread_candidates: 'در آخرین اسکن هیچ کاندید اسپرد تحلیلی مثبتی نیست.',
      arbitrage_rejection_below_min_profit: 'کمتر از آستانه حداقل سود',
      execution_unsupported: 'پشتیبانی نمی‌شود',
      execution_support: 'پشتیبانی اجرا',
      spread_candidates: 'کاندیدهای اسپرد',
      rejected_candidates: 'کاندیدهای ردشده',
      qualified_opportunities: 'فرصت‌های واجد شرایط',
      last_scan_at: 'آخرین اسکن',
      arbitrage_avg_risk_score: 'میانگین امتیاز ریسک',
      risk_score: 'امتیاز ریسک',
      dry_run: 'اجرای آزمایشی',
      active: 'فعال',
      offline: 'آفلاین',
      broker_label: 'کارگزار',
      emergency_stop: 'توقف اضطراری',
      execution_mode_dry_run: 'اجرای آزمایشی',
      completed: 'کامل‌شده',
      not_available: 'ناموجود',
    });
    mockData({
      metrics: {
        ...baseMetrics(),
        totalScans: 0,
        scanStats: { total: 0, lastCompletedAt: null },
        candidateStats: { total: 0, rejected: 0, rawCandidates: 0, qualified: 0 },
        riskStats: { averageScore: null, unit: 'score_0_100' },
      },
      lastScan: null,
    });
    render(<ArbitrageAgentControl agent={agent} onClose={() => {}} onUpdate={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('آخرین اسکن').length).toBeGreaterThan(0));
    const text = screen.getByTestId('arb-overview').textContent || '';
    expect(text).toContain('هنوز اسکن نشده');
    expect(text).toContain('بررسی کاندیدها');
    expect(text).not.toMatch(/DRY_RUN|dry_run/);
    expect(text).not.toContain('arbitrage_overview_');
  });
});
