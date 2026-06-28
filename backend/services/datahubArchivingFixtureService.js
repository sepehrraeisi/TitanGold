/**
 * Test-only fixture helpers for DH-DATA-ARCHIVING-P3 verification.
 * Archives/restores ONLY rows marked with FIXTURE_SOURCE + test_run_id.
 * Not exposed via public HTTP routes.
 */
import { randomUUID } from 'crypto';
import { query, transaction } from '../database/db.js';
import {
    ARCHIVE_ADVISORY_LOCK_KEY,
    enrichPartitionRow,
} from './datahubArchivingLabels.js';
import { previewArchive, previewRestore, previewPurge } from './datahubArchivingService.js';

export const FIXTURE_SOURCE = 'DH_DATA_ARCHIVING_P3_FIXTURE';
export const FIXTURE_CREATED_BY = 'archiving_p3_verify';
export const FIXTURE_DECISION_TYPE = 'p3_fixture_test';
export const DEFAULT_ARCHIVE_THRESHOLD_DAYS = 90;

/** Fixture created_at must be older than archive threshold (120 days). */
export const FIXTURE_AGE_DAYS = 120;

async function logFixtureOperation({ operationType, dryRun, requestPayload, userId, resultPayload, status = 'success', errorSummary = null }) {
    const start = await query(
        `INSERT INTO datahub_archiving_operations
            (operation_type, dry_run, request_payload, triggered_by, status, started_at, completed_at, result_payload, error_summary)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7)
         RETURNING id`,
        [
            operationType,
            dryRun,
            { ...requestPayload, p3_fixture: true },
            userId || null,
            status,
            resultPayload,
            errorSummary,
        ],
    );
    return String(start.rows[0].id);
}

export async function getArchivingCounts() {
    const res = await query(
        `SELECT
            (SELECT COUNT(*)::int FROM ai_decisions) AS active_count,
            (SELECT COUNT(*)::int FROM ai_decisions_archive) AS archived_count,
            (SELECT COUNT(*)::int FROM ai_decisions
             WHERE created_at < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL) AS pending_archive_count,
            (SELECT COUNT(*)::int FROM ai_decisions
             WHERE metadata->>'source' = $2) AS active_fixture_count,
            (SELECT COUNT(*)::int FROM ai_decisions_archive
             WHERE metadata->>'source' = $2) AS archived_fixture_count`,
        [DEFAULT_ARCHIVE_THRESHOLD_DAYS, FIXTURE_SOURCE],
    );
    return res.rows[0];
}

export async function listActiveDecisionIds() {
    const res = await query('SELECT id::text FROM ai_decisions ORDER BY id');
    return res.rows.map(r => r.id);
}

export async function listArchivedDecisionIds() {
    const res = await query('SELECT id::text FROM ai_decisions_archive ORDER BY id');
    return res.rows.map(r => r.id);
}

export async function isAdvisoryLockFree() {
    const res = await query('SELECT pg_try_advisory_lock($1) AS acquired', [ARCHIVE_ADVISORY_LOCK_KEY]);
    const acquired = Boolean(res.rows[0]?.acquired);
    if (acquired) {
        await query('SELECT pg_advisory_unlock($1)', [ARCHIVE_ADVISORY_LOCK_KEY]);
    }
    return acquired;
}

export async function cleanupFixtures({ testRunId = null } = {}) {
    const params = [FIXTURE_SOURCE];
    let sqlActive = `DELETE FROM ai_decisions WHERE metadata->>'source' = $1`;
    let sqlArchive = `DELETE FROM ai_decisions_archive WHERE metadata->>'source' = $1`;
    if (testRunId) {
        params.push(testRunId);
        sqlActive += ` AND metadata->>'test_run_id' = $2`;
        sqlArchive += ` AND metadata->>'test_run_id' = $2`;
    }
    const active = await query(`${sqlActive} RETURNING id`, params);
    const archived = await query(`${sqlArchive} RETURNING id`, params);
    return {
        removed_active: active.rowCount,
        removed_archived: archived.rowCount,
        removed_ids: [...active.rows, ...archived.rows].map(r => String(r.id)),
    };
}

