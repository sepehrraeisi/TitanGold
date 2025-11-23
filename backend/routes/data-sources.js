import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM data_sources ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data sources' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, type, url, category, config } = req.body;
    const result = await query(
      'INSERT INTO data_sources (name, type, url, category, config) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, type, url, category, JSON.stringify(config || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create data source' });
  }
});

export default router;