import express from 'express';
import { query } from '../database/db.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

// Get git commit hash
let gitCommit = 'unknown';
try {
  const { stdout } = await execAsync('git rev-parse --short HEAD');
  gitCommit = stdout.trim();
} catch (error) {
  console.warn('Could not get git commit:', error.message);
}

/**
 * Basic health check (fast)
 * Returns 200 if service is running
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      service: 'titan-backend',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      commit: gitCommit,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      node: process.version,
      env: process.env.NODE_ENV || 'development',
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * Readiness check (includes DB + dependencies)
 * Returns 200 only if all critical services are ready
 */
router.get('/ready', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  let allReady = true;

  // Check database
  try {
    const result = await query('SELECT 1 as health');
    checks.checks.database = {
      status: result.rows[0]?.health === 1 ? 'ok' : 'degraded',
      message: 'Database connection successful',
    };
  } catch (error) {
    allReady = false;
    checks.checks.database = {
      status: 'error',
      message: error.message,
    };
  }

  // Check MEXC API keys
  try {
    const hasEnvKeys = !!(process.env.MEXC_ACCESS_KEY && process.env.MEXC_SECRET_KEY);
    checks.checks.mexc_keys = {
      status: hasEnvKeys ? 'ok' : 'warning',
      message: hasEnvKeys ? 'MEXC keys configured (ENV)' : 'No MEXC keys in ENV',
    };
  } catch (error) {
    checks.checks.mexc_keys = {
      status: 'warning',
      message: 'Could not check MEXC keys',
    };
  }

  // Check user exchange connections
  try {
    const result = await query('SELECT COUNT(*) as count FROM exchange_connections');
    const count = parseInt(result.rows[0]?.count || 0);
    checks.checks.user_connections = {
      status: 'ok',
      count,
      message: `${count} user exchange connection(s)`,
    };
  } catch (error) {
    checks.checks.user_connections = {
      status: 'warning',
      message: 'Could not check user connections',
    };
  }

  // Overall status
  checks.status = allReady ? 'ok' : 'degraded';

  res.status(allReady ? 200 : 503).json(checks);
});

/**
 * Detailed status (admin only - includes sensitive info)
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      service: 'titan-backend',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      commit: gitCommit,
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      node: process.version,
      env: process.env.NODE_ENV || 'development',
      pid: process.pid,
    };

    // Database stats
    try {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM exchange_connections) as connections,
          (SELECT COUNT(*) FROM favorites) as favorites,
          (SELECT COUNT(*) FROM alerts) as alerts
      `);
      status.database = result.rows[0];
    } catch (error) {
      status.database = { error: error.message };
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
