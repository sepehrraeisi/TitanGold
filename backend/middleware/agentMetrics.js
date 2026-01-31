/**
 * Agent Performance Monitoring Middleware
 * Task: BACKEND-021
 * 
 * Tracks execution metrics for all AI agents:
 * - execution_time: Duration of agent runs
 * - error_rate: Percentage of failed executions
 * - cache_hit_rate: Cache effectiveness per agent
 * 
 * Integrates with Prometheus metrics (INFRA-006)
 */

import promClient from 'prom-client';
import { logger } from '../services/logger.js';
import { register } from './metrics.js';

// ============================================================================
// AGENT-SPECIFIC METRICS
// ============================================================================

/**
 * Agent Error Rate Counter
 * Tracks successful vs failed agent executions
 */
export const agentErrorCounter = new promClient.Counter({
  name: 'titangold_agent_errors_total',
  help: 'Total number of agent execution errors',
  labelNames: ['agent_key', 'agent_id', 'error_type'],
  registers: [register],
});

/**
 * Agent Success Counter
 * Tracks successful agent executions
 */
export const agentSuccessCounter = new promClient.Counter({
  name: 'titangold_agent_success_total',
  help: 'Total number of successful agent executions',
  labelNames: ['agent_key', 'agent_id'],
  registers: [register],
});

/**
 * Agent Cache Hit Counter
 * Tracks cache hits per agent
 */
export const agentCacheHitCounter = new promClient.Counter({
  name: 'titangold_agent_cache_hits_total',
  help: 'Total number of cache hits per agent',
  labelNames: ['agent_key', 'agent_id'],
  registers: [register],
});

/**
 * Agent Cache Miss Counter
 * Tracks cache misses per agent
 */
export const agentCacheMissCounter = new promClient.Counter({
  name: 'titangold_agent_cache_misses_total',
  help: 'Total number of cache misses per agent',
  labelNames: ['agent_key', 'agent_id'],
  registers: [register],
});

/**
 * Agent Cache Hit Rate Gauge
 * Tracks cache hit rate percentage per agent (0-100)
 */
export const agentCacheHitRateGauge = new promClient.Gauge({
  name: 'titangold_agent_cache_hit_rate_percent',
  help: 'Cache hit rate percentage per agent (0-100)',
  labelNames: ['agent_key', 'agent_id'],
  registers: [register],
});

/**
 * Agent Error Rate Gauge
 * Tracks error rate percentage per agent (0-100)
 */
export const agentErrorRateGauge = new promClient.Gauge({
  name: 'titangold_agent_error_rate_percent',
  help: 'Error rate percentage per agent (0-100)',
  labelNames: ['agent_key', 'agent_id'],
  registers: [register],
});

/**
 * Agent Execution Time Summary
 * Tracks detailed execution time statistics per agent
 * (quantiles: 50th, 90th, 95th, 99th percentiles)
 */
export const agentExecutionTimeSummary = new promClient.Summary({
  name: 'titangold_agent_execution_time_seconds',
  help: 'Agent execution time in seconds (summary with quantiles)',
  labelNames: ['agent_key', 'agent_id'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register],
});

/**
 * Agent Last Execution Time Gauge
 * Tracks the most recent execution time per agent
 */
export const agentLastExecutionTimeGauge = new promClient.Gauge({
  name: 'titangold_agent_last_execution_seconds',
  help: 'Most recent execution time for each agent in seconds',
  labelNames: ['agent_key', 'agent_id'],
  registers: [register],
});

/**
 * Agent Active Executions Gauge
 * Tracks number of currently running agent executions
 */
export const agentActiveExecutions = new promClient.Gauge({
  name: 'titangold_agent_active_executions',
  help: 'Number of currently running agent executions',
  labelNames: ['agent_key', 'agent_id'],
  registers: [register],
});

// ============================================================================
// IN-MEMORY STATISTICS TRACKING
// ============================================================================

// Track statistics per agent for calculating rates
const agentStats = new Map();

/**
 * Get or initialize agent statistics
 * @param {string} agent_key - Agent identifier
 * @param {string} agent_id - Agent ID
 * @returns {Object} Agent statistics object
 */
