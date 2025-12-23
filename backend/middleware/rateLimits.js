/**
 * Rate Limiting Middleware for Different API Endpoints
 * 
 * Provides specialized rate limits for:
 * - User Preferences API (frequent updates)
 * - Authentication API (brute force protection)
 * - General API endpoints
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limit (100 requests per 15 minutes)
 */
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

/**
 * Auth rate limit (stricter - 20 requests per 15 minutes)
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

/**
 * User Preferences rate limit (more lenient - 200 requests per 15 minutes)
 * Allows frequent preference updates and syncs
 */
export const preferencesLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200, // Higher limit for real-time sync
    message: {
        success: false,
        error: 'Too many preference updates, please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skip: (req) => {
        // Skip rate limiting for GET requests (reading preferences)
        return req.method === 'GET';
    }
});

/**
 * Strict rate limit for sensitive operations (10 per 15 minutes)
 * For password changes, email changes, 2FA setup, etc.
 */
export const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: 'Too many sensitive operations, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

/**
 * Trading API rate limit (300 requests per 15 minutes)
 * Higher limit for active trading
 */
export const tradingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: {
        success: false,
        error: 'Trading rate limit exceeded, please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

export default {
    generalLimiter,
    authLimiter,
    preferencesLimiter,
    strictLimiter,
    tradingLimiter
};
