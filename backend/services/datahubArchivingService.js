import { query } from '../database/db.js';
import {
    enrichHealthRow,
    enrichOperationRow,
    enrichPartitionRow,
    ARCHIVE_ADVISORY_LOCK_KEY,
} from './datahubArchivingLabels.js';

const DEFAULT_MAX_ROWS = Number(process.env.ARCHIVE_MAX_ROWS || 1000);

async function withArchiveLock(fn) {
    const lock = await query('SELECT pg_try_advisory_lock($1) AS acquired', [ARCHIVE_ADVISORY_LOCK_KEY]);
    if (!lock.rows[0]?.acquired) {
        const err = new Error('Another archive or restore operation is in progress');
        err.status = 409;
        err.code = 'ARCHIVE_IN_PROGRESS';
        throw err;
    }
    try {
        return await fn();
    } finally {
        await query('SELECT pg_advisory_unlock($1)', [ARCHIVE_ADVISORY_LOCK_KEY]);
    }
}

function mapSqlError(err) {
    if (String(err.message || '').includes('ARCHIVE_IN_PROGRESS')) {
        err.status = 409;
        err.code = 'ARCHIVE_IN_PROGRESS';
    } else if (String(err.message || '').includes('RESTORE_DUPLICATE_CONFLICT')) {
        err.status = 409;
        err.code = 'RESTORE_DUPLICATE_CONFLICT';
    }
    return err;
}

async function logOperationStart({ operationType, dryRun, requestPayload, userId }) {
    const res = await query(
        `INSERT INTO datahub_archiving_operations
            (operation_type, dry_run, request_payload, triggered_by, status, started_at)
         VALUES ($1, $2, $3, $4, 'success', NOW())
         RETURNING id, started_at`,
        [operationType, dryRun, requestPayload, userId || null],
    );
    return { id: String(res.rows[0].id), startedAt: res.rows[0].started_at };
}

async function logOperationEnd(id, { status, resultPayload, errorSummary }) {
    await query(
        `UPDATE datahub_archiving_operations
         SET completed_at = NOW(),
             status = $2,
             result_payload = $3,
             error_summary = $4
         WHERE id = $1`,
        [id, status, resultPayload, errorSummary ?? null],
    );
}

function requireConfirm(flag, code, message) {
    if (flag !== true) {
        const err = new Error(message);
        err.status = 400;
        err.code = code;
        throw err;
    }
}

export async function getArchiveHealth() {
    const res = await query('SELECT * FROM check_archive_health()');
    return enrichHealthRow(res.rows[0] || {});
}

export async function listArchivePartitions() {
    const res = await query('SELECT * FROM list_archive_partitions()');
    return res.rows.map(r => enrichPartitionRow({
        partition_name: r.partition_name,
        start_date: r.start_date,
        end_date: r.end_date,
        row_count: Number(r.row_count || 0),
        size: r.size,
    }));
}

export async function listArchiveSqlStats({ limit }) {
    const res = await query(
        `SELECT id, archive_date, records_archived, oldest_record_date, newest_record_date,
                execution_time_ms, success, error_message, created_at
         FROM ai_decisions_archive_stats
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit],
    );
    return res.rows.map(r => ({
        id: Number(r.id),
        archive_date: r.archive_date,
        records_archived: Number(r.records_archived || 0),
        oldest_record_date: r.oldest_record_date ? new Date(r.oldest_record_date).toISOString() : null,
        newest_record_date: r.newest_record_date ? new Date(r.newest_record_date).toISOString() : null,
        execution_time_ms: r.execution_time_ms != null ? Number(r.execution_time_ms) : null,
        success: Boolean(r.success),
        error_message: r.error_message ?? null,
        created_at: new Date(r.created_at).toISOString(),
    }));
}

export async function listArchivingOperations({ limit, offset }) {
    const res = await query(
        `SELECT id, operation_type, dry_run, request_payload, result_payload, status,
                error_summary, triggered_by, started_at, completed_at
         FROM datahub_archiving_operations
         ORDER BY started_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
    );
    return res.rows.map(r => enrichOperationRow({
        id: String(r.id),
        operation_type: String(r.operation_type),
        dry_run: Boolean(r.dry_run),
        request_payload: r.request_payload || {},
        result_payload: r.result_payload || {},
        status: String(r.status),
        error_summary: r.error_summary ?? null,
        triggered_by: r.triggered_by ?? null,
        started_at: new Date(r.started_at).toISOString(),
        completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    }));
}

