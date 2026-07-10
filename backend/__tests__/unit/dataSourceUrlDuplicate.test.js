/**
 * DH-DATASOURCES-P2
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { jest } from '@jest/globals';
import {
    duplicateUrlKey,
    isUrlBearingSourceType,
    normalizeUrlForDuplicateCheck,
} from '../../utils/urlDuplicateNormalization.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const enTranslations = JSON.parse(
    readFileSync(join(__dirname, '../../../deploy/blue/locales/en.json'), 'utf8'),
);

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

const {
    evaluateDuplicateUrlGuard,
    findDuplicateUrlSources,
    listDuplicateUrlGroups,
    summarizeDuplicateGroups,
    computeDuplicateGroupSeverity,
    getDuplicateUrlDashboard,
} = await import('../../services/dataSourceUrlDuplicateService.js');

describe('i18n keys', () => {
    test('duplicate URL guard keys exist', () => {
        expect(enTranslations.source_duplicate_url_badge).toBe('Duplicate URL');
        expect(enTranslations.crawler_linked_source_duplicate_url).toContain('{{count}}');
    });
});

describe('normalizeUrlForDuplicateCheck', () => {
    test('normalizes trailing slash and hash', () => {
        expect(normalizeUrlForDuplicateCheck('https://Example.com/fa/rss/12/')).toBe(
            'https://example.com/fa/rss/12',
        );
        expect(normalizeUrlForDuplicateCheck('https://example.com/fa/rss/12#section')).toBe(
            'https://example.com/fa/rss/12',
        );
    });

    test('strips tracking params and sorts query params', () => {
        expect(
            normalizeUrlForDuplicateCheck(
                'https://example.com/feed?b=2&utm_source=x&a=1&fbclid=abc',
            ),
        ).toBe('https://example.com/feed?a=1&b=2');
    });

    test('duplicateUrlKey combines type and normalized url', () => {
        expect(duplicateUrlKey('rss', 'https://example.com/fa/rss/12')).toBe(
            'rss::https://example.com/fa/rss/12',
        );
    });
});

describe('isUrlBearingSourceType', () => {
    test('includes rss/web/api only', () => {
        expect(isUrlBearingSourceType('rss')).toBe(true);
        expect(isUrlBearingSourceType('web')).toBe(true);
        expect(isUrlBearingSourceType('api')).toBe(true);
        expect(isUrlBearingSourceType('telegram')).toBe(false);
    });
});

describe('findDuplicateUrlSources', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('detects same RSS URL with trailing slash differences', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'src-1',
                        name: 'Source A',
                        type: 'rss',
                        url: 'https://eghtesaad24.ir/fa/rss/12',
                        is_active: true,
                        created_at: new Date('2026-05-26T00:00:00Z'),
                        last_fetch_at: null,
                        collected_count: 10,
                        last_collected_at: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });

        const result = await findDuplicateUrlSources({
            type: 'rss',
            url: 'https://eghtesaad24.ir/fa/rss/12/',
            includeInactive: true,
        });

        expect(result.normalizedUrl).toBe('https://eghtesaad24.ir/fa/rss/12');
        expect(result.duplicates).toHaveLength(1);
        expect(result.duplicates[0].id).toBe('src-1');
    });

    test('ignores Telegram sources', async () => {
        const result = await findDuplicateUrlSources({
            type: 'telegram',
            url: 'https://t.me/channel',
            includeInactive: true,
        });
        expect(result.duplicates).toEqual([]);
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('evaluateDuplicateUrlGuard', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('blocks active duplicate without override', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'src-1',
                        name: 'Existing',
                        type: 'rss',
                        url: 'https://example.com/feed',
                        is_active: true,
                        created_at: new Date(),
                        last_fetch_at: null,
                        collected_count: 1,
                        last_collected_at: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });

        const guard = await evaluateDuplicateUrlGuard({
            type: 'rss',
            url: 'https://example.com/feed',
            isActive: true,
            allowDuplicateUrl: false,
        });

        expect(guard.blocked).toBe(true);
        expect(guard.code).toBe('DUPLICATE_ACTIVE_URL');
    });

    test('allows active duplicate with override and warning', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'src-1',
                        name: 'Existing',
                        type: 'rss',
                        url: 'https://example.com/feed',
                        is_active: true,
                        created_at: new Date(),
                        last_fetch_at: null,
                        collected_count: 1,
                        last_collected_at: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });

        const guard = await evaluateDuplicateUrlGuard({
            type: 'rss',
            url: 'https://example.com/feed',
            isActive: true,
            allowDuplicateUrl: true,
        });

        expect(guard.blocked).toBe(false);
        expect(guard.warnings.some(w => w.code === 'DUPLICATE_ACTIVE_URL_OVERRIDE')).toBe(true);
    });

    test('warns but does not block inactive duplicate', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'src-1',
                        name: 'Inactive',
                        type: 'api',
                        url: 'https://example.com/api',
                        is_active: false,
                        created_at: new Date(),
                        last_fetch_at: null,
                        collected_count: 0,
                        last_collected_at: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });

        const guard = await evaluateDuplicateUrlGuard({
            type: 'api',
            url: 'https://example.com/api',
            isActive: true,
            allowDuplicateUrl: false,
        });

        expect(guard.blocked).toBe(false);
        expect(guard.warnings.some(w => w.code === 'DUPLICATE_INACTIVE_URL')).toBe(true);
    });

    test('excludes current source on update', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'src-self',
                        name: 'Self',
                        type: 'rss',
                        url: 'https://example.com/feed',
                        is_active: true,
                        created_at: new Date(),
                        last_fetch_at: null,
                        collected_count: 1,
                        last_collected_at: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });

        const guard = await evaluateDuplicateUrlGuard({
            type: 'rss',
            url: 'https://example.com/feed',
            isActive: true,
            excludeSourceId: 'src-self',
            allowDuplicateUrl: false,
        });

        expect(guard.blocked).toBe(false);
    });
});

describe('summarizeDuplicateGroups', () => {
    test('excludes fully ignored groups from dashboard counts', () => {
        const groups = [
            {
                ignored: false,
                severity: 'high',
                activeCount: 2,
                inactiveCount: 0,
            },
            {
                ignored: true,
                severity: 'info',
                activeCount: 2,
                inactiveCount: 0,
            },
        ];
        const summary = summarizeDuplicateGroups(groups);
        expect(summary.duplicateGroups).toBe(1);
        expect(summary.highRiskGroups).toBe(1);
        expect(summary.ignoredGroups).toBe(1);
    });
});

describe('computeDuplicateGroupSeverity', () => {
    test('returns info when group is ignored', () => {
        expect(
            computeDuplicateGroupSeverity(
                [{ isActive: true }, { isActive: true }],
                { groupIgnored: true },
            ),
        ).toBe('info');
    });
});

describe('getDuplicateUrlDashboard', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('returns summary and groups', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const dashboard = await getDuplicateUrlDashboard();
        expect(dashboard.summary).toBeDefined();
        expect(Array.isArray(dashboard.groups)).toBe(true);
    });
});

describe('listDuplicateUrlGroups severity', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('marks high when multiple active sources share URL', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'a',
                        name: 'A',
                        type: 'rss',
                        url: 'https://example.com/feed',
                        is_active: true,
                        created_at: new Date(),
                        last_fetch_at: null,
                        collected_count: 1,
                        last_collected_at: null,
                    },
                    {
                        id: 'b',
                        name: 'B',
                        type: 'rss',
                        url: 'https://example.com/feed/',
                        is_active: true,
                        created_at: new Date(),
                        last_fetch_at: null,
                        collected_count: 2,
                        last_collected_at: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });

        const groups = await listDuplicateUrlGroups();
        expect(groups).toHaveLength(1);
        expect(groups[0].severity).toBe('high');
        expect(groups[0].activeCount).toBe(2);
    });

    test('marks low when only inactive duplicates exist', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'a',
                        name: 'A',
                        type: 'api',
                        url: 'https://example.com/test',
                        is_active: false,
                        created_at: new Date(),
                        last_fetch_at: null,
                        collected_count: 0,
                        last_collected_at: null,
                    },
                    {
                        id: 'b',
                        name: 'B',
                        type: 'api',
                        url: 'https://example.com/test',
                        is_active: false,
                        created_at: new Date(),
                        last_fetch_at: null,
                        collected_count: 0,
                        last_collected_at: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });

        const groups = await listDuplicateUrlGroups();
        expect(groups[0].severity).toBe('low');
    });
});
