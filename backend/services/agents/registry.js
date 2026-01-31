// Agent Registry - Central dispatcher for all 15 AI Agents
// Purpose: Load and route agent modules by agent_key
// Date: 2026-01-03
// Updated: 2026-01-31 - Added health check functionality (BACKEND-015)

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../../services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Agent Registry Map
const agents = new Map();

// BACKEND-015: Agent health status tracking
const agentHealth = new Map();

// BACKEND-015: Health check interval (default: 60 seconds)
const HEALTH_CHECK_INTERVAL = parseInt(process.env.AGENT_HEALTH_CHECK_INTERVAL) || 60000;
let healthCheckTimer = null;

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
  const optionalMethods = ['command', 'validateConfig', 'healthCheck']; // BACKEND-015: healthCheck is optional
  
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

// ============================================================================
// BACKEND-015: Health Check Implementation
// ============================================================================

/**
 * Perform health check on a single agent
 * @param {string} agent_key - Agent identifier
 * @returns {Promise<Object>} Health check result
 */
export async function checkAgentHealth(agent_key) {
  const healthStatus = {
    agent_key,
    status: 'unknown',
    timestamp: new Date().toISOString(),
    responseTime: 0,
    error: null,
    metadata: {}
  };
  
  try {
    const agent = await getAgentService(agent_key);
    const startTime = Date.now();
    
    // Call agent's healthCheck method if it exists
    if (typeof agent.healthCheck === 'function') {
      const result = await agent.healthCheck();
      healthStatus.responseTime = Date.now() - startTime;
      
      if (result && result.status) {
        healthStatus.status = result.status; // 'healthy', 'degraded', 'unhealthy'
        healthStatus.metadata = result.metadata || {};
      } else {
        healthStatus.status = 'healthy'; // Default if no status returned
      }
    } else {
      // If agent doesn't implement healthCheck, consider it healthy if it loaded
      healthStatus.status = 'healthy';
      healthStatus.responseTime = Date.now() - startTime;
      healthStatus.metadata = { message: 'No healthCheck method, assuming healthy' };
    }
  } catch (error) {
    healthStatus.status = 'unhealthy';
    healthStatus.error = error.message;
    logger.warn(`❌ Health check failed for ${agent_key}:`, error.message);
  }
  
  // Store health status
  agentHealth.set(agent_key, healthStatus);
  
  return healthStatus;
}

/**
 * Perform health check on all loaded agents
 * @returns {Promise<Object>} Health check results for all agents
 */
export async function checkAllAgentsHealth() {
  const results = {};
  const loadedAgents = Array.from(agents.keys());
  
  logger.info(`🏥 Running health checks for ${loadedAgents.length} loaded agent(s)...`);
  
  for (const agent_key of loadedAgents) {
    results[agent_key] = await checkAgentHealth(agent_key);
  }
  
  return results;
}

/**
 * Get health status for a specific agent
 * @param {string} agent_key - Agent identifier
 * @returns {Object|null} Cached health status or null if not checked yet
 */
export function getAgentHealthStatus(agent_key) {
  return agentHealth.get(agent_key) || null;
}

/**
 * Get health status for all agents
 * @returns {Object} All agent health statuses
 */
export function getAllAgentHealthStatus() {
  const status = {};
  
  for (const [agent_key, health] of agentHealth.entries()) {
    status[agent_key] = health;
  }
  
  return status;
}

/**
 * Check if an agent is healthy
 * @param {string} agent_key - Agent identifier
 * @returns {boolean} True if agent is healthy
 */
export function isAgentHealthy(agent_key) {
  const health = agentHealth.get(agent_key);
  return !!(health && health.status === 'healthy');
}

/**
 * Get count of healthy vs unhealthy agents
 * @returns {Object} Health summary
 */
export function getHealthSummary() {
  let healthy = 0;
  let degraded = 0;
  let unhealthy = 0;
  let unknown = 0;
  
  for (const health of agentHealth.values()) {
    switch (health.status) {
      case 'healthy':
        healthy++;
        break;
      case 'degraded':
        degraded++;
        break;
      case 'unhealthy':
        unhealthy++;
        break;
      default:
        unknown++;
    }
  }
  
  return {
    total: agentHealth.size,
    healthy,
    degraded,
    unhealthy,
    unknown,
    healthyPercentage: agentHealth.size > 0 ? Math.round((healthy / agentHealth.size) * 100) : 0
  };
}

/**
 * Start periodic health checks
 * @param {number} interval - Check interval in milliseconds (default: 60000)
 */
export function startPeriodicHealthChecks(interval = HEALTH_CHECK_INTERVAL) {
  if (healthCheckTimer) {
    logger.warn('⚠️  Periodic health checks already running');
    return;
  }
  
  logger.info(`🏥 Starting periodic health checks (interval: ${interval}ms)`);
  
  // Run initial health check
  checkAllAgentsHealth().catch(error => {
    logger.error('❌ Initial health check failed:', error);
  });
  
  // Set up periodic checks
  healthCheckTimer = setInterval(async () => {
    try {
      await checkAllAgentsHealth();
    } catch (error) {
      logger.error('❌ Periodic health check failed:', error);
    }
  }, interval);
  
  // Ensure timer doesn't keep process alive
  if (healthCheckTimer.unref) {
    healthCheckTimer.unref();
  }
}

/**
 * Stop periodic health checks
 */
export function stopPeriodicHealthChecks() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
    logger.info('🛑 Stopped periodic health checks');
  }
}

/**
 * Mark an agent as disabled due to health issues
 * @param {string} agent_key - Agent identifier
 * @param {string} reason - Reason for disabling
 */
export function disableUnhealthyAgent(agent_key, reason = 'Health check failed') {
  const health = agentHealth.get(agent_key);
  
  if (health && health.status === 'unhealthy') {
    // Update health status to reflect disabled state
    health.disabled = true;
    health.disabledReason = reason;
    health.disabledAt = new Date().toISOString();
    agentHealth.set(agent_key, health);
    
    logger.warn(`⚠️  Disabled unhealthy agent: ${agent_key} - ${reason}`);
  }
}

/**
 * Re-enable a previously disabled agent
 * @param {string} agent_key - Agent identifier
 */
export function enableAgent(agent_key) {
  const health = agentHealth.get(agent_key);
  
  if (health && health.disabled) {
    health.disabled = false;
    health.disabledReason = null;
    health.disabledAt = null;
    agentHealth.set(agent_key, health);
    
    logger.info(`✅ Re-enabled agent: ${agent_key}`);
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
  prewarmAgents,
  // BACKEND-015: Health check exports
  checkAgentHealth,
  checkAllAgentsHealth,
  getAgentHealthStatus,
  getAllAgentHealthStatus,
  isAgentHealthy,
  getHealthSummary,
  startPeriodicHealthChecks,
  stopPeriodicHealthChecks,
  disableUnhealthyAgent,
  enableAgent
};
