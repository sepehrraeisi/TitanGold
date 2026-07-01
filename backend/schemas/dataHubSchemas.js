import { z } from 'zod';

/**
 * Zod schemas for Data Hub validation
 * TASK-BE-008: Add input validation middleware
 */

// Data Source Type enum
const DataSourceType = z.enum(['api', 'rss', 'telegram', 'websocket', 'onchain', 'web'], {
    errorMap: () => ({ message: 'Type must be one of: api, rss, telegram, websocket, onchain, web' })
});

// URL validation with custom error message
const urlSchema = z.string().url({ message: 'Must be a valid URL format' }).max(1000, 'URL must not exceed 1000 characters');

// Data Source Update Interval strings from UI
const UpdateInterval = z.enum(['realtime', '1min', '5min', '15min', '30min', '1hour', 'daily'], {
    errorMap: () => ({ message: 'Invalid update interval' })
});

// Helper to convert interval string to minutes
const intervalToMinutes = (interval) => {
    const map = {
        'realtime': 1,
        '1min': 1,
        '5min': 5,
        '15min': 15,
        '30min': 30,
        '1hour': 60,
        'daily': 1440
    };
    return map[interval] || 60;
};

// Data Source Creation Schema (POST)
export const createDataSourceSchema = z.object({
    name: z.string()
        .min(1, 'Name cannot be empty')
        .max(255, 'Name must not exceed 255 characters')
        .trim(),
    type: DataSourceType,
    url: urlSchema.optional().nullable(),
    category_id: z.string().uuid('Category ID must be a valid UUID').optional().nullable(),
    category: z.string()
        .max(100, 'Category must not exceed 100 characters')
        .optional()
        .nullable(),
    method: z.string().optional().default('GET'),
    update_interval: UpdateInterval.optional().default('5min'),
    refresh_interval: z.number().int().optional().nullable(),
    config: z.record(z.any()).optional().nullable(),
    credentials: z.record(z.any()).optional().nullable(),
    is_active: z.boolean().optional().default(true),
    allow_duplicate_url: z.boolean().optional().default(false),
}).transform(data => {
    // Map update_interval string to refresh_interval minutes if refresh_interval not provided
    if (!data.refresh_interval && data.update_interval) {
        data.refresh_interval = intervalToMinutes(data.update_interval);
    }
    return data;
});

// Data Source Update Schema (PUT)
export const updateDataSourceSchema = z.object({
    name: z.string()
        .min(1, 'Name cannot be empty')
        .max(255, 'Name must not exceed 255 characters')
        .trim()
        .optional(),
    type: DataSourceType.optional(),
    url: urlSchema.optional().nullable(),
    category_id: z.string().uuid('Category ID must be a valid UUID').optional().nullable(),
    category: z.string()
        .max(100, 'Category must not exceed 100 characters')
        .optional()
        .nullable(),
    method: z.string().optional(),
    update_interval: UpdateInterval.optional(),
    refresh_interval: z.number().int().optional().nullable(),
    config: z.record(z.any()).optional().nullable(),
    credentials: z.record(z.any()).optional().nullable(),
    is_active: z.boolean().optional(),
    allow_duplicate_url: z.boolean().optional().default(false),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
).transform(data => {
    if (!data.refresh_interval && data.update_interval) {
        data.refresh_interval = intervalToMinutes(data.update_interval);
    }
    return data;
});

// Category Creation/Update Schema
export const categorySchema = z.object({
    name: z.string()
        .min(1, 'Name cannot be empty')
        .max(100, 'Name must not exceed 100 characters')
        .trim(),
    description: z.string()
        .max(500, 'Description must not exceed 500 characters')
        .optional()
        .nullable(),
    color: z.string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF5733)')
        .optional()
        .nullable(),
    icon: z.string()
        .max(50, 'Icon must not exceed 50 characters')
        .optional()
        .nullable()
});

// Category Response Schema
export const categoryResponseSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    created_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()),
    updated_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()).optional().nullable()
});

// Category List Response Schema
export const categoryListResponseSchema = z.array(categoryResponseSchema);

// Pagination Query Schema
export const paginationQuerySchema = z.object({
    limit: z.string()
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().min(1).max(100))
        .optional()
        .default('50'),
    offset: z.string()
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().min(0))
        .optional()
        .default('0')
});

