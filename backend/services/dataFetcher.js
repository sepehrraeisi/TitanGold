import { query, transaction } from '../database/db.js';
import { logger } from './logger.js';
import { fetchFromApi } from './fetchers/apiFetcher.js';
import { fetchFromRss } from './fetchers/rssFetcher.js';
import { fetchFromTelegram } from './fetchers/telegramFetcher.js';
import { fetchFromWeb } from './fetchers/webCrawlerFetcher.js';
import { processWebhookData } from './fetchers/webhookFetcher.js';
import { decryptSecret, isEncrypted } from '../utils/crypto.js';
import crypto from 'crypto';

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

            return { success: true, newItems: saveResult.newItems };

        } catch (error) {
            await this.logError(source?.id || sourceId, error.message);

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

            return { success: true, data: sampleData };

        } catch (error) {
            logger.warn(`Test connection failed: ${error.message}`);
            return { success: false, error: error.message };
        }
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
     * Logs an error to the data_hub_logs table
     */
    async logError(sourceId, message) {
        try {
            await query(
                'INSERT INTO data_hub_logs (source_id, level, message, metadata) VALUES ($1, $2, $3, $4)',
                [sourceId, 'error', message, JSON.stringify({ timestamp: new Date().toISOString() })]
            );
            logger.error(`DataHub Error [Source ${sourceId}]: ${message}`);
        } catch (logError) {
            logger.error(`Failed to log DataHub error to DB: ${logError.message}`);
        }
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
