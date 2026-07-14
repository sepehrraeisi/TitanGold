import express from 'express';
import db from '../database/db.js';
import { authenticate, authenticateStrict, authorize } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAP } from '../services/capabilities.js';
import {
  getRuntimeExecutionState,
  setGlobalRuntimeMode,
  activateKillSwitch,
  clearKillSwitch,
  buildRuntimeView,
  ensureDefaultRuntimeState,
} from '../services/runtimeExecutionStateService.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// ============================================================================
// Trading Mode Endpoints (Per-User, DB-Backed)
// ============================================================================

/**
 * GET /api/settings/trading-mode
 * Get current user's trading mode (demo | live)
 */
router.get('/trading-mode', authenticateStrict, requireCapability(CAP.AI_AGENT_READ), async (req, res) => {
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
    logger.error('Error fetching trading mode:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trading mode',
      message: error.message,
      code: 'TRADING_MODE_READ_FAILED',
    });
  }
});

/**
 * POST /api/settings/trading-mode
 * Set current user's trading mode preference (demo | live).
 * Preference alone never grants live execution — runtime gates remain authoritative.
 * Emergency Stop does not block preference updates.
 */
router.post('/trading-mode', authenticateStrict, requireCapability(CAP.AI_AGENT_READ), async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode } = req.body;

    if (mode !== 'demo' && mode !== 'live') {
      return res.status(400).json({
        error: 'Invalid mode',
        message: 'Mode must be "demo" or "live"',
        code: 'VALIDATION_ERROR',
      });
    }

    // Persist preference with typed jsonb payload (avoid PG "could not determine data type of parameter").
    // Path {trading,mode} expects a JSON string value, e.g. "live" — not an object.
    const modeJson = JSON.stringify(mode);
    const updated = await db.query(
      `UPDATE user_preferences
       SET preferences = jsonb_set(
             jsonb_set(
               COALESCE(preferences, '{}'::jsonb),
               '{trading}',
               COALESCE(preferences->'trading', '{}'::jsonb),
               true
             ),
             '{trading,mode}',
             $2::jsonb,
             true
           ),
           sync_source = 'web',
           updated_at = NOW(),
           is_deleted = FALSE,
           deleted_at = NULL
       WHERE user_id = $1
       RETURNING preferences->'trading'->>'mode' AS mode`,
      [userId, modeJson],
    );

    if (updated.rowCount === 0) {
      await db.query(
        `INSERT INTO user_preferences (user_id, preferences, sync_source, is_deleted)
         VALUES ($1, $2::jsonb, 'web', FALSE)`,
        [userId, JSON.stringify({ trading: { mode } })],
      );
    }

    // If switching to demo, initialize demo wallet with defaults when missing
    if (mode === 'demo') {
      const defaultBalances = { USDT: 10000, BTC: 0, ETH: 0 };
      const walletResult = await db.query(
        `SELECT preferences->'wallet'->'demo'->>'balances' as balances
         FROM user_preferences
         WHERE user_id = $1 AND is_deleted = FALSE`,
        [userId],
      );

      if (!walletResult.rows[0]?.balances) {
        await db.query(
          `UPDATE user_preferences
           SET preferences = jsonb_set(
             jsonb_set(
               COALESCE(preferences, '{}'::jsonb),
               '{wallet}',
               COALESCE(preferences->'wallet', '{}'::jsonb),
               true
             ),
             '{wallet,demo,balances}',
             $2::jsonb,
             true
           ),
           updated_at = NOW()
           WHERE user_id = $1`,
          [userId, JSON.stringify(defaultBalances)],
        );
        logger.info(`✅ Demo wallet initialized for user ${userId}`);
      }
    }

    const runtime = await getRuntimeExecutionState({ preferCache: true }).catch(() => null);
    logger.info(`✅ Trading mode preference updated for user ${userId}: ${mode}`);

    res.json({
      mode,
      requestedMode: mode,
      effectiveMode: runtime?.killSwitchActive ? 'demo' : (runtime?.globalMode || 'demo'),
      killSwitchActive: runtime?.killSwitchActive === true,
      message: `Trading mode preference updated to ${mode}`,
      note: 'Preference does not grant live execution permission',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error updating trading mode:', error);
    res.status(500).json({
      error: 'Failed to update trading mode',
      message: error.message,
      code: 'TRADING_MODE_WRITE_FAILED',
    });
  }
});

// ============================================================================
// Global Execution Runtime (multi-process SSOT)
// ============================================================================

router.get('/execution-runtime', authenticateStrict, requireCapability(CAP.AI_AGENT_READ), async (req, res) => {
  try {
    const state = await getRuntimeExecutionState({ preferCache: false });
    const userId = req.user.id;
    const pref = await db.query(
      `SELECT preferences->'trading'->>'mode' AS mode FROM user_preferences WHERE user_id = $1 AND is_deleted = FALSE LIMIT 1`,
      [userId],
    );
    const broker = await db.query(
      `SELECT COUNT(*)::int AS c FROM exchange_connections WHERE user_id = $1 AND is_active = TRUE AND api_key IS NOT NULL`,
      [userId],
    );
    const requestedMode = pref.rows[0]?.mode === 'live' ? 'live' : 'demo';
    res.json(buildRuntimeView(state, {
      requestedMode,
      providerConnected: (broker.rows[0]?.c || 0) > 0,
    }));
  } catch (error) {
    logger.error('Error fetching execution runtime:', error);
    res.status(500).json({ error: 'Failed to fetch execution runtime', code: 'RUNTIME_READ_FAILED' });
  }
});

