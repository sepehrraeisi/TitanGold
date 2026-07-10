/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import {
    getIngestionTimestampForInsert,
    ingestedAtSql,
    resolveIngestedAt,
    resolveIngestedAtIso,
    resolvePublishedAt,
    resolvePublishedAtIso,
} from '../../services/collectedDataTimestamps.js';

describe('collectedDataTimestamps', () => {
    test('getIngestionTimestampForInsert returns a recent timestamp', () => {
        const before = Date.now();
        const ts = getIngestionTimestampForInsert();
        const after = Date.now();
        expect(ts).toBeInstanceOf(Date);
        expect(ts.getTime()).toBeGreaterThanOrEqual(before);
        expect(ts.getTime()).toBeLessThanOrEqual(after);
    });

    test('ingestedAtSql includes transferred_at fallback', () => {
        expect(ingestedAtSql()).toContain("metadata->>'transferred_at'");
        expect(ingestedAtSql('cd')).toContain('cd.collected_at');
    });

    test('legacy Telegram row prefers transferred_at when collected_at is message date', () => {
        const row = {
            collected_at: '2026-02-23T10:00:00.000Z',
            metadata: {
                transferred_at: '2026-06-07T11:00:00.000Z',
                telegram_created_at: '2026-02-23T10:00:00.000Z',
            },
            raw_data: {
                telegram_created_at: '2026-02-23T10:00:00.000Z',
                telegram_message_id: 1,
            },
            normalized_data: {
                publishedAt: '2026-02-23T10:00:00.000Z',
                content: 'test',
            },
        };

        expect(resolveIngestedAtIso(row)).toBe('2026-06-07T11:00:00.000Z');
        expect(resolvePublishedAtIso(row)).toBe('2026-02-23T10:00:00.000Z');
    });

    test('new row uses collected_at as ingestion time when aligned with transfer', () => {
        const row = {
            collected_at: '2026-06-07T12:00:00.000Z',
            metadata: {
                transferred_at: '2026-06-07T12:00:00.000Z',
                telegram_created_at: '2026-02-23T10:00:00.000Z',
            },
            normalized_data: { publishedAt: '2026-02-23T10:00:00.000Z' },
        };

        const ingested = resolveIngestedAt(row);
        expect(ingested.toISOString()).toBe('2026-06-07T12:00:00.000Z');
        expect(resolvePublishedAt(row).toISOString()).toBe('2026-02-23T10:00:00.000Z');
    });

    test('RSS/API crawler row resolves source_published_at', () => {
        const row = {
            collected_at: '2026-06-07T08:00:00.000Z',
            metadata: { source_published_at: '2026-06-01T07:00:00.000Z', crawler_ingest: true },
            normalized_data: { publishedAt: '2026-06-01T07:00:00.000Z', content: 'x' },
        };

        expect(resolveIngestedAtIso(row)).toBe('2026-06-07T08:00:00.000Z');
        expect(resolvePublishedAtIso(row)).toBe('2026-06-01T07:00:00.000Z');
    });
});
