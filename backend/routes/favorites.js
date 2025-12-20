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

// DELETE route for removing favorites
router.delete('/:symbol', authenticate, async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await query(
      'DELETE FROM favorites WHERE user_id = $1 AND symbol = $2 RETURNING *',
      [req.user.id, symbol]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({ success: true, message: 'Favorite removed', deleted: result.rows[0] });
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Price Alert Routes
router.post('/:symbol/alert', authenticate, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { targetPrice, condition } = req.body; // condition: 'above' | 'below'
    
    // Check if favorite exists
    const favoriteCheck = await query(
      'SELECT id FROM favorites WHERE user_id = $1 AND symbol = $2',
      [req.user.id, symbol]
    );
    
    if (favoriteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    // Create or update alert (using favorite_alerts table if exists, otherwise create it)
    let result;
    try {
      result = await query(
        `INSERT INTO favorite_alerts (user_id, symbol, target_price, condition, active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (user_id, symbol) 
         DO UPDATE SET target_price = $3, condition = $4, active = true, updated_at = NOW()
         RETURNING *`,
        [req.user.id, symbol, targetPrice, condition]
      );
    } catch (schemaError) {
      // If table doesn't exist, create it first
      if (schemaError.message?.includes('does not exist') || schemaError.code === '42P01') {
        await query(`
          CREATE TABLE IF NOT EXISTS favorite_alerts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            symbol VARCHAR(20) NOT NULL,
            target_price DECIMAL(20, 8) NOT NULL,
            condition VARCHAR(10) NOT NULL CHECK (condition IN ('above', 'below')),
            active BOOLEAN NOT NULL DEFAULT true,
            triggered BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, symbol)
          );
          CREATE INDEX IF NOT EXISTS idx_favorite_alerts_user_id ON favorite_alerts(user_id);
          CREATE INDEX IF NOT EXISTS idx_favorite_alerts_active ON favorite_alerts(active);
        `);
        
        // Retry insert
        result = await query(
          `INSERT INTO favorite_alerts (user_id, symbol, target_price, condition, active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (user_id, symbol) 
           DO UPDATE SET target_price = $3, condition = $4, active = true, updated_at = NOW()
           RETURNING *`,
          [req.user.id, symbol, targetPrice, condition]
        );
      } else {
        throw schemaError;
      }
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create alert:', error);
    res.status(500).json({ error: 'Failed to create alert', message: error.message });
  }
});

// Get alerts for a favorite
router.get('/:symbol/alert', authenticate, async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await query(
      'SELECT * FROM favorite_alerts WHERE user_id = $1 AND symbol = $2',
      [req.user.id, symbol]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    // If table doesn't exist, return null
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return res.json(null);
    }
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

// Delete alert
router.delete('/:symbol/alert', authenticate, async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await query(
      'UPDATE favorite_alerts SET active = false WHERE user_id = $1 AND symbol = $2 RETURNING *',
      [req.user.id, symbol]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json({ success: true, message: 'Alert removed' });
  } catch (error) {
    // If table doesn't exist, return success anyway
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return res.json({ success: true, message: 'Alert removed' });
    }
    res.status(500).json({ error: 'Failed to remove alert' });
  }
});

export default router;