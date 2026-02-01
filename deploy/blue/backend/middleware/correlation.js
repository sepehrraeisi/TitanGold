// ============================================================================
// Correlation Middleware - BACKEND-019
// ============================================================================
// 
// Provides request correlation ID tracking across the application.
// Generates or accepts X-Request-ID header for end-to-end request tracing.
//
// Features:
// - Generates unique correlation ID for each request
// - Accepts existing X-Request-ID from clients (e.g., from frontend)
// - Propagates correlation ID to response headers
// - Attaches correlation ID to req object for use in handlers
// - Provides request-scoped logger with automatic ID inclusion
//
// ============================================================================

import { randomUUID } from 'crypto';
import { logger } from '../services/logger.js';

/**
 * Generate or extract correlation ID from request
 * @param {Object} req - Express request object
 * @returns {string} Correlation ID
 */
function getOrCreateCorrelationId(req) {
  // Priority order:
  // 1. x-request-id (standard header)
  // 2. x-correlation-id (alternative header)
  // 3. Generate new UUID
  return (
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    randomUUID()
  );
}

/**
 * Correlation middleware - tracks requests across the application
 * 
 * Attaches:
 * - req.correlationId: The correlation ID string
 * - req.requestId: Alias for correlationId (backward compatibility)
 * - req.log: Request-scoped logger with automatic correlation ID
 * - res header: X-Request-ID for client tracking
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function correlationMiddleware(req, res, next) {
  // Get or generate correlation ID
  const correlationId = getOrCreateCorrelationId(req);
  
  // Attach to request object
  req.correlationId = correlationId;
  req.requestId = correlationId; // Backward compatibility
  
  // Create request-scoped logger with correlation context
  req.log = createRequestLogger(req, correlationId);
  
  // Set response header for client tracking
  res.setHeader('X-Request-ID', correlationId);
  
  // Log request initiation
  req.log.info('request_initiated', {
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  });
  
  next();
}

/**
 * Create request-scoped logger with correlation ID
 * @param {Object} req - Express request
 * @param {string} correlationId - Correlation ID
 * @returns {Object} Logger instance with correlation context
 */
function createRequestLogger(req, correlationId) {
  const baseContext = {
    correlationId,
    requestId: correlationId, // Backward compatibility
    method: req.method,
    path: req.path
  };
  
  return {
    info: (message, meta = {}) => {
      logger.info(message, { ...baseContext, ...meta });
    },
    warn: (message, meta = {}) => {
      logger.warn(message, { ...baseContext, ...meta });
    },
    error: (message, meta = {}) => {
      logger.error(message, { ...baseContext, ...meta });
    },
    debug: (message, meta = {}) => {
      logger.debug(message, { ...baseContext, ...meta });
    }
  };
}

/**
 * Performance tracking middleware - logs request completion
 * Measures response time and logs metrics with correlation ID
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function performanceTrackingMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  
  // Log when response is finished
  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(durationNs) / 1e6;
    
    const logData = {
      correlationId: req.correlationId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 1000) / 1000, // 3 decimal places
      userAgent: req.headers['user-agent']
    };
    
    // Use appropriate log level based on status code
    if (res.statusCode >= 500) {
      req.log.error('request_completed', logData);
    } else if (res.statusCode >= 400) {
      req.log.warn('request_completed', logData);
    } else {
      req.log.info('request_completed', logData);
    }
    
    // Add response time header (if not already sent)
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    }
  });
  
  next();
}

/**
 * Error handling middleware with correlation ID
 * Logs errors with correlation ID for tracing
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function correlationErrorHandler(err, req, res, next) {
  const correlationId = req.correlationId || 'unknown';
  
  // Log error with correlation ID
  logger.error('request_error', {
    correlationId,
    requestId: correlationId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    status: err.status || 500
  });
  
  // Ensure correlation ID is in response
  if (!res.headersSent) {
    res.setHeader('X-Request-ID', correlationId);
  }
  
  // Pass to next error handler
  next(err);
}

/**
 * Utility: Get correlation ID from request
 * Safe accessor that returns 'unknown' if not present
 * 
 * @param {Object} req - Express request
 * @returns {string} Correlation ID or 'unknown'
 */
export function getCorrelationId(req) {
  return req.correlationId || req.requestId || 'unknown';
}

/**
 * Utility: Create logger with correlation ID
 * For use outside of request context (e.g., background jobs)
 * 
 * @param {string} correlationId - Correlation ID
 * @param {Object} additionalContext - Additional context to include
 * @returns {Object} Logger instance with correlation context
 */
export function createCorrelatedLogger(correlationId, additionalContext = {}) {
  const baseContext = {
    correlationId,
    requestId: correlationId,
    ...additionalContext
  };
  
  return {
    info: (message, meta = {}) => {
      logger.info(message, { ...baseContext, ...meta });
    },
    warn: (message, meta = {}) => {
      logger.warn(message, { ...baseContext, ...meta });
    },
    error: (message, meta = {}) => {
      logger.error(message, { ...baseContext, ...meta });
    },
    debug: (message, meta = {}) => {
      logger.debug(message, { ...baseContext, ...meta });
    }
  };
}

/**
 * Express middleware wrapper to add correlation ID to async route handlers
 * Use this to wrap route handlers that need correlation tracking
 * 
 * @param {Function} handler - Async route handler
 * @returns {Function} Wrapped handler with correlation tracking
 */
export function withCorrelation(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      // Ensure error has correlation ID
      error.correlationId = req.correlationId;
      next(error);
    }
  };
}

export default {
  correlationMiddleware,
  performanceTrackingMiddleware,
  correlationErrorHandler,
  getCorrelationId,
  createCorrelatedLogger,
  withCorrelation
};
