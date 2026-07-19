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
    commitSource: z.string().optional(),
    uptime: z.number(),
    memory: z.object({
        used: z.number(),
        total: z.number(),
        unit: z.string(),
    }),
    node: z.string(),
    env: z.string(),
}).passthrough();

/**
 * Readiness check response schema
 */
export const readinessResponseSchema = z.object({
    status: z.enum(['ok', 'degraded', 'error']),
    timestamp: z.string().datetime(),
    latencyMs: z.number().optional(),
    checks: z.record(z.object({
        status: z.enum(['ok', 'warning', 'degraded', 'error']),
        message: z.string(),
        count: z.number().optional(),
        summary: z.any().optional(),
        agents: z.any().optional(),
        memory_used: z.string().optional(),
        killSwitchActive: z.boolean().optional(),
        effectiveMode: z.string().optional(),
        workerAcknowledged: z.boolean().optional(),
        stateVersion: z.number().optional(),
        critical: z.boolean().optional(),
        blocksReadiness: z.boolean().optional(),
        latencyMs: z.number().optional(),
    }).passthrough()),
}).passthrough();
