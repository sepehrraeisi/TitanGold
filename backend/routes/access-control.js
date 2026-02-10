import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { validateBody, validateParams, validateResponse } from '../middleware/validation.js';
import { accessControlSchema, accessControlResponseSchema } from '../schemas/accessControlSchemas.js';
import { z } from 'zod';

const router = express.Router();

const sourceIdParamsSchema = z.object({
    sourceId: z.string().uuid()
});

/**
 * GET ACL for a source
 */
router.get('/:sourceId', authenticate, validateParams(sourceIdParamsSchema), validateResponse(accessControlResponseSchema), async (req, res) => {
    try {
        const { sourceId } = req.validatedParams;

        const result = await query(
            'SELECT * FROM source_access_controls WHERE source_id = $1',
            [sourceId]
        );

        if (result.rows.length === 0) {
            // Return default/empty ACL if none exists
            return res.json({
                id: '00000000-0000-0000-0000-000000000000', // Dummy ID
                source_id: sourceId,
                allowed_agents: [],
                blocked_agents: [],
                allowed_data_types: [],
                blocked_data_types: [],
                require_auth: false,
                max_requests_per_minute: 0,
                max_requests_per_day: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                updated_by: null
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error fetching ACL:', error);
        res.status(500).json({ error: 'Failed to fetch access control rules' });
    }
});

/**
 * SET/UPDATE ACL for a source
 */
router.post('/:sourceId', authenticate, validateParams(sourceIdParamsSchema), validateBody(accessControlSchema), validateResponse(accessControlResponseSchema), async (req, res) => {
    try {
        const { sourceId } = req.validatedParams;
        const {
            allowed_agents,
            blocked_agents,
            allowed_data_types,
            blocked_data_types,
            require_auth,
            max_requests_per_minute,
            max_requests_per_day
        } = req.validatedBody;

        const result = await query(
            `INSERT INTO source_access_controls 
             (source_id, allowed_agents, blocked_agents, allowed_data_types, blocked_data_types, require_auth, max_requests_per_minute, max_requests_per_day, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (source_id) DO UPDATE SET
                allowed_agents = EXCLUDED.allowed_agents,
                blocked_agents = EXCLUDED.blocked_agents,
                allowed_data_types = EXCLUDED.allowed_data_types,
                blocked_data_types = EXCLUDED.blocked_data_types,
                require_auth = EXCLUDED.require_auth,
                max_requests_per_minute = EXCLUDED.max_requests_per_minute,
                max_requests_per_day = EXCLUDED.max_requests_per_day,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
             RETURNING *`,
            [
                sourceId,
                allowed_agents,
                blocked_agents,
                allowed_data_types,
                blocked_data_types,
                require_auth,
                max_requests_per_minute,
                max_requests_per_day,
                req.user.id
            ]
        );

        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating ACL:', error);
        res.status(500).json({ error: 'Failed to update access control rules' });
    }
});

/**
 * RESET/DELETE ACL for a source
 */
router.delete('/:sourceId', authenticate, validateParams(sourceIdParamsSchema), async (req, res) => {
    try {
        const { sourceId } = req.validatedParams;

        const result = await query(
            'DELETE FROM source_access_controls WHERE source_id = $1 RETURNING source_id',
            [sourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Access control rules not found for this source' });
        }

        res.json({ message: 'Access control rules reset successfully', source_id: sourceId });
    } catch (error) {
        logger.error('Error resetting ACL:', error);
        res.status(500).json({ error: 'Failed to reset access control rules' });
    }
});

export default router;
