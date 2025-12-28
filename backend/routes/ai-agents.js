import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

import { aiService } from '../services/ai.js';

const router = express.Router();

// ============================================================================
// Production++ Helpers for AI Routes
// ============================================================================

// 1) Normalized Error Response
function sendError(res, code, message, status = 400, details = null) {
  return res.status(status).json({
    error: {
      code,
      message,
      details: details || undefined
    }
  });
}

// 2) In-Memory Rate Limiter (per user)
const rateLimitStore = new Map(); // key -> { count, resetAt }

function rateLimit({ limit, windowMs }) {
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    
    const record = rateLimitStore.get(key);
    
    if (now > record.resetAt) {
      // Reset window
      record.count = 1;
      record.resetAt = now + windowMs;
      return next();
    }
    
    if (record.count >= limit) {
      return sendError(res, 'RATE_LIMITED', `Rate limit exceeded. Max ${limit} requests per ${windowMs / 1000}s`, 429, {
        limit,
        windowMs,
        resetAt: new Date(record.resetAt).toISOString()
      });
    }
    
    record.count++;
    next();
  };
}

// 3) Simple TTL Cache (in-memory)
const agentCache = new Map(); // key -> { value, expiresAt }

function getCache(key) {
  const cached = agentCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    agentCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCache(key, value, ttlMs) {
  agentCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

// 4) Timeout Wrapper
async function withTimeout(promise, ms, errorMessage = 'Operation timed out') {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]);
}

// 5) Input Validation
const VALID_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
const SYMBOL_REGEX = /^[A-Z0-9]{3,20}$/;

function validateAgentId(id) {
  // agent-<num> or UUID format
  return /^agent-\d+$/.test(id) || /^[a-f0-9-]{36}$/.test(id);
}

function validateSymbol(symbol) {
  if (!symbol) return false;
  // Remove / if present (e.g., BTC/USDT -> BTCUSDT)
  const clean = symbol.replace('/', '');
  return SYMBOL_REGEX.test(clean);
}

function validateTimeframe(timeframe) {
  return VALID_TIMEFRAMES.includes(timeframe);
}

function validateMessage(message) {
  return typeof message === 'string' && message.length > 0 && message.length <= 4000;
}

// ============================================================================
// Routes
// ============================================================================

router.post('/chat', authenticate, rateLimit({ limit: 10, windowMs: 60000 }), async (req, res) => {
  try {
    const { message, context } = req.body;
    
    // Validation
    if (!validateMessage(message)) {
      return sendError(res, 'VALIDATION_ERROR', 'Message must be 1-4000 characters', 400);
    }
    
    // Timeout wrapper (25s)
    const response = await withTimeout(
      aiService.askArtemis(message, context),
      25000,
      'AI chat timeout after 25s'
    );
    
    res.json({ text: response });
  } catch (error) {
    console.error('AI chat error:', error);
    if (error.message?.includes('timeout')) {
      return sendError(res, 'AI_TIMEOUT', 'AI service timed out', 504);
    }
    return sendError(res, 'AI_ERROR', 'Failed to get AI response', 500, { error: error.message });
  }
});

