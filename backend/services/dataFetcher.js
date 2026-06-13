import { query, transaction } from '../database/db.js';
import { logger } from './logger.js';
import { fetchFromApi } from './fetchers/apiFetcher.js';
import { fetchFromRss } from './fetchers/rssFetcher.js';
import { fetchFromTelegram } from './fetchers/telegramFetcher.js';
import { fetchFromWeb } from './fetchers/webCrawlerFetcher.js';
import { processWebhookData } from './fetchers/webhookFetcher.js';
import { decryptSecret, isEncrypted } from '../utils/crypto.js';
import crypto from 'crypto';
import {
    hasTelegramBotToken,
    parseSourceConfig,
    telegramChannelKeys,
} from './telegramCollectorSourceStatus.js';

/**
 * Main service to coordinate data fetching across all sources
 */
export class DataFetcherService {
    /**
     * Helper to generate a consistent hash for data
     * @param {any} data - Data to hash
     * @returns {string} - SHA-256 hash
     */
    generateHash(data) {
        const content = typeof data === 'string' ? data : JSON.stringify(data);
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Orchestrates fetching for a specific source
     * @param {Object} sourceId - The UUID of the source to fetch
     * @returns {Promise<Object>} - Status of the fetch operation
     */
    async fetchSource(sourceId) {
        const startedAt = Date.now();
        let source;
        try {
            // 1. Get source details
            const result = await query('SELECT * FROM data_sources WHERE id = $1', [sourceId]);
            source = result.rows[0];

            if (!source) {
                throw new Error(`Source ${sourceId} not found`);
            }

            // Decrypt credentials if they exist and are encrypted
            this.decryptSourceCredentials(source);

            if (!source.is_active) {
                logger.info(`Source ${source.name} is inactive, skipping fetch`);
                return { success: false, reason: 'inactive' };
            }

            logger.info(`Starting fetch for source: ${source.name} (${source.type})`);

            // Collector-linked Telegram: skip bot-pull (no token) — ingestion is via collector pipeline
            if (source.type === 'telegram') {
                const config = parseSourceConfig(source);
                const { channelId, channelUsername } = telegramChannelKeys(source, config);
                if (!hasTelegramBotToken(source, config) && (channelId || channelUsername)) {
                    const channel = await this.findCollectorChannel(channelId, channelUsername);
                    if (channel?.is_active) {
                        const interval = source.refresh_interval || 60;
                        await query(
                            `UPDATE data_sources
                             SET next_fetch_at = NOW() + (COALESCE($1, 60))::integer * INTERVAL '1 minute'
                             WHERE id = $2`,
                            [interval, source.id],
                        );
                        logger.info(
                            `Skipping bot-pull fetch for collector-linked Telegram source: ${source.name}`,
                        );
                        await this.logFetchSuccess(source.id, {
                            skipped: true,
                            reason: 'collector_ingestion',
                            newItems: 0,
                        }, Date.now() - startedAt);
                        return { success: true, skipped: true, reason: 'collector_ingestion' };
                    }
                }
            }

            // 2. Delegate to specific fetcher based on type
            const rawData = await this.fetchRawData(source);

            // 3. Store in collected_data with deduplication
            const saveResult = await this.saveFetchedData(source.id, rawData);

            // 4. Update source metadata and schedule next fetch
            const interval = source.refresh_interval || 60;
            await query(
                `UPDATE data_sources 
                 SET last_fetch_at = NOW(), 
                     last_status = $1, 
                     next_fetch_at = NOW() + (COALESCE($2, 60))::integer * INTERVAL '1 minute',
                     last_content_hash = $3
                 WHERE id = $4`,
                ['success', interval, saveResult.lastHash, source.id]
            );

            await this.logFetchSuccess(
                source.id,
                { newItems: saveResult.newItems, skipped: false },
                Date.now() - startedAt,
            );
            return { success: true, newItems: saveResult.newItems };

        } catch (error) {
            await this.logError(source?.id || sourceId, error.message, Date.now() - startedAt);

            // Update source status to error and schedule retry (e.g. in 5 mins)
            if (source?.id) {
                await query(
                    'UPDATE data_sources SET last_status = $1, next_fetch_at = NOW() + INTERVAL \'5 minutes\' WHERE id = $2',
                    ['error', source.id]
                );
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Decrypts source credentials in place
     */
    decryptSourceCredentials(source) {
        if (source.credentials && typeof source.credentials === 'string') {
            try {
                const creds = JSON.parse(source.credentials);
                if (creds.encrypted && isEncrypted(creds.encrypted)) {
                    const decrypted = decryptSecret(creds.encrypted);
                    source.credentials = JSON.parse(decrypted);
                }
            } catch (e) {
                logger.warn(`Failed to parse/decrypt credentials for source ${source.id}: ${e.message}`);
            }
        } else if (source.credentials && typeof source.credentials === 'object') {
            // Already an object, check if it contains an 'encrypted' key
            if (source.credentials.encrypted && isEncrypted(source.credentials.encrypted)) {
                try {
                    const decrypted = decryptSecret(source.credentials.encrypted);
                    source.credentials = JSON.parse(decrypted);
                } catch (e) {
                    logger.warn(`Failed to decrypt credentials object for source ${source.id}: ${e.message}`);
                }
            }
        }
    }

    /**
     * Fetches raw data from the configured source type
     */
    async fetchRawData(source) {
        switch (source.type) {
            case 'api':
                return await fetchFromApi(source);
            case 'rss':
                return await fetchFromRss(source);
            case 'telegram':
                return await fetchFromTelegram(source);
            case 'web':
                return await fetchFromWeb(source);
            default:
                throw new Error(`Unsupported source type: ${source.type}`);
        }
    }

    /**
     * Tests a connection info without saving data
     * Enforces a timeout and returns limited sample data
     */
    async testConnection(sourceConfig) {
        try {
            // Create a temporary source object
            const tempSource = { ...sourceConfig };

            // Decrypt credentials if they are provided in encrypted format (simulating DB read)
            // Or if they are passed as raw objects from the API, just use them.
            // In the context of test-connection, usually the raw values (or whatever the UI sends) are used.
            // If the UI sends encrypted values (re-testing an existing source), we might need to decrypt.
            // But typically for a "Test Connection" button, the UI sends the current form state.
            // If it's an existing source being edited, the UI might send encrypted credentials if they haven't changed.

            // For now, let's assume the caller handles decryption if necessary, or we check common patterns
            this.decryptSourceCredentials(tempSource);

            // Enforce 10s timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timed out (10s limit)')), 10000);
            });

            // Race the fetch against the timeout
            const rawData = await Promise.race([
                this.fetchRawData(tempSource),
                timeoutPromise
            ]);

            // Slice data to max 3 items
            const dataArray = Array.isArray(rawData) ? rawData : [rawData];
            const sampleData = dataArray.slice(0, 3);

            return { success: true, message: 'Connection test successful', data: sampleData };

        } catch (error) {
            logger.warn(`Test connection failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    /**
     * Test connection for a persisted source (credentials loaded server-side only).
     */
    async testConnectionById(sourceId) {
        const startedAt = Date.now();
        const result = await query('SELECT * FROM data_sources WHERE id = $1', [sourceId]);
        const row = result.rows[0];
        if (!row) {
            return {
                success: false,
                message: 'Data source not found',
                responseTime: Date.now() - startedAt,
            };
        }

        this.decryptSourceCredentials(row);

        if (row.type === 'telegram') {
            return this.testTelegramConnection(row, startedAt);
        }

        const config =
            typeof row.config === 'string'
                ? (() => {
                      try {
                          return JSON.parse(row.config);
                      } catch {
                          return {};
                      }
                  })()
                : row.config || {};

        const outcome = await this.testConnection({
            id: row.id,
            name: row.name,
            type: row.type,
            url: row.url,
            config,
            credentials: row.credentials,
        });

        return {
            ...outcome,
            responseTime: Date.now() - startedAt,
        };
    }

    /**
     * Telegram sources: bot-token pull when configured; otherwise validate collector link.
     */
    async testTelegramConnection(source, startedAt = Date.now()) {
        const elapsed = () => Date.now() - startedAt;
        let config = source.config;
        if (typeof config === 'string') {
            try {
                config = JSON.parse(config);
            } catch {
                config = {};
            }
        }
        config = config || {};

        const channelId = config.channelId != null ? String(config.channelId) : null;
        const channelUsername = config.channelUsername
            ? String(config.channelUsername).replace(/^@/, '')
            : null;

        if (!channelId && !channelUsername) {
            return {
                success: false,
                message:
                    'Telegram channel ID or username is missing from source configuration. Edit the source or link it from Telegram Collector.',
                responseTime: elapsed(),
            };
        }

        const botToken = source.credentials?.botToken || config.botToken;
        if (botToken && channelId) {
            const outcome = await this.testConnection({
                id: source.id,
                name: source.name,
                type: 'telegram',
                url: source.url,
                config,
                credentials: { botToken },
            });
            return { ...outcome, mode: 'bot', responseTime: elapsed() };
        }

        const channel = await this.findCollectorChannel(channelId, channelUsername);
        if (!channel) {
            return {
                success: false,
                message:
                    'Channel is not registered in Telegram Collector. Link the channel in Telegram Collector, or add a bot token to this source.',
                responseTime: elapsed(),
            };
        }

        if (!channel.is_active) {
            const label = channel.title || channel.username || channelId || channelUsername;
            return {
                success: false,
                message: `Telegram Collector channel "${label}" is inactive.`,
                responseTime: elapsed(),
            };
        }

        const countResult = await query(
            'SELECT COUNT(*)::int AS count FROM collected_data WHERE source_id = $1',
            [source.id],
        );
        const recordCount = Number(countResult.rows[0]?.count || 0);
        const label = channel.title || (channel.username ? `@${channel.username}` : channelId);

        return {
            success: true,
            mode: 'collector',
            message:
                recordCount > 0
                    ? `Collector-linked channel "${label}" is active (${recordCount} record(s) in Data Hub). Ingestion uses Telegram Collector, not per-source bot pull.`
                    : `Collector-linked channel "${label}" is active in Telegram Collector. No stored records yet; messages ingest via the collector.`,
            responseTime: elapsed(),
        };
    }

    /**
     * Resolve telegram_channels row for a data source config.
     */
    async findCollectorChannel(channelId, channelUsername) {
        const params = [channelId, channelUsername];
        const result = await query(
            `SELECT id, channel_id, username, title, is_active
             FROM telegram_channels
             WHERE (
                 ($1::text IS NOT NULL AND channel_id::text = $1)
                 OR (
                     $2::text IS NOT NULL
                     AND LOWER(REPLACE(COALESCE(username, ''), '@', '')) = LOWER($2)
                 )
             )
             ORDER BY is_active DESC, updated_at DESC NULLS LAST
             LIMIT 1`,
            params,
        );
        return result.rows[0] || null;
    }

    /**
     * Saves fetched data to the database with deduplication
     */
    async saveFetchedData(sourceId, data) {
        const dataToStore = Array.isArray(data) ? data : [data];
        let newItems = 0;
        let lastHash = null;

        for (const item of dataToStore) {
            const hash = this.generateHash(item);
            lastHash = hash;

            // Check if this item already exists for this source
            const existing = await query(
                'SELECT 1 FROM collected_data WHERE source_id = $1 AND content_hash = $2 LIMIT 1',
                [sourceId, hash]
            );

            if (existing.rows.length === 0) {
                await query(
                    'INSERT INTO collected_data (source_id, raw_data, content_hash, collected_at, status) VALUES ($1, $2, $3, NOW(), $4)',
                    [sourceId, JSON.stringify(item), hash, 'pending']
                );
                newItems++;
            }
        }

        return { newItems, lastHash };
    }

    /**
     * Logs a successful fetch to data_hub_logs (one row per fetch, not per message).
     */
    async logFetchSuccess(sourceId, { newItems = 0, skipped = false, reason }, executionTimeMs) {
        const { tryInsertDataHubAccessLog } = await import('./dataHubAccessLogWriter.js');
        const message = skipped
            ? `Fetch skipped: ${reason}`
            : `Fetch completed (${newItems} new items)`;
        await tryInsertDataHubAccessLog({
            sourceId,
            action: 'fetch',
            status: 'success',
            message,
            metadata: {
                new_items: newItems,
                skipped,
                reason: reason || null,
                duration_ms: executionTimeMs,
            },
            executionTimeMs,
        });
    }

    /**
     * Logs an error to the data_hub_logs table
     */
    async logError(sourceId, message, executionTimeMs = null) {
        const { tryInsertDataHubAccessLog } = await import('./dataHubAccessLogWriter.js');
        await tryInsertDataHubAccessLog({
            sourceId,
            action: 'fetch_error',
            legacyLevel: 'error',
            message,
            metadata: {
                timestamp: new Date().toISOString(),
                duration_ms: executionTimeMs,
            },
            executionTimeMs,
        });
        logger.error(`DataHub Error [Source ${sourceId}]: ${message}`);
    }

    /**
     * Entry point for webhook data
     */
    async handleWebhook(sourceId, payload) {
        try {
            const result = await query('SELECT * FROM data_sources WHERE id = $1', [sourceId]);
            const source = result.rows[0];

            if (!source) throw new Error(`Source ${sourceId} not found`);

            const processedData = await processWebhookData(source, payload);
            await this.saveFetchedData(source.id, processedData);

            return { success: true };
        } catch (error) {
            await this.logError(sourceId, error.message);
            return { success: false, error: error.message };
        }
    }
}

export const dataFetcherService = new DataFetcherService();
