import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationChannels,
  getNotificationHistory,
  testNotificationChannel,
  createNotificationEvent,
  NOTIFICATION_ERROR_CODES,
} from '../services/notificationService.js';

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

router.get('/preferences', authenticate, async (req, res) => {
  try {
    const preferences = await getNotificationPreferences(req.user.id);
    res.json({ success: true, preferences });
  } catch (error) {
    logger.error('notification_preferences_get_failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch notification preferences' });
  }
});

router.put('/preferences', authenticate, async (req, res) => {
  try {
    const preferences = await updateNotificationPreferences(req.user.id, req.body || {});
    res.json({ success: true, preferences });
  } catch (error) {
    logger.error('notification_preferences_update_failed', { error: error.message });
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to update notification preferences',
      code: error.code,
    });
  }
});

router.get('/channels', authenticate, async (req, res) => {
  try {
    const channels = await getNotificationChannels(req.user.id);
    res.json({ success: true, channels });
  } catch (error) {
    logger.error('notification_channels_get_failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch notification channels' });
  }
});

router.post('/test', authenticate, async (req, res) => {
  try {
    const {
      channel = 'system',
      dry_run = true,
      confirm_live = false,
      source_id = null,
    } = req.body || {};

    const result = await testNotificationChannel({
      userId: req.user.id,
      channel,
      dryRun: dry_run !== false,
      confirmLive: confirm_live === true,
      sourceId: source_id,
    });
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) logger.error('notification_test_failed', { error: error.message });
    res.status(status).json({
      success: false,
      error: error.message || 'Notification test failed',
      code: error.code || 'NOTIFICATION_TEST_FAILED',
      history: error.history,
    });
  }
});

router.post('/events', authenticate, authorize('admin'), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await createNotificationEvent({
      ...body,
      userId: body.user_id || body.userId || req.user.id,
      dryRun: body.dry_run !== false,
      confirmLive: body.confirm_live === true,
    });
    res.status(201).json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) logger.error('notification_event_failed', { error: error.message });
    res.status(status).json({
      success: false,
      error: error.message || 'Notification event failed',
      code: error.code || 'NOTIFICATION_EVENT_FAILED',
      history: error.history,
    });
  }
});

// Admin-only compatibility endpoint. Live WebSocket broadcast is frozen for P2.
router.post('/broadcast', authenticate, authorize('admin'), async (req, res) => {
  const { dry_run = true, confirm_live = false } = req.body || {};
  if (dry_run !== false) {
    return res.json({
      success: true,
      dry_run: true,
      status: 'dry_run',
      message: 'Broadcast dry-run accepted; no clients were notified.',
    });
  }
  if (confirm_live !== true) {
    return res.status(400).json({
      success: false,
      code: NOTIFICATION_ERROR_CODES.LIVE_CONFIRMATION_REQUIRED,
      error: 'confirm_live must be true for live broadcast',
    });
  }
  return res.status(400).json({
    success: false,
    code: NOTIFICATION_ERROR_CODES.LIVE_NOT_SUPPORTED_YET,
    error: 'Live notification broadcast is disabled until scoped delivery is implemented',
  });
});

// ---------------------------------------------------------------------------
// New: Notification settings & history stored in database
// ---------------------------------------------------------------------------

// Legacy alias: Get notification settings for current user.
router.get('/settings', authenticate, async (req, res) => {
  try {
    const preferences = await getNotificationPreferences(req.user.id);
    res.json({ success: true, preferences, settings: preferences });
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

// Legacy alias: Save/update notification settings.
router.put('/settings', authenticate, async (req, res) => {
  try {
    const preferences = await updateNotificationPreferences(req.user.id, req.body?.preferences || req.body || {});
    res.json({ success: true, preferences, settings: preferences });
  } catch (error) {
    logger.error('Error saving notification settings:', error);
    res.status(500).json({ error: 'Failed to save notification settings' });
  }
});

// Get notification history for current user
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = '50', offset = '0', unreadOnly = 'false' } = req.query;

    const history = await getNotificationHistory(userId, {
      limit,
      offset,
      status: req.query.status,
    });
    const unreadResult = await query(
      'SELECT COUNT(*) as count FROM notification_history WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );

    res.json({
      notifications: history.notifications,
      unreadCount: parseInt(unreadResult.rows[0].count, 10) || 0,
      total: history.total,
      limit: history.limit,
      offset: history.offset,
    });
  } catch (error) {
    logger.error('Error fetching notification history:', error);
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
    logger.error('Error marking notification as read:', error);
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
    logger.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
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