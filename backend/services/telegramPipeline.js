import crypto from 'crypto';
import { query, transaction } from '../database/db.js';
import { getIngestionTimestampForInsert } from './collectedDataTimestamps.js';
import { logger } from './logger.js';
import { enforceIngestionPolicy, isFilterRuleBlockedError } from './filterRulesGateway.js';
import { recordPipelineJobHeartbeat } from './pipelineSchedulerRuntime.js';

/** Default messages per scheduler run (override via batchSize argument). */
/** DH-PIPELINE-P1-CAPACITY: 700/5min ≈ 201k/day theoretical (Option A). */
export const TELEGRAM_TRANSFER_DEFAULT_BATCH = 700;

/** Max rows handled per DB transaction. */
export const TELEGRAM_TRANSFER_SUB_BATCH = 100;

/** Metadata pipeline version tag. */
export const TELEGRAM_TRANSFER_PIPELINE_VERSION = 'dh-pipeline-p0-arch-1';

/** pg_try_advisory_lock key — single-flight transfer across workers. */
const TRANSFER_ADVISORY_LOCK_KEY = 8392741;

let transferInProgress = false;

function parseConfig(config) {
    if (typeof config === 'string') {
        try {
            return JSON.parse(config);
        } catch {
            return {};
        }
    }
    return config || {};
}

/** Stable dedupe hash aligned with dataFetcher pattern. */
export function generateTelegramContentHash(sourceId, telegramChannelId, messageId) {
    const payload = `${sourceId}:${telegramChannelId}:${messageId}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
}

function emptySummary() {
    return {
        totalMessages: 0,
        selected: 0,
        inserted: 0,
        transferred: 0,
        processed: 0,
        duplicates: 0,
        skipped: 0,
        skipped_no_source: 0,
        skipped_filtered: 0,
        errors: 0,
        durationMs: 0,
        backlogRemaining: null,
        batchSize: 0,
        pipelineVersion: TELEGRAM_TRANSFER_PIPELINE_VERSION,
        skipped_run: false,
        skip_reason: null,
        details: [],
    };
}

/** Backlog stats for observability. */
export async function getTelegramTransferBacklogStats() {
    const result = await query(`
        SELECT
            COUNT(*) FILTER (WHERE is_processed = false)::int AS backlog,
            COUNT(*) FILTER (
                WHERE is_processed = false AND created_at > NOW() - INTERVAL '24 hours'
            )::int AS backlog_24h,
            MIN(telegram_created_at) FILTER (WHERE is_processed = false) AS oldest_unprocessed,
            MAX(created_at) FILTER (WHERE is_processed = false) AS newest_unprocessed
        FROM telegram_messages
    `);
    return result.rows[0] || { backlog: 0, backlog_24h: 0 };
}

/** Load telegram channel_id / username → data_source map. */
async function loadChannelSourceMap() {
    const result = await query(`
        SELECT id, name, category, config
        FROM data_sources
        WHERE type = 'telegram' AND is_active = true
    `);

    const byChannelId = new Map();
    const byUsername = new Map();

    for (const row of result.rows) {
        const cfg = parseConfig(row.config);
        if (cfg.channelId != null) {
            byChannelId.set(String(cfg.channelId), row);
        }
        if (cfg.channelUsername) {
            byUsername.set(String(cfg.channelUsername).replace(/^@/, '').toLowerCase(), row);
        }
    }

    return { byChannelId, byUsername };
}

function resolveSourceForMessage(message, sourceMap) {
    const channelIdStr = String(message.telegram_channel_id);
    let source = sourceMap.byChannelId.get(channelIdStr);
    if (!source && message.channel_username) {
        const username = String(message.channel_username).replace(/^@/, '').toLowerCase();
        source = sourceMap.byUsername.get(username);
    }
    return source;
}

function sanitizeText(text) {
    if (text == null) return text;
    return String(text).replace(/\u0000/g, '');
}

/** Truncate without splitting UTF-16 surrogate pairs (invalid in PostgreSQL jsonb). */
function truncateText(text, maxLen) {
    if (text == null) return text;
    const sanitized = sanitizeText(text);
    if (sanitized.length <= maxLen) return sanitized;
    return [...sanitized].slice(0, maxLen).join('');
}

function buildRawData(message, channelIdStr) {
    let extractedSignals = message.extracted_signals;
    if (typeof extractedSignals === 'string') {
        try {
            extractedSignals = JSON.parse(extractedSignals);
        } catch {
            extractedSignals = null;
        }
    }

    return {
        telegram_message_id: message.message_id,
        channel_id: message.channel_id,
        telegram_channel_id: channelIdStr,
        channel_username: message.channel_username,
        channel_title: message.channel_title,
        sender_id: message.sender_id,
        sender_username: message.sender_username,
        message_text: sanitizeText(message.message_text),
        message_type: message.message_type,
        has_media: message.has_media,
        media_url: message.media_url,
        telegram_created_at: message.telegram_created_at,
        extracted_signals: extractedSignals,
        sentiment_score: message.sentiment_score ? parseFloat(message.sentiment_score) : null,
    };
}

function buildNormalizedData(message, channelIdStr) {
    const text = sanitizeText(message.message_text);
    return {
        title: truncateText(text, 200) || `Telegram Message ${message.message_id}`,
        content: text || '',
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
}

function buildTransferMetadata(message, channelIdStr) {
    return {
        telegram_message_id: message.message_id,
        telegram_channel_id: channelIdStr,
        telegram_channel_username: message.channel_username || null,
        telegram_channel_title: message.channel_title || null,
        telegram_created_at: message.telegram_created_at
            ? new Date(message.telegram_created_at).toISOString()
            : null,
        channel_id: message.channel_id,
        transferred_at: new Date().toISOString(),
        pipeline_version: TELEGRAM_TRANSFER_PIPELINE_VERSION,
    };
}

async function loadExistingTelegramKeys(requestedPairs) {
    if (!Array.isArray(requestedPairs) || requestedPairs.length === 0) {
        return new Set();
    }

    const pairSourceIds = requestedPairs.map((pair) => pair.sourceId);
    const pairMessageIds = requestedPairs.map((pair) => pair.messageId);
    if (
        pairSourceIds.length !== pairMessageIds.length
        || pairSourceIds.length !== requestedPairs.length
    ) {
        throw new Error('Telegram exact-pair lookup invariant failed');
    }

    const result = await query(
        `SELECT cd.source_id::text, cd.raw_data->>'telegram_message_id' AS message_id
         FROM collected_data cd
         JOIN unnest($1::uuid[], $2::text[]) AS v(source_id, message_id)
           ON cd.source_id = v.source_id
          AND (cd.raw_data->>'telegram_message_id') = v.message_id
         WHERE cd.raw_data ? 'telegram_message_id'`,
        [pairSourceIds, pairMessageIds],
    );
    return new Set(result.rows.map((r) => `${r.source_id}:${r.message_id}`));
}

async function markMessagesProcessed(client, messageIds) {
    if (messageIds.length === 0) return;
    await client.query(
        `UPDATE telegram_messages
         SET is_processed = true, processed_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [messageIds],
    );
}

