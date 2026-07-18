import express from 'express';
import { authenticateStrict } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAP } from '../services/capabilities.js';
import { scheduler } from '../engine/scheduler.js';
import { logger } from '../services/logger.js';
import { readAnalyticalSchedulerStatus } from '../services/analyticalSchedulerStatus.js';
import { normalizeAgentAllowlist } from '../services/scheduledAgentResolver.js';

const router = express.Router();

/**
 * Worker-authoritative scheduler status when available.
 * Local backend singleton is never reported as the owner.
 */
router.get('/status', authenticateStrict, requireCapability(CAP.AI_AGENT_READ), async (req, res) => {
  try {
    const local = scheduler.getStatus();
    const remote = await readAnalyticalSchedulerStatus();

    if (remote.status) {
      return res.json({
        owner: remote.status.owner || 'titan-engine-worker',
        source: remote.source,
        stale: remote.stale,
        isRunning: remote.status.isRunning === true,
        agentsEnabled: remote.status.agentsEnabled === true,
        allowlist: remote.status.allowlist || [],
        registeredJobs: remote.status.registeredJobs || [],
        activeIntervals: remote.status.activeIntervals || [],
        emergencyStopSeparation: remote.status.emergencyStopSeparation === true,
        lastTickAt: remote.status.lastTickAt,
        lastSuccessAt: remote.status.lastSuccessAt,
        lastFailureAt: remote.status.lastFailureAt,
        lastSkipReason: remote.status.lastSkipReason,
        lastRun: remote.status.lastRun,
        pid: remote.status.pid,
        host: remote.status.host,
        updatedAt: remote.status.updatedAt,
        // Config still useful from DB-backed local load if worker hasn't published yet
        config: local.config,
        note: remote.stale
          ? 'Worker status is stale or missing heartbeat; treat intervals as unverified'
          : 'Authoritative status from titan-engine-worker',
      });
    }

    return res.json({
      owner: 'titan-engine-worker',
      source: remote.source || 'missing',
      stale: true,
      isRunning: false,
      agentsEnabled: local.config?.agents?.enabled === true,
      allowlist: (() => {
        const n = normalizeAgentAllowlist(local.config?.agents?.agents);
        return n.ok ? n.keys : [];
      })(),
      registeredJobs: [],
      activeIntervals: [],
      emergencyStopSeparation: null,
      lastTickAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastSkipReason: 'worker_status_unavailable',
      lastRun: null,
      config: local.config,
      note: 'Backend singleton is not the scheduler owner. Worker status unavailable.',
      localProcessHint: {
        isRunning: local.isRunning,
        intervals: local.intervals,
        warning: 'Do not treat localProcessHint as authoritative in cluster API processes',
      },
    });
  } catch (error) {
    logger.error('Failed to get scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status', code: 'SCHEDULER_STATUS_FAILED' });
  }
});

router.post('/start', authenticateStrict, requireCapability(CAP.SCHEDULER_CONTROL), async (req, res) => {
  try {
    // API process must not own the analytical scheduler in cluster mode.
    // Instruct operators to rely on titan-engine-worker.
    res.status(409).json({
      success: false,
      error: 'Scheduler ownership is titan-engine-worker. Use worker process / Emergency Stop separation recovery.',
      code: 'SCHEDULER_OWNER_IS_WORKER',
    });
  } catch (error) {
    logger.error('Failed to start scheduler:', error);
    const errorMessage = error.message || 'Failed to start scheduler';
    res.status(500).json({
      error: errorMessage,
      code: 'SCHEDULER_START_FAILED',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post('/stop', authenticateStrict, requireCapability(CAP.SCHEDULER_CONTROL), async (req, res) => {
  try {
    res.status(409).json({
      success: false,
      error: 'Scheduler ownership is titan-engine-worker. Stopping via API cluster singleton is disabled.',
      code: 'SCHEDULER_OWNER_IS_WORKER',
    });
  } catch (error) {
    logger.error('Failed to stop scheduler:', error);
    const errorMessage = error.message || 'Failed to stop scheduler';
    res.status(500).json({
      error: errorMessage,
      code: 'SCHEDULER_STOP_FAILED',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.put('/config/:section', authenticateStrict, requireCapability(CAP.SCHEDULER_CONTROL), async (req, res) => {
  try {
    const { section } = req.params;
    const updates = req.body;

    if (!['agents', 'dataHub', 'training', 'analytics', 'artemis'].includes(section)) {
      return res.status(400).json({ error: 'Invalid section', code: 'VALIDATION_ERROR' });
    }

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Body must be an object', code: 'VALIDATION_ERROR' });
    }

    if (section === 'agents' && Object.prototype.hasOwnProperty.call(updates, 'agents')) {
      const normalized = normalizeAgentAllowlist(updates.agents);
      if (!normalized.ok) {
        return res.status(400).json({
          error: normalized.message,
          code: 'VALIDATION_ERROR',
          reason: normalized.reason,
        });
      }
      updates.agents = normalized.keys;
    }

    // Persist via local scheduler config writer (DB SoT). Worker reloads on next tick/start.
    await scheduler.updateConfig(section, updates);
    res.json({
      success: true,
      message: 'Configuration updated (DB). Worker picks up on next load/recovery.',
      code: 'SCHEDULER_CONFIG_UPDATED',
      agents: section === 'agents' ? updates : undefined,
    });
  } catch (error) {
    logger.error('Failed to update scheduler config:', error);
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
    }
    res.status(500).json({ error: 'Failed to update configuration', code: 'SCHEDULER_CONFIG_FAILED' });
  }
});

router.get('/config', authenticateStrict, requireCapability(CAP.AI_AGENT_READ), async (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json(status.config);
  } catch (error) {
    logger.error('Failed to get scheduler config:', error);
    res.status(500).json({ error: 'Failed to get configuration', code: 'SCHEDULER_CONFIG_FAILED' });
  }
});

export default router;