export async function createFixture({ testRunId = randomUUID(), userId = null } = {}) {
    const fixtureId = randomUUID();
    const createdAt = new Date(Date.now() - FIXTURE_AGE_DAYS * 86400000);
    const metadata = {
        source: FIXTURE_SOURCE,
        test_run_id: testRunId,
        created_by: FIXTURE_CREATED_BY,
        p3_fixture: true,
        note: 'Safe P3 archive/restore verification — not production trading data',
    };
    const inputData = { fixture: true, test_run_id: testRunId, harmless: true };
    const outputData = { result: 'p3_fixture_no_op', executed: false };

    await query(
        `INSERT INTO ai_decisions (
            id, agent_id, user_id, decision_type, input_data, output_data,
            confidence, was_successful, execution_time_ms, created_at, metadata
        ) VALUES (
            $1, NULL, $2, $3, $4, $5,
            0, true, 0, $6, $7
        )`,
        [
            fixtureId,
            userId,
            FIXTURE_DECISION_TYPE,
            JSON.stringify(inputData),
            JSON.stringify(outputData),
            createdAt.toISOString(),
            JSON.stringify(metadata),
        ],
    );

    const row = await getFixtureRow(fixtureId, testRunId, 'active');
    return {
        fixture_id: fixtureId,
        test_run_id: testRunId,
        created_at: row.created_at,
        metadata,
        input_data: inputData,
        output_data: outputData,
    };
}

async function getFixtureRow(fixtureId, testRunId, location) {
    const table = location === 'archive' ? 'ai_decisions_archive' : 'ai_decisions';
    const res = await query(
        `SELECT id, agent_id, user_id, decision_type, input_data, output_data,
                confidence, was_successful, execution_time_ms, created_at, metadata,
                ${location === 'archive' ? 'archived_at,' : ''}
                metadata->>'source' AS fixture_source,
                metadata->>'test_run_id' AS fixture_test_run_id
         FROM ${table}
         WHERE id = $1
           AND metadata->>'source' = $2
           AND metadata->>'test_run_id' = $3`,
        [fixtureId, FIXTURE_SOURCE, testRunId],
    );
    if (res.rows.length !== 1) {
        const err = new Error(`Fixture row not found in ${table}: ${fixtureId}`);
        err.code = 'FIXTURE_NOT_FOUND';
        throw err;
    }
    return res.rows[0];
}

export async function previewArchiveFixture({ fixtureId, testRunId, daysOld = DEFAULT_ARCHIVE_THRESHOLD_DAYS, userId = null }) {
    await getFixtureRow(fixtureId, testRunId, 'active');
    const preview = await previewArchive({ daysOld, userId });
    const candidate = await query(
        `SELECT id::text FROM ai_decisions
         WHERE id = $1
           AND metadata->>'source' = $2
           AND metadata->>'test_run_id' = $3
           AND created_at < CURRENT_TIMESTAMP - ($4 || ' days')::INTERVAL`,
        [fixtureId, FIXTURE_SOURCE, testRunId, daysOld],
    );
    const inArchive = await query(
        `SELECT id FROM ai_decisions_archive WHERE id = $1`,
        [fixtureId],
    );
    return {
        ...preview,
        fixture_in_preview: candidate.rows.length === 1,
        fixture_already_archived: inArchive.rows.length > 0,
        fixture_id: fixtureId,
    };
}

