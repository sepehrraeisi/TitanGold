import express from 'express';
import { authenticate, authenticateStrict } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAP } from '../services/capabilities.js';
import { evaluateExecutionPolicy, evaluateConfigurePolicy, REASON } from '../services/agentExecutionPolicyService.js';
import { sanitizePolicy, writeExecutionAudit } from '../services/agentExecutionService.js';
import { query } from '../database/db.js';
import { normalizeAgentConfig, mergeAgentConfig } from '../services/agentConfigDefaults.js';
import { normalizeArbitrageConfig } from '../services/normalizeArbitrageConfig.js';
import { normalizeFundamentalConfig } from '../services/normalizeFundamentalConfig.js';
import {
  ARBITRAGE_DECISION_TYPE,
  buildArbitrageMetricsFromNormalized,
  buildLastScanPayload,
  countArbitrageScans,
  fetchArbitrageScanHistory,
  getArbitrageScanCountsByAgentIds,
  normalizeScanResult,
} from '../services/arbitrageScanContract.js';
import { readAnalyticalSchedulerStatus } from '../services/analyticalSchedulerStatus.js';
import { buildAgentStatusProjection } from '../services/agentStatusProjection.js';
import { getRuntimeExecutionState } from '../services/runtimeExecutionStateService.js';
import { contentNegotiation } from '../middleware/contentNegotiation.js';
import { getCache, setCache, buildCacheKey, invalidateAgentCache } from '../services/cache.js';

import { aiService } from '../services/ai.js';
import * as riskAgent from '../services/risk-agent.js';
import agentRegistry from '../services/agents/registry.js';
import { logger } from '../services/logger.js';
import { webhookDispatcher } from '../services/webhookDispatcher.js';
import * as experiments from '../services/experiments.js'; // BACKEND-022: A/B testing
import { notifyAgentStarted, notifyAgentCompleted, notifyAgentFailed } from '../websocket/server.js'; // BACKEND-023: WebSocket updates
import { validateBody, validateParams, validateQuery, validateResponse } from '../middleware/validation.js';
import {
  listAgentsQuerySchema,
  getAgentParamsSchema,
  createAgentBodySchema,
  updateAgentParamsSchema,
  updateAgentBodySchema,
  analyzeParamsSchema,
  analyzeBodySchema,
  chatParamsSchema,
  chatBodySchema,
  agentConfigPatchSchema,
  agentListResponseSchema,
  agentResponseSchema,
  agentAnalysisResponseSchema,
  agentChatResponseSchema,
  managerOverviewResponseSchema
} from '../schemas/agentSchemas.js';

const router = express.Router();

// ============================================================================
// Production++ Helpers for AI Routes
// ============================================================================

/**
 * Shared transformation helper for AI agents to ensure consistency between
 * list and detail views, and to conform to UI contracts.
 */
const transformAgent = (agent, decisionStats = { total: 0, successful: 0, learning_hours: 0 }) => {
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

  const realAccuracy = decisionStats.total > 0
    ? (decisionStats.successful / decisionStats.total) * 100
    : 0;
  const learningHours = parseFloat(decisionStats.learning_hours) || 0;

  // Calculate knowledge size from decision data
  const avgDecisionSize = 2; // KB per decision (estimate)
  const knowledgeMB = ((decisionStats.total * avgDecisionSize) / 1024).toFixed(1);

  // Agent-specific metrics (based on agent type)
  const baseMetrics = {
    id: agent.id,
    agent_key: agent.agent_key,
    name: agent.name,
    role,
    status: mappedStatus,
    decisions: parseInt(decisionStats.total, 10),
    capabilities,
    lastUpdate: agent.updated_at || agent.created_at,
    // Additional fields for compatibility
    type: agent.type,
    is_enabled: agent.is_enabled,
    config,
    metadata,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    last_active_at: agent.last_active_at,
    accuracy: agent.accuracy ? parseFloat(agent.accuracy) : 0,
    performance_score: agent.performance_score ? parseFloat(agent.performance_score) : 0
  };

  // For rule-based agents (fundamental, arbitrage): Don't show ML-specific metrics
  if (agent.agent_key === 'fundamental') {
    return {
      ...baseMetrics,
      accuracy: null,
      trainingProgress: null,
      learningTime: null,
      knowledgeSize: null,
      totalAnalyses: parseInt(decisionStats.total, 10),
      activeHours: parseFloat(learningHours.toFixed(1)),
      dataStoredMB: parseFloat(knowledgeMB)
    };
  }

  if (agent.agent_key === 'arbitrage') {
    // ARB-WP1A: decisionStats.total must be arbitrage_scan count (injected by list handler).
    // ai_agents.total_decisions is deprecated for Arbitrage and must not be used.
    const scanTotal = parseInt(decisionStats.total, 10) || 0;
    const lastScanAt =
      decisionStats.last_completed_at ||
      agent.last_active_at ||
      agent.updated_at ||
      agent.created_at;
    return {
      ...baseMetrics,
      accuracy: null,
      trainingProgress: null,
      learningTime: null,
      knowledgeSize: null,
      decisions: scanTotal,
      totalScans: scanTotal,
      lastUpdate: lastScanAt,
      last_active_at: lastScanAt,
      activeHours: parseFloat(learningHours.toFixed(1)),
      dataStoredMB: parseFloat(knowledgeMB),
      opportunitiesFound: metadata?.last_result?.candidateStats?.spreadCandidates ?? 0,
      // Never expose estimated last-scan sum as captured/realized profit
      totalProfitUSDT: null,
      analyticalMode: 'analytical_spread_monitor',
      executionSupported: false,
    };
  }

  if (agent.agent_key === 'liquidity') {
    return {
      ...baseMetrics,
      accuracy: null,
      trainingProgress: null,
      learningTime: null,
      knowledgeSize: null,
      totalScans: parseInt(decisionStats.total, 10),
      activeHours: parseFloat(learningHours.toFixed(1)),
      avgLiquidityScore: metadata?.avg_liquidity_score || 0,
      avgSpread: metadata?.avg_spread || 0,
      avgSlippage50k: metadata?.avg_slippage_50k || 0,
      riskLevel: metadata?.current_risk_level || 'low',
      alertsTriggered: metadata?.alerts_count || 0
    };
  }

  // For ML agents: Show all metrics
  return {
    ...baseMetrics,
    accuracy: parseFloat(realAccuracy.toFixed(1)),
    trainingProgress: decisionStats.total > 0 ? 100 : 0,
    learningTime: learningHours.toFixed(1) + 'h',
    knowledgeSize: knowledgeMB + 'MB'
  };
};// 1) Normalized Error Response (with UI crash prevention)
function sendError(res, code, message, status = 400, details = null) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      details: details || undefined
    },
    // ✅ CRITICAL: Prevent UI crash on .filter()
    // Even if auth fails or agent errors, UI won't crash
    indicators: [],
    result: {
      indicators: []
    }
  });
}

