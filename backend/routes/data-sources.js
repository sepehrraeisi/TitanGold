import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

import { telegramService } from '../services/telegram.js';

const router = express.Router();

router.post('/publish-telegram', authenticate, async (req, res) => {
  try {
    const { channelId, message, photoUrl } = req.body;

    if (photoUrl) {
      await telegramService.sendPhoto(photoUrl, message);
    } else {
      await telegramService.sendMessage(message);
    }

    res.json({ success: true, message: 'Published to Telegram' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to publish to Telegram' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM data_sources ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data sources' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, type, url, category, config } = req.body;
    const result = await query(
      'INSERT INTO data_sources (name, type, url, category, config) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, type, url, category, JSON.stringify(config || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create data source' });
  }
});

// Get DataHub state (aggregate stats from all sources)
router.get('/state', authenticate, async (req, res) => {
  try {
    // Get data sources stats
    const sourcesResult = await query(
      `SELECT 
        COUNT(*) as total_sources,
        COUNT(*) FILTER (WHERE is_active = true) as active_sources,
        COUNT(*) FILTER (WHERE type = 'telegram') as telegram_sources,
        COUNT(*) FILTER (WHERE type = 'rss') as rss_sources,
        COUNT(*) FILTER (WHERE type = 'api') as api_sources
       FROM data_sources`
    );
    
    // Get recent logs
    const logsResult = await query(
      `SELECT COUNT(*) as total_logs,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_logs
       FROM data_hub_logs`
    );
    
    // Get data sources details
    const sourcesDetailResult = await query(
      `SELECT id, name, type, is_active, last_fetch_at, config 
       FROM data_sources 
       ORDER BY last_fetch_at DESC NULLS LAST 
       LIMIT 10`
    );
    
    const stats = sourcesResult.rows[0] || {};
    const logs = logsResult.rows[0] || {};
    
    res.json({
      status: 'active',
      totalSources: parseInt(stats.total_sources) || 0,
      activeSources: parseInt(stats.active_sources) || 0,
      sourcesByType: {
        telegram: parseInt(stats.telegram_sources) || 0,
        rss: parseInt(stats.rss_sources) || 0,
        api: parseInt(stats.api_sources) || 0,
      },
      recentLogs: parseInt(logs.recent_logs) || 0,
      totalLogs: parseInt(logs.total_logs) || 0,
      recentSources: sourcesDetailResult.rows || [],
    });
  } catch (error) {
    console.error('Failed to fetch DataHub state:', error);
    res.status(500).json({ error: 'Failed to fetch DataHub state' });
  }
});

// DataHub health check
router.get('/health', authenticate, async (req, res) => {
  try {
    // Check database connectivity
    await query('SELECT 1');
    
    // Check active sources
    const sourcesResult = await query(
      'SELECT COUNT(*) as count FROM data_sources WHERE is_active = true'
    );
    const activeCount = parseInt(sourcesResult.rows[0]?.count) || 0;
    
    // Check recent activity
    const activityResult = await query(
      `SELECT COUNT(*) as count FROM data_hub_logs 
       WHERE created_at > NOW() - INTERVAL '1 hour'`
    );
    const recentActivity = parseInt(activityResult.rows[0]?.count) || 0;
    
    const isHealthy = activeCount > 0;
    
    res.json({
      status: isHealthy ? 'healthy' : 'degraded',
      database: 'connected',
      activeSources: activeCount,
      recentActivity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('DataHub health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Get DataHub statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM data_sources) as total_sources,
        (SELECT COUNT(*) FROM data_sources WHERE is_active = true) as active_sources,
        (SELECT COUNT(*) FROM data_hub_logs) as total_logs,
        (SELECT COUNT(*) FROM data_hub_logs WHERE created_at > NOW() - INTERVAL '24 hours') as logs_24h,
        (SELECT COUNT(*) FROM data_hub_logs WHERE created_at > NOW() - INTERVAL '7 days') as logs_7d
    `);
    
    res.json(stats.rows[0] || {});
  } catch (error) {
    console.error('Failed to fetch DataHub stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;