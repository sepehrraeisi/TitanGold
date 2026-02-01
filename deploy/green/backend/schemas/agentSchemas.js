/**
 * Zod Schemas for AI Agent Endpoints
 * Task: API-002
 * 
 * Defines validation schemas for all AI agent-related API endpoints
 */

import { z } from 'zod';

// ============================================================================
// SHARED/REUSABLE SCHEMAS
// ============================================================================

// UUID validation
export const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

// Agent ID can be either UUID or agent-<number> format
export const agentIdSchema = z.string().refine(
  (id) => /^agent-\d+$/.test(id) || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id),
  { message: 'Agent ID must be a valid UUID or agent-<number> format' }
);

// Trading symbol validation (e.g., BTC/USDT, BTCUSDT)
export const symbolSchema = z.string().regex(
  /^[A-Z0-9]{3,20}(\/[A-Z0-9]{3,20})?$/,
  { message: 'Symbol must be 3-20 uppercase alphanumeric characters, optionally with / separator' }
);

// Timeframe validation
export const timeframeSchema = z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'], {
  errorMap: () => ({ message: 'Timeframe must be one of: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w' }),
});

// Agent type validation
export const agentTypeSchema = z.enum([
  'technical',
  'sentiment',
  'pattern',
  'price_prediction',
  'arbitrage',
  'portfolio',
  'liquidity',
  'risk',
  'fundamental',
  'market_timing'
], {
  errorMap: () => ({ 
    message: 'Invalid agent type. Must be one of: technical, sentiment, pattern, price_prediction, arbitrage, portfolio, liquidity, risk, fundamental, market_timing' 
  }),
});

// Agent status validation
export const agentStatusSchema = z.enum(['active', 'paused', 'archived'], {
  errorMap: () => ({ message: 'Status must be one of: active, paused, archived' }),
});

// Confidence score (0-1)
export const confidenceSchema = z.number().min(0).max(1, { 
  message: 'Confidence must be between 0 and 1' 
});

// ============================================================================
// AI AGENT CRUD SCHEMAS
// ============================================================================

// GET /api/v1/ai-agents (list agents)
export const listAgentsQuerySchema = z.object({
  type: agentTypeSchema.optional(),
  status: agentStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  sortBy: z.enum(['name', 'created_at', 'performance_score', 'last_active_at']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// GET /api/v1/ai-agents/:id (get single agent)
export const getAgentParamsSchema = z.object({
  id: agentIdSchema,
});

// POST /api/v1/ai-agents (create agent)
export const createAgentBodySchema = z.object({
  name: z.string().min(1).max(255, { message: 'Agent name must be 1-255 characters' }),
  type: agentTypeSchema,
  config: z.record(z.any()).optional().default({}),
  is_enabled: z.boolean().optional().default(true),
  metadata: z.record(z.any()).optional().default({}),
});

// PUT /api/v1/ai-agents/:id (update agent)
export const updateAgentParamsSchema = z.object({
  id: agentIdSchema,
});

export const updateAgentBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: agentTypeSchema.optional(),
  status: agentStatusSchema.optional(),
  config: z.record(z.any()).optional(),
  is_enabled: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// DELETE /api/v1/ai-agents/:id (delete agent)
export const deleteAgentParamsSchema = z.object({
  id: agentIdSchema,
});

// ============================================================================
// AI AGENT ANALYSIS SCHEMAS
// ============================================================================

// POST /api/v1/ai-agents/:id/analyze (run analysis)
export const analyzeParamsSchema = z.object({
  id: agentIdSchema,
});

export const analyzeBodySchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema.optional().default('1h'),
  exchange: z.string().min(1).max(50).optional().default('binance'),
  config: z.record(z.string(), z.unknown()).optional(),
});

// POST /api/v1/ai-agents/:id/chat (agent chat)
export const chatParamsSchema = z.object({
  id: agentIdSchema,
});

export const chatBodySchema = z.object({
  message: z.string().min(1).max(4000, { 
    message: 'Message must be 1-4000 characters' 
  }),
  context: z.object({
    symbol: symbolSchema.optional(),
    timeframe: timeframeSchema.optional(),
    conversationId: uuidSchema.optional(),
  }).optional(),
});

// ============================================================================
// TECHNICAL ANALYSIS SCHEMAS
// ============================================================================

export const technicalAnalysisConfigSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema.optional().default('1h'),
  indicators: z.array(z.enum([
    'RSI', 'MACD', 'BB', 'EMA', 'SMA', 'STOCH', 'ADX', 'OBV', 'VWAP'
  ])).optional(),
  lookbackPeriod: z.number().int().positive().max(500).optional().default(100),
});

// ============================================================================
// SENTIMENT ANALYSIS SCHEMAS
// ============================================================================

export const sentimentAnalysisConfigSchema = z.object({
  symbol: symbolSchema,
  sources: z.array(z.enum(['twitter', 'reddit', 'news', 'telegram'])).optional(),
  lookbackHours: z.number().int().positive().max(168).optional().default(24),
  minConfidence: confidenceSchema.optional().default(0.5),
});

// ============================================================================
// PATTERN RECOGNITION SCHEMAS
// ============================================================================