// 2) Timeout Wrapper with Logging
/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMessage - Custom error message
 * @param {string} agentKey - Agent key for logging (optional)
 * @returns {Promise} Promise that rejects on timeout
 */
async function withTimeout(promise, ms, errorMessage = 'Operation timed out', agentKey = 'unknown') {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutError = new Error(errorMessage);
      timeoutError.isTimeout = true;
      timeoutError.agentKey = agentKey;
      logger.error(`⏱️  TIMEOUT: Agent ${agentKey} exceeded ${ms}ms limit`);
      reject(timeoutError);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]);
}

// 3) Input Validation
const VALID_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
const SYMBOL_REGEX = /^[A-Z0-9]{3,20}$/;

function validateAgentId(id) {
  // agent-<num> or UUID format
  return /^agent-\d+$/.test(id) || /^[a-f0-9-]{36}$/.test(id);
}

function isValidUUID(id) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
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
    logger.info(`📝 Decision logged: agent=${agentId.substring(0, 8)}, type=${decisionType}, success=${wasSuccessful}, cached=${isCached}, time=${executionTimeMs}ms`);
  } catch (err) {
    logger.error('❌ Failed to log decision:', err.message);
    // Don't throw - logging failures shouldn't break the agent response
  }

  return res.json(outputData);
}

// ============================================================================
// Transform Registry Result to UI Format
// ============================================================================
/**
 * Transforms agent registry result to UI-compatible format
 * Handles: indicators object → array, signal normalization, confidence, etc.
 */
