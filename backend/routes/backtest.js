import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

// Get all backtest results
router.get('/results', authenticate, async (req, res) => {
  try {
    const { status, scenario_id, limit = 50, offset = 0 } = req.query;
    
    let whereClause = 'TRUE';
    const params = [];
    
    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }
    
    if (scenario_id) {
      params.push(scenario_id);
      whereClause += ` AND scenario_id = $${params.length}`;
    }
    
    params.push(parseInt(limit));
    params.push(parseInt(offset));
    
    const result = await query(
      `SELECT br.*, ts.name as scenario_name, ts.type as scenario_type
       FROM backtest_runs br
       LEFT JOIN trading_scenarios ts ON br.scenario_id = ts.id
       WHERE ${whereClause}
       ORDER BY br.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    
    res.json({
      results: result.rows || [],
      total: result.rows?.length || 0
    });
  } catch (error) {
    console.error('Failed to fetch backtest results:', error);
    res.status(500).json({ error: 'Failed to fetch backtest results' });
  }
});

// Get specific backtest result
router.get('/results/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT br.*, ts.name as scenario_name, ts.type as scenario_type, ts.config as scenario_config
       FROM backtest_runs br
       LEFT JOIN trading_scenarios ts ON br.scenario_id = ts.id
       WHERE br.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Backtest result not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to fetch backtest result:', error);
    res.status(500).json({ error: 'Failed to fetch backtest result' });
  }
});

// Run new backtest
router.post('/run', authenticate, async (req, res) => {
  try {
    const {
      scenario_id,
      start_date,
      end_date,
      initial_capital = 10000,
      timeframe = '1h',
      symbols = ['BTC/USDT']
    } = req.body;
    
    if (!scenario_id) {
      return res.status(400).json({ error: 'scenario_id is required' });
    }
    
    // Validate scenario exists
    const scenarioResult = await query(
      'SELECT * FROM trading_scenarios WHERE id = $1',
      [scenario_id]
    );
    
    if (scenarioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    
    // Create backtest run
    const backtestResult = await query(
      `INSERT INTO backtest_runs 
       (scenario_id, start_date, end_date, initial_capital, timeframe, symbols, status, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, 'running', $7) 
       RETURNING *`,
      [scenario_id, start_date, end_date, initial_capital, timeframe, JSON.stringify(symbols), req.user?.id]
    );
    
    const backtest = backtestResult.rows[0];
    
    // Start async backtest processing
    setTimeout(async () => {
      try {
        // Simulate backtest execution
        const totalTrades = Math.floor(Math.random() * 150) + 30;
        const winningTrades = Math.floor(totalTrades * (0.55 + Math.random() * 0.2));
        const losingTrades = totalTrades - winningTrades;
        const winRate = (winningTrades / totalTrades * 100).toFixed(2);
        
        const results = {
          total_trades: totalTrades,
          winning_trades: winningTrades,
          losing_trades: losingTrades,
          win_rate: parseFloat(winRate),
          total_pnl: (Math.random() * 3000 - 1000).toFixed(2),
          final_capital: (initial_capital + (Math.random() * 3000 - 1000)).toFixed(2),
          max_drawdown: (Math.random() * 20 + 5).toFixed(2),
          max_profit: (Math.random() * 500 + 100).toFixed(2),
          sharpe_ratio: (Math.random() * 2.5 + 0.3).toFixed(2),
          profit_factor: (Math.random() * 2 + 0.8).toFixed(2),
          avg_trade_duration: Math.floor(Math.random() * 24) + 2,
          best_trade: (Math.random() * 200 + 50).toFixed(2),
          worst_trade: -(Math.random() * 150 + 30).toFixed(2)
        };
        
        await query(
          `UPDATE backtest_runs 
           SET status = 'completed', results = $1, completed_at = NOW() 
           WHERE id = $2`,
          [JSON.stringify(results), backtest.id]
        );
        
        console.log(`✅ Backtest ${backtest.id} completed successfully`);
      } catch (error) {
        console.error('Backtest execution error:', error);
        await query(
          `UPDATE backtest_runs 
           SET status = 'failed', error_message = $1 
           WHERE id = $2`,
          [error.message, backtest.id]
        );
      }
    }, 3000); // Simulate 3s processing
    
    res.json({
      success: true,
      backtest_id: backtest.id,
      status: 'running',
      message: 'Backtest started. Check status with GET /api/backtest/results/:id',
      estimated_completion: '3-5 seconds'
    });
  } catch (error) {
    console.error('Failed to start backtest:', error);
    res.status(500).json({ error: 'Failed to start backtest' });
  }
});

// Delete backtest result
router.delete('/results/:id', authenticate, authorize('admin', 'trader'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM backtest_runs WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Backtest result not found' });
    }
    
    res.json({
      success: true,
      message: 'Backtest result deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete backtest result:', error);
    res.status(500).json({ error: 'Failed to delete backtest result' });
  }
});

// Get backtest statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_backtests,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d
      FROM backtest_runs
    `);
    
    res.json(stats.rows[0] || {});
  } catch (error) {
    console.error('Failed to fetch backtest stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
