/**
 * Telegram analytics shared cache tests (P5).
 */
import { describe, it, expect } from '@jest/globals';
import {
    buildTelegramCacheKey,
    TELEGRAM_ANALYTICS_CACHE_VERSION,
    TELEGRAM_CACHE_TTL,
} from '../../services/telegramAnalyticsCache.js';

describe('telegramAnalyticsCache P5', () => {
    it('builds versioned deterministic cache keys', () => {
        const key = buildTelegramCacheKey('agents/summary', { timeRange: 24, limit: 15 });
        expect(key).toContain(`tg:analytics:${TELEGRAM_ANALYTICS_CACHE_VERSION}:`);
        expect(key).toContain('agents/summary');
        expect(key).toContain('limit=15');
        expect(key).toContain('timeRange=24');
    });

    it('defines TTLs for all analytics endpoints', () => {
        expect(TELEGRAM_CACHE_TTL.health).toBeGreaterThan(0);
        expect(TELEGRAM_CACHE_TTL.agentsSummary).toBe(60_000);
        expect(TELEGRAM_CACHE_TTL.agentFeed).toBe(60_000);
        expect(TELEGRAM_CACHE_TTL.geographicSummary).toBeGreaterThan(0);
    });
});