function transformAgentResultForUI(agent_key, rawResult) {
  try {
    const { symbol, timeframe, confidence, signal, indicators, timestamp, _meta } = rawResult;

    // Special handling for arbitrage agent — preserve WP1A classification fields
    if (agent_key === 'arbitrage') {
      return {
        ...rawResult,
        timestamp: rawResult.timestamp || new Date().toISOString(),
        confidence: typeof rawResult.confidence === 'number' ? rawResult.confidence : 0.5,
        indicators: [],
        summary: rawResult.summary || {},
        candidates: rawResult.candidates || [],
        rejectedCandidates: rawResult.rejectedCandidates || [],
        qualifiedOpportunities: rawResult.qualifiedOpportunities || [],
        // Empty: same-market spreads are not qualified opportunities
        opportunities: rawResult.opportunities || [],
        riskAlerts: rawResult.riskAlerts || [],
        config: rawResult.config || {},
        analyticalMode: rawResult.analyticalMode || 'analytical_spread_monitor',
        execution: rawResult.execution || { supported: false, realizedProfitUSDT: null },
        _meta: rawResult._meta || { source: 'real', version: '2.0.0-wp1a' },
      };
    }

    // Special handling for fundamental agent
    if (agent_key === 'fundamental') {
      return {
        timestamp: rawResult.timestamp || new Date().toISOString(),
        symbol: rawResult.symbol || 'UNKNOWN',
        timeframe: rawResult.timeframe || '1d',
        decision: rawResult.decision || 'hold',
        confidence: typeof rawResult.confidence === 'number' ? rawResult.confidence : 0.5,

        // UI-expected fields
        averageScore: typeof rawResult.averageScore === 'number' ? rawResult.averageScore : (rawResult.score?.total || 0),
        marketSummary: rawResult.marketSummary || {
          fearGreed: 50,
          macroLabel: 'Neutral',
          fundingImbalance: 0
        },
        alerts: Array.isArray(rawResult.alerts) ? rawResult.alerts : [],

        // Fundamental-specific fields (preserve all)
        score: rawResult.score || { total: 0, macro: 0, funding: 0, onchain: 0, news: 0 },
        overview: rawResult.overview || {},
        company_project_data: rawResult.company_project_data || {},
        financial_ratios: rawResult.financial_ratios || {},
        events_news: rawResult.events_news || {},
        onchain_tokenomics: rawResult.onchain_tokenomics || {},
        fair_value: rawResult.fair_value || {},
        signals: Array.isArray(rawResult.signals) ? rawResult.signals : [],
        raw: rawResult.raw || {},

        // Meta
        _meta: rawResult._meta || { source: 'real', version: '2.0.0' }
      };
    }

    // Default structure for other agents
    const uiResult = {
      timestamp: timestamp || new Date().toISOString(),
      symbol: symbol || 'UNKNOWN',
      timeframe: timeframe || '1h',
      signal: (signal || 'NEUTRAL').toLowerCase(), // UI expects lowercase: buy, sell, hold/neutral
      confidence: typeof confidence === 'number' ? confidence : 0.5,
      indicators: [],
      reasoning: `${agent_key} analysis complete (source: ${_meta?.source || 'unknown'})`,
      _meta: _meta || { source: 'mock', version: '1.0.0' }
    };

    // Transform indicators: object → array
    if (indicators && typeof indicators === 'object' && !Array.isArray(indicators)) {
      // Technical agent format: { rsi: 54, macd: {...}, trend: 'bullish', ... }
      const indicatorArray = [];

      Object.entries(indicators).forEach(([key, value]) => {
        if (typeof value === 'number') {
          // Simple numeric indicator (e.g., rsi: 54)
          indicatorArray.push({
            indicatorId: key.toUpperCase(),
            value: value,
            signal: value > 50 ? 'buy' : value < 50 ? 'sell' : 'neutral',
            weight: 50
          });
        } else if (typeof value === 'object' && value !== null) {
          // Complex indicator (e.g., macd: { value: -0.38, signal: 'bearish', histogram: ... })
          const indicatorValue = value.value || 0;
          let indicatorSignal = 'neutral';

          // Normalize signal: can be numeric (MACD signal line) or string ('bearish')
          if (typeof value.signal === 'string') {
            indicatorSignal = value.signal.toLowerCase() === 'bearish' ? 'sell' :
              value.signal.toLowerCase() === 'bullish' ? 'buy' : 'neutral';
          } else if (typeof value.signal === 'number') {
            // For MACD: if histogram is negative → sell, positive → buy
            if (value.histogram !== undefined) {
              indicatorSignal = value.histogram < 0 ? 'sell' : value.histogram > 0 ? 'buy' : 'neutral';
            } else {
              indicatorSignal = indicatorValue > value.signal ? 'buy' : indicatorValue < value.signal ? 'sell' : 'neutral';
            }
          }

          indicatorArray.push({
            indicatorId: key.toUpperCase(),
            value: indicatorValue,
            signal: indicatorSignal,
            weight: value.weight || 50
          });
        } else if (typeof value === 'string') {
          // String indicator (e.g., trend: 'bullish')
          indicatorArray.push({
            indicatorId: key.toUpperCase(),
            value: value === 'bullish' ? 70 : value === 'bearish' ? 30 : 50,
            signal: value === 'bullish' ? 'buy' : value === 'bearish' ? 'sell' : 'neutral',
            weight: 60
          });
        }
      });

      uiResult.indicators = indicatorArray;
    } else if (Array.isArray(indicators)) {
      // Already in array format
      uiResult.indicators = indicators;
    }

    // Add priceTarget if available (optional)
    if (rawResult.priceTarget) {
      uiResult.priceTarget = rawResult.priceTarget;
    }

    // ✅ SAFETY: Ensure indicators is ALWAYS an array (never undefined/null)
    uiResult.indicators = Array.isArray(uiResult.indicators) ? uiResult.indicators : [];

    return uiResult;
  } catch (error) {
    logger.error('❌ Transform error:', error.message);
    // Fallback: return raw result
    return rawResult;
  }
}

// ============================================================================
// Routes
// ============================================================================

router.post('/chat', authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE), rateLimit({ limit: 10, windowMs: 60000 }), validateBody(chatBodySchema), validateResponse(agentChatResponseSchema), async (req, res) => {
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
    logger.error('AI chat error:', error);
    if (error.message?.includes('timeout')) {
      return sendError(res, 'AI_TIMEOUT', 'AI service timed out', 504);
    }
    return sendError(res, 'AI_ERROR', 'Failed to get AI response', 500, { error: error.message });
  }
});

