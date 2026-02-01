/**
 * Agent A/B Testing Service
 * Task: BACKEND-022
 * 
 * Enables running experiments comparing two agent versions (A vs B):
 * - Define experiments with variant versions
 * - Random user assignment to variants
 * - Track metrics per variant
 * - Statistical significance testing
 * 
 * Dependencies: BACKEND-017 (Version tracking)
 */

import pool from '../database/db.js';
import { logger } from './logger.js';
import crypto from 'crypto';

// ============================================================================
// EXPERIMENT MANAGEMENT
// ============================================================================

/**
 * Create a new A/B test experiment
 * @param {Object} experimentData - Experiment configuration
 * @returns {Promise<Object>} Created experiment
 */
export async function createExperiment(experimentData) {
  const {
    experiment_key,
    agent_key,
    name,
    description = null,
    hypothesis = null,
    variant_a_version,
    variant_b_version,
    variant_a_traffic_percent = 50,
    variant_b_traffic_percent = 50,
    min_sample_size = 100,
    confidence_level = 0.95,
    created_by = 'system',
    metadata = {}
  } = experimentData;

  // Validate traffic percentages sum to 100
  if (variant_a_traffic_percent + variant_b_traffic_percent !== 100) {
    throw new Error('Traffic percentages must sum to 100');
  }

  try {
    const result = await pool.query(
      `INSERT INTO agent_experiments (
        experiment_key, agent_key, name, description, hypothesis,
        variant_a_version, variant_b_version,
        variant_a_traffic_percent, variant_b_traffic_percent,
        min_sample_size, confidence_level, created_by, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        experiment_key, agent_key, name, description, hypothesis,
        variant_a_version, variant_b_version,
        variant_a_traffic_percent, variant_b_traffic_percent,
        min_sample_size, confidence_level, created_by,
        JSON.stringify(metadata)
      ]
    );

    logger.info(`✅ Created experiment: ${experiment_key} (${variant_a_version} vs ${variant_b_version})`);
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Failed to create experiment:`, error.message);
    throw error;
  }
}

/**
 * Start an experiment
 * @param {string} experiment_key - Experiment identifier
 * @returns {Promise<Object>} Updated experiment
 */
export async function startExperiment(experiment_key) {
  try {
    const result = await pool.query(
      `UPDATE agent_experiments
       SET status = 'running', started_at = NOW()
       WHERE experiment_key = $1 AND status = 'draft'
       RETURNING *`,
      [experiment_key]
    );

    if (result.rows.length === 0) {
      throw new Error(`Experiment not found or not in draft status: ${experiment_key}`);
    }

    logger.info(`🚀 Started experiment: ${experiment_key}`);
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Failed to start experiment:`, error.message);
    throw error;
  }
}

/**
 * Complete an experiment
 * @param {string} experiment_key - Experiment identifier
 * @param {string} winning_variant - 'A' or 'B' (optional)
 * @returns {Promise<Object>} Updated experiment
 */
export async function completeExperiment(experiment_key, winning_variant = null) {
  try {
    const result = await pool.query(
      `UPDATE agent_experiments
       SET status = 'completed', completed_at = NOW(), winning_variant = $2
       WHERE experiment_key = $1 AND status IN ('running', 'paused')
       RETURNING *`,
      [experiment_key, winning_variant]
    );

    if (result.rows.length === 0) {
      throw new Error(`Experiment not found or not running: ${experiment_key}`);
    }

    logger.info(`✅ Completed experiment: ${experiment_key}, winner: ${winning_variant || 'none'}`);
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Failed to complete experiment:`, error.message);
    throw error;
  }
}

/**
 * Get experiment by key
 * @param {string} experiment_key - Experiment identifier
 * @returns {Promise<Object>} Experiment details
 */
