import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AVATAR_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

// Ensure upload directory exists
function ensureUploadDir() {
  if (!fs.existsSync(AVATAR_UPLOAD_DIR)) {
    fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
  }
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureUploadDir();
      cb(null, AVATAR_UPLOAD_DIR);
    } catch (err) {
      cb(err, AVATAR_UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'unknown';
    const ext = path.extname(file.originalname) || '.png';
    const safeExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext.toLowerCase()) ? ext : '.png';
    const filename = `user-${userId}-${Date.now()}${safeExt}`;
    cb(null, filename);
  }
});

// File filter to allow only images
function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: imageFileFilter,
});

/**
 * POST /api/profile/avatar
 * Upload profile avatar image
 */
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Public URL path (served from /uploads)
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    // Fetch old avatar URL (if any)
    let oldAvatarUrl = null;
    try {
      const result = await query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
      oldAvatarUrl = result.rows[0]?.avatar_url || null;
    } catch (err) {
      // If users table or column is missing, just skip cleanup
      logger.warn('⚠️ Failed to read existing avatar_url from users table:', err.message);
    }

    // Update user record with new avatar URL
    try {
      await query(
        `UPDATE users 
         SET avatar_url = $1, updated_at = NOW()
         WHERE id = $2`,
        [avatarUrl, userId]
      );
    } catch (err) {
      logger.warn('⚠️ Failed to update avatar_url in users table:', err.message);
      // We still return success because file is uploaded and frontend also stores URL client-side
    }

    // Delete old avatar file if it was stored under /uploads
    if (oldAvatarUrl && typeof oldAvatarUrl === 'string' && oldAvatarUrl.startsWith('/uploads/avatars/')) {
      const oldPath = path.join(__dirname, '..', oldAvatarUrl);
      fs.stat(oldPath, (err) => {
        if (!err) {
          fs.unlink(oldPath, (unlinkErr) => {
            if (unlinkErr) {
              logger.warn('⚠️ Failed to delete old avatar file:', unlinkErr.message);
            }
          });
        }
      });
    }

    return res.json({
      success: true,
      avatarUrl,
      message: 'Avatar uploaded successfully',
    });
  } catch (error) {
    logger.error('❌ Error uploading avatar:', error);

    // Multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }

    return res.status(500).json({ error: 'Failed to upload avatar', message: error.message });
  }
});

/**
 * GET /api/profile/details
 * Get user profile details with metrics, integrations, and activity
 */
router.get('/details', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch user profile
    const userResult = await query(
      `SELECT id, username, email, full_name, phone, avatar_url, 
              job_title, timezone, location, is_verified, role, 
              created_at, last_login_at, metadata
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get communication preferences from metadata
    const metadata = user.metadata || {};
    const communications = metadata.communications || {
      emailReports: true,
      smsAlerts: false,
      aiSummaries: true,
      tradePush: true,
      weeklyDigest: false,
    };

    // Mock metrics (TODO: Get from trading system)
    const metrics = [
      { id: 'total_trades', labelKey: 'total_trades', value: '124', change: 12, direction: 'up' },
      { id: 'win_rate', labelKey: 'win_rate', value: '68%', change: 5, direction: 'up' },
      { id: 'active_strategies', labelKey: 'active_strategies', value: '3', change: null, direction: null },
    ];

    // Get connected integrations
    const integrationsResult = await query(
      `SELECT id, exchange as name, is_active, last_sync_at as last_synced_at 
       FROM exchange_connections WHERE user_id = $1`,
      [userId]
    );

    const integrations = integrationsResult.rows.map(integration => ({
      id: integration.id,
      nameKey: `integration_${integration.name.toLowerCase()}`,
      type: 'exchange',
      status: integration.is_active ? 'connected' : 'disconnected',
      lastSyncedAt: integration.last_synced_at || new Date().toISOString(),
    }));

    // Get recent activity (from audit_logs if available)
    const activityResult = await query(
      `SELECT id, action, details, created_at 
       FROM audit_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [userId]
    ).catch(() => ({ rows: [] }));

    const activity = activityResult.rows.map(log => ({
      id: log.id,
      messageKey: `activity_${log.action}`,
      context: log.details,
      timestamp: log.created_at,
    }));

    // Build response
    const profileData = {
      profile: {
        fullName: user.full_name || '',
        email: user.email || '',
        jobTitle: user.job_title || '',
        phone: user.phone || '',
        timezone: user.timezone || 'UTC',
        location: user.location || '',
        language: metadata.language || 'en',
        avatarUrl: user.avatar_url || null,
        status: user.is_verified ? 'verified' : 'pending',
        memberSince: user.created_at,
        lastLoginAt: user.last_login_at || user.created_at,
      },
      communications,
      metrics,
      integrations,
      activity,
    };

    return res.json(profileData);
  } catch (error) {
    logger.error('❌ Error fetching profile details:', error);
    return res.status(500).json({ error: 'Failed to fetch profile details', message: error.message });
  }
});

