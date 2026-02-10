import { z } from 'zod';

// Access Control Rule Schema
export const accessControlSchema = z.object({
    allowed_agents: z.array(z.string()).optional().default([]),
    blocked_agents: z.array(z.string()).optional().default([]),
    allowed_data_types: z.array(z.string()).optional().default([]),
    blocked_data_types: z.array(z.string()).optional().default([]),
    require_auth: z.boolean().optional().default(false),
    max_requests_per_minute: z.number().int().min(0).optional().default(0),
    max_requests_per_day: z.number().int().min(0).optional().default(0)
});

// Access Control Response Schema
export const accessControlResponseSchema = z.object({
    id: z.string().uuid(),
    source_id: z.string().uuid(),
    allowed_agents: z.array(z.string()),
    blocked_agents: z.array(z.string()),
    allowed_data_types: z.array(z.string()),
    blocked_data_types: z.array(z.string()),
    require_auth: z.boolean(),
    max_requests_per_minute: z.number().int(),
    max_requests_per_day: z.number().int(),
    created_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()),
    updated_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()),
    updated_by: z.string().uuid().optional().nullable()
});

export default {
    accessControlSchema,
    accessControlResponseSchema
};
