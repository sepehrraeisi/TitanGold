import { query } from '../database/db.js';

/**
 * Request logging middleware
 * Logs all API requests to request_logs table
 */
export const requestLogger = (req, res, next) => {
  // Skip non-API routes (static files, etc)
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Skip health checks to avoid noise (optional)
  if (req.path === '/api/monitoring/health' || req.path === '/api/health') {
    return next();
  }

  const startTime = Date.now();

  // Capture original end function
  const originalEnd = res.end;

  // Override res.end to log after response
  res.end = function(chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    // Calculate duration
    const durationMs = Date.now() - startTime;

    // Log to database (async, don't block response)
    const userId = req.user?.id || null;
    
    query(
      `INSERT INTO request_logs (method, path, status, duration_ms, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.method, req.path, res.statusCode, durationMs, userId]
    ).catch(err => {
      // Don't throw - just log the error
      console.error('Request logger error:', err);
    });
  };

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
