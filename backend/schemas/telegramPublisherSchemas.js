import { z } from 'zod';

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const createTelegramPublisherSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  channel_id: z.string().min(1).max(255).trim(),
  channel_username: z.string().max(255).optional().nullable(),
  channel_title: z.string().max(255).optional().nullable(),
  bot_token: z.string().min(1).max(500).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  language: z.string().max(20).optional().default('en'),
  template: z.string().max(10000).optional().default(''),
  schedule_config: z.record(z.any()).optional().default({}),
});

export const updateTelegramPublisherSchema = z
  .object({
    name: z.string().min(1).max(255).trim().optional(),
    channel_id: z.string().min(1).max(255).trim().optional(),
    channel_username: z.string().max(255).optional().nullable(),
    channel_title: z.string().max(255).optional().nullable(),
    bot_token: z.string().min(1).max(500).optional().nullable(),
    is_active: z.boolean().optional(),
    language: z.string().max(20).optional(),
    template: z.string().max(10000).optional(),
    schedule_config: z.record(z.any()).optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const publisherResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  channel_id: z.string(),
  channel_username: z.string().nullable().optional(),
  channel_title: z.string().nullable().optional(),
  has_bot_token: z.boolean(),
  is_active: z.boolean(),
  language: z.string(),
  template: z.string(),
  schedule_config: z.record(z.any()),
  sent_count: z.number().int(),
  last_sent_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const publisherListResponseSchema = z.object({
  publishers: z.array(publisherResponseSchema),
  metrics: z.object({
    totalChannels: z.number().int(),
    delivered24h: z.number().int(),
    failed24h: z.number().int(),
    successRate: z.number(),
  }),
});

export const publisherHistoryItemSchema = z.object({
  id: z.string().uuid(),
  publisher_id: z.string().uuid(),
  publisher_name: z.string().nullable().optional(),
  source_id: z.string().uuid().nullable().optional(),
  source_name: z.string().nullable().optional(),
  data_type: z.string().nullable().optional(),
  content_type: z.string().nullable().optional(),
  content_summary: z.string().nullable().optional(),
  status: z.string(),
  telegram_message_id: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
  delivery_mode: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_by_email: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string(),
});

export const publisherHistoryListSchema = z.object({
  data: z.array(publisherHistoryItemSchema),
  pagination: z.object({
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    hasMore: z.boolean(),
  }),
});

export const testPublisherSchema = z.object({
  message: z.string().max(4096).optional().default('Test message from Titan DataHub'),
});

export const publishPublisherSchema = z.object({
  message: z.string().min(1).max(4096),
  content_type: z.string().max(100).optional().default('manual'),
  confirm_publish: z.boolean(),
  source_id: z.string().uuid(),
  data_type: z.string().max(100).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  allow_temporary_publish: z.boolean().optional().default(false),
});

export const publishResultSchema = z.object({
  success: z.boolean(),
  dry_run: z.boolean(),
  status: z.string(),
  telegram_message_id: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  history_id: z.string().uuid(),
});

export const publisherHistoryQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(val => Math.min(parseInt(val, 10), 200))
    .optional()
    .default('50'),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform(val => parseInt(val, 10))
    .optional()
    .default('0'),
});

export const publisherMappingSchema = z.object({
  id: z.string().uuid(),
  source_id: z.string().uuid(),
  source_name: z.string(),
  source_type: z.string(),
  publisher_id: z.string().uuid(),
  publisher_name: z.string(),
  publisher_channel_id: z.string(),
  publisher_channel_username: z.string().nullable().optional(),
  is_enabled: z.boolean(),
  template_id: z.string().uuid().nullable().optional(),
  last_activity_at: z.string().nullable().optional(),
  last_status: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const publisherMappingsListSchema = z.object({
  mappings: z.array(publisherMappingSchema),
});

export const createPublisherMappingSchema = z.object({
  source_id: z.string().uuid(),
  publisher_id: z.string().uuid(),
  is_enabled: z.boolean().optional().default(true),
  template_id: z.string().uuid().nullable().optional(),
});

export const updatePublisherMappingSchema = z
  .object({
    source_id: z.string().uuid().optional(),
    publisher_id: z.string().uuid().optional(),
    is_enabled: z.boolean().optional(),
    template_id: z.string().uuid().nullable().optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });
