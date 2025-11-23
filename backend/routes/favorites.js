import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { symbol, name, type } = req.body;
    const result = await query(
      'INSERT INTO favorites (user_id, symbol, name, type) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, symbol) DO NOTHING RETURNING *',
      [req.user.id, symbol, name, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

export default router;