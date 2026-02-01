// ============================================================================
// API-008: Webhook Management Routes
// ============================================================================
//
// Purpose: Allow users to register, list, update, and delete webhooks
//          for receiving agent event notifications
//
// Features:
//   - Register webhook URLs with event subscriptions
//   - List user's webhooks
//   - Update webhook configuration
//   - Delete webhooks
//   - View delivery history
//   - Test webhook endpoints
//
// Security:
//   - JWT authentication required
//   - User can only manage their own webhooks
//   - URL validation (http/https only)
//   - Secret generation for signature verification
//
// Date: 2026-01-31
// ============================================================================

import express from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { webhookDispatcher } from '../services/webhookDispatcher.js';

const router = express.Router();

// ============================================================================
// Validation Helpers
// ============================================================================

const VALID_EVENTS = [
  'agent.started',
  'agent.completed',
  'agent.failed',
  'agent.timeout',
  'agent.error'
];

const URL_REGEX = /^https?:\/\/.+/;

function validateWebhookUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  if (!URL_REGEX.test(url)) {
    return { valid: false, error: 'URL must start with http:// or https://' };
  }
  if (url.length > 2048) {
    return { valid: false, error: 'URL is too long (max 2048 characters)' };
  }
  return { valid: true };
}

function validateEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { valid: false, error: 'At least one event type is required' };
  }
  const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return { valid: false, error: `Invalid event types: ${invalidEvents.join(', ')}` };
  }
  return { valid: true };
}

// ============================================================================
// Route: POST /api/v1/webhooks
// Create a new webhook
// ============================================================================

router.post('/', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const { url, events, metadata = {} } = req.body;

  try {
    // Validate URL
    const urlValidation = validateWebhookUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_URL',
          message: urlValidation.error
        }
      });
    }

    // Validate events
    const eventsValidation = validateEvents(events);
    if (!eventsValidation.valid) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_EVENTS',
          message: eventsValidation.error
        }
      });
    }

    // Generate secret for signature verification
    const secret = crypto.randomBytes(32).toString('hex');

    // Insert webhook
    const result = await query(
      `INSERT INTO webhooks (user_id, url, secret, events, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, url, events, is_active, created_at, metadata`,
      [userId, url, secret, events, metadata]
    );

    const webhook = result.rows[0];

    logger.info('🔗 Webhook created', {
      webhookId: webhook.id,
      userId,
      url,
      events
    });

    res.status(201).json({
      ok: true,
      webhook: {
        ...webhook,
        secret // Return secret only on creation
      }
    });
  } catch (error) {
    logger.error('❌ Error creating webhook', {
      userId,
      error: error.message
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'WEBHOOK_CREATION_FAILED',
        message: 'Failed to create webhook',
        details: error.message
      }
    });
  }
});

// ============================================================================
// Route: GET /api/v1/webhooks
// List user's webhooks
// ============================================================================

router.get('/', authenticate, async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await query(
      `SELECT id, url, events, is_active, created_at, updated_at, 
              last_triggered_at, metadata
       FROM webhooks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      ok: true,
      webhooks: result.rows
    });
  } catch (error) {
    logger.error('❌ Error listing webhooks', {
      userId,
      error: error.message
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'WEBHOOK_LIST_FAILED',
        message: 'Failed to list webhooks',
        details: error.message
      }
    });
  }
});

// ============================================================================
// Route: GET /api/v1/webhooks/:id
// Get webhook details
// ============================================================================

router.get('/:id', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const webhookId = parseInt(req.params.id);

  if (isNaN(webhookId)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_ID',
        message: 'Webhook ID must be a number'
      }
    });
  }

  try {
    const result = await query(
      `SELECT id, url, events, is_active, created_at, updated_at,
              last_triggered_at, metadata
       FROM webhooks
       WHERE id = $1 AND user_id = $2`,
      [webhookId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found'
        }
      });
    }

    res.json({
      ok: true,
      webhook: result.rows[0]
    });
  } catch (error) {
    logger.error('❌ Error getting webhook', {
      webhookId,
      userId,
      error: error.message
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'WEBHOOK_GET_FAILED',
        message: 'Failed to get webhook',
        details: error.message
      }
    });
  }
});

// ============================================================================
// Route: PATCH /api/v1/webhooks/:id
// Update webhook
// ============================================================================

router.patch('/:id', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const webhookId = parseInt(req.params.id);
  const { url, events, is_active, metadata } = req.body;

  if (isNaN(webhookId)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_ID',
        message: 'Webhook ID must be a number'
      }
    });
  }

  try {
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (url !== undefined) {
      const urlValidation = validateWebhookUrl(url);
      if (!urlValidation.valid) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'INVALID_URL',
            message: urlValidation.error
          }
        });
      }
      updates.push(`url = $${paramCount++}`);
      values.push(url);
    }

    if (events !== undefined) {
      const eventsValidation = validateEvents(events);
      if (!eventsValidation.valid) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'INVALID_EVENTS',
            message: eventsValidation.error
          }
        });
      }
      updates.push(`events = $${paramCount++}`);
      values.push(events);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}`);
      values.push(metadata);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'NO_UPDATES',
          message: 'No update fields provided'
        }
      });
    }

    values.push(webhookId, userId);

    const result = await query(
      `UPDATE webhooks
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING id, url, events, is_active, updated_at, metadata`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found'
        }
      });
    }

    logger.info('🔗 Webhook updated', {
      webhookId,
      userId,
      updates: Object.keys(req.body)
    });

    res.json({
      ok: true,
      webhook: result.rows[0]
    });
  } catch (error) {
    logger.error('❌ Error updating webhook', {
      webhookId,
      userId,
      error: error.message
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'WEBHOOK_UPDATE_FAILED',
        message: 'Failed to update webhook',
        details: error.message
      }
    });
  }
});

