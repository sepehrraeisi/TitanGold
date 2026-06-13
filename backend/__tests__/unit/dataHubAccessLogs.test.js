/**
 * DH-ACCESSLOGS-P1-FIX-AND-VERIFY
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { jest } from '@jest/globals';

const __dirname = dirname(fileURLToPath(import.meta.url));
const enTranslations = JSON.parse(
    readFileSync(join(__dirname, '../../../deploy/blue/locales/en.json'), 'utf8'),
);

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

const { listDataHubAccessLogs } = await import('../../services/dataHubAccessLogs.js');

describe('listDataHubAccessLogs', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('joins data_sources for sourceName and maps statusCounts to UI keys', async () => {
        const row = {
            id: 'log-1',
            source_id: 'src-1',
            source_name: 'Ontime Bitcoin',
            action: 'fetch',
            status: 'success',
            message: 'Fetch completed',
            data_size: null,
            execution_time_ms: 504,
            created_at: new Date('2026-06-08T12:00:00Z'),
            metadata: { duration_ms: 504 },
        };

        mockQuery
            .mockResolvedValueOnce({ rows: [{ total: 1 }] })
            .mockResolvedValueOnce({ rows: [row] })
            .mockResolvedValueOnce({
                rows: [{ success: 1, cached: 0, failed: 0, timeout: 0 }],
            });

        const result = await listDataHubAccessLogs({ limit: 10, offset: 0 });

        expect(mockQuery).toHaveBeenCalledTimes(3);
        const listSql = mockQuery.mock.calls[1][0];
        expect(listSql).toContain('LEFT JOIN data_sources ds');
        expect(listSql).toContain('ds.name AS source_name');

        expect(result.data[0]).toMatchObject({
            sourceId: 'src-1',
            sourceName: 'Ontime Bitcoin',
            action: 'fetch',
            status: 'success',
            message: 'Fetch completed',
            responseTime: 504,
        });
        expect(result.statusCounts).toEqual({
            success: 1,
            cached: 0,
            failed: 0,
            timeout: 0,
            error: 0,
            warning: 0,
        });
    });

    test('maps failure status to failed for UI', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ total: 1 }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'log-2',
                    source_id: 'src-2',
                    source_name: null,
                    action: 'fetch_error',
                    status: 'failure',
                    message: 'timeout',
                    data_size: null,
                    execution_time_ms: 100,
                    created_at: new Date(),
                    metadata: {},
                }],
            })
            .mockResolvedValueOnce({
                rows: [{ success: 0, cached: 0, failed: 1, timeout: 0 }],
            });

        const result = await listDataHubAccessLogs({});
        expect(result.data[0].status).toBe('failed');
        expect(result.data[0].sourceName).toBeUndefined();
    });
});

describe('Access Logs i18n labels', () => {
    test('exposes detail modal labels', () => {
        expect(enTranslations.unknown_source).toBe('Unknown Source');
        expect(enTranslations.open_source).toBe('Open Source');
        expect(enTranslations.log_action).toBe('Action');
        expect(enTranslations.log_message).toBe('Message');
        expect(enTranslations.metadata).toBe('Metadata');
    });
});
