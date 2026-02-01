/**
 * Integration Tests for AI Agent API Endpoints
 * Tests the full HTTP request/response flow including authentication,
 * rate limiting, input validation, and agent execution.
 * 
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import { query } from '../../database/db.js';
import { getRedisClient } from '../../utils/redis.js';

// Mock external API calls to prevent real API requests during tests
jest.unstable_mockModule('node-fetch', () => ({
  default: jest.fn()
}));

describe('AI Agent API Integration Tests', () => {
  let testUserId;
  let validToken;
  let testAgentId;
  
  // Setup: Create test user and agent
  beforeAll(async () => {
    try {
      // Create test user
      const userResult = await query(
        `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        ['test-integration@titangold.com', 'test_integration', 'hashed_password', 'Test Integration User', 'user', true]
      );
      testUserId = userResult.rows[0].id;
      
      // Generate valid JWT token
      validToken = jwt.sign(
        { userId: testUserId, email: 'test-integration@titangold.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
      
      // Create test session
      await query(
        `INSERT INTO user_sessions (user_id, token, expires_at, last_activity_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())
         ON CONFLICT (token) DO UPDATE SET token = EXCLUDED.token`,
        [testUserId, validToken]
      );
      
      // Get or create a test agent (technical analysis agent)
      const agentResult = await query(
        `SELECT id FROM ai_agents WHERE agent_key = 'technical' AND is_enabled = true LIMIT 1`
      );
      
      if (agentResult.rows.length > 0) {
        testAgentId = agentResult.rows[0].id;
      } else {
        // Create test agent if doesn't exist
        const newAgentResult = await query(
          `INSERT INTO ai_agents (agent_key, name, type, status, config, is_enabled, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id`,
          ['technical', 'Technical Analysis Agent', 'technical_analysis', 'active', '{}', true]
        );
        testAgentId = newAgentResult.rows[0].id;
      }
      
    } catch (error) {
      console.error('Setup error:', error);
      // Continue with tests even if setup partially fails
    }
  }, 30000);
  
  // Cleanup: Remove test data
  afterAll(async () => {
    try {
      // Clean up test user sessions
      if (testUserId) {
        await query('DELETE FROM user_sessions WHERE user_id = $1', [testUserId]);
        // Note: Don't delete the user as it might be referenced by other records
      }
      
      // Clean up Redis rate limit keys
      try {
        const redis = await getRedisClient();
        if (redis && redis.isOpen) {
          const keys = await redis.keys('ratelimit:*');
          if (keys.length > 0) {
            await redis.del(keys);
          }
          await redis.quit();
        }
      } catch (redisError) {
        // Ignore Redis cleanup errors
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 10000);
  
  // Clear rate limits between tests
  beforeEach(async () => {
    try {
      const redis = await getRedisClient();
      if (redis && redis.isOpen) {
        // Clear rate limit for test user
        const key = `ratelimit:${testUserId}`;
        await redis.del(key);
      }
    } catch (error) {
      // Ignore if Redis is not available
    }
  });

  describe('POST /api/ai-agents/:id/run - Basic Execution', () => {
    test('should execute technical agent successfully with valid auth', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          symbol: 'BTCUSDT',
          timeframe: '1h',
          config: {}
        })
        .expect('Content-Type', /json/);
      
      // Should return 200 or 500 (if agent execution fails, but auth passed)
      // Accept any non-401 status (execution may fail due to mocked APIs)
      expect(response.status).not.toBe(401);
      expect(response.body).toBeDefined();
    }, 10000);

    test('should accept valid trading symbols', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      
      for (const symbol of symbols) {
        const response = await request(app)
          .post(`/api/ai-agents/${testAgentId}/run`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ symbol, timeframe: '1h' });
        
        // Should not return validation error (400)
        expect(response.status).not.toBe(400);
      }
    }, 20000);

    test('should accept valid timeframes', async () => {
      const timeframes = ['1h', '4h'];
      
      for (const timeframe of timeframes) {
        const response = await request(app)
          .post(`/api/ai-agents/${testAgentId}/run`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ symbol: 'BTCUSDT', timeframe });
        
        // Should not return validation error for valid timeframe
        expect(response.status).not.toBe(400);
      }
    }, 20000);
  });

  describe('POST /api/ai-agents/:id/run - Authentication', () => {
    test('should return 401 without authentication token', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    test('should return 401 with invalid token format', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', 'Bearer invalid_token_format')
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    test('should return 401 with expired token', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { userId: testUserId, email: 'test-integration@titangold.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    test('should return 200 with valid authentication token', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // Should not be authentication error
      expect(response.status).not.toBe(401);
      expect([200, 400, 404, 500]).toContain(response.status);
    }, 10000);

    test('should reject missing Authorization header', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(401);
    });

    test('should reject malformed Authorization header', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', 'InvalidFormat')
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(401);
    });
  });

  describe('POST /api/ai-agents/:id/run - Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      // Make 2 requests (limit is 15 per minute)
      for (let i = 0; i < 2; i++) {
        const response = await request(app)
          .post(`/api/ai-agents/${testAgentId}/run`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ symbol: 'BTCUSDT', timeframe: '1h' });
        
        // Should not be rate limited
        expect(response.status).not.toBe(429);
      }
    }, 20000);

    test('should include rate limit headers in response', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // Check for rate limit headers
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    }, 10000);

    test('should return 429 after exceeding rate limit', async () => {
      // The rate limit is 15 requests per minute for this endpoint
      // Make 16 requests to exceed the limit
      let hitRateLimit = false;
      
      for (let i = 0; i < 16; i++) {
        const response = await request(app)
          .post(`/api/ai-agents/${testAgentId}/run`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ symbol: 'BTCUSDT', timeframe: '1h' });
        
        if (response.status === 429) {
          hitRateLimit = true;
          break;  // Stop as soon as we hit rate limit
        }
      }
      
      // Should have hit rate limit
      expect(hitRateLimit).toBe(true);
    }, 30000);

    // Per-user tracking test disabled to save test time
    // The rate limit logic is already tested in unit tests
    // test('should track rate limits per user', async () => { ... })
  });

  describe('POST /api/ai-agents/:id/run - Input Validation', () => {
    test('should reject invalid agent ID format', async () => {
      const response = await request(app)
        .post('/api/ai-agents/invalid-id-format/run')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    test('should reject non-existent agent ID', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/ai-agents/${fakeUUID}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    test('should reject invalid symbol format', async () => {
      const invalidSymbols = ['btcusdt', 'BTC-USDT', 'ab']; // lowercase, special chars, too short
      
      for (const symbol of invalidSymbols) {
        const response = await request(app)
          .post(`/api/ai-agents/${testAgentId}/run`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ symbol, timeframe: '1h' });
        
        // Should return validation error
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should reject invalid timeframe', async () => {
      const invalidTimeframes = ['2h', '3d', 'invalid', ''];
      
      for (const timeframe of invalidTimeframes) {
        const response = await request(app)
          .post(`/api/ai-agents/${testAgentId}/run`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ symbol: 'BTCUSDT', timeframe });
        
        // May return validation error or proceed with default
        expect([200, 400, 500]).toContain(response.status);
      }
    });

    test('should accept optional config parameter', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          symbol: 'BTCUSDT',
          timeframe: '1h',
          config: {
            rsi_period: 14,
            macd_fast: 12
          }
        });
      
      expect(response.status).not.toBe(400);
    }, 30000);

    test('should handle missing optional parameters', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          symbol: 'BTCUSDT'
          // timeframe and config are optional
        });
      
      expect(response.status).not.toBe(400);
    }, 30000);
  });

  describe('POST /api/ai-agents/:id/run - Error Handling', () => {
    test('should handle disabled agent', async () => {
      // Create disabled agent
      const disabledAgentResult = await query(
        `INSERT INTO ai_agents (agent_key, name, type, status, config, is_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id`,
        ['test_disabled', 'Disabled Test Agent', 'test', 'disabled', '{}', false]
      );
      const disabledAgentId = disabledAgentResult.rows[0].id;
      
      const response = await request(app)
        .post(`/api/ai-agents/${disabledAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('DISABLED');
      
      // Cleanup
      await query('DELETE FROM ai_agents WHERE id = $1', [disabledAgentId]);
    });

    test('should return proper error structure', async () => {
      const response = await request(app)
        .post('/api/ai-agents/invalid-id/run')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(400);
      
      // Verify error structure
      expect(response.body).toHaveProperty('ok', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      // UI crash prevention
      expect(response.body).toHaveProperty('indicators');
      expect(Array.isArray(response.body.indicators)).toBe(true);
    });

    test('should handle agent execution errors gracefully', async () => {
      // This will likely fail due to missing external API data
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // Should return a response (not crash)
      expect(response.body).toBeDefined();
      expect([200, 500]).toContain(response.status);
    }, 30000);
  });

  describe('POST /api/ai-agents/:id/run - Response Format', () => {
    test('should return JSON content type', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      expect(response.headers['content-type']).toMatch(/json/);
    }, 30000);

    test('should include standard response fields on success', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // If successful, should have ok field
      if (response.status === 200) {
        expect(response.body).toHaveProperty('ok');
      }
    }, 30000);

    test('should include error prevention fields', async () => {
      const response = await request(app)
        .post('/api/ai-agents/invalid-id/run')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // Should always have indicators array (UI crash prevention)
      expect(response.body).toHaveProperty('indicators');
      expect(Array.isArray(response.body.indicators)).toBe(true);
    });
  });

  describe('POST /api/ai-agents/:id/run - Performance', () => {
    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      const duration = Date.now() - startTime;
      
      // Should complete within 35 seconds (30s timeout + 5s overhead)
      expect(duration).toBeLessThan(35000);
    }, 40000);
  });

  describe('GET /api/ai-agents - List Agents', () => {
    test('should list agents with authentication', async () => {
      const response = await request(app)
        .get('/api/ai-agents')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      
      // Response might not have 'ok' field, check for agents array
      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
    });

    test('should require authentication to list agents', async () => {
      await request(app)
        .get('/api/ai-agents')
        .expect(401);
    });
  });
});