function getAgentStats(agent_key, agent_id) {
  const key = `${agent_key}:${agent_id}`;
  
  if (!agentStats.has(key)) {
    agentStats.set(key, {
      total_executions: 0,
      successful_executions: 0,
      failed_executions: 0,
      cache_hits: 0,
      cache_misses: 0,
      total_execution_time: 0,
      last_execution_time: 0,
      last_updated: Date.now(),
    });
  }
  
  return agentStats.get(key);
}

/**
 * Calculate and update error rate for an agent
 * @param {string} agent_key - Agent identifier
 * @param {string} agent_id - Agent ID
 */
function updateAgentErrorRate(agent_key, agent_id) {
  const stats = getAgentStats(agent_key, agent_id);
  
  if (stats.total_executions > 0) {
    const errorRate = (stats.failed_executions / stats.total_executions) * 100;
    agentErrorRateGauge.set({ agent_key, agent_id }, errorRate);
  }
}

/**
 * Calculate and update cache hit rate for an agent
 * @param {string} agent_key - Agent identifier
 * @param {string} agent_id - Agent ID
 */
function updateAgentCacheHitRate(agent_key, agent_id) {
  const stats = getAgentStats(agent_key, agent_id);
  const totalCacheOps = stats.cache_hits + stats.cache_misses;
  
  if (totalCacheOps > 0) {
    const hitRate = (stats.cache_hits / totalCacheOps) * 100;
    agentCacheHitRateGauge.set({ agent_key, agent_id }, hitRate);
  }
}

// ============================================================================
// PUBLIC API FOR TRACKING AGENT METRICS
// ============================================================================

/**
 * Record the start of an agent execution
 * @param {string} agent_key - Agent identifier (e.g., 'technical', 'risk')
 * @param {string} agent_id - Agent ID from database
 * @returns {Function} End function to call when execution completes
 */
export function startAgentExecution(agent_key, agent_id) {
  const start = process.hrtime.bigint();
  
  // Increment active executions
  agentActiveExecutions.inc({ agent_key, agent_id });
  
  /**
   * End function to call when execution completes
   * @param {boolean} success - Whether execution was successful
   * @param {string|null} error_type - Error type if failed (e.g., 'timeout', 'validation', 'internal')
   * @param {boolean} cache_hit - Whether result came from cache
   */
  return function endAgentExecution(success = true, error_type = null, cache_hit = false) {
    const durationNs = process.hrtime.bigint() - start;
    const durationSeconds = Number(durationNs) / 1e9;
    
    // Update statistics
    const stats = getAgentStats(agent_key, agent_id);
    stats.total_executions++;
    stats.last_execution_time = durationSeconds;
    stats.total_execution_time += durationSeconds;
    stats.last_updated = Date.now();
    
    // Record execution time
    agentExecutionTimeSummary.observe({ agent_key, agent_id }, durationSeconds);
    agentLastExecutionTimeGauge.set({ agent_key, agent_id }, durationSeconds);
    
    // Record success/failure
    if (success) {
      stats.successful_executions++;
      agentSuccessCounter.inc({ agent_key, agent_id });
    } else {
      stats.failed_executions++;
      agentErrorCounter.inc({ agent_key, agent_id, error_type: error_type || 'unknown' });
    }
    
    // Record cache hit/miss
    if (cache_hit) {
      stats.cache_hits++;
      agentCacheHitCounter.inc({ agent_key, agent_id });
    } else {
      stats.cache_misses++;
      agentCacheMissCounter.inc({ agent_key, agent_id });
    }
    
    // Update calculated rates
    updateAgentErrorRate(agent_key, agent_id);
    updateAgentCacheHitRate(agent_key, agent_id);
    
    // Decrement active executions
    agentActiveExecutions.dec({ agent_key, agent_id });
    
    // Log if execution took too long (> 30 seconds) or failed
    if (durationSeconds > 30) {
      logger.warn(`⚠️  Slow agent execution: ${agent_key} (${agent_id}) took ${durationSeconds.toFixed(2)}s`);
    }
    
    if (!success) {
      logger.warn(`❌ Agent execution failed: ${agent_key} (${agent_id}) - ${error_type || 'unknown error'}`);
    }
  };
}