export async function getExperiment(experiment_key) {
  try {
    const result = await pool.query(
      'SELECT * FROM agent_experiments WHERE experiment_key = $1',
      [experiment_key]
    );

    if (result.rows.length === 0) {
      throw new Error(`Experiment not found: ${experiment_key}`);
    }

    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Failed to get experiment:`, error.message);
    throw error;
  }
}

/**
 * List experiments
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of experiments
 */
export async function listExperiments(filters = {}) {
  const { agent_key, status } = filters;
  
  let query = 'SELECT * FROM agent_experiments WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (agent_key) {
    query += ` AND agent_key = $${paramIndex++}`;
    params.push(agent_key);
  }

  if (status) {
    query += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    logger.error(`❌ Failed to list experiments:`, error.message);
    throw error;
  }
}

// ============================================================================
// USER ASSIGNMENT
// ============================================================================

/**
 * Get or create variant assignment for a user
 * @param {string} experiment_key - Experiment identifier
 * @param {string} user_id - User UUID
 * @returns {Promise<Object>} Assignment details with variant
 */
export async function getVariantAssignment(experiment_key, user_id) {
  try {
    // Get experiment
    const experiment = await getExperiment(experiment_key);

    // Check if experiment is running
    if (experiment.status !== 'running') {
      throw new Error(`Experiment not running: ${experiment_key} (status: ${experiment.status})`);
    }

    // Use database function for atomic get-or-create
    const result = await pool.query(
      'SELECT get_or_create_assignment($1, $2) as variant',
      [experiment.id, user_id]
    );

    const variant = result.rows[0].variant;

    // Get full assignment details
    const assignmentResult = await pool.query(
      `SELECT * FROM experiment_assignments 
       WHERE experiment_id = $1 AND user_id = $2`,
      [experiment.id, user_id]
    );

    const assignment = assignmentResult.rows[0];

    // Determine which version to use
    const version = variant === 'A' ? experiment.variant_a_version : experiment.variant_b_version;

    return {
      experiment_id: experiment.id,
      experiment_key: experiment.experiment_key,
      agent_key: experiment.agent_key,
      variant,
      version,
      assigned_at: assignment.assigned_at,
      is_new_assignment: !assignment.assigned_at || 
                         (new Date() - new Date(assignment.assigned_at) < 1000) // assigned in last second
    };
  } catch (error) {
    logger.error(`❌ Failed to get variant assignment:`, error.message);
    throw error;
  }
}

/**
 * Get user's assignments across all experiments
 * @param {string} user_id - User UUID
 * @returns {Promise<Array>} List of user's assignments
 */
export async function getUserAssignments(user_id) {
  try {
    const result = await pool.query(
      `SELECT ea.*, e.experiment_key, e.agent_key, e.variant_a_version, e.variant_b_version
       FROM experiment_assignments ea
       JOIN agent_experiments e ON ea.experiment_id = e.id
       WHERE ea.user_id = $1
       ORDER BY ea.assigned_at DESC`,
      [user_id]
    );

    return result.rows;
  } catch (error) {
    logger.error(`❌ Failed to get user assignments:`, error.message);
    throw error;
  }
}

// ============================================================================
// METRICS TRACKING
// ============================================================================

/**
 * Record experiment metric
 * @param {Object} metricData - Metric data
 * @returns {Promise<Object>} Recorded metric
 */
export async function recordMetric(metricData) {
  const {
    experiment_key,
    variant,
    agent_id = null,
    user_id = null,
    decision_id = null,
    execution_time_ms,
    success,
    error_type = null,
    cache_hit = false,
    confidence = null,
    custom_metrics = {},
    metadata = {}
  } = metricData;

  try {
    // Get experiment ID
    const experiment = await getExperiment(experiment_key);

    const result = await pool.query(
      `INSERT INTO experiment_metrics (
        experiment_id, variant, agent_id, user_id, decision_id,
        execution_time_ms, success, error_type, cache_hit, confidence,
        custom_metrics, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        experiment.id, variant, agent_id, user_id, decision_id,
        execution_time_ms, success, error_type, cache_hit, confidence,
        JSON.stringify(custom_metrics), JSON.stringify(metadata)
      ]
    );

    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Failed to record metric:`, error.message);
    throw error;
  }
}

/**
 * Get experiment statistics
 * @param {string} experiment_key - Experiment identifier
 * @returns {Promise<Object>} Aggregated statistics
 */
export async function getExperimentStatistics(experiment_key) {
  try {
    const result = await pool.query(
      `SELECT * FROM experiment_statistics WHERE experiment_key = $1`,
      [experiment_key]
    );

    if (result.rows.length === 0) {
      throw new Error(`Statistics not found for experiment: ${experiment_key}`);
    }

    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Failed to get experiment statistics:`, error.message);
    throw error;
  }
}