export const patternRecognitionConfigSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema.optional().default('1h'),
  patterns: z.array(z.enum([
    'head_and_shoulders', 'double_top', 'double_bottom', 'triangle',
    'wedge', 'flag', 'pennant', 'cup_and_handle'
  ])).optional(),
  lookbackPeriod: z.number().int().positive().max(500).optional().default(100),
  minConfidence: confidenceSchema.optional().default(0.7),
});

// ============================================================================
// PRICE PREDICTION SCHEMAS
// ============================================================================

export const pricePredictionConfigSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema.optional().default('1h'),
  horizonPeriods: z.number().int().positive().max(100).optional().default(10),
  model: z.enum(['linear', 'polynomial', 'lstm', 'ensemble']).optional().default('ensemble'),
  includeConfidenceIntervals: z.boolean().optional().default(true),
});

// ============================================================================
// ARBITRAGE SCHEMAS
// ============================================================================

export const arbitrageConfigSchema = z.object({
  symbol: symbolSchema,
  exchanges: z.array(z.string().min(1)).min(2, { 
    message: 'At least 2 exchanges required for arbitrage' 
  }),
  minProfitPercent: z.number().positive().max(100).optional().default(0.5),
  includeFees: z.boolean().optional().default(true),
});

// ============================================================================
// PORTFOLIO ALLOCATION SCHEMAS
// ============================================================================

export const portfolioAllocationConfigSchema = z.object({
  assets: z.array(symbolSchema).min(2, { 
    message: 'At least 2 assets required for portfolio allocation' 
  }),
  strategy: z.enum(['equal_weight', 'market_cap', 'risk_parity', 'mean_variance']).optional().default('mean_variance'),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  constraints: z.object({
    minWeight: z.number().min(0).max(1).optional().default(0),
    maxWeight: z.number().min(0).max(1).optional().default(1),
  }).optional(),
});

// ============================================================================
// LIQUIDITY ANALYSIS SCHEMAS
// ============================================================================

export const liquidityAnalysisConfigSchema = z.object({
  symbol: symbolSchema,
  exchanges: z.array(z.string().min(1)).optional(),
  depthLevels: z.number().int().positive().max(100).optional().default(20),
  includeOrderBook: z.boolean().optional().default(false),
});

// ============================================================================
// RISK ASSESSMENT SCHEMAS
// ============================================================================

export const riskAssessmentConfigSchema = z.object({
  portfolio: z.array(z.object({
    symbol: symbolSchema,
    quantity: z.number().positive(),
    averagePrice: z.number().positive(),
  })).min(1, { message: 'Portfolio must contain at least 1 asset' }),
  marketConditions: z.enum(['bull', 'bear', 'sideways', 'volatile']).optional(),
  timeHorizon: z.enum(['short', 'medium', 'long']).optional().default('medium'),
});

// ============================================================================
// AGENT PERFORMANCE SCHEMAS
// ============================================================================

export const agentPerformanceQuerySchema = z.object({
  agentId: agentIdSchema,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metrics: z.array(z.enum([
    'accuracy', 'precision', 'recall', 'f1_score', 
    'profit_loss', 'sharpe_ratio', 'win_rate'
  ])).optional(),
});

// ============================================================================
// TRAINING SCHEMAS
// ============================================================================

export const trainAgentParamsSchema = z.object({
  id: agentIdSchema,
});

export const trainAgentBodySchema = z.object({
  data: z.array(z.object({
    input: z.record(z.any()),
    output: z.record(z.any()),
    timestamp: z.string().datetime().optional(),
  })).min(1, { message: 'Training data must contain at least 1 sample' }),
  config: z.object({
    epochs: z.number().int().positive().max(1000).optional().default(10),
    batchSize: z.number().int().positive().max(1000).optional().default(32),
    learningRate: z.number().positive().max(1).optional().default(0.001),
    validationSplit: z.number().min(0).max(0.5).optional().default(0.2),
  }).optional(),
});

// ============================================================================
// BATCH OPERATIONS SCHEMAS
// ============================================================================

export const batchAnalyzeBodySchema = z.object({
  requests: z.array(z.object({
    agentId: agentIdSchema,
    symbol: symbolSchema,
    timeframe: timeframeSchema.optional(),
    config: z.record(z.any()).optional(),
  })).min(1).max(10, { message: 'Batch requests must contain 1-10 items' }),
});

// ============================================================================
// EXPORT SCHEMAS
// ============================================================================

// Export all schemas
export default {
  // Shared
  uuidSchema,
  agentIdSchema,
  symbolSchema,
  timeframeSchema,
  agentTypeSchema,
  agentStatusSchema,
  confidenceSchema,
  
  // CRUD
  listAgentsQuerySchema,
  getAgentParamsSchema,
  createAgentBodySchema,
  updateAgentParamsSchema,
  updateAgentBodySchema,
  deleteAgentParamsSchema,
  
  // Analysis
  analyzeParamsSchema,
  analyzeBodySchema,
  chatParamsSchema,
  chatBodySchema,
  
  // Specific analyses
  technicalAnalysisConfigSchema,
  sentimentAnalysisConfigSchema,
  patternRecognitionConfigSchema,
  pricePredictionConfigSchema,
  arbitrageConfigSchema,
  portfolioAllocationConfigSchema,
  liquidityAnalysisConfigSchema,
  riskAssessmentConfigSchema,
  
  // Performance & Training
  agentPerformanceQuerySchema,
  trainAgentParamsSchema,
  trainAgentBodySchema,
  
  // Batch
  batchAnalyzeBodySchema,
};
