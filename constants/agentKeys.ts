/**
 * Agent Key Constants (FRONTEND-006)
 * 
 * Defines all agent keys as TypeScript constants for type safety and autocomplete.
 * These keys are used throughout the application to identify and route agent-specific logic.
 * 
 * Benefits:
 * - TypeScript autocomplete support
 * - Compile-time type checking
 * - Prevents typos in agent key strings
 * - Single source of truth for all agent identifiers
 * - Easy refactoring (rename in one place)
 */

/**
 * Agent Keys Enum
 * Use this for type-safe agent key references
 */
export enum AgentKey {
  TECHNICAL = 'technical',
  RISK = 'risk',
  SENTIMENT = 'sentiment',
  PATTERN = 'pattern',
  PRICE_PREDICTION = 'price_prediction',
  ARBITRAGE = 'arbitrage',
  PORTFOLIO = 'portfolio',
  LIQUIDITY = 'liquidity',
  TREND = 'trend_detection',
  OPTIMIZATION = 'optimization',
  ORDER = 'order',
  FUNDAMENTAL = 'fundamental',
  MARKET_INTELLIGENCE = 'market_intelligence',
  VOLUME = 'volume',
  TIMING = 'timing'
}

/**
 * Agent Keys as const object (alternative to enum)
 * Useful when you need the object itself (e.g., for iteration)
 */
export const AGENT_KEYS = {
  TECHNICAL: 'technical',
  RISK: 'risk',
  SENTIMENT: 'sentiment',
  PATTERN: 'pattern',
  PRICE_PREDICTION: 'price_prediction',
  ARBITRAGE: 'arbitrage',
  PORTFOLIO: 'portfolio',
  LIQUIDITY: 'liquidity',
  TREND: 'trend_detection',
  OPTIMIZATION: 'optimization',
  ORDER: 'order',
  FUNDAMENTAL: 'fundamental',
  MARKET_INTELLIGENCE: 'market_intelligence',
  VOLUME: 'volume',
  TIMING: 'timing'
} as const;

/**
 * Type for agent key values
 * Extracts the union type from AGENT_KEYS
 */
export type AgentKeyType = typeof AGENT_KEYS[keyof typeof AGENT_KEYS];

/**
 * Array of all agent keys (for iteration)
 */
export const ALL_AGENT_KEYS: readonly AgentKeyType[] = Object.values(AGENT_KEYS);

/**
 * Agent display names mapping
 * Maps agent keys to human-readable names
 */
export const AGENT_DISPLAY_NAMES: Record<AgentKeyType, string> = {
  [AGENT_KEYS.TECHNICAL]: 'Technical Analysis',
  [AGENT_KEYS.RISK]: 'Risk Management',
  [AGENT_KEYS.SENTIMENT]: 'Sentiment Analysis',
  [AGENT_KEYS.PATTERN]: 'Pattern Recognition',
  [AGENT_KEYS.PRICE_PREDICTION]: 'Price Prediction',
  [AGENT_KEYS.ARBITRAGE]: 'Arbitrage',
  [AGENT_KEYS.PORTFOLIO]: 'Portfolio Allocation',
  [AGENT_KEYS.LIQUIDITY]: 'Liquidity Analysis',
  [AGENT_KEYS.TREND]: 'Trend Detection',
  [AGENT_KEYS.OPTIMIZATION]: 'Optimization',
  [AGENT_KEYS.ORDER]: 'Order Management',
  [AGENT_KEYS.FUNDAMENTAL]: 'Fundamental Analysis',
  [AGENT_KEYS.MARKET_INTELLIGENCE]: 'Market Intelligence',
  [AGENT_KEYS.VOLUME]: 'Volume Analysis',
  [AGENT_KEYS.TIMING]: 'Timing'
};

/**
 * Check if a string is a valid agent key
 * @param key - The string to check
 * @returns True if the string is a valid agent key
 */
export function isValidAgentKey(key: string): key is AgentKeyType {
  return ALL_AGENT_KEYS.includes(key as AgentKeyType);
}

/**
 * Get display name for an agent key
 * @param key - The agent key
 * @returns Human-readable display name
 */
export function getAgentDisplayName(key: AgentKeyType): string {
  return AGENT_DISPLAY_NAMES[key] || key;
}

/**
 * Agent key to registry key mapping
 * Some agent keys differ between backend and frontend registry
 */
export const AGENT_KEY_TO_REGISTRY_KEY: Record<AgentKeyType, string> = {
  [AGENT_KEYS.TECHNICAL]: 'technical',
  [AGENT_KEYS.RISK]: 'risk',
  [AGENT_KEYS.SENTIMENT]: 'sentiment',
  [AGENT_KEYS.PATTERN]: 'pattern',
  [AGENT_KEYS.PRICE_PREDICTION]: 'price_prediction',
  [AGENT_KEYS.ARBITRAGE]: 'arbitrage',
  [AGENT_KEYS.PORTFOLIO]: 'portfolio',
  [AGENT_KEYS.LIQUIDITY]: 'liquidity',
  [AGENT_KEYS.TREND]: 'trend',
  [AGENT_KEYS.OPTIMIZATION]: 'optimization',
  [AGENT_KEYS.ORDER]: 'order',
  [AGENT_KEYS.FUNDAMENTAL]: 'fundamental',
  [AGENT_KEYS.MARKET_INTELLIGENCE]: 'market_intelligence',
  [AGENT_KEYS.VOLUME]: 'volume',
  [AGENT_KEYS.TIMING]: 'timing'
};

/**
 * Convert agent_key to registry key
 * Handles mapping between backend agent_key and frontend registry key
 * @param agentKey - The backend agent_key
 * @returns Registry key for component lookup
 */
export function toRegistryKey(agentKey: string): string {
  if (isValidAgentKey(agentKey)) {
    return AGENT_KEY_TO_REGISTRY_KEY[agentKey];
  }
  return agentKey;
}