export async function archiveFixtureById({ fixtureId, testRunId, userId = null, daysOld = DEFAULT_ARCHIVE_THRESHOLD_DAYS }) {
    const beforeActiveIds = await listActiveDecisionIds();
    const beforeArchivedIds = await listArchivedDecisionIds();

    const opId = await logFixtureOperation({
        operationType: 'archive',
        dryRun: false,
        requestPayload: { fixture_id: fixtureId, test_run_id: testRunId, days_old: daysOld, scoped: 'fixture_only' },
        userId,
        resultPayload: {},
        status: 'success',
    });

    try {
        const result = await transaction(async client => {
            const lock = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [ARCHIVE_ADVISORY_LOCK_KEY]);
            if (!lock.rows[0]?.acquired) {
                const err = new Error('Another archive or restore operation is in progress');
                err.code = 'ARCHIVE_IN_PROGRESS';
                throw err;
            }

            try {
                const rowRes = await client.query(
                    `SELECT id, agent_id, user_id, decision_type, input_data, output_data,
                            confidence, was_successful, execution_time_ms, created_at, metadata
                     FROM ai_decisions
                     WHERE id = $1
                       AND metadata->>'source' = $2
                       AND metadata->>'test_run_id' = $3
                       AND created_at < CURRENT_TIMESTAMP - ($4 || ' days')::INTERVAL
                     FOR UPDATE`,
                    [fixtureId, FIXTURE_SOURCE, testRunId, daysOld],
                );
                if (rowRes.rows.length !== 1) {
                    const err = new Error('Fixture not eligible for archive or not found in active table');
                    err.code = 'FIXTURE_NOT_ELIGIBLE';
                    throw err;
                }
                const row = rowRes.rows[0];
                const year = new Date(row.created_at).getUTCFullYear();
                await client.query('SELECT create_archive_partition($1)', [year]);

                const delRes = await client.query(
                    `DELETE FROM ai_decisions
                     WHERE id = $1 AND created_at = $2
                     RETURNING id, agent_id, user_id, decision_type, input_data, output_data,
                               confidence, was_successful, execution_time_ms, created_at, metadata`,
                    [row.id, row.created_at],
                );
                if (delRes.rows.length !== 1) {
                    throw new Error('Fixture delete from active failed');
                }
                const moved = delRes.rows[0];

                const insRes = await client.query(
                    `INSERT INTO ai_decisions_archive (
                        id, agent_id, user_id, decision_type, input_data, output_data,
                        confidence, was_successful, execution_time_ms, created_at, metadata
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    RETURNING id, created_at, archived_at`,
                    [
                        moved.id,
                        moved.agent_id,
                        moved.user_id,
                        moved.decision_type,
                        moved.input_data,
                        moved.output_data,
                        moved.confidence,
                        moved.was_successful,
                        moved.execution_time_ms,
                        moved.created_at,
                        moved.metadata,
                    ],
                );

                return {
                    records_archived: 1,
                    fixture_id: fixtureId,
                    archive_partition_year: year,
                    archived_at: insRes.rows[0].archived_at,
                    created_at: insRes.rows[0].created_at,
                };
            } finally {
                await client.query('SELECT pg_advisory_unlock($1)', [ARCHIVE_ADVISORY_LOCK_KEY]);
            }
        });

        const afterActiveIds = await listActiveDecisionIds();
        const afterArchivedIds = await listArchivedDecisionIds();
        const movement = verifyNoNonFixtureMovement({
            beforeActiveIds,
            afterActiveIds,
            beforeArchivedIds,
            afterArchivedIds,
            fixtureId,
            phase: 'archive',
        });

        await query(
            `UPDATE datahub_archiving_operations SET result_payload = $2 WHERE id = $1`,
            [opId, { ...result, movement_check: movement }],
        );

        return { operation_id: opId, ...result, movement_check: movement };
    } catch (e) {
        await query(
            `UPDATE datahub_archiving_operations
             SET status = 'failed', error_summary = $2
             WHERE id = $1`,
            [opId, JSON.stringify({ message: e.message, code: e.code || null })],
        );
        throw e;
    }
}

export async function previewRestoreFixture({ fixtureId, testRunId, userId = null }) {
    const archived = await getFixtureRow(fixtureId, testRunId, 'archive');
    const startDate = new Date(new Date(archived.created_at).getTime() - 3600000).toISOString();
    const endDate = new Date(new Date(archived.created_at).getTime() + 3600000).toISOString();
    const preview = await previewRestore({ startDate, endDate, userId });

    const fixtureStillArchived = await query(
        `SELECT id FROM ai_decisions_archive
         WHERE id = $1 AND metadata->>'source' = $2 AND metadata->>'test_run_id' = $3`,
        [fixtureId, FIXTURE_SOURCE, testRunId],
    );
    const fixtureInActive = await query(
        `SELECT id FROM ai_decisions WHERE id = $1`,
        [fixtureId],
    );

    return {
        ...preview,
        fixture_id: fixtureId,
        restore_window: { start_date: startDate, end_date: endDate },
        fixture_in_archive_before_restore: fixtureStillArchived.rows.length === 1,
        fixture_in_active_before_restore: fixtureInActive.rows.length > 0,
        fixture_in_preview: Number(preview.pending_count || 0) >= 1,
    };
}

