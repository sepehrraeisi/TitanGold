/**
 * Webhook Dispatcher Service
 * API-008: Add Webhook Support
 * Date: 2026-01-31
 * 
 * Handles webhook delivery with:
 * - Retry logic (3 attempts with exponential backoff)
 * - HMAC-SHA256 signature verification
 * - Delivery tracking
 * - Error handling
 */

import crypto from 'crypto';
import fetch from 'node-fetch';
import { query } from '../database/db.js';
import { logger } from './logger.js';

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * @param {string} secret - Webhook secret
 * @param {Object} payload - Webhook payload
 * @returns {string} Hex signature
 */
function generateSignature(secret, payload) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Calculate next retry delay using exponential backoff
 * @param {number} attemptCount - Current attempt number (1-based)
 * @returns {number} Delay in milliseconds
 */
function getRetryDelay(attemptCount) {
  // Exponential backoff: 1min, 5min, 30min
  const delays = [60000, 300000, 1800000]; // 1min, 5min, 30min
  return delays[attemptCount - 1] || 1800000;
}

/**
 * Trigger webhook for an event
 * @param {string} eventType - Event type (e.g., 'agent.completed')
 * @param {Object} eventData - Event data payload
 * @param {number} userId - User ID to find webhooks for
 */
export async function triggerWebhook(eventType, eventData, userId) {
  try {
    // Find active webhooks for this user and event type
    const result = await query(`
      SELECT id, url, secret, events
      FROM webhooks
      WHERE user_id = $1 
        AND is_active = true
        AND $2 = ANY(events)
    `, [userId, eventType]);

    if (result.rows.length === 0) {
      logger.debug(`No webhooks registered for event ${eventType} and user ${userId}`);
      return;
    }

    logger.info(`📢 Triggering ${result.rows.length} webhook(s) for event: ${eventType}`);

    // Trigger each webhook asynchronously
    const promises = result.rows.map(webhook => 
      deliverWebhook(webhook.id, webhook.url, webhook.secret, eventType, eventData)
    );

    // Don't wait for delivery - fire and forget
    Promise.allSettled(promises).then(results => {
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      logger.info(`📊 Webhook delivery results: ${succeeded} succeeded, ${failed} failed`);
    });

  } catch (error) {
    logger.error('Failed to trigger webhooks:', error);
  }
}

/**
 * Deliver webhook to a specific URL
 * @param {number} webhookId - Webhook ID
 * @param {string} url - Webhook URL
 * @param {string} secret - Webhook secret
 * @param {string} eventType - Event type
 * @param {Object} eventData - Event data
 * @param {number} attemptCount - Current attempt number (default: 1)
 */
