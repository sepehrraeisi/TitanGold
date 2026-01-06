import { getRedisClient } from '../utils/redis.js';

/**
 * Redis-backed Rate Limiter Middleware
 * Supports multiple instances with shared state
 * 
 * @param {Object} options - Rate limit configuration
 * @param {number} options.limit - Max requests per window
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {Function} Express middleware
 */
export function rateLimit({ limit, windowMs }) {
  // Configurable via environment variables
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || limit, 10);
  const windowSeconds = Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS || windowMs, 10)) / 1000);

  return async (req, res, next) => {
    try {
      const redis = await getRedisClient();
      
      // Generate rate limit key (per-user or per-IP)
      const identifier = req.user?.id || req.ip || 'anonymous';
      const key = `ratelimit:${identifier}`;
      
      const now = Date.now();
      const windowStart = Math.floor(now / 1000) - windowSeconds;
      
      // Use Redis sorted set for sliding window
      // Score = timestamp, Value = request ID
      const requestId = `${now}:${Math.random()}`;
      
      // Start pipeline for atomic operations
      const pipeline = redis.multi();
      
      // 1. Remove old requests outside the window
      pipeline.zRemRangeByScore(key, 0, windowStart);
      
      // 2. Add current request
      pipeline.zAdd(key, { score: Math.floor(now / 1000), value: requestId });
      
      // 3. Count requests in current window
      pipeline.zCard(key);
      
      // 4. Set expiration (window + buffer)
      pipeline.expire(key, windowSeconds + 10);
      
      // Execute pipeline
      const results = await pipeline.exec();
      
      // results[2] contains the count (zCard result)
      const currentCount = results[2];
      
      // Calculate rate limit headers
      const remaining = Math.max(0, maxRequests - currentCount);
      const resetTime = Math.ceil(now / 1000) + windowSeconds;
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);
      
      // Check if limit exceeded
      if (currentCount > maxRequests) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Rate limit exceeded. Max ${maxRequests} requests per ${windowSeconds}s`,
            details: {
              limit: maxRequests,
              windowSeconds,
              resetAt: new Date(resetTime * 1000).toISOString()
            }
          },
          indicators: [],
          result: { indicators: [] }
        });
      }
      
      next();
    } catch (error) {
      console.error('❌ Rate limiter error:', error.message);
      
      // Fail open: allow request if Redis is down
      console.warn('⚠️  Rate limiter failed, allowing request (fail-open)');
      next();
    }
  };
}

/**
 * In-Memory Rate Limiter (Fallback)
 * Used when Redis is unavailable
 * 
 * @param {Object} options - Rate limit configuration
 * @param {number} options.limit - Max requests per window
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {Function} Express middleware
 */
const rateLimitStore = new Map();

export function rateLimitInMemory({ limit, windowMs }) {
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      
      // Set headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', limit - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      
      return next();
    }
    
    const record = rateLimitStore.get(key);
    
    if (now > record.resetAt) {
      // Reset window
      record.count = 1;
      record.resetAt = now + windowMs;
      
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', limit - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
      
      return next();
    }
    
    const remaining = Math.max(0, limit - record.count);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
    
    if (record.count >= limit) {
      return res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Max ${limit} requests per ${windowMs / 1000}s`,
          details: {
            limit,
            windowMs,
            resetAt: new Date(record.resetAt).toISOString()
          }
        },
        indicators: [],
        result: { indicators: [] }
      });
    }
    
    record.count++;
    next();
  };
}

export default {
  rateLimit,
  rateLimitInMemory
};
