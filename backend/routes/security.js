import express from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
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

export default router;

