/**
 * DH-DATA-ARCHIVING-P2 — labels, safety gates, permissions contract.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

const labels = await import('../../services/datahubArchivingLabels.js');
const {
    executeArchive,
    executeRestore,
    previewPurge,
    getArchiveHealth,
    listArchivePartitions,
    listArchivingOperations,
    getArchivingDashboard,
} = await import('../../services/datahubArchivingService.js');

describe('datahubArchivingLabels P2', () => {
    it('maps health SQL status to stable frontend codes', () => {
        expect(labels.mapArchiveHealthCode({ status: 'OK', archived_records: 5 })).toBe('healthy');
        expect(labels.mapArchiveHealthCode({ status: 'OK', archived_records: 0 })).toBe('no_archives');
        expect(labels.mapArchiveHealthCode({ status: 'WARNING: Last archive >30 days ago' })).toBe(
            'warning_stale_archive',
        );
        expect(labels.mapArchiveHealthCode({ status: 'WARNING: 4 records need archiving', records_pending_archive: 4 })).toBe(
            'warning_pending',
        );
        expect(labels.mapArchiveHealthCode({ status: 'ERROR', last_archive_success: false })).toBe('error');
    });

    it('enriches partitions with partition_name preserved for client fallback', () => {
        const row = labels.enrichPartitionRow({
            partition_name: 'ai_decisions_archive_2025',
            start_date: '2025-01-01',
            end_date: '2026-01-01',
            row_count: 42,
            size: '128 kB',
        });
        expect(row.label).toBe('Archive 2025');
        expect(row.partition_name).toBe('ai_decisions_archive_2025');
        expect(row.row_count).toBe(42);
    });

    it('maps operation types to human labels', () => {
        expect(labels.operationTypeLabel('preview_archive')).toBe('Archive preview');
        expect(labels.operationTypeLabel('archive')).toBe('Archive applied');
        expect(labels.operationTypeLabel('preview_restore')).toBe('Restore preview');
        expect(labels.operationTypeLabel('restore')).toBe('Restore applied');
        expect(labels.operationTypeLabel('preview_purge')).toBe('Purge preview');
    });
});

describe('datahubArchivingService P2 safety', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    it('getArchiveHealth returns status_code not raw SQL only', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ status: 'OK', active_records: 12, archived_records: 0, records_pending_archive: 4 }],
        });
        const health = await getArchiveHealth();
        expect(health.status_code).toBe('warning_pending');
        expect(health.active_records).toBe(12);
    });

    it('listArchivePartitions enriches friendly metadata', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    partition_name: 'ai_decisions_archive_2024',
                    start_date: '2024-01-01',
                    end_date: '2025-01-01',
                    row_count: '10',
                    size: '64 kB',
                },
            ],
        });
        const parts = await listArchivePartitions();
        expect(parts[0].label).toBe('Archive 2024');
        expect(parts[0].year).toBe(2024);
    });

    it('executeArchive requires confirm_archive when not dry run', async () => {
        await expect(executeArchive({ daysOld: 90, dryRun: false, confirmArchive: undefined })).rejects.toMatchObject({
            status: 400,
            code: 'CONFIRM_ARCHIVE_REQUIRED',
        });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('executeRestore requires confirm_restore when not dry run', async () => {
        await expect(
            executeRestore({
                startDate: '2024-01-01T00:00:00.000Z',
                endDate: '2024-02-01T00:00:00.000Z',
                dryRun: false,
                confirmRestore: undefined,
            }),
        ).rejects.toMatchObject({
            status: 400,
            code: 'CONFIRM_RESTORE_REQUIRED',
        });
    });

    it('previewPurge is count-only with purge_apply_available false', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'op-1', started_at: new Date() }] })
            .mockResolvedValueOnce({ rows: [{ would_purge_count: 7 }] })
            .mockResolvedValueOnce({ rows: [] });
        const result = await previewPurge({});
        expect(result.dry_run).toBe(true);
        expect(result.purge_apply_available).toBe(false);
        expect(result.would_purge_count).toBe(7);
        expect(result.message).toMatch(/does not support purge apply/i);
    });

    it('getArchivingDashboard aggregates enriched stats', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [{ status: 'OK', active_records: 1, archived_records: 2, records_pending_archive: 0 }],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });
        const dash = await getArchivingDashboard({ statsLimit: 5, opsLimit: 5 });
        expect(dash.health.status_code).toBeDefined();
        expect(Array.isArray(dash.partitions)).toBe(true);
        expect(Array.isArray(dash.recent_operations)).toBe(true);
    });

    it('listArchivingOperations attaches operation_label', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: '1',
                    operation_type: 'preview_purge',
                    dry_run: true,
                    request_payload: {},
                    result_payload: {},
                    status: 'success',
                    error_summary: null,
                    triggered_by: null,
                    started_at: new Date('2026-06-01'),
                    completed_at: null,
                },
            ],
        });
        const ops = await listArchivingOperations({ limit: 5, offset: 0 });
        expect(ops[0].operation_label).toBe('Purge preview');
        expect(ops[0].operation_type).toBe('preview_purge');
        expect(labels.operationTypeLabel('archive_old_decisions')).toBe('Archive applied');
        expect(labels.operationTypeLabel('restore_from_archive')).toBe('Restore applied');
    });
});

describe('datahubArchiving routes RBAC contract', () => {
    it('writeAuth requires admin or trader role on preview POST', async () => {
        const routePath = new URL('../../routes/data-hub-archiving.js', import.meta.url);
        const src = await import('fs').then(fs =>
            fs.promises.readFile(routePath, 'utf8'),
        );
        expect(src).toMatch(/router\.post\('\/archive\/preview', \.\.\.writeAuth/);
        expect(src).toMatch(/router\.post\('\/restore\/preview', \.\.\.writeAuth/);
        expect(src).toMatch(/router\.post\('\/purge\/preview', \.\.\.writeAuth/);
        expect(src).toMatch(/authorize\('admin', 'trader'\)/);
    });
});
