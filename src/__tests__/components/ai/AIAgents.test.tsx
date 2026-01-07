import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIAgents from '../../../../components/ai/AIAgents';
import * as api from '../../../../services/api';
import type { AIAgent } from '../../../../types';

// Mock the API module
vi.mock('../../../../services/api', () => ({
  fetchAIAgents: vi.fn(),
  runTrendDetectionAnalysis: vi.fn(),
  sendAgentControlCommand: vi.fn(),
}));

// Mock LanguageContext
vi.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

// Mock all agent control components
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

// Mock other agent controls
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

// Mock ErrorBoundary
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
    it('renders agent panels correctly', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });

      // Check if all agent cards are rendered
      expect(screen.getByText(/Artemis: Technical Analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/Trend Master: Trend Detection/i)).toBeInTheDocument();
      expect(screen.getByText(/Risk Guardian: Risk Management/i)).toBeInTheDocument();

      // Check accuracy display
      expect(screen.getByText('85.5%')).toBeInTheDocument();
      expect(screen.getByText('78.3%')).toBeInTheDocument();
      expect(screen.getByText('92.1%')).toBeInTheDocument();
    });

    it('displays loading state initially', () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<AIAgents />);

      expect(screen.getByText('loading')).toBeInTheDocument();
    });

    it('renders agent status correctly', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });

      // Check status badges
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('training')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });

    it('renders agent capabilities', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });

      // Check capabilities
      expect(screen.getByText('Chart Analysis')).toBeInTheDocument();
      expect(screen.getByText('Pattern Recognition')).toBeInTheDocument();
      expect(screen.getByText('Trend Analysis')).toBeInTheDocument();
      expect(screen.getByText('Risk Assessment')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('opens control panel when button is clicked', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });

      // Find and click the first control panel button
      const controlPanelButtons = screen.getAllByText('control_panel');
      fireEvent.click(controlPanelButtons[0]);

      // Check if control panel is opened
      await waitFor(() => {
        expect(screen.getByTestId('technical-agent-control')).toBeInTheDocument();
      });
    });

    it('closes control panel when close button is clicked', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });

      // Open control panel
      const controlPanelButtons = screen.getAllByText('control_panel');
      fireEvent.click(controlPanelButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('technical-agent-control')).toBeInTheDocument();
      });

      // Close control panel
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('technical-agent-control')).not.toBeInTheDocument();
      });
    });

    it('opens correct control panel for trend agent', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });

      // Open trend agent control panel (second button)
      const controlPanelButtons = screen.getAllByText('control_panel');
      fireEvent.click(controlPanelButtons[1]);

      await waitFor(() => {
        expect(screen.getByTestId('trend-agent-control')).toBeInTheDocument();
        expect(screen.getByText('Trend Master Control Panel')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API fails', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockRejectedValue(new Error('Network error'));

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.getByText('failed_to_load_data')).toBeInTheDocument();
      });

      // Check retry button is present
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

      // Click retry button
      const retryButton = screen.getByText('retry');
      fireEvent.click(retryButton);

      // Wait for successful load
      await waitFor(() => {
        expect(screen.queryByText('failed_to_load_data')).not.toBeInTheDocument();
        expect(screen.getByText(/Artemis: Technical Analysis/i)).toBeInTheDocument();
      });

      expect(mockFetchAIAgents).toHaveBeenCalledTimes(2);
    });

    it('handles empty agents array gracefully', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue([]);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });

      // Should render empty grid without errors
      const controlPanelButtons = screen.queryAllByText('control_panel');
      expect(controlPanelButtons.length).toBe(0);
    });
  });

  describe('Agent Metrics Display', () => {
    it('displays all agent metrics correctly', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });

      // Check metrics for first agent
      expect(screen.getByText('1,000')).toBeInTheDocument(); // decisions
      expect(screen.getByText('120')).toBeInTheDocument(); // learning time
      expect(screen.getByText('45.2MB')).toBeInTheDocument(); // knowledge size
    });

    it('displays training progress bars', async () => {
      const mockFetchAIAgents = vi.mocked(api.fetchAIAgents);
      mockFetchAIAgents.mockResolvedValue(mockAgents);

      render(<AIAgents />);

      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });

      // Check training progress percentages
      expect(screen.getByText('95.0%')).toBeInTheDocument();
      expect(screen.getByText('65.0%')).toBeInTheDocument();
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });
  });
});
