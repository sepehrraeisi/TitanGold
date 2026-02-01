import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { portfolio_id, symbol, side, type, amount, price, exchange } = req.body;
    const result = await query(
      `INSERT INTO trades (user_id, portfolio_id, symbol, side, type, amount, price, exchange, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
      [req.user.id, portfolio_id, symbol, side, type, amount, price, exchange]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

export default router;