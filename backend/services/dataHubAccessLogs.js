import { query } from '../database/db.js';

function mapDbStatusToUi(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success' || s === 'ok') return 'success';
  if (s === 'cached') return 'cached';
  if (s === 'failure' || s === 'failed' || s === 'error') return 'failed';
  if (s === 'pending' || s === 'timeout') return 'timeout';
  return 'success';
}

function uiStatusToDbFilter(status) {
  switch (status) {
    case 'success':
      return ["LOWER(status) IN ('success', 'ok')"];
    case 'cached':
      return ["LOWER(status) = 'cached'"];
    case 'failed':
      return ["LOWER(status) IN ('failure', 'failed', 'error')"];
    case 'timeout':
      return ["LOWER(status) IN ('pending', 'timeout')"];
    default:
      return null;
  }
}

function mapRowToAccessLog(row) {
  const meta =
    typeof row.metadata === 'string'
      ? (() => {
          try {
            return JSON.parse(row.metadata);
          } catch {
            return {};
          }
        })()
      : row.metadata || {};

  const uiStatus = mapDbStatusToUi(row.status);

  return {
    id: row.id,
    timestamp: new Date(row.created_at).toISOString(),
    agentId: meta.agent_id || meta.agentId || 'system',
    sourceId: row.source_id || '',
    dataType: row.action || meta.data_type || meta.dataType || 'unknown',
    status: uiStatus,
    responseTime:
      row.execution_time_ms != null ? Number(row.execution_time_ms) : undefined,
    error: uiStatus === 'failed' ? row.message || undefined : undefined,
    dataSize: row.data_size != null ? Number(row.data_size) : undefined,
  };
}

/**
 * List DataHub access logs for Logs tab (GAP-013).
 */
export async function listDataHubAccessLogs({
  limit = 100,
  offset = 0,
  source_id,
  status,
}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (source_id) {
    conditions.push(`source_id = $${paramIndex++}`);
    params.push(source_id);
  }

  if (status) {
    const dbFilter = uiStatusToDbFilter(status);
    if (dbFilter) {
      conditions.push(dbFilter[0]);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countResult, dataResult, countsResult] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM data_hub_logs ${whereClause}`, params),
    query(
      `SELECT id, source_id, action, status, message, data_size, execution_time_ms, created_at, metadata
       FROM data_hub_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset],
    ),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(status) IN ('success', 'ok', 'cached'))::int AS success,
        COUNT(*) FILTER (WHERE LOWER(status) IN ('failure', 'failed', 'error'))::int AS error,
        COUNT(*) FILTER (
          WHERE LOWER(status) NOT IN ('success', 'ok', 'cached', 'failure', 'failed', 'error', 'pending', 'timeout')
        )::int AS warning
      FROM data_hub_logs
      ${whereClause}`,
      params,
    ),
  ]);

  const total = countResult.rows[0]?.total ?? 0;
  const counts = countsResult.rows[0] || {};

  return {
    data: dataResult.rows.map(mapRowToAccessLog),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    statusCounts: {
      success: parseInt(counts.success, 10) || 0,
      error: parseInt(counts.error, 10) || 0,
      warning: parseInt(counts.warning, 10) || 0,
    },
  };
}
