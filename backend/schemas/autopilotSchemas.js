/**
 * Zod Schemas for Autopilot API Endpoints
 * Task: API-003 (AI Module)
 */

import { z } from 'zod';
import { agentIdSchema } from './agentSchemas.js';

// ============================================
// SHARED
// ============================================

const timestampSchema = z.string().datetime().or(z.date()).transform(val => val ? new Date(val).toISOString() : null);

// ============================================
// STATUS SCHEMAS
// ============================================

export const autopilotStatusResponseSchema = z.object({
    enabled: z.boolean(),
    last_run: timestampSchema.nullable(),
    cycle_count: z.number().int(),
    fail_count: z.number().int(),
    config: z.object({
        max_change_percent: z.number().optional().default(10),
        min_cycle_interval_minutes: z.number().optional().default(5),
        max_consecutive_failures: z.number().optional().default(3),
        require_human_approval: z.boolean().optional().default(true)
    }).optional().nullable()
});

// ============================================
// SUGGESTION SCHEMAS
// ============================================

export const autopilotSuggestionSchema = z.object({
    id: z.string().or(z.number()),
    agent_id: agentIdSchema,
    action_type: z.string(),
    status: z.enum(['pending', 'approved', 'rejected', 'applied', 'failed', 'rolled_back']),
    old_config: z.record(z.any()),
    new_config: z.record(z.any()),
    reasoning: z.string().nullable(),
    impact_score: z.number().optional(),
    suggested_at: timestampSchema,
    approved_at: timestampSchema.nullable().optional(),
    applied_at: timestampSchema.nullable().optional(),
    agent_name: z.string().optional(),
    agent_type: z.string().optional(),
    approved_by_email: z.string().email().nullable().optional()
});

export const autopilotSuggestionListResponseSchema = z.object({
    suggestions: z.array(autopilotSuggestionSchema),
    count: z.number().int(),
    filters: z.object({
        status: z.string().optional(),
        agent_id: z.string().optional()
    })
});

export default {
    autopilotStatusResponseSchema,
    autopilotSuggestionSchema,
    autopilotSuggestionListResponseSchema
};
