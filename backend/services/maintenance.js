import { query } from '../database/db.js';
import { logger } from './logger.js';

/**
 * Service to handle periodic database maintenance tasks,
 * such as log pruning and archival.
 */
class MaintenanceService {
    /**
     * Executes the log retention maintenance in the database.
     * This calls the stored procedure that prunes logs based on policies.
     */
    async runLogRetention() {
        try {
            logger.info('Starting daily log retention maintenance...');

            const result = await query('SELECT run_log_retention_maintenance() as summary');
            const summary = result.rows[0].summary;

            logger.info('Log retention maintenance completed successfully', {
                timestamp: summary.timestamp,
                status: summary.status,
                pruning_count: summary.pruning.length,
                details: summary.pruning
            });

            return summary;
        } catch (error) {
            logger.error('Failed to run log retention maintenance:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Purges data sources that have been soft-deleted for more than 30 days.
     * TASK-BE-018
     */
    async purgeOldDataSources() {
        try {
            logger.info('Starting purge of old soft-deleted data sources (>30 days)...');

            const result = await query(`
                DELETE FROM data_sources 
                WHERE is_active = false 
                AND updated_at < NOW() - INTERVAL '30 days'
                RETURNING id, name
            `);

            if (result.rows.length > 0) {
                logger.info(`Permanently purged ${result.rows.length} old data sources`, {
                    purged_sources: result.rows.map(r => ({ id: r.id, name: r.name }))
                });
            } else {
                logger.info('No old soft-deleted data sources found to purge.');
            }

            return result.rows.length;
        } catch (error) {
            logger.error('Failed to purge old data sources:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Integrated maintenance that can be expanded to include other tasks
     * like WAL cleanup, vacuuming, or dedicated archival.
     */
    async runFullSiteMaintenance() {
        logger.info('🚀 Starting Full Site Maintenance...');

        try {
            // 1. Run Log Retention
            await this.runLogRetention();

            // 2. Purge old soft-deleted data sources (TASK-BE-018)
            await this.purgeOldDataSources();

            // 2. Check for AI Decisions archival (if applicable)
            // Note: The existing archive_old_decisions(90) can be called here if needed
            try {
                logger.info('Checking for AI decisions archival...');
                const archiveResult = await query('SELECT * FROM archive_old_decisions(90)');
                if (archiveResult.rows.length > 0) {
                    const stats = archiveResult.rows[0];
                    logger.info(`Archived ${stats.records_archived} AI decisions`, { stats });
                }
            } catch (archiveError) {
                // If the function doesn't exist or fails, log but don't stop the whole maintenance
                logger.warn('AI decisions archival skipped or failed:', archiveError.message);
            }

            logger.info('✅ Full Site Maintenance completed.');
        } catch (error) {
            logger.error('❌ Full Site Maintenance failed!', { error: error.message });
        }
    }
}

export const maintenanceService = new MaintenanceService();