export async function restoreFixtureById({ fixtureId, testRunId, userId = null }) {
    const archived = await getFixtureRow(fixtureId, testRunId, 'archive');
    const beforeActiveIds = await listActiveDecisionIds();
    const beforeArchivedIds = await listArchivedDecisionIds();

    const opId = await logFixtureOperation({
        operationType: 'restore',
        dryRun: false,
        requestPayload: { fixture_id: fixtureId, test_run_id: testRunId, scoped: 'fixture_only' },
        userId,
        resultPayload: {},
        status: 'success',
    });

    try {
        const result = await transaction(async client => {
            const lock = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [ARCHIVE_ADVISORY_LOCK_KEY]);
            if (!lock.rows[0]?.acquired) {
                const err = new Error('Another archive or restore operation is in progress');
                err.code = 'ARCHIVE_IN_PROGRESS';
                throw err;
            }

            try {
                const dup = await client.query(
                    `SELECT a.id FROM ai_decisions_archive a
                     INNER JOIN ai_decisions d ON d.id = a.id
                     WHERE a.id = $1`,
                    [fixtureId],
                );
                if (dup.rows.length > 0) {
                    const err = new Error('RESTORE_DUPLICATE_CONFLICT: fixture already exists in active table');
                    err.code = 'RESTORE_DUPLICATE_CONFLICT';
                    throw err;
                }

                const rowRes = await client.query(
                    `SELECT id, agent_id, user_id, decision_type, input_data, output_data,
                            confidence, was_successful, execution_time_ms, created_at, metadata
                     FROM ai_decisions_archive
                     WHERE id = $1
                       AND metadata->>'source' = $2
                       AND metadata->>'test_run_id' = $3
                     FOR UPDATE`,
                    [fixtureId, FIXTURE_SOURCE, testRunId],
                );
                if (rowRes.rows.length !== 1) {
                    const err = new Error('Fixture not found in archive');
                    err.code = 'FIXTURE_NOT_IN_ARCHIVE';
                    throw err;
                }
                const row = rowRes.rows[0];

                const delRes = await client.query(
                    `DELETE FROM ai_decisions_archive
                     WHERE id = $1 AND created_at = $2
                     RETURNING id, agent_id, user_id, decision_type, input_data, output_data,
                               confidence, was_successful, execution_time_ms, created_at, metadata`,
                    [row.id, row.created_at],
                );
                if (delRes.rows.length !== 1) {
                    throw new Error('Fixture delete from archive failed');
                }
                const moved = delRes.rows[0];

                const insRes = await client.query(
                    `INSERT INTO ai_decisions (
                        id, agent_id, user_id, decision_type, input_data, output_data,
                        confidence, was_successful, execution_time_ms, created_at, metadata
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    RETURNING id, created_at`,
                    [
                        moved.id,
                        moved.agent_id,
                        moved.user_id,
                        moved.decision_type,
                        moved.input_data,
                        moved.output_data,
                        moved.confidence,
                        moved.was_successful,
                        moved.execution_time_ms,
                        moved.created_at,
                        moved.metadata,
                    ],
                );

                return {
                    records_restored: 1,
                    fixture_id: fixtureId,
                    restored_created_at: insRes.rows[0].created_at,
                    original_created_at: archived.created_at,
                };
            } finally {
                await client.query('SELECT pg_advisory_unlock($1)', [ARCHIVE_ADVISORY_LOCK_KEY]);
            }
        });

        const afterActiveIds = await listActiveDecisionIds();
        const afterArchivedIds = await listArchivedDecisionIds();
        const movement = verifyNoNonFixtureMovement({
            beforeActiveIds,
            afterActiveIds,
            beforeArchivedIds,
            afterArchivedIds,
            fixtureId,
            phase: 'restore',
        });

        await query(
            `UPDATE datahub_archiving_operations SET result_payload = $2 WHERE id = $1`,
            [opId, { ...result, movement_check: movement }],
        );

        return { operation_id: opId, ...result, movement_check: movement };
    } catch (e) {
        await query(
            `UPDATE datahub_archiving_operations
             SET status = 'failed', error_summary = $2
             WHERE id = $1`,
            [opId, JSON.stringify({ message: e.message, code: e.code || null })],
        );
        throw e;
    }
}

