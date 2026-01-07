import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { scheduler } from '../engine/scheduler.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// Get scheduler status and configuration
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

// Start scheduler
router.post('/start', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    await scheduler.start();
    res.json({ success: true, message: 'Scheduler started' });
  } catch (error) {
    logger.error('Failed to start scheduler:', error);
    const errorMessage = error.message || 'Failed to start scheduler';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Stop scheduler
router.post('/stop', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    await scheduler.stop();
    res.json({ success: true, message: 'Scheduler stopped' });
  } catch (error) {
    logger.error('Failed to stop scheduler:', error);
    const errorMessage = error.message || 'Failed to stop scheduler';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update scheduler configuration
router.put('/config/:section', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const { section } = req.params;
    const updates = req.body;

    if (!['agents', 'dataHub', 'training', 'analytics', 'artemis'].includes(section)) {
      return res.status(400).json({ error: 'Invalid section' });
    }

    await scheduler.updateConfig(section, updates);
    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    logger.error('Failed to update scheduler config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Get scheduler configuration
router.get('/config', authenticate, async (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json(status.config);
  } catch (error) {
    logger.error('Failed to get scheduler config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

export default router;

