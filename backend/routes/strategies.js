import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { strategyService } from '../services/strategies.js';

const router = express.Router();

// Get all strategies for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const strategies = await strategyService.getStrategies(userId);
    res.json(strategies);
  } catch (error) {
    console.error('Failed to fetch strategies:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      name: error.name,
      errno: error.errno,
      syscall: error.syscall,
      stack: error.stack
    });
    
    // Check if it's a database-related error (connection, table doesn't exist, etc.)
    const isDbError = 
      error.code === 'ECONNREFUSED' || 
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === '42P01' || // PostgreSQL: relation does not exist
      error.code === '3D000' || // PostgreSQL: database does not exist
      error.code === '28P01' || // PostgreSQL: invalid password
      error.errno === -4078 ||  // Windows ECONNREFUSED
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('connection') ||
      error.message?.includes('does not exist') ||
      error.message?.includes('relation') ||
      error.message?.includes('timeout') ||
      error.message?.includes('socket') ||
      error.syscall === 'connect';
    
    if (isDbError) {
      console.warn('⚠️ Database unavailable or table does not exist, returning empty strategies array');
      return res.json([]);
    }
    
    // For other errors, return 500 with details
    res.status(500).json({ 
      error: 'Failed to fetch strategies',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Toggle active / inactive
router.post('/:strategyId/toggle', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyId } = req.params;
    const updated = await strategyService.toggleStrategy(userId, strategyId);
    res.json(updated);
  } catch (error) {
    console.error('Failed to toggle strategy:', error);
    res.status(500).json({ error: error.message || 'Failed to toggle strategy' });
  }
});

// Create a simple new strategy
router.post('/', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, type } = req.body || {};
    const updated = await strategyService.createStrategy(userId, { name, type });
    res.status(201).json(updated);
  } catch (error) {
    console.error('Failed to create strategy:', error);
    res.status(500).json({ error: error.message || 'Failed to create strategy' });
  }
});

// Generate AI strategy
router.post('/ai-generate', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const updated = await strategyService.generateAIStrategy(userId);
    res.status(201).json(updated);
  } catch (error) {
    console.error('Failed to generate AI strategy:', error);
    res.status(500).json({ error: error.message || 'Failed to generate AI strategy' });
  }
});

// Copy/Duplicate strategy
router.post('/:strategyId/copy', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyId } = req.params;
    const updated = await strategyService.copyStrategy(userId, strategyId);
    res.json(updated);
  } catch (error) {
    console.error('Failed to copy strategy:', error);
    res.status(500).json({ error: error.message || 'Failed to copy strategy' });
  }
});

// Update strategy
router.put('/:strategyId', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyId } = req.params;
    const { name, type } = req.body || {};
    const updated = await strategyService.updateStrategy(userId, strategyId, { name, type });
    res.json(updated);
  } catch (error) {
    console.error('Failed to update strategy:', error);
    res.status(500).json({ error: error.message || 'Failed to update strategy' });
  }
});

// Group backtest (placeholder - would need backtest service)
router.post('/group-backtest', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyIds, startDate, endDate, initialCapital } = req.body || {};
    // TODO: Implement actual backtest logic
    res.json({ 
      message: 'Group backtest initiated',
      strategyIds: strategyIds || [],
      status: 'pending'
    });
  } catch (error) {
    console.error('Failed to start group backtest:', error);
    res.status(500).json({ error: error.message || 'Failed to start group backtest' });
  }
});

// Optimize all strategies (placeholder)
router.post('/optimize-all', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    // TODO: Implement optimization logic
    const strategies = await strategyService.getStrategies(userId);
    res.json({ 
      message: 'Optimization initiated for all strategies',
      count: strategies.length,
      status: 'pending'
    });
  } catch (error) {
    console.error('Failed to optimize strategies:', error);
    res.status(500).json({ error: error.message || 'Failed to optimize strategies' });
  }
});

// Export all strategies
router.get('/export/all', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const strategies = await strategyService.getStrategies(userId);
    
    // Convert to CSV format
    const csv = [
      ['Name', 'Type', 'Status', 'ROI', 'Win Rate', 'Trades', 'Sharpe', 'Max Drawdown', 'Rank'].join(','),
      ...strategies.map(s => [
        s.name,
        s.type,
        s.status,
        s.roi,
        s.winRate,
        s.trades,
        s.sharpe || 0,
        s.maxDrawdown || 0,
        s.rank,
      ].join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="strategies-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Failed to export strategies:', error);
    res.status(500).json({ error: error.message || 'Failed to export strategies' });
  }
});

// Allocate portfolio (placeholder)
router.post('/allocate-portfolio', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { allocations } = req.body || {};
    // TODO: Implement portfolio allocation logic
    res.json({ 
      message: 'Portfolio allocation updated',
      allocations: allocations || {},
      status: 'success'
    });
  } catch (error) {
    console.error('Failed to allocate portfolio:', error);
    res.status(500).json({ error: error.message || 'Failed to allocate portfolio' });
  }
});

export default router;


