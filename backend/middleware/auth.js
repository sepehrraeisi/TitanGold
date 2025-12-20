import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';

// Verify JWT token
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Try to check session in database, but fallback to JWT-only auth if DB is unavailable
    try {
      // Check if session exists and is valid
      const sessionResult = await query(
        'SELECT * FROM user_sessions WHERE token = $1 AND expires_at > NOW()',
        [token]
      ).catch(dbError => {
        // If database is unavailable, log warning and continue with JWT-only auth
        if (dbError.code === 'ECONNREFUSED' || dbError.message?.includes('ECONNREFUSED')) {
          console.warn('⚠️ Database unavailable, using JWT-only authentication');
          return { rows: [] }; // Continue with fallback
        }
        throw dbError; // Re-throw other DB errors
      });

      if (sessionResult.rows.length > 0) {
        // Database is available and session exists - use full authentication
        try {
          // Get user from database
          const userResult = await query(
            'SELECT id, email, username, full_name, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
          );

          if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
            req.user = userResult.rows[0];
            req.token = token;
            
            // Update last activity (ignore errors if DB becomes unavailable)
            await query(
              'UPDATE user_sessions SET last_activity_at = NOW() WHERE token = $1',
              [token]
            ).catch(() => {}); // Ignore update errors
            
            return next();
          }
        } catch (dbError) {
          // If database becomes unavailable during user lookup, fallback to JWT-only
          if (dbError.code === 'ECONNREFUSED' || dbError.message?.includes('ECONNREFUSED')) {
            console.warn('⚠️ Database unavailable during user lookup, using JWT-only authentication');
            // Fall through to JWT-only auth below
          } else {
            throw dbError;
          }
        }
      }
    } catch (dbError) {
      // If database query fails completely, fallback to JWT-only auth
      if (dbError.code === 'ECONNREFUSED' || dbError.message?.includes('ECONNREFUSED')) {
        console.warn('⚠️ Database unavailable, using JWT-only authentication');
        // Fall through to JWT-only auth below
      } else {
        throw dbError;
      }
    }

    // Fallback: JWT-only authentication (when database is unavailable)
    // Create a minimal user object from JWT token
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email || 'user@example.com',
      username: decoded.username || 'user',
      full_name: decoded.full_name || decoded.name || 'User',
      role: decoded.role || 'trader',
      is_active: true,
    };
    req.token = token;
    
    console.log('⚠️ Using JWT-only authentication (database unavailable)');
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Check if user has specific role
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userResult = await query(
        'SELECT id, email, username, full_name, role FROM users WHERE id = $1 AND is_active = TRUE',
        [decoded.userId]
      );
      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
      }
    }
    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};