// Collected Data Query Schema
export const collectedDataQuerySchema = paginationQuerySchema.extend({
    status: z.enum(['pending', 'processed', 'error'], {
        errorMap: () => ({ message: 'Status must be one of: pending, processed, error' })
    }).optional(),
    start_date: z.string().datetime({ message: 'start_date must be a valid ISO 8601 date format' }).optional(),
    end_date: z.string().datetime({ message: 'end_date must be a valid ISO 8601 date format' }).optional(),
    source_id: z.string().uuid({ message: 'source_id must be a valid UUID' }).optional(),
    agentKey: z.string().min(1).optional(),
    agent_key: z.string().min(1).optional(),
}).refine(
    (data) => {
        if (data.start_date && data.end_date) {
            return new Date(data.start_date) <= new Date(data.end_date);
        }
        return true;
    },
    { message: 'start_date must be before or equal to end_date', path: ['start_date'] }
);

// UUID Param Schema
export const uuidParamSchema = z.object({
    id: z.string().uuid({ message: 'ID must be a valid UUID' })
});
// Data Source Response Schema
export const dataSourceResponseSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: DataSourceType,
    url: urlSchema.optional().nullable(),
    method: z.string().optional().default('GET'),
    refresh_interval: z.number().int().optional().nullable(),
    category_id: z.string().uuid().optional().nullable(),
    category: z.string().optional().nullable(),
    tags: z.array(z.string()).optional().default([]),
    priority: z.enum(['low', 'medium', 'high', 'critical']).or(z.number()).optional().transform(val => {
        if (typeof val === 'number') {
            const map = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };
            return map[val] || 'low';
        }
        return val || 'low';
    }),
    is_active: z.boolean().optional().default(true),
    last_fetch_at: z.string().datetime().or(z.date()).transform(val => val ? new Date(val).toISOString() : null).optional().nullable(),
    last_status: z.string().optional().nullable(),
    error_count: z.number().int().optional().default(0),
    success_rate: z.number().optional().default(0),
    reliability_score: z.number().optional().default(0),
    response_time: z.number().int().optional().nullable(),
    created_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()),
    updated_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()).optional().nullable(),
    deleted_at: z.string().datetime().or(z.date()).transform(val => val ? new Date(val).toISOString() : null).optional().nullable(),
    hasCredentials: z.boolean().optional(),
    telegram_ingestion_mode: z.enum(['collector', 'bot']).optional().nullable(),
    operational_status: z.enum(['active', 'linked', 'pending', 'error']).optional().nullable(),
    suppress_last_error: z.boolean().optional(),
    success_rate_display: z.enum(['na']).optional().nullable(),
    collector_last_activity_at: z.string().datetime().optional().nullable(),
    effective_category: z.string().optional().nullable(),
    category_needs_review: z.boolean().optional(),
    normalized_url: z.string().optional().nullable(),
    duplicate_url_key: z.string().optional().nullable(),
    duplicate_url_count: z.number().int().optional().default(0),
    duplicate_active_count: z.number().int().optional().default(0),
    duplicate_url_severity: z.enum(['high', 'medium', 'low', 'info']).optional().nullable(),
    duplicate_url_ignored: z.boolean().optional(),
    duplicate_url_siblings: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        type: z.string(),
        url: z.string().optional().nullable(),
        normalizedUrl: z.string().optional().nullable(),
        isActive: z.boolean(),
        createdAt: z.string().optional().nullable(),
        lastFetchAt: z.string().optional().nullable(),
        collectedCount: z.number().int().optional().default(0),
        lastCollectedAt: z.string().optional().nullable(),
    })).optional().default([]),
    duplicate_url_warnings: z.array(z.object({
        code: z.string(),
        message: z.string().optional(),
        duplicates: z.array(z.any()).optional(),
    })).optional(),
});

export const checkDuplicateUrlQuerySchema = z.object({
    type: z.enum(['rss', 'web', 'api']),
    url: urlSchema,
    exclude_source_id: z.string().uuid().optional(),
});

// Paginated Data Sources Schema
export const dataSourcesListResponseSchema = z.object({
    data: z.array(dataSourceResponseSchema),
    pagination: z.object({
        total: z.number().int(),
        page: z.number().int(),
        limit: z.number().int(),
        totalPages: z.number().int(),
        hasNextPage: z.boolean(),
        hasPrevPage: z.boolean()
    })
});

// Collected Data Response Schema
export const collectedDataResponseSchema = z.object({
    id: z.string().uuid(),
    source_id: z.string().uuid(),
    raw_data: z.any(),
    normalized_data: z.any().optional().nullable(),
    collected_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()),
    processed_at: z.string().datetime().or(z.date()).transform(val => val ? new Date(val).toISOString() : null).optional().nullable(),
    status: z.enum(['pending', 'processed', 'error']),
    error_message: z.string().optional().nullable(),
    metadata: z.record(z.any()).optional().nullable(),
    created_at: z.string().datetime().or(z.date()).transform(val => new Date(val).toISOString()),
    source_name: z.string().optional().nullable(),
    source_type: z.string().optional().nullable()
});

