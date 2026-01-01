import express from 'express';
import db from '../database/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// Trading Mode Endpoints (Per-User, DB-Backed)
// ============================================================================

/**
 * GET /api/settings/trading-mode
 * Get current user's trading mode (demo | live)
 */
router.get('/trading-mode', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get trading mode from user_preferences
    const result = await db.query(
      `SELECT preferences->'trading'->>'mode' as mode
       FROM user_preferences
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId]
    );
    
    // Default to 'demo' if not set
    const mode = result.rows[0]?.mode || 'demo';
    
    res.json({ 
      mode,
      userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching trading mode:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trading mode',
      message: error.message 
    });
  }
});

/**
 * POST /api/settings/trading-mode
 * Set current user's trading mode (demo | live)
 * CRITICAL: DB-backed to survive PM2 cluster restarts
 */
router.post('/trading-mode', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode } = req.body;
    
    // Validate mode
    if (mode !== 'demo' && mode !== 'live') {
      return res.status(400).json({ 
        error: 'Invalid mode',
        message: 'Mode must be "demo" or "live"'
      });
    }
    
    // Update user_preferences with new mode
    await db.query(
      `INSERT INTO user_preferences (user_id, preferences, sync_source)
       VALUES ($1, jsonb_build_object('trading', jsonb_build_object('mode', $2)), 'web')
       ON CONFLICT (user_id)
       DO UPDATE SET 
         preferences = jsonb_set(
           COALESCE(user_preferences.preferences, '{}'::jsonb),
           '{trading,mode}',
           to_jsonb($2::text)
         ),
         sync_source = 'web',
         updated_at = NOW()`,
      [userId, mode]
    );
    
    // If switching to demo, initialize demo wallet with defaults
    if (mode === 'demo') {
      const defaultBalances = { USDT: 10000, BTC: 0, ETH: 0 };
      
      // Check if demo wallet already exists
      const walletResult = await db.query(
        `SELECT preferences->'wallet'->'demo'->>'balances' as balances
         FROM user_preferences
         WHERE user_id = $1 AND is_deleted = FALSE`,
        [userId]
      );
      
      // Only initialize if not already set
      if (!walletResult.rows[0]?.balances) {
        await db.query(
          `UPDATE user_preferences
           SET preferences = jsonb_set(
             jsonb_set(
               COALESCE(preferences, '{}'::jsonb),
               '{wallet}',
               COALESCE(preferences->'wallet', '{}'::jsonb)
             ),
             '{wallet,demo,balances}',
             $2::jsonb
           ),
           updated_at = NOW()
           WHERE user_id = $1`,
          [userId, JSON.stringify(defaultBalances)]
        );
        
        console.log(`✅ Demo wallet initialized for user ${userId}: ${JSON.stringify(defaultBalances)}`);
      }
    }
    
    console.log(`✅ Trading mode updated for user ${userId}: ${mode}`);
    
    res.json({ 
      mode,
      message: `Trading mode switched to ${mode}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating trading mode:', error);
    res.status(500).json({ 
      error: 'Failed to update trading mode',
      message: error.message 
    });
  }
});

/**
 * GET /api/settings
 * Get all system settings (public + authenticated)
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT key, value, description, updated_at
      FROM system_settings
      ORDER BY key
    `);

    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    res.json({
      settings,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch settings',
      message: error.message 
    });
  }
});

/**
 * GET /api/settings/:key
 * Get a specific setting by key
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;

    const result = await db.query(
      'SELECT key, value, description, updated_at FROM system_settings WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Setting not found',
        key 
      });
    }

    const setting = result.rows[0];
    res.json({
      key: setting.key,
      value: setting.value,
      description: setting.description,
      updatedAt: setting.updated_at
    });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ 
      error: 'Failed to fetch setting',
      message: error.message 
    });
  }
});

/**
 * PUT /api/settings/:key
 * Update a specific setting (Admin only)
 */
router.put('/:key', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    if (value === undefined) {
      return res.status(400).json({ 
        error: 'Value is required' 
      });
    }

    // Convert value to JSONB
    const jsonbValue = typeof value === 'string' ? value : JSON.stringify(value);

    const result = await db.query(
      `INSERT INTO system_settings (key, value, description)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) 
       DO UPDATE SET 
         value = EXCLUDED.value,
         description = COALESCE(EXCLUDED.description, system_settings.description),
         updated_at = NOW()
       RETURNING key, value, description, updated_at`,
      [key, jsonbValue, description]
    );

    const setting = result.rows[0];

    console.log(`✅ Setting updated: ${key} = ${JSON.stringify(setting.value)}`);

    res.json({
      message: 'Setting updated successfully',
      key: setting.key,
      value: setting.value,
      description: setting.description,
      updatedAt: setting.updated_at
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ 
      error: 'Failed to update setting',
      message: error.message 
    });
  }
});

/**
 * POST /api/settings/bulk
 * Update multiple settings at once (Admin only)
 */
router.post('/bulk', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ 
        error: 'Settings object is required' 
      });
    }

    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      const results = [];

      for (const [key, value] of Object.entries(settings)) {
        const jsonbValue = typeof value === 'string' ? value : JSON.stringify(value);

        const result = await client.query(
          `INSERT INTO system_settings (key, value)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (key) 
           DO UPDATE SET 
             value = EXCLUDED.value,
             updated_at = NOW()
           RETURNING key, value, updated_at`,
          [key, jsonbValue]
        );

        results.push(result.rows[0]);
      }

      await client.query('COMMIT');

      console.log(`✅ Bulk settings updated: ${results.length} settings`);

      res.json({
        message: 'Settings updated successfully',
        updated: results.length,
        settings: results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error bulk updating settings:', error);
    res.status(500).json({ 
      error: 'Failed to update settings',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/settings/:key
 * Delete a setting (Admin only)
 */
router.delete('/:key', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { key } = req.params;

    const result = await db.query(
      'DELETE FROM system_settings WHERE key = $1 RETURNING key',
      [key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Setting not found',
        key 
      });
    }

    console.log(`✅ Setting deleted: ${key}`);

    res.json({
      message: 'Setting deleted successfully',
      key
    });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ 
      error: 'Failed to delete setting',
      message: error.message 
    });
  }
});

export default router;
