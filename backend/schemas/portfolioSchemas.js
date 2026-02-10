/**
 * Zod Schemas for Portfolio Endpoints
 * Task: API-002
 */

import { z } from 'zod';

const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });
const symbolSchema = z.string().regex(/^[A-Z0-9]{3,20}(\/[A-Z0-9]{3,20})?$/);

// ============================================================================
// PORTFOLIO SCHEMAS
// ============================================================================

// GET /api/v1/portfolios
export const listPortfoliosQuerySchema = z.object({
  userId: uuidSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

// POST /api/v1/portfolios
export const createPortfolioBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  baseCurrency: z.string().length(3).toUpperCase().optional().default('USD'),
  isMain: z.boolean().optional().default(false),
  isPublic: z.boolean().optional().default(false),
});

// GET /api/v1/portfolios/:id
export const getPortfolioParamsSchema = z.object({
  id: uuidSchema,
});

// PUT /api/v1/portfolios/:id
export const updatePortfolioParamsSchema = z.object({
  id: uuidSchema,
});

export const updatePortfolioBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  baseCurrency: z.string().length(3).toUpperCase().optional(),
  isMain: z.boolean().optional(),
  isPublic: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// DELETE /api/v1/portfolios/:id
export const deletePortfolioParamsSchema = z.object({
  id: uuidSchema,
});

// POST /api/v1/portfolios/:id/positions
export const addPositionParamsSchema = z.object({
  id: uuidSchema,
});

export const addPositionBodySchema = z.object({
  symbol: symbolSchema,
  quantity: z.number().positive({ message: 'Quantity must be positive' }),
  averagePrice: z.number().positive({ message: 'Average price must be positive' }),
  exchange: z.string().min(1).max(50).optional(),
  notes: z.string().max(1000).optional(),
});

// GET /api/v1/portfolios/:id/performance
export const getPortfolioPerformanceParamsSchema = z.object({
  id: uuidSchema,
});

export const getPortfolioPerformanceQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timeRange: z.enum(['24h', '7d', '30d', '90d', '1y', 'all']).optional().default('30d'),
});

// GET /api/v1/portfolios/:id/summary
export const getPortfolioSummaryParamsSchema = z.object({
  id: uuidSchema,
});

// Portfolio Response Schema
export const portfolioResponseSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string(),
  description: z.string().optional().nullable(),
  base_currency: z.string().length(3),
  is_main: z.boolean(),
  is_public: z.boolean(),
  created_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()),
  updated_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()).optional().nullable(),
});

// Portfolio List Response Schema
export const portfolioListResponseSchema = z.array(portfolioResponseSchema);

// Export all schemas
export default {
  listPortfoliosQuerySchema,
  createPortfolioBodySchema,
  getPortfolioParamsSchema,
  updatePortfolioParamsSchema,
  updatePortfolioBodySchema,
  deletePortfolioParamsSchema,
  addPositionParamsSchema,
  addPositionBodySchema,
  getPortfolioPerformanceParamsSchema,
  getPortfolioPerformanceQuerySchema,
  getPortfolioSummaryParamsSchema,
  portfolioResponseSchema,
  portfolioListResponseSchema,
};
