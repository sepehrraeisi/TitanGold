/**
 * DH-NORMALIZATION-P0-CONTRACT-1 — contract, normalizer, validator, snapshot adapter
 * @jest-environment node
 */

import { dataNormalizer } from '../../services/normalizers/dataNormalizer.js';
import { dataValidator } from '../../services/validators/dataValidator.js';
import {
    NORMALIZED_DATA_VERSION,
    coerceReadModel,
} from '../../services/normalizers/normalizedDataContract.js';
import { normalizeReadModel } from '../../services/dataPipelineSnapshot.js';

const baseContext = {
    sourceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    sourceName: 'Test Source',
    category: 'signals',
    collectedAt: '2026-06-01T12:00:00.000Z',
    ingestionMode: 'fetch',
};

describe('NormalizedData contract', () => {
    test('telegram raw → v1 contract → validator valid', () => {
        const raw = {
            telegram_message_id: '1176',
            telegram_channel_id: '-100123',
            channel_username: 'testchannel',
            message_text: 'BTC breakout #crypto',
            telegram_created_at: '2026-06-01T10:00:00.000Z',
            channel_category: 'signals',
        };
        const normalized = dataNormalizer.normalize(raw, 'telegram', {
            ...baseContext,
            ingestionMode: 'collector',
        });
        expect(normalized.version).toBe(NORMALIZED_DATA_VERSION);
        expect(normalized.sourceType).toBe('telegram');
        expect(normalized.timestamp).toBeTruthy();
        expect(normalized.category).toBe('signals');
        const result = dataValidator.validateContract(normalized);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('rss raw → v1 contract → validator valid', () => {
        const raw = {
            title: 'Market update',
            description: 'Stocks rose today.',
            link: 'https://example.com/item',
            pubDate: 'Mon, 01 Jun 2026 10:00:00 GMT',
            guid: 'rss-1',
        };
        const normalized = dataNormalizer.normalize(raw, 'rss', baseContext);
        expect(normalized.sourceType).toBe('rss');
        expect(normalized.title).toBe('Market update');
        const result = dataValidator.validateContract(normalized);
        expect(result.valid).toBe(true);
    });

    test('api raw → v1 contract → validator valid', () => {
        const raw = {
            title: 'Price tick',
            body: 'BTC=68000',
            published_at: '2026-06-01T09:00:00.000Z',
        };
        const normalized = dataNormalizer.normalize(raw, 'api', baseContext);
        expect(normalized.sourceType).toBe('api');
        const result = dataValidator.validateContract(normalized);
        expect(result.valid).toBe(true);
    });

    test('missing optional metadata → valid with warnings only', () => {
        const legacy = {
            title: 'Legacy row',
            content: 'Hello world',
            publishedAt: '2026-06-01T08:00:00.000Z',
            metadata: { source_type: 'telegram' },
            tags: ['telegram'],
        };
        const result = dataValidator.validateContract(legacy);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('missing content/title → validator invalid', () => {
        const bad = {
            version: NORMALIZED_DATA_VERSION,
            title: '   ',
            content: '',
            sourceType: 'rss',
            category: 'news',
            timestamp: '2026-06-01T08:00:00.000Z',
        };
        const result = dataValidator.validateContract(bad);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('title'))).toBe(true);
        expect(result.errors.some((e) => e.includes('content'))).toBe(true);
    });

    test('legacy normalized_data → coerceReadModel reads safely', () => {
        const legacy = {
            title: 'Transfer envelope',
            content: 'Message body',
            publishedAt: '2026-06-01T07:00:00.000Z',
            channel: 'bbcpersian',
            metadata: { source_type: 'telegram', has_media: false },
            tags: ['telegram', 'signals'],
        };
        const read = coerceReadModel(legacy);
        expect(read.title).toBe('Transfer envelope');
        expect(read.sourceType).toBe('telegram');
        expect(read.timestamp).toBe('2026-06-01T07:00:00.000Z');
        expect(normalizeReadModel(legacy)).toEqual(read);
    });

    test('snapshot adapter handles null normalized_data', () => {
        expect(coerceReadModel(null)).toBeNull();
        expect(coerceReadModel(undefined)).toBeNull();
    });
});

describe('scheduler normalization wiring', () => {
    test('scheduler uses normalization worker not legacy dataPipeline batch', async () => {
        const schedulerSource = await import('fs').then((fs) =>
            fs.readFileSync(new URL('../../engine/scheduler.js', import.meta.url), 'utf8'),
        );
        expect(schedulerSource).toMatch(/processNormalizationBatch/);
        expect(schedulerSource).not.toMatch(/dataPipeline\.processPendingData/);
    });
});