async function deliverWebhook(webhookId, url, secret, eventType, eventData, attemptCount = 1) {
  const deliveryId = await createDeliveryRecord(webhookId, eventType, eventData, attemptCount);

  try {
    // Prepare payload
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: eventData,
      webhook_id: webhookId,
      delivery_id: deliveryId
    };

    // Generate signature
    const signature = generateSignature(secret, payload);

    // Send webhook
    logger.debug(`🔔 Delivering webhook ${deliveryId} to ${url} (attempt ${attemptCount})`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TitanGold-Signature': signature,
        'X-TitanGold-Event': eventType,
        'X-TitanGold-Delivery': deliveryId.toString(),
        'User-Agent': 'TitanGold-Webhook/1.0'
      },
      body: JSON.stringify(payload),
      timeout: 30000 // 30 second timeout
    });

    const responseBody = await response.text().catch(() => '');
    const responseStatus = response.status;

    // Check if successful (2xx status)
    const succeeded = responseStatus >= 200 && responseStatus < 300;

    if (succeeded) {
      // Mark as succeeded
      await markDeliverySuccess(deliveryId, responseStatus, responseBody);
      await updateWebhookLastTriggered(webhookId);
      logger.info(`✅ Webhook ${deliveryId} delivered successfully to ${url}`);
    } else {
      // Mark as failed and schedule retry
      const shouldRetry = attemptCount < 3;
      await markDeliveryFailed(
        deliveryId, 
        responseStatus, 
        responseBody, 
        `HTTP ${responseStatus}`,
        shouldRetry ? getRetryDelay(attemptCount) : null
      );
      
      logger.warn(`❌ Webhook ${deliveryId} failed (attempt ${attemptCount}/3): HTTP ${responseStatus}`);
      
      if (shouldRetry) {
        // Schedule retry
        scheduleRetry(deliveryId, webhookId, url, secret, eventType, eventData, attemptCount + 1);
      }
    }

  } catch (error) {
    // Network error or timeout
    const errorMessage = error.message || 'Unknown error';
    const shouldRetry = attemptCount < 3;
    
    await markDeliveryFailed(
      deliveryId,
      null,
      null,
      errorMessage,
      shouldRetry ? getRetryDelay(attemptCount) : null
    );
    
    logger.error(`❌ Webhook ${deliveryId} failed (attempt ${attemptCount}/3):`, error);
    
    if (shouldRetry) {
      scheduleRetry(deliveryId, webhookId, url, secret, eventType, eventData, attemptCount + 1);
    }
  }
}

/**
 * Create delivery record in database
 * @param {number} webhookId - Webhook ID
 * @param {string} eventType - Event type
 * @param {Object} eventData - Event data
 * @param {number} attemptCount - Attempt count
 * @returns {Promise<number>} Delivery ID
 */
