/**
 * C2 E6A — exact-pair collected_data lookup regression.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockTransaction = jest.fn(async (fn) => fn({
    query: mockQuery,
}));

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
    transaction: mockTransaction,
}));

jest.unstable_mockModule('../../services/collectedDataTimestamps.js', () => ({
    getIngestionTimestampForInsert: () => new Date('2026-08-19T00:00:00Z'),
}));

jest.unstable_mockModule('../../services/logger.js', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.unstable_mockModule('../../services/filterRulesGateway.js', () => ({
    enforceIngestionPolicy: jest.fn(async () => undefined),
    isFilterRuleBlockedError: () => false,
}));

jest.unstable_mockModule('../../services/pipelineSchedulerRuntime.js', () => ({
    recordPipelineJobHeartbeat: jest.fn(async () => undefined),
}));

const { transferTelegramMessagesToPipeline } = await import('../../services/telegramPipeline.js');

const SOURCE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SOURCE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const SOURCE_C = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
const SOURCE_D = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4';
const SOURCE_E = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5';

function sourceRow(id, channelId, username) {
    return {
        id,
        name: `telegram ${username}`,
        category: 'signals',
        config: { channelId, channelUsername: username },
    };
}

function messageRow({ id, messageId, channelId, username }) {
    return {
        id,
        channel_id: `ch-${channelId}`,
        message_id: messageId,
        telegram_channel_id: channelId,
        channel_username: username,
        channel_title: username,
        channel_category: 'signals',
        message_text: `payload ${messageId}`,
        message_type: 'text',
        has_media: false,
        media_url: null,
        telegram_created_at: new Date('2026-08-19T00:00:00Z'),
        created_at: new Date('2026-08-19T00:00:00Z'),
    };
}

function classifySql(sql) {
    const text = String(sql);
    if (text.includes('pg_try_advisory_lock')) return 'lock';
    if (text.includes('pg_advisory_unlock')) return 'unlock';
    if (text.includes('FROM data_sources')) return 'sources';
    if (text.includes('COUNT(*) FILTER')) return 'backlog';
    if (text.includes('FROM telegram_messages') && text.includes('INNER JOIN telegram_channels')) return 'messages';
    if (text.includes('JOIN unnest') && text.includes('collected_data')) return 'lookup';
    if (text.includes('source_id = ANY') && text.includes('collected_data')) return 'lookup_legacy';
    if (text.includes('ROLLBACK TO SAVEPOINT')) return 'rollback';
    if (text.includes('RELEASE SAVEPOINT')) return 'release';
    if (text.includes('SAVEPOINT transfer_row')) return 'savepoint';
    if (text.includes('INSERT INTO collected_data')) return 'insert';
    if (text.includes('UPDATE telegram_messages')) return 'mark';
    return 'other';
}

function installMock({ messages, sources, lookupRows = [], insertImpl }) {
    mockQuery.mockImplementation(async (sql, params) => {
        const kind = classifySql(sql);
        if (kind === 'lock') return { rows: [{ acquired: true }] };
        if (kind === 'unlock') return { rows: [] };
        if (kind === 'sources') return { rows: sources };
        if (kind === 'messages') return { rows: messages };
        if (kind === 'lookup' || kind === 'lookup_legacy') {
            return { rows: lookupRows };
        }
        if (kind === 'backlog') return { rows: [{ backlog: 0, backlog_24h: 0 }] };
        if (kind === 'savepoint' || kind === 'release' || kind === 'rollback' || kind === 'mark') {
            return { rows: [] };
        }
        if (kind === 'insert') {
            if (insertImpl) return insertImpl(sql, params);
            return { rows: [] };
        }
        return { rows: [] };
    });
}

function lookupCalls() {
    return mockQuery.mock.calls.filter(([sql]) => classifySql(sql) === 'lookup');
}

function legacyLookupCalls() {
    return mockQuery.mock.calls.filter(([sql]) => classifySql(sql) === 'lookup_legacy');
}

describe('telegramPipeline exact-pair collected_data lookup', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockTransaction.mockClear();
    });

    test('same source / multiple messages keeps repeated source IDs in lookup arrays', async () => {
        installMock({
            sources: [sourceRow(SOURCE_A, '-1001', 'chan-a')],
            messages: [
                messageRow({ id: 'row-1', messageId: '101', channelId: '-1001', username: 'chan-a' }),
                messageRow({ id: 'row-2', messageId: '102', channelId: '-1001', username: 'chan-a' }),
            ],
            lookupRows: [],
        });

        const result = await transferTelegramMessagesToPipeline(2);
        expect(result.inserted).toBe(2);
        expect(legacyLookupCalls()).toHaveLength(0);
        expect(lookupCalls()).toHaveLength(1);

        const [sql, params] = lookupCalls()[0];
        expect(sql).toContain('JOIN unnest');
        expect(sql).toContain("cd.raw_data->>'telegram_message_id'");
        expect(sql).toContain("cd.raw_data ? 'telegram_message_id'");
        expect(sql).toContain('cd.source_id = v.source_id');
        expect(params[0]).toEqual([SOURCE_A, SOURCE_A]);
        expect(params[1]).toEqual(['101', '102']);
        expect(params[0]).not.toEqual([SOURCE_A]);
    });

    test('same message ID / multiple sources treats source as part of identity', async () => {
        installMock({
            sources: [
                sourceRow(SOURCE_A, '-1001', 'chan-a'),
                sourceRow(SOURCE_B, '-1002', 'chan-b'),
            ],
            messages: [
                messageRow({ id: 'row-a', messageId: '101', channelId: '-1001', username: 'chan-a' }),
                messageRow({ id: 'row-b', messageId: '101', channelId: '-1002', username: 'chan-b' }),
            ],
            lookupRows: [{ source_id: SOURCE_A, message_id: '101' }],
        });

        const result = await transferTelegramMessagesToPipeline(2);
        expect(lookupCalls()[0][1][0]).toEqual([SOURCE_A, SOURCE_B]);
        expect(lookupCalls()[0][1][1]).toEqual(['101', '101']);
        expect(result.duplicates).toBe(1);
        expect(result.inserted).toBe(1);
    });

    test('partial existence only skips the exact existing pair', async () => {
        installMock({
            sources: [
                sourceRow(SOURCE_A, '-1001', 'chan-a'),
                sourceRow(SOURCE_B, '-1002', 'chan-b'),
            ],
            messages: [
                messageRow({ id: 'row-1', messageId: '101', channelId: '-1001', username: 'chan-a' }),
                messageRow({ id: 'row-2', messageId: '102', channelId: '-1001', username: 'chan-a' }),
                messageRow({ id: 'row-3', messageId: '103', channelId: '-1002', username: 'chan-b' }),
            ],
            lookupRows: [{ source_id: SOURCE_A, message_id: '102' }],
        });

        const result = await transferTelegramMessagesToPipeline(3);
        expect(result.duplicates).toBe(1);
        expect(result.inserted).toBe(2);
    });

    test('duplicate exact input keeps aligned lookup arrays', async () => {
        installMock({
            sources: [sourceRow(SOURCE_A, '-1001', 'chan-a')],
            messages: [
                messageRow({ id: 'row-1', messageId: '101', channelId: '-1001', username: 'chan-a' }),
                messageRow({ id: 'row-2', messageId: '101', channelId: '-1001', username: 'chan-a' }),
            ],
            lookupRows: [],
        });

        await transferTelegramMessagesToPipeline(2);
        const [, params] = lookupCalls()[0];
        expect(params[0]).toEqual([SOURCE_A, SOURCE_A]);
        expect(params[1]).toEqual(['101', '101']);
        expect(params[0].length).toBe(params[1].length);
    });

    test('no existing pairs does not skip items that only share source or message id', async () => {
        installMock({
            sources: [
                sourceRow(SOURCE_A, '-1001', 'chan-a'),
                sourceRow(SOURCE_B, '-1002', 'chan-b'),
            ],
            messages: [
                messageRow({ id: 'row-1', messageId: '101', channelId: '-1001', username: 'chan-a' }),
                messageRow({ id: 'row-2', messageId: '102', channelId: '-1001', username: 'chan-a' }),
                messageRow({ id: 'row-3', messageId: '101', channelId: '-1002', username: 'chan-b' }),
            ],
            lookupRows: [],
        });

        const result = await transferTelegramMessagesToPipeline(3);
        expect(result.duplicates).toBe(0);
        expect(result.inserted).toBe(3);
    });

    test('23505 unique violation remains defense-in-depth after empty lookup', async () => {
        let insertCount = 0;
        installMock({
            sources: [sourceRow(SOURCE_A, '-1001', 'chan-a')],
            messages: [
                messageRow({ id: 'row-1', messageId: '101', channelId: '-1001', username: 'chan-a' }),
            ],
            lookupRows: [],
            insertImpl: async () => {
                insertCount += 1;
                const err = new Error('duplicate key');
                err.code = '23505';
                throw err;
            },
        });

        const result = await transferTelegramMessagesToPipeline(1);
        expect(insertCount).toBe(1);
        expect(result.inserted).toBe(0);
        expect(result.duplicates).toBe(1);
        expect(result.errors).toBe(0);
        expect(result.skipped_run).toBe(false);

        const sqlKinds = mockQuery.mock.calls.map(([sql]) => classifySql(sql));
        expect(sqlKinds).toContain('savepoint');
        expect(sqlKinds).toContain('rollback');
        expect(sqlKinds).toContain('mark');
    });

    test('N=100 repeated-source lookup keeps one pair per resolved message', async () => {
        const sources = [
            sourceRow(SOURCE_A, '-1001', 'chan-a'),
            sourceRow(SOURCE_B, '-1002', 'chan-b'),
            sourceRow(SOURCE_C, '-1003', 'chan-c'),
            sourceRow(SOURCE_D, '-1004', 'chan-d'),
            sourceRow(SOURCE_E, '-1005', 'chan-e'),
        ];
        const sourceIds = [SOURCE_A, SOURCE_B, SOURCE_C, SOURCE_D, SOURCE_E];
        const channelIds = ['-1001', '-1002', '-1003', '-1004', '-1005'];
        const usernames = ['chan-a', 'chan-b', 'chan-c', 'chan-d', 'chan-e'];
        const messages = Array.from({ length: 100 }, (_, i) => {
            const s = i % 5;
            return messageRow({
                id: `row-${i}`,
                messageId: String(2000 + i),
                channelId: channelIds[s],
                username: usernames[s],
            });
        });

        installMock({
            sources,
            messages,
            lookupRows: [],
        });

        const result = await transferTelegramMessagesToPipeline(100);
        expect(result.inserted).toBe(100);
        const [, params] = lookupCalls()[0];
        expect(params[0]).toHaveLength(100);
        expect(params[1]).toHaveLength(100);
        expect(new Set(params[0]).size).toBe(5);
        expect(params[0].filter((id) => id === SOURCE_A).length).toBe(20);
        expect([...new Set(params[0])].sort()).toEqual([...sourceIds].sort());
        expect(params[0]).not.toHaveLength(5);
    });
});