async function processSubBatch(messages, sourceMap) {
    const subSummary = {
        inserted: 0,
        duplicates: 0,
        skipped_no_source: 0,
        skipped_filtered: 0,
        errors: 0,
    };

    const resolved = [];
    const toMarkProcessed = [];

    for (const message of messages) {
        const channelIdStr = String(message.telegram_channel_id);
        const source = resolveSourceForMessage(message, sourceMap);
        if (!source) {
            subSummary.skipped_no_source += 1;
            toMarkProcessed.push(message.id);
            continue;
        }
        resolved.push({ message, source, channelIdStr });
    }

    if (resolved.length === 0) {
        await transaction(async (client) => {
            await markMessagesProcessed(client, toMarkProcessed);
        });
        return subSummary;
    }

    const requestedPairs = resolved.map(({ source, message }) => ({
        sourceId: source.id,
        messageId: String(message.message_id),
    }));
    const existingKeys = await loadExistingTelegramKeys(requestedPairs);

    const toInsert = [];

    for (const item of resolved) {
        const { message, source, channelIdStr } = item;
        const dedupeKey = `${source.id}:${String(message.message_id)}`;
        if (existingKeys.has(dedupeKey)) {
            subSummary.duplicates += 1;
            toMarkProcessed.push(message.id);
            continue;
        }

        const normalizedData = buildNormalizedData(message, channelIdStr);
        const filterText = normalizedData.content || '';
        try {
            await enforceIngestionPolicy({
                sourceId: source.id,
                url: message.media_url,
                text: filterText,
                metadata: buildTransferMetadata(message, channelIdStr),
                enforcementPath: 'telegram_transfer_pipeline',
            });
        } catch (error) {
            if (isFilterRuleBlockedError(error)) {
                subSummary.skipped_filtered += 1;
                toMarkProcessed.push(message.id);
                continue;
            }
            throw error;
        }

        toInsert.push({
            message,
            source,
            channelIdStr,
            rawData: buildRawData(message, channelIdStr),
            normalizedData,
            contentHash: generateTelegramContentHash(source.id, channelIdStr, message.message_id),
        });
    }

    if (toInsert.length === 0) {
        await transaction(async (client) => {
            await markMessagesProcessed(client, toMarkProcessed);
        });
        return subSummary;
    }

    const insertedIds = [];
    const failedIds = [];

    await transaction(async (client) => {
        for (const row of toInsert) {
            const { message, source, channelIdStr, rawData, normalizedData, contentHash } = row;
            await client.query('SAVEPOINT transfer_row');
            try {
                await client.query(
                    `INSERT INTO collected_data
                        (source_id, raw_data, normalized_data, content_hash, collected_at, status, metadata)
                     VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
                    [
                        source.id,
                        rawData,
                        normalizedData,
                        contentHash,
                        getIngestionTimestampForInsert(),
                        buildTransferMetadata(message, channelIdStr),
                    ],
                );
                await client.query('RELEASE SAVEPOINT transfer_row');
                insertedIds.push(message.id);
                subSummary.inserted += 1;
            } catch (error) {
                await client.query('ROLLBACK TO SAVEPOINT transfer_row');
                if (error.code === '23505') {
                    subSummary.duplicates += 1;
                    toMarkProcessed.push(message.id);
                } else {
                    subSummary.errors += 1;
                    failedIds.push(message.id);
                    logger.warn('Telegram transfer row failed', {
                        messageId: message.id,
                        error: error.message,
                    });
                }
            }
        }

        await markMessagesProcessed(client, [...toMarkProcessed, ...insertedIds]);
    });

    if (failedIds.length > 0) {
        logger.warn('Telegram transfer sub-batch had row errors', { count: failedIds.length });
    }

    return subSummary;
}

/**
 * Transfer unprocessed Telegram messages → collected_data (high-throughput).
 */
export async function transferTelegramMessagesToPipeline(
    batchSize = TELEGRAM_TRANSFER_DEFAULT_BATCH,
) {
    const started = Date.now();
    const summary = emptySummary();
    summary.batchSize = batchSize;

    if (transferInProgress) {
        summary.skipped_run = true;
        summary.skip_reason = 'in_memory_lock';
        return summary;
    }

    const lockResult = await query('SELECT pg_try_advisory_lock($1) AS acquired', [
        TRANSFER_ADVISORY_LOCK_KEY,
    ]);
    if (!lockResult.rows[0]?.acquired) {
        summary.skipped_run = true;
        summary.skip_reason = 'advisory_lock';
        return summary;
    }

    transferInProgress = true;

    try {
        const sourceMap = await loadChannelSourceMap();

        const messagesResult = await query(
            `SELECT tm.*,
                    tc.channel_id AS telegram_channel_id,
                    tc.username AS channel_username,
                    tc.title AS channel_title,
                    tc.category AS channel_category
             FROM telegram_messages tm
             INNER JOIN telegram_channels tc ON tm.channel_id = tc.id
             WHERE tm.is_processed = false
             ORDER BY tm.telegram_created_at ASC NULLS LAST, tm.created_at ASC
             LIMIT $1`,
            [batchSize],
        );

        const messages = messagesResult.rows;
        summary.selected = messages.length;
        summary.totalMessages = messages.length;

        if (messages.length === 0) {
            logger.debug('No unprocessed telegram messages found for transfer');
            const backlog = await getTelegramTransferBacklogStats();
            summary.backlogRemaining = backlog.backlog;
            summary.durationMs = Date.now() - started;
            return summary;
        }

        for (let offset = 0; offset < messages.length; offset += TELEGRAM_TRANSFER_SUB_BATCH) {
            const chunk = messages.slice(offset, offset + TELEGRAM_TRANSFER_SUB_BATCH);
            const chunkSummary = await processSubBatch(chunk, sourceMap);
            summary.inserted += chunkSummary.inserted;
            summary.duplicates += chunkSummary.duplicates;
            summary.skipped_no_source += chunkSummary.skipped_no_source;
            summary.skipped_filtered += chunkSummary.skipped_filtered;
            summary.errors += chunkSummary.errors;
        }

        summary.skipped =
            summary.skipped_no_source + summary.skipped_filtered + summary.duplicates;
        summary.transferred = summary.inserted;
        summary.processed =
            summary.inserted +
            summary.duplicates +
            summary.skipped_no_source +
            summary.skipped_filtered;

        const backlog = await getTelegramTransferBacklogStats();
        summary.backlogRemaining = backlog.backlog;
        summary.durationMs = Date.now() - started;

        logger.info('Telegram messages → collected_data transfer completed', {
            batchSize,
            selected: summary.selected,
            inserted: summary.inserted,
            duplicates: summary.duplicates,
            skipped_no_source: summary.skipped_no_source,
            skipped_filtered: summary.skipped_filtered,
            errors: summary.errors,
            durationMs: summary.durationMs,
            backlogRemaining: summary.backlogRemaining,
            pipelineVersion: TELEGRAM_TRANSFER_PIPELINE_VERSION,
        });

        return summary;
    } catch (error) {
        logger.error('Failed to transfer telegram messages to pipeline', {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    } finally {
        transferInProgress = false;
        await query('SELECT pg_advisory_unlock($1)', [TRANSFER_ADVISORY_LOCK_KEY]).catch(() => {});
        if (!summary.skipped_run) {
            summary.durationMs = summary.durationMs || Date.now() - started;
            void recordPipelineJobHeartbeat('transfer', summary).catch(() => {});
        }
    }
}
