import { z } from 'zod';

const targetTypeEnum = z.enum(['website', 'rss']);
const scheduleIntervalEnum = z.enum([
    'realtime',
    '1min',
    '5min',
    '15min',
    '30min',
    '1hour',
    'daily',
]);

const nestedSourceSchema = z.object({
    name: z.string().min(1).max(255),
    type: z.enum(['web', 'rss']).optional(),
    url: z.string().url().max(1000),
    category: z.string().max(100).optional().nullable(),
    update_interval: scheduleIntervalEnum.optional(),
});

const crawlerBaseSchema = z.object({
        name: z.string().min(1).max(255),
        source_id: z.string().uuid().optional(),
        source: nestedSourceSchema.optional(),
        target_type: targetTypeEnum,
        start_url: z.string().url().max(2000),
        max_depth: z.number().int().min(0).max(5).default(0),
        max_pages_per_run: z.number().int().min(1).max(500).default(50),
        schedule_interval: scheduleIntervalEnum.default('5min'),
        respect_robots: z.boolean().default(true),
        render_js: z.boolean().default(false),
        selectors: z.record(z.string()).optional().default({}),
        timeout_ms: z.number().int().min(5000).max(3600000).default(600000),
        is_enabled: z.boolean().default(true),
        metadata: z.record(z.unknown()).optional().default({}),
    });

export const createCrawlerSchema = crawlerBaseSchema.superRefine((data, ctx) => {
        if (!data.source_id && !data.source) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'source_id or source is required',
                path: ['source_id'],
            });
        }
        if (data.target_type === 'rss' && data.max_depth > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'max_depth must be 0 for RSS crawlers',
                path: ['max_depth'],
            });
        }
    });

export const updateCrawlerSchema = crawlerBaseSchema
    .partial()
    .omit({ source: true })
    .extend({
        source_id: z.string().uuid().optional(),
    });

export const runCrawlerSchema = z.object({
    dry_run: z.boolean().optional().default(false),
});

export const listRunsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const uuidParamSchema = z.object({
    id: z.string().uuid(),
});

export const crawlerResponseSchema = z.object({
    id: z.string().uuid(),
    source_id: z.string().uuid(),
    name: z.string(),
    target_type: targetTypeEnum,
    start_url: z.string(),
    max_depth: z.number().int(),
    max_pages_per_run: z.number().int(),
    schedule_interval: scheduleIntervalEnum,
    respect_robots: z.boolean(),
    render_js: z.boolean(),
    selectors: z.record(z.string()),
    timeout_ms: z.number().int(),
    is_enabled: z.boolean(),
    last_run_at: z.string().nullable().optional(),
    last_success_at: z.string().nullable().optional(),
    last_error: z.string().nullable().optional(),
    error_count: z.number().int(),
    next_run_at: z.string().nullable().optional(),
    metadata: z.record(z.unknown()),
    source_name: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});
