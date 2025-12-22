import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

// Supported exchanges
const SUPPORTED_EXCHANGES = ['MEXC', 'Binance', 'Bybit', 'KuCoin', 'Gate.io'];

// Get all exchange connections for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT exchange, api_key, api_secret, is_active, is_testnet, last_sync_at, permissions, account_info
       FROM exchange_connections 
       WHERE user_id = $1
       ORDER BY exchange`,
      [userId]
    );

    const connections = result.rows.map(row => ({
      exchange: row.exchange,
      apiKey: row.api_key || '',
      apiSecret: row.api_secret ? '••••••••' : '', // Mask secret
      isConnected: row.is_active || false,
      isTestnet: row.is_testnet || false,
      lastSyncAt: row.last_sync_at,
      permissions: row.permissions || [],
      accountInfo: row.account_info || {},
    }));

    // Add missing exchanges
    const existingExchanges = connections.map(c => c.exchange);
    SUPPORTED_EXCHANGES.forEach(exchange => {
      if (!existingExchanges.includes(exchange)) {
        connections.push({
          exchange,
          apiKey: '',
          apiSecret: '',
          isConnected: false,
          isTestnet: false,
          lastSyncAt: null,
          permissions: [],
          accountInfo: {},
        });
      }
    });

    res.json({ connections });
  } catch (error) {
    console.error('Failed to fetch exchange connections:', error);
    // If database is unavailable, return empty connections
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      console.warn('⚠️ Database unavailable, returning empty connections');
      return res.json({
        connections: SUPPORTED_EXCHANGES.map(exchange => ({
          exchange,
          apiKey: '',
          apiSecret: '',
          isConnected: false,
          isTestnet: false,
          lastSyncAt: null,
          permissions: [],
          accountInfo: {},
        }))
      });
    }
    res.status(500).json({ error: 'Failed to fetch exchange connections', message: error.message });
  }
});

// Get specific exchange connection
router.get('/:exchange', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchange } = req.params;
    
    if (!SUPPORTED_EXCHANGES.includes(exchange)) {
      return res.status(400).json({ error: 'Unsupported exchange', supported: SUPPORTED_EXCHANGES });
    }

    const result = await query(
      `SELECT api_key, api_secret, is_active, is_testnet, last_sync_at, permissions, account_info 
       FROM exchange_connections 
       WHERE user_id = $1 AND exchange = $2
       LIMIT 1`,
      [userId, exchange]
    );

    if (result.rows.length === 0) {
      return res.json({
        apiKey: '',
        apiSecret: '',
        isConnected: false,
        permissions: [],
        accountInfo: {},
      });
    }

    const connection = result.rows[0];
    res.json({
      apiKey: connection.api_key || '',
      apiSecret: connection.api_secret || '',
      isConnected: connection.is_active || false,
      isTestnet: connection.is_testnet || false,
      lastSyncAt: connection.last_sync_at,
      permissions: connection.permissions || [],
      accountInfo: connection.account_info || {},
    });
  } catch (error) {
    console.error(`Failed to fetch ${req.params.exchange} connection:`, error);
    // If database is unavailable, return empty connection
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      console.warn('⚠️ Database unavailable, returning empty connection settings');
      return res.json({
        apiKey: '',
        apiSecret: '',
        isConnected: false,
        permissions: [],
        accountInfo: {},
      });
    }
    res.status(500).json({ error: 'Failed to fetch connection settings', message: error.message });
  }
});

// Save/Update exchange connection
router.post('/:exchange', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchange } = req.params;
    const { apiKey, apiSecret, isTestnet } = req.body;

    if (!SUPPORTED_EXCHANGES.includes(exchange)) {
      return res.status(400).json({ error: 'Unsupported exchange', supported: SUPPORTED_EXCHANGES });
    }

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'API key and secret are required' });
    }

    // Test connection first and get permissions
    const testResult = await testExchangeConnection(exchange, apiKey, apiSecret, isTestnet);
    
    const result = await query(
      `INSERT INTO exchange_connections (user_id, exchange, api_key, api_secret, is_active, is_testnet, last_sync_at, permissions, account_info)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)
       ON CONFLICT (user_id, exchange) 
       DO UPDATE SET 
         api_key = EXCLUDED.api_key,
         api_secret = EXCLUDED.api_secret,
         is_active = EXCLUDED.is_active,
         is_testnet = EXCLUDED.is_testnet,
         last_sync_at = NOW(),
         permissions = EXCLUDED.permissions,
         account_info = EXCLUDED.account_info,
         updated_at = NOW()
       RETURNING *`,
      [userId, exchange, apiKey, apiSecret, testResult.success, isTestnet || false, JSON.stringify(testResult.permissions || []), JSON.stringify(testResult.accountInfo || {})]
    );

    res.json({
      success: true,
      isConnected: testResult.success,
      message: testResult.success ? 'Connection saved and tested successfully' : 'Connection saved but test failed',
      permissions: testResult.permissions || [],
      accountInfo: testResult.accountInfo || {},
    });
  } catch (error) {
    console.error(`Failed to save ${req.params.exchange} connection:`, error);
    res.status(500).json({ error: 'Failed to save connection settings' });
  }
});

// Test exchange connection
router.post('/:exchange/test', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchange } = req.params;
    const { apiKey, apiSecret, isTestnet } = req.body;

    if (!SUPPORTED_EXCHANGES.includes(exchange)) {
      return res.status(400).json({ error: 'Unsupported exchange', supported: SUPPORTED_EXCHANGES });
    }

    // If keys provided in request, use them; otherwise get from database
    let testApiKey = apiKey;
    let testApiSecret = apiSecret;
    let testIsTestnet = isTestnet;

    if (!testApiKey || !testApiSecret) {
      const result = await query(
        `SELECT api_key, api_secret, is_testnet 
         FROM exchange_connections 
         WHERE user_id = $1 AND exchange = $2 AND is_active = true
         LIMIT 1`,
        [userId, exchange]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${exchange} connection not configured` });
      }

      testApiKey = result.rows[0].api_key;
      testApiSecret = result.rows[0].api_secret;
      testIsTestnet = result.rows[0].is_testnet;
    }

    const testResult = await testExchangeConnection(exchange, testApiKey, testApiSecret, testIsTestnet);
    res.json(testResult);
  } catch (error) {
    console.error(`Failed to test ${req.params.exchange} connection:`, error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// Delete exchange connection
router.delete('/:exchange', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchange } = req.params;

    if (!SUPPORTED_EXCHANGES.includes(exchange)) {
      return res.status(400).json({ error: 'Unsupported exchange' });
    }

    await query(
      'DELETE FROM exchange_connections WHERE user_id = $1 AND exchange = $2',
      [userId, exchange]
    );

    res.json({ success: true, message: `${exchange} connection removed` });
  } catch (error) {
    console.error(`Failed to delete ${req.params.exchange} connection:`, error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

// Get connection health status for all exchanges
router.get('/health/status', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT exchange, is_active, last_sync_at, account_info 
       FROM exchange_connections 
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    const healthStatus = await Promise.all(
      result.rows.map(async (row) => {
        // Check if last sync is recent (within 5 minutes)
        const lastSync = row.last_sync_at ? new Date(row.last_sync_at) : null;
        const now = new Date();
        const minutesSinceSync = lastSync ? (now.getTime() - lastSync.getTime()) / 1000 / 60 : Infinity;
        
        const status = minutesSinceSync < 5 ? 'healthy' : 'stale';
        
        return {
          exchange: row.exchange,
          status,
          lastSync: row.last_sync_at,
          minutesSinceSync: lastSync ? Math.floor(minutesSinceSync) : null,
          accountInfo: row.account_info || {},
        };
      })
    );

    res.json({ health: healthStatus });
  } catch (error) {
    console.error('Failed to fetch health status:', error);
    res.status(500).json({ error: 'Failed to fetch health status' });
  }
});

// Helper function to test exchange connection
async function testExchangeConnection(exchangeName, apiKey, apiSecret, isTestnet = false) {
  try {
    const ccxt = (await import('ccxt')).default;
    
    // Normalize exchange name to ccxt format
    const exchangeId = exchangeName.toLowerCase().replace(/\./g, '');
    
    // Create exchange instance
    const ExchangeClass = ccxt[exchangeId];
    if (!ExchangeClass) {
      return {
        success: false,
        message: `Exchange ${exchangeName} not supported by CCXT`,
        permissions: [],
        accountInfo: {},
      };
    }

    const exchange = new ExchangeClass({
      apiKey,
      secret: apiSecret,
      options: {
        defaultType: 'spot',
      },
      ...(isTestnet && exchange.urls?.test ? { urls: { api: exchange.urls.test } } : {}),
    });

    // Test by fetching balance (lightweight operation)
    const balance = await exchange.fetchBalance();
    
    // Get account info
    const accountInfo = {
      totalBalance: balance.total ? Object.keys(balance.total).filter(k => balance.total[k] > 0).length : 0,
      currencies: balance.total ? Object.keys(balance.total).filter(k => balance.total[k] > 0) : [],
    };

    // Try to determine permissions (if exchange supports it)
    let permissions = ['spot']; // Default permission
    try {
      if (exchange.has['fetchMyTrades']) permissions.push('trading');
      if (exchange.has['fetchDeposits']) permissions.push('deposits');
      if (exchange.has['fetchWithdrawals']) permissions.push('withdrawals');
    } catch (err) {
      // Ignore permission detection errors
    }

    return { 
      success: true, 
      message: 'Connection successful',
      permissions,
      accountInfo,
    };
  } catch (error) {
    console.error(`${exchangeName} connection test failed:`, error);
    return { 
      success: false, 
      message: error.message || 'Connection test failed',
      error: error.message,
      permissions: [],
      accountInfo: {},
    };
  }
}

export default router;
