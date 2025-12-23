/**
 * ============================================================================
 * Favorites API Routes
 * ============================================================================
 * Manages user's favorite crypto assets with real-time tracking and alerts
 * ============================================================================
 */

import express from 'express';
import pool from '../database/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// GET /api/favorites - Get all user's favorites
// ============================================================================
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT 
                id,
                asset_id,
                symbol,
                name,
                added_at,
                last_viewed_at,
                view_count
            FROM favorites
            WHERE user_id = $1
            ORDER BY added_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            favorites: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch favorites'
        });
    }
});

// ============================================================================
// GET /api/favorites/:assetId - Check if asset is favorited
// ============================================================================
router.get('/check/:assetId', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { assetId } = req.params;

        const result = await pool.query(
            'SELECT id FROM favorites WHERE user_id = $1 AND asset_id = $2',
            [userId, assetId]
        );

        res.json({
            success: true,
            isFavorited: result.rows.length > 0,
            favoriteId: result.rows[0]?.id || null
        });
    } catch (error) {
        console.error('Error checking favorite:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check favorite status'
        });
    }
});

// ============================================================================
// POST /api/favorites - Add new favorite
// ============================================================================
router.post('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { asset_id, symbol, name } = req.body;

        // Validation
        if (!asset_id || !symbol || !name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: asset_id, symbol, name'
            });
        }

        // Check if already exists
        const existing = await pool.query(
            'SELECT id FROM favorites WHERE user_id = $1 AND asset_id = $2',
            [userId, asset_id]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Asset is already in favorites'
            });
        }

        // Insert new favorite
        const result = await pool.query(
            `INSERT INTO favorites (user_id, asset_id, symbol, name)
             VALUES ($1, $2, $3, $4)
             RETURNING id, asset_id, symbol, name, added_at`,
            [userId, asset_id, symbol, name]
        );

        res.status(201).json({
            success: true,
            favorite: result.rows[0],
            message: 'Favorite added successfully'
        });
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add favorite'
        });
    }
});

// ============================================================================
// DELETE /api/favorites/:id - Remove favorite
// ============================================================================
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const favoriteId = req.params.id;

        // Verify ownership
        const check = await pool.query(
            'SELECT id FROM favorites WHERE id = $1 AND user_id = $2',
            [favoriteId, userId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Favorite not found or unauthorized'
            });
        }

        // Delete favorite (will cascade delete alerts)
        await pool.query(
            'DELETE FROM favorites WHERE id = $1',
            [favoriteId]
        );

        res.json({
            success: true,
            message: 'Favorite removed successfully'
        });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove favorite'
        });
    }
});

// ============================================================================
// DELETE /api/favorites/by-asset/:assetId - Remove favorite by asset ID
// ============================================================================
router.delete('/by-asset/:assetId', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { assetId } = req.params;

        const result = await pool.query(
            'DELETE FROM favorites WHERE user_id = $1 AND asset_id = $2 RETURNING id',
            [userId, assetId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Favorite not found'
            });
        }

        res.json({
            success: true,
            message: 'Favorite removed successfully'
        });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove favorite'
        });
    }
});

// ============================================================================
// PUT /api/favorites/:id/view - Update view count and last viewed
// ============================================================================
router.put('/:id/view', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const favoriteId = req.params.id;

        const result = await pool.query(
            `UPDATE favorites 
             SET view_count = view_count + 1,
                 last_viewed_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2
             RETURNING view_count, last_viewed_at`,
            [favoriteId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Favorite not found'
            });
        }

        res.json({
            success: true,
            viewCount: result.rows[0].view_count,
            lastViewedAt: result.rows[0].last_viewed_at
        });
    } catch (error) {
        console.error('Error updating view:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update view count'
        });
    }
});

