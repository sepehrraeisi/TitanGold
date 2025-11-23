import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.patch('/', authenticate, async (req, res) => {
  try {
    const { theme, language, currency, notifications, trading_preferences } = req.body;
    const result = await query(
      `UPDATE user_settings SET 
       theme = COALESCE($2, theme),
       language = COALESCE($3, language),
       currency = COALESCE($4, currency),
       notifications = COALESCE($5, notifications),
       trading_preferences = COALESCE($6, trading_preferences),
       updated_at = NOW()
       WHERE user_id = $1 RETURNING *`,
      [req.user.id, theme, language, currency, 
       notifications ? JSON.stringify(notifications) : null,
       trading_preferences ? JSON.stringify(trading_preferences) : null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;