import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { validateBody, validateParams, validateResponse } from '../middleware/validation.js';
import {
  createPortfolioBodySchema,
  getPortfolioParamsSchema,
  portfolioResponseSchema,
  portfolioListResponseSchema
} from '../schemas/portfolioSchemas.js';

const router = express.Router();

router.get('/', authenticate, validateResponse(portfolioListResponseSchema), async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM portfolios WHERE user_id = $1 ORDER BY is_main DESC, created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolios' });
  }
});

router.post('/', authenticate, validateBody(createPortfolioBodySchema), validateResponse(portfolioResponseSchema), async (req, res) => {
  try {
    const { name, description, baseCurrency } = req.validatedBody;
    const result = await query(
      'INSERT INTO portfolios (user_id, name, description, base_currency) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, name, description, baseCurrency || 'USD']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
});

export default router;