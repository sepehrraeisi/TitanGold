import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrendAgentControl from '../../../../components/ai/TrendAgentControl';
import * as api from '../../../../services/api';
import type { AIAgent, TrendDetectionConfig, TrendDetectionMetrics, TrendDetectionResult } from '../../../../types';

// Mock the API module
vi.mock('../../../../services/api', () => ({
  fetchTrendDetectionAgentData: vi.fn(),
  runTrendDetectionAnalysis: vi.fn(),
  updateTrendDetectionConfig: vi.fn(),
  sendAgentControlCommand: vi.fn(),
  fetchAIAgents: vi.fn(),
}));

// Mock LanguageContext
vi.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

const mockAgent: AIAgent = {
  id: '9',
  agent_key: 'trend',
  name: 'Trend Master',
  role: 'Trend Detection',
  status: 'active',
  accuracy: 85.5,
  trainingProgress: 95.0,
  decisions: 1000,
  learningTime: 120,
  knowledgeSize: 45.2,
  capabilities: ['Trend Analysis', 'Reversal Detection'],
  lastUpdate: '2024-01-07T12:00:00Z',
};

const mockConfig: TrendDetectionConfig = {
  symbols: ['BTC/USDT', 'ETH/USDT'],
  timeframes: ['1m', '5m', '15m', '1h'],
  methods: [
    { id: 'sma', enabled: true, weight: 1.0 },
    { id: 'ema', enabled: true, weight: 1.2 },
    { id: 'adx', enabled: true, weight: 0.8 },
  ],
  thresholds: {
    strongStrength: 70,
    weakStrength: 30,
    reversalSensitivity: 0.6,
  },
  alerts: {
    onTrendChange: true,
    onTrendReversal: true,
    onBreakout: true,
    onStrongTrend: true,
    onWeakTrend: false,
  },
  filters: {
    requireVolumeConfirmation: true,
    requireSentimentValidation: false,
  },
  integrationSettings: {
    shareWithArtemis: true,
    syncWithTechnical: true,
    syncWithPattern: true,
    syncWithSentiment: true,
    forwardToExecution: true,
  },
  alertChannels: {
    dashboard: true,
    email: false,
    messenger: false,
  },
};

const mockMetrics: TrendDetectionMetrics = {
  totalAnalyses: 500,
  averageConfidence: 82.5,
  averageStrength: 75.3,
  reversalsDetected: 12,
  breakoutsDetected: 8,
  history: [
    {
      symbol: 'BTC/USDT',
      timeframe: '1h',
      direction: 'bullish',
      strength: 78.5,
      timestamp: '2024-01-07T11:00:00Z',
      reversal: false,
      continuation: true,
    },
  ],
};

const mockAnalysis: TrendDetectionResult = {
  timestamp: '2024-01-07T12:00:00Z',
  signals: [
    {
      symbol: 'BTC/USDT',
      timeframe: '1h',
      direction: 'bullish',
      strength: 78.5,
      confidence: 85.0,
      slope: 0.0045,
      lastPrice: 45000,
      adx: 32.5,
      duration: 120,
      volumeConfirmed: true,
      sentimentValidated: true,
    },
  ],
  summary: {
    bullish: 3,
    bearish: 1,
    sideways: 2,
    strong: 2,
  },
  alerts: ['Strong bullish trend detected on BTC/USDT 1h', 'Reversal signal on ETH/USDT 5m'],
  trendMap: [
    {
      symbol: 'BTC/USDT',
      overallDirection: 'bullish',
      status: 'strong',
      timeframes: {
        '1h': { direction: 'bullish', strength: 78.5, confidence: 85.0 },
        '4h': { direction: 'bullish', strength: 82.3, confidence: 88.0 },
      },
    },
  ],
  alertDetails: [
    {
      id: 'alert-1',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      type: 'strong_trend',
      severity: 'info',
      message: 'Strong bullish trend detected',
      timestamp: '2024-01-07T12:00:00Z',
    },
  ],
  multiTimeframeComparison: {
    'BTC/USDT': {
      '1m': 'bullish',
      '5m': 'bullish',
      '15m': 'bullish',
      '1h': 'bullish',
    },
  },
};

