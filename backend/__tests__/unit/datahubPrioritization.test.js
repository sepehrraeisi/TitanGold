/**
 * DH-SMARTPRIORITY-P2
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const __dirname = dirname(fileURLToPath(import.meta.url));
const enTranslations = JSON.parse(
    readFileSync(join(__dirname, '../../../deploy/blue/locales/en.json'), 'utf8'),
);

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
    transaction: mockTransaction,
}));

jest.unstable_mockModule('../../utils/prioritizationTelegramMetrics.js', () => ({
    batchTelegramPrioritizationMetrics: jest.fn(async () => new Map()),
}));

const {
    tierFromScore,
    computeScoresForSource,
    normalizeThresholds,
    telegramFreshnessFromLatestAt,
    telegramSuccessRate,
    telegramReliability,
    telegramErrorHealth,
    DEFAULT_TIER_MINIMUMS,
    DEFAULT_FACTOR_WEIGHTS,
} = await import('../../utils/prioritizationScoring.js');

const { applyPrioritization, getPrioritizationSettings } = await import(
    '../../services/datahubPrioritizationService.js'
);

describe('tierFromScore — configurable thresholds', () => {
    test('uses default minimums (25/50/75)', () => {
        expect(tierFromScore(10)).toBe('low');
        expect(tierFromScore(25)).toBe('medium');
        expect(tierFromScore(49)).toBe('medium');
        expect(tierFromScore(50)).toBe('high');
        expect(tierFromScore(74)).toBe('high');
        expect(tierFromScore(75)).toBe('critical');
    });

    test('uses settings.tier_thresholds from DB shape', () => {
        const thresholds = normalizeThresholds({ low: 40, high: 60, critical: 80 });
        expect(tierFromScore(39, thresholds)).toBe('low');
        expect(tierFromScore(40, thresholds)).toBe('medium');
        expect(tierFromScore(60, thresholds)).toBe('high');
        expect(tierFromScore(80, thresholds)).toBe('critical');
    });
});

describe('computeScoresForSource — fetch path', () => {
    const weights = { ...DEFAULT_FACTOR_WEIGHTS };

    test('non-telegram with fetch history gets differentiated scores', () => {
        const result = computeScoresForSource(
            {
                type: 'rss',
                category: 'news',
                fetch_count: 100,
                error_count: 5,
                last_status: 'success',
                health_status: 'healthy',
                refresh_interval: 60,
                last_fetch_at: new Date(Date.now() - 15 * 60000).toISOString(),
            },
            weights,
            0,
            null,
            DEFAULT_TIER_MINIMUMS,
        );
        expect(result.calculated_score).toBeGreaterThan(18.5);
        expect(result.score_breakdown.success_rate).toBeGreaterThan(0);
        expect(result.score_breakdown.freshness).toBeGreaterThan(0);
    });

    test('telegram without metrics falls back to static factors only (18.5)', () => {
        const result = computeScoresForSource(
            { type: 'telegram', category: 'signals', fetch_count: 0, error_count: 9999 },
            weights,
            0,
            null,
            DEFAULT_TIER_MINIMUMS,
        );
        expect(result.calculated_score).toBe(18.5);
    });
});

describe('computeScoresForSource — telegram path', () => {
    const weights = { ...DEFAULT_FACTOR_WEIGHTS };

    test('active telegram with recent processed data scores above 18.5', () => {
        const result = computeScoresForSource(
            { type: 'telegram', category: 'signals', fetch_count: 0, config: {} },
            weights,
            0,
            {
                total_24h: 500,
                processed_24h: 495,
                error_24h: 5,
                pending_24h: 0,
                latest_at: new Date(Date.now() - 10 * 60000).toISOString(),
                operational_status: 'active',
            },
            DEFAULT_TIER_MINIMUMS,
        );
        expect(result.calculated_score).toBeGreaterThan(18.5);
        expect(result.score_breakdown.freshness).toBe(100);
        expect(result.score_breakdown.success_rate).toBeGreaterThan(90);
        expect(result.score_breakdown.meta.scoring_path).toBe('telegram_collected_data');
    });

    test('telegram with no recent data stays low', () => {
        const result = computeScoresForSource(
            { type: 'telegram', category: 'signals', fetch_count: 0, config: {} },
            weights,
            0,
            {
                total_24h: 0,
                processed_24h: 0,
                error_24h: 0,
                pending_24h: 0,
                latest_at: null,
                operational_status: 'error',
            },
            DEFAULT_TIER_MINIMUMS,
        );
        expect(result.calculated_score).toBeLessThanOrEqual(18.5);
        expect(result.score_breakdown.freshness).toBe(0);
    });

    test('telegram success rate ignores pending from denominator', () => {
        expect(telegramSuccessRate(80, 20)).toBe(80);
        expect(telegramSuccessRate(0, 0)).toBe(0);
    });

    test('telegram freshness buckets', () => {
        expect(telegramFreshnessFromLatestAt(new Date(Date.now() - 5 * 60000))).toBe(100);
        expect(telegramFreshnessFromLatestAt(new Date(Date.now() - 30 * 60000))).toBe(80);
        expect(telegramFreshnessFromLatestAt(null)).toBe(0);
    });

    test('telegram error health without fetch_count gate', () => {
        expect(telegramErrorHealth(100, 10, 110)).toBeGreaterThan(0);
        expect(telegramErrorHealth(0, 0, 0)).toBe(0);
    });

    test('no divide-by-zero on empty telegram metrics', () => {
        const result = computeScoresForSource(
            { type: 'telegram', category: 'signals', fetch_count: 0 },
            weights,
            0,
            {
                total_24h: 0,
                processed_24h: 0,
                error_24h: 0,
                pending_24h: 0,
                latest_at: null,
                operational_status: 'linked',
            },
            DEFAULT_TIER_MINIMUMS,
        );
        expect(Number.isFinite(result.calculated_score)).toBe(true);
    });
});

describe('applyPrioritization — safe apply', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockTransaction.mockReset();
    });

    test('writes priority_tier and priority_score, not integer priority', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [
                    {
                        is_enabled: true,
                        factor_weights: DEFAULT_FACTOR_WEIGHTS,
                        tier_thresholds: DEFAULT_TIER_MINIMUMS,
                        updated_at: new Date(),
                    },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        source_id: '11111111-1111-1111-1111-111111111111',
                        calculated_score: 72.5,
                        suggested_tier: 'high',
                        override_score: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] })
            .mockResolvedValueOnce({ rows: [] });

        const clientQuery = jest.fn(async () => ({ rows: [] }));
        mockTransaction.mockImplementation(async (fn) => fn({ query: clientQuery }));

        const result = await applyPrioritization({
            userId: 'user-1',
            confirmApply: true,
            sourceIds: null,
        });

        expect(result.applied).toBe(1);
        expect(clientQuery).toHaveBeenCalled();
        const updateSql = clientQuery.mock.calls.find((c) =>
            String(c[0]).includes('UPDATE data_sources'),
        );
        expect(updateSql).toBeTruthy();
        expect(String(updateSql[0])).toContain('priority_tier');
        expect(String(updateSql[0])).not.toMatch(/SET\s+priority\s*=/);
        expect(updateSql[1]).toEqual([
            '11111111-1111-1111-1111-111111111111',
            'high',
            72.5,
        ]);
    });

    test('requires explicit confirmation', async () => {
        await expect(
            applyPrioritization({ userId: 'u', confirmApply: false, sourceIds: null }),
        ).rejects.toMatchObject({ code: 'CONFIRM_APPLY_REQUIRED' });
    });
});

describe('i18n keys', () => {
    test('configure_factors is translated in en', () => {
        expect(enTranslations.configure_factors).toBe('Configure Prioritization Factors');
    });

    test('total weight message exists', () => {
        expect(enTranslations.prioritization_total_weight_invalid).toContain('100%');
    });
});
