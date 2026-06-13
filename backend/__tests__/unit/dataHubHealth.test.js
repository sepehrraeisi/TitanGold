/**
 * DH-HEALTH-P1-ACTIVITY-FIX-1
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

const { tryInsertDataHubAccessLog } = await import('../../services/dataHubAccessLogWriter.js');

describe('dataHubAccessLogWriter', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [] });
    });

    test('inserts with valid action/status columns (no level)', async () => {
        await tryInsertDataHubAccessLog({
            sourceId: 'src-1',
            action: 'source_update',
            legacyLevel: 'info',
            message: 'Source updated',
            metadata: { foo: 'bar' },
        });

        expect(mockQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain('action');
        expect(sql).toContain('status');
        expect(sql).not.toContain('level');
        expect(params[1]).toBe('source_update');
        expect(params[2]).toBe('success');
    });

    test('maps legacy error level to failure status', async () => {
        await tryInsertDataHubAccessLog({
            sourceId: 'src-2',
            action: 'fetch_error',
            legacyLevel: 'error',
            message: 'fetch failed',
        });

        const [, params] = mockQuery.mock.calls[0];
        expect(params[1]).toBe('fetch_error');
        expect(params[2]).toBe('failure');
    });
});

describe('HealthPanel i18n labels', () => {
    test('exposes pipeline activity metric labels', () => {
        expect(enTranslations.datahub_health_pipeline_ingested_1h).toBe('Pipeline ingested (1h)');
        expect(enTranslations.datahub_health_pipeline_normalized_1h).toBe('Pipeline normalized (1h)');
        expect(enTranslations.datahub_health_telegram_intake_1h).toBe('Telegram intake (1h)');
        expect(enTranslations.datahub_health_access_log_events_1h).toBe('Access log events (1h)');
        expect(enTranslations.datahub_health_pipeline_activity_section).toBe('Pipeline activity (1h)');
    });
});

describe('GET /health metric shape', () => {
    test('health response includes pipeline and access log metrics', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{}] })
            .mockResolvedValueOnce({ rows: [{ count: '12' }] })
            .mockResolvedValueOnce({
                rows: [{
                    access_log_events_1h: 0,
                    pipeline_ingested_1h: 8400,
                    pipeline_normalized_1h: 8242,
                    telegram_created_1h: 1814,
                }],
            });

        const { query } = await import('../../database/db.js');

        await query('SELECT 1');
        const sourcesResult = await query(
            'SELECT COUNT(*) as count FROM data_sources WHERE is_active = true',
        );
        const metricsResult = await query(
            `SELECT
        (SELECT COUNT(*)::int FROM data_hub_logs
          WHERE created_at > NOW() - INTERVAL '1 hour') AS access_log_events_1h,
        (SELECT COUNT(*)::int FROM collected_data
          WHERE collected_at > NOW() - INTERVAL '1 hour') AS pipeline_ingested_1h,
        (SELECT COUNT(*)::int FROM collected_data
          WHERE processed_at > NOW() - INTERVAL '1 hour' AND status = 'processed') AS pipeline_normalized_1h,
        (SELECT COUNT(*)::int FROM telegram_messages
          WHERE created_at > NOW() - INTERVAL '1 hour') AS telegram_created_1h`,
        );

        const m = metricsResult.rows[0];
        const activeCount = parseInt(sourcesResult.rows[0]?.count, 10) || 0;
        const pipelineIngested1h = parseInt(m.pipeline_ingested_1h, 10) || 0;
        const body = {
            status: activeCount > 0 ? 'healthy' : 'degraded',
            accessLogEvents1h: parseInt(m.access_log_events_1h, 10) || 0,
            pipelineIngested1h,
            pipelineNormalized1h: parseInt(m.pipeline_normalized_1h, 10) || 0,
            telegramCreated1h: parseInt(m.telegram_created_1h, 10) || 0,
            recentActivity: pipelineIngested1h,
        };

        expect(body.pipelineIngested1h).toBe(8400);
        expect(body.pipelineNormalized1h).toBe(8242);
        expect(body.telegramCreated1h).toBe(1814);
        expect(body.accessLogEvents1h).toBe(0);
        expect(body.recentActivity).toBe(body.pipelineIngested1h);
    });
});
