// Agent Registry - Central dispatcher for all 15 AI Agents
// Purpose: Load and route agent modules by agent_key
// Date: 2026-01-03

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../../services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Agent Registry Map
const agents = new Map();

// Register all 15 agents
const AGENT_MODULES = {
  'technical': './technical.js',
  'risk': './risk.js',
  'sentiment': './sentiment.js',
  'pattern': './pattern.js',
  'price_prediction': './price_prediction.js',
  'arbitrage': './arbitrage.js',
  'portfolio': './portfolio.js',
  'liquidity': './liquidity.js',
  'trend': './trend.js',
  'optimization': './optimization.js',
  'order': './order.js',
  'fundamental': './fundamental.js',
  'market_intelligence': './market_intelligence.js',
  'volume': './volume.js',
  'timing': './timing.js'
};

/**
 * Get agent service by agent_key
 * @param {string} agent_key - Agent identifier (e.g., 'technical', 'risk')
 * @returns {Promise<Object>} Agent service module
 * @throws {Error} If agent not found or failed to load
 */
export async function getAgentService(agent_key) {
  // Check if already loaded
  if (agents.has(agent_key)) {
    return agents.get(agent_key);
  }
  
  // Check if agent exists in registry
  if (!AGENT_MODULES[agent_key]) {
    throw new Error(`Agent not found: ${agent_key}`);
  }
  
  try {
    // Dynamically import agent module
    const modulePath = AGENT_MODULES[agent_key];
    const agentModule = await import(modulePath);
    
    // Validate agent interface
    validateAgentInterface(agent_key, agentModule);
    
    // Cache loaded agent
    agents.set(agent_key, agentModule);
    
    logger.info(`✅ Loaded agent: ${agent_key}`);
    return agentModule;
  } catch (error) {
    logger.error(`❌ Failed to load agent ${agent_key}:`, error.message);
    throw new Error(`Failed to load agent ${agent_key}: ${error.message}`);
  }
}

/**
 * Validate agent interface
 * Ensures agent module implements required methods
 * @param {string} agent_key - Agent identifier
 * @param {Object} agentModule - Loaded agent module
 * @throws {Error} If interface is invalid
 */
function validateAgentInterface(agent_key, agentModule) {
  const requiredMethods = ['run', 'getDetails', 'defaultConfig'];
  const optionalMethods = ['command', 'validateConfig'];
  
  // Check required methods
  for (const method of requiredMethods) {
    if (typeof agentModule[method] !== 'function') {
      throw new Error(`Agent ${agent_key} missing required method: ${method}`);
    }
  }
  
  logger.info(`✅ Validated agent interface: ${agent_key}`);
}

/**
 * Run agent by agent_key
 * @param {string} agent_key - Agent identifier
 * @param {Object} params - Agent-specific parameters
 * @returns {Promise<Object>} Agent execution result
 */
export async function runAgent(agent_key, params) {
  const agent = await getAgentService(agent_key);
  return await agent.run(params);
}

/**
 * Get agent details by agent_key
 * @param {string} agent_key - Agent identifier
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Agent details
 */
export async function getAgentDetails(agent_key, params) {
  const agent = await getAgentService(agent_key);
  return await agent.getDetails(params);
}

/**
 * Execute agent command
 * @param {string} agent_key - Agent identifier
 * @param {string} command - Command name
 * @param {Object} payload - Command payload
 * @returns {Promise<Object>} Command result
 */
export async function executeAgentCommand(agent_key, command, payload) {
  const agent = await getAgentService(agent_key);
  
  if (typeof agent.command !== 'function') {
    throw new Error(`Agent ${agent_key} does not support commands`);
  }
  
  return await agent.command({ command, payload });
}

/**
 * Get agent default config
 * @param {string} agent_key - Agent identifier
 * @returns {Promise<Object>} Default configuration
 */
export async function getAgentDefaultConfig(agent_key) {
  const agent = await getAgentService(agent_key);
  return await agent.defaultConfig();
}

/**
 * List all registered agent keys
 * @returns {string[]} Array of agent keys
 */
export function listAgentKeys() {
  return Object.keys(AGENT_MODULES);
}

/**
 * Check if agent exists
 * @param {string} agent_key - Agent identifier
 * @returns {boolean} True if agent exists
 */
export function hasAgent(agent_key) {
  return AGENT_MODULES.hasOwnProperty(agent_key);
}

// Pre-warm critical agents (optional)
export async function prewarmAgents(keys = ['technical', 'risk']) {
  logger.info(`🔥 Pre-warming agents: ${keys.join(', ')}`);
  
  for (const key of keys) {
    try {
      await getAgentService(key);
    } catch (error) {
      logger.warn(`⚠️  Failed to pre-warm ${key}:`, error.message);
    }
  }
}

// Export default object for convenience
export default {
  getAgentService,
  runAgent,
  getAgentDetails,
  executeAgentCommand,
  getAgentDefaultConfig,
  listAgentKeys,
  hasAgent,
  prewarmAgents
};
