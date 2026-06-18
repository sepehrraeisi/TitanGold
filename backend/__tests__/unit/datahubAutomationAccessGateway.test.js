/**
 * DH-ACCESSCONTROL-P3 — automation enqueue must use central gateway policy.
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
                dataType: 'price',
                qualityScore: 90,
                status: 'ready',
                payload: { title: 'ACL automation test' },
            },
        ],
    }),
}));

jest.unstable_mockModule('../../services/telegramPublisherService.js', () => ({
    runPublisherPublish: jest.fn(),
}));

const { refreshAutomationQueue } = await import('../../services/datahubAutomationService.js');

describe('datahubAutomationService access gateway enforcement', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);

            if (text.includes('FROM datahub_automation_topics')) {
                return {
                    rows: [
                        {
                            id: 'topic-1',
                            name: 'ACL Topic',
                            topic_key: 'acl-topic',
                            source_type: 'pipeline',
                            trigger_conditions: {
                                agentId: 'technical',
                                dataTypes: ['price'],
                                includeStatuses: ['ready'],
                            },
                            publish_targets: { publisherIds: ['publisher-1'] },
                            is_active: true,
                            priority: 4,
                            updated_at: new Date('2026-06-17T00:00:00Z'),
                        },
                    ],
                };
            }

            if (text.includes('FROM datahub_automation_executions')) {
                return { rows: [] };
            }

            if (text.includes('COUNT(*)::int AS c FROM datahub_automation_queue')) {
                return { rows: [{ c: 0 }] };
            }

            if (text.includes('SELECT id FROM datahub_automation_queue')) {
                return { rows: [] };
            }

            if (text.includes('FROM source_access_controls')) {
                return {
                    rows: [
                        {
                            allowed_agents: ['technical'],
                            blocked_agents: ['publisher'],
                            allowed_data_types: [],
                            blocked_data_types: [],
                        },
                    ],
                };
            }

            if (text.includes('INSERT INTO data_hub_logs')) {
                return { rows: [{ id: 'log-1' }] };
            }

            if (text.includes('INSERT INTO datahub_automation_queue')) {
                return { rows: [{ id: 'queue-should-not-insert' }] };
            }

            if (text.includes('SELECT * FROM datahub_automation_queue')) {
                return { rows: [] };
            }

            return { rows: [] };
        });
    });

    test('blocked publisher prevents automation queue insert', async () => {
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