// Run an AI agent (used by Scheduler and Trading Engine)
router.post('/:id/run', authenticate, rateLimit({ limit: 15, windowMs: 60000 }), async (req, res) => {
  try {
    const { id } = req.params;
    const { function: funcName, symbol, timeframe = '1h' } = req.body || {};

    // Validation
    if (!validateAgentId(id)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid agent ID format', 400);
    }
    if (symbol && !validateSymbol(symbol)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid symbol format', 400);
    }
    if (timeframe && !validateTimeframe(timeframe)) {
      return sendError(res, 'VALIDATION_ERROR', `Invalid timeframe. Allowed: ${VALID_TIMEFRAMES.join(', ')}`, 400);
    }

    // Cache key (agent + symbol + timeframe)
    const cacheKey = `agent:${id}:${symbol || 'default'}:${timeframe}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit for ${cacheKey}`);
      return res.json(cached);
    }

    // Agent 1: Technical Analysis
    if (id === 'agent-1') {
      try {
        const prompt = `
You are the Technical Analysis Agent in the TitanGold trading system.
Analyze ${symbol || 'the asset'} on timeframe ${timeframe}.

Return ONLY JSON with this schema:
{
  "signal": "BUY" | "SELL" | "NEUTRAL",
  "confidence",
  "indicators": {
    "trend": "bullish" | "bearish" | "sideways",
    "rsi",
    "macd",
    "support" ,
    "resistance" 
  }
}
`;
        // Timeout wrapper (30s)
        const raw = await withTimeout(
          aiService.askArtemis(prompt),
          30000,
          'Agent-1 timeout after 30s'
        );
        const parsed = safeParseJson(raw);
        if (parsed) {
          const result = {
            agentId: id,
            function: funcName || 'runTechnicalAnalysis',
            signal: parsed.signal || 'NEUTRAL',
            confidence: parsed.confidence ?? 55,
            indicators: parsed.indicators || {},
            symbol,
            timeframe
          };
          // Cache for 30s
          setCache(cacheKey, result, 30000);
          return res.json(result);
        }
      } catch (e) {
        console.error('Agent-1 AI error:', e);
        if (e.message?.includes('timeout')) {
          return sendError(res, 'AI_TIMEOUT', 'Technical Analysis agent timed out', 504);
        }
      }

      // Fallback
      const fallback1 = {
        agentId: id,
        function: funcName || 'runTechnicalAnalysis',
        signal: 'NEUTRAL',
        confidence: 55,
        indicators: {
          rsi: 50,
          macd: 0,
          trend: 'sideways'
        },
        symbol,
        timeframe
      };
      setCache(cacheKey, fallback1, 30000);
      return res.json(fallback1);
    }

    // Agent 2: Risk Management
    if (id === 'agent-2') {
      try {
        const prompt = `
You are the Risk Management Agent in the TitanGold trading system.
Assess the risk profile of ${symbol || 'the asset'}.

Return ONLY JSON:
{
  "recommendation": "REDUCE" | "HOLD" | "INCREASE",
  "confidence",
  "riskLevel": "low" | "medium" | "high"
}
`;
        // Timeout wrapper (30s)
        const raw = await withTimeout(
          aiService.askArtemis(prompt),
          30000,
          'Agent-2 timeout after 30s'
        );
        const parsed = safeParseJson(raw);
        if (parsed) {
          const result = {
            agentId: id,
            function: funcName || 'runRiskAssessment',
            recommendation: parsed.recommendation || 'HOLD',
            confidence: parsed.confidence ?? 60,
            riskLevel: parsed.riskLevel || 'medium',
            symbol
          };
          // Cache for 30s
          setCache(cacheKey, result, 30000);
          return res.json(result);
        }
      } catch (e) {
        console.error('Agent-2 AI error:', e);
        if (e.message?.includes('timeout')) {
          return sendError(res, 'AI_TIMEOUT', 'Risk Management agent timed out', 504);
        }
      }

      const fallback2 = {
        agentId: id,
        function: funcName || 'runRiskAssessment',
        recommendation: 'HOLD',
        confidence: 60,
        riskLevel: 'medium',
        symbol
      };
      setCache(cacheKey, fallback2, 30000);
      return res.json(fallback2);
    }

    // Agent 15: Timing
    if (id === 'agent-15') {
      try {
        const prompt = `
You are the Timing Agent in the TitanGold trading system.
Decide if NOW is a good time to enter or exit a position for ${symbol || 'the asset'}.

Return ONLY JSON:
{
  "signal": "ENTER" | "WAIT" | "EXIT",
  "confidence",
  "timing": "immediate" | "soon" | "later"
}
`;
        // Timeout wrapper (30s)
        const raw = await withTimeout(
          aiService.askArtemis(prompt),
          30000,
          'Agent-15 timeout after 30s'
        );
        const parsed = safeParseJson(raw);
        if (parsed) {
          const result = {
            agentId: id,
            function: funcName || 'runTimingAnalysis',
            signal: parsed.signal || 'WAIT',
            confidence: parsed.confidence ?? 55,
            timing: parsed.timing || 'neutral',
            symbol
          };
          // Cache for 30s
          setCache(cacheKey, result, 30000);
          return res.json(result);
        }
      } catch (e) {
        console.error('Agent-15 AI error:', e);
        if (e.message?.includes('timeout')) {
          return sendError(res, 'AI_TIMEOUT', 'Timing agent timed out', 504);
        }
      }

      const fallback15 = {
        agentId: id,
        function: funcName || 'runTimingAnalysis',
        signal: 'WAIT',
        confidence: 55,
        timing: 'neutral',
        symbol
      };
      setCache(cacheKey, fallback15, 30000);
      return res.json(fallback15);
    }

    // Generic fallback for other agents – safe NO-OP style response
    return res.json({
      agentId: id,
      function: funcName || 'run',
      status: 'ok',
      symbol,
      message: 'Agent run stub executed successfully'
    });
  } catch (error) {
    console.error('Failed to run AI agent:', error);
    if (error.message?.includes('timeout')) {
      return sendError(res, 'AI_TIMEOUT', 'AI agent timed out', 504);
    }
    return sendError(res, 'AI_ERROR', 'Failed to run AI agent', 500, { error: error.message });
  }
});

