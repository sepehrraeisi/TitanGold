import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';

const router = express.Router();

/**
 * Export AI Decisions to CSV
 * GET /api/exports/decisions
 * Query params: startDate, endDate, agentId (optional)
 */
router.get('/decisions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, agentId } = req.query;

    let queryText = `
      SELECT 
        id,
        agent_id,
        symbol,
        action,
        confidence,
        reasoning,
        was_successful,
        created_at,
        updated_at
      FROM ai_decisions
      WHERE user_id = $1
    `;
    const params = [userId];

    let paramIndex = 2;

    if (startDate) {
      queryText += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (agentId) {
      queryText += ` AND agent_id = $${paramIndex}`;
      params.push(agentId);
    }

    queryText += ` ORDER BY created_at DESC`;

    const result = await query(queryText, params);

    // Convert to CSV format
    const headers = [
      'ID',
      'Agent ID',
      'Symbol',
      'Action',
      'Confidence',
      'Reasoning',
      'Was Successful',
      'Created At',
      'Updated At'
    ];

    const csvRows = [headers.join(',')];

    result.rows.forEach(row => {
      const csvRow = [
        row.id,
        row.agent_id || '',
        row.symbol || '',
        row.action || '',
        row.confidence || 0,
        `"${(row.reasoning || '').replace(/"/g, '""')}"`, // Escape quotes
        row.was_successful ? 'Yes' : 'No',
        row.created_at || '',
        row.updated_at || ''
      ];
      csvRows.push(csvRow.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ai_decisions_${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

    res.send('\ufeff' + csvContent); // BOM for Excel UTF-8 support
  } catch (error) {
    logger.error('Failed to export decisions:', error);
    res.status(500).json({ error: 'Failed to export decisions', message: error.message });
  }
});

/**
 * Export Trade History to CSV
 * GET /api/exports/trades
 * Query params: startDate, endDate, symbol, status (optional)
 */
router.get('/trades', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, symbol, status } = req.query;

    let queryText = `
      SELECT 
        id,
        symbol,
        side,
        type,
        entry_price,
        exit_price,
        quantity,
        status,
        profit_loss,
        profit_loss_percent,
        created_at,
        updated_at,
        closed_at
      FROM trades
      WHERE user_id = $1
    `;
    const params = [userId];

    let paramIndex = 2;

    if (startDate) {
      queryText += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (symbol) {
      queryText += ` AND symbol = $${paramIndex}`;
      params.push(symbol);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
    }

    queryText += ` ORDER BY created_at DESC`;

    const result = await query(queryText, params);

    // Convert to CSV format
    const headers = [
      'ID',
      'Symbol',
      'Side',
      'Type',
      'Entry Price',
      'Exit Price',
      'Quantity',
      'Status',
      'Profit/Loss',
      'Profit/Loss %',
      'Created At',
      'Updated At',
      'Closed At'
    ];

    const csvRows = [headers.join(',')];

    result.rows.forEach(row => {
      const csvRow = [
        row.id,
        row.symbol || '',
        row.side || '',
        row.type || '',
        row.entry_price || 0,
        row.exit_price || '',
        row.quantity || 0,
        row.status || '',
        row.profit_loss || 0,
        row.profit_loss_percent ? `${row.profit_loss_percent}%` : '',
        row.created_at || '',
        row.updated_at || '',
        row.closed_at || ''
      ];
      csvRows.push(csvRow.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="trade_history_${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

    res.send('\ufeff' + csvContent); // BOM for Excel UTF-8 support
  } catch (error) {
    logger.error('Failed to export trades:', error);
    
    // If table doesn't exist, try manual_trades table as fallback
    if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
      try {
        // Fallback to manual_trades table
        const fallbackResult = await query(
          `SELECT 
            id,
            pair as symbol,
            side,
            type,
            price as entry_price,
            amount as quantity,
            status,
            created_at,
            updated_at
          FROM manual_trades
          WHERE user_id = $1
          ORDER BY created_at DESC`,
          [userId]
        );

        const headers = [
          'ID',
          'Symbol',
          'Side',
          'Type',
          'Price',
          'Amount',
          'Status',
          'Created At',
          'Updated At'
        ];

        const csvRows = [headers.join(',')];

        fallbackResult.rows.forEach(row => {
          const csvRow = [
            row.id,
            row.symbol || '',
            row.side || '',
            row.type || '',
            row.entry_price || 0,
            row.quantity || 0,
            row.status || '',
            row.created_at || '',
            row.updated_at || ''
          ];
          csvRows.push(csvRow.join(','));
        });

        const csvContent = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="trade_history_${new Date().toISOString().split('T')[0]}.csv"`
        );
        res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

        res.send('\ufeff' + csvContent);
        return;
      } catch (fallbackError) {
        logger.error('Fallback export also failed:', fallbackError);
      }
    }

    res.status(500).json({ error: 'Failed to export trades', message: error.message });
  }
});

/**
 * Export Manual Trades to CSV
 * GET /api/exports/manual-trades
 */
router.get('/manual-trades', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, pair, status } = req.query;

    let queryText = `
      SELECT 
        id,
        pair,
        side,
        type,
        amount,
        price,
        stop_price,
        limit_price,
        status,
        created_at,
        updated_at
      FROM manual_trades
      WHERE user_id = $1
    `;
    const params = [userId];

    let paramIndex = 2;

    if (startDate) {
      queryText += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (pair) {
      queryText += ` AND pair = $${paramIndex}`;
      params.push(pair);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
    }

    queryText += ` ORDER BY created_at DESC`;

    const result = await query(queryText, params);

    const headers = [
      'ID',
      'Pair',
      'Side',
      'Type',
      'Amount',
      'Price',
      'Stop Price',
      'Limit Price',
      'Status',
      'Created At',
      'Updated At'
    ];

    const csvRows = [headers.join(',')];

    result.rows.forEach(row => {
      const csvRow = [
        row.id,
        row.pair || '',
        row.side || '',
        row.type || '',
        row.amount || 0,
        row.price || '',
        row.stop_price || '',
        row.limit_price || '',
        row.status || '',
        row.created_at || '',
        row.updated_at || ''
      ];
      csvRows.push(csvRow.join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="manual_trades_${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

    res.send('\ufeff' + csvContent);
  } catch (error) {
    logger.error('Failed to export manual trades:', error);
    res.status(500).json({ error: 'Failed to export manual trades', message: error.message });
  }
});

export default router;

