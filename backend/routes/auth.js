import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../database/db.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../services/logger.js';
import { validateBody, validateResponse } from '../middleware/validation.js';
import { registerBodySchema, loginBodySchema, authResponseSchema } from '../schemas/authSchemas.js';

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
  );
};

// ============================================================================
// REGISTER
// ============================================================================

router.post('/register', validateBody(registerBodySchema), validateResponse(authResponseSchema), async (req, res) => {
  try {
    const { email, username, password, full_name } = req.validatedBody;

    // Check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and initial settings in transaction
    const result = await transaction(async (client) => {
      // Insert user
      const userResult = await client.query(
        `INSERT INTO users (email, username, password_hash, full_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, username, full_name, role, created_at`,
        [email, username, passwordHash, full_name || username]
      );

      const user = userResult.rows[0];

      // Create default settings
      await client.query(
        `INSERT INTO user_settings (user_id) VALUES ($1)`,
        [user.id]
      );

      // Create default portfolio
      await client.query(
        `INSERT INTO portfolios (user_id, name, is_main, base_currency)
         VALUES ($1, $2, TRUE, 'USD')`,
        [user.id, 'Main Portfolio']
      );

      return user;
    });

    // Generate tokens
    const token = generateToken(result.id);
    const refreshToken = generateRefreshToken(result.id);

    // Save session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await query(
      `INSERT INTO user_sessions (user_id, token, refresh_token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [result.id, token, refreshToken, expiresAt, req.ip, req.headers['user-agent']]
    );

    res.status(201).json({
      user: result,
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// ============================================================================
// LOGIN
// ============================================================================

router.post('/login', validateBody(loginBodySchema), validateResponse(authResponseSchema), async (req, res) => {
  try {
    const { username, password } = req.validatedBody;

    // Find user by username or email
    const userResult = await query(
      `SELECT id, email, username, full_name, password_hash, role, created_at
       FROM users 
       WHERE (username = $1 OR email = $1)`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Save session
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await query(
      `INSERT INTO user_sessions (user_id, token, refresh_token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, token, refreshToken, expiresAt, req.ip, req.headers['user-agent']]
    );

    // Update last login
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      user,
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// ============================================================================
// LOGOUT
// ============================================================================

router.post('/logout', authenticate, async (req, res) => {
  try {
    await query(
      'DELETE FROM user_sessions WHERE token = $1',
      [req.token]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ============================================================================
// REFRESH TOKEN
// ============================================================================

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    // Check if session exists
    const sessionResult = await query(
      'SELECT user_id FROM user_sessions WHERE refresh_token = $1',
      [refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userId = sessionResult.rows[0].user_id;

    // Generate new tokens
    const newToken = generateToken(userId);
    const newRefreshToken = generateRefreshToken(userId);

    // Update session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `UPDATE user_sessions 
       SET token = $1, refresh_token = $2, expires_at = $3, last_activity_at = NOW()
       WHERE refresh_token = $4`,
      [newToken, newRefreshToken, expiresAt, refreshToken]
    );

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// ============================================================================
// GET CURRENT USER
// ============================================================================

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.username, u.full_name, u.phone, u.avatar_url, 
              u.role, u.created_at, u.last_login_at,
              s.theme, s.language, s.currency
       FROM users u
       LEFT JOIN user_settings s ON u.id = s.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { getCapabilitiesForRole } = await import('../services/capabilities.js');
    res.json({
      ...result.rows[0],
      capabilities: getCapabilitiesForRole(result.rows[0].role),
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.get('/capabilities', authenticate, async (req, res) => {
  const { getCapabilitiesForRole } = await import('../services/capabilities.js');
  res.json({
    role: req.user.role,
    capabilities: getCapabilitiesForRole(req.user.role),
  });
});

export default router;
