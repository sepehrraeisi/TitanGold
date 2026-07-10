/**
 * DH-WEBCRAWLER-P4
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

const { syncCrawlersFromDataSources } = await import('../../services/datahubCrawlersService.js');

describe('syncCrawlersFromDataSources', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('creates missing crawlers for rss/web sources without duplicates', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'src-rss-1',
                        name: 'RSS One',
                        type: 'rss',
                        url: 'https://example.com/feed.xml',
                        is_active: true,
                        config: {},
                        refresh_interval: 5,
                    },
                    {
                        id: 'src-web-1',
                        name: 'Web One',
                        type: 'web',
                        url: 'https://example.com',
                        is_active: true,
                        config: { maxDepth: 2, selector: 'article' },
                        refresh_interval: 15,
                    },
                ],
            })
            .mockResolvedValueOnce({
                rows: [{ source_id: 'src-rss-existing', crawler_count: 1 }],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ c: 3 }] });

        const stats = await syncCrawlersFromDataSources();

        expect(stats.created).toBe(2);
        expect(stats.skipped).toBe(0);
        expect(stats.rss_web_sources).toBe(2);

        const insertCalls = mockQuery.mock.calls.filter(call =>
            String(call[0]).includes('INSERT INTO datahub_crawlers'),
        );
        expect(insertCalls).toHaveLength(2);

        const rssInsert = insertCalls[0][1];
        expect(rssInsert[2]).toBe('rss');
        expect(rssInsert[3]).toBe('https://example.com/feed.xml');
        expect(JSON.parse(rssInsert[13]).synced_from_source).toBe(true);

        const webInsert = insertCalls[1][1];
        expect(webInsert[2]).toBe('website');
        expect(webInsert[4]).toBe(2);
        expect(JSON.parse(webInsert[9])).toEqual({ content: 'article' });
    });

    test('skips sources that already have a crawler row', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'src-existing',
                        name: 'Existing',
                        type: 'rss',
                        url: 'https://example.com/feed.xml',
                        is_active: true,
                        config: {},
                        refresh_interval: 5,
                    },
                ],
            })
            .mockResolvedValueOnce({
                rows: [{ source_id: 'src-existing', crawler_count: 1 }],
            })
            .mockResolvedValueOnce({ rows: [{ c: 1 }] });

        const stats = await syncCrawlersFromDataSources();

        expect(stats.created).toBe(0);
        expect(stats.skipped).toBe(1);
        const insertCalls = mockQuery.mock.calls.filter(call =>
            String(call[0]).includes('INSERT INTO datahub_crawlers'),
        );
        expect(insertCalls).toHaveLength(0);
    });
});
