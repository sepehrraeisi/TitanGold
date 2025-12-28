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

// Get Artemis decision logs
router.get('/logs', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0, level, category } = req.query;
    
    let whereClause = "category = 'artemis_decision'";
    const params = [parseInt(limit), parseInt(offset)];
    
    if (level) {
      whereClause += " AND level = $3";
      params.push(level);
    }
    
    const result = await query(
      `SELECT id, level, category, message, metadata, created_at 
       FROM system_logs 
       WHERE ${whereClause}
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      params
    );
    
    // Also get AI decisions for decision-specific logs
    const decisionsResult = await query(
      `SELECT id, agent_id, input, output, was_successful, confidence, created_at 
       FROM ai_decisions 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [parseInt(limit)]
    );
    
    res.json({
      systemLogs: result.rows || [],
      decisions: decisionsResult.rows || [],
      total: result.rows?.length || 0,
    });
  } catch (error) {
    console.error('Failed to fetch Artemis logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Clear Artemis logs
router.delete('/logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Delete old system logs
    const systemResult = await query(
      `DELETE FROM system_logs 
       WHERE category = 'artemis_decision' 
       AND created_at < NOW() - INTERVAL '${parseInt(days)} days'
       RETURNING id`
    );
    
    // Delete old AI decisions
    const decisionsResult = await query(
      `DELETE FROM ai_decisions 
       WHERE created_at < NOW() - INTERVAL '${parseInt(days)} days'
       RETURNING id`
    );
    
    res.json({
      message: 'Logs cleared successfully',
      systemLogsDeleted: systemResult.rows?.length || 0,
      decisionsDeleted: decisionsResult.rows?.length || 0,
    });
  } catch (error) {
    console.error('Failed to clear logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// General config update (used by Settings tabs)
router.put('/config', authenticate, authorize('admin'), async (req, res) => {
  try {
    const updates = req.body;
    
    // Get latest Artemis state
    const stateResult = await query('SELECT id, config FROM artemis_state ORDER BY created_at DESC LIMIT 1');
    
    if (stateResult.rows.length === 0) {
      // Create initial state if not exists
      const createResult = await query(
        `INSERT INTO artemis_state (status, mode, strategy, config) 
         VALUES ('active', 'demo', 'mixture_of_experts', $1) 
         RETURNING *`,
        [JSON.stringify(updates)]
      );
      return res.json(createResult.rows[0]);
    }
    
    const { id, config } = stateResult.rows[0];
    const currentConfig = config || {};
    
    // Deep merge configs
    const newConfig = {
      ...currentConfig,
      ...updates,
      decisionEngine: {
        ...(currentConfig.decisionEngine || {}),
        ...(updates.decisionEngine || {}),
      },
    };
    
    const updateResult = await query(
      'UPDATE artemis_state SET config = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [JSON.stringify(newConfig), id]
    );
    
    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Failed to update Artemis config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// ============================================================================
// LEARNING SYSTEM ENDPOINT — Auto-fed from ai_decisions
// ============================================================================
router.get('/learning', authenticate, async (req, res) => {
  try {
    // Fetch improvements
    const improvementsResult = await query(`
      SELECT 
        id,
        decision_id,
        agent_id,
        area,
        method,
        impact,
        source,
        metadata,
        created_at as timestamp
      FROM ai_learning_events
      WHERE event_type = 'improvement'
      ORDER BY created_at DESC
      LIMIT 100
    `);

    // Fetch mistakes
    const mistakesResult = await query(`
      SELECT 
        id,
        decision_id,
        agent_id,
        area as type,
        correction,
        learned,
        impact,
        source,
        metadata,
        created_at as timestamp
      FROM ai_learning_events
      WHERE event_type = 'mistake'
      ORDER BY created_at DESC
      LIMIT 100
    `);

    // Calculate metrics
    const totalEvents = improvementsResult.rows.length + mistakesResult.rows.length;
    const learnedMistakes = mistakesResult.rows.filter(m => m.learned).length;
    const learningRate = totalEvents > 0 ? (learnedMistakes / mistakesResult.rows.length) * 100 : 0;

    // Calculate adaptation speed (improvements per day)
    const improvements = improvementsResult.rows;
    let adaptationSpeed = 0;
    if (improvements.length >= 2) {
      const firstTime = new Date(improvements[improvements.length - 1].timestamp).getTime();
      const lastTime = new Date(improvements[0].timestamp).getTime();
      const daysDiff = (lastTime - firstTime) / (1000 * 60 * 60 * 24);
      adaptationSpeed = daysDiff > 0 ? (improvements.length / daysDiff) : 0;
    }

    res.json({
      improvements: improvementsResult.rows,
      mistakes: mistakesResult.rows,
      learningRate: Math.round(learningRate * 10) / 10,
      adaptationSpeed: Math.round(adaptationSpeed * 10) / 10,
      metrics: {
        totalImprovements: improvementsResult.rows.length,
        totalMistakes: mistakesResult.rows.length,
        learnedMistakes,
        pendingMistakes: mistakesResult.rows.length - learnedMistakes,
        autoGenerated: improvementsResult.rows.filter(i => i.source === 'auto').length + 
                       mistakesResult.rows.filter(m => m.source === 'auto').length,
        manualAnnotations: improvementsResult.rows.filter(i => i.source !== 'auto').length + 
                           mistakesResult.rows.filter(m => m.source !== 'auto').length
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch learning system:', error);
    res.status(500).json({ 
      error: 'Failed to fetch learning system',
      improvements: [],
      mistakes: [],
      learningRate: 0,
      adaptationSpeed: 0,
      metrics: { totalImprovements: 0, totalMistakes: 0, learnedMistakes: 0, pendingMistakes: 0, autoGenerated: 0, manualAnnotations: 0 },
      lastUpdated: new Date().toISOString()
    });
  }
});

// Mark mistake as learned
router.patch('/learning/mistake/:id/mark-learned', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      'UPDATE ai_learning_events SET learned = true, updated_at = NOW() WHERE id = $1 AND event_type = $2',
      [id, 'mistake']
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to mark mistake as learned:', error);
    res.status(500).json({ error: 'Failed to update mistake' });
  }
});

// Manual learning event (annotation only)
router.post('/learning/event', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { eventType, agentId, area, method, impact, correction, metadata } = req.body;
    
    const result = await query(`
      INSERT INTO ai_learning_events (
        event_type, agent_id, area, method, impact, correction, source, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [eventType, agentId, area, method, impact, correction, 'manual', JSON.stringify(metadata || {})]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create learning event:', error);
    res.status(500).json({ error: 'Failed to create learning event' });
  }
});

// ============================================================================
// ORCHESTRATION ENDPOINT — Real-time Agent Task Tracking
// ============================================================================
router.get('/orchestration', authenticate, async (req, res) => {
  try {
    // 1. Get active agents
    const agentsResult = await query(
      'SELECT * FROM ai_agents WHERE status = $1 AND is_enabled = true ORDER BY name',
      ['active']
    );
    const activeAgents = agentsResult.rows.length;

    // 2. Get recent agent tasks (decisions = tasks)
    const tasksResult = await query(`
      SELECT 
        d.id,
        d.agent_id,
        d.decision_type,
        d.confidence,
        d.was_successful,
        d.execution_time_ms,
        d.created_at,
        d.metadata,
        a.name as agent_name
      FROM ai_decisions d
      LEFT JOIN ai_agents a ON d.agent_id = a.id
      WHERE d.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY d.created_at DESC
      LIMIT 100
    `);

    // 3. Map decisions to AgentTask format
    const agentTasks = tasksResult.rows.map(row => {
      // Determine status based on decision outcome
      let status = 'completed';
      if (row.was_successful === false) {
        status = 'failed';
      } else if (row.was_successful === null) {
        status = 'running';
      }

      // Map confidence to priority
      const confidence = parseFloat(row.confidence) || 50;
      let priority = 'low';
      if (confidence > 80) priority = 'critical';
      else if (confidence > 60) priority = 'high';
      else if (confidence > 40) priority = 'medium';

      return {
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        type: row.decision_type,
        status,
        priority,
        startedAt: row.created_at,
        completedAt: status === 'completed' || status === 'failed' ? row.created_at : null,
        executionTimeMs: row.execution_time_ms,
        result: row.metadata
      };
    });

    // 4. Calculate resource allocation per agent
    const resourceAllocation = {};
    for (const agent of agentsResult.rows) {
      const agentTasksForAgent = tasksResult.rows.filter(t => t.agent_id === agent.id);
      const taskCount = agentTasksForAgent.length;
      
      // Calculate resource metrics
      const avgExecutionTime = taskCount > 0
        ? agentTasksForAgent.reduce((sum, t) => sum + (t.execution_time_ms || 0), 0) / taskCount
        : 0;

      resourceAllocation[agent.id] = {
        agentName: agent.name,
        cpu: Math.min(100, Math.round(taskCount * 5)), // 5% per task
        memory: Math.min(100, Math.round(taskCount * 3)), // 3% per task
        apiQuota: Math.max(0, 100 - taskCount), // Decrease quota with usage
        taskCount,
        avgExecutionTimeMs: Math.round(avgExecutionTime)
      };
    }

    res.json({
      activeAgents,
      agentTasks,
      resourceAllocation,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch orchestration state:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orchestration state',
      activeAgents: 0,
      agentTasks: [],
      resourceAllocation: {},
      lastUpdated: new Date().toISOString()
    });
  }
});

export default router;