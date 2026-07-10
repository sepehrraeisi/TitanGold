/**
 * DH-WEBCRAWLER-P2-ARCHITECTURE-FIX
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

const {
    resolveRssIngestionOwner,
    isDuplicateRiskCrawler,
    assertCrawlerRunAllowed,
    parseSourceConfig,
} = await import('../../services/datahubCrawlersService.js');

describe('resolveRssIngestionOwner', () => {
    test('active RSS defaults to data_fetcher', () => {
        expect(
            resolveRssIngestionOwner({
                sourceType: 'rss',
                sourceIsActive: true,
                sourceConfig: {},
            }),
        ).toBe('data_fetcher');
    });

    test('active RSS with crawler_mode=crawler uses crawler', () => {
        expect(
            resolveRssIngestionOwner({
                sourceType: 'rss',
                sourceIsActive: true,
                sourceConfig: { crawler_mode: 'crawler' },
            }),
        ).toBe('crawler');
    });

    test('website sources use crawler path', () => {
        expect(
            resolveRssIngestionOwner({
                sourceType: 'web',
                sourceIsActive: true,
                sourceConfig: {},
            }),
        ).toBe('crawler');
    });
});

describe('assertCrawlerRunAllowed', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('blocks non-dry-run RSS when dataFetcher owns ingestion', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'src-1', type: 'rss', is_active: true, config: {} }],
        });

        await expect(
            assertCrawlerRunAllowed({
                crawler: { source_id: 'src-1', target_type: 'rss' },
                dryRun: false,
                forceOverride: false,
            }),
        ).rejects.toMatchObject({ code: 'RSS_DATAFETCHER_OWNS', status: 409 });
    });

    test('allows RSS dry run when dataFetcher owns ingestion', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'src-1', type: 'rss', is_active: true, config: {} }],
        });

        const result = await assertCrawlerRunAllowed({
            crawler: { source_id: 'src-1', target_type: 'rss' },
            dryRun: true,
            forceOverride: false,
        });
        expect(result.ingestionOwner).toBe('data_fetcher');
    });

    test('blocks non-dry-run when source inactive without override', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'src-1', type: 'rss', is_active: false, config: {} }],
        });

        await expect(
            assertCrawlerRunAllowed({
                crawler: { source_id: 'src-1', target_type: 'rss' },
                dryRun: false,
                forceOverride: false,
            }),
        ).rejects.toMatchObject({ code: 'SOURCE_INACTIVE', status: 403 });
    });

    test('allows website non-dry-run regardless of RSS ownership rules', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'src-1', type: 'web', is_active: true, config: {} }],
        });

        const result = await assertCrawlerRunAllowed({
            crawler: { source_id: 'src-1', target_type: 'website' },
            dryRun: false,
            forceOverride: false,
        });
        expect(result.ingestionOwner).toBe('crawler');
    });
});

describe('isDuplicateRiskCrawler', () => {
    test('flags active RSS with data_fetcher owner', () => {
        expect(
            isDuplicateRiskCrawler({
                target_type: 'rss',
                source_is_active: true,
                ingestion_owner: 'data_fetcher',
            }),
        ).toBe(true);
    });

    test('parseSourceConfig handles JSON string', () => {
        expect(parseSourceConfig('{"crawler_mode":"crawler"}')).toEqual({
            crawler_mode: 'crawler',
        });
    });
});
