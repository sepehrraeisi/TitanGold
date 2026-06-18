/**
 * DH-BLACKLISTWHITELIST-P2 — automation must respect publishing filters.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

jest.unstable_mockModule('../../services/dataPipelineSnapshot.js', () => ({
    buildDataPipelineView: jest.fn().mockResolvedValue({
        snapshot: { categories: [] },
        normalizedData: [
            {
                id: 'record-1',
                sourceId: 'source-1',
                category: 'market_data',
                dataType: 'telegram',
                qualityScore: 90,
                status: 'ready',
                payload: {
                    title: 'DH_PUBLISH_BLOCK_TEST',
                    content: 'blocked automation content',
                },
            },
        ],
    }),
}));

jest.unstable_mockModule('../../services/telegramPublisherService.js', () => ({
    runPublisherPublish: jest.fn(),
}));

const { refreshAutomationQueue } = await import('../../services/datahubAutomationService.js');

function publishingRule() {
    return {
        id: 'rule-1',
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

describe('datahubAutomationService filter rules enforcement', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);

            if (text.includes('FROM datahub_automation_topics')) {
                return {
                    rows: [{
                        id: 'topic-1',
                        name: 'Filter Topic',
                        topic_key: 'filter-topic',
                        source_type: 'pipeline',
                        trigger_conditions: {
                            agentId: 'technical',
                            dataTypes: ['telegram'],
                            includeStatuses: ['ready'],
                        },
                        publish_targets: { publisherIds: ['publisher-1'] },
                        is_active: true,
                        priority: 4,
                        updated_at: new Date('2026-06-18T00:00:00Z'),
                    }],
                };
            }

            if (text.includes('FROM datahub_automation_executions')) return { rows: [] };
            if (text.includes('COUNT(*)::int AS c FROM datahub_automation_queue')) return { rows: [{ c: 0 }] };
            if (text.includes('SELECT id FROM datahub_automation_queue')) return { rows: [] };
            if (text.includes('FROM source_access_controls')) return { rows: [] };
            if (text.includes('SELECT agent_key FROM ai_agents')) return { rows: [{ agent_key: 'technical' }] };
            if (text.includes('SELECT * FROM datahub_filter_rules')) return { rows: [publishingRule()] };
            if (text.includes('UPDATE datahub_filter_rules')) return { rows: [] };
            if (text.includes('INSERT INTO data_hub_logs')) return { rows: [{ id: 'log-1' }] };
            if (text.includes('INSERT INTO datahub_automation_queue')) return { rows: [{ id: 'bad-insert' }] };
            if (text.includes('SELECT * FROM datahub_automation_queue')) return { rows: [] };
            return { rows: [] };
        });
    });

    test('blocked publishing content does not enqueue', async () => {
        const result = await refreshAutomationQueue({ topicId: 'topic-1' });

        expect(result.added).toBe(0);
        expect(mockQuery).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO datahub_automation_queue'),
            expect.any(Array),
        );
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO data_hub_logs'),
            expect.any(Array),
        );
    });
});
