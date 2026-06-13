import { z } from 'zod';

const sourceKindEnum = z.enum(['api', 'rss', 'website', 'telegram']);
const suggestedTypeEnum = z.enum(['api', 'rss', 'web', 'telegram']);
const priorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
const statusEnum = z.enum(['pending', 'approved', 'rejected', 'duplicate', 'ignored']);
const discoverySourceEnum = z.enum(['crawler', 'telegram', 'known_sources', 'rule']);

export const updateDiscoverySettingsSchema = z.object({
    enabled: z.boolean(),
});

export const createDiscoveryRuleSchema = z.object({
    name: z.string().min(1).max(255),
    pattern: z.string().min(1).max(2000),
    source_kind: sourceKindEnum.default('website'),
    category: z.string().max(100).default('uncategorized'),
    priority: priorityEnum.default('medium'),
    is_enabled: z.boolean().default(true),
    metadata: z.record(z.unknown()).optional().default({}),
});

export const updateDiscoveryRuleSchema = createDiscoveryRuleSchema.partial();

export const listSuggestionsQuerySchema = z.object({
    status: statusEnum.optional(),
    discovery_source: discoverySourceEnum.optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const approveSuggestionSchema = z.object({
    review_note: z.string().max(2000).optional().nullable(),
    name: z.string().min(1).max(255).optional(),
    category: z.string().max(100).optional(),
    allow_duplicate_url: z.boolean().optional().default(false),
});

export const rejectSuggestionSchema = z.object({
    review_note: z.string().max(2000).optional().nullable(),
});

export const ignoreSuggestionSchema = rejectSuggestionSchema;

export const uuidParamSchema = z.object({
    id: z.string().uuid(),
});
