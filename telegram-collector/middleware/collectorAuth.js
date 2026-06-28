'use strict';

const jwt = require('jsonwebtoken');

const WRITE_ROLES = new Set(['admin', 'trader']);

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

function logDenied(req, reason, userId) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    console.warn(
        `[collector-auth] DENY ${req.method} ${req.path} reason=${reason} user=${userId || 'none'} ip=${ip}`,
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

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('[collector-auth] JWT_SECRET not configured');
            return res.status(503).json({ success: false, error: 'Auth not configured' });
        }

        const decoded = jwt.verify(token, secret);
        const role = String(decoded.role || 'trader').toLowerCase();
        if (!WRITE_ROLES.has(role)) {
            logDenied(req, 'forbidden_role', decoded.userId || decoded.id);
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }

        req.collectorUser = {
            id: decoded.userId || decoded.id,
            role,
            email: decoded.email,
        };
        return next();
    } catch (_err) {
        logDenied(req, 'invalid_token');
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

module.exports = {
    WRITE_ROLES,
    requireCollectorWrite,
};
