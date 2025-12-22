import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { broadcastNotification } from '../services/websocket.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// Legacy: fetch last notifications from simple notifications table (if exists)
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

// ---------------------------------------------------------------------------
// New: Notification settings & history stored in database
// ---------------------------------------------------------------------------

// Get notification settings for current user
router.get('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM notification_settings WHERE user_id = $1 ORDER BY category, channel',
      [userId]
    );

    if (result.rows.length === 0) {
      const defaults = createDefaultNotificationSettings(userId);
      return res.json({ settings: defaults });
    }

    res.json({ settings: result.rows });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

// Save/update notification settings
router.put('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'Settings must be an array' });
    }

    for (const setting of settings) {
      await query(
        `INSERT INTO notification_settings (user_id, channel, category, enabled, filters)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, channel, category)
         DO UPDATE SET 
           enabled = $4,
           filters = $5,
           updated_at = NOW()`,
        [userId, setting.channel, setting.category, setting.enabled, setting.filters || {}]
      );
    }

    const result = await query(
      'SELECT * FROM notification_settings WHERE user_id = $1 ORDER BY category, channel',
      [userId]
    );

    res.json({
      settings: result.rows,
      message: 'Notification settings saved successfully',
    });
  } catch (error) {
    console.error('Error saving notification settings:', error);
    res.status(500).json({ error: 'Failed to save notification settings' });
  }
});

// Get notification history for current user
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = '50', offset = '0', unreadOnly = 'false' } = req.query as {
      limit?: string;
      offset?: string;
      unreadOnly?: string;
    };

    let sql = `
      SELECT * FROM notification_history 
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (unreadOnly === 'true') {
      sql += ' AND read_at IS NULL';
    }

    sql += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);

    const result = await query(sql, params);

    const unreadResult = await query(
      'SELECT COUNT(*) as count FROM notification_history WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].count, 10) || 0,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// Mark notification as read
router.put('/history/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'UPDATE notification_history SET read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, notification: result.rows[0] });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Delete notification from history
router.delete('/history/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM notification_history WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Create test notification (and optionally send via channels in future)
router.post('/test', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { channel = 'in_app', category = 'system' } = req.body || {};

    const result = await query(
      `INSERT INTO notification_history (user_id, type, category, title, message, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        'test',
        category,
        'Test Notification',
        `This is a test ${channel} notification from TitanGold Platform. If you received this, your notification system is working correctly.`,
        JSON.stringify({ channel, timestamp: new Date().toISOString() }),
      ]
    );

    // In future we can actually send via email/sms/push based on channel here

    res.json({
      success: true,
      message: 'Test notification created successfully',
      notification: result.rows[0],
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

function createDefaultNotificationSettings(userId) {
  const channels = ['email', 'sms', 'push', 'in_app'];
  const categories = ['trading', 'price_alerts', 'system', 'ai'];
  const defaults = [];

  for (const channel of channels) {
    for (const category of categories) {
      defaults.push({
        user_id: userId,
        channel,
        category,
        enabled: true,
        filters: {},
      });
    }
  }

  return defaults;
}

export default router;