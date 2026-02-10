// Agent Registry - Central dispatcher for all 15 AI Agents
// Purpose: Load and route agent modules by agent_key
// Date: 2026-01-03
// Updated: 2026-01-31 - Added health check functionality (BACKEND-015)
// Updated: 2026-01-31 - Added version tracking (BACKEND-017)

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../../services/logger.js';
import pool from '../../database/db.js';
import { startAgentExecution } from '../../middleware/agentMetrics.js';

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

  // Get agent_id from params or database
  let agent_id = params.agent_id;
  if (!agent_id) {
    // Try to get agent_id from database by agent_key
    try {
      const result = await pool.query('SELECT id FROM ai_agents WHERE agent_key = $1', [agent_key]);
      if (result.rows.length > 0) {
        agent_id = result.rows[0].id;
      } else {
        agent_id = 'unknown';
      }
    } catch (error) {
      agent_id = 'unknown';
    }
  }

  // Start tracking execution metrics (BACKEND-021)
  const endMetrics = startAgentExecution(agent_key, agent_id);

  try {
    const result = await agent.run(params);

    // Determine if result came from cache
    const cacheHit = !!(result && result._meta && result._meta.cached);

    // End metrics tracking - success
    endMetrics(true, null, cacheHit);

    return result;
  } catch (error) {
    // Determine error type
    const errorType = error.name === 'TimeoutError' ? 'timeout' :
      error.name === 'ValidationError' ? 'validation' :
        'internal';

    // End metrics tracking - failure
    endMetrics(false, errorType, false);

    // Re-throw error
    throw error;
  }
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

// ============================================================================
// BACKEND-017: Version Tracking Implementation
// ============================================================================

/**
 * Get current version of an agent from database
 * @param {string} agent_key - Agent identifier
 * @returns {Promise<string>} Current version
 */
export async function getAgentVersion(agent_key) {
  try {
    const result = await pool.query(
      'SELECT version FROM ai_agents WHERE agent_key = $1',
      [agent_key]
    );

    if (result.rows.length === 0) {
      throw new Error(`Agent not found: ${agent_key}`);
    }

    return result.rows[0].version;
  } catch (error) {
    logger.error(`❌ Failed to get agent version for ${agent_key}:`, error.message);
    throw error;
  }
}

/**
 * Bump agent version (increment patch version by default)
 * @param {string} agent_key - Agent identifier
 * @param {string} new_version - New semantic version (e.g., "1.2.3")
 * @param {string} change_description - Description of what changed
 * @param {string} changed_by - User ID or 'system'
 * @returns {Promise<Object>} Version update result
 */
export async function bumpAgentVersion(agent_key, new_version, change_description = 'Version bumped', changed_by = 'system') {
  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current version
      const currentResult = await client.query(
        'SELECT id, version FROM ai_agents WHERE agent_key = $1',
        [agent_key]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`Agent not found: ${agent_key}`);
      }

      const agent_id = currentResult.rows[0].id;
      const previous_version = currentResult.rows[0].version;

      // Update version (trigger will handle version_updated_at and history)
      await client.query(
        'UPDATE ai_agents SET version = $1 WHERE agent_key = $2',
        [new_version, agent_key]
      );

      await client.query('COMMIT');

      logger.info(`✅ Bumped agent ${agent_key} version: ${previous_version} → ${new_version}`);

      return {
        success: true,
        agent_key,
        previous_version,
        new_version,
        change_description,
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(`❌ Failed to bump agent version for ${agent_key}:`, error.message);
    throw error;
  }
}

/**
 * Automatically increment patch version (e.g., 1.0.0 → 1.0.1)
 * @param {string} agent_key - Agent identifier
 * @param {string} change_description - Description of what changed
 * @returns {Promise<Object>} Version update result
 */
export async function incrementAgentVersion(agent_key, change_description = 'Code updated') {
  try {
    const current_version = await getAgentVersion(agent_key);
    const [major, minor, patch] = current_version.split('.').map(Number);
    const new_version = `${major}.${minor}.${patch + 1}`;

    return await bumpAgentVersion(agent_key, new_version, change_description);
  } catch (error) {
    logger.error(`❌ Failed to increment agent version for ${agent_key}:`, error.message);
    throw error;
  }
}

