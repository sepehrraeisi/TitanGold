import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { dataFetcherService } from '../services/dataFetcher.js';

/**
 * Data Fetching Job
 * Periodically fetches data from all active sources
 */
export async function runDataFetchJob() {
    try {
        logger.info('📊 Starting Data Fetch Job...');

        // 1. Get all active data sources due for fetching, ordered by priority
        const result = await query(
            `SELECT id, name, type, priority 
             FROM data_sources 
             WHERE is_active = true 
             AND (next_fetch_at IS NULL OR next_fetch_at <= NOW()) 
             ORDER BY priority DESC`
        );

        const sources = result.rows;
        logger.info(`Found ${sources.length} active data sources to fetch.`);

        for (const source of sources) {
            try {
                logger.info(`Processing source: ${source.name} (Priority: ${source.priority})`);

                // 2. Perform the fetch
                const outcome = await dataFetcherService.fetchSource(source.id);

                if (outcome.skipped) {
                    logger.info(
                        `⏭️ Skipped bot-pull for ${source.name} (${outcome.reason || 'skipped'})`,
                    );
                } else if (outcome.success) {
                    // 3. Update success metrics
                    await query(
                        'UPDATE data_sources SET fetch_count = COALESCE(fetch_count, 0) + 1, last_fetch_at = NOW(), status = $1 WHERE id = $2',
                        ['active', source.id]
                    );
                    logger.info(`✅ Successfully fetched from ${source.name}`);
                } else {
                    // 4. Update error metrics
                    await query(
                        'UPDATE data_sources SET error_count = COALESCE(error_count, 0) + 1, status = $1 WHERE id = $2',
                        ['error', source.id]
                    );
                    logger.error(`❌ Failed to fetch from ${source.name}: ${outcome.error}`);
                }

                // Small cooling delay between sources to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (sourceError) {
                logger.error(`Unhandled error for source ${source.name}: ${sourceError.message}`);
            }
        }

        logger.info('✅ Data Fetch Job cycle completed.');

    } catch (error) {
        logger.error('❌ Critical error in Data Fetch Job:', error);
    }
}
