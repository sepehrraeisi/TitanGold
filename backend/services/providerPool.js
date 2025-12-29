/**
 * Provider Pool Service - DB-driven Provider Management
 * 
 * Features:
 * - Load balancing (round-robin + least-recently-used)
 * - Circuit breaker (auto-disable failed providers)
 * - Health tracking per integration
 * - Quota/rate-limit detection
 * - Multi-key support per provider
 */

import { query } from '../database/db.js';

const STATUS = {
  HEALTHY: 'healthy',
  DISABLED: 'disabled',
  RATE_LIMITED: 'rate_limited',
  QUOTA_EXHAUSTED: 'quota_exhausted',
  AUTH_FAILED: 'auth_failed',
  TIMEOUT: 'timeout',
};

function now() { return new Date(); }
function addMs(ms) { return new Date(Date.now() + ms); }

/**
 * Classify error and determine cooldown strategy
 */
function classifyError(err) {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status || err?.response?.status;

  // Auth failures
  if (status === 401 || status === 403 || msg.includes('invalid api key') || msg.includes('unauthorized')) {
    return { status: STATUS.AUTH_FAILED, cooldownMs: 24 * 60 * 60 * 1000 }; // 24h
  }

  // Rate limit / throttling
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return { status: STATUS.RATE_LIMITED, cooldownMs: 2 * 60 * 1000 }; // 2m
  }

  // Quota exhausted / billing
  if (msg.includes('insufficient_quota') || msg.includes('quota') || msg.includes('billing') || msg.includes('exceeded')) {
    return { status: STATUS.QUOTA_EXHAUSTED, cooldownMs: 6 * 60 * 60 * 1000 }; // 6h
  }

  // Timeout
  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('abort')) {
    return { status: STATUS.TIMEOUT, cooldownMs: 30 * 1000 }; // 30s
  }

  // Unknown -> small cooldown (avoid hot looping)
  return { status: STATUS.TIMEOUT, cooldownMs: 20 * 1000 };
}

/**
 * Get all active provider instances
 * Active = enabled + not disabled + cooldown passed
 */
export async function getProviderInstances({ provider = null } = {}) {
  const params = [];
  let where = `i.enabled = true`;
  if (provider) {
    params.push(provider);
    where += ` AND i.provider = $${params.length}`;
  }

  // Select instances that are active and past cooldown
  const sql = `
    SELECT
      i.id,
      i.provider,
      i.name,
      i.api_key_encrypted,
      i.base_url,
      COALESCE(i.model, '') AS model,
      COALESCE(i.weight, 1.0)::float AS weight,
      i.rate_limit_per_min,
      i.daily_budget,
      i.monthly_budget,
      i.metadata,
      r.status,
      r.cooldown_until,
      r.fail_count,
      r.success_count,
      r.total_requests,
      r.total_cost,
      r.last_used_at
    FROM api_integrations i
    LEFT JOIN api_integration_runtime r ON r.integration_id = i.id
    WHERE ${where}
      AND COALESCE(r.status, 'healthy') != 'disabled'
      AND (r.cooldown_until IS NULL OR r.cooldown_until <= NOW())
    ORDER BY
      COALESCE(r.last_used_at, '1970-01-01') ASC,
      COALESCE(r.fail_count, 0) ASC,
      COALESCE(i.weight, 1.0) DESC
  `;
  const res = await query(sql, params);
  return res.rows || [];
}

/**
 * Pick best instance for a provider (load balancing)
 * Strategy: least-recently-used + lowest fail_count + highest weight
 */
export async function pickProviderInstance(provider) {
  const instances = await getProviderInstances({ provider });
  if (!instances.length) return null;

  // First in list is already optimal (ordered by query)
  const chosen = instances[0];

  // Update usage tracking
  await query(
    `UPDATE api_integration_runtime
     SET last_used_at = NOW(),
         total_requests = COALESCE(total_requests, 0) + 1,
         updated_at = NOW()
     WHERE integration_id = $1`,
    [chosen.id]
  );

  return chosen;
}

/**
 * Record successful provider call
 * Resets fail_count and ensures healthy status
 */
export async function recordProviderSuccess(integrationId) {
  await query(
    `UPDATE api_integration_runtime
     SET status = 'healthy',
         fail_count = 0,
         success_count = COALESCE(success_count, 0) + 1,
         updated_at = NOW()
     WHERE integration_id = $1`,
    [integrationId]
  );
}

/**
 * Record provider failure and apply circuit breaker
 * Automatically sets cooldown based on error type
 */
export async function recordProviderFailure(integrationId, err) {
  const { status, cooldownMs } = classifyError(err);
  const cooldownUntil = addMs(cooldownMs);
  const message = (err?.message || 'unknown error').slice(0, 500);

  console.log(`⚠️ Provider failure: ${status}, cooldown ${cooldownMs}ms`);

  await query(
    `UPDATE api_integration_runtime
     SET status = $2,
         cooldown_until = $3,
         last_error = $4,
         fail_count = COALESCE(fail_count, 0) + 1,
         updated_at = NOW()
     WHERE integration_id = $1`,
    [integrationId, status, cooldownUntil, message]
  );

  return { status, cooldownUntil };
}

/**
 * Calculate quorum (minimum responses needed)
 * Quorum = max(2, 40% of total instances)
 */
export function getQuorum(totalInstances) {
  return Math.max(2, Math.ceil(totalInstances * 0.4));
}

/**
 * Get provider health summary
 */
export async function getProviderHealth() {
  const sql = `
    SELECT
      i.provider,
      COUNT(*) AS total_keys,
      COUNT(*) FILTER (WHERE r.status = 'healthy' AND (r.cooldown_until IS NULL OR r.cooldown_until <= NOW())) AS healthy_keys,
      COUNT(*) FILTER (WHERE i.enabled = true) AS enabled_keys,
      SUM(COALESCE(r.success_count, 0)) AS total_successes,
      SUM(COALESCE(r.fail_count, 0)) AS total_failures
    FROM api_integrations i
    LEFT JOIN api_integration_runtime r ON r.integration_id = i.id
    GROUP BY i.provider
  `;
  const res = await query(sql);
  return res.rows || [];
}

export { STATUS };
