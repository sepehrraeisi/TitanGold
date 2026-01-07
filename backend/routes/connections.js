import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';
import exchangesRouter from './exchanges.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// Mount exchanges router
router.use('/exchanges', exchangesRouter);

// Get MEXC connection settings
router.get('/mexc', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT api_key, api_secret, is_active, is_testnet, last_sync_at 
       FROM exchange_connections 
       WHERE user_id = $1 AND exchange = 'MEXC'
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        apiKey: '',
        apiSecret: '',
        isConnected: false,
      });
    }

    const connection = result.rows[0];
    res.json({
      apiKey: connection.api_key || '',
      apiSecret: connection.api_secret || '',
      isConnected: connection.is_active || false,
      isTestnet: connection.is_testnet || false,
      lastSyncAt: connection.last_sync_at,
    });
  } catch (error) {
    logger.error('Failed to fetch MEXC connection:', error);
    // If database is unavailable, return empty connection instead of error
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      logger.warn('⚠️ Database unavailable, returning empty connection settings');
      return res.json({
        apiKey: '',
        apiSecret: '',
        isConnected: false,
      });
    }
    res.status(500).json({ error: 'Failed to fetch connection settings', message: error.message });
  }
});

// Save/Update MEXC connection settings
router.post('/mexc', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { apiKey, apiSecret, isTestnet } = req.body;

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'API key and secret are required' });
    }

    // Test connection first
    const testResult = await testMexcConnection(apiKey, apiSecret);
    
    const result = await query(
      `INSERT INTO exchange_connections (user_id, exchange, api_key, api_secret, is_active, is_testnet, last_sync_at)
       VALUES ($1, 'MEXC', $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, exchange) 
       DO UPDATE SET 
         api_key = EXCLUDED.api_key,
         api_secret = EXCLUDED.api_secret,
         is_active = EXCLUDED.is_active,
         is_testnet = EXCLUDED.is_testnet,
         last_sync_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [userId, apiKey, apiSecret, testResult.success, isTestnet || false]
    );

    res.json({
      success: true,
      isConnected: testResult.success,
      message: testResult.success ? 'Connection saved and tested successfully' : 'Connection saved but test failed',
    });
  } catch (error) {
    logger.error('Failed to save MEXC connection:', error);
    res.status(500).json({ error: 'Failed to save connection settings' });
  }
});

// Test MEXC connection
router.post('/mexc/test', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { apiKey, apiSecret } = req.body;

    // If keys provided in request, use them; otherwise get from database
    let testApiKey = apiKey;
    let testApiSecret = apiSecret;

    if (!testApiKey || !testApiSecret) {
      const result = await query(
        `SELECT api_key, api_secret 
         FROM exchange_connections 
         WHERE user_id = $1 AND exchange = 'MEXC' AND is_active = true
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'MEXC connection not configured' });
      }

      testApiKey = result.rows[0].api_key;
      testApiSecret = result.rows[0].api_secret;
    }

    const testResult = await testMexcConnection(testApiKey, testApiSecret);
    res.json(testResult);
  } catch (error) {
    logger.error('Failed to test MEXC connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// Helper function to test MEXC connection
async function testMexcConnection(apiKey, apiSecret) {
  try {
    const ccxt = (await import('ccxt')).default;
    const exchange = new ccxt.mexc({
      apiKey,
      secret: apiSecret,
      options: {
        defaultType: 'spot',
      },
    });

    // Test by fetching balance (lightweight operation)
    await exchange.fetchBalance();
    return { success: true, message: 'Connection successful' };
  } catch (error) {
    logger.error('MEXC connection test failed:', error);
    return { 
      success: false, 
      message: error.message || 'Connection test failed',
      error: error.message 
    };
  }
}

export default router;