router.post('/execution-runtime/mode', authenticateStrict, requireCapability(CAP.RUNTIME_MODE_WRITE), async (req, res) => {
  try {
    const { mode, confirm_runtime_mode_change: confirm } = req.body;
    if (confirm !== true) {
      return res.status(400).json({ error: 'confirm_runtime_mode_change must be true', code: 'CONFIRMATION_REQUIRED' });
    }
    if (mode !== 'demo' && mode !== 'live') {
      return res.status(400).json({ error: 'Invalid mode', code: 'INVALID_INPUT' });
    }
    const saved = await setGlobalRuntimeMode(mode, { userId: req.user.id });
    res.json({ success: true, globalRuntimeMode: saved.globalMode, effectiveMode: saved.killSwitchActive ? 'demo' : saved.globalMode });
  } catch (error) {
    logger.error('Error setting execution runtime mode:', error);
    res.status(500).json({ error: 'Failed to set runtime mode', code: 'RUNTIME_WRITE_FAILED' });
  }
});

router.post('/execution-runtime/kill-switch', authenticateStrict, requireCapability(CAP.KILL_SWITCH_CONTROL), async (req, res) => {
  try {
    const { reason, activate = true, confirm_clear_kill_switch: confirmClear } = req.body;
    if (activate === false) {
      const saved = await clearKillSwitch({ userId: req.user.id, confirm: confirmClear === true });
      return res.json({ success: true, killSwitchActive: saved.killSwitchActive });
    }
    const saved = await activateKillSwitch(reason || 'manual', { userId: req.user.id });
    res.json({ success: true, killSwitchActive: saved.killSwitchActive, killSwitchReason: saved.killSwitchReason });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message, code: error.code || 'KILL_SWITCH_FAILED' });
  }
});

/**
 * GET /api/settings
 * Authenticated read of non-secret system settings.
 * Blocks raw global_execution_runtime secret fields via redaction.
 */
router.get('/', authenticateStrict, requireCapability(CAP.AI_AGENT_READ), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT key, value, description, updated_at
      FROM system_settings
      WHERE key NOT IN ('global_execution_runtime')
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
    logger.error('Error fetching settings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch settings',
      message: error.message,
      code: 'SETTINGS_READ_FAILED',
    });
  }
});

/**
 * GET /api/settings/:key
 * Non-secret public keys are readable without auth for login/bootstrap UX.
 * Runtime SSOT must use /settings/execution-runtime.
 */
const PUBLIC_SETTING_KEYS = new Set(['public_registration', 'app_name', 'support_email', 'maintenance_mode']);

router.get('/:key', async (req, res, next) => {
  const { key } = req.params;
  if (key === 'global_execution_runtime') {
    return res.status(403).json({
      error: 'Use /settings/execution-runtime for runtime state',
      code: 'USE_CANONICAL_ENDPOINT',
    });
  }
  if (PUBLIC_SETTING_KEYS.has(key)) {
    try {
      const result = await db.query(
        'SELECT key, value, description, updated_at FROM system_settings WHERE key = $1',
        [key],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Setting not found', key, code: 'NOT_FOUND' });
      }
      const setting = result.rows[0];
      return res.json({
        key: setting.key,
        value: setting.value,
        description: setting.description,
        updatedAt: setting.updated_at,
      });
    } catch (error) {
      logger.error('Error fetching public setting:', error);
      return res.status(500).json({ error: 'Failed to fetch setting', code: 'SETTINGS_READ_FAILED' });
    }
  }
  return next();
}, authenticateStrict, requireCapability(CAP.AI_AGENT_READ), async (req, res) => {
  try {
    const { key } = req.params;
    const result = await db.query(
      'SELECT key, value, description, updated_at FROM system_settings WHERE key = $1',
      [key],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found', key, code: 'NOT_FOUND' });
    }
    const setting = result.rows[0];
    res.json({
      key: setting.key,
      value: setting.value,
      description: setting.description,
      updatedAt: setting.updated_at,
    });
  } catch (error) {
    logger.error('Error fetching setting:', error);
    res.status(500).json({
      error: 'Failed to fetch setting',
      message: error.message,
      code: 'SETTINGS_READ_FAILED',
    });
  }
});

/**
 * PUT /api/settings/:key
 * Update a specific setting (Admin only)
 */
router.put('/:key', authenticateStrict, authorize('admin'), requireCapability(CAP.AI_AGENT_CONFIGURE), async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    if (key === 'global_execution_runtime') {
      return res.status(403).json({
        error: 'Use /settings/execution-runtime endpoints for runtime mutations',
        code: 'USE_CANONICAL_ENDPOINT',
      });
    }

    if (value === undefined) {
      return res.status(400).json({ 
        error: 'Value is required',
        code: 'VALIDATION_ERROR',
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

    logger.info(`✅ Setting updated: ${key} = ${JSON.stringify(setting.value)}`);

    res.json({
      message: 'Setting updated successfully',
      key: setting.key,
      value: setting.value,
      description: setting.description,
      updatedAt: setting.updated_at
    });
  } catch (error) {
    logger.error('Error updating setting:', error);
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

      logger.info(`✅ Bulk settings updated: ${results.length} settings`);

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
    logger.error('Error bulk updating settings:', error);
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

    logger.info(`✅ Setting deleted: ${key}`);

    res.json({
      message: 'Setting deleted successfully',
      key
    });
  } catch (error) {
    logger.error('Error deleting setting:', error);
    res.status(500).json({ 
      error: 'Failed to delete setting',
      message: error.message 
    });
  }
});

export default router;
