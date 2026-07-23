/**
 * CONNECTIONS-WP1A minimal safe error taxonomy.
 * Provider-specific auth categories belong primarily to WP2.
 */

export const CONNECTION_ERROR = Object.freeze({
  APP_SESSION_EXPIRED: 'APP_SESSION_EXPIRED',
  APP_FORBIDDEN: 'APP_FORBIDDEN',
  CONNECTION_VALIDATION_FAILED: 'CONNECTION_VALIDATION_FAILED',
  CONNECTION_NOT_CONFIGURED: 'CONNECTION_NOT_CONFIGURED',
  CONNECTION_UNTESTED: 'CONNECTION_UNTESTED',
  CONNECTION_PROVIDER_UNSUPPORTED: 'CONNECTION_PROVIDER_UNSUPPORTED',
  CONNECTION_SECRET_REENTRY_REQUIRED: 'CONNECTION_SECRET_REENTRY_REQUIRED',
  CONNECTION_INTERNAL_ERROR: 'CONNECTION_INTERNAL_ERROR',
});

export const CREDENTIAL_STATUS = Object.freeze({
  NOT_CONFIGURED: 'not_configured',
  CONFIGURED_UNVERIFIED: 'configured_unverified',
  SECRET_REENTRY_REQUIRED: 'secret_reentry_required',
  AUTHENTICATION_PENDING: 'authentication_pending',
  AUTHENTICATED: 'authenticated',
});

export function connectionError(res, status, code, message, extra = {}) {
  return res.status(status).json({
    success: false,
    error: message,
    code,
    ...extra,
  });
}
