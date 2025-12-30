import { query } from '../database/db.js';

/**
 * Request logging middleware
 * Logs all API requests to request_logs table
 * Uses res.on('finish') to avoid overriding res.end
 */
export const requestLogger = (req, res, next) => {
  // Skip non-API routes (static files, etc)
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Skip health checks to avoid noise
  if (req.path === '/api/monitoring/health' || req.path === '/api/health') {
    return next();
  }

  const startTime = Date.now();

  // Use 'finish' event instead of overriding res.end
  res.on('finish', () => {
    // Calculate duration
    const durationMs = Date.now() - startTime;

    // Get clean path without query string
    const cleanPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;

    // Log to database (async, don't block response)
    const userId = req.user?.id || null;
    
    query(
      `INSERT INTO request_logs (method, path, status, duration_ms, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.method, cleanPath, res.statusCode, durationMs, userId]
    ).catch(err => {
      // Don't throw - just log the error
      console.error('Request logger error:', err);
    });
  });

  next();
};

/**
 * Error logging utility
 * Call this from error handlers or catch blocks
 */
export const logError = async (context, error, meta = {}) => {
  try {
    await query(
      `INSERT INTO error_logs (context, message, stack, meta)
       VALUES ($1, $2, $3, $4)`,
      [
        context,
        error.message || String(error),
        error.stack || null,
        JSON.stringify(meta)
      ]
    );
  } catch (err) {
    console.error('Error logger failed:', err);
  }
};