/**
 * Get version history for an agent
 * @param {string} agent_key - Agent identifier
 * @param {number} limit - Maximum number of history entries to return
 * @returns {Promise<Array>} Version history
 */
export async function getAgentVersionHistory(agent_key, limit = 10) {
  try {
    const result = await pool.query(
      `SELECT 
        version, 
        previous_version, 
        change_type, 
        change_description, 
        changed_by, 
        created_at,
        metadata
      FROM ai_agent_version_history
      WHERE agent_key = $1
      ORDER BY created_at DESC
      LIMIT $2`,
      [agent_key, limit]
    );

    return result.rows;
  } catch (error) {
    logger.error(`❌ Failed to get version history for ${agent_key}:`, error.message);
    throw error;
  }
}

/**
 * Rollback agent to a previous version
 * @param {string} agent_key - Agent identifier
 * @param {string} target_version - Version to rollback to
 * @param {string} changed_by - User ID or 'system'
 * @returns {Promise<Object>} Rollback result
 */
export async function rollbackAgentVersion(agent_key, target_version, changed_by = 'system') {
  try {
    const result = await pool.query(
      'SELECT rollback_agent_version($1, $2, $3) as result',
      [agent_key, target_version, changed_by]
    );

    const rollbackResult = result.rows[0].result;

    if (rollbackResult.success) {
      logger.info(`✅ Rolled back agent ${agent_key} to version ${target_version}`);
    } else {
      logger.error(`❌ Rollback failed for ${agent_key}:`, rollbackResult.error);
    }

    return rollbackResult;
  } catch (error) {
    logger.error(`❌ Failed to rollback agent ${agent_key}:`, error.message);
    throw error;
  }
}

/**
 * Query decisions by agent version
 * @param {string} agent_key - Agent identifier
 * @param {string} version - Agent version
 * @param {number} limit - Maximum number of decisions to return
 * @returns {Promise<Array>} Decisions made by the specified agent version
 */
export async function getDecisionsByVersion(agent_key, version, limit = 100) {
  try {
    const result = await pool.query(
      'SELECT * FROM get_decisions_by_version($1, $2, $3)',
      [agent_key, version, limit]
    );

    return result.rows;
  } catch (error) {
    logger.error(`❌ Failed to get decisions for ${agent_key} v${version}:`, error.message);
    throw error;
  }
}

/**
 * Get version summary for all agents
 * @returns {Promise<Array>} Version summary for all agents
 */
export async function getAllAgentVersions() {
  try {
    const result = await pool.query(
      'SELECT * FROM agent_version_summary ORDER BY agent_key'
    );

    return result.rows;
  } catch (error) {
    logger.error('❌ Failed to get agent version summary:', error.message);
    throw error;
  }
}

/**
 * Store agent version when making a decision
 * This should be called by agents when they make decisions
 * @param {Object} decision - Decision object with agent_id
 * @returns {Promise<string>} Agent version used for this decision
 */
export async function recordDecisionVersion(decision) {
  try {
    // Get agent version from agent_id
    const result = await pool.query(
      'SELECT agent_key, version FROM ai_agents WHERE id = $1',
      [decision.agent_id]
    );

    if (result.rows.length === 0) {
      logger.warn(`⚠️  Agent not found for decision: ${decision.agent_id}`);
      return null;
    }

    const { agent_key, version } = result.rows[0];

    // Update the decision with agent_version
    if (decision.id) {
      await pool.query(
        'UPDATE ai_decisions SET agent_version = $1 WHERE id = $2',
        [version, decision.id]
      );
    }

    return version;
  } catch (error) {
    logger.error('❌ Failed to record decision version:', error.message);
    throw error;
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
  enableAgent,
  // BACKEND-017: Version tracking exports
  getAgentVersion,
  bumpAgentVersion,
  incrementAgentVersion,
  getAgentVersionHistory,
  rollbackAgentVersion,
  getDecisionsByVersion,
  getAllAgentVersions,
  recordDecisionVersion
};
