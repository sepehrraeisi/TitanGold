import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { tradingEngine } from '../engine/tradingEngine.js';

const router = express.Router();

// Get trading engine status
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = tradingEngine.getStatus();
    // Ensure all required fields are present
    const safeStatus = {
      isRunning: status.isRunning || false,
      mode: status.mode || 'demo',
      activeTrades: status.activeTrades || 0,
      maxConcurrentTrades: status.maxConcurrentTrades || 20,
      queueSize: status.queueSize || 0,
      stats: {
        totalOpportunities: status.stats?.totalOpportunities || 0,
        executedTrades: status.stats?.executedTrades || 0,
        successfulTrades: status.stats?.successfulTrades || 0,
        failedTrades: status.stats?.failedTrades || 0,
        totalProfit: status.stats?.totalProfit || 0,
        dailyProfit: status.stats?.dailyProfit || 0,
        dailyLoss: status.stats?.dailyLoss || 0,
      },
      scanners: Array.isArray(status.scanners) ? status.scanners : [],
    };
    res.json(safeStatus);
  } catch (error) {
    console.error('Failed to get trading engine status:', error);
    // Return safe default status instead of error
    res.json({
      isRunning: false,
      mode: 'demo',
      activeTrades: 0,
      maxConcurrentTrades: 20,
      queueSize: 0,
      stats: {
        totalOpportunities: 0,
        executedTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalProfit: 0,
        dailyProfit: 0,
        dailyLoss: 0,
      },
      scanners: [],
    });
  }
});

// Start trading engine
router.post('/start', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    await tradingEngine.start();
    res.json({ success: true, message: 'Trading engine started' });
  } catch (error) {
    console.error('Failed to start trading engine:', error);
    res.status(500).json({ error: 'Failed to start trading engine' });
  }
});

// Stop trading engine
router.post('/stop', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    await tradingEngine.stop();
    res.json({ success: true, message: 'Trading engine stopped' });
  } catch (error) {
    console.error('Failed to stop trading engine:', error);
    res.status(500).json({ error: 'Failed to stop trading engine' });
  }
});

// Get active trades
router.get('/trades/active', authenticate, async (req, res) => {
  try {
    const trades = tradingEngine.getActiveTrades();
    res.json({ trades });
  } catch (error) {
    console.error('Failed to get active trades:', error);
    res.status(500).json({ error: 'Failed to get active trades' });
  }
});

// Get opportunity queue
router.get('/opportunities', authenticate, async (req, res) => {
  try {
    const opportunities = tradingEngine.getOpportunityQueue();
    res.json({ opportunities });
  } catch (error) {
    console.error('Failed to get opportunities:', error);
    res.status(500).json({ error: 'Failed to get opportunities' });
  }
});

// Update trading engine configuration
router.put('/config', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const updates = req.body;
    
    // Update config
    if (updates.enabled !== undefined) {
      tradingEngine.config.enabled = updates.enabled;
    }
    if (updates.mode) {
      tradingEngine.config.mode = updates.mode;
    }
    if (updates.maxPositions) {
      tradingEngine.config.maxPositions = updates.maxPositions;
      tradingEngine.maxConcurrentTrades = updates.maxPositions;
    }
    if (updates.riskLimits) {
      tradingEngine.config.riskLimits = { ...tradingEngine.config.riskLimits, ...updates.riskLimits };
    }
    if (updates.scanners) {
      tradingEngine.config.scanners = { ...tradingEngine.config.scanners, ...updates.scanners };
    }

    await tradingEngine.saveConfig();
    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    console.error('Failed to update trading engine config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Get trading engine configuration
router.get('/config', authenticate, async (req, res) => {
  try {
    res.json(tradingEngine.config);
  } catch (error) {
    console.error('Failed to get trading engine config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

// Emergency stop
router.post('/emergency-stop', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const { reason } = req.body;
    await tradingEngine.emergencyStop(reason || 'manual');
    res.json({ success: true, message: 'Emergency stop executed' });
  } catch (error) {
    console.error('Failed to execute emergency stop:', error);
    res.status(500).json({ error: 'Failed to execute emergency stop' });
  }
});

export default router;

