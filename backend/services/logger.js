import { randomUUID } from 'crypto';

/**
 * Simple structured logger with request correlation.
 * Uses console.* so it works in all environments, but outputs JSON for easy parsing.
 */
const baseLog = (level, message, meta = {}) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  // Avoid circular structures in meta
  try {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](JSON.stringify(payload));
  } catch (e) {
    console.log(`[logger-fallback] ${level}: ${message}`);
  }
};

export const logger = {
  info: (message, meta) => baseLog('info', message, meta),
  warn: (message, meta) => baseLog('warn', message, meta),
  error: (message, meta) => baseLog('error', message, meta),
  debug: (message, meta) => baseLog('debug', message, meta),
};

/**
 * Middleware: attach requestId to each request and expose logger with context.
 */
export function requestContextMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.requestId = requestId;

  req.log = {
    info: (msg, meta) => logger.info(msg, { requestId, path: req.path, method: req.method, ...meta }),
    warn: (msg, meta) => logger.warn(msg, { requestId, path: req.path, method: req.method, ...meta }),
    error: (msg, meta) => logger.error(msg, { requestId, path: req.path, method: req.method, ...meta }),
    debug: (msg, meta) => logger.debug(msg, { requestId, path: req.path, method: req.method, ...meta }),
  };

  res.setHeader('x-request-id', requestId);
  next();
}

/**
 * Middleware: measure response time and log basic metrics.
 */
export function performanceMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const method = req.method;
    const path = req.originalUrl || req.url;
    const requestId = req.requestId;

    logger.info('request_completed', {
      requestId,
      method,
      path,
      status,
      durationMs: Math.round(durationMs * 1000) / 1000, // 3 decimals
      userAgent: req.headers['user-agent'],
    });

    // Only set header if response hasn't been sent yet
    if (!res.headersSent) {
      res.setHeader('x-response-time-ms', durationMs.toFixed(2));
    }
  });

  next();
}

