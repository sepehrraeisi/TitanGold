/**
 * Zod Schemas for Artemis Orchestrator Endpoints
 * Task: API-003 (AI Module)
 */

import { z } from 'zod';
import { uuidSchema } from './agentSchemas.js';

// ============================================
// SHARED
// ============================================

const timestampSchema = z.string().datetime().or(z.date()).transform(val => val ? new Date(val).toISOString() : null);

// ============================================
// HEALTH SCHEMAS
// ============================================

export const artemisProviderHealthSchema = z.object({
    name: z.string(),
    totalKeys: z.number().int(),
    healthyKeys: z.number().int(),
    enabledKeys: z.number().int(),
    successCount: z.number().int(),
    failCount: z.number().int(),
    ok: z.boolean(),
    reason: z.string().nullable(),
    weight: z.number().int(),
    defaultModel: z.string().nullable()
});

export const artemisHealthResponseSchema = z.object({
    providers: z.record(z.string(), artemisProviderHealthSchema),
    activeInstances: z.number().int(),
    totalProviders: z.number().int(),
    quorum: z.number().int(),
    ready: z.boolean(),
    timestamp: timestampSchema
});

// ============================================
// STATE SCHEMAS
// ============================================

export const artemisAgentStatusSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    status: z.string(),
    performanceScore: z.number(),
    accuracy: z.number(),
    enabled: z.boolean()
});

export const artemisStateResponseSchema = z.object({
    status: z.string(),
    mode: z.enum(['demo', 'live', 'paper']),
    strategy: z.string(),
    activeLearning: z.boolean(),
    overallAccuracy: z.number(),
    totalDecisions: z.number().int(),
    successfulDecisions: z.number().int(),
    config: z.record(z.any()),
    decisionEngine: z.object({
        strategy: z.string(),
        activeModel: z.string(),
        confidenceThreshold: z.number(),
        mixture: z.object({
            enabled: z.boolean(),
            models: z.array(z.string()).optional().default([])
        })
    }),
    orchestration: z.object({
        activeAgents: z.number().int(),
        totalAgents: z.number().int(),
        agents: z.array(artemisAgentStatusSchema).optional().default([])
    }),
    monitoring: z.object({
        recentDecisions: z.number().int(),
        systemHealth: z.object({
            cpu: z.number(),
            memory: z.number(),
            apiQuota: z.number()
        })
    }),
    created_at: timestampSchema.optional(),
    updated_at: timestampSchema.optional()
});

// ============================================
// DECISION SCHEMAS
// ============================================

export const artemisDecisionResponseSchema = z.object({
    action: z.enum(['BUY', 'SELL', 'HOLD']),
    approved: z.boolean(),
    reason: z.string(),
    confidence: z.number(),
    signals: z.number().optional(),
    providers: z.array(z.string()).optional()
});

export default {
    artemisHealthResponseSchema,
    artemisStateResponseSchema,
    artemisDecisionResponseSchema
};
