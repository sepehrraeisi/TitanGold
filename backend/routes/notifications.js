import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { broadcastNotification } from '../services/websocket.js';
import { logger } from '../services/logger.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Test broadcast endpoint (for admins/testers): broadcasts to all connected WS clients
router.post('/broadcast', authenticate, async (req, res) => {
  try {
    const { title = 'Test Notification', message = 'This is a test broadcast', level = 'info' } = req.body || {};

    const payload = {
      title,
      message,
      level, // info | warning | error
      timestamp: new Date().toISOString(),
      userId: req.user?.id,
    };

    broadcastNotification(payload);
    logger.info('notification_broadcast', { userId: req.user?.id, level });

    res.json({ success: true, broadcasted: payload });
  } catch (error) {
    logger.error('notification_broadcast_failed', { error: error.message });
    res.status(500).json({ error: 'Failed to broadcast notification', message: error.message });
  }
});

export default router;