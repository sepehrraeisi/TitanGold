import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { mexcService } from '../services/mexc.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// ============================================================================
// Helper Functions for Trading Mode & Demo Wallet
// ============================================================================

/**
 * Get user's current trading mode (demo | live)
 */
async function getUserTradingMode(userId) {
  const result = await query(
    `SELECT preferences->'trading'->>'mode' as mode
     FROM user_preferences
     WHERE user_id = $1 AND is_deleted = FALSE`,
    [userId]
  );
  
  return result.rows[0]?.mode || 'demo'; // Default to demo
}

/**
 * Get demo wallet balances from user_preferences
 */
async function getDemoWalletBalances(userId) {
  const result = await query(
    `SELECT preferences->'wallet'->'demo'->>'balances' as balances
     FROM user_preferences
     WHERE user_id = $1 AND is_deleted = FALSE`,
    [userId]
  );
  
  const balances = result.rows[0]?.balances;
  if (balances) {
    return JSON.parse(balances);
  }
  
  // Initialize with defaults if not found
  const defaults = { USDT: 10000, BTC: 0, ETH: 0 };
  await setDemoWalletBalances(userId, defaults);
  return defaults;
}

/**
 * Set demo wallet balances in user_preferences
 */
async function setDemoWalletBalances(userId, balances) {
  await query(
    `INSERT INTO user_preferences (user_id, preferences, sync_source)
     VALUES ($1, jsonb_build_object('wallet', jsonb_build_object('demo', jsonb_build_object('balances', $2::jsonb))), 'web')
     ON CONFLICT (user_id)
     DO UPDATE SET 
       preferences = jsonb_set(
         jsonb_set(
           COALESCE(user_preferences.preferences, '{}'::jsonb),
           '{wallet}',
           COALESCE(user_preferences.preferences->'wallet', '{}'::jsonb)
         ),
         '{wallet,demo,balances}',
         $2::jsonb
       ),
       sync_source = 'web',
       updated_at = NOW()`,
    [userId, JSON.stringify(balances)]
  );
}

/**
 * Get real wallet balances from MEXC
 */
async function getRealWalletBalances(userId) {
  try {
    const mexcBalance = await mexcService.getBalance(userId);
    return mexcBalance;
  } catch (error) {
    logger.error('Error fetching MEXC balance:', error);
    // Return empty balances if MEXC not configured
    return { USDT: 0, BTC: 0, ETH: 0 };
  }
}

// ============================================================================
// Wallet API Endpoints
// ============================================================================

/**
 * GET /api/wallet
 * Get wallet balance (demo or live based on user's trading mode)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get trading mode
    const mode = await getUserTradingMode(userId);
    
    // Get balances based on mode
    let balances;
    if (mode === 'demo') {
      balances = await getDemoWalletBalances(userId);
    } else {
      balances = await getRealWalletBalances(userId);
    }
    
    res.json({
      mode,
      balances,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching wallet:', error);
    res.status(500).json({ 
      error: 'Failed to fetch wallet',
      message: error.message 
    });
  }
});

/**
 * POST /api/wallet/reset
 * Reset demo wallet to default balances (demo mode only)
 */
router.post('/reset', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get trading mode
    const mode = await getUserTradingMode(userId);
    
    // Only allow reset in demo mode
    if (mode !== 'demo') {
      return res.status(400).json({ 
        error: 'Invalid mode',
        message: 'Can only reset demo wallet. Switch to demo mode first.'
      });
    }
    
    // Reset to defaults
    const defaults = { USDT: 10000, BTC: 0, ETH: 0 };
    await setDemoWalletBalances(userId, defaults);
    
    logger.info(`✅ Demo wallet reset for user ${userId}`);
    
    res.json({
      message: 'Demo wallet reset to defaults',
      balances: defaults,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error resetting demo wallet:', error);
    res.status(500).json({ 
      error: 'Failed to reset demo wallet',
      message: error.message 
    });
  }
});

/**
 * POST /api/wallet/add-funds
 * Add funds to demo wallet (demo mode only)
 */
router.post('/add-funds', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { asset, amount } = req.body;
    
    // Validate input
    if (!asset || !amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid input',
        message: 'Asset and positive amount are required'
      });
    }
    
    // Get trading mode
    const mode = await getUserTradingMode(userId);
    
    // Only allow in demo mode
    if (mode !== 'demo') {
      return res.status(400).json({ 
        error: 'Invalid mode',
        message: 'Can only add funds in demo mode'
      });
    }
    
    // Get current balances
    const balances = await getDemoWalletBalances(userId);
    
    // Add funds
    balances[asset] = (balances[asset] || 0) + amount;
    
    // Save updated balances
    await setDemoWalletBalances(userId, balances);
    
    logger.info(`✅ Added ${amount} ${asset} to demo wallet for user ${userId}`);
    
    res.json({
      message: `Added ${amount} ${asset} to demo wallet`,
      balances,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error adding demo funds:', error);
    res.status(500).json({ 
      error: 'Failed to add funds',
      message: error.message 
    });
  }
});

