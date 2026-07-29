/**
 * ARBITRAGE-CORE — Scan concurrency lock (Redis with in-memory fallback).
 */

import { getRedisClient, isRedisAvailable } from '../utils/redis.js';
import { logger } from './logger.js';

export const ARBITRAGE_SCAN_LOCK_KEY_PREFIX = 'titan:arbitrage:scan_lock:';
export const ARBITRAGE_SCAN_LOCK_TTL_SEC = 120;

const memoryLocks = new Map();

function lockKey(agentId) {
  return `${ARBITRAGE_SCAN_LOCK_KEY_PREFIX}${agentId}`;
}

export async function acquireScanLock({
  agentId,
  owner,
  trigger = 'manual',
  ttlSec = ARBITRAGE_SCAN_LOCK_TTL_SEC,
}) {
  const payload = JSON.stringify({
    owner,
    trigger,
    acquiredAt: new Date().toISOString(),
    pid: process.pid,
  });

  if (process.env.NODE_ENV !== 'test' && isRedisAvailable()) {
    try {
      const client = await getRedisClient();
      const key = lockKey(agentId);
      const result = await client.set(key, payload, { NX: true, EX: ttlSec });
      if (result === 'OK') {
        return { acquired: true, owner, key, backend: 'redis' };
      }
      const existing = await client.get(key);
      return {
        acquired: false,
        reason: 'scan_in_progress',
        existing: existing ? JSON.parse(existing) : null,
        backend: 'redis',
      };
    } catch (err) {
      logger.warn('arbitrage_scan_lock_redis_failed', { error: err.message });
    }
  }

  if (memoryLocks.has(agentId)) {
    return { acquired: false, reason: 'scan_in_progress', existing: memoryLocks.get(agentId), backend: 'memory' };
  }
  memoryLocks.set(agentId, { owner, trigger, acquiredAt: new Date().toISOString() });
  const timer = setTimeout(() => memoryLocks.delete(agentId), ttlSec * 1000);
  if (typeof timer.unref === 'function') timer.unref();
  return { acquired: true, owner, backend: 'memory' };
}

export async function releaseScanLock(agentId) {
  memoryLocks.delete(agentId);
  if (process.env.NODE_ENV === 'test' || !isRedisAvailable()) return;
  try {
    const client = await getRedisClient();
    await client.del(lockKey(agentId));
  } catch (err) {
    logger.warn('arbitrage_scan_lock_release_failed', { error: err.message });
  }
}

export async function withScanLock(agentId, owner, trigger, fn) {
  const lock = await acquireScanLock({ agentId, owner, trigger });
  if (!lock.acquired) {
    const err = new Error('An analytical scan is already running. Try again after it finishes.');
    err.code = 'ARBITRAGE_SCAN_IN_PROGRESS';
    err.status = 409;
    throw err;
  }
  try {
    return await fn();
  } finally {
    await releaseScanLock(agentId);
  }
}

export function resetMemoryLocksForTests() {
  memoryLocks.clear();
}
