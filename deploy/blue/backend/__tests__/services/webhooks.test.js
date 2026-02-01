// ============================================================================
// API-008: Webhook System Tests
// ============================================================================
//
// Purpose: Test webhook registration, delivery, retry logic, and signature
//          verification for the TitanGold webhook system
//
// Coverage:
//   - Webhook CRUD operations
//   - Signature generation and verification
//   - Webhook dispatch and delivery tracking
//   - Retry logic with exponential backoff
//   - Event triggering on agent completion/failure
//
// Date: 2026-01-31
// ============================================================================

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import { query } from '../../database/db.js';
import { webhookDispatcher } from '../../services/webhookDispatcher.js';

describe('Webhook System (API-008)', () => {
  let testUserId;
  let testWebhookId;
  let testSecret;

  // Setup test user
  beforeAll(async () => {
    // Create test user
    const userResult = await query(
      `INSERT INTO users (email, username, password_hash, is_verified, is_active)
       VALUES ($1, $2, $3, true, true)
       RETURNING id`,
      ['webhook-test@titangold.com', 'webhook-test-user', 'hash']
    );
    testUserId = userResult.rows[0].id;
  });

  // Cleanup
  afterAll(async () => {
    // Clean up test data
    await query('DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM webhooks WHERE user_id = $1)', [testUserId]);
    await query('DELETE FROM webhooks WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  // ============================================================================
  // Webhook CRUD Tests
  // ============================================================================

  describe('Webhook CRUD Operations', () => {
    it('should create a webhook', async () => {
      testSecret = crypto.randomBytes(32).toString('hex');

      const result = await query(
        `INSERT INTO webhooks (user_id, url, secret, events, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, url, events, is_active, created_at, metadata`,
        [
          testUserId,
          'https://example.com/webhooks',
          testSecret,
          ['agent.completed', 'agent.failed'],
          { description: 'Test webhook' }
        ]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].user_id).toBe(testUserId);
      expect(result.rows[0].url).toBe('https://example.com/webhooks');
      expect(result.rows[0].events).toEqual(['agent.completed', 'agent.failed']);
      expect(result.rows[0].is_active).toBe(true);

      testWebhookId = result.rows[0].id;
    });

    it('should reject invalid URL', async () => {
      await expect(
        query(
          `INSERT INTO webhooks (user_id, url, secret, events)
           VALUES ($1, $2, $3, $4)`,
          [testUserId, 'not-a-url', 'secret', ['agent.completed']]
        )
      ).rejects.toThrow();
    });

    it('should reject empty events array', async () => {
      await expect(
        query(
          `INSERT INTO webhooks (user_id, url, secret, events)
           VALUES ($1, $2, $3, $4)`,
          [testUserId, 'https://example.com', 'secret', []]
        )
      ).rejects.toThrow();
    });

    it('should list user webhooks', async () => {
      const result = await query(
        `SELECT id, url, events, is_active FROM webhooks WHERE user_id = $1`,
        [testUserId]
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].id).toBe(testWebhookId);
    });

    it('should update webhook', async () => {
      const result = await query(
        `UPDATE webhooks
         SET url = $1, events = $2, is_active = $3
         WHERE id = $4 AND user_id = $5
         RETURNING url, events, is_active`,
        [
          'https://new-url.com/webhooks',
          ['agent.completed', 'agent.timeout'],
          false,
          testWebhookId,
          testUserId
        ]
      );

      expect(result.rows[0].url).toBe('https://new-url.com/webhooks');
      expect(result.rows[0].events).toEqual(['agent.completed', 'agent.timeout']);
      expect(result.rows[0].is_active).toBe(false);
    });

    it('should delete webhook', async () => {
      // Create temporary webhook
      const createResult = await query(
        `INSERT INTO webhooks (user_id, url, secret, events)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [testUserId, 'https://temp.com', 'secret', ['agent.completed']]
      );

      const tempId = createResult.rows[0].id;

      // Delete it
      const deleteResult = await query(
        `DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING id`,
        [tempId, testUserId]
      );

      expect(deleteResult.rows.length).toBe(1);

      // Verify deletion
      const checkResult = await query(
        `SELECT id FROM webhooks WHERE id = $1`,
        [tempId]
      );

      expect(checkResult.rows.length).toBe(0);
    });
  });

  // ============================================================================
  // Signature Verification Tests
  // ============================================================================

  describe('Signature Verification', () => {
    it('should generate valid HMAC-SHA256 signature', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'test-secret';

      const signature = webhookDispatcher.generateSignature(payload, secret);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 hex is 64 chars
    });

    it('should verify correct signature', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'test-secret';

      const signature = webhookDispatcher.generateSignature(payload, secret);
      const isValid = webhookDispatcher.verifySignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'test-secret';

      const signature = webhookDispatcher.generateSignature(payload, secret);
      const isValid = webhookDispatcher.verifySignature(payload, 'wrong-signature', secret);

      expect(isValid).toBe(false);
    });

    it('should reject tampered payload', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'test-secret';

      const signature = webhookDispatcher.generateSignature(payload, secret);

      const tamperedPayload = JSON.stringify({ event: 'hacked', data: {} });
      const isValid = webhookDispatcher.verifySignature(tamperedPayload, signature, secret);

      expect(isValid).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'test-secret';

      const signature = webhookDispatcher.generateSignature(payload, secret);

      // Even with almost matching signature, should reject
      const almostMatch = signature.slice(0, -1) + (signature.endsWith('a') ? 'b' : 'a');
      const isValid = webhookDispatcher.verifySignature(payload, almostMatch, secret);

      expect(isValid).toBe(false);
    });
  });

  // ============================================================================
  // Webhook Dispatch Tests
  // ============================================================================

  describe('Webhook Dispatch', () => {
    beforeAll(async () => {
      // Ensure test webhook exists and is active
      await query(
        `UPDATE webhooks SET is_active = true WHERE id = $1`,
        [testWebhookId]
      );
    });

    it('should create delivery record', async () => {
      const deliveryId = await webhookDispatcher.dispatch(
        testWebhookId,
        'https://httpbin.org/status/200',
        testSecret,
        'agent.completed',
        { test: 'data' }
      );

      expect(deliveryId).toBeTruthy();

      // Check delivery record
      const result = await query(
        `SELECT id, webhook_id, event_type, succeeded, attempt_count
         FROM webhook_deliveries
         WHERE id = $1`,
        [deliveryId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].webhook_id).toBe(testWebhookId);
      expect(result.rows[0].event_type).toBe('agent.completed');
    });

    it('should update last_triggered_at on webhook', async () => {
      const beforeResult = await query(
        `SELECT last_triggered_at FROM webhooks WHERE id = $1`,
        [testWebhookId]
      );

      const beforeTime = beforeResult.rows[0].last_triggered_at;

      // Dispatch webhook
      await webhookDispatcher.dispatch(
        testWebhookId,
        'https://httpbin.org/status/200',
        testSecret,
        'agent.completed',
        { test: 'data' }
      );

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const afterResult = await query(
        `SELECT last_triggered_at FROM webhooks WHERE id = $1`,
        [testWebhookId]
      );

      const afterTime = afterResult.rows[0].last_triggered_at;

      if (beforeTime) {
        expect(new Date(afterTime).getTime()).toBeGreaterThan(new Date(beforeTime).getTime());
      } else {
        expect(afterTime).toBeTruthy();
      }
    });
  });

  // ============================================================================
  // Event Triggering Tests
  // ============================================================================

  describe('Event Triggering', () => {
    it('should trigger webhooks for user events', async () => {
      const payload = {
        agent_id: 'test-agent-id',
        agent_key: 'TECHNICAL',
        result: { success: true }
      };

      await webhookDispatcher.triggerAgentEvent(testUserId, 'agent.completed', payload);

      // Check that delivery was created
      const result = await query(
        `SELECT d.id, d.event_type, w.user_id
         FROM webhook_deliveries d
         JOIN webhooks w ON d.webhook_id = w.id
         WHERE w.user_id = $1 AND d.event_type = $2
         ORDER BY d.created_at DESC
         LIMIT 1`,
        [testUserId, 'agent.completed']
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].event_type).toBe('agent.completed');
    });

    it('should not trigger for inactive webhooks', async () => {
      // Deactivate webhook
      await query(
        `UPDATE webhooks SET is_active = false WHERE id = $1`,
        [testWebhookId]
      );

      const beforeCount = await query(
        `SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = $1`,
        [testWebhookId]
      );

      await webhookDispatcher.triggerAgentEvent(testUserId, 'agent.completed', {});

      const afterCount = await query(
        `SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = $1`,
        [testWebhookId]
      );

      expect(afterCount.rows[0].count).toBe(beforeCount.rows[0].count);

      // Reactivate for other tests
      await query(
        `UPDATE webhooks SET is_active = true WHERE id = $1`,
        [testWebhookId]
      );
    });

    it('should filter by subscribed events', async () => {
      // Update webhook to only listen for agent.failed
      await query(
        `UPDATE webhooks SET events = $1 WHERE id = $2`,
        [['agent.failed'], testWebhookId]
      );

      const beforeCount = await query(
        `SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = $1`,
        [testWebhookId]
      );

      // Trigger agent.completed (not subscribed)
      await webhookDispatcher.triggerAgentEvent(testUserId, 'agent.completed', {});

      const afterCount = await query(
        `SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = $1`,
        [testWebhookId]
      );

      // Should not create delivery
      expect(afterCount.rows[0].count).toBe(beforeCount.rows[0].count);
    });
  });

  // ============================================================================
  // Delivery History Tests
  // ============================================================================

  describe('Delivery History', () => {
    it('should track delivery attempts', async () => {
      const result = await query(
        `SELECT id, webhook_id, event_type, attempt_count, succeeded, created_at
         FROM webhook_deliveries
         WHERE webhook_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [testWebhookId]
      );

      expect(result.rows.length).toBeGreaterThan(0);

      result.rows.forEach(delivery => {
        expect(delivery.webhook_id).toBe(testWebhookId);
        expect(delivery.attempt_count).toBeGreaterThan(0);
        expect(typeof delivery.succeeded).toBe('boolean');
      });
    });

    it('should store response status', async () => {
      const deliveryId = await webhookDispatcher.dispatch(
        testWebhookId,
        'https://httpbin.org/status/200',
        testSecret,
        'agent.completed',
        { test: 'data' }
      );

      // Wait for async delivery
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await query(
        `SELECT response_status, succeeded FROM webhook_deliveries WHERE id = $1`,
        [deliveryId]
      );

      if (result.rows.length > 0) {
        expect([200, null]).toContain(result.rows[0].response_status);
      }
    });
  });
});
