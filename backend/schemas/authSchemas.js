/**
 * Zod Schemas for Authentication Endpoints
 * Task: API-002
 * 
 * Defines validation schemas for auth-related API endpoints
 */

import { z } from 'zod';

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

// POST /api/v1/auth/register
export const registerBodySchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  username: z.string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(50, { message: 'Username must not exceed 50 characters' })
    .regex(/^[a-zA-Z0-9_-]+$/, { 
      message: 'Username can only contain letters, numbers, hyphens, and underscores' 
    }),
  password: z.string()
    .min(6, { message: 'Password must be at least 6 characters' })
    .max(128, { message: 'Password must not exceed 128 characters' }),
  fullName: z.string()
    .min(1)
    .max(255)
    .optional()
    .transform(val => val?.trim()),
});

// POST /api/v1/auth/login
export const loginBodySchema = z.object({
  username: z.string()
    .min(1, { message: 'Username or email is required' })
    .transform(val => val.trim()),
  password: z.string().min(1, { message: 'Password is required' }),
});

// POST /api/v1/auth/refresh
export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, { message: 'Refresh token is required' }),
});

// POST /api/v1/auth/logout
// No body schema needed - uses auth token from headers

// GET /api/v1/auth/me
// No params needed - uses auth token from headers

// POST /api/v1/auth/forgot-password
export const forgotPasswordBodySchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
});

// POST /api/v1/auth/reset-password
export const resetPasswordBodySchema = z.object({
  token: z.string().min(1, { message: 'Reset token is required' }),
  password: z.string()
    .min(6, { message: 'Password must be at least 6 characters' })
    .max(128, { message: 'Password must not exceed 128 characters' }),
});

// POST /api/v1/auth/change-password
export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required' }),
  newPassword: z.string()
    .min(6, { message: 'New password must be at least 6 characters' })
    .max(128, { message: 'New password must not exceed 128 characters' }),
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  { message: 'New password must be different from current password', path: ['newPassword'] }
);

// Export all schemas
export default {
  registerBodySchema,
  loginBodySchema,
  refreshTokenBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  changePasswordBodySchema,
};
