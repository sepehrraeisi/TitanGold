import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { normalizeAgentConfig, mergeAgentConfig } from '../services/agentConfigDefaults.js';

import { aiService } from '../services/ai.js';
import * as riskAgent from '../services/risk-agent.js';
import agentRegistry from '../services/agents/registry.js';

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

// 6) Universal Decision Logger + Response Wrapper
async function logAndReturn(res, agentId, userId, decisionType, inputData, outputData, executionTimeMs, isCached = false, wasSuccessful = true) {
  try {
    // wasSuccessful is now explicit parameter (not guessed from output)
    const confidence = outputData?.confidence || null;
    
    await query(`
      INSERT INTO ai_decisions 
      (agent_id, user_id, decision_type, input_data, output_data, confidence, was_successful, execution_time_ms, created_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9::jsonb)
      RETURNING id
    `, [
      agentId,
      userId || null,
      decisionType,
      JSON.stringify(inputData),
      JSON.stringify(outputData),
      confidence,
      wasSuccessful,
      executionTimeMs,
      JSON.stringify({ cached: isCached })
    ]);
    console.log(`📝 Decision logged: agent=${agentId.substring(0,8)}, type=${decisionType}, success=${wasSuccessful}, cached=${isCached}, time=${executionTimeMs}ms`);
  } catch (err) {
    console.error('❌ Failed to log decision:', err.message);
    // Don't throw - logging failures shouldn't break the agent response
  }
  
  return res.json(outputData);
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

    // 🔥 NEW: Map UUID/agent_key to legacy agent IDs
    const originalId = id; // Keep original UUID for DB updates
    let agentId = id;
    
    // If UUID is received, lookup agent_key from database
    if (id.includes('-') && id.length > 20) {
      try {
        const agentResult = await query('SELECT agent_key FROM ai_agents WHERE id = $1', [id]);
        if (agentResult.rows.length > 0 && agentResult.rows[0].agent_key) {
          const agent_key = agentResult.rows[0].agent_key;
          
          // Map agent_key to legacy agent ID
          const agentKeyToLegacyId = {
            'technical': 'agent-1',
            'risk': 'agent-2',
            'sentiment': 'agent-3',
            'pattern': 'agent-4',
            'price_prediction': 'agent-5',
            'arbitrage': 'agent-6',
            'portfolio': 'agent-7',
            'liquidity': 'agent-8',
            'trend': 'agent-9',
            'optimization': 'agent-10',
            'order': 'agent-11',
            'fundamental': 'agent-12',
            'market_intelligence': 'agent-13',
            'volume': 'agent-14',
            'timing': 'agent-15'
          };
          
          agentId = agentKeyToLegacyId[agent_key] || id;
          console.log(`✅ Mapped UUID ${id.substring(0,8)}... → agent_key: ${agent_key} → legacy: ${agentId}`);
        }
      } catch (err) {
        console.error('❌ Failed to lookup agent_key:', err.message);
      }
    }

    // Validation
    if (!validateAgentId(agentId) && !agentId.startsWith('agent-')) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid agent ID format', 400);
    }
    if (symbol && !validateSymbol(symbol)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid symbol format', 400);
    }
    if (timeframe && !validateTimeframe(timeframe)) {
      return sendError(res, 'VALIDATION_ERROR', `Invalid timeframe. Allowed: ${VALID_TIMEFRAMES.join(', ')}`, 400);
    }

    // Cache key (agent + symbol + timeframe)
    const cacheKey = `agent:${agentId}:${symbol || 'default'}:${timeframe}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit for ${cacheKey}`);
      
      // 🔥 CRITICAL: Track performance even on cache hit
      // User clicked "Run Analysis" → Count it as a decision
      try {
        const isSuccessful = (cached.signal && cached.signal !== 'NEUTRAL') ? 1 : 0;
        await query(
          `UPDATE ai_agents
           SET total_decisions = COALESCE(total_decisions, 0) + 1,
               successful_decisions = COALESCE(successful_decisions, 0) + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [isSuccessful, originalId]
        );
        console.log(`📊 Performance tracked on cache hit: ${originalId.substring(0,8)}`);
      } catch (perfError) {
        console.error('⚠️  Failed to track cached performance:', perfError);
      }
      
      // 🔥 NEW: Log decision even for cache hits
      const agentKeyMapping = {
        'agent-1': 'technical_analysis',
        'agent-2': 'risk_assessment',
        'agent-3': 'sentiment_analysis',
        'agent-4': 'pattern_recognition',
        'agent-5': 'price_prediction',
        'agent-6': 'arbitrage',
        'agent-7': 'portfolio_allocation',
        'agent-8': 'liquidity_analysis',
        'agent-9': 'trend_analysis',
        'agent-10': 'optimization',
        'agent-11': 'order_management',
        'agent-12': 'fundamental_analysis',
        'agent-13': 'market_intelligence',
        'agent-14': 'volume_analysis',
        'agent-15': 'timing_analysis'
      };
      
      const decisionType = agentKeyMapping[agentId] || 'agent_run';
      
      // 🔥 FIXED: Per-agent input data (not generic symbol+timeframe)
      let inputData;
      if (agentId === 'agent-1') {
        // Technical: symbol + timeframe
        inputData = { symbol, timeframe };
      } else if (agentId === 'agent-2') {
        // Risk: symbol + action + amount
        inputData = { symbol, action: req.body.action, amount: req.body.amount };
      } else if (agentId === 'agent-15') {
        // Timing: symbol only
        inputData = { symbol };
      } else {
        // Others: generic
        inputData = { symbol, timeframe };
      }
      
      // ✅ Check if cached result is fallback
      const wasSuccessful = !(cached?._meta?.isFallback ?? false);
      
      return logAndReturn(
        res,
        originalId,
        req.user?.id,
        decisionType,
        inputData,
        cached,
        0, // execution time = 0 for cache hit
        true, // isCached = true
        wasSuccessful // ✅ correct even if cached fallback
      );
    }

    // ⏱️ Start timing for execution
    const startTime = Date.now();

    // Agent 1: Technical Analysis
    if (agentId === 'agent-1') {
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
          // Update performance metrics in database
          const isSuccessful = (parsed.signal && parsed.signal !== 'NEUTRAL') ? 1 : 0;
          try {
            await query(
              `UPDATE ai_agents
               SET total_decisions = COALESCE(total_decisions, 0) + 1,
                   successful_decisions = COALESCE(successful_decisions, 0) + $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [isSuccessful, originalId]
            );
            console.log(`📊 Performance updated for ${originalId.substring(0,8)}: total+1, successful+${isSuccessful}`);
          } catch (perfError) {
            console.error('⚠️  Failed to update performance:', perfError);
            // Don't fail the request if performance tracking fails
          }

          const result = {
            agentId: originalId,
            function: funcName || 'runTechnicalAnalysis',
            signal: parsed.signal || 'NEUTRAL',
            confidence: parsed.confidence ?? 55,
            indicators: parsed.indicators || {},
            symbol,
            timeframe,
            _meta: { isFallback: false } // ✅ Track success for cache
          };
          
          // Cache for 30s
          setCache(cacheKey, result, 30000);
          
          // 🔥 Log decision and return
          const executionTime = Date.now() - startTime;
          return logAndReturn(
            res,
            originalId,
            req.user?.id,
            'technical_analysis',
            { symbol, timeframe },
            result,
            executionTime,
            false, // isCached
            true   // wasSuccessful (parsed successfully)
          );
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
        timeframe,
        _meta: { isFallback: true } // ✅ Track fallback for cache
      };
      setCache(cacheKey, fallback1, 30000);
      
      // 🔥 Log fallback decision
      const executionTime = Date.now() - startTime;
      return logAndReturn(
        res,
        originalId,
        req.user?.id,
        'technical_analysis',
        { symbol, timeframe },
        fallback1,
        executionTime,
        false, // isCached
        false  // wasSuccessful (fallback = failure)
      );
    }

    // Agent 2: Risk Management
    // 🔥 SINGLE SOURCE OF TRUTH: Use shared risk-agent.js module
    if (agentId === 'agent-2') {
      try {
        // Prepare input for Risk Agent
        const inputData = {
          symbol: symbol || 'PORTFOLIO',
          action: req.body.action || 'ASSESS',
          amount: req.body.amount || 0,
          price: req.body.price
        };
        
        // Call shared Risk Agent logic (10s timeout)
        const riskResult = await riskAgent.runRiskAssessment(inputData, originalId, 10000);
        
        // Wrap result for API response
        const result = {
          agentId: originalId,
          function: funcName || 'runRiskAssessment',
          recommendation: riskResult.recommendation,
          confidence: riskResult.confidence,
          riskLevel: riskResult.riskLevel,
          symbol: riskResult.symbol,
          _meta: riskResult._meta // ✅ Includes isFallback, executionTime, source
        };
        
        // Cache for 30s
        setCache(cacheKey, result, 30000);
        
        // 🔥 Log decision and return
        const executionTime = riskResult._meta.executionTime;
        const wasSuccessful = !riskResult._meta.isFallback;
        
        return logAndReturn(
          res,
          originalId,
          req.user?.id,
          'risk_assessment',
          { symbol: inputData.symbol, action: inputData.action, amount: inputData.amount },
          result,
          executionTime,
          false, // isCached
          wasSuccessful
        );
        
      } catch (e) {
        console.error('Agent-2 error:', e);
        
        // Return error response
        const executionTime = Date.now() - startTime;
        const fallbackResult = {
          agentId: originalId,
          function: funcName || 'runRiskAssessment',
          recommendation: 'HOLD',
          confidence: 50,
          riskLevel: 'medium',
          symbol: symbol || 'PORTFOLIO',
          _meta: { 
            isFallback: true,
            executionTime,
            source: 'error',
            error: e.message
          }
        };
        
        setCache(cacheKey, fallbackResult, 30000);
        
        return logAndReturn(
          res,
          originalId,
          req.user?.id,
          'risk_assessment',
          { symbol, action: req.body.action, amount: req.body.amount },
          fallbackResult,
          executionTime,
          false, // isCached
          false  // wasSuccessful
        );
      }
    }

    // Agent 15: Timing
    if (agentId === 'agent-15') {
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
            symbol,
            _meta: { isFallback: false } // ✅ Track success for cache
          };
          
          // Cache for 30s
          setCache(cacheKey, result, 30000);
          
          // 🔥 Log decision and return
          const executionTime = Date.now() - startTime;
          return logAndReturn(
            res,
            originalId,
            req.user?.id,
            'timing_analysis',
            { symbol },
            result,
            executionTime,
            false, // isCached
            true   // wasSuccessful (parsed successfully)
          );
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
        symbol,
        _meta: { isFallback: true } // ✅ Track fallback for cache
      };
      setCache(cacheKey, fallback15, 30000);
      
      // 🔥 Log fallback decision
      const executionTime = Date.now() - startTime;
      return logAndReturn(
        res,
        originalId,
        req.user?.id,
        'timing_analysis',
        { symbol },
        fallback15,
        executionTime,
        false, // isCached
        false  // wasSuccessful (fallback = failure)
      );
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