// ============================================================================
// STATISTICAL SIGNIFICANCE TESTING
// ============================================================================

/**
 * Calculate statistical significance using two-sample t-test
 * @param {Object} stats - Experiment statistics
 * @returns {Object} Significance test results
 */
export function calculateSignificance(stats) {
  const {
    variant_a_sample_size,
    variant_a_avg_execution_time_ms,
    variant_a_stddev_execution_time,
    variant_a_success_rate,
    variant_b_sample_size,
    variant_b_avg_execution_time_ms,
    variant_b_stddev_execution_time,
    variant_b_success_rate,
  } = stats;

  // Check if we have enough samples
  if (!variant_a_sample_size || !variant_b_sample_size) {
    return {
      has_significance: false,
      reason: 'Insufficient data',
      p_value: null,
      recommended_action: 'continue'
    };
  }

  // Check minimum sample size
  const minSamples = stats.min_sample_size || 100;
  if (variant_a_sample_size < minSamples || variant_b_sample_size < minSamples) {
    return {
      has_significance: false,
      reason: `Need at least ${minSamples} samples per variant`,
      samples_needed_a: Math.max(0, minSamples - variant_a_sample_size),
      samples_needed_b: Math.max(0, minSamples - variant_b_sample_size),
      p_value: null,
      recommended_action: 'continue'
    };
  }

  // Two-sample t-test for execution time
  const n1 = variant_a_sample_size;
  const n2 = variant_b_sample_size;
  const mean1 = variant_a_avg_execution_time_ms;
  const mean2 = variant_b_avg_execution_time_ms;
  const std1 = variant_a_stddev_execution_time || 0;
  const std2 = variant_b_stddev_execution_time || 0;

  // Pooled standard error
  const se = Math.sqrt((std1 * std1) / n1 + (std2 * std2) / n2);

  // T-statistic
  const t = se > 0 ? (mean1 - mean2) / se : 0;

  // Degrees of freedom (Welch-Satterthwaite approximation)
  const df = se > 0 
    ? Math.pow(std1 * std1 / n1 + std2 * std2 / n2, 2) /
      (Math.pow(std1 * std1 / n1, 2) / (n1 - 1) + Math.pow(std2 * std2 / n2, 2) / (n2 - 1))
    : n1 + n2 - 2;

  // Approximate p-value using t-distribution
  // For simplicity, using normal approximation (valid for df > 30)
  const p_value = df > 30 ? 2 * (1 - normalCDF(Math.abs(t))) : null;

  // Determine significance (typically p < 0.05)
  const confidence_level = stats.confidence_level || 0.95;
  const alpha = 1 - confidence_level;
  const is_significant = p_value !== null && p_value < alpha;

  // Determine winner based on success rate (primary metric)
  let winner = null;
  if (is_significant) {
    if (variant_b_success_rate > variant_a_success_rate) {
      winner = 'B';
    } else if (variant_a_success_rate > variant_b_success_rate) {
      winner = 'A';
    }
  }

  // Calculate lift (improvement percentage)
  const success_rate_lift = variant_a_success_rate > 0
    ? ((variant_b_success_rate - variant_a_success_rate) / variant_a_success_rate) * 100
    : 0;

  const execution_time_improvement = mean1 > 0
    ? ((mean1 - mean2) / mean1) * 100
    : 0;

  return {
    has_significance: is_significant,
    p_value: p_value ? parseFloat(p_value.toFixed(8)) : null,
    confidence_level,
    winner,
    metrics: {
      success_rate_lift: parseFloat(success_rate_lift.toFixed(2)),
      execution_time_improvement: parseFloat(execution_time_improvement.toFixed(2)),
      variant_a: {
        sample_size: variant_a_sample_size,
        success_rate: parseFloat(variant_a_success_rate.toFixed(2)),
        avg_execution_time_ms: parseFloat(variant_a_avg_execution_time_ms.toFixed(2))
      },
      variant_b: {
        sample_size: variant_b_sample_size,
        success_rate: parseFloat(variant_b_success_rate.toFixed(2)),
        avg_execution_time_ms: parseFloat(variant_b_avg_execution_time_ms.toFixed(2))
      }
    },
    recommended_action: is_significant ? (winner ? `deploy_variant_${winner}` : 'no_clear_winner') : 'continue'
  };
}