// Paginated Collected Data Schema
export const collectedDataListResponseSchema = z.object({
    data: z.array(collectedDataResponseSchema),
    pagination: z.object({
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean()
    })
});

// DataHub Stats Schema
export const dataHubStatsSchema = z.object({
    total_sources: z.string().or(z.number()).transform(val => parseInt(val, 10)),
    active_sources: z.string().or(z.number()).transform(val => parseInt(val, 10)),
    total_logs: z.string().or(z.number()).transform(val => parseInt(val, 10)),
    logs_24h: z.string().or(z.number()).transform(val => parseInt(val, 10)),
    logs_7d: z.string().or(z.number()).transform(val => parseInt(val, 10))
});

// DataHub State Schema
export const dataHubStateSchema = z.object({
    status: z.string(),
    totalSources: z.number().int(),
    activeSources: z.number().int(),
    sourcesByType: z.object({
        telegram: z.number().int(),
        rss: z.number().int(),
        api: z.number().int()
    }),
    recentLogs: z.number().int(),
    totalLogs: z.number().int(),
    recentSources: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        type: DataSourceType,
        is_active: z.boolean(),
        last_fetch_at: z.string().datetime().optional().nullable(),
        config: z.record(z.any()).optional().nullable()
    }))
});

// ========================================
// TASK-DH-008: Collected Data Schemas
// ========================================

// Telegram Message Validation Schema (matches telegram-collector validation)
export const telegramMessageSchema = z.object({
    id: z.number().int().positive('Message ID must be a positive integer'),
    date: z.number().int().positive('Date must be a Unix timestamp'),
    text: z.string().optional().nullable(),
    views: z.number().int().nonnegative('Views must be non-negative').optional().nullable(),
    forwards: z.number().int().nonnegative('Forwards must be non-negative').optional().nullable(),
    media: z.any().optional().nullable(),
    replyTo: z.number().int().optional().nullable(),
    edited: z.number().int().optional().nullable()
});

// Normalized Message Metadata Schema
export const normalizedMetadataSchema = z.object({
    views: z.number().int().nonnegative().default(0),
    forwards: z.number().int().nonnegative().default(0),
    has_media: z.boolean().default(false),
    media_type: z.string().optional().nullable(),
    is_reply: z.boolean().default(false),
    is_edited: z.boolean().default(false),
    char_count: z.number().int().nonnegative().default(0),
    word_count: z.number().int().nonnegative().default(0),
    has_url: z.boolean().default(false),
    has_hashtag: z.boolean().default(false),
    has_mention: z.boolean().default(false),
    language: z.string().default('en'),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional().nullable()
});

// Normalized Message Extracted Content Schema
export const normalizedExtractedSchema = z.object({
    urls: z.array(z.string().url()).default([]),
    hashtags: z.array(z.string()).default([]),
    mentions: z.array(z.string()).default([]),
    prices: z.array(z.object({
        value: z.number(),
        currency: z.string()
    })).optional().nullable(),
    dates: z.array(z.string()).optional().nullable()
});

// Full Normalized Message Schema (legacy telegram-collector shape)
export const normalizedMessageSchema = z.object({
    message_id: z.number().int().positive(),
    content: z.string().default(''),
    timestamp: z.string().datetime(),
    metadata: normalizedMetadataSchema,
    extracted: normalizedExtractedSchema
});

// Canonical normalized_data v1 (DH-NORMALIZATION-P0-CONTRACT-1)
export const normalizedDataV1MetadataSchema = z
    .object({
        rawStatus: z.string().nullable().optional(),
        ingestionMode: z.string().optional(),
        telegramMessageId: z.string().nullable().optional(),
        telegramChannelId: z.string().nullable().optional(),
        telegramChannelUsername: z.string().nullable().optional(),
        normalizedAt: z.string().optional(),
        normalizerVersion: z.string().optional(),
    })
    .passthrough();

export const normalizedDataV1Schema = z
    .object({
        version: z.literal('datahub.normalized.v1').optional(),
        title: z.string().min(1),
        content: z.string(),
        summary: z.string().nullable().optional(),
        sourceType: z.enum(['telegram', 'rss', 'api', 'webhook', 'crawler', 'unknown']),
        sourceId: z.string().uuid().nullable().optional(),
        sourceName: z.string().nullable().optional(),
        category: z.string().min(1),
        language: z.string().nullable().optional(),
        timestamp: z.string(),
        publishedAt: z.string().nullable().optional(),
        entities: z.record(z.any()).optional(),
        signals: z.array(z.any()).optional(),
        tags: z.array(z.string()).optional(),
        metadata: normalizedDataV1MetadataSchema.optional(),
    })
    .passthrough();

