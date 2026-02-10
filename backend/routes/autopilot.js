/**
 * Autopilot API Routes
 * Admin-only endpoints for managing autopilot system
 * 
 * Safety:
 * - All routes require authentication + admin role
 * - Rate limited
 * - Circuit breaker enforcement
 * - Human approval required for all config changes
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import { query } from '../database/db.js';
import autopilotService from '../services/autopilot.js';
import { logger } from '../services/logger.js';
import { validateBody, validateParams, validateQuery, validateResponse } from '../middleware/validation.js';
import {
  autopilotStatusResponseSchema,
  autopilotSuggestionListResponseSchema,
  autopilotSuggestionSchema
} from '../schemas/autopilotSchemas.js';

const router = express.Router();

// ==================== Rate Limiting ====================
const autopilotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (admin-only, reasonable for testing/management)
  message: { error: 'Too many autopilot requests' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many autopilot requests', code: 'RATE_LIMITED' });
  },
});

// ==================== Admin Check Middleware ====================
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is admin
    const result = await query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'FORBIDDEN'
      });
    }

    next();
  } catch (error) {
    logger.error('[Autopilot] Admin check failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Apply to all routes
router.use(authenticate);
router.use(requireAdmin);
router.use(autopilotLimiter);

// ==================== Routes ====================

/**
 * GET /api/autopilot/status
 * Get current autopilot status
 */
router.get('/status', validateResponse(autopilotStatusResponseSchema), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        autopilot_enabled,
        autopilot_last_run,
        autopilot_cycle_count,
        autopilot_fail_count,
        autopilot_config
      FROM artemis_state
      ORDER BY created_at DESC
      LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({
        enabled: false,
        last_run: null,
        cycle_count: 0,
        fail_count: 0,
        config: {
          max_change_percent: 10,
          min_cycle_interval_minutes: 5,
          max_consecutive_failures: 3,
          require_human_approval: true
        }
      });
    }

    const state = result.rows[0];

    res.json({
      enabled: state.autopilot_enabled,
      last_run: state.autopilot_last_run,
      cycle_count: state.autopilot_cycle_count,
      fail_count: state.autopilot_fail_count,
      config: state.autopilot_config
    });

  } catch (error) {
    logger.error('[Autopilot] Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch autopilot status' });
  }
});

/**
 * POST /api/autopilot/enable
 * Enable autopilot system
 */
router.post('/enable', async (req, res) => {
  try {
    // Check circuit breaker
    const statusResult = await query(
      'SELECT autopilot_fail_count FROM artemis_state ORDER BY created_at DESC LIMIT 1'
    );

    if (statusResult.rows.length > 0) {
      const failCount = statusResult.rows[0].autopilot_fail_count;
      if (failCount >= 3) {
        return res.status(400).json({
          error: 'Cannot enable autopilot: circuit breaker triggered',
          code: 'CIRCUIT_BREAKER',
          fail_count: failCount,
          message: 'Reset fail_count first by investigating and fixing issues'
        });
      }
    }

    // Enable autopilot
    await query(
      `UPDATE artemis_state 
       SET autopilot_enabled = true,
           updated_at = NOW()
       WHERE id = (SELECT id FROM artemis_state ORDER BY created_at DESC LIMIT 1)`
    );

    logger.info(`[Autopilot] Enabled by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Autopilot enabled',
      enabled_by: req.user.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Autopilot] Error enabling:', error);
    res.status(500).json({ error: 'Failed to enable autopilot' });
  }
});

/**
 * POST /api/autopilot/disable
 * Disable autopilot system
 */
router.post('/disable', async (req, res) => {
  try {
    await query(
      `UPDATE artemis_state 
       SET autopilot_enabled = false,
           updated_at = NOW()
       WHERE id = (SELECT id FROM artemis_state ORDER BY created_at DESC LIMIT 1)`
    );

    logger.info(`[Autopilot] Disabled by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Autopilot disabled',
      disabled_by: req.user.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Autopilot] Error disabling:', error);
    res.status(500).json({ error: 'Failed to disable autopilot' });
  }
});

/**
 * GET /api/autopilot/suggestions
 * Get all autopilot suggestions
 */
