import express from 'express';
import { query } from '../database/db.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// Uptime tracking
const SERVER_START_TIME = Date.now();

/**
 * GET /api/monitoring/health
 * Public endpoint - no auth required
 * Returns basic health check
 */
router.get('/health', async (req, res) => {
  try {
    // Check DB connection
    let dbHealthy = false;
    try {
      await query('SELECT 1');
      dbHealthy = true;
    } catch (dbErr) {
      logger.error('Health check - DB error:', dbErr);
    }

    const uptimeSec = Math.floor((Date.now() - SERVER_START_TIME) / 1000);

    res.json({
      ok: dbHealthy,
      db: dbHealthy,
      uptimeSec,
      timestamp: new Date().toISOString(),
      version: process.env.GIT_SHA || 'unknown'
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      ok: false,
      db: false,
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/monitoring/summary
 * Admin-only
 * Query params: ?window=1h|24h (default: 1h)
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    // Check admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const window = req.query.window || '1h';
    
    // Calculate time threshold
    let hoursBack = 1;
    if (window === '24h') hoursBack = 24;
    else if (window === '7d') hoursBack = 24 * 7;
    
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Get request metrics
    const requestMetrics = await query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status >= 400) as error_count,
        ROUND(AVG(duration_ms)::numeric, 2) as avg_latency_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_latency_ms
      FROM request_logs
      WHERE created_at >= $1
    `, [since]);

    // Get top routes
    const topRoutes = await query(`
      SELECT 
        path,
        COUNT(*) as count,
        ROUND(AVG(duration_ms)::numeric, 2) as avg_ms
      FROM request_logs
      WHERE created_at >= $1
      GROUP BY path
      ORDER BY count DESC
      LIMIT 10
    `, [since]);

    const metrics = requestMetrics.rows[0] || {
      total_requests: 0,
      error_count: 0,
      avg_latency_ms: 0,
      p95_latency_ms: 0
    };

    res.json({
      success: true,
      window,
      since: since.toISOString(),
      requests: parseInt(metrics.total_requests) || 0,
      errors: parseInt(metrics.error_count) || 0,
      avgLatencyMs: parseFloat(metrics.avg_latency_ms) || 0,
      p95LatencyMs: parseFloat(metrics.p95_latency_ms) || 0,
      topRoutes: topRoutes.rows.map(r => ({
        path: r.path,
        count: parseInt(r.count),
        avgMs: parseFloat(r.avg_ms)
      }))
    });

  } catch (error) {
    logger.error('Summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monitoring summary'
    });
  }
});

/**
 * GET /api/monitoring/errors
 * Admin-only
 * Query params: ?limit=50 (default: 50, max: 200)
 */
router.get('/errors', authenticate, async (req, res) => {
  try {
    // Check admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const errors = await query(`
      SELECT 
        id,
        context,
        message,
        stack,
        meta,
        created_at
      FROM error_logs
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      errors: errors.rows.map(e => ({
        id: e.id,
        context: e.context,
        message: e.message,
        stack: e.stack,
        meta: e.meta,
        timestamp: e.created_at
      }))
    });

  } catch (error) {
    logger.error('Errors fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error logs'
    });
  }
});

/**
 * GET /api/monitoring/requests
 * Admin-only (optional, for debugging)
 * Query params: ?limit=100 (default: 100, max: 500)
 */
router.get('/requests', authenticate, async (req, res) => {
  try {
    // Check admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    const requests = await query(`
      SELECT 
        id,
        method,
        path,
        status,
        duration_ms,
        user_id,
        created_at
      FROM request_logs
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      requests: requests.rows.map(r => ({
        id: r.id,
        method: r.method,
        path: r.path,
        status: r.status,
        durationMs: r.duration_ms,
        userId: r.user_id,
        timestamp: r.created_at
      }))
    });

  } catch (error) {
    logger.error('Requests fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch request logs'
    });
  }
});

export default router;
