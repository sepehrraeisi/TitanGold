import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

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
    console.error('Error fetching wallet data:', error);
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
    console.error('Error refreshing connector:', error);
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
      console.warn('⚠️ Error updating wallet_security_controls:', err.message);
    }

    const updatedData = await getWalletData(userId);

    res.json({
      success: true,
      data: updatedData,
      message: 'Security control updated successfully',
    });
  } catch (error) {
    console.error('Error toggling security control:', error);
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
      console.warn('⚠️ Error updating wallet_preferences:', err.message);
    }

    const updatedData = await getWalletData(userId);

    res.json({
      success: true,
      data: updatedData,
      message: 'Preferences saved successfully',
    });
  } catch (error) {
    console.error('Error updating wallet preferences:', error);
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
    console.error('Error fetching wallet security controls:', error);
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
    console.error('Error fetching wallet preferences:', error);
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