// Agent Control Command (Pause, Start, Restart, etc.)
router.post('/:id/command', authenticate, rateLimit({ limit: 20, windowMs: 60000 }), async (req, res) => {
  try {
    const { id } = req.params;
    const { command } = req.body;

    if (!command) {
      return sendError(res, 'VALIDATION_ERROR', 'Command is required', 400);
    }

    const validCommands = ['start', 'pause', 'stop', 'restart', 'resume', 'enable', 'disable'];
    if (!validCommands.includes(command)) {
      return sendError(res, 'VALIDATION_ERROR', `Invalid command. Allowed: ${validCommands.join(', ')}`, 400);
    }

    // Map command to status
    let newStatus = 'active';
    let isEnabled = true;

    switch (command) {
      case 'start':
      case 'resume':
      case 'enable':
        newStatus = 'active';
        isEnabled = true;
        break;
      case 'pause':
      case 'stop':
        newStatus = 'inactive';
        isEnabled = true; // still enabled, just paused
        break;
      case 'disable':
        newStatus = 'inactive';
        isEnabled = false;
        break;
      case 'restart':
        newStatus = 'active';
        isEnabled = true;
        break;
    }

    // Update agent in database
    await query(`
      UPDATE ai_agents 
      SET status = $1, is_enabled = $2, updated_at = NOW()
      WHERE id = $3
    `, [newStatus, isEnabled, id]);

    console.log(`✅ Agent ${id.substring(0,8)}... ${command} → status: ${newStatus}, enabled: ${isEnabled}`);

    res.json({
      success: true,
      command,
      status: newStatus,
      isEnabled,
      message: `Agent ${command} successful`
    });

  } catch (error) {
    console.error('Agent command error:', error);
    sendError(res, 'COMMAND_ERROR', error.message || 'Failed to execute command', 500);
  }
});
// PATCH /api/ai-agents/:id/config - Update agent configuration
router.patch('/:id/config', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { config, metadata } = req.body;

    // Validate
    if (!config || typeof config !== 'object') {
      console.error('❌ Invalid config:', config);
      return sendError(res, 'VALIDATION_ERROR', 'config is required and must be an object', 400);
    }

    console.log(`🔧 Updating config for agent ${id.substring(0, 8)}...`);

    // Get current agent to access agent_key
    const currentAgent = await query('SELECT agent_key, config FROM ai_agents WHERE id = $1', [id]);
    
    if (currentAgent.rows.length === 0) {
      console.error('❌ Agent not found:', id);
      return sendError(res, 'NOT_FOUND', 'Agent not found', 404);
    }

    const agent_key = currentAgent.rows[0].agent_key;
    const currentConfig = currentAgent.rows[0].config;
    
    // Parse current config
    let existingConfig = {};
    if (currentConfig) {
      try {
        existingConfig = typeof currentConfig === 'object' ? currentConfig : JSON.parse(currentConfig);
      } catch (e) {
        console.warn('⚠️  Failed to parse existing config, using empty object');
      }
    }

    // Deep merge new config with existing (preserves nested objects)
    // CRITICAL: Use deep merge to prevent destroying nested objects like targetAllocation
    const mergedConfig = mergeAgentConfig(existingConfig, config);

    // Normalize to ensure all required fields exist
    const normalizedConfig = normalizeAgentConfig(agent_key, mergedConfig);

    console.log(`✅ Config normalized for ${agent_key}`);

    // Update in database with normalized config
    const result = await query(
      `UPDATE ai_agents
       SET config = $1,
           metadata = COALESCE($2, metadata),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, agent_key`,
      [
        JSON.stringify(normalizedConfig),
        metadata ? JSON.stringify(metadata) : null,
        id
      ]
    );

    const agent = result.rows[0];
    console.log(`✅ Config updated for ${agent.name} (${agent.agent_key})`);

    return res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        agent_key: agent.agent_key
      }
    });

  } catch (error) {
    console.error('❌ Update config error:', error);
    return sendError(res, 'SERVER_ERROR', error.message || 'Update failed', 500);
  }
});



