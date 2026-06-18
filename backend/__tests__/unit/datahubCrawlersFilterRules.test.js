/**
 * DH-BLACKLISTWHITELIST-P2 — crawler filter gateway coverage.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

const { preCrawlFilterCheck } = await import('../../services/datahubCrawlersService.js');

function ingestionRule() {
    return {
        id: 'rule-crawler',
        rule_type: 'blacklist',
        scope: 'domain',
        pattern: 'blocked.example',
        match_type: 'exact',
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
    };
}

describe('datahub crawler filter rules enforcement', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('SELECT * FROM datahub_filter_rules')) return { rows: [ingestionRule()] };
            if (text.includes('UPDATE datahub_filter_rules')) return { rows: [] };
            return { rows: [] };
        });
    });

    test('pre-crawl filter check blocks blacklisted domain', async () => {
        await expect(
            preCrawlFilterCheck({
                source_id: '11111111-1111-4111-8111-111111111111',
                url: 'https://blocked.example/news',
                text: 'crawler candidate',
            }),
        ).rejects.toMatchObject({
            status: 403,
            code: 'FILTER_BLOCKED_PRE_CRAWL',
        });
    });
});
