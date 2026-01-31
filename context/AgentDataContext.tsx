/**
 * Agent Data Context (FRONTEND-004)
 * 
 * Provides centralized state management for AI agent data, configs, and metrics.
 * Prevents duplicate fetching by sharing data across all agent control components.
 * 
 * Features:
 * - Single fetch on app load
 * - Automatic refetch on updates
 * - Loading and error states
 * - Optimistic updates
 * - Context-based data sharing
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as api from '../services/api.ts';
import type { AIAgent, AgentPerformanceMetrics } from '../types.ts';

// Agent configuration types (generic config that can be specialized per agent)
export interface AgentConfig {
  [key: string]: any;
}

// Agent metrics wrapper
export interface AgentMetrics {
  agentId: string;
  performance: AgentPerformanceMetrics | null;
  lastAnalysis: any | null; // Flexible type for different agent analysis types
  lastUpdated: string;
}

// Context state type
export interface AgentDataContextType {
  // Data
  agents: AIAgent[];
  configs: Map<string, AgentConfig>;
  metrics: Map<string, AgentMetrics>;
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  
  // Actions
  refetchAll: () => Promise<void>;
  refetchAgent: (agentId: string) => Promise<void>;
  updateAgentConfig: (agentId: string, config: AgentConfig) => void;
  updateAgentMetrics: (agentId: string, metrics: Partial<AgentMetrics>) => void;
  updateAgent: (agent: AIAgent) => void;
  
  // Getters
  getAgent: (agentId: string) => AIAgent | undefined;
  getAgentConfig: (agentId: string) => AgentConfig | undefined;
  getAgentMetrics: (agentId: string) => AgentMetrics | undefined;
  
  // Utility
  lastFetchTime: Date | null;
}

// Create context
const AgentDataContext = createContext<AgentDataContextType | undefined>(undefined);

// Provider props
export interface AgentDataProviderProps {
  children: ReactNode;
  autoFetchOnMount?: boolean;
  refetchInterval?: number; // Auto-refetch interval in ms (0 = disabled)
}

/**
 * Agent Data Provider Component
 * Wraps the app to provide centralized agent data
 */
