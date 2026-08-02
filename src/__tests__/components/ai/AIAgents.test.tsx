import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIAgents from '../../../../components/ai/AIAgents';
import * as api from '../../../../services/api';
import type { AIAgent } from '../../../../types';
import type { AgentStatusProjection } from '../../../../utils/agentStatusProjection';

vi.mock('../../../../services/api', () => ({
  fetchAIAgents: vi.fn(),
  runTrendDetectionAnalysis: vi.fn(),
  sendAgentControlCommand: vi.fn(),
}));

let currentLanguage: 'en' | 'fa' = 'en';

const translations = {
  en: {
    loading: 'loading',
    failed_to_load_data: 'Failed to load AI agents.',
    retry: 'Retry',
    open_agent: 'Open Agent',
    close: 'Close',
    search_agents: 'Search by name, purpose, or capability...',
    status: 'Status',
    sort: 'Sort',
    all: 'All',
    no_agents_found: 'No agents found',
    try_different_search: 'Try a different search term or adjust the filters.',
    clear_filters: 'Clear filters',
    agents_results_all: 'Showing {count} agents',
    agents_results_filtered: 'Showing {count} of {total} agents',
    agents_results_one: '1 agent found',
    agents_results_none: 'No agents found',
    agent_state_ready: 'Ready',
    agent_state_running: 'Running',
    agent_state_paused: 'Paused',
    agent_state_error: 'Error',
    agent_state_unavailable: 'Unavailable',
    agent_state_scheduled: 'Scheduled',
    agent_state_allowlisted: 'Allowlisted',
    agent_product_limited: 'Limited',
    agent_product_blocked: 'Blocked',
    agent_product_operational: 'Operational',
    agent_reason_not_scheduled: 'Not scheduled',
    agent_reason_execution_disabled_runtime: 'Financial execution is disabled in the current runtime',
    sort_by_name: 'Name',
    sort_by_last_run: 'Last Run',
    sort_by_status: 'Status',
    agents_dry_run_blocked_short: 'Agents run in Dry Run. Live side effects are blocked.',
    effective_mode: 'Effective Mode',
    emergency_stop: 'Emergency Stop',
    active: 'Active',
    last_run: 'Last run',
    results_count: 'Results',
    execution_type: 'Type',
    execution_kind_analytical: 'Analytical',
    execution_kind_provider: 'Provider',
    execution_kind_live_capable: 'Live-capable',
    not_available: 'N/A',
    dry_run_badge: 'Dry Run',
    blocked_badge: 'Blocked',
    live_capable_badge: 'Live-capable',
    agent_realtime_unavailable: 'Real-time updates unavailable',
    agent_realtime_connected: 'Realtime agent updates connected',
    agents_permission_limited: 'Your role has limited agent access. Some actions may be unavailable.',
    agents_read_only_badge: 'View only',
    execution_safety: 'Execution safety',
    runtime_mode_hint: 'Effective trading mode for this session',
  },
  fa: {
    loading: 'در حال بارگذاری',
    failed_to_load_data: 'بارگذاری عامل‌های هوش مصنوعی انجام نشد.',
    retry: 'تلاش دوباره',
    open_agent: 'باز کردن عامل',
    close: 'بستن',
    search_agents: 'جست‌وجو بر اساس نام، نقش یا قابلیت...',
    status: 'وضعیت',
    sort: 'مرتب‌سازی',
    all: 'همه',
    no_agents_found: 'هیچ عاملی پیدا نشد',
    try_different_search: 'عبارت دیگری را جست‌وجو کنید یا فیلترها را تغییر دهید.',
    clear_filters: 'پاک کردن فیلترها',
    agents_results_all: 'نمایش {count} عامل',
    agents_results_filtered: 'نمایش {count} عامل از {total} عامل',
    agents_results_one: '۱ عامل پیدا شد',
    agents_results_none: 'هیچ عاملی پیدا نشد',
    agent_state_ready: 'آماده',
    agent_state_running: 'در حال اجرا',
    agent_state_paused: 'متوقف',
    agent_state_error: 'خطا',
    agent_state_unavailable: 'ناموجود',
    agent_state_scheduled: 'زمان‌بندی‌شده',
    agent_state_allowlisted: 'در لیست مجاز',
    agent_product_limited: 'محدود',
    agent_product_blocked: 'مسدود',
    agent_product_operational: 'عملیاتی',
    agent_reason_not_scheduled: 'زمان‌بندی نشده',
    agent_reason_execution_disabled_runtime: 'اجرای مالی در runtime فعلی غیرفعال است',
    sort_by_name: 'نام',
    sort_by_last_run: 'آخرین اجرا',
    sort_by_status: 'وضعیت',
    agents_dry_run_blocked_short: 'عامل‌ها در Dry Run اجرا می‌شوند. اثرات جانبی زنده مسدود است.',
    effective_mode: 'حالت مؤثر',
    emergency_stop: 'توقف اضطراری',
    active: 'فعال',
    last_run: 'آخرین اجرا',
    results_count: 'نتایج',
    execution_type: 'نوع',
    execution_kind_analytical: 'تحلیلی',
    execution_kind_provider: 'ارائه‌دهنده',
    execution_kind_live_capable: 'قابلیت زنده',
    not_available: 'N/A',
    dry_run_badge: 'Dry Run',
    blocked_badge: 'مسدود',
    live_capable_badge: 'قابلیت زنده',
    agent_realtime_unavailable: 'به‌روزرسانی برخط در دسترس نیست',
    agent_realtime_connected: 'به‌روزرسانی برخط عامل‌ها متصل است',
    agents_permission_limited: 'نقش شما دسترسی محدود به عامل‌ها دارد. برخی اقدامات ممکن است در دسترس نباشند.',
    agents_read_only_badge: 'فقط مشاهده',
    execution_safety: 'ایمنی اجرا',
    runtime_mode_hint: 'حالت مؤثر معامله برای این نشست',
  },
} as const;

