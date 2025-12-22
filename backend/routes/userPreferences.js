/**
 * ============================================================================
 * TitanGold User Preferences API
 * ============================================================================
 * 
 * RESTful API for managing user preferences with:
 *   - CRUD operations with validation
 *   - Versioning and conflict resolution
 *   - Multi-device sync support
 *   - Audit trail and history
 *   - Category-based organization
 *   - Real-time WebSocket updates
 * 
 * @module routes/userPreferences
 * @version 1.0.0
 * @author TitanGold Development Team
 * @date 2025-12-22
 * ============================================================================
 */

import express from 'express';
import db from '../database/db.js';
import { authenticate } from '../middleware/auth.js';
import Joi from 'joi';

const router = express.Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Validation schema for preference update
 */
const preferenceUpdateSchema = Joi.object({
    preferences: Joi.object().required(),
    version: Joi.number().integer().min(1).optional(),
    syncSource: Joi.string().max(50).optional().default('web'),
    deviceFingerprint: Joi.string().max(255).optional()
});

/**
 * Validation schema for category-specific update
 */
const categoryUpdateSchema = Joi.object({
    category: Joi.string().required().pattern(/^[a-z][a-z0-9_]*$/),
    values: Joi.object().required(),
    version: Joi.number().integer().min(1).optional(),
    syncSource: Joi.string().max(50).optional().default('web')
});

/**
 * Validation schema for bulk update
 */
const bulkUpdateSchema = Joi.object({
    updates: Joi.array().items(Joi.object({
        category: Joi.string().required(),
        values: Joi.object().required()
    })).min(1).required(),
    version: Joi.number().integer().min(1).optional(),
    syncSource: Joi.string().max(50).optional().default('web')
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Middleware to add request metadata
 */
function addRequestMetadata(req, res, next) {
    req.metadata = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || 'Unknown',
        deviceFingerprint: req.body.deviceFingerprint || req.headers['x-device-id']
    };
    next();
}

/**
 * Middleware to validate request body against schema
 */
function validateBody(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                }))
            });
        }

        req.validatedBody = value;
        next();
    };
}

// Apply metadata middleware to all routes
router.use(addRequestMetadata);

// ============================================================================
// GET ENDPOINTS
// ============================================================================

/**
 * GET /api/user-preferences
 * Get all preferences for the authenticated user
 * 
 * @returns {Object} User preferences with metadata
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await db.query(`
            SELECT 
                id,
                user_id,
                preferences,
                version,
                last_sync_at,
                sync_source,
                device_fingerprint,
                created_at,
                updated_at
            FROM user_preferences
            WHERE user_id = $1 AND is_deleted = FALSE
        `, [userId]);

        if (result.rows.length === 0) {
            // Return defaults if no preferences exist
            const defaultsResult = await db.query(`
                SELECT jsonb_object_agg(category_name, default_values) as defaults
                FROM preference_categories
                WHERE is_active = TRUE
            `);

            return res.json({
                success: true,
                data: {
                    preferences: defaultsResult.rows[0]?.defaults || {},
                    version: 0,
                    isNew: true
                },
                message: 'Using default preferences'
            });
        }

        const prefs = result.rows[0];

        res.json({
            success: true,
            data: {
                preferences: prefs.preferences,
                version: prefs.version,
                lastSyncAt: prefs.last_sync_at,
                syncSource: prefs.sync_source,
                deviceFingerprint: prefs.device_fingerprint,
                updatedAt: prefs.updated_at,
                isNew: false
            }
        });

    } catch (error) {
        console.error('❌ Error fetching user preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch preferences',
            message: error.message
        });
    }
});

/**
 * GET /api/user-preferences/category/:category
 * Get preferences for a specific category
 * 
 * @param {string} category - Category name
 * @returns {Object} Category preferences
 */
