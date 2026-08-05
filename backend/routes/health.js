import express from 'express';
import { query } from '../database/db.js';
import { getRedisInfo, isRedisAvailable } from '../utils/redis.js';
import { logger } from '../services/logger.js';
import { validateResponse } from '../middleware/validation.js';
import { healthResponseSchema, readinessResponseSchema } from '../schemas/commonSchemas.js';
import { getRuntimeProvenance } from '../utils/runtimeProvenance.js';
// BACKEND-015: Import agent health check functions
import {
  getAllAgentHealthStatus,
  getHealthSummary
} from '../services/agents/registry.js';

const router = express.Router();

function runtimeProvenancePayload() {
  const runtimeProvenance = getRuntimeProvenance();
  const commit = runtimeProvenance.commit;
  if (commit === 'unknown' || runtimeProvenance.verified === false) {
    logger.warn('Runtime provenance unverified', { source: runtimeProvenance.source });
  }
  return {
    commit,
    runtimeCommit: commit === 'unknown' ? null : commit,
    commitSource: runtimeProvenance.source,
    provenanceVerified: runtimeProvenance.verified === true,
    deployedAt: runtimeProvenance.deployedAt || null,
  };
}

/**
 * Basic health check (fast)
 * Returns 200 if service is running
 */
router.get('/', validateResponse(healthResponseSchema), async (req, res) => {
  try {
    const provenance = runtimeProvenancePayload();
    const health = {
      status: 'ok',
      service: 'titan-backend',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      ...provenance,
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
 * Returns 200 only if critical services are ready.
 * Non-critical diagnostics run in parallel with timeouts; do not cache unsafe runtime state.
 * Accessible via both /api/ready and /api/health/ready
 */
router.get('/ready', validateResponse(readinessResponseSchema), async (req, res) => {
  const started = Date.now();
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  let allReady = true;

  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)),
    ]);

  const runDatabase = async () => {
    const result = await query('SELECT 1 as health');
    return {
      status: result.rows[0]?.health === 1 ? 'ok' : 'degraded',
      message: 'Database connection successful',
      latencyMs: Date.now() - started,
    };
  };

  const runRedis = async () => {
    if (!isRedisAvailable()) {
      return { status: 'warning', message: 'Redis not connected (fallback mode active)' };
    }
    // Lightweight availability only — avoid INFO on every readiness probe
    const { getRedisClient } = await import('../utils/redis.js');
    const client = await getRedisClient();
    if (client?.ping) {
      const pong = await client.ping();
      return { status: pong === 'PONG' || pong === true ? 'ok' : 'warning', message: 'Redis ping ok' };
    }
    return { status: 'ok', message: 'Redis client available' };
  };

  const runRuntimeSafety = async () => {
    const { getRuntimeExecutionState, buildRuntimeView } = await import('../services/runtimeExecutionStateService.js');
    // preferCache:true — Redis cannot weaken PG kill switch (validated in service)
    const state = await getRuntimeExecutionState({ preferCache: true });
    const view = buildRuntimeView(state);
    const safe = view.killSwitchActive === true && view.effectiveMode === 'demo';
    return {
      status: safe ? 'ok' : 'error',
      killSwitchActive: view.killSwitchActive,
      effectiveMode: view.effectiveMode,
      workerAcknowledged: view.workerAcknowledged,
      stateVersion: view.stateVersion,
      message: safe ? 'Demo + kill switch active' : 'UNSAFE runtime state detected',
      critical: !safe,
    };
  };

  const runMexcKeys = async () => {
    const hasEnvKeys = !!(process.env.MEXC_ACCESS_KEY && process.env.MEXC_SECRET_KEY);
    return {
      status: hasEnvKeys ? 'ok' : 'warning',
      message: hasEnvKeys ? 'MEXC keys configured (ENV)' : 'No MEXC keys in ENV',
    };
  };

  const runUserConnections = async () => {
    // Deployment-disabled engines: count is informational, never blocks readiness
    const result = await query('SELECT COUNT(*)::int as count FROM exchange_connections');
    const count = result.rows[0]?.count || 0;
    return { status: 'ok', count, message: `${count} user exchange connection(s)` };
  };

  const runAgentHealth = async () => {
    const agentHealthSummary = getHealthSummary();
    return {
      status: agentHealthSummary.unhealthy > 0 ? 'degraded'
        : agentHealthSummary.degraded > 0 ? 'warning' : 'ok',
      message: `${agentHealthSummary.healthy}/${agentHealthSummary.total} agents healthy`,
      summary: agentHealthSummary,
      // Full per-agent payload removed from readiness hot path (use /health/status)
      blocksReadiness: agentHealthSummary.unhealthy > 0,
    };
  };

  const settled = await Promise.allSettled([
    withTimeout(runDatabase(), 2000, 'database'),
    withTimeout(runRedis(), 800, 'redis'),
    withTimeout(runRuntimeSafety(), 1500, 'runtime_safety'),
    withTimeout(runMexcKeys(), 100, 'mexc_keys'),
    withTimeout(runUserConnections(), 1500, 'user_connections'),
    withTimeout(runAgentHealth(), 200, 'ai_agents'),
  ]);

  const names = ['database', 'redis', 'runtime_safety', 'mexc_keys', 'user_connections', 'ai_agents'];
  settled.forEach((result, idx) => {
    const name = names[idx];
    if (result.status === 'fulfilled') {
      checks.checks[name] = result.value;
      if (name === 'database' && result.value.status === 'error') allReady = false;
      if (name === 'runtime_safety' && result.value.critical) allReady = false;
      if (name === 'ai_agents' && result.value.blocksReadiness) allReady = false;
      if (name === 'database' && result.value.status === 'degraded') allReady = false;
    } else {
      const isCritical = name === 'database' || name === 'runtime_safety';
      checks.checks[name] = {
        status: isCritical ? 'error' : 'warning',
        message: result.reason?.message || String(result.reason),
      };
      if (isCritical) allReady = false;
    }
  });

  checks.status = allReady ? 'ok' : 'degraded';
  checks.latencyMs = Date.now() - started;
  Object.assign(checks, runtimeProvenancePayload());

  res.status(allReady ? 200 : 503).json(checks);
});

/**
 * Detailed status (admin only - includes sensitive info)
 * Accessible via /api/health/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      service: 'titan-backend',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      ...runtimeProvenancePayload(),
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

    // Redis stats
    try {
      if (isRedisAvailable()) {
        status.redis = await getRedisInfo();
      } else {
        status.redis = { status: 'disconnected', message: 'Redis not available' };
      }
    } catch (error) {
      status.redis = { status: 'error', error: error.message };
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
