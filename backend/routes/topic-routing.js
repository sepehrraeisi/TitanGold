import express from 'express';
import { query } from '../database/db.js';
import { authenticate, authenticateStrict } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAP } from '../services/capabilities.js';
import { writeRateLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../services/logger.js';
import { topicRouter } from '../services/topicRouter.js';

const router = express.Router();

// ============================================================================
// GET ALL ROUTING RULES
// ============================================================================

router.get('/', authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_READ), async (req, res) => {
    try {
        const result = await query(
            `SELECT id, name, keywords, agent_key, priority, is_active, created_at, updated_at
             FROM topic_routing_rules
             ORDER BY priority DESC, created_at DESC`,
            []
        );

        res.json({ rules: result.rows });
    } catch (error) {
        logger.error('Failed to fetch topic routing rules:', error);
        res.status(500).json({ error: 'Failed to fetch routing rules' });
    }
});

// ============================================================================
// CREATE ROUTING RULE
// ============================================================================

router.post('/', authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_WRITE), writeRateLimiter, async (req, res) => {
    try {
        const { name, keywords, agent_key, priority = 0, is_active = true } = req.body;

        // Validation
        if (!name || !keywords || !agent_key) {
            return res.status(400).json({
                error: 'Missing required fields: name, keywords, agent_key'
            });
        }

        if (!Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({
                error: 'keywords must be a non-empty array'
            });
        }

        const result = await query(
            `INSERT INTO topic_routing_rules (name, keywords, agent_key, priority, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, keywords, agent_key, priority, is_active]
        );

        // Refresh the topic router cache
        await topicRouter.refreshRules();

        res.status(201).json({ rule: result.rows[0] });
    } catch (error) {
        logger.error('Failed to create topic routing rule:', error);
        res.status(500).json({ error: 'Failed to create routing rule' });
    }
});

// ============================================================================
// UPDATE ROUTING RULE
// ============================================================================

router.put('/:id', authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_WRITE), writeRateLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, keywords, agent_key, priority, is_active } = req.body;

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (keywords !== undefined) {
            if (!Array.isArray(keywords)) {
                return res.status(400).json({ error: 'keywords must be an array' });
            }
            updates.push(`keywords = $${paramCount++}`);
            values.push(keywords);
        }
        if (agent_key !== undefined) {
            updates.push(`agent_key = $${paramCount++}`);
            values.push(agent_key);
        }
        if (priority !== undefined) {
            updates.push(`priority = $${paramCount++}`);
            values.push(priority);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);
        const result = await query(
            `UPDATE topic_routing_rules 
             SET ${updates.join(', ')}
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Routing rule not found' });
        }

        // Refresh the topic router cache
        await topicRouter.refreshRules();

        res.json({ rule: result.rows[0] });
    } catch (error) {
        logger.error('Failed to update topic routing rule:', error);
        res.status(500).json({ error: 'Failed to update routing rule' });
    }
});

// ============================================================================
// DELETE ROUTING RULE
// ============================================================================

router.delete('/:id', authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_WRITE), writeRateLimiter, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'DELETE FROM topic_routing_rules WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Routing rule not found' });
        }

        // Refresh the topic router cache
        await topicRouter.refreshRules();

        res.json({ message: 'Routing rule deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete topic routing rule:', error);
        res.status(500).json({ error: 'Failed to delete routing rule' });
    }
});

// ============================================================================
// GET ROUTING LOGS
// ============================================================================

router.get('/logs', authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_READ), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const result = await query(
            `SELECT 
                trl.id,
                trl.data_id,
                trl.rule_id,
                trl.matched_keywords,
                trl.agent_key,
                trl.created_at,
                trr.name as rule_name,
                cd.raw_data
             FROM topic_routing_logs trl
             LEFT JOIN topic_routing_rules trr ON trl.rule_id = trr.id
             LEFT JOIN collected_data cd ON trl.data_id = cd.id
             ORDER BY trl.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        // Get total count
        const countResult = await query(
            'SELECT COUNT(*) as total FROM topic_routing_logs',
            []
        );

        res.json({
            logs: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        });
    } catch (error) {
        logger.error('Failed to fetch topic routing logs:', error);
        res.status(500).json({ error: 'Failed to fetch routing logs' });
    }
});

export default router;
