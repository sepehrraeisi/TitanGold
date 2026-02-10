import rateLimit from 'express-rate-limit';
import { logger } from '../services/logger.js';

/**
 * Rate Limiting Middleware
 * TASK-BE-009: Add rate limiting
 * 
 * Protects endpoints from abuse by limiting request rates per user
 */

// Custom key generator to use user ID from authentication
const keyGenerator = (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || req.ip;
};

// Custom handler for rate limit exceeded
const handler = (req, res) => {
    logger.warn('Rate limit exceeded', {
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        method: req.method
    });

    res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: res.getHeader('Retry-After')
    });
};

// Skip failed requests (don't count them against the limit)
const skipFailedRequests = true;

// Skip successful requests (only count failed ones)
const skipSuccessfulRequests = false;

/**
 * Rate limiter for POST/PUT endpoints
 * Limit: 10 requests per minute per user
 */
export const writeRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per window
    message: 'Too many write requests. Please try again later.',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    keyGenerator,
    handler,
    skipFailedRequests,
    skipSuccessfulRequests,
    skip: () => process.env.NODE_ENV === 'test',
    // Store in memory (for production, consider Redis)
    store: undefined // Uses default MemoryStore
});

/**
 * Rate limiter for GET endpoints
 * Limit: 100 requests per minute per user
 */
export const readRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per window
    message: 'Too many read requests. Please try again later.',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    keyGenerator,
    handler,
    skipFailedRequests,
    skipSuccessfulRequests,
    skip: () => process.env.NODE_ENV === 'test',
    store: undefined // Uses default MemoryStore
});

/**
 * Stricter rate limiter for sensitive operations
 * Limit: 5 requests per minute per user
 */
export const strictRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per window
    message: 'Too many requests for this sensitive operation. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler,
    skipFailedRequests,
    skipSuccessfulRequests,
    skip: () => process.env.NODE_ENV === 'test',
    store: undefined
});