// ============================================================================
// Registry-based Run Handler (Shared between /run and /run-v2)
// ============================================================================
async function runAgentViaRegistry(req, res) {
  try {
    const { id } = req.params;
    const { symbol, timeframe, config, input } = req.body || {};

    logger.info(`🚀 [Registry] Running agent: ${id.substring(0, 8)}... | symbol: ${symbol} | timeframe: ${timeframe}`);

    // Basic validations
    if (!isValidUUID(id)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid agent ID format', 400);
    }
    if (symbol && !validateSymbol(symbol)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid symbol format', 400);
    }

    // Load agent row (must include agent_key)
    const agentResult = await query(
      `SELECT id, agent_key, name, type, status, config, metadata, is_enabled
       FROM ai_agents
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (agentResult.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'AI agent not found', 404);
    }

    const agent = agentResult.rows[0];

    if (!agent.is_enabled) {
      return sendError(res, 'DISABLED', 'AI agent is disabled', 403);
    }

    if (!agent.agent_key) {
      return sendError(res, 'CONTRACT_ERROR', 'Agent missing agent_key (seed/migration issue)', 500);
    }

    // Merge DB config with request override
    const mergedConfig = {
      ...(agent.config || {}),
      ...(config || {})
    };

    logger.info(`✅ [Registry] Agent loaded: ${agent.agent_key} (${agent.name})`);

    const confirmLive = req.body?.confirm_live === true || req.body?.confirmLive === true;
    const executionPolicy = await evaluateExecutionPolicy({
      identityType: 'user',
      user: req.user,
      agentKey: agent.agent_key,
      agentEnabled: agent.is_enabled,
      params: { symbol, timeframe, config: mergedConfig, input, action: input?.action },
      confirmLive,
      action: 'agent.run',
    });

    await writeExecutionAudit({
      userId: req.user?.id,
      agentId: agent.id,
      agentKey: agent.agent_key,
      action: 'run',
      allowed: executionPolicy.allowed,
      reasonCode: executionPolicy.reasonCode,
      effectiveMode: executionPolicy.effectiveMode,
      sideEffectsSuppressed: executionPolicy.sideEffectsSuppressed,
    });

    if (!executionPolicy.allowed) {
      const status = executionPolicy.reasonCode === REASON.CONFIRMATION_REQUIRED ? 409 : 403;
      return sendError(
        res,
        executionPolicy.reasonCode,
        executionPolicy.suppressionReason || executionPolicy.reasonCode,
        status,
        { policy: sanitizePolicy(executionPolicy) },
      );
    }

    const sideEffectsSuppressed = executionPolicy.sideEffectsSuppressed;
    req.executionPolicy = executionPolicy;

    // BACKEND-022: Check for active A/B test experiments
    let experimentData = null;
    let assignedVariant = null;
    const experimentKey = req.query.experiment || req.body.experiment;

    if (experimentKey && req.user?.id) {
      try {
        // Get variant assignment for this user
        const assignment = await experiments.getVariantAssignment(experimentKey, req.user.id);
        assignedVariant = assignment.variant;
        experimentData = {
          experiment_key: experimentKey,
          experiment_id: assignment.experiment_id,
          variant: assignedVariant,
          version: assignment.version,
          is_new_assignment: assignment.is_new_assignment
        };

        logger.info(`🧪 [Experiment] User assigned to variant ${assignedVariant} (version ${assignment.version}) for ${experimentKey}`);

        // TODO: In future, could dynamically load the assigned version
        // For now, we track metrics for the current version
      } catch (expError) {
        // Don't fail the request if experiment lookup fails
        logger.warn(`⚠️  [Experiment] Failed to get assignment for ${experimentKey}:`, expError.message);
      }
    }

    // Get timeout from env or use default (30 seconds)
    const timeoutMs = parseInt(process.env.AGENT_TIMEOUT_MS || '30000', 10);
    logger.info(`⏱️  [Registry] Timeout set to ${timeoutMs}ms for ${agent.agent_key}`);

    // BACKEND-022: Track execution start for experiment metrics (needed in catch block too)
    const executionStart = Date.now();

    if (!sideEffectsSuppressed) {
      try {
        notifyAgentStarted(agent.id, agent.agent_key, req.user?.id, {
          symbol,
          timeframe,
          config: mergedConfig,
        });
      } catch (wsError) {
        logger.warn(`⚠️ Failed to send WebSocket start notification: ${wsError.message}`);
      }
    }

    const result = await withTimeout(
      agentRegistry.runAgent(agent.agent_key, {
        userId: req.user?.id,
        agent_id: agent.id,
        symbol,
        timeframe,
        config: mergedConfig,
        input: {
          ...(input || {}),
          dry_run: sideEffectsSuppressed || executionPolicy.effectiveMode !== 'live',
          effective_mode: executionPolicy.effectiveMode,
        },
      }),
      timeoutMs,
      `Agent ${agent.agent_key} execution timed out after ${timeoutMs}ms`,
      agent.agent_key
    );
    const executionTimeMs = Date.now() - executionStart;

    logger.info(`✅ [Registry] Agent execution complete: ${agent.agent_key} (${executionTimeMs}ms)`);

    // BACKEND-022: Record experiment metrics if experiment is active
    if (experimentData && assignedVariant) {
      try {
        await experiments.recordMetric({
          experiment_key: experimentData.experiment_key,
          variant: assignedVariant,
          agent_id: agent.id,
          user_id: req.user?.id,
          execution_time_ms: executionTimeMs,
          success: true,
          cache_hit: result?._meta?.cached || false,
          confidence: typeof result?.confidence === 'number' ? result.confidence : null,
          custom_metrics: {
            symbol,
            timeframe
          }
        });
        logger.info(`📊 [Experiment] Recorded metric for variant ${assignedVariant}`);
      } catch (expError) {
        logger.warn(`⚠️  [Experiment] Failed to record metric:`, expError.message);
      }
    }

    // Transform result to UI-compatible format
    const uiResult = transformAgentResultForUI(agent.agent_key, result);

    // Persist decision (minimal, consistent)
    await query(
      `INSERT INTO ai_decisions (agent_id, decision_type, confidence, input_data, output_data, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, NOW())`,
      [
        agent.id,
        result?.decision_type || 'analysis',
        typeof result?.confidence === 'number' ? result.confidence : 0.5,
        JSON.stringify({ symbol, timeframe, config: mergedConfig, input }),
        JSON.stringify(result || {})
      ]
    );

    logger.info(`📝 [Registry] Decision logged for ${agent.agent_key}`);

    // Update agent metadata snapshot + last_active_at
    const newMetadata = {
      ...(agent.metadata || {}),
      last_result: result || null,
      last_error: null,
      last_run_at: new Date().toISOString()
    };

    await query(
      `UPDATE ai_agents
       SET last_active_at = NOW(),
           updated_at = NOW(),
           metadata = $2::jsonb
       WHERE id = $1`,
      [agent.id, JSON.stringify(newMetadata)]
    );

    logger.info(`📊 [Registry] Agent metadata updated for ${agent.agent_key}`);

    if (!sideEffectsSuppressed) {
      try {
        await webhookDispatcher.triggerAgentEvent(
          req.user?.id,
          'agent.completed',
          {
            agent_id: agent.id,
            agent_key: agent.agent_key,
            agent_name: agent.name,
            symbol,
            timeframe,
            effective_mode: executionPolicy.effectiveMode,
            timestamp: new Date().toISOString(),
          },
        );
      } catch (webhookError) {
        logger.error(`❌ [Webhook] Failed to trigger for ${agent.agent_key}:`, webhookError.message);
      }

      try {
        notifyAgentCompleted(agent.id, agent.agent_key, req.user?.id, uiResult, {
          execution_time_ms: executionTimeMs,
          symbol,
          timeframe,
        });
      } catch (wsError) {
        logger.warn(`⚠️ Failed to send WebSocket completion notification: ${wsError.message}`);
      }
    }

    // ✅ Safety: Ensure indicators is always an array
    const safeIndicators = Array.isArray(uiResult?.indicators) ? uiResult.indicators : [];

    // ✅ Return DUAL format for maximum UI compatibility:
    // - Top-level fields (for UIs that read directly: data.indicators)
    // - Also inside 'result' (for UIs that read: data.result.indicators)
    return res.json({
      ok: true,
      agent_id: agent.id,
      agent_key: agent.agent_key,
      policy: sanitizePolicy(executionPolicy),
      execution: {
        requested_mode: executionPolicy.requestedMode,
        effective_mode: executionPolicy.effectiveMode,
        side_effects_suppressed: sideEffectsSuppressed,
        suppression_reason: executionPolicy.suppressionReason,
      },
      ...uiResult,
      indicators: safeIndicators,
      result: {
        ...uiResult,
        indicators: safeIndicators,
      },
    });
  } catch (error) {
    logger.error('❌ [Registry] Run error:', error);

    // Check if this is a timeout error
    const isTimeout = error.isTimeout === true;
    const statusCode = isTimeout ? 504 : 500;
    const errorCode = isTimeout ? 'AGENT_TIMEOUT' : 'AI_ERROR';

    if (isTimeout) {
      logger.error(`⏱️  [Registry] TIMEOUT ERROR: ${error.agentKey} - ${error.message}`);
    }

    // Best-effort: store last_error on agent if id is valid
    try {
      const { id } = req.params;
      if (isValidUUID(id)) {
        const r = await query(`SELECT metadata FROM ai_agents WHERE id=$1 LIMIT 1`, [id]);
        if (r.rows.length) {
          const md = r.rows[0].metadata || {};
          md.last_error = {
            message: error.message || 'Unknown error',
            isTimeout: isTimeout,
            at: new Date().toISOString()
          };
          await query(
            `UPDATE ai_agents SET metadata=$2::jsonb, updated_at=NOW() WHERE id=$1`,
            [id, JSON.stringify(md)]
          );
        }
      }
    } catch (updateErr) {
      // Ignore metadata update errors
    }

    // BACKEND-022: Record experiment failure metrics if experiment is active
    if (experimentData && assignedVariant) {
      try {
        const executionTimeMs = Date.now() - executionStart;
        await experiments.recordMetric({
          experiment_key: experimentData.experiment_key,
          variant: assignedVariant,
          agent_id: req.params.id,
          user_id: req.user?.id,
          execution_time_ms: executionTimeMs,
          success: false,
          error_type: isTimeout ? 'timeout' : 'execution_error',
          error_message: error.message,
          custom_metrics: {
            symbol: req.body.symbol,
            timeframe: req.body.timeframe
          }
        });
        logger.info(`📊 [Experiment] Recorded failure metric for variant ${assignedVariant}`);
      } catch (expError) {
        logger.warn(`⚠️  [Experiment] Failed to record failure metric:`, expError.message);
      }
    }

    // ✅ Trigger webhooks for agent failure (API-008)
    try {
      const eventType = isTimeout ? 'agent.timeout' : 'agent.failed';
      await webhookDispatcher.triggerAgentEvent(
        req.user?.id,
        eventType,
        {
          agent_id: req.params.id,
          agent_key: error.agentKey || 'unknown',
          error_message: error.message,
          is_timeout: isTimeout,
          timestamp: new Date().toISOString()
        }
      );
      logger.info(`🔔 [Webhook] Triggered ${eventType} for agent`);
    } catch (webhookError) {
      // Don't fail the request if webhooks fail
      logger.error(`❌ [Webhook] Failed to trigger:`, webhookError.message);
    }

    // BACKEND-023: Notify WebSocket clients of failure
    try {
      notifyAgentFailed(req.params.id, error.agentKey || 'unknown', req.user?.id, error, {
        is_timeout: isTimeout,
        execution_time_ms: Date.now() - executionStart
      });
    } catch (wsError) {
      logger.warn(`⚠️ Failed to send WebSocket failure notification: ${wsError.message}`);
    }

    return sendError(res, errorCode, error.message || 'Failed to run agent', statusCode);
  }
}

// ============================================================================
// Registry-based Run Endpoint (V2) - SAFE MIGRATION PATH
// POST /api/ai-agents/:id/run-v2
// Supports: application/json (default), text/csv (export)
// ============================================================================
router.post('/:id/run-v2', authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE), contentNegotiation(['json', 'csv']), rateLimit({ limit: 15, windowMs: 60000 }), validateParams(analyzeParamsSchema), validateBody(analyzeBodySchema), validateResponse(agentAnalysisResponseSchema), runAgentViaRegistry);

// ============================================================================
// LEGACY /run endpoint - NOW USES REGISTRY (same as /run-v2)
// POST /api/ai-agents/:id/run
// Supports: application/json (default), text/csv (export)
// ============================================================================
router.post('/:id/run', authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE), contentNegotiation(['json', 'csv']), rateLimit({ limit: 15, windowMs: 60000 }), validateParams(analyzeParamsSchema), validateBody(analyzeBodySchema), validateResponse(agentAnalysisResponseSchema), runAgentViaRegistry);

// Legacy run-OLD handler removed — see git history before e8b3de4 if needed.

// Agent Control Command (Pause, Start, Restart, etc.)
// Agent Control Command (Pause, Start, Restart, etc.)
router.post('/:id/command', authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE), rateLimit({ limit: 20, windowMs: 60000 }), async (req, res) => {
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

    logger.info(`✅ Agent ${id.substring(0, 8)}... ${command} → status: ${newStatus}, enabled: ${isEnabled}`);

    res.json({
      success: true,
      command,
      status: newStatus,
      isEnabled,
      message: `Agent ${command} successful`
    });

  } catch (error) {
    logger.error('Agent command error:', error);
    sendError(res, 'COMMAND_ERROR', error.message || 'Failed to execute command', 500);
  }
});
// PATCH /api/ai-agents/:id/config - Update agent configuration
router.patch('/:id/config', authenticateStrict, requireCapability(CAP.AI_AGENT_CONFIGURE), validateBody(agentConfigPatchSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { config, metadata } = req.body;

    const configurePolicy = await evaluateConfigurePolicy(req.user, 'agent.configure');
    if (!configurePolicy.allowed) {
      return sendError(res, configurePolicy.reasonCode, 'Insufficient permissions', 403);
    }

    // Validate
    if (!config || typeof config !== 'object') {
      logger.error('❌ Invalid config:', config);
      return sendError(res, 'VALIDATION_ERROR', 'config is required and must be an object', 400);
    }

    logger.info(`🔧 Updating config for agent ${id.substring(0, 8)}...`);

    // Get current agent to access agent_key
    const currentAgent = await query('SELECT agent_key, config FROM ai_agents WHERE id = $1', [id]);

    if (currentAgent.rows.length === 0) {
      logger.error('❌ Agent not found:', id);
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
        logger.warn('⚠️  Failed to parse existing config, using empty object');
      }
    }

    // Deep merge new config with existing (preserves nested objects)
    // CRITICAL: Use deep merge to prevent destroying nested objects like targetAllocation
    const mergedConfig = mergeAgentConfig(existingConfig, config);

    // Normalize to ensure all required fields exist
    let normalizedConfig;
    if (agent_key === 'arbitrage') {
      normalizedConfig = normalizeArbitrageConfig(mergedConfig);
      // ARB-WP1A: preserve stored autoExecute preference; never treat it as operational.
      // UI must not enable Live auto-execution for this non-live-capable agent.
      if (normalizedConfig.execution) {
        normalizedConfig.execution.autoExecute = existingConfig?.execution?.autoExecute === true;
        normalizedConfig.execution.autoExecuteSupported = false;
      }
      // Keep unsupported strategy flags disabled in persisted operational sense
      if (Array.isArray(normalizedConfig.strategies)) {
        normalizedConfig.strategies = normalizedConfig.strategies.map((s) => {
          if (!s) return s;
          if (s.type === 'triangle' || s.type === 'triangular' || s.type === 'cross_exchange' || s.type === 'spot_vs_perp') {
            return { ...s, enabled: false, supported: false };
          }
          if (s.type === 'spot') {
            return { ...s, type: 'spot', supported: true, labelKey: 'strategy_mexc_spot_spread_monitor' };
          }
          return s;
        });
      }
    } else if (agent_key === 'fundamental') {
      normalizedConfig = normalizeFundamentalConfig(mergedConfig);
    } else {
      normalizedConfig = normalizeAgentConfig(agent_key, mergedConfig);
    }

    logger.info(`✅ Config normalized for ${agent_key}`);

    // Update in database with normalized config
    // 🔥 CRITICAL: Use JSONB merge operator to preserve existing fields
    // Old way: SET config = $1  ← Replaced entire config
    // New way: SET config = config || $1  ← Merges new fields into existing config
    const result = await query(
      `UPDATE ai_agents
       SET config = COALESCE(config, '{}'::jsonb) || $1::jsonb,
           metadata = COALESCE($2, metadata),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, agent_key, config`,
      [
        // PostgreSQL node driver auto-converts objects to JSONB
        normalizedConfig,  // Don't stringify - let pg driver handle it
        metadata ? JSON.stringify(metadata) : null,
        id
      ]
    );

    const agent = result.rows[0];
    logger.info(`✅ Config updated for ${agent.name} (${agent.agent_key})`);

    // Invalidate cache for this agent
    if (agent.agent_key) {
      const deletedKeys = await invalidateAgentCache(agent.agent_key);
      logger.info(`🔄 Invalidated ${deletedKeys} cache entries for ${agent.agent_key}`);
    }

    // Config is already parsed by PostgreSQL driver (JSONB -> Object)
    const savedConfig = agent.config;
    logger.info(`✅ Saved config keys:`, Object.keys(savedConfig));

    return res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        agent_key: agent.agent_key
      },
      savedConfig  // Return saved config for verification
    });

  } catch (error) {
    logger.error('❌ Update config error:', error);
    return sendError(res, 'SERVER_ERROR', error.message || 'Update failed', 500);
  }
});



// ARB-WP1A: Paginated canonical scan history from ai_decisions
router.get(
  '/:id/scan-history',
  authenticate,
  requireCapability(CAP.AI_AGENT_READ),
  rateLimit({ limit: 60, windowMs: 60000 }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const page = req.query.page;
      const pageSize = req.query.pageSize || req.query.limit;

      const agentResult = await query(
        `SELECT id, agent_key, name FROM ai_agents WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (agentResult.rows.length === 0) {
        return sendError(res, 'NOT_FOUND', 'Agent not found', 404);
      }
      const agent = agentResult.rows[0];
      if (agent.agent_key !== 'arbitrage') {
        return sendError(res, 'VALIDATION_ERROR', 'Scan history is only available for the Arbitrage agent', 400);
      }

      const history = await fetchArbitrageScanHistory(id, { page, pageSize });
      return res.json({
        agent: { id: agent.id, agent_key: agent.agent_key, name: agent.name },
        history: {
          items: history.items,
          pagination: history.pagination,
        },
        execution: { supported: false, realizedProfitUSDT: null },
      });
    } catch (error) {
      logger.error('Arbitrage scan-history error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load scan history', 500);
    }
  },
);

