/** Human-facing labels and stable health codes for Data Archiving (P2). */

export const ARCHIVE_HEALTH_CODES = {
    HEALTHY: 'healthy',
    WARNING_STALE_ARCHIVE: 'warning_stale_archive',
    WARNING_PENDING: 'warning_pending',
    NO_ARCHIVES: 'no_archives',
    ERROR: 'error',
};

export const ARCHIVE_OPERATION_LABELS = {
    preview_archive: 'Archive preview',
    archive: 'Archive applied',
    archive_old_decisions: 'Archive applied',
    preview_restore: 'Restore preview',
    restore: 'Restore applied',
    restore_from_archive: 'Restore applied',
    preview_purge: 'Purge preview',
    create_partition: 'Partition created',
};

export const ARCHIVE_ADVISORY_LOCK_KEY = 90324001;

export function partitionFriendlyLabel(partitionName) {
    const match = String(partitionName || '').match(/ai_decisions_archive_(\d{4})$/);
    if (match) return `Archive ${match[1]}`;
    return 'Archive partition';
}

export function partitionYear(partitionName) {
    const match = String(partitionName || '').match(/ai_decisions_archive_(\d{4})$/);
    return match ? Number(match[1]) : null;
}

export function mapArchiveHealthCode(row) {
    const status = String(row?.status || '');
    const archived = Number(row?.archived_records || 0);
    const pending = Number(row?.records_pending_archive || 0);
    const lastSuccess = row?.last_archive_success;

    if (status.includes('ERROR') || lastSuccess === false) {
        return ARCHIVE_HEALTH_CODES.ERROR;
    }
    if (status.includes('>30 days')) {
        return ARCHIVE_HEALTH_CODES.WARNING_STALE_ARCHIVE;
    }
    if (status.includes('need archiving') || pending > 0) {
        return ARCHIVE_HEALTH_CODES.WARNING_PENDING;
    }
    if (archived === 0 && pending === 0 && !status.includes('OK')) {
        return ARCHIVE_HEALTH_CODES.NO_ARCHIVES;
    }
    if (status === 'OK' || status.toUpperCase() === 'OK') {
        return archived === 0 ? ARCHIVE_HEALTH_CODES.NO_ARCHIVES : ARCHIVE_HEALTH_CODES.HEALTHY;
    }
    if (status.includes('WARNING')) {
        return ARCHIVE_HEALTH_CODES.WARNING_STALE_ARCHIVE;
    }
    return archived > 0 ? ARCHIVE_HEALTH_CODES.HEALTHY : ARCHIVE_HEALTH_CODES.NO_ARCHIVES;
}

export function enrichHealthRow(row) {
    const statusCode = mapArchiveHealthCode(row);
    return {
        status_code: statusCode,
        status_message: row?.status ?? null,
        active_records: Number(row?.active_records || 0),
        archived_records: Number(row?.archived_records || 0),
        oldest_active_date: row?.oldest_active_date
            ? new Date(row.oldest_active_date).toISOString()
            : null,
        last_archive_date: row?.last_archive_date
            ? new Date(row.last_archive_date).toISOString().slice(0, 10)
            : null,
        last_archive_success: row?.last_archive_success ?? null,
        days_since_last_archive:
            row?.days_since_last_archive != null ? Number(row.days_since_last_archive) : null,
        records_pending_archive: Number(row?.records_pending_archive || 0),
    };
}

export function enrichPartitionRow(row) {
    const year = partitionYear(row.partition_name);
    return {
        partition_name: row.partition_name,
        year,
        label: year ? `Archive ${year}` : partitionFriendlyLabel(row.partition_name),
        start_date: row.start_date,
        end_date: row.end_date,
        row_count: Number(row.row_count || 0),
        size: row.size,
    };
}

export function enrichOperationRow(row) {
    const normalized = row.operation_type === 'archive_old_decisions'
        ? 'archive'
        : row.operation_type === 'restore_from_archive'
          ? 'restore'
          : row.operation_type;
    return {
        ...row,
        operation_type: String(row.operation_type),
        operation_label: ARCHIVE_OPERATION_LABELS[normalized] || ARCHIVE_OPERATION_LABELS[row.operation_type] || null,
    };
}

export function operationTypeLabel(operationType) {
    return ARCHIVE_OPERATION_LABELS[operationType] || String(operationType || 'Unknown');
}
