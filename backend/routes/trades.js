import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { validateBody, validateQuery, validateResponse } from '../middleware/validation.js';
import {
  listTradesQuerySchema,
  createTradeBodySchema,
  tradeResponseSchema,
  tradeListResponseSchema
} from '../schemas/tradeSchemas.js';

const router = express.Router();

router.get('/', authenticate, validateQuery(listTradesQuerySchema), validateResponse(tradeListResponseSchema), async (req, res) => {
  try {
    const { portfolioId, symbol, status, type, startDate, endDate, limit, offset } = req.validatedQuery;

    // Build dynamic query
    let queryStr = 'SELECT * FROM trades WHERE user_id = $1';
    const queryParams = [req.user.id];
    let paramIndex = 2;

    if (portfolioId) {
      queryStr += ` AND portfolio_id = $${paramIndex++}`;
      queryParams.push(portfolioId);
    }
    if (symbol) {
      queryStr += ` AND symbol = $${paramIndex++}`;
      queryParams.push(symbol);
    }
    if (status) {
      queryStr += ` AND status = $${paramIndex++}`;
      queryParams.push(status);
    }
    if (type) {
      queryStr += ` AND type = $${paramIndex++}`;
      queryParams.push(type);
    }
    if (startDate) {
      queryStr += ` AND created_at >= $${paramIndex++}`;
      queryParams.push(startDate);
    }
    if (endDate) {
      queryStr += ` AND created_at <= $${paramIndex++}`;
      queryParams.push(endDate);
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    const result = await query(queryStr, queryParams);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

router.post('/', authenticate, validateBody(createTradeBodySchema), validateResponse(tradeResponseSchema), async (req, res) => {
  try {
    const { portfolioId, symbol, side, type, quantity, price, exchange } = req.validatedBody;
    const result = await query(
      `INSERT INTO trades (user_id, portfolio_id, symbol, side, type, amount, price, exchange, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
      [req.user.id, portfolioId, symbol, side, type, quantity, price, exchange]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

export default router;