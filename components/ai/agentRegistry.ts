/**
 * Agent Registry with Lazy Loading (FRONTEND-003)
 * Updated with Agent Key Constants (FRONTEND-006)
 * 
 * This registry maps agent keys to their control panel components.
 * All components are lazy-loaded to reduce initial bundle size.
 * 
 * Benefits:
 * - Reduced initial bundle size by >30%
 * - Faster initial page load
 * - Components loaded on-demand when user opens control panel
 * - Automatic code-splitting by Vite
 * - Type-safe agent keys with autocomplete
 */

import { lazy, ComponentType } from 'react';
import { AIAgent } from '../../types.ts';
import type { OnNavigateHandler } from '../../types/navigation.ts';
import { AGENT_KEYS, AgentKeyType, toRegistryKey } from '../../constants/agentKeys';

// Define the component props interface
export interface AgentControlProps {
  agent: AIAgent;
  onClose: () => void;
  onUpdate: (agent: AIAgent) => void;
  onNavigate?: OnNavigateHandler;
}

// Define agent registry entry type
export interface AgentRegistryEntry {
  key: string;
  component: ComponentType<AgentControlProps>;
  fallbackTitle: string;
}

/**
 * Agent registry with lazy-loaded components
 * Each component is loaded only when needed
 * Uses type-safe agent key constants
 */
export const agentRegistry: Record<string, AgentRegistryEntry> = {
  [AGENT_KEYS.TECHNICAL]: {
    key: AGENT_KEYS.TECHNICAL,
    component: lazy(() => import('./TechnicalAnalysisAgentControl.tsx')),
    fallbackTitle: 'Technical Analysis Agent Error'
  },
  [AGENT_KEYS.RISK]: {
    key: AGENT_KEYS.RISK,
    component: lazy(() => import('./RiskManagementAgentControl.tsx')),
    fallbackTitle: 'Risk Management Agent Error'
  },
  [AGENT_KEYS.SENTIMENT]: {
    key: AGENT_KEYS.SENTIMENT,
    component: lazy(() => import('./SentimentAgentControl.tsx')),
    fallbackTitle: 'Sentiment Agent Error'
  },
  [AGENT_KEYS.PATTERN]: {
    key: AGENT_KEYS.PATTERN,
    component: lazy(() => import('./PatternAgentControl.tsx')),
    fallbackTitle: 'Pattern Agent Error'
  },
  [AGENT_KEYS.PRICE_PREDICTION]: {
    key: AGENT_KEYS.PRICE_PREDICTION,
    component: lazy(() => import('./PricePredictionAgentControl.tsx')),
    fallbackTitle: 'Price Prediction Agent Error'
  },
  [AGENT_KEYS.ARBITRAGE]: {
    key: AGENT_KEYS.ARBITRAGE,
    component: lazy(() => import('./ArbitrageAgentPopup.tsx')),
    fallbackTitle: 'Arbitrage Agent Error'
  },
  [AGENT_KEYS.PORTFOLIO]: {
    key: AGENT_KEYS.PORTFOLIO,
    component: lazy(() => import('./PortfolioAllocationAgentControl.tsx')),
    fallbackTitle: 'Portfolio Allocation Agent Error'
  },
  [AGENT_KEYS.LIQUIDITY]: {
    key: AGENT_KEYS.LIQUIDITY,
    component: lazy(() => import('./LiquidityAgentControl.tsx')),
    fallbackTitle: 'Liquidity Agent Error'
  },
  trend: {
    key: 'trend',
    component: lazy(() => import('./TrendAgentPopup.tsx')),
    fallbackTitle: 'Trend Agent Error'
  },
  [AGENT_KEYS.OPTIMIZATION]: {
    key: AGENT_KEYS.OPTIMIZATION,
    component: lazy(() => import('./OptimizationAgentControl.tsx')),
    fallbackTitle: 'Optimization Agent Error'
  },
  [AGENT_KEYS.ORDER]: {
    key: AGENT_KEYS.ORDER,
    component: lazy(() => import('./OrderManagementAgentControl.tsx')),
    fallbackTitle: 'Order Management Agent Error'
  },
  [AGENT_KEYS.FUNDAMENTAL]: {
    key: AGENT_KEYS.FUNDAMENTAL,
    component: lazy(() => import('./FundamentalAgentControl.tsx')),
    fallbackTitle: 'Fundamental Agent Error'
  },
  [AGENT_KEYS.MARKET_INTELLIGENCE]: {
    key: AGENT_KEYS.MARKET_INTELLIGENCE,
    component: lazy(() => import('./MarketIntelligenceAgentControl.tsx')),
    fallbackTitle: 'Market Intelligence Agent Error'
  },
  [AGENT_KEYS.VOLUME]: {
    key: AGENT_KEYS.VOLUME,
    component: lazy(() => import('./VolumeAgentControl.tsx')),
    fallbackTitle: 'Volume Agent Error'
  },
  [AGENT_KEYS.TIMING]: {
    key: AGENT_KEYS.TIMING,
    component: lazy(() => import('./TimingAgentControl.tsx')),
    fallbackTitle: 'Timing Agent Error'
  }
};

/**
 * Get agent control component by agent key
 * Handles mapping from backend agent_key to registry key
 * @param agentKey - The unique identifier for the agent
 * @returns Agent registry entry or undefined if not found
 */
export function getAgentControl(agentKey: string | undefined): AgentRegistryEntry | undefined {
  if (!agentKey) return undefined;
  const registryKey = toRegistryKey(agentKey);
  return agentRegistry[registryKey];
}

/**
 * Check if agent control exists for given key
 * @param agentKey - The unique identifier for the agent
 * @returns True if agent control exists
 */
export function hasAgentControl(agentKey: string): boolean {
  return agentKey in agentRegistry;
}

/**
 * Get all registered agent keys
 * @returns Array of all agent keys
 */
export function getRegisteredAgentKeys(): string[] {
  return Object.keys(agentRegistry);
}