function safeParseJson(raw) {
  if (!raw) return null;
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return JSON.parse(trimmed);
    }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
  } catch (e) {
    console.error('AI agent JSON parse error:', e, 'raw:', raw);
  }
  return null;
}

// Get manager overview (for AI Manager component)
router.get('/manager-overview', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Get all agents
    let agents = [];
    try {
      const agentsResult = await query('SELECT * FROM ai_agents ORDER BY name');
      agents = agentsResult.rows || [];
    } catch (e) {
      console.warn('⚠️ Failed to fetch agents:', e);
    }
    
    // Get decision statistics
    let decisionStats = {
      total: 0,
      successful: 0,
      accuracy: 0,
      recent24h: 0,
      recent7d: 0
    };
    try {
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE was_successful = true) as successful,
          AVG(CASE WHEN was_successful IS NOT NULL THEN (was_successful::int * 100) ELSE NULL END) as accuracy,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent7d
        FROM ai_decisions
      `);
      if (statsResult.rows.length > 0 && statsResult.rows[0].total) {
        decisionStats = {
          total: parseInt(statsResult.rows[0].total) || 0,
          successful: parseInt(statsResult.rows[0].successful) || 0,
          accuracy: parseFloat(statsResult.rows[0].accuracy) || 0,
          recent24h: parseInt(statsResult.rows[0].recent24h) || 0,
          recent7d: parseInt(statsResult.rows[0].recent7d) || 0
        };
      }
    } catch (e) {
      console.warn('⚠️ Failed to fetch decision stats:', e);
    }
    
    // Get Artemis state
    let artemisState = {};
    try {
      const artemisResult = await query('SELECT * FROM artemis_state ORDER BY created_at DESC LIMIT 1');
      artemisState = artemisResult.rows[0] || {};
    } catch (e) {
      console.warn('⚠️ Failed to fetch Artemis state:', e);
    }
    
    // Calculate agent performance summary
    const agentSummary = {
      total: agents.length,
      active: agents.filter(a => a.status === 'active' && a.is_enabled !== false).length,
      idle: agents.filter(a => a.status === 'idle').length,
      training: agents.filter(a => a.status === 'training').length,
      error: agents.filter(a => a.status === 'error').length,
      avgAccuracy: agents.length > 0 
        ? agents.reduce((sum, a) => sum + (parseFloat(a.accuracy) || 0), 0) / agents.length 
        : 0,
      avgPerformance: agents.length > 0
        ? agents.reduce((sum, a) => sum + (parseFloat(a.performance_score) || 0), 0) / agents.length
        : 0
    };
    
    const overview = {
      artemis: {
        status: artemisState.status || 'active',
        mode: artemisState.mode || 'demo',
        strategy: artemisState.strategy || 'mixture_of_experts',
        overallAccuracy: parseFloat(artemisState.overall_accuracy) || decisionStats.accuracy,
        totalDecisions: artemisState.total_decisions || decisionStats.total,
        successfulDecisions: artemisState.successful_decisions || decisionStats.successful
      },
      agents: agentSummary,
      decisions: decisionStats,
      systemHealth: {
        cpu: 45, // Placeholder
        memory: 62, // Placeholder
        apiQuota: 85 // Placeholder
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json(overview);
  } catch (error) {
    console.error('Failed to fetch manager overview:', error);
    // Return default overview on error
    res.json({
      artemis: {
        status: 'active',
        mode: 'demo',
        strategy: 'mixture_of_experts',
        overallAccuracy: 0,
        totalDecisions: 0,
        successfulDecisions: 0
      },
      agents: {
        total: 0,
        active: 0,
        idle: 0,
        training: 0,
        error: 0,
        avgAccuracy: 0,
        avgPerformance: 0
      },
      decisions: {
        total: 0,
        successful: 0,
        accuracy: 0,
        recent24h: 0,
        recent7d: 0
      },
      systemHealth: {
        cpu: 0,
        memory: 0,
        apiQuota: 0
      },
      lastUpdated: new Date().toISOString()
    });
  }
});

// Get all AI agents
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM ai_agents ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch AI agents:', error);
    // If database is unavailable, return empty array instead of error
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      console.warn('⚠️ Database unavailable, returning empty AI agents array');
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to fetch AI agents', message: error.message });
  }
});

// Get AI agent by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM ai_agents WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AI agent not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AI agent' });
  }
});

// Update AI agent
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status, config, is_enabled } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (config !== undefined) {
      updates.push(`config = $${paramCount++}`);
      values.push(JSON.stringify(config));
    }
    if (is_enabled !== undefined) {
      updates.push(`is_enabled = $${paramCount++}`);
      values.push(is_enabled);
    }

    values.push(req.params.id);

    const result = await query(
      `UPDATE ai_agents SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AI agent not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update AI agent' });
  }
});

export default router;