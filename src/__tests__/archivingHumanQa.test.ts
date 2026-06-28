import { describe, expect, it } from 'vitest';
import {
    getRestoreBlockReason,
    isRawArchivingLabel,
    isRawOperationType,
    normalizeOperationType,
    normalizePartition,
    operationLabel,
    partitionDisplayLabel,
    restoreBlockMessage,
} from '../../components/ai/AIManager/tabs/DataHub/advanced/archiving/archivingLabels';
import type { ArchivingOperation, ArchivePartition } from '../../services/dataHubArchivingApi';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const en = JSON.parse(
    readFileSync(join(__dirname, '../../deploy/blue/locales/en.json'), 'utf8'),
) as Record<string, string>;

const mockT = (key: string) => en[key] ?? key;

const RAW_ENUMS = [
    'preview_archive',
    'preview_restore',
    'preview_purge',
    'archive_old_decisions',
    'restore_from_archive',
];

describe('Data Archiving Human QA regressions', () => {
    it('maps legacy operation types to human labels via i18n', () => {
        for (const type of RAW_ENUMS) {
            const op: ArchivingOperation = {
                id: '1',
                operation_type: type,
                operation_label: type,
                dry_run: true,
                request_payload: {},
                result_payload: {},
                status: 'success',
                started_at: new Date().toISOString(),
            };
            const label = operationLabel(op, mockT);
            expect(isRawOperationType(label), `raw enum leaked for ${type}`).toBe(false);
            expect(isRawArchivingLabel(label), `raw pattern in label for ${type}`).toBe(false);
            expect(label.length).toBeGreaterThan(0);
        }
    });

    it('never falls back to raw operation_type even when backend sends enum as operation_label', () => {
        const op: ArchivingOperation = {
            id: '2',
            operation_type: 'preview_archive',
            operation_label: 'preview_archive',
            dry_run: true,
            request_payload: {},
            result_payload: {},
            status: 'success',
            started_at: new Date().toISOString(),
        };
        expect(operationLabel(op, mockT)).toBe('Archive Preview');
    });

    it('normalizes legacy partition_name without label/year', () => {
        const legacy: ArchivePartition = {
            partition_name: 'ai_decisions_archive_2025',
            start_date: '2025-01-01 00:00:00+00',
            end_date: '2026-01-01 00:00:00+00',
            row_count: 0,
            size: '0 bytes',
        };
        const normalized = normalizePartition(legacy);
        expect(normalized.label).toBe('Archive 2025');
        expect(normalized.year).toBe(2025);
        expect(partitionDisplayLabel(legacy)).toBe('Archive 2025');
        expect(isRawArchivingLabel(partitionDisplayLabel(legacy))).toBe(false);
    });

    it('restore empty archive shows no_archived reason', () => {
        expect(
            getRestoreBlockReason({
                archivedCount: 0,
                canWrite: true,
                restoreStart: '',
                restoreEnd: '',
                isLoading: false,
            }),
        ).toBe('no_archived');
        expect(restoreBlockMessage('no_archived', mockT)).toBe(
            'No archived decisions are available yet.',
        );
    });

    it('restore RBAC reason when archived data exists but user cannot write', () => {
        expect(
            getRestoreBlockReason({
                archivedCount: 10,
                canWrite: false,
                restoreStart: '2025-01-01',
                restoreEnd: '2025-06-01',
                isLoading: false,
            }),
        ).toBe('rbac');
        expect(restoreBlockMessage('rbac', mockT)).toContain('administrator');
    });

    it('restore dates_required when range missing', () => {
        expect(
            getRestoreBlockReason({
                archivedCount: 5,
                canWrite: true,
                restoreStart: '',
                restoreEnd: '',
                isLoading: false,
            }),
        ).toBe('dates_required');
    });

    it('normalizeOperationType preserves legacy SQL names with i18n mapping', () => {
        expect(normalizeOperationType('archive_old_decisions')).toBe('archive_old_decisions');
        expect(normalizeOperationType('restore_from_archive')).toBe('restore_from_archive');
    });

    it('Archiving.tsx references restore empty state and partition fallback', () => {
        const src = readFileSync(
            join(__dirname, '../../components/ai/AIManager/tabs/DataHub/advanced/Archiving.tsx'),
            'utf8',
        );
        expect(src).toContain('archiving_restore_empty');
        expect(src).toContain('useArchivePartitionsQuery');
        expect(src).toContain('normalizePartition');
        expect(src).not.toContain('operation_type');
    });
});
