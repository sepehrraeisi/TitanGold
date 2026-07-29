/**
 * ARBITRAGE-CORE — Manual scan idempotency (Redis with in-memory fallback).
 */

import { getRedisClient, isRedisAvailable } from '../utils/redis.js';
import { logger } from './logger.js';

export const ARBITRAGE_SCAN_IDEMPOTENCY_PREFIX = 'titan:arbitrage:scan_idempotency:';
export const ARBITRAGE_SCAN_IDEMPOTENCY_TTL_SEC = 300;

const memoryStore = new Map();

function cacheKey(agentId, idempotencyKey) {
  return `${ARBITRAGE_SCAN_IDEMPOTENCY_PREFIX}${agentId}:${idempotencyKey}`;
}

export async function readIdempotentScanResponse(agentId, idempotencyKey) {
  if (!idempotencyKey || !agentId) return null;

  if (process.env.NODE_ENV !== 'test' && isRedisAvailable()) {
    try {
      const client = await getRedisClient();
      const raw = await client.get(cacheKey(agentId, idempotencyKey));
      if (raw) return JSON.parse(raw);
    } catch (err) {
      logger.warn('arbitrage_scan_idempotency_read_failed', { error: err.message });
    }
  }

  const entry = memoryStore.get(cacheKey(agentId, idempotencyKey));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(cacheKey(agentId, idempotencyKey));
    return null;
  }
  return entry.payload;
}

export async function storeIdempotentScanResponse(
  agentId,
  idempotencyKey,
  payload,
  ttlSec = ARBITRAGE_SCAN_IDEMPOTENCY_TTL_SEC,
) {
  if (!idempotencyKey || !agentId || !payload) return;

  const serialized = JSON.stringify(payload);

  if (process.env.NODE_ENV !== 'test' && isRedisAvailable()) {
    try {
      const client = await getRedisClient();
      await client.set(cacheKey(agentId, idempotencyKey), serialized, { EX: ttlSec });
      return;
    } catch (err) {
      logger.warn('arbitrage_scan_idempotency_store_failed', { error: err.message });
    }
  }

  memoryStore.set(cacheKey(agentId, idempotencyKey), {
    payload,
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

export function resetIdempotencyStoreForTests() {
  memoryStore.clear();
}
