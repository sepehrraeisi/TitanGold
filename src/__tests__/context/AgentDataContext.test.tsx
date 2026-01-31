/**
 * Unit Tests for AgentDataContext (FRONTEND-004)
 * 
 * Tests that the context:
 * - Provides agents, configs, and metrics correctly
 * - Fetches data on mount
 * - Handles updates and refetches
 * - Provides utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { AgentDataProvider, useAgentData, useAgent } from '../../../context/AgentDataContext.tsx';
import * as api from '../../../services/api.ts';

// Mock the API module
vi.mock('../../../services/api.ts', () => ({
  fetchAIAgents: vi.fn(),
  fetchTechnicalAnalysisAgentData: vi.fn(),
  fetchRiskManagementAgentData: vi.fn(),
  fetchSentimentAgentData: vi.fn(),
  fetchFundamentalAgentData: vi.fn(),
  fetchLiquidityAgentData: vi.fn(),
}));

describe('AgentDataContext', () => {
  // Mock data
  const mockAgents = [
    {
      id: '1',
      agent_key: 'technical',
      name: 'Technical Analysis Agent',
      role: 'Market Analyzer',
      status: 'active',
      accuracy: 85.5,
      trainingProgress: 95.0,
      learningTime: 1200,
      knowledgeSize: 45.2,
      decisions: 1523,
      level: 'Expert',
      capabilities: ['RSI', 'MACD', 'EMA'],
      lastUpdate: '2026-01-31T10:00:00Z',
    },
    {
      id: '2',
      agent_key: 'risk',
      name: 'Risk Management Agent',
      role: 'Risk Analyzer',
      status: 'active',
      accuracy: 90.2,
      trainingProgress: 98.0,
      learningTime: 1500,
      knowledgeSize: 52.1,
      decisions: 2100,
      level: 'Expert',
      capabilities: ['VaR', 'Drawdown', 'Volatility'],
      lastUpdate: '2026-01-31T10:00:00Z',
    },
  ];

  const mockTechnicalConfig = {
    enabledIndicators: ['RSI', 'MACD'],
    timeframes: ['1h', '4h'],
  };

  const mockTechnicalData = {
    config: mockTechnicalConfig,
    performance: {
      totalTrades: 100,
      winRate: 65.5,
      profitFactor: 1.8,
    },
    lastAnalysis: {
      symbol: 'BTC/USD',
      signal: 'buy',
      confidence: 0.85,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (api.fetchAIAgents as any).mockResolvedValue(mockAgents);
    (api.fetchTechnicalAnalysisAgentData as any).mockResolvedValue(mockTechnicalData);
    (api.fetchRiskManagementAgentData as any).mockResolvedValue({
      config: { maxDrawdown: 10 },
      performance: { riskScore: 7.5 },
      lastAnalysis: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AgentDataProvider', () => {
    it('should provide initial empty state before fetching', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={false}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      expect(result.current.agents).toEqual([]);
      expect(result.current.configs.size).toBe(0);
      expect(result.current.metrics.size).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should fetch data on mount when autoFetchOnMount is true', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have fetched agents
      expect(api.fetchAIAgents).toHaveBeenCalledTimes(1);
      expect(result.current.agents).toEqual(mockAgents);
      expect(result.current.agents.length).toBe(2);
    });

    it('should fetch configs and metrics for each agent', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have fetched agent-specific data
      expect(api.fetchTechnicalAnalysisAgentData).toHaveBeenCalledWith('1');
      expect(api.fetchRiskManagementAgentData).toHaveBeenCalledWith('2');

      // Should have configs
      expect(result.current.configs.size).toBeGreaterThan(0);
      const techConfig = result.current.configs.get('1');
      expect(techConfig).toEqual(mockTechnicalConfig);

      // Should have metrics
      expect(result.current.metrics.size).toBeGreaterThan(0);
      const techMetrics = result.current.metrics.get('1');
      expect(techMetrics?.agentId).toBe('1');
      expect(techMetrics?.performance).toBeDefined();
    });

    it('should handle fetch errors gracefully', async () => {
      (api.fetchAIAgents as any).mockRejectedValue(new Error('Network error'));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.agents).toEqual([]);
    });

    it('should handle partial agent data fetch failures', async () => {
      // One agent succeeds, one fails
      (api.fetchTechnicalAnalysisAgentData as any).mockResolvedValue(mockTechnicalData);
      (api.fetchRiskManagementAgentData as any).mockRejectedValue(new Error('Failed to fetch'));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still have agents list
      expect(result.current.agents.length).toBe(2);
      
      // Should have config for agent 1 (succeeded)
      expect(result.current.configs.get('1')).toBeDefined();
      
      // Agent 2 config might not exist (failed), but shouldn't crash
      expect(result.current.error).toBe(null); // Overall fetch succeeded
    });
  });

  describe('Context Actions', () => {
    it('should refetch all data', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear mock call history
      vi.clearAllMocks();

      // Refetch
      await act(async () => {
        await result.current.refetchAll();
      });

      expect(api.fetchAIAgents).toHaveBeenCalledTimes(1);
      expect(result.current.isRefreshing).toBe(false);
    });

    it('should refetch single agent data', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.clearAllMocks();

      // Refetch agent 1
      await act(async () => {
        await result.current.refetchAgent('1');
      });

      expect(api.fetchTechnicalAnalysisAgentData).toHaveBeenCalledWith('1');
      expect(api.fetchAIAgents).toHaveBeenCalledTimes(1); // Refresh agent list
    });

    it('should update agent config optimistically', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newConfig = { enabledIndicators: ['RSI', 'MACD', 'EMA'] };

      act(() => {
        result.current.updateAgentConfig('1', newConfig);
      });

      expect(result.current.configs.get('1')).toEqual(newConfig);
    });

    it('should update agent metrics optimistically', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newMetrics = {
        performance: { totalTrades: 200, winRate: 70 },
      };

      act(() => {
        result.current.updateAgentMetrics('1', newMetrics);
      });

      const updatedMetrics = result.current.metrics.get('1');
      expect(updatedMetrics?.performance).toEqual(newMetrics.performance);
      expect(updatedMetrics?.lastUpdated).toBeDefined();
    });

    it('should update agent in list', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const updatedAgent = {
        ...mockAgents[0],
        accuracy: 90.0,
        status: 'training' as const,
      };

      act(() => {
        result.current.updateAgent(updatedAgent);
      });

      const agent = result.current.getAgent('1');
      expect(agent?.accuracy).toBe(90.0);
      expect(agent?.status).toBe('training');
    });
  });

  describe('Context Getters', () => {
    it('should get agent by ID', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const agent = result.current.getAgent('1');
      expect(agent).toBeDefined();
      expect(agent?.id).toBe('1');
      expect(agent?.name).toBe('Technical Analysis Agent');
    });

    it('should get agent config by ID', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const config = result.current.getAgentConfig('1');
      expect(config).toBeDefined();
      expect(config).toEqual(mockTechnicalConfig);
    });

    it('should get agent metrics by ID', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const metrics = result.current.getAgentMetrics('1');
      expect(metrics).toBeDefined();
      expect(metrics?.agentId).toBe('1');
      expect(metrics?.performance).toBeDefined();
    });

    it('should return undefined for non-existent agent', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const agent = result.current.getAgent('999');
      expect(agent).toBeUndefined();
    });
  });

  describe('useAgent hook', () => {
    it('should provide specific agent data', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgent('1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.agent).toBeDefined();
      expect(result.current.agent?.id).toBe('1');
      expect(result.current.config).toEqual(mockTechnicalConfig);
      expect(result.current.metrics).toBeDefined();
    });

    it('should provide refetch function for specific agent', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgent('1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.clearAllMocks();

      await act(async () => {
        await result.current.refetch();
      });

      expect(api.fetchTechnicalAnalysisAgentData).toHaveBeenCalledWith('1');
    });

    it('should provide update functions for specific agent', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgent('1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newConfig = { test: 'value' };
      act(() => {
        result.current.updateConfig(newConfig);
      });

      expect(result.current.config).toEqual(newConfig);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when useAgentData used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = console.error;
      console.error = vi.fn();

      expect(() => {
        renderHook(() => useAgentData());
      }).toThrow('useAgentData must be used within an AgentDataProvider');

      console.error = consoleError;
    });
  });

  describe('Last Fetch Time', () => {
    it('should track last fetch time', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AgentDataProvider autoFetchOnMount={true}>{children}</AgentDataProvider>
      );

      const { result } = renderHook(() => useAgentData(), { wrapper });

      expect(result.current.lastFetchTime).toBe(null);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastFetchTime).toBeInstanceOf(Date);
    });
  });
});
