/**
 * DH-HEALTH-P1-ACTIVITY-FIX-1 — valid data_hub_logs inserts (action/status schema).
 */
import { query } from '../database/db.js';
import { logger } from './logger.js';

const LEVEL_TO_STATUS = {
    info: 'success',
    warn: 'warning',
    warning: 'warning',
    error: 'failure',
};

/**
 * @param {object} params
 * @param {string|null} [params.sourceId]
 * @param {string} params.action
 * @param {string} [params.status]
 * @param {string} [params.message]
 * @param {object} [params.metadata]
 * @param {number|null} [params.executionTimeMs]
 */
export async function insertDataHubAccessLog({
    sourceId = null,
    action,
    status = 'success',
    message = '',
    metadata = {},
    executionTimeMs = null,
}) {
    await query(
        `INSERT INTO data_hub_logs (source_id, action, status, message, metadata, execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            sourceId,
            action,
            status,
            message,
            JSON.stringify(metadata),
            executionTimeMs,
        ],
    );
}

/**
 * Best-effort log — never throws to caller.
 * @param {object} params
 * @param {string} [params.legacyLevel] — maps info/warn/error to status
 */
export async function tryInsertDataHubAccessLog(params) {
    try {
        const status =
            params.status ||
            LEVEL_TO_STATUS[String(params.legacyLevel || '').toLowerCase()] ||
            'success';
        await insertDataHubAccessLog({ ...params, status });
    } catch (err) {
        logger.error('Failed to write data_hub_logs:', { error: err.message, action: params.action });
    }
}