// ============================================================================
// Route: DELETE /api/v1/webhooks/:id
// Delete webhook
// ============================================================================

router.delete('/:id', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const webhookId = parseInt(req.params.id);

  if (isNaN(webhookId)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_ID',
        message: 'Webhook ID must be a number'
      }
    });
  }

  try {
    const result = await query(
      `DELETE FROM webhooks
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [webhookId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found'
        }
      });
    }

    logger.info('🔗 Webhook deleted', {
      webhookId,
      userId
    });

    res.json({
      ok: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    logger.error('❌ Error deleting webhook', {
      webhookId,
      userId,
      error: error.message
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'WEBHOOK_DELETE_FAILED',
        message: 'Failed to delete webhook',
        details: error.message
      }
    });
  }
});

// ============================================================================
// Route: GET /api/v1/webhooks/:id/deliveries
// Get webhook delivery history
// ============================================================================

router.get('/:id/deliveries', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const webhookId = parseInt(req.params.id);
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;

  if (isNaN(webhookId)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_ID',
        message: 'Webhook ID must be a number'
      }
    });
  }

  try {
    // Verify webhook ownership
    const webhookResult = await query(
      `SELECT id FROM webhooks WHERE id = $1 AND user_id = $2`,
      [webhookId, userId]
    );

    if (webhookResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found'
        }
      });
    }

    // Get deliveries
    const deliveriesResult = await query(
      `SELECT id, event_type, response_status, attempt_count, max_attempts,
              succeeded, created_at, completed_at, error_message,
              payload
       FROM webhook_deliveries
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [webhookId, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM webhook_deliveries WHERE webhook_id = $1`,
      [webhookId]
    );

    res.json({
      ok: true,
      deliveries: deliveriesResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
        hasMore: offset + deliveriesResult.rows.length < parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    logger.error('❌ Error getting webhook deliveries', {
      webhookId,
      userId,
      error: error.message
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'DELIVERIES_GET_FAILED',
        message: 'Failed to get webhook deliveries',
        details: error.message
      }
    });
  }
});

// ============================================================================
// Route: POST /api/v1/webhooks/:id/test
// Test webhook endpoint
// ============================================================================

router.post('/:id/test', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const webhookId = parseInt(req.params.id);

  if (isNaN(webhookId)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_ID',
        message: 'Webhook ID must be a number'
      }
    });
  }

  try {
    // Get webhook
    const webhookResult = await query(
      `SELECT id, url, secret, events, is_active FROM webhooks
       WHERE id = $1 AND user_id = $2`,
      [webhookId, userId]
    );

    if (webhookResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found'
        }
      });
    }

    const webhook = webhookResult.rows[0];

    // Create test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.id
      }
    };

    // Dispatch test webhook
    const deliveryId = await webhookDispatcher.dispatch(
      webhook.id,
      webhook.url,
      webhook.secret,
      'webhook.test',
      testPayload
    );

    logger.info('🔗 Test webhook dispatched', {
      webhookId,
      userId,
      deliveryId
    });

    res.json({
      ok: true,
      message: 'Test webhook dispatched',
      deliveryId
    });
  } catch (error) {
    logger.error('❌ Error testing webhook', {
      webhookId,
      userId,
      error: error.message
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'WEBHOOK_TEST_FAILED',
        message: 'Failed to test webhook',
        details: error.message
      }
    });
  }
});

// ============================================================================
// Route: GET /api/v1/webhooks/events
// List available webhook events
// ============================================================================

router.get('/events', authenticate, async (req, res) => {
  res.json({
    ok: true,
    events: VALID_EVENTS.map(event => ({
      name: event,
      description: getEventDescription(event)
    }))
  });
});

function getEventDescription(event) {
  const descriptions = {
    'agent.started': 'Triggered when an agent starts execution',
    'agent.completed': 'Triggered when an agent completes successfully',
    'agent.failed': 'Triggered when an agent fails',
    'agent.timeout': 'Triggered when an agent times out',
    'agent.error': 'Triggered when an agent encounters an error'
  };
  return descriptions[event] || 'Unknown event';
}

export default router;
