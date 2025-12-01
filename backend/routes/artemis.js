import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

router.get('/state', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM artemis_state ORDER BY created_at DESC LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Artemis state' });
  }
});

router.patch('/state', authenticate, async (req, res) => {
  try {
    const { status, mode, strategy, config } = req.body;
    const result = await query(
      'UPDATE artemis_state SET status = COALESCE($1, status), mode = COALESCE($2, mode), strategy = COALESCE($3, strategy), config = COALESCE($4, config), updated_at = NOW() RETURNING *',
      [status, mode, strategy, config ? JSON.stringify(config) : null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update Artemis state' });
  }
});

router.get('/scenarios', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM trading_scenarios ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
});

// Decision endpoint for Trading Engine integration
router.post('/decision', authenticate, async (req, res) => {
  try {
    const { opportunity, signals, context } = req.body;
    
    // Get Artemis state
    const stateResult = await query('SELECT * FROM artemis_state ORDER BY created_at DESC LIMIT 1');
    const artemisState = stateResult.rows[0];
    
    if (!artemisState || artemisState.status !== 'active') {
      return res.json({
        action: 'HOLD',
        approved: false,
        reason: 'Artemis is not active',
        confidence: 0,
      });
    }

    // Simple decision logic (can be enhanced with AI service)
    // Check confidence threshold
    const minConfidence = artemisState.config?.decisionEngine?.confidenceThreshold || 75;
    const approved = opportunity.confidence >= minConfidence;
    
    // Check if we have enough capacity
    if (context && context.activeTrades >= context.maxTrades) {
      return res.json({
        action: 'HOLD',
        approved: false,
        reason: 'Maximum concurrent trades reached',
        confidence: opportunity.confidence,
      });
    }

    // Check risk limits
    if (context && context.dailyLoss && Math.abs(context.dailyLoss) > (context.portfolioValue * 0.05)) {
      return res.json({
        action: 'HOLD',
        approved: false,
        reason: 'Daily loss limit reached',
        confidence: opportunity.confidence,
      });
    }

    // Aggregate signals from agents
    let totalConfidence = opportunity.confidence;
    let signalCount = Array.isArray(signals) ? signals.length : 0;
    if (Array.isArray(signals) && signals.length > 0) {
      const avgConfidence =
        signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / signals.length;
      totalConfidence = (opportunity.confidence + avgConfidence) / 2;
    }

    const finalApproved = approved && totalConfidence >= minConfidence;

    return res.json({
      action: finalApproved ? (opportunity.side === 'BUY' ? 'BUY' : 'SELL') : 'HOLD',
      approved: finalApproved,
      reason: finalApproved 
        ? `High confidence opportunity (${totalConfidence.toFixed(1)}%) with ${signalCount} agent signals`
        : `Confidence ${totalConfidence.toFixed(1)}% below threshold ${minConfidence}%`,
      confidence: totalConfidence,
      signals: signalCount,
    });
  } catch (error) {
    console.error('Artemis decision error:', error);
    res.status(500).json({ 
      action: 'HOLD',
      approved: false,
      reason: 'Decision engine error',
      confidence: 0,
    });
  }
});

export default router;