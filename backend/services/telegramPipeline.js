import { query } from '../database/db.js';
import { logger } from './logger.js';
import { enforceIngestionFilter } from './datahubFilterRulesService.js';

/**
 * Transfer unprocessed Telegram messages from telegram_messages to collected_data (TASK-DHT-030)
 * 
 * Strategy: Polling-based job that processes messages in batches
 * - Finds messages where is_processed = false
 * - Maps channel_id → data_source via telegram_channels
 * - Creates collected_data entries with raw_data and normalized_data
 */
export async function transferTelegramMessagesToPipeline(batchSize = 50) {
    const summary = {
        totalMessages: 0,
        processed: 0,
        transferred: 0,
        skipped: 0,
        errors: 0,
        details: [],
    };

    try {
        // 1. Fetch unprocessed telegram messages
        const messagesResult = await query(
            `SELECT tm.*, tc.channel_id as telegram_channel_id, tc.username as channel_username, tc.title as channel_title, tc.category as channel_category
             FROM telegram_messages tm
             JOIN telegram_channels tc ON tm.channel_id = tc.id
             WHERE tm.is_processed = false
             ORDER BY tm.telegram_created_at ASC NULLS LAST, tm.created_at ASC
             LIMIT $1`,
            [batchSize]
        );

        const messages = messagesResult.rows;
        summary.totalMessages = messages.length;

        if (messages.length === 0) {
            logger.debug('No unprocessed telegram messages found');
            return summary;
        }

        logger.info(`Processing ${messages.length} unprocessed telegram messages...`);

        for (const message of messages) {
            try {
                // 2. Find corresponding data_source for this channel
                const channelIdStr = String(message.telegram_channel_id);
                const dataSourceResult = await query(
                    `SELECT id, name, category
                     FROM data_sources
                     WHERE type = 'telegram'
                     AND config->>'channelId' = $1
                     LIMIT 1`,
                    [channelIdStr]
                );

                if (dataSourceResult.rows.length === 0) {
                    logger.warn(`No data source found for telegram channel ${channelIdStr}, skipping message ${message.id}`);
                    summary.skipped += 1;
                    summary.details.push({
                        messageId: message.id,
                        channelId: channelIdStr,
                        action: 'skipped',
                        reason: 'No data source found',
                    });
                    continue;
                }

                const dataSource = dataSourceResult.rows[0];

                // 3. Check if this message already exists in collected_data (deduplication)
                const existingCheck = await query(
                    `SELECT id FROM collected_data
                     WHERE source_id = $1
                     AND raw_data->>'telegram_message_id' = $2
                     LIMIT 1`,
                    [dataSource.id, String(message.message_id)]
                );

                if (existingCheck.rows.length > 0) {
                    logger.debug(`Message ${message.message_id} already exists in collected_data, skipping`);
                    summary.skipped += 1;
                    // Mark as processed even if duplicate
                    await query(
                        'UPDATE telegram_messages SET is_processed = true, processed_at = NOW() WHERE id = $1',
                        [message.id]
                    );
                    continue;
                }

                // 4. Build raw_data structure
                const rawData = {
                    telegram_message_id: message.message_id,
                    channel_id: message.channel_id,
                    telegram_channel_id: channelIdStr,
                    channel_username: message.channel_username,
                    channel_title: message.channel_title,
                    sender_id: message.sender_id,
                    sender_username: message.sender_username,
                    message_text: message.message_text,
                    message_type: message.message_type,
                    has_media: message.has_media,
                    media_url: message.media_url,
                    telegram_created_at: message.telegram_created_at,
                    extracted_signals: message.extracted_signals,
                    sentiment_score: message.sentiment_score ? parseFloat(message.sentiment_score) : null,
                };

                // 5. Build normalized_data structure (basic normalization, full normalization happens in pipeline)
                const normalizedData = {
                    title: message.message_text?.substring(0, 200) || `Telegram Message ${message.message_id}`,
                    content: message.message_text || '',
                    tags: ['telegram', message.channel_category || 'signals'],
                    sentiment: message.sentiment_score ? parseFloat(message.sentiment_score) : null,
                    channel: message.channel_username || message.channel_title || channelIdStr,
                    publishedAt: message.telegram_created_at || message.created_at,
                    entities: {
                        telegram: {
                            message_id: message.message_id,
                            channel_id: channelIdStr,
                            sender_id: message.sender_id,
                            sender_username: message.sender_username,
                        },
                    },
                    metadata: {
                        source_type: 'telegram',
                        has_media: message.has_media || false,
                        media_url: message.media_url || null,
                        message_type: message.message_type || 'text',
                    },
                };

                // 6. Ingestion filter (GAP-024)
                try {
                    await enforceIngestionFilter({
                        source_id: dataSource.id,
                        url: message.media_url || null,
                        text: normalizedData.content || message.text || message.caption,
                        metadata: { source_type: 'telegram', channel_id: channelIdStr },
                    });
                } catch (filterErr) {
                    if (filterErr.code === 'FILTER_BLOCKED') {
                        summary.skipped += 1;
                        summary.details.push({
                            messageId: message.id,
                            channelId: channelIdStr,
                            action: 'filter_blocked',
                            reason: filterErr.details?.reason,
                        });
                        continue;
                    }
                    throw filterErr;
                }

                // 7. Insert into collected_data
                const collectedDataResult = await query(
                    `INSERT INTO collected_data
                        (source_id, raw_data, normalized_data, collected_at, status, metadata)
                     VALUES
                        ($1, $2, $3, $4, 'pending', $5)
                     RETURNING id`,
                    [
                        dataSource.id,
                        JSON.stringify(rawData),
                        JSON.stringify(normalizedData),
                        message.telegram_created_at || message.created_at,
                        JSON.stringify({
                            telegram_message_id: message.message_id,
                            channel_id: message.channel_id,
                            transferred_at: new Date().toISOString(),
                        }),
                    ]
                );

                const collectedDataId = collectedDataResult.rows[0].id;

                // 7. Mark telegram message as processed
                await query(
                    'UPDATE telegram_messages SET is_processed = true, processed_at = NOW() WHERE id = $1',
                    [message.id]
                );

                summary.transferred += 1;
                summary.processed += 1;
                summary.details.push({
                    messageId: message.id,
                    channelId: channelIdStr,
                    dataSourceId: dataSource.id,
                    collectedDataId,
                    action: 'transferred',
                });

            } catch (error) {
                logger.error(`Failed to transfer telegram message ${message.id}:`, {
                    error: error.message,
                    stack: error.stack,
                });
                summary.errors += 1;
                summary.details.push({
                    messageId: message.id,
                    action: 'error',
                    error: error.message,
                });
            }
        }

        logger.info('Telegram messages → collected_data transfer completed', summary);
        return summary;
    } catch (error) {
        logger.error('Failed to transfer telegram messages to pipeline', {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}
