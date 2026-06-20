/**
 * DH-BLACKLISTWHITELIST-P2 — Telegram publisher publishing filters.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

const { runPublisherPublish } = await import('../../services/telegramPublisherService.js');

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const PUBLISHER_ID = '22222222-2222-4222-8222-222222222222';

const accessControl = {
    enforced: true,
    allowed: true,
    sourceId: SOURCE_ID,
    agentKey: 'publisher',
};

function publishingRule() {
    return {
        id: '33333333-3333-4333-8333-333333333333',
        rule_type: 'blacklist',
        scope: 'keyword',
        pattern: 'DH_PUBLISH_BLOCK_TEST',
        match_type: 'contains',
        apply_target: 'publishing',
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

describe('telegram publisher filter enforcement', () => {
    beforeEach(() => {
        process.env.TELEGRAM_PUBLISHER_DRY_RUN = 'true';
        mockQuery.mockReset();
    });

    afterEach(() => {
        delete process.env.TELEGRAM_PUBLISHER_DRY_RUN;
    });

    test('publishing keyword blacklist blocks dry-run and records blocked history', async () => {
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('SELECT * FROM datahub_filter_rules')) return { rows: [publishingRule()] };
            if (text.includes('UPDATE datahub_filter_rules')) return { rows: [] };
            if (text.includes('INSERT INTO data_hub_logs')) return { rows: [{ id: 'log-1' }] };
            if (text.includes('SELECT id FROM datahub_publisher_source_mappings')) {
                return { rows: [{ id: 'mapping-1' }] };
            }
            if (text.includes('SELECT * FROM telegram_publishers')) {
                return { rows: [{ id: PUBLISHER_ID, is_active: true, template: '{message}' }] };
            }
            if (text.includes('INSERT INTO publisher_delivery_history')) {
                return { rows: [{ id: 'history-1' }] };
            }
            return { rows: [] };
        });

        await expect(
            runPublisherPublish(
                PUBLISHER_ID,
                {
                    message: 'DH_PUBLISH_BLOCK_TEST',
                    content_type: 'manual',
                    confirm_publish: true,
                    source_id: SOURCE_ID,
                    data_type: 'verify',
                    accessControl,
                },
                'user-1',
            ),
        ).rejects.toMatchObject({
            status: 403,
            code: 'FILTER_RULE_BLOCKED',
            history_id: 'history-1',
        });

        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO publisher_delivery_history'),
            expect.any(Array),
        );
    });

    test('allowed content can dry-run normally', async () => {
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('SELECT * FROM datahub_filter_rules')) return { rows: [publishingRule()] };
            if (text.includes('SELECT id FROM datahub_publisher_source_mappings')) {
                return { rows: [{ id: 'mapping-1' }] };
            }
            if (text.includes('SELECT * FROM telegram_publishers')) {
                return {
                    rows: [{
                        id: PUBLISHER_ID,
                        is_active: true,
                        template: '{message}',
                        bot_token_encrypted: null,
                    }],
                };
            }
            if (text.includes('INSERT INTO publisher_delivery_history')) {
                return { rows: [{ id: 'history-1' }] };
            }
            return { rows: [] };
        });

        const result = await runPublisherPublish(
            PUBLISHER_ID,
            {
                message: 'allowed message',
                content_type: 'manual',
                confirm_publish: true,
                source_id: SOURCE_ID,
                data_type: 'verify',
                accessControl,
            },
            'user-1',
        );

        expect(result.status).toBe('dry_run');
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO publisher_delivery_history'),
            expect.any(Array),
        );
    });

    test('missing mapping fails before dry-run unless temporary publish is explicit', async () => {
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('SELECT id FROM datahub_publisher_source_mappings')) return { rows: [] };
            if (text.includes('SELECT * FROM telegram_publishers')) {
                return { rows: [{ id: PUBLISHER_ID, is_active: true, template: '{message}' }] };
            }
            if (text.includes('INSERT INTO publisher_delivery_history')) {
                return { rows: [{ id: 'history-2' }] };
            }
            return { rows: [] };
        });

        await expect(
            runPublisherPublish(
                PUBLISHER_ID,
                {
                    message: 'allowed message',
                    content_type: 'manual',
                    confirm_publish: true,
                    source_id: SOURCE_ID,
                    data_type: 'verify',
                    accessControl,
                },
                'user-1',
            ),
        ).rejects.toMatchObject({
            status: 409,
            code: 'PUBLISHER_MAPPING_REQUIRED',
            history_id: 'history-2',
        });
    });
});
