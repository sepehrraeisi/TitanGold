'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

const WRITE_ROLES = new Set(['admin', 'trader']);

/** Canonical JWT secret — must match backend token issuer (PM2 / process env). */
function resolveJwtSecret() {
    if (process.env.JWT_SECRET) {
        return process.env.JWT_SECRET;
    }
    const backendEnvPath = path.resolve(__dirname, '../../backend/.env');
    if (fs.existsSync(backendEnvPath)) {
        const parsed = dotenv.parse(fs.readFileSync(backendEnvPath));
        if (parsed.JWT_SECRET) {
            return parsed.JWT_SECRET;
        }
    }
    return null;
}

function extractToken(req) {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
        return auth.slice(7);
    }
    const internal = req.headers['x-collector-service-token'];
    if (
        internal &&
        process.env.COLLECTOR_SERVICE_TOKEN &&
        internal === process.env.COLLECTOR_SERVICE_TOKEN
    ) {
        return '__internal__';
    }
    return null;
}

function logDenied(req, reason, userId, detail) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const extra = detail ? ` detail=${detail}` : '';
    console.warn(
        `[collector-auth] DENY ${req.method} ${req.path} reason=${reason} user=${userId || 'none'} ip=${ip}${extra}`,
    );
}

function requireCollectorWrite(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        logDenied(req, 'missing_token');
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (token === '__internal__') {
        req.collectorUser = { id: 'service', role: 'admin', internal: true };
        return next();
    }

    const secret = resolveJwtSecret();
    if (!secret) {
        console.error('[collector-auth] JWT_SECRET not configured (backend/.env missing JWT_SECRET)');
        return res.status(503).json({ success: false, error: 'Auth not configured' });
    }

    try {
        const decoded = jwt.verify(token, secret);
        const role = String(decoded.role || 'trader').toLowerCase();
        if (!WRITE_ROLES.has(role)) {
            logDenied(req, 'forbidden_role', decoded.userId || decoded.id, `role=${role}`);
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }

        req.collectorUser = {
            id: decoded.userId || decoded.id,
            role,
            email: decoded.email,
        };
        return next();
    } catch (err) {
        const reason =
            err.name === 'TokenExpiredError'
                ? 'token_expired'
                : err.name === 'JsonWebTokenError'
                  ? 'invalid_signature'
                  : 'invalid_token';
        logDenied(req, reason, undefined, err.message);
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

module.exports = {
    WRITE_ROLES,
    requireCollectorWrite,
    resolveJwtSecret,
};
