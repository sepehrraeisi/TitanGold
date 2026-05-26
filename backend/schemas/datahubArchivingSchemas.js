import { z } from 'zod';

export const archivePreviewSchema = z.object({
    days_old: z.number().int().min(1).max(3650).optional().default(90),
});

export const archiveExecuteSchema = z.object({
    days_old: z.number().int().min(1).max(3650).optional().default(90),
    dry_run: z.boolean().optional().default(false),
    confirm_archive: z.literal(true).optional(),
});

export const restorePreviewSchema = z.object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
});

export const restoreExecuteSchema = z.object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    dry_run: z.boolean().optional().default(false),
    confirm_restore: z.literal(true).optional(),
});

export const purgePreviewSchema = z.object({
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
});

export const createPartitionSchema = z.object({
    year: z.number().int().min(2000).max(2100),
    confirm_create: z.literal(true),
});

export const listRecordsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
    agent_id: z.string().uuid().optional(),
});

export const listOperationsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const listStatsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