// ============================================================================
// GET /api/favorites/stats - Get user's favorites statistics
// ============================================================================
router.get('/stats', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_favorites,
                COUNT(DISTINCT symbol) as unique_symbols,
                MAX(added_at) as last_added_at,
                SUM(view_count) as total_views
            FROM favorites
            WHERE user_id = $1`,
            [userId]
        );

        const alertsCount = await pool.query(
            `SELECT 
                COUNT(*) as total_alerts,
                COUNT(*) FILTER (WHERE is_active = true) as active_alerts
            FROM favorite_alerts
            WHERE user_id = $1`,
            [userId]
        );

        res.json({
            success: true,
            stats: {
                ...stats.rows[0],
                ...alertsCount.rows[0]
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

// ============================================================================
// POST /api/favorites/sync - Sync favorites from IndexedDB
// ============================================================================
router.post('/sync', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { favorites } = req.body;

        if (!Array.isArray(favorites)) {
            return res.status(400).json({
                success: false,
                error: 'favorites must be an array'
            });
        }

        let syncedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Use transaction for atomic sync
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const fav of favorites) {
                const { id: asset_id, symbol, name } = fav;

                if (!asset_id || !symbol || !name) {
                    skippedCount++;
                    continue;
                }

                try {
                    // Insert or ignore if exists
                    await client.query(
                        `INSERT INTO favorites (user_id, asset_id, symbol, name)
                         VALUES ($1, $2, $3, $4)
                         ON CONFLICT (user_id, asset_id) DO NOTHING`,
                        [userId, asset_id, symbol, name]
                    );
                    syncedCount++;
                } catch (err) {
                    errors.push(`Failed to sync ${symbol}: ${err.message}`);
                    skippedCount++;
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        res.json({
            success: true,
            synced: syncedCount,
            skipped: skippedCount,
            errors: errors.length > 0 ? errors : undefined,
            message: `Synced ${syncedCount} favorites successfully`
        });
    } catch (error) {
        console.error('Error syncing favorites:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync favorites'
        });
    }
});

// ============================================================================
// GET /api/favorites/analytics - Get Favorites Analytics
// ============================================================================
router.get('/analytics', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Most favorited assets (across all users)
        const mostFavorited = await pool.query(
            `SELECT 
                asset_id,
                symbol,
                name,
                COUNT(*) as favorite_count
            FROM favorites
            GROUP BY asset_id, symbol, name
            ORDER BY favorite_count DESC
            LIMIT 10`
        );

        // User's most viewed favorites
        const mostViewed = await pool.query(
            `SELECT 
                asset_id,
                symbol,
                name,
                view_count,
                last_viewed_at
            FROM favorites
            WHERE user_id = $1
            ORDER BY view_count DESC
            LIMIT 10`,
            [userId]
        );

        // Alert statistics
        const alertStats = await pool.query(
            `SELECT 
                condition,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE is_active = true) as active_count,
                COUNT(*) FILTER (WHERE triggered_at IS NOT NULL) as triggered_count
            FROM favorite_alerts
            WHERE user_id = $1
            GROUP BY condition`,
            [userId]
        );

        // User engagement metrics
        const engagementMetrics = await pool.query(
            `SELECT 
                COUNT(*) as total_favorites,
                AVG(view_count) as avg_view_count,
                MAX(view_count) as max_view_count,
                COUNT(*) FILTER (WHERE view_count > 0) as viewed_favorites
            FROM favorites
            WHERE user_id = $1`,
            [userId]
        );

        // Recent favorites (last 7 days)
        const recentFavorites = await pool.query(
            `SELECT COUNT(*) as count
            FROM favorites
            WHERE user_id = $1 AND added_at >= NOW() - INTERVAL '7 days'`,
            [userId]
        );

        res.json({
            success: true,
            analytics: {
                mostFavorited: mostFavorited.rows,
                mostViewed: mostViewed.rows,
                alertStats: alertStats.rows,
                engagement: {
                    ...engagementMetrics.rows[0],
                    recentAdditions: parseInt(recentFavorites.rows[0].count)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics'
        });
    }
});

export default router;