/**
 * PUT /api/profile/details
 * Update user profile details
 */
router.put('/details', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fullName, email, jobTitle, phone, timezone, location, avatarUrl } = req.body;

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Update user record
    await query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           job_title = COALESCE($3, job_title),
           phone = COALESCE($4, phone),
           timezone = COALESCE($5, timezone),
           location = COALESCE($6, location),
           avatar_url = COALESCE($7, avatar_url),
           updated_at = NOW()
       WHERE id = $8`,
      [fullName, email, jobTitle, phone, timezone, location, avatarUrl, userId]
    );

    // Fetch updated profile
    const updatedResult = await query(
      `SELECT id, username, email, full_name, phone, avatar_url, 
              job_title, timezone, location, is_verified, role, 
              created_at, last_login_at, metadata
       FROM users WHERE id = $1`,
      [userId]
    );

    const user = updatedResult.rows[0];
    const metadata = user.metadata || {};

    // Return updated profile (similar structure to GET)
    const profileData = {
      profile: {
        fullName: user.full_name || '',
        email: user.email || '',
        jobTitle: user.job_title || '',
        phone: user.phone || '',
        timezone: user.timezone || 'UTC',
        location: user.location || '',
        language: metadata.language || 'en',
        avatarUrl: user.avatar_url || null,
        status: user.is_verified ? 'verified' : 'pending',
        memberSince: user.created_at,
        lastLoginAt: user.last_login_at || user.created_at,
      },
      communications: metadata.communications || {},
      metrics: [],
      integrations: [],
      activity: [],
    };

    return res.json(profileData);
  } catch (error) {
    logger.error('❌ Error updating profile details:', error);
    return res.status(500).json({ error: 'Failed to update profile details', message: error.message });
  }
});

/**
 * PUT /api/profile/communications
 * Update communication preferences
 */
router.put('/communications', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const preferences = req.body;

    // Validate preferences structure
    const validKeys = ['emailReports', 'smsAlerts', 'aiSummaries', 'tradePush', 'weeklyDigest'];
    const invalidKeys = Object.keys(preferences).filter(key => !validKeys.includes(key));
    
    if (invalidKeys.length > 0) {
      return res.status(400).json({ error: `Invalid preference keys: ${invalidKeys.join(', ')}` });
    }

    // Get current metadata
    const userResult = await query('SELECT metadata FROM users WHERE id = $1', [userId]);
    const currentMetadata = userResult.rows[0]?.metadata || {};

    // Update communications in metadata
    const updatedMetadata = {
      ...currentMetadata,
      communications: {
        ...currentMetadata.communications,
        ...preferences,
      },
    };

    // Save to database
    await query(
      `UPDATE users 
       SET metadata = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(updatedMetadata), userId]
    );

    // Fetch updated profile
    const updatedResult = await query(
      `SELECT id, username, email, full_name, phone, avatar_url, 
              job_title, timezone, location, is_verified, role, 
              created_at, last_login_at, metadata
       FROM users WHERE id = $1`,
      [userId]
    );

    const user = updatedResult.rows[0];
    const metadata = user.metadata || {};

    // Return updated profile
    const profileData = {
      profile: {
        fullName: user.full_name || '',
        email: user.email || '',
        jobTitle: user.job_title || '',
        phone: user.phone || '',
        timezone: user.timezone || 'UTC',
        location: user.location || '',
        language: metadata.language || 'en',
        avatarUrl: user.avatar_url || null,
        status: user.is_verified ? 'verified' : 'pending',
        memberSince: user.created_at,
        lastLoginAt: user.last_login_at || user.created_at,
      },
      communications: metadata.communications || {},
      metrics: [],
      integrations: [],
      activity: [],
    };

    return res.json(profileData);
  } catch (error) {
    logger.error('❌ Error updating communication preferences:', error);
    return res.status(500).json({ error: 'Failed to update preferences', message: error.message });
  }
});

/**
 * POST /api/profile/change-password
 * Change user password
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Fetch user's current password hash
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentHash = userResult.rows[0].password_hash;

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, currentHash);

    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await query(
      `UPDATE users 
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [newHash, userId]
    );

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('❌ Error changing password:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to change password', 
      message: error.message 
    });
  }
});

export default router;


