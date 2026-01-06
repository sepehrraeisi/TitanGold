import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// MEXC API Base URL
const MEXC_API_BASE = 'https://api.mexc.com';

/**
 * Proxy endpoint for MEXC 24hr ticker
 * Solves CORS issues by proxying through backend
 * Route: /api/market/mexc/ticker/24hr (with slash to match MEXC API)
 */
router.get('/mexc/ticker/24hr', async (req, res) => {
  try {
    const { symbol } = req.query;
    
    const url = symbol
      ? `${MEXC_API_BASE}/api/v3/ticker/24hr?symbol=${symbol}`
      : `${MEXC_API_BASE}/api/v3/ticker/24hr`;
    
    console.log('📊 Fetching MEXC ticker:', symbol || 'ALL');
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TitanGold/1.0',
      },
      timeout: 10000,
    });
    
    if (!response.ok) {
      throw new Error(`MEXC API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json({
      ok: true,
      data,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ MEXC ticker error:', error.message);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch MEXC ticker',
      message: error.message,
    });
  }
});

/**
 * Legacy route for backward compatibility (without slash)
 * Route: /api/market/mexc/ticker24hr
 */
router.get('/mexc/ticker24hr', async (req, res) => {
  try {
    const { symbol } = req.query;
    
    const url = symbol
      ? `${MEXC_API_BASE}/api/v3/ticker/24hr?symbol=${symbol}`
      : `${MEXC_API_BASE}/api/v3/ticker/24hr`;
    
    console.log('📊 Fetching MEXC ticker (legacy route):', symbol || 'ALL');
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TitanGold/1.0',
      },
      timeout: 10000,
    });
    
    if (!response.ok) {
      throw new Error(`MEXC API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json({
      ok: true,
      data,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ MEXC ticker error (legacy):', error.message);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch MEXC ticker',
      message: error.message,
    });
  }
});

/**
 * Proxy endpoint for MEXC orderbook depth
 */
router.get('/mexc/depth', async (req, res) => {
  try {
    const { symbol, limit = 20 } = req.query;
    
    if (!symbol) {
      return res.status(400).json({
        ok: false,
        error: 'symbol is required',
      });
    }
    
    const url = `${MEXC_API_BASE}/api/v3/depth?symbol=${symbol}&limit=${limit}`;
    
    console.log(`📊 Fetching MEXC depth: ${symbol} (limit: ${limit})`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TitanGold/1.0',
      },
      timeout: 10000,
    });
    
    if (!response.ok) {
      throw new Error(`MEXC API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json({
      ok: true,
      data,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ MEXC depth error:', error.message);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch MEXC depth',
      message: error.message,
    });
  }
});

/**
 * Proxy endpoint for MEXC exchange info
 */
router.get('/mexc/exchangeInfo', async (req, res) => {
  try {
    const url = `${MEXC_API_BASE}/api/v3/exchangeInfo`;
    
    console.log('📊 Fetching MEXC exchange info');
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TitanGold/1.0',
      },
      timeout: 10000,
    });
    
    if (!response.ok) {
      throw new Error(`MEXC API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json({
      ok: true,
      data,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ MEXC exchangeInfo error:', error.message);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch MEXC exchange info',
      message: error.message,
    });
  }
});

export default router;
