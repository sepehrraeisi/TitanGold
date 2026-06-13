/**
 * DH-AUTODISCOVERY-P2
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { jest } from '@jest/globals';
import { checkDuplicateLayers, shouldSkipAsDuplicate } from '../../utils/discoveryDedupe.js';
import {
    normalizeTelegramChannelIdentity,
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
    evaluateTelegramDuplicateGuard,
} = await import('../../services/dataSourceUrlDuplicateService.js');

const {
    approveSuggestion,
    getScanById,
    listScanHistory,
} = await import('../../services/datahubDiscoveryService.js');

describe('normalizeTelegramChannelIdentity', () => {
    test('normalizes t.me URLs with or without @', () => {
        expect(normalizeTelegramChannelIdentity('https://t.me/Rokna_news')).toBe('rokna_news');
        expect(normalizeTelegramChannelIdentity('https://t.me/@crypto_signals_test')).toBe(
            'crypto_signals_test',
        );
        expect(normalizeTelegramChannelIdentity('@crypto_signals_test')).toBe('crypto_signals_test');
    });
});

describe('checkDuplicateLayers — telegram', () => {
    const sources = [
        {
            id: 'src-rokna',
            type: 'telegram',
            name: 'Rokna',
            url: 'https://t.me/Rokna_news',
            telegram_identity: 'rokna_news',
        },
    ];

    test('different telegram channels are not duplicates', () => {
        const dup = checkDuplicateLayers(
            {
                suggestedType: 'telegram',
                suggestedUrl: 'https://t.me/@crypto_signals_test',
            },
            { sources, suggestions: [] },
        );
        expect(dup.isDuplicate).toBe(false);
        expect(shouldSkipAsDuplicate(dup)).toBe(false);
    });

    test('exact telegram username is duplicate', () => {
        const dup = checkDuplicateLayers(
            {
                suggestedType: 'telegram',
                suggestedUrl: 'https://t.me/rokna_news',
            },
            { sources, suggestions: [] },
        );
        expect(dup.isDuplicate).toBe(true);
        expect(dup.matchType).toBe('exact');
        expect(dup.reason).toBe('telegram_identity_match_existing_source');
        expect(shouldSkipAsDuplicate(dup)).toBe(true);
    });

    test('t.me hostname alone is not duplicate', () => {
        const dup = checkDuplicateLayers(
            {
                suggestedType: 'telegram',
                suggestedUrl: 'https://t.me/unique_channel',
            },
            { sources, suggestions: [] },
        );
        expect(dup.isDuplicate).toBe(false);
    });
});

describe('checkDuplicateLayers — rss/web', () => {
    const sources = [
        {
            id: 'rss-feed',
            type: 'rss',
            name: 'Economy RSS',
            url: 'https://eghtesaad24.ir/fa/rss/12',
            normalized_url: normalizeUrlForDuplicateCheck('https://eghtesaad24.ir/fa/rss/12'),
        },
    ];

    test('article URL does not duplicate RSS feed by hostname', () => {
        const articleUrl =
            'https://eghtesaad24.ir/fa/news/366142/example-article';
        const dup = checkDuplicateLayers(
            {
                suggestedType: 'rss',
                suggestedUrl: articleUrl,
            },
            { sources, suggestions: [] },
        );
        expect(dup.isDuplicate).toBe(false);
        expect(shouldSkipAsDuplicate(dup)).toBe(false);
        expect(dup.weakHints.length).toBeGreaterThan(0);
        expect(dup.weakHints[0].matchType).toBe('weak');
    });

    test('exact RSS URL duplicate detected', () => {
        const dup = checkDuplicateLayers(
            {
                suggestedType: 'rss',
                suggestedUrl: 'https://eghtesaad24.ir/fa/rss/12/',
            },
            { sources, suggestions: [] },
        );
        expect(dup.isDuplicate).toBe(true);
        expect(dup.matchType).toBe('exact');
        expect(dup.reason).toBe('normalized_url_match_existing_source');
        expect(shouldSkipAsDuplicate(dup)).toBe(true);
    });
});

describe('evaluateTelegramDuplicateGuard', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('blocks active duplicate telegram channel', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'tg-1',
                    name: 'Rokna',
                    type: 'telegram',
                    url: 'https://t.me/Rokna_news',
                    config: {},
                    is_active: true,
                },
            ],
        });

        const guard = await evaluateTelegramDuplicateGuard({
            url: 'https://t.me/rokna_news',
            isActive: true,
        });

        expect(guard.blocked).toBe(true);
        expect(guard.code).toBe('DUPLICATE_ACTIVE_TELEGRAM');
    });
});

describe('approveSuggestion duplicate guard', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('approve duplicate blocked for rss url', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'sug-1',
                        status: 'pending',
                        suggested_name: 'Dup RSS',
                        suggested_type: 'rss',
                        suggested_url: 'https://example.com/fa/rss/12',
                        category: 'news',
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'existing',
                        name: 'Existing RSS',
                        type: 'rss',
                        url: 'https://example.com/fa/rss/12',
                        config: {},
                        is_active: true,
                        created_at: new Date(),
                        last_fetch_at: null,
                        refresh_interval: 5,
                        fetch_count: 1,
                        error_count: 0,
                        collected_count: 0,
                        last_collected_at: null,
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });

        await expect(
            approveSuggestion('sug-1', {}, 'user-1'),
        ).rejects.toMatchObject({
            status: 409,
            code: 'DUPLICATE_ACTIVE_URL',
        });
    });
});

describe('getScanById / listScanHistory', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('history returns scan detail with candidates_scanned', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'scan-1',
                    status: 'success',
                    added_count: 1,
                    duplicate_count: 0,
                    blocked_count: 0,
                    skipped_count: 0,
                    error_message: null,
                    metadata: { candidates_scanned: 3 },
                    started_at: new Date('2026-06-13T11:00:00Z'),
                    finished_at: new Date('2026-06-13T11:00:01Z'),
                },
            ],
        });

        const history = await listScanHistory(5);
        expect(history[0].candidates_scanned).toBe(3);
    });

    test('getScanById returns duplicate details from metadata', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'scan-1',
                        status: 'success',
                        added_count: 0,
                        duplicate_count: 1,
                        blocked_count: 0,
                        skipped_count: 0,
                        error_message: null,
                        metadata: {
                            candidates_scanned: 1,
                            duplicate_details: [
                                {
                                    suggested_url: 'https://t.me/test',
                                    duplicate_reason: 'telegram_identity_match_existing_source',
                                },
                            ],
                        },
                        started_at: new Date('2026-06-13T11:00:00Z'),
                        finished_at: new Date('2026-06-13T11:00:01Z'),
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [] });

        const detail = await getScanById('scan-1');
        expect(detail.scan.candidates_scanned).toBe(1);
        expect(detail.duplicate_details).toHaveLength(1);
    });
});

describe('i18n keys', () => {
    test('discovery P2 keys exist', () => {
        expect(enTranslations.pending_approval).toBe('Pending approval');
        expect(enTranslations.discovery_history_hint).not.toContain('GET /api');
        expect(enTranslations.discovery_scan_candidates).toBeTruthy();
        expect(enTranslations.discovery_ignore).toBeTruthy();
    });
});

describe('AutoDiscoveryConfig source wiring', () => {
    test('history table and scan details wired in component', () => {
        const src = readFileSync(
            join(__dirname, '../../../components/ai/AIManager/tabs/DataHub/advanced/AutoDiscoveryConfig.tsx'),
            'utf8',
        );
        expect(src).toContain("t('pending_approval')");
        expect(src).toContain('useDiscoveryHistoryQuery');
        expect(src).toContain('duplicate_details');
        expect(src).toContain('HistoryTable');
        expect(src).toContain('DuplicateDetailList');
    });
});
