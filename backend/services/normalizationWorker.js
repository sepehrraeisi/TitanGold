import { query, transaction } from '../database/db.js';
import { logger } from './logger.js';
import { dataNormalizer } from './normalizers/dataNormalizer.js';
import { dataValidator } from './validators/dataValidator.js';
import { NORMALIZED_DATA_VERSION } from './normalizers/normalizedDataContract.js';
import {
    applyQualityToNormalized,
    scoreNormalizedRecord,
} from './normalizationQualityScorer.js';

/** Rows per scheduler tick (override via argument). */
export const NORMALIZATION_DEFAULT_BATCH = 100;

/** Rows per DB transaction. */
export const NORMALIZATION_SUB_BATCH = 25;

/** Worker version tag in metadata. */
export const NORMALIZATION_WORKER_VERSION = 'dh-norm-worker-1';

/** pg advisory lock — single-flight across PM2 workers. */
const NORMALIZATION_ADVISORY_LOCK_KEY = 8392742;

let workerInProgress = false;

/** @type {object|null} */
let lastRunStats = null;

function emptySummary() {
    return {
        batchSize: 0,
        selected: 0,
        processed: 0,
        errors: 0,
        skipped_run: false,
        skip_reason: null,
        durationMs: 0,
        backlogRemaining: null,
        rowsPerSec: 0,
        errorRate: 0,
        workerVersion: NORMALIZATION_WORKER_VERSION,
    };
}

