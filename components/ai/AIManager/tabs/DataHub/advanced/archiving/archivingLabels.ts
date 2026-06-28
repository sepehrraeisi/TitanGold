import type { ArchiveHealth, ArchivingOperation, ArchivePartition } from '../../services/dataHubArchivingApi';

export type ArchiveHealthCode =
    | 'healthy'
    | 'warning_stale_archive'
    | 'warning_pending'
    | 'no_archives'
    | 'error';

const HEALTH_I18N: Record<ArchiveHealthCode, string> = {
    healthy: 'archiving_status_healthy',
    warning_stale_archive: 'archiving_status_warning_stale',
    warning_pending: 'archiving_status_warning_pending',
    no_archives: 'archiving_status_no_archives',
    error: 'archiving_status_error',
};

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

export function operationLabel(op: ArchivingOperation, t: (k: string) => string): string {
    if (op.operation_label) return op.operation_label;
    const key = OP_I18N[op.operation_type];
    return key ? t(key) : op.operation_type;
}

export function formatLastArchiveRun(health: ArchiveHealth | undefined, t: (k: string) => string): string {
    if (!health?.last_archive_date) return t('archiving_never_run');
    const days = health.days_since_last_archive;
    if (days != null && days >= 0) {
        return `${health.last_archive_date} (${days}d)`;
    }
    return String(health.last_archive_date);
}

export function partitionDisplayLabel(p: ArchivePartition): string {
    return p.label || (p.year ? `Archive ${p.year}` : 'Archive');
}

/** Detect raw internal strings that must not appear in UI */
export const RAW_ARCHIVING_PATTERNS = [
    /^ai_decisions_archive_\d{4}$/,
    /^preview_(archive|restore|purge)$/,
    /^archiving_[a-z0-9_]+$/,
];

export function isRawArchivingLabel(text: string): boolean {
    const t = text.trim();
    return RAW_ARCHIVING_PATTERNS.some(re => re.test(t));
}
