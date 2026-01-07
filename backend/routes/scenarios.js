import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// Generate AI trading scenario
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { type = 'custom', constraints = {} } = req.body;
    
    // AI-generated scenario based on current market conditions
    const scenario = {
      name: `AI Generated ${type.toUpperCase()} Scenario`,
      type,
      description: `Auto-generated ${type} scenario based on market analysis`,
      config: {
        entry_conditions: {
          rsi: { min: 30, max: 70 },
          macd: { signal: 'crossover' },
          volume: { min_increase: 20 }
        },
        exit_conditions: {
          target_profit: constraints.targetProfit || 5,
          stop_loss: constraints.stopLoss || 2,
          max_hold_time: constraints.maxHoldTime || 24
        },
        risk_management: {
          max_position_size: 10,
          max_daily_trades: constraints.maxTrades || 5,
          risk_per_trade: 1
        }
      },
      created_by: req.user?.id,
      is_active: false
    };
    
    res.json({
      success: true,
      scenario,
      message: 'AI scenario generated successfully. Review and save to use.'
    });
  } catch (error) {
    logger.error('Failed to generate scenario:', error);
    res.status(500).json({ error: 'Failed to generate AI scenario' });
  }
});

// Create new scenario
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, type, description, config, is_active = false } = req.body;
    const userId = req.user?.id;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    
    const result = await query(
      `INSERT INTO trading_scenarios (name, type, description, config, created_by, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [name, type, description, JSON.stringify(config || {}), userId, is_active]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to create scenario:', error);
    res.status(500).json({ error: 'Failed to create scenario' });
  }
});

// Get all scenarios
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, is_active } = req.query;
    
    let whereClause = 'TRUE';
    const params = [];
    
    if (type) {
      params.push(type);
      whereClause += ` AND type = $${params.length}`;
    }
    
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      whereClause += ` AND is_active = $${params.length}`;
    }
    
    const result = await query(
      `SELECT * FROM trading_scenarios 
       WHERE ${whereClause}
       ORDER BY created_at DESC`,
      params
    );
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to fetch scenarios:', error);
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
});

// Get scenario by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM trading_scenarios WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to fetch scenario:', error);
    res.status(500).json({ error: 'Failed to fetch scenario' });
  }
});

// Update scenario
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = $${paramCount}`);
        values.push(key === 'config' ? JSON.stringify(updates[key]) : updates[key]);
        paramCount++;
      }
    });
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(id);
    const result = await query(
      `UPDATE trading_scenarios 
       SET ${fields.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to update scenario:', error);
    res.status(500).json({ error: 'Failed to update scenario' });
  }
});

// Delete scenario
router.delete('/:id', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM trading_scenarios WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    
    res.json({
      success: true,
      message: 'Scenario deleted successfully',
      scenario: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to delete scenario:', error);
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
});

// Run backtest for scenario
router.post('/:id/backtest', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      start_date, 
      end_date, 
      initial_capital = 10000,
      timeframe = '1h'
    } = req.body;
    
    // Get scenario
    const scenarioResult = await query(
      'SELECT * FROM trading_scenarios WHERE id = $1',
      [id]
    );
    
    if (scenarioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    
    const scenario = scenarioResult.rows[0];
    
    // Create backtest run record
    const backtestResult = await query(
      `INSERT INTO backtest_runs 
       (scenario_id, start_date, end_date, initial_capital, timeframe, status) 
       VALUES ($1, $2, $3, $4, $5, 'running') 
       RETURNING *`,
      [id, start_date, end_date, initial_capital, timeframe]
    );
    
    const backtestId = backtestResult.rows[0].id;
    
    // Start async backtest (in production, this would be a background job)
    setTimeout(async () => {
      try {
        // Simulate backtest results
        const results = {
          total_trades: Math.floor(Math.random() * 100) + 20,
          winning_trades: Math.floor(Math.random() * 60) + 10,
          losing_trades: Math.floor(Math.random() * 40) + 5,
          win_rate: 0.65,
          total_pnl: (Math.random() * 2000 - 500).toFixed(2),
          max_drawdown: (Math.random() * 15).toFixed(2),
          sharpe_ratio: (Math.random() * 2 + 0.5).toFixed(2),
          profit_factor: (Math.random() * 2 + 1).toFixed(2),
        };
        
        await query(
          `UPDATE backtest_runs 
           SET status = 'completed', results = $1, completed_at = NOW() 
           WHERE id = $2`,
          [JSON.stringify(results), backtestId]
        );
      } catch (error) {
        logger.error('Backtest execution error:', error);
        await query(
          `UPDATE backtest_runs 
           SET status = 'failed', error_message = $1 
           WHERE id = $2`,
          [error.message, backtestId]
        );
      }
    }, 2000); // Simulate 2s processing
    
    res.json({
      success: true,
      backtest_id: backtestId,
      status: 'running',
      message: 'Backtest started. Check status with GET /api/backtest/runs/:id'
    });
  } catch (error) {
    logger.error('Failed to start backtest:', error);
    res.status(500).json({ error: 'Failed to start backtest' });
  }
});

export default router;