/** API ingress: v1 contract, legacy collector message, or transfer envelope */
export const normalizedDataAcceptSchema = z
    .union([normalizedDataV1Schema, normalizedMessageSchema, z.record(z.any())])
    .optional()
    .nullable();

// Create Collected Data Schema (POST)
export const createCollectedDataSchema = z.object({
    source_id: z.string().uuid('Source ID must be a valid UUID'),
    raw_data: z.record(z.any()), // JSONB - any valid JSON
    normalized_data: normalizedDataAcceptSchema,
    content_hash: z.string()
        .min(1, 'Content hash cannot be empty')
        .max(64, 'Content hash must not exceed 64 characters')
        .optional()
        .nullable(),
    status: z.enum(['pending', 'processed', 'error']).optional().default('pending'),
    error_message: z.string().max(1000, 'Error message must not exceed 1000 characters').optional().nullable(),
    metadata: z.record(z.any()).optional().nullable()
});

// Batch Create Collected Data Schema
export const batchCreateCollectedDataSchema = z.object({
    source_id: z.string().uuid('Source ID must be a valid UUID'),
    messages: z.array(createCollectedDataSchema.omit({ source_id: true }))
        .min(1, 'At least one message must be provided')
        .max(100, 'Cannot process more than 100 messages at once')
});

