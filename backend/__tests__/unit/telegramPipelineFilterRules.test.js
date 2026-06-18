/**
 * DH-BLACKLISTWHITELIST-P2 — Telegram transfer pipeline filter enforcement.
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

const { transferTelegramMessagesToPipeline } = await import('../../services/telegramPipeline.js');

function ingestionRule() {
    return {
        id: 'rule-telegram',
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
    };
}

describe('telegramPipeline filter rules enforcement', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockTransaction.mockClear();
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
            if (text.includes('pg_advisory_unlock')) return { rows: [] };
            if (text.includes('FROM data_sources')) {
                return {
                    rows: [{
                        id: 'source-1',
                        name: 'telegram source',
                        category: 'signals',
                        config: { channelId: '-1001', channelUsername: 'testchan' },
                    }],
                };
            }
            if (text.includes('FROM telegram_messages')) {
                return {
                    rows: [{
                        id: 'msg-row-1',
                        channel_id: 'channel-row-1',
                        message_id: '101',
                        telegram_channel_id: '-1001',
                        channel_username: 'testchan',
                        channel_title: 'Test Channel',
                        channel_category: 'signals',
                        message_text: 'DH_FILTER_BLOCK_TEST telegram payload',
                        message_type: 'text',
                        has_media: false,
                        media_url: null,
                        telegram_created_at: new Date('2026-06-18T00:00:00Z'),
                        created_at: new Date('2026-06-18T00:00:00Z'),
                    }],
                };
            }
            if (text.includes('raw_data->>')) return { rows: [] };
            if (text.includes('SELECT * FROM datahub_filter_rules')) return { rows: [ingestionRule()] };
            if (text.includes('UPDATE datahub_filter_rules')) return { rows: [] };
            if (text.includes('INSERT INTO data_hub_logs')) return { rows: [{ id: 'log-1' }] };
            if (text.includes('INSERT INTO collected_data')) return { rows: [{ id: 'bad-insert' }] };
            if (text.includes('UPDATE telegram_messages')) return { rows: [] };
            if (text.includes('COUNT(*) FILTER')) return { rows: [{ backlog: 0, backlog_24h: 0 }] };
            return { rows: [] };
        });
    });

    test('blocked telegram message is skipped before collected_data insert', async () => {
        const result = await transferTelegramMessagesToPipeline(1);

        expect(result.inserted).toBe(0);
        expect(result.skipped_filtered).toBe(1);
        expect(mockQuery).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO collected_data'),
            expect.any(Array),
        );
    });
});
