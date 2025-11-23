import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

// Get all AI agents
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM ai_agents ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AI agents' });
  }
});

// Get AI agent by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM ai_agents WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AI agent not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AI agent' });
  }
});

// Update AI agent
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status, config, is_enabled } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (config !== undefined) {
      updates.push(`config = $${paramCount++}`);
      values.push(JSON.stringify(config));
    }
    if (is_enabled !== undefined) {
      updates.push(`is_enabled = $${paramCount++}`);
      values.push(is_enabled);
    }

    values.push(req.params.id);

    const result = await query(
      `UPDATE ai_agents SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AI agent not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update AI agent' });
  }
});

export default router;