import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

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
      console.warn('⚠️ Failed to read existing avatar_url from users table:', err.message);
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
      console.warn('⚠️ Failed to update avatar_url in users table:', err.message);
      // We still return success because file is uploaded and frontend also stores URL client-side
    }

    // Delete old avatar file if it was stored under /uploads
    if (oldAvatarUrl && typeof oldAvatarUrl === 'string' && oldAvatarUrl.startsWith('/uploads/avatars/')) {
      const oldPath = path.join(__dirname, '..', oldAvatarUrl);
      fs.stat(oldPath, (err) => {
        if (!err) {
          fs.unlink(oldPath, (unlinkErr) => {
            if (unlinkErr) {
              console.warn('⚠️ Failed to delete old avatar file:', unlinkErr.message);
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
    console.error('❌ Error uploading avatar:', error);

    // Multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }

    return res.status(500).json({ error: 'Failed to upload avatar', message: error.message });
  }
});

export default router;