router.get('/category/:category', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { category } = req.params;

        // Validate category exists
        const categoryCheck = await db.query(
            'SELECT default_values FROM preference_categories WHERE category_name = $1 AND is_active = TRUE',
            [category]
        );

        if (categoryCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Category not found',
                category
            });
        }

        const result = await db.query(`
            SELECT 
                preferences->$2 as category_preferences,
                version
            FROM user_preferences
            WHERE user_id = $1 AND is_deleted = FALSE
        `, [userId, category]);

        const categoryPrefs = result.rows.length > 0 
            ? result.rows[0].category_preferences 
            : categoryCheck.rows[0].default_values;

        res.json({
            success: true,
            data: {
                category,
                preferences: categoryPrefs,
                version: result.rows.length > 0 ? result.rows[0].version : 0
            }
        });

    } catch (error) {
        console.error('❌ Error fetching category preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch category preferences',
            message: error.message
        });
    }
});

/**
 * GET /api/user-preferences/history
 * Get preference change history for the user
 * 
 * @query {number} limit - Number of records to return (default: 50)
 * @query {number} offset - Pagination offset (default: 0)
 * @query {string} category - Filter by category
 * @returns {Array} Change history
 */
router.get('/history', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        const category = req.query.category;

        let query = `
            SELECT 
                id,
                category,
                change_type,
                old_values,
                new_values,
                old_version,
                new_version,
                sync_source,
                device_fingerprint,
                changed_at
            FROM preference_change_history
            WHERE user_id = $1 AND is_archived = FALSE
        `;
        const params = [userId];

        if (category) {
            query += ' AND category = $' + (params.length + 1);
            params.push(category);
        }

        query += ' ORDER BY changed_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM preference_change_history WHERE user_id = $1 AND is_archived = FALSE';
        const countParams = [userId];
        if (category) {
            countQuery += ' AND category = $2';
            countParams.push(category);
        }
        const countResult = await db.query(countQuery, countParams);

        res.json({
            success: true,
            data: {
                history: result.rows,
                pagination: {
                    total: parseInt(countResult.rows[0].count),
                    limit,
                    offset,
                    hasMore: offset + limit < parseInt(countResult.rows[0].count)
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching preference history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch history',
            message: error.message
        });
    }
});

/**
 * GET /api/user-preferences/categories
 * Get all available preference categories
 * 
 * @returns {Array} Available categories with schemas
 */
