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
    providers: z.array(z.any()).optional(),
    // WP-A containment — required advisory classification on all decision responses
    classification: z.literal('LEGACY_ADVISORY_ONLY'),
    executionEligible: z.literal(false),
    executionEligibility: z.literal('NOT_EXECUTION_ELIGIBLE'),
    approvedForExecution: z.literal(false),
    maturityStage: z.literal('LEGACY_ADVISORY'),
    advisoryOnly: z.literal(true),
    sideEffectsSuppressed: z.boolean(),
    legacyApprovedFieldSemantics: z.string(),
    policy: z.record(z.any()).optional(),
});

export const artemisReadinessResponseSchema = z.object({
    maturityStage: z.string(),
    classification: z.string(),
    executionEligible: z.boolean(),
    executionEligibility: z.string(),
    contract: z.record(z.any()),
    evidence: z.record(z.any()),
    orchestration: z.record(z.any()),
    controlChain: z.record(z.any()),
    runtime: z.any().nullable(),
    runtimeTruth: z.string(),
    agents: z.record(z.any()),
    limitations: z.array(z.string()),
    dualConfigLimitationKey: z.string().optional(),
    generatedAt: z.string(),
});

export const artemisDecisionEnginePatchSchema = z.object({
    useMixture: z.boolean().optional(),
    models: z.array(z.string()).optional(),
}).strict();

export const artemisConfigPutSchema = z.object({
    decisionEngine: z.record(z.any()).optional(),
    monitoring: z.record(z.any()).optional(),
    integrations: z.record(z.any()).optional(),
}).strict();

export default {
    artemisHealthResponseSchema,
    artemisStateResponseSchema,
    artemisDecisionResponseSchema,
    artemisReadinessResponseSchema,
    artemisDecisionEnginePatchSchema,
    artemisConfigPutSchema,
};
