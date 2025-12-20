import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { getMixtureDecision } from '../services/artemisOrchestrator.js';

const router = express.Router();

// Helper: log decision to system_logs table for observability
async function logDecision(level, message, metadata = {}) {
  try {
    await query(
      'INSERT INTO system_logs (level, category, message, metadata) VALUES ($1, $2, $3, $4)',
      [level, 'artemis_decision', message, JSON.stringify(metadata)]
    );
  } catch (e) {
    // لاگ‌نویسی نباید تصمیم‌گیری را بشکند
    console.error('Failed to log Artemis decision:', e);
  }
}

router.get('/state', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Get Artemis state from database
    let artemisState;
    try {
      const result = await query('SELECT * FROM artemis_state ORDER BY created_at DESC LIMIT 1');
      artemisState = result.rows[0] || {};
    } catch (dbError) {
      if (dbError.code === 'ECONNREFUSED' || dbError.message?.includes('ECONNREFUSED') || dbError.message?.includes('relation') || dbError.message?.includes('does not exist')) {
        console.warn('⚠️ Database unavailable, returning default Artemis state');
        artemisState = {};
      } else {
        throw dbError;
      }
    }
    
    // Get AI agents status
    let agents = [];
    try {
      const agentsResult = await query('SELECT id, name, type, status, performance_score, accuracy, is_enabled FROM ai_agents ORDER BY name');
      agents = agentsResult.rows || [];
    } catch (e) {
      console.warn('⚠️ Failed to fetch AI agents:', e);
    }
    
    // Get recent decisions count
    let decisionStats = {
      total: 0,
      successful: 0,
      recent: 0
    };
    try {
      const decisionsResult = await query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE was_successful = true) as successful,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent
         FROM ai_decisions`
      );
      if (decisionsResult.rows.length > 0) {
        decisionStats = {
          total: parseInt(decisionsResult.rows[0].total) || 0,
          successful: parseInt(decisionsResult.rows[0].successful) || 0,
          recent: parseInt(decisionsResult.rows[0].recent) || 0
        };
      }
    } catch (e) {
      console.warn('⚠️ Failed to fetch decision stats:', e);
    }
    
    // Build full state object
    const fullState = {
      status: artemisState.status || 'active',
      mode: artemisState.mode || 'demo',
      strategy: artemisState.strategy || 'mixture_of_experts',
      activeLearning: artemisState.active_learning !== false,
      overallAccuracy: artemisState.overall_accuracy || 0,
      totalDecisions: artemisState.total_decisions || decisionStats.total,
      successfulDecisions: artemisState.successful_decisions || decisionStats.successful,
      config: artemisState.config || {},
      decisionEngine: {
        strategy: artemisState.config?.decisionEngine?.strategy || 'mixture_of_experts',
        activeModel: artemisState.config?.decisionEngine?.activeModel || 'hybrid',
        confidenceThreshold: artemisState.config?.decisionEngine?.confidenceThreshold || 75,
        mixture: artemisState.config?.decisionEngine?.mixture || { enabled: true, models: [] }
      },
      orchestration: {
        activeAgents: agents.filter(a => a.is_enabled && a.status === 'active').length,
        totalAgents: agents.length,
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          status: a.status,
          performanceScore: parseFloat(a.performance_score) || 0,
          accuracy: parseFloat(a.accuracy) || 0,
          enabled: a.is_enabled !== false
        }))
      },
      monitoring: {
        recentDecisions: decisionStats.recent,
        systemHealth: {
          cpu: 45, // Placeholder - should be fetched from system metrics
          memory: 62, // Placeholder
          apiQuota: 85 // Placeholder
        }
      },
      created_at: artemisState.created_at,
      updated_at: artemisState.updated_at
    };
    
    res.json(fullState);
  } catch (error) {
    console.error('Failed to fetch Artemis state:', error);
    // Return default state on error
    res.json({
      status: 'active',
      mode: 'demo',
      strategy: 'mixture_of_experts',
      activeLearning: true,
      overallAccuracy: 0,
      totalDecisions: 0,
      successfulDecisions: 0,
      config: {},
      decisionEngine: {
        strategy: 'mixture_of_experts',
        activeModel: 'hybrid',
        confidenceThreshold: 75,
        mixture: { enabled: true, models: [] }
      },
      orchestration: {
        activeAgents: 0,
        totalAgents: 0,
        agents: []
      },
      monitoring: {
        recentDecisions: 0,
        systemHealth: {
          cpu: 0,
          memory: 0,
          apiQuota: 0
        }
      }
    });
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
      const payload = {
        action: 'HOLD',
        approved: false,
        reason: 'Artemis is not active',
        confidence: 0,
      };
      await logDecision('warning', 'Artemis decision skipped: Artemis not active', {
        opportunity,
        context,
        signals,
        artemisStatus: artemisState?.status || 'unknown',
        decision: payload,
      });
      return res.json(payload);
    }

    const decisionConfig = artemisState.config?.decisionEngine || {};
    const minConfidence = decisionConfig.confidenceThreshold || 75;

    // اگر استراتژی روی mixture_of_experts یا activeModel روی hybrid تنظیم شده،
    // از اورکستریتور چند-مدلی استفاده می‌کنیم
    let mixture = null;
    const useMixture =
      decisionConfig.strategy === 'mixture_of_experts' ||
      decisionConfig.activeModel === 'hybrid';

    if (useMixture) {
      try {
        mixture = await getMixtureDecision(
          { opportunity, signals, context },
          decisionConfig
        );
      } catch (e) {
        console.error('Artemis mixture-of-experts error:', e);
        mixture = null;
      }
    }

    // منطق ساده قبلی به عنوان fallback
    const baseApproved = opportunity.confidence >= minConfidence;
    
    // Check if we have enough capacity
    if (context && context.activeTrades >= context.maxTrades) {
      const payload = {
        action: 'HOLD',
        approved: false,
        reason: 'Maximum concurrent trades reached',
        confidence: opportunity.confidence,
      };
      await logDecision('info', 'Artemis decision blocked: max concurrent trades reached', {
        opportunity,
        context,
        signals,
        decision: payload,
      });
      return res.json(payload);
    }

    // Check risk limits
    if (context && context.dailyLoss && Math.abs(context.dailyLoss) > (context.portfolioValue * 0.05)) {
      const payload = {
        action: 'HOLD',
        approved: false,
        reason: 'Daily loss limit reached',
        confidence: opportunity.confidence,
      };
      await logDecision('warning', 'Artemis decision blocked: daily loss limit reached', {
        opportunity,
        context,
        signals,
        decision: payload,
      });
      return res.json(payload);
    }

    // Aggregate signals from agents
    let totalConfidence = opportunity.confidence;
    let signalCount = Array.isArray(signals) ? signals.length : 0;
    if (Array.isArray(signals) && signals.length > 0) {
      const avgConfidence =
        signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / signals.length;
      totalConfidence = (opportunity.confidence + avgConfidence) / 2;
    }

    // اگر mixture نتیجه معتبر داد، از آن استفاده می‌کنیم
    if (mixture && mixture.action) {
      const finalApproved =
        (mixture.action === 'BUY' || mixture.action === 'SELL') &&
        mixture.confidence >= minConfidence;

      const payload = {
        action: finalApproved ? mixture.action : 'HOLD',
        approved: finalApproved,
        reason:
          mixture.reason ||
          (finalApproved
            ? 'Mixture-of-experts approved opportunity'
            : 'Mixture-of-experts below confidence threshold'),
        confidence: mixture.confidence,
        signals: signalCount,
        providers: mixture.providers,
      };

      await logDecision('info', 'Artemis mixture-of-experts decision', {
        opportunity,
        context,
        signals,
        strategy: decisionConfig.strategy,
        activeModel: decisionConfig.activeModel,
        mixture,
        decision: payload,
      });

      return res.json(payload);
    }

    // Fallback: منطق جمع ساده confidence + سیگنال‌ها
    const finalApproved = baseApproved && totalConfidence >= minConfidence;

    const payload = {
      action: finalApproved
        ? opportunity.side === 'BUY'
          ? 'BUY'
          : 'SELL'
        : 'HOLD',
      approved: finalApproved,
      reason: finalApproved 
        ? `High confidence opportunity (${totalConfidence.toFixed(
            1
          )}%) with ${signalCount} agent signals`
        : `Confidence ${totalConfidence.toFixed(
            1
          )}% below threshold ${minConfidence}%`,
      confidence: totalConfidence,
      signals: signalCount,
    };

    await logDecision('info', 'Artemis baseline decision (no mixture or mixture failed)', {
      opportunity,
      context,
      signals,
      strategy: decisionConfig.strategy,
      activeModel: decisionConfig.activeModel,
      decision: payload,
    });

    return res.json(payload);
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

// Update decision engine config (used by Mixture Agents UI)
router.patch('/config/decision-engine', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { useMixture, models } = req.body || {};

    // Get latest Artemis state
    const stateResult = await query('SELECT id, config FROM artemis_state ORDER BY created_at DESC LIMIT 1');
    if (stateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Artemis state not found' });
    }

    const { id, config } = stateResult.rows[0];
    const currentConfig = config || {};
    const currentDecision = currentConfig.decisionEngine || {};

    let updatedDecision = { ...currentDecision };

    if (useMixture === true) {
      updatedDecision.strategy = 'mixture_of_experts';
      updatedDecision.activeModel = 'hybrid';
      updatedDecision.mixture = {
        enabled: true,
        models: Array.isArray(models) ? models : currentDecision.mixture?.models || [],
      };
    } else if (useMixture === false) {
      // Disable mixture, fallback to safer defaults if necessary
      updatedDecision.mixture = {
        ...(currentDecision.mixture || {}),
        enabled: false,
        models: Array.isArray(models) ? models : currentDecision.mixture?.models || [],
      };

      if (updatedDecision.strategy === 'mixture_of_experts') {
        updatedDecision.strategy = 'voting';
      }
      if (updatedDecision.activeModel === 'hybrid') {
        updatedDecision.activeModel = 'internal';
      }
    }

    const newConfig = {
      ...currentConfig,
      decisionEngine: updatedDecision,
    };

    const updateResult = await query(
      'UPDATE artemis_state SET config = $1, updated_at = NOW() WHERE id = $2 RETURNING config',
      [JSON.stringify(newConfig), id]
    );

    const updated = updateResult.rows[0]?.config?.decisionEngine || updatedDecision;

    res.json({
      message: 'Decision engine configuration updated',
      decisionEngine: updated,
    });
  } catch (error) {
    console.error('Failed to update decision engine config:', error);
    res.status(500).json({ error: 'Failed to update decision engine configuration' });
  }
});

export default router;