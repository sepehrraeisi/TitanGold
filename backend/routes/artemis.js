import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

router.get('/state', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM artemis_state ORDER BY created_at DESC LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Artemis state' });
  }
});

router.patch('/state', authenticate, async (req, res) => {
  try {
    const { status, mode, strategy, config } = req.body;
    const result = await query(
      'UPDATE artemis_state SET status = COALESCE($1, status), mode = COALESCE($2, mode), strategy = COALESCE($3, strategy), config = COALESCE($4, config), updated_at = NOW() RETURNING *',
      [status, mode, strategy, config ? JSON.stringify(config) : null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update Artemis state' });
  }
});

router.get('/scenarios', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM trading_scenarios ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
});

export default router;