function translate(key: string, options?: { [key: string]: string | number }) {
  let value = (translations[currentLanguage] as Record<string, string>)[key] || key;
  if (options) {
    for (const [k, v] of Object.entries(options)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return value;
}

vi.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: currentLanguage,
    setLanguage: (language: 'en' | 'fa') => {
      currentLanguage = language;
    },
    t: translate,
  }),
}));

vi.mock('../../../../hooks/useWebSocket.ts', () => ({
  useWebSocket: () => ({
    isConnected: false,
    realtimeUnavailable: false,
    send: vi.fn(),
    connect: vi.fn(),
  }),
}));

vi.mock('../../../../hooks/useExecutionRuntime.ts', () => ({
  useExecutionRuntime: () => ({
    runtime: {
      effectiveMode: 'demo',
      globalMode: 'demo',
      killSwitchActive: true,
      killSwitchReason: null,
      workerAcknowledged: true,
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../../hooks/useCapabilities.ts', () => ({
  useCapabilities: () => ({
    capabilities: ['AI_AGENT_READ', 'AI_AGENT_EXECUTE_SAFE'],
    role: 'admin',
    loading: false,
    has: (cap: string) =>
      ['AI_AGENT_READ', 'AI_AGENT_EXECUTE_SAFE'].includes(cap),
  }),
}));

vi.mock('../../../../components/ai/TechnicalAnalysisAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="technical-agent-control">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/TrendAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="trend-agent-control">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/RiskManagementAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="risk-agent-control">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/SentimentAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="sentimentagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/PatternAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="patternagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/PricePredictionAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="pricepredictionagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/PortfolioAllocationAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="portfolioallocationagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/LiquidityAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="liquidityagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/OptimizationAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="optimizationagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/OrderManagementAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="ordermanagementagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/FundamentalAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="fundamentalagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/MarketIntelligenceAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="marketintelligenceagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/VolumeAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="volumeagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ai/TimingAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="timingagentcontrol">
      <h2>{agent.name} Control Panel</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../../components/ErrorBoundary', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

function mockProjection(agentKey: string, partial: Partial<AgentStatusProjection> = {}): AgentStatusProjection {
  return {
    agentKey,
    registered: true,
    configured: true,
    enabled: true,
    allowlisted: agentKey === 'arbitrage',
    scheduled: agentKey === 'arbitrage',
    running: false,
    healthy: true,
    dataReady: agentKey === 'arbitrage',
    consumerRegistered: agentKey === 'arbitrage',
    consumerEligible: agentKey === 'arbitrage',
    executionEligible: false,
    executionEligibleWhenLive: false,
    liveCapable: false,
    sideEffectClass: 'read_only',
    lastRunStatus: 'unknown',
    schedulerOwner: 'titan-engine-worker',
    ...partial,
  };
}

const mockAgents: AIAgent[] = [
  {
    id: '1',
    agent_key: 'technical',
    name: 'Artemis',
    role: 'Technical Analysis',
    status: 'active',
    statusProjection: mockProjection('technical', { allowlisted: false, scheduled: false, consumerEligible: false }),
    accuracy: 85.5,
    trainingProgress: 95.0,
    decisions: 1000,
    level: 'Expert',
    learningTime: 120,
    knowledgeSize: 45.2,
    capabilities: ['Chart Analysis', 'Pattern Recognition'],
    lastUpdate: '2024-01-07T12:00:00Z',
  },
  {
    id: '2',
    agent_key: 'trend',
    name: 'Trend Master',
    role: 'Trend Detection',
    status: 'training',
    statusProjection: mockProjection('trend', { running: true, allowlisted: false, scheduled: false, consumerEligible: false }),
    accuracy: 78.3,
    trainingProgress: 65.0,
    decisions: 500,
    level: 'Advanced',
    learningTime: 60,
    knowledgeSize: 32.1,
    capabilities: ['Trend Analysis', 'Reversal Detection'],
    lastUpdate: '2024-01-07T12:30:00Z',
  },
  {
    id: '3',
    agent_key: 'risk',
    name: 'Risk Guardian',
    role: 'Risk Management',
    status: 'inactive',
    statusProjection: mockProjection('risk', { enabled: false, allowlisted: false, scheduled: false, consumerEligible: false }),
    accuracy: 92.1,
    trainingProgress: 100.0,
    decisions: 2000,
    level: 'Advanced',
    learningTime: 200,
    knowledgeSize: 78.5,
    capabilities: ['Risk Assessment', 'Portfolio Protection'],
    lastUpdate: '2024-01-07T11:00:00Z',
  },
];

describe('AIAgents Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentLanguage = 'en';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders agent cards correctly', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByTestId('agents-loading-skeleton')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Artemis')).toBeInTheDocument();
      expect(screen.getByText('Technical Analysis')).toBeInTheDocument();
      expect(screen.getByText('Trend Master')).toBeInTheDocument();
      expect(screen.getByText('Risk Guardian')).toBeInTheDocument();

      expect(screen.getByText('85.5%')).toBeInTheDocument();
      expect(screen.getByText('78.3%')).toBeInTheDocument();
      expect(screen.getByText('92.1%')).toBeInTheDocument();
    });

    it('displays loading state initially', () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockImplementation(() => new Promise(() => {}));

      render(<AIAgents />);

      expect(screen.getByTestId('agents-loading-skeleton')).toBeInTheDocument();
      expect(screen.getByText('loading')).toBeInTheDocument();
    });

    it('renders canonical product status badges without misleading Active', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByTestId('agents-loading-skeleton')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('agent-status-technical')).toHaveTextContent('Limited');
      expect(screen.getByTestId('agent-status-trend')).toHaveTextContent('Running');
      expect(screen.getByTestId('agent-status-risk')).toHaveTextContent('Paused');
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });

    it('renders compact safety summary', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-safety-banner')).toBeInTheDocument();
      });

      expect(screen.getByTestId('emergency-stop-badge')).toBeInTheDocument();
      expect(screen.getByText('Agents run in Dry Run. Live side effects are blocked.')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('opens control panel when Open Agent is clicked', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByTestId('agents-loading-skeleton')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('agent-open-technical'));

      await waitFor(() => {
        expect(screen.getByTestId('technical-agent-control')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('closes control panel when close button is clicked', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByTestId('agents-loading-skeleton')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('agent-open-technical'));

      await waitFor(() => {
        expect(screen.getByTestId('technical-agent-control')).toBeInTheDocument();
      }, { timeout: 10000 });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('technical-agent-control')).not.toBeInTheDocument();
      });
    });

    it('opens correct control panel for trend agent', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByTestId('agents-loading-skeleton')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('agent-open-trend'));

      await waitFor(() => {
        expect(screen.getByTestId('trend-agent-control')).toBeInTheDocument();
        expect(screen.getByText('Trend Master Control Panel')).toBeInTheDocument();
      });
    });

    it('filters agents by search', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
      expect(screen.getByTestId('agents-grid')).toBeInTheDocument();
      expect(screen.getByTestId('agents-results-count')).toHaveTextContent('Showing 3 agents');
      });

      fireEvent.change(screen.getByTestId('agents-search'), {
        target: { value: 'Trend' },
      });

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
        expect(screen.queryByText('Artemis')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('agents-results-count')).toHaveTextContent('1 agent found');
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API fails', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockRejectedValue(new Error('Network error'));

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByTestId('agents-error')).toBeInTheDocument();
        expect(screen.getByText('Failed to load AI agents.')).toBeInTheDocument();
      });

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('retries fetching data when retry button is clicked', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockRejectedValueOnce(new Error('Network error'));
      mockFetchAIAgents.mockResolvedValueOnce(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load AI agents.')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.queryByText('Failed to load AI agents.')).not.toBeInTheDocument();
        expect(screen.getByText('Artemis')).toBeInTheDocument();
      });

      expect(mockFetchAIAgents).toHaveBeenCalledTimes(2);
    });

    it('handles empty agents array gracefully', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue([]);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByTestId('agents-empty')).toBeInTheDocument();
      });

      expect(screen.getByTestId('agents-empty')).toHaveTextContent('No agents found');
      expect(screen.queryByTestId('agents-clear-filters')).not.toBeInTheDocument();
    });
  });

  describe('Agent Metrics Display', () => {
    it('displays compact card metrics', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByTestId('agents-loading-skeleton')).not.toBeInTheDocument();
      });

      expect(screen.getByText('1,000')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
      expect(screen.getByText('2,000')).toBeInTheDocument();
      expect(screen.getAllByText('Open Agent').length).toBe(3);
    });
  });

  describe('Agents Shell i18n', () => {
    it('renders English full, filtered, one, zero, clear action, and no raw keys', async () => {
      vi.mocked(api.fetchAIAgents).mockResolvedValue(mockAgents);
      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('Showing 3 agents');
      });

      fireEvent.change(screen.getByTestId('agents-status-filter'), { target: { value: 'running' } });
      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('1 agent found');
      });

      fireEvent.change(screen.getByTestId('agents-status-filter'), { target: { value: 'all' } });
      fireEvent.change(screen.getByTestId('agents-search'), { target: { value: 'Risk' } });
      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('1 agent found');
      });

      fireEvent.change(screen.getByTestId('agents-search'), { target: { value: 'Analysis' } });
      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('Showing 2 of 3 agents');
      });

      fireEvent.change(screen.getByTestId('agents-search'), { target: { value: 'zzz-none' } });
      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('No agents found');
        expect(screen.getByTestId('agents-empty')).toHaveTextContent('Try a different search term or adjust the filters.');
      });

      const clearButton = screen.getByTestId('agents-clear-filters');
      expect(clearButton).toHaveAccessibleName('Clear filters');
      clearButton.focus();
      expect(clearButton).toHaveFocus();
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('Showing 3 agents');
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
      });

      expect((screen.getByTestId('agents-status-filter') as HTMLSelectElement).value).toBe('all');
      expect((screen.getByTestId('agents-sort') as HTMLSelectElement).value).toBe('name');
      expect(screen.queryByText('showing_results')).not.toBeInTheDocument();
      expect(screen.queryByText('try_different_search')).not.toBeInTheDocument();
      expect(screen.queryByText('clear_filters')).not.toBeInTheDocument();
      expect(screen.queryAllByText(/^agent_state_|^execution_kind_|^undefined$|^null$/)).toHaveLength(0);
    });

    it('renders Persian full, filtered, one, zero, clear action, and no raw keys', async () => {
      currentLanguage = 'fa';
      vi.mocked(api.fetchAIAgents).mockResolvedValue(mockAgents);
      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('نمایش 3 عامل');
      });

      fireEvent.change(screen.getByTestId('agents-status-filter'), { target: { value: 'running' } });
      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('۱ عامل پیدا شد');
      });

      fireEvent.change(screen.getByTestId('agents-status-filter'), { target: { value: 'all' } });
      fireEvent.change(screen.getByTestId('agents-search'), { target: { value: 'Analysis' } });
      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('نمایش 2 عامل از 3 عامل');
      });

      fireEvent.change(screen.getByTestId('agents-search'), { target: { value: 'zzz-none' } });
      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('هیچ عاملی پیدا نشد');
        expect(screen.getByTestId('agents-empty')).toHaveTextContent('عبارت دیگری را جست‌وجو کنید یا فیلترها را تغییر دهید.');
      });

      const clearButton = screen.getByTestId('agents-clear-filters');
      expect(clearButton).toHaveAccessibleName('پاک کردن فیلترها');
      fireEvent.keyDown(clearButton, { key: 'Enter' });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('نمایش 3 عامل');
      });

      expect(screen.queryByText('showing_results')).not.toBeInTheDocument();
      expect(screen.queryByText('try_different_search')).not.toBeInTheDocument();
      expect(screen.queryByText('clear_filters')).not.toBeInTheDocument();
    });
  });

  describe('Canonical status projection (15 agents)', () => {
    const CANONICAL_KEYS = [
      'technical', 'risk', 'sentiment', 'pattern', 'price_prediction', 'arbitrage',
      'portfolio', 'liquidity', 'trend', 'optimization', 'order', 'fundamental',
      'market_intelligence', 'volume', 'timing',
    ] as const;

    function buildCanonicalAgents(): AIAgent[] {
      return CANONICAL_KEYS.map((key, index) => ({
        id: String(index + 1),
        agent_key: key,
        name: key.replace(/_/g, ' '),
        role: key.replace(/_/g, ' '),
        status: 'active',
        accuracy: 80,
        trainingProgress: 50,
        decisions: 10,
        level: 'Advanced',
        learningTime: 1,
        knowledgeSize: 1,
        capabilities: [],
        lastUpdate: '2024-01-07T12:00:00Z',
        statusProjection: mockProjection(key, {
          allowlisted: key === 'arbitrage',
          scheduled: key === 'arbitrage',
          consumerRegistered: key === 'arbitrage',
          consumerEligible: key === 'arbitrage',
          dataReady: key === 'arbitrage' ? false : false,
          lastRunStatus: key === 'arbitrage' ? 'never' : 'unknown',
        }),
      }));
    }

    it('projects 15 canonical agents with Arbitrage scheduled and others not scheduled', async () => {
      vi.mocked(api.fetchAIAgents).mockResolvedValue(buildCanonicalAgents());
      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByTestId('agents-results-count')).toHaveTextContent('Showing 15 agents');
      });

      expect(screen.getByTestId('agent-card-arbitrage')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-arbitrage')).toHaveTextContent('Scheduled');
      expect(screen.getAllByText('Limited').length).toBe(13);
      expect(screen.getByTestId('agent-status-order')).toHaveTextContent('Blocked');
      expect(screen.queryByText('Allowlisted')).not.toBeInTheDocument();
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });

    it('fail-closed unknown agent shows Unavailable, not Active', async () => {
      vi.mocked(api.fetchAIAgents).mockResolvedValue([
        {
          id: '99',
          agent_key: 'unknown_agent_xyz',
          name: 'Unknown',
          role: 'Unknown',
          status: 'active',
          accuracy: null,
          trainingProgress: null,
          decisions: 0,
          level: 'N/A',
          learningTime: 0,
          knowledgeSize: 0,
          capabilities: [],
          lastUpdate: null,
          statusProjection: mockProjection('unknown_agent_xyz', {
            registered: false,
            configured: false,
            enabled: false,
            allowlisted: false,
            scheduled: false,
            consumerEligible: false,
          }),
        },
      ]);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByText('Unavailable')).toBeInTheDocument();
      });
      expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();
    });

    it('opens Arbitrage detail navigation from list', async () => {
      vi.mocked(api.fetchAIAgents).mockResolvedValue(buildCanonicalAgents());
      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-open-arbitrage')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('agent-open-arbitrage'));

      await waitFor(() => {
        const workspace = screen.queryByTestId('arb-workspace');
        const dialog = screen.queryByTestId('agent-product-dialog');
        expect(workspace || dialog).toBeTruthy();
      });
    });
  });
});
