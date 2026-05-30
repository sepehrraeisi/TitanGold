import { authenticate } from './auth.js';
import { logger } from '../services/logger.js';

const VALID_MODES = ['auth-role', 'internal', 'dev-open'];

/** DB roles today: admin, trader, user, vip. analyst/viewer are future role-model gaps. */
const ALLOWED_READ_ROLES = ['admin', 'trader'];

export function resolveTelegramReadMode() {
  const explicit = process.env.TELEGRAM_READ_MODE?.trim().toLowerCase();
  if (explicit) {
    if (!VALID_MODES.includes(explicit)) {
      return { mode: null, error: 'invalid' };
    }
    return { mode: explicit, error: null };
  }
  const isProd = process.env.NODE_ENV === 'production';
  return { mode: isProd ? 'auth-role' : 'dev-open', error: null };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || '';
}

function isTrustedIp(req) {
  const allowlistRaw = process.env.INTERNAL_TRUSTED_IPS;
  if (!allowlistRaw?.trim()) return false;
  const clientIp = getClientIp(req);
  const allowed = allowlistRaw.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(clientIp);
}

function hasValidInternalSecret(req) {
  const secret = process.env.INTERNAL_TELEGRAM_SECRET;
  if (!secret) return false;
  const headerFlag = req.headers['x-internal-request'];
  const headerSecret = req.headers['x-internal-secret'];
  if (headerFlag !== 'true') return false;
  return headerSecret === secret;
}

function handleAuthRole(req, res, next) {
  return authenticate(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!ALLOWED_READ_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  });
}

function handleInternal(req, res, next) {
  const hasAllowlist = !!process.env.INTERNAL_TRUSTED_IPS?.trim();
  const hasSecret = !!process.env.INTERNAL_TELEGRAM_SECRET;
  if (!hasAllowlist && !hasSecret) {
    logger.error('TELEGRAM_READ_MODE=internal but neither INTERNAL_TRUSTED_IPS nor INTERNAL_TELEGRAM_SECRET is configured');
    return res.status(403).json({ error: 'Telegram read access not configured' });
  }
  if (isTrustedIp(req) || hasValidInternalSecret(req)) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}

function handleDevOpen(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('TELEGRAM_READ_MODE=dev-open is not allowed when NODE_ENV=production');
    return res.status(403).json({ error: 'Telegram read mode misconfigured' });
  }
  return next();
}

export const telegramReadAuth = (req, res, next) => {
  const { mode, error } = resolveTelegramReadMode();
  if (error === 'invalid') {
    logger.error(`Invalid TELEGRAM_READ_MODE: ${process.env.TELEGRAM_READ_MODE}`);
    return res.status(403).json({ error: 'Telegram read access misconfigured' });
  }
  switch (mode) {
    case 'auth-role':
      return handleAuthRole(req, res, next);
    case 'internal':
      return handleInternal(req, res, next);
    case 'dev-open':
      return handleDevOpen(req, res, next);
    default:
      logger.error('Telegram read auth: unresolved mode');
      return res.status(403).json({ error: 'Telegram read access misconfigured' });
  }
};
