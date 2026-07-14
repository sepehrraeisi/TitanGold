const SENSITIVE_QUERY_KEYS = [
  'token',
  'access_token',
  'refresh_token',
  'auth',
  'authorization',
  'jwt',
  'api_key',
  'apikey',
  'secret',
] as const;

const JWT_LIKE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

/**
 * Redact sensitive query params from URLs (http/ws absolute or path-only).
 */
export function redactSensitiveUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  const input = String(raw);

  return input
    .replace(
      /([?&](?:token|access_token|refresh_token|auth|authorization|jwt|api_key|apikey|secret)=)([^&#]*)/gi,
      '$1[REDACTED]',
    )
    .replace(JWT_LIKE, '[REDACTED_JWT]');
}

/**
 * Redact JWTs and Authorization-like values from arbitrary strings/objects for logs.
 */
export function redactSensitiveText(raw: string | null | undefined): string {
  if (!raw) return '';
  return redactSensitiveUrl(String(raw))
    .replace(JWT_LIKE, '[REDACTED_JWT]')
    .replace(
      /(Authorization["']?\s*[:=]\s*["']?Bearer\s+)[A-Za-z0-9._-]+/gi,
      '$1[REDACTED]',
    );
}

export function containsRawJwt(raw: string | null | undefined): boolean {
  if (!raw) return false;
  JWT_LIKE.lastIndex = 0;
  return JWT_LIKE.test(String(raw));
}

/** @deprecated keys kept for documentation / future structured redaction */
export const _SENSITIVE_QUERY_KEYS = SENSITIVE_QUERY_KEYS;
