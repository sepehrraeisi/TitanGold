import { jest } from '@jest/globals';
import { rateLimit } from '../../middleware/rateLimit.js';
import { getRedisClient, isRedisAvailable } from '../../utils/redis.js';

describe('Rate Limiter Integration Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: { id: `test-user-${Date.now()}` },
      ip: '127.0.0.1'
    };
    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(() => mockRes),
      setHeader: jest.fn()
    };
    mockNext = jest.fn();
  });

  afterAll(async () => {
    // Clean up Redis connection
    try {
      const client = await getRedisClient();
      if (client && client.isOpen) {
        await client.quit();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should use Redis when available', async () => {
    const middleware = rateLimit({ limit: 10, windowMs: 60000 });
    
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  }, 10000);

  test('should respect rate limits', async () => {
    const limit = 3;
    const middleware = rateLimit({ limit, windowMs: 60000 });
    
    // Make requests up to limit
    for (let i = 0; i < limit; i++) {
      mockNext.mockClear();
      mockRes.status.mockClear();
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    }
    
    // Next request should be blocked
    mockNext.mockClear();
    mockRes.status.mockClear();
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(429);
  }, 10000);

  test('should track different users separately', async () => {
    const middleware = rateLimit({ limit: 2, windowMs: 60000 });
    
    const user1Req = { ...mockReq, user: { id: `user1-${Date.now()}` } };
    const user2Req = { ...mockReq, user: { id: `user2-${Date.now()}` } };
    
    // User 1 makes 2 requests
    await middleware(user1Req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    
    mockNext.mockClear();
    await middleware(user1Req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    
    // User 2 should still be able to make requests
    mockNext.mockClear();
    await middleware(user2Req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  }, 10000);

  test('should respect environment variables', async () => {
    process.env.RATE_LIMIT_MAX = '20';
    process.env.RATE_LIMIT_WINDOW_MS = '120000';
    
    const middleware = rateLimit({ limit: 10, windowMs: 60000 });
    
    await middleware(mockReq, mockRes, mockNext);
    
    // Should use env var value (20) instead of passed value (10)
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 20);
    
    // Clean up
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  }, 10000);
});
