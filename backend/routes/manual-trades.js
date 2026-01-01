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
    
    // Try to get data - will use defaults if MEXC is not configured or DB is unavailable
    const data = await manualTradingService.getPageData(userId);
    
    console.log(`✅ Manual trading page data fetched successfully`);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch manual trading page data:', error);
    
    // If database is unavailable, return default data structure
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      console.warn('⚠️ Database unavailable, returning default manual trading data');
      return res.json({
        stats: manualTradingService.getDefaultStats(),
        chart: [],
        quickTrade: {
          pair: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          price: 0,
          changePercent: 0,
          availableBalance: 0,
          amountPresets: [10, 25, 50, 75, 100],
          defaultPreset: 25,
          stopLossPercent: 2,
          takeProfitPercent: 5,
          baseAssetPrecision: 8,
        },
        recommendations: [],
        sentiment: {
          score: 50,
          labelKey: 'sentiment_neutral',
        },
        strategies: [],
        portfolio: [],
        performance: [],
        recentTrades: [],
        lastUpdated: new Date().toISOString(),
      });
    }
    
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

// Get order book for a trading pair
router.get('/orderbook/:pair', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { pair } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    // Check user's trading mode
    const modeResult = await query(
      'SELECT trading->\'mode\' as mode FROM user_preferences WHERE user_id = $1 AND is_deleted = FALSE',
      [userId]
    );
    const mode = modeResult.rows[0]?.mode || 'demo';
    
    // In demo mode, return simulated order book
    if (mode === 'demo') {
      const basePrice = pair.includes('BTC') ? 42000 : pair.includes('ETH') ? 2500 : 100;
      const bids = Array.from({ length: limit }, (_, i) => [
        basePrice * (1 - (i + 1) * 0.0001),
        Math.random() * 10
      ]);
      const asks = Array.from({ length: limit }, (_, i) => [
        basePrice * (1 + (i + 1) * 0.0001),
        Math.random() * 10
      ]);
      
      return res.json({
        bids,
        asks,
        timestamp: Date.now(),
        demo: true
      });
    }
    
    // Live mode: fetch from MEXC
    const orderBook = await mexcService.fetchOrderBook(userId, pair, limit);
    res.json(orderBook);
  } catch (error) {
    console.error('Failed to fetch order book:', error);
    // Return empty order book on error instead of 500
    res.json({
      bids: [],
      asks: [],
      timestamp: Date.now(),
    });
  }
});

// Place advanced order (limit, stop-loss, etc.)
router.post('/order/advanced', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, side, pair, amount, price, stopPrice, limitPrice } = req.body;

    if (!type || !side || !pair || !amount) {
      return res.status(400).json({ error: 'Missing required fields: type, side, pair, amount' });
    }

    if (side !== 'buy' && side !== 'sell') {
      return res.status(400).json({ error: 'Invalid side. Must be "buy" or "sell"' });
    }

    const result = await manualTradingService.placeAdvancedOrder(userId, {
      type,
      side,
      pair,
      amount,
      price,
      stopPrice,
      limitPrice,
    });

    res.json(result);
  } catch (error) {
    console.error('Failed to place advanced order:', error);
    res.status(500).json({ error: error.message || 'Failed to place order' });
  }
});

// Get open orders
router.get('/orders/open', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const pair = req.query.pair;
    const orders = await manualTradingService.getOpenOrders(userId, pair);
    res.json(orders);
  } catch (error) {
    console.error('Failed to fetch open orders:', error);
    res.json([]); // Return empty array on error
  }
});

// Cancel order
router.delete('/orders/:orderId', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    await manualTradingService.cancelOrder(userId, orderId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to cancel order:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel order' });
  }
});

export default router;

