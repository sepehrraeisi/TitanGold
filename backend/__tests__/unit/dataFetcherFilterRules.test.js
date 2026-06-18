/**
 * DH-BLACKLISTWHITELIST-P2 — DataFetcher must not bypass ingestion filters.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
    transaction: jest.fn(),
}));

const { DataFetcherService } = await import('../../services/dataFetcher.js');

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';

function makeRule(overrides = {}) {
    return {
        id: '33333333-3333-4333-8333-333333333333',
        rule_type: 'blacklist',
        scope: 'keyword',
        pattern: 'DH_FILTER_BLOCK_TEST',
        match_type: 'contains',
        apply_target: 'ingestion',
        action: 'block',
        is_active: true,
        priority: 100,
        metadata: {},
        reason: null,
        created_by: null,
        deleted_at: null,
        last_matched_at: null,
        created_at: new Date('2026-06-18T00:00:00Z'),
        updated_at: new Date('2026-06-18T00:00:00Z'),
        ...overrides,
    };
}

describe('DataFetcherService filter rules enforcement', () => {
    let service;
    let activeRules;

    beforeEach(() => {
        service = new DataFetcherService();
        activeRules = [];
        mockQuery.mockReset();
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('SELECT 1 FROM collected_data')) {
                return { rows: [] };
            }
            if (text.includes('SELECT * FROM datahub_filter_rules')) {
                return { rows: activeRules };
            }
            if (text.includes('UPDATE datahub_filter_rules')) {
                return { rows: [] };
            }
            if (text.includes('INSERT INTO data_hub_logs')) {
                return { rows: [{ id: 'log-1' }] };
            }
            if (text.includes('INSERT INTO collected_data')) {
                return { rows: [{ id: 'inserted-1' }] };
            }
            return { rows: [] };
        });
    });

    test('keyword blacklist blocks insert', async () => {
        activeRules = [makeRule()];

        const result = await service.saveFetchedData(
            { id: SOURCE_ID, type: 'rss', url: 'https://safe.example/feed' },
            [{ title: 'blocked', content: 'DH_FILTER_BLOCK_TEST payload' }],
        );

        expect(result).toMatchObject({ newItems: 0, skippedFiltered: 1 });
        expect(mockQuery).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO collected_data'),
            expect.any(Array),
        );
    });

    test('domain blacklist blocks insert', async () => {
        activeRules = [
            makeRule({
                scope: 'domain',
                pattern: 'blocked.example',
                match_type: 'exact',
            }),
        ];

        const result = await service.saveFetchedData(
            { id: SOURCE_ID, type: 'rss', url: 'https://safe.example/feed' },
            [{ title: 'blocked domain', url: 'https://blocked.example/a' }],
        );

        expect(result).toMatchObject({ newItems: 0, skippedFiltered: 1 });
        expect(mockQuery).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO collected_data'),
            expect.any(Array),
        );
    });

    test('allowed content inserts normally', async () => {
        activeRules = [makeRule()];

        const result = await service.saveFetchedData(
            { id: SOURCE_ID, type: 'rss', url: 'https://safe.example/feed' },
            [{ title: 'allowed', content: 'normal payload' }],
        );

        expect(result).toMatchObject({ newItems: 1, skippedFiltered: 0 });
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO collected_data'),
            expect.any(Array),
        );
    });
});