router.get('/categories', authenticate, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                category_name,
                display_name,
                description,
                schema,
                default_values,
                is_public,
                required_role
            FROM preference_categories
            WHERE is_active = TRUE
            ORDER BY category_name
        `);

        res.json({
            success: true,
            data: {
                categories: result.rows
            }
        });

    } catch (error) {
        console.error('❌ Error fetching categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories',
            message: error.message
        });
    }
});

// ============================================================================
// POST ENDPOINTS
// ============================================================================

/**
 * POST /api/user-preferences
 * Create or initialize user preferences
 * 
 * @body {Object} preferences - Initial preferences
 * @returns {Object} Created preferences
 */
router.post('/', authenticate, validateBody(preferenceUpdateSchema), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { preferences, syncSource, deviceFingerprint } = req.validatedBody;
        const { ipAddress, userAgent } = req.metadata;

        // Check if preferences already exist
        const existing = await db.query(
            'SELECT id FROM user_preferences WHERE user_id = $1 AND is_deleted = FALSE',
            [userId]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Preferences already exist',
                message: 'Use PUT /api/user-preferences to update existing preferences'
            });
        }

        const result = await db.query(`
            INSERT INTO user_preferences (
                user_id,
                preferences,
                sync_source,
                device_fingerprint,
                ip_address,
                user_agent,
                updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $1)
            RETURNING 
                id, user_id, preferences, version, 
                last_sync_at, sync_source, created_at, updated_at
        `, [userId, JSON.stringify(preferences), syncSource, deviceFingerprint, ipAddress, userAgent]);

        console.log(`✅ Preferences created for user ${userId}`);

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Preferences created successfully'
        });

    } catch (error) {
        console.error('❌ Error creating preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create preferences',
            message: error.message
        });
    }
});

// ============================================================================
// PUT ENDPOINTS
// ============================================================================

/**
 * PUT /api/user-preferences
 * Update all user preferences
 * 
 * @body {Object} preferences - Updated preferences
 * @body {number} version - Client version for conflict detection
 * @returns {Object} Updated preferences
 */
router.put('/', authenticate, validateBody(preferenceUpdateSchema), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { preferences, version: clientVersion, syncSource, deviceFingerprint } = req.validatedBody;
        const { ipAddress, userAgent } = req.metadata;

        // Start transaction
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Get current preferences with lock
            const current = await client.query(
                `SELECT id, preferences, version 
                 FROM user_preferences 
                 WHERE user_id = $1 AND is_deleted = FALSE
                 FOR UPDATE`,
                [userId]
            );

            if (current.rows.length === 0) {
                // Create if doesn't exist
                const result = await client.query(`
                    INSERT INTO user_preferences (
                        user_id, preferences, sync_source, device_fingerprint,
                        ip_address, user_agent, updated_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $1)
                    RETURNING id, user_id, preferences, version, last_sync_at, updated_at
                `, [userId, JSON.stringify(preferences), syncSource, deviceFingerprint, ipAddress, userAgent]);

                await client.query('COMMIT');

                return res.json({
                    success: true,
                    data: result.rows[0],
                    message: 'Preferences created successfully',
                    conflict: false
                });
            }

            const serverVersion = current.rows[0].version;
            let hasConflict = false;
            let mergedPrefs = preferences;

            // Check for version conflict
            if (clientVersion && clientVersion !== serverVersion) {
                hasConflict = true;
                // Simple merge strategy: client values override server values
                mergedPrefs = { ...current.rows[0].preferences, ...preferences };
                console.log(`⚠️  Version conflict detected for user ${userId}. Server: ${serverVersion}, Client: ${clientVersion}`);
            }

            // Update preferences
            const result = await client.query(`
                UPDATE user_preferences
                SET 
                    preferences = $2,
                    sync_source = $3,
                    device_fingerprint = $4,
                    ip_address = $5,
                    user_agent = $6,
                    updated_by = $1
                WHERE user_id = $1 AND is_deleted = FALSE
                RETURNING id, user_id, preferences, version, last_sync_at, sync_source, updated_at
            `, [userId, JSON.stringify(mergedPrefs), syncSource, deviceFingerprint, ipAddress, userAgent]);

            await client.query('COMMIT');

            console.log(`✅ Preferences updated for user ${userId}, version ${serverVersion} → ${result.rows[0].version}`);

            // Broadcast update via WebSocket (if available)
            if (req.app.locals.wss) {
                req.app.locals.wss.broadcast(userId, {
                    type: 'preferences_updated',
                    data: result.rows[0],
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                data: result.rows[0],
                message: hasConflict ? 'Preferences merged due to conflict' : 'Preferences updated successfully',
                conflict: hasConflict
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Error updating preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update preferences',
            message: error.message
        });
    }
});

/**
 * PUT /api/user-preferences/category/:category
 * Update preferences for a specific category
 * 
 * @param {string} category - Category name
 * @body {Object} values - Updated category values
 * @returns {Object} Updated preferences
 */
router.put('/category/:category', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { category } = req.params;
        const { values, version: clientVersion, syncSource = 'web' } = req.body;
        const { ipAddress, userAgent, deviceFingerprint } = req.metadata;

        if (!values || typeof values !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'values must be an object'
            });
        }

        // Validate category exists
        const categoryCheck = await db.query(
            'SELECT category_name FROM preference_categories WHERE category_name = $1 AND is_active = TRUE',
            [category]
        );

        if (categoryCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Category not found',
                category
            });
        }

        const result = await db.query(`
            UPDATE user_preferences
            SET 
                preferences = jsonb_set(
                    COALESCE(preferences, '{}'::jsonb),
                    $2::text[],
                    $3::jsonb
                ),
                sync_source = $4,
                device_fingerprint = $5,
                ip_address = $6,
                user_agent = $7,
                updated_by = $8
            WHERE user_id = $1 AND is_deleted = FALSE
            RETURNING id, user_id, preferences, version, updated_at
        `, [userId, `{${category}}`, JSON.stringify(values), syncSource, deviceFingerprint, ipAddress, userAgent, userId]);

        if (result.rows.length === 0) {
            // Create if doesn't exist
            const newResult = await db.query(`
                INSERT INTO user_preferences (
                    user_id, preferences, sync_source, device_fingerprint,
                    ip_address, user_agent, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $1)
                RETURNING id, user_id, preferences, version, updated_at
            `, [
                userId,
                JSON.stringify({ [category]: values }),
                syncSource,
                deviceFingerprint,
                ipAddress,
                userAgent
            ]);

            console.log(`✅ Category '${category}' preferences created for user ${userId}`);

            return res.json({
                success: true,
                data: newResult.rows[0],
                message: 'Category preferences created successfully'
            });
        }

        console.log(`✅ Category '${category}' updated for user ${userId}`);

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Category preferences updated successfully'
        });

    } catch (error) {
        console.error('❌ Error updating category preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update category preferences',
            message: error.message
        });
    }
});

/**
 * PUT /api/user-preferences/bulk
 * Update multiple categories at once
 * 
 * @body {Array} updates - Array of category updates
 * @returns {Object} Updated preferences
 */
router.put('/bulk', authenticate, validateBody(bulkUpdateSchema), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { updates, version: clientVersion, syncSource } = req.validatedBody;
        const { ipAddress, userAgent, deviceFingerprint } = req.metadata;

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Get current preferences
            const current = await client.query(
                'SELECT preferences FROM user_preferences WHERE user_id = $1 AND is_deleted = FALSE FOR UPDATE',
                [userId]
            );

            let mergedPrefs = current.rows.length > 0 ? current.rows[0].preferences : {};

            // Apply all updates
            for (const update of updates) {
                mergedPrefs[update.category] = { ...mergedPrefs[update.category], ...update.values };
            }

            // Update or insert
            const result = await client.query(`
                INSERT INTO user_preferences (
                    user_id, preferences, sync_source, device_fingerprint,
                    ip_address, user_agent, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $1)
                ON CONFLICT (user_id) 
                DO UPDATE SET
                    preferences = EXCLUDED.preferences,
                    sync_source = EXCLUDED.sync_source,
                    device_fingerprint = EXCLUDED.device_fingerprint,
                    ip_address = EXCLUDED.ip_address,
                    user_agent = EXCLUDED.user_agent,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()
                RETURNING id, user_id, preferences, version, updated_at
            `, [userId, JSON.stringify(mergedPrefs), syncSource, deviceFingerprint, ipAddress, userAgent]);

            await client.query('COMMIT');

            console.log(`✅ Bulk update completed for user ${userId}, ${updates.length} categories updated`);

            res.json({
                success: true,
                data: result.rows[0],
                message: `${updates.length} categories updated successfully`
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Error bulk updating preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to bulk update preferences',
            message: error.message
        });
    }
});

// ============================================================================
// DELETE ENDPOINTS
// ============================================================================

/**
 * DELETE /api/user-preferences
 * Soft delete user preferences
 * 
 * @returns {Object} Success message
 */
router.delete('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await db.query(`
            UPDATE user_preferences
            SET 
                is_deleted = TRUE,
                deleted_at = NOW(),
                updated_by = $1
            WHERE user_id = $1 AND is_deleted = FALSE
            RETURNING id
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Preferences not found'
            });
        }

        console.log(`✅ Preferences deleted for user ${userId}`);

        res.json({
            success: true,
            message: 'Preferences deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete preferences',
            message: error.message
        });
    }
});

