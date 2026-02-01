// REGISTRY-BASED RUN ENDPOINT
// This is the NEW simplified version using agent registry
// To replace the old 420+ line endpoint in ai-agents.js

import { logger } from '../services/logger.js';
router.post('/:id/run', authenticate, rateLimit({ limit: 15, windowMs: 60000 }), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const { symbol, timeframe = '1h', ...extraParams } = req.body || {};
    
    logger.info(`🚀 Running agent: ${id.substring(0, 8)}... | symbol: ${symbol} | timeframe: ${timeframe}`);
    
    // Step 1: Get agent_key from database
    const agentResult = await query('SELECT agent_key, name FROM ai_agents WHERE id = $1', [id]);
    
    if (agentResult.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Agent not found', 404);
    }
    
    const { agent_key, name } = agentResult.rows[0];
    
    if (!agent_key) {
      return sendError(res, 'INVALID_AGENT', 'Agent missing agent_key', 400);
    }
    
    // Step 2: Validate inputs
    if (symbol && !validateSymbol(symbol)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid symbol format', 400);
    }
    if (timeframe && !validateTimeframe(timeframe)) {
      return sendError(res, 'VALIDATION_ERROR', `Invalid timeframe. Allowed: ${VALID_TIMEFRAMES.join(', ')}`, 400);
    }
    
    // Step 3: Check cache
    const cacheKey = `agent:${agent_key}:${symbol || 'default'}:${timeframe}`;
    const cached = getCache(cacheKey);
    
    if (cached) {
      logger.info(`✅ Cache hit for ${cacheKey}`);
      
      // Track performance even on cache hit
      try {
        const isSuccessful = !(cached?._meta?.isFallback ?? false);
        await query(
          `UPDATE ai_agents
           SET total_decisions = COALESCE(total_decisions, 0) + 1,
               successful_decisions = COALESCE(successful_decisions, 0) + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [isSuccessful ? 1 : 0, id]
        );
      } catch (perfError) {
        logger.warn('⚠️  Failed to track cached performance:', perfError);
      }
      
      // Log decision
      return logAndReturn(
        res,
        id,
        req.user?.id,
        `${agent_key}_analysis`,
        { symbol, timeframe, ...extraParams },
        cached,
        0, // cached, no execution time
        true, // isCached
        !(cached?._meta?.isFallback ?? false) // wasSuccessful
      );
    }
    
    // Step 4: Run agent via registry
    logger.info(`🔥 Running ${agent_key} agent via registry...`);
    
    const result = await agentRegistry.runAgent(agent_key, {
      userId: req.user?.id,
      symbol,
      timeframe,
      config: extraParams
    });
    
    // Step 5: Update performance metrics
    const isSuccessful = result && !result._meta?.isFallback;
    
    try {
      await query(
        `UPDATE ai_agents
         SET total_decisions = COALESCE(total_decisions, 0) + 1,
             successful_decisions = COALESCE(successful_decisions, 0) + $1,
             last_active_at = NOW(),
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{last_result}',
               $2::jsonb
             ),
             updated_at = NOW()
         WHERE id = $3`,
        [isSuccessful ? 1 : 0, JSON.stringify(result), id]
      );
      logger.info(`📊 Performance updated for ${name} (${agent_key})`);
    } catch (perfError) {
      logger.error('⚠️  Failed to update performance:', perfError);
    }
    
    // Step 6: Cache result
    setCache(cacheKey, result, 30000); // 30s cache
    
    // Step 7: Log decision and return
    const executionTime = Date.now() - startTime;
    
    return logAndReturn(
      res,
      id,
      req.user?.id,
      `${agent_key}_analysis`,
      { symbol, timeframe, ...extraParams },
      result,
      executionTime,
      false, // not cached
      isSuccessful
    );
    
  } catch (error) {
    logger.error('❌ Agent run failed:', error);
    
    // Log failed decision
    const executionTime = Date.now() - startTime;
    const errorResult = {
      error: error.message,
      timestamp: new Date().toISOString(),
      _meta: { isFallback: true, source: 'error' }
    };
    
    try {
      await logAndReturn(
        res,
        req.params.id,
        req.user?.id,
        'agent_run_error',
        { symbol: req.body?.symbol, timeframe: req.body?.timeframe },
        errorResult,
        executionTime,
        false,
        false // failed
      );
    } catch (logError) {
      // If logging fails, send direct error response
      if (error.message?.includes('Agent not found')) {
        return sendError(res, 'AGENT_NOT_FOUND', error.message, 404);
      }
      return sendError(res, 'AI_ERROR', error.message || 'Failed to run agent', 500);
    }
  }
});
