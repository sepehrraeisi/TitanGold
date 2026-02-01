import express from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { query, transaction } from '../database/db.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// ============================================================================
// IMPORTANT: Specific routes MUST come before parameterized routes (/:id)
// ============================================================================

// GET USER STATISTICS (Admin only)
router.get('/stats/overview', authenticate, authorize('admin'), async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE is_active = true)::int as active_users,
        COUNT(*) FILTER (WHERE is_verified = true)::int as verified_users,
        COUNT(*) FILTER (WHERE role = 'admin')::int as admin_count,
        COUNT(*) FILTER (WHERE role = 'trader')::int as trader_count,
        COUNT(*) FILTER (WHERE role = 'vip')::int as vip_count,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int as new_users_30d,
        COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days')::int as active_7d
      FROM users
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET ALL USERS (Admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { search, role, is_active, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT id, email, username, full_name, phone, avatar_url, role, is_active, is_verified, created_at, last_login_at FROM users WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (search) {
      sql += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount} OR full_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (role) {
      sql += ` AND role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    if (is_active !== undefined) {
      sql += ` AND is_active = $${paramCount}`;
      params.push(is_active === 'true');
      paramCount++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);
    const countResult = await query('SELECT COUNT(*) FROM users');
    
    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET USER ACTIVITY LOG
router.get('/:id/activity', authenticate, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT id, action, entity_type, entity_id, created_at, ip_address
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, parseInt(limit), parseInt(offset)]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// CHANGE PASSWORD
router.post('/:id/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { current_password, new_password } = req.body;

    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(
      current_password,
      userResult.rows[0].password_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, req.params.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// UPDATE USER ROLE (Admin only)
router.patch('/:id/role', authenticate, authorize('admin'), [
  body('role').isIn(['user', 'admin', 'trader', 'vip'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role } = req.body;

    const result = await query(
      `UPDATE users SET role = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, email, username, full_name, role`,
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ACTIVATE/DEACTIVATE USER (Admin only)
router.patch('/:id/status', authenticate, authorize('admin'), [
  body('is_active').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { is_active } = req.body;

    const result = await query(
      `UPDATE users SET is_active = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, email, username, is_active`,
      [is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET USER BY ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      `SELECT u.id, u.email, u.username, u.full_name, u.phone, u.avatar_url, 
              u.role, u.is_active, u.is_verified, u.created_at, u.last_login_at,
              s.theme, s.language, s.timezone, s.currency
       FROM users u
       LEFT JOIN user_settings s ON u.id = s.user_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// UPDATE USER PROFILE
router.patch('/:id', authenticate, [
  body('email').optional().isEmail().normalizeEmail(),
  body('full_name').optional().trim(),
  body('phone').optional().trim(),
  body('avatar_url').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { email, full_name, phone, avatar_url } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email !== undefined) {
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.params.id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(full_name);
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatar_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount} 
       RETURNING id, email, username, full_name, phone, avatar_url, role, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE USER (Admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User deleted successfully',
      user: result.rows[0]
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