export async function listArchivedRecords({ limit, offset, agentId }) {
    const params = [limit, offset];
    let where = '';
    if (agentId) {
        where = 'WHERE agent_id = $3';
        params.push(agentId);
    }
    const res = await query(
        `SELECT id, agent_id, user_id, decision_type, confidence, was_successful,
                execution_time_ms, created_at, archived_at
         FROM ai_decisions_archive
         ${where}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        params,
    );
    const countRes = await query(
        `SELECT COUNT(*)::int AS total FROM ai_decisions_archive ${where}`,
        agentId ? [agentId] : [],
    );
    return {
        records: res.rows.map(r => ({
            id: String(r.id),
            agent_id: r.agent_id ? String(r.agent_id) : null,
            user_id: r.user_id ? String(r.user_id) : null,
            decision_type: r.decision_type,
            confidence: r.confidence != null ? Number(r.confidence) : null,
            was_successful: r.was_successful,
            execution_time_ms: r.execution_time_ms,
            created_at: new Date(r.created_at).toISOString(),
            archived_at: r.archived_at ? new Date(r.archived_at).toISOString() : null,
        })),
        total: Number(countRes.rows[0]?.total || 0),
        limit,
        offset,
    };
}

export async function previewArchive({ daysOld, userId }) {
    const days = daysOld ?? 90;
    const requestPayload = { days_old: days };
    const { id: opId } = await logOperationStart({
        operationType: 'preview_archive',
        dryRun: true,
        requestPayload,
        userId,
    });

    try {
        const res = await query(
            `SELECT COUNT(*)::int AS pending_count,
                    MIN(created_at) AS oldest_date,
                    MAX(created_at) AS newest_date
             FROM ai_decisions
             WHERE created_at < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL`,
            [days],
        );
        const row = res.rows[0];
        const result = {
            dry_run: true,
            days_old: days,
            pending_count: Number(row.pending_count || 0),
            oldest_date: row.oldest_date ? new Date(row.oldest_date).toISOString() : null,
            newest_date: row.newest_date ? new Date(row.newest_date).toISOString() : null,
            cutoff_date: new Date(Date.now() - days * 86400000).toISOString(),
        };
        await logOperationEnd(opId, { status: 'success', resultPayload: result });
        return result;
    } catch (e) {
        await logOperationEnd(opId, {
            status: 'failed',
            resultPayload: {},
            errorSummary: { message: e.message, code: e.code || null },
        });
        throw mapSqlError(e);
    }
}

export async function executeArchive({ daysOld, dryRun, confirmArchive, userId }) {
    const days = daysOld ?? 90;
    if (dryRun === true) {
        return previewArchive({ daysOld: days, userId });
    }
    requireConfirm(confirmArchive, 'CONFIRM_ARCHIVE_REQUIRED', 'Archive requires explicit confirmation');

    const requestPayload = { days_old: days };
    const { id: opId } = await logOperationStart({
        operationType: 'archive',
        dryRun: false,
        requestPayload,
        userId,
    });

    try {
        return await withArchiveLock(async () => {
            const res = await query('SELECT * FROM archive_old_decisions($1, $2)', [days, DEFAULT_MAX_ROWS]);
            const row = res.rows[0] || {};
            const result = {
                dry_run: false,
                days_old: days,
                records_archived: Number(row.records_archived || 0),
                oldest_date: row.oldest_date ? new Date(row.oldest_date).toISOString() : null,
                newest_date: row.newest_date ? new Date(row.newest_date).toISOString() : null,
                execution_time_ms: row.execution_time_ms != null ? Number(row.execution_time_ms) : null,
                max_rows: DEFAULT_MAX_ROWS,
            };
            await logOperationEnd(opId, { status: 'success', resultPayload: result });
            return result;
        });
    } catch (e) {
        await logOperationEnd(opId, {
            status: 'failed',
            resultPayload: {},
            errorSummary: { message: e.message, code: e.code || null },
        });
        throw mapSqlError(e);
    }
}

export async function previewRestore({ startDate, endDate, userId }) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!(start < end)) {
        const err = new Error('end_date must be after start_date');
        err.status = 400;
        err.code = 'INVALID_DATE_RANGE';
        throw err;
    }

    const requestPayload = { start_date: startDate, end_date: endDate };
    const { id: opId } = await logOperationStart({
        operationType: 'preview_restore',
        dryRun: true,
        requestPayload,
        userId,
    });

    try {
        const res = await query(
            `SELECT COUNT(*)::int AS pending_count,
                    MIN(created_at) AS oldest_date,
                    MAX(created_at) AS newest_date
             FROM ai_decisions_archive
             WHERE created_at >= $1 AND created_at < $2`,
            [startDate, endDate],
        );
        const row = res.rows[0];
        const result = {
            dry_run: true,
            start_date: startDate,
            end_date: endDate,
            pending_count: Number(row.pending_count || 0),
            oldest_date: row.oldest_date ? new Date(row.oldest_date).toISOString() : null,
            newest_date: row.newest_date ? new Date(row.newest_date).toISOString() : null,
        };
        await logOperationEnd(opId, { status: 'success', resultPayload: result });
        return result;
    } catch (e) {
        await logOperationEnd(opId, {
            status: 'failed',
            resultPayload: {},
            errorSummary: { message: e.message, code: e.code || null },
        });
        throw e;
    }
}

export async function executeRestore({ startDate, endDate, dryRun, confirmRestore, userId }) {
    if (dryRun === true) {
        return previewRestore({ startDate, endDate, userId });
    }
    requireConfirm(confirmRestore, 'CONFIRM_RESTORE_REQUIRED', 'Restore requires explicit confirmation');

    const requestPayload = { start_date: startDate, end_date: endDate };
    const { id: opId } = await logOperationStart({
        operationType: 'restore',
        dryRun: false,
        requestPayload,
        userId,
    });

    try {
        return await withArchiveLock(async () => {
            const res = await query(
                'SELECT restore_from_archive($1::timestamptz, $2::timestamptz, $3) AS records_restored',
                [startDate, endDate, DEFAULT_MAX_ROWS],
            );
            const recordsRestored = Number(res.rows[0]?.records_restored || 0);
            const result = {
                dry_run: false,
                start_date: startDate,
                end_date: endDate,
                records_restored: recordsRestored,
                max_rows: DEFAULT_MAX_ROWS,
            };
            await logOperationEnd(opId, { status: 'success', resultPayload: result });
            return result;
        });
    } catch (e) {
        await logOperationEnd(opId, {
            status: 'failed',
            resultPayload: {},
            errorSummary: { message: e.message, code: e.code || null },
        });
        throw mapSqlError(e);
    }
}

/** v3.0: count only — never deletes from archive */
export async function previewPurge({ startDate, endDate, userId }) {
    const requestPayload = { start_date: startDate ?? null, end_date: endDate ?? null };
    const { id: opId } = await logOperationStart({
        operationType: 'preview_purge',
        dryRun: true,
        requestPayload,
        userId,
    });

    try {
        let sql = 'SELECT COUNT(*)::int AS would_purge_count FROM ai_decisions_archive WHERE 1=1';
        const params = [];
        if (startDate) {
            params.push(startDate);
            sql += ` AND created_at >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            sql += ` AND created_at < $${params.length}`;
        }
        const res = await query(sql, params);
        const result = {
            dry_run: true,
            purge_apply_available: false,
            would_purge_count: Number(res.rows[0]?.would_purge_count || 0),
            start_date: startDate ?? null,
            end_date: endDate ?? null,
            message: 'v3.0 does not support purge apply; preview count only',
        };
        await logOperationEnd(opId, { status: 'success', resultPayload: result });
        return result;
    } catch (e) {
        await logOperationEnd(opId, {
            status: 'failed',
            resultPayload: {},
            errorSummary: { message: e.message, code: e.code || null },
        });
        throw e;
    }
}

export async function createArchivePartition({ year, confirmCreate, userId }) {
    requireConfirm(confirmCreate, 'CONFIRM_CREATE_REQUIRED', 'Partition creation requires explicit confirmation');

    const requestPayload = { year };
    const { id: opId } = await logOperationStart({
        operationType: 'create_partition',
        dryRun: false,
        requestPayload,
        userId,
    });

    try {
        const res = await query('SELECT create_archive_partition($1) AS message', [year]);
        const result = { year, message: res.rows[0]?.message || 'ok' };
        await logOperationEnd(opId, { status: 'success', resultPayload: result });
        return result;
    } catch (e) {
        await logOperationEnd(opId, {
            status: 'failed',
            resultPayload: {},
            errorSummary: { message: e.message, code: e.code || null },
        });
        throw e;
    }
}

export async function getArchivingDashboard({ statsLimit, opsLimit }) {
    const [health, partitions, sqlStats, operations] = await Promise.all([
        getArchiveHealth(),
        listArchivePartitions(),
        listArchiveSqlStats({ limit: statsLimit }),
        listArchivingOperations({ limit: opsLimit, offset: 0 }),
    ]);
    return { health, partitions, sql_stats: sqlStats, recent_operations: operations };
}
