/**
 * Zod Schemas for Trade Endpoints
 * Task: API-002
 */

import { z } from 'zod';

const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });
const symbolSchema = z.string().regex(/^[A-Z0-9]{3,20}(\/[A-Z0-9]{3,20})?$/);

// ============================================================================
// TRADE SCHEMAS
// ============================================================================

// GET /api/v1/trades
export const listTradesQuerySchema = z.object({
  portfolioId: uuidSchema.optional(),
  symbol: symbolSchema.optional(),
  status: z.enum(['pending', 'executed', 'cancelled', 'failed']).optional(),
  type: z.enum(['buy', 'sell', 'swap']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

// POST /api/v1/trades
export const createTradeBodySchema = z.object({
  portfolioId: uuidSchema,
  symbol: symbolSchema,
  type: z.enum(['buy', 'sell', 'swap']),
  quantity: z.number().positive({ message: 'Quantity must be positive' }),
  price: z.number().positive({ message: 'Price must be positive' }).optional(),
  orderType: z.enum(['market', 'limit', 'stop_loss', 'stop_limit']).optional().default('market'),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  exchange: z.string().min(1).max(50),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => {
    if (data.orderType === 'limit' && !data.limitPrice) {
      return false;
    }
    if ((data.orderType === 'stop_loss' || data.orderType === 'stop_limit') && !data.stopPrice) {
      return false;
    }
    return true;
  },
  { 
    message: 'Limit price required for limit orders, stop price required for stop orders',
    path: ['orderType'],
  }
);

// GET /api/v1/trades/:id
export const getTradeParamsSchema = z.object({
  id: uuidSchema,
});

// PUT /api/v1/trades/:id
export const updateTradeParamsSchema = z.object({
  id: uuidSchema,
});

export const updateTradeBodySchema = z.object({
  status: z.enum(['pending', 'executed', 'cancelled', 'failed']).optional(),
  executedPrice: z.number().positive().optional(),
  executedQuantity: z.number().positive().optional(),
  executedAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// DELETE /api/v1/trades/:id (cancel trade)
export const cancelTradeParamsSchema = z.object({
  id: uuidSchema,
});

// POST /api/v1/trades/:id/execute
export const executeTradeParamsSchema = z.object({
  id: uuidSchema,
});

export const executeTradeBodySchema = z.object({
  executedPrice: z.number().positive(),
  executedQuantity: z.number().positive(),
  fees: z.number().nonnegative().optional().default(0),
  notes: z.string().max(1000).optional(),
});

// GET /api/v1/trades/history
export const getTradeHistoryQuerySchema = z.object({
  portfolioId: uuidSchema.optional(),
  symbol: symbolSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).optional().default(100),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

// Export all schemas
export default {
  listTradesQuerySchema,
  createTradeBodySchema,
  getTradeParamsSchema,
  updateTradeParamsSchema,
  updateTradeBodySchema,
  cancelTradeParamsSchema,
  executeTradeParamsSchema,
  executeTradeBodySchema,
  getTradeHistoryQuerySchema,
};
