import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIAgents from '../../../../components/ai/AIAgents';
import * as api from '../../../../services/api';
import type { AIAgent } from '../../../../types';

vi.mock('../../../../services/api', () => ({
  fetchAIAgents: vi.fn(),
  runTrendDetectionAnalysis: vi.fn(),
  sendAgentControlCommand: vi.fn(),
}));

vi.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
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

vi.mock('../../../../components/ai/ArbitrageAgentControl', () => ({
  default: ({ agent, onClose }: any) => (
    <div data-testid="arbitrageagentcontrol">
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

const mockAgents: AIAgent[] = [
  {
    id: '1',
    agent_key: 'technical',
    name: 'Artemis',
    role: 'Technical Analysis',
    status: 'active',
    accuracy: 85.5,
    trainingProgress: 95.0,
    decisions: 1000,
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
    accuracy: 78.3,
    trainingProgress: 65.0,
    decisions: 500,
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
    accuracy: 92.1,
    trainingProgress: 100.0,
    decisions: 2000,
    learningTime: 200,
    knowledgeSize: 78.5,
    capabilities: ['Risk Assessment', 'Portfolio Protection'],
    lastUpdate: '2024-01-07T11:00:00Z',
  },
];

describe('AIAgents Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('renders mapped operational status badges', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByTestId('agents-loading-skeleton')).not.toBeInTheDocument();
      });

      expect(screen.getAllByText('agent_state_ready').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('agent_state_running').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('agent_state_paused').length).toBeGreaterThanOrEqual(1);
    });

    it('renders compact safety summary', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-safety-banner')).toBeInTheDocument();
      });

      expect(screen.getByTestId('emergency-stop-badge')).toBeInTheDocument();
      expect(screen.getByText('agents_dry_run_blocked_short')).toBeInTheDocument();
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
      });
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
      });

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
      });

      fireEvent.change(screen.getByTestId('agents-search'), {
        target: { value: 'Trend' },
      });

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
        expect(screen.queryByText('Artemis')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API fails', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockRejectedValue(new Error('Network error'));

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByTestId('agents-error')).toBeInTheDocument();
        expect(screen.getByText('failed_to_load_data')).toBeInTheDocument();
      });

      expect(screen.getByText('retry')).toBeInTheDocument();
    });

    it('retries fetching data when retry button is clicked', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockRejectedValueOnce(new Error('Network error'));
      mockFetchAIAgents.mockResolvedValueOnce(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByText('failed_to_load_data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('retry'));

      await waitFor(() => {
        expect(screen.queryByText('failed_to_load_data')).not.toBeInTheDocument();
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

      expect(screen.queryAllByText('open_agent').length).toBe(0);
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
      expect(screen.getAllByText('open_agent').length).toBe(3);
    });
  });
});
