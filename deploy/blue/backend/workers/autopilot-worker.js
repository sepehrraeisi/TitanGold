/**
 * Autopilot Background Worker
 * Runs periodic autopilot cycles when enabled
 * 
 * Safety:
 * - Only runs when autopilot_enabled = true
 * - Checks circuit breaker before each cycle
 * - Respects min_cycle_interval_minutes from config
 * - No auto-apply (only creates suggestions)
 * - Increments fail_count on errors
 */

import { query } from '../database/db.js';
import autopilotService from '../services/autopilot.js';
import { logger } from '../services/logger.js';

// ==================== Worker State ====================
let workerInterval = null;
let isRunning = false;

// ==================== Autopilot Cycle ====================

/**
 * Run one autopilot cycle
 */
async function runAutopilotCycle() {
  // Prevent overlapping cycles
  if (isRunning) {
    logger.info('[Autopilot Worker] Cycle already running, skipping...');
    return;
  }

  isRunning = true;

  try {
    logger.info('[Autopilot Worker] Starting cycle...');

    // 1) Check if autopilot is enabled
    const stateResult = await query(
      `SELECT 
        autopilot_enabled,
        autopilot_fail_count,
        autopilot_config,
        autopilot_last_run
      FROM artemis_state
      ORDER BY created_at DESC
      LIMIT 1`
    );

    if (stateResult.rows.length === 0) {
      logger.info('[Autopilot Worker] No artemis_state found, skipping cycle');
      return;
    }

    const state = stateResult.rows[0];

    // 2) Check if enabled
    if (!state.autopilot_enabled) {
      logger.info('[Autopilot Worker] Autopilot disabled, skipping cycle');
      return;
    }

    // 3) Check circuit breaker
    const failCount = state.autopilot_fail_count || 0;
    if (failCount >= 3) {
      logger.info(`[Autopilot Worker] Circuit breaker triggered (fail_count: ${failCount}), skipping cycle`);
      return;
    }

    // 4) Check min interval
    const config = state.autopilot_config || {};
    const minIntervalMinutes = config.min_cycle_interval_minutes || 5;
    
    if (state.autopilot_last_run) {
      const lastRun = new Date(state.autopilot_last_run);
      const now = new Date();
      const minutesSinceLastRun = (now - lastRun) / (1000 * 60);

      if (minutesSinceLastRun < minIntervalMinutes) {
        logger.info(`[Autopilot Worker] Too soon since last run (${minutesSinceLastRun.toFixed(1)}m < ${minIntervalMinutes}m), skipping`);
        return;
      }
    }

    // 5) Run analysis
    logger.info('[Autopilot Worker] Running learning analysis...');
    const analysis = await autopilotService.analyzeLearningAndSuggest(24);

    logger.info(`[Autopilot Worker] Analysis complete: ${analysis.summary.suggestionsGenerated} suggestions`);

    // 6) Save suggestions (only if any exist)
    if (analysis.suggestions.length > 0) {
      const saved = await autopilotService.saveSuggestions(analysis.suggestions);
      logger.info(`[Autopilot Worker] Saved ${saved.length} suggestions`);
    }

    // 7) Update state (success)
    await query(
      `UPDATE artemis_state
       SET autopilot_last_run = NOW(),
           autopilot_cycle_count = autopilot_cycle_count + 1,
           updated_at = NOW()
       WHERE id = (SELECT id FROM artemis_state ORDER BY created_at DESC LIMIT 1)`
    );

    logger.info('[Autopilot Worker] Cycle completed successfully');

  } catch (error) {
    logger.error('[Autopilot Worker] Cycle failed:', error);

    // Increment fail count (triggers circuit breaker at ≥3)
    try {
      await query(
        `UPDATE artemis_state
         SET autopilot_fail_count = autopilot_fail_count + 1,
             updated_at = NOW()
         WHERE id = (SELECT id FROM artemis_state ORDER BY created_at DESC LIMIT 1)`
      );

      logger.info('[Autopilot Worker] Incremented fail_count due to error');

    } catch (updateError) {
      logger.error('[Autopilot Worker] Failed to update fail_count:', updateError);
    }

  } finally {
    isRunning = false;
  }
}

// ==================== Worker Lifecycle ====================

/**
 * Start autopilot worker
 * @param {number} intervalMinutes - Check interval (default: 5 minutes)
 */
export function startAutopilotWorker(intervalMinutes = 5) {
  if (workerInterval) {
    logger.info('[Autopilot Worker] Already running');
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  logger.info(`[Autopilot Worker] Starting with ${intervalMinutes}min interval...`);

  // Run immediately on start
  runAutopilotCycle().catch(err => {
    logger.error('[Autopilot Worker] Initial cycle error:', err);
  });

  // Then run periodically
  workerInterval = setInterval(() => {
    runAutopilotCycle().catch(err => {
      logger.error('[Autopilot Worker] Periodic cycle error:', err);
    });
  }, intervalMs);

  logger.info('[Autopilot Worker] Started successfully');
}

/**
 * Stop autopilot worker
 */
export function stopAutopilotWorker() {
  if (!workerInterval) {
    logger.info('[Autopilot Worker] Not running');
    return;
  }

  clearInterval(workerInterval);
  workerInterval = null;

  logger.info('[Autopilot Worker] Stopped');
}

/**
 * Get worker status
 */
export function getWorkerStatus() {
  return {
    running: workerInterval !== null,
    cycle_in_progress: isRunning
  };
}

// ==================== Export ====================
export default {
  start: startAutopilotWorker,
  stop: stopAutopilotWorker,
  status: getWorkerStatus,
  runOnce: runAutopilotCycle
};