// Get full wallet data for current user
router.get('/data', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await getWalletStats(userId);
    const assets = await getAssetsAllocation(userId);
    const transactions = await getRecentTransactions(userId, 10);
    const securityControls = await getSecurityControls(userId);
    const connectors = await getWalletConnectors(userId);
    const preferences = await getWalletPreferences(userId);

    res.json({
      stats,
      assets,
      transactions,
      securityControls,
      connectors,
      preferences,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching wallet data:', error);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

// Refresh a specific connector
router.post('/refresh-connector/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // TODO: implement real refresh logic (fetch on-chain/exchange balances, update DB, etc.)
    const updatedConnector = await refreshConnector(userId, id);

    res.json({
      success: true,
      connector: updatedConnector,
      message: 'Connector refreshed successfully',
    });
  } catch (error) {
    logger.error('Error refreshing connector:', error);
    res.status(500).json({ error: 'Failed to refresh connector' });
  }
});

// Toggle security control
router.put('/security-controls/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    try {
      await query(
        `UPDATE wallet_security_controls 
         SET enabled = $1, updated_at = NOW() 
         WHERE id = $2 AND user_id = $3`,
        [enabled, id, userId]
      );
    } catch (err) {
      logger.warn('⚠️ Error updating wallet_security_controls:', err.message);
    }

    const updatedData = await getWalletData(userId);

    res.json({
      success: true,
      data: updatedData,
      message: 'Security control updated successfully',
    });
  } catch (error) {
    logger.error('Error toggling security control:', error);
    res.status(500).json({ error: 'Failed to toggle security control' });
  }
});

// Update wallet preferences
router.put('/preferences', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences object' });
    }

    try {
      await query(
        `INSERT INTO wallet_preferences (user_id, preferences)
         VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET preferences = $2, updated_at = NOW()`,
        [userId, JSON.stringify(preferences)]
      );
    } catch (err) {
      logger.warn('⚠️ Error updating wallet_preferences:', err.message);
    }

    const updatedData = await getWalletData(userId);

    res.json({
      success: true,
      data: updatedData,
      message: 'Preferences saved successfully',
    });
  } catch (error) {
    logger.error('Error updating wallet preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ---------------------------------------------------------------------------
// Helper functions (initial skeleton; to be backed by real data later)
// ---------------------------------------------------------------------------

async function getWalletStats(userId) {
  // TODO: compute from real data (portfolio, trades, connectors)
  return {
    totalAssets: 0,
    activeWallets: 0,
    profit24h: 0,
    coldStorage: 0,
  };
}

async function getAssetsAllocation(userId) {
  // TODO: fetch aggregated asset allocation from DB
  return [];
}

async function getRecentTransactions(userId, limit = 10) {
  // TODO: fetch recent transactions from DB
  return [];
}

async function getSecurityControls(userId) {
  try {
    const result = await query(
      'SELECT * FROM wallet_security_controls WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error fetching wallet security controls:', error);
    return [];
  }
}

async function getWalletConnectors(userId) {
  // TODO: fetch connectors (on-chain wallets, exchanges, cold storage) from DB
  return [];
}

async function getWalletPreferences(userId) {
  try {
    const result = await query(
      'SELECT preferences FROM wallet_preferences WHERE user_id = $1',
      [userId]
    );
    return result.rows[0]?.preferences || {};
  } catch (error) {
    logger.error('Error fetching wallet preferences:', error);
    return {};
  }
}

async function refreshConnector(userId, connectorId) {
  // TODO: implement real refresh logic for a specific connector
  return { id: connectorId, userId };
}

async function getWalletData(userId) {
  const stats = await getWalletStats(userId);
  const assets = await getAssetsAllocation(userId);
  const transactions = await getRecentTransactions(userId, 10);
  const securityControls = await getSecurityControls(userId);
  const connectors = await getWalletConnectors(userId);
  const preferences = await getWalletPreferences(userId);

  return {
    stats,
    assets,
    transactions,
    securityControls,
    connectors,
    preferences,
    lastSyncedAt: new Date().toISOString(),
  };
}

export default router;


