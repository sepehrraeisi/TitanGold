import express from 'express';
import { authenticate, authenticateStrict, authorize } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAP } from '../services/capabilities.js';
import { scheduler } from '../engine/scheduler.js';
import { logger } from '../services/logger.js';

const router = express.Router();

router.get('/status', authenticateStrict, requireCapability(CAP.AI_AGENT_READ), async (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status', code: 'SCHEDULER_STATUS_FAILED' });
  }
});

router.post('/start', authenticateStrict, requireCapability(CAP.SCHEDULER_CONTROL), async (req, res) => {
  try {
    await scheduler.start();
    res.json({ success: true, message: 'Scheduler started', code: 'SCHEDULER_STARTED' });
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
    await scheduler.stop();
    res.json({ success: true, message: 'Scheduler stopped', code: 'SCHEDULER_STOPPED' });
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

    await scheduler.updateConfig(section, updates);
    res.json({ success: true, message: 'Configuration updated', code: 'SCHEDULER_CONFIG_UPDATED' });
  } catch (error) {
    logger.error('Failed to update scheduler config:', error);
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
