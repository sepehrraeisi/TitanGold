import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';

const DB_UNAVAILABLE_CODES = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']);

function isDbUnavailableError(error) {
  if (!error) return false;
  if (DB_UNAVAILABLE_CODES.has(error.code)) return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('econnrefused') || msg.includes('timeout') || msg.includes('connection terminated');
}

function sanitizeAuthFailure(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Verify JWT and resolve user from database (Source of Truth for role).
 * Never elevates to privileged roles on failure.
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return sanitizeAuthFailure(res, 401, 'UNAUTHENTICATED', 'No token provided');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return sanitizeAuthFailure(res, 401, 'INVALID_TOKEN', 'Invalid token');
      }
      if (error.name === 'TokenExpiredError') {
        return sanitizeAuthFailure(res, 401, 'TOKEN_EXPIRED', 'Token expired');
      }
      throw error;
    }

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return sanitizeAuthFailure(res, 401, 'INVALID_TOKEN', 'Invalid token');
    }

    req.token = token;
    req.authResolutionFailed = false;

    try {
      const sessionResult = await query(
        'SELECT token FROM user_sessions WHERE token = $1 AND expires_at > NOW() LIMIT 1',
        [token],
      );

      const userResult = await query(
        'SELECT id, email, username, full_name, role, is_active FROM users WHERE id = $1 LIMIT 1',
        [userId],
      );

      if (userResult.rows.length === 0) {
        return sanitizeAuthFailure(res, 401, 'USER_NOT_FOUND', 'Invalid token');
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return sanitizeAuthFailure(res, 403, 'USER_DISABLED', 'Account is disabled');
      }

      // DB role is authoritative — ignore elevated JWT role claims
      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
      };

      if (sessionResult.rows.length > 0) {
        await query(
          'UPDATE user_sessions SET last_activity_at = NOW() WHERE token = $1',
          [token],
        ).catch(() => {});
      }

      return next();
    } catch (dbError) {
      if (isDbUnavailableError(dbError)) {
        logger.warn('⚠️ Database unavailable during authentication');
        req.authResolutionFailed = true;
        req.authResolutionStatus = 503;
        req.authResolutionCode = 'AUTH_DB_UNAVAILABLE';
        // Minimal identity for optional read paths — sensitive routes must use requireStrictAuth
        req.user = {
          id: userId,
          email: decoded.email || null,
          username: decoded.username || null,
          full_name: decoded.full_name || decoded.name || null,
          role: 'user',
          is_active: false,
          _unverified: true,
        };
        return next();
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('Authentication error:', error.message);
    return sanitizeAuthFailure(res, 500, 'AUTH_FAILED', 'Authentication failed');
  }
};

/** Fail closed when DB identity could not be verified */
export const authenticateStrict = async (req, res, next) => {
  await authenticate(req, res, () => {
    if (req.authResolutionFailed) {
      return sanitizeAuthFailure(res, 503, 'AUTH_DB_UNAVAILABLE', 'Identity verification temporarily unavailable');
    }
    if (!req.user?.is_active) {
      return sanitizeAuthFailure(res, 403, 'USER_DISABLED', 'Account is disabled');
    }
    next();
  });
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sanitizeAuthFailure(res, 401, 'UNAUTHENTICATED', 'Not authenticated');
    }
    if (req.authResolutionFailed) {
      return sanitizeAuthFailure(res, 503, 'AUTH_DB_UNAVAILABLE', 'Identity verification temporarily unavailable');
    }
    if (!roles.includes(req.user.role)) {
      return sanitizeAuthFailure(res, 403, 'INSUFFICIENT_PERMISSIONS', 'Insufficient permissions');
    }
    next();
  };
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userResult = await query(
      'SELECT id, email, username, full_name, role FROM users WHERE id = $1 AND is_active = TRUE',
      [decoded.userId || decoded.id],
    );
    if (userResult.rows.length > 0) {
      req.user = userResult.rows[0];
    }
    next();
  } catch {
    next();
  }
};
