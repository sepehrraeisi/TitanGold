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

// User Role Enum
export const UserRole = z.enum(['user', 'admin', 'trader', 'vip']);

// Base User Schema (Common response fields)
export const baseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(100),
  full_name: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  avatar_url: z.string().url().or(z.string().max(1000)).optional().nullable(),
  role: UserRole,
  is_verified: z.boolean().default(false),
  is_active: z.boolean().default(true),
  last_login_at: z.string().datetime().or(z.date()).transform(val => val ? new Date(val).toISOString() : null).optional().nullable(),
  created_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()),
  updated_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()).optional().nullable(),
});

// User Profile Schema (User + Settings)
export const userProfileResponseSchema = baseUserSchema.extend({
  theme: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  currency: z.string().optional().nullable()
});

// GET /api/v1/users (list users - admin only)
export const listUsersQuerySchema = z.object({
  role: UserRole.optional(),
  is_active: z.string().transform(val => val === 'true').or(z.boolean()).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  search: z.string().max(255).optional(),
});

// User List Response Schema
export const userListResponseSchema = z.object({
  users: z.array(baseUserSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int()
});

// User Statistics Schema
export const userStatsResponseSchema = z.object({
  total_users: z.number().int(),
  active_users: z.number().int(),
  verified_users: z.number().int(),
  admin_count: z.number().int(),
  trader_count: z.number().int(),
  vip_count: z.number().int(),
  new_users_30d: z.number().int(),
  active_7d: z.number().int()
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
  role: UserRole.optional(),
  is_active: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// DELETE /api/v1/users/:id
export const deleteUserParamsSchema = z.object({
  id: uuidSchema,
});

// PATCH /api/v1/users/:id/role
export const updateUserRoleSchema = z.object({
  role: UserRole
});

// PATCH /api/v1/users/:id/status
export const updateUserStatusSchema = z.object({
  is_active: z.boolean()
});

// POST /api/v1/users/change-password
export const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Old password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters')
    .max(100, 'New password must not exceed 100 characters')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number')
});

// Export all schemas
export default {
  listUsersQuerySchema,
  getUserParamsSchema,
  updateUserParamsSchema,
  updateUserBodySchema,
  deleteUserParamsSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  changePasswordSchema,
  baseUserSchema,
  userProfileResponseSchema,
  userListResponseSchema,
  userStatsResponseSchema
};
