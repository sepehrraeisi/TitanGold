import { z } from 'zod';

const tierEnum = z.enum(['low', 'medium', 'high', 'critical']);

export const uuidSourceParamSchema = z.object({
    sourceId: z.string().uuid(),
});

export const updatePrioritizationSettingsSchema = z.object({
    is_enabled: z.boolean(),
    factor_weights: z.record(z.number()).optional().default({}),
    tier_thresholds: z
        .object({
            low: z.number().min(0).max(100).optional(),
            high: z.number().min(0).max(100).optional(),
            critical: z.number().min(0).max(100).optional(),
        })
        .partial()
        .optional()
        .default({}),
});

export const previewPrioritizationSchema = z.object({
    // preview is computation only; no data_sources writes
});

export const applyPrioritizationSchema = z.object({
    confirm_apply: z.literal(true),
    source_ids: z.array(z.string().uuid()).optional(),
});

export const overrideSourceSchema = z.object({
    override_score: z.number().min(0).max(100).nullable(),
    override_note: z.string().max(2000).optional().nullable(),
});

export const listRunsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const prioritizationSourceRowSchema = z.object({
    source_id: z.string().uuid(),
    source_name: z.string(),
    source_type: z.string(),
    category: z.string().nullable().optional(),
    calculated_score: z.number().min(0).max(100),
    final_score: z.number().min(0).max(100),
    suggested_tier: tierEnum,
    score_breakdown: z.record(z.unknown()).default({}),
    override_score: z.number().min(0).max(100).nullable().optional(),
    override_note: z.string().nullable().optional(),
    overridden_by: z.string().uuid().nullable().optional(),
    overridden_at: z.string().datetime().nullable().optional(),
    last_preview_at: z.string().datetime().nullable().optional(),
    last_applied_at: z.string().datetime().nullable().optional(),
});

export const prioritizationSettingsSchema = z.object({
    is_enabled: z.boolean(),
    factor_weights: z.record(z.number()),
    tier_thresholds: z.record(z.number()).default({}),
    updated_at: z.string().datetime().nullable().optional(),
});