/**
 * Record a cache hit for an agent (when not using startAgentExecution)
 * @param {string} agent_key - Agent identifier
 * @param {string} agent_id - Agent ID
 */
export function recordAgentCacheHit(agent_key, agent_id) {
  const stats = getAgentStats(agent_key, agent_id);
  stats.cache_hits++;
  agentCacheHitCounter.inc({ agent_key, agent_id });
  updateAgentCacheHitRate(agent_key, agent_id);
}

/**
 * Record a cache miss for an agent (when not using startAgentExecution)
 * @param {string} agent_key - Agent identifier
 * @param {string} agent_id - Agent ID
 */
export function recordAgentCacheMiss(agent_key, agent_id) {
  const stats = getAgentStats(agent_key, agent_id);
  stats.cache_misses++;
  agentCacheMissCounter.inc({ agent_key, agent_id });
  updateAgentCacheHitRate(agent_key, agent_id);
}

/**
 * Get current statistics for an agent
 * @param {string} agent_key - Agent identifier
 * @param {string} agent_id - Agent ID
 * @returns {Object} Current statistics
 */
export function getAgentMetrics(agent_key, agent_id) {
  const stats = getAgentStats(agent_key, agent_id);
  const totalCacheOps = stats.cache_hits + stats.cache_misses;
  
  return {
    agent_key,
    agent_id,
    total_executions: stats.total_executions,
    successful_executions: stats.successful_executions,
    failed_executions: stats.failed_executions,
    error_rate: stats.total_executions > 0 
      ? ((stats.failed_executions / stats.total_executions) * 100).toFixed(2) + '%'
      : '0%',
    cache_hits: stats.cache_hits,
    cache_misses: stats.cache_misses,
    cache_hit_rate: totalCacheOps > 0 
      ? ((stats.cache_hits / totalCacheOps) * 100).toFixed(2) + '%'
      : '0%',
    average_execution_time: stats.total_executions > 0
      ? (stats.total_execution_time / stats.total_executions).toFixed(3) + 's'
      : '0s',
    last_execution_time: stats.last_execution_time.toFixed(3) + 's',
    last_updated: new Date(stats.last_updated).toISOString(),
  };
}

/**
 * Get metrics for all agents
 * @returns {Array} Array of agent metrics
 */
export function getAllAgentMetrics() {
  const metrics = [];
  
  for (const [key, stats] of agentStats.entries()) {
    const [agent_key, agent_id] = key.split(':');
    metrics.push(getAgentMetrics(agent_key, agent_id));
  }
  
  return metrics;
}

/**
 * Reset statistics for an agent (useful for testing)
 * @param {string} agent_key - Agent identifier
 * @param {string} agent_id - Agent ID
 */
export function resetAgentMetrics(agent_key, agent_id) {
  const key = `${agent_key}:${agent_id}`;
  agentStats.delete(key);
  
  // Reset gauges
  agentErrorRateGauge.remove({ agent_key, agent_id });
  agentCacheHitRateGauge.remove({ agent_key, agent_id });
  agentLastExecutionTimeGauge.remove({ agent_key, agent_id });
  agentActiveExecutions.remove({ agent_key, agent_id });
  
  logger.info(`🔄 Reset metrics for agent: ${agent_key} (${agent_id})`);
}

/**
 * Reset all agent statistics (useful for testing)
 */
export function resetAllAgentMetrics() {
  agentStats.clear();
  logger.info('🔄 Reset all agent metrics');
}

// ============================================================================
// ALERTING HELPERS
// ============================================================================

/**
 * Check if an agent's error rate exceeds threshold
 * @param {string} agent_key - Agent identifier
 * @param {string} agent_id - Agent ID
 * @param {number} threshold - Error rate threshold (0-100)
 * @returns {boolean} True if error rate exceeds threshold
 */
