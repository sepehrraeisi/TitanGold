/**
 * DH-NORMALIZATION-P0-WORKER-1
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import {
    qualityBandFromScore,
    scoreNormalizedRecord,
    applyQualityToNormalized,
} from '../../services/normalizationQualityScorer.js';
import { NORMALIZED_DATA_VERSION } from '../../services/normalizers/normalizedDataContract.js';
import { dataNormalizer } from '../../services/normalizers/dataNormalizer.js';
import { dataValidator } from '../../services/validators/dataValidator.js';

describe('normalizationQualityScorer', () => {
    test('bands map correctly', () => {
        expect(qualityBandFromScore(95)).toBe('excellent');
        expect(qualityBandFromScore(80)).toBe('good');
        expect(qualityBandFromScore(60)).toBe('acceptable');
        expect(qualityBandFromScore(30)).toBe('weak');
        expect(qualityBandFromScore(10)).toBe('poor');
    });

    test('scores normalized v1 record', () => {
        const normalized = dataNormalizer.normalize(
            {
                title: 'Market update headline',
                description: 'Content '.repeat(20),
                pubDate: '2026-06-01T10:00:00.000Z',
            },
            'rss',
            { category: 'news', sourceName: 'RSS Test' },
        );
        const { score, band } = scoreNormalizedRecord(normalized, {
            is_active: true,
            last_status: 'success',
            priority: 8,
        });
        expect(score).toBeGreaterThanOrEqual(25);
        expect(score).toBeLessThanOrEqual(100);
        expect(['excellent', 'good', 'acceptable', 'weak', 'poor']).toContain(band);
    });

    test('applyQuality sets metadata fields', () => {
        const base = { title: 't', content: 'c', metadata: {} };
        const out = applyQualityToNormalized(
            base,
            { score: 42, band: 'weak', factors: {} },
            'test-worker',
        );
        expect(out.metadata.quality_score).toBe(42);
        expect(out.metadata.quality_warning).toBe(true);
    });
});

describe('normalization worker contract path', () => {
    test('telegram → normalize → validate → score pipeline', () => {
        const raw = {
            telegram_message_id: '99',
            telegram_channel_id: '-1001',
            message_text: 'Gold price surge #commodities',
            telegram_created_at: '2026-06-01T12:00:00.000Z',
        };
        const normalized = dataNormalizer.normalize(raw, 'telegram', {
            category: 'signals',
            ingestionMode: 'collector',
        });
        expect(normalized.version).toBe(NORMALIZED_DATA_VERSION);
        expect(dataValidator.validateContract(normalized).valid).toBe(true);
        const { score } = scoreNormalizedRecord(normalized, { is_active: true });
        expect(score).toBeGreaterThan(0);
    });
});

describe('scheduler wiring', () => {
    test('scheduler imports normalization worker not legacy agent queue path', async () => {
        const src = await import('fs').then((fs) =>
            fs.readFileSync(new URL('../../engine/scheduler.js', import.meta.url), 'utf8'),
        );
        expect(src).toMatch(/processNormalizationBatch/);
        expect(src).toMatch(/startNormalizationScheduler/);
        expect(src).not.toMatch(/dataPipeline\.processPendingData/);
    });
});