/**
 * DELETE /api/user-preferences/category/:category
 * Delete a specific category from preferences
 * 
 * @param {string} category - Category name
 * @returns {Object} Success message
 */
router.delete('/category/:category', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { category } = req.params;

        const result = await db.query(`
            UPDATE user_preferences
            SET 
                preferences = preferences - $2,
                updated_by = $1
            WHERE user_id = $1 AND is_deleted = FALSE
            RETURNING id, preferences, version
        `, [userId, category]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Preferences not found'
            });
        }

        console.log(`✅ Category '${category}' deleted for user ${userId}`);

        res.json({
            success: true,
            data: result.rows[0],
            message: `Category '${category}' deleted successfully`
        });

    } catch (error) {
        console.error('❌ Error deleting category:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete category',
            message: error.message
        });
    }
});

// ============================================================================
// SYNC ENDPOINT
// ============================================================================

/**
 * POST /api/user-preferences/sync
 * Sync local preferences with server (handles conflicts)
 * 
 * @body {Object} localPreferences - Local preferences to sync
 * @body {number} localVersion - Local version number
 * @body {number} localTimestamp - Local last update timestamp
 * @returns {Object} Merged preferences with sync status
 */
router.post('/sync', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { localPreferences, localVersion, localTimestamp, syncSource = 'web' } = req.body;
        const { ipAddress, userAgent, deviceFingerprint } = req.metadata;

        // Get server preferences
        const serverResult = await db.query(`
            SELECT preferences, version, updated_at
            FROM user_preferences
            WHERE user_id = $1 AND is_deleted = FALSE
        `, [userId]);

        let syncAction = '';
        let mergedPrefs = localPreferences;
        let hasConflict = false;

        if (serverResult.rows.length === 0) {
            // No server preferences, upload local
            syncAction = 'upload';
        } else {
            const serverPrefs = serverResult.rows[0].preferences;
            const serverVersion = serverResult.rows[0].version;
            const serverTimestamp = new Date(serverResult.rows[0].updated_at).getTime();
            const clientTimestamp = localTimestamp ? new Date(localTimestamp).getTime() : 0;

            if (serverVersion === localVersion) {
                // Same version, check timestamps
                if (clientTimestamp > serverTimestamp) {
                    syncAction = 'upload';
                } else {
                    syncAction = 'download';
                    mergedPrefs = serverPrefs;
                }
            } else if (serverVersion > localVersion) {
                // Server ahead, merge with server winning
                syncAction = 'merge';
                hasConflict = true;
                mergedPrefs = { ...localPreferences, ...serverPrefs };
            } else {
                // Client ahead (shouldn't happen), upload
                syncAction = 'upload';
            }
        }

        // Update server if needed
        if (syncAction === 'upload' || syncAction === 'merge') {
            await db.query(`
                INSERT INTO user_preferences (
                    user_id, preferences, sync_source, device_fingerprint,
                    ip_address, user_agent, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $1)
                ON CONFLICT (user_id) 
                DO UPDATE SET
                    preferences = EXCLUDED.preferences,
                    sync_source = EXCLUDED.sync_source,
                    device_fingerprint = EXCLUDED.device_fingerprint,
                    updated_at = NOW()
            `, [userId, JSON.stringify(mergedPrefs), syncSource, deviceFingerprint, ipAddress, userAgent]);
        }

        // Get updated server state
        const finalResult = await db.query(`
            SELECT preferences, version, updated_at
            FROM user_preferences
            WHERE user_id = $1 AND is_deleted = FALSE
        `, [userId]);

        console.log(`✅ Sync completed for user ${userId}: ${syncAction}${hasConflict ? ' (with conflict)' : ''}`);

        res.json({
            success: true,
            data: {
                preferences: finalResult.rows[0].preferences,
                version: finalResult.rows[0].version,
                updatedAt: finalResult.rows[0].updated_at
            },
            sync: {
                action: syncAction,
                hasConflict,
                message: hasConflict 
                    ? 'Preferences merged due to conflict, server values took precedence'
                    : `Preferences ${syncAction}ed successfully`
            }
        });

    } catch (error) {
        console.error('❌ Error syncing preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync preferences',
            message: error.message
        });
    }
});

// ============================================================================
// EXPORT ROUTER
// ============================================================================

export default router;
