import { z } from 'zod';

/**
 * Basic health check response schema
 */
export const healthResponseSchema = z.object({
    status: z.enum(['ok', 'degraded', 'error']),
    service: z.string(),
    timestamp: z.string().datetime(),
    version: z.string(),
    commit: z.string(),
    uptime: z.number(),
    memory: z.object({
        used: z.number(),
        total: z.number(),
        unit: z.string(),
    }),
    node: z.string(),
    env: z.string(),
});

/**
 * Readiness check response schema
 */
export const readinessResponseSchema = z.object({
    status: z.enum(['ok', 'degraded', 'error']),
    timestamp: z.string().datetime(),
    checks: z.record(z.object({
        status: z.enum(['ok', 'warning', 'degraded', 'error']),
        message: z.string(),
        count: z.number().optional(),
        summary: z.any().optional(),
        agents: z.any().optional(),
        memory_used: z.string().optional(),
    })),
});
