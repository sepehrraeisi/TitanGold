/**
 * DH-AUTOMATION-ROUTING-P2 — automation dispatch safety.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockRunPublisherPublish = jest.fn();
let scenario = 'allowed';

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

jest.unstable_mockModule('../../services/telegramPublisherService.js', () => ({
    runPublisherPublish: mockRunPublisherPublish,
}));

const {
    refreshAutomationQueue,
    dispatchAutomationQueue,
    retryAutomationExecution,
} = await import('../../services/datahubAutomationService.js');

function topicRow() {
    return {
        id: 'topic-1',
        name: 'Safety Topic',
        topic_key: 'safety-topic',
        source_type: 'pipeline',
        trigger_conditions: {
            agentId: '',
            dataTypes: ['telegram'],
            includeStatuses: ['ready'],
        },
        publish_targets: { publisherIds: ['11111111-1111-4111-8111-111111111111'] },
        is_active: true,
        priority: 4,
        updated_at: new Date('2026-06-20T00:00:00Z'),
    };
}

function candidateRow() {
    return {
        id: '22222222-2222-4222-8222-222222222222',
        source_id: '33333333-3333-4333-8333-333333333333',
        normalized_data: {
            title: 'Automation safety candidate',
            content: 'safe dry run payload',
            metadata: { data_type: 'telegram', quality_score: 90 },
        },
        metadata: { data_type: 'telegram', quality_score: 90 },
        source_type: 'telegram',
        category_name: 'market_data',
    };
}

function queueRow(overrides = {}) {
    return {
        id: '44444444-4444-4444-8444-444444444444',
        topic_id: 'topic-1',
        publisher_id: '11111111-1111-4111-8111-111111111111',
        record_id: '22222222-2222-4222-8222-222222222222',
        agent_id: null,
        status: 'pending',
        priority: 4,
        payload_preview: 'Automation safety candidate',
        data_type: 'telegram',
        category: 'market_data',
        quality_score: 90,
        normalized_status: 'ready',
        retry_count: 0,
        max_retry_count: 3,
        created_at: new Date('2026-06-20T00:00:00Z'),
        ...overrides,
    };
}

function mockDb() {
    mockQuery.mockImplementation(async (sql) => {
        const text = String(sql);

        if (text.includes('FROM datahub_automation_topics')) {
            return { rows: [topicRow()] };
        }
        if (text.includes('FROM telegram_publishers')) {
            if (scenario === 'disabled-publisher') {
                return { rows: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Disabled', is_active: false }] };
            }
            return { rows: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Active', is_active: true }] };
        }
        if (text.includes('FROM datahub_automation_executions') && text.includes('COUNT(*)::int AS c')) {
            return { rows: [{ c: 0 }] };
        }
        if (text.includes('FROM datahub_automation_executions') && text.includes('WHERE status IN')) {
            return { rows: [] };
        }
        if (text.includes('FROM datahub_automation_executions') && text.includes('WHERE id = $1')) {
            return {
                rows: [{
                    id: 'exec-1',
                    topic_id: 'topic-1',
                    publisher_id: '11111111-1111-4111-8111-111111111111',
                    record_id: '22222222-2222-4222-8222-222222222222',
                    agent_id: null,
                    payload_preview: 'Automation safety candidate',
                    metadata: { error_code: 'AUTOMATION_ERROR' },
                }],
            };
        }
        if (text.includes('SELECT id FROM collected_data WHERE id = $1')) {
            return { rows: [{ id: '22222222-2222-4222-8222-222222222222' }] };
        }
        if (text.includes('FROM datahub_automation_executions e')) {
            return { rows: [] };
        }
        if (text.includes('SELECT id, name FROM data_categories')) return { rows: [] };
        if (text.includes('FROM collected_data cd')) return { rows: [candidateRow()] };
        if (text.includes('SELECT source_id FROM collected_data')) {
            return { rows: [{ source_id: '33333333-3333-4333-8333-333333333333' }] };
        }
        if (text.includes('COUNT(*)::int AS c FROM datahub_automation_queue')) return { rows: [{ c: 0 }] };
        if (text.includes('SELECT id FROM datahub_automation_queue')) return { rows: [] };
        if (text.includes('FROM datahub_publisher_source_mappings')) {
            return scenario === 'missing-mapping' ? { rows: [] } : { rows: [{ id: 'mapping-1' }] };
        }
        if (text.includes('FROM source_access_controls')) return { rows: [] };
        if (text.includes('SELECT * FROM datahub_filter_rules')) return { rows: [] };
        if (text.includes('INSERT INTO datahub_automation_queue')) return { rows: [queueRow()] };
        if (text.includes('INSERT INTO datahub_automation_executions')) return { rows: [{ id: 'audit-1' }] };
        if (text.includes('WITH picked AS')) return { rows: [queueRow({ status: 'processing', retry_count: 1 })] };
        if (text.includes('UPDATE datahub_automation_queue') && text.includes('RETURNING *')) {
            return { rows: [queueRow({ status: 'processing', retry_count: 1 })] };
        }
        if (text.includes('UPDATE datahub_automation_queue')) return { rows: [] };
        if (text.includes('SELECT * FROM datahub_automation_queue WHERE id = $1')) return { rows: [queueRow()] };
        if (text.includes('SELECT * FROM datahub_automation_queue')) return { rows: [] };
        if (text.includes('SELECT * FROM datahub_automation_schedule')) {
            return { rows: [{ enabled: false, interval_minutes: 15, max_items_per_run: 5 }] };
        }
        return { rows: [] };
    });
}

describe('datahubAutomationService safety', () => {
    beforeEach(() => {
        scenario = 'allowed';
        mockQuery.mockReset();
        mockRunPublisherPublish.mockReset();
        mockRunPublisherPublish.mockResolvedValue({
            success: true,
            dry_run: true,
            status: 'dry_run',
            history_id: 'history-1',
        });
        mockDb();
    });

    test('disabled publisher cannot enqueue and records skipped audit', async () => {
        scenario = 'disabled-publisher';

        const result = await refreshAutomationQueue({ topicId: 'topic-1' });

        expect(result.added).toBe(0);
        expect(mockQuery).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO datahub_automation_queue'),
            expect.any(Array),
        );
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO datahub_automation_executions'),
            expect.arrayContaining(['skipped', true, 'Publisher target is disabled']),
        );
    });

    test('missing publisher mapping cannot enqueue and records skipped audit', async () => {
        scenario = 'missing-mapping';

        const result = await refreshAutomationQueue({ topicId: 'topic-1' });

        expect(result.added).toBe(0);
        expect(mockQuery).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO datahub_automation_queue'),
            expect.any(Array),
        );
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO datahub_automation_executions'),
            expect.arrayContaining(['skipped', true, 'Source is not mapped to this publisher']),
        );
    });

    test('dry-run dispatch passes authoritative dry_run to publisher service', async () => {
        await dispatchAutomationQueue('user-1', { limit: 1, dryRun: true });

        expect(mockRunPublisherPublish).toHaveBeenCalledWith(
            '11111111-1111-4111-8111-111111111111',
            expect.objectContaining({ dry_run: true, confirm_publish: true }),
            'user-1',
        );
    });

    test('dispatch claims pending rows with SKIP LOCKED', async () => {
        await dispatchAutomationQueue('user-1', { limit: 1, dryRun: true });

        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('FOR UPDATE SKIP LOCKED'),
            [1],
        );
    });

    test('retry defaults to dry-run', async () => {
        await retryAutomationExecution('exec-1', 'user-1');

        expect(mockRunPublisherPublish).toHaveBeenCalledWith(
            '11111111-1111-4111-8111-111111111111',
            expect.objectContaining({ dry_run: true }),
            'user-1',
        );
    });
});

