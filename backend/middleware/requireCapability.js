/**
 * Capability authorization middleware — DB-verified identity required.
 */

import { roleHasCapability } from '../services/capabilities.js';

function deny(res, status, code, message, extra = {}) {
  return res.status(status).json({ error: message, code, ...extra });
}

export function requireCapability(...capabilities) {
  return (req, res, next) => {
    if (!req.user?.id) {
      return deny(res, 401, 'UNAUTHENTICATED', 'Not authenticated');
    }

    if (req.authResolutionFailed) {
      return deny(res, 503, 'AUTH_DB_UNAVAILABLE', 'Identity verification temporarily unavailable');
    }

    if (!req.user.is_active) {
      return deny(res, 403, 'USER_DISABLED', 'Account is disabled');
    }

    const role = req.user.role;
    const allowed = capabilities.some((cap) => roleHasCapability(role, cap));

    if (!allowed) {
      return deny(res, 403, 'CAPABILITY_DENIED', 'Insufficient permissions', {
        capability: capabilities[0],
      });
    }

    next();
  };
}

export function requireStrictAuth(req, res, next) {
  if (!req.user?.id) {
    return deny(res, 401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  if (req.authResolutionFailed) {
    return deny(res, 503, 'AUTH_DB_UNAVAILABLE', 'Identity verification temporarily unavailable');
  }
  if (!req.user.is_active) {
    return deny(res, 403, 'USER_DISABLED', 'Account is disabled');
  }
  next();
}
