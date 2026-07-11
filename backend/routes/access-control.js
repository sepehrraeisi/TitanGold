import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { validateBody, validateParams, validateResponse } from '../middleware/validation.js';
import { accessControlSchema, accessControlResponseSchema } from '../schemas/accessControlSchemas.js';
import {
    listRegistryAgents,
    logSourceAccessConfigUpdated,
    validateAgentKeys,
} from '../middleware/accessControlGateway.js';
import { z } from 'zod';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader')];

const sourceIdParamsSchema = z.object({
    sourceId: z.string().uuid()
});

const listItemSchema = z.object({
    source_id: z.string().uuid(),
    source_name: z.string().nullable().optional(),
    source_category: z.string().nullable().optional(),
    source_type: z.string().nullable().optional(),
    id: z.string().uuid().nullable(),
    allowed_agents: z.array(z.string()),
    blocked_agents: z.array(z.string()),
    allowed_data_types: z.array(z.string()),
    blocked_data_types: z.array(z.string()),
    require_auth: z.boolean(),
    max_requests_per_minute: z.number().int(),
    max_requests_per_day: z.number().int(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.string().uuid().nullable().optional(),
    has_custom_rule: z.boolean(),
});

const listResponseSchema = z.object({
    rules: z.array(listItemSchema),
});

const agentsListResponseSchema = z.object({
    agents: z.array(z.object({
        agent_key: z.string(),
        name: z.string(),
        runtime: z.boolean().optional(),
    })),
});

/**
 * GET registry agents for ACL UI (ai_agents + runtime identities)
 */
router.get('/agents/registry', authenticate, validateResponse(agentsListResponseSchema), async (req, res) => {
    try {
        const agents = await listRegistryAgents();
        res.json({ agents });
    } catch (error) {
        logger.error('Error listing ACL registry agents:', error);
        res.status(500).json({ error: 'Failed to list registry agents' });
    }
});

/**
 * GET all sources with optional ACL (for DataHub Access panel)
 */
router.get('/', authenticate, validateResponse(listResponseSchema), async (req, res) => {
    try {
        const result = await query(
            `SELECT
              ds.id AS source_id,
              ds.name AS source_name,
              ds.category AS source_category,
              ds.type AS source_type,
              sac.id,
              sac.allowed_agents,
              sac.blocked_agents,
              sac.allowed_data_types,
              sac.blocked_data_types,
              sac.require_auth,
              sac.max_requests_per_minute,
              sac.max_requests_per_day,
              sac.created_at,
              sac.updated_at,
              sac.updated_by
            FROM data_sources ds
            LEFT JOIN source_access_controls sac ON sac.source_id = ds.id
            WHERE ds.is_active = true
            ORDER BY ds.name ASC`,
        );

        const rules = result.rows.map(row => ({
            source_id: row.source_id,
            source_name: row.source_name,
            source_category: row.source_category,
            source_type: row.source_type,
            id: row.id,
            allowed_agents: row.allowed_agents || [],
            blocked_agents: row.blocked_agents || [],
            allowed_data_types: row.allowed_data_types || [],
            blocked_data_types: row.blocked_data_types || [],
            require_auth: row.require_auth ?? false,
            max_requests_per_minute: row.max_requests_per_minute ?? 0,
            max_requests_per_day: row.max_requests_per_day ?? 0,
            created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
            updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
            updated_by: row.updated_by,
            has_custom_rule: Boolean(row.id),
        }));

        res.json({ rules });
    } catch (error) {
        logger.error('Error listing ACL:', error);
        res.status(500).json({ error: 'Failed to list access control rules' });
    }
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
router.post('/:sourceId', ...writeAuth, validateParams(sourceIdParamsSchema), validateBody(accessControlSchema), validateResponse(accessControlResponseSchema), async (req, res) => {
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

        const agentValidation = await validateAgentKeys([
            ...allowed_agents,
            ...blocked_agents,
        ]);
        if (!agentValidation.valid) {
            return res.status(400).json({
                error: 'Invalid agent keys',
                invalid_keys: agentValidation.invalid,
            });
        }

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

        await logSourceAccessConfigUpdated({
            sourceId,
            userId: req.user.id,
            allowedAgents: allowed_agents,
            blockedAgents: blocked_agents,
            action: 'upsert',
        });

        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating ACL:', error);
        res.status(500).json({ error: 'Failed to update access control rules' });
    }
});

/**
 * RESET/DELETE ACL for a source
 */
router.delete('/:sourceId', ...writeAuth, validateParams(sourceIdParamsSchema), async (req, res) => {
    try {
        const { sourceId } = req.validatedParams;

        const result = await query(
            'DELETE FROM source_access_controls WHERE source_id = $1 RETURNING source_id',
            [sourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Access control rules not found for this source' });
        }

        await logSourceAccessConfigUpdated({
            sourceId,
            userId: req.user.id,
            allowedAgents: [],
            blockedAgents: [],
            action: 'delete',
        });

        res.json({ message: 'Access control rules reset successfully', source_id: sourceId });
    } catch (error) {
        logger.error('Error resetting ACL:', error);
        res.status(500).json({ error: 'Failed to reset access control rules' });
    }
});

export default router;