// Agent Details (Config, Performance, Last Analysis)
router.get('/:id/details', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`📊 Fetching details for agent: ${id.substring(0, 8)}...`);

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
      logger.info(`❌ Agent not found: ${id}`);
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

    // Special handling for arbitrage agent
    let config;
    if (agent.agent_key === 'arbitrage') {
      config = normalizeArbitrageConfig(rawConfig);
    } else if (agent.agent_key === 'fundamental') {
      config = normalizeFundamentalConfig(rawConfig);
    } else {
      // Use centralized config normalization for other agents
      config = normalizeAgentConfig(agent.agent_key, rawConfig);
    }

    logger.info(`✅ Agent details loaded: ${agent.name} (${agent.agent_key})`);
    logger.info(`   Accuracy: ${agent.accuracy} (type: ${typeof agent.accuracy})`);
    logger.info(`   Performance: ${agent.performance_score} (type: ${typeof agent.performance_score})`);

    // Build response based on agent type
    const response = {
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
      // Provide safe default for lastAnalysis to prevent UI crashes
      lastAnalysis: metadata?.last_result || {
        indicators: [],
        result: { indicators: [] }
      },
    };

    // For arbitrage, add canonical metrics and lastScan from ai_decisions (ARB-WP1A)
    if (agent.agent_key === 'arbitrage') {
      const scanCount = await countArbitrageScans(agent.id);
      const latestDecision = await query(
        `SELECT output_data, created_at
         FROM ai_decisions
         WHERE agent_id = $1 AND decision_type = $2
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [agent.id, ARBITRAGE_DECISION_TYPE],
      );

      // Canonical last scan = latest decision; metadata.last_result is denormalized cache only
      const latestRaw = latestDecision.rows[0]?.output_data || metadata?.last_result || null;
      const normalized = normalizeScanResult(latestRaw);
      if (!normalized.timestamp && latestDecision.rows[0]?.created_at) {
        normalized.timestamp = new Date(latestDecision.rows[0].created_at).toISOString();
      }

      const metrics = buildArbitrageMetricsFromNormalized(
        normalized,
        scanCount.total,
        scanCount.lastCompletedAt || normalized.timestamp,
      );

      // Strip misleading futures/auto-execute presentation in read contract
      if (config && typeof config === 'object') {
        if (config.execution) {
          config.execution = {
            ...config.execution,
            autoExecute: false,
            autoExecuteSupported: false,
            autoExecuteStoredPreference: Boolean(rawConfig?.execution?.autoExecute),
          };
        }
      }

      response.metrics = metrics;
      response.lastScan = buildLastScanPayload(normalized);
      response.scanStats = metrics.scanStats;
      response.candidateStats = metrics.candidateStats;
      response.qualifiedStats = metrics.qualifiedStats;
      response.riskStats = metrics.riskStats;
      response.execution = metrics.execution;
      response.analyticalMode = metrics.analyticalMode;
      // Deprecated for Arbitrage: ai_agents.total_decisions (stale column)
      response.deprecated = {
        ai_agents_total_decisions: 'Do not use for Arbitrage scan count; use scanStats.total',
        netProfitCapturedUSDT: 'Removed — was estimated last-scan sum, not realized profit',
        executionHistory: 'Unsupported — Arbitrage agent has no verified execution model',
        opportunityHistory: 'Replaced by GET /:id/scan-history from ai_decisions',
      };
    }

    // For fundamental, add metrics and lastAnalysis
    if (agent.agent_key === 'fundamental') {
      const lastResult = metadata?.last_result || null;

      // Build metrics from last result
      const metrics = {
        totalAnalyses: parseInt(agent.total_decisions, 10) || 0,
        avgExecutionTime: lastResult?.raw?.executionTime || 0,
        lastScore: lastResult?.score?.total || 0,
        avgScore: lastResult?.score?.total || 0, // TODO: Calculate average from history
        bullishCount: lastResult?.decision === 'buy' ? 1 : 0,
        bearishCount: lastResult?.decision === 'sell' ? 1 : 0,
        neutralCount: lastResult?.decision === 'hold' ? 1 : 0
      };

      response.metrics = metrics;

      // lastAnalysis with full fundamental data
      if (lastResult) {
        response.lastAnalysis = lastResult;
      }
    }

    res.json(response);

  } catch (err) {
    logger.error('❌ Agent details error:', err);
    sendError(res, 'SERVER_ERROR', err.message || 'Failed to load agent details', 500);
  }
});

router.get('/manager-overview', authenticate, validateResponse(managerOverviewResponseSchema), async (req, res) => {
  try {
    const userId = req.user?.id;

    // Get all agents
    let agents = [];
    try {
      const agentsResult = await query('SELECT * FROM ai_agents ORDER BY name');
      agents = agentsResult.rows || [];
    } catch (e) {
      logger.warn('⚠️ Failed to fetch agents:', e);
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
      logger.warn('⚠️ Failed to fetch decision stats:', e);
    }

    // Get Artemis state
    let artemisState = {};
    try {
      const artemisResult = await query('SELECT * FROM artemis_state ORDER BY created_at DESC LIMIT 1');
      artemisState = artemisResult.rows[0] || {};
    } catch (e) {
      logger.warn('⚠️ Failed to fetch Artemis state:', e);
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
    logger.error('Failed to fetch manager overview:', error);
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
router.get('/', authenticate, validateQuery(listAgentsQuerySchema), validateResponse(agentListResponseSchema), async (req, res) => {
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

    // Get real-time decision stats for all agents
    const decisionsResult = await query(
      `SELECT 
        agent_id,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE was_successful = true) as successful,
        EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/3600 as learning_hours
      FROM ai_decisions
      GROUP BY agent_id`
    );

    const decisionsMap = new Map(
      decisionsResult.rows.map(d => [d.agent_id, d])
    );

    // ARB-WP1A: override Arbitrage counts with arbitrage_scan-only aggregate (no N+1)
    const arbIds = result.rows.filter((a) => a.agent_key === 'arbitrage').map((a) => a.id);
    const arbCounts = await getArbitrageScanCountsByAgentIds(arbIds);
    for (const [agentId, stats] of arbCounts.entries()) {
      const existing = decisionsMap.get(agentId) || {
        agent_id: agentId,
        total: 0,
        successful: 0,
        learning_hours: 0,
      };
      decisionsMap.set(agentId, {
        ...existing,
        total: stats.total,
        last_completed_at: stats.lastCompletedAt,
      });
    }
    // Agents with zero arbitrage_scan rows still need explicit zero for arbitrage key
    for (const id of arbIds) {
      if (!decisionsMap.has(id)) {
        decisionsMap.set(id, {
          agent_id: id,
          total: 0,
          successful: 0,
          learning_hours: 0,
          last_completed_at: null,
        });
      } else if (!arbCounts.has(id)) {
        const existing = decisionsMap.get(id);
        decisionsMap.set(id, {
          ...existing,
          total: 0,
          last_completed_at: null,
        });
      }
    }

    // Map DB fields to UI contract using a shared helper
    const schedRead = await readAnalyticalSchedulerStatus();
    const allowlist = schedRead.status?.allowlist || [];
    const schedulerRunning = Boolean(schedRead.status?.isRunning);
    let killSwitchActive = true;
    let effectiveMode = 'demo';
    try {
      const runtimeView = await getRuntimeExecutionState({ preferCache: true });
      killSwitchActive = Boolean(runtimeView?.killSwitchActive ?? true);
      effectiveMode = runtimeView?.globalMode || 'demo';
    } catch {
      /* fail-closed */
    }

    const agents = result.rows.map((row) => {
      const agent = transformAgent(row, decisionsMap.get(row.id));
      const safeParse = (value) => {
        if (!value) return {};
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch { return {}; }
      };
      return {
        ...agent,
        statusProjection: buildAgentStatusProjection({
          agent: {
            ...row,
            config: safeParse(row.config),
            metadata: safeParse(row.metadata),
          },
          allowlist,
          schedulerRunning,
          killSwitchActive,
          effectiveMode,
        }),
      };
    });

    // Wrap in { agents: [...] } for UI compatibility
    res.json({ agents });
  } catch (error) {
    logger.error('Failed to fetch AI agents:', error);
    // If database is unavailable, return empty array instead of error
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      logger.warn('⚠️ Database unavailable, returning empty AI agents array');
      return res.json({ agents: [] });
    }
    res.status(500).json({ error: 'Failed to fetch AI agents', message: error.message });
  }
});

// Get AI agent by ID
router.get('/:id', authenticate, validateParams(getAgentParamsSchema), validateResponse(agentResponseSchema), async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM ai_agents WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AI agent not found' });
    }
    const decisionsResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE was_successful = true) as successful,
        EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/3600 as learning_hours
      FROM ai_decisions
      WHERE agent_id = $1`,
      [req.params.id]
    );

    res.json(transformAgent(result.rows[0], decisionsResult.rows[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AI agent' });
  }
});

// Update AI agent
router.patch('/:id', authenticateStrict, requireCapability(CAP.AI_AGENT_ENABLE_DISABLE, CAP.AI_AGENT_CONFIGURE), validateParams(updateAgentParamsSchema), validateBody(updateAgentBodySchema), validateResponse(agentResponseSchema), async (req, res) => {
  try {
    const { status, config, is_enabled } = req.body;

    if (is_enabled !== undefined) {
      const p = await evaluateConfigurePolicy(req.user, 'agent.enable');
      if (!p.allowed) return res.status(403).json({ error: 'Insufficient permissions', code: 'CAPABILITY_DENIED' });
    }
    if (config !== undefined || status !== undefined) {
      const p = await evaluateConfigurePolicy(req.user, 'agent.configure');
      if (!p.allowed) return res.status(403).json({ error: 'Insufficient permissions', code: 'CAPABILITY_DENIED' });
    }
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