/**
 * Normal cumulative distribution function (CDF)
 * Used for p-value calculation
 */
function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/**
 * Update experiment with significance test results
 * @param {string} experiment_key - Experiment identifier
 * @returns {Promise<Object>} Updated experiment with significance results
 */
export async function updateSignificance(experiment_key) {
  try {
    // Get current statistics
    const stats = await getExperimentStatistics(experiment_key);
    
    // Calculate significance
    const significance = calculateSignificance(stats);

    // Update experiment
    await pool.query(
      `UPDATE agent_experiments
       SET statistical_significance = $1, p_value = $2, winning_variant = $3
       WHERE experiment_key = $4`,
      [
        significance.has_significance,
        significance.p_value,
        significance.winner,
        experiment_key
      ]
    );

    logger.info(`📊 Updated significance for experiment ${experiment_key}: ${significance.has_significance ? 'SIGNIFICANT' : 'not significant'}`);

    return {
      experiment_key,
      ...significance
    };
  } catch (error) {
    logger.error(`❌ Failed to update significance:`, error.message);
    throw error;
  }
}

/**
 * Get comprehensive experiment results
 * @param {string} experiment_key - Experiment identifier
 * @returns {Promise<Object>} Complete experiment results
 */
export async function getExperimentResults(experiment_key) {
  try {
    const experiment = await getExperiment(experiment_key);
    const stats = await getExperimentStatistics(experiment_key);
    const significance = calculateSignificance(stats);

    return {
      experiment: {
        id: experiment.id,
        key: experiment.experiment_key,
        name: experiment.name,
        agent_key: experiment.agent_key,
        status: experiment.status,
        created_at: experiment.created_at,
        started_at: experiment.started_at,
        completed_at: experiment.completed_at
      },
      variants: {
        A: {
          version: experiment.variant_a_version,
          traffic_percent: experiment.variant_a_traffic_percent,
          sample_size: stats.variant_a_sample_size,
          avg_execution_time_ms: stats.variant_a_avg_execution_time_ms,
          success_rate: stats.variant_a_success_rate,
          cache_hit_rate: stats.variant_a_cache_hit_rate
        },
        B: {
          version: experiment.variant_b_version,
          traffic_percent: experiment.variant_b_traffic_percent,
          sample_size: stats.variant_b_sample_size,
          avg_execution_time_ms: stats.variant_b_avg_execution_time_ms,
          success_rate: stats.variant_b_success_rate,
          cache_hit_rate: stats.variant_b_cache_hit_rate
        }
      },
      significance,
      recommendations: {
        action: significance.recommended_action,
        reason: significance.has_significance 
          ? `Statistical significance achieved (p=${significance.p_value?.toFixed(4)})`
          : significance.reason || 'Not enough data yet'
      }
    };
  } catch (error) {
    logger.error(`❌ Failed to get experiment results:`, error.message);
    throw error;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Experiment management
  createExperiment,
  startExperiment,
  completeExperiment,
  getExperiment,
  listExperiments,
  
  // User assignment
  getVariantAssignment,
  getUserAssignments,
  
  // Metrics tracking
  recordMetric,
  getExperimentStatistics,
  
  // Statistical analysis
  calculateSignificance,
  updateSignificance,
  getExperimentResults
};
