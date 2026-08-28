/**
 * Canonical five-surface health validator for T2 forward + rollback proofs.
 * Surfaces (all must equal HTTP 200):
 * - backend 5002 /health
 * - collector 5003 /health
 * - collector functional /api/telegram-collector/health
 * - accounts
 * - channels
 *
 * Pure: no network I/O. Callers fetch status codes then validate.
 */

/**
 * @param {{
 *   status5002?: unknown,
 *   status5003?: unknown,
 *   collectorHealth?: unknown,
 *   accounts?: unknown,
 *   channels?: unknown,
 * }} input
 * @returns {{
 *   ok: boolean,
 *   error?: string,
 *   surfaces: Record<string, string>,
 *   CURRENT_FULL_REQUIRED_HEALTH: string,
 *   CURRENT_HEALTH_5002: unknown,
 *   CURRENT_HEALTH_5003: unknown,
 *   CURRENT_COLLECTOR_HEALTH: unknown,
 *   CURRENT_ACCOUNTS: unknown,
 *   CURRENT_CHANNELS: unknown,
 * }}
 */
export function validateRequiredHealth(input = {}) {
  const status5002 = input.status5002;
  const status5003 = input.status5003;
  const collectorHealth = input.collectorHealth;
  const accounts = input.accounts;
  const channels = input.channels;

  const surfaces = {
    HEALTH_5002: status5002 === 200 ? 'PASS' : 'FAIL',
    HEALTH_5003: status5003 === 200 ? 'PASS' : 'FAIL',
    COLLECTOR_HEALTH: collectorHealth === 200 ? 'PASS' : 'FAIL',
    ACCOUNTS: accounts === 200 ? 'PASS' : 'FAIL',
    CHANNELS: channels === 200 ? 'PASS' : 'FAIL',
  };

  let error;
  if (status5002 !== 200) error = 'HEALTH_5002_FAIL';
  else if (status5003 !== 200) error = 'HEALTH_5003_FAIL';
  else if (collectorHealth !== 200) error = 'COLLECTOR_HEALTH_FAIL';
  else if (accounts !== 200) error = 'ACCOUNTS_FAIL';
  else if (channels !== 200) error = 'CHANNELS_FAIL';

  const ok = !error;
  return {
    ok,
    error: ok ? undefined : error,
    surfaces,
    CURRENT_FULL_REQUIRED_HEALTH: ok ? 'PASS' : 'FAIL',
    CURRENT_HEALTH_5002: status5002,
    CURRENT_HEALTH_5003: status5003,
    CURRENT_COLLECTOR_HEALTH: collectorHealth,
    CURRENT_ACCOUNTS: accounts,
    CURRENT_CHANNELS: channels,
  };
}

/**
 * Map validateRequiredHealth errors to rollback-scoped codes.
 * @param {string|undefined} error
 */
export function toRollbackHealthError(error) {
  switch (error) {
    case 'HEALTH_5002_FAIL':
      return 'ROLLBACK_HEALTH_5002_FAIL';
    case 'HEALTH_5003_FAIL':
      return 'ROLLBACK_HEALTH_5003_FAIL';
    case 'COLLECTOR_HEALTH_FAIL':
      return 'ROLLBACK_COLLECTOR_HEALTH_FAIL';
    case 'ACCOUNTS_FAIL':
      return 'ROLLBACK_ACCOUNTS_FAIL';
    case 'CHANNELS_FAIL':
      return 'ROLLBACK_CHANNELS_FAIL';
    case 'HEALTH_READ_FAIL':
      return 'ROLLBACK_HEALTH_READ_FAIL';
    default:
      return error || 'ROLLBACK_HEALTH_FAIL';
  }
}
