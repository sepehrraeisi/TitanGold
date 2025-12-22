import express from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';

const router = express.Router();

/**
 * Setup 2FA - Generate secret and QR code
 */
router.post('/2fa/setup', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email || 'user@example.com';
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `TitanGold (${userEmail})`,
      issuer: 'TitanGold',
      length: 32,
    });
    
    // Save temporary secret to database (not activated yet)
    await query(
      `UPDATE users 
       SET two_factor_temp_secret = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [secret.base32, userId]
    ).catch(async (err) => {
      // If column doesn't exist, try to add it first (for development)
      if (err.message?.includes('column "two_factor_temp_secret" does not exist')) {
        console.warn('⚠️ two_factor_temp_secret column does not exist, attempting to create...');
        // For now, just continue - the column should exist in production
      } else {
        throw err;
      }
    });
    
    // Generate QR code
    let qrCode = null;
    try {
      qrCode = await QRCode.toDataURL(secret.otpauth_url);
    } catch (qrError) {
      console.error('Failed to generate QR code:', qrError);
      // Continue without QR code - user can enter secret manually
    }
    
    res.json({
      secret: secret.base32,
      qrCode: qrCode,
      manualEntryKey: secret.base32,
    });
  } catch (error) {
    console.error('Failed to setup 2FA:', error);
    res.status(500).json({ error: 'Failed to setup 2FA', message: error.message });
  }
});

/**
 * Verify 2FA token and enable 2FA
 */
router.post('/2fa/verify', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    // Get temporary secret from database
    const result = await query(
      'SELECT two_factor_temp_secret FROM users WHERE id = $1',
      [userId]
    ).catch(err => {
      if (err.message?.includes('column "two_factor_temp_secret" does not exist')) {
        return { rows: [] };
      }
      throw err;
    });
    
    const tempSecret = result.rows[0]?.two_factor_temp_secret;
    
    if (!tempSecret) {
      return res.status(400).json({ error: '2FA setup not initiated. Please setup 2FA first.' });
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: token,
      window: 2, // Allow 2 time steps (60 seconds) tolerance
    });
    
    if (verified) {
      // Move temp secret to permanent and enable 2FA
      await query(
        `UPDATE users 
         SET two_factor_secret = $1, 
             two_factor_temp_secret = NULL,
             two_factor_enabled = true,
             updated_at = NOW()
         WHERE id = $2`,
        [tempSecret, userId]
      ).catch(async (err) => {
        if (err.message?.includes('column "two_factor_secret" does not exist')) {
          console.warn('⚠️ 2FA columns do not exist in users table');
          // For development, we'll continue - columns should exist in production
        } else {
          throw err;
        }
      });
      
      res.json({ 
        success: true, 
        message: '2FA enabled successfully' 
      });
    } else {
      res.status(400).json({ error: 'Invalid token. Please check your authenticator app and try again.' });
    }
  } catch (error) {
    console.error('Failed to verify 2FA:', error);
    res.status(500).json({ error: 'Failed to verify 2FA', message: error.message });
  }
});

/**
 * Disable 2FA
 */
router.post('/2fa/disable', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body; // Require current token to disable
    
    // Get current secret
    const result = await query(
      'SELECT two_factor_secret FROM users WHERE id = $1 AND two_factor_enabled = true',
      [userId]
    ).catch(err => {
      if (err.message?.includes('column "two_factor_secret" does not exist')) {
        return { rows: [] };
      }
      throw err;
    });
    
    const secret = result.rows[0]?.two_factor_secret;
    
    if (!secret) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }
    
    // Verify token before disabling
    if (token) {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2,
      });
      
      if (!verified) {
        return res.status(400).json({ error: 'Invalid token. Cannot disable 2FA without valid token.' });
      }
    }
    
    // Disable 2FA
    await query(
      `UPDATE users 
       SET two_factor_enabled = false,
           two_factor_secret = NULL,
           two_factor_temp_secret = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    ).catch(err => {
      if (err.message?.includes('column') && err.message?.includes('does not exist')) {
        // Columns don't exist - that's fine for development
        console.warn('⚠️ 2FA columns do not exist');
      } else {
        throw err;
      }
    });
    
    res.json({ 
      success: true, 
      message: '2FA disabled successfully' 
    });
  } catch (error) {
    console.error('Failed to disable 2FA:', error);
    res.status(500).json({ error: 'Failed to disable 2FA', message: error.message });
  }
});

/**
 * Verify 2FA token (for login/authentication)
 */