function parseJsonField(value) {
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

function resolveIngestionMode(row) {
    const meta = parseJsonField(row.metadata) || {};
    const raw = parseJsonField(row.raw_data) || {};
    if (meta.pipeline_version || raw.telegram_message_id != null) return 'collector';
    if (meta.crawler_ingest) return 'fetch';
    if (meta.ingestion_mode) return meta.ingestion_mode;
    return row.source_type === 'telegram' ? 'collector' : 'fetch';
}

/** Backlog stats for observability. */
export async function getNormalizationBacklogStats() {
    const result = await query(`
        SELECT
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE status = 'processed')::int AS processed,
            COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
            COUNT(*) FILTER (
                WHERE status = 'processed' AND normalized_data IS NOT NULL
            )::int AS processed_with_norm
        FROM collected_data
    `);
    return result.rows[0] || { pending: 0, processed: 0, errors: 0 };
}

/** Last run metrics (in-memory). */
export function getNormalizationWorkerStats() {
    return lastRunStats ? { ...lastRunStats } : null;
}

async function markRowError(client, id, message) {
    await client.query(
        `UPDATE collected_data
         SET status = 'error', error_message = $2, processed_at = NOW()
         WHERE id = $1`,
        [id, String(message).slice(0, 1000)],
    );
}

async function persistProcessedRow(client, id, normalized) {
    await client.query(
        `UPDATE collected_data
         SET normalized_data = $2,
             status = 'processed',
             error_message = NULL,
             processed_at = NOW()
         WHERE id = $1`,
        [id, normalized],
    );
}

function processRow(row) {
    const rawData = parseJsonField(row.raw_data);
    if (!rawData || typeof rawData !== 'object') {
        return { ok: false, error: 'raw_data missing or invalid' };
    }

    const ingestionMode = resolveIngestionMode(row);

    let normalized = dataNormalizer.normalize(rawData, row.source_type, {
        sourceId: row.source_id,
        sourceName: row.source_name,
        category: row.source_category,
        collectedAt: row.collected_at,
        ingestionMode,
    });

    const validation = dataValidator.validateContract(normalized);
    if (!validation.valid) {
        return {
            ok: false,
            error: validation.errors.join('; ') || 'Validation failed',
        };
    }

    const quality = scoreNormalizedRecord(normalized, {
        is_active: row.is_active,
        last_status: row.last_status,
        priority: row.priority,
    });

    normalized = applyQualityToNormalized(normalized, quality, NORMALIZATION_WORKER_VERSION);

    if (validation.warnings?.length) {
        normalized.metadata.validation_warnings = validation.warnings;
    }
    if (validation.qualityHints?.length) {
        normalized.metadata.quality_hints = validation.qualityHints;
    }

    normalized.metadata.rawStatus = row.status;
    normalized.metadata.normalization_worker_version = NORMALIZATION_WORKER_VERSION;

    if (!normalized.version) {
        normalized.version = NORMALIZED_DATA_VERSION;
    }

    return { ok: true, normalized };
}

async function processSubBatch(rows) {
    const summary = { processed: 0, errors: 0 };

    await transaction(async (client) => {
        for (const row of rows) {
            await client.query('SAVEPOINT norm_row');
            try {
                const outcome = processRow(row);
                if (!outcome.ok) {
                    await markRowError(client, row.id, outcome.error);
                    summary.errors += 1;
                    await client.query('RELEASE SAVEPOINT norm_row');
                    continue;
                }
                await persistProcessedRow(client, row.id, outcome.normalized);
                summary.processed += 1;
                await client.query('RELEASE SAVEPOINT norm_row');
            } catch (error) {
                await client.query('ROLLBACK TO SAVEPOINT norm_row');
                try {
                    await markRowError(client, row.id, error.message);
                    summary.errors += 1;
                } catch (markErr) {
                    logger.error('Normalization mark error failed', {
                        id: row.id,
                        error: markErr.message,
                    });
                    summary.errors += 1;
                }
            }
        }
    });

    return summary;
}

/**
 * Normalize pending collected_data rows (normalize-only — no agents, queue, or publish).
 */
export async function processNormalizationBatch(
    batchSize = NORMALIZATION_DEFAULT_BATCH,
) {
    const started = Date.now();
    const summary = emptySummary();
    summary.batchSize = batchSize;

    if (workerInProgress) {
        summary.skipped_run = true;
        summary.skip_reason = 'in_memory_lock';
        return summary;
    }

    const lockResult = await query('SELECT pg_try_advisory_lock($1) AS acquired', [
        NORMALIZATION_ADVISORY_LOCK_KEY,
    ]);
    if (!lockResult.rows[0]?.acquired) {
        summary.skipped_run = true;
        summary.skip_reason = 'advisory_lock';
        return summary;
    }

    workerInProgress = true;

    try {
        const rowsResult = await query(
            `SELECT cd.*,
                    ds.type AS source_type,
                    ds.category AS source_category,
                    ds.name AS source_name,
                    ds.priority,
                    ds.is_active,
                    ds.last_status
             FROM collected_data cd
             INNER JOIN data_sources ds ON cd.source_id = ds.id
             WHERE cd.status = 'pending'
             ORDER BY cd.collected_at ASC
             LIMIT $1`,
            [batchSize],
        );

        const rows = rowsResult.rows;
        summary.selected = rows.length;

        if (rows.length === 0) {
            const backlog = await getNormalizationBacklogStats();
            summary.backlogRemaining = backlog.pending;
            summary.durationMs = Date.now() - started;
            lastRunStats = { ...summary, at: new Date().toISOString() };
            return summary;
        }

        for (let offset = 0; offset < rows.length; offset += NORMALIZATION_SUB_BATCH) {
            const chunk = rows.slice(offset, offset + NORMALIZATION_SUB_BATCH);
            const chunkSummary = await processSubBatch(chunk);
            summary.processed += chunkSummary.processed;
            summary.errors += chunkSummary.errors;
        }

        const backlog = await getNormalizationBacklogStats();
        summary.backlogRemaining = backlog.pending;
        summary.durationMs = Date.now() - started;
        summary.rowsPerSec =
            summary.durationMs > 0
                ? Number(((summary.processed / summary.durationMs) * 1000).toFixed(2))
                : 0;
        summary.errorRate =
            summary.selected > 0
                ? Number((summary.errors / summary.selected).toFixed(4))
                : 0;

        lastRunStats = { ...summary, at: new Date().toISOString() };

        if (summary.processed > 0 || summary.errors > 0) {
            logger.info('Normalization worker batch completed', {
                batchSize,
                selected: summary.selected,
                processed: summary.processed,
                errors: summary.errors,
                durationMs: summary.durationMs,
                rowsPerSec: summary.rowsPerSec,
                backlogRemaining: summary.backlogRemaining,
                workerVersion: NORMALIZATION_WORKER_VERSION,
            });
        }

        return summary;
    } catch (error) {
        logger.error('Normalization worker batch failed', {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    } finally {
        workerInProgress = false;
        await query('SELECT pg_advisory_unlock($1)', [NORMALIZATION_ADVISORY_LOCK_KEY]).catch(
            () => {},
        );
    }
}
