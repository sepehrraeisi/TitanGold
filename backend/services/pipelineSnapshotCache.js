/**
 * Short TTL in-memory cache for read-heavy pipeline snapshots (DH-PIPELINE-P2).
 */

const DEFAULT_TTL_MS = 45_000;

/** @type {Map<string, { expiresAt: number, value: unknown }>} */
const store = new Map();

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
    return /** @type {T} */ (hit.value);
  }
  const value = await loader();
  store.set(key, { expiresAt: now + ttlMs, value });
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
