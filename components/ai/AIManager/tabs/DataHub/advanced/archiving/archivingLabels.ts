import type { ArchiveHealth, ArchivingOperation, ArchivePartition } from '../../services/dataHubArchivingApi';

export type ArchiveHealthCode =
    | 'healthy'
    | 'warning_stale_archive'
    | 'warning_pending'
    | 'no_archives'
    | 'error';

export type RestoreBlockReason = 'no_archived' | 'rbac' | 'dates_required' | null;

const HEALTH_I18N: Record<ArchiveHealthCode, string> = {
    healthy: 'archiving_status_healthy',
    warning_stale_archive: 'archiving_status_warning_stale',
    warning_pending: 'archiving_status_warning_pending',
    no_archives: 'archiving_status_no_archives',
    error: 'archiving_status_error',
};

/** Map DB/API operation_type (incl. legacy) → i18n key. Never render raw enum in UI. */
const OP_I18N: Record<string, string> = {
    preview_archive: 'archiving_op_preview_archive',
    archive: 'archiving_op_archive_applied',
    archive_old_decisions: 'archiving_op_archive_applied',
    preview_restore: 'archiving_op_preview_restore',
    restore: 'archiving_op_restore_applied',
    restore_from_archive: 'archiving_op_restore_applied',
    preview_purge: 'archiving_op_preview_purge',
    create_partition: 'archiving_op_create_partition',
};

const RAW_OPERATION_TYPES = new Set([
    'preview_archive',
    'preview_restore',
    'preview_purge',
    'archive',
    'restore',
    'archive_old_decisions',
    'restore_from_archive',
    'create_partition',
]);

export function normalizeOperationType(operationType: string): string {
    const t = String(operationType || '').trim();
    if (OP_I18N[t]) return t;
    if (t === 'archive_old_decisions') return 'archive';
    if (t === 'restore_from_archive') return 'restore';
    return t;
}

export function archiveHealthLabel(code: string | undefined, t: (k: string) => string): string {
    const key = HEALTH_I18N[(code as ArchiveHealthCode) || 'no_archives'];
    return t(key);
}

export function archiveHealthVariant(
    code: string | undefined,
): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
    if (code === 'healthy') return 'success';
    if (code === 'error') return 'error';
    if (code === 'warning_stale_archive' || code === 'warning_pending') return 'warning';
    return 'neutral';
}

/** Always resolve via i18n from operation_type — ignore backend English operation_label. */
export function operationLabel(op: ArchivingOperation, t: (k: string) => string): string {
    const normalized = normalizeOperationType(op.operation_type);
    const key = OP_I18N[normalized];
    if (key) {
        const label = t(key);
        if (label && label !== key && !isRawArchivingLabel(label)) return label;
    }
    return t('archiving_op_unknown');
}

export function formatLastArchiveRun(health: ArchiveHealth | undefined, t: (k: string) => string): string {
    if (!health?.last_archive_date) return t('archiving_never_run');
    const days = health.days_since_last_archive;
    if (days != null && days >= 0) {
        return `${health.last_archive_date} (${days}d)`;
    }
    return String(health.last_archive_date);
}

export function partitionYearFromName(partitionName?: string | null): number | null {
    const match = String(partitionName || '').match(/ai_decisions_archive_(\d{4})$/);
    return match ? Number(match[1]) : null;
}

/** Client-side fallback when API returns legacy partition_name without label/year. */
export function normalizePartition(p: ArchivePartition): ArchivePartition {
    const year = p.year ?? partitionYearFromName(p.partition_name) ?? null;
    const label =
        p.label && !isRawArchivingLabel(p.label)
            ? p.label
            : year
              ? `Archive ${year}`
              : p.partition_name
                ? 'Archive partition'
                : 'Archive';
    return {
        ...p,
        year,
        label,
        row_count: Number(p.row_count ?? 0),
        start_date: p.start_date ?? '',
        end_date: p.end_date ?? '',
        size: p.size ?? '—',
    };
}

export function partitionDisplayLabel(p: ArchivePartition): string {
    return normalizePartition(p).label;
}

export function formatPartitionDateRange(start?: string, end?: string): string {
    const s = start?.slice(0, 10) || '—';
    const e = end?.slice(0, 10) || '—';
    return `${s} → ${e}`;
}

export function getRestoreBlockReason(args: {
    archivedCount: number;
    canWrite: boolean;
    restoreStart: string;
    restoreEnd: string;
    isLoading: boolean;
}): RestoreBlockReason {
    if (args.isLoading) return null;
    if (args.archivedCount === 0) return 'no_archived';
    if (!args.canWrite) return 'rbac';
    const valid = Boolean(
        args.restoreStart && args.restoreEnd && new Date(args.restoreStart) < new Date(args.restoreEnd),
    );
    if (!valid) return 'dates_required';
    return null;
}

export function restoreBlockMessage(reason: RestoreBlockReason, t: (k: string) => string): string {
    if (reason === 'no_archived') return t('archiving_restore_empty');
    if (reason === 'rbac') return t('archiving_restore_rbac');
    if (reason === 'dates_required') return t('archiving_restore_select_dates');
    return '';
}

/** Detect raw internal strings that must not appear in UI */
export const RAW_ARCHIVING_PATTERNS = [
    /^ai_decisions_archive_\d{4}$/,
    /^preview_(archive|restore|purge)$/,
    /^archive_old_decisions$/,
    /^restore_from_archive$/,
];

export function isRawArchivingLabel(text: string): boolean {
    const trimmed = text.trim();
    if (RAW_OPERATION_TYPES.has(trimmed)) return true;
    return RAW_ARCHIVING_PATTERNS.some(re => re.test(trimmed));
}

export function isRawOperationType(text: string): boolean {
    return RAW_OPERATION_TYPES.has(text.trim());
}