router.get('/suggestions', validateResponse(autopilotSuggestionListResponseSchema), async (req, res) => {
  try {
    const { status, agent_id, limit = 50 } = req.query;

    let queryText = `
      SELECT 
        ap.*,
        a.name as agent_name,
        a.type as agent_type,
        u.email as approved_by_email
      FROM autopilot_actions ap
      LEFT JOIN ai_agents a ON ap.agent_id = a.id
      LEFT JOIN users u ON ap.approved_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` AND ap.status = $${params.length}`;
    }

    if (agent_id) {
      params.push(agent_id);
      queryText += ` AND ap.agent_id = $${params.length}`;
    }

    queryText += ` ORDER BY ap.suggested_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await query(queryText, params);

    res.json({
      suggestions: result.rows,
      count: result.rows.length,
      filters: { status, agent_id }
    });

  } catch (error) {
    logger.error('[Autopilot] Error fetching suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

/**
 * POST /api/autopilot/suggestions/:id/approve
 * Approve and apply a suggestion
 */
router.post('/suggestions/:id/approve', validateResponse(autopilotSuggestionSchema), async (req, res) => {
  try {
    const { id } = req.params;

    // Apply suggestion (includes human approval tracking)
    const result = await autopilotService.applySuggestion(id, req.user.id);

    logger.info(`[Autopilot] Suggestion ${id} approved by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Suggestion approved and applied',
      ...result
    });

  } catch (error) {
    logger.error('[Autopilot] Error approving suggestion:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    if (error.message.includes('already')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to approve suggestion' });
  }
});

/**
 * POST /api/autopilot/suggestions/:id/reject
 * Reject a suggestion
 */
router.post('/suggestions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await autopilotService.rejectSuggestion(id, req.user.id, reason);

    logger.info(`[Autopilot] Suggestion ${id} rejected by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Suggestion rejected',
      rejected_by: req.user.id,
      reason
    });

  } catch (error) {
    logger.error('[Autopilot] Error rejecting suggestion:', error);
    res.status(500).json({ error: 'Failed to reject suggestion' });
  }
});

/**
 * POST /api/autopilot/suggestions/:id/rollback
 * Rollback an applied suggestion
 */
router.post('/suggestions/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;

    // Rollback (always restores old_config)
    const result = await autopilotService.rollbackSuggestion(id);

    logger.info(`[Autopilot] Suggestion ${id} rolled back by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Suggestion rolled back successfully',
      rolled_back_by: req.user.id,
      ...result
    });

  } catch (error) {
    logger.error('[Autopilot] Error rolling back suggestion:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    if (error.message.includes('only rollback applied')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to rollback suggestion' });
  }
});

/**
 * POST /api/autopilot/run-once
 * Manually trigger one autopilot cycle (admin only)
 */
router.post('/run-once', async (req, res) => {
  try {
    const { hours_window = 24 } = req.body;

    logger.info(`[Autopilot] Manual run triggered by user ${req.user.id}`);

    // Check circuit breaker
    const statusResult = await query(
      'SELECT autopilot_fail_count FROM artemis_state ORDER BY created_at DESC LIMIT 1'
    );

    if (statusResult.rows.length > 0) {
      const failCount = statusResult.rows[0].autopilot_fail_count;
      if (failCount >= 3) {
        return res.status(400).json({
          error: 'Circuit breaker triggered',
          code: 'CIRCUIT_BREAKER',
          fail_count: failCount
        });
      }
    }

    // Run analysis
    const analysis = await autopilotService.analyzeLearningAndSuggest(hours_window);

    // Save suggestions
    if (analysis.suggestions.length > 0) {
      await autopilotService.saveSuggestions(analysis.suggestions);
    }

    // Update last_run
    await query(
      `UPDATE artemis_state 
       SET autopilot_last_run = NOW(),
           autopilot_cycle_count = autopilot_cycle_count + 1,
           updated_at = NOW()
       WHERE id = (SELECT id FROM artemis_state ORDER BY created_at DESC LIMIT 1)`
    );

    res.json({
      success: true,
      message: 'Autopilot cycle completed',
      triggered_by: req.user.id,
      ...analysis
    });

  } catch (error) {
    logger.error('[Autopilot] Error in manual run:', error);

    // Increment fail count
    await query(
      `UPDATE artemis_state 
       SET autopilot_fail_count = autopilot_fail_count + 1,
           updated_at = NOW()
       WHERE id = (SELECT id FROM artemis_state ORDER BY created_at DESC LIMIT 1)`
    ).catch(err => logger.error('[Autopilot] Failed to update fail_count:', err));

    res.status(500).json({ error: 'Autopilot cycle failed' });
  }
});

// ==================== Export ====================
export default router;