export const AgentDataProvider: React.FC<AgentDataProviderProps> = ({
  children,
  autoFetchOnMount = true,
  refetchInterval = 0,
}) => {
  // State
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [configs, setConfigs] = useState<Map<string, AgentConfig>>(new Map());
  const [metrics, setMetrics] = useState<Map<string, AgentMetrics>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  /**
   * Fetch all agent data
   */
  const fetchAllData = useCallback(async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Fetch agents list
      const agentsData = await api.fetchAIAgents();
      setAgents(agentsData);

      // Fetch configs and metrics for each agent
      const newConfigs = new Map<string, AgentConfig>();
      const newMetrics = new Map<string, AgentMetrics>();

      // Fetch additional data for each agent in parallel
      await Promise.allSettled(
        agentsData.map(async (agent) => {
          try {
            // Fetch agent-specific data based on agent type
            const agentData = await fetchAgentSpecificData(agent);
            
            if (agentData.config) {
              newConfigs.set(agent.id, agentData.config);
            }
            
            if (agentData.performance || agentData.lastAnalysis) {
              newMetrics.set(agent.id, {
                agentId: agent.id,
                performance: agentData.performance || null,
                lastAnalysis: agentData.lastAnalysis || null,
                lastUpdated: new Date().toISOString(),
              });
            }
          } catch (err) {
            console.warn(`Failed to fetch data for agent ${agent.id}:`, err);
            // Continue with other agents even if one fails
          }
        })
      );

      setConfigs(newConfigs);
      setMetrics(newMetrics);
      setLastFetchTime(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch agent data';
      setError(errorMessage);
      console.error('Failed to fetch agent data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Fetch agent-specific data based on agent type
   */
  const fetchAgentSpecificData = async (agent: AIAgent): Promise<any> => {
    // Map agent types to their specific API calls
    const agentKey = agent.agent_key || '';
    
    try {
      switch (agentKey) {
        case 'technical':
          return await api.fetchTechnicalAnalysisAgentData(agent.id);
        case 'risk':
          return await api.fetchRiskManagementAgentData(agent.id);
        case 'sentiment':
          return await api.fetchSentimentAgentData(agent.id);
        case 'fundamental':
          return await api.fetchFundamentalAgentData(agent.id);
        case 'liquidity':
          return await api.fetchLiquidityAgentData(agent.id);
        // Add more cases as needed for other agent types
        default:
          // For agents without specific API endpoints, return empty data
          return { config: null, performance: null, lastAnalysis: null };
      }
    } catch (error) {
      // If specific API doesn't exist, fail gracefully
      console.warn(`No specific API for agent type: ${agentKey}`);
      return { config: null, performance: null, lastAnalysis: null };
    }
  };

  /**
   * Refetch all data
   */
  const refetchAll = useCallback(async () => {
    await fetchAllData(true);
  }, [fetchAllData]);

  /**
   * Refetch single agent data
   */
  const refetchAgent = useCallback(async (agentId: string) => {
    try {
      setIsRefreshing(true);
      
      // Find the agent
      const agent = agents.find(a => a.id === agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Fetch updated agent data
      const agentData = await fetchAgentSpecificData(agent);
      
      // Update configs
      if (agentData.config) {
        setConfigs(prev => {
          const updated = new Map(prev);
          updated.set(agentId, agentData.config);
          return updated;
        });
      }
      
      // Update metrics
      if (agentData.performance || agentData.lastAnalysis) {
        setMetrics(prev => {
          const updated = new Map(prev);
          updated.set(agentId, {
            agentId,
            performance: agentData.performance || null,
            lastAnalysis: agentData.lastAnalysis || null,
            lastUpdated: new Date().toISOString(),
          });
          return updated;
        });
      }

      // Refresh the agent in the list
      const updatedAgents = await api.fetchAIAgents();
      const updatedAgent = updatedAgents.find(a => a.id === agentId);
      if (updatedAgent) {
        setAgents(prev => prev.map(a => a.id === agentId ? updatedAgent : a));
      }
    } catch (err) {
      console.error(`Failed to refetch agent ${agentId}:`, err);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  }, [agents]);

  /**
   * Update agent config (optimistic update)
   */
  const updateAgentConfig = useCallback((agentId: string, config: AgentConfig) => {
    setConfigs(prev => {
      const updated = new Map(prev);
      updated.set(agentId, config);
      return updated;
    });
  }, []);

  /**
   * Update agent metrics (optimistic update)
   */
  const updateAgentMetrics = useCallback((agentId: string, metricsUpdate: Partial<AgentMetrics>) => {
    setMetrics(prev => {
      const updated = new Map(prev);
      const existing = prev.get(agentId);
      updated.set(agentId, {
        agentId,
        performance: metricsUpdate.performance ?? existing?.performance ?? null,
        lastAnalysis: metricsUpdate.lastAnalysis ?? existing?.lastAnalysis ?? null,
        lastUpdated: new Date().toISOString(),
      });
      return updated;
    });
  }, []);

  /**
   * Update agent in list (optimistic update)
   */
  const updateAgent = useCallback((agent: AIAgent) => {
    setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
  }, []);

  /**
   * Get agent by ID
   */
  const getAgent = useCallback((agentId: string) => {
    return agents.find(a => a.id === agentId);
  }, [agents]);

  /**
   * Get agent config by ID
   */
  const getAgentConfig = useCallback((agentId: string) => {
    return configs.get(agentId);
  }, [configs]);

  /**
   * Get agent metrics by ID
   */
  const getAgentMetrics = useCallback((agentId: string) => {
    return metrics.get(agentId);
  }, [metrics]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetchOnMount) {
      fetchAllData(false);
    }
  }, [autoFetchOnMount, fetchAllData]);

  // Auto-refetch interval
  useEffect(() => {
    if (refetchInterval > 0) {
      const interval = setInterval(() => {
        fetchAllData(true);
      }, refetchInterval);
      
      return () => clearInterval(interval);
    }
  }, [refetchInterval, fetchAllData]);

  // Context value
  const value: AgentDataContextType = {
    agents,
    configs,
    metrics,
    isLoading,
    isRefreshing,
    error,
    refetchAll,
    refetchAgent,
    updateAgentConfig,
    updateAgentMetrics,
    updateAgent,
    getAgent,
    getAgentConfig,
    getAgentMetrics,
    lastFetchTime,
  };

  return (
    <AgentDataContext.Provider value={value}>
      {children}
    </AgentDataContext.Provider>
  );
};

/**
 * Hook to use agent data context
 */
export const useAgentData = (): AgentDataContextType => {
  const context = useContext(AgentDataContext);
  if (!context) {
    throw new Error('useAgentData must be used within an AgentDataProvider');
  }
  return context;
};

/**
 * Hook to get specific agent data
 * Convenience hook for components that need a specific agent
 */
export const useAgent = (agentId: string) => {
  const context = useAgentData();
  
  return {
    agent: context.getAgent(agentId),
    config: context.getAgentConfig(agentId),
    metrics: context.getAgentMetrics(agentId),
    isLoading: context.isLoading,
    isRefreshing: context.isRefreshing,
    error: context.error,
    refetch: () => context.refetchAgent(agentId),
    updateConfig: (config: AgentConfig) => context.updateAgentConfig(agentId, config),
    updateMetrics: (metrics: Partial<AgentMetrics>) => context.updateAgentMetrics(agentId, metrics),
    updateAgent: context.updateAgent,
  };
};

export default AgentDataContext;