describe('TrendAgentControl Component', () => {
  const mockOnClose = vi.fn();
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders agent control panel with agent name', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      expect(screen.getByText('Trend Detection')).toBeInTheDocument();
    });

    it('renders all tab navigation buttons', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      // Check for tab buttons
      expect(screen.getByText(/overview/i)).toBeInTheDocument();
      expect(screen.getByText(/trend map/i)).toBeInTheDocument();
      expect(screen.getByText(/history/i)).toBeInTheDocument();
      expect(screen.getByText(/indicators/i)).toBeInTheDocument();
      expect(screen.getAllByText(/alerts/i)[0]).toBeInTheDocument(); // Multiple "alerts" on page
      expect(screen.getByText(/settings/i)).toBeInTheDocument();
    });

    it('displays agent status correctly', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
      });

      expect(screen.getByText('85.5%')).toBeInTheDocument();
    });
  });

  describe('Tab Switching', () => {
    it('switches to trend map tab when clicked', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      // Click trend map tab
      const trendMapTab = screen.getByText(/trend map/i);
      fireEvent.click(trendMapTab);

      // Verify trend map content is displayed
      await waitFor(() => {
        expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
      });
    });

    it('switches to history tab correctly', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      // Click history tab
      const historyTab = screen.getByText(/history/i);
      fireEvent.click(historyTab);

      // Verify content switched
      await waitFor(() => {
        expect(screen.getByText('78.5%')).toBeInTheDocument();
      });
    });

    it('switches to settings tab correctly', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      // Click settings tab
      const settingsTab = screen.getByText(/settings/i);
      fireEvent.click(settingsTab);

      // Verify settings content is displayed
      await waitFor(() => {
        expect(screen.getByDisplayValue('BTC/USDT, ETH/USDT')).toBeInTheDocument();
      });
    });
  });

  describe('Run Analysis Button', () => {
    it('calls analysis API when run analysis button is clicked', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      const mockRunAnalysis = vi.mocked(api.runTrendDetectionAnalysis);
      const mockFetchAgents = vi.mocked(api.fetchAIAgents);

      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });
      mockRunAnalysis.mockResolvedValue(mockAnalysis);
      mockFetchAgents.mockResolvedValue([mockAgent]);

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      // Click run analysis button
      const runButton = screen.getByText('run_analysis');
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(mockRunAnalysis).toHaveBeenCalledWith(mockAgent.id);
      });
    });

    it('disables run analysis button when agent is inactive', async () => {
      const inactiveAgent = { ...mockAgent, status: 'inactive' as const };
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });

      render(<TrendAgentControl agent={inactiveAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      const runButton = screen.getByText('run_analysis');
      expect(runButton).toBeDisabled();
    });

    it('shows analyzing state during analysis', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      const mockRunAnalysis = vi.mocked(api.runTrendDetectionAnalysis);
      const mockFetchAgents = vi.mocked(api.fetchAIAgents);

      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });
      mockRunAnalysis.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockAnalysis), 1000)));
      mockFetchAgents.mockResolvedValue([mockAgent]);

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      // Click run analysis button
      const runButton = screen.getByText('run_analysis');
      fireEvent.click(runButton);

      // Check for analyzing state
      await waitFor(() => {
        expect(screen.getByText('analyzing')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully when loading data', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load trend agent data:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('handles analysis errors with alert', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      const mockRunAnalysis = vi.mocked(api.runTrendDetectionAnalysis);

      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });
      mockRunAnalysis.mockRejectedValue(new Error('Analysis failed'));

      // Mock window.alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      const runButton = screen.getByText('run_analysis');
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('analysis_failed');
      });

      alertSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('displays empty state when no analysis data is available', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: null,
      });

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('no_trend_data')).toBeInTheDocument();
      });
    });
  });

  describe('Control Commands', () => {
    it('sends pause command when pause button is clicked', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      const mockSendCommand = vi.mocked(api.sendAgentControlCommand);
      const mockFetchAgents = vi.mocked(api.fetchAIAgents);

      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });
      mockSendCommand.mockResolvedValue(undefined);
      mockFetchAgents.mockResolvedValue([mockAgent]);

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      // Click pause button
      const pauseButton = screen.getByText('pause');
      fireEvent.click(pauseButton);

      await waitFor(() => {
        expect(mockSendCommand).toHaveBeenCalledWith(mockAgent.id, 'pause');
      });
    });

    it('sends start command when agent is inactive', async () => {
      const inactiveAgent = { ...mockAgent, status: 'inactive' as const };
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      const mockSendCommand = vi.mocked(api.sendAgentControlCommand);
      const mockFetchAgents = vi.mocked(api.fetchAIAgents);

      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });
      mockSendCommand.mockResolvedValue(undefined);
      mockFetchAgents.mockResolvedValue([inactiveAgent]);

      render(<TrendAgentControl agent={inactiveAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      // Click start button
      const startButton = screen.getByText('start');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockSendCommand).toHaveBeenCalledWith(inactiveAgent.id, 'start');
      });
    });
  });

  describe('Close Button', () => {
    it('calls onClose when close button is clicked', async () => {
      const mockFetchData = vi.mocked(api.fetchTrendDetectionAgentData);
      mockFetchData.mockResolvedValue({
        config: mockConfig,
        metrics: mockMetrics,
        lastAnalysis: mockAnalysis,
      });

      render(<TrendAgentControl agent={mockAgent} onClose={mockOnClose} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Trend Master')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('close');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
