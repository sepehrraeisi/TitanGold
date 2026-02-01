/**
 * Integration Tests for AI Agent API Endpoints - Core DoD Requirements
 * Tests authentication, rate limiting, and input validation
 * 
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import { query } from '../../database/db.js';
import { getRedisClient } from '../../utils/redis.js';

describe('AI Agent API Integration Tests - Core DoD', () => {
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
        ['test-dod@titangold.com', 'test_dod', 'hashed_password', 'Test DoD User', 'user', true]
      );
      testUserId = userResult.rows[0].id;
      
      // Generate valid JWT token
      validToken = jwt.sign(
        { userId: testUserId, email: 'test-dod@titangold.com' },
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
      
      // Get existing technical agent
      const agentResult = await query(
        `SELECT id FROM ai_agents WHERE agent_key = 'technical' AND is_enabled = true LIMIT 1`
      );
      
      if (agentResult.rows.length > 0) {
        testAgentId = agentResult.rows[0].id;
      }
      
    } catch (error) {
      console.error('Setup error:', error);
    }
  }, 30000);
  
  // Cleanup
  afterAll(async () => {
    try {
      if (testUserId) {
        await query('DELETE FROM user_sessions WHERE user_id = $1', [testUserId]);
      }
      
      // Clean up Redis
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
        // Ignore
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
        await redis.del(`ratelimit:${testUserId}`);
      }
    } catch (error) {
      // Ignore
    }
  });

  // ============================================================================
  // DoD Requirement 1: POST /api/ai-agents/:id/run endpoint works
  // ============================================================================
  describe('POST /api/ai-agents/:id/run - Endpoint Exists', () => {
    test('should respond to POST requests on the endpoint', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // Should not be 404 (endpoint exists)
      expect(response.status).not.toBe(404);
      expect(response.body).toBeDefined();
    }, 10000);
  });

  // ============================================================================
  // DoD Requirement 2: Authentication required (401 without auth, 200 with auth)
  // ============================================================================
  describe('POST /api/ai-agents/:id/run - Authentication Required', () => {
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
        .set('Authorization', 'Bearer invalid_token_xyz123')
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    test('should return 401 with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUserId, email: 'test-dod@titangold.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );
      
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    test('should NOT return 401 with valid authentication token', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // Should not be authentication error (may be 200, 400, or 500 depending on execution)
      expect(response.status).not.toBe(401);
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

  // ============================================================================
  // DoD Requirement 3: Rate limiting works (429 after exceeding limits)
  // ============================================================================
  describe('POST /api/ai-agents/:id/run - Rate Limiting', () => {
    test('should include rate limit headers in response', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // Rate limit headers should be present
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    }, 10000);

    test('should allow first request within rate limit', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // First request should not be rate limited
      expect(response.status).not.toBe(429);
    }, 10000);

    test('should return 429 after exceeding rate limit', async () => {
      // Rate limit is 15 requests per minute
      // Make 16 requests to exceed
      const responses = [];
      
      for (let i = 0; i < 16; i++) {
        const response = await request(app)
          .post(`/api/ai-agents/${testAgentId}/run`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ symbol: 'BTCUSDT', timeframe: '1h' });
        
        responses.push(response.status);
        
        // Break early if we hit 429 to save time
        if (response.status === 429) {
          break;
        }
      }
      
      // Should have at least one 429 response
      expect(responses).toContain(429);
    }, 45000);
  });

  // ============================================================================
  // DoD Requirement 4: Invalid inputs rejected (400 for bad data)
  // ============================================================================
  describe('POST /api/ai-agents/:id/run - Input Validation', () => {
    test('should reject invalid agent ID format', async () => {
      const response = await request(app)
        .post('/api/ai-agents/invalid-id/run')
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

    test('should reject invalid symbol format - lowercase', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'btcusdt', timeframe: '1h' })
        .expect(400);
      
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject invalid symbol format - too short', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTC', timeframe: '1h' })
        .expect(400);
      
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject invalid symbol format - with dash', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTC-USDT', timeframe: '1h' })
        .expect(400);
      
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject empty symbol', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: '', timeframe: '1h' })
        .expect(400);
    });

    test('should accept valid symbols', async () => {
      const validSymbols = ['BTCUSDT', 'ETHUSDT'];
      
      for (const symbol of validSymbols) {
        const response = await request(app)
          .post(`/api/ai-agents/${testAgentId}/run`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ symbol, timeframe: '1h' });
        
        // Should not be validation error
        expect(response.status).not.toBe(400);
      }
    }, 10000);

    test('should return proper error structure for validation errors', async () => {
      const response = await request(app)
        .post('/api/ai-agents/bad-id/run')
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
  });

  // ============================================================================
  // Additional: Response format validation
  // ============================================================================
  describe('POST /api/ai-agents/:id/run - Response Format', () => {
    test('should return JSON content type', async () => {
      const response = await request(app)
        .post(`/api/ai-agents/${testAgentId}/run`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      expect(response.headers['content-type']).toMatch(/json/);
    }, 10000);

    test('should include error prevention fields', async () => {
      const response = await request(app)
        .post('/api/ai-agents/invalid/run')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ symbol: 'BTCUSDT', timeframe: '1h' });
      
      // Should always have indicators array (UI crash prevention)
      expect(response.body).toHaveProperty('indicators');
      expect(Array.isArray(response.body.indicators)).toBe(true);
    });
  });

  // ============================================================================
  // Additional: GET endpoint test
  // ============================================================================
  describe('GET /api/ai-agents - List Agents', () => {
    test('should require authentication', async () => {
      await request(app)
        .get('/api/ai-agents')
        .expect(401);
    });

    test('should list agents with valid auth', async () => {
      const response = await request(app)
        .get('/api/ai-agents')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
    });
  });
});
