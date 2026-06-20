import { z } from 'zod';

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const prioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

const automationTopicBaseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(255).optional(),
  topic_key: z.string().min(1).max(120).optional(),
  source_type: z.string().max(80).optional().default('pipeline'),
  agentId: z.string().min(1),
  agentName: z.string().optional(),
  description: z.string().max(2000).optional(),
  categoryIds: z.array(z.string()).optional().default([]),
  dataTypes: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  priority: prioritySchema.optional().default('medium'),
  minPassRate: z.number().min(0).max(100).optional(),
  minQualityScore: z.number().min(0).max(100).optional(),
  includeStatuses: z.array(z.string()).optional(),
  publisherTargets: z.array(z.string().uuid()).optional().default([]),
  enabled: z.boolean().optional().default(true),
});

// refine() returns ZodEffects, which has no .partial(); keep base object for updates.
export const createAutomationTopicSchema = automationTopicBaseSchema.refine(
  (d) => d.name || d.title,
  { message: 'name or title required' },
);

export const updateAutomationTopicSchema = automationTopicBaseSchema.partial();

export const updateScheduleSchema = z.object({
  enabled: z.boolean().optional(),
  intervalMinutes: z.number().int().min(1).max(1440).optional(),
  maxItemsPerRun: z.number().int().min(1).max(50).optional(),
});

export const dispatchQueueSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(5),
  dry_run: z.boolean().optional().default(true),
  confirm_live: z.boolean().optional().default(false),
});

export const dispatchItemSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  confirm_live: z.boolean().optional().default(false),
});

export const testRunSchema = z.object({
  topic_id: z.string().uuid().optional(),
  dry_run: z.boolean().optional().default(true),
  confirm_live: z.boolean().optional().default(false),
});

export const failQueueItemSchema = z.object({
  error_message: z.string().max(500).optional(),
});

export const retryExecutionSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  confirm_live: z.boolean().optional().default(false),
});
