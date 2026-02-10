/**
 * Telegram to Data Source Integration
 * Helper functions to create data sources from Telegram channels
 */

import { createDataSource } from '../../../../../../services/api';
import type { DataSource } from '../../../../../../types';

export interface TelegramChannel {
    id: string;
    title: string;
    username?: string;
    participants_count?: number;
}

export interface CreateTelegramSourceOptions {
    channel: TelegramChannel;
    categoryId?: string;
    refreshInterval?: number; // in minutes
    priority?: 'low' | 'medium' | 'high' | 'critical';
    config?: {
        fetchLimit?: number;
        includeMedia?: boolean;
        parseUrls?: boolean;
        tags?: string[];
    };
}

/**
 * Create a data source from a Telegram channel
 * 
 * @example
 * const channel = { id: '-1001234567890', title: 'Gold News', username: 'goldnews' };
 * const source = await createTelegramDataSource({ channel });
 */
export async function createTelegramDataSource(
    options: CreateTelegramSourceOptions
): Promise<DataSource> {
    const { channel, categoryId, refreshInterval = 5, priority = 'medium', config = {} } = options;
    
    // Build channel URL
    const channelUrl = channel.username 
        ? `https://t.me/${channel.username}`
        : `https://t.me/c/${channel.id.replace('-100', '')}`;
    
    // Construct data source
    const sourceData: Omit<DataSource, 'id' | 'createdAt' | 'updatedAt' | 'errorCount' | 'successRate' | 'reliabilityScore'> = {
        name: channel.title,
        type: 'telegram',
        url: channelUrl,
        category: categoryId || 'News', // Default category
        tags: config.tags || ['telegram', 'news'],
        priority,
        method: 'GET',
        status: 'active',
        lastFetchAt: undefined,
        lastStatus: undefined,
        responseTime: undefined,
        config: {
            channelId: channel.id,
            channelUsername: channel.username,
            fetchLimit: config.fetchLimit || 50,
            includeMedia: config.includeMedia !== false, // default true
            parseUrls: config.parseUrls !== false, // default true
            ...config
        },
        credentials: {},
        isActive: true,
        refreshInterval
    };
    
    try {
        const createdSource = await createDataSource(sourceData);
        console.log(`✅ Created Telegram source: ${createdSource.name} (${createdSource.id})`);
        return createdSource;
    } catch (error) {
        console.error('❌ Failed to create Telegram source:', error);
        throw error;
    }
}

/**
 * Batch create multiple Telegram sources
 * 
 * @example
 * const channels = [
 *   { id: '-1001', title: 'Channel 1', username: 'ch1' },
 *   { id: '-1002', title: 'Channel 2', username: 'ch2' }
 * ];
 * const sources = await createMultipleTelegramSources(channels);
 */
export async function createMultipleTelegramSources(
    channels: TelegramChannel[],
    defaultOptions: Omit<CreateTelegramSourceOptions, 'channel'> = {}
): Promise<{ success: DataSource[]; failed: Array<{ channel: TelegramChannel; error: Error }> }> {
    const results = {
        success: [] as DataSource[],
        failed: [] as Array<{ channel: TelegramChannel; error: Error }>
    };
    
    for (const channel of channels) {
        try {
            const source = await createTelegramDataSource({
                channel,
                ...defaultOptions
            });
            results.success.push(source);
        } catch (error) {
            results.failed.push({
                channel,
                error: error as Error
            });
        }
    }
    
    return results;
}

/**
 * Check if a channel is already added as a data source
 */
export function isChannelLinked(
    channelId: string,
    existingSources: DataSource[]
): boolean {
    return existingSources.some(source => 
        source.type === 'telegram' && 
        source.config?.channelId === channelId
    );
}

/**
 * Find data source by Telegram channel ID
 */
export function findSourceByChannelId(
    channelId: string,
    sources: DataSource[]
): DataSource | undefined {
    return sources.find(source =>
        source.type === 'telegram' &&
        source.config?.channelId === channelId
    );
}

/**
 * Update Telegram source configuration
 */
export async function updateTelegramSourceConfig(
    sourceId: string,
    configUpdates: Partial<CreateTelegramSourceOptions['config']>
): Promise<DataSource> {
    // Import dynamically to avoid circular dependency
    const { updateDataSource } = await import('../../../../../../services/api');
    
    return await updateDataSource(sourceId, {
        config: configUpdates
    });
}
