/**
 * Zod Schemas for User Management Endpoints
 * Task: API-002
 */

import { z } from 'zod';

// UUID validation
const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

// ============================================================================
// USER SCHEMAS
// ============================================================================

// GET /api/v1/users (list users - admin only)
export const listUsersQuerySchema = z.object({
  role: z.enum(['admin', 'user', 'trader']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  search: z.string().max(255).optional(),
});

// GET /api/v1/users/:id
export const getUserParamsSchema = z.object({
  id: uuidSchema,
});

// PUT /api/v1/users/:id
export const updateUserParamsSchema = z.object({
  id: uuidSchema,
});

export const updateUserBodySchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  fullName: z.string().min(1).max(255).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  role: z.enum(['admin', 'user', 'trader']).optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// DELETE /api/v1/users/:id
export const deleteUserParamsSchema = z.object({
  id: uuidSchema,
});

// Export all schemas
export default {
  listUsersQuerySchema,
  getUserParamsSchema,
  updateUserParamsSchema,
  updateUserBodySchema,
  deleteUserParamsSchema,
};
