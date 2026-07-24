/**
 * Resolve CORS allowed origins for TitanGold backend.
 * Staging deploy must accept the public Staging origin even when PM2 loses .env CORS.
 */

const LOCALHOST_DEFAULTS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

/** Canonical public Staging frontend origin (browser login). */
export const STAGING_PUBLIC_ORIGIN = 'https://titan.zala.ir';

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/$/, '');
}

function parseOriginList(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]}
 */
export function resolveCorsAllowedOrigins(env = process.env) {
  const merged = [];

  for (const origin of parseOriginList(env.CORS_ALLOWED_ORIGINS)) {
    merged.push(origin);
  }

  // Legacy alias still present in some Staging .env files.
  for (const origin of parseOriginList(env.CORS_ORIGIN)) {
    merged.push(origin);
  }

  if (merged.length === 0) {
    merged.push(...LOCALHOST_DEFAULTS.map(normalizeOrigin));
  }

  if (env.TITAN_DEPLOY_ENV === 'staging') {
    merged.push(normalizeOrigin(STAGING_PUBLIC_ORIGIN));
  }

  return [...new Set(merged)];
}

/**
 * @param {string} origin
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isOriginAllowed(origin, env = process.env) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  const allowed = resolveCorsAllowedOrigins(env);
  return allowed.includes(normalized);
}
