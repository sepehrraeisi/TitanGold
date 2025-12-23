/**
 * ============================================================================
 * Favorite Alerts API Routes
 * ============================================================================
 * Manages price alerts for favorite crypto assets
 * ============================================================================
 */

import express from 'express';
import pool from '../database/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// GET /api/favorites/:favoriteId/alerts - Get all alerts for a favorite
// ============================================================================
router.get('/:favoriteId/alerts', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { favoriteId } = req.params;

        // Verify favorite ownership
        const favoriteCheck = await pool.query(
            'SELECT id FROM favorites WHERE id = $1 AND user_id = $2',
            [favoriteId, userId]
        );

        if (favoriteCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Favorite not found or unauthorized'
            });
        }

        const result = await pool.query(
            `SELECT 
                id,
                favorite_id,
                condition,
                target_price,
                is_active,
                triggered_at,
                triggered_price,
                notify_telegram,
                notify_browser,
                notify_email,
                created_at,
                updated_at
            FROM favorite_alerts
            WHERE favorite_id = $1 AND user_id = $2
            ORDER BY created_at DESC`,
            [favoriteId, userId]
        );

        res.json({
            success: true,
            alerts: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts'
        });
    }
});

// ============================================================================
// GET /api/favorites/alerts/active - Get all active alerts for user
// ============================================================================
router.get('/alerts/active', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT 
                fa.id,
                fa.favorite_id,
                fa.condition,
                fa.target_price,
                fa.triggered_at,
                fa.triggered_price,
                fa.notify_telegram,
                fa.notify_browser,
                fa.notify_email,
                fa.created_at,
                f.asset_id,
                f.symbol,
                f.name
            FROM favorite_alerts fa
            JOIN favorites f ON fa.favorite_id = f.id
            WHERE fa.user_id = $1 AND fa.is_active = true
            ORDER BY fa.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            alerts: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching active alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active alerts'
        });
    }
});

// ============================================================================
// POST /api/favorites/:favoriteId/alerts - Create new alert
// ============================================================================
router.post('/:favoriteId/alerts', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { favoriteId } = req.params;
        const {
            condition,
            target_price,
            notify_telegram = true,
            notify_browser = true,
            notify_email = false
        } = req.body;

        // Validation
        if (!condition || !target_price) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: condition, target_price'
            });
        }

        if (!['above', 'below'].includes(condition)) {
            return res.status(400).json({
                success: false,
                error: 'condition must be "above" or "below"'
            });
        }

        if (target_price <= 0) {
            return res.status(400).json({
                success: false,
                error: 'target_price must be greater than 0'
            });
        }

        // Verify favorite ownership
        const favoriteCheck = await pool.query(
            'SELECT id FROM favorites WHERE id = $1 AND user_id = $2',
            [favoriteId, userId]
        );

        if (favoriteCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Favorite not found or unauthorized'
            });
        }

        // Create alert
        const result = await pool.query(
            `INSERT INTO favorite_alerts (
                favorite_id,
                user_id,
                condition,
                target_price,
                notify_telegram,
                notify_browser,
                notify_email
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING 
                id,
                favorite_id,
                condition,
                target_price,
                is_active,
                notify_telegram,
                notify_browser,
                notify_email,
                created_at`,
            [favoriteId, userId, condition, target_price, notify_telegram, notify_browser, notify_email]
        );

        res.status(201).json({
            success: true,
            alert: result.rows[0],
            message: 'Alert created successfully'
        });
    } catch (error) {
        console.error('Error creating alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create alert'
        });
    }
});

// ============================================================================
// PUT /api/favorites/alerts/:alertId - Update alert
// ============================================================================
router.put('/alerts/:alertId', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { alertId } = req.params;
        const {
            condition,
            target_price,
            is_active,
            notify_telegram,
            notify_browser,
            notify_email
        } = req.body;

        // Verify ownership
        const check = await pool.query(
            'SELECT id FROM favorite_alerts WHERE id = $1 AND user_id = $2',
            [alertId, userId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found or unauthorized'
            });
        }

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (condition !== undefined) {
            if (!['above', 'below'].includes(condition)) {
                return res.status(400).json({
                    success: false,
                    error: 'condition must be "above" or "below"'
                });
            }
            updates.push(`condition = $${paramCount++}`);
            values.push(condition);
        }

        if (target_price !== undefined) {
            if (target_price <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'target_price must be greater than 0'
                });
            }
            updates.push(`target_price = $${paramCount++}`);
            values.push(target_price);
        }

        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        if (notify_telegram !== undefined) {
            updates.push(`notify_telegram = $${paramCount++}`);
            values.push(notify_telegram);
        }

        if (notify_browser !== undefined) {
            updates.push(`notify_browser = $${paramCount++}`);
            values.push(notify_browser);
        }

        if (notify_email !== undefined) {
            updates.push(`notify_email = $${paramCount++}`);
            values.push(notify_email);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }

        values.push(alertId);
        const result = await pool.query(
            `UPDATE favorite_alerts 
             SET ${updates.join(', ')}
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        res.json({
            success: true,
            alert: result.rows[0],
            message: 'Alert updated successfully'
        });
    } catch (error) {
        console.error('Error updating alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update alert'
        });
    }
});

// ============================================================================
// DELETE /api/favorites/alerts/:alertId - Delete alert
// ============================================================================
router.delete('/alerts/:alertId', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { alertId } = req.params;

        const result = await pool.query(
            'DELETE FROM favorite_alerts WHERE id = $1 AND user_id = $2 RETURNING id',
            [alertId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found or unauthorized'
            });
        }

        res.json({
            success: true,
            message: 'Alert deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete alert'
        });
    }
});

// ============================================================================
// POST /api/favorites/alerts/:alertId/trigger - Mark alert as triggered
// ============================================================================
router.post('/alerts/:alertId/trigger', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { alertId } = req.params;
        const { triggered_price } = req.body;

        if (!triggered_price || triggered_price <= 0) {
            return res.status(400).json({
                success: false,
                error: 'triggered_price is required and must be greater than 0'
            });
        }

        const result = await pool.query(
            `UPDATE favorite_alerts 
             SET is_active = false,
                 triggered_at = CURRENT_TIMESTAMP,
                 triggered_price = $1
             WHERE id = $2 AND user_id = $3 AND is_active = true
             RETURNING *`,
            [triggered_price, alertId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found, unauthorized, or already triggered'
            });
        }

        res.json({
            success: true,
            alert: result.rows[0],
            message: 'Alert triggered successfully'
        });
    } catch (error) {
        console.error('Error triggering alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger alert'
        });
    }
});

export default router;