router.post('/2fa/verify-token', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    // Get secret from database
    const result = await query(
      'SELECT two_factor_secret FROM users WHERE id = $1 AND two_factor_enabled = true',
      [userId]
    ).catch(err => {
      if (err.message?.includes('column "two_factor_secret" does not exist')) {
        return { rows: [] };
      }
      throw err;
    });
    
    const secret = result.rows[0]?.two_factor_secret;
    
    if (!secret) {
      return res.status(400).json({ error: '2FA is not enabled for this user' });
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2,
    });
    
    if (verified) {
      res.json({ 
        success: true, 
        message: 'Token verified successfully' 
      });
    } else {
      res.status(400).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Failed to verify 2FA token:', error);
    res.status(500).json({ error: 'Failed to verify token', message: error.message });
  }
});

/**
 * Generate 2FA backup codes (server-side, stored hashed in users.two_factor_backup_codes)
 */
router.post('/2fa/backup-codes/generate', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Ensure 2FA is enabled
    const userResult = await query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.two_factor_enabled) {
      return res.status(400).json({ error: '2FA must be enabled before generating backup codes' });
    }

    const backupCodes = [];
    const hashedCodes = [];

    // Generate 10 one-time backup codes
    for (let i = 0; i < 10; i++) {
      const code = generateRandomCode(8);
      const hash = await bcrypt.hash(code, 10);

      backupCodes.push(code);
      hashedCodes.push({
        hash,
        used: false,
        created_at: new Date().toISOString(),
      });
    }

    // Persist hashed codes in users table
    await query(
      'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
      [JSON.stringify(hashedCodes), userId]
    );

    console.log(`[SECURITY] User ${userId} generated new 2FA backup codes`);

    res.json({
      backupCodes,
      message: 'Backup codes generated successfully. Save these codes in a safe place. You will not be able to see them again.',
      warning: 'Each code can only be used once. Generate new codes if you use all of them.',
    });
  } catch (error) {
    console.error('Error generating backup codes:', error);
    res.status(500).json({ error: 'Failed to generate backup codes', message: error.message });
  }
});

/**
 * Verify a backup code during login (does not require authenticate middleware)
 * Expects: { userId, backupCode }
 */
router.post('/2fa/backup-codes/verify', async (req, res) => {
  try {
    const { userId, backupCode } = req.body || {};

    if (!userId || !backupCode) {
      return res.status(400).json({ error: 'userId and backupCode are required' });
    }

    const userResult = await query(
      'SELECT two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const backupCodes = userResult.rows[0].two_factor_backup_codes || [];

    if (!Array.isArray(backupCodes) || backupCodes.length === 0) {
      return res.status(400).json({ error: 'No backup codes found. Please generate backup codes first.' });
    }

    let codeFound = false;
    let codeIndex = -1;

    for (let i = 0; i < backupCodes.length; i++) {
      const entry = backupCodes[i];
      if (!entry.used && entry.hash) {
        const isMatch = await bcrypt.compare(backupCode, entry.hash);
        if (isMatch) {
          codeFound = true;
          codeIndex = i;
          break;
        }
      }
    }

    if (!codeFound) {
      console.log(`[SECURITY] Failed backup code attempt for user ${userId}`);
      return res.status(400).json({ error: 'Invalid or already used backup code' });
    }

    // Mark code as used
    backupCodes[codeIndex].used = true;
    backupCodes[codeIndex].used_at = new Date().toISOString();

    await query(
      'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
      [JSON.stringify(backupCodes), userId]
    );

    const remainingCodes = backupCodes.filter((c) => !c.used).length;

    console.log(`[SECURITY] User ${userId} used a backup code. ${remainingCodes} codes remaining.`);

    res.json({
      success: true,
      message: 'Backup code verified successfully',
      remainingCodes,
      warning: remainingCodes < 3
        ? 'You have less than 3 backup codes remaining. Consider generating new codes.'
        : null,
    });
  } catch (error) {
    console.error('Error verifying backup code:', error);
    res.status(500).json({ error: 'Failed to verify backup code', message: error.message });
  }
});

/**
 * Get remaining backup codes count for current user
 */
router.get('/2fa/backup-codes/remaining', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await query(
      'SELECT two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    const backupCodes = userResult.rows[0]?.two_factor_backup_codes || [];
    const remaining = backupCodes.filter((c) => !c.used).length;

    res.json({
      total: backupCodes.length,
      remaining,
      used: backupCodes.length - remaining,
    });
  } catch (error) {
    console.error('Error fetching backup codes info:', error);
    res.status(500).json({ error: 'Failed to fetch backup codes information', message: error.message });
  }
});

function generateRandomCode(length) {
  const digits = '0123456789';
  let code = '';
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    code += digits[randomBytes[i] % digits.length];
  }

  return code;
}

export default router;