// Update Collected Data Schema (PUT)
export const updateCollectedDataSchema = z.object({
    normalized_data: normalizedDataAcceptSchema,
    status: z.enum(['pending', 'processed', 'error']).optional(),
    processed_at: z.string().datetime().or(z.date()).optional().nullable(),
    error_message: z.string().max(1000).optional().nullable(),
    metadata: z.record(z.any()).optional().nullable()
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
);

// Query/Filter Schema for Collected Data
export const collectedDataFilterSchema = z.object({
    source_id: z.string().uuid().optional(),
    status: z.enum(['pending', 'processed', 'error']).optional(),
    from_date: z.string().datetime().or(z.date()).optional(),
    to_date: z.string().datetime().or(z.date()).optional(),
    has_normalized: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
    language: z.string().optional(),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
    has_url: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
    has_hashtag: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
    agentKey: z.string().min(1).optional(),
    agent_key: z.string().min(1).optional(),
    limit: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional().default('50'),
    offset: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional().default('0')
});

// Validation Result Schema (from telegram-collector)
export const validationResultSchema = z.object({
    valid: z.boolean(),
    errors: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([]),
    qualityHints: z.array(z.string()).default([]).optional(),
});

// Process Message Response Schema
export const processMessageResponseSchema = z.object({
    validation: validationResultSchema,
    normalized: normalizedMessageSchema.nullable(),
    content_hash: z.string()
});

// Pipeline snapshot (GAP-012) — DH-PIPELINE-FIX-3 extended source quality statuses
const pipelineSourceQualityStatus = z.enum([
  'success',
  'pending_normalization',
  'no_data',
  'fetch_error',
  'fetch_timeout',
  'inactive',
  'collector_active',
  'collector_pending',
  'collector_linked',
  'collector_error',
  // legacy values kept for backward-compatible clients
  'failed',
  'cached',
  'timeout',
]);
const pipelineAccessStatus = pipelineSourceQualityStatus;
const pipelineNormalizedStatus = z.enum([
  'ready',
  'warning',
  'rejected',
  'pending_normalization',
  'ingested',
]);

const pipelineCollectorBacklogSchema = z.object({
  backlogCount: z.number().int().nonnegative(),
  oldestQueuedAt: z.string().optional(),
  newestQueuedAt: z.string().optional(),
  estimatedWaitHours: z.number().nonnegative().optional(),
  estimatedWaitDays: z.number().nonnegative().optional(),
  queuePositionRank: z.number().int().positive().optional(),
  messagesAheadInQueue: z.number().int().nonnegative().optional(),
});

const pipelineTransferThroughputSchema = z.object({
  processed24h: z.number().int().nonnegative(),
  messagesPerHour: z.number().nonnegative(),
  messagesPerDay: z.number().int().nonnegative(),
  observedWindowHours: z.number().int().positive(),
});

const pipelineGlobalTelegramBacklogSchema = z.object({
  unprocessedTotal: z.number().int().nonnegative(),
  oldestUnprocessed: z.string().optional(),
  newestUnprocessed: z.string().optional(),
});

const pipelineTelegramIngestMetricsSchema = z.object({
  incoming24h: z.number().int().nonnegative(),
  transferredToCollectedData24h: z.number().int().nonnegative(),
});

export const dataPipelineSnapshotSchema = z.object({
    lastRefreshed: z.string(),
    totalRequests24h: z.number().int().nonnegative(),
    passed24h: z.number().int().nonnegative(),
    failed24h: z.number().int().nonnegative(),
    pending24h: z.number().int().nonnegative(),
    totalRecords: z.number().int().nonnegative(),
    normalizedPercent: z.number(),
    transferThroughput: pipelineTransferThroughputSchema.optional(),
    globalTelegramBacklog: pipelineGlobalTelegramBacklogSchema.optional(),
    sources: z.array(z.object({
        sourceId: z.string().uuid(),
        name: z.string(),
        category: z.string(),
        lastDataType: z.string(),
        lastStatus: pipelineAccessStatus,
        operationalStatus: z.enum(['active', 'linked', 'pending', 'error']).optional(),
        statusHint: z.string().optional(),
        collectorBacklog: pipelineCollectorBacklogSchema.optional(),
        lastResponseTime: z.number().optional(),
        lastChecked: z.string().optional(),
        issues: z.array(z.string()).optional()
    })),
    categories: z.array(z.object({
        categoryId: z.string().uuid(),
        name: z.string(),
        inflow: z.number().int().nonnegative(),
        passRate: z.number()
    }))
});

export const pipelineQuerySchema = z.object({
  includeBacklog: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  includeCategoryScreening: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  includeNormalizationSummary: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  includeDuplicateAnalysis: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  includeTelegramBacklog: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  includeRecentPreview: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const dataPipelineBacklogResponseSchema = z.object({
  transferThroughput: pipelineTransferThroughputSchema,
  globalTelegramBacklog: pipelineGlobalTelegramBacklogSchema,
  ingestMetrics: pipelineTelegramIngestMetricsSchema,
  backlogBySourceId: z.record(pipelineCollectorBacklogSchema),
  meta: z
    .object({
      partial: z.boolean().optional(),
      warnings: z.array(z.string()).optional(),
      fetchedAt: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
});

export const accessLogsQuerySchema = z.object({
    limit: z.string().regex(/^\d+$/).transform(val => Math.min(parseInt(val, 10), 500)).optional().default('100'),
    offset: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional().default('0'),
    source_id: z.string().uuid().optional(),
    status: z.enum(['success', 'cached', 'failed', 'timeout']).optional()
});

export const dataAccessLogSchema = z.object({
    id: z.string().uuid(),
    timestamp: z.string(),
    agentId: z.string(),
    sourceId: z.string(),
    sourceName: z.string().optional(),
    action: z.string().optional(),
    dataType: z.string(),
    status: z.enum(['success', 'failed', 'cached', 'timeout']),
    message: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    responseTime: z.number().optional(),
    error: z.string().optional(),
    dataSize: z.number().optional()
});

export const accessLogsListResponseSchema = z.object({
    data: z.array(dataAccessLogSchema),
    pagination: z.object({
        total: z.number().int().nonnegative(),
        limit: z.number().int().positive(),
        offset: z.number().int().nonnegative(),
        hasMore: z.boolean()
    }),
    statusCounts: z.object({
        success: z.number().int().nonnegative(),
        cached: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        timeout: z.number().int().nonnegative(),
        error: z.number().int().nonnegative().optional(),
        warning: z.number().int().nonnegative().optional()
    })
});

export const dataPipelineViewResponseSchema = z.object({
    snapshot: dataPipelineSnapshotSchema,
    history: z.array(z.object({
        id: z.string(),
        generatedAt: z.string(),
        snapshot: dataPipelineSnapshotSchema
    })),
    normalizationSummary: z.object({
        totalProcessed: z.number().int().nonnegative(),
        passed: z.number().int().nonnegative(),
        warnings: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
        lastProcessedAt: z.string().optional()
    }),
    normalizedData: z.array(z.object({
        id: z.string().uuid(),
        sourceId: z.string().uuid(),
        sourceName: z.string().optional(),
        category: z.string(),
        dataType: z.string(),
        tags: z.array(z.string()),
        payload: z.record(z.any()),
        qualityScore: z.number().optional(),
        qualityPending: z.boolean().optional(),
        qualityReasonCodes: z.array(z.string()).optional(),
        issues: z.array(z.string()),
        status: pipelineNormalizedStatus,
        ingestedAt: z.string().optional(),
        publishedAt: z.string().optional(),
        receivedAt: z.string(),
        normalizedAt: z.string()
    }))
});