export function verifyNoNonFixtureMovement({
    beforeActiveIds,
    afterActiveIds,
    beforeArchivedIds,
    afterArchivedIds,
    fixtureId,
    phase,
}) {
    const beforeActiveSet = new Set(beforeActiveIds);
    const afterActiveSet = new Set(afterActiveIds);
    const beforeArchivedSet = new Set(beforeArchivedIds);
    const afterArchivedSet = new Set(afterArchivedIds);

    const nonFixtureActiveBefore = beforeActiveIds.filter(id => id !== fixtureId).sort();
    const nonFixtureActiveAfter = afterActiveIds.filter(id => id !== fixtureId).sort();
    const nonFixtureArchivedBefore = beforeArchivedIds.filter(id => id !== fixtureId).sort();
    const nonFixtureArchivedAfter = afterArchivedIds.filter(id => id !== fixtureId).sort();

    const activeUnchanged =
        JSON.stringify(nonFixtureActiveBefore) === JSON.stringify(nonFixtureActiveAfter);
    const archivedUnchanged =
        JSON.stringify(nonFixtureArchivedBefore) === JSON.stringify(nonFixtureArchivedAfter);

    let fixtureMovedCorrectly = false;
    if (phase === 'archive') {
        fixtureMovedCorrectly =
            beforeActiveSet.has(fixtureId) &&
            !afterActiveSet.has(fixtureId) &&
            afterArchivedSet.has(fixtureId);
    } else if (phase === 'restore') {
        fixtureMovedCorrectly =
            beforeArchivedSet.has(fixtureId) &&
            !afterArchivedSet.has(fixtureId) &&
            afterActiveSet.has(fixtureId);
    }

    return {
        ok: activeUnchanged && archivedUnchanged && fixtureMovedCorrectly,
        phase,
        active_non_fixture_unchanged: activeUnchanged,
        archived_non_fixture_unchanged: archivedUnchanged,
        fixture_moved_correctly: fixtureMovedCorrectly,
        non_fixture_active_before: nonFixtureActiveBefore,
        non_fixture_active_after: nonFixtureActiveAfter,
    };
}

function normalizeJson(value) {
    if (value == null) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
}

function jsonDeepEqual(a, b) {
    const na = normalizeJson(a);
    const nb = normalizeJson(b);
    if (na === nb) return true;
    if (na == null || nb == null) return na === nb;
    if (typeof na !== typeof nb) return false;
    if (typeof na !== 'object') return na === nb;
    if (Array.isArray(na)) {
        return Array.isArray(nb) && na.length === nb.length && na.every((v, i) => jsonDeepEqual(v, nb[i]));
    }
    const keysA = Object.keys(na).sort();
    const keysB = Object.keys(nb).sort();
    if (keysA.length !== keysB.length || keysA.some((k, i) => k !== keysB[i])) return false;
    return keysA.every(k => jsonDeepEqual(na[k], nb[k]));
}

export async function assertFixturePayloadMatch(fixtureId, testRunId, expected) {
    const row = await getFixtureRow(fixtureId, testRunId, 'active');
    const input = normalizeJson(row.input_data);
    const output = normalizeJson(row.output_data);
    const meta = normalizeJson(row.metadata);
    return {
        input_matches: jsonDeepEqual(input, expected.input_data),
        output_matches: jsonDeepEqual(output, expected.output_data),
        metadata_matches:
            meta.test_run_id === expected.test_run_id && meta.source === FIXTURE_SOURCE,
        created_at: row.created_at,
    };
}

export async function getFixtureArchivePartition(fixtureId, testRunId) {
    const res = await query(
        `SELECT tableoid::regclass::text AS partition_name, archived_at
         FROM ai_decisions_archive
         WHERE id = $1 AND metadata->>'source' = $2 AND metadata->>'test_run_id' = $3`,
        [fixtureId, FIXTURE_SOURCE, testRunId],
    );
    if (!res.rows[0]) return null;
    return {
        partition_name: res.rows[0].partition_name,
        archived_at: res.rows[0].archived_at,
        label: enrichPartitionRow({ partition_name: res.rows[0].partition_name, row_count: 1 }).label,
    };
}

export async function assertPurgeCountOnly(userId = null) {
    const before = await getArchivingCounts();
    const preview = await previewPurge({}, userId);
    const after = await getArchivingCounts();
    return {
        purge_apply_available: preview.purge_apply_available,
        would_purge_count: preview.would_purge_count,
        archived_count_unchanged: before.archived_count === after.archived_count,
        active_count_unchanged: before.active_count === after.active_count,
    };
}