async function createDeliveryRecord(webhookId, eventType, eventData, attemptCount = 1) {
  const result = await query(`
    INSERT INTO webhook_deliveries (
      webhook_id, event_type, payload, attempt_count
    ) VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [webhookId, eventType, JSON.stringify(eventData), attemptCount]);
  
  return result.rows[0].id;
}

/**
 * Mark delivery as successful
 * @param {number} deliveryId - Delivery ID
 * @param {number} responseStatus - HTTP status code
 * @param {string} responseBody - Response body
 */
async function markDeliverySuccess(deliveryId, responseStatus, responseBody) {
  await query(`
    UPDATE webhook_deliveries
    SET succeeded = true,
        response_status = $1,
        response_body = $2,
        completed_at = NOW()
    WHERE id = $3
  `, [responseStatus, responseBody.substring(0, 1000), deliveryId]);
}

/**
 * Mark delivery as failed
 * @param {number} deliveryId - Delivery ID
 * @param {number} responseStatus - HTTP status code (or null)
 * @param {string} responseBody - Response body (or null)
 * @param {string} errorMessage - Error message
 * @param {number} retryDelayMs - Retry delay in milliseconds (or null if no retry)
 */
async function markDeliveryFailed(deliveryId, responseStatus, responseBody, errorMessage, retryDelayMs) {
  const nextRetryAt = retryDelayMs ? new Date(Date.now() + retryDelayMs) : null;
  
  await query(`
    UPDATE webhook_deliveries
    SET response_status = $1,
        response_body = $2,
        error_message = $3,
        next_retry_at = $4,
        completed_at = CASE WHEN $5 IS NULL THEN NOW() ELSE NULL END
    WHERE id = $6
  `, [
    responseStatus,
    responseBody ? responseBody.substring(0, 1000) : null,
    errorMessage,
    nextRetryAt,
    retryDelayMs,
    deliveryId
  ]);
}

/**
 * Update webhook last triggered timestamp
 * @param {number} webhookId - Webhook ID
 */
async function updateWebhookLastTriggered(webhookId) {
  await query(`
    UPDATE webhooks
    SET last_triggered_at = NOW()
    WHERE id = $1
  `, [webhookId]);
}

/**
 * Schedule webhook retry
 * @param {number} deliveryId - Delivery ID
 * @param {number} webhookId - Webhook ID
 * @param {string} url - Webhook URL
 * @param {string} secret - Webhook secret
 * @param {string} eventType - Event type
 * @param {Object} eventData - Event data
 * @param {number} nextAttempt - Next attempt number
 */
function scheduleRetry(deliveryId, webhookId, url, secret, eventType, eventData, nextAttempt) {
  const delay = getRetryDelay(nextAttempt - 1);
  
  logger.info(`⏰ Scheduling webhook ${deliveryId} retry in ${delay}ms (attempt ${nextAttempt}/3)`);
  
  setTimeout(() => {
    deliverWebhook(webhookId, url, secret, eventType, eventData, nextAttempt)
      .catch(error => {
        logger.error(`Failed to retry webhook ${deliveryId}:`, error);
      });
  }, delay);
}

/**
 * Process pending retries (called on server startup)
 * Picks up any failed deliveries that need retry
 */
export async function processPendingRetries() {
  try {
    const result = await query(`
      SELECT 
        wd.id as delivery_id,
        wd.webhook_id,
        wd.event_type,
        wd.payload,
        wd.attempt_count,
        w.url,
        w.secret
      FROM webhook_deliveries wd
      JOIN webhooks w ON w.id = wd.webhook_id
      WHERE wd.succeeded = false
        AND wd.attempt_count < wd.max_attempts
        AND wd.next_retry_at <= NOW()
        AND w.is_active = true
      LIMIT 100
    `);

    if (result.rows.length === 0) {
      return;
    }

    logger.info(`🔄 Processing ${result.rows.length} pending webhook retries`);

    for (const row of result.rows) {
      const eventData = typeof row.payload === 'string' 
        ? JSON.parse(row.payload) 
        : row.payload;
      
      deliverWebhook(
        row.webhook_id,
        row.url,
        row.secret,
        row.event_type,
        eventData,
        row.attempt_count + 1
      ).catch(error => {
        logger.error(`Failed to process retry for delivery ${row.delivery_id}:`, error);
      });
    }
  } catch (error) {
    logger.error('Failed to process pending webhook retries:', error);
  }
}

/**
 * Verify webhook signature
 * @param {string} secret - Webhook secret
 * @param {Object} payload - Webhook payload
 * @param {string} signature - Provided signature
 * @returns {boolean} True if signature is valid
 */
export function verifySignature(secret, payload, signature) {
  const expectedSignature = generateSignature(secret, payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Trigger agent event webhooks for a user
 * Finds all active webhooks for the user subscribed to the event and dispatches
 * @param {string} userId - User ID
 * @param {string} eventType - Event type (e.g., 'agent.completed')
 * @param {Object} eventData - Event data
 */
export async function triggerAgentEvent(userId, eventType, eventData) {
  try {
    // Find all active webhooks for this user subscribed to this event
    const result = await query(`
      SELECT id, url, secret
      FROM webhooks
      WHERE user_id = $1
        AND is_active = true
        AND $2 = ANY(events)
    `, [userId, eventType]);

    if (result.rows.length === 0) {
      logger.debug(`No webhooks found for user ${userId} and event ${eventType}`);
      return;
    }

    logger.info(`🔔 Triggering ${result.rows.length} webhooks for ${eventType}`);

    // Dispatch to all matching webhooks
    const promises = result.rows.map(webhook =>
      triggerWebhook(webhook.id, webhook.url, webhook.secret, eventType, eventData)
    );

    await Promise.allSettled(promises);
  } catch (error) {
    logger.error(`Failed to trigger agent event ${eventType} for user ${userId}:`, error);
    throw error;
  }
}

export default {
  triggerWebhook,
  processPendingRetries,
  verifySignature,
  generateSignature
};

// Named export for backwards compatibility
export const webhookDispatcher = {
  dispatch: triggerWebhook,
  triggerAgentEvent: triggerAgentEvent,
  processPendingRetries,
  verifySignature,
  generateSignature
};
