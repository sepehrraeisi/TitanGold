import { query } from '../database/db.js';
import { logger } from './logger.js';

/**
 * Sync active Telegram collector channels from `telegram_channels`
 * into `data_sources` rows of type `telegram`.
 *
 * Behavior (TASK-DHT-010):
 * - For each active channel in `telegram_channels`:
 *   - If no corresponding telegram data source exists → create one.
 *   - If it exists → update key fields (name, url, category, config metadata).
 *
 * Matching strategy:
 * - Prefer exact match on config->>'channelId'
 * - Fallback to config->>'channelUsername'
 * - Fallback to URL pattern `https://t.me/<username>`
 */
export async function syncTelegramChannelsToDataSources() {
    const summary = {
        totalChannels: 0,
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        details: [],
    };

    try {
        // Load all active telegram channels
        const channelsResult = await query(
            `SELECT id, channel_id, username, title, category, is_active
             FROM telegram_channels
             WHERE is_active = true`
        );

        const channels = channelsResult.rows;
        summary.totalChannels = channels.length;

        for (const channel of channels) {
            const channelIdStr = String(channel.channel_id);
            const username = channel.username || null;
            const title = channel.title || username || `Telegram Channel ${channelIdStr}`;
            const category = channel.category || 'signals';

            let url = null;
            if (username) {
                url = `https://t.me/${username.replace('@', '')}`;
            }

            // Try to find existing telegram data source for this channel
            // Build dynamic query to handle NULL parameters properly
            let whereConditions = [`config->>'channelId' = $1`];
            const params = [channelIdStr];
            
            if (username) {
                params.push(username);
                whereConditions.push(`config->>'channelUsername' = $${params.length}`);
            }
            
            if (url) {
                params.push(url);
                whereConditions.push(`url ILIKE $${params.length}`);
            }
            
            const existingResult = await query(
                `SELECT *
                 FROM data_sources
                 WHERE type = 'telegram'
                 AND (${whereConditions.join(' OR ')})
                 ORDER BY updated_at DESC NULLS LAST
                 LIMIT 1`,
                params
            );

            const hasExisting = existingResult.rows.length > 0;

            if (!hasExisting) {
                // Create new telegram data source
                const config = {
                    channelId: channelIdStr,
                    channelUsername: username,
                    tags: [
                        'telegram',
                        'signals',
                        ...(title ? [title.toLowerCase().replace(/\s+/g, '-')] : []),
                    ],
                };

                await query(
                    `INSERT INTO data_sources
                        (name, type, url, category, priority, status, health_status, config, is_enabled, created_at, updated_at)
                     VALUES
                        ($1, 'telegram', $2, $3, 5, 'active', 'healthy', $4, true, NOW(), NOW())`,
                    [title, url, category, JSON.stringify(config)]
                );

                summary.created += 1;
                summary.processed += 1;
                summary.details.push({
                    channelId: channelIdStr,
                    action: 'created',
                    username,
                });
            } else {
                const existing = existingResult.rows[0];

                // Merge / update config
                const existingConfig = existing.config || {};
                const newConfig = {
                    ...existingConfig,
                    channelId: channelIdStr,
                    channelUsername: username || existingConfig.channelUsername || null,
                };

                await query(
                    `UPDATE data_sources
                     SET name = $1,
                         url = COALESCE($2, url),
                         category = COALESCE($3, category),
                         config = $4,
                         updated_at = NOW()
                     WHERE id = $5`,
                    [
                        title || existing.name,
                        url,
                        category,
                        JSON.stringify(newConfig),
                        existing.id,
                    ]
                );

                summary.updated += 1;
                summary.processed += 1;
                summary.details.push({
                    channelId: channelIdStr,
                    action: 'updated',
                    username,
                    dataSourceId: existing.id,
                });
            }
        }

        logger.info('Telegram channels → Data Sources sync completed', summary);
        return summary;
    } catch (error) {
        logger.error('Failed to sync telegram_channels with data_sources', {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}

/**
 * Update data source category when telegram channel category changes (TASK-DHT-020)
 * 
 * @param {string} channelId - Telegram channel ID (from telegram_channels.channel_id)
 * @param {string} newCategory - New category value
 * @returns {Promise<{success: boolean, dataSourceId?: string, updated: boolean}>}
 */
export async function syncChannelCategoryToDataSource(channelId, newCategory) {
    try {
        const channelIdStr = String(channelId);
        
        // Find the data source for this channel
        const existingResult = await query(
            `SELECT id, category
             FROM data_sources
             WHERE type = 'telegram'
             AND config->>'channelId' = $1
             LIMIT 1`,
            [channelIdStr]
        );

        if (existingResult.rows.length === 0) {
            logger.warn(`No data source found for telegram channel ${channelIdStr} to sync category`);
            return { success: false, updated: false };
        }

        const dataSource = existingResult.rows[0];
        
        // Only update if category actually changed
        if (dataSource.category === newCategory) {
            return { 
                success: true, 
                dataSourceId: dataSource.id, 
                updated: false,
                message: 'Category already matches'
            };
        }

        // Update the data source category
        await query(
            `UPDATE data_sources
             SET category = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [newCategory, dataSource.id]
        );

        logger.info(`Synced category for channel ${channelIdStr} → data source ${dataSource.id}`, {
            channelId: channelIdStr,
            dataSourceId: dataSource.id,
            oldCategory: dataSource.category,
            newCategory
        });

        return { 
            success: true, 
            dataSourceId: dataSource.id, 
            updated: true,
            oldCategory: dataSource.category,
            newCategory
        };
    } catch (error) {
        logger.error('Failed to sync channel category to data source', {
            error: error.message,
            stack: error.stack,
            channelId
        });
        throw error;
    }
}
