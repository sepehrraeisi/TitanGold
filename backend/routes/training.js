import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

router.get('/sessions', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM ai_training_sessions ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch training sessions' });
  }
});

router.post('/sessions', authenticate, async (req, res) => {
  try {
    const { agent_id, session_name, mode, config } = req.body;
    const result = await query(
      'INSERT INTO ai_training_sessions (agent_id, session_name, mode, config) VALUES ($1, $2, $3, $4) RETURNING *',
      [agent_id, session_name, mode, JSON.stringify(config)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create training session' });
  }
});

export default router;