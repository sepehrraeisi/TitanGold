import { getRedisClient, isRedisAvailable } from '../utils/redis.js';
import { logger } from './logger.js';

const DEFAULT_TTL_MS = 45_000;

/** @type {Map<string, { expiresAt: number, staleUntil: number, value: unknown }>} */
const store = new Map();
/** @type {Map<string, Promise<unknown>>} */
const refreshes = new Map();

function nowPlus(ms) {
  return Date.now() + ms;
}

function cacheEnvelope(value, ttlMs) {
  return {
    value,
    expiresAt: nowPlus(ttlMs),
    staleUntil: nowPlus(ttlMs * 4),
  };
}

async function readRedisCache(key) {
  if (process.env.NODE_ENV === 'test') return null;
  if (!isRedisAvailable()) return null;
  try {
    const client = await getRedisClient();
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    logger.warn('PIPELINE_CACHE_REDIS_READ_SKIPPED', { key, error: error.message });
    return null;
  }
}

async function writeRedisCache(key, envelope) {
  if (process.env.NODE_ENV === 'test') return;
  if (envelope.value instanceof Map) return;
  try {
    const client = await getRedisClient();
    const ttlSeconds = Math.max(1, Math.ceil((envelope.staleUntil - Date.now()) / 1000));
    await client.set(key, JSON.stringify(envelope), { EX: ttlSeconds });
  } catch (error) {
    logger.warn('PIPELINE_CACHE_REDIS_WRITE_SKIPPED', { key, error: error.message });
  }
}

function refreshInBackground(key, loader, ttlMs) {
  if (refreshes.has(key)) return;
  const refresh = loader()
    .then(async (value) => {
      const envelope = cacheEnvelope(value, ttlMs);
      store.set(key, envelope);
      writeRedisCache(key, envelope);
      return value;
    })
    .catch((error) => {
      logger.warn('PIPELINE_CACHE_REFRESH_FAILED', { key, error: error.message });
    })
    .finally(() => {
      refreshes.delete(key);
    });
  refreshes.set(key, refresh);
}

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {number} [ttlMs]
 * @returns {Promise<T>}
 */
export async function getOrLoadCached(key, loader, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    logger.info('PIPELINE_CACHE_HIT', { key, stale: false });
    return /** @type {T} */ (hit.value);
  }
  if (hit && hit.staleUntil > now) {
    logger.info('PIPELINE_CACHE_HIT', { key, stale: true });
    refreshInBackground(key, loader, ttlMs);
    return /** @type {T} */ (hit.value);
  }

  const redisHit = await readRedisCache(key);
  if (redisHit?.value && redisHit.staleUntil > now) {
    store.set(key, redisHit);
    if (redisHit.expiresAt > now) {
      logger.info('PIPELINE_CACHE_HIT', { key, stale: false, source: 'redis' });
      return /** @type {T} */ (redisHit.value);
    }
    logger.info('PIPELINE_CACHE_HIT', { key, stale: true, source: 'redis' });
    refreshInBackground(key, loader, ttlMs);
    return /** @type {T} */ (redisHit.value);
  }

  logger.info('PIPELINE_CACHE_MISS', { key });
  const inFlight = refreshes.get(key);
  const value = inFlight ? await inFlight : await loader();
  const envelope = cacheEnvelope(value, ttlMs);
  store.set(key, envelope);
  writeRedisCache(key, envelope);
  return value;
}

/** @param {string} [prefix] */
export function invalidatePipelineSnapshotCache(prefix = 'pipeline:') {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function clearPipelineSnapshotCache() {
  store.clear();
}
