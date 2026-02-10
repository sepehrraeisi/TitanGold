import { z } from 'zod';

/**
 * Data Source validation schema
 */
export const dataSourceSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters'),
    type: z.enum(['api', 'webhook', 'rss', 'web', 'telegram', 'website', 'aggregator', 'third_party']),
    url: z.string().url('Invalid URL format').optional().or(z.literal('')),
    category: z.string().min(1, 'Category is required'),
    tags: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    updateInterval: z.enum(['realtime', '1min', '5min', '15min', '30min', '1hour', 'daily']),
    // Type specific validations
    telegramUsername: z.string().optional(),
    telegramToken: z.string().optional(),
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    endpoint: z.string().optional(),
    webhookUrl: z.string().url('Invalid Webhook URL format').optional().or(z.literal('')),
    renderJS: z.boolean().optional(),
}).refine((data) => {
    if (['api', 'rss', 'web', 'website'].includes(data.type) && !data.url) {
        return false;
    }
    return true;
}, {
    message: 'URL is required for this source type',
    path: ['url'],
}).refine((data) => {
    if (data.type === 'webhook' && !data.webhookUrl) {
        return false;
    }
    return true;
}, {
    message: 'Webhook URL is required',
    path: ['webhookUrl'],
}).refine((data) => {
    if (data.type === 'telegram' && !data.telegramUsername) {
        return false;
    }
    return true;
}, {
    message: 'Telegram username is required',
    path: ['telegramUsername'],
});

/**
 * Data Category validation schema
 */
export const dataCategorySchema = z.object({
    name: z.string().min(3, 'Category name must be at least 3 characters'),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (hex required)'),
    icon: z.string().min(1, 'Icon is required'),
    tags: z.string().optional(),
    dataTypes: z.string().optional(),
});

export type DataSourceFormData = z.infer<typeof dataSourceSchema>;
export type DataCategoryFormData = z.infer<typeof dataCategorySchema>;
