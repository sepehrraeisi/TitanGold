/**
 * Shared Redis + in-memory cache for Telegram analytics read endpoints (P5).
 * Uses stale-while-revalidate; safe fallback when Redis is unavailable.
 */
import { getOrLoadCached } from './pipelineSnapshotCache.js';

export const TELEGRAM_ANALYTICS_CACHE_VERSION = 'v1';
const PREFIX = `tg:analytics:${TELEGRAM_ANALYTICS_CACHE_VERSION}:`;

export const TELEGRAM_CACHE_TTL = {
    health: 30_000,
    agentsSummary: 60_000,
    categoriesSummary: 60_000,
    breakingNews: 45_000,
    eventsRecent: 45_000,
    geographicSummary: 45_000,
    agentFeed: 60_000,
};

/**
 * Build deterministic cache key segments from endpoint + query params.
 * @param {string} endpoint
 * @param {Record<string, string | number | boolean | null | undefined>} params
 */
export function buildTelegramCacheKey(endpoint, params = {}) {
    const sorted = Object.keys(params)
        .sort()
        .map(k => {
            const v = params[k];
            if (v === undefined || v === null || v === '') return null;
            return `${k}=${String(v)}`;
        })
        .filter(Boolean)
        .join('&');
    return `${PREFIX}${endpoint}${sorted ? `?${sorted}` : ''}`;
}

/**
 * @template T
 * @param {string} endpoint
 * @param {Record<string, string | number | boolean | null | undefined>} params
 * @param {() => Promise<T>} loader
 * @param {number} ttlMs
 */
export async function getTelegramAnalyticsCached(endpoint, params, loader, ttlMs) {
    const key = buildTelegramCacheKey(endpoint, params);
    return getOrLoadCached(key, loader, ttlMs);
}
