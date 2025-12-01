import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { mexcService } from '../services/mexc.js';
import { manualTradingService } from '../services/manualTrading.js';

const router = express.Router();

// Get manual trading page data
router.get('/page-data', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`📊 Fetching manual trading page data for user ${userId}`);
    
    // Try to get data - will use defaults if MEXC is not configured
    const data = await manualTradingService.getPageData(userId);
    
    console.log(`✅ Manual trading page data fetched successfully`);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch manual trading page data:', error);
    
    // If it's a MEXC configuration error, return a helpful message
    if (error.code === 'MEXC_NOT_CONFIGURED' || error.message?.includes('MEXC API keys not configured')) {
      return res.status(400).json({ 
        error: 'MEXC API keys not configured',
        message: 'Please configure MEXC API keys in Settings > Connections > Exchange API Keys',
        code: 'MEXC_NOT_CONFIGURED'
      });
    }
    
    // For other errors, return generic error
    res.status(500).json({ 
      error: 'Failed to fetch manual trading data',
      message: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Execute quick trade
router.post('/execute', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { side, amountPercent, stopLossPercent, takeProfitPercent, pair } = req.body;

    if (!side || !amountPercent || !pair) {
      return res.status(400).json({ error: 'Missing required fields: side, amountPercent, pair' });
    }

    if (side !== 'buy' && side !== 'sell') {
      return res.status(400).json({ error: 'Invalid side. Must be "buy" or "sell"' });
    }

    if (amountPercent < 1 || amountPercent > 100) {
      return res.status(400).json({ error: 'amountPercent must be between 1 and 100' });
    }

    const result = await manualTradingService.executeQuickTrade(userId, {
      side,
      amountPercent,
      stopLossPercent,
      takeProfitPercent,
      pair,
    });

    res.json(result);
  } catch (error) {
    console.error('Failed to execute quick trade:', error);
    res.status(500).json({ error: error.message || 'Failed to execute trade' });
  }
});

// Toggle strategy
router.post('/strategies/:strategyId/toggle', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyId } = req.params;

    const result = await manualTradingService.toggleStrategy(userId, strategyId);
    res.json(result);
  } catch (error) {
    console.error('Failed to toggle strategy:', error);
    res.status(500).json({ error: 'Failed to toggle strategy' });
  }
});

// Get recent trades
router.get('/recent', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    const result = await query(
      `SELECT * FROM manual_trades 
       WHERE user_id = $1 
       ORDER BY executed_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch recent trades:', error);
    res.status(500).json({ error: 'Failed to fetch recent trades' });
  }
});

// Get current price for a pair - Real data from MEXC
router.get('/price/:pair', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { pair } = req.params;
    const ticker = await mexcService.fetchTicker(userId, pair);
    
    if (!ticker) {
      return res.status(404).json({ error: 'Pair not found or MEXC connection failed. Please configure MEXC API keys in Settings > Connections > Exchange API Keys' });
    }

    res.json({
      pair,
      price: ticker.last,
      change24h: ticker.percentage || 0,
      volume: ticker.quoteVolume || 0,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to fetch price from MEXC:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch price. Please ensure MEXC API keys are configured.' });
  }
});

// Get balance
router.get('/balance', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const balance = await manualTradingService.getBalance(userId);
    res.json(balance);
  } catch (error) {
    console.error('Failed to fetch balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

export default router;

