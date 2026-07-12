/**
 * Capability authorization middleware — uses DB-resolved role only.
 */

import { roleHasCapability } from '../services/capabilities.js';

export function requireCapability(...capabilities) {
  return (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Not authenticated',
        code: 'UNAUTHENTICATED',
      });
    }

    if (req.authResolutionFailed) {
      return res.status(req.authResolutionStatus || 503).json({
        error: 'Identity could not be verified',
        code: req.authResolutionCode || 'AUTH_UNAVAILABLE',
      });
    }

    const role = req.user.role;
    const allowed = capabilities.some((cap) => roleHasCapability(role, cap));

    if (!allowed) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'CAPABILITY_DENIED',
        capability: capabilities[0],
      });
    }

    next();
  };
}

export function requireStrictAuth(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }
  if (req.authResolutionFailed) {
    return res.status(req.authResolutionStatus || 503).json({
      error: 'Identity could not be verified',
      code: req.authResolutionCode || 'AUTH_UNAVAILABLE',
    });
  }
  next();
}