// Agent Details (Config, Performance, Last Analysis)
router.get('/:id/details', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📊 Fetching details for agent: ${id.substring(0,8)}...`);

    const result = await query(
      `SELECT id, name, type, status, is_enabled, agent_key,
              config, metadata, updated_at, created_at,
              COALESCE(accuracy::float8, 0) AS accuracy,
              COALESCE(performance_score::float8, 0) AS performance_score,
              COALESCE(total_decisions, 0) AS total_decisions,
              COALESCE(successful_decisions, 0) AS successful_decisions
       FROM ai_agents
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Agent not found: ${id}`);
      return sendError(res, 'NOT_FOUND', 'Agent not found', 404);
    }

    const agent = result.rows[0];

    // Safe JSON parse for config/metadata
    const safeParse = (value) => {
      if (!value) return null;
      if (typeof value === 'object') return value; // Already parsed by pg
      try { return JSON.parse(value); } catch { return null; }
    };

    // Safe number conversion
    const toNum = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    const rawConfig = safeParse(agent.config);
    const metadata = safeParse(agent.metadata);

    // Use centralized config normalization
    const config = normalizeAgentConfig(agent.agent_key, rawConfig);

    console.log(`✅ Agent details loaded: ${agent.name} (${agent.agent_key})`);
    console.log(`   Accuracy: ${agent.accuracy} (type: ${typeof agent.accuracy})`);
    console.log(`   Performance: ${agent.performance_score} (type: ${typeof agent.performance_score})`);

    res.json({
      agent: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        agent_key: agent.agent_key,
        status: agent.status,
        is_enabled: agent.is_enabled,
        config,
        metadata,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      },
      performance: {
        accuracy: toNum(agent.accuracy),
        performanceScore: toNum(agent.performance_score),
        totalDecisions: parseInt(agent.total_decisions, 10) || 0,
        successfulDecisions: parseInt(agent.successful_decisions, 10) || 0,
      },
      lastAnalysis: null,
    });

  } catch (err) {
    console.error('❌ Agent details error:', err);
    sendError(res, 'SERVER_ERROR', err.message || 'Failed to load agent details', 500);
  }
});

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
      `SELECT 
        id, 
        agent_key, 
        name, 
        type,
        status,
        config,
        metadata,
        COALESCE(accuracy::float8, 0) AS accuracy,
        COALESCE(performance_score::float8, 0) AS performance_score,
        COALESCE(total_decisions, 0) AS total_decisions,
        COALESCE(successful_decisions, 0) AS successful_decisions,
        is_enabled,
        created_at,
        updated_at,
        last_active_at
      FROM ai_agents 
      ORDER BY agent_key`
    );
    
    // Map DB fields to UI contract
    const agents = result.rows.map(agent => {
      // Safe JSON parse
      const safeParse = (value) => {
        if (!value) return {};
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch { return {}; }
      };
      
      const config = safeParse(agent.config);
      const metadata = safeParse(agent.metadata);
      
      // Status mapping: idle/error -> inactive, active/training -> as-is
      let mappedStatus = agent.status;
      if (agent.status === 'idle' || agent.status === 'error') {
        mappedStatus = 'inactive';
      }
      
      // Extract capabilities from metadata
      const capabilities = metadata.capabilities || [];
      const role = metadata.role || 'AI Agent';
      
      return {
        id: agent.id,
        agent_key: agent.agent_key,
        name: agent.name,
        role,
        status: mappedStatus,
        accuracy: parseFloat(agent.accuracy) || 0,
        trainingProgress: 100, // Default: all agents are trained
        decisions: parseInt(agent.total_decisions, 10) || 0,
        learningTime: metadata.learning_time || '0h',
        knowledgeSize: metadata.knowledge_size || 'N/A',
        capabilities,
        lastUpdate: agent.updated_at || agent.created_at,
        // Additional fields for compatibility
        type: agent.type,
        is_enabled: agent.is_enabled,
        config,
        metadata
      };
    });
    
    res.json(agents);
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