export function isAgentErrorRateHigh(agent_key, agent_id, threshold = 10) {
  const stats = getAgentStats(agent_key, agent_id);
  
  // Need at least 10 executions to calculate meaningful error rate
  if (stats.total_executions < 10) {
    return false;
  }
  
  const errorRate = (stats.failed_executions / stats.total_executions) * 100;
  return errorRate > threshold;
}

/**
 * Check if an agent's cache hit rate is below threshold
 * @param {string} agent_key - Agent identifier
 * @param {string} agent_id - Agent ID
 * @param {number} threshold - Cache hit rate threshold (0-100)
 * @returns {boolean} True if cache hit rate is below threshold
 */
export function isAgentCacheHitRateLow(agent_key, agent_id, threshold = 50) {
  const stats = getAgentStats(agent_key, agent_id);
  const totalCacheOps = stats.cache_hits + stats.cache_misses;
  
  // Need at least 10 cache operations to calculate meaningful rate
  if (totalCacheOps < 10) {
    return false;
  }
  
  const hitRate = (stats.cache_hits / totalCacheOps) * 100;
  return hitRate < threshold;
}

/**
 * Get agents with high error rates
 * @param {number} threshold - Error rate threshold (0-100)
 * @param {number} minExecutions - Minimum executions to consider
 * @returns {Array} Agents exceeding error rate threshold
 */
export function getAgentsWithHighErrorRate(threshold = 10, minExecutions = 10) {
  const alerts = [];
  
  for (const [key, stats] of agentStats.entries()) {
    if (stats.total_executions >= minExecutions) {
      const errorRate = (stats.failed_executions / stats.total_executions) * 100;
      
      if (errorRate > threshold) {
        const [agent_key, agent_id] = key.split(':');
        alerts.push({
          agent_key,
          agent_id,
          error_rate: errorRate.toFixed(2) + '%',
          failed_executions: stats.failed_executions,
          total_executions: stats.total_executions,
          severity: errorRate > 50 ? 'critical' : errorRate > 25 ? 'high' : 'medium',
        });
      }
    }
  }
  
  return alerts.sort((a, b) => parseFloat(b.error_rate) - parseFloat(a.error_rate));
}

/**
 * Get agents with low cache hit rates
 * @param {number} threshold - Cache hit rate threshold (0-100)
 * @param {number} minOperations - Minimum cache operations to consider
 * @returns {Array} Agents below cache hit rate threshold
 */
export function getAgentsWithLowCacheHitRate(threshold = 50, minOperations = 10) {
  const alerts = [];
  
  for (const [key, stats] of agentStats.entries()) {
    const totalCacheOps = stats.cache_hits + stats.cache_misses;
    
    if (totalCacheOps >= minOperations) {
      const hitRate = (stats.cache_hits / totalCacheOps) * 100;
      
      if (hitRate < threshold) {
        const [agent_key, agent_id] = key.split(':');
        alerts.push({
          agent_key,
          agent_id,
          cache_hit_rate: hitRate.toFixed(2) + '%',
          cache_hits: stats.cache_hits,
          cache_misses: stats.cache_misses,
          severity: hitRate < 25 ? 'high' : 'medium',
        });
      }
    }
  }
  
  return alerts.sort((a, b) => parseFloat(a.cache_hit_rate) - parseFloat(b.cache_hit_rate));
}

// ============================================================================
// INITIALIZATION
// ============================================================================

logger.info('Agent performance monitoring initialized', {
  metrics: [
    'agent_errors_total',
    'agent_success_total',
    'agent_cache_hits_total',
    'agent_cache_misses_total',
    'agent_cache_hit_rate_percent',
    'agent_error_rate_percent',
    'agent_execution_time_seconds (summary)',
    'agent_last_execution_seconds',
    'agent_active_executions',
  ],
});

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  startAgentExecution,
  recordAgentCacheHit,
  recordAgentCacheMiss,
  getAgentMetrics,
  getAllAgentMetrics,
  resetAgentMetrics,
  resetAllAgentMetrics,
  isAgentErrorRateHigh,
  isAgentCacheHitRateLow,
  getAgentsWithHighErrorRate,
  getAgentsWithLowCacheHitRate,
};
