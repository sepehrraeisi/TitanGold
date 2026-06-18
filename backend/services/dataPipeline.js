import { query, transaction } from '../database/db.js';
import { logger } from './logger.js';
import { dataNormalizer } from './normalizers/dataNormalizer.js';
import { dataValidator } from './validators/dataValidator.js';
import { dataRouter } from './routers/dataRouter.js';
import { topicRouter } from './topicRouter.js';
import { filterAllowedAgentsThroughGateway } from '../middleware/accessControlGateway.js';

/**
 * Orchestrates the data processing pipeline:
 * Pending Data -> Normalize -> Validate -> Route -> Queue
 */
export class DataPipeline {
    /**
     * Processes a batch of pending data from collected_data
     * @param {number} batchSize - Number of items to process
     */
    async processPendingData(batchSize = 20) {
        try {
            // 1. Fetch pending raw data
            const result = await query(
                `SELECT cd.*, ds.type as source_type, ds.category as source_category 
         FROM collected_data cd
         JOIN data_sources ds ON cd.source_id = ds.id
         WHERE cd.status = 'pending'
         ORDER BY cd.collected_at ASC
         LIMIT $1`,
                [batchSize]
            );

            if (result.rows.length === 0) return;

            logger.info(`Pipeline processing ${result.rows.length} pending items...`);

            for (const row of result.rows) {
                await this.processItem(row);
            }

        } catch (error) {
            logger.error(`Pipeline batch processing failed: ${error.message}`);
        }
    }

    /**
     * Processes a single data item
     */
    async processItem(row) {
        try {
            // 2. Normalize (canonical v1 contract — worker not scheduled in P0-CONTRACT-1)
            const normalized = dataNormalizer.normalize(row.raw_data, row.source_type, {
                sourceId: row.source_id,
                category: row.source_category,
                collectedAt: row.collected_at,
                ingestionMode: 'fetch',
            });

            // 3. Validate
            const validation = dataValidator.validateContract(normalized);
            if (!validation.valid) {
                await this.updateCollectedStatus(
                    row.id,
                    'error',
                    validation.errors.join('; ') || 'Validation failed',
                );
                return;
            }

            // 4. Update collected_data with normalized format
            await query(
                'UPDATE collected_data SET normalized_data = $1, status = $2 WHERE id = $3',
                [JSON.stringify(normalized), 'processed', row.id]
            );

            // 5. Route to AI agents (existing logic)
            let agentKeys = dataRouter.route(normalized, row.source_category);

            // 5b. Topic-based routing (TASK-BE-013)
            const topicAgents = await topicRouter.route(normalized, row.id);
            agentKeys = [...new Set([...agentKeys, ...topicAgents])]; // Merge and deduplicate

            // 6. Apply Access Control (DH-ACCESSCONTROL-P2)
            agentKeys = await filterAllowedAgentsThroughGateway(row.source_id, agentKeys, normalized);

            // 7. Push to data_queue for each agent
            for (const agentKey of agentKeys) {
                await query(
                    `INSERT INTO data_queue (source_id, data_id, priority, status, max_attempts) 
           VALUES ($1, $2, $3, $4, $5)`,
                    [row.source_id, row.id, 5, 'pending', 3]
                );
            }

            logger.info(`Successfully processed item ${row.id} and queued for ${agentKeys.length} agents`);

        } catch (error) {
            logger.error(`Item processing failed [${row.id}]: ${error.message}`);
            await this.updateCollectedStatus(row.id, 'error', error.message);
        }
    }

    async updateCollectedStatus(id, status, errorMsg = null) {
        await query(
            'UPDATE collected_data SET status = $1, error_message = $2 WHERE id = $3',
            [status, errorMsg, id]
        );
    }
}

export const dataPipeline = new DataPipeline();
