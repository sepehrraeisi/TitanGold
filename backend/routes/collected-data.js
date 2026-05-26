import express from 'express';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { authenticate } from '../middleware/auth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateParams, validateQuery, validateResponse } from '../middleware/validation.js';
import {
    createCollectedDataSchema,
    batchCreateCollectedDataSchema,
    updateCollectedDataSchema,
    collectedDataFilterSchema,
    collectedDataResponseSchema,
    collectedDataListResponseSchema,
    uuidParamSchema
} from '../schemas/dataHubSchemas.js';
import * as deduplicationService from '../services/deduplicationService.js';
import { enforceIngestionFilter } from '../services/datahubFilterRulesService.js';

const router = express.Router();

// Debug log to verify route is loaded
console.log('📦 Collected Data routes module loaded');

// List all registered routes for debugging
router.stack.forEach((r) => {
    if (r.route) {
        console.log(`  Route: ${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`);
    }
});

/**
 * GET /api/v1/collected-data
 * Get collected data with filters
 */
router.get('/', authenticate, readRateLimiter, validateQuery(collectedDataFilterSchema), async (req, res) => {
    try {
        const {
            source_id,
            status,
            from_date,
            to_date,
            has_normalized,
            language,
            sentiment,
            has_url,
            has_hashtag,
            limit = 50,
            offset = 0
        } = req.query;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (source_id) {
            whereConditions.push(`source_id = $${paramIndex++}`);
            params.push(source_id);
        }

        if (status) {
            whereConditions.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        if (from_date) {
            whereConditions.push(`collected_at >= $${paramIndex++}`);
            params.push(from_date);
        }

        if (to_date) {
            whereConditions.push(`collected_at <= $${paramIndex++}`);
            params.push(to_date);
        }

        if (has_normalized !== undefined) {
            whereConditions.push(has_normalized ? `normalized_data IS NOT NULL` : `normalized_data IS NULL`);
        }

        if (language) {
            whereConditions.push(`normalized_data->'metadata'->>'language' = $${paramIndex++}`);
            params.push(language);
        }

        if (sentiment) {
            whereConditions.push(`normalized_data->'metadata'->>'sentiment' = $${paramIndex++}`);
            params.push(sentiment);
        }

        if (has_url !== undefined) {
            whereConditions.push(`normalized_data->'metadata'->>'has_url' = $${paramIndex++}`);
            params.push(has_url.toString());
        }

        if (has_hashtag !== undefined) {
            whereConditions.push(`normalized_data->'metadata'->>'has_hashtag' = $${paramIndex++}`);
            params.push(has_hashtag.toString());
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) FROM collected_data ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get data with pagination
        const dataResult = await query(
            `SELECT 
                cd.*,
                ds.name as source_name,
                ds.type as source_type
            FROM collected_data cd
            LEFT JOIN data_sources ds ON cd.source_id = ds.id
            ${whereClause}
            ORDER BY cd.collected_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            [...params, limit, offset]
        );

        res.json({
            data: dataResult.rows,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            }
        });

    } catch (error) {
        logger.error('Error fetching collected data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch collected data',
            message: error.message 
        });
    }
});

/**
 * POST /api/v1/collected-data
 * Create single collected data entry
 */
router.post('/', authenticate, writeRateLimiter, validateBody(createCollectedDataSchema), async (req, res) => {
    try {
        const {
            source_id,
            raw_data,
            normalized_data,
            content_hash,
            status = 'pending',
            error_message,
            metadata
        } = req.body;

        const meta = metadata && typeof metadata === 'object' ? metadata : {};
        const norm = normalized_data && typeof normalized_data === 'object' ? normalized_data : {};
        await enforceIngestionFilter({
            source_id,
            url: meta.url || meta.source_url || norm.metadata?.url,
            text:
                norm.content ||
                norm.text ||
                raw_data?.text ||
                raw_data?.message ||
                meta.title,
            metadata: meta,
        });

        // Check for duplicate if content_hash provided
        if (content_hash) {
            const duplicateCheck = await query(
                'SELECT id FROM collected_data WHERE content_hash = $1 LIMIT 1',
                [content_hash]
            );

            if (duplicateCheck.rows.length > 0) {
                return res.status(409).json({
                    error: 'Duplicate content',
                    message: 'A message with this content hash already exists',
                    existing_id: duplicateCheck.rows[0].id
                });
            }
        }

        // Insert collected data
        const result = await query(
            `INSERT INTO collected_data 
            (source_id, raw_data, normalized_data, content_hash, status, error_message, metadata, collected_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *`,
            [
                source_id,
                JSON.stringify(raw_data),
                normalized_data ? JSON.stringify(normalized_data) : null,
                content_hash,
                status,
                error_message,
                metadata ? JSON.stringify(metadata) : null
            ]
        );

        logger.info(`Collected data created: ${result.rows[0].id} from source ${source_id}`);

        res.status(201).json(result.rows[0]);

    } catch (error) {
        if (error.status === 403 && error.code === 'FILTER_BLOCKED') {
            return res.status(403).json({
                error: error.message,
                code: error.code,
                details: error.details,
            });
        }
        logger.error('Error creating collected data:', error);
        res.status(error.status || 500).json({
            error: 'Failed to create collected data',
            message: error.message,
        });
    }
});

/**
 * POST /api/v1/collected-data/batch
 * Create multiple collected data entries at once
 */
router.post('/batch', authenticate, writeRateLimiter, validateBody(batchCreateCollectedDataSchema), async (req, res) => {
    try {
        const { source_id, messages } = req.body;

        const results = {
            inserted: 0,
            duplicates: 0,
            blocked: 0,
            errors: 0,
            ids: []
        };

        for (const message of messages) {
            try {
                const meta =
                    message.metadata && typeof message.metadata === 'object'
                        ? message.metadata
                        : {};
                const norm =
                    message.normalized_data && typeof message.normalized_data === 'object'
                        ? message.normalized_data
                        : {};
                try {
                    await enforceIngestionFilter({
                        source_id,
                        url: meta.url || meta.source_url || norm.metadata?.url,
                        text:
                            norm.content ||
                            norm.text ||
                            message.raw_data?.text ||
                            message.raw_data?.message ||
                            meta.title,
                        metadata: meta,
                    });
                } catch (filterErr) {
                    if (filterErr.code === 'FILTER_BLOCKED') {
                        results.blocked++;
                        continue;
                    }
                    throw filterErr;
                }

                // Check for duplicate if content_hash provided
                if (message.content_hash) {
                    const duplicateCheck = await query(
                        'SELECT id FROM collected_data WHERE content_hash = $1 LIMIT 1',
                        [message.content_hash]
                    );

                    if (duplicateCheck.rows.length > 0) {
                        results.duplicates++;
                        continue;
                    }
                }

                // Insert message
                const result = await query(
                    `INSERT INTO collected_data 
                    (source_id, raw_data, normalized_data, content_hash, status, error_message, metadata, collected_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                    RETURNING id`,
                    [
                        source_id,
                        JSON.stringify(message.raw_data),
                        message.normalized_data ? JSON.stringify(message.normalized_data) : null,
                        message.content_hash,
                        message.status || 'pending',
                        message.error_message,
                        message.metadata ? JSON.stringify(message.metadata) : null
                    ]
                );

                results.inserted++;
                results.ids.push(result.rows[0].id);

            } catch (error) {
                logger.error('Error inserting batch message:', error);
                results.errors++;
            }
        }

        logger.info(`Batch insert completed: ${results.inserted} inserted, ${results.duplicates} duplicates, ${results.errors} errors`);

        res.status(201).json(results);

    } catch (error) {
        logger.error('Error batch creating collected data:', error);
        res.status(500).json({ 
            error: 'Failed to batch create collected data',
            message: error.message 
        });
    }
});

/**
 * PUT /api/v1/collected-data/:id
 * Update collected data entry
 */
router.put('/:id', authenticate, writeRateLimiter, validateParams(uuidParamSchema), validateBody(updateCollectedDataSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const setClauses = [];
        const params = [];
        let paramIndex = 1;

        if (updates.normalized_data !== undefined) {
            setClauses.push(`normalized_data = $${paramIndex++}`);
            params.push(updates.normalized_data ? JSON.stringify(updates.normalized_data) : null);
        }

        if (updates.status) {
            setClauses.push(`status = $${paramIndex++}`);
            params.push(updates.status);
        }

        if (updates.processed_at !== undefined) {
            setClauses.push(`processed_at = $${paramIndex++}`);
            params.push(updates.processed_at);
        }

        if (updates.error_message !== undefined) {
            setClauses.push(`error_message = $${paramIndex++}`);
            params.push(updates.error_message);
        }

        if (updates.metadata !== undefined) {
            setClauses.push(`metadata = $${paramIndex++}`);
            params.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(id);

        const result = await query(
            `UPDATE collected_data 
            SET ${setClauses.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Collected data not found' });
        }

        logger.info(`Collected data updated: ${id}`);

        res.json(result.rows[0]);

    } catch (error) {
        logger.error('Error updating collected data:', error);
        res.status(500).json({ 
            error: 'Failed to update collected data',
            message: error.message 
        });
    }
});

/**
 * DELETE /api/v1/collected-data/:id
 * Delete collected data entry
 */
/**
 * GET /api/v1/collected-data/deduplication/stats
 * Get duplicate statistics
 */
router.get('/deduplication/stats', authenticate, readRateLimiter, async (req, res) => {
    try {
        const { source_id } = req.query;

        const stats = await deduplicationService.getDuplicateStats(source_id || null);
        const patterns = await deduplicationService.analyzeDuplicatePatterns(source_id || null);

        res.json({
            statistics: stats,
            patterns,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Error getting deduplication stats:', error);
        res.status(500).json({ 
            error: 'Failed to get deduplication stats',
            message: error.message 
        });
    }
});

/**
 * GET /api/v1/collected-data/deduplication/find
 * Find duplicate messages
 */
router.get('/deduplication/find', authenticate, readRateLimiter, async (req, res) => {
    try {
        const { source_id, limit = 100, include_content = 'false' } = req.query;

        const duplicates = await deduplicationService.findDuplicates({
            sourceId: source_id || null,
            limit: parseInt(limit),
            includeContent: include_content === 'true'
        });

        res.json({
            duplicates,
            count: duplicates.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Error finding duplicates:', error);
        res.status(500).json({ 
            error: 'Failed to find duplicates',
            message: error.message 
        });
    }
});

/**
 * POST /api/v1/collected-data/deduplication/remove
 * Remove duplicate messages
 */
router.post('/deduplication/remove', authenticate, writeRateLimiter, async (req, res) => {
    try {
        const { source_id, dry_run = true, keep_strategy = 'oldest' } = req.body;

        if (!dry_run && req.body.confirm !== 'DELETE_DUPLICATES') {
            return res.status(400).json({
                error: 'Confirmation required',
                message: 'For actual deletion, set confirm="DELETE_DUPLICATES" in request body'
            });
        }

        const results = await deduplicationService.removeDuplicates({
            sourceId: source_id || null,
            dryRun: dry_run,
            keepStrategy: keep_strategy
        });

        if (dry_run) {
            logger.info(`Dry run: would delete ${results.totalRecordsToDelete} duplicates`);
        } else {
            logger.info(`Deleted ${results.totalRecordsToDelete} duplicates`);
        }

        res.json(results);

    } catch (error) {
        logger.error('Error removing duplicates:', error);
        res.status(500).json({ 
            error: 'Failed to remove duplicates',
            message: error.message 
        });
    }
});

/**
 * POST /api/v1/collected-data/deduplication/merge/:contentHash
 * Merge duplicate messages by content hash
 */
router.post('/deduplication/merge/:contentHash', authenticate, writeRateLimiter, async (req, res) => {
    try {
        const { contentHash } = req.params;

        const result = await deduplicationService.mergeDuplicates(contentHash);

        if (result.merged) {
            logger.info(`Merged ${result.totalMerged} duplicates for hash ${contentHash}`);
        }

        res.json(result);

    } catch (error) {
        logger.error('Error merging duplicates:', error);
        res.status(500).json({ 
            error: 'Failed to merge duplicates',
            message: error.message 
        });
    }
});

router.delete('/:id', authenticate, writeRateLimiter, validateParams(uuidParamSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { hard } = req.query;

        if (hard === 'true') {
            // Hard delete
            const result = await query(
                'DELETE FROM collected_data WHERE id = $1 RETURNING id',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Collected data not found' });
            }

            logger.info(`Collected data hard deleted: ${id}`);
        } else {
            // Soft delete (mark as error)
            const result = await query(
                `UPDATE collected_data 
                SET status = 'error', error_message = 'Deleted by user', processed_at = NOW()
                WHERE id = $1
                RETURNING id`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Collected data not found' });
            }

            logger.info(`Collected data soft deleted: ${id}`);
        }

        res.json({ success: true, id });

    } catch (error) {
        logger.error('Error deleting collected data:', error);
        res.status(500).json({ 
            error: 'Failed to delete collected data',
            message: error.message 
        });
    }
});

/**
 * GET /api/v1/collected-data/:id
 * Get single collected data entry
 */
router.get('/:id', authenticate, readRateLimiter, validateParams(uuidParamSchema), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT 
                cd.*,
                ds.name as source_name,
                ds.type as source_type
            FROM collected_data cd
            LEFT JOIN data_sources ds ON cd.source_id = ds.id
            WHERE cd.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Collected data not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        logger.error('Error fetching collected data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch collected data',
            message: error.message 
        });
    }
});



// Debug: Log all registered routes
console.log("📋 Registered routes in collected-data:");
router.stack.forEach((r) => {
    if (r.route) {
        console.log(`  ${Object.keys(r.route.methods).join(",").toUpperCase()} ${r.route.path}`);
    }
});
export default